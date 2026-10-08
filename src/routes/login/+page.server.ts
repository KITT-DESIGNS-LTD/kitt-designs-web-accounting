import { fail, redirect } from '@sveltejs/kit';
import { base, resolve } from '$app/paths';
import { authEnabled, checkPassword, SESSION_COOKIE, SESSION_MAX_AGE } from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

// Only follow redirects back into this app.
function safeNext(next: string | null): string {
	return next && next.startsWith(`${base}/`) && !next.startsWith('//') ? next : resolve('/');
}

export const load: PageServerLoad = ({ url }) => {
	if (!authEnabled()) redirect(303, safeNext(url.searchParams.get('next')));
};

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		const form = await request.formData();
		const session = checkPassword(String(form.get('password') ?? ''));
		if (!session) return fail(400, { wrong: true });
		cookies.set(SESSION_COOKIE, session, {
			path: base || '/',
			httpOnly: true,
			secure: url.protocol === 'https:',
			sameSite: 'lax',
			maxAge: SESSION_MAX_AGE
		});
		redirect(303, safeNext(url.searchParams.get('next')));
	}
};
