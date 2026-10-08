<script lang="ts">
	import { resolve } from '$app/paths';
	import '../app.css';
	import { branding, logoDataUrl } from '$lib/branding';

	let { data, children } = $props();
</script>

<svelte:head>
	<title>{branding.companyName} Accounting</title>
</svelte:head>

<div class="app" style:--accent={branding.accentColor} style:--ink={branding.inkColor}>
	<header>
		<a class="brand" href={resolve('/')}>
			<img src={logoDataUrl} alt="" width="32" height="32" />
			<span>{branding.companyName}</span>
		</a>
	</header>

	{#if data.storageKind === 'local'}
		<p class="dev-banner">
			Google Drive is not configured: files are being saved to <code>.local-drive</code> on the server.
		</p>
	{/if}

	<main>
		{@render children()}
	</main>
</div>

<style>
	.app {
		color: var(--ink);
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
	}

	header {
		background: var(--surface);
		border-bottom: 1px solid var(--border);
		padding: 0.65rem max(1rem, env(safe-area-inset-left));
	}

	.brand {
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		font-weight: 700;
		font-size: 1.05rem;
		color: var(--ink);
		text-decoration: none;
	}

	.brand img {
		display: block;
	}

	.dev-banner {
		padding: 0.5rem 1rem;
		background: #fff7e0;
		border-bottom: 1px solid #f0d58a;
		color: #7a5600;
		font-size: 0.875rem;
		text-align: center;
	}

	main {
		width: 100%;
		max-width: 980px;
		margin: 0 auto;
		padding: 1.25rem 1rem calc(3rem + env(safe-area-inset-bottom));
		flex: 1;
	}
</style>
