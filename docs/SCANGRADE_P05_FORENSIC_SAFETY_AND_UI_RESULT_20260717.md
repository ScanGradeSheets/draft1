# ScanGrade P05 forensic safety, capture, and UI result — 2026-07-17

## Evidence boundaries

- The frozen original one-shot P05 result remains authoritative: 48/70 automatic (68.6%), 22 yellow. All 48 automatic transcriptions matched the single full-resolution handwriting audit.
- The later ten-page full-debug rescan is development evidence only. Its immediate browser result was 42/70 automatic, all 42 matching the audit. After the private strong-model process completed, it reached 55/70 automatic, but one of those 55 was a confident transcription error. The safe counterfactual is therefore 54/70 (77.1%), 54/54 matching the audit, and 16 yellow.
- The student's 70 answers appeared mathematically correct in one visual audit. This is not a two-reader blinded truth set and cannot support a market claim.

## Observed red/display failures

1. Row 04 question F: visible `17` was automatically changed to `12`. The compact reader independently read `17` at about 99.98% minimum component confidence, while the browser evidence was high-risk, preprocessing-disputed, and retained a material rival. This was the one genuine unsafe automatic transcription in the final debug result.
2. Row 04 question G: visible truth was `16`; the browser displayed `11`, while the two whole-answer readers both proposed `17`. The question was internally review-needed but was styled as incorrect/red. The readers detected a real dispute but did not recover the truth.
3. Number-bond 08 question C: visible truth was `14`; the browser displayed `11`, and both whole-answer readers proposed `14`. This was also internally review-needed but styled as incorrect/red.

The answer key was not used by the new safety selector.

## Implemented candidate repair

- Consensus policy advanced to `consensus-promotion-shadow-3`.
- `override-retained-material-rival` is now an unconditional automatic-promotion veto.
- A second narrow, key-blind veto catches replay variance when the browser is high-risk and preprocessing-disputed, the proposed grayscale read conflicts with the compact read, and compact minimum component probability is at least 0.99.
- Core-crop corroboration cannot re-enter after that veto.
- If the two whole-answer readers agree with each other against the browser, the displayed result remains teacher review rather than becoming a confident red mark.
- Review state now drives the answer cards, marked-sheet annotations, and overlay debug consistently. Confidently transcribed incorrect student math can still be red.

Applied to the saved final debug decisions, the unsafe `17 -> 12` becomes yellow. The result is 54/70 automatic (77.1%), 54/54 matching the visual audit, and 16 yellow: rows 34/40 (85.0%), non-rows 20/30 (66.7%). This is a retrospective development estimate, not a prospective result.

## Answer-card and annotation repairs

- Review cards follow physical worksheet slot metadata. A number-bond answer written in one physical box displays as one token; genuine two-slot answers retain two slots.
- Cards, question review state, annotations, and overlay-debug records now use the same review decision.
- Whole-answer yellow marks use the printed answer-zone union when no single slot can safely be blamed, preventing a displaced slot mark from implying certainty about the wrong location.
- Annotation decoration now receives a deterministic seed derived from the result. Identical evidence therefore produces identical check/X/circle placement instead of visually drifting between replays.

## Identical-input and capture findings

- Two complete production-matched replays of the same ten image files were identical for geometry, predictions, answer groups, review states, and annotation regions. Only runtime timings and the former random annotation seed differed; the seed is now deterministic and a focused A/B replay matched completely.
- The phone captured eight frames and retained the best three on every debug page. All selected captures cleared focus and perspective gates.
- Replaying the 30 retained frames independently showed that the whole-page selected frame had 42/70 raw top-one answers correct. Choosing the best single frame per page with hindsight would reach 47/70; choosing per-answer with truth knowledge would reach 50/70. A simple three-frame majority fell to 39/70.
- Therefore useful alternate pixels sometimes exist, but no tested observable selector identifies them safely. Raising the existing focus threshold is not supported: it would cause more rescans without reliably improving recognition. The dominant remaining problem is recognition/candidate selection, with concentrated crop/layout problems still present in number bonds.

Raw retained-frame top-one accuracy is diagnostic only; it is not automatic coverage or confident-read precision.

## Test-performance verdict

The test did **not** perform at the historical expected level. The frozen development figure was 250/275 automatic (90.9%) with zero known confident errors. The untouched original P05 scan reached 68.6% safe automatic coverage. The debug rescan reached 78.6% only by admitting one confident error; the repaired estimate is 77.1% safe coverage. P05 therefore falsified the assumption that Candidate 6 would generalize near 90% to this new writer/capture.

## Verification and evidence

- Targeted consensus and deterministic-annotation tests pass.
- Identical-input reports: `private-evidence/reports/p05f-production-determinism-a-20260717/` and `p05f-production-determinism-b-20260717/`.
- Deterministic-annotation A/B reports: `private-evidence/reports/p05f-annotation-determinism-a-20260717/` and `p05f-annotation-determinism-b-20260717/`.
- Retained-frame audit: `private-evidence/reports/p05f-retained-frame-browser-audit-20260717/`.
- Bulky earlier safety replay images were checksum-verified and offloaded to `/Volumes/Tony's Rugged HD/Codex/ScanGrade Offloads/2026-07-17-p05-forensic-safety-replays/` before local removal.

## Release status

Do not deploy the attempted all-red strong-model screen: it increased latency and still failed to catch many raw replay errors. The narrow ambiguity/conflict veto, review-state/annotation repair, physical-slot formatting, and deterministic annotation seed are the release candidate. Candidate 6 remains live until final regression tests, commit, push, and private deployment verification complete.
