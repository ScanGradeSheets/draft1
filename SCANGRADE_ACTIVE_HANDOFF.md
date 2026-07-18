# ScanGrade Active Handoff

## 2026-07-16 browser-local stronger-reader checkpoint (current)

- Built a ScanGrade-adapted TrOCR-small whole-answer model that reads preserved stitched grayscale answers and receives no answer key. Four packet-held-out folds scored **244/275 (88.7%)**: rows 149/160, non-rows 95/115, one digit 92/100, two digits 152/175, number bonds 12/22.
- This materially exceeds the previous 6.4 MB compact model (196/275) and slightly exceeds the 335M adapted strong reader's stitched top-1 result (242/275), but raw confidence remains unsafe and the model must not override accepted Candidate 6 reads.
- Final opened-data adapter selected 122/136 historical validation and scored 96/114 historical holdout. P05 remains sealed and untouched.
- Exported a leading **84 MB** browser package (FP16 encoder + int8 decoder). Native P02 parity is 68/68. Single-answer Chromium/WebKit parity passes at about 0.78–0.79 seconds inference on the Mac.
- A decoder causal-mask tracing bug initially produced `5→55`/`8→8888`; corrected export uses the actual start token and traces the two-token path. Full float and 84 MB hybrid parity now pass.
- Batch/session reuse can stall ONNX Runtime Web. The implemented shadow path uses disposable workers, sequential yellow-only reads, a strict cap/timeout, and fail-open behavior. Physical old-iPad sustained memory is untested.
- Wider robust crops repair real clipping (including full `19` on P02 number-bond Q2) but regress overall recognition because printed borders create duplicates. Keep the uncleaned stitched original as primary evidence; use wider/cleaned views only as clipping or disagreement evidence.
- Nothing was deployed, pushed, or allowed to change grades/yellows. Candidate 6 remains the production/private control.
- Full report: `docs/SCANGRADE_BROWSER_LOCAL_TROCR_SMALL_RESULT_20260716.md`.

Next action: host/cache the 84 MB files from a durable HTTPS model origin and run the sustained physical old-iPad test. Do not freeze or spend P05 on an automatic selector yet; every tested selector still admits known errors or no useful safe coverage.

## 2026-07-14 remaining-yellow audit and browser-secondary candidate

- Visually audited all 53 scorable yellows remaining after the frozen 222/275 consensus candidate. Classification: 25 readable/compact-28×28 bottlenecks, 11 readable/frame instability, six crop/registration failures, five layout/slot-contract failures, three genuinely ambiguous answers, two browser preprocessing conflicts, and one confidence-safety veto.
- Added and tested experimental `consensus-promotion-shadow-2`: exact 3/3 large-grayscale agreement with minimum confidence 0.98 may use per-digit browser top-two support (minimum probability 0.05) when compact evidence is inadequate. Ambiguity, safety, and slot gates remain dominant; no answer key is used.
- Fixed-evidence score: 228/275 automatic (82.9%), 228 correct, zero observed wrong; +6 over frozen candidate. Row 142/160 (88.8%); non-row 86/115 (74.8%).
- Fresh 40-page browser replay: 226/275 (82.2%), 226 correct, zero observed wrong; all pages, annotations, and marked sheets passed. Six old yellows were rescued, while two previous automatics moved safely to review because current selection behavior differed despite identical retained 28×28 inputs/probabilities. Investigate reproducibility before release.
- Historical one-frame falsification stress: 457/578 surrogate automatic, zero observed wrong; the new lane contributed nine correct/no wrong surrogate promotions. Historical data cannot validate three-frame stability.
- Focused 22/22 tests and production build pass. Nothing deployed or pushed. Full report: `docs/SCANGRADE_YELLOW_RESIDUAL_AUDIT_20260714.md`.

Last updated: 2026-07-13
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

### 2026-07-13 V3 build status (current)

Tony authorized a from-scratch V3 alongside the preserved V2/control. V3 is implemented as an opt-in shadow system; it is not authorized to alter production grades yet.

Implemented:

- exact continuous grayscale answer zones cropped once from the live refined canonical page;
- deterministic fidelity and independent blank/artifact evidence;
- a 1.31M-parameter, 5.8 MB ScanGrade-specific one/two-digit whole-answer ONNX model;
- existing adapted TrOCR retained on its stronger cleaned/stitched representation;
- key-blind, independent-architecture fusion with abstention;
- up to three real auto-capture frames, each independently registered and read;
- local V2 grading first, optional V3 suggestions asynchronously, and identical local output during a service outage;
- local/container compact-model service, prospective V2/V3 evaluator, and V3 policy freezer.

Verified evidence:

- V2 broad control: 582 answers, 323 automatic (55.5%), 323/323 correct; row 70.5%, non-row 43.1%.
- Compact model: validation 99/136 (72.8%), historical holdout 66/114 (57.9%). It is useful independent evidence, not a replacement OCR.
- Adapted TrOCR cleaned/stitched: validation 105/136 (77.2%), historical holdout 92/114 (80.7%). Direct raw continuous TrOCR was worse (47.8%/45.6%).
- Conservative three-reader fusion with uncalibrated artifact evidence kept advisory: validation 88/136 automatic with 0 wrong and 5 promotions; historical holdout 86/114 automatic with 0 wrong and 0 promotions.
- At least one reader was correct on 109/114 historical holdout answers, proving candidate signal exists; safe selection remains the bottleneck. The learned readers agreed wrongly five times, so thresholds must not be loosened blindly.
- Compact service: 72 ms for 1 answer, 420 ms for 10, 1.26 seconds for 30 on the Mac; answer-key fields rejected.
- Native container service supersedes those Node/WASM performance numbers: 43.8 ms for 1 answer, 41.8 ms for 10, and 92.9 ms for 30 warm answers. It exactly reproduced 114/114 frozen holdout reads; Node/WASM differed on five borderline cases. Use Python/native ONNX Runtime as the canonical cloud evaluator.
- End-to-end browser smoke passed with service available and unavailable. Predictions were identical during the simulated outage.
- WebKit/iPad emulation exposed and then verified the HTTPS requirement: HTTP model calls were blocked as mixed content; the same compact service over HTTPS completed successfully. Actual old-iPad camera/memory behavior is still untested.
- A debug-only browser replay exercised all three retained-frame branches using three saved real captures. Both independent readers processed 24 answer images each. V3 accepted 6/8 answers and all 6 matched handwritten truth; the two browser-OCR disagreements remained review while both learned readers supplied the correct alternative. This proves plumbing/conservative behavior, not live-burst generalization, because these were separated saved captures.
- The blank/artifact lane remains advisory. It found 3/4 known blanks with zero false blank proposals, but 90/582 artifact flags and the real-capture replay show the artifact probability is not calibrated well enough to veto model agreement.

Canonical docs:

- `docs/SCANGRADE_V3_ARCHITECTURE.md`
- `docs/SCANGRADE_V3_EXPERIMENT_LEDGER_20260713.md`
- `docs/SCANGRADE_V3_HEAD_TO_HEAD_20260713.md`
- `docs/SCANGRADE_FOUR_PACKET_CAPTURE_PROTOCOL.md`

Prospective gate remains physically blocked on Tony scanning the pre-registered intact packets: P08, P03, P09 development; P02 locked; eight packets remain unscanned. Do not mix students or open P02 truth before `npm run freeze:v3-policy`. V3 uses `?hybridV3=1`, plus optional `v3CompactModelUrl` and `reviewModelUrl`. Do not expose either experimental service anonymously to student traffic.

Next action: deploy/run the private V3 shadow build, scan one P08 page and confirm continuous zones + burst frames + `v3-shadow-complete`, then scan P08/P03/P09. Tune only on those development packets, freeze, and open P02 once.

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

## 2026-06-20 Pre-Codex-Update Handoff

Tony is about to update Codex. If this thread disappears, continue from these anchors:

```text
Source branch: autobuild/safe-20260223
Latest source commit: 5e0d9db Fix classroom debug optional blanks
Latest public deploy commit on gh-pages: 99d9c65 Deploy classroom debug fix build
Public test URL: https://scangradesheets.github.io/draft1/
Expected visible build label: 2026.06.20-0820-EDT-sg3-classroom-debug-fix
```

The immediate next move is evidence collection, not another blind app tweak. Use the current build to gather more classroom scans because the debug receiver now preserves enough evidence to diagnose the real failures.

2026-07-01 23:25 EDT update:

- Tony reported re-scanning all 10 pages from the same package for comparison after the `2026.07.01-2230-EDT-sg3-optional-leading-review` deploy.
- Local time was confirmed as `2026-07-01 23:24 EDT`; do not look only under `2026-07-02` for this batch.
- A modification-time scan across `private-evidence/debug-scans/` showed no new folders after `private-evidence/debug-scans/2026-07-01/2026-07-01_23-55-43-064-sg-g1-lw-05-mixed-20-92967803/`.
- Mission Control was no longer running, so the late 10-page rescan should be treated as not received unless another upload path is later found.
- Mission Control was restarted on `127.0.0.1:8787` with a fresh per-session debug upload token. The token was shared in chat via a prepared debug URL and intentionally not written here.
- Local receiver check returned `HTTP 200`; tailnet Mission Control check at `https://hobbes-mac-mini.tail9a3379.ts.net/mission-control/` returned `HTTP 200`.

Next action:

1. Tony should open the fresh prepared debug URL on the scan device, use `Debug Scan (exports)`, scan one page, and wait for the visible `Debug saved` confirmation.
2. Confirm that a new folder appears under `private-evidence/debug-scans/2026-07-01/`.
3. Only then re-scan the remaining packet pages for comparison.

Open risk:

- If Codex or the local receiver process dies again, Tony's phone may still have a stored token/upload URL that no longer matches a running receiver. Restart Mission Control and send a fresh prepared URL before any large batch.

2026-07-01 23:37 EDT update:

- Tony scanned one page using the fresh debug URL and Mission Control received it.
- Saved folder: `private-evidence/debug-scans/2026-07-02/2026-07-02_03-36-58-172-sg-g1-lw-07-dot-collections-1325aaf9/`.
- The folder date is `2026-07-02` because the server uses UTC timestamps; the local scan time was still July 1 EDT.
- Saved evidence includes `captured.png`, `warped.png`, `marked-sheet.jpg`, `overlay-debug.json`, `debug.json`, `raw-crops/`, and `model-inputs/`.
- QR/layout path worked: layout was read directly as `sg-g1-lw-07-dot-collections` from `full-frame:direct`.
- Grading result remained weak on this dot-collections page: `questionScore: 1/6`, `questionReviewCount: 6/6`, `needsReviewCount: 8`, with several false two-digit answers such as `5 -> 51`, `8 -> 81`, `12 -> 92`, `16 -> 76`, and `19 -> 79`.

Next action:

- Tony can scan the remaining packet pages now because upload is working again. After the batch lands, compare this new run against the earlier July 1 batch by worksheet type.

2026-07-02 00:05 EDT update:

- Tony scanned the remaining 9 pages from the same packet. All 10 pages are now saved in `private-evidence/debug-scans/2026-07-02/` with local modification times from July 1 23:36-23:41 EDT.
- Layout/QR intake worked for all 10 pages; each page resolved from QR as the expected `sg-g1-lw-*` layout, not title fallback.
- Raw saved summary from the current public build:
  - `sg-g1-lw-01-add-1digit`: `6/8`, review `2/8`.
  - `sg-g1-lw-02-add-2digit`: `2/8`, review `5/8`.
  - `sg-g1-lw-03-sub-1digit`: `5/8`, review `1/8`.
  - `sg-g1-lw-04-sub-2digit`: `3/8`, review `5/8`.
  - `sg-g1-lw-05-mixed-20`: `2/8`, review `7/8`.
  - `sg-g1-lw-06-ten-frames`: `0/6`, review `6/6`.
  - `sg-g1-lw-07-dot-collections`: `1/6`, review `6/6`.
  - `sg-g1-lw-08-number-bonds`: `4/6`, review `1/6`.
  - `sg-g1-lw-09-number-patterns`: `0/6`, review `6/6`.
  - `sg-g1-lw-10-place-value-50`: `4/6`, review `2/6`.
- Visual inspection and replay separated two failure families:
  1. Two-slot boxes used for one-digit answers: students often wrote the single digit in the left slot and left the right slot blank. The app sometimes read the right divider/blank as a companion digit, e.g. `5 -> 51`, `8 -> 81`, `9 -> 91`.
  2. True two-digit answers with a leading `1`: the leading `1` is often misread as `7`, `8`, or `9` in dot collections, two-digit fact rows, number patterns, and place value.
- Patch made: generalized `applyOptionalSingleDigitBlankOverrides` so a two-slot one-digit answer can collapse the artifact/blank slot even when the real digit is not the answer-key digit. It only auto-clears review when the remaining digit has strong model margin and clean ink; weaker reads still stay yellow review.
- Mirrored the policy in `scripts/replay_live_ocr_captured.mjs`.
- Replay after patch on the 10 saved captures:
  - Rescued dot collections A/B from `51/81` to `5_/8_`.
  - Rescued ten frames A from `51` to `5_` while still marking it wrong against the answer key.
  - Rescued mixed D from `91` to `9_`.
  - Did not collapse mixed B `72`, because the student visibly wrote a two-digit wrong answer (`12`) and both slots were real handwriting; this is correct conservative behavior.
  - Remaining weak pages are dominated by true leading-`1` recognition/crop failures, not optional blank policy.
- Verification:
  - `node --check scripts/replay_live_ocr_captured.mjs`
  - `npm run build`
  - `npm run build:github`
  - Local replay against `https://127.0.0.1:5174` with `/tmp/sg-latest-debug-unwrapped/*.json`.
- New visible build label pending commit/deploy: `2026.07.02-0005-EDT-sg3-flex-one-digit-slots`.

Next action:

- Deploy this narrow fix, then collect/label leading-`1` failures as a separate OCR/model/crop improvement track. Do not loosen confidence thresholds to make those reads look better; they are still real OCR failures.

2026-07-02 00:35 EDT update:

- Tony scanned two targeted pages on the deployed `2026.07.02-0005-EDT-sg3-flex-one-digit-slots` build:
  - `private-evidence/debug-scans/2026-07-02/2026-07-02_04-27-27-356-sg-g1-lw-07-dot-collections-51583559/`
  - `private-evidence/debug-scans/2026-07-02/2026-07-02_04-27-34-831-sg-g1-lw-06-ten-frames-70841c4f/`
- Both uploads used the expected public URL with `?v=flex-one-digit-slots-0005&liveOcrDebug=1`; QR/layout intake worked on both.
- Dot collections result: `2/6`, review `3/6`. The new optional one-digit slot policy worked on A (`51 -> 5_`) and conservatively kept B as review (`6_` for expected 8). Remaining failures were C `12 -> 92` review, E `16 -> 76` confident wrong, and F `19 -> 79` review.
- Ten frames result: `0/6`, review `5/6`. The optional slot policy worked conservatively on A (`51 -> 5_`, still review/wrong vs key), but the page is dominated by left-slot/leading-digit failures: B `10 -> 61`, C `11 -> 71` confident wrong, D `14 -> 81`, E `17 -> 91`, F `20 -> 16`.
- Interpretation: the flexible one-digit slot patch is behaving as intended. The remaining risk is a true OCR/model/crop problem, especially leading or left-slot `1`s being read as `7/8/9/6`, not a threshold problem to solve by loosening confidence.
- Evidence strategy recommendation: collect more authentic classroom evidence now, but do not use all of it for tuning. Split the remaining packets before analysis into calibration, validation, and sealed holdout sets so there is still honest test material for the summer.

Next action:

1. Ask Tony to label packet order before scanning more: calibration/dev packets, validation packets, and sealed holdout packets.
2. Use a calibration batch to quantify failure patterns by worksheet type before more OCR changes.
3. Keep at least several complete packets untouched by tuning until a final replay/live-scan evaluation.

2026-07-02 10:32 EDT update:

- Tony scanned the first page of the next calibration upload batch before continuing with additional full packets.
- Mission Control received the upload at `private-evidence/debug-scans/2026-07-02/2026-07-02_14-29-37-277-sg-g1-lw-07-dot-collections-e5cc7757/`.
- The scan came from the expected debug URL with `v=flex-one-digit-slots-0005`, `liveOcrDebug=1`, and debug auto-upload enabled.
- Layout/QR intake worked: `sg-g1-lw-07-dot-collections`.
- Saved bundle is complete: `captured.png`, `warped.png`, `marked-sheet.jpg`, `overlay-debug.json`, `debug.json`, raw crops, model inputs, and tensors.
- Summary: `questionScore: 2/6`, `questionReviewCount: 5/6`, `needsReviewCount: 6`.
- Tony plans to scan 6 more full packets for calibration, making 7 total including the already-scanned Pack A. Recommendation remains to keep later packets reserved for validation/holdout and to distinguish calibration packets as B1-B6 if possible.

Recommended scan protocol:

1. Before scanning a full stack, open the public test URL and confirm the visible build label matches the latest deployed build recorded in this handoff.
2. Confirm Mission Control debug intake is running and reachable from the scan device. Expected receiver command is still `SG_DEBUG_UPLOAD_TOKEN=<short-secret> node mission-control/server.mjs`.
3. Scan a tiny sanity set first: one simple fact-row page, one two-digit fact-row page, and one visual-format page such as ten frames/dot collections/number bonds.
4. Confirm Mission Control receives new `private-evidence/debug-scans/YYYY-MM-DD/<scan-id>/` folders with `debug.json`, `summary.json`, `captured.png`, `marked-sheet.jpg`, `overlay-debug.json`, and crop/model assets when available.
5. If those uploads land, scan the full classroom packet set raw. Do not manually correct the result before the auto-upload has saved the original scan evidence.
6. Prefer the iPhone/current device for the evidence batch. Test the old iPad separately as a compatibility track, because its engine/loading behavior is a different failure mode.
7. After the batch, analyze by worksheet type and failure mode before changing OCR/capture again. Separate optional-blank policy issues from true crop/recognition/layout failures.

Current judgement:

- Scan more now, after a 3-page upload sanity check.
- Do not spend more time tuning in the abstract before the batch unless debug auto-upload is broken.
- Expect the app to still show many yellow review cases on the varied Grade 1 packet. That evidence is useful; the goal is to learn which worksheet formats are viable and which need layout/crop redesign.

Unrelated dirty worktree files existed before this handoff and should not be reverted without Tony's approval.

2026-06-20 17:34 EDT update:

- Tony scanned another packet, but no new worksheet debug folders arrived in `private-evidence/debug-scans/2026-06-20/`.
- The latest real packet evidence visible at that moment was still the earlier run ending at `2026-06-20T01:28:14Z`; later entries were smoke/receiver checks only.
- Local Mission Control was not running and the tailnet URL returned `502`, so the just-scanned packet should be treated as not received.
- Mission Control was restarted and the tailnet route returned `200`; a tailnet receiver-check upload saved successfully.
- Next action remains: open a prepared debug URL whose token matches the running receiver, re-scan a 3-page sanity set, confirm folders arrive, then scan the full packet set.

2026-06-20 19:02 EDT update:

- Tony re-scanned the full 10-page packet and Mission Control received the batch.
- The receiver saved all 10 scans with `captured.png`, `warped.png`, `marked-sheet.jpg`, `overlay-debug.json`, raw crops, model inputs, and debug JSON.
- Two pages were visibly Grade 1 packet sheets but resolved as the legacy `g2-mixed-within-50-v1` layout because the QR payload was missing and the app's fallback path only knew the old Grade 2 title set.
- A second fallback issue was found in the same path: after a printed-title fallback chose a layout, the app did not rerun `processWorksheet` with the matched layout, so varied packet formats could keep stale crops from the seed layout.

Fix made:

- Missing-QR title fallback now knows the 10 Grade 1 last-week packet layouts plus the 3 older Grade 2 layouts.
- Long printed titles are rendered into the title matcher with a max width so Grade 1 titles such as `Subtraction: Single-Digit Answers` can be compared reliably.
- When a printed-title fallback matches a different layout, the app reruns the homography/crop/tensor pipeline with the matched layout before OCR and annotation.
- Any layout inferred from printed title instead of a real QR payload is forced into teacher-review mode with `forcedFallbackReviewReason: qr-missing-title-layout-fallback-review`. This prevents silent confident grading on a missing-QR fallback while still saving useful evidence.
- Debug JSON now includes `missingQrLayoutFallback` and `titleFallbackReranLayout` so future packet analysis can separate real QR reads from fallback recovery.
- Visible build label changed to `2026.06.20-1902-EDT-sg3-qr-fallback-guard`.

Verification completed:

```text
npm run build
npm run build:github
dist sanity check: build label present, Grade 1 page 3/page 5 layout IDs present, missing-QR fallback reason present
```

Next test:

- Re-scan the same 10-page packet on the public build once deployed.
- If a QR still fails on pages such as `SG-G1-LW-03` or `SG-G1-LW-05`, the scan should no longer resolve as `g2-mixed-within-50-v1`; it should either use the matched Grade 1 layout in teacher-review mode or fail safely as review-only.
- Normal grading should still require a real QR payload from the page URL or image decode.

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

## 2026-07-01 / SG 3 Classroom Debug Packet Rescan

What changed:

- Tony scanned the Grade 1 last-week packet through the public debug-upload link on an iPhone 16.
- Mission Control received 9 completed page uploads; page 10 got stuck on "grading" and never uploaded.
- The local Mission Control receiver was running with `SG_DEBUG_UPLOAD_TOKEN=sg3classroom node mission-control/server.mjs` and the tailnet route was reachable.
- A narrow OCR patch was made for the highest-frequency failure family in the received pages: handwritten left-slot `1`s in two-digit answer boxes being read as `7`, `4`, `8`, or `9`.
- A digit-engine timeout guard was added so a stalled model operation can fall back to saved teacher review instead of leaving the scanner spinning with no debug artifact.
- Visible build label changed to `2026.07.01-2220-EDT-sg3-left-slot-timeout`.

Evidence used:

```text
private-evidence/debug-scans/2026-07-01/2026-07-01_21-42-01-660-sg-g1-lw-07-dot-collections-7d7f6066
private-evidence/debug-scans/2026-07-01/2026-07-01_21-42-10-500-sg-g1-lw-06-ten-frames-6e00d7f1
private-evidence/debug-scans/2026-07-01/2026-07-01_21-42-18-443-sg-g1-lw-01-add-1digit-11738328
private-evidence/debug-scans/2026-07-01/2026-07-01_21-42-28-270-sg-g1-lw-02-add-2digit-4b87402b
private-evidence/debug-scans/2026-07-01/2026-07-01_21-42-37-394-sg-g1-lw-03-sub-1digit-9960366f
private-evidence/debug-scans/2026-07-01/2026-07-01_21-42-53-505-sg-g1-lw-04-sub-2digit-8c2f4f42
private-evidence/debug-scans/2026-07-01/2026-07-01_21-43-40-999-sg-g1-lw-05-mixed-20-2e6fd780
private-evidence/debug-scans/2026-07-01/2026-07-01_21-43-59-139-sg-g1-lw-08-number-bonds-dc760005
private-evidence/debug-scans/2026-07-01/2026-07-01_21-44-09-274-sg-g1-lw-09-number-patterns-f8e34890
```

Results:

- All 9 completed uploads had `qr_decode_source: full-frame:direct`; the QR/layout fallback bug was not the issue in this batch.
- No `sg-g1-lw-10-place-value-50` folder appeared for the July 1 packet run, confirming page 10 failed before debug upload.
- Saved-JSON simulation of the left-slot `1` rule changed 5 left-slot digits, improved answer-key outcomes from `19/64` to `22/64`, and introduced `0` answer-key regressions across the 9 completed packet pages.
- This simulation is not a handwritten-truth score; it is a regression guard. Visual inspection confirmed the changed cases are the handwritten left-slot `1` family.

Commands run:

```text
npm run build
npm run build:github
node -e <July 1 saved-debug simulation>
```

Files changed:

```text
src/ocr-pipeline.js
src/components/CameraCapture.vue
src/App.vue
SCANGRADE_ACTIVE_HANDOFF.md
```

Rollback point:

```text
Previous pushed source commit before this patch: 2ca91b0 Guard missing QR layout fallback
Previous public deploy commit before this patch: 822838e Deploy QR fallback guard build
```

Next action:

- Commit and deploy this patch to `gh-pages`.
- Ask Tony to refresh the public debug link and rescan page 10 alone first, then one two-digit page and one number-bond page.
- Confirm the visible build label is `2026.07.01-2220-EDT-sg3-left-slot-timeout`.

Open risks:

- Page 10 hang is not yet reproduced with a saved artifact; the timeout guard should make the next failure observable as an `ocr-error`/review-save bundle if it happens again.
- Visual-format pages still over-review heavily and need separate layout/crop/OCR analysis after the left-slot `1` family is handled.
- Do not call the varied Grade 1 packet reliable yet; this patch is a narrow evidence-backed fix.

## 2026-07-01 / Post-Deploy Debug Rescans

What happened:

- Tony rescanned page 10 using the public debug-upload link for build `2026.07.01-2220-EDT-sg3-left-slot-timeout`.
- Page 10 no longer got stuck on "grading"; Mission Control received a complete `ocr-complete` bundle.
- Tony then scanned one more two-digit-style sheet; Mission Control also received a complete bundle.

New evidence:

```text
private-evidence/debug-scans/2026-07-01/2026-07-01_23-54-29-490-sg-g1-lw-10-place-value-50-fd76390e
private-evidence/debug-scans/2026-07-01/2026-07-01_23-55-43-064-sg-g1-lw-05-mixed-20-92967803
```

Observed results:

- Page 10 summary: `uploadReason: ocr-complete`, `qr_decode_source: full-frame:direct`, `digitEngineFallback: false`, `digitEngineError: null`, score `4/6`, review count `2`.
- The timeout guard appears to have fixed the page-10 hang/recovery problem for this scan.
- Page 10 still misread/reviewed visually readable but border-hugging answers:
  - C (`before 50`) student wrote `49`; raw left-digit crop included a partial `4`, but model output was `1`.
  - E (`10 + 10 + 10`) student wrote `30`; raw crops showed a clear-ish `3` and a clipped `0`, but model output was `52` and correctly stayed in review.
- The second two-digit-style scan (`sg-g1-lw-05-mixed-20`) completed with score `3/8`, review count `5`, needs-review count `7`.
- The new `left-slot-one-weighted-vote` rule fired on A and C of the second scan, but A still stayed yellow because the confidence layer did not clear it; H was a harder miss with variant disagreement between `1`, `9`, and `7`.

Rejected experiment:

- Tried temporarily removing the decisive-`1` block from `left-slot-sparse-four-shape-from-one-rescue`.
- Replay command:

```text
node scripts/eval_live_ocr_production.mjs --url https://localhost:5174 /tmp/sg-live-debug-unwrapped/*.json
```

- The experiment did not fix page 10 C and introduced additional `1 -> 4` risk on other saved scans, so it was immediately reverted.
- Current source diff after the revert: no OCR source diff from the rejected experiment.

Current diagnosis:

- QR/layout/upload path is working on the new build.
- The remaining reliability bottleneck is two-digit slot crop/segmentation plus the digit model's handling of border-hugging Grade 1 handwriting.
- Do not simply raise confidence on `left-slot-one-weighted-vote`; page 10 C proves that a visually written `4` can collapse into a decisive model `1` when the crop/processing loses shape context.

Recommended next action:

- Build a targeted eval set from the new `private-evidence/debug-scans/2026-07-01` bundles with handwritten-truth labels, especially page 10 C/E and mixed-sheet A/F/G/H.
- Prototype crop/variant changes for border-hugging digits and replay from captured images, not saved tensors, because crop changes require reprocessing the original captured image.
- Keep public build `2026.07.01-2220-EDT-sg3-left-slot-timeout` live until a crop-level patch passes replay.

## 2026-07-01 / Optional Leading Digit Review Patch

What changed:

- A rejected `faint-pencil-slot` crop/preprocess experiment was removed; it did not improve the two latest rescans and was not shipped.
- Added a narrow confidence-policy guard for two-slot answer boxes whose correct answer is single digit.
- If the left slot is optional in the answer key but the OCR sees an extra leading digit, ScanGrade now requires stronger evidence (`confidence >= 0.92` and `topGap >= 0.50`) before avoiding teacher review.
- Mirrored the same rule in `scripts/replay_live_ocr_captured.mjs` so future app-level replays test the same policy.
- Visible build label changed to `2026.07.01-2230-EDT-sg3-optional-leading-review`.

Why:

- In the latest `sg-g1-lw-05-mixed-20` scan, question B expected a single-digit answer (`7`) but the student wrote a two-digit wrong answer. The OCR read the optional leading slot as `7` with confidence `0.824`, producing `72`. Previously that leading digit was not yellow because the answer key had `null` for the optional slot.
- This is not a digit-recognition fix; it is a trust/routing fix so uncertain unexpected leading digits go to review instead of silently becoming part of an automatic wrong answer.

Evidence used:

```text
private-evidence/debug-scans/2026-07-01/2026-07-01_23-54-29-490-sg-g1-lw-10-place-value-50-fd76390e
private-evidence/debug-scans/2026-07-01/2026-07-01_23-55-43-064-sg-g1-lw-05-mixed-20-92967803
```

Verification:

```text
node scripts/score_live_ocr_debug_truth.mjs --truth /tmp/sg-latest-truth.json /tmp/sg-live-debug-unwrapped/2026-07-01_23-54-29-490-sg-g1-lw-10-place-value-50-fd76390e.json /tmp/sg-live-debug-unwrapped/2026-07-01_23-55-43-064-sg-g1-lw-05-mixed-20-92967803.json
node scripts/eval_live_ocr_reprocess.mjs --url https://localhost:5174 --grid /tmp/sg-live-debug-unwrapped/2026-07-01_23-54-29-490-sg-g1-lw-10-place-value-50-fd76390e.json /tmp/sg-live-debug-unwrapped/2026-07-01_23-55-43-064-sg-g1-lw-05-mixed-20-92967803.json
node scripts/replay_live_ocr_captured.mjs --allow-imperfect --url https://localhost:5174 --out-dir /tmp/sg-replay-after-leading /tmp/sg-live-debug-unwrapped/2026-07-01_23-54-29-490-sg-g1-lw-10-place-value-50-fd76390e.json /tmp/sg-live-debug-unwrapped/2026-07-01_23-55-43-064-sg-g1-lw-05-mixed-20-92967803.json
npm run build
```

Key outputs:

- Handwritten-truth score on the two latest saved debug JSONs before this patch: `Answer OCR truth: 8/14`, `Confident answers: 7/14`, `Confident answer accuracy: 6/7`, `Confident wrong answers: 1`.
- App-level replay after the patch: page 10 remains `qscore=4/6`, `qreview=2`, guard pass.
- App-level replay after the patch: mixed sheet is forced into review by the existing unusable-scan guard, and the optional leading slots now show `two-digit-optional-leading-digit-review`.
- Confirmed in `/tmp/sg-replay-after-leading/2026-07-01_23-55-43-064-sg-g1-lw-05-mixed-20-92967803-replay-result.json` that q2 left slot has `reviewNeeded: true`, `unexpectedLeadingDigitReview: true`, `preprocessReviewReason: two-digit-optional-leading-digit-review`.
- `npm run build` passed.

Files changed in this patch:

```text
src/components/CameraCapture.vue
src/App.vue
scripts/replay_live_ocr_captured.mjs
SCANGRADE_ACTIVE_HANDOFF.md
```

Current receiver status:

- Local dev server and Mission Control server were running.
- The extra "one more 2-digit page" Tony mentioned after the 23:55 scan was not found under `private-evidence/debug-scans`; latest visible saved bundles remain the 23:54 and 23:55 folders above.

Open risks:

- This patch should reduce silent trust errors for optional leading digits, but it does not improve crop/model recognition of border-hugging handwritten `4`, `3`, or `0`.
- The big reliability jump to 90-95% confident reads still likely requires turning the classroom scans into labeled training/eval data, not more hand-tuned crop guesses.

## 2026-07-02 Classroom Calibration Batch Tuning

Tony uploaded the next classroom calibration batch: 62 post-checkpoint debug summaries were visible, with 54 valid Grade 1 packet scans replayed and 8 excluded/invalid scans. The replay input set used for this pass is:

```text
/tmp/sg-calibration-20260702-unwrapped/*.json
```

Patch made:

- Added a bounded left-slot `7 -> 1` shape rescue for two-slot answer boxes where the expected left digit is `1`, the model confidently chose `7`, and the raw-border tensor has one-stroke `1` geometry. This targets the observed left-slot weakness without globally changing `7`s.
- Added a single-slot `6`/`5` high-risk mismatch review guard. It does not rewrite the digit; it sends expected-`6`, predicted-`5`, confidence `< 0.90` cases to yellow review. This caught one real OCR miss (`3 + 3`, handwritten `6`, predicted `5`) while preserving red Xs for visually wrong student answers.
- Mirrored both policies in `scripts/replay_live_ocr_captured.mjs`.
- Added debug fields for shape rescues: `originalDigitBeforeShapeRescue`, `originalConfidenceBeforeShapeRescue`, and `highRiskSingleDigitMismatchReview`.
- Visible build label changed to `2026.07.02-1212-EDT-sg3-leftslot-rescue-guard`.

Verification:

```text
node --check scripts/replay_live_ocr_captured.mjs
npm run build
SG_REPLAY_URL=https://127.0.0.1:5175 node scripts/replay_live_ocr_captured.mjs --allow-imperfect --out-dir /tmp/sg-calibration-leftslot-rescue-v3 /tmp/sg-calibration-20260702-unwrapped/*.json
```

Replay result after patch:

