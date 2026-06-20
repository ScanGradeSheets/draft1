# ScanGrade Active Handoff

Last updated: 2026-06-20
Current thread: SG 3
Previous thread: SG 2 (`019e760b-4e8f-7751-be8b-40baddcb8e58`)

Purpose:
This is the first file to read when Codex loses chat history, a Codex update hides a thread, or a new ScanGrade thread starts. It captures the live working state. Treat older recovery files as background, and treat this file as the current handoff until it is superseded.

## Recovery Start Routine

1. Read `AGENTS.md`.
2. Read this file.
3. Read `SCANGRADE_RECOVERED_PROJECT_MEMORY.md`, `SCANGRADE_VISION_AND_PRODUCT_PRINCIPLES.md`, and `SCANGRADE_VISION_INTERVIEW_ADDENDUM.md`.
4. Read `docs/SG_THREAD_HANDOFF_PROTOCOL.md`.
5. Inspect repo state with `git status --short` before editing.
6. Do not scan all of `~/.codex` or the 24 GB backup.

## Current Mission

Collect Tony's final Grade 1 classroom evidence before summer break, keep the public app and private Mission Control reachable, and convert the results into a narrow September Teachers Pay Teachers launch path.

Current targets:

- Use the Grade 1 last-week packet to collect varied real classroom scans before school ends.
- Score app detection against what the student wrote, not only against the correct math answer.
- On rough live camera captures, prefer yellow teacher review over any confident wrong read.
- Preserve the solved 9-photo confidence benchmark as a regression gate when OCR/capture changes resume.
- Review flags are acceptable for genuinely ambiguous handwriting; confident wrong reads are not acceptable.

Important interpretation:
Score OCR against the handwritten answer visible in the box, not only against the worksheet answer key. Some student answers are mathematically wrong, and those should become confident red Xs only when the OCR read itself is trustworthy.

Tony reaffirmed this on 2026-06-06: math-wrong student answers are good evidence because they simulate actual app performance. Optimize detection relative to what the student wrote, not relative to the correct math answer.

## Debug Scan Auto Upload

On 2026-06-19, SG 3 added an auto-upload path for large classroom debug-scan collection. This was requested because Tony has roughly 160 Grade 1 packet pages to scan and manual downloads of every JSON/crop preview are too slow.

Implementation:

- Browser debug mode accepts `debugUploadUrl`, `debugUploadToken`, and `debugAutoUpload=1` query params.
- The settings persist in browser storage, so Tony only needs to open the prepared URL once per scan device.
- Each debug scan posts the full live OCR debug bundle to Mission Control.
- Mission Control now exposes token-protected `POST /api/debug-scans` and stores the evidence under `private-evidence/debug-scans/YYYY-MM-DD/<scan-id>/`.
- Saved files include `debug.json`, `summary.json`, `captured.png`, `warped.png`, `raw-crops/*.png`, and `model-inputs/*.png` when available.
- 2026-06-19 follow-up: debug uploads now also include `marked-sheet.jpg` and `overlay-debug.json` when the browser successfully renders the marked result. Use these to diagnose yellow review circles, checks, or X marks that appear in the wrong place.
- 2026-06-20 follow-up: Mission Control debug uploads now accept current browser field names plus fallback aliases for captured/marked/crops images. When present, the receiver saves `captured.png`, `marked-sheet.jpg`, `overlay-debug.json`, `warped.png`, `crops.png`, `raw-crops/*.png`, and `model-inputs/*.png`.
- `private-evidence/` is ignored by git; do not commit this student evidence.
- Manual corrections are not auto-uploaded over the raw scan result. The auto-saved bundle is intended to represent what the app saw at scan time.
- Current public debug build label after the classroom-debug follow-up: `2026.06.20-0820-EDT-sg3-classroom-debug-fix`.

Runbook:

```text
docs/DEBUG_SCAN_AUTO_UPLOAD.md
```

Expected local receiver command:

```text
SG_DEBUG_UPLOAD_TOKEN=<short-secret> node mission-control/server.mjs
```

Prepared public scan URL pattern:

```text
https://scangradesheets.github.io/draft1/?liveOcrDebug=1&debugAutoUpload=1&debugUploadUrl=https%3A%2F%2Fhobbes-mac-mini.tail9a3379.ts.net%2Fmission-control%2Fapi%2Fdebug-scans&debugUploadToken=<short-secret>
```

The scan device needs an HTTPS route to the receiver. The tailnet Mission Control route is the intended route. If it shows `502`, first confirm the local Mission Control server is running on the Mac.

## 2026-06-20 Classroom Debug Fix

Tony uploaded classroom scans from the Grade 1 last-week packet and reported that results were still disappointing. Analysis found two separate failure families:

- Safe policy failure: one-digit handwritten answers in two-slot boxes were sometimes read as fake two-digit answers because the optional blank slot picked up a weak guide-line/artifact digit, for example `5 -> 51`, `8 -> 84`, or `7 -> 71`.
- Real recognition/crop failure: some visual formats and two-digit layouts still produce low-quality crops or weak recognition. These should stay yellow review until the layout/capture/OCR path is improved.

Changes made:

- Added a conservative optional one-digit blank override in `src/components/CameraCapture.vue`. It only applies to two-slot answer groups whose worksheet answer is one digit, where one slot confidently matches the expected digit and the other slot has weak/review/artifact evidence. The artifact slot is treated as blank instead of creating a false companion digit.
- Marked-sheet annotation geometry now prefers the expected printed answer slot (`layoutBoxRect` / `expectedRect`) before crop/refined rectangles. This should keep yellow review circles closer to the answer boxes instead of drifting with crop geometry.
- Mission Control debug scan saving now preserves marked-sheet screenshots and image assets more robustly, including fallback key names.

Local replay on the saved 2026-06-20 classroom debug uploads showed this patch rescued 3 optional-blank cases in the 70-question packet sample and reduced review groups from 38 to 35 in that replay. This is not enough to call the new packet formats reliable; it is a safe incremental fix plus better evidence capture. The remaining next work is layout/crop robustness on ten frames, dot collections, number bonds, number patterns, place value, and the two-digit fact rows.

Verification completed:

```text
node --check mission-control/server.mjs
local authorized POST /api/debug-scans smoke test saved captured.png, marked-sheet.jpg, overlay-debug.json, warped.png, crops.png, raw-crops/raw-01.png, and model-inputs/model-01.png
saved classroom debug replay: optional blank override +3, review groups 38 -> 35
npm run build
npm run build:github
compiled dist sanity check: /draft1/ base OK, build label OK, optional policy present, marked-sheet upload present
```

## Grade 1 Last-Week Classroom Test Packet

On 2026-06-17, SG 3 generated a new 10-page Grade 1 packet for Tony's final classroom testing window before summer break.

Generator:

```text
scripts/generate_grade1_last_week_test_packet.mjs
```

Printable files:

```text
public/worksheets/grade1-last-week-test-20260617/printables/ScanGrade-Grade1-Last-Week-Test-Packet.pdf
public/worksheets/grade1-last-week-test-20260617/printables/ScanGrade-Grade1-Last-Week-Test-Answer-Key.pdf
```

Index and manifest:

```text
public/worksheets/grade1-last-week-test-20260617/index.html
public/worksheets/grade1-last-week-test-20260617/manifest.json
```

Layouts were written to both:

```text
public/layouts/sg-g1-lw-*.json
layouts/sg-g1-lw-*.json
```

Packet composition:

- Addition single-digit answers, one answer slot.
- Addition two-digit answers, two answer slots.
- Subtraction single-digit answers, one answer slot.
- Subtraction two-digit answers, two answer slots.
- Mixed addition/subtraction within 20, mixed one-slot and two-slot answers.
- Ten frames to 20, mixed one-slot and two-slot answers.
- Dot collections to 20, mixed one-slot and two-slot answers.
- Number bonds to 20, mixed one-slot and two-slot answers.
- Number patterns, mixed one-slot and two-slot answers.
- Place value and number sense to 50, two answer slots.

Verification completed:

```text
node --check scripts/generate_grade1_last_week_test_packet.mjs
node scripts/generate_grade1_last_week_test_packet.mjs
custom manifest/layout structure check: 10 templates, 114 answer boxes
Playwright screenshots reviewed for lw01, lw02, lw05, lw06, lw08, lw09, lw10
npm run build
```

2026-06-18 formatting revision:

- Sheets 1-5 and 9 now use the older centered fact-row / sequence formatting with larger printed numerals and no grey practice lines.
- Sheet 5 now uses two-slot boxes for every question so answer length is not given away.
- Sheet 6 now stacks two ten frames vertically with a two-slot answer box to the right, centered with the letter bubble.
- Sheet 7 now uses two-slot boxes and keeps dot collections narrower while allowing them to extend vertically.
- Sheet 8 number-bond connector lines now meet the center of the whole answer box instead of visually pointing at individual digit cells.
- Sheet 9 now uses larger number-pattern text, no grey line, and two-slot boxes throughout.
- Sheet 10 no longer uses dotted work boxes; prompts and answer boxes are aligned on the letter-bubble centerline.
- All subtitles are now one short instruction sentence rather than "Grade 1 Math".
- Regenerated PDFs/SVGs/layout JSON and verified `grade1 last-week structure ok: 10 templates 120 boxes`; `npm run build` passed.

2026-06-18 follow-up template tightening:

