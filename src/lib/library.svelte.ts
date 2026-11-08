export type LibVideo = {
	videoId: string;
	title: string;
	author?: string;
	authorId?: string;
	lengthSeconds?: number;
	videoThumbnails?: { url: string; width: number; height: number }[];
	viewCount?: number;
	watchedAt?: number;
};

export type LocalSub = {
	authorId: string;
	author: string;
	authorThumb?: string;
	subscribedAt: number;
};

type Store = {
	history: LibVideo[];
	saved: LibVideo[];
	subscriptions: LocalSub[];
	lang: 'nl' | 'en';
};

const KEY = 'yt20:library-v1';

function read(): Store {
	if (typeof localStorage === 'undefined') {
		return { history: [], saved: [], subscriptions: [], lang: 'nl' };
	}
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return { history: [], saved: [], subscriptions: [], lang: 'nl' };
		return { lang: 'nl', history: [], saved: [], subscriptions: [], ...JSON.parse(raw) };
	} catch {
		return { history: [], saved: [], subscriptions: [], lang: 'nl' };
	}
}

function write(s: Store) {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(KEY, JSON.stringify(s));
	} catch {
		/* quota */
	}
}

let store = $state<Store>(read());

export function getLibrary() {
	return store;
}

export function hydrateLibrary() {
	store = read();
}

export function setLang(lang: 'nl' | 'en') {
	store = { ...store, lang };
	write(store);
	if (typeof document !== 'undefined') document.documentElement.lang = lang;
}

export function addHistory(video: LibVideo) {
	const filtered = store.history.filter((h) => h.videoId !== video.videoId);
	store = {
		...store,
		history: [{ ...video, watchedAt: Date.now() }, ...filtered].slice(0, 100)
	};
	write(store);
}

export function clearHistory() {
	store = { ...store, history: [] };
	write(store);
}

export function toggleSave(video: LibVideo) {
	const exists = store.saved.some((s) => s.videoId === video.videoId);
	store = {
		...store,
		saved: exists
			? store.saved.filter((s) => s.videoId !== video.videoId)
			: [video, ...store.saved]
	};
	write(store);
}

export function isSaved(id?: string) {
	return !!id && store.saved.some((s) => s.videoId === id);
}

export function toggleSub(sub: Omit<LocalSub, 'subscribedAt'>) {
	const exists = store.subscriptions.some((s) => s.authorId === sub.authorId);
	store = {
		...store,
		subscriptions: exists
			? store.subscriptions.filter((s) => s.authorId !== sub.authorId)
			: [{ ...sub, subscribedAt: Date.now() }, ...store.subscriptions]
	};
	write(store);
}

export function isSubscribed(id?: string) {
	return !!id && store.subscriptions.some((s) => s.authorId === id);
}
