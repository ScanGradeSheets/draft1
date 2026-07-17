# ScanGrade browser-local TrOCR-small result — 2026-07-16

## Verdict

A materially stronger Mac-independent browser model now exists as a credible shadow candidate, but it is not ready to change grades.

The best packet-held-out OCR-specific model read **244/275 answers correctly (88.7%)**, versus **196/275 (71.3%)** for the prior 6.4 MB compact model and **242/275 (88.0%)** for the 335M-parameter adapted strong reader on the same stitched evidence. It uses the preserved larger grayscale answer as a whole and never receives an answer key.

The selected final opened-data adapter has 62,026,752 total parameters, only 430,080 trainable LoRA parameters, and a 1.7 MB private adapter. Its base is `microsoft/trocr-small-handwritten`. The current browser package is an **84 MB** float16 encoder plus int8 decoder. It passed single-answer Chromium and WebKit parity at about **0.78–0.79 seconds per answer** on the Mac mini.

Do not deploy it as an automatic authority yet. Raw model confidence is unsafe, number bonds remain weak, repeated ONNX Runtime Web session reuse can stall, physical old-iPad memory is untested, and the sealed P05 prospective packet remains untouched.

## Evaluation boundary

- Answer key supplied to any tested recognizer: **no**.
- Mathematical correctness used as handwriting truth: **no**.
- Recent packet folds: P02, P03, P08, and P09, with the held-out packet excluded from gradients and read only after epoch selection on historical validation.
- Sealed P05 used: **no**.
- Historical final-model selection: development + all opened recent packets for gradients, historical validation for epoch selection, historical holdout read afterward.
- Production/Candidate 6 behavior changed: **no**.

## What was tested

### Failed architecture and crop screens

| Candidate | Result | Decision |
|---|---:|---|
| ImageNet MobileNetV3-small, global pooling, structure metadata | P02 14/68 | Reject |
| ImageNet MobileNetV3-small, 2×8 spatial pooling | P02 10/68 | Reject |
| Existing compact encoder on separate larger slot crops + blank/layout metadata | P02 29/68 | Reject |
| Whole stitched compact model plus slot-crop residual | 193/275 (70.2%) | Reject; 9 gains, 12 losses versus 196/275 |
| Generic TrOCR-small without adaptation | 27/275 (9.8%) | Reject generic model |
| Decoder-only TrOCR-small LoRA | P02 39/68 (57.4%) | Reject as replacement |
| Wider robust-geometry crop as universal primary view | P02 51/68 (75.0%) | Reject universal use; keep as clipping evidence |

The wider crop did repair a real information-loss case: P02 number-bond Q2 contained handwritten `19`, the stitched view clipped most of the `9`, and the robust crop preserved the full `19`. The wide view also introduced printed borders and duplicate reads such as `12→1212`. This supports dual evidence, not global crop replacement.

### Winning architecture screen

Adapting attention projections in both the DeiT image encoder and TrOCR decoder produced the jump. Four packet-held-out folds:

| Held-out packet | Correct / total | Accuracy |
|---|---:|---:|
| P02 | 58/68 | 85.3% |
| P03 | 63/67 | 94.0% |
| P08 | 62/70 | 88.6% |
| P09 | 61/70 | 87.1% |
| **Combined** | **244/275** | **88.7%** |

Breakdown:

- row layouts: **149/160 (93.1%)**;
- non-row layouts: **95/115 (82.6%)**;
- one-digit answers: **92/100 (92.0%)**;
- two-digit answers: **152/175 (86.9%)**;
- Candidate 5 residual yellows: **16/25 (64.0%)**;
- number bonds: **12/22 (54.5%)**, the dominant remaining weakness.

The final model trained on all opened recent packets selected epoch 4 at **122/136 (89.7%)** historical validation and scored **96/114 (84.2%)** on historical holdout. This lower holdout result is the appropriate warning against treating 88.7% recent crossfit as a launch claim.

## Confidence and selector findings

Raw autoregressive probability is not calibrated for automatic grading. Among 275 out-of-fold reads, wrong answers remained above 0.995 and one wrong read exceeded 0.999. A 0.995 minimum-token threshold selected 173/275 but included three wrong transcriptions. Confidence alone is rejected.

The model is valuable as independent evidence:

- of 250 Candidate 5 non-yellow answers, it agreed with 228 and all 228 were correct;
- in all 22 non-yellow disagreements, the new model was wrong, so it must never override an existing accepted Candidate 5 read;
- on 25 Candidate 5 yellows, it was correct on 16;
- new-model/prior-compact agreement selected six of those 25 yellows, all six correct retrospectively, but this is not enough to authorize promotion before P05;
- 0%/2%/4% crop agreement selected 19 Candidate 5 yellows, including three wrong; crop stability is not independent proof.

