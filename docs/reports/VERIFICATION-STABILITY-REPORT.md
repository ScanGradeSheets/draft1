# Verification / stability pass – report

## 1. What was verified end to end (code path)

Tracing the flow in code:

- **Load/capture image:** CameraCapture captures to canvas or file input → `capturedImage` (data URL) → `runRealOCR()`.
- **QR decode:** `decodeQrFromCanvas(canvas)` runs on the same canvas; returns payload or null; no throw.
- **Layout selection:** If payload has `layout_id`, fetch `/layouts/${layout_id}.json`; on 404 refetch default; merge `answer_key` and `homography` from payload when present.
- **OCR:** `initDigitModel()` → `processWorksheet(src, layout)` → `recognizeDigits` per crop → predictions built; on failure catch sets `ocrResult` to `{ digits: [], confidences: [], error, totalTime }`.
- **Correctness:** `answer_key` from layout (file or QR) drives `correct` array; green/red in CameraCapture when `ocrResult.correct` exists.
- **JSON export:** App Results section shows when `ocrResult` is set; "Export JSON" stringifies `ocrResult.value` and downloads; error payload (digits/confidences empty, `error` set) is still a valid object to export.

So the happy path and the error path are both traced; no automated E2E run was executed in this pass.

---

## 2. What failed or looked fragile

- **Error path in App Results:** When the pipeline fails, `ocrResult` is `{ digits: [], confidences: [], error, totalTime }`. The template did `ocrResult.confidences.reduce(...)/ocrResult.confidences.length*100` → `0/0` → **NaN**, so the UI showed "Avg Confidence: NaN%". No throw, but wrong and confusing.
- **Error invisible in App:** The Results block did not show `ocrResult.error`, so after a failure (e.g. corner detection failed) the teacher saw "Detected: " and "NaN%" with no explanation.
- **Export on error:** Export still worked (same object stringified), but the Results block looked broken.

---

## 3. Single issue fixed

**Stable Results block when OCR fails (empty digits/confidences or error present):**

- **App.vue Results template:**  
  - Show **Avg Confidence** only when `ocrResult.confidences` exists and has length; otherwise show "—". So no division by zero and no NaN.  
  - Show **Detected** as digits when present; otherwise "—".  
  - When `ocrResult.error` is set, render it above the rest (new line with class `results-error`, red) so the teacher sees why there are no digits.
- **Style:** `.results .results-error` for the error message (color and weight).

So the one change is: **error-path rendering in the Results block** (guards + error message). No change to CameraCapture, export logic, or OCR pipeline.

---

## 4. What still remains risky

- **OpenCV/ORT not ready:** If the app is shown before `cv` or `ort` is ready, Runtime Self-Test or first capture can fail; no explicit "wait for libs" before enabling capture.
- **Layout fetch 404:** If both `layout_id`-based URL and default layout URL fail, we throw; user sees generic error. Could fall back to a hardcoded minimal layout or a clearer message.
- **rawCrops cleanup in Pipeline Smoke Test:** App’s smoke test disposes `rawCrops[].image`; homography returns `rawCrops` with the same structure; worth double-checking that all Mat refs are released in every path.
- **Gateway sync:** Failure is only logged; no retry or user feedback.
- **No E2E automation:** Flow is only verified by code trace; no Playwright (or similar) run against a real server in this pass.

---

## 5. CSV export: next step or not?

**Recommendation: yes, CSV can be the next step.**  

The failure path is now handled (no NaN, error message shown), and the rest of the flow is unchanged. Export already works for both success and error payloads. Adding a minimal CSV export (same data, one more button) is low risk and does not depend on fixing the remaining risks above. So the flow is stable enough to add CSV as the next bounded step.
