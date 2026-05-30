# QR decode (payload-only) – report

## 1. Exact files changed

- **src/qr-decode.js** (new) – Decode QR from canvas (jsQR), parse payload string (QR-SPEC base64 or raw JSON), legacy `answers` → `answer_key`. Exports: `decodeQrFromCanvas(canvas)`, `parseQrPayloadString(data)`.
- **src/components/CameraCapture.vue** – Import `decodeQrFromCanvas`; in `runRealOCR`, decode QR from the capture canvas before loading layout; when a payload exists use `layout_id` for layout URL (with fallback to default on 404) and merge `answer_key` and `homography` from payload into the fetched layout; when no QR use default layout only.
- **package.json** – Added dependency `jsqr`.

---

## 2. Exact QR payload fields used

- **layout_id** – Optional. Used to build layout URL: `/layouts/${layout_id}.json`. If missing or that fetch fails, fall back to default layout URL.
- **answer_key** – Optional array. If present, set on the layout object so the pipeline and correctness UI use it.
- **homography** – Optional object. If present, merged into `layout.homography` (e.g. anchors, marker_size from the sheet).

Other payload fields (schema_version, template_id, sheet_instance_id, inline_layout, etc.) are not used yet; they are left for later.

---

## 3. When QR is missing

- `decodeQrFromCanvas(canvas)` returns `null`.
- `qrPayload` is null, so `layoutUrl` is set to `DEFAULT_LAYOUT_URL` and we fetch the default layout only.
- No `answer_key` or `homography` is merged; the layout is used as served (including any answer_key in the default layout file).
- OCR and the rest of the flow are unchanged; correctness UI shows green/red only when the layout has `answer_key` (from file or QR).

---

## 4. Verification

- **QR decode when valid QR present:** jsQR runs on the capture canvas; if a QR is found, `parseQrPayloadString` handles base64 (including URL-safe) or raw JSON and returns a payload; legacy `answers` is mapped to `answer_key`.
- **Decoded payload drives layout/answer_key:** When `qrPayload` is set, layout is fetched by `layout_id` (or default on 404) and `answer_key` and `homography` from the payload are merged into the layout used for `processWorksheet` and correctness.
- **Fallback when no QR:** No QR → null payload → default layout URL only, no merge; behavior matches pre–QR flow.
- **Existing OCR and correctness UI:** Same pipeline (processWorksheet → recognizeDigits → result with digits, confidences, correct when answer_key present); green/red styling still driven by `ocrResult.correct`; no new UI or screens.

---

## 5. Mismatch still remaining vs full ScanGrade spec

- **template_id / sheet_instance_id:** Not used for lookup or tracking yet.
- **inline_layout:** Not used; only `layout_id` → fetch layout file.
- **schema_version:** Not checked; no versioned handling.
- **Full template management:** No caching, no “unknown layout_id” flow beyond fallback to default layout.
- **QR placement:** Decoder runs on the full image; QR-SPEC suggests a typical placement (e.g. corner) but we don’t restrict or optimize for it.

---

## 6. Next single best bounded step

**Use template_id and/or sheet_instance_id in the OCR result payload (data only).** When a QR payload is decoded, attach `template_id` and `sheet_instance_id` (if present) to the object emitted on `ocr-complete` so downstream (e.g. export or future dashboard) can associate the scan with a template and sheet without adding UI or new screens.
