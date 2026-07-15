# ScanGrade Accuracy Roadmap - 2026-07-05

## Decision

Keep the current worksheet/answer-box design for now. The synthetic answer-box bakeoff was practically tied, so a summer redesign is not the main lever. The next reliability gains should come from the recognition stack: digit model, preprocessing selector, blank/artifact detection, and narrowly validated context assistance.

## Current Evidence

Primary benchmark:

- Truth score report: `private-evidence/reports/truth-score-20260704-general-policy-inkw6-abc.json`
- Digit failure report: `private-evidence/reports/digit-failure-dataset-20260705-current/summary.json`
- Digit dataset: `datasets/handwritten_truth_digits_current/`

Answer-level baseline against handwritten truth:

- 582 labelled answers.
- 289 auto/confident answers.
- 287 auto-correct.
- 2 auto-wrong.
- 293 yellow/manual-review.
- Auto coverage: 49.7%.
- Auto accuracy: 99.3%.

Digit-slot baseline:

- 960 slot rows.
- 865 filled slots.
- Current filled-digit accuracy: 74.1%.
- Row-sheet filled-digit accuracy: 83.5%.
- Non-row filled-digit accuracy: 67.6%.
- Blank-slot policy accuracy: 67.9%.

Weakest layouts:

- Number bonds: 47.7% filled-digit accuracy.
- Dot collections: 67.9%.
- Number patterns: 69.5%.
- Ten frames: 71.7%, with especially weak blank-slot accuracy.

Largest digit confusions:

- `1 -> 7`: 48 cases.
- `1 -> 9`: 18 cases.
- `6 -> 5`: 11 cases.
- `9 -> 2`: 10 cases.

Important ceiling signal:

- 104 currently-wrong filled digit slots already have the correct digit in one of the app's generated preprocessing variants.
- The best old standalone ONNX model/policy tested on the clean subset reached 72.8%.
- The current integrated selector reached about 73.6% on the same subset.
- Conclusion: swapping to an existing old model is not enough. The opportunity is a better ScanGrade-specific selector/fine-tune path.

## Product Principle

Use the answer key as context only, never as truth. Students often wrote mathematically wrong answers. The app should confidently mark those wrong only when it has correctly read what the student wrote. Broad answer-key-based overrides are unsafe.

## Concrete Plan

### 1. Lock The Benchmark Harness

Before app changes, every candidate must be scored against the same handwritten-truth corpus.

Required benchmark outputs:

- Answer-level auto coverage.
- Answer-level auto accuracy.
- Confident wrong count.
- Yellow/manual-review count.
- Digit accuracy by family, layout, slot side, and digit.
- Yellow cases where the app's leading candidate matches handwritten truth.

Promotion gate:

- No increase in confident wrong answers on validation/holdout.
- Any coverage improvement must be shown separately for row and non-row sheets.
- The sealed holdout must remain honest; do not train or tune on it.

### 2. Fine-Tune The Matching Digit Model

Do not train a scratch model on the small classroom set. The scratch attempt overfit: training accuracy rose while validation stayed weak.

Use the existing `ScanGradeDigitCNN` trainer:

- Start from a compatible checkpoint such as `models/worksheet-digit-tony-generalist-aug-strong-20260601.pt`.
- Add the real labelled classroom crops via `--extra-labeled-raw datasets/handwritten_truth_digits_current/train`.
- Keep external MNIST/EMNIST data in the mix to reduce overfitting.
- Evaluate against `datasets/handwritten_truth_digits_current/val` and `holdout`, not just the training set.
- Export only to a private candidate model first.

Success target for the model track:

- Improve non-row digit accuracy meaningfully without hurting row sheets.
- Specifically reduce `1 -> 7` and `1 -> 9`.
- Do not deploy until replay scoring shows answer-level safety.

### 3. Build A Variant Selector

The app already produces multiple preprocessing variants. The report shows a strong opportunity: 104 current misses had the correct digit somewhere in the variants.

Train/evaluate a small selector using:

- Variant digit predictions.
- Variant confidences and top gaps.
- Slot quality metrics.
- Layout family.
- Slot name: left, right, single.
- Review reason.
- Optional blank/filled evidence.

Start with an offline selector. Only export a simple JS implementation if validation and holdout improve.

Success target for the selector track:

- Convert variant opportunity into answer-level coverage.
- Do not lower review flags by simply trusting more weak predictions.

### 4. Improve Blank And Artifact Detection

Blank-slot failures still create fake companion digits, especially on visual/non-row sheets.

Build and evaluate:

- A binary blank-vs-filled classifier or rule set from known blank slots.
- Stronger divider/box-line artifact detection.
- Per-layout blank risk reports, especially ten frames and mixed one-digit-in-two-slot cases.

Success target:

- Fewer false two-digit reads from blank slots.
- No loss of genuine student-written wrong two-digit answers.

### 5. Add Cautious Context Assistance

Context can help, but it must be narrow.

Current finding:

- Broad leading-`1` overrides are unsafe.
- Row-sheet left-slot `7 -> 1` looked safe in the current evidence.
- Non-row leading-`1` context is riskier because some students really wrote wrong leading digits.

Preferred implementation order:

1. First expose context as a teacher-review suggestion, for example "likely 1", without auto-grading.
2. Only auto-clear a context correction if validation and holdout prove it keeps confident wrong at zero.
3. Keep answer-key context out of cases where the handwriting could plausibly be a real student error.

### 6. Diagnose Non-Row Crop/Preprocessing Separately

Number bonds, ten frames, dot collections, and number patterns are still well behind fact rows. Keep the printed design stable, but investigate invisible scanning changes:

- Crop padding and crop centering.
- Whether diagram/connector lines enter the digit tensor.
- Per-layout preprocessing choices.
- Whether answer-slot side differs on left vs right.

Any crop/preprocessing change needs replay evidence before app code changes.

## Near-Term Sequence

