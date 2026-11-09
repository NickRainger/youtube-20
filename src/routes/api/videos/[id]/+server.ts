import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getVideoSoft,
	isHlsUrl,
	pickProgressiveStream,
	resolvePlayableStream,
	StreamResolveError
} from '#lib/server/proxy';
import { isShortsCandidate } from '#lib/server/shorts';
import { toStreamResolveError } from '#lib/stream-errors';

export const GET: RequestHandler = async ({ params }) => {
	const streamP = resolvePlayableStream(params.id).then(
		(resolved) => ({ ok: true as const, resolved }),
		(e) => ({ ok: false as const, error: toStreamResolveError(e) })
	);
	const softP = getVideoSoft(params.id);

	const [soft, streamResult] = await Promise.all([softP, streamP]);
	let video = soft.video;

	if (video && isShortsCandidate(video)) {
		error(404, 'Shorts are disabled in YouTube 2.0');
	}

	// Soft stub so the watch page can still render poster/title chrome.
	if (!video) {
		video = {
			type: 'video',
			videoId: params.id,
			title: '',
			description: '',
			publishedText: '',
			viewCount: 0,
			author: '',
			authorId: '',
			lengthSeconds: 0,
			videoThumbnails: [
				{ url: `https://i.ytimg.com/vi/${params.id}/hqdefault.jpg`, width: 480, height: 360 },
				{ url: `https://i.ytimg.com/vi/${params.id}/mqdefault.jpg`, width: 320, height: 180 }
			],
			recommendedVideos: []
		};
	}

	let streamUrl = pickProgressiveStream(video);
	let qualities = (video.formatStreams ?? [])
		.map((s) => ({
			label: s.qualityLabel || s.resolution || 'auto',
			url: s.url,
			container: s.container
		}))
		.filter((q) => q.url && !isHlsUrl(q.url));
	let source = streamUrl ? 'invidious-progressive' : '';
	let streamCode: string | undefined;
	let streamMessage: string | undefined;

	if (!streamUrl && streamResult.ok) {
		streamUrl = streamResult.resolved.streamUrl;
		qualities = streamResult.resolved.qualities.map((q) => ({ ...q, container: 'mp4' }));
		source = streamResult.resolved.source;
	} else if (!streamUrl && !streamResult.ok) {
		streamCode = streamResult.error.code;
		streamMessage = streamResult.error.message;
	}

	const unavailable =
		soft.unavailable ||
		streamCode === 'unavailable' ||
		(streamResult.ok === false && streamResult.error instanceof StreamResolveError
			? streamResult.error.code === 'unavailable'
			: false);

	return json({
		video,
		streamUrl: streamUrl ?? null,
		qualities,
		hls: isHlsUrl(streamUrl),
		source,
		unavailable,
		streamCode: streamCode ?? (unavailable ? 'unavailable' : soft.errorCode),
		streamMessage,
		corsNote:
			'Prefer Piped muxed MP4 via proxy. Invidious HLS nested googlevideo URLs are not returned.'
	});
};
