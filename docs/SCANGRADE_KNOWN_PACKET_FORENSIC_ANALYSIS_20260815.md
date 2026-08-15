# ScanGrade Known-Packet Physical Forensic Analysis — 2026-08-15

## Decision summary

The untouched Beta 15.112 public engine does **not** establish a precision-safe launch baseline on the primary known Grade 1 batch.

- Operational question coverage was **519/770 (67.4%)**. Five questions have genuinely ambiguous handwriting; among the 518 scorable automatic decisions, **514 were OCR-correct and 4 were confidently wrong**: **99.2% automatic precision**, not 100%.
- Operational physical-slot coverage was **982/1,320 (74.4%)**. Ten slots are ambiguous; among 978 scorable automatic slot decisions, **972 were correct and 6 were confidently wrong**: **99.4% automatic precision**.
- One automatic OCR error silently changed a visibly wrong student answer, `41`, into the expected answer, `47`. The other three question errors changed visibly correct math into incorrect grading. OCR truth and mathematical correctness are therefore materially different in this batch.
- The legacy G2-9 result reproduces exactly: **66/90 automatic questions, 66/66 correct; 151/180 automatic slots, 151/151 correct**. It remains a separate backward-compatibility cohort.
- The 251 primary Grade 1 yellow questions are not mainly safe answers blocked by one conservative threshold. Only **38/247 scorable yellows (15.4%)** have a correct suggested transcription. A broad threshold relaxation is contradicted by the evidence.
- Three Grade 1 pages entered a page-level `two-digit-unusable-quality-fallback-review`. They had strong focus and coherent answer-box registration. The fallback is a recognition-signal/policy result, not evidence of poor capture or annotation drift.
- Three other sessions terminated with numeric-only exceptions while registering answer boxes, before digit inference. Their common signature supports a browser/OpenCV-WASM resource/state or exception-marshalling hypothesis, not an OCR-model failure. The exact object-lifetime defect is not proven.
- P02's partial/offset yellow rectangles are an annotation-layer defect. The same scans have coherent recognition registration; annotation drift did not cause their recognition fallback.
- The first implementation experiment should be an **offline, key-blind accepted-answer safety-veto replay**, using P08 as an untouched known-material confirmation slice. It may demote reads to review but must never replace a student inscription. Do not attempt yellow rescue or threshold expansion until all four question-level confident errors are caught without introducing a new one.

These are known-material, single-device, retrospective findings. They do not demonstrate 90% automatic coverage, cross-device generalization, or launch readiness.

## Evidence boundary and reproducibility

### Repository and build

- Starting commit: `80a0cc20f852b8fcc59bddd88929d69ecd8a16c3`
- Branch at start: `autobuild/safe-20260223`
- Public build in the evidence: `2026.08.15-known-packet-batch-beta-15-112`
- Raw evidence root: `private-evidence/debug-scans/2026-08-15`
- Device/runtime for every current-batch scan: the same iPhone, iOS 18.7, Mobile Safari 26.4.
- No network evidence, deployment, sealed packet, student name, OCR change, confidence-policy change, capture change, homography change, grading change, UI change, or production-asset change was used in this audit.

The reproducible outputs are:

- [analysis script](../scripts/analyze_known_packet_forensic_20260815.py)
- [prediction-blind contact-sheet script](../scripts/build_known_packet_forensic_contact_sheets.py)
- [evidence manifest](../private-evidence/reports/known-packet-forensic-20260815/evidence-manifest.json)
- [manual truth decisions](../private-evidence/reports/known-packet-forensic-20260815/manual-truth-decisions.json)
- [truth ledger](../private-evidence/reports/known-packet-forensic-20260815/truth-ledger.jsonl)
- [question ledger and metrics](../private-evidence/reports/known-packet-forensic-20260815/question-metrics.jsonl)
- [digit-slot ledger and metrics](../private-evidence/reports/known-packet-forensic-20260815/digit-slot-metrics.jsonl)
- [aggregate metrics](../private-evidence/reports/known-packet-forensic-20260815/metrics.json)
- [complete review taxonomy](../private-evidence/reports/known-packet-forensic-20260815/review-classifications.json)
- [complete automatic-error enumeration](../private-evidence/reports/known-packet-forensic-20260815/automatic-errors.json)
- [repeatability comparisons](../private-evidence/reports/known-packet-forensic-20260815/repeatability.json)
- [terminal-error analysis](../private-evidence/reports/known-packet-forensic-20260815/error-sessions.json)
- [annotation findings](../private-evidence/reports/known-packet-forensic-20260815/annotation-findings.json)
- [truth and cardinality QA](../private-evidence/reports/known-packet-forensic-20260815/qa.json)
- [prediction-blind contact sheets](../private-evidence/reports/known-packet-forensic-20260815/contact-sheets/index.json)

Reproduction command:

```bash
/Users/openclaw/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 scripts/analyze_known_packet_forensic_20260815.py
```

### Exact inventory and deduplication

The hard reconciliation gate passed exactly. `scanSessionId` is the observation key. The normal `ocr-complete` and `accepted-answer-safety-shadow-complete` directories are snapshots of the same scan session, not separate pages. The representative snapshot priority is safety-shadow completion, then OCR completion, then OCR error.

| Packet/cohort | Canonical successes | Extra successes | Errors | Distinct sessions |
| --- | ---: | ---: | ---: | ---: |
| G2-9 legacy | 9 | 0 | 0 | 9 |
| A | 10 | 1 ten-frame repeat | 0 | 11 |
| B1 | 10 | 0 | 0 | 10 |
| B2 | 10 | 0 | 1 mixed | 11 |
| B3 | 10 | 0 | 0 | 10 |
| B4 | 10 | 0 | 0 | 10 |
| B5 | 10 | 0 | 0 | 10 |
| P02 | 10 | 2 add-two-digit retries | 1 add-two-digit | 13 |
| P03 | 10 | 0 | 0 | 10 |
| P05 | 10 | 0 | 0 | 10 |
| P08 | 10 | 0 | 0 | 10 |
| P09 | 10 | 0 | 1 add-one-digit | 11 |
| **Total** | **119** | **3** | **3** | **125** |

