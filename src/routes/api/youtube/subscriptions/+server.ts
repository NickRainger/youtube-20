import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listSubscriptions } from '#lib/server/google';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.googleConfigured || !locals.session) {
		return json({ items: [], needsAuth: !locals.session, googleConfigured: locals.googleConfigured });
	}
	try {
		const data = await listSubscriptions(locals.session.accessToken);
		const items = (data.items ?? []).map((item: Record<string, unknown>) => {
			const snippet = item.snippet as Record<string, unknown>;
			const resource = snippet?.resourceId as Record<string, string> | undefined;
			const thumbs = snippet?.thumbnails as Record<string, { url: string }> | undefined;
			return {
				authorId: resource?.channelId ?? '',
				author: String(snippet?.title ?? ''),
				authorThumb: thumbs?.default?.url ?? thumbs?.medium?.url ?? ''
			};
		});
		return json({ items });
	} catch (e) {
		error(502, e instanceof Error ? e.message : 'subscriptions failed');
	}
};
