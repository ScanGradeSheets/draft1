# ScanGrade

Zero-install iPad/Safari web app for auto-grading worksheets.

## Quick Start

```bash
npm install
npm run dev
```

Then on your iPad:
1. Open Safari
2. Navigate to `http://[your-mac-ip]:5173`
3. Allow camera access when prompted
4. Point at a worksheet
5. Tap Capture

## Features in this demo

- Camera capture via MediaDevices API (environment-facing)
- File upload fallback for older iPads
- Fake OCR pipeline with confidence scoring
- Visual flagging for digits under 80% confidence

## Next Steps

See `kanban.html` for project board.

## Architecture Decisions Pending Overseer Review

Before implementing:
1. QR spec + encoding/versioning
2. Worksheet coordinate system (SVG→pixels)
3. Real OCR pipeline (OpenCV + ONNX)
4. Export pipeline (JPG/PDF libraries)
5. Any student data handling