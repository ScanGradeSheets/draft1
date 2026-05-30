# Review And Feedback Copy Guide

Created 2026-05-30 for future ScanGrade teacher/student review screens.

## Purpose

ScanGrade should communicate scan and grading results in teacher/student language, not OCR language.

The user should quickly understand:

- the scan worked
- the scan needs review
- the scan failed and should be retried
- the teacher remains in control

This guide is internal product copy. It does not change app behavior or define numeric confidence thresholds.

## Voice

Use language that is:

- calm
- clear
- teacher-oriented
- honest
- slightly warm

Avoid language that is:

- technical
- overconfident
- cute
- AI-branded
- blamey toward students

## Core Labels

Use these as the default product vocabulary unless Tony later chooses different wording.

| State | Primary label | Meaning |
| --- | --- | --- |
| Clear read | `Looks clear` | ScanGrade has a strong read and the answer can likely be marked automatically in practice mode. |
| Needs review | `Check this` | ScanGrade has a likely read, but the teacher or student should inspect it. |
| Unreadable answer | `Could not read` | ScanGrade should not score the answer. |
| Page processed | `Scanned successfully` | The page was detected and results are available. |
| Page failed | `Scan did not work` | The page could not be processed reliably. |
| Teacher action | `Review needed` | At least one item needs teacher judgment. |

## Teacher-Facing Copy

### Successful Scan

Good:

```text
Scanned successfully.
```

```text
All answers look clear.
```

```text
2 answers need review.
```

Avoid:

```text
OCR completed.
```

```text
Model confidence is high.
```

### Review Needed

Good:

```text
Check this answer.
```

```text
I think this says 15, but the writing is unclear.
```

```text
This answer may need teacher review.
```

Avoid:

```text
Low confidence prediction.
```

```text
Segmentation anomaly detected.
```

### Could Not Read

Good:

```text
Could not read this answer.
```

```text
Ask for a new scan or mark it yourself.
```

```text
The writing or photo is too unclear to score.
```

Avoid:

```text
Inference failed.
```

```text
Classifier returned null.
```

### Scan Failed

Good:

```text
Scan did not work.
```

```text
Try again with the whole page in view.
```

```text
Make sure the corner markers are visible.
```

Avoid:

```text
Homography failed.
```

```text
QR/layout detection error.
```

Technical detail can appear in an expanded debug section for Codex or teacher/debug mode, but not as the main message.

## Student-Facing Copy

Student Mode should be shorter and gentler.

Good:

```text
Nice, your scan worked.
```

```text
Check this one.
```

```text
Try scanning again.
```

```text
Make sure the whole page is in the picture.
```

Avoid:

```text
You failed the scan.
```

```text
Your handwriting is wrong.
```

```text
Low confidence.
```

If a student answer is wrong in practice mode, prefer simple learning language:

```text
Try this one again.
```

Do not shame the student or imply the app is the teacher.

## Red-Pen / Teacher Markup Direction

Teacher review can borrow familiar marking language:

- checkmarks
- circles
- corrections
- restrained red-pen accents

Keep this subtle. It should feel like teacher review, not a gimmick.

Possible labels:

- `Marked correct`
- `Marked incorrect`
- `Changed by teacher`
- `Teacher reviewed`

## Practice vs Assessment

### Practice Mode

Bias:

- helpful
- quick
- correction-friendly

Copy examples:

```text
Try this one again.
```

```text
Check your answer, then rescan.
```

```text
This one needs a look.
```

### Assessment Mode

Bias:

- conservative
- teacher-owned
- review-first

Copy examples:

```text
Teacher review needed.
```

```text
Suggested mark: incorrect.
```

```text
Score not final until reviewed.
```

Do not tell students official results before Tony approves that workflow.

## Recommended Default Copy Set

For the next teacher workflow prototype, use:

- `Scanned successfully`
- `Review needed`
- `Looks clear`
- `Check this`
- `Could not read`
- `New Scan`
- `Mark correct`
- `Mark incorrect`
- `Teacher reviewed`

For the next student workflow prototype, use:

- `Scan worked`
- `Try this one again`
- `Check this one`
- `Try scanning again`
- `New Scan`

## Open Tony Decisions

Tony should eventually choose:

1. Whether `Check this` or `Needs review` feels better for teacher review.
2. Whether student feedback should say `Try this one again` or directly show correct/incorrect.
3. Whether assessment mode should hide correctness until teacher review.
4. How visible the red-pen aesthetic should be.

Until then, use the conservative defaults above.
