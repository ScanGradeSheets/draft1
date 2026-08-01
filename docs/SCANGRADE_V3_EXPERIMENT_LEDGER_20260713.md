# ScanGrade V3 experiment ledger — 2026-07-13

All recognition experiments were key-blind. Handwritten truth was used only for scoring and training labels, never replaced by the mathematical answer key. Historical splits are R&D evidence, not a final generalization claim.

| Experiment | Result | Decision |
|---|---|---|
| Unified final-score strokes Beta 15.25 | Physical testing exposed score fragments appearing before their natural pen stroke and a final shape snap. The SVG reveal and Canvas ink previously duplicated-but-diverged in smoothing and segment offsets. Both now consume one deterministic score plan with exact shared points, quadratic paths, order, width, placement and timing. `8` is one continuous top-starting figure-eight. Focused tests 15/15, complete suite 324/324, pruned build and public asset verification pass. | Deployed as an isolated rendering repair at `26ba57d9.scangrade.pages.dev` and `scangrade.io`. Re-test a final score containing `8`; no OCR, capture, confidence or grading policy changed. |
| Continuous on-sheet correction Beta 15.23 | Removed the floating suggestion/editor card and native iOS keyboard. A Lexend custom keypad exposes only `0–9`, `_`, and delete; input previews directly over the selected physical answer region. `_9`, `9_`, and `__` preserve explicit blank placement. Resolving one yellow automatically focuses the next yellow in worksheet order while retaining the keypad; the final resolution closes review and releases the score animation. Focused tests 26/26, complete suite 320/320, production build passed. The pruned build was published from an isolated static directory at `b22f4f5c.scangrade.pages.dev`; production serves its exact `index-DPRfsZpu.js` bundle and Beta 15.23 label. | Deployed as a device-test candidate at `scangrade.io`. It changes review interaction only; recognition, confidence, grading, crop, capture, and annotation decisions remain frozen. Do not claim it is faster until measured on the current phone and five-year-old iPad. |
| Anchored review overlay Beta 15.24 | Physical Beta 15.23 screenshots exposed a selected-state geometry error and source-photo annotation-reference loss. Source projection now transforms and retains the deterministic layout rectangle alongside detected rectangles, allowing displaced contours to fail back to the correct printed box. The selected state uses exact focus geometry, removes the padded blue circle and letter bubble, uses a clipped pale-blue box, and renders typed digits black immediately. Direct displacement regression, focused overlay tests 16/16, complete suite 321/321, and pruned build pass. Isolated static deployment and production asset parity passed at `47f23f65.scangrade.pages.dev` and `scangrade.io`. | Deployed as a narrow annotation/review repair. Re-scan the same two-digit page on the current phone and verify every yellow and selected blue state stays inside its printed answer box. OCR, confidence, grading, capture, and homography remain frozen. |
| Reconstruct continuous crops from template coordinates | 582/582 artifacts, no exact duplicates, but visible misregistration on distorted pages | Reject as the main source; template geometry alone loses local registration fidelity |
| Export continuous crops using live refined rectangles | 582/582 exact zones: 332 development, 136 validation, 114 holdout; no exact duplicates | Adopt as V3 evidence source |
| Blank/artifact detector on exact zones | 3/4 known blanks proposed, 0 false blank proposals; 90 artifact flags | Blank result is encouraging but unvalidated outside development; artifact score is too aggressive and remains advisory, not a veto |
| CNN-BiGRU-CTC whole-answer recognizer | About 13% validation accuracy; export dependency problem also surfaced | Reject architecture for this dataset/size |
| Compact CNN trained from scratch on approximate zones | About 39% validation and 36.8% holdout | Reject |
| Compact CNN initialized from the worksheet digit model on approximate zones | About 59.6% validation and 47.4% holdout | Better, but reject approximate crops |
| Compact CNN on exact live-refined continuous zones | 99/136 validation (72.8%); 66/114 holdout (57.9%); 1.31M parameters; 5.8 MB ONNX | Adopt as independent shadow evidence, not sole OCR |
| TrOCR LoRA on approximate continuous zones | 49.3% validation; 59.6% holdout | Reject as primary representation |
| TrOCR LoRA on exact raw continuous zones | 47.8% validation; 45.6% holdout; second epoch collapsed to 8.8% validation | Reject raw continuous view for this generic model; retain best epoch and record collapse |
| Existing adapted TrOCR on cleaned/stitched view | 77.2% validation; 80.7% holdout | Keep as complementary whole-answer evidence |
| Three-reader fusion with artifact lane advisory | Validation: 88/136 accepted, 0 wrong, 5 safe promotions. Holdout: 86/114 accepted, 0 wrong, 0 promotions | Safe but no held-out coverage gain; do not promote automatically |
| Reader availability analysis | Any reader was correct on 129/136 validation and 109/114 holdout. The two learned readers also agreed wrongly 4 and 5 times respectively | Recognition signal exists; safe selection/calibration is the main bottleneck |
| Exact control replay | 582 answers; 323 automatic; 323/323 correct; 55.5% coverage. Row 70.5%; non-row 43.1% | Freeze as V2 control |
| Node/WASM compact service runtime | 1 answer 72 ms; 10 answers 420 ms; 30 answers 1263 ms; key-leak request rejected | Convenient local fallback, not canonical deployment runtime |
| Native Python compact service runtime | 1 answer 43.8 ms; 10 answers 41.8 ms; 30 answers 92.9 ms; key-leak request rejected | Adopt as canonical container/cloud runtime |
| Native-versus-WASM parity | Native matched all 114/114 frozen holdout model reads and 66 truths; WASM matched 109/114 reference reads and 65 truths | Freeze native ONNX Runtime as reference; never mix runtime outputs in calibration unnoticed |
| Browser app with compact service | 10 continuous zones produced; V3 completed; local result displayed | Pass selected-frame integration |
| Browser app with model port unavailable | V3 reader unavailable; ordinary predictions exactly matched the service-available run | Pass fail-open requirement |
| WebKit with older-iPad viewport/UA against HTTP model URL | Local grading completed, but WebKit blocked the compact reader as mixed content | Plain HTTP Mac endpoint is not a viable deployed-browser design |
| WebKit with older-iPad viewport/UA against HTTPS model URL | 10 zones produced; compact reader available; V3 completed | Pass Safari-engine integration smoke; real old-iPad camera/memory test still required |
| Compact-service boundary checks | Blocked origin returned 403; missing bearer token returned 401; health remained 200; responses use `no-store` | Pass service-level guardrails; still require authenticated product proxy and provider privacy controls |
| Private container staging | Temporary context contained only Dockerfile, requirements, service, and 5.2 MB model; zero student/evidence files | Pass build-context privacy gate; Linux image build still requires Docker/Cloud Build |
| Three-frame browser replay with saved real captures and both readers | All 3 pages independently registered; 24 large-model and 24 compact-model reads completed. V3 accepted 6/8 answers, all 6 correct; the two browser-OCR disagreements stayed review and both learned readers offered the correct alternative | Pass multi-frame plumbing and conservative disagreement behavior; captures are separated rescans/same layout, not a true live burst or prospective proof |
| P08 fresh re-warp from untouched camera pixels | Ordinary V3 warped artifacts contained white line-cleanup masks over handwriting; re-warping the original capture with the already-detected anchors restored the unmasked page without changing V2 crops or predictions | Adopt behind the frozen V3 experiment flag; default V2 remains unchanged |
| P08 fresh continuous zones sent to adapted large reader | Large-reader transcription improved to 59/70 overall: row 35/40 and non-row 24/30. Correct candidate availability remained 65/70 | Adopt as the prospective V3 large-reader input candidate; still shadow-only |
| P08 stable three-frame fallback, minimum visible-token confidence 0.70 | On primary-only truth, V2 plus fallback reached 58/70 (82.9%), zero observed errors. Row 32/40 (80.0%); non-row 26/30 (86.7%). The fallback added 16/16 correct reads, including 11 non-row reads | Freeze as a research candidate before P03/P09; do not promote or retune until both are scored |
| Layout-only zone anchoring on P08 number bonds | Fixed one diagonal-line crop but worsened other answers and compact reads | Reject for the frozen candidate |
| Aggressive printed-frame erasure on P08 number bonds | Removed useful digit strokes/context and worsened both readers | Reject for the frozen candidate |
| P08 row fresh-zone crop audit | The adapted large reader's three-frame consensus transcribed 35/40 row answers. Visual inspection classified one of the five misses as an empty/mislocated crop and four as clear crops with recognition errors | Row crops are generally usable, but geometry fallback still needs repair; do not describe all remaining row misses as image-quality failures |
| P08 row printed-frame cleanup grid | On the selected frame, the untouched zones scored 32/40. Six fixed/projection-based crop and frame-removal variants scored only 22-28/40; three slanted-line removal variants scored 14-18/40 | Reject destructive crop cleanup. Printed borders can distract the recognizer, but erasing them changes pencil shapes and is less reliable than training on the real boxed representation |
| P08 row layout-only zone anchoring | Whole-answer consensus fell from 35/40 with live-refined geometry to 14/40. The missing right-column crop on page 1 remained empty because template coordinates did not account for page-wide residual distortion | Reject layout-only row crops. Investigate a smooth local displacement/interpolation fallback when an individual refined crop is missing |
| Prospective P03/P09 evaluator freeze | A separate write-once scorer now verifies the unchanged 59-file P08 policy freeze before reading data, requires exactly 10 expected layouts and 3 retained frames per page, applies only the frozen 3-of-3/0.70 rule, ignores answer keys and corrections, and refuses to overwrite a prior score. Three targeted tests pass | Freeze before P03 exists. P03 and P09 may be scored once each; primary-only truth is explicitly provisional and cannot pass the promotion gate |
| Historical fresh-image replay through V3 crop/model path | Reprocessed all 86 saved original page captures (582 labelled answers; 264 row, 318 non-row) with zero replay failures. Large-reader all-answer accuracy was 468/582 (80.4%): row 219/264 (83.0%), non-row 249/318 (78.3%). At least one recorded reader candidate matched truth on 558/582 (95.9%). On 302 manually labelled answers, large accuracy was 229/302 (75.8%) and any-candidate availability was 282/302 (93.4%). | Confirms substantially more recognition signal than V2 exposes, but does not validate the frozen fallback: historical pages retain one image, not three adjacent frames, and the corpus influenced development. Single-frame high-confidence large reads produced 33 errors on V2-review answers; even high-confidence large/compact agreement produced 2 errors. Keep the 3-frame prospective gate and test P03/P09. |
| Historical fresh replay, row/non-row comparison | Fresh V2 reprocessing automatically accepted 189/264 row answers (71.6%; 1 observed error) and 119/318 non-row answers (37.4%; 0 errors). A diagnostic high-confidence two-model agreement lane would raise selected coverage to 237/264 row (89.8%) and 223/318 non-row (70.1%), but would include 1 row V2 error and 2 new non-row errors. | P08's apparent non-row advantage does not generalize across the historical corpus. Non-row remains harder overall, especially number bonds and number patterns. Do not promote the diagnostic agreement lane. |
| Historical 1/7 visual truth audit | Audited all human-labelled 1/7 disagreements using the full page and same-writer digit forms. Three labels on one dot-collection page were serif-style `1`s mislabeled as `7`: `72→12`, `73→13`, `76→16`. The sweep also exposed `47→42` on a place-value page; the written 2 is clear and the student answer is mathematically wrong. Other challenged 1/7 labels remained unchanged. | Preserve the original labels and apply the four-entry correction overlay. Corrected large-reader accuracy is 472/582 (81.1%); correct-candidate availability 559/582 (96.0%). High-confidence two-model agreement on V2-review answers is 151/152 correct, with the remaining `45→15` error visually verified. |
| P02 independent truth audit | Blind full-page verification corrected number-bond Q6 from `31` to `3` and excluded overwritten number-bond Q4 and place-value Q3. P02 has 68 scorable values from 70 answers. | Use the verified file for all future P02 scoring; never restore the primary-only `31` label or score overwritten work as a clean value. |
| Eight-frame two-column crop assignment | P02 mixed-sheet review artifacts exposed wrong-question answer-frame matching because column-order assignment was hard-coded to 10 frames. Generalizing it to even counts of at least 8 restored all eight visible mixed-sheet zones. | Retain as an isolated crop candidate; six-answer sheets keep their old path. Models and confidence policy remain frozen. |
| Four-packet crop replay | Replayed 40 pages/280 labels (275 scorable). V2 alone was 173/173 correct automatic. Frozen overlay was 245/246 correct automatic at 89.5% coverage; P09 number-pattern Q1 was handwritten `34` but the large reader returned high-confidence `39` on all 3 frames. The error persisted with six-answer crop matching reverted. | Automatic large-reader promotion fails the hard safety gate. Keep it review-only. Do not spend another reserve packet until the decision rule materially changes and passes existing replay. |
| Matched eight-frame crop test | On the 20 recent row pages, the candidate moved V2 from 110 to 112 automatic and the diagnostic overlay from 140 to 146, with zero observed errors in either lane. Across 33 historical eight-answer pages, the large lane regressed from 200 to 199 automatic while compact stayed at 223. | Keep opt-in for reproducibility; restore the production crop default. A recent-packet gain does not outweigh the historical regression. |
| Alternate crop review lane | Added 30 frame-processing operations and 42 recognition items across the four-packet row replay, but produced zero distinct review choices and zero added correct choices. | Reject. Do not pay the latency cost. |
| Packet-aware compact retraining | Three predetermined seeds scored 45/70, 37/70, and 40/70 on P09 validation, all below the existing compact reader. | Reject. |
| Packet-aware TrOCR from generic base | Best selected validation epoch scored 28/70 on P09. | Reject. The authentic corpus is too small to establish the model from the generic base. |
| Gentle continuation of the existing TrOCR adapter | Improved P09 from 54/70 to 56/70 and a one-time P02 original-crop audit from 34/68 to 44/68, but on the affected alternate-crop pages improved only 70/80 to 71/80 and reduced conservative V3 accepts from 20 to 16. | Retain as a future review/shadow candidate. It is not a safe automatic-grading replacement or a decisive jump. |
| Same-writer nearest-prototype adaptation | Automatic zero-error gate accepted no answers; teacher-confirmed upper-bound prototypes made 1/3 P09 and 4/7 P02 audit errors. | Reject. Same-student similarity is not objective or reliable enough on this evidence. |
| Four-packet blank/artifact and capture-quality audit | Existing artifact probability marked 274/280 answers at least 0.5 and the only blank candidate was a written `9` whose crop lost ink. Capture-quality correlations with review were weak (largest simple correlation about 0.25). | Reject blank/artifact automation. Do not treat accepted-photo quality as the main remaining bottleneck. |
| Relaxed row review-choice display | On all 20 four-packet row pages, handwritten truth was available among tap choices for 14/14 yellow answers; all 12 model-derived choices were correct. The 160 browser reads, review flags, and grading decisions were unchanged. | Adopt for row review only. It changes review convenience, never automatic grading. |
| Relaxed non-row review-choice display | P09 number-pattern Q1 was handwritten `34`, but three frames agreed on a minimum-confidence-0.938 `39`. | Reject relaxation on non-row layouts. Retain the strict 0.98 single-frame display rule; fresh replay verified the wrong choice is hidden. |
| Yellow-only strong-model routing | Matched real-UI replay retained truth choices for 14/14 yellow answers and the same 24 taps, while strong answer-frame requests fell from 240 to 42. Added suggestion wait fell from 9.18 s to 6.05 s (34.0%). Local grading and yellow flags were unchanged. | Adopt. Send only already-yellow answer crops to the optional strong reader; retain fail-open local grading and keep the strong reader review-only. |
| Adapted TrOCR CPU compression screen | Dynamic int8 matched 0/8 baseline reads, took 6.46 s/8, and used 2.76 GB. Float16 and bfloat16 matched 8/8 but took 11.95 s and 13.59 s/8 respectively; both used 1.24 GB versus float32's 1.56 s and 2.03 GB. | Reject all three tested compressed CPU modes. Keep float32 and obtain savings by routing fewer yellow-only crops. Compression switches remain experimental and off by default. |
| Existing 5 MB larger-grayscale local model, candidate availability | Four recent packets: top-1 176/275, top-3 232/275, top-5 249/275. Historical validation top-3 117/136 and holdout 97/114. It covered 10/14 current yellows in top three; combined with existing browser alternatives, local evidence covered 11/14. Historical wrong reads remained above 0.995 confidence. | Adopt only as a local review-choice source. Do not use its confidence for automatic grading. |
| Synthetic-pretrained 64×192 whole-answer replacement | Improved historical validation/holdout top-1 to 76.5%/72.8%, but regressed the four recent packets to 173/275 (62.9%) and current-yellow top-1 to 7/14. | Reject as the current model replacement; retain the reproducible training lane. |
| Fixed layout-anchored larger-grayscale crops | Truth-in-top-3 fell from 232/275 to 160/275 because residual page perspective makes template coordinates insufficient. | Reject fixed layout crops. |
| Robust same-page geometry rescue | Flagged four spatial outliers across 275 answers and raised selected compact truth-in-top-3 from 232 to 233 without changing automatic grading. It recovered a visibly clear missed `6`, but the compact reader still called it `5`. | Keep as a narrow review-only crop candidate. Geometry repair is useful but does not replace stronger recognition. |
| Pencil/print band-pass into existing digit models | Only 87/275 truth-in-top-3 across the four packets. Hand-tuned variants helped selected examples but did not generalize. | Reject. Do not tune against the three remaining yellows. |
| Native Apple Vision text probe | Compiled successfully, but the installed Vision runtime returned no observations (`nilError`) on three representative larger crops. It is also not a browser inference path. | Reject as a current dependency. |
| `34→39` full-page overwrite audit | The P09 number-pattern mark contains a visible 9-like first trace with a final 4 written over it. Tony independently recognized the same overwrite. Browser, strong, and compact readers disagreed (`37`, `39`, `22`). | Reclassify from an ordinary clean-handwriting miss to a genuinely ambiguous overwritten-answer case, but retain truth `34` and count automatic `39` as unsafe. Require yellow review when independent readers disagree this strongly; do not erase the error from the safety score. |
| Selective near-90% overlay veto | Requiring number-pattern strong reads to appear in the compact model's top two removed the overwritten `34→39` plus two correct promotions: 243/275 automatic (88.4%), zero observed errors. A broader compact-top-two gate gave 224/275 (81.5%), zero observed errors. | Keep the 88.4% variant shadow-only. It was designed after inspecting this failure and is therefore overfit until a genuinely untouched packet validates it. |
| Local-first review integration | The unchanged browser result appeared first; the compact 64×192 reader added choices 55.5 ms later on the canonical native service. No strong request occurred until `None of these`; that request sent only one yellow question's three frames and completed in 709.4 ms warm. Existing choices were preserved. | Adopt experimentally for teacher review, not automatic grading. Preserve up to three browser choices, append up to two compact choices, and allow at most one further distinct strong choice after an explicit request. |
| Compact-service authenticated browser preflight | Browser integration initially failed because the Node fallback's CORS preflight omitted `Authorization`; adding it restored authenticated requests. Native service auth/origin/no-store gates and Node parity tests pass. | Keep the CORS regression test. Never expose either optional reader anonymously or place credentials in URLs/logs. |
| Displayed-yellow preparation audit | The exact UI exposed 107 yellow answers, but the background preparation list originally omitted some answers shown yellow through grouped UI state. Those answers had valid saved crops but received neither compact nor strong choices. Unioning the underlying review flags with every group actually displayed yellow raised immediate truth availability from 65/104 to 78/104 and after-strong availability from 69/104 to 89/104. | Retain the displayed-yellow union and its unit test. This repairs review coverage only; automatic reads and grades remain frozen. |
| Full 40-page local-first UI sweep, two compact additions | Opened all 107 displayed yellows (104 scorable) across P08/P03/P09/P02. Truth was immediately tappable for 78/104 (75.0%) and available after explicit strong fallback for 89/104 (85.6%); 15 required typing. Strong requests fell to 26 questions/78 frames, 75.0% below eager yellow-only routing. No existing choice or automatic result changed. | Pass architecture gates, but compare a third compact choice before freezing the teacher UI. |
| Full 40-page local-first UI sweep, three compact additions | Truth was immediately tappable for 88/104 (84.6%) and available after explicit strong fallback for 90/104 (86.5%); 14 required typing. Strong requests fell to 16 questions/48 frames, 84.6% below eager yellow-only routing. Lists contained 3–6 choices (mean 4.86), removed zero existing choices, and all 40 automatic outputs were invariant. Row local availability was 44/50; non-row 44/54. | Adopt the three-compact-choice review candidate behind the experiment flag. It provides a material 10-answer local gain and 10 fewer strong calls without changing grading. |
| Exact local-first outage recovery | With compact and strong services both unreachable, local grading completed, `None of these` remained available, the failed strong call changed no local output, a clear message appeared, and manual keypad correction succeeded. | Pass fail-open gate. Optional AI must never be required to finish grading or review. |
| Current-code WebKit/older-iPad emulation | HTTPS app and model endpoints loaded in WebKit with an iPadOS 15.7 user agent; compact choices appeared 132.9 ms after the local result, no strong call preceded teacher action, one explicit request sent exactly one question's three frames, and correction completed. Three retained frames occupied 1,123,014 bytes. | Pass browser-engine feasibility, not physical-device proof. Real old-iPad camera, memory pressure, and sustained multi-page stability remain a private-beta gate. |
| Expanded context-crop audit | Expanded crops were complementary but worse as a replacement: on 275 recent scorable answers compact top-1 fell from 107 to 80, while the primary/context top-three union reached 185 versus 158 primary alone. Generic containment detection flagged about 68% of nondevelopment answers and template suppression was worse. | Reject automatic crop-failure gating and expanded-crop replacement. Keep context as review-only evidence. |
| Immediate mixed primary/context compact batch | The wider crop recovered candidates offline, but mixing both crop types in the immediate UI batch changed a P02 primary review list and displaced a correct visible choice. | Reject mixed immediate inference. Preserve the initial primary list exactly. |
| On-demand expanded-context review | Exact 40-page UI replay preserved all automatic signatures and all initial choices. After `None of these`, the local context lane raised post-action truth availability from 90/104 to 91/104 and reduced strong calls from 16 to 15. It recovered the known P03 number-bond `9` locally. | Adopt experimentally after teacher action only. If it adds no new visible choice, continue to the existing one-question strong fallback. |
| Weak confidence-clearance safety veto | A key-blind audit reproduced the retained `4→9` box-safe clearance: the accepted digit conflicted with its own preprocessing majority. Requiring the compact whole-answer model to confirm the majority alternative makes that answer yellow. Across combined evidence, four correct accepts are conservatively demoted. | Adopt behind `v3ConfidenceSafety=1` for the next private-beta candidate. Do not rewrite to the key; a veto can only require review. |
| Conservative three-frame whole-answer consensus | The selector requires 3/3 identical large-grayscale reads, minimum frame confidence 0.70, compact top-two support, slot-compatible length, no stable browser-preprocessing conflict, and no safety/ambiguity veto. It is key-blind. Offline recent-packet reconstruction reached 220/275 (80.0%), zero observed errors; a historical one-frame falsification stress test reached 448/578 (77.5%), zero observed errors and retained the known `4→9` and `45→15` cases for review. | Integrate behind a reversible flag and require exact matched browser replay. Historical evidence is supportive stress testing, not validation of the real three-frame rule. |
| Exact 40-page browser consensus integration | All 40 pages and 280 answer groups completed. Of 275 scorable answers, 222 were automatic (80.7%) and all 222 matched handwriting labels. Row was 137/160 (85.6%); non-row 85/115 (73.9%); one digit 87/100 (87.0%); two digits 135/175 (77.1%). Fifty promotions were all correct; annotations and marked sheets were consistent. Incorrect student math such as written `40` for expected `15` remained transcribed as `40` and was marked red. | Pass integration gates. Keep shadow/private-beta only because the rule is post-hoc to these packets and the corpus is correlated. |
| Exact matched feature-off control | Same current build, services, pages, confidence-safety option, and truth scoring with only consensus promotion disabled: 172/275 automatic (62.5%), zero observed errors. Feature-on gained exactly 50 answers to 222/275. Exact diff found 50/50 correct review-to-automatic promotions, 25 row and 25 non-row, zero demotions, zero changed pre-existing automatic outputs, and zero unexplained changes. | Strongest current candidate. Freeze thresholds and run a blinded packet-level gate before enabling by default. |
| Consensus ambiguity and slot safeguards | The overwritten P09 `34` remained yellow under browser/large/compact disagreement. Model-family disagreement and crop-edge clipping force review; a narrow weak-override/high-entropy rival signal also forces review. Proposed text may not exceed physical slot count, preventing `12→1212`, while one written digit in two optional slots remains representable. | Adopt with the experimental candidate. Extremely high raw confidence cannot clear independent ambiguity. |
| Consensus optional-service outage | Both compact and strong services were unreachable. Local grading completed, no promotion occurred, failed requests changed no local output, the teacher saw a clear message, manual correction worked, and the temporary token was absent from URLs/logs. | Pass fail-open gate. Optional inference must remain nonessential to scan completion. |
| Consensus WebKit mobile emulation | HTTPS WebKit/iPad emulation completed a saved page. Local result appeared in 4.33 s; consensus completed in 13.59 s; three promotions applied; overwritten work stayed yellow; marked sheet regenerated. | Pass browser-engine gate only. Physical old-iPad camera, memory, thermal, and repeated-page testing remain required. |
| Evidence-pipeline crop/contract/reproducibility repair | Coherent page-level physical-frame registration repaired four of six originally classified crop failures directly. One remaining case has unstable adjacent-frame evidence and stays yellow; one was reclassified as print/recognition interference because its crop already contained the answer. Physical box count is now separate from maximum handwritten length, optional-slot handling is key-blind, and two matched browser runs produced identical inputs/probabilities/selections. Clean 40-page replay: 234/275 automatic (85.1%), 0 observed errors; row 90.0%, non-row 78.3%. Historical one-frame stress remains 457/578 with 0 errors. | Adopt as the next private candidate. Reject global full-local geometry, destructive frame cleaning, endpoint contraction, and answer-key-dependent slot preference. Preserve remaining disagreement as yellow. |
| Non-row separate-slot strong recognition | Separate physical-slot crops scored 49/115 non-row answers and recovered only 1/11 number-bond yellows | Reject. Whole-answer context is necessary; separate slots are supporting evidence at most. |
| Non-row crop-variant screen | A 4% interior trim scored 106/115 non-row answers but produced four confident wrong reads. A number-bond crop shifted down 4% scored 20/22 but included `17→1717` | Use only as independently corroborating evidence; never select by raw confidence. |
| Non-row two-crop/six-read consensus | Exact 40-page replay reached 237/275 automatic (86.2%), 237/237 correct. Rows stayed 144/160; non-row rose to 93/115 (80.9%); number bonds rose from 11/22 to 13/22. A second 20-page non-row replay matched all retained inputs, probabilities, alternate reads, decisions, and applications exactly. | Freeze as private candidate 3. Keep all ambiguity, length, conflict, and confidence-safety vetoes. Do not deploy without Tony's approval. |
| Selected-core-crop strong-reader rescue | Exact agreement among the selected grayscale image plus 2% and 4% trims recovered 13 Candidate 3 yellows while preserving every ambiguity and safety veto. Final 40-page replay: 250/275 automatic (90.9%), 250/250 correct; row 150/160, non-row 100/115. The overwritten `34→39` and an otherwise-correct ambiguity-flagged `15` stayed yellow. Two complete replays reproduced all model evidence; 109/109 tests and build passed. | Retain as an opt-in private candidate, not a launch claim. Before deployment, request the extra crops only after first-stage consensus identifies unresolved vetoes; current secure WebKit completion rose from 13.59 s to 26.96 s. Validate on unseen evidence. |
| Selected-core-crop second-stage routing | Running Candidate 3 first and requesting core crops only for unresolved model-support/browser-conflict vetoes preserved the exact 250/275 result and every final answer group across 40 pages. Core-crop images fell 309→48 (84.5%); requesting pages fell 36→14. Real warmed tailnet WebKit completed local OCR in 3.93 s and optional consensus in 21.64 s; a warm repeat was 4.02 s / 21.32 s. The overwritten answer stayed yellow and total optional-model outage remained fail-open. | Deploy as private beta 4 only. Keep public behavior unchanged, preserve `?consensusCandidate=0`, and treat latency plus unseen-packet validation as remaining launch gates. |
| Shared burst-frame processing and deferred combined corroboration | Stage profiling attributed about 14.5 of 16.7 optional seconds to two browser crop-preparation passes, while real MPS inference took about 1.28 s primary plus 0.56 s corroboration. Creating primary/alternate crops in one registration pass reduced the difficult WebKit page from 21.64 s to 12.02 s (44.5%). Exact 40-page scoring remained 250/275 automatic, 250/250 correct, with all final answer groups identical. Optional work after the local result averaged 6.28 s (median 6.57, p90 9.81, max 11.95). Five correct promotions changed only their recorded support source from core-crop to stricter two-crop/six-read agreement. | Deploy as private beta 5. The remaining bottleneck is the required registration of two additional retained frames; do not remove frames or lower agreement requirements merely for speed. |
| Compact model on selected core crops | Original compact view was correct on 6/38 yellows, the best tested variant on 8/38, and three-view agreement selected 11 compact-veto answers that were all wrong. | Reject as a replacement for the strong reader. Do not infer that more pixels alone make the current compact model safe. |
| Residual instability and safety-veto loosening | A post-hoc dual-crop rule selected 1/18 unstable answers correctly; a triple-view rule selected 2/4 safety-veto answers correctly. Both were designed after seeing the residuals. | Keep all 18 instabilities and all 4 safety vetoes yellow. Require unseen-packet falsification before reconsidering. |
| Direct selected-frame geometry reuse | P08 stayed at zero observed confident errors but fell from 64/70 to 59/70 automatic; only 2/10 pages retained identical evidence and four final pages changed. | Reject. Adjacent frames still need independent registration; safety without parity/coverage is not a speed win. |
| Worker-based retained-frame decoding | P08 had exact 10-page evidence/output parity, but crop readiness was about 71.6 ms slower and completion about 85 ms slower. Current WebKit used transferred ImageBitmaps successfully; physical old-device memory remains unmeasured. | Keep research-only/off. It is compatible and safe but has no measured speed benefit. |
| Repeated WebKit worker stress proxy | Baseline and worker paths each completed 8/8 difficult-page repetitions. Baseline averaged 3,952 ms local / 10,084 ms complete; worker averaged 3,963 ms / 10,173 ms. RSS was noisy and non-monotonic, with a higher worker peak (about 480 MiB versus 436 MiB). | Confirms current WebKit stability but no speed or memory advantage. Keep worker off; a physical old-iPad sustained test remains necessary. |
| Stronger residual whole-answer CNN | Historical validation 65.4%, historical holdout 68.4%, recent packets 171/275 (62.2%), below the existing synthetic compact reader. | Reject the architecture as the replacement. |
| Packet-separated authentic compact fine-tuning | Four held-out packet folds scored 192/275 (69.8%) versus 173/275 (62.9%) before adaptation, but ranged from 60.3% to 77.1%. Confidence remained unsafe and two compact versions agreed wrongly 56 times. | Retain as evidence that authentic training helps; reject automatic use or strong-model replacement. |
| Packet-separated explicit blank-slot compact model | Two digit-or-blank heads scored 187/275 (68.0%): 76/100 one-digit and 111/175 two-digit. It recovered 15/38 Candidate 3 yellows versus 17/38 for the sequence model and added zero uniquely correct yellows. | Reject. Optional-slot representation slightly helped one-digit placement but harmed two-digit recognition and did not expand useful evidence. |
| Out-of-fold two-compact consensus selector | The sequence and blank-slot models agreed on 21/25 Candidate 5 reviews, but only 10 agreements were correct and 11 were wrong. A retrospective 0.995 threshold selected one correct review; nested three-packet zero-error calibration selected zero reviews on each held-out packet. | Reject automatic promotion. Compact agreement shares errors, and the lone high-confidence rescue does not generalize under packet holdout. |
| Frozen packet-adapted compact shadow | Training on all four opened packets produced 91.3% training fit, 70.2% on the already-known historical holdout, 6.4 MB ONNX, and 0/275 PyTorch/ONNX decision mismatches. | Freeze only as independent P05 shadow evidence. No generalization claim until prospective scoring. |
| Three-frame median and locally aligned median fusion | Both variants read 8/18 frame instabilities correctly and 10 wrongly; local translation changed one wrong output to another wrong output. Wrong cases had markedly lower contrast/edge/sharpness and concentrated in number bonds/optional-slot layouts. | Reject fusion promotion. Alignment cannot repair clipped information, printed-structure contamination, or slot-contract errors. Keep all 18 yellow. |
| Locked P05 prospective protocol | P05 was selected by a declared SHA-256 procedure from five untouched packets before scanning/inspection. One-shot key-blind gates require zero confident errors and 85% overall/85% row/80% non-row coverage. | Keep P05 intact and unseen until the complete candidate and shadow-scoring plan are frozen. P05 can falsify, not establish a launch claim. |
| Matched strong-reader evidence views | On the same 275 recent answers and same adapted TrOCR model, current continuous zones scored 175/275 (63.6%); exact historical-style stitched original-grayscale slot crops scored 242/275 (88.0%), including P09 validation 63/70 and P02 holdout 60/68. Cleaned stitched fell to 229/275 and only 50/68 on P02. Stitched made two wrong reads above 99.5% confidence on answers Candidate 5 handled correctly. | Advance uncleaned stitched pixels as teacher-review evidence, not a raw-confidence automatic override. Preserve original grayscale. Require exact saved-browser A/B and prospective safety gates before any automatic use. |
| Stitched-evidence compact distillation | Four packet-held-out folds gave 196/275 (71.3%) for the truth-only 6.4 MB CNN. Teacher auxiliary weight 0.05 changed no decisions; weight 0.25 fell to 195/275; a joint 0–99 head fell to 193/275. The best compact threshold with zero observed errors covered only 34/275 at 0.995 and is statistically weak. | Reject tested compact variants as strong-reader replacements. Keep shadow-only. Future work requires a materially stronger architecture and exact browser-rendered training inputs. |
| Stitched compact ONNX/WASM parity | PyTorch and ONNX matched 853/853 decisions with identical tensors. Single-thread, SIMD-disabled WASM averaged 54.5 ms/answer and loaded the 6.4 MB model in 137 ms on the Mac. Browser canvas versus Python Pillow resizing changed 2/275 decisions. | Technical feasibility passes but accuracy fails. Standardize exact browser preprocessing before any future promotion; do not spend P05 on this model. |
| Browser-only yellow-gap causal audit | Exact reconstruction found 176/275 browser automatic (64.0%), all 176 correct, and 99 yellow. The large grayscale reader was correct on 87/99 yellows; the browser read was already correct on 17; a coherent browser preprocessing variant contained the complete truth on 55. Thirty-five of 40 pages contained both automatic and yellow answers, and all measured crop-quality AUCs were 0.459–0.538 (near random). The main gap is lossy 28×28 representation plus candidate selection/safety disagreement; crop/layout failures concentrate in number bonds and optional slots. | Preserve large grayscale as the primary future local input. Do not loosen safety based on simple quality metrics or variant availability. Candidate 6 stays unchanged. |
| Browser-plus-compact exact-agreement falsification | A recent-packet arithmetic-row rule appeared to rescue 9/9 correctly, but historical validation/holdout selected 5 answers and got only 2 correct, with 3 wrong. Across all historical arithmetic-row yellows it selected 14: 11 correct and 3 wrong. | Reject. Two small local readers share errors; agreement is not independent proof. Do not deploy the retrospective four-packet rule. |
| OCR-specific TrOCR-small browser-local candidate | Adapting both image-encoder and decoder attention reached 244/275 (88.7%) in packet-held-out crossfit: rows 149/160, non-rows 95/115, and Candidate 5 residual yellows 16/25. Final opened-data training selected 122/136 historical validation and scored 96/114 historical holdout. An 84 MB FP16-encoder/int8-decoder ONNX package matched 68/68 P02 reads and passed single-answer Chromium/WebKit parity at about 0.79 s, but raw confidence included wrong reads above 0.999, number bonds were only 12/22, and repeated Web sessions stalled. | Advance as shadow-only. Never override accepted Candidate 6 reads. Integrate through disposable yellow-only workers with strict timeout/cap and fail-open behavior; require exact 40-page invariance, physical old-iPad sustained testing, frozen selector, and sealed P05 before any automatic promotion. |
| TrOCR-small disposable-worker browser shadow | Exact numeric-token parity passed in Chromium and WebKit. Eight sequential one-answer workers completed in both engines without stalls at roughly 1.5 s/answer including initialization; forced non-SIMD passed at roughly 3.2 s. A 40-page feature-off replay matched Candidate 6 exactly. Packet-held-out TrOCR-small read 80/99 browser yellows but was wrong on 12/176 browser-accepted answers. | Retain off-by-default and review-only. Run only on yellow answers; never override accepted browser reads. Physical old-iPad sustained memory/download/thermal testing remains required. |
| TrOCR-small structural slot/blank contract | Browser requests now carry layout family, physical slot count, maximum handwritten digits, and worksheet-declared optional-slot indices. Unknown/nonnumeric/overlength output is rejected; only declared missing optional slots are marked blank. The only four verified whole-answer blanks were all hallucinated as digits by the model. | Keep structural optional-slot inference; keep whole-answer blanks, erasures, cross-outs, and overwrites yellow. Four blanks are insufficient for launch calibration. |
| TrOCR-small cleaned-crop ablation | Packet-held-out cleaned stitched views scored 236/275 versus 244/275 primary, rescuing 6 and regressing 14. A packet-crossfit one-rule selector rescued 1 and regressed 2. Mixed primary+clean training fell to 56/68 on P02 and 3/8 Candidate 5 reviews. | Reject global cleaning, learned crop selection on this sample, and mixed-view training. Preserve original pixels; alternate-view disagreement may veto but not promote. |
| TrOCR-small number-bond shifted-view ablation | The existing 4%-down view raised number-bond top-one from 12/22 to 14/22, with 4 rescues and 2 regressions. Training with shifted number-bond augmentation reduced P02 overall from 58/68 to 50/68 and left shifted P02 number bonds at 2/5. Visual review found clipped/mispositioned writing in roughly 12/19 whole-answer misses among browser yellows, concentrated in number bonds. | Reject shifted view as primary and reject this augmentation. Keep the larger/downward crop as review/disagreement evidence. The next crop attempt needs an explicit printed-structure/handwriting mask or revised metadata validated prospectively. |
| Blinded crop-geometry audit and containment detector | Truth/output-blinded labels found geometry failure in 13/19 whole-answer misses versus 5/19 matched controls. Packet-held-out outside-ink thresholds reached 83.3% sensitivity and 80.0% specificity. Fourteen of 18 flagged examples were number bonds. | The crop/layout bottleneck is demonstrated, not inferred from OCR outcome. Use containment only to route alternate evidence; it is not a transcription selector. |
| Number-bond bounded-geometry grid | Across nine key-blind views, primary was 12/22 and the existing 4%-down crop was best overall at 14/22. Larger symmetric/horizontal crops regressed. Detector routing was descriptively 15/22 but lacks prospective calibration. | Retain 4%-down as review/disagreement evidence only. Reject global expansion and automatic view selection. |
| Detector-routed shifted-view TrOCR specialist | Four packet-held-out specialist adapters read 15/22 shifted number bonds but only 233/275 on primary views versus 244/275 control. On eight current number-bond reviews the specialist fixed two and was wrong on five others. | Reject global replacement and automatic promotion. At most expose as teacher-review evidence after a future prospective gate. |
| Larger-context aligned-template residual | Direct bounded residual scored 64/275; detector-routed residual augmentation scored 57/68 on held-out P02 versus 58/68 control. The original grayscale remained untouched in a separate lane. | Reject template subtraction. It still removes pencil overlapping printed rules. Preserve original grayscale and close this branch. |
| P05 number-bond printed-rule removal | On six P05 number-bond answers, untouched continuous grayscale read 4/6 correctly. Narrow border masking, slot-divider masking, and projection masking each fell to 3/6; the four-view oracle remained 4/6. | Reject destructive line removal. The residual is not solved by whitening printed rules and the masking can erase useful shape/context. |
| P05 external local-model generalization | The 2.0M-parameter larger-grayscale model with slot/layout metadata and explicit blank heads was trained on P02/P03/P08/P09 and selected only on historical validation. P05 was excluded from gradients and selection. It scored 43/70 (61.4%) overall and 5/16 (31.2%) on repaired residual yellows; an exact rerun reproduced every epoch and result. | Reject as a primary browser recognizer. Retain only as independent supporting/veto evidence. |
| Teacher-confirmed P05 writer fine-tuning | With the general visual encoder frozen, 10 deterministic non-yellow teacher confirmations reduced residual accuracy from 5/16 to 3/16; 20 confirmations reduced it to 2/16. | Reject neural on-the-fly student fine-tuning. A writer profile must be an explicit, narrow teacher-confirmed review aid, not silent weight adaptation. |
| Multi-view strong evidence plus packet-held-out local top-k support | Key-blind strict rule: existing yellow only; continuous and stitched selected-frame TrOCR agree with at least two non-tied frame reads; both selected views >=0.3; physical length fits; every existing hard veto remains; proposed read appears in packet-held-out local top 3 at >=0.05. After correcting a scorer bug that initially missed nested ambiguity vetoes, it selected 1 opened historical residual and 4 P05 residuals, all 5 correct. Repaired P05 development coverage becomes 58/70 (82.9%). An explicitly separate screen clearing only top-level-non-hard `override-retained-material-rival` flags selected two additional correct P05 reads and reached 60/70 (85.7%), but was designed post-truth. | Advance the strict version only as private shadow evidence. Treat override-only clearance as a hypothesis for prospective falsification, not an implementation. P05 and opened history are development data. |
| Exact duplicate collapse with local top-k support | Continuous TrOCR produced exact twice-slot repetitions such as `17→1717`. Collapsing only when a packet-held-out local model supported the physical-length half in top 3 at >=0.05 matched truth in 16/16 pattern occurrences and excluded all three known bad collapses. The only current-yellow rescue was P05 number-bond Q5, but it carries a nested retained-rival ambiguity veto. | Keep Q5 yellow. Structural de-duplication is useful review evidence, not an automatic path until the ambiguity conflict is independently resolved and prospectively tested. |
| Historical manual-holdout falsification of ambiguity clearance | Forty manually labelled answers from H07/H08 were excluded from local-model training and selection. Continuous and stitched strong views agreed on 19 answers: 17 correct and 2 wrong. Adding local top-three support at >=0.05 selected 14: 13 correct and one wrong. The wrong answer was a visually clear handwritten `16` read as `15` by continuous TrOCR, stitched TrOCR, and the local model (`H|82.7`). Historical saved captures lack authentic adjacent burst frames, so this is not an exact full-selector replay; it nevertheless falsifies the claim that the three evidence lanes are independent enough to clear an ambiguity veto. | Reject the post-P05 override-only clearance route and its 85.7% estimate. Preserve every ambiguity veto. Keep the strict 82.9% P05 result shadow-only pending truly prospective burst evidence. |
| Teacher-confirmed generic writer-shape veto | A packet-scoped, key-blind upper-bound simulation treated every earlier manual label as an explicit teacher confirmation. Normalized shape matching caught both wrong unanimous reads, including `16→15`, but also vetoed 11 correct reads at the descriptive operating point. Sweeps did not produce a useful precision/recall tradeoff. | Reject generic shape matching. Retain only explicit teacher-confirmed reversal suggestions in the review UI; profiles may reorder a yellow-answer choice but may never promote, replace, or silently grade an answer. |

