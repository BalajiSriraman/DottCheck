# DottCheck

A simple Vite + React app that uses Dott GBFS feeds to show bikes/scooters near your saved locations.

## Features

- Uses browser geolocation and stores a local location log.
- Loads available city slugs by country via `countries/{country}/gbfs.json`.
- Counts nearby free bikes/scooters within a configurable radius.
- Counts nearby station parking areas and available docks when `station_status` exists.
- Lets you pin locations (Home, Office, etc.) in local storage and re-check from a dropdown.
- Supports a browser-based 8:00 reminder (works while tab stays open).

## Local Run

```bash
npm install
npm run dev
```

## Hosting options

### 1) Vercel (fastest)

This repo already includes `vercel.json`.

```bash
npm install -g vercel
vercel
```

Then production deploy:

```bash
vercel --prod
```

### 2) Netlify

This repo includes `netlify.toml`.

```bash
npm install -g netlify-cli
netlify init
netlify deploy --build --prod
```

### 3) Docker (self-host / VPS)

```bash
docker build -t dottcheck .
docker run -p 8080:80 dottcheck
```

Open `http://localhost:8080`.

## Important Notes

- Requires modern browser with Geolocation + Notifications support.
- Browser notifications cannot reliably fire when the page is fully closed. For true unattended 8:00 reminders, use server cron + push notifications.
- Recommended Node.js is 22+.