Canonical rules:

- The first A ten-frame success is canonical; the deliberate second success is diagnostic-only.
- The last P02 add-two-digit success is the documented fully terminated/reopened Safari run and is canonical. The preceding two successes remain diagnostic session-contamination retries.
- The B2, P02, and P09 terminal errors remain diagnostic-only and are outside recognition-accuracy denominators.
- Unrelated receiver smoke, private-gateway smoke, no-packet debug, and manual-correction sessions are excluded.
- P01, P04, P06, and P07 were not read. The manifest's `forbiddenPacketsRead` array is empty.

## Truth-ledger method and QA

### Label method

The truth target is the visible inscription, not the worksheet answer key.

1. The audit first rendered 11 packet-level contact sheets from raw answer crops with no prediction, confidence, review state, or answer key shown.
2. Every current Grade 1 question was transcribed from those sheets. Full current warped pages and raw crops controlled wherever a crop crossed a divider, handwriting was retraced, a response was blank, or a prior label disagreed.
3. Earlier P-packet truth was used only after current-page visual identity was checked. Of 345 comparable prior rows, **343 matched**. The two retained differences are P09 mixed Q1-Q2: the August page visibly reads `17` and `7`, while the July labels were `12` and `9`. The August page controls.
4. The G2-9 sessions were joined to the locked nine-photo scorecard by template and handwritten answer vector. Non-identical vectors determine identity; exchanging the two identical addition or mixed vectors cannot change a metric.
5. The ledger records packet, layout, question, physical slot, visible inscription, expected answer, provenance, ambiguity, canonical session, and raw evidence paths.

Five Grade 1 questions are excluded from OCR precision because multiple overwritten states are genuinely ambiguous:

- `P02|number-bonds|Q4`, apparent/current value `24`.
- `P02|place-value|Q3`, apparent/current value `49`.
- `P03|ten-frames|Q4`, apparent/current value `14`.
- `P03|number-bonds|Q2`, apparent/current value `5`.
- `P03|place-value|Q3`, apparent/current value `49`.

Other retraced answers were retained only when the final visible inscription was legible. Examples include A subtraction Q1 (`5`), B5 subtraction Q5 (`5`), and B5 subtraction Q7, where two characters (`10`) were visibly written inside one physical slot.

### Second-pass and deterministic checks

The QA pass did not use the answer key as handwriting truth. It checked:

- exact corpus reconciliation: 125 = 119 + 3 + 3;
- exactly 860 canonical questions and 1,500 physical slots;
- exactly 770/1,320 primary Grade 1 questions/slots and 90/180 legacy G2 questions/slots;
- complete explicit placement for every one-digit response written in a two-slot box;
- all blanks, `1`/`7` shapes, multi-stroke/retraced answers, prior-label disagreements, and every automatic OCR mismatch against current raw evidence;
- complete classification of every operationally reviewed question and slot;
- complete enumeration of every confidently automatic error;
- exact reproduction of the locked G2-9 result.

The five ambiguous questions correspond to ten ambiguous physical slots. A's number-pattern Q1 is question-readable as `6` but spans the printed divider; its two slot labels are separately ambiguous. Full QA details are in [qa.json](../private-evidence/reports/known-packet-forensic-20260815/qa.json).

## Untouched Beta 15.112 baseline

`reviewOnlyFallback` is treated as an operational all-yellow page decision even where a saved pre-fallback per-question or per-slot field still says accepted. This matches the marked result shown to the teacher.

### Cohort-level result

| Cohort and unit | Total | Ambiguous | Automatic | Scorable automatic | Correct automatic | Confident wrong | Automatic precision | Review | Correct suggestion within scorable review |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Primary Grade 1 questions | 770 | 5 | 519 (67.4%) | 518 | 514 | 4 | 99.2% | 251 (32.6%) | 38/247 (15.4%) |
| Primary Grade 1 slots | 1,320 | 10 | 982 (74.4%) | 978 | 972 | 6 | 99.4% | 338 (25.6%) | 98/332 (29.5%) |
| Legacy G2 questions | 90 | 0 | 66 (73.3%) | 66 | 66 | 0 | 100% | 24 (26.7%) | 11/24 (45.8%) |
| Legacy G2 slots | 180 | 0 | 151 (83.9%) | 151 | 151 | 0 | 100% | 29 (16.1%) | 15/29 (51.7%) |

The primary and legacy rows must not be pooled into a launch metric. Combined values exist in `metrics.json` for descriptive reconciliation only.

### By primary packet/writer

| Packet | Automatic questions | Correct/scorable automatic | Wrong | Question precision | Automatic slots | Correct/scorable automatic slots | Wrong slots |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| A | 28/70 (40.0%) | 28/28 | 0 | 100% | 58/120 (48.3%) | 57/58 | 1 |
| B1 | 33/70 (47.1%) | 33/33 | 0 | 100% | 73/120 (60.8%) | 73/73 | 0 |
| B2 | 34/70 (48.6%) | 33/34 | 1 | 97.1% | 74/120 (61.7%) | 73/74 | 1 |
| B3 | 55/70 (78.6%) | 55/55 | 0 | 100% | 104/120 (86.7%) | 104/104 | 0 |
| B4 | 56/70 (80.0%) | 56/56 | 0 | 100% | 101/120 (84.2%) | 101/101 | 0 |
| B5 | 54/70 (77.1%) | 53/54 | 1 | 98.1% | 101/120 (84.2%) | 100/101 | 1 |
| P02 | 35/70 (50.0%) | 35/35 | 0 | 100% | 62/120 (51.7%) | 61/61 | 0 |
| P03 | 56/70 (80.0%) | 55/55 | 0 | 100% | 101/120 (84.2%) | 98/98 | 0 |
| P05 | 47/70 (67.1%) | 46/47 | 1 | 97.9% | 93/120 (77.5%) | 92/93 | 1 |
| P08 | 63/70 (90.0%) | 62/63 | 1 | 98.4% | 112/120 (93.3%) | 111/112 | 1 |
| P09 | 58/70 (82.9%) | 58/58 | 0 | 100% | 103/120 (85.8%) | 102/103 | 1 |

