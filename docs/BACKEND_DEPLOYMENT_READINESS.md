# Backend And Deployment Readiness

Created 2026-05-30 from a read-only inspection of the current Cloudflare/D1 scaffold.

## Plain-English Status

ScanGrade has a plausible Cloudflare Pages + D1 backend scaffold, but it should be treated as **not yet proven for a real classroom pilot**.

The frontend can be deployed as a static HTTPS app. The backend routes and database schema exist, but the shared persistence path still needs configuration and live-device validation.

## What Exists

Deployment docs:

- `docs/CLOUDFLARE_DEPLOY.md`

Cloudflare config:

- `wrangler.toml`
- Pages project name: `scangrade`
- Output directory: `dist`
- D1 binding example is present but not configured with a real database id.

Backend functions:

- `functions/api/roster.js`
- `functions/api/submissions/index.js`
- `functions/api/submissions/[id].js`
- `functions/_lib/db.js`

D1 migration:

- `migrations/0001_scangrade.sql`

Tables:

- `class_roster`
- `submissions`

API shape:

- `GET /api/roster`
- `PUT /api/roster`
- `GET /api/submissions`
- `POST /api/submissions`
- `DELETE /api/submissions`
- `PATCH /api/submissions/:id`
- `DELETE /api/submissions/:id`

## What This Is Good For

This is enough to support a prototype goal:

- shared class roster
- submissions from multiple iPads
- teacher review status
- persistence beyond one browser's localStorage

It fits the narrow classroom loop:

1. student chooses name
2. student scans worksheet
3. result saves
4. teacher reviews later

## Not Yet Proven

Before relying on this in a classroom, verify:

- Cloudflare Pages deploy succeeds from the repo.
- D1 database exists.
- D1 binding named `DB` is configured.
- Migration has been applied to the production D1 database.
- `GET /api/roster` works on the deployed site.
- `GET /api/submissions` works on the deployed site.
- Roster changes persist after refresh.
- A scan saved on one iPad appears on another device.
- Teacher review status persists after refresh.

## Risks

Access/security:

- The current API scaffold does not show authentication or teacher-only authorization.
- `PUT /api/roster` and `DELETE /api/submissions` are powerful operations.
- Do not expose a real classroom roster publicly without deciding the access model.

Data model:

- Submissions store OCR results and review metadata, but not original images.
- If Tony needs image review or later audit, add image storage deliberately, likely R2.

Product timing:

- Backend work should not outrun worksheet/OCR validation.
- Shared persistence matters for pilot, but the immediate blocker remains real student sample testing.

## Recommended Next Backend Step

Do not build more backend features yet.

When the worksheet sample test is promising, do this next:

1. Create/bind a D1 database named `scangrade`.
2. Apply `migrations/0001_scangrade.sql`.
3. Deploy to a Cloudflare Pages preview URL.
4. Test roster persistence from two browsers.
5. Test one saved submission from one device and review from another.
6. Decide the minimum access boundary before using real student names.

## What Not To Do Yet

- Do not add admin dashboards.
- Do not add analytics.
- Do not add multi-class management.
- Do not add image storage until teacher review needs it.
- Do not deploy with real student data until access control is decided.

## Mission Control Summary

Backend/deployment is a later milestone. The current safe status is:

- scaffold exists
- deployment docs exist
- D1 schema exists
- production classroom persistence is not proven
- access model is not decided
