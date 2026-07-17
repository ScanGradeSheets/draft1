# ScanGrade Browser-Only Yellow-Gap Audit — 2026-07-16

## Verdict

The browser-only yellow gap is **not primarily a bad-camera-image problem**. On the exact four-packet, 275-answer corpus, browser-only ScanGrade automatically accepts 176/275 answers (64.0%), with 176/176 correct and zero observed confident transcription errors. It sends 99/275 (36.0%) to review.

Most of those 99 answers contain usable handwriting information. The adapted large-grayscale reader transcribed 87/99 correctly. The browser's answer was already correct in 17/99. A coherent named browser preprocessing variant produced the complete correct answer in 55/99, and the correct digit appeared as a top choice in some preprocessing variant for every slot in 92/99. The bottleneck is therefore largely the browser's lossy 28×28 representation, model/selector disagreement, and conservative safety policy—not missing pencil information in the original camera frame.

This audit does **not** justify loosening the safety policy. Every tested simple local promotion rule accepted known wrong transcriptions when challenged on older validation and holdout scans.

## Exact reconstruction

Source: `private-evidence/reports/shared-frame-deferred-score-20260715.json`, joined back to the saved debug artifact for every answer.

| Cohort | Answers | Share | Correct among automatic |
|---|---:|---:|---:|
| Browser automatic | 176 | 64.0% | 176/176 |
| Browser yellow | 99 | 36.0% | n/a |
| Mac-assisted promotions from those yellows | 74 | 26.9% of all answers | 74/74 |
| Still yellow after the Mac-assisted candidate | 25 | 9.1% of all answers | n/a |

The often-used “about 70% without the Mac” description is reasonable as a broad historical summary, but the exact current four-packet reconstruction is 64.0%. Older non-development scans were 69.2% automatic. These are different corpora and must not be blended into one claimed benchmark.

## Mutually exclusive explanation of the 99 browser yellows

| Observable evidence state | Count | What it means |
|---|---:|---|
| Browser read was correct, but safety policy required review | 17 | Recognition was already right; the system lacked enough independent evidence to trust it automatically. One of these also conflicted with the large reader, illustrating why the veto matters. |
| Browser read wrong; large grayscale correct; a coherent browser preprocessing variant also correct | 37 | The pixels and even a correct browser candidate existed. Candidate selection/disagreement is the immediate bottleneck. |
| Browser read wrong; large grayscale correct; no coherent browser variant correct | 34 | The saved grayscale contains the answer, but the 28×28 conversion and small digit reader do not preserve/use it reliably. |
| Browser read wrong; large grayscale wrong; coherent browser variant correct | 6 | Layout/crop/slot interference or ambiguity confuses model families even though one browser conversion happens to contain the truth. Choosing that conversion retrospectively is unsafe. |
| Browser read wrong; large grayscale wrong; no coherent browser variant correct | 5 | Hardest cases: clipped/contaminated slots, optional-slot errors, severe ambiguity, or genuine recognition failure. |

These five rows sum to all 99 browser yellows.

## Is crop or capture quality the general separator?

No.

- Thirty-five of 40 pages contain both automatic and yellow answers from the **same captured page**. Four pages are all automatic and one page—P08 number bonds—is all yellow. Page-level blur, lighting, perspective, or device quality therefore cannot explain most answer-level differences.
- Every measured answer-zone quality statistic was close to random at distinguishing yellow from automatic. Rank AUC values ranged from 0.459 to 0.538, where 0.5 is no separation. Contrast, dark clipping, ink fraction, edge magnitude, sharpness, illumination range, weak-variant ratio, artifact ratio, and edge ink did not provide a useful general gate.
- Median zone sharpness and contrast were slightly *higher*, not lower, among yellows. That does not mean the yellow crops are better; it means these simple quality measurements are not the cause classifier.
- The saved recent debug artifacts do not contain a usable per-answer camera focus metric. However, the within-page matched comparison above removes most page-level capture confounding.

The visual audit of all 99 answers agrees with the statistics. In many cases the gray cell is plainly readable while the 28×28 black image has lost faint pencil, gained a printed border, or converted a blank optional slot into a digit-like artifact.

## Where crop/layout really does matter

Crop and slot metadata are still important in a concentrated subset:

- Row layouts: 113/160 automatic (70.6%).
- Non-row layouts: 63/115 automatic (54.8%).
- Number bonds: 7/22 automatic (31.8%), the worst layout.
- P08 number bonds: 0/6 automatic on one page.