- Fact-row and pattern letter bubbles now sit closer to their questions using a text-start spacing rule based on the longest prompt in the column, instead of a far-left fixed rail.
- Ten-frame, dot-collection, work-card, and number-bond letter bubbles were nudged closer while preserving clear separation from diagrams/prompts.
- Sheet 8 number-bond circles now have white fill and top-circle connector starts lower, so lines do not visually run through the top value circle.
- Sheet 10 question D changed from unclear `27 or 32?` to a clearer two-line greater-number prompt: `greater:` / `27 or 32`.
- Regenerated all worksheet SVGs, QR images, PDFs, manifest, and layout JSON for the Grade 1 last-week packet.
- Rendered the packet to `tmp/pdfs/grade1-last-week-preview/page-*.png` and refreshed `tmp/pdfs/grade1-last-week-preview/contact-sheet.png`.
- Visual QA checked sheets 1, 5, 6, 7, 8, 9, and 10 after regeneration.
- Verification passed: `node --check scripts/generate_grade1_last_week_test_packet.mjs`, `grade1 last-week structure ok: 10 templates 120 boxes`, `pdfinfo` confirmed 10 Letter pages, and `npm run build` passed.

2026-06-18 final sheet 4 revision:

- Sheet 4 subtraction prompts now keep all printed numbers at 20 or below while preserving two-digit answers: `20 - 8`, `19 - 4`, `18 - 1`, `20 - 6`, `17 - 2`, `19 - 2`, `18 - 2`, `20 - 2`.
- Regenerated the Grade 1 last-week packet PDFs, SVGs, manifest, QR images, and layout JSON.
- Rendered sheet 4 for visual QA at `tmp/pdfs/grade1-last-week-preview/page-final-04.png`, then refreshed the full page PNG set and contact sheet.
- Verification passed: `node --check scripts/generate_grade1_last_week_test_packet.mjs`, custom prompt guard confirmed all sheet 4 prompt numbers are <= 20, `grade1 last-week structure ok: 10 templates 120 boxes`, `pdfinfo` confirmed 10 Letter pages, and `npm run build` passed.

2026-06-18 final fact-row bubble spacing revision:

- Sheets 1-5 letter bubbles were moved slightly left by increasing the fact-row bubble gap rule from about 7.4 mm to 10.2 mm from the estimated text start.
- This keeps bubbles visually attached to their question rows while avoiding the crowded look where labels nearly touched the first digit.
- Regenerated the Grade 1 last-week packet PDFs, SVGs, manifest, QR images, and layout JSON.
- Rendered pages 1-5 for visual QA, then refreshed the full page PNG set and contact sheet.
- Verification passed: `node --check scripts/generate_grade1_last_week_test_packet.mjs`, `grade1 last-week structure ok: 10 templates 120 boxes`, `pdfinfo` confirmed 10 Letter pages, and `npm run build` passed.

No OCR, capture, homography, iPad, model, or grading-policy app logic was changed for this packet.

## Public URL and Mission Control Status

On 2026-06-18, SG 3 fixed the public GitHub Pages deployment for:

```text
https://scangradesheets.github.io/draft1/
```

Root cause:

```text
The live GitHub Pages HTML had root-relative asset paths such as /assets and /opencv.js. Under the /draft1/ project path those resolved to the wrong location on phones.
```

Fix:

```text
npm run build:github
git push gh-pages commit 788154e Fix GitHub Pages draft1 asset paths
```

Verification:

```text
curl -sI https://scangradesheets.github.io/draft1/ -> 200
curl -sI https://scangradesheets.github.io/draft1/assets/index-coeKVQVg.js -> 200
curl -sI https://scangradesheets.github.io/draft1/opencv.js -> 200
curl -sI https://scangradesheets.github.io/draft1/layouts/sg-g1-lw-01-add-1digit.json -> 200
curl -sI https://scangradesheets.github.io/draft1/worksheets/grade1-last-week-test-20260617/printables/ScanGrade-Grade1-Last-Week-Test-Packet.pdf -> 200
```

Also on 2026-06-18, Mission Control gained a Calendar / To Do section. It reads from:

```text
mission-control/state/mission-state.json -> launch_plan
```

The tailnet Mission Control URL:

```text
https://hobbes-mac-mini.tail9a3379.ts.net/mission-control/
```

was returning:

```text
HTTP/2 502
```

Local check showed:

```text
curl -sI http://127.0.0.1:8787/mission-control/ -> connection failed
```

Meaning:

```text
Tailscale is reachable, but the local Mission Control Node server is down.
```

The next operational step is to start the local server on the Mac:

```text
node mission-control/server.mjs
```

Codex attempted to start it, but outside-sandbox approval was blocked by the current Codex usage/approval limit. Do not spend time debugging Tailscale before first confirming the local server responds on `127.0.0.1:8787`.

## Active Evidence Set

SG 2 received 10 attachments for the current pass. Use photos 1-9 as the raw worksheet set. `10-Photo-10.jpg` is likely a screenshot/status image, not a raw worksheet input.

Attachment folder:

```text
/tmp/codex-remote-attachments/019e760b-4e8f-7751-be8b-40baddcb8e58/E4CF30F4-4214-45A4-92BD-D4189D971397/
```

Durable local private copy, ignored by git:

```text
private-evidence/sg3-9-photo-confidence-20260606/
```

Files:

```text
1-Photo-1.jpg
2-Photo-2.jpg
3-Photo-3.jpg
4-Photo-4.jpg
5-Photo-5.jpg
6-Photo-6.jpg
7-Photo-7.jpg
8-Photo-8.jpg
9-Photo-9.jpg
10-Photo-10.jpg
```

Earlier iPhone low-confidence debug evidence lives at:

```text
/Users/openclaw/Desktop/3/
```

Relevant files there include:

```text
scangrade-live-ocr-debug-1780662390000.json
scangrade-live-ocr-debug-1780662411267.json
scangrade-live-ocr-debug-1780662450525.json
scangrade-live-ocr-debug-1780662470827.json
scangrade-crops-1780662387762.png
scangrade-crops-1780662409459.png
scangrade-crops-1780662449022.png
scangrade-crops-1780662469187.png
```

Latest iPhone live debug evidence from Tony's 2026-06-07 iPhone tests lives at:

```text
/Users/openclaw/Desktop/4/
```

Tracked handwritten-truth labels for that batch:

```text
docs/SG3_IPHONE_LIVE_OCR_SCORECARD.json
```

Private replay artifacts:

```text
private-evidence/sg3-iphone-live-20260607/
```

Newest live iPhone burst-capture evidence from Tony's 2026-06-07 tests lives at:

```text
/Users/openclaw/Desktop/5/
```

This batch was captured on public build `2026.06.07-1354-EDT-sg3-burst-capture`. It contains 10 debug JSONs, 10 crop previews, and 11 screenshots. One screenshot (`IMG_8803.PNG`, 3:11 PM) appears to have no matching debug JSON. Tony manually corrected some cells in one debug file; those predictions preserved `originalDigit`, so the batch is still useful for capture-quality analysis.

## Latest Known Code State

Current branch: `autobuild/safe-20260223`

Latest pushed rollback point before the burst-capture pass:

```text
7fe8a46 Improve SG3 live OCR confidence safety
```

That commit established the current safety baseline:

```text
Build label: 2026.06.07-0959-EDT-sg3-live-ocr-safety
Clean 9-photo replay: 89/90 confident, 89/89 confident accuracy, 0 confident wrong, 90/90 OCR truth.
Live iPhone still replay: 72/90 OCR truth, 53/90 confident, 53/53 confident accuracy, 0 confident wrong.
```

Current burst-capture candidate for this pass:

```text
Build label: 2026.06.07-1354-EDT-sg3-burst-capture
Change: Student Mode auto-capture now samples a 5-frame burst after the gate fires, scores frame focus/contrast/marker sanity, and sends the best frame to OCR. The pre-capture focus gate was eased from 340 to 300, but the final chosen frame still has to pass the existing 340 focus threshold.
```

Current sharp auto-capture candidate for this pass:

```text
Build label: 2026.06.07-1525-EDT-sg3-sharp-auto-capture
Change: Student Mode auto-capture still uses the eased pre-capture focus gate of 300, but now samples an 8-frame burst over a longer autofocus window and requires the selected auto frame to reach a final focus score of 650 before OCR. Manual capture keeps the older 340 final focus threshold.
```

Current old-iPad engine fallback candidate for this pass:

```text
Build label: 2026.06.07-1745-EDT-sg3-old-ipad-engine-fallback
Change: Student Mode warms the digit model when the scan view opens, shares one in-flight ONNX model initialization promise, and treats auxiliary right-slot model load/run failure as a fallback-to-primary condition instead of failing the whole scan.
```

Current old-iPad review-save candidate for this pass:

```text
Build label: 2026.06.07-1841-EDT-sg3-old-ipad-review-save
Change: If the primary digit engine cannot initialize or run after a good capture, the app now keeps the scan, marks every answer slot for teacher review, suppresses any fake score, and saves the result instead of showing the fatal "grading engine did not finish loading" retry state.
```

## Current Repo Notes

The worktree is expected to be dirty. Known dirty areas at SG 3 startup included:

```text
create-mnist-model.py
layouts/registry.json
mission-control/public/app.js
mission-control/public/index.html
mission-control/public/styles.css
mission-control/state/decisions.json
many untracked OCR/model/benchmark artifacts
```

`private-evidence/` is ignored by git and may contain local copies of private worksheet photos or screenshots. Do not remove it during cleanup, and do not force-add files from it.

