# ScanGrade Active Handoff

Last updated: 2026-06-07
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

Use Tony's latest completed worksheet photos and live iPhone scan exports to improve ScanGrade's confident-read rate while keeping high-confidence reads trustworthy.

Current target:

- Preserve at least 95% confident reads on the active 9 raw worksheet photos.
- Preserve 100% accuracy on those high-confidence reads.
- On rough live camera captures, prefer yellow teacher review over any confident wrong read.
- Review flags are acceptable for genuinely ambiguous handwriting; confident wrong reads are not acceptable.

Important interpretation:
Score OCR against the handwritten answer visible in the box, not only against the worksheet answer key. Some student answers are mathematically wrong, and those should become confident red Xs only when the OCR read itself is trustworthy.

Tony reaffirmed this on 2026-06-06: math-wrong student answers are good evidence because they simulate actual app performance. Optimize detection relative to what the student wrote, not relative to the correct math answer.

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

1. Test build `2026.06.07-1354-EDT-sg3-burst-capture` on Tony's phone using the QR workflow and compare auto-capture ease plus confident/read accuracy.
2. If live scans still over-review after burst capture, improve preprocessing/model signal using the replay artifacts before relaxing confidence again.
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
