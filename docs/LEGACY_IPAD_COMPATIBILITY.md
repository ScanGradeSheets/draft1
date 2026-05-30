# Legacy iPad Compatibility Plan

Date: 2026-05-30

Tony has at least two iPad classes available:

- Newer black iPad: photo evidence shows iPadOS 15.4.1. The current ScanGrade app appears to load here.
- Older blue iPad: photo evidence shows iOS 12.5.7. The current ScanGrade app may not load here.

## Goal

Support older iPads if possible without degrading or disrupting the current modern ScanGrade app.

## Current Diagnostic

Open this URL on the older iPad:

```text
https://localhost:5174/legacy-check.html
```

Or use the equivalent Tailscale/served app URL with `/legacy-check.html` at the end.

This page is intentionally lightweight:

- no Vue
- no Vite module entry
- no OCR model
- no ONNX Runtime
- no OpenCV
- no homography/capture pipeline
- no production app logic

It checks:

- iOS/Safari user agent
- screen and viewport
- file/photo input
- FileReader preview support
- Canvas support
- WebAssembly support
- module script support
- MediaDevices/getUserMedia support
- fetch/localStorage support

## Interpretation

If `legacy-check.html` does not load:

- The problem is likely network, HTTPS/certificate, Tailscale, or very old Safari support.
- Do not spend time building a fallback app until basic page loading works.

If it loads and photo selection/preview works:

- Build a `/legacy/` capture-only app.
- It should let a student choose name/worksheet and upload or capture a worksheet photo.
- OCR/grading should happen elsewhere, such as a newer iPad, teacher device, or backend.

If it loads but photo preview fails:

- The older iPad might still be usable only for navigation/instructions, not capture.
- Try camera roll vs camera capture separately before deciding.

If WebAssembly fails:

- Do not try to run local OCR/OpenCV/model code on that iPad.
- Treat it as capture-only at most.

If MediaDevices fails but file input works:

- Avoid live camera APIs on the fallback path.
- Use `<input type="file" accept="image/*" capture="environment">` and allow camera roll/photo picker behavior.

## Safety Rules

- Do not change the modern app path to support iOS 12.
- Do not change OCR, capture, homography, or model code for this diagnostic.
- Keep legacy support as a separate static route until real iPad evidence says otherwise.
- Do not promise local grading on iOS 12 unless WebAssembly/OpenCV/model tests prove it.
- Prefer capture/submission fallback over trying to shrink the full app onto old hardware.

## Likely MVP Fallback

The likely MVP is a legacy capture page:

1. Student selects name.
2. Student selects worksheet A/B/C.
3. Student takes or chooses a photo.
4. Page previews the image if possible.
5. Page saves/submits the image for teacher/Codex/server processing.
6. Teacher reviews results on a newer device.

This would let older iPads remain useful in class without weakening the current app for newer hardware.
