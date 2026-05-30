# Correctness UI (minimal) – report

## 1. Exact files changed

- **src/components/CameraCapture.vue** – In the existing `.ocr-result` digits area: added `correct` and `incorrect` classes to each `.digit` cell when `ocrResult.correct` is present; added CSS for `.digit.correct` (green border/background) and `.digit.incorrect` (red border/background) using STYLE_GUIDE colors.

---

## 2. Exact UI behavior added

- **Per-digit cell:** Each result digit div gets:
  - `class="correct"` when `ocrResult.correct` exists and `ocrResult.correct[i] === true`
  - `class="incorrect"` when `ocrResult.correct` exists and `ocrResult.correct[i] === false`
- **Styling (STYLE_GUIDE):**
  - **Correct:** border 2px solid `#28a745`, background `#e8f5e9`
  - **Incorrect:** border 2px solid `#dc3545`, background `#ffebee`
- No new sections, no score headline, no new modes. The existing digit grid and low-confidence warning are unchanged; only the cell border/background change when correctness data exists.

---

## 3. When answer_key is missing

- `ocrResult.correct` is undefined. The binding `ocrResult.correct && ocrResult.correct[i] === true` is false, and same for `incorrect`, so neither class is applied.
- Digit cells use only existing styles (white background, and `.low` when confidence &lt; 80%). No green/red; layout and behavior match the pre–answer_key case.

---

## 4. Verification

- **Correct → green:** When layout has answer_key and a prediction matches, `ocrResult.correct[i] === true` → `.digit.correct` → green border and light green background.
- **Incorrect → red:** When layout has answer_key and a prediction does not match, `ocrResult.correct[i] === false` → `.digit.incorrect` → red border and light red background.
- **answer_key absent:** No `correct` on payload → no correct/incorrect classes → no green/red; existing OCR results area unchanged.
- **Existing area:** Digits, confidence %, and low-confidence message are unchanged; only optional correct/incorrect styling was added.

---

## 5. Mismatch still remaining vs full ScanGrade spec

- **No QR decoding:** Layout (and answer_key) still from fixed URL; no QR payload read from the sheet.
- **Yellow for illegible:** STYLE_GUIDE mentions yellow for “items needing manual review”; low-confidence still uses existing amber (`.low`). No new yellow state added.
- **Single layout:** No layout_id or multi-layout support.
- **No sheet_instance_id or template_id** from QR.

---

## 6. Next single best bounded step

**Add QR decoding to the capture flow (payload only).** When the user captures or uploads, detect a QR in the image (or a designated region), decode the QR payload, and use it to select layout and answer_key (and later template_id/sheet_instance_id) instead of the fixed layout URL. No new UI or screens; only switch the data source from “fetch one layout” to “decode QR → use payload or fallback to default layout.” Keeps scope to one pipeline change and aligns with QR-SPEC.