P08's 90.0% packet coverage is not a 90%-coverage product result: it is one known packet, contains a confident question error, and the packet macro minimum is 40.0%.

Question-level packet macro rates are 67.4% mean coverage, 40.0%-90.0% range, and 99.2% mean precision. Layout macro rates are 67.3% mean coverage, 58.0%-80.7% range, and 99.2% mean precision. Equal packet sizes make the packet macro coverage equal the micro coverage here; the ranges expose the writer sensitivity that a pooled figure hides.

### By worksheet layout

| Layout | Automatic questions | Correct/scorable automatic | Wrong | Precision |
| --- | ---: | ---: | ---: | ---: |
| Add one digit | 71/88 (80.7%) | 71/71 | 0 | 100% |
| Add two digits | 51/88 (58.0%) | 51/51 | 0 | 100% |
| Subtract one digit | 64/88 (72.7%) | 63/64 | 1 | 98.4% |
| Subtract two digits | 55/88 (62.5%) | 55/55 | 0 | 100% |
| Mixed within 20 | 58/88 (65.9%) | 58/58 | 0 | 100% |
| Ten frames | 41/66 (62.1%) | 40/40 | 0 | 100% |
| Dot collections | 44/66 (66.7%) | 43/44 | 1 | 97.7% |
| Number bonds | 44/66 (66.7%) | 44/44 | 0 | 100% |
| Number patterns | 40/66 (60.6%) | 40/40 | 0 | 100% |
| Place value | 51/66 (77.3%) | 49/51 | 2 | 96.1% |

### Required stratification highlights

All strata, including every question number and canonical page ordinal, are saved in `metrics.json`. The main signals are:

| Stratum | Automatic questions | Correct/scorable automatic | Wrong | Interpretation |
| --- | ---: | ---: | ---: | --- |
| One visible character | 210/285 (73.7%) | 209/210 | 1 | Better coverage than two-character responses, but not error-free. |
| Two visible characters | 309/484 (63.8%) | 305/308 | 3 | Four ambiguous rows include one operational automatic. |
| One physical slot | 164/220 (74.5%) | 163/164 | 1 | B5's overwritten `5→8` is the error. |
| Two physical slots | 355/550 (64.5%) | 351/354 | 3 | Composition and companion-artifact risk are concentrated here. |
| Left page column | 265/385 (68.8%) | 264/265 | 1 | — |
| Right page column | 254/385 (66.0%) | 250/253 | 3 | Lower precision and three of four question errors. |
| Focus 650-799 | 109/134 (81.3%) | 109/109 | 0 | Lower focus did not explain errors. |
| Focus 800+ | 406/624 (65.1%) | 401/405 | 4 | All confident errors occurred in accepted high-focus scans. |
| Registration max residual 0-3 px | 282/394 (71.6%) | 279/282 | 3 | Low residual does not guarantee recognition correctness. |
| Registration max residual 3-6 px | 107/164 (65.2%) | 105/106 | 1 | — |
| Registration max residual >6 px | 86/146 (58.9%) | 86/86 | 0 | Coverage falls, but no automatic error in this slice. |
| Incoherent registration flag | 44/66 (66.7%) | 44/44 | 0 | Conservative behavior, not confident failure, in this batch. |

Slot position is asymmetric: tens slots were **356/356** correct among 356 scorable automatic decisions, while ones slots were **361/365** with four wrong. The optional right slot was **46/47**, including A's blank companion accepted as `1`; the optional left slot was **46/46**. Physical right slots contained five of six automatic slot errors.

Digit-class automatic precision was weakest for visible `0`: **37/39 (94.9%)**. Visible `3` was 46/47 (97.9%), visible `5` was 98/99 (99.0%), visible `1` was 312/313 (99.7%), and all other ordinary classes were 100% in this batch. These are descriptive known-material slices, not safe per-class tuning targets.

Canonical page ordinal is confounded with worksheet layout. Ordinal 10 was 48/66 automatic with 46/48 correct; ordinal 9 was 39/66 automatic with 39/39 correct. No monotonic endurance decline exists. The three terminal errors are analyzed separately below.

### Timing and capture rejection telemetry

| Cohort | Capture gate median (p10-p90) | OCR trace median (p10-p90) | Accepted capture to safety-shadow receipt median (p10-p90) |
| --- | ---: | ---: | ---: |
| Primary Grade 1, 110 canonical pages | 4.523 s (3.413-7.171) | 1.513 s (0.917-1.864) | 11.906 s (9.481-14.956) |
| Legacy G2, 9 pages | 6.166 s (5.058-10.230) | 2.169 s (1.986-2.721) | 15.222 s (10.415-17.764) |

The G2 reproduction differs by 66 ms from the earlier rounded 2.235-second OCR statement because this audit uses the terminal completed `ocrStageTrace` timestamp consistently across all bundles. Receipt time includes evidence encoding/upload and is not marking-start latency.

Across 119 canonical pages the capture gate recorded 127 attempts, with six `sheet-gate` and two `qr-gate` rejections before acceptance. No terminal session failed at the capture or QR gate.

## Complete automatic-error audit

Every automatic question error is listed below. There are no omitted examples.

