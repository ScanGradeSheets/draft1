# ScanGrade pre-capture fidelity and recognition review — 2026-07-13

## Decision

Do not change the default automatic-grading path before the new packets are scanned. The current conservative path remains the safest tested configuration: on the fresh 374-answer benchmark it automatically accepted 233 answers and all 233 matched handwritten truth. Every tested stronger local-alignment mode reduced coverage and introduced one to four confident transcription errors.

The best next architecture is a hybrid, but not a Mac-mini-dependent product:

1. Keep the current browser OCR as the always-available primary system.
2. Preserve the original gray whole-answer crop.
3. Send yellow answers to a key-blind whole-answer model as an optional review assistant.
4. Initially show its reading as another teacher choice and record it in shadow mode. Never let service downtime block grading.
5. Use the new unscanned packets to decide whether an extremely strict model-agreement rule can safely promote a small number of yellow answers later.

No public deployment, push, or default OCR behavior change was made in this review.

## Fresh baseline

The current working code was replayed from the saved classroom captures rather than accepting an older summary.

- Captures scored against handwritten truth: 67
- Matched answers: 374
- Automatic: 233/374 (62.3%)
- Correct automatic transcriptions: 233/233
- Known confident transcription errors: 0
- Yellow/manual review: 141/374 (37.7%)
- Row automatic coverage: 136/176 (77.3%)
- Non-row automatic coverage: 97/198 (49.0%)
- Existing built-in review suggestions: 29/29 correct
- Combined existing review helper: 34/141 suggestions, 34/34 correct, 31 genuine rescues

The zero-error result is encouraging but not a market claim. With 233 successes and no observed errors, the simple 95% “rule of three” upper bound is still about a 1.3% true error rate.

Primary evidence: `private-evidence/reports/exhaustive-baseline-20260713/truth-score.json` and `combined-review-assist.json`.

## Where fidelity is lost

The saved artifacts allow inspection from the selected camera frame through page warp, answer crop, cleanup variants, 28×28 model input, and OCR decision. They do not include a lossless scan of the original physical pencil page, so paper-to-camera loss can only be inferred, not measured directly.

### Capture and geometry

Across 865 truth-labelled digit slots:

- Current digit correctness: 641/865 (74.1%).
- Row: 83.5%; non-row: 67.6%.
- Left slots: 75.4%; right slots: 73.1%; single slots: 73.2%. There is no large universal left/right failure.
- Low versus high page perspective severity: 81.6% versus 71.7% digit accuracy.
- Low versus high sideways width distortion: 77.4% versus 63.7%.
- Low versus high lighting variance: 82.7% versus 65.7%.
- Focus had only a weak layout-adjusted relationship with error (Spearman 0.061). “Looks sharp” is not a reliable quality test by itself.

Interpretation: camera quality matters, but the important variables are overhead geometry and even light, not simply blur or resolution.

### Local answer-box registration

Four complete 374-answer replays tested how strongly crops should follow detected local boxes:

| Registration policy | Automatic | Correct automatic | Wrong automatic | Decision |
| --- | ---: | ---: | ---: | --- |
| Current conservative blend | 233 | 233 | 0 | Keep |
| Template only | 199 | 195 | 4 | Reject |
| Local position | 222 | 220 | 2 | Reject |
| Strong local | 227 | 225 | 2 | Reject |
| Full local | 228 | 227 | 1 | Reject |

The stronger detector sometimes locks onto the wrong printed structure. More geometric correction is not automatically more faithful.

### Crop and preprocessing

- Of 224 wrong digit reads, 104 (46.4%) have the correct digit in at least one stored crop/preprocessing variant.
- The remaining 120 have no correct stored variant, indicating missing/poor visual information or model weakness rather than selection alone.
- The best single alternate preprocessing policy did not beat the integrated current policy.
- Correct reads lost about 6.4% of gray “ink” under gentle cleanup; wrong reads lost about 11.2%.
- A controlled four-seed experiment trained the same small CNN on raw-gray versus production-normalized crops. Average validation accuracy was 67.4% raw versus 63.0% normalized; holdout was 57.3% versus 55.3%. Seed 23 reproduced exactly on 2026-07-13.
- Raw gray retains useful stroke evidence, but the small raw-crop CNN is still not strong enough to replace production OCR.

### Simulated degradation of the whole-answer crop

The key-blind whole-answer model was rerun on 250 validation/holdout crops:

| Condition | Exact transcription |
| --- | ---: |
| Original saved crop | 197/250 (78.8%) |
| Mild blur | 194/250 (77.6%) |
| Local perspective distortion | 185/250 (74.0%) |
| Blur + shadow + JPEG degradation | 188/250 (75.2%) |
| Autocontrast + sharpening | 175/250 (70.0%) |

Ordinary blur caused little loss. Local perspective caused more. Aggressive “clarification” was worst, confirming that faint pencil information can be destroyed by apparently cleaner black-and-white images.

## Recognition alternatives tested

### Existing digit models and ensembles

- The strongest older standalone digit model/policy reached 72.8% on 848 eligible items, below the current integrated path.
- A ten-model, key-blind ensemble had a large oracle ceiling (about 95%), proving that candidate diversity exists.
- Its learned gated selector improved held-out digit accuracy from 72.8% to 75.7% without held-out digit harm in that small block.
- At whole-answer level, applying selectors to automatic answers introduced harm. Yellow-only use improved suggestions but is not sufficient evidence for silent promotion.
- The learned answer selector and blank/artifact classifier are too data-starved for automatic decisions. The blank holdout contained only six blanks.