```text
Tested captures: 54
Rejected by guards: 8/54
Perfect captures: 2/54
Cell accuracy vs answer key: 424/648 (65.43%)
Left-slot shape rescues: 12 total, 12 answer-key-correct; 4 stayed review because their full scan was guard-rejected.
Single-slot 6/5 review guard: 5 cells reviewed; only 1 changed a previously non-review OCR miss.
Group review count: 200/380
Non-review answer-key mismatches: 4 groups, all visually checked as student-wrong answers, not OCR errors.
```

Important interpretation:

- The answer-key score is not the real OCR score because many student answers are intentionally wrong. Use it for pattern finding only.
- Visual inspection of `/tmp/sg-confident-wrong-contact.jpg` showed four remaining non-review answer-key mismatches were correct app behavior: the student wrote the wrong answer and ScanGrade marked it red.
- Visual inspection of `/tmp/sg-marked-sheets-contact.png` showed no systemic annotation drift; checks, Xs, and yellow circles are anchored to the intended answer boxes/slots at contact-sheet scale.

Remaining reliability bottlenecks:

- Number bonds, dot collections, ten frames, and mixed two-slot sheets remain review-heavy.
- Two-digit pages still hit the unusable-scan guard on 8/54 captures, concentrated in add-2digit, sub-2digit, and mixed-20 pages.
- The next meaningful jump toward market-readiness should come from labeled handwritten-truth evaluation/training on these classroom scans, plus layout/crop improvements for the visual worksheet formats. Do not loosen confidence thresholds to inflate apparent confidence.

Deploy follow-up:

- Source commit pushed: `395f263 Tighten classroom OCR confidence policy` on `autobuild/safe-20260223`.
- GitHub Pages worktree commits pushed on `gh-pages`: `ad9e5e0 Deploy classroom OCR rescue build`, `fac1e25 Refresh deploy asset names`, and `fe26a69 Force static Pages publish`.
- Commit-specific raw GitHub content for `fac1e25` showed the expected `index-CscVcfNN-r1.js` / `index-Clbz-Bwe-r1.css` asset references, and the JS asset existed.
- Public `https://scangradesheets.github.io/draft1/` still served the previous `6dd8833` artifact after cache expiry and after the `.nojekyll` trigger commit. The visible public site should be treated as not yet updated until a later check shows build label `2026.07.02-1212-EDT-sg3-leftslot-rescue-guard`.
- Local Vite dev server on port `5175` was stopped after verification.

## 2026-07-02 Pages Deploy Queue / Artifact Prune

Tony reran the GitHub Pages workflow for `fe26a69` and reported that it showed as queued. A public check still showed the stale Pages HTML (`last-modified: Thu, 02 Jul 2026 04:14:06 GMT`), so the public scanner remained unsafe to use for the classroom debug batch.

Deploy issue found:

- The Pages artifact for the failed run was 79.2 MB compressed.
- Local `dist/` was 218 MB because Vite copied every old ONNX model experiment and every ONNX Runtime WASM/MJS variant from `public/`.
- The current app runtime only needs the current primary model, right-slot model, legacy/ensemble support models, OpenCV, and the two ONNX Runtime WASM binaries referenced by `src/ocr-pipeline.js`.

Patch made:

- Added a deploy-only prune in `vite.config.js`, enabled only by `SG_PRUNE_DEPLOY=1`.
- Updated `npm run build:github` to set `SG_PRUNE_DEPLOY=1`.
- Normal local builds remain unpruned so lab/eval assets stay available.

Verification:

```text
npm run build:github
dist size after deploy prune: 69M
dist/models after prune: 4.4M
kept runtime files:
- ort-wasm-nosimd.wasm
- ort-wasm-simd-1.17.wasm
- models/mnist-model.onnx
- models/worksheet-digit-generalist.onnx
- models/worksheet-digit-live-trusted-temp.onnx
- models/worksheet-digit-tony-generalist-noaug-20260601.onnx
```

Next action:

- Publish the leaner `dist/` to the `gh-pages` worktree and push source/deploy commits.
- Recheck `https://scangradesheets.github.io/draft1/` after the Pages workflow succeeds.
- Tony should not scan more packets until the visible public build label is `2026.07.02-1212-EDT-sg3-leftslot-rescue-guard`.

Follow-up:

- Source commit pushed: `c46084f Prune GitHub Pages deploy assets`.
- `gh-pages` deploy commit pushed: `5d6f7e1 Deploy lean classroom OCR build`.
- Empty retry commit pushed: `21913d9 Retry lean Pages deploy`.
- GitHub Pages Run 96 (`28637674516`) and Run 97 (`28637813499`) both built and uploaded the smaller `github-pages` artifact successfully, but failed at the GitHub-managed deploy job with: `Deployment failed, try again later.`
- Run 97 artifact size was `32.6 MB`, so the artifact-size reduction worked.
- GitHub connector could read jobs but could not rerun the deploy job: GitHub returned `403 Resource not accessible by integration`.
- Older Run 95 (`28607104764`) still appeared queued while Runs 96/97 failed quickly. If Pages remains stuck, Tony should cancel the queued Run 95 and rerun failed jobs on the newest run from the GitHub UI.

Current public status:

- `https://scangradesheets.github.io/draft1/` still served stale assets `index-Cg8MFGrt.js` / `index-DGF2K3Sz.css`.
- Do not use the public scanner for new evidence until the page updates to the `2026.07.02-1212-EDT-sg3-leftslot-rescue-guard` build.

## 2026-07-03 Morning Pages / GitHub Connector Status

Checked again on 2026-07-03 at about 10:35 EDT:

- Public `https://scangradesheets.github.io/draft1/` still served the stale July 2 artifact:
  - `last-modified: Thu, 02 Jul 2026 04:14:05 GMT`
  - assets `index-Cg8MFGrt.js` / `index-DGF2K3Sz.css`
- GitHub Actions list still reported:
  - Run 97 `queued` for `21913d9 Retry lean Pages deploy`
  - Run 96 `completed/failure` for `5d6f7e1 Deploy lean classroom OCR build`
  - Run 95 `queued` for `fe26a69 Force static Pages publish`
- Public API for job `84927698768` showed the truth for Run 97:
  - job status `completed`
  - conclusion `failure`
  - failed step `Deploy to GitHub Pages`
  - started `2026-07-03T04:10:25Z`, completed `2026-07-03T04:10:34Z`
- The GitHub connector inside Codex still returns `401 token_expired`, even after Tony disconnected/reconnected in the UI and the UI appeared to say connected.

Current blocker:

- Need the private GitHub Pages deploy log for job `84927698768`, or another authenticated way to rerun/fix the newest Pages deploy.

Recommended next paths:

1. Try a full Codex app restart or a fresh SG thread after reconnecting the GitHub connector, then test with `mcp__codex_apps__github._list_installed_accounts`.
2. If connector remains expired, use Tony's browser/GitHub UI to open `https://github.com/ScanGradeSheets/draft1/actions/runs/28637813499/job/84927698768` and copy the failure text from the `Deploy to GitHub Pages` step.
3. If Tony approves use of local GitHub credentials from the macOS keychain, fetch the job log with authenticated GitHub API without printing or storing the token.

Do not scan more classroom packets until the public page visibly updates to build `2026.07.02-1212-EDT-sg3-leftslot-rescue-guard`.

Update:

- GitHub connector recovered after Codex restart and confirmed access to `ScanGradeSheets`.
- Run 97 deploy logs showed the generic GitHub Pages failure only:
  - artifact found
  - Pages deployment created for `21913d9`
  - failed with `Deployment failed, try again later.`
- Rerun via connector failed because GitHub still reported the workflow as already running.
- Because there was no visible cancel control in Tony's signed-in browser, pushed the same lean deploy tree to a fresh branch:
  - `gh-pages-v2` at `21913d9`
- Clean recovery path now: in GitHub repo Settings -> Pages, switch deploy branch from `gh-pages` to `gh-pages-v2` and save. The public QR URL should remain `https://scangradesheets.github.io/draft1/` because the repository name remains `draft1`.

## 2026-07-03 Pages Recovery Confirmed

Date / thread: 2026-07-03, SG 3.

What changed:

- Tony switched the GitHub Pages publishing branch from `gh-pages` to `gh-pages-v2`.
- GitHub Pages created a fresh successful deploy from `gh-pages-v2`.
- The public QR URL did not change: `https://scangradesheets.github.io/draft1/`.

Evidence used:

- GitHub Actions public API.
- Live public HTML and asset headers from `https://scangradesheets.github.io/draft1/`.
- Live public JavaScript bundle content.

Commands run:

```text
curl -sL 'https://api.github.com/repos/ScanGradeSheets/draft1/actions/runs?per_page=12'
curl -sI https://scangradesheets.github.io/draft1/
curl -sL https://scangradesheets.github.io/draft1/
curl -sL https://scangradesheets.github.io/draft1/assets/index-CscVcfNN.js
git ls-remote origin refs/heads/gh-pages-v2
```

Results:

- Run 98 completed successfully on `gh-pages-v2` at commit `21913d9`.
- Public HTML `last-modified` changed to `Fri, 03 Jul 2026 15:13:45 GMT`.
- Public HTML now references fresh assets:
  - `/draft1/assets/index-CscVcfNN.js`
  - `/draft1/assets/index-Clbz-Bwe.css`
- Old stale asset `/draft1/assets/index-Cg8MFGrt.js` now returns `404`.
- Live JavaScript bundle contains expected build label:
  - `2026.07.02-1212-EDT-sg3-leftslot-rescue-guard`

Files changed:

- This handoff entry only.

Rollback point:

- Public deploy branch `gh-pages-v2` at `21913d9`.
- Source branch `autobuild/safe-20260223` at `4e59cfb`.

Next action:

- Tony can resume classroom evidence scanning from the public QR URL or prepared debug URL, but use `Debug Scan (exports)` for evidence collection so Mission Control receives the full debug bundle.
- Keep checking the visible build label on the scan device before large batches.

Open risks:

- Old queued Runs 95 and 97 on the abandoned `gh-pages` branch may still appear in the Actions list, but the live Pages source is now `gh-pages-v2` and Run 98 is the successful deploy that matters.
- Continue preserving `private-evidence/` locally only; do not commit student evidence.

## 2026-07-03 Saved Classroom Scan Analysis / Leading-One Review Guard

Date / thread: 2026-07-03, SG 3.

What changed:

- Used the saved Mission Control debug uploads instead of asking Tony to scan more manually.
- Added analysis helpers for the saved debug-scan corpus and contact-sheet review of digit failure families.
- Improved `scripts/replay_live_ocr_captured.mjs` so it can replay Mission Control scan folders directly, unwrap saved `debug.json` payloads, process slices with `--offset` / `--limit`, and continue past individual replay errors.
- Added a conservative production trust guard: when the left slot of a two-digit answer is expected to be `1` and OCR reads another digit, route that digit/group to teacher review instead of allowing a confident automatic X. This uses answer-key context only as a review signal; it does not silently convert the digit to `1`.
- Updated visible build label to `2026.07.03-1212-EDT-sg3-leading-one-review`.

Evidence used:

- Local saved classroom evidence under `private-evidence/debug-scans/`.
- Current replay outputs written under:
  - `private-evidence/reports/current-replay-20260703/`
  - `private-evidence/reports/current-replay-20260703-b/`
  - `private-evidence/reports/current-replay-20260703-c/`
  - `private-evidence/reports/current-replay-20260703-leading-one-review-smoke/`
- Contact sheets written under `private-evidence/reports/`, especially:
  - `left-one-to-seven-contact.png`
  - `left-one-to-nine-contact.png`
  - `left-one-not-one-contact.png`
  - `optional-leading-digit-contact.png`

Commands run:

```text
node scripts/analyze_debug_scan_corpus.mjs
node scripts/make_debug_failure_contact_sheet.mjs --family left-one-to-seven --out private-evidence/reports/left-one-to-seven-contact.png --max 40
node scripts/make_debug_failure_contact_sheet.mjs --family left-one-to-nine --out private-evidence/reports/left-one-to-nine-contact.png --max 40
node scripts/make_debug_failure_contact_sheet.mjs --family left-one-not-one --out private-evidence/reports/left-one-not-one-contact.png --max 48
npm run dev -- --host 127.0.0.1
node scripts/replay_live_ocr_captured.mjs --allow-imperfect --url https://127.0.0.1:5174 --out-dir private-evidence/reports/current-replay-20260703 private-evidence/debug-scans
node scripts/replay_live_ocr_captured.mjs --allow-imperfect --url https://127.0.0.1:5174 --out-dir private-evidence/reports/current-replay-20260703-b --offset 67 --limit 40 private-evidence/debug-scans
node scripts/replay_live_ocr_captured.mjs --allow-imperfect --url https://127.0.0.1:5174 --out-dir private-evidence/reports/current-replay-20260703-c --offset 107 private-evidence/debug-scans
node scripts/replay_live_ocr_captured.mjs --allow-imperfect --url https://127.0.0.1:5174 --out-dir private-evidence/reports/current-replay-20260703-leading-one-review-smoke <targeted scan folders>
node --check scripts/replay_live_ocr_captured.mjs
node --check scripts/analyze_debug_scan_corpus.mjs
node --check scripts/make_debug_failure_contact_sheet.mjs
npm run build
npm run build:github
```

Results:

- Saved-output corpus summary before the new guard:
  - 115 classroom-layout scans analyzed.
  - 824 question groups with app output.
  - Answer-key correctness: `330/824` (`40.0%`).
  - Review routing: `536/824` (`65.0%`).
  - Auto-graded: `288/824` (`35.0%`).
  - Auto-graded but answer-key-wrong in saved output: `0/824`. This is not the same as handwritten-truth accuracy, but it shows the public saved-output policy was conservative.
- Current-code replay across 116 processed classroom scans:
  - 814 question groups.
  - Answer-key correctness: `376/814` (`46.2%`).
  - Review routing: `505/814` (`62.0%`).
  - Auto-graded: `309/814` (`38.0%`).
  - Expected leading-`1` left slot wrong: `175/425` (`41.2%`), with `84` as `7`, `49` as `9`, and `42` other digits.
  - 17 leading-`1` mistakes were auto-graded wrong against the answer key before the guard. Some may be students' actual wrong answers, but the repeated leading-slot pattern is too risky to auto-X.
- Targeted replay after the guard:
  - Previously silent cases like `77/11`, `70/10`, and `71/11` now route to review.
  - A clean page already reading `11,12,15,15,14,16,18,17` remained `8/8` with no review.
- Visual contact sheets show many raw leading-slot crops genuinely look like roofed/slanted `1`s or `7`s. This supports a context-assisted review guard now, but not broad automatic correction yet.

Files changed:

- `src/App.vue`
- `src/components/CameraCapture.vue`
- `scripts/replay_live_ocr_captured.mjs`
- `scripts/analyze_debug_scan_corpus.mjs`
- `scripts/make_debug_failure_contact_sheet.mjs`
- `SCANGRADE_ACTIVE_HANDOFF.md`

Rollback point:

- Previous public deploy: `gh-pages-v2` at `21913d9`.
- Previous source handoff commit: `30f6337`.
- New source commit/deploy pending at the time this entry was written.

Next action:

- Commit this trust-guard patch and deploy it only if Tony wants the public scanner to prioritize fewer silent wrong Xs over fewer yellow reviews.
- Next high-leverage OCR work is a labeled handwritten-truth pass on leading `1` crops. Do not use answer-key agreement alone to claim recognition accuracy.
- After handwritten labels, consider a second-stage context-assisted rescue for truly ambiguous leading `1` vs `7/9` cases, with audit reason `context-assisted-leading-one`, but only if it preserves zero confident wrong reads on a held-out packet set.

Open risks:

- Current replay still scores against the worksheet answer key, not handwritten truth. Student math mistakes are useful app evidence and should not be counted as OCR errors when the OCR matches the handwriting.
- The new guard may increase yellow review count on some two-digit sheets. That is acceptable as a trust fix, but it does not solve the market-readiness coverage target by itself.
- Some visual-format pages remain weak due to crop/layout/format issues, not just digit classification.

## 2026-07-03 Context-Assisted Leading-One Rescue

Date / thread: 2026-07-03, SG 3.

Tony asked whether ScanGrade can cautiously use answer-key context for ambiguous leading `1` cases such as `11-19`, where the model often reads the left slot as `7` or `9`. The objective answer is yes, but only as a narrow second-stage evidence check. The app must never broadly substitute the answer key for what the student wrote.

What changed:

- Added a very narrow context-assisted rescue in `src/components/CameraCapture.vue`.
- Updated the replay harness in `scripts/replay_live_ocr_captured.mjs` with the same post-recognition policy so saved scans can be tested reproducibly.
- Updated visible build label to `2026.07.03-1534-EDT-sg3-context-leading-one`.

Policy details:

- Only applies to two-slot answer groups whose expected answer is `10-19`.
- Only changes left-slot `9 -> 1`; it does not broadly rescue `7 -> 1`.
- Requires the right slot to be stable, not reviewed, and already matching the expected right digit.
- Requires strong shape evidence that the left crop is a narrow one-stroke digit across trusted preprocessing variants, including an anchor variant such as `raw-border-slot`, `wide-slot`, `no-side-erase`, or `expected-slot`.
- Adds explicit audit fields such as `originalDigitBeforeContextAssist`, `originalConfidenceBeforeContextAssist`, `robustOverride: context-assisted-leading-one`, and `contextAssistEvidence`.
- Skips the rescue if a forced fallback review reason is already present.

Evidence and tests:

```text
node --check scripts/replay_live_ocr_captured.mjs
npm run build
npm run build:github
npm run dev -- --host 127.0.0.1
node scripts/replay_live_ocr_captured.mjs --allow-imperfect --url https://127.0.0.1:5174 --out-dir private-evidence/reports/current-replay-20260703-context-leading-one-smoke <targeted scan folders>
node scripts/replay_live_ocr_captured.mjs --allow-imperfect --url https://127.0.0.1:5174 --out-dir private-evidence/reports/current-replay-20260703-context-leading-one-a --limit 50 private-evidence/debug-scans
node scripts/replay_live_ocr_captured.mjs --allow-imperfect --url https://127.0.0.1:5174 --out-dir private-evidence/reports/current-replay-20260703-context-leading-one-b --offset 50 --limit 50 private-evidence/debug-scans
node scripts/replay_live_ocr_captured.mjs --allow-imperfect --url https://127.0.0.1:5174 --out-dir private-evidence/reports/current-replay-20260703-context-leading-one-c --offset 100 private-evidence/debug-scans
```

Replay results on the current classroom debug slice:

- Processed replay result files: 106 captures.
- Guard-rejected captures: 20.
- All captures: `703/1284` digit cells matched the answer key (`54.75%`), `356/744` question groups matched the answer key (`47.85%`), review routing was `460/744` groups (`61.83%`), and auto-graded groups were `284/744` (`38.17%`).
- Accepted captures only: `564/960` digit cells matched the answer key (`58.75%`), `310/582` question groups matched the answer key (`53.26%`), review routing was `298/582` groups (`51.20%`), and auto-graded groups were `284/582` (`48.80%`).
- Context-assisted leading-one rescue fired only 5 times across all 106 captures, and only 3 times on accepted captures.
- Auto-graded answer-key-wrong groups remained 29 in this replay slice. This metric is still answer-key based, not handwritten-truth based.

Interpretation:

- This is a safe trust-preserving improvement, not the big jump to market-ready reliability.
- The policy proves that answer-key context can be used responsibly when it acts as a tiebreaker supported by crop/shape evidence.
- It should not be expanded until there is handwritten-truth labeling and a held-out packet set, because broad context correction would risk grading what the answer should have been instead of what the student wrote.

Next action:

- If Tony wants this behavior live, commit and deploy the source changes only; do not commit `private-evidence/`.
- The next major reliability move is still labeled handwritten-truth evaluation plus crop/layout work on left-slot and visual-format failures. Context rescue can help at the margin, but it cannot replace improving recognition and crop quality.

## 2026-07-03 Flexible Duplicate One-Digit Slot Cleanup

Date / thread: 2026-07-03, SG 3.

What changed:

- Found that the previous quick replay aggregation overcounted "silent wrong" groups because it compared displayed slot text like `5_` vs `_5` instead of the saved question-level `correct` flag.
- Re-audited accepted captures using the actual rule: `correct === false` and `review === false`.
- Found 11 true accepted silent-wrong groups before this patch.
- Patched the optional one-digit blank cleanup so a two-slot one-digit answer such as `7` can collapse a duplicate weak/artifact slot from `77` to `7_` when one slot is strong and the other slot is artifact-like. Previously, the cleanup skipped this case when the weak slot had the same expected digit.
- Marked the surviving flexible one-digit slot and the blanked optional slot as slot-correct after the cleanup, so the detailed result grid does not show a correct one-digit answer with a red slot just because the student used the left answer box.
- Updated replay JSON writing so `optionalSingleDigitBlankOverrides` and `contextAssistedLeadingOneRescues` are persisted in `*-replay-result.json`.
- Updated visible build label to `2026.07.03-1617-EDT-sg3-flex-duplicate-one-digit`.

Evidence and tests:

```text
node --check scripts/replay_live_ocr_captured.mjs
npm run dev -- --host 127.0.0.1
targeted replay on 2026-06-20_00-50-07-020-sg-g1-lw-05-mixed-20-0d61fd7c
replay chunks:
  private-evidence/reports/current-replay-20260703-flex-duplicate-a
  private-evidence/reports/current-replay-20260703-flex-duplicate-b
  private-evidence/reports/current-replay-20260703-flex-duplicate-c
npm run build
npm run build:github
```

Replay result:

- Targeted case improved from group B `77/_7` silent wrong to `7_/_7` correct.
- Accepted capture slice before patch: 86 captures, 582 groups, 310 question-correct (`53.26%`), 298 review groups (`51.20%`), 284 auto groups, 11 silent-wrong groups (`3.87%` of auto groups).
- Accepted capture slice after patch: 86 captures, 582 groups, 313 question-correct (`53.78%`), 296 review groups (`50.86%`), 286 auto groups, 10 silent-wrong groups (`3.50%` of auto groups).
- Several remaining silent-wrong examples were visually inspected and appear to be real student mistakes, not OCR errors:
  - `sg-g1-lw-10` question B: student wrote `41` for "after 39"; app correctly auto-Xs.
  - `sg-g1-lw-04` question B: student wrote `17` for `19 - 4`; app correctly auto-Xs.
  - `sg-g1-lw-06` question A: student wrote `5` for a ten-frame count of `6`; app correctly auto-Xs.

Interpretation:

- This is a small but clean reliability improvement. It improves one recurring flexible-slot failure without loosening global confidence.
- The remaining auto-wrong set should not be blindly suppressed; many are exactly the kind of real wrong student answers ScanGrade must confidently mark.

Next action:

- Continue separating true OCR errors from authentic student mistakes before making additional trust-policy changes.
- Next likely high-leverage work is a handwritten-truth labeling pass for the accepted silent-wrong list and the high-review visual pages, then crop/layout improvements for ten-frame, dot-collection, number-pattern, and number-bond formats.

## 2026-07-03 Handwritten Truth Pass

Date / thread: 2026-07-03, SG 3.

Tony asked for handwritten truth by page/question so app reliability can be measured against what students actually wrote, not only the answer key.

What changed:

- Added `scripts/create_handwritten_truth_label_pack.mjs`.
  - Builds per-answer truth-label records from saved debug/replay evidence.
  - Supports accepted-only exports, needs-label-only contact sheets, page offsets, and stable `uid` values such as `41.3`.
  - Uses stitched raw digit crops for contact sheets because warped-page crops were unreliable on some non-row layouts.
- Added `scripts/summarize_handwritten_truth.mjs`.
  - Merges seeded labels and manual visual overrides.
  - Writes `handwritten-truth-labelled.json`.
  - Reports OCR correctness against handwriting truth, yellow leaning correctness, student math correctness, and layout-level breakdowns.
- Created private manual labels at `private-evidence/truth-labels/20260703-flex-duplicate-accepted-needs-label/manual-truth-overrides.json`.
- Generated merged private truth data at `private-evidence/truth-labels/20260703-flex-duplicate-accepted-needs-label/handwritten-truth-labelled.json`.
- Generated per-page private truth rollups at `private-evidence/truth-labels/20260703-flex-duplicate-accepted-needs-label/handwritten-truth-labelled-pages.json` and `private-evidence/truth-labels/20260703-flex-duplicate-accepted-needs-label/handwritten-truth-labelled-pages.csv`.
- Do not commit `private-evidence/`.

Verification:

```text
node --check scripts/create_handwritten_truth_label_pack.mjs
node --check scripts/summarize_handwritten_truth.mjs
node scripts/create_handwritten_truth_label_pack.mjs --accepted-only --needs-label-only --out-dir private-evidence/truth-labels/20260703-flex-duplicate-accepted-needs-label
node scripts/summarize_handwritten_truth.mjs
```

Truth-labelled accepted scan summary:

- Accepted captures: 86.
- Accepted answer groups: 582.
- Handwritten truth coverage: 582/582, with 276 seeded labels, 302 manual value labels, 4 blanks, 0 unclear, 0 missing.
- Auto/confident reads against handwriting truth: 284/286 correct = 99.3%.
- Confidently wrong OCR reads against handwriting truth: 2/286.
- Yellow/manual-review groups: 296/582 = 50.9%.
- Yellow groups where the app's leaning value matched handwriting truth: 55/296 = 18.6%.
- Overall displayed app read, counting yellow leaning values: 339/582 = 58.2%.
- Student math correctness against answer key: 505/582 = 86.8%.

Layout breakdown from the truth pass:

```text
sg-g1-lw-01-add-1digit: total 80, auto 62/62 correct, yellow 18, yellow leaning correct 3
sg-g1-lw-02-add-2digit: total 32, auto 18/18 correct, yellow 14, yellow leaning correct 2
sg-g1-lw-03-sub-1digit: total 80, auto 54/56 correct, yellow 24, yellow leaning correct 9
sg-g1-lw-04-sub-2digit: total 40, auto 26/26 correct, yellow 14, yellow leaning correct 6
sg-g1-lw-05-mixed-20: total 32, auto 16/16 correct, yellow 16, yellow leaning correct 4
sg-g1-lw-06-ten-frames: total 72, auto 23/23 correct, yellow 49, yellow leaning correct 6
sg-g1-lw-07-dot-collections: total 72, auto 21/21 correct, yellow 51, yellow leaning correct 9
sg-g1-lw-08-number-bonds: total 66, auto 19/19 correct, yellow 47, yellow leaning correct 4
sg-g1-lw-09-number-patterns: total 54, auto 15/15 correct, yellow 39, yellow leaning correct 11
sg-g1-lw-10-place-value-50: total 54, auto 30/30 correct, yellow 24, yellow leaning correct 1
```

Only two confident OCR errors remained in accepted scans:

```text
44.7 sg-g1-lw-03-sub-1digit: expected 5, handwritten truth 10, app read 6
52.6 sg-g1-lw-03-sub-1digit: expected 8, handwritten truth 8, app read 6
```

Interpretation:

- The trust policy is much better than answer-key-only scoring implied. Many previous "auto wrong" examples were real student math mistakes, not OCR mistakes.
- The app is still not market-ready because only 286/582 accepted answer groups are auto/confident. The rest require review.
- The yellow bucket is not merely under-confident correct reads: only 18.6% of yellow leaning values matched handwriting truth.
- The next high-leverage move is crop/layout geometry for non-row formats, especially number bonds and other visual layouts, before loosening confidence. Several number-bond crops visually grab nearby labels/borders/adjacent regions even though the full warped sheet clearly shows the handwritten answer.

Next action:

1. Fix and replay non-row layout crop geometry, starting with `sg-g1-lw-08-number-bonds`, then ten frames, dot collections, and number patterns.
2. Re-run `scripts/summarize_handwritten_truth.mjs` after each crop/layout change.
3. Only consider confidence loosening after yellow leaning correctness improves substantially on the truth-labelled set.

## 2026-07-04 Future Layout Contract + Non-Row Reliability Pass

Date / thread: 2026-07-04, SG 3.

Tony clarified that the goal is not to overfit ScanGrade to the current Grade 1 packet. The app needs a structure where future worksheet variations can perform just as well.

What changed:

- Added `docs/SCANGRADE_LAYOUT_CONTRACT.md`.
  - Core rule: worksheet concepts can vary widely, but graded answer regions must be boring, explicit, and declared in layout JSON.
  - Future layouts must define `digit_box_ids`, slot count, guide/divider metadata, canonical digits, and accepted digit placements.
  - Visual worksheet variety belongs in prompts, diagrams, and work space; the answer box is the machine-readable handshake.
  - Three-, four-, and five-digit answer layouts are possible in principle but are not market-ready until they have their own replay evidence.
- Added `scripts/audit_layout_answer_regions.mjs` and `npm run audit:layouts`.
  - Audits layout metadata, question groups, slot counts, box geometry, accepted responses, mixed slot counts, and unvalidated 3+ slot layouts.
  - This is the first guardrail against future worksheet designs drifting into scanner-hostile answer regions.
- Added `scripts/analyze_leading_one_context_policy.mjs` and `npm run analyze:leading-one-context`.
  - Tests whether answer-key context can safely rescue ambiguous leading `1` reads.
  - Result: broad expected-leading-`1` correction is unsafe because it would override real student-written wrong answers.
- Made one tiny evidence-backed OCR policy adjustment:
  - In `src/components/CameraCapture.vue` and `scripts/replay_live_ocr_captured.mjs`, the strict context-assisted leading-one stroke-width guard now accepts `inkW <= 6` instead of `inkW <= 5`.
  - This only fires inside the existing narrow `9 -> 1` rescue where the expected answer starts with `1`, the right slot is stable and matching, and the crop shape looks like a one-stroke digit across trusted variants.

Evidence used:

- Handwritten-truth set:
  - `private-evidence/truth-labels/20260703-flex-duplicate-accepted-needs-label/handwritten-truth-labelled.json`
- Replay chunks:
  - `private-evidence/reports/current-replay-20260704-general-policy-inkw6-a`
  - `private-evidence/reports/current-replay-20260704-general-policy-inkw6-b`
  - `private-evidence/reports/current-replay-20260704-general-policy-inkw6-c`
- Score report:
  - `private-evidence/reports/truth-score-20260704-general-policy-inkw6-abc.json`
- Leading-one policy report:
  - `private-evidence/reports/leading-one-context-policy-20260704-inkw6-current.json`

Commands run:

```text
node --check scripts/audit_layout_answer_regions.mjs
npm run audit:layouts
node --check scripts/analyze_leading_one_context_policy.mjs
node scripts/analyze_leading_one_context_policy.mjs --out private-evidence/reports/leading-one-context-policy-20260704-inkw6-current.json
node --check scripts/replay_live_ocr_captured.mjs
node scripts/replay_live_ocr_captured.mjs --allow-imperfect --url https://127.0.0.1:5174 --out-dir private-evidence/reports/current-replay-20260704-general-policy-inkw6-a --offset 0 --limit 45 private-evidence/debug-scans
node scripts/replay_live_ocr_captured.mjs --allow-imperfect --url https://127.0.0.1:5174 --out-dir private-evidence/reports/current-replay-20260704-general-policy-inkw6-b --offset 45 --limit 45 private-evidence/debug-scans
node scripts/replay_live_ocr_captured.mjs --allow-imperfect --url https://127.0.0.1:5174 --out-dir private-evidence/reports/current-replay-20260704-general-policy-inkw6-c --offset 90 --limit 45 private-evidence/debug-scans
node scripts/score_replay_against_handwritten_truth.mjs --out private-evidence/reports/truth-score-20260704-general-policy-inkw6-abc.json private-evidence/reports/current-replay-20260704-general-policy-inkw6-a private-evidence/reports/current-replay-20260704-general-policy-inkw6-b private-evidence/reports/current-replay-20260704-general-policy-inkw6-c
npm run build
```

Results:

- Layout audit: 33 layouts audited, 0 errors, 63 warnings.
  - Warnings are useful future-work signals, especially mixed slot counts and unvalidated 3-slot layouts.
- Broad answer-key/context correction for leading `1` is not safe:
  - 34 candidate cases where the answer key expected a leading `1`.
  - 30 would match handwritten truth, but 4 were real student-written wrong answers and would become confident wrongs if auto-corrected.
  - Therefore ScanGrade should keep answer-key context as a narrow, shape-supported tiebreaker only.
- Current replay against handwritten truth after the tiny `inkW <= 6` adjustment:
  - Accepted answer groups: 582.
  - Confident auto reads: 289/582 (`49.7%`).
  - Confident correct OCR reads: 287.
  - Confident wrong OCR reads: 2.
  - Confident OCR accuracy: 287/289 (`99.3%`).
  - Yellow/manual-review groups: 293/582 (`50.3%`).
- By broad format:
  - Row sheets: 178/264 confident, 176 correct, 2 wrong.
  - Non-row sheets: 111/318 confident, 111 correct, 0 wrong.
- Compared with the prior general policy replay, this gained 1 safe non-row confident read and introduced no new confident wrong reads.

Interpretation:

- The app remains trust-oriented but too conservative for broad market readiness.
- Non-row formats are now safe but under-confident: 0 confident wrong reads, but only 34.9% confident coverage.
- The next big improvement should come from answer-region/layout/crop consistency and model training/holdout discipline, not broad answer-key correction.
- For future worksheets, the design principle is now formal: keep the math format flexible, but make answer regions standardized, declared, auditable, and replay-proven before shipping.

Files changed:

- `docs/SCANGRADE_LAYOUT_CONTRACT.md`
- `scripts/audit_layout_answer_regions.mjs`
- `scripts/analyze_leading_one_context_policy.mjs`
- `package.json`
- `src/components/CameraCapture.vue`
- `scripts/replay_live_ocr_captured.mjs`
- `SCANGRADE_ACTIVE_HANDOFF.md`
- `mission-control/state/mission-state.json`

