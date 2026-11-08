import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchAll } from '#lib/server/proxy';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const q = url.searchParams.get('q') ?? '';
		const data = await searchAll(q);
		return json(data);
	} catch (e) {
		error(502, e instanceof Error ? e.message : 'search failed');
	}
};
