<script lang="ts">
	import { t, type Lang } from '#lib/i18n';
	import { formatDuration } from '#lib/format';
	import type HlsType from 'hls.js';

	type Quality = { label: string; url: string };

	let {
		src,
		qualities = [],
		poster = '',
		title = '',
		lang = 'nl' as Lang
	}: {
		src: string | null;
		qualities?: Quality[];
		poster?: string;
		title?: string;
		lang?: Lang;
	} = $props();

	let videoEl: HTMLVideoElement | undefined = $state();
	let rootEl: HTMLDivElement | undefined = $state();
	let showChrome = $state(true);
	let locked = $state(false);
	let playing = $state(false);
	let buffering = $state(false);
	let current = $state(0);
	let duration = $state(0);
	let rate = $state(1);
	let activeSrc = $state<string | null>(null);
	let flash = $state<{ side: 'left' | 'right'; text: string } | null>(null);
	let hideTimer: ReturnType<typeof setTimeout> | undefined;
	let lastTap = 0;
	let lastTapX = 0;
	let hls: HlsType | null = null;
	let attachGen = 0;
	let mediaError = $state('');
	/** User explicitly paused — attach/effect must not call play() until they resume. */
	let userPaused = false;
	let cssFullscreen = $state(false);
	let orientFsBusy = false;

	function looksLikeHls(url: string) {
		return /m3u8|hls_variant|\/hls[/_]|\.m3u8/i.test(url);
	}

	$effect(() => {
		const next = src;
		activeSrc = next;
		mediaError = '';
		// New stream → allow initial autoplay again.
		userPaused = false;
	});

	$effect(() => {
		const el = videoEl;
		const url = activeSrc;
		const gen = ++attachGen;
		hls?.destroy();
		hls = null;
		if (!el) return;
		el.removeAttribute('src');
		el.load();
		if (!url) return;

		let cancelled = false;
		// Capture pause intent at attach start so a later pause isn't overwritten by late play().
		const shouldAutoplay = () => !cancelled && gen === attachGen && !userPaused;

		async function attach() {
			if (!el || !url || cancelled || gen !== attachGen) return;
			buffering = true;
			mediaError = '';
			try {
				if (looksLikeHls(url)) {
					const native = el.canPlayType('application/vnd.apple.mpegurl');
					if (native) {
						el.src = url;
					} else {
						const { default: Hls } = await import('hls.js');
						if (cancelled || gen !== attachGen || !el) return;
						if (Hls.isSupported()) {
							const instance = new Hls({
								enableWorker: true,
								maxBufferLength: 30
							});
							hls = instance;
							instance.on(Hls.Events.ERROR, (_e, data) => {
								if (data.fatal) {
									buffering = false;
									mediaError = 'Stream error';
								}
							});
							instance.loadSource(url);
							instance.attachMedia(el);
							await new Promise<void>((resolve) => {
								instance.once(Hls.Events.MANIFEST_PARSED, () => resolve());
								instance.once(Hls.Events.ERROR, (_ev, data) => {
									if (data.fatal) resolve();
								});
							});
						} else {
							el.src = url;
						}
					}
				} else {
					el.src = url;
					await new Promise<void>((resolve) => {
						const ok = () => {
							cleanup();
							resolve();
						};
						const fail = () => {
							cleanup();
							mediaError = 'Stream error';
							resolve();
						};
						const cleanup = () => {
							el.removeEventListener('loadeddata', ok);
							el.removeEventListener('error', fail);
						};
						el.addEventListener('loadeddata', ok, { once: true });
						el.addEventListener('error', fail, { once: true });
					});
				}
				if (!shouldAutoplay()) return;
				await el.play().catch(() => {});
			} finally {
				if (gen === attachGen) buffering = false;
			}
		}

		void attach();

		return () => {
			cancelled = true;
			hls?.destroy();
			hls = null;
		};
	});

	function isLandscape() {
		if (typeof window === 'undefined') return false;
		if (window.screen?.orientation?.type) {
			return window.screen.orientation.type.startsWith('landscape');
		}
		if (typeof window.orientation === 'number') {
			return Math.abs(window.orientation) === 90;
		}
		return window.matchMedia('(orientation: landscape)').matches;
	}

	function isCoarsePointerMobile() {
		if (typeof window === 'undefined') return false;
		return window.matchMedia('(hover: none) and (pointer: coarse)').matches;
	}

	function isNativeFullscreen() {
		const doc = document as Document & {
			webkitFullscreenElement?: Element | null;
		};
		const el = videoEl as (HTMLVideoElement & { webkitDisplayingFullscreen?: boolean }) | undefined;
		return Boolean(
			document.fullscreenElement ||
				doc.webkitFullscreenElement ||
				el?.webkitDisplayingFullscreen
		);
	}

	async function enterFullscreen() {
		const el = videoEl;
		const root = rootEl;
		if (!el) return;

		try {
			const anyEl = el as HTMLVideoElement & {
				webkitEnterFullscreen?: () => void;
				webkitSupportsFullscreen?: boolean;
			};
			// iOS Safari: only the <video> can go fullscreen (no element Fullscreen API).
			if (typeof anyEl.webkitEnterFullscreen === 'function') {
				anyEl.webkitEnterFullscreen();
				return;
			}
			if (root?.requestFullscreen) {
				await root.requestFullscreen();
				return;
			}
			const rootWebkit = root as (HTMLDivElement & { webkitRequestFullscreen?: () => void }) | undefined;
			if (rootWebkit?.webkitRequestFullscreen) {
				rootWebkit.webkitRequestFullscreen();
				return;
			}
		} catch {
			/* fall through to CSS */
		}
		cssFullscreen = true;
	}

	async function exitFullscreen() {
		cssFullscreen = false;
		try {
			const el = videoEl as
				| (HTMLVideoElement & { webkitExitFullscreen?: () => void; webkitDisplayingFullscreen?: boolean })
				| undefined;
			if (el?.webkitDisplayingFullscreen && typeof el.webkitExitFullscreen === 'function') {
				el.webkitExitFullscreen();
				return;
			}
			const doc = document as Document & { webkitExitFullscreen?: () => void };
			if (document.fullscreenElement) {
				await document.exitFullscreen();
				return;
			}
			if (doc.webkitExitFullscreen) {
				doc.webkitExitFullscreen();
			}
		} catch {
			/* ignore */
		}
	}

	async function toggleFullscreen() {
		if (cssFullscreen || isNativeFullscreen()) await exitFullscreen();
		else await enterFullscreen();
	}

	async function syncOrientationFullscreen() {
		if (!videoEl || !activeSrc || orientFsBusy) return;
		if (!isCoarsePointerMobile()) return;
		orientFsBusy = true;
		try {
			if (isLandscape()) {
				if (!cssFullscreen && !isNativeFullscreen()) await enterFullscreen();
			} else if (cssFullscreen || isNativeFullscreen()) {
				await exitFullscreen();
			}
		} finally {
			orientFsBusy = false;
		}
	}

	$effect(() => {
		// Re-bind when media is ready so a landscape phone can enter FS after stream attaches.
		const ready = Boolean(videoEl && activeSrc);
		if (typeof window === 'undefined') return;
		const onOrient = () => {
			void syncOrientationFullscreen();
		};
		window.addEventListener('orientationchange', onOrient);
		window.screen?.orientation?.addEventListener?.('change', onOrient);
		const mql = window.matchMedia('(orientation: landscape)');
		const onMql = () => onOrient();
		mql.addEventListener?.('change', onMql);
		if (ready) onOrient();
		return () => {
			window.removeEventListener('orientationchange', onOrient);
			window.screen?.orientation?.removeEventListener?.('change', onOrient);
			mql.removeEventListener?.('change', onMql);
		};
	});

	function bumpChrome() {
		if (locked) return;
		showChrome = true;
		clearTimeout(hideTimer);
		hideTimer = setTimeout(() => {
			if (playing) showChrome = false;
		}, 2600);
	}

	function togglePlay() {
		if (!videoEl || locked) return;
		if (videoEl.paused) {
			userPaused = false;
			videoEl.play().catch(() => {});
		} else {
			userPaused = true;
			videoEl.pause();
		}
		bumpChrome();
	}

	function seekBy(delta: number) {
		if (!videoEl || !Number.isFinite(duration)) return;
		videoEl.currentTime = Math.max(0, Math.min(duration, videoEl.currentTime + delta));
		flash = { side: delta < 0 ? 'left' : 'right', text: `${delta > 0 ? '+' : ''}${delta}` };
		setTimeout(() => (flash = null), 550);
		bumpChrome();
	}

	function fromChromeControls(target: EventTarget | null) {
		// Chrome is full-bleed; only ignore real controls so empty chrome taps still hide UI.
		return (
			target instanceof Element &&
			Boolean(target.closest('button, select, input, .yt-scrub, .yt-tools, .yt-time-row'))
		);
	}

	function onPointerUp(e: PointerEvent) {
		// Pause/play and other chrome controls also fire pointerup on the player shell.
		// Ignoring them prevents the 280ms tap handler from toggling play again (~0.5s auto-resume).
		if (fromChromeControls(e.target)) return;
		if (locked) {
			showChrome = true;
			return;
		}
		const now = Date.now();
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const x = e.clientX - rect.left;
		if (now - lastTap < 280 && Math.abs(x - lastTapX) < 90) {
			if (x < rect.width / 2) seekBy(-10);
			else seekBy(10);
			lastTap = 0;
			return;
		}
		lastTap = now;
		lastTapX = x;
		setTimeout(() => {
			if (Date.now() - lastTap >= 280) {
				if (showChrome && playing) {
					showChrome = false;
				} else {
					togglePlay();
				}
			}
		}, 280);
	}

	function onScrub(e: Event) {
		const v = Number((e.currentTarget as HTMLInputElement).value);
		if (videoEl) videoEl.currentTime = v;
		current = v;
	}

	async function pip() {
		if (!videoEl) return;
		try {
			if (document.pictureInPictureElement) await document.exitPictureInPicture();
			else await videoEl.requestPictureInPicture();
		} catch {
			/* unsupported */
		}
	}

	function setQuality(url: string) {
		userPaused = false;
		activeSrc = url;
	}

	const progress = $derived(duration > 0 ? (current / duration) * 100 : 0);
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="yt-player"
	class:is-playing={playing}
	class:yt-css-fs={cssFullscreen}
	bind:this={rootEl}
	onpointerup={onPointerUp}