Rollback point:

- No commit created yet in this entry.
- The code change is intentionally tiny: revert the `inkW <= 6` threshold back to `inkW <= 5` in both production and replay if needed.

Next action:

1. Treat `docs/SCANGRADE_LAYOUT_CONTRACT.md` plus `npm run audit:layouts` as the required gate for new worksheet packets.
2. Fix the two remaining confident OCR errors only if a reproducible, truth-scored guard improves reliability without suppressing real student mistakes.
3. Improve non-row confidence by making generated worksheet answer regions more uniform and by replaying against handwritten truth after each layout/crop/model change.
4. Do not expand context-assisted correction beyond the current narrow policy until a held-out handwritten-truth set proves it does not create confident wrong reads.

Open risks:

- Current broader classroom packet performance is still about 50% confident coverage overall, far below the 90-95% product goal.
- Visual/non-row formats are especially low-confidence even when safe.
- The layout audit can prevent many future design mistakes, but it does not prove OCR quality by itself; replay against real handwriting remains required.
- The repo has many pre-existing dirty/untracked files from earlier SG work. Do not revert them casually.

## 2026-07-04 Answer Box Candidate #1 Bakeoff Harness

Date / thread: 2026-07-04, SG 3.

Tony chose answer-box candidate #1: separate digit cells. The question is whether we should push hard on the current joined/open-divider format for summer work or shift the future ScanGrade standard toward separate cells before September testing.

What changed:

- Added `scripts/run_answer_box_bakeoff_synthetic.mjs`.
  - It builds a synthetic-authentic comparison using real labelled student handwriting crops from `private-evidence/truth-labels/20260703-flex-duplicate-accepted-needs-label/handwritten-truth-labelled.json`.
  - It places the same extracted handwriting masks into two candidate box designs:
    - `joined-open-divider` = current-ish joined answer box with an open divider.
    - `separate-cells` = Tony's preferred candidate #1.
  - It writes a layout JSON per generated page and, when browser scoring is allowed, runs those pages through the real local ScanGrade homography/OCR pipeline.
  - It measures filled-slot digit accuracy, review/disagreement signals, and blank-slot cleanliness.
- Added `npm run bakeoff:answer-boxes`.
- Added `--generate-only` to the bakeoff script so fixture generation and visual QA can run without Playwright.
- Added static fixture audit and a no-browser fixture contact sheet:
  - `static-audit.json`
  - `fixture-contact-sheet.png`
- Tightened the bakeoff fixture generator after visual QA:
  - Adaptive thresholding and small-component cleanup reduce gray worksheet-background contamination in extracted handwriting masks.
  - Synthetic prompt text was removed from near answer boxes so the bakeoff measures answer-region geometry rather than prompt overlap.
  - A right-column prompt-bubble bug was fixed after it visibly landed inside left-column answer boxes.
- Added `docs/SCANGRADE_SEPARATE_CELL_MIGRATION_PLAN.md`.
  - This is a draft implementation/validation path for adopting separate cells if the bakeoff supports it.
  - It explicitly requires backward compatibility for existing joined/open-divider QR worksheets.

Generated evidence:

- Smoke fixtures:
  - `private-evidence/reports/answer-box-bakeoff-synthetic-20260704-smoke`
  - 4 generated pages: 2 joined/open-divider and 2 separate-cells.
- Full fixture set:
  - `private-evidence/reports/answer-box-bakeoff-synthetic-20260704`
  - 24 generated pages total.
  - 12 `joined-open-divider` pages.
  - 12 `separate-cells` pages.
  - 120 unique real student handwriting samples, reused across both designs.
  - Static audit: passed with 0 errors and 0 warnings.
  - Fixture contact sheet: `private-evidence/reports/answer-box-bakeoff-synthetic-20260704/fixture-contact-sheet.png`

Commands run:

```text
node --check scripts/run_answer_box_bakeoff_synthetic.mjs
npm run bakeoff:answer-boxes -- --limit 20 --out-dir private-evidence/reports/answer-box-bakeoff-synthetic-20260704-smoke --generate-only
npm run bakeoff:answer-boxes -- --out-dir private-evidence/reports/answer-box-bakeoff-synthetic-20260704 --generate-only
node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('package.json ok')"
node -e "JSON.parse(require('fs').readFileSync('mission-control/state/mission-state.json','utf8')); console.log('mission-state ok')"
node --check scripts/run_answer_box_bakeoff_synthetic.mjs
node -e "JSON.parse(require('fs').readFileSync('private-evidence/reports/answer-box-bakeoff-synthetic-20260704/static-audit.json','utf8')); console.log('static audit json ok')"
```

Browser scoring command:

```text
npm run bakeoff:answer-boxes -- --limit 20 --out-dir private-evidence/reports/answer-box-bakeoff-synthetic-20260704-smoke --url https://127.0.0.1:5174
```

Result:

- The first browser smoke attempt failed because sandboxed Playwright could not launch Chromium.
- The required unsandboxed rerun was auto-rejected by Codex because the workspace had hit a temporary usage limit until 12:18 PM EDT.
- Later, after the gate cleared, a fresh Vite server was started and the full bakeoff was scored successfully.

Scored command:

```text
npm run bakeoff:answer-boxes -- --out-dir private-evidence/reports/answer-box-bakeoff-synthetic-20260704 --url https://127.0.0.1:5174
```

Scored results:

- Report: `private-evidence/reports/answer-box-bakeoff-synthetic-20260704/summary.json`
- Model/scoring contact sheet: `private-evidence/reports/answer-box-bakeoff-synthetic-20260704/contact-sheet.png`
- Joined/open-divider:
  - Filled digit accuracy: 129/186 (`69.4%`)
  - Exact question accuracy: 68/120 (`56.7%`)
  - Blank-slot cleanliness: 54/54 (`100%`)
  - Preprocess review flags on filled slots: 32
- Separate cells:
  - Filled digit accuracy: 131/186 (`70.4%`)
  - Exact question accuracy: 70/120 (`58.3%`)
  - Blank-slot cleanliness: 54/54 (`100%`)
  - Preprocess review flags on filled slots: 28
- Paired filled-slot comparison:
  - Both correct: 121
  - Separate-cell only correct: 10
  - Joined/open-divider only correct: 8
  - Neither correct: 47

Next action:

1. Treat separate cells as a modestly supported future direction, not a breakthrough.
2. Do not change the public QR worksheet format yet.
3. If Tony approves, update `docs/SCANGRADE_LAYOUT_CONTRACT.md` to include separate cells as the preferred future answer-region style.
4. The next major reliability work should focus on digit-model robustness and teacher-review ergonomics, not just answer-box geometry.
5. Preserve fresh September classroom work as the real validation gate.

Important interpretation guard:

- This bakeoff cannot prove real printed-sheet performance because it uses real handwriting masks placed synthetically into boxes.
- It is still useful because it isolates answer-box geometry from student handwriting variation.
- The September classroom test remains the real validation gate.
- The result says separate cells help slightly; it does not say separate cells alone get ScanGrade to 90-95% confident coverage.

## 2026-07-05 Accuracy Roadmap After Answer-Box Bakeoff

Date / thread:

- 2026-07-05, SG 3.

What changed:

- Tony decided to keep the current sheet and answer-box design for now because the synthetic answer-box bakeoff was practically identical between joined/open-divider and separate-cell designs.
- The next reliability track is digit recognition and confidence policy, not more visible worksheet redesign.
- Added roadmap: `docs/SCANGRADE_ACCURACY_ROADMAP_20260705.md`.

Evidence used:

- Handwritten-truth score report: `private-evidence/reports/truth-score-20260704-general-policy-inkw6-abc.json`
- Digit failure report: `private-evidence/reports/digit-failure-dataset-20260705-current/summary.json`
- Existing model comparison report: `private-evidence/reports/digit-failure-dataset-20260705-current/model-eval-summary.json`
- Digit dataset: `datasets/handwritten_truth_digits_current/`

Commands run:

```text
npm run dataset:handwritten-truth-digits
.venv/bin/python3.13 scripts/eval_handwritten_truth_digit_models.py
```

Results:

- Answer-level current baseline against handwritten truth:
  - 582 labelled answers.
  - 289 auto/confident.
  - 287 auto-correct.
  - 2 auto-wrong.
  - 293 yellow/manual-review.
  - 49.7% auto coverage.
  - 99.3% auto accuracy.
- Digit-slot current baseline:
  - 960 slot rows.
  - 865 filled slots.
  - 74.1% current filled-digit accuracy.
  - 83.5% row-sheet filled-digit accuracy.
  - 67.6% non-row filled-digit accuracy.
  - 67.9% blank-slot policy accuracy.
- Weakest layouts:
  - Number bonds: 47.7%.
  - Dot collections: 67.9%.
  - Number patterns: 69.5%.
  - Ten frames: 71.7%, with weak blank-slot handling.
- Biggest digit confusions:
  - `1 -> 7`: 48 cases.
  - `1 -> 9`: 18 cases.
  - `6 -> 5`: 11 cases.
  - `9 -> 2`: 10 cases.
- Existing old ONNX swaps are not enough:
  - Best standalone tested policy reached 72.8% on the clean subset.
  - The current integrated selector was about 73.6% on the same subset.
  - Conclusion: do not just swap to an older model. Build a ScanGrade-specific fine-tune and/or selector.
- Variant opportunity:
  - 104 currently-wrong filled digit slots already had the handwritten-truth digit in one of the app's preprocessing variants.
  - This makes a learned preprocessing/model selector the highest-leverage track.
- Scratch training warning:
  - A scratch CNN attempt overfit the small classroom set. Training accuracy climbed while validation stayed weak.
  - Use a compatible checkpoint plus external data and validation/holdout gates instead.
- Context warning:
  - Broad answer-key-based leading-`1` overrides are unsafe because students genuinely wrote wrong answers.
  - Context should start as a teacher-review suggestion, then only become auto-clear if validation/holdout prove it keeps confident wrong at zero.

Files changed:

```text
scripts/build_handwritten_truth_digit_dataset.mjs
scripts/eval_handwritten_truth_digit_models.py
package.json
docs/SCANGRADE_ACCURACY_ROADMAP_20260705.md
SCANGRADE_ACTIVE_HANDOFF.md
```

Rollback point:

- No rollback commit yet in this entry.
- The repo was already dirty with many SG 3 files before this work. Do not revert unrelated changes.

Next action:

1. Freeze the current evidence baseline.
2. Run compatible `ScanGradeDigitCNN` fine-tunes from `models/worksheet-digit-tony-generalist-aug-strong-20260601.pt` using `datasets/handwritten_truth_digits_current/train` as extra labelled raw data.
3. Evaluate candidate models against validation and holdout digit slots before app integration.
4. Build an offline variant-selector search using model confidences, top gaps, quality metrics, layout family, slot side, and review reason.
5. Replay the best candidate at answer level and require no increase in confident wrong answers before any public deploy.

Open risks:

- The current classroom corpus is valuable but limited. Preserve validation/holdout discipline so summer improvements do not overfit Tony's current students.
- Non-row layouts may need invisible crop/preprocessing improvements even if the printed sheet design stays fixed.
- The September classroom test remains the real product proof.

2026-07-05 follow-up smoke tests:

- Ran a private compatible fine-tune smoke test from `models/worksheet-digit-tony-generalist-aug-strong-20260601.pt`.
- Output stayed private under `private-evidence/model-candidates/sg3-20260705-finetune-smoke/`.
- Training command:

```text
.venv/bin/python3.13 scripts/train_generalized_digit_model.py --epochs 8 --batch-size 256 --external-per-digit 500 --worksheet-repeat 10 --extra-labeled-raw datasets/handwritten_truth_digits_current/train --extra-labeled-raw-repeat 8 --init-checkpoint models/worksheet-digit-tony-generalist-aug-strong-20260601.pt --onnx-out private-evidence/model-candidates/sg3-20260705-finetune-smoke/worksheet-digit-sg3-finetune-smoke.onnx --checkpoint-out private-evidence/model-candidates/sg3-20260705-finetune-smoke/worksheet-digit-sg3-finetune-smoke.pt --metadata-out private-evidence/model-candidates/sg3-20260705-finetune-smoke/metadata.json
```

- Smoke model result:
  - Exported successfully.
  - Same handwritten-truth digit evaluator: best-confidence `594/848` (`70.0%`).
  - This is worse than the best existing standalone model/policy (`617/848`, `72.8%`) and worse than the current integrated selector (`624/848`, about `73.6%`).
  - Do not deploy this smoke model.
- Fixed variant selector smoke test:
  - Trained simple per-layout/per-slot variant choices on calibration using existing `correctVariantNames`.
  - Calibration improved slightly: current `435/595` (`73.1%`) -> selector `446/595` (`75.0%`).
  - Validation got worse: current `114/150` (`76.0%`) -> selector `110/150` (`73.3%`).
  - Holdout got worse: current `75/103` (`72.8%`) -> selector `72/103` (`69.9%`).
  - Conclusion: hard-coded fixed variant preferences overfit. If using variants, build a per-item selector from confidence/quality features rather than layout-only rules.
- Leading-`1` context smoke:
  - Among labelled slot cases where the expected digit slot was `1` and the app read `7` or `9`, `64/66` were truly `1`, but `2/66` were real student-written wrong digits.
  - Conclusion: leading-`1` context is promising for teacher-review suggestions and possibly narrow auto-clear later, but broad auto-correction would create confident wrong reads.

Updated next action:

1. Keep the current public model/policy in place.
2. Build a proper per-item selector evaluation, not fixed per-layout variant rules.
3. Add context-assisted "likely 1" teacher-review suggestions before any auto-correction.
4. If model fine-tuning continues, use longer controlled runs plus validation/holdout evaluation; do not treat this smoke run as a deploy candidate.

2026-07-05 continuation: per-item selector and blank-policy experiments:

What changed:

- Added `scripts/eval_digit_variant_selector.py`.
  - Trains a logistic per-candidate selector on calibration rows.
  - Uses confidence, top-gap, vote share, tensor-quality features, family, slot side, variant name, candidate digit, and review reason.
  - Supports no-key, answer-key-context, layout-feature, and answer-key-plus-layout modes.
  - Tunes gated switching on validation and reports holdout separately.
- Added `scripts/eval_flexible_blank_policy.mjs`.
  - Mirrors the app's tensor quality checks.
  - Evaluates whether a generalized "one real digit plus artifact slot" cleanup can safely blank companion slots in two-slot boxes.
- Added package scripts:
  - `npm run eval:digit-selector`
  - `npm run eval:flexible-blank-policy`

Evidence used:

- `private-evidence/reports/digit-failure-dataset-20260705-current/digit-rows.json`
- Saved replay files and debug tensors referenced by those rows.

Commands run:

```text
npm run eval:digit-selector -- --out private-evidence/reports/digit-variant-selector-20260705/no-key/summary.json
npm run eval:digit-selector -- --use-answer-key-context --out private-evidence/reports/digit-variant-selector-20260705/answer-key-context/summary.json
npm run eval:digit-selector -- --layout-features --out private-evidence/reports/digit-variant-selector-20260705/layout-features/summary.json
npm run eval:digit-selector -- --use-answer-key-context --layout-features --out private-evidence/reports/digit-variant-selector-20260705/answer-key-layout/summary.json
npm run eval:flexible-blank-policy -- --out private-evidence/reports/flexible-blank-policy-20260705/summary.json
node --check scripts/eval_flexible_blank_policy.mjs
PYTHONPYCACHEPREFIX=/tmp/sg-pycache python3 -m py_compile scripts/eval_digit_variant_selector.py
```

Results:

- No-answer-key per-item selector:
  - Validation baseline stayed unchanged: current `95/126` (`75.4%`), selector `95/126` (`75.4%`).
  - Holdout improved only one digit slot in pure model mode: current `62/88` (`70.5%`) -> selector `63/88` (`71.6%`).
  - Gated mode chose effectively not to switch.
  - Conclusion: no-key selector is not a deployment candidate yet.
- Answer-key-context selector:
  - Validation improved: `95/126` (`75.4%`) -> `106/126` (`84.1%`).
  - Holdout improved: `62/88` (`70.5%`) -> `82/88` (`93.2%`).
  - But holdout has only two digit slots where handwritten truth differs from expected answer, so this can be inflated by "pick expected" behavior.
  - Conclusion: use this direction for teacher-review suggestions first, not automatic correction.
- Generalized flexible blank cleanup:
  - Current-style broad candidate logic would blank many real filled slots if generalized.
  - Strict generalized rule fixed 4 true blank slots but still false-blanked 2 real filled slots.
  - Conclusion: do not deploy broad blank cleanup. Keep the existing narrow optional-blank policy and treat broader cleanup as a review suggestion unless a safer rule is proven.

Files changed:

```text
scripts/eval_digit_variant_selector.py
scripts/eval_flexible_blank_policy.mjs
package.json
docs/SCANGRADE_ACCURACY_ROADMAP_20260705.md
SCANGRADE_ACTIVE_HANDOFF.md
```

Next action:

1. Implement answer-key-aware OCR suggestions in teacher review/debug output only, not auto-grading.
2. Start a multi-model/no-key ensemble experiment, because single-model no-key variant selection is too weak.
3. Separately diagnose crop/preprocessing for ten frames and number bonds, where current model/selector changes are least reliable.

Open risk:

- The current validation/holdout splits are small. A result that improves holdout by a few slots is not enough for public deployment unless it also preserves confident-wrong safety at answer level.

2026-07-05 continuation: multi-model ensemble experiment:

What changed:

- Added `scripts/eval_digit_model_ensemble.py`.
  - Evaluates current app digit candidates plus candidates from 10 existing ONNX worksheet digit models.
  - Uses the same frozen handwritten-truth digit rows and calibration/validation/holdout splits.
  - Supports no-key, layout-feature, answer-key-context, and answer-key-plus-layout modes.
  - Reports current baseline, best-confidence, majority vote, model selector, gated selector, and safety-gated selector.
- Added package script:
  - `npm run eval:digit-ensemble`
- Updated `docs/SCANGRADE_ACCURACY_ROADMAP_20260705.md` with the ensemble results and next-step plan.

Evidence used:

- `private-evidence/reports/digit-failure-dataset-20260705-current/digit-rows.json`
- Debug tensors and replay files referenced by those rows.

Commands run:

```text
PYTHONPYCACHEPREFIX=/tmp/sg-pycache python3 -m py_compile scripts/eval_digit_model_ensemble.py
.venv/bin/python3.13 -m json.tool package.json
npm run eval:digit-ensemble -- --out private-evidence/reports/digit-model-ensemble-20260705/no-key/summary.json
npm run eval:digit-ensemble -- --use-answer-key-context --out private-evidence/reports/digit-model-ensemble-20260705/answer-key-context/summary.json
npm run eval:digit-ensemble -- --layout-features --out private-evidence/reports/digit-model-ensemble-20260705/layout-features/summary.json
npm run eval:digit-ensemble -- --use-answer-key-context --layout-features --out private-evidence/reports/digit-model-ensemble-20260705/answer-key-layout/summary.json
```

Results:

- No-answer-key ensemble:
  - Evaluated 848 filled labelled digit slots through 10 existing ONNX worksheet digit models.
  - Holdout current baseline: `75/103` (`72.8%`).
  - Holdout oracle across model/variant candidates: `98/103` (`95.1%`).
  - Holdout pure model selector: `81/103` (`78.6%`).
  - Holdout gated selector: `78/103` (`75.7%`), with 3 rescues and 0 harms.
  - Validation gated selector: `114/150` (`76.0%`) -> `118/150` (`78.7%`), with 4 rescues and 0 harms.
  - Layout features did not materially improve or degrade this, which suggests the no-key result is not just layout memorization.
- Answer-key-context ensemble:
  - Holdout pure selector reached the oracle: `98/103` (`95.1%`), but this is not safe auto-deploy evidence because answer-key context can mask real student-written wrong answers.
  - Safety-gated answer-key-plus-layout reached `93/103` (`90.3%`) on holdout with 18 rescues and 0 harms; validation reached `122/150` (`81.3%`) with 8 rescues and 0 harms.
  - Conclusion: this is a strong teacher-review suggestion candidate, not a silent auto-correction policy.

Files changed:

```text
scripts/eval_digit_model_ensemble.py
package.json
docs/SCANGRADE_ACCURACY_ROADMAP_20260705.md
SCANGRADE_ACTIVE_HANDOFF.md
```

Next action:

1. Build an answer-level replay evaluator for ensemble candidates so digit-slot improvements are converted into the product metrics Tony cares about: confident answer coverage, confident wrong count, and yellow review count.
2. Do not deploy the answer-key-context selector as auto-grading. Promote it first as teacher-review "likely read" suggestions.
3. If the no-key gated ensemble improves answer-level replay without adding confident wrong reads, integrate it behind an internal/debug flag before any public build.

Open risk:

- The no-key ensemble gain is real but modest. The answer-key-context gain is large but could over-trust the expected answer. The next proof must be answer-level and must keep handwritten-truth scoring separate from math-answer-key correctness.

2026-07-05 continuation: answer-level ensemble proof:

What changed:

- Added `scripts/eval_digit_ensemble_answer_level.py`.
  - Converts digit-level ensemble choices into whole-answer product metrics.
  - Scores against handwritten truth, not answer-key correctness.
  - Keeps current review/yellow status unchanged for candidate strategies so suggestions can be evaluated separately from auto-grading.
- Added package script:
  - `npm run eval:digit-ensemble-answers`
- Updated `docs/SCANGRADE_ACCURACY_ROADMAP_20260705.md`.

Commands run:

```text
PYTHONPYCACHEPREFIX=/tmp/sg-pycache python3 -m py_compile scripts/eval_digit_ensemble_answer_level.py scripts/eval_digit_model_ensemble.py scripts/eval_digit_variant_selector.py scripts/eval_handwritten_truth_digit_models.py
.venv/bin/python3.13 -m json.tool package.json
npm run eval:digit-ensemble-answers
.venv/bin/python3.13 scripts/eval_digit_ensemble_answer_level.py --layout-features --out private-evidence/reports/digit-ensemble-answer-level-20260705/no-key-layout/summary.json
.venv/bin/python3.13 scripts/eval_digit_ensemble_answer_level.py --use-answer-key-context --out private-evidence/reports/digit-ensemble-answer-level-20260705/answer-key/summary.json
.venv/bin/python3.13 scripts/eval_digit_ensemble_answer_level.py --use-answer-key-context --layout-features --out private-evidence/reports/digit-ensemble-answer-level-20260705/answer-key-layout/summary.json
```

Private reports:

```text
private-evidence/reports/digit-ensemble-answer-level-20260705/no-key/summary.json
private-evidence/reports/digit-ensemble-answer-level-20260705/no-key-layout/summary.json
private-evidence/reports/digit-ensemble-answer-level-20260705/answer-key/summary.json
private-evidence/reports/digit-ensemble-answer-level-20260705/answer-key-layout/summary.json
```

Results:

- Current answer-level baseline:
  - Whole-answer read matches handwritten truth: `342/582` (`58.8%`).
  - Auto/confident answers: `289/582` (`49.7%`).
  - Auto-correct against handwritten truth: `287/289` (`99.3%`).
  - Auto-wrong against handwritten truth: `2/289`.
  - Yellow/manual-review answers: `293/582`.
  - Yellow current read already matches handwritten truth: `55/293` (`18.8%`).
- No-answer-key safety-gated ensemble:
  - Whole-answer read: `354/582` (`60.8%`).
  - Yellow suggestions rescued: 13.
  - It harmed 1 currently-correct auto answer, so it is not production-safe as an automatic recognizer.
- Answer-key-context gated keep-review ensemble:
  - Whole-answer read/suggestion: `472/582` (`81.1%`).
  - Auto lane stayed `287/289` (`99.3%`) because review status stayed unchanged.
  - Yellow suggestion matches handwritten truth: `185/293` (`63.1%`), up from `55/293` (`18.8%`).
  - It rescued 139 yellow suggestions and harmed 9 yellow suggestions.
- Answer-key-context safety-gated keep-review ensemble:
  - Whole-answer read/suggestion: `400/582` (`68.7%`).
  - Yellow suggestion matches handwritten truth: `113/293` (`38.6%`).
  - It rescued 61 yellow suggestions, harmed 3 yellow suggestions, and did not harm the auto lane.
- Non-row bottleneck:
  - Current non-row whole-answer read: `142/318` (`44.7%`).
  - Answer-key gated suggestions raise non-row read/suggestion quality to `243/318` (`76.4%`) while keeping review status.

Decision:

- Keep the current worksheet/answer-box design.
- Do not deploy the current no-key ensemble to automatic grading; it adds one confident wrong answer.
- Do build answer-key/context-aware "likely read" suggestions for yellow teacher-review items, clearly separated from score and auto-grading.
- Continue no-key recognizer/model training separately, with the existing validation/holdout discipline.

Next action:

1. Add a review-only likely-read suggestion path to teacher review/debug output. It must not change saved scores, checks, Xs, or auto/yellow status.
2. Start the next no-key model/selector training track, aimed at reducing left-slot/leading-digit confusions without answer-key context.
3. Re-run answer-level benchmark before any scanner/OCR/capture deployment.

2026-07-05 continuation: review-only likely-read suggestions implemented:

What changed:

- Added a live-app review suggestion path for yellow/manual-review answers.
- `src/components/CameraCapture.vue` now attaches `reviewSuggestion` to `answerGroups` when a cautious likely read is available.
- `src/services/studentReviewStore.js` now stores `questionReview` and `answerGroups` in submission records.
- `src/App.vue` shows compact `Likely reads` chips in teacher review cards.
- `scripts/replay_live_ocr_captured.mjs` mirrors the same suggestion policy for saved debug replay.
- `scripts/score_replay_against_handwritten_truth.mjs` can score suggestion correctness when replay result files contain suggestion payloads.
- Added `scripts/eval_review_suggestion_policy.mjs` and package command `npm run eval:review-suggestions`.

Evidence used:

- Frozen handwritten-truth corpus from `private-evidence/reports/digit-failure-dataset-20260705-current/digit-rows.json`.
- Existing replay outputs under:
  - `private-evidence/reports/current-replay-20260704-general-policy-inkw6-a/`
  - `private-evidence/reports/current-replay-20260704-general-policy-inkw6-b/`
  - `private-evidence/reports/current-replay-20260704-general-policy-inkw6-c/`

Commands run:

```text
node --check scripts/eval_review_suggestion_policy.mjs
node --check scripts/replay_live_ocr_captured.mjs
npm run eval:review-suggestions
npm run build
node scripts/score_replay_against_handwritten_truth.mjs --out private-evidence/reports/review-suggestion-scorer-regression-20260705.json private-evidence/reports/current-replay-20260704-general-policy-inkw6-a private-evidence/reports/current-replay-20260704-general-policy-inkw6-b private-evidence/reports/current-replay-20260704-general-policy-inkw6-c
```

Results:

- Build passed.
- Static script checks passed.
- Old replay scoring baseline stayed unchanged:
  - `582` matched answers.
  - `289/582` confident/auto.
  - `287/289` auto-correct against handwritten truth.
  - `2/289` auto-wrong.
  - `293/582` yellow/manual-review.
- Lightweight review-suggestion evaluator:
  - Report: `private-evidence/reports/review-suggestion-policy-20260705/summary.json`
  - Suggestions on `130/293` yellow answers (`44.4%`).
  - Suggestions correct against handwritten truth: `126/130` (`96.9%`).
  - Suggestions rescued `97` yellow answers where the current leaning read was wrong.
  - Non-row suggestions: `98/100` correct (`98.0%`).
  - Row suggestions: `28/30` correct (`93.3%`).
- Safety tightening:
  - Removed weak answer-key-only `5 -> 6` suggestions unless supported by strong independent OCR evidence.
  - Kept ten-frame answer-key context guarded by independent evidence.
  - Did not suppress dot-collection leading-`1` context broadly because it removed many correct suggestions for little precision gain.

Files changed:

```text
src/components/CameraCapture.vue
src/services/studentReviewStore.js
src/App.vue
scripts/replay_live_ocr_captured.mjs
scripts/score_replay_against_handwritten_truth.mjs
scripts/eval_review_suggestion_policy.mjs
package.json
docs/SCANGRADE_ACCURACY_ROADMAP_20260705.md
SCANGRADE_ACTIVE_HANDOFF.md
```

Rollback point:

- No commit was created in this continuation. Use git diff against the current worktree if rollback is needed.

Next action:

1. When Playwright/usage limits allow, run a browser replay against the built app so replay result JSONs include `reviewSuggestion`, then score those replay outputs.
2. Continue the no-answer-key recognizer track. The product goal cannot be met by answer-key context alone because real students write wrong answers.
3. Prioritize reducing left-slot/leading-`1` failures and non-row crop/preprocessing failures without changing the worksheet design.
4. Keep review suggestions review-only until validation/holdout proves zero added confident wrong answers.

Open risks:

- Browser replay with Playwright was blocked by the temporary usage-limit/approval guard during this work session, so the live browser replay has not yet been rerun.
- The review suggestion layer improves teacher workflow but does not increase automatic confident coverage. The automatic lane remains about `49.7%` coverage on this labelled corpus.

## 2026-07-07 Review Suggestion Safety Tightening

Continued SG 3 accuracy work from the frozen handwritten-truth corpus. The live app review-suggestion layer was tightened to prioritize teacher-facing precision over suggestion volume.

What changed:

- `scripts/eval_digit_ensemble_answer_level.py` now scores yellow-only ensemble strategies. This lets no-key recognizer experiments become review suggestions without touching the protected auto lane.
- `scripts/eval_review_suggestion_policy.mjs`, `scripts/replay_live_ocr_captured.mjs`, and `src/components/CameraCapture.vue` now share a stricter review-suggestion guard:
  - A leading `7 -> 1` answer-key-context hint now requires independent OCR evidence for `1`.
  - Pure OCR-alternative review hints now require each changed nonblank slot to have independent evidence at least `0.79`.
  - Suggestions remain review-only; auto scoring and confident/yellow status are unchanged.

Offline evidence:

- Baseline lightweight suggestion policy report: `private-evidence/reports/review-suggestion-policy-20260705/summary.json`
  - `130/293` yellow answers had suggestions.
  - `126/130` suggestions matched handwritten truth (`96.9%`).
  - `4` suggestions were wrong.
- Stricter final policy report: `private-evidence/reports/review-suggestion-policy-20260707/final-strong-review-suggestions/summary.json`
  - Auto lane unchanged: `289/582` auto, `287/289` correct, `2/289` wrong.
  - `79/293` yellow answers had suggestions.
  - `79/79` suggestions matched handwritten truth (`100%`) on the labelled corpus.
  - `50` yellow wrong-leaning answers were rescued.
  - Row suggestions: `17/17` correct.
  - Non-row suggestions: `62/62` correct.

No-key yellow-only ensemble evidence:

- Reports:
  - `private-evidence/reports/digit-ensemble-answer-level-20260707/no-key-yellow-only/summary.json`
  - `private-evidence/reports/digit-ensemble-answer-level-20260707/no-key-layout-yellow-only/summary.json`
- Conservative gated yellow-only selector:
  - `13` yellow suggestions rescued, `0` harmed, `0` auto harm.
  - Layout features reduced this slightly to `11` rescues, `0` harms.
- Aggressive model selector:
  - `31` yellow suggestions rescued, but `2` yellow suggestions harmed.
  - Treat this as research signal, not product behavior.

Browser/live-app verification:

- Browser replay report directory: `private-evidence/reports/review-suggestions-browser-smoke-20260707-final/`
- Truth score: `private-evidence/reports/review-suggestions-browser-smoke-20260707-final/truth-score.json`
- On the 12-capture smoke subset:
  - `58` matched answer groups.
  - Auto lane: `23/23` correct, `0` wrong.
  - Yellow suggestions: `9/9` correct, `0` wrong.
  - This confirms the Vue app emits the stricter suggestion payloads.

Verification commands completed:

```text
PYTHONPYCACHEPREFIX=/tmp/sg-pycache .venv/bin/python3.13 -m py_compile scripts/eval_digit_ensemble_answer_level.py
.venv/bin/python3.13 scripts/eval_digit_ensemble_answer_level.py --out private-evidence/reports/digit-ensemble-answer-level-20260707/no-key-yellow-only/summary.json
.venv/bin/python3.13 scripts/eval_digit_ensemble_answer_level.py --layout-features --out private-evidence/reports/digit-ensemble-answer-level-20260707/no-key-layout-yellow-only/summary.json
node --check scripts/eval_review_suggestion_policy.mjs
node --check scripts/replay_live_ocr_captured.mjs
node scripts/eval_review_suggestion_policy.mjs --out private-evidence/reports/review-suggestion-policy-20260707/final-strong-review-suggestions/summary.json
npm run build
node scripts/replay_live_ocr_captured.mjs --allow-imperfect --url https://localhost:5174 --out-dir private-evidence/reports/review-suggestions-browser-smoke-20260707-final --limit 12 private-evidence/debug-scans/2026-07-02
node scripts/score_replay_against_handwritten_truth.mjs --out private-evidence/reports/review-suggestions-browser-smoke-20260707-final/truth-score.json private-evidence/reports/review-suggestions-browser-smoke-20260707-final
```

Current judgement:

- This is a safer teacher-review improvement, not a solution to the automatic `90-95%` confident-read goal.
- The stronger review-suggestion policy is a good candidate to keep because it removed known bad hints while preserving clean assists.
- The no-key ensemble shows useful zero-harm review-only rescues but is not strong enough to become the recognizer.

Next action:

1. If deploying, use a new build label that clearly indicates review-suggestion safety tightening.
2. Continue no-key recognizer work with answer-level zero-harm gates.
3. Focus the next technical push on non-row and leading/left-slot recognition, not worksheet redesign.

## 2026-07-07 No-Key Ensemble Overlap Check