## Important negative result

The original hypothesis—“raw continuous grayscale will automatically make the large handwriting model much better”—was false. It preserves more information, but it also preserves printed rules and neighboring structure that distract the generic model. V3 therefore keeps the lossless continuous source while deriving different recognition views for different architectures.

## Still unproven

- Performance on truly unseen intact students/packets.
- Real live-burst benefit; separated saved captures prove the browser path but are not authentic adjacent burst frames.
- Blank, erasure, crossing-out, and artifact calibration at launch scale.
- Old-iPad burst memory, encoding time, and browser stability.
- Cloud memory, cold start, privacy operations, and sustainable free-tier availability.
- Teacher review-time improvement.
- Historical selected-frame replay cannot reproduce or validate the frozen real 3-of-3 frame-consensus rule; its frames are unavailable.

No threshold may be loosened using the locked packet. Failed experiments remain part of this ledger.
## 2026-07-23 — Independent Beta 7 safety repair audit and Beta 15.3 interface gate

| Experiment | Result | Decision |
|---|---|---|
| Exact paired predecessor/Beta 7 replay | Replayed 50 canonical sheets, 350 answer locations, and 345 scorable handwriting labels from P02/P03/P05/P08/P09 on identical saved evidence. Both policies reproduced all 350 saved decisions, identical-input results were deterministic, selected-evidence duplicates were zero, and neither key nor truth fields entered recognition. | Pass evidence-integrity gate. |
| Beta 7 safety repair | Predecessor: 315/345 automatic (91.3%), 295 correct, 20 wrong, 30 yellow. Beta 7: 273/345 automatic (79.1%), 253 correct, 20 wrong, 72 yellow. | **Fail. Do not deploy.** It removed no confident error and cost 42 automatic answers. |
| Changed-decision visual audit | Inspected all 42 changes on saved pages/crops. Every change was a correct predecessor automatic read demoted to yellow by the broad display veto. | Remove the post-success broad display veto in the next shadow experiment; do not weaken actual ambiguity/safety gates. |
| Confident-error visual audit | Inspected all 20 errors. They are genuine handwriting transcription errors, all in P05, not key disagreements or truth-label mistakes. | Already-automatic reads need a separate risk-triggered second-reader veto. It may demote to yellow only. Validate prospectively. |
| Cohort regression gate | Beta 7 materially regressed P02, P03, P08, P09; all ten templates; row and non-row; one- and two-digit answers; good, fair, and poor captures. P05 retained 90% coverage but had only 68.3% accuracy among automatic reads. | Fail no-material-regression gate. Packet-level reporting is mandatory; aggregate coverage hid the P05 failure. |
| Beta 15.3 phone/old-iPad saved-sheet interaction | Optional blanks stayed unhighlighted; correction opened empty/focused; empty+Save stored blank; one digit entered the correct physical slot; blue readings stayed behind the panel; marks and active answer stayed correctly placed; fixed viewport held on 390×844 and 1024×1366. | Freeze Beta 15.3 as correction-interface control. Physical old-iPad repeated-camera endurance remains required. |
| Automated/build/public smoke | Focused UI checks 35/35, full tests 180/180, production build pass, GitHub/public build pass, live `scangrade.io` smoke pass. | Interface gate passes; recognition gate still fails. |
| Worksheet-first launch materials | Created initial catalog plan, teacher instructions, product-preview copy, honest reliability language, and a six-page rendered/inspected TPT beta preview. | Continue small worksheet beta preparation. Do not publish percentage or error-free claims. |
| Accepted-answer safety repair after removing the broad display veto | Exact key-blind replay on 50 hand-labelled sheets / 345 scorable answers removed the broad post-promotion yellow veto, then routed suspicious browser accepts through a 7.7 MB local whole-slot scout and two independent large-grayscale views. Frozen Beta 7 had 273/345 automatic with 20 confident errors; the repaired policy had 284/345 automatic (82.3%), 284/284 correct, and zero known confident errors. It converted all 20 errors and 8 difficult-but-correct reads to yellow. Every packet gained correctly automatic answers versus frozen Beta 7 and no packet/layout family materially regressed. Removing the scout left five confident errors, so it is safety-essential. Visual audit found all 20 repaired errors genuinely dangerous and the eight conservative demotions defensible. | Pass canonical offline gate as a private candidate, not a public reliability claim. The policy never changes a transcription and never receives the mathematical answer key; it may only downgrade an accepted answer to teacher review. |
| Accepted-answer safety browser integration | The scout ONNX matched its PyTorch checkpoint on all 70 P05 holdout rows (zero read/probability-parity mismatches within tolerance). Batched mobile WebKit inference took about 0.20 s after a roughly 9.25 s first-use model initialization; total scout completion was about 15.8 s including larger-image preparation and model load. On the saved overwritten number-pattern answer, the active repair preserved browser text `3`, forced it yellow, regenerated the marked sheet, and completed inside the existing ~21.7 s optional grading window. Full repository suite passed 190/190. | Enable by default only on the authenticated/private `.ts.net` candidate; `scangrade.io` remains unchanged and browser-only. A 30 s fail-open timeout protects old devices. Physical five-year-old iPad sustained testing remains required before public activation. |
| Persistent deterministic 84 MB local reader, all 345 labels | Stitched view: 268/275 on P02/P03/P08/P09 and 56/70 on P05. Continuous view: 232/275 and 55/70 respectively. Persistent loading reduced P05 from about 107 seconds to about 51 seconds for 70 answers. Deterministic JS resizing produced 70/70 identical P05 stitched reads and probabilities in Chromium and WebKit. | Persistent loading and deterministic preprocessing pass as infrastructure. The model has a severe student/packet generalization gap and is not a primary reader. |
| Retrospective scout + cascaded 84 MB frontier | A key-blind research selector reached 311/345 automatic (90.1%), 311 correct, zero known confident errors, and 34 yellow. It routes 155/312 accepted reads plus 33 yellows to stitched; only 39 continue to continuous: 227 total 84 MB inferences over 50 pages (median 4/page, p90 8, maximum 11). P02/P03/P08/P09 were 97.0–98.6% automatic, but P05 remained 43/70 (61.4%). Two safety thresholds were inspected on this same corpus. | Do not deploy. Aggregate 90.1% hides the P05 failure and is not prospective evidence. Preserve as the current research frontier and use September work for falsification. |
| Visual audit of all 53 changed frontier decisions | All 53 changes were inspected from saved stitched and continuous grayscale evidence. The cascade caught all 20 predecessor confident errors and falsely demoted seven correct predecessor reads. All 26 promotions matched the stored handwriting labels, but four promoted number-bond cases had previously frozen, truth-blind `clipped`/`outside-zone` geometry labels and visibly insufficient evidence. Vetoing those four yields 307/345 automatic (89.0%) with zero known confident errors. | The visually defensible result is 89.0%, not 90.1%. Do not ship the visually unsafe promotions merely to reach the target. Repair number-bond crops or leave them yellow. |
| Browser-local reader on geometry-repaired views | The four unsafe number-bond crops were replaced with previously generated truth-blind robust-geometry views. The handwriting became visually legible. Deterministic WebKit read 3/4 correctly; a previously generated shifted view recovered the remaining P03 `14`. However, the same key-blind suspicious/low-ink routing rule selected nine promoted answers in total and the robust-view 84 MB reader was only 5/9 correct. | Information recovery is real, but safe general view selection remains unsolved. Do not hard-code the four known answers or treat per-example crop choice as a deployable selector. |
| WebKit-compatible MatMul-only int8 encoder | Full dynamic quantization produced an unsupported `ConvInteger` node and failed immediately in onnxruntime-web 1.17. Keeping the one patch convolution in FP32 and quantizing 72 MatMul nodes reduced the encoder from 87,456,980 to 23,934,170 bytes; with the retained 40,152,054-byte decoder the package is 64,086,224 bytes (61.1 MiB). Deterministic persistent WebKit completed 690/690 stitched+continuous requests. Stitched scored 268/275 earlier + 57/70 P05; continuous 228/275 + 58/70 P05. Median inference was about 0.65 s, initialization about 0.40 s. The frozen cascade remained 311/345 with zero known errors numerically and 307/345 (89.0%) after geometry audit. | Advance this 61.1 MiB package over the 84 MB package for physical-device testing. It is smaller/faster without reducing cascade coverage, but it does not solve the crop-selection or P05 generalization gate. Do not deploy. |
| Private physical-device endurance probe | Added a tailnet-only probe using the exact 61.1 MiB package, deterministic resize and a single persistent browser session. It offers 8-answer and 40-answer tests, frozen token-parity expectations, download/init/per-answer/p90 timing, and browser memory where available. Exact Tailscale URL smoke in WebKit passed: 8/8 parity, about 0.88 s initialization through the proxy and 0.65 s/answer on the Mac. | Run first on the current iPhone, then the five-year-old iPad. Save the JSON from each short and endurance run. Do not infer physical memory/thermal viability from the Mac proxy. |
| Existing 15–30 MB candidate screen | The retained 21 MB / 5.47M-parameter residual whole-answer model scored 171/275 (62.2%) on the earlier packets; the 7.7 MB slot/layout-aware model scored 43/70 (61.4%) on P05. | Reject both as stronger-reader replacements. Any new 15–30 MB attempt needs a materially different distillation/data design, not simple scaling or extreme compression. |
| Persistent loading across worksheet calls | The experimental client now retains one model worker across separate calls and expires it after a bounded idle period. A two-call/four-answer WebKit run initialized once, reused the session for answers 2–4, and completed in 4.40 s. A forced bad decoder URL failed open with no completed result, reset the worker, and the next correct call recovered with a fresh session. Repository suite 192/192 and production build pass. | Infrastructure pass. Keep experimental until physical current-phone and five-year-old-iPad sustained memory/thermal tests pass. Public disposable behavior is unchanged. |
| Uniform number-bond affine/homography crop selection | Generated two deterministic clean views for all 28 labelled number-bond answers and selected between them using only four-sided printed-frame containment; no truth, OCR read, or answer key participated. The 61.1 MiB WebKit reader scored 21/28, unchanged in total, but all four formerly clipped/outside-zone promotions became visually complete and were independently read correctly. | Crop-information repair passes for the four disputed promotions. View selection is still not a general recognition improvement, so keep the lane number-bond-specific. |
| Narrow high-confidence number-bond geometry lane | A frozen retrospective rule promotes a yellow number-bond only when the new complete-box view and the existing continuous view agree with both confidence values >=0.90. It promotes P05 `14` and `6`, producing 313/345 automatic (90.7%), 313 correct, zero known confident errors, and 32 yellow. P05 remains only 46/70 (65.7%). A broad two-reader rule would confidently misread P08's reversed `9` as `5`. | Aggregate target passes retrospectively, but packet/generalization and prospective gates fail. Do not deploy. Preserve the full-box disagreement as a veto against the reversed-9 trap. |
| Exact 61.1 MiB persistence, fail-open, and no-SIMD stress | Correctly aligned P05 WebKit evidence initialized once in 393 ms, reused one session across two calls, and completed four answers correctly in 2.99 s. A forced missing decoder returned zero completed reads and the next valid request recovered. No-SIMD completed 8/8 correctly but took 24.50 s, about 2.99 s/answer. | Persistence and recovery pass. No-SIMD fails the UX-speed gate; unsupported or slow devices must retain conservative browser OCR and more yellow. Physical phone/iPad endurance remains required. |
| Capability-tier candidate | Added an isolated fail-closed policy: require WebAssembly SIMD, no reported <4 GB memory, successful model load, and a measured first check <=2.5 s before enabling the persistent reader. Failure, timeout, unsupported SIMD, or slow runtime leaves grading on conservative browser OCR. | Unit contract passes. Do not wire into production before physical-device measurement and full integration replay. |
| Uniform full-box view across all ten layouts | Generated a truth/key-blind uniform crop for all 345 labels, selected only by printed-frame containment between clean simple-scale and saved-homography views. The 61.1 MiB WebKit reader completed 345/345 in 229.46 s and raw top-1 was 276/345. A second generation reproduced 345/345 selected views and PNG hashes exactly. | Deterministic evidence source passes. Use only as routed corroborating/veto evidence; raw accuracy is not high enough for replacement recognition. |
| Uniform + continuous + stitched yellow consensus | **INVALID / superseded.** The analyzer used the cascade's post-demotion state instead of the frozen browser predecessor's state, allowing 12 browser-accepted transcriptions to be silently replaced after demotion. The labels happened to agree, but the mechanism violates the product rule and active goal. With the eligibility bug repaired, the offline mixed-evidence frontier is 312/345 (90.4%), zero known errors, but P05 is only 45/70 (64.3%); the authoritative actual-code exact-capture live replay remains 261/345 (75.7%), zero known errors. | Do not integrate or cite 93.6%. Preserve the live candidate's no-silent-replacement invariant. A materially stronger primary recognizer is required to close the remaining gap. |
| Uniform-view trap checks | The complete-box view disagrees with and blocks the other readers' wrong `5` on P08's reversed `9`, and their wrong `32` on P09's handwritten `30`. | Preserve uniform disagreement as a veto. Do not replace this with broad two-reader or same-model multi-view unanimity. |
| Cross-device marking-animation consistency | The second phone's instant marks were traced to iOS `prefers-reduced-motion: reduce`, not OCR, model speed, or Mac Mini behavior. Removed the JavaScript fast-complete branch, the manual-correction suppression, and the CSS stroke/date suppression. Added a source-level regression contract; complete suite 200/200 and production build pass. | Use the same drawn, one-question-at-a-time grading sequence on every device, per Tony's explicit UX decision. UI-only change is verified locally and not yet deployed. |
| Exact live lightweight digit-model comparison | The actual current default browser pair replayed all 50 pages / 345 labels and initially accepted 293 (84.9%), but 68 accepted transcriptions were wrong. The older query-overridden primary/right-slot pair accepted 303 (87.8%) but had 80 confident errors. | Reject the alternate pair. Historical query-overridden results are not evidence for the actual public defaults. Any preserve-or-demote repair of the current primary has an oracle ceiling below 90%. |
| Exact live 7.7 MiB scout-only frontier | Actual WebKit scout output existed for all 293 browser-accepted answers. Requiring any scout agreement retained 203/345 (58.8%) and still had five confident errors because browser and scout shared five wrong reads. No disagreement-only threshold reached zero errors; the best same-corpus confidence rule reached only 93/345 (27.0%) at zero errors. | Scout-only route conclusively fails. Keep the scout only as a cheap router into stronger evidence. |
| Larger-grayscale reader as initial primary evidence | Stitched raw top-1 was 325/345 (94.2%) but included 20 errors, one at 0.997 confidence. Exhaustive simple voting across stitched, continuous, uniform, scout and browser sources found 250/345 (72.5%) at zero errors. Leave-one-packet-out rule selection reached 255/345 (73.9%) with three P05 confident errors. | Readable information exists, but simple confidence/agreement cannot identify the safe 90% subset. Do not replace the initial reader. A new ambiguity detector/distillation design must pass packet-held-out safety and P05 generalization. |
| 40-answer sustained WebKit runtime | The exact 61.1 MiB model passed 40/40 frozen-token parity in one WebKit session. Initialization was 1.317 s, checking was 25.21 s total, mean 0.630 s/answer, and p90 0.634 s/answer. WebKit exposed no trustworthy memory counter. | Modern-WebKit sustained speed passes on the Mac. Physical current-phone and five-year-old-iPad memory/thermal/endurance remain mandatory; no-SIMD devices remain on conservative OCR. |
| Browser-local 90% goal completion audit | Re-ran the authoritative 345-answer exact-live union twice. Both normalized reports had SHA-256 `01bc798df020e3adbfcc9e29dd4123dcc350201e61f906911cea48575d0e57ad` and reproduced 267/345 automatic (77.4%), 267/267 correct vs handwritten truth, zero confident errors, 78 yellow, and zero silent replacements. Added a v2 immutable research freeze and verifier; every artifact/invariant check passes. Repository suite passed 229/229 and production build passed. | 90% gate fails; do not deploy recognition changes. Preserve this as the strongest lower zero-error research frontier. Freeze the repeatedly examined corpus and use a genuinely independent historical-only model plus prospective September packets as the next decisive recognition experiment. Physical current-phone/old-iPad inference endurance remains missing. |
| 17 MiB pretrained MobileNetV3-Large whole-answer screen | The materially different 4.33M-parameter whole-zone model scored 203/275 (73.8%) on the four earlier packets and 46/70 (65.7%) on P05, or 249/345 (72.2%) overall. Agreement with the 61.1 MiB stitched reader retained 249 answers but still shared six wrong reads, including reversed-`9`, `30→32`, and P05 place-value errors. | Reject before packet-crossfit/browser export. It improves substantially on prior compact models but is neither a strong primary reader nor a safe independent ambiguity detector. The next compact attempt requires stitched-view teacher features/logits or new authentic data. |
| Packet-held-out stitched teacher-feature distillation | Distilling exact TrOCR encoder features raised the 17 MiB MobileNet student from 72.2% to 82.9% best-case across 345 recent labels. P02 remained 73.5%, P05 74.3%, and non-row 77.2%. Strong-reader agreement still shared four wrong reads, including `47→17` at 0.981, reversed `9→5` at 0.862, and `30→32` at 0.995. | Reject as a primary reader and ambiguity detector. The gain is real, but correlated high-confidence errors make confidence/agreement unsafe. |
| EfficientNet-B0 browser-sized backbone and teacher-feature distillation | The 4.14M-parameter alternative scored 254/345 (73.6%) before distillation and 287/345 (83.2%) packet-held-out afterward. Non-row improved to 81.4%, but P05 was only 68.6%. It shared seven wrong reads with the strong reader, including `49→14` at 0.998, `47→17` at 0.987, reversed `9→5` at 0.943, and `30→32` at 0.996. | Reject and stop compact-backbone tuning on the current corpus. It does not supply independent safety evidence; new authentic writers/packets are the cheapest decisive input. |
| TrOCR encoder-embedding ambiguity head | A tiny key-blind head using frozen encoder features, token confidence, predicted length, and layout family accepted 67/345 at zero errors in leave-one-recent-packet-out crossfit and would add 11 correct reads to the exact-live cascade (78.8% total). When trained only on historical development and selected only on historical validation, it accepted 37/345 recent reads and confidently accepted one P05 `8→6` error. | Reject. The sibling-packet crossfit gain does not survive the stricter prospective-style boundary; do not threshold-tune the one recent error away. |
| Founder-approved two-box one-digit placement contract | Shared grading/blank-handling logic now treats a one-digit response in either physical side of a two-box answer area as the same transcription while retaining physical placement for annotation. The default contract no longer assumes a leading zero. Repository tests passed 228/228, production build passed, 33 layouts audited with zero errors, and all 35 shipped one-digit/two-box groups accepted both placements with no violations. | Adopt throughout ScanGrade. Do not loosen genuine two-digit ordering, OCR confidence, or handwriting truth; this is a placement rule, not answer-key guessing. |
| Retained three-frame consensus across all five packets | Reconstructed 210 P05 answer-frame crops from the ten canonical three-frame bursts and ran the exact 61.1 MiB persistent WebKit reader locally in 135.4 seconds. The first 85.5% analysis was invalid because it allowed safety-demoted browser accepts to receive a different model transcription. After restricting promotion to original browser yellows, the strongest zero-known-error frame frontier is 266/345 (77.1%), five legitimate rescues, with P05 unchanged at 42/70. | Reject the replacement path permanently. Frame changes do not make one architecture independent. Preserve frame agreement as conservative evidence for original yellows only; do not deploy or threshold-tune on this corpus. |
| Exact-live uniform + frame original-yellow union | Joined the repaired frame lane and uniform/full-box lane to the authoritative 261/345 exact-live candidate. Accepted transcriptions are immutable; only frozen-predecessor yellows are eligible; blocking vetoes dominate; conflicting eligible lanes abstain. The union is 267/345 (77.4%), 267/267 correct, zero known errors, and 78 yellow. Six changes were visually inspected. P05 is 43/70 (61.4%). | Zero-error audit passes retrospectively, but the 90% and prospective/device gates fail decisively. Do not implement publicly. The remaining gap requires a stronger independent primary recognizer and new writers, not more same-model views. |
| Independent off-the-shelf browser readers | Texo FormulaNet read 43/345 stitched answers and carries AGPL-3.0 licensing. Official Apache-2.0 PaddleOCR.js PP-OCRv6-small read 224/345 through its normal detector and 242/345 when the detector was bypassed and the whole stitched answer was sent directly to recognition. Direct recognition initialized in about 4.34 s and completed all 345 in 25.5 s in real WebKit. It still shared a high-confidence `30→32` error with TrOCR. | Reject both for production selection. Bypassing detection proves some fidelity loss, but neither model is a safe primary reader or independent veto. Paddle recognition alone adds about 21.3 MB. |
| Frozen PP-OCRv6 feature adaptation | Extracted 40-step blank/digit/non-digit probabilities for 923 authentic zones. A tiny decoder used slot count and row/non-row metadata, trained on 328 historical-development samples and selected only on 136 historical-validation samples. All 345 recent answers were excluded. Raw recent top-one was 233/345. The historical zero-error threshold accepted 60 recent answers with five errors above 0.99997; exact TrOCR agreement accepted 55 with one shared `30→32` error. | Reject. The off-the-shelf representation is not rescued by a tiny decoder, confidence calibration does not transfer, and independent agreement still shares a known error. Full Paddle fine-tuning would require materially more diverse authentic writers and a supported training environment. |
| Exact-live second-reader preservation audit | The first analysis incorrectly used reconstructed `evidence.browserRead`, producing an invalid apparent 311/345 by changing accepted reads. The corrected evaluator uses the exact live `initialRead`. Exact-text confirmation restores only four answers and makes two confident errors (`15→5` truth mismatch and `32→30` truth mismatch): 271/345 automatic, 78.6% coverage, two errors. | Fail and do not integrate. Preservation-only fallback cannot close the gap. The larger grayscale reader must become part of a newly validated initial recognition decision, not a post-acceptance replacement. |
| Preserved-grayscale co-primary Candidate 2 | Starting from the frozen 267/345 zero-error control, the initial candidate promoted only existing yellows and reached 297/345 (86.1%) with zero known errors. Residual audit showed 31/48 remaining yellows had a correct whole-answer proposal but five proposals were wrong. Adding a narrow key-blind lane—stitched and continuous agree at >=0.90 and uniform or exact three-frame evidence corroborates—reaches **311/345 (90.1%), 311 correct, zero known confident errors, 34 yellow**. Row/non-row are 93.0%/86.2%; P05 remains 72.9%. All 44 changes were visually inspected; 25 identical runs produced decision SHA-256 `3e1c6e0a435b6cabe03fcde21eef4a6b3cc1498d0e220d7aa8e2345a9dba8d06`; 237/237 tests and production build pass. | Retrospective research gate passes, public gate does not. Keep private/shadow. The rule was developed on these same five packets, views share a model family, and physical phone/old-iPad endurance plus prospective packet evidence are missing. Do not deploy or market 90.1% as expected public performance. |
| Candidate 2 staged private integration | Extracted the exact 267/345 control and Candidate 2 composition into pure runtime modules, then added a staged planner and exact three-distinct-frame reducer. Planner replay preserves 345/345 final decisions and cuts frame-routed answers from 40 to 36 by allowing frame work only to corroborate a repeated read, except on number bonds. The explicit private browser path now uses Candidate 2 and retains no-upload/fail-open behavior. A saved P05 number-bond scan completed in WebKit with exact expected decisions, no upload, 1.274 s initialization, ten persistent strong reads in 8.193 s, and nine session reuses. Full suite 251/251 and production build pass. | Private integration passes the one-page, no-burst smoke. Do not enable publicly. Run an actual retained three-frame scan on the current phone and old iPad, verify live evidence parity, timing, memory/endurance, correction, and annotation. Batch inference is the next speed experiment because individual calls remain about 0.63 s each. |
| Four-answer dynamic encoder batch | Added an isolated experimental batch request and compared it with exact sequential persistent inference on four authentic P05 number-bond crops in real WebKit. Sequential completed in 3.498 s; batch completed in 3.395 s. Batch token probabilities drifted by up to 0.0863 and changed one transcription from correct `6` to wrong `7`. | Reject. The 3% speed gain is immaterial and identical-input decision parity fails. Do not use model batching in any grading path. Preserve the report `private-evidence/reports/browser-local-batch-webkit-probe-20260724.json` as a failed experiment. |

