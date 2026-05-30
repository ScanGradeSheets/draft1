# Open-Divider Sample Answer Keys

Created 2026-05-30 for the current Grade 2 open-divider classroom test packet.

Use this when scoring Tony's real student samples. It keeps the expected answers and digit-level keys in one easy place.

## Current Sheets

### Sheet A: Addition Within 20

Template/layout:

- `g2-add-within-20-v1`
- `layouts/g2-add-within-20-v1.json`

Question answers:

| Question | Problem | Answer | Digit cells |
| ---: | --- | ---: | --- |
| 1 | 8 + 7 | 15 | 1, 5 |
| 2 | 9 + 6 | 15 | 1, 5 |
| 3 | 12 + 5 | 17 | 1, 7 |
| 4 | 4 + 9 | 13 | 1, 3 |
| 5 | 11 + 8 | 19 | 1, 9 |
| 6 | 7 + 4 | 11 | 1, 1 |
| 7 | 6 + 6 | 12 | 1, 2 |
| 8 | 13 + 4 | 17 | 1, 7 |
| 9 | 5 + 8 | 13 | 1, 3 |
| 10 | 10 + 9 | 19 | 1, 9 |

Digit-level key:

```text
1,5,1,5,1,7,1,3,1,9,1,1,1,2,1,7,1,3,1,9
```

### Sheet B: Subtraction Within 20

Template/layout:

- `g2-sub-within-20-v1`
- `layouts/g2-sub-within-20-v1.json`

Question answers:

| Question | Problem | Answer | Digit cells |
| ---: | --- | ---: | --- |
| 1 | 20 - 3 | 17 | 1, 7 |
| 2 | 19 - 4 | 15 | 1, 5 |
| 3 | 18 - 6 | 12 | 1, 2 |
| 4 | 17 - 5 | 12 | 1, 2 |
| 5 | 16 - 4 | 12 | 1, 2 |
| 6 | 15 - 3 | 12 | 1, 2 |
| 7 | 20 - 8 | 12 | 1, 2 |
| 8 | 19 - 7 | 12 | 1, 2 |
| 9 | 18 - 4 | 14 | 1, 4 |
| 10 | 17 - 6 | 11 | 1, 1 |

Digit-level key:

```text
1,7,1,5,1,2,1,2,1,2,1,2,1,2,1,2,1,4,1,1
```

### Sheet C: Mixed Within 50

Template/layout:

- `g2-mixed-within-50-v1`
- `layouts/g2-mixed-within-50-v1.json`

Question answers:

| Question | Problem | Answer | Digit cells |
| ---: | --- | ---: | --- |
| 1 | 23 + 14 | 37 | 3, 7 |
| 2 | 48 - 19 | 29 | 2, 9 |
| 3 | 16 + 27 | 43 | 4, 3 |
| 4 | 50 - 22 | 28 | 2, 8 |
| 5 | 34 + 8 | 42 | 4, 2 |
| 6 | 41 - 16 | 25 | 2, 5 |
| 7 | 19 + 18 | 37 | 3, 7 |
| 8 | 45 - 7 | 38 | 3, 8 |
| 9 | 26 + 15 | 41 | 4, 1 |
| 10 | 39 - 24 | 15 | 1, 5 |

Digit-level key:

```text
3,7,2,9,4,3,2,8,4,2,2,5,3,7,3,8,4,1,1,5
```

## Evaluation Notes

The current open-divider sheets use 20 digit cells for 10 two-digit answers.

If a script expects 10 single-digit answers, do not use it to score these sheets directly. Use it only for smoke fixtures or update the command/process to score the 20 digit cells from the current layout.

When using `eval:uploaded-worksheets`, run one sheet type at a time and pass the digit-level key if the script path being used supports 20 expected digits. If the script only accepts 10 expected digits, report recognition output without scoring correctness and do not treat the score as authoritative.

## Safe First-Pass Interpretation

For real student samples, correctness is only one part of the story.

Also record:

- whether the page was detected
- whether the QR/layout was detected
- whether digit crops align with student writing
- whether the predicted digits are plausible by eye
- whether uncertainty/review behavior would help Tony
- whether the student writing suggests worksheet-design changes

