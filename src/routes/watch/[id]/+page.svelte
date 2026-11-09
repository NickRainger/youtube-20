<script lang="ts">
	import { page } from '$app/state';
	import Player from '#lib/components/Player.svelte';
	import { bestThumb, formatCount } from '#lib/format';
	import {
		addHistory,
		getLibrary,
		isSaved,
		isSubscribed,
		toggleSave,
		toggleSub
	} from '#lib/library.svelte';
	import { t } from '#lib/i18n';
	import { sanitizeDescriptionHtml } from '#lib/sanitize';
	import { resolveStreamClient } from '#lib/stream';

	let video = $state<any>(null);
	let streamUrl = $state<string | null>(null);
	let qualities = $state<{ label: string; url: string }[]>([]);
	let comments = $state<any[]>([]);
	let loading = $state(true);
	let errorMsg = $state('');
	const lang = $derived(getLibrary().lang);
	const id = $derived(page.params.id);

	async function resolveStream(videoId: string) {
		// Race same-origin (Piped via our API) with direct browser Piped/Invidious.
		// Piped proxy MP4s are not viewer-IP bound; Invidious HLS is skipped (googlevideo 403).
		const apiP = fetch(`/api/stream/${videoId}`)
			.then(async (r) => {
				if (!r.ok) throw new Error(`api ${r.status}`);
				const data = await r.json();
				if (!data.streamUrl) throw new Error('api empty');
				return {
					streamUrl: data.streamUrl as string,
					qualities: (data.qualities as { label: string; url: string }[]) ?? [],
					meta: undefined as undefined
				};
			});
		const clientP = resolveStreamClient(videoId).then((client) => ({
			streamUrl: client.streamUrl as string,
			qualities: client.qualities,
			meta: client.meta
		}));
		return Promise.any([apiP, clientP]);
	}

	$effect(() => {
		const videoId = id;
		if (!videoId) return;
		let cancelled = false;
		loading = true;
		errorMsg = '';
		video = null;
		streamUrl = null;
		qualities = [];

		(async () => {
			try {
				const [metaRes, stream, c] = await Promise.all([
					fetch(`/api/videos/${videoId}`)
						.then(async (r) => (r.ok ? r.json() : null))
						.catch(() => null),
					resolveStream(videoId),
					fetch(`/api/comments/${videoId}`)
						.then((r) => r.json())
						.catch(() => ({ comments: [] }))
				]);
				if (cancelled) return;

				const base = metaRes?.video ?? stream.meta ?? {};
				video = {
					...base,
					videoId: base.videoId || videoId,
					title: base.title || stream.meta?.title,
					author: base.author || stream.meta?.author,
					authorId: base.authorId || stream.meta?.authorId,
					description: base.description || stream.meta?.description,
					descriptionHtml: base.descriptionHtml || stream.meta?.descriptionHtml,
					viewCount: base.viewCount ?? stream.meta?.viewCount,
					publishedText: base.publishedText || stream.meta?.publishedText,
					lengthSeconds: base.lengthSeconds ?? stream.meta?.lengthSeconds,
					videoThumbnails: base.videoThumbnails || stream.meta?.videoThumbnails,
					authorThumbnails: base.authorThumbnails || stream.meta?.authorThumbnails,
					subCountText: base.subCountText || stream.meta?.subCountText,
					recommendedVideos:
						(base.recommendedVideos?.length
							? base.recommendedVideos
							: stream.meta?.recommendedVideos) ?? []
				};
				streamUrl = stream.streamUrl;
				qualities = stream.qualities ?? [];
				comments = c.comments ?? [];
				addHistory({
					videoId: video.videoId,
					title: video.title,
					author: video.author,
					authorId: video.authorId,
					lengthSeconds: video.lengthSeconds,
					videoThumbnails: video.videoThumbnails,
					viewCount: video.viewCount
				});
			} catch (e) {
				if (!cancelled) errorMsg = e instanceof Error ? e.message : t(lang, 'errorLoad');
			} finally {
				if (!cancelled) loading = false;
			}
		})();

		return () => {
			cancelled = true;
		};
	});
</script>

