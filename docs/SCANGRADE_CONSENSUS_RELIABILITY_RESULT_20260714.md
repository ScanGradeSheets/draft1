# ScanGrade conservative-consensus reliability result

Date: 2026-07-14 (America/Toronto)

Status: experimental candidate validated on retained evidence; production behavior remains unchanged

## Plain-English verdict

The most promising improvement is not a wholesale replacement of ScanGrade's existing OCR. It is a second, higher-fidelity reading lane that looks only at answers the browser is unsure about.

For each yellow answer, the candidate keeps the larger grayscale answer image, asks the stronger whole-answer reader to read three saved frames, and compares that result with an independent compact model and the browser's own preprocessing evidence. It accepts an answer automatically only when all three large-image frames agree, the compact model independently supports the same text, the answer fits the worksheet's slot count, and no safety or ambiguity rule objects. It does not see the mathematical answer key while choosing the transcription.

On an exact matched replay of 40 saved pages:

- Feature off: 172/275 scorable answers automatic (62.5%), 172/172 matched handwritten truth.
- Feature on: 222/275 automatic (80.7%), 222/222 matched handwritten truth.
- Net gain: 50 answers, all 50 matched the labels, with no demotions and no changes to any previously automatic output.

That is a material jump. It is not yet a launch claim. The policy was developed using these packets, the corpus is correlated and small, and two label errors were discovered during visual audit. The candidate should remain behind its experiment flag until a blinded, untouched evaluation is run.

## What changed

### 1. Weak confidence-clearance safety

The retained historical `4→9` failure used a dangerous path: a weak box-safe override cleared a read even though the majority of that digit's own preprocessing variants preferred a different digit. The new key-blind safety rule forces review when:

1. that narrow weak-clearance path is present;
2. the preprocessing majority describes a complete alternate answer; and
3. the independent compact whole-answer model supports that alternate.

This catches the retained `4→9` case without rewriting it to the mathematically correct answer. The safety audit found four correct accepts that would also be demoted across the combined evidence. That is the expected conservative cost of blocking this path. The rule remains opt-in through `v3ConfidenceSafety=1`.

### 2. Conservative multi-model consensus

The automatic selector requires all of the following:

- exactly three usable large-grayscale frames;
- the same whole-answer transcription on all three;
- minimum visible-token confidence of 0.70 on every agreeing frame;
- the same answer in the compact model's top two;
- compact joint probability at least 0.05;
- if compact ranks it second, at least 25% of compact's top score;
- proposed length no greater than the physical answer-slot count;
- no stable, strong conflict from the browser's own preprocessing majority;
- no dominant confidence-safety veto;
- no model-family disagreement or crop-clipping ambiguity signal.

The selector never receives the mathematical answer key or handwritten truth. Truth is joined only after decisions are frozen for scoring.

### 3. Whole-answer grayscale is first-class evidence

The larger grayscale answer zone is now a primary experimental evidence source. The 28×28 browser digit crops remain useful for fast local grading and as a conflicting-evidence check, but they no longer carry the whole decision for promoted yellow answers.

Only displayed yellow answers are sent to the optional strong reader. This keeps the browser result first, reduces inference volume, and preserves fail-open behavior.

### 4. Ambiguity handling

The ambiguity detector forces review when independent model families disagree, when answer ink may be clipped, or when an accepted weak override retains a material rival under high uncertainty. Extremely high confidence alone cannot overrule these signals.

The known overwritten `34` remains yellow. The browser read `37`, the large reader saw `39`, and compact evidence differed; the candidate did not silently choose among them.

### 5. Two-digit and optional-slot safeguards

The worksheet's physical slot count constrains the proposed answer length. A one-digit response may occupy a two-slot answer area when the other slot is genuinely empty, but a proposed answer can never exceed the slot count. This blocks duplication failures such as `12→1212`.

The browser integration recomputes mathematical grading only after the independently selected transcription is applied. This matters for incorrect student work: if a student wrote `40` where the key says `15`, consensus may automatically preserve `40` and correctly mark it red. It must never replace it with `15`.

## Failure and architecture map

