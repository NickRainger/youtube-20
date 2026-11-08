<script lang="ts">
	import { page } from '$app/state';
	import { t, type Lang } from '#lib/i18n';

	let { lang }: { lang: Lang } = $props();

	const items = $derived([
		{ href: '/', label: t(lang, 'home'), match: (p: string) => p === '/' },
		{ href: '/search', label: t(lang, 'search'), match: (p: string) => p.startsWith('/search') },
		{
			href: '/subscriptions',
			label: t(lang, 'subs'),
			match: (p: string) => p.startsWith('/subscriptions')
		},
		{
			href: '/playlists',
			label: t(lang, 'playlists'),
			match: (p: string) => p.startsWith('/playlists')
		},
		{ href: '/library', label: t(lang, 'library'), match: (p: string) => p.startsWith('/library') }
	]);
</script>

<nav class="bottom-nav" aria-label="Main">
	{#each items as item}
		<a href={item.href} class:active={item.match(page.url.pathname)}>
			{#if item.href === '/'}
				<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
					><path
						d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z"
						stroke-linejoin="round"
					/></svg
				>
			{:else if item.href === '/search'}
				<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
					><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" stroke-linecap="round" /></svg
				>
			{:else if item.href === '/subscriptions'}
				<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
					><rect x="3" y="6" width="18" height="13" rx="2" /><path
						d="M8 3h8M10 11l5 3-5 3v-6z"
						stroke-linecap="round"
						stroke-linejoin="round"
					/></svg
				>
			{:else if item.href === '/playlists'}
				<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
					><path d="M4 6h12M4 12h12M4 18h8M18 9l4 3-4 3V9z" stroke-linejoin="round" /></svg
				>
			{:else}
				<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
					><path d="M4 5h3v14H4zM9 5h3v14H9zM14 7.5 21 12l-7 4.5v-9z" stroke-linejoin="round" /></svg
				>
			{/if}
			{item.label}
		</a>
	{/each}
</nav>