| Packet/layout/Q | Visible truth | Expected math | Automatic read | Grading effect | Primary layer finding | Evidence |
| --- | ---: | ---: | ---: | --- | --- | --- |
| B2 place value Q6 | `41` | `47` | `47` | **False correct**: visible wrong math became expected answer | Ones `1→7`; accepted with preprocessing disagreement, confidence 0.88, truth `1` only third in top-K at 0.43 | [raw crop](../private-evidence/debug-scans/2026-08-15/2026-08-15_18-25-51-691-sg-g1-lw-10-place-value-50-328e3f85/raw-crops/raw-12.png) |
| B5 subtract one digit Q5 | `5` | `5` | `8` | False incorrect | Retraced but legible `5`; model class failure at 0.876 confidence. The saved whole-slot scout independently read `5` at 0.823, but the public `six-eight-only` route did not send it to safety review | [raw crop](../private-evidence/debug-scans/2026-08-15/2026-08-15_18-37-30-558-sg-g1-lw-03-sub-1digit-2e8f6c37/raw-crops/raw-05.png) |
| P05 dot collections Q4 | `13` | `13` | `17` | False incorrect | Clean ones `3→7`; model class failure at 0.989 confidence, truth `3` probability 0.0016 | [raw crop](../private-evidence/debug-scans/2026-08-15/2026-08-15_18-53-19-765-sg-g1-lw-07-dot-collections-b6e18990/raw-crops/raw-08.png) |
| P08 place value Q2 | `40` | `40` | `41` | False incorrect | Ones `0→1`; handwriting touches/leans toward the crop edge and preprocessing leaves a partial arc, so crop/preprocessing damage is the strongest hypothesis, with model failure downstream | [raw crop](../private-evidence/debug-scans/2026-08-15/2026-08-15_18-59-42-132-sg-g1-lw-10-place-value-50-6868af68/raw-crops/raw-04.png) |

Two additional physical slots were automatic and wrong inside questions already held for review:

- A ten-frame Q3's physically blank right slot was accepted as `1` from divider/blank material. [Raw crop](../private-evidence/debug-scans/2026-08-15/2026-08-15_18-03-12-625-sg-g1-lw-06-ten-frames-cf17c7d1/raw-crops/raw-06.png).
- P09 number-pattern Q5's visible ones `0` was accepted as `2` at only 0.55 confidence and 0.03 top gap under `right-slot-expected-edge-default`; the tens slot kept the question yellow. [Raw crop](../private-evidence/debug-scans/2026-08-15/2026-08-15_19-03-22-201-sg-g1-lw-09-number-patterns-07b1d59f/raw-crops/raw-10.png).

Thus the six wrong automatic slots are: blank→`1`, `1→7`, `5→8`, `3→7`, `0→1`, and `0→2`. Four propagate to automatic question errors.

Mathematical truth among the 765 scorable Grade 1 questions is 697 visibly correct and 68 visibly wrong or blank. Among 518 scorable automatic decisions, engine grading agrees with visible-math truth on 514, with one false-correct and three false-incorrect outcomes. This is why answer-key-conditioned recognition or silent replacement is forbidden.

## Complete yellow taxonomy

The taxonomy is based on the strongest observed layer signal, not an assumption that all yellows are model errors. Every case and all secondary tags are in `review-classifications.json`.

### Primary Grade 1 reviewed questions: 251

| Primary category | Count | % of reviewed questions | What it means | Representative case/evidence |
| --- | ---: | ---: | --- | --- |
| Preprocessing-variant disagreement | 87 | 34.7% | Saved preprocessing variants disagree; no retained independent capture view is available | `A|dot-collections|Q4`, [debug](../private-evidence/debug-scans/2026-08-15/2026-08-15_18-02-56-587-sg-g1-lw-07-dot-collections-9d55f2a0/debug.json) |
| Model-class ambiguity | 50 | 19.9% | Wrong held class without stronger upstream evidence | `A|dot-collections|Q3`, [raw crops](../private-evidence/debug-scans/2026-08-15/2026-08-15_18-02-56-587-sg-g1-lw-07-dot-collections-9d55f2a0/raw-crops) |
| `1` versus `7` confusion | 42 | 16.7% | A mismatched slot is the high-frequency `1`/`7` pair | `A|sub-two-digit|Q3`, [contact sheet](../private-evidence/reports/known-packet-forensic-20260815/contact-sheets/A-answer-crops.png) |
| Correct suggestion held by policy | 34 | 13.5% | Suggested whole answer exactly matches visible truth but remains yellow | `A|dot-collections|Q2`, [debug](../private-evidence/debug-scans/2026-08-15/2026-08-15_18-02-56-587-sg-g1-lw-07-dot-collections-9d55f2a0/debug.json) |
| Whole-answer forced fallback | 24 | 9.6% | Three pages are operationally all yellow under `two-digit-unusable-quality-fallback-review` | `P02|add-two-digit`, [debug](../private-evidence/debug-scans/2026-08-15/2026-08-15_18-46-36-018-sg-g1-lw-02-add-2digit-e8e7177e/debug.json) |
| Blank/divider/border as companion digit | 5 | 2.0% | One-digit handwriting in a two-slot box gained an extra companion digit | `A|ten-frames|Q2`, [raw blank companion](../private-evidence/debug-scans/2026-08-15/2026-08-15_18-03-12-625-sg-g1-lw-06-ten-frames-cf17c7d1/raw-crops/raw-04.png) |
| Leading/missing/two-digit composition | 4 | 1.6% | Answer length/composition is wrong without the blank-companion signature | `B5|sub-one-digit|Q7` (`10` in one slot), [contact sheet](../private-evidence/reports/known-packet-forensic-20260815/contact-sheets/B5-answer-crops.png) |
| Ambiguous/overwritten handwriting | 4 | 1.6% | Operational yellow on genuinely unscorable truth | `P02|number-bonds|Q4`, [contact sheet](../private-evidence/reports/known-packet-forensic-20260815/contact-sheets/P02-answer-crops.png) |
| Whole answer blank, printed artifact hallucinated | 1 | 0.4% | B1 place-value Q1 is blank but suggested `11` | [warped page](../private-evidence/debug-scans/2026-08-15/2026-08-15_18-12-29-160-sg-g1-lw-10-place-value-50-bfdaee0d/warped.png) |

