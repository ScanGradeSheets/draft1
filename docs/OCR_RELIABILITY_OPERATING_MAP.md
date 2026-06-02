# OCR Reliability Operating Map

Created 2026-06-01 so future ScanGrade work can find the right OCR reliability document quickly.

## Current Situation

Tony's newest completed Subtraction Within 20 scan reproduced a real classroom failure:

- the worksheet was found
- answer boxes were found
- debug crops generally landed on the intended handwriting
- thin pencil `2`s and `7`s were often read as `1` or `9`
- current failed-scan result: `5/10`
- current May 30 benchmark result: `18/30`

The working conclusion is:

```text
This is a real OCR trust issue, not proof of a broad page-detection or worksheet-design failure.
```

## Start Here

Use this order:

1. `docs/OCR_RELIABILITY_DECISION_RECORD_2026-06-01.md`
2. `docs/TWO_DIGIT_OCR_ACCEPTANCE_GATE.md`
3. `docs/OCR_DEBUG_CROP_REVIEW_CHECKLIST.md`
4. `docs/OCR_CANDIDATE_EXPERIMENT_PLAN.md`

Only use the model/dataset plan if the first four do not produce a trustworthy path:

- `docs/OCR_LABELED_HANDWRITING_DATASET_PLAN.md`

## What Each Doc Is For

| Document | Use When | Main Rule |
| --- | --- | --- |
| `OCR_RELIABILITY_DECISION_RECORD_2026-06-01.md` | Deciding whether to ship or reject OCR work from current evidence. | Do not ship production OCR changes from one failed scan alone. |
| `TWO_DIGIT_OCR_ACCEPTANCE_GATE.md` | Testing whether a candidate OCR change is acceptable. | Improve 5/10 failed scan without dropping 18/30 benchmark. |
| `CLASSROOM_OCR_RETEST_PROTOCOL.md` | Asking Tony for better evidence after a failed live scan. | Compare live app scan against normal camera photo when possible. |
| `OCR_DEBUG_CROP_REVIEW_CHECKLIST.md` | Reviewing wrong or low-confidence answers. | Separate crop, preprocessing, model, confidence, and writing-behavior failures. |
| `OCR_CANDIDATE_EXPERIMENT_PLAN.md` | Running a local OCR candidate experiment. | Keep candidates reversible, report before/after, stop on regressions. |
| `OCR_LABELED_HANDWRITING_DATASET_PLAN.md` | Preparing future model training. | Do not train yet; require privacy rules, labels, and holdouts. |

## Current Non-Negotiables

- Do not change app UI or worksheet design unless Tony asks.
- Do not change production OCR/capture/homography/model behavior without a reproducible test and clear reason.
- Do not push a broad OCR rewrite from the current evidence.
- Do not commit private student images or crop exports.
- Do not train on one failed photo.
- Do not call ScanGrade classroom-ready for two-digit OCR yet.

## Next Evidence To Prefer

Best next evidence from Tony:

- the same physical failed page as a normal camera photo
- another live app scan of the same or similar sheet
- writing tool note: normal pencil, dark pencil, or pen
- whether the live app said success, review, or try again

If no more evidence is available, safe Codex work is limited to:

- documenting findings
- inspecting existing debug outputs
- planning narrow experiments
- preparing non-private report templates

## Production Patch Gate

Any production OCR/crop/model candidate must report:

```text
Failed scan before:
Failed scan after:
May 30 benchmark before:
May 30 benchmark after:
False-confidence change:
Files changed:
Rollback point:
Recommendation:
```

If a clean failed-scan OCR truth set remains at its original score, reject the
candidate. Do not use answer-key score as OCR truth when the student may have
written wrong answers.

The current active floor for this scoped OCR path is `22/30` on the May 30
repeatable benchmark. If a candidate drops below `22/30`, reject it unless Tony
explicitly chooses a more conservative review-first behavior despite lower
automatic score.

If wrong answers become more confident, reject or require explicit Tony review.

## 2026-06-01 Late Update

The May 30 repeatable two-digit benchmark has since moved from `19/30` to
`22/30` with a scoped crop-voting/review-gating patch. The hard B72 classroom
photo remains useful as a stability sample, but its `5/10` answer-key score is
not a clean OCR accuracy score because the photographed student answers appear
to include genuine wrong answers.

For future OCR tuning, separate these two targets:

- OCR handwriting truth: what the student actually wrote in the box.
- Answer-key correctness: whether that written answer is mathematically correct.

Do not optimize future OCR toward the answer key unless the actual handwritten
truth for that sample is labeled.

## 2026-06-02 Early Update

Tony's newest live rescans showed two important trust patterns:

- a two-digit sheet can still appear as one-digit result cards when QR/layout
  detection falls back to the old `sg-10-box-v1` layout;
- ambiguous two-digit mismatches should become teacher review, not confident
  red Xs, unless confidence and internal variant agreement are both strong.

The current scoped patch therefore:

- requires a QR payload for normal classroom scans, with `?allowDefaultLayout=1`
  reserved for legacy/debug testing;
- tightens automatic-X thresholds for virtual two-digit boxes, especially the
  weaker right/ones slot;
- keeps the May 30 benchmark at `22/30`, while turning uncertain hard-sample
  mismatches into review flags instead of overconfident wrong marks.
