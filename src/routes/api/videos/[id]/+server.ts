import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getVideo, isHlsUrl, pickProgressiveStream } from '#lib/server/proxy';
import { isShortsCandidate } from '#lib/server/shorts';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const video = await getVideo(params.id);
		if (isShortsCandidate(video)) {
			error(404, 'Shorts are disabled in YouTube 2.0');
		}
		const streamUrl = pickProgressiveStream(video);
		const qualities = (video.formatStreams ?? [])
			.map((s) => ({
				label: s.qualityLabel || s.resolution || 'auto',
				url: s.url,
				container: s.container
			}))
			.filter((q) => q.url);
		if (streamUrl && isHlsUrl(streamUrl) && !qualities.some((q) => q.url === streamUrl)) {
			qualities.unshift({ label: 'HLS', url: streamUrl, container: 'hls' });
		}
		return json({
			video,
			streamUrl,
			qualities,
			hls: isHlsUrl(streamUrl),
			corsNote:
				'Progressive streams play cross-origin in <video> without CORS. HLS falls back when muxed MP4 is unavailable.'
		});
	} catch (e) {
		error(502, e instanceof Error ? e.message : 'video failed');
	}
};
