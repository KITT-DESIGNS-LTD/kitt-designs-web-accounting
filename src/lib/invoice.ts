import { branding } from './branding';

export type AdjustmentType = 'percent' | 'flat';

export interface Adjustment {
	type: AdjustmentType;
	value: number;
}

export interface LineItem {
	description: string;
	quantity: number;
	rate: number;
}

export interface Party {
	name: string;
	details: string;
}

export interface Invoice {
	number: string;
	/** YYYY-MM-DD */
	date: string;
	/** YYYY-MM-DD or empty */
	dueDate: string;
	paymentTerms: string;
	poNumber: string;
	currency: string;
	from: Party;
	to: Party;
	shipTo: string;
	items: LineItem[];
	discount: Adjustment;
	tax: Adjustment;
	shipping: number;
	amountPaid: number;
	notes: string;
	terms: string;
}

export const SIGNATURE_ROLES = ['sender', 'recipient'] as const;
export type SignatureRole = (typeof SIGNATURE_ROLES)[number];

export const ROLE_LABELS: Record<SignatureRole, string> = {
	sender: 'Sender',
	recipient: 'Recipient'
};

/** A signature as drawn in the browser, before the server stamps it. */
export interface SignatureDraft {
	/** PNG data URL */
	image: string;
	name: string;
}

export interface Signature extends SignatureDraft {
	/** ISO timestamp */
	signedAt: string;
}

export type Signatures = Partial<Record<SignatureRole, Signature>>;
export type SignatureDrafts = Partial<Record<SignatureRole, SignatureDraft>>;

export type InvoiceStatus = 'partial' | 'completed';

export interface InvoiceRecord {
	token: string;
	createdAt: string;
	expiresAt: string;
	status: InvoiceStatus;
	invoice: Invoice;
	signatures: Signatures;
}

export const LINK_TTL_HOURS = 48;

export function blankItem(): LineItem {
	return { description: '', quantity: 1, rate: 0 };
}

export function blankInvoice(today: string): Invoice {
	return {
		number: '',
		date: today,
		dueDate: '',
		paymentTerms: branding.defaults.paymentTerms,
		poNumber: '',
		currency: branding.defaults.currency,
		from: { name: '', details: '' },
		to: { name: '', details: '' },
		shipTo: '',
		items: [blankItem()],
		discount: { type: 'percent', value: 0 },
		tax: { type: 'percent', value: 0 },
		shipping: 0,
		amountPaid: 0,
		notes: branding.defaults.notes,
		terms: branding.defaults.terms
	};
}

/** Number inputs yield undefined/null while empty; treat those as zero. */
export function num(value: unknown): number {
	const n = typeof value === 'number' ? value : Number(value);
	return Number.isFinite(n) ? n : 0;
}

function currencyDigits(currency: string): number {
	try {
		return (
			new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
				.maximumFractionDigits ?? 2
		);
	} catch {
		return 2;
	}
}

export interface Totals {
	lineAmounts: number[];
	subtotal: number;
	discount: number;
	tax: number;
	shipping: number;
	total: number;
	amountPaid: number;
	balance: number;
}

export function computeTotals(invoice: Invoice): Totals {
	const factor = 10 ** currencyDigits(invoice.currency);
	const round = (n: number) => Math.round((n + Number.EPSILON) * factor) / factor;

	const lineAmounts = invoice.items.map((item) => round(num(item.quantity) * num(item.rate)));
	const subtotal = round(lineAmounts.reduce((sum, amount) => sum + amount, 0));
	const discount = round(
		invoice.discount.type === 'percent'
			? (subtotal * num(invoice.discount.value)) / 100
			: num(invoice.discount.value)
	);
	const taxable = subtotal - discount;
	const tax = round(
		invoice.tax.type === 'percent' ? (taxable * num(invoice.tax.value)) / 100 : num(invoice.tax.value)
	);
	const shipping = round(num(invoice.shipping));
	const total = round(taxable + tax + shipping);
	const amountPaid = round(num(invoice.amountPaid));
	const balance = round(total - amountPaid);

	return { lineAmounts, subtotal, discount, tax, shipping, total, amountPaid, balance };
}

export function formatMoney(amount: number, currency: string): string {
	try {
		return new Intl.NumberFormat(branding.locale, { style: 'currency', currency }).format(amount);
	} catch {
		return `${currency} ${amount.toFixed(2)}`;
	}
}

export function formatQuantity(quantity: number): string {
	return new Intl.NumberFormat(branding.locale, { maximumFractionDigits: 4 }).format(quantity);
}

/** Formats a YYYY-MM-DD date without shifting it across timezones. */
export function formatDate(date: string): string {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
	return new Intl.DateTimeFormat(branding.locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(
		new Date(`${date}T00:00:00Z`)
	);
}

export function formatDateTime(iso: string): string {
	return new Intl.DateTimeFormat(branding.locale, {
		dateStyle: 'medium',
		timeStyle: 'short'
	}).format(new Date(iso));
}

export function adjustmentLabel(label: string, adjustment: Adjustment): string {
	return adjustment.type === 'percent' ? `${label} (${num(adjustment.value)}%)` : label;
}
