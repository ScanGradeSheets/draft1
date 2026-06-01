# Student Sample Triage Runbook

Created 2026-05-30 so the first real student worksheet samples can be evaluated quickly and honestly.

This runbook is for Codex. It turns the intake checklist into a step-by-step first pass.

## Goal

When Tony sends completed worksheets, produce a plain-English report before changing OCR, capture, homography, worksheet geometry, or model behavior.

The first question is not "what code should change?"

The first question is:

> What would Tony experience if these were real classroom scans?

## Inputs

Expected current sheets:

- Sheet A: Addition Within 20
- Sheet B: Subtraction Within 20
- Sheet C: Mixed Within 50

As of 2026-05-30, the default public worksheets and the explicit open-divider test worksheets should visually match: newer open/notch divider answer boxes plus lowered `ScanGrade.io` QR branding. If a submitted page has the older dashed center guide, record that as an outdated-sheet issue before evaluating OCR.

Preferred folder:

```text
worksheet photos/student-samples/open-divider-2026-05/
```

Preserve original filenames and original files.

If Tony sends a page that already failed in the live app, also use:

- `docs/CLASSROOM_OCR_RETEST_PROTOCOL.md`

That protocol helps compare live app capture against normal camera photos before changing OCR or crop logic.

## Step 1: Inventory

List the files:

```bash
find "worksheet photos/student-samples/open-divider-2026-05" -maxdepth 1 -type f | sort
```

Record:

- filename
- likely sheet type
- whether full page is visible
- whether all four corner markers are visible
- whether QR is visible
- obvious blur/shadow/crop problems

Do not discard imperfect photos. Imperfections are part of the classroom test.

## Step 2: Baseline App Health

Run the smallest app health check:

```bash
npx playwright test test-app.spec.js --config=playwright.config.js
```

If this fails, stop and diagnose app/test harness health before evaluating samples.

## Step 3: Single-Sample Inspection

Start with one representative image:

```bash
npm run inspect:uploaded-worksheet -- "worksheet photos/student-samples/open-divider-2026-05/sheet-a-student-01.jpg"
```

This produces JSON in stdout. Look for:

- predictions count
- marker debug state
- fallback/page-rect flags
- crop rect count
- obvious errors

Plain-English interpretation:

- Did the app see the page?
- Did it find the answer boxes?
- Did it produce a plausible answer list?
- Did anything look obviously broken before digit recognition?

## Step 4: Batch Evaluation

If single-sample inspection looks reasonable, run the batch evaluator.

Important: set expected digits for the sheet type if evaluating one sheet type at a time.

Example shape:

```bash
SG_EXPECTED_DIGITS=15,15,17,18,11,11,12,16,17,17 \
npm run eval:uploaded-worksheets -- --out "benchmarks/uploaded_student_samples/results/open-divider-2026-05-addition" \
"worksheet photos/student-samples/open-divider-2026-05"/sheet-a-*.jpg
```

If mixing Sheet A/B/C in one folder, do not use a single expected digit list unless all files share the same answer key. Prefer one batch per sheet type.

Batch outputs:

- `rows.json`
- `summary.json`
- `summary.md`
- debug crop/image folders under `debug/`

## Step 5: Categorize Failures

Use these categories:

- photo quality
- page/corner detection
- QR/layout detection
- answer-box crop
- digit recognition
- confidence/review UX
- student writing behavior
- worksheet design issue

Do not collapse everything into "OCR failed."

For wrong or low-confidence OCR answers, use:

- `docs/OCR_DEBUG_CROP_REVIEW_CHECKLIST.md`

That checklist separates good-crop recognition failures from shifted crops, damaged preprocessing, and student writing outside the answer box.

Examples:

- If the page is cropped and markers are missing, this is photo/page detection first.
- If crops are shifted but digits are readable by eye, this is crop/alignment first.
- If crops are good but digits are wrong, this is recognition/model/confidence.
- If students write across the divider or outside the box, this may be worksheet design or student behavior.

## Step 6: Teacher-Trust Read

For each sample, answer:

- Would Tony understand what happened?
- Would the result be faster than marking from scratch?
- Did ScanGrade flag uncertainty or hide it?
- Would a student know whether to retry?
- Would this be acceptable in practice mode?
- Would this be acceptable in assessment mode?

## Step 7: Report

Use `docs/STUDENT_SAMPLE_EVAL_REPORT_TEMPLATE.md`.

Keep the first report short and plain:

- what arrived
- what worked
- what failed
- likely causes
- whether the next step is more samples, worksheet adjustment, app fix, or pilot

## Step 8: Patch Rules

Only patch app logic if:

- the failure mode is clear
- there is a reproducible sample
- the patch is narrow
- baseline tests are green before the patch
- the same sample can be rerun after the patch

Before running even a local OCR candidate, use:

- `docs/OCR_CANDIDATE_EXPERIMENT_PLAN.md`

Do not patch:

- OCR/capture/homography based on vibes
- worksheet geometry before Tony understands the tradeoff
- model behavior without a before/after evaluation

## Expected Answer Key Reminder

Do not assume every sample uses the same expected answers.

Before scoring correctness, confirm the sheet type and answer key from the current packet.

If unsure, report recognition output without correctness scoring.

Current answer-key helper:

- `docs/OPEN_DIVIDER_SAMPLE_ANSWER_KEYS.md`

## Privacy Rule

Do not commit student-identifiable images.

Preserve locally or in the agreed external backup location until Tony decides what can be stored in git, ignored artifact storage, or deleted.
