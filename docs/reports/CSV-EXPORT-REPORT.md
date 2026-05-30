# CSV export – report

## 1. Exact files changed

- **src/App.vue** – In the Results block: added an "Export CSV" button next to "Export JSON". Added `escapeCsv(val)` helper and `exportResultCsv()` which builds a one-row-per-box CSV from the current `ocrResult` and triggers a download. No new screens or batch export.

---

## 2. Exact CSV shape exported

- **Header row:** `box_index,predicted_digit,confidence,correct,template_id,sheet_instance_id`
- **Data rows:** One row per item in `ocrResult.predictions`. Columns:
  - **box_index** – `p.id` (or row index if missing)
  - **predicted_digit** – `p.digit`
  - **confidence** – `p.confidence`
  - **correct** – `"true"` / `"false"` when `p.correct` is defined; otherwise empty
  - **template_id** – from `ocrResult.template_id` (same on every row); empty when absent
  - **sheet_instance_id** – from `ocrResult.sheet_instance_id` (same on every row); empty when absent

Fields that contain comma, quote, or newline are quoted and internal quotes doubled (RFC 4180–style). When there are no predictions (e.g. error result), only the header row is emitted.

---

## 3. Verification

- **CSV downloads:** Same pattern as JSON (Blob → object URL → `<a download>`); filename `scangrade-result-{timestamp}.csv`.
- **With QR metadata:** `template_id` and `sheet_instance_id` are present on `ocrResult`, so those columns are filled on every row.
- **Without QR metadata:** Both columns are empty; other columns unchanged; CSV is valid.
- **Without correct:** When `answer_key` was absent, `p.correct` is undefined; the correct column is empty for all rows.
- **Existing flow:** No change to OCR, correctness, or JSON export; only a second button and one new function.

---

## 4. What still remains missing vs full ScanGrade spec

- **Batch / multi-sheet export:** Still only latest result; no list of sheet_instance_ids or batch CSV.
- **Expected digit column:** CSV has predicted_digit and correct but not the expected value from answer_key (could add later).
- **Schema version or export format version:** Not included in CSV.
- **Template management:** Not added.

---

## 5. Next single best bounded step

**Wait for teacher feedback or add one more validation asset.** The core flow (capture → QR → layout → OCR → correctness → JSON/CSV export) is in place. Next step could be: (1) document the flow and how to test with a real worksheet, or (2) add a small “expected digit” column to the CSV when answer_key is present so the sheet shows both predicted and expected for each box. Option 2 is a small, bounded CSV enhancement that improves usefulness without new screens.