The correct product role is therefore: immediate existing browser result first; larger local model only on unresolved yellow answers; existing ambiguity, frame, crop-edge, overwrite, answer-length, and model-family disagreement vetoes remain dominant; failure leaves the answer yellow.

## Worksheet contract and blank optional slots

Structural metadata was audited separately from answer-key data. Permitted fields are:

- layout family and layout ID;
- guide type;
- maximum handwritten digits;
- physical slot count;
- optional slot count.

Forbidden fields remain answer, canonical digits, expected digit, and mathematical key.

The sequence model already represents a blank optional slot by ending after one digit. Structural maximum length may cap impossible duplicate output, but physical printed slot count must not cap student writing: P02 number-bond Q2 had one expected physical slot yet the student authentically wrote incorrect two-digit `19`. That case proves why `max_handwritten_digits` and physical slot count must remain distinct.

Only four verified whole-answer blanks are present in the older continuous-zone corpus. This is insufficient to claim calibrated blank/erasure automation. Blank, erased, crossed-out, and overwritten states remain review territory.

## ONNX and browser results

The model was exported as separate encoder/decoder ONNX graphs. A decoder trace initially repeated outputs (`5→55`, `8→8888`) because the graph had captured only the one-token causal-mask branch. Tracing with a two-token decoder input and using the actual decoder start token repaired float parity from 62/68 to **68/68**. This exact export contract is now part of the reproducibility requirement.

Compression results on full P02:

| Package | Approx. size | Parity vs PyTorch | Decision |
|---|---:|---:|---|
| FP32 encoder + FP32 decoder | 246 MB | 68/68 | Accurate, too large |
| Int8 encoder + int8 decoder | 63 MB | 66/68 | Reject |
| FP32 encoder + int8 decoder | 128 MB | 68/68 | Pass parity |
| FP16 encoder + int8 decoder | **84 MB** | **68/68** | Leading browser candidate |

Single-answer 84 MB browser probe on the Mac mini, one WASM thread:

| Runtime | Model initialization | Inference | Token parity |
|---|---:|---:|---:|
| Chromium | 807 ms | 784 ms | pass |
| WebKit | 715 ms | 791 ms | pass |

Three disposable-page repeats passed in both engines at roughly 1.54–1.59 seconds wall time each, including model initialization and inference. Reusing one session for a batch of two or eight stalled, and a longer sequence of page/session recreations also eventually stalled. Production must use a disposable worker, sequential yellow-only execution, a strict per-page cap, explicit timeout, and fail-open termination. Physical old-iPad sustained memory remains a blocking gate.

At 84 MB, the first network download is material: approximately 67 seconds at 10 Mbps, 27 seconds at 25 Mbps, or 13 seconds at 50 Mbps before protocol/cache overhead. The model must be an opt-in/background cached asset, never block initial scanning, and never be fetched over a teacher's connection without clear status.

## Current recommendation

Advance this as the next **shadow-only browser-local candidate**:

1. Keep Candidate 6 unchanged and immediate.
2. Cache the 84 MB model in the background when the device has sufficient storage/memory.
3. Run at most one unresolved yellow per disposable Web Worker initially; terminate on success, timeout, memory pressure, navigation, or page change.
4. Attach layout/slot metadata to the evidence record, but never use answer/canonical/expected digits to choose transcription.
5. Use the robust wider crop only when a key-blind clipping/edge test fires; disagreement with the clean stitched view forces yellow.
6. Record shadow reads, timings, worker failures, and model hashes before revealing truth.
7. Freeze the selector before P05. P05 may falsify the candidate; it cannot establish a launch claim alone.

## Required next gates

- Build exact browser preprocessing from the app's real canvas path and verify it against saved browser pixels, not Pillow-only inputs.
- Integrate the model as a disposable-worker shadow with zero changes to grades/yellows.
- Replay all 40 pages and verify identical Candidate 6 outputs, annotations, and correction workflow.
- Measure worker success, memory, and latency on a physical older iPad over repeated pages.
- Freeze a selector using only development/calibration evidence.
- Run sealed P05 once, key-blind, with zero confident-error hard stop.
- Do not deploy automatic promotions unless P05 and subsequent prospective classroom evidence pass.

## Browser shadow integration and crop follow-up

The 84 MB candidate is now integrated behind an explicit, off-by-default shadow flag. It runs only on answers already yellow, one answer per disposable Web Worker, and cannot change a transcription, grade, annotation, or review state. The browser page performs the exact 384x384 preprocessing and transfers the tensor to the worker, avoiding an `OffscreenCanvas` dependency on older Safari. Unknown tokens, nonnumeric output, and answers outside `max_handwritten_digits` are rejected rather than guessed. Layout family, physical slot count, maximum handwritten length, and worksheet-declared optional-slot indices are attached to every request; a shorter valid whole-answer output marks only declared optional slots blank. A one-box number bond may still contain a genuine two-digit student response.

