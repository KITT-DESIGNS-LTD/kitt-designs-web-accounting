import { env } from '$env/dynamic/private';

function parts(date: Date): Record<string, string> {
	const options: Intl.DateTimeFormatOptions = {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hourCycle: 'h23'
	};
	let format: Intl.DateTimeFormat;
	try {
		format = new Intl.DateTimeFormat('en-US', { ...options, timeZone: env.APP_TIMEZONE || undefined });
	} catch {
		// Unknown APP_TIMEZONE: fall back to the server's timezone.
		format = new Intl.DateTimeFormat('en-US', options);
	}
	return Object.fromEntries(format.formatToParts(date).map((part) => [part.type, part.value]));
}

/** YYYY-MM-DD in the app timezone. */
export function fileDate(date: Date): string {
	const p = parts(date);
	return `${p.year}-${p.month}-${p.day}`;
}

/** HH.MM.SS in the app timezone (no colons: they are awkward in file names). */
export function fileTime(date: Date): string {
	const p = parts(date);
	return `${p.hour}.${p.minute}.${p.second}`;
}

/** Strips characters that are unsafe in file names and collapses whitespace. */
export function safeNamePart(text: string, maxLength = 60): string {
	return text
		.replace(/[\\/:*?"<>|\p{Cc}]/gu, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, maxLength)
		.trim();
}