Full result: `docs/SCANGRADE_BETA7_BETA15_3_RELEASE_GATE_20260723.md`.

| Live Candidate 7 replay against saved captures | The 92.8% Candidate 7 report was a reconstructed retrospective screen. Actual live WebKit application replay, with the verified 61.1 MiB local model, reached 268/345 automatic (77.7%), all correct, with 77 yellow; row was 85.0% and non-row 67.6%. The large reader added about 5–15 seconds on hard pages and the continuous 50-page harness stalled after 39 pages even when the strong model was disabled. | Reject as a public candidate. This is a different evidence regime from the retrospective report; record model/source hashes, use chunked harnesses for diagnosis, and do not cite either 90% or 77.7% as public performance. |
| Optional-slot blank plus 7.7 MiB scout rescue | The key-blind optional-slot rule identified 24 two-box one-digit cases; all 24 had one true handwritten digit, so it did not erase a genuine second digit. The residual handwritten digit was still wrong in 10 raw browser cases. The scout gave the true one-digit text in 18/24 but did not provide a qualifying original-yellow rescue under the no-silent-replacement invariant. An isolated fail-closed primitive and unit tests were added only for research. | Do not wire it into public or private automatic acceptance. Blank-slot repair is valid layout handling, not a general recognizer or a route to 90% coverage. |
| Strong-reader unanimous-error visual audit | In live strict-veto rows the larger grayscale readers correctly proposed many preserved browser reads, but can agree confidently on the same wrong transcription. Visual examples: handwritten `18` appeared as `14` to scout/stitched/continuous/uniform; child-written `8` appeared as `6` to the whole-answer readers. Repeating current-code P05 replay produced identical results, so this is model/crop-family correlation rather than run-to-run randomness. | Preserve strict vetoes. Same-family unanimity is not independent safety evidence. A new model or prospective data—not another confidence threshold—is required. |
| Beta 15.14 capture/review/score polish | Reduced only the automatic final-focus floor from 650 to 560 while preserving the ScanGrade four-corner sheet gate, QR decode requirement, pattern/blank rejection, live focus gate, and clearest-of-eight-frame selection. Replaced approximate correction cleanup with exact seeded highlighter-polygon cleanup; removed the active hotspot tint; changed score animation to reveal the exact final raster; made `8` one continuous figure-eight stroke; and made keyboard scrolling visibility-driven. All 301 repository tests and the pruned build pass; public mobile WebKit mounts with no errors. | Deploy as presentation/capture refinement. Recheck the softened focus floor prospectively on real phone captures; revert to 650 if it measurably increases blur-related OCR/yellow rate or capture failures. No recognition/confidence policy changed. |
| Beta 15.15 preliminary capture-trigger relaxation | Reduced the low-resolution live preview trigger from focus 300 to 240 and stable hold from 375 ms to 150 ms, changing the practical requirement from three stable 300 ms checks to two. Final full-resolution acceptance stays at 560 and the eight-frame burst, QR, four-marker sheet, pattern/blank, and motion gates remain intact. All 302 tests and the pruned build pass. | Deploy and assess capture time on the current phone. This should reduce reluctance without reducing accepted-frame quality; revert the preliminary trigger independently if it causes repeated failed bursts or capture churn. |
| Beta 15.16 shadow-tolerant preliminary sheet gate | Two Beta 15.15 phone screenshots showed complete, readable ScanGrade sheets with all four printed corner squares, but the preliminary live gate alternated between `Find the worksheet page` and `Find all 4 black squares`. The photographed paper averaged about 116/255 luma; the old hard rule required mean >=125 and >=52% of samples above 128. The marker validation also required >=12% dark pixels and mean <=190 in each deliberately oversized marker patch. Replaced only those preliminary appearance thresholds with a tested usable-paper decision (mean >=105, bright fraction >=12%, dark fraction <=28%) and shadow/soft-video marker decision (dark fraction >=6%, mean <=220). The former bright-paper rule remains a `preferred` signal, and the existing burst scoring still rewards brighter frames. Final focus 560, eight-frame selection, four detected marker geometry, perspective, motion, decodable ScanGrade QR, and OCR are unchanged. All 306 repository tests and the pruned build pass. Immutable/public bytes match; HTTPS browser smoke mounts the exact build; static `/api/submissions` confirms no Pages Function. | Deployed as a narrow capture-usability repair at `081de500.scangrade.pages.dev` and `scangrade.io`. Re-test on the current phone: a worksheet should progress to capture under ordinary indoor shadows, while fabric/non-sheet scenes must still fail the final QR gate. Revert only this appearance helper if capture churn becomes material. |
| Beta 15.17 complete-answer correction and Safari clearance | Live Beta 15.16 exposed a correction-integrity defect: when both slots of a two-digit answer were yellow, entering the first digit triggered the generic single-digit auto-submit and replaced only one slot. The pure auto-submit helper now requires the entered digit count to equal the editor's complete handwriting-length contract: one unresolved digit submits after one key; a two-digit whole answer waits for and submits after the second key. A separate viewport test reproduced Safari's QuickType/domain strip obscuring a lower correction panel; correction placement now reserves 64 px of reported-but-obscured viewport while preserving zero movement for already-visible upper answers. All 307 repository tests and the pruned build pass. Immutable/public bytes match, HTTPS smoke mounts the exact build, and the isolated static deployment exposes no Pages Function. | Deployed at `81da16ec.scangrade.pages.dev` and `scangrade.io`. Re-test H=`15` and one single-slot yellow on current iPhone. Confirm first key `1` remains visible, second key `5` completes `15`, and the lower panel clears the Safari strip in one smooth motion. |
| Beta 15.18 bounded annotation geometry | A live SG-G1-LW-08 number-bond scan placed several yellow highlights well outside the printed answer frames. The six-question/eight-slot layout coordinates match the worksheet SVG; the failure came from unconstrained preference for locally detected `boxRect` geometry, which can confuse nearby bond lines, circles, or frames with the answer box. Annotation placement now retains photographed adjustments only when area is plausible and the detected region materially overlaps the deterministic layout box; otherwise it falls back to layout geometry. OCR, grading, confidence, homography, and capture are unchanged. Four direct regressions and all 310 repository tests pass; pruned build passes. Final public HTML/JS hashes match and isolated static deployment leaves `/api/submissions` identical to the app HTML. | Deployed at `d2726924.scangrade.pages.dev` and `scangrade.io`. Re-scan the same number-bond sheet. Highlights should stay on the printed answer frames even if local contour detection sees a bond line; modest wrinkle corrections should still track the photographed box. |
| Beta 15.19 unified teacher ink and bounded score reveal | Checks and scores now share the New Scan base green `#126c39` when green, limited seeded variation, smooth felt-pen geometry, and one four-pass pressure/bleed recipe in every score color. Landing Start Scan uses the same rendered green. The score mask formerly exposed 20–32 px around a 4–7 px ink line, revealing nearby future-stroke fragments; it is now derived from actual ink width at about 8–15 px. Two direct style/mask regressions, all 312 repository tests, and the pruned build pass. Browser smoke confirms the final rendered button color; public HTML/JS hashes match and deployment is static. | Deployed at `f97f0a24.scangrade.pages.dev` and `scangrade.io`. Visually recheck one multi-stroke score such as `8/8` or `9/10`: only the active stroke plus slight bleed should appear, with no neighbouring digit fragments before their delay. |
| Beta 15.20 bounded centre drift, clean disclosure, and earlier preliminary capture | A dot-collection yellow mark was displaced about one slot despite satisfying the prior 28% overlap gate. Detected answer boxes must now remain within 35% of the layout slot centre in both axes; a 50%-overlap neighbouring-slot regression falls back to layout geometry while modest photographed corrections remain accepted. The review bar is now Home / plain centred down-up arrow / New Scan, with Login removed; unfinished landing Sign In and Teacher Review entries are hidden. Preliminary auto-capture focus/hold move from 240/150 ms to 220/100 ms, while the full-resolution focus 560, eight-frame selection, four-marker, QR, page, motion, and perspective gates remain unchanged. All 313 tests and the pruned build pass; live/static deployment parity is verified. | Deployed at `1b84b52f.scangrade.pages.dev` and `scangrade.io`. Re-scan the dot-collection page and time ordinary capture. The C swipe should stay on its printed slot and capture should open sooner. Revert only the preliminary trigger if failed-burst churn rises; do not reduce the final acceptance floor. |
| Beta 15.21 tighter teacher-ink anchor and compact correction row | The Beta 15.20 C swipe was attached to the correct slot but remained visibly low. Teacher ink now accepts photographed-box centre movement only within 15% of the deterministic layout slot; a new 20%-height-drift regression falls back while the existing modest wrinkle correction passes. The redundant correction X and title row are removed; the worksheet-style question bubble is vertically centred immediately left of the empty numeric field, followed by Save. OCR/capture/grading are unchanged. All 315 tests and the pruned build pass; immutable/public/static-fallback assets match. | Deployed at `5392b5a0.scangrade.pages.dev` and `scangrade.io`. Re-scan the same page and open C: yellow should centre on the printed slot, and the compact row should read bubble / input / Save with outside-tap dismissal. |
| Beta 15.26 number-bond correction-length contract and mutable-layout cache repair | Physical testing showed that one-box number-bond answers waited for two keypad entries. The shipped SG-G1-LW-08 metadata declared `max_handwritten_digits: 2` even for A/B/D/F, whose physical `digit_box_ids` contain one slot. Both layout copies now declare the printed contract `[1,1,2,1,2,1]`: one-box questions complete and advance after one key; C/E still require two explicit entries. Direct regressions lock both cases. The first deployment audit also caught stale HTML/layout caching, so mutable app-shell and layout JSON now explicitly revalidate while hashed assets remain immutable. OCR, confidence, grading, capture, homography, and answer-key policy are unchanged. Complete suite passes 325/325 and the pruned build passes. | Deployed at `d4f7b2af.scangrade.pages.dev` and `scangrade.io` as `2026.07.27-number-bond-entry-contract-beta-15-26`. Production serves `index-Cv5yFhQA.js`, the live layout contract is `[1,1,2,1,2,1]`, and response headers prevent the prior stale-build pinning. Physically confirm that A/B/D/F advance after one digit and C/E wait for two. |
| Beta 15.27 anchored source-photo annotations and continuous date | Beta 15.26 phone screenshots still showed displaced checks/highlights on perspective-heavy and wrinkled source photos. Source-photo rectangles had already passed through the page homography but could receive a second local-contour adjustment in displayed-photo coordinates. Source-photo teacher ink now stays on the transformed marker-derived printed-box anchor; OCR/refined crops and warped/debug placement remain unchanged. The scanning-date SVG also stays mounted through progressive grading instead of disappearing until the completed raster. Direct projection/lifecycle regressions and all 327 repository tests pass; the pruned build passes. | Deployed static-only at `8548a588.scangrade.pages.dev` and `scangrade.io` as `2026.07.27-anchored-photo-annotations-beta-15-27`. Production serves `index-DRwg2yAe.js`; `/api/submissions` matches the app shell byte-for-byte. Re-scan the same dot-collection and number-bond pages to physically verify exact mark anchoring and uninterrupted date visibility. |
| Beta 15.28 slot-faithful manual-correction preview | Beta 15.26 screenshots showed an in-progress correction rendered through a separate temporary style and centred across a two-slot answer. Added a pure physical-cell preview mapper and changed the on-sheet editor to render the same black marker-style correction face in a one- or two-cell grid. A partial two-digit entry stays in its eventual left cell; explicit `_` remains an empty physical cell. OCR, grading, confidence, capture, crops, homography, and final correction semantics are unchanged. Focused tests pass 10/10; complete suite passes 328/328; pruned build passes. | Deployed static-only at `b49acf5a.scangrade.pages.dev` and `scangrade.io` as `2026.07.27-slot-faithful-correction-preview-beta-15-28`. Production serves `index-BgUOh6Um.js` and `/api/submissions` remains the static shell. Physically verify on iPhone and old iPad that `2` remains in the left half before `0` appears on the right, that no blue/small duplicate digit flashes, and that the permanent correction does not move when the mark animation finishes. |
| Beta 15.29 registration-locked annotations and continuous correction | A Beta 15.28 ten-frame screenshot showed a yellow F mark about one slot right of the printed box. OCR/page registration and annotation were using two nominally equivalent rectangles; annotation recomputed normalized layout coordinates against the later pristine canvas dimensions, while OCR retained its authoritative registration-space rectangle. Source-photo annotation projection now carries the OCR/page-registration rectangle and uses independently scaled layout geometry only as a fallback. Across the existing four-packet replay (480 slots), median centre discrepancy to detected printed frames drops from 0.399 to 0.115 slot widths; ten frames 0.280→0.079, number bonds 0.408→0.060, dot collections 0.599→0.215. Manual correction animation now prebuilds a lossless base containing the final black entry before the displayed result changes and animates only its check/X, preventing the entry from flashing away. OCR/capture/confidence/grading are unchanged. Direct regressions and all 330 tests pass; pruned build passes. | Deployed from an isolated 222-file static directory at `bb55143a.scangrade.pages.dev` and `scangrade.io` as `2026.07.27-registration-locked-annotations-beta-15-29`. Production HTML/JS are byte-identical to the tested build (`index-C0kYCy0t.js`); `/api/submissions` remains the static shell. Physical iPhone verification remains required on the same ten-frame F case and one two-digit manual correction before calling the presentation defect closed. |
| Beta 15.30 coherent physical-frame annotations and quiet correction focus | Beta 15.29 phone evidence showed residual local paper curl: marker/page registration could be globally sound while one printed answer frame had shifted. Annotation metadata now uses an actually detected printed frame only when the full structural assignment is coherent; isolated/partial contours and every number-bond case fail closed to registration geometry. The four-packet replay processed the same 40 captures/480 slots with unchanged OCR output: 440 slots used trusted physical frames, 40 used fallback, all 32 number-bond slots stayed on fallback, and no two-slot answer mixed sources. Visual overlays of the largest shifts show physical rectangles on the printed boxes while prior registration rectangles can be about one slot away. The active correction cue is now persistent white tape with a thin muted-blue edge/soft halo instead of a filled blue layer. Complete suite passes 331/331; pruned build passes. | Deployed static-only at `f41ee5d8.scangrade.pages.dev` and `scangrade.io` as `2026.07.27-physical-box-anchored-review-beta-15-30`. Production serves byte-identical `index-27DDhp1W.js`; `/api/submissions` remains the static shell. Physical iPhone replay of the same single-digit and ten-frame sheets remains the final presentation check. |
| Beta 15.31 visible-handwriting correction focus | Beta 15.30's white active layer hid the handwriting the teacher needed to inspect. The pre-entry state is now fully transparent with a thin muted-blue oval/soft halo. On the first entered character it becomes white correction tape and displays the replacement in black; the permanent marked-sheet correction remains while focus advances. Correction semantics, OCR, confidence, grading, capture, and physical-box anchoring are unchanged. Focused correction suite passes 22/22; all 331 tests and the pruned build pass. | Deployed static-only at `14b7ee72.scangrade.pages.dev` and `scangrade.io` as `2026.07.27-visible-handwriting-review-beta-15-31`. Production serves byte-identical `index-CAiburV0.js` and `index-D2TFvp4H.css`; `/api/submissions` remains the static shell. Physically verify that original pencil is unobstructed before entry and that the transition is smooth on iPhone. |
| Beta 15.33 transition-locked correction and score ink | The live correction preview was DOM text while the settled correction was seeded Canvas ink, so size/offset/rotation could change when the blue focus frame disappeared. Both states now use the same Canvas correction renderer, raw physical slot rectangles, and seed. The live score also used padded review-region bottoms while the settled score used raw answer-box bottoms; both now call one shared placement function with physical answer rectangles. OCR, confidence, grading, capture, homography, answer placement, and correction semantics remain unchanged. Focused transition tests pass 9/9; all 335 tests and the pruned build pass. | Deployed static-only at `efaf7a50.scangrade.pages.dev` and `scangrade.io` as `2026.07.27-transition-locked-ink-beta-15-33`. Production serves `index-bsmFV8i1.js` and `index-CJo54A8l.css`; `/api/submissions` is byte-identical to the app shell. Verify on iPhone that a typed correction remains pixel-stable as focus advances and an `8/8` remains in place after the last stroke. |
| Beta 15.34 camera-readiness state cleanup | A completed valid scan could retain an earlier transient “camera is still getting ready” warning because successful capture did not clear the prior error state. Successful capture now clears readiness errors, with a narrow lifecycle guard for drawable-frame/captured-image/result transitions. Blur, framing, QR, permission, and other real failures are deliberately preserved. Capture thresholds, quality policy, OCR, grading, and annotations are unchanged. Four direct lifecycle regressions and all 339 repository tests pass; the production build passes. | Deployed static-only at `a6cccd57.scangrade.pages.dev` and `scangrade.io` as `2026.07.27-camera-ready-state-beta-15-34`. Production serves byte-identical `index-OHq4Lrww.js`; `/api/submissions` remains the static shell. Verify on iPhone that a prior warm-up warning disappears immediately after the camera becomes drawable or a scan succeeds. |
| Beta 15.32 human score strokes and slot-shaped focus | The completed-score raster mask could reveal spatially adjacent future ink where a figure-eight crosses itself, making lower loops appear before the virtual pen reached them. The live score now draws the actual coloured pen paths rather than uncovering a finished bitmap: each `8` is one continuous top-first stroke, characters run strictly left-to-right, and live/final rendering share identical deterministic four-pass geometry. The transparent correction cue is now a thin blue rectangle/glow locked to the physical digit slot rather than an oval; a one-slot uncertainty in a two-slot answer frames only that slot. OCR, confidence, grading, capture, homography, and correction semantics are unchanged. Focused tests pass 8/8; all 332 tests and the pruned 222-file build pass. | Deployed static-only at `8a67d755.scangrade.pages.dev` and `scangrade.io` as `2026.07.27-human-score-strokes-beta-15-32`. Production serves byte-identical `index-DoctASZ-.js` and `index-DjEGJ-hx.css`; `/api/submissions` is the identical static shell. Physically inspect one `8/8` or `9/10` score and a one-slot two-digit correction on iPhone: no future score fragment may appear, no character may shift at completion, and the blue frame must preserve the student's pencil. |
| Beta 15.35 stationary yellow-to-completion flow | The previous date was present during scanning and baked into intermediate annotation rasters, while the first yellow still required a tap after automatic marking. The revised state machine draws settled automatic marks, opens the first yellow automatically, continues the existing yellow-to-yellow advance, draws the score only after review is complete, then reveals the exact final-raster date pixels as a modestly larger completion seal. Correction-animation bases remove the baked date until that final step. Manual teacher digits use a lighter weight and reduced duplicate-ink pass. The live correction component contains no worksheet-scroll command; the fixed keypad remains over the QR/lower area. OCR, confidence, grading, capture, homography, answer geometry, and correction semantics are unchanged. All 341 tests and production build pass. | Deployed static-only at `fd7c8b46.scangrade.pages.dev` and `scangrade.io` as `2026.07.28-completion-flow-beta-15-35`. Production HTML and `index-D_a_Jh7y.js` are byte-identical to the tested build; `/api/submissions` returns the identical static shell. Physically verify one no-yellow page and one multi-yellow page on current iPhone and old iPad: first yellow must focus without a tap; the sheet must not pan; the score must wait for all yellows; date must appear once, last, without moving at settlement. |
| Beta 15.36 productive marking scheduler | The progressive state machine previously waited for every asynchronous V3 evidence task before drawing any mark. A new pure scheduler requires the verifier to declare the union of existing yellows and suspicious accepted questions before background work starts. Settled questions outside that queue can animate during verification; queued questions remain withheld. Missing queue metadata fails closed and blocks early marking. No public reader or recognition rule was enabled because the available browser-local candidates remain retrospective/device-untested. Public OCR, coverage, yellows, grading, capture, and answer-key boundaries are unchanged. Direct scheduler regressions and all 345 tests pass; production build passes. | Deployed static-only at `bca456b4.scangrade.pages.dev` and `scangrade.io` as `2026.07.28-productive-marking-beta-15-36`. Production HTML and `index-BoqLr77d.js` are byte-identical to the tested build; `/api/submissions` is the identical static shell. Physically time the explicit local-verifier lane on a multi-answer page and confirm that safe marks begin while queued evidence remains pending. Only enable a public second reader after a frozen prospective zero-confident-error and physical-device gate. |
# 2026-07-28 — Beta 15.37 quiet focus and completion presentation pass

