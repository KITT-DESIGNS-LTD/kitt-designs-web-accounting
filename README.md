# Kitt accounting web app

A small SvelteKit app with two tools:

- **Receipt** (`/receipt`): upload receipt photos to a Google Drive folder, by file picker, drag and drop, or the device camera.
- **Invoice** (`/invoice`): build an invoice with the company branding, sign it, and share a link so the other party can sign.

## Run it

```sh
npm install
cp .env.example .env   # then fill it in, see below
npm run dev            # development, http://localhost:5173
```

Without Google credentials the app still works: files go to `./.local-drive` and a banner says so.

Production:

```sh
npm run build
npm start              # reads .env; serves on PORT (default 3000)
```

Set `ORIGIN` to the public URL and keep `BODY_SIZE_LIMIT` (see `.env.example`), otherwise photo uploads are rejected. The camera button needs HTTPS.

## Google Drive setup

1. Create two Drive folders (receipts, invoices) and put their IDs in `.env`.
2. In Google Cloud Console, create a project and enable the **Google Drive API**.
3. Give the app credentials, one of:
   - **Service account** (folders must be in a *Shared Drive*): create a key, add the service account's email to the Shared Drive as Content manager, and set `GOOGLE_SERVICE_ACCOUNT_JSON`.
   - **A Google user** (works with a personal My Drive): create an OAuth client of type *Desktop app*, set `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET`, run `npm run google-token`, and set `GOOGLE_OAUTH_REFRESH_TOKEN` to what it prints.

## Wet-run tests

`tests/wetrun.test.mjs` exercises a running app against the real Drive folders in `.env`: receipt upload, and the full invoice flow (create partial, open link, download PDF, countersign to completed, double-sign refused, link expiry trashing a partial invoice, input checks). Each step checks both the HTTP response and the files in Drive.

```sh
npm run dev                # in another terminal
npm run test:wetrun        # set WETRUN_BASE_URL to test another instance
```

Test files are labelled `WETRUN-<timestamp>` and moved to the Drive trash afterwards.

## How invoices are stored

Saving an invoice writes two files to the invoices folder:

- `2026-10-01 Invoice INV-042 - Client (PARTIAL).pdf`: the invoice itself.
- `2026-10-01 Invoice INV-042 - Client (PARTIAL) data.json`: what the app needs to reopen it from the share link. Don't edit or move it while the link is live.

The share link (`/invoice/<token>`) works for 48 hours. When the second party signs, both files are overwritten in place and renamed to `(COMPLETED)`. An invoice that is still partial after 48 hours is moved to the Drive trash (checked every 15 minutes while the server runs, and whenever its link is opened). Completed invoices stay; only their link stops working.

Once saved, the invoice content and existing signatures cannot be changed through the link: the other party can only add the missing signature.

Receipts are named after the upload time, e.g. `2026-10-01 14.32.05 Receipt - Taxi (2).jpg`. Dates use `APP_TIMEZONE`.

## Branding

Company name, address, colours, footer, default currency and page size live in `src/lib/branding.ts`. The logo is `src/lib/assets/logo.png` (used on the pages and in the PDF); `static/favicon.png` is the browser tab icon.

## Access

When `STAFF_PASSWORD` is set, every page asks for that password once (remembered for 90 days). Invoice share links (`/invoice/<token>`, its PDF and signing) stay open so the other party can sign. Changing the password signs everyone out.

## Hosting

Live at https://staff.kittdesigns.com/accounting on Vercel (Hobby plan). The app is served under the `/accounting` base path (`svelte.config.js`); `/` redirects there (`vercel.json`).

- Builds on Vercel use `@sveltejs/adapter-vercel`; everywhere else the Node adapter is used, so `npm start` still works.
- Deploy: `npx vercel --prod`.
- Env vars (Vercel project settings): the Drive and Google credentials, `APP_TIMEZONE`, `STAFF_PASSWORD`, `CRON_SECRET`. `ORIGIN`, `PORT` and `BODY_SIZE_LIMIT` are not used there.
- Vercel rejects requests over 4.5 MB, so the receipt page shrinks large photos in the browser before uploading.
- No long-running server, so expired partial invoices are swept by a daily cron (`vercel.json`) plus whenever a link is opened.
- DNS: `kittdesigns.com` uses Cloudflare nameservers; `staff` is a CNAME to Vercel there.