1. Generate a frozen benchmark summary from the current corpus and save it as the baseline.
2. Run compatible checkpoint fine-tunes with the real-student train split.
3. Evaluate candidate ONNX models on validation and holdout digit slots.
4. Build an offline variant-selector search using the 104 opportunity cases.
5. Replay the best model/selector at answer level.
6. If safety holds, integrate behind a build label and replay all saved scans.
7. Only then deploy a public candidate build.

## Summer Target

The summer goal is not to declare victory from the current classroom set. It is to build a recognizer and benchmark process that reaches substantially higher coverage while preserving the ScanGrade safety promise.

Practical staged targets:

- Stage 1: 60-65% auto coverage with 0 confident wrong on validation/holdout.
- Stage 2: 70-75% auto coverage with 0 confident wrong and visible gains on non-row layouts.
- Stage 3: September live-classroom validation toward 85-95% useful confident coverage.

The September classroom test remains the real product proof.

## Smoke-Test Addendum

After this roadmap was drafted, two private smoke tests were run.

Fine-tune smoke:

- Private output: `private-evidence/model-candidates/sg3-20260705-finetune-smoke/`
- Started from `models/worksheet-digit-tony-generalist-aug-strong-20260601.pt`.
- Trained for 8 epochs with `datasets/handwritten_truth_digits_current/train` as extra labelled raw data.
- Result on the same handwritten-truth digit evaluator: `594/848` (`70.0%`) with best-confidence policy.
- This did not beat the current model stack. Do not deploy this smoke candidate.

Fixed variant-selector smoke:

- A simple per-layout/per-slot selector improved calibration from `73.1%` to `75.0%`.
- It got worse on validation (`76.0%` to `73.3%`) and holdout (`72.8%` to `69.9%`).
- Conclusion: hard-coded "use this variant for this layout/slot" rules overfit. The variant opportunity is real, but it needs a per-item selector using confidence and quality signals.

Leading-`1` context smoke:

- In labelled candidate slots where the expected digit was `1` and the app read `7` or `9`, `64/66` were truly `1`.
- `2/66` were real student-written wrong digits.
- Conclusion: this is a good teacher-review suggestion candidate, not yet a broad auto-correction rule.

Per-item selector smoke:

- Added evaluator: `scripts/eval_digit_variant_selector.py`
- Private reports:
  - `private-evidence/reports/digit-variant-selector-20260705/no-key/summary.json`
  - `private-evidence/reports/digit-variant-selector-20260705/answer-key-context/summary.json`
  - `private-evidence/reports/digit-variant-selector-20260705/layout-features/summary.json`
  - `private-evidence/reports/digit-variant-selector-20260705/answer-key-layout/summary.json`
- No-answer-key selector:
  - Validation stayed at current baseline: `95/126` (`75.4%`).
  - Holdout improved by only one digit slot: current `62/88` (`70.5%`) -> model `63/88` (`71.6%`).
  - Gated mode correctly chose not to switch.
  - Conclusion: feature-based variant selection without answer-key context is not yet strong enough to deploy.
- Answer-key-context selector:
  - Validation improved: current `95/126` (`75.4%`) -> `106/126` (`84.1%`).
  - Holdout improved: current `62/88` (`70.5%`) -> `82/88` (`93.2%`).
  - However, this is not auto-deploy proof because the holdout has only two digit slots where the student's handwriting differs from the expected answer.
  - Treat this as strong evidence for teacher-review suggestions, not automatic correction.

Flexible blank cleanup smoke:

- Added evaluator: `scripts/eval_flexible_blank_policy.mjs`
- Private report: `private-evidence/reports/flexible-blank-policy-20260705/summary.json`
- Broad current-style blanking would be unsafe if generalized: it would blank many real filled slots.
- A stricter generalized rule fixed 4 true blank slots but still blanked 2 real filled slots.
- Conclusion: do not broadly apply general single-written-digit blank cleanup. Keep the existing narrow optional-blank rule, and use any broader version only as a review suggestion unless a safer rule is proven.

Updated Technical Direction:

1. Keep public auto-grading conservative.
2. Do not deploy the smoke fine-tune, no-key selector, fixed variant selector, or generalized blank cleanup.
3. Build answer-key-aware suggestions for teacher review, clearly separated from auto-grading.
4. Continue searching for non-key recognition gains through multi-model ensembles, better crop/preprocessing, and more robust blank detection.

## Multi-Model Ensemble Addendum

A new offline evaluator was added:

- Script: `scripts/eval_digit_model_ensemble.py`
- Package command: `npm run eval:digit-ensemble`
- Private reports:
  - `private-evidence/reports/digit-model-ensemble-20260705/no-key/summary.json`
  - `private-evidence/reports/digit-model-ensemble-20260705/layout-features/summary.json`
  - `private-evidence/reports/digit-model-ensemble-20260705/answer-key-context/summary.json`
  - `private-evidence/reports/digit-model-ensemble-20260705/answer-key-layout/summary.json`

No-answer-key ensemble:

- Evaluated 848 filled, labelled digit slots through 10 existing ONNX worksheet digit models.
- Current holdout baseline: `75/103` (`72.8%`).
- Best-confidence across all model/variant candidates: `79/103` (`76.7%`), but this is too blunt.
- Majority vote: `78/103` (`75.7%`).
- Logistic model selector: `81/103` (`78.6%`).
- Gated selector tuned on validation: `78/103` (`75.7%`), with 3 rescued holdout digit slots and 0 harmed holdout slots.
- Validation also improved safely: `114/150` (`76.0%`) -> `118/150` (`78.7%`), with 4 rescues and 0 harms.
- Layout ID features did not materially change the no-key result, which suggests the improvement is not simply page memorization.
- Interpretation: this is the first production-relevant, non-key recognition gain that survives holdout, but it is not yet large enough to ship as the main answer.

Answer-key-context ensemble:

- The pure answer-key-context selector reached `98/103` (`95.1%`) on holdout, matching the model/variant oracle, but it also showed validation harm in the less conservative gated mode.
- The safety-gated answer-key-context selector reached `93/103` (`90.3%`) on holdout with 18 rescues and 0 harms; validation reached `122/150` (`81.3%`) with 8 rescues and 0 harms.
- This is strong evidence for a teacher-review suggestion layer, not a silent auto-correction policy. The answer key can help say "this probably says 1" on a yellow item, but it must not rewrite a student's genuinely wrong answer without review.

