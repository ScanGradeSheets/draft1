# ScanGrade Accepted-Answer Safety Repair

Date: 2026-07-23

## Decision

Advance this repair as the next private candidate. Keep the public Beta 15.3 interface and public browser-only behavior unchanged until physical old-iPad validation.

## What changed

1. Removed the over-broad display veto that returned already-validated promotions to yellow solely because a review-only reader disagreed.
2. Added a key-blind local whole-slot scout for browser answers currently accepted automatically.
3. Routed only suspicious accepts to two larger-grayscale strong-reader views.
4. Allowed the safety lane only to force teacher review. It cannot rewrite OCR text or use the mathematical answer key.

## Canonical result

The exact paired replay contains 50 sheets, five packets/students, and 345 scorable handwritten labels. Five predeclared ambiguous labels are excluded. P05 truth came from full-resolution visual audit rather than blinded two-reader adjudication.

| Policy | Automatic | Correct automatic | Confident errors | Yellow |
|---|---:|---:|---:|---:|
| Frozen Beta 7 | 273/345 (79.1%) | 253 | 20 | 72 (20.9%) |
| Broad veto removed only | 312/345 (90.4%) | 292 | 20 | 33 (9.6%) |
| Repaired candidate | 284/345 (82.3%) | 284 | 0 | 61 (17.7%) |

The repaired candidate improves frozen Beta 7 by 11 automatic answers and 31 correctly automatic answers while eliminating all 20 known confident errors. It demotes eight correct but genuinely difficult/contradictory readings. Visual review found those conservative demotions defensible.

The no-scout ablation retained five confident errors. The scout is therefore safety-essential, not an optional speed optimization.

## Runtime result

- Scout package: 7.7 MB ONNX.
- PyTorch/ONNX parity: 70/70 P05 holdout reads identical; maximum probability delta approximately 0.00000153.
- Mobile WebKit saved-page run:
  - initial local result: about 3.9 seconds;
  - local scout initialization: about 9.25 seconds;
  - batched scout inference: about 0.20 seconds;
  - full scout work including image preparation/load: about 15.8 seconds;
  - complete optional grading: about 21.7 seconds.
- On the overwritten P09 case, the browser text `3` was preserved and changed from automatic to yellow. The marked sheet regenerated correctly.

## Release boundary

- Private `.ts.net` candidate: repair defaults on; `?v3AcceptedSafety=0` disables it.
- Public `scangrade.io`: unchanged Beta 15.3 browser-only behavior.
- Fail-open: a scout or strong-reader timeout cannot block scan completion or invent a result.
- Required before public activation: sustained physical five-year-old-iPad testing, including repeated scans, memory/thermal behavior, timeout behavior, and manual correction/annotation inspection.

## Evidence

- `private-evidence/reports/accepted-answer-safety-shadow-1-20260723.json`
- `private-evidence/reports/accepted-answer-safety-shadow-1-visual-20260723/changed-decisions.png`
- `private-evidence/reports/accepted-answer-safety-no-scout-ablation-20260723.json`
- `private-evidence/reports/accepted-answer-safety-apply-webkit-20260723.json`
- `private-evidence/reports/accepted-answer-safety-apply-webkit-repeat-final-20260723.json`
