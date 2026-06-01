# Untracked Work Preservation Plan

Created 2026-05-30 for `/Users/openclaw/Codex Projects/scan-grade-cursor`.

This repo currently contains important modified and untracked work. Treat cleanup as risky until each item is inspected and backed up.

## 2026-05-30 Safe Preservation Update

Several items that were untracked when this plan was created have now been committed in small checkpoints:

- Recovery/project docs and Mission Control checkpoint files.
- Playwright HTTPS/baseURL and Teacher Mode test harness files.
- Playwright worksheet fixture images.
- Current open-divider worksheet test packet, SVGs, PDFs, and generator.
- Answer-box option gallery and generator.
- Backend scaffold: Cloudflare Pages Functions, D1 migration, and `wrangler.toml`.
- Student sample intake docs and uploaded worksheet inspection/evaluation scripts.
- Historical ScanGrade reports.
- OCR/dataset utility scripts.
- Model artifact inventory, benchmark artifact inventory, scratch file inventory, and Mission Control private-access notes.

Important current state:

- The remaining modified tracked files are still the risky OCR/capture/model files listed below. Do not revert or commit them casually.
- Passing Playwright fixes are now tracked, not only untracked.
- Mission Control is now tracked.
- Current worksheet assets and answer-box option assets are now tracked.
- Model/runtime artifacts under `models/`, `public/models/`, and `public/ort*` are still untracked and should not be committed without a size/storage decision.
- Stale scratch scripts such as `scripts/generate-test-image.py` and `scripts/tmp_debug_line.mjs` remain untracked intentionally because they contain old absolute paths or one-off debug assumptions.
- The remaining small scratch/legacy files are cataloged in `docs/SCRATCH_FILE_INVENTORY.md`.

## Critical Warnings

- Do not run `git clean -fd`.
- Do not run `git reset --hard`.
- Do not delete untracked Playwright tests/configs.
- Do not delete `public/models`, `models`, worksheet assets, `functions`, `migrations`, or recovery docs.
- Passing Playwright fixes and Mission Control are now tracked, but must still be preserved.
- Full project snapshot exists at:
  `/Volumes/Tony's Rugged HD/Codex Rescue Backups/scan-grade-project-snapshots/scan-grade-cursor-20260529`
- Back up before any cleanup.

## Current Modified Tracked Files

These are tracked files with local modifications. Preserve and inspect before any reset, checkout, or broad cleanup:

- `create-mnist-model.py`
- `scripts/replay_live_ocr_captured.mjs`
- `src/App.vue`
- `src/components/CameraCapture.vue`
- `src/homography.js`
- `src/ocr-pipeline.js`

These likely contain important OCR/capture/model/iPad work. Do not revert them without explicit review.

## 1. Must Preserve And Likely Commit Soon

Most of the originally listed active source, test, infrastructure, and documentation files have now been committed in small checkpoints. This section is retained as historical context for why they were preserved.

Current exception:

- Do not treat `test-pipeline.js`, `test-server.js`, `scripts/generate-test-image.py`, `scripts/tmp_debug_line.mjs`, `systemd/`, or root-level `create_test_image*.py` files as ready-to-commit active project files. They are scratch/legacy files and are now documented in `docs/SCRATCH_FILE_INVENTORY.md`.

Already-preserved examples from the original list:

- `AGENTS.md`
- `UNTRACKED_WORK_PRESERVATION_PLAN.md`
- `playwright.config.js`
- `playwright.config.ts`
- `playwright-ui.js`
- `test-app.spec.js`
- `test-ocr.spec.js`
- `test-upload.spec.js`
- `test-upload-real.spec.js`
- `verify-single-pipeline.spec.js`
- `export-crops-debug.spec.js`
- `mission-control/server.mjs`
- `mission-control/public/index.html`
- `mission-control/public/styles.css`
- `mission-control/public/app.js`
- `mission-control/state/*.json`
- `docs/CLOUDFLARE_DEPLOY.md`
- `docs/PROTOTYPE_ROADMAP.md`
- `docs/SCAN_GRADE_STUDENT_MODE_UX_SPEC.md`
- `docs/STUDENT_MODE_IMPLEMENTATION_PLAN.md`
- `functions/_lib/db.js`
- `functions/api/roster.js`
- `functions/api/submissions/index.js`
- `functions/api/submissions/[id].js`
- `migrations/0001_scangrade.sql`
- `wrangler.toml`
- `templates/scan-grade-cursor.code-workspace`
- `templates/worksheet-v1-test.svg`
- `scripts/build_centered_digit_dataset.mjs`
- `scripts/build_combined_worksheet_dataset.mjs`
- `scripts/build_student_sample_dataset.mjs`
- `scripts/eval_digit_prototypes.mjs`
- `scripts/eval_ipad_tta.mjs`
- `scripts/eval_uploaded_worksheets.mjs`
- `scripts/eval_worksheet_models.mjs`
- `scripts/experiment_raw_crop_model.py`
- `scripts/generate-test-image.js`
- `scripts/generate_answer_box_options.mjs`
- `scripts/generate_open_divider_test_worksheets.mjs`
- `scripts/import_live_ocr_debug.mjs`
- `scripts/import_live_ocr_tensors.mjs`
- `scripts/inspect_live_debug_crops.mjs`
- `scripts/inspect_uploaded_worksheet.mjs`
- `scripts/train_digit_mlp_json.mjs`
- `scripts/verify-softmax-confidence.js`
- `scripts/verify_onnx_python.py`

Playwright note:

- The HTTPS/baseURL fix is now tracked in `playwright.config.js` and `playwright.config.ts`.
- Passing navigation fixes are now tracked in the active spec files.
- Teacher/debug specs now use `/?mode=teacher` because `/` defaults to Student Mode.
- `test-upload.spec.js` also fixes the previous async `consoleLines.some(async line => ...)` assertion issue.
- `verify-single-pipeline.spec.js` has a strict-locator assertion fix after both `.results` and `.ocr-result` became visible.

Mission Control note:

- `mission-control/` is the current private dashboard for Tony/Codex shared state.
- It tracks the current mission, focused board, open-divider worksheet test set, decisions, validation history, docs, and Codex autonomy rules.
- It has been committed and should be preserved before any cleanup.

## Recommended Small Checkpoints After 2026-05-30 Safe Work

The original recovery docs, agent instructions, Mission Control, Playwright harness, worksheet assets, backend scaffold, useful scripts, and safety inventories have now been committed in small checkpoints.

Next source-code checkpoint should wait for a dedicated review of the remaining modified tracked OCR/capture/model files.

Do not include in either small checkpoint without separate review:

- `src/`
- `scripts/replay_live_ocr_captured.mjs`
- `create-mnist-model.py`
- `public/models/`
- `models/`
- `public/ort*.mjs`
- `public/ort*.wasm`
- `benchmarks/`
- `datasets/`
- worksheet/model artifacts larger than ordinary source files

## 2. Must Preserve But Maybe Should Not Commit Directly

These are important runtime/model/asset artifacts. Preserve them, but decide intentionally whether to commit, store externally, use Git LFS, or regenerate in CI/build steps.

- `public/mnist-model.onnx`
- `public/models/*.onnx`
- `public/models/*.json`
- `models/*.json`
- `public/ort*.mjs`
- `public/ort*.wasm`
- `ort-wasm-simd.wasm`
- `public/test-worksheet-calibrated.png`
- `public/test-worksheet-handwritten.png`
- `public/test-worksheet-with-digits.png`
- `public/worksheets/answer-box-options/*`
- `public/worksheets/open-divider-test/*`
- `logos/*`
- `logos/brainstorm/*`

Preservation reason:

- The app and tests depend on model/runtime files and worksheet images.
- Worksheet assets and QR/printable variants represent product/design work.
- Logo assets may be source material for branding decisions.

## 3. Generated, Debug, Or Benchmark Artifacts To Preserve For Now

These may be generated or bulky, but they document validation history and should not be deleted until reviewed:

- `benchmarks/`
- `benchmarks/uploaded_student_samples/fixtures/tony-20260530-two-digit-sheets/*`
- `benchmarks/uploaded_student_samples/results-tony-20260530-repeatable/*`
- `benchmarks/worksheet_bakeoff/*`
- `benchmarks/holdout_student_samples_2026-05-15/*`
- `docs/reports/*`
- `create_proper_test_image.py`
- `create_test_image.py`
- `create_test_image2.py`
- `create_test_image3.py`
- `scripts/tmp_debug_line.mjs`
- `test-worksheet.png`
- `test-results/`

Possible later action:

- Keep useful benchmark manifests, reports, and representative samples.
- Move large/generated outputs to ignored artifact storage if they can be reproduced.
- Add precise `.gitignore` rules only after preserving what matters.

2026-06-01 note:

- `benchmarks/` is currently about 8 GB.
- It includes Tony-provided/student worksheet photos, debug crops, model-input images, and repeatable OCR benchmark outputs.
- Do not commit the whole `benchmarks/` directory casually. Treat original worksheet photos as private/local evidence unless Tony explicitly approves a redacted or selected commit.
- `scripts/eval_tony_20260530_samples.mjs` is useful and lightweight, but it depends on local benchmark fixtures. If committed later, commit it intentionally with clear fixture/privacy decisions.
- The current OCR gate evidence is the 2026-06-01 failed subtraction scan at 5/10 plus the May 30 three-sheet benchmark at 18/30.
- Preserve local result folders tied to those runs until the OCR reliability decision is revisited.
- Start with `docs/OCR_RELIABILITY_OPERATING_MAP.md` before moving, deleting, committing, or interpreting OCR benchmark artifacts.

## 4. Recovery And Context Files

These are the current project memory after chat-history loss. Preserve them until a smaller committed memory/doc set is agreed:

- `SCANGRADE_RECOVERED_PROJECT_MEMORY.md`
- `CODEX_RECOVERED_SESSION_PATHS.txt`
- `CODEX_RECOVERY_CONTEXT.md`
- `CODEX_RECOVERY_PRE_MAY27_SCANGRADE_HISTORY.md`
- `CODEX_RECOVERY_PRE_MAY27_SCANGRADE_HISTORY_PATHS.txt`
- `CODEX_RECOVERY_STATUS_KANBAN.md`
- `CODEX_RECOVERY_STATUS_KANBAN_PATHS.txt`

Notes:

- `SCANGRADE_RECOVERED_PROJECT_MEMORY.md` is the best compact starting point for future agents.
- The larger `CODEX_RECOVERY_*` files are evidence/context and should not be deleted merely because they are untracked.

## 5. Unknown — Inspect Before Deleting

These need inspection before deciding whether to commit, archive, ignore, or delete:

- `systemd/`
- `tmp_blocked/`
- `tools/`
- `tools/kanban/`
- `products/`
- `dist/`
- `server/`
- `logs/`
- `.state/`
- `datasets/`
- `worksheet photos/`
- `scan-grade BACKUP FEB @%/`
- `scan-grade FEB BACKUP/`
- `.venv/`
- `.venv-mnist/`
- `node_modules/`
- `public/layouts/`
- `layouts/`

Some of these may be ignored by Git, generated, or old backup material. Do not delete them from the working folder without first confirming:

1. Whether they are needed by current scripts/tests.
2. Whether they contain unique source or data not present elsewhere.
3. Whether they are included in the full project snapshot.
4. Whether a fresh backup has been made after the latest work.

## Cleanup Procedure Recommendation

1. Make a fresh copy of the whole repo folder before cleanup.
2. Save `git status --short` and `git ls-files --others --exclude-standard` output to a dated audit file.
3. Commit small source/test/docs groups first, starting with Playwright config/specs and recovered memory docs.
4. Separately decide storage policy for models, ONNX runtime files, worksheet PDFs/images, and benchmark datasets.
5. Only after commits/backups, add `.gitignore` rules for truly generated artifacts.
6. Never use broad destructive cleanup commands; delete only explicitly reviewed paths.
