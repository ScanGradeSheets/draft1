# Classroom Sample Collection Card

Created 2026-05-30 for Tony's current open-divider worksheet test.

## Goal

Get a small, honest set of real Grade 1/2 handwriting samples so ScanGrade can be tested against classroom reality before any OCR, capture, homography, or worksheet-format tuning.

This is not a polished pilot yet. It is the truth-test before the next technical move.

## Print

Use the current three-sheet packet:

```text
public/worksheets/printables/ScanGrade-Grade2-Worksheets-A-B-C-Print-Packet.pdf
```

The explicit test-packet path should visually match it:

```text
public/worksheets/open-divider-test/printables/ScanGrade-Grade2-Worksheets-A-B-C-Open-Divider-Test-Packet.pdf
```

Both should show the newer open/notch divider answer boxes and the lowered `ScanGrade.io` QR branding.

Sheets:

- A: Addition Within 20
- B: Subtraction Within 20
- C: Mixed Within 50

## Best Small Sample

Minimum:

- 1 completed Sheet A
- 1 completed Sheet B
- 1 completed Sheet C

Better, if easy:

- 2 or 3 students per sheet
- Mix of neat and ordinary handwriting
- At least one sample with normal classroom imperfections

Avoid selecting only the neatest work. ScanGrade needs to survive the real version.

## Student Direction

Keep the instruction simple:

```text
Do this like normal classwork. Write your answers inside the boxes. Do not worry about making it perfect.
```

Do not coach students to write for the scanner. The point is to see whether the current design works with natural student writing.

## What Tony Should Notice

While students work, jot down anything obvious:

- Did students know where to write?
- Did anyone write outside the boxes?
- Did the divider marks confuse anyone?
- Did the page feel too empty, too cramped, or just right?
- Did students ask what the ScanGrade.io mark means?
- Did the worksheet feel like normal classroom work?

These observations matter as much as the OCR results.

## Photo Checklist

For each completed page:

- Show the full sheet.
- Include all four corner markers.
- Keep the page mostly flat.
- Use normal classroom lighting.
- Avoid severe blur.
- Keep the original photo even if it is imperfect.

Good real photos are more useful than perfect staged photos.

## File Names

Use simple names if possible:

```text
sheet-a-student-01.jpg
sheet-b-student-01.jpg
sheet-c-student-01.jpg
sheet-a-student-02.jpg
```

For repeat photos:

```text
sheet-a-student-01-photo-1.jpg
sheet-a-student-01-photo-2.jpg
```

## Where To Put Them

Preferred local folder:

```text
worksheet photos/student-samples/open-divider-2026-05/
```

Do not clean, rename, crop, or delete originals before Codex sees them.

## What Codex Will Do Next

Codex should:

1. Inventory the files.
2. Check photo quality and visible markers.
3. Identify sheet type.
4. Run the current app path.
5. Compare results against the answer keys.
6. Report what worked and failed in teacher language.
7. Recommend the smallest next fix only after the failure mode is clear.

Use `docs/STUDENT_SAMPLE_TRIAGE_RUNBOOK.md` for the operational pass.

## After A Failed Live Scan

If a completed worksheet fails in the live app, use the narrower retest protocol:

- `docs/CLASSROOM_OCR_RETEST_PROTOCOL.md`

That protocol asks for the same physical page when possible as both a live app scan and a normal camera photo, plus quick notes about writing tool, lighting, and whether the student stayed inside the boxes. This keeps the next OCR fix grounded in evidence instead of guessing.
