# Student Sample Evaluation Report Template

Use this when Tony sends completed open-divider worksheet photos/scans.

Date:

Evaluator:

Sample folder:

## Plain-English Result

- Overall outcome:
- Can this support the next small classroom pilot?
- Teacher trust scorecard:
- Biggest blocker, if any:
- Recommended next action:

Use `docs/TEACHER_TRUST_SCORECARD.md` to keep the rating focused on classroom trust instead of raw OCR numbers.

## Inputs

| File | Sheet | Photo quality | Student writing notes | Included in test? |
| --- | --- | --- | --- | --- |
| `sheet-a-student-01.jpg` | Addition Within 20 | | | |
| `sheet-b-student-01.jpg` | Subtraction Within 20 | | | |
| `sheet-c-student-01.jpg` | Mixed Within 50 | | | |

Photo quality notes should mention blur, shadows, page crop, corner visibility, rotation, and whether the answer boxes are readable by eye.

## Commands Run

```bash
npm run inspect:uploaded-worksheet -- "worksheet photos/student-samples/open-divider-2026-05/sheet-a-student-01.jpg"
npm run eval:uploaded-worksheets -- "worksheet photos/student-samples/open-divider-2026-05/"*.jpg
npm run dataset:student-samples
```

Record exact commands if paths differ.

## Results By Sheet

| Sheet | Detected boxes | Recognized digits | Correct cells | Perfect sheet? | Main failure mode |
| --- | ---: | ---: | ---: | --- | --- |
| A | | | | | |
| B | | | | | |
| C | | | | | |

## Failure Categories

Mark each category as `none`, `minor`, or `major`.

| Category | Severity | Evidence |
| --- | --- | --- |
| Page/corner detection | | |
| Homography/warping | | |
| Answer-box crop alignment | | |
| Digit segmentation | | |
| Digit recognition/model confidence | | |
| Multi-digit answer handling | | |
| iPad-specific capture issue | | |
| Teacher review/export issue | | |

## Evidence To Preserve

- Original uploaded files:
- Debug JSON:
- Crop exports:
- Console/test output:
- Any screenshots:

Do not commit student-identifiable images without a privacy decision. Preserve locally or in the agreed external backup location.

## Decision

Choose one:

- Proceed to small iPad classroom pilot.
- Keep worksheet design but tune OCR/crop/model with this evidence.
- Adjust worksheet layout/answer boxes before more samples.
- Pause app changes and gather more samples.

Reason:

## Teacher Trust Scorecard

| Area | Rating | Evidence |
| --- | --- | --- |
| Page scan success | | |
| Worksheet usability | | |
| Answer crop quality | | |
| Digit recognition | | |
| Uncertainty handling | | |
| Teacher review speed | | |
| Student independence | | |
| Classroom fit | | |

## Codex Guardrails

- Do not change OCR/capture/homography logic until the failure mode is tied to this evidence.
- Prefer a tiny reproducible test or replay case before any production patch.
- If results are mixed, explain what Tony would experience in class, not just what the logs say.
