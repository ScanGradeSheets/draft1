# ScanGrade selected-core-crop private beta 4 deployment

Date: 2026-07-15 (America/Toronto)

## Release decision

Tony authorized completing and deploying this candidate once its release gates passed. It is enabled by default only on the private `.ts.net` runtime:

`https://hobbes-mac-mini.tail9a3379.ts.net/`

The public GitHub Pages scanner is intentionally unchanged. This is private development evidence, not an authorized public accuracy claim.

## Product behavior

Build label: `2026.07.15-core-crop-private-beta-4`

Candidate 3 remains the first decision layer. Only answers still yellow for one of four model-support/browser-conflict reasons, and carrying no ambiguity flag, receive the second-stage large-grayscale check. The adapted reader sees three selected-page views: the original answer zone, a 2% interior trim, and a 4% interior trim. All three must agree with the three retained capture-frame reads. Existing confidence-safety, ambiguity, answer-length, and frame-stability vetoes remain in force.

The answer key is never sent to either recognition service and is never used to select a transcription.

## Evidence

- 40 pages, 275 scorable handwritten answers.
- 250 automatic (90.9%), 250/250 matching handwritten truth, 25 yellow.
- Rows: 150/160 (93.8%).
- Non-row: 100/115 (87.0%).
- Final answer groups identical to the previously validated eager core-crop implementation on 40/40 pages.
- Core-crop workload reduced from 309 images on 36 pages to 48 images on 14 pages, an 84.5% reduction.
- The overwritten `34/39` example remains yellow because the crop views disagree.

These are correlated development packets and do not justify a market-facing accuracy or zero-error claim.

## Release verification

- 110/110 JavaScript tests passed.
- Standard Vite build passed.
- Pruned GitHub Pages build passed but was not published.
- `git diff --check` passed.
- Secure Safari/WebKit smoke passed through the real warmed Tailscale model routes.
- Local result: 3.93 s; optional consensus: 21.64 s.
- Warm repeat: 4.02 s / 21.32 s.
- Deliberate strong-plus-compact outage completed local grading, made no promotion, preserved manual correction, and leaked no token.

## Boundaries and rollback

This release is suitable for private scanning and observation. The roughly 21-second optional completion on the difficult smoke page remains too slow for a polished public promise and should be optimized independently of recognition thresholds.

Immediate rollback:

`https://hobbes-mac-mini.tail9a3379.ts.net/?consensusCandidate=0`

The app remains usable when the Mac-hosted readers are down: local recognition and grading complete, unresolved answers stay yellow, and manual correction remains available.