### Primary Grade 1 reviewed physical slots: 338

| Primary category | Count | % of reviewed slots |
| --- | ---: | ---: |
| Preprocessing-variant disagreement | 92 | 27.2% |
| Correct suggestion held by policy | 74 | 21.9% |
| Model-class ambiguity | 69 | 20.4% |
| Whole-answer forced fallback | 48 | 14.2% |
| `1` versus `7` confusion | 42 | 12.4% |
| Blank/divider/border as digit | 6 | 1.8% |
| Ambiguous/overwritten/divider-spanning truth | 6 | 1.8% |
| Missing digit | 1 | 0.3% |

The 225 reviewed slots carrying `two-digit-mismatch-low-trust-review` are distributed across the model, preprocessing, and `1`/`7` categories after truth inspection; the engine reason alone is not treated as a root cause. No current Grade 1 page retained an independent multi-view capture set, so true capture-view disagreement could not be tested. “Multi-view unavailable” is a limitation, not a model-error label.

The legacy G2 yellows differ: 11/24 question suggestions and 15/29 slot suggestions are correct. Its complete separate taxonomy is in the same machine-readable file.

## Blank and printed-artifact findings

The Grade 1 ledger contains 69 physically blank slots: optional companion slots plus B1's completely blank two-slot answer.

- 46/69 were automatically represented as blank correctly.
- 16/69 were correctly represented as blank but held because the containing question/slot was reviewed.
- 6/69 produced wrong digit suggestions but remained reviewed.
- 1/69 produced a wrong digit suggestion automatically: A ten-frame Q3's blank companion became `1`.

The seven digit hallucinations on blank slots are four A ten-frame companions, both B1 blank-place-value slots, and P03 mixed Q2's companion. B1's whole blank answer became suggested `11` and stayed yellow, which preserved grading integrity but exposed a geometry/artifact failure.

The A ten-frame diagnosis is specifically **not** “the writer's `1` looks like `7`.” Q2-Q5 visibly contain `6`, `7`, `8`, and `9` in the left slot with a blank right slot. Both runs produced `61`, `71`, `81`, and `91`. The companion `1` is derived from the blank/divider slot; the left digit varies correctly with the handwriting.

## Repeatability and sensitivity

### A ten-frame deliberate repeat

The two captures are near duplicates:

- captured-page pixel similarity: 0.9710;
- warped-page similarity: 0.9962;
- mean raw-crop similarity: 0.9909, minimum 0.9845;
- 11/12 digit suggestions agree;
- all 6 question review decisions agree;
- Q1-Q5 suggestions are identical, including `61`, `71`, `81`, and `91` on Q2-Q5;
- Q6 changed from `16` to the correct `10`, despite near-identical input.

Observed fact: companion-artifact behavior is deterministic across the repeat, while at least one real digit decision is sensitive to a very small capture/crop change. Hypothesis: the artifact has a stable printed-geometry source; Q6 sits near an unstable preprocessing/model boundary.

### P02 add-two-digit attempts

All three successful attempts entered the same forced fallback, including the clean fresh-restart canonical session. Relative to that canonical run, the two earlier successes had:

- captured-page similarity 0.9831/0.9845;
- warped similarity 0.9480/0.9602;
- mean raw-crop similarity 0.9627/0.9646;
- only 10/16 and 9/16 digit suggestions agreeing;
- only 3/8 whole-answer suggestions agreeing in either comparison;
- large maximum confidence changes of 0.865 and 0.924.

Observed fact: the all-yellow page decision is stable, but the underlying suggestions and confidences are not. This is incompatible with treating one retry's digit string as a deterministic reading. It also shows that a fresh restart does not resolve the two-digit signal failure.

### Error/recovery pairs

- P02 error to first recovery: 32.6 seconds, captured similarity 0.9511.
- P09 error to recovery: 37.3 seconds, captured similarity 0.9784.
- B2 error to later recovery: 410.3 seconds, captured similarity 0.9670.

Successful processing of very similar pages immediately after P02/P09 errors argues against a permanently corrupt file or layout. It is consistent with transient runtime state/resource failure, but does not identify its exact source.

## Fallback analysis

Exactly three canonical pages were page-level forced review:

| Packet/layout | Focus | Registration | Visible/scored effect |
| --- | ---: | --- | --- |
| A add two digits | 979.6 | coherent, max residual 0-3 px | 16 slots forced review |
| P02 add two digits | 875.2 | coherent, max residual 0.96 px | 16 slots forced review |
| P02 subtract two digits | 881.9 | coherent, max residual 4.90 px | 16 slots forced review |

All three have `preferredPerspective=true`. P02 add reports eight low-gap groups, seven mismatches, average confidence 0.617, and `broadMismatchLowSignalCapture=true`; subtraction reports six low-gap/mismatch groups and average confidence 0.607. “Capture” in those internal field names is an engine label, not proof of bad focus/perspective. The observed evidence supports layer 4-7 recognition-signal/policy attribution after successful registration.

Only 4/24 forced-review question suggestions match current truth. Simply disabling the page fallback would produce 20 wrong automatic answers on these pages. A per-answer replacement must therefore earn safety with independent evidence; the same pages cannot both tune and report the gain.

## Terminal-error/runtime analysis — separate from OCR accuracy

| Packet/layout | Session | Focus | Last completed worksheet stage | Terminal stage | Numeric exception |
| --- | --- | ---: | --- | --- | ---: |
| B2 mixed | `dbe548d7-ae04-42c2-94f5-87304f44be96` | 928.0 | selecting page orientation | registering answer boxes | `64691176` |
| P02 add two digits | `fd02b3a0-203a-4db9-bd85-0356ca870c20` | 782.1 | selecting page orientation | registering answer boxes | `88861992` |
| P09 add one digit | `13f7a9e7-3e14-4f7a-8d91-4d5dfb36fc73` | 782.9 | selecting page orientation | registering answer boxes | `192220584` |

