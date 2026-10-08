<script lang="ts">
	import './invoice.css';
	import { branding, logoDataUrl } from '$lib/branding';
	import {
		adjustmentLabel,
		computeTotals,
		formatDate,
		formatMoney,
		formatQuantity,
		type Invoice
	} from '$lib/invoice';

	let { invoice }: { invoice: Invoice } = $props();

	const totals = $derived(computeTotals(invoice));
	const money = (amount: number) => formatMoney(amount, invoice.currency);
</script>

<section class="inv" aria-label="Invoice">
	<div class="inv-head">
		<div class="inv-brand">
			<img src={logoDataUrl} alt="" />
			<span>{branding.companyName}</span>
		</div>
		<div class="inv-title">
			<h2>INVOICE</h2>
			<span class="inv-number"># {invoice.number}</span>
		</div>
	</div>

	<div class="inv-top">
		<div class="inv-parties">
			<div class="inv-party">
				<span class="inv-label">From</span>
				<span class="inv-name">{invoice.from.name}</span>
				<span class="inv-text">{invoice.from.details}</span>
			</div>
			<div class="inv-party">
				<span class="inv-label">Bill to</span>
				<span class="inv-name">{invoice.to.name}</span>
				<span class="inv-text">{invoice.to.details}</span>
			</div>
			{#if invoice.shipTo}
				<div class="inv-party wide">
					<span class="inv-label">Ship to</span>
					<span class="inv-text">{invoice.shipTo}</span>
				</div>
			{/if}
		</div>

		<div class="inv-meta">
			<div class="inv-meta-row"><span>Date</span><span>{formatDate(invoice.date)}</span></div>
			{#if invoice.paymentTerms}
				<div class="inv-meta-row"><span>Payment terms</span><span>{invoice.paymentTerms}</span></div>
			{/if}
			{#if invoice.dueDate}
				<div class="inv-meta-row"><span>Due date</span><span>{formatDate(invoice.dueDate)}</span></div>
			{/if}
			{#if invoice.poNumber}
				<div class="inv-meta-row"><span>PO number</span><span>{invoice.poNumber}</span></div>
			{/if}
			<div class="inv-meta-row inv-balance">
				<span>Balance due</span><span>{money(totals.balance)}</span>
			</div>
		</div>
	</div>

	<div class="inv-items">
		<div class="inv-items-head" aria-hidden="true">
			<span>Item</span>
			<span>Quantity</span>
			<span>Rate</span>
			<span>Amount</span>
		</div>
		{#each invoice.items as item, i (i)}
			<div class="inv-item">
				<div class="description inv-text">{item.description}</div>
				<div class="right">
					<span class="field-label small muted">Quantity </span>{formatQuantity(item.quantity)}
				</div>
				<div class="right">
					<span class="field-label small muted">Rate </span>{money(item.rate)}
				</div>
				<div class="amount">
					<span class="field-label small muted">Amount</span>
					<span>{money(totals.lineAmounts[i])}</span>
				</div>
			</div>
		{/each}
	</div>

	<div class="inv-bottom">
		<div class="inv-notes">
			{#if invoice.notes}
				<div class="inv-field">
					<span class="inv-label">Notes</span>
					<span class="inv-text">{invoice.notes}</span>
				</div>
			{/if}
			{#if invoice.terms}
				<div class="inv-field">
					<span class="inv-label">Terms</span>
					<span class="inv-text">{invoice.terms}</span>
				</div>
			{/if}
		</div>

		<div class="inv-totals">
			<div class="inv-total-row"><span>Subtotal</span><span>{money(totals.subtotal)}</span></div>
			{#if totals.discount}
				<div class="inv-total-row">
					<span>{adjustmentLabel('Discount', invoice.discount)}</span>
					<span>-{money(totals.discount)}</span>
				</div>
			{/if}
			{#if totals.tax}
				<div class="inv-total-row">
					<span>{adjustmentLabel('Tax', invoice.tax)}</span>
					<span>{money(totals.tax)}</span>
				</div>
			{/if}
			{#if totals.shipping}
				<div class="inv-total-row"><span>Shipping</span><span>{money(totals.shipping)}</span></div>
			{/if}
			<div class="inv-total-row strong"><span>Total</span><span>{money(totals.total)}</span></div>
			{#if totals.amountPaid}
				<div class="inv-total-row">
					<span>Amount paid</span><span>{money(totals.amountPaid)}</span>
				</div>
			{/if}
			<div class="inv-total-row inv-balance">
				<span>Balance due</span><span>{money(totals.balance)}</span>
			</div>
		</div>
	</div>
</section>
