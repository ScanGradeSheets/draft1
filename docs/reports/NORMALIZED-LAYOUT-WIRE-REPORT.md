# Normalized layout wire – report

**Historical note:** This report described an intermediate state; the main flow now uses normalized layout from public/layouts/.

## 1. Files changed

- **src/App.vue** – Pipeline Smoke Test now loads and uses the normalized layout for the full pipeline.
- **public/layouts/sg-10-box-v1.json** – Added (copy of `layouts/sg-10-box-v1.json`) so the app can fetch it at runtime.

No changes to `src/homography.js` or `src/components/CameraCapture.vue`. Capture/upload still uses the existing mm LAYOUT; only the smoke test uses the normalized layout.

---

## 2. Path that uses the normalized layout

**Pipeline Smoke Test** in App.vue (`runPipelineTest`):

1. User must have a captured/uploaded image (same as before).
2. User clicks **“📊 Pipeline Smoke Test”**.
3. App loads image into OpenCV, then:
   - **Fetches** `/layouts/sg-10-box-v1.json` (normalized layout, QR-SPEC style).
   - Calls **processWorksheet(src, normalizedLayout)** (no longer LAYOUT).
4. Same checks as before: warped 1700×2200, 10 crops, 784-element tensors, cleanup.
5. On success, logs include: `Layout: normalized (QR-SPEC) end-to-end`.

So the **only** path that uses the normalized layout is: **Pipeline Smoke Test**, after an image is available.

---

## 3. Did the normalized layout work end-to-end?

**Code path:** Yes. The smoke test:

- Loads the normalized layout from the network.
- Passes it into **processWorksheet**, which:
  - **Marker detection:** Uses `homography.marker_size` (0.08) for minArea; detection logic is unchanged.
  - **Warp:** Same as before (fixed 1700×2200 destination).
  - **Crop boxes:** Uses `page.units === 'normalized'` and box `x`, `y`, `width`, `height` in 0–1, scaled by WARP_WIDTH/WARP_HEIGHT.
  - **OCR tensor preparation:** Same `preprocessToMNIST` per crop; unchanged.

**Runtime E2E:** To confirm in the browser:

1. Run `npm run dev`, open the app.
2. Capture or upload an image that has **4 black corner markers** (same as before).
3. Click **“📊 Pipeline Smoke Test”**.
4. Expected: logs show “Loading normalized layout (QR-SPEC): layouts/sg-10-box-v1.json”, “Layout loaded: sg-10-box-v1, units=normalized”, then warped size, 10 crops, tensor checks, “Pipeline Smoke Test PASSED”, “Layout: normalized (QR-SPEC) end-to-end”.

If no valid image or markers are missing, the test will fail at “Corner marker detection failed” (same as with the mm layout); the normalized layout is still the one being used.

---

## 4. Mismatch still remaining vs QR-SPEC

- **App layout source:** Capture/upload and the rest of the app still use the **inline mm LAYOUT** in App.vue and CameraCapture.vue. Only the Pipeline Smoke Test uses the normalized layout from `/layouts/sg-10-box-v1.json`. So the main flow is not yet driven by QR or by a layout file.
- **QR payload:** No `answer_key`, `template_id`, `sheet_instance_id`, or QR decode step yet. The layout file matches the spec’s layout definition (normalized boxes, homography.anchors, marker_size) but is not wrapped in a full QR payload (schema_version, etc.).
- **Anchor usage:** We use the layout’s `marker_size` (normalized) for detection. We do **not** yet use `homography.anchors` for the warp destination; warp is still fixed to 0.05/0.95 of the image, which matches the spec’s typical anchor positions but is not read from the layout.
- **Single layout:** Only one layout file is wired (`sg-10-box-v1`). There is no `layout_id` lookup or support for multiple layouts yet.
