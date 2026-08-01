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

The public ScanGrade site sends debug bundles through a dedicated upload-only
HTTPS ingress:

```text
https://hobbes-mac-mini.tail9a3379.ts.net:8443/
```

Tailscale Funnel exposes only the restricted proxy on `127.0.0.1:8793`. It
does not expose Mission Control, stored files, or other Mac Mini services. The
proxy accepts only authenticated debug POSTs from the exact
`https://scangrade.io` origin, enforces an 80 MB request limit, rate limits and
timeouts, then forwards the bundle over localhost to Mission Control.

If the public upload URL returns `502`, either the restricted proxy or local
Mission Control receiver is probably not running. If it cannot connect at all,
confirm Tailscale Funnel still exposes HTTPS port 8443.

The Mac Mini normally keeps both services running through the private
`com.scangrade.mission-control` and `com.scangrade.debug-upload-proxy`
LaunchAgents. Their shared token is stored outside the repository. Do not
commit or publish it.

## Open The Prepared Debug URL Once

Open a URL like this on the scanning device:

```text
https://scangrade.io/?liveOcrDebug=1#debugAutoUpload=1&debugUploadUrl=https%3A%2F%2Fhobbes-mac-mini.tail9a3379.ts.net%3A8443%2F&debugUploadToken=PRIVATE_TOKEN
```

The private values are carried in the URL fragment, which is not sent to
Cloudflare. ScanGrade saves them locally and immediately clears the fragment
from the visible URL. After opening the prepared URL once, Debug Scan on the
same browser/PWA storage context should keep auto-saving until disabled.

Some iOS versions open an installed Home Screen app without forwarding the URL
fragment. In that case the Debug Scan bottom bar shows `Connect`. Tap it and
paste either the private key or the complete activation link. ScanGrade stores
the settings in that exact installation. If a completed scan is already on
screen, it uploads immediately; no repeat scan is needed. `Export` returns as
the manual fallback after connection.

To disable auto-upload on that device:

```text
https://scangrade.io/?liveOcrDebug=1&debugAutoUpload=0
```

## Classroom Collection Flow

1. Start Mission Control on the Mac.
2. Confirm the restricted public upload URL is reachable.
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
