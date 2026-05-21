# ScanGrade

Zero-install iPad/Safari web app for auto-grading worksheets.

## Quick Start

```bash
npm install
npm run dev
```

Then on your iPad:
1. Open Safari
2. Navigate to `http://[your-mac-ip]:5174`
3. Allow camera access when prompted
4. Point at a worksheet
5. Tap Capture

## Features in this demo

- Camera capture via MediaDevices API (environment-facing)
- File upload fallback for older iPads
- Real OCR pipeline (OpenCV homography + ONNX digit recognition) with confidence scoring
- Visual flagging for digits under 80% confidence; correct/incorrect when answer key is present
- Student Mode roster selection with local saved-scan review queue for teachers

## Running the real worksheet E2E test

1. **Start the dev server** (must be running first):
   ```bash
   npm run dev
   ```
2. **Confirm the server is on port 5174** (Vite will show e.g. `Local: http://localhost:5174/`). If the port is in use, stop the other process or the server will fail (strictPort).
3. **Run the Playwright test**:
   ```bash
   npx playwright test test-upload-real.spec.js
   ```
   The test uses `public/test-worksheet-calibrated.png` (corner markers, no digits). The **digit E2E** (worksheet-with-digits) uses `public/test-worksheet-with-digits.png`; generate it with:
   ```bash
   node scripts/generate-test-image.js
   ```

## Next Steps

See `kanban.html` for project board.

## Architecture decisions

- **Implemented:** Normalized layout (QR-SPEC style), real OCR (OpenCV homography + ONNX), JSON/CSV export, QR decode (layout_id / answer_key / template metadata).
- **Implemented (early):** teacher-managed class roster and local saved-scan queue for student self-capture.
- **Not in app yet:** QR encoding and printable sheet generation; JPG/PDF export; durable multi-device student data sync.