Do not clean, revert, or delete unrelated files. Treat them as Tony/project work unless proven otherwise.

Mission Control note:
Mission Control is useful project memory, but its state file was stale after SG 2. It still referenced older "awaiting samples" and 5/10 or 18/30 baselines even though the project had moved on to the 9-photo confidence pass. SG 3 should update Mission Control only with narrow status facts, not product vision changes.

## Guardrails

- Do not change OCR, capture, homography, iPad logic, or model behavior without a reproducible test.
- Do not make app UI/style/layout changes unless Tony asks or a serious app-breaking bug requires it.
- Do not commit private student photos or crop exports.
- Do not optimize to the answer key when the student may have written a wrong answer.
- Do not claim classroom-ready two-digit OCR from this evidence.
- Prefer review flags over confident wrong reads.
- Every production OCR change needs before/after numbers and a rollback point.

## Next Action

The active 9-photo SG3 confidence target remains met by the current source-aware confidence policy and the new local burst-capture candidate:

- Current best replay: `private-evidence/sg3-9-photo-confidence-20260606/burst-capture-1354/`
- Confident answer coverage: `89/90` (`98.9%`).
- Confident answer accuracy vs handwriting: `89/89` (`100.0%`).
- Confident wrong answers: `0`.
- All-answer OCR accuracy vs handwriting: `90/90` (`100.0%`).
- Target result: pass.

The 2026-06-07 live iPhone batch is safer but still conservative:

```text
Replay: private-evidence/sg3-iphone-live-20260607/burst-capture-1354/
Truth labels: docs/SG3_IPHONE_LIVE_OCR_SCORECARD.json
Answer OCR truth: 72/90
Confident answers: 53/90
Confident answer accuracy: 53/53
Confident wrong answers: 0
Review answers: 37
Digit OCR truth: 159/180
Confident digit wrong: 0
```

This replay is unchanged because the replay starts from already-captured still images; it cannot simulate the new live-camera burst choosing a better frame before OCR. The useful verification fact is no OCR confidence regression on the old stills. The next proof has to come from a live phone scan on build `2026.06.07-1354-EDT-sg3-burst-capture`.

This is still an improvement over the old exported live-build behavior, which scored `68/90` answer OCR truth and made `18` confident wrong answer calls on this same iPhone batch. Do not solve the remaining live-camera under-confidence by broadly loosening confidence gates. The remaining problem is degraded capture/OCR signal quality, not just display policy.

Next useful work:

1. Test build `2026.06.07-1841-EDT-sg3-old-ipad-review-save` on the old iPad using the QR workflow and confirm whether the same worksheet now saves as teacher review instead of showing "Try again."
2. If live scans still over-review after sharp auto-capture, improve preprocessing/model signal using the replay artifacts before relaxing confidence again.
3. Keep scoring OCR against handwritten truth, not answer-key correctness.
4. Treat the clean 9-photo target as achieved, but do not claim classroom-trustworthy generalization from only nine sheets or one rough iPhone batch.
5. Update this file after every meaningful benchmark, patch, commit, push, or blocker.

## Running Log

2026-06-06 / SG 3:
Codex update/resume instability hid SG 2 again. SG 3 was renamed and rehydrated from SG 2 summaries, repo memory, OCR docs, and Mission Control. A durable handoff system was created so future threads can resume without relying on hidden chat history. The 10 SG 2 attachments for the 9-photo confidence pass were copied into ignored local folder `private-evidence/sg3-9-photo-confidence-20260606/`.

2026-06-06 / SG 3:
Draft handwritten-truth labels for the active 9 raw photos were recorded in `docs/SG3_9_PHOTO_OCR_SCORECARD.md` and `docs/SG3_9_PHOTO_OCR_SCORECARD.json`. Ambiguities to verify with crops if they become decisive: Photo 4 Q9 reads as `12`; Photo 8 Q4 reads closer to `38` than `28`; Photo 6 Q9 is overwritten/scribbled and may legitimately need review.

2026-06-06 / SG 3:
Added reusable scorer `scripts/score_sg3_9_photo_ocr.mjs` and npm alias `npm run score:sg3-ocr`. It reads the tracked handwritten-truth scorecard and a replay output directory, then writes private reports `truth-score.json` and `truth-score.md` beside the replay. Baseline replay artifacts live at `private-evidence/sg3-9-photo-confidence-20260606/baseline-588425b/`.

Baseline truth score for current `588425b` replay:

- Confident answer coverage: `49/90` (`54.4%`).
- Confident answer accuracy vs handwriting: `48/49` (`98.0%`).
- Confident wrong answers: `1`.
- All-answer OCR accuracy vs handwriting: `71/90` (`78.9%`).
- Confident digit accuracy vs handwriting: `97/98` (`99.0%`).
- Handwritten answers that differ from answer key: `19`.

Only confident wrong read:

```text
9-Photo-9.jpg Q1 truth=37 predicted=27 key=37 minConf=99.4% minGap=99.2%
```

High-level review pattern:

```text
14 answer reviews include right-slot-expected-edge-default
10 answer reviews include right-slot-preprocess-disagreement
3 answer reviews include box-safe-default
12 answer reviews have no recorded review reason, usually raw low-confidence/low-gap gates
```

Commands run:

```text
node scripts/eval_uploaded_worksheets.mjs --url https://127.0.0.1:5176 --out private-evidence/sg3-9-photo-confidence-20260606/baseline-588425b private-evidence/sg3-9-photo-confidence-20260606/[1-9]-Photo-*.jpg
npm run score:sg3-ocr
```

2026-06-06 / SG 3:
Added a narrow OCR/review patch series and replayed each step against the 9-photo handwritten-truth scorecard. Production predictions improved without making any confident OCR errors, but the 95% confident-read target is not met.

Files changed in this patch series:

```text
src/components/CameraCapture.vue
src/ocr-pipeline.js
scripts/replay_live_ocr_captured.mjs
```

Patch summary:

- Added a review gate for a high-risk two-digit left-slot `expected 3 / predicted 2` mismatch. This turns baseline `9-Photo-9.jpg` Q1 from confident wrong into review.
- Added narrow right-slot/left-slot rescue rules when existing preprocessing variants strongly agree on the handwritten digit.
- Kept rescued uncertain cases under review; prediction accuracy improved, but confidence coverage was not artificially raised.

Best replay so far:

```text
private-evidence/sg3-9-photo-confidence-20260606/candidate-wide-raw-gentle-rescues/
```

Best truth score:

- Confident answer coverage: `49/90` (`54.4%`).
- Confident answer accuracy vs handwriting: `49/49` (`100.0%`).
- Confident wrong answers: `0`.
- All-answer OCR accuracy vs handwriting: `79/90` (`87.8%`).
- Digit OCR accuracy vs handwriting: `169/180` (`93.9%`).
- Handwritten answers that differ from answer key: `19`.

Best run commands:

```text
node scripts/eval_uploaded_worksheets.mjs --url https://127.0.0.1:5176 --out private-evidence/sg3-9-photo-confidence-20260606/candidate-wide-raw-gentle-rescues private-evidence/sg3-9-photo-confidence-20260606/1-Photo-1.jpg private-evidence/sg3-9-photo-confidence-20260606/2-Photo-2.jpg private-evidence/sg3-9-photo-confidence-20260606/3-Photo-3.jpg private-evidence/sg3-9-photo-confidence-20260606/4-Photo-4.jpg private-evidence/sg3-9-photo-confidence-20260606/5-Photo-5.jpg private-evidence/sg3-9-photo-confidence-20260606/6-Photo-6.jpg private-evidence/sg3-9-photo-confidence-20260606/7-Photo-7.jpg private-evidence/sg3-9-photo-confidence-20260606/8-Photo-8.jpg private-evidence/sg3-9-photo-confidence-20260606/9-Photo-9.jpg
npm run score:sg3-ocr -- --run private-evidence/sg3-9-photo-confidence-20260606/candidate-wide-raw-gentle-rescues
npm run build
```

Verification:

- `npm run build` passed.
- Latest local replay processed all 9 sheets with no failures.

Important interpretation after Tony clarification:

- Math-wrong but correctly read student answers count as OCR successes.
- They may become confident red Xs if the OCR read is trustworthy.
- Do not treat answer-key mismatch as OCR failure.
- Do not use answer-key matching as a shortcut for OCR truth.

2026-06-07 / SG 3:
Ran a model evidence pass before patching further. A browser tensor replay compared existing bundled model choices against the SG3 handwritten-truth labels. The current script config remained best/tied at `79/90` answer recognition. Two local fine-tune experiments were also trained from `models/worksheet-digit-tony-generalist-aug-strong-20260601.pt` using SG3 truth-labeled tensor variants:

```text
public/models/worksheet-digit-sg3-finetune-local.onnx
public/models/worksheet-digit-sg3-finetune-local-v2.onnx
private-evidence/sg3-9-photo-confidence-20260606/models/
private-evidence/sg3-9-photo-confidence-20260606/sg3-truth-tensor-dataset-all/
```

Neither model should be adopted. The first replayed worse than current (`77/90` as primary, `78/90` as right-slot). The more aggressive overfit model reached `100%` on the SG3 training variants but dropped strict holdout to `48/50` and replayed worse (`77/90` as primary, `72/90` as right-slot, `70/90` as both). Conclusion: model replacement is not the next safe path from the current evidence.

