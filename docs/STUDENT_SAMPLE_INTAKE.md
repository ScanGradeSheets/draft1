# Student Worksheet Sample Intake

Created 2026-05-30 for the current ScanGrade open-divider worksheet test set.

## Purpose

Use this checklist when Tony sends real student-completed worksheets. The goal is to test the current pipeline honestly before changing OCR, capture, homography, worksheet geometry, or model behavior.

## Current Test Set

Use the three open-divider worksheets:

- Sheet A: Addition Within 20
- Sheet B: Subtraction Within 20
- Sheet C: Mixed Within 50

Current packet:

- `public/worksheets/open-divider-test/printables/ScanGrade-Grade2-Worksheets-A-B-C-Open-Divider-Test-Packet.pdf`

## What Tony Should Send

Minimum useful set:

- One completed Sheet A
- One completed Sheet B
- One completed Sheet C

Better set if easy:

- Two or three students per sheet
- A mix of neat and normal handwriting
- At least one slightly imperfect photo, if that reflects real classroom use

Photo guidance:

- Show the full page.
- Include all four corner markers.
- Keep the page mostly flat.
- Avoid severe blur.
- Normal classroom lighting is fine.
- Do not rewrite answers to make them cleaner.

## Suggested File Naming

Use plain filenames that preserve sheet type and attempt number:

```text
sheet-a-student-01.jpg
sheet-b-student-01.jpg
sheet-c-student-01.jpg
sheet-a-student-02.jpg
```

If multiple photos are taken of the same page:

```text
sheet-a-student-01-photo-1.jpg
sheet-a-student-01-photo-2.jpg
```

## Where To Put Files

Preferred local intake folder:

```text
worksheet photos/student-samples/open-divider-2026-05/
```

Do not move or delete originals after importing. Keep the first received copies intact until results are summarized.

## First Codex Pass

Before any code changes, Codex should:

1. List the received files.
2. Confirm each image shows the full page and visible markers.
3. Identify which sheet type each file appears to be.
4. Run the current upload/OCR path on the samples.
5. Record results in plain English.
6. Separate failures into likely causes:
   - photo/capture quality
   - marker/page detection
   - QR/layout
   - answer-box crop
   - digit recognition
   - result display/export

## Verification Commands

Keep the known smoke tests green before and after sample testing:

```bash
npx playwright test test-app.spec.js --config=playwright.config.js
npx playwright test test-upload.spec.js --config=playwright.config.js
npx playwright test test-ocr.spec.js --config=playwright.config.js
npx playwright test verify-single-pipeline.spec.js --config=playwright.config.js
npx playwright test test-upload-real.spec.js --config=playwright.config.js
```

Do not run debug export specs unless crop/tensor artifacts are intentionally needed.

## Sample Inspection Commands

These helper scripts are available for the first pass once real photos arrive:

```bash
npm run inspect:uploaded-worksheet -- "worksheet photos/student-samples/open-divider-2026-05/sheet-a-student-01.jpg"
npm run eval:uploaded-worksheets -- "worksheet photos/student-samples/open-divider-2026-05/"*.jpg
npm run dataset:student-samples
```

Use `inspect:uploaded-worksheet` first for a small number of samples so failures can be understood before running a batch. `eval:uploaded-worksheets` writes batch results under `benchmarks/uploaded_student_samples/results` by default. `dataset:student-samples` should only be run after the expected answers are confirmed.

## Rules

- Do not tune OCR blind.
- Do not change `src/homography.js`, `src/ocr-pipeline.js`, or `src/components/CameraCapture.vue` until a real failure mode is described.
- Prefer a short report before a patch.
- If a patch is needed, make one tiny change and rerun the relevant sample.
- Preserve all sample images and test outputs until Tony reviews the summary.

## First Report Format

Use this shape for Tony:

```text
Received:
- Sheet A: N images
- Sheet B: N images
- Sheet C: N images

What worked:
- ...

What failed:
- ...

Likely causes:
- ...

Recommended next action:
- ...
```
