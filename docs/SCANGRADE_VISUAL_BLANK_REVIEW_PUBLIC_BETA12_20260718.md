# ScanGrade visual blank-position review public Beta 12

- Date: 2026-07-18
- Source commit: `5d67c7464e6fb67b38f632a53bc2d54929f6e759`
- Build: `2026.07.18-visual-blank-review-beta-12`
- Production: `https://scangrade.io/`
- Immutable deployment: `https://192b81e5.scangrade.pages.dev/`
- Cloudflare Pages project: `scangrade`
- Production branch: `autobuild/safe-20260223`

## Shipped behavior

- A confidently empty worksheet-declared optional slot is ordinary recognition evidence. It remains blank with no yellow highlight or blank-position prompt; the complete answer receives only its normal check or X.
- Blank-position controls appear only inside an answer already sent to teacher review.
- After one digit is entered for a reviewed two-slot answer, direct visual choices such as `9_`, `_9`, and `__` preserve exactly which physical box the student used. The teacher does not type underscores.
- Choosing a position saves, regrades, closes the panel, and uses the established correction animation in one tap.
- Recognition, crop, capture, confidence, mathematical grading, and answer-key separation are unchanged.

## Verification

- 163/163 repository tests passed.
- Production and deploy-pruned builds passed.
- The complete mobile WebKit correction replay passed, including the visual blank-position choices, one-tap save/regrade, and all-blank handling.
- The upload directory contained 219 static files and no Pages Functions, `_worker.js`, `_routes.json`, Tailscale hostname, or Mac Mini address.
- A fresh production browser mounted `ScanGrade`, showed the exact Beta 12 label and `Start Scan`, cleared the loading screen, and logged zero errors.
- Production HTML, immutable HTML, and the local release artifact are byte-identical at SHA-256 `83b0d83f8f876488e75a140310f472b7e91b9340c2f119c4207db4c3a3bd1f0c`.
- `/api/submissions` and `/review-model/health` return the same static homepage, so no backend or Mac Mini route is publicly active.
- HTTP redirects permanently to HTTPS; the main JavaScript is served as `application/javascript`.
- A representative QR-linked layout is live at its correct path and served as JSON.

## Superseded uploads

- `49470d19` was immediately superseded after verification found that several worksheet assets had been packaged one directory too deep.
- `e7684c4b` corrected every worksheet path but was superseded after its deployment metadata was found to contain an incorrectly expanded short commit hash.
- Final deployment `192b81e5` contains the corrected byte-identical app artifact, correct QR paths, and the exact full source hash.
