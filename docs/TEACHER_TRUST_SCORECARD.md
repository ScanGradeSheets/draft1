# Teacher Trust Scorecard

Created 2026-05-30 for the first real ScanGrade classroom sample pass.

## Purpose

Use this scorecard after Tony sends real completed worksheets. It keeps the evaluation focused on teacher trust, not just technical OCR output.

The central question:

```text
Would this save Tony time in a real Grade 1/2 classroom without making him doubt the results?
```

## Rating Scale

Use one rating per area:

- `Green`: good enough for the next small pilot step.
- `Yellow`: promising, but needs review, a small fix, or more samples.
- `Red`: not ready; this would waste teacher time or damage trust.

Do not average the colors into a fake score. One red trust issue can block the next milestone.

## Scorecard

| Area | Green | Yellow | Red | Evidence to record |
| --- | --- | --- | --- | --- |
| Page scan success | Most full-page samples process cleanly. | Some samples need retry or explanation. | Frequent failures or unclear failure states. | Pages attempted, pages processed, retry causes. |
| Worksheet usability | Students know where to write and mostly stay in boxes. | Minor writing/layout issues but still usable. | Layout causes repeated student confusion or unusable answers. | Writing outside boxes, divider confusion, erasures, extra marks. |
| Answer crop quality | Answer regions line up with student writing. | Some crops are tight or shifted but inspectable. | Crops miss digits or capture the wrong area. | Crop examples, affected questions, likely cause. |
| Digit recognition | Clear handwriting is usually read correctly. | Mixed results, but wrong reads are visible/reviewable. | Too many clear answers are misread. | Expected answer, recognized answer, confidence/review status. |
| Uncertainty handling | Unclear answers are flagged or refused. | Some uncertainty is visible, but wording/thresholds need work. | The app confidently marks unclear or wrong reads. | False confidence examples, review flags, missed flags. |
| Teacher review speed | Reviewing ScanGrade output is faster than marking from scratch. | Similar effort, but with a clear path to improvement. | Review is slower or more confusing than manual marking. | Number of flags, override effort, teacher interpretation time. |
| Student independence | Students could likely scan/check with minimal help. | Some teacher support needed. | Teacher would become the scanning clerk. | Student questions, scan attempts, points of confusion. |
| Classroom fit | The flow feels calm, quick, and routine-ready. | Promising but still fragile. | Too fussy for real classroom use. | Time, friction, device issues, classroom interruptions. |

## Overall Decision

Choose one:

- `Proceed`: try another small classroom round with the current worksheet format.
- `Tune app`: keep the worksheet format, but fix a specific app/OCR/capture failure.
- `Tune worksheet`: adjust answer boxes/layout before more technical work.
- `Gather more evidence`: sample set is too small or unclear.
- `Pause`: current flow is not saving time yet.

## Pilot Gate

The next milestone is a small pilot, not public launch.

Proceed toward that next milestone only if:

- no red issue affects teacher trust
- failures are explainable
- the app is conservative when uncertain
- teacher review seems faster than marking the whole sheet
- Tony feels the next classroom try would not waste class time

For current two-digit worksheet OCR work, also use:

- `docs/TWO_DIGIT_OCR_ACCEPTANCE_GATE.md`

That gate keeps a narrow OCR patch from being accepted just because it improves one example while weakening the broader real-sample set.

## What To Say In The Report

Use teacher-facing language:

```text
ScanGrade processed 5 of 6 pages cleanly. Most clear answers were read correctly. Two answers need teacher review because the student wrote across the divider. This is promising, but not ready for public claims.
```

Avoid purely technical summaries:

```text
Homography succeeded on 83% of inputs and ONNX confidence averaged 0.71.
```

Technical details can go in an appendix, but the main result should answer whether ScanGrade helps the classroom workflow.

## Codex Guardrails

- Do not call a result `Green` just because the app did not crash.
- Do not call a result `Red` from one bad photo if the classroom flow is still promising.
- Separate student-writing problems from worksheet-design problems.
- Separate worksheet-design problems from OCR/model problems.
- Never hide confident wrong answers inside aggregate success rates.
- Do not recommend marketing claims from this scorecard alone.
