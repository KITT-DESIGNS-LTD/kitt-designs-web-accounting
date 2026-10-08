import pdfmake from 'pdfmake';
import roboto from 'pdfmake/fonts/Roboto.js';
import { branding, logoDataUrl } from '$lib/branding';
import {
	adjustmentLabel,
	computeTotals,
	formatDate,
	formatMoney,
	formatQuantity,
	num,
	ROLE_LABELS,
	SIGNATURE_ROLES,
	type InvoiceRecord,
	type SignatureRole
} from '$lib/invoice';
import { fileDate } from './naming';

// Everything the PDF needs is embedded (bundled fonts, images as data URLs),
// so pdfmake gets no network access and may only read its own font files.
const fontFiles = new Set(Object.values(roboto.Roboto));
pdfmake.setFonts(roboto);
pdfmake.setUrlAccessPolicy(() => false);
pdfmake.setLocalAccessPolicy((path) => fontFiles.has(path));

const MUTED = '#6b7280';
const RULE = '#e3e6ec';
const SOFT = '#f3f5f9';

type Node = Record<string, unknown>;

const label = (text: string): Node => ({
	text: text.toUpperCase(),
	fontSize: 8,
	bold: true,
	color: MUTED,
	characterSpacing: 0.6,
	margin: [0, 0, 0, 3]
});

function party(title: string, name: string, details: string): Node {
	const stack: Node[] = [label(title)];
	if (name) stack.push({ text: name, bold: true, fontSize: 11 });
	if (details) stack.push({ text: details, color: '#374151' });
	return { width: '*', stack };
}

function signatureBlock(record: InvoiceRecord, role: SignatureRole): Node {
	const signature = record.signatures[role];
	return {
		width: '*',
		stack: [
			{
				// A fixed-height row keeps both signature lines level.
				table: {
					widths: ['*'],
					heights: [66],
					body: [[signature ? { image: signature.image, fit: [190, 62] } : { text: '' }]]
				},
				layout: 'noBorders'
			},
			{
				canvas: [{ type: 'line', x1: 0, y1: 0, x2: 200, y2: 0, lineWidth: 0.7, lineColor: '#9ca3af' }],
				margin: [0, 2, 0, 5]
			},
			label(ROLE_LABELS[role]),
			signature
				? { text: signature.name, bold: true }
				: { text: 'Not yet signed', color: MUTED, italics: true },
			signature
				? {
						text: `Signed ${formatDate(fileDate(new Date(signature.signedAt)))}`,
						color: MUTED,
						fontSize: 9
					}
				: { text: '' }
		]
	};
}