2026-06-07 / SG 3:
Added cautious tensor-shape rescues in `src/ocr-pipeline.js`. These look at the strict 28x28 tensor shape after model selection and rescue common visually-obvious ScanGrade confusions (`open 3 read as 2`, some right-slot `2` read as `9/7/1`, `9` read as `4`, `5` read as `3`, and `8` read as `7`). The rescues use the existing `digitResultFromVotedDigit` path with the original probabilities, so rescued digits stay low-confidence and review-bound rather than becoming automatic confident grades.

Best replay is now:

```text
private-evidence/sg3-9-photo-confidence-20260606/candidate-shape-rescues/
```

Best truth score:

- Confident answer coverage: `49/90` (`54.4%`).
- Confident answer accuracy vs handwriting: `49/49` (`100.0%`).
- Confident wrong answers: `0`.
- All-answer OCR accuracy vs handwriting: `88/90` (`97.8%`).
- Digit OCR accuracy vs handwriting: `178/180` (`98.9%`).
- Handwritten answers that differ from answer key: `19`.

Remaining OCR-wrong answers:

```text
2-Photo-2.jpg Q5 truth=44 predicted=14 key=42 review=true
3-Photo-3.jpg Q9 truth=14 predicted=11 key=14 review=true
```

Commands run:

```text
node scripts/eval_uploaded_worksheets.mjs --url https://127.0.0.1:5177 --out private-evidence/sg3-9-photo-confidence-20260606/candidate-shape-rescues private-evidence/sg3-9-photo-confidence-20260606/1-Photo-1.jpg private-evidence/sg3-9-photo-confidence-20260606/2-Photo-2.jpg private-evidence/sg3-9-photo-confidence-20260606/3-Photo-3.jpg private-evidence/sg3-9-photo-confidence-20260606/4-Photo-4.jpg private-evidence/sg3-9-photo-confidence-20260606/5-Photo-5.jpg private-evidence/sg3-9-photo-confidence-20260606/6-Photo-6.jpg private-evidence/sg3-9-photo-confidence-20260606/7-Photo-7.jpg private-evidence/sg3-9-photo-confidence-20260606/8-Photo-8.jpg private-evidence/sg3-9-photo-confidence-20260606/9-Photo-9.jpg
npm run score:sg3-ocr -- --run private-evidence/sg3-9-photo-confidence-20260606/candidate-shape-rescues
npm run build
```

Verification:

- Full 9-photo upload replay processed all sheets with no failures.
- `npm run score:sg3-ocr -- --run private-evidence/sg3-9-photo-confidence-20260606/candidate-shape-rescues` passed the scorer and wrote `truth-score.json` / `truth-score.md`.
- `npm run build` passed.

2026-06-07 / SG 3:
Added repeatable confidence calibration analysis tooling:

```text
scripts/analyze_sg3_confidence_calibration.mjs
npm run analyze:sg3-confidence
```

The analyzer reads a replay's `truth-score.json`, `rows.json`, and per-sheet `ocr-debug.json`, then writes private reports:

```text
private-evidence/sg3-9-photo-confidence-20260606/candidate-shape-rescues/confidence-calibration.json
private-evidence/sg3-9-photo-confidence-20260606/candidate-shape-rescues/confidence-calibration.md
```

Calibration result:

- Current confident coverage remains `49/90` with `0` confident wrongs.
- Reviewed answers are `41/90`; `39` of those are actually OCR-correct and `2` are OCR-wrong.
- The target needs `86/90` confident answers, so ScanGrade must promote `37` of the current `41` reviewed answers while leaving the `2` OCR-wrong reviewed answers under review.
- Cleanest confidence-only policy tested (`high-signal no-reason reviews`) promotes only `4` answers, reaching `53/90`, `0` confident wrongs.
- Slightly looser no-reason mismatch policy promotes `5` answers, reaching `54/90`, `0` confident wrongs.
- Evidence-only exact-reason whitelist promotes `31` answers, reaching `80/90`, `0` confident wrongs, but it trusts many low-probability rescues and is not safe as production policy by itself.
- Aggressive evidence-only whitelist plus moderate no-reason mismatches reaches `85/90`, `0` confident wrongs, still one short of the `95%` target.
- Oracle upper bound, using handwritten truth labels unavailable in production, is `88/90` confident with `0` confident wrongs.

Interpretation:

- The app is under-confident relative to current recognition accuracy, but threshold loosening alone is not enough.
- OCR confidence and grading confidence are currently mixed for student answers that differ from the answer key. Some correct OCR reads become review because the app is cautious about auto-Xing wrong student answers.
- The two remaining OCR-wrong reviewed cases both involve `4 -> 1`.
- Visual crop check:
  - `2-Photo-2.jpg` Q5 left slot (`44 -> 14`) is mostly a slot-split/crop problem; the left crop contains mostly a vertical stroke and the paired right crop carries the other `4`.
  - `3-Photo-3.jpg` Q9 right slot (`14 -> 11`) has a raw crop that visibly looks like `4`, but model/preprocessing makes `1` dominant with `4` as runner-up.
- A quick model-input feature comparison did not justify a broad `1 -> 4` rescue because the bad `4` overlaps some real `1` shapes.

Commands run:

```text
npm run score:sg3-ocr -- --run private-evidence/sg3-9-photo-confidence-20260606/candidate-shape-rescues
npm run analyze:sg3-confidence -- --run private-evidence/sg3-9-photo-confidence-20260606/candidate-shape-rescues
node --check scripts/analyze_sg3_confidence_calibration.mjs
```

Files changed in this pass:

```text
scripts/analyze_sg3_confidence_calibration.mjs
package.json
SCANGRADE_ACTIVE_HANDOFF.md
mission-control/state/mission-state.json
```

Production OCR behavior was not changed in this calibration pass.

2026-06-07 / SG 3:
Used the older labeled worksheet evidence as a guardrail for the remaining `4 -> 1` problems. Added focused analysis tooling:

```text
scripts/analyze_four_vs_one_crops.mjs
npm run analyze:four-vs-one
scripts/analyze_review_reason_holdout.mjs
npm run analyze:review-reasons
```

The four-vs-one analyzer loads the active SG3 replay plus older labeled worksheet crops under `benchmarks/uploaded_student_samples/results-20260601-new3-handwriting-labels/`. It showed that a broad left-slot `1 -> 4` rescue would hit many true `1`s, but two narrow review-bound candidates caught the two SG3 misses without false positives in the combined check. Production OCR patch added only those narrow shape rescues in `src/ocr-pipeline.js`:

- right-slot `1 -> 4` when `4` is a meaningful runner-up and the strict tensor has heavy `4`-like ink.
- left-slot sparse/right-shifted `1 -> 4` for the split-crop `44 -> 14` failure.

Best replay is now:

```text
private-evidence/sg3-9-photo-confidence-20260606/candidate-four-from-one-rescues/
```

Best truth score:

- Confident answer coverage: `49/90` (`54.4%`).
- Confident answer accuracy vs handwriting: `49/49` (`100.0%`).
- Confident wrong answers: `0`.
- All-answer OCR accuracy vs handwriting: `90/90` (`100.0%`).
- Digit OCR accuracy vs handwriting: `180/180` (`100.0%`).
- Handwritten answers that differ from answer key: `19`.

The two previous OCR-wrong answers are now read correctly:

```text
2-Photo-2.jpg Q5 truth=44 predicted=44 key=42 review=true
3-Photo-3.jpg Q9 truth=14 predicted=14 key=14 review=true
```

Commands run:

```text
node scripts/eval_uploaded_worksheets.mjs --url https://127.0.0.1:5176 --out private-evidence/sg3-9-photo-confidence-20260606/candidate-four-from-one-rescues private-evidence/sg3-9-photo-confidence-20260606/1-Photo-1.jpg private-evidence/sg3-9-photo-confidence-20260606/2-Photo-2.jpg private-evidence/sg3-9-photo-confidence-20260606/3-Photo-3.jpg private-evidence/sg3-9-photo-confidence-20260606/4-Photo-4.jpg private-evidence/sg3-9-photo-confidence-20260606/5-Photo-5.jpg private-evidence/sg3-9-photo-confidence-20260606/6-Photo-6.jpg private-evidence/sg3-9-photo-confidence-20260606/7-Photo-7.jpg private-evidence/sg3-9-photo-confidence-20260606/8-Photo-8.jpg private-evidence/sg3-9-photo-confidence-20260606/9-Photo-9.jpg
npm run score:sg3-ocr -- --run private-evidence/sg3-9-photo-confidence-20260606/candidate-four-from-one-rescues
npm run analyze:sg3-confidence -- --run private-evidence/sg3-9-photo-confidence-20260606/candidate-four-from-one-rescues
npm run analyze:four-vs-one -- --sg3-run private-evidence/sg3-9-photo-confidence-20260606/candidate-four-from-one-rescues --out private-evidence/sg3-9-photo-confidence-20260606/four-vs-one-analysis-four-rescues
npm run analyze:review-reasons
npm run build
```

Verification:

- Full 9-photo upload replay processed all sheets with no failures.
- `npm run score:sg3-ocr -- --run private-evidence/sg3-9-photo-confidence-20260606/candidate-four-from-one-rescues` passed and wrote `truth-score.json` / `truth-score.md`.
- `npm run analyze:sg3-confidence -- --run private-evidence/sg3-9-photo-confidence-20260606/candidate-four-from-one-rescues` passed and wrote updated confidence reports.
- `npm run analyze:four-vs-one -- --sg3-run ...candidate-four-from-one-rescues` passed and shows `0` active SG3 `4 -> 1` cases. Older mixed evidence still contains two older-model/config `4 -> 1` cases, so treat older evidence as a cautionary guardrail rather than current-app failure.
- `npm run analyze:review-reasons` passed. It found no older wrong answers under the exact SG3 safe reason keys, but older runs used a different model/config and mostly different reason names.
- `npm run build` passed.

Confidence status after perfect OCR:

- Reviewed answers are now `41/90`; all `41` are OCR-correct on this run.
- The target still needs `86/90` confident answers, so ScanGrade must promote `37` of those `41` reviewed answers to hit `95%`.
- High-signal no-reason promotion reaches only `53/90`.
- Moderate no-reason mismatch promotion reaches only `54/90`.
- Evidence-only exact reason promotion reaches `83/90`.
- Evidence-only reasons plus moderate no-reason mismatch promotion reaches `88/90`, but this is not production-safe by itself because some low-probability rescues would become confident.
- Original chosen-digit probability analysis suggests a safer confidence policy can promote roughly `20` reviewed answers (`69/90` total confident) without trusting fragile rescues, but that is still below target.

Next technical move:

- Build a confidence policy around original chosen-digit probabilities, strong variant agreement, and review reason families, while keeping low-probability shape/split rescues yellow.
- If target `86/90` cannot be reached without trusting fragile rescues, gather more real completed worksheets or improve preprocessing/model confidence rather than broadening review clearance.

2026-06-07 / SG 3:
Built and verified the tightened production confidence policy. The policy separates actual review reasons from rescue overrides, allowlists only validated reason families, and adds a calibrated two-digit auto-X clearance only when the chosen digit probability and margin are both strong. A first broad candidate that used `robustOverride` as a clearance reason over-cleared to `90/90` confident answers and was rejected.

Best replay is now:

```text
private-evidence/sg3-9-photo-confidence-20260606/candidate-confidence-policy-tight-final-9/
```

Final truth score:

- Confident answer coverage: `88/90` (`97.8%`).
- Confident answer accuracy vs handwriting: `88/88` (`100.0%`).
- Confident wrong answers: `0`.
- All-answer OCR accuracy vs handwriting: `90/90` (`100.0%`).
- Digit OCR accuracy vs handwriting: `180/180` (`100.0%`).
- Target result: pass.

Remaining review/yellow answers:

```text
9-Photo-9.jpg Q2 truth=29 predicted=29 key=29 minConf=40.3% minGap=10.6% reasons=-
9-Photo-9.jpg Q6 truth=24 predicted=24 key=25 minConf=39.0% minGap=4.9% reasons=-
```

Commands run:

```text
npm run build
node scripts/eval_uploaded_worksheets.mjs --url https://127.0.0.1:5174 --out private-evidence/sg3-9-photo-confidence-20260606/candidate-confidence-policy-tight-final-9 private-evidence/sg3-9-photo-confidence-20260606/1-Photo-1.jpg private-evidence/sg3-9-photo-confidence-20260606/2-Photo-2.jpg private-evidence/sg3-9-photo-confidence-20260606/3-Photo-3.jpg private-evidence/sg3-9-photo-confidence-20260606/4-Photo-4.jpg private-evidence/sg3-9-photo-confidence-20260606/5-Photo-5.jpg private-evidence/sg3-9-photo-confidence-20260606/6-Photo-6.jpg private-evidence/sg3-9-photo-confidence-20260606/7-Photo-7.jpg private-evidence/sg3-9-photo-confidence-20260606/8-Photo-8.jpg private-evidence/sg3-9-photo-confidence-20260606/9-Photo-9.jpg
npm run score:sg3-ocr -- --run private-evidence/sg3-9-photo-confidence-20260606/candidate-confidence-policy-tight-final-9
npm run analyze:sg3-confidence -- --run private-evidence/sg3-9-photo-confidence-20260606/candidate-confidence-policy-tight-final-9
npm run analyze:four-vs-one -- --sg3-run private-evidence/sg3-9-photo-confidence-20260606/candidate-confidence-policy-tight-final-9 --out private-evidence/sg3-9-photo-confidence-20260606/four-vs-one-analysis-confidence-policy-tight-final-9
npm run analyze:review-reasons -- --sg3-run private-evidence/sg3-9-photo-confidence-20260606/candidate-confidence-policy-tight-final-9 --out private-evidence/sg3-9-photo-confidence-20260606/review-reason-holdout-confidence-policy-tight-final-9
npx playwright test test-app.spec.js test-upload.spec.js test-ocr.spec.js verify-single-pipeline.spec.js test-upload-real.spec.js export-crops-debug.spec.js --config=playwright.config.js
npm run build
```

Verification:

- Exact 9-photo replay processed all sheets with no failures.
- `npm run score:sg3-ocr -- --run ...candidate-confidence-policy-tight-final-9` passed and wrote `truth-score.json` / `truth-score.md`.
- Confidence analysis reports `88/90` current confident answers, `2/2` reviewed answers OCR-correct, and target `86/90`.
- Four-vs-one analysis shows `0` active SG3 `4 -> 1` cases; older mixed evidence still has two older-model/config guardrail cases.
- Review-reason holdout shows SG3 current: `90 total`, `90 correct`, `88 confident`, `2 reviewed`; older worksheet buckets remain reviewed rather than being newly promoted.
- Full Playwright suite passed: `11 passed`.
- Final `npm run build` passed with only the existing chunk-size warning.

Files changed in this pass:

```text
src/components/CameraCapture.vue
src/ocr-pipeline.js
vite.config.js
playwright.config.js
playwright.config.ts
test-upload-real.spec.js
scripts/score_sg3_9_photo_ocr.mjs
scripts/analyze_sg3_confidence_calibration.mjs
scripts/analyze_four_vs_one_crops.mjs
scripts/analyze_review_reason_holdout.mjs
package.json
docs/SG3_9_PHOTO_OCR_SCORECARD.json
docs/SG3_9_PHOTO_OCR_SCORECARD.md
docs/SG_THREAD_HANDOFF_PROTOCOL.md
SCANGRADE_ACTIVE_HANDOFF.md
mission-control/state/mission-state.json
```

2026-06-07 / SG 3:
Analyzed Tony's `/Users/openclaw/Desktop/4` live iPhone test batch and added a tracked handwritten-truth scorecard for it. The old exported public build was far too trusting on these rough captures:

- Answer OCR truth: `68/90`.
- Confident answers: `84/90`.
- Confident answer accuracy: `66/84`.
- Confident wrong answers: `18`.
- Review answers: `6`.
- Digit OCR truth: `155/180`.
- Confident digit wrong: `21`.

Added:

```text
docs/SG3_IPHONE_LIVE_OCR_SCORECARD.json
scripts/score_live_ocr_debug_truth.mjs
npm run score:live-ocr-truth
```

Important interpretation: these live truth labels score what the student wrote, not whether the student answer was mathematically correct.

2026-06-07 / SG 3:
Patched the app for live-camera safety and a slightly easier capture gate.

Production changes:

- Confidence policy is now source-aware: clean/non-camera upload evidence can clear validated review reasons, while camera captures stay stricter.
- Tightened two-digit auto-X calibration to `confidence >= 0.92` and `margin >= 0.50`.
- Review-bound OCR rescues and right-slot expected-edge conflicts cannot become automatic confident Xs.
- Added narrow right-slot `7` rescue paths and tightened two older left-slot rescue shapes.
- Eased auto-capture slightly for wrinkled live sheets: portrait hold `450ms -> 375ms`, centered tolerance `0.28 -> 0.30`, span threshold `0.34/0.42 -> 0.32/0.40`, soft perspective width/height `0.66/0.70 -> 0.63/0.67`, and tilt/lean `0.195 -> 0.22`. Focus/marker/page appearance gates were not loosened.
- Updated visible build label to `2026.06.07-0959-EDT-sg3-live-ocr-safety`.

Current clean 9-photo replay:

```text
private-evidence/sg3-9-photo-confidence-20260606/candidate-source-aware-confidence-2-20260607/
```

Score:

- Confident answer coverage: `89/90` (`98.9%`).
- Confident answer accuracy vs handwriting: `89/89` (`100.0%`).
- Confident wrong answers: `0`.
- All-answer OCR accuracy vs handwriting: `90/90` (`100.0%`).
- Target result: pass.

Current live iPhone replay:

```text
private-evidence/sg3-iphone-live-20260607/current-build-0959/
```

Score:

- Answer OCR truth: `72/90`.
- Confident answers: `53/90`.
- Confident answer accuracy: `53/53`.
- Confident wrong answers: `0`.
- Review answers: `37`.
- Digit OCR truth: `159/180`.
- Confident digit wrong: `0`.
- Guard rejected two unusable captures into all-review rather than trusting them: `1780835794316` and `1780836093776`.

Verification commands run:

```text
npm run score:sg3-ocr -- --run private-evidence/sg3-9-photo-confidence-20260606/candidate-source-aware-confidence-2-20260607
SG_REPLAY_URL=https://127.0.0.1:5174 npm run eval:live-ocr-captured -- --out-dir private-evidence/sg3-iphone-live-20260607/current-build-0959 /Users/openclaw/Desktop/4/scangrade-live-ocr-debug-*.json
npm run score:live-ocr-truth -- private-evidence/sg3-iphone-live-20260607/current-build-0959/*-replay-result.json
npm run build
npx playwright test test-app.spec.js test-upload.spec.js test-ocr.spec.js verify-single-pipeline.spec.js test-upload-real.spec.js export-crops-debug.spec.js --config=playwright.config.js
```