| Observed failure | Where information is lost or misused | Current response | Next technical move |
|---|---|---|---|
| Clear page image, degraded 28×28 digit | Cell segmentation, print removal, normalization, or downsampling | Larger grayscale whole-answer lane bypasses the destructive representation | Keep source zone and multiple views; never reconstruct missing strokes from the key |
| Blank or neighboring answer crop | Local geometry/frame matching after global warp | Consensus cannot promote without matching independent evidence; wider crop remains review-only | Layout-specific zone metadata and local registration, especially mixed/non-row sheets |
| Weak override beats preprocessing majority | Confidence-clearance policy | Key-blind safety veto forces yellow | Remove or narrow the legacy clearance after a prospective gate |
| Models strongly disagree | Recognition/handwriting ambiguity | Ambiguity detector forces yellow | Add validated overwrite/cross-out features; do not use confidence alone |
| One model confidently wrong | Recognition calibration | Require independent model and cross-frame agreement | Calibrate on student/packet-held-out data, not answer-level random splits |
| `12→1212` or missed optional leading slot | Whole-answer sequencing/slot semantics | Enforce physical slot count; right-align a one-digit answer in two optional slots | Add explicit required/optional slot metadata per layout |
| Non-row answer-zone drift | Worksheet-specific geometry | Same strict consensus helps but coverage remains lower | Improve layout contracts and local zone anchors without loosening disagreement rules |
| Capture is unusable or services fail | Camera/runtime/network | Existing capture gate or local yellow review; optional lane fails open | Physical-device gate, retry/recovery telemetry, authenticated hosted redundancy |

The evidence does not support blaming the phone camera for most retained yellow answers. In the prior 14-yellow visual audit, all target handwriting was readable on the saved page photos; two answers had definite downstream crop/geometry failures, while the rest were primarily recognition or ambiguity failures. Across accepted captures, focus/lighting/perspective associations with review were weak (largest simple correlation about 0.25). Perspective still matters locally: an earlier fidelity audit found digit accuracy of 81.6% in the lowest-perspective quartile versus 71.7% in the highest, and perspective severity correlated about 0.75 with downstream crop-center shift. The correct conclusion is “capture quality can cause individual failures,” not “better photography alone will deliver the required jump.”

Blank/artifact automation remains unvalidated. These four packets contain no verified clean blank sample; the old blank score called a written `9` blank after its crop lost ink. Therefore blank/erasure behavior stays manual-review territory. Crossed-out and overwritten work also lacks enough labelled examples for a calibrated detector; current model-family disagreement can only conservatively keep it yellow.

The recent benchmark contains only one- and two-digit answers. There is no defensible three-plus-digit claim. For two-digit answers, answer-level automatic correctness implies both left and right positions matched truth in all 135 automatic cases, but this does not isolate the independent error rate of each position. A position-level report requires locked per-digit truth, including explicit empty optional slots; that dataset is still missing and is part of the next labelling protocol.

## Exact recent-packet benchmark

Source: `private-evidence/reports/consensus-integration-four-packet-score-20260714.json`

| Slice | Scorable | Automatic | Coverage | Correct automatic | Wrong automatic |
|---|---:|---:|---:|---:|---:|
| Overall | 275 | 222 | 80.7% | 222 | 0 |
| Row | 160 | 137 | 85.6% | 137 | 0 |
| Non-row | 115 | 85 | 73.9% | 85 | 0 |
| One digit | 100 | 87 | 87.0% | 87 | 0 |
| Two digits | 175 | 135 | 77.1% | 135 | 0 |

Five visually ambiguous/unscorable labels were excluded from the denominator. All 280 answer groups were present, all 40 pages completed, every automatic annotation agreed with the final review state, and every page produced a marked sheet.

Packet results were:

- P08: 52/70 automatic (74.3%), zero observed errors.
- P03: 60/67 (89.6%), zero observed errors; three ambiguous labels excluded.
- P09: 61/70 (87.1%), zero observed errors.
- P02: 49/68 (72.1%), zero observed errors; two ambiguous labels excluded.

## Exact matched control

Source: `private-evidence/reports/consensus-matched-comparison-20260714.json`

The control and candidate used the same current browser build, same confidence-safety option, same 40 pages, same service implementations, and same scoring truth. The only intended difference was `v3ConsensusPromotion`.

