# ScanGrade Independent Product, Technical, and Business Review

Date: 2026-07-09
Scope: repository, private local evidence, current app replay, product documents, and current external alternatives
Decision status: recommendation for Tony's approval; no production direction changed by this review

## 1. Executive verdict

ScanGrade has a credible route to market, but not as a broad “photograph any elementary worksheet and it grades handwriting automatically” product in September.

The project has built several genuinely valuable assets: a full paper-to-result loop, QR-linked layout metadata, a conservative trust policy, reproducible captured-image replay, a meaningful body of authentic Grade 1 handwriting, explicit handwritten truth, worksheet generators, and a review queue. That is more than a prototype. It is an early vertical system with a promising reliability core.

The current evidence does **not** establish launch-grade generalization. I reproduced the headline replay exactly: 233 of 374 labelled answers were auto-accepted (62.3%), and all 233 matched handwritten truth. Row sheets reached 136/176 auto (77.3%); non-row sheets reached 97/198 (49.0%). This is a useful development result, but the same corpus has been inspected and used repeatedly to tune confidence rules. It has no durable student or packet identifiers, uses only one recorded device/user-agent in this slice, omits handwritten truth for 98 replayed question groups, and does not include unseen templates. “Zero errors observed” here is not evidence of a zero error rate. With 0 errors in 233 correlated, repeatedly tuned decisions, even the naive one-sided 95% rule-of-three upper bound is about 1.28%.

The best risk-adjusted route is a staged, constrained-format product:

1. Launch paid, high-quality **ScanGrade-authored Grade 1 worksheet packs** through Teachers Pay Teachers.
2. Include scanning as a clearly labelled beta/companion benefit for a narrow family of row-based, numeric final-answer worksheets.
3. Make a fast, crop-first teacher review workflow—not 95% auto coverage—the first product performance target.
4. Keep the current client-side capture, QR, homography, and safe fallback. Develop a server-assisted recognizer and whole-answer model behind an experiment flag, but do not make it a launch dependency until privacy and held-out evidence are ready.
5. Postpone non-row auto-grading, Grade 2/3 three-digit answers, arbitrary third-party worksheets, formal assessment claims, and universal old-iPad grading.

The biggest existential risk is not model accuracy in isolation. It is whether a constrained worksheet-plus-review workflow saves enough teacher time, often enough, to justify changing classroom routines and paying for the product. That has not yet been measured.

## 2. What ScanGrade currently is

### Product state

ScanGrade is a Vue/Vite browser app with Student and Teacher modes. A student selects a name, scans a QR-linked worksheet, and the app attempts to detect, rectify, read, grade, annotate, and save it. A teacher can review stored results and likely-read suggestions. Persistence falls back to browser localStorage; Cloudflare Pages/D1 endpoints exist but are not proven as the production classroom path.

### Concise system map

| Stage | Current implementation | Assessment |
|---|---|---|
| Capture | Browser `getUserMedia`, live gates for page/marker/focus/brightness, 8-frame autofocus burst, manual fallback | Sound direction; current evidence is mostly one modern iPhone |
| Page detection | OpenCV page geometry plus four black corner-marker detection and plausibility gates | Fundamentally sound for authored sheets; marker/QR dependency is an intentional constraint |
| Perspective correction | Homography to a canonical 1700×2200 page | Sound, but local distortion and answer-box refinement remain imperfect |
| Layout identification | QR payload loads a versioned layout; printed-title fallback is forced to review | Good safety architecture; arbitrary worksheets are not supported |
| Answer extraction | Layout JSON defines boxes/question groups; local outline/line refinement; virtual slots split multi-digit frames | Main reliability bottleneck for border-hugging and non-row answers |
| Normalization | Many 28×28 tensor variants: border/rule cleanup, shifts, scales, blur/sharpen, recentering, slot variants | High candidate diversity; complexity is now difficult to calibrate |
| Recognition | ONNX Runtime Web, ScanGrade/MNIST-derived digit CNNs, optional right-slot model, robust variant inference | Repairable; current filled-digit accuracy is about 74% on the broader labelled digit set |
| Candidate selection | Weighted votes, shape-specific rescues, slot-specific heuristics, answer-level promotion rules | Overgrown and evidence-fragile; correct answer often exists among variants, but safe selection has resisted simple/learned rules |
| Confidence | Conservative review gates, source-aware thresholds, scan rejection, engine-failure review fallback | Strong trust instinct; tuned against reused evidence and not yet statistically calibrated |
| Answer-key use | Grading plus narrow review/tiebreak signals; some context-assisted suggestions; guard against broad answer-key correction | Principle is correct; auditability must remain explicit |
| Grading | OCR transcription compared with layout answer key; student-written wrong answers can become confident red Xs | Correct separation in current scorer and policy |
| Annotation | Checks/Xs/yellow marks placed using expected layout geometry, with overlay debug capture | Contact-sheet evidence is encouraging; no formal annotation acceptance corpus |
| Teacher review | Saved submission cards, yellow answers, likely-read chips, status changes | Useful scaffold; not yet timed or optimized around a class-set queue |
| Debug/replay | Token-protected Mission Control upload saves captured/warped/marked images, crops, tensors, JSON; captured-image replay | A major project asset and the best part of the engineering process |
| Storage/privacy | Debug evidence is local and git-ignored; app records use localStorage or unproven D1 API; student names are stored | Prototype boundary only; retention, consent, deletion, access control, and production data residency are not complete |
| Worksheet generation | Multiple Node generators, PDFs/SVGs, answer keys, 33 layout definitions, layout audit | Strong differentiator; 63 audit warnings show many formats are exploratory |
| Deployment | GitHub Pages public prototype, pruned 69 MB build, Cloudflare scaffold, separate legacy capture page | Prototype-grade; Pages deployment history and large runtime are support risks |
| Devices | Modern browser path; iOS 12.5.7 legacy capture-only route; review-only fallback on model failure | Old-device local grading is not demonstrated |

