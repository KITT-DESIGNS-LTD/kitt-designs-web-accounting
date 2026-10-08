// pdfmake 0.3 ships no type definitions; this covers the server API we use.
declare module 'pdfmake' {
	interface PdfDocument {
		getBuffer(): Promise<Buffer>;
	}
	const pdfmake: {
		setFonts(fonts: Record<string, Record<string, string>>): void;
		setUrlAccessPolicy(callback: (url: string) => boolean): void;
		setLocalAccessPolicy(callback: (path: string) => boolean): void;
		createPdf(docDefinition: Record<string, unknown>): PdfDocument;
	};
	export default pdfmake;
}

declare module 'pdfmake/fonts/Roboto.js' {
	const fonts: { Roboto: Record<string, string> };
	export default fonts;
}
