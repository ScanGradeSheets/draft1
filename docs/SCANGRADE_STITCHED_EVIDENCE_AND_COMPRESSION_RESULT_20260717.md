# ScanGrade stitched strong evidence and local compression result

Date: 2026-07-17 UTC (work performed July 16 Toronto time)

Status: research complete; Candidate 5 unchanged; nothing deployed, committed, or pushed

## Plain-English result

The image shown to the strong handwriting model was a major part of the problem.

The same adapted TrOCR model read only 175 of 275 answers correctly when it received the current continuous answer-zone image. It read 242 of 275 correctly when it received a larger grayscale image made by placing the original slot crops side by side with white padding and a small gap. Accuracy rose from 63.6% to 88.0% without changing the model.

The gain held on both separated recent evaluation blocks: P09 validation rose from 77.1% to 90.0%, and P02 holdout rose from 50.0% to 88.2%. The old historical stitched corpus independently reproduced 82.5% overall, 77.2% validation, and 80.7% holdout.

This is a real improvement, but it is not permission to let the strong model grade automatically. Two stitched reads were wrong despite token confidence above 99.5%: written `12` was read as `15`, and written `6` was read as `7`. Candidate 5 already handled both correctly. The stitched reader is therefore valuable as review evidence and a teacher-facing choice, not as a raw-confidence override.

The attempted free compact replacement did not inherit the gain. The best 6.4 MB local model reached 196/275 (71.3%) under packet-held-out cross-validation. Light teacher supervision changed no decisions; stronger teacher supervision fell to 70.9%; a joint whole-number classifier fell to 70.2%. The compact model is technically small and fast, but not accurate or calibrated enough to replace the strong reader.

## What image was actually tested

Candidate 5 currently sends a continuous grayscale answer zone as its primary sequence-model input because its private runtime has `v3SequenceFromZones=1`. Candidate 5 also derives selected/core/alternate crops for its conservative corroboration policy.

The winning stitched view reconstructs the older `wholeAnswerCropDataUrl` contract exactly:

- preserve the original grayscale slot pixels;
- place each saved slot crop on a white canvas;
- use 8 pixels of outer padding;
- use a 10-pixel white gap between slots;
- add only the light structural border already present in the historical training crops;
- do not use the mathematical answer key;
- do not threshold or collapse the image to 28×28.

The separately tested “cleaned” version erased printed edge bands and slot-guide bands. It was worse: 229/275 (83.3%) overall and only 50/68 (73.5%) on P02. Cleaning removed useful stroke evidence along with print. Keep the original grayscale pixels.

Five matched views were exported for every recent answer: continuous, cleaned continuous, expanded context, stitched, and cleaned stitched. All 1,375 image hashes were verified. There were no exact duplicate images within any view. The request sent to the strong reader contained only ID, question number, and image pixels; it contained no answer key or expected mathematical result. P05 and all untouched packets remained absent.

## Strong-reader matched-view benchmark

| View | Overall | P09 validation | P02 holdout | Candidate 5 yellows | High-confidence wrong |
|---|---:|---:|---:|---:|---:|
| Continuous | 175/275 (63.6%) | 54/70 (77.1%) | 34/68 (50.0%) | 9/25 | 1 |
| Cleaned continuous | 98/275 (35.6%) | 28/70 (40.0%) | 21/68 (30.9%) | 6/25 | 0 |
| Expanded context | 37/275 (13.5%) | 12/70 (17.1%) | 9/68 (13.2%) | 2/25 | 0 |
| Stitched original grayscale | **242/275 (88.0%)** | **63/70 (90.0%)** | **60/68 (88.2%)** | **14/25** | 2 |
| Cleaned stitched | 229/275 (83.3%) | 61/70 (87.1%) | 50/68 (73.5%) | 14/25 | 1 |

Stitched performance by important slice:

- rows: 145/160 (90.6%);
- non-rows: 97/115 (84.3%);
- one digit: 91/100 (91.0%);
- two digits: 151/175 (86.3%);
- one physical slot: 70/78 (89.7%);
- two physical slots: 172/197 (87.3%);
- number bonds: 11/22 (50.0%).

The stitched view uniquely corrected 77 answers that continuous missed and lost 10 that continuous had read correctly. Among the 25 Candidate 5 yellows it added nine unique correct reads but lost four continuous-correct reads. This reinforces the need for explicit disagreement handling.

Service inference for all 275 stitched answers was 23.72 seconds in batches on the MPS Mac service, about 86 ms per answer. Seventeen of the 40 pages contain at least one of the final 25 Candidate 5 yellows; ten have one yellow, six have two, and one has three. A one-crop-per-yellow review request should therefore be far smaller than the present multi-frame/multi-variant strong request, although exact UI latency still requires a matched browser replay before release.

