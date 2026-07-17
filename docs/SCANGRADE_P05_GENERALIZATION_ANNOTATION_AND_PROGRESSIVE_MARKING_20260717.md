# ScanGrade P05 generalization, annotation, and progressive-marking result — 2026-07-17

## Decision

P05 disproved the assumption that the current Candidate 6 evidence selector generalizes near 90% safe automatic coverage to a new writer. Do not loosen the selector to recover that headline. Keep the Beta 7 conflict veto, ship the physical-box annotation repair after visual regression, and keep the new stitched-agreement rule in shadow until it has substantially more independent evidence.

## Authoritative performance boundary

- Frozen original P05: 48/70 automatic (68.6%), 48/48 transcriptions matching the handwriting audit, 22 yellow.
- Later full-debug P05 rescan before repair: 55/70 automatic, 54 matching and one confident transcription error.
- Beta 7 repaired counterfactual on that rescan: 54/70 automatic (77.1%), 54/54 matching, 16 yellow.
- Repaired rows: 34/40 (85.0%). Repaired non-rows: 20/30 (66.7%).
- Historical development result of 250/275 (90.9%) did not generalize prospectively and is not a launch-performance claim.

The original P05 scan remains the prospective measurement. All post-truth P05 experiments below are diagnostic development work and cannot turn P05 into a passing test.

## Where fidelity is and is not being lost

The chosen full-page captures are adequate. Inspection of the canonical warp, continuous grayscale answer zone, stitched slot image, 28×28 browser input, and final reader outputs shows:

- The continuous grayscale zones usually retain the pencil strokes needed by a human reader.
- The 28×28 digit path often removes shape detail and magnifies box-rule interference.
- The stitched physical-slot representation is not universally safer. On P05 it sometimes fragments a digit or gives printed slot structure too much influence, especially on tall one-box number bonds.
- Number-bond Q4 contains a complete handwritten `6` in its continuous crop, but the strong model reads `5`. Number-bond Q5 contains a complete `17`, but readers produce `1757` or `15`. These are recognition/print-interference failures, not missing-image failures.
- Reversed `9` shapes resembling a capital P recur in three repaired residuals. They are legitimate early-writer forms, but a global P-to-9 rule would be unsafe without writer-specific confirmation.

Conclusion: crop and representation quality matter, but the dominant P05 residual is model/selector generalization to this writer and layout—not capture blur or perspective.

## Matched strong-model view experiment

The adapted TrOCR service received only image identity and pixels; no answer key was sent.

| Evidence view | Correct | High-confidence result |
| --- | ---: | ---: |
| Continuous grayscale answer | 54/70 (77.1%) | 17/18 correct |
| Stitched physical slots | 42/70 (60.0%) | 18/18 correct |
| Oracle: either view correct | 59/70 (84.3%) | diagnostic only |

The readers agreed on 40 answers; 37 were right and three were wrong. Agreement between two views of the same image is correlated evidence and is not an independent safety guarantee. The stitched view that had helped earlier packets regressed sharply on P05, so it must not replace the continuous view globally.

## The 16 repaired residuals

The residuals divide into four actionable classes:

1. **Clear pixels, useful strong evidence, unsafe disagreement:** row Q8; mixed Q2/Q3; ten-frame Q4/Q6; dot Q3/Q5; number-bond Q3/Q6; number-pattern Q6. The correct read often exists in the frame sequence, but another model or preprocessing path disputes it.
2. **Clear pixels, current reader weakness:** row Q7; number-bond Q4/Q5; place-value Q3. A stronger or writer-adaptive recognizer is needed; enlarging the same crop alone does not solve these.
3. **Dangerous model-family conflict:** row Q6 (`17` read as `12`). This is the confident error Beta 7 now forces to review.
4. **Slot/length ambiguity:** mixed Q2 and several number-bond outputs show optional-slot or duplicated-digit behavior. Explicit length contracts prevent impossible outputs but do not identify the correct handwriting by themselves.

These classes overlap; the key distinction is that none justifies using the mathematical answer key as handwriting truth.

## Conservative selector probe

A shadow rule requiring at least two of three grayscale frames to agree **and** the stitched reader to match, while preserving all current ambiguity and safety vetoes, rescued:

- 3/3 tested historical yellows correctly; and
- 2/2 tested P05 residuals correctly.

Five successes are too few to authorize automatic grading. The broader three-frame rule can approach 90% on P05 but admits the known overwritten `34 -> 39` error on historical data. It is rejected. The narrow rule remains useful as a teacher-review suggestion and a prospective shadow candidate.

## Annotation placement repair

The former annotation resolver preferred template `expectedRect` before the physically detected `boxRect`. Across 120 P05 slot geometries, expected-to-physical center drift averaged 34.1 canonical pixels (0.27 box widths); 45 slots exceeded 0.25 box widths and 22 exceeded 0.5 box widths.

Annotations now anchor to `layoutBoxRect`/`boxRect` first, then fall back to refined, expected, or crop geometry. Two representative P05 visual replays place checks, X marks, and circles alongside the actual printed boxes. The existing deterministic small wobble, angle, and stroke variation remains, so marks look hand-drawn without wandering materially.

## Progressive marking safety contract

The student result now starts from the unmarked captured page and reveals the exact final annotation image one settled question at a time. This is both useful feedback and latency masking, but it is governed by these rules:

- A yellow/review answer is never animated as settled.
- No mark begins before the compact safety pass is ready.
- Any question still queued for stronger review is excluded from early animation.
- Promoted or vetoed answers appear only after the stronger pass has finalized them.
- Reduced-motion users receive the final page without animation.
- The final image remains the same deterministic annotation artifact used by the result and debug record.

This prevents the interface from briefly drawing a red or green mark that later disappears.

## Next evidence gate

Do not spend another untouched packet to tune a P05-specific rule. The next automatic-coverage change must first pass all opened historical packets, explicitly including overwritten/crossed-out digits and number bonds, with zero known confident errors. Then test it prospectively on an untouched packet. A writer-adaptive reversal profile is promising, but the first reversed digit must remain a teacher confirmation rather than an automatic assumption.

## Reproducibility

- Strong-view report: `private-evidence/reports/p05-strong-evidence-view-benchmark-20260717.json`
- Residual contact sheet: `private-evidence/reports/p05-repaired-residual-contact-sheet-20260717.png`
- Complete annotation replay: `private-evidence/reports/p05-annotation-physical-box-replay-b-20260717/`
- Visual annotation replay: `private-evidence/reports/p05-annotation-visual-replay-20260717/`
- Focused annotation/progressive tests plus the complete repository suite pass (135/135).
