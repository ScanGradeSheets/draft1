# ScanGrade Scratch File Inventory

Date: 2026-05-30

This inventory documents small untracked scratch and reference files that remain after the safe preservation commits. It is meant to prevent accidental cleanup, not to bless these files as current production code.

## Keep Untracked Unless Reviewed

Do not delete these files with `git clean -fd`. Do not commit them as a bundle. Inspect each one before deciding whether it should be modernized, archived elsewhere, ignored, or removed.

## Legacy Synthetic Worksheet Scripts

- `create_test_image.py`
- `create_test_image2.py`
- `create_test_image3.py`
- `create_proper_test_image.py`
- `scripts/generate-test-image.py`
- `test-worksheet.png`

These appear to be early synthetic worksheet/marker experiments from February 2026. They predate the current worksheet packet and current Playwright fixtures.

Current concerns:

- Several scripts generate or overwrite `test-worksheet.png` in the repo root.
- `scripts/generate-test-image.py` writes to an old absolute path under `/Users/openclaw/.openclaw/workspace/scan-grade/public/`.
- The generated layouts do not represent the current open-divider answer-box worksheet packet.

Recommendation:

- Preserve for now as historical debugging context.
- Do not run or commit without first updating paths and verifying whether any output is still useful.
- Prefer the committed worksheet fixture generators and Playwright fixtures for current testing.

## Legacy Test Helpers

- `test-pipeline.js`
- `test-server.js`

`test-pipeline.js` is a March 2026 pipeline smoke script. It checks for the model and source files, but it expects a `const LAYOUT = { ... }` block inside `src/App.vue`, which is no longer the current layout architecture. It also tells the user to open `http://localhost:5173/`, while the current Playwright/Vite setup uses `https://localhost:5174`.

`test-server.js` launches `npx playwright test --ui`. It is small, but not wired into the current package scripts and does not add much beyond direct Playwright commands.

Recommendation:

- Leave untracked for now.
- If kept, modernize in a separate test-harness cleanup after current OCR/capture validation work.
- Do not treat `test-pipeline.js` output as evidence of current app correctness.

## Debug Line Probe

- `scripts/tmp_debug_line.mjs`

This is a one-off Playwright/OpenCV probe for a specific live OCR debug JSON file on Tony's Desktop. It navigates to `https://127.0.0.1:5175/?liveOcrDebug=1`, while the current local app target is `https://localhost:5174`.

Recommendation:

- Preserve as historical evidence of the line-detection debugging approach.
- Do not run as-is.
- If the technique is still useful, port the idea into a named replay/inspection script using configurable input paths and `SG_REPLAY_URL` or the current local app URL.

## Old Systemd Service Files

- `systemd/scan-grade-app.service`
- `systemd/scan-grade-board.service`

These point to the old workspace path `/Users/openclaw/.openclaw/workspace/scan-grade`. The board service also references `tools/board_api.py`, which is not the current Mission Control server.

Recommendation:

- Do not install or commit these as deployment instructions.
- Keep untracked until deployment/server strategy is revisited.
- Replace with a fresh Tailscale/Mission Control service note only after Tony confirms how he wants private device access managed.

## Logo Brainstorm Folder

- `logos/`

This folder contains March 2026 logo brainstorm screenshots and candidate images. It also contains `.DS_Store`. The app's current public logo assets are already tracked separately under `public/`.

Recommendation:

- Preserve locally as design reference.
- Do not commit `.DS_Store`.
- Commit only selected source/final brand assets after Tony chooses what should be canonical.

## Related Inventories

- `docs/MODEL_ARTIFACT_INVENTORY.md`
- `docs/BENCHMARK_ARTIFACT_INVENTORY.md`
- `UNTRACKED_WORK_PRESERVATION_PLAN.md`