Observed facts:

- All three captures passed sheet and QR gates and completed marker detection/orientation selection.
- All three stopped at `registering answer boxes`; no `answerBoxRegistration` result was persisted and digit inference never started.
- Exceptions have only large numeric messages, with no name or stack.
- P02 failed after only three prior pages. A six-page endurance threshold is disproven.
- Very similar pages later succeeded.

Inference, moderate strength: the common failure class is layer 9 browser/OpenCV-WASM state/resource lifetime or exception marshalling occurring inside layer 3 answer-box registration. A numeric message is consistent with a raw WASM/embind value escaping, but it is not proof of a particular double-free, leaked `cv.Mat`, or heap address.

Smallest falsifiable reproduction:

1. Add a registration-only persistent-WebKit harness around `processWorksheet`/`cropBoxes` in [src/homography.js](../src/homography.js), using the exact saved chronological prefix and the three failing `captured.png` files.
2. Record every stage entry/exit, `cv.Mat` creation/deletion ownership, WASM heap size, and thrown value/type. Run both warm-prefix and cold single-page cases.
3. Loop each sequence 50 times and inject one controlled registration failure before a recovery page.
4. Accept only if outputs are deterministic, heap use reaches a stable plateau, no numeric-only exception occurs, and recovery after an injected failure is clean.
5. If desktop WebKit cannot reproduce, run the same harness physically on the original iPhone and agreed old iPad. Do not change registration logic without that reproduction.

Existing starting tests are [tests/answer-box-registration.test.mjs](../tests/answer-box-registration.test.mjs) and [tests/legacy-registration-hot-path.test.mjs](../tests/legacy-registration-hot-path.test.mjs).

## Annotation registration — separate from recognition

P02 add/subtract marked sheets visibly show yellow fill rectangles that are partial/offset against printed answer frames. Internally:

- add-two-digit recognition registration is coherent with max/median residual 0.955/0.573 px;
- subtract-two-digit recognition registration is coherent with max/median residual 4.898/1.330 px;
- crop annotation geometry uses `trusted-physical-frame`;
- the final overlay uses `annotationBaseMode=source-capture`, a downstream coordinate transform.

Observed fact: recognition crops align with the handwritten digits and coherent registered frames, while the rendered source-capture overlay is visibly displaced. Inference, strong: the visible defect is layer 8 annotation transform/rendering after recognition. It did not cause the layer 7 page fallback and must not be counted as an OCR miss.

Evidence: [P02 add marked sheet](../private-evidence/debug-scans/2026-08-15/2026-08-15_18-46-36-018-sg-g1-lw-02-add-2digit-e8e7177e/marked-sheet.jpg), [P02 subtract marked sheet](../private-evidence/debug-scans/2026-08-15/2026-08-15_18-47-35-930-sg-g1-lw-04-sub-2digit-d08caec3/marked-sheet.jpg), and [annotation-findings.json](../private-evidence/reports/known-packet-forensic-20260815/annotation-findings.json).

## Root-cause matrix

| Symptom | Primary layer | Evidence | Strength | What is not established |
| --- | --- | --- | --- | --- |
| Three terminal numeric exceptions | 9 runtime/WASM state while executing 3 registration | identical terminal stage, no inference, good captures, later recovery | Moderate | exact leaked/double-freed object |
| P02/A page-level two-digit fallback | 4-7 crop/preprocess/model/policy | coherent registration, high focus, broad mismatch/low-gap signals | Strong for downstream-of-registration; mixed within 4-7 | whether one preprocessing change safely fixes it |
| A `61/71/81/91` | 4 crop/segmentation, then 7 composition | stable blank right-slot `1` across repeat | Strong | generic `1`/`7` handwriting confusion |
| B1 blank `11` | 3-4 printed geometry/artifact extraction, safely caught by 7-8 policy | both blank slots suggested as `1`, whole answer yellow | Strong | a safe basis to auto-grade a blank answer |
| B2 `41→47` | 5-7 model/selector | `1` third in top-K, preprocess disagreement, accepted `7` | Strong | a general threshold that fixes it without regressions |
| B5 `5→8` | 5 model, missed by public safety route | raw retraced `5`, model 0.876 for `8`, scout reads `5` | Strong | safe scout threshold from one case |
| P05 `3→7` | 5 model | clear raw `3`, 0.989 for `7` | Strong | available cheap telemetry flag |
| P08 `0→1` | 4-5 crop/preprocess then model | partial edge arc in raw crop, 0.973 `1` | Moderate | whether geometry or writing placement dominates |
| P09 reviewed question with automatic `0→2` slot | 6-7 selector/policy | 0.55, top gap 0.03, preprocess disagreement, accepted slot | Strong | question-level harm in this instance; question stayed yellow |
| Partial/offset yellow boxes | 8 annotation rendering | coherent recognition registration, source-capture overlay drift | Strong | recognition harm |
| Low writer A/B1/B2 coverage | 4-7 handwriting sensitivity and fallback | 40.0%-48.6% vs 77.1%-90.0% packets, same device/layouts | Strong | cross-device behavior |

No QR/layout-selection error was observed among canonical pages. Capture quality contributed to review on a small 12-question concern slice, but all four automatic errors were in accepted focus-800+ pages. Worksheet geometry affects coverage, yet low residual registration contains three of four question errors, so homography quality alone is not the explanation.

## Ranked improvement opportunities and falsifiable experiments

### 1. Key-blind accepted-answer safety-veto replay — first

Goal: restore zero known confident question errors before seeking more coverage.

