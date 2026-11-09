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
	import { t, type MsgKey } from '#lib/i18n';
	import { sanitizeDescriptionHtml } from '#lib/sanitize';
	import { resolveStreamClient } from '#lib/stream';
	import { toStreamResolveError, type StreamErrorCode } from '#lib/stream-errors';

	let video = $state<any>(null);
	let streamUrl = $state<string | null>(null);
	let qualities = $state<{ label: string; url: string }[]>([]);
	let comments = $state<any[]>([]);
	let loading = $state(true);
	let streamLoading = $state(false);
	let errorMsg = $state('');
	let streamCode = $state<StreamErrorCode | ''>('');
	let retryToken = $state(0);
	const lang = $derived(getLibrary().lang);
	const id = $derived(page.params.id);

	function friendlyStreamMessage(code: StreamErrorCode | ''): string {
		const key: MsgKey =
			code === 'unavailable'
				? 'streamUnavailable'
				: code === 'bot_block'
					? 'streamBotBlock'
					: 'streamTemporary';
		return t(lang, key);
	}

	function stubVideo(videoId: string) {
		return {
			videoId,
			title: '',
			author: '',
			authorId: '',
			description: '',
			viewCount: 0,
			publishedText: '',
			lengthSeconds: 0,
			videoThumbnails: [
				{ url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`, width: 480, height: 360 },
				{ url: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`, width: 320, height: 180 }
			],
			authorThumbnails: [],
			recommendedVideos: []
		};
	}

	/** Same-origin first (retries), then CORS-friendly Piped client fallback. */
	async function resolveStream(videoId: string) {
		const attempts = 2;
		let lastApi: { code?: string; message?: string; details?: string } | null = null;

		for (let i = 0; i < attempts; i++) {
			try {
				const r = await fetch(`/api/stream/${videoId}`);
				const data = await r.json().catch(() => ({}));
				if (r.ok && data.streamUrl) {
					return {
						streamUrl: data.streamUrl as string,
						qualities: (data.qualities as { label: string; url: string }[]) ?? [],
						meta: undefined as undefined,
						code: undefined as StreamErrorCode | undefined
					};
				}
				lastApi = {
					code: data.code,
					message: data.message,
					details: data.details
				};
				if (data.code === 'unavailable') {
					throw Object.assign(new Error(data.message || 'unavailable'), {
						code: 'unavailable',
						details: data.details
					});
				}
			} catch (e) {
				if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'unavailable') {
					throw e;
				}
				lastApi = {
					message: e instanceof Error ? e.message : String(e)
				};
			}
		}

		// Browser fallback only hits CORS-friendly Piped — never CORS-blocked Invidious.
		try {
			const client = await resolveStreamClient(videoId);
			if (!client.streamUrl) throw new Error('client empty');
			return {
				streamUrl: client.streamUrl,
				qualities: client.qualities,
				meta: client.meta,
				code: undefined as StreamErrorCode | undefined
			};
		} catch (e) {
			const wrapped = toStreamResolveError(
				e,
				lastApi?.details || lastApi?.message || ''
			);
			if (lastApi?.code === 'unavailable') wrapped.code = 'unavailable';
			else if (lastApi?.code === 'bot_block' && wrapped.code === 'no_stream') {
				wrapped.code = 'bot_block';
			}
			throw wrapped;
		}
	}

	$effect(() => {
		const videoId = id;
		const _retry = retryToken;
		if (!videoId) return;
		void _retry;
		let cancelled = false;
		loading = true;
		streamLoading = true;
		errorMsg = '';
		streamCode = '';
		video = null;
		streamUrl = null;
		qualities = [];

		(async () => {
			const metaP = fetch(`/api/videos/${videoId}`)
				.then(async (r) => (r.ok ? r.json() : null))
				.catch(() => null);
			const commentsP = fetch(`/api/comments/${videoId}`)
				.then((r) => r.json())
				.catch(() => ({ comments: [] }));
			const streamP = resolveStream(videoId);

			const metaRes = await metaP;
			if (cancelled) return;

			const base = metaRes?.video ?? stubVideo(videoId);
			video = {
				...base,
				videoId: base.videoId || videoId,
				title: base.title || '',
				author: base.author || '',
				authorId: base.authorId || '',
				videoThumbnails: base.videoThumbnails?.length
					? base.videoThumbnails
					: stubVideo(videoId).videoThumbnails
			};
			comments = (await commentsP).comments ?? [];
			loading = false;

			if (metaRes?.streamUrl && !cancelled) {
				streamUrl = metaRes.streamUrl;
				qualities = metaRes.qualities ?? [];
				streamLoading = false;
				if (video.title) {
					addHistory({
						videoId: video.videoId,
						title: video.title,
						author: video.author,
						authorId: video.authorId,
						lengthSeconds: video.lengthSeconds,
						videoThumbnails: video.videoThumbnails,
						viewCount: video.viewCount
					});
				}
				return;
			}

			try {
				const stream = await streamP;
				if (cancelled) return;
				if (stream.meta) {
					video = {
						...video,
						title: video.title || stream.meta.title || '',
						author: video.author || stream.meta.author || '',
						authorId: video.authorId || stream.meta.authorId || '',
						description: video.description || stream.meta.description,
						descriptionHtml: video.descriptionHtml || stream.meta.descriptionHtml,
						viewCount: video.viewCount || stream.meta.viewCount,
						publishedText: video.publishedText || stream.meta.publishedText,
						lengthSeconds: video.lengthSeconds || stream.meta.lengthSeconds,
						videoThumbnails:
							video.videoThumbnails?.length
								? video.videoThumbnails
								: stream.meta.videoThumbnails,
						authorThumbnails:
							video.authorThumbnails?.length
								? video.authorThumbnails
								: stream.meta.authorThumbnails,
						subCountText: video.subCountText || stream.meta.subCountText,
						recommendedVideos:
							video.recommendedVideos?.length
								? video.recommendedVideos
								: stream.meta.recommendedVideos ?? []
					};
				}
				streamUrl = stream.streamUrl;
				qualities = stream.qualities ?? [];
				if (video.title) {
					addHistory({
						videoId: video.videoId,
						title: video.title,
						author: video.author,
						authorId: video.authorId,
						lengthSeconds: video.lengthSeconds,
						videoThumbnails: video.videoThumbnails,
						viewCount: video.viewCount
					});
				}
			} catch (e) {
				if (cancelled) return;
				const wrapped = toStreamResolveError(e);
				streamCode = wrapped.code;
				errorMsg = friendlyStreamMessage(wrapped.code);
				if (metaRes?.unavailable) {
					streamCode = 'unavailable';
					errorMsg = friendlyStreamMessage('unavailable');
				}
			} finally {
				if (!cancelled) streamLoading = false;
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
		<div class="alert alert-error text-sm">{errorMsg}</div>
		<button class="btn btn-sm btn-ghost mt-3" onclick={() => (retryToken += 1)}>
			{t(lang, 'streamRetry')}
		</button>
	</div>
{/if}

{#if video}
	<div class="mx-auto max-w-6xl lg:grid lg:grid-cols-[1fr_340px] lg:gap-6 lg:px-6 lg:pt-4">
		<div>
			<div class="overflow-hidden bg-black lg:rounded-2xl">
				{#if streamLoading && !streamUrl}
					<div class="skeleton aspect-video w-full"></div>
				{:else}
					<Player
						src={streamUrl}
						{qualities}
						poster={bestThumb(video.videoThumbnails, 720)}
						title={video.title}
						{lang}
					/>
				{/if}
			</div>
			{#if errorMsg && !streamUrl}
				<div class="px-4 pt-2 lg:px-0">
					<div class="alert alert-warning text-sm">
						<p>{errorMsg}</p>
						<button class="btn btn-sm btn-ghost mt-2" onclick={() => (retryToken += 1)}>
							{t(lang, 'streamRetry')}
						</button>
					</div>
				</div>
			{/if}
			<div class="px-4 pt-4 lg:px-0">
				<h1 class="font-display text-xl font-bold sm:text-2xl">
					{video.title || (streamCode === 'unavailable' ? t(lang, 'streamUnavailable') : '…')}
				</h1>
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
							<div class="truncate font-semibold">{video.author || '—'}</div>
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
						disabled={!video.authorId}
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
						disabled={!video.videoId}
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