## Compact/local compression experiments

All recent compact results are four-fold packet-separated cross-validation. Each fold trained on historical development plus three recent packets, selected its epoch using only historical validation, and read the fourth packet once. P05 was not touched.

| Local candidate | Packet-held-out result | Unique gains vs truth-only compact | Unique losses | Decision |
|---|---:|---:|---:|---|
| Truth-only length/tens/ones CNN | **196/275 (71.3%)** | — | — | Best compact control, insufficient |
| Teacher auxiliary weight 0.05 | 196/275 (71.3%) | 0 | 0 | No effect |
| Teacher auxiliary weight 0.25 | 195/275 (70.9%) | 2 | 3 | Worse |
| Joint 0–99 whole-number class | 193/275 (70.2%) | 3 | 6 | Worse |

The truth-only compact model varied sharply by held-out packet: P02 57.4%, P03 67.2%, P08 85.7%, and P09 74.3%. It scored 75.6% on rows, 65.2% on non-rows, and only 10/25 on Candidate 5 yellows.

Its confidence is unsafe. At a 0.90 minimum-component threshold it accepted 124/275 but made 16 errors. At 0.99 it accepted 55 and made three errors. A 0.995 threshold happened to select 34/275 with zero observed errors, but 34 samples imply a wide 95% error interval and only 12.4% coverage; this is not useful evidence for launch safety.

Agreement did not solve the problem:

- compact and stitched teacher agreed on 187 answers, but six were wrong;
- on Candidate 5 yellows they agreed on seven, with one wrong;
- compact, stitched teacher, and Candidate 5 all agreed on 176 non-yellow-dominated answers and all were correct, but only one of those was a Candidate 5 yellow.

The final technical compact artifact is 6,747,005 bytes. PyTorch and ONNX produced 0/853 decision mismatches across all 578 historical plus 275 recent inputs when given identical preprocessed tensors. Conservative single-thread, SIMD-disabled `onnxruntime-web` loaded it in 137 ms and averaged 54.5 ms per answer in batches of eight on this Mac, with about 497 MB process RSS after the run. These are Node/WASM proxy measurements, not a physical old-iPad claim.

Browser-canvas resizing changed two of 275 decisions relative to the Python/Pillow preprocessing contract. One change fixed a recent training example and the other changed one wrong read into another wrong read. Before any future local model is promoted, training and evaluation must use the exact browser preprocessing implementation, not merely the same nominal 64×192 dimensions.

Existing strong-model compression tests remain applicable. Dynamic int8 destroyed parity and was slower/more memory-hungry; CPU float16 and bfloat16 preserved an eight-answer smoke sample but were roughly 7.7× and 8.7× slower. The useful cost reduction remains sending fewer strong-reader images, not weakening the adapted TrOCR model.

## Decision

1. Advance the uncleaned stitched original-grayscale view as the primary input for the adapted strong reader on unresolved Candidate 5 review answers.
2. Initially use its output only as a teacher-facing review choice. Do not auto-promote based on raw confidence.
3. Send one deterministic selected-frame stitched crop per unresolved answer, not every answer and not every frame/variant. Preserve fail-open local grading.
4. Run an exact 40-page saved-browser A/B before changing private behavior. Required invariants: identical automatic results, grades, yellows, annotations, and correction behavior; measure truth availability, strong requests, latency, and failure recovery.
5. Keep the 6.4 MB compact model as shadow evidence only. Do not spend P05 on it and do not deploy it as a replacement.
6. If future local-model work resumes, use a materially stronger architecture or a smaller sequence transformer trained on the exact browser-rendered stitched tensors. Do not repeat the tested small CNN teacher-loss variations.

## Promotion gate for any future automatic stitched-reader use

No automatic use is permitted from this corpus alone. A selector must be frozen before prospective data and must veto model-family disagreement, crop-edge ambiguity, overwrites/cross-outs, unstable frames, slot-contract violations, and Candidate 5 confidence-safety flags. It must then pass:

- zero observed confident errors on the full retrospective suite;
- zero confident errors on a genuinely untouched one-shot packet;
- no regression to Candidate 5 automatic coverage outside the intended additions;
- exact browser replay reproducibility;
- physical old-device testing;
- fail-open service outage and manual-correction recovery.

Even a zero-error prospective packet is only a falsification gate, not enough evidence for a public “100% accurate” claim.

## Durable evidence

