import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listPlaylistItems } from '#lib/server/google';

export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.session) error(401, 'Sign in with Google to view playlist items');
	if (params.id.startsWith('sample-')) {
		return json({ items: [] });
	}
	try {
		const data = await listPlaylistItems(locals.session.accessToken, params.id);
		const videos = (data.items ?? [])
			.map((item: Record<string, unknown>) => {
				const snippet = item.snippet as Record<string, unknown>;
				const resource = snippet?.resourceId as Record<string, string> | undefined;
				const thumbs = snippet?.thumbnails as Record<string, { url: string }> | undefined;
				const videoId = resource?.videoId;
				if (!videoId) return null;
				return {
					videoId,
					title: String(snippet?.title ?? ''),
					author: String(snippet?.videoOwnerChannelTitle ?? snippet?.channelTitle ?? ''),
					authorId: String(snippet?.videoOwnerChannelId ?? ''),
					videoThumbnails: thumbs?.medium
						? [{ url: thumbs.medium.url, width: 320, height: 180 }]
						: thumbs?.default
							? [{ url: thumbs.default.url, width: 120, height: 90 }]
							: []
				};
			})
			.filter(Boolean);
		return json({ items: videos });
	} catch (e) {
		error(502, e instanceof Error ? e.message : 'playlist items failed');
	}
};
