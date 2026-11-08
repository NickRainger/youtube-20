/** Escape text for safe HTML text nodes. */
export function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function isSafeHref(href: string): boolean {
	try {
		const u = new URL(href, 'https://example.invalid');
		return u.protocol === 'http:' || u.protocol === 'https:';
	} catch {
		return false;
	}
}

/**
 * Convert Invidious/Piped description HTML into a minimal safe HTML subset:
 * text, <br>, and http(s) <a> only. Strips scripts/styles/events.
 * SSR-safe: falls back to tag-stripped plain text (escaped).
 */
export function sanitizeDescriptionHtml(raw: string | undefined | null): string {
	if (!raw) return '';

	if (typeof DOMParser === 'undefined') {
		return escapeHtml(
			raw
				.replace(/<\s*br\s*\/?>/gi, '\n')
				.replace(/<[^>]+>/g, '')
				.replace(/&nbsp;/gi, ' ')
				.replace(/&amp;/g, '&')
				.replace(/&lt;/g, '<')
				.replace(/&gt;/g, '>')
				.replace(/&quot;/g, '"')
		).replace(/\n/g, '<br>');
	}

	const doc = new DOMParser().parseFromString(`<div>${raw}</div>`, 'text/html');
	const root = doc.body.firstElementChild;
	if (!root) return escapeHtml(raw);

	function walk(node: Node): string {
		if (node.nodeType === Node.TEXT_NODE) {
			return escapeHtml(node.textContent ?? '');
		}
		if (node.nodeType !== Node.ELEMENT_NODE) return '';
		const el = node as Element;
		const tag = el.tagName.toUpperCase();

		if (tag === 'BR') return '<br>';
		if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'IFRAME' || tag === 'OBJECT') return '';

		const children = Array.from(el.childNodes).map(walk).join('');

		if (tag === 'A') {
			const href = el.getAttribute('href')?.trim() ?? '';
			if (isSafeHref(href)) {
				const safe = escapeHtml(href);
				return `<a href="${safe}" target="_blank" rel="noopener noreferrer">${children || safe}</a>`;
			}
			return children;
		}

		if (tag === 'P' || tag === 'DIV') {
			return `${children}<br>`;
		}

		// b/i/strong/em → keep text only (or light emphasis without attributes)
		if (tag === 'B' || tag === 'STRONG') return `<strong>${children}</strong>`;
		if (tag === 'I' || tag === 'EM') return `<em>${children}</em>`;

		return children;
	}

	return walk(root).replace(/(<br>)+$/g, '');
}

/** Plain-text fallback (no HTML). */
export function descriptionToPlainText(raw: string | undefined | null): string {
	if (!raw) return '';
	return raw
		.replace(/<\s*br\s*\/?>/gi, '\n')
		.replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, '$2 ($1)')
		.replace(/<[^>]+>/g, '')
		.replace(/&nbsp;/gi, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.trim();
}
