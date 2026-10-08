import { redirect, type Handle, type ServerInit } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { env } from '$env/dynamic/private';
import { authEnabled, isPublicRoute, isValidSession, SESSION_COOKIE } from '$lib/server/auth';
import { removeExpiredPartialInvoices } from '$lib/server/invoices';

const CLEANUP_INTERVAL_MS = 15 * 60_000;

async function cleanup() {
	try {
		const removed = await removeExpiredPartialInvoices();
		if (removed) console.log(`Removed ${removed} expired partial invoice file(s).`);
	} catch (err) {
		console.error('Could not clean up expired invoices:', err);
	}
}

// Partial invoices are deleted once their 48-hour link has expired. The sweep
// runs at startup and then every 15 minutes while the server is up. On Vercel
// there is no long-running server: a cron job calls /api/cron/cleanup instead.
export const init: ServerInit = () => {
	if (env.VERCEL) return;
	const state = globalThis as { __invoiceCleanup?: NodeJS.Timeout };
	clearInterval(state.__invoiceCleanup); // dev server reloads re-run init
	state.__invoiceCleanup = setInterval(cleanup, CLEANUP_INTERVAL_MS);
	state.__invoiceCleanup.unref();
	void cleanup();
};

// Staff pages need the shared password; invoice share links stay open.
export const handle: Handle = async ({ event, resolve: render }) => {
	if (
		authEnabled() &&
		!isPublicRoute(event.route.id) &&
		!isValidSession(event.cookies.get(SESSION_COOKIE))
	) {
		if (event.request.method !== 'GET' || event.route.id?.startsWith('/api/')) {
			return new Response(JSON.stringify({ message: 'Please sign in again.' }), {
				status: 401,
				headers: { 'content-type': 'application/json' }
			});
		}
		const next = event.url.pathname + event.url.search;
		redirect(303, `${resolve('/login')}?next=${encodeURIComponent(next)}`);
	}
	return render(event);
};
