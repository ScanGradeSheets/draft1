# ScanGrade Recovered Project Memory

Recovered on 2026-05-29 after the Codex update hid the older "Tuning ScanGrade" chat history.

This file combines two sources:

- `CODEX_RECOVERY_PRE_MAY27_SCANGRADE_HISTORY.md`: background only.
- May 27+ mission-control / kanban recovery from `CODEX_RECOVERY_CONTEXT.md`, `CODEX_RECOVERY_STATUS_KANBAN.md`, and `CODEX_RECOVERY_STATUS_KANBAN_PATHS.txt`.

Important boundary: do not treat any pre-May-27 mission-control or kanban details as the current plan. The current mission-control plan starts on May 27, 2026.

## 1. Background Before May 27

ScanGrade is a zero-install classroom worksheet scanner for iPad/Safari and desktop browsers. The core loop is: a student completes a printed worksheet, scans it on a shared classroom iPad, and the app grades/saves the result for teacher review.

Major product decisions:

- Optimize for 3-4 shared iPads in a classroom, not one device per student.
- Students should be able to scan independently with a calm, simple Student Mode.
- Teachers should review saved results asynchronously, grouped by student.
- Guest scan is useful, but the preferred classroom flow is roster/name selection rather than handwriting name OCR.
- The app should reduce teacher marking friction; avoid admin-heavy dashboards until the shared-iPad loop is validated.
- Validate one disciplined worksheet/template before expanding into many formats.

OCR, model, and capture decisions:

- Use OpenCV-style homography from black square corner markers to normalize the worksheet.
- Use answer-box crops after warp/normalization, then ONNX digit recognition with confidence scoring.
- Preserve known-good MacBook OCR behavior when changing iPad/camera code.
- Avoid casual retraining on exact test captures; use holdouts and broad validation.
- Low-confidence or ambiguous reads should be routed to teacher review. A confident wrong answer is worse than a visible review flag.
- Browser ONNX tensor handling had a known fix/principle: pass/copy `Float32Array` correctly.

iPad problems and attempted fixes:

- Older iPads had black/blank capture risk, invalid crop rectangles, overly permissive auto-capture, and cases where a sheet captured but was not marked.
- Fixes attempted included waiting for drawable video frames, `cameraReady` gating, safe crop bounds, blank-frame rejection, four-corner marker gates, worksheet-interior brightness checks, and pre-OCR sheet rechecks.
- iPhone/MacBook performance was often much better than older iPad performance.
- Real iPad verification remains more important than desktop-only confidence.

QR, layout, and worksheet decisions:

- QR is the handshake, not the full layout container.
- QR should identify template/version/sheet instance/answer key/checksum or similar compact fields.
- Layout geometry belongs in known template definitions/registry files.
- Black square corner markers are the chosen marker system.
- Grade 2 worksheet assets were planned around clean 10-question sheets, clear answer boxes, QR, black markers, and two-digit answer support.

Testing/deployment context:

- Recovered history mentions strong MacBook/local bake-off results and later encouraging iPad results, but these did not prove broad classroom readiness.
- Tests proved the pipeline under known conditions; they did not prove all worksheet styles, all handwriting, old iPads, classroom lighting, or production persistence.
- Production target is `scangrade.io`, registered through Cloudflare.
- HTTPS matters because camera access requires a secure context.
- LocalStorage is acceptable for prototype validation, but real classroom deployment needs shared persistence.

Still-relevant pre-May-27 principles:

- Do the smallest high-leverage move first.
- Keep the first pilot narrow: one teacher, one class, one worksheet type, a few shared iPads.
- Do not generalize the worksheet platform before one template works reliably.
- Do not let tooling work eclipse product validation.
- When changing camera code, test MacBook and real iPad paths.
- When changing OCR/model code, run replay/bake-off style validation before trusting the change.

Superseded or stale pre-May-27 items:

- Any pre-May-27 mission-control/kanban plan is not current.
- Some older notes saying QR decode, exports, worksheet assets, or roster/review flows were absent are outdated; the repo now contains early versions of these.
- Single-digit-only assumptions are outdated; current assets/layouts include two-digit support.

## 2. Current May 27+ Mission-Control / Kanban Plan

The current mission-control effort begins May 27, 2026. The recovered excerpts do not contain a perfect continuous transcript, but they do show the intended direction.

Current mission-control goal:

- Create a reliable local project-control surface for ScanGrade that keeps the active mission, kanban state, blocked work, and next actions visible across Codex sessions.
- Make it durable enough that a Codex/session update cannot erase the working plan again.
- Use it as an operating memory for the ScanGrade build, not as a separate product direction that distracts from ScanGrade.

