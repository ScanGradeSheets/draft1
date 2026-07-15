# ScanGrade local larger-grayscale investigation — 2026-07-14

## Plain-English verdict

The original observation was correct: the 28×28 digit image often throws away handwriting detail that remains visible in a larger grayscale crop. A small local model can use that larger image to improve the teacher's review choices, but the present local model is not accurate enough to replace the strong reader safely.

On the 14 currently yellow row answers:

- the existing 5 MB local whole-answer model puts the handwriting in its top three candidates for 10/14;
- existing browser alternatives cover some different cases;
- together, the existing local sources cover 11/14 without the strong reader;
- the remaining three are P08 add-1digit Q5 (`6`), P09 mixed Q4 (`9`), and P02 mixed Q4 (`9`).

This supports a local-first review workflow with the strong reader retained for the small residual set. It does **not** support promoting local candidates into automatic grading.

## Reproducible results

### Existing larger-grayscale compact model

The model consumes a continuous 64×192 grayscale answer zone rather than independent 28×28 digit tensors.

- Four recent packets: top-1 `176/275` (64.0%), top-3 `232/275` (84.4%), top-5 `249/275` (90.5%).
- Recent validation packet P09: top-3 `62/70`.
- Recent holdout packet P02: top-3 `52/68`.
- Historical validation: top-3 `117/136`, top-5 `127/136`.
- Historical holdout: top-3 `97/114`, top-5 `99/114`.

Confidence is not safe enough for automatic promotion. Historical V2-review answers still contain wrong compact reads above 0.995 confidence. The model is therefore useful as a review-choice generator, not an automatic authority.

### Synthetic-pretrained replacement

A new key-blind whole-answer model was pretrained on 6,000 locally generated one- and two-digit answer boxes and then fine-tuned only on historical development data.

- Historical validation improved from 72.8% to 76.5% top-1.
- Historical holdout improved from 57.9% to 72.8% top-1.
- The four recent packets regressed from 64.0% to 62.9% top-1.
- On the 14 current yellow answers it scored 7/14 top-1 versus 8/14 for the existing model.

Decision: retain as research evidence; reject as the production candidate.

### Crop and geometry repair

Fixed template coordinates were tested and rejected across all 275 answers. The photographed pages retain residual perspective distortion, so fixed crops fell to `160/275` truth-in-top-3.

A better key-blind repair fits the worksheet metadata to the mutually consistent answer-zone locations on each page and treats a large spatial residual as a suspected wrong assignment. Across 275 answers it:

- identified four geometry outliers;
- changed only those four review-candidate crops;
- increased compact truth-in-top-3 from `232/275` to `233/275`;
- retained the correct top-three candidate for the one already-correct outlier;
- recovered one additional held-out candidate without changing automatic grading.

The repair also located the clear P08 `6` that the selected crop missed, but the compact model still ranked it as `5`. This proves geometry and recognition are separate remaining limits.

### High-resolution digit preprocessing

A pencil-versus-print band-pass view was tested against the current digit models using the clean, geometry-aligned slot images. It scored only `87/275` truth-in-top-3. Although hand-tuned variants could place two difficult `9`/`6` examples among candidates, the general result was too weak and tuning those three examples would be overfitting.

Decision: reject this preprocessing lane.

### Apple Vision

A native, free macOS Vision text-recognition probe was compiled. The installed Vision runtime returned no observations (`nilError`) on the three representative isolated answer crops. Even if repaired, this is a native Mac API rather than a browser model and is not a demonstrated replacement.

Decision: reject as a current product dependency.

## Product implication

The best risk-adjusted architecture remains:

1. browser OCR makes the conservative automatic decision;
2. the 5 MB larger-grayscale local model supplies immediate, key-blind review candidates;
3. obvious geometry outliers receive a locally reconstructed crop from the clean page;
4. strong AI sees only yellow answers and remains review-only/fail-open;
5. a future UX experiment may defer the strong request until local choices fail, but it must first measure teacher time and preserve a clear “none of these” path.

The current evidence does not justify silently replacing any answer with the local model's top candidate.

## Artifacts

- `scripts/train_v3_sequence_synthetic.py`
- `scripts/evaluate_v3_local_candidates.py`
- `scripts/evaluate_v3_layout_crop_rescue.py`
- `scripts/evaluate_v3_robust_geometry_rescue.py`
- `scripts/apple_vision_answer_ocr.swift`
- `private-evidence/reports/v3-sequence-synthetic-seed17-20260714.json`
- `private-evidence/reports/v3-local-candidates-existing-four-packet-20260714.json`
- `private-evidence/reports/v3-layout-crop-rescue-20260714.json`
- `private-evidence/reports/v3-robust-geometry-rescue-20260714.json`

No production OCR, confidence, grading, capture, homography, or iPad behavior was changed. Nothing was deployed or pushed.
