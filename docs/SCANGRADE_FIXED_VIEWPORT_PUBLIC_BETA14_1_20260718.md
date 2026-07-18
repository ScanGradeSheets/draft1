# ScanGrade fixed-viewport public Beta 14.1

- Date: 2026-07-18
- Source commit: `f4a75ef74a70422bb15cf6543662aaafe7790951`
- Build: `2026.07.18-fixed-workspace-beta-14-1`
- Production: `https://scangrade.io/`
- Immutable deployment: `https://bf5e2107.scangrade.pages.dev/`
- Immediate rollback (Beta 14): `https://f8045360.scangrade.pages.dev/`
- Earlier rollback (Beta 13): `https://835fb701.scangrade.pages.dev/`

## Repair

- Beta 14 constrained the app root but left the browser document scrollable on real Safari. Beta 14.1 locks the HTML document, body, and app root only while the scanner is open. It also disables overscroll/bounce for that state.
- Beta 14 used capture-only header dimensions, causing the logo to move and resize after Start Scan. Beta 14.1 uses one compact student header geometry on landing and capture screens.
- No recognition, crop, capture, confidence, grading, answer-key, correction, or annotation policy changed.

## Verification

- 171/171 repository tests passed, including source-level guards for the document lock and shared header geometry.
- Production build and exact-commit deploy-pruned build passed.
- A 390×844 phone viewport measured exactly 844 px of document height before and after Start Scan; during capture the body is fixed with hidden overflow, the bottom bar ends at 838 px, and the logo remains at x=173, y=6, 44×44 px on both screens.
- A 768×1024 older-iPad viewport measured exactly 1024 px of document height before and after Start Scan; the bottom bar ends at 1018 px, and the logo remains at x=362, y=6, 44×44 px on both screens.
- Production, immutable, local release, and the backend-looking `/api/submissions` path are byte-identical static HTML at SHA-256 `066cbefaab33d823d4968aca171c7ab4d39b715022c55a7e3285ae517ff1e4de`.
- Live JavaScript matches the release at SHA-256 `75feabb21fc7b1ae9a995267eaffb01d017786caad15a12b3cae18164c371335` and is served as `application/javascript` with same-origin camera permissions.
