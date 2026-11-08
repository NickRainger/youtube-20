<script lang="ts">
	import { t } from '#lib/i18n';
	import { getLibrary } from '#lib/library.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let playlists = $state<any[]>([]);
	let sample = $state(false);
	let needsAuth = $state(false);
	let loading = $state(true);
	let errorMsg = $state('');
	let selected = $state<string | null>(null);
	let items = $state<any[]>([]);
	let loadingItems = $state(false);
	const lang = $derived(getLibrary().lang);

	$effect(() => {
		let cancelled = false;
		loading = true;
		fetch('/api/youtube/playlists')
			.then(async (r) => {
				if (!r.ok) throw new Error((await r.text()).slice(0, 400));
				return r.json();
			})
			.then((d) => {
				if (cancelled) return;
				playlists = d.items ?? [];
				sample = !!d.sample;
				needsAuth = !!d.needsAuth;
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

	async function openPlaylist(id: string) {
		selected = id;
		loadingItems = true;
		items = [];
		try {
			const res = await fetch(`/api/youtube/playlists/${id}`);
			if (!res.ok) throw new Error((await res.text()).slice(0, 400));
			const d = await res.json();
			items = d.items ?? [];
		} catch (e) {
			errorMsg = e instanceof Error ? e.message : t(lang, 'errorLoad');
		} finally {
			loadingItems = false;
		}
	}
</script>

<main class="page-enter mx-auto max-w-6xl px-4 pb-8 lg:px-6">
	<div class="flex flex-wrap items-start justify-between gap-3">
		<div>
			<h1 class="font-display text-2xl font-bold">{t(lang, 'yourPlaylists')}</h1>
			<p class="mt-1 text-sm opacity-55">Google · YouTube Data API (readonly)</p>
		</div>
		{#if data.user}
			<a href="/auth/logout" class="btn btn-ghost btn-sm rounded-full">{t(lang, 'signOut')}</a>
		{:else if data.googleConfigured}
			<a href="/auth/google" class="btn btn-primary btn-sm rounded-full">{t(lang, 'signInGoogle')}</a>
		{/if}
	</div>

	{#if !data.googleConfigured}
		<div class="alert mt-4 border border-primary/20 bg-primary/10 text-sm">
			{t(lang, 'googleNeeded')}
		</div>
	{/if}

	{#if sample}
		<div class="badge badge-warning mt-4">{t(lang, 'sampleData')}</div>
	{/if}

	{#if needsAuth && data.googleConfigured}
		<div class="mt-6 rounded-2xl bg-base-100/70 p-6 text-center">
			<p class="mb-4 opacity-70">{t(lang, 'signInGoogle')}</p>
			<a href="/auth/google" class="btn btn-primary rounded-full">{t(lang, 'signInGoogle')}</a>
		</div>
	{/if}

	{#if errorMsg}
		<div class="alert alert-error mt-4 text-sm">{errorMsg}</div>
	{/if}

	{#if loading}
		<div class="mt-6 space-y-3">
			{#each Array(3) as _}
				<div class="skeleton h-16 rounded-2xl"></div>
			{/each}
		</div>
	{:else}
		<div class="mt-6 space-y-2">
			{#each playlists as pl}
				<button
					class="flex w-full items-center justify-between rounded-2xl bg-base-100/70 px-4 py-3 text-left transition hover:bg-base-100"
					onclick={() => openPlaylist(pl.id)}
				>
					<div>
						<div class="font-semibold">{pl.snippet?.title ?? pl.id}</div>
						<div class="text-sm opacity-55">
							{pl.contentDetails?.itemCount ?? '—'} · {pl.snippet?.description?.slice(0, 60) ?? ''}
						</div>
					</div>
					<span class="opacity-40">→</span>
				</button>
			{/each}
		</div>
	{/if}

	{#if selected}
		<section class="mt-8">
			<h2 class="font-display mb-3 text-lg font-bold">Playlist</h2>
			{#if loadingItems}
				<div class="skeleton h-24 rounded-2xl"></div>
			{:else if items.length === 0}
				<p class="opacity-55">{t(lang, 'emptyPlaylist')}</p>
			{:else}
				<div class="space-y-2">
					{#each items as v}
						<a href="/watch/{v.videoId}" class="flex gap-3 rounded-xl bg-base-100/60 p-2">
							{#if v.videoThumbnails?.[0]?.url}
								<img
									src={v.videoThumbnails[0].url}
									alt=""
									class="h-16 w-28 rounded-lg object-cover"
								/>
							{/if}
							<div>
								<div class="line-clamp-2 text-sm font-semibold">{v.title}</div>
								<div class="text-xs opacity-55">{v.author}</div>
							</div>
						</a>
					{/each}
				</div>
			{/if}
		</section>
	{/if}
</main>
