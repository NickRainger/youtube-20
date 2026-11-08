import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getTrending } from '#lib/server/proxy';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const region = url.searchParams.get('region') ?? 'NL';
		const data = await getTrending(region);
		return json({ videos: data });
	} catch (e) {
		error(502, e instanceof Error ? e.message : 'trending failed');
	}
};
