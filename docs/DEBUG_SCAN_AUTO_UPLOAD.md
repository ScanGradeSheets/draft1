# Debug Scan Auto Upload

Use this when collecting a large classroom evidence set. It lets the public debug scan page save each scan into the local ScanGrade workspace without manually downloading every JSON and crop image.

## What It Saves

Each scan is posted to Mission Control and stored under:

```text
private-evidence/debug-scans/YYYY-MM-DD/<scan-id>/
```

That folder is ignored by git. It may contain student names and handwriting, so treat it as private evidence.

Each saved scan includes:

- `debug.json`: full OCR debug bundle from the browser.
- `summary.json`: small index file with layout, score/review counts, runtime, and quality metadata.
- `captured.png`: original captured camera image when available.
- `marked-sheet.jpg`: the user-facing marked sheet image when available.
- `overlay-debug.json`: compact overlay geometry and mark-placement metadata when available.
- `warped.png`: homography-warped worksheet when available.
- `raw-crops/*.png`: raw answer-box crops.
- `model-inputs/*.png`: 28x28 model input images.

## Receiver Status And Start Command

Mission Control must be running on the Mac that owns this workspace.

```bash
SG_DEBUG_UPLOAD_TOKEN=choose-a-private-secret node mission-control/server.mjs
```

`SG_DEBUG_UPLOAD_TOKEN` is required. The browser sends the same value as `debugUploadToken`, and Mission Control rejects uploads without it.

The public ScanGrade site is HTTPS, so the scan device also needs an HTTPS route to this receiver. The intended route is the tailnet Mission Control URL:

```text
https://hobbes-mac-mini.tail9a3379.ts.net/mission-control/api/debug-scans
```

If the tailnet URL returns `502`, the local Mission Control server is probably not running.

The Mac Mini is normally kept running by the private
`com.scangrade.mission-control` LaunchAgent. Its token is stored outside the
repository. Do not commit or publish it.

## Open The Prepared Debug URL Once

Open a URL like this on the scanning device:

```text
https://scangrade.io/?liveOcrDebug=1#debugAutoUpload=1&debugUploadUrl=https%3A%2F%2Fhobbes-mac-mini.tail9a3379.ts.net%2Fmission-control%2Fapi%2Fdebug-scans&debugUploadToken=PRIVATE_TOKEN
```

The private values are carried in the URL fragment, which is not sent to
Cloudflare. ScanGrade saves them locally and immediately clears the fragment
from the visible URL. After opening the prepared URL once, Debug Scan on the
same browser/PWA storage context should keep auto-saving until disabled.

To disable auto-upload on that device:

```text
https://scangrade.io/?liveOcrDebug=1&debugAutoUpload=0
```

## Classroom Collection Flow

1. Start Mission Control on the Mac.
2. Confirm the tailnet Mission Control URL works from the scan device.
3. Open the prepared debug URL on the scan device.
4. Scan a worksheet page.
5. Wait for the brief `Debug saved: ...` status over the worksheet.
6. Tap `New Scan` and repeat.

If the page says `Debug auto-save failed`, do not keep scanning until the
receiver/tailnet issue is fixed. The compact manual `Export` action still works
as a fallback.

The long debug answer list is intentionally absent. Use the centre arrow in
the bottom bar to show or hide recognized readings directly above their answer
boxes. `Export` in the same bar is the manual evidence fallback.

## Codex Handoff

Future SG threads should look first in:

```text
private-evidence/debug-scans/
```

Use `summary.json` files to triage a large batch before opening the full `debug.json` files. The saved debug data reflects the raw OCR result at scan time; later on-screen manual corrections are not auto-uploaded over the original evidence.

For misplaced yellow circles, checks, or X marks, compare `marked-sheet.jpg` with `overlay-debug.json`. The marked-sheet image is the same rendered result the student saw; the overlay JSON records the answer-box rectangles, mark type, review slots, and whether the marks were drawn on the source camera capture or the warped worksheet.
