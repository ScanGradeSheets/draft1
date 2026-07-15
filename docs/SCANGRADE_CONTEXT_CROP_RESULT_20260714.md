# ScanGrade expanded-context crop result — 2026-07-14

## Verdict

Retain a larger, untouched grayscale crop as an **on-demand local review step** for yellow answers. It must not participate in automatic transcription or grading, and it must not alter the initial browser/compact choice list.

When the teacher taps **None of these**, the app checks the wider crop with the small local compact reader first. If that creates a new visible choice, the UI shows it and defers the strong reader. If it adds nothing, the same action continues to the existing one-question/three-frame strong fallback. A second tap remains available when the new local choices are also wrong.

## Why this design

Visual audit confirmed that some legacy 28×28 or tightly bounded crops lose real pencil strokes. The clearest retained example is P03 number-bond Q1: the wider image preserves the written `9`, and the compact reader supplies `9` as a choice.

The larger crop is not universally better. Across 275 scorable recent answers, compact top-1 correctness fell from 107 on the primary layout-anchored crop to 80 on the expanded crop; top-three union improved from 158 to 185. It is complementary evidence, not a replacement representation.

Generic edge/containment detection was rejected. Printed rules and worksheet structure made the raw detector flag about 68% of nondevelopment answers, and attempted template suppression was worse. No crop-failure flag was added to automatic policy.

## Exact UI acceptance result

Matched control without the wider on-demand step:

- 40 pages, 107 yellow answers, 104 scorable.
- Truth immediately tappable: 88/104 (84.6%).
- Truth available after teacher-triggered fallback: 90/104 (86.5%).
- Strong requests: 16 questions / 48 frames.

Final on-demand expanded-context workflow:

- Truth immediately tappable remains 88/104 (84.6%).
- Truth available after teacher-triggered fallback: 91/104 (87.5%).
- Strong requests: 15 questions / 45 frames.
- One known non-row crop failure was resolved locally and avoided a strong request.
- Every automatic OCR/grade signature was preserved on 40/40 pages.
- Existing initial choices removed: 0.
- Manual input remained available for every yellow answer.
- No answer key was sent to either reader.

This is a safe but modest gain. It does not justify an automatic-coverage claim.

## Important failed integration

Sending primary and expanded crops together in the immediate compact request changed a primary candidate list on P02. Even though automatic grading was unchanged, one previously visible correct review choice disappeared. The mixed-batch design was rejected.

The final design generates context evidence after automatic browser decisions are frozen and does not infer on it until teacher action. This preserves the initial review experience exactly.

## Evidence and reproduction

- Offline recent-packet crop comparison: `private-evidence/reports/v3-context-crop-recent-packets-20260714.json`
- Historical containment comparison: `private-evidence/reports/v3-context-crop-containment-20260714.json`
- Matched no-context UI control: `private-evidence/reports/v3-local-first-context-ab-baseline-ui-20260714.json`
- Targeted known rescue: `private-evidence/reports/v3-context-ondemand-p03-bonds.json`
- Final 40-page UI replay: `private-evidence/reports/v3-context-ondemand-full-ui-20260714.json`
- Offline evaluators: `scripts/evaluate_context_crop_containment.mjs`, `scripts/evaluate_context_crop_recent_packets.mjs`
- Exact UI evaluator: `scripts/evaluate_local_first_all_yellows_ui.mjs`

Focused JavaScript tests pass (18/18), and the production build passes. Nothing was deployed or pushed.
