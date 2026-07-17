# ScanGrade physical annotation and live marking private beta 8

Date: 2026-07-17

## Release identity

- Branch: `autobuild/safe-20260223`
- Build label: `2026.07.17-physical-annotations-live-marking-beta-8`
- Recognition policy: unchanged `p05-safety-private-beta-7`
- Private URL: `https://hobbes-mac-mini.tail9a3379.ts.net/`

## Scope

- Anchors checks, X marks, and review circles to the physically detected answer box before the template-predicted box.
- Preserves the existing small deterministic wobble, angle, and stroke differences so marks remain natural without materially drifting.
- Reveals confirmed marks one question at a time while uncertain answers are being double-checked.
- Never animates yellow answers or questions still queued for strong/safety review.
- Uses the exact deterministic final annotation image, rather than drawing a second approximation.
- Leaves OCR models, grading thresholds, answer-key boundaries, crop selection, and the Beta 7 recognition policy unchanged.

## Evidence

- Across 120 P05 slots, the old expected-to-physical box center drift averaged 34.1 canonical pixels; 45 slots exceeded 0.25 box widths and 22 exceeded 0.5 box widths.
- Two representative P05 visual replays placed marks beside/around the physical answer boxes.
- WebKit student-mode integration deliberately held the large model response. A confirmed mark appeared while two queued questions stayed hidden; the provisional final image remained hidden; the completed annotated page then replaced the animation.
- Focused and full test suite: 135/135 pass.
- Production build: pass.

The P05 performance boundary remains 54/70 (77.1%) in the repaired retrospective rescan estimate, with 54/54 automatic transcriptions matching the handwriting audit. This release improves placement and perceived latency; it does not claim higher recognition coverage.

## Rollback

The previous private build is source commit `2a6c8c5` with build label `2026.07.17-p05-safety-private-beta-7`. Recognition rollback remains `?consensusCandidate=0`.

## Final deployment record

Pending commit, push, private URL verification, and Rugged backup.