{#if loading}
	<div class="skeleton aspect-video w-full rounded-none lg:mx-auto lg:mt-4 lg:max-w-6xl lg:rounded-2xl"></div>
{/if}

{#if errorMsg && !video}
	<div class="mx-auto max-w-6xl p-4">
		<div class="alert alert-error whitespace-pre-wrap text-sm">{errorMsg}</div>
	</div>
{/if}

{#if video}
	<div class="mx-auto max-w-6xl lg:grid lg:grid-cols-[1fr_340px] lg:gap-6 lg:px-6 lg:pt-4">
		<div>
			<div class="overflow-hidden bg-black lg:rounded-2xl">
				<Player
					src={streamUrl}
					{qualities}
					poster={bestThumb(video.videoThumbnails, 720)}
					title={video.title}
					{lang}
				/>
			</div>
			{#if errorMsg && !streamUrl}
				<div class="px-4 pt-2 lg:px-0">
					<div class="alert alert-warning whitespace-pre-wrap text-sm">{errorMsg}</div>
				</div>
			{/if}
			<div class="px-4 pt-4 lg:px-0">
				<h1 class="font-display text-xl font-bold sm:text-2xl">{video.title}</h1>
				<p class="mt-1 text-sm opacity-55">
					{[formatCount(video.viewCount, lang), video.publishedText].filter(Boolean).join(' · ')}
				</p>
				<div class="mt-4 flex flex-wrap items-center gap-3 border-t border-base-300 pt-4">
					<a href="/channel/{video.authorId}" class="flex min-w-0 flex-1 items-center gap-3">
						<img
							src={bestThumb(video.authorThumbnails, 88) || undefined}
							alt=""
							class="h-11 w-11 rounded-full bg-base-300 object-cover"
						/>
						<div class="min-w-0">
							<div class="truncate font-semibold">{video.author}</div>
							<div class="text-sm opacity-55">{video.subCountText ?? ''}</div>
						</div>
					</a>
					<button
						class="btn btn-sm {isSubscribed(video.authorId) ? 'btn-ghost' : 'btn-primary'} rounded-full"
						onclick={() =>
							toggleSub({
								authorId: video.authorId,
								author: video.author,
								authorThumb: bestThumb(video.authorThumbnails, 88)
							})}
					>
						{isSubscribed(video.authorId) ? t(lang, 'subscribed') : t(lang, 'subscribe')}
					</button>
					<button
						class="btn btn-sm btn-ghost rounded-full"
						onclick={() =>
							toggleSave({
								videoId: video.videoId,
								title: video.title,
								author: video.author,
								authorId: video.authorId,
								lengthSeconds: video.lengthSeconds,
								videoThumbnails: video.videoThumbnails
							})}
					>
						{isSaved(video.videoId) ? t(lang, 'saved') : t(lang, 'save')}
					</button>
				</div>
				{#if video.descriptionHtml || video.description}
					<div
						class="desc-html mt-4 max-h-40 overflow-auto rounded-2xl bg-base-100/70 p-3 text-sm leading-relaxed opacity-80"
					>
						{@html sanitizeDescriptionHtml(video.descriptionHtml || video.description)}
					</div>
				{/if}

				<section class="mt-6">
					<h2 class="font-display mb-3 text-lg font-bold">{t(lang, 'comments')}</h2>
					{#if comments.length === 0}
						<p class="text-sm opacity-55">{t(lang, 'noComments')}</p>
					{:else}
						<div class="space-y-3">
							{#each comments as c}
								<div class="rounded-xl bg-base-100/60 p-3">
									<div class="text-sm font-semibold">{c.author}</div>
									<p class="mt-1 text-sm opacity-80">
										{@html sanitizeDescriptionHtml(c.content)}
									</p>
									<div class="mt-1 text-xs opacity-45">{c.publishedText}</div>
								</div>
							{/each}
						</div>
					{/if}
				</section>
			</div>
		</div>

		<aside class="px-4 py-6 lg:px-0 lg:py-0">
			<h2 class="font-display mb-3 text-lg font-bold">{t(lang, 'related')}</h2>
			<div class="space-y-3">
				{#each video.recommendedVideos ?? [] as rel}
					<a href="/watch/{rel.videoId}" class="grid grid-cols-[168px_1fr] gap-2.5">
						<div class="thumb-frame relative !rounded-xl">
							{#if bestThumb(rel.videoThumbnails, 168)}
								<img src={bestThumb(rel.videoThumbnails, 168)} alt="" loading="lazy" />
							{/if}
						</div>
						<div>
							<div class="line-clamp-2 text-sm font-semibold">{rel.title}</div>
							<div class="mt-1 text-xs opacity-55">{rel.author}</div>
						</div>
					</a>
				{/each}
			</div>
		</aside>
	</div>
{/if}