>
	{#if activeSrc}
		<video
			bind:this={videoEl}
			{poster}
			playsinline
			webkit-playsinline
			preload="auto"
			{title}
			onplay={() => {
				playing = true;
				bumpChrome();
			}}
			onpause={() => {
				playing = false;
				showChrome = true;
			}}
			onwaiting={() => (buffering = true)}
			onplaying={() => (buffering = false)}
			ontimeupdate={() => {
				if (videoEl) current = videoEl.currentTime;
			}}
			ondurationchange={() => {
				if (videoEl && Number.isFinite(videoEl.duration)) duration = videoEl.duration;
			}}
			onloadedmetadata={() => {
				if (videoEl && Number.isFinite(videoEl.duration)) duration = videoEl.duration;
			}}
		></video>
	{:else}
		<div class="yt-player-empty">
			{#if poster}
				<img src={poster} alt="" class="yt-player-poster" />
			{/if}
			<p>{t(lang, 'noStream')}</p>
		</div>
	{/if}

	{#if buffering && activeSrc}
		<div class="yt-spinner" aria-hidden="true"></div>
	{/if}

	{#if mediaError && activeSrc}
		<div class="yt-player-empty" style="background:transparent">
			<p>{mediaError}</p>
		</div>
	{/if}

	{#if flash}
		<div class="yt-seek-flash" class:left={flash.side === 'left'} class:right={flash.side === 'right'}>
			<span class="yt-seek-icon">{flash.side === 'left' ? '↺' : '↻'}</span>
			<span>{flash.text}s</span>
		</div>
	{/if}

	<div class="yt-chrome" class:visible={showChrome || !playing || locked || !activeSrc}>
		<div class="yt-chrome-top">
			<span class="yt-chrome-title">{title}</span>
			<button
				type="button"
				class="yt-icon-btn"
				onclick={(e) => {
					e.stopPropagation();
					locked = !locked;
				}}
			>
				{locked ? '🔓' : '🔒'}
			</button>
		</div>

		<div class="yt-chrome-center">
			{#if !locked && activeSrc}
				<button
					type="button"
					class="yt-round-btn"
					aria-label="-10s"
					onclick={(e) => {
						e.stopPropagation();
						seekBy(-10);
					}}>−10</button
				>
				<button
					type="button"
					class="yt-play-btn"
					aria-label={playing ? 'Pause' : 'Play'}
					onclick={(e) => {
						e.stopPropagation();
						togglePlay();
					}}
				>
					{#if playing}
						<span class="yt-pause"></span>
					{:else}
						<span class="yt-play"></span>
					{/if}
				</button>
				<button
					type="button"
					class="yt-round-btn"
					aria-label="+10s"
					onclick={(e) => {
						e.stopPropagation();
						seekBy(10);
					}}>+10</button
				>
			{/if}
		</div>

		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div class="yt-chrome-bottom" onclick={(e) => e.stopPropagation()}>
			<div class="yt-time-row">
				<span>{formatDuration(current)}</span>
				<span>{formatDuration(duration)}</span>
			</div>
			<div class="yt-scrub">
				<div class="yt-scrub-track">
					<div class="yt-scrub-fill" style:width="{progress}%"></div>
				</div>
				<input
					type="range"
					min="0"
					max={duration || 1}
					step="0.05"
					value={current}
					disabled={locked || !duration}
					oninput={onScrub}
					aria-label="Seek"
				/>
			</div>
			<div class="yt-tools">
				<select
					class="yt-select"
					bind:value={rate}
					onchange={() => {
						if (videoEl) videoEl.playbackRate = rate;
					}}
					disabled={locked}
				>
					<option value={0.75}>0.75×</option>
					<option value={1}>1×</option>
					<option value={1.25}>1.25×</option>
					<option value={1.5}>1.5×</option>
					<option value={2}>2×</option>
				</select>
				{#if qualities.length > 1}
					<select
						class="yt-select"
						onchange={(e) => setQuality(e.currentTarget.value)}
						disabled={locked}
					>
						{#each qualities as q}
							<option value={q.url} selected={q.url === activeSrc}>{q.label}</option>
						{/each}
					</select>
				{/if}
				<button type="button" class="yt-text-btn" onclick={pip}>{t(lang, 'pip')}</button>
				<button type="button" class="yt-text-btn" onclick={() => void toggleFullscreen()}>⛶</button>
			</div>
		</div>
	</div>
</div>
