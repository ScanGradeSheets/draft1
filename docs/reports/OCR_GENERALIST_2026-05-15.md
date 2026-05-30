# OCR Generalist Update - 2026-05-15

## Policy

- The five sheets under `7DE72F2C-1534-4051-9B75-37C218765731` were reserved as holdout only.
- Those five sheets were not added to training data and were not used by `scripts/train_generalized_digit_model.py`.
- The 29 earlier uploaded sheets were allowed for training and validation.

## Changes

- Added `scripts/train_generalized_digit_model.py`.
- Installed the final generalist model at `public/models/mnist-model.onnx`.
- Kept `public/models/worksheet-digit-generalist.onnx` as a secondary stabilizing model.
- Updated the browser OCR path to use centered RGB/saturation ink extraction instead of direct answer-box resizing.
- The default OCR path now uses a weighted probability ensemble:
  - primary `public/models/mnist-model.onnx`: weight 0.75
  - auxiliary `public/models/worksheet-digit-generalist.onnx`: weight 0.25

## Default App Results

All results below were run through the browser app at `https://localhost:5176`, not only through Python crop replay.

| Set | Result | Output |
|---|---:|---|
| Strict 5-sheet holdout | 49/50 cells, 4/5 perfect sheets | `benchmarks/holdout_student_samples_2026-05-15/results-default-ensemble/summary.json` |
| 29 earlier student sheets | 289/290 cells, 28/29 perfect sheets | `benchmarks/uploaded_student_samples/results-default-ensemble/summary.json` |
| 8-sheet bake-off | 80/80 cells, 8/8 perfect sheets | `benchmarks/worksheet_bakeoff/results-default-ensemble/summary.json` |

The single remaining holdout miss was `7DE72F2C-1-Photo-1`, question 9: expected `3`, predicted `0`, confidence `0.419`. This is below the review threshold, so the app should route it to teacher review rather than confidently marking it.

## Model Hashes

- `public/models/mnist-model.onnx`: `1bb4991956f9539df2b49528eca005d6e40a96091969024747074f5fd3f9a270`
- `public/models/worksheet-digit-generalist.onnx`: `50e82b5d5569198f326c4c4d127d668b1c4101e5e2aaacf71d07f85b4d193282`

## Notes

This is a strong prototype result, not a production proof. The next honest step is a larger blind set from new students, kept out of training until after evaluation.
