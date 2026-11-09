/** Resolve a browser-playable progressive URL.
 *
 * Invidious HLS/`local=true` manifests still point at googlevideo.com with the
 * instance IP → 403 / CORS in the browser. Piped muxed streams via the Piped
 * proxy are signed for the proxy and play cross-origin with CORS *.
 */

export const STREAM_PIPED = [
	'https://api.piped.private.coffee',
	'https://pipedapi.ducks.party',
	'https://pipedapi.adminforge.de',
	'https://pipedapi.nosebs.ru',
	'https://pipedapi.reallyaweso.me'
];

export const STREAM_INVIDIOUS = [
	'https://yt.chocolatemoo53.com',
	'https://invidious.materialio.us',
	'https://yewtu.be',
	'https://inv.nadeko.net',
	'https://invidious.nerdvpn.de'
];

export type ResolvedStream = {
	streamUrl: string | null;
	hls: boolean;
	qualities: { label: string; url: string }[];
	source?: string;
	meta?: {
		title?: string;
		author?: string;
		authorId?: string;
		description?: string;
		descriptionHtml?: string;
		viewCount?: number;
		publishedText?: string;
		lengthSeconds?: number;
		videoThumbnails?: { url: string; width: number; height: number }[];
		authorThumbnails?: { url: string; width: number; height: number }[];
		subCountText?: string;
		recommendedVideos?: unknown[];
		videoId?: string;
	};
};

function isHls(url: string) {
	return /m3u8|hls_variant|\/hls[/_]|\.m3u8/i.test(url);
}

/** LBRY CDN often 401s without their player tokens — skip for <video>. */
function isUnreliableHost(url: string) {
	try {
		const host = new URL(url).hostname;
		return /(^|\.)odycdn\.com$/i.test(host) || /(^|\.)lbry\.tv$/i.test(host);
	} catch {
		return true;
	}
}

function qualityScore(label: string) {
	const n = parseInt(label, 10);
	return Number.isFinite(n) ? n : 0;
}

function pickPipedMuxed(data: Record<string, unknown>): {
	streamUrl: string | null;
	qualities: { label: string; url: string }[];
} {
	const streams = ((data.videoStreams as Record<string, unknown>[]) ?? []).filter((s) => {
		if (s.videoOnly) return false;
		const url = String(s.url ?? '');
		if (!url || isUnreliableHost(url)) return false;
		const format = String(s.format ?? s.mimeType ?? '').toLowerCase();
		if (format.includes('hls') || isHls(url)) return false;
		return true;
	});

	const qualities = streams
		.map((s) => ({
			label: String(s.quality ?? s.qualityLabel ?? 'auto'),
			url: String(s.url)
		}))
		.sort((a, b) => qualityScore(b.label) - qualityScore(a.label));

	return {
		streamUrl: qualities[0]?.url ?? null,
		qualities
	};
}

function pickInvidiousProgressive(data: Record<string, unknown>): {
	streamUrl: string | null;
	qualities: { label: string; url: string }[];
} {
	const formatStreams =
		(data.formatStreams as {
			url?: string;
			qualityLabel?: string;
			resolution?: string;
			container?: string;
			type?: string;
		}[]) ?? [];
	const progressive = formatStreams.filter((s) => {
		if (!s.url || isUnreliableHost(s.url)) return false;
		if (s.container === 'hls') return false;
		if (String(s.type || '').toLowerCase().includes('mpegurl')) return false;
		if (isHls(s.url)) return false;
		return true;
	});
	const qualities = progressive
		.map((s) => ({
			label: s.qualityLabel || s.resolution || 'auto',
			url: String(s.url)
		}))
		.sort((a, b) => qualityScore(b.label) - qualityScore(a.label));
	if (!qualities.length) return { streamUrl: null, qualities: [] };
	const mp4 = qualities.filter((q) => /\.mp4|mime=video%2Fmp4|\/mp4/i.test(q.url) || true);
	return { streamUrl: mp4[0]?.url ?? qualities[0].url, qualities };
}

