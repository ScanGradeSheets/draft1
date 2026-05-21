# ScanGrade QR Code Specification

## Overview

QR codes encode worksheet metadata, answer keys, and geometric layout information for reliable auto-grading. All processing happens on-device; the QR contains everything needed to interpret the worksheet.
The primary capture workflow is student self-scan on shared iPads, with results saved for later teacher review.

---

## Schema

```json
{
  "schema_version": 1,
  "template_id": "single-digit-addition-20",
  "template_version": 2,
  "sheet_instance_id": "uuid-v4-string",
  "answer_key": [7, 2, 9, 3, 5, 1, 8, 4, 6, 0, 9, 2, 7, 5, 3, 1, 8, 6, 4, 0],
  "layout_id": "sg-20-box-grid-v2",
  "inline_layout": null,
  "homography": {
    "anchors": [
      {"id": "tl", "x": 0.05, "y": 0.05},
      {"id": "tr", "x": 0.95, "y": 0.05},
      {"id": "br", "x": 0.95, "y": 0.95},
      {"id": "bl", "x": 0.05, "y": 0.95}
    ],
    "marker_size": 0.08
  }
}
```

---

## Field Definitions

### `schema_version` (integer, required)
- Current version: `1`
- Increment when breaking changes to schema structure
- Parser can handle backward compatibility via version check

### `template_id` (string, required)
- URL-safe identifier for the worksheet type
- Examples: `"single-digit-addition-20"`, `"subtraction-with-borrowing-10"`, `"mixed-operations-30"`
- Used to group analytics and match answer keys

### `template_version` (integer, required)
- Tracks revisions to the worksheet layout
- Increment when box positions, sizes, or counts change
- Ensures old photos process with correct coordinate expectations

### `sheet_instance_id` (string, required)
- UUID v4, unique per printed sheet
- Enables result tracking per-student when batch printed
- Optional: can be `"anonymous"` for generic sheets

### `answer_key` (number[], required)
- Array of correct answers in box order
- Must match length of `boxes` in referenced layout
- Values: typically 0-9 for digit recognition, but can include 10+ for multi-digit or multiple choice

### `layout_id` (string, preferred)
- References a layout definition stored locally in the app
- Keeps QR payload small (~50 bytes vs 500+ for inline layouts)
- Common layouts are bundled; uncommon ones fetched once then cached
- Fallback to `inline_layout` for custom/rare templates

### `inline_layout` (object, optional)
- Only used when `layout_id` references an unknown layout
- Structure: `{ "page": {"width": 1.0, "height": 1.41}, "boxes": [...] }`
- Always use normalized coordinates (0.0 to 1.0 range)
- Compress coordinates: round to 4 decimals max (0.1234 not 0.12345678)

### `homography` (object, required)

#### `anchors` (array, 4 items)
Four dedicated corner markers for perspective transformation:

| ID | Position | Purpose |
|----|----------|---------|
| `tl` | Top-left | Primary orientation reference |
| `tr` | Top-right | X-axis alignment |
| `br` | Bottom-right | Scale validation |
| `bl` | Bottom-left | Y-axis alignment |

Each anchor has:
- `x`: Horizontal position in template space (0.0 = left edge, 1.0 = right edge)
- `y`: Vertical position in template space (0.0 = top edge, 1.0 = bottom edge)

Marker shape standard:
- Use solid black squares, not circles.
- Keep marker geometry visually simple and highly contrastive for handheld iPad capture on tables or floors.

#### `marker_size` (number)
- Normalized size of the anchor markers (0.08 = 8% of page width)
- Used by detector to find marker centers precisely
- Consistent size enables sub-pixel homography accuracy

---

## Normalized Coordinate System

All `x`, `y`, `width`, `height` values are in **template-normalized coordinates** (0.0 to 1.0).

**To convert to pixels after homography:**
```javascript
pixelX = normalizedX * warpedImageWidth
pixelY = normalizedY * warpedImageHeight
```

**Why normalized:**
- Photos vary in distance/resolution (2000×1500 vs 4000×3000)
- Homography-normalized image has consistent dimensions regardless
- Boxes stay in correct relative positions

---

## Layout Definition (Separate File)

Pre-defined layout files are served by the app at `/layouts/` (from `public/layouts/` at runtime). Example:

```javascript
// public/layouts/sg-20-box-grid-v2.json (fetched as /layouts/sg-20-box-grid-v2.json)
{
  "layout_id": "sg-20-box-grid-v2",
  "page": {
    "aspect_ratio": 0.707,  // 8.5x11 portrait = 1/√2
    "units": "normalized"
  },
  "boxes": [
    {
      "id": 0,
      "question_num": 1,
      "x": 0.1000,      // center x
      "y": 0.1500,      // center y  
      "width": 0.0800,  // box width
      "height": 0.0800, // box height
      "expected_type": "digit"
    },
    // ... 19 more boxes
  ],
  "metadata": {
    "total_questions": 20,
    "questions_per_row": 5,
    "row_count": 4
  }
}
```

**Box fields:**
- `id`: Zero-based index matching `answer_key` array position
- `question_num`: Human-readable question number (may differ from id)
- `x`, `y`: Box center in normalized coordinates
- `width`, `height`: Box dimensions (usually symmetric)
- `expected_type`: `"digit" | "letter" | "fraction"` (future-proofing)

---

## QR Encoding Process

1. **Build JSON payload** with all required fields
2. **Compress** inline_layout coordinates (4 decimal max)
3. **Stringify** with minimal whitespace
4. **Base64 encode** (URL-safe variant: `-_` instead of `+/`)
5. **Generate QR** with high error correction (Level H, 30% tolerant)

**Expected QR size:** Level 1-3 (21×21 to 29×29 modules) for most sheets

---

## Example: Minimal QR

Sheet with standard layout (no inline layout needed):

```json
{
  "schema_version": 1,
  "template_id": "addition-20",
  "template_version": 2,
  "sheet_instance_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "answer_key": [7,2,9,5,1,8,4,3,6,0,9,7,5,2,8,1,6,4,3,0],
  "layout_id": "sg-20-box-grid-v2",
  "homography": {
    "anchors": [
      {"id": "tl", "x": 0.05, "y": 0.05},
      {"id": "tr", "x": 0.95, "y": 0.05},
      {"id": "br", "x": 0.95, "y": 0.95},
      {"id": "bl", "x": 0.05, "y": 0.95}
    ],
    "marker_size": 0.08
  }
}
```

Base64 encoded (URL-safe):
```
eyJzY2hlbWFfdmVyc2lvbiI6MSwidGVtcGxhdGVfaWQiOiJhZGRpdGlvbi0yMCIsInRlbXBsYXRlX3ZlcnNpb24iOjIsInNoZWV0X2luc3RhbmNlX2lkIjoiYTFiMmMzZDQtZTVmNi03ODkwLWFiY2QtZWYxMjM0NTY3ODkwIiwiYW5zd2VyX2tleSI6WzcsMiw5LDUsMSw4LDQsMyw2LDAsOSw3LDUsMiw4LDEsNiw0LDMsMF0sImxheW91dF9pZCI6InNnLTIwLWJveC1ncmlkLXYyIiwiaG9tb2dyYXBoeSI6eyJhbmNob3JzIjpbeyJpZCI6InRsIiwieCI6MC4wNSwieSI6MC4wNX0seyJpZCI6InRyIiwieCI6MC45NSwieSI6MC4wNX0seyJpZCI6ImJyIiwieCI6MC45NSwieSI6MC45NX0seyJpZCI6ImJsIiwieCI6MC4wNSwieSI6MC45NX1dLCJtYXJrZXJfc2l6ZSI6MC4wOH19
```

---

## Worksheet SVG Integration

The worksheet template must print:

1. **4 corner anchor markers**: Black squares at `homography.anchors` positions
   - Size: `marker_size` × page width
   - Slightly different from data-QR for visual distinction
   - Or use the data-QR itself if positioned at one anchor

2. **Data QR**: Contains the encoded payload (typically upper-right corner or separate)

3. **Digit boxes**: Printed to match `layout.boxes` positions exactly

4. **Optional student name area**: If used, reserve a consistent top-of-page region for either:
   - manual student selection in the app, or
   - a future OCR-assisted read of a handwritten name line

For now, name capture should not be required for the OCR pipeline to succeed.

---

## Future Schema Versions

**Version 2 ideas:**
- Support for multi-page booklets (page_number field)
- Partial credit answers (range-based scoring)
- Student ID fields (separate OCR zone)
- Time limits (timestamp validation for timed tests)

---

## Security Note

The QR contains answer keys in plaintext. While convenient for teachers grading their own sheets, consider:

- Randomized answer keys per sheet instance (already supported via `sheet_instance_id`)
- Students cannot access QR data without scanning tool
- For high-stakes testing, obfuscate or encrypt answer_key (future enhancement)

---

**Author:** Hobbes MacLaren  
**Last Updated:** 2026-02-09  
**Status:** Approved by Tony, ready for implementation
