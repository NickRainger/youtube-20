import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getVideo, resolvePlayableStream } from '#lib/server/proxy';
import { isShortsCandidate } from '#lib/server/shorts';

export const GET: RequestHandler = async ({ params }) => {
	try {
		try {
			const video = await getVideo(params.id);
			if (isShortsCandidate(video)) {
				error(404, 'Shorts are disabled in YouTube 2.0');
			}
		} catch {
			/* Piped may still resolve the stream */
		}

		const resolved = await resolvePlayableStream(params.id);
		return json({
			...resolved,
			corsNote:
				'Piped proxy muxed MP4 is preferred. Invidious HLS is skipped because nested googlevideo URLs 403 in browsers.'
		});
	} catch (e) {
		error(502, e instanceof Error ? e.message : 'stream failed');
	}
};
