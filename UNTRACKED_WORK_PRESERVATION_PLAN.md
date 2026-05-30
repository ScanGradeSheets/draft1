# Untracked Work Preservation Plan

Created 2026-05-30 for `/Users/openclaw/Codex Projects/scan-grade-cursor`.

This repo currently contains important modified and untracked work. Treat cleanup as risky until each item is inspected and backed up.

## Critical Warnings

- Do not run `git clean -fd`.
- Do not run `git reset --hard`.
- Do not delete untracked Playwright tests/configs.
- Do not delete `public/models`, `models`, worksheet assets, `functions`, `migrations`, or recovery docs.
- Passing Playwright fixes currently live in untracked test/config files.
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

These look like source, test, infrastructure, or documentation files that are part of the active project shape and should likely be committed after review:

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
- `test-pipeline.js`
- `test-server.js`
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
- `scripts/generate-test-image.py`
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

- The HTTPS/baseURL fix is currently in untracked `playwright.config.js` and `playwright.config.ts`.
- Passing navigation fixes are currently in untracked spec files, especially `test-upload.spec.js`.
- `test-upload.spec.js` now uses `/?mode=teacher` because `/` defaults to Student Mode.

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
