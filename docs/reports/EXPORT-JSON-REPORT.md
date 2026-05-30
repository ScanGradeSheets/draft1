# JSON export – report

## 1. Exact files changed

- **src/App.vue** – In the existing Results block: added an “Export JSON” button and an `exportResultJson` handler that downloads the current `ocrResult` as a JSON file. Added styles for `.results .btn-export`.

---

## 2. Exact export behavior added

- **Trigger:** One button, “Export JSON”, in the Results section (below Detected / Avg Confidence / Time). Shown only when `ocrResult` is set (`v-if="ocrResult"`).
- **Action:** On click, `exportResultJson` runs: if `ocrResult.value` is missing, return; otherwise `JSON.stringify(ocrResult.value, null, 2)`, create a `Blob` with `type: 'application/json'`, create an object URL, create a temporary `<a>` with `download="scangrade-result-{timestamp}.json"`, programmatic click, then revoke the object URL.
- **No new screen:** The button lives in the current results card; no modal, no new route.

---

## 3. Exact JSON shape exported

The file is the **current OCR result object as-is**. It always includes whatever the pipeline put on that object, and may include (when present):

- **digits** – number[]
- **confidences** – number[]
- **predictions** – array of { id, questionNum, digit, confidence, correct? }
- **totalTime** – string (e.g. `"123.45"`)
- **correct** – boolean[] (when answer_key was used)
- **template_id** – string (when QR payload had it)
- **sheet_instance_id** – string (when QR payload had it)
- **error** – string (when the pipeline failed)

So the exported JSON matches the shape of the payload emitted on `ocr-complete` (and stored in `ocrResult`). No extra or reduced fields; no CSV.

---

## 4. Verification

- **Teacher can download latest as JSON:** With a result on screen, clicking “Export JSON” downloads a file containing that result.
- **Export with QR metadata:** If the last run had a decoded QR, the result includes `template_id` and/or `sheet_instance_id`; the exported JSON includes them.
- **Export without QR metadata:** If there was no QR (or no decode), those fields are absent on the result; the exported JSON is the same object without them. No error.
- **OCR/correctness unchanged:** No change to capture, OCR, or green/red logic; only a download triggered from the existing results block.

---

## 5. What still remains missing vs full ScanGrade spec

- **CSV export:** Not implemented; only JSON.
- **Template management / caching:** Not added.
- **schema_version handling:** Not used in export or elsewhere.
- **Structured export schema:** Export is “current result object”; no formal schema or version field in the file.
- **Batch / multiple sheets:** Export is for the latest result only; no batch or sheet_instance_id-based listing.

---

## 6. Next single best bounded step

**Add CSV export for the same result.** One more button or option (e.g. “Export CSV”) that takes the same `ocrResult` and produces a single-sheet CSV (e.g. one row per box: box index, digit, confidence, correct, or columns template_id, sheet_instance_id, totalTime, then one row per digit). Minimal: one function, one download, no new screens. Gives teachers a spreadsheet-friendly format without changing the app flow.
