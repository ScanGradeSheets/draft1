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
- Use these benchmark notes as background until Tony sends the new open-divider student worksheet samples.
