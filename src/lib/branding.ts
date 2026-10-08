// Company branding used by the web UI and the generated invoice PDFs.
// Edit the values below (and replace assets/logo.png) to rebrand the app.
import logo from './assets/logo.png?inline';

export const branding = {
	companyName: 'Kitt Designs LTD',
	// Multi-line contact block used by the "Use company details" shortcut.
	companyDetails:
		"Unit 1603, 16th Floor, The L. Plaza\n367 - 375 Queen's Road Central\nSheung Wan, Hong Kong SAR China",
	// Brand red: headings, highlights and focus rings.
	accentColor: '#fd4658',
	// Brand navy: text, buttons and table headers (white text stays readable on it).
	inkColor: '#02021a',
	// Printed at the bottom of every PDF page.
	footer: 'Thank you for your business.',
	// Locale for number and date formatting.
	locale: 'en-HK',
	pageSize: 'A4' as 'A4' | 'LETTER',
	defaults: {
		currency: 'USD',
		paymentTerms: '',
		notes: '',
		terms: ''
	}
};

/** The logo as a PNG data URL, used by both the web pages and the PDF. */
export const logoDataUrl: string = logo;
