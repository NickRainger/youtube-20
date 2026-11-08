import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { INVIDIOUS } from '#lib/server/instances';

/** Read-only comments via Invidious when available. */
export const GET: RequestHandler = async ({ params }) => {
	const errors: string[] = [];
	for (const instance of INVIDIOUS) {
		try {
			const res = await fetch(
				`${instance}/api/v1/comments/${encodeURIComponent(params.id)}`,
				{ headers: { Accept: 'application/json' } }
			);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = await res.json();
			return json({
				comments: (data.comments ?? []).slice(0, 40).map((c: Record<string, unknown>) => ({
					author: c.author,
					content: c.content,
					publishedText: c.publishedText,
					likeCount: c.likeCount
				}))
			});
		} catch (e) {
			errors.push(String(e));
		}
	}
	return json({ comments: [], error: 'Comments unavailable', detail: errors[0] });
};
