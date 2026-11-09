import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listSubscriptionFeed } from '#lib/server/google';
import { getVideo } from '#lib/server/proxy';
import { filterOutShorts } from '#lib/server/shorts';

export const GET: RequestHandler = async ({ locals, url }) => {
	// Logged-in: subscription uploads via official YouTube Data API
	if (locals.googleConfigured && locals.session) {
		try {
			const videos = await listSubscriptionFeed(locals.session.accessToken);
			const filtered = filterOutShorts(
				videos.map((v) => ({
					...v,
					type: 'video' as const,
					lengthSeconds: v.lengthSeconds ?? 0
				}))
			);
			return json({
				source: 'subscriptions',
				videos: filtered,
				needsAuth: false,
				googleConfigured: true
			});
		} catch (e) {
			error(502, e instanceof Error ? e.message : 'feed failed');
		}
	}

	// Guest fallback: related videos from a seed (history id or trending hit)
	const seed = url.searchParams.get('seed');
	if (seed) {
		try {
			const detail = await getVideo(seed);
			return json({
				source: 'related',
				videos: detail.recommendedVideos ?? [],
				needsAuth: true,
				googleConfigured: locals.googleConfigured
			});
		} catch {
			/* fall through */
		}
	}

	return json({
		source: 'none',
		videos: [],
		needsAuth: true,
		googleConfigured: locals.googleConfigured
	});
};
