// Wet-run tests: drive a running instance of the app against the real Google
// Drive folders in .env, and check every stage on both sides (HTTP responses
// and the files that land in Drive).
//
//   npm run dev            # in another terminal (or `npm start`)
//   npm run test:wetrun    # WETRUN_BASE_URL defaults to http://localhost:5173
//
// Everything the run creates is labelled WETRUN-<id> and moved to the Drive
// trash at the end, the same way the app removes files.

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { crc32, deflateSync } from 'node:zlib';
import { drive as createDrive } from '@googleapis/drive';
import { driveConfigFromEnv } from '../src/lib/server/storage/drive.ts';

const BASE_URL = (process.env.WETRUN_BASE_URL ?? 'http://localhost:5173').replace(/\/$/, '');
const ORIGIN = new URL(BASE_URL).origin;
const RUN_ID = `WETRUN-${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}`;

const config = driveConfigFromEnv(process.env);
const drive = config && createDrive({ version: 'v3', auth: config.auth });
/** Drive file ids created by this run, trashed in after(). */
const created = new Set();

// --- Helpers ------------------------------------------------------------------

/** A valid solid-colour PNG, small enough to keep the run fast. */
function png(width = 8, height = 8, rgb = [253, 70, 88]) {
	const chunk = (type, data) => {
		const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
		const length = Buffer.alloc(4);
		length.writeUInt32BE(data.length);
		const crc = Buffer.alloc(4);
		crc.writeUInt32BE(crc32(body));
		return Buffer.concat([length, body, crc]);
	};
	const header = Buffer.alloc(13);
	header.writeUInt32BE(width, 0);
	header.writeUInt32BE(height, 4);
	header[8] = 8; // bit depth
	header[9] = 2; // truecolour
	const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array(width).fill(rgb).flat())]);
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk('IHDR', header),
		chunk('IDAT', deflateSync(Buffer.concat(Array(height).fill(row)))),
		chunk('IEND', Buffer.alloc(0))
	]);
}

const signature = (name) => ({
	name,
	image: `data:image/png;base64,${png(120, 40, [2, 2, 26]).toString('base64')}`
});

function app(path, init = {}) {
	// SvelteKit rejects form posts without a matching Origin (CSRF check).
	const headers = { origin: ORIGIN, ...init.headers };
	return fetch(`${BASE_URL}${path}`, { redirect: 'manual', ...init, headers });
}

