import { error } from '@sveltejs/kit';
import { findInvoice } from '$lib/server/invoices';
import { getStorage } from '$lib/server/storage';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const lookup = await findInvoice(params.token);
	if (lookup.state === 'missing') error(404, 'This invoice does not exist.');
	if (lookup.state === 'expired') error(410, 'The link to this invoice has expired.');

	const { pdf } = lookup.files;
	const data = await getStorage().read(pdf.id);
	const asciiName = pdf.name.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, "'");
	return new Response(new Uint8Array(data), {
		headers: {
			'content-type': 'application/pdf',
			'content-disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(pdf.name)}`,
			'cache-control': 'no-store'
		}
	});
};
