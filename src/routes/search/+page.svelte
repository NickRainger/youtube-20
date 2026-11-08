<script lang="ts">
	import { page } from '$app/state';
	import VideoCard from '#lib/components/VideoCard.svelte';
	import { bestThumb } from '#lib/format';
	import { getLibrary } from '#lib/library.svelte';
	import { t } from '#lib/i18n';

	let videos = $state<any[]>([]);
	let channels = $state<any[]>([]);
	let loading = $state(false);
	let errorMsg = $state('');
	const lang = $derived(getLibrary().lang);
	const q = $derived(page.url.searchParams.get('q') ?? '');

	$effect(() => {
		const query = q;
		if (!query.trim()) {
			videos = [];
			channels = [];
			return;
		}
		let cancelled = false;
		loading = true;
		errorMsg = '';
		fetch(`/api/search?q=${encodeURIComponent(query)}`)
			.then(async (res) => {
				if (!res.ok) throw new Error((await res.text()).slice(0, 400));
				return res.json();
			})
			.then((data) => {
				if (cancelled) return;
				videos = data.videos ?? [];
				channels = data.channels ?? [];
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
	<h1 class="font-display mb-1 text-2xl font-bold">{t(lang, 'search')}</h1>
	<p class="mb-4 text-sm opacity-55">{t(lang, 'shortsFiltered')}</p>

	<form class="mb-6 flex gap-2" action="/search" method="GET">
		<input
			class="input input-bordered flex-1 rounded-full"
			name="q"
			value={q}
			placeholder={t(lang, 'searchPlaceholder')}
			autocomplete="off"
		/>
		<button class="btn btn-primary rounded-full px-6">{t(lang, 'searchBtn')}</button>
	</form>

	{#if errorMsg}
		<div class="alert alert-error mb-4 text-sm">{errorMsg}</div>
	{/if}

	{#if loading}
		<div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
			{#each Array(4) as _}
				<div class="skeleton aspect-video rounded-2xl"></div>
			{/each}
		</div>
	{/if}

	{#if !loading && channels.length}
		<h2 class="font-display mb-3 text-lg font-bold">{t(lang, 'channels')}</h2>
		<div class="mb-8 space-y-3">
			{#each channels.slice(0, 6) as ch}
				<a href="/channel/{ch.authorId}" class="flex items-center gap-3 py-1">
					<img
						src={bestThumb(ch.authorThumbnails, 88) || undefined}
						alt=""
						class="h-12 w-12 rounded-full bg-base-300 object-cover"
					/>
					<div>
						<div class="font-semibold">{ch.author}</div>
						<div class="text-sm opacity-55">{ch.subCount ?? ''} {t(lang, 'subscribers')}</div>
					</div>
				</a>
			{/each}
		</div>
	{/if}

	{#if !loading && videos.length}
		<h2 class="font-display mb-3 text-lg font-bold">{t(lang, 'videos')}</h2>
		<div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
			{#each videos as video, i}
				<VideoCard {video} {lang} index={i} />
			{/each}
		</div>
	{/if}
</main>