const sendJson = (method, path, body) =>
	app(path, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

async function uploadReceipt(file, fields = {}) {
	const form = new FormData();
	if (file) form.set('file', file);
	for (const [key, value] of Object.entries(fields)) form.set(key, value);
	return app('/api/receipts', { method: 'POST', body: form });
}

async function driveFile(id) {
	const res = await drive.files.get({
		fileId: id,
		fields: 'id, name, mimeType, size, trashed, parents, appProperties',
		supportsAllDrives: true
	});
	return res.data;
}

async function driveContent(id) {
	const res = await drive.files.get(
		{ fileId: id, alt: 'media', supportsAllDrives: true },
		{ responseType: 'arraybuffer' }
	);
	return Buffer.from(res.data);
}

/** Lists a folder by query. Retries briefly: Drive search can trail a write by a moment. */
async function driveFind(folderId, clause, expected = 1) {
	let files = [];
	for (let attempt = 0; attempt < 5; attempt++) {
		const res = await drive.files.list({
			q: `'${folderId}' in parents and trashed = false and ${clause}`,
			fields: 'files(id, name, mimeType, size, appProperties)',
			supportsAllDrives: true,
			includeItemsFromAllDrives: true
		});
		files = res.data.files ?? [];
		if (files.length >= expected) break;
		await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
	}
	for (const file of files) created.add(file.id);
	return files;
}

const byToken = (token, expected = 2) =>
	driveFind(config.folders.invoices, `appProperties has { key='token' and value='${token}' }`, expected);

function invoiceBody(signatures) {
	const today = new Date().toISOString().slice(0, 10);
	return {
		invoice: {
			number: RUN_ID,
			date: today,
			dueDate: today,
			paymentTerms: 'Due on receipt',
			poNumber: 'PO-WETRUN',
			currency: 'GBP',
			from: { name: 'Wet run sender', details: '1 Test Street\nLondon' },
			to: { name: `${RUN_ID} client`, details: 'test@example.com' },
			shipTo: '',
			items: [
				{ description: 'Wet run line one', quantity: 2, rate: 50 },
				{ description: 'Wet run line two', quantity: 1, rate: 25.5 }
			],
			discount: { type: 'percent', value: 10 },
			tax: { type: 'percent', value: 20 },
			shipping: 5,
			amountPaid: 0,
			notes: 'Created by the wet-run test suite. Safe to delete.',
			terms: ''
		},
		signatures
	};
}

const pdfMagic = (data) => data.subarray(0, 5).toString('ascii');

// --- Preflight ----------------------------------------------------------------

before(async () => {
	assert.ok(config, 'No Google credentials in .env: the wet run needs real Drive access.');
	for (const [folder, id] of Object.entries(config.folders)) {
		assert.ok(id, `GOOGLE_DRIVE_${folder.toUpperCase()}_FOLDER_ID is not set.`);
		try {
			const meta = await driveFile(id);
			assert.equal(meta.mimeType, 'application/vnd.google-apps.folder', `${folder} ID is not a folder.`);
		} catch (err) {
			const reason = err?.response?.data?.error?.message ?? err.message;
			assert.fail(`Cannot open the ${folder} folder in Drive: ${reason}`);
		}
	}
	const res = await fetch(BASE_URL).catch(() => null);
	assert.ok(res, `The app is not reachable at ${BASE_URL}. Start it (npm run dev) or set WETRUN_BASE_URL.`);
});

after(async () => {
	if (!drive) return;
	const results = await Promise.allSettled(
		[...created].map((fileId) =>
			drive.files.update({ fileId, requestBody: { trashed: true }, supportsAllDrives: true })
		)
	);
	const failed = results.filter((result) => result.status === 'rejected').length;
	if (failed) console.warn(`Could not trash ${failed} wet-run file(s); remove "${RUN_ID}" files by hand.`);
});

// --- Receipts -----------------------------------------------------------------

describe('receipt upload', () => {
	it('saves a photo to the receipts folder with a timestamped name', async () => {
		const image = png();
		const res = await uploadReceipt(new File([image], 'photo.png', { type: 'image/png' }), {
			label: `${RUN_ID} taxi`,
			sequence: '2'
		});
		const body = await res.json();
		assert.equal(res.status, 201, JSON.stringify(body));
		assert.match(
			body.name,
			new RegExp(`^\\d{4}-\\d{2}-\\d{2} \\d{2}\\.\\d{2}\\.\\d{2} Receipt - ${RUN_ID} taxi \\(2\\)\\.png$`)
		);

		const [file] = await driveFind(config.folders.receipts, `name = '${body.name}'`);
		assert.ok(file, `"${body.name}" did not appear in the receipts folder.`);
		assert.equal(file.mimeType, 'image/png');
		assert.ok((await driveContent(file.id)).equals(image), 'Stored bytes differ from the upload.');
	});

	it('rejects files that are not images', async () => {
		const res = await uploadReceipt(new File(['hello'], 'notes.txt', { type: 'text/plain' }));
		assert.equal(res.status, 415);
	});

	it('rejects a request without a file', async () => {
		const res = await uploadReceipt(null, { label: RUN_ID });
		assert.equal(res.status, 400);
	});
});

// --- Invoices: create, share, download, countersign ---------------------------

describe('invoice lifecycle', () => {
	let token;
	let partial;

	it('creates a partial invoice (sender signed) as a PDF plus data file', async () => {
		const res = await sendJson('POST', '/api/invoices', invoiceBody({ sender: signature('Sender Person') }));
		const body = await res.json();
		assert.equal(res.status, 201, JSON.stringify(body));
		assert.match(body.token, /^[A-Za-z0-9_-]{43}$/);
		token = body.token;

		const files = await byToken(token);
		assert.equal(files.length, 2, 'Expected exactly a PDF and a data file.');
		const pdf = files.find((file) => file.appProperties.kind === 'pdf');
		const data = files.find((file) => file.appProperties.kind === 'data');
		assert.ok(pdf && data);
		assert.match(pdf.name, new RegExp(`Invoice ${RUN_ID} - ${RUN_ID} client \\(PARTIAL\\)\\.pdf$`));
		assert.match(data.name, /\(PARTIAL\) data\.json$/);
		assert.equal(pdf.mimeType, 'application/pdf');
		assert.equal(pdf.appProperties.status, 'partial');
		assert.equal(pdfMagic(await driveContent(pdf.id)), '%PDF-');

		const record = JSON.parse((await driveContent(data.id)).toString('utf8'));
		assert.equal(record.token, token);
		assert.equal(record.status, 'partial');
		assert.equal(record.invoice.items.length, 2);
		assert.ok(record.signatures.sender && !record.signatures.recipient);
		partial = { pdf, data };
	});

	it('opens the share link', async () => {
		assert.ok(token, 'Needs the invoice from the previous step.');
		const res = await app(`/invoice/${token}`);
		assert.equal(res.status, 200);
		assert.equal(res.headers.get('cache-control'), 'no-store');
		assert.match(await res.text(), new RegExp(RUN_ID));
	});

	it('downloads the PDF from the share link', async () => {
		assert.ok(token, 'Needs the invoice from the previous step.');
		const res = await app(`/invoice/${token}/pdf`);
		assert.equal(res.status, 200);
		assert.equal(res.headers.get('content-type'), 'application/pdf');
		assert.match(res.headers.get('content-disposition') ?? '', /\(PARTIAL\)\.pdf/);
		assert.equal(pdfMagic(Buffer.from(await res.arrayBuffer())), '%PDF-');
	});

	it('completes the invoice when the recipient signs, overwriting the same files', async () => {
		assert.ok(token, 'Needs the invoice from the previous step.');
		const res = await sendJson('PUT', `/api/invoices/${token}`, {
			signatures: { recipient: signature('Recipient Person') }
		});
		const body = await res.json();
		assert.equal(res.status, 200, JSON.stringify(body));
		assert.equal(body.record.status, 'completed');

		const pdf = await driveFile(partial.pdf.id);
		const data = await driveFile(partial.data.id);
		assert.match(pdf.name, /\(COMPLETED\)\.pdf$/);
		assert.match(data.name, /\(COMPLETED\) data\.json$/);
		assert.equal(pdf.appProperties.status, 'completed');
		assert.equal(data.appProperties.status, 'completed');
		assert.equal((await byToken(token)).length, 2, 'Signing should not create extra files.');

		const record = JSON.parse((await driveContent(data.id)).toString('utf8'));
		assert.ok(record.signatures.sender && record.signatures.recipient);
		assert.equal(record.signatures.sender.name, 'Sender Person', 'Existing signature was changed.');
	});

	it('refuses a second signature once completed', async () => {
		assert.ok(token, 'Needs the invoice from the previous step.');
		const res = await sendJson('PUT', `/api/invoices/${token}`, {
			signatures: { recipient: signature('Someone Else') }
		});
		assert.equal(res.status, 409);
	});

	it('serves the completed PDF', async () => {
		assert.ok(token, 'Needs the invoice from the previous step.');
		const res = await app(`/invoice/${token}/pdf`);
		assert.equal(res.status, 200);
		assert.match(res.headers.get('content-disposition') ?? '', /\(COMPLETED\)\.pdf/);
	});
});

describe('invoice created fully signed', () => {
	it('is completed straight away', async () => {
		const res = await sendJson(
			'POST',
			'/api/invoices',
			invoiceBody({ sender: signature('Sender Person'), recipient: signature('Recipient Person') })
		);
		const body = await res.json();
		assert.equal(res.status, 201, JSON.stringify(body));
		const files = await byToken(body.token);
		assert.equal(files.length, 2);
		assert.ok(files.every((file) => file.appProperties.status === 'completed'));
		assert.ok(files.every((file) => file.name.includes('(COMPLETED)')));
	});
});

describe('invoice link expiry', () => {
	it('trashes a partial invoice once its link has expired', async () => {
		const res = await sendJson('POST', '/api/invoices', invoiceBody({ sender: signature('Sender Person') }));
		const { token } = await res.json();
		assert.equal(res.status, 201);
		const files = await byToken(token);
		assert.equal(files.length, 2);

		// Simulate 48 hours passing: the app reads the expiry from the data file.
		const data = files.find((file) => file.appProperties.kind === 'data');
		await drive.files.update({
			fileId: data.id,
			requestBody: { appProperties: { expiresAt: new Date(Date.now() - 60_000).toISOString() } },
			supportsAllDrives: true
		});

		const page = await app(`/invoice/${token}`);
		assert.equal(page.status, 410);
		for (const file of files) {
			assert.equal((await driveFile(file.id)).trashed, true, `${file.name} was not trashed.`);
		}
	});
});

describe('invoice input checks', () => {
	it('rejects an invoice without line items', async () => {
		const body = invoiceBody({});
		body.invoice.items = [];
		const res = await sendJson('POST', '/api/invoices', body);
		assert.equal(res.status, 400);
	});

	it('rejects a malformed signature', async () => {
		const res = await sendJson(
			'POST',
			'/api/invoices',
			invoiceBody({ sender: { name: 'X', image: 'data:image/png;base64,!!!' } })
		);
		assert.equal(res.status, 400);
	});

	it('returns 404 for an unknown link', async () => {
		const res = await app(`/invoice/${'A'.repeat(43)}`);
		assert.equal(res.status, 404);
	});
});