Browser verification:

- exact single-answer token parity passed in Chromium and WebKit;
- eight sequential disposable-worker reads passed in both engines with no stalls, averaging roughly 1.5 seconds per answer including model initialization;
- forced non-SIMD execution passed in both engines at roughly 3.2 seconds per answer;
- all 25 Candidate 5 residual yellows completed identically in Chromium and WebKit; the opened-data model read 24/25 correctly, but this is training-fit/browser-parity evidence, not a held-out accuracy claim;
- a fresh 40-page Candidate 6 replay with the feature off matched the restored Candidate 6 control on every evidence/output page;
- physical old-iPad sustained memory, download, camera, and thermal behavior remain untested.

Packet-held-out scoring on the exact browser-only split is less optimistic and is the correct estimate: the model read 80/99 browser yellows (80.8%), including 42/47 row yellows (89.4%) and 38/52 non-row yellows (73.1%). It read 164/176 browser-accepted answers correctly, so it must never override the existing accepted reader. Raw confidence is still unsafe.

The optional-slot contract is implemented and unit-tested, but whole-page blank authority is not demonstrated. On the only four explicitly verified whole-answer blanks in the historical crop corpus, the model hallucinated a digit on all four (at relatively low probabilities). Blanks, erasures, crossings-out, and overwritten answers therefore remain review states unless an independent blank gate is validated on substantially more authentic examples.

### Crop ablations

- Applying cleaned stitched images globally reduced packet-held-out top-one accuracy from 244/275 (88.7%) to 236/275 (85.8%). It rescued 6 answers but damaged 14. Primary/clean agreement was only 230/246 correct, so agreement is not an automatic selector.
- A packet-crossfit one-rule crop selector trained on key-blind image statistics rescued 1 answer but regressed 2. Flexible scoring was worse. Reject automatic crop selection.
- Training on both original and cleaned images was rejected after the full P02 fold: held-out accuracy fell to 56/68 and Candidate 5 residual-yellow accuracy fell to 3/8.
- Visual review of the 19 packet-held-out model misses among browser yellows found that roughly 12 visibly contain clipped/mispositioned strokes or dominant number-bond borders; the other 7 are principally handwriting/model ambiguity.
- The existing number-bond crop shifted down 4% improved the unmodified model from 12/22 to 14/22, with four rescues and two regressions. Training with shifted number-bond augmentation reduced general P02 accuracy to 50/68 and left shifted P02 number bonds at 2/5. Reject it as a new primary or training policy.
- A simple TrOCR-small/compact exact-agreement selector is also rejected: it selected known wrong answers in historical browser yellows.

The surviving architecture is therefore a safe shadow/review component, not an automatic promotion policy: preserve the original stitched grayscale view, carry the structural worksheet contract, retain alternate/context crops as disagreement and clipping evidence, and keep every unresolved or conflicting result yellow. Candidate 6 remains unchanged and P05 remains sealed.

## Artifacts

- Packet-held-out reports: `private-evidence/reports/v3-trocr-small-lora-allattn-p02-seed83-20260716.json` through P09.
- Confidence reports: `private-evidence/reports/v3-trocr-small-lora-allattn-p02-confidence-20260716.json` through P09, plus 2%/4% trim reports.
- Final opened-data report: `private-evidence/reports/v3-trocr-small-lora-allattn-opened-final-seed83-20260716.json`.
- Final adapter: `private-evidence/models/v3-trocr-small-lora-allattn-opened-final-seed83/`.
- Browser models and export report: `/Volumes/Tony's Rugged HD/Codex/ScanGrade Models/trocr-small-browser-candidate-opened-final/`.
- Browser probe: `scripts/browser-probes/trocr-small.html` and `scripts/browser-probes/serve_trocr_small_probe.mjs`.
- Training/evaluation/export scripts: `scripts/evaluate_v3_trocr_small_lora_packet.py`, `scripts/evaluate_trocr_adapter_confidence.py`, and `scripts/export_trocr_small_onnx_browser_probe.py`.
- Browser integration: `src/v3/trocr-small-shadow-client.js`, `src/workers/trocr-small-shadow.worker.js`, and `src/v3/trocr-number-tokens.js`.
- Browser/local reports: `private-evidence/reports/browser-local-trocr-candidate5-yellows-browser-20260716.json`, `private-evidence/reports/browser-local-shadow-off-invariance-parity-20260716.json`, and `private-evidence/reports/v3-trocr-small-browser-yellow-gap-20260716.json`.
- Crop reports: `private-evidence/reports/v3-trocr-small-stitched-vs-clean-comparison-20260716.json`, `private-evidence/reports/v3-trocr-small-crop-selector-screen-20260716.json`, and `private-evidence/reports/v3-number-bond-shifted-trocr-manifest-20260716.json`.
