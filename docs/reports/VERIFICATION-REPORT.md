# Verification Report: Single-Pipeline Fix

## 1. Exact files changed

- **src/App.vue** (modified)
- **src/components/CameraCapture.vue** (modified)

---

## 2. Key diff summary

### App.vue

- **Removed:** Import of `initDigitModel` and `recognizeDigits` from `./ocr-pipeline.js`. App now only imports `processWorksheet` from homography (used by Pipeline Smoke Test only).
- **Replaced:** `handleImageCaptured` body (previously ~70 lines: init model, load image, `processWorksheet`, loop `recognizeDigits`, set `ocrResult`, cleanup) with a **no-op**:
  ```js
  // Image is processed in CameraCapture; result comes via @ocr-complete -> handleOCRComplete
  const handleImageCaptured = () => {
    // No-op: single pipeline runs in CameraCapture.runRealOCR only
  }
  ```
- **Unchanged:** `handleOCRComplete(res)` still sets `ocrResult.value = res`, syncs gateway, and inits annotation layer. So the only way `ocrResult` is set after a capture is from one `ocr-complete` emit.

### CameraCapture.vue

- **Added:** `const start = performance.now()` at the top of `runRealOCR`.
- **Added:** `const totalTime = (performance.now() - start).toFixed(2)` before setting the success result.
- **Added:** `totalTime` to the success payload: `ocrResult.value = { digits, confidences, predictions, totalTime }`.
- **Added:** On error path, `totalTime: (performance.now() - start).toFixed(2)` so the parent can show time even when corner detection fails.

---

## 3. App run

- **Command:** `npm run dev`
- **Result:** Vite started successfully.
- **URLs:** `https://localhost:5175/` (Local), plus network URLs on 10.0.0.9 and 100.81.35.25.

---

## 4. Evidence: one capture → one pipeline run, one result update

**Code evidence (no second runner):**

- **Grep:** `recognizeDigits` is only used in `src/components/CameraCapture.vue` (in `runRealOCR`). It is not imported or called in `App.vue`.
- **Grep:** `processWorksheet` is called in:
  - `CameraCapture.vue` (line 242) inside `runRealOCR` → capture/upload path.
  - `App.vue` (line 405) only inside `runPipelineTest` (Pipeline Smoke Test button), not in any image handler.
- So the **only** code path that runs the full OCR pipeline (homography + recognizeDigits) on capture/upload is **CameraCapture.runRealOCR**. One capture/upload triggers one `runRealOCR`, one `emit('ocr-complete', ocrResult.value)`, and one `handleOCRComplete` in App → one update to `ocrResult`.

**Runtime verification (manual):**

- Playwright test was added (`verify-single-pipeline.spec.js`) but cannot load the app: `net::ERR_SSL_VERSION_OR_CIPHER_MISMATCH` at `https://localhost:5175/` (Vite’s HTTPS setup vs Chromium). So automated E2E was not run.
- **Manual check:** With the app open at `https://localhost:5175`:
  1. Open DevTools → Console.
  2. Click “Runtime Self-Test”, wait for “ALL TESTS PASSED”.
  3. Use “Choose File” and select any image (e.g. `public/test-worksheet-calibrated.png` if available).
  4. Confirm exactly **one** log line `OCR Results: …` (from `handleOCRComplete`).
  5. Confirm **no** log line `Running full OCR pipeline...` (old App path removed).
  6. Confirm the Results section shows one set of digits and “Time: Xms” (or, on error, that the single result still includes timing/error).

---

## 5. Timing still displayed

- **CameraCapture** now sets `totalTime` on both success and error in `runRealOCR` and includes it in the payload passed to `emit('ocr-complete', ocrResult.value)`.
- **App.vue** template still has: `<p v-if="ocrResult.totalTime">Time: {{ ocrResult.totalTime }}ms</p>`.
- So timing is still shown in the parent Results section from the single pipeline run.

---

## 6. What remains broken after this fix

- **Confidence semantics:** Model output is logits; code uses `output[maxIdx]` as “confidence” and shows it as %. Values are not 0–1 probabilities.
- **OpenCV readiness:** Splash hides after 1s while OpenCV loads async; Runtime Self-Test can fail until `cv` is ready.
- **recognizeDigitGrid:** Helper `resizeTo28x8` typo (should be 28×28); grayscale handling is wrong; unused by current flow.
- **Playwright vs dev server:** Config uses `http://localhost:5174`; app runs at `https://localhost:5175`; E2E hits SSL/cipher mismatch.
- **test-pipeline.js:** Looks for `detectCorners`; homography exports `detectCornerMarkers`.
- **Gateway sync:** Optional; failures only logged.
- **README:** Still says “Fake OCR pipeline”; should be updated to “real ONNX + homography”.

---

## 7. Single best next bounded step

**Apply softmax to model output and show confidence as a 0–1 probability (and as %).**

- In `src/ocr-pipeline.js`, in `recognizeDigits` (and, if used later, in `recognizeDigitGrid`), take the raw output vector, compute softmax, use `confidence = softmax[maxIdx]` so the UI “confidence %” is a real probability. Small, file-local change, no new dependencies, fixes the remaining confidence bug.