Decision: keep ensemble evidence in review/shadow analysis only.

### Key-blind whole-answer model

The locally cached, ScanGrade-adapted TrOCR model reads the preserved gray answer as one object instead of separately judging 28×28 black digit tiles.

- Validation: 105/136 exact (77.2%).
- Packet-block holdout: 92/114 exact (80.7%).
- Row crops: 88.2%; non-row: 67.5%.
- One digit: 89.1%; two digits: 70.7%.
- On 100 yellow answers, adding the strict model alternative increased cases with a correct tap choice from 38 to 56.
- In the 40-answer holdout yellow block, correct choice availability rose from 13 to 22.
- One highly confident model alternative was wrong where the current OCR had correctly preserved a student's mathematically incorrect answer. This prevents silent replacement.

Promotion-threshold analysis found 15/15 correct yellow reads at minimum token probability 0.999, including 7/7 in holdout. Those sample sizes have weak lower confidence bounds (roughly 80% overall and 65% holdout), so they justify a prospective shadow test, not automatic grading.

### Local runtime feasibility

The free local service was restored and tested end to end with no answer key supplied or accepted.

- Cold model/service load in the current cached environment: about 0.25 seconds.
- One crop: 285 ms CPU inference.
- Twenty crops in one batch: 3.03 seconds server inference, 3.11 seconds wall time.
- The service returned the expected `6` on the representative held-out smoke crop.
- Production build passed.

This is fast enough for an optional Mac-side development or fallback service. It should not be a launch dependency. The same containerized service can later run on an ordinary cloud CPU/GPU provider; cloud cost and reliability should be measured only after the new-packet shadow test proves accuracy value.

## Capture-gate experiment

A key-blind retake gate was calibrated using only pre-recognition page measures. It could separate lower-quality pages, but absolute thresholds shifted badly across packet blocks. The calibration-selected combined gate retained 75% of calibration pages but only 30% of holdout pages. A gentler width-distortion gate generalized better but produced only modest accuracy separation.

Decision: do not ship the learned/absolute retake gate yet. Use clear capture guidance and log the metrics prospectively. A future gate should be device-relative and validated on the new captures.

## What has been ruled out

- The problem is not simply a weak digit model.
- The problem is not simply blurry camera input.
- Sharpening/binarizing the images more is actively harmful.
- Following locally detected boxes more aggressively is unsafe.
- Swapping in an older digit model does not produce a jump.
- Current learned selectors do not generalize safely enough.
- A confident whole-answer model result cannot yet replace a student’s transcription.

## Best pre-capture plan

1. Freeze the current browser path as the control.
2. Capture intact packets in their original order; do not mix students. Student/packet identity is essential for honest holdout analysis.
3. Before bulk scanning, use one non-holdout page to verify that debug capture saves the selected frame, warp, crops, and model inputs.
4. Scan under diffuse, even light with the device close to parallel to the page. Avoid a strong side angle and page curl. Do not chase maximum sharpness or use image-enhancement filters.
5. Keep at least two complete student packets untouched as a final packet-level holdout. Do not choose them based on handwriting quality.
6. Run the current OCR and the whole-answer model in shadow/review mode on development packets.
7. Label handwritten truth from the physical page/crop without looking at the answer key first.
8. Freeze thresholds before opening the final holdout packets.

## Decision gates for the new packets

Promote the whole-answer model into the visible review workflow if, on unseen packets:

- it improves correct-choice availability by at least 20 percentage points or reduces median correction time by at least 25%;
- it never removes or overwrites the current OCR choice;
- mathematically wrong student answers are represented in the test set and remain faithfully transcribed;
- service failure leaves browser grading fully usable.

Consider automatic yellow promotion only after at least 500 prospectively held-out promoted answers with zero ordinary confident errors and broad student/template coverage. Even that is an initial gate, not proof of zero risk. Any wrong promotion of an authentic incorrect-math answer immediately falsifies the promotion policy.

## New or refreshed evidence

- `private-evidence/reports/exhaustive-baseline-20260713/`
- `private-evidence/reports/frame-registration-template-only-20260713/`
- `private-evidence/reports/frame-registration-local-position-20260713/`
- `private-evidence/reports/frame-registration-strong-local-20260713/`
- `private-evidence/reports/frame-registration-full-local-20260713/`
- `private-evidence/reports/pipeline-fidelity-audit-20260709.json`
- `private-evidence/reports/preprocess-stage-fidelity-20260709.json`
- `private-evidence/reports/preprocess-fidelity-variant-eval-20260709.json`
- `private-evidence/reports/raw-vs-model-digit-information-repro-20260713.json`
- `private-evidence/reports/capture-quality-simulation-exhaustive-20260713.json`
- `private-evidence/reports/digit-model-ensemble-20260705/no-key/summary.json`
- `private-evidence/reports/digit-ensemble-answer-level-20260705/no-key/summary.json`
- `private-evidence/reports/review-lane-ab-simulation-exhaustive-20260713.json`
- `private-evidence/reports/whole-answer-promotion-safety-20260713.json`
- `private-evidence/reports/capture-retake-gate-20260713.json`

## Reproducibility notes

- `SG_FRAME_REGISTRATION_MODE` was added to the offline replay harness for the alignment matrix. Default is `current`.
- `scripts/analyze_whole_answer_promotion.mjs` reproduces promotion-safety tables.
- `scripts/simulate_capture_retake_gate.mjs` reproduces the exploratory capture-gate analysis.
- `requirements-trocr-review.txt` now records `torchvision`, which the restored TrOCR environment required.
- All experiment modes are opt-in; the default app path is unchanged.
