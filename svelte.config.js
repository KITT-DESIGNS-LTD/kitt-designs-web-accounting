import nodeAdapter from '@sveltejs/adapter-node';
import vercelAdapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		// Vercel builds set VERCEL=1; everywhere else `npm start` runs the Node build.
		adapter: process.env.VERCEL ? vercelAdapter({ runtime: 'nodejs22.x' }) : nodeAdapter(),
		// Served at staff.kittdesigns.com/accounting
		paths: { base: '/accounting' }
	}
};

export default config;
