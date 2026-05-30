# QR template_id / sheet_instance_id on result – report

## 1. Exact files changed

- **src/components/CameraCapture.vue** – When building the OCR result payload in `runRealOCR`, if `qrPayload` exists (QR was decoded), set `payload.template_id` and `payload.sheet_instance_id` from the payload when those fields are present. No other changes.

---

## 2. Exact payload fields added

On the object emitted via `ocr-complete` (and stored in `ocrResult.value`):

- **template_id** – Set only when a QR was decoded and `qrPayload.template_id` is not null/undefined (e.g. string like `"single-digit-addition-20"`). Omitted when no QR or when the decoded payload has no template_id.
- **sheet_instance_id** – Set only when a QR was decoded and `qrPayload.sheet_instance_id` is not null/undefined (e.g. UUID or `"anonymous"`). Omitted when no QR or when the decoded payload has no sheet_instance_id.

Both are pass-through from the decoded QR payload; no validation or formatting. Existing fields (digits, confidences, predictions, totalTime, correct) are unchanged.

---

## 3. Verification

- **Present when available:** If the image contains a QR with template_id and/or sheet_instance_id, those values are on the payload; the parent (and any listener) receives them on `ocr-complete`.
- **When QR missing:** `qrPayload` is null; the block that adds template_id/sheet_instance_id is skipped; the emitted result has no new fields; behavior unchanged.
- **Existing flow:** OCR and correctness (green/red) are unchanged; we only add two optional properties to the same payload.

---

## 4. What still remains missing vs full ScanGrade spec

- **UI:** No display or use of template_id / sheet_instance_id in the app yet.
- **Tracking/export:** No persistence or export of results keyed by sheet_instance_id or template_id.
- **schema_version:** Not checked; no versioned handling of QR payloads.
- **inline_layout:** Not used when layout_id is missing or unknown.
- **Template management:** No caching, no lookup by template_id, no “unknown layout” flow beyond default layout fallback.

---

## 5. Next single best bounded step

**Add a simple export of OCR results (e.g. JSON download or copy).** One button or action that takes the last `ocrResult` (digits, confidences, correct, template_id, sheet_instance_id) and downloads it as a JSON file or copies it to the clipboard. No new screens or template management; gives teachers a way to get data out and aligns with GOALS (reduce friction, validate before scaling).
