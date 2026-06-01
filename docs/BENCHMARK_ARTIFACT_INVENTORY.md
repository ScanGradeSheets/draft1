# ScanGrade Benchmark Artifact Inventory

Created 2026-05-30 during safe preservation work.

This is an inventory only. The `benchmarks/` folder is about 7.4 GB and should not be committed as a bundle.

## Top-Level Sizes

- `benchmarks/uploaded_student_samples/` - about 5.9 GB
- `benchmarks/holdout_student_samples_2026-05-15/` - about 884 MB
- `benchmarks/worksheet_bakeoff/` - about 678 MB
- `benchmarks/ocr_sanity/` - about 36 MB

## High-Value Evidence

`benchmarks/holdout_student_samples_2026-05-15/` appears especially important:

- It contains five strict holdout worksheet photos from Tony.
- Its README says not to use those images for training, augmentation, or fine-tuning.
- `COMPARISON.md` reports that on 2026-05-15 the current local model reached 78.0% cell accuracy on the five-sheet holdout, but still had no perfect sheets and was not good enough for unattended grading.
- The same comparison says the published GitHub Pages draft was much worse at 42.0%, suggesting local model work had improved but was not yet classroom-safe.

`benchmarks/worksheet_bakeoff/` is also important:

- It contains a manifest and worksheet images used by `scripts/eval_worksheet_models.mjs`.
- The image set alone is about 45 MB.
- Several result folders are about 193 MB each because they include debug output.

`benchmarks/uploaded_student_samples/` is very large:

- It contains many run folders from uploaded worksheet evaluations.
- Several folders are about 400 MB each.
- Preserve externally before cleanup, then decide which summaries/manifests are worth committing separately.

## Current Recommendation

- Do not commit `benchmarks/` wholesale.
- Preserve it in the existing external project snapshot before any cleanup.
- If evidence is needed in Git, commit only small summary files such as README/COMPARISON/summary.md/summary.json after checking for student privacy.
- Keep the holdout set separated from training data.
- Use `docs/OCR_RELIABILITY_OPERATING_MAP.md` before running or interpreting current two-digit OCR benchmark artifacts.

## 2026-06-01 OCR Gate Evidence

Tony has now sent real two-digit worksheet samples, including a newly printed Subtraction Within 20 page that reproduced a live app failure.

Current key benchmark facts:

- failed 2026-06-01 subtraction scan: `5/10`
- May 30 three-sheet benchmark: `18/30`
- issue type: answer-box detection generally works; recognition/preprocessing is weak on thin pencil `2`s and `7`s

Preservation guidance:

- Treat original worksheet photos, debug crops, and model-input images as private/local evidence.
- Do not commit raw photos or crop images unless Tony explicitly approves a selected/redacted fixture.
- Do not delete result folders tied to the 5/10 failed scan or 18/30 benchmark until the OCR reliability decision is revisited.
- If summaries are committed later, keep them non-identifying and link them to `docs/TWO_DIGIT_OCR_ACCEPTANCE_GATE.md`.