Follow-up analysis added per-answer detail rows to the review-suggestion and answer-level ensemble evaluators, then compared the strict live review suggestions against no-key yellow-only ensemble suggestions.

New/updated tooling:

- `scripts/eval_review_suggestion_policy.mjs` now writes an `items` array for each answer group.
- `scripts/eval_digit_ensemble_answer_level.py` now writes per-strategy `items` arrays.
- `scripts/analyze_review_suggestion_overlap.mjs` compares strict live suggestions with no-key ensemble suggestions and searches simple gates for additive no-key hints.

Reports:

- `private-evidence/reports/review-suggestion-policy-20260707/final-strong-review-suggestions-with-items/summary.json`
- `private-evidence/reports/digit-ensemble-answer-level-20260707/no-key-yellow-only-with-items/summary.json`
- `private-evidence/reports/review-suggestion-overlap-20260707/summary.json`

Key result:

- Strict live suggestions remain `79/79` correct against handwritten truth.
- The no-key ensemble is not safe as a general teacher-facing hint layer:
  - Aggressive changed suggestions: `31/66` correct, `35/66` wrong.
  - Conservative gated changed suggestions: `13/27` correct, `14/27` wrong.
- The previous "0 harm" yellow-only metric was too weak because it only counted cases where a currently-correct yellow read was damaged. For teacher-facing suggestions, changing one wrong yellow read into a different wrong suggestion is still a trust problem and must count as wrong.
- The only zero-wrong additive pocket found by the simple gate search was tiny: `3/3` row-sheet rescues, with no non-row additive gate that was both useful and wrong-free.

Decision:

- Do not add no-key ensemble suggestions to the public app yet.
- Keep the strict live review-suggestion policy as the product-facing candidate.
- Use the no-key ensemble rescues as training/crop/preprocessing signal for the next recognizer, not as a deployable policy.

## 2026-07-07 Single-Digit 6 Shape Risk Demotion

The next trust-focused pass inspected the only two confident wrong reads in the frozen `582`-answer labelled corpus. Both were single-slot row-sheet reads where the app confidently predicted `6` even though the expected answer was a visually adjacent `5` or `8`.

Cases:

- `2026-07-02_14-33-38-334-sg-g1-lw-03-sub-1digit-5b8e24a7::7`: expected `5`, handwritten truth `10`, app read `6`.
- `2026-07-02_14-37-51-441-sg-g1-lw-03-sub-1digit-1d2b16d2::6`: expected/truth `8`, app read `6`.

Change:

- Added `single-digit-six-shape-mismatch-review` in `src/components/CameraCapture.vue`.
- Mirrored the same rule in `scripts/replay_live_ocr_captured.mjs`.
- The rule does not rewrite the digit and does not mark anything correct. It only uses the answer key as a review-only risk signal when a non-virtual single-slot answer is read as `6` but the expected digit is `5` or `8`.

Full-corpus policy simulation:

- Report: `private-evidence/reports/single-digit-six-risk-review-20260707/full-corpus-policy-simulation.json`
- Before: `289/582` auto, `287/289` auto-correct, `2` auto-wrong, `293` yellow.
- After simulation: `287/582` auto, `287/287` auto-correct, `0` auto-wrong, `295` yellow.
- Demoted exactly `2` answers: `2` auto-wrong, `0` auto-correct.

Browser replay verification:

- Replay directory: `private-evidence/reports/single-digit-six-risk-review-20260707/`
- Truth score: `private-evidence/reports/single-digit-six-risk-review-20260707/truth-score.json`
- On `374` matched replay groups from `67` saved captures:
  - Auto: `205/374`.
  - Auto-correct: `205/205`.
  - Auto-wrong: `0`.
  - Yellow: `169`.
  - Yellow suggestions: `53/53` correct.
  - Row auto: `126/176` with `126/126` correct.
  - Non-row auto: `79/198` with `79/79` correct.

Verification commands:

```text
node --check scripts/replay_live_ocr_captured.mjs
npm run build
node scripts/replay_live_ocr_captured.mjs --allow-imperfect --url https://localhost:5174 --out-dir private-evidence/reports/single-digit-six-risk-review-20260707 private-evidence/debug-scans/2026-07-02
node scripts/score_replay_against_handwritten_truth.mjs --out private-evidence/reports/single-digit-six-risk-review-20260707/truth-score.json private-evidence/reports/single-digit-six-risk-review-20260707
```

Decision:

- Keep this patch as a trust-preserving review demotion.
- It slightly reduces auto coverage but removes the known confident wrong category in the labelled corpus.
- This still does not solve the larger market-readiness problem: non-row coverage remains low (`39.9%` auto in this replay), so the next technical push should return to no-key recognizer/crop/preprocessing improvements for non-row and leading/left-slot digits.

## 2026-07-07 Variant Top-K Review Suggestion Tightening

Continued the non-row/leading-slot analysis after the single-digit `6` trust patch.

What changed:

- Added `scripts/analyze_nonrow_context_suggestion_delta.mjs` to compare a candidate review-suggestion policy against the strict baseline and list exactly which extra suggestions it adds.
- Tested the tempting broad policy "allow non-row leading `7 -> 1` answer-key context." Rejected it:
  - Report: `private-evidence/reports/review-suggestion-policy-20260707/non-row-leading-seven-context-with-items/summary.json`
  - Delta added only `7` suggestions: `5` correct, `2` wrong.
  - The two wrong suggestions were real student wrong answers (`72`/`73`) on dot-collection work where the answer key expected `12`/`13`.
- Added a narrower live/replay review-only rule:
  - Variant `topK` alternatives now count as independent evidence for review suggestions.
  - Leading `7 -> 1` answer-key-context suggestions require independent `1` evidence at `>= 0.22`.
  - This remains review-only. It does not change auto/yellow status, saved score, or OCR output.

Evidence:

- Strict previous baseline: `79/79` review suggestions correct.
- New evaluator report: `private-evidence/reports/review-suggestion-policy-20260707/live-variant-topk-leading-one-022-with-items/summary.json`
  - Same `582` labelled answers.
  - Auto lane unchanged: `289/582` auto, `287/289` auto-correct, `2` auto-wrong in the offline rows baseline.
  - Review suggestions: `82/293` yellow answers.
  - Suggestion correctness: `82/82` against handwritten truth.
  - Rescued yellow wrong-leaning answers: `53`.
  - Non-row suggestions: `64/64` correct.
  - Row suggestions: `18/18` correct.
- Threshold sweep:
  - `0.21` introduced `1` wrong suggestion.
  - `0.22` kept `0` wrong suggestions while adding `3` correct suggestions.
  - `0.23` kept `0` wrong suggestions but added only `1` correct suggestion.
- Browser smoke replay:
  - Replay directory: `private-evidence/reports/variant-topk-leading-one-review-20260707-browser/`
  - Truth score: `private-evidence/reports/variant-topk-leading-one-review-20260707-browser/truth-score.json`
  - On `100` matched answer groups from `20` saved captures:
    - Auto: `47/100`.
    - Auto-correct: `47/47`.
    - Auto-wrong: `0`.
    - Yellow suggestions: `15/15` correct.
- Full browser replay:
  - Replay directory: `private-evidence/reports/variant-topk-leading-one-review-20260707-full-browser/`
  - Truth score: `private-evidence/reports/variant-topk-leading-one-review-20260707-full-browser/truth-score.json`
  - On `374` matched answer groups from `67` saved captures:
    - Auto: `205/374`.
    - Auto-correct: `205/205`.
    - Auto-wrong: `0`.
    - Yellow suggestions: `56/56` correct.
    - Row auto: `126/176` (`71.6%`) with `0` auto-wrong.
    - Non-row auto: `79/198` (`39.9%`) with `0` auto-wrong.

Commands run:

```text
node --check scripts/eval_review_suggestion_policy.mjs
node --check scripts/replay_live_ocr_captured.mjs
node scripts/eval_review_suggestion_policy.mjs --out private-evidence/reports/review-suggestion-policy-20260707/live-variant-topk-leading-one-022-with-items/summary.json
npm run build
node scripts/replay_live_ocr_captured.mjs --allow-imperfect --url https://127.0.0.1:5174 --out-dir private-evidence/reports/variant-topk-leading-one-review-20260707-browser --limit 20 private-evidence/debug-scans/2026-07-02
node scripts/score_replay_against_handwritten_truth.mjs --out private-evidence/reports/variant-topk-leading-one-review-20260707-browser/truth-score.json private-evidence/reports/variant-topk-leading-one-review-20260707-browser
node scripts/replay_live_ocr_captured.mjs --allow-imperfect --url https://127.0.0.1:5174 --out-dir private-evidence/reports/variant-topk-leading-one-review-20260707-full-browser private-evidence/debug-scans/2026-07-02
node scripts/score_replay_against_handwritten_truth.mjs --out private-evidence/reports/variant-topk-leading-one-review-20260707-full-browser/truth-score.json private-evidence/reports/variant-topk-leading-one-review-20260707-full-browser
```

Files changed:

```text
src/components/CameraCapture.vue
scripts/replay_live_ocr_captured.mjs
scripts/eval_review_suggestion_policy.mjs
scripts/analyze_nonrow_context_suggestion_delta.mjs
SCANGRADE_ACTIVE_HANDOFF.md
docs/SCANGRADE_ACCURACY_ROADMAP_20260705.md
```

Decision:

- Keep the narrow variant-topK review-suggestion patch as a tiny teacher-review improvement.
- Do not deploy the broad non-row answer-key-context policy.
- Continue treating answer-key context as review assistance only, never as hidden auto-correction.

Next action:

1. Full replay the current browser app when useful, beyond the `20`-capture smoke subset.
2. Continue no-key recognizer/crop/preprocessing work for non-row layouts. The product still needs a real coverage breakthrough; review suggestions are only workflow help.
3. Mine ten-frame, number-pattern, number-bond, and place-value yellow failures for portable crop/preprocessing fixes that do not depend on the answer key.

## 2026-07-08 Review Opportunity / Selector Diagnosis

Continued the market-readiness OCR analysis from the variant-topK full browser replay.

What changed:

- Added `scripts/analyze_replay_failure_modes.mjs` to summarize latest replay misses against handwritten truth by layout, family, confusion, review reason, and examples.
- Added `scripts/analyze_replay_review_opportunities.mjs` to measure whether yellow wrong-leaning cases contain any independent evidence for the handwritten-truth answer in current read, model topK, preprocessing variants, or variant topK.
- Reran the current review-suggestion evaluator to confirm the strict variant-topK policy remains `82/82` correct on the labelled corpus.

Evidence:

- Failure report: `private-evidence/reports/failure-modes-20260707/variant-topk-full-browser.json`
- Review opportunity report: `private-evidence/reports/review-opportunities-20260707/variant-topk-full-browser.json`
- Current policy rerun: `private-evidence/reports/review-suggestion-policy-20260707/current-default-rerun/summary.json`

Results from the latest full browser replay:

- Matched answer groups: `374`.
- Auto/confident lane: `205/374`, `205/205` correct, `0` confidently wrong.
- Yellow/manual review: `169`.
- Yellow current lean already matched handwriting on `35`.
- Yellow wrong-leaning cases: `134`.
- Of those `134`, `101` had at least a trace of the handwritten-truth answer somewhere in current/topK/variant evidence.
- `73/134` had weak-or-better support across all needed slots.
- `36/134` had medium-or-better support across all needed slots.
- `16/134` had strong support across all needed slots.
- Non-row layouts were the dominant remaining drag: `101/134` yellow wrong-leaning cases.
- Worst layouts by yellow wrong-leaning count:
  - `sg-g1-lw-06-ten-frames`: `25`.
  - `sg-g1-lw-08-number-bonds`: `25`.
  - `sg-g1-lw-07-dot-collections`: `22`.
  - `sg-g1-lw-09-number-patterns`: `16`.
  - `sg-g1-lw-10-place-value-50`: `13`.

Important negative result:

- A quick no-key "switch to high-confidence variant evidence" probe was unsafe.
- Even at very high variant-evidence thresholds, suggestions were often wrong because false variant candidates can be extremely confident.
- At threshold `0.95`, naive no-key switching produced only `8/17` correct suggestions.
- At threshold `0.75`, it produced only `12/49` correct suggestions.
- Conclusion: the opportunity is real, but the hard problem is selector/calibration, not simply trusting stronger variant confidence.

Commands run:

```text
node --check scripts/analyze_replay_failure_modes.mjs
node scripts/analyze_replay_failure_modes.mjs --out private-evidence/reports/failure-modes-20260707/variant-topk-full-browser.json private-evidence/reports/variant-topk-leading-one-review-20260707-full-browser
node --check scripts/analyze_replay_review_opportunities.mjs
node scripts/analyze_replay_review_opportunities.mjs --out private-evidence/reports/review-opportunities-20260707/variant-topk-full-browser.json private-evidence/reports/variant-topk-leading-one-review-20260707-full-browser
node --check scripts/eval_review_suggestion_policy.mjs
node scripts/eval_review_suggestion_policy.mjs --out private-evidence/reports/review-suggestion-policy-20260707/current-default-rerun/summary.json
```

Decision:

- Do not auto-promote yellow cases using answer-key context or raw variant confidence.
- Do not add answer-key-only `5 -> 6` hints; the missed cases lacked enough independent evidence, and real student wrong answers make that unsafe.
- Keep the current auto lane conservative.
- The next technical work should be a proper selector/model track: learn when variant evidence is trustworthy using quality signals, layout risk, slot side, and validation/holdout gates. The selector must be judged at answer level, not only digit-slot level.

Next action:

1. Build a formal no-key selector experiment around the opportunity report, especially for non-row layouts.
2. Use validation/holdout splits and answer-level scoring; do not deploy unless confident wrong stays zero.
3. If no selector candidate clears the safety gate, focus on training a ScanGrade-specific recognizer and better blank/artifact classifiers rather than threshold loosening.

## 2026-07-08 Split-Aware No-Key Gate Search

Continued from the selector diagnosis by building a split-aware no-answer-key gate search over the latest full browser replay.

What changed:

- Added `scripts/search_no_key_variant_review_gates.mjs`.
- The script joins the latest replay to handwritten truth and to the existing digit-row split labels (`calibration`, `validation`, `holdout`).
- It generates no-key candidate review suggestions from current read, model topK, preprocessing variants, and variant topK.
- It searches simple gates over minimum evidence confidence, changed-slot count, variant top-1 count, topK count, and row/non-row family.
- It tunes only on calibration, then reports validation and holdout behavior.

Evidence:

- Report: `private-evidence/reports/no-key-variant-review-gates-20260708/full-browser.json`
- Input replay: `private-evidence/reports/variant-topk-leading-one-review-20260707-full-browser/`
- Split coverage in replay: `374` labelled groups, with `208` calibration, `100` validation, and `66` holdout.

Result:

- The best calibration-zero-wrong gate was:
  - `conf>=0.95 changed<=1 vtop>=0 topk>=0 row`
  - Calibration: `1/1` suggestion correct, `1` rescue, `0` wrong.
  - Validation: `1/1` suggestion correct, `1` rescue, `0` wrong.
  - Holdout: `0` suggestions.
- No useful non-row zero-wrong gate survived.
- Broader gates were badly unsafe. For example:
  - `conf>=0.9 changed<=1 ... all` gave validation `2` correct / `8` wrong and holdout `2` correct / `9` wrong.
  - `conf>=0.9 changed<=1 ... non-row` gave validation `1` correct / `8` wrong and holdout `2` correct / `9` wrong.

Interpretation:

- Simple no-key threshold gates are not enough.
- The existing variant evidence contains signal, but high-confidence false variants are common.
- The next viable selector must use richer features: tensor/ink quality, artifact flags, layout risk, slot side, current-vs-alternative conflict, variant disagreement pattern, and answer-level safety scoring.
- Do not integrate this simple gate into the app; its useful safe coverage is too tiny.

Commands run:

```text
node --check scripts/search_no_key_variant_review_gates.mjs
node scripts/search_no_key_variant_review_gates.mjs --out private-evidence/reports/no-key-variant-review-gates-20260708/full-browser.json private-evidence/reports/variant-topk-leading-one-review-20260707-full-browser
```

Decision:

- Reject simple no-key variant gates as a production or teacher-facing suggestion path.
- Keep current strict review suggestions and conservative auto lane.
- Move next to either:
  1. a learned selector using tensor/quality features, trained on calibration and judged on validation/holdout at answer level; or
  2. a model/blank-artifact classifier training track if selector gains remain too small.

Next action:

1. Extend the existing Python selector/ensemble tools to consume latest replay evidence or produce a candidate learned selector report with answer-level validation/holdout metrics.
2. Require zero added confident wrong and meaningful non-row gain before any app integration.
3. If learned selector still fails, prioritize model training and blank/artifact classifier work over more handwritten rules.

## 2026-07-08 Learned No-Key Replay Selector

Continued the market-readiness OCR push by testing whether a learned selector could safely rescue yellow/manual-review answers without using the answer key.

What changed:

- Added `scripts/eval_no_key_replay_selector.mjs`.
- The script joins the latest full browser replay to handwritten-truth labels and the existing calibration/validation/holdout split labels.
- It generates alternative answer candidates from current model topK, preprocessing variants, and variant topK.
- It trains a small logistic selector on calibration candidates using only no-key features: confidence, top-gap, changed-slot count, variant/topK support, row/non-row family, slot count, digit-change patterns, and optional layout ID.
- It reports calibration, validation, and holdout answer-level behavior separately.

Evidence:

- No-layout report: `private-evidence/reports/no-key-replay-selector-20260708/no-layout.json`
- Layout-feature report: `private-evidence/reports/no-key-replay-selector-20260708/layout.json`
- Input replay: `private-evidence/reports/variant-topk-leading-one-review-20260707-full-browser/`

Result:

- Replay-matched groups: `374`.
- Candidate records: `3713`.
- Split coverage: `208` calibration, `100` validation, `66` holdout.
- Best calibration-zero-wrong no-layout selector:
  - Calibration: `1/1` suggestion correct, `0` wrong.
  - Validation: `0` suggestions.
  - Holdout: `0` suggestions.
- Best calibration-zero-wrong layout-feature selector was effectively the same tiny pocket:
  - Calibration: `1/1` suggestion correct, `0` wrong.
  - Validation: `0` suggestions.
  - Holdout: `0` suggestions.
- Lowering thresholds to get real validation/holdout coverage was unsafe. Representative runs produced validation/holdout suggestions that were wrong before they produced useful rescues.

Interpretation:

- The learned replay-metadata selector did not safely generalize.
- This confirms the previous simple-gate finding: current variant/topK metadata contains real signal, but also high-confidence false alternatives.
- Do not integrate this selector into the app.
- The next useful work is richer visual evidence, not more confidence-threshold tuning: tensor/ink quality features, blank/artifact classifiers, crop-quality signals, and/or a stronger ScanGrade-specific recognizer.

Commands run:

```text
node --check scripts/eval_no_key_replay_selector.mjs
node scripts/eval_no_key_replay_selector.mjs --out private-evidence/reports/no-key-replay-selector-20260708/no-layout.json private-evidence/reports/variant-topk-leading-one-review-20260707-full-browser
node scripts/eval_no_key_replay_selector.mjs --layout-features --out private-evidence/reports/no-key-replay-selector-20260708/layout.json private-evidence/reports/variant-topk-leading-one-review-20260707-full-browser
```

Decision:

- Reject learned no-key replay selector v1 as production logic.
- Keep the current conservative auto lane: `205/205` auto-correct and `0` confidently wrong on the latest full replay remains the trust anchor.
- Keep strict review suggestions only where evidence is proven high precision.
- Pivot the next experiment toward image/tensor-level quality and artifact signals, especially for non-row sheets.

Next action:

1. Add a tensor/image quality audit for yellow cases and false alternatives.
2. Build a blank/artifact classifier or stricter quality gate for optional/empty slots.
3. Revisit selector training only after adding visual quality features that can separate true handwriting from divider/box-line artifacts.

## 2026-07-08 Visual Quality / Artifact Audit

Continued from the failed no-key selector by testing whether tensor-level visual quality can explain why some yellow alternatives are safe while others are false high-confidence traps.

What changed:

- Added `scripts/analyze_replay_visual_quality.mjs`.
- Extended `scripts/eval_no_key_replay_selector.mjs` with optional `--quality-features` and `--debug-root` support.
- The visual audit joins latest replay results, handwritten-truth labels, and saved Mission Control `debug.json` tensors by capture ID.
- It measures the same 28x28 tensor evidence the digit model sees, including ink size, connected components, usable variant ratio, weak variant ratio, artifact-like variant ratio, fragmentation, and rough line-artifact flags.

Evidence:

- Visual audit report: `private-evidence/reports/visual-quality-audit-20260708/full-browser.json`
- Quality selector report: `private-evidence/reports/no-key-replay-selector-20260708/quality.json`
- Quality + layout selector report: `private-evidence/reports/no-key-replay-selector-20260708/quality-layout.json`
- Input replay: `private-evidence/reports/variant-topk-leading-one-review-20260707-full-browser/`

Visual audit result:

- Matched answer groups: `374/374` with debug tensors found.
- Aligned slot groups: `333`.
- Overall tensor slots audited: `616`.
- Yellow-wrong groups are more visually suspicious than yellow-correct groups:
  - Yellow leaning correct: usable variant ratio `0.4413`, artifact variant ratio `0.4426`, weak variant ratio `0.4795`.
  - Yellow leaning wrong: usable variant ratio `0.3244`, artifact variant ratio `0.6009`, weak variant ratio `0.5216`.
- Non-row is the main product bottleneck:
  - Non-row auto-correct: usable variant ratio `0.4518`, artifact variant ratio `0.4654`, weak variant ratio `0.4371`.
  - Non-row yellow-wrong: usable variant ratio `0.3392`, artifact variant ratio `0.5811`, weak variant ratio `0.5121`.
- Row one-digit pages have high apparent artifact/weak rates despite many correct reads. This means the current visual rules are not safe as a blunt gate.
- Layout-level weak/artifact signal:
  - `sg-g1-lw-01-add-1digit`: weak slot pct `72.9`, artifact slot pct `89.6`.
  - `sg-g1-lw-03-sub-1digit`: weak slot pct `71.4`, artifact slot pct `91.1`.
  - Non-row layouts generally had better raw `ok` rates but still much lower auto coverage, implying the model/selector is confused by shape patterns, not only blank crops.
- Top aligned slot confusions in this replay:
  - `7->1`: `21`.
  - `2->9`: `7`.
  - `5->6`: `7`.
  - `9->1`: `7`.
  - `1->9`: `5`.

Quality-feature selector result:

- `--quality-features` added numeric visual-quality features to the learned replay selector.
- Candidate records stayed at `3713`.
- Feature counts:
  - Quality only: `41` numeric, `370` categorical.
  - Quality + layout: `41` numeric, `378` categorical.
- Both quality-feature selectors failed the safety gate:
  - Calibration-zero-wrong count: `0`.
  - Validation-zero-wrong top runs: none.
- Representative high-score run was unsafe:
  - Calibration `1` correct / `2` wrong.
  - Validation `0` correct / `1` wrong.
  - Holdout `2` correct / `3` wrong.

Interpretation:

- Tensor quality is diagnostically useful but not yet a deployable selector feature.
- The current quality metrics are too generic: they can identify suspicious evidence, but they do not reliably separate real child handwriting from artifacts across layouts.
- A generic logistic selector with quality columns is the wrong next production path.
- The next useful direction is a dedicated blank/artifact/real-handwriting classifier or manually audited artifact label set, not more threshold tuning.

Commands run:

```text
node --check scripts/analyze_replay_visual_quality.mjs
node scripts/analyze_replay_visual_quality.mjs --out private-evidence/reports/visual-quality-audit-20260708/full-browser.json private-evidence/reports/variant-topk-leading-one-review-20260707-full-browser
node --check scripts/eval_no_key_replay_selector.mjs
node scripts/eval_no_key_replay_selector.mjs --quality-features --out private-evidence/reports/no-key-replay-selector-20260708/quality.json private-evidence/reports/variant-topk-leading-one-review-20260707-full-browser
node scripts/eval_no_key_replay_selector.mjs --quality-features --layout-features --out private-evidence/reports/no-key-replay-selector-20260708/quality-layout.json private-evidence/reports/variant-topk-leading-one-review-20260707-full-browser
node --check scripts/create_artifact_label_pack.mjs
node scripts/create_artifact_label_pack.mjs --out-dir private-evidence/artifact-label-packs/20260708-visual-quality --per-class 80
```

Decision:

- Do not integrate visual-quality selector features into app logic yet.
- Keep `scripts/analyze_replay_visual_quality.mjs` as a diagnostic tool.
- Next best move: build a small labelled artifact-vs-real-writing dataset from existing tensors/crops, then train/evaluate a binary classifier or stricter rule set against calibration/validation/holdout.

Artifact label pack:

- Added `scripts/create_artifact_label_pack.mjs`.
- Generated private label pack: `private-evidence/artifact-label-packs/20260708-visual-quality/`
- Files:
  - `contact-sheet.png`
  - `records.json`
  - `README.md`
- Pack contents: `93` tensor examples, with `47` suspicious-artifact candidates and `46` comparison auto/yellow-correct candidates.
- Visual spot-check showed an important caveat: some comparison auto-correct examples still visibly include dividers/box artifacts. Therefore labels must be assigned from the tensor image itself, not from whether the app happened to grade the answer correctly.

Next action:

1. Generate contact sheets for suspected artifact slots, clean handwriting slots, and false high-confidence variant alternatives.
2. Label a small calibration set as `real-writing`, `blank`, `box-line/divider`, `fragment/noise`, or `unclear`.
3. Train/evaluate a binary real-writing/artifact classifier.
4. Use it only as a review demotion or selector-blocking feature until validation/holdout proves it does not increase confident wrong reads.

## 2026-07-08 Blank / Artifact Classifier Smoke

Continued the artifact path by testing whether the existing slot-level handwritten-truth digit rows can train a filled-vs-blank detector from saved tensors.

What changed:

- Added `scripts/eval_blank_artifact_classifier.mjs`.
- The evaluator reads `private-evidence/reports/digit-failure-dataset-20260705-current/digit-rows.json`.
- It joins each slot row to its saved `debug.json` tensor by `debugPath` and `detailId`.
- It trains a logistic filled-vs-blank classifier on calibration rows only.
- It reports validation and holdout separately.
- It supports `--visual-only` to remove policy/review leakage fields such as `preprocessReviewReason`, `robustOverride`, `groupReview`, and `confidencePolicyCleared`.

Evidence:

- Full-feature report: `private-evidence/reports/blank-artifact-classifier-20260708/summary.json`
- Visual-only report: `private-evidence/reports/blank-artifact-classifier-20260708/visual-only.json`
- Input slot rows: `960` rows total, `918` usable for filled-vs-blank after requiring a tensor-backed filled or blank label.

Visual-only result:

- Feature counts: `43` numeric, `15` categorical.
- Split counts:
  - Calibration: `639` slots (`605` filled, `34` blank).
  - Validation: `170` slots (`157` filled, `13` blank).
  - Holdout: `109` slots (`103` filled, `6` blank).
- AUC:
  - Calibration: `0.9996`.
  - Validation: `0.998`.
  - Holdout: `1.0`.
- Best calibration-zero-false-blank gate:
  - `l2=0.01`, threshold `0.1`.
  - Calibration: caught `26/34` blanks (`76.5%`) with `0` filled slots misclassified as blank.
  - Validation: caught `9/13` blanks (`69.2%`) with `0` filled slots misclassified as blank.
  - Holdout: caught `5/6` blanks (`83.3%`) with `0` filled slots misclassified as blank.
- Validation-zero-false-blank top gates similarly held `0` false blanks on holdout in the top candidates.

Interpretation:

- This is the first artifact/blank path that looks genuinely promising.
- Unlike the generic no-key answer selector, the blank detector has a clear and narrow job: block or demote likely blank/artifact slots, not choose the final handwritten digit.
- The visual-only result is especially important because it removes current-policy leakage fields.
- Caveat: some slot blank labels were inferred from app slot underscores (`truthSlotSource: inferred-from-app-slot-underscores`), so this is not deployment proof yet. It is strong evidence for building a proper blank/artifact classifier with manually audited labels.

Commands run:

```text
node --check scripts/eval_blank_artifact_classifier.mjs
node scripts/eval_blank_artifact_classifier.mjs --out private-evidence/reports/blank-artifact-classifier-20260708/summary.json
node scripts/eval_blank_artifact_classifier.mjs --visual-only --out private-evidence/reports/blank-artifact-classifier-20260708/visual-only.json
```

Decision:

- Keep `scripts/eval_blank_artifact_classifier.mjs` as the next technical basis for a real blank/artifact module.
- Do not integrate it into app logic yet because labels need manual artifact validation and the classifier needs to be exported/replayed as an app-equivalent path.
- The next safe implementation step is not an auto-grade change; it is a reproducible app-side blank/artifact scoring function plus replay-only demotion simulation.

Next action:

1. Manually label the artifact label pack or create a smaller high-confidence hand-label set from it.
2. Re-run the classifier using manually labelled artifact classes, not only inferred blank slots.
3. If validation/holdout remain zero-false-blank, integrate as a review-only demotion/blocking feature in replay first.
4. Only after replay proves zero added confident wrong, consider app integration.

## 2026-07-08 Blank / Artifact Replay Simulation

Continued the blank/artifact path by extending the classifier evaluator into a replay-level policy simulator.

What changed:

- Extended `scripts/eval_blank_artifact_classifier.mjs` with:
  - `--simulate-replay <replay-dir>`
  - replay/debug/truth joining
  - answer-level baseline scoring
  - conservative demotion simulation
  - review-only blanking suggestion simulation
  - risky auto-blank comparison for lab visibility only
- This remains analysis-only. No production app OCR/capture behavior changed.

Evidence:

- Report: `private-evidence/reports/blank-artifact-classifier-20260708/visual-only-replay-sim.json`
- Input replay: `private-evidence/reports/variant-topk-leading-one-review-20260707-full-browser/`
- Trained from calibration slots in `private-evidence/reports/digit-failure-dataset-20260705-current/digit-rows.json`.
- Classifier mode: `--visual-only`, using the previous best calibration-zero-false-blank gate (`l2=0.01`, threshold `0.1`).

Replay simulation result:

- Matched answer groups: `374`.
- Baseline:
  - Auto/confident: `205/374`.
  - Auto-correct: `205/205`.
  - Auto-wrong: `0`.
  - Yellow: `169`.
  - Yellow current lean correct: `35`.
- Classifier detected `14` blank slots.
- Conservative demotion simulation:
  - Auto/confident remained `205/374`.
  - Auto-correct remained `205/205`.
  - Auto-wrong remained `0`.
  - No additional auto groups needed demotion at this threshold.
- Risky auto-blank comparison, not recommended for production:
  - Auto lane unchanged.
  - Yellow current-lean correct would improve from `35` to `38`.
  - Yellow wrong-leaning would drop from `134` to `131`.
- Review-only blanking suggestions:
  - `3` suggestions.
  - `3/3` correct.
  - `0` wrong.
  - `3` rescues.
  - `0` harmed current-correct yellow reads.
- All three rescues were validation-set ten-frame cases where a one-digit student answer had picked up a false right-slot companion:
  - `71 -> 7`
  - `81 -> 8`
  - `91 -> 9`

Interpretation:

- The classifier is not a big coverage breakthrough yet, but it is a safe and targeted review-assist signal in replay.
- It directly addresses the false companion digit problem without touching the auto lane.
- It should not be auto-applied yet because the labels still need manual artifact validation and the replay benefit is currently small.
- The product-shaped next step is a teacher-review suggestion such as "blank this slot" or a behind-the-scenes review suggestion source, not automatic score changes.

Commands run:

```text
node --check scripts/eval_blank_artifact_classifier.mjs
node scripts/eval_blank_artifact_classifier.mjs --visual-only --simulate-replay private-evidence/reports/variant-topk-leading-one-review-20260707-full-browser --out private-evidence/reports/blank-artifact-classifier-20260708/visual-only-replay-sim.json
```

Decision:

- Keep the replay simulation path.
- Do not integrate app behavior yet.
- Treat the blank/artifact classifier as a candidate teacher-review suggestion source after manual label validation.

Next action:

1. Label or pseudo-label a stronger artifact dataset.
2. Add a replay evaluator that combines current strict review suggestions with blank/artifact review suggestions and reports total teacher-review assist coverage.
3. If combined review suggestions stay zero-wrong on validation/holdout, integrate them as review-only UI hints.

## 2026-07-08 Combined Review-Assist Evaluation

Continued the review-assist track by combining two safe teacher-review suggestion sources:

1. The existing strict built-in `reviewSuggestion` attached to replayed yellow answers.
2. The new blank/artifact replay-simulation suggestions for false companion slots.

What changed:

- Added `scripts/eval_combined_review_assist.mjs`.
- The script joins:
  - handwritten truth labels,
  - latest full-browser replay results,
  - split labels from digit rows,
  - blank/artifact replay-simulation examples.
- It reports built-in suggestions, blank/artifact suggestions, and the combined union separately by overall, row/non-row family, split, and source.
- This is analysis-only. No app grading, OCR, capture, homography, or public UI behavior changed.

Evidence:

- Report: `private-evidence/reports/combined-review-assist-20260708/summary.json`
- Replay input: `private-evidence/reports/variant-topk-leading-one-review-20260707-full-browser/`
- Blank/artifact input: `private-evidence/reports/blank-artifact-classifier-20260708/visual-only-replay-sim.json`
- Truth input: `private-evidence/truth-labels/20260703-flex-duplicate-accepted-needs-label/handwritten-truth-labelled.json`

Results:

- Baseline latest replay:
  - Matched groups: `374`.
  - Auto/confident: `205/374`.
  - Auto-correct: `205/205`.
  - Auto-wrong: `0`.
  - Yellow/manual review: `169`.
  - Yellow current lean correct: `35/169`.
- Built-in strict review suggestions:
  - `56` suggestions.
  - `56/56` correct.
  - `0` wrong.
  - `35` rescues.
- Blank/artifact suggestions:
  - `3` suggestions.
  - `3/3` correct.
  - `0` wrong.
  - `3` rescues.
- Combined review assist:
  - `59` suggestions across `169` yellow answers.
  - `59/59` correct.
  - `0` wrong.
  - `38` rescues.
  - `0` harmed current-correct yellow reads.
  - No conflicts between built-in and blank/artifact suggestion sources.

Breakdown:

- Row: `15/50` yellow answers suggested, `15/15` correct, `7` rescues.
- Non-row: `44/119` yellow answers suggested, `44/44` correct, `31` rescues.
- Calibration: `30/85` suggested, `30/30` correct.
- Validation: `20/51` suggested, `20/20` correct.
- Holdout: `9/33` suggested, `9/9` correct.

Commands run:

```text
node --check scripts/eval_combined_review_assist.mjs
node scripts/eval_combined_review_assist.mjs
```

Decision:

- This is a real product/workflow improvement candidate, but it should remain review-only.
- It does not increase automatic confident coverage yet; the auto lane remains `205/374`.
- It can make teacher review much faster by pre-filling a likely value for about `35%` of yellow answers while preserving `0` wrong suggestions on the current replay.
- Do not convert these suggestions into automatic grading until a larger validation/holdout path proves no added confident wrong reads.

Next action:

1. Design the teacher-review UI behavior for safe suggestions: prefill/highlight "likely read" while still requiring teacher confirmation for yellow answers.
2. Decide whether to include blank/artifact suggestions in public review UI only after manual artifact-label validation.
3. Continue the deeper recognizer path separately: reduce non-row yellow volume through better crop/preprocessing/model work, not by making the auto lane less conservative.

## 2026-07-08 Review-Assist UI Metric + Benchmark Command

Continued from the combined review-assist evaluation by making the proven review-assist metric easier to rerun and easier to see in the Teacher Review UI.

What changed:

- Added package script `npm run eval:combined-review-assist`.
- Updated `src/App.vue` Teacher Review summary to include a passive `Likely reads` count.
- Updated likely-read chips to include confidence and source when available, e.g. OCR alternative vs context review.
- This is UI/reporting only. It does not change OCR, capture, homography, auto-grading confidence, review routing, or scoring.

Evidence:

- Script: `scripts/eval_combined_review_assist.mjs`
- Report: `private-evidence/reports/combined-review-assist-20260708/summary.json`

Commands run:

```text
npm run eval:combined-review-assist
npm run build
```

Results:

- Combined review-assist benchmark still matches the previous report:
  - Baseline: `374` groups, `205/374` auto, `205/205` auto-correct, `0` auto-wrong, `169` yellow.
  - Built-in suggestions: `56/56` correct, `0` wrong.
  - Blank/artifact suggestions: `3/3` correct, `0` wrong.
  - Combined: `59/59` correct, `0` wrong, `38` rescues, `0` harmed current-correct yellow reads.
- `npm run build` passed.

Files changed:

- `package.json`
- `src/App.vue`
- `scripts/eval_combined_review_assist.mjs`
- `SCANGRADE_ACTIVE_HANDOFF.md`
- `docs/SCANGRADE_ACCURACY_ROADMAP_20260705.md`

Decision:

- Keep this change. It makes the review-assist path more measurable and more visible without risking the auto lane.
- Do not claim this improves automatic OCR coverage. The auto benchmark remains `205/374`; this improves the teacher-review workflow around yellow cases.

Next action:

1. Build a replay-equivalent blank/artifact suggestion source that can be produced by app-side code, not only offline simulation.
2. Validate it against handwritten truth and split labels before exposing it in the public UI.
3. Continue attacking non-row recognition coverage separately with crop/preprocessing/model improvements.

## 2026-07-08 Targeted Six-From-Five Review Suggestion Gate

Continued the non-row/yellow-volume push by investigating the largest remaining uncovered single-digit confusion in the latest replay: yellow answers where the current leaning read is `5` but handwritten truth is `6`.

What changed:

- Added `scripts/search_six_from_five_review_gate.mjs`.
- Added package script `npm run search:six-five-review-gate`.
- Lowered the review-only `6`-from-`5` independent evidence gate from `0.75` to `0.25` in:
  - `src/components/CameraCapture.vue`
  - `scripts/replay_live_ocr_captured.mjs`
  - `scripts/eval_review_suggestion_policy.mjs`
- This only affects likely-read suggestions for already-yellow review answers. It does not auto-correct, auto-grade, clear review, or change the score.

Evidence:

- Report: `private-evidence/reports/nonrow-next-push-20260708/six-from-five-review-gates.json`
- Input replay: `private-evidence/reports/variant-topk-leading-one-review-20260707-full-browser/`
- Truth input: `private-evidence/truth-labels/20260703-flex-duplicate-accepted-needs-label/handwritten-truth-labelled.json`

Result:

- Candidate `5 -> 6` review-only cases without existing suggestions: `9`.
- Old `0.75` gate: `0` suggestions.
- New `0.25` gate with at most one changed slot:
  - `2` suggestions.
  - `2/2` correct.
  - `0` wrong.
  - `2` rescues.
  - Split coverage: `1` validation correct, `1` holdout correct.
  - Family coverage: `1` row correct, `1` non-row correct.

Commands run:

```text
node --check scripts/search_six_from_five_review_gate.mjs
node --check scripts/replay_live_ocr_captured.mjs
node --check scripts/eval_review_suggestion_policy.mjs
node scripts/search_six_from_five_review_gate.mjs
npm run build
```

Decision:

- Keep this as a small review-assist ratchet.
- Do not overstate it: this is not a market-ready OCR breakthrough, and it does not improve automatic coverage.
- It slightly expands the safe review-suggestion set while preserving the auto-lane trust anchor.

Next action:

1. Continue looking for narrow repeated patterns that add correct review suggestions without wrong suggestions.
2. For larger gains, move beyond threshold gates toward non-row crop/preprocessing/model work, especially ten frames, dot collections, number bonds, number patterns, and place value.

## 2026-07-08 Non-Row Variant-Lane Push

Date / thread:
2026-07-08 / SG 3.

What changed:

- Added `scripts/analyze_nonrow_variant_lanes.mjs` and package command `npm run analyze:nonrow-variant-lanes`.
- Added a tiny review-only no-key non-row leading-one suggestion path.
- The new suggestion source is `no-key-non-row-leading-one-review`.
- It only fires on Grade 1 last-week non-row layouts when:
  - the answer is already yellow/review,
  - the left slot currently reads `7`,
  - a preprocessing variant reads that left slot as `1` with confidence at least `0.25`,
  - and all companion slots are stable, not review-needed.
- It does not change score, does not clear review, and does not affect auto-grading.
- Candidate selection now filters unsafe candidates before choosing the best safe suggestion, so a rejected answer-key-context candidate does not prevent a safe no-key candidate from being considered.

Evidence used:

- Latest full browser replay: `private-evidence/reports/variant-topk-leading-one-review-20260707-full-browser/`
- Truth labels: `private-evidence/truth-labels/20260703-flex-duplicate-accepted-needs-label/handwritten-truth-labelled.json`
- Digit rows: `private-evidence/reports/digit-failure-dataset-20260705-current/digit-rows.json`

Results:

- Non-row variant-lane report: `private-evidence/reports/nonrow-variant-lanes-20260708/summary.json`
  - Non-row filled slots: `231/340` current-correct (`67.9%`).
  - Wrong non-row filled slots with correct digit somewhere in variants: `92/109` (`84.4%`).
- Broader replay report: `private-evidence/reports/nonrow-variant-lanes-20260708/current-abc-summary.json`
  - Non-row filled slots: `354/545` current-correct (`65.0%`).
  - Wrong non-row filled slots with correct digit somewhere in variants: `154/191` (`80.6%`).
- Labelled policy evaluator: `private-evidence/reports/review-suggestion-policy-20260708/nonrow-left-seven-one-no-key-stable-companion/summary.json`
  - `83/83` yellow suggestions correct.
  - `0` wrong suggestions.
  - Non-row: `65/65` correct.
- Full browser replay: `private-evidence/reports/nonrow-left-seven-one-stable-companion-20260708-full-browser/truth-score.json`
  - Auto/confident: `205/374`.
  - Auto-correct: `205/205`.
  - Auto-wrong: `0`.
  - Yellow suggestions: `57/57` correct, `0` wrong.
  - Non-row suggestions: `42/42` correct, `0` wrong.
- Combined review-assist: `private-evidence/reports/combined-review-assist-20260708/nonrow-left-seven-one-stable-companion-summary.json`
  - `62/169` yellow answers get a suggestion.
  - `62/62` suggestions correct.
  - `0` wrong.
  - `41` rescues.

Important lesson:

- A slot-level rule can be perfectly safe and still produce a wrong whole-answer suggestion if a companion slot is unstable.
- The no-key `7 -> 1` lane was only kept after adding the stable-companion requirement.
- Larger non-row gains should be trained/evaluated at whole-answer level, not just digit-slot level.

Commands run:

```text
node --check scripts/analyze_nonrow_variant_lanes.mjs
node scripts/analyze_nonrow_variant_lanes.mjs
node scripts/analyze_nonrow_variant_lanes.mjs --replay private-evidence/reports/current-replay-20260704-general-policy-inkw6-a --replay private-evidence/reports/current-replay-20260704-general-policy-inkw6-b --replay private-evidence/reports/current-replay-20260704-general-policy-inkw6-c --out private-evidence/reports/nonrow-variant-lanes-20260708/current-abc-summary.json
node --check scripts/eval_review_suggestion_policy.mjs
node --check scripts/replay_live_ocr_captured.mjs
node scripts/eval_review_suggestion_policy.mjs --out private-evidence/reports/review-suggestion-policy-20260708/nonrow-left-seven-one-no-key-stable-companion/summary.json
npm run build
node scripts/replay_live_ocr_captured.mjs --url https://localhost:5174 --out-dir private-evidence/reports/nonrow-left-seven-one-stable-companion-20260708-full-browser private-evidence/debug-scans/2026-07-02
node scripts/score_replay_against_handwritten_truth.mjs --out private-evidence/reports/nonrow-left-seven-one-stable-companion-20260708-full-browser/truth-score.json private-evidence/reports/nonrow-left-seven-one-stable-companion-20260708-full-browser
node scripts/eval_combined_review_assist.mjs --replay private-evidence/reports/nonrow-left-seven-one-stable-companion-20260708-full-browser --out private-evidence/reports/combined-review-assist-20260708/nonrow-left-seven-one-stable-companion-summary.json
```

Files changed:

- `src/components/CameraCapture.vue`
- `scripts/replay_live_ocr_captured.mjs`
- `scripts/eval_review_suggestion_policy.mjs`
- `scripts/analyze_nonrow_variant_lanes.mjs`
- `package.json`
- `docs/SCANGRADE_ACCURACY_ROADMAP_20260705.md`
- `SCANGRADE_ACTIVE_HANDOFF.md`

Next action:

1. Continue non-row selector work at whole-answer level.
2. Mine the `84%` variant-opportunity cases for a learned selector, but require zero wrong on validation/holdout and whole-answer scoring.
3. Do not broaden no-key slot corrections unless companion-slot stability and whole-answer truth checks hold.

## 2026-07-08 Combined Review-Assist Benchmark Includes Six-Five Stream

After the `5 -> 6` review-only gate was validated and implemented, the combined review-assist evaluator was updated so the headline review-assist metric includes all current safe suggestion streams.

What changed:

- Extended `scripts/eval_combined_review_assist.mjs` to consume:
  - built-in replay `reviewSuggestion`s,
  - blank/artifact replay-simulation suggestions,
  - `six-from-five` gate suggestions from `private-evidence/reports/nonrow-next-push-20260708/six-from-five-review-gates.json`.
- Suggestion priority is built-in first, blank/artifact second, six-five third.
- The evaluator reports source-specific and combined coverage and detects conflicts between sources.
- No app OCR/capture/homography/scoring behavior changed in this step.

Commands run:

```text
node --check scripts/eval_combined_review_assist.mjs
npm run eval:combined-review-assist
npm run build
node --check scripts/eval_blank_artifact_classifier.mjs
node --check scripts/search_six_from_five_review_gate.mjs
```

Updated combined-review result:

- Baseline:
  - Matched groups: `374`.
  - Auto/confident: `205/374`.
  - Auto-correct: `205/205`.
  - Auto-wrong: `0`.
  - Yellow/manual review: `169`.
- Built-in suggestions: `56/56` correct, `0` wrong, `35` rescues.
- Blank/artifact suggestions: `3/3` correct, `0` wrong, `3` rescues.
- Six-five suggestions: `2/2` correct, `0` wrong, `2` rescues.
- Combined:
  - `61/169` yellow answers get a suggestion.
  - `61/61` suggestions correct.
  - `0` wrong suggestions.
  - `40` rescues.
  - `0` harmed current-correct yellow reads.
  - `0` conflicts between sources.

Decision:

- This is the current review-assisted benchmark: auto-safe coverage remains `205/374`, while review-assisted yellow coverage is now `61/169`.
- Treat this as teacher-review workflow improvement, not automatic OCR coverage improvement.

Next action:

1. Continue searching for narrow, evidence-backed review suggestion gates only if they preserve `0` wrong suggestions on validation/holdout.
2. Start a deeper non-row crop/preprocessing/model track for larger gains; suggestion gates alone will not reach market-ready coverage.

## 2026-07-08 Whole-Answer Non-Row Selector Diagnostic

The next deeper non-row push added an answer-level diagnostic so future work does not overfit slot-level wins that break when the companion slot is wrong.

New analyzer:

- Script: `scripts/analyze_nonrow_whole_answer_variants.mjs`
- Command: `npm run analyze:nonrow-whole-answer-variants`
- Main report: `private-evidence/reports/nonrow-whole-answer-variants-20260708/summary.json`
- Blank-candidate/pattern report: `private-evidence/reports/nonrow-whole-answer-variants-20260708/with-pattern-scores-summary.json`

Commands run:

```text
node --check scripts/analyze_nonrow_whole_answer_variants.mjs
npm run analyze:nonrow-whole-answer-variants
node scripts/analyze_nonrow_whole_answer_variants.mjs --out private-evidence/reports/nonrow-whole-answer-variants-20260708/with-review-blank-candidates-summary.json
node scripts/analyze_nonrow_whole_answer_variants.mjs --out private-evidence/reports/nonrow-whole-answer-variants-20260708/with-pattern-scores-summary.json
```

Main findings:

- Latest replay matched `374` labelled groups.
- Non-row yellow/review groups: `119`.
- Non-row yellow current lean correct: `18/119`.
- Non-row yellow current lean wrong: `101/119`.
- Whole-answer digit-swap oracle: `79/119` non-row yellow answers had the handwritten truth somewhere in candidate variants.
- Whole-answer oracle with analysis-only review-slot blank candidates: `86/119`.
- By layout with blank candidates:
  - `sg-g1-lw-07-dot-collections`: `21/27` candidate-oracle coverage.
  - `sg-g1-lw-06-ten-frames`: `19/29`.
  - `sg-g1-lw-08-number-bonds`: `19/27`.
  - `sg-g1-lw-09-number-patterns`: `15/23`.
  - `sg-g1-lw-10-place-value-50`: `12/13`.

Safety result:

- The analyzer searched `1,454,400` whole-answer rule variants.
- The only full-corpus zero-wrong rule family with coverage in calibration, validation, and holdout was still `left:7>1`, matching the already-implemented no-key review-only lane.
- Analysis-only blanking improved oracle coverage, especially ten-frames, but did not yield a deployable hard-coded rule:
  - Example: `right:1>null` on ten-frames was `4` correct and `2` wrong overall, with both wrongs in holdout.
  - No zero-wrong pattern had support in both validation and holdout.

Decision:

- Do not implement a new non-row hard-coded gate from this pass.
- The next meaningful non-row improvement should be a learned answer-level selector or stronger visual blank/artifact classifier, validated on held-out packets.
- Keep auto lane unchanged: no score/auto-confidence changes from this diagnostic.

## 2026-07-08 Learned Selector + Visual Blank Gate Push

Goal:

- Try the next deeper non-row step: a learned answer-level selector and/or a stronger visual blank/artifact classifier.
- Keep this analysis-only unless it preserves held-out safety. Do not use answer key as OCR truth and do not loosen auto-grading.

New/updated tools:

- `scripts/analyze_nonrow_whole_answer_variants.mjs`
  - Added `--candidates-out` and reusable answer-candidate export.
  - Candidate rows written to `private-evidence/reports/nonrow-whole-answer-variants-20260708/candidate-rows.json`.
- `scripts/eval_learned_answer_selector.mjs`
  - npm: `npm run eval:learned-answer-selector`
  - Analysis-only logistic answer selector over exported whole-answer candidates.
- `scripts/analyze_visual_blank_candidate_gate.mjs`
  - npm: `npm run analyze:visual-blank-candidate-gate`
  - Analysis-only bridge between whole-answer blank candidates and visual blank/artifact slot scores.

Commands run:

```text
node --check scripts/analyze_nonrow_whole_answer_variants.mjs
node scripts/analyze_nonrow_whole_answer_variants.mjs --out private-evidence/reports/nonrow-whole-answer-variants-20260708/selector-export-summary.json --candidates-out private-evidence/reports/nonrow-whole-answer-variants-20260708/candidate-rows.json
node --check scripts/eval_learned_answer_selector.mjs
npm run eval:learned-answer-selector
node scripts/eval_learned_answer_selector.mjs --out private-evidence/reports/learned-answer-selector-20260708/no-truth-leak-threshold-summary.json
node scripts/eval_learned_answer_selector.mjs --train-splits calibration,validation --safety-splits calibration,validation --out private-evidence/reports/learned-answer-selector-20260708/train-calibration-validation-holdout-test-summary.json
node scripts/eval_learned_answer_selector.mjs --train-splits calibration,validation --safety-splits calibration,validation --max-changed-slots 1 --out private-evidence/reports/learned-answer-selector-20260708/train-calibration-validation-max1-holdout-test-summary.json
node --check scripts/analyze_visual_blank_candidate_gate.mjs
npm run analyze:visual-blank-candidate-gate
node scripts/analyze_visual_blank_candidate_gate.mjs --max-changed-slots 2 --out private-evidence/reports/visual-blank-candidate-gate-20260708/max2-summary.json
```

Learned answer-level selector findings:

- First implementation accidentally included a truth-derived `currentCorrect` feature; this was removed before evaluating the usable result.
- No-truth-leak selector trained on calibration only was too conservative to matter:
  - selected `1` full-corpus answer, `1/1` correct, `0` wrong.
- Training on calibration+validation looked attractive in-sample but failed holdout:
  - `14/14` correct on calibration+validation at the selected zero-wrong safety threshold.
  - Holdout: `1` selected, `0` correct, `1` wrong.
  - Full: `15` selected, `14` correct, `1` wrong.
- One-slot-only learned selector also failed holdout:
  - Calibration+validation: `17/17` correct.
  - Holdout: `2` selected, `0` correct, `2` wrong.
  - Full: `19` selected, `17` correct, `2` wrong.
- Failure pattern:
  - The learned selector overfits plausible variant patterns like `left:9>1`.
  - Those patterns are sometimes real rescues, but held-out student work includes cases where they create confident wrong answer suggestions.

Visual blank/artifact gate findings:

- Existing visual-only blank replay remains safe but tiny:
  - Matched groups: `374`.
  - Baseline auto/confident: `205/374`, `205/205` correct, `0` wrong.
  - Visual blank suggestions: `3/3` correct, `0` wrong, `3` rescues.
- New whole-answer visual blank candidate analyzer:
  - One-slot blank-only candidates: `100`.
  - Correct blank candidates available: `5`; wrong blank candidates: `95`.
  - Best zero-wrong threshold: `2/2` correct, `0` wrong, `2` rescues.
  - Both safe rescues are validation-only ten-frame cases; no holdout support.
- Two-slot / blank-plus-rewrite candidates are unsafe:
  - `715` blank-like candidates.
  - Correct: `10`; wrong: `705`.
  - No zero-wrong threshold exists.
  - At low thresholds the analyzer immediately selects wrong candidates because the blank evidence can be strong while the companion digit rewrite is wrong.

Decision:

- Do not ship the learned answer-level selector.
- Do not broaden visual blanking beyond the current very conservative review-assist behavior.
- Keep these tools as diagnostics for the future OCR/model track.
- The next meaningful product improvement is not another hand-coded gate; it is stronger digit recognition and/or crop normalization for non-row sheets, validated against the same calibration/validation/holdout split.

## 2026-07-08 Trusted OCR Suggestion Promotion Patch

Goal:

- Improve non-row confidence without using answer-key-only context as OCR truth.
- Preserve the current hard safety line: no confidently wrong reads in the accepted/truth-labeled replay set.

Code changes:

- `src/components/CameraCapture.vue`
  - Added `trustedOcrSuggestionPromotionEvidence()` and `applyTrustedOcrSuggestionPromotions()`.
  - Wired the promotion pass into the live grading pipeline after conservative blank/context review helpers.
- `scripts/replay_live_ocr_captured.mjs`
  - Added matching replay implementation and console/debug output for `trustedOcrSuggestionPromotions`.
- `src/App.vue`
  - Bumped visible build label to `2026.07.08-0935-EDT-sg3-trusted-ocr-suggestions`.

Promotion rule:

- Only promotes `ocr-alternative-review` suggestions.
- Refuses `answer-key-context-review` and `no-key-non-row-leading-one-review`.
- Requires suggestion confidence `>= 0.85`.
- Requires each changed digit slot to have non-answer-key evidence at `>= 0.85` from the current read, model top-k, variant read, or variant top-k.
- Requires unchanged digit slots to have non-answer-key evidence at `>= 0.75`.
- Requires blank/optional slot evidence at `>= 0.72`.
- Marks promoted predictions with `robustOverride: trusted-ocr-suggestion`, `confidencePolicyClearanceReason: trusted-ocr-suggestion`, and `trustedSuggestionPromotion` audit metadata.

Verification:

```text
node --check scripts/replay_live_ocr_captured.mjs
npm run build
node scripts/replay_live_ocr_captured.mjs --allow-imperfect --url https://127.0.0.1:5174 --out-dir private-evidence/reports/trusted-ocr-suggestion-promotion-20260708-full-browser private-evidence/debug-scans/2026-07-02
node scripts/score_replay_against_handwritten_truth.mjs --out private-evidence/reports/trusted-ocr-suggestion-promotion-20260708-full-browser/truth-score.json private-evidence/reports/trusted-ocr-suggestion-promotion-20260708-full-browser
```

Replay/truth result:

- Matched handwritten-truth groups: `374`.
- Auto/confident before this patch: `205/374`, `205/205` correct, `0` wrong.
- Auto/confident after this patch: `225/374`, `225/225` correct, `0` wrong.
- Yellow/review groups dropped from `169` to `149`.
- Row auto/confident after patch: `134/176` (`76.1%`), `0` wrong.
- Non-row auto/confident after patch: `91/198` (`46.0%`), `0` wrong.
- Non-row improved from `79/198` (`39.9%`) to `91/198` (`46.0%`).
- Remaining weak non-row families: ten frames, dot collections, number bonds, number patterns.

Decision:

- This is safe to carry forward as a narrow reliability improvement.
- It is not enough to make ScanGrade market-ready by itself.
- Next best work: improve digit/crop/model normalization so answer-box position no longer changes recognition quality, with held-out packet validation before any broader confidence expansion.

## 2026-07-08 OCR Selector Normalization Follow-Up

Goal:

- Continue the non-row reliability push for ten frames, dot collections, number bonds, and number patterns.
- Prefer general OCR/model evidence over answer-key/context rescue.
- Keep the hard launch-trust line: `0` confidently wrong OCR reads against handwritten truth.

What changed:

- Relaxed the trusted OCR-only promotion gate in both live and replay:
  - `src/components/CameraCapture.vue`
  - `scripts/replay_live_ocr_captured.mjs`
- The gate still only promotes `ocr-alternative-review`.
- It still refuses answer-key-context suggestions and no-key non-row leading-one suggestions.
- New thresholds:
  - suggestion confidence `>= 0.75` instead of `>= 0.85`
  - changed-slot non-answer-key evidence `>= 0.79` instead of `>= 0.85`
  - unchanged-slot evidence `>= 0.65` instead of `>= 0.75`
  - blank/optional slot evidence remains `>= 0.72`
- Updated visible build label to `2026.07.08-1048-EDT-sg3-ocr-selector-normalization`.

Verification:

```text
node --check scripts/replay_live_ocr_captured.mjs
npm run build
node scripts/replay_live_ocr_captured.mjs --allow-imperfect --url https://127.0.0.1:5174 --out-dir private-evidence/reports/nonrow-normalization-20260708/ocr-promotion-relaxed-full-browser private-evidence/debug-scans/2026-07-02
node scripts/score_replay_against_handwritten_truth.mjs --out private-evidence/reports/nonrow-normalization-20260708/ocr-promotion-relaxed-full-browser/truth-score.json private-evidence/reports/nonrow-normalization-20260708/ocr-promotion-relaxed-full-browser
```

Result vs previous trusted-promotion build:

- Matched handwritten-truth groups: `374`.
- Auto/confident improved from `225/374` to `233/374`.
- Confident OCR accuracy stayed `233/233`, `0` wrong.
- Yellow/review groups dropped from `149` to `141`.
- Row auto/confident improved from `134/176` to `136/176`.
- Non-row auto/confident improved from `91/198` to `97/198`.
- Non-row confident accuracy stayed `97/97`, `0` wrong.

Rejected experiments:

- Optional-blank gate relaxation:
  - Tested `suggestion >= 0.45` and optional blank evidence `>= 0.28`.
  - Result: `234/374` auto, `0` wrong, but the only gain was one row-sheet read; non-row stayed `97/198`.
  - Reverted because it added looseness without solving the target problem.
- Enabling the existing legacy preprocess consensus selector:
  - Result: `232/374` auto, `230/232` correct, `2` confidently wrong.
  - Non-row became `98/198` auto but with `2` confident wrong reads.
  - Reverted. The consensus selector is too eager for current non-row crops.

Interpretation:

- The right digit is often present in OCR variant evidence, but broad consensus can still choose the wrong digit confidently on visual-layout pages.
- The safest current improvement is answer-level OCR-only promotion with conservative thresholds.
- The remaining non-row gap is not primarily a confidence-policy problem. It needs better crop/model normalization or a learned selector trained and validated on held-out handwritten truth before promotion can be broadened.

## 2026-07-08 Learned Selector And Crop Normalization Trial

Goal:

- Try both next candidates Tony asked for:
  1. better crop/tensor normalization for non-row digit crops;
  2. a learned answer-level selector trained/evaluated against held-out handwritten truth.
- Keep `0` confidently wrong OCR reads as the non-negotiable promotion gate.

Evidence used:

- Latest accepted replay baseline:
  - `private-evidence/reports/nonrow-normalization-20260708/ocr-promotion-relaxed-full-browser`
  - `private-evidence/reports/nonrow-normalization-20260708/ocr-promotion-relaxed-full-browser/truth-score.json`
- Handwritten-truth labels under:
  - `private-evidence/truth-labels/20260703-flex-duplicate-accepted-needs-label/handwritten-truth-labelled.json`
- Saved classroom debug scans under:
  - `private-evidence/debug-scans/2026-07-02`

Commands run:

```text
node scripts/analyze_nonrow_whole_answer_variants.mjs --replay private-evidence/reports/nonrow-normalization-20260708/ocr-promotion-relaxed-full-browser --out private-evidence/reports/nonrow-normalization-20260708/learned-selector-input/whole-answer-summary.json --candidates-out private-evidence/reports/nonrow-normalization-20260708/learned-selector-input/candidate-rows.json
node scripts/eval_learned_answer_selector.mjs --candidates private-evidence/reports/nonrow-normalization-20260708/learned-selector-input/candidate-rows.json --out private-evidence/reports/nonrow-normalization-20260708/learned-selector-calibration/summary.json
node scripts/eval_learned_answer_selector.mjs --candidates private-evidence/reports/nonrow-normalization-20260708/learned-selector-input/candidate-rows.json --out private-evidence/reports/nonrow-normalization-20260708/learned-selector-cal-val/summary.json --train-splits calibration,validation --safety-splits calibration,validation
node scripts/eval_learned_answer_selector.mjs --candidates private-evidence/reports/nonrow-normalization-20260708/learned-selector-input/candidate-rows.json --out private-evidence/reports/nonrow-normalization-20260708/learned-selector-one-slot/summary.json --max-changed-slots 1
node scripts/eval_learned_answer_selector.mjs --candidates private-evidence/reports/nonrow-normalization-20260708/learned-selector-input/candidate-rows.json --out private-evidence/reports/nonrow-normalization-20260708/learned-selector-no-blank/summary.json --exclude-blank-candidates
npm run build
node scripts/replay_live_ocr_captured.mjs --allow-imperfect --url https://127.0.0.1:5174 --out-dir private-evidence/reports/nonrow-normalization-20260708/ink-tight-slot-full-browser private-evidence/debug-scans/2026-07-02
node scripts/score_replay_against_handwritten_truth.mjs --out private-evidence/reports/nonrow-normalization-20260708/ink-tight-slot-full-browser/truth-score.json private-evidence/reports/nonrow-normalization-20260708/ink-tight-slot-full-browser
npm run build
```

Results:

- Whole-answer candidate oracle on the latest baseline:
  - Non-row yellow/review groups: `101`.
  - Correct handwritten answer appears somewhere in candidate variants for `79/101` (`78.2%`).
  - This confirms the signal is often present, but selection is the hard part.
- Learned selector trials:
  - Calibration-only training with safety threshold selected `2/101`, all calibration examples, `0` validation/holdout benefit.
  - Calibration+validation training selected `9/101`, `8` correct and `1` holdout wrong. Rejected.
  - One-slot-only selector selected `3/101`, `1` correct and `2` holdout wrong. Rejected.
  - No-blank selector selected `4/101`, all calibration examples, `0` validation/holdout benefit.
- Crop/tensor normalization trial:
  - Temporarily added an `ink-tight-slot` tensor variant with stricter centering/scaling for virtual digit boxes.
  - Browser replay result: `226/374` auto, `226/226` correct, `0` wrong.
  - Non-row result: `95/198` auto, `95/95` correct, `0` wrong.
  - This is worse than the accepted baseline (`233/374` overall, `97/198` non-row), so the patch was reverted.

Files changed:

- No lasting source changes from this trial.
- Private analysis outputs were written under `private-evidence/reports/nonrow-normalization-20260708/`.

Decision:

- Do not ship the current learned selector. It overfits or helps only calibration examples.
- Do not ship the `ink-tight-slot` normalization. It reduced coverage.
- The next promising technical direction is a stronger visual quality/blank/artifact/digit-shape feature extractor trained at slot level, then consumed by an answer-level selector, with holdout packet validation. A global crop-threshold tweak is too blunt.

Open risks:

- `79/101` candidate-oracle opportunity means there is a large potential gain, but the current feature set does not distinguish truth from plausible wrong alternates reliably enough.
- The strongest failed selector examples show why whole-answer holdout is essential: confident-looking slot changes can produce a wrong complete answer on ten-frame and place-value pages.

## 2026-07-09 Fidelity Isolation And Whole-Answer Review Lane

Full report:

- `docs/SCANGRADE_ACCURACY_EXPERIMENTS_AND_IMPLEMENTATION_20260709.md`

Key results:

- Expanded context digit crops were isolated in a true second preprocessing pass.
- With the experiment on versus off, primary OCR decisions were identical on all 86 pages.
- Baseline remained `323/323` correct automatic answers on the 582-answer truth corpus.
- Context crops were rejected as a product suggestion path: they added five correct answer-key-constrained suggestions but also suggested key `14` for handwritten `16`.
- The adapted, key-blind whole-answer model remains the best complementary lane:
  - validation `105/136` exact;
  - page-block holdout `92/114` exact;
  - at the final review threshold (`minTokenProbability >= 0.98`), `20/22` displayed model disagreements were correct.

Implemented, opt-in only:

- `scripts/serve_trocr_review.py`: optional local/server whole-answer recognizer; rejects answer-key fields.
- `?reviewModelUrl=...`: sends only yellow crops, 2.5-second timeout, no impact on automatic grading, current OCR retained as first teacher choice.
- `?strictPerspectiveCapture=1`: stricter overhead geometry for automatic capture only; manual fallback and default capture behavior unchanged.

Verification:

- production build passes;
- Python service compiles and ran end to end;
- warm batch of eight held-out yellow crops: 922 ms wall time, 7/8 correct;
- answer-key request rejection confirmed;
- built app loaded without browser errors.

Retrospective review A/B simulation:

- 20-packet validation block: correct choice availability improved `25/60 -> 34/60`, with `0` paired losses.
- Untouched holdout block: `13/40 -> 22/40`, with `0` paired losses.
- Combined: `38/100 -> 56/100`; 18 additional yellow answers had the correct transcription available as a tap choice.
- The UI now preserves up to three distinct choices (current OCR first, key-blind whole-answer alternative, and existing suggestion), preventing the new lane from displacing a correct control choice.
- Evidence: `private-evidence/reports/review-lane-ab-simulation-20260709.json`.

Next gate:

- Run a randomized review-time test on at least 20 unseen packets. Promote the review lane only if median review time falls at least 25% with no increase in wrong final transcriptions.
- Do not make the Mac mini, a free cloud tier, or the whole-answer model necessary for core grading completion.