Recovered implementation clues:

- `kanban.html` and `board_state.json` are the board artifacts.
- `tools/patch_kanban.py` patched a board with editable Current Mission and a Blocked column.
- `tools/kanban_save_server.py` and `tools/board_api.py` expose/save board state.
- `tools/fetch_board.sh`, `tools/kanban/*`, `tools/worker_tick.sh`, and `tools/auto_safe_tick.sh` suggest a local control loop, worker/status updates, and safety checks.
- Some recovered paths reference an older `.openclaw/workspace/scan-grade` location and Hobbes/Tailscale URLs; treat those as historical infrastructure clues unless verified in the current repo.

Likely board lanes:

- Done
- In Progress
- Next / To Do
- Later / Backlog
- Blocked / Risky
- Review, where useful for validation gates

Current mission-control plan, reconstructed:

- Keep the active ScanGrade mission explicit.
- Track work by actionable cards rather than vague notes.
- Give blocked/risky items their own visible lane.
- Preserve board state in a file/API rather than relying on chat memory.
- Include enough context for future Codex agents to resume without rereading raw JSONL.
- Prefer read-only recovery and careful comparison before edits when context is uncertain.

Confidence:

- Directly supported: May 27+ recovery contains user prompts about "scan grade mission control" and "new kanband board"; repo/recovery contains board files, save server scripts, editable mission patch, Blocked column, and SAFE update scripts.
- Inferred: exact UI design, final lane names, worker notification behavior, and any phone/iMessage workflow. These need targeted raw-session inspection before implementation.

## 3. Current App State

Current repo location:

- `/Users/openclaw/Codex Projects/scan-grade-cursor`

App stack:

- Vue 3 + Vite.
- Browser camera capture via MediaDevices.
- OpenCV/homography-style worksheet normalization.
- ONNX digit recognition through `onnxruntime-web`.
- QR decode through `jsqr`.
- Playwright tests exist, but test config may lag behind the HTTPS dev setup.
- 2026-05-30 update: active Playwright specs now use the HTTPS Vite baseURL on port 5174, and Teacher/debug specs open `/?mode=teacher` before expecting Teacher-only controls.

Implemented or present in the repo:

- Student Mode with roster/name selection and capture flow.
- Teacher Review-style saved scan queue, grouped by student.
- Local saved-scan storage with API fallback scaffolding.
- Real OCR pipeline with confidence scoring.
- Correct/incorrect marking when answer key is present.
- JSON and CSV export.
- QR decode for layout/template/answer-key metadata.
- Layout registry and multiple worksheet layout JSON files.
- Printable worksheet PDFs, worksheet manifest, and QR assets.
- Cloudflare Pages / D1 backend scaffold: functions, migration, and deployment docs.
- Scripts for dataset building, OCR/model evaluation, live OCR replay, and labeled crop export.

Current product direction:

- Prove one clean classroom loop first: student chooses name, scans a worksheet on shared iPad, result saves, teacher reviews.
- Deploy eventually to `scangrade.io` over HTTPS with shared persistence.
- Expand worksheet/template breadth only after the narrow loop is reliable.

## 4. Current Risks

High-priority risks:

- Real older-iPad behavior is still the central product risk.
- Auto-capture can be too strict or too loose; both are bad in the classroom.
- A sheet may capture but fail to annotate/mark if QR/layout/homography/OCR state is off.
- OCR/model changes can accidentally improve a narrow test set while weakening generalization.
- Teacher trust depends on review flags surfacing uncertainty instead of hiding it.

Repo/process risks:

- The worktree is dirty with tracked modifications and many untracked files; future agents must not revert or overwrite user work.
- Some docs are older than the current repo and should be treated as directional, not authoritative.
- `vite.config.js` currently serves HTTPS on port 5174; active Playwright config/specs have been aligned, but older docs may still mention HTTP.
- Cloudflare/D1 persistence appears scaffolded, not proven as the live classroom data path.
- Mission-control recovery is partial; exact May 27+ UX/automation details are not fully recovered from a continuous transcript.

## 5. Immediate Next Action

2026-05-29 test harness note:

- Playwright/Vite HTTPS mismatch was fixed.
- Playwright `baseURL` now uses `https://localhost:5174` with `ignoreHTTPSErrors`.
- Hardcoded `http://localhost:5174` navigations in active specs were replaced with baseURL-relative `page.goto('/')`.
- `test-app.spec.js` passed with 0 console errors, 0 WASM/ONNX errors, 2 model/worker requests, and 0 failed requests.
- No production OCR/capture/homography/model/backend files were touched.

2026-05-29 follow-up test note:

- Playwright HTTPS/baseURL mismatch was fixed.
- `test-app.spec.js` passed.
- `test-upload.spec.js` initially failed because it expected Teacher UI, but `/` defaults to Student Mode.
- `test-upload.spec.js` now navigates to `/?mode=teacher`.
- `test-upload.spec.js` passed with Runtime Self-Test: ALL TESTS PASSED (6/6) and JS Errors excluding expected: 0.
- No production app code, OCR, capture, homography, model, worksheet, backend, or recovery files were touched for the test fixes.
- `test-upload.spec.js` appears untracked, so future agents should preserve/check local untracked test files carefully before cleanup.

2026-05-30 safe verification note:

- While waiting for Tony's real student worksheet samples, Codex fixed remaining active Teacher Mode test-harness mismatches.
- `test-ocr.spec.js`, `test-upload-real.spec.js`, `verify-single-pipeline.spec.js`, and `export-crops-debug.spec.js` now open `/?mode=teacher` before expecting Runtime Self-Test.
- `test-upload.spec.js` no longer uses the incorrect async `consoleLines.some(async line => ...)` assertion.
- `verify-single-pipeline.spec.js` avoids a Playwright strict-locator false failure when both `.results` and `.ocr-result` are present.
- Passed on 2026-05-30: `test-app.spec.js`, `test-upload.spec.js`, `test-ocr.spec.js`, `verify-single-pipeline.spec.js`, and `test-upload-real.spec.js` with all three fixture cases.
- No production app code, OCR, capture, homography, model, worksheet, backend, or dataset logic was touched for these test-harness fixes.

2026-05-30 worksheet packet note:

- Tony confirmed the current public/default worksheets needed to match the open-divider answer boxes being classroom-tested.
- The default Grade 2 A/B/C worksheet SVGs, layout JSON, and printable PDFs now use the open/notch divider answer boxes instead of the older dashed center guide.
- Footer worksheet branding now matches the app convention: `ScanGrade` in black with lighter `.io`, lowered closer to the QR code.
- The GitHub Pages worksheet files were published after the generator change.
- Verification included `npm run build`, `npx playwright test test-app.spec.js --config=playwright.config.js`, `npm run build:github`, a local SVG screenshot check, and a raw GitHub `gh-pages` check confirming `open-divider-guide` in the default mixed worksheet.
- OCR/capture/homography/model/backend logic was not touched for this worksheet-design correction.

Safest next implementation action for the ScanGrade app:

1. Wait for Tony's completed open-divider worksheet samples.
2. Run the existing upload/OCR smoke tests against those real samples.
3. Translate failures into plain-English causes before patching.
4. Only after that, make narrow fixes to `CameraCapture.vue` or the OCR pipeline based on actual failure mode.

Safest next action for mission control:

1. Inspect the May 27+ raw session files listed in `CODEX_RECOVERY_STATUS_KANBAN_PATHS.txt` using targeted searches only.
2. Search for terms such as `mission control`, `kanband`, `kanban`, `Current Mission`, `Blocked column`, `board_state`, `kanban.html`, `SAFE update`, `worker_tick`, and `iMessage`.
3. Update this memory or a dedicated mission-control spec only after the exact May 27+ plan is recovered.

Do not scan the 24 GB Desktop backup, and do not load all of `~/.codex` at once.

## 6. Rules For Future Codex Agents

Recovery/context rules:

- Treat this file as the starting memory, not the whole truth.
- Pre-May-27 history is product/OCR/background only.
- May 27+ is the only valid source window for the current mission-control/kanban plan.
- Clearly label what is directly recovered versus inferred.
- When context is missing, use targeted `rg` searches against specific recovered session files.

Editing rules:

- Do not edit, stage, commit, refactor, or run broad tests unless the user asks or the implementation task requires it.
- Never revert user changes in the dirty worktree.
- Use `apply_patch` for manual edits.
- Keep changes narrowly scoped.
- Show diffs when asked.

ScanGrade engineering rules:

- Protect the current best MacBook/OCR behavior while fixing iPad issues.
- Validate camera changes on both desktop and real iPad.
- Validate model/OCR changes with replay or bake-off scripts.
- Prefer review flags over overconfident wrong grading.
- Do not train/tune only on exact known captures and declare victory.
- Keep Student Mode simple and kid-safe; keep debug/teacher controls out of the student path.
- Prioritize the shared-iPad classroom loop over dashboards or broad platform features.

Mission-control rules:

- The mission-control board exists to preserve project state and next actions.
- Board state must be durable outside chat.
- A Blocked/Risky lane is part of the recovered direction.
- Current Mission should stay explicit and editable.
- Automation/safety tooling should support ScanGrade work, not distract from shipping the app.
