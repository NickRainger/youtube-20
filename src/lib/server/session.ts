import { createHmac, timingSafeEqual } from 'node:crypto';

export type SessionUser = {
	email?: string;
	name?: string;
	picture?: string;
	sub: string;
};

export type SessionData = {
	accessToken: string;
	refreshToken?: string;
	expiry: number;
	user: SessionUser;
};

const COOKIE = 'yt20_session';

function secret() {
	return (
		process.env.SESSION_SECRET ||
		process.env.GOOGLE_CLIENT_SECRET ||
		'yt20-dev-session-secret-change-me'
	);
}

function sign(payload: string): string {
	return createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function encodeSession(data: SessionData): string {
	const payload = Buffer.from(JSON.stringify(data), 'utf8').toString('base64url');
	return `${payload}.${sign(payload)}`;
}

export function decodeSession(raw: string | undefined): SessionData | null {
	if (!raw) return null;
	const [payload, sig] = raw.split('.');
	if (!payload || !sig) return null;
	const expected = sign(payload);
	try {
		const a = Buffer.from(sig);
		const b = Buffer.from(expected);
		if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
	} catch {
		return null;
	}
	try {
		return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as SessionData;
	} catch {
		return null;
	}
}

export function sessionCookieOptions(maxAge = 60 * 60 * 24 * 30) {
	return {
		path: '/',
		httpOnly: true,
		sameSite: 'lax' as const,
		secure: process.env.NODE_ENV === 'production',
		maxAge
	};
}

export { COOKIE as SESSION_COOKIE };
