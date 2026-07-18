# ScanGrade correction-integrity public Beta 10

Date: 2026-07-18  
Source commit: `fa651edd5a1c2dc07842b96208b3e3266b8a6131`  
Build: `2026.07.18-correction-integrity-beta-10`

## Live release

- Production: `https://scangrade.io/`
- Immutable deployment: `https://49b81077.scangrade.pages.dev/`
- Cloudflare Pages project: `scangrade`
- Production branch: `autobuild/safe-20260223`

The upload came from a clean directory containing only the 221 pruned static build files. It contains no Pages Functions and no public route to the Mac Mini.

## Shipped behavior

- Teacher corrections now use one normalized contract for prediction cells, grading, display cards, correction history, replacement text, and the final raster annotation.
- Every multi-slot correction edits the whole answer, preventing an unreviewed OCR digit from surviving a teacher correction.
- A one-digit correction in two physical boxes requires `Left blank` or `Right blank`; `No answer` explicitly confirms both boxes blank.
- The correction card autofocuses, closes on an outside tap, applies suggestions in one tap, anchors its arrow to the answer, and does not cover the active answer.
- Yellow review marks use a transparent, nearly full-box-height fluorescent chisel swipe with only slight horizontal overrun.
- Checks are one continuous left-to-right teacher pen stroke; X marks are two crossing strokes. Manual corrections use the same animation.
- The worksheet status bubble was removed. The existing top bar says `Scanning` during capture/OCR and `Grading` while annotation strokes animate.

Recognition, crop, capture, confidence, grading-key separation, and automatic acceptance policy are unchanged.

## Verification

- 157/157 repository tests passed.
- Root-domain production build passed.
- The real mobile WebKit workflow passed every gate: pending-answer concealment, final-image concealment, pen-stroke structure, correction placement, input focus, outside close, one-tap choice, complete two-digit correction and regrade, animated correction, explicit blank position, and no-answer resolution.
- Live mobile WebKit mounted the production app with the exact Beta 10 label and no console or page errors.
- `http://scangrade.io/` redirects permanently to HTTPS. The live TLS certificate is valid for `scangrade.io` through 2026-10-15.
- The production and immutable HTML are byte-identical. `/api/submissions` and `/review-model/health` return that same static HTML rather than backend responses.

Artifact hashes:

- `dist/index.html`: `f22a5e1903de7c424e6ba7f70d74e22db1c865a3cd025ab0e9d4d44ec18c80f6`
- `dist/assets/index-Dx1HUOrO.js`: `c98a2e642226ab2ca094f7beddb1d71c8290d4fbbd23914523cc6f8e4695b7e1`
- `dist/assets/index-cq_jnjcC.css`: `b83bb4d0bc4a378787b7b22d9789ad2a8d3d53ce7e74daf5a6d655bc1e9d883a`

## Superseded empty deployment

An initial Wrangler command was run from `/tmp` while referring to relative `dist`, so it uploaded zero files and created `https://2ebb6071.scangrade.pages.dev/`. The `0/0` upload count exposed the error immediately. It was superseded by the verified complete deployment above; production was checked only after the complete artifact was live.
