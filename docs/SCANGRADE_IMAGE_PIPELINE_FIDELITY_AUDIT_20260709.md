# ScanGrade image-pipeline fidelity audit

Date: July 9, 2026
Scope: captured frame through final digit tensor
Safety: handwritten truth only; no answer-key inference; no production behavior changed

## Executive finding

ScanGrade is losing fidelity in more than one place, but the losses are not evenly distributed.

The strongest evidence points to this order:

1. **Global perspective correction leaves local answer-box drift**, especially on more angled or non-flat pages.
2. **Digit cropping is sometimes too shifted, narrow, or contaminated by borders**, so information is missing before recognition begins.
3. **Strict ink extraction sometimes removes real handwriting along with printed artifacts.**
4. **Reduction to isolated 28×28 digits creates smaller average losses but severe individual shape changes.**
5. **Candidate selection and recognition remain major independent problems.** Even perfect preprocessing selection cannot repair every failure.

Within the accepted captures in this corpus, ordinary focus/blur is not the principal problem. All 86 pages passed the capture gate and all used eight-frame bursts. Focus score did not predict errors after controlling for worksheet layout.

The correct architecture is therefore not “fix the camera” or “replace the model.” It is a fidelity-preserving cascade:

- stronger capture/perspective gate;
- global homography plus local answer-frame registration;
- context-preserving crops with safe margins;
- multiple non-destructive preprocessing lanes;
- whole-answer recognition alongside the digit model;
- calibrated selection and rapid human confirmation.

## Evidence audited

- 86 captured pages.
- 865 truth-labelled filled digit slots.
- 10 worksheet layouts.
- Captured page, warped page, raw digit crops and final model inputs.
- Regenerated grayscale, ink-mask, strict, gentle, no-rule and no-component stages for all 865 digits.
- Stored crop rectangles and expected layout rectangles.
- Capture focus, luminance, burst and detected-corner geometry.
- Current and alternate preprocessing predictions.

Historical limitations remain: there are no durable student IDs, packet IDs or true flatbed reference scans. The results are diagnostic R&D evidence, not launch validation.

## Stage-by-stage verdict

### 1. Camera capture and burst selection

Observed capture characteristics:

- All 86 pages passed `sheetOk`.
- Every page used an eight-frame burst.
- Focus score ranged from 667 to 2,308; median 1,088.
- The configured final focus threshold was approximately 650 in these records.

Evidence:

- Page focus score versus error rate: Spearman 0.15 before layout adjustment and 0.06 after it.
- Row pages alone: -0.01.
- Non-row pages alone: 0.14.
- Synthetic mild blur changed adapted whole-answer accuracy from 78.8% to 77.6%.
- Stronger Gaussian blur produced 78.0%; half-resolution produced 77.6%.

Interpretation:

- These accepted pages contain enough basic image detail for recognition.
- Tightening the focus threshold alone is unlikely to create a major gain.
- This corpus cannot tell us how many bad captures are rejected before debug capture, nor how a true high-quality recapture would perform.
- The top burst frames are not preserved, so real cross-frame OCR consensus cannot be replayed.

Verdict: **not the primary loss in the accepted corpus; instrumentation gap remains.**

### 2. Perspective correction and page warp

Perspective was measured from the four detected source anchors using width/height ratios and corner-angle deviation.

Evidence:

- Overall perspective severity versus page error rate: Spearman 0.24.
- After subtracting each layout's mean error rate: 0.24.
- Width distortion versus layout-adjusted error rate: 0.33.
- Lowest-perspective quartile: 81.6% digit accuracy.
- Highest-perspective quartile: 71.7%.
- Within-layout low-versus-high perspective groups: 75.3% versus 68.5%.
- Within-layout low-versus-high width distortion: 79.4% versus 64.1%.

Most importantly:

- Page perspective severity versus mean downstream crop-center shift: Spearman approximately 0.75.
- Maximum corner-angle deviation versus crop-center shift: approximately 0.74.
- More perspective generally produced narrower detected boxes.

The four anchor points are globally mapped, but the paper between them can remain locally distorted because of page curl, wrinkles, camera geometry, marker estimation and imperfect local frame detection. The warped-page artifacts visibly retain local skew on the more angled examples.

Verdict: **meaningful contributor, primarily through local crop misalignment after the global warp.**

Candidate offline gate to test—not yet a production threshold:

- max corner deviation around 9° or more;
- width ratio around 1.10 or more;
- composite perspective severity around 0.25 or more.

These correspond roughly to the worse quartile in this corpus. The proper response may be recapture or stronger local registration, not simply rejecting the page.

### 3. Answer-frame detection and digit cropping

