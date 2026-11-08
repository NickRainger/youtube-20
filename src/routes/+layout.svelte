<script lang="ts">
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import { page } from '$app/state';
	import BottomNav from '#lib/components/BottomNav.svelte';
	import { getLibrary, hydrateLibrary, setLang } from '#lib/library.svelte';
	import { onMount } from 'svelte';
	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();

	onMount(() => {
		hydrateLibrary();
		document.documentElement.lang = getLibrary().lang;
	});

	const lang = $derived(getLibrary().lang);
	const watchMode = $derived(page.url.pathname.startsWith('/watch/'));
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Syne:wght@600;700;800&display=swap"
		rel="stylesheet"
	/>
	<meta name="theme-color" content="#e11d2e" />
	<meta name="description" content="YouTube 2.0 — soepel kijken zonder Shorts en zonder advertenties" />
	<link rel="apple-touch-icon" href="/icons/icon-192.png" />
	<title>YouTube 2.0</title>
</svelte:head>

<div class="app-shell" class:watch-mode={watchMode} data-theme="yt20">
	<header class="navbar mx-auto max-w-6xl px-3 pt-2 lg:px-6">
		<div class="flex-1">
			<a href="/" class="font-display text-lg font-extrabold tracking-tight">
				<span class="inline-flex items-center gap-2">
					<span class="grid h-8 w-8 place-items-center rounded-xl bg-primary text-primary-content shadow-lg shadow-primary/30"
						>▶</span
					>
					YouTube 2.0
				</span>
			</a>
		</div>
		<div class="flex items-center gap-2">
			<select
				class="select select-bordered select-sm"
				value={lang}
				onchange={(e) => setLang(e.currentTarget.value as 'nl' | 'en')}
				aria-label="Language"
			>
				<option value="nl">NL</option>
				<option value="en">EN</option>
			</select>
			{#if data.user}
				<div class="hidden items-center gap-2 sm:flex">
					{#if data.user.picture}
						<img src={data.user.picture} alt="" class="h-8 w-8 rounded-full" />
					{/if}
					<a href="/auth/logout" class="btn btn-ghost btn-sm">Out</a>
				</div>
			{:else if data.googleConfigured}
				<a href="/auth/google" class="btn btn-primary btn-sm hidden sm:inline-flex">Google</a>
			{/if}
		</div>
	</header>

	{@render children()}
	<BottomNav {lang} />
</div>
