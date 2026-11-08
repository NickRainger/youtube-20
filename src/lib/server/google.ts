import type { SessionData } from './session';

const AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN = 'https://oauth2.googleapis.com/token';
const USERINFO = 'https://www.googleapis.com/oauth2/v3/userinfo';
const YT = 'https://www.googleapis.com/youtube/v3';

function clientId() {
	return process.env.GOOGLE_CLIENT_ID ?? '';
}
function clientSecret() {
	return process.env.GOOGLE_CLIENT_SECRET ?? '';
}

export const SCOPES = [
	'openid',
	'email',
	'profile',
	'https://www.googleapis.com/auth/youtube.readonly'
].join(' ');

export function googleConfigured(): boolean {
	return Boolean(clientId() && clientSecret());
}

export function authUrl(origin: string, state: string): string {
	const params = new URLSearchParams({
		client_id: clientId(),
		redirect_uri: `${origin}/auth/google/callback`,
		response_type: 'code',
		scope: SCOPES,
		access_type: 'offline',
		prompt: 'consent',
		state
	});
	return `${AUTH}?${params}`;
}

export async function exchangeCode(origin: string, code: string) {
	const res = await fetch(TOKEN, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			code,
			client_id: clientId(),
			client_secret: clientSecret(),
			redirect_uri: `${origin}/auth/google/callback`,
			grant_type: 'authorization_code'
		})
	});
	if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);
	return (await res.json()) as {
		access_token: string;
		refresh_token?: string;
		expires_in: number;
		id_token?: string;
	};
}

export async function refreshAccess(refreshToken: string) {
	const res = await fetch(TOKEN, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			client_id: clientId(),
			client_secret: clientSecret(),
			refresh_token: refreshToken,
			grant_type: 'refresh_token'
		})
	});
	if (!res.ok) throw new Error(`Refresh failed: ${res.status}`);
	return (await res.json()) as { access_token: string; expires_in: number };
}

export async function fetchUserInfo(accessToken: string) {
	const res = await fetch(USERINFO, {
		headers: { Authorization: `Bearer ${accessToken}` }
	});
	if (!res.ok) throw new Error('userinfo failed');
	return (await res.json()) as {
		sub: string;
		email?: string;
		name?: string;
		picture?: string;
	};
}

async function ytGet(path: string, accessToken: string) {
	const res = await fetch(`${YT}${path}`, {
		headers: { Authorization: `Bearer ${accessToken}` }
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`YouTube API ${res.status}: ${text.slice(0, 200)}`);
	}
	return res.json();
}

export async function listPlaylists(accessToken: string) {
	return ytGet(
		'/playlists?part=snippet,contentDetails&mine=true&maxResults=50',
		accessToken
	);
}

export async function listPlaylistItems(accessToken: string, playlistId: string) {
	return ytGet(
		`/playlistItems?part=snippet,contentDetails&playlistId=${encodeURIComponent(playlistId)}&maxResults=50`,
		accessToken
	);
}

export async function listSubscriptions(accessToken: string) {
	return ytGet(
		'/subscriptions?part=snippet&mine=true&maxResults=50',
		accessToken
	);
}

/** Sample data when Google secrets are unset (local / pre-secret publish). */
export function mockPlaylists() {
	return {
		sample: true as const,
		items: [
			{
				id: 'sample-watch-later',
				snippet: {
					title: 'Sample · Watch later',
					description: 'Demo playlist — connect Google to load yours',
					thumbnails: { medium: { url: '' } }
				},
				contentDetails: { itemCount: 0 }
			},
			{
				id: 'sample-favorites',
				snippet: {
					title: 'Sample · Favorites',
					description: 'Demo playlist',
					thumbnails: { medium: { url: '' } }
				},
				contentDetails: { itemCount: 0 }
			}
		]
	};
}

export async function ensureFreshSession(
	session: SessionData
): Promise<SessionData | null> {
	if (!googleConfigured()) return session;
	if (Date.now() < session.expiry - 60_000) return session;
	if (!session.refreshToken) return null;
	const refreshed = await refreshAccess(session.refreshToken);
	return {
		...session,
		accessToken: refreshed.access_token,
		expiry: Date.now() + refreshed.expires_in * 1000
	};
}