- Affected evidence: 4 automatic question errors, 6 automatic slot errors; B5 already has a saved scout conflict (`8` public vs `5` scout at 0.823).
- Plausible effect: demote all 4 wrong automatic questions, changing operational coverage from 519/770 to at most 515/770 (66.9%) while making the scorable automatic set 514/514. This is a safety repair, not a coverage claim.
- Precision risk: low only if the lane is veto-only and key-blind; false vetoes reduce coverage. Silent replacement is prohibited.
- Generalization risk: high if routing or scout probability is tuned on the four errors. Use grouped packet folds and reserve **P08** untouched as the confirmation slice.
- Device cost: potentially high. The existing scout package is 7.7 MB; July WebKit evidence measured about 9.25 s initialization and roughly 15.8 s total scout work in that path. Narrow routing, reuse, memory ceilings, timeout/fail-open, and old-iPad physical validation are mandatory.
- Implementation complexity: medium; reuse [accepted-answer-safety.js](../src/v3/accepted-answer-safety.js), [whole-slot-scout.js](../src/v3/whole-slot-scout.js), and [evaluate_accepted_answer_safety_repair.mjs](../scripts/evaluate_accepted_answer_safety_repair.mjs).
- Saved-evidence test: run the current 765 scorable Grade 1 questions with no truth/key fields passed into route/decision functions; report by held-out packet.
- Accept: all four question errors become review; no new automatic error; no transcription changes; deterministic identical-input output; P08 passes without tuning; fail-open behavior preserved; old-iPad peak memory and latency remain within the agreed release budget.
- Reject/stop: any confident error remains or appears, P08 requires special casing, a rule references the expected answer, or device cost cannot be bounded.

### 2. Registration-only WebKit ownership/heap soak

Goal: turn the three unexplained terminal sessions into a reproducible runtime defect before editing OCR or homography.

- Affected evidence: 3/125 distinct sessions, at least two with recovery in under 38 seconds.
- Plausible automatic-coverage effect: none; reliability upside is removal of terminal failures.
- Precision risk: none if the first phase is instrumentation/replay only.
- Device cost: low for the harness; any production instrumentation must be bounded and removable.
- Complexity: medium.
- Test: exact warm/cold 50-loop sequence described in the runtime section, desktop WebKit first, then original iPhone/old iPad if required.
- Accept: deterministic reproduction or a clean, instrumented proof that resource ownership is stable. A subsequent fix must pass both registration tests and 50-loop recovery.
- Reject/stop: do not infer a six-page threshold, do not change marker/homography algorithms without reproduction, and do not call a non-reproduction “fixed.”

### 3. Optional-slot blank/divider structural guard

Goal: prevent printed divider/border material from becoming a companion digit without erasing real handwriting.

- Affected evidence: 69 blank slots; 7 digit hallucinations, including 1 automatic; stable A repeat signature.
- Plausible additional automatic questions: **0 from current evidence** because the companion fix alone does not clear the other reviewed digit on the affected questions. It can remove one automatic slot error and improve suggested transcription quality.
- Precision risk: deleting a faint real digit is severe. The guard must require blank evidence across raw crop, cleanup variants, edge/border morphology, and neighboring-slot occupancy. It must never auto-grade the wholly blank B1 answer as correct.
- Device cost: low; deterministic morphology only.
- Complexity: low-medium.
- Validation: leave one packet out; include all occupied optional slots as negative controls and the A repeat as deterministic confirmation.
- Accept: all seven artifact digits suppressed, zero occupied-slot deletions, no new automatic whole-blank answer, identical results across A repeat.
- Reject/stop: any real stroke is removed or any result depends on the answer key.

### 4. Per-answer decomposition of the two-digit page fallback

Goal: determine whether a small subset of answers can remain safely automatic while a page-level signal pileup stays conservative.

- Affected evidence: 24 questions/48 slots across A add-two-digit and P02 add/subtract-two-digit.
- Plausible upside on current suggestions: at most 4 question reads already match truth. Twenty do not; globally disabling fallback is categorically unsafe.
- Precision risk: very high because there are only two writers/packets in this failure slice and the current pages would otherwise be used for both selection and reporting.
- Device cost: low for policy-only simulation; higher if an independent reader is added.
- Complexity: medium.
- Validation: develop on A and confirm on P02, then reverse the roles; require the same rule in both directions. Never use sealed packets for selection.
- Accept: zero wrong released answers in both directions, deterministic output, and no page-specific constant. Any claimed gain remains retrospective until sealed physical testing.
- Reject/stop: any wrong release, rule instability between A/P02, or answer-key dependence.

### 5. Annotation-only source-capture transform repair

Goal: align yellow regions with printed frames without touching recognition geometry.

- Affected evidence: two visually audited P02 marked sheets; likely more source-capture overlays require measurement.
- Automatic-coverage upside: zero.
- Precision risk: none if isolated after recognition, but teacher-trust risk remains if left unfixed.
- Device cost: negligible.
- Complexity: low-medium.
- Test: render saved overlays before/after, compare transformed focus rectangles to detected source-frame edges, and run snapshot tests on rotated/perspective pages.
- Accept: visual/coordinate alignment improves with byte-identical OCR predictions, confidence, review, and grading JSON.
- Reject/stop: any change to crop, homography, prediction, or grade state.

### Yellow rescue remains later, not first

There are 34 correct suggestions among 247 scorable Grade 1 yellows, but 209 wrong suggestions. A second-reader rescue might recover a subset after the automatic-error lane is safe. No threshold on the current 34/247 set may be reported on the same set as an unbiased improvement. Use leave-one-packet-out selection, reserve a known packet as confirmation, and require zero newly confident errors. If no such subset survives, keep the current yellows.

## Recommended sequence and gates