Updated concrete next steps:

1. Build an answer-level replay evaluator for ensemble candidates so digit-slot gains are converted into the product metric that matters: confident answer coverage, confident wrong count, and yellow review count.
2. Integrate the no-key ensemble behind an internal/debug flag only after answer-level replay proves it does not increase confident wrong answers.
3. Add answer-key-aware "likely read" suggestions to the teacher-review data contract first, not to auto-grading. The app can highlight a yellow item with a suggested digit/answer while still requiring teacher confirmation.
4. Continue non-key gains by training a ScanGrade-specific selector/model on calibration data and validating against held-out classroom packets. Prioritize `1 -> 7`, `1 -> 9`, right-slot failures, and non-row layouts.
5. Do not redesign the current worksheet packet this summer unless a replay result shows the layout itself is the bottleneck. Current evidence says recognition/selection is the bigger lever.

## Answer-Level Ensemble Addendum

A new whole-answer evaluator was added:

- Script: `scripts/eval_digit_ensemble_answer_level.py`
- Package command: `npm run eval:digit-ensemble-answers`
- Private reports:
  - `private-evidence/reports/digit-ensemble-answer-level-20260705/no-key/summary.json`
  - `private-evidence/reports/digit-ensemble-answer-level-20260705/no-key-layout/summary.json`
  - `private-evidence/reports/digit-ensemble-answer-level-20260705/answer-key/summary.json`
  - `private-evidence/reports/digit-ensemble-answer-level-20260705/answer-key-layout/summary.json`

Current answer-level baseline from the same 582 labelled answers:

- Whole-answer read matches handwritten truth: `342/582` (`58.8%`).
- Auto/confident answers: `289/582` (`49.7%`).
- Auto-correct against handwritten truth: `287/289` (`99.3%`).
- Auto-wrong against handwritten truth: `2/289`.
- Yellow/manual-review answers: `293/582`.
- Yellow current read already matches handwritten truth: `55/293` (`18.8%`).

No-answer-key ensemble at answer level:

- Safety-gated keep-review policy: whole-answer read `354/582` (`60.8%`).
- It rescued 13 yellow suggestions, but harmed 1 currently-correct auto answer.
- Auto accuracy would fall from `287/289` (`99.3%`) to `286/289` (`99.0%`).
- Conclusion: the current no-key ensemble is not safe enough to become the production recognizer. It is useful evidence for the next model/selector training round, not a deployable automatic switch.

Answer-key-context ensemble at answer level:

- Gated keep-review policy: whole-answer read `472/582` (`81.1%`).
- Auto lane stayed at `287/289` (`99.3%`) because review status stayed unchanged.
- Yellow read/suggestion matches handwritten truth: `185/293` (`63.1%`), up from `55/293` (`18.8%`).
- It rescued 139 yellow suggestions and harmed 9 yellow suggestions.
- Safety-gated answer-key policy: whole-answer read `400/582` (`68.7%`), yellow suggestion matches `113/293` (`38.6%`), 61 rescues, 3 harms, no auto harm.
- Conclusion: answer-key context is product-useful as a teacher-review "likely read" suggestion, not as hidden auto-correction.

Layout signal:

- Row sheets current whole-answer read: `200/264` (`75.8%`).
- Non-row sheets current whole-answer read: `142/318` (`44.7%`).
- Answer-key gated suggestions lift non-row read/suggestion quality to `243/318` (`76.4%`) while keeping the current review status.
- This confirms that non-row layouts are not hopeless, but the automatic no-key recognizer does not yet know how to make those calls safely.

Updated plan from this evidence:

1. Protect the current auto lane. Do not deploy any recognizer change that increases confident wrong answers.
2. Build teacher-review suggestions first. Use answer-key-aware and context-aware suggestions only inside yellow review UI/debug output, clearly separated from the score.
3. Train a stronger no-key ScanGrade recognizer using the classroom digit corpus, but keep the existing validation/holdout discipline. Existing model/variant ensembles show a high oracle ceiling, but the selector has not learned enough yet.
4. Work non-row layouts as a recognition/preprocessing problem, not a worksheet-redesign problem for now. Ten frames, dot collections, number bonds, number patterns, and place value are the real drag.
5. Only raise auto coverage after a no-key candidate improves answer-level validation/holdout with zero added confident wrong answers.

Concrete next implementation move:

- Add a review-only "likely read" suggestion path for yellow answers, backed by the answer-key/context ensemble evidence, without changing the saved score or auto-correct/incorrect marks.
- In parallel, start the next no-key model-training track aimed at reducing left-slot/leading-digit confusions without using the answer key.

## Review-Only Suggestion Implementation Addendum

Implemented the first production-facing step from the plan: a review-only likely-read suggestion for yellow answers.

What changed:

- `src/components/CameraCapture.vue` now attaches `reviewSuggestion` to answer groups when a yellow/review answer has a cautious likely read.
- `src/services/studentReviewStore.js` saves `answerGroups` and `questionReview`, so the review suggestion survives into teacher review data.
- `src/App.vue` shows compact "Likely reads" chips in teacher review cards.
- `scripts/replay_live_ocr_captured.mjs` mirrors the same suggestion policy for saved-debug replay.
- `scripts/score_replay_against_handwritten_truth.mjs` can count suggestion correctness when replay outputs include suggestions.
- `scripts/eval_review_suggestion_policy.mjs` evaluates the lightweight live-app suggestion policy directly against the frozen handwritten-truth corpus.

Current lightweight policy result:

- Report: `private-evidence/reports/review-suggestion-policy-20260705/summary.json`
- Same 582 labelled answers.
- Auto lane unchanged: `289/582` confident, `287/289` correct, `2/289` confidently wrong.
- Yellow/manual-review answers: `293`.
- Current yellow leaning matches handwritten truth only `55/293` (`18.8%`).
- Review suggestions appear on `130/293` yellow answers (`44.4%`).
- Review suggestions match handwritten truth `126/130` (`96.9%`).
- Review suggestions rescue `97` yellow answers where the current lean was wrong.
- Non-row review suggestions: `98/100` correct (`98.0%`).
- Row review suggestions: `28/30` correct (`93.3%`).

