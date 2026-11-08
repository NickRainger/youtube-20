import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getVideo, pickProgressiveStream } from '#lib/server/proxy';
import { isShortsCandidate } from '#lib/server/shorts';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const video = await getVideo(params.id);
		if (isShortsCandidate(video)) {
			error(404, 'Shorts are disabled in YouTube 2.0');
		}
		const qualities = (video.formatStreams ?? [])
			.map((s) => ({
				label: s.qualityLabel || s.resolution || 'auto',
				url: s.url,
				container: s.container
			}))
			.filter((q) => q.url);
		return json({
			video,
			streamUrl: pickProgressiveStream(video),
			qualities,
			corsNote:
				'Progressive streams play cross-origin in <video> without CORS. Canvas/MSE features may require a same-origin stream proxy later.'
		});
	} catch (e) {
		error(502, e instanceof Error ? e.message : 'video failed');
	}
};