The difficult large-reader misses concentrate in number bonds and optional-slot layouts. Their crops visibly include printed bond frames/bottom lines, clip part of the student's mark, or treat a blank optional slot as a leading digit. The overwritten P09 `34` is genuinely ambiguous and correctly remains yellow.

However, layout-specific alternate preprocessing is not yet a safe fix. On browser-yellow number bonds, the best stored named preprocessing variants read only 5/15 correctly. Prior fixed/projection frame-removal variants reduced P08 row accuracy from 32/40 to 22–28/40, and a number-bond downward crop produced duplicated readings such as `17→1717`. Destructive line removal can erase pencil along with print.

## What handwriting/answer characteristics matter

- One-digit answers: 69/100 automatic (69.0%).
- Two-digit answers: 107/175 automatic (61.1%).
- Answers containing `0`, `3`, or `9` had the lowest observed answer-level automatic rates (about 48–50%). Answers containing `8` were highest (78.6%). These are descriptive, not independent causal estimates, because answers may contain two digits and layouts differ.
- Two-digit answers suffer both per-digit recognition risk and slot-contract risk. A faint or empty optional slot can become an extra digit; a border can be read as `1`; and independent digit errors compound.

## Local-only rescue experiments

### Simple browser preprocessing consensus

Rejected. Majority vote, named-variant consensus, support count, confidence, and margin gates did not produce a meaningful zero-error rescue set. Correct variants exist often, but wrong variants can agree confidently too.

### Browser plus compact grayscale exact agreement

On the four recent packets, restricting exact agreement to arithmetic row layouts appeared to rescue 9/34 eligible yellows, all nine correct. The broader historical falsification reversed that result:

| Corpus | Selected | Correct | Wrong |
|---|---:|---:|---:|
| Four recent packets, arithmetic rows | 9 | 9 | 0 |
| All historical arithmetic-row yellows | 14 | 11 | 3 |
| Historical validation + holdout only | 5 | 2 | 3 |

The rule is rejected. The two local readers share errors, so agreement is not independent proof.

### Larger free compact model

Already rejected as an automatic replacement. The best 6.4 MB stitched-evidence model reached 196/275 (71.3%) under packet-held-out cross-validation. It is fast enough for browser use, but not accurate or calibrated enough. Wrong reads remain highly confident. Browser-canvas versus Python resizing also changed two decisions, so future training must use the exact browser rendering path.

### Destructive print/border cleanup

Already rejected. It helps selected examples but damages others and does not generalize. The app should preserve the original grayscale evidence and learn to interpret printed structure rather than erase it aggressively.

## What can safely change now?

No automatic grading-policy change passed the zero-known-error requirement. Candidate 6 remains unchanged.

The productive technical direction is narrower and clearer than before:

1. Treat the larger grayscale answer zone as the primary browser-local input. Do not ask a 28×28 binary thumbnail to carry the whole decision.
2. Train a materially stronger whole-answer client model on the exact browser-rendered tensors, with packet-separated evaluation. Include the worksheet's physical slot count and an explicit blank/optional-slot head.
3. Build a number-bond-specific evidence contract: separate handwriting mask, printed-structure mask, expected slot count, and a larger unclipped context view. Test it across all known packets before changing production crops.
4. Keep the current 28×28 digit reader as supporting evidence. Require genuinely independent agreement; do not promote merely because two similarly trained local models agree.
5. Preserve the 17 safety-blocked correct reads as research targets, not automatic wins. A live system does not know which of them are correct.

The strongest plausible no-Mac architecture is therefore a browser-local whole-answer model over the preserved grayscale zone plus layout/slot metadata, with the existing digit model as a cross-check. The attempted 6.4 MB model is not strong enough; this requires a better architecture and exact-input training, not another threshold tweak.

## Evidence files

- `private-evidence/reports/browser-only-gap-audit-20260716.json`
- `private-evidence/reports/browser-only-yellow-visual-audit-20260716/yellow-audit.json`
- `private-evidence/reports/browser-only-yellow-visual-audit-20260716/yellow-contact-01.jpg` through `yellow-contact-15.jpg`
- `private-evidence/reports/browser-compact-agreement-falsification-20260716.json`
- `scripts/analyze_browser_only_gap.mjs`
- `scripts/audit_browser_compact_agreement_history.mjs`

## Limitations

- This is a retrospective audit of known packets, not a prospective launch claim.
- The large reader's correctness is evidence that its supplied image contained useful information; it is not proof that every pixel loss occurred specifically at one preprocessing line.
- The paper-to-camera step cannot be measured exactly because no lossless scan of the physical paper exists for these captures.
- P05 remains sealed and unused. It should not be spent merely to retest a local rule already falsified by historical holdout scans.
