import type { Handle } from '@sveltejs/kit';
import {
	decodeSession,
	encodeSession,
	SESSION_COOKIE,
	sessionCookieOptions,
	type SessionData
} from '#lib/server/session';
import { ensureFreshSession, googleConfigured } from '#lib/server/google';

export const handle: Handle = async ({ event, resolve }) => {
	const raw = event.cookies.get(SESSION_COOKIE);
	let session = decodeSession(raw);

	if (session && googleConfigured()) {
		try {
			const fresh = await ensureFreshSession(session);
			if (fresh && fresh.accessToken !== session.accessToken) {
				event.cookies.set(SESSION_COOKIE, encodeSession(fresh), sessionCookieOptions());
				session = fresh;
			} else if (!fresh) {
				event.cookies.delete(SESSION_COOKIE, { path: '/' });
				session = null;
			} else {
				session = fresh;
			}
		} catch {
			/* keep existing until refresh truly fails on API call */
		}
	}

	event.locals.session = session as SessionData | null;
	event.locals.googleConfigured = googleConfigured();

	return resolve(event, {
		filterSerializedResponseHeaders: (name) => name === 'content-type'
	});
};