## 2026-07-13 Pre-capture exhaustive fidelity tightening

Full report:

- `docs/SCANGRADE_PRECAPTURE_EXHAUSTIVE_TIGHTENING_20260713.md`

Fresh 374-answer replay baseline:

- `233/374` automatic (`62.3%`), `233/233` matched handwritten truth, zero known confident transcription errors.
- Row coverage `136/176`; non-row `97/198`.

New conclusions:

- Four stronger/local answer-frame registration policies were all worse and introduced `1-4` confident errors. Keep the current conservative registration.
- Blur alone is not the main loss. Perspective/sideways distortion and uneven lighting correlate more strongly with errors.
- Aggressive autocontrast/sharpening reduced whole-answer exact accuracy from `78.8%` to `70.0%`.
- Raw gray crops retain modestly more learnable information than final black 28x28 inputs, but a small raw-crop CNN is not strong enough to replace production OCR.
- The key-blind whole-answer model remains the best complementary lane. It raised correct-choice availability from `38/100` to `56/100` yellow answers; holdout `13/40 -> 22/40`.
- Even highly confident whole-answer disagreements can be wrong on authentic incorrect math. Keep the model suggestion/review-only pending new-packet shadow evidence.
- A local CPU service was restored: 20 crops in about 3.1 seconds wall time. It is feasible as an optional development/fallback lane, not a core availability dependency.
- Absolute capture-quality gates shifted too much across packet blocks. Do not ship a retake threshold yet; log geometry/light metrics on the new captures.

Experiment harness additions (opt-in, default app unchanged):

- `SG_FRAME_REGISTRATION_MODE` in `scripts/replay_live_ocr_captured.mjs`.
- `scripts/analyze_whole_answer_promotion.mjs`.
- `scripts/simulate_capture_retake_gate.mjs`.
- `requirements-trocr-review.txt` now includes the required `torchvision` version.

Before new packet capture:

- Keep packets intact and retain student/packet grouping.
- Reserve at least two complete packets as untouched holdout; do not select based on handwriting neatness.
- Use even diffuse light and keep the device parallel to the page; do not apply camera/image enhancement.
- Verify one non-holdout debug capture before bulk scanning.
- Do not push/deploy any experiment from this review without a separate decision.

## 2026-07-13 Hybrid V2 parallel build

Hybrid V2 now exists as an opt-in path alongside the unchanged control. It is not deployed or enabled by default.

Implemented:

- Opt-in capture preservation of the best three frames from the existing eight-frame automatic burst.
- Independent current digit OCR plus a key-blind whole-answer service on yellow answers.
- Exact cross-frame consensus recorded in shadow mode; it cannot automatically promote a yellow answer.
- Current browser OCR remains the first teacher choice; the service can only add a review choice.
- One-tap review records the choice source and review duration and advances to the next yellow answer.
- Mission Control privately stores burst evidence and includes its count in scan summaries.
- Portable container boundary for the whole-answer service. The private adapter and student evidence are excluded.
- Reproducible four-packet assignment tool and prospective capture protocol: three development packets, one locked test, eight unscanned reserves.

Verification:

- Control replay remains exactly `233/374` automatic and `233/233` correct, with `141` yellow answers.
- Unit tests cover key normalization, consensus safety, no single-model promotion, control priority, and packet assignment.
- Production build, Mission Control syntax check, and `git diff --check` pass.
- Service smoke test returned frame-indexed results, rejected an answer-key request with HTTP 400, and emitted the configured allowed-origin header.
- Privacy recheck after hardening: a disallowed origin receives HTTP 403 before image processing; an allowed-origin answer-key request receives HTTP 400; responses are `no-store`; a permitted local crop returned a frame-indexed key-blind result in 292 ms inference time.
- Hybrid burst memory is bounded to the best three canvases rather than all eight. On 115 saved 1440x1864 captures, three JPEG/base64 frames are estimated at 1.84 MB median and three raw RGBA canvases at 32.2 MB before browser/GPU overhead. Old-device measurement remains prospective.
- Saved single-frame review evidence improves correct one-tap choice availability `38/100 -> 56/100`; untouched block `13/40 -> 22/40`, with no paired losses.
- Correlated pseudo-frame simulations produce 13-14 shadow-eligible correct reads in 100 yellow answers and zero observed errors, but are not evidence for promotion.

Files:

- `src/hybrid-recognition.js`
- `tests/hybrid-recognition.test.mjs`
- `scripts/compare_control_hybrid_v2.mjs`
- `scripts/analyze_pseudo_frame_consensus.mjs`
- `scripts/create_four_packet_capture_plan.mjs`
- `docs/SCANGRADE_HYBRID_V2_ARCHITECTURE.md`
- `docs/SCANGRADE_FOUR_PACKET_CAPTURE_PROTOCOL.md`
- `Dockerfile.review`

Private reports:

- `private-evidence/reports/hybrid-v2-control-check-20260713/truth-score.json`
- `private-evidence/reports/control-vs-hybrid-v2-20260713.json`
- `private-evidence/reports/pseudo-frame-consensus-20260713.json`
- `private-evidence/reports/hybrid-capture-payload-20260713.json`

Prospective gate:

- Label the physical packets `P01-P12` without inspecting handwriting, then run `npm run plan:four-packet-capture -- --out private-evidence/capture-plans/four-packet-plan.json`.
- Scan only the assigned four intact packets. Freeze on the three development packets and open the locked packet once.
- Do not enable automatic hybrid promotion from this corpus alone. First decide whether the review assistant improves correct-choice availability/review time without increasing final transcription errors.
- The in-app browser test surface failed to attach during the final local UI check. This was a browser-tool attachment failure, not an observed ScanGrade runtime failure; rerun the interactive camera/review smoke test before handing the capture URL to Tony.

Prospective assignment was frozen privately before handwriting inspection:

- `P08`: development 1
- `P03`: development 2
- `P09`: development 3
- `P02`: locked test
- Keep `P01`, `P04-P07`, and `P10-P12` unscanned.
- Source: `private-evidence/capture-plans/four-packet-plan.json`.

Private runtime prepared on 2026-07-13:

- Hybrid app is running on local port `5174`; the existing tailnet root proxy was repaired to use the Vite HTTPS endpoint and returned HTTP 200.
- Offline key-blind recognizer is running on `127.0.0.1:8766`, exposed tailnet-only at `/review-model`; prefixed health returned HTTP 200 with the configured origin and `no-store`.
- Mission Control debug receiver is running on `127.0.0.1:8787`, exposed at `/mission-control` with a dedicated capture token kept out of repository documentation.
- The complete private capture URL returned HTTP 200. Processes are development sessions, not durable production services; verify all three health paths immediately before physical scanning.

Prospective evaluation hardening completed after the runtime was prepared:

- Capture URLs now record `packetId`, `captureRole`, capture-plan seed, and a stable scan-session ID.
- Each one-tap/manual correction sends a lightweight cumulative telemetry update with choice source and duration; images are not re-uploaded.
- Accepted scans now carry bounded camera-gate telemetry: attempts, rejection reasons, elapsed capture time, and no additional images. This separates capture friction from OCR/model failures without changing the gate.
- Mission Control persists and summarizes the new identity fields.
- `scripts/create_hybrid_truth_template.mjs` creates key-free development labels only after scans exist.
- `scripts/evaluate_hybrid_v2_packets.mjs` keeps transcription/math/review separate, groups correction versions, reports capture failures, excludes locked data by default, rejects duplicate successful pages, and requires two distinct labelers.
- `scripts/freeze_hybrid_v2_policy.mjs` hashes code, models, layouts, evaluator, and packet plan. Locked scoring refuses to run after drift.
- Synthetic evaluator, duplicate-rejection, truth-integrity, correction-version joining, and live metadata-storage checks pass. Hybrid test suite now has 15 passing tests.

## 2026-07-13 P08 prospective capture and confidence audit

Tony captured all ten pages of intact development packet `P08`. The intake contains ten unique scan-session IDs and ten layouts; paired debug records are pipeline stages, not accidental rescans. All ten camera captures passed on the first attempt and retained three of eight burst frames. Nine pages completed live V3 shadow processing; page 10 retained complete source evidence and was reconstructed by saved-frame replay after the browser was left before its asynchronous upload finished.

Primary handwritten-truth transcription was created from the warped page images for all 70 answers. It remains provisional until a second person checks every answer against the physical pages. The math answer key was not used as transcription truth; one visibly written incorrect math answer (`16` where the key says `15`) remains labelled `16`.

Provisional P08 control result:

- V2 automatic: `42/70` (`60.0%`), with `42/42` matching primary handwritten truth and zero observed confident errors.
- V2 all-answer transcription: `44/70`.
- A correct read appeared among the three V3 reader outputs for `65/70` (`92.9%`), indicating that selection/abstention is the main bottleneck on this packet.

A TrOCR confidence defect was found and fixed: EOS/control-token probability had been included in answer confidence, sometimes reducing a correct stable digit to zero confidence. The service now measures only tokens contributing visible digits and separately reports generation confidence. Two Python regression tests and ten V3 policy/shadow tests pass. Production promotion behavior remains conservative and V3 remains opt-in shadow.

The canonical post-fix three-frame replay completed `10/10` pages with both whole-answer models available. Because a full page rerun changed geometry enough to change 16 of 70 reader outputs, the overall live-versus-replay delta is not attributed solely to the confidence fix. All nine post-fix current-policy accepts occurred among the 54 answers whose three reader reads were unchanged, and all nine matched provisional truth.

A research-only fallback rule—large and compact readers agree against slot OCR, with identical large-model output on all three frames—would add ten correct answers over the V2 automatic set on this replay. That produces `52/70` (`74.3%`) V2-plus-fallback coverage with zero observed confident errors on provisional P08 truth. This rule is **not promoted**: P08 needs independent truth verification, and the rule must survive intact P03 and P09 before the locked P02 run.

Private evidence:

- `private-evidence/hybrid-v2-prospective/handwritten-truth-development.json`
- `private-evidence/reports/v3-prospective-p08-primary-provisional.json`
- `private-evidence/reports/v3-p08-visible-token-confidence-replay-canonical/`
- `private-evidence/reports/v3-p08-visible-token-confidence-comparison-primary-provisional.json`

Next physical packet: scan intact `P03` as development packet 2. Then scan intact `P09`, freeze the policy, and only then open locked `P02`. The actual inventory is nine packets, so unscanned reserves are `P01`, `P04`, `P05`, `P06`, and `P07`.

## 2026-07-13 P08 non-row parity candidate

Tony requested a dedicated goal to bring non-row recognition to row parity before scanning P03/P09. P08 crop tracing found a material fidelity defect in the V3 path: the original camera capture contained clear handwriting, but the ordinary warped image used for continuous zones contained white slot-cleanup masks over portions of the handwriting. V2 remains unchanged; the repair re-warps a fresh copy of the untouched camera image using the page anchors already detected by V2, then sends the continuous grayscale zone to the key-blind adapted large reader.

Rejected variants:

- Layout-only zone anchoring corrected one diagonal-line miss but worsened other number-bond crops/reads.
- Aggressive answer-frame and divider erasure removed useful strokes/context and worsened both learned readers.

Frozen research rule:

- Only consider answers already routed to V2 review.
- Use the adapted key-blind large-model read from the fresh continuous zone.
- Require the identical read on all three retained real frames, no tie, and minimum visible-token confidence `>= 0.70`.
- Compact agreement is not required for this candidate; it remains recorded as advisory evidence.

P08 primary-label-only result:

- Row: V2 `27/40` automatic; frozen fallback `32/40` (`80.0%`), zero observed errors.
- Non-row: V2 `15/30` automatic; frozen fallback `26/30` (`86.7%`), zero observed errors.
- Overall: V2 `42/70` (`60.0%`); frozen fallback `58/70` (`82.9%`), zero observed errors.
- Large fresh-zone reader alone matched primary truth on `59/70`: row `35/40`, non-row `24/30`.
- The visibly incorrect student math answer remains transcribed as written and remains review; the key was not used as handwriting truth.

This reaches the P08 non-row parity target but is not production evidence. P08 labels require a second human check, and three frames are correlated evidence from one student. The exact 59-file code/model/layout/config manifest is frozen and verifies cleanly at:

- `private-evidence/v3-prospective/nonrow-parity-policy-freeze-p08.json`
- Candidate definition: `private-evidence/v3-prospective/nonrow-parity-policy-candidate.json`
- Score: `private-evidence/reports/v3-p08-fresh-zone-parity-primary-provisional.json`

Do not tune further on P03/P09. Capture intact P03 next, score it once against the frozen rule, then capture/score intact P09. Do not open P02 unless the frozen candidate survives both prospective development packets without a confident transcription error or a major coverage collapse.

## 2026-07-13 prospective evaluator freeze

Before any P03 upload existed, the one-shot P03/P09 evaluator was implemented, tested, and separately frozen. It verifies the unchanged P08 main freeze before reading scans; requires the assigned packet identity/role/seed, exactly one successful session for each of the ten expected layouts, three retained frames, complete V3 evidence, and handwritten truth that is distinct from the math key. It applies exactly the frozen V2-review-only, large-reader 3-of-3, no-tie, minimum-confidence-0.70 rule. Teacher corrections are rejected as contamination and never used. Output is write-once (`wx`).

Promotion gates are: independently verified truth, valid packet integrity, all 10 pages/70 answers, zero frozen automatic errors, zero fallback-promotion errors, non-row coverage at least 82.5%, and non-row coverage no more than five percentage points below row coverage. Primary-only labels can be scored only as provisional and cannot pass promotion.

Artifacts:

- Evaluator: `scripts/evaluate_v3_frozen_prospective.mjs`
- Protocol: `private-evidence/v3-prospective/prospective-evaluator-protocol.json`
- Protocol freeze: `private-evidence/v3-prospective/prospective-evaluator-freeze.json`
- Protocol-freeze SHA-256: `4650963d4adf3565d62acff44637c8c886c222381b49b3d7ce6c526d428038eb`
- Main-freeze SHA-256: `36e9f34bd3a20d81cb9eec9f8ad433810fafdc479144d5c601b500b3eccbdc89`
- Tests: `tests/v3-frozen-prospective.test.mjs` (3 passing)

Do not modify any file covered by either freeze before P03 and P09 are scored. As of the freeze, no P03 debug upload was present.

## 2026-07-13 complete historical fresh-image stress test

All 86 available historical original page captures were reprocessed through the new untouched-camera re-warp, fresh continuous-zone extraction, adapted large reader, and compact reader. The run completed with zero page failures and joined exactly 582/582 handwritten-truth entries. This is broad retrospective R&D evidence, not a prospective result: most pages have only one retained image, the corpus influenced development, and 276 labels are weaker `seeded-auto-correct` labels. Results on the 302 manually labelled answers are reported separately.

Main findings:

- Before the later visual truth audit, large-reader all-answer accuracy appeared to be `468/582` (`80.4%`); row `219/264` (`83.0%`), non-row `249/318` (`78.3%`). The corrected result below supersedes this figure.
- A subsequent full-page 1/7 truth audit corrected four manual labels without overwriting the source dataset: `72→12`, `73→13`, `76→16`, and a separately noticed `47→42`. The first three were serif-style 1s confirmed from repeated same-writer forms; the fourth preserves a clearly written but mathematically incorrect 42.
- Corrected large-reader all-answer accuracy is `472/582` (`81.1%`); row `219/264` (`83.0%`), non-row `253/318` (`79.6%`).
- Any recorded reader candidate contained the corrected transcription on `559/582` (`96.0%`); on manual truth, `283/302` (`93.7%`). Selection and abstention remain the bottleneck, but 23 cases still lacked the correct candidate.
- The large reader was materially better on one-digit answers (`232/268`, `86.6%`) than two-digit answers (`236/310`, `76.1%`). The remaining four labels were true blanks. Multi-digit sequence recognition is therefore still a distinct weakness.
- Fresh V2 replay accepted row `189/264` (`71.6%`) and non-row `119/318` (`37.4%`). It exposed one manual-truth V2 error (`4` read as `9`), unlike the earlier exact stored-zone control. Fresh full-page geometry is therefore not interchangeable with the exact prior replay.
- On V2-review answers, accepting a single high-confidence large read would add 225 decisions but make 29 errors after truth correction. Requiring both learned readers to agree and both confidences to be at least `0.70` would add 152 decisions and make one visually verified error (`45`→`15`). A separate number-bond miss was an empty/mislocated fresh crop.
- The diagnostic two-model lane would produce selected coverage of row `237/264` (`89.8%`) and non-row `223/318` (`70.1%`), but it still has that one unsafe error and is not the frozen policy. The broad historical evidence therefore says non-row is still materially harder; P08's non-row-above-row result is encouraging but not established.

Artifacts:

- Replay: `private-evidence/reports/v3-historical-fresh-replay-20260713/`
- Score: `private-evidence/reports/v3-historical-fresh-replay-20260713-score.json`
- Visually audited score: `private-evidence/reports/v3-historical-fresh-replay-20260713-score-visual-audited.json`
- Non-destructive truth corrections: `private-evidence/truth-labels/20260703-flex-duplicate-accepted-needs-label/visual-audit-corrections-20260713.json`
- Research-only runners: `scripts/run_v3_historical_fresh_replay.mjs`, `scripts/score_v3_historical_fresh_replay.mjs`

Do not use this replay to retune the already-frozen P08 rule. The next decisive evidence remains intact prospective P03 and P09, whose real three retained frames can test whether 3-of-3 stability rejects the selected-frame historical failures.

## 2026-07-14 P02 truth verification and answer-zone crop audit

Completed the requested sequence: independently verified P02 truth, diagnosed the five P02 mixed-sheet and four number-bond reviews from saved images, built a narrow crop candidate without changing recognition/confidence policy, replayed all four scanned packets, and decided whether to spend a reserve.

Key findings:

- Blind P02 verification corrected number-bond Q6 from `31` to `3`; number-bond Q4 and place-value Q3 are overwritten and excluded. P02 has 68 scorable values from 70 answers.
- Mixed-sheet failures were a real geometry bug: two-column answer-frame assignment was hard-coded for 10 frames and misassigned several of the 8 detected frames. The candidate supports even two-column counts of at least 8; six-answer layouts keep the prior path.
- P02 number-bond crops already contain the handwriting. Remaining failures are reader/frame inconsistency and a one-slot metadata/worksheet mismatch for a written `19`, not a broad crop-fidelity loss.
- Full saved-frame replay completed 40/40 pages and 275 scorable values. V2 alone accepted 173 and all 173 matched truth. The frozen overlay accepted 246, but one was wrong: P09 number-pattern Q1, handwritten `34`, was read as `39` on all three large-model frames. The compact reader disagreed (`22`). The error persisted after the six-answer crop path was reverted, so it is not caused by the new eight-frame crop assignment.
- Row overlay replay: 146/160 automatic, zero observed errors. Non-row: 100/115 automatic, one error. Overall 245/246 automatic reads correct at 89.5% coverage; this fails the zero-error gate.

Decision:

- Do not enable the whole-answer fallback for automatic grading. Keep it review-only.
- Keep the narrowed eight-frame crop fix as an undeployed candidate for the conservative OCR/review path.
- Do not scan another untouched packet yet. Preserve P01 and P04-P07 until a materially safer decision rule passes the existing replay; another packet cannot repair a known policy failure.

Evidence and reproducibility:

- Report: `docs/SCANGRADE_P02_LABEL_AND_CROP_AUDIT_20260714.md`
- Verified truth: `private-evidence/hybrid-v2-prospective/handwritten-truth-p02-verified.json`
- Final score: `private-evidence/reports/v3-crop-candidate-evaluation-20260714-final.json`
- Runners: `private-evidence/hybrid-v2-prospective/verify-p02-truth.mjs`, `scripts/replay_v3_crop_candidate_packets.mjs`, `scripts/evaluate_v3_crop_candidate.mjs`
- Verification: `npm run test:v3:zones` (8/8), `npm run test:hybrid` (15/15), and `npm run build` passed.
- Nothing was deployed or pushed.

## 2026-07-14 review timing and authenticated service tests

Automated review and authenticated deployment-boundary tests are complete. Full report: `docs/SCANGRADE_REVIEW_AND_AUTH_CLOUD_TEST_20260714.md`.

- Real UI automation completed all 14 row yellow answers across 10 pages: truth choice 14/14, telemetry 14/14, 24 total taps, 56 ms mean and 79 ms p95 click-to-settled latency.
- Local result averaged 3.46 s after upload; strong suggestions averaged 12.63 s, an additional 9.18 s. Suggestion readiness—not correction rendering—is the current UX latency target.
- Testing exposed and fixed two UX defects: auto-advance now skips confidently wrong red answers, and eligible whole-answer suggestions open whole-answer mode for partially uncertain two-digit answers.
- Authenticated strong-service gates passed, with 8/8 parity, but resident memory was about 2.0 GB. It is not a 1 GB/free-container assumption.
- The compact staged context passed 24/24 parity, auth/privacy gates, 82 ms/24 answers, and about 177 MB RSS. It contains four runtime files and zero student evidence.
- Full browser-to-two-authenticated-services test passed using a temporary session-only token; the P03 `15` suggestion was selected and recorded. A paid beta still requires real teacher identity and short-lived token refresh/revocation.
- Both optional endpoints were deliberately disabled; local predictions, grading, yellow flags, and answer groups remained identical. Fail-open passed.
- A genuine teacher reading-time measurement still requires a human. The six-answer protocol is `docs/SCANGRADE_TEACHER_REVIEW_TIMING_PROTOCOL_20260714.md`.
- Nothing was deployed or pushed.

## 2026-07-14 no-new-packet improvement goal completed

Exhaustive work using only saved artifacts is summarized in `docs/SCANGRADE_NO_NEW_PACKET_IMPROVEMENT_REVIEW_20260714.md`.

Production-facing outcome:

- Automatic grading remains the conservative browser policy; no whole-answer fallback was promoted.
- For eight-question row layouts only, the review UI may show a key-blind whole-answer suggestion when at least two of three retained frames agree and consensus minimum confidence is at least 0.80. It never turns yellow green or changes grading.
- Across all 20 saved row pages, truth was available among tap choices for 14/14 yellow answers; all 12 model-derived row choices were correct. Matched comparison found zero grading or review-flag differences across 160 answers.
- Six-question/non-row layouts retain the strict 0.98 display threshold. Broader relaxation exposed the known unsafe P09 number-pattern `34→39`; a fresh replay verified that wrong suggestion is hidden under the final rule.
- After a V3 correction, the UI opens the next yellow item automatically. Correction source, one-tap status, and review duration remain recorded.

Rejected or shadow-only:

- The eight-frame crop candidate gained on the four recent packets but lost one historical large-lane automatic read; production default is restored and the candidate remains opt-in only.
- An alternate-crop review lane added 42 model items and produced zero useful new choices.
- Packet-aware compact retraining, generic-base TrOCR adaptation, same-writer prototypes, and blank/artifact automation failed their gates.
- Gentle continuation of the existing TrOCR adapter improved P09 by 2/70 and P02 original-crop audit by 10/68, but did not improve conservative acceptance and remains review/shadow research only.

Runtime and verification:

- Mac CPU TrOCR: 235 ms for one answer, 1.51 s for eight, 4.27 s for 24; answer-key input rejected. It is suitable for asynchronous review, not as a single point of failure.
- JavaScript tests 41/41, Python confidence tests 2/2, and production build pass.
- Keep the app fail-open: local result must remain available when optional inference is down.
- Do not spend another untouched packet on any unchanged candidate. Next decisive evidence is teacher-timed review, authenticated cloud parity/outage testing, then unseen September classroom data.
- Nothing was deployed or pushed.

## 2026-07-14 yellow-only strong review and compression decision

Full report: `docs/SCANGRADE_YELLOW_ONLY_AND_COMPRESSION_20260714.md`.

- The optional adapted TrOCR service now receives only answers already marked yellow by the unchanged browser policy. It never receives green/red answers merely to re-read the whole page, and it remains review-only and key-blind.
- Matched ten-page UI replay retained truth choices for 14/14 yellow answers, 24 required taps, and four automatic advances. Strong answer-frame requests fell from 240 to 42 (82.5%); added wait after the local result fell from 9.18 s to 6.05 s (34.0%).
- Dynamic int8 compression failed 0/8 parity and regressed both latency and memory. Float16 and bfloat16 preserved 8/8 smoke-test parity and cut memory from about 2.03 GB to 1.24 GB, but were roughly 7.7× and 8.7× slower on the tested CPU.
- Production recommendation: keep the existing float32 strong reader, reduce cost by yellow-only routing, and validate latency/memory again on the actual Linux cloud host. Experimental compression flags are off by default.
- Local grading, recognition policy, confidence thresholds, answer-key separation, and fail-open behavior were not changed. Nothing was deployed or pushed.

## 2026-07-14 storage and larger-grayscale continuation checkpoint

Read `docs/SCANGRADE_STORAGE_AND_CONTINUATION_CHECKPOINT_20260714.md` before continuing.

- Internal storage was critically low (about 562 MiB free). Only archival/reproducible outputs were selected for verified offload to `/Volumes/Tony's Rugged HD/Codex/ScanGrade Offloads/2026-07-14-pre-large-grayscale/`.
- Preserve current debug scans, truth, four-packet evidence, reports, models, code, layouts, tests, and untouched evaluation material locally.
- The next objective is local larger-grayscale recognition: test whether the system can resolve more yellow answers itself by avoiding the degraded 28×28 representation. Keep this shadow/review-only until a matched zero-new-error replay passes.
- Exact current behavior and evidence references are recorded in the checkpoint document.

## 2026-07-14 local larger-grayscale result

Full report: `docs/SCANGRADE_LOCAL_LARGE_GRAYSCALE_INVESTIGATION_20260714.md`.

- The existing 5 MB 64×192 grayscale compact model remains the strongest local candidate generator: top-three truth availability is 232/275 on the four recent packets and 10/14 on current yellows.
- Combined with the browser's existing independent alternatives, local evidence covers 11/14 current yellows. It is not safe for automatic promotion; historical wrong reads exist above 0.995 confidence.
- A robust same-page geometry repair identified four outliers and raised selected candidate availability from 232 to 233. It found a clear missed `6`, but the compact reader still called that visible digit `5`, proving the remaining limit is partly recognition rather than crop quality.
- A synthetic-pretrained replacement improved historical holdout but regressed recent packets; fixed layout crops, pencil/print band-pass digit recognition, and native Apple Vision also failed their gates.
- Recommended architecture remains local-first review choices plus yellow-only optional strong fallback. No OCR/confidence/grading behavior was changed, deployed, or pushed.

## 2026-07-14 overwritten `34` audit and local-first checkpoint

- Tony inspected the actual P09 number-pattern Q1 crop and independently observed that the student appears to have first formed a 9-like mark, leaving the upper loop/indentation, then changed it to a 4. Classify this as genuinely ambiguous overwritten work, not a routine clean-handwriting recognition miss.
- Preserve handwritten truth as `34`. The experimental automatic `39` still counts as unsafe because the final intended answer is 34; an understandable model reading is not permission to silently replace student work.
- The three independent reads were browser `37`, strong three-frame `39`, and compact `22`. That disagreement is a useful overwrite/ambiguity signal and should keep the answer yellow.
- A post-hoc number-pattern-only compact-top-two veto produced 243/275 automatic (88.4%) with zero observed errors on the four recent packets. It remains shadow-only because it was designed after seeing the failure and needs genuinely untouched validation.
- Local-first review is implemented behind `?v3LocalFirstReview=1`: existing browser choices first, up to two immediate compact larger-grayscale choices, then explicit `None of these` for one-question strong review. The strong reader never changes grading.
- Canonical integration timing: local result 4961.2 ms, compact choices 55.5 ms later, one explicit strong request 709.4 ms warm. No strong request occurred before the teacher action, and only the active question's three frames were sent.
- Current conservative reconstruction on 14 recent row yellows: browser choices contained truth for 8, browser plus compact for 10, leaving 4 for on-demand strong. Projected strong frame requests fall from 42 yellow-only eager requests to 12, a 71.4% reduction.
- Tests and build pass; nothing was deployed or pushed. Remaining work is an exact full ten-page local-first UI replay, local-first outage recovery, and current-code old-iPad/WebKit emulation before a recommendation.
- Evidence: `private-evidence/reports/v3-overlay-salvage-20260714.json`, `private-evidence/reports/v3-local-first-app-integration-20260714.json`, and `private-evidence/reports/v3-local-first-architecture-evaluation-20260714.json`.

## 2026-07-14 local-first completion checkpoint

- The exact UI evaluator now opens every displayed yellow on all 40 retained four-packet pages: 107 yellows, 104 with scorable handwritten truth and three excluded ambiguous/overwritten answers.
- A real preparation bug was fixed: background optional-AI work now uses the union of underlying review flags and every answer group actually displayed yellow. Some UI yellows previously had valid crops but were omitted from both optional readers.
- The final experimental review candidate preserves up to three browser choices and appends up to three compact larger-grayscale choices. Truth is immediately tappable for 88/104 yellows (84.6%): row 44/50 and non-row 44/54. After an explicit per-answer strong request, truth is available for 90/104 (86.5%); 14 require manual typing.
- Only 16 answers request strong inference (48 frames), an 84.6% reduction versus eagerly sending all 104 scorable yellows. No strong request occurs before `None of these`; no existing choice was removed; all 40 automatic OCR/grade results remained identical.
- The studied ten-page/14-answer correction workflow now resolves 14/14 immediately locally, uses zero strong calls, and takes 24 button taps with four automatic advances. This subset is not the authoritative coverage statistic; use the complete 40-page result above.
- Exact dual-service outage recovery passed. WebKit with an older-iPad viewport/iPadOS 15.7 user agent passed over HTTPS; compact choices arrived 132.9 ms after the local result in that smoke test. A physical old-iPad camera/memory/stability run remains required before beta.
- Tony's inspection confirms P09 number-pattern Q1 contains a 9-like first trace overwritten into a final 4. Keep truth `34`; `39` remains an understandable but unsafe automatic transcription. The post-hoc 243/275 (88.4%) automatic overlay veto remains shadow-only until genuinely untouched evidence exists.
- Nothing was deployed or pushed. The automatic browser policy remains frozen. Evidence: `private-evidence/reports/v3-local-first-all-yellows-ui-20260714.json`, `private-evidence/reports/v3-local-first-workflow-benchmark-20260714.json`, `private-evidence/reports/v3-local-first-failure-recovery-20260714.json`, `private-evidence/reports/v3-local-first-webkit-ipad-20260714.json`.

## 2026-07-14 expanded-context crop checkpoint

- Full report: `docs/SCANGRADE_CONTEXT_CROP_RESULT_20260714.md`.
- A second, wider grayscale crop is now prepared from the untouched canonical page but is review-only and key-blind. It is not sent during the initial local review pass.
- After a teacher taps `None of these`, the compact reader checks only that answer's wider crop. A new visible local choice defers strong inference; otherwise the same action continues to the existing one-question/three-frame strong fallback.
- Exact 40-page replay: initial truth availability remains 88/104; after teacher-triggered fallback it improves from 90/104 to 91/104. Strong requests fall from 16 to 15. The known P03 number-bond `9` is recovered locally.
- All 40 automatic OCR/grade signatures stayed invariant, no initial choice was removed, and manual entry remained available for every yellow answer.
- Reject generic edge/containment gating: worksheet print made it far too noisy. Reject sending primary and context crops in the same immediate model batch: it changed one primary review list and displaced a correct choice.
- Tests 18/18 and production build pass. Nothing was deployed or pushed.

## 2026-07-14 conservative-consensus reliability goal

Date / thread: 2026-07-14, active ScanGrade thread

What changed:

- Added a key-blind safety veto for the demonstrated weak box-safe confidence-clearance path.
- Added a conservative automatic selector requiring exact three-frame large-grayscale agreement, independent compact-model support, slot-compatible answer length, no stable browser-preprocessing conflict, and no ambiguity/safety veto.
- Added ambiguity handling for model-family disagreement, crop clipping, and a narrow weak-override/material-rival pattern.
- Added an experimental application layer that can promote independently transcribed yellow answers, recompute ordinary mathematical grading, annotations, and review state, and preserve incorrect student math. It is available only with `hybridV3=1&v3ConfidenceSafety=1&v3ConsensusPromotion=1` and related V3 evidence flags; production defaults are unchanged.
- Added exact control/candidate scoring and matched-diff scripts.

Evidence used:

- Four recent saved packets P08/P03/P09/P02: 40 pages, 280 answer groups, 275 scorable handwriting labels, five ambiguous labels excluded.
- Historical saved corpus: 582 answers, 578 scorable, used only as a one-frame falsification stress test because authentic adjacent frames are unavailable.
- Separate truth-label overlay corrected two visually verified source-label errors (`16→14` and answer-key-contaminated `6→2`) without modifying the source label files.

Commands run:

- `node scripts/evaluate_consensus_promotion_policy.mjs`
- `node scripts/evaluate_consensus_historical_single_frame_stress.mjs`
- `node scripts/replay_v3_crop_candidate_packets.mjs ...` for full candidate and matched feature-off control
- `node scripts/score_consensus_integration_replay.mjs ...`
- `node scripts/compare_consensus_matched_control.mjs`
- `node scripts/test_consensus_webkit_saved_page.mjs`
- `node scripts/test_local_first_failure_recovery.mjs`
- focused Node tests and production build (see final verification below/report)

Results:

- Exact matched control: 172/275 automatic (62.5%), 172 correct, zero observed wrong.
- Exact candidate: 222/275 automatic (80.7%), 222 correct, zero observed wrong.
- Exact gain: 50/50 correct promotions; +25 row and +25 non-row; zero automatic demotions, zero changed pre-existing automatic outputs, and zero unrelated changes.
- Candidate row: 137/160 (85.6%); non-row: 85/115 (73.9%); one digit: 87/100 (87.0%); two digits: 135/175 (77.1%).
- All 40 pages completed; annotation/review state was consistent; marked sheets were regenerated.
- Historical one-frame stress: 448/578 automatic (77.5%), zero observed wrong; known `4→9` and `45→15` failures stayed review. This is not a substitute for three-frame prospective validation.
- WebKit mobile emulation passed over HTTPS; optional dual-service outage passed fail-open/manual-recovery gates.
- Final focused JavaScript suite passed 37/37 and `npm run build` passed. The existing bundle-size warning remains (about 675 kB minified / 225 kB gzip).
- Candidate freeze manifest created at `private-evidence/protocols/consensus-candidate-freeze-20260714.json`: 33 SHA-256 file identities, policy versions, required flags, model identities, reference metrics, and blinded protocol rules. Because the repository was already dirty, these hashes—not Git HEAD alone—define the candidate.

Files changed:

- `src/v3/confidence-safety.js`
- `src/v3/consensus-promotion.js`
- `src/v3/ambiguity-detector.js`
- `src/v3/consensus-application.js`
- experimental integration in `src/components/CameraCapture.vue`
- focused tests/evaluators under `tests/` and `scripts/`
- `docs/SCANGRADE_CONSENSUS_RELIABILITY_RESULT_20260714.md`
- this ledger/handoff entry

Rollback point:

- Do not pass `v3ConsensusPromotion=1` or `v3ConfidenceSafety=1`. The ordinary production URL and defaults are unchanged. No deployment, push, or commit was made.

Next action:

- Freeze code/model/layout hashes and a blinded scoring protocol. If Tony approves spending one reserve packet, choose it before viewing handwriting quality, label without answer key or predictions, run the frozen candidate once, and do not tune on it. A clean result is a private-beta gate, not proof of zero true error.
- If the blinded gate passes, stage the yellow-only services behind real authentication and test a physical old iPad, hosted latency/outage/privacy, and teacher review time.

Open risks:

- The 80.7% result is post-hoc development evidence from correlated pages/students/templates; it is not a public accuracy claim.
- Two label errors were found, including one answer-key-contaminated label; locked truth needs independent QA.
- Physical old-iPad sustained camera/memory performance and real live-burst behavior remain untested.
- Strong-reader hosted reliability, cold start, privacy operations, and cost remain unproven.
- Non-row coverage (73.9%) still trails row coverage (85.6%).

Full result: `docs/SCANGRADE_CONSENSUS_RELIABILITY_RESULT_20260714.md`.

## 2026-07-14 conservative-consensus private-beta deployment

- Tony explicitly authorized changing, deploying, committing, and pushing the frozen candidate.
- Production default is enabled only on `.ts.net` private deployments. GitHub Pages retains local OCR because no private/authenticated whole-answer service exists there.
- Private URL: `https://hobbes-mac-mini.tail9a3379.ts.net/`.
- Same-origin tailnet-only model routes: `/review-model` and `/v3-compact`.
- Immediate runtime rollback: append `?consensusCandidate=0`.
- Build label: `2026.07.14-consensus-private-beta-1`.
- The Tailscale app had stopped serving even though its process remained present. Restarting the app restored status, DNS, and all configured routes. Both health paths and browser CORS preflights pass.
- Release tests 40/40, standard build, GitHub Pages build, and `git diff --check` pass.
- The in-app browser loaded the new build from the real private URL.
- Live P09 number-pattern smoke after model warm-up: both readers available, consensus enabled, three promotions, overwritten `34` stayed yellow, written wrong-math `40` stayed `40` and became red, marked sheet regenerated.
- First strong request after model cold compilation exceeded the client window and safely produced no promotions; a warmed 15-answer Tailscale batch completed in about 1.65 seconds. Availability remains fail-open.
- Deployment report: `docs/SCANGRADE_CONSENSUS_PRIVATE_BETA_DEPLOYMENT_20260714.md`.
- Source release committed and pushed on `autobuild/safe-20260223`: `2ca7629` (`Promote conservative consensus private beta`).
- Browser build committed as `5d2f8de`; the configured `gh-pages-v2` deployment was triggered by `5ff62c2`.
- GitHub Pages Run 99 (`29381415169`) completed successfully for `5ff62c2`.
- Live public verification: `https://scangradesheets.github.io/draft1/` serves `assets/index-9msytI_D.js`, `assets/index-BU8aNFjE.css`, and build label `2026.07.14-consensus-private-beta-1`.
- Live private verification: `https://hobbes-mac-mini.tail9a3379.ts.net/` serves the same build; both model health endpoints return OK.

## 2026-07-14 evidence-pipeline repair checkpoint

- Full report: `docs/SCANGRADE_EVIDENCE_PIPELINE_REPAIR_20260714.md`.
- Coherent page-level answer-frame registration repaired four of the six originally classified crop failures directly; the other two remain safely yellow (one unstable across frames, one reclassified as recognition/print interference because the crop already contains the answer).
- Physical box geometry is now separate from maximum handwritten length. Number-bond groups can preserve a two-digit transcription such as written `19` inside one printed box, then grade it mathematically wrong without answer-key guessing.
- Optional two-slot handling is now key-blind and allows a single written digit in either physical slot. Removing the former answer-key preference deliberately moved two borderline dot-collection answers back to review.
- The identical-input issue was a candidate-identity/freeze-manifest defect, not random inference. Two independent browser replays now match exactly on crop hashes, probabilities, preprocessing evidence, and selected digits.
- Clean final replay: 40/40 pages, 280/280 groups, 275 scorable; 234 automatic (85.1%), 234 correct, zero observed wrong. Row 144/160 (90.0%); non-row 90/115 (78.3%); one digit 86/100; two digits 148/175. Forty-one answers remain yellow.
- Historical one-frame falsification stress: 457/578 surrogate automatic, zero observed errors; still not proof of three-frame generalization.
- 58 focused tests, layout audit (zero errors), production build, exact determinism comparison, and 55-file candidate-manifest verification pass.
- Candidate freeze: `private-evidence/protocols/evidence-pipeline-candidate-freeze-20260714.json`.
- Nothing from this checkpoint was deployed, committed, or pushed. Do not enable or release it without Tony's explicit approval.

## 2026-07-15 non-row / number-bond candidate checkpoint

- Candidate 2 remains the immutable matched control: 234/275 automatic (85.1%), 0 observed errors; row 90.0%, non-row 78.3%, number bonds 50.0%.
- Separate physical-slot recognition was rejected (49/115 non-row; only 1/11 number-bond yellows recovered).
- Raw alternate crops contained substantial signal but were unsafe alone: the best broad trim produced four confident errors, and the best number-bond crop produced a duplicated `17→1717`.
- Candidate 3 uses alternate pixels only as a conservative corroboration lane. The primary and layout-specific alternate crop must produce the same exact answer on all three frames (six reads total, minimum confidence 0.70), while all existing length, ambiguity, browser-conflict, and confidence-safety vetoes remain in force.
- Number bonds use a crop shifted down 4% of slot height; other non-row layouts use a 4% interior trim. Rows are unchanged.
- Exact 40-page result: 237/275 automatic (86.2%), 237/237 correct; rows 144/160 (90.0%); non-row 93/115 (80.9%); number bonds 13/22 (59.1%). All annotations and marked sheets were consistent.
- Second exact non-row replay: 20/20 pages identical on inputs, probabilities, alternate evidence, decisions, and final application; 93/115 automatic, 0 wrong.
- Remaining non-row yellows: 22 total — 11 cross-frame instability, 7 compact-model disagreement, 3 confidence-safety vetoes, 1 stable browser conflict. Nine are number bonds.
- Complete JavaScript tests 105/105 and production build pass. Candidate manifest verifies 59/59 files.
- Report: `docs/SCANGRADE_NONROW_DUAL_CROP_RESULT_20260715.md`.
- Freeze: `private-evidence/protocols/nonrow-dual-crop-candidate-freeze-20260715.json`.
- Flags remain off by default. Nothing was deployed, committed, or pushed. Candidate 3 should replace candidate 2 only for the next private test after Tony's approval.

## 2026-07-15 candidate 3 private deployment

- Tony explicitly authorized replacing private candidate 2 with candidate 3 and locking it in through commit, push, and private publication.
- Candidate 3 is now the default on `https://hobbes-mac-mini.tail9a3379.ts.net/` only.
- Build label: `2026.07.15-nonrow-dual-crop-private-beta-3`.
- Private `.ts.net` runtime enables `v3NumberBondShiftDown` and `v3NonrowTrimEvidence`; public/non-tailnet hosts leave them off by default.
- Immediate rollback remains `?consensusCandidate=0`, which disables the entire private candidate including both new crop lanes.
- Release validation: 105/105 JavaScript tests, standard build, pruned public build, `git diff --check`, and 63/63 manifest verification pass.
- Live private verification: root loaded with the new build label; strong and compact health routes returned OK; served source contains both candidate 3 feature gates.
- Public GitHub Pages was intentionally not replaced and still serves build `2026.07.14-consensus-private-beta-1` from `gh-pages-v2` commit `5ff62c2`.
- Candidate source commit `6883acf` was pushed to `origin/autobuild/safe-20260223`. Private evidence, student images, model experiments, Mission Control state, and unrelated dirty files were excluded.
- Deployment record commit `d3cdcd3` was also pushed; it directly follows the candidate source commit.
- Deployment report: `docs/SCANGRADE_NONROW_PRIVATE_BETA3_DEPLOYMENT_20260715.md`.

## 2026-07-15 Candidate 3 rugged-drive disaster-recovery backup

- Tony requested a backup sufficient to recover Candidate 3 if the Mac mini were lost.
- A new dated full snapshot was created at `/Volumes/Tony's Rugged HD/Codex Rescue Backups/scan-grade-project-snapshots/scan-grade-candidate3-20260715/project/` without overwriting the older May snapshot or July 14 archival offloads.
- The snapshot contains the complete working tree and `.git`, 23 GB of private evidence, current models, datasets, benchmarks, layouts, tests, handoffs, reports, and deployment instructions. Only reinstallable dependency caches, Finder metadata, and Git's nonportable live fsmonitor socket were excluded.
- Inventory: 82,812 regular files, 5 symlinks, and 33,973,839,429 logical bytes; approximately 346 GiB remained free on the rugged drive.
- Candidate freeze verification run from inside the backup passed 63/63 required SHA-256 identities.
- `git fsck --full` run inside the backup returned exit status 0 with no missing/corrupt objects.
- A complete checksum-mode rsync comparison reread all included source and destination files, returned exit status 0, and reported zero differences.
- Full restore and verification instructions: `docs/SCANGRADE_CANDIDATE3_RUGGED_BACKUP_20260715.md`.
- This protects against loss of the Mac, but not simultaneous loss of both the Mac and rugged drive. An encrypted off-site backup remains the next redundancy layer.

## 2026-07-15 selected-core-crop rescue checkpoint

- Candidate 3 remains the deployed/frozen control: 237/275 automatic (86.2%), zero observed errors.
- A new opt-in research flag, `v3CoreCropEvidence=1`, asks the adapted strong reader to read the selected grayscale answer image plus 2% and 4% interior trims. It may bypass a compact/browser veto only when all three selected crops and all three retained frames agree exactly, the answer fits the slot contract, and no ambiguity or confidence-safety veto exists.
- Final exact 40-page development replay: 250/275 automatic (90.9%), 250/250 correct; rows 150/160 (93.8%), non-row 100/115 (87.0%), 25 yellows.
- The lane adds 13 correct automatic transcriptions over Candidate 3. The overwritten `34→39` remains yellow because the selected crops disagree. A correct written `15` also remains yellow because its existing ambiguity flag is absolute.
- Two complete 40-page replays reproduced strong, alternate, core, and compact evidence. The only final difference was the intended ambiguity-guard demotion. Full JavaScript suite 109/109, production build, and diff checks pass.
- The current compact model cannot replace the strong reader: it scored only 6/38 original yellow crops, at best 8/38 on a variant, and its three-view agreement selected 11/11 wrong compact-veto reads.
- The 18 frame instabilities and 4 safety vetoes were investigated. Post-hoc rules could select 1 and 2 correct answers respectively, but remain rejected as same-set overfitting. Final residuals: 18 frame/strong-confidence instabilities, 4 safety vetoes, and 3 compact vetoes.
- Secure WebKit/mobile emulation passed and kept the overwritten answer yellow, but optional consensus completion increased from 13.59 s to 26.96 s because the research integration eagerly requests core crops for every initial yellow. Before deployment, make this a second-stage request only for the small set still vetoed after Candidate 3.
- Architecture conclusion: the Mac mini cannot yet be removed while retaining the demonstrated 90.9% coverage because the gain depends on adapted TrOCR. It is not a total single point of failure: reader outage fails open to browser grading, more yellow reviews, and manual correction. The recommended public architecture is local browser grading plus an authenticated hosted strong service for unresolved yellows, while training/distilling a stronger browser model.
- Nothing in this checkpoint was deployed, committed, or pushed. Candidate 3 remains live. Full report: `docs/SCANGRADE_CORE_CROP_RESCUE_RESULT_20260715.md`.

## 2026-07-15 selected-core-crop private beta 4 release

- Tony authorized completing and deploying the selected-core-crop candidate when release gates passed.
- The extra strong-reader crop lane is now a true second stage. Candidate 3 runs first; only unresolved compact-support/browser-conflict vetoes without an ambiguity flag request the selected original, 2% trim, and 4% trim. Confidence-safety, ambiguity, slot-length, and frame-stability vetoes remain absolute.
- Exact 40-page second-stage replay preserved the final candidate result: 250/275 automatic (90.9%), 250/250 correct, 25 yellow; rows 150/160 (93.8%), non-row 100/115 (87.0%). Final answer groups matched the prior eager implementation on all 40 pages.
- Extra strong-reader workload fell from 309 to 48 core-crop images (84.5% fewer), and only 14/40 pages made a second-stage request instead of 36/40.
- Real warmed Tailscale/Safari-WebKit smoke: local result 3.93 s, optional consensus 21.64 s; warm repeat 4.02 s / 21.32 s. All gates passed and the overwritten `34/39` remained yellow. This latency is acceptable for private evaluation, not a public performance promise.
- Model-outage recovery passed: local grading completed, no automatic promotion occurred, manual correction worked, and failed optional services changed no local result.
- Release validation: 110/110 JavaScript tests, standard build, pruned public build, `git diff --check`, exact 40-page replay, workload parity comparison, secure WebKit, and outage recovery.
- Private-only build label: `2026.07.15-core-crop-private-beta-4`. Immediate rollback remains `?consensusCandidate=0`. Public GitHub Pages remains unchanged.
- Source commit `535e5bb` (`Promote selected core-crop private beta`) was pushed to `origin/autobuild/safe-20260223`. Live private source, build identity, both model health routes, and the rollback route were verified. Candidate freeze verified 71/71 files.
- Deployment report: `docs/SCANGRADE_CORE_CROP_PRIVATE_BETA4_DEPLOYMENT_20260715.md`.

## 2026-07-15 shared-frame latency private beta 5

- Profiling showed the adapted strong model was not the main source of the 21.6-second difficult-page delay: primary inference took about 1.28 seconds and combined corroboration about 0.56 seconds. The browser spent about 6.0 seconds preparing primary burst crops and another 8.6 seconds redundantly re-registering the same frames for alternate crops.
- Candidate 5 creates primary and alternate crops during one page-registration pass, then sends alternate/core corroboration together only for unresolved safe candidates. Recognition thresholds and all ambiguity, confidence-safety, length, and 3/3 frame requirements are unchanged.
- Safari/WebKit difficult-page timing improved from 21.64 seconds to 12.02 seconds (44.5% faster); warm repeat was 12.54 seconds. The local result still appeared in about 3.85 seconds and the overwritten `34/39` stayed yellow.
- Exact 40-page replay remained 250/275 automatic (90.9%), 250/250 correct, with the same 25 yellows and identical final answer groups on all 40 pages. Five correct promotions now record stronger two-crop/six-read support instead of selected-core support because the formerly contending alternate request completes reliably; no transcription, grade, or review state changed.
- Across the 40-page replay, optional processing after the local result averaged 6.28 seconds (median 6.57, p90 9.81, maximum 11.95). Sixteen pages requested combined corroboration.
- Release gates: 110/110 tests, standard and pruned-public builds, secure WebKit cold/warm smoke, complete scored replay, final-output parity, and full model-outage/manual-recovery test all passed.
- Private build label: `2026.07.15-shared-frame-private-beta-5`. Public GitHub Pages remains unchanged. Rollback remains `?consensusCandidate=0`.
- Source commit `30372dd` (`Reduce private grading latency with shared frame processing`) was pushed to `origin/autobuild/safe-20260223`. Live private build identity, both new runtime defaults, both model routes, and the remote source SHA were verified. Candidate freeze verified 75/75 files.
- Deployment report: `docs/SCANGRADE_SHARED_FRAME_PRIVATE_BETA5_DEPLOYMENT_20260715.md`.

## 2026-07-16 five-workstream speed, accuracy, and independence goal checkpoint

Date / thread: 2026-07-16, active ScanGrade five-workstream persistent goal.

What changed:
- Added opt-in research harnesses for selected-frame geometry reuse, worker-based frame decoding, and shadow-only three-frame median/aligned fusion. Candidate 5 production behavior and frozen recognition policy remain unchanged.
- Added packet-separated compact-model fine-tuning, final packet-adapted shadow training, and PyTorch/ONNX parity scripts.
- Deterministically locked physical packet P05 as the next prospective one-shot holdout. P05 remains intact, unscanned, and unseen.
- Offloaded four bulky reproducible replay directories to Tony's Rugged HD after recursive verification.

Evidence used:
- Candidate 5 control replay: 250/275 automatic, 250/250 observed correct, 25 yellow; rows 150/160, non-rows 100/115.
- Four opened recent packets P08/P03/P09/P02 with independently verified handwriting truth; historical development/validation/known holdout manifests.
- Eighteen recorded frame-instability answers and their saved grayscale answer crops.
- Current WebKit mobile emulation and P08 saved retained frames. No new physical packet was opened.

Commands run:
- P08 direct-geometry and worker replay through `scripts/replay_v3_crop_candidate_packets.mjs`, exact parity scoring, and WebKit worker compatibility smoke.
- Four-packet shadow median fusion plus 24-page aligned-fusion replay; `scripts/analyze_v3_frame_fusion.mjs` scored all 18 instabilities.
- `.venv/bin/python scripts/evaluate_v3_packet_crossfit.py ... --device mps`.
- `.venv/bin/python scripts/train_v3_sequence_packet_adapted.py ... --device mps`.
- `.venv/bin/python scripts/verify_v3_sequence_onnx.py ...`.
- Final JavaScript regression suite passed 114/114; production build, `git diff --check`, and the 11/11 P05 freeze verification also passed.
- Added and tested a P05-specific create-only scorer, key-blind shadow manifest builder, and create-only ONNX predictor. The exact Candidate 5 plus shadow boundary is frozen at `private-evidence/protocols/p05-prospective-candidate-freeze-20260716.json`; 11/11 file identities verify.

Results:
- Direct geometry reuse rejected: P08 59/70 automatic versus 64/70 control, zero observed wrong but failed evidence/output parity.
- Worker decode produced exact 10-page parity but was about 72 ms slower to crop readiness and 85 ms slower overall. Current WebKit used the worker path; real old-iPad sustained memory remains untested.
- Repeated WebKit stress proxy completed 8/8 difficult-page runs in both modes. Baseline averaged 3.952 s local / 10.084 s complete; worker averaged 3.963 s / 10.173 s. RSS was noisy and non-monotonic, with the worker reaching the higher transient peak (about 480 MiB versus 436 MiB). This is no speed or memory win; keep the worker off. Physical old-iPad testing is still required.
- Residual CNN rejected. Packet-separated authentic fine-tuning improved compact top-1 from 173/275 (62.9%) to 192/275 (69.8%), but varied 60.3%-77.1% by held-out packet and remains unsafe as an automatic reader.
- Final 6.4 MB packet-adapted ONNX is prospective shadow only. It matched PyTorch on 275/275 decisions; SHA-256 `12e31d44638f8ccc463a34c8da3879a348263f140cdd570548a1838ad73ca89d`.
- A later packet-separated explicit blank-slot model scored 187/275 (68.0%), below the sequence model's 192/275 (69.8%). It improved one-digit accuracy by one answer but lost six two-digit answers, recovered fewer Candidate 3 yellows (15 versus 17), and added no unique correct yellow. It is rejected and is not part of the P05 freeze.
- A key-blind compact-only consensus analysis joined both models' 275 out-of-fold reads to the exact 25 scorable Candidate 5 reviews. They agreed on 21 reviews, but only 10 were correct and 11 were wrong. A post-hoc 0.995 threshold selected one correct review; nested zero-error calibration on three packets selected zero reviews on every held-out packet. Reject compact-only automatic promotion. Report: `private-evidence/reports/v3-compact-crossfit-consensus-20260716.json`; reproducible script: `scripts/analyze_v3_compact_crossfit_consensus.mjs`.
- Median and locally aligned fusion each scored 8/18 correct and 10 wrong. Aligned fusion rescued zero cases. Candidate 5 outputs remained unchanged because fusion was shadow-only.
- The ten wrong fused crops had substantially lower median contrast/edge/sharpness, and failures concentrated in number bonds and optional-slot layouts. Clear crops also failed, so recognition remains a separate cause.

Files changed:
- Research/runtime harnesses: `src/components/CameraCapture.vue`, `src/v3/frame-preparation.js`, `src/workers/frame-preparation.worker.js`, `scripts/replay_v3_crop_candidate_packets.mjs`, `scripts/test_consensus_webkit_saved_page.mjs`, `tests/v3-frame-preparation.test.mjs`.
- Model/evaluation scripts: `scripts/train_v3_sequence_residual.py`, `scripts/evaluate_v3_packet_crossfit.py`, `scripts/train_v3_sequence_packet_adapted.py`, `scripts/verify_v3_sequence_onnx.py`, `scripts/analyze_v3_frame_fusion.mjs`.
- Private model/report/protocol artifacts under `private-evidence/models/v3-sequence-packet-adapted-seed29/`, `private-evidence/reports/`, and `private-evidence/protocols/v3-locked-prospective-p05-20260716.json`.
- Documentation: `docs/SCANGRADE_FIVE_WORKSTREAM_GOAL_CHECKPOINT_20260716.md`, `docs/SCANGRADE_LOCKED_P05_PROSPECTIVE_GATE_20260716.md`, `docs/SCANGRADE_RUGGED_OFFLOAD_MANIFEST_20260716.md`, and the V3 experiment ledger.

Rollback point:
- Deployed/private Candidate 5 remains source commit `30372dd`, deployment record `278c0db`, build `2026.07.15-shared-frame-private-beta-5`; runtime rollback remains `?consensusCandidate=0`.
- All new browser paths require explicit research query flags and are off by default. No deployment, commit, or push occurred in this checkpoint.

Next action:
1. Ask Tony to scan locked P05 once through the already-deployed private Candidate 5 URL; do not use the research dev server or rescan a page to seek a better result.
2. Replay and write the key-blind compact-shadow predictions before opening any handwritten truth.
3. Create blinded truth in two independent passes, then run the create-only scorer exactly once. Never tune from P05 or add it to development.

Open risks:
- P05 requires Tony's physical scan and independent truth passes; it cannot be completed locally now.
- The packet-adapted model's generalization is unproved and its confidence is unsafe.
- Physical old-iPad camera, memory pressure, thermal behavior, and sustained multi-page performance remain untested.
- The research harness adds off-by-default code to the app; do not deploy it unless a future candidate passes full freeze and release gates.

## 2026-07-17 stitched strong-evidence and local-compression checkpoint

- Candidate 5 remains unchanged at 250/275 automatic (90.9%), 250/250 observed correct, with 25 yellows. P05 and all untouched packets remain sealed.
- The exact key-blind matched-view test found that input construction is a major strong-reader bottleneck. Adapted TrOCR rose from 175/275 (63.6%) on current continuous zones to 242/275 (88.0%) on the exact historical-style stitched original-grayscale slot view. P09 validation was 63/70 (90.0%); P02 holdout was 60/68 (88.2%).
- Destructive cleaning was rejected: cleaned stitched scored 229/275 and fell to 50/68 on P02. Preserve original grayscale pixels.
- Raw strong confidence remains unsafe. The stitched view made two wrong reads above 99.5% confidence (`12→15` and `6→7`) on answers Candidate 5 already handled correctly. Use stitched output as review evidence only until an independent selector passes prospective safety gates.
- On the 25 Candidate 5 yellows, stitched TrOCR read 14 correctly versus 9 for continuous. The recommended next candidate sends one selected-frame stitched crop per unresolved yellow and exposes the result only as a teacher review choice. It must first pass an exact saved-browser A/B with all automatic outputs frozen.
- Local compression did not inherit the strong-model gain. Packet-held-out compact results: truth-only CNN 196/275 (71.3%); light teacher loss 196/275; stronger teacher loss 195/275; joint 0–99 classifier 193/275. Reject all as strong-reader replacements.
- The final technical compact artifact is 6.4 MB, has 0/853 PyTorch/ONNX decision mismatches for identical tensors, and averaged 54.5 ms/answer in conservative single-thread WASM. It is fast but insufficiently accurate/calibrated. Browser/Pillow resizing changed two decisions, so future training must use the exact browser preprocessing contract.
- Full result and durable artifact index: `docs/SCANGRADE_STITCHED_EVIDENCE_AND_COMPRESSION_RESULT_20260717.md`.
- Nothing was deployed, committed, or pushed. Candidate 5 and its rollback remain the live private control.

### 2026-07-17 forensic follow-up on two high-confidence stitched-reader errors

- The two stitched TrOCR errors were traced to clipped decisive strokes, not answer-key leakage: `12→15` loses most of the `2` lower stroke at the printed bottom border; `6→7` loses the lower loop at the number-bond answer frame. The original captured pages and Candidate 5 both show/read `12` and `6` correctly.
- A corrected coordinate-scaled expansion test reduced strong-model confidence to 0.881278 and 0.774449 respectively, but did not correct the reads. Generic larger raw crops scored only 83/275 and remain unsuitable as primary recognition input.
- Candidate 5 already contains the correct product safeguard: accepted automatic answers cannot be overridden, and local-first strong inference is yellow-only, on-demand, and review-only. Both failures are non-yellow, so they are unreachable by the strong-reader review path and cannot affect grading.
- Do not weaken this boundary. Raw stitched-model confidence is not an automatic selector. Future promotion requires independent agreement plus prospective data.
- Durable report and artifacts are appended/indexed in `docs/SCANGRADE_STITCHED_EVIDENCE_AND_COMPRESSION_RESULT_20260717.md`.
- No production behavior, deployment, commit, push, or P05 freeze state changed.

## Six-workstream improvement goal — first screen

Tony activated a new staged goal covering a stronger browser whole-answer model, non-destructive template residuals, crop containment/quality, TrOCR distillation, writer adaptation, and further latency reduction. Candidate 5 remains the immutable control and P05 plus all other untouched packets remain sealed.

The first new experiment built an additional aligned blank-template residual channel while retaining the original grayscale crop unchanged. Paired channels were generated for 578 historical and 275 recent scorable answers. A dual-channel model initialized from the existing compact checkpoint was evaluated with four packet-separated folds. It scored 190/275 (69.1%) versus 192/275 (69.8%) for the existing compact baseline, with four unique gains and six unique losses. On the exact 25 Candidate 5 reviews it scored 7 correct versus 12 for baseline and added no unique correct rescue. Reject this residual formulation; it is not deployed and is not part of the P05 freeze.

The old writer-adaptive nearest-neighbor lane was independently recovered as already falsified: its automatic zero-error gate accepted nothing, and even teacher-confirmed prototypes introduced held-out errors. Do not repeat or deploy nearest-neighbor writer adaptation. Full staged ledger: `docs/SCANGRADE_SIX_WORKSTREAM_RESEARCH_LEDGER.md`.

## 2026-07-17 six-workstream preliminary completion

All six requested directions received a bounded, packet-separated preliminary screen. Candidate 5 stayed unchanged and P05 stayed unopened. No candidate met the predeclared advancement rule.

- Stronger browser model: a joint 0-99 classifier scored 194/275 (70.5%) versus the compact baseline's 192/275 (69.8%), but traded 12 gains for 10 losses, regressed P02, and added no correct rescue among Candidate 5's remaining reviews. A 1.62M-parameter MobileNetV3-small attempt scored only 80/275 (29.1%). Both are rejected.
- Template subtraction: dual untouched-grayscale plus aligned-residual input scored 190/275 (69.1%), below baseline, with no unique Candidate 5 review rescue. Rejected.
- Crop containment: larger crops increase top-three diversity but substantially reduce top-one accuracy; generic containment signals are dominated by printed structure. Keep the existing on-demand larger crop only as corroborating/review evidence.
- Distillation: the key-blind TrOCR teacher scored 356/578 (61.6%) on the current raw continuous crop export. Hard-read-assisted packet crossfit reached 194/275 (70.5%) but regressed P02 and supplied no unique correct Candidate 5 review rescue. Reject this teacher-target formulation. A future distillation attempt first requires the same stitched/cleaned teacher view that performs well in Candidate 5.
- Writer adaptation: nearest-prototype adaptation remains rejected because its zero-error automatic gate accepted nothing and teacher-confirmed prototypes created held-out errors.
- Latency: yellow-only extra-frame zone extraction produced identical P08 evidence/output, but eight matched WebKit runs were 0.16% slower overall and 0.78% slower to local readiness. A 0.75-scale registration attempt did not complete within 120 seconds versus the 13.5-second control. Both experimental paths were removed from app code. Candidate 5's existing shared-frame/deferred path remains best.

Reproducible scripts and reports are listed in `docs/SCANGRADE_SIX_WORKSTREAM_RESEARCH_LEDGER.md`. The practical conclusion is not that better local recognition is impossible; it is that none of these cheap variants supplies the required jump. The next technically credible model experiment is gated on exporting stronger stitched/cleaned grayscale teacher inputs, verifying that TrOCR is actually strong on that exact view, then considering soft-feature/logit distillation. Do not deploy or spend P05 on the current research candidates.

Final verification passed 114/114 JavaScript tests, production build, `git diff --check`, 33-layout audit with zero errors, and 11/11 P05 freeze identities. The two 54 MB P08 latency replay directories were copied to the Rugged drive, recursively compared with zero differences, and removed locally; their compact reports remain in `private-evidence/reports/`.

## 2026-07-16 stitched-review private beta 6 release candidate

- Candidate 5's automatic recognition/promotion path is unchanged. The accepted change affects only a teacher-requested second opinion for answers that remain yellow.
- The rejected primary-evidence experiment used stitched original-grayscale crops for automatic strong-model consensus. It stayed safe but regressed to 237/275 automatic (86.2%), so it was removed.
- The accepted implementation sends one selected-frame stitched original-grayscale answer crop only after the teacher requests another reader. The result is review-only and cannot automatically grade or override.
- Exact 40-page control/candidate parity passed: all 40 pages had identical automatic evidence and final output; both scored 251/275 automatic and correct on the fresh replay. Continue to publish the frozen conservative Candidate 5 figure of 250/275 (90.9%) until prospective evidence exists.
- On the 24 fresh yellow answers, stitched strong recognition was correct on 13 versus 9 for continuous-frame evidence. A 0.99 stitched-suggestion display threshold showed four differing suggestions and all four were correct retrospectively; at 0.98 one of five would have been wrong.
- WebKit iPad emulation reduced the on-demand strong wait from about 3.50 s to 1.30 s; a warm Chromium run was about 0.40 s and a cold CPU-only run about 2.75 s. These remain controlled timings, not physical old-device claims.
- The both-services-unavailable test passed: local grading, yellow review, manual correction, and recovery remained usable with no token leakage or grade effect.
- Final validation passed 115/115 JavaScript tests, the standard production build, the pruned GitHub Pages build, and `git diff --check`.
- Private Tailnet default: enabled. Public GitHub Pages: unchanged/local-only. Feature rollback: `?v3StitchedOnDemandReview=0`; whole-candidate rollback: `?consensusCandidate=0`.
- Release report: `docs/SCANGRADE_STITCHED_REVIEW_PRIVATE_BETA6_20260716.md`.
- P05 is still sealed. Candidate 5's old freeze remains historical evidence; create a new Candidate 6 freeze after the final release commit before scanning P05, because the live private build identifier and source hashes will change even though automatic outputs are replay-identical.

### Candidate 6 deployment and recovery record

- Source commit `b7a5df488836ec3b3e1010bec3979bf714f1d76e` was pushed to `origin/autobuild/safe-20260223`.
- The private Tailnet URL returned HTTP 200 and served build `2026.07.16-stitched-review-private-beta-6`; `/review-model/health` reported the MPS TrOCR adapter healthy and offline, and `/v3-compact/health` reported the compact ONNX service healthy.
- The public GitHub Pages behavior was not changed or deployed; it remains local-only by default.
- P05 remains sealed and is now frozen against Candidate 6 at `private-evidence/protocols/p05-prospective-candidate6-freeze-20260716.json`; all 16 recorded file identities verified. Use the URL with no query string and no research flags.
- Candidate 6 was backed up at `/Volumes/Tony's Rugged HD/Codex/ScanGrade Offloads/2026-07-16-stitched-review-private-beta6/`. The 577 MB backup contains a verified complete Git bundle, the three exact replay directories, score/parity reports, P05 freeze, private model identities, and recovery scripts.
- After recursive byte comparison and Git-bundle verification, the three bulky replay directories (about 540 MB total) were removed locally. Their score/parity reports remain local; full replays restore from the Rugged backup.
- Deployment record: `docs/SCANGRADE_STITCHED_REVIEW_PRIVATE_BETA6_DEPLOYMENT_20260716.md`.

