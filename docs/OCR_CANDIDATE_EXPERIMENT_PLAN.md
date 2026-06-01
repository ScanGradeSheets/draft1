# OCR Candidate Experiment Plan

Created 2026-06-01 for ScanGrade's two-digit worksheet OCR work.

## Purpose

Use this before trying a crop-preprocessing, candidate-selection, confidence, or model experiment.

This is an experiment plan, not permission to ship production OCR changes. Any production change still needs the acceptance gate and Tony approval when product behavior changes.

## Current Baseline

Minimum truth set:

- 2026-06-01 Subtraction Within 20 failed scan: `5/10`
- 2026-05-30 three-sheet benchmark: `18/30`

Reference docs:

- `docs/TWO_DIGIT_OCR_ACCEPTANCE_GATE.md`
- `docs/OCR_DEBUG_CROP_REVIEW_CHECKLIST.md`
- `docs/OCR_RELIABILITY_DECISION_RECORD_2026-06-01.md`

## Allowed Experiment Types

### Local Crop-Preprocessing Variant

Allowed when debug crops show readable raw handwriting but weak 28x28 model input.

Examples:

- thresholding variant
- light stroke preservation
- border/divider noise handling
- pencil contrast normalization

Reject if the change improves one page but reduces benchmark total or raises confidence on wrong answers.

### Candidate-Selection Variant

Allowed when top model choices are low-margin and the correct digit appears as a near candidate.

Examples:

- use agreement between crop variants
- require margin before accepting a digit
- mark low-margin answers for review instead of forcing a read

Reject if the variant hides uncertainty.

### Confidence/Review Analysis

Allowed when the OCR answer may be wrong but the safer product behavior is better review/refusal.

Examples:

- report how many answers should be teacher-review cases
- compare confidence margins for correct vs wrong answers
- identify false-confidence examples

Do not hard-code new user-facing threshold behavior without Tony approval.

### Model Training Prep

Allowed only as preparation until privacy/storage boundaries and holdouts are clear.

Examples:

- define labels needed
- identify crop categories
- design holdout split

Do not train on one failed photo and claim reliability.

## Required Experiment Report

Every candidate experiment should produce a short report:

```text
Experiment name:
Files changed:
Production behavior changed? yes/no
Baseline failed scan score:
Candidate failed scan score:
Baseline benchmark score:
Candidate benchmark score:
Wrong answers made more confident? yes/no/unknown
Crop categories affected:
Recommendation: reject / keep investigating / ask Tony / prepare production patch
```

## Required Commands

Run the failed subtraction scan:

```bash
SG_EXPECTED_ANSWERS=17,15,12,12,12,12,12,12,14,11 \
node scripts/eval_uploaded_worksheets.mjs \
  --url https://localhost:5174 \
  --model /models/mnist-model.onnx \
  --out benchmarks/uploaded_student_samples/results-20260601-sean-subtraction-candidate \
  /tmp/codex-remote-attachments/019e760b-4e8f-7751-be8b-40baddcb8e58/B72FD2B7-43D1-48CC-8C7D-D1959F2F10A9/1-Photo-1.jpg
```

Run the benchmark:

```bash
node scripts/eval_tony_20260530_samples.mjs
```

Run syntax/build checks appropriate to the files touched.

## Stop Conditions

Stop the experiment if:

- sheet or answer-box detection regresses
- the failed scan stays at `5/10`
- the benchmark drops below `18/30`
- wrong answers become more confident
- the change requires app UI or worksheet design decisions
- the failure category is still unclear after reviewing crops

## Commit Rules

Safe to commit:

- experiment reports
- docs
- non-private summary artifacts
- test harness improvements that do not change production behavior

Do not commit:

- private student images or crops
- broad OCR rewrites
- model artifacts from one-sample training
- production OCR/capture/homography changes unless the candidate clears the gate and the change is explicitly scoped

## Teacher-Language Outcome

The output should say what Tony would experience:

```text
This candidate made the failed subtraction page more readable without weakening the existing benchmark.
```

or:

```text
This candidate did not improve the failed subtraction page enough, so it should not ship.
```
