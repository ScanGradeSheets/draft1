# ScanGrade P02 label and answer-zone audit — 2026-07-14

## Decision

Do not spend another untouched packet yet. The answer-zone audit found and repaired a real two-column mapping defect on eight-answer sheets, but a full saved-frame replay also exposed one unsafe automatic whole-answer fallback (`34` read as `39`) on an unchanged six-answer number-pattern page. The crop candidate is useful; the automatic V3 fallback still fails the zero-error gate.

Nothing from this audit has been deployed. The recognition models, answer-key boundary, and frozen confidence thresholds were not changed.

## 1. Independent P02 handwriting verification

An independent blind full-page pass was performed without access to the primary labels, evaluation outputs, or mathematical answer key. It agreed with the primary pass except:

- Number bonds Q6 is a single handwritten `3`, not `31`.
- Place value Q3 visibly ends as `49`, but the tens digit is overwritten/retraced and is excluded under the predeclared ambiguous-work rule.
- Number bonds Q4 is also overwritten and remains excluded.

P02 therefore has 70 labelled answers, 68 scorable handwritten values, and two excluded overwritten answers. Source: `private-evidence/hybrid-v2-prospective/handwritten-truth-p02-verified.json`.

## 2. P02 review diagnosis

### Mixed sheet: five reviews

The saved artifacts showed a genuine geometry failure. The older answer-frame matcher was hard-coded for ten expected frames. The mixed sheet has eight two-column answer frames, so nearest-position matching assigned several detected physical boxes to the wrong questions under residual page distortion. Examples included Q3 receiving Q4's `9`, Q4 becoming blank, and Q5-Q7 receiving incomplete or wrong neighboring regions.

The narrowed candidate generalizes the existing two-column, top-to-bottom assignment to even frame counts of at least eight. On the P02 mixed sheet, all eight continuous zones then visibly contained the intended answers: `15, 7, 15, 9, 13, 12, 14, 15`. Under the unchanged frozen rule, three of the original five reviews became safe three-frame reads; two remained review.

### Number bonds: four reviews

The saved crops already contained the handwriting. The remaining problems are not primarily missing pixels:

- Q1 (`6`): the reader was inconsistent across frames.
- Q2 (`19`): two digits were written inside a worksheet area described as one slot; the digit model often retained only `9`.
- Q5 (`17`): the large reader was correct on two frames, but the frozen policy requires all three.
- Q6 (`3`): the single connected `3` touches the lower/right frame and produced inconsistent reads.

Layout-only anchoring and aggressive printed-frame erasure had already degraded other answers and remain rejected. Number bonds need a worksheet/metadata redesign plus representative training examples, not a global crop expansion.

## 3. Crop candidate and replay

Code candidate: generalize column-order assignment from exactly ten two-column answer frames to even counts of at least eight. Six-answer activities retain the prior matching path. No recognition or confidence-policy change was made.

Replay coverage:

- 40 saved pages: P08, P03, P09, and independently verified P02.
- 280 labelled answers; 275 scorable values and five ambiguous/overwritten exclusions.
- All pages used the saved original capture plus three retained burst frames.
- Key-blind recognition only; mathematical answers were not handwriting truth.

Final replay result:

- Existing V2 OCR lane: `173/275` automatic, `173/173` correct, zero observed confident errors.
- Frozen V2-plus-whole-answer overlay: `246/275` automatic (`89.5%`), `245/246` correct, one automatic error.
- Row family: `146/160` automatic (`91.3%`), zero observed automatic errors.
- Non-row family: `100/115` automatic (`87.0%`), one automatic error.

The error is P09 number-pattern Q1: handwritten `34`; V2 correctly kept it in review, while the large whole-answer reader returned `39` on all three replays at high confidence. The compact reader returned `22`. The same error persisted after six-answer sheets were restored to the old crop path, proving that it is an underlying whole-answer stability/calibration failure rather than an effect of the new eight-frame crop assignment.

Evidence: `private-evidence/reports/v3-crop-candidate-evaluation-20260714-final.json` and the replay directories named `v3-crop-candidate-replay-20260714*`.

## 4. Recommendation

1. Keep the narrowed eight-frame crop change as a candidate for the conservative V2/review path; it fixes a visibly proven mapping defect and the replayed V2 lane had zero confident errors.
2. Do not enable the frozen large-model three-frame fallback for automatic grading. It has now produced a genuine high-confidence transcription error on authentic incorrect student math.
3. For a pre-September soft launch, use conservative V2 automatic grading plus rapid review choices; the whole-answer models may suggest choices but must not silently decide.
4. Redesign number-bond answer zones so the metadata and printed affordance permit the actual expected answer length, then test on existing saved pages before printing new material.
5. Preserve P01 and P04-P07. Do not scan another untouched packet until the automatic fallback has a materially different safety guard and passes repeated saved-frame replay without this error. Another student now would measure a known-broken decision rule, not resolve it.

## Verification

- `npm run test:v3:zones`: 8/8 passed.
- `npm run test:hybrid`: 15/15 passed.
- `npm run build`: passed.
- Production deployment: not performed.
