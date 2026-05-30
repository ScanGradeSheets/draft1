# Main flow normalized layout – report

## 1. Exact files changed

- **src/components/CameraCapture.vue** – Replaced inline mm LAYOUT with fetch of normalized layout; runRealOCR now loads `/layouts/sg-10-box-v1.json` and passes it to processWorksheet.
- **src/App.vue** – Removed the inline LAYOUT constant (mm layout) entirely. Pipeline Smoke Test already used the normalized layout via fetch; no other code referenced LAYOUT.

---

## 2. What was removed or replaced

**CameraCapture.vue**
- **Removed:** The full inline `LAYOUT` object (layout_id, page with width_mm/height_mm/units "mm", 10 boxes with cx/cy/width/height in mm, homography with marker_size_mm and anchors in x_mm/y_mm/x_norm/y_norm).
- **Replaced with:** A single constant `LAYOUT_URL = '/layouts/sg-10-box-v1.json'` and, inside `runRealOCR`, a fetch of that URL, parse of JSON, and use of the result as the `layout` argument to `processWorksheet(src, layout)`. On fetch failure, the error message is: "Layout not found. Ensure /layouts/sg-10-box-v1.json is available."

**App.vue**
- **Removed:** The entire inline `LAYOUT` constant (same mm structure as above). Nothing in App.vue referenced it after the Pipeline Smoke Test was switched to fetch its own normalized layout in a previous step.

---

## 3. Main app flow now using QR-SPEC normalized layout

**Yes.** The main user flow is:

1. User captures a photo or chooses a file.
2. CameraCapture runs `runRealOCR`, which:
   - Loads the image and builds an OpenCV Mat.
   - Fetches `/layouts/sg-10-box-v1.json` (normalized layout: `page.units === 'normalized'`, box `x`/`y`/`width`/`height` in 0–1, `homography.marker_size` 0.08, anchors in 0.05/0.95).
   - Calls `processWorksheet(src, layout)` with that layout.
   - Runs OCR on the resulting tensors and emits the result.

So the only layout used in the capture/upload path is the normalized one from the layout file. There is no remaining use of the inline mm layout in the main flow.

---

## 4. Verification

- **Capture/upload path uses normalized layout:** Confirmed: CameraCapture no longer defines or uses any mm LAYOUT; it only fetches `LAYOUT_URL` and passes the parsed JSON to `processWorksheet`.
- **OCR pipeline still runs end-to-end:** Same sequence (load image → fetch layout → processWorksheet → recognizeDigits per crop → emit result). Only the layout source changed from inline to fetched file.
- **No remaining dependency on inline mm layout in main flow:** Confirmed: grep shows no `LAYOUT` or mm layout in CameraCapture or in App.vue’s capture/OCR flow. Homography still supports legacy mm layout when `layout.page.units !== 'normalized'`, but the app no longer passes such a layout.

---

## 5. Mismatch still remaining vs full ScanGrade spec

- **No QR decoding:** Layout is loaded from a fixed URL, not from a QR code on the worksheet. QR-SPEC payload (schema_version, template_id, answer_key, etc.) is not yet read or used.
- **Single layout only:** The app always uses `sg-10-box-v1`. There is no `layout_id` from a QR payload to select among multiple layout files.
- **No answer_key:** Correct/incorrect grading and any use of `answer_key` from a future QR payload are not implemented.
- **Warp destination fixed:** Homography warp target is still 0.05/0.95 of the image; `homography.anchors` from the layout are not used to define the warp destination (they match in value but are not read for that step).

---

## 6. Next single best bounded step

**Add `answer_key` to the layout file and to the pipeline output (no UI yet).**  
Extend `public/layouts/sg-10-box-v1.json` (or the pipeline’s layout type) with an optional `answer_key` array. When present, in the OCR result attach a per-box `correct: boolean` (or equivalent) by comparing recognized digit to `answer_key[box.id]`. Emit that in the existing result payload so the app is ready for correct/incorrect UI later, without adding any new screens or components. Keeps scope to data shape and one file, aligned with QR-SPEC and GOALS (friction reduction via grading).
