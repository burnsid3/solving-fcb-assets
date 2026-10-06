# Solving-FCB assets (Cloudflare R2)

Static media for the website: images, maps, geojson, files, and Deep Dive podcast audio.

**Why R2 (not Pages):** many `.m4a` files are over Pages’ **25 MiB** per-file limit. R2 has no such cap for object storage.

## One-time setup

```bash
npm install
npx wrangler login
npm run bucket:create
```

In the Cloudflare dashboard:

1. **R2 → `solvingfcb-assets` → Settings → Public access / Custom Domains**
2. Attach a domain (recommended) or enable the `*.r2.dev` public URL
3. Optional: CORS allow `GET`/`HEAD` from your site origin (or `*`) so audio/images load cross-origin

## Upload / refresh

```bash
npm run deploy
```

That regenerates `index.html` / `manifest.json` (if the generate script is present) and syncs files into the bucket.

## Website

```text
ASSETS_BASE_URL=https://assets.your-domain.tld
```

Podcasts resolve at `{ASSETS_BASE_URL}/podcast/<file>.m4a`.
