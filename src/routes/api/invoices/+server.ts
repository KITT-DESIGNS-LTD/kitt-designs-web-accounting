import { error, json } from '@sveltejs/kit';
import { createInvoice, InvoiceInputError } from '$lib/server/invoices';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => null);
	try {
		const record = await createInvoice(body);
		return json({ token: record.token }, { status: 201 });
	} catch (err) {
		if (err instanceof InvoiceInputError) error(400, err.message);
		console.error('Saving invoice failed:', err);
		error(502, 'Could not save the invoice. Please try again.');
	}
};
