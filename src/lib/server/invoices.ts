import { randomBytes } from 'node:crypto';
import {
	LINK_TTL_HOURS,
	SIGNATURE_ROLES,
	type Adjustment,
	type Invoice,
	type InvoiceRecord,
	type InvoiceStatus,
	type Signature,
	type Signatures
} from '$lib/invoice';
import { fileDate, safeNamePart } from './naming';
import { renderInvoicePdf } from './pdf';
import { getStorage, type StoredFile } from './storage';

// Each invoice is two files in the invoices folder, linked by a `token`
// property: the PDF people read, and a JSON file holding the data needed to
// reopen it from the share link.
const PDF_MIME = 'application/pdf';
const JSON_MIME = 'application/json';
const MAX_SIGNATURE_LENGTH = 400_000;
const MAX_ITEMS = 200;

/** Thrown for bad input; the message is safe to show to the user. */
export class InvoiceInputError extends Error {}

// --- Input validation -------------------------------------------------------

function asObject(value: unknown, what: string): Record<string, unknown> {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		throw new InvoiceInputError(`${what} is missing.`);
	}
	return value as Record<string, unknown>;
}

function text(value: unknown, maxLength: number): string {
	return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function amount(value: unknown, what: string, { allowNegative = false } = {}): number {
	if (value === null || value === undefined || value === '') return 0;
	const n = Number(value);
	if (!Number.isFinite(n) || Math.abs(n) > 1e12 || (!allowNegative && n < 0)) {
		throw new InvoiceInputError(`${what} is not a valid number.`);
	}
	return n;
}

function isoDate(value: unknown, what: string, required: boolean): string {
	const date = text(value, 10);
	if (!date && !required) return '';
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
		throw new InvoiceInputError(`${what} is not a valid date.`);
	}
	return date;
}

function adjustment(value: unknown, what: string): Adjustment {
	const input = asObject(value ?? {}, what);
	const type = input.type === 'flat' ? 'flat' : 'percent';
	const n = amount(input.value, what);
	if (type === 'percent' && n > 100) throw new InvoiceInputError(`${what} cannot exceed 100%.`);
	return { type, value: n };
}

function parseInvoice(value: unknown): Invoice {
	const input = asObject(value, 'Invoice');
	const from = asObject(input.from ?? {}, 'From');
	const to = asObject(input.to ?? {}, 'Bill to');

	const currency = text(input.currency, 3).toUpperCase();
	if (!/^[A-Z]{3}$/.test(currency)) throw new InvoiceInputError('Currency is not valid.');

	const rawItems = Array.isArray(input.items) ? input.items : [];
	if (rawItems.length > MAX_ITEMS) throw new InvoiceInputError('Too many line items.');
	const items = rawItems
		.map((raw, i) => {
			const item = asObject(raw, `Line item ${i + 1}`);
			return {
				description: text(item.description, 500),
				quantity: amount(item.quantity, `Quantity on line ${i + 1}`, { allowNegative: true }),
				rate: amount(item.rate, `Rate on line ${i + 1}`, { allowNegative: true })
			};
		})
		.filter((item) => item.description || item.rate);

	const invoice: Invoice = {
		number: text(input.number, 40),
		date: isoDate(input.date, 'Date', true),
		dueDate: isoDate(input.dueDate, 'Due date', false),
		paymentTerms: text(input.paymentTerms, 100),
		poNumber: text(input.poNumber, 60),
		currency,
		from: { name: text(from.name, 120), details: text(from.details, 600) },
		to: { name: text(to.name, 120), details: text(to.details, 600) },
		shipTo: text(input.shipTo, 600),
		items,
		discount: adjustment(input.discount, 'Discount'),
		tax: adjustment(input.tax, 'Tax'),
		shipping: amount(input.shipping, 'Shipping'),
		amountPaid: amount(input.amountPaid, 'Amount paid'),
		notes: text(input.notes, 2000),
		terms: text(input.terms, 2000)
	};

	if (!invoice.number) throw new InvoiceInputError('Enter an invoice number.');
	if (!invoice.from.name) throw new InvoiceInputError('Enter who the invoice is from.');
	if (!invoice.to.name) throw new InvoiceInputError('Enter who the invoice is billed to.');
	if (!invoice.items.length) throw new InvoiceInputError('Add at least one line item.');
	return invoice;
}

/** Validates the signatures in a request and stamps them with the signing time. */
function parseSignatures(value: unknown, now: Date): Signatures {
	const input = asObject(value ?? {}, 'Signatures');
	const signatures: Signatures = {};
	for (const role of SIGNATURE_ROLES) {
		if (input[role] === null || input[role] === undefined) continue;
		const draft = asObject(input[role], 'Signature');
		const image = typeof draft.image === 'string' ? draft.image : '';
		const name = text(draft.name, 100);
		if (
			!/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(image) ||
			image.length > MAX_SIGNATURE_LENGTH
		) {
			throw new InvoiceInputError('A signature image is not valid.');
		}
		if (!name) throw new InvoiceInputError('Enter the name of each person signing.');
		signatures[role] = { image, name, signedAt: now.toISOString() } satisfies Signature;
	}
	return signatures;
}

// --- Storage ----------------------------------------------------------------

function statusOf(signatures: Signatures): InvoiceStatus {
	return SIGNATURE_ROLES.every((role) => signatures[role]) ? 'completed' : 'partial';
}

