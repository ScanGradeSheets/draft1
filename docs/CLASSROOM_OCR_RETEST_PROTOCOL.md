# Classroom OCR Retest Protocol

Created 2026-06-01 after the first newly printed subtraction scan reproduced a real two-digit OCR failure.

## Purpose

Use this for the next classroom retest so ScanGrade gets evidence that can separate:

- handwriting recognition weakness
- photo/camera source weakness
- pencil darkness and contrast
- worksheet geometry or alignment problems
- student writing behavior

This is not a new worksheet design request. Keep the current worksheet packet in use unless Tony explicitly decides otherwise.

## Current Failure To Recheck

The clearest current failure is:

- worksheet: Subtraction Within 20
- code: `SG-G2-B-001`
- expected answers: `17,15,12,12,12,12,12,12,14,11`
- current app result: `5/10`
- likely cause: thin pencil `2`s and `7`s often collapse toward `1` or `9` after crop preprocessing and model input resizing

## Best Next Sample Set

Minimum useful retest:

- 1 completed Subtraction Within 20 sheet photographed in the live app
- the same physical sheet photographed once as a normal phone photo
- note whether the student used normal pencil, dark pencil, or pen

Better if convenient:

- 2 completed Subtraction Within 20 sheets from different students
- 1 completed Addition Within 20 sheet
- 1 completed Mixed Within 50 sheet
- for one sheet, capture both live app scan and normal camera photo

Do not coach students to write for the scanner. Normal classroom writing is the target.

## Tony Notes To Capture

For each page, record only what is easy:

```text
Sheet:
Student/sample label:
Writing tool:
Capture source: live app / iPhone camera / iPad camera
Lighting: normal / shadowed / bright glare
Did student write inside boxes? yes / no / mixed
Did the live app say success, review, or try again?
```

## Codex Evaluation Order

When new retest samples arrive:

1. Inventory each file and link it to the sheet code.
2. Run the sample through the current app path without code changes.
3. Score answer-level accuracy against the known answer key.
4. Save debug crop output locally.
5. Compare live-app scan vs normal camera photo if both exist.
6. Categorize the failure before proposing a patch.

## Decision Rules

If the same page works from a normal camera photo but fails from the live app capture, prioritize capture/image-quality diagnosis.

If both photos produce good crops but wrong digits, prioritize OCR preprocessing, candidate selection, confidence handling, or model training.

If crops miss the handwriting, prioritize layout/crop alignment.

If answers are visibly outside the boxes, classify it as student writing behavior before changing OCR.

## Patch Gate

Any OCR/crop/model patch should still clear:

- `docs/TWO_DIGIT_OCR_ACCEPTANCE_GATE.md`

Do not accept a patch only because it improves one retest photo.
