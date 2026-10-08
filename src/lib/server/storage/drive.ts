import { Readable } from 'node:stream';
import { auth, drive as createDrive, type drive_v3 } from '@googleapis/drive';
import type { FilePatch, Folder, NewFile, Storage, StoredFile } from './index';

const SCOPES = ['https://www.googleapis.com/auth/drive'];
const FIELDS = 'id, name, mimeType, appProperties';

type DriveAuth = drive_v3.Options['auth'];

export interface DriveConfig {
	auth: DriveAuth;
	folders: Record<Folder, string | undefined>;
}

function parseServiceAccount(raw: string): Record<string, string> {
	const text = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
	try {
		return JSON.parse(text);
	} catch {
		throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON (plain or base64-encoded).');
	}
}

/** Returns null when no Google credentials are configured at all. */
export function driveConfigFromEnv(env: Record<string, string | undefined>): DriveConfig | null {
	const folders = {
		receipts: env.GOOGLE_DRIVE_RECEIPTS_FOLDER_ID,
		invoices: env.GOOGLE_DRIVE_INVOICES_FOLDER_ID
	};

	if (env.GOOGLE_SERVICE_ACCOUNT_JSON) {
		const credentials = parseServiceAccount(env.GOOGLE_SERVICE_ACCOUNT_JSON);
		return { auth: new auth.GoogleAuth({ credentials, scopes: SCOPES }), folders };
	}

	const { GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REFRESH_TOKEN } = env;
	if (GOOGLE_OAUTH_CLIENT_ID || GOOGLE_OAUTH_CLIENT_SECRET || GOOGLE_OAUTH_REFRESH_TOKEN) {
		if (!GOOGLE_OAUTH_CLIENT_ID || !GOOGLE_OAUTH_CLIENT_SECRET || !GOOGLE_OAUTH_REFRESH_TOKEN) {
			throw new Error(
				'Set all of GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET and GOOGLE_OAUTH_REFRESH_TOKEN.'
			);
		}
		const client = new auth.OAuth2(GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET);
		client.setCredentials({ refresh_token: GOOGLE_OAUTH_REFRESH_TOKEN });
		return { auth: client, folders };
	}

	if (folders.receipts || folders.invoices) {
		throw new Error(
			'Google Drive folder IDs are set but no credentials are. Set GOOGLE_SERVICE_ACCOUNT_JSON or the GOOGLE_OAUTH_* variables.'
		);
	}
	return null;
}

function toStoredFile(file: drive_v3.Schema$File): StoredFile {
	return {
		id: file.id!,
		name: file.name ?? '',
		mimeType: file.mimeType ?? 'application/octet-stream',
		properties: (file.appProperties as Record<string, string> | null | undefined) ?? {}
	};
}

function quote(value: string): string {
	return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

export function createDriveStorage(config: DriveConfig): Storage {
	const drive = createDrive({ version: 'v3', auth: config.auth });

	function folderId(folder: Folder): string {
		const id = config.folders[folder];
		if (!id) throw new Error(`GOOGLE_DRIVE_${folder.toUpperCase()}_FOLDER_ID is not set.`);
		return id;
	}

	return {
		kind: 'drive',

		async create(folder: Folder, file: NewFile) {
			const res = await drive.files.create({
				requestBody: {
					name: file.name,
					parents: [folderId(folder)],
					appProperties: file.properties
				},
				media: { mimeType: file.mimeType, body: Readable.from(file.data) },
				fields: FIELDS,
				supportsAllDrives: true
			});
			return toStoredFile(res.data);
		},

		async update(id: string, patch: FilePatch) {
			const res = await drive.files.update({
				fileId: id,
				requestBody: { name: patch.name, appProperties: patch.properties },
				media: patch.data
					? { mimeType: patch.mimeType, body: Readable.from(patch.data) }
					: undefined,
				fields: FIELDS,
				supportsAllDrives: true
			});
			return toStoredFile(res.data);
		},

		async read(id: string) {
			const res = await drive.files.get(
				{ fileId: id, alt: 'media', supportsAllDrives: true },
				{ responseType: 'arraybuffer' }
			);
			return Buffer.from(res.data as unknown as ArrayBuffer);
		},

		async find(folder: Folder, properties: Record<string, string>) {
			const clauses = [`${quote(folderId(folder))} in parents`, 'trashed = false'];
			for (const [key, value] of Object.entries(properties)) {
				clauses.push(`appProperties has { key=${quote(key)} and value=${quote(value)} }`);
			}
			const files: StoredFile[] = [];
			let pageToken: string | undefined;
			do {
				const res = await drive.files.list({
					q: clauses.join(' and '),
					fields: `nextPageToken, files(${FIELDS})`,
					pageSize: 200,
					pageToken,
					supportsAllDrives: true,
					includeItemsFromAllDrives: true
				});
				files.push(...(res.data.files ?? []).map(toStoredFile));
				pageToken = res.data.nextPageToken ?? undefined;
			} while (pageToken);
			return files;
		},

		// Moves the file to the trash rather than deleting it outright: this works
		// with any editor role (permanent deletion needs owner/manager rights) and
		// Drive purges the trash by itself after 30 days.
		async remove(id: string) {
			await drive.files.update({
				fileId: id,
				requestBody: { trashed: true },
				supportsAllDrives: true
			});
		}
	};
}
