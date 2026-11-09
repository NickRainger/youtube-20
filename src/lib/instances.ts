/** Shared Piped / Invidious instance pools (browser + server).
 * Public hosts churn often; keep the pool wide and race/failover at call sites.
 */

export const INVIDIOUS = [
	'https://yt.chocolatemoo53.com',
	'https://invidious.materialio.us',
	'https://invidious.private.coffee',
	'https://yewtu.be',
	'https://inv.nadeko.net',
	'https://invidious.nerdvpn.de',
	'https://invidious.lunar.icu',
	'https://iv.ggtyler.dev',
	'https://invidious.flokinet.to',
	'https://invidious.perennialte.ch'
];

export const PIPED = [
	'https://api.piped.private.coffee',
	'https://pipedapi.ducks.party',
	'https://pipedapi.reallyaweso.me',
	'https://piped-api.codespace.cz',
	'https://pipedapi.orangenet.cc',
	'https://pipedapi.drgns.space',
	'https://pipedapi.ggtyler.dev',
	'https://pipedapi.privacydev.net',
	'https://pipedapi.palveluntarjoaja.eu',
	'https://pipedapi.vern.cc',
	'https://pipedapi.il.ax',
	'https://pipedapi.ngn.tf',
	'https://pipedapi.nosebs.ru',
	'https://pipedapi.kavin.rocks',
	'https://pipedapi-libre.kavin.rocks',
	'https://api.piped.yt'
];

/** Piped hosts known to send Access-Control-Allow-Origin: * — safe for browser fallback. */
export const PIPED_CORS_FRIENDLY = [
	'https://api.piped.private.coffee',
	'https://pipedapi.ducks.party',
	'https://pipedapi.reallyaweso.me'
];
