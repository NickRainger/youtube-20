<script lang="ts">
	import { onMount } from 'svelte';
	import VideoCard from '#lib/components/VideoCard.svelte';
	import { getLibrary } from '#lib/library.svelte';
	import { t } from '#lib/i18n';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type Source = 'foryou' | 'trending' | 'popular';

	let videos = $state<any[]>([]);
	let loading = $state(true);
	let errorMsg = $state('');
	let source = $state<Source>('foryou');
	let feedMeta = $state<{ needsAuth?: boolean; feedSource?: string }>({});
	const lang = $derived(getLibrary().lang);

	async function load(next: Source = source) {
		source = next;
		loading = true;
		errorMsg = '';
		feedMeta = {};
		try {
			if (next === 'foryou') {
				const seed = getLibrary().history[0]?.videoId;
				const qs = seed ? `?seed=${encodeURIComponent(seed)}` : '';
				const res = await fetch(`/api/youtube/feed${qs}`);
				if (!res.ok) throw new Error((await res.text()).slice(0, 400));
				const body = await res.json();
				videos = body.videos ?? [];
				feedMeta = { needsAuth: body.needsAuth, feedSource: body.source };
				// Logged out + empty: soft-fallback to trending so home isn’t blank
				if (!videos.length && body.needsAuth) {
					const tr = await fetch('/api/trending?region=NL');
					if (tr.ok) {
						const td = await tr.json();
						videos = td.videos ?? [];
						feedMeta = { needsAuth: true, feedSource: 'trending-fallback' };
					}
				}
			} else {
				const path = next === 'trending' ? '/api/trending?region=NL' : '/api/popular';
				const res = await fetch(path);
				if (!res.ok) throw new Error((await res.text()).slice(0, 400));
				const body = await res.json();
				videos = body.videos ?? [];
			}
		} catch (e) {
			errorMsg = e instanceof Error ? e.message : t(lang, 'errorLoad');
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		void load('foryou');
	});
</script>

<main class="page-enter mx-auto max-w-6xl px-4 pb-8 lg:px-6">
	<section class="hero-glow relative overflow-hidden py-8">
		<h1 class="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">YouTube 2.0</h1>
		<p class="mt-3 max-w-md text-lg opacity-70">{t(lang, 'tagline')}</p>
		<p class="mt-3 inline-flex items-center gap-2 text-sm font-semibold opacity-55">
			<span class="inline-block h-1.5 w-1.5 rounded-full bg-primary"></span>
			{t(lang, 'privacyNote')}
		</p>
	</section>

	<form class="mb-4 flex gap-2" action="/search" method="GET">
		<input
			class="input input-bordered flex-1 rounded-full"
			name="q"
			placeholder={t(lang, 'searchPlaceholder')}
			autocomplete="off"
		/>
		<button class="btn btn-primary rounded-full px-6">{t(lang, 'searchBtn')}</button>
	</form>

	<div class="mb-4 flex gap-2 overflow-x-auto">
		<button
			class="btn btn-sm rounded-full {source === 'foryou' ? 'btn-neutral' : 'btn-ghost'}"
			onclick={() => load('foryou')}>{t(lang, 'forYou')}</button
		>
		<button
			class="btn btn-sm rounded-full {source === 'trending' ? 'btn-neutral' : 'btn-ghost'}"
			onclick={() => load('trending')}>{t(lang, 'regionNL')}</button
		>
		<button
			class="btn btn-sm rounded-full {source === 'popular' ? 'btn-neutral' : 'btn-ghost'}"
			onclick={() => load('popular')}>{t(lang, 'popular')}</button
		>
	</div>

	<div class="mb-4 flex flex-wrap items-baseline justify-between gap-2">
		<h2 class="font-display text-xl font-bold">
			{source === 'foryou'
				? t(lang, 'forYou')
				: source === 'trending'
					? t(lang, 'trending')
					: t(lang, 'popular')}
		</h2>
		<span class="text-sm opacity-50">{t(lang, 'shortsFiltered')}</span>
	</div>

	{#if source === 'foryou'}
		<p class="mb-4 text-sm opacity-60">{t(lang, 'forYouHint')}</p>
		{#if feedMeta.needsAuth && !data.user}
			<div class="alert mb-4 text-sm">
				<span>{t(lang, 'forYouSignIn')}</span>
				<a class="btn btn-sm btn-primary rounded-full" href="/auth/google">{t(lang, 'signInGoogle')}</a>
			</div>
		{/if}
	{/if}

	{#if errorMsg}
		<div class="alert alert-error mb-4 whitespace-pre-wrap text-sm">{errorMsg}</div>
	{/if}

	{#if loading}
		<div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
			{#each Array(6) as _}
				<div class="skeleton aspect-video rounded-2xl"></div>
			{/each}
		</div>
	{:else}
		<div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
			{#each videos as video, i}
				<VideoCard {video} {lang} index={i} />
			{/each}
		</div>
	{/if}
</main>
