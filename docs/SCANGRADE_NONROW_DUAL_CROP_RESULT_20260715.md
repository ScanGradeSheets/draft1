# ScanGrade non-row dual-crop result — 2026-07-15

## Verdict

Adopt this as **private candidate 3**, but keep it off by default until Tony explicitly authorizes deployment. It improves the frozen evidence-pipeline candidate from 234/275 to 237/275 automatic answers while preserving zero observed automatic transcription errors. The gain is real but modest; the remaining number-bond failures are mainly recognition instability and model disagreement, not a single crop defect that can safely be patched away.

## Immutable control

- Score: `private-evidence/reports/evidence-pipeline-final-score-20260714.json`
- 40 pages; 275 scorable answers
- 234 automatic (85.1%); 234/234 correct
- Rows: 144/160 (90.0%)
- Non-row: 90/115 (78.3%)
- Number bonds: 11/22 (50.0%)

## Experiments

1. **Separate physical-slot strong recognition:** rejected. It scored 49/115 non-row answers correctly and recovered only 1/11 number-bond yellows. Individual-slot crops removed useful whole-answer context.
2. **Raw crop-variant screen:** informative but unsafe as a selector. Trimming 4% from all edges scored 106/115 non-row answers, but produced four high-confidence wrong reads. A number-bond crop shifted down 4% scored 20/22, but included `17→1717`. These variants cannot grade on confidence alone.
3. **Conservative two-crop/six-read consensus:** retained. A yellow answer can be promoted only when the primary crop and a layout-specific alternate crop each produce the same exact answer on all three retained frames, with minimum per-frame confidence 0.70. Existing length, ambiguity, browser-conflict, and confidence-safety vetoes remain dominant. The answer key is absent from the decision.

Number bonds use an answer-zone crop shifted down by 4% of the physical slot height. Ten frames, dot collections, number patterns, and place value use a 4% interior trim. Row layouts retain their original pixels and policy.

## Exact 40-page result

- Score: `private-evidence/reports/nonrow-combined-private-candidate-score-20260715.json`
- 40/40 pages completed; 280/280 answer groups present
- 275 scorable; five ambiguous labels excluded
- 237 automatic (86.2%); **237/237 correct; zero observed wrong**
- 38 manual-review answers
- Rows: 144/160 (90.0%), unchanged
- Non-row: 93/115 (80.9%), up from 90/115
- Number bonds: 13/22 (59.1%), up from 11/22
- Place value: 19/22 (86.4%), up from 18/22
- Ten frames 22/23, dots 20/24, and number patterns 19/24 were unchanged
- All automatic annotations were consistent and every page produced a marked sheet

The three new automatic answers were two number bonds and one place-value answer. No pre-existing automatic output changed and no row answer changed.

## Reproducibility

A second independent replay of all 20 non-row pages produced the same 93/115 automatic result and zero errors. Exact comparison found 20/20 pages identical on retained browser inputs, probabilities, selected digits, answer groups, safety vetoes, alternate-crop reads, consensus decisions, and final applications.

The complete JavaScript suite passed 105/105 and the production build passed. Historical one-frame stress is unchanged and cannot exercise this new rule because the historical corpus does not contain the required three retained frames, much less two crops across those frames.

## Remaining non-row review taxonomy

Twenty-two scorable non-row answers remain yellow:

- 11: the larger grayscale reader does not give the same answer on all three frames
- 7: the three-frame larger reader proposes an answer that the independent compact reader does not support
- 3: an existing confidence-safety veto correctly dominates apparent agreement
- 1: the browser's preprocessing evidence stably conflicts with the proposed answer

By layout: 9 number bonds, 5 number patterns, 4 dot collections, 3 place-value answers, and 1 ten-frame answer.

The nine remaining number bonds comprise six cross-frame instabilities, two confidence-safety vetoes, and one independent-model disagreement. These should remain yellow. Loosening any of those gates would reintroduce the demonstrated duplicated, overwritten, and high-confidence-conflict failure modes.

## Rollback and freeze

- Feature flags: `v3NumberBondShiftDown=1` and `v3NonrowTrimEvidence=1`, together with the existing private consensus flags
- Both are off by default
- Disabling either flag restores the prior crop evidence for its layouts
- Freeze manifest: `private-evidence/protocols/nonrow-dual-crop-candidate-freeze-20260715.json`
- Manifest verification: 59/59 files match
- Nothing was deployed, committed, or pushed

## Recommendation

Replace candidate 2 with candidate 3 for the next private test. Do not describe 86.2% as a general accuracy rate: these four packets and templates were used during development. The next meaningful proof must come from genuinely untouched students/packets or a prospective private-beta stream. Further post-hoc threshold loosening on these packets is unlikely to be trustworthy.
