import { env } from '$env/dynamic/private';
import { createDriveStorage, driveConfigFromEnv } from './drive';
import { createLocalStorage } from './local';

export type Folder = 'receipts' | 'invoices';

export interface StoredFile {
	id: string;
	name: string;
	mimeType: string;
	/** Private key/value metadata (Drive appProperties): short ASCII values only. */
	properties: Record<string, string>;
}

export interface NewFile {
	name: string;
	mimeType: string;
	data: Buffer;
	properties?: Record<string, string>;
}

export interface FilePatch {
	name?: string;
	/** New content; pass mimeType along with it. */
	data?: Buffer;
	mimeType?: string;
	/** Merged into the existing properties. */
	properties?: Record<string, string>;
}

export interface Storage {
	readonly kind: 'drive' | 'local';
	create(folder: Folder, file: NewFile): Promise<StoredFile>;
	/** Overwrites the file in place, keeping its id. */
	update(id: string, patch: FilePatch): Promise<StoredFile>;
	read(id: string): Promise<Buffer>;
	/** Files in the folder whose properties match all of the given pairs. */
	find(folder: Folder, properties: Record<string, string>): Promise<StoredFile[]>;
	remove(id: string): Promise<void>;
}

let storage: Storage | undefined;

/** Google Drive when credentials are configured, otherwise a local folder for development. */
export function getStorage(): Storage {
	if (!storage) {
		const driveConfig = driveConfigFromEnv(env);
		storage = driveConfig ? createDriveStorage(driveConfig) : createLocalStorage();
	}
	return storage;
}
