# ScanGrade Accuracy Experiments and Safe Implementation — 2026-07-09

## Verdict

The current digit OCR should remain the automatic-grading authority for now. The best demonstrated jump is a second, key-blind whole-answer model used only to accelerate teacher review. It does not replace the current OCR, does not receive the answer key, and cannot make an answer automatic.

An optional local service and client integration now implement that architecture. If the service is absent, slow, or returns an invalid response, the existing app continues normally.

## Context-preserving crop experiment

Two expanded digit crops were tested on the same 86 captures and 582 hand-labelled answers:

- `context-safe-slot`: expanded crop with light known-line removal;
- `context-raw-slot`: expanded crop with no known-line removal.

The first implementation allowed these crops into the primary candidate system. It produced one confident transcription error: a handwritten `16` was promoted to `14`, the mathematical key. That implementation failed the safety gate.

The crops were then separated from primary votes, confidence, crop-quality guards, and suggestion promotion. A second-pass implementation produced primary results that were bit-for-bit identical to baseline across all 86 pages:

- automatic answers: 323/582;
- confident accuracy: 323/323;
- primary replay differences with the experiment on versus off: 0/86 pages.

As review evidence, however, the expanded crops changed the answer-key-constrained suggestion result from 47/47 correct suggestions to 52 correct and one wrong. The wrong suggestion was again handwritten `16` versus key `14`. Key-blind use of the context crops alone was poor: simple independent selection strategies achieved only about 7–22% accuracy over useful coverage ranges.

Decision: do not ship expanded digit crops as an answer suggestion or automatic input. Keep the isolated machinery experimental for future model training and visual diagnosis only.

Evidence:

- `private-evidence/reports/fidelity-context-baseline-truth-score-20260709.json`
- `private-evidence/reports/fidelity-context-suggestion-v3-truth-score-20260709.json`
- `private-evidence/reports/fidelity-context-suggestion-v3-{a,b,c}-20260709/`

## Whole-answer model result

The ScanGrade-adapted TrOCR model remains the strongest complementary recognizer:

- validation: 105/136 exact, 77.2%;
- untouched page-block holdout: 92/114 exact, 80.7%;
- answers marked yellow by the current app across validation and holdout: 67/100 exact;
- yellow-answer disagreements at the shipped review threshold of 0.98 minimum token probability: 20/22 model alternatives correct;
- the model added a correct option not already available in the control UI for 18/100 yellow answers.

The last figure shows substantial teacher-review value, not safe automatic coverage. In the two high-confidence disagreements involving mathematically incorrect student answers, the current OCR was correct and the whole-answer model was wrong. Therefore the interface must always preserve the current transcription and present the model only as a second choice.

The model is key-blind. Its service rejects requests containing `answerKey` or `expected` fields.

## Implemented architecture

### Optional review service

`scripts/serve_trocr_review.py`:

- loads the MIT-licensed TrOCR base and the private 2.9 MB ScanGrade LoRA adapter;
- binds to `127.0.0.1` by default;
- exposes `/health` and `/recognize`;
- accepts only answer images and question identifiers;
- explicitly rejects answer-key fields;
- returns normalized reads and token-probability diagnostics;
- serializes model inference for thread safety;
- supports an optional bearer token through `SCANGRADE_REVIEW_TOKEN`.

The tested warm batch of eight yellow crops took 922 ms wall time and read 7/8 correctly. The first request after model load took about 1.7 seconds. Model loading took about 14 seconds on the test Mac.

### Optional app integration

The client activates only when the page has a `reviewModelUrl` query parameter, for example:

`?reviewModelUrl=http%3A%2F%2F127.0.0.1%3A8766`

Behavior:

- sends only question crops already marked for review;
- sends no problem, expected result, or answer key;
- aborts after 2.5 seconds;
- requires the response to assert `answerKeyUsed: false`;
- accepts a model choice only when minimum token probability is at least 0.98;
- discards a redundant model read that equals the current OCR;
- keeps the current OCR as the first correction choice;
- preserves the model and existing suggestion as additional distinct choices, up to three total;
- never changes digits, correctness, confidence, review status, or automatic coverage.

Default production behavior is unchanged when the flag is absent.

### Retrospective 20-packet A/B simulation

A packet-blocked simulation was run after implementation. This measures whether the correct transcription is available as a review choice; it does not measure human review time.

- 20-packet validation block, 60 yellow answers:
  - control correct choice available: 25/60 (41.7%);
  - treatment correct choice available: 34/60 (56.7%);
  - paired gain: 9 answers;
  - paired losses: 0.
- untouched holdout block, 40 yellow answers across 14 represented packets:
  - control correct choice available: 13/40 (32.5%);
  - treatment correct choice available: 22/40 (55.0%);
  - paired gain: 9 answers;
  - paired losses: 0.
- Combined:
  - control: 38/100 correct option available;
  - treatment: 56/100;
  - 18 net additional resolvable answers, no displaced correct choices.

One high-confidence model alternative was wrong on authentic incorrect student math in holdout, while the current OCR was correct. Because the current OCR remains first and all control choices are preserved, the correct option remained available. This confirms that the model must remain review-only.

Evidence: `private-evidence/reports/review-lane-ab-simulation-20260709.json`.

### Perspective capture experiment

The fidelity audit found width distortion to be the strongest capture-level geometric correlate of OCR loss. Pages in the highest width-distortion quartile had 63.7% digit accuracy versus 77.4% in the lowest quartile.

Capture debug records now include width balance, height balance, edge tilt, and side lean. An opt-in flag:

`?strictPerspectiveCapture=1`

requires a preferred overhead geometry for automatic capture. It does not block manual capture, and default capture behavior is unchanged. Historical simulation suggests a width-ratio threshold near 1.15 would flag roughly the worst 7 of 86 accepted captures; actual rescan benefit still requires a paired live test.

## Verification completed

- Production build passes.
- Python service compiles.
- Service health and inference tested on localhost.
- Service rejects answer-key-bearing requests with HTTP 400.
- Warm eight-image held-out batch tested end to end.
- Built app loads with the review-service flag and no browser console warnings/errors.
- Expanded-crop primary isolation verified with zero primary differences on all 86 pages.
- Automatic benchmark remained 323/323 correct confident answers on the 582-answer truth corpus.

## Deployment recommendation

Do not make the home Mac a required grading dependency. Use it for private beta experimentation while the app retains its current local fallback. If the review lane improves measured correction time, package this same service in a managed, scale-to-zero container with a same-origin authenticated proxy.

A permanently free public host is not a dependable production assumption for a roughly 335-million-parameter model. Free tiers may be useful for trials, but availability, cold starts, memory limits, and policy changes make them unsuitable as the sole grading path. The optional/fallback architecture removes that existential dependency.

## Next decisive test

Run a paired review-time study on at least 20 unseen packets:

1. Randomize yellow answers between current review UI and current-plus-whole-answer-choice.
2. Keep the answer key hidden from the model.
3. Measure median seconds per reviewed answer, wrong teacher clicks, corrections undone, model uptime, and added scan latency.
4. Require no increase in wrong final transcriptions.
5. Continue only if median review time falls by at least 25% without a safety regression.

Separately, collect paired captures of the same completed page with ordinary and strict-perspective guidance. The perspective gate should become default only if it measurably improves OCR or crop alignment without materially increasing abandonment or manual-capture use.

## Stop conditions

- Do not promote whole-answer reads into automatic grading from this dataset.
- Do not show an AI alternative without retaining the direct current OCR reading.
- Do not use answer-key agreement as evidence that a transcription is correct.
- Do not enable expanded context digit crops in production candidate selection.
- Do not require a home server or free cloud tier for core grading completion.
