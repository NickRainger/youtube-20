# YouTube 2.0

Public PWA (SvelteKit + TypeScript + DaisyUI): ad-free long-form watching via Invidious/Piped same-origin proxies, Google OAuth for each user’s YouTube playlists.

## Dev

```bash
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

Optional local secrets (never commit):

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
SESSION_SECRET=...
```

Published app: bind the same names via Cursor Secrets. Redirect URI: `https://<your-app-host>/auth/google/callback`.

## Architecture

- Browser → `/api/*` (same origin) → Invidious/Piped (server-side failover)
- Google OAuth + YouTube Data API only on server routes; client secret never in the browser
- `<video>` uses direct progressive stream URLs when playable (CORS not required for basic playback)
