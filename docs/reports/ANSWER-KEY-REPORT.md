# Answer key support (data-only) – report

## 1. Exact files changed

- **public/layouts/sg-10-box-v1.json** – Added optional `"answer_key": [7, 2, 9, 3, 5, 1, 8, 4, 6, 0]` (10 entries, one per box in id order).
- **layouts/sg-10-box-v1.json** – Same optional `answer_key` added for consistency.
- **src/components/CameraCapture.vue** – In `runRealOCR`, when building the OCR result: read `layout.answer_key`; for each prediction set `correct` when answer_key is present and has an entry for that box id; add top-level `payload.correct` only when answer_key was present and every prediction has a correctness value.

---

## 2. Exact data shape added

**Layout (optional field):**
- `answer_key`: number[] — length must match number of boxes (e.g. 10 for sg-10-box-v1). Index i is the correct digit for box id i. Omitted or empty means “no grading”; pipeline does not add any correctness data.

**OCR result payload (when answer_key was present):**
- `predictions[i].correct`: boolean — true if `predictions[i].digit === layout.answer_key[predictions[i].id]`, only present when layout had answer_key and id is in range.
- `payload.correct`: boolean[] — one entry per box in order, `predictions.map(p => p.correct)`, only added when `answerKey != null` and every prediction has `correct !== undefined`.

**When answer_key is absent:**
- No `correct` on any prediction; no `correct` on the payload. Existing fields (digits, confidences, predictions, totalTime) unchanged.

---

## 3. How correctness is computed

- After OCR, for each item in `processedTensors` we have `proc.id` (box index 0..9) and the recognized `digit`.
- If `layout.answer_key` is an array and `proc.id < answer_key.length`, then:
  - `correct = (digit === layout.answer_key[proc.id])`
- That value is attached to the prediction only when defined (`...(correct !== undefined && { correct })`).
- Top-level `payload.correct` is set only when we had an answer_key and every prediction got a correctness value, so the array is in box id order and ready for future UI (e.g. green/red per box).

---

## 4. Verification

- **Layout can include answer_key:** Both layout files now have an optional `answer_key` array; the pipeline reads it only when present and array-shaped.
- **OCR result includes per-box correctness when answer_key present:** Each prediction has `correct` (boolean) and the payload has `correct` (boolean[]) when the layout included answer_key.
- **Nothing breaks when answer_key is absent:** If you remove or omit `answer_key` from the layout, `answerKey` is null, no prediction gets a `correct` field, and the payload has no `correct` field; existing UI and consumers that only use digits/confidences/totalTime are unchanged.

---

## 5. Mismatch still remaining vs full ScanGrade spec

- **No QR decoding:** Layout is still from a fixed URL; answer_key in the layout is not yet coming from a QR payload (schema_version, template_id, sheet_instance_id, etc.).
- **No correctness UI:** STYLE_GUIDE green/red/yellow feedback is not implemented; data is present for when you add it.
- **Single layout:** No layout_id-based selection or multiple layouts.
- **Sheet instance:** QR-SPEC sheet_instance_id and per-sheet answer_key variants are not used.

---

## 6. Next single best bounded step

**Add minimal correctness UI.** Use the existing `ocrResult.correct` and `predictions[].correct`: in the results area (e.g. CameraCapture digit cells or App results section), show correct answers in green and incorrect in red (per STYLE_GUIDE), without adding new screens or QR. Keeps scope to one UI pass over existing data.
