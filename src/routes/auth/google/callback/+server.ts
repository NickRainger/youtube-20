import { redirect, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exchangeCode, fetchUserInfo, googleConfigured } from '#lib/server/google';
import { encodeSession, SESSION_COOKIE, sessionCookieOptions } from '#lib/server/session';

export const GET: RequestHandler = async ({ url, cookies }) => {
	if (!googleConfigured()) error(503, 'Google OAuth not configured');

	const err = url.searchParams.get('error');
	if (err) error(400, `Google OAuth error: ${err}`);

	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const expected = cookies.get('yt20_oauth_state');
	cookies.delete('yt20_oauth_state', { path: '/' });

	if (!code || !state || !expected || state !== expected) {
		error(400, 'Invalid OAuth state');
	}

	const origin = `${url.protocol}//${url.host}`;
	const tokens = await exchangeCode(origin, code);
	const profile = await fetchUserInfo(tokens.access_token);

	const session = encodeSession({
		accessToken: tokens.access_token,
		refreshToken: tokens.refresh_token,
		expiry: Date.now() + tokens.expires_in * 1000,
		user: {
			sub: profile.sub,
			email: profile.email,
			name: profile.name,
			picture: profile.picture
		}
	});

	cookies.set(SESSION_COOKIE, session, sessionCookieOptions());
	redirect(302, '/playlists');
};
