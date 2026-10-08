import { getStorage } from '$lib/server/storage';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = () => {
	return { storageKind: getStorage().kind };
};