Stored crop boxes were compared with their expected layout positions.

Evidence after comparing low and high quartiles within each layout:

- Low crop-center displacement: 75.7% accuracy.
- High crop-center displacement: 65.4%.
- Narrower detected boxes: 68.7%.
- Wider detected boxes: 79.9%.
- Shorter box-height group: 72.9%.
- Taller box-height group: 64.0%, often reflecting border or neighboring-content contamination rather than useful handwriting.

Visual inspection found several distinct crop failures:

- a stroke crossing the slot boundary was clipped;
- a printed right border occupied a large fraction of the crop;
- two-slot splitting separated a digit from part of its stroke;
- local box movement changed which printed guide fragments entered the crop;
- crossed-out or overwritten answers placed multiple plausible shapes in one slot.

The crop-variant evidence supports this diagnosis. Among 224 current digit errors:

- 75 had the correct truth digit in at least one alternate crop-geometry lane;
- 33 were crop-only rescues, with no correct same-crop preprocessing lane;
- edge-band, low-slot, wide-slot and raw-border variants each rescued different failures.

No single wider/raw crop should replace the current system. The raw-border lane alone was worse overall because printed frames can overwhelm handwriting. The evidence supports retaining context and improving selection, not removing all cropping constraints.

Verdict: **one of the largest mechanical sources of avoidable information loss.**

### 4. Grayscale conversion

The raw crop and grayscale artifacts were visually and numerically compared.

- Handwriting shape and edges were generally preserved.
- No systematic failure was attributable to RGB-to-grayscale conversion.
- The source corpus is mostly pencil/graphite on light paper, so color carries limited extra signal.

Verdict: **fundamentally sound and not a priority.**

Color should still be retained in debug evidence and for future colored-pencil/marker tests.

### 5. Ink extraction and printed-line cleanup

For every digit, the current strict ink mask was compared with a gentle lane that retains more of the source crop.

Overall:

- Least strict-versus-gentle ink removal quartile: 76.4% accuracy.
- Most removal quartile: 62.0%.
- Correct reads lost an average 6.4% of gentle-lane ink mass.
- Wrong reads lost an average 11.2%.

For two-slot/virtual digits:

- Least-destructive quartile: 81.3%.
- Most-destructive quartile: 60.8%.
- Correct reads lost 8.3% on average; wrong reads lost 13.6%.

The named `ruleArtifactCleanup` stage alone did not explain the loss: its high- and low-removal quartiles performed similarly. Nor did disabling component cleanup globally improve performance. The damaging difference comes from the combined strict configuration: background thresholds, local contrast scale, faint-ink suppression, edge/line handling and small-component removal interact.

This matters because isolated pencil strokes can look statistically similar to faint printed guides. Aggressively keeping everything is also unsafe: always using gentle, no-rule or raw-border inputs performed worse than the current multi-variant policy.

Verdict: **significant conditional loss; preserve parallel lanes rather than choosing one universal cleanup.**

### 6. Centering, scaling and 28×28 conversion

The conversion centers the detected ink bounding box and preserves its nominal aspect ratio, but the bounding box itself has already been changed by thresholding and cleanup. At 28×28, small gaps and endpoints can disappear or join.

Evidence:

- An identical small classifier trained on raw grey crops versus production-normalized black inputs was repeated with four seeds.
- Average validation: raw 67.4%, normalized 63.0%.
- Average page-block holdout: raw 57.3%, normalized 55.3%.
- Mean strict-ink-to-tensor aspect distortion was 0.056 for correct reads and 0.087 for wrong reads.
- Among single-slot digits, the lowest aspect-distortion quartile scored 81.3%, versus 60.4% for the highest.

The average loss is modest, but individual artifacts are substantial:

- an open `5` becomes visually closed and resembles `6`;
- faint endpoints disappear;
- a narrow `4` can resemble `1`;
- a child-style `1` remains indistinguishable from `7` without page/writer context;
- erased or overwritten shapes become a dense composite glyph.

Verdict: **secondary average loss with severe tail failures; the 28×28 isolated-digit representation is too restrictive as the sole recognition input.**

### 7. Recognition and candidate selection

Current digit accuracy on these 865 filled slots is 641/865 (74.1%).

Of 224 current errors:

- 104 had the correct digit in at least one stored variant.
- 71 had a correct same-crop preprocessing variant.
- 75 had a correct crop-geometry variant.
- 42 had both.
- 29 were preprocessing-only rescues.
- 33 were crop-only rescues.
- 120 had no correct stored variant.

This routes the failures:

