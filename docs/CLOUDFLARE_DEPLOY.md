# Cloudflare Deployment

## Goal

Deploy the current ScanGrade frontend to Cloudflare Pages and attach it to `scangrade.io`.

This is appropriate for the current app because:
- the frontend is a Vite static build
- iPad camera capture needs HTTPS
- Cloudflare already owns the domain

References:
- Camera secure context requirement: [MDN getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- Cloudflare Pages custom domains: [Cloudflare Pages docs](https://developers.cloudflare.com/pages/configuration/custom-domains/)
- Cloudflare Pages Vite guide: [Cloudflare Vite guide](https://developers.cloudflare.com/pages/framework-guides/deploy-a-vite3-project/)
- Wrangler Pages config: [Cloudflare Wrangler config docs](https://developers.cloudflare.com/pages/functions/wrangler-configuration/)

---

## What Is In This Repo

- `wrangler.toml`
  - Pages project name: `scangrade`
  - build output dir: `dist`
- `functions/api/*`
  - Pages Functions routes for shared roster and submissions
- `migrations/0001_scangrade.sql`
  - initial D1 schema for roster + submissions
- `public/_headers`
  - security headers
  - camera policy for self origin
  - caching for models, wasm, layouts, and logo

---

## Recommended First Deployment

### Build settings in Cloudflare Pages

Use:
- Framework preset: `Vite`
- Build command: `npm run build`
- Build output directory: `dist`

If Cloudflare asks for Node version, use a modern current LTS version that is compatible with Vite 5.

### Connect the repo

1. In Cloudflare dashboard, go to `Workers & Pages`
2. Create a new Pages project
3. Connect the GitHub repo for this project
4. Set build command to `npm run build`
5. Set output directory to `dist`
6. Deploy

After the first deploy, Cloudflare will provide a `*.pages.dev` preview domain.

---

## Attach `scangrade.io`

After the Pages project is live:

1. Open the Pages project
2. Go to `Custom domains`
3. Add `scangrade.io`
4. If desired, also add `www.scangrade.io`
5. Make one canonical and redirect the other

Since the domain is already on Cloudflare, this should be straightforward inside the same dashboard.

---

## Shared Storage Status

The frontend now prefers shared `/api/*` storage when the backend is configured, and falls back to localStorage only when the API is unavailable.

That means:
- local development still works without Cloudflare bindings
- production can use shared persistence across multiple iPads once D1 is configured
- if D1 is missing, the app still works but reverts to browser-local behavior

---

## Minimum Backend

The minimum backend is now scaffolded in the repo:
- Pages Functions for API routes
- D1 for relational data

Current API routes:
- `GET/PUT /api/roster`
- `GET/POST/DELETE /api/submissions`
- `PATCH/DELETE /api/submissions/:id`

If you later persist captured images or teacher annotations, add R2.

---

## D1 Setup

### 1. Create a D1 database

Create a D1 database in Cloudflare.

Recommended name:
- `scangrade`

### 2. Bind D1 to the Pages project

In the Pages project:
1. Go to `Settings`
2. Go to `Bindings`
3. Add a `D1 database` binding
4. Use variable name `DB`
5. Select the `scangrade` database
6. Redeploy the Pages project

Cloudflare documents D1 bindings for Pages here:
- [Pages Functions bindings](https://developers.cloudflare.com/pages/functions/bindings/)

### 3. Apply the schema

Apply:
- `migrations/0001_scangrade.sql`

This creates:
- `class_roster`
- `submissions`

### 4. Validate the backend

After binding D1 and redeploying:
- `GET /api/roster` should return JSON
- `GET /api/submissions` should return JSON
- roster edits and saved scans should persist across browsers/devices

---

## Immediate Validation Checklist

After production deploy:

1. Open `https://scangrade.io` on an iPad
2. Confirm camera permission prompt appears
3. Confirm live preview works
4. Confirm logo and loading screen appear correctly
5. Confirm worksheet scan path still works
6. Confirm student roster selection gates capture
7. Confirm saved scans appear on a second device/browser using the same site
8. Confirm teacher review status changes persist after refresh

---

## Suggested Next Build Step

After the domain is live:

1. create one real worksheet template such as `addition_2digit_v1`
2. verify the scanner on actual filled sheets
3. bind D1 so the shared backend is active on `scangrade.io`
4. then run a limited classroom pilot
