import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listPlaylists, mockPlaylists } from '#lib/server/google';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.googleConfigured) {
		return json(mockPlaylists());
	}
	if (!locals.session) {
		return json({ sample: false, needsAuth: true, items: [] });
	}
	try {
		const data = await listPlaylists(locals.session.accessToken);
		return json({ sample: false, items: data.items ?? [] });
	} catch (e) {
		error(502, e instanceof Error ? e.message : 'playlists failed');
	}
};
