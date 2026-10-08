import { error } from '@sveltejs/kit';
import { findInvoice } from '$lib/server/invoices';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, setHeaders }) => {
	const lookup = await findInvoice(params.token);
	if (lookup.state === 'missing') error(404, 'This invoice does not exist.');
	if (lookup.state === 'expired') error(410, 'The link to this invoice has expired.');

	setHeaders({ 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' });
	return { record: lookup.record };
};