Safety tightening from the first implementation:

- Removed answer-key-only `5 -> 6` review hints unless there is strong independent OCR evidence.
- Kept ten-frame answer-key context guarded: answer-key context there needs strong independent OCR support.
- Did not broadly suppress dot-collection leading-`1` suggestions because that dropped too many correct suggestions for too little precision gain.

Interpretation:

- This is not the 90-95% automatic confident-read goal yet.
- It is a real product improvement because many yellow items can now open with a likely answer already suggested to the teacher.
- The suggestion must stay clearly review-only. The remaining wrong suggestions are mostly cases where the expected answer and the student's actual wrong handwriting conflict.

Next plan:

1. Browser-replay the new app payload once Playwright/usage limits allow it, then score a replay that actually contains `reviewSuggestion` fields.
2. Keep auto grading unchanged until a no-answer-key recognizer improves answer-level validation/holdout with zero added confident wrong answers.
3. Continue no-key recognizer work with a safety objective: reduce `1 -> 7`, `1 -> 9`, and non-row left-slot failures without using answer-key truth.
4. Build a yellow-review workflow around fast confirmation: suggested value first, one-tap accept/correct, never hidden auto-correction.
5. Use September live-classroom data as the real proof for raising automatic confident coverage.

## 2026-07-07 Safety-Tightened Review Suggestions

The first live review-suggestion policy was useful but still produced 4 wrong teacher-facing hints on the labelled corpus. The July 7 pass tightened the policy around the two observed danger zones:

- Leading `7 -> 1` answer-key-context hints now require independent OCR evidence for `1`.
- Pure OCR-alternative hints now require every changed nonblank slot to have strong independent evidence (`>= 0.79`).

Final policy report:

- `private-evidence/reports/review-suggestion-policy-20260707/final-strong-review-suggestions/summary.json`
- Auto lane unchanged: `289/582` auto, `287/289` correct, `2/289` wrong.
- Yellow/manual-review answers: `293`.
- Review suggestions: `79/293` yellow answers.
- Suggestion correctness: `79/79` (`100%`) against handwritten truth.
- Yellow rescues: `50`.
- Row suggestions: `17/17` correct.
- Non-row suggestions: `62/62` correct.

Browser replay verification:

- Replay directory: `private-evidence/reports/review-suggestions-browser-smoke-20260707-final/`
- Truth score: `private-evidence/reports/review-suggestions-browser-smoke-20260707-final/truth-score.json`
- On the 12-capture smoke subset, the live Vue app emitted `9/9` correct yellow suggestions with `0` wrong suggestions and `0` auto-wrong reads.

No-key yellow-only ensemble result:

- `scripts/eval_digit_ensemble_answer_level.py` now emits yellow-only strategy scores.
- Conservative no-key gated selector: `13` yellow rescues, `0` yellow harms, `0` auto harm.
- Aggressive selector: `31` yellow rescues, but `2` yellow harms.
- Interpretation: useful research signal, but still not enough to become a deployable recognizer.

Product implication:

- For teacher review, precision matters more than volume. The stricter policy is preferable for market readiness because a wrong "likely read" can erode trust.
- This does not increase automatic confident coverage. It makes yellow review faster and safer while the no-key recognizer work continues.

Updated next technical moves:

1. Keep the strict review-suggestion policy unless a new validation set shows it is too conservative.
2. Build the next no-key recognizer/selector around answer-level objectives: more auto coverage only if confident wrong stays flat or drops.
3. Mine the no-key yellow-only rescues to identify portable crop/preprocessing signals, especially for non-row layouts.
4. Do not let answer-key context silently change marks. Its current role is teacher assistance only.

## 2026-07-07 No-Key Ensemble Overlap Addendum

The yellow-only ensemble result needed a stricter interpretation. The earlier conservative report said `13` yellow rescues, `0` yellow harms, and `0` auto harm, but that harm metric only counted damage to yellow answers whose current read already matched handwriting truth. It did not count cases where the ensemble changed one wrong yellow lean into a different wrong teacher-facing suggestion.

New overlap/gate-search tooling:

- `scripts/eval_review_suggestion_policy.mjs` now emits per-answer `items`.
- `scripts/eval_digit_ensemble_answer_level.py` now emits per-answer strategy `items`.
- `scripts/analyze_review_suggestion_overlap.mjs` compares strict live review suggestions with no-key ensemble suggestions and searches simple additive gates.

Private reports:

- `private-evidence/reports/review-suggestion-policy-20260707/final-strong-review-suggestions-with-items/summary.json`
- `private-evidence/reports/digit-ensemble-answer-level-20260707/no-key-yellow-only-with-items/summary.json`
- `private-evidence/reports/review-suggestion-overlap-20260707/summary.json`

Findings:

- Strict live review suggestions stayed `79/79` correct.
- Aggressive no-key ensemble changed suggestions were only `31/66` correct.
- Conservative gated no-key ensemble changed suggestions were only `13/27` correct.
- Combining strict live suggestions with conservative no-key ensemble suggestions would drop teacher-facing suggestion accuracy from `100%` to `84/95` (`88.4%`).
- Simple gate search found only a tiny safe additive pocket: `3/3` extra row-sheet rescues. It did not find a useful zero-wrong non-row gate.

Decision:

- Do not deploy the no-key ensemble as a teacher-facing suggestion source.
- Treat no-key ensemble rescues as research examples for the next recognizer and preprocessing work.
- Product-facing teacher suggestions should continue to prefer high precision over higher volume.

## 2026-07-07 Auto-Lane Trust Patch

After the no-key ensemble overlap check, the next highest-safety move was to inspect the remaining confident wrong reads. The frozen `582`-answer corpus had only two confident OCR misses. Both were non-virtual single-slot answers read as `6` where the worksheet expected a visually adjacent `5` or `8`.

Patch:

- Added `single-digit-six-shape-mismatch-review` to the live app and replay harness.
- The rule is review-only. It does not change the recognized digit and does not mark an answer correct.
- It uses answer-key context only to say "this specific 6-shaped mismatch is risky enough for teacher review."

Evidence:

- Full-corpus simulation: `private-evidence/reports/single-digit-six-risk-review-20260707/full-corpus-policy-simulation.json`
  - Before: `289` auto, `287` auto-correct, `2` auto-wrong.
  - After: `287` auto, `287` auto-correct, `0` auto-wrong.
  - It demoted exactly the two known auto-wrong cases and no auto-correct cases.
- Browser replay: `private-evidence/reports/single-digit-six-risk-review-20260707/truth-score.json`
  - `374` matched groups.
  - `205/205` auto-correct, `0` auto-wrong.
  - `53/53` yellow review suggestions correct.

Interpretation:

- This is a good trust patch because it removes known confident wrong reads.
- It is not a coverage breakthrough. Non-row auto coverage is still roughly `40%` in this replay.
- Next work should continue toward a better no-key recognizer/selector and non-row crop/preprocessing improvements, with the same zero-added-confident-wrong gate.

## 2026-07-07 Variant Top-K Suggestion Addendum

The next review-suggestion pass tested whether answer-key context could safely help the common non-row leading-slot `7 -> 1` failure.

Rejected path:

- A broad non-row leading-seven context rule added only `7` hints and got `2` wrong.
- The wrong cases were real student wrong answers (`72`/`73`) on dot-collection work where the key expected `12`/`13`.
- This confirms the core rule: the answer key can assist review, but cannot be trusted to override plausible handwriting.

Accepted tiny path:

- Count preprocessing variant `topK` alternatives as independent evidence.
- Allow leading `7 -> 1` review suggestions only when independent `1` evidence is at least `0.22`.
- This does not affect auto grading, score, or review status.

Evidence:

- Report: `private-evidence/reports/review-suggestion-policy-20260707/live-variant-topk-leading-one-022-with-items/summary.json`
- Labelled corpus:
  - Previous strict review suggestions: `79/79` correct.
  - New review suggestions: `82/82` correct.
  - Added `3` correct suggestions, `0` wrong suggestions.
  - Non-row suggestions: `64/64` correct.
- Browser smoke:
  - `private-evidence/reports/variant-topk-leading-one-review-20260707-browser/truth-score.json`
  - `47/47` auto-correct, `0` auto-wrong.
  - `15/15` yellow suggestions correct.
- Full browser replay:
  - `private-evidence/reports/variant-topk-leading-one-review-20260707-full-browser/truth-score.json`
  - `205/205` auto-correct, `0` auto-wrong.
  - `56/56` yellow suggestions correct.
  - Non-row auto coverage remains weak at `79/198` (`39.9%`), even though non-row auto accuracy stayed `100%`.

Product implication:

- This is worth keeping because it improves teacher review precision/coverage slightly without weakening trust.
- It is not close to the market-readiness coverage goal by itself.
- The next major lever remains no-key recognition/preprocessing for non-row layouts.

## 2026-07-08 Selector Diagnosis Addendum

The latest full browser replay was mined more deeply to understand whether remaining yellow cases are model-blind or selector-blind.

New tooling:

- `scripts/analyze_replay_failure_modes.mjs`
- `scripts/analyze_replay_review_opportunities.mjs`

Primary reports:

- `private-evidence/reports/failure-modes-20260707/variant-topk-full-browser.json`
- `private-evidence/reports/review-opportunities-20260707/variant-topk-full-browser.json`
- `private-evidence/reports/review-suggestion-policy-20260707/current-default-rerun/summary.json`

Current replay facts:

- Full browser replay: `374` matched answer groups.
- Auto/confident: `205/374`.
- Auto accuracy: `205/205`, with `0` confidently wrong.
- Yellow/manual review: `169`.
- Yellow current lean already matches handwritten truth: `35`.
- Yellow wrong-leaning cases: `134`.
- Review suggestions in the replay: `56/56` correct.

Opportunity finding:

- `101/134` yellow wrong-leaning cases had at least trace evidence for the handwritten-truth answer somewhere in current read, model topK, preprocessing variants, or variant topK.
- `73/134` had weak-or-better evidence across all needed slots.
- `36/134` had medium-or-better evidence across all needed slots.
- `16/134` had strong evidence across all needed slots.
- Non-row layouts accounted for `101/134` of the yellow wrong-leaning cases.

Interpretation:

- The recognizer is not completely blind. Many misses have the right digit somewhere in the evidence cloud.
- The current app is correctly conservative because false variant candidates can also be very confident.
- A naive no-key "pick the strongest variant" policy is unsafe:
  - Threshold `0.95`: `8/17` correct suggestions.
  - Threshold `0.75`: `12/49` correct suggestions.
- Therefore, the market-readiness problem is a calibrated selector/model problem, not a threshold-loosening problem.

Updated priority:

1. Keep the auto lane conservative.
2. Preserve strict review-only suggestions because they are high precision.
3. Build a real no-key selector using slot quality, variant quality, family/layout risk, slot side, current-vs-alternative disagreement, and validation/holdout splits.
4. Judge selector candidates at whole-answer level before any app integration.
5. If selector gains stay small, move to a ScanGrade-specific model/blank-classifier training track rather than forcing current variants into production.

## 2026-07-08 Split-Aware Gate Search Addendum

A split-aware no-key gate search was added to test whether simple handwritten rules can extract safe suggestions from variant evidence.

New script:

- `scripts/search_no_key_variant_review_gates.mjs`

Report:

- `private-evidence/reports/no-key-variant-review-gates-20260708/full-browser.json`

Method:

- Joined latest full browser replay to handwritten truth.
- Used existing digit-row split labels:
  - Calibration: `208` replay-matched groups.
  - Validation: `100`.
  - Holdout: `66`.
- Generated no-answer-key candidate suggestions from model topK, preprocessing variant top-1 predictions, and variant topK alternatives.
- Searched simple gates over confidence, changed-slot count, variant top-1 support, topK support, and row/non-row family.