Verification results:

- `npm run build` passed with only the existing chunk-size warning.
- Focused Playwright suite passed: `11 passed`.
- Live replay still reports only `72/90` OCR truth, so future live work should focus on crop quality, preprocessing, and model signal before any broader confidence promotion.

2026-06-07 / SG 3:
Added Student Mode auto-capture burst selection for local candidate build `2026.06.07-1354-EDT-sg3-burst-capture`.

Production changes:

- Auto-capture now samples `5` frames after the stability gate fires, scores focus/contrast/marker sanity, and sends the best frame to OCR.
- The pre-capture focus gate was eased from `340` to `300` so a wrinkled but usable sheet can trigger the burst sooner.
- The final selected frame still has to pass the existing `340` focus threshold plus full sheet marker/page checks.
- Live debug `captureQuality` now records burst frame scores, selected index, best score, sheet status, and both focus thresholds.
- Manual Student Mode capture still captures a single frame.
- Updated visible build label to `2026.06.07-1354-EDT-sg3-burst-capture`.

Verification commands run:

```text
npm run build
node scripts/replay_live_ocr_captured.mjs --url https://127.0.0.1:5174 --out-dir private-evidence/sg3-iphone-live-20260607/burst-capture-1354 /Users/openclaw/Desktop/4/scangrade-live-ocr-debug-1780835744659.json /Users/openclaw/Desktop/4/scangrade-live-ocr-debug-1780835794316.json /Users/openclaw/Desktop/4/scangrade-live-ocr-debug-1780835835982.json /Users/openclaw/Desktop/4/scangrade-live-ocr-debug-1780835883256.json /Users/openclaw/Desktop/4/scangrade-live-ocr-debug-1780835922655.json /Users/openclaw/Desktop/4/scangrade-live-ocr-debug-1780835950761.json /Users/openclaw/Desktop/4/scangrade-live-ocr-debug-1780836030293.json /Users/openclaw/Desktop/4/scangrade-live-ocr-debug-1780836093776.json /Users/openclaw/Desktop/4/scangrade-live-ocr-debug-1780836133924.json
node scripts/score_live_ocr_debug_truth.mjs private-evidence/sg3-iphone-live-20260607/burst-capture-1354/*-replay-result.json
node scripts/eval_uploaded_worksheets.mjs --url https://127.0.0.1:5174 --out private-evidence/sg3-9-photo-confidence-20260606/burst-capture-1354 private-evidence/sg3-9-photo-confidence-20260606/1-Photo-1.jpg private-evidence/sg3-9-photo-confidence-20260606/2-Photo-2.jpg private-evidence/sg3-9-photo-confidence-20260606/3-Photo-3.jpg private-evidence/sg3-9-photo-confidence-20260606/4-Photo-4.jpg private-evidence/sg3-9-photo-confidence-20260606/5-Photo-5.jpg private-evidence/sg3-9-photo-confidence-20260606/6-Photo-6.jpg private-evidence/sg3-9-photo-confidence-20260606/7-Photo-7.jpg private-evidence/sg3-9-photo-confidence-20260606/8-Photo-8.jpg private-evidence/sg3-9-photo-confidence-20260606/9-Photo-9.jpg
npm run score:sg3-ocr -- --run private-evidence/sg3-9-photo-confidence-20260606/burst-capture-1354
npx playwright test test-app.spec.js test-ocr.spec.js test-upload-real.spec.js
```

Verification results:

- `npm run build` passed.
- Clean 9-photo truth score passed: `89/90` confident, `89/89` confident accuracy, `0` confident wrong, `90/90` all-answer OCR truth.
- Live iPhone still replay remained unchanged as expected: `72/90` answer OCR truth, `53/90` confident, `53/53` confident accuracy, `0` confident wrong.
- Playwright smoke/upload suite passed: `5 passed`.
- Important limitation: still replay cannot prove burst-capture improvement because burst selection happens before the still image exists. The next proof is live testing on Tony's phone.

2026-06-07 / SG 3:
Analyzed Tony's newest live iPhone test batch from `/Users/openclaw/Desktop/5/` against build `2026.06.07-1354-EDT-sg3-burst-capture`.

Evidence:

- 10 debug JSONs, 10 crop previews, and 11 screenshots.
- All debug JSONs confirmed `captureQuality.source = auto`, `burstFrameCount = 5`, and the burst build path.
- One debug JSON (`1780859247795`) was manually corrected after scanning; the touched predictions preserved `originalDigit`, so do not treat its post-correction answer groups as a clean raw-confidence score.

Finding:

- The burst mechanism works, but the app was still accepting selected frames that were too soft for reliable classroom OCR.
- In `/Users/openclaw/Desktop/5`, captures with selected-frame focus below `650` averaged `4.6/10` confident answers and high review counts.
- Captures with selected-frame focus at or above `650` averaged `7.6/10` confident answers.
- Still-visible OCR/model misses remain on sharper scans, especially around thin/right-slot `9`, `2`, and some ambiguous second digits, so this capture patch is not the full 95% confidence solution.

Production changes:

- Added build label `2026.06.07-1525-EDT-sg3-sharp-auto-capture`.
- Kept the eased auto pre-capture focus gate at `300`.
- Added an auto-only final focus threshold of `650` before OCR.
- Extended auto burst capture from `5` frames at `85ms` spacing to `8` frames at `110ms` spacing so phone autofocus has longer to settle.
- Manual Student Mode capture still uses the older final focus threshold of `340`.
- `captureQuality` now records `manualFocusThreshold` and `autoFinalFocusThreshold`.

Verification commands run:

```text
npm run build
npx playwright test test-app.spec.js test-ocr.spec.js test-upload-real.spec.js --config=playwright.config.js
node scripts/eval_uploaded_worksheets.mjs --url https://127.0.0.1:5174 --out private-evidence/sg3-9-photo-confidence-20260606/sharp-auto-capture-1525 private-evidence/sg3-9-photo-confidence-20260606/1-Photo-1.jpg private-evidence/sg3-9-photo-confidence-20260606/2-Photo-2.jpg private-evidence/sg3-9-photo-confidence-20260606/3-Photo-3.jpg private-evidence/sg3-9-photo-confidence-20260606/4-Photo-4.jpg private-evidence/sg3-9-photo-confidence-20260606/5-Photo-5.jpg private-evidence/sg3-9-photo-confidence-20260606/6-Photo-6.jpg private-evidence/sg3-9-photo-confidence-20260606/7-Photo-7.jpg private-evidence/sg3-9-photo-confidence-20260606/8-Photo-8.jpg private-evidence/sg3-9-photo-confidence-20260606/9-Photo-9.jpg
npm run score:sg3-ocr -- --run private-evidence/sg3-9-photo-confidence-20260606/sharp-auto-capture-1525
node scripts/replay_live_ocr_captured.mjs --url https://127.0.0.1:5174 --out-dir private-evidence/sg3-iphone-live-20260607/sharp-auto-capture-1525 /Users/openclaw/Desktop/4/scangrade-live-ocr-debug-1780835744659.json /Users/openclaw/Desktop/4/scangrade-live-ocr-debug-1780835794316.json /Users/openclaw/Desktop/4/scangrade-live-ocr-debug-1780835835982.json /Users/openclaw/Desktop/4/scangrade-live-ocr-debug-1780835883256.json /Users/openclaw/Desktop/4/scangrade-live-ocr-debug-1780835922655.json /Users/openclaw/Desktop/4/scangrade-live-ocr-debug-1780835950761.json /Users/openclaw/Desktop/4/scangrade-live-ocr-debug-1780836030293.json /Users/openclaw/Desktop/4/scangrade-live-ocr-debug-1780836093776.json /Users/openclaw/Desktop/4/scangrade-live-ocr-debug-1780836133924.json
npm run score:live-ocr-truth -- private-evidence/sg3-iphone-live-20260607/sharp-auto-capture-1525/*-replay-result.json
```

Verification results:

- `npm run build` passed.
- Focused Playwright suite passed: `5 passed`.
- Clean 9-photo truth score still passed: `89/90` confident, `89/89` confident accuracy, `0` confident wrong, `90/90` all-answer OCR truth.
- Older live iPhone still replay stayed safe: `72/90` answer OCR truth, `53/90` confident, `53/53` confident accuracy, `0` confident wrong, `159/180` digit OCR truth.
- The live replay command exited nonzero because two old still captures were intentionally guarded as unusable/all-review; the truth scorer confirms no confident-wrong regression.
- Next proof must be a new live phone scan on `2026.06.07-1525-EDT-sg3-sharp-auto-capture`.

2026-06-07 / SG 3:
Tony tested on an old iPad and reported that capture looked much better, but the result panel showed: "Try again. The grading engine did not finish loading. Scan saved for teacher review." The screenshot showed a clean, full-page worksheet image, so this was not primarily a capture/homography failure. It indicated old-iPad OCR runtime/model initialization fragility after successful capture.

Production changes for build `2026.06.07-1745-EDT-sg3-old-ipad-engine-fallback`:

- Student Mode now starts warming `initDigitModel()` as soon as the scan view opens, giving older Safari/iPad hardware a head start before OCR begins.
- `initDigitModel()` now shares one in-flight model initialization promise, avoiding duplicate ONNX/WASM/model loads when warmup and grading overlap.
- Auxiliary right-slot model load/run failure now disables that optional model for the current path and falls back to the primary digit model rather than failing the entire scan.
- Debug model info records `rightSlot.unavailable`, `rightSlot.unavailableReason`, and `rightSlot.fallback = "primary digit model"` when that fallback is used.
- No capture thresholds, homography behavior, or confidence policy gates were loosened.

Verification commands run:

```text
node scripts/eval_uploaded_worksheets.mjs --url https://127.0.0.1:5174 --model /models/worksheet-digit-tony-generalist-noaug-20260601.onnx --right-slot-model /models/missing-right-slot-old-ipad-test.onnx --out private-evidence/sg3-old-ipad-engine-fallback-20260607/missing-right-slot /tmp/codex-remote-attachments/019e9a57-ed9d-78a0-b620-e58b9ee66c3c/8F0CA1D8-C947-46A6-AAD9-CA51F5F84A9C/1-Photo-1.jpg
node scripts/eval_uploaded_worksheets.mjs --url https://127.0.0.1:5174 --out private-evidence/sg3-9-photo-confidence-20260606/old-ipad-engine-fallback-1745 private-evidence/sg3-9-photo-confidence-20260606/1-Photo-1.jpg private-evidence/sg3-9-photo-confidence-20260606/2-Photo-2.jpg private-evidence/sg3-9-photo-confidence-20260606/3-Photo-3.jpg private-evidence/sg3-9-photo-confidence-20260606/4-Photo-4.jpg private-evidence/sg3-9-photo-confidence-20260606/5-Photo-5.jpg private-evidence/sg3-9-photo-confidence-20260606/6-Photo-6.jpg private-evidence/sg3-9-photo-confidence-20260606/7-Photo-7.jpg private-evidence/sg3-9-photo-confidence-20260606/8-Photo-8.jpg private-evidence/sg3-9-photo-confidence-20260606/9-Photo-9.jpg
npm run score:sg3-ocr -- --run private-evidence/sg3-9-photo-confidence-20260606/old-ipad-engine-fallback-1745
npm run build
npx playwright test test-app.spec.js test-ocr.spec.js test-upload-real.spec.js --config=playwright.config.js
node scripts/replay_live_ocr_captured.mjs --url https://127.0.0.1:5174 --out-dir private-evidence/sg3-iphone-live-20260607/old-ipad-engine-fallback-1745 /Users/openclaw/Desktop/4/scangrade-live-ocr-debug-*.json
npm run score:live-ocr-truth -- private-evidence/sg3-iphone-live-20260607/old-ipad-engine-fallback-1745/*-replay-result.json
```

Verification results:

- Forced missing right-slot model replay produced `20` predictions with no OCR error and debug fallback metadata: `rightSlot.loaded = false`, `rightSlot.unavailable = true`, `rightSlot.fallback = "primary digit model"`.
- `npm run build` passed.
- Focused Playwright suite passed: `5 passed`.
- Clean 9-photo truth score stayed at `89/90` confident, `89/89` confident accuracy, `0` confident wrong, `90/90` all-answer OCR truth.
- Older live iPhone still replay stayed safe: `72/90` answer OCR truth, `53/90` confident, `53/53` confident accuracy, `0` confident wrong, `159/180` digit OCR truth.
- The live replay command exited nonzero because two old still captures were intentionally guarded as unusable/all-review; the truth scorer confirms no confident-wrong regression.
- Next proof must be a live old-iPad retest on `2026.06.07-1745-EDT-sg3-old-ipad-engine-fallback`.

2026-06-07 / SG 3:
Tony retested build `2026.06.07-1745-EDT-sg3-old-ipad-engine-fallback` on the old iPad and saw the same "Try again / The grading engine did not finish loading" message. The screenshot showed the new build label and a clean full-page worksheet capture, proving that deployment, QR routing, capture, and homography were not the cause. The auxiliary right-slot fallback was insufficient; the old iPad is likely failing the primary ONNX/WASM digit engine itself.

Production changes for build `2026.06.07-1841-EDT-sg3-old-ipad-review-save`:

- `CameraCapture.runRealOCR()` no longer initializes the digit engine before homography/crop processing. It preserves the captured worksheet and OCR crop context first.
- If primary digit model initialization or inference fails after a recognized worksheet capture, the app now builds review-only predictions with `digit: null`, `confidence: 0`, `reviewNeeded: true`, and `forcedReviewReason = "digit-engine-unavailable-review"` or `"digit-engine-inference-failed-review"`.
- Review-only engine fallback suppresses `questionCorrect` and `questionScore`, so the teacher queue does not show a fake `0/10` grade.
- The result payload records `digitEngineFallback`, `digitEngineError`, `reviewOnlyFallback`, and `forcedFallbackReviewReason` for future debugging.
- Normal OCR confidence, capture thresholds, homography, and model behavior were not loosened.

Reproducible old-iPad stand-in:

```text
node scripts/eval_uploaded_worksheets.mjs --url https://127.0.0.1:5174 --model /models/missing-primary-old-ipad-test.onnx --out private-evidence/sg3-old-ipad-primary-failure-20260607/before private-evidence/sg3-9-photo-confidence-20260606/1-Photo-1.jpg
node scripts/eval_uploaded_worksheets.mjs --url https://127.0.0.1:5174 --model /models/missing-primary-old-ipad-test.onnx --out private-evidence/sg3-old-ipad-primary-failure-20260607/after private-evidence/sg3-9-photo-confidence-20260606/1-Photo-1.jpg
node scripts/eval_uploaded_worksheets.mjs --url https://127.0.0.1:5174 --out private-evidence/sg3-old-ipad-primary-failure-20260607/normal-9 private-evidence/sg3-9-photo-confidence-20260606/1-Photo-1.jpg private-evidence/sg3-9-photo-confidence-20260606/2-Photo-2.jpg private-evidence/sg3-9-photo-confidence-20260606/3-Photo-3.jpg private-evidence/sg3-9-photo-confidence-20260606/4-Photo-4.jpg private-evidence/sg3-9-photo-confidence-20260606/5-Photo-5.jpg private-evidence/sg3-9-photo-confidence-20260606/6-Photo-6.jpg private-evidence/sg3-9-photo-confidence-20260606/7-Photo-7.jpg private-evidence/sg3-9-photo-confidence-20260606/8-Photo-8.jpg private-evidence/sg3-9-photo-confidence-20260606/9-Photo-9.jpg
node scripts/score_sg3_9_photo_ocr.mjs --run private-evidence/sg3-old-ipad-primary-failure-20260607/normal-9 --out private-evidence/sg3-old-ipad-primary-failure-20260607/normal-9-score
npm run build
npx playwright test test-app.spec.js test-ocr.spec.js test-upload-real.spec.js --config=playwright.config.js
```

Verification results:

- Before patch, forced missing primary model failed the sheet with `ONNX model not found at /models/missing-primary-old-ipad-test.onnx`.
- After patch, the same forced missing primary model produced no fatal OCR error, `questionCorrect = null`, `questionReviewCount = 10`, `20/20` review-needed predictions, `digitEngineFallback = true`, and `forcedFallbackReviewReason = "digit-engine-unavailable-review"`.
- Student Mode forced-primary failure saved a local teacher-review record with `status = "review"`, `needsReview = true`, twenty `null` digit slots, `questionCorrect = null`, and `questionScore = null`.
- Clean 9-photo truth score stayed at `89/90` confident, `89/89` confident accuracy, `0` confident wrong, `90/90` all-answer OCR truth.
- `npm run build` passed.
- Focused Playwright suite passed: `5 passed`.
- Next proof must be a live old-iPad retest on `2026.06.07-1841-EDT-sg3-old-ipad-review-save`. Expected old-iPad behavior if ONNX still cannot run: no score, no green/red grading, but a real saved scan with yellow teacher-review regions instead of "Try again."

2026-06-10 / SG 3:
Tony asked whether the current worksheet format is versatile enough for hundreds of Grade 1-3 classroom worksheet variations before locking in worksheet design. Codex researched the Ontario Grade 1-3 math curriculum and common printable worksheet categories, then created a controlled 10-sheet Grade 1-3 curriculum probe packet.

What changed:

- Added `docs/CURRICULUM_PROBE_G1_G3_MATRIX.md`.
- Added `scripts/generate_curriculum_probe_worksheets.mjs`.
- Generated a separate probe packet under `public/worksheets/curriculum-probe-g1-g3/`.
- Generated scan-loadable layouts under both `public/layouts/sg-probe-*.json` and `layouts/sg-probe-*.json`.
- Generated packet files:
  - `public/worksheets/curriculum-probe-g1-g3/index.html`
  - `public/worksheets/curriculum-probe-g1-g3/manifest.json`
  - `public/worksheets/curriculum-probe-g1-g3/teacher-answer-key.html`
  - `public/worksheets/curriculum-probe-g1-g3/printables/ScanGrade-Grade1-3-Curriculum-Probe-Packet.pdf`
  - `public/worksheets/curriculum-probe-g1-g3/printables/ScanGrade-Grade1-3-Curriculum-Probe-Answer-Key.pdf`

Probe contents:

