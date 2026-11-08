export function formatDuration(seconds?: number): string {
	if (seconds == null || Number.isNaN(seconds) || seconds < 0) return '';
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = Math.floor(seconds % 60);
	if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
	return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatCount(n?: number, lang: 'nl' | 'en' = 'nl'): string {
	if (n == null) return '';
	const views = lang === 'nl' ? 'weergaven' : 'views';
	if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1).replace('.0', '')}${lang === 'nl' ? ' mld.' : 'B'} ${views}`;
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')}${lang === 'nl' ? ' mln.' : 'M'} ${views}`;
	if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace('.0', '')}${lang === 'nl' ? ' dzd.' : 'K'} ${views}`;
	return `${n} ${views}`;
}

export function bestThumb(
	thumbs?: { url: string; width: number; height: number }[],
	min = 320
): string {
	if (!thumbs?.length) return '';
	const sorted = [...thumbs].sort((a, b) => a.width - b.width);
	return (sorted.find((t) => t.width >= min) ?? sorted[sorted.length - 1]).url;
}
