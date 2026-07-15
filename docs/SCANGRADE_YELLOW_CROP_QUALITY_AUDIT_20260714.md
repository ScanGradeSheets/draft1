# ScanGrade yellow-answer crop and image-quality audit — 2026-07-14

## Question

Are the fourteen yellow answers in the matched review replay primarily difficult handwriting/model failures, or is usable information being lost in capture, geometry, cropping, or preprocessing?

## Verdict

The original phone captures are not the main problem in this set. All fourteen handwritten answers are readable on the saved page photographs. Nine of the ten affected pages passed the stricter preferred-perspective measurements; the one exception still has a visibly clear target answer. Focus scores for the affected pages were within the accepted range, and none of the fourteen is primarily a blur, lighting, or camera-resolution failure.

Information is nevertheless being lost after capture:

- Two of fourteen yellow answers have a definite answer-zone/crop failure: the handwriting is clear on the page, but the saved local crop and selected continuous crop are essentially blank.
- At least eight of fourteen show material damage in the 28×28 local model representation: useful loops, top strokes, tails, or long strokes visible in the raw crop become faint, disconnected, or dominated by the printed box border.
- Several failures are mixed cases in which a young writer places a stroke on or beyond the answer-box border. The camera captured the stroke, but border removal and normalization then discard part of it.
- Only a small remainder look like predominantly recognition/ranking failures on a crop that remains reasonably informative through preprocessing.

These categories overlap; the counts must not be added as if they were mutually exclusive.

## Answer-by-answer audit

| Packet / worksheet / question | Truth | Visual diagnosis | Primary failure class |
|---|---:|---|---|
| P08 add-1digit Q2 | 6 | Raw crop is clear. The model view weakens the loop and lower curve. | Preprocessing plus recognition |
| P08 add-1digit Q5 | 6 | The page clearly shows 6, but both the saved local crop and selected continuous crop are blank/misaligned. Other retained evidence recovered 6. | Definite crop/geometry failure |
| P08 add-1digit Q8 | 7 | Raw 7 is clear; the model view turns it into sparse, partly disconnected strokes. | Preprocessing fidelity |
| P03 add-1digit Q4 | 9 | Raw 9 is very clear; the normalized view largely loses its tail. | Preprocessing fidelity |
| P03 add-2digit Q4 | 15 | Both raw digits are present. Printed boundaries and masking distort both normalized cells. | Border/preprocessing interference |
| P03 sub-1digit Q5 | 5 | A stylized but readable 5 is present; the normalized view loses much of the top and lower continuity. | Handwriting plus preprocessing |
| P03 mixed Q4 | 9 | Raw and whole-answer crops show the 9. The browser's candidate selection returned an unrelated two-digit reading. | Recognition/selection failure |
| P09 sub-1digit Q2 | 6 | The 6 extends through the lower box line. The crop contains it, but normalization retains little of the loop. | Writing/box collision plus preprocessing |
| P09 sub-1digit Q3 | 7 | The 7 extends below the box. Raw crop is readable; normalized strokes are disconnected. | Writing/box collision plus preprocessing |
| P09 mixed Q4 | 9 | The 9 is clearly visible in the right cell and remains visible in the crop. | Recognition/selection failure |
| P02 add-2digit Q2 | 12 | Raw 1 and 2 are clear, though the 1 is roofed. Printed lines dominate the normalized cells. | Border/preprocessing plus writer style |
| P02 sub-2digit Q2 | 15 | Raw 1 and 5 are clear. The normalized 1/5 lose important shape information. | Border/preprocessing plus writer style |
| P02 sub-2digit Q8 | 18 | Raw 1 and 8 are clear. The 1 is weakly represented and a box edge remains beside the 8. | Preprocessing plus recognition |
| P02 mixed Q4 | 9 | The page clearly shows 9, but both local digit crops and the selected continuous crop are blank/misaligned. | Definite crop/geometry failure |

## What this means

“The model is not strong enough” is an incomplete diagnosis. For this yellow set, the camera usually captured enough information. The more immediate local-OCR problems are:

1. answer-zone localization occasionally misses a clearly written answer;
2. printed box borders and cleanup masks compete with pencil strokes;
3. downscaling to 28×28 sometimes removes defining stroke structure;
4. the recognizer/ranker then has to guess from an unnecessarily degraded representation.

The strong whole-answer reader succeeds partly because it sees a larger continuous grayscale crop instead of only the destructive 28×28 cell representation. That does not make crop quality irrelevant: the two blank/misaligned cases show that a better model cannot recover pixels it never receives.

## Recommended next experiment

Do not change the frozen automatic recognition policy yet. Build a review-only crop-quality gate that compares each yellow answer's local cell crop with its continuous whole-answer crop and page-aligned expected zone. For obvious empty/misaligned crops, regenerate a layout-anchored crop from the pristine warp and send both views only to the review model. For the remaining yellow answers, test a non-destructive higher-resolution local representation that keeps the pencil strokes while suppressing box borders conservatively.

The acceptance gate should be measured on all existing packets:

- no change to local green/red/yellow grading;
- no disappearance of an existing correct review choice;
- fewer blank/misaligned yellow crops;
- more yellow answers with handwritten truth among review choices;
- no new unsafe automatic decisions.

This audit made no production behavior change. It used handwritten truth only for scoring and did not use the mathematical answer key to alter recognition.
