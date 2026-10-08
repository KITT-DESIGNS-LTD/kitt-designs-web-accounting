import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';

export const SESSION_COOKIE = 'staff_session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 90; // 90 days

// Routes that work without the staff password: the share link a client opens,
// its PDF and signing endpoint, the login page and the scheduled cleanup
// (which checks its own secret).
const PUBLIC_ROUTES = new Set([
	'/login',
	'/invoice/[token]',
	'/invoice/[token]/pdf',
	'/api/invoices/[token]',
	'/api/cron/cleanup'
]);

/** The gate is on only when STAFF_PASSWORD is set (it is unset in local development). */
export function authEnabled(): boolean {
	return Boolean(env.STAFF_PASSWORD);
}

export function isPublicRoute(routeId: string | null): boolean {
	// Unknown URLs (routeId null) fall through to the 404 page.
	return routeId === null || PUBLIC_ROUTES.has(routeId);
}

// The cookie holds an HMAC of the password, so changing STAFF_PASSWORD signs everyone out.
function sessionValue(): string {
	return createHmac('sha256', env.STAFF_PASSWORD ?? '').update('kitt-staff-session').digest('base64url');
}

function same(a: string, b: string): boolean {
	const x = Buffer.from(a);
	const y = Buffer.from(b);
	return x.length === y.length && timingSafeEqual(x, y);
}

export function isValidSession(cookie: string | undefined): boolean {
	return Boolean(cookie) && same(cookie!, sessionValue());
}

export function checkPassword(password: string): string | null {
	return same(password, env.STAFF_PASSWORD ?? '') ? sessionValue() : null;
}
