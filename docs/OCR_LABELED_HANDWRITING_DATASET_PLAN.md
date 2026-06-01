# OCR Labeled Handwriting Dataset Plan

Created 2026-06-01 as preparation only. Do not start model training from this plan unless the acceptance gate and privacy rules are satisfied.

## Purpose

If crop-preprocessing and candidate-selection experiments are not enough, ScanGrade may need a small labeled real-handwriting dataset for the current Grade 2 two-digit worksheets.

This document defines the dataset shape before collecting or committing anything.

## Guardrails

- Do not commit private student photos or crop images.
- Do not train on one failed page and claim reliability.
- Do not promote a new model without a holdout set.
- Do not replace the browser default model without rerunning the two-digit acceptance gate.
- Do not use student samples in marketing or public docs.

Related docs:

- `docs/STUDENT_SAMPLE_PRIVACY_AND_STORAGE.md`
- `docs/MODEL_ARTIFACT_INVENTORY.md`
- `docs/OCR_CANDIDATE_EXPERIMENT_PLAN.md`
- `docs/TWO_DIGIT_OCR_ACCEPTANCE_GATE.md`

## Dataset Goal

Capture real Grade 1/2 handwriting variation that synthetic or neat test images miss:

- thin pencil `2`s and `7`s
- tall `1`s
- light `5`s
- open or angular `4`s
- crossed or erased marks
- answers near the center guide
- uneven two-digit spacing

The first target is not broad handwriting AI. The first target is better reliability on ScanGrade's current answer-box crops.

## Minimum Useful Dataset

Use this only as a starting point:

- at least 5 completed worksheets before training anything
- at least 50 answer boxes
- at least 100 digit crops
- at least two different students or writing styles
- include both correctly read and misread examples

Better:

- 10-20 completed worksheets
- balanced A/B/C worksheet types
- repeated examples of common failures: `2`, `7`, `3`, `8`, `9`, `1`
- multiple capture sources if available: live app, phone photo, iPad photo

## Label Format

Each labeled crop should record:

```text
sample_id:
sheet_code:
sheet_type:
question:
digit_position: tens / ones
label:
source_photo_type: live_app / phone_camera / ipad_camera / unknown
crop_category: good / shifted / clipped / preprocessing_damaged / outside_box
writing_tool: pencil / dark_pencil / pen / unknown
notes:
```

Avoid student names or classroom identifiers.

## Holdout Rule

Before training, split by physical worksheet or student/sample label, not by random crop.

Reason: random crop splitting can put the same student's handwriting in train and test, making the model look better than it is.

Minimum:

- hold out at least one full worksheet from training
- hold out at least one page with known OCR misses

Preferred:

- train on some students/pages
- validate on different students/pages

## What Counts As Success

A model or training change is not successful unless it:

- improves the failed 2026-06-01 subtraction scan above `5/10`
- keeps the May 30 benchmark at or above `18/30`
- reduces false confidence, or at least does not increase it
- performs better on held-out real handwriting, not only training crops

## What To Report

Any model candidate report should include:

```text
Training samples:
Holdout samples:
Digits per class:
Known weak digits:
Baseline model result:
Candidate model result:
Failed subtraction scan result:
May 30 benchmark result:
False-confidence changes:
Recommendation:
```

## Storage Recommendation

Keep original photos and crop exports local/private until Tony decides retention and sharing rules.

Commit only:

- non-identifying summary docs
- scripts, if they contain no private data
- model manifests after a deliberate model-storage decision

Do not commit:

- raw student photos
- crop images
- labels that include names
- large model bundles without a storage decision

## Current Recommendation

Do not start training yet.

First exhaust:

1. debug crop classification
2. same-page live-app vs normal-camera comparison
3. narrow preprocessing/candidate experiments
4. confidence/review analysis

Start dataset labeling only if those do not produce a trustworthy path.