function fileNames(record: InvoiceRecord): { pdf: string; data: string } {
	const date = fileDate(new Date(record.createdAt));
	const number = safeNamePart(record.invoice.number, 40);
	const client = safeNamePart(record.invoice.to.name, 50);
	const base = `${date} Invoice ${number} - ${client} (${record.status.toUpperCase()})`;
	return { pdf: `${base}.pdf`, data: `${base} data.json` };
}

function properties(record: InvoiceRecord, kind: 'pdf' | 'data'): Record<string, string> {
	return { token: record.token, kind, status: record.status, expiresAt: record.expiresAt };
}

interface InvoiceFiles {
	pdf?: StoredFile;
	data?: StoredFile;
}

async function findFiles(token: string): Promise<InvoiceFiles> {
	const files = await getStorage().find('invoices', { token });
	return {
		pdf: files.find((file) => file.properties.kind === 'pdf'),
		data: files.find((file) => file.properties.kind === 'data')
	};
}

async function removeFiles(files: InvoiceFiles): Promise<void> {
	const storage = getStorage();
	await Promise.all(
		[files.pdf, files.data].filter((file) => !!file).map((file) => storage.remove(file.id))
	);
}

function isExpired(expiresAt: string | undefined, now = Date.now()): boolean {
	const time = Date.parse(expiresAt ?? '');
	return Number.isNaN(time) || time <= now;
}

const isToken = (token: string) => /^[A-Za-z0-9_-]{43}$/.test(token);

// --- Operations -------------------------------------------------------------

export async function createInvoice(input: unknown): Promise<InvoiceRecord> {
	const body = asObject(input, 'Request');
	const now = new Date();
	const signatures = parseSignatures(body.signatures, now);
	const record: InvoiceRecord = {
		token: randomBytes(32).toString('base64url'),
		createdAt: now.toISOString(),
		expiresAt: new Date(now.getTime() + LINK_TTL_HOURS * 3600_000).toISOString(),
		status: statusOf(signatures),
		invoice: parseInvoice(body.invoice),
		signatures
	};

	const storage = getStorage();
	const names = fileNames(record);
	const pdf = await storage.create('invoices', {
		name: names.pdf,
		mimeType: PDF_MIME,
		data: await renderInvoicePdf(record),
		properties: properties(record, 'pdf')
	});
	try {
		await storage.create('invoices', {
			name: names.data,
			mimeType: JSON_MIME,
			data: Buffer.from(JSON.stringify(record)),
			properties: properties(record, 'data')
		});
	} catch (err) {
		await storage.remove(pdf.id).catch(() => {});
		throw err;
	}
	return record;
}

export type InvoiceLookup =
	| { state: 'found'; record: InvoiceRecord; files: Required<InvoiceFiles> }
	| { state: 'expired' }
	| { state: 'missing' };

/**
 * Looks an invoice up by its link token. Links stop working 48 hours after
 * creation; an invoice that is still partial at that point is deleted.
 */
export async function findInvoice(token: string): Promise<InvoiceLookup> {
	if (!isToken(token)) return { state: 'missing' };
	const files = await findFiles(token);
	const { pdf, data } = files;
	if (!pdf || !data) return { state: 'missing' };

	if (isExpired(data.properties.expiresAt)) {
		if (data.properties.status !== 'completed') await removeFiles(files);
		return { state: 'expired' };
	}
	const record: InvoiceRecord = JSON.parse((await getStorage().read(data.id)).toString('utf8'));
	return { state: 'found', record, files: { pdf, data } };
}

export type SignResult = InvoiceLookup | { state: 'nothing-to-sign' };

/**
 * Adds the missing signature(s) to an invoice and overwrites its files. The
 * invoice content and signatures already given cannot be changed.
 */
export async function signInvoice(token: string, input: unknown): Promise<SignResult> {
	const submitted = parseSignatures(asObject(input, 'Request').signatures, new Date());
	const lookup = await findInvoice(token);
	if (lookup.state !== 'found') return lookup;

	const { record, files } = lookup;
	const added = SIGNATURE_ROLES.filter((role) => submitted[role] && !record.signatures[role]);
	if (!added.length) return { state: 'nothing-to-sign' };
	for (const role of added) record.signatures[role] = submitted[role];
	record.status = statusOf(record.signatures);

	const storage = getStorage();
	const names = fileNames(record);
	const pdfData = await renderInvoicePdf(record);
	// Data first: it is the source of truth if the second write fails.
	const data = await storage.update(files.data.id, {
		name: names.data,
		mimeType: JSON_MIME,
		data: Buffer.from(JSON.stringify(record)),
		properties: properties(record, 'data')
	});
	const pdf = await storage.update(files.pdf.id, {
		name: names.pdf,
		mimeType: PDF_MIME,
		data: pdfData,
		properties: properties(record, 'pdf')
	});
	return { state: 'found', record, files: { pdf, data } };
}

/** Deletes invoices that are still partial after their link has expired. */
export async function removeExpiredPartialInvoices(): Promise<number> {
	const storage = getStorage();
	const partial = await storage.find('invoices', { status: 'partial' });
	const expired = partial.filter((file) => isExpired(file.properties.expiresAt));
	await Promise.all(expired.map((file) => storage.remove(file.id)));
	return expired.length;
}
