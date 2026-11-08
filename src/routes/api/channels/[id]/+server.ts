import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getChannel, getChannelVideos } from '#lib/server/proxy';

export const GET: RequestHandler = async ({ params, url }) => {
	try {
		const includeVideos = url.searchParams.get('videos') !== '0';
		const channel = await getChannel(params.id);
		const videos = includeVideos
			? await getChannelVideos(params.id).catch(() => channel.latestVideos ?? [])
			: (channel.latestVideos ?? []);
		return json({ channel, videos });
	} catch (e) {
		error(502, e instanceof Error ? e.message : 'channel failed');
	}
};