- CP01 Grade 1 Addition and Subtraction Within 20, two slots, supported.
- CP02 Grade 1 Numbers and Place Value to 50, two slots, supported.
- CP03 Grade 1 Patterns and Missing Numbers, two slots, supported.
- CP04 Grade 2 Addition and Subtraction Within 100, two slots, supported.
- CP05 Grade 2 Place Value to 200, three slots, stress.
- CP06 Grade 2 Equal Groups and Sharing, two slots, supported.
- CP07 Grade 2 Money in Cents, three slots, stress.
- CP08 Grade 3 Addition and Subtraction to 1000, three slots, stress.
- CP09 Grade 3 Multiplication and Division Facts, three slots, stress.
- CP10 Grade 3 Measurement, Data, and Time Numbers, three slots, future/stress.

Important product interpretation:

- Grade 1-3 Ontario whole-number expectations top out at 50, 200, and 1000 respectively.
- Four- and five-digit whole-number answers are Grade 4-5 surfaces, not part of the Grade 1-3 readiness claim.
- This packet intentionally keeps answers numeric-only. Fractions, inequality symbols, dollar decimals, time notation, units in answer boxes, student-drawn graphs/shapes/clocks, and process grading remain separate future parser/review surfaces.

Commands run:

```text
node scripts/generate_curriculum_probe_worksheets.mjs
qlmanage -t -s 1600 -o /tmp/sg-probe-ql2 public/worksheets/curriculum-probe-g1-g3/cp05-grade2-place-value-to-200.svg
qlmanage -t -s 1600 -o /tmp/sg-probe-ql4 public/worksheets/curriculum-probe-g1-g3/cp08-grade3-add-sub-to-1000.svg
qlmanage -t -s 1600 -o /tmp/sg-probe-ql4 public/worksheets/curriculum-probe-g1-g3/cp10-grade3-measurement-data-time.svg
node -e "const fs=require('fs'); const manifest=JSON.parse(fs.readFileSync('public/worksheets/curriculum-probe-g1-g3/manifest.json','utf8')); for (const t of manifest.templates){ const layout=JSON.parse(fs.readFileSync('public/layouts/'+t.layout_id+'.json','utf8')); if(layout.question_groups.length!==10) throw new Error(t.layout_id+' groups'); if(layout.boxes.length!==t.answer_box_count) throw new Error(t.layout_id+' boxes'); if(layout.boxes.length!==10*t.answer_slots_per_question) throw new Error(t.layout_id+' slot count'); if(!t.qr_payload_url.includes('SG1%3A'+t.layout_id+'%3A')) throw new Error(t.layout_id+' qr'); } console.log('curriculum probe manifest/layout structure ok:', manifest.templates.length, 'templates')"
npm run build
```

Verification results:

- Generator completed and produced 10 SVG worksheets, QR images, layout JSON files, HTML index, answer key, and two PDFs.
- Visual QA caught and fixed three-slot prompt/bubble overlap on CP05/CP08/CP10.
- Final visual QA on CP05, CP08, and CP10 showed clean prompt/bubble separation and usable three-slot answer boxes.
- Structural check passed: `curriculum probe manifest/layout structure ok: 10 templates`.
- `npm run build` passed.
- No OCR, capture, homography, iPad, confidence policy, app UI, or model code was changed for this packet.

Rollback point:

- No commit was created in this turn.
- Remove the new `docs/CURRICULUM_PROBE_G1_G3_MATRIX.md`, `scripts/generate_curriculum_probe_worksheets.mjs`, `public/worksheets/curriculum-probe-g1-g3/`, and `sg-probe-*` layout JSON files to remove the probe packet.

Next action:

- Print or open `public/worksheets/curriculum-probe-g1-g3/printables/ScanGrade-Grade1-3-Curriculum-Probe-Packet.pdf`.
- Classroom-test a small subset first: CP01, CP04, CP05, CP08, and CP10 are the highest-information first pass.
- Score results by handwritten truth, not just answer key, and separate scan success, QR/layout success, OCR truth, confident-read coverage, confident-wrong count, review count, and student-writing behavior.

2026-06-10 / SG 3 worksheet layout correction:
Tony reviewed the generated Grade 1-3 curriculum probe packet and caught several printed-layout problems before classroom use:

- Some word-heavy two-slot sheets had letter bubbles overlapping prompt text.
- CP07-CP10 three-slot right-column bubbles sat too far into the center gutter, visually closer to left-column questions than to their own prompts.
- CP09 was the clearest example of the center-gutter attachment problem.

What changed:

- Updated `scripts/generate_curriculum_probe_worksheets.mjs` only.
- Regenerated all probe SVG, PDF, QR, manifest, answer-key, and layout outputs.
- Three-slot right-column bubbles now sit closer to their own right-column prompts.
- Two-slot right-column labels now leave enough clearance for prompts such as `100 - 47`.
- Compact/blank/sequence prompts now use a wider label lane.
- Existing-equals prompts no longer get an extra trailing equals sign in the rendered SVG.
- Shortened several probe prompts that were too long for the current two-column printed format:
  - CP02 uses shorter place-value prompts such as `30 + 5`, `36 + 3`, and `5,10,15,__`.
  - CP03 uses tighter missing-number notation.
  - CP06 abbreviates group prompts as `grps`.
  - CP10 shortens measurement/data wording such as `perim`, `mode 18,18`, and `half turn deg`.

Verification:

- Visual QA via Quick Look thumbnails checked CP01, CP02, CP03, CP04, CP05, CP06, CP07, CP09, and CP10 after regeneration.
- CP02, CP03, and CP06 no longer have letter bubbles overlapping prompt text.
- CP07, CP09, and CP10 right-column bubbles now read as attached to their own questions instead of the opposite column.
- Structural check passed: `curriculum probe manifest/layout structure ok: 10 templates`.
- `npm run build` passed.
- No OCR, capture, homography, iPad, confidence policy, app UI, or model code changed.

2026-06-12 / SG 3 Grade 1-2 curriculum probe V2:
Tony narrowed the next classroom-test packet to Grade 1 and Grade 2 only, with more realistic student work space and more varied worksheet layouts. The key design decision is that ScanGrade grades only final numeric answer boxes; diagrams and work areas are printed for student thinking and teacher review, not OCR scoring.

New planning doc:

```text
docs/CURRICULUM_PROBE_G1_G2_V2_PLAN.md
```

New generator:

```text
scripts/generate_curriculum_probe_g1_g2_v2_worksheets.mjs
```

Generated packet:

```text
public/worksheets/curriculum-probe-g1-g2-v2/index.html
public/worksheets/curriculum-probe-g1-g2-v2/manifest.json
public/worksheets/curriculum-probe-g1-g2-v2/teacher-answer-key.html
public/worksheets/curriculum-probe-g1-g2-v2/printables/ScanGrade-Grade1-2-Curriculum-Probe-V2-Packet.pdf
public/worksheets/curriculum-probe-g1-g2-v2/printables/ScanGrade-Grade1-2-Curriculum-Probe-V2-Answer-Key.pdf
```

Generated layout JSON was written to all expected places:

```text
public/worksheets/curriculum-probe-g1-g2-v2/layouts/
public/layouts/sg-v2-*.json
layouts/sg-v2-*.json
```

V2 sheet set:

- SG-V2-G1-01 Addition and Subtraction Within 20, 8 questions, fact rows with work line.
- SG-V2-G1-02 Ten Frames to 20, 6 questions, visual count cards.
- SG-V2-G1-03 Dot Collections to 20, 6 questions, visual count cards.
- SG-V2-G1-04 Number Bonds to 20, 6 questions, part-part-whole diagram layout.
- SG-V2-G1-05 Number Patterns and Missing Numbers, 6 questions, answer boxes embedded in sequences.
- SG-V2-G2-06 Two-Digit Addition, Stacked, 6 questions, standard vertical algorithm.
- SG-V2-G2-07 Two-Digit Subtraction, Stacked, 6 questions, standard vertical algorithm.
- SG-V2-G2-08 Place Value to 200, 6 questions, three-slot work cards.
- SG-V2-G2-09 Equal Groups and Sharing, 6 questions, work-card layout.
- SG-V2-G2-10 Money in Cents, 6 questions, three-slot work cards.

Important implementation notes:

- Letter bubbles use fixed column rails and are centered on the full question block, not just the final answer box.
- Six-question layouts intentionally trade question count for student work space.
- Number-bond prompt text was removed after visual QA because it collided with missing-total answer boxes; the diagram now carries the task.
- The packet did not change OCR, capture, homography, iPad fallback, confidence policy, model files, or app UI logic.

Verification:

- Generated all SVG worksheets, QR images, layout JSON files, HTML index, answer key, and PDFs with `node scripts/generate_curriculum_probe_g1_g2_v2_worksheets.mjs`.
- Full-page Playwright visual QA checked SG-V2-G1-01, SG-V2-G1-02, SG-V2-G1-04, SG-V2-G1-05, SG-V2-G2-06, SG-V2-G2-08, SG-V2-G2-09, and SG-V2-G2-10.
- Visual QA fixed the work-card work bands and number-bond text collision before final regeneration.
- Structural check passed: `g1-g2 v2 manifest/layout structure ok: 10 templates`.
- `npm run build` passed.

Next action:

- Open or print `public/worksheets/curriculum-probe-g1-g2-v2/printables/ScanGrade-Grade1-2-Curriculum-Probe-V2-Packet.pdf`.
- Classroom-test with students before summer break, then score separately for scan success, QR/layout success, handwritten-truth OCR accuracy, confident-read coverage, confident-wrong count, and review count.