1. Freeze this audit as the untouched baseline. Re-running the script must reproduce all cardinalities, four question errors, six slot errors, and the G2 result.
2. Build only the offline accepted-answer veto replay. P08 is not available during rule selection.
3. If and only if the veto lane reaches zero known errors on exploration and P08 confirmation, measure old-iPad initialization, peak memory, inference time, timeout, and fail-open behavior. Do not activate it publicly yet.
4. In parallel but in a separate patch, build the registration-only persistent-WebKit soak. Do not combine runtime and recognition-policy changes.
5. Evaluate the optional-blank guard with occupied-slot negative controls and the A repeat.
6. Explore per-answer fallback decomposition only after precision is restored. Stop immediately on one wrong release.
7. Repair annotation transform separately with invariant OCR/grade outputs.
8. Only a frozen candidate that passes all saved-evidence gates advances to prospective physical testing on sealed P01/P04/P06/P07 across the agreed devices. Automatic grading—not an all-yellow result—must be physically verified.

Global stop conditions:

- any new or unexplained confident OCR error;
- answer-key or mathematical-correctness fields entering recognition;
- a silent text replacement instead of a review veto;
- a packet/writer-specific constant masquerading as a general rule;
- threshold selection and performance reporting on the same packet group;
- unbounded scout memory/latency or degraded old-iPad compatibility;
- a recognition/homography change made without a reproducible test.

## Honest comparison with earlier claims

The legitimate July retrospective browser-local frontier was **267/345 automatically resolved, 267/267 correct (77.4%)**. It was a known-material, saved-evidence result, not a prospective physical launch gate.

The July accepted-safety investigation also recorded a **90.4%** broad-veto-removal ablation, but it had **20 confident errors**. It was explicitly unsafe. Its repaired retrospective candidate reached 284/345 (82.3%) with zero known errors, still below 90% and still not a prospective release result. Neither result demonstrated “over 90% safely.”

The current physical primary Grade 1 batch is 519/770 operationally automatic (67.4%) with four confident question errors. The legacy G2 cohort is 73.3% with zero errors. These are different cohorts and must not be blended to rescue a headline.

Evidence required before a 90% statement:

- a frozen, predeclared candidate and metric;
- no tuning on the reporting packets;
- prospective physical P01/P04/P06/P07 results, still sealed until the candidate freezes;
- writer/packet-separated results with zero unexplained confident errors;
- agreed-device coverage, including the old iPad and iPhone paths;
- automatic marking physically visible, not review-only fallback;
- enough observations to make the error bound meaningful, not one high-coverage packet.

Evidence required before launch readiness additionally includes zero terminal runtime errors under sustained device use, annotation alignment, manual-correction and recovery validation, bounded latency/memory/thermal behavior, privacy/evidence-flow verification, and completion of the release-candidate device protocol. This audit supplies none of those prospective claims.

## Implementation handoff for a medium-reasoning Codex agent

### Exact next task: offline accepted-answer safety-veto replay

1. Read this report, [metrics.json](../private-evidence/reports/known-packet-forensic-20260815/metrics.json), [automatic-errors.json](../private-evidence/reports/known-packet-forensic-20260815/automatic-errors.json), and [qa.json](../private-evidence/reports/known-packet-forensic-20260815/qa.json).
2. Re-run [analyze_known_packet_forensic_20260815.py](../scripts/analyze_known_packet_forensic_20260815.py). Stop if its output differs.
3. Add a new analysis-only script, suggested name `scripts/evaluate_known_packet_accepted_safety_veto.mjs`. Do not edit production policy in the first patch.
4. Join the 765 scorable Grade 1 question rows to their saved debug predictions. Pass only current automatic state/read, predictions, independent reader evidence, slot count, and layout ID to [accepted-answer-safety.js](../src/v3/accepted-answer-safety.js). Assert that truth and answer-key fields are never passed.
5. Explore routing on A/B1-B5/P02/P03/P05/P09. Keep P08 completely unavailable until one candidate and thresholds are frozen.
6. The policy may only preserve a read or demote it to teacher review. It may not replace text.
7. Emit paired baseline/candidate metrics overall, by packet, layout, response length, physical slot, digit class, column, capture band, and registration band. List every changed row.
8. Run identical-input determinism twice. Then reveal P08 once. Pass only if all four known question errors are review, no automatic error exists, no packet-specific constant is used, and device-cost work is explicitly queued.
9. If the saved independent evidence cannot catch all four safely, record a failed candidate and leave the model/policy unchanged.

Next separate task: add a registration-only persistent-WebKit harness around `processWorksheet` in [src/homography.js](../src/homography.js), using [answer-box-registration.test.mjs](../tests/answer-box-registration.test.mjs) and [legacy-registration-hot-path.test.mjs](../tests/legacy-registration-hot-path.test.mjs) as invariants. Do not combine this with the safety-veto patch.

Do not touch yet:

- the public confidence threshold or digit model;
- answer-key-conditioned logic or automatic text replacement;
- capture, QR selection, markers, homography, crop geometry, or iPad code without the stated reproduction;
- page-level fallback in production before the two-direction A/P02 test;
- annotation rendering in the same patch as recognition/runtime;
- sealed P01/P04/P06/P07;
- deployment or public claims.

## Remaining unknowns and required physical work

- The exact OpenCV.js/WASM object or control path behind the numeric registration exceptions is unknown and requires instrumented reproduction.
- Current evidence cannot measure cross-device generalization because every August scan used one iPhone/runtime.
- No retained independent burst views exist for the Grade 1 decisions, so true capture-view disagreement is unavailable.
- P09's August mixed Q1-Q2 differ visibly from July labels. The August page is authoritative here, but the physical history of those two inscriptions is not established.
- The safe generality of a `5/8`, `3/7`, or edge-clipped `0/1` second-reader veto cannot be inferred from one error each.
- Annotation alignment must be verified on a real device after any transform-only fix.
- Endurance, memory, thermal, timeout, recovery, and manual-correction behavior require the agreed old-iPad/iPhone physical protocol.
- Prospective performance remains unknown until a frozen candidate is tested once on sealed P01/P04/P06/P07. Those packets remain untouched.

The defensible conclusion is narrower than “improve the threshold”: preserve the known Grade 1 evidence, repair automatic precision first, reproduce the independent registration runtime fault, and advance only small layer-specific candidates through grouped saved-evidence gates and then sealed physical testing.
