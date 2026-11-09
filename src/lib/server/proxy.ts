import { INVIDIOUS, PIPED } from './instances';
import { filterOutShorts } from './shorts';

type FetchOpts = { signal?: AbortSignal; timeoutMs?: number };

async function fetchJson<T>(url: string, opts: FetchOpts = {}): Promise<T> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 12000);
	const onAbort = () => controller.abort();
	opts.signal?.addEventListener('abort', onAbort);
	try {
		const res = await fetch(url, {
			signal: controller.signal,
			headers: { Accept: 'application/json' }
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		return (await res.json()) as T;
	} finally {
		clearTimeout(timer);
		opts.signal?.removeEventListener('abort', onAbort);
	}
}

async function withInstances<T>(
	instances: string[],
	path: string,
	opts?: FetchOpts
): Promise<{ data: T; instance: string }> {
	const errors: string[] = [];
	for (const instance of instances) {
		try {
			const data = await fetchJson<T>(`${instance}${path}`, opts);
			return { data, instance };
		} catch (e) {
			errors.push(`${instance}: ${e instanceof Error ? e.message : String(e)}`);
		}
	}
	throw new Error(`All instances failed:\n${errors.join('\n')}`);
}

export type VideoItem = {
	type?: string;
	videoId?: string;
	title: string;
	videoThumbnails?: { url: string; width: number; height: number }[];
	lengthSeconds?: number;
	viewCount?: number;
	viewCountText?: string;
	author?: string;
	authorId?: string;
	publishedText?: string;
	description?: string;
	liveNow?: boolean;
};

export type VideoDetail = VideoItem & {
	videoId: string;
	description: string;
	descriptionHtml?: string;
	publishedText: string;
	viewCount: number;
	author: string;
	authorId: string;
	authorUrl?: string;
	authorThumbnails?: { url: string; width: number; height: number }[];
	subCountText?: string;
	lengthSeconds: number;
	formatStreams?: {
		url: string;
		qualityLabel?: string;
		resolution?: string;
		container?: string;
		type?: string;
	}[];
	adaptiveFormats?: {
		url: string;
		qualityLabel?: string;
		type?: string;
		audioQuality?: string;
	}[];
	recommendedVideos?: VideoItem[];
	hlsUrl?: string;
};

export type ChannelDetail = {
	author: string;
	authorId: string;
	authorUrl?: string;
	description?: string;
	subCount?: number;
	authorThumbnails?: { url: string; width: number; height: number }[];
	authorBanners?: { url: string; width: number; height: number }[];
	latestVideos?: VideoItem[];
};

function onlyVideos(items: VideoItem[]): VideoItem[] {
	return filterOutShorts(
		items.filter((i) => (i.type === 'video' || !i.type || i.type === 'short') && i.videoId)
	);
}

function mapPiped(v: Record<string, unknown>): VideoItem {
	const url = String(v.url ?? '');
	const id = url.includes('v=') ? url.split('v=')[1]?.split('&')[0] : String(v.id ?? '');
	return {
		type: 'video',
		videoId: id,
		title: String(v.title ?? ''),
		lengthSeconds: Number(v.duration ?? 0),
		viewCount: Number(v.views ?? 0),
		author: String(v.uploaderName ?? v.uploader ?? ''),
		authorId: String(v.uploaderUrl ?? '').replace('/channel/', ''),
		publishedText: v.uploadedDate ? String(v.uploadedDate) : undefined,
		videoThumbnails: v.thumbnail
			? [{ url: String(v.thumbnail), width: 320, height: 180 }]
			: []
	};
}

function absolutizeThumbs(
	thumbs: { url: string; width: number; height: number }[] | undefined,
	instance: string
) {
	return (thumbs ?? []).map((t) => ({
		...t,
		url: t.url.startsWith('http') ? t.url : `${instance}${t.url}`
	}));
}

export async function getTrending(region = 'NL', opts?: FetchOpts): Promise<VideoItem[]> {
	try {
		const { data } = await withInstances<VideoItem[]>(
			INVIDIOUS,
			`/api/v1/trending?region=${encodeURIComponent(region)}`,
			opts
		);
		return onlyVideos(data);
	} catch {
		const { data } = await withInstances<Record<string, unknown>[]>(
			PIPED,
			`/trending?region=${encodeURIComponent(region)}`,
			opts
		);
		return filterOutShorts(data.map(mapPiped));
	}
}

export async function getPopular(opts?: FetchOpts): Promise<VideoItem[]> {
	try {
		const { data } = await withInstances<VideoItem[]>(INVIDIOUS, `/api/v1/popular`, opts);
		const videos = onlyVideos(data);
		if (videos.length) return videos;
	} catch {
		/* fall through */
	}
	return getTrending('NL', opts);
}

export async function searchAll(q: string, opts?: FetchOpts) {
	const query = q.trim();
	if (!query) return { videos: [] as VideoItem[], channels: [] as ChannelDetail[] };

	try {
		const { data, instance } = await withInstances<Record<string, unknown>[]>(
			INVIDIOUS,
			`/api/v1/search?q=${encodeURIComponent(query)}`,
			opts
		);
		const videos = onlyVideos(
			data
				.filter((i) => i.type === 'video')
				.map((i) => ({
					...(i as unknown as VideoItem),
					videoThumbnails: absolutizeThumbs(
						(i as VideoItem).videoThumbnails,
						instance
					)
				}))
		);
		const channels = data
			.filter((i) => i.type === 'channel')
			.map((i) => ({
				author: String(i.author ?? ''),
				authorId: String(i.authorId ?? ''),
				description: String(i.description ?? ''),
				subCount: Number(i.subCount ?? 0),
				authorThumbnails: absolutizeThumbs(
					i.authorThumbnails as ChannelDetail['authorThumbnails'],
					instance
				)
			}));
		return { videos, channels };
	} catch {
		const { data } = await withInstances<{ items?: Record<string, unknown>[] }>(
			PIPED,
			`/search?q=${encodeURIComponent(query)}&filter=all`,
			opts
		);
		const items = data.items ?? (data as unknown as Record<string, unknown>[]);
		return {
			videos: filterOutShorts(
				items.filter((i) => i.type === 'stream' || i.type === 'video').map(mapPiped)
			),
			channels: []
		};
	}
}

function mapPipedDetail(id: string, d: Record<string, unknown>): VideoDetail {
	const videoStreams = (d.videoStreams as Record<string, unknown>[]) ?? [];
	const progressive = videoStreams.filter((s) => !s.videoOnly && s.url);
	const formatStreams = progressive.map((s) => ({
		url: String(s.url),
		qualityLabel: String(s.quality ?? s.qualityLabel ?? ''),
		resolution: String(s.quality ?? ''),
		container: String(s.format ?? 'mp4').toLowerCase().includes('hls') ? 'hls' : 'mp4',
		type: String(s.mimeType ?? 'video/mp4')
	}));
	const related = ((d.relatedStreams as Record<string, unknown>[]) ?? []).map(mapPiped);
	const thumb = String(d.thumbnailUrl ?? d.thumbnail ?? '');
	return {
		type: 'video',
		videoId: id,
		title: String(d.title ?? ''),
		description: String(d.description ?? ''),
		publishedText: String(d.uploadDate ?? d.uploadedDate ?? ''),
		viewCount: Number(d.views ?? 0),
		author: String(d.uploader ?? d.uploaderName ?? ''),
		authorId: String(d.uploaderUrl ?? '').replace('/channel/', ''),
		lengthSeconds: Number(d.duration ?? 0),
		videoThumbnails: thumb ? [{ url: thumb, width: 720, height: 404 }] : [],
		authorThumbnails: d.uploaderAvatar
			? [{ url: String(d.uploaderAvatar), width: 88, height: 88 }]
			: [],
		subCountText: d.uploaderSubscriberCount
			? String(d.uploaderSubscriberCount)
			: undefined,
		formatStreams,
		recommendedVideos: onlyVideos(related),
		hlsUrl: typeof d.hls === 'string' ? d.hls : undefined
	};
}

export async function getVideo(id: string, opts?: FetchOpts): Promise<VideoDetail> {
	try {
		const { data, instance } = await withInstances<VideoDetail>(
			INVIDIOUS,
			`/api/v1/videos/${encodeURIComponent(id)}`,
			opts
		);
		data.videoThumbnails = absolutizeThumbs(data.videoThumbnails, instance);
		data.authorThumbnails = absolutizeThumbs(data.authorThumbnails, instance);
		if (data.recommendedVideos) data.recommendedVideos = onlyVideos(data.recommendedVideos);
		return data;
	} catch {
		const { data } = await withInstances<Record<string, unknown>>(
			PIPED,
			`/streams/${encodeURIComponent(id)}`,
			opts
		);
		if ((data as { error?: string }).error) {
			throw new Error(String((data as { error?: string }).error));
		}
		return mapPipedDetail(id, data);
	}
}

export async function getChannel(id: string, opts?: FetchOpts): Promise<ChannelDetail> {
	const { data, instance } = await withInstances<ChannelDetail>(
		INVIDIOUS,
		`/api/v1/channels/${encodeURIComponent(id)}`,
		opts
	);
	data.authorThumbnails = absolutizeThumbs(data.authorThumbnails, instance);
	data.authorBanners = absolutizeThumbs(data.authorBanners, instance);
	if (data.latestVideos) data.latestVideos = onlyVideos(data.latestVideos);
	return data;
}

export async function getChannelVideos(id: string, opts?: FetchOpts): Promise<VideoItem[]> {
	try {
		const { data } = await withInstances<VideoItem[] | { videos: VideoItem[] }>(
			INVIDIOUS,
			`/api/v1/channels/${encodeURIComponent(id)}/videos`,
			opts
		);
		const list = Array.isArray(data) ? data : (data.videos ?? []);
		return onlyVideos(list);
	} catch {
		const ch = await getChannel(id, opts);
		return ch.latestVideos ?? [];
	}
}

export function pickProgressiveStream(video: VideoDetail): string | null {
	const streams = (video.formatStreams ?? []).filter(
		(s) => s.container !== 'hls' && !String(s.type).toLowerCase().includes('mpegurl')
	);
	if (streams.length) {
		const mp4 = streams.filter((s) => s.container === 'mp4' || s.type?.includes('mp4'));
		const pool = mp4.length ? mp4 : streams;
		const sorted = [...pool].sort((a, b) => {
			const qa = parseInt(a.qualityLabel || a.resolution || '0', 10) || 0;
			const qb = parseInt(b.qualityLabel || b.resolution || '0', 10) || 0;
			return qb - qa;
		});
		return sorted[0]?.url ?? null;
	}
	// Many public instances no longer expose muxed progressive URLs — HLS still works.
	if (video.hlsUrl) return video.hlsUrl;
	return video.formatStreams?.[0]?.url ?? null;
}

export function isHlsUrl(url: string | null | undefined): boolean {
	if (!url) return false;
	return /m3u8|hls_variant|\/hls[/_]/i.test(url);
}

export function bestThumb(
	thumbs?: { url: string; width: number; height: number }[],
	min = 320
): string {
	if (!thumbs?.length) return '';
	const sorted = [...thumbs].sort((a, b) => a.width - b.width);
	return (sorted.find((t) => t.width >= min) ?? sorted[sorted.length - 1]).url;
}
