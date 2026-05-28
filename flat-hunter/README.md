# Flat Hunter

A private Edinburgh flat-hunting dashboard for tracking real rental listings, enquiries, notes, and viewings.

## Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## What Works Now

- Add a real listing by URL.
- Track source, title/address, rent, area, bedrooms, and notes.
- Update listing status.
- Add viewing times and contact details.
- Import OnTheMarket property alert `.eml` files.
- Store local data in `data/flat-hunter.json`.

The app starts empty and does not include sample or fake listings.

## Next Data Needed

To build the automatic email importer, provide either:

- 3-5 real alert emails exported as `.eml` files from your `Flat Alerts` label, or
- temporary Gmail API OAuth credentials for a local-only read-only importer.

The first parser supports the OnTheMarket alert format in the sample `.eml` files.

## Import Alert Emails

```bash
npm run import:eml -- "/path/to/property-alert.eml"
```

You can pass several `.eml` files at once. The importer dedupes by email message ID and listing URL.