### What is sound, repairable, and limiting

- Fundamentally sound: authored-sheet QR/layout contract, marker-based normalization, separation of transcription from correctness, conservative review/failure behavior, captured-image replay, local-first inference, worksheet generators.
- Repairable: crop geometry, blank/artifact detection, digit model, answer-level candidate selection, confidence calibration, review UI, backend persistence.
- Currently limiting: lack of independent holdouts, non-row crop/recognition, one-device evidence, heuristic accumulation in a very large camera component, old-device runtime, and absence of measured teacher time saved.

## 3. Evidence quality and benchmark audit

### Reproduced result

I ran current code through `scripts/replay_live_ocr_captured.mjs` on the saved July 2 debug folders, then scored the results with `scripts/score_replay_against_handwritten_truth.mjs`.

| Metric | Reproduced result |
|---|---:|
| Replay result files | 67 |
| Labelled answer groups matched | 374 |
| Auto/confident | 233/374 (62.3%) |
| Auto/confident matching handwriting | 233/233 (100% observed) |
| Yellow/manual review | 141/374 (37.7%) |
| Yellow current lean matching handwriting | 17/141 (12.1%) |
| Row auto | 136/176 (77.3%), 136/136 correct |
| Non-row auto | 97/198 (49.0%), 97/97 correct |
| One-digit auto | 107/171 (62.6%) |
| Two-digit auto | 126/203 (62.1%) |
| Student answers mathematically correct | 347/374 (92.8%) |
| Replayed groups without handwritten truth | 98 |

Layout coverage ranged from 87.5% on the small mixed-row slice to 38.1% on number bonds. Ten frames were 41.7%, dot collections 54.8%, number patterns 55.6%, and place value 60.0%.

The broader 582-answer truth set previously measured 287/289 confident-correct before the later demotion rule, then the 374-answer current slice reached 233/233. The trend shows the trust gates are doing their job; it does not show stable generalization.

### Digit/crop evidence

The existing 960-slot analysis reports:

- Filled-digit accuracy: 641/865 (74.1%).
- Left filled slots: 75.4%; right: 73.1%; single-slot: 73.2%.
- Blank-slot policy: 36/53 (67.9%).
- Row filled digits: about 83.5%; non-row: about 67.6%.
- Leading confusions: `1→7` (48), `1→9` (18), `6→5` (11), `9→2` (10).
- In 104 currently wrong filled slots, the truth digit was present in another preprocessing variant.
- Current-or-variant oracle: 745/865 (86.1%).

This establishes that both recognition and selection matter. It does not justify promoting alternate candidates: several high-confidence alternatives are wrong, and learned selectors repeatedly harmed holdout cases.

### Leakage and validity audit

The corpus audit created during this review found:

- All 67 scored captures have the same modern iPhone/Safari user-agent.
- None has a durable student ID, packet ID, or template-instance ID.
- The existing digit split function assigns calibration/validation/holdout from ordered page index modulo five, not from a verified student/packet registry.
- All ten layouts are the same known Grade 1 last-week templates used during tuning; there is no unseen-template test in the headline result.
- 199/374 matched truth entries are “seeded-auto-correct,” while 175 are manually labelled. Seeded truth is efficient but should be independently sampled for label QA.
- There were no exact duplicate captured-image hashes within the 67 scored results, which is good. Perceptual duplicate/near-duplicate scanning has not been audited.
- Policies, shape rescues, confidence thresholds, and suggestion gates were repeatedly inspected against this corpus. “Holdout” within it is no longer a final untouched holdout.
- Manual corrections are generally separated using raw upload and `originalDigit`, but correction provenance is not enforced by a versioned data schema.

### Metrics that cannot currently be answered defensibly

- Unseen-student, packet, handwriting-style, or template performance.
- Capture completion/failure rate; saved debug folders condition on an upload occurring.
- Memory use and old-device runtime under a defined device matrix.
- End-to-end latency distribution; captured debug metadata records environment and focus, not consistent stage timings.
- Annotation correctness rate; only visual spot checks exist.
- Cross-device or left/right differences after controlling for layout and writer.
- Blanks, erasures, crossed-out answers, extra marks, wrinkles, and shadows at launch-scale sample sizes.

## 4. Technical architecture assessment

### Capture, page detection, and homography

Keep the authored-sheet marker/QR architecture. It is a rational trade: constrained paper buys reliable geometry and zero teacher setup. Multiple captured frames are already used for focus selection; the next test should measure cross-frame OCR consensus, not merely choose the sharpest frame. If two or three frames yield identical answer-level reads, that agreement may be safer than a larger preprocessing ensemble from one image.

The current capture guards reject bad pages conservatively, but rejected scans and pre-upload failures are not logged as a denominator. Add a privacy-safe capture-event ledger with attempts, device class, failure reason, and timing even when OCR never starts.

### Crops, print removal, and slot design

Non-row weakness is not caused by the math concept itself. It is caused by the relationship between diverse page geometry and insufficiently standardized answer-region image statistics. Number bonds are the clearest example: 47.7% filled-digit accuracy in the broader slot set and 38.1% auto coverage in the current replay.