Result:

- The best calibration-zero-wrong gate was tiny:
  - `conf>=0.95 changed<=1 vtop>=0 topk>=0 row`
  - Calibration: `1/1` correct.
  - Validation: `1/1` correct.
  - Holdout: `0` suggestions.
- No useful zero-wrong non-row gate survived validation/holdout.
- Broader gates were unsafe:
  - `conf>=0.9 changed<=1 ... all`: validation `2` correct / `8` wrong; holdout `2` correct / `9` wrong.
  - `conf>=0.9 changed<=1 ... non-row`: validation `1` correct / `8` wrong; holdout `2` correct / `9` wrong.

Decision:

- Reject simple no-key variant gates as production logic.
- The right digit is often somewhere in the evidence cloud, but false high-confidence alternatives are also common.
- The next selector must be learned or model-based, not a small set of handcrafted thresholds.

Implication for market-readiness:

- Current safety is good; coverage remains the problem.
- The path to 90-95% useful coverage likely requires a stronger ScanGrade-specific recognizer plus a calibrated selector/blank-artifact classifier, not more confidence loosening.

## 2026-07-08 Learned No-Key Selector Addendum

A learned no-answer-key replay selector was tested after the simple gate search failed to find useful safe coverage.

New script:

- `scripts/eval_no_key_replay_selector.mjs`

Reports:

- `private-evidence/reports/no-key-replay-selector-20260708/no-layout.json`
- `private-evidence/reports/no-key-replay-selector-20260708/layout.json`

Method:

- Used the latest full browser replay: `374` handwritten-truth matched answer groups.
- Generated `3713` alternative answer candidates from current read, model topK, preprocessing variants, and variant topK.
- Trained on calibration only and evaluated separately on validation and holdout.
- Tested both broad no-key features and an optional layout-feature variant.

Result:

- The best calibration-zero-wrong selectors were too small to matter:
  - No-layout: calibration `1/1`, validation `0`, holdout `0`.
  - Layout-features: calibration `1/1`, validation `0`, holdout `0`.
- Thresholds that produced validation/holdout suggestions produced wrong suggestions.
- Adding layout ID did not solve the generalization problem.

Decision:

- Do not deploy the learned replay selector.
- Do not spend more time trying to rescue broad yellow coverage from replay metadata alone.
- The next selector attempt needs visual quality features, not just prediction metadata.

Updated technical priority:

1. Build tensor/image quality measurements for each slot and variant.
2. Train or rule-search a blank/artifact detector that distinguishes real handwriting from box lines, divider ticks, shadows, and empty-slot noise.
3. Feed those visual quality features into selector experiments.
4. Continue judging every candidate at answer level with calibration/validation/holdout splits and the zero-confident-wrong constraint.

## 2026-07-08 Visual Quality Audit Addendum

The tensor-quality path was tested directly after the learned selector failed.

New script:

- `scripts/analyze_replay_visual_quality.mjs`

Updated script:

- `scripts/eval_no_key_replay_selector.mjs` now supports `--quality-features`.

Reports:

- `private-evidence/reports/visual-quality-audit-20260708/full-browser.json`
- `private-evidence/reports/no-key-replay-selector-20260708/quality.json`
- `private-evidence/reports/no-key-replay-selector-20260708/quality-layout.json`

Finding:

- Visual quality features explain some of the problem but do not solve it by themselves.
- Yellow wrong-leaning answers have worse tensor evidence than yellow correct-leaning answers:
  - Yellow correct: usable variant ratio `0.4413`, artifact variant ratio `0.4426`.
  - Yellow wrong: usable variant ratio `0.3244`, artifact variant ratio `0.6009`.
- Non-row yellow-wrong answers are worse than non-row auto-correct answers:
  - Non-row auto-correct: usable variant ratio `0.4518`, artifact variant ratio `0.4654`.
  - Non-row yellow-wrong: usable variant ratio `0.3392`, artifact variant ratio `0.5811`.
- However, row one-digit layouts can look artifact-heavy while still grading correctly, so simple quality gates would throw away too much good evidence.

Selector test:

- Adding quality features to the learned selector did not pass the safety gate.
- Quality-only selector:
  - Calibration-zero-wrong gates: `0`.
  - Validation-zero-wrong gates: `0`.
- Quality + layout selector:
  - Calibration-zero-wrong gates: `0`.
  - Validation-zero-wrong gates: `0`.

Decision:

- Do not use generic tensor-quality features as production selector logic yet.
- The next useful artifact path is supervised or semi-supervised: create a small labelled set of real handwriting vs blank/box-line/divider/noise crops, then train/evaluate a binary classifier or explicit blocking feature.

Updated priority:

1. Generate contact sheets for suspicious slots and clean slots.
2. Label artifact categories on a small split-aware sample.
3. Train or rule-search a real-writing-vs-artifact detector.
4. Use the detector conservatively to block false alternatives or route questionable slots to review.
5. Only consider auto-lane changes after validation/holdout prove zero added confident wrong.

Follow-up artifact:

- Added `scripts/create_artifact_label_pack.mjs`.
- Generated `private-evidence/artifact-label-packs/20260708-visual-quality/contact-sheet.png` and `records.json`.
- The pack contains `93` examples: `47` suspicious-artifact candidates and `46` comparison auto/yellow-correct candidates.
- Spot-checking the sheet confirmed why labels are needed: some comparison examples still contain visible divider/box artifacts despite coming from correct app outcomes.

## 2026-07-08 Blank / Artifact Classifier Addendum

A first split-aware filled-vs-blank classifier smoke test was run using the existing digit-row dataset.

New script:

- `scripts/eval_blank_artifact_classifier.mjs`

Reports:

- `private-evidence/reports/blank-artifact-classifier-20260708/summary.json`
- `private-evidence/reports/blank-artifact-classifier-20260708/visual-only.json`

Method:

- Joined slot-level rows to saved `debug.json` tensors.
- Trained only on calibration rows.
- Evaluated validation and holdout separately.
- Ran a `--visual-only` mode that removes current-policy leakage fields.