- **Question:** Can silent work remain visibly responsive without allowing the
  status animation to compete with active teacher marks or manual review?
- **Change:** Kept the scanning sweep, froze the grading highlight into a
  steady band, added a border/shadow-only pulse to the active correction box,
  lightened shared correction ink from 700/0.16 duplicate ink to 600/0.10, and
  added a transient completion halo around the final date stamp.
- **Safety boundary:** No OCR, confidence, crop, capture, homography, grading,
  answer-key, or correction-contract behavior changed. The date and correction
  digit pixels still come from their shared settled renderers.
- **Result:** Focused tests 23/23; full repository 347/347; pruned production
  build passed. The isolated static deployment at
  `e1816fa1.scangrade.pages.dev` and `scangrade.io` matches the tested HTML and
  JavaScript byte-for-byte; the API-shaped path returns only the static shell.
  This presentation-only release still needs physical-device review.

# 2026-07-28 — Beta 15.38 stable correction transition

- **Observation:** The corrected digit appeared to move or change tone when its
  blue focus frame vanished.
- **Diagnosis:** Live and settled correction ink already share identical
  renderer calls, physical slot rectangles, and deterministic seed. Beta
  15.37's pulse animation overrode the entered-state dimming, leaving a strong
  contrast frame until abrupt removal.