| Slice | Control | Candidate | Gain | Correct promotions | Wrong promotions |
|---|---:|---:|---:|---:|---:|
| Overall | 172/275 (62.5%) | 222/275 (80.7%) | +50 | 50 | 0 |
| Row | 112/160 (70.0%) | 137/160 (85.6%) | +25 | 25 | 0 |
| Non-row | 60/115 (52.2%) | 85/115 (73.9%) | +25 | 25 | 0 |

The exact diff verified:

- all 280 rows matched between runs;
- all 50 changes were promotions from review;
- no automatic answer was demoted;
- no previously automatic output changed;
- no unrelated non-promotion output changed.

## Historical stress test

Source: `private-evidence/reports/consensus-historical-single-frame-stress-20260714.json`

Historical records do not contain the real three adjacent frames required by the final policy. A deliberately weaker one-frame surrogate was therefore used only as a falsification stress test:

- 578 scorable answers;
- current: 304 automatic (52.6%), zero observed errors;
- surrogate candidate: 448 automatic (77.5%), zero observed errors;
- row: 230/261 (88.1%);
- non-row: 218/317 (68.8%);
- the retained dangerous `4→9` stayed review;
- the known clean `45→15` failure stayed review.

This supports the architecture, but it is not equivalent to prospective three-frame validation and must not be presented as such.

## Truth-label audit and leakage limits

Visual audit found two source-label errors and preserved the original files while applying a separate scoring overlay:

- one handwritten `14` had been labelled `16`;
- one handwritten `2` had been labelled `6`, duplicating the mathematical key.

Overlay: `private-evidence/truth-labels/20260703-flex-duplicate-accepted-needs-label/consensus-visual-audit-corrections-20260714.json`.

This is direct evidence that answer-key contamination is a real risk. The selector itself is key-blind, but the reported numbers still depend on imperfect human labels. Future locked-set labels require independent visual verification before the predictions are revealed.

The recent 40-page result is post-hoc development evidence. Pages from a packet, student, worksheet template, and capture session are correlated; answer-level counts overstate independence. No confidence interval can repair that design limitation.

## Runtime, privacy, and failure behavior

Only yellow answers enter the optional evidence lane. The browser's local result appears first and remains usable if either service fails.

In WebKit mobile emulation over HTTPS:

- local result: 4.33 seconds;
- consensus complete: 13.59 seconds;
- added asynchronous wait: about 9.25 seconds on the tested local CPU setup;
- the overwritten answer stayed yellow;
- the marked sheet was regenerated correctly.

This proves Safari/WebKit code-path compatibility, not real old-iPad camera, memory, thermal, or multi-page stability.

With both optional services unreachable:

- local grading completed;
- no answer was promoted;
- failed requests changed no local output;
- the teacher received a clear message;
- manual keypad correction worked;
- the temporary token did not appear in URLs or captured logs.

No student image needs to be retained by the service. A production cloud deployment still requires authenticated short-lived access, `no-store` responses, encrypted transit, explicit retention policy, provider contractual review, observability without images, and capacity/cold-start testing.

## Decision matrix

| Component | Decision | Reason |
|---|---|---|
| Narrow confidence-clearance veto | Promote to next private-beta candidate, behind flag | Blocks a demonstrated dangerous path key-blind; conservative cost measured |
| Three-frame large-grayscale + compact consensus | Strongest shadow/private-beta candidate | Exact matched gain of 50 correct promotions and zero observed errors |
| Raw model confidence as selector | Reject | Historical wrong reads exist above 99.5% confidence |
| Answer-key-aware transcription choice | Reject | Would silently turn incorrect student work into the expected answer |
| Model-family disagreement override | Reject | Disagreement is an ambiguity signal, not permission to guess |
| Slot-count constraint | Promote with candidate | Blocks impossible-length and duplicated outputs without answer values |
| Row-only special rule | Postpone | The same conservative rule materially helped both families; non-row remains lower and needs more validation |
| Non-row layout-specific zone work | Continue in shadow | Non-row improved to 73.9% but remains the limiting family |
| Strong model on every answer | Reject | Unnecessary latency, cost, and privacy exposure |
| Optional strong model on yellow answers | Keep | Provides high-fidelity evidence with bounded inference volume and fail-open behavior |