- roughly 46% of current errors contain recoverable evidence but need safer selection;
- roughly 54% require better crops, a stronger recognizer, more context, or genuinely contain insufficient/ambiguous information.

The best individual alternate lane did not beat the current selector:

- current selection on variant-available rows: 72.2%;
- edge-band slot: 70.3%;
- wide slot: 67.1%;
- gentle: 66.4%;
- strict: 51.3%.

Simple fidelity-metric selectors were tuned only on calibration and tested on validation/holdout. They produced at most tiny, inconsistent gains and introduced new errors. For example, a calibration-selected wide-slot rule moved validation from 77.1% to 78.3% and holdout from 72.8% to 73.8%, but its changed predictions were frequently wrong. This is not safe enough for production.

Verdict: **candidate diversity is useful; simple rule selection remains unreliable.**

## What the visuals show

Two generated artifacts summarize the audit:

- `pipeline-stage-contact-sheet-20260709.png`: the same handwriting across raw crop, grayscale, strict ink, strict tensor, gentle ink/tensor and cleanup variants.
- `perspective-stage-contact-sheet-20260709.png`: lower- and higher-perspective captures of the same worksheet layout, including warped pages and actual OCR rectangles.

The stage sheet shows that some failures exist before preprocessing, some are created by cleanup/resizing, and others remain authentically ambiguous. That is why one normalization setting cannot solve the system.

## Recommended technical changes

### Priority 1: local registration after homography

Keep the four-marker global homography, then align each printed answer frame locally before splitting or cropping.

Offline experiment:

1. Detect the full printed answer frame using its horizontal and vertical edges.
2. Fit a local affine or small projective correction for that frame.
3. Extract the whole answer zone plus safety margin.
4. Derive digit slots from the locally registered frame, not only global template coordinates.
5. Compare crop-center displacement, clipping and truth accuracy before changing production.

Success gate:

- reduce the high-shift quartile substantially;
- improve non-row/page-block validation without introducing confident errors;
- retain incorrect student answers exactly.

### Priority 2: make the whole grey answer crop a first-class input

Do not make recognition depend exclusively on 28×28 black digits.

- Preserve a whole-answer crop before digit splitting and line erasure.
- Send it to the ScanGrade-adapted whole-answer recognizer.
- Keep the current digit candidates as independent evidence.
- Initially use the whole-answer result only to rank teacher-review suggestions.

This directly bypasses the stages where the largest visible fidelity losses occur.

### Priority 3: replace destructive cleanup with evidence-preserving lanes

Retain at least:

- strict printed-line removal;
- gentle faint-ink-preserving extraction;
- locally registered edge-band crop;
- whole-answer grey crop.

Do not average or merge their pixels. Keep them independent so agreement is meaningful. Store model/version/transform metadata with every candidate.

### Priority 4: improve capture gating for geometry, not just focus

Prototype a warning when page geometry enters the worse perspective range. The message should ask the teacher to move more directly above the page or flatten it.

Also preserve the top two or three burst frames temporarily in an explicit debug/research mode so cross-frame crop consensus can be measured. Do not increase private-image retention silently.

### Priority 5: increase diagnostic fidelity

The production debug packet should optionally preserve, under private diagnostic controls:

- selected captured frame and top alternate frame IDs;
- detected source anchors;
- warped page;
- expected and locally detected answer frame;
- whole-answer crop before line erasure;
- digit crop before and after known-line erasure;
- grayscale;
- strict/gentle ink masks;
- final tensors and selected candidate;
- crop displacement and clipping metrics.

The current packet lacks the pre-erasure crop and alternate burst frames, preventing exact attribution for some failures.

## Tests required before production changes

1. Re-run the 865-digit corpus and 374-answer fresh replay unchanged as baseline.
2. Implement local registration behind an experiment flag.
3. Export paired before/after stage sheets for every changed answer.
4. Score by page-block split, layout, slot and answer length.
5. Confirm that every newly auto-accepted answer matches handwritten truth.
6. Treat any new confident transcription error as a failed experiment.
7. Separately measure review-suggestion quality; suggestion errors must not become automatic grades.
8. Collect paired high-quality and normal recaptures of the same pages when possible. Synthetic blur cannot answer the full camera-ceiling question.

## Bottom line

The stray visual observation was valuable. ScanGrade is indeed throwing away or distorting useful handwriting information—but not in one single conversion.

The largest actionable fidelity problem is the interaction between residual local page distortion, crop geometry and strict ink extraction. The 28×28 conversion adds further tail risk. Camera focus is not the dominant issue among accepted captures.

The next engineering move should be a locally registered, context-preserving whole-answer lane running alongside—not replacing—the current conservative digit pipeline.
