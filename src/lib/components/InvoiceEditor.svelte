<script lang="ts">
	import './invoice.css';
	import { branding, logoDataUrl } from '$lib/branding';
	import { blankItem, computeTotals, formatMoney, type Invoice, type Party } from '$lib/invoice';

	let { invoice = $bindable() }: { invoice: Invoice } = $props();

	const totals = $derived(computeTotals(invoice));
	const money = (amount: number) => formatMoney(amount, invoice.currency);
	const currencies = Intl.supportedValuesOf('currency');

	function useCompany(party: Party) {
		party.name = branding.companyName;
		party.details = branding.companyDetails;
	}
</script>

<section class="inv inv-editor" aria-label="Invoice">
	<div class="inv-head">
		<div class="inv-brand">
			<img src={logoDataUrl} alt="" />
			<span>{branding.companyName}</span>
		</div>
		<div class="inv-title">
			<h1>INVOICE</h1>
			<label class="inv-number">
				<span aria-hidden="true">#</span>
				<input bind:value={invoice.number} maxlength="40" placeholder="Invoice number" aria-label="Invoice number" />
			</label>
		</div>
	</div>

	<div class="inv-top">
		<div class="inv-parties">
			<div class="inv-party">
				<div class="inv-party-head">
					<label class="inv-label" for="from-name">From</label>
					<button type="button" class="link-btn" onclick={() => useCompany(invoice.from)}>
						Use {branding.companyName}
					</button>
				</div>
				<input id="from-name" bind:value={invoice.from.name} maxlength="120" placeholder="Who is this from?" />
				<textarea
					bind:value={invoice.from.details}
					class="party-details"
					rows="4"
					maxlength="600"
					placeholder="Address and contact details"
					aria-label="From: address and contact details"
				></textarea>
			</div>

			<div class="inv-party">
				<div class="inv-party-head">
					<label class="inv-label" for="to-name">Bill to</label>
					<button type="button" class="link-btn" onclick={() => useCompany(invoice.to)}>
						Use {branding.companyName}
					</button>
				</div>
				<input id="to-name" bind:value={invoice.to.name} maxlength="120" placeholder="Who is this to?" />
				<textarea
					bind:value={invoice.to.details}
					class="party-details"
					rows="4"
					maxlength="600"
					placeholder="Address and contact details"
					aria-label="Bill to: address and contact details"
				></textarea>
			</div>
		</div>

		<label class="inv-party ship-to">
			<span class="inv-label">Ship to (optional)</span>
			<textarea bind:value={invoice.shipTo} rows="2" maxlength="600"></textarea>
		</label>

		<div class="inv-meta">
			<label class="inv-meta-row">
				<span>Date</span>
				<input type="date" bind:value={invoice.date} />
			</label>
			<label class="inv-meta-row">
				<span>Payment terms</span>
				<input bind:value={invoice.paymentTerms} maxlength="100" />
			</label>
			<label class="inv-meta-row">
				<span>Due date</span>
				<input type="date" bind:value={invoice.dueDate} />
			</label>
			<label class="inv-meta-row">
				<span>PO number</span>
				<input bind:value={invoice.poNumber} maxlength="60" />
			</label>
			<label class="inv-meta-row">
				<span>Currency</span>
				<select bind:value={invoice.currency}>
					{#each currencies as currency (currency)}
						<option>{currency}</option>
					{/each}
				</select>
			</label>
		</div>
	</div>

	<div class="inv-items">
		<div class="inv-items-head" aria-hidden="true">
			<span>Item</span>
			<span>Quantity</span>
			<span>Rate</span>
			<span>Amount</span>
			<span></span>
		</div>
		{#each invoice.items as item, i (item)}
			<div class="inv-item editable">
				<label class="description">
					<span class="field-label small muted">Description</span>
					<input bind:value={item.description} maxlength="500" placeholder="Description of item or service" />
				</label>
				<label>
					<span class="field-label small muted">Quantity</span>
					<input type="number" inputmode="decimal" step="any" bind:value={item.quantity} />
				</label>
				<label>
					<span class="field-label small muted">Rate</span>
					<input type="number" inputmode="decimal" step="any" bind:value={item.rate} />
				</label>
				<div class="amount">
					<span class="field-label small muted">Amount</span>
					<span>{money(totals.lineAmounts[i])}</span>
				</div>
				<button
					type="button"
					class="remove"
					onclick={() => invoice.items.splice(i, 1)}
					disabled={invoice.items.length === 1}
					aria-label="Remove line {i + 1}"
				>
					&times;
				</button>
			</div>
		{/each}
		<div>
			<button type="button" class="link-btn" onclick={() => invoice.items.push(blankItem())}>
				+ Add line item
			</button>
		</div>
	</div>

	<div class="inv-bottom">
		<div class="inv-notes">
			<label class="inv-field">
				<span class="inv-label">Notes</span>
				<textarea
					bind:value={invoice.notes}
					rows="3"
					maxlength="2000"
					placeholder="Anything the recipient should know"
				></textarea>
			</label>
			<label class="inv-field">
				<span class="inv-label">Terms</span>
				<textarea
					bind:value={invoice.terms}
					rows="3"
					maxlength="2000"
					placeholder="Payment instructions, late fees, delivery terms"
				></textarea>
			</label>
		</div>

		<div class="inv-totals">
			<div class="inv-total-row">
				<span>Subtotal</span>
				<span>{money(totals.subtotal)}</span>
			</div>
			<div class="inv-total-row">
				<label for="discount">Discount</label>
				<div class="inv-adjust">
					<input id="discount" type="number" inputmode="decimal" step="any" min="0" bind:value={invoice.discount.value} />
					<select bind:value={invoice.discount.type} aria-label="Discount type">
						<option value="percent">%</option>
						<option value="flat">{invoice.currency}</option>
					</select>
				</div>
			</div>
			<div class="inv-total-row">
				<label for="tax">Tax</label>
				<div class="inv-adjust">
					<input id="tax" type="number" inputmode="decimal" step="any" min="0" bind:value={invoice.tax.value} />
					<select bind:value={invoice.tax.type} aria-label="Tax type">
						<option value="percent">%</option>
						<option value="flat">{invoice.currency}</option>
					</select>
				</div>
			</div>
			<div class="inv-total-row">
				<label for="shipping">Shipping</label>
				<input id="shipping" type="number" inputmode="decimal" step="any" min="0" bind:value={invoice.shipping} />
			</div>
			<div class="inv-total-row strong">
				<span>Total</span>
				<span>{money(totals.total)}</span>
			</div>
			<div class="inv-total-row">
				<label for="amount-paid">Amount paid</label>
				<input id="amount-paid" type="number" inputmode="decimal" step="any" min="0" bind:value={invoice.amountPaid} />
			</div>
			<div class="inv-total-row inv-balance">
				<span>Balance due</span>
				<span>{money(totals.balance)}</span>
			</div>
		</div>
	</div>
</section>

<style>
	/* Address boxes keep a fixed size and scroll rather than growing. */
	.party-details {
		field-sizing: fixed;
		resize: none;
		overflow-y: auto;
	}

	@media (min-width: 720px) {
		/* Ship to drops below the parties so the parties row is exactly as
		   tall as the meta column; the address boxes then fill the rest of
		   it and end in line with the currency field. */
		.inv-top {
			grid-template-rows: auto auto;
		}

		.inv-meta {
			grid-column: 2;
			grid-row: 1;
		}

		.ship-to {
			grid-column: 1;
		}

		.inv-parties {
			align-content: stretch;
		}

		.inv-party:has(.party-details) {
			grid-template-rows: auto auto 1fr;
		}

		.party-details {
			height: 100%;
		}
	}
</style>
