# Daily Summary: 2026-06-01

## Starting State

- Tony has locked the current mobile/student app UI for now.
- The current public/default Grade 2 worksheet packet is published and visually verified.
- The main product risk remains trustworthy OCR on real Grade 2 handwriting.
- OCR/capture/homography/model changes still require reproducible evidence.

## What Got Tested

- `test-app.spec.js` passed after starting the HTTPS Vite server.
- App load result: 0 console errors, 0 WASM/ONNX errors, 2 model/worker requests, and 0 failed requests.
- `npm run build` passed.
- `npm run build:github` passed with known non-fatal OpenCV script, Lexend runtime-resolution, and large-chunk warnings.
- `test-upload.spec.js` passed: Runtime Self-Test 6/6, upload flow functional, JS errors excluding expected messages 0.
- `test-upload-real.spec.js` passed all 3 existing real worksheet fixture tests.
- `test-ocr.spec.js` passed: Runtime Self-Test 6/6 and pipeline ready.
- `verify-single-pipeline.spec.js` passed: one upload produced one OCR result and timing.

## Classroom Sample Benchmark

- Ran `node scripts/eval_tony_20260530_samples.mjs` against the current local app.
- Result: 18/30 across Tony's three May 30 two-digit worksheet samples.
- Subtraction Within 20: 10/10.
- Mixed Within 50: 3/10.
- Addition Within 20: 5/10.
- Debug output showed the correct worksheet layout IDs and known worksheet model hash.
- Raw digit crops generally looked like the intended student digits.
- Several misses were low-margin recognition choices where the correct digit was often the second model choice.

## New Student Scan Failure

- Tony sent a completed Subtraction Within 20 sheet from the newly printed packet.
- Reproduced the app failure locally with `scripts/eval_uploaded_worksheets.mjs`.
- Corrected the evaluator so two-digit worksheets are scored as 10 full answers instead of 20 individual digit cells.
- Valid result for the new subtraction scan: 5/10.
- Predicted answers: 11, 15, 11, 19, 12, 11, 11, 12, 14, 11.
- Expected answers: 17, 15, 12, 12, 12, 12, 12, 12, 14, 11.
- Geometry diagnosis: the app finds the sheet and answer boxes; the main failure is OCR recognition/preprocessing on thin pencil 2s and 7s, which often collapse toward 1 or 9 in the 28x28 model input.
- Tried one narrow crop border-cleanup adjustment, but it did not improve the result, so it was reverted.

## What Changed Today

- Added the 2026-06-01 repeatable benchmark and diagnosis to `OCR_TWO_DIGIT_FINDINGS_2026-05-30.md`.
- Updated `scripts/eval_uploaded_worksheets.mjs` so future uploaded-photo evaluations report valid two-digit answer scores.
- Updated Mission Control state: the project is no longer just waiting for samples; it has a reproduced classroom OCR failure to diagnose.
- Added `docs/TWO_DIGIT_OCR_ACCEPTANCE_GATE.md` so OCR/crop/model patches must improve the 5/10 failed subtraction scan without regressing the 18/30 May 30 benchmark.
- Added `docs/CLASSROOM_OCR_RETEST_PROTOCOL.md` so the next failed live scan can be compared against a normal camera photo of the same physical page when convenient.
- Added `docs/OCR_DEBUG_CROP_REVIEW_CHECKLIST.md` so wrong or low-confidence answers are categorized as crop alignment, preprocessing, model recognition, confidence/review, or student writing behavior before patching.
- Fixed the Grade 2 worksheet generator so the A-J letter bubble, equation text, and answer box share the same row centerline.
- Regenerated and published the A/B/C worksheet SVGs and print PDFs.
- The answer-box layout geometry stayed unchanged; this was a print-layout alignment fix, not an OCR-region redesign.
- No app UI, OCR, capture, homography, model, or backend production behavior was changed during these documentation and worksheet-layout updates.

## Current Interpretation

- The app and test harness are healthy.
- The current worksheet packet is available for student testing.
- The newly aligned worksheet packet is available for future prints, while Tony's already-printed packet remains valid for the current student test.
- The OCR problem is now more specific: recognition/candidate confidence on real two-digit handwriting, not a general app crash or gross layout mismatch.
- The newest student scan makes the problem concrete enough for a narrow OCR/crop-preprocessing investigation, but not broad enough for an unguarded OCR push.

## Next Best Move

Use Tony's newest failed subtraction scan plus the May 30 three-sheet benchmark as the next truth set. Before changing production OCR logic, compare current results against saved debug crops and decide whether the safest fix is:

1. Conservative review flags for low-margin answers.
2. Candidate-selection or crop-preprocessing adjustment.
3. A small labeled handwriting training set for model improvement.

## Guardrail

Do not claim reliable two-digit classroom OCR yet. Current evidence supports careful diagnosis and conservative teacher review, not full automation. Any OCR patch should be accepted only if it improves the new 5/10 subtraction failure without regressing the 18/30 May 30 benchmark.
