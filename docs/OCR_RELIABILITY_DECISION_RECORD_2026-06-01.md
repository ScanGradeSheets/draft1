# OCR Reliability Decision Record - 2026-06-01

## Decision

Do not push OCR, crop-preprocessing, homography, or model changes as a production reliability improvement from the current failed two-digit subtraction scan alone.

Use the failed 2026-06-01 subtraction scan plus the May 30 three-sheet benchmark as the minimum gate for any future OCR-related patch.

For the full OCR reliability document map, start with `docs/OCR_RELIABILITY_OPERATING_MAP.md`.

## Why

Tony's failed live scan is real and important, but the failure pattern is specific:

- the app found the worksheet
- the app found the answer boxes
- debug crops generally landed on the intended handwriting
- thin pencil `2`s and `7`s were often read as `1` or `9`
- the valid answer score was `5/10`
- the May 30 three-sheet benchmark baseline is `18/30`

This points to recognition/preprocessing/confidence behavior more than gross layout failure.

Changing broad OCR or homography behavior from one failed sample could improve that sample while making other real student pages worse.

## Rejected Moves

### Broad OCR Rewrite

Rejected for now.

Reason: current evidence does not show a general pipeline collapse. It shows specific thin-pencil digit weakness.

### Worksheet Redesign

Rejected for now.

Reason: the current worksheet format is under active classroom test, and Tony has asked that further box design changes be driven by measurable OCR improvement. The current issue appears primarily OCR/model-side, not a student-understanding issue.

### Ship A One-Sample Crop Tweak

Rejected for now.

Reason: one narrow cleanup experiment did not improve the failed subtraction score. Any future crop/preprocessing patch must clear the acceptance gate.

### Train Only On This Failed Photo

Rejected.

Reason: training on one photo risks overfitting and producing false confidence. If model work becomes necessary, use a labeled real-handwriting set with holdouts.

## Accepted Next Moves

Safe next moves:

- classify wrong answers with `docs/OCR_DEBUG_CROP_REVIEW_CHECKLIST.md`
- compare failed live-app scans against normal camera photos using `docs/CLASSROOM_OCR_RETEST_PROTOCOL.md`
- structure any local candidate run with `docs/OCR_CANDIDATE_EXPERIMENT_PLAN.md`
- test narrow preprocessing or candidate-selection variants only against `docs/TWO_DIGIT_OCR_ACCEPTANCE_GATE.md`
- improve review/refusal behavior only with reproducible evidence and Tony approval if product behavior changes
- build a small labeled crop set only after privacy/storage boundaries are clear, using `docs/OCR_LABELED_HANDWRITING_DATASET_PLAN.md`

## Current Gate

Minimum acceptance gate:

- improve Tony's 2026-06-01 failed subtraction scan above `5/10`
- do not reduce the May 30 three-sheet benchmark below `18/30`
- do not turn low-confidence wrong answers into confident wrong answers
- preserve sheet/layout detection
- leave app UI and worksheet design unchanged unless Tony asks

Source:

- `docs/TWO_DIGIT_OCR_ACCEPTANCE_GATE.md`

## Teacher-Facing Interpretation

Use this language:

```text
ScanGrade saw the worksheet and answer boxes, but several thin pencil answers were not reliable enough to read automatically. These should be treated as teacher-review cases until OCR improves on real handwriting.
```

Avoid:

```text
ScanGrade is broken.
The worksheet design failed.
The model just needs retraining.
```

Those statements are stronger than the evidence supports.

## Revisit When

Revisit this decision after either:

- Tony sends same-page live-app and normal-camera retest evidence.
- A narrow OCR candidate clears the acceptance gate.
- A labeled real-handwriting crop set exists with a holdout split.
- Tony explicitly decides to trade worksheet design for OCR reliability.
