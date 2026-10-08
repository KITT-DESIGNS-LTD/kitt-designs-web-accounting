import { error, isHttpError, json } from '@sveltejs/kit';
import { InvoiceInputError, signInvoice } from '$lib/server/invoices';
import type { RequestHandler } from './$types';

// Adds the missing signature(s) to an existing invoice.
export const PUT: RequestHandler = async ({ params, request }) => {
	const body = await request.json().catch(() => null);
	try {
		const result = await signInvoice(params.token, body);
		if (result.state === 'missing') error(404, 'This invoice does not exist.');
		if (result.state === 'expired') error(410, 'The link to this invoice has expired.');
		if (result.state === 'nothing-to-sign') {
			error(409, 'This invoice has already been signed. Reload the page to see it.');
		}
		return json({ record: result.record });
	} catch (err) {
		if (isHttpError(err)) throw err;
		if (err instanceof InvoiceInputError) error(400, err.message);
		console.error('Signing invoice failed:', err);
		error(502, 'Could not save the invoice. Please try again.');
	}
};
