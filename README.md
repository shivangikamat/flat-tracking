# Flat Tracking

A personal Edinburgh flat-hunting dashboard for collecting rental listings in one place, tracking enquiries, saving notes, and scheduling viewings.

This project is designed for private, non-commercial use. It does not scrape listing websites directly. Instead, it imports the alert emails you already receive from property websites, such as OnTheMarket, and turns those emails into listings in the app.

## Features

- Import rental listings from saved `.eml` alert emails.
- Sync listings from a Gmail label, such as `Flat Alerts`.
- Track listing status, notes, rent, bedrooms, area, source, and original URL.
- Group listings by Edinburgh postcode district.
- Sort listings by rent, newest first, postcode, or distance from Appleton Tower.
- Add viewing details to listings.
- View scheduled viewings on a calendar page.
- Store private app data locally in `flat-hunter/data/flat-hunter.json`.

## Project Structure

```txt
flat-hunter/
  src/app/              Next.js pages, server actions, and styling
  src/lib/              Local JSON database helpers
  scripts/              Email import and Gmail sync scripts
  data/                 Local listing data, ignored by git
  secrets/              OAuth credentials and tokens, ignored by git
```

## Requirements

- Node.js
- npm
- A Gmail label containing property alert emails, if using Gmail sync
- Google OAuth desktop credentials, if using Gmail sync

## Run Locally

```bash
cd flat-hunter
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Import Saved Email Files

Export property alert emails as `.eml` files, then run:

```bash
cd flat-hunter
npm run import:eml -- "/path/to/property-alert.eml"
```

You can pass multiple `.eml` files in one command. The importer deduplicates listings by email message ID and listing URL.

## Sync a Gmail Label

Create Google OAuth desktop credentials and save the downloaded JSON file here:

```txt
flat-hunter/secrets/google-oauth.json
```

Then run:

```bash
cd flat-hunter
npm run sync:gmail
```

The first sync opens a Google authorization flow for Gmail read-only access. After approval, the app stores a local token in:

```txt
flat-hunter/secrets/gmail-token.json
```

By default, the sync reads the Gmail label named `Flat Alerts`. To use a different label:

```bash
GMAIL_LABEL_NAME="Your Label" npm run sync:gmail
```

## App Data

Listings, viewings, and imported email records are stored locally in:

```txt
flat-hunter/data/flat-hunter.json
```

This file is intentionally ignored by git because it contains personal rental search data.

## Useful Commands

```bash
cd flat-hunter
npm run dev
npm run lint
npm run build
npm run sync:gmail
```

## Notes

The app only imports listings from data you provide through alert emails or Gmail sync. It does not include fake sample listings, and it does not automatically contact agents.