- **Change:** Reduced pulse amplitude and added a 180 ms border/shadow-only
  release animation once a complete entry begins submission. Partial
  multi-digit entries keep focus. Black correction ink is never animated,
  transformed, or faded.
- **Result:** Focused presentation tests 23/23; full repository 347/347;
  pruned production build passed. Static production deployment
  `a2299891.scangrade.pages.dev` and `scangrade.io` matches the tested HTML and
  JavaScript byte-for-byte; the API-shaped path remains only the app shell.
  OCR and grading behavior remain frozen.

# 2026-07-28 — Beta 15.39 natural date impression

- **Observation:** The expanding blue date outline looked like interface
  feedback instead of a natural teacher completion mark.
- **Change:** Removed the separate blue splash shape. The exact final-raster
  date now lands using only a brief blur, saturation, and same-blue
  drop-shadow bloom before settling crisp at its unchanged opacity.
- **Geometry invariant:** The date image has no translation, scale, or
  transform at any animation stage. Its clip rectangle, source pixels, and
  final position are unchanged.
- **Safety boundary:** Presentation only. OCR, confidence, crop, capture,
  homography, grading, answer-key, correction, and annotation placement logic
  are unchanged.
- **Result:** Progressive marking tests pass 18/18; the complete repository
  passes 347/347; the pruned production build passes. Static deployment
  `36c41a3a.scangrade.pages.dev` is live at `scangrade.io`. Production HTML
  and `index-C1MN8Jie.js` are byte-identical to the tested build. A
  cache-busted `/api/submissions` request returns the same app shell, so no
  Pages Function is active.

