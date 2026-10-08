// One-time helper: prints a refresh token so the app can act as your Google
// account (Option B in .env.example).
//
//   1. In Google Cloud Console, enable the Drive API and create an OAuth
//      client of type "Desktop app".
//   2. Put its ID and secret in .env as GOOGLE_OAUTH_CLIENT_ID / _SECRET.
//   3. Run `npm run google-token`, open the printed URL and approve access.
//   4. Copy the printed token into .env as GOOGLE_OAUTH_REFRESH_TOKEN.
import { createServer } from 'node:http';
import { auth } from '@googleapis/drive';

const { GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET } = process.env;
if (!GOOGLE_OAUTH_CLIENT_ID || !GOOGLE_OAUTH_CLIENT_SECRET) {
	console.error('Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET in .env first.');
	process.exit(1);
}

const PORT = 53682;
const redirectUri = `http://127.0.0.1:${PORT}`;
const client = new auth.OAuth2(GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, redirectUri);

const server = createServer(async (req, res) => {
	const code = new URL(req.url ?? '/', redirectUri).searchParams.get('code');
	if (!code) {
		res.writeHead(400).end('No authorisation code in the request.');
		return;
	}
	try {
		const { tokens } = await client.getToken(code);
		res.end('Done. You can close this tab and return to the terminal.');
		if (tokens.refresh_token) {
			console.log(`\nGOOGLE_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}\n`);
		} else {
			console.error(
				'\nGoogle returned no refresh token. Remove the app at https://myaccount.google.com/permissions and run this again.'
			);
		}
	} catch (err) {
		res.writeHead(500).end('Could not exchange the code. See the terminal.');
		console.error(err);
	}
	server.close();
});

server.listen(PORT, '127.0.0.1', () => {
	const url = client.generateAuthUrl({
		access_type: 'offline',
		prompt: 'consent',
		scope: ['https://www.googleapis.com/auth/drive']
	});
	console.log(`Open this URL in your browser and approve access:\n\n${url}\n`);
});