## 2026-07-16 crop/layout browser-local candidate falsification

- Candidate 6 remained unchanged, P05 remained sealed, and no production behavior was modified or deployed.
- A truth/output-blinded geometry audit found visible crop/layout failure in 13/19 packet-held-out TrOCR-small misses versus 5/19 matched successful controls. Fourteen of 18 flagged cases were number bonds.
- Existing key-blind containment features reached 83.3% sensitivity and 80.0% specificity under packet-held-out threshold selection. This is useful for routing alternate evidence, not choosing an answer.
- The existing 4%-down number-bond view improved TrOCR-small from 12/22 to 14/22. Nine bounded variants showed that larger general expansion is harmful. A detector-routed analysis reached 15/22, but the selector is not prospectively calibrated.
- A separately trained shifted-view specialist also reached 15/22, but fell to 233/275 if used globally. Among eight current number-bond reviews it fixed two and was wrong on five others. It remains review-only evidence.
- Non-destructive template residuals failed: direct answer-zone residual 86/275, bounded context residual 64/275, and residual-augmented held-out P02 57/68 versus 58/68 control. Printed-line subtraction still erases overlapping pencil.
- Decision: preserve original stitched grayscale; retain the containment detector and small downward crop as research/review evidence only; reject global crop expansion, print subtraction, global specialist replacement, and automatic shifted-read selection.
- Full report: `docs/SCANGRADE_CROP_LAYOUT_LOCAL_CANDIDATE_RESULT_20260716.md`.

Next action: freeze this branch. The cheapest decisive continuation is prospective new-student crop-containment and alternate-view scoring with policy frozen before truth. Do not spend P05 on this candidate.

## 2026-07-16 browser-only yellow-gap audit

- Reconstructed the exact no-Mac baseline from the 40-page Candidate replay: 176/275 automatic (64.0%), 176/176 correct, 99 yellow. Older non-development scans were 69.2%, which explains the earlier approximate 70% description; do not combine the corpora into one benchmark.
- Audited all 99 browser yellows visually and from their saved debug stages. The large grayscale reader got 87/99 right, browser local read was already right on 17, coherent named browser preprocessing produced the full correct answer on 55, and per-slot variant tops contained the truth on 92. Most yellows retain usable camera information but lose or mishandle it in the 28×28 conversion/model/selector path.
- Exact mutually exclusive partition: 17 correct browser reads blocked by safety; 37 wrong browser reads where large grayscale and a coherent browser variant were correct; 34 wrong browser reads where large grayscale was correct but no coherent browser variant was; 6 wrong browser/large reads with a coherent correct browser variant; 5 wrong browser/large reads with no coherent correct variant.
- Crop/capture quality does not generally separate yellow from automatic: 35/40 pages contain both cohorts from the same capture, and measured quality-statistic AUCs were 0.459–0.538. Real crop/layout failures concentrate in number bonds and optional-slot layouts. Browser coverage: row 113/160 (70.6%), non-row 63/115 (54.8%), number bonds 7/22 (31.8%).
- Falsified a tempting local-only rule. Exact browser-plus-compact agreement on recent arithmetic rows looked like 9/9 safe rescues, but historical validation/holdout gave 2 correct and 3 wrong; reject and do not deploy.
- No production policy changed. Candidate 6 and the sealed P05 freeze remain intact. Future no-Mac work should use a materially stronger whole-answer browser model over exact browser-rendered larger grayscale plus slot/layout metadata; the tested 6.4 MB compact model is fast enough but not accurate/calibrated enough.
- Full report: `docs/SCANGRADE_BROWSER_ONLY_YELLOW_GAP_AUDIT_20260716.md`. Reproducible outputs: `private-evidence/reports/browser-only-gap-audit-20260716.json`, `private-evidence/reports/browser-compact-agreement-falsification-20260716.json`, and the 15 private visual contact sheets under `private-evidence/reports/browser-only-yellow-visual-audit-20260716/`.

## 2026-07-16 browser-local TrOCR-small shadow and crop-falsification checkpoint

- Built the requested materially stronger Mac-independent whole-answer browser candidate. The packet-held-out model remains 244/275 (88.7%): rows 149/160, non-rows 95/115, Candidate 5 residual yellows 16/25, and number bonds 12/22. It consumes the preserved stitched grayscale answer and never receives an answer key.
- Integrated an explicit off-by-default, review-only browser shadow lane. It attaches layout family, physical slot count, maximum handwritten digits, and declared optional-slot indices; unknown/nonnumeric/overlength output is rejected, and only declared optional slots can be inferred blank. It runs one yellow answer per disposable worker with a timeout and cannot affect grades.
- Chromium and WebKit exact-token tests passed, including eight sequential disposable workers and forced non-SIMD. Warm execution is about 1.5 seconds per yellow including per-answer initialization; non-SIMD is about 3.2 seconds. The 25 opened-data yellows produced identical browser reads across engines. Physical old-iPad sustained memory/download/camera testing is still required.
- Fresh 40-page feature-off replay matched restored Candidate 6 on all 40 evidence and output pages. Candidate 6 remains deployed commit `b7a5df4`, and P05 remains sealed.
- Exact packet-held-out scoring on the 99 browser-only yellows is 80/99 (80.8%): row 42/47 and non-row 38/52. The new model is wrong on 12 of 176 answers the current browser safely accepts, so it must never override an accepted result.
- Four verified whole-answer blanks were all hallucinated as digits by the model. Optional-slot inference is structurally implemented, but whole-answer blank/erasure/cross-out automation remains unproved and must stay yellow.
- Global cleaned crops were rejected: 236/275 versus 244/275, with 6 rescues and 14 regressions. A packet-crossfit crop selector rescued 1 and regressed 2. Mixed original/clean training fell to 56/68 on P02 and 3/8 Candidate 5 reviews.
- Visual audit of the 19 whole-answer misses among browser yellows found roughly 12 with visibly clipped/mispositioned strokes or dominant number-bond frames. The existing 4%-down number-bond view improved raw top-one from 12/22 to 14/22 but made two regressions; shifted-view training fell to 50/68 on P02 and did not improve shifted P02 number bonds. Keep alternate crops as disagreement/review evidence only.
- TrOCR-small plus compact exact agreement is not safe: historical browser-yellow falsification contains known wrong agreements. Raw model confidence also remains unsafe above 0.999.
- No deployment, commit, push, automatic-policy change, or P05 access occurred. Full result: `docs/SCANGRADE_BROWSER_LOCAL_TROCR_SMALL_RESULT_20260716.md`.

## 2026-07-17 Candidate 6 / P05 readiness rehearsal

Date / thread: 2026-07-17, final preparation before Tony scans locked packet P05.

What changed:
- No recognition, capture, confidence, model, threshold, worksheet layout, or deployed Candidate 6 behavior changed.
- Added a reproducible Candidate 6 freeze verifier and a generic scorer for rehearsing the prospective path on an already-open packet.
- Corrected two scorer-integrity assumptions found by rehearsal: `affectsGrade` is false on a complete page when no promotion was applied, and teacher-facing question annotation state—not a retained physical-slot flag—determines whether a resolved whole answer is still yellow.
- Added a one-shot P05 scan checklist, a prediction-blinded two-pass truth protocol, create-only blank 70-answer truth templates, and a hash freeze for all P05 execution/scoring tools.
- Added a tiny debug-image extraction utility for visually checking the rendered marked sheet.

Evidence used:
- Frozen Candidate 6 source commit `b7a5df488836ec3b3e1010bec3979bf714f1d76e`, build `2026.07.16-stitched-review-private-beta-6`.
- Live private URL `https://hobbes-mac-mini.tail9a3379.ts.net/` and both same-origin model health routes.
- The already-open, independently verified P02 ten-page packet and its three saved burst frames per page. P05 remained sealed, unscanned, and unseen.
- Candidate 6 rugged backup at `/Volumes/Tony's Rugged HD/Codex/ScanGrade Offloads/2026-07-16-stitched-review-private-beta6/`.

Commands run:
- `node scripts/verify_candidate6_p05_readiness.mjs`.
- Full ten-page live WebKit/older-iPad-emulated P02 replay through Candidate 6, with three retained saved frames per page, then `node scripts/score_prospective_rehearsal.mjs ...`.
- One full-debug number-bond replay plus extraction/visual inspection of `markedSheetDataUrl`.
- `node scripts/test_local_first_failure_recovery.mjs`.
- `node scripts/test_local_first_webkit_ipad.mjs`.
- `node --test tests/p05-prospective-candidate.test.mjs tests/v3-production-runtime.test.mjs tests/v3-review-suggestion-display.test.mjs`.

Results:
- Candidate 6 freeze verification passed 16/16 identities. Live private root returned HTTP 200; strong and compact services were healthy.
- P02 rehearsal completed all 10 unique pages and 70 answer records. Of 68 scorable answers, 60 were automatic and 60/60 matched handwriting: 88.2% overall coverage, rows 36/40 (90.0%), non-rows 24/28 (85.7%), zero confident transcription errors, eight yellows. All prospective rehearsal gates passed after the scorer clarification.
- The questioned number-bond `19` is rendered correctly as a red X (confident transcription, mathematically wrong), not yellow. The internal slot flag was harmless metadata; the marked sheet and question-level annotation are correct.
- Both-optional-services-down recovery passed every gate: local grading completed, no automatic promotion occurred, local output stayed unchanged, a clear unavailable message appeared, manual correction worked, and the token did not leak.
- WebKit older-iPad emulation passed every gate. Controlled timing on one difficult page: app ready 1.00 s, local result 6.11 s, compact choices 9.87 s, strong context prepared 14.90 s, teacher-requested strong response 3.03 s. This is emulation, not physical-old-iPad proof.
- P05 execution scorer tests now pass 7/7; combined targeted suite passes 20/20. Candidate 6 recognition remains unchanged.
- Local disk has about 4.4 GiB available; Rugged has about 333 GiB. The saved 2026-07-14 debug corpus is 1.1 GiB. Avoid further bulky local replays before P05.

Important QR correction:
- The printed worksheet QR payloads currently point to `https://scangradesheets.github.io/draft1/`, which opens the public local-only app if scanned with the iPhone Camera app.
- For P05, Tony must manually open `https://hobbes-mac-mini.tail9a3379.ts.net/`, verify the exact Candidate 6 build label and no query string, then tap **Start Scan**. Candidate 6 will read the photographed page QR internally to select the layout.
- Do not change public/QR routing before P05; doing so would change the frozen candidate.

Files changed:
- `scripts/verify_candidate6_p05_readiness.mjs`
- `scripts/score_prospective_rehearsal.mjs`
- `scripts/score_p05_prospective_candidate.mjs`
- `scripts/extract_debug_image.mjs`
- `scripts/create_p05_truth_templates.mjs`
- `scripts/freeze_p05_execution_tools.mjs`
- `tests/p05-prospective-candidate.test.mjs`
- `docs/SCANGRADE_P05_SCAN_CHECKLIST_20260717.md`
- `docs/SCANGRADE_P05_BLINDED_TRUTH_PROTOCOL_20260717.md`
- private readiness/rehearsal reports and P05 templates/freezes under `private-evidence/`.

Rollback point:
- Live Candidate 6 remains frozen source commit `b7a5df4`; deployment record branch tip is `2c180ef`. Public GitHub Pages is unchanged. No deployment, commit, push, or production modification occurred in this readiness work.
- P05 execution/scoring tool identities are frozen at `private-evidence/protocols/p05-execution-tools-freeze-20260717.json`.

Next action:
1. Tony follows `docs/SCANGRADE_P05_SCAN_CHECKLIST_20260717.md` and scans intact P05 exactly once through the manually opened private Candidate 6 link.
2. Freeze all ten successful capture/debug records before any corrections, truth inspection, or scoring.
3. Create two independent prediction-blinded truth passes, adjudicate without the answer key, freeze truth, then run the create-only prospective scorer once.

Open risks:
- P05 still requires Tony's physical scan. Nothing in this rehearsal authorizes rescans to improve a result.
- Physical old-iPad multi-page camera/memory/thermal behavior remains unproved; WebKit emulation passed but is not equivalent.
- The private strong service depends on the Mac mini, but verified fail-open behavior means an outage increases yellow/manual review rather than stopping local grading.
- A single 70-answer packet can falsify Candidate 6 but cannot establish a market-ready zero-error claim or a narrow confidence interval.

## 2026-07-17 P05 physical scan completed; summary recovery required

Date / thread: 2026-07-17, immediately after Tony scanned all ten physical P05 pages through Candidate 6.

What happened:
- Tony completed all ten pages and reported several visible product observations: repeated child-written reversed 9s resembling `P`; some yellow review circles not centered on the visible answer; useful delayed improvements from the Mac-mini reader without adequate “still thinking” feedback; and a yellow-correction interface that can obscure the handwriting.
- No new full debug bundles appeared under `private-evidence/debug-scans`. The private no-query URL did not establish debug auto-upload on this phone/origin. This is a test-preparation failure: the checklist verified the frozen build but did not verify device-side debug persistence before spending P05.
- Candidate 6 guest mode should still have stored one compact submission summary per successful page in the phone browser under `scangrade.savedSubmissions.v1`. Those records contain final answer groups, review states, scores, timings, template IDs and suggestions, but not full captured images/frames/crops.

Recovery action:
- Added a read-only same-origin recovery page at `https://hobbes-mac-mini.tail9a3379.ts.net/p05-recovery.html`.
- The page reads only the saved-submission storage key, reports the count/templates, and downloads an exact JSON wrapper including the raw storage value. It does not grade, upload, modify or delete records.
- Live Tailnet retrieval and visual browser loading passed. The in-app browser correctly showed its own empty-origin state; Tony must open it in the same Safari/browser on the same phone used for scanning.
- Tony must not clear ScanGrade's queue, Safari website data, or the original ScanGrade tab before recovery.

Integrity consequence:
- First recover and freeze the original ten submission summaries. Do not change recognition policy based on Tony's observations before that recovery.
- If ten distinct P05 templates are recovered, transcription coverage/error scoring may still be possible from the original final answer groups after blinded truth is created. Capture/crop/annotation forensics will not be possible from those compact records alone.
- Any later rescan must be explicitly classified as forensic/development evidence and must not silently replace the original one-shot P05 outcome.

Next action:
1. Tony opens the recovery page in the same phone/browser and downloads/attaches the JSON.
2. Verify ten records and ten distinct layouts; freeze/hash the recovered file immediately.
3. Decide the least-contaminating way to obtain full-page truth and crop evidence without replacing the original performance outcome.
4. Only then analyze reversed digits, crop/annotation placement, delayed-result feedback, and the correction workflow as separate failure classes.

### P05 original summaries recovered and frozen

- Tony attached `scangrade-p05-original-scan-summaries-1784294995983.json`. Exact source SHA-256: `bf81c96a3cb76b197d4a05fd1b6c3487329767aabfc58cc31b2dd999656f26af`; 646,568 bytes.
- The ten newest records are a single uninterrupted July 17 sequence from `13:14:52.827Z` through `13:19:29.772Z`. They contain exactly one of each expected layout, 70 answer groups, and zero manual corrections. The next older record is from July 14, so the selection boundary is unambiguous.
- Create-only freeze: `private-evidence/p05-prospective-20260717/`, produced by `scripts/freeze_p05_recovered_summaries.mjs`. Both frozen files reverified against their manifest.
- The freeze was copied to the Candidate 6 Rugged backup under `p05-original-20260717/`; checksum-mode rsync reported zero differences.
- Pre-truth coverage only: 48/70 automatic (68.6%), 22 yellow; rows 30/40 automatic (75.0%), non-rows 18/30 (60.0%). Number bonds were 1/6 automatic and 5/6 yellow. This is not transcription accuracy. The saved worksheet-key agreement is math grading and must not be used as handwriting truth.
- Saved page processing time was 1.421–5.238 seconds, median 3.664 seconds, mean 3.525 seconds. This excludes any later teacher-requested strong-review wait.
- Full original captures/frames/crops/annotation geometry were not present in the recovered summaries. A second Debug Scan is now permitted only as explicitly labeled forensic evidence for handwriting truth, crop inspection, capture variability and UX study. It must never replace the frozen original outcomes.

## 2026-07-17 P05 forensic safety and answer-card repair candidate

- The frozen original one-shot outcome remains 48/70 automatic (68.6%), 22 yellow; a full-resolution visual audit found all 48 automatic reads matched the handwriting. The later forensic scan is development evidence only.
- The full-debug rescan's immediate browser result was 42/70 automatic and 42/42 matching the visual audit. Its final strong-model result was 55/70 automatic (78.6%) with one genuine confident transcription error: row 04 QF, visible `17` promoted to `12`. The independent compact reader read `17` at about 99.98% while the affected browser slot was high-risk and preprocessing-disputed.
- The other two red-styled review cases were row 04 QG (`11` vs visible `16`; the whole-answer readers both proposed the also-wrong `17`) and number-bond 08 QC (`11` vs visible `14`; both whole-answer readers proposed `14`). These were internally review-needed but styled as incorrect/red.
- Candidate repair in `src/v3/consensus-promotion.js`: policy `consensus-promotion-shadow-3`; unconditional retained-material-rival veto; a narrow high-risk-browser plus >=0.99 compact-conflict veto that cannot re-enter through core crops; and a key-blind display-review veto when both independent whole-answer readers agree against the browser.
- Candidate UI repair in `src/components/CameraCapture.vue`: review state now drives cards, annotations, and overlays consistently; ordinary confidently transcribed incorrect math remains red; evidence-backed transcription disputes remain yellow.
- Answer cards now follow physical worksheet slot metadata. Single-box number bonds display one box/token; genuine two-slot answers display two.
- Counterfactual exact-saved-decision result after the unsafe QF promotion becomes yellow: 54/70 automatic (77.1%), 54/54 matching the single visual truth audit, 16 yellow; rows 34/40 and non-rows 20/30. This is not prospective evidence.
- Fresh full saved-image replay: 48/70 automatic, 48/48 matching visual truth, 22 yellow. Fresh replay geometry/output varied from the live forensic run, so its coverage is not substituted for the live result. A focused replay verified safety-veto yellow rendering and number-bond one/two-slot formatting.
- Limitation: optional whole-answer readers still run only on initially yellow answers. The display repair handles the observed saved-evidence cases but cannot expose a confident browser-only error when no independent evidence is requested. Recognition/replay variability remains open.
- Verification: 128/128 JavaScript tests, production build, and diff check passed. Nothing deployed, committed, or pushed in this checkpoint.
- Disk recovery: five P05 safety replay folders were copied to `/Volumes/Tony's Rugged HD/Codex/ScanGrade Offloads/2026-07-17-p05-forensic-safety-replays/`, each checksum-compared with zero differences, then bulky local copies were removed. Compact `rows.json`, `summary.json`, and `summary.md` remain locally for replay 4 and the focused final UI replay.
- Durable report: `docs/SCANGRADE_P05_FORENSIC_SAFETY_AND_UI_RESULT_20260717.md`.

### 2026-07-17 identical-input and retained-frame follow-up

- Two production-matched ten-page replays of identical image files matched on geometry, predictions, answer groups, review state, and annotation regions. The apparent identical-input variability came from runtime timing fields and a random annotation decoration seed, not grading behavior. Annotation seeds are now derived deterministically from result evidence; a focused A/B replay matched fully.
- Each phone scan captured eight frames and retained three; all selected frames cleared focus and perspective gates. Independent replay of all 30 retained frames showed 42/70 raw top-one correct for the whole-page selected frames, 47/70 for the best single frame per page chosen with truth hindsight, 50/70 for an impossible per-answer truth oracle, and 39/70 for simple three-frame majority.
- Conclusion: alternate frames sometimes contain useful pixels, but whole-page focus, stricter capture thresholds, and majority voting do not identify the better answer safely. Do not raise the capture gate on this evidence. Recognition/candidate selection remains the dominant bottleneck, with number-bond crop/layout failures concentrated separately.
- An experimental attempt to run the strong path over every red answer was rejected: it added work and did not safely eliminate the broad raw replay errors. Keep the strong path yellow-only plus the narrow P05 ambiguity/conflict safety veto.

### 2026-07-17 P05 safety private beta 7 deployed

- Source commit `2a6c8c5` was pushed to `origin/autobuild/safe-20260223`.
- Live private build: `2026.07.17-p05-safety-private-beta-7`; runtime release: `p05-safety-private-beta-7`.
- Live source and both same-origin services verified: strong TrOCR adapter healthy/offline/key-rejecting; compact continuous-answer service healthy.
- Shipped scope is narrow: the demonstrated P05 ambiguity/conflict veto, consistent yellow/card/annotation state, physical-slot card formatting, deterministic annotation seeds, and preserved off-by-default research harnesses. The rejected all-red model screen and unproved stricter capture gate were not shipped.
- Release verification: 130/130 JavaScript tests, production build, pruned GitHub build, and diff check passed. Public GitHub Pages was not redeployed.
- Rugged recovery: complete Git bundle through `003bec5` plus the active handoff and both Beta 7 reports at `/Volumes/Tony's Rugged HD/Codex/ScanGrade Offloads/2026-07-17-p05-safety-private-beta7/`; bundle verification passed.
- Deployment record: `docs/SCANGRADE_P05_SAFETY_PRIVATE_BETA7_DEPLOYMENT_20260717.md`.

### 2026-07-17 P05 generalization, physical annotations, and live-marking beta 8 candidate

- P05 remains a failed prospective generalization test. Original one-shot: 48/70 automatic (68.6%), 48/48 matching the handwriting audit. Beta 7 repaired forensic-rescan estimate: 54/70 automatic (77.1%), 54/54 matching, 16 yellow. Do not substitute the retrospective estimate for the original result or market either as 90%.
- Key-blind adapted-TrOCR matched-view test on all 70 P05 answers: continuous grayscale 54/70; stitched physical slots 42/70; oracle either view 59/70. Stitched evidence that helped prior packets regressed sharply on P05 and is rejected as a global primary view.
- The 16 repaired residuals are predominantly clear-image recognition/selection disagreements, unfamiliar writer shapes (including three reversed-9/P forms), and number-bond print/slot interference. Number-bond Q4 contains a complete `6` and Q5 a complete `17` in the continuous grayscale crop. Capture blur/perspective is not the main missing-coverage cause.
- A narrow shadow selector requiring 2/3 grayscale-frame agreement plus stitched agreement, while retaining every ambiguity/safety veto, was 3/3 on historical residuals and 2/2 on P05. Five cases are insufficient for automatic use. The broader near-90% rule remains rejected because it admits the overwritten `34 -> 39` error.
- Annotation drift was traced to preferring template `expectedRect` before detected `boxRect`. Across 120 P05 slots the center drift averaged 34.1 canonical pixels (0.27 box widths); 45 exceeded 0.25 box widths and 22 exceeded 0.5. The candidate now anchors to physical boxes first and preserves only small deterministic natural wobble/angle/stroke variation.
- Student results now reveal the exact final annotation image one settled question at a time while stronger review runs. Yellow answers and all questions still queued for safety/strong review are excluded until final. WebKit deliberately delayed the large reader: a confirmed mark appeared, two queued questions remained hidden, the provisional final image stayed hidden, and the final marked page replaced the animation cleanly.
- Validation: 135/135 repository tests, production build, pruned GitHub build, and diff check pass. WebKit evidence: `private-evidence/reports/progressive-marking-webkit-20260717.json`.
- Build candidate label: `2026.07.17-physical-annotations-live-marking-beta-8`; recognition runtime remains unchanged `p05-safety-private-beta-7`.
- Full technical report: `docs/SCANGRADE_P05_GENERALIZATION_ANNOTATION_AND_PROGRESSIVE_MARKING_20260717.md`. Deployment record draft: `docs/SCANGRADE_ANNOTATION_AND_LIVE_MARKING_PRIVATE_BETA8_DEPLOYMENT_20260717.md`.
- Public domain check: `scangrade.io` currently does not resolve from an unrestricted DNS/network check. The repo has a Cloudflare Pages scaffold, but no safe authenticated public gateway to the home-Mac model is deployed. Public hosting should remain browser-only until a session/auth, origin, rate-limit, request-size, and no-retention boundary exists.
- Beta 8 source commit `021305d` and deployment-record commit `65f6cc7` are pushed. The private Tailnet root, build label, adapted MPS reader health, and compact-reader health all verified.
- Beta 8 recovery was copied to `/Volumes/Tony's Rugged HD/Codex/ScanGrade Offloads/2026-07-17-physical-annotations-live-marking-beta8/`. The Git bundle verified as complete and all copied reports/evidence matched source SHA-256 hashes.

### 2026-07-17 Cloudflare browser-only public Beta 8

- Tony confirmed the intended domain is `scangrade.io` and authenticated the Cloudflare account with Wrangler OAuth.
- Cloudflare Pages project `scangrade` now serves the clean Beta 8 static build from Git source commit `478d92d` at `https://scangrade.io/`, `https://scangrade.pages.dev/`, and immutable deployment `https://a5b4bc89.scangrade.pages.dev/`.
- The custom apex domain is active and returned HTTP 200 with Beta 8 asset `assets/index-Bokf8J_g.js`.
- This is deliberately browser-only. No Pages Functions, D1 binding, public Mac-Mini proxy, or submission backend was deployed. Requests to `/review-model/health` and `/api/submissions` returned byte-identical static SPA homepages, proving those routes are not exposed services.
- Public response headers include camera restriction to self, SAMEORIGIN framing, nosniff, and strict-origin referrer policy.
- Existing worksheet QR codes were not rewritten. Future generated sheets can target `https://scangrade.io/` only after an explicit QR migration and scan test.
- Official Cloudflare agent skills and MCP entries were installed, but Codex must be restarted to load them. Wrangler administration works. MCP OAuth was not bypassed after macOS blocked the bundled CLI executable.
- Durable deployment record: `docs/SCANGRADE_CLOUDFLARE_BROWSER_ONLY_PUBLIC_BETA8_20260717.md`.

### 2026-07-17 Cloudflare blank-screen incident repaired

- Tony's iPhone correctly exposed a production deployment fault: the loading screen appeared and then the page became blank.
- Root cause was not Safari or the application runtime. The first Cloudflare deployment accidentally used the GitHub Pages build, so the HTML requested modules and other assets below `/draft1/`. On `scangrade.io`, those missing paths returned the SPA HTML fallback instead of JavaScript.
- Rebuilt the exact clean Beta 8 source commit `478d92d` with Vite base `/` and the public asset-pruning gate, then redeployed. Current production deployment: `f3d5ea39-e2ed-47c7-9f84-b3870837e581`, immutable URL `https://f3d5ea39.scangrade.pages.dev/`.
- `https://scangrade.io/` now references `/assets/index-CqgTxVDW.js`; it is served as JavaScript and matches the local artifact at SHA-256 `0ede0abb6eecddcb14dcb0056a08ee55b2e1490fc835bb0d77b20b58d9094813`.
- Live browser verification mounted the Beta 8 home screen and showed no console errors. The private/public boundary was unchanged.
- There is no current `/draft2/` deployment path. `draft1` was a legacy GitHub Pages prefix; current Beta 8 source lives on `autobuild/safe-20260223`, while the custom domain intentionally serves from `/`.

### 2026-07-17 difficult-writer gap-closure goal checkpoint

- Active objective: close safe automatic coverage toward at least 85% on difficult authentic handwriting while preserving zero known confident transcription errors. Production remains unchanged.
- Disk prerequisite completed: approximately 4.8 GB of reproducible debug imagery was checksum-verified on the Rugged drive and removed locally; compact results remain. See `docs/SCANGRADE_RUGGED_OFFLOAD_MANIFEST_20260716.md`.
- Frozen P05 baseline: original one-shot 48/70 automatic (68.6%), 22 yellow, 0 known confident errors. Repaired forensic development estimate 54/70 (77.1%), 16 yellow, 0 known confident errors. Residuals: 11 correct-candidate/selection gaps, four recognizer/representation gaps, and one dangerous model-family conflict (`17→12`).
- P05 capture overlap: 11 answers were yellow in both original and forensic capture, 11 only in the original, and five only in the rescan. Capture changes matter, but do not explain the stable residual majority.
- Simple number-bond line removal was rejected: untouched grayscale 4/6 versus 3/6 for border, divider, and projection masking. Destructive print removal is not the route.
- The planned larger-grayscale browser-local model was independently tested on P05 after training on P02/P03/P08/P09 and selection on older validation only. Result: 43/70 overall and 5/16 residuals; exact rerun matched. It cannot replace the strong reader.
- Teacher-confirmed neural writer adaptation was rejected. Ten confirmations reduced residual performance to 3/16 and twenty to 2/16. Reversal profiles must remain explicit student-scoped review aids; unconfirmed reversed digits remain yellow.
- Promising strict shadow selector: require current-yellow status, continuous/stitched selected-frame TrOCR agreement, agreement with at least two non-tied retained-frame reads, slot-compatible length, both selected-view token floors >=0.3, every existing confidence/ambiguity/conflict veto, and material support from a packet-held-out local model (top three, probability >=0.05). Truth is joined only after selection; no answer key enters recognition.
- A scorer audit caught and repaired an initially missed nested ambiguity veto before any app change. With all vetoes correctly applied, the strict selector chose 1/1 opened historical residual and 4/4 P05 residuals correctly. It moves the repaired P05 development estimate to 58/70 (82.9%), not 85.7%, and blocks the dangerous `17→12`.
- A separate hypothesis that clears only nested `override-retained-material-rival` flags when the top-level reason is non-hard and all multi-view/local support passes selected two additional correct P05 reads (`18` and `40`), reaching 60/70 (85.7%). This clearance rule was designed after P05 truth and must not be implemented without prospective falsification.
- Exact duplicate collapse plus local top-three support matched 16/16 pattern cases and would read P05 number-bond `1717` as `17`, but that answer retains a nested ambiguity veto. It remains yellow.
- Important limitation: all rules were identified after P05 truth was opened; historical packets also influenced development. Five strict selected answers cannot support a deployment claim. Keep the strict rule private shadow-only and the clearance variant analysis-only until a prospective packet or September data falsifies them.
- Durable scripts/reports: `scripts/audit_p05_gap_closure.py`, `scripts/build_p05_number_bond_print_variants.py`, `scripts/evaluate_p05_writer_adaptation.py`, `scripts/analyze_p05_local_model_topk.py`, `scripts/screen_multiview_local_support_selector.py`; reports under `private-evidence/reports/*20260717.json` including `multiview-local-support-selector-screen-20260717.json`.
- Next work: investigate structural de-duplication/length handling for number-bond `17→1717` as review evidence; formalize the student-scoped reversal suggestion contract without auto-acceptance; add the selector only to an off-by-default shadow path with tests; then run full safety and reproducibility regressions. Do not deploy recognition changes yet.

### 2026-07-17 gap-closure historical falsification and final safety decision

- The tempting 85.7% P05 clearance estimate is rejected. A new falsification set used 40 manually labelled answers from historical holdout packets H07/H08 that were excluded from local-model training and selection.
- Continuous and stitched strong-reader views agreed on 19 answers: 17 correct and two wrong. Requiring packet-external local top-three support at probability >=0.05 retained 14: 13 correct and one wrong.
- The retained error is real and visually clear: `H|82.7`, handwritten `16`, read as `15` by continuous TrOCR (0.935718), stitched TrOCR (0.643216), and the local model (top one 0.900121). The open-loop child-written `6` shares a writer-specific failure across model/crop views.
- These old captures have no authentic adjacent burst frames, so this cannot validate or exactly replay the strict selector's frame-stability condition. It does decisively show that the model/view stack is not independent enough to clear an existing ambiguity veto merely because it agrees.
- A packet-scoped teacher-confirmed normalized-shape prototype was also tested as a veto-only upper bound. It caught both wrong unanimous reads but challenged 11 correct reads, so generic shape matching is rejected. The existing reversal profile remains a review-only suggestion contract: explicit confirmation, packet scope, no identity, no automatic acceptance.
- Final recognition decision for this goal: preserve all hard and nested ambiguity vetoes; do not deploy the selector, duplicate collapse, local model, line removal, or writer adaptation. The strict P05 shadow result remains 58/70 (82.9%) with zero observed errors, but it is post-truth development evidence, not a product metric or release candidate.
- Reproducible evidence: `scripts/screen_historical_manual_holdout_local_support.py`, `private-evidence/reports/historical-manual-holdout-local-support-screen-20260717.json`, `scripts/evaluate_writer_prototype_veto.py`, and `private-evidence/reports/writer-prototype-veto-screen-20260717.json`.

### 2026-07-18 teacher-pen-stroke Beta 9 candidate

- Tony approved replacing Beta 8's whole-mark fade/reveal with teacher-like physical pen motion. Checkmarks are now one uninterrupted left-to-right stroke through the check's corner; X marks use two sequential crossing strokes.
- The implementation animates an SVG mask over the exact final raster annotation rather than drawing a second approximate mark. This preserves the existing physical-box placement, seeded natural variation, ink texture, and final annotation exactly, with no end-of-animation position jump.
- Recognition, grading, confidence policy, crops, capture, strong-review routing, and final annotation geometry are unchanged.
- Reduced-motion behavior remains immediate. A check finishes in 500 ms; an X uses two 270 ms strokes with the second beginning after 210 ms. The existing 620 ms per-question cadence therefore never advances before the mark is complete.
- Focused unit tests prove a check contains exactly one continuous path and an X exactly two. Production build passes. The real WebKit/mobile delayed-review test passed all gates, including single-stroke check presence, pending-question concealment, final-image concealment, and clean completion. Evidence: `private-evidence/reports/progressive-marking-webkit-20260717.json` and `.png`.
- Candidate label: `2026.07.18-teacher-pen-strokes-beta-9-candidate`. It is not deployed, committed, or pushed yet.
