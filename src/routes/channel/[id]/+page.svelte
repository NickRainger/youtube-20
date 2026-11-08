<script lang="ts">
	import { page } from '$app/state';
	import VideoCard from '#lib/components/VideoCard.svelte';
	import { bestThumb } from '#lib/format';
	import { getLibrary, isSubscribed, toggleSub } from '#lib/library.svelte';
	import { t } from '#lib/i18n';
	import { descriptionToPlainText } from '#lib/sanitize';

	let channel = $state<any>(null);
	let videos = $state<any[]>([]);
	let loading = $state(true);
	let errorMsg = $state('');
	const lang = $derived(getLibrary().lang);
	const id = $derived(page.params.id);

	$effect(() => {
		const channelId = id;
		if (!channelId) return;
		let cancelled = false;
		loading = true;
		fetch(`/api/channels/${channelId}`)
			.then(async (r) => {
				if (!r.ok) throw new Error((await r.text()).slice(0, 400));
				return r.json();
			})
			.then((data) => {
				if (cancelled) return;
				channel = data.channel;
				videos = data.videos ?? [];
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

{#if channel?.authorBanners?.[0]}
	<img
		src={bestThumb(channel.authorBanners, 800)}
		alt=""
		class="aspect-[6/1] w-full object-cover"
	/>
{:else}
	<div class="skeleton aspect-[6/1] w-full rounded-none"></div>
{/if}

<main class="page-enter mx-auto max-w-6xl px-4 pb-8 lg:px-6">
	{#if errorMsg}
		<div class="alert alert-error my-4 text-sm">{errorMsg}</div>
	{/if}

	{#if channel}
		<div class="relative z-10 -mt-8 mb-6 flex items-center gap-4">
			<img
				src={bestThumb(channel.authorThumbnails, 176) || undefined}
				alt=""
				class="h-18 w-18 h-[4.5rem] w-[4.5rem] rounded-full border-4 border-base-200 bg-base-300 object-cover shadow-lg"
			/>
			<div class="min-w-0 flex-1">
				<h1 class="font-display text-2xl font-bold">{channel.author}</h1>
				<p class="text-sm opacity-55">{channel.subCount ?? ''} {t(lang, 'subscribers')}</p>
			</div>
			<button
				class="btn btn-sm rounded-full {isSubscribed(channel.authorId) ? 'btn-ghost' : 'btn-primary'}"
				onclick={() =>
					toggleSub({
						authorId: channel.authorId,
						author: channel.author,
						authorThumb: bestThumb(channel.authorThumbnails, 88)
					})}
			>
				{isSubscribed(channel.authorId) ? t(lang, 'subscribed') : t(lang, 'subscribe')}
			</button>
		</div>
		{#if channel.description}
			{@const plain = descriptionToPlainText(channel.description)}
			<p class="mb-6 max-w-prose text-sm opacity-65">
				{plain.slice(0, 280)}{plain.length > 280 ? '…' : ''}
			</p>
		{/if}
	{/if}

	<div class="mb-4 flex items-baseline justify-between">
		<h2 class="font-display text-xl font-bold">{t(lang, 'videos')}</h2>
		<span class="text-sm opacity-50">{t(lang, 'shortsFiltered')}</span>
	</div>

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
