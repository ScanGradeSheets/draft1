# Legacy iPad Compatibility Plan

Date: 2026-05-30

Tony has at least two iPad classes available:

- Newer black iPad: photo evidence shows iPadOS 15.4.1. The current ScanGrade app appears to load here.
- Older blue iPad: photo evidence shows iOS 12.5.7. The current ScanGrade app may not load here.

## Goal

Support older iPads if possible without degrading or disrupting the current modern ScanGrade app.

## Current Diagnostic

Open this URL from the Mac first:

```text
https://localhost:5174/legacy-check.html
```

On an iPad, do not use `localhost`, because that means the iPad itself. Use the Mac's reachable LAN/Tailscale/served app address with `/legacy-check.html` at the end, for example:

```text
https://<mac-or-tailscale-address>:5174/legacy-check.html
```

If the old iPad cannot get past the HTTPS certificate warning, that is useful evidence too. It means the fallback route may need to be served through a trusted local/Tailscale endpoint before app compatibility can be judged.

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

## Capture-Only Prototype

A separate static capture-only prototype also exists at:

```text
https://localhost:5174/legacy/index.html
```

On an iPad, use the Mac's reachable LAN/Tailscale/served app address with `/legacy/index.html` at the end.

Use the exact `index.html` URL during local Vite development. The shorter `/legacy/` path may fall back to the modern app in Vite dev mode.

This prototype is intentionally separate from the modern app. It does not load Vue, OCR, ONNX, OpenCV, homography, or the production capture pipeline.

It can:

- collect student name
- choose worksheet A/B/C
- choose or capture a worksheet photo through old Safari's file input
- preview the selected photo if FileReader works
- save capture metadata in localStorage
- generate a report that Tony/Codex can inspect

It cannot:

- grade worksheets
- reliably store full worksheet photos after the page is closed
- submit to the backend yet

The full photo is kept only while the page is open. This is deliberate because older mobile Safari storage is too small and unreliable for large student photo queues.

## Interpretation

If `legacy-check.html` does not load:

- The problem is likely network, HTTPS/certificate, Tailscale, or very old Safari support.
- Do not spend time building a fallback app until basic page loading works.

If it loads and photo selection/preview works:

- Try the `/legacy/` capture-only prototype.
- It should let a student choose name/worksheet and preview a worksheet photo.
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

The likely MVP is the legacy capture page:

1. Student selects name.
2. Student selects worksheet A/B/C.
3. Student takes or chooses a photo.
4. Page previews the image if possible.
5. Page saves metadata and keeps the photo preview in the current page session.
6. Teacher reviews results on a newer device.

Next likely improvement after blue-iPad testing:

- Add backend image submission if the old iPad can select/preview photos.
- Add a teacher-device intake page if backend deployment is not ready.
- Keep local OCR/grading out of the legacy path unless diagnostic evidence says the old iPad can handle it.

This would let older iPads remain useful in class without weakening the current app for newer hardware.
