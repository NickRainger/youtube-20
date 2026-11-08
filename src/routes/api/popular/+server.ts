import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPopular } from '#lib/server/proxy';

export const GET: RequestHandler = async () => {
	try {
		const data = await getPopular();
		return json({ videos: data });
	} catch (e) {
		error(502, e instanceof Error ? e.message : 'popular failed');
	}
};