# 2026-07-28 — Beta 15.40 score-adjacent completion date

- **Observation:** Even with the interface-like halo removed, the header date
  was away from the viewer's attention after the handwritten score completed.
- **Change:** The completion date now derives from the existing
  answer-box-aware score placement and lands directly below it, to the right
  of the QR zone. A temporary neutral light/shade gradient simulates slight
  paper compression under the stamp and fades without residue.
- **Geometry invariant:** Live reveal, final Canvas annotation, and
  correction-animation cleanup share the same score-relative date rectangle.
  Neither the date nor worksheet is translated or scaled by the impression.
- **Safety boundary:** The old declared date zone remains the per-template
  opt-in contract. Unsupported layouts still omit the date rather than guess.
  OCR, confidence, capture, grading, corrections, and score placement are
  unchanged.
- **Result:** Focused date/score/progressive tests pass 29/29; the full
  repository passes 349/349; the pruned production build passes. Static
  deployment `28b3cc05.scangrade.pages.dev` is live at `scangrade.io`.
  Production HTML and `index-CKkjlQJ6.js` are byte-identical to the tested
  build, and the cache-busted API-shaped path returns the same static shell.
## 2026-07-28 — Beta 15.41 varied completion stamp and full-height focus audit

- Trigger: physical review found a white outline beneath the completion date,
  asked for restrained between-sheet slant/position variation, a generally
  farther-right stamp, and confirmation that the manual-input pulse also
  appears for bottom questions.
