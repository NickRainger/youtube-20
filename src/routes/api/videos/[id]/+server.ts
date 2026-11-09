import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getVideo,
	isHlsUrl,
	pickProgressiveStream,
	resolvePlayableStream
} from '#lib/server/proxy';
import { isShortsCandidate } from '#lib/server/shorts';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const video = await getVideo(params.id);
		if (isShortsCandidate(video)) {
			error(404, 'Shorts are disabled in YouTube 2.0');
		}

		let streamUrl = pickProgressiveStream(video);
		let qualities = (video.formatStreams ?? [])
			.map((s) => ({
				label: s.qualityLabel || s.resolution || 'auto',
				url: s.url,
				container: s.container
			}))
			.filter((q) => q.url && !isHlsUrl(q.url));
		let source = 'invidious-progressive';

		if (!streamUrl) {
			try {
				const resolved = await resolvePlayableStream(params.id);
				streamUrl = resolved.streamUrl;
				qualities = resolved.qualities.map((q) => ({ ...q, container: 'mp4' }));
				source = resolved.source;
			} catch {
				/* metadata still useful without a stream */
			}
		}

		return json({
			video,
			streamUrl,
			qualities,
			hls: isHlsUrl(streamUrl),
			source,
			corsNote:
				'Prefer Piped muxed MP4 via proxy. Invidious HLS nested googlevideo URLs are not returned.'
		});
	} catch (e) {
		error(502, e instanceof Error ? e.message : 'video failed');
	}
};