Visual-only result:

- Usable rows: `918`.
- Calibration: `605` filled, `34` blank.
- Validation: `157` filled, `13` blank.
- Holdout: `103` filled, `6` blank.
- AUC:
  - Calibration `0.9996`.
  - Validation `0.998`.
  - Holdout `1.0`.
- Best calibration-zero-false-blank gate:
  - Calibration: caught `26/34` blanks with `0` filled slots misclassified as blank.
  - Validation: caught `9/13` blanks with `0` filled slots misclassified as blank.
  - Holdout: caught `5/6` blanks with `0` filled slots misclassified as blank.

Interpretation:

- This is the most promising artifact path so far.
- The target should be a narrow blank/artifact blocker or review demotion, not a broad answer selector.
- Caveat: some blank labels were inferred from current app slot underscores, so this is not enough to deploy.

Next technical step:

- Convert this into a manually validated artifact/blank classifier path:
  1. Label the generated artifact contact sheet.
  2. Train/evaluate with manual labels.
  3. Simulate replay-only review demotion/blocking.
  4. Integrate only if validation/holdout prove no added confident wrong.

## 2026-07-08 Blank / Artifact Replay Simulation Addendum

The visual-only blank/artifact classifier was tested at answer level on the latest full browser replay.

Updated script:

- `scripts/eval_blank_artifact_classifier.mjs` now supports `--simulate-replay`.

Report:

- `private-evidence/reports/blank-artifact-classifier-20260708/visual-only-replay-sim.json`

Result:

- Matched replay groups: `374`.
- Baseline:
  - Auto `205/374`.
  - Auto-correct `205/205`.
  - Auto-wrong `0`.
  - Yellow `169`.
  - Yellow current lean correct `35`.
- The classifier detected `14` blank slots.
- Conservative demotion made no auto-lane changes and kept auto-wrong at `0`.
- Review-only blanking suggestions:
  - `3` suggestions.
  - `3/3` correct.
  - `0` wrong.
  - All three were ten-frame false companion digit cases: `71 -> 7`, `81 -> 8`, `91 -> 9`.

Decision:

- This is a safe but small review-assist gain.
- Do not auto-blank or change scoring yet.
- After manual artifact labels, combine this with the existing strict review-suggestion policy and measure total teacher-review assist coverage.

## 2026-07-08 Combined Review-Assist Addendum

The current strict review suggestions were combined with the blank/artifact suggestions to measure teacher-review assist coverage on the latest full browser replay.

New script:

- `scripts/eval_combined_review_assist.mjs`

Report:

- `private-evidence/reports/combined-review-assist-20260708/summary.json`

Result:

- Baseline latest replay:
  - Matched groups: `374`.
  - Auto/confident: `205/374`.
  - Auto-correct: `205/205`.
  - Auto-wrong: `0`.
  - Yellow/manual review: `169`.
- Existing built-in review suggestions:
  - `56` suggestions.
  - `56/56` correct.
  - `0` wrong.
  - `35` rescues.
- Blank/artifact review suggestions:
  - `3` suggestions.
  - `3/3` correct.
  - `0` wrong.
  - `3` rescues.
- Combined:
  - `59/169` yellow answers get a suggestion.
  - `59/59` suggestions match handwritten truth.
  - `0` wrong suggestions.
  - `38` rescues.
  - `0` harmed current-correct yellow reads.

Split/family safety:

- Row: `15/50` yellow answers suggested, `15/15` correct.
- Non-row: `44/119` yellow answers suggested, `44/44` correct.
- Calibration: `30/30` correct.
- Validation: `20/20` correct.
- Holdout: `9/9` correct.

Decision:

- Treat this as a product workflow win, not an auto-grading win.
- It can make yellow teacher review faster by prefilling a likely value for about `35%` of review cases.
- Keep these suggestions review-only until a larger validation path proves they can be safely promoted.
- Continue deeper recognition work separately; market-ready automatic coverage still requires reducing non-row yellow volume.

Implementation note:

- Added repeatable command: `npm run eval:combined-review-assist`.
- Updated Teacher Review UI to show a passive `Likely reads` count and confidence/source metadata on suggestion chips.
- `npm run build` passes.
- This does not change the auto lane; it only makes review-assist coverage visible and measurable.

## 2026-07-08 Six-From-Five Review Gate Addendum

The next non-row/yellow-volume pass targeted the largest remaining uncovered single-digit confusion: yellow answers where current OCR leans `5` but the likely/contextual read is `6`.

New script:

- `scripts/search_six_from_five_review_gate.mjs`

New command:

- `npm run search:six-five-review-gate`

Result on latest full-browser replay:

- Candidate `5 -> 6` review-only cases without existing suggestions: `9`.
- Old `0.75` independent-evidence gate gave `0` suggestions.
- New `0.25` gate with at most one changed slot gives:
  - `2` suggestions.
  - `2/2` correct.
  - `0` wrong.
  - `2` rescues.
  - `1` validation rescue and `1` holdout rescue.
  - `1` row rescue and `1` non-row rescue.

Implementation:

- Lowered the `6`-from-`5` likely-read suggestion evidence threshold from `0.75` to `0.25` in the app and replay harness.
- This remains review-only. It does not clear yellow review or change auto scoring.

Decision:

- Keep as a small safe improvement.
- This is not enough to materially move market-ready coverage.
- The next larger gains still require non-row crop/preprocessing/model improvements, not broader context thresholds.

Combined review-assist update:

- `scripts/eval_combined_review_assist.mjs` now includes the six-five stream alongside built-in and blank/artifact review suggestions.
- Latest combined review-assist result:
  - Baseline auto/confident: `205/374`, `205/205` correct, `0` wrong.
  - Yellow/manual review: `169`.
  - Built-in suggestions: `56/56` correct.
  - Blank/artifact suggestions: `3/3` correct.
  - Six-five suggestions: `2/2` correct.
  - Combined suggestions: `61/169` yellow answers, `61/61` correct, `0` wrong, `40` rescues.
- This is still review-assisted coverage, not automatic coverage.