- Evidence builder: `scripts/build_v3_strong_evidence_manifest.py`
- Matched-view evaluator: `scripts/evaluate_v3_strong_evidence_views.mjs`
- Matched manifest: `private-evidence/v3/strong-evidence-candidate5-20260717/manifest.json`
- Strong benchmark: `private-evidence/reports/v3-strong-evidence-view-benchmark-20260717.json`
- Distillation manifest builder: `scripts/build_v3_stitched_distillation_manifests.py`
- Historical teacher benchmark: `private-evidence/reports/v3-stitched-teacher-historical-20260717.json`
- Compact crossfit: `private-evidence/reports/v3-stitched-compact-baseline-crossfit-20260717.json`
- Teacher-loss crossfits: `private-evidence/reports/v3-stitched-compact-distill-w005-crossfit-20260717.json` and `private-evidence/reports/v3-stitched-compact-distill-w025-crossfit-20260717.json`
- Joint-class crossfit: `private-evidence/reports/v3-stitched-joint-class-crossfit-20260717.json`
- Final compact artifacts: `private-evidence/models/v3-stitched-compact-final-20260717/`
- ONNX parity reports: `private-evidence/reports/v3-stitched-compact-final-onnx-parity-*-20260717.json`
- WASM benchmark: `private-evidence/reports/v3-stitched-compact-final-wasm-benchmark-20260717.json`
- Consolidated gate: `private-evidence/reports/v3-stitched-evidence-compression-gate-20260717.json`

No production source, deployment, public behavior, private Candidate 5 behavior, frozen P05 protocol, or recognition threshold changed during this work.

## Follow-up: forensic analysis of the two high-confidence errors

Both errors were traced from the captured page through the exported evidence.

- `P02|sg-g1-lw-04-sub-2digit|1`: the captured page clearly contains `12`, and Candidate 5 reads `12`. In the stitched slot evidence, the handwritten `2` shares/crosses the lower printed border; the crop preserves its upper curve much more strongly than its decisive lower stroke, making the surviving shape resemble `5`. Adapted TrOCR reads `15` at 0.999873 minimum visible-token probability.
- `P02|sg-g1-lw-08-number-bonds|1`: the captured page clearly contains a complete `6`, and Candidate 5 reads `6`. The stitched evidence cuts through the lower loop near the printed answer-frame border, leaving a rising upper fragment that resembles `7`. Adapted TrOCR reads `7` at 0.998701.

A corrected key-blind expansion experiment was run on all 275 answers. Replay annotation coordinates are in the 1440x1864 captured-image space, while the saved canonical warp is normally 1700x2200; the first experimental exporter omitted that scale conversion and was rejected before recognition. The corrected exporter scales the geometry and tests seven containment variants.

For the two errors, a bottom-preserving crop reduced TrOCR confidence from 0.999873 to 0.881278 for `12→15`, and from 0.998701 to 0.774449 for `6→7`. The recognizer remained wrong, but was no longer highly confident. Larger raw crops are not a suitable replacement input: on the full corpus, the bottom-preserving view read only 83/275 correctly and still had two different errors among 22 reads above 0.995 confidence; printed frames dominate too often. The larger view is therefore an ambiguity signal, not a primary OCR view.

The product-level containment is stronger and is already present in Candidate 5:

- accepted Candidate 5 answers are not promotion candidates (`already-automatic-not-a-promotion-candidate`);
- local-first strong inference is prepared and requested only for displayed yellow questions;
- strong outputs are `reviewOnly` teacher choices and do not change grades;
- the two errors were both non-yellow Candidate 5 answers, so neither can be sent to the on-demand strong-reader path or override the correct `12`/`6` result.

On the exact 25 Candidate 5 yellows, stitched TrOCR had four reads above 0.995 and all four were correct, but four observations are far too few to authorize automatic promotion. The safe rule remains: stitched output may help a teacher resolve a yellow answer, but raw TrOCR confidence must never override an accepted Candidate 5 transcription. Any future automatic promotion must require independent model-family agreement and prospective evaluation.

Artifacts:

- corrected expansion builder: `scripts/build_v3_expanded_stitched_views.py`;
- corrected expansion manifest: `private-evidence/v3/expanded-stitched-candidate5-20260717/manifest.json`;
- two-error probe: `private-evidence/reports/v3-expanded-two-error-probe-20260717.json`;
- 275-answer larger-view probe: `private-evidence/reports/v3-expanded-full-probe-20260717.json`.

One secondary audit caveat was also found: the earlier experimental `context` view was reconstructed from the saved debug `warped.png`, which contains diagnostic overlay elements. Its 37/275 score should not be treated as a clean raw-context benchmark. This does not affect the continuous, stitched, cleaned-stitched, or compact-model results, nor any decision above.
