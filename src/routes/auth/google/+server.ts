import { redirect, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authUrl, googleConfigured } from '#lib/server/google';
import { randomBytes } from 'node:crypto';

export const GET: RequestHandler = async ({ url, cookies, locals }) => {
	if (!googleConfigured()) {
		error(
			503,
			'Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Cursor Secrets.'
		);
	}
	const state = randomBytes(16).toString('hex');
	cookies.set('yt20_oauth_state', state, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: process.env.NODE_ENV === 'production',
		maxAge: 600
	});
	const origin = `${url.protocol}//${url.host}`;
	// SvelteKit 3 blocks external redirects unless opted in
	redirect(302, authUrl(origin, state), {
		external: ['https://accounts.google.com']
	});
};
