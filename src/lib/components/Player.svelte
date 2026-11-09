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

	function looksLikeHls(url: string) {
		return /m3u8|hls_variant|\/hls[/_]/i.test(url);
	}

	$effect(() => {
		activeSrc = src;
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

		async function attach() {
			if (!el || !url || cancelled || gen !== attachGen) return;
			buffering = true;
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
								if (data.fatal) buffering = false;
							});
							instance.loadSource(url);
							instance.attachMedia(el);
						} else {
							el.src = url;
						}
					}
				} else {
					el.src = url;
				}
				if (cancelled || gen !== attachGen) return;
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
		if (videoEl.paused) videoEl.play().catch(() => {});
		else videoEl.pause();
		bumpChrome();
	}

	function seekBy(delta: number) {
		if (!videoEl || !Number.isFinite(duration)) return;
		videoEl.currentTime = Math.max(0, Math.min(duration, videoEl.currentTime + delta));
		flash = { side: delta < 0 ? 'left' : 'right', text: `${delta > 0 ? '+' : ''}${delta}` };
		setTimeout(() => (flash = null), 550);
		bumpChrome();
	}

	function onPointerUp(e: PointerEvent) {
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
		activeSrc = url;
	}

	const progress = $derived(duration > 0 ? (current / duration) * 100 : 0);
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="yt-player" class:is-playing={playing} onpointerup={onPointerUp}>
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
				<button
					type="button"
					class="yt-text-btn"
					onclick={() => videoEl?.requestFullscreen?.()}>⛶</button
				>
			</div>
		</div>
	</div>
</div>