Keep visual variety in prompts, but standardize the answer zone more aggressively:

- One answer-frame family for launch.
- Fixed physical cell height/width, line weight, padding, and safe gutter.
- No connector, illustration, letter bubble, or work line within the declared safe zone.
- One consistent placement convention for a one-digit answer in a two-cell field; do not accept left/right/leading-zero variants at launch unless classroom testing proves the flexibility is worth the artifact risk.
- Prefer separately bounded digit cells only if authentic September A/B data beats the current design; the synthetic bakeoff showed only a modest 1.6-point question gain and is not decisive.

### Recognizer

Do not replace the current system with generic OCR without testing. Generic OCR systems are trained to read text lines and documents, not tiny isolated child-written digits next to box borders. Google Cloud Vision and Amazon Textract both advertise handwriting support; their OCR is inexpensive enough to benchmark (about $1.50 per 1,000 pages/requests at the first paid tier), but capability claims are not ScanGrade evidence. [Google Cloud Vision handwriting](https://docs.cloud.google.com/vision/docs/handwriting), [Google pricing](https://cloud.google.com/vision/pricing), [Amazon Textract pricing](https://aws.amazon.com/textract/pricing/).

The best custom-model experiment is a **whole-answer recognizer** trained on one- and two-digit answer crops, with a blank token and CTC/classification head, alongside the existing digit path. It can learn spacing and suppress divider artifacts without committing to a brittle split. It must be trained from external digit data plus ScanGrade calibration writers, and evaluated on sealed students/packets/templates.

### Candidate selection and calibration

The current selector stack is too complex for its evidence base. Consolidate toward:

1. A small, documented set of preprocessing lanes.
2. A digit or whole-answer ensemble producing calibrated distributions.
3. A dedicated real-writing/blank/artifact model.
4. Answer-level abstention calibrated on packet-held-out data.
5. Answer-key context recorded as a separate feature/source and initially allowed only to rank review suggestions.

Writer adaptation is worth testing, but only as a second-pass retrieval mechanism: confirmed `1`, `4`, `7`, and `9` exemplars from the same page/packet can compare shape embeddings to an ambiguous slot. Never use the worksheet's expected value as a writer exemplar, and never let adaptation override strong contradictory pixels.

### Client versus server

Recommended staged hybrid:

- Client: capture gate, QR/layout, rectification, privacy redaction/cropping, immediate local fallback, overlay rendering.
- Server beta: versioned whole-answer/digit ensemble, blank/artifact model, calibration, audit logs, model rollback.
- Old devices: capture/upload only, with teacher-device or server processing; no promise of local OCR on iOS 12.

Server processing makes larger models, rollback, observability, and consistent runtime easier. It also creates child-data obligations, connectivity failure modes, latency, and vendor costs. Google states that synchronous Vision images are processed in memory and not persisted and are not used to train its models, but ScanGrade still needs its own consent, retention, access, and deletion design. [Google Cloud Vision data usage](https://docs.cloud.google.com/vision/docs/data-usage).

Apple Vision is attractive for native on-device experiments, but the current product is web-based. Apple's image text request is native, and newer PencilKit handwriting recognition works from captured strokes, not photographed paper. Google ML Kit Digital Ink similarly requires touch-stroke data; it explicitly is not the API for camera images. These are not drop-in replacements for the browser prototype. [Apple Vision text request](https://developer.apple.com/documentation/vision/recognizetextrequest), [Apple PencilKit stroke recognition](https://developer.apple.com/documentation/pencilkit/recognizing-handwriting-and-converting-to-text), [ML Kit Digital Ink](https://developers.google.com/ml-kit/vision/digital-ink-recognition).

### Multimodal VLMs

Use a VLM only as an offline benchmark or review suggestion candidate until it passes a no-answer-key test on representative crops. It may be useful for crossed-out answers, erasures, or whole-page context, but it is particularly vulnerable to answering the math rather than transcribing the handwriting. Prompts must request transcription and `BLANK/UNCLEAR`, hide the answer key in the primary pass, and require structured alternatives with evidence. No VLM result should enter the auto lane without the same held-out error gate as the custom recognizer.

## 5. Root causes of current reliability limits

| Failure family | Evidence | Primary cause | Correct response |
|---|---|---|---|
| Leading `1` read as `7/9` | 66 major context cases; repeated across layouts | Child shape + border/crop + model domain gap | Better crop/model; writer exemplars; review-only context |
| False companion digit | Ten-frame/mixed examples such as `71→7` | Blank/artifact classifier and flexible slot convention | Standardize placement; dedicated blank model |
| Number-bond failures | 47.7% filled-digit accuracy | Local crop geometry captures nearby structure; model domain shift | Answer-zone isolation and retraining |
| High-confidence false variants | Selector experiments fail holdout | Candidate probabilities are uncalibrated and correlated | Calibrate at answer level on sealed packets |
| Old iPad engine failure | iOS 12.5.7 model initialization failures | ONNX/WASM/browser/runtime limits | Capture-only path or server processing |
| Low coverage despite safety | 37.7% yellow overall; 51% non-row | True recognition misses plus conservative gates | Improve signal first; speed review in parallel |
| Unusable two-digit scans | 8/67 guard rejects in fresh replay | Capture/crop/model disagreement | Refuse safely and measure retry success |
| Annotation uncertainty | Visual spot checks only | Missing labelled geometry acceptance set | Landmark/box IoU QA and teacher-visible alignment test |

The most important conclusion is that current coverage is not primarily a threshold problem. Yellow current lean matches handwriting on only 12.1% of the reproduced slice. Broad promotion would fail. Better visual evidence and a faster review experience are both required.

## 6. Product and UX assessment

### Product boundary

ScanGrade does not need arbitrary third-party worksheet support to create value. Arbitrary layout ingestion would remove the strongest source of defensibility—the authored layout contract—and multiply support cases before the core job is proven.

Launch boundaries should be:

- ScanGrade-authored worksheets only.
- Grade 1 addition/subtraction and number facts within 20.
- Final numeric answers only, one or two digits.
- Row-based question families using one standardized answer zone.
- Practice/teacher-assist use, not official assessment records.
- Supported modern iPhone/iPad/Safari and current desktop upload; old iPad is capture-only.

Non-row activities should still be sold as useful worksheets, but automatic scanning should be labelled unsupported/beta until they pass their own gate.

### Is 90–95% auto coverage required?

Not necessarily. The commercially relevant measure is teacher time saved per class set. If 80–85% is automatic and the remaining answers can be confirmed in 10–20 seconds per page or as a question-centric class queue, that may beat manual marking. Conversely, 95% auto coverage with one silent wrong in every few pages will destroy trust.

The review UI should have three operational states:

- Auto: strong transcription evidence; graded.
- Confirm: likely read prefilled, teacher can accept with one tap.
- Inspect/retry: no safe suggestion or scan/crop quality failure.

Do not expose fake numerical confidence to students. Teachers can see a plain reason (“faint answer,” “two readings,” “possible blank”).

### Best review interaction

The current per-submission cards are a scaffold, not the target. Test two modes:

1. Page-first: marked page with a bottom strip of uncertain crops.
2. Question-first batch: all uncertain answers for question 4 across the class, with one-tap digits/blank and keyboard shortcuts.

The second can exploit repeated context without letting the model silently guess. Record raw read, suggestion, teacher choice, and correction provenance separately.

When capture quality is inadequate, do not grade. Show one actionable reason, retain the attempt only with consent/debug mode, and offer manual photo upload or teacher review. A saved all-yellow page is useful only if the crop strip makes review faster than picking up the paper.

## 7. Business viability assessment

### Target customer and job

Initial customer: Grade 1 teachers who use printed math practice several times per week and personally mark class sets. Job: preserve paper, return fast feedback, and cut repetitive marking.

Demonstrated:

- The app can safely auto-grade a meaningful fraction of answers on known Grade 1 sheets.
- The worksheet generator can produce coherent, QR-linked packs.
- The system can preserve authentic wrong math answers instead of forcing the key.

Plausible:

- A constrained row-based product could save time.
- Worksheet packs can generate initial revenue and acquire beta users.
- Review suggestions can make conservative OCR commercially useful.

Speculative:

- Teachers will change their workflow to have students scan.
- Teachers will pay a recurring subscription.
- The product saves more time than manual marking in a live class.
- Broad non-row/Grade 2/3 support is reachable with the current corpus.

Must be validated with teachers:

- Frequency of use, willingness to scan, acceptable worksheet constraints, review tolerance, price, privacy expectations, and support burden.

### Revenue model

Start with a bundled hybrid:

- TPT packs: hypothesize US$6–12 for focused packs and US$20–35 for bundles; validate rather than assume.
- Scanner beta: included with paid packs or free during private beta.
- Subscription later: test US$5–10/month or a low annual teacher plan only after measured recurring time savings.

TPT is an acquisition and payment channel, not the moat. Current seller economics are 55% payout for a US$29 basic seller account or 80% for a US$59.95/year premium account, plus transaction fees. [TPT seller fees](https://help.teacherspayteachers.com/hc/en-us/articles/360044408171-What-types-of-Seller-accounts-are-offered-on-TPT).

The price ceiling is constrained by simple alternatives. ZipGrade offers unlimited OMR/bubble grading for US$6.99/year and supports offline scanning, but it does not solve natural young-child handwritten answers. Its low price anchors “scan grading” expectations while highlighting ScanGrade's differentiated job. [ZipGrade pricing](https://www.zipgrade.com/pricing/), [ZipGrade product](https://www.zipgrade.com/).

### Competition and defensibility

- OMR tools (ZipGrade, Akindi): highly reliable because they constrain marks; strong proof that teachers accept machine-readable paper. ScanGrade differentiates on natural numeric handwriting and younger learners. [Akindi workflow](https://help.akindi.com/en/articles/13379465-getting-started-grading-bubble-sheets).
- General AI graders: broader promise, cloud dependence, and potential answer-key/grade hallucination. They raise customer expectations and price pressure, but ScanGrade can win on transparent constrained reliability.
- Worksheet marketplaces/generators: abundant content, weak scanning integration.

Defensibility would come from the system, not the CNN: scan-safe worksheet design, layout metadata, capture UX, truth-labelled child handwriting, conservative calibration, review corrections, and a trusted teacher workflow. That moat only forms if data provenance and product usage are disciplined.

### Unit economics

Cloud OCR prices are not the obstacle: at roughly $0.0015 per page for generic document text, 1,000 pages cost about $1.50 before storage/compute. Custom GPU inference may cost more but remains small relative to a teacher subscription at early scale. The larger costs are support, privacy/compliance, worksheet authoring, model QA, and refunds from unreliable claims.

## 8. Competitive and technology alternatives

| Alternative | Expected value | Main limitation | Recommendation |
|---|---|---|---|
| Improve current client digit path | Fastest, offline, preserves sunk work | Browser/runtime and heuristic complexity | Keep as baseline/fallback |
| ScanGrade-specific digit CNN | Better domain fit | Limited writer diversity; digit splitting remains | Train only with sealed writer/packet holdouts |
| Whole-answer model | Learns spacing, blank, divider context | Needs more labelled crops | Highest-priority model experiment |
| Dedicated blank/artifact model | Narrow job already showed strong smoke AUC | Current blank labels partly inferred | Manually label and validate next |
| Multi-frame consensus | Free extra evidence at capture | Motion/latency; replay design needed | High-value controlled experiment |
| Writer adaptation | Can resolve recurring `1/7/9` style | Can reinforce an early error | Review-first, confirmed exemplars only |
| Apple Vision native | On-device/privacy, mature framework | Requires native app; unproven on these crops | Small native benchmark, not a rewrite |
| ML Kit image text | Free/on-device native SDK | Generic OCR, not browser; digital ink API is stroke-only | Benchmark crops; no architectural commitment |
| Google/AWS/Azure cloud OCR | Cheap and easy to test | Generic document OCR, child privacy, internet/vendor dependency | Run blinded crop bakeoff |
| Multimodal VLM | Handles erasures/context/whole answers | May solve math instead of transcribe; variable latency/cost | Review-only offline bakeoff |
| Server custom model | Larger models, rapid rollback, consistent runtime | Privacy/backend/connection burden | Stage after data governance |
| Human review | Guarantees accountability | Can erase time savings | Optimize aggressively; measure time |
| Constrained answer zones | Improves every downstream stage | Classroom aesthetic/fine-motor tradeoff | Preferred launch constraint |

## 9. Four strategic routes

### Route A — Incremental current trajectory

- Product: all current Grade 1 packet layouts with conservative client OCR.
- Architecture: current browser ONNX plus more crop rules and confidence tuning.
- Benefit: fastest; no backend/privacy expansion.
- Risk: heuristic debt and evidence overfitting; non-row stays weak.
- Effort/cost: 4–8 engineering weeks; low operating cost.
- Data: current corpus plus September validation.
- Credible launch: 6–10 weeks if scope narrows; otherwise uncertain.
- Falsifier: no held-out coverage gain after two controlled experiments.
- Reversibility: high.
- Upside: moderate; limited by browser/runtime support.

### Route B — Custom-model/server-assisted

- Product: authored sheets, broader layouts, modern and old-device capture.
- Architecture: client rectification/cropping plus server whole-answer model, digit ensemble, blank model, calibration, local fallback.
- Benefit: best technical ceiling and observability.
- Risk: privacy, latency, backend reliability, insufficient training diversity.
- Effort/cost: 8–16 weeks for credible beta; low per-page inference but higher engineering/operations.
- Data: hundreds of packets across writers, devices, templates; external/synthetic pretraining.
- Falsifier: blinded cloud/custom bakeoff cannot exceed current row baseline or preserve error gate.
- Reversibility: medium; server can remain optional.
- Upside: high if data flywheel forms.

### Route C — Constrained-format reliability-first

- Product: ScanGrade-authored Grade 1 row sheets, standardized one/two-digit final-answer zones, fast confirm workflow.
- Architecture: current capture/QR/homography, simplified client recognizer, review-first UI; optional server experiments off the critical path.
- Benefit: highest probability of a trustworthy September product.
- Risk: teachers may reject constraints; auto coverage may remain under 90%.
- Effort/cost: 4–7 weeks plus September validation; low operating cost.
- Data: current row evidence plus sealed September packets.
- Falsifier: review workflow fails to save at least 50% of marking time or teachers dislike the paper.
- Reversibility: high; broader formats can return later.
- Upside: moderate-to-high as a wedge.

### Route D — Worksheet marketplace first; scanner as beta

- Product: premium Grade 1 printable packs; scanner is optional/free beta, not the paid promise.
- Architecture: maintain current app but prioritize content, onboarding, and collection of consented evidence.
- Benefit: earliest revenue and lowest refund/reliability exposure.
- Risk: weak differentiation and crowded TPT market; founder time shifts to content marketing.
- Effort/cost: 2–5 weeks for first polished pack.
- Data: little required for worksheets; scanner learning slows without active beta.
- Falsifier: poor conversion/teacher interest after 3–5 products and direct interviews.
- Reversibility: very high.
- Upside: low-to-moderate alone; valuable as acquisition for Route C/B.

### Route E — Arbitrary worksheet/VLM service

- Product: upload any worksheet and answer key; AI transcribes/grades.
- Architecture: cloud VLM/OCR with layout inference and human review.
- Benefit: broad market story.
- Risk: highest hallucination, privacy, support, and grading-liability exposure; abandons the layout moat.
- Effort/cost: 12+ weeks for a demo, much longer for trust.
- Data: broad multi-grade documents and rubrics.
- Falsifier: representative blinded set produces answer-key guessing or unstable grades.
- Reversibility: medium-low.
- Upside: high in theory, poor risk-adjusted fit now.

## 10. Weighted decision matrix

Weights reflect the next 6–12 months: trust/reliability 30%, time to paid validation 20%, evidence fit 15%, teacher value 15%, defensibility 10%, capital/operating burden 5%, reversibility 5%. Scores are directional (1 weak, 5 strong), not forecasts.

| Route | Trust 30 | Speed 20 | Evidence 15 | Value 15 | Defensibility 10 | Burden 5 | Reversible 5 | Weighted /5 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| A Incremental broad client | 2.5 | 3.5 | 3 | 3 | 3 | 4 | 4 | 3.05 |
| B Custom/server | 3.5 | 2 | 2.5 | 4 | 4.5 | 2.5 | 3 | 3.18 |
| C Constrained reliability-first | 4.5 | 4 | 4.5 | 4 | 4 | 4 | 4.5 | **4.28** |
| D Worksheet-first | 4 | 5 | 4 | 2.5 | 2 | 5 | 5 | 3.80 |
| E Arbitrary/VLM | 1.5 | 1.5 | 1 | 4 | 2.5 | 1.5 | 2 | 2.05 |

Recommendation: combine C as the product strategy, D as the launch channel/revenue wrapper, and B as a gated R&D track.

## 11. Recommended product and architecture

### What ScanGrade should be at launch

A premium Grade 1 paper-math worksheet product with a companion scanning assistant that safely auto-grades straightforward numeric answers and makes the remainder fast to confirm.

### What it should not attempt

- Arbitrary third-party worksheets.
- Non-row auto-grading claims.
- Grade 2/3 three-digit support.
- Fractions, units, clocks, drawings, process/work grading, or free response.
- Official/formal assessment record claims.
- Local grading on iOS 12.
- “95% accurate” or “fully automatic” marketing.

### Who it is for

Grade 1 teachers who use printed addition/subtraction practice multiple times per week and want feedback without shifting students to devices.

### Recognition architecture

- Launch: current client capture/QR/homography; one standardized row answer zone; current conservative digit path; three-state abstention/review.
- R&D: whole-answer model, dedicated blank model, multi-frame consensus, and blinded generic OCR/VLM bakeoff.
- Later: optional server recognizer with local fallback and explicit data consent.

### Review workflow

Auto → Confirm likely read → Inspect/retry. Show enlarged raw crop beside the full-page location. One tap accepts a suggestion; number keypad/blank/crossed-out actions are always available. Test question-first class review.

### Business model

Paid TPT worksheet packs and bundles first. Scanner included as beta. Introduce a subscription only after at least 10 teachers show repeat usage and measured time savings.

### Honest reliability claim

Before acceptance testing: “ScanGrade helps grade supported ScanGrade worksheets and flags uncertain answers for teacher review.”

After acceptance: “On our supported Grade 1 worksheet set, ScanGrade automatically transcribes most clear answers and asks you to confirm the rest.” Publish the test protocol and sample size; do not claim perfect accuracy.

### Launch readiness criteria

The acceptance suite in section 14 must pass on sealed students/packets; teacher review must save at least 50% of marking time; supported-device capture must complete reliably; privacy and recovery must be documented.

### Existential risk

Teachers may not experience enough net time savings once paper handling, student scanning, retries, and yellow review are included. The cheapest decisive test is a timed class-set crossover study, not another OCR rule.

## 12. Data and evaluation strategy

### Freeze now

Treat every existing labelled capture as development evidence. Do not describe any existing split as the final holdout. Preserve the historical 2026-05-15 five-sheet holdout as a regression set, but it has also been repeatedly examined.

### Required registry

Every new page needs opaque IDs for collection, school/class consent cohort, student/writer, packet, physical page instance, template version, capture attempt, device, app/model version, and correction provenance. Names should never be used as dataset IDs.

### Recommended allocation of new authentic packets

Before looking at results, assign whole students/packets:

- Development: 50% of writers/packets.
- Calibration: 15%; thresholds only.
- Validation: 15%; model/architecture selection.
- Final holdout: 20%; sealed until release candidate.

Within the final holdout, predeclare template and device strata. At least one worksheet template family and one supported device model should be absent from training. If the September corpus is small, use grouped cross-validation on development/validation, while retaining a smaller truly sealed final holdout.

Existing packets that have not been opened, labelled, replayed, or visually inspected should remain untouched. The repo does not contain reliable packet IDs, so Tony must identify physical untouched packets before they enter the pipeline.

### Labelling and QA

- Two independent labels for every difficult/unclear/crossed-out answer and a 10% random sample of clear answers.
- Adjudicate disagreements with the full answer box and full page, never the key alone.
- Store transcription, legibility (`clear/ambiguous/blank/crossed-out/erased`), math correctness, and teacher correction as separate fields.
- Version truth files immutably; changes require reason, reviewer, timestamp, and prior value.
- Perceptual-hash captures/crops to catch repeated scans and near duplicates.
- Keep raw auto output immutable; corrections live in a separate event table.

### Synthetic data

Use external handwritten-digit datasets and synthetic print/border/shadow/warp augmentation for pretraining and robustness. Do not use synthetic performance as a launch metric. Generate artifacts separately: borders, dividers, erasures, pencil fragments, shadows, and empty boxes.

### Privacy and retention

- Default to processing answer crops, not full named pages.
- Redact/crop name regions before upload.
- Obtain explicit school/guardian/legal basis appropriate to the pilot; get qualified privacy advice before production child-data processing.
- Document purpose, access, encryption, region, deletion, incident response, vendor subprocessors, and model-training opt-in.
- Separate operational records from model-training consent.
- Delete raw full pages on a short declared schedule unless explicitly retained for a consented study.

### Post-launch learning loop

Corrections create candidate training data, never automatic production updates. New models run shadow evaluation, then sealed acceptance, then a small canary cohort with rollback. No online self-training from unverified teacher taps.

## 13. Summer-to-launch roadmap

| Phase | Objective and deliverables | Experiments / metrics | Stop condition | Founder time | AI/engineering | Gate |
|---|---|---|---|---:|---:|---|
| Next 48 hours | Freeze evidence; corpus registry schema; supported launch scope; timed-review prototype plan | Reproduce baseline; hash duplicates; inventory missing IDs | Do not tune OCR until split plan exists | 2–3h | 8–12h | Tony approves Route C/D hybrid |
| Next 2 weeks | Standard row answer-zone spec; crop-strip review prototype; cloud/native/VLM blinded bakeoff harness; manual artifact labels | 30–50 representative crops/provider; blank classifier grouped validation; 5 timed review simulations | Stop a provider/model if it guesses key or cannot beat current candidate recall | 6–10h | 30–50h | Choose local-only vs hybrid beta R&D |
| Rest of summer | Package first TPT pack; simplify recognizer experiments; whole-answer model; device/failure telemetry; privacy/backend design | Current dev only; synthetic/external pretraining; no final claims | If no held-out-like improvement after two model cycles, freeze OCR and focus review/content | 6–10h/week | 8–12h/week | Release candidate ready for new data |
| September classroom validation | Collect preassigned packets across unseen writers/devices; timed crossover manual vs ScanGrade | ≥30 students, ≥10 packets, ≥1,500 answers initially; capture/review/time metrics | Stop beta if any silent error cluster, workflow increases teacher load, or consent path fails | 10–15h | 20–30h | Private beta go/no-go |
| Private beta | 5–10 teachers, supported row sheets only; support and deletion workflow | Repeat use, median time saved, retry rate, support tickets | Stop paid launch if <50% time saved or <60% teachers repeat in 2 weeks | 3–5h/week | 5–8h/week | Paid scope and claim approval |
| Paid launch | Publish 1–3 packs; scanner still beta; transparent support matrix | Conversion, refunds, completion, review time, errors | Pull scanning claim after any uncontained confident-error class | 4–6h/week | 4–8h/week | Continue/iterate |
| First 90 days | Improve retention, add only proven row concepts, decide subscription | 10+ weekly active teachers; 4-week retention; class-set time savings; gross margin | Do not broaden layouts if core retention is weak | 4–8h/week | 6–10h/week | Scale, pivot to worksheets, or pause |

### Three highest-leverage actions

1. Freeze and repair the evaluation design: IDs, duplicate audit, immutable truth, student/packet/template/device splits.
2. Build and time the review workflow on the current conservative OCR; determine whether 62–80% auto can already save teacher time.
3. Run a blinded whole-answer/blank/cloud/VLM bakeoff on representative crops before committing to another architecture.

Action 1 has begun: this review added `scripts/audit_current_evaluation_corpus.mjs`, hashed the current scored captures, reproduced the current benchmark, and wrote a private audit report.

## 14. Launch acceptance suite

### Test strata

Sealed data must include unseen students, packets, and at least one unseen template; clear and poor handwriting; correct and incorrect math; one/two digits; blanks, erasures, crossed-out answers, extra marks; wrinkles, shadows, uneven lighting, skew; multiple current phones/tablets; supported older devices; slow/offline/model-load failure; annotation, correction, upload, retry, and recovery.

### Thresholds

| Outcome | Private beta threshold | Paid supported-scope threshold |
|---|---:|---:|
| Catastrophic confident error (wrong page/student/key, corrupted saved result) | 0 observed in ≥1,000 pages | 0 observed in ≥10,000 pages/interactions, with incident rollback |
| Ordinary confident transcription error | <0.5%, 95% upper bound | <0.1%, 95% upper bound; zero errors requires about 3,000 confident reads |
| Auto coverage | ≥80% on launch row family, reported by stratum | ≥85%, or lower only if review-time gate passes strongly |
| Capture completion | ≥98% within two attempts | ≥99% on supported devices |
| Grading completion after accepted capture | ≥99% | ≥99.5% |
| Annotation correct box/meaning | ≥99% | ≥99.5%; no wrong-student/question annotation |
| Manual review time | median ≤20s/page, p90 ≤45s | median ≤15s/page, p90 ≤30s |
| Total marking time | ≥40% faster than teacher manual baseline | ≥50% faster, no worse p90 workload |
| Device compatibility | pass all advertised devices | explicit support matrix; unsupported devices degrade to capture/manual |
| Suggestion accuracy | ≥99% with lower bound reported | ≥99.5% or keep suggestions unselected by default |

Report Wilson/exact binomial intervals by answer and by packet. Because answers on one page/student are correlated, bootstrap confidence intervals by student/packet, not individual answer alone. A zero-error claim should state the exact denominator and that zero was observed; never translate it to “100% reliable.”

## 15. Risks, kill criteria, and contingency plans

| Risk | Kill criterion | Contingency |
|---|---|---|
| Review erases time savings | <40% time saved in September crossover | Sell worksheets; pause scanner automation |
| Confident errors persist | >0.5% on sealed row data or clustered failure | Raise abstention; narrow formats; human confirm |
| Model work overfits | Two consecutive cycles improve dev but harm sealed validation | Stop tuning current corpus; wait for new writers |
| Teachers reject answer zones | Majority of pilot teachers/students dislike or misuse them | A/B cell designs; reconsider OMR-like compromise |
| Privacy/backend blocks schools | Cannot obtain acceptable consent/data-processing path | Local-only product; anonymous capture; no student records |
| Old devices dominate classrooms | Supported devices fail or backend unavailable | Capture-only legacy path and teacher-device batch upload |
| TPT sales weak | Low conversion across 3–5 quality products and interviews | Direct school pilots, licensing to worksheet creators, or stop content spend |
| Support burden high | >1 material support incident per 20 class sets | Narrow device/sheet scope and improve diagnostics |

## 16. Three immediate high-leverage actions

1. Tony: approve or reject the launch boundary—Grade 1 authored row sheets, scanner beta, TPT-first wrapper.
2. Engineering: implement the dataset registry and seal September assignments before any page is scanned or viewed.
3. Product: run a five-class-set timed comparison using existing pages: manual marking versus current scan + proposed crop-strip review. This can falsify the product faster than another selector experiment.

## 17. Work completed during this review

- Read the active handoff, recovered memory, vision documents, addendum, handoff protocol, Mission Control state, accuracy roadmap, reliability decision record, privacy/device/layout documents, and benchmark inventory.
- Inspected repo state without reverting the large dirty worktree.
- Mapped app, OCR, homography, storage, backend, worksheet, model, dataset, replay, and deployment assets.
- Re-ran current saved-capture replay through current code.
- Reproduced 233/374 auto, 233/233 correct, 141 yellow; row 136/176; non-row 97/198.
- Ran production build successfully.
- Audited 33 layouts: 0 structural errors, 63 warnings.
- Audited current device/provenance/identity coverage and exact captured-image hashes.
- Added `scripts/audit_current_evaluation_corpus.mjs` and generated a private audit JSON.
- Researched current official OCR/platform/marketplace/competitor information.
- Made no production OCR, capture, homography, confidence, grading, device, UI, deployment, or customer-facing claim change.

## 18. Open questions requiring founder input

1. Will Tony approve a launch that sells worksheets first and labels scanning as beta?
2. Which physical packets and students, if any, have truly never been viewed or used for tuning?
3. Can September collection assign opaque writer/packet IDs and obtain appropriate consent before scanning?
4. What is Tony's actual manual marking time for a 20–25 student class set?
5. Will students scan independently, or will Tony batch-scan pages? These are different products.
6. What device mix exists in the target classrooms, and what minimum iOS version is acceptable?
7. How constrained can one-digit placement be without frustrating Grade 1 students?
8. Does the initial paid product promise immediate student feedback, teacher batch marking, or both?
9. Is Tony willing to use cloud processing for cropped anonymous answers if it materially improves reliability?
10. What retention/deletion rule should apply to existing private student evidence?

---

# Founder decision memo

## Where the project truly stands

ScanGrade is past the toy stage. It can scan its own worksheets, find answer regions, read many child-written answers, preserve wrong math answers, and safely send uncertain cases to review. Its debug and replay infrastructure is unusually valuable.

It is not ready to claim broad automatic grading. The best current replay accepts 62% of labelled answers overall and 77% on row sheets, with no observed accepted errors. That result has been reproduced, but it comes from a repeatedly tuned, single-device, known-template development corpus with no reliable student or packet IDs. It is a safety regression result, not an independent market proof.

## Is there a credible route to market?

Yes—if the first product is narrower than the vision.

The credible wedge is premium Grade 1 paper math created by ScanGrade, with row-based one- and two-digit answer zones and a companion scanner that automates clear answers and makes the rest fast to confirm. TPT can provide the first paid channel. The scanner should be a beta advantage, not a promise that puts every sale and refund at the mercy of handwriting OCR.

## Recommended route

Use the constrained reliability-first route, wrapped in a worksheet-first launch, while running a server/custom-model track as gated research.

This route is superior because it keeps the strongest assets—paper workflow, authored layouts, safe abstention, real handwriting data—and avoids the weakest claims—arbitrary worksheets, universal devices, non-row reliability, and answer-key-aware AI grading. It can reach teachers sooner, collect better evidence, and remain reversible.

## What must happen next

First, freeze the data process. Give every future writer, packet, page, template, attempt, and device an opaque ID. Seal the September holdout before anyone views results. Second, measure whether the current conservative system plus a much faster review UI actually saves Tony time. Third, benchmark whole-answer models, a true blank/artifact classifier, cloud OCR, and VLM review on blinded crops.

## What should stop or be postponed

Stop hand-tuning confidence rules against the current 582-answer corpus. Postpone non-row auto-grading, Grade 2/3 three-digit layouts, arbitrary worksheet ingestion, broad answer-key correction, formal assessment claims, native-app rewrites, and old-iPad local OCR.

## What success looks like by September

- A polished paid Grade 1 row-based worksheet pack.
- A private scanner beta with a clear supported-device/sheet matrix.
- Preassigned unseen students and packets with at least 1,500 newly labelled answers.
- No confident error cluster, at least 80% row auto coverage, and a teacher review median under 20 seconds per page.
- At least 40–50% measured marking-time reduction.
- Five or more teachers willing to use it again after a real class set.

## What would change this recommendation

I would broaden the product if sealed September data shows near-zero confident errors with at least 85–90% coverage across unseen writers and non-row templates, and teachers still save time. I would accelerate server inference if a blinded whole-answer/cloud model materially beats the local system without answer-key guessing and the privacy path is acceptable. I would reduce ScanGrade to a worksheet business—or stop investing in scanning—if timed classroom use does not save substantial teacher time, even after review UX is optimized.
