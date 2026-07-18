# ScanGrade natural-review public Beta 11

- Date: 2026-07-18
- Source commit: `a9a0a26d6d4e39956c73647e89e5d61df3ee7d5d`
- Build: `2026.07.18-natural-review-beta-11`

## Live release

- Production: `https://scangrade.io/`
- Immutable deployment: `https://ea1d3e0a.scangrade.pages.dev/`
- Cloudflare Pages project: `scangrade`
- Production branch: `autobuild/safe-20260223`

The application was built from the exact source commit with Vite base `/` and the deploy-only public asset prune. Existing public worksheet/QR assets, the P05 browser-recovery page, and the previously public legacy root model were preserved. The upload directory contained 220 static files (219 ordinary assets plus `_headers`) and no Pages Functions, `_worker.js`, `_routes.json`, Tailscale hostname, or Mac Mini address.

## Shipped behavior

- Natural fluorescent-yellow chisel swipes use a small seeded angle, restrained side overhang, and roughly parallel ends derived from one simulated nib angle.
- A single uncertain slot in a two-digit answer highlights only that slot. If both slots are uncertain, one uninterrupted swipe spans both.
- Multi-slot teacher correction still confirms the complete answer so a hidden OCR error cannot survive correction.
- Correction entry no longer opens the iPhone keyboard until the teacher taps the input; the panel then scrolls above the visual keyboard.
- Blank controls are compact and preserve the distinction among left blank, right blank, and all blank.
- Date placement is constrained to an approved empty zone for the ten launch layouts and omitted for unknown layouts. During `Scanning`, the date lands with a small ink animation before the top bar changes to `Grading` for annotation strokes.

Recognition, crop, capture, confidence, mathematical grading, answer-key separation, and automatic acceptance policy are unchanged.

## Verification

- 163/163 repository tests passed.
- Production and pruned root-domain builds passed.
- The full real mobile WebKit correction/animation replay passed every gate, including date-during-scanning, keyboard deferral, popup/answer non-overlap, correction integrity, manual blank handling, and progressive marks.
- A fresh production in-app-browser session mounted `ScanGrade` with the exact Beta 11 label and zero console errors.
- The production HTML, immutable HTML, and local release artifact are byte-identical.
- `http://scangrade.io/` permanently redirects to HTTPS.
- The live JavaScript is served as `application/javascript`, and existing QR-linked worksheet layouts remain available as JSON.
- `/api/submissions` and `/review-model/health` return the same static HTML as the homepage, confirming that no public backend or Mac Mini review route was deployed.

Artifact hashes:

- `dist/index.html`: `24c8837cece44ea849c8e2052d99861fe723ae04143ab90e115f229ef269a3c2`
- `dist/assets/index-DPGoztVn.js`: `2e518efb84e1e42bb5d0ff1f90dc04b5f8891b024d93895459dc4abfce6b088b`
- `dist/assets/index-BcfMbl_N.css`: `759ea25ecc035ec80d56185467dc0fbc15d7af0db5cafc70cfa2730a4c17d3e5`

## Superseded metadata-only deployment

The first successful Beta 11 upload produced `https://188541ac.scangrade.pages.dev/` with the correct files but an incorrectly expanded commit hash in Cloudflare's deployment metadata. It was immediately superseded with the byte-identical artifact and correct full source hash. The final production deployment is `ea1d3e0a` above.