## What is demonstrated, plausible, and unproven

Demonstrated on retained evidence:

- the candidate can raise matched automatic coverage from 62.5% to 80.7%;
- every one of the 50 promoted reads matched the audited labels;
- incorrect student math can be transcribed automatically without answer-key guessing;
- the known overwritten answer and retained historical dangerous cases stay yellow;
- production defaults are unchanged;
- optional inference outage does not prevent completion.

Plausible:

- a secure cloud version can provide the same evidence without depending on a home Mac;
- faster hosted inference and request batching can reduce the observed asynchronous delay;
- additional layout-specific non-row metadata can close part of the remaining row/non-row gap.

Unproven:

- the error rate on genuinely unseen students and packets;
- performance on unseen worksheet templates and real live bursts;
- crossed-out, erased, blank, and clipped cases at launch scale;
- physical old-iPad sustained operation;
- hosted latency, reliability, privacy operations, and cost;
- whether teachers tolerate the remaining 19.3% review rate and asynchronous delay.

## Recommendation and evidence gate

Freeze this policy as the leading private-beta candidate. Do not retune it on P02/P03/P08/P09 and do not turn it on for ordinary users yet.

The next decisive test should be blinded and packet-level:

1. Freeze code, service model hashes, thresholds, layout files, and a scoring script.
2. Choose a reserve packet before scanning, without looking at the student's handwriting quality.
3. Have a person label handwriting from answer images without the answer key and without seeing predictions; independently adjudicate ambiguous marks.
4. Run once, publish all automatic errors and exclusions, and do not tune against it.
5. Require zero catastrophic confident errors, zero ordinary confident transcription errors in that small gate, no regression in capture/annotation/manual recovery, and a material coverage gain over the matched control.

Even a clean reserve packet is only a private-beta gate, not proof of “100% accurate.” A launch reliability claim requires substantially more unseen students, templates, devices, captures, wrong math answers, blanks, erasures, and ambiguous work. With zero observed errors in `n` automatic answers, the rough one-sided 95% upper bound is about `3/n`; 222 clean automatic reads still permit a true error rate around 1.35% statistically. Correlation makes the effective evidence weaker.

## Three immediate actions

1. **Completed in this goal:** freeze and hash the candidate plus its exact blinded evaluation protocol; stop threshold tuning on the four development packets.
2. Run one predeclared reserve packet as a locked private-beta gate, preserving the other packets for later architecture decisions.
3. If it passes, deploy the yellow-only whole-answer lane to an authenticated cloud staging service and test physical old iPad, outage, latency, privacy, and teacher review time before any paid promise.

## Reproduction map

Core implementation:

- `src/v3/confidence-safety.js`
- `src/v3/consensus-promotion.js`
- `src/v3/ambiguity-detector.js`
- `src/v3/consensus-application.js`
- experimental integration in `src/components/CameraCapture.vue`

Tests and evaluators:

- `tests/v3-confidence-safety.test.mjs`
- `tests/v3-consensus-promotion.test.mjs`
- `tests/v3-ambiguity-detector.test.mjs`
- `tests/v3-consensus-application.test.mjs`
- `scripts/evaluate_consensus_promotion_policy.mjs`
- `scripts/evaluate_consensus_historical_single_frame_stress.mjs`
- `scripts/score_consensus_integration_replay.mjs`
- `scripts/compare_consensus_matched_control.mjs`
- `scripts/test_consensus_webkit_saved_page.mjs`

Primary evidence:

- `private-evidence/reports/consensus-matched-control-four-packet-score-20260714.json`
- `private-evidence/reports/consensus-integration-four-packet-score-20260714.json`
- `private-evidence/reports/consensus-matched-comparison-20260714.json`
- `private-evidence/reports/consensus-historical-single-frame-stress-20260714.json`
- `private-evidence/reports/consensus-webkit-saved-page-20260714.json`
- `private-evidence/reports/v3-local-first-failure-recovery-20260714.json`
- `private-evidence/protocols/consensus-candidate-freeze-20260714.json` (SHA-256 manifest for 33 code, model, layout, truth-overlay, and reference-result files)

Nothing in this investigation was deployed, pushed, or made the production default.