## 2026-07-08 Non-Row Variant-Lane Push

The deeper non-row pass added a reusable analyzer and one tiny review-only policy improvement.

New analyzer:

- Script: `scripts/analyze_nonrow_variant_lanes.mjs`
- Command: `npm run analyze:nonrow-variant-lanes`
- Main report: `private-evidence/reports/nonrow-variant-lanes-20260708/summary.json`
- Broader current replay report: `private-evidence/reports/nonrow-variant-lanes-20260708/current-abc-summary.json`

Main diagnostic finding:

- Latest browser replay: non-row filled slots were `231/340` current-correct (`67.9%`).
- `92/109` wrong non-row filled slots already had the correct digit somewhere in preprocessing variants (`84.4%` variant opportunity).
- Broader labelled replay: non-row filled slots were `354/545` current-correct (`65.0%`), with `154/191` wrong slots having the correct digit somewhere in variants (`80.6%` opportunity).
- Interpretation: non-row failures are often selector/crop/preprocessing choice failures, not absence of image signal.

Safe lane discovered:

- Non-row left slot currently read as `7`, with an independent preprocessing variant top-read of `1`, repeatedly matched handwritten truth at the slot level.
- Slot-level search showed this as `15/15` correct with `0` wrong across calibration, validation, and holdout on the broader labelled replay.
- Whole-answer testing found an important trap: changing only the left slot can still produce a wrong answer if the unchanged companion slot is also unstable. Example: `76 -> 16` when truth was `15`.

Implementation:

- Added a review-only no-key non-row leading-one suggestion path.
- It only fires when the layout is a Grade 1 last-week non-row layout, the left slot currently reads `7`, a preprocessing variant reads left slot `1` with confidence at least `0.25`, the answer is already yellow/review, and all companion slots are stable.
- The suggestion is labelled `no-key-non-row-leading-one-review`.
- It does not change the score, does not clear review, and does not affect auto-grading.
- Candidate selection now filters unsafe candidates before choosing the best safe suggestion, so a rejected answer-key-context candidate does not block a safe no-key candidate.

Evidence:

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

Decision:

- Keep this small review-only improvement.
- Do not promote this pattern to auto-grading.
- The larger product path is clearer now: non-row preprocessing variants contain substantial correct information, but a production selector must reason at the whole-answer level, not just slot level.

## 2026-07-08 Whole-Answer Non-Row Selector Push

Goal:

- Move beyond slot-level non-row diagnostics and test whether complete answer candidates can safely rescue more yellow/manual-review answers.

New reusable tool:

- `scripts/analyze_nonrow_whole_answer_variants.mjs`
- `npm run analyze:nonrow-whole-answer-variants`

Reports:

- `private-evidence/reports/nonrow-whole-answer-variants-20260708/summary.json`
- `private-evidence/reports/nonrow-whole-answer-variants-20260708/with-review-blank-candidates-summary.json`
- `private-evidence/reports/nonrow-whole-answer-variants-20260708/with-pattern-scores-summary.json`

Findings:

- Non-row yellow/manual-review answers are the major remaining bottleneck:
  - `119` non-row yellow answers.
  - Current lean correct on only `18/119`.
  - Current lean wrong on `101/119`.
- The hidden signal is substantial:
  - `79/119` non-row yellow answers have the handwritten truth somewhere in digit-swap candidates.
  - Adding analysis-only review-slot blank candidates raises this to `86/119`.
- Layout opportunity is uneven:
  - Dot collections: `21/27` oracle coverage.
  - Ten frames: `19/29` with blank candidates, but only `12/29` without blank candidates.
  - Number bonds: `19/27`.
  - Number patterns: `15/23`.
  - Place value: `12/13`.

Safety result:

- A broad whole-answer rule search tested `1,454,400` candidate rule variants.
- Only the existing `left:7>1` family remained zero-wrong with calibration, validation, and holdout support.
- Blank candidates are promising but not safe as hard-coded rules:
  - `right:1>null` on ten-frames: `4` correct, `2` wrong, and both wrongs were in holdout.
  - No blank/candidate pattern had zero wrong with both validation and holdout support.

Decision:

- Do not add another hard-coded non-row suggestion gate from this pass.
- The next push should be one of:
  - train/evaluate a learned answer-level selector over candidate features,
  - strengthen visual blank/artifact evidence so blanking is based on image quality rather than expected-answer shape,
  - improve non-row crop/normalization so the correct variant becomes the top read more often.
- Preserve the current auto lane; review-assist may improve, but automatic grading should not be loosened.

## 2026-07-08 Learned Selector And Visual Blank Follow-Up

What was tested:

- Exported whole-answer candidate rows from `scripts/analyze_nonrow_whole_answer_variants.mjs`.
- Added `scripts/eval_learned_answer_selector.mjs` for analysis-only learned candidate selection.
- Added `scripts/analyze_visual_blank_candidate_gate.mjs` to connect whole-answer blank candidates with visual blank/artifact classifier scores.

Key evidence:

- Learned answer selector:
  - No-truth-leak calibration-only version selected only `1` full-corpus answer: `1/1` correct.
  - Calibration+validation training selected `15` full-corpus answers: `14` correct, `1` holdout wrong.
  - One-slot-only calibration+validation training selected `19`: `17` correct, `2` holdout wrong.
  - Conclusion: promising diagnostics, not safe for product. It overfits patterns such as `left:9>1`.
- Visual blank gate:
  - Existing visual-only blank replay: `3/3` review suggestions correct, `0` wrong, `3` rescues.
  - One-slot blank-only candidate analyzer: best zero-wrong gate found `2/2` correct, `0` wrong, validation-only.
  - Two-slot / blank-plus-rewrite candidate analyzer: no zero-wrong threshold; wrong candidates appear before useful coverage.

Product decision:

- Do not ship learned answer-level selection.
- Do not broaden blank/artifact blanking beyond the existing conservative review-assist path.
- The biggest remaining gap is not policy selection. It is non-row recognition quality: crop normalization, digit model quality, and answer-box/image design need to make the correct student-written digit the top or near-top visual read more consistently.
