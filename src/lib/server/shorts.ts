export const SHORTS_MAX_SECONDS = 60;
const SHORTS_TITLE = /#shorts?\b|\bshorts?\b|\/shorts\//i;

export function isShortsCandidate(item: {
	title?: string;
	lengthSeconds?: number;
	duration?: number;
	type?: string;
	liveNow?: boolean;
}): boolean {
	if (item.type === 'short') return true;
	if (item.liveNow) return false;
	const title = item.title ?? '';
	if (SHORTS_TITLE.test(title)) return true;
	const len = item.lengthSeconds ?? item.duration ?? 0;
	return len > 0 && len <= SHORTS_MAX_SECONDS;
}

export function filterOutShorts<T extends { title?: string; lengthSeconds?: number; type?: string }>(
	items: T[]
): T[] {
	return items.filter((i) => !isShortsCandidate(i));
}
