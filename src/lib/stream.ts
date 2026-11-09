/** Browser fallback for progressive URLs.
 *
 * Prefer same-origin `/api/stream` (server races Piped/Invidious without CORS).
 * This client path only hits Piped hosts known to send ACAO: * — public Invidious
 * instances are CORS-hostile and must not be called from the browser.
 *
 * Invidious HLS/`local=true` manifests still point at googlevideo.com with the
 * instance IP → 403 / CORS. Piped muxed streams via the Piped proxy are signed
 * for the proxy and play cross-origin with CORS *.
 */

import { PIPED_CORS_FRIENDLY } from '#lib/instances';
import {
	StreamResolveError,
	classifyUpstreamMessage,
	toStreamResolveError
} from '#lib/stream-errors';

/** Re-export for callers that still import from stream.ts */
export const STREAM_PIPED = PIPED_CORS_FRIENDLY;

export type ResolvedStream = {
	streamUrl: string | null;
	hls: boolean;
	qualities: { label: string; url: string }[];
	source?: string;
	code?: string;
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
	const text = await res.text();
	let data: Record<string, unknown> | string | null = null;
	try {
		data = text ? (JSON.parse(text) as Record<string, unknown> | string) : null;
	} catch {
		data = null;
	}
	if (!res.ok) {
		const detail =
			data && typeof data === 'object' && data.error
				? String(data.error)
				: `HTTP ${res.status}`;
		throw new StreamResolveError(classifyUpstreamMessage(detail), detail, detail);
	}
	if (typeof data === 'string') {
		throw new StreamResolveError(classifyUpstreamMessage(data), data, data);
	}
	if (!data || typeof data !== 'object') {
		throw new StreamResolveError('no_stream', 'empty response');
	}
	if (data.error) {
		const detail = String(data.error);
		throw new StreamResolveError(classifyUpstreamMessage(detail), detail, detail);
	}
	return data;
}

/** Race CORS-friendly Piped mirrors only (browser-safe). */
export async function resolveStreamClient(videoId: string): Promise<ResolvedStream> {
	const errors: string[] = [];

	const tasks = STREAM_PIPED.map(async (instance) => {
		const data = await fetchJson(`${instance}/streams/${encodeURIComponent(videoId)}`);
		const picked = pickPipedMuxed(data);
		if (!picked.streamUrl) {
			throw new Error(`${instance}: no muxed progressive`);
		}
		return {
			...picked,
			hls: false,
			source: `piped-client:${instance}`,
			meta: metaFromPiped(videoId, data)
		} satisfies ResolvedStream;
	});

	try {
		return await Promise.any(tasks);
	} catch (e) {
		const wrapped = toStreamResolveError(e, errors.join('\n'));
		throw new StreamResolveError(
			wrapped.code,
			wrapped.message,
			wrapped.details || `No playable stream from CORS-friendly Piped mirrors`
		);
	}
}