- Change: replaced the white-ended pressure gradient with neutral shadow-only
  compression; shifted the bounded score-adjacent date zone right; connected
  date placement and rotation to the existing deterministic annotation seed
  in live, saved, and correction-cleanup paths.
- Focus result: the blue focus frame is driven solely by the active answer's
  registered `focusTopPct`/box geometry. It has no upper/lower or viewport
  branch. Added a direct regression to prevent such a cutoff.
- Safety: no OCR, recognition, grading, capture, homography, crop, confidence,
  answer-key, or correction-policy changes.
- Verification: focused tests **30/30**; full suite **351/351**; pruned
  production build passed.
- Deployment: static-only `8724cffd.scangrade.pages.dev`, promoted to
  `scangrade.io`; production serves the verified `index-BsH-NPm5.js`.
## 2026-07-28 — Beta 15.42 balanced red ink and X endpoint repair

- Decision: Tony selected brighter-red option 2, `#9a342f`, after comparing it
  beside the established `#126c39` teacher green.
- Change: centralized that red for incorrect X marks and low-score writing.
  Progressive strokes retain their normal dash reveal while moving, then
  become a solid completed path on the final animation frame. This prevents a
  Safari residual gap, especially on the X's delayed second stroke.
- Safety: presentation only; OCR, recognition, confidence, crops, capture,
  homography, grading decisions, and correction semantics are unchanged.
- Verification: focused tests **23/23**; full suite **352/352**; pruned
  production build passed.
- Deployment: static-only `e69b29f1.scangrade.pages.dev`, promoted to
  `scangrade.io`; production serves verified `index-07fwW0ch.js`.

## 2026-07-28 — Beta 15.43 clear red and WebKit full-scale stroke reveal

- Decision: Tony selected the brighter `#a03731` red option.
- Failure evidence: live iPhone review still showed intermittent gaps,
  especially during the X's delayed crossing stroke, after Beta 15.42's final
  frame repair.
- Root cause and change: Safari/WebKit was still rounding normalized
  `pathLength="1"` dash geometry during the animation. Both progressive mark
  masks and direct score ink now use 100-unit path lengths/dashes, then settle
  to a solid 100/0 path. Geometry, timing, and first-stroke-before-second order
  are preserved.
- Safety: presentation only; OCR, recognition, confidence, crops, capture,
  homography, grading decisions, and correction semantics are unchanged.
- Verification: focused tests **23/23**; full suite **352/352**; pruned
  production build passed.
- Deployment: static-only `8f3e9a48.scangrade.pages.dev`, promoted to
  `scangrade.io`; production serves verified `index-r02V_Tdi.js`.

## 2026-07-28 — Beta 15.44 darker red and score/date separation

- Decision: Tony selected darker red option 2, `#862c2a`, after a direct
  current-green/current-red/new-red comparison.
- Change: incorrect X marks and red low scores use the new shared red. The
  completion date begins at least `0.84 ×` the score font size or `3%` of page
  height below the score anchor, adding visible separation while preserving
  the existing QR-aware bounds and deterministic natural variation.
- Safety: presentation only; OCR, recognition, confidence, crops, capture,
  homography, grading decisions, correction semantics, and answer-key
  boundaries are unchanged.
- Verification: focused tests **29/29**; full suite **352/352**; pruned
  production build passed.
- Deployment: static-only `cf066476.scangrade.pages.dev`, promoted to
  `scangrade.io`; production serves verified `index-CFsvfDhL.js`.

## 2026-07-28 — Beta 15.45 measured stroke reveal and framed correction tape

- Failure evidence: physical iPhone testing still showed gaps during the first
  reveal of some red strokes, and the blue correction border covered the
  outside edge of the white correction tape, making the tape appear to grow
  when focus ended.
- Root cause and change: CSS animation of normalized SVG dash lengths remained
  vulnerable to WebKit rounding. Progressive check, X, and score paths now use
  each path's measured physical length, a two-unit endpoint overrun, and an
  explicit solid settled state. The blue focus treatment moved from an inward
  border to a `2px` outline with a `3px` external offset.
- Safety: presentation only; OCR, recognition, confidence, crops, capture,
  homography, grading decisions, correction semantics, answer geometry, and
  answer-key boundaries are unchanged.
- Verification: focused tests **25/25**; full suite **353/353**; pruned
  production build passed.
- Deployment: `41bf5ba5.scangrade.pages.dev`, promoted to `scangrade.io`;
  production serves byte-identical `index-B1Kpgg1O.js`.

## 2026-07-28 — Beta 15.46 simultaneous focus-to-tape handoff

- Decision: restore the compact blue frame used before Beta 15.45, but prevent
  it from overlapping the visible correction tape.
- Change: the focus treatment is again a `2px` border on the digit-slot
  geometry. As soon as correction text creates the white-tape preview, the
  border animation, border color, and glow are removed in that same render.
  The former delayed release animation was removed.
- Safety: presentation only; OCR, recognition, confidence, crops, capture,
  homography, grading decisions, correction values, and answer-key boundaries
  are unchanged.
- Verification: focused tests **24/24**; full suite **353/353**; pruned
  production build passed.
- Deployment: `369e18a1.scangrade.pages.dev`, promoted to `scangrade.io`;
  production serves byte-identical `index-BfcNW362.js`.

## 2026-07-28 — Beta 15.47 strictly sequential red X

- Failure evidence: on the physical phone, the X's second crossing stroke
  appeared to begin before its first stroke had visibly ended.
- Change: X stroke one runs top-left to bottom-right for `270ms`, followed by
  a `160ms` hand-lift pause; only then does stroke two run top-right to
  bottom-left for `270ms`. Delayed SVG paths remain fully transparent until
  their active interval, and the next question cannot start until the whole X
  has completed plus an `80ms` settling margin.
- Safety: presentation only; OCR, recognition, confidence, crops, capture,
  homography, grading decisions, correction values, and answer-key boundaries
  are unchanged.
- Verification: focused tests **24/24**; full suite **353/353**; pruned
  production build passed.
- Deployment: `6b92f7c4.scangrade.pages.dev`, promoted to `scangrade.io`;
  production serves byte-identical `index-B1EXIQyg.js`.

## 2026-07-29 — Beta 15.48 continuous correction paint, static completion stamp, and landing layout

- Failure evidence: the manually entered black digit could disappear for one
  frame between removing the live entry overlay and painting the base used for
  its check/X animation.
- Correction change: retain the live white-tape/black-digit preview until the
  replacement image has loaded and passed two browser paint frames. Review
  advances only after that handoff, preventing a blank intermediate frame.
- Completion change: keep the approved date size and placement, but remove the
  stamp blur/pop and temporary paper-impression animation. The final date now
  appears once at settled opacity after the score and holds for `420ms`.
