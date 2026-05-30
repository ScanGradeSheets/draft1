# Warp layout anchors – report

## 1. Exact files changed

- **src/homography.js** – `warpToTemplate` now takes a third argument `layout` and uses `layout.homography.anchors` for warp destination when present; `processWorksheet` passes `layout` into `warpToTemplate`.

---

## 2. Exact anchor logic added or replaced

**Replaced (destination points only):**

- **Before:** Destination points were fixed: `(0, 0)`, `(WARP_WIDTH, 0)`, `(WARP_WIDTH, WARP_HEIGHT)`, `(0, WARP_HEIGHT)` — i.e. full frame corners in pixel space.
- **After:**
  - **When layout defines anchors:** If `layout.homography.anchors` exists, has four entries with `id` in `tl`/`tr`/`br`/`bl`, and each has numeric `x`, `y` in [0, 1], destination points are taken from the layout in that order:
    - `tl` → `(tl.x * WARP_WIDTH, tl.y * WARP_HEIGHT)`
    - `tr` → `(tr.x * WARP_WIDTH, tr.y * WARP_HEIGHT)`
    - `br` → `(br.x * WARP_WIDTH, br.y * WARP_HEIGHT)`
    - `bl` → `(bl.x * WARP_WIDTH, bl.y * WARP_HEIGHT)`
  - **Otherwise:** Same as before: `(0, 0)`, `(WARP_WIDTH, 0)`, `(WARP_WIDTH, WARP_HEIGHT)`, `(0, WARP_HEIGHT)`.

**Added:**

- Third parameter `layout` to `warpToTemplate(src, anchors, layout)`.
- Guard `hasLayoutAnchors`: checks `layout?.homography?.anchors` is an array of length 4, and that for each of `tl`, `tr`, `br`, `bl` there is an anchor with that `id` and with `x`, `y` in [0, 1].
- Building `dstPoints` from those four anchors in tl/tr/br/bl order when the guard passes.

**Unchanged:**

- Source points still come only from the **detected** anchors (pixel positions from `detectCornerMarkers`). Only the **destination** of the warp is layout-driven when the layout provides valid anchors.

---

## 3. Main flow now honors layout-defined homography

**Yes.** For the main flow:

1. CameraCapture fetches `/layouts/sg-10-box-v1.json` (normalized layout with `homography.anchors`: tl 0.05,0.05; tr 0.95,0.05; br 0.95,0.95; bl 0.05,0.95).
2. It calls `processWorksheet(src, layout)`.
3. `processWorksheet` calls `warpToTemplate(src, anchors, layout)`.
4. `warpToTemplate` sees valid layout anchors and sets destination to (85, 110), (1615, 110), (1615, 2090), (85, 2090) — i.e. 0.05/0.95 in normalized space × WARP dimensions.

So the warp destination is fully defined by the layout’s homography anchors; the main app flow uses layout-defined homography for the warp step.

---

## 4. Verification

- **Main flow still works with normalized layout:** Same pipeline (fetch layout → processWorksheet → warp → crop → OCR). Only the warp destination is now taken from the layout; warped size remains 1700×2200 and crop logic is unchanged.
- **Homography anchors from the layout are used:** When `layout.homography.anchors` is present and valid, `dstPoints` are built from those anchors; otherwise the previous fixed destinations are used.
- **Cropping still produces the expected box regions:** Boxes are still in normalized 0–1 over the **warped** image; cropBoxes uses `box.x * WARP_WIDTH` etc. The warped image is still 1700×2200; only where the photo’s four corners land in that frame changes (inset by 0.05/0.95). So box positions (e.g. 0.204, 0.294) still map to the same relative regions in the warped image; cropping is unchanged and remains correct.

---

## 5. Mismatch still remaining vs full ScanGrade spec

- **No QR decoding:** Layout is still from a fixed URL; no QR payload (schema_version, template_id, answer_key, etc.) is read from the sheet.
- **No answer_key:** No grading or correct/incorrect; answer_key from a future QR payload is not used.
- **Single layout:** Only one layout file is used; no layout_id-based selection.
- **drawDebugOverlay:** Still assumes box positions in a legacy form (e.g. box.cx, box.cy); for normalized layouts it would need to use box.x, box.y with appropriate scale. Not part of the main OCR path.

---

## 6. Next single best bounded step

**Add `answer_key` to the layout and pipeline (data only).**  
Add an optional `answer_key` array to the normalized layout file (and to the type the pipeline uses). When present, compute per-box correct/incorrect (recognized digit vs `answer_key[box.id]`) and include it in the OCR result payload. No new UI or QR decoding; sets up correct/incorrect for the next step (e.g. green/red per STYLE_GUIDE and GOALS).
