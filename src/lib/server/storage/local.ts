import { randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { FilePatch, Folder, NewFile, Storage, StoredFile } from './index';

const ROOT = path.resolve('.local-drive');
const META = '.meta.json';

// Layout: .local-drive/<folder>/<uuid>/<file name> plus a .meta.json beside it.
// The id is "<folder>.<uuid>".
function dirFor(id: string): string {
	const [folder, uuid] = id.split('.');
	if (!/^(receipts|invoices)$/.test(folder) || !/^[0-9a-f-]{36}$/.test(uuid ?? '')) {
		throw new Error(`Invalid local file id: ${id}`);
	}
	return path.join(ROOT, folder, uuid);
}

async function readMeta(id: string): Promise<StoredFile> {
	return JSON.parse(await readFile(path.join(dirFor(id), META), 'utf8'));
}

async function writeMeta(file: StoredFile): Promise<void> {
	await writeFile(path.join(dirFor(file.id), META), JSON.stringify(file, null, '\t'));
}

/** Development stand-in for Google Drive that keeps files under ./.local-drive. */
export function createLocalStorage(): Storage {
	return {
		kind: 'local',

		async create(folder: Folder, file: NewFile) {
			const stored: StoredFile = {
				id: `${folder}.${randomUUID()}`,
				name: file.name,
				mimeType: file.mimeType,
				properties: file.properties ?? {}
			};
			const dir = dirFor(stored.id);
			await mkdir(dir, { recursive: true });
			await writeFile(path.join(dir, stored.name), file.data);
			await writeMeta(stored);
			return stored;
		},

		async update(id: string, patch: FilePatch) {
			const dir = dirFor(id);
			const current = await readMeta(id);
			const updated: StoredFile = {
				...current,
				name: patch.name ?? current.name,
				properties: { ...current.properties, ...patch.properties }
			};
			if (updated.name !== current.name) {
				await rename(path.join(dir, current.name), path.join(dir, updated.name));
			}
			if (patch.data) await writeFile(path.join(dir, updated.name), patch.data);
			await writeMeta(updated);
			return updated;
		},

		async read(id: string) {
			const meta = await readMeta(id);
			return readFile(path.join(dirFor(id), meta.name));
		},

		async find(folder: Folder, properties: Record<string, string>) {
			let entries: string[];
			try {
				entries = await readdir(path.join(ROOT, folder));
			} catch {
				return [];
			}
			const files: StoredFile[] = [];
			for (const entry of entries) {
				try {
					const meta = await readMeta(`${folder}.${entry}`);
					const matches = Object.entries(properties).every(
						([key, value]) => meta.properties[key] === value
					);
					if (matches) files.push(meta);
				} catch {
					// Not a stored file (or mid-write): skip it.
				}
			}
			return files;
		},

		async remove(id: string) {
			await rm(dirFor(id), { recursive: true, force: true });
		}
	};
}
