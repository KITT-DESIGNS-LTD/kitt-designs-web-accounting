import { error, json } from '@sveltejs/kit';
import { fileDate, fileTime, safeNamePart } from '$lib/server/naming';
import { getStorage } from '$lib/server/storage';
import type { RequestHandler } from './$types';

const MAX_BYTES = 25 * 1024 * 1024;

const EXTENSIONS: Record<string, string> = {
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'image/webp': 'webp',
	'image/heic': 'heic',
	'image/heif': 'heif',
	'image/gif': 'gif',
	'image/avif': 'avif',
	'image/tiff': 'tiff',
	'image/bmp': 'bmp'
};

function extensionFor(file: File): string {
	const fromName = /\.([A-Za-z0-9]{1,5})$/.exec(file.name)?.[1].toLowerCase();
	return EXTENSIONS[file.type] ?? fromName ?? 'jpg';
}

// Uploads one receipt photo. The file is named after the upload time, e.g.
// "2026-10-01 14.32.05 Receipt - taxi (2).jpg".
export const POST: RequestHandler = async ({ request }) => {
	const form = await request.formData();
	const file = form.get('file');
	if (!(file instanceof File) || !file.size) error(400, 'No image was uploaded.');
	if (!file.type.startsWith('image/')) error(415, 'Only image files can be uploaded.');
	if (file.size > MAX_BYTES) error(413, 'The image is larger than 25 MB.');

	const label = safeNamePart(String(form.get('label') ?? ''), 60);
	const sequence = Number(form.get('sequence'));
	const now = new Date();

	let name = `${fileDate(now)} ${fileTime(now)} Receipt`;
	if (label) name += ` - ${label}`;
	if (Number.isInteger(sequence) && sequence > 0) name += ` (${sequence})`;
	name += `.${extensionFor(file)}`;

	try {
		const stored = await getStorage().create('receipts', {
			name,
			mimeType: file.type,
			data: Buffer.from(await file.arrayBuffer())
		});
		return json({ name: stored.name }, { status: 201 });
	} catch (err) {
		console.error('Receipt upload failed:', err);
		error(502, 'Could not save the receipt. Please try again.');
	}
};