function metaFromInvidious(videoId: string, data: Record<string, unknown>): ResolvedStream['meta'] {
	return {
		videoId,
		title: String(data.title ?? ''),
		author: String(data.author ?? ''),
		authorId: String(data.authorId ?? ''),
		description: String(data.description ?? ''),
		descriptionHtml: data.descriptionHtml ? String(data.descriptionHtml) : undefined,
		viewCount: Number(data.viewCount ?? 0),
		publishedText: String(data.publishedText ?? ''),
		lengthSeconds: Number(data.lengthSeconds ?? 0),
		videoThumbnails: data.videoThumbnails as ResolvedStream['meta'] extends infer M
			? M extends { videoThumbnails?: infer T }
				? T
				: never
			: never,
		authorThumbnails: data.authorThumbnails as never,
		subCountText: data.subCountText ? String(data.subCountText) : undefined,
		recommendedVideos: (data.recommendedVideos as unknown[]) ?? []
	};
}

function metaFromPiped(videoId: string, data: Record<string, unknown>): ResolvedStream['meta'] {
	const thumb = String(data.thumbnailUrl ?? data.thumbnail ?? '');
	return {
		videoId,
		title: String(data.title ?? ''),
		author: String(data.uploader ?? data.uploaderName ?? ''),
		authorId: String(data.uploaderUrl ?? '').replace('/channel/', ''),
		description: String(data.description ?? ''),
		viewCount: Number(data.views ?? 0),
		publishedText: String(data.uploadDate ?? data.uploadedDate ?? ''),
		lengthSeconds: Number(data.duration ?? 0),
		videoThumbnails: thumb ? [{ url: thumb, width: 720, height: 404 }] : [],
		authorThumbnails: data.uploaderAvatar
			? [{ url: String(data.uploaderAvatar), width: 88, height: 88 }]
			: [],
		subCountText: data.uploaderSubscriberCount
			? String(data.uploaderSubscriberCount)
			: undefined,
		recommendedVideos: (data.relatedStreams as unknown[]) ?? []
	};
}

async function fetchJson(url: string): Promise<Record<string, unknown>> {
	const res = await fetch(url, { headers: { Accept: 'application/json' } });
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const data = (await res.json()) as Record<string, unknown> | string;
	if (typeof data === 'string') throw new Error(data);
	if (data.error) throw new Error(String(data.error));
	return data;
}

export async function resolveStreamClient(videoId: string): Promise<ResolvedStream> {
	const errors: string[] = [];

	for (const instance of STREAM_PIPED) {
		try {
			const data = await fetchJson(`${instance}/streams/${encodeURIComponent(videoId)}`);
			const picked = pickPipedMuxed(data);
			if (!picked.streamUrl) {
				errors.push(`${instance}: no muxed progressive`);
				continue;
			}
			return {
				...picked,
				hls: false,
				source: `piped:${instance}`,
				meta: metaFromPiped(videoId, data)
			};
		} catch (e) {
			errors.push(`${instance}: ${e instanceof Error ? e.message : String(e)}`);
		}
	}

	for (const instance of STREAM_INVIDIOUS) {
		try {
			const data = await fetchJson(
				`${instance}/api/v1/videos/${encodeURIComponent(videoId)}?local=true`
			);
			const picked = pickInvidiousProgressive(data);
			if (!picked.streamUrl) {
				errors.push(`${instance}: no progressive (HLS-only skipped — googlevideo 403)`);
				continue;
			}
			return {
				...picked,
				hls: isHls(picked.streamUrl),
				source: `invidious:${instance}`,
				meta: metaFromInvidious(videoId, data)
			};
		} catch (e) {
			errors.push(`${instance}: ${e instanceof Error ? e.message : String(e)}`);
		}
	}

	throw new Error(`No playable stream:\n${errors.join('\n')}`);
}
