<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import InvoiceEditor from '$lib/components/InvoiceEditor.svelte';
	import SignatureField from '$lib/components/SignatureField.svelte';
	import {
		blankInvoice,
		LINK_TTL_HOURS,
		ROLE_LABELS,
		SIGNATURE_ROLES,
		type SignatureDrafts
	} from '$lib/invoice';

	// The invoice being written survives reloads in this tab until it is saved.
	const DRAFT_KEY = 'invoice-draft';

	let invoice = $state(blankInvoice(''));
	let drafts = $state<SignatureDrafts>({});
	let restored = $state(false);
	let saving = $state(false);
	let failure = $state('');

	function today(): string {
		const now = new Date();
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
	}

	onMount(() => {
		invoice = blankInvoice(today());
		try {
			const stored = sessionStorage.getItem(DRAFT_KEY);
			if (stored) invoice = { ...invoice, ...JSON.parse(stored) };
		} catch {
			// No usable draft: start blank.
		}
		restored = true;
	});

	$effect(() => {
		if (!restored) return;
		try {
			sessionStorage.setItem(DRAFT_KEY, JSON.stringify(invoice));
		} catch {
			// Storage unavailable: the draft just won't survive a reload.
		}
	});

	function startOver() {
		if (!confirm('Clear everything on this invoice?')) return;
		invoice = blankInvoice(today());
		failure = '';
	}

	async function save() {
		failure = '';
		const unnamed = SIGNATURE_ROLES.find((role) => drafts[role] && !drafts[role].name);
		if (unnamed) {
			failure = `Enter the name of the person signing as ${ROLE_LABELS[unnamed].toLowerCase()}.`;
			return;
		}

		saving = true;
		try {
			const response = await fetch(resolve('/api/invoices'), {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ invoice, signatures: drafts })
			});
			const result = await response.json().catch(() => ({}));
			if (!response.ok) throw new Error(result.message || 'Could not save the invoice.');
			restored = false; // stop re-saving the draft
			sessionStorage.removeItem(DRAFT_KEY);
			await goto(resolve('/invoice/[token]', { token: result.token }));
		} catch (err) {
			failure = err instanceof TypeError ? 'No connection. Try again.' : (err as Error).message;
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>New invoice</title>
</svelte:head>

<form
	class="page"
	onsubmit={(event) => {
		event.preventDefault();
		save();
	}}
>
	<InvoiceEditor bind:invoice />

	<section class="card signatures">
		<div>
			<h2>Signatures</h2>
			<p class="muted small">
				Sign your side now. The other party signs from the link you get after saving.
			</p>
		</div>
		<div class="fields">
			{#each SIGNATURE_ROLES as role (role)}
				<SignatureField label={ROLE_LABELS[role]} bind:draft={drafts[role]} />
			{/each}
		</div>
	</section>

	{#if failure}
		<p class="notice error" role="alert">{failure}</p>
	{/if}

	<div class="actions">
		<button type="submit" class="btn primary" disabled={saving}>
			{saving ? 'Saving…' : 'Save invoice'}
		</button>
		<button type="button" class="btn" onclick={startOver} disabled={saving}>Start over</button>
		<span class="muted small">
			Saved to Google Drive with a share link that works for {LINK_TTL_HOURS} hours.
		</span>
	</div>
</form>

<style>
	.page {
		display: grid;
		gap: 1rem;
	}

	.signatures {
		display: grid;
		gap: 1rem;
	}

	h2 {
		font-size: 1.1rem;
	}

	.fields {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
		gap: 1.5rem;
	}
</style>
