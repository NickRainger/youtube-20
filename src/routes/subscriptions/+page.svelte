<script lang="ts">
	import VideoCard from '#lib/components/VideoCard.svelte';
	import { getLibrary } from '#lib/library.svelte';
	import { t } from '#lib/i18n';

	let feed = $state<any[]>([]);
	let googleSubs = $state<{ authorId: string; author: string; authorThumb?: string }[]>([]);
	let loading = $state(false);
	let errorMsg = $state('');
	const lib = $derived(getLibrary());
	const lang = $derived(lib.lang);

	$effect(() => {
		const local = lib.subscriptions;
		let cancelled = false;
		loading = true;
		errorMsg = '';

		Promise.all([
			fetch('/api/youtube/subscriptions').then((r) => r.json()).catch(() => ({ items: [] })),
			Promise.allSettled(
				local.slice(0, 8).map((s) =>
					fetch(`/api/channels/${s.authorId}`).then((r) => r.json())
				)
			)
		])
			.then(([g, results]) => {
				if (cancelled) return;
				googleSubs = g.items ?? [];
				const merged: any[] = [];
				for (const r of results) {
					if (r.status === 'fulfilled') merged.push(...(r.value.videos ?? []).slice(0, 4));
				}
				const seen = new Set<string>();
				feed = merged.filter((v) => {
					if (!v.videoId || seen.has(v.videoId)) return false;
					seen.add(v.videoId);
					return true;
				});
			})
			.catch((e) => {
				if (!cancelled) errorMsg = e instanceof Error ? e.message : t(lang, 'errorLoad');
			})
			.finally(() => {
				if (!cancelled) loading = false;
			});

		return () => {
			cancelled = true;
		};
	});
</script>

<main class="page-enter mx-auto max-w-6xl px-4 pb-8 lg:px-6">
	<h1 class="font-display text-2xl font-bold">{t(lang, 'subs')}</h1>
	<p class="mt-1 text-sm opacity-55">{t(lang, 'localSubs')} + {t(lang, 'googleSubs')}</p>

	{#if googleSubs.length}
		<h2 class="font-display mt-6 mb-2 text-lg font-bold">{t(lang, 'googleSubs')}</h2>
		<div class="mb-4 flex gap-2 overflow-x-auto pb-1">
			{#each googleSubs as s}
				<a href="/channel/{s.authorId}" class="btn btn-sm rounded-full">{s.author}</a>
			{/each}
		</div>
	{/if}

	{#if lib.subscriptions.length}
		<h2 class="font-display mt-4 mb-2 text-lg font-bold">{t(lang, 'localSubs')}</h2>
		<div class="mb-4 flex gap-2 overflow-x-auto pb-1">
			{#each lib.subscriptions as s}
				<a href="/channel/{s.authorId}" class="btn btn-sm rounded-full">{s.author}</a>
			{/each}
		</div>
	{/if}

	{#if !lib.subscriptions.length && !googleSubs.length}
		<p class="py-16 text-center opacity-50">{t(lang, 'noSubs')}</p>
	{:else}
		<h2 class="font-display mb-3 text-lg font-bold">{t(lang, 'recent')}</h2>
		{#if errorMsg}
			<div class="alert alert-error mb-4 text-sm">{errorMsg}</div>
		{/if}
		{#if loading}
			<div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
				{#each Array(4) as _}
					<div class="skeleton aspect-video rounded-2xl"></div>
				{/each}
			</div>
		{:else}
			<div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
				{#each feed as video, i}
					<VideoCard {video} {lang} index={i} />
				{/each}
			</div>
		{/if}
	{/if}
</main>