- Landing change: give the opening screen a distinct centered hero layout with
  a `68px` logo and `30px` wordmark. The capture/grading header retains its
  compact `44px`/`20px` geometry. The settled landing was visually inspected
  in an iPhone 13 browser render.
- Safety: presentation only; OCR, recognition, confidence, crops, capture,
  homography, grading decisions, correction values, date placement, and
  answer-key boundaries are unchanged.
- Verification: focused tests **27/27**; full suite **353/353**; pruned
  production build passed.
- Deployment: `5c450b80.scangrade.pages.dev`, promoted to `scangrade.io`;
  production serves byte-identical `index-C7E543Dp.js`.

## 2026-07-29 — Beta 15.49 QR-safe completion placement

- Failure evidence: a real skewed iPhone capture of
  `sg-g1-lw-06-ten-frames` placed the completion date across the QR code and
  left the handwritten `6/6` with insufficient QR clearance.
- Root cause: placement used small offsets from transformed QR coordinates but
  did not collision-test the full visible score and date footprints after
  perspective correction.
- Change: create padded QR exclusion rectangles for both score and date. Place
  the score fully beside the QR or fully above it; require the date to clear
  both the QR exclusion and the score safety rectangle. Reduce date-zone width,
  move it farther right/below, and omit the optional stamp if no safe area
  remains.
- Regression: reproduce a lower-right-shifted ten-frame QR and assert no
  score↔QR, date↔QR, or date↔score intersection. A second test locks the
  fail-closed omission behavior under extreme skew.
- Safety: presentation geometry only; OCR, recognition, confidence, capture,
  homography, grading decisions, correction values, and answer-key boundaries
  are unchanged.
- Verification: focused placement tests **13/13**; full suite **355/355**;
  pruned production build passed.
- Deployment: `08bb3bfd.scangrade.pages.dev`, promoted to `scangrade.io`;
  production serves byte-identical `index-BYipC2TZ.js` and
  `index-Cf3B6WSa.css`.

## 2026-07-29 — Beta 15.50 installable web app

- Objective: make the verified ScanGrade website installable on iPhone and
  iPad without creating a separate native-code product or changing the grading
  pipeline.
- Change: add a relative-scope web app manifest, iOS standalone metadata,
  exact-logo home-screen icons, production-only service-worker registration,
  and explicit Cloudflare cache headers for the manifest, worker, and icons.
- Update safety: the worker checks for a new version on load but never reloads
  an active page. Navigations are network-first; hashed UI assets and approved
  public icon/font assets are cache-first.
- Privacy and correctness boundary: the worker ignores non-GET requests,
  cross-origin requests, range requests, and `/api/`. It does not cache scans,
  corrections, submissions, debug uploads, OCR models, ONNX Runtime,
  OpenCV, `localStorage`, or IndexedDB data.
- Limitation: the install adds a standalone app experience and a small
  resilience shell; it does not make first-use recognition fully offline.
- Safety: no OCR, recognition, confidence, capture, homography, grading,
  correction, answer-key, or worksheet behavior changed.
- Verification: contract tests validated manifest fields, icon dimensions,
  service-worker boundaries, registration, and headers. Chromium found zero
  manifest errors, activated `/sw.js` at root scope, and created only
  `scangrade-shell-v1` and `scangrade-assets-v1`. Full suite **358/358** and
  pruned production build passed.
- Deployment: `1843266b.scangrade.pages.dev`, promoted to `scangrade.io`.
  HTML, hashed JavaScript/CSS, manifest, service worker, and Apple touch icon
  match the verified build byte-for-byte. The production manifest has no
  browser-reported errors and `/sw.js` is active at site-root scope.

## 2026-07-29 — Beta 15.51 optically centered app icon

- Evidence: Tony's physical iPhone Home Screen screenshot showed a light-grey
  icon tile and a logo that appeared too far left. Pixel measurement confirmed
  that the old 180px icon's heavy black ink center was `4.48px` left of the
  canvas center even though its outer bounds were geometrically centered.
- Change: render the unchanged approved transparent logo on pure white, shift
  it right by `2.35%` of each icon canvas, and publish versioned 180px, 192px,
  512px, and maskable 512px assets. The resulting Apple icon ink center is
  `89.77px` on a 180px canvas.
- Cache safety: both the Apple touch-icon link and manifest icon URLs are new,
  so deleting and re-adding the app cannot receive the former cached artwork.
- Regression: decode the actual Apple PNG, verify native dimensions and file
  integrity, require a pure-white three-pixel perimeter, and require measured
  black-ink center to be within one pixel of true center on both axes.
- Safety: visual app-icon assets only; no OCR, capture, grading, worksheet,
  correction, privacy, or student-data behavior changed.
- Verification: focused icon/PWA contract **5/5**, full suite **360/360**,
  pruned production build passed, and an Apple-style rounded-mask old/new
  comparison was visually inspected.
- Deployment: `67ff2433.scangrade.pages.dev`, promoted to `scangrade.io`.
  Production HTML, manifest, and Apple icon match the verified artifacts
  byte-for-byte, and a fresh browser install inspection found no manifest
  errors and only the new versioned icon URLs.

## 2026-07-29 — Beta 15.52 physical-device icon alignment

- Evidence: after deleting and reinstalling Beta 15.51, Tony's second physical
  iPhone Home Screen inspection still read the mark slightly left of center.
- Change: translate the unchanged logo an additional `2px` right on the native
  180px Apple canvas, with proportional shifts in the 192px, 512px, and
  maskable assets. Preserve the pure-white background and high-quality source
  reduction.
- Cache control: publish all four assets under new `v3` paths and update both
  the Apple touch-icon link and manifest, forcing a newly added app to use the
  corrected artwork.
- Safety: icon presentation only; no grading, OCR, capture, worksheet,
  correction, storage, service-worker privacy, or student-data changes.
- Verification: icon/PWA contract **5/5**, full suite **360/360**, and pruned
  production build passed.
- Deployment: `50dd3556.scangrade.pages.dev`, promoted to `scangrade.io`;
  public HTML and the marker-centered `v5` Apple icon match the verified build
  byte-for-byte.
- Deployment: `3ad73687.scangrade.pages.dev`, promoted to `scangrade.io`;
  public HTML and the `v4` Apple icon match the verified build byte-for-byte.

## 2026-07-29 — Beta 15.54 marker-centered app icon

- Evidence: pixel measurement of Tony's latest physical iPhone screenshot
  found a rendered tile from x=`32–143`, a `25px` left lower-marker gap, and an
  `18px` right lower-marker gap.
- Change: remove the subjective optical offset and geometrically center the
  unchanged source logo. This predicts an approximately `3.5px` left movement
  in the physical screenshot and equal marker-to-tile margins.
- Regression: on the actual 180px Apple PNG, require a pure-white perimeter
  and equal lower dark-marker edge gaps within one pixel.
- Cache control: all install references use fresh `v5` asset paths.
- Safety: icon presentation only; no OCR, grading, capture, correction,
  worksheet, privacy, or student-data changes.
- Verification: icon/PWA contract **5/5**, full suite **360/360**, and pruned
  production build passed.
- Deployment: `190552d2.scangrade.pages.dev`, promoted to `scangrade.io`;
  public HTML and the versioned `v3` 180px Apple icon match the verified build
  byte-for-byte.

## 2026-07-29 — Beta 15.53 final physical icon alignment

- Evidence: immediate physical iPhone inspection showed Beta 15.52 was one
  native Apple-icon pixel too far right.
- Change: move the full unchanged mark exactly `1px` left on the 180px Apple
  asset, with proportional movement in standard and maskable icons. Preserve
  the pure-white background and existing scale.
- Cache control: all install references now use new `v4` icon paths.
- Safety: icon presentation only; no OCR, grading, capture, correction,
  worksheet, privacy, or student-data change.
- Verification: icon/PWA contract **5/5**, full suite **360/360**, and pruned
  production build passed.

## 2026-08-01 — Beta 15.60 prospective 7→1 safety repair — rejected

- **Evidence:** A physical public Beta 15.59 scan of `SG-G1-LW-03` showed a
  clearly written `7` confidently transcribed as `1` at question C. This is a
  transcription safety failure; question G on the same page was correctly
  graded wrong after the teacher confirmed the student's written `9`.
- **Candidate:** Preserve but force yellow for an otherwise accepted isolated
  one-slot browser read of `1`. The decision receives neither handwritten
  truth nor the mathematical answer key and never substitutes another digit.
- **Replay:** `node scripts/evaluate_six_eight_scout_veto.mjs` replays the
  policy over 345 primary and 40 historical labelled answers. It changes zero
  known decisions, retains primary zero-confident-error status, adds no
  historical error, and leaves measured automatic coverage unchanged. A
  simulated `7→1` live incident becomes yellow with browser read `1`
  preserved. Private report:
  `private-evidence/reports/public-critical-confusion-veto-20260801.json`.
- **Decision:** Reject and remove the broad veto. The replay's zero changed
  decisions was non-informative because the labelled corpus contained no
  confidently accepted isolated `1`. Legitimate `1` answers would otherwise
  be needlessly reviewed. Do not claim the `7→1` incident is fixed; collect its
  original debug evidence and representative authentic isolated `1`/`7` crops
  before attempting a narrower second-reader shape rule.
- **Animation repair:** The red X crossing leg is one continuous top-right-to-
  bottom-left path. It cannot become visible until the first leg settles, two
  render frames complete, and the pen-lift pause elapses. This replaces
  reliance on Safari's early animation-finished event.
- **Deployment:** `41975303.scangrade.pages.dev`, promoted to
  `scangrade.io` as `2026.08.01-one-seven-safety-sequential-x-beta-15-60`.
  Production HTML and JavaScript are byte-identical to the tested release;
  `/api/submissions` remains the identical static shell with no backend.

## 2026-08-01 — Beta 15.61 removes broad isolated-1 veto

- **User finding:** Treating every accepted isolated `1` as suspicious is not
  a sensible general policy because many worksheets legitimately contain `1`.
- **Repair:** Remove only the Beta 15.60 isolated-`1` veto and associated
  runtime routing. Restore the public safety scope to the previously verified,
  key-blind, single-slot `6`↔`8` scout conflict.
- **Preserved work:** Keep the independently tested sequential red-X repair.
- **Open incident:** The physical `7→1` error remains unresolved. A screenshot
  after grading is insufficient for a shape-specific fix because it lacks the
  raw crop and alternate preprocessing/model evidence.
- **Decision:** Ordinary accepted `1` answers remain automatic. Any future
  `1`/`7` repair must be evidence-specific and must be tested on authentic
  examples of both digits before deployment.
- **Verification:** Added a regression proving an accepted isolated `1` is not
  blanket-routed to review. Focused safety/animation tests **42/42**, complete
  suite **368/368**, narrow 6↔8 replay gate, and pruned production build pass.
- **Deployment:** Source `f74c6cb`; isolated static release
  `7267edd3.scangrade.pages.dev`, promoted to `scangrade.io` as
  `2026.08.01-sequential-x-beta-15-61`. Production, immutable, local-release,
  and `/api/submissions` HTML match byte-for-byte; public JavaScript matches the
  verified release and no backend is active.

## 2026-08-01 — Beta 15.62 targeted 1→7 veto and direct-ink X candidate

- **New evidence:** A repeat physical Debug Scan reproduced the authentic
  `SG-G1-LW-03` C error: a written `7` was confidently accepted as `1`.
  The saved labelled P03 evidence for this exact question records initial
  automatic read `1` and an independent whole-slot scout read `7` at
  `0.999459` probability.
- **Narrow safety rule:** For one physical slot only, browser `1` plus scout
  `7` at `>=0.99` forces yellow. It preserves `1`, never auto-corrects, and is
  blind to the answer key and handwritten truth. Scout agreement on `1` and
  weaker conflicts do nothing, so legitimate `1` answers are not blanket-
  reviewed.
- **Replay:** All 385 labelled answers retain identical measured decisions and
  `88.6%` automatic coverage. The primary 345 retain zero known confident
  errors; three unrelated historical errors remain in the older 40. The
  authentic P03 target is demoted to review, as is the prior 6/8 incident.
  Private output:
  `private-evidence/reports/public-critical-confusion-scout-veto-20260801.json`.
- **X root cause and repair:** The prior mask revealed pixels from a completed
  X bitmap; where the broad first-leg mask crossed the second leg, future ink
  appeared early. Incorrect marks now animate as two real red SVG paths. The
  second remains absent until the first finishes, two paint frames settle, and
  the pen-lift pause ends. Its geometry matches the final raster path.
- **Debug UX:** The JSON export action is moved above the result grid so a
  completed Debug Scan no longer looks like a frozen dead end.
- **Verification:** focused tests **41/41**, complete suite **369/369**,
  labelled replay gate, and production build pass. Physical iPhone verification
  remains required before calling the candidate fully verified.
- **Deployment:** Source `29beb54`. A first preview (`23bda85f`) accidentally
  discovered the dormant repository Functions because Wrangler was launched
  from the repo; its unconfigured D1 response was caught before promotion. The
  safe replacement was launched from the isolated static directory only:
  `617ab041.scangrade.pages.dev`, promoted to `scangrade.io`. Immutable,
  production, local, and `/api/submissions` HTML match byte-for-byte; public
  JavaScript matches the tested release and contains the Beta 15.62 label.
# 2026-08-01 — Beta 15.63 iOS debug-export repair and unified X colour

- Observation: the Beta 15.62 Debug Scan finished and displayed its result,
  but an installed iPhone web app did not complete the synthetic anchor-file
  download. The same scan again accepted a handwritten `7` as `1`, showing
  that the narrowly shipped `scout 7 >= 0.99` veto did not activate for this
  capture. No recognition threshold was changed without its saved evidence.
- Reversible UI/runtime repair: use file-capable Web Share first; use clipboard
  in installed-iOS fallback; retain delayed-revocation anchor download for
  ordinary browsers; show explicit export state and provide a Copy action.
- Rendering repair: replace seeded red hue variation with one shared
  `#9a3a37` for both progressive SVG and settled canvas X paths.
- Tests: `node --test tests/*.test.mjs` -> **373/373 pass**. `npm run build`
  passes. The next evidence gate is a physical Debug Scan export of the live
  `7`→`1` case; this candidate does not claim that recognition incident fixed.
