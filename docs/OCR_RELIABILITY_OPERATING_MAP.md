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

If the failed scan remains `5/10`, reject the candidate.

If the benchmark drops below `18/30`, reject the candidate.

If wrong answers become more confident, reject or require explicit Tony review.
