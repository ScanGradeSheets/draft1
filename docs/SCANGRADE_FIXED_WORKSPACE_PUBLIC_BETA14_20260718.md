# ScanGrade fixed-workspace public Beta 14

- Date: 2026-07-18
- Source commit: `0ff92a4a32f389c251dfcaf87470ebee7e8d0f37`
- Build: `2026.07.18-fixed-workspace-beta-14`
- Production: `https://scangrade.io/`
- Immutable deployment: `https://f8045360.scangrade.pages.dev/`
- Rollback deployment (Beta 13): `https://835fb701.scangrade.pages.dev/`
- Cloudflare Pages project: `scangrade`
- Production branch: `autobuild/safe-20260223`

## Shipped behavior

- The scan/captured-sheet stage sits immediately below a compact ScanGrade header.
- Home, Login, the recognition-view toggle, and New Scan sit in a reachable bar below the sheet instead of above it.
- Normal scans remain in a fixed app-like viewport and no longer expand a second result-card section below the sheet. Debug Scan retains its detailed export/result card.
- The small blue toggle overlays ScanGrade's detected reading directly above each physical answer slot. A detected empty slot is shown as `_`; no recognition decision changes when this view is opened.
- The iPad date stamp is modestly larger but remains inside the worksheet-declared date zone. Unknown layouts still omit the date rather than guess.
- Recognition, capture, crop, grading, confidence, answer-key separation, teacher-correction integrity, and public browser-only operation are unchanged.

## Verification

- 170/170 repository tests passed.
- The exact-commit, deploy-pruned production build passed.
- Production HTML, immutable HTML, and the local release artifact are byte-identical at SHA-256 `375c930e152d49e84e7f19d87233b66e5fb557cc84df2fb1cc0726e2664e4be4`.
- Production JavaScript is served as `application/javascript`, contains the exact Beta 14 label, and matches the local release at SHA-256 `4e7daafe8c12b875d2fe08cd8d664103223f1aba721496d069f1ab1085849493`.
- `/api/submissions` and `/review-model/health` are byte-identical static SPA fallbacks on both production and the immutable deployment. There is no public Pages Function, Worker, D1 binding, Tailscale host, or Mac Mini route.
- HTTP redirects permanently to HTTPS, camera permission is restricted to the same origin, and a representative QR-linked worksheet layout is served as JSON.

## Superseded upload

- Deployment `83eaca76` was immediately superseded before handoff because Wrangler discovered the repository's dormant Pages Functions while invoked from the repository working directory. Its D1 binding was unconfigured, but the API route did not belong in this public build.
- Final deployment `f8045360` was uploaded from an isolated directory containing only the 221 validated static release files. Wrangler uploaded no Functions bundle, and direct route checks prove the final deployment is static-only.
