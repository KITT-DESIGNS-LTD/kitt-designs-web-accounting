import type { SignatureDraft } from './invoice';

// The user's signature, remembered on this device for reuse. It lives in
// localStorage rather than a cookie: a signature image is far larger than the
// 4 KB a cookie can hold, and it never needs to be sent to the server.
const KEY = 'saved-signature';

export const savedSignature = $state<{ value: SignatureDraft | null }>({ value: null });

/** Call once the page is running in the browser. */
export function loadSavedSignature() {
	try {
		const stored = JSON.parse(localStorage.getItem(KEY) ?? 'null');
		savedSignature.value =
			typeof stored?.image === 'string' ? { image: stored.image, name: String(stored.name ?? '') } : null;
	} catch {
		savedSignature.value = null;
	}
}

export function rememberSignature(signature: SignatureDraft) {
	savedSignature.value = { ...signature };
	try {
		localStorage.setItem(KEY, JSON.stringify(savedSignature.value));
	} catch {
		// Storage unavailable (e.g. private browsing): keep it for this visit only.
	}
}

export function forgetSignature() {
	savedSignature.value = null;
	try {
		localStorage.removeItem(KEY);
	} catch {
		// Nothing was stored.
	}
}
