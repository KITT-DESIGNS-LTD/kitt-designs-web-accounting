import { error, json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { removeExpiredPartialInvoices } from '$lib/server/invoices';
import type { RequestHandler } from './$types';

// Called by the Vercel cron job (vercel.json), which sends CRON_SECRET as a bearer token.
export const GET: RequestHandler = async ({ request }) => {
	if (!env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${env.CRON_SECRET}`) {
		error(401, 'Unauthorized');
	}
	const removed = await removeExpiredPartialInvoices();
	return json({ removed });
};
