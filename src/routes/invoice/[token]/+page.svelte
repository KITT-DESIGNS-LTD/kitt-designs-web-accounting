<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import InvoiceView from '$lib/components/InvoiceView.svelte';
	import LocalTime from '$lib/components/LocalTime.svelte';
	import SignatureField from '$lib/components/SignatureField.svelte';
	import { ROLE_LABELS, SIGNATURE_ROLES, type SignatureDrafts } from '$lib/invoice';

	let { data } = $props();

	const record = $derived(data.record);
	const missing = $derived(SIGNATURE_ROLES.filter((role) => !record.signatures[role]));

	let drafts = $state<SignatureDrafts>({});
	let link = $state('');
	let copied = $state(false);
	let canShare = $state(false);
	let saving = $state(false);
	let failure = $state('');

	const hasDraft = $derived(missing.some((role) => drafts[role]));

	onMount(() => {
		link = location.href;
		canShare = typeof navigator.share === 'function';
	});

	async function copyLink() {
		try {
			await navigator.clipboard.writeText(link);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			// Clipboard blocked: the link stays selectable in the field.
		}
	}

	function shareLink() {
		navigator
			.share({ title: `Invoice ${record.invoice.number}`, url: link })
			.catch(() => {}); // dismissed
	}

	async function sign() {
		failure = '';
		const unnamed = missing.find((role) => drafts[role] && !drafts[role].name);
		if (unnamed) {
			failure = `Enter the name of the person signing as ${ROLE_LABELS[unnamed].toLowerCase()}.`;
			return;
		}

		saving = true;
		try {
			const response = await fetch(resolve('/api/invoices/[token]', { token: record.token }), {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ signatures: drafts })
			});
			const result = await response.json().catch(() => ({}));
			if (!response.ok) {
				// 409: someone else signed in the meantime, so show the latest state.
				if (response.status === 409) await invalidateAll();
				throw new Error(result.message || 'Could not save the invoice.');
			}
			drafts = {};
			await invalidateAll();
		} catch (err) {
			failure = err instanceof TypeError ? 'No connection. Try again.' : (err as Error).message;
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>Invoice {record.invoice.number}</title>
</svelte:head>

<div class="page">
	<section class="card status">
		<div class="status-head">
			<h1>Invoice {record.invoice.number}</h1>
			<span class="badge {record.status}">
				{record.status === 'completed' ? 'Completed' : 'Partial'}
			</span>
		</div>

		{#if record.status === 'completed'}
			<p>
				Signed by both parties and saved. This link works until
				<LocalTime iso={record.expiresAt} />.
			</p>
		{:else}
			<p>
				Waiting for the {missing.map((role) => ROLE_LABELS[role].toLowerCase()).join(' and ')}
				to sign. Share this link with the other party: it works until
				<LocalTime iso={record.expiresAt} />. If the invoice is still partial by then, it is deleted.
			</p>
		{/if}

		<div class="share">
			<input readonly value={link} aria-label="Link to this invoice" onfocus={(event) => event.currentTarget.select()} />
			<button type="button" class="btn" onclick={copyLink}>{copied ? 'Copied' : 'Copy link'}</button>
			{#if canShare}
				<button type="button" class="btn" onclick={shareLink}>Share</button>
			{/if}
			<a class="btn" href={resolve('/invoice/[token]/pdf', { token: record.token })} download>Download PDF</a>
		</div>
	</section>

	<InvoiceView invoice={record.invoice} />

	<section class="card signatures">
		<h2>Signatures</h2>
		<div class="fields">
			{#each SIGNATURE_ROLES as role (role)}
				<SignatureField
					label={ROLE_LABELS[role]}
					signed={record.signatures[role]}
					bind:draft={drafts[role]}
				/>
			{/each}
		</div>

		{#if failure}
			<p class="notice error" role="alert">{failure}</p>
		{/if}

		{#if missing.length}
			<div class="actions">
				<button type="button" class="btn primary" onclick={sign} disabled={saving || !hasDraft}>
					{saving ? 'Saving…' : 'Sign and save'}
				</button>
			</div>
		{/if}
	</section>
</div>

<style>
	.page {
		display: grid;
		gap: 1rem;
	}

	.status {
		display: grid;
		gap: 0.75rem;
	}

	.status-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
	}

	h1 {
		font-size: 1.35rem;
		overflow-wrap: anywhere;
	}

	h2 {
		font-size: 1.1rem;
	}

	.badge {
		padding: 0.15rem 0.6rem;
		border-radius: 999px;
		font-size: 0.8rem;
		font-weight: 700;
		background: #fff3d6;
		color: #8a5a00;
	}

	.badge.completed {
		background: #dcf5e7;
		color: var(--success);
	}

	.share {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.share input {
		flex: 1 1 16rem;
	}

	.signatures {
		display: grid;
		gap: 1rem;
	}

	.fields {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
		gap: 1.5rem;
	}
</style>
