<script lang="ts">
	import { t, type Lang } from '#lib/i18n';
	import { formatDuration } from '#lib/format';

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
	let current = $state(0);
	let duration = $state(0);
	let rate = $state(1);
	let activeSrc = $state<string | null>(null);
	let flash = $state<{ side: 'left' | 'right'; text: string } | null>(null);
	let hideTimer: ReturnType<typeof setTimeout> | undefined;
	let lastTap = 0;
	let lastTapX = 0;

	$effect(() => {
		activeSrc = src;
	});

	function bumpChrome() {
		if (locked) return;
		showChrome = true;
		clearTimeout(hideTimer);
		hideTimer = setTimeout(() => {
			if (playing) showChrome = false;
		}, 2800);
	}

	function togglePlay() {
		if (!videoEl || locked) return;
		if (videoEl.paused) videoEl.play();
		else videoEl.pause();
		bumpChrome();
	}

	function seekBy(delta: number) {
		if (!videoEl) return;
		videoEl.currentTime = Math.max(0, Math.min(duration, videoEl.currentTime + delta));
		flash = { side: delta < 0 ? 'left' : 'right', text: `${delta > 0 ? '+' : ''}${delta}s` };
		setTimeout(() => (flash = null), 650);
	}

	function onPointerUp(e: PointerEvent) {
		if (locked) {
			showChrome = true;
			return;
		}
		const now = Date.now();
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const x = e.clientX - rect.left;
		if (now - lastTap < 280 && Math.abs(x - lastTapX) < 80) {
			if (x < rect.width / 2) seekBy(-10);
			else seekBy(10);
			lastTap = 0;
			return;
		}
		lastTap = now;
		lastTapX = x;
		setTimeout(() => {
			if (Date.now() - lastTap >= 280) togglePlay();
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
		if (!videoEl) return;
		const t0 = videoEl.currentTime;
		const was = !videoEl.paused;
		activeSrc = url;
		requestAnimationFrame(() => {
			if (!videoEl) return;
			videoEl.currentTime = t0;
			if (was) videoEl.play().catch(() => {});
		});
	}

	$effect(() => {
		if (videoEl && activeSrc) {
			videoEl.load();
			videoEl.play().catch(() => {});
		}
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="player-stage" onpointerup={onPointerUp}>
	{#if activeSrc}
		<video
			bind:this={videoEl}
			src={activeSrc}
			{poster}
			playsinline
			preload="metadata"
			{title}
			onplay={() => {
				playing = true;
				bumpChrome();
			}}
			onpause={() => {
				playing = false;
				showChrome = true;
			}}
			ontimeupdate={() => {
				if (videoEl) current = videoEl.currentTime;
			}}
			onloadedmetadata={() => {
				if (videoEl) duration = videoEl.duration || 0;
			}}
		></video>
	{:else}
		<div class="absolute inset-0 grid place-items-center p-6 text-center text-white/80">
			{t(lang, 'noStream')}
		</div>
	{/if}

	{#if flash}
		<div
			class="seek-flash"
			style:left={flash.side === 'left' ? '12%' : 'auto'}
			style:right={flash.side === 'right' ? '12%' : 'auto'}
		>
			{flash.text}
		</div>
	{/if}

	<div class="player-chrome" class:visible={showChrome || !playing || locked}>
		<div class="flex items-center justify-between p-3 text-white">
			<span class="line-clamp-1 text-sm font-semibold drop-shadow">{title}</span>
			<button
				class="btn btn-xs btn-ghost text-white"
				onclick={(e) => {
					e.stopPropagation();
					locked = !locked;
				}}>{locked ? t(lang, 'unlock') : t(lang, 'lock')}</button
			>
		</div>

		<div class="flex flex-1 items-center justify-center gap-10 text-white">
			{#if !locked}
				<button
					class="btn btn-circle btn-ghost text-2xl text-white"
					onclick={(e) => {
						e.stopPropagation();
						seekBy(-10);
					}}>×</button
				>
				<button
					class="btn btn-circle btn-lg bg-white/20 text-white backdrop-blur"
					onclick={(e) => {
						e.stopPropagation();
						togglePlay();
					}}>{playing ? '❚❚' : '▶'}</button
				>
				<button
					class="btn btn-circle btn-ghost text-2xl text-white"
					onclick={(e) => {
						e.stopPropagation();
						seekBy(10);
					}}>»</button
				>
			{/if}
		</div>

		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="space-y-2 p-3 text-white" onclick={(e) => e.stopPropagation()}>
			<input
				type="range"
				min="0"
				max={duration || 1}
				step="0.1"
				value={current}
				class="range range-xs range-primary w-full"
				disabled={locked}
				oninput={onScrub}
			/>
			<div class="flex flex-wrap items-center gap-2 text-xs">
				<span>{formatDuration(current)} / {formatDuration(duration)}</span>
				<div class="ml-auto flex flex-wrap gap-1">
					<select
						class="select select-ghost select-xs text-white"
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
					{#if qualities.length}
						<select
							class="select select-ghost select-xs max-w-28 text-white"
							onchange={(e) => setQuality(e.currentTarget.value)}
							disabled={locked}
						>
							{#each qualities as q}
								<option value={q.url}>{q.label}</option>
							{/each}
						</select>
					{/if}
					<button class="btn btn-xs btn-ghost" onclick={pip}>{t(lang, 'pip')}</button>
					<button class="btn btn-xs btn-ghost" onclick={() => videoEl?.requestFullscreen?.()}
						>⛶</button
					>
				</div>
			</div>
		</div>
	</div>
</div>
