/** Browser-side stream resolve — Invidious signs URLs for the request path;
 *  fetching from the phone/desktop (not the Vercel datacenter) is required. */

export const STREAM_INSTANCES = [
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
	return /m3u8|hls_variant|\/hls[/_]/i.test(url);
}

function pickStream(data: Record<string, unknown>): {
	streamUrl: string | null;
	qualities: { label: string; url: string }[];
} {
	const formatStreams = (data.formatStreams as { url?: string; qualityLabel?: string; resolution?: string; container?: string; type?: string }[]) ?? [];
	const progressive = formatStreams.filter(
		(s) => s.url && s.container !== 'hls' && !String(s.type || '').toLowerCase().includes('mpegurl')
	);
	const qualities = progressive.map((s) => ({
		label: s.qualityLabel || s.resolution || 'auto',
		url: String(s.url)
	}));
	if (progressive.length) {
		const mp4 = progressive.filter((s) => s.container === 'mp4' || s.type?.includes('mp4'));
		const pool = mp4.length ? mp4 : progressive;
		const sorted = [...pool].sort((a, b) => {
			const qa = parseInt(a.qualityLabel || a.resolution || '0', 10) || 0;
			const qb = parseInt(b.qualityLabel || b.resolution || '0', 10) || 0;
			return qb - qa;
		});
		return { streamUrl: String(sorted[0]?.url ?? null), qualities };
	}
	const hlsUrl = typeof data.hlsUrl === 'string' ? data.hlsUrl : null;
	if (hlsUrl) {
		return {
			streamUrl: hlsUrl,
			qualities: [{ label: 'HLS', url: hlsUrl }, ...qualities]
		};
	}
	return { streamUrl: null, qualities };
}

export async function resolveStreamClient(videoId: string): Promise<ResolvedStream> {
	const errors: string[] = [];
	for (const instance of STREAM_INSTANCES) {
		try {
			const res = await fetch(
				`${instance}/api/v1/videos/${encodeURIComponent(videoId)}?local=true`,
				{ headers: { Accept: 'application/json' } }
			);
			if (!res.ok) {
				errors.push(`${instance}: HTTP ${res.status}`);
				continue;
			}
			const data = (await res.json()) as Record<string, unknown>;
			if (typeof data === 'string' || (data as { error?: string }).error) {
				errors.push(`${instance}: ${String((data as { error?: string }).error || data)}`);
				continue;
			}
			const picked = pickStream(data);
			if (!picked.streamUrl) {
				errors.push(`${instance}: no stream`);
				continue;
			}
			return {
				...picked,
				hls: isHls(picked.streamUrl),
				meta: {
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
				}
			};
		} catch (e) {
			errors.push(`${instance}: ${e instanceof Error ? e.message : String(e)}`);
		}
	}
	throw new Error(`No playable stream:\n${errors.join('\n')}`);
}
