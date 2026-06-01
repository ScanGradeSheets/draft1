# OCR Two-Digit Findings - 2026-05-30

Internal ScanGrade note. Do not treat this as a customer-facing claim.

## Purpose

Tony provided three real completed Grade 2 worksheets using the new two-digit answer-box format:

- `subtraction-within-20.jpg`
- `mixed-within-50.jpg`
- `addition-within-20.jpg`

They are preserved as fixtures in:

`benchmarks/uploaded_student_samples/fixtures/tony-20260530-two-digit-sheets/`

## Current Local OCR Patch

Two local OCR changes are under test:

- `src/homography.js`: answer-box contour detection now accepts slightly higher contour fill ratio. This allowed the mixed worksheet to detect all 10 physical answer boxes instead of falling back to poor template crops.
- `src/ocr-pipeline.js`: a narrow consensus rule lets strong agreement between `center-safe-slot` and `edge-band-slot` override weaker cleanup variants.

These changes are not pushed yet.

## Repeatable Benchmark

Run with a local HTTPS Vite server already available:

```bash
node scripts/eval_tony_20260530_samples.mjs --url https://localhost:5174
```

If testing on a temporary port:

```bash
node scripts/eval_tony_20260530_samples.mjs --url https://localhost:5175
```

Use `pair-summary.md` or `pair-summary.json` in the output directory. The older evaluator summary is digit-era and misleading for these two-digit worksheets.

## Results From Current Local Patch

Using the default app model `/models/mnist-model.onnx`:

| Sheet | Score |
|---|---:|
| Subtraction Within 20 | 10/10 |
| Mixed Within 50 | 3/10 |
| Addition Within 20 | 7/10 |
| Total | 20/30 |

Alternate model checks did not beat the current default model:

| Model | Total |
|---|---:|
| `/models/mnist-model.onnx` | 20/30 |
| `/models/worksheet-digit-generalist-final.onnx` | 16/30 |
| `/models/worksheet-digit-cnn-centered.onnx` | 7/30 |
| `/models/worksheet-digit-wide-cnn-local-rerun.onnx` | 7/30 |

## 2026-06-01 Repeatable Check

Run against the current local app on `https://localhost:5174`:

```bash
node scripts/eval_tony_20260530_samples.mjs
```

Output:

`benchmarks/uploaded_student_samples/results-tony-20260530-repeatable/`

Pair-level result:

| Sheet | Score | Predicted | Expected |
|---|---:|---|---|
| Subtraction Within 20 | 10/10 | 17, 15, 12, 12, 12, 12, 12, 12, 14, 11 | 17, 15, 12, 12, 12, 12, 12, 12, 14, 11 |
| Mixed Within 50 | 3/10 | 27, 29, 42, 8, 42, 75, 27, 21, 41, 14 | 37, 29, 43, 28, 42, 25, 37, 38, 41, 15 |
| Addition Within 20 | 5/10 | 15, 15, 11, 13, 18, 17, 12, 77, 42, 19 | 15, 15, 17, 13, 19, 11, 12, 17, 13, 19 |
| Total | 18/30 | | |

Read-only diagnosis:

- The app loaded the expected layout IDs: `g2-sub-within-20-v1`, `g2-mixed-within-50-v1`, and `g2-add-within-20-v1`.
- The app loaded the known worksheet model hash `1bb4991956f9`.
- Saved raw crops generally show the intended handwritten digit, so this run does not look like a gross worksheet/layout failure.
- Several wrong answers are low-margin recognition choices where the correct digit appears as the second choice with a small probability gap, often about `0.03`.
- The safest next OCR step is evidence-based review-flag/candidate-selection work against these saved debug crops, not a broad rewrite.

## Interpretation

The answer-box geometry is much better after the homography patch. On the mixed worksheet, debug output showed:

- 10 answer-box candidates
- 10 assignments
- assignment method `column-direct`

The remaining failures are mostly recognition/model failures, not gross crop-location failures. Common issues:

- `3` read as `2`
- some `8`s read incorrectly when handwriting leans toward the center divider
- occasional `4`/`1` confusion
- conservative review flags are still appropriate

## Safe Recommendation

Do not push this OCR patch to the main app as a finished fix yet.

Next safe step:

1. Test the same patch against Tony's newest redesigned worksheet boxes when completed student samples are available.
2. If the redesigned boxes improve results clearly, deploy first to a test build.
3. If recognition still fails, build a small labeled training set from real student handwriting and retrain/fine-tune the worksheet digit model.

This evidence supports keeping the current local patch preserved, but it does not yet support claiming reliable two-digit OCR for classroom use.
