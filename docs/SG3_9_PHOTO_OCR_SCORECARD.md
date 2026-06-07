# SG3 9-Photo OCR Confidence Scorecard

Created: 2026-06-06

Purpose:
This scorecard is the active truth set for the SG 3 OCR confidence pass. It separates what the student visibly wrote from whether the answer is mathematically correct. Use it before tuning confidence or review gates.

Private images:

```text
private-evidence/sg3-9-photo-confidence-20260606/
```

That folder is ignored by git. Do not force-add it.

## Target

- Confident-read coverage: at least 95%.
- Accuracy on confident reads: 100% against handwritten truth.
- Confident wrong reads: 0.
- Answer-key correctness is tracked separately from OCR truth.

## Template Answer Keys

| Template | Code | Answer key |
| --- | --- | --- |
| Addition Within 20 | `SG-G2-A-001` | `15,15,17,13,19,11,12,17,13,19` |
| Subtraction Within 20 | `SG-G2-B-001` | `17,15,12,12,12,12,12,12,14,11` |
| Mixed Within 50 | `SG-G2-C-001` | `37,29,43,28,42,25,37,38,41,15` |

## Handwritten Truth Draft

These labels come from visual inspection of the 9 raw worksheet photos. They should be treated as the handwritten-truth baseline unless a close crop proves a marked uncertainty wrong.

| Photo | Template | Handwritten truth | Notes |
| --- | --- | --- | --- |
| `1-Photo-1.jpg` | `SG-G2-A-001` | `15,15,17,13,19,11,12,17,13,19` | Clean addition sample. |
| `2-Photo-2.jpg` | `SG-G2-C-001` | `37,29,33,28,44,24,37,38,41,15` | Student wrote several math-wrong answers; OCR should read the handwriting, not the answer key. |
| `3-Photo-3.jpg` | `SG-G2-B-001` | `17,15,11,12,12,12,12,12,14,11` | Q3 appears to be handwritten `11`, not answer-key `12`. |
| `4-Photo-4.jpg` | `SG-G2-A-001` | `15,15,17,13,19,11,12,17,12,19` | Q9 visually reads as `12`; verify with crop if this becomes a decisive failure. |
| `5-Photo-5.jpg` | `SG-G2-B-001` | `17,16,13,12,13,13,12,12,16,12` | Many math-wrong answers; useful for OCR-vs-grading separation. |
| `6-Photo-6.jpg` | `SG-G2-B-001` | `17,15,12,12,12,12,12,12,14,11` | Q9 is overwritten/scribbled and may legitimately need review if uncertain. |
| `7-Photo-7.jpg` | `SG-G2-A-001` | `15,15,17,13,19,11,12,17,13,19` | Several digits touch dividers or box borders. |
| `8-Photo-8.jpg` | `SG-G2-C-001` | `37,29,33,38,44,24,37,38,41,15` | Q4 tens digit visually reads closer to `3` than `2`; verify with crop if decisive. |
| `9-Photo-9.jpg` | `SG-G2-C-001` | `37,29,33,38,44,24,37,38,41,15` | Similar mixed sample; Q4 appears to be `38`. |

## Next Benchmark Fields

For each photo, record:

```text
Predicted answers:
Confident answer count:
Review/low-confidence answer count:
Confident correct vs handwritten truth:
Confident wrong vs handwritten truth:
Answer-key correct count:
Notes on ambiguous crops:
```

Do not accept a patch that improves coverage by creating any confident wrong OCR read against this scorecard.