export async function renderInvoicePdf(record: InvoiceRecord): Promise<Buffer> {
	const { invoice } = record;
	const totals = computeTotals(invoice);
	const money = (amount: number) => formatMoney(amount, invoice.currency);

	const meta: [string, string][] = [['Date', formatDate(invoice.date)]];
	if (invoice.paymentTerms) meta.push(['Payment terms', invoice.paymentTerms]);
	if (invoice.dueDate) meta.push(['Due date', formatDate(invoice.dueDate)]);
	if (invoice.poNumber) meta.push(['PO number', invoice.poNumber]);

	// "From" on top, then "Bill to" (and "Ship to") side by side beneath it.
	const recipients = [party('Bill to', invoice.to.name, invoice.to.details)];
	if (invoice.shipTo) recipients.push(party('Ship to', '', invoice.shipTo));
	const parties: Node[] = [
		{ ...party('From', invoice.from.name, invoice.from.details), margin: [0, 0, 0, 14] },
		{ columns: recipients, columnGap: 14 }
	];

	const totalRows: [string, string][] = [['Subtotal', money(totals.subtotal)]];
	if (totals.discount) {
		totalRows.push([adjustmentLabel('Discount', invoice.discount), `-${money(totals.discount)}`]);
	}
	if (totals.tax) totalRows.push([adjustmentLabel('Tax', invoice.tax), money(totals.tax)]);
	if (totals.shipping) totalRows.push(['Shipping', money(totals.shipping)]);
	totalRows.push(['Total', money(totals.total)]);
	if (totals.amountPaid) totalRows.push(['Amount paid', money(totals.amountPaid)]);

	const content: Node[] = [
		{
			columns: [
				{
					width: '*',
					columns: [
						{ image: logoDataUrl, width: 38 },
						{
							text: branding.companyName,
							fontSize: 18,
							bold: true,
							margin: [10, 8, 0, 0]
						}
					]
				},
				{
					width: 'auto',
					stack: [
						{ text: 'INVOICE', fontSize: 24, bold: true, color: branding.accentColor },
						{ text: `# ${invoice.number}`, color: MUTED, fontSize: 11 }
					],
					alignment: 'right'
				}
			],
			margin: [0, 0, 0, 26]
		},
		{
			columns: [
				{ width: '*', stack: parties },
				{
					width: 190,
					table: {
						widths: ['*', 'auto'],
						body: [
							...meta.map(([key, value]) => [
								{ text: key, color: MUTED, alignment: 'right' },
								{ text: value, alignment: 'right' }
							]),
							[
								{ text: 'Balance due', bold: true, alignment: 'right', fillColor: SOFT },
								{ text: money(totals.balance), bold: true, alignment: 'right', fillColor: SOFT }
							]
						]
					},
					layout: {
						hLineWidth: () => 0,
						vLineWidth: () => 0,
						paddingTop: () => 4,
						paddingBottom: () => 4,
						paddingLeft: () => 6,
						paddingRight: () => 6
					}
				}
			],
			columnGap: 20,
			margin: [0, 0, 0, 24]
		},
		{
			table: {
				headerRows: 1,
				dontBreakRows: true,
				widths: ['*', 60, 90, 90],
				body: [
					['Item', 'Quantity', 'Rate', 'Amount'].map((text, i) => ({
						text,
						bold: true,
						color: '#ffffff',
						alignment: i === 0 ? 'left' : 'right'
					})),
					...invoice.items.map((item, i) => [
						{ text: item.description },
						{ text: formatQuantity(num(item.quantity)), alignment: 'right' },
						{ text: money(num(item.rate)), alignment: 'right' },
						{ text: money(totals.lineAmounts[i]), alignment: 'right' }
					])
				]
			},
			layout: {
				hLineWidth: (i: number) => (i <= 1 ? 0 : 0.6),
				vLineWidth: () => 0,
				hLineColor: () => RULE,
				fillColor: (row: number) => (row === 0 ? branding.inkColor : null),
				paddingTop: () => 7,
				paddingBottom: () => 7,
				paddingLeft: () => 8,
				paddingRight: () => 8
			},
			margin: [0, 0, 0, 12]
		},
		{
			columns: [
				{ width: '*', text: '' },
				{
					width: 250,
					table: {
						widths: ['*', 'auto'],
						body: [
							...totalRows.map(([key, value]) => [
								{ text: key, color: MUTED, alignment: 'right' },
								{ text: value, alignment: 'right' }
							]),
							[
								{ text: 'Balance due', bold: true, fontSize: 12, alignment: 'right' },
								{ text: money(totals.balance), bold: true, fontSize: 12, alignment: 'right' }
							]
						]
					},
					layout: {
						hLineWidth: (i: number, node: { table: { body: unknown[] } }) =>
							i === node.table.body.length - 1 ? 0.8 : 0,
						vLineWidth: () => 0,
						hLineColor: () => '#9ca3af',
						paddingTop: () => 4,
						paddingBottom: () => 4,
						paddingLeft: () => 8,
						paddingRight: () => 8
					}
				}
			],
			margin: [0, 0, 0, 20]
		}
	];

	if (invoice.notes) {
		content.push({ stack: [label('Notes'), { text: invoice.notes }], margin: [0, 0, 0, 14] });
	}
	if (invoice.terms) {
		content.push({ stack: [label('Terms'), { text: invoice.terms }], margin: [0, 0, 0, 14] });
	}

	content.push({
		unbreakable: true,
		columns: SIGNATURE_ROLES.map((role) => signatureBlock(record, role)),
		columnGap: 40,
		margin: [0, 16, 0, 0]
	});

	return pdfmake
		.createPdf({
			pageSize: branding.pageSize,
			pageMargins: [44, 44, 44, 56],
			info: { title: `Invoice ${invoice.number}`, author: branding.companyName },
			defaultStyle: { font: 'Roboto', fontSize: 10, lineHeight: 1.25, color: branding.inkColor },
			footer: (page: number, pages: number) => ({
				columns: [
					{ text: branding.footer, color: MUTED, fontSize: 8 },
					{ text: `Page ${page} of ${pages}`, color: MUTED, fontSize: 8, alignment: 'right' }
				],
				margin: [44, 20, 44, 0]
			}),
			content
		})
		.getBuffer();
}
