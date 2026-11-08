<script lang="ts">
	import VideoCard from '#lib/components/VideoCard.svelte';
	import { clearHistory, getLibrary } from '#lib/library.svelte';
	import { t } from '#lib/i18n';

	let tab = $state<'history' | 'saved'>('history');
	const lib = $derived(getLibrary());
	const lang = $derived(lib.lang);
	const list = $derived(tab === 'history' ? lib.history : lib.saved);
</script>

<main class="page-enter mx-auto max-w-6xl px-4 pb-8 lg:px-6">
	<h1 class="font-display text-2xl font-bold">{t(lang, 'library')}</h1>
	<p class="mt-1 text-sm opacity-55">{t(lang, 'localLibrary')}</p>

	<div class="mt-5 mb-5 flex gap-2">
		<button
			class="btn btn-sm rounded-full {tab === 'history' ? 'btn-neutral' : 'btn-ghost'}"
			onclick={() => (tab = 'history')}>{t(lang, 'history')}</button
		>
		<button
			class="btn btn-sm rounded-full {tab === 'saved' ? 'btn-neutral' : 'btn-ghost'}"
			onclick={() => (tab = 'saved')}>{t(lang, 'saved')}</button
		>
		{#if tab === 'history' && lib.history.length}
			<button class="btn btn-sm btn-ghost ml-auto rounded-full" onclick={clearHistory}
				>{t(lang, 'clearHistory')}</button
			>
		{/if}
	</div>

	{#if list.length === 0}
		<p class="py-16 text-center opacity-50">
			{tab === 'history' ? t(lang, 'noHistory') : t(lang, 'noSaved')}
		</p>
	{:else}
		<div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
			{#each list as video, i}
				<VideoCard {video} {lang} index={i} />
			{/each}
		</div>
	{/if}
</main>
