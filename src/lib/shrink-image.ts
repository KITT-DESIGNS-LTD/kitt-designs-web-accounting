// The host (Vercel) rejects request bodies over 4.5 MB, so large photos are
// re-encoded in the browser before upload. Receipts stay perfectly legible.
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_SIDE = 3000;

export async function shrinkImage(file: File): Promise<File> {
	if (file.size <= MAX_UPLOAD_BYTES) return file;

	let bitmap: ImageBitmap;
	try {
		bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
	} catch {
		return file; // a format the browser can't decode (e.g. HEIC outside Safari)
	}
	const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
	const canvas = document.createElement('canvas');
	canvas.width = Math.round(bitmap.width * scale);
	canvas.height = Math.round(bitmap.height * scale);
	canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
	bitmap.close();

	for (const quality of [0.85, 0.7, 0.55]) {
		const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/jpeg', quality));
		if (blob && blob.size <= MAX_UPLOAD_BYTES) {
			const name = file.name.replace(/\.[^.]*$/, '') + '.jpg';
			return new File([blob], name, { type: 'image/jpeg' });
		}
	}
	return file;
}
