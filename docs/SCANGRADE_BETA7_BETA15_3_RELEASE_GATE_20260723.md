# ScanGrade Beta 7 / Beta 15.3 Release Gate

Date: 2026-07-23

## Decision

**Beta 7 fails the recognition safety gate and must not be deployed.** Beta 15.3's correction interface passes the requested phone and old-iPad checks and may be frozen as the current public interaction design, but the current recognition result is not safe enough for an automatic-grading claim.

No mathematical answer key was used as handwriting truth or supplied to either recognition policy.

## Evidence boundary

The exact paired policy audit contains every canonical saved sheet for which the predecessor and Beta 7 have the same retained multi-frame/compact evidence and independently recorded handwriting truth:

- 50 sheets from P02, P03, P05, P08, and P09;
- 350 answer locations;
- 345 scorable handwritten answers;
- five predeclared ambiguous answers excluded from accuracy denominators.

The older historical corpus contains another 582 hand-labelled answers from 86 saved sheets. It is useful as a one-frame browser-control stress set, but it does not contain the multi-frame and compact evidence needed to reproduce Beta 7. It is therefore reported separately rather than silently mixed into the paired result.

## Paired recognition result

| Metric | Frozen predecessor | Beta 7 |
|---|---:|---:|
| Displayed transcription correct | 297/345 (86.1%) | 294/345 (85.2%) |
| Confident automatic coverage | 315/345 (91.3%) | 273/345 (79.1%) |
| Correct confident reads | 295 | 253 |
| Accuracy among confident reads | 93.7% | 92.7% |
| Known confident transcription errors | 20 | 20 |
| Yellow/manual review | 30/345 (8.7%) | 72/345 (20.9%) |

Beta 7 lost 42 automatic decisions, reduced coverage by 12.2 percentage points, and removed none of the 20 confident errors.

### By packet / student

| Packet | Beta 7 coverage | Confident errors | Yellow rate |
|---|---:|---:|---:|
| P02 | 42/68 (61.8%) | 0 | 38.2% |
| P03 | 53/67 (79.1%) | 0 | 20.9% |
| P05 | 63/70 (90.0%) | 20 | 10.0% |
| P08 | 54/70 (77.1%) | 0 | 22.9% |
| P09 | 61/70 (87.1%) | 0 | 12.9% |

The aggregate is dominated by a severe packet-level failure: P05 looks highly automatic while only 43 of its 63 confident reads match the handwriting.

### By layout and answer length

| Cohort | Beta 7 coverage | Confident accuracy | Confident errors |
|---|---:|---:|---:|
| Row | 170/200 (85.0%) | 94.7% | 9 |
| Non-row | 103/145 (71.0%) | 89.3% | 11 |
| One digit | 100/126 (79.4%) | 98.0% | 2 |
| Two digits | 173/219 (79.0%) | 89.6% | 18 |

### By capture quality

| Capture label | Beta 7 coverage | Confident accuracy | Confident errors |
|---|---:|---:|---:|
| Good | 93/117 (79.5%) | 100.0% | 0 |
| Fair | 109/132 (82.6%) | 89.0% | 12 |
| Poor | 71/96 (74.0%) | 88.7% | 8 |

Capture quality matters, but it is not the only problem: fair captures produced more confident errors than poor captures, and the policy did not use its additional disagreement evidence to stop those errors.

## Historical one-frame control

The separately preserved historical control contains 582 hand-labelled answers:

- 308 automatic (52.9% coverage);
- 307 correct automatic reads;
- one known confident error;
- 274 yellow/manual-review answers.

This is not a Beta 7 score because the necessary retained evidence does not exist. It confirms that the newest five-packet result cannot be replaced with an older, more favorable summary.

## Integrity and reproducibility

- Identical-input replay was deterministic for all 350 paired answer locations.
- Frozen predecessor decisions matched saved decisions: 350/350.
- Beta 7 decisions matched saved decisions: 350/350.
- Duplicate selected-evidence groups: zero.
- Answer-key fields passed to policy: false.
- Handwriting-truth fields passed to policy: false.

## Visual investigation

Every one of the 42 changed decisions and every one of the 20 confident errors was inspected on the saved page image and answer zone.

- All 42 changes were correct predecessor automatic reads that Beta 7 unnecessarily turned yellow.
- All 20 confident errors were genuine transcription errors, not answer-key disagreements or label mistakes.
- The errors include `12→15`, `19→49`, `14→11`, `17→19`, `20→29`, `6→0`, `11→12`, `16→15`, `12→11`, `16→11`, `18→10`, `7→91`, `14→19`, `13→12`, `14→11`, `17→96`, `40→42`, `34→32`, `30→21`, and `47→17`.

The broad display-veto path is the immediate regression: it forces review whenever sequence and compact readers agree against the slot reader, including after a safe promotion already succeeded. The 20 dangerous P05 reads remain because already-automatic browser reads bypass the consensus-promotion lane entirely.

## Narrowest safe technical revision

1. Do not apply the broad display veto after a promotion has passed all safety gates.
2. Restrict that veto to explicit safety conflicts or failed promotions with unresolved independent-reader disagreement.
3. Add a separate risk-triggered second-reader veto for already-automatic answers. It may only demote to yellow; it must never rewrite toward the mathematical key.
4. Validate that new rule on prospective packets. Do not tune it until it clears these 20 known examples and then call the same corpus validation.

## Beta 15.3 interface verification

Public build tested: `2026.07.18-empty-save-beta-15-3`.

Saved worksheets were exercised at a current-phone viewport (390×844) and a five-year-old-iPad viewport (1024×1366).

| Required behavior | Phone | Old-iPad profile |
|---|---|---|
| Empty optional slots are not yellow | Pass | Pass |
| Correction field begins empty and focused | Pass | Pass |
| Empty + Save records blank | Pass | Pass |
| Single digit enters the intended physical slot | Pass | Pass |
| Blue readings remain behind correction panel | Pass | Pass |
| Marks remain inside their answer/annotation zones | Pass | Pass |
| Fixed, non-scrolling scan workspace | Pass | Pass |
| Active answer remains visible while correcting | Pass | Pass |

Automated verification also passed:

- focused correction/annotation checks: 35/35;
- complete test suite: 180/180;
- production build: pass;
- GitHub/public build: pass;
- live `https://scangrade.io` smoke test: pass.

This verifies the correction interaction and geometry on saved evidence. It does not prove sustained camera, memory, thermal, or multi-page stability on the physical old iPad.

## Interface freeze

Beta 15.3 is the correction-interface control. Further changes require a reproducible saved-sheet test covering optional blanks, empty correction, slot placement, overlay layering, mark geometry, phone viewport, and old-iPad viewport. Recognition-policy changes remain separately gated.

## Product decision

- Preserve the remaining untouched student packets.
- Do not spend them on incremental threshold tuning.
- Soft-launch only a small ScanGrade-authored worksheet beta with prominent teacher review.
- Use September classroom work as the decisive prospective validation.
- Keep the 84 MB whole-answer model as a later second-reader experiment. Its approximately 89% packet-held-out top-1 result is promising, but its confidence and old-iPad sustained performance are not launch-safe.
