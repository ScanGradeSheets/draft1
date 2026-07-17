# ScanGrade remaining-yellow audit — 2026-07-14

## Result

Every one of the 53 scorable answers left yellow by the frozen 222/275 consensus candidate was inspected across the primary grayscale answer crop, expanded context crop, browser cell crop, and 28×28 model input.

The dominant problem is not illegible handwriting. It is evidence selection: a readable large grayscale answer is often rejected because the compact/compressed reader or browser preprocessing disagrees.

| Visual root cause | Answers | Share of 53 |
|---|---:|---:|
| Readable crop; compact 28×28 reader is the bottleneck | 25 | 47% |
| Readable crop; frame-to-frame recognition is unstable | 11 | 21% |
| Crop or registration failure | 6 | 11% |
| Layout or slot-contract failure | 5 | 9% |
| Genuinely ambiguous handwriting | 3 | 6% |
| Browser preprocessing conflict | 2 | 4% |
| Confidence-safety veto | 1 | 2% |

The three genuinely ambiguous cases include the overwritten `34→39` example and should remain review. Crop/layout failures must not be solved by weakening confidence.

## Conservative rescue tested

Policy `consensus-promotion-shadow-2` adds one fallback lane. It can bypass a weak compact-model veto only when:

- exactly three retained large grayscale frames agree;
- the minimum large-model confidence is at least 0.98;
- every proposed digit is independently present in the browser model's top two probabilities at probability at least 0.05;
- slot length is valid;
- no ambiguity or confidence-safety veto applies.

The mathematical answer key is never provided to this decision.

## Scores

Fixed saved evidence, which isolates the policy change:

- Previous: 222/275 automatic, 80.7%, 0 observed errors.
- Candidate: 228/275 automatic, 82.9%, 0 observed errors.
- Six additional promotions: five row answers and one non-row answer.
- Rows: 142/160, 88.8%.
- Non-rows: 86/115, 74.8%.
- Remaining review: 47.

Fresh 40-page browser integration replay:

- 40/40 pages and 280/280 answer groups completed.
- 226/275 automatic, 82.2%, 0 observed errors.
- 54/54 automatic promotions were correct.
- Automatic annotations were consistent and every marked page was generated.
- Compared with the earlier frozen run, six additional answers became automatic while two previously automatic answers moved safely to review. Their retained 28×28 inputs and probability tensors were identical, but later selection behavior differed; this is a reproducibility issue to investigate, not a confident error.

Historical single-frame falsification stress:

- 457/578 surrogate automatic, 0 observed errors.
- The new browser-secondary lane accounted for nine correct surrogate promotions and no errors.
- This stresses secondary gates only. Historical records do not contain three adjacent frames, so it cannot validate the real three-frame requirement.

## Interpretation

The safe rule removes a small but real group of unnecessary yellows. It does not solve the non-row gap. The remaining high-value engineering work is:

1. Make selection reproducible for identical saved inputs.
2. Repair the six crop/registration failures using layout-specific geometry and replay every affected layout.
3. Separate physical box count from maximum written answer length for number-bond cells.
4. Improve or replace the compact reader using the larger grayscale crop; do not lower confidence thresholds around the 28×28 model.
5. Keep genuine overwrites and extra-stroke answers yellow.

Because this rescue rule was designed after inspecting these packets, it is still a development candidate. It requires confirmation on a packet selected and frozen before labels or predictions are viewed.

## Evidence

- `private-evidence/reports/consensus-yellow-audit-20260714/yellow-audit.json`
- `private-evidence/reports/consensus-yellow-audit-20260714/yellow-contact-01.jpg` through `yellow-contact-08.jpg`
- `private-evidence/reports/consensus-yellow-rescue-score-20260714.json`
- `private-evidence/reports/consensus-yellow-rescue-integration-score-20260714.json`
- `private-evidence/reports/consensus-historical-single-frame-stress-20260714.json`

Production was not changed or deployed during this audit.
