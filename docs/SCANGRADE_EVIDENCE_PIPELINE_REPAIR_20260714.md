# ScanGrade evidence-pipeline repair — 2026-07-14

## Verdict

The evidence-pipeline candidate raises the clean four-packet replay from the prior fresh 226/275 automatic answers (82.2%) to 234/275 (85.1%), with 234/234 matching the independently labelled handwriting and no observed confident transcription errors. Rows reach 144/160 (90.0%); non-row sheets reach 90/115 (78.3%). This is development evidence, not a public accuracy claim.

Nothing in this goal was deployed, committed, or pushed.

## Crop and registration repair

The main defect was not camera blur. Complete sets of printed answer frames were visible, but residual page curvature moved them far enough from ideal template coordinates that the old per-box distance gate rejected them. The detected frames formed coherent page-level affine maps with small residuals, so the repair trusts a complete coherent assignment while rejecting incomplete, mirrored, badly scaled, or spatially inconsistent contour sets.

Four of the six answers originally labelled crop/registration failures now read correctly and automatically through the existing browser model:

- P08 add-one-digit Q5: `6`
- P08 mixed Q5: `13`
- P08 mixed Q6: `11`
- P09 ten-frames Q4: `14`

The other two were resolved diagnostically rather than forced automatic:

- P08 number-bonds Q4: a selected-frame full-local crop can expose the written `6`, but adjacent retained frames still read mainly `5`; global local-frame registration also regresses other number-bond answers. It remains yellow because the evidence is not stable enough for automation.
- P02 number-bonds Q5: the primary crop already contains the written `17`; failures persist across browser/large/compact readers because printed structure and recognition disagree. This was misclassified as a spatial crop failure and is now treated as a recognition/print-interference case.

Aggressive printed-frame cleaning and global full-local registration were replayed and rejected. Both changed useful pencil evidence and reduced reliability on other answers.

## Layout and slot-contract repair

Physical crop geometry is now separate from the maximum handwritten transcription length. A child can write `19` inside one physical number-bond box, so the number-bond question groups explicitly permit up to two handwritten digits. The transcription can be retained as `19` and then graded mathematically wrong when the correct answer is `5`; the answer key is not used to choose the transcription.

Optional two-slot answers are now handled using layout metadata, crop quality, and recognition evidence only. The previous helper could prefer a slot because its digit matched the mathematical answer. That answer-key-dependent path was removed. A one-digit response may occupy either physical slot; only the other slot's artifact is blanked, and ambiguous two-slot evidence stays yellow.

Status of the five original contract cases:

- P02 number-bonds Q2 no longer fails with `answer-length-exceeds-slot-metadata`; its large reader preserves `19`, but compact disagreement keeps it yellow.
- P08 number-pattern Q1 and P09 mixed Q2 now apply key-blind optional-slot geometry correctly; their remaining wrong browser digit is a recognition problem and stays yellow.
- P08/P03 number-bonds Q3 no longer tempt the system to accept overlong `1774`/`1474` outputs. Compact reads `14`, but the independent readers do not agree, so both remain yellow. Post-hoc endpoint contraction was not adopted because the corpus is too small to establish that it is generally safe.

Thus the contract defects are repaired without claiming that every affected handwriting sample became automatic.

## Identical-input reproducibility

The apparent identical-input divergence came from comparing different source candidates. The original freeze manifest omitted `src/ocr-pipeline.js`, while the two replays used different `CameraCapture.vue`/selection behavior. It was not random ONNX inference.

The repair adds explicit digit-selection and V3 decision-policy identities to saved debug evidence, includes all critical selection, geometry, layout, model, and browser-runtime files in a SHA-256 manifest, verifies manifests, and prevents debug-session directory collisions. Two fresh, separate browser runs of the same saved page produced identical model-input hashes, probabilities, preprocessing evidence, and selected digits.

## Final replay

| Slice | Automatic | Coverage | Observed automatic errors |
|---|---:|---:|---:|
| Overall | 234/275 | 85.1% | 0 |
| Row | 144/160 | 90.0% | 0 |
| Non-row | 90/115 | 78.3% | 0 |
| One digit | 86/100 | 86.0% | 0 |
| Two digits | 148/175 | 84.6% | 0 |

All 40 pages completed, all 280 answer groups were present, five ambiguous truth labels were excluded, 58/58 experimental promotions were correct, all automatic annotation regions were consistent, and every page produced a marked sheet.

Compared with an earlier 236/275 intermediate replay, two dot-collection answers returned to review after the answer-key-dependent optional-slot preference was removed. That is a deliberate safety improvement, not a regression to reverse.

The historical single-frame falsification stress remains 457/578 surrogate automatic with zero observed errors. It cannot validate the real three-frame rule.

## Verification

- 58 focused tests passed.
- Layout audit completed with zero errors; existing warnings remain.
- Production build passed; the pre-existing large-chunk warning remains.
- Candidate manifest verified 55/55 files with no mismatch.
- Exact same-input replay comparison passed.

Primary evidence:

- `private-evidence/reports/evidence-pipeline-final-score-20260714.json`
- `private-evidence/reports/evidence-pipeline-final-replay-20260714/`
- `private-evidence/reports/consensus-historical-single-frame-stress-20260714.json`
- `private-evidence/reports/determinism-a-20260714/`
- `private-evidence/reports/determinism-b-20260714/`
- `private-evidence/protocols/evidence-pipeline-candidate-freeze-20260714.json`

## Recommendation

Keep this as the private candidate and compare it prospectively before broad release. Do not add endpoint contraction, global full-local number-bond crops, aggressive printed-frame erasure, or lower confidence thresholds. The next accuracy work should target number-bond print interference and genuinely key-blind optional-slot recognition using unseen evidence, not more rules tuned to these eleven examples.
