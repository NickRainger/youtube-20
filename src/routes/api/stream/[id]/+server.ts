import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { resolvePlayableStream, StreamResolveError } from '#lib/server/proxy';
import { toStreamResolveError } from '#lib/stream-errors';

export const GET: RequestHandler = async ({ params }) => {
	try {
		// Skip blocking getVideo/shorts probe here — listings already filter Shorts,
		// and a full metadata crawl was delaying stream failover by tens of seconds.
		const resolved = await resolvePlayableStream(params.id);
		return json({
			...resolved,
			corsNote:
				'Piped proxy muxed MP4 is preferred. Invidious HLS is skipped because nested googlevideo URLs 403 in browsers.'
		});
	} catch (e) {
		const err = e instanceof StreamResolveError ? e : toStreamResolveError(e);
		const status = err.code === 'unavailable' ? 404 : 502;
		return json(
			{
				streamUrl: null,
				qualities: [],
				hls: false,
				code: err.code,
				message: err.message,
				details: err.details
			},
			{ status }
		);
	}
};
