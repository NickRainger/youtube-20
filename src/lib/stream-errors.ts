/** Shared stream / video resolve error classification (server + client). */

export type StreamErrorCode = 'unavailable' | 'bot_block' | 'no_stream' | 'network';

export class StreamResolveError extends Error {
	code: StreamErrorCode;
	details: string;

	constructor(code: StreamErrorCode, message: string, details = '') {
		super(message);
		this.name = 'StreamResolveError';
		this.code = code;
		this.details = details;
	}
}

export function classifyUpstreamMessage(raw: string): StreamErrorCode {
	const s = raw.toLowerCase();
	if (
		s.includes('contentnotavailable') ||
		s.includes('this video is unavailable') ||
		s.includes('video unavailable') ||
		s.includes('private video') ||
		s.includes('video has been removed') ||
		/\bunavailable\b/.test(s)
	) {
		return 'unavailable';
	}
	if (
		s.includes('signinconfirmnotbot') ||
		s.includes('login_required') ||
		s.includes('sign in to confirm') ||
		s.includes('confirm you') ||
		s.includes('bot')
	) {
		return 'bot_block';
	}
	return 'no_stream';
}

/** Turn AggregateError / raw Error into a StreamResolveError. */
export function toStreamResolveError(err: unknown, fallbackDetails = ''): StreamResolveError {
	if (err instanceof StreamResolveError) return err;

	if (typeof AggregateError !== 'undefined' && err instanceof AggregateError) {
		const parts = (err.errors ?? []).map((e) =>
			e instanceof Error ? e.message : String(e)
		);
		const joined = parts.join('\n') || err.message || fallbackDetails;
		const codes = parts.map(classifyUpstreamMessage);
		const code: StreamErrorCode = codes.includes('unavailable')
			? 'unavailable'
			: codes.includes('bot_block')
				? 'bot_block'
				: 'no_stream';
		return new StreamResolveError(code, err.message || 'All promises were rejected', joined);
	}

	const msg = err instanceof Error ? err.message : String(err ?? 'unknown');
	if (/all promises were rejected/i.test(msg)) {
		return new StreamResolveError('no_stream', msg, fallbackDetails || msg);
	}
	return new StreamResolveError(classifyUpstreamMessage(msg), msg, fallbackDetails || msg);
}
