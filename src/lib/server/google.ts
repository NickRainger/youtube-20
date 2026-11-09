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

/** Uploads playlist id for a channel (UC… → UU…). */
export function uploadsPlaylistId(channelId: string): string | null {
	if (!channelId.startsWith('UC') || channelId.length < 3) return null;
	return `UU${channelId.slice(2)}`;
}

export type FeedVideo = {
	videoId: string;
	title: string;
	author: string;
	authorId: string;
	publishedAt?: string;
	publishedText?: string;
	thumbnail?: string;
	lengthSeconds?: number;
	videoThumbnails?: { url: string; width: number; height: number }[];
};

/**
 * Personalized-ish home feed: recent uploads from the user’s subscriptions
 * via YouTube Data API (not InnerTube — that needs YouTube web cookies).
 */
export async function listSubscriptionFeed(
	accessToken: string,
	opts: { channelLimit?: number; perChannel?: number } = {}
): Promise<FeedVideo[]> {
	const channelLimit = opts.channelLimit ?? 24;
	const perChannel = opts.perChannel ?? 4;
	const subs = await listSubscriptions(accessToken);
	const channels = (subs.items ?? [])
		.map((item: Record<string, unknown>) => {
			const snippet = item.snippet as Record<string, unknown> | undefined;
			const resource = snippet?.resourceId as Record<string, string> | undefined;
			return {
				authorId: resource?.channelId ?? '',
				author: String(snippet?.title ?? '')
			};
		})
		.filter((c: { authorId: string }) => c.authorId)
		.slice(0, channelLimit);

	const batches = await Promise.all(
		channels.map(async (ch: { authorId: string; author: string }) => {
			const playlistId = uploadsPlaylistId(ch.authorId);
			if (!playlistId) return [] as FeedVideo[];
			try {
				const data = await ytGet(
					`/playlistItems?part=snippet,contentDetails&playlistId=${encodeURIComponent(playlistId)}&maxResults=${perChannel}`,
					accessToken
				);
				return (data.items ?? [])
					.map((item: Record<string, unknown>) => {
						const snippet = item.snippet as Record<string, unknown> | undefined;
						const content = item.contentDetails as Record<string, string> | undefined;
						const thumbs = snippet?.thumbnails as
							| Record<string, { url: string; width?: number; height?: number }>
							| undefined;
						const videoId = content?.videoId || String(snippet?.resourceId && (snippet.resourceId as { videoId?: string }).videoId || '');
						if (!videoId) return null;
						const thumb =
							thumbs?.medium?.url || thumbs?.high?.url || thumbs?.default?.url || '';
						return {
							videoId,
							title: String(snippet?.title ?? ''),
							author: ch.author || String(snippet?.channelTitle ?? ''),
							authorId: ch.authorId || String(snippet?.channelId ?? ''),
							publishedAt: content?.videoPublishedAt || String(snippet?.publishedAt ?? ''),
							publishedText: String(snippet?.publishedAt ?? ''),
							thumbnail: thumb,
							videoThumbnails: thumb
								? [{ url: thumb, width: 320, height: 180 }]
								: []
						} satisfies FeedVideo;
					})
					.filter(Boolean) as FeedVideo[];
			} catch {
				return [] as FeedVideo[];
			}
		})
	);

	const merged = batches.flat();
	merged.sort((a, b) => {
		const ta = Date.parse(a.publishedAt || '') || 0;
		const tb = Date.parse(b.publishedAt || '') || 0;
		return tb - ta;
	});
	// Dedupe by videoId
	const seen = new Set<string>();
	return merged.filter((v) => {
		if (seen.has(v.videoId)) return false;
		seen.add(v.videoId);
		return true;
	});
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
