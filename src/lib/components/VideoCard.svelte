<script lang="ts">
	import { bestThumb, formatCount, formatDuration } from '#lib/format';
	import type { Lang } from '#lib/i18n';

	type Video = {
		videoId?: string;
		title: string;
		author?: string;
		lengthSeconds?: number;
		viewCount?: number;
		publishedText?: string;
		videoThumbnails?: { url: string; width: number; height: number }[];
	};

	let { video, lang = 'nl' as Lang, index = 0 }: { video: Video; lang?: Lang; index?: number } =
		$props();

	const thumb = $derived(bestThumb(video.videoThumbnails));
</script>

{#if video.videoId}
	<a
		href="/watch/{video.videoId}"
		class="group video-rise block"
		style="animation-delay: {Math.min(index, 8) * 40}ms"
	>
		<div class="thumb-frame relative">
			{#if thumb}
				<img src={thumb} alt="" loading="lazy" />
			{/if}
			{#if video.lengthSeconds}
				<span
					class="absolute right-2 bottom-2 rounded-md bg-black/80 px-1.5 py-0.5 text-xs font-semibold text-white"
					>{formatDuration(video.lengthSeconds)}</span
				>
			{/if}
		</div>
		<div class="pt-2.5">
			<h3 class="line-clamp-2 text-[0.98rem] font-semibold leading-snug tracking-tight">
				{video.title}
			</h3>
			<p class="mt-1 truncate text-sm opacity-60">
				{[video.author, formatCount(video.viewCount, lang), video.publishedText]
					.filter(Boolean)
					.join(' · ')}
			</p>
		</div>
	</a>
{/if}
