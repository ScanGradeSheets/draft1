# ScanGrade Active Handoff

## 2026-08-14 private iPhone correction-lifecycle diagnostic

- Physical iPhone build 15.105 again reached marking in about eleven seconds,
  but marks still disappeared during manual correction and the result again
  ended in a persistent `Scanning` state. This disproves the 15.105 ordering
  hypothesis as a complete fix; do not count either 15.104 or 15.105 as an
  accepted UX result.
- Added a deterministic mobile-WebKit reproduction that replays the retained
  physical capture and its three actual frames through the exact private
  Hybrid V2-only pipeline, then completes two manual corrections. It completed
  in 15.6 seconds with no page exception, no stuck stage, and a settled final
  annotated image. The failure is therefore physical-iPhone-specific (likely a
  resource/lifecycle exception) rather than reproduced by desktop WebKit.
- Debug-only replay hooks are gated behind `v3BurstReplay`; ordinary and public
  scans cannot invoke them. Debug Export now includes a bounded lifecycle trace
  and current UI snapshot. If a physical debug result is stuck in `Scanning`,
  an emergency Export button remains visible so the exact state can be saved.
  Build label is `2026.08.14-private-lifecycle-diagnostic-beta-15-106`.
  This build is diagnostic and must not be treated as a fix. Complete suite
  **506/506**, production build, and `git diff --check` pass.

## 2026-08-14 private iPhone pre-acceptance presentation ordering fix

- Physical iPhone run on private build 15.104 reached visible marking in about
  nine seconds with two yellow digits, but settled marks disappeared during
  manual correction and the UI returned to an indefinite `Scanning` state
  after review. This run is rejected as a UX/lifecycle regression despite its
  speed and lower yellow count.
- Root cause was a pre-acceptance ordering gap: the strong-yellow promise made
  its result interactive immediately before the enclosing OCR lifecycle set
  `processing=false`. During that gap, the displayed-image priority selected
  the clean scanning preview instead of the settled correction base, explaining
  both the disappearing marks and the stale `Scanning` bar.
- The private strong-yellow apply path now defers installing both successful
  and fail-open results until after its candidate promise has settled and
  `processing` is false. Recognition models, crops, thresholds, safety vetoes,
  and public behavior are unchanged. The complete repository suite passes
  **503/503**, the production build passes, and `git diff --check` passes.
  Build label is
  `2026.08.14-private-yellow-atomic-beta-15-105`; physical iPhone verification
  is required before accepting the fix.

## 2026-08-14 private yellow-only three-frame application candidate

- Added an explicit tailnet-only `v3BrowserLocalStrongApply=1` mode for the
  already-tested strong reader. It holds the result before any marks are shown,
  reads only answers already yellow in the frozen browser result across three
  retained physical frames, and promotes only exact 3/3 agreement whose weakest
  token probability is at least 0.90. Accepted answers are never revisited.
- Missing frames, disagreement, malformed output, sub-threshold confidence,
  safety vetoes, worker/model failure, timeout, unsupported configuration, or
  any incomplete batch fail open to the unchanged browser result. The apply
  flag cannot operate on `scangrade.io`; it requires the private `.ts.net`
  origin, explicit shadow/apply flags, secure same-origin model assets, and
  exactly three frames. Default strong-shadow behavior remains grade-inert.
- The result remains hidden until the candidate completes, avoiding transient
  marks or post-acceptance replacement. It records decisions, frame evidence,
  promotions, timing, and the frozen policy name in Debug Export. Complete
  repository suite **503/503**, production build, old-Safari compatibility,
  correction/annotation lifecycle contracts, and `git diff --check` pass.
- Build label is `2026.08.14-private-yellow-3frame-beta-15-104`. This is a
  private familiar-sheet integration trial only, not a new prospective freeze
  and not public deployment authority. Physical iPhone verification is still
  required before freezing or touching an untouched packet.

## 2026-08-14 offline candidate safety and reproducibility battery

- Untouched packets remained sealed and public `scangrade.io` remained
  unchanged. The retrospective 345-answer audit was regenerated from its
  source evidence and matched the prior report byte-for-byte after excluding
  only `generatedAt`. At the frozen 0.90 threshold it again promotes 5/74
  eligible historical yellows, all five correct, with zero known promotion
  errors. This is deterministic retrospective evidence, not prospective proof.
- Added direct fail-open coverage for the exact frozen-control boundary:
  original-yellow eligibility, the 0.90 confidence edge, malformed reads,
  missing/incomplete/conflicting frame evidence, NaN confidence, safety vetoes,
  uniform/frame disagreement, and answer-key-shaped fields. An exhaustive
  frame-only matrix also verifies that automatic rescue is impossible unless
  every frozen prerequisite is true.
- Complete repository suite **498/498**, production build, and
  `git diff --check` pass. No OCR, capture, homography, layout, model, threshold,
  or production behavior changed; the only new code is test coverage. The next
  non-correlated evidence remains a frozen, prediction-blinded physical trial
  on an untouched packet.
- Current pipeline replay has exact decision parity on all 345 historical
  answers (zero control or final-decision mismatches). The July Candidate 2
  hash manifest correctly refuses to verify because the cascade file received
  an August 9 old-Safari compatibility rewrite (`at(-1)` to indexed access).
  That rewrite is behavior-equivalent in the 345-answer replay, but the old
  freeze must not be reused. Create and verify a new dated hash freeze before
  consuming any untouched packet; do not overwrite the historical freeze.

## 2026-08-14 iPhone retained-frame result and debug-export evidence guard

- Physical session `df6236d6-874b-41f5-becf-b89ab710b05b` reached primary
  `result ready` in 6.745 seconds; Tony observed about seven seconds and five
  yellow digits (C ones, both D digits, G ones, H ones). Correction advanced
  automatically. The export is preserved at
  `private-evidence/debug-scans/2026-08-14/iphone16-strong-shadow-df6236d6/manual-export.json`
  with SHA-256
  `c601eaf28fcf17b911cc2eaf743b9d9e60216915e41746b41db5c570a3025f8f`.
- The export still says `waiting-for-manual-review` because it was created only
  4.599 seconds after the final correction, before the 12 retained-frame reads
  could finish. This is not another runtime failure. The temporary Funnel and
  token server were closed immediately after receipt.
- Exact local reconstruction of the app's `stitched-original-grayscale` items
  produced C=`15` and D=`16` unanimously at >=0.9867 minimum token probability,
  and H=`17` unanimously at >=0.9980. G was unstable (`12`, `12`, `18`) and
  correctly fails the frozen three-frame rule. A yellow-only, exact 3/3,
  minimum-0.90 policy would therefore reduce this scan from five yellow digits
  to one without guessing G or touching an accepted primary answer.
- Across the four retained iPhone sessions on this same writer/sheet, that
  frozen rule would promote 9/12 originally yellow questions and remove 11/15
  yellow digits (73.3%) with zero observed transcription errors, leaving four
  digits for review. The reproducible private report is
  `private-evidence/reports/iphone16-strong-shadow-trials-20260814.json`.
  This is correlated retrospective evidence, not launch authority. The wider
  345-answer audit also has zero known errors at the 0.90 threshold but was
  retrospectively inspected and still requires untouched-packet validation.
- Debug Export now becomes disabled and reads `Finishing…` while this explicit
  private strong comparison is pending. That prevents another incomplete
  `waiting-for-manual-review` export; normal Debug Scan and public product paths
  are unchanged. Complete repository suite **495/495**, production build, and
  `git diff --check` pass. Next meaningful gate is a private pre-acceptance
  yellow-only candidate on untouched packets, followed by physical iPhone
  latency and correctness checks. Do not publish or enable the strong reader
  from same-sheet evidence alone.

## 2026-08-14 isolated iPhone shadow trial and retained-crop lifetime fix

- Physical session `90c3a1bd-e0ac-44b6-a283-557f7a850ffb` reached the frozen
  primary `result ready` stage in 7.024 seconds. Tony observed roughly ten
  seconds or a little more until visible marking and reported four yellow
  digits: C ones, both D digits, and G ones. Manual truth recorded C=`15`,
  D=`16`, and G=`18`. The 11 MB export is preserved at
  `private-evidence/debug-scans/2026-08-14/iphone16-isolated-strong-shadow-90c3a1bd/manual-export.json`
  with SHA-256
  `2df51a36efe193cb52aacb35296729fa51dc6ccc2996f91b819ac7305378be66`.
- The isolation change worked: the competing accepted-answer safety reader is
  absent. The strong shadow itself did not produce recognition evidence; it
  failed open with `cannot call emscripten binding method Mat.cols getter on
  deleted object`. This trial therefore measures only the frozen primary and
  must not be counted for or against strong-reader recognition quality.
- Root cause is exact and reproducible from the export plus source lifetime:
  waiting for manual review deferred selected-frame crop materialization until
  after normal OCR cleanup had deleted the OpenCV Mats. The fix passes the
  already-materialized selected-frame image URLs into retained-frame
  preparation, so no deferred work accesses the released Mats. Retained-frame
  registration and all large-model inference still wait until manual review is
  settled; grading, marks, review flags, score, and `ocrResult` remain untouched.
- Focused shadow coverage, the complete repository suite **494/494**, production
  build, and `git diff --check` pass. A further physical same-sheet iPhone test
  is still required. Pass requires a completed six-read strong-shadow result,
  normal correction auto-advance, and continuously visible annotations. Do not
  promote or integrate the strong reader from this fix alone.

## 2026-08-14 iPhone shadow trial diagnosis and isolated retest candidate

- Physical session `156f7aad-a250-4d70-84f1-6d46058fab9a` did **not** validate
  the three-frame strong reader. The ordinary frozen grader reached `result
  ready` in 6.833 seconds and produced two yellow slots (C ones and D ones),
  but all worksheet marks disappeared during manual correction and the export
  contained no `v3BrowserLocalStrongShadow` result. The exact 12.7 MB export is
  preserved at
  `private-evidence/debug-scans/2026-08-14/iphone16-strong-shadow-156f7aad/manual-export.json`
  with SHA-256
  `a90928a22dad95e053bd226ae04a92822697e5ba5564afe950f3b29f18a793a8`.
- The export identifies a concrete confounder: because the temporary host ended
  in `.ts.net`, the separate private accepted-answer safety reader defaulted on
  beside the requested strong shadow. It spent 20.532 seconds in the background,
  including 16.734 seconds initializing, while C was corrected 10.971 seconds
  after result generation and D 19.323 seconds after generation. The two large
  readers therefore overlapped the exact annotation-failure window. This trial
  is rejected as an accidental dual-reader load test, not evidence that the
  locked primary grader lost its prior reliability.
- The private strong-shadow runtime is now isolated. Requesting it suppresses
  the other private safety reader; it waits until every original yellow answer
  is manually settled and the correction UI is closed; it then uses one bounded
  persistent worker for the retained-frame reads and immediately terminates the
  worker. If review does not settle within three minutes it records a fail-open
  skip and performs no heavy inference. It remains grade-inert and cannot alter
  predictions, marks, review flags, score, or `ocrResult`. Public
  `scangrade.io` remains unchanged.
- Exact replay of the three retained frames establishes a useful model-quality
  result. The frozen primary read C/D as `16`/`16`, `16`/`16`, and `16`/`11`;
  the larger whole-answer reader read visible transcription truth C=`15` and
  D=`16` on all three frames. Its minimum token probabilities were at least
  0.99963 for C and 0.94637 for D. This supports further prospective testing of
  the stronger reader but does not authorize a grading-policy change.
- Browser runtime checks on these exact six crops: persistent Chromium 6/6 in
  4.446 seconds; persistent WebKit 6/6 in 4.275 seconds; disposable Chromium
  6/6 in 6.933 seconds; disposable WebKit 6/6 in 6.492 seconds. A WebKit
  resident-session endurance run completed 36/36 correct in 23.388 seconds
  without a stall. Focused correction/legacy coverage passes 40/40, the full
  repository suite passes **494/494**, production build passes, and
  `git diff --check` is clean. A synthetic end-to-end file-upload harness was
  rejected because it stalled before OCR and therefore supplies no physical UI
  evidence.
- Next gate: expose only the isolated private build and frozen two model files,
  rescan the same already-opened sheet on iPhone, complete normal yellow
  corrections first, then wait for the shadow to finish before exporting. Pass
  requires continuous annotation visibility/normal auto-advance and a completed
  six-read `v3BrowserLocalStrongShadow` result. Do not integrate or promote the
  larger reader until that physical evidence is received.

## 2026-08-14 iPhone frozen-reader three-frame shadow candidate

- Added a private, explicit `v3BrowserLocalStrongShadow` diagnostic that can
  read up to three retained `hybridV2` frames for only the questions already
  shown yellow by the frozen live grader. The larger reader remains wholly
  grade-inert: it does not mutate predictions, review flags, annotations,
  scores, or `ocrResult`, records `affectsGrade: false` and `noUploads: true`,
  and writes its completed result into the Debug Scan evidence. It no longer
  requires `hybridV3`, avoiding activation of unrelated private candidate or
  promotion lanes.
- On an explicit `.ts.net` request only, the shadow resolves the frozen model
  from the existing same-origin `/local-model-probe` routes. Public
  `scangrade.io` never receives a default model URL and cannot enable this
  path from the short flag alone. The physical-test query is
  `/debug?hybridV2=1&v3BrowserLocalStrongShadow=1&v3BrowserLocalStrongFrames=3&v3BrowserLocalStrongLimit=20&v3BrowserLocalStrongTimeoutMs=90000`.
- Local focused tests cover the private same-origin gate, public fail-closed
  behavior, three-frame clamp, worker fail-open behavior, yellow-only routing,
  and the absence of any grade/presentation mutation. The production build
  passes. The local probe server now has an explicit
  `SG_TROCR_MODELS_ONLY=1` mode that disables `/sample.png`, `/samples/*`, and
  `/manifest/*`; use that mode for this test so no fixed worksheet imagery is
  exposed to the tailnet. The private model route has **not** been started for the physical
  phone trial because exposing the proprietary model assets to the tailnet
  requires Tony's explicit approval. This code is not published to
  `scangrade.io` and makes no recognition-policy change.
- Screened the existing resident lightweight/right-slot model assets on the
  three saved iPhone captures from the same two-digit-addition sheet. The
  visible transcription truth is `11, 12, 15, 16, 14, 16, 18, 17`; D is a
  deliberately incorrect mathematical response, so answer-key accuracy is not
  OCR truth. No existing lightweight replacement is safe. The generalist
  right-slot candidate is repeatable but still reads C/D as `16`/`18`. The
  SG3 and wide-CNN candidates sometimes repair C/D but introduce new wrong
  reads such as `19` for `18`, `13`/`16` for `18`, and `11`/`15` for `14`,
  including reduced-yellow outcomes. Keep the public primary/right-slot models
  frozen; do not trade yellow coverage for these new transcription errors.
- Next gate: with explicit approval, start the tailnet-only frozen model route,
  open the query above on the iPhone, rescan this already-opened sheet once,
  wait for the shadow completion, finish any normal yellow corrections, and
  export Debug Scan. Compare frozen predictions with manual/visual truth only
  after capture. Untouched qualification packets remain sealed.
- Tony explicitly approved both the private tailnet model delivery and GitHub
  backup. Commit `5227fb8` is pushed to
  `origin/autobuild/safe-20260223`. The Mac's active tailnet suffix is now
  `tail415e0b.ts.net` (the older `tail9a3379` suffix is stale). The private app
  and models-only route are running at
  `https://hobbes-mac-mini.tail415e0b.ts.net/` and
  `/local-model-probe`; live verification returned HTTP 200 for the app,
  encoder, and decoder, while `/sample.png`, `/samples/0.png`, and
  `/manifest/0.png` each returned HTTP 404. Physical iPhone shadow evidence is
  still required before considering any recognition-policy change.

## 2026-08-14 iPhone 16 retained-frame / whole-answer-reader diagnostic

- After Beta 15.103 passed its correction-transition checks on both the black
  iPad and iPhone 16, repeated ordinary/debug scans of the same
  `sg-g1-lw-02-add-2digit` sheet varied from two to five yellow digit slots.
  Grading began in about one to two seconds, correction auto-advance remained
  reliable, and corrected digits did not flash off. The modern-device concern
  is therefore recognition coverage, not correction UX or inference latency.
- Tony ran the explicit no-policy-change diagnostic at
  `/debug?hybridV2=1`. Scan session
  `94465de6-2ca2-4272-9498-a813dceed5ef` retained the best three of the existing
  eight capture frames and produced four yellow digit slots: B ones, C ones,
  and both D digits. The manual export is preserved at
  `private-evidence/debug-scans/2026-08-14/iphone16-hybrid-v2-94465de6/manual-export.json`
  (SHA-256
  `3bbfc86c96ac72d50d09e1c79e5207547f2a43b749337061e41ff97a94c50b46`).
  This is the pixel-bearing authority; receiver auto-saves preserve the
  correction sequence but prune retained-frame image data.
- Exact current-pipeline replay of the three frames falsified a lightweight
  multi-frame vote. B read `12`, `17`, `17`; C read `16`, `16`, `16` instead of
  the visible/manual `15`; and D read `18`, `13`, `16` while the student wrote
  `16`. The selected frame was the best overall lightweight-model frame.
- The resident 7.7 MiB whole-slot scout read B `12` and D `16` on all three
  frames, but read C as `16`, `16`, `14`. Its minimum B/D probabilities were
  only about 0.676/0.760. Historical exact-live evidence proves that scout-only
  agreement can share confident errors, so it is not deployment authority.
- The frozen 61.1 MiB browser-local whole-answer model then read all three
  corrected questions correctly on every retained frame: B `12` with minimum
  token probability `0.997737`, C `15` with `0.999696`, and D `16` with
  `0.888513`. Desktop Chromium persistent-session replay took about 0.66-0.68 s
  per answer after initialization; the first run spent about 1.97 s initializing
  and 3.98 s total for the three yellow questions, while subsequent fresh
  browser runs initialized in about 0.38-0.39 s and finished in about 2.41 s.
  These are desktop diagnostic timings, not physical iPhone timings.
- The existing all-packet three-frame rule requires exact 3/3 strong-reader
  agreement at a 0.90 minimum. B and C satisfy that evidence shape; D misses
  the floor on one frame. The stricter Candidate 7 also requires browser,
  scout, stitched, and three-frame agreement and remains explicitly
  non-deployable because its independent prospective frame gate is incomplete.
  Do not lower thresholds or enable a grade-affecting reader from this one
  favorable sheet.
- `scripts/replay_live_ocr_captured.mjs` now has replay-only support for
  `--burst-frame`, `SG_WHOLE_SLOT_SCOUT=1`, and
  `SG_BROWSER_LOCAL_STRONG=1`. These options do not alter the application or
  production behavior. Next use the remaining device/packet qualification as
  a prediction-first shadow trial of the frozen strong reader; compare with
  manual truth only after each scan is complete. No recognition deployment has
  been authorized or made from this evidence.

## 2026-08-14 Beta 15.103 black-iPad correction transition — physical retest candidate

- Session 0 on the approximately four-to-five-year-old black iPad found two
  real review-transition defects after an otherwise fast ordinary scan: about
  13 seconds to marking, with C ones, both D digits, and H ones yellow. After D
  was corrected the UI did not advance to H, and corrected black digits briefly
  disappeared before reappearing with their check/X.
- The exact reproduction is preserved at
  `private-evidence/debug-scans/2026-08-14/2026-08-14_14-22-47-249-sg-g1-lw-02-add-2digit-87d46f8e/debug.json`.
  It records Safari 15.4 at 810-by-1010 CSS pixels, scan session
  `2ad160d1-946d-4d86-a272-8bca44c50eed`, and the C/D/H correction sequence.
  C completed at 14:17:20.408Z, D at 14:17:24.901Z, and manually opened H at
  14:17:59.169Z, preserving the reported 34-second stalled interval. The
  attached manual export SHA-256 is
  `b6743060dd78df73b80bc8cd5c6ffa3c3b51de458b38f03e44c9999aea692434`.
- Root cause of the missed advance: after the corrected D mark finished, the
  queue correctly found H, but the still-set correction-transition flag blocked
  opening it. That branch also stopped its timer, leaving the queue stranded.
  Beta 15.103 first flattens the completed correction, clears the transition,
  recomputes the pending yellow, and then opens it.
- Root cause of the digit flash: modern Safari's review state and editor were
  dismissed before the predecoded correction-animation base had painted.
  Beta 15.103 keeps the live black correction mounted until that stable image
  is visibly installed, then dismisses the editor and draws the replacement
  mark. The iOS 12 static compatibility transition remains unchanged.
- Recognition, model assets, confidence, capture, homography, grading, answer
  interpretation, and yellow policy are frozen. Focused transition/review tests
  pass **47/47**, the complete repository suite passes **490/490**, and the
  deployment-pruned 254-file production build passes. Deployment and the
  focused black-iPad confirmation are recorded below; do not resume untouched-
  packet testing until the remaining Session 0 device gate passes.
- Published from an isolated static directory at
  `https://883a1071.scangrade.pages.dev/` and promoted to
  `https://scangrade.io/`. Production root, `/debug`, and `/api/submissions`
  serve the byte-identical app shell (SHA-256
  `dfa332d5752eb8f2565dc88e9dec1e165e36c0cf4579725a753a279d37b08c70`),
  and public `assets/index-Dg0Wb0Mm.js` is byte-identical to the frozen local
  build (SHA-256
  `bc2a86f3da37b0b3420d145a50f3439905ef252bd70cbf2822da79a688a67a39`).
  No Pages Function or recognition backend is attached.
- Tony physically retested Beta 15.103 on the same black iPad and reported that
  both reproduced defects were fixed: corrected digits no longer flashed off,
  and the yellow correction queue advanced normally. This closes the focused
  black-iPad repair gate. Session 0 must still pass on the iPhone 16 before an
  untouched qualification packet is selected.
- Candidate label:
  `2026.08.14-black-ipad-correction-transition-beta-15-103`.

## 2026-08-10 Beta 15.102 public/debug separation — release-candidate preparation

- Beta 15.101 is the first physically verified orange-iPad candidate to finish
  browser-local automatic grading with all six answers automatic and zero
  yellow fallback. Tony timed the physical run at about 20 seconds. The saved
  trace reached `result-ready` at **19.005 seconds**. Its preserved Debug Scan is
  `private-evidence/debug-scans/2026-08-10/2026-08-10-orange-ipad-beta15-101-under-20-success/debug.json`
  (239,772 bytes; SHA-256
  `1e373b0f43077856bd350a61edf53d5d7a4ffdbfb9636a2dc7b0180eacef31cc`).
- The trace's main costs were marker aggregation 10.206 s, tensor preparation
  7.386 s, model inference 4.326 s, and final/optional work 1.503 s. This is the
  accepted legacy-device reference, not a universal speed promise. Do not
  optimize it further before the broader locked-device qualification establishes
  whether a real product problem remains.
- Before Beta 15.102 edits, the complete workspace was copied to
  `/Volumes/Tony's Rugged HD/Codex/ScanGrade Offloads/2026-08-10-beta15-101-release-candidate-checkpoint/repository/`:
  179,405 files and 29,674,860,433 bytes. An exact checksum rsync dry run was
  empty after excluding only `.git/fsmonitor--daemon.ipc`, a transient live
  socket. A separately verified all-branches Git bundle is
  `scan-grade-beta15-101.bundle` in the same checkpoint directory (SHA-256
  `a0e51d74972fc6135be08701792e7731b42358553afb3b8ec3e91df0216e11a5`).
- Beta 15.102 changes presentation only. The ordinary landing at `/` contains
  Start Scan and Get Worksheets; diagnostic capture now lives at `/debug`, with
  a Regular ScanGrade return link. The diagnostic result-bar Export control is
  moved from grid column 3 to column 2 and left-aligned so it cannot overlap the
  absolutely centred recognition arrow. No OCR, capture, homography,
  confidence, grading, annotation, or legacy-iPad inference logic changed.
- Reproducible checks before publication: dedicated route/layout tests 6/6,
  complete repository suite **489/489**, production build passes, and
  `git diff --check` is clean. Old-iPad-sized local browser checks confirmed the
  two distinct landing pages and the `/debug` return link. The Export placement
  still requires physical confirmation after a completed Debug Scan.
- Published from an isolated 254-file static directory at
  `https://3a5dde87.scangrade.pages.dev/` and promoted to
  `https://scangrade.io/`. Production root, `/debug`, and `/api/submissions`
  return the byte-identical app shell (SHA-256
  `20b89255a963aaeca097027f848801cc4d7a5bee7b8a9aac624bd9e5aca2adcb`),
  and the public main asset `assets/index-2bm7JMnd.js` is byte-identical to the
  frozen local build (SHA-256
  `e50860f20af051d31e53542e58ce1f169dcf3f7bd2d44a433b80dc463b862b31`).
  Production browser verification at a 768-by-954 legacy-iPad-sized viewport
  confirmed the exact Beta 15.102 label and distinct public/debug controls.
- The locked device/packet qualification protocol is
  `docs/SCANGRADE_RELEASE_CANDIDATE_DEVICE_TEST_PROTOCOL_20260810.md`. Session 0
  uses already opened sheets on the orange iPad, black iPad, and iPhone 16.
  Only after it passes should one randomly selected untouched packet be used
  for the 30-run three-device crossover. Current records expect P01, P04, P06,
  and P07 to remain untouched, but Tony must confirm the physical labels.
- Candidate label: `2026.08.10-dedicated-debug-route-beta-15-102`.

## 2026-08-04 Beta 15.85 legacy-iPad review-state repair — public physical-test candidate

- The orange-iPad Beta 15.84 retest reproduced two real interface/state defects:
  completed checks could disappear for one frame during the next teacher
  correction, and the final two-digit `19` could reopen as yellow after both
  physical slots had been teacher-confirmed.
- Root cause: the app maintained separate question-level and answer-group
  review states. Beta 15.84 cleared only the question flag, so the stale
  answer-group state could recreate the final yellow question. Beta 15.85
  reconciles both structures from the same teacher-confirmed physical-slot
  evidence after every correction.
- Old WebKit could also swap to a newly generated correction frame before that
  image had decoded and painted. The stable correction-animation base is now
  preloaded and given two animation frames before the result changes, keeping
  all previously completed marks continuously visible.
- Exact regression: six-answer sequence `5, 8, 12, 13, 16, 19`. Every completed
  question remains settled, the queue advances in order, and the final `19`
  closes the queue. A partial two-slot correction correctly remains in review.
- Verification: targeted review/animation suite **28/28**; complete repository
  suite **425/425**; production build passes. Exact pruned static bytes are
  deployed at `https://06688541.scangrade.pages.dev/` and promoted to
  `https://scangrade.io/`. Public smoke verified hashed asset
  `assets/index-DJdtT4Tf.js` and the exact Beta 15.85 label. Physical
  orange-iPad verification remains required before this candidate is accepted.
- Important limitation: blanket yellow on this approximately nine-year-old
  iPad is the deliberate safe fallback because iOS 12.5.7 cannot initialize
  ScanGrade's browser-local ONNX/WASM digit engine. It is not six independent
  confidence decisions and must not be hidden by weaker thresholds. The
  current pure-JavaScript fallback model is not accurate enough to auto-grade.
  Modern phones and the four-to-five-year-old black iPad retain browser-local
  automatic recognition; the orange iPad remains capture-plus-teacher-review.
- Candidate label:
  `2026.08.04-legacy-ipad-review-state-repair-beta-15-85`.

## 2026-08-02 Beta 15.81 corrected camera-guidance color roles — verification candidate

- Removed the redundant disabled **Opening camera…** button shown below the
  viewfinder while automatic camera startup or native permission approval is
  already in progress. The necessary manual **Open camera** fallback remains
  for older iPads and browsers that require an explicit tap, using the same
  interface blue as the navigation arrows.
- Restored warming/searching guidance inside the live viewfinder to its dark
  neutral background. The ready/hold-steady state retains its existing green.
  Revealed OCR reading labels remain on the shared interface blue.
- UI-only change: no capture gate, frame selection, OCR, confidence, grading,
  or annotation behavior changed.
- Verification: focused capture/interface suite passes **37/37**; complete
  repository suite passes **412/412**; deployment-pruned build passes.
  Published static-only at `https://be1383b8.scangrade.pages.dev/` and
  `https://scangrade.io/`; production, immutable, and `/api/submissions` serve
  the same app shell, and the public hashed asset contains the exact label.
- Candidate label: `2026.08.02-camera-guidance-colors-beta-15-81`.

## 2026-08-02 Beta 15.80 refined correction ink and unified blue — verification candidate

- Teacher-entered correction digits now use weight 500 instead of 600 and are
  positioned five percent of the digit-box height higher, with slightly less
  vertical jitter. The same shared canvas renderer still supplies live entry,
  transition, and final flattened output, so the digit cannot shift between
  stages.
- Added one inherited interface-blue token (`#245aa4`). The bottom navigation
  arrows, **Starting camera…** background, and revealed OCR readings now use
  that exact blue. No OCR, capture threshold, grading, or correction behavior
  changed.
- Verification: focused correction/layout suite passes **31/31**; complete
  repository suite passes **412/412**; deployment-pruned production build
  passes. Published static-only at `https://7fe604e2.scangrade.pages.dev/` and
  `https://scangrade.io/`; production, immutable, and `/api/submissions` serve
  the same static app shell and the public hashed asset contains the exact
  Beta 15.80 label.
- Candidate label: `2026.08.02-refined-correction-ink-beta-15-80`.

## 2026-08-02 Beta 15.79 persistent back navigation — public physical-test candidate

- The bottom-bar back arrow now remains mounted throughout live scanning,
  grading animation, yellow review, and completed-result states. The centered
  Scanning/Grading treatment is absolutely centered behind it, so persistent
  navigation does not displace the status word.
- Reduced only the center up/down chevrons from a 1.9 to 1.7 SVG source stroke
  after physical feedback that they still appeared heavier than the left
  arrow. Geometry, center point, color, and hit targets are unchanged.
- OCR, capture, grading, correction, confidence, and annotation behavior are
  frozen. Verification: focused 30/30, full suite 411/411, and pruned build
  pass. Published static-only at `https://bea51095.scangrade.pages.dev/` and
  `https://scangrade.io/`; production, immutable, and `/api/submissions` are
  byte-identical static app shells. Candidate label:
  `2026.08.02-persistent-back-navigation-beta-15-79`.

## 2026-08-02 Beta 15.78 balanced navigation ink — public physical-test candidate

- Reduced only the center up/down chevrons' SVG source stroke from 2.15 to
  1.9. Because their 24-unit viewBox renders at 30 px while the back arrow
  renders at 27 px, this produces a closely matched apparent line weight
  without changing geometry, centering, hit targets, or behavior.
- OCR, capture, grading, correction, animation, and review policy are frozen.
- Verification: focused navigation/correction/marking tests pass **30/30**;
  complete repository suite passes **411/411**; deployment-pruned production
  build passes. Published static-only at
  `https://950c49ed.scangrade.pages.dev/` and `https://scangrade.io/`.
  Production, immutable, and `/api/submissions` serve the same static app shell.
- Candidate label: `2026.08.02-balanced-navigation-ink-beta-15-78`.

## 2026-08-02 Beta 15.77 slot-faithful editing and complete old-mark cleanup — public physical-test candidate

- Physical Beta 15.76 testing found two correction-transition defects. When
  readings were revealed and Tony tapped the right physical digit of a
  non-yellow two-slot answer, the blue focus box appeared on the right digit
  but whole-answer routing could still save the keypress into the adjacent
  slot. Separately, a small edge fragment of an old red X could remain visible
  while its replacement green check began drawing.
- Direct physical-slot selection is now authoritative: whole-answer heuristics
  can be used only when the selected region is itself a whole-answer region.
  Yellow auto-cycling, answer interpretation, OCR, confidence, grading, crop,
  capture, and homography policy are unchanged.
- Replacement cleanup now derives the complete deterministic teacher-mark
  footprint from the same seed, answer rectangle, and indicator geometry used
  by the live pen animation. It clears the full previous check/X footprint
  before copying the settled corrected answer and drawing the replacement.
- Regression coverage proves that an explicitly tapped right slot remains
  slot 1 even when whole-answer mode is otherwise eligible, and that the old
  mark cleanup bound encloses every point of the generated X path.
- Verification: focused correction/marking tests pass **32/32**; the complete
  repository suite passes **411/411**; the deployment-pruned production build
  passes. The final static-only deployment is
  `https://887b30de.scangrade.pages.dev/` and serves `https://scangrade.io/`.
  Production root, immutable root, and `/api/submissions` are byte-identical
  app shells (SHA-256
  `933e15f77a621d28b91800448ce05f1c6630c8b1a8c5a17dd311d38bb4ab48e9`),
  confirming that no Pages Function or backend route is active. An immediately
  superseded upload at `a1512e18` accidentally attached the repository's
  dormant Pages Function because Wrangler was launched from the repo; do not
  use that immutable URL.
- Candidate label:
  `2026.08.02-slot-faithful-mark-replacement-beta-15-77`.

## 2026-08-02 Beta 15.76 minimal review navigation — production for legacy-iPad test

- Tony requested a minimal result bar before testing the approximately
  nine-year-old orange iPad: a matching left-arrow home control; a precisely
  centered reading toggle; mirrored up/down chevrons whose combined geometry
  forms a diamond; and the ability to edit any mapped answer after revealing
  ScanGrade's readings. Automatic correction sequencing remains limited to
  genuinely yellow answers.
- The result bar now uses one SVG stroke system and absolute 50%/50% placement
  for the reading toggle. Normal and private-debug action columns are explicit,
  so the centered toggle cannot drift when Export is present.
- Editing scope is isolated from review policy. With readings hidden, only
  yellow or previously teacher-corrected regions are interactive. With readings
  visible, every mapped answer region is interactive. The yellow-only
  auto-advance queue and recognition decisions are unchanged.
- This release includes the unmodified Beta 15.75 legacy-camera compatibility
  ladder and its post-failure **Take worksheet photo** fallback. OCR,
  homography, capture thresholds, and grading policy were not changed in this
  design pass.
- Verification: focused interaction tests pass 28/28; complete repository
  suite passes **409/409**; the deployment-pruned build passes. In-app browser
  smoke confirms the public landing page and exact label
  `2026.08.02-minimal-review-nav-beta-15-76`.
- Public static-only production deployment is
  `https://f0c272b6.scangrade.pages.dev/` and now serves
  `https://scangrade.io/`. The first upload was made from the repository
  working directory and detected dormant Pages Functions; it was immediately
  superseded by the isolated static-directory deployment above. Production
  root and `/api/submissions` are byte-identical static app shells.
- Physical gate: use `https://scangrade.io/` on the orange iPad. Allow up to 12
  seconds for the first live frame. If live video cannot start, confirm that
  **Take worksheet photo** appears and that taking a worksheet photo reaches a
  graded result. Also verify the centered arrows, back arrow, and all-reading
  edit mode on a completed sheet.

## 2026-08-02 Beta 15.75 legacy-camera recovery — isolated physical-test candidate

- Tony asked to restore the approximately nine-year-old orange iPad, which
  displayed “Camera could not open. Use a photo instead.” on Beta 15.67 even
  though an earlier old-iPad generation had successfully opened and captured
  worksheets after a slow first camera warmup. Historical records establish
  that old-iPad capture previously worked, while the later failure screenshot
  did not preserve the exact WebKit exception or prove which constraint failed.
- A concrete UI regression was found: student-mode state correctly recognized
  a failed camera and computed a photo fallback, but the template explicitly
  hid that fallback from students. Normal scanning had no fallback button and
  a genuine startup failure became a dead end.
- Beta 15.75 adds a narrow, ordered startup compatibility ladder: preferred
  high-resolution rear camera; relaxed rear camera; unconstrained default
  camera; then the prefixed callback API used by very old Safari. It also gives
  a slow first camera frame up to 12 seconds to become drawable. Modern devices
  retain the existing preferred first request. OCR, homography, capture-quality
  thresholds, QR validation, and recognition policy are unchanged.
- If every live-camera route genuinely fails, student mode now shows **Take
  worksheet photo** only after that failure. The file input requests the rear
  camera where iOS supports it and feeds the resulting full-resolution image
  through the existing capture/OCR path. It is not shown during normal live
  scanning.
- Reproducible verification: five new startup tests cover preferred, relaxed,
  unconstrained, prefixed, and total-failure behavior; the complete repository
  suite passes **406/406**; the deploy-pruned production build passes. Static
  preview bundle contains exact label
  `2026.08.02-legacy-camera-recovery-beta-15-75`.
- Physical-test preview only: `https://25e05bbf.scangrade.pages.dev/` (alias
  `https://legacy-camera-recovery-beta1.scangrade.pages.dev/`). The first
  upload accidentally discovered dormant repository Functions and was
  immediately superseded from an isolated static directory. A subsequent
  old-Safari syntax audit replaced `Array.prototype.at` before physical test;
  the final preview has no Functions upload. The preceding static candidate
  was `dbac937f`; do not test it.
  Production remains Beta 15.74 pending the orange-iPad test.
- Physical gate: on the orange iPad, open the immutable preview directly and
  press Start Scan. Record whether live video opens (allow up to 12 seconds on
  the first attempt). If not, verify that **Take worksheet photo** appears and
  that taking one photo proceeds to grading. Do not promote until one of those
  two paths completes a real worksheet and the current phone still opens the
  normal live camera without displaying the fallback.

## 2026-08-01 Beta 15.73 trigger-frame latch — isolated physical-test candidate

- Production remains **Beta 15.72** at `scangrade.io`. Tony's current-iPhone
  number-bond test is a physical failure for its simplified capture guidance:
  the page was visibly present, but the UI cycled among “Find full page”,
  “Hold steady”, and “Capturing” for roughly 30 seconds. The accepted result
  also showed displaced number-bond highlights. Do not treat Beta 15.72 as a
  capture-usability improvement.
- Root cause of the capture-state bounce: the automatic gate could announce
  capture and then wait for another drawable video frame before preserving a
  full-resolution candidate. Movement prompted by “Capturing” could therefore
  invalidate the burst and return the UI to framing even though a usable frame
  had opened the attempt.
- Beta 15.73 copies the exact full-resolution trigger frame before changing
  capture state and includes it as burst candidate zero. Later frames may win
  on quality, but movement after the cue cannot erase the valid trigger. Until
  a frame passes the final gate, the stable instruction remains “Hold steady”.
- The over-broad “Find full page” mapping is removed. Guidance again states the
  needed action: “Show all 4 squares”, “Move closer”, “Center full page”,
  “Hold phone level”, or “Show QR code”. A one-frame marker miss still cannot
  flicker the instruction.
- No acceptance standard was weakened: final full-resolution focus >= 560,
  four-marker geometry, QR, page appearance, perspective, motion, and burst
  selection remain unchanged. Focused tests pass 20/20; complete suite passes
  **394/394**; the pruned production build passes.
- Isolated preview: `https://c24bcb2b.scangrade.pages.dev/` (alias
  `https://trigger-frame-latched-beta15.scangrade.pages.dev/`). Downloaded
  JavaScript is byte-identical to local build asset `index-Bh2-beWI.js` at
  SHA-256 `da16250ffb7ddcf9049d20547a4f02b838d4a3d8a95244c98cad44e6cf091134`.
- The exact failed number-bond scan was not a Debug Scan and is absent from the
  private evidence store. Its screenshots prove displacement but cannot
  distinguish burst-frame registration, homography, or answer-box fallback.
  Do not change annotation geometry speculatively. First physically test the
  isolated candidate, then export one Debug Scan if any mark remains displaced.

## 2026-08-01 atomic completion Beta 15.71 — production

- Tony directly tested connected-edge/transition Beta 15.70 on the current
  iPhone and the approximately four-to-five-year-old black iPad. On both
  devices, the previously damaged handwritten `7` was automatically
  transcribed as `7`. The student's written `9` remained correctly
  transcribed and mathematically marked wrong. H remained yellow and was
  resolved manually as `6`. These are meaningful physical passes for the
  connected-edge repair; they are not yet a broad acceptance test.
- The black iPad's first camera startup was initially laggy and displayed a
  readiness warning alongside positioning guidance, but became smooth and
  its second scan was smooth. The device was at 5% battery and no timing or
  memory trace was captured. Do not loosen capture quality/cadence from this
  observation. Re-test at ordinary charge before classifying it as a product
  defect; the first-run-only pattern is consistent with camera/model warmup.
- A remaining rendering defect appeared after resolving the final yellow:
  completed marks briefly vanished before the final flattened worksheet
  replaced the live drawing layers. Beta 15.71 decodes the final annotated
  image before the handoff, retains it as the displayed source, and retires
  the live layers only after that atomic replacement. Existing marks must now
  remain continuously visible.
- The completion glow now fades in and remains present until grading actually
  completes. The same `progressiveMarkingActive -> complete` state change
  removes the glow and exposes Home/recognition/New Scan controls, eliminating
  the previous stagger between those two events.
- Verification: complete suite **385/385** and pruned production build pass.
  Build label is `2026.08.01-atomic-completion-beta-15-71`. Isolated preview:
  `https://331216c8.scangrade.pages.dev/` (alias
  `https://atomic-completion-beta.scangrade.pages.dev/`). Tony authorized
  immediate production promotion. Direct-upload production deployment
  `95c01759.scangrade.pages.dev` now serves `scangrade.io`; a custom-domain
  HTML-and-JavaScript smoke test confirms the exact Beta 15.71 label. Re-test
  the final-yellow correction on the phone and black iPad. The gate is
  continuous visibility of all settled marks, one uninterrupted new check/X,
  and glow/control replacement in the same visual beat.

## 2026-08-01 physical-device records and correction-transition Beta 15.70 — preview only

- Tony tested the same subtraction page on a current iPhone, an approximately
  four-to-five-year-old black iPad, and an approximately nine-year-old orange
  iPad. Every screenshot visibly identifies public build **Beta 15.67**, so
  none is a physical test of the connected-edge Beta 15.69 recognition repair.
  Scanning a worksheet QR opens `scangrade.io` and therefore the public build;
  the isolated candidate must be opened directly before pressing Start Scan.
- The current iPhone produced a stable, high-quality automatic capture in one
  attempt (capture elapsed 4499 ms, selected burst frame 7, focus 847, luma
  155.7). Its initial OCR read C as uncertain `1`, E as uncertain `5`, and H as
  uncertain `5`; all went to teacher review. G was correctly transcribed as
  the student's handwritten `9` and therefore correctly graded mathematically
  wrong. This evidence does not show a confident transcription error.
- Private debug auto-save succeeded and preserved six incremental bundles for
  one scan session under `private-evidence/debug-scans/2026-08-01/`, from
  `2026-08-01_19-09-02-*` through final
  `2026-08-01_19-09-34-164-sg-g1-lw-03-sub-1digit-70b239e8/`. They reconstruct
  the review history: C corrected to `7`, E to `5`, H mistakenly corrected to
  `9`, then H corrected again to `6`. The final score changed from 6/8 to 7/8.
- The debug history reproduces the reported visual defect: during a repeated
  correction, the previous question mark and score remained in the temporary
  animation base while the replacement check/X and score began drawing. This
  briefly showed an old X beside a new check and an old score beneath a new
  score. The final grading state was correct; the transition was not.
- Beta 15.70 clears only the changed question's full annotation region and the
  shared score safety region from the clean registered worksheet before it
  copies the settled black correction and starts the replacement pen strokes.
  Other completed marks remain visible. Contract tests cover both old-mark and
  old-score removal.
- The black iPad completed grading but its live camera view was noticeably
  laggy. Battery state may have contributed, but no performance telemetry was
  captured, so the cause is not yet established. Repeat on normal charge with
  the candidate before changing capture cadence or quality gates.
- The orange iPad could not open the live camera. Its screenshot reaches the
  safe fallback state (`Camera could not open. Use a photo instead.`), but
  without its exact model/iPadOS/browser error there is no evidence for a safe
  camera-code repair. Treat live capture on this device as unsupported until a
  separate compatibility investigation proves otherwise.
- Verification: complete suite **384/384** and pruned production build pass.
  Build label is `2026.08.01-connected-edge-transition-beta-15-70`. Isolated
  preview is `https://0a3c757d.scangrade.pages.dev/` (alias
  `https://connected-edge-transition-be.scangrade.pages.dev/`); deployed asset
  smoke confirms the Beta 15.70 label. **ScanGrade.io remains Beta 15.67.**
  Next gate: open the preview URL directly, press Start Scan, and replay the
  page on the current iPhone and charged black iPad. C must read `7` without a
  transition overlap; ordinary `1`s, one- and two-slot pages, capture
  completion, and annotation placement must not regress.

## 2026-08-01 connected-edge handwriting preservation Beta 15.69 — local candidate

- Root cause is now reproduced upstream of recognition. On the prospective
  `SG-G1-LW-03` question C, the saved raw crop contains the student's full `7`,
  including its horizontal top. The ordinary box-border cleanup erases that
  connected top stroke, leaving a `1`-shaped 28x28 input. This is a fidelity
  defect, not merely an underpowered classifier.
- The candidate identifies a connected component that touches a horizontal box
  edge but also descends diagonally into the answer area. Only those connected
  handwriting pixels are protected while the long printed border is still
  removed. The extra view is generated only when it differs from strict
  cleanup and is limited to ordinary, undivided digit boxes. Applying it to
  divided/virtual slots was tested and rejected because centre guides could
  become false extra `1`s.
- Selection is narrow and key-blind: when strict cleanup reads `1`, the
  preserved view reads `7` at at least `0.97`, and its top-two gap is at least
  `0.90`, the preserved `7` may replace the damaged strict read. Mathematical
  correctness and answer keys are not inference inputs.
- Exact production-scope standalone replay covered **50 saved pages / 600
  digit crops**. Forty-four ordinary-box crops contained protected pixels;
  only three predictions changed,
  and all three moved to independently labelled handwriting truth: P05
  addition Q1 `9->5`, P05 addition Q2 `0->6`, and P03 subtraction Q3 `1->7`.
  The report is
  `/tmp/scangrade-connected-edge-eval-final-mirrored/report.json`.
- Identical-evidence before/after replay across the **345 labelled answers**
  changed four decisions, all beneficial: one correct yellow `8` became
  automatic, the two P05 reads above were repaired, and P03 `1->7` was
  repaired. The isolated browser lane moved from 294 to 296 automatic and from
  63 to 61 errors. Those absolute error counts are **not public-product
  metrics** because the stronger browser-local co-reader was deliberately
  disabled to isolate preprocessing; only the paired delta is meaningful.
  No student packet or layout family regressed.
- On the newly received prospective page, current-code WebKit moved from 5/8
  initial raw reads to 7/8. Question C now reads `7`; the connected-edge view
  gives `7` at `0.997766` and triggers
  `connected-edge-seven-preservation-rescue`. The separate question E `6` for
  handwritten `5` remains unresolved and must not be represented as repaired.
- Verification: complete suite **383/383** and pruned production build pass.
  Build label is `2026.08.01-connected-edge-preservation-beta-15-69`.
  Isolated preview is `https://8896a0e6.scangrade.pages.dev/` (alias
  `https://connected-edge-beta15-69.scangrade.pages.dev/`). Smoke verification
  found the correct JS/build label and a static HTML fallback at
  `/api/submissions`; no submissions backend is active. **Production
  ScanGrade.io remains Beta 15.67.** Next gate is physical current-iPhone and
  five-year-old-iPad checks of this page and ordinary one-/two-slot pages. Do
  not commit, push, or promote until that device gate passes.

## 2026-08-01 prospective 7→1 threshold repair Beta 15.68 — preview only

- The physically received Beta 15.67 bundle is preserved privately at
  `private-evidence/debug-scans/2026-08-01/2026-08-01_16-54-09-635-sg-g1-lw-03-sub-1digit-5901ddb8/`.
  Independent visual inspection confirms question C is a handwritten `7`.
  The camera/raw crop preserves its horizontal top stroke, but the existing
  28×28 print-removal input deletes that stroke and the browser classifier
  reads `1` at `0.885628`. The independent, browser-local whole-slot scout
  reads `7` at `0.9866875` in 139 ms. Neither mathematical correctness nor the
  answer key was used as handwriting truth or recognition input.
- A targeted top-stroke preservation experiment retained only a tiny fragment
  and still classified the digit as `1` (`0.919079`). Existing gentle,
  no-rule-cleanup, and no-component-cleanup variants also remained `1`.
  Therefore no crop/preprocessing change is included in Beta 15.68.
- The candidate changes only the single-slot accepted `1` versus independent
  scout `7` safety threshold from `0.99` to `0.985`. It can only preserve the
  browser transcription and force yellow teacher review; it cannot substitute
  `7` or use the answer key. Legitimate `1` reads supported by the scout remain
  automatic.
- A key-blind threshold frontier at `0.97`, `0.975`, `0.98`, `0.985`, `0.99`,
  and `0.995` shows that `0.985` is the highest tested threshold that catches
  this prospective incident. It changes **zero** decisions among the existing
  385 labelled answers. The primary 345 remain 315 automatic (91.3% coverage),
  zero known confident errors, and 30 yellow. The older 40-answer historical
  subset retains its three pre-existing legacy errors and is not worsened.
- Verification so far: targeted safety tests **14/14**, complete suite
  **383/383**, both safety replay scripts, and the pruned production build
  pass. Build label: `2026.08.01-one-seven-safety-beta-15-68`; safety policy:
  `accepted-answer-safety-shadow-3`.
- Isolated physical-test preview: `https://bf87be12.scangrade.pages.dev/`
  (alias `https://one-seven-safety-beta15-68.scangrade.pages.dev/`). Smoke test
  confirms the intended build/policy and a static HTML fallback at
  `/api/submissions`. **ScanGrade.io remains on verified Beta 15.67.**
- Required next gate: replay the same worksheet on the current iPhone and the
  five-year-old iPad. Question C must be yellow (not auto-changed), ordinary
  `1` answers must remain usable, grading must complete, and no device/runtime
  regression may appear. Only after that gate should the scoped source files
  be committed/pushed and the immutable build promoted to ScanGrade.io.

## 2026-08-01 in-app debug auto-save setup Beta 15.67 candidate

- The first physical Beta 15.66 check did not produce a private bundle. Tony's
  screenshot showed `Exported`, which is the manual iOS export state, not
  `Debug saved`. The installed iOS web app opened from the activation link but
  did not retain its URL fragment, so that standalone storage context never
  received the private auto-save key. The public upload ingress itself remained
  healthy and no phone POST reached it.
- An unconfigured Debug Scan now labels the compact bottom-bar action
  `Connect` instead of misleadingly offering only manual `Export`. Connect
  accepts either the private key or the complete activation link, stores the
  key and public upload URL locally in that exact browser/PWA installation,
  and changes the action back to `Export` afterward.
- If a completed debug scan is already on screen, connecting immediately
  uploads its resident evidence as `connected-after-scan`; another scan is not
  required. The visible `Debug saved: <id>` toast remains the success signal.
- The private key is never added to source, build assets, query parameters, or
  Cloudflare. This setup UI exists only in Debug Scan mode.
- Verification: two new setup/recovery contracts pass; complete suite
  **382/382** and the pruned production build pass. Build label:
  `2026.08.01-in-app-autosave-setup-beta-15-67`.
- Source commit `649d98f` is pushed. The isolated static production deployment
  is `https://ccaade59.scangrade.pages.dev/`, promoted to
  `https://scangrade.io/`. Immutable, custom-domain, local, and the static
  `/api/submissions` fallback HTML are byte-identical at SHA-256
  `e40958062ef384615f7540180a5705937e6173981df39e041df7a3f976bdeea9`.
  Public JavaScript is byte-identical at SHA-256
  `567ba5c0b9d423c81a76bbea906750a4375f09bb9cbab760e827e2f042a4fd7a`
  and contains the Beta 15.67 label. No Cloudflare backend or debug evidence
  storage is active.
- Physical iPhone/PWA connection and receipt are verified. Tony connected the
  installed Beta 15.67 app at 2026-08-01 12:54 Toronto time; the resident scan
  uploaded immediately with reason `connected-after-scan` and was saved as
  `private-evidence/debug-scans/2026-08-01/2026-08-01_16-54-09-635-sg-g1-lw-03-sub-1digit-5901ddb8/`.
  The bundle contains the captured and warped pages, marked sheet, overlay
  geometry, eight raw crops, eight model inputs, full debug JSON, and summary.
  The compact bar correctly returns to `Export` after connection because that
  is the manual fallback; the temporary `Debug saved` confirmation had cleared
  before Tony's screenshot. Future Debug Scans in this PWA storage context
  should auto-upload without reconnecting.

## 2026-08-01 reliable debug auto-save Beta 15.66 candidate

- The iPhone's repeated `Load failed` was a transport failure between the
  public ScanGrade page and a private tailnet browser destination. Receiver
  CORS/PNA behavior was valid, but mobile WebKit still did not reliably send
  the authenticated POST.
- Debug auto-save now uses a dedicated upload-only HTTPS ingress at
  `https://hobbes-mac-mini.tail9a3379.ts.net:8443/`. Tailscale Funnel exposes
  only `127.0.0.1:8793`; it does not expose Mission Control, its UI, its state,
  or stored evidence. The proxy accepts only `POST /` and preflight, requires
  the existing private token using constant-time comparison, permits only the
  exact `https://scangrade.io` browser origin, limits bundles to 80 MB, applies
  60 requests per 10 minutes per client, and times out after 70 seconds.
- The proxy forwards authenticated bundles over localhost to Mission Control.
  Its public response is sanitized to `{ok,id}` and never returns a local path.
  Student evidence remains only in ignored
  `private-evidence/debug-scans/YYYY-MM-DD/` on the Mac Mini; Cloudflare stores
  no debug data.
- A persistent private LaunchAgent
  `com.scangrade.debug-upload-proxy` runs the proxy separately from Mission
  Control. Its authentication token and operational plist remain outside git.
  Tailscale Funnel is enabled only on HTTPS port 8443 for this service.
- Existing configured phones automatically migrate the former private
  `/mission-control/api/debug-scans` URL to the new ingress without changing
  their locally stored token. Uploads now have a 75-second client deadline, so
  a network outage reports a visible failure instead of waiting indefinitely.
- Verified before deployment: exact-origin preflight returns 204; missing-token
  upload returns 401; wrong-origin upload returns 403; an authenticated public
  HTTPS bundle returns 201 and appeared in the private evidence directory.
  Complete suite **380/380** and the pruned production build pass.
- Build label: `2026.08.01-reliable-debug-autosave-beta-15-66`.
- Source commit `8750cb2` is pushed. The isolated static deployment
  `https://dce39763.scangrade.pages.dev/` is promoted to
  `https://scangrade.io/`. Immutable, public, local, and the propagated static
  `/api/submissions` fallback are byte-identical at SHA-256
  `d7b222513d2f5baca4b17590d7a9f84d8e4aa0d14fc7153d6804a96e03260b81`.
  Public JavaScript is byte-identical at SHA-256
  `21cac7b3c04a5249483f0c09915235c8b71eb60b7bcc620114592d36c96088b0`
  and contains the Beta 15.66 label. No Cloudflare backend or debug storage is
  active.
- Physical iPhone/PWA verification remains required after deployment. Do not
  claim physical success until a real Debug Scan shows `Debug saved` and its
  ID exists under `private-evidence/debug-scans/`.

## 2026-08-01 faster, transition-stable red X Beta 15.65 candidate

- Physical Beta 15.64 review found that red X marks appeared to change shade
  between their live SVG drawing and settled annotated-image stages. The two
  renderers shared a hex value but not their opacity, compositing, or pen-pass
  recipe.
- Both stages now use the exact same `#9a3a37` ink at `0.94` opacity, identical
  width, and multiply-on-paper compositing. The settled canvas no longer adds
  extra translucent passes after the live drawing. Seeded path geometry still
  supplies restrained natural variation.
- X size and placement are unchanged. Each leg is slightly quicker at `200ms`
  instead of `270ms`; the strict sequence and visible `160ms` pen-lift pause
  remain. The second top-right-to-bottom-left leg cannot start before the first
  top-left-to-bottom-right leg settles.
- The second physical auto-save attempt did not create a private bundle. The
  client showed no confirmed `Debug saved` state. The private-network receiver
  remains healthy and its authenticated preflight/upload tests pass; the
  mobile transport requires another test after the earlier failed-preflight
  cache has expired. Do not claim auto-save physically verified yet.
- Verification: complete suite **376/376** and pruned production build pass.
  Build label: `2026.08.01-faster-stable-red-x-beta-15-65-1`.
- Source commits `f6463bf` and timing-only follow-up `9793ed7` are pushed.
  Final isolated static release `https://8bd3f9e1.scangrade.pages.dev/` is
  promoted to `https://scangrade.io/`. Immutable, public, local, and the
  propagated static `/api/submissions` fallback are byte-identical at SHA-256
  `0d6bee3565f3c923f8348a753744de093d4e9418441aac157f4bde7a4fb040aa`.
  Public JavaScript is byte-identical at SHA-256
  `b1bde0ef0290a89b1729cc5d2364af3604e88a49d052a19d47c3a9bb4f5af099`
  and contains the Beta 15.65.1 label. No Cloudflare backend is active.
- Physical verification remains pending.

## 2026-08-01 compact debug evidence and restored private auto-save Beta 15.64 candidate

- First physical iPhone attempt reached completed grading but reported
  `Debug auto-save failed: Load failed`; no student bundle reached the receiver.
  Root cause was the public page's fetch into a tailnet/private-network address:
  ordinary CORS passed, but the receiver omitted the mobile browser's explicit
  private-network preflight grant. Mission Control now sends
  `Access-Control-Allow-Private-Network: true`. The LaunchAgent was restarted,
  the exact private-network OPTIONS request returns 204 with the grant, and an
  authenticated end-to-end Tailscale POST succeeds. This is receiver-only; the
  public Beta 15.64 application did not need another deployment.
- The full-height Debug Scan result card is removed. It duplicated the
  transcription already available through the centre arrow and made a
  completed scan look frozen on iPhone. Debug scans now retain the same fixed
  worksheet view as public scans.
- Manual JSON export remains as a compact `Export` action in the bottom bar.
  Automatic upload status is a small temporary toast, not a second result
  screen.
- Private debug auto-save is restored. The Mac Mini LaunchAgent now runs the
  current repository's `mission-control/server.mjs`, requires a private token,
  and stores evidence only under ignored
  `private-evidence/debug-scans/YYYY-MM-DD/`. Both local and Tailscale HTTPS
  authenticated smoke uploads passed. The token is outside the repository.
- A one-time URL-fragment setup can save the private receiver endpoint and
  token into the scan device. The fragment is never sent to Cloudflare and is
  removed from the address bar immediately after local storage succeeds.
- The user's latest physical Beta 15.63 capture reports that the previously
  unsafe handwritten `7` is now yellow, so the narrow second-reader veto
  appears to have activated. Exact crop/candidate diagnosis still requires the
  next automatically saved debug bundle; no attachment arrived with that
  report.
- Verification: complete test suite **375/375**, private receiver smoke tests,
  and pruned production build pass. Build label:
  `2026.08.01-compact-debug-autosave-beta-15-64`.
- Source commit `2b33b5c` is pushed. The isolated static release
  `https://3de786c4.scangrade.pages.dev/` is promoted to
  `https://scangrade.io/`. Immutable, custom-domain, local, and static
  `/api/submissions` HTML are byte-identical at SHA-256
  `35b2256dd09e6da0be73ea4b8ab00678f5fa26f8877a6573451f2494fb58933d`.
  Public JavaScript is byte-identical at SHA-256
  `6313c664048041f29b776928c0013e8a1e23f322b3f96378d29c999debb265ba`
  and contains the Beta 15.64 label. No Cloudflare backend is active.
- Physical iPhone/PWA verification remains pending.

## 2026-08-01 iOS debug export and unified red-X ink Beta 15.63 candidate

- A physical iPhone Debug Scan on Beta 15.62 reached its completed result page,
  but the installed web app silently failed when its synthetic download link
  was tapped. This was an iOS/PWA export failure, not an OCR-processing freeze.
  Private screenshots are under the Codex attachment path ending
  `C57085D5-C2D6-4AB1-91F9-71D44F512F19`; do not commit them.
- Debug export now prefers the native Web Share file sheet on compatible iOS,
  falls back to clipboard in installed mode, retains ordinary browser download
  elsewhere, and shows a visible success/cancel/error status. A separate
  `Copy debug JSON` action remains available beside the export action.
- Two wrong marks on the same page appeared as different reds because final
  canvas X marks varied their hue by seeded question value while live SVG X
  marks used the shared constant. Both paths now use one fixed, modestly
  brighter burgundy `#9a3a37`; shape and pen-pressure variation remain.
- The live `SG-G1-LW-03` C `7`→`1` incident is **not yet repaired** by Beta
  15.62's narrow scout rule on this capture. Do not lower the threshold or add
  a blanket `1` veto without the exported crop/candidate evidence. The next
  physical Debug Scan should use the new Export or Copy action and attach the
  resulting JSON for diagnosis.
- Verification: debug-export and ink tests pass; complete suite **373/373**;
  production build passes. Build label:
  `2026.08.01-ios-debug-share-unified-x-beta-15-63`.
- Source commit `ab5c4fc` is pushed. The first production command was launched
  from the repository working directory and the smoke test caught the dormant
  D1 Function on `/api/submissions`; it was immediately replaced before handoff
  by the same pruned build deployed from inside the isolated static directory.
  Final immutable production: `https://1c549da2.scangrade.pages.dev/` and
  custom domain `https://scangrade.io/`.
- Final immutable root, public root, local `dist/index.html`, and the custom
  `/api/submissions` fallback are byte-identical at SHA-256
  `702bc8478db0134b0fc4e8e769eda1db7f71e2151bdc2b11542fccf595fc80ab`.
  Public JavaScript is byte-identical to local at SHA-256
  `9339cc6c163a5945f1211479ac02b29f5b1a993d0044431132f9dee84e3b3d51`
  and contains the Beta 15.63 label. No backend is active.

## 2026-08-01 targeted 1→7 second-reader veto and structural red-X repair Beta 15.62 candidate

- A repeat physical Debug Scan of `SG-G1-LW-03` question C again accepted the
  student's written `7` as `1`. The completed debug summary appeared like a
  frozen screen because its download controls were below the visible answer
  grid. Private screenshot evidence:
  `/tmp/codex-remote-attachments/019f4912-2a9c-7fe2-8862-abb5da1992bb/43C1BB16-5E0B-4CB5-A3E7-6D8794BC525D/1-Photo-1.jpg`.
  Do not commit it.
- The previously labelled authentic instance of this exact packet/template/
  question contains decisive independent evidence: the browser initially read
  `1` automatically, while the local whole-slot scout read `7` with `0.999459`
  sequence probability. Handwritten truth was joined only after the decision;
  the policy never receives the answer key or truth.
- Public safety is extended narrowly: only an accepted physical one-slot `1`
  that independently reads as `7` at `>=0.99` is forced yellow. The browser
  transcription is preserved and never replaced. A true `1` supported as `1`,
  or a weaker `7` disagreement, remains automatic. This is not the rejected
  Beta 15.60 blanket-one veto.
- Reproducible replay: `node scripts/evaluate_six_eight_scout_veto.mjs` across
  all 385 labelled answers changes no known decision or measured coverage. The
  primary 345 remain zero known confident errors; three unrelated historical
  errors remain in the older 40-answer set. The authentic P03 `1`/`7` target
  is demoted to review while preserving read `1`; the prior `6`/`8` incident
  remains demoted. Private report:
  `private-evidence/reports/public-critical-confusion-scout-veto-20260801.json`.
- Root cause of the still-broken X was not timing: the animation revealed a
  finished bitmap containing both X legs through a broad crossing mask, so the
  first mask exposed pixels belonging to the future second leg. Incorrect
  marks now use two actual SVG ink paths. The second path does not exist on
  screen until the first has finished, two paint frames settle, and the pen
  lifts; its three-point geometry matches the final raster X.
- Debug completion now places `Download OCR debug JSON` above the answer grid,
  making the completed state and evidence export immediately reachable.
- Verification so far: targeted tests **41/41**, complete suite **369/369**,
  labelled replay gate, and production build pass. Build label:
  `2026.08.01-targeted-one-seven-direct-x-beta-15-62`.
- Source commit: `29beb54`. The first preview, `23bda85f`, was launched from
  the repository working directory and the smoke test caught an unconfigured
  dormant D1 Function at `/api/submissions`; it never reached the custom
  domain. It was immediately superseded from the genuinely isolated static
  directory by `https://617ab041.scangrade.pages.dev/`, promoted to
  `https://scangrade.io/`.
- Production, immutable, local release, and `/api/submissions` HTML are
  byte-identical at SHA-256
  `2d22a6b3188b9782aa4d53d3f4041aaa2dcf9826ee7b8c0477817e5de7ed668b`.
  Public JavaScript is byte-identical at SHA-256
  `a4bd101e0091dd3c68ba0034f40660284e4c2ccc9a50af4bd5c3ca5802b63c2b`
  and contains the exact Beta 15.62 label. A mobile-browser production smoke
  test mounts successfully. No backend is active.
- Next action: physically verify the same sheet and X animation on iPhone. Do
  not call physical behavior verified until that test.

## 2026-08-01 rejected broad 1 veto removed; render-locked X retained Beta 15.61

- Tony correctly rejected Beta 15.60's rule that made every confidently read
  isolated `1` yellow. Legitimate student answers of `1` are common, and a
  safety rule must distinguish suspicious evidence rather than distrust the
  digit class itself.
- The labelled replay used for Beta 15.60 contained no confidently accepted
  isolated `1`, so its zero measured coverage change did **not** test the
  policy's real classroom cost. That was an evaluation blind spot, not evidence
  that the broad rule was safe to ship.
- Beta 15.61 removes the isolated-`1` veto completely. Public accepted-answer
  safety returns to the previously verified narrow, key-blind physical-slot
  `6`↔`8` scout conflict only. Ordinary `1` answers are not sent to review.
- The live `7`→`1` transcription at `SG-G1-LW-03` question C remains an open
  safety incident. The screenshot does not contain the original unannotated
  crop, preprocessing candidates, or confidence evidence needed to design a
  defensible shape-specific repair. Do not claim this incident is fixed.
- Question G in that screenshot was correct behavior: the student wrote `9`,
  the teacher confirmed `9`, and `14 - 9` correctly graded that work wrong.
- Beta 15.60's independently useful red-X repair is retained: the second leg
  is one uninterrupted top-right-to-bottom-left path, hidden until the first
  leg has settled, two browser paint frames pass, and the pen-lift pause ends.
- Regression coverage explicitly proves that an accepted isolated `1` is not
  routed to review. Focused safety/animation tests pass **42/42**, the complete
  repository suite passes **368/368**, the narrow 6↔8 replay gate passes, and
  the pruned production build passes.
- Build label: `2026.08.01-sequential-x-beta-15-61`.
- Source commit: `f74c6cb`. Isolated static-only deployment:
  `https://7267edd3.scangrade.pages.dev/`; production:
  `https://scangrade.io/`. Production, immutable, local release, and
  `/api/submissions` HTML are byte-identical at SHA-256
  `4123f10782f01d576d1ec6b641a58eb50bca3322a6d3825d5339c65125099eef`.
  Public JavaScript is byte-identical to the tested release at SHA-256
  `1992a0bcd617ff83956efaa14fb98cd05be229ff9a7524d4708b5528ae214a80`
  and contains the exact Beta 15.61 label. Public assets are
  `index-wCjjOhRv.js` and `index-BCdifWrh.css`; no backend is active.
- Private screenshot evidence:
  `/tmp/codex-remote-attachments/019f4912-2a9c-7fe2-8862-abb5da1992bb/6BC4C52E-1E78-423F-920F-75E38F32AA8B/1-Photo-1.jpg`.
  Do not commit the image.

## 2026-08-01 prospective 7→1 safety repair and render-locked X Beta 15.60 — superseded

- Physical Beta 15.59 evidence shows a new unsafe transcription at
  `SG-G1-LW-03` question C: the student wrote `7`, the browser confidently
  displayed `1`, and correct work received a red X. Question G is not an OCR
  failure: the student wrote `9`, the teacher confirmed `9`, and `14 - 9`
  correctly graded that response wrong.
- Beta 15.60 briefly forced every accepted isolated one-slot browser read of
  `1` to yellow. Tony rejected that over-broad policy immediately; Beta 15.61
  removes it. Do not restore it without representative `1`/`7` evidence.
- Reproducible replay: `node scripts/evaluate_six_eight_scout_veto.mjs` across
  all 385 available labelled answers. It changed no known decision or measured
  coverage because the corpus had no confidently accepted isolated `1`; this
  was non-informative about the policy's classroom cost. The output is private:
  `private-evidence/reports/public-critical-confusion-veto-20260801.json`.
- The red X now draws its second leg as one uninterrupted top-right-to-bottom-
  left SVG path. Later strokes remain `visibility:hidden` until the preceding
  stroke has settled, two complete browser paint frames have passed, and the
  explicit pen-lift pause has elapsed. This avoids Safari reporting animation
  completion before its final pixels are visible.
- Verification: focused safety/animation tests **43/43**, complete repository
  tests **369/369**, and the pruned production build pass. Build label:
  `2026.08.01-one-seven-safety-sequential-x-beta-15-60`.
- Private screenshot evidence:
  `/tmp/codex-remote-attachments/019f4912-2a9c-7fe2-8862-abb5da1992bb/6BC4C52E-1E78-423F-920F-75E38F32AA8B/1-Photo-1.jpg`.
  Do not commit the image.
- Source commit: `ee978bc`. Isolated static-only deployment:
  `https://41975303.scangrade.pages.dev/`; production:
  `https://scangrade.io/`. Production, immutable, local release, and
  `/api/submissions` HTML are byte-identical at SHA-256
  `ca69a0a3c2e62f84c4165a5ca3d362394a0fc6eddc28e29e2dae77c325125f70`.
  Public JavaScript is byte-identical to the tested release at SHA-256
  `e086611418bd6d42dbca15b2859d9bb392c5fe899e7c7cf52fb11440f10c80c3`
  and contains the exact Beta 15.60 label. Public assets are
  `index-BwcbdN3q.js` and `index-CwL-39MC.css`; no backend is active.

## 2026-08-01 stationary completion and retained slot focus Beta 15.59

- Physical review of Beta 15.58 found that the whole-page stamp compression
  looked like an accidental layout shift. The worksheet now remains completely
  stationary. When the final date stamp appears, a brief viewfinder-green edge
  glow confirms completion without moving, scaling, or changing the sheet or
  stamp ink.
- During a two-slot manual correction, entering the first digit no longer
  removes the blue focus prematurely. The entered digit remains rendered in its
  final black position, while the blue focus moves behind the remaining
  physical slot. The focus clears only when the full correction contract is
  complete.
- This is a presentation-only patch. OCR, capture gates, homography,
  recognition, confidence, answer-key use, grading, correction values,
  annotation registration, privacy, and the `6↔8` safety repair are unchanged.
- Verification: focused transition tests **30/30**, complete repository tests
  **367/367**, and the pruned root-domain production build pass. Build label:
  `2026.08.01-static-completion-glow-beta-15-59`.
- Source commit: `2217fd0`. Isolated static-only deployment:
  `https://257df070.scangrade.pages.dev/`; production:
  `https://scangrade.io/`. Production, immutable, local release, and
  `/api/submissions` HTML are byte-identical at SHA-256
  `6b7e835f65f52c01c8063b629f3a73ec324124e728f97fb39e93e2ade0ed3c34`.
  The public JavaScript is byte-identical to the tested release at SHA-256
  `d0a993a00d7e1cd2f59f91ffc7d79447875033dfe84bee90386b6776dfd295a6`
  and contains the exact Beta 15.59 label. Public assets are
  `index-CQziMzZb.js` and `index-C000gUB3.css`; no backend is active.

## 2026-08-01 stable check endpoint and stronger stamp impact Beta 15.58

- Physical iPhone review of Beta 15.57 found that the stamp impact was too
  subtle to notice and that the short starting end of some checkmarks appeared
  to retract immediately after drawing.
- Root cause of the checkmark snap: the oversized SVG reveal dash correctly
  protected the far endpoint, but its negative final offset could pull the
  already-drawn starting endpoint backward in WebKit before the path settled.
  The oversized dash is retained, but every stroke now finishes at offset zero.
  The revealed path and the settled path therefore have identical endpoints.
- The stamp itself still appears immediately at its final opacity and never
  fades, changes colour, or "sets." The worksheet impact is increased from
  `0.8%`/`135 ms` to `2.2%` compression with a `0.3%` rebound over `210 ms`,
  anchored at the actual stamp position. This should be clearly perceptible
  without adding a non-paper visual element.
- OCR, capture, homography, recognition, confidence, grading, answer-key use,
  annotation geometry, correction state, privacy, and the `6↔8` safety repair
  are unchanged.
- Verification: focused animation tests **22/22**, complete repository tests
  **366/366**, and the pruned root-domain production build pass. Build label:
  `2026.08.01-stable-check-impact-beta-15-58`.
- Source commit: `7bb6f3d`. Final static-only deployment:
  `https://d8a93999.scangrade.pages.dev/`; production:
  `https://scangrade.io/`. Production, immutable, local release, and
  `/api/submissions` HTML are byte-identical at SHA-256
  `5b2281c38351e0769ab21cb6eacceb29f2d2d66455173cda7f83cbedf8629000`,
  confirming the exact tested Beta 15.58 build is live with no active backend.
  Public assets are `index-BtCaH_Xy.js` and `index-QCetzWaK.css`.

## 2026-08-01 sequenced red X and stamp-impact candidate Beta 15.57

- Tony reported two completion-animation defects in the current public UI:
  the red X's second stroke could visibly begin before the first completed and
  could show an endpoint gap that filled later; the completion-date ink could
  appear to change or "set" after landing.
- Red X strokes are now a true completion-driven sequence. The crossing stroke
  is kept hidden until the browser reports that the first top-left-to-bottom-
  right stroke has actually finished, then observes the pen-lift pause before
  drawing top-right to bottom-left. The reveal mask runs beyond each physical
  endpoint by a stroke-width-aware amount and settles solid, preventing the
  transient WebKit gap without changing the final X geometry.
- The selected stamp treatment is **Option 1: physical page impact**. The date
  appears immediately at its final ink opacity with no fade, outline, ink-set,
  or stamp animation. At that instant the complete worksheet compresses by
  about `0.8%` for `135 ms`, anchored at the calculated stamp position, then
  returns to exactly the same size. This creates a short "boom" while keeping
  the resulting sheet indistinguishable from an ordinary static teacher stamp.
- This is a presentation-only candidate. OCR, capture gates, homography,
  recognition, confidence, answer keys, grading, correction data, annotation
  geometry, privacy, and the Beta 15.56 `6↔8` safety repair are unchanged.
- Verification: focused progressive-animation tests **22/22**; complete
  repository tests **366/366**; standard and pruned public production builds
  pass. A new regression simulates a late browser animation and proves that the
  crossing stroke cannot start early. Build label:
  `2026.08.01-sequenced-x-stamp-impact-beta-15-57`.
- Source commit: `bef4c54`. Final static-only deployment:
  `https://2bfafb58.scangrade.pages.dev/`; production:
  `https://scangrade.io/`. Production, immutable, and local release HTML are
  byte-identical at SHA-256
  `c57e1775a05c9897b9a82a85e96bb3699a4bf320ebf90b34202bf61f4cbdb5cd`
  and serve `index-DjDGL_l3.js` / `index-BMMaQ6Xz.css`; the live JavaScript is
  byte-identical to the tested release and contains the exact Beta 15.57 label.
- Deployment safety note: the first production upload was invoked from the
  repository root and Wrangler discovered the dormant `functions/` directory,
  briefly activating an unconfigured D1 route. The smoke test caught this
  immediately. It was superseded from a genuinely isolated static working
  directory by `2bfafb58`; final `/api/submissions` is byte-identical to the
  static app HTML, confirming that no backend or student-data storage route is
  active.

## 2026-07-31 narrow public 6/8 safety candidate Beta 15.56

- The confirmed Beta 15.54 incident was a real handwritten `6` accepted as
  `8`. The existing 7.7 MB browser-local whole-slot scout independently reads
  the screenshot-derived answer view as `6` with approximately `0.939`
  sequence support.
- Public grading now performs one deliberately narrow, key-blind safety check:
  for an already-accepted one-slot `6` or `8`, an exact `6↔8` disagreement from
  the scout at `>=0.90` forces yellow review. It preserves the browser's text;
  it never substitutes the scout result or consults mathematical correctness.
  Older broad experimental vetoes remain unavailable on the public scope.
- The scout is initialized while the teacher frames the page, retains its
  browser-worker session between scans, and only receives accepted one-slot
  `6`/`8` crops. Pages without such an accepted digit do not wait for it.
  Failure and timeout remain fail-open to the prior public decision.
- Reproducible replay:
  `node scripts/evaluate_six_eight_scout_veto.mjs`. On the primary 345 labelled
  answers, the candidate changes zero decisions and retains `315/315` correct
  automatic reads with zero known confident errors. On 40 older historical
  answers, it adds no error or regression; three unrelated legacy confident
  errors remain outside this narrow repair. The prospective incident simulation
  becomes yellow while preserving the recorded browser read `8`.
- Focused tests pass **19/19**; all repository tests pass **365/365**; the
  pruned production build passes and retains the 7.7 MB scout model. A local
  mobile-WebKit smoke test completed the representative page in about 3.1 s;
  its cold safety read was about 0.38 s in that environment. This is browser
  emulation, not a claim about the physical five-year-old iPad.
- Private screenshots and the generated replay report remain under
  `private-evidence`/temporary attachments and must not be committed.
- Build label: `2026.07.31-six-eight-safety-beta-15-56`. Deployment details
  are: isolated static-only `e7221f62.scangrade.pages.dev`, promoted to
  `scangrade.io`. The first upload exposed a pre-existing custom-domain cache
  entry that served the SPA shell at the formerly missing unversioned model
  path; the client now uses a versioned model URL. Final custom-domain and
  immutable HTML match byte-for-byte, the public model matches the tracked
  ONNX hash exactly, and `/api/submissions` remains a static HTML fallback.

## 2026-07-29 debug-flow isolation Beta 15.55

- A physical iPhone Debug Scan completed OCR but exposed the large export
  summary while progressive marking/review was still active. The worksheet was
  pushed out of its normal fixed workspace and the app remained visibly on
  `Grading`, making the flow appear frozen before the yellow correction opened.
- The debug export summary is now withheld while progressive marking or manual
  yellow review is active. It becomes available only after the same normal
  marking/review sequence has settled, so diagnostic UI cannot interrupt or
  displace the teacher workflow.
- Evidence:
  `/tmp/codex-remote-attachments/019f4912-2a9c-7fe2-8862-abb5da1992bb/EF354322-9889-495A-A8A0-D540C0B58FEA/1-Photo-1.jpg`.
  This private screenshot must not be committed.
- This patch changes presentation only. OCR, capture, confidence, grading,
  answer keys, annotations, and the browser-local safety policy are unchanged.
- Verification: focused fixed-workspace/progressive tests **23/23**, complete
  repository tests **360/360**, and production build passed. Build label:
  `2026.07.29-debug-flow-isolation-beta-15-55`.
- Deployment: isolated static-only `ab5e380a.scangrade.pages.dev`, promoted to
  `scangrade.io`. The custom domain and immutable URL serve the same
  `index-C0MfzrAn.js` build, and `/api/submissions` is byte-identical to the
  static app shell (no active backend).

## 2026-07-29 live confident-error incident under Beta 15.54

- A physical iPhone screenshot from public build
  `2026.07.29-marker-centered-app-icon-beta-15-54` shows
  `SG-G1-LW-01` question B (`4 + 2`) visibly written as `6` but receiving an
  automatic red X and a final score of `7/8`.
- The authoritative layout was checked: question B's answer key is correctly
  `6`. This is therefore a real unsafe public result, not an answer-key typo.
- Tony expanded the recognition overlay before making a correction. It shows
  the exact public OCR transcription for question B was `8`. The failure is
  therefore conclusively an unsafe OCR acceptance (`6→8`), not a later
  grading, scoring, answer-key, or annotation-state mismatch.
- The screenshot evidence is:
  `/tmp/codex-remote-attachments/019f4912-2a9c-7fe2-8862-abb5da1992bb/474E4B52-076D-462B-9E17-BB9A7F222AD9/1-Photo-1.jpg`.
  It is private evidence and must not be committed.
- A local diagnostic made from the rendered screenshot (not the original
  phone tensor) reproduced the failure class: the ordinary small digit reader
  preferred `8`, while the existing 7.7 MB key-blind whole-slot scout read `6`
  with approximately `0.939` sequence support. This indicates that an
  independent browser-local safety reader could have demoted this case to
  yellow without substituting the mathematical answer.
- A broad scout-only veto is not yet safe enough to deploy: prior replay
  evidence shows that it catches some confident errors but leaves others and
  can demote some correctly transcribed, mathematically wrong student answers.
  No OCR/confidence/production code has been changed or deployed in response.
- The canonical accepted-answer repair replay was rerun unchanged after this
  incident. Its paired 345-answer evidence reproduces: broad-veto-removed
  control `312/345` automatic with `20` confident transcription errors;
  repaired candidate `284/345` automatic, `284/284` matching handwritten
  truth, `0` known confident errors, and `61` yellow. It changes 28 decisions:
  all 20 control errors become yellow, alongside eight correct-but-difficult
  reads. This validates the safety architecture offline but does not authorize
  public deployment because its complete independent-reader path is not the
  current public browser-only runtime.
- Next action: test an isolated browser-only safety candidate on identical
  saved evidence, with this `6→8` morphology represented, before considering
  any production change. Scout-only disagreement may be used as a cheap route
  or containment signal, but not claimed as a complete zero-error solution.

## 2026-07-29 marker-centered app icon Beta 15.54

- The third physical iPhone screenshot was measured directly rather than
  judging the source canvas: the rendered white tile spans x=`32–143`, while
  the lower marker edge gaps were `25px` left and `18px` right.
- The unchanged logo is now geometrically centered on the icon canvas. This
  moves the physical rendering roughly `3.5` screenshot pixels left and makes
  the lower corner-marker margins equal. Pure white, scale, and sharp source
  rendering are preserved.
- The regression now explicitly requires equal left/right lower-marker edge
  gaps. Fresh `v5` URLs prevent reuse of any earlier icon.
- OCR, capture, grading, review, privacy, and student-data behavior are
  unchanged.
- Verification: icon/PWA contract **5/5**, full repository **360/360**, and
  pruned production build passed. Build label:
  `2026.07.29-marker-centered-app-icon-beta-15-54`.
- Deployment: `50dd3556.scangrade.pages.dev`, promoted to `scangrade.io`.
  Public HTML and the marker-centered `v5` Apple icon match the verified build
  byte-for-byte.

## 2026-07-29 final icon alignment Beta 15.53

- Physical iPhone inspection found Beta 15.52 one native icon pixel too far
  right. The complete unchanged logo is moved exactly `1px` left from that
  version, preserving the pure-white background, scale, and sharp rendering.
- Install assets use fresh `v4` URLs so a delete/re-add cannot reuse Beta
  15.52's artwork.
- OCR, capture, grading, review, privacy, and student-data behavior are
  unchanged.
- Verification: icon/PWA contract **5/5**, full repository **360/360**, and
  pruned production build passed. Build label:
  `2026.07.29-final-icon-alignment-beta-15-53`.
- Deployment: `3ad73687.scangrade.pages.dev`, promoted to `scangrade.io`.
  Public HTML and the `v4` Apple icon match the verified build byte-for-byte.

## 2026-07-29 physical icon alignment Beta 15.52

- Tony's second physical iPhone Home Screen inspection requested a further
  rightward correction so the logo reads centered after Apple's rounded icon
  processing, using the lower corner markers as the visible anchors.
- The unchanged logo receives an additional `2px` rightward translation in the
  native 180px Apple asset. The pure-white background, scale, resolution, and
  sharp source rendering are unchanged.
- All install icon paths are versioned again as `v3`, preventing Safari or iOS
  from reusing either previous icon when the app is removed and re-added.
- OCR, recognition, capture, grading, review, PWA privacy boundaries, and all
  student-data behavior are unchanged.
- Verification: icon/PWA contract **5/5**, full repository **360/360**, and
  pruned production build passed. Build label:
  `2026.07.29-physical-icon-alignment-beta-15-52`.
- Deployment: `190552d2.scangrade.pages.dev`, promoted to `scangrade.io`.
  Public HTML and the versioned `v3` Apple icon match the verified build
  byte-for-byte.

## 2026-07-29 optically centered app icon Beta 15.51

- A physical iPhone Home Screen screenshot showed that the first installed icon
  had a slightly grey background and read left-heavy even though its geometric
  bounding box was centered.
- The icon now uses a pure `#FFFFFF` background. Its exact approved ScanGrade
  mark is shifted right by `2.35%` of the canvas so the black ink's measured
  visual center lands within one pixel of the canvas center. The source logo
  was not redrawn or modified.
- New versioned Apple, standard, and maskable icon URLs prevent an iPhone
  reinstall from reusing the former icon asset. Existing installed copies may
  need to be removed and added to the Home Screen again because iOS retains
  installed icon artwork.
- Tests now lock the Apple icon at native `180×180` resolution, require a
  pure-white perimeter, and verify optical ink centering on both axes.
- OCR, recognition, capture, homography, grading, review, and all student-data
  behavior are unchanged.
- Verification: icon contract **5/5**, full repository **360/360**, pruned
  production build passed, and the Apple rounded-mask comparison was inspected.
  Build label:
  `2026.07.29-optically-centered-app-icon-beta-15-51`.
- Deployment: `67ff2433.scangrade.pages.dev`, promoted to `scangrade.io`.
  Public HTML, manifest, and 180px Apple icon match the verified build; the
  production browser reports zero manifest errors and all installed-icon URLs
  resolve to the versioned `v2` assets.

## 2026-07-29 installable web app Beta 15.50

- ScanGrade can now be added to an iPhone or iPad Home Screen from Safari and
  opens in a standalone, app-like window without browser controls.
- The installed icon uses the exact approved ScanGrade logo. Dedicated
  `180px`, `192px`, `512px`, and maskable `512px` assets were generated
  mechanically from `public/scangrade-logo-transparent.png`; the brand mark
  itself was not redesigned.
- A standards-based web app manifest, iOS home-screen metadata, and a
  production-only service worker were added. Updates are checked whenever the
  site loads, but an in-progress scan is never forcibly reloaded.
- Privacy boundary: Cache Storage contains only the public app shell and
  versioned static UI assets. Student scans, manual corrections, API requests,
  debug uploads, model requests, and all non-GET traffic remain outside this
  service worker's cache.
- This is installability and launch resilience, not a claim that grading is
  fully offline. Recognition resources that have not already been loaded can
  still require a connection.
- OCR, recognition, confidence, capture, homography, grading decisions,
  correction values, and answer-key boundaries are unchanged.
- Verification: install contract tests passed, Chromium reported no manifest
  errors, the service worker installed and controlled the app, the exact icon
  sizes were verified, the settled iPhone-size landing page was inspected,
  the full repository passed **358/358**, and the pruned production build
  passed. Build label:
  `2026.07.29-installable-web-app-beta-15-50`.
- Deployment: `1843266b.scangrade.pages.dev`, promoted to `scangrade.io`.
  Production HTML, JavaScript, CSS, manifest, service worker, and Apple touch
  icon are byte-identical to the verified build. A production browser smoke
  test found zero manifest errors and an active root-scoped service worker.

## 2026-07-29 QR-safe completion placement Beta 15.49

- Physical iPhone evidence on the ten-frame sheet showed the completion date
  entering the QR footprint and the handwritten `6/6` coming uncomfortably
  close. The old placement used offsets from the QR's transformed edge but did
  not collision-test the complete visible score and date regions.
- The transformed QR now creates a padded, hard exclusion zone that includes
  its quiet area, printed label, perspective error, and breathing room. The
  handwritten score is placed beside that exclusion or moved fully above it.
  The date is smaller horizontally, farther right, farther below the score,
  and must pass explicit score/QR collision checks.
- If an unusually skewed capture leaves no safe completion-date area, the
  decorative date is omitted rather than drawn over the score, QR code, or
  student work. The score remains present.
- A photographed/skewed ten-frame regression now verifies all three required
  separations: score↔QR, date↔QR, and date↔score. OCR, recognition, capture,
  homography, grading, correction values, and answer-key boundaries are
  unchanged.
- Verification: focused placement tests **13/13**, full repository tests
  **355/355**, pruned production build passed. Build label:
  `2026.07.29-qr-safe-completion-zone-beta-15-49`.
- Deployment: `08bb3bfd.scangrade.pages.dev`, promoted to `scangrade.io`.
  Production HTML, `index-BYipC2TZ.js`, and `index-Cf3B6WSa.css` are
  byte-identical to the verified build.

## 2026-07-29 continuous corrections, final stamp, and landing composition Beta 15.48

- A Safari paint race could remove the live black correction preview before
  the equivalent correction-animation base had painted, causing the digit to
  disappear briefly before its check/X. The preview now stays present until
  the replacement image reports loaded and two animation frames have passed;
  only then can review advance to the next yellow.
- The completion date keeps its approved size and placement but now appears
  once at full settled opacity after the handwritten score. The blur, pop,
  paper-compression impression, and all date-stamp keyframe animation were
  removed. It remains visible for `420ms` as a punctuated completion mark
  before the final annotated image takes over.
- The scanning/grading header remains compact and fixed. The opening screen
  now has its own centered hero composition: a `68px` logo, `30px` wordmark,
  clearer brand-to-actions spacing, and the existing three actions grouped
  below it. An iPhone 13 render was inspected after the loading transition.
- OCR, recognition, grading, capture, homography, correction values, date
  placement, and answer-key boundaries are unchanged. Focused UX tests pass
  **27/27**, the full repository passes **353/353**, and the pruned production
  build passes. Build label:
  `2026.07.29-continuous-correction-final-stamp-home-beta-15-48`.
- Deployment: `5c450b80.scangrade.pages.dev`, promoted to `scangrade.io`.
  Production HTML and `index-C7E543Dp.js` are byte-identical to the verified
  build.

## 2026-07-28 strictly sequential red X Beta 15.47

- Physical review made the X's crossing stroke appear to start before the
  first stroke had visibly finished. The animation now enforces this order:
  top-left to bottom-right for `270ms`, a `160ms` pen-lift pause, then
  top-right to bottom-left for `270ms`.
- Any delayed SVG stroke is fully transparent before its own active interval,
  preventing WebKit from exposing even a round starting cap during the pause.
  The page-marking scheduler also waits for the complete X plus an `80ms`
  settling margin before starting another question.
- OCR, recognition, grading, capture, homography, mark geometry, correction
  behavior, and answer-key boundaries are unchanged. Focused sequencing tests
  pass **24/24**, the full repository passes **353/353**, and the pruned
  production build passes. Build label:
  `2026.07.28-sequential-red-x-beta-15-47`.
- Deployment: `6b92f7c4.scangrade.pages.dev`, promoted to `scangrade.io`.
  Production HTML and `index-B1EXIQyg.js` are byte-identical to the verified
  build.

## 2026-07-28 correction tape replaces compact focus frame Beta 15.46

- Tony preferred the former compact blue correction frame to Beta 15.45's
  externally offset outline. The focus treatment is again a `2px` border on
  the exact digit-slot geometry.
- The visual handoff is now simultaneous: while the answer is untouched, the
  blue frame remains visible around the student's pencil writing. On the first
  entered correction digit, the white tape and black correction appear while
  the blue border and glow become transparent in the same render. There is no
  delayed border release to expose additional white pixels afterward.
- OCR, recognition, grading, capture, homography, answer geometry, correction
  values, and answer-key boundaries are unchanged. Focused correction and
  animation tests pass **24/24**, the full repository passes **353/353**, and
  the pruned production build passes. Build label:
  `2026.07.28-tape-replaces-focus-beta-15-46`.
- Deployment: `369e18a1.scangrade.pages.dev`, promoted to `scangrade.io`.
  Production HTML and `index-BfcNW362.js` are byte-identical to the verified
  build.

## 2026-07-28 measured Safari pen reveal and external correction frame Beta 15.45

- Live iPhone review showed that red X strokes could still contain transient
  gaps while first being drawn. The normalized SVG `pathLength` approach was
  removed. Progressive check, X, and score paths now measure their real SVG
  length at runtime, reveal that physical length with a two-unit endpoint
  overrun, and settle to one solid path. The first X stroke still completes
  before the crossing stroke begins.
- The blue manual-correction focus frame is now a `2px` outline positioned
  `3px` outside the correction-tape geometry. It no longer covers the tape's
  outer pixels, so removing the focus state does not visually enlarge the
  white tape.
- OCR, recognition, grading, capture, homography, answer geometry, correction
  semantics, score/date placement, and answer-key boundaries are unchanged.
  Focused animation/correction tests pass **25/25**, the full repository passes
  **353/353**, and the pruned production build passes. Build label:
  `2026.07.28-gapless-ink-framed-tape-beta-15-45`.
- Deployment: static app `41bf5ba5.scangrade.pages.dev`, promoted to
  `scangrade.io`. Production HTML and `index-B1Kpgg1O.js` are byte-identical
  to the verified build. The existing submissions Function remains present
  but reports that its D1 binding is not configured; this presentation patch
  does not use or change it.

## 2026-07-28 deeper red and score/date spacing Beta 15.44

- Tony selected darker red option 2, `#862c2a`, after comparing it directly
  with the established `#126c39` green and Beta 15.43's `#a03731` red.
- The completion-date zone now begins at least `0.84 ×` the score font size
  or `3%` of page height below the written score anchor, whichever is larger.
  This adds visible breathing room while retaining the QR-aware page bounds
  and the existing deterministic variation.
- OCR, recognition, grading, capture, homography, answer geometry, correction
  semantics, score geometry, and answer-key boundaries are unchanged. Focused
  presentation tests pass **29/29**, the full repository passes **352/352**,
  and the pruned production build passes. Build label:
  `2026.07.28-deeper-red-score-spacing-beta-15-44`.
- Deployment: static-only `cf066476.scangrade.pages.dev`, promoted to
  `scangrade.io`. Production HTML and `index-CFsvfDhL.js` are byte-identical
  to the verified build; `/api/submissions` remains the identical static shell.

## 2026-07-28 clear red ink and WebKit stroke repair Beta 15.43

- Tony selected brighter option 3, `#a03731`, for incorrect X marks and red
  low-score writing. It remains less harsh than the former `#b33d35` while
  reading more clearly than Beta 15.42's `#9a342f`.
- Physical iPhone review showed that Beta 15.42 could still display gaps in
  red strokes. The cause was WebKit rounding the normalized one-unit SVG dash
  path during animation. All progressive mark and score paths now use a
  100-unit path length and a 100-unit reveal. The completed frame explicitly
  becomes one solid path. X stroke order remains unchanged.
- OCR, recognition, grading, capture, homography, answer geometry, correction
  semantics, and answer-key boundaries are unchanged. Focused ink/animation
  tests pass **23/23**, the full repository passes **352/352**, and the pruned
  production build passes. Build label:
  `2026.07.28-clear-red-ink-beta-15-43`.
- Deployment: static-only `8f3e9a48.scangrade.pages.dev`, promoted to
  `scangrade.io`. Production HTML and `index-r02V_Tdi.js` are byte-identical
  to the verified build; `/api/submissions` remains the identical static shell.

## 2026-07-28 balanced red ink Beta 15.42

- Tony selected the slightly brighter balanced teacher red `#9a342f`.
  Incorrect X marks and red low-score writing now share this one ink constant;
  the approved dark green remains `#126c39`.
- Safari could occasionally leave a small dash gap when a progressive stroke
  reached its final frame, most noticeably on the X's second stroke. The draw
  animation now switches to one solid dash only after the animated stroke has
  reached its endpoint. Stroke order and geometry are unchanged: the first X
  stroke completes before the second begins.
- OCR, recognition, grading, capture, homography, answer geometry, correction
  semantics, and answer-key boundaries are unchanged. Focused ink/animation
  tests pass **23/23**, the full repository passes **352/352**, and the pruned
  production build passes. Build label:
  `2026.07.28-balanced-red-ink-beta-15-42`.
- Published static-only at `e69b29f1.scangrade.pages.dev` and
  `scangrade.io`. Production HTML and `index-07fwW0ch.js` are byte-identical
  to the tested build; the cache-busted `/api/submissions` path returns the
  identical static shell.

## 2026-07-28 varied completion stamp Beta 15.41

- Physical review of Beta 15.40 found a white edge in the temporary
  paper-pressure effect and an overly uniform completion date.
- The impression gradient now uses neutral paper shadow only—there is no
  white stop or persistent outline. The completion-date zone is farther right
  while remaining below the score, to the right of the QR code, and inside
  the page boundary.
- Date position and slant now derive from the worksheet result's existing
  annotation seed. Different scans receive restrained natural variation;
  replaying identical evidence remains pixel-stable. The live reveal, saved
  worksheet, and correction-animation cleanup use the same seed and rectangle.
- The blue manual-entry focus pulse was audited for upper and lower questions.
  It follows the active answer's registered page coordinates with no viewport
  or vertical-position gate, so bottom-row answers receive the same pulse.
  A regression now locks that behavior.
- OCR, recognition, grading, capture, homography, answer geometry, correction
  semantics, and answer-key boundaries are unchanged. Focused presentation
  tests pass **30/30**, the complete repository passes **351/351**, and the
  pruned production build passes. Build label:
  `2026.07.28-varied-completion-stamp-beta-15-41`.
- Published static-only at `8724cffd.scangrade.pages.dev` and
  `scangrade.io`. Production HTML and `index-BsH-NPm5.js` are byte-identical
  to the tested build; the cache-busted `/api/submissions` path returns the
  identical static shell.

## 2026-07-28 score-adjacent completion date Beta 15.40

- Tony approved moving the final date from the page header to the teacher-mark
  cluster at the bottom right, directly below the handwritten score.
- Date placement now derives from the same answer-box-aware score placement.
  It remains to the right of the declared QR zone, inside the page margins,
  and is enabled only for layouts carrying ScanGrade's date-zone safety
  contract. The live reveal, saved annotation, and correction-animation
  cleanup all use the same calculated rectangle.
- A brief neutral paper-pressure gradient appears under the date as it lands,
  then disappears completely. It does not transform the worksheet or date and
  leaves no interface outline or halo.
- OCR, recognition, grading, capture, homography, answer geometry, correction
  behavior, score placement, and answer-key boundaries are unchanged. Focused
  date/score/progressive tests pass **29/29**, the complete repository passes
  **349/349**, and the pruned production build passes. Build label:
  `2026.07.28-score-adjacent-date-beta-15-40`.
- Published static-only at `28b3cc05.scangrade.pages.dev` and
  `scangrade.io`. Production HTML and `index-CKkjlQJ6.js` are byte-identical
  to the tested build; the cache-busted `/api/submissions` path returns the
  identical static shell.

## 2026-07-28 natural date impression Beta 15.39

- Physical review rejected Beta 15.38's blue completion outline because it
  looked like app feedback rather than something a teacher would leave on
  paper.
- The separate expanding blue rectangle has been removed. The final date now
  arrives through its own blue ink only: a short soft/darker ink impression
  settles into the exact final date pixels.
- The date image is never translated, transformed, or scaled, and nothing
  extra remains on the worksheet. Its existing final-raster clip and
  score-before-date sequence remain unchanged.
- OCR, recognition, grading, capture, homography, answer geometry, correction
  behavior, and the date location are unchanged. The focused progressive
  marking suite passes **18/18** and the complete repository passes
  **347/347**. Build label:
  `2026.07.28-natural-date-impression-beta-15-39`.
- The pruned production build passes and was published static-only at
  `36c41a3a.scangrade.pages.dev` and `scangrade.io`. Production HTML and
  `index-C1MN8Jie.js` are byte-identical to the tested build. A cache-busted
  `/api/submissions` request returns the identical app shell, confirming no
  Pages Function is active.

## 2026-07-28 stable correction transition Beta 15.38

- Physical review of Beta 15.37 reported an apparent correction-digit shift
  when the blue focus frame disappeared.
- Inspection confirms the live and settled black digits already use the same
  renderer, physical rectangles, deterministic seed, font, colour, and
  placement. The strong pulsing frame was overriding the entered-state fade
  and then disappearing abruptly, creating a contrast-based apparent jump.
- The focus pulse is now lower amplitude. Once the complete correction has
  been entered and submission begins, only the blue border and glow fade out
  over 180 ms. The black digit layer is neither transformed nor faded, and a
  partial first digit in a two-digit correction retains visible focus.
- A direct source contract now locks the live and settled seed calculations to
  the same value in addition to the existing shared-renderer determinism test.
  OCR, recognition, grading, capture, geometry, and correction semantics are
  unchanged. Focused presentation tests pass **23/23**; the full repository
  passes **347/347** and the pruned production build passes. Build label:
  `2026.07.28-stable-correction-transition-beta-15-38`.
- Published static-only at `a2299891.scangrade.pages.dev` and
  `scangrade.io`. Production HTML and `index-2vwcRpsk.js` are byte-identical
  to the tested build; `/api/submissions` returns the identical static shell.

## 2026-07-28 quiet focus and completion Beta 15.37

- The silent scanning stage retains its moving yellow sweep as a useful
  progress signal. Once automatic marks begin, `Grading` holds one steady
  fluorescent band so it no longer competes with the teacher-pen animation.
- The active manual-review box now uses a slow, low-amplitude blue border/glow
  pulse. It changes only border and shadow—not position, size, opacity, or
  worksheet geometry.
- Manual correction digits retain the exact shared live/final renderer and
  placement, but move from weight 700 to 600 with lighter duplicate ink
  (`0.10` instead of `0.16`). This makes them less heavy without causing the
  live-to-settled shift that earlier separate renderers produced.
- The exact settled date pixels still appear only after the handwritten score.
  A larger, short-lived blue completion halo now expands around the declared
  date zone while the stamp lands; the halo disappears completely and cannot
  alter the final date position.
- OCR, recognition policy, confidence, coverage, grading, crops, homography,
  capture, answer geometry, and correction semantics are unchanged. Focused
  presentation regressions pass **23/23**; the complete repository passes
  **347/347** and the pruned production build passes. Build label:
  `2026.07.28-quiet-focus-completion-beta-15-37`.
- Published from the isolated non-repository static directory
  `e1816fa1.scangrade.pages.dev` and promoted to `scangrade.io`. Production
  HTML and `index-Bbm1XX2G.js` are byte-identical to the tested build.
  `/api/submissions` returns that same static shell, confirming no dormant
  Pages Function is active.

## 2026-07-28 productive marking scheduler Beta 15.36

- Progressive marking can now overlap an already-enabled asynchronous,
  key-blind local verification pass. The verifier must declare the exact
  yellow and suspicious-accepted questions it is checking before animation
  begins. Questions outside that queue may receive teacher marks while the
  verifier works; queued questions remain withheld until their evidence
  settles.
- The scheduler is fail-closed. If a pending verifier does not declare its
  queue, no answer animates early. A timeout or unavailable verifier cannot
  invent, replace, or silently change a transcription.
- This is deliberately policy-neutral on public `scangrade.io`: the existing
  independent browser readers have not passed the prospective safety/device
  gate, so none was newly enabled. Public OCR decisions, confident coverage,
  yellow rate, capture, crops, homography, grading, and answer-key boundaries
  remain unchanged. The scheduler becomes productive automatically wherever
  the already-gated local verifier is explicitly enabled.
- The normal browser digit model was already warmed when the scan screen
  mounts, so no additional first-result delay was added. Build label:
  `2026.07.28-productive-marking-beta-15-36`.
- Direct scheduler tests cover deterministic queue union, safe-answer overlap,
  and undeclared-queue fail-closed behavior. The complete repository passes
  **345/345** and the production build passes.
- Published from an isolated, static-only 222-file directory at
  `bca456b4.scangrade.pages.dev` and `scangrade.io`. Production HTML and
  `index-BoqLr77d.js` are byte-identical to the tested build.
  `/api/submissions` returns the identical static shell.

## 2026-07-28 completion flow Beta 15.35

- The teacher-review sequence is now one stationary flow: automatic marks draw
  first, the first yellow answer receives focus automatically, subsequent
  yellows continue to auto-advance, the handwritten score draws after the last
  yellow is resolved, and the date lands last as the completion seal.
- The date is no longer shown during scanning or intermediate marking.
  Correction-animation bases explicitly remove the date from their exported
  intermediate raster, preventing it from flashing back before the score.
  The live completion animation reveals the exact date pixels from the final
  annotation, so switching to the settled sheet cannot move or re-typeset it.
- The date is modestly larger and has a restrained ink-landing effect.
  Manually entered teacher digits use a lighter 700-weight face with less
  duplicate-ink darkening.
- No worksheet panning is used by the live correction interface. The custom
  number keypad remains fixed above the lower action bar/QR area while the
  answer focus stays attached to its physical box.
- OCR, confidence, grading, capture, homography, answer geometry, and
  correction semantics are unchanged. The complete repository passes
  **341/341** and the production build passes. Build label:
  `2026.07.28-completion-flow-beta-15-35`.
- Published from an isolated, static-only 222-file directory at
  `fd7c8b46.scangrade.pages.dev` and `scangrade.io`. Production HTML and
  `index-D_a_Jh7y.js` are byte-identical to the tested build. The dormant
  `/api/submissions` route returns the identical static application shell,
  confirming that no repository Pages Function was included.
- Physical acceptance still required: one no-yellow page and one multi-yellow
  page on the current iPhone and five-year-old iPad. Confirm that first-yellow
  focus is automatic, the sheet remains stationary, the score waits for all
  corrections, and the date appears once at the end without shifting.

## 2026-07-27 camera-readiness state Beta 15.34

- A successful phone scan could still show “The camera is still getting
  ready.” beneath the completed worksheet. The camera and grading result were
  valid; only an earlier transient warning remained in application state.
- The successful capture path now explicitly clears readiness warnings. A
  narrow lifecycle guard also clears only “warming up” / “not ready” warnings
  when the browser supplies a drawable camera frame, a captured image, or a
  grading result. Blur, framing, QR, permission, and other real errors remain
  visible.
- Camera quality gates, capture thresholds, OCR, grading, annotations, and
  review behavior are unchanged.
- Four direct readiness-state regressions pass, the complete repository passes
  **339/339**, and the production build passes. Build label:
  `2026.07.27-camera-ready-state-beta-15-34`.
- The isolated 222-file static build is deployed at
  `https://a6cccd57.scangrade.pages.dev/` and `https://scangrade.io/`.
  Production serves the tested `index-OHq4Lrww.js`; `/api/submissions` is
  byte-identical to the static app shell, confirming that no Pages Function or
  Mac Mini route was deployed.

## 2026-07-27 transition-locked ink Beta 15.33

- Tony observed a small shift between the live blue-focus correction entry and
  the settled black correction, plus one non-reproducing score jump after an
  `8/8` finished writing.
- The live correction and settled worksheet now use the same Canvas renderer,
  physical slot rectangles, deterministic seed, tape geometry, font sizing,
  offsets, and rotation. The blue frame is only focus chrome; the black entry
  beneath it is already the exact settled ink, so advancing focus cannot
  re-typeset or reposition the number.
- The score jump had a concrete coordinate mismatch: the live writer placed
  the score from padded review regions while the settled Canvas used the raw
  answer-box rectangles. Both now call one shared `teacherScorePlacement`
  function with the raw physical answer boxes. Stroke geometry and placement
  are therefore identical before and after the final image swap.
- These are presentation-only changes. OCR, confidence, grading, capture,
  homography, answer placement, and correction semantics are unchanged.
- Focused transition tests pass **9/9**; the complete repository passes
  **335/335** and the pruned production build passes. Build label:
  `2026.07.27-transition-locked-ink-beta-15-33`.
- The isolated 222-file static build is deployed at
  `https://efaf7a50.scangrade.pages.dev/` and `https://scangrade.io/`.
  Production serves the tested `index-bsmFV8i1.js` and
  `index-CJo54A8l.css`; `/api/submissions` is byte-identical to the static app
  shell, confirming that no Pages Function or Mac Mini route was deployed.

## 2026-07-27 human score strokes Beta 15.32

- The completed-raster score mask was fundamentally unsafe for self-crossing
  handwriting: while an `8` was being uncovered, the mask could expose a
  spatially nearby but temporally future part of the lower loop. This produced
  the observed “bottom first, top materializes later” effect even though the
  underlying glyph point order was correct.
- The score is now drawn as actual coloured SVG pen paths in strict human
  order. Every `8` is one continuous top-first figure-eight; the first digit
  completes before the slash begins, and the slash completes before the next
  digit begins. The live writer and settled Canvas annotation share the same
  deterministic geometry, four felt-pen passes, widths, opacity, and seeded
  variation, so no completed-score fragment exists to leak through early.
- Before typing, the active correction cue is now a thin blue rectangular
  frame with restrained glow, aligned to the physical digit slot. A
  single-slot uncertainty in a two-digit answer frames only that digit. The
  interior remains transparent until entry, preserving the child's pencil.
- These are presentation-only changes. OCR, confidence, grading, capture,
  homography, answer placement, and correction semantics are unchanged.
- Focused stroke/focus tests pass **8/8**; the complete repository passes
  **332/332** and the pruned 222-file production build passes. Build label:
  `2026.07.27-human-score-strokes-beta-15-32`.
- The isolated static deployment is live at
  `https://8a67d755.scangrade.pages.dev/` and `https://scangrade.io/`.
  Production serves byte-identical `index-DoctASZ-.js` and
  `index-DjEGJ-hx.css`; `/api/submissions` resolves to the identical static app
  shell, confirming no Pages Function is active.

## 2026-07-27 visible-handwriting review Beta 15.31

- Tony correctly rejected Beta 15.30's opaque white active state because it
  covered the student's original handwriting before the teacher could inspect
  it.
- Before entry, the focused answer now has a transparent interior with a thin
  muted-blue oval and restrained halo. The student's pencil remains fully
  visible. As soon as the teacher enters a correction, that same layer changes
  to white correction tape and renders the replacement in black; the completed
  correction then remains in the marked sheet while focus advances.
- The transition changes only presentation. Correction semantics, auto-advance,
  OCR, grading, confidence, capture, and Beta 15.30 physical-box anchoring are
  unchanged.
- Focused correction tests pass **22/22**; the complete repository passes
  **331/331** and the pruned build passes. Build label:
  `2026.07.27-visible-handwriting-review-beta-15-31`.
- The isolated 222-file static build is deployed at
  `https://14b7ee72.scangrade.pages.dev/` and `https://scangrade.io/`.
  Production serves byte-identical `index-CAiburV0.js` and
  `index-D2TFvp4H.css`; `/api/submissions` remains the static app shell.

## 2026-07-27 physical-box-anchored review Beta 15.30

- Tony's physical Beta 15.29 screenshots showed the remaining placement limit:
  page registration could align most of a wrinkled sheet while an individual
  printed answer frame had moved locally. Highlights on a ten-frame answer and
  a single-digit right-column answer could therefore remain displaced.
- Visible teacher ink now follows the actually detected printed answer frame
  only when the complete page assignment establishes coherent structural
  trust. Partial detections, number-bond circles/lines, and isolated contours
  cannot acquire that authority and retain the page-registration fallback.
  OCR crops, recognition, confidence, grading, capture, homography, and
  answer-key handling are unchanged.
- The four-packet saved-camera replay processed the same **40 captures / 480
  answer slots** with unchanged OCR results. It selected trusted physical
  frames for 440 slots and the registration fallback for 40. All 32
  number-bond slots remained on fallback; no two-slot answer received mixed
  anchoring. Visual overlays of the largest corrections confirmed the green
  physical rectangles coincide with the printed boxes while the prior
  registration rectangles can be roughly one slot away on locally distorted
  pages.
- Manual correction focus no longer uses a filled blue layer. The active answer
  is the same opaque white correction tape used by the settled correction,
  plus only a thin muted-blue edge and very soft halo. Completed corrections
  remain white tape; advancing focus changes the subtle edge without replacing
  the tape or black entry.
- Focused placement/correction regressions pass; the complete repository passes
  **331/331** and the pruned production build passes. Build label:
  `2026.07.27-physical-box-anchored-review-beta-15-30`.
- The verified 222-file static build is deployed at
  `https://f41ee5d8.scangrade.pages.dev/` and `https://scangrade.io/`.
  Production HTML/JavaScript are byte-identical to the tested build
  (`index-27DDhp1W.js`), and `/api/submissions` remains the static app shell.
  Physical iPhone verification of the same single-digit and ten-frame cases is
  the remaining presentation check.

## 2026-07-27 registration-locked annotations Beta 15.29

- Tony's Beta 15.28 ten-frame screenshot showed question F's yellow review
  swipe displaced roughly one digit slot to the right of the printed answer
  frame. The manual black correction also disappeared for a moment between
  keypad entry and the new check/X animation.
- Root cause of the placement defect: the OCR/page-registration pipeline and
  the annotation pipeline held two rectangles for each answer. OCR used the
  rectangle calculated in the warp's authoritative registration coordinate
  system; annotation later recalculated normalized layout coordinates against
  the pristine canvas's slightly different dimensions. The latter can shift
  a mark even though recognition used the correct box.
- The page-registration rectangle is now the single annotation anchor carried
  through source-photo projection. The separately scaled layout rectangle is
  retained only as a missing-data fallback. This does not alter capture, OCR
  crops, transcription, confidence, grading, or answer-key handling.
- A geometry audit of the existing four-packet replay covered 480 answer slots.
  Relative to the independently detected printed frame, the median centre
  discrepancy falls from 0.399 slot widths to 0.115. The ten-frame median
  falls from 0.280 to 0.079; number bonds from 0.408 to 0.060; dot collections
  from 0.599 to 0.215. This comparison is a placement diagnostic, not an OCR
  accuracy claim.
- Manual correction animation now prepares a lossless base containing the
  settled black correction before the displayed result switches. Only the blue
  focus treatment disappears; the correction remains mounted while the new
  check/X draws. The redundant answer-reveal mask was removed.
- Direct geometry/continuity regressions pass; the complete repository passes
  **330/330** and the pruned production build passes. Build label:
  `2026.07.27-registration-locked-annotations-beta-15-29`.
- The final release was uploaded from an isolated non-git directory containing
  only the 222 built static files. Immutable deployment:
  `https://bb55143a.scangrade.pages.dev/`; production:
  `https://scangrade.io/`. Public HTML and JavaScript are byte-identical to the
  tested build (`index-C0kYCy0t.js`). `/api/submissions` is byte-identical to
  the static app shell, confirming that no storage/API route was exposed.

## 2026-07-27 slot-faithful correction preview Beta 15.28

- Tony's Beta 15.26 phone screenshots exposed a manual-entry presentation mismatch: the in-progress keypad text used a separate small/blue-looking preview before the permanent black correction appeared, and the first digit of a two-slot answer was centred across the complete box before moving when the second digit arrived.
- The on-sheet preview now uses the same black marker-style type family as the saved correction and renders one cell per physical answer slot. A two-slot entry therefore progresses `[2][ ]` to `[2][0]`; `_9` and `9_` preserve their physical blank side. There is no intermediate blue digit layer.
- Added a pure `correctionPreviewCells` helper and direct regressions for empty, partial, complete, and explicitly blank one-/two-slot entries.
- Recognition, OCR, confidence, grading, capture, homography, crop selection, answer-key handling, and final correction semantics are unchanged.
- Focused correction/layering verification passes **10/10**; the complete repository passes **328/328**; the pruned production build passes. Build label is `2026.07.27-slot-faithful-correction-preview-beta-15-28`.
- The verified isolated static build is deployed at `https://b49acf5a.scangrade.pages.dev/` and `https://scangrade.io/`. Production serves `index-BgUOh6Um.js`, which contains the exact Beta 15.28 build and physical-cell preview code; `/api/submissions` remains the static app shell.

## 2026-07-27 anchored source-photo annotations Beta 15.27

- Tony's live Beta 15.26 screenshots showed two remaining presentation defects: checks/highlights could still land far from their answer boxes on wrinkled or perspective-heavy source photos, and the date appeared during Scanning, disappeared during progressive Grading, then returned in the completed raster.
- Root cause of the placement defect: source-photo crop rectangles had already been transformed through the page homography, but `annotationRectForCrop` could apply the locally detected contour again in source space. Perspective axis-aligned bounds, bond lines, nearby circles, and wrinkles could turn that second adjustment into visible displacement.
- Source-photo teacher ink now uses only the transformed marker-derived printed-box anchor. OCR retains all refined/detected crops; recognition, confidence, grading, capture, homography, and answer-key handling are unchanged. Warped-sheet/debug annotation paths still retain bounded local correction.
- The scanning date SVG now remains mounted throughout progressive grading, so the date cannot vanish between its initial ink landing and the completed annotated raster.
- Direct source-projection and date-lifecycle regressions pass; the complete repository passes **327/327**; the pruned production build passes. Build label is `2026.07.27-anchored-photo-annotations-beta-15-27`.
- A repository-root Pages upload briefly detected dormant Functions and was immediately superseded by the isolated static-only deployment `https://8548a588.scangrade.pages.dev/`. Production `https://scangrade.io/` serves `index-DRwg2yAe.js`; `/api/submissions` is byte-identical to the static app shell, confirming no active backend.

## 2026-07-27 number-bond entry contract Beta 15.26

- Tony's physical-phone test of Beta 15.23 exposed a worksheet-contract mismatch: the number-bond layout printed one physical answer box for A/B/D/F, but its correction metadata still allowed two handwritten digits. The custom keypad therefore waited for a second key instead of completing the one-box correction and advancing.
- Corrected both shipped SG-G1-LW-08 layout copies to match the printed worksheet: A/B/D/F accept one keypad entry; the genuinely divided two-box answers C/E still require two explicit entries. This rule comes only from physical worksheet structure, never the mathematical answer key.
- Added direct contract regressions proving A completes after one digit while C does not. Recognition, transcription, confidence, grading, crops, capture, homography, and answer-key handling are unchanged.
- The first production verification also found stale app-shell and layout responses still pinned by browser/CDN caching. Added explicit no-cache response rules for HTML and mutable worksheet layout JSON while leaving hashed assets immutable.
- Verification: the complete repository passes **325/325**; the pruned production build passes. Build label is `2026.07.27-number-bond-entry-contract-beta-15-26`.
- The isolated static build was deployed to `https://d4f7b2af.scangrade.pages.dev/` and `https://scangrade.io/`. Production serves `index-Cv5yFhQA.js`; root and layout responses now return revalidation/no-store policies and the live number-bond contract is `[1,1,2,1,2,1]`.

## 2026-07-27 unified score strokes Beta 15.25

- Tony's physical-phone testing showed that the final handwritten score (for example `8/8`) could reveal disconnected fragments, then materialize or shift when the animation completed.
- Root cause: the SVG reveal mask and saved Canvas score independently rebuilt similar geometry. Canvas added segment offsets and smoothed curves while the SVG used unoffset straight lines, so the mask could expose the wrong portion of the already-rendered score.
- Added one deterministic `buildTeacherScoreStrokePlan` used by both the animated SVG mask and final Canvas ink. It owns character shape, stroke order, seeded position, tilt, scale, segment offsets, smoothed path, pen width, and timing. The SVG now follows the same quadratic centreline used by Canvas; every stroke waits for the previous stroke to finish.
- Reworked `8` as one continuous, ordinary handwritten figure-eight motion: start at the top, cross into the lower loop, return through the centre, and close the upper loop. It is not two separately appearing circles.
- Recognition, crops, grading, confidence, capture, homography, correction behavior, and answer-key handling are unchanged.
- Verification: focused stroke/ink/progressive tests pass **15/15**; the complete repository passes **324/324**; the pruned production build passes. Build label is `2026.07.27-unified-score-strokes-beta-15-25`.
- The isolated static build was deployed to `https://26ba57d9.scangrade.pages.dev/` and `https://scangrade.io/`. Both serve `index-C39q831_.js`; the production bundle contains the exact Beta 15.25 label. Physical verification of a completed score containing `8` remains pending.

## 2026-07-27 anchored review overlay Beta 15.24

- Tony's physical iPhone screenshots of Beta 15.23 showed two independent geometry defects: the blue selected-answer ring surrounded the padded tap target instead of the printed answer box, and several yellow marks wandered far outside their boxes on the source-photo annotation path.
- Root cause of the yellow displacement: source-photo projection transformed the detected crop rectangles but did not preserve a transformed deterministic layout rectangle. Without that reference, `annotationRectForCrop` had to accept even a badly displaced local contour. The source-photo projection now transforms and carries the layout rectangle with every crop, and annotation geometry preserves that precomputed source-space reference.
- The active correction state now uses the exact `focus*Pct` answer-box geometry rather than the padded hotspot. The oversized circular ring and redundant question-letter bubble are removed. Selection is shown by a restrained translucent light-blue rectangle clipped to the printed answer box.
- Keypad entry is black from its first rendered frame instead of flashing blue before the baked correction appears.
- Recognition, OCR crops, confidence, grading, capture, homography, and answer-key handling are unchanged.
- Verification: a direct source-projection regression reproduces a wildly displaced detected box and proves fallback to the transformed layout box; focused overlay tests pass **16/16**; the complete repository passes **321/321**; the pruned production build passes.
- Build label: `2026.07.27-anchored-review-overlay-beta-15-24`. The verified pruned build was deployed from an isolated static directory to `https://47f23f65.scangrade.pages.dev/` and `https://scangrade.io/`. Production and immutable HTML both reference exact assets `index-C7c60W4A.js` and `index-BBZqiYoJ.css`; the production bundle contains the Beta 15.24 label. Physical phone/iPad verification remains pending.

## 2026-07-25 continuous on-sheet review Beta 15.23

- Replaced the floating correction card and native iOS numeric field with a compact ScanGrade-owned keypad. It contains only digits `0–9`, `_` for a physically blank slot, and delete; it uses the same Lexend face as the ScanGrade wordmark and cannot show iOS phone letters or the black selection menu.
- The selected question is now identified directly on the worksheet by a blue focus outline and letter bubble. Teacher input appears in blue over the selected physical answer region as it is entered; there is no suggestion popup or Save button.
- One unresolved slot commits after one key. When two physical slots are unresolved, two explicit entries are required, so `_9`, `9_`, and `__` preserve left blank, right blank, and no answer without guessing the physical placement.
- After the teacher taps the first yellow, each completed correction automatically moves the worksheet focus to the next unresolved yellow while leaving the custom keypad available. It wraps in worksheet order, skips confidently wrong red answers, and closes only after the final yellow; the existing score-reveal gate then permits the handwritten score animation.
- Recognition, capture, crop, confidence, grading, and annotation policy were not changed. The optional private local-reader fallback remains reachable from the keypad only when its existing feature flag is enabled.
- Added deterministic keypad tests plus template/layering/continuous-advance contracts. Focused review verification passed 26/26, the complete repository passed **320/320**, and `npm run build` passed.
- Build label is `2026.07.25-continuous-yellow-review-beta-15-23`. The verified pruned build was deployed from an isolated static directory to `https://b22f4f5c.scangrade.pages.dev/` and `https://scangrade.io/`. Production HTML points to the tested `index-DPRfsZpu.js` asset, whose bundle contains the exact Beta 15.23 label and correction-keypad code. Physical review on Tony's current phone and five-year-old iPad remains required.

## 2026-07-24 whole-answer co-primary Candidate 2

- A new goal is active to build a Mac-independent, upload-free, zero-cost browser candidate with at least 90% automatic transcription and zero known confident errors. Public deployment remains separately gated by prospective evidence and physical-device validation.
- Added an isolated key-blind pre-acceptance coordinator in `src/v3/browser-local-co-primary.js`. It preserves the frozen 267/345 zero-error control, then allows only control yellows to clear through the existing 61.1 MiB preserved-grayscale reader. Answer-key, truth, mathematical-correctness, and teacher-correction fields fail closed.
- Candidate 1 used structural vetoes for weak full-answer confidence, high-risk disagreement, place-value `1/4`, high-support conflicts, and blocking ambiguity. Exact replay produced **297/345 automatic (86.1%), 297/297 matching handwritten truth, zero known confident errors, and 48 yellow**.
- A diagnostic audit of those 48 reviews found: 31 had a correct whole-answer proposal, five had a wrong proposal, 12 had no proposal, 47/48 contained the truth in at least one retained reader, and one P05 place-value answer was wrong in every retained reader. Blindly trusting the strong reader remains unsafe.
- Candidate 2 adds one narrow multiview lane: stitched and continuous whole-answer views must agree at confidence `>=0.90`, and either the deterministic uniform view or an exact three-of-three retained-frame read must corroborate the same complete answer. Explicit blocking vetoes still dominate.
- Exact 345-answer replay now produces **311/345 automatic (90.1%), 311/311 matching handwritten truth, zero known confident errors, 34 yellow**. Row coverage is 186/200 (93.0%); non-row is 125/145 (86.2%). P02/P03/P05/P08/P09 are 89.7%/100%/72.9%/95.7%/92.9%. No packet or layout family regresses from the frozen control.
- All 44 newly automatic transcriptions were visually inspected from saved context and/or stitched/continuous grayscale evidence. Each visibly matches the stored handwriting label. The private contact sheets are in `private-evidence/reports/browser-local-co-primary-candidate2-visual-audit/`.
- The decision boundary reproduced identically across 25 complete runs; SHA-256 is `3e1c6e0a435b6cabe03fcde21eef4a6b3cc1498d0e220d7aa8e2345a9dba8d06`.
- Verification passes: 8/8 focused co-primary tests, 237/237 complete repository tests, and `npm run build`.
- Added a production-shaped frozen-control/co-primary pipeline, a staged evidence planner, and an exact three-distinct-frame reducer. The pipeline reproduces all 345 frozen decisions exactly. A conservative planner gate requests three-frame inference only to corroborate an already repeated read, except for number bonds; it preserves exact parity and reduces frame-routed answers from 40 to 36. Weighted strong-model calls per 10-page corpus page are median 4, p90 17, maximum 30 when a frame check is counted as three inferences.
- Wired Candidate 2 into the existing explicit private `v3BrowserLocalCandidate=1` path only. The public default remains unchanged. A real saved P05 number-bond page completed in headless WebKit with no non-read requests/uploads, persistent session reuse, exact expected decisions, 1.274 s model initialization, and 8.193 s for ten strong-reader views. The one-photo replay had no retained burst and correctly failed open for its one requested frame check.
- Current verification after the integration: 251/251 repository tests pass, the production build passes, the 345-answer pipeline parity is exact, the 25-run determinism hash is unchanged, and the freeze verifier passes. The freeze is `private-evidence/reports/browser-local-co-primary-candidate2-freeze-20260724.json`; it explicitly says `publicDeploymentAuthorized: false`.
- Tested dynamic four-answer encoder batching in real WebKit. It is rejected: elapsed time improved only from 3.498 s to 3.395 s, token probabilities drifted by as much as 0.0863, and one authentic answer changed from the correct `6` to `7`. Report: `private-evidence/reports/browser-local-batch-webkit-probe-20260724.json`. Do not batch this model.
- Important live-integration gap: the explicit private candidate currently starts after the Beta payload is assigned to `ocrResult`, then may update it. That is not yet the required pre-acceptance architecture even if progressive animation often hides the delay. Before public consideration, routed answers must remain unsettled/yellow until their final local decision; an accepted mark must never be silently changed after presentation.
- **Do not deploy this result yet.** The veto vocabulary and multiview lane were informed by the same five packets, the corroborating views share a model family, P05 remains materially worse, and sustained physical current-phone/five-year-old-iPad performance is still unmeasured. This is a successful retrospective research gate, not a launch claim.
- Reproducers/reports: `scripts/evaluate_browser_local_co_primary.mjs`, `scripts/audit_browser_local_co_primary_residuals.mjs`, `scripts/verify_browser_local_co_primary_determinism.mjs`, `scripts/build_co_primary_candidate2_visual_audit.py`, `private-evidence/reports/browser-local-co-primary-candidate2-20260724.json`, and `private-evidence/reports/browser-local-co-primary-candidate1-residual-audit-20260724.json`.

## 2026-07-24 browser-local 90% goal completion audit

- Re-ran the authoritative exact-live uniform/frame union twice from the current worktree. Both runs reproduced **267/345 automatic (77.4%), 267/267 matching handwritten truth, zero known confident errors, 78 yellow**, with zero accepted transcriptions replaced and no answer-key use.
- After removing only the timestamp, both reports had the identical SHA-256 `01bc798df020e3adbfcc9e29dd4123dcc350201e61f906911cea48575d0e57ad`.
- Added an immutable v2 research freeze plus verifier because a fresh analyzer timestamp invalidated the earlier byte-level report hash even though all decisions were identical. `node scripts/verify_exact_live_union_freeze.mjs` now checks the exact report, timestamp-independent decision fingerprint, analyzer, diagnostic audit, metrics, no-replacement invariant, and answer-key blindness; every check passes.
- Re-ran the complete repository test suite after adding the verifier: 229/229 passed. `npm run build` also passed.
- Confirmed the tailnet physical-device probe is still reachable at `https://hobbes-mac-mini.tail9a3379.ts.net/local-model-probe/`.
- Completed a requirement-by-requirement audit in `docs/SCANGRADE_BROWSER_LOCAL_90_GOAL_AUDIT_20260724.md`. The frozen lower frontier is recorded in `private-evidence/reports/exact-live-uniform-frame-union-policy-freeze-v2-20260724.json`.
- The 90% gate remains failed. Public recognition must remain unchanged. The strongest lower zero-error frontier is research-only because it is retrospective, P02/P05 remain at 64.7%/61.4%, non-row coverage is 67.6%, and physical current-phone/old-iPad inference endurance is still missing.
- Cheapest decisive next experiment: freeze current evidence, train/adapt a genuinely independent whole-answer model using historical development data only, freeze the selector before labels, and test prospectively on new September writers/packets. Do not continue threshold-searching the same 345 labels.

## 2026-07-24 browser-local prospective gate (current continuation)

- Added `docs/SCANGRADE_BROWSER_LOCAL_PROSPECTIVE_GATE_20260724.md`, a candidate-neutral protocol for a future browser-local reader. It freezes code/model/policy/frame identities before predictions or labels are opened; requires prediction-blinded double handwriting labels; preserves packet/student/template separation; and requires the 90%/zero-error gate again on final holdout material.
- Added `scripts/freeze_browser_local_prospective_candidate.mjs` with `tests/freeze-browser-local-prospective-candidate.test.mjs`. It creates a write-once hash manifest for a declared browser-local candidate and fails closed on answer-key/truth/expected-value/correction-shaped input. It does not score, alter, or open packet evidence, and it always records `publicDeploymentAuthorized: false`.
- It explicitly preserves the public Beta 15.3 interface while prohibiting the obsolete P05 private/Mac freeze from being reused as authority for a new browser-local candidate.
- Focused safety tests passed 14/14 (`v3-browser-local-co-primary-candidate7`, flexible optional blank, and optional-slot scout). `npm run build` passed. This validates code health only; it does not raise the 77.4%/77.7% exact-live coverage or authorize a recognition deployment.
- Repaired a private-candidate lifecycle ordering gap in `CameraCapture.vue`: the pre-acceptance whole-answer promise is now awaited before `ocr-complete` is emitted. The UI already withheld the provisional Beta result for this explicit private path; the completion event now cannot expose `null` or fire before the candidate's final decision/fail-open Beta result. `tests/v3-browser-local-preacceptance-lifecycle.test.mjs` locks the ordering. This does not change the public Beta 15.3 path or recognition decisions.
- Extended the harmless fixed-image local-model device probe with persistent-session evidence and a deliberate missing-decoder recovery action. The phone/iPad order is now 8-answer cold run, 40-answer endurance run, then recovery; reports include transfer timing, init/reuse status, inference timing, parity, available memory proxy, and a no-upload marker. `tests/browser-local-device-probe-contract.test.mjs` locks the contract. It still requires the founder to run it physically; no student capture or public recognition behavior changed.
- Added `scripts/score_browser_local_prospective_candidate.mjs` with `tests/score-browser-local-prospective-candidate.test.mjs`. It verifies the candidate freeze's exact source/model identities, requires prediction-blinded verified handwriting truth, keeps transcription separate from yellow/math/correction state, writes a single immutable report, and fails closed on answer-key/expected-value/correction-shaped input. It reports packet/student/template/layout/length/capture-quality strata and refuses overwrite. This replaces the obsolete P05-only scorer for any future browser-local candidate; it has not scored or opened any untouched packet.
- Final post-infrastructure integrity pass: `node scripts/verify_exact_live_union_freeze.mjs` revalidated the authoritative 267/345 zero-error/no-silent-replacement/key-blind frontier. Complete repository regression passed **296/296** and `npm run build` passed. Therefore the prospective/device/pre-acceptance infrastructure did not change the frozen recognition control or authorize a deployment.
- Remaining unopened student packets remain sealed. The next non-overfit recognition move is a genuinely independent reader trained/calibrated on declared historical partitions, frozen with this gate, then prospectively evaluated on new September writers/packets.

## 2026-07-24 independent browser reader and exact-preservation audit

- Classified all 78 yellows in the authoritative 267/345 exact-live union. At least one retained reader contains the labelled transcription for 77/78 and at least two do for 71/78; only one is unread correctly by every retained reader. The bottleneck is safe selection, not usually missing pixels. Capture quality still matters: the 78 reviews split into 27 poor, 29 fair, and 22 good captures.
- Screened Texo FormulaNet as an external whole-answer reader. It is AGPL-3.0 and unsuitable for the planned commercial browser product without separate licensing; accuracy was also unusable: 43/345 (12.5%) on stitched answer evidence. Reject.
- Screened the official Apache-2.0 PaddleOCR.js PP-OCRv6-small model in real Playwright WebKit, entirely browser-local with no image uploads. Its default detection-plus-recognition path read 224/345 (64.9%) correctly after about 4.18 seconds initialization. Feeding the preserved stitched answer directly into recognition improved raw top-one to 242/345 (70.1%) and reduced the 345-answer run to 25.5 seconds after about 4.34 seconds initialization. The text detector was a measurable loss, but the recognizer is still not a primary reader.
- Direct PP-OCRv6 recognition and the 61.1 MiB stitched reader shared a confident `30→32` error (P09 number pattern Q5; PP-OCR score 0.986). Confidence or model-family agreement is not a safety proof. The standalone recognition archive is about 21.3 MB, so adding it to the 61.1 MiB reader is also expensive for the tiny legitimate gain.
- Tested the cheapest credible PP-OCR adaptation without retraining its 21.2 MB visual model. Extracted its frozen 40-step blank/digit/non-digit probabilities for 923 authentic answer zones, then trained a tiny slot/layout-aware decoder on 328 historical development examples and selected it only on 136 historical validation examples. Historical holdout contained 114 examples; all 345 recent labels and all five recent packets were excluded from training and model selection.
- The adaptation failed prospectively and reproducibly. Raw recent top-one was 233/345 (67.5%). A zero-error threshold selected on historical validation accepted 60/345 recent answers but made five confident errors, all above 0.99997. Exact agreement with TrOCR accepted 55/345 and still shared the P09 `30→32` error. Repeated runs produced the identical report SHA-256. Reject frozen-feature calibration and do not export or integrate it.
- Critical integrity correction: a first second-reader analysis incorrectly compared against a reconstructed `evidence.browserRead` field. On some pages that differs from the exact live predecessor transcription. That produced an apparent 311/345 (90.1%) result by silently changing accepted reads and is invalid.
- The corrected preservation-only evaluator uses `initialRead`, the exact transcription originally accepted by live WebKit. It restores only four answers, two of which are confident errors (`15` versus handwritten `5`, and `32` versus handwritten `30`). Result: 271/345 (78.6%) with two confident errors. The preservation repair fails and must not be integrated.
- The strongest legitimate no-replacement candidate therefore remains **267/345 automatic (77.4%), 267/267 correct, zero known confident errors, 78 yellow**. A second reader may still demote suspicious accepts, but it cannot close the coverage gap while the initial browser transcription is weak.
- The next architecture must make the 61.1 MiB preserved-grayscale model part of the initial transcription decision before a result is presented as accepted. That is not yet safe: stitched raw top-one is 325/345 (94.2%) with 20 errors; simple packet-held-out consensus is 255/345 with three P05 errors; the historical-only ambiguity head also made a P05 error. No recognition change was integrated, committed, pushed, or deployed.
- New reports/reproducers: `private-evidence/reports/exact-live-uniform-frame-union-yellow-gap-20260724.json`, `private-evidence/reports/external-texo-formulanet-stitched-screen-20260724.json`, `private-evidence/reports/external-paddleocrv6-small-stitched-webkit-screen-20260724.json`, `private-evidence/reports/external-paddleocrv6-recognition-only-stitched-webkit-screen-20260724.json`, `private-evidence/reports/external-paddleocrv6-recognition-only-frontier-20260724.json`, `private-evidence/reports/paddle-digit-head-historical-only-20260724.json`, `private-evidence/reports/browser-preservation-second-reader-candidate-20260724.json`, `scripts/audit_exact_live_union_yellow_gap.mjs`, `scripts/analyze_external_paddleocr_frontier.mjs`, `scripts/evaluate_paddle_digit_head.py`, and `scripts/evaluate_browser_preservation_second_reader.mjs`.

## 2026-07-23 retained three-frame browser-local consensus result

- Reconstructed all three retained camera frames for every canonical P05 page through the unchanged browser crop pipeline, producing 210 independently cropped answer-frame views for 70 hand-labelled answers. The exact 61.1 MiB persistent deterministic WebKit reader completed 210/210 in 135.4 seconds. No image was uploaded and the mathematical answer key was not used for recognition.
- This closes the decisive evidence gap in the earlier four-packet frame-consensus audit. Across all five packets, 169/345 labelled answers have equivalent three-frame evidence; 74 of those are yellow under the strongest legitimate exact-live candidate.
- Critical eligibility repair: the first combined analyzer incorrectly allowed a browser-accepted transcription to become eligible for a different strong-model transcription after the safety cascade demoted it to yellow. That recreated the prohibited silent-replacement path. The report and analyzer now require the answer to have been yellow in the frozen browser predecessor before any alternate transcription may be promoted.
- Under the repaired invariant, exact three-of-three text agreement at minimum token probability 0.90 produces the strongest zero-known-error frame frontier: **266/345 automatic (77.1%), 266/266 matching handwritten truth, zero known confident errors, and 79 yellow**. It adds only five legitimate original-yellow rescues. P05 gains none and remains 42/70 (60.0%).
- The looser frame rule that looked safe on P02/P03/P08/P09 fails on P05 and also proposes prohibited replacements. Same-model agreement cannot be treated as independent evidence merely because the camera frame changed.
- Combined the repaired frame lane with the uniform/full-box lane on the authoritative exact-live candidate. The union preserves every accepted transcription, promotes only original yellows, and reaches **267/345 automatic (77.4%), 267/267 correct, zero known confident errors, and 78 yellow**. It adds six answers total: five frame rescues plus one P05 number-bond uniform/continuous rescue.
- Visually inspected all six legitimate changed decisions across stitched, continuous, and uniform evidence; all visibly support the selected transcription. Contact sheet: `private-evidence/reports/exact-live-uniform-frame-union-visual-audit-20260723.png`. Authoritative union report: `private-evidence/reports/exact-live-uniform-frame-union-20260723.json`.
- Conclusion: once the no-silent-replacement product rule is enforced correctly, multi-frame and uniform evidence do not come close to 90%. The strongest legitimate exact-live union is 77.4%, research-only, repeatedly tuned on the same corpus, and not deployable. The decisive next evidence is a materially stronger independent primary recognizer plus new prospective writers/packets—not another same-corpus threshold search.
- Reproducers: `scripts/replay_p05_burst_frames.mjs`, `scripts/build_p05_burst_stitched_manifest.py`, `scripts/analyze_all_packet_frame_consensus.mjs`, `scripts/analyze_exact_live_uniform_frame_union.mjs`, and `scripts/build_exact_live_union_contact_sheet.py`.

## 2026-07-23 founder-approved two-box one-digit rule

- Tony confirmed the classroom instruction: when a printed answer area has two digit boxes but the student's answer contains one digit, that digit is valid in either physical box.
- The shared local contract now treats `_9` and `9_` as the same semantic transcription `9` for grading. The recognition and annotation layers still preserve which physical box the student actually used.
- The default rule does **not** silently broaden `9` to `09`; a leading-zero form remains valid only when a worksheet explicitly declares it.
- Genuine two-digit answers still require both digits in the correct order. OCR must still identify the written digit and may not use the answer key to choose it.
- Verification: 228/228 repository tests passed, production build passed, 33 layouts audited with zero errors, and all 35 one-digit/two-box groups across the shipped launch-layout sources accepted both physical placements with zero contract violations.
- This rule is verified locally but has not independently authorized deployment of the unfinished browser-local recognition candidate.

## 2026-07-23 compact teacher-feature distillation conclusion

- Extracted deterministic 768-dimensional encoder features from the exact 61.1 MiB stitched-view reader for 923 authentic answer crops (historical development/validation plus P02/P03/P05/P08/P09). Each recent packet was excluded from gradients in its held-out fold; historical validation selected epochs. Mathematical answer keys were never model inputs.
- Teacher-feature distillation materially improved the 17 MiB MobileNetV3-Large whole-answer student from 249/345 (72.2%) to 281/345 (81.4%). Two bounded feature weights produced 286/345 (82.9%) and 285/345 (82.6%). The best result remained only 50/68 (73.5%) on P02, 52/70 (74.3%) on P05, and 112/145 (77.2%) on non-row layouts.
- The best MobileNet student agreed with the strong stitched reader on 284 answers, but four shared readings were wrong: P02 number bond `6→7`, P05 place value `47→17`, P08 reversed `9→5`, and P09 number pattern `30→32`. The latter three included student confidences from 0.862 to 0.995. This model is not an independent ambiguity detector; confidence or agreement cannot make it safe.
- Screened a genuinely different browser-sized ImageNet-pretrained EfficientNet-B0 backbone (4.14M inference parameters, roughly the same 16–17 MiB class). Before distillation it scored 254/345 (73.6%). Packet-held-out feature distillation reached 287/345 (83.2%) and improved non-row raw accuracy to 118/145 (81.4%), but P05 fell to 48/70 (68.6%). It shared seven wrong readings with the strong reader, including `49→14` at 0.998, `47→17` at 0.987, reversed `9→5` at 0.943, and `30→32` at 0.996.
- Reject both compact backbones as primary readers and safety selectors. They demonstrate that teacher features help small models, but the remaining errors are correlated, confident, and packet-dependent. Do not export, wire, threshold-tune, or deploy either model.
- Authoritative reports: `private-evidence/reports/v3-stitched-feature-distillation-crossfit-w010-seed97-20260723.json`, `private-evidence/reports/v3-stitched-feature-distillation-consensus-w010-seed97-20260723.json`, `private-evidence/reports/v3-efficientnet-b0-feature-distillation-crossfit-w010-seed97-20260723.json`, and `private-evidence/reports/v3-efficientnet-b0-feature-distillation-consensus-w010-seed97-20260723.json`. Reproducers: `scripts/extract_trocr_teacher_features.py`, `scripts/evaluate_v3_stitched_feature_distillation_crossfit.py`, and `scripts/analyze_v3_feature_distillation_consensus.py`.
- Tested a tiny key-blind ambiguity head on the frozen strong-reader encoder representation, token confidence, predicted length, and row/non-row metadata. Leave-one-recent-packet-out crossfit found 67/345 strong reads at zero errors and would add 11 correct answers to the exact-live cascade (272/345, 78.8%), but that training boundary still learns from sibling recent packets. The stricter model trained only on historical development and selected only on historical validation accepted 37/345 recent reads (10.7%) and made one confident P05 dot-collection `8→6` error. Reject the head; the crossfit gain does not generalize prospectively.
- Ambiguity-head reports/reproducers: `private-evidence/reports/trocr-embedding-ambiguity-crossfit-seed109-20260723.json`, `private-evidence/reports/trocr-embedding-ambiguity-historical-only-seed131-20260723.json`, `scripts/evaluate_trocr_embedding_ambiguity_crossfit.py`, and `scripts/evaluate_trocr_embedding_ambiguity_historical_holdout.py`.
- The strongest legitimate actual-code candidate remains 261/345 automatic (75.7%), 261/261 correct, zero known confident errors, and 84 yellow. The 90% gate is still unmet; public recognition must remain unchanged. New authentic writers/packets are now more valuable than another compact-backbone or same-corpus threshold search.

## 2026-07-23 exact-live primary-reader and scout conclusions

- Reconstructed the exact live WebKit public-model baseline from all 50 saved pages / 345 hand-labelled answers. The current default digit-model pair initially accepts 293/345 (84.9%) but only 225/293 accepted reads match handwriting; 68 are confident transcription errors. This is a recognition/transcription comparison only and never uses mathematical correctness as handwriting truth.
- Also replayed the older query-overridden lightweight digit pair that many historical scripts had used. It accepts 303/345 (87.8%) but has 80 confident errors. It is worse than the actual current default and must not be treated as a hidden upgrade. Authoritative report: `private-evidence/reports/browser-ocr-primary-pair-control-authoritative-20260723.json`.
- Tested the 7.7 MiB whole-slot scout alone against the actual live WebKit outputs for every accepted browser answer. Requiring any scout agreement leaves 203/345 automatic (58.8%) and still five confident errors. No disagreement-only threshold reaches zero errors because the browser and scout share five wrong reads. Even a retrospectively optimized scout-confidence rule reaches only 93/345 (27.0%) at zero errors. The scout is a useful router but is conclusively not a safe standalone reader. Report/evaluator: `private-evidence/reports/exact-live-scout-only-frontier-20260723.json` and `scripts/analyze_exact_live_scout_only_frontier.mjs`.
- The legitimate exact-live scout + routed 61.1 MiB strong-reader candidate remains 261/345 automatic (75.7%), 261/261 correct, zero known confident errors, and 84 yellow. It catches all 68 initial confident errors, introduces none, promotes 40 previously yellow answers, and never silently replaces a browser-accepted transcription. This remains the strongest implemented actual-code zero-error candidate.
- Evaluated the 61.1 MiB larger-grayscale reader as a possible initial primary source on all 345 labels. Raw stitched top-1 is 325/345 (94.2%), so readable information exists, but it includes 20 errors, including errors at 0.997 confidence. Continuous is 286/345, uniform is 276/345, scout is 236/345, and raw browser text is 235/345.
- Exhaustive simple key-blind voting across stitched, continuous, uniform, scout, and browser sources finds only 250/345 (72.5%) at zero errors, requiring unanimity among the three large-reader views. Leave-one-packet-out policy selection reaches 255/345 (73.9%) with three confident P05 errors. The raw model has a 94.2% oracle ceiling, but simple agreement/confidence cannot identify the safe subset. Report/evaluator: `private-evidence/reports/strong-primary-consensus-frontier-20260723.json` and `scripts/analyze_strong_primary_consensus_frontier.mjs`.
- Runtime remains promising on capable WebKit. A new 40-answer sustained Playwright-WebKit run of the exact 61.1 MiB package passed token parity, initialized in 1.317 s, then ran at 0.630 s/answer (p90 0.634 s), completing in 25.21 s. Earlier two-call persistence initialized once and reused the session; forced missing-model failure returned no reads and recovered with a fresh correct session. Safari/WebKit does not expose a trustworthy memory counter, so physical phone and five-year-old-iPad peak-memory/endurance remain required. New report/harness: `private-evidence/reports/browser-local-trocr60-device-probe-40-webkit-20260723.json` and `scripts/run_trocr_device_probe_playwright.mjs`.
- Ran the requested structurally different 15–30 MB preliminary model screen instead of repeating the weak 6–21 MB designs. An ImageNet-pretrained MobileNetV3-Large adapted to the whole grayscale answer zone has 4.33M parameters and a 17 MiB checkpoint. It scored 203/275 (73.8%) on P02/P03/P08/P09 and 46/70 (65.7%) on P05, or 249/345 (72.2%) overall. Exact agreement with the 61.1 MiB stitched reader retained only 249/345 and still shared six wrong reads, including reversed-`9`, `30→32`, and P05 place-value traps. Reject it as primary reader and ambiguity detector; packet-crossfit/export are not justified. Reports: `private-evidence/reports/v3-mobilenet-large-pretrained-seed83-20260723.json` and `private-evidence/reports/v3-mobilenet-large-pretrained-seed83-p05-20260723.json`.
- The current strongest legitimate candidate therefore does **not** meet the 90% gate. Do not deploy a recognition-policy change. The next model experiment must be structurally different and packet-held-out—teacher feature/logit distillation on the successful stitched evidence or new September data—not another threshold search, the weak 7.7 MiB scout, or the already-falsified 21 MiB residual model.

## 2026-07-23 critical correction — 93.6% frontier was invalid

- The previously recorded 323/345 (93.6%) uniform-consensus frontier is **not a valid implementation candidate**. Its analyzer incorrectly passed the cascade's post-demotion state into a "yellow-only" promotion rule. That made browser-accepted answers eligible for a different local-model transcription after the safety cascade demoted them.
- Twelve such decisions were silently replaced. Although all twelve happened to match the already-known labels, this violates the active goal and product principle: a second reader may demote a suspicious accepted browser transcription to teacher review, but it may not silently substitute a different transcription.
- Repaired `scripts/analyze_browser_local_uniform_consensus_frontier.mjs` to use the frozen predecessor's automatic state. Under the correct invariant, the offline mixed-evidence frontier is 312/345 automatic (90.4%), 312/312 correct, but P05 is only 45/70 (64.3%) and therefore fails the no-material-packet-regression gate. It adds only one legitimate previously-yellow number-bond rescue.
- More importantly, the authoritative exact-capture live WebKit replay of the actual integrated public-model baseline remains the controlling evidence: 261/345 automatic (75.7%), 261/261 correct, zero known confident errors, and 84 yellow. It contains no accepted silent replacements. Its initial browser replay had 68 confident transcription errors, so a preserve-or-demote second reader cannot mathematically reach 90% coverage without first making the primary recognizer materially stronger.
- Do not integrate the generalized 12-answer offline lane, cite 93.6% as achieved, or deploy on that basis. The next technical route is a genuinely stronger primary browser-local recognizer/candidate selector, while preserving disagreement-to-review and all answer-key-blind safeguards.

## 2026-07-23 two-box / one-digit placement rule (local, not deployed)

- Tony confirmed the classroom rule: when a problem whose answer is one digit has two printed digit boxes, the response is correct whether the student writes that digit in the left or right box.
- Added one shared answer-placement contract in `src/v3/answer-placement-contract.js`. It treats `_9` and `9_` as the same semantic transcription `9` for grading, while retaining the occupied physical slot for overlays and teacher correction. The default contract does not silently broaden `9` to written `09`; that requires explicit worksheet metadata.
- The shared contract merges the rule with layout metadata, so incomplete/older metadata cannot accidentally make only one side valid. It does not use the answer's digit to choose an OCR reading; it only defines accepted physical placement for a known one-digit worksheet response.
- Flexible blank cleanup now inherits the same contract, so the unused companion box may be cleared without highlighting when the other slot contains the independently detected written digit. True two-digit answers still require both ordered digits.
- Verified all 35 one-digit/two-slot questions across the currently shipped layout directories: all 35 support either placement. The complete repository regression passes 228/228, the production build passes, and the 33-layout audit reports 0 errors.
- This patch is local only. It has not been committed, pushed, or deployed; public `scangrade.io` remains unchanged while the larger browser-local candidate goal is active.

## 2026-07-23 browser-local 90% goal — fourth checkpoint (superseded by critical correction above)

- Corrected a device-dependent grading-animation inconsistency: `CameraCapture.vue` no longer suppresses the initial pen strokes or manual-correction stroke when iOS Reduce Motion is enabled. ScanGrade now uses the same one-question-at-a-time drawn marking sequence on both phones. Added a regression contract, bringing the suite to 200/200; production build passes. This UI-only change has not been deployed.
- Generalized the uniform answer-key-blind crop path from number bonds to all ten frozen worksheet layouts and all 345 scorable labelled answers. For each page it generates clean simple-scale and saved-homography views and selects only by printed four-sided frame containment. It never uses OCR output, handwriting truth, or the mathematical answer to select pixels.
- The exact 61.1 MiB persistent deterministic WebKit reader completed all 345 uniform views in 229.46 seconds and read 276/345 correctly as raw top-1. Raw accuracy is not the purpose; the view is used only as a routed independent crop check after the stitched and continuous views.
- Frozen research rule: an existing yellow may clear only when the uniform and continuous reads agree at >=0.90 confidence and the stitched view gives the same text. For number bonds, where the stitched crop is known to clip handwriting, the repaired uniform and continuous views may agree at >=0.90 without stitched agreement. Answer-key-shaped fields are rejected, blocking safety vetoes dominate, and the lane never changes an already-automatic answer.
- The originally recorded **323/345 automatic (93.6%)** result is invalid for implementation because the analyzer accidentally made safety-demoted browser answers eligible for silent replacement. See the critical correction at the top of this handoff.
- The uniform view blocks both discovered consensus traps: P08's reversed `9` is read `9` instead of the other views' wrong `5`, and P09 number-pattern Q5 is read `30` instead of the other views' unanimous wrong `32`. This is why the full-box view is a safety source, not merely a way to promote more answers.
- Visually inspected all 12 newly automatic decisions across stitched, continuous, and uniform views. Each proposed transcription is visibly supported; no answer-key reasoning is needed. Contact sheet: `/tmp/browser-local-uniform-consensus-changed-20260723.jpg`.
- Identical-input determinism passes at both stages. A complete second crop-generation run reproduced 345/345 selected views and PNG SHA-256 hashes exactly. A second WebKit inference run reproduced all 12 changed texts and token probabilities exactly. Reports: `private-evidence/reports/browser-local-uniform-affine-reproducibility-20260723.json` and `private-evidence/reports/browser-local-trocr60-uniform-consensus-changed-replay-webkit-20260723.json`.
- A routed implementation needs only 13 possible uniform-lane calls after cheaper gates, not 345. The predecessor cascade makes 224 strong-reader calls over 50 pages; this extra lane adds at most about 0.65 seconds for the small subset of pages that reach it on Mac WebKit SIMD. Initial browser results remain independent and can appear around the existing four-second target while checks run inside the grading animation.
- Reproducers: `scripts/build_uniform_number_bond_affine_manifest.py` (now layout-parameterized), `scripts/merge_uniform_affine_manifests.mjs`, `scripts/analyze_browser_local_uniform_consensus_frontier.mjs`, `scripts/verify_uniform_affine_reproducibility.mjs`, and `scripts/build_uniform_consensus_contact_sheet.py`. Candidate policy module: `src/v3/uniform-local-consensus.js`; it is isolated and not wired into production.
- Complete repository regression after the generalized rule and animation consistency repair passes 200/200 and the production build passes.
- This is still retrospective and repeatedly examined data. It is not deployment authorization or a public reliability claim. Physical current-iPhone and five-year-old-iPad endurance, memory, and thermal results remain missing, and September work is the prospective falsification set. Public `scangrade.io` remains unchanged Beta 15.3.

## 2026-07-23 browser-local 90% goal — third checkpoint (active, not deployable)

- Built a uniform, answer-key-blind number-bond crop path across all 28 scorable number-bond answers in P02/P03/P05/P08/P09. It compares two deterministic clean views—the original capture scaled to worksheet coordinates and the saved-homography canonical view—using only four-sided printed-frame containment. It never uses handwriting truth, OCR output, or the mathematical answer to choose a view. Reproducer: `scripts/build_uniform_number_bond_affine_manifest.py`.
- The exact 61.1 MiB persistent deterministic WebKit reader completed 28/28 new number-bond views in 19.07 seconds and read 21/28 correctly. The total is unchanged from the old stitched view, but all four previously visually unsafe promotions are now complete and legible and independently read correctly: P03 Q3 `14`, P08 Q3 `14`, P08 Q4 `6`, and P08 Q5 `17`.
- A predeclared narrow geometry lane allows a yellow number-bond answer to clear only when the complete-box view and the existing continuous view agree and both have at least 0.90 confidence. It promotes exactly P05 Q3 `14` and Q4 `6`. The combined retrospective result is **313/345 automatic (90.7%), 313/313 correct, zero known confident errors, and 32 yellow**. P05 improves only to 46/70 (65.7%), so the aggregate target passes while the packet/generalization gate still fails. Reproducer: `scripts/analyze_uniform_number_bond_geometry_lane.mjs`; report: `private-evidence/reports/browser-local-number-bond-geometry-lane-20260723.json`.
- A broader two-reader consensus is unsafe. It would accept P08 number-bond Q1 as `5` although the handwriting label is `9`; the uniform complete-box view correctly reads `9` and exposes the trap. Three-reader agreement is also not sufficient globally: P09 number-pattern Q5 is unanimously but wrongly read `32` instead of `30`. Do not add a broad consensus override merely to improve P05.
- Exact 61.1 MiB persistence/recovery was rechecked in WebKit with correctly aligned P05 evidence. One two-call/four-answer run initialized once in 393 ms, reused the same session for the next three answers, completed all four correctly in 2.99 seconds, and inferred at about 0.63–0.67 seconds/answer. A forced missing-model load returned partial/zero completed reads, reset safely, and the next valid request recovered with a fresh correct session.
- A forced no-SIMD eight-answer WebKit run completed 8/8 correctly but took 24.50 seconds: about 2.99 seconds per answer versus about 0.65 seconds with SIMD. This is too slow for the intended grading animation. Added an isolated fail-closed capability-tier candidate: no SIMD, reported memory below 4 GB, model error/timeout, or a first check above 2.5 seconds retains conservative browser OCR and more yellow; a measured fast SIMD runtime may use the persistent local reader. This module is not wired into production.
- The 61.1 MiB cascade's routed workload is median four strong-reader calls/page, p90 eight, maximum 11. On the Mac WebKit SIMD path this is roughly 2.6 seconds median additional checking after a one-time ~0.4-second initialization, which can plausibly fit inside the grading animation; no-SIMD would be roughly 12 seconds median and must not be enabled.
- After the uniform crop, geometry-lane, persistence, recovery, and capability-tier additions, the complete repository suite passes 195/195 and the production build passes. These remain isolated experiment paths; no production recognition policy or public deployment changed.
- Physical current-iPhone and five-year-old-iPad endurance results remain required. The private probe remains `https://hobbes-mac-mini.tail9a3379.ts.net/local-model-probe/`. Until both device runs are saved and the P05/generalization concern is resolved prospectively, do not integrate, deploy, market, or claim the 90.7% retrospective result. Public `scangrade.io` remains Beta 15.3.

## 2026-07-23 browser-local 90% goal — second checkpoint (active, not deployable)

- Active goal: a Mac-independent, upload-free public candidate targeting at least 90% safe automatic coverage on all 345 scorable labels, with zero known confident transcription errors. Public Beta 15.3 remains unchanged.
- The 7.7 MB scout alone is conclusively insufficient as a safety veto. On the 312 accepted answers produced after removing the over-broad Beta 7 veto, vetoing every scout disagreement left 218 automatic (63.2% overall coverage) and still five confident errors. Near 90% coverage it caught only two of 20 errors and left 18.
- Ran the 84 MB FP16-encoder/int8-decoder browser-local TrOCR-small package from the Rugged-drive backup against all 70 P05 stitched answer images. Chromium completed 70/70 in 107.85 seconds with 56/70 top-1 reads matching handwriting (80.0%).
- Repeated the same 70-answer run on the preserved continuous grayscale view. Chromium again completed 70/70 in 107.42 seconds with 56/70 top-1 accuracy, but 15 reads differed between the two views.
- As a demotion-only safety reader on P05's 64 accepted browser answers, the stitched view caught 18/20 public confident errors while wrongly demoting five correct reads. Requiring both views to conflict caught 18/20 and demoted two correct reads. Treating a conflict from either view as unsafe caught all 20 errors, but demoted eight correct reads, leaving only 36/70 P05 answers automatic before any possible yellow rescue. This cannot support the 90% goal.
- Important missed-error finding: stitched TrOCR agreed with the wrong browser read on P05 `sub-2digit Q7` (`11`, handwriting `16`) and `place-value Q6` (`17`, handwriting `47`). The continuous view disagreed on both (`14` and `47` respectively), which is why either-view conflict catches all 20. The place-value case can also be caught by the existing key-blind 1/4 rival signal; the repeated-`11` case remains the harder local safety problem.
- Persistent-session loading now works in the test-only path. On all 70 P05 continuous images, Chromium fell from 107.42 seconds disposable to 51.18 seconds resident (2.10x faster) with 70/70 identical reads. Initialization was approximately 0.77 seconds once; the remaining 69 requests reused the session; median inference was approximately 0.718 seconds/answer.
- WebKit also completed 70/70 resident requests without stalling in 52.59 seconds, but browser-native Canvas resizing caused seven cross-engine read differences on identical source images. Disabling SIMD did not change those differences and slowed the seven-case subset to approximately 2.49 seconds/answer in Chromium and 2.71 seconds/answer in WebKit.
- A test-only deterministic bilinear resizer restored exact Chromium/WebKit parity on all seven disagreements, including probabilities, at normal SIMD speed. Full-P05 Chromium with that resizer completed 70/70 in 51.09 seconds and scored 55/70 top-1, one below browser-native continuous preprocessing. As a demotion-only check it caught all 20 P05 browser errors but demoted seven correct accepted reads, leaving 37/70 safe automatic before any yellow rescue. Determinism is repaired, but the 90% coverage gate remains far out of reach.
- Completed persistent deterministic 84 MB replay on all 345 scorable labels. On the four earlier packets, stitched grayscale scored 268/275 (97.5%) in 198.82 seconds; continuous grayscale scored 232/275 (84.4%) in 199.92 seconds. On P05, stitched scored 56/70 (80.0%) in 51.59 seconds and continuous scored 55/70 (78.6%) in 51.09 seconds. The severe P05 generalization gap is real and is not explained by browser resizing alone.
- Full deterministic P05 stitched replay produced 70/70 identical reads and probabilities in Chromium and WebKit. Chromium took 51.59 seconds and WebKit 51.97 seconds. Deterministic preprocessing fixes the earlier cross-engine discrepancy.
- The experimental persistent client now keeps one resident worker across separate worksheet calls rather than only across answers inside one call. A four-answer/two-call WebKit test initialized once (1.42 s), reported session reuse on the next three answers, and completed in 4.40 s. A forced missing-model failure returned partial/no result, discarded the resident worker, then recovered with a fresh correct session. The disposable public control path is unchanged.
- A key-blind retrospective scout + cascaded 84 MB selector reaches exactly 311/345 automatic (90.1%), 311/311 correct, zero known confident errors, and 34 yellow. The fast scout/browser signals route 155/312 accepted answers plus all 33 existing yellows to the stitched reader; only 39 unresolved cases continue to the continuous view. This is 227 84 MB inferences over 50 pages: median four/page, p90 eight, maximum 11. Packet results are P02 66/68, P03 65/67, P08 69/70, P09 68/70, but P05 only 43/70 (61.4%). It therefore passes the aggregate numerical target while failing the per-packet/generalization gate.
- Treat the 90.1% result as a research frontier, not a public candidate. Two thresholds were inspected against the same five packets, no prospective student remains in this corpus, and physical phone/old-iPad memory and sustained runtime are still unmeasured. Do not deploy or market the aggregate result.
- The required visual audit covered all 53 changed decisions. The cascade caught all 20 predecessor confident errors while sending seven correct predecessor reads to yellow; all 26 proposed yellow promotions match the stored handwriting labels. However, four promoted number-bond answers have already-frozen, truth-blind geometry-failure labels (`outside-zone` or `clipped`) and their model views visibly lack reliable handwriting evidence. Vetoing those four reduces the defensible frontier to 307/345 automatic (89.0%), still with zero known confident errors. The headline 90.1% is therefore not visually safe enough to ship.
- Geometry repair can recover the missing information but is not yet a general selector. The repaired grayscale crops make all four handwriting samples visually legible. In deterministic WebKit the 84 MB reader got three of four repaired crops right (P08 `14`, `6`, and `17`) but read the P03 `14` as `6`; the independently shifted P03 view read `14`. A key-blind route applied to all nine currently promoted answers with suspicious or very-low-ink crops scored only 5/9 on the repaired view. This means the individual four cases can be explained, but a general rule cannot safely choose the right crop/view yet. Do not hard-code those examples.
- A browser-compatible quantization reduced the strong-reader package from 84,063,346 bytes (about 80.2 MiB) to 64,086,224 bytes (about 61.1 MiB). The earlier 60 MB export failed to load in WebKit because it contained `ConvInteger`; the repaired export keeps the single patch convolution in FP32 and quantizes only 72 MatMul nodes. It completed all 345 stitched and all 345 continuous requests in deterministic persistent WebKit. Stitched accuracy was 268/275 on earlier packets and 57/70 on P05; continuous was 228/275 and 58/70. The unchanged cascade still produced 311/345 automatic, zero known confident errors, and the same visually defensible 307/345 (89.0%) after the four geometry-failure promotions are vetoed. Median inference fell to about 0.65 s and model initialization to about 0.40 s on Mac WebKit; real-device download/memory remain unmeasured.
- The verified encoder is backed up as `encoder-matmul-int8-webkit.onnx` in the Rugged-drive model directory, SHA-256 `da158e8863477b81e2672dac48506333333edb599da711d0233e4fc578b9613a`. The retained decoder SHA-256 is `8a4d066c5cd2fb6924665fc85a2945fb96c5e42cc6bac3feb7d17fa987f8edb3`. Reproducible exporter: `scripts/export_trocr_webkit_matmul_int8.py`.
- A tailnet-only physical-device probe is active at `https://hobbes-mac-mini.tail9a3379.ts.net/local-model-probe/`. It uses the exact 61.1 MiB candidate, deterministic preprocessing, one resident session, eight frozen P02 crops, and offers 8-answer and 40-answer runs. It records user agent, model initialization/download, per-answer and p90 timing, token parity, and memory when the browser exposes it; results stay in the device until copied/downloaded. The page and model routes were smoke-tested through the exact Tailscale URL in WebKit and passed. This is private Tailscale Serve, not Funnel/public access. Current server process is the local probe server on `127.0.0.1:8791`; the Tailscale route is `/local-model-probe`.
- The only existing 15–30 MB-class model is the 21 MB / 5.47M-parameter sequence residual. Its retained report scored only 171/275 (62.2%) on the earlier packets, so it is rejected without spending browser/device testing. The 7.7 MB larger-grayscale slot/layout model scored 43/70 on P05 and is likewise not a primary recognizer. The new 61.1 MiB package is the smallest demonstrated strong reader; further reduction requires structural distillation or a different encoder, not more of the same dynamic quantization.
- New authoritative research report: `private-evidence/reports/browser-local-scout-trocr84-safety-frontier-20260723.json`. Reproducible evaluator: `scripts/analyze_browser_local_safety_frontier.mjs`.
- Regression state after resident-worker changes: 192/192 repository tests pass and production build passes. Nothing was deployed.
- `scripts/browser-probes/serve_trocr_small_probe.mjs` now accepts a configurable manifest and stitched/continuous view. `scripts/test_trocr_shadow_candidate6_yellows.mjs` accepts a configurable manifest and all-answer scope. These are experiment-harness changes only; they do not change production recognition or grading.
- Tony's observation that another phone displayed marks immediately was explained by the explicit `prefers-reduced-motion: reduce` branch in `CameraCapture.vue`: iOS Reduce Motion revealed all marks without pen-stroke animation. Tony explicitly chose a consistent grading experience, so the branch and CSS suppression were removed. Both normal and reduced-motion devices now use the full pen-stroke sequence; retain this as a regression contract.
- Private reports: `private-evidence/reports/browser-local-trocr-p05-all-20260723.json` and `private-evidence/reports/browser-local-trocr-p05-continuous-all-20260723.json`.
- Next action: build a physical-device sustained-runtime probe for the 84 MB persistent reader, then decide whether the current 84 MB package is viable on modern devices. The next smaller-model experiment must be a genuinely stronger 15–30 MB distillation design; the existing 21 MB model is already falsified. Physical current-phone/old-iPad memory remains unmeasured. Do not deploy.

## 2026-07-23 Beta 7 safety failure / Beta 15.3 interface freeze (current)

- Independently replayed the frozen predecessor and Beta 7 on identical retained evidence for every canonical multi-frame packet with hand-labelled truth: P02, P03, P05, P08, and P09 (50 sheets, 350 locations, 345 scorable answers).
- Beta 7 scored 273/345 automatic (79.1%), with 253 correct, **20 confident transcription errors**, and 72 yellow (20.9%). The predecessor scored 315/345 automatic (91.3%), with the same 20 errors and 30 yellow.
- The repair therefore fails both hard gates: it did not reach zero known confident errors and it materially regressed every packet except P05, both layout families, both answer lengths, and every capture-quality group.
- Identical-input replay was deterministic; both policies reproduced 350/350 saved decisions; no selected-evidence duplicates were found; no answer-key or truth fields entered either policy.
- Visually inspected all 42 changed decisions and all 20 confident errors. The 42 changes were correct automatic reads unnecessarily demoted to yellow. The 20 errors were genuine transcription errors concentrated in P05, not truth-label or answer-key disagreements.
- Root cause: the broad display veto fires even after a safe promotion, while already-automatic browser reads bypass the promotion safety lane. Narrow next experiment: remove the post-success display veto and add a risk-triggered, demotion-only second-reader veto for already-automatic conflicts. Validate prospectively.
- **Do not deploy Beta 7.** No recognition production behavior was changed.
- Tested public Beta 15.3 on current-phone and five-year-old-iPad viewports with saved worksheets. Optional blanks, empty correction, empty+Save, physical slot correction, overlay layering, mark placement, fixed workspace, and active-answer visibility all passed.
- Focused checks 35/35, complete suite 180/180, production build pass, public build pass, and live-site smoke pass. Beta 15.3 is frozen as the correction-interface control; physical old-iPad repeated-camera endurance remains unproven.
- Built an initial worksheet-first Teachers Pay Teachers package: catalog plan, teacher instructions, preview copy, reliability language, and a visually verified six-page beta preview PDF. Marketing must describe teacher review as part of the workflow and make no accuracy percentage or error-free claim.
- Preserve all remaining untouched packets. September classroom work is the decisive prospective validation. The 84 MB whole-answer model remains a later second-reader experiment and must not block the small worksheet beta.
- Full gate: `docs/SCANGRADE_BETA7_BETA15_3_RELEASE_GATE_20260723.md`.
- Interface freeze: `docs/SCANGRADE_BETA15_3_INTERFACE_FREEZE_20260723.md`.

## 2026-07-16 browser-local stronger-reader checkpoint (current)

- Built a ScanGrade-adapted TrOCR-small whole-answer model that reads preserved stitched grayscale answers and receives no answer key. Four packet-held-out folds scored **244/275 (88.7%)**: rows 149/160, non-rows 95/115, one digit 92/100, two digits 152/175, number bonds 12/22.
- This materially exceeds the previous 6.4 MB compact model (196/275) and slightly exceeds the 335M adapted strong reader's stitched top-1 result (242/275), but raw confidence remains unsafe and the model must not override accepted Candidate 6 reads.
- Final opened-data adapter selected 122/136 historical validation and scored 96/114 historical holdout. P05 remains sealed and untouched.
- Exported a leading **84 MB** browser package (FP16 encoder + int8 decoder). Native P02 parity is 68/68. Single-answer Chromium/WebKit parity passes at about 0.78–0.79 seconds inference on the Mac.
- A decoder causal-mask tracing bug initially produced `5→55`/`8→8888`; corrected export uses the actual start token and traces the two-token path. Full float and 84 MB hybrid parity now pass.
- Batch/session reuse can stall ONNX Runtime Web. The implemented shadow path uses disposable workers, sequential yellow-only reads, a strict cap/timeout, and fail-open behavior. Physical old-iPad sustained memory is untested.
- Wider robust crops repair real clipping (including full `19` on P02 number-bond Q2) but regress overall recognition because printed borders create duplicates. Keep the uncleaned stitched original as primary evidence; use wider/cleaned views only as clipping or disagreement evidence.
- Nothing was deployed, pushed, or allowed to change grades/yellows. Candidate 6 remains the production/private control.
- Full report: `docs/SCANGRADE_BROWSER_LOCAL_TROCR_SMALL_RESULT_20260716.md`.

Next action: host/cache the 84 MB files from a durable HTTPS model origin and run the sustained physical old-iPad test. Do not freeze or spend P05 on an automatic selector yet; every tested selector still admits known errors or no useful safe coverage.

## 2026-07-14 remaining-yellow audit and browser-secondary candidate

- Visually audited all 53 scorable yellows remaining after the frozen 222/275 consensus candidate. Classification: 25 readable/compact-28×28 bottlenecks, 11 readable/frame instability, six crop/registration failures, five layout/slot-contract failures, three genuinely ambiguous answers, two browser preprocessing conflicts, and one confidence-safety veto.
- Added and tested experimental `consensus-promotion-shadow-2`: exact 3/3 large-grayscale agreement with minimum confidence 0.98 may use per-digit browser top-two support (minimum probability 0.05) when compact evidence is inadequate. Ambiguity, safety, and slot gates remain dominant; no answer key is used.
- Fixed-evidence score: 228/275 automatic (82.9%), 228 correct, zero observed wrong; +6 over frozen candidate. Row 142/160 (88.8%); non-row 86/115 (74.8%).
- Fresh 40-page browser replay: 226/275 (82.2%), 226 correct, zero observed wrong; all pages, annotations, and marked sheets passed. Six old yellows were rescued, while two previous automatics moved safely to review because current selection behavior differed despite identical retained 28×28 inputs/probabilities. Investigate reproducibility before release.
- Historical one-frame falsification stress: 457/578 surrogate automatic, zero observed wrong; the new lane contributed nine correct/no wrong surrogate promotions. Historical data cannot validate three-frame stability.
- Focused 22/22 tests and production build pass. Nothing deployed or pushed. Full report: `docs/SCANGRADE_YELLOW_RESIDUAL_AUDIT_20260714.md`.

Last updated: 2026-07-13
Current thread: SG 3
Previous thread: SG 2 (`019e760b-4e8f-7751-be8b-40baddcb8e58`)

Purpose:
This is the first file to read when Codex loses chat history, a Codex update hides a thread, or a new ScanGrade thread starts. It captures the live working state. Treat older recovery files as background, and treat this file as the current handoff until it is superseded.

## Recovery Start Routine

1. Read `AGENTS.md`.
2. Read this file.
3. Read `SCANGRADE_RECOVERED_PROJECT_MEMORY.md`, `SCANGRADE_VISION_AND_PRODUCT_PRINCIPLES.md`, and `SCANGRADE_VISION_INTERVIEW_ADDENDUM.md`.
4. Read `docs/SG_THREAD_HANDOFF_PROTOCOL.md`.
5. Inspect repo state with `git status --short` before editing.
6. Do not scan all of `~/.codex` or the 24 GB backup.

## Current Mission

### 2026-07-13 V3 build status (current)

Tony authorized a from-scratch V3 alongside the preserved V2/control. V3 is implemented as an opt-in shadow system; it is not authorized to alter production grades yet.

Implemented:

- exact continuous grayscale answer zones cropped once from the live refined canonical page;
- deterministic fidelity and independent blank/artifact evidence;
- a 1.31M-parameter, 5.8 MB ScanGrade-specific one/two-digit whole-answer ONNX model;
- existing adapted TrOCR retained on its stronger cleaned/stitched representation;
- key-blind, independent-architecture fusion with abstention;
- up to three real auto-capture frames, each independently registered and read;
- local V2 grading first, optional V3 suggestions asynchronously, and identical local output during a service outage;
- local/container compact-model service, prospective V2/V3 evaluator, and V3 policy freezer.

Verified evidence:

- V2 broad control: 582 answers, 323 automatic (55.5%), 323/323 correct; row 70.5%, non-row 43.1%.
- Compact model: validation 99/136 (72.8%), historical holdout 66/114 (57.9%). It is useful independent evidence, not a replacement OCR.
- Adapted TrOCR cleaned/stitched: validation 105/136 (77.2%), historical holdout 92/114 (80.7%). Direct raw continuous TrOCR was worse (47.8%/45.6%).
- Conservative three-reader fusion with uncalibrated artifact evidence kept advisory: validation 88/136 automatic with 0 wrong and 5 promotions; historical holdout 86/114 automatic with 0 wrong and 0 promotions.
- At least one reader was correct on 109/114 historical holdout answers, proving candidate signal exists; safe selection remains the bottleneck. The learned readers agreed wrongly five times, so thresholds must not be loosened blindly.
- Compact service: 72 ms for 1 answer, 420 ms for 10, 1.26 seconds for 30 on the Mac; answer-key fields rejected.
- Native container service supersedes those Node/WASM performance numbers: 43.8 ms for 1 answer, 41.8 ms for 10, and 92.9 ms for 30 warm answers. It exactly reproduced 114/114 frozen holdout reads; Node/WASM differed on five borderline cases. Use Python/native ONNX Runtime as the canonical cloud evaluator.
- End-to-end browser smoke passed with service available and unavailable. Predictions were identical during the simulated outage.
- WebKit/iPad emulation exposed and then verified the HTTPS requirement: HTTP model calls were blocked as mixed content; the same compact service over HTTPS completed successfully. Actual old-iPad camera/memory behavior is still untested.
- A debug-only browser replay exercised all three retained-frame branches using three saved real captures. Both independent readers processed 24 answer images each. V3 accepted 6/8 answers and all 6 matched handwritten truth; the two browser-OCR disagreements remained review while both learned readers supplied the correct alternative. This proves plumbing/conservative behavior, not live-burst generalization, because these were separated saved captures.
- The blank/artifact lane remains advisory. It found 3/4 known blanks with zero false blank proposals, but 90/582 artifact flags and the real-capture replay show the artifact probability is not calibrated well enough to veto model agreement.

Canonical docs:

- `docs/SCANGRADE_V3_ARCHITECTURE.md`
- `docs/SCANGRADE_V3_EXPERIMENT_LEDGER_20260713.md`
- `docs/SCANGRADE_V3_HEAD_TO_HEAD_20260713.md`
- `docs/SCANGRADE_FOUR_PACKET_CAPTURE_PROTOCOL.md`

Prospective gate remains physically blocked on Tony scanning the pre-registered intact packets: P08, P03, P09 development; P02 locked; eight packets remain unscanned. Do not mix students or open P02 truth before `npm run freeze:v3-policy`. V3 uses `?hybridV3=1`, plus optional `v3CompactModelUrl` and `reviewModelUrl`. Do not expose either experimental service anonymously to student traffic.

Next action: deploy/run the private V3 shadow build, scan one P08 page and confirm continuous zones + burst frames + `v3-shadow-complete`, then scan P08/P03/P09. Tune only on those development packets, freeze, and open P02 once.

Collect Tony's final Grade 1 classroom evidence before summer break, keep the public app and private Mission Control reachable, and convert the results into a narrow September Teachers Pay Teachers launch path.

Current targets:

- Use the Grade 1 last-week packet to collect varied real classroom scans before school ends.
- Score app detection against what the student wrote, not only against the correct math answer.
- On rough live camera captures, prefer yellow teacher review over any confident wrong read.
- Preserve the solved 9-photo confidence benchmark as a regression gate when OCR/capture changes resume.
- Review flags are acceptable for genuinely ambiguous handwriting; confident wrong reads are not acceptable.

Important interpretation:
Score OCR against the handwritten answer visible in the box, not only against the worksheet answer key. Some student answers are mathematically wrong, and those should become confident red Xs only when the OCR read itself is trustworthy.

Tony reaffirmed this on 2026-06-06: math-wrong student answers are good evidence because they simulate actual app performance. Optimize detection relative to what the student wrote, not relative to the correct math answer.

## Debug Scan Auto Upload

On 2026-06-19, SG 3 added an auto-upload path for large classroom debug-scan collection. This was requested because Tony has roughly 160 Grade 1 packet pages to scan and manual downloads of every JSON/crop preview are too slow.

Implementation:

- Browser debug mode accepts `debugUploadUrl`, `debugUploadToken`, and `debugAutoUpload=1` query params.
- The settings persist in browser storage, so Tony only needs to open the prepared URL once per scan device.
- Each debug scan posts the full live OCR debug bundle to Mission Control.
- Mission Control now exposes token-protected `POST /api/debug-scans` and stores the evidence under `private-evidence/debug-scans/YYYY-MM-DD/<scan-id>/`.
- Saved files include `debug.json`, `summary.json`, `captured.png`, `warped.png`, `raw-crops/*.png`, and `model-inputs/*.png` when available.
- 2026-06-19 follow-up: debug uploads now also include `marked-sheet.jpg` and `overlay-debug.json` when the browser successfully renders the marked result. Use these to diagnose yellow review circles, checks, or X marks that appear in the wrong place.
- 2026-06-20 follow-up: Mission Control debug uploads now accept current browser field names plus fallback aliases for captured/marked/crops images. When present, the receiver saves `captured.png`, `marked-sheet.jpg`, `overlay-debug.json`, `warped.png`, `crops.png`, `raw-crops/*.png`, and `model-inputs/*.png`.
- `private-evidence/` is ignored by git; do not commit this student evidence.
- Manual corrections are not auto-uploaded over the raw scan result. The auto-saved bundle is intended to represent what the app saw at scan time.
- Current public debug build label after the classroom-debug follow-up: `2026.06.20-0820-EDT-sg3-classroom-debug-fix`.

Runbook:

```text
docs/DEBUG_SCAN_AUTO_UPLOAD.md
```

Expected local receiver command:

```text
SG_DEBUG_UPLOAD_TOKEN=<short-secret> node mission-control/server.mjs
```

Prepared public scan URL pattern:

```text
https://scangradesheets.github.io/draft1/?liveOcrDebug=1&debugAutoUpload=1&debugUploadUrl=https%3A%2F%2Fhobbes-mac-mini.tail9a3379.ts.net%2Fmission-control%2Fapi%2Fdebug-scans&debugUploadToken=<short-secret>
```

The scan device needs an HTTPS route to the receiver. The tailnet Mission Control route is the intended route. If it shows `502`, first confirm the local Mission Control server is running on the Mac.

## 2026-06-20 Classroom Debug Fix

Tony uploaded classroom scans from the Grade 1 last-week packet and reported that results were still disappointing. Analysis found two separate failure families:

- Safe policy failure: one-digit handwritten answers in two-slot boxes were sometimes read as fake two-digit answers because the optional blank slot picked up a weak guide-line/artifact digit, for example `5 -> 51`, `8 -> 84`, or `7 -> 71`.
- Real recognition/crop failure: some visual formats and two-digit layouts still produce low-quality crops or weak recognition. These should stay yellow review until the layout/capture/OCR path is improved.

Changes made:

- Added a conservative optional one-digit blank override in `src/components/CameraCapture.vue`. It only applies to two-slot answer groups whose worksheet answer is one digit, where one slot confidently matches the expected digit and the other slot has weak/review/artifact evidence. The artifact slot is treated as blank instead of creating a false companion digit.
- Marked-sheet annotation geometry now prefers the expected printed answer slot (`layoutBoxRect` / `expectedRect`) before crop/refined rectangles. This should keep yellow review circles closer to the answer boxes instead of drifting with crop geometry.
- Mission Control debug scan saving now preserves marked-sheet screenshots and image assets more robustly, including fallback key names.

Local replay on the saved 2026-06-20 classroom debug uploads showed this patch rescued 3 optional-blank cases in the 70-question packet sample and reduced review groups from 38 to 35 in that replay. This is not enough to call the new packet formats reliable; it is a safe incremental fix plus better evidence capture. The remaining next work is layout/crop robustness on ten frames, dot collections, number bonds, number patterns, place value, and the two-digit fact rows.

Verification completed:

```text
node --check mission-control/server.mjs
local authorized POST /api/debug-scans smoke test saved captured.png, marked-sheet.jpg, overlay-debug.json, warped.png, crops.png, raw-crops/raw-01.png, and model-inputs/model-01.png
saved classroom debug replay: optional blank override +3, review groups 38 -> 35
npm run build
npm run build:github
compiled dist sanity check: /draft1/ base OK, build label OK, optional policy present, marked-sheet upload present
```

## 2026-06-20 Pre-Codex-Update Handoff

Tony is about to update Codex. If this thread disappears, continue from these anchors:

```text
Source branch: autobuild/safe-20260223
Latest source commit: 5e0d9db Fix classroom debug optional blanks
Latest public deploy commit on gh-pages: 99d9c65 Deploy classroom debug fix build
Public test URL: https://scangradesheets.github.io/draft1/
Expected visible build label: 2026.06.20-0820-EDT-sg3-classroom-debug-fix
```

The immediate next move is evidence collection, not another blind app tweak. Use the current build to gather more classroom scans because the debug receiver now preserves enough evidence to diagnose the real failures.

2026-07-01 23:25 EDT update:

- Tony reported re-scanning all 10 pages from the same package for comparison after the `2026.07.01-2230-EDT-sg3-optional-leading-review` deploy.
- Local time was confirmed as `2026-07-01 23:24 EDT`; do not look only under `2026-07-02` for this batch.
- A modification-time scan across `private-evidence/debug-scans/` showed no new folders after `private-evidence/debug-scans/2026-07-01/2026-07-01_23-55-43-064-sg-g1-lw-05-mixed-20-92967803/`.
- Mission Control was no longer running, so the late 10-page rescan should be treated as not received unless another upload path is later found.
- Mission Control was restarted on `127.0.0.1:8787` with a fresh per-session debug upload token. The token was shared in chat via a prepared debug URL and intentionally not written here.
- Local receiver check returned `HTTP 200`; tailnet Mission Control check at `https://hobbes-mac-mini.tail9a3379.ts.net/mission-control/` returned `HTTP 200`.

Next action:

1. Tony should open the fresh prepared debug URL on the scan device, use `Debug Scan (exports)`, scan one page, and wait for the visible `Debug saved` confirmation.
2. Confirm that a new folder appears under `private-evidence/debug-scans/2026-07-01/`.
3. Only then re-scan the remaining packet pages for comparison.

Open risk:

- If Codex or the local receiver process dies again, Tony's phone may still have a stored token/upload URL that no longer matches a running receiver. Restart Mission Control and send a fresh prepared URL before any large batch.

2026-07-01 23:37 EDT update:

- Tony scanned one page using the fresh debug URL and Mission Control received it.
- Saved folder: `private-evidence/debug-scans/2026-07-02/2026-07-02_03-36-58-172-sg-g1-lw-07-dot-collections-1325aaf9/`.
- The folder date is `2026-07-02` because the server uses UTC timestamps; the local scan time was still July 1 EDT.
- Saved evidence includes `captured.png`, `warped.png`, `marked-sheet.jpg`, `overlay-debug.json`, `debug.json`, `raw-crops/`, and `model-inputs/`.
- QR/layout path worked: layout was read directly as `sg-g1-lw-07-dot-collections` from `full-frame:direct`.
- Grading result remained weak on this dot-collections page: `questionScore: 1/6`, `questionReviewCount: 6/6`, `needsReviewCount: 8`, with several false two-digit answers such as `5 -> 51`, `8 -> 81`, `12 -> 92`, `16 -> 76`, and `19 -> 79`.

Next action:

- Tony can scan the remaining packet pages now because upload is working again. After the batch lands, compare this new run against the earlier July 1 batch by worksheet type.

2026-07-02 00:05 EDT update:

- Tony scanned the remaining 9 pages from the same packet. All 10 pages are now saved in `private-evidence/debug-scans/2026-07-02/` with local modification times from July 1 23:36-23:41 EDT.
- Layout/QR intake worked for all 10 pages; each page resolved from QR as the expected `sg-g1-lw-*` layout, not title fallback.
- Raw saved summary from the current public build:
  - `sg-g1-lw-01-add-1digit`: `6/8`, review `2/8`.
  - `sg-g1-lw-02-add-2digit`: `2/8`, review `5/8`.
  - `sg-g1-lw-03-sub-1digit`: `5/8`, review `1/8`.
  - `sg-g1-lw-04-sub-2digit`: `3/8`, review `5/8`.
  - `sg-g1-lw-05-mixed-20`: `2/8`, review `7/8`.
  - `sg-g1-lw-06-ten-frames`: `0/6`, review `6/6`.
  - `sg-g1-lw-07-dot-collections`: `1/6`, review `6/6`.
  - `sg-g1-lw-08-number-bonds`: `4/6`, review `1/6`.
  - `sg-g1-lw-09-number-patterns`: `0/6`, review `6/6`.
  - `sg-g1-lw-10-place-value-50`: `4/6`, review `2/6`.
- Visual inspection and replay separated two failure families:
  1. Two-slot boxes used for one-digit answers: students often wrote the single digit in the left slot and left the right slot blank. The app sometimes read the right divider/blank as a companion digit, e.g. `5 -> 51`, `8 -> 81`, `9 -> 91`.
  2. True two-digit answers with a leading `1`: the leading `1` is often misread as `7`, `8`, or `9` in dot collections, two-digit fact rows, number patterns, and place value.
- Patch made: generalized `applyOptionalSingleDigitBlankOverrides` so a two-slot one-digit answer can collapse the artifact/blank slot even when the real digit is not the answer-key digit. It only auto-clears review when the remaining digit has strong model margin and clean ink; weaker reads still stay yellow review.
- Mirrored the policy in `scripts/replay_live_ocr_captured.mjs`.
- Replay after patch on the 10 saved captures:
  - Rescued dot collections A/B from `51/81` to `5_/8_`.
  - Rescued ten frames A from `51` to `5_` while still marking it wrong against the answer key.
  - Rescued mixed D from `91` to `9_`.
  - Did not collapse mixed B `72`, because the student visibly wrote a two-digit wrong answer (`12`) and both slots were real handwriting; this is correct conservative behavior.
  - Remaining weak pages are dominated by true leading-`1` recognition/crop failures, not optional blank policy.
- Verification:
  - `node --check scripts/replay_live_ocr_captured.mjs`
  - `npm run build`
  - `npm run build:github`
  - Local replay against `https://127.0.0.1:5174` with `/tmp/sg-latest-debug-unwrapped/*.json`.
- New visible build label pending commit/deploy: `2026.07.02-0005-EDT-sg3-flex-one-digit-slots`.

Next action:

- Deploy this narrow fix, then collect/label leading-`1` failures as a separate OCR/model/crop improvement track. Do not loosen confidence thresholds to make those reads look better; they are still real OCR failures.

2026-07-02 00:35 EDT update:

- Tony scanned two targeted pages on the deployed `2026.07.02-0005-EDT-sg3-flex-one-digit-slots` build:
  - `private-evidence/debug-scans/2026-07-02/2026-07-02_04-27-27-356-sg-g1-lw-07-dot-collections-51583559/`
  - `private-evidence/debug-scans/2026-07-02/2026-07-02_04-27-34-831-sg-g1-lw-06-ten-frames-70841c4f/`
- Both uploads used the expected public URL with `?v=flex-one-digit-slots-0005&liveOcrDebug=1`; QR/layout intake worked on both.
- Dot collections result: `2/6`, review `3/6`. The new optional one-digit slot policy worked on A (`51 -> 5_`) and conservatively kept B as review (`6_` for expected 8). Remaining failures were C `12 -> 92` review, E `16 -> 76` confident wrong, and F `19 -> 79` review.
- Ten frames result: `0/6`, review `5/6`. The optional slot policy worked conservatively on A (`51 -> 5_`, still review/wrong vs key), but the page is dominated by left-slot/leading-digit failures: B `10 -> 61`, C `11 -> 71` confident wrong, D `14 -> 81`, E `17 -> 91`, F `20 -> 16`.
- Interpretation: the flexible one-digit slot patch is behaving as intended. The remaining risk is a true OCR/model/crop problem, especially leading or left-slot `1`s being read as `7/8/9/6`, not a threshold problem to solve by loosening confidence.
- Evidence strategy recommendation: collect more authentic classroom evidence now, but do not use all of it for tuning. Split the remaining packets before analysis into calibration, validation, and sealed holdout sets so there is still honest test material for the summer.

Next action:

1. Ask Tony to label packet order before scanning more: calibration/dev packets, validation packets, and sealed holdout packets.
2. Use a calibration batch to quantify failure patterns by worksheet type before more OCR changes.
3. Keep at least several complete packets untouched by tuning until a final replay/live-scan evaluation.

2026-07-02 10:32 EDT update:

- Tony scanned the first page of the next calibration upload batch before continuing with additional full packets.
- Mission Control received the upload at `private-evidence/debug-scans/2026-07-02/2026-07-02_14-29-37-277-sg-g1-lw-07-dot-collections-e5cc7757/`.
- The scan came from the expected debug URL with `v=flex-one-digit-slots-0005`, `liveOcrDebug=1`, and debug auto-upload enabled.
- Layout/QR intake worked: `sg-g1-lw-07-dot-collections`.
- Saved bundle is complete: `captured.png`, `warped.png`, `marked-sheet.jpg`, `overlay-debug.json`, `debug.json`, raw crops, model inputs, and tensors.
- Summary: `questionScore: 2/6`, `questionReviewCount: 5/6`, `needsReviewCount: 6`.
- Tony plans to scan 6 more full packets for calibration, making 7 total including the already-scanned Pack A. Recommendation remains to keep later packets reserved for validation/holdout and to distinguish calibration packets as B1-B6 if possible.

Recommended scan protocol:

1. Before scanning a full stack, open the public test URL and confirm the visible build label matches the latest deployed build recorded in this handoff.
2. Confirm Mission Control debug intake is running and reachable from the scan device. Expected receiver command is still `SG_DEBUG_UPLOAD_TOKEN=<short-secret> node mission-control/server.mjs`.
3. Scan a tiny sanity set first: one simple fact-row page, one two-digit fact-row page, and one visual-format page such as ten frames/dot collections/number bonds.
4. Confirm Mission Control receives new `private-evidence/debug-scans/YYYY-MM-DD/<scan-id>/` folders with `debug.json`, `summary.json`, `captured.png`, `marked-sheet.jpg`, `overlay-debug.json`, and crop/model assets when available.
5. If those uploads land, scan the full classroom packet set raw. Do not manually correct the result before the auto-upload has saved the original scan evidence.
6. Prefer the iPhone/current device for the evidence batch. Test the old iPad separately as a compatibility track, because its engine/loading behavior is a different failure mode.
7. After the batch, analyze by worksheet type and failure mode before changing OCR/capture again. Separate optional-blank policy issues from true crop/recognition/layout failures.

Current judgement:

- Scan more now, after a 3-page upload sanity check.
- Do not spend more time tuning in the abstract before the batch unless debug auto-upload is broken.
- Expect the app to still show many yellow review cases on the varied Grade 1 packet. That evidence is useful; the goal is to learn which worksheet formats are viable and which need layout/crop redesign.

Unrelated dirty worktree files existed before this handoff and should not be reverted without Tony's approval.

2026-06-20 17:34 EDT update:

- Tony scanned another packet, but no new worksheet debug folders arrived in `private-evidence/debug-scans/2026-06-20/`.
- The latest real packet evidence visible at that moment was still the earlier run ending at `2026-06-20T01:28:14Z`; later entries were smoke/receiver checks only.
- Local Mission Control was not running and the tailnet URL returned `502`, so the just-scanned packet should be treated as not received.
- Mission Control was restarted and the tailnet route returned `200`; a tailnet receiver-check upload saved successfully.
- Next action remains: open a prepared debug URL whose token matches the running receiver, re-scan a 3-page sanity set, confirm folders arrive, then scan the full packet set.

2026-06-20 19:02 EDT update:

- Tony re-scanned the full 10-page packet and Mission Control received the batch.
- The receiver saved all 10 scans with `captured.png`, `warped.png`, `marked-sheet.jpg`, `overlay-debug.json`, raw crops, model inputs, and debug JSON.
- Two pages were visibly Grade 1 packet sheets but resolved as the legacy `g2-mixed-within-50-v1` layout because the QR payload was missing and the app's fallback path only knew the old Grade 2 title set.
- A second fallback issue was found in the same path: after a printed-title fallback chose a layout, the app did not rerun `processWorksheet` with the matched layout, so varied packet formats could keep stale crops from the seed layout.

Fix made:

- Missing-QR title fallback now knows the 10 Grade 1 last-week packet layouts plus the 3 older Grade 2 layouts.
- Long printed titles are rendered into the title matcher with a max width so Grade 1 titles such as `Subtraction: Single-Digit Answers` can be compared reliably.
- When a printed-title fallback matches a different layout, the app reruns the homography/crop/tensor pipeline with the matched layout before OCR and annotation.
- Any layout inferred from printed title instead of a real QR payload is forced into teacher-review mode with `forcedFallbackReviewReason: qr-missing-title-layout-fallback-review`. This prevents silent confident grading on a missing-QR fallback while still saving useful evidence.
- Debug JSON now includes `missingQrLayoutFallback` and `titleFallbackReranLayout` so future packet analysis can separate real QR reads from fallback recovery.
- Visible build label changed to `2026.06.20-1902-EDT-sg3-qr-fallback-guard`.

Verification completed:

```text
npm run build
npm run build:github
dist sanity check: build label present, Grade 1 page 3/page 5 layout IDs present, missing-QR fallback reason present
```

Next test:

- Re-scan the same 10-page packet on the public build once deployed.
- If a QR still fails on pages such as `SG-G1-LW-03` or `SG-G1-LW-05`, the scan should no longer resolve as `g2-mixed-within-50-v1`; it should either use the matched Grade 1 layout in teacher-review mode or fail safely as review-only.
- Normal grading should still require a real QR payload from the page URL or image decode.

## Grade 1 Last-Week Classroom Test Packet

On 2026-06-17, SG 3 generated a new 10-page Grade 1 packet for Tony's final classroom testing window before summer break.

Generator:

```text
scripts/generate_grade1_last_week_test_packet.mjs
```

Printable files:

```text
public/worksheets/grade1-last-week-test-20260617/printables/ScanGrade-Grade1-Last-Week-Test-Packet.pdf
public/worksheets/grade1-last-week-test-20260617/printables/ScanGrade-Grade1-Last-Week-Test-Answer-Key.pdf
```

Index and manifest:

```text
public/worksheets/grade1-last-week-test-20260617/index.html
public/worksheets/grade1-last-week-test-20260617/manifest.json
```

Layouts were written to both:

```text
public/layouts/sg-g1-lw-*.json
layouts/sg-g1-lw-*.json
```

Packet composition:

- Addition single-digit answers, one answer slot.
- Addition two-digit answers, two answer slots.
- Subtraction single-digit answers, one answer slot.
- Subtraction two-digit answers, two answer slots.
- Mixed addition/subtraction within 20, mixed one-slot and two-slot answers.
- Ten frames to 20, mixed one-slot and two-slot answers.
- Dot collections to 20, mixed one-slot and two-slot answers.
- Number bonds to 20, mixed one-slot and two-slot answers.
- Number patterns, mixed one-slot and two-slot answers.
- Place value and number sense to 50, two answer slots.

Verification completed:

```text
node --check scripts/generate_grade1_last_week_test_packet.mjs
node scripts/generate_grade1_last_week_test_packet.mjs
custom manifest/layout structure check: 10 templates, 114 answer boxes
Playwright screenshots reviewed for lw01, lw02, lw05, lw06, lw08, lw09, lw10
npm run build
```

2026-06-18 formatting revision:

- Sheets 1-5 and 9 now use the older centered fact-row / sequence formatting with larger printed numerals and no grey practice lines.
- Sheet 5 now uses two-slot boxes for every question so answer length is not given away.
- Sheet 6 now stacks two ten frames vertically with a two-slot answer box to the right, centered with the letter bubble.
- Sheet 7 now uses two-slot boxes and keeps dot collections narrower while allowing them to extend vertically.
- Sheet 8 number-bond connector lines now meet the center of the whole answer box instead of visually pointing at individual digit cells.
- Sheet 9 now uses larger number-pattern text, no grey line, and two-slot boxes throughout.
- Sheet 10 no longer uses dotted work boxes; prompts and answer boxes are aligned on the letter-bubble centerline.
- All subtitles are now one short instruction sentence rather than "Grade 1 Math".
- Regenerated PDFs/SVGs/layout JSON and verified `grade1 last-week structure ok: 10 templates 120 boxes`; `npm run build` passed.

2026-06-18 follow-up template tightening:

- Fact-row and pattern letter bubbles now sit closer to their questions using a text-start spacing rule based on the longest prompt in the column, instead of a far-left fixed rail.
- Ten-frame, dot-collection, work-card, and number-bond letter bubbles were nudged closer while preserving clear separation from diagrams/prompts.
- Sheet 8 number-bond circles now have white fill and top-circle connector starts lower, so lines do not visually run through the top value circle.
- Sheet 10 question D changed from unclear `27 or 32?` to a clearer two-line greater-number prompt: `greater:` / `27 or 32`.
- Regenerated all worksheet SVGs, QR images, PDFs, manifest, and layout JSON for the Grade 1 last-week packet.
- Rendered the packet to `tmp/pdfs/grade1-last-week-preview/page-*.png` and refreshed `tmp/pdfs/grade1-last-week-preview/contact-sheet.png`.
- Visual QA checked sheets 1, 5, 6, 7, 8, 9, and 10 after regeneration.
- Verification passed: `node --check scripts/generate_grade1_last_week_test_packet.mjs`, `grade1 last-week structure ok: 10 templates 120 boxes`, `pdfinfo` confirmed 10 Letter pages, and `npm run build` passed.

2026-06-18 final sheet 4 revision:

- Sheet 4 subtraction prompts now keep all printed numbers at 20 or below while preserving two-digit answers: `20 - 8`, `19 - 4`, `18 - 1`, `20 - 6`, `17 - 2`, `19 - 2`, `18 - 2`, `20 - 2`.
- Regenerated the Grade 1 last-week packet PDFs, SVGs, manifest, QR images, and layout JSON.
- Rendered sheet 4 for visual QA at `tmp/pdfs/grade1-last-week-preview/page-final-04.png`, then refreshed the full page PNG set and contact sheet.
- Verification passed: `node --check scripts/generate_grade1_last_week_test_packet.mjs`, custom prompt guard confirmed all sheet 4 prompt numbers are <= 20, `grade1 last-week structure ok: 10 templates 120 boxes`, `pdfinfo` confirmed 10 Letter pages, and `npm run build` passed.

2026-06-18 final fact-row bubble spacing revision:

- Sheets 1-5 letter bubbles were moved slightly left by increasing the fact-row bubble gap rule from about 7.4 mm to 10.2 mm from the estimated text start.
- This keeps bubbles visually attached to their question rows while avoiding the crowded look where labels nearly touched the first digit.
- Regenerated the Grade 1 last-week packet PDFs, SVGs, manifest, QR images, and layout JSON.
- Rendered pages 1-5 for visual QA, then refreshed the full page PNG set and contact sheet.
- Verification passed: `node --check scripts/generate_grade1_last_week_test_packet.mjs`, `grade1 last-week structure ok: 10 templates 120 boxes`, `pdfinfo` confirmed 10 Letter pages, and `npm run build` passed.

No OCR, capture, homography, iPad, model, or grading-policy app logic was changed for this packet.

## Public URL and Mission Control Status

On 2026-06-18, SG 3 fixed the public GitHub Pages deployment for:

```text
https://scangradesheets.github.io/draft1/
```

Root cause:

```text
The live GitHub Pages HTML had root-relative asset paths such as /assets and /opencv.js. Under the /draft1/ project path those resolved to the wrong location on phones.
```

Fix:

```text
npm run build:github
git push gh-pages commit 788154e Fix GitHub Pages draft1 asset paths
```

Verification:

```text
curl -sI https://scangradesheets.github.io/draft1/ -> 200
curl -sI https://scangradesheets.github.io/draft1/assets/index-coeKVQVg.js -> 200
curl -sI https://scangradesheets.github.io/draft1/opencv.js -> 200
curl -sI https://scangradesheets.github.io/draft1/layouts/sg-g1-lw-01-add-1digit.json -> 200
curl -sI https://scangradesheets.github.io/draft1/worksheets/grade1-last-week-test-20260617/printables/ScanGrade-Grade1-Last-Week-Test-Packet.pdf -> 200
```

Also on 2026-06-18, Mission Control gained a Calendar / To Do section. It reads from:

```text
mission-control/state/mission-state.json -> launch_plan
```

The tailnet Mission Control URL:

```text
https://hobbes-mac-mini.tail9a3379.ts.net/mission-control/
```

was returning:

```text
HTTP/2 502
```

Local check showed:

```text
curl -sI http://127.0.0.1:8787/mission-control/ -> connection failed
```

Meaning:

```text
Tailscale is reachable, but the local Mission Control Node server is down.
```

The next operational step is to start the local server on the Mac:

```text
node mission-control/server.mjs
```

Codex attempted to start it, but outside-sandbox approval was blocked by the current Codex usage/approval limit. Do not spend time debugging Tailscale before first confirming the local server responds on `127.0.0.1:8787`.

## Active Evidence Set

SG 2 received 10 attachments for the current pass. Use photos 1-9 as the raw worksheet set. `10-Photo-10.jpg` is likely a screenshot/status image, not a raw worksheet input.

Attachment folder:

```text
/tmp/codex-remote-attachments/019e760b-4e8f-7751-be8b-40baddcb8e58/E4CF30F4-4214-45A4-92BD-D4189D971397/
```

Durable local private copy, ignored by git:

```text
private-evidence/sg3-9-photo-confidence-20260606/
```

Files:

```text
1-Photo-1.jpg
2-Photo-2.jpg
3-Photo-3.jpg
4-Photo-4.jpg
5-Photo-5.jpg
6-Photo-6.jpg
7-Photo-7.jpg
8-Photo-8.jpg
9-Photo-9.jpg
10-Photo-10.jpg
```

Earlier iPhone low-confidence debug evidence lives at:

```text
/Users/openclaw/Desktop/3/
```

Relevant files there include:

```text
scangrade-live-ocr-debug-1780662390000.json
scangrade-live-ocr-debug-1780662411267.json
scangrade-live-ocr-debug-1780662450525.json
scangrade-live-ocr-debug-1780662470827.json
scangrade-crops-1780662387762.png
scangrade-crops-1780662409459.png
scangrade-crops-1780662449022.png
scangrade-crops-1780662469187.png
```

Latest iPhone live debug evidence from Tony's 2026-06-07 iPhone tests lives at:

```text
/Users/openclaw/Desktop/4/
```

Tracked handwritten-truth labels for that batch:

```text
docs/SG3_IPHONE_LIVE_OCR_SCORECARD.json
```

Private replay artifacts:

```text
private-evidence/sg3-iphone-live-20260607/
```

Newest live iPhone burst-capture evidence from Tony's 2026-06-07 tests lives at:

```text
/Users/openclaw/Desktop/5/
```

This batch was captured on public build `2026.06.07-1354-EDT-sg3-burst-capture`. It contains 10 debug JSONs, 10 crop previews, and 11 screenshots. One screenshot (`IMG_8803.PNG`, 3:11 PM) appears to have no matching debug JSON. Tony manually corrected some cells in one debug file; those predictions preserved `originalDigit`, so the batch is still useful for capture-quality analysis.

## Latest Known Code State

Current branch: `autobuild/safe-20260223`

Latest pushed rollback point before the burst-capture pass:

```text
7fe8a46 Improve SG3 live OCR confidence safety
```

That commit established the current safety baseline:

```text
Build label: 2026.06.07-0959-EDT-sg3-live-ocr-safety
Clean 9-photo replay: 89/90 confident, 89/89 confident accuracy, 0 confident wrong, 90/90 OCR truth.
Live iPhone still replay: 72/90 OCR truth, 53/90 confident, 53/53 confident accuracy, 0 confident wrong.
```

Current burst-capture candidate for this pass:

```text
Build label: 2026.06.07-1354-EDT-sg3-burst-capture
Change: Student Mode auto-capture now samples a 5-frame burst after the gate fires, scores frame focus/contrast/marker sanity, and sends the best frame to OCR. The pre-capture focus gate was eased from 340 to 300, but the final chosen frame still has to pass the existing 340 focus threshold.
```

Current sharp auto-capture candidate for this pass:

```text
Build label: 2026.06.07-1525-EDT-sg3-sharp-auto-capture
Change: Student Mode auto-capture still uses the eased pre-capture focus gate of 300, but now samples an 8-frame burst over a longer autofocus window and requires the selected auto frame to reach a final focus score of 650 before OCR. Manual capture keeps the older 340 final focus threshold.
```

Current old-iPad engine fallback candidate for this pass:

```text
Build label: 2026.06.07-1745-EDT-sg3-old-ipad-engine-fallback
Change: Student Mode warms the digit model when the scan view opens, shares one in-flight ONNX model initialization promise, and treats auxiliary right-slot model load/run failure as a fallback-to-primary condition instead of failing the whole scan.
```

Current old-iPad review-save candidate for this pass:

```text
Build label: 2026.06.07-1841-EDT-sg3-old-ipad-review-save
Change: If the primary digit engine cannot initialize or run after a good capture, the app now keeps the scan, marks every answer slot for teacher review, suppresses any fake score, and saves the result instead of showing the fatal "grading engine did not finish loading" retry state.
```

## Current Repo Notes

The worktree is expected to be dirty. Known dirty areas at SG 3 startup included:

```text
create-mnist-model.py
layouts/registry.json
mission-control/public/app.js
mission-control/public/index.html
mission-control/public/styles.css
mission-control/state/decisions.json
many untracked OCR/model/benchmark artifacts
```

`private-evidence/` is ignored by git and may contain local copies of private worksheet photos or screenshots. Do not remove it during cleanup, and do not force-add files from it.

Do not clean, revert, or delete unrelated files. Treat them as Tony/project work unless proven otherwise.

Mission Control note:
Mission Control is useful project memory, but its state file was stale after SG 2. It still referenced older "awaiting samples" and 5/10 or 18/30 baselines even though the project had moved on to the 9-photo confidence pass. SG 3 should update Mission Control only with narrow status facts, not product vision changes.

## Guardrails

- Do not change OCR, capture, homography, iPad logic, or model behavior without a reproducible test.
- Do not make app UI/style/layout changes unless Tony asks or a serious app-breaking bug requires it.
- Do not commit private student photos or crop exports.
- Do not optimize to the answer key when the student may have written a wrong answer.
- Do not claim classroom-ready two-digit OCR from this evidence.
- Prefer review flags over confident wrong reads.
- Every production OCR change needs before/after numbers and a rollback point.

## Next Action

The active 9-photo SG3 confidence target remains met by the current source-aware confidence policy and the new local burst-capture candidate:

- Current best replay: `private-evidence/sg3-9-photo-confidence-20260606/burst-capture-1354/`
- Confident answer coverage: `89/90` (`98.9%`).
- Confident answer accuracy vs handwriting: `89/89` (`100.0%`).
- Confident wrong answers: `0`.
- All-answer OCR accuracy vs handwriting: `90/90` (`100.0%`).
- Target result: pass.

The 2026-06-07 live iPhone batch is safer but still conservative:

```text
Replay: private-evidence/sg3-iphone-live-20260607/burst-capture-1354/
Truth labels: docs/SG3_IPHONE_LIVE_OCR_SCORECARD.json
Answer OCR truth: 72/90
Confident answers: 53/90
Confident answer accuracy: 53/53
Confident wrong answers: 0
Review answers: 37
Digit OCR truth: 159/180
Confident digit wrong: 0
```

This replay is unchanged because the replay starts from already-captured still images; it cannot simulate the new live-camera burst choosing a better frame before OCR. The useful verification fact is no OCR confidence regression on the old stills. The next proof has to come from a live phone scan on build `2026.06.07-1354-EDT-sg3-burst-capture`.

This is still an improvement over the old exported live-build behavior, which scored `68/90` answer OCR truth and made `18` confident wrong answer calls on this same iPhone batch. Do not solve the remaining live-camera under-confidence by broadly loosening confidence gates. The remaining problem is degraded capture/OCR signal quality, not just display policy.

Next useful work:

1. Test build `2026.06.07-1841-EDT-sg3-old-ipad-review-save` on the old iPad using the QR workflow and confirm whether the same worksheet now saves as teacher review instead of showing "Try again."
2. If live scans still over-review after sharp auto-capture, improve preprocessing/model signal using the replay artifacts before relaxing confidence again.
3. Keep scoring OCR against handwritten truth, not answer-key correctness.
4. Treat the clean 9-photo target as achieved, but do not claim classroom-trustworthy generalization from only nine sheets or one rough iPhone batch.
5. Update this file after every meaningful benchmark, patch, commit, push, or blocker.

## Running Log

2026-06-06 / SG 3:
Codex update/resume instability hid SG 2 again. SG 3 was renamed and rehydrated from SG 2 summaries, repo memory, OCR docs, and Mission Control. A durable handoff system was created so future threads can resume without relying on hidden chat history. The 10 SG 2 attachments for the 9-photo confidence pass were copied into ignored local folder `private-evidence/sg3-9-photo-confidence-20260606/`.

2026-06-06 / SG 3:
Draft handwritten-truth labels for the active 9 raw photos were recorded in `docs/SG3_9_PHOTO_OCR_SCORECARD.md` and `docs/SG3_9_PHOTO_OCR_SCORECARD.json`. Ambiguities to verify with crops if they become decisive: Photo 4 Q9 reads as `12`; Photo 8 Q4 reads closer to `38` than `28`; Photo 6 Q9 is overwritten/scribbled and may legitimately need review.

2026-06-06 / SG 3:
Added reusable scorer `scripts/score_sg3_9_photo_ocr.mjs` and npm alias `npm run score:sg3-ocr`. It reads the tracked handwritten-truth scorecard and a replay output directory, then writes private reports `truth-score.json` and `truth-score.md` beside the replay. Baseline replay artifacts live at `private-evidence/sg3-9-photo-confidence-20260606/baseline-588425b/`.

Baseline truth score for current `588425b` replay:

- Confident answer coverage: `49/90` (`54.4%`).
- Confident answer accuracy vs handwriting: `48/49` (`98.0%`).
- Confident wrong answers: `1`.
- All-answer OCR accuracy vs handwriting: `71/90` (`78.9%`).
- Confident digit accuracy vs handwriting: `97/98` (`99.0%`).
- Handwritten answers that differ from answer key: `19`.

Only confident wrong read:

```text
9-Photo-9.jpg Q1 truth=37 predicted=27 key=37 minConf=99.4% minGap=99.2%
```

High-level review pattern:

```text
14 answer reviews include right-slot-expected-edge-default
10 answer reviews include right-slot-preprocess-disagreement
3 answer reviews include box-safe-default
12 answer reviews have no recorded review reason, usually raw low-confidence/low-gap gates
```

Commands run:

```text
node scripts/eval_uploaded_worksheets.mjs --url https://127.0.0.1:5176 --out private-evidence/sg3-9-photo-confidence-20260606/baseline-588425b private-evidence/sg3-9-photo-confidence-20260606/[1-9]-Photo-*.jpg
npm run score:sg3-ocr
```

2026-06-06 / SG 3:
Added a narrow OCR/review patch series and replayed each step against the 9-photo handwritten-truth scorecard. Production predictions improved without making any confident OCR errors, but the 95% confident-read target is not met.

Files changed in this patch series:

```text
src/components/CameraCapture.vue
src/ocr-pipeline.js
scripts/replay_live_ocr_captured.mjs
```

Patch summary:

- Added a review gate for a high-risk two-digit left-slot `expected 3 / predicted 2` mismatch. This turns baseline `9-Photo-9.jpg` Q1 from confident wrong into review.
- Added narrow right-slot/left-slot rescue rules when existing preprocessing variants strongly agree on the handwritten digit.
- Kept rescued uncertain cases under review; prediction accuracy improved, but confidence coverage was not artificially raised.

Best replay so far:

```text
private-evidence/sg3-9-photo-confidence-20260606/candidate-wide-raw-gentle-rescues/
```

Best truth score:

- Confident answer coverage: `49/90` (`54.4%`).
- Confident answer accuracy vs handwriting: `49/49` (`100.0%`).
- Confident wrong answers: `0`.
- All-answer OCR accuracy vs handwriting: `79/90` (`87.8%`).
- Digit OCR accuracy vs handwriting: `169/180` (`93.9%`).
- Handwritten answers that differ from answer key: `19`.

Best run commands:

```text
node scripts/eval_uploaded_worksheets.mjs --url https://127.0.0.1:5176 --out private-evidence/sg3-9-photo-confidence-20260606/candidate-wide-raw-gentle-rescues private-evidence/sg3-9-photo-confidence-20260606/1-Photo-1.jpg private-evidence/sg3-9-photo-confidence-20260606/2-Photo-2.jpg private-evidence/sg3-9-photo-confidence-20260606/3-Photo-3.jpg private-evidence/sg3-9-photo-confidence-20260606/4-Photo-4.jpg private-evidence/sg3-9-photo-confidence-20260606/5-Photo-5.jpg private-evidence/sg3-9-photo-confidence-20260606/6-Photo-6.jpg private-evidence/sg3-9-photo-confidence-20260606/7-Photo-7.jpg private-evidence/sg3-9-photo-confidence-20260606/8-Photo-8.jpg private-evidence/sg3-9-photo-confidence-20260606/9-Photo-9.jpg
npm run score:sg3-ocr -- --run private-evidence/sg3-9-photo-confidence-20260606/candidate-wide-raw-gentle-rescues
npm run build
```

Verification:

- `npm run build` passed.
- Latest local replay processed all 9 sheets with no failures.

Important interpretation after Tony clarification:

- Math-wrong but correctly read student answers count as OCR successes.
- They may become confident red Xs if the OCR read is trustworthy.
- Do not treat answer-key mismatch as OCR failure.
- Do not use answer-key matching as a shortcut for OCR truth.

2026-06-07 / SG 3:
Ran a model evidence pass before patching further. A browser tensor replay compared existing bundled model choices against the SG3 handwritten-truth labels. The current script config remained best/tied at `79/90` answer recognition. Two local fine-tune experiments were also trained from `models/worksheet-digit-tony-generalist-aug-strong-20260601.pt` using SG3 truth-labeled tensor variants:

```text
public/models/worksheet-digit-sg3-finetune-local.onnx
public/models/worksheet-digit-sg3-finetune-local-v2.onnx
private-evidence/sg3-9-photo-confidence-20260606/models/
private-evidence/sg3-9-photo-confidence-20260606/sg3-truth-tensor-dataset-all/
```

Neither model should be adopted. The first replayed worse than current (`77/90` as primary, `78/90` as right-slot). The more aggressive overfit model reached `100%` on the SG3 training variants but dropped strict holdout to `48/50` and replayed worse (`77/90` as primary, `72/90` as right-slot, `70/90` as both). Conclusion: model replacement is not the next safe path from the current evidence.

2026-06-07 / SG 3:
Added cautious tensor-shape rescues in `src/ocr-pipeline.js`. These look at the strict 28x28 tensor shape after model selection and rescue common visually-obvious ScanGrade confusions (`open 3 read as 2`, some right-slot `2` read as `9/7/1`, `9` read as `4`, `5` read as `3`, and `8` read as `7`). The rescues use the existing `digitResultFromVotedDigit` path with the original probabilities, so rescued digits stay low-confidence and review-bound rather than becoming automatic confident grades.

Best replay is now:

```text
private-evidence/sg3-9-photo-confidence-20260606/candidate-shape-rescues/
```

Best truth score:

- Confident answer coverage: `49/90` (`54.4%`).
- Confident answer accuracy vs handwriting: `49/49` (`100.0%`).
- Confident wrong answers: `0`.
- All-answer OCR accuracy vs handwriting: `88/90` (`97.8%`).
- Digit OCR accuracy vs handwriting: `178/180` (`98.9%`).
- Handwritten answers that differ from answer key: `19`.

Remaining OCR-wrong answers:

```text
2-Photo-2.jpg Q5 truth=44 predicted=14 key=42 review=true
3-Photo-3.jpg Q9 truth=14 predicted=11 key=14 review=true
```

Commands run:

```text
node scripts/eval_uploaded_worksheets.mjs --url https://127.0.0.1:5177 --out private-evidence/sg3-9-photo-confidence-20260606/candidate-shape-rescues private-evidence/sg3-9-photo-confidence-20260606/1-Photo-1.jpg private-evidence/sg3-9-photo-confidence-20260606/2-Photo-2.jpg private-evidence/sg3-9-photo-confidence-20260606/3-Photo-3.jpg private-evidence/sg3-9-photo-confidence-20260606/4-Photo-4.jpg private-evidence/sg3-9-photo-confidence-20260606/5-Photo-5.jpg private-evidence/sg3-9-photo-confidence-20260606/6-Photo-6.jpg private-evidence/sg3-9-photo-confidence-20260606/7-Photo-7.jpg private-evidence/sg3-9-photo-confidence-20260606/8-Photo-8.jpg private-evidence/sg3-9-photo-confidence-20260606/9-Photo-9.jpg
npm run score:sg3-ocr -- --run private-evidence/sg3-9-photo-confidence-20260606/candidate-shape-rescues
npm run build
```

Verification:

- Full 9-photo upload replay processed all sheets with no failures.
- `npm run score:sg3-ocr -- --run private-evidence/sg3-9-photo-confidence-20260606/candidate-shape-rescues` passed the scorer and wrote `truth-score.json` / `truth-score.md`.
- `npm run build` passed.

2026-06-07 / SG 3:
Added repeatable confidence calibration analysis tooling:

```text
scripts/analyze_sg3_confidence_calibration.mjs
npm run analyze:sg3-confidence
```

The analyzer reads a replay's `truth-score.json`, `rows.json`, and per-sheet `ocr-debug.json`, then writes private reports:

```text
private-evidence/sg3-9-photo-confidence-20260606/candidate-shape-rescues/confidence-calibration.json
private-evidence/sg3-9-photo-confidence-20260606/candidate-shape-rescues/confidence-calibration.md
```

Calibration result:

- Current confident coverage remains `49/90` with `0` confident wrongs.
- Reviewed answers are `41/90`; `39` of those are actually OCR-correct and `2` are OCR-wrong.
- The target needs `86/90` confident answers, so ScanGrade must promote `37` of the current `41` reviewed answers while leaving the `2` OCR-wrong reviewed answers under review.
- Cleanest confidence-only policy tested (`high-signal no-reason reviews`) promotes only `4` answers, reaching `53/90`, `0` confident wrongs.
- Slightly looser no-reason mismatch policy promotes `5` answers, reaching `54/90`, `0` confident wrongs.
- Evidence-only exact-reason whitelist promotes `31` answers, reaching `80/90`, `0` confident wrongs, but it trusts many low-probability rescues and is not safe as production policy by itself.
- Aggressive evidence-only whitelist plus moderate no-reason mismatches reaches `85/90`, `0` confident wrongs, still one short of the `95%` target.
- Oracle upper bound, using handwritten truth labels unavailable in production, is `88/90` confident with `0` confident wrongs.

Interpretation:

- The app is under-confident relative to current recognition accuracy, but threshold loosening alone is not enough.
- OCR confidence and grading confidence are currently mixed for student answers that differ from the answer key. Some correct OCR reads become review because the app is cautious about auto-Xing wrong student answers.
- The two remaining OCR-wrong reviewed cases both involve `4 -> 1`.
- Visual crop check:
  - `2-Photo-2.jpg` Q5 left slot (`44 -> 14`) is mostly a slot-split/crop problem; the left crop contains mostly a vertical stroke and the paired right crop carries the other `4`.
  - `3-Photo-3.jpg` Q9 right slot (`14 -> 11`) has a raw crop that visibly looks like `4`, but model/preprocessing makes `1` dominant with `4` as runner-up.
- A quick model-input feature comparison did not justify a broad `1 -> 4` rescue because the bad `4` overlaps some real `1` shapes.

Commands run:

```text
npm run score:sg3-ocr -- --run private-evidence/sg3-9-photo-confidence-20260606/candidate-shape-rescues
npm run analyze:sg3-confidence -- --run private-evidence/sg3-9-photo-confidence-20260606/candidate-shape-rescues
node --check scripts/analyze_sg3_confidence_calibration.mjs
```

Files changed in this pass:

```text
scripts/analyze_sg3_confidence_calibration.mjs
package.json
SCANGRADE_ACTIVE_HANDOFF.md
mission-control/state/mission-state.json
```

Production OCR behavior was not changed in this calibration pass.

2026-06-07 / SG 3:
Used the older labeled worksheet evidence as a guardrail for the remaining `4 -> 1` problems. Added focused analysis tooling:

```text
scripts/analyze_four_vs_one_crops.mjs
npm run analyze:four-vs-one
scripts/analyze_review_reason_holdout.mjs
npm run analyze:review-reasons
```

The four-vs-one analyzer loads the active SG3 replay plus older labeled worksheet crops under `benchmarks/uploaded_student_samples/results-20260601-new3-handwriting-labels/`. It showed that a broad left-slot `1 -> 4` rescue would hit many true `1`s, but two narrow review-bound candidates caught the two SG3 misses without false positives in the combined check. Production OCR patch added only those narrow shape rescues in `src/ocr-pipeline.js`:

- right-slot `1 -> 4` when `4` is a meaningful runner-up and the strict tensor has heavy `4`-like ink.
- left-slot sparse/right-shifted `1 -> 4` for the split-crop `44 -> 14` failure.

Best replay is now:

```text
private-evidence/sg3-9-photo-confidence-20260606/candidate-four-from-one-rescues/
```

Best truth score:

- Confident answer coverage: `49/90` (`54.4%`).
- Confident answer accuracy vs handwriting: `49/49` (`100.0%`).
- Confident wrong answers: `0`.
- All-answer OCR accuracy vs handwriting: `90/90` (`100.0%`).
- Digit OCR accuracy vs handwriting: `180/180` (`100.0%`).
- Handwritten answers that differ from answer key: `19`.

The two previous OCR-wrong answers are now read correctly:

```text
2-Photo-2.jpg Q5 truth=44 predicted=44 key=42 review=true
3-Photo-3.jpg Q9 truth=14 predicted=14 key=14 review=true
```

Commands run:

```text
node scripts/eval_uploaded_worksheets.mjs --url https://127.0.0.1:5176 --out private-evidence/sg3-9-photo-confidence-20260606/candidate-four-from-one-rescues private-evidence/sg3-9-photo-confidence-20260606/1-Photo-1.jpg private-evidence/sg3-9-photo-confidence-20260606/2-Photo-2.jpg private-evidence/sg3-9-photo-confidence-20260606/3-Photo-3.jpg private-evidence/sg3-9-photo-confidence-20260606/4-Photo-4.jpg private-evidence/sg3-9-photo-confidence-20260606/5-Photo-5.jpg private-evidence/sg3-9-photo-confidence-20260606/6-Photo-6.jpg private-evidence/sg3-9-photo-confidence-20260606/7-Photo-7.jpg private-evidence/sg3-9-photo-confidence-20260606/8-Photo-8.jpg private-evidence/sg3-9-photo-confidence-20260606/9-Photo-9.jpg
npm run score:sg3-ocr -- --run private-evidence/sg3-9-photo-confidence-20260606/candidate-four-from-one-rescues
npm run analyze:sg3-confidence -- --run private-evidence/sg3-9-photo-confidence-20260606/candidate-four-from-one-rescues
npm run analyze:four-vs-one -- --sg3-run private-evidence/sg3-9-photo-confidence-20260606/candidate-four-from-one-rescues --out private-evidence/sg3-9-photo-confidence-20260606/four-vs-one-analysis-four-rescues
npm run analyze:review-reasons
npm run build
```

Verification:

- Full 9-photo upload replay processed all sheets with no failures.
- `npm run score:sg3-ocr -- --run private-evidence/sg3-9-photo-confidence-20260606/candidate-four-from-one-rescues` passed and wrote `truth-score.json` / `truth-score.md`.
- `npm run analyze:sg3-confidence -- --run private-evidence/sg3-9-photo-confidence-20260606/candidate-four-from-one-rescues` passed and wrote updated confidence reports.
- `npm run analyze:four-vs-one -- --sg3-run ...candidate-four-from-one-rescues` passed and shows `0` active SG3 `4 -> 1` cases. Older mixed evidence still contains two older-model/config `4 -> 1` cases, so treat older evidence as a cautionary guardrail rather than current-app failure.
- `npm run analyze:review-reasons` passed. It found no older wrong answers under the exact SG3 safe reason keys, but older runs used a different model/config and mostly different reason names.
- `npm run build` passed.

Confidence status after perfect OCR:

- Reviewed answers are now `41/90`; all `41` are OCR-correct on this run.
- The target still needs `86/90` confident answers, so ScanGrade must promote `37` of those `41` reviewed answers to hit `95%`.
- High-signal no-reason promotion reaches only `53/90`.
- Moderate no-reason mismatch promotion reaches only `54/90`.
- Evidence-only exact reason promotion reaches `83/90`.
- Evidence-only reasons plus moderate no-reason mismatch promotion reaches `88/90`, but this is not production-safe by itself because some low-probability rescues would become confident.
- Original chosen-digit probability analysis suggests a safer confidence policy can promote roughly `20` reviewed answers (`69/90` total confident) without trusting fragile rescues, but that is still below target.

Next technical move:

- Build a confidence policy around original chosen-digit probabilities, strong variant agreement, and review reason families, while keeping low-probability shape/split rescues yellow.
- If target `86/90` cannot be reached without trusting fragile rescues, gather more real completed worksheets or improve preprocessing/model confidence rather than broadening review clearance.

2026-06-07 / SG 3:
Built and verified the tightened production confidence policy. The policy separates actual review reasons from rescue overrides, allowlists only validated reason families, and adds a calibrated two-digit auto-X clearance only when the chosen digit probability and margin are both strong. A first broad candidate that used `robustOverride` as a clearance reason over-cleared to `90/90` confident answers and was rejected.

Best replay is now:

```text
private-evidence/sg3-9-photo-confidence-20260606/candidate-confidence-policy-tight-final-9/
```

Final truth score:

- Confident answer coverage: `88/90` (`97.8%`).
- Confident answer accuracy vs handwriting: `88/88` (`100.0%`).
- Confident wrong answers: `0`.
- All-answer OCR accuracy vs handwriting: `90/90` (`100.0%`).
- Digit OCR accuracy vs handwriting: `180/180` (`100.0%`).
- Target result: pass.

Remaining review/yellow answers:

```text
9-Photo-9.jpg Q2 truth=29 predicted=29 key=29 minConf=40.3% minGap=10.6% reasons=-
9-Photo-9.jpg Q6 truth=24 predicted=24 key=25 minConf=39.0% minGap=4.9% reasons=-
```

Commands run:

```text
npm run build
node scripts/eval_uploaded_worksheets.mjs --url https://127.0.0.1:5174 --out private-evidence/sg3-9-photo-confidence-20260606/candidate-confidence-policy-tight-final-9 private-evidence/sg3-9-photo-confidence-20260606/1-Photo-1.jpg private-evidence/sg3-9-photo-confidence-20260606/2-Photo-2.jpg private-evidence/sg3-9-photo-confidence-20260606/3-Photo-3.jpg private-evidence/sg3-9-photo-confidence-20260606/4-Photo-4.jpg private-evidence/sg3-9-photo-confidence-20260606/5-Photo-5.jpg private-evidence/sg3-9-photo-confidence-20260606/6-Photo-6.jpg private-evidence/sg3-9-photo-confidence-20260606/7-Photo-7.jpg private-evidence/sg3-9-photo-confidence-20260606/8-Photo-8.jpg private-evidence/sg3-9-photo-confidence-20260606/9-Photo-9.jpg
npm run score:sg3-ocr -- --run private-evidence/sg3-9-photo-confidence-20260606/candidate-confidence-policy-tight-final-9
npm run analyze:sg3-confidence -- --run private-evidence/sg3-9-photo-confidence-20260606/candidate-confidence-policy-tight-final-9
npm run analyze:four-vs-one -- --sg3-run private-evidence/sg3-9-photo-confidence-20260606/candidate-confidence-policy-tight-final-9 --out private-evidence/sg3-9-photo-confidence-20260606/four-vs-one-analysis-confidence-policy-tight-final-9
npm run analyze:review-reasons -- --sg3-run private-evidence/sg3-9-photo-confidence-20260606/candidate-confidence-policy-tight-final-9 --out private-evidence/sg3-9-photo-confidence-20260606/review-reason-holdout-confidence-policy-tight-final-9
npx playwright test test-app.spec.js test-upload.spec.js test-ocr.spec.js verify-single-pipeline.spec.js test-upload-real.spec.js export-crops-debug.spec.js --config=playwright.config.js
npm run build
```

Verification:

- Exact 9-photo replay processed all sheets with no failures.
- `npm run score:sg3-ocr -- --run ...candidate-confidence-policy-tight-final-9` passed and wrote `truth-score.json` / `truth-score.md`.
- Confidence analysis reports `88/90` current confident answers, `2/2` reviewed answers OCR-correct, and target `86/90`.
- Four-vs-one analysis shows `0` active SG3 `4 -> 1` cases; older mixed evidence still has two older-model/config guardrail cases.
- Review-reason holdout shows SG3 current: `90 total`, `90 correct`, `88 confident`, `2 reviewed`; older worksheet buckets remain reviewed rather than being newly promoted.
- Full Playwright suite passed: `11 passed`.
- Final `npm run build` passed with only the existing chunk-size warning.

Files changed in this pass:

```text
src/components/CameraCapture.vue
src/ocr-pipeline.js
vite.config.js
playwright.config.js
playwright.config.ts
test-upload-real.spec.js
scripts/score_sg3_9_photo_ocr.mjs
scripts/analyze_sg3_confidence_calibration.mjs
scripts/analyze_four_vs_one_crops.mjs
scripts/analyze_review_reason_holdout.mjs
package.json
docs/SG3_9_PHOTO_OCR_SCORECARD.json
docs/SG3_9_PHOTO_OCR_SCORECARD.md
docs/SG_THREAD_HANDOFF_PROTOCOL.md
SCANGRADE_ACTIVE_HANDOFF.md
mission-control/state/mission-state.json
```

2026-06-07 / SG 3:
Analyzed Tony's `/Users/openclaw/Desktop/4` live iPhone test batch and added a tracked handwritten-truth scorecard for it. The old exported public build was far too trusting on these rough captures:

- Answer OCR truth: `68/90`.
- Confident answers: `84/90`.
- Confident answer accuracy: `66/84`.
- Confident wrong answers: `18`.
- Review answers: `6`.
- Digit OCR truth: `155/180`.
- Confident digit wrong: `21`.

Added:

```text
docs/SG3_IPHONE_LIVE_OCR_SCORECARD.json
scripts/score_live_ocr_debug_truth.mjs
npm run score:live-ocr-truth
```

Important interpretation: these live truth labels score what the student wrote, not whether the student answer was mathematically correct.

2026-06-07 / SG 3:
Patched the app for live-camera safety and a slightly easier capture gate.

Production changes:

- Confidence policy is now source-aware: clean/non-camera upload evidence can clear validated review reasons, while camera captures stay stricter.
- Tightened two-digit auto-X calibration to `confidence >= 0.92` and `margin >= 0.50`.
- Review-bound OCR rescues and right-slot expected-edge conflicts cannot become automatic confident Xs.
- Added narrow right-slot `7` rescue paths and tightened two older left-slot rescue shapes.
- Eased auto-capture slightly for wrinkled live sheets: portrait hold `450ms -> 375ms`, centered tolerance `0.28 -> 0.30`, span threshold `0.34/0.42 -> 0.32/0.40`, soft perspective width/height `0.66/0.70 -> 0.63/0.67`, and tilt/lean `0.195 -> 0.22`. Focus/marker/page appearance gates were not loosened.
- Updated visible build label to `2026.06.07-0959-EDT-sg3-live-ocr-safety`.

Current clean 9-photo replay:

```text
private-evidence/sg3-9-photo-confidence-20260606/candidate-source-aware-confidence-2-20260607/
```

Score:

- Confident answer coverage: `89/90` (`98.9%`).
- Confident answer accuracy vs handwriting: `89/89` (`100.0%`).
- Confident wrong answers: `0`.
- All-answer OCR accuracy vs handwriting: `90/90` (`100.0%`).
- Target result: pass.

Current live iPhone replay:

```text
private-evidence/sg3-iphone-live-20260607/current-build-0959/
```

Score:

- Answer OCR truth: `72/90`.
- Confident answers: `53/90`.
- Confident answer accuracy: `53/53`.
- Confident wrong answers: `0`.
- Review answers: `37`.
- Digit OCR truth: `159/180`.
- Confident digit wrong: `0`.
- Guard rejected two unusable captures into all-review rather than trusting them: `1780835794316` and `1780836093776`.

Verification commands run:

```text
npm run score:sg3-ocr -- --run private-evidence/sg3-9-photo-confidence-20260606/candidate-source-aware-confidence-2-20260607
SG_REPLAY_URL=https://127.0.0.1:5174 npm run eval:live-ocr-captured -- --out-dir private-evidence/sg3-iphone-live-20260607/current-build-0959 /Users/openclaw/Desktop/4/scangrade-live-ocr-debug-*.json
npm run score:live-ocr-truth -- private-evidence/sg3-iphone-live-20260607/current-build-0959/*-replay-result.json
npm run build
npx playwright test test-app.spec.js test-upload.spec.js test-ocr.spec.js verify-single-pipeline.spec.js test-upload-real.spec.js export-crops-debug.spec.js --config=playwright.config.js
```

Verification results:

- `npm run build` passed with only the existing chunk-size warning.
- Focused Playwright suite passed: `11 passed`.
- Live replay still reports only `72/90` OCR truth, so future live work should focus on crop quality, preprocessing, and model signal before any broader confidence promotion.

2026-06-07 / SG 3:
Added Student Mode auto-capture burst selection for local candidate build `2026.06.07-1354-EDT-sg3-burst-capture`.

Production changes:

- Auto-capture now samples `5` frames after the stability gate fires, scores focus/contrast/marker sanity, and sends the best frame to OCR.
- The pre-capture focus gate was eased from `340` to `300` so a wrinkled but usable sheet can trigger the burst sooner.
- The final selected frame still has to pass the existing `340` focus threshold plus full sheet marker/page checks.
- Live debug `captureQuality` now records burst frame scores, selected index, best score, sheet status, and both focus thresholds.
- Manual Student Mode capture still captures a single frame.
- Updated visible build label to `2026.06.07-1354-EDT-sg3-burst-capture`.

Verification commands run:

```text
npm run build
node scripts/replay_live_ocr_captured.mjs --url https://127.0.0.1:5174 --out-dir private-evidence/sg3-iphone-live-20260607/burst-capture-1354 /Users/openclaw/Desktop/4/scangrade-live-ocr-debug-1780835744659.json /Users/openclaw/Desktop/4/scangrade-live-ocr-debug-1780835794316.json /Users/openclaw/Desktop/4/scangrade-live-ocr-debug-1780835835982.json /Users/openclaw/Desktop/4/scangrade-live-ocr-debug-1780835883256.json /Users/openclaw/Desktop/4/scangrade-live-ocr-debug-1780835922655.json /Users/openclaw/Desktop/4/scangrade-live-ocr-debug-1780835950761.json /Users/openclaw/Desktop/4/scangrade-live-ocr-debug-1780836030293.json /Users/openclaw/Desktop/4/scangrade-live-ocr-debug-1780836093776.json /Users/openclaw/Desktop/4/scangrade-live-ocr-debug-1780836133924.json
node scripts/score_live_ocr_debug_truth.mjs private-evidence/sg3-iphone-live-20260607/burst-capture-1354/*-replay-result.json
node scripts/eval_uploaded_worksheets.mjs --url https://127.0.0.1:5174 --out private-evidence/sg3-9-photo-confidence-20260606/burst-capture-1354 private-evidence/sg3-9-photo-confidence-20260606/1-Photo-1.jpg private-evidence/sg3-9-photo-confidence-20260606/2-Photo-2.jpg private-evidence/sg3-9-photo-confidence-20260606/3-Photo-3.jpg private-evidence/sg3-9-photo-confidence-20260606/4-Photo-4.jpg private-evidence/sg3-9-photo-confidence-20260606/5-Photo-5.jpg private-evidence/sg3-9-photo-confidence-20260606/6-Photo-6.jpg private-evidence/sg3-9-photo-confidence-20260606/7-Photo-7.jpg private-evidence/sg3-9-photo-confidence-20260606/8-Photo-8.jpg private-evidence/sg3-9-photo-confidence-20260606/9-Photo-9.jpg
npm run score:sg3-ocr -- --run private-evidence/sg3-9-photo-confidence-20260606/burst-capture-1354
npx playwright test test-app.spec.js test-ocr.spec.js test-upload-real.spec.js
```

Verification results:

- `npm run build` passed.
- Clean 9-photo truth score passed: `89/90` confident, `89/89` confident accuracy, `0` confident wrong, `90/90` all-answer OCR truth.
- Live iPhone still replay remained unchanged as expected: `72/90` answer OCR truth, `53/90` confident, `53/53` confident accuracy, `0` confident wrong.
- Playwright smoke/upload suite passed: `5 passed`.
- Important limitation: still replay cannot prove burst-capture improvement because burst selection happens before the still image exists. The next proof is live testing on Tony's phone.

2026-06-07 / SG 3:
Analyzed Tony's newest live iPhone test batch from `/Users/openclaw/Desktop/5/` against build `2026.06.07-1354-EDT-sg3-burst-capture`.

Evidence:

- 10 debug JSONs, 10 crop previews, and 11 screenshots.
- All debug JSONs confirmed `captureQuality.source = auto`, `burstFrameCount = 5`, and the burst build path.
- One debug JSON (`1780859247795`) was manually corrected after scanning; the touched predictions preserved `originalDigit`, so do not treat its post-correction answer groups as a clean raw-confidence score.

Finding:

- The burst mechanism works, but the app was still accepting selected frames that were too soft for reliable classroom OCR.
- In `/Users/openclaw/Desktop/5`, captures with selected-frame focus below `650` averaged `4.6/10` confident answers and high review counts.
- Captures with selected-frame focus at or above `650` averaged `7.6/10` confident answers.
- Still-visible OCR/model misses remain on sharper scans, especially around thin/right-slot `9`, `2`, and some ambiguous second digits, so this capture patch is not the full 95% confidence solution.

Production changes:

- Added build label `2026.06.07-1525-EDT-sg3-sharp-auto-capture`.
- Kept the eased auto pre-capture focus gate at `300`.
- Added an auto-only final focus threshold of `650` before OCR.
- Extended auto burst capture from `5` frames at `85ms` spacing to `8` frames at `110ms` spacing so phone autofocus has longer to settle.
- Manual Student Mode capture still uses the older final focus threshold of `340`.
- `captureQuality` now records `manualFocusThreshold` and `autoFinalFocusThreshold`.

Verification commands run:

```text
npm run build
npx playwright test test-app.spec.js test-ocr.spec.js test-upload-real.spec.js --config=playwright.config.js
node scripts/eval_uploaded_worksheets.mjs --url https://127.0.0.1:5174 --out private-evidence/sg3-9-photo-confidence-20260606/sharp-auto-capture-1525 private-evidence/sg3-9-photo-confidence-20260606/1-Photo-1.jpg private-evidence/sg3-9-photo-confidence-20260606/2-Photo-2.jpg private-evidence/sg3-9-photo-confidence-20260606/3-Photo-3.jpg private-evidence/sg3-9-photo-confidence-20260606/4-Photo-4.jpg private-evidence/sg3-9-photo-confidence-20260606/5-Photo-5.jpg private-evidence/sg3-9-photo-confidence-20260606/6-Photo-6.jpg private-evidence/sg3-9-photo-confidence-20260606/7-Photo-7.jpg private-evidence/sg3-9-photo-confidence-20260606/8-Photo-8.jpg private-evidence/sg3-9-photo-confidence-20260606/9-Photo-9.jpg
npm run score:sg3-ocr -- --run private-evidence/sg3-9-photo-confidence-20260606/sharp-auto-capture-1525
node scripts/replay_live_ocr_captured.mjs --url https://127.0.0.1:5174 --out-dir private-evidence/sg3-iphone-live-20260607/sharp-auto-capture-1525 /Users/openclaw/Desktop/4/scangrade-live-ocr-debug-1780835744659.json /Users/openclaw/Desktop/4/scangrade-live-ocr-debug-1780835794316.json /Users/openclaw/Desktop/4/scangrade-live-ocr-debug-1780835835982.json /Users/openclaw/Desktop/4/scangrade-live-ocr-debug-1780835883256.json /Users/openclaw/Desktop/4/scangrade-live-ocr-debug-1780835922655.json /Users/openclaw/Desktop/4/scangrade-live-ocr-debug-1780835950761.json /Users/openclaw/Desktop/4/scangrade-live-ocr-debug-1780836030293.json /Users/openclaw/Desktop/4/scangrade-live-ocr-debug-1780836093776.json /Users/openclaw/Desktop/4/scangrade-live-ocr-debug-1780836133924.json
npm run score:live-ocr-truth -- private-evidence/sg3-iphone-live-20260607/sharp-auto-capture-1525/*-replay-result.json
```

Verification results:

- `npm run build` passed.
- Focused Playwright suite passed: `5 passed`.
- Clean 9-photo truth score still passed: `89/90` confident, `89/89` confident accuracy, `0` confident wrong, `90/90` all-answer OCR truth.
- Older live iPhone still replay stayed safe: `72/90` answer OCR truth, `53/90` confident, `53/53` confident accuracy, `0` confident wrong, `159/180` digit OCR truth.
- The live replay command exited nonzero because two old still captures were intentionally guarded as unusable/all-review; the truth scorer confirms no confident-wrong regression.
- Next proof must be a new live phone scan on `2026.06.07-1525-EDT-sg3-sharp-auto-capture`.

2026-06-07 / SG 3:
Tony tested on an old iPad and reported that capture looked much better, but the result panel showed: "Try again. The grading engine did not finish loading. Scan saved for teacher review." The screenshot showed a clean, full-page worksheet image, so this was not primarily a capture/homography failure. It indicated old-iPad OCR runtime/model initialization fragility after successful capture.

Production changes for build `2026.06.07-1745-EDT-sg3-old-ipad-engine-fallback`:

- Student Mode now starts warming `initDigitModel()` as soon as the scan view opens, giving older Safari/iPad hardware a head start before OCR begins.
- `initDigitModel()` now shares one in-flight model initialization promise, avoiding duplicate ONNX/WASM/model loads when warmup and grading overlap.
- Auxiliary right-slot model load/run failure now disables that optional model for the current path and falls back to the primary digit model rather than failing the entire scan.
- Debug model info records `rightSlot.unavailable`, `rightSlot.unavailableReason`, and `rightSlot.fallback = "primary digit model"` when that fallback is used.
- No capture thresholds, homography behavior, or confidence policy gates were loosened.

Verification commands run:

```text
node scripts/eval_uploaded_worksheets.mjs --url https://127.0.0.1:5174 --model /models/worksheet-digit-tony-generalist-noaug-20260601.onnx --right-slot-model /models/missing-right-slot-old-ipad-test.onnx --out private-evidence/sg3-old-ipad-engine-fallback-20260607/missing-right-slot /tmp/codex-remote-attachments/019e9a57-ed9d-78a0-b620-e58b9ee66c3c/8F0CA1D8-C947-46A6-AAD9-CA51F5F84A9C/1-Photo-1.jpg
node scripts/eval_uploaded_worksheets.mjs --url https://127.0.0.1:5174 --out private-evidence/sg3-9-photo-confidence-20260606/old-ipad-engine-fallback-1745 private-evidence/sg3-9-photo-confidence-20260606/1-Photo-1.jpg private-evidence/sg3-9-photo-confidence-20260606/2-Photo-2.jpg private-evidence/sg3-9-photo-confidence-20260606/3-Photo-3.jpg private-evidence/sg3-9-photo-confidence-20260606/4-Photo-4.jpg private-evidence/sg3-9-photo-confidence-20260606/5-Photo-5.jpg private-evidence/sg3-9-photo-confidence-20260606/6-Photo-6.jpg private-evidence/sg3-9-photo-confidence-20260606/7-Photo-7.jpg private-evidence/sg3-9-photo-confidence-20260606/8-Photo-8.jpg private-evidence/sg3-9-photo-confidence-20260606/9-Photo-9.jpg
npm run score:sg3-ocr -- --run private-evidence/sg3-9-photo-confidence-20260606/old-ipad-engine-fallback-1745
npm run build
npx playwright test test-app.spec.js test-ocr.spec.js test-upload-real.spec.js --config=playwright.config.js
node scripts/replay_live_ocr_captured.mjs --url https://127.0.0.1:5174 --out-dir private-evidence/sg3-iphone-live-20260607/old-ipad-engine-fallback-1745 /Users/openclaw/Desktop/4/scangrade-live-ocr-debug-*.json
npm run score:live-ocr-truth -- private-evidence/sg3-iphone-live-20260607/old-ipad-engine-fallback-1745/*-replay-result.json
```

Verification results:

- Forced missing right-slot model replay produced `20` predictions with no OCR error and debug fallback metadata: `rightSlot.loaded = false`, `rightSlot.unavailable = true`, `rightSlot.fallback = "primary digit model"`.
- `npm run build` passed.
- Focused Playwright suite passed: `5 passed`.
- Clean 9-photo truth score stayed at `89/90` confident, `89/89` confident accuracy, `0` confident wrong, `90/90` all-answer OCR truth.
- Older live iPhone still replay stayed safe: `72/90` answer OCR truth, `53/90` confident, `53/53` confident accuracy, `0` confident wrong, `159/180` digit OCR truth.
- The live replay command exited nonzero because two old still captures were intentionally guarded as unusable/all-review; the truth scorer confirms no confident-wrong regression.
- Next proof must be a live old-iPad retest on `2026.06.07-1745-EDT-sg3-old-ipad-engine-fallback`.

2026-06-07 / SG 3:
Tony retested build `2026.06.07-1745-EDT-sg3-old-ipad-engine-fallback` on the old iPad and saw the same "Try again / The grading engine did not finish loading" message. The screenshot showed the new build label and a clean full-page worksheet capture, proving that deployment, QR routing, capture, and homography were not the cause. The auxiliary right-slot fallback was insufficient; the old iPad is likely failing the primary ONNX/WASM digit engine itself.

Production changes for build `2026.06.07-1841-EDT-sg3-old-ipad-review-save`:

- `CameraCapture.runRealOCR()` no longer initializes the digit engine before homography/crop processing. It preserves the captured worksheet and OCR crop context first.
- If primary digit model initialization or inference fails after a recognized worksheet capture, the app now builds review-only predictions with `digit: null`, `confidence: 0`, `reviewNeeded: true`, and `forcedReviewReason = "digit-engine-unavailable-review"` or `"digit-engine-inference-failed-review"`.
- Review-only engine fallback suppresses `questionCorrect` and `questionScore`, so the teacher queue does not show a fake `0/10` grade.
- The result payload records `digitEngineFallback`, `digitEngineError`, `reviewOnlyFallback`, and `forcedFallbackReviewReason` for future debugging.
- Normal OCR confidence, capture thresholds, homography, and model behavior were not loosened.

Reproducible old-iPad stand-in:

```text
node scripts/eval_uploaded_worksheets.mjs --url https://127.0.0.1:5174 --model /models/missing-primary-old-ipad-test.onnx --out private-evidence/sg3-old-ipad-primary-failure-20260607/before private-evidence/sg3-9-photo-confidence-20260606/1-Photo-1.jpg
node scripts/eval_uploaded_worksheets.mjs --url https://127.0.0.1:5174 --model /models/missing-primary-old-ipad-test.onnx --out private-evidence/sg3-old-ipad-primary-failure-20260607/after private-evidence/sg3-9-photo-confidence-20260606/1-Photo-1.jpg
node scripts/eval_uploaded_worksheets.mjs --url https://127.0.0.1:5174 --out private-evidence/sg3-old-ipad-primary-failure-20260607/normal-9 private-evidence/sg3-9-photo-confidence-20260606/1-Photo-1.jpg private-evidence/sg3-9-photo-confidence-20260606/2-Photo-2.jpg private-evidence/sg3-9-photo-confidence-20260606/3-Photo-3.jpg private-evidence/sg3-9-photo-confidence-20260606/4-Photo-4.jpg private-evidence/sg3-9-photo-confidence-20260606/5-Photo-5.jpg private-evidence/sg3-9-photo-confidence-20260606/6-Photo-6.jpg private-evidence/sg3-9-photo-confidence-20260606/7-Photo-7.jpg private-evidence/sg3-9-photo-confidence-20260606/8-Photo-8.jpg private-evidence/sg3-9-photo-confidence-20260606/9-Photo-9.jpg
node scripts/score_sg3_9_photo_ocr.mjs --run private-evidence/sg3-old-ipad-primary-failure-20260607/normal-9 --out private-evidence/sg3-old-ipad-primary-failure-20260607/normal-9-score
npm run build
npx playwright test test-app.spec.js test-ocr.spec.js test-upload-real.spec.js --config=playwright.config.js
```

Verification results:

- Before patch, forced missing primary model failed the sheet with `ONNX model not found at /models/missing-primary-old-ipad-test.onnx`.
- After patch, the same forced missing primary model produced no fatal OCR error, `questionCorrect = null`, `questionReviewCount = 10`, `20/20` review-needed predictions, `digitEngineFallback = true`, and `forcedFallbackReviewReason = "digit-engine-unavailable-review"`.
- Student Mode forced-primary failure saved a local teacher-review record with `status = "review"`, `needsReview = true`, twenty `null` digit slots, `questionCorrect = null`, and `questionScore = null`.
- Clean 9-photo truth score stayed at `89/90` confident, `89/89` confident accuracy, `0` confident wrong, `90/90` all-answer OCR truth.
- `npm run build` passed.
- Focused Playwright suite passed: `5 passed`.
- Next proof must be a live old-iPad retest on `2026.06.07-1841-EDT-sg3-old-ipad-review-save`. Expected old-iPad behavior if ONNX still cannot run: no score, no green/red grading, but a real saved scan with yellow teacher-review regions instead of "Try again."

2026-06-10 / SG 3:
Tony asked whether the current worksheet format is versatile enough for hundreds of Grade 1-3 classroom worksheet variations before locking in worksheet design. Codex researched the Ontario Grade 1-3 math curriculum and common printable worksheet categories, then created a controlled 10-sheet Grade 1-3 curriculum probe packet.

What changed:

- Added `docs/CURRICULUM_PROBE_G1_G3_MATRIX.md`.
- Added `scripts/generate_curriculum_probe_worksheets.mjs`.
- Generated a separate probe packet under `public/worksheets/curriculum-probe-g1-g3/`.
- Generated scan-loadable layouts under both `public/layouts/sg-probe-*.json` and `layouts/sg-probe-*.json`.
- Generated packet files:
  - `public/worksheets/curriculum-probe-g1-g3/index.html`
  - `public/worksheets/curriculum-probe-g1-g3/manifest.json`
  - `public/worksheets/curriculum-probe-g1-g3/teacher-answer-key.html`
  - `public/worksheets/curriculum-probe-g1-g3/printables/ScanGrade-Grade1-3-Curriculum-Probe-Packet.pdf`
  - `public/worksheets/curriculum-probe-g1-g3/printables/ScanGrade-Grade1-3-Curriculum-Probe-Answer-Key.pdf`

Probe contents:

- CP01 Grade 1 Addition and Subtraction Within 20, two slots, supported.
- CP02 Grade 1 Numbers and Place Value to 50, two slots, supported.
- CP03 Grade 1 Patterns and Missing Numbers, two slots, supported.
- CP04 Grade 2 Addition and Subtraction Within 100, two slots, supported.
- CP05 Grade 2 Place Value to 200, three slots, stress.
- CP06 Grade 2 Equal Groups and Sharing, two slots, supported.
- CP07 Grade 2 Money in Cents, three slots, stress.
- CP08 Grade 3 Addition and Subtraction to 1000, three slots, stress.
- CP09 Grade 3 Multiplication and Division Facts, three slots, stress.
- CP10 Grade 3 Measurement, Data, and Time Numbers, three slots, future/stress.

Important product interpretation:

- Grade 1-3 Ontario whole-number expectations top out at 50, 200, and 1000 respectively.
- Four- and five-digit whole-number answers are Grade 4-5 surfaces, not part of the Grade 1-3 readiness claim.
- This packet intentionally keeps answers numeric-only. Fractions, inequality symbols, dollar decimals, time notation, units in answer boxes, student-drawn graphs/shapes/clocks, and process grading remain separate future parser/review surfaces.

Commands run:

```text
node scripts/generate_curriculum_probe_worksheets.mjs
qlmanage -t -s 1600 -o /tmp/sg-probe-ql2 public/worksheets/curriculum-probe-g1-g3/cp05-grade2-place-value-to-200.svg
qlmanage -t -s 1600 -o /tmp/sg-probe-ql4 public/worksheets/curriculum-probe-g1-g3/cp08-grade3-add-sub-to-1000.svg
qlmanage -t -s 1600 -o /tmp/sg-probe-ql4 public/worksheets/curriculum-probe-g1-g3/cp10-grade3-measurement-data-time.svg
node -e "const fs=require('fs'); const manifest=JSON.parse(fs.readFileSync('public/worksheets/curriculum-probe-g1-g3/manifest.json','utf8')); for (const t of manifest.templates){ const layout=JSON.parse(fs.readFileSync('public/layouts/'+t.layout_id+'.json','utf8')); if(layout.question_groups.length!==10) throw new Error(t.layout_id+' groups'); if(layout.boxes.length!==t.answer_box_count) throw new Error(t.layout_id+' boxes'); if(layout.boxes.length!==10*t.answer_slots_per_question) throw new Error(t.layout_id+' slot count'); if(!t.qr_payload_url.includes('SG1%3A'+t.layout_id+'%3A')) throw new Error(t.layout_id+' qr'); } console.log('curriculum probe manifest/layout structure ok:', manifest.templates.length, 'templates')"
npm run build
```

Verification results:

- Generator completed and produced 10 SVG worksheets, QR images, layout JSON files, HTML index, answer key, and two PDFs.
- Visual QA caught and fixed three-slot prompt/bubble overlap on CP05/CP08/CP10.
- Final visual QA on CP05, CP08, and CP10 showed clean prompt/bubble separation and usable three-slot answer boxes.
- Structural check passed: `curriculum probe manifest/layout structure ok: 10 templates`.
- `npm run build` passed.
- No OCR, capture, homography, iPad, confidence policy, app UI, or model code was changed for this packet.

Rollback point:

- No commit was created in this turn.
- Remove the new `docs/CURRICULUM_PROBE_G1_G3_MATRIX.md`, `scripts/generate_curriculum_probe_worksheets.mjs`, `public/worksheets/curriculum-probe-g1-g3/`, and `sg-probe-*` layout JSON files to remove the probe packet.

Next action:

- Print or open `public/worksheets/curriculum-probe-g1-g3/printables/ScanGrade-Grade1-3-Curriculum-Probe-Packet.pdf`.
- Classroom-test a small subset first: CP01, CP04, CP05, CP08, and CP10 are the highest-information first pass.
- Score results by handwritten truth, not just answer key, and separate scan success, QR/layout success, OCR truth, confident-read coverage, confident-wrong count, review count, and student-writing behavior.

2026-06-10 / SG 3 worksheet layout correction:
Tony reviewed the generated Grade 1-3 curriculum probe packet and caught several printed-layout problems before classroom use:

- Some word-heavy two-slot sheets had letter bubbles overlapping prompt text.
- CP07-CP10 three-slot right-column bubbles sat too far into the center gutter, visually closer to left-column questions than to their own prompts.
- CP09 was the clearest example of the center-gutter attachment problem.

What changed:

- Updated `scripts/generate_curriculum_probe_worksheets.mjs` only.
- Regenerated all probe SVG, PDF, QR, manifest, answer-key, and layout outputs.
- Three-slot right-column bubbles now sit closer to their own right-column prompts.
- Two-slot right-column labels now leave enough clearance for prompts such as `100 - 47`.
- Compact/blank/sequence prompts now use a wider label lane.
- Existing-equals prompts no longer get an extra trailing equals sign in the rendered SVG.
- Shortened several probe prompts that were too long for the current two-column printed format:
  - CP02 uses shorter place-value prompts such as `30 + 5`, `36 + 3`, and `5,10,15,__`.
  - CP03 uses tighter missing-number notation.
  - CP06 abbreviates group prompts as `grps`.
  - CP10 shortens measurement/data wording such as `perim`, `mode 18,18`, and `half turn deg`.

Verification:

- Visual QA via Quick Look thumbnails checked CP01, CP02, CP03, CP04, CP05, CP06, CP07, CP09, and CP10 after regeneration.
- CP02, CP03, and CP06 no longer have letter bubbles overlapping prompt text.
- CP07, CP09, and CP10 right-column bubbles now read as attached to their own questions instead of the opposite column.
- Structural check passed: `curriculum probe manifest/layout structure ok: 10 templates`.
- `npm run build` passed.
- No OCR, capture, homography, iPad, confidence policy, app UI, or model code changed.

2026-06-12 / SG 3 Grade 1-2 curriculum probe V2:
Tony narrowed the next classroom-test packet to Grade 1 and Grade 2 only, with more realistic student work space and more varied worksheet layouts. The key design decision is that ScanGrade grades only final numeric answer boxes; diagrams and work areas are printed for student thinking and teacher review, not OCR scoring.

New planning doc:

```text
docs/CURRICULUM_PROBE_G1_G2_V2_PLAN.md
```

New generator:

```text
scripts/generate_curriculum_probe_g1_g2_v2_worksheets.mjs
```

Generated packet:

```text
public/worksheets/curriculum-probe-g1-g2-v2/index.html
public/worksheets/curriculum-probe-g1-g2-v2/manifest.json
public/worksheets/curriculum-probe-g1-g2-v2/teacher-answer-key.html
public/worksheets/curriculum-probe-g1-g2-v2/printables/ScanGrade-Grade1-2-Curriculum-Probe-V2-Packet.pdf
public/worksheets/curriculum-probe-g1-g2-v2/printables/ScanGrade-Grade1-2-Curriculum-Probe-V2-Answer-Key.pdf
```

Generated layout JSON was written to all expected places:

```text
public/worksheets/curriculum-probe-g1-g2-v2/layouts/
public/layouts/sg-v2-*.json
layouts/sg-v2-*.json
```

V2 sheet set:

- SG-V2-G1-01 Addition and Subtraction Within 20, 8 questions, fact rows with work line.
- SG-V2-G1-02 Ten Frames to 20, 6 questions, visual count cards.
- SG-V2-G1-03 Dot Collections to 20, 6 questions, visual count cards.
- SG-V2-G1-04 Number Bonds to 20, 6 questions, part-part-whole diagram layout.
- SG-V2-G1-05 Number Patterns and Missing Numbers, 6 questions, answer boxes embedded in sequences.
- SG-V2-G2-06 Two-Digit Addition, Stacked, 6 questions, standard vertical algorithm.
- SG-V2-G2-07 Two-Digit Subtraction, Stacked, 6 questions, standard vertical algorithm.
- SG-V2-G2-08 Place Value to 200, 6 questions, three-slot work cards.
- SG-V2-G2-09 Equal Groups and Sharing, 6 questions, work-card layout.
- SG-V2-G2-10 Money in Cents, 6 questions, three-slot work cards.

Important implementation notes:

- Letter bubbles use fixed column rails and are centered on the full question block, not just the final answer box.
- Six-question layouts intentionally trade question count for student work space.
- Number-bond prompt text was removed after visual QA because it collided with missing-total answer boxes; the diagram now carries the task.
- The packet did not change OCR, capture, homography, iPad fallback, confidence policy, model files, or app UI logic.

Verification:

- Generated all SVG worksheets, QR images, layout JSON files, HTML index, answer key, and PDFs with `node scripts/generate_curriculum_probe_g1_g2_v2_worksheets.mjs`.
- Full-page Playwright visual QA checked SG-V2-G1-01, SG-V2-G1-02, SG-V2-G1-04, SG-V2-G1-05, SG-V2-G2-06, SG-V2-G2-08, SG-V2-G2-09, and SG-V2-G2-10.
- Visual QA fixed the work-card work bands and number-bond text collision before final regeneration.
- Structural check passed: `g1-g2 v2 manifest/layout structure ok: 10 templates`.
- `npm run build` passed.

Next action:

- Open or print `public/worksheets/curriculum-probe-g1-g2-v2/printables/ScanGrade-Grade1-2-Curriculum-Probe-V2-Packet.pdf`.
- Classroom-test with students before summer break, then score separately for scan success, QR/layout success, handwritten-truth OCR accuracy, confident-read coverage, confident-wrong count, and review count.

## 2026-07-01 / SG 3 Classroom Debug Packet Rescan

What changed:

- Tony scanned the Grade 1 last-week packet through the public debug-upload link on an iPhone 16.
- Mission Control received 9 completed page uploads; page 10 got stuck on "grading" and never uploaded.
- The local Mission Control receiver was running with `SG_DEBUG_UPLOAD_TOKEN=sg3classroom node mission-control/server.mjs` and the tailnet route was reachable.
- A narrow OCR patch was made for the highest-frequency failure family in the received pages: handwritten left-slot `1`s in two-digit answer boxes being read as `7`, `4`, `8`, or `9`.
- A digit-engine timeout guard was added so a stalled model operation can fall back to saved teacher review instead of leaving the scanner spinning with no debug artifact.
- Visible build label changed to `2026.07.01-2220-EDT-sg3-left-slot-timeout`.

Evidence used:

```text
private-evidence/debug-scans/2026-07-01/2026-07-01_21-42-01-660-sg-g1-lw-07-dot-collections-7d7f6066
private-evidence/debug-scans/2026-07-01/2026-07-01_21-42-10-500-sg-g1-lw-06-ten-frames-6e00d7f1
private-evidence/debug-scans/2026-07-01/2026-07-01_21-42-18-443-sg-g1-lw-01-add-1digit-11738328
private-evidence/debug-scans/2026-07-01/2026-07-01_21-42-28-270-sg-g1-lw-02-add-2digit-4b87402b
private-evidence/debug-scans/2026-07-01/2026-07-01_21-42-37-394-sg-g1-lw-03-sub-1digit-9960366f
private-evidence/debug-scans/2026-07-01/2026-07-01_21-42-53-505-sg-g1-lw-04-sub-2digit-8c2f4f42
private-evidence/debug-scans/2026-07-01/2026-07-01_21-43-40-999-sg-g1-lw-05-mixed-20-2e6fd780
private-evidence/debug-scans/2026-07-01/2026-07-01_21-43-59-139-sg-g1-lw-08-number-bonds-dc760005
private-evidence/debug-scans/2026-07-01/2026-07-01_21-44-09-274-sg-g1-lw-09-number-patterns-f8e34890
```

Results:

- All 9 completed uploads had `qr_decode_source: full-frame:direct`; the QR/layout fallback bug was not the issue in this batch.
- No `sg-g1-lw-10-place-value-50` folder appeared for the July 1 packet run, confirming page 10 failed before debug upload.
- Saved-JSON simulation of the left-slot `1` rule changed 5 left-slot digits, improved answer-key outcomes from `19/64` to `22/64`, and introduced `0` answer-key regressions across the 9 completed packet pages.
- This simulation is not a handwritten-truth score; it is a regression guard. Visual inspection confirmed the changed cases are the handwritten left-slot `1` family.

Commands run:

```text
npm run build
npm run build:github
node -e <July 1 saved-debug simulation>
```

Files changed:

```text
src/ocr-pipeline.js
src/components/CameraCapture.vue
src/App.vue
SCANGRADE_ACTIVE_HANDOFF.md
```

Rollback point:

```text
Previous pushed source commit before this patch: 2ca91b0 Guard missing QR layout fallback
Previous public deploy commit before this patch: 822838e Deploy QR fallback guard build
```

Next action:

- Commit and deploy this patch to `gh-pages`.
- Ask Tony to refresh the public debug link and rescan page 10 alone first, then one two-digit page and one number-bond page.
- Confirm the visible build label is `2026.07.01-2220-EDT-sg3-left-slot-timeout`.

Open risks:

- Page 10 hang is not yet reproduced with a saved artifact; the timeout guard should make the next failure observable as an `ocr-error`/review-save bundle if it happens again.
- Visual-format pages still over-review heavily and need separate layout/crop/OCR analysis after the left-slot `1` family is handled.
- Do not call the varied Grade 1 packet reliable yet; this patch is a narrow evidence-backed fix.

## 2026-07-01 / Post-Deploy Debug Rescans

What happened:

- Tony rescanned page 10 using the public debug-upload link for build `2026.07.01-2220-EDT-sg3-left-slot-timeout`.
- Page 10 no longer got stuck on "grading"; Mission Control received a complete `ocr-complete` bundle.
- Tony then scanned one more two-digit-style sheet; Mission Control also received a complete bundle.

New evidence:

```text
private-evidence/debug-scans/2026-07-01/2026-07-01_23-54-29-490-sg-g1-lw-10-place-value-50-fd76390e
private-evidence/debug-scans/2026-07-01/2026-07-01_23-55-43-064-sg-g1-lw-05-mixed-20-92967803
```

Observed results:

- Page 10 summary: `uploadReason: ocr-complete`, `qr_decode_source: full-frame:direct`, `digitEngineFallback: false`, `digitEngineError: null`, score `4/6`, review count `2`.
- The timeout guard appears to have fixed the page-10 hang/recovery problem for this scan.
- Page 10 still misread/reviewed visually readable but border-hugging answers:
  - C (`before 50`) student wrote `49`; raw left-digit crop included a partial `4`, but model output was `1`.
  - E (`10 + 10 + 10`) student wrote `30`; raw crops showed a clear-ish `3` and a clipped `0`, but model output was `52` and correctly stayed in review.
- The second two-digit-style scan (`sg-g1-lw-05-mixed-20`) completed with score `3/8`, review count `5`, needs-review count `7`.
- The new `left-slot-one-weighted-vote` rule fired on A and C of the second scan, but A still stayed yellow because the confidence layer did not clear it; H was a harder miss with variant disagreement between `1`, `9`, and `7`.

Rejected experiment:

- Tried temporarily removing the decisive-`1` block from `left-slot-sparse-four-shape-from-one-rescue`.
- Replay command:

```text
node scripts/eval_live_ocr_production.mjs --url https://localhost:5174 /tmp/sg-live-debug-unwrapped/*.json
```

- The experiment did not fix page 10 C and introduced additional `1 -> 4` risk on other saved scans, so it was immediately reverted.
- Current source diff after the revert: no OCR source diff from the rejected experiment.

Current diagnosis:

- QR/layout/upload path is working on the new build.
- The remaining reliability bottleneck is two-digit slot crop/segmentation plus the digit model's handling of border-hugging Grade 1 handwriting.
- Do not simply raise confidence on `left-slot-one-weighted-vote`; page 10 C proves that a visually written `4` can collapse into a decisive model `1` when the crop/processing loses shape context.

Recommended next action:

- Build a targeted eval set from the new `private-evidence/debug-scans/2026-07-01` bundles with handwritten-truth labels, especially page 10 C/E and mixed-sheet A/F/G/H.
- Prototype crop/variant changes for border-hugging digits and replay from captured images, not saved tensors, because crop changes require reprocessing the original captured image.
- Keep public build `2026.07.01-2220-EDT-sg3-left-slot-timeout` live until a crop-level patch passes replay.

## 2026-07-01 / Optional Leading Digit Review Patch

What changed:

- A rejected `faint-pencil-slot` crop/preprocess experiment was removed; it did not improve the two latest rescans and was not shipped.
- Added a narrow confidence-policy guard for two-slot answer boxes whose correct answer is single digit.
- If the left slot is optional in the answer key but the OCR sees an extra leading digit, ScanGrade now requires stronger evidence (`confidence >= 0.92` and `topGap >= 0.50`) before avoiding teacher review.
- Mirrored the same rule in `scripts/replay_live_ocr_captured.mjs` so future app-level replays test the same policy.
- Visible build label changed to `2026.07.01-2230-EDT-sg3-optional-leading-review`.

Why:

- In the latest `sg-g1-lw-05-mixed-20` scan, question B expected a single-digit answer (`7`) but the student wrote a two-digit wrong answer. The OCR read the optional leading slot as `7` with confidence `0.824`, producing `72`. Previously that leading digit was not yellow because the answer key had `null` for the optional slot.
- This is not a digit-recognition fix; it is a trust/routing fix so uncertain unexpected leading digits go to review instead of silently becoming part of an automatic wrong answer.

Evidence used:

```text
private-evidence/debug-scans/2026-07-01/2026-07-01_23-54-29-490-sg-g1-lw-10-place-value-50-fd76390e
private-evidence/debug-scans/2026-07-01/2026-07-01_23-55-43-064-sg-g1-lw-05-mixed-20-92967803
```

Verification:

```text
node scripts/score_live_ocr_debug_truth.mjs --truth /tmp/sg-latest-truth.json /tmp/sg-live-debug-unwrapped/2026-07-01_23-54-29-490-sg-g1-lw-10-place-value-50-fd76390e.json /tmp/sg-live-debug-unwrapped/2026-07-01_23-55-43-064-sg-g1-lw-05-mixed-20-92967803.json
node scripts/eval_live_ocr_reprocess.mjs --url https://localhost:5174 --grid /tmp/sg-live-debug-unwrapped/2026-07-01_23-54-29-490-sg-g1-lw-10-place-value-50-fd76390e.json /tmp/sg-live-debug-unwrapped/2026-07-01_23-55-43-064-sg-g1-lw-05-mixed-20-92967803.json
node scripts/replay_live_ocr_captured.mjs --allow-imperfect --url https://localhost:5174 --out-dir /tmp/sg-replay-after-leading /tmp/sg-live-debug-unwrapped/2026-07-01_23-54-29-490-sg-g1-lw-10-place-value-50-fd76390e.json /tmp/sg-live-debug-unwrapped/2026-07-01_23-55-43-064-sg-g1-lw-05-mixed-20-92967803.json
npm run build
```

Key outputs:

- Handwritten-truth score on the two latest saved debug JSONs before this patch: `Answer OCR truth: 8/14`, `Confident answers: 7/14`, `Confident answer accuracy: 6/7`, `Confident wrong answers: 1`.
- App-level replay after the patch: page 10 remains `qscore=4/6`, `qreview=2`, guard pass.
- App-level replay after the patch: mixed sheet is forced into review by the existing unusable-scan guard, and the optional leading slots now show `two-digit-optional-leading-digit-review`.
- Confirmed in `/tmp/sg-replay-after-leading/2026-07-01_23-55-43-064-sg-g1-lw-05-mixed-20-92967803-replay-result.json` that q2 left slot has `reviewNeeded: true`, `unexpectedLeadingDigitReview: true`, `preprocessReviewReason: two-digit-optional-leading-digit-review`.
- `npm run build` passed.

Files changed in this patch:

```text
src/components/CameraCapture.vue
src/App.vue
scripts/replay_live_ocr_captured.mjs
SCANGRADE_ACTIVE_HANDOFF.md
```

Current receiver status:

- Local dev server and Mission Control server were running.
- The extra "one more 2-digit page" Tony mentioned after the 23:55 scan was not found under `private-evidence/debug-scans`; latest visible saved bundles remain the 23:54 and 23:55 folders above.

Open risks:

- This patch should reduce silent trust errors for optional leading digits, but it does not improve crop/model recognition of border-hugging handwritten `4`, `3`, or `0`.
- The big reliability jump to 90-95% confident reads still likely requires turning the classroom scans into labeled training/eval data, not more hand-tuned crop guesses.

## 2026-07-02 Classroom Calibration Batch Tuning

Tony uploaded the next classroom calibration batch: 62 post-checkpoint debug summaries were visible, with 54 valid Grade 1 packet scans replayed and 8 excluded/invalid scans. The replay input set used for this pass is:

```text
/tmp/sg-calibration-20260702-unwrapped/*.json
```

Patch made:

- Added a bounded left-slot `7 -> 1` shape rescue for two-slot answer boxes where the expected left digit is `1`, the model confidently chose `7`, and the raw-border tensor has one-stroke `1` geometry. This targets the observed left-slot weakness without globally changing `7`s.
- Added a single-slot `6`/`5` high-risk mismatch review guard. It does not rewrite the digit; it sends expected-`6`, predicted-`5`, confidence `< 0.90` cases to yellow review. This caught one real OCR miss (`3 + 3`, handwritten `6`, predicted `5`) while preserving red Xs for visually wrong student answers.
- Mirrored both policies in `scripts/replay_live_ocr_captured.mjs`.
- Added debug fields for shape rescues: `originalDigitBeforeShapeRescue`, `originalConfidenceBeforeShapeRescue`, and `highRiskSingleDigitMismatchReview`.
- Visible build label changed to `2026.07.02-1212-EDT-sg3-leftslot-rescue-guard`.

Verification:

```text
node --check scripts/replay_live_ocr_captured.mjs
npm run build
SG_REPLAY_URL=https://127.0.0.1:5175 node scripts/replay_live_ocr_captured.mjs --allow-imperfect --out-dir /tmp/sg-calibration-leftslot-rescue-v3 /tmp/sg-calibration-20260702-unwrapped/*.json
```

Replay result after patch:

```text
Tested captures: 54
Rejected by guards: 8/54
Perfect captures: 2/54
Cell accuracy vs answer key: 424/648 (65.43%)
Left-slot shape rescues: 12 total, 12 answer-key-correct; 4 stayed review because their full scan was guard-rejected.
Single-slot 6/5 review guard: 5 cells reviewed; only 1 changed a previously non-review OCR miss.
Group review count: 200/380
Non-review answer-key mismatches: 4 groups, all visually checked as student-wrong answers, not OCR errors.
```

Important interpretation:

- The answer-key score is not the real OCR score because many student answers are intentionally wrong. Use it for pattern finding only.
- Visual inspection of `/tmp/sg-confident-wrong-contact.jpg` showed four remaining non-review answer-key mismatches were correct app behavior: the student wrote the wrong answer and ScanGrade marked it red.
- Visual inspection of `/tmp/sg-marked-sheets-contact.png` showed no systemic annotation drift; checks, Xs, and yellow circles are anchored to the intended answer boxes/slots at contact-sheet scale.

Remaining reliability bottlenecks:

- Number bonds, dot collections, ten frames, and mixed two-slot sheets remain review-heavy.
- Two-digit pages still hit the unusable-scan guard on 8/54 captures, concentrated in add-2digit, sub-2digit, and mixed-20 pages.
- The next meaningful jump toward market-readiness should come from labeled handwritten-truth evaluation/training on these classroom scans, plus layout/crop improvements for the visual worksheet formats. Do not loosen confidence thresholds to inflate apparent confidence.

Deploy follow-up:

- Source commit pushed: `395f263 Tighten classroom OCR confidence policy` on `autobuild/safe-20260223`.
- GitHub Pages worktree commits pushed on `gh-pages`: `ad9e5e0 Deploy classroom OCR rescue build`, `fac1e25 Refresh deploy asset names`, and `fe26a69 Force static Pages publish`.
- Commit-specific raw GitHub content for `fac1e25` showed the expected `index-CscVcfNN-r1.js` / `index-Clbz-Bwe-r1.css` asset references, and the JS asset existed.
- Public `https://scangradesheets.github.io/draft1/` still served the previous `6dd8833` artifact after cache expiry and after the `.nojekyll` trigger commit. The visible public site should be treated as not yet updated until a later check shows build label `2026.07.02-1212-EDT-sg3-leftslot-rescue-guard`.
- Local Vite dev server on port `5175` was stopped after verification.

## 2026-07-02 Pages Deploy Queue / Artifact Prune

Tony reran the GitHub Pages workflow for `fe26a69` and reported that it showed as queued. A public check still showed the stale Pages HTML (`last-modified: Thu, 02 Jul 2026 04:14:06 GMT`), so the public scanner remained unsafe to use for the classroom debug batch.

Deploy issue found:

- The Pages artifact for the failed run was 79.2 MB compressed.
- Local `dist/` was 218 MB because Vite copied every old ONNX model experiment and every ONNX Runtime WASM/MJS variant from `public/`.
- The current app runtime only needs the current primary model, right-slot model, legacy/ensemble support models, OpenCV, and the two ONNX Runtime WASM binaries referenced by `src/ocr-pipeline.js`.

Patch made:

- Added a deploy-only prune in `vite.config.js`, enabled only by `SG_PRUNE_DEPLOY=1`.
- Updated `npm run build:github` to set `SG_PRUNE_DEPLOY=1`.
- Normal local builds remain unpruned so lab/eval assets stay available.

Verification:

```text
npm run build:github
dist size after deploy prune: 69M
dist/models after prune: 4.4M
kept runtime files:
- ort-wasm-nosimd.wasm
- ort-wasm-simd-1.17.wasm
- models/mnist-model.onnx
- models/worksheet-digit-generalist.onnx
- models/worksheet-digit-live-trusted-temp.onnx
- models/worksheet-digit-tony-generalist-noaug-20260601.onnx
```

Next action:

- Publish the leaner `dist/` to the `gh-pages` worktree and push source/deploy commits.
- Recheck `https://scangradesheets.github.io/draft1/` after the Pages workflow succeeds.
- Tony should not scan more packets until the visible public build label is `2026.07.02-1212-EDT-sg3-leftslot-rescue-guard`.

Follow-up:

- Source commit pushed: `c46084f Prune GitHub Pages deploy assets`.
- `gh-pages` deploy commit pushed: `5d6f7e1 Deploy lean classroom OCR build`.
- Empty retry commit pushed: `21913d9 Retry lean Pages deploy`.
- GitHub Pages Run 96 (`28637674516`) and Run 97 (`28637813499`) both built and uploaded the smaller `github-pages` artifact successfully, but failed at the GitHub-managed deploy job with: `Deployment failed, try again later.`
- Run 97 artifact size was `32.6 MB`, so the artifact-size reduction worked.
- GitHub connector could read jobs but could not rerun the deploy job: GitHub returned `403 Resource not accessible by integration`.
- Older Run 95 (`28607104764`) still appeared queued while Runs 96/97 failed quickly. If Pages remains stuck, Tony should cancel the queued Run 95 and rerun failed jobs on the newest run from the GitHub UI.

Current public status:

- `https://scangradesheets.github.io/draft1/` still served stale assets `index-Cg8MFGrt.js` / `index-DGF2K3Sz.css`.
- Do not use the public scanner for new evidence until the page updates to the `2026.07.02-1212-EDT-sg3-leftslot-rescue-guard` build.

## 2026-07-03 Morning Pages / GitHub Connector Status

Checked again on 2026-07-03 at about 10:35 EDT:

- Public `https://scangradesheets.github.io/draft1/` still served the stale July 2 artifact:
  - `last-modified: Thu, 02 Jul 2026 04:14:05 GMT`
  - assets `index-Cg8MFGrt.js` / `index-DGF2K3Sz.css`
- GitHub Actions list still reported:
  - Run 97 `queued` for `21913d9 Retry lean Pages deploy`
  - Run 96 `completed/failure` for `5d6f7e1 Deploy lean classroom OCR build`
  - Run 95 `queued` for `fe26a69 Force static Pages publish`
- Public API for job `84927698768` showed the truth for Run 97:
  - job status `completed`
  - conclusion `failure`
  - failed step `Deploy to GitHub Pages`
  - started `2026-07-03T04:10:25Z`, completed `2026-07-03T04:10:34Z`
- The GitHub connector inside Codex still returns `401 token_expired`, even after Tony disconnected/reconnected in the UI and the UI appeared to say connected.

Current blocker:

- Need the private GitHub Pages deploy log for job `84927698768`, or another authenticated way to rerun/fix the newest Pages deploy.

Recommended next paths:

1. Try a full Codex app restart or a fresh SG thread after reconnecting the GitHub connector, then test with `mcp__codex_apps__github._list_installed_accounts`.
2. If connector remains expired, use Tony's browser/GitHub UI to open `https://github.com/ScanGradeSheets/draft1/actions/runs/28637813499/job/84927698768` and copy the failure text from the `Deploy to GitHub Pages` step.
3. If Tony approves use of local GitHub credentials from the macOS keychain, fetch the job log with authenticated GitHub API without printing or storing the token.

Do not scan more classroom packets until the public page visibly updates to build `2026.07.02-1212-EDT-sg3-leftslot-rescue-guard`.

Update:

- GitHub connector recovered after Codex restart and confirmed access to `ScanGradeSheets`.
- Run 97 deploy logs showed the generic GitHub Pages failure only:
  - artifact found
  - Pages deployment created for `21913d9`
  - failed with `Deployment failed, try again later.`
- Rerun via connector failed because GitHub still reported the workflow as already running.
- Because there was no visible cancel control in Tony's signed-in browser, pushed the same lean deploy tree to a fresh branch:
  - `gh-pages-v2` at `21913d9`
- Clean recovery path now: in GitHub repo Settings -> Pages, switch deploy branch from `gh-pages` to `gh-pages-v2` and save. The public QR URL should remain `https://scangradesheets.github.io/draft1/` because the repository name remains `draft1`.

## 2026-07-03 Pages Recovery Confirmed

Date / thread: 2026-07-03, SG 3.

What changed:

- Tony switched the GitHub Pages publishing branch from `gh-pages` to `gh-pages-v2`.
- GitHub Pages created a fresh successful deploy from `gh-pages-v2`.
- The public QR URL did not change: `https://scangradesheets.github.io/draft1/`.

Evidence used:

- GitHub Actions public API.
- Live public HTML and asset headers from `https://scangradesheets.github.io/draft1/`.
- Live public JavaScript bundle content.

Commands run:

```text
curl -sL 'https://api.github.com/repos/ScanGradeSheets/draft1/actions/runs?per_page=12'
curl -sI https://scangradesheets.github.io/draft1/
curl -sL https://scangradesheets.github.io/draft1/
curl -sL https://scangradesheets.github.io/draft1/assets/index-CscVcfNN.js
git ls-remote origin refs/heads/gh-pages-v2
```

Results:

- Run 98 completed successfully on `gh-pages-v2` at commit `21913d9`.
- Public HTML `last-modified` changed to `Fri, 03 Jul 2026 15:13:45 GMT`.
- Public HTML now references fresh assets:
  - `/draft1/assets/index-CscVcfNN.js`
  - `/draft1/assets/index-Clbz-Bwe.css`
- Old stale asset `/draft1/assets/index-Cg8MFGrt.js` now returns `404`.
- Live JavaScript bundle contains expected build label:
  - `2026.07.02-1212-EDT-sg3-leftslot-rescue-guard`

Files changed:

- This handoff entry only.

Rollback point:

- Public deploy branch `gh-pages-v2` at `21913d9`.
- Source branch `autobuild/safe-20260223` at `4e59cfb`.

Next action:

- Tony can resume classroom evidence scanning from the public QR URL or prepared debug URL, but use `Debug Scan (exports)` for evidence collection so Mission Control receives the full debug bundle.
- Keep checking the visible build label on the scan device before large batches.

Open risks:

- Old queued Runs 95 and 97 on the abandoned `gh-pages` branch may still appear in the Actions list, but the live Pages source is now `gh-pages-v2` and Run 98 is the successful deploy that matters.
- Continue preserving `private-evidence/` locally only; do not commit student evidence.

## 2026-07-03 Saved Classroom Scan Analysis / Leading-One Review Guard

Date / thread: 2026-07-03, SG 3.

What changed:

- Used the saved Mission Control debug uploads instead of asking Tony to scan more manually.
- Added analysis helpers for the saved debug-scan corpus and contact-sheet review of digit failure families.
- Improved `scripts/replay_live_ocr_captured.mjs` so it can replay Mission Control scan folders directly, unwrap saved `debug.json` payloads, process slices with `--offset` / `--limit`, and continue past individual replay errors.
- Added a conservative production trust guard: when the left slot of a two-digit answer is expected to be `1` and OCR reads another digit, route that digit/group to teacher review instead of allowing a confident automatic X. This uses answer-key context only as a review signal; it does not silently convert the digit to `1`.
- Updated visible build label to `2026.07.03-1212-EDT-sg3-leading-one-review`.

Evidence used:

- Local saved classroom evidence under `private-evidence/debug-scans/`.
- Current replay outputs written under:
  - `private-evidence/reports/current-replay-20260703/`
  - `private-evidence/reports/current-replay-20260703-b/`
  - `private-evidence/reports/current-replay-20260703-c/`
  - `private-evidence/reports/current-replay-20260703-leading-one-review-smoke/`
- Contact sheets written under `private-evidence/reports/`, especially:
  - `left-one-to-seven-contact.png`
  - `left-one-to-nine-contact.png`
  - `left-one-not-one-contact.png`
  - `optional-leading-digit-contact.png`

Commands run:

```text
node scripts/analyze_debug_scan_corpus.mjs
node scripts/make_debug_failure_contact_sheet.mjs --family left-one-to-seven --out private-evidence/reports/left-one-to-seven-contact.png --max 40
node scripts/make_debug_failure_contact_sheet.mjs --family left-one-to-nine --out private-evidence/reports/left-one-to-nine-contact.png --max 40
node scripts/make_debug_failure_contact_sheet.mjs --family left-one-not-one --out private-evidence/reports/left-one-not-one-contact.png --max 48
npm run dev -- --host 127.0.0.1
node scripts/replay_live_ocr_captured.mjs --allow-imperfect --url https://127.0.0.1:5174 --out-dir private-evidence/reports/current-replay-20260703 private-evidence/debug-scans
node scripts/replay_live_ocr_captured.mjs --allow-imperfect --url https://127.0.0.1:5174 --out-dir private-evidence/reports/current-replay-20260703-b --offset 67 --limit 40 private-evidence/debug-scans
node scripts/replay_live_ocr_captured.mjs --allow-imperfect --url https://127.0.0.1:5174 --out-dir private-evidence/reports/current-replay-20260703-c --offset 107 private-evidence/debug-scans
node scripts/replay_live_ocr_captured.mjs --allow-imperfect --url https://127.0.0.1:5174 --out-dir private-evidence/reports/current-replay-20260703-leading-one-review-smoke <targeted scan folders>
node --check scripts/replay_live_ocr_captured.mjs
node --check scripts/analyze_debug_scan_corpus.mjs
node --check scripts/make_debug_failure_contact_sheet.mjs
npm run build
npm run build:github
```

Results:

- Saved-output corpus summary before the new guard:
  - 115 classroom-layout scans analyzed.
  - 824 question groups with app output.
  - Answer-key correctness: `330/824` (`40.0%`).
  - Review routing: `536/824` (`65.0%`).
  - Auto-graded: `288/824` (`35.0%`).
  - Auto-graded but answer-key-wrong in saved output: `0/824`. This is not the same as handwritten-truth accuracy, but it shows the public saved-output policy was conservative.
- Current-code replay across 116 processed classroom scans:
  - 814 question groups.
  - Answer-key correctness: `376/814` (`46.2%`).
  - Review routing: `505/814` (`62.0%`).
  - Auto-graded: `309/814` (`38.0%`).
  - Expected leading-`1` left slot wrong: `175/425` (`41.2%`), with `84` as `7`, `49` as `9`, and `42` other digits.
  - 17 leading-`1` mistakes were auto-graded wrong against the answer key before the guard. Some may be students' actual wrong answers, but the repeated leading-slot pattern is too risky to auto-X.
- Targeted replay after the guard:
  - Previously silent cases like `77/11`, `70/10`, and `71/11` now route to review.
  - A clean page already reading `11,12,15,15,14,16,18,17` remained `8/8` with no review.
- Visual contact sheets show many raw leading-slot crops genuinely look like roofed/slanted `1`s or `7`s. This supports a context-assisted review guard now, but not broad automatic correction yet.

Files changed:

- `src/App.vue`
- `src/components/CameraCapture.vue`
- `scripts/replay_live_ocr_captured.mjs`
- `scripts/analyze_debug_scan_corpus.mjs`
- `scripts/make_debug_failure_contact_sheet.mjs`
- `SCANGRADE_ACTIVE_HANDOFF.md`

Rollback point:

- Previous public deploy: `gh-pages-v2` at `21913d9`.
- Previous source handoff commit: `30f6337`.
- New source commit/deploy pending at the time this entry was written.

Next action:

- Commit this trust-guard patch and deploy it only if Tony wants the public scanner to prioritize fewer silent wrong Xs over fewer yellow reviews.
- Next high-leverage OCR work is a labeled handwritten-truth pass on leading `1` crops. Do not use answer-key agreement alone to claim recognition accuracy.
- After handwritten labels, consider a second-stage context-assisted rescue for truly ambiguous leading `1` vs `7/9` cases, with audit reason `context-assisted-leading-one`, but only if it preserves zero confident wrong reads on a held-out packet set.

Open risks:

- Current replay still scores against the worksheet answer key, not handwritten truth. Student math mistakes are useful app evidence and should not be counted as OCR errors when the OCR matches the handwriting.
- The new guard may increase yellow review count on some two-digit sheets. That is acceptable as a trust fix, but it does not solve the market-readiness coverage target by itself.
- Some visual-format pages remain weak due to crop/layout/format issues, not just digit classification.

## 2026-07-03 Context-Assisted Leading-One Rescue

Date / thread: 2026-07-03, SG 3.

Tony asked whether ScanGrade can cautiously use answer-key context for ambiguous leading `1` cases such as `11-19`, where the model often reads the left slot as `7` or `9`. The objective answer is yes, but only as a narrow second-stage evidence check. The app must never broadly substitute the answer key for what the student wrote.

What changed:

- Added a very narrow context-assisted rescue in `src/components/CameraCapture.vue`.
- Updated the replay harness in `scripts/replay_live_ocr_captured.mjs` with the same post-recognition policy so saved scans can be tested reproducibly.
- Updated visible build label to `2026.07.03-1534-EDT-sg3-context-leading-one`.

Policy details:

- Only applies to two-slot answer groups whose expected answer is `10-19`.
- Only changes left-slot `9 -> 1`; it does not broadly rescue `7 -> 1`.
- Requires the right slot to be stable, not reviewed, and already matching the expected right digit.
- Requires strong shape evidence that the left crop is a narrow one-stroke digit across trusted preprocessing variants, including an anchor variant such as `raw-border-slot`, `wide-slot`, `no-side-erase`, or `expected-slot`.
- Adds explicit audit fields such as `originalDigitBeforeContextAssist`, `originalConfidenceBeforeContextAssist`, `robustOverride: context-assisted-leading-one`, and `contextAssistEvidence`.
- Skips the rescue if a forced fallback review reason is already present.

Evidence and tests:

```text
node --check scripts/replay_live_ocr_captured.mjs
npm run build
npm run build:github
npm run dev -- --host 127.0.0.1
node scripts/replay_live_ocr_captured.mjs --allow-imperfect --url https://127.0.0.1:5174 --out-dir private-evidence/reports/current-replay-20260703-context-leading-one-smoke <targeted scan folders>
node scripts/replay_live_ocr_captured.mjs --allow-imperfect --url https://127.0.0.1:5174 --out-dir private-evidence/reports/current-replay-20260703-context-leading-one-a --limit 50 private-evidence/debug-scans
node scripts/replay_live_ocr_captured.mjs --allow-imperfect --url https://127.0.0.1:5174 --out-dir private-evidence/reports/current-replay-20260703-context-leading-one-b --offset 50 --limit 50 private-evidence/debug-scans
node scripts/replay_live_ocr_captured.mjs --allow-imperfect --url https://127.0.0.1:5174 --out-dir private-evidence/reports/current-replay-20260703-context-leading-one-c --offset 100 private-evidence/debug-scans
```

Replay results on the current classroom debug slice:

- Processed replay result files: 106 captures.
- Guard-rejected captures: 20.
- All captures: `703/1284` digit cells matched the answer key (`54.75%`), `356/744` question groups matched the answer key (`47.85%`), review routing was `460/744` groups (`61.83%`), and auto-graded groups were `284/744` (`38.17%`).
- Accepted captures only: `564/960` digit cells matched the answer key (`58.75%`), `310/582` question groups matched the answer key (`53.26%`), review routing was `298/582` groups (`51.20%`), and auto-graded groups were `284/582` (`48.80%`).
- Context-assisted leading-one rescue fired only 5 times across all 106 captures, and only 3 times on accepted captures.
- Auto-graded answer-key-wrong groups remained 29 in this replay slice. This metric is still answer-key based, not handwritten-truth based.

Interpretation:

- This is a safe trust-preserving improvement, not the big jump to market-ready reliability.
- The policy proves that answer-key context can be used responsibly when it acts as a tiebreaker supported by crop/shape evidence.
- It should not be expanded until there is handwritten-truth labeling and a held-out packet set, because broad context correction would risk grading what the answer should have been instead of what the student wrote.

Next action:

- If Tony wants this behavior live, commit and deploy the source changes only; do not commit `private-evidence/`.
- The next major reliability move is still labeled handwritten-truth evaluation plus crop/layout work on left-slot and visual-format failures. Context rescue can help at the margin, but it cannot replace improving recognition and crop quality.

## 2026-07-03 Flexible Duplicate One-Digit Slot Cleanup

Date / thread: 2026-07-03, SG 3.

What changed:

- Found that the previous quick replay aggregation overcounted "silent wrong" groups because it compared displayed slot text like `5_` vs `_5` instead of the saved question-level `correct` flag.
- Re-audited accepted captures using the actual rule: `correct === false` and `review === false`.
- Found 11 true accepted silent-wrong groups before this patch.
- Patched the optional one-digit blank cleanup so a two-slot one-digit answer such as `7` can collapse a duplicate weak/artifact slot from `77` to `7_` when one slot is strong and the other slot is artifact-like. Previously, the cleanup skipped this case when the weak slot had the same expected digit.
- Marked the surviving flexible one-digit slot and the blanked optional slot as slot-correct after the cleanup, so the detailed result grid does not show a correct one-digit answer with a red slot just because the student used the left answer box.
- Updated replay JSON writing so `optionalSingleDigitBlankOverrides` and `contextAssistedLeadingOneRescues` are persisted in `*-replay-result.json`.
- Updated visible build label to `2026.07.03-1617-EDT-sg3-flex-duplicate-one-digit`.

Evidence and tests:

```text
node --check scripts/replay_live_ocr_captured.mjs
npm run dev -- --host 127.0.0.1
targeted replay on 2026-06-20_00-50-07-020-sg-g1-lw-05-mixed-20-0d61fd7c
replay chunks:
  private-evidence/reports/current-replay-20260703-flex-duplicate-a
  private-evidence/reports/current-replay-20260703-flex-duplicate-b
  private-evidence/reports/current-replay-20260703-flex-duplicate-c
npm run build
npm run build:github
```

Replay result:

- Targeted case improved from group B `77/_7` silent wrong to `7_/_7` correct.
- Accepted capture slice before patch: 86 captures, 582 groups, 310 question-correct (`53.26%`), 298 review groups (`51.20%`), 284 auto groups, 11 silent-wrong groups (`3.87%` of auto groups).
- Accepted capture slice after patch: 86 captures, 582 groups, 313 question-correct (`53.78%`), 296 review groups (`50.86%`), 286 auto groups, 10 silent-wrong groups (`3.50%` of auto groups).
- Several remaining silent-wrong examples were visually inspected and appear to be real student mistakes, not OCR errors:
  - `sg-g1-lw-10` question B: student wrote `41` for "after 39"; app correctly auto-Xs.
  - `sg-g1-lw-04` question B: student wrote `17` for `19 - 4`; app correctly auto-Xs.
  - `sg-g1-lw-06` question A: student wrote `5` for a ten-frame count of `6`; app correctly auto-Xs.

Interpretation:

- This is a small but clean reliability improvement. It improves one recurring flexible-slot failure without loosening global confidence.
- The remaining auto-wrong set should not be blindly suppressed; many are exactly the kind of real wrong student answers ScanGrade must confidently mark.

Next action:

- Continue separating true OCR errors from authentic student mistakes before making additional trust-policy changes.
- Next likely high-leverage work is a handwritten-truth labeling pass for the accepted silent-wrong list and the high-review visual pages, then crop/layout improvements for ten-frame, dot-collection, number-pattern, and number-bond formats.

## 2026-07-03 Handwritten Truth Pass

Date / thread: 2026-07-03, SG 3.

Tony asked for handwritten truth by page/question so app reliability can be measured against what students actually wrote, not only the answer key.

What changed:

- Added `scripts/create_handwritten_truth_label_pack.mjs`.
  - Builds per-answer truth-label records from saved debug/replay evidence.
  - Supports accepted-only exports, needs-label-only contact sheets, page offsets, and stable `uid` values such as `41.3`.
  - Uses stitched raw digit crops for contact sheets because warped-page crops were unreliable on some non-row layouts.
- Added `scripts/summarize_handwritten_truth.mjs`.
  - Merges seeded labels and manual visual overrides.
  - Writes `handwritten-truth-labelled.json`.
  - Reports OCR correctness against handwriting truth, yellow leaning correctness, student math correctness, and layout-level breakdowns.
- Created private manual labels at `private-evidence/truth-labels/20260703-flex-duplicate-accepted-needs-label/manual-truth-overrides.json`.
- Generated merged private truth data at `private-evidence/truth-labels/20260703-flex-duplicate-accepted-needs-label/handwritten-truth-labelled.json`.
- Generated per-page private truth rollups at `private-evidence/truth-labels/20260703-flex-duplicate-accepted-needs-label/handwritten-truth-labelled-pages.json` and `private-evidence/truth-labels/20260703-flex-duplicate-accepted-needs-label/handwritten-truth-labelled-pages.csv`.
- Do not commit `private-evidence/`.

Verification:

```text
node --check scripts/create_handwritten_truth_label_pack.mjs
node --check scripts/summarize_handwritten_truth.mjs
node scripts/create_handwritten_truth_label_pack.mjs --accepted-only --needs-label-only --out-dir private-evidence/truth-labels/20260703-flex-duplicate-accepted-needs-label
node scripts/summarize_handwritten_truth.mjs
```

Truth-labelled accepted scan summary:

- Accepted captures: 86.
- Accepted answer groups: 582.
- Handwritten truth coverage: 582/582, with 276 seeded labels, 302 manual value labels, 4 blanks, 0 unclear, 0 missing.
- Auto/confident reads against handwriting truth: 284/286 correct = 99.3%.
- Confidently wrong OCR reads against handwriting truth: 2/286.
- Yellow/manual-review groups: 296/582 = 50.9%.
- Yellow groups where the app's leaning value matched handwriting truth: 55/296 = 18.6%.
- Overall displayed app read, counting yellow leaning values: 339/582 = 58.2%.
- Student math correctness against answer key: 505/582 = 86.8%.

Layout breakdown from the truth pass:

```text
sg-g1-lw-01-add-1digit: total 80, auto 62/62 correct, yellow 18, yellow leaning correct 3
sg-g1-lw-02-add-2digit: total 32, auto 18/18 correct, yellow 14, yellow leaning correct 2
sg-g1-lw-03-sub-1digit: total 80, auto 54/56 correct, yellow 24, yellow leaning correct 9
sg-g1-lw-04-sub-2digit: total 40, auto 26/26 correct, yellow 14, yellow leaning correct 6
sg-g1-lw-05-mixed-20: total 32, auto 16/16 correct, yellow 16, yellow leaning correct 4
sg-g1-lw-06-ten-frames: total 72, auto 23/23 correct, yellow 49, yellow leaning correct 6
sg-g1-lw-07-dot-collections: total 72, auto 21/21 correct, yellow 51, yellow leaning correct 9
sg-g1-lw-08-number-bonds: total 66, auto 19/19 correct, yellow 47, yellow leaning correct 4
sg-g1-lw-09-number-patterns: total 54, auto 15/15 correct, yellow 39, yellow leaning correct 11
sg-g1-lw-10-place-value-50: total 54, auto 30/30 correct, yellow 24, yellow leaning correct 1
```

Only two confident OCR errors remained in accepted scans:

```text
44.7 sg-g1-lw-03-sub-1digit: expected 5, handwritten truth 10, app read 6
52.6 sg-g1-lw-03-sub-1digit: expected 8, handwritten truth 8, app read 6
```

Interpretation:

- The trust policy is much better than answer-key-only scoring implied. Many previous "auto wrong" examples were real student math mistakes, not OCR mistakes.
- The app is still not market-ready because only 286/582 accepted answer groups are auto/confident. The rest require review.
- The yellow bucket is not merely under-confident correct reads: only 18.6% of yellow leaning values matched handwriting truth.
- The next high-leverage move is crop/layout geometry for non-row formats, especially number bonds and other visual layouts, before loosening confidence. Several number-bond crops visually grab nearby labels/borders/adjacent regions even though the full warped sheet clearly shows the handwritten answer.

Next action:

1. Fix and replay non-row layout crop geometry, starting with `sg-g1-lw-08-number-bonds`, then ten frames, dot collections, and number patterns.
2. Re-run `scripts/summarize_handwritten_truth.mjs` after each crop/layout change.
3. Only consider confidence loosening after yellow leaning correctness improves substantially on the truth-labelled set.

## 2026-07-04 Future Layout Contract + Non-Row Reliability Pass

Date / thread: 2026-07-04, SG 3.

Tony clarified that the goal is not to overfit ScanGrade to the current Grade 1 packet. The app needs a structure where future worksheet variations can perform just as well.

What changed:

- Added `docs/SCANGRADE_LAYOUT_CONTRACT.md`.
  - Core rule: worksheet concepts can vary widely, but graded answer regions must be boring, explicit, and declared in layout JSON.
  - Future layouts must define `digit_box_ids`, slot count, guide/divider metadata, canonical digits, and accepted digit placements.
  - Visual worksheet variety belongs in prompts, diagrams, and work space; the answer box is the machine-readable handshake.
  - Three-, four-, and five-digit answer layouts are possible in principle but are not market-ready until they have their own replay evidence.
- Added `scripts/audit_layout_answer_regions.mjs` and `npm run audit:layouts`.
  - Audits layout metadata, question groups, slot counts, box geometry, accepted responses, mixed slot counts, and unvalidated 3+ slot layouts.
  - This is the first guardrail against future worksheet designs drifting into scanner-hostile answer regions.
- Added `scripts/analyze_leading_one_context_policy.mjs` and `npm run analyze:leading-one-context`.
  - Tests whether answer-key context can safely rescue ambiguous leading `1` reads.
  - Result: broad expected-leading-`1` correction is unsafe because it would override real student-written wrong answers.
- Made one tiny evidence-backed OCR policy adjustment:
  - In `src/components/CameraCapture.vue` and `scripts/replay_live_ocr_captured.mjs`, the strict context-assisted leading-one stroke-width guard now accepts `inkW <= 6` instead of `inkW <= 5`.
  - This only fires inside the existing narrow `9 -> 1` rescue where the expected answer starts with `1`, the right slot is stable and matching, and the crop shape looks like a one-stroke digit across trusted variants.

Evidence used:

- Handwritten-truth set:
  - `private-evidence/truth-labels/20260703-flex-duplicate-accepted-needs-label/handwritten-truth-labelled.json`
- Replay chunks:
  - `private-evidence/reports/current-replay-20260704-general-policy-inkw6-a`
  - `private-evidence/reports/current-replay-20260704-general-policy-inkw6-b`
  - `private-evidence/reports/current-replay-20260704-general-policy-inkw6-c`
- Score report:
  - `private-evidence/reports/truth-score-20260704-general-policy-inkw6-abc.json`
- Leading-one policy report:
  - `private-evidence/reports/leading-one-context-policy-20260704-inkw6-current.json`

Commands run:

```text
node --check scripts/audit_layout_answer_regions.mjs
npm run audit:layouts
node --check scripts/analyze_leading_one_context_policy.mjs
node scripts/analyze_leading_one_context_policy.mjs --out private-evidence/reports/leading-one-context-policy-20260704-inkw6-current.json
node --check scripts/replay_live_ocr_captured.mjs
node scripts/replay_live_ocr_captured.mjs --allow-imperfect --url https://127.0.0.1:5174 --out-dir private-evidence/reports/current-replay-20260704-general-policy-inkw6-a --offset 0 --limit 45 private-evidence/debug-scans
node scripts/replay_live_ocr_captured.mjs --allow-imperfect --url https://127.0.0.1:5174 --out-dir private-evidence/reports/current-replay-20260704-general-policy-inkw6-b --offset 45 --limit 45 private-evidence/debug-scans
node scripts/replay_live_ocr_captured.mjs --allow-imperfect --url https://127.0.0.1:5174 --out-dir private-evidence/reports/current-replay-20260704-general-policy-inkw6-c --offset 90 --limit 45 private-evidence/debug-scans
node scripts/score_replay_against_handwritten_truth.mjs --out private-evidence/reports/truth-score-20260704-general-policy-inkw6-abc.json private-evidence/reports/current-replay-20260704-general-policy-inkw6-a private-evidence/reports/current-replay-20260704-general-policy-inkw6-b private-evidence/reports/current-replay-20260704-general-policy-inkw6-c
npm run build
```

Results:

- Layout audit: 33 layouts audited, 0 errors, 63 warnings.
  - Warnings are useful future-work signals, especially mixed slot counts and unvalidated 3-slot layouts.
- Broad answer-key/context correction for leading `1` is not safe:
  - 34 candidate cases where the answer key expected a leading `1`.
  - 30 would match handwritten truth, but 4 were real student-written wrong answers and would become confident wrongs if auto-corrected.
  - Therefore ScanGrade should keep answer-key context as a narrow, shape-supported tiebreaker only.
- Current replay against handwritten truth after the tiny `inkW <= 6` adjustment:
  - Accepted answer groups: 582.
  - Confident auto reads: 289/582 (`49.7%`).
  - Confident correct OCR reads: 287.
  - Confident wrong OCR reads: 2.
  - Confident OCR accuracy: 287/289 (`99.3%`).
  - Yellow/manual-review groups: 293/582 (`50.3%`).
- By broad format:
  - Row sheets: 178/264 confident, 176 correct, 2 wrong.
  - Non-row sheets: 111/318 confident, 111 correct, 0 wrong.
- Compared with the prior general policy replay, this gained 1 safe non-row confident read and introduced no new confident wrong reads.

Interpretation:

- The app remains trust-oriented but too conservative for broad market readiness.
- Non-row formats are now safe but under-confident: 0 confident wrong reads, but only 34.9% confident coverage.
- The next big improvement should come from answer-region/layout/crop consistency and model training/holdout discipline, not broad answer-key correction.
- For future worksheets, the design principle is now formal: keep the math format flexible, but make answer regions standardized, declared, auditable, and replay-proven before shipping.

Files changed:

- `docs/SCANGRADE_LAYOUT_CONTRACT.md`
- `scripts/audit_layout_answer_regions.mjs`
- `scripts/analyze_leading_one_context_policy.mjs`
- `package.json`
- `src/components/CameraCapture.vue`
- `scripts/replay_live_ocr_captured.mjs`
- `SCANGRADE_ACTIVE_HANDOFF.md`
- `mission-control/state/mission-state.json`

Rollback point:

- No commit created yet in this entry.
- The code change is intentionally tiny: revert the `inkW <= 6` threshold back to `inkW <= 5` in both production and replay if needed.

Next action:

1. Treat `docs/SCANGRADE_LAYOUT_CONTRACT.md` plus `npm run audit:layouts` as the required gate for new worksheet packets.
2. Fix the two remaining confident OCR errors only if a reproducible, truth-scored guard improves reliability without suppressing real student mistakes.
3. Improve non-row confidence by making generated worksheet answer regions more uniform and by replaying against handwritten truth after each layout/crop/model change.
4. Do not expand context-assisted correction beyond the current narrow policy until a held-out handwritten-truth set proves it does not create confident wrong reads.

Open risks:

- Current broader classroom packet performance is still about 50% confident coverage overall, far below the 90-95% product goal.
- Visual/non-row formats are especially low-confidence even when safe.
- The layout audit can prevent many future design mistakes, but it does not prove OCR quality by itself; replay against real handwriting remains required.
- The repo has many pre-existing dirty/untracked files from earlier SG work. Do not revert them casually.

## 2026-07-04 Answer Box Candidate #1 Bakeoff Harness

Date / thread: 2026-07-04, SG 3.

Tony chose answer-box candidate #1: separate digit cells. The question is whether we should push hard on the current joined/open-divider format for summer work or shift the future ScanGrade standard toward separate cells before September testing.

What changed:

- Added `scripts/run_answer_box_bakeoff_synthetic.mjs`.
  - It builds a synthetic-authentic comparison using real labelled student handwriting crops from `private-evidence/truth-labels/20260703-flex-duplicate-accepted-needs-label/handwritten-truth-labelled.json`.
  - It places the same extracted handwriting masks into two candidate box designs:
    - `joined-open-divider` = current-ish joined answer box with an open divider.
    - `separate-cells` = Tony's preferred candidate #1.
  - It writes a layout JSON per generated page and, when browser scoring is allowed, runs those pages through the real local ScanGrade homography/OCR pipeline.
  - It measures filled-slot digit accuracy, review/disagreement signals, and blank-slot cleanliness.
- Added `npm run bakeoff:answer-boxes`.
- Added `--generate-only` to the bakeoff script so fixture generation and visual QA can run without Playwright.
- Added static fixture audit and a no-browser fixture contact sheet:
  - `static-audit.json`
  - `fixture-contact-sheet.png`
- Tightened the bakeoff fixture generator after visual QA:
  - Adaptive thresholding and small-component cleanup reduce gray worksheet-background contamination in extracted handwriting masks.
  - Synthetic prompt text was removed from near answer boxes so the bakeoff measures answer-region geometry rather than prompt overlap.
  - A right-column prompt-bubble bug was fixed after it visibly landed inside left-column answer boxes.
- Added `docs/SCANGRADE_SEPARATE_CELL_MIGRATION_PLAN.md`.
  - This is a draft implementation/validation path for adopting separate cells if the bakeoff supports it.
  - It explicitly requires backward compatibility for existing joined/open-divider QR worksheets.

Generated evidence:

- Smoke fixtures:
  - `private-evidence/reports/answer-box-bakeoff-synthetic-20260704-smoke`
  - 4 generated pages: 2 joined/open-divider and 2 separate-cells.
- Full fixture set:
  - `private-evidence/reports/answer-box-bakeoff-synthetic-20260704`
  - 24 generated pages total.
  - 12 `joined-open-divider` pages.
  - 12 `separate-cells` pages.
  - 120 unique real student handwriting samples, reused across both designs.
  - Static audit: passed with 0 errors and 0 warnings.
  - Fixture contact sheet: `private-evidence/reports/answer-box-bakeoff-synthetic-20260704/fixture-contact-sheet.png`

Commands run:

```text
node --check scripts/run_answer_box_bakeoff_synthetic.mjs
npm run bakeoff:answer-boxes -- --limit 20 --out-dir private-evidence/reports/answer-box-bakeoff-synthetic-20260704-smoke --generate-only
npm run bakeoff:answer-boxes -- --out-dir private-evidence/reports/answer-box-bakeoff-synthetic-20260704 --generate-only
node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('package.json ok')"
node -e "JSON.parse(require('fs').readFileSync('mission-control/state/mission-state.json','utf8')); console.log('mission-state ok')"
node --check scripts/run_answer_box_bakeoff_synthetic.mjs
node -e "JSON.parse(require('fs').readFileSync('private-evidence/reports/answer-box-bakeoff-synthetic-20260704/static-audit.json','utf8')); console.log('static audit json ok')"
```

Browser scoring command:

```text
npm run bakeoff:answer-boxes -- --limit 20 --out-dir private-evidence/reports/answer-box-bakeoff-synthetic-20260704-smoke --url https://127.0.0.1:5174
```

Result:

- The first browser smoke attempt failed because sandboxed Playwright could not launch Chromium.
- The required unsandboxed rerun was auto-rejected by Codex because the workspace had hit a temporary usage limit until 12:18 PM EDT.
- Later, after the gate cleared, a fresh Vite server was started and the full bakeoff was scored successfully.

Scored command:

```text
npm run bakeoff:answer-boxes -- --out-dir private-evidence/reports/answer-box-bakeoff-synthetic-20260704 --url https://127.0.0.1:5174
```

Scored results:

- Report: `private-evidence/reports/answer-box-bakeoff-synthetic-20260704/summary.json`
- Model/scoring contact sheet: `private-evidence/reports/answer-box-bakeoff-synthetic-20260704/contact-sheet.png`
- Joined/open-divider:
  - Filled digit accuracy: 129/186 (`69.4%`)
  - Exact question accuracy: 68/120 (`56.7%`)
  - Blank-slot cleanliness: 54/54 (`100%`)
  - Preprocess review flags on filled slots: 32
- Separate cells:
  - Filled digit accuracy: 131/186 (`70.4%`)
  - Exact question accuracy: 70/120 (`58.3%`)
  - Blank-slot cleanliness: 54/54 (`100%`)
  - Preprocess review flags on filled slots: 28
- Paired filled-slot comparison:
  - Both correct: 121
  - Separate-cell only correct: 10
  - Joined/open-divider only correct: 8
  - Neither correct: 47

Next action:

1. Treat separate cells as a modestly supported future direction, not a breakthrough.
2. Do not change the public QR worksheet format yet.
3. If Tony approves, update `docs/SCANGRADE_LAYOUT_CONTRACT.md` to include separate cells as the preferred future answer-region style.
4. The next major reliability work should focus on digit-model robustness and teacher-review ergonomics, not just answer-box geometry.
5. Preserve fresh September classroom work as the real validation gate.

Important interpretation guard:

- This bakeoff cannot prove real printed-sheet performance because it uses real handwriting masks placed synthetically into boxes.
- It is still useful because it isolates answer-box geometry from student handwriting variation.
- The September classroom test remains the real validation gate.
- The result says separate cells help slightly; it does not say separate cells alone get ScanGrade to 90-95% confident coverage.

## 2026-07-05 Accuracy Roadmap After Answer-Box Bakeoff

Date / thread:

- 2026-07-05, SG 3.

What changed:

- Tony decided to keep the current sheet and answer-box design for now because the synthetic answer-box bakeoff was practically identical between joined/open-divider and separate-cell designs.
- The next reliability track is digit recognition and confidence policy, not more visible worksheet redesign.
- Added roadmap: `docs/SCANGRADE_ACCURACY_ROADMAP_20260705.md`.

Evidence used:

- Handwritten-truth score report: `private-evidence/reports/truth-score-20260704-general-policy-inkw6-abc.json`
- Digit failure report: `private-evidence/reports/digit-failure-dataset-20260705-current/summary.json`
- Existing model comparison report: `private-evidence/reports/digit-failure-dataset-20260705-current/model-eval-summary.json`
- Digit dataset: `datasets/handwritten_truth_digits_current/`

Commands run:

```text
npm run dataset:handwritten-truth-digits
.venv/bin/python3.13 scripts/eval_handwritten_truth_digit_models.py
```

Results:

- Answer-level current baseline against handwritten truth:
  - 582 labelled answers.
  - 289 auto/confident.
  - 287 auto-correct.
  - 2 auto-wrong.
  - 293 yellow/manual-review.
  - 49.7% auto coverage.
  - 99.3% auto accuracy.
- Digit-slot current baseline:
  - 960 slot rows.
  - 865 filled slots.
  - 74.1% current filled-digit accuracy.
  - 83.5% row-sheet filled-digit accuracy.
  - 67.6% non-row filled-digit accuracy.
  - 67.9% blank-slot policy accuracy.
- Weakest layouts:
  - Number bonds: 47.7%.
  - Dot collections: 67.9%.
  - Number patterns: 69.5%.
  - Ten frames: 71.7%, with weak blank-slot handling.
- Biggest digit confusions:
  - `1 -> 7`: 48 cases.
  - `1 -> 9`: 18 cases.
  - `6 -> 5`: 11 cases.
  - `9 -> 2`: 10 cases.
- Existing old ONNX swaps are not enough:
  - Best standalone tested policy reached 72.8% on the clean subset.
  - The current integrated selector was about 73.6% on the same subset.
  - Conclusion: do not just swap to an older model. Build a ScanGrade-specific fine-tune and/or selector.
- Variant opportunity:
  - 104 currently-wrong filled digit slots already had the handwritten-truth digit in one of the app's preprocessing variants.
  - This makes a learned preprocessing/model selector the highest-leverage track.
- Scratch training warning:
  - A scratch CNN attempt overfit the small classroom set. Training accuracy climbed while validation stayed weak.
  - Use a compatible checkpoint plus external data and validation/holdout gates instead.
- Context warning:
  - Broad answer-key-based leading-`1` overrides are unsafe because students genuinely wrote wrong answers.
  - Context should start as a teacher-review suggestion, then only become auto-clear if validation/holdout prove it keeps confident wrong at zero.

Files changed:

```text
scripts/build_handwritten_truth_digit_dataset.mjs
scripts/eval_handwritten_truth_digit_models.py
package.json
docs/SCANGRADE_ACCURACY_ROADMAP_20260705.md
SCANGRADE_ACTIVE_HANDOFF.md
```

Rollback point:

- No rollback commit yet in this entry.
- The repo was already dirty with many SG 3 files before this work. Do not revert unrelated changes.

Next action:

1. Freeze the current evidence baseline.
2. Run compatible `ScanGradeDigitCNN` fine-tunes from `models/worksheet-digit-tony-generalist-aug-strong-20260601.pt` using `datasets/handwritten_truth_digits_current/train` as extra labelled raw data.
3. Evaluate candidate models against validation and holdout digit slots before app integration.
4. Build an offline variant-selector search using model confidences, top gaps, quality metrics, layout family, slot side, and review reason.
5. Replay the best candidate at answer level and require no increase in confident wrong answers before any public deploy.

Open risks:

- The current classroom corpus is valuable but limited. Preserve validation/holdout discipline so summer improvements do not overfit Tony's current students.
- Non-row layouts may need invisible crop/preprocessing improvements even if the printed sheet design stays fixed.
- The September classroom test remains the real product proof.

2026-07-05 follow-up smoke tests:

- Ran a private compatible fine-tune smoke test from `models/worksheet-digit-tony-generalist-aug-strong-20260601.pt`.
- Output stayed private under `private-evidence/model-candidates/sg3-20260705-finetune-smoke/`.
- Training command:

```text
.venv/bin/python3.13 scripts/train_generalized_digit_model.py --epochs 8 --batch-size 256 --external-per-digit 500 --worksheet-repeat 10 --extra-labeled-raw datasets/handwritten_truth_digits_current/train --extra-labeled-raw-repeat 8 --init-checkpoint models/worksheet-digit-tony-generalist-aug-strong-20260601.pt --onnx-out private-evidence/model-candidates/sg3-20260705-finetune-smoke/worksheet-digit-sg3-finetune-smoke.onnx --checkpoint-out private-evidence/model-candidates/sg3-20260705-finetune-smoke/worksheet-digit-sg3-finetune-smoke.pt --metadata-out private-evidence/model-candidates/sg3-20260705-finetune-smoke/metadata.json
```

- Smoke model result:
  - Exported successfully.
  - Same handwritten-truth digit evaluator: best-confidence `594/848` (`70.0%`).
  - This is worse than the best existing standalone model/policy (`617/848`, `72.8%`) and worse than the current integrated selector (`624/848`, about `73.6%`).
  - Do not deploy this smoke model.
- Fixed variant selector smoke test:
  - Trained simple per-layout/per-slot variant choices on calibration using existing `correctVariantNames`.
  - Calibration improved slightly: current `435/595` (`73.1%`) -> selector `446/595` (`75.0%`).
  - Validation got worse: current `114/150` (`76.0%`) -> selector `110/150` (`73.3%`).
  - Holdout got worse: current `75/103` (`72.8%`) -> selector `72/103` (`69.9%`).
  - Conclusion: hard-coded fixed variant preferences overfit. If using variants, build a per-item selector from confidence/quality features rather than layout-only rules.
- Leading-`1` context smoke:
  - Among labelled slot cases where the expected digit slot was `1` and the app read `7` or `9`, `64/66` were truly `1`, but `2/66` were real student-written wrong digits.
  - Conclusion: leading-`1` context is promising for teacher-review suggestions and possibly narrow auto-clear later, but broad auto-correction would create confident wrong reads.

Updated next action:

1. Keep the current public model/policy in place.
2. Build a proper per-item selector evaluation, not fixed per-layout variant rules.
3. Add context-assisted "likely 1" teacher-review suggestions before any auto-correction.
4. If model fine-tuning continues, use longer controlled runs plus validation/holdout evaluation; do not treat this smoke run as a deploy candidate.

2026-07-05 continuation: per-item selector and blank-policy experiments:

What changed:

- Added `scripts/eval_digit_variant_selector.py`.
  - Trains a logistic per-candidate selector on calibration rows.
  - Uses confidence, top-gap, vote share, tensor-quality features, family, slot side, variant name, candidate digit, and review reason.
  - Supports no-key, answer-key-context, layout-feature, and answer-key-plus-layout modes.
  - Tunes gated switching on validation and reports holdout separately.
- Added `scripts/eval_flexible_blank_policy.mjs`.
  - Mirrors the app's tensor quality checks.
  - Evaluates whether a generalized "one real digit plus artifact slot" cleanup can safely blank companion slots in two-slot boxes.
- Added package scripts:
  - `npm run eval:digit-selector`
  - `npm run eval:flexible-blank-policy`

Evidence used:

- `private-evidence/reports/digit-failure-dataset-20260705-current/digit-rows.json`
- Saved replay files and debug tensors referenced by those rows.

Commands run:

```text
npm run eval:digit-selector -- --out private-evidence/reports/digit-variant-selector-20260705/no-key/summary.json
npm run eval:digit-selector -- --use-answer-key-context --out private-evidence/reports/digit-variant-selector-20260705/answer-key-context/summary.json
npm run eval:digit-selector -- --layout-features --out private-evidence/reports/digit-variant-selector-20260705/layout-features/summary.json
npm run eval:digit-selector -- --use-answer-key-context --layout-features --out private-evidence/reports/digit-variant-selector-20260705/answer-key-layout/summary.json
npm run eval:flexible-blank-policy -- --out private-evidence/reports/flexible-blank-policy-20260705/summary.json
node --check scripts/eval_flexible_blank_policy.mjs
PYTHONPYCACHEPREFIX=/tmp/sg-pycache python3 -m py_compile scripts/eval_digit_variant_selector.py
```

Results:

- No-answer-key per-item selector:
  - Validation baseline stayed unchanged: current `95/126` (`75.4%`), selector `95/126` (`75.4%`).
  - Holdout improved only one digit slot in pure model mode: current `62/88` (`70.5%`) -> selector `63/88` (`71.6%`).
  - Gated mode chose effectively not to switch.
  - Conclusion: no-key selector is not a deployment candidate yet.
- Answer-key-context selector:
  - Validation improved: `95/126` (`75.4%`) -> `106/126` (`84.1%`).
  - Holdout improved: `62/88` (`70.5%`) -> `82/88` (`93.2%`).
  - But holdout has only two digit slots where handwritten truth differs from expected answer, so this can be inflated by "pick expected" behavior.
  - Conclusion: use this direction for teacher-review suggestions first, not automatic correction.
- Generalized flexible blank cleanup:
  - Current-style broad candidate logic would blank many real filled slots if generalized.
  - Strict generalized rule fixed 4 true blank slots but still false-blanked 2 real filled slots.
  - Conclusion: do not deploy broad blank cleanup. Keep the existing narrow optional-blank policy and treat broader cleanup as a review suggestion unless a safer rule is proven.

Files changed:

```text
scripts/eval_digit_variant_selector.py
scripts/eval_flexible_blank_policy.mjs
package.json
docs/SCANGRADE_ACCURACY_ROADMAP_20260705.md
SCANGRADE_ACTIVE_HANDOFF.md
```

Next action:

1. Implement answer-key-aware OCR suggestions in teacher review/debug output only, not auto-grading.
2. Start a multi-model/no-key ensemble experiment, because single-model no-key variant selection is too weak.
3. Separately diagnose crop/preprocessing for ten frames and number bonds, where current model/selector changes are least reliable.

Open risk:

- The current validation/holdout splits are small. A result that improves holdout by a few slots is not enough for public deployment unless it also preserves confident-wrong safety at answer level.

2026-07-05 continuation: multi-model ensemble experiment:

What changed:

- Added `scripts/eval_digit_model_ensemble.py`.
  - Evaluates current app digit candidates plus candidates from 10 existing ONNX worksheet digit models.
  - Uses the same frozen handwritten-truth digit rows and calibration/validation/holdout splits.
  - Supports no-key, layout-feature, answer-key-context, and answer-key-plus-layout modes.
  - Reports current baseline, best-confidence, majority vote, model selector, gated selector, and safety-gated selector.
- Added package script:
  - `npm run eval:digit-ensemble`
- Updated `docs/SCANGRADE_ACCURACY_ROADMAP_20260705.md` with the ensemble results and next-step plan.

Evidence used:

- `private-evidence/reports/digit-failure-dataset-20260705-current/digit-rows.json`
- Debug tensors and replay files referenced by those rows.

Commands run:

```text
PYTHONPYCACHEPREFIX=/tmp/sg-pycache python3 -m py_compile scripts/eval_digit_model_ensemble.py
.venv/bin/python3.13 -m json.tool package.json
npm run eval:digit-ensemble -- --out private-evidence/reports/digit-model-ensemble-20260705/no-key/summary.json
npm run eval:digit-ensemble -- --use-answer-key-context --out private-evidence/reports/digit-model-ensemble-20260705/answer-key-context/summary.json
npm run eval:digit-ensemble -- --layout-features --out private-evidence/reports/digit-model-ensemble-20260705/layout-features/summary.json
npm run eval:digit-ensemble -- --use-answer-key-context --layout-features --out private-evidence/reports/digit-model-ensemble-20260705/answer-key-layout/summary.json
```

Results:

- No-answer-key ensemble:
  - Evaluated 848 filled labelled digit slots through 10 existing ONNX worksheet digit models.
  - Holdout current baseline: `75/103` (`72.8%`).
  - Holdout oracle across model/variant candidates: `98/103` (`95.1%`).
  - Holdout pure model selector: `81/103` (`78.6%`).
  - Holdout gated selector: `78/103` (`75.7%`), with 3 rescues and 0 harms.
  - Validation gated selector: `114/150` (`76.0%`) -> `118/150` (`78.7%`), with 4 rescues and 0 harms.
  - Layout features did not materially improve or degrade this, which suggests the no-key result is not just layout memorization.
- Answer-key-context ensemble:
  - Holdout pure selector reached the oracle: `98/103` (`95.1%`), but this is not safe auto-deploy evidence because answer-key context can mask real student-written wrong answers.
  - Safety-gated answer-key-plus-layout reached `93/103` (`90.3%`) on holdout with 18 rescues and 0 harms; validation reached `122/150` (`81.3%`) with 8 rescues and 0 harms.
  - Conclusion: this is a strong teacher-review suggestion candidate, not a silent auto-correction policy.

Files changed:

```text
scripts/eval_digit_model_ensemble.py
package.json
docs/SCANGRADE_ACCURACY_ROADMAP_20260705.md
SCANGRADE_ACTIVE_HANDOFF.md
```

Next action:

1. Build an answer-level replay evaluator for ensemble candidates so digit-slot improvements are converted into the product metrics Tony cares about: confident answer coverage, confident wrong count, and yellow review count.
2. Do not deploy the answer-key-context selector as auto-grading. Promote it first as teacher-review "likely read" suggestions.
3. If the no-key gated ensemble improves answer-level replay without adding confident wrong reads, integrate it behind an internal/debug flag before any public build.

Open risk:

- The no-key ensemble gain is real but modest. The answer-key-context gain is large but could over-trust the expected answer. The next proof must be answer-level and must keep handwritten-truth scoring separate from math-answer-key correctness.

2026-07-05 continuation: answer-level ensemble proof:

What changed:

- Added `scripts/eval_digit_ensemble_answer_level.py`.
  - Converts digit-level ensemble choices into whole-answer product metrics.
  - Scores against handwritten truth, not answer-key correctness.
  - Keeps current review/yellow status unchanged for candidate strategies so suggestions can be evaluated separately from auto-grading.
- Added package script:
  - `npm run eval:digit-ensemble-answers`
- Updated `docs/SCANGRADE_ACCURACY_ROADMAP_20260705.md`.

Commands run:

```text
PYTHONPYCACHEPREFIX=/tmp/sg-pycache python3 -m py_compile scripts/eval_digit_ensemble_answer_level.py scripts/eval_digit_model_ensemble.py scripts/eval_digit_variant_selector.py scripts/eval_handwritten_truth_digit_models.py
.venv/bin/python3.13 -m json.tool package.json
npm run eval:digit-ensemble-answers
.venv/bin/python3.13 scripts/eval_digit_ensemble_answer_level.py --layout-features --out private-evidence/reports/digit-ensemble-answer-level-20260705/no-key-layout/summary.json
.venv/bin/python3.13 scripts/eval_digit_ensemble_answer_level.py --use-answer-key-context --out private-evidence/reports/digit-ensemble-answer-level-20260705/answer-key/summary.json
.venv/bin/python3.13 scripts/eval_digit_ensemble_answer_level.py --use-answer-key-context --layout-features --out private-evidence/reports/digit-ensemble-answer-level-20260705/answer-key-layout/summary.json
```

Private reports:

```text
private-evidence/reports/digit-ensemble-answer-level-20260705/no-key/summary.json
private-evidence/reports/digit-ensemble-answer-level-20260705/no-key-layout/summary.json
private-evidence/reports/digit-ensemble-answer-level-20260705/answer-key/summary.json
private-evidence/reports/digit-ensemble-answer-level-20260705/answer-key-layout/summary.json
```

Results:

- Current answer-level baseline:
  - Whole-answer read matches handwritten truth: `342/582` (`58.8%`).
  - Auto/confident answers: `289/582` (`49.7%`).
  - Auto-correct against handwritten truth: `287/289` (`99.3%`).
  - Auto-wrong against handwritten truth: `2/289`.
  - Yellow/manual-review answers: `293/582`.
  - Yellow current read already matches handwritten truth: `55/293` (`18.8%`).
- No-answer-key safety-gated ensemble:
  - Whole-answer read: `354/582` (`60.8%`).
  - Yellow suggestions rescued: 13.
  - It harmed 1 currently-correct auto answer, so it is not production-safe as an automatic recognizer.
- Answer-key-context gated keep-review ensemble:
  - Whole-answer read/suggestion: `472/582` (`81.1%`).
  - Auto lane stayed `287/289` (`99.3%`) because review status stayed unchanged.
  - Yellow suggestion matches handwritten truth: `185/293` (`63.1%`), up from `55/293` (`18.8%`).
  - It rescued 139 yellow suggestions and harmed 9 yellow suggestions.
- Answer-key-context safety-gated keep-review ensemble:
  - Whole-answer read/suggestion: `400/582` (`68.7%`).
  - Yellow suggestion matches handwritten truth: `113/293` (`38.6%`).
  - It rescued 61 yellow suggestions, harmed 3 yellow suggestions, and did not harm the auto lane.
- Non-row bottleneck:
  - Current non-row whole-answer read: `142/318` (`44.7%`).
  - Answer-key gated suggestions raise non-row read/suggestion quality to `243/318` (`76.4%`) while keeping review status.

Decision:

- Keep the current worksheet/answer-box design.
- Do not deploy the current no-key ensemble to automatic grading; it adds one confident wrong answer.
- Do build answer-key/context-aware "likely read" suggestions for yellow teacher-review items, clearly separated from score and auto-grading.
- Continue no-key recognizer/model training separately, with the existing validation/holdout discipline.

Next action:

1. Add a review-only likely-read suggestion path to teacher review/debug output. It must not change saved scores, checks, Xs, or auto/yellow status.
2. Start the next no-key model/selector training track, aimed at reducing left-slot/leading-digit confusions without answer-key context.
3. Re-run answer-level benchmark before any scanner/OCR/capture deployment.

2026-07-05 continuation: review-only likely-read suggestions implemented:

What changed:

- Added a live-app review suggestion path for yellow/manual-review answers.
- `src/components/CameraCapture.vue` now attaches `reviewSuggestion` to `answerGroups` when a cautious likely read is available.
- `src/services/studentReviewStore.js` now stores `questionReview` and `answerGroups` in submission records.
- `src/App.vue` shows compact `Likely reads` chips in teacher review cards.
- `scripts/replay_live_ocr_captured.mjs` mirrors the same suggestion policy for saved debug replay.
- `scripts/score_replay_against_handwritten_truth.mjs` can score suggestion correctness when replay result files contain suggestion payloads.
- Added `scripts/eval_review_suggestion_policy.mjs` and package command `npm run eval:review-suggestions`.

Evidence used:

- Frozen handwritten-truth corpus from `private-evidence/reports/digit-failure-dataset-20260705-current/digit-rows.json`.
- Existing replay outputs under:
  - `private-evidence/reports/current-replay-20260704-general-policy-inkw6-a/`
  - `private-evidence/reports/current-replay-20260704-general-policy-inkw6-b/`
  - `private-evidence/reports/current-replay-20260704-general-policy-inkw6-c/`

Commands run:

```text
node --check scripts/eval_review_suggestion_policy.mjs
node --check scripts/replay_live_ocr_captured.mjs
npm run eval:review-suggestions
npm run build
node scripts/score_replay_against_handwritten_truth.mjs --out private-evidence/reports/review-suggestion-scorer-regression-20260705.json private-evidence/reports/current-replay-20260704-general-policy-inkw6-a private-evidence/reports/current-replay-20260704-general-policy-inkw6-b private-evidence/reports/current-replay-20260704-general-policy-inkw6-c
```

Results:

- Build passed.
- Static script checks passed.
- Old replay scoring baseline stayed unchanged:
  - `582` matched answers.
  - `289/582` confident/auto.
  - `287/289` auto-correct against handwritten truth.
  - `2/289` auto-wrong.
  - `293/582` yellow/manual-review.
- Lightweight review-suggestion evaluator:
  - Report: `private-evidence/reports/review-suggestion-policy-20260705/summary.json`
  - Suggestions on `130/293` yellow answers (`44.4%`).
  - Suggestions correct against handwritten truth: `126/130` (`96.9%`).
  - Suggestions rescued `97` yellow answers where the current leaning read was wrong.
  - Non-row suggestions: `98/100` correct (`98.0%`).
  - Row suggestions: `28/30` correct (`93.3%`).
- Safety tightening:
  - Removed weak answer-key-only `5 -> 6` suggestions unless supported by strong independent OCR evidence.
  - Kept ten-frame answer-key context guarded by independent evidence.
  - Did not suppress dot-collection leading-`1` context broadly because it removed many correct suggestions for little precision gain.

Files changed:

```text
src/components/CameraCapture.vue
src/services/studentReviewStore.js
src/App.vue
scripts/replay_live_ocr_captured.mjs
scripts/score_replay_against_handwritten_truth.mjs
scripts/eval_review_suggestion_policy.mjs
package.json
docs/SCANGRADE_ACCURACY_ROADMAP_20260705.md
SCANGRADE_ACTIVE_HANDOFF.md
```

Rollback point:

- No commit was created in this continuation. Use git diff against the current worktree if rollback is needed.

Next action:

1. When Playwright/usage limits allow, run a browser replay against the built app so replay result JSONs include `reviewSuggestion`, then score those replay outputs.
2. Continue the no-answer-key recognizer track. The product goal cannot be met by answer-key context alone because real students write wrong answers.
3. Prioritize reducing left-slot/leading-`1` failures and non-row crop/preprocessing failures without changing the worksheet design.
4. Keep review suggestions review-only until validation/holdout proves zero added confident wrong answers.

Open risks:

- Browser replay with Playwright was blocked by the temporary usage-limit/approval guard during this work session, so the live browser replay has not yet been rerun.
- The review suggestion layer improves teacher workflow but does not increase automatic confident coverage. The automatic lane remains about `49.7%` coverage on this labelled corpus.

## 2026-07-07 Review Suggestion Safety Tightening

Continued SG 3 accuracy work from the frozen handwritten-truth corpus. The live app review-suggestion layer was tightened to prioritize teacher-facing precision over suggestion volume.

What changed:

- `scripts/eval_digit_ensemble_answer_level.py` now scores yellow-only ensemble strategies. This lets no-key recognizer experiments become review suggestions without touching the protected auto lane.
- `scripts/eval_review_suggestion_policy.mjs`, `scripts/replay_live_ocr_captured.mjs`, and `src/components/CameraCapture.vue` now share a stricter review-suggestion guard:
  - A leading `7 -> 1` answer-key-context hint now requires independent OCR evidence for `1`.
  - Pure OCR-alternative review hints now require each changed nonblank slot to have independent evidence at least `0.79`.
  - Suggestions remain review-only; auto scoring and confident/yellow status are unchanged.

Offline evidence:

- Baseline lightweight suggestion policy report: `private-evidence/reports/review-suggestion-policy-20260705/summary.json`
  - `130/293` yellow answers had suggestions.
  - `126/130` suggestions matched handwritten truth (`96.9%`).
  - `4` suggestions were wrong.
- Stricter final policy report: `private-evidence/reports/review-suggestion-policy-20260707/final-strong-review-suggestions/summary.json`
  - Auto lane unchanged: `289/582` auto, `287/289` correct, `2/289` wrong.
  - `79/293` yellow answers had suggestions.
  - `79/79` suggestions matched handwritten truth (`100%`) on the labelled corpus.
  - `50` yellow wrong-leaning answers were rescued.
  - Row suggestions: `17/17` correct.
  - Non-row suggestions: `62/62` correct.

No-key yellow-only ensemble evidence:

- Reports:
  - `private-evidence/reports/digit-ensemble-answer-level-20260707/no-key-yellow-only/summary.json`
  - `private-evidence/reports/digit-ensemble-answer-level-20260707/no-key-layout-yellow-only/summary.json`
- Conservative gated yellow-only selector:
  - `13` yellow suggestions rescued, `0` harmed, `0` auto harm.
  - Layout features reduced this slightly to `11` rescues, `0` harms.
- Aggressive model selector:
  - `31` yellow suggestions rescued, but `2` yellow suggestions harmed.
  - Treat this as research signal, not product behavior.

Browser/live-app verification:

- Browser replay report directory: `private-evidence/reports/review-suggestions-browser-smoke-20260707-final/`
- Truth score: `private-evidence/reports/review-suggestions-browser-smoke-20260707-final/truth-score.json`
- On the 12-capture smoke subset:
  - `58` matched answer groups.
  - Auto lane: `23/23` correct, `0` wrong.
  - Yellow suggestions: `9/9` correct, `0` wrong.
  - This confirms the Vue app emits the stricter suggestion payloads.

Verification commands completed:

```text
PYTHONPYCACHEPREFIX=/tmp/sg-pycache .venv/bin/python3.13 -m py_compile scripts/eval_digit_ensemble_answer_level.py
.venv/bin/python3.13 scripts/eval_digit_ensemble_answer_level.py --out private-evidence/reports/digit-ensemble-answer-level-20260707/no-key-yellow-only/summary.json
.venv/bin/python3.13 scripts/eval_digit_ensemble_answer_level.py --layout-features --out private-evidence/reports/digit-ensemble-answer-level-20260707/no-key-layout-yellow-only/summary.json
node --check scripts/eval_review_suggestion_policy.mjs
node --check scripts/replay_live_ocr_captured.mjs
node scripts/eval_review_suggestion_policy.mjs --out private-evidence/reports/review-suggestion-policy-20260707/final-strong-review-suggestions/summary.json
npm run build
node scripts/replay_live_ocr_captured.mjs --allow-imperfect --url https://localhost:5174 --out-dir private-evidence/reports/review-suggestions-browser-smoke-20260707-final --limit 12 private-evidence/debug-scans/2026-07-02
node scripts/score_replay_against_handwritten_truth.mjs --out private-evidence/reports/review-suggestions-browser-smoke-20260707-final/truth-score.json private-evidence/reports/review-suggestions-browser-smoke-20260707-final
```

Current judgement:

- This is a safer teacher-review improvement, not a solution to the automatic `90-95%` confident-read goal.
- The stronger review-suggestion policy is a good candidate to keep because it removed known bad hints while preserving clean assists.
- The no-key ensemble shows useful zero-harm review-only rescues but is not strong enough to become the recognizer.

Next action:

1. If deploying, use a new build label that clearly indicates review-suggestion safety tightening.
2. Continue no-key recognizer work with answer-level zero-harm gates.
3. Focus the next technical push on non-row and leading/left-slot recognition, not worksheet redesign.

## 2026-07-07 No-Key Ensemble Overlap Check

Follow-up analysis added per-answer detail rows to the review-suggestion and answer-level ensemble evaluators, then compared the strict live review suggestions against no-key yellow-only ensemble suggestions.

New/updated tooling:

- `scripts/eval_review_suggestion_policy.mjs` now writes an `items` array for each answer group.
- `scripts/eval_digit_ensemble_answer_level.py` now writes per-strategy `items` arrays.
- `scripts/analyze_review_suggestion_overlap.mjs` compares strict live suggestions with no-key ensemble suggestions and searches simple gates for additive no-key hints.

Reports:

- `private-evidence/reports/review-suggestion-policy-20260707/final-strong-review-suggestions-with-items/summary.json`
- `private-evidence/reports/digit-ensemble-answer-level-20260707/no-key-yellow-only-with-items/summary.json`
- `private-evidence/reports/review-suggestion-overlap-20260707/summary.json`

Key result:

- Strict live suggestions remain `79/79` correct against handwritten truth.
- The no-key ensemble is not safe as a general teacher-facing hint layer:
  - Aggressive changed suggestions: `31/66` correct, `35/66` wrong.
  - Conservative gated changed suggestions: `13/27` correct, `14/27` wrong.
- The previous "0 harm" yellow-only metric was too weak because it only counted cases where a currently-correct yellow read was damaged. For teacher-facing suggestions, changing one wrong yellow read into a different wrong suggestion is still a trust problem and must count as wrong.
- The only zero-wrong additive pocket found by the simple gate search was tiny: `3/3` row-sheet rescues, with no non-row additive gate that was both useful and wrong-free.

Decision:

- Do not add no-key ensemble suggestions to the public app yet.
- Keep the strict live review-suggestion policy as the product-facing candidate.
- Use the no-key ensemble rescues as training/crop/preprocessing signal for the next recognizer, not as a deployable policy.

## 2026-07-07 Single-Digit 6 Shape Risk Demotion

The next trust-focused pass inspected the only two confident wrong reads in the frozen `582`-answer labelled corpus. Both were single-slot row-sheet reads where the app confidently predicted `6` even though the expected answer was a visually adjacent `5` or `8`.

Cases:

- `2026-07-02_14-33-38-334-sg-g1-lw-03-sub-1digit-5b8e24a7::7`: expected `5`, handwritten truth `10`, app read `6`.
- `2026-07-02_14-37-51-441-sg-g1-lw-03-sub-1digit-1d2b16d2::6`: expected/truth `8`, app read `6`.

Change:

- Added `single-digit-six-shape-mismatch-review` in `src/components/CameraCapture.vue`.
- Mirrored the same rule in `scripts/replay_live_ocr_captured.mjs`.
- The rule does not rewrite the digit and does not mark anything correct. It only uses the answer key as a review-only risk signal when a non-virtual single-slot answer is read as `6` but the expected digit is `5` or `8`.

Full-corpus policy simulation:

- Report: `private-evidence/reports/single-digit-six-risk-review-20260707/full-corpus-policy-simulation.json`
- Before: `289/582` auto, `287/289` auto-correct, `2` auto-wrong, `293` yellow.
- After simulation: `287/582` auto, `287/287` auto-correct, `0` auto-wrong, `295` yellow.
- Demoted exactly `2` answers: `2` auto-wrong, `0` auto-correct.

Browser replay verification:

- Replay directory: `private-evidence/reports/single-digit-six-risk-review-20260707/`
- Truth score: `private-evidence/reports/single-digit-six-risk-review-20260707/truth-score.json`
- On `374` matched replay groups from `67` saved captures:
  - Auto: `205/374`.
  - Auto-correct: `205/205`.
  - Auto-wrong: `0`.
  - Yellow: `169`.
  - Yellow suggestions: `53/53` correct.
  - Row auto: `126/176` with `126/126` correct.
  - Non-row auto: `79/198` with `79/79` correct.

Verification commands:

```text
node --check scripts/replay_live_ocr_captured.mjs
npm run build
node scripts/replay_live_ocr_captured.mjs --allow-imperfect --url https://localhost:5174 --out-dir private-evidence/reports/single-digit-six-risk-review-20260707 private-evidence/debug-scans/2026-07-02
node scripts/score_replay_against_handwritten_truth.mjs --out private-evidence/reports/single-digit-six-risk-review-20260707/truth-score.json private-evidence/reports/single-digit-six-risk-review-20260707
```

Decision:

- Keep this patch as a trust-preserving review demotion.
- It slightly reduces auto coverage but removes the known confident wrong category in the labelled corpus.
- This still does not solve the larger market-readiness problem: non-row coverage remains low (`39.9%` auto in this replay), so the next technical push should return to no-key recognizer/crop/preprocessing improvements for non-row and leading/left-slot digits.

## 2026-07-07 Variant Top-K Review Suggestion Tightening

Continued the non-row/leading-slot analysis after the single-digit `6` trust patch.

What changed:

- Added `scripts/analyze_nonrow_context_suggestion_delta.mjs` to compare a candidate review-suggestion policy against the strict baseline and list exactly which extra suggestions it adds.
- Tested the tempting broad policy "allow non-row leading `7 -> 1` answer-key context." Rejected it:
  - Report: `private-evidence/reports/review-suggestion-policy-20260707/non-row-leading-seven-context-with-items/summary.json`
  - Delta added only `7` suggestions: `5` correct, `2` wrong.
  - The two wrong suggestions were real student wrong answers (`72`/`73`) on dot-collection work where the answer key expected `12`/`13`.
- Added a narrower live/replay review-only rule:
  - Variant `topK` alternatives now count as independent evidence for review suggestions.
  - Leading `7 -> 1` answer-key-context suggestions require independent `1` evidence at `>= 0.22`.
  - This remains review-only. It does not change auto/yellow status, saved score, or OCR output.

Evidence:

- Strict previous baseline: `79/79` review suggestions correct.
- New evaluator report: `private-evidence/reports/review-suggestion-policy-20260707/live-variant-topk-leading-one-022-with-items/summary.json`
  - Same `582` labelled answers.
  - Auto lane unchanged: `289/582` auto, `287/289` auto-correct, `2` auto-wrong in the offline rows baseline.
  - Review suggestions: `82/293` yellow answers.
  - Suggestion correctness: `82/82` against handwritten truth.
  - Rescued yellow wrong-leaning answers: `53`.
  - Non-row suggestions: `64/64` correct.
  - Row suggestions: `18/18` correct.
- Threshold sweep:
  - `0.21` introduced `1` wrong suggestion.
  - `0.22` kept `0` wrong suggestions while adding `3` correct suggestions.
  - `0.23` kept `0` wrong suggestions but added only `1` correct suggestion.
- Browser smoke replay:
  - Replay directory: `private-evidence/reports/variant-topk-leading-one-review-20260707-browser/`
  - Truth score: `private-evidence/reports/variant-topk-leading-one-review-20260707-browser/truth-score.json`
  - On `100` matched answer groups from `20` saved captures:
    - Auto: `47/100`.
    - Auto-correct: `47/47`.
    - Auto-wrong: `0`.
    - Yellow suggestions: `15/15` correct.
- Full browser replay:
  - Replay directory: `private-evidence/reports/variant-topk-leading-one-review-20260707-full-browser/`
  - Truth score: `private-evidence/reports/variant-topk-leading-one-review-20260707-full-browser/truth-score.json`
  - On `374` matched answer groups from `67` saved captures:
    - Auto: `205/374`.
    - Auto-correct: `205/205`.
    - Auto-wrong: `0`.
    - Yellow suggestions: `56/56` correct.
    - Row auto: `126/176` (`71.6%`) with `0` auto-wrong.
    - Non-row auto: `79/198` (`39.9%`) with `0` auto-wrong.

Commands run:

```text
node --check scripts/eval_review_suggestion_policy.mjs
node --check scripts/replay_live_ocr_captured.mjs
node scripts/eval_review_suggestion_policy.mjs --out private-evidence/reports/review-suggestion-policy-20260707/live-variant-topk-leading-one-022-with-items/summary.json
npm run build
node scripts/replay_live_ocr_captured.mjs --allow-imperfect --url https://127.0.0.1:5174 --out-dir private-evidence/reports/variant-topk-leading-one-review-20260707-browser --limit 20 private-evidence/debug-scans/2026-07-02
node scripts/score_replay_against_handwritten_truth.mjs --out private-evidence/reports/variant-topk-leading-one-review-20260707-browser/truth-score.json private-evidence/reports/variant-topk-leading-one-review-20260707-browser
node scripts/replay_live_ocr_captured.mjs --allow-imperfect --url https://127.0.0.1:5174 --out-dir private-evidence/reports/variant-topk-leading-one-review-20260707-full-browser private-evidence/debug-scans/2026-07-02
node scripts/score_replay_against_handwritten_truth.mjs --out private-evidence/reports/variant-topk-leading-one-review-20260707-full-browser/truth-score.json private-evidence/reports/variant-topk-leading-one-review-20260707-full-browser
```

Files changed:

```text
src/components/CameraCapture.vue
scripts/replay_live_ocr_captured.mjs
scripts/eval_review_suggestion_policy.mjs
scripts/analyze_nonrow_context_suggestion_delta.mjs
SCANGRADE_ACTIVE_HANDOFF.md
docs/SCANGRADE_ACCURACY_ROADMAP_20260705.md
```

Decision:

- Keep the narrow variant-topK review-suggestion patch as a tiny teacher-review improvement.
- Do not deploy the broad non-row answer-key-context policy.
- Continue treating answer-key context as review assistance only, never as hidden auto-correction.

Next action:

1. Full replay the current browser app when useful, beyond the `20`-capture smoke subset.
2. Continue no-key recognizer/crop/preprocessing work for non-row layouts. The product still needs a real coverage breakthrough; review suggestions are only workflow help.
3. Mine ten-frame, number-pattern, number-bond, and place-value yellow failures for portable crop/preprocessing fixes that do not depend on the answer key.

## 2026-07-08 Review Opportunity / Selector Diagnosis

Continued the market-readiness OCR analysis from the variant-topK full browser replay.

What changed:

- Added `scripts/analyze_replay_failure_modes.mjs` to summarize latest replay misses against handwritten truth by layout, family, confusion, review reason, and examples.
- Added `scripts/analyze_replay_review_opportunities.mjs` to measure whether yellow wrong-leaning cases contain any independent evidence for the handwritten-truth answer in current read, model topK, preprocessing variants, or variant topK.
- Reran the current review-suggestion evaluator to confirm the strict variant-topK policy remains `82/82` correct on the labelled corpus.

Evidence:

- Failure report: `private-evidence/reports/failure-modes-20260707/variant-topk-full-browser.json`
- Review opportunity report: `private-evidence/reports/review-opportunities-20260707/variant-topk-full-browser.json`
- Current policy rerun: `private-evidence/reports/review-suggestion-policy-20260707/current-default-rerun/summary.json`

Results from the latest full browser replay:

- Matched answer groups: `374`.
- Auto/confident lane: `205/374`, `205/205` correct, `0` confidently wrong.
- Yellow/manual review: `169`.
- Yellow current lean already matched handwriting on `35`.
- Yellow wrong-leaning cases: `134`.
- Of those `134`, `101` had at least a trace of the handwritten-truth answer somewhere in current/topK/variant evidence.
- `73/134` had weak-or-better support across all needed slots.
- `36/134` had medium-or-better support across all needed slots.
- `16/134` had strong support across all needed slots.
- Non-row layouts were the dominant remaining drag: `101/134` yellow wrong-leaning cases.
- Worst layouts by yellow wrong-leaning count:
  - `sg-g1-lw-06-ten-frames`: `25`.
  - `sg-g1-lw-08-number-bonds`: `25`.
  - `sg-g1-lw-07-dot-collections`: `22`.
  - `sg-g1-lw-09-number-patterns`: `16`.
  - `sg-g1-lw-10-place-value-50`: `13`.

Important negative result:

- A quick no-key "switch to high-confidence variant evidence" probe was unsafe.
- Even at very high variant-evidence thresholds, suggestions were often wrong because false variant candidates can be extremely confident.
- At threshold `0.95`, naive no-key switching produced only `8/17` correct suggestions.
- At threshold `0.75`, it produced only `12/49` correct suggestions.
- Conclusion: the opportunity is real, but the hard problem is selector/calibration, not simply trusting stronger variant confidence.

Commands run:

```text
node --check scripts/analyze_replay_failure_modes.mjs
node scripts/analyze_replay_failure_modes.mjs --out private-evidence/reports/failure-modes-20260707/variant-topk-full-browser.json private-evidence/reports/variant-topk-leading-one-review-20260707-full-browser
node --check scripts/analyze_replay_review_opportunities.mjs
node scripts/analyze_replay_review_opportunities.mjs --out private-evidence/reports/review-opportunities-20260707/variant-topk-full-browser.json private-evidence/reports/variant-topk-leading-one-review-20260707-full-browser
node --check scripts/eval_review_suggestion_policy.mjs
node scripts/eval_review_suggestion_policy.mjs --out private-evidence/reports/review-suggestion-policy-20260707/current-default-rerun/summary.json
```

Decision:

- Do not auto-promote yellow cases using answer-key context or raw variant confidence.
- Do not add answer-key-only `5 -> 6` hints; the missed cases lacked enough independent evidence, and real student wrong answers make that unsafe.
- Keep the current auto lane conservative.
- The next technical work should be a proper selector/model track: learn when variant evidence is trustworthy using quality signals, layout risk, slot side, and validation/holdout gates. The selector must be judged at answer level, not only digit-slot level.

Next action:

1. Build a formal no-key selector experiment around the opportunity report, especially for non-row layouts.
2. Use validation/holdout splits and answer-level scoring; do not deploy unless confident wrong stays zero.
3. If no selector candidate clears the safety gate, focus on training a ScanGrade-specific recognizer and better blank/artifact classifiers rather than threshold loosening.

## 2026-07-08 Split-Aware No-Key Gate Search

Continued from the selector diagnosis by building a split-aware no-answer-key gate search over the latest full browser replay.

What changed:

- Added `scripts/search_no_key_variant_review_gates.mjs`.
- The script joins the latest replay to handwritten truth and to the existing digit-row split labels (`calibration`, `validation`, `holdout`).
- It generates no-key candidate review suggestions from current read, model topK, preprocessing variants, and variant topK.
- It searches simple gates over minimum evidence confidence, changed-slot count, variant top-1 count, topK count, and row/non-row family.
- It tunes only on calibration, then reports validation and holdout behavior.

Evidence:

- Report: `private-evidence/reports/no-key-variant-review-gates-20260708/full-browser.json`
- Input replay: `private-evidence/reports/variant-topk-leading-one-review-20260707-full-browser/`
- Split coverage in replay: `374` labelled groups, with `208` calibration, `100` validation, and `66` holdout.

Result:

- The best calibration-zero-wrong gate was:
  - `conf>=0.95 changed<=1 vtop>=0 topk>=0 row`
  - Calibration: `1/1` suggestion correct, `1` rescue, `0` wrong.
  - Validation: `1/1` suggestion correct, `1` rescue, `0` wrong.
  - Holdout: `0` suggestions.
- No useful non-row zero-wrong gate survived.
- Broader gates were badly unsafe. For example:
  - `conf>=0.9 changed<=1 ... all` gave validation `2` correct / `8` wrong and holdout `2` correct / `9` wrong.
  - `conf>=0.9 changed<=1 ... non-row` gave validation `1` correct / `8` wrong and holdout `2` correct / `9` wrong.

Interpretation:

- Simple no-key threshold gates are not enough.
- The existing variant evidence contains signal, but high-confidence false variants are common.
- The next viable selector must use richer features: tensor/ink quality, artifact flags, layout risk, slot side, current-vs-alternative conflict, variant disagreement pattern, and answer-level safety scoring.
- Do not integrate this simple gate into the app; its useful safe coverage is too tiny.

Commands run:

```text
node --check scripts/search_no_key_variant_review_gates.mjs
node scripts/search_no_key_variant_review_gates.mjs --out private-evidence/reports/no-key-variant-review-gates-20260708/full-browser.json private-evidence/reports/variant-topk-leading-one-review-20260707-full-browser
```

Decision:

- Reject simple no-key variant gates as a production or teacher-facing suggestion path.
- Keep current strict review suggestions and conservative auto lane.
- Move next to either:
  1. a learned selector using tensor/quality features, trained on calibration and judged on validation/holdout at answer level; or
  2. a model/blank-artifact classifier training track if selector gains remain too small.

Next action:

1. Extend the existing Python selector/ensemble tools to consume latest replay evidence or produce a candidate learned selector report with answer-level validation/holdout metrics.
2. Require zero added confident wrong and meaningful non-row gain before any app integration.
3. If learned selector still fails, prioritize model training and blank/artifact classifier work over more handwritten rules.

## 2026-07-08 Learned No-Key Replay Selector

Continued the market-readiness OCR push by testing whether a learned selector could safely rescue yellow/manual-review answers without using the answer key.

What changed:

- Added `scripts/eval_no_key_replay_selector.mjs`.
- The script joins the latest full browser replay to handwritten-truth labels and the existing calibration/validation/holdout split labels.
- It generates alternative answer candidates from current model topK, preprocessing variants, and variant topK.
- It trains a small logistic selector on calibration candidates using only no-key features: confidence, top-gap, changed-slot count, variant/topK support, row/non-row family, slot count, digit-change patterns, and optional layout ID.
- It reports calibration, validation, and holdout answer-level behavior separately.

Evidence:

- No-layout report: `private-evidence/reports/no-key-replay-selector-20260708/no-layout.json`
- Layout-feature report: `private-evidence/reports/no-key-replay-selector-20260708/layout.json`
- Input replay: `private-evidence/reports/variant-topk-leading-one-review-20260707-full-browser/`

Result:

- Replay-matched groups: `374`.
- Candidate records: `3713`.
- Split coverage: `208` calibration, `100` validation, `66` holdout.
- Best calibration-zero-wrong no-layout selector:
  - Calibration: `1/1` suggestion correct, `0` wrong.
  - Validation: `0` suggestions.
  - Holdout: `0` suggestions.
- Best calibration-zero-wrong layout-feature selector was effectively the same tiny pocket:
  - Calibration: `1/1` suggestion correct, `0` wrong.
  - Validation: `0` suggestions.
  - Holdout: `0` suggestions.
- Lowering thresholds to get real validation/holdout coverage was unsafe. Representative runs produced validation/holdout suggestions that were wrong before they produced useful rescues.

Interpretation:

- The learned replay-metadata selector did not safely generalize.
- This confirms the previous simple-gate finding: current variant/topK metadata contains real signal, but also high-confidence false alternatives.
- Do not integrate this selector into the app.
- The next useful work is richer visual evidence, not more confidence-threshold tuning: tensor/ink quality features, blank/artifact classifiers, crop-quality signals, and/or a stronger ScanGrade-specific recognizer.

Commands run:

```text
node --check scripts/eval_no_key_replay_selector.mjs
node scripts/eval_no_key_replay_selector.mjs --out private-evidence/reports/no-key-replay-selector-20260708/no-layout.json private-evidence/reports/variant-topk-leading-one-review-20260707-full-browser
node scripts/eval_no_key_replay_selector.mjs --layout-features --out private-evidence/reports/no-key-replay-selector-20260708/layout.json private-evidence/reports/variant-topk-leading-one-review-20260707-full-browser
```

Decision:

- Reject learned no-key replay selector v1 as production logic.
- Keep the current conservative auto lane: `205/205` auto-correct and `0` confidently wrong on the latest full replay remains the trust anchor.
- Keep strict review suggestions only where evidence is proven high precision.
- Pivot the next experiment toward image/tensor-level quality and artifact signals, especially for non-row sheets.

Next action:

1. Add a tensor/image quality audit for yellow cases and false alternatives.
2. Build a blank/artifact classifier or stricter quality gate for optional/empty slots.
3. Revisit selector training only after adding visual quality features that can separate true handwriting from divider/box-line artifacts.

## 2026-07-08 Visual Quality / Artifact Audit

Continued from the failed no-key selector by testing whether tensor-level visual quality can explain why some yellow alternatives are safe while others are false high-confidence traps.

What changed:

- Added `scripts/analyze_replay_visual_quality.mjs`.
- Extended `scripts/eval_no_key_replay_selector.mjs` with optional `--quality-features` and `--debug-root` support.
- The visual audit joins latest replay results, handwritten-truth labels, and saved Mission Control `debug.json` tensors by capture ID.
- It measures the same 28x28 tensor evidence the digit model sees, including ink size, connected components, usable variant ratio, weak variant ratio, artifact-like variant ratio, fragmentation, and rough line-artifact flags.

Evidence:

- Visual audit report: `private-evidence/reports/visual-quality-audit-20260708/full-browser.json`
- Quality selector report: `private-evidence/reports/no-key-replay-selector-20260708/quality.json`
- Quality + layout selector report: `private-evidence/reports/no-key-replay-selector-20260708/quality-layout.json`
- Input replay: `private-evidence/reports/variant-topk-leading-one-review-20260707-full-browser/`

Visual audit result:

- Matched answer groups: `374/374` with debug tensors found.
- Aligned slot groups: `333`.
- Overall tensor slots audited: `616`.
- Yellow-wrong groups are more visually suspicious than yellow-correct groups:
  - Yellow leaning correct: usable variant ratio `0.4413`, artifact variant ratio `0.4426`, weak variant ratio `0.4795`.
  - Yellow leaning wrong: usable variant ratio `0.3244`, artifact variant ratio `0.6009`, weak variant ratio `0.5216`.
- Non-row is the main product bottleneck:
  - Non-row auto-correct: usable variant ratio `0.4518`, artifact variant ratio `0.4654`, weak variant ratio `0.4371`.
  - Non-row yellow-wrong: usable variant ratio `0.3392`, artifact variant ratio `0.5811`, weak variant ratio `0.5121`.
- Row one-digit pages have high apparent artifact/weak rates despite many correct reads. This means the current visual rules are not safe as a blunt gate.
- Layout-level weak/artifact signal:
  - `sg-g1-lw-01-add-1digit`: weak slot pct `72.9`, artifact slot pct `89.6`.
  - `sg-g1-lw-03-sub-1digit`: weak slot pct `71.4`, artifact slot pct `91.1`.
  - Non-row layouts generally had better raw `ok` rates but still much lower auto coverage, implying the model/selector is confused by shape patterns, not only blank crops.
- Top aligned slot confusions in this replay:
  - `7->1`: `21`.
  - `2->9`: `7`.
  - `5->6`: `7`.
  - `9->1`: `7`.
  - `1->9`: `5`.

Quality-feature selector result:

- `--quality-features` added numeric visual-quality features to the learned replay selector.
- Candidate records stayed at `3713`.
- Feature counts:
  - Quality only: `41` numeric, `370` categorical.
  - Quality + layout: `41` numeric, `378` categorical.
- Both quality-feature selectors failed the safety gate:
  - Calibration-zero-wrong count: `0`.
  - Validation-zero-wrong top runs: none.
- Representative high-score run was unsafe:
  - Calibration `1` correct / `2` wrong.
  - Validation `0` correct / `1` wrong.
  - Holdout `2` correct / `3` wrong.

Interpretation:

- Tensor quality is diagnostically useful but not yet a deployable selector feature.
- The current quality metrics are too generic: they can identify suspicious evidence, but they do not reliably separate real child handwriting from artifacts across layouts.
- A generic logistic selector with quality columns is the wrong next production path.
- The next useful direction is a dedicated blank/artifact/real-handwriting classifier or manually audited artifact label set, not more threshold tuning.

Commands run:

```text
node --check scripts/analyze_replay_visual_quality.mjs
node scripts/analyze_replay_visual_quality.mjs --out private-evidence/reports/visual-quality-audit-20260708/full-browser.json private-evidence/reports/variant-topk-leading-one-review-20260707-full-browser
node --check scripts/eval_no_key_replay_selector.mjs
node scripts/eval_no_key_replay_selector.mjs --quality-features --out private-evidence/reports/no-key-replay-selector-20260708/quality.json private-evidence/reports/variant-topk-leading-one-review-20260707-full-browser
node scripts/eval_no_key_replay_selector.mjs --quality-features --layout-features --out private-evidence/reports/no-key-replay-selector-20260708/quality-layout.json private-evidence/reports/variant-topk-leading-one-review-20260707-full-browser
node --check scripts/create_artifact_label_pack.mjs
node scripts/create_artifact_label_pack.mjs --out-dir private-evidence/artifact-label-packs/20260708-visual-quality --per-class 80
```

Decision:

- Do not integrate visual-quality selector features into app logic yet.
- Keep `scripts/analyze_replay_visual_quality.mjs` as a diagnostic tool.
- Next best move: build a small labelled artifact-vs-real-writing dataset from existing tensors/crops, then train/evaluate a binary classifier or stricter rule set against calibration/validation/holdout.

Artifact label pack:

- Added `scripts/create_artifact_label_pack.mjs`.
- Generated private label pack: `private-evidence/artifact-label-packs/20260708-visual-quality/`
- Files:
  - `contact-sheet.png`
  - `records.json`
  - `README.md`
- Pack contents: `93` tensor examples, with `47` suspicious-artifact candidates and `46` comparison auto/yellow-correct candidates.
- Visual spot-check showed an important caveat: some comparison auto-correct examples still visibly include dividers/box artifacts. Therefore labels must be assigned from the tensor image itself, not from whether the app happened to grade the answer correctly.

Next action:

1. Generate contact sheets for suspected artifact slots, clean handwriting slots, and false high-confidence variant alternatives.
2. Label a small calibration set as `real-writing`, `blank`, `box-line/divider`, `fragment/noise`, or `unclear`.
3. Train/evaluate a binary real-writing/artifact classifier.
4. Use it only as a review demotion or selector-blocking feature until validation/holdout proves it does not increase confident wrong reads.

## 2026-07-08 Blank / Artifact Classifier Smoke

Continued the artifact path by testing whether the existing slot-level handwritten-truth digit rows can train a filled-vs-blank detector from saved tensors.

What changed:

- Added `scripts/eval_blank_artifact_classifier.mjs`.
- The evaluator reads `private-evidence/reports/digit-failure-dataset-20260705-current/digit-rows.json`.
- It joins each slot row to its saved `debug.json` tensor by `debugPath` and `detailId`.
- It trains a logistic filled-vs-blank classifier on calibration rows only.
- It reports validation and holdout separately.
- It supports `--visual-only` to remove policy/review leakage fields such as `preprocessReviewReason`, `robustOverride`, `groupReview`, and `confidencePolicyCleared`.

Evidence:

- Full-feature report: `private-evidence/reports/blank-artifact-classifier-20260708/summary.json`
- Visual-only report: `private-evidence/reports/blank-artifact-classifier-20260708/visual-only.json`
- Input slot rows: `960` rows total, `918` usable for filled-vs-blank after requiring a tensor-backed filled or blank label.

Visual-only result:

- Feature counts: `43` numeric, `15` categorical.
- Split counts:
  - Calibration: `639` slots (`605` filled, `34` blank).
  - Validation: `170` slots (`157` filled, `13` blank).
  - Holdout: `109` slots (`103` filled, `6` blank).
- AUC:
  - Calibration: `0.9996`.
  - Validation: `0.998`.
  - Holdout: `1.0`.
- Best calibration-zero-false-blank gate:
  - `l2=0.01`, threshold `0.1`.
  - Calibration: caught `26/34` blanks (`76.5%`) with `0` filled slots misclassified as blank.
  - Validation: caught `9/13` blanks (`69.2%`) with `0` filled slots misclassified as blank.
  - Holdout: caught `5/6` blanks (`83.3%`) with `0` filled slots misclassified as blank.
- Validation-zero-false-blank top gates similarly held `0` false blanks on holdout in the top candidates.

Interpretation:

- This is the first artifact/blank path that looks genuinely promising.
- Unlike the generic no-key answer selector, the blank detector has a clear and narrow job: block or demote likely blank/artifact slots, not choose the final handwritten digit.
- The visual-only result is especially important because it removes current-policy leakage fields.
- Caveat: some slot blank labels were inferred from app slot underscores (`truthSlotSource: inferred-from-app-slot-underscores`), so this is not deployment proof yet. It is strong evidence for building a proper blank/artifact classifier with manually audited labels.

Commands run:

```text
node --check scripts/eval_blank_artifact_classifier.mjs
node scripts/eval_blank_artifact_classifier.mjs --out private-evidence/reports/blank-artifact-classifier-20260708/summary.json
node scripts/eval_blank_artifact_classifier.mjs --visual-only --out private-evidence/reports/blank-artifact-classifier-20260708/visual-only.json
```

Decision:

- Keep `scripts/eval_blank_artifact_classifier.mjs` as the next technical basis for a real blank/artifact module.
- Do not integrate it into app logic yet because labels need manual artifact validation and the classifier needs to be exported/replayed as an app-equivalent path.
- The next safe implementation step is not an auto-grade change; it is a reproducible app-side blank/artifact scoring function plus replay-only demotion simulation.

Next action:

1. Manually label the artifact label pack or create a smaller high-confidence hand-label set from it.
2. Re-run the classifier using manually labelled artifact classes, not only inferred blank slots.
3. If validation/holdout remain zero-false-blank, integrate as a review-only demotion/blocking feature in replay first.
4. Only after replay proves zero added confident wrong, consider app integration.

## 2026-07-08 Blank / Artifact Replay Simulation

Continued the blank/artifact path by extending the classifier evaluator into a replay-level policy simulator.

What changed:

- Extended `scripts/eval_blank_artifact_classifier.mjs` with:
  - `--simulate-replay <replay-dir>`
  - replay/debug/truth joining
  - answer-level baseline scoring
  - conservative demotion simulation
  - review-only blanking suggestion simulation
  - risky auto-blank comparison for lab visibility only
- This remains analysis-only. No production app OCR/capture behavior changed.

Evidence:

- Report: `private-evidence/reports/blank-artifact-classifier-20260708/visual-only-replay-sim.json`
- Input replay: `private-evidence/reports/variant-topk-leading-one-review-20260707-full-browser/`
- Trained from calibration slots in `private-evidence/reports/digit-failure-dataset-20260705-current/digit-rows.json`.
- Classifier mode: `--visual-only`, using the previous best calibration-zero-false-blank gate (`l2=0.01`, threshold `0.1`).

Replay simulation result:

- Matched answer groups: `374`.
- Baseline:
  - Auto/confident: `205/374`.
  - Auto-correct: `205/205`.
  - Auto-wrong: `0`.
  - Yellow: `169`.
  - Yellow current lean correct: `35`.
- Classifier detected `14` blank slots.
- Conservative demotion simulation:
  - Auto/confident remained `205/374`.
  - Auto-correct remained `205/205`.
  - Auto-wrong remained `0`.
  - No additional auto groups needed demotion at this threshold.
- Risky auto-blank comparison, not recommended for production:
  - Auto lane unchanged.
  - Yellow current-lean correct would improve from `35` to `38`.
  - Yellow wrong-leaning would drop from `134` to `131`.
- Review-only blanking suggestions:
  - `3` suggestions.
  - `3/3` correct.
  - `0` wrong.
  - `3` rescues.
  - `0` harmed current-correct yellow reads.
- All three rescues were validation-set ten-frame cases where a one-digit student answer had picked up a false right-slot companion:
  - `71 -> 7`
  - `81 -> 8`
  - `91 -> 9`

Interpretation:

- The classifier is not a big coverage breakthrough yet, but it is a safe and targeted review-assist signal in replay.
- It directly addresses the false companion digit problem without touching the auto lane.
- It should not be auto-applied yet because the labels still need manual artifact validation and the replay benefit is currently small.
- The product-shaped next step is a teacher-review suggestion such as "blank this slot" or a behind-the-scenes review suggestion source, not automatic score changes.

Commands run:

```text
node --check scripts/eval_blank_artifact_classifier.mjs
node scripts/eval_blank_artifact_classifier.mjs --visual-only --simulate-replay private-evidence/reports/variant-topk-leading-one-review-20260707-full-browser --out private-evidence/reports/blank-artifact-classifier-20260708/visual-only-replay-sim.json
```

Decision:

- Keep the replay simulation path.
- Do not integrate app behavior yet.
- Treat the blank/artifact classifier as a candidate teacher-review suggestion source after manual label validation.

Next action:

1. Label or pseudo-label a stronger artifact dataset.
2. Add a replay evaluator that combines current strict review suggestions with blank/artifact review suggestions and reports total teacher-review assist coverage.
3. If combined review suggestions stay zero-wrong on validation/holdout, integrate them as review-only UI hints.

## 2026-07-08 Combined Review-Assist Evaluation

Continued the review-assist track by combining two safe teacher-review suggestion sources:

1. The existing strict built-in `reviewSuggestion` attached to replayed yellow answers.
2. The new blank/artifact replay-simulation suggestions for false companion slots.

What changed:

- Added `scripts/eval_combined_review_assist.mjs`.
- The script joins:
  - handwritten truth labels,
  - latest full-browser replay results,
  - split labels from digit rows,
  - blank/artifact replay-simulation examples.
- It reports built-in suggestions, blank/artifact suggestions, and the combined union separately by overall, row/non-row family, split, and source.
- This is analysis-only. No app grading, OCR, capture, homography, or public UI behavior changed.

Evidence:

- Report: `private-evidence/reports/combined-review-assist-20260708/summary.json`
- Replay input: `private-evidence/reports/variant-topk-leading-one-review-20260707-full-browser/`
- Blank/artifact input: `private-evidence/reports/blank-artifact-classifier-20260708/visual-only-replay-sim.json`
- Truth input: `private-evidence/truth-labels/20260703-flex-duplicate-accepted-needs-label/handwritten-truth-labelled.json`

Results:

- Baseline latest replay:
  - Matched groups: `374`.
  - Auto/confident: `205/374`.
  - Auto-correct: `205/205`.
  - Auto-wrong: `0`.
  - Yellow/manual review: `169`.
  - Yellow current lean correct: `35/169`.
- Built-in strict review suggestions:
  - `56` suggestions.
  - `56/56` correct.
  - `0` wrong.
  - `35` rescues.
- Blank/artifact suggestions:
  - `3` suggestions.
  - `3/3` correct.
  - `0` wrong.
  - `3` rescues.
- Combined review assist:
  - `59` suggestions across `169` yellow answers.
  - `59/59` correct.
  - `0` wrong.
  - `38` rescues.
  - `0` harmed current-correct yellow reads.
  - No conflicts between built-in and blank/artifact suggestion sources.

Breakdown:

- Row: `15/50` yellow answers suggested, `15/15` correct, `7` rescues.
- Non-row: `44/119` yellow answers suggested, `44/44` correct, `31` rescues.
- Calibration: `30/85` suggested, `30/30` correct.
- Validation: `20/51` suggested, `20/20` correct.
- Holdout: `9/33` suggested, `9/9` correct.

Commands run:

```text
node --check scripts/eval_combined_review_assist.mjs
node scripts/eval_combined_review_assist.mjs
```

Decision:

- This is a real product/workflow improvement candidate, but it should remain review-only.
- It does not increase automatic confident coverage yet; the auto lane remains `205/374`.
- It can make teacher review much faster by pre-filling a likely value for about `35%` of yellow answers while preserving `0` wrong suggestions on the current replay.
- Do not convert these suggestions into automatic grading until a larger validation/holdout path proves no added confident wrong reads.

Next action:

1. Design the teacher-review UI behavior for safe suggestions: prefill/highlight "likely read" while still requiring teacher confirmation for yellow answers.
2. Decide whether to include blank/artifact suggestions in public review UI only after manual artifact-label validation.
3. Continue the deeper recognizer path separately: reduce non-row yellow volume through better crop/preprocessing/model work, not by making the auto lane less conservative.

## 2026-07-08 Review-Assist UI Metric + Benchmark Command

Continued from the combined review-assist evaluation by making the proven review-assist metric easier to rerun and easier to see in the Teacher Review UI.

What changed:

- Added package script `npm run eval:combined-review-assist`.
- Updated `src/App.vue` Teacher Review summary to include a passive `Likely reads` count.
- Updated likely-read chips to include confidence and source when available, e.g. OCR alternative vs context review.
- This is UI/reporting only. It does not change OCR, capture, homography, auto-grading confidence, review routing, or scoring.

Evidence:

- Script: `scripts/eval_combined_review_assist.mjs`
- Report: `private-evidence/reports/combined-review-assist-20260708/summary.json`

Commands run:

```text
npm run eval:combined-review-assist
npm run build
```

Results:

- Combined review-assist benchmark still matches the previous report:
  - Baseline: `374` groups, `205/374` auto, `205/205` auto-correct, `0` auto-wrong, `169` yellow.
  - Built-in suggestions: `56/56` correct, `0` wrong.
  - Blank/artifact suggestions: `3/3` correct, `0` wrong.
  - Combined: `59/59` correct, `0` wrong, `38` rescues, `0` harmed current-correct yellow reads.
- `npm run build` passed.

Files changed:

- `package.json`
- `src/App.vue`
- `scripts/eval_combined_review_assist.mjs`
- `SCANGRADE_ACTIVE_HANDOFF.md`
- `docs/SCANGRADE_ACCURACY_ROADMAP_20260705.md`

Decision:

- Keep this change. It makes the review-assist path more measurable and more visible without risking the auto lane.
- Do not claim this improves automatic OCR coverage. The auto benchmark remains `205/374`; this improves the teacher-review workflow around yellow cases.

Next action:

1. Build a replay-equivalent blank/artifact suggestion source that can be produced by app-side code, not only offline simulation.
2. Validate it against handwritten truth and split labels before exposing it in the public UI.
3. Continue attacking non-row recognition coverage separately with crop/preprocessing/model improvements.

## 2026-07-08 Targeted Six-From-Five Review Suggestion Gate

Continued the non-row/yellow-volume push by investigating the largest remaining uncovered single-digit confusion in the latest replay: yellow answers where the current leaning read is `5` but handwritten truth is `6`.

What changed:

- Added `scripts/search_six_from_five_review_gate.mjs`.
- Added package script `npm run search:six-five-review-gate`.
- Lowered the review-only `6`-from-`5` independent evidence gate from `0.75` to `0.25` in:
  - `src/components/CameraCapture.vue`
  - `scripts/replay_live_ocr_captured.mjs`
  - `scripts/eval_review_suggestion_policy.mjs`
- This only affects likely-read suggestions for already-yellow review answers. It does not auto-correct, auto-grade, clear review, or change the score.

Evidence:

- Report: `private-evidence/reports/nonrow-next-push-20260708/six-from-five-review-gates.json`
- Input replay: `private-evidence/reports/variant-topk-leading-one-review-20260707-full-browser/`
- Truth input: `private-evidence/truth-labels/20260703-flex-duplicate-accepted-needs-label/handwritten-truth-labelled.json`

Result:

- Candidate `5 -> 6` review-only cases without existing suggestions: `9`.
- Old `0.75` gate: `0` suggestions.
- New `0.25` gate with at most one changed slot:
  - `2` suggestions.
  - `2/2` correct.
  - `0` wrong.
  - `2` rescues.
  - Split coverage: `1` validation correct, `1` holdout correct.
  - Family coverage: `1` row correct, `1` non-row correct.

Commands run:

```text
node --check scripts/search_six_from_five_review_gate.mjs
node --check scripts/replay_live_ocr_captured.mjs
node --check scripts/eval_review_suggestion_policy.mjs
node scripts/search_six_from_five_review_gate.mjs
npm run build
```

Decision:

- Keep this as a small review-assist ratchet.
- Do not overstate it: this is not a market-ready OCR breakthrough, and it does not improve automatic coverage.
- It slightly expands the safe review-suggestion set while preserving the auto-lane trust anchor.

Next action:

1. Continue looking for narrow repeated patterns that add correct review suggestions without wrong suggestions.
2. For larger gains, move beyond threshold gates toward non-row crop/preprocessing/model work, especially ten frames, dot collections, number bonds, number patterns, and place value.

## 2026-07-08 Non-Row Variant-Lane Push

Date / thread:
2026-07-08 / SG 3.

What changed:

- Added `scripts/analyze_nonrow_variant_lanes.mjs` and package command `npm run analyze:nonrow-variant-lanes`.
- Added a tiny review-only no-key non-row leading-one suggestion path.
- The new suggestion source is `no-key-non-row-leading-one-review`.
- It only fires on Grade 1 last-week non-row layouts when:
  - the answer is already yellow/review,
  - the left slot currently reads `7`,
  - a preprocessing variant reads that left slot as `1` with confidence at least `0.25`,
  - and all companion slots are stable, not review-needed.
- It does not change score, does not clear review, and does not affect auto-grading.
- Candidate selection now filters unsafe candidates before choosing the best safe suggestion, so a rejected answer-key-context candidate does not prevent a safe no-key candidate from being considered.

Evidence used:

- Latest full browser replay: `private-evidence/reports/variant-topk-leading-one-review-20260707-full-browser/`
- Truth labels: `private-evidence/truth-labels/20260703-flex-duplicate-accepted-needs-label/handwritten-truth-labelled.json`
- Digit rows: `private-evidence/reports/digit-failure-dataset-20260705-current/digit-rows.json`

Results:

- Non-row variant-lane report: `private-evidence/reports/nonrow-variant-lanes-20260708/summary.json`
  - Non-row filled slots: `231/340` current-correct (`67.9%`).
  - Wrong non-row filled slots with correct digit somewhere in variants: `92/109` (`84.4%`).
- Broader replay report: `private-evidence/reports/nonrow-variant-lanes-20260708/current-abc-summary.json`
  - Non-row filled slots: `354/545` current-correct (`65.0%`).
  - Wrong non-row filled slots with correct digit somewhere in variants: `154/191` (`80.6%`).
- Labelled policy evaluator: `private-evidence/reports/review-suggestion-policy-20260708/nonrow-left-seven-one-no-key-stable-companion/summary.json`
  - `83/83` yellow suggestions correct.
  - `0` wrong suggestions.
  - Non-row: `65/65` correct.
- Full browser replay: `private-evidence/reports/nonrow-left-seven-one-stable-companion-20260708-full-browser/truth-score.json`
  - Auto/confident: `205/374`.
  - Auto-correct: `205/205`.
  - Auto-wrong: `0`.
  - Yellow suggestions: `57/57` correct, `0` wrong.
  - Non-row suggestions: `42/42` correct, `0` wrong.
- Combined review-assist: `private-evidence/reports/combined-review-assist-20260708/nonrow-left-seven-one-stable-companion-summary.json`
  - `62/169` yellow answers get a suggestion.
  - `62/62` suggestions correct.
  - `0` wrong.
  - `41` rescues.

Important lesson:

- A slot-level rule can be perfectly safe and still produce a wrong whole-answer suggestion if a companion slot is unstable.
- The no-key `7 -> 1` lane was only kept after adding the stable-companion requirement.
- Larger non-row gains should be trained/evaluated at whole-answer level, not just digit-slot level.

Commands run:

```text
node --check scripts/analyze_nonrow_variant_lanes.mjs
node scripts/analyze_nonrow_variant_lanes.mjs
node scripts/analyze_nonrow_variant_lanes.mjs --replay private-evidence/reports/current-replay-20260704-general-policy-inkw6-a --replay private-evidence/reports/current-replay-20260704-general-policy-inkw6-b --replay private-evidence/reports/current-replay-20260704-general-policy-inkw6-c --out private-evidence/reports/nonrow-variant-lanes-20260708/current-abc-summary.json
node --check scripts/eval_review_suggestion_policy.mjs
node --check scripts/replay_live_ocr_captured.mjs
node scripts/eval_review_suggestion_policy.mjs --out private-evidence/reports/review-suggestion-policy-20260708/nonrow-left-seven-one-no-key-stable-companion/summary.json
npm run build
node scripts/replay_live_ocr_captured.mjs --url https://localhost:5174 --out-dir private-evidence/reports/nonrow-left-seven-one-stable-companion-20260708-full-browser private-evidence/debug-scans/2026-07-02
node scripts/score_replay_against_handwritten_truth.mjs --out private-evidence/reports/nonrow-left-seven-one-stable-companion-20260708-full-browser/truth-score.json private-evidence/reports/nonrow-left-seven-one-stable-companion-20260708-full-browser
node scripts/eval_combined_review_assist.mjs --replay private-evidence/reports/nonrow-left-seven-one-stable-companion-20260708-full-browser --out private-evidence/reports/combined-review-assist-20260708/nonrow-left-seven-one-stable-companion-summary.json
```

Files changed:

- `src/components/CameraCapture.vue`
- `scripts/replay_live_ocr_captured.mjs`
- `scripts/eval_review_suggestion_policy.mjs`
- `scripts/analyze_nonrow_variant_lanes.mjs`
- `package.json`
- `docs/SCANGRADE_ACCURACY_ROADMAP_20260705.md`
- `SCANGRADE_ACTIVE_HANDOFF.md`

Next action:

1. Continue non-row selector work at whole-answer level.
2. Mine the `84%` variant-opportunity cases for a learned selector, but require zero wrong on validation/holdout and whole-answer scoring.
3. Do not broaden no-key slot corrections unless companion-slot stability and whole-answer truth checks hold.

## 2026-07-08 Combined Review-Assist Benchmark Includes Six-Five Stream

After the `5 -> 6` review-only gate was validated and implemented, the combined review-assist evaluator was updated so the headline review-assist metric includes all current safe suggestion streams.

What changed:

- Extended `scripts/eval_combined_review_assist.mjs` to consume:
  - built-in replay `reviewSuggestion`s,
  - blank/artifact replay-simulation suggestions,
  - `six-from-five` gate suggestions from `private-evidence/reports/nonrow-next-push-20260708/six-from-five-review-gates.json`.
- Suggestion priority is built-in first, blank/artifact second, six-five third.
- The evaluator reports source-specific and combined coverage and detects conflicts between sources.
- No app OCR/capture/homography/scoring behavior changed in this step.

Commands run:

```text
node --check scripts/eval_combined_review_assist.mjs
npm run eval:combined-review-assist
npm run build
node --check scripts/eval_blank_artifact_classifier.mjs
node --check scripts/search_six_from_five_review_gate.mjs
```

Updated combined-review result:

- Baseline:
  - Matched groups: `374`.
  - Auto/confident: `205/374`.
  - Auto-correct: `205/205`.
  - Auto-wrong: `0`.
  - Yellow/manual review: `169`.
- Built-in suggestions: `56/56` correct, `0` wrong, `35` rescues.
- Blank/artifact suggestions: `3/3` correct, `0` wrong, `3` rescues.
- Six-five suggestions: `2/2` correct, `0` wrong, `2` rescues.
- Combined:
  - `61/169` yellow answers get a suggestion.
  - `61/61` suggestions correct.
  - `0` wrong suggestions.
  - `40` rescues.
  - `0` harmed current-correct yellow reads.
  - `0` conflicts between sources.

Decision:

- This is the current review-assisted benchmark: auto-safe coverage remains `205/374`, while review-assisted yellow coverage is now `61/169`.
- Treat this as teacher-review workflow improvement, not automatic OCR coverage improvement.

Next action:

1. Continue searching for narrow, evidence-backed review suggestion gates only if they preserve `0` wrong suggestions on validation/holdout.
2. Start a deeper non-row crop/preprocessing/model track for larger gains; suggestion gates alone will not reach market-ready coverage.

## 2026-07-08 Whole-Answer Non-Row Selector Diagnostic

The next deeper non-row push added an answer-level diagnostic so future work does not overfit slot-level wins that break when the companion slot is wrong.

New analyzer:

- Script: `scripts/analyze_nonrow_whole_answer_variants.mjs`
- Command: `npm run analyze:nonrow-whole-answer-variants`
- Main report: `private-evidence/reports/nonrow-whole-answer-variants-20260708/summary.json`
- Blank-candidate/pattern report: `private-evidence/reports/nonrow-whole-answer-variants-20260708/with-pattern-scores-summary.json`

Commands run:

```text
node --check scripts/analyze_nonrow_whole_answer_variants.mjs
npm run analyze:nonrow-whole-answer-variants
node scripts/analyze_nonrow_whole_answer_variants.mjs --out private-evidence/reports/nonrow-whole-answer-variants-20260708/with-review-blank-candidates-summary.json
node scripts/analyze_nonrow_whole_answer_variants.mjs --out private-evidence/reports/nonrow-whole-answer-variants-20260708/with-pattern-scores-summary.json
```

Main findings:

- Latest replay matched `374` labelled groups.
- Non-row yellow/review groups: `119`.
- Non-row yellow current lean correct: `18/119`.
- Non-row yellow current lean wrong: `101/119`.
- Whole-answer digit-swap oracle: `79/119` non-row yellow answers had the handwritten truth somewhere in candidate variants.
- Whole-answer oracle with analysis-only review-slot blank candidates: `86/119`.
- By layout with blank candidates:
  - `sg-g1-lw-07-dot-collections`: `21/27` candidate-oracle coverage.
  - `sg-g1-lw-06-ten-frames`: `19/29`.
  - `sg-g1-lw-08-number-bonds`: `19/27`.
  - `sg-g1-lw-09-number-patterns`: `15/23`.
  - `sg-g1-lw-10-place-value-50`: `12/13`.

Safety result:

- The analyzer searched `1,454,400` whole-answer rule variants.
- The only full-corpus zero-wrong rule family with coverage in calibration, validation, and holdout was still `left:7>1`, matching the already-implemented no-key review-only lane.
- Analysis-only blanking improved oracle coverage, especially ten-frames, but did not yield a deployable hard-coded rule:
  - Example: `right:1>null` on ten-frames was `4` correct and `2` wrong overall, with both wrongs in holdout.
  - No zero-wrong pattern had support in both validation and holdout.

Decision:

- Do not implement a new non-row hard-coded gate from this pass.
- The next meaningful non-row improvement should be a learned answer-level selector or stronger visual blank/artifact classifier, validated on held-out packets.
- Keep auto lane unchanged: no score/auto-confidence changes from this diagnostic.

## 2026-07-08 Learned Selector + Visual Blank Gate Push

Goal:

- Try the next deeper non-row step: a learned answer-level selector and/or a stronger visual blank/artifact classifier.
- Keep this analysis-only unless it preserves held-out safety. Do not use answer key as OCR truth and do not loosen auto-grading.

New/updated tools:

- `scripts/analyze_nonrow_whole_answer_variants.mjs`
  - Added `--candidates-out` and reusable answer-candidate export.
  - Candidate rows written to `private-evidence/reports/nonrow-whole-answer-variants-20260708/candidate-rows.json`.
- `scripts/eval_learned_answer_selector.mjs`
  - npm: `npm run eval:learned-answer-selector`
  - Analysis-only logistic answer selector over exported whole-answer candidates.
- `scripts/analyze_visual_blank_candidate_gate.mjs`
  - npm: `npm run analyze:visual-blank-candidate-gate`
  - Analysis-only bridge between whole-answer blank candidates and visual blank/artifact slot scores.

Commands run:

```text
node --check scripts/analyze_nonrow_whole_answer_variants.mjs
node scripts/analyze_nonrow_whole_answer_variants.mjs --out private-evidence/reports/nonrow-whole-answer-variants-20260708/selector-export-summary.json --candidates-out private-evidence/reports/nonrow-whole-answer-variants-20260708/candidate-rows.json
node --check scripts/eval_learned_answer_selector.mjs
npm run eval:learned-answer-selector
node scripts/eval_learned_answer_selector.mjs --out private-evidence/reports/learned-answer-selector-20260708/no-truth-leak-threshold-summary.json
node scripts/eval_learned_answer_selector.mjs --train-splits calibration,validation --safety-splits calibration,validation --out private-evidence/reports/learned-answer-selector-20260708/train-calibration-validation-holdout-test-summary.json
node scripts/eval_learned_answer_selector.mjs --train-splits calibration,validation --safety-splits calibration,validation --max-changed-slots 1 --out private-evidence/reports/learned-answer-selector-20260708/train-calibration-validation-max1-holdout-test-summary.json
node --check scripts/analyze_visual_blank_candidate_gate.mjs
npm run analyze:visual-blank-candidate-gate
node scripts/analyze_visual_blank_candidate_gate.mjs --max-changed-slots 2 --out private-evidence/reports/visual-blank-candidate-gate-20260708/max2-summary.json
```

Learned answer-level selector findings:

- First implementation accidentally included a truth-derived `currentCorrect` feature; this was removed before evaluating the usable result.
- No-truth-leak selector trained on calibration only was too conservative to matter:
  - selected `1` full-corpus answer, `1/1` correct, `0` wrong.
- Training on calibration+validation looked attractive in-sample but failed holdout:
  - `14/14` correct on calibration+validation at the selected zero-wrong safety threshold.
  - Holdout: `1` selected, `0` correct, `1` wrong.
  - Full: `15` selected, `14` correct, `1` wrong.
- One-slot-only learned selector also failed holdout:
  - Calibration+validation: `17/17` correct.
  - Holdout: `2` selected, `0` correct, `2` wrong.
  - Full: `19` selected, `17` correct, `2` wrong.
- Failure pattern:
  - The learned selector overfits plausible variant patterns like `left:9>1`.
  - Those patterns are sometimes real rescues, but held-out student work includes cases where they create confident wrong answer suggestions.

Visual blank/artifact gate findings:

- Existing visual-only blank replay remains safe but tiny:
  - Matched groups: `374`.
  - Baseline auto/confident: `205/374`, `205/205` correct, `0` wrong.
  - Visual blank suggestions: `3/3` correct, `0` wrong, `3` rescues.
- New whole-answer visual blank candidate analyzer:
  - One-slot blank-only candidates: `100`.
  - Correct blank candidates available: `5`; wrong blank candidates: `95`.
  - Best zero-wrong threshold: `2/2` correct, `0` wrong, `2` rescues.
  - Both safe rescues are validation-only ten-frame cases; no holdout support.
- Two-slot / blank-plus-rewrite candidates are unsafe:
  - `715` blank-like candidates.
  - Correct: `10`; wrong: `705`.
  - No zero-wrong threshold exists.
  - At low thresholds the analyzer immediately selects wrong candidates because the blank evidence can be strong while the companion digit rewrite is wrong.

Decision:

- Do not ship the learned answer-level selector.
- Do not broaden visual blanking beyond the current very conservative review-assist behavior.
- Keep these tools as diagnostics for the future OCR/model track.
- The next meaningful product improvement is not another hand-coded gate; it is stronger digit recognition and/or crop normalization for non-row sheets, validated against the same calibration/validation/holdout split.

## 2026-07-08 Trusted OCR Suggestion Promotion Patch

Goal:

- Improve non-row confidence without using answer-key-only context as OCR truth.
- Preserve the current hard safety line: no confidently wrong reads in the accepted/truth-labeled replay set.

Code changes:

- `src/components/CameraCapture.vue`
  - Added `trustedOcrSuggestionPromotionEvidence()` and `applyTrustedOcrSuggestionPromotions()`.
  - Wired the promotion pass into the live grading pipeline after conservative blank/context review helpers.
- `scripts/replay_live_ocr_captured.mjs`
  - Added matching replay implementation and console/debug output for `trustedOcrSuggestionPromotions`.
- `src/App.vue`
  - Bumped visible build label to `2026.07.08-0935-EDT-sg3-trusted-ocr-suggestions`.

Promotion rule:

- Only promotes `ocr-alternative-review` suggestions.
- Refuses `answer-key-context-review` and `no-key-non-row-leading-one-review`.
- Requires suggestion confidence `>= 0.85`.
- Requires each changed digit slot to have non-answer-key evidence at `>= 0.85` from the current read, model top-k, variant read, or variant top-k.
- Requires unchanged digit slots to have non-answer-key evidence at `>= 0.75`.
- Requires blank/optional slot evidence at `>= 0.72`.
- Marks promoted predictions with `robustOverride: trusted-ocr-suggestion`, `confidencePolicyClearanceReason: trusted-ocr-suggestion`, and `trustedSuggestionPromotion` audit metadata.

Verification:

```text
node --check scripts/replay_live_ocr_captured.mjs
npm run build
node scripts/replay_live_ocr_captured.mjs --allow-imperfect --url https://127.0.0.1:5174 --out-dir private-evidence/reports/trusted-ocr-suggestion-promotion-20260708-full-browser private-evidence/debug-scans/2026-07-02
node scripts/score_replay_against_handwritten_truth.mjs --out private-evidence/reports/trusted-ocr-suggestion-promotion-20260708-full-browser/truth-score.json private-evidence/reports/trusted-ocr-suggestion-promotion-20260708-full-browser
```

Replay/truth result:

- Matched handwritten-truth groups: `374`.
- Auto/confident before this patch: `205/374`, `205/205` correct, `0` wrong.
- Auto/confident after this patch: `225/374`, `225/225` correct, `0` wrong.
- Yellow/review groups dropped from `169` to `149`.
- Row auto/confident after patch: `134/176` (`76.1%`), `0` wrong.
- Non-row auto/confident after patch: `91/198` (`46.0%`), `0` wrong.
- Non-row improved from `79/198` (`39.9%`) to `91/198` (`46.0%`).
- Remaining weak non-row families: ten frames, dot collections, number bonds, number patterns.

Decision:

- This is safe to carry forward as a narrow reliability improvement.
- It is not enough to make ScanGrade market-ready by itself.
- Next best work: improve digit/crop/model normalization so answer-box position no longer changes recognition quality, with held-out packet validation before any broader confidence expansion.

## 2026-07-08 OCR Selector Normalization Follow-Up

Goal:

- Continue the non-row reliability push for ten frames, dot collections, number bonds, and number patterns.
- Prefer general OCR/model evidence over answer-key/context rescue.
- Keep the hard launch-trust line: `0` confidently wrong OCR reads against handwritten truth.

What changed:

- Relaxed the trusted OCR-only promotion gate in both live and replay:
  - `src/components/CameraCapture.vue`
  - `scripts/replay_live_ocr_captured.mjs`
- The gate still only promotes `ocr-alternative-review`.
- It still refuses answer-key-context suggestions and no-key non-row leading-one suggestions.
- New thresholds:
  - suggestion confidence `>= 0.75` instead of `>= 0.85`
  - changed-slot non-answer-key evidence `>= 0.79` instead of `>= 0.85`
  - unchanged-slot evidence `>= 0.65` instead of `>= 0.75`
  - blank/optional slot evidence remains `>= 0.72`
- Updated visible build label to `2026.07.08-1048-EDT-sg3-ocr-selector-normalization`.

Verification:

```text
node --check scripts/replay_live_ocr_captured.mjs
npm run build
node scripts/replay_live_ocr_captured.mjs --allow-imperfect --url https://127.0.0.1:5174 --out-dir private-evidence/reports/nonrow-normalization-20260708/ocr-promotion-relaxed-full-browser private-evidence/debug-scans/2026-07-02
node scripts/score_replay_against_handwritten_truth.mjs --out private-evidence/reports/nonrow-normalization-20260708/ocr-promotion-relaxed-full-browser/truth-score.json private-evidence/reports/nonrow-normalization-20260708/ocr-promotion-relaxed-full-browser
```

Result vs previous trusted-promotion build:

- Matched handwritten-truth groups: `374`.
- Auto/confident improved from `225/374` to `233/374`.
- Confident OCR accuracy stayed `233/233`, `0` wrong.
- Yellow/review groups dropped from `149` to `141`.
- Row auto/confident improved from `134/176` to `136/176`.
- Non-row auto/confident improved from `91/198` to `97/198`.
- Non-row confident accuracy stayed `97/97`, `0` wrong.

Rejected experiments:

- Optional-blank gate relaxation:
  - Tested `suggestion >= 0.45` and optional blank evidence `>= 0.28`.
  - Result: `234/374` auto, `0` wrong, but the only gain was one row-sheet read; non-row stayed `97/198`.
  - Reverted because it added looseness without solving the target problem.
- Enabling the existing legacy preprocess consensus selector:
  - Result: `232/374` auto, `230/232` correct, `2` confidently wrong.
  - Non-row became `98/198` auto but with `2` confident wrong reads.
  - Reverted. The consensus selector is too eager for current non-row crops.

Interpretation:

- The right digit is often present in OCR variant evidence, but broad consensus can still choose the wrong digit confidently on visual-layout pages.
- The safest current improvement is answer-level OCR-only promotion with conservative thresholds.
- The remaining non-row gap is not primarily a confidence-policy problem. It needs better crop/model normalization or a learned selector trained and validated on held-out handwritten truth before promotion can be broadened.

## 2026-07-08 Learned Selector And Crop Normalization Trial

Goal:

- Try both next candidates Tony asked for:
  1. better crop/tensor normalization for non-row digit crops;
  2. a learned answer-level selector trained/evaluated against held-out handwritten truth.
- Keep `0` confidently wrong OCR reads as the non-negotiable promotion gate.

Evidence used:

- Latest accepted replay baseline:
  - `private-evidence/reports/nonrow-normalization-20260708/ocr-promotion-relaxed-full-browser`
  - `private-evidence/reports/nonrow-normalization-20260708/ocr-promotion-relaxed-full-browser/truth-score.json`
- Handwritten-truth labels under:
  - `private-evidence/truth-labels/20260703-flex-duplicate-accepted-needs-label/handwritten-truth-labelled.json`
- Saved classroom debug scans under:
  - `private-evidence/debug-scans/2026-07-02`

Commands run:

```text
node scripts/analyze_nonrow_whole_answer_variants.mjs --replay private-evidence/reports/nonrow-normalization-20260708/ocr-promotion-relaxed-full-browser --out private-evidence/reports/nonrow-normalization-20260708/learned-selector-input/whole-answer-summary.json --candidates-out private-evidence/reports/nonrow-normalization-20260708/learned-selector-input/candidate-rows.json
node scripts/eval_learned_answer_selector.mjs --candidates private-evidence/reports/nonrow-normalization-20260708/learned-selector-input/candidate-rows.json --out private-evidence/reports/nonrow-normalization-20260708/learned-selector-calibration/summary.json
node scripts/eval_learned_answer_selector.mjs --candidates private-evidence/reports/nonrow-normalization-20260708/learned-selector-input/candidate-rows.json --out private-evidence/reports/nonrow-normalization-20260708/learned-selector-cal-val/summary.json --train-splits calibration,validation --safety-splits calibration,validation
node scripts/eval_learned_answer_selector.mjs --candidates private-evidence/reports/nonrow-normalization-20260708/learned-selector-input/candidate-rows.json --out private-evidence/reports/nonrow-normalization-20260708/learned-selector-one-slot/summary.json --max-changed-slots 1
node scripts/eval_learned_answer_selector.mjs --candidates private-evidence/reports/nonrow-normalization-20260708/learned-selector-input/candidate-rows.json --out private-evidence/reports/nonrow-normalization-20260708/learned-selector-no-blank/summary.json --exclude-blank-candidates
npm run build
node scripts/replay_live_ocr_captured.mjs --allow-imperfect --url https://127.0.0.1:5174 --out-dir private-evidence/reports/nonrow-normalization-20260708/ink-tight-slot-full-browser private-evidence/debug-scans/2026-07-02
node scripts/score_replay_against_handwritten_truth.mjs --out private-evidence/reports/nonrow-normalization-20260708/ink-tight-slot-full-browser/truth-score.json private-evidence/reports/nonrow-normalization-20260708/ink-tight-slot-full-browser
npm run build
```

Results:

- Whole-answer candidate oracle on the latest baseline:
  - Non-row yellow/review groups: `101`.
  - Correct handwritten answer appears somewhere in candidate variants for `79/101` (`78.2%`).
  - This confirms the signal is often present, but selection is the hard part.
- Learned selector trials:
  - Calibration-only training with safety threshold selected `2/101`, all calibration examples, `0` validation/holdout benefit.
  - Calibration+validation training selected `9/101`, `8` correct and `1` holdout wrong. Rejected.
  - One-slot-only selector selected `3/101`, `1` correct and `2` holdout wrong. Rejected.
  - No-blank selector selected `4/101`, all calibration examples, `0` validation/holdout benefit.
- Crop/tensor normalization trial:
  - Temporarily added an `ink-tight-slot` tensor variant with stricter centering/scaling for virtual digit boxes.
  - Browser replay result: `226/374` auto, `226/226` correct, `0` wrong.
  - Non-row result: `95/198` auto, `95/95` correct, `0` wrong.
  - This is worse than the accepted baseline (`233/374` overall, `97/198` non-row), so the patch was reverted.

Files changed:

- No lasting source changes from this trial.
- Private analysis outputs were written under `private-evidence/reports/nonrow-normalization-20260708/`.

Decision:

- Do not ship the current learned selector. It overfits or helps only calibration examples.
- Do not ship the `ink-tight-slot` normalization. It reduced coverage.
- The next promising technical direction is a stronger visual quality/blank/artifact/digit-shape feature extractor trained at slot level, then consumed by an answer-level selector, with holdout packet validation. A global crop-threshold tweak is too blunt.

Open risks:

- `79/101` candidate-oracle opportunity means there is a large potential gain, but the current feature set does not distinguish truth from plausible wrong alternates reliably enough.
- The strongest failed selector examples show why whole-answer holdout is essential: confident-looking slot changes can produce a wrong complete answer on ten-frame and place-value pages.

## 2026-07-09 Fidelity Isolation And Whole-Answer Review Lane

Full report:

- `docs/SCANGRADE_ACCURACY_EXPERIMENTS_AND_IMPLEMENTATION_20260709.md`

Key results:

- Expanded context digit crops were isolated in a true second preprocessing pass.
- With the experiment on versus off, primary OCR decisions were identical on all 86 pages.
- Baseline remained `323/323` correct automatic answers on the 582-answer truth corpus.
- Context crops were rejected as a product suggestion path: they added five correct answer-key-constrained suggestions but also suggested key `14` for handwritten `16`.
- The adapted, key-blind whole-answer model remains the best complementary lane:
  - validation `105/136` exact;
  - page-block holdout `92/114` exact;
  - at the final review threshold (`minTokenProbability >= 0.98`), `20/22` displayed model disagreements were correct.

Implemented, opt-in only:

- `scripts/serve_trocr_review.py`: optional local/server whole-answer recognizer; rejects answer-key fields.
- `?reviewModelUrl=...`: sends only yellow crops, 2.5-second timeout, no impact on automatic grading, current OCR retained as first teacher choice.
- `?strictPerspectiveCapture=1`: stricter overhead geometry for automatic capture only; manual fallback and default capture behavior unchanged.

Verification:

- production build passes;
- Python service compiles and ran end to end;
- warm batch of eight held-out yellow crops: 922 ms wall time, 7/8 correct;
- answer-key request rejection confirmed;
- built app loaded without browser errors.

Retrospective review A/B simulation:

- 20-packet validation block: correct choice availability improved `25/60 -> 34/60`, with `0` paired losses.
- Untouched holdout block: `13/40 -> 22/40`, with `0` paired losses.
- Combined: `38/100 -> 56/100`; 18 additional yellow answers had the correct transcription available as a tap choice.
- The UI now preserves up to three distinct choices (current OCR first, key-blind whole-answer alternative, and existing suggestion), preventing the new lane from displacing a correct control choice.
- Evidence: `private-evidence/reports/review-lane-ab-simulation-20260709.json`.

Next gate:

- Run a randomized review-time test on at least 20 unseen packets. Promote the review lane only if median review time falls at least 25% with no increase in wrong final transcriptions.
- Do not make the Mac mini, a free cloud tier, or the whole-answer model necessary for core grading completion.

## 2026-07-13 Pre-capture exhaustive fidelity tightening

Full report:

- `docs/SCANGRADE_PRECAPTURE_EXHAUSTIVE_TIGHTENING_20260713.md`

Fresh 374-answer replay baseline:

- `233/374` automatic (`62.3%`), `233/233` matched handwritten truth, zero known confident transcription errors.
- Row coverage `136/176`; non-row `97/198`.

New conclusions:

- Four stronger/local answer-frame registration policies were all worse and introduced `1-4` confident errors. Keep the current conservative registration.
- Blur alone is not the main loss. Perspective/sideways distortion and uneven lighting correlate more strongly with errors.
- Aggressive autocontrast/sharpening reduced whole-answer exact accuracy from `78.8%` to `70.0%`.
- Raw gray crops retain modestly more learnable information than final black 28x28 inputs, but a small raw-crop CNN is not strong enough to replace production OCR.
- The key-blind whole-answer model remains the best complementary lane. It raised correct-choice availability from `38/100` to `56/100` yellow answers; holdout `13/40 -> 22/40`.
- Even highly confident whole-answer disagreements can be wrong on authentic incorrect math. Keep the model suggestion/review-only pending new-packet shadow evidence.
- A local CPU service was restored: 20 crops in about 3.1 seconds wall time. It is feasible as an optional development/fallback lane, not a core availability dependency.
- Absolute capture-quality gates shifted too much across packet blocks. Do not ship a retake threshold yet; log geometry/light metrics on the new captures.

Experiment harness additions (opt-in, default app unchanged):

- `SG_FRAME_REGISTRATION_MODE` in `scripts/replay_live_ocr_captured.mjs`.
- `scripts/analyze_whole_answer_promotion.mjs`.
- `scripts/simulate_capture_retake_gate.mjs`.
- `requirements-trocr-review.txt` now includes the required `torchvision` version.

Before new packet capture:

- Keep packets intact and retain student/packet grouping.
- Reserve at least two complete packets as untouched holdout; do not select based on handwriting neatness.
- Use even diffuse light and keep the device parallel to the page; do not apply camera/image enhancement.
- Verify one non-holdout debug capture before bulk scanning.
- Do not push/deploy any experiment from this review without a separate decision.

## 2026-07-13 Hybrid V2 parallel build

Hybrid V2 now exists as an opt-in path alongside the unchanged control. It is not deployed or enabled by default.

Implemented:

- Opt-in capture preservation of the best three frames from the existing eight-frame automatic burst.
- Independent current digit OCR plus a key-blind whole-answer service on yellow answers.
- Exact cross-frame consensus recorded in shadow mode; it cannot automatically promote a yellow answer.
- Current browser OCR remains the first teacher choice; the service can only add a review choice.
- One-tap review records the choice source and review duration and advances to the next yellow answer.
- Mission Control privately stores burst evidence and includes its count in scan summaries.
- Portable container boundary for the whole-answer service. The private adapter and student evidence are excluded.
- Reproducible four-packet assignment tool and prospective capture protocol: three development packets, one locked test, eight unscanned reserves.

Verification:

- Control replay remains exactly `233/374` automatic and `233/233` correct, with `141` yellow answers.
- Unit tests cover key normalization, consensus safety, no single-model promotion, control priority, and packet assignment.
- Production build, Mission Control syntax check, and `git diff --check` pass.
- Service smoke test returned frame-indexed results, rejected an answer-key request with HTTP 400, and emitted the configured allowed-origin header.
- Privacy recheck after hardening: a disallowed origin receives HTTP 403 before image processing; an allowed-origin answer-key request receives HTTP 400; responses are `no-store`; a permitted local crop returned a frame-indexed key-blind result in 292 ms inference time.
- Hybrid burst memory is bounded to the best three canvases rather than all eight. On 115 saved 1440x1864 captures, three JPEG/base64 frames are estimated at 1.84 MB median and three raw RGBA canvases at 32.2 MB before browser/GPU overhead. Old-device measurement remains prospective.
- Saved single-frame review evidence improves correct one-tap choice availability `38/100 -> 56/100`; untouched block `13/40 -> 22/40`, with no paired losses.
- Correlated pseudo-frame simulations produce 13-14 shadow-eligible correct reads in 100 yellow answers and zero observed errors, but are not evidence for promotion.

Files:

- `src/hybrid-recognition.js`
- `tests/hybrid-recognition.test.mjs`
- `scripts/compare_control_hybrid_v2.mjs`
- `scripts/analyze_pseudo_frame_consensus.mjs`
- `scripts/create_four_packet_capture_plan.mjs`
- `docs/SCANGRADE_HYBRID_V2_ARCHITECTURE.md`
- `docs/SCANGRADE_FOUR_PACKET_CAPTURE_PROTOCOL.md`
- `Dockerfile.review`

Private reports:

- `private-evidence/reports/hybrid-v2-control-check-20260713/truth-score.json`
- `private-evidence/reports/control-vs-hybrid-v2-20260713.json`
- `private-evidence/reports/pseudo-frame-consensus-20260713.json`
- `private-evidence/reports/hybrid-capture-payload-20260713.json`

Prospective gate:

- Label the physical packets `P01-P12` without inspecting handwriting, then run `npm run plan:four-packet-capture -- --out private-evidence/capture-plans/four-packet-plan.json`.
- Scan only the assigned four intact packets. Freeze on the three development packets and open the locked packet once.
- Do not enable automatic hybrid promotion from this corpus alone. First decide whether the review assistant improves correct-choice availability/review time without increasing final transcription errors.
- The in-app browser test surface failed to attach during the final local UI check. This was a browser-tool attachment failure, not an observed ScanGrade runtime failure; rerun the interactive camera/review smoke test before handing the capture URL to Tony.

Prospective assignment was frozen privately before handwriting inspection:

- `P08`: development 1
- `P03`: development 2
- `P09`: development 3
- `P02`: locked test
- Keep `P01`, `P04-P07`, and `P10-P12` unscanned.
- Source: `private-evidence/capture-plans/four-packet-plan.json`.

Private runtime prepared on 2026-07-13:

- Hybrid app is running on local port `5174`; the existing tailnet root proxy was repaired to use the Vite HTTPS endpoint and returned HTTP 200.
- Offline key-blind recognizer is running on `127.0.0.1:8766`, exposed tailnet-only at `/review-model`; prefixed health returned HTTP 200 with the configured origin and `no-store`.
- Mission Control debug receiver is running on `127.0.0.1:8787`, exposed at `/mission-control` with a dedicated capture token kept out of repository documentation.
- The complete private capture URL returned HTTP 200. Processes are development sessions, not durable production services; verify all three health paths immediately before physical scanning.

Prospective evaluation hardening completed after the runtime was prepared:

- Capture URLs now record `packetId`, `captureRole`, capture-plan seed, and a stable scan-session ID.
- Each one-tap/manual correction sends a lightweight cumulative telemetry update with choice source and duration; images are not re-uploaded.
- Accepted scans now carry bounded camera-gate telemetry: attempts, rejection reasons, elapsed capture time, and no additional images. This separates capture friction from OCR/model failures without changing the gate.
- Mission Control persists and summarizes the new identity fields.
- `scripts/create_hybrid_truth_template.mjs` creates key-free development labels only after scans exist.
- `scripts/evaluate_hybrid_v2_packets.mjs` keeps transcription/math/review separate, groups correction versions, reports capture failures, excludes locked data by default, rejects duplicate successful pages, and requires two distinct labelers.
- `scripts/freeze_hybrid_v2_policy.mjs` hashes code, models, layouts, evaluator, and packet plan. Locked scoring refuses to run after drift.
- Synthetic evaluator, duplicate-rejection, truth-integrity, correction-version joining, and live metadata-storage checks pass. Hybrid test suite now has 15 passing tests.

## 2026-07-13 P08 prospective capture and confidence audit

Tony captured all ten pages of intact development packet `P08`. The intake contains ten unique scan-session IDs and ten layouts; paired debug records are pipeline stages, not accidental rescans. All ten camera captures passed on the first attempt and retained three of eight burst frames. Nine pages completed live V3 shadow processing; page 10 retained complete source evidence and was reconstructed by saved-frame replay after the browser was left before its asynchronous upload finished.

Primary handwritten-truth transcription was created from the warped page images for all 70 answers. It remains provisional until a second person checks every answer against the physical pages. The math answer key was not used as transcription truth; one visibly written incorrect math answer (`16` where the key says `15`) remains labelled `16`.

Provisional P08 control result:

- V2 automatic: `42/70` (`60.0%`), with `42/42` matching primary handwritten truth and zero observed confident errors.
- V2 all-answer transcription: `44/70`.
- A correct read appeared among the three V3 reader outputs for `65/70` (`92.9%`), indicating that selection/abstention is the main bottleneck on this packet.

A TrOCR confidence defect was found and fixed: EOS/control-token probability had been included in answer confidence, sometimes reducing a correct stable digit to zero confidence. The service now measures only tokens contributing visible digits and separately reports generation confidence. Two Python regression tests and ten V3 policy/shadow tests pass. Production promotion behavior remains conservative and V3 remains opt-in shadow.

The canonical post-fix three-frame replay completed `10/10` pages with both whole-answer models available. Because a full page rerun changed geometry enough to change 16 of 70 reader outputs, the overall live-versus-replay delta is not attributed solely to the confidence fix. All nine post-fix current-policy accepts occurred among the 54 answers whose three reader reads were unchanged, and all nine matched provisional truth.

A research-only fallback rule—large and compact readers agree against slot OCR, with identical large-model output on all three frames—would add ten correct answers over the V2 automatic set on this replay. That produces `52/70` (`74.3%`) V2-plus-fallback coverage with zero observed confident errors on provisional P08 truth. This rule is **not promoted**: P08 needs independent truth verification, and the rule must survive intact P03 and P09 before the locked P02 run.

Private evidence:

- `private-evidence/hybrid-v2-prospective/handwritten-truth-development.json`
- `private-evidence/reports/v3-prospective-p08-primary-provisional.json`
- `private-evidence/reports/v3-p08-visible-token-confidence-replay-canonical/`
- `private-evidence/reports/v3-p08-visible-token-confidence-comparison-primary-provisional.json`

Next physical packet: scan intact `P03` as development packet 2. Then scan intact `P09`, freeze the policy, and only then open locked `P02`. The actual inventory is nine packets, so unscanned reserves are `P01`, `P04`, `P05`, `P06`, and `P07`.

## 2026-07-13 P08 non-row parity candidate

Tony requested a dedicated goal to bring non-row recognition to row parity before scanning P03/P09. P08 crop tracing found a material fidelity defect in the V3 path: the original camera capture contained clear handwriting, but the ordinary warped image used for continuous zones contained white slot-cleanup masks over portions of the handwriting. V2 remains unchanged; the repair re-warps a fresh copy of the untouched camera image using the page anchors already detected by V2, then sends the continuous grayscale zone to the key-blind adapted large reader.

Rejected variants:

- Layout-only zone anchoring corrected one diagonal-line miss but worsened other number-bond crops/reads.
- Aggressive answer-frame and divider erasure removed useful strokes/context and worsened both learned readers.

Frozen research rule:

- Only consider answers already routed to V2 review.
- Use the adapted key-blind large-model read from the fresh continuous zone.
- Require the identical read on all three retained real frames, no tie, and minimum visible-token confidence `>= 0.70`.
- Compact agreement is not required for this candidate; it remains recorded as advisory evidence.

P08 primary-label-only result:

- Row: V2 `27/40` automatic; frozen fallback `32/40` (`80.0%`), zero observed errors.
- Non-row: V2 `15/30` automatic; frozen fallback `26/30` (`86.7%`), zero observed errors.
- Overall: V2 `42/70` (`60.0%`); frozen fallback `58/70` (`82.9%`), zero observed errors.
- Large fresh-zone reader alone matched primary truth on `59/70`: row `35/40`, non-row `24/30`.
- The visibly incorrect student math answer remains transcribed as written and remains review; the key was not used as handwriting truth.

This reaches the P08 non-row parity target but is not production evidence. P08 labels require a second human check, and three frames are correlated evidence from one student. The exact 59-file code/model/layout/config manifest is frozen and verifies cleanly at:

- `private-evidence/v3-prospective/nonrow-parity-policy-freeze-p08.json`
- Candidate definition: `private-evidence/v3-prospective/nonrow-parity-policy-candidate.json`
- Score: `private-evidence/reports/v3-p08-fresh-zone-parity-primary-provisional.json`

Do not tune further on P03/P09. Capture intact P03 next, score it once against the frozen rule, then capture/score intact P09. Do not open P02 unless the frozen candidate survives both prospective development packets without a confident transcription error or a major coverage collapse.

## 2026-07-13 prospective evaluator freeze

Before any P03 upload existed, the one-shot P03/P09 evaluator was implemented, tested, and separately frozen. It verifies the unchanged P08 main freeze before reading scans; requires the assigned packet identity/role/seed, exactly one successful session for each of the ten expected layouts, three retained frames, complete V3 evidence, and handwritten truth that is distinct from the math key. It applies exactly the frozen V2-review-only, large-reader 3-of-3, no-tie, minimum-confidence-0.70 rule. Teacher corrections are rejected as contamination and never used. Output is write-once (`wx`).

Promotion gates are: independently verified truth, valid packet integrity, all 10 pages/70 answers, zero frozen automatic errors, zero fallback-promotion errors, non-row coverage at least 82.5%, and non-row coverage no more than five percentage points below row coverage. Primary-only labels can be scored only as provisional and cannot pass promotion.

Artifacts:

- Evaluator: `scripts/evaluate_v3_frozen_prospective.mjs`
- Protocol: `private-evidence/v3-prospective/prospective-evaluator-protocol.json`
- Protocol freeze: `private-evidence/v3-prospective/prospective-evaluator-freeze.json`
- Protocol-freeze SHA-256: `4650963d4adf3565d62acff44637c8c886c222381b49b3d7ce6c526d428038eb`
- Main-freeze SHA-256: `36e9f34bd3a20d81cb9eec9f8ad433810fafdc479144d5c601b500b3eccbdc89`
- Tests: `tests/v3-frozen-prospective.test.mjs` (3 passing)

Do not modify any file covered by either freeze before P03 and P09 are scored. As of the freeze, no P03 debug upload was present.

## 2026-07-13 complete historical fresh-image stress test

All 86 available historical original page captures were reprocessed through the new untouched-camera re-warp, fresh continuous-zone extraction, adapted large reader, and compact reader. The run completed with zero page failures and joined exactly 582/582 handwritten-truth entries. This is broad retrospective R&D evidence, not a prospective result: most pages have only one retained image, the corpus influenced development, and 276 labels are weaker `seeded-auto-correct` labels. Results on the 302 manually labelled answers are reported separately.

Main findings:

- Before the later visual truth audit, large-reader all-answer accuracy appeared to be `468/582` (`80.4%`); row `219/264` (`83.0%`), non-row `249/318` (`78.3%`). The corrected result below supersedes this figure.
- A subsequent full-page 1/7 truth audit corrected four manual labels without overwriting the source dataset: `72→12`, `73→13`, `76→16`, and a separately noticed `47→42`. The first three were serif-style 1s confirmed from repeated same-writer forms; the fourth preserves a clearly written but mathematically incorrect 42.
- Corrected large-reader all-answer accuracy is `472/582` (`81.1%`); row `219/264` (`83.0%`), non-row `253/318` (`79.6%`).
- Any recorded reader candidate contained the corrected transcription on `559/582` (`96.0%`); on manual truth, `283/302` (`93.7%`). Selection and abstention remain the bottleneck, but 23 cases still lacked the correct candidate.
- The large reader was materially better on one-digit answers (`232/268`, `86.6%`) than two-digit answers (`236/310`, `76.1%`). The remaining four labels were true blanks. Multi-digit sequence recognition is therefore still a distinct weakness.
- Fresh V2 replay accepted row `189/264` (`71.6%`) and non-row `119/318` (`37.4%`). It exposed one manual-truth V2 error (`4` read as `9`), unlike the earlier exact stored-zone control. Fresh full-page geometry is therefore not interchangeable with the exact prior replay.
- On V2-review answers, accepting a single high-confidence large read would add 225 decisions but make 29 errors after truth correction. Requiring both learned readers to agree and both confidences to be at least `0.70` would add 152 decisions and make one visually verified error (`45`→`15`). A separate number-bond miss was an empty/mislocated fresh crop.
- The diagnostic two-model lane would produce selected coverage of row `237/264` (`89.8%`) and non-row `223/318` (`70.1%`), but it still has that one unsafe error and is not the frozen policy. The broad historical evidence therefore says non-row is still materially harder; P08's non-row-above-row result is encouraging but not established.

Artifacts:

- Replay: `private-evidence/reports/v3-historical-fresh-replay-20260713/`
- Score: `private-evidence/reports/v3-historical-fresh-replay-20260713-score.json`
- Visually audited score: `private-evidence/reports/v3-historical-fresh-replay-20260713-score-visual-audited.json`
- Non-destructive truth corrections: `private-evidence/truth-labels/20260703-flex-duplicate-accepted-needs-label/visual-audit-corrections-20260713.json`
- Research-only runners: `scripts/run_v3_historical_fresh_replay.mjs`, `scripts/score_v3_historical_fresh_replay.mjs`

Do not use this replay to retune the already-frozen P08 rule. The next decisive evidence remains intact prospective P03 and P09, whose real three retained frames can test whether 3-of-3 stability rejects the selected-frame historical failures.

## 2026-07-14 P02 truth verification and answer-zone crop audit

Completed the requested sequence: independently verified P02 truth, diagnosed the five P02 mixed-sheet and four number-bond reviews from saved images, built a narrow crop candidate without changing recognition/confidence policy, replayed all four scanned packets, and decided whether to spend a reserve.

Key findings:

- Blind P02 verification corrected number-bond Q6 from `31` to `3`; number-bond Q4 and place-value Q3 are overwritten and excluded. P02 has 68 scorable values from 70 answers.
- Mixed-sheet failures were a real geometry bug: two-column answer-frame assignment was hard-coded for 10 frames and misassigned several of the 8 detected frames. The candidate supports even two-column counts of at least 8; six-answer layouts keep the prior path.
- P02 number-bond crops already contain the handwriting. Remaining failures are reader/frame inconsistency and a one-slot metadata/worksheet mismatch for a written `19`, not a broad crop-fidelity loss.
- Full saved-frame replay completed 40/40 pages and 275 scorable values. V2 alone accepted 173 and all 173 matched truth. The frozen overlay accepted 246, but one was wrong: P09 number-pattern Q1, handwritten `34`, was read as `39` on all three large-model frames. The compact reader disagreed (`22`). The error persisted after the six-answer crop path was reverted, so it is not caused by the new eight-frame crop assignment.
- Row overlay replay: 146/160 automatic, zero observed errors. Non-row: 100/115 automatic, one error. Overall 245/246 automatic reads correct at 89.5% coverage; this fails the zero-error gate.

Decision:

- Do not enable the whole-answer fallback for automatic grading. Keep it review-only.
- Keep the narrowed eight-frame crop fix as an undeployed candidate for the conservative OCR/review path.
- Do not scan another untouched packet yet. Preserve P01 and P04-P07 until a materially safer decision rule passes the existing replay; another packet cannot repair a known policy failure.

Evidence and reproducibility:

- Report: `docs/SCANGRADE_P02_LABEL_AND_CROP_AUDIT_20260714.md`
- Verified truth: `private-evidence/hybrid-v2-prospective/handwritten-truth-p02-verified.json`
- Final score: `private-evidence/reports/v3-crop-candidate-evaluation-20260714-final.json`
- Runners: `private-evidence/hybrid-v2-prospective/verify-p02-truth.mjs`, `scripts/replay_v3_crop_candidate_packets.mjs`, `scripts/evaluate_v3_crop_candidate.mjs`
- Verification: `npm run test:v3:zones` (8/8), `npm run test:hybrid` (15/15), and `npm run build` passed.
- Nothing was deployed or pushed.

## 2026-07-14 review timing and authenticated service tests

Automated review and authenticated deployment-boundary tests are complete. Full report: `docs/SCANGRADE_REVIEW_AND_AUTH_CLOUD_TEST_20260714.md`.

- Real UI automation completed all 14 row yellow answers across 10 pages: truth choice 14/14, telemetry 14/14, 24 total taps, 56 ms mean and 79 ms p95 click-to-settled latency.
- Local result averaged 3.46 s after upload; strong suggestions averaged 12.63 s, an additional 9.18 s. Suggestion readiness—not correction rendering—is the current UX latency target.
- Testing exposed and fixed two UX defects: auto-advance now skips confidently wrong red answers, and eligible whole-answer suggestions open whole-answer mode for partially uncertain two-digit answers.
- Authenticated strong-service gates passed, with 8/8 parity, but resident memory was about 2.0 GB. It is not a 1 GB/free-container assumption.
- The compact staged context passed 24/24 parity, auth/privacy gates, 82 ms/24 answers, and about 177 MB RSS. It contains four runtime files and zero student evidence.
- Full browser-to-two-authenticated-services test passed using a temporary session-only token; the P03 `15` suggestion was selected and recorded. A paid beta still requires real teacher identity and short-lived token refresh/revocation.
- Both optional endpoints were deliberately disabled; local predictions, grading, yellow flags, and answer groups remained identical. Fail-open passed.
- A genuine teacher reading-time measurement still requires a human. The six-answer protocol is `docs/SCANGRADE_TEACHER_REVIEW_TIMING_PROTOCOL_20260714.md`.
- Nothing was deployed or pushed.

## 2026-07-14 no-new-packet improvement goal completed

Exhaustive work using only saved artifacts is summarized in `docs/SCANGRADE_NO_NEW_PACKET_IMPROVEMENT_REVIEW_20260714.md`.

Production-facing outcome:

- Automatic grading remains the conservative browser policy; no whole-answer fallback was promoted.
- For eight-question row layouts only, the review UI may show a key-blind whole-answer suggestion when at least two of three retained frames agree and consensus minimum confidence is at least 0.80. It never turns yellow green or changes grading.
- Across all 20 saved row pages, truth was available among tap choices for 14/14 yellow answers; all 12 model-derived row choices were correct. Matched comparison found zero grading or review-flag differences across 160 answers.
- Six-question/non-row layouts retain the strict 0.98 display threshold. Broader relaxation exposed the known unsafe P09 number-pattern `34→39`; a fresh replay verified that wrong suggestion is hidden under the final rule.
- After a V3 correction, the UI opens the next yellow item automatically. Correction source, one-tap status, and review duration remain recorded.

Rejected or shadow-only:

- The eight-frame crop candidate gained on the four recent packets but lost one historical large-lane automatic read; production default is restored and the candidate remains opt-in only.
- An alternate-crop review lane added 42 model items and produced zero useful new choices.
- Packet-aware compact retraining, generic-base TrOCR adaptation, same-writer prototypes, and blank/artifact automation failed their gates.
- Gentle continuation of the existing TrOCR adapter improved P09 by 2/70 and P02 original-crop audit by 10/68, but did not improve conservative acceptance and remains review/shadow research only.

Runtime and verification:

- Mac CPU TrOCR: 235 ms for one answer, 1.51 s for eight, 4.27 s for 24; answer-key input rejected. It is suitable for asynchronous review, not as a single point of failure.
- JavaScript tests 41/41, Python confidence tests 2/2, and production build pass.
- Keep the app fail-open: local result must remain available when optional inference is down.
- Do not spend another untouched packet on any unchanged candidate. Next decisive evidence is teacher-timed review, authenticated cloud parity/outage testing, then unseen September classroom data.
- Nothing was deployed or pushed.

## 2026-07-14 yellow-only strong review and compression decision

Full report: `docs/SCANGRADE_YELLOW_ONLY_AND_COMPRESSION_20260714.md`.

- The optional adapted TrOCR service now receives only answers already marked yellow by the unchanged browser policy. It never receives green/red answers merely to re-read the whole page, and it remains review-only and key-blind.
- Matched ten-page UI replay retained truth choices for 14/14 yellow answers, 24 required taps, and four automatic advances. Strong answer-frame requests fell from 240 to 42 (82.5%); added wait after the local result fell from 9.18 s to 6.05 s (34.0%).
- Dynamic int8 compression failed 0/8 parity and regressed both latency and memory. Float16 and bfloat16 preserved 8/8 smoke-test parity and cut memory from about 2.03 GB to 1.24 GB, but were roughly 7.7× and 8.7× slower on the tested CPU.
- Production recommendation: keep the existing float32 strong reader, reduce cost by yellow-only routing, and validate latency/memory again on the actual Linux cloud host. Experimental compression flags are off by default.
- Local grading, recognition policy, confidence thresholds, answer-key separation, and fail-open behavior were not changed. Nothing was deployed or pushed.

## 2026-07-14 storage and larger-grayscale continuation checkpoint

Read `docs/SCANGRADE_STORAGE_AND_CONTINUATION_CHECKPOINT_20260714.md` before continuing.

- Internal storage was critically low (about 562 MiB free). Only archival/reproducible outputs were selected for verified offload to `/Volumes/Tony's Rugged HD/Codex/ScanGrade Offloads/2026-07-14-pre-large-grayscale/`.
- Preserve current debug scans, truth, four-packet evidence, reports, models, code, layouts, tests, and untouched evaluation material locally.
- The next objective is local larger-grayscale recognition: test whether the system can resolve more yellow answers itself by avoiding the degraded 28×28 representation. Keep this shadow/review-only until a matched zero-new-error replay passes.
- Exact current behavior and evidence references are recorded in the checkpoint document.

## 2026-07-14 local larger-grayscale result

Full report: `docs/SCANGRADE_LOCAL_LARGE_GRAYSCALE_INVESTIGATION_20260714.md`.

- The existing 5 MB 64×192 grayscale compact model remains the strongest local candidate generator: top-three truth availability is 232/275 on the four recent packets and 10/14 on current yellows.
- Combined with the browser's existing independent alternatives, local evidence covers 11/14 current yellows. It is not safe for automatic promotion; historical wrong reads exist above 0.995 confidence.
- A robust same-page geometry repair identified four outliers and raised selected candidate availability from 232 to 233. It found a clear missed `6`, but the compact reader still called that visible digit `5`, proving the remaining limit is partly recognition rather than crop quality.
- A synthetic-pretrained replacement improved historical holdout but regressed recent packets; fixed layout crops, pencil/print band-pass digit recognition, and native Apple Vision also failed their gates.
- Recommended architecture remains local-first review choices plus yellow-only optional strong fallback. No OCR/confidence/grading behavior was changed, deployed, or pushed.

## 2026-07-14 overwritten `34` audit and local-first checkpoint

- Tony inspected the actual P09 number-pattern Q1 crop and independently observed that the student appears to have first formed a 9-like mark, leaving the upper loop/indentation, then changed it to a 4. Classify this as genuinely ambiguous overwritten work, not a routine clean-handwriting recognition miss.
- Preserve handwritten truth as `34`. The experimental automatic `39` still counts as unsafe because the final intended answer is 34; an understandable model reading is not permission to silently replace student work.
- The three independent reads were browser `37`, strong three-frame `39`, and compact `22`. That disagreement is a useful overwrite/ambiguity signal and should keep the answer yellow.
- A post-hoc number-pattern-only compact-top-two veto produced 243/275 automatic (88.4%) with zero observed errors on the four recent packets. It remains shadow-only because it was designed after seeing the failure and needs genuinely untouched validation.
- Local-first review is implemented behind `?v3LocalFirstReview=1`: existing browser choices first, up to two immediate compact larger-grayscale choices, then explicit `None of these` for one-question strong review. The strong reader never changes grading.
- Canonical integration timing: local result 4961.2 ms, compact choices 55.5 ms later, one explicit strong request 709.4 ms warm. No strong request occurred before the teacher action, and only the active question's three frames were sent.
- Current conservative reconstruction on 14 recent row yellows: browser choices contained truth for 8, browser plus compact for 10, leaving 4 for on-demand strong. Projected strong frame requests fall from 42 yellow-only eager requests to 12, a 71.4% reduction.
- Tests and build pass; nothing was deployed or pushed. Remaining work is an exact full ten-page local-first UI replay, local-first outage recovery, and current-code old-iPad/WebKit emulation before a recommendation.
- Evidence: `private-evidence/reports/v3-overlay-salvage-20260714.json`, `private-evidence/reports/v3-local-first-app-integration-20260714.json`, and `private-evidence/reports/v3-local-first-architecture-evaluation-20260714.json`.

## 2026-07-14 local-first completion checkpoint

- The exact UI evaluator now opens every displayed yellow on all 40 retained four-packet pages: 107 yellows, 104 with scorable handwritten truth and three excluded ambiguous/overwritten answers.
- A real preparation bug was fixed: background optional-AI work now uses the union of underlying review flags and every answer group actually displayed yellow. Some UI yellows previously had valid crops but were omitted from both optional readers.
- The final experimental review candidate preserves up to three browser choices and appends up to three compact larger-grayscale choices. Truth is immediately tappable for 88/104 yellows (84.6%): row 44/50 and non-row 44/54. After an explicit per-answer strong request, truth is available for 90/104 (86.5%); 14 require manual typing.
- Only 16 answers request strong inference (48 frames), an 84.6% reduction versus eagerly sending all 104 scorable yellows. No strong request occurs before `None of these`; no existing choice was removed; all 40 automatic OCR/grade results remained identical.
- The studied ten-page/14-answer correction workflow now resolves 14/14 immediately locally, uses zero strong calls, and takes 24 button taps with four automatic advances. This subset is not the authoritative coverage statistic; use the complete 40-page result above.
- Exact dual-service outage recovery passed. WebKit with an older-iPad viewport/iPadOS 15.7 user agent passed over HTTPS; compact choices arrived 132.9 ms after the local result in that smoke test. A physical old-iPad camera/memory/stability run remains required before beta.
- Tony's inspection confirms P09 number-pattern Q1 contains a 9-like first trace overwritten into a final 4. Keep truth `34`; `39` remains an understandable but unsafe automatic transcription. The post-hoc 243/275 (88.4%) automatic overlay veto remains shadow-only until genuinely untouched evidence exists.
- Nothing was deployed or pushed. The automatic browser policy remains frozen. Evidence: `private-evidence/reports/v3-local-first-all-yellows-ui-20260714.json`, `private-evidence/reports/v3-local-first-workflow-benchmark-20260714.json`, `private-evidence/reports/v3-local-first-failure-recovery-20260714.json`, `private-evidence/reports/v3-local-first-webkit-ipad-20260714.json`.

## 2026-07-14 expanded-context crop checkpoint

- Full report: `docs/SCANGRADE_CONTEXT_CROP_RESULT_20260714.md`.
- A second, wider grayscale crop is now prepared from the untouched canonical page but is review-only and key-blind. It is not sent during the initial local review pass.
- After a teacher taps `None of these`, the compact reader checks only that answer's wider crop. A new visible local choice defers strong inference; otherwise the same action continues to the existing one-question/three-frame strong fallback.
- Exact 40-page replay: initial truth availability remains 88/104; after teacher-triggered fallback it improves from 90/104 to 91/104. Strong requests fall from 16 to 15. The known P03 number-bond `9` is recovered locally.
- All 40 automatic OCR/grade signatures stayed invariant, no initial choice was removed, and manual entry remained available for every yellow answer.
- Reject generic edge/containment gating: worksheet print made it far too noisy. Reject sending primary and context crops in the same immediate model batch: it changed one primary review list and displaced a correct choice.
- Tests 18/18 and production build pass. Nothing was deployed or pushed.

## 2026-07-14 conservative-consensus reliability goal

Date / thread: 2026-07-14, active ScanGrade thread

What changed:

- Added a key-blind safety veto for the demonstrated weak box-safe confidence-clearance path.
- Added a conservative automatic selector requiring exact three-frame large-grayscale agreement, independent compact-model support, slot-compatible answer length, no stable browser-preprocessing conflict, and no ambiguity/safety veto.
- Added ambiguity handling for model-family disagreement, crop clipping, and a narrow weak-override/material-rival pattern.
- Added an experimental application layer that can promote independently transcribed yellow answers, recompute ordinary mathematical grading, annotations, and review state, and preserve incorrect student math. It is available only with `hybridV3=1&v3ConfidenceSafety=1&v3ConsensusPromotion=1` and related V3 evidence flags; production defaults are unchanged.
- Added exact control/candidate scoring and matched-diff scripts.

Evidence used:

- Four recent saved packets P08/P03/P09/P02: 40 pages, 280 answer groups, 275 scorable handwriting labels, five ambiguous labels excluded.
- Historical saved corpus: 582 answers, 578 scorable, used only as a one-frame falsification stress test because authentic adjacent frames are unavailable.
- Separate truth-label overlay corrected two visually verified source-label errors (`16→14` and answer-key-contaminated `6→2`) without modifying the source label files.

Commands run:

- `node scripts/evaluate_consensus_promotion_policy.mjs`
- `node scripts/evaluate_consensus_historical_single_frame_stress.mjs`
- `node scripts/replay_v3_crop_candidate_packets.mjs ...` for full candidate and matched feature-off control
- `node scripts/score_consensus_integration_replay.mjs ...`
- `node scripts/compare_consensus_matched_control.mjs`
- `node scripts/test_consensus_webkit_saved_page.mjs`
- `node scripts/test_local_first_failure_recovery.mjs`
- focused Node tests and production build (see final verification below/report)

Results:

- Exact matched control: 172/275 automatic (62.5%), 172 correct, zero observed wrong.
- Exact candidate: 222/275 automatic (80.7%), 222 correct, zero observed wrong.
- Exact gain: 50/50 correct promotions; +25 row and +25 non-row; zero automatic demotions, zero changed pre-existing automatic outputs, and zero unrelated changes.
- Candidate row: 137/160 (85.6%); non-row: 85/115 (73.9%); one digit: 87/100 (87.0%); two digits: 135/175 (77.1%).
- All 40 pages completed; annotation/review state was consistent; marked sheets were regenerated.
- Historical one-frame stress: 448/578 automatic (77.5%), zero observed wrong; known `4→9` and `45→15` failures stayed review. This is not a substitute for three-frame prospective validation.
- WebKit mobile emulation passed over HTTPS; optional dual-service outage passed fail-open/manual-recovery gates.
- Final focused JavaScript suite passed 37/37 and `npm run build` passed. The existing bundle-size warning remains (about 675 kB minified / 225 kB gzip).
- Candidate freeze manifest created at `private-evidence/protocols/consensus-candidate-freeze-20260714.json`: 33 SHA-256 file identities, policy versions, required flags, model identities, reference metrics, and blinded protocol rules. Because the repository was already dirty, these hashes—not Git HEAD alone—define the candidate.

Files changed:

- `src/v3/confidence-safety.js`
- `src/v3/consensus-promotion.js`
- `src/v3/ambiguity-detector.js`
- `src/v3/consensus-application.js`
- experimental integration in `src/components/CameraCapture.vue`
- focused tests/evaluators under `tests/` and `scripts/`
- `docs/SCANGRADE_CONSENSUS_RELIABILITY_RESULT_20260714.md`
- this ledger/handoff entry

Rollback point:

- Do not pass `v3ConsensusPromotion=1` or `v3ConfidenceSafety=1`. The ordinary production URL and defaults are unchanged. No deployment, push, or commit was made.

Next action:

- Freeze code/model/layout hashes and a blinded scoring protocol. If Tony approves spending one reserve packet, choose it before viewing handwriting quality, label without answer key or predictions, run the frozen candidate once, and do not tune on it. A clean result is a private-beta gate, not proof of zero true error.
- If the blinded gate passes, stage the yellow-only services behind real authentication and test a physical old iPad, hosted latency/outage/privacy, and teacher review time.

Open risks:

- The 80.7% result is post-hoc development evidence from correlated pages/students/templates; it is not a public accuracy claim.
- Two label errors were found, including one answer-key-contaminated label; locked truth needs independent QA.
- Physical old-iPad sustained camera/memory performance and real live-burst behavior remain untested.
- Strong-reader hosted reliability, cold start, privacy operations, and cost remain unproven.
- Non-row coverage (73.9%) still trails row coverage (85.6%).

Full result: `docs/SCANGRADE_CONSENSUS_RELIABILITY_RESULT_20260714.md`.

## 2026-07-14 conservative-consensus private-beta deployment

- Tony explicitly authorized changing, deploying, committing, and pushing the frozen candidate.
- Production default is enabled only on `.ts.net` private deployments. GitHub Pages retains local OCR because no private/authenticated whole-answer service exists there.
- Private URL: `https://hobbes-mac-mini.tail9a3379.ts.net/`.
- Same-origin tailnet-only model routes: `/review-model` and `/v3-compact`.
- Immediate runtime rollback: append `?consensusCandidate=0`.
- Build label: `2026.07.14-consensus-private-beta-1`.
- The Tailscale app had stopped serving even though its process remained present. Restarting the app restored status, DNS, and all configured routes. Both health paths and browser CORS preflights pass.
- Release tests 40/40, standard build, GitHub Pages build, and `git diff --check` pass.
- The in-app browser loaded the new build from the real private URL.
- Live P09 number-pattern smoke after model warm-up: both readers available, consensus enabled, three promotions, overwritten `34` stayed yellow, written wrong-math `40` stayed `40` and became red, marked sheet regenerated.
- First strong request after model cold compilation exceeded the client window and safely produced no promotions; a warmed 15-answer Tailscale batch completed in about 1.65 seconds. Availability remains fail-open.
- Deployment report: `docs/SCANGRADE_CONSENSUS_PRIVATE_BETA_DEPLOYMENT_20260714.md`.
- Source release committed and pushed on `autobuild/safe-20260223`: `2ca7629` (`Promote conservative consensus private beta`).
- Browser build committed as `5d2f8de`; the configured `gh-pages-v2` deployment was triggered by `5ff62c2`.
- GitHub Pages Run 99 (`29381415169`) completed successfully for `5ff62c2`.
- Live public verification: `https://scangradesheets.github.io/draft1/` serves `assets/index-9msytI_D.js`, `assets/index-BU8aNFjE.css`, and build label `2026.07.14-consensus-private-beta-1`.
- Live private verification: `https://hobbes-mac-mini.tail9a3379.ts.net/` serves the same build; both model health endpoints return OK.

## 2026-07-14 evidence-pipeline repair checkpoint

- Full report: `docs/SCANGRADE_EVIDENCE_PIPELINE_REPAIR_20260714.md`.
- Coherent page-level answer-frame registration repaired four of the six originally classified crop failures directly; the other two remain safely yellow (one unstable across frames, one reclassified as recognition/print interference because the crop already contains the answer).
- Physical box geometry is now separate from maximum handwritten length. Number-bond groups can preserve a two-digit transcription such as written `19` inside one printed box, then grade it mathematically wrong without answer-key guessing.
- Optional two-slot handling is now key-blind and allows a single written digit in either physical slot. Removing the former answer-key preference deliberately moved two borderline dot-collection answers back to review.
- The identical-input issue was a candidate-identity/freeze-manifest defect, not random inference. Two independent browser replays now match exactly on crop hashes, probabilities, preprocessing evidence, and selected digits.
- Clean final replay: 40/40 pages, 280/280 groups, 275 scorable; 234 automatic (85.1%), 234 correct, zero observed wrong. Row 144/160 (90.0%); non-row 90/115 (78.3%); one digit 86/100; two digits 148/175. Forty-one answers remain yellow.
- Historical one-frame falsification stress: 457/578 surrogate automatic, zero observed errors; still not proof of three-frame generalization.
- 58 focused tests, layout audit (zero errors), production build, exact determinism comparison, and 55-file candidate-manifest verification pass.
- Candidate freeze: `private-evidence/protocols/evidence-pipeline-candidate-freeze-20260714.json`.
- Nothing from this checkpoint was deployed, committed, or pushed. Do not enable or release it without Tony's explicit approval.

## 2026-07-15 non-row / number-bond candidate checkpoint

- Candidate 2 remains the immutable matched control: 234/275 automatic (85.1%), 0 observed errors; row 90.0%, non-row 78.3%, number bonds 50.0%.
- Separate physical-slot recognition was rejected (49/115 non-row; only 1/11 number-bond yellows recovered).
- Raw alternate crops contained substantial signal but were unsafe alone: the best broad trim produced four confident errors, and the best number-bond crop produced a duplicated `17→1717`.
- Candidate 3 uses alternate pixels only as a conservative corroboration lane. The primary and layout-specific alternate crop must produce the same exact answer on all three frames (six reads total, minimum confidence 0.70), while all existing length, ambiguity, browser-conflict, and confidence-safety vetoes remain in force.
- Number bonds use a crop shifted down 4% of slot height; other non-row layouts use a 4% interior trim. Rows are unchanged.
- Exact 40-page result: 237/275 automatic (86.2%), 237/237 correct; rows 144/160 (90.0%); non-row 93/115 (80.9%); number bonds 13/22 (59.1%). All annotations and marked sheets were consistent.
- Second exact non-row replay: 20/20 pages identical on inputs, probabilities, alternate evidence, decisions, and final application; 93/115 automatic, 0 wrong.
- Remaining non-row yellows: 22 total — 11 cross-frame instability, 7 compact-model disagreement, 3 confidence-safety vetoes, 1 stable browser conflict. Nine are number bonds.
- Complete JavaScript tests 105/105 and production build pass. Candidate manifest verifies 59/59 files.
- Report: `docs/SCANGRADE_NONROW_DUAL_CROP_RESULT_20260715.md`.
- Freeze: `private-evidence/protocols/nonrow-dual-crop-candidate-freeze-20260715.json`.
- Flags remain off by default. Nothing was deployed, committed, or pushed. Candidate 3 should replace candidate 2 only for the next private test after Tony's approval.

## 2026-07-15 candidate 3 private deployment

- Tony explicitly authorized replacing private candidate 2 with candidate 3 and locking it in through commit, push, and private publication.
- Candidate 3 is now the default on `https://hobbes-mac-mini.tail9a3379.ts.net/` only.
- Build label: `2026.07.15-nonrow-dual-crop-private-beta-3`.
- Private `.ts.net` runtime enables `v3NumberBondShiftDown` and `v3NonrowTrimEvidence`; public/non-tailnet hosts leave them off by default.
- Immediate rollback remains `?consensusCandidate=0`, which disables the entire private candidate including both new crop lanes.
- Release validation: 105/105 JavaScript tests, standard build, pruned public build, `git diff --check`, and 63/63 manifest verification pass.
- Live private verification: root loaded with the new build label; strong and compact health routes returned OK; served source contains both candidate 3 feature gates.
- Public GitHub Pages was intentionally not replaced and still serves build `2026.07.14-consensus-private-beta-1` from `gh-pages-v2` commit `5ff62c2`.
- Candidate source commit `6883acf` was pushed to `origin/autobuild/safe-20260223`. Private evidence, student images, model experiments, Mission Control state, and unrelated dirty files were excluded.
- Deployment record commit `d3cdcd3` was also pushed; it directly follows the candidate source commit.
- Deployment report: `docs/SCANGRADE_NONROW_PRIVATE_BETA3_DEPLOYMENT_20260715.md`.

## 2026-07-15 Candidate 3 rugged-drive disaster-recovery backup

- Tony requested a backup sufficient to recover Candidate 3 if the Mac mini were lost.
- A new dated full snapshot was created at `/Volumes/Tony's Rugged HD/Codex Rescue Backups/scan-grade-project-snapshots/scan-grade-candidate3-20260715/project/` without overwriting the older May snapshot or July 14 archival offloads.
- The snapshot contains the complete working tree and `.git`, 23 GB of private evidence, current models, datasets, benchmarks, layouts, tests, handoffs, reports, and deployment instructions. Only reinstallable dependency caches, Finder metadata, and Git's nonportable live fsmonitor socket were excluded.
- Inventory: 82,812 regular files, 5 symlinks, and 33,973,839,429 logical bytes; approximately 346 GiB remained free on the rugged drive.
- Candidate freeze verification run from inside the backup passed 63/63 required SHA-256 identities.
- `git fsck --full` run inside the backup returned exit status 0 with no missing/corrupt objects.
- A complete checksum-mode rsync comparison reread all included source and destination files, returned exit status 0, and reported zero differences.
- Full restore and verification instructions: `docs/SCANGRADE_CANDIDATE3_RUGGED_BACKUP_20260715.md`.
- This protects against loss of the Mac, but not simultaneous loss of both the Mac and rugged drive. An encrypted off-site backup remains the next redundancy layer.

## 2026-07-15 selected-core-crop rescue checkpoint

- Candidate 3 remains the deployed/frozen control: 237/275 automatic (86.2%), zero observed errors.
- A new opt-in research flag, `v3CoreCropEvidence=1`, asks the adapted strong reader to read the selected grayscale answer image plus 2% and 4% interior trims. It may bypass a compact/browser veto only when all three selected crops and all three retained frames agree exactly, the answer fits the slot contract, and no ambiguity or confidence-safety veto exists.
- Final exact 40-page development replay: 250/275 automatic (90.9%), 250/250 correct; rows 150/160 (93.8%), non-row 100/115 (87.0%), 25 yellows.
- The lane adds 13 correct automatic transcriptions over Candidate 3. The overwritten `34→39` remains yellow because the selected crops disagree. A correct written `15` also remains yellow because its existing ambiguity flag is absolute.
- Two complete 40-page replays reproduced strong, alternate, core, and compact evidence. The only final difference was the intended ambiguity-guard demotion. Full JavaScript suite 109/109, production build, and diff checks pass.
- The current compact model cannot replace the strong reader: it scored only 6/38 original yellow crops, at best 8/38 on a variant, and its three-view agreement selected 11/11 wrong compact-veto reads.
- The 18 frame instabilities and 4 safety vetoes were investigated. Post-hoc rules could select 1 and 2 correct answers respectively, but remain rejected as same-set overfitting. Final residuals: 18 frame/strong-confidence instabilities, 4 safety vetoes, and 3 compact vetoes.
- Secure WebKit/mobile emulation passed and kept the overwritten answer yellow, but optional consensus completion increased from 13.59 s to 26.96 s because the research integration eagerly requests core crops for every initial yellow. Before deployment, make this a second-stage request only for the small set still vetoed after Candidate 3.
- Architecture conclusion: the Mac mini cannot yet be removed while retaining the demonstrated 90.9% coverage because the gain depends on adapted TrOCR. It is not a total single point of failure: reader outage fails open to browser grading, more yellow reviews, and manual correction. The recommended public architecture is local browser grading plus an authenticated hosted strong service for unresolved yellows, while training/distilling a stronger browser model.
- Nothing in this checkpoint was deployed, committed, or pushed. Candidate 3 remains live. Full report: `docs/SCANGRADE_CORE_CROP_RESCUE_RESULT_20260715.md`.

## 2026-07-15 selected-core-crop private beta 4 release

- Tony authorized completing and deploying the selected-core-crop candidate when release gates passed.
- The extra strong-reader crop lane is now a true second stage. Candidate 3 runs first; only unresolved compact-support/browser-conflict vetoes without an ambiguity flag request the selected original, 2% trim, and 4% trim. Confidence-safety, ambiguity, slot-length, and frame-stability vetoes remain absolute.
- Exact 40-page second-stage replay preserved the final candidate result: 250/275 automatic (90.9%), 250/250 correct, 25 yellow; rows 150/160 (93.8%), non-row 100/115 (87.0%). Final answer groups matched the prior eager implementation on all 40 pages.
- Extra strong-reader workload fell from 309 to 48 core-crop images (84.5% fewer), and only 14/40 pages made a second-stage request instead of 36/40.
- Real warmed Tailscale/Safari-WebKit smoke: local result 3.93 s, optional consensus 21.64 s; warm repeat 4.02 s / 21.32 s. All gates passed and the overwritten `34/39` remained yellow. This latency is acceptable for private evaluation, not a public performance promise.
- Model-outage recovery passed: local grading completed, no automatic promotion occurred, manual correction worked, and failed optional services changed no local result.
- Release validation: 110/110 JavaScript tests, standard build, pruned public build, `git diff --check`, exact 40-page replay, workload parity comparison, secure WebKit, and outage recovery.
- Private-only build label: `2026.07.15-core-crop-private-beta-4`. Immediate rollback remains `?consensusCandidate=0`. Public GitHub Pages remains unchanged.
- Source commit `535e5bb` (`Promote selected core-crop private beta`) was pushed to `origin/autobuild/safe-20260223`. Live private source, build identity, both model health routes, and the rollback route were verified. Candidate freeze verified 71/71 files.
- Deployment report: `docs/SCANGRADE_CORE_CROP_PRIVATE_BETA4_DEPLOYMENT_20260715.md`.

## 2026-07-15 shared-frame latency private beta 5

- Profiling showed the adapted strong model was not the main source of the 21.6-second difficult-page delay: primary inference took about 1.28 seconds and combined corroboration about 0.56 seconds. The browser spent about 6.0 seconds preparing primary burst crops and another 8.6 seconds redundantly re-registering the same frames for alternate crops.
- Candidate 5 creates primary and alternate crops during one page-registration pass, then sends alternate/core corroboration together only for unresolved safe candidates. Recognition thresholds and all ambiguity, confidence-safety, length, and 3/3 frame requirements are unchanged.
- Safari/WebKit difficult-page timing improved from 21.64 seconds to 12.02 seconds (44.5% faster); warm repeat was 12.54 seconds. The local result still appeared in about 3.85 seconds and the overwritten `34/39` stayed yellow.
- Exact 40-page replay remained 250/275 automatic (90.9%), 250/250 correct, with the same 25 yellows and identical final answer groups on all 40 pages. Five correct promotions now record stronger two-crop/six-read support instead of selected-core support because the formerly contending alternate request completes reliably; no transcription, grade, or review state changed.
- Across the 40-page replay, optional processing after the local result averaged 6.28 seconds (median 6.57, p90 9.81, maximum 11.95). Sixteen pages requested combined corroboration.
- Release gates: 110/110 tests, standard and pruned-public builds, secure WebKit cold/warm smoke, complete scored replay, final-output parity, and full model-outage/manual-recovery test all passed.
- Private build label: `2026.07.15-shared-frame-private-beta-5`. Public GitHub Pages remains unchanged. Rollback remains `?consensusCandidate=0`.
- Source commit `30372dd` (`Reduce private grading latency with shared frame processing`) was pushed to `origin/autobuild/safe-20260223`. Live private build identity, both new runtime defaults, both model routes, and the remote source SHA were verified. Candidate freeze verified 75/75 files.
- Deployment report: `docs/SCANGRADE_SHARED_FRAME_PRIVATE_BETA5_DEPLOYMENT_20260715.md`.

## 2026-07-16 five-workstream speed, accuracy, and independence goal checkpoint

Date / thread: 2026-07-16, active ScanGrade five-workstream persistent goal.

What changed:
- Added opt-in research harnesses for selected-frame geometry reuse, worker-based frame decoding, and shadow-only three-frame median/aligned fusion. Candidate 5 production behavior and frozen recognition policy remain unchanged.
- Added packet-separated compact-model fine-tuning, final packet-adapted shadow training, and PyTorch/ONNX parity scripts.
- Deterministically locked physical packet P05 as the next prospective one-shot holdout. P05 remains intact, unscanned, and unseen.
- Offloaded four bulky reproducible replay directories to Tony's Rugged HD after recursive verification.

Evidence used:
- Candidate 5 control replay: 250/275 automatic, 250/250 observed correct, 25 yellow; rows 150/160, non-rows 100/115.
- Four opened recent packets P08/P03/P09/P02 with independently verified handwriting truth; historical development/validation/known holdout manifests.
- Eighteen recorded frame-instability answers and their saved grayscale answer crops.
- Current WebKit mobile emulation and P08 saved retained frames. No new physical packet was opened.

Commands run:
- P08 direct-geometry and worker replay through `scripts/replay_v3_crop_candidate_packets.mjs`, exact parity scoring, and WebKit worker compatibility smoke.
- Four-packet shadow median fusion plus 24-page aligned-fusion replay; `scripts/analyze_v3_frame_fusion.mjs` scored all 18 instabilities.
- `.venv/bin/python scripts/evaluate_v3_packet_crossfit.py ... --device mps`.
- `.venv/bin/python scripts/train_v3_sequence_packet_adapted.py ... --device mps`.
- `.venv/bin/python scripts/verify_v3_sequence_onnx.py ...`.
- Final JavaScript regression suite passed 114/114; production build, `git diff --check`, and the 11/11 P05 freeze verification also passed.
- Added and tested a P05-specific create-only scorer, key-blind shadow manifest builder, and create-only ONNX predictor. The exact Candidate 5 plus shadow boundary is frozen at `private-evidence/protocols/p05-prospective-candidate-freeze-20260716.json`; 11/11 file identities verify.

Results:
- Direct geometry reuse rejected: P08 59/70 automatic versus 64/70 control, zero observed wrong but failed evidence/output parity.
- Worker decode produced exact 10-page parity but was about 72 ms slower to crop readiness and 85 ms slower overall. Current WebKit used the worker path; real old-iPad sustained memory remains untested.
- Repeated WebKit stress proxy completed 8/8 difficult-page runs in both modes. Baseline averaged 3.952 s local / 10.084 s complete; worker averaged 3.963 s / 10.173 s. RSS was noisy and non-monotonic, with the worker reaching the higher transient peak (about 480 MiB versus 436 MiB). This is no speed or memory win; keep the worker off. Physical old-iPad testing is still required.
- Residual CNN rejected. Packet-separated authentic fine-tuning improved compact top-1 from 173/275 (62.9%) to 192/275 (69.8%), but varied 60.3%-77.1% by held-out packet and remains unsafe as an automatic reader.
- Final 6.4 MB packet-adapted ONNX is prospective shadow only. It matched PyTorch on 275/275 decisions; SHA-256 `12e31d44638f8ccc463a34c8da3879a348263f140cdd570548a1838ad73ca89d`.
- A later packet-separated explicit blank-slot model scored 187/275 (68.0%), below the sequence model's 192/275 (69.8%). It improved one-digit accuracy by one answer but lost six two-digit answers, recovered fewer Candidate 3 yellows (15 versus 17), and added no unique correct yellow. It is rejected and is not part of the P05 freeze.
- A key-blind compact-only consensus analysis joined both models' 275 out-of-fold reads to the exact 25 scorable Candidate 5 reviews. They agreed on 21 reviews, but only 10 were correct and 11 were wrong. A post-hoc 0.995 threshold selected one correct review; nested zero-error calibration on three packets selected zero reviews on every held-out packet. Reject compact-only automatic promotion. Report: `private-evidence/reports/v3-compact-crossfit-consensus-20260716.json`; reproducible script: `scripts/analyze_v3_compact_crossfit_consensus.mjs`.
- Median and locally aligned fusion each scored 8/18 correct and 10 wrong. Aligned fusion rescued zero cases. Candidate 5 outputs remained unchanged because fusion was shadow-only.
- The ten wrong fused crops had substantially lower median contrast/edge/sharpness, and failures concentrated in number bonds and optional-slot layouts. Clear crops also failed, so recognition remains a separate cause.

Files changed:
- Research/runtime harnesses: `src/components/CameraCapture.vue`, `src/v3/frame-preparation.js`, `src/workers/frame-preparation.worker.js`, `scripts/replay_v3_crop_candidate_packets.mjs`, `scripts/test_consensus_webkit_saved_page.mjs`, `tests/v3-frame-preparation.test.mjs`.
- Model/evaluation scripts: `scripts/train_v3_sequence_residual.py`, `scripts/evaluate_v3_packet_crossfit.py`, `scripts/train_v3_sequence_packet_adapted.py`, `scripts/verify_v3_sequence_onnx.py`, `scripts/analyze_v3_frame_fusion.mjs`.
- Private model/report/protocol artifacts under `private-evidence/models/v3-sequence-packet-adapted-seed29/`, `private-evidence/reports/`, and `private-evidence/protocols/v3-locked-prospective-p05-20260716.json`.
- Documentation: `docs/SCANGRADE_FIVE_WORKSTREAM_GOAL_CHECKPOINT_20260716.md`, `docs/SCANGRADE_LOCKED_P05_PROSPECTIVE_GATE_20260716.md`, `docs/SCANGRADE_RUGGED_OFFLOAD_MANIFEST_20260716.md`, and the V3 experiment ledger.

Rollback point:
- Deployed/private Candidate 5 remains source commit `30372dd`, deployment record `278c0db`, build `2026.07.15-shared-frame-private-beta-5`; runtime rollback remains `?consensusCandidate=0`.
- All new browser paths require explicit research query flags and are off by default. No deployment, commit, or push occurred in this checkpoint.

Next action:
1. Ask Tony to scan locked P05 once through the already-deployed private Candidate 5 URL; do not use the research dev server or rescan a page to seek a better result.
2. Replay and write the key-blind compact-shadow predictions before opening any handwritten truth.
3. Create blinded truth in two independent passes, then run the create-only scorer exactly once. Never tune from P05 or add it to development.

Open risks:
- P05 requires Tony's physical scan and independent truth passes; it cannot be completed locally now.
- The packet-adapted model's generalization is unproved and its confidence is unsafe.
- Physical old-iPad camera, memory pressure, thermal behavior, and sustained multi-page performance remain untested.
- The research harness adds off-by-default code to the app; do not deploy it unless a future candidate passes full freeze and release gates.

## 2026-07-17 stitched strong-evidence and local-compression checkpoint

- Candidate 5 remains unchanged at 250/275 automatic (90.9%), 250/250 observed correct, with 25 yellows. P05 and all untouched packets remain sealed.
- The exact key-blind matched-view test found that input construction is a major strong-reader bottleneck. Adapted TrOCR rose from 175/275 (63.6%) on current continuous zones to 242/275 (88.0%) on the exact historical-style stitched original-grayscale slot view. P09 validation was 63/70 (90.0%); P02 holdout was 60/68 (88.2%).
- Destructive cleaning was rejected: cleaned stitched scored 229/275 and fell to 50/68 on P02. Preserve original grayscale pixels.
- Raw strong confidence remains unsafe. The stitched view made two wrong reads above 99.5% confidence (`12→15` and `6→7`) on answers Candidate 5 already handled correctly. Use stitched output as review evidence only until an independent selector passes prospective safety gates.
- On the 25 Candidate 5 yellows, stitched TrOCR read 14 correctly versus 9 for continuous. The recommended next candidate sends one selected-frame stitched crop per unresolved yellow and exposes the result only as a teacher review choice. It must first pass an exact saved-browser A/B with all automatic outputs frozen.
- Local compression did not inherit the strong-model gain. Packet-held-out compact results: truth-only CNN 196/275 (71.3%); light teacher loss 196/275; stronger teacher loss 195/275; joint 0–99 classifier 193/275. Reject all as strong-reader replacements.
- The final technical compact artifact is 6.4 MB, has 0/853 PyTorch/ONNX decision mismatches for identical tensors, and averaged 54.5 ms/answer in conservative single-thread WASM. It is fast but insufficiently accurate/calibrated. Browser/Pillow resizing changed two decisions, so future training must use the exact browser preprocessing contract.
- Full result and durable artifact index: `docs/SCANGRADE_STITCHED_EVIDENCE_AND_COMPRESSION_RESULT_20260717.md`.
- Nothing was deployed, committed, or pushed. Candidate 5 and its rollback remain the live private control.

### 2026-07-17 forensic follow-up on two high-confidence stitched-reader errors

- The two stitched TrOCR errors were traced to clipped decisive strokes, not answer-key leakage: `12→15` loses most of the `2` lower stroke at the printed bottom border; `6→7` loses the lower loop at the number-bond answer frame. The original captured pages and Candidate 5 both show/read `12` and `6` correctly.
- A corrected coordinate-scaled expansion test reduced strong-model confidence to 0.881278 and 0.774449 respectively, but did not correct the reads. Generic larger raw crops scored only 83/275 and remain unsuitable as primary recognition input.
- Candidate 5 already contains the correct product safeguard: accepted automatic answers cannot be overridden, and local-first strong inference is yellow-only, on-demand, and review-only. Both failures are non-yellow, so they are unreachable by the strong-reader review path and cannot affect grading.
- Do not weaken this boundary. Raw stitched-model confidence is not an automatic selector. Future promotion requires independent agreement plus prospective data.
- Durable report and artifacts are appended/indexed in `docs/SCANGRADE_STITCHED_EVIDENCE_AND_COMPRESSION_RESULT_20260717.md`.
- No production behavior, deployment, commit, push, or P05 freeze state changed.

## Six-workstream improvement goal — first screen

Tony activated a new staged goal covering a stronger browser whole-answer model, non-destructive template residuals, crop containment/quality, TrOCR distillation, writer adaptation, and further latency reduction. Candidate 5 remains the immutable control and P05 plus all other untouched packets remain sealed.

The first new experiment built an additional aligned blank-template residual channel while retaining the original grayscale crop unchanged. Paired channels were generated for 578 historical and 275 recent scorable answers. A dual-channel model initialized from the existing compact checkpoint was evaluated with four packet-separated folds. It scored 190/275 (69.1%) versus 192/275 (69.8%) for the existing compact baseline, with four unique gains and six unique losses. On the exact 25 Candidate 5 reviews it scored 7 correct versus 12 for baseline and added no unique correct rescue. Reject this residual formulation; it is not deployed and is not part of the P05 freeze.

The old writer-adaptive nearest-neighbor lane was independently recovered as already falsified: its automatic zero-error gate accepted nothing, and even teacher-confirmed prototypes introduced held-out errors. Do not repeat or deploy nearest-neighbor writer adaptation. Full staged ledger: `docs/SCANGRADE_SIX_WORKSTREAM_RESEARCH_LEDGER.md`.

## 2026-07-17 six-workstream preliminary completion

All six requested directions received a bounded, packet-separated preliminary screen. Candidate 5 stayed unchanged and P05 stayed unopened. No candidate met the predeclared advancement rule.

- Stronger browser model: a joint 0-99 classifier scored 194/275 (70.5%) versus the compact baseline's 192/275 (69.8%), but traded 12 gains for 10 losses, regressed P02, and added no correct rescue among Candidate 5's remaining reviews. A 1.62M-parameter MobileNetV3-small attempt scored only 80/275 (29.1%). Both are rejected.
- Template subtraction: dual untouched-grayscale plus aligned-residual input scored 190/275 (69.1%), below baseline, with no unique Candidate 5 review rescue. Rejected.
- Crop containment: larger crops increase top-three diversity but substantially reduce top-one accuracy; generic containment signals are dominated by printed structure. Keep the existing on-demand larger crop only as corroborating/review evidence.
- Distillation: the key-blind TrOCR teacher scored 356/578 (61.6%) on the current raw continuous crop export. Hard-read-assisted packet crossfit reached 194/275 (70.5%) but regressed P02 and supplied no unique correct Candidate 5 review rescue. Reject this teacher-target formulation. A future distillation attempt first requires the same stitched/cleaned teacher view that performs well in Candidate 5.
- Writer adaptation: nearest-prototype adaptation remains rejected because its zero-error automatic gate accepted nothing and teacher-confirmed prototypes created held-out errors.
- Latency: yellow-only extra-frame zone extraction produced identical P08 evidence/output, but eight matched WebKit runs were 0.16% slower overall and 0.78% slower to local readiness. A 0.75-scale registration attempt did not complete within 120 seconds versus the 13.5-second control. Both experimental paths were removed from app code. Candidate 5's existing shared-frame/deferred path remains best.

Reproducible scripts and reports are listed in `docs/SCANGRADE_SIX_WORKSTREAM_RESEARCH_LEDGER.md`. The practical conclusion is not that better local recognition is impossible; it is that none of these cheap variants supplies the required jump. The next technically credible model experiment is gated on exporting stronger stitched/cleaned grayscale teacher inputs, verifying that TrOCR is actually strong on that exact view, then considering soft-feature/logit distillation. Do not deploy or spend P05 on the current research candidates.

Final verification passed 114/114 JavaScript tests, production build, `git diff --check`, 33-layout audit with zero errors, and 11/11 P05 freeze identities. The two 54 MB P08 latency replay directories were copied to the Rugged drive, recursively compared with zero differences, and removed locally; their compact reports remain in `private-evidence/reports/`.

## 2026-07-16 stitched-review private beta 6 release candidate

- Candidate 5's automatic recognition/promotion path is unchanged. The accepted change affects only a teacher-requested second opinion for answers that remain yellow.
- The rejected primary-evidence experiment used stitched original-grayscale crops for automatic strong-model consensus. It stayed safe but regressed to 237/275 automatic (86.2%), so it was removed.
- The accepted implementation sends one selected-frame stitched original-grayscale answer crop only after the teacher requests another reader. The result is review-only and cannot automatically grade or override.
- Exact 40-page control/candidate parity passed: all 40 pages had identical automatic evidence and final output; both scored 251/275 automatic and correct on the fresh replay. Continue to publish the frozen conservative Candidate 5 figure of 250/275 (90.9%) until prospective evidence exists.
- On the 24 fresh yellow answers, stitched strong recognition was correct on 13 versus 9 for continuous-frame evidence. A 0.99 stitched-suggestion display threshold showed four differing suggestions and all four were correct retrospectively; at 0.98 one of five would have been wrong.
- WebKit iPad emulation reduced the on-demand strong wait from about 3.50 s to 1.30 s; a warm Chromium run was about 0.40 s and a cold CPU-only run about 2.75 s. These remain controlled timings, not physical old-device claims.
- The both-services-unavailable test passed: local grading, yellow review, manual correction, and recovery remained usable with no token leakage or grade effect.
- Final validation passed 115/115 JavaScript tests, the standard production build, the pruned GitHub Pages build, and `git diff --check`.
- Private Tailnet default: enabled. Public GitHub Pages: unchanged/local-only. Feature rollback: `?v3StitchedOnDemandReview=0`; whole-candidate rollback: `?consensusCandidate=0`.
- Release report: `docs/SCANGRADE_STITCHED_REVIEW_PRIVATE_BETA6_20260716.md`.
- P05 is still sealed. Candidate 5's old freeze remains historical evidence; create a new Candidate 6 freeze after the final release commit before scanning P05, because the live private build identifier and source hashes will change even though automatic outputs are replay-identical.

### Candidate 6 deployment and recovery record

- Source commit `b7a5df488836ec3b3e1010bec3979bf714f1d76e` was pushed to `origin/autobuild/safe-20260223`.
- The private Tailnet URL returned HTTP 200 and served build `2026.07.16-stitched-review-private-beta-6`; `/review-model/health` reported the MPS TrOCR adapter healthy and offline, and `/v3-compact/health` reported the compact ONNX service healthy.
- The public GitHub Pages behavior was not changed or deployed; it remains local-only by default.
- P05 remains sealed and is now frozen against Candidate 6 at `private-evidence/protocols/p05-prospective-candidate6-freeze-20260716.json`; all 16 recorded file identities verified. Use the URL with no query string and no research flags.
- Candidate 6 was backed up at `/Volumes/Tony's Rugged HD/Codex/ScanGrade Offloads/2026-07-16-stitched-review-private-beta6/`. The 577 MB backup contains a verified complete Git bundle, the three exact replay directories, score/parity reports, P05 freeze, private model identities, and recovery scripts.
- After recursive byte comparison and Git-bundle verification, the three bulky replay directories (about 540 MB total) were removed locally. Their score/parity reports remain local; full replays restore from the Rugged backup.
- Deployment record: `docs/SCANGRADE_STITCHED_REVIEW_PRIVATE_BETA6_DEPLOYMENT_20260716.md`.

## 2026-07-16 crop/layout browser-local candidate falsification

- Candidate 6 remained unchanged, P05 remained sealed, and no production behavior was modified or deployed.
- A truth/output-blinded geometry audit found visible crop/layout failure in 13/19 packet-held-out TrOCR-small misses versus 5/19 matched successful controls. Fourteen of 18 flagged cases were number bonds.
- Existing key-blind containment features reached 83.3% sensitivity and 80.0% specificity under packet-held-out threshold selection. This is useful for routing alternate evidence, not choosing an answer.
- The existing 4%-down number-bond view improved TrOCR-small from 12/22 to 14/22. Nine bounded variants showed that larger general expansion is harmful. A detector-routed analysis reached 15/22, but the selector is not prospectively calibrated.
- A separately trained shifted-view specialist also reached 15/22, but fell to 233/275 if used globally. Among eight current number-bond reviews it fixed two and was wrong on five others. It remains review-only evidence.
- Non-destructive template residuals failed: direct answer-zone residual 86/275, bounded context residual 64/275, and residual-augmented held-out P02 57/68 versus 58/68 control. Printed-line subtraction still erases overlapping pencil.
- Decision: preserve original stitched grayscale; retain the containment detector and small downward crop as research/review evidence only; reject global crop expansion, print subtraction, global specialist replacement, and automatic shifted-read selection.
- Full report: `docs/SCANGRADE_CROP_LAYOUT_LOCAL_CANDIDATE_RESULT_20260716.md`.

Next action: freeze this branch. The cheapest decisive continuation is prospective new-student crop-containment and alternate-view scoring with policy frozen before truth. Do not spend P05 on this candidate.

## 2026-07-16 browser-only yellow-gap audit

- Reconstructed the exact no-Mac baseline from the 40-page Candidate replay: 176/275 automatic (64.0%), 176/176 correct, 99 yellow. Older non-development scans were 69.2%, which explains the earlier approximate 70% description; do not combine the corpora into one benchmark.
- Audited all 99 browser yellows visually and from their saved debug stages. The large grayscale reader got 87/99 right, browser local read was already right on 17, coherent named browser preprocessing produced the full correct answer on 55, and per-slot variant tops contained the truth on 92. Most yellows retain usable camera information but lose or mishandle it in the 28×28 conversion/model/selector path.
- Exact mutually exclusive partition: 17 correct browser reads blocked by safety; 37 wrong browser reads where large grayscale and a coherent browser variant were correct; 34 wrong browser reads where large grayscale was correct but no coherent browser variant was; 6 wrong browser/large reads with a coherent correct browser variant; 5 wrong browser/large reads with no coherent correct variant.
- Crop/capture quality does not generally separate yellow from automatic: 35/40 pages contain both cohorts from the same capture, and measured quality-statistic AUCs were 0.459–0.538. Real crop/layout failures concentrate in number bonds and optional-slot layouts. Browser coverage: row 113/160 (70.6%), non-row 63/115 (54.8%), number bonds 7/22 (31.8%).
- Falsified a tempting local-only rule. Exact browser-plus-compact agreement on recent arithmetic rows looked like 9/9 safe rescues, but historical validation/holdout gave 2 correct and 3 wrong; reject and do not deploy.
- No production policy changed. Candidate 6 and the sealed P05 freeze remain intact. Future no-Mac work should use a materially stronger whole-answer browser model over exact browser-rendered larger grayscale plus slot/layout metadata; the tested 6.4 MB compact model is fast enough but not accurate/calibrated enough.
- Full report: `docs/SCANGRADE_BROWSER_ONLY_YELLOW_GAP_AUDIT_20260716.md`. Reproducible outputs: `private-evidence/reports/browser-only-gap-audit-20260716.json`, `private-evidence/reports/browser-compact-agreement-falsification-20260716.json`, and the 15 private visual contact sheets under `private-evidence/reports/browser-only-yellow-visual-audit-20260716/`.

## 2026-07-16 browser-local TrOCR-small shadow and crop-falsification checkpoint

- Built the requested materially stronger Mac-independent whole-answer browser candidate. The packet-held-out model remains 244/275 (88.7%): rows 149/160, non-rows 95/115, Candidate 5 residual yellows 16/25, and number bonds 12/22. It consumes the preserved stitched grayscale answer and never receives an answer key.
- Integrated an explicit off-by-default, review-only browser shadow lane. It attaches layout family, physical slot count, maximum handwritten digits, and declared optional-slot indices; unknown/nonnumeric/overlength output is rejected, and only declared optional slots can be inferred blank. It runs one yellow answer per disposable worker with a timeout and cannot affect grades.
- Chromium and WebKit exact-token tests passed, including eight sequential disposable workers and forced non-SIMD. Warm execution is about 1.5 seconds per yellow including per-answer initialization; non-SIMD is about 3.2 seconds. The 25 opened-data yellows produced identical browser reads across engines. Physical old-iPad sustained memory/download/camera testing is still required.
- Fresh 40-page feature-off replay matched restored Candidate 6 on all 40 evidence and output pages. Candidate 6 remains deployed commit `b7a5df4`, and P05 remains sealed.
- Exact packet-held-out scoring on the 99 browser-only yellows is 80/99 (80.8%): row 42/47 and non-row 38/52. The new model is wrong on 12 of 176 answers the current browser safely accepts, so it must never override an accepted result.
- Four verified whole-answer blanks were all hallucinated as digits by the model. Optional-slot inference is structurally implemented, but whole-answer blank/erasure/cross-out automation remains unproved and must stay yellow.
- Global cleaned crops were rejected: 236/275 versus 244/275, with 6 rescues and 14 regressions. A packet-crossfit crop selector rescued 1 and regressed 2. Mixed original/clean training fell to 56/68 on P02 and 3/8 Candidate 5 reviews.
- Visual audit of the 19 whole-answer misses among browser yellows found roughly 12 with visibly clipped/mispositioned strokes or dominant number-bond frames. The existing 4%-down number-bond view improved raw top-one from 12/22 to 14/22 but made two regressions; shifted-view training fell to 50/68 on P02 and did not improve shifted P02 number bonds. Keep alternate crops as disagreement/review evidence only.
- TrOCR-small plus compact exact agreement is not safe: historical browser-yellow falsification contains known wrong agreements. Raw model confidence also remains unsafe above 0.999.
- No deployment, commit, push, automatic-policy change, or P05 access occurred. Full result: `docs/SCANGRADE_BROWSER_LOCAL_TROCR_SMALL_RESULT_20260716.md`.

## 2026-07-17 Candidate 6 / P05 readiness rehearsal

Date / thread: 2026-07-17, final preparation before Tony scans locked packet P05.

What changed:
- No recognition, capture, confidence, model, threshold, worksheet layout, or deployed Candidate 6 behavior changed.
- Added a reproducible Candidate 6 freeze verifier and a generic scorer for rehearsing the prospective path on an already-open packet.
- Corrected two scorer-integrity assumptions found by rehearsal: `affectsGrade` is false on a complete page when no promotion was applied, and teacher-facing question annotation state—not a retained physical-slot flag—determines whether a resolved whole answer is still yellow.
- Added a one-shot P05 scan checklist, a prediction-blinded two-pass truth protocol, create-only blank 70-answer truth templates, and a hash freeze for all P05 execution/scoring tools.
- Added a tiny debug-image extraction utility for visually checking the rendered marked sheet.

Evidence used:
- Frozen Candidate 6 source commit `b7a5df488836ec3b3e1010bec3979bf714f1d76e`, build `2026.07.16-stitched-review-private-beta-6`.
- Live private URL `https://hobbes-mac-mini.tail9a3379.ts.net/` and both same-origin model health routes.
- The already-open, independently verified P02 ten-page packet and its three saved burst frames per page. P05 remained sealed, unscanned, and unseen.
- Candidate 6 rugged backup at `/Volumes/Tony's Rugged HD/Codex/ScanGrade Offloads/2026-07-16-stitched-review-private-beta6/`.

Commands run:
- `node scripts/verify_candidate6_p05_readiness.mjs`.
- Full ten-page live WebKit/older-iPad-emulated P02 replay through Candidate 6, with three retained saved frames per page, then `node scripts/score_prospective_rehearsal.mjs ...`.
- One full-debug number-bond replay plus extraction/visual inspection of `markedSheetDataUrl`.
- `node scripts/test_local_first_failure_recovery.mjs`.
- `node scripts/test_local_first_webkit_ipad.mjs`.
- `node --test tests/p05-prospective-candidate.test.mjs tests/v3-production-runtime.test.mjs tests/v3-review-suggestion-display.test.mjs`.

Results:
- Candidate 6 freeze verification passed 16/16 identities. Live private root returned HTTP 200; strong and compact services were healthy.
- P02 rehearsal completed all 10 unique pages and 70 answer records. Of 68 scorable answers, 60 were automatic and 60/60 matched handwriting: 88.2% overall coverage, rows 36/40 (90.0%), non-rows 24/28 (85.7%), zero confident transcription errors, eight yellows. All prospective rehearsal gates passed after the scorer clarification.
- The questioned number-bond `19` is rendered correctly as a red X (confident transcription, mathematically wrong), not yellow. The internal slot flag was harmless metadata; the marked sheet and question-level annotation are correct.
- Both-optional-services-down recovery passed every gate: local grading completed, no automatic promotion occurred, local output stayed unchanged, a clear unavailable message appeared, manual correction worked, and the token did not leak.
- WebKit older-iPad emulation passed every gate. Controlled timing on one difficult page: app ready 1.00 s, local result 6.11 s, compact choices 9.87 s, strong context prepared 14.90 s, teacher-requested strong response 3.03 s. This is emulation, not physical-old-iPad proof.
- P05 execution scorer tests now pass 7/7; combined targeted suite passes 20/20. Candidate 6 recognition remains unchanged.
- Local disk has about 4.4 GiB available; Rugged has about 333 GiB. The saved 2026-07-14 debug corpus is 1.1 GiB. Avoid further bulky local replays before P05.

Important QR correction:
- The printed worksheet QR payloads currently point to `https://scangradesheets.github.io/draft1/`, which opens the public local-only app if scanned with the iPhone Camera app.
- For P05, Tony must manually open `https://hobbes-mac-mini.tail9a3379.ts.net/`, verify the exact Candidate 6 build label and no query string, then tap **Start Scan**. Candidate 6 will read the photographed page QR internally to select the layout.
- Do not change public/QR routing before P05; doing so would change the frozen candidate.

Files changed:
- `scripts/verify_candidate6_p05_readiness.mjs`
- `scripts/score_prospective_rehearsal.mjs`
- `scripts/score_p05_prospective_candidate.mjs`
- `scripts/extract_debug_image.mjs`
- `scripts/create_p05_truth_templates.mjs`
- `scripts/freeze_p05_execution_tools.mjs`
- `tests/p05-prospective-candidate.test.mjs`
- `docs/SCANGRADE_P05_SCAN_CHECKLIST_20260717.md`
- `docs/SCANGRADE_P05_BLINDED_TRUTH_PROTOCOL_20260717.md`
- private readiness/rehearsal reports and P05 templates/freezes under `private-evidence/`.

Rollback point:
- Live Candidate 6 remains frozen source commit `b7a5df4`; deployment record branch tip is `2c180ef`. Public GitHub Pages is unchanged. No deployment, commit, push, or production modification occurred in this readiness work.
- P05 execution/scoring tool identities are frozen at `private-evidence/protocols/p05-execution-tools-freeze-20260717.json`.

Next action:
1. Tony follows `docs/SCANGRADE_P05_SCAN_CHECKLIST_20260717.md` and scans intact P05 exactly once through the manually opened private Candidate 6 link.
2. Freeze all ten successful capture/debug records before any corrections, truth inspection, or scoring.
3. Create two independent prediction-blinded truth passes, adjudicate without the answer key, freeze truth, then run the create-only prospective scorer once.

Open risks:
- P05 still requires Tony's physical scan. Nothing in this rehearsal authorizes rescans to improve a result.
- Physical old-iPad multi-page camera/memory/thermal behavior remains unproved; WebKit emulation passed but is not equivalent.
- The private strong service depends on the Mac mini, but verified fail-open behavior means an outage increases yellow/manual review rather than stopping local grading.
- A single 70-answer packet can falsify Candidate 6 but cannot establish a market-ready zero-error claim or a narrow confidence interval.

## 2026-07-17 P05 physical scan completed; summary recovery required

Date / thread: 2026-07-17, immediately after Tony scanned all ten physical P05 pages through Candidate 6.

What happened:
- Tony completed all ten pages and reported several visible product observations: repeated child-written reversed 9s resembling `P`; some yellow review circles not centered on the visible answer; useful delayed improvements from the Mac-mini reader without adequate “still thinking” feedback; and a yellow-correction interface that can obscure the handwriting.
- No new full debug bundles appeared under `private-evidence/debug-scans`. The private no-query URL did not establish debug auto-upload on this phone/origin. This is a test-preparation failure: the checklist verified the frozen build but did not verify device-side debug persistence before spending P05.
- Candidate 6 guest mode should still have stored one compact submission summary per successful page in the phone browser under `scangrade.savedSubmissions.v1`. Those records contain final answer groups, review states, scores, timings, template IDs and suggestions, but not full captured images/frames/crops.

Recovery action:
- Added a read-only same-origin recovery page at `https://hobbes-mac-mini.tail9a3379.ts.net/p05-recovery.html`.
- The page reads only the saved-submission storage key, reports the count/templates, and downloads an exact JSON wrapper including the raw storage value. It does not grade, upload, modify or delete records.
- Live Tailnet retrieval and visual browser loading passed. The in-app browser correctly showed its own empty-origin state; Tony must open it in the same Safari/browser on the same phone used for scanning.
- Tony must not clear ScanGrade's queue, Safari website data, or the original ScanGrade tab before recovery.

Integrity consequence:
- First recover and freeze the original ten submission summaries. Do not change recognition policy based on Tony's observations before that recovery.
- If ten distinct P05 templates are recovered, transcription coverage/error scoring may still be possible from the original final answer groups after blinded truth is created. Capture/crop/annotation forensics will not be possible from those compact records alone.
- Any later rescan must be explicitly classified as forensic/development evidence and must not silently replace the original one-shot P05 outcome.

Next action:
1. Tony opens the recovery page in the same phone/browser and downloads/attaches the JSON.
2. Verify ten records and ten distinct layouts; freeze/hash the recovered file immediately.
3. Decide the least-contaminating way to obtain full-page truth and crop evidence without replacing the original performance outcome.
4. Only then analyze reversed digits, crop/annotation placement, delayed-result feedback, and the correction workflow as separate failure classes.

### P05 original summaries recovered and frozen

- Tony attached `scangrade-p05-original-scan-summaries-1784294995983.json`. Exact source SHA-256: `bf81c96a3cb76b197d4a05fd1b6c3487329767aabfc58cc31b2dd999656f26af`; 646,568 bytes.
- The ten newest records are a single uninterrupted July 17 sequence from `13:14:52.827Z` through `13:19:29.772Z`. They contain exactly one of each expected layout, 70 answer groups, and zero manual corrections. The next older record is from July 14, so the selection boundary is unambiguous.
- Create-only freeze: `private-evidence/p05-prospective-20260717/`, produced by `scripts/freeze_p05_recovered_summaries.mjs`. Both frozen files reverified against their manifest.
- The freeze was copied to the Candidate 6 Rugged backup under `p05-original-20260717/`; checksum-mode rsync reported zero differences.
- Pre-truth coverage only: 48/70 automatic (68.6%), 22 yellow; rows 30/40 automatic (75.0%), non-rows 18/30 (60.0%). Number bonds were 1/6 automatic and 5/6 yellow. This is not transcription accuracy. The saved worksheet-key agreement is math grading and must not be used as handwriting truth.
- Saved page processing time was 1.421–5.238 seconds, median 3.664 seconds, mean 3.525 seconds. This excludes any later teacher-requested strong-review wait.
- Full original captures/frames/crops/annotation geometry were not present in the recovered summaries. A second Debug Scan is now permitted only as explicitly labeled forensic evidence for handwriting truth, crop inspection, capture variability and UX study. It must never replace the frozen original outcomes.

## 2026-07-17 P05 forensic safety and answer-card repair candidate

- The frozen original one-shot outcome remains 48/70 automatic (68.6%), 22 yellow; a full-resolution visual audit found all 48 automatic reads matched the handwriting. The later forensic scan is development evidence only.
- The full-debug rescan's immediate browser result was 42/70 automatic and 42/42 matching the visual audit. Its final strong-model result was 55/70 automatic (78.6%) with one genuine confident transcription error: row 04 QF, visible `17` promoted to `12`. The independent compact reader read `17` at about 99.98% while the affected browser slot was high-risk and preprocessing-disputed.
- The other two red-styled review cases were row 04 QG (`11` vs visible `16`; the whole-answer readers both proposed the also-wrong `17`) and number-bond 08 QC (`11` vs visible `14`; both whole-answer readers proposed `14`). These were internally review-needed but styled as incorrect/red.
- Candidate repair in `src/v3/consensus-promotion.js`: policy `consensus-promotion-shadow-3`; unconditional retained-material-rival veto; a narrow high-risk-browser plus >=0.99 compact-conflict veto that cannot re-enter through core crops; and a key-blind display-review veto when both independent whole-answer readers agree against the browser.
- Candidate UI repair in `src/components/CameraCapture.vue`: review state now drives cards, annotations, and overlays consistently; ordinary confidently transcribed incorrect math remains red; evidence-backed transcription disputes remain yellow.
- Answer cards now follow physical worksheet slot metadata. Single-box number bonds display one box/token; genuine two-slot answers display two.
- Counterfactual exact-saved-decision result after the unsafe QF promotion becomes yellow: 54/70 automatic (77.1%), 54/54 matching the single visual truth audit, 16 yellow; rows 34/40 and non-rows 20/30. This is not prospective evidence.
- Fresh full saved-image replay: 48/70 automatic, 48/48 matching visual truth, 22 yellow. Fresh replay geometry/output varied from the live forensic run, so its coverage is not substituted for the live result. A focused replay verified safety-veto yellow rendering and number-bond one/two-slot formatting.
- Limitation: optional whole-answer readers still run only on initially yellow answers. The display repair handles the observed saved-evidence cases but cannot expose a confident browser-only error when no independent evidence is requested. Recognition/replay variability remains open.
- Verification: 128/128 JavaScript tests, production build, and diff check passed. Nothing deployed, committed, or pushed in this checkpoint.
- Disk recovery: five P05 safety replay folders were copied to `/Volumes/Tony's Rugged HD/Codex/ScanGrade Offloads/2026-07-17-p05-forensic-safety-replays/`, each checksum-compared with zero differences, then bulky local copies were removed. Compact `rows.json`, `summary.json`, and `summary.md` remain locally for replay 4 and the focused final UI replay.
- Durable report: `docs/SCANGRADE_P05_FORENSIC_SAFETY_AND_UI_RESULT_20260717.md`.

### 2026-07-17 identical-input and retained-frame follow-up

- Two production-matched ten-page replays of identical image files matched on geometry, predictions, answer groups, review state, and annotation regions. The apparent identical-input variability came from runtime timing fields and a random annotation decoration seed, not grading behavior. Annotation seeds are now derived deterministically from result evidence; a focused A/B replay matched fully.
- Each phone scan captured eight frames and retained three; all selected frames cleared focus and perspective gates. Independent replay of all 30 retained frames showed 42/70 raw top-one correct for the whole-page selected frames, 47/70 for the best single frame per page chosen with truth hindsight, 50/70 for an impossible per-answer truth oracle, and 39/70 for simple three-frame majority.
- Conclusion: alternate frames sometimes contain useful pixels, but whole-page focus, stricter capture thresholds, and majority voting do not identify the better answer safely. Do not raise the capture gate on this evidence. Recognition/candidate selection remains the dominant bottleneck, with number-bond crop/layout failures concentrated separately.
- An experimental attempt to run the strong path over every red answer was rejected: it added work and did not safely eliminate the broad raw replay errors. Keep the strong path yellow-only plus the narrow P05 ambiguity/conflict safety veto.

### 2026-07-17 P05 safety private beta 7 deployed

- Source commit `2a6c8c5` was pushed to `origin/autobuild/safe-20260223`.
- Live private build: `2026.07.17-p05-safety-private-beta-7`; runtime release: `p05-safety-private-beta-7`.
- Live source and both same-origin services verified: strong TrOCR adapter healthy/offline/key-rejecting; compact continuous-answer service healthy.
- Shipped scope is narrow: the demonstrated P05 ambiguity/conflict veto, consistent yellow/card/annotation state, physical-slot card formatting, deterministic annotation seeds, and preserved off-by-default research harnesses. The rejected all-red model screen and unproved stricter capture gate were not shipped.
- Release verification: 130/130 JavaScript tests, production build, pruned GitHub build, and diff check passed. Public GitHub Pages was not redeployed.
- Rugged recovery: complete Git bundle through `003bec5` plus the active handoff and both Beta 7 reports at `/Volumes/Tony's Rugged HD/Codex/ScanGrade Offloads/2026-07-17-p05-safety-private-beta7/`; bundle verification passed.
- Deployment record: `docs/SCANGRADE_P05_SAFETY_PRIVATE_BETA7_DEPLOYMENT_20260717.md`.

### 2026-07-17 P05 generalization, physical annotations, and live-marking beta 8 candidate

- P05 remains a failed prospective generalization test. Original one-shot: 48/70 automatic (68.6%), 48/48 matching the handwriting audit. Beta 7 repaired forensic-rescan estimate: 54/70 automatic (77.1%), 54/54 matching, 16 yellow. Do not substitute the retrospective estimate for the original result or market either as 90%.
- Key-blind adapted-TrOCR matched-view test on all 70 P05 answers: continuous grayscale 54/70; stitched physical slots 42/70; oracle either view 59/70. Stitched evidence that helped prior packets regressed sharply on P05 and is rejected as a global primary view.
- The 16 repaired residuals are predominantly clear-image recognition/selection disagreements, unfamiliar writer shapes (including three reversed-9/P forms), and number-bond print/slot interference. Number-bond Q4 contains a complete `6` and Q5 a complete `17` in the continuous grayscale crop. Capture blur/perspective is not the main missing-coverage cause.
- A narrow shadow selector requiring 2/3 grayscale-frame agreement plus stitched agreement, while retaining every ambiguity/safety veto, was 3/3 on historical residuals and 2/2 on P05. Five cases are insufficient for automatic use. The broader near-90% rule remains rejected because it admits the overwritten `34 -> 39` error.
- Annotation drift was traced to preferring template `expectedRect` before detected `boxRect`. Across 120 P05 slots the center drift averaged 34.1 canonical pixels (0.27 box widths); 45 exceeded 0.25 box widths and 22 exceeded 0.5. The candidate now anchors to physical boxes first and preserves only small deterministic natural wobble/angle/stroke variation.
- Student results now reveal the exact final annotation image one settled question at a time while stronger review runs. Yellow answers and all questions still queued for safety/strong review are excluded until final. WebKit deliberately delayed the large reader: a confirmed mark appeared, two queued questions remained hidden, the provisional final image stayed hidden, and the final marked page replaced the animation cleanly.
- Validation: 135/135 repository tests, production build, pruned GitHub build, and diff check pass. WebKit evidence: `private-evidence/reports/progressive-marking-webkit-20260717.json`.
- Build candidate label: `2026.07.17-physical-annotations-live-marking-beta-8`; recognition runtime remains unchanged `p05-safety-private-beta-7`.
- Full technical report: `docs/SCANGRADE_P05_GENERALIZATION_ANNOTATION_AND_PROGRESSIVE_MARKING_20260717.md`. Deployment record draft: `docs/SCANGRADE_ANNOTATION_AND_LIVE_MARKING_PRIVATE_BETA8_DEPLOYMENT_20260717.md`.
- Public domain check: `scangrade.io` currently does not resolve from an unrestricted DNS/network check. The repo has a Cloudflare Pages scaffold, but no safe authenticated public gateway to the home-Mac model is deployed. Public hosting should remain browser-only until a session/auth, origin, rate-limit, request-size, and no-retention boundary exists.
- Beta 8 source commit `021305d` and deployment-record commit `65f6cc7` are pushed. The private Tailnet root, build label, adapted MPS reader health, and compact-reader health all verified.
- Beta 8 recovery was copied to `/Volumes/Tony's Rugged HD/Codex/ScanGrade Offloads/2026-07-17-physical-annotations-live-marking-beta8/`. The Git bundle verified as complete and all copied reports/evidence matched source SHA-256 hashes.

### 2026-07-17 Cloudflare browser-only public Beta 8

- Tony confirmed the intended domain is `scangrade.io` and authenticated the Cloudflare account with Wrangler OAuth.
- Cloudflare Pages project `scangrade` now serves the clean Beta 8 static build from Git source commit `478d92d` at `https://scangrade.io/`, `https://scangrade.pages.dev/`, and immutable deployment `https://a5b4bc89.scangrade.pages.dev/`.
- The custom apex domain is active and returned HTTP 200 with Beta 8 asset `assets/index-Bokf8J_g.js`.
- This is deliberately browser-only. No Pages Functions, D1 binding, public Mac-Mini proxy, or submission backend was deployed. Requests to `/review-model/health` and `/api/submissions` returned byte-identical static SPA homepages, proving those routes are not exposed services.
- Public response headers include camera restriction to self, SAMEORIGIN framing, nosniff, and strict-origin referrer policy.
- Existing worksheet QR codes were not rewritten. Future generated sheets can target `https://scangrade.io/` only after an explicit QR migration and scan test.
- Official Cloudflare agent skills and MCP entries were installed, but Codex must be restarted to load them. Wrangler administration works. MCP OAuth was not bypassed after macOS blocked the bundled CLI executable.
- Durable deployment record: `docs/SCANGRADE_CLOUDFLARE_BROWSER_ONLY_PUBLIC_BETA8_20260717.md`.

### 2026-07-17 Cloudflare blank-screen incident repaired

- Tony's iPhone correctly exposed a production deployment fault: the loading screen appeared and then the page became blank.
- Root cause was not Safari or the application runtime. The first Cloudflare deployment accidentally used the GitHub Pages build, so the HTML requested modules and other assets below `/draft1/`. On `scangrade.io`, those missing paths returned the SPA HTML fallback instead of JavaScript.
- Rebuilt the exact clean Beta 8 source commit `478d92d` with Vite base `/` and the public asset-pruning gate, then redeployed. Current production deployment: `f3d5ea39-e2ed-47c7-9f84-b3870837e581`, immutable URL `https://f3d5ea39.scangrade.pages.dev/`.
- `https://scangrade.io/` now references `/assets/index-CqgTxVDW.js`; it is served as JavaScript and matches the local artifact at SHA-256 `0ede0abb6eecddcb14dcb0056a08ee55b2e1490fc835bb0d77b20b58d9094813`.
- Live browser verification mounted the Beta 8 home screen and showed no console errors. The private/public boundary was unchanged.
- There is no current `/draft2/` deployment path. `draft1` was a legacy GitHub Pages prefix; current Beta 8 source lives on `autobuild/safe-20260223`, while the custom domain intentionally serves from `/`.

### 2026-07-17 difficult-writer gap-closure goal checkpoint

- Active objective: close safe automatic coverage toward at least 85% on difficult authentic handwriting while preserving zero known confident transcription errors. Production remains unchanged.
- Disk prerequisite completed: approximately 4.8 GB of reproducible debug imagery was checksum-verified on the Rugged drive and removed locally; compact results remain. See `docs/SCANGRADE_RUGGED_OFFLOAD_MANIFEST_20260716.md`.
- Frozen P05 baseline: original one-shot 48/70 automatic (68.6%), 22 yellow, 0 known confident errors. Repaired forensic development estimate 54/70 (77.1%), 16 yellow, 0 known confident errors. Residuals: 11 correct-candidate/selection gaps, four recognizer/representation gaps, and one dangerous model-family conflict (`17→12`).
- P05 capture overlap: 11 answers were yellow in both original and forensic capture, 11 only in the original, and five only in the rescan. Capture changes matter, but do not explain the stable residual majority.
- Simple number-bond line removal was rejected: untouched grayscale 4/6 versus 3/6 for border, divider, and projection masking. Destructive print removal is not the route.
- The planned larger-grayscale browser-local model was independently tested on P05 after training on P02/P03/P08/P09 and selection on older validation only. Result: 43/70 overall and 5/16 residuals; exact rerun matched. It cannot replace the strong reader.
- Teacher-confirmed neural writer adaptation was rejected. Ten confirmations reduced residual performance to 3/16 and twenty to 2/16. Reversal profiles must remain explicit student-scoped review aids; unconfirmed reversed digits remain yellow.
- Promising strict shadow selector: require current-yellow status, continuous/stitched selected-frame TrOCR agreement, agreement with at least two non-tied retained-frame reads, slot-compatible length, both selected-view token floors >=0.3, every existing confidence/ambiguity/conflict veto, and material support from a packet-held-out local model (top three, probability >=0.05). Truth is joined only after selection; no answer key enters recognition.
- A scorer audit caught and repaired an initially missed nested ambiguity veto before any app change. With all vetoes correctly applied, the strict selector chose 1/1 opened historical residual and 4/4 P05 residuals correctly. It moves the repaired P05 development estimate to 58/70 (82.9%), not 85.7%, and blocks the dangerous `17→12`.
- A separate hypothesis that clears only nested `override-retained-material-rival` flags when the top-level reason is non-hard and all multi-view/local support passes selected two additional correct P05 reads (`18` and `40`), reaching 60/70 (85.7%). This clearance rule was designed after P05 truth and must not be implemented without prospective falsification.
- Exact duplicate collapse plus local top-three support matched 16/16 pattern cases and would read P05 number-bond `1717` as `17`, but that answer retains a nested ambiguity veto. It remains yellow.
- Important limitation: all rules were identified after P05 truth was opened; historical packets also influenced development. Five strict selected answers cannot support a deployment claim. Keep the strict rule private shadow-only and the clearance variant analysis-only until a prospective packet or September data falsifies them.
- Durable scripts/reports: `scripts/audit_p05_gap_closure.py`, `scripts/build_p05_number_bond_print_variants.py`, `scripts/evaluate_p05_writer_adaptation.py`, `scripts/analyze_p05_local_model_topk.py`, `scripts/screen_multiview_local_support_selector.py`; reports under `private-evidence/reports/*20260717.json` including `multiview-local-support-selector-screen-20260717.json`.
- Next work: investigate structural de-duplication/length handling for number-bond `17→1717` as review evidence; formalize the student-scoped reversal suggestion contract without auto-acceptance; add the selector only to an off-by-default shadow path with tests; then run full safety and reproducibility regressions. Do not deploy recognition changes yet.

### 2026-07-17 gap-closure historical falsification and final safety decision

- The tempting 85.7% P05 clearance estimate is rejected. A new falsification set used 40 manually labelled answers from historical holdout packets H07/H08 that were excluded from local-model training and selection.
- Continuous and stitched strong-reader views agreed on 19 answers: 17 correct and two wrong. Requiring packet-external local top-three support at probability >=0.05 retained 14: 13 correct and one wrong.
- The retained error is real and visually clear: `H|82.7`, handwritten `16`, read as `15` by continuous TrOCR (0.935718), stitched TrOCR (0.643216), and the local model (top one 0.900121). The open-loop child-written `6` shares a writer-specific failure across model/crop views.
- These old captures have no authentic adjacent burst frames, so this cannot validate or exactly replay the strict selector's frame-stability condition. It does decisively show that the model/view stack is not independent enough to clear an existing ambiguity veto merely because it agrees.
- A packet-scoped teacher-confirmed normalized-shape prototype was also tested as a veto-only upper bound. It caught both wrong unanimous reads but challenged 11 correct reads, so generic shape matching is rejected. The existing reversal profile remains a review-only suggestion contract: explicit confirmation, packet scope, no identity, no automatic acceptance.
- Final recognition decision for this goal: preserve all hard and nested ambiguity vetoes; do not deploy the selector, duplicate collapse, local model, line removal, or writer adaptation. The strict P05 shadow result remains 58/70 (82.9%) with zero observed errors, but it is post-truth development evidence, not a product metric or release candidate.
- Reproducible evidence: `scripts/screen_historical_manual_holdout_local_support.py`, `private-evidence/reports/historical-manual-holdout-local-support-screen-20260717.json`, `scripts/evaluate_writer_prototype_veto.py`, and `private-evidence/reports/writer-prototype-veto-screen-20260717.json`.

### 2026-07-18 teacher-pen-stroke Beta 9 candidate

- Tony approved replacing Beta 8's whole-mark fade/reveal with teacher-like physical pen motion. Checkmarks are now one uninterrupted left-to-right stroke through the check's corner; X marks use two sequential crossing strokes.
- The implementation animates an SVG mask over the exact final raster annotation rather than drawing a second approximate mark. This preserves the existing physical-box placement, seeded natural variation, ink texture, and final annotation exactly, with no end-of-animation position jump.
- Recognition, grading, confidence policy, crops, capture, strong-review routing, and final annotation geometry are unchanged.
- Reduced-motion behavior remains immediate. A check finishes in 500 ms; an X uses two 270 ms strokes with the second beginning after 210 ms. The existing 620 ms per-question cadence therefore never advances before the mark is complete.
- Focused unit tests prove a check contains exactly one continuous path and an X exactly two. Production build passes. The real WebKit/mobile delayed-review test passed all gates, including single-stroke check presence, pending-question concealment, final-image concealment, and clean completion. Evidence: `private-evidence/reports/progressive-marking-webkit-20260717.json` and `.png`.
- Release label: `2026.07.18-teacher-pen-strokes-beta-9`.
- Implementation commit `0b7d4c0` and release commit `fd9afcf` were pushed to `autobuild/safe-20260223`. A clean archive of the release commit was built with root-domain base `/` and the deploy-only public asset prune.
- The final upload was performed from a directory containing only the static `dist` files. The first upload was superseded immediately because Wrangler detected the repository's dormant Functions folder beside `dist`; direct checks showed no active submission endpoint, but the static-only upload removed the ambiguity entirely.
- Final static-only deployment URL: `https://1dc14fa5.scangrade.pages.dev/`; custom production domain: `https://scangrade.io/`.
- A fresh WebKit session mounted the production ScanGrade home screen with the final Beta 9 label and no console or page errors. `/api/submissions` and `/review-model/health` returned files byte-identical to the static homepage (SHA-256 `e2b27bc42798533d3b570721e5cd07ff29e55895fd30c270335cf5d11188183c`), confirming that neither a backend nor the Mac Mini was exposed.

### 2026-07-18 correction-integrity Beta 10 candidate

- Tony's live Beta 9 testing exposed two unacceptable teacher-correction failures. A one-box number-bond correction could grade from teacher-entered `9` while the raster annotation retained the old OCR `1`. On two-slot answers such as `30` and `49`, correcting only the yellow digit could retain a hidden wrong OCR digit and leave the complete answer red.
- Root cause: grading text, per-slot predictions, stored manual-correction cells, and raster replacement text were not governed by one correction contract. Multi-slot review also permitted a partial-slot edit when only one slot was yellow.
- Repair: `src/v3/manual-correction-contract.js` normalizes teacher input once; the same cells/text now drive prediction updates, grading, answer cards, stored correction history, and raster replacement. Every multi-slot answer is corrected as a complete answer. One physical box that permits a two-digit handwritten token retains and draws the complete token.
- Position preservation: a lone manually typed digit in two physical boxes cannot be saved until the teacher explicitly chooses `Left blank` or `Right blank`. The UI stores `9_` and `_9` distinctly, so it never silently moves the child's writing. `No answer` explicitly confirms all slots blank and resolves yellow to an ordinary graded result. This is layout/teacher evidence, not answer-key recognition.
- Review UX: suggestions apply and close in one tap; manual input autofocuses; tapping outside closes; the popup arrow anchors to the physical answer and the rendered card does not overlap that answer. The popup still may cover unrelated worksheet content when screen space is constrained, but not the item being corrected.
- Yellow mark: old circles are replaced by a near-full-height, two-pass fluorescent chisel swipe over the physical answer box. It extends only slightly beyond the left/right edges, stays transparent enough to read pencil, and animates left-to-right. Loader/status wording now says `Grading` rather than `Marking`.
- Manual correction animation: the prior annotated image remains visible; the replacement answer is wiped in first, followed by the exact final check/X pen stroke. Reduced-motion continues to use the immediate final image.
- Recognition, capture, crop, model, confidence, answer-key separation, and automatic acceptance policy are unchanged.
- Verification: 157/157 repository tests, production build, and the real mobile WebKit flow pass. WebKit gates include early grading, pending-answer concealment, popup arrow anchoring, active-answer non-overlap, input focus, outside close, one-tap choice, complete two-digit correction/regrade, animated correction, explicit left/right blank placement, and teacher-confirmed no-answer resolution. Evidence: `private-evidence/reports/progressive-marking-webkit-20260717.json` and `progressive-marking-highlighter-webkit-20260718.png`.
- Candidate label: `2026.07.18-correction-integrity-beta-10`. Implementation commit `fa651ed` was pushed to `origin/autobuild/safe-20260223`.
- Final status-placement revision: the floating status bubble over the worksheet was removed. The existing top scan bar is now the only progress location: it says `Scanning` while capture/OCR work is active, then `Grading` only while the annotation pen strokes are being drawn. Both states reuse the same restrained fluorescent-yellow activity swipe.
- The updated real mobile WebKit run passed every correction/animation gate with the top-bar-only status. Its captured in-animation status was exactly `Grading`; the status disappeared cleanly when animation finished.
- Live transport check before deployment: `http://scangrade.io/` returns a permanent redirect to `https://scangrade.io/`; HTTPS returns 200 over TLS 1.3 with a valid `CN=scangrade.io` certificate issued by Google Trust Services and expiring 2026-10-15. No repository source or worksheet target containing `http://scangrade.io` was found. Tony's warning screenshot showed `x.com` in Safari's address bar, so it did not originate from the live ScanGrade certificate.
- Beta 10 public deployment is live at `https://scangrade.io/`; immutable Cloudflare Pages URL: `https://49b81077.scangrade.pages.dev/`. The root-domain build used Vite base `/`, the deploy prune, and a clean 221-file static-only directory. The live HTML SHA-256 is `f22a5e1903de7c424e6ba7f70d74e22db1c865a3cd025ab0e9d4d44ec18c80f6`.
- An initial Beta 10 Wrangler invocation referenced `dist` from `/tmp`, uploaded zero files, and created empty deployment `2ebb6071`. It was detected from Wrangler's `0/0` count and immediately superseded by the complete `49b81077` deployment before release completion. The production domain was then verified against the complete artifact.
- Post-deploy checks: the live JS is served as `application/javascript` and contains the exact Beta 10 label; `scangrade.io`, the immutable URL, `/api/submissions`, and `/review-model/health` returned byte-identical static HTML, confirming no public backend or Mac-Mini route; a fresh mobile WebKit session mounted `Start Scan` with the Beta 10 label and zero console/page errors.

### 2026-07-18 natural-review public Beta 11

- Live Beta 10 feedback drove the Beta 11 UI release; recognition, confidence, grading, crop, capture, and answer-key policy remain frozen.
- Yellow review marks now use deterministic fluorescent chisel geometry: near-full box height, about 1–2% side overhang, a seeded 1–3 degree stroke angle, small edge variation, and two roughly parallel end cuts derived from one simulated nib angle. The final blend is a warmer fluorescent yellow (`rgb(255, 250, 0)`) over the paper so pencil remains visible.
- Two-slot review scope was explicitly repaired and regression-tested: if only one digit is uncertain, only that digit's physical slot is highlighted; if both digits are uncertain (or the uncertainty is whole-answer level), one uninterrupted swipe spans both slots. The safer correction panel may still request the complete two-digit transcription so an unreviewed hidden OCR digit cannot survive teacher confirmation.
- The correction panel no longer opens the iPhone keyboard automatically. The keyboard appears only when the teacher taps the entry field; on focus, the panel is scrolled above the visual keyboard. Blank controls were compacted to `Blank` for one slot and `Left blank | Right blank | All blank` for two slots.
- Date placement is now metadata-driven and fail-safe. The ten frozen launch layouts declare an approved empty zone to the right of (not on) the name line, below the heading, and above the first question. Older QR-linked copies of those exact layout IDs recover the same frozen zone. Unknown layouts omit the date rather than guess.
- During `Scanning`, the date lands with a small 340 ms ink/blur animation. The scanning phase remains visible for at least 900 ms after the approved preview becomes available, then the top bar changes to `Grading` as pen-stroke annotations begin. The final date uses the same safe geometry.
- Verification so far: 163/163 repository tests, production build, and the full real mobile WebKit correction/animation replay pass. The mobile gate directly observed `18 JUL 2026` while the top bar still said `Scanning`; keyboard deferral, popup/answer non-overlap, correction integrity, manual blank handling, and progressive marks also passed.
- Release label: `2026.07.18-natural-review-beta-11`. Implementation commit `a9a0a26d6d4e39956c73647e89e5d61df3ee7d5d` was pushed to `origin/autobuild/safe-20260223`.
- The root-domain artifact was built from the exact implementation commit with the deploy prune. Existing public worksheet/QR assets and browser recovery were preserved in a 220-file static-only upload directory containing no Pages Functions, worker, route manifest, Tailscale hostname, or Mac Mini address.
- Final immutable deployment: `https://ea1d3e0a.scangrade.pages.dev/`; production: `https://scangrade.io/`. Production, immutable, and local HTML are byte-identical at SHA-256 `24c8837cece44ea849c8e2052d99861fe723ae04143ab90e115f229ef269a3c2`.
- Post-deploy verification: exact Beta 11 label, zero browser console errors, valid HTTP-to-HTTPS redirect, JavaScript MIME type, QR layout JSON availability, and static-only `/api/submissions` plus `/review-model/health` behavior all pass. Durable record: `docs/SCANGRADE_NATURAL_REVIEW_PUBLIC_BETA11_20260718.md`.
- A first successful upload at `188541ac` had correct files but incorrect expanded commit metadata. It was immediately superseded by the byte-identical `ea1d3e0a` deployment carrying the correct full source hash.

### 2026-07-18 visual blank-position review public Beta 12

- This refinement is deployed publicly at `https://scangrade.io/`. Final immutable deployment: `https://192b81e5.scangrade.pages.dev/`; exact source commit: `5d67c7464e6fb67b38f632a53bc2d54929f6e759`.
- A confidently empty worksheet-declared optional slot remains ordinary recognition evidence: it is stored as blank with `reviewNeeded: false`, receives no yellow highlight or blank-position prompt, and the complete answer receives only its normal check/X after grading. A regression assertion now explicitly protects this behavior.
- Only answers already sent to review expose blank-position controls. When a teacher types one digit for a two-slot reviewed answer, the panel now shows direct visual choices such as `9_`, `_9`, and `__`; the teacher never types an underscore. Choosing one immediately saves, regrades, closes the panel, and uses the correction animation.
- Verification: 163/163 repository tests, production and pruned builds, and the complete mobile WebKit correction flow pass. The live browser mounted the exact Beta 12 label with zero errors. Production and immutable HTML match the release artifact byte-for-byte.
- Deployment QA caught and superseded two non-final uploads: `49470d19` nested several worksheet assets one directory too deep, and `e7684c4b` corrected the paths but carried an incorrectly expanded commit hash. Final deployment `192b81e5` has correct QR asset paths and exact commit metadata.

### 2026-07-18 locked TPT worksheet-first business strategy

- Tony explicitly approved and locked the launch model: ScanGrade is first sold as competitively priced, ScanGrade-authored printable math worksheet packs on TPT. Automatic grading at `https://scangrade.io/` remains a free, anonymous companion benefit with no account required.
- Launch does not require a software subscription, authentication, rosters, persistent scan history, analytics, arbitrary third-party worksheets, district sales, or a public Mac Mini/cloud fallback.
- The public grader should remain local-first and limited to ScanGrade worksheet contracts. The paid value is the curated, attractive, curriculum-useful worksheet catalog; the free grader is the differentiator and acquisition loop.
- Catalog expansion can become low marginal effort only after a worksheet-family structure is proven. Every new family must still pass curriculum QA, layout-contract audit, answer-key/metadata agreement, QR routing, visual QA, device capture replay, handwriting-truth safety, and listing QA.
- Initial catalog scope remains Grade 1. Grades 2–6 are an expansion reservoir, not a launch promise. Advance by proven worksheet families rather than generating a large unvalidated catalog.
- Durable decision record: `docs/SCANGRADE_LOCKED_TPT_WORKSHEET_BUSINESS_STRATEGY_20260718.md`. Do not change this launch business model without Tony's explicit approval.

### 2026-07-18 single-slot review public Beta 13

- Live Beta 12 testing on a two-box mixed addition/subtraction answer exposed an over-broad correction rule: although only the right physical digit was yellow, the panel asked the teacher to reconfirm full answers such as `15`, `19`, and `75`, and placed a small `Blank answer` text action at the bottom.
- Root cause: Beta 10's correction-integrity repair intentionally forced every multi-slot review into complete-answer mode so a hidden wrong OCR digit could not survive a partial correction. Beta 13 narrows the interface while preserving the integrity mechanism.
- When exactly one physical slot is unresolved, the panel now opens that slot only, offers only single-digit candidates from that slot's key-blind OCR evidence, limits manual entry to one digit, and shows `_` in the same choice grid for “this highlighted box is blank.” The settled slot is not presented as editable.
- Applying the one-slot correction still merges it into the full cell array and atomically recomputes the complete transcription, grade, answer card, stored correction history, and raster annotation. If multiple physical slots are unresolved, full-answer mode and explicit position choices (`9_`, `_9`, `__`) remain mandatory.
- The iPadOS Cut/Copy/Look Up bar was traced to calling `select()` on input focus. Beta 13 instead places a collapsed caret at the end, so tapping the field opens the numeric keyboard without deliberately invoking text selection.
- Red X animation is now strictly sequential: top-left to bottom-right for 270 ms, then—after that stroke is complete—top-right to bottom-left. The second stroke delay increased from 210 ms to 300 ms.
- Verification: all 164 repository tests pass, including explicit X direction/non-overlap timing and the single-yellow-slot review contract; production build passes. Recognition, capture, crops, confidence policy, answer-key separation, and automatic acceptance behavior are unchanged.
- Release label: `2026.07.18-single-slot-review-beta-13`. Implementation commit `c66839d` is pushed to `origin/autobuild/safe-20260223`.
- Public production: `https://scangrade.io/`; immutable deployment: `https://835fb701.scangrade.pages.dev/`. The upload contained 219 application files plus `_headers` and no Pages Function, Worker, route manifest, Tailscale host, or Mac Mini endpoint.
- Production HTML, immutable HTML, local release HTML, `/api/submissions`, and `/review-model/health` are byte-identical at SHA-256 `c68bf8077b99d79d6beffb278c1abc992cd8faeca798867c8d544e2f11c7ffc7`, confirming that the two backend-looking paths remain static SPA fallbacks. The live JavaScript is served as `application/javascript`, contains the exact Beta 13 label, and matches the local release at SHA-256 `2e3ffa827351820b5128e86bc5d29bf90341a8c3cb2d0a7b4114d8ab64e5f4c2`.

### 2026-07-18 fixed-workspace public Beta 14

- Tony approved this as a reversible layout experiment and requested that Beta 13 remain available for immediate rollback. Beta 13's immutable rollback URL is `https://835fb701.scangrade.pages.dev/`.
- The sheet now sits directly below a compact logo/header; the Home, Login, optional recognition-view toggle, and New Scan controls sit below the sheet. Normal scanning/results use a fixed app-like viewport instead of expanding a second results section. Debug Scan intentionally retains its detailed result/export card.
- After a result, the minimal blue toggle reveals what ScanGrade read directly above each physical answer slot. Two-slot answers receive separate per-digit labels and a detected empty slot displays `_`. This is a read-only explanation layer and cannot change OCR, grading, confidence, or corrections.
- The date stamp is modestly larger for iPad readability while remaining inside the worksheet-declared safe zone. Unknown layouts still omit the date rather than guess.
- Verification: 170/170 repository tests and the exact-commit deploy-pruned build pass. Recognition, capture, crop, confidence, grading, answer-key separation, and correction integrity remain unchanged.
- Release label: `2026.07.18-fixed-workspace-beta-14`; implementation commit: `0ff92a4a32f389c251dfcaf87470ebee7e8d0f37`.
- Public production: `https://scangrade.io/`; final immutable deployment: `https://f8045360.scangrade.pages.dev/`. Production, immutable, and local release HTML are byte-identical at SHA-256 `375c930e152d49e84e7f19d87233b66e5fb557cc84df2fb1cc0726e2664e4be4`; live JavaScript matches the release at SHA-256 `4e7daafe8c12b875d2fe08cd8d664103223f1aba721496d069f1ab1085849493`.
- Final deployment is static-only: `/api/submissions` and `/review-model/health` return the identical SPA file, and there is no public Worker, Pages Function, D1 binding, Tailscale host, or Mac Mini route. An initial upload at `83eaca76` was immediately superseded before handoff after Wrangler discovered dormant repository Functions; final `f8045360` was uploaded from an isolated 221-file static directory and contains no Functions bundle.
- Durable release record: `docs/SCANGRADE_FIXED_WORKSPACE_PUBLIC_BETA14_20260718.md`.

### 2026-07-18 fixed-viewport public Beta 14.1

- Tony's immediate live test found that Beta 14 still allowed vertical Safari scrolling and that the logo moved slightly between landing and capture. This was real: the app root was height-constrained, but HTML/body remained scrollable, and capture used a separate compact header rule.
- Beta 14.1 toggles a document-level capture lock on HTML/body while the scanner is open: fixed body, hidden overflow, exact viewport height, and overscroll disabled. The lock is removed when leaving capture or unmounting.
- Landing and capture now share the same compact student header geometry; the logo does not move or resize after Start Scan.
- Browser measurement passed at 390×844 phone and 768×1024 older-iPad sizes. In both, document height exactly equals viewport height, the bottom bar stays inside the viewport, and the logo coordinates/dimensions are identical before and after opening the scanner.
- Verification: 171/171 repository tests, production build, exact-commit pruned build, live phone viewport measurement, and live static-route checks pass. OCR, capture, crop, confidence, grading, answer-key separation, corrections, and annotation behavior are unchanged.
- Release label: `2026.07.18-fixed-workspace-beta-14-1`; source commit: `f4a75ef74a70422bb15cf6543662aaafe7790951`.
- Public production: `https://scangrade.io/`; final immutable deployment: `https://bf5e2107.scangrade.pages.dev/`. Beta 14 remains at `https://f8045360.scangrade.pages.dev/` and Beta 13 remains at `https://835fb701.scangrade.pages.dev/` for immediate rollback.
- Production, immutable, local release, and `/api/submissions` are byte-identical static HTML at SHA-256 `066cbefaab33d823d4968aca171c7ab4d39b715022c55a7e3285ae517ff1e4de`. Live JavaScript matches at SHA-256 `75feabb21fc7b1ae9a995267eaffb01d017786caad15a12b3cae18164c371335`.
- Durable release record: `docs/SCANGRADE_FIXED_VIEWPORT_PUBLIC_BETA14_1_20260718.md`.
### 2026-07-18 slot-correction public Beta 15

- Tony's live Dot Collections screenshots exposed a teacher-correction rendering defect: correcting only the uncertain right slot of `13` or `12` repainted the complete answer inside that one physical slot. Blank corrections could also paint an unnecessary white correction strip.
- Beta 15 stores whether a correction is a true multi-digit answer in one physical box. Ordinary slot-level corrections now draw only that slot's digit; intentional blanks draw no replacement strip.
- A worksheet-semantic optional-blank rule now clears an unused box only when the layout explicitly permits a one-digit response in either of two boxes, exactly one slot is independently strong, and the other slot looks like an artifact. It never uses the correct mathematical digit and refuses to act when both slots may contain handwriting.
- Manual review now opens with the numeric field focused. For a one-slot correction, typing one digit applies it automatically after a short debounce; suggestions remain one-tap choices. Multi-digit corrections still wait for explicit Save.
- Recognition, capture, crop, confidence, grading, and answer-key separation policies were not changed.
- Verification: all 177 repository tests and the root-domain production build pass. Production, immutable, API-fallback, health-fallback, and local HTML are byte-identical at SHA-256 `a6322becb43ac52176c864b76f37e9c70de6ce7ce795375bae83d09a2614b822`; production JavaScript matches the release at SHA-256 `9920da26e4d6320a2d62d2238bf24144af27507bcd9122e974341de78f450dc2`.
- Source commit: `0d50ebd0c50789aad60630ee5e7246fbe6b60291`. Public production: `https://scangrade.io/`. Immutable deployment: `https://ae4f7e48.scangrade.pages.dev/`. Beta 14.1 rollback remains `https://bf5e2107.scangrade.pages.dev/`.
- Public marking animation remains presentation-only: the public domain uses browser-local OCR and does not call the Mac Mini or a strong cloud model by default. Confident marks therefore remain in worksheet order; yellow answers are not secretly being re-read during the animation.
### 2026-07-18 overlay-layering public Beta 15.1

- Tony's screenshot showed blue recognition labels rendering above the teacher suggestion/correction panel. The recognition overlay was at layer 6 while the correction panel was at layer 4.
- Beta 15.1 raises only the correction panel to layer 8. Blue diagnostic labels remain available over the worksheet but cannot cover the active teacher controls.
- Added a regression test that requires the correction layer to remain above the recognition layer. All 178 repository tests and the production build pass.
- Public production: `https://scangrade.io/`; immutable deployment: `https://120d691c.scangrade.pages.dev/`; build label: `2026.07.18-overlay-layering-beta-15-1`; source commit: `366caa6`.
- Tony's comparison screenshot was definitely Beta 14.1 because its visible build label was `2026.07.18-fixed-workspace-beta-14-1`. Use `https://scangrade.io/?build=15-1` or reload/close the old Safari tab to force the updated application document.
### 2026-07-18 optional-blank public Beta 15.2

- Tony's live Mixed Addition/Subtraction screenshots proved that unused halves of two-slot one-digit answers were still highlighted yellow.
- Root cause: blank-slot suppression was coupled to the neighboring written digit meeting the stricter automatic-grading threshold. A correctly empty optional slot therefore stayed yellow whenever the real digit itself still needed review.
- Beta 15.2 separates those decisions. On layouts explicitly permitting a one-digit response in either slot, a slot with blank/artifact evidence is cleared independently; the written digit remains yellow unless it independently passes the unchanged recognition policy. Two plausible written digits and two-digit worksheet contracts are never collapsed.
- All 179 repository tests and the production build pass. Public production: `https://scangrade.io/`; immutable deployment: `https://d55e444b.scangrade.pages.dev/`; source commit: `6235608`; label: `2026.07.18-optional-blank-beta-15-2`.
### 2026-07-18 empty-save public Beta 15.3

- Tony's screenshots showed the manual field's grey `8`/`37` placeholder being mistaken for entered text and asked for empty Save to mean blank. Both screenshots were still Beta 15.1, so they did not exercise Beta 15.2's optional-blank fix.
- Beta 15.3 removes numeric ghost placeholders and the redundant whole-answer Blank link. Saving an empty field explicitly records the active slot—or the whole answer—as blank.
- For a two-slot one-digit correction, typing one digit now auto-positions it only when the current key-blind recognition state already contains exactly one occupied slot and one blank slot. If both slots look occupied or both look blank, the existing explicit `_ 9` / `9 _` choices remain; ScanGrade does not guess and erase possible student writing.
- All 180 repository tests and the production build pass. Public production: `https://scangrade.io/`; immutable deployment: `https://51df88af.scangrade.pages.dev/`; source commit: `ff09cae`; label: `2026.07.18-empty-save-beta-15-3`.

### 2026-07-23 accepted-answer safety repair candidate

- Beta 15.3's teacher interface is retained. The over-broad post-promotion display veto was narrowed so a successfully promoted answer is not automatically returned to yellow merely because a review-only reader once disagreed.
- A new key-blind accepted-answer safety lane examines only browser answers already marked automatic. A 7.7 MB browser-local whole-slot scout routes suspicious cases; only routed cases are sent to the two existing larger-grayscale strong views. The repair can only force yellow. It never substitutes another reading and never receives the mathematical answer key.
- Canonical exact replay covers 50 sheets and 345 scorable handwritten labels across P02, P03, P05, P08, and P09. Frozen Beta 7: 273/345 automatic (79.1%), 253 correct automatic, 20 confident errors. Repaired candidate: 284/345 automatic (82.3%), 284/284 correct automatic, zero known confident errors, 61 yellow (17.7%). Compared with frozen Beta 7 this is +11 automatic, +31 correctly automatic, and -20 confident errors. Every packet improved correctly automatic coverage and no packet/layout family materially regressed.
- Removing the local scout was unsafe: the ablation reached 292/345 automatic but retained five confident errors. Keep the scout in the repair.
- The 7.7 MB ONNX export has zero read mismatches and zero probability-parity failures against PyTorch on all 70 untouched P05 holdout rows. Batched WebKit inference is about 0.20 s after first-use initialization; mobile WebKit model initialization is about 9.25 s and full scout completion about 15.8 s including image preparation.
- Active mobile-WebKit integration passed on the saved overwritten P09 number-pattern page. It preserved the browser text `3`, changed the answer from automatic to yellow, regenerated annotations, never used the answer key, and completed within the existing ~21.7 s optional grading window. Identical-input repeat is recorded in `private-evidence/reports/accepted-answer-safety-apply-webkit-repeat-final-20260723.json`.
- The repaired lane defaults on only for the private `.ts.net` candidate and can be disabled with `?v3AcceptedSafety=0`. Public `scangrade.io` remains Beta 15.3/browser-only and does not activate this Mac-assisted lane.
- Verification: canonical policy gate pass, visual audit of all 28 changed decisions, ONNX/PyTorch parity pass, active/repeated WebKit application pass, 192/192 repository tests, and production build pass. Physical five-year-old-iPad sustained testing is still a required gate before considering public activation.
- Source commit `104fcf8` was pushed to `origin/autobuild/safe-20260223`; private student evidence and unrelated dirty files were excluded.
- The private app and both local readers were restarted after the commit. `https://hobbes-mac-mini.tail9a3379.ts.net/`, `/v3-compact/health`, and `/review-model/health` all returned HTTP 200/healthy, and the served source contains the private-only safety default and 30-second old-device timeout.
- No Cloudflare/public deployment was made. `https://scangrade.io/` remains the frozen public Beta 15.3 interface and recognition behavior.

### 2026-07-24 browser-local 90% follow-up: do not deploy a selector

- The current active goal remains a fully browser-local, Mac-independent path;
  public `scangrade.io` is still frozen at Beta 15.3 and was not changed.
- Important correction to the optimistic research screen: Candidate 7's
  retrospective five-packet report showed 320/345 automatic (92.8%) with zero
  observed errors, but an actual live WebKit replay of the saved captures
  produced 268/345 automatic (77.7%), all 268 correct, and 77 yellow. This is
  a research result only and does not pass the 90% gate.
- The live model is deterministic when repeated against the same saved capture
  and exact current code/model inputs. Earlier report mismatches arose across
  frozen code/evidence states; future reports must record exact source and
  model hashes before being compared.
- A visual audit of live strict-veto cases explains why a consensus threshold
  cannot safely bridge the gap. All larger views can agree confidently on the
  same wrong handwriting (`18` as `14`; a child-written `8` as `6`). The
  existing strict rule correctly leaves such conflicts yellow rather than
  silently replacing the browser transcription.
- Optional-slot work is real but narrow. The updated key-blind physical blank
  rule identified 24 two-box one-digit cases; all 24 had one true handwritten
  digit, so it did not remove a real second digit. Yet only 14/24 resulting
  raw browser readings matched handwritten truth. A 7.7 MiB scout read the
  true single digit in 18/24 but has no sufficient original-yellow rescue lane
  under the no-replacement invariant. `src/v3/optional-slot-scout-rescue.js`
  and its test are isolated research only; do not wire it into public UI.
- Two one-page local WebKit probes were recorded under
  `private-evidence/reports/browser-local-strict-live-all-saved-webkit-20260723-probe-strong-consensus-*.json`.
  They make no uploads and retain zero confident errors by leaving conflicts
  yellow. They also show the large local reader takes roughly 10.8–12.7 extra
  seconds on hard pages, so it does not meet a practical browser-only launch
  latency bar.
- Complete audit and recommendation: `docs/SCANGRADE_BROWSER_LOCAL_90_GOAL_AUDIT_20260724.md`.
  The next credible accuracy step is a genuinely independent model plus a
  prospective packet/student evaluation frozen before labels are reviewed—not
  another threshold change on P02/P03/P05/P08/P09. Preserve untouched packets
  unless Tony explicitly authorizes their use as a locked prospective test.

### 2026-07-25 capture/review/score polish public Beta 15.14

- Tony's live phone testing found four presentation/capture issues after the
  annotation-stall repair: automatic capture was too reluctant, a faint yellow
  halo could remain during manual-correction animation, the completed score
  shifted slightly after its pen animation, and every correction moved the
  worksheet even when an upper answer already fit above the keyboard.
- Automatic capture's final sharpness floor was reduced conservatively from
  650 to 560. The four-corner ScanGrade-sheet gate, real decodable ScanGrade QR
  requirement, blank/pattern rejection, live focus gate, perspective policy,
  and eight-frame clearest-frame selection are unchanged. Manual capture keeps
  its existing 340 sharpness floor.
- The correction hotspot is now visually transparent. The manual animation
  base clears the exact seeded highlighter polygon rather than an approximate
  answer-box pad, so neither CSS focus tint nor prior raster overhang can leave
  a yellow circle around a corrected answer.
- The final score animation now reveals the exact final raster score through
  an SVG pen mask. Animation completion no longer swaps an approximate vector
  score for a slightly different raster position. The digit 8 is a single
  continuous centre-crossing figure-eight stroke rather than two separately
  drawn circles.
- Keyboard motion is visibility-driven. An upper correction that already fits
  produces zero scroll; a lower correction moves once and only far enough to
  clear Safari's resized visual viewport and correction panel.
- Verification: all 301 JavaScript repository tests pass, including new
  capture-threshold, highlighter-footprint, figure-eight, and keyboard-motion
  tests. The pruned production build passes. Live HTML and JavaScript at the
  immutable deployment and `https://scangrade.io/` are byte-identical to the
  tested build; a 390x844 mobile WebKit smoke test mounted `Start Scan` with
  the exact build label and zero page/console errors.
- Build label: `2026.07.25-capture-review-score-polish-beta-15-14`.
  Static-only immutable deployment:
  `https://6a6910be.scangrade.pages.dev/`. Public production:
  `https://scangrade.io/`.
- Wrangler's first repository-root upload (`99b0d549`) detected dormant Pages
  Functions. It was immediately superseded by the isolated static-only upload
  above. `/api/submissions` is byte-identical to the static application HTML,
  confirming the final public deployment exposes no active backend.

### 2026-07-25 responsive auto-capture public Beta 15.15

- Tony's immediate phone test found that Beta 15.14 still required too long a
  perfect hold before beginning capture. The final accepted-image quality gate
  was not the only constraint: the low-resolution live preview had to exceed a
  300 focus score for three stable checks before the eight-frame burst began.
- Beta 15.15 relaxes only that preliminary trigger. The preview focus trigger
  is 240 instead of 300 and the stable hold is 150 ms instead of 375 ms, which
  means two stable preview checks rather than three at the existing 300 ms
  cadence. The eight-frame burst still chooses its sharpest valid sheet frame.
- Final acceptance remains unchanged at focus score 560. The four-corner
  ScanGrade-sheet gate, decodable ScanGrade QR requirement, blank/pattern
  rejection, motion check, layout/homography path, and OCR pipeline are
  unchanged. A too-blurry burst is rejected and the camera resumes.
- Verification: 302/302 repository tests and the pruned production build pass.
  The immutable deployment, `https://scangrade.io/`, and the local release
  serve byte-identical HTML and JavaScript after propagation. Mobile WebKit
  mounted the exact build with zero page/console errors.
- Build: `2026.07.25-responsive-auto-capture-beta-15-15`. Static-only immutable
  deployment: `https://eabb64d4.scangrade.pages.dev/`; production:
  `https://scangrade.io/`.

### 2026-07-25 shadow-tolerant preliminary capture gate Beta 15.16

- Tony's immediate Beta 15.15 phone screenshots showed two readable, complete
  ScanGrade worksheets that still would not open the automatic burst. One
  reported `Find the worksheet page`; the other reported `Find all 4 black
  squares` despite all four squares being visibly present. These messages are
  emitted only after four corner candidates have already been found.
- The blocker was the preliminary appearance validator, not the final focus
  floor. The displayed paper in the second screenshot averaged about 116/255
  luma. The old live rule required mean >=125, at least 52% of sampled paper
  pixels >=128, and no more than 20% below 80. Its intentionally oversized
  marker patches also required >=12% dark pixels and mean <=190, which was
  brittle under dim or soft live video.
- Beta 15.16 introduces a pure, unit-tested preliminary appearance decision.
  A sheet can enter the burst at mean >=105, bright fraction >=12%, and dark
  fraction <=28%; each already-detected corner patch can count as black at
  dark fraction >=6% and mean <=220. Four detected markers are still required.
  Very dark scenes and missing-marker scenes remain blocked.
- This does not accept the first dim preview frame as the graded image. The
  old bright-paper rule is retained as a `preferred` signal, and the
  eight-frame scorer still rewards bright paper, low dark fraction, sharpness,
  contrast, and all four marker patches. The selected full-resolution frame
  must still meet focus 560 and contain a decodable ScanGrade QR. Geometry,
  perspective, motion, homography, OCR, and confidence policy are unchanged.
- Verification: all 306 repository tests pass, including exact reproductions
  of the two new preliminary failure classes, and the pruned production build
  passes. The immutable HTTPS preview and `https://scangrade.io/` serve exact
  copies of the tested HTML and JavaScript. Browser smoke mounted the exact
  build label and public controls. `/api/submissions` is byte-identical to the
  static HTML, confirming that the isolated deployment did not expose dormant
  Pages Functions.
- Build label: `2026.07.25-shadow-tolerant-capture-beta-15-16`.
  Static-only immutable deployment:
  `https://081de500.scangrade.pages.dev/`; production:
  `https://scangrade.io/`.

### 2026-07-25 two-digit review integrity Beta 15.17

- Tony's live Beta 15.16 scan found a genuine correction-integrity defect on
  mixed-sheet H (`20 - 5`): both printed digit slots were yellow, but typing
  the first digit of intended `15` immediately submitted `1`, replaced only
  the second slot, and graded the incomplete transcription wrong.
- Root cause: `shouldAutoApplySingleDigitCorrection` returned true for any
  single typed digit whenever the editor allowed at least one digit, including
  a whole-answer editor whose required maximum was two. The helper now submits
  only when entered digit count equals the complete handwriting-length
  contract. One unresolved slot still applies after one key; a two-digit
  whole answer keeps the first key and applies after the second.
- The same live test showed a lower correction panel obscured by Safari's
  `scangrade.io` QuickType/domain strip. `visualViewport` reports that strip
  as visible space. The pure viewport resolver now reserves 64 px at the
  keyboard edge. Upper answers that already fit still produce zero movement;
  lower answers make one larger bounded smooth move.
- Verification: focused correction/viewport tests pass, all 307 repository
  tests pass, and the pruned production build passes. The immutable preview
  and cache-busted `https://scangrade.io/` serve exact copies of the tested
  HTML and JavaScript; HTTPS browser smoke mounted the exact build label.
  Static `/api/submissions` confirms no dormant Pages Function was exposed.
- Build label: `2026.07.25-two-digit-review-fix-beta-15-17`.
  Static-only immutable deployment:
  `https://81da16ec.scangrade.pages.dev/`; production:
  `https://scangrade.io/`.

### 2026-07-25 bounded annotation geometry Beta 15.18

- Tony's live number-bond scan showed several yellow highlights displaced far
  from the printed answer boxes. The layout contains six questions and eight
  digit slots; the stored coordinates use the intended bottom-right convention
  and match the worksheet SVG. The defect was not an alternate worksheet
  layout.
- Root cause: annotation placement had begun preferring an unconstrained
  photographed `boxRect`. On number-bond pages, local contour detection can
  mistake a bond line, circle, or neighbouring frame for the answer box.
- Annotation placement now accepts a photographed box adjustment only when its
  area remains plausible and it materially overlaps the known printed answer
  box. Displaced and oversized detections fall back to the deterministic layout
  rectangle. OCR crops, recognized digits, confidence, grading, homography, and
  capture policy are unchanged.
- Four direct geometry regressions reproduce displaced bond shapes, oversized
  bond-line regions, modest legitimate page corrections, and safe fallbacks.
  All 310 repository tests and the pruned production build pass.
- The first production upload accidentally discovered the dormant repository
  Pages Functions because deployment ran from the repository root. It was
  immediately replaced from an isolated static directory. Final public
  `index.html` and JavaScript hashes exactly match the tested build, and
  `/api/submissions` is byte-identical to static `index.html`, confirming no
  API or storage route is exposed.
- Build label:
  `2026.07.25-bounded-annotation-geometry-beta-15-18`.
  Static-only immutable deployment:
  `https://d2726924.scangrade.pages.dev/`; production:
  `https://scangrade.io/`.

### 2026-07-25 unified teacher ink Beta 15.19

- Tony requested darker checks matching the green New Scan button, the same
  green on the landing-page Start Scan action, consistent felt-pen bleed and
  variation between checks and scores, and removal of score fragments appearing
  before their stroke was written.
- Checks and green scores now share base ink `#126c39`, restrained seeded color
  variation, one smooth felt-pen renderer, and the same four-pass pressure/bleed
  recipe. Start Scan and New Scan render as the same `rgb(18, 108, 57)`.
- Root cause of premature score fragments: the reveal mask was approximately
  20–32 px wide, far broader than the final 4–7 px pen line, so one animated
  stroke exposed nearby portions of future strokes. The mask is now derived
  from actual ink width and is approximately 8–15 px, covering bleed without
  uncovering neighbouring score geometry.
- Two new direct pen-style/mask tests pass; all 312 repository tests and the
  pruned build pass. Browser smoke confirms the rendered Start Scan color, not
  only the source rule. Public HTML/JS hashes exactly match the tested build,
  and `/api/submissions` remains identical to static HTML.
- Build label: `2026.07.25-unified-teacher-ink-beta-15-19`.
  Static-only immutable deployment:
  `https://f97f0a24.scangrade.pages.dev/`; production:
  `https://scangrade.io/`.

### 2026-07-25 clean review navigation and capture Beta 15.20

- Tony's live dot-collection scan showed a yellow review swipe shifted roughly
  one digit slot left/down from the printed C answer box. The earlier overlap
  gate was insufficient: a neighbouring-slot detection could still overlap
  enough to be treated as a legitimate photographed-box correction.
- Annotation geometry now also limits detected-box centre drift to 35% of the
  known layout slot in each axis. A direct regression reproduces a 50%-overlap
  neighbouring-slot detection and confirms that it falls back to the layout
  box; modest photographed-page corrections still pass.
- The result bar now contains Home, a plain centred down/up disclosure arrow,
  and New Scan. The arrow points down while recognition labels are closed and
  up while open; it has no circular active treatment. Login was removed from
  the bar, and the unfinished Sign In and Teacher Review entries were removed
  from the landing page. Dormant implementation was preserved for later use.
- Auto-capture opens its low-resolution preliminary burst at focus 220 after a
  100 ms hold, down from 240/150. The accepted image still must pass the
  unchanged full-resolution focus floor of 560, clearest-of-eight selection,
  four-marker geometry, page appearance, QR decode, motion, and perspective
  checks. This is a responsiveness change, not a reduction in accepted-frame
  quality.
- Verification: focused geometry/capture tests pass; all 313 repository tests
  pass; the pruned production build passes. The immutable preview and
  `https://scangrade.io/` serve the exact tested assets, and
  `/api/submissions` serves the same static application shell. Live browser
  smoke confirms the exact build label and a landing page containing only
  Start Scan, Debug Scan, and Get Worksheets.
- Build label: `2026.07.25-clean-review-capture-beta-15-20`.
  Static-only immutable deployment:
  `https://1b84b52f.scangrade.pages.dev/`; production:
  `https://scangrade.io/`.

### 2026-07-25 aligned review editor Beta 15.21

- A fresh Beta 15.20 dot-collection scan showed that C's yellow swipe was now
  attached to the correct answer but remained visibly low. The 35%-of-slot
  centre tolerance still allowed too much decorative movement inside a small
  answer frame.
- Teacher-ink geometry now permits at most 15% of a layout slot's width or
  height as a photographed-box centre correction. A new regression reproduces
  a smaller 20%-height drift and confirms fallback to the deterministic layout
  box; the existing modest wrinkle correction remains accepted. OCR crops,
  recognized text, confidence, grading, capture, and homography are unchanged.
- The correction card's redundant X was removed because tapping outside already
  closes it. Its separate title row was also removed: the worksheet-style
  question bubble now sits immediately left of the numeric entry box, vertically
  centred, followed by Save. The card is narrower and shorter.
- Verification: focused correction/geometry tests pass; a new interface
  contract prevents the X/title-row layout from returning; all 315 repository
  tests pass; the pruned build passes. Immutable/public assets match, and the
  static `/api/submissions` fallback remains the same app shell.
- Build label: `2026.07.25-aligned-review-editor-beta-15-21`.
  Static-only immutable deployment:
  `https://5392b5a0.scangrade.pages.dev/`; production:
  `https://scangrade.io/`.

### 2026-08-01 capture-first guidance Beta 15.72 (isolated physical-test candidate)

- Physical evidence on a current iPhone and an older iPad showed a confusing
  capture state: a valid-looking page could have a green frame and “Hold
  steady” while a stale red “camera is still getting ready” warning remained.
  The live viewfinder could also lag badly during a device's first scan.
- Root causes were separated. A transient readiness error could be written
  after the readiness watcher had already run, so it was never cleared. In
  addition, the digit model and whole-slot scout were being initialized while
  the user was trying to frame the page, competing with live video on older
  mobile WebKit.
- The public instruction vocabulary is now deliberately limited to four
  states: “Starting camera…”, “Find full page”, “Hold steady”, and
  “Capturing…”. One missed marker frame no longer immediately flickers the
  instruction. Transient readiness warnings are suppressed over an active or
  recovered viewfinder; genuine permission and final-quality errors still
  appear.
- Model initialization was removed from the live-camera phase and remains in
  the post-capture OCR path. No OCR policy changed. The four-marker geometry,
  full-resolution focus floor of 560, QR, page-appearance, perspective, motion,
  and final-quality safeguards are unchanged.
- Verification: focused guidance/readiness/workload tests pass; the complete
  suite passed **391/391** before the final wording-only change, and the focused
  suite passed afterward. The production-pruned build passes.
- Isolated physical-test deployment only:
  `https://capture-flow-beta15-72.scangrade.pages.dev/` (immutable release
  `https://ded1c299.scangrade.pages.dev/`). Tony subsequently approved public
  promotion. Production deployment `https://30207d63.scangrade.pages.dev/` is
  live at `https://scangrade.io/`; production HTML serves
  `index-Da-zONVu.js`, which contains the Beta 15.72 label and the simplified
  “Find full page” / “Starting camera…” guidance.

### 2026-08-01 marker-registered capture Beta 15.74 (isolated candidate)

- The failed Beta 15.72 number-bond test exposed two independent defects. Beta
  15.73 preserved the full-resolution frame that triggered capture before the
  user could move. A forensic replay then found a separate registration defect:
  the corner-window fallback had accepted a **7 x 12 px, 31 px-area speck** as
  the top-right worksheet marker while the real markers were roughly 70 px
  across. That false anchor skewed the page homography and displaced the source
  annotation layer.
- Corner-window marker sets must now have mutually consistent physical scale in
  addition to passing corner position and page-quad checks. This rejects a tiny
  speck beside three genuine markers without weakening capture focus, motion,
  perspective, QR, page-appearance, or final-quality gates.
- Before repair, the saved failing page used top-right anchor `(1331, 30)`.
  After repair it uses the genuine marker at approximately `(1251.75, 225.76)`
  and produces a straight, correctly registered warp.
- Reproducible corpus audit: all **21/21** saved number-bond captures still
  detect successfully; **11** contained tiny full-frame corner candidates that
  are now rejected safely. Exact failing-page replay completes on the repaired
  warp. A direct selection regression also proves the preserved valid trigger
  frame survives when every later burst frame contains user movement. The full
  repository suite passes **401/401**, and the pruned production
  build passes.
- Debug payloads now include source-to-warp registration measurements for every
  answer crop so a future exact Debug Scan can distinguish projection drift
  from local answer-box registration rather than relying on screenshots.
- Build label: `2026.08.01-marker-registered-capture-beta-15-74`. Tony then
  completed repeated physical current-phone Debug Scans across row and
  number-bond pages. Capture was materially easier and the previously severe
  marker-registration displacement did not recur. One short-lived
  `Show all 4 squares` prompt appeared with four visible markers, and one scan
  retained slight highlight drift; these are recorded as non-blocking capture
  guidance/registration residuals rather than hidden as solved.
- Tony approved public promotion. The exact byte-verified candidate is live at
  `https://scangrade.io/`; immutable production deployment:
  `https://7f151a24.scangrade.pages.dev/`. Production and the isolated release
  `https://910ca555.scangrade.pages.dev/` serve local `index.html` SHA-256
  `6b4296541a4c5be7cb033d0f0143f9048d72dc12b414de7b914cbf4b7e538d30`
  and JavaScript `assets/index-C9ga02P9.js` SHA-256
  `924658e90944957c363d6eb5660084624c8d219ac6876c62b4d60027bbb09be3`.
  `/api/submissions` is byte-identical to the static app shell, confirming the
  production upload did not attach a Mac Mini/cloud backend. Beta 15.72 remains
  available for rollback at `https://30207d63.scangrade.pages.dev/`.
- The newest physical Debug Scans were reported as submitted but had not
  arrived in the private Mac Mini archive at promotion time. The screenshots
  and direct physical acceptance were sufficient for this reversible public
  promotion, but the missing telemetry is an explicit follow-up and must not be
  described as a completed debug-payload audit.

### 2026-08-02 confirmed required-blank grading repair Beta 15.82

- Physical reproduction on `sg-g1-lw-10-place-value-50`, question A: the
  student wrote `7` in the left slot for `3 tens + 4` and left the right slot
  empty. After the teacher confirmed the selected right slot with `_`, the app
  retained `7` and correctly computed that it did not match `34`, but an older
  required-slot review check still treated the confirmed blank as unresolved.
  The question therefore received no red X and was revisited later.
- Repair: a blank required slot blocks grading only until the teacher confirms
  that physical slot as blank. Confirmation does not alter the sibling `7`,
  does not use the answer key as recognition truth, and makes the complete
  written response `7` immediately gradeable (incorrect against `34`).
- Regression coverage proves the confirmed blank no longer keeps the question
  yellow, the accepted sibling digit is preserved, the response does not match
  `34`, and automatic review advances to the next genuinely yellow question
  rather than returning to A. Unconfirmed required blanks remain yellow and
  structurally optional blanks retain their existing behavior.
- Verification: focused correction tests **17/17**, complete repository suite
  **415/415**, and production build pass. Build label:
  `2026.08.02-confirmed-blank-grading-beta-15-82`.
- Public deployment: `https://9673b871.scangrade.pages.dev/` and
  `https://scangrade.io/`. A no-cache revalidation cleared the pre-existing
  custom-domain HTML entry. Public root, immutable release, local build, and
  the static `/api/submissions` fallback now serve the tested Beta 15.82
  document; local/public HTML SHA-256 is
  `66529d39996e87ead4f2b249d063a5fe35bb76e7f28ecb36dbc796efea18181a`.

### 2026-08-03 legacy-iPad review repair Beta 15.83

- The orange legacy iPad proved that the installed Home Screen web app cannot
  reliably open its camera on that iOS generation, while the same device can
  use the camera from Safari. Physical testing must therefore use the Safari
  website on this device; no Tailscale or private software is required.
- The Safari capture workspace now computes a fixed 8.5-by-11 preview size
  from the actually visible legacy viewport and the preview's measured top
  position. This is intended to keep both the top and bottom capture guidance
  visible without scrolling on old Safari. It does not loosen focus, marker,
  perspective, motion, QR, or final-quality gates.
- The orange-iPad two-digit correction loop was traced to answer-level review
  advancing after only one unresolved physical slot remained. Correction now
  stays scoped to that final physical slot, so the left digit of a response
  such as `19` can be completed without the already-confirmed right digit being
  reopened or overwritten.
- The all-yellow orange-iPad page had not lost worksheet identity: the exact
  printed title fallback had loaded the known ScanGrade layout and answer key,
  which is why teacher-entered answers could still be graded. The old policy
  nevertheless blanket-yellowed OCR whenever the QR itself was unreadable.
  Beta 15.83 retains OCR only when the exact title match is strong **and** every
  expected physical answer box/frame is independently registered. Otherwise
  the existing all-yellow safety fallback remains. Mathematical correctness is
  never used to choose a transcription.
- Physical answer-box registration metadata is now available to that safety
  gate in normal scans rather than debug mode only. This exposes existing crop
  evidence; it does not change the crop geometry or recognizer.
- Reproducible verification: focused legacy-viewport, correction-scope, and
  known-template-fallback regressions pass; complete repository suite passes
  **421/421**; production-pruned build passes. Build label:
  `2026.08.03-legacy-ipad-review-repair-beta-15-83`.
- Static-only immutable production deployment:
  `https://113462a7.scangrade.pages.dev/`; public deployment:
  `https://scangrade.io/`. The first test upload from the repository directory
  accidentally discovered dormant Pages Functions and was rejected during
  smoke testing. The accepted production upload was rerun from the isolated
  static build directory; `/api/submissions` now resolves to the static app
  shell, confirming no Mac Mini/cloud backend is attached.
- Required physical acceptance on the orange iPad: open `scangrade.io` in
  Safari (not the Home Screen app), confirm the entire viewfinder and its
  guidance are visible, scan the dot-collections page, verify that a proven
  title/box registration no longer makes every answer yellow, and complete the
  final two-digit `19` correction without a loop. Some genuinely uncertain
  answers may still be yellow. If the whole page remains yellow, preserve the
  safe gate and inspect a Debug Scan rather than loosening it speculatively.

### 2026-08-04 legacy-iPad physical review repair Beta 15.84

- The Beta 15.83 orange-iPad retest exposed four independent defects: old
  Safari clipped the bottom control bar; the dot-collections page remained
  blanket yellow; completed checkmarks briefly disappeared while the next
  teacher correction animated; and the final two-slot answer reopened after
  both slots had been manually confirmed.
- The blanket-yellow cause was a metadata mismatch, not weak handwriting OCR.
  Dot-collections has twelve logical digit slots derived from six shared
  printed answer frames. The fallback gate required twelve independently
  registered frames, so it rejected a correctly registered page. Beta 15.84
  accepts this case only when each logical question group shares one explicit
  printed-frame parent and at least one derived half is independently trusted.
  Title, layout, mapping-count, geometry, and uniqueness checks remain intact;
  mathematical correctness is never recognition truth.
- Old-Safari preview sizing now reserves 112 px below the worksheet instead of
  88 px so the fixed bottom controls clear legacy Safari chrome.
- Manual correction installs its stable animation base before publishing the
  corrected result, preventing old WebKit from painting a transient frame with
  prior marks absent. When every physical slot in the active question has been
  teacher-confirmed, the question-level fallback is explicitly settled and
  the final correction cannot reopen itself as yellow.
- Verification: focused legacy regressions **36/36**, complete repository suite
  **423/423**, and production Vite build pass. Build label:
  `2026.08.04-legacy-ipad-review-repair-beta-15-84`.
- Physical acceptance remains required on the orange iPad in Safari: verify the
  full bottom bar, scan the same dot-collections page, confirm that only
  genuinely uncertain answers are yellow, ensure prior marks stay visible
  during each correction, and finish the final `19` without a review loop.
  The old device's 20+ second first pass is not claimed fixed by this patch and
  must be timed separately after correctness is restored.
- Static-only production deployment: `https://091af5d6.scangrade.pages.dev/`,
  promoted to `https://scangrade.io/` on the configured production branch
  `autobuild/safe-20260223`. Production smoke testing resolved
  `assets/index-C5iIgarz.js`, found the exact Beta 15.84 build label, and
  confirmed `/api/submissions` remains the byte-identical SPA shell rather
  than a server or Mac Mini grading endpoint.

### 2026-08-05 legacy-iPad local-recognition and final-review repair Beta 15.86

- Physical Beta 15.85 testing confirmed that completed checkmarks no longer
  flashed, but the orange iPad still blanket-yellowed all answers, the final
  two-slot `19` could reopen after manual correction, and legacy Safari still
  clipped the bottom grading bar.
- The blanket-yellow cause is now isolated: iOS 12.5.7 cannot initialize the
  normal ONNX/WASM runtime. Beta 15.86 adds a browser-local WebGL fallback
  that runs the same frozen digit-model weights. It does not upload student
  work, use a Mac Mini or cloud model, or use mathematical correctness to
  choose a transcription. The safe all-yellow fallback remains if both local
  runtimes fail.
- WebGL requires fixed batch-one model shapes on this old runtime. Three
  companion models were generated by changing only the leading batch
  dimension; their SHA-256 values are
  `023f950e9c695d49ce572beae2d9a4c56da9b26f94b5b25d618aa73a42b75c8a`,
  `ef634507867f2193efc7f6fb4248eb430954ecca85253cff457890ab64d5b640`, and
  `aad6bb469388bf2d7adc1fa6a330bf80d20c1d6137e94986be0f3894d6e13bd5`.
  Chromium software-WebGL parity across all three model paths and 36
  deterministic tensors produced zero winner changes; maximum probability
  delta was below `6e-7`.
- Manual correction now installs the fully settled answer state before the
  awaited annotation redraw. A six-answer replay proves the last `19` cannot
  return to yellow. The legacy viewport now reserves 148 px beneath the page
  so the Safari control bar remains reachable.
- Verification: focused regression suite **23/23**; complete repository suite
  **433/433** after updating one stale source-shape assertion to recognize the
  existing combined viewport-lock/update watcher; production-pruned Vite
  build passes. Build label:
  `2026.08.05-legacy-ipad-webgl-fallback-beta-15-86`.
- Static production release: `https://9ba7100d.scangrade.pages.dev/` and
  `https://scangrade.io/`. The public main JavaScript is byte-identical to the
  verified build (SHA-256
  `970febac2af1a49b4b7e09b1d3f38f52c557ede1b29b1b23d9e0b184e58938c6`),
  all three WebGL companions return HTTP 200, and `/api/submissions` remains
  the static SPA shell: no Mac Mini/cloud backend or storage is attached.
- This is not yet a physical pass. Required acceptance is one Safari scan on
  the orange iPad (not its installed Home Screen app): confirm the 15.86 build
  label, the full bottom bar, no blanket-yellow result when local WebGL is
  available, and a final `19` correction that settles. First-run model load
  may remain slow; performance is a separate measurement from correctness.

### 2026-08-05 legacy-iPad final-review transaction Beta 15.87

- Physical Beta 15.86 testing confirmed that the compact viewport repair fits
  the orange iPad, but all answers remained yellow and the final two-slot `19`
  still appeared to revert after teacher entry.
- The correction state was already being reconciled correctly. The remaining
  trap was downstream: review advancement waited behind annotation image
  composition, image preloading, and pen-animation preparation. Any stalled
  legacy-WebKit image operation could therefore leave the UI focused on the
  final yellow even though the teacher entry had been accepted internally.
- Beta 15.87 advances or closes the review transaction immediately after the
  authoritative correction state is committed. Optional image and animation
  work can no longer reopen or block that decision. It also removes remaining
  `Array.prototype.at` and `Promise.prototype.finally` dependencies from the
  legacy-critical review/score paths because iOS 12 does not reliably provide
  those APIs.
- Regressions cover the exact `5, 8, 12, 13, 16, 19` sequence, authoritative
  fallback clearing, unsupported built-ins, and source ordering that requires
  review advancement before optional image/animation awaits. Focused tests and
  the production Vite build pass.
- The blanket-yellow result is a separate engine limitation, not a confidence
  threshold: this orange iPad fails both the local ONNX/WASM and WebGL model
  runtimes. The safe review-only fallback must remain until a demonstrated
  compatible local reader or server reader exists. Do not loosen confidence or
  represent this device as supporting automatic OCR.
### 2026-08-05 legacy-iPad ONNX.js opset-9 fallback and final-review repair Beta 15.88

- Beta 15.88 retains the frozen recognition policy and the Beta 15.87
  teacher-confirmation transaction repair. The correction path still commits
  every physical slot before it advances; a late OCR/image/animation callback
  cannot reopen a teacher-confirmed final answer. The exact six-answer replay
  (`5, 8, 12, 13, 16, 19`) and partial-two-slot control remain required
  regressions.
- The orange-iPad blanket-yellow result was isolated to model-runtime
  compatibility. iOS 12.5.7 Safari can fail both the modern ONNX Runtime Web
  WASM/WebGL paths even though the page and camera work. Beta 15.88 therefore
  uses this fallback order: **WASM -> ORT WebGL -> ONNX.js WebGL with an
  opset-9 companion -> conservative yellow review**. No answer-key value is
  used as handwriting truth, and no confidence threshold is loosened.
- Three opset-9 companions were generated by changing only the declared
  ONNX opset from 13 to 9. SHA-256 values are:
  `52508ce8f675dc9ac75a710150b0420213440cdf95c204ac4914041e72674376`
  (Tony generalist),
  `c2283445cf77fb730b3b616c6481819b655b9d799e2ff03e5808a118c7c881b5`
  (live trusted temporary), and
  `282bb2e9533711141a31ed807fd3014f182562a1e00e6a543e7b0d15c9645b4a`
  (generalist). Model-integrity tests verify that the companion graph is
  identical apart from that opset declaration. Numerical parity across 16
  deterministic tensors produced zero argmax changes; maximum absolute
  difference was approximately `0.0000041` and mean absolute difference
  approximately `0.0000009`.
- The small ONNX.js adapter exposes the same `Tensor`, `InferenceSession`,
  `inputNames`, `outputNames`, and `run(feeds)` surface used by the OCR
  pipeline, including normalization of ONNX.js Map outputs. Modern browsers
  continue using ONNX Runtime Web; ONNX.js is loaded only for the legacy
  fallback.
- Verification on the desktop: focused compatibility/correction suite
  **50/50**, complete repository suite **454/454**, `git diff --check` clean,
  and the production-pruned Vite build passes. Build label:
  `2026.08.05-legacy-onnxjs-fallback-beta-15-88`.
- Status: locally verified, **not yet physically accepted**. The decisive
  orange-iPad Safari test must confirm that at least the supported companion
  model initializes (so the page is not blanket-yellow), that the complete
  bottom bar is visible, and that the final two-slot answer settles after both
  physical slots are confirmed. If ONNX.js WebGL also fails on that device,
  all-yellow review remains the safe and honest result; do not claim automatic
  OCR support until the physical test passes.

### 2026-08-06 Beta 15.89 legacy ONNX.js CPU fallback (deployed; physical acceptance pending)

- The 15.88 legacy fallback was extended without changing the normal browser
  path or the frozen confidence policy. After WASM and ORT WebGL fail, the
  provider now tries the opset-9 ONNX.js companion on WebGL and then retries it
  on ONNX.js's pure-JavaScript CPU backend. This is a compatibility fallback
  only; it does not use the answer key as handwriting truth and does not lower
  the automatic-acceptance threshold.
- The adapter now accepts an explicit backend hint and aliases the first graph
  output to the declared output name when old ONNX.js builds return an internal
  map key. This preserves the existing OCR provider interface.
- Focused compatibility/correction tests: **50/50**. `npm run build` passes.
  The complete historical repository suite is not presently green: 13 older
  static/baseline assertions fail and must not be represented as Beta 15.89
  regressions without investigation. A real 8.4 MB opset-9 companion loaded
  and produced a `[1,10]` output through ONNX.js CPU on the Mac in about 55 ms
  per inference. All three shipped opset-9 companions also loaded and produced
  `[1,10]` outputs through the CPU path in the desktop smoke test (about 40.5,
  91.6, and 98.9 ms respectively). These timings are desktop-only and are not
  evidence of acceptable orange-iPad speed.
- Commits `c0fae10` and `4d46d77` are pushed on
  `autobuild/safe-20260223`. Cloudflare Pages production deployment:
  `https://6981ec24.scangrade.pages.dev`. The public `scangrade.io` response
  was independently fetched and verified to reference the same
  `assets/index-DLDR_Twn.js` bundle (823,154 bytes), containing the
  `legacy-onnxjs-cpu-fallback-beta-15-89` marker.
- Status: **deployed but not physically accepted**. Test in ordinary Safari
  (not the old home-screen installation) at `https://scangrade.io`, confirm the
  visible Beta 15.89 build label, and scan the same P08 Dot Collections page.
  Record whether all six answers remain yellow, time to initial results,
  bottom-bar visibility, and whether the final two-slot correction settles.
  If the page is still blanket-yellow, repeat once with Debug Scan and confirm
  its autosave. Diagnose the recorded provider/runtime failure; do not tune
  thresholds or use the answer key to rescue recognition. If CPU inference is
  too slow or fails on iOS 12.5.7, classify that device as unsupported or
  review-only rather than weakening the frozen safety policy.

### 2026-08-08 orange-iPad runtime diagnostics and narrow repair candidates (local only; not deployed)

- A controlled full-page replay used the saved P08 `SG-G1-LW-07 Dot
  Collections` capture with an iOS 12.5.7 Safari user agent. It produced the
  same correct answers (`5`, `8`, `12`, `13`, `16`, `19`), no review flags,
  and no digit-engine fallback through each available local provider:
  WASM about **2.16 s**, ORT WebGL about **4.67 s**, ONNX.js WebGL about
  **4.54 s**, and ONNX.js CPU about **15.89 s** wall-clock on this desktop
  Chromium host. These are provider/path checks only, not old-iPad speed or
  acceptance evidence.
- The real ONNX.js 0.1.8 CPU path now has a regression that stages modern
  engine failures, lets ONNX.js WebGL fail, loads the shipped opset-9 primary
  companion, and verifies a finite declared `output` tensor of length 10.
  This shows that the checked-in adapter's Map/output alias is sufficient in
  that controlled path. The uncommitted broad output normalizer in
  `src/ocr-pipeline.js` was pre-existing worktree state; this investigation
  found no iPad-specific evidence that it is the required fix.
- The all-yellow path is an explicit recovery path: any digit-engine
  initialization/inference exception creates null, zero-confidence,
  review-needed predictions for the whole structured page. It is therefore
  distinct from a confidence/veto review. P08 provider parity does not prove
  the orange iPad is free of a runtime error, stale asset/cache, or
  device-performance failure.
- Local candidate diagnostics now export `digitEngineTrace`: model-init
  timing, execution provider, and a timed record for every logical crop
  operation (including the 30-second guard, failure message, and variant
  count). Runtime metadata now retains an ONNX.js-WebGL failure even when CPU
  later succeeds, for both primary and right-slot model loads. No threshold,
  model weight, answer-key rule, or capture/homography behavior changed.
- A separate legacy-ID candidate repairs the final manual correction path:
  the writer already matched numeric layout ids to string prediction ids, but
  post-correction correctness/review/answer-group/annotation rebuilding did
  not. Canonical lookup now spans that re-derivation path, so a corrected
  final `19` cannot be reinterpreted as missing solely due to ID type.
- `Debug auto-save failed: Unauthorized` is a public-proxy HTTP 401, not
  CORS/PNA/transport. The client candidate treats active auto-save as requiring
  URL + key + opt-in; a missing key makes no request, and a 401 clears the
  stale local key/opt-in and exposes **Connect**. It does not weaken proxy or
  Mission Control authentication and never displays a key.
- Verification: focused local suite **48/48**, `git diff --check`, and
  `npm run build` passed. This work is not deployed and does not constitute a
  physical old-iPad fix.
- Required physical gate: on the exact orange iPad, use ordinary Safari and
  the installed-PWA context separately, reconnect Debug auto-save with a
  fresh activation link, scan P08, and retain the saved debug bundle. Record
  provider, model SHA/asset metadata, `digitEngineTrace`, total time, yellow
  count, and first failing crop/error if any. Then enter `5, 8, 12, 13, 16,
  19` manually and confirm the final F answer stays settled after navigation
  or a short wait. For a remaining 401, compare proxy/private receiver token
  fingerprints operationally without printing either secret.

### 2026-08-08 Beta 15.90 orange-iPad runtime-trace release (deployed; physical acceptance pending)

- The local diagnostic/compatibility candidate was tightened without changing
  OCR weights, confidence thresholds, answer-key separation, capture gates, or
  homography behavior. The single broad-suite failure was a stale source-text
  assertion for the now-multiline model-init call; the test was made
  formatting-tolerant without changing production behavior.
- Verification: focused real ONNX.js CPU/model execution passed; complete
  repository suite **465/465**; `git diff --check` passed; deploy-pruned Vite
  build passed. The release contains the timed `digitEngineTrace`, retained
  ONNX.js WebGL failure metadata before CPU success, canonical legacy ID lookup
  through final correction re-derivation, and safe reconnect behavior after a
  missing/rejected debug-upload key.
- Build label: `2026.08.08-legacy-ipad-runtime-trace-beta-15-90`.
  Production immutable deployment: `https://cc86c6fd.scangrade.pages.dev/`.
  Public production: `https://scangrade.io/`. Static preview:
  `https://180340ee.scangrade.pages.dev/`.
- Local, immutable, and public HTML are byte-identical at SHA-256
  `3526d6befaf61af53b976d44ff0b28f3df6491aaa84268f2c6630a3f9f5030cf`;
  public JavaScript is byte-identical at SHA-256
  `40ff02a0583d6905ee272e64f3e24f754f4b36831751c2aa4c951edbc3425df6`.
  `/api/submissions` and `/review-model/health` return that same static app
  shell, so no D1 Function, Mac Mini grader, or public recognition backend is
  attached.
- Deployment safety: the first preview was rejected after a repository-root
  Wrangler launch discovered the dormant D1 Function and returned 503 at
  `/api/submissions`. It never reached production. The same verified artifact
  was immediately redeployed from inside an isolated 254-file static directory;
  only this static deployment was promoted.
- Evidence-path blocker: Mission Control and the restricted local upload proxy
  are running, but Tailscale reports Funnel permission disabled for the
  tailnet. The saved port-8443 mapping therefore fails during TLS before it can
  reach ScanGrade. The Tailscale approval page is open for the tailnet owner;
  re-enable that existing upload-only Funnel before relying on auto-save.
- **Not accepted yet.** Required physical gate remains: on the exact orange
  iPad, confirm Beta 15.90, reconnect Debug auto-save, scan P08 in ordinary
  Safari and the installed-app context, retain the debug bundle, and record
  provider, model asset/hash metadata, operation timings, total time, yellow
  count, and first error. Automatic grading—not blanket yellow—must be seen on
  the device. If every local provider fails or exceeds a practical classroom
  time budget in the captured trace, classify this iPad honestly as review-only
  or unsupported rather than weakening the frozen safety policy.
- Rollback remains Beta 15.89 at
  `https://6981ec24.scangrade.pages.dev/`. No success claim has been made.

### 2026-08-08 Beta 15.91 restored live debug ingress (deployed; physical acceptance pending)

- Re-enabling Funnel exposed a concrete hostname drift. The Mac's active
  tailnet is now `tail415e0b.ts.net`; Beta 15.90 still targeted the former
  `tail9a3379.ts.net` port-8443 hostname, whose TLS handshake failed.
- Beta 15.91 changes only the restricted debug-upload endpoint and migration
  rule. Existing devices holding either the old private Mission Control URL or
  the old public port-8443 URL migrate to the active endpoint. Recognition,
  capture, homography, model weights, confidence, grading, and answer-key
  separation are unchanged.
- The new Funnel endpoint returned the exact browser preflight contract:
  HTTP 204 for origin `https://scangrade.io`, POST/OPTIONS, and the authenticated
  JSON headers. Proxy and Mission Control token fingerprints matched without
  printing either key. A non-student end-to-end POST returned 201 and saved
  receiver-smoke bundle
  `2026-08-09_02-50-05-016-receiver-smoke-4e4b0e1d`.
- Verification: complete repository suite **465/465** and deploy-pruned build
  pass. Build label:
  `2026.08.08-legacy-ipad-live-ingress-beta-15-91`.
- Static preview: `https://dd252536.scangrade.pages.dev/`. Production immutable:
  `https://d11e247b.scangrade.pages.dev/`. Public production:
  `https://scangrade.io/`.
- Local/immutable/public HTML SHA-256:
  `202def3999949defa65cfc29b5728f5999e9f406712272d998e437bdb07aa913`.
  Public JavaScript SHA-256:
  `e2ec2a7a45991806c208db4170eb13ac85bdb88c7d25e13b0f1c8ea027164a92`.
  `/api/submissions` remains the byte-identical static shell. A production
  browser smoke mounted the exact label with zero console errors.
- The private activation URL was copied to the Mac clipboard without printing
  its key. On the orange iPad, paste it into Safari or into Debug Scan's
  **Connect** prompt, then run P08 Dot Collections. Do not accept the device
  until automatic marks appear and the saved bundle proves the runtime path,
  or the trace rigorously establishes an unacceptable failure/time budget.
- Status: **not physically accepted**. Beta 15.90 rollback is
  `https://cc86c6fd.scangrade.pages.dev/`; Beta 15.89 rollback is
  `https://6981ec24.scangrade.pages.dev/`.

### 2026-08-09 Beta 15.92 evidence recovery after first orange-iPad run (deployed; acceptance still pending)

- The first physical orange-iPad Beta 15.91 scan completed its scanning stage
  in about **45 seconds** but marked all six P08 Dot Collections questions
  yellow. This is a failed compatibility result, not automatic grading and not
  acceptance.
- Debug auto-save also failed. The running proxy received no request from the
  iPad, while an independent public preflight still returned HTTP 204. The
  likely legacy-WebKit failure boundary is therefore the cross-origin
  preflight/request path before the proxy, not Mission Control authentication
  or storage.
- Manual Export exposed a separate reproducible iOS 12 defect: Safari exposes
  `navigator.share` but not file-sharing capability. The app assumed an absent
  `canShare` meant file sharing worked, so AirDrop produced a 24-byte text file
  containing only `ScanGrade OCR debug JSON`. The scan trace was not recovered.
- Beta 15.92 adds three narrow, tested repairs without changing recognition,
  capture, homography, model weights, confidence, or grading policy:
  1. If the authenticated JSON upload/preflight fails, Safari retries a
     CORS-safelisted `text/plain` envelope. The token remains inside the HTTPS
     body, never the URL; the proxy still enforces exact origin, constant-time
     token matching, size limit, and rate limit, then forwards only unwrapped
     JSON.
  2. Legacy Web Share now sends compact debug JSON as text instead of claiming
     to share an unsupported file attachment.
  3. Manual correction closes the resolved editor immediately but waits until
     its replacement check/X is drawn before showing the next yellow focus,
     removing the observed brief mark/focus discontinuity.
- Both normal-header and legacy-text receiver formats passed real authenticated
  end-to-end smoke uploads:
  `2026-08-09_12-26-56-126-receiver-smoke-c25d66a0` and
  `2026-08-09_12-26-56-147-receiver-smoke-6520d144`.
- Verification: complete repository suite **468/468**, deploy-pruned build, and
  `git diff --check` pass. Build label:
  `2026.08.09-legacy-ipad-evidence-recovery-beta-15-92`.
- Static preview: `https://df44fd26.scangrade.pages.dev/`. Production
  immutable: `https://f89c4b3f.scangrade.pages.dev/`. Public production:
  `https://scangrade.io/`. An intermediate `main`-branch upload
  (`https://10897db6.scangrade.pages.dev/`) was classified as Preview and never
  changed the custom domain; the configured production branch remains
  `autobuild/safe-20260223`.
- Local/preview/immutable/public HTML SHA-256:
  `ac471c41782d5a73fd624b6d6c00767028af5e0c15fc80a8ea6cc9492db4d19b`.
  JavaScript `assets/index-DC1qQwa1.js` SHA-256:
  `6f8735af1b92dcf0bd2070ecbde605fd452d2df282cfe9dbebb7a10164d1ab8e`.
  `/api/submissions` and `/review-model/health` are byte-identical static shell.
- **Not accepted yet.** Repeat P08 on the exact orange iPad after confirming
  Beta 15.92. The decisive evidence remains automatic marks plus a saved trace,
  or a trace showing that every compatible provider fails or exceeds an
  acceptable classroom time/reliability standard. Blanket yellow remains a
  failure, not a compatibility success.

### 2026-08-09 Beta 15.93 validates inference before accepting a provider (deployed; physical gate pending)

- The second physical orange-iPad run on Beta 15.92 again produced all six
  yellow questions. It felt slightly smoother, but auto-save still failed and
  manual correction marks still disappeared/reappeared. This remains failed
  compatibility, not acceptance.
- Beta 15.92's compact-text export worked. The 188,797-byte JSON is preserved
  at
  `private-evidence/debug-scans/2026-08-09/2026-08-09-orange-ipad-beta15-92-manual-export/debug.json`
  with SHA-256
  `36f872be0376470ce03a761158a749ce415295632dfa8c69967ac73adf869296`.
- The trace identifies the exact runtime failure on iOS 12.5.4 / Safari 12.1.2:
  ORT WASM cannot parse (`invalid opcode 192`); ORT WebGL then initializes in
  1,553 ms but its first real inference fails after 244 ms with
  `Unpacked shape is needed when using channels > 1`. The old selector accepted
  a provider after session creation, so that run-time failure never continued
  to ONNX.js and forced the whole page into review.
- Beta 15.93 makes provider selection run one real zero-input
  `[1,1,28,28]`/10-class inference before accepting WASM, ORT WebGL, ONNX.js
  WebGL, or ONNX.js CPU. A provider that creates a session but fails inference
  is recorded and the chain continues. The shipped opset-9 ONNX.js CPU model
  still executes with finite output in the real integration smoke.
- iOS 12 correction transitions now keep the live entered answer and existing
  marks mounted while a predecoded static settled frame is composed. That
  frame includes the completed question mark and appears once; only iOS 12
  skips the unreliable correction pen animation. Modern devices retain the
  animated flow.
- Auto-save still did not reach the proxy even through the no-preflight body
  fallback. Treat live cross-origin auto-save as unsupported on this Safari for
  now; the verified compact manual export is the reliable evidence route.
- Verification: complete repository suite **471/471**, deploy-pruned build,
  `git diff --check`, staged provider-initializes-but-first-inference-fails
  regression, and real ONNX.js CPU integration smoke pass. Build label:
  `2026.08.09-legacy-inference-validated-fallback-beta-15-93`.
- Static preview: `https://22c74830.scangrade.pages.dev/`. Production
  immutable: `https://a2a4b8a8.scangrade.pages.dev/`. Public production:
  `https://scangrade.io/`. HTML SHA-256:
  `73ab7403598b9c3866a325b199e7ea461e788be1b8df145635416c7326bda7da`.
  JavaScript `assets/index-DlMAGwLM.js` SHA-256:
  `46d0c465c397ae46f9a7f3e8881f79b808f6fc116d31488a44031f00d79262cd`.
  `/api/submissions` and `/review-model/health` remain the identical static
  shell.
- **Not accepted yet.** The next P08 physical scan must show whether the iPad
  reaches ONNX.js CPU, its per-operation/total time, and whether any answers are
  automatically marked. If CPU fails or is too slow/unreliable, this trace path
  now provides rigorous evidence for review-only/unsupported classification.

### 2026-08-09 Beta 15.93 orange-iPad physical compatibility gate passed

- The exact orange iPad (iOS 12.5.4 / Safari 12.1.2) physically completed a
  Beta 15.93 P08 scan using real local automatic inference. This was not the
  digit-engine fallback and not a blanket-yellow result.
- The manual export is preserved at
  `private-evidence/debug-scans/2026-08-09/2026-08-09-orange-ipad-beta15-93-manual-export/debug.json`
  (239,111 bytes; SHA-256
  `8b2b6581307996dce81552bd4cffc090ec01b369ede92a34b9413f21e96147ca`).
- Runtime evidence: ORT WASM failed to parse and ORT WebGL failed its validation
  inference as expected; provider validation then continued to
  `onnxjs-webgl`, which initialized in 5,487 ms and completed all 12 digit
  operations. `digitEngineFallback` and `reviewOnlyFallback` are false.
- Before manual correction, five questions were automatically checked and one
  question (Q6) was routed to yellow review. The decisive retained pre-correction
  state is `questionReviewCount: 1`. Q6's final digit was conservatively flagged
  as `two-digit-mismatch-low-trust-review`: a shape heuristic proposed 2 while
  the preprocessing majority and several strong variants read 9. Tony corrected
  the displayed 12 to 19; the export correctly retains `originalDigit: 2` and
  `correctedSlots: [1]`.
- Do not reinterpret the post-correction `reviewNeeded: false` or all-true
  `questionCorrect` fields as the original automatic state. Manual correction
  intentionally settles those fields. The retained `questionReviewCount: 1`,
  correction record, original digit, review reason, and provider trace together
  establish the physical automatic-grading result.
- Compatibility conclusion: the orange iPad can perform conservative automatic
  grading locally. It achieved five automatic decisions plus one targeted
  teacher review instead of the previous six-yellow engine fallback. The
  automatic-grading compatibility gate is therefore passed for this device and
  build. Capture-to-result remains roughly 40 seconds and is a performance issue,
  not evidence that the engine fell back.
- Remaining non-gating issues: cross-origin debug auto-save still does not reach
  the proxy on this Safari (compact manual Export is the supported evidence path),
  and Tony still needs to report whether Beta 15.93's iOS-12 static correction
  transition eliminated the disappearing/reappearing annotation flash.

### 2026-08-09 orange-iPad performance baseline and stage telemetry

- The physical Beta 15.93 trace measured 39.814 seconds from captured image to
  generated result: 5.487 seconds provider/model initialization, 7.307 seconds
  across all 12 digit operations, and 27.020 seconds outside the timed engine.
- A timing-only ten-page comparison on current Mac browsers used cold page loads
  and the same 12-slot worksheet workload. Chromium/ORT WASM SIMD measured
  2.142 seconds median (3.529 seconds p90) and WebKit/ORT WASM SIMD measured
  2.401 seconds median (3.541 seconds p90). The orange iPad was about 17–19×
  slower end to end and 45–56× slower in digit-engine work.
- A forced legacy control on modern headless Chromium could not use ONNX.js
  WebGL and fell to CPU. It took about 16 seconds per page, confirming CPU is
  not an acceptable optimization target; it does not invalidate the orange
  iPad's successful and faster ONNX.js WebGL execution.
- Passive `ocrStageTrace` telemetry now records elapsed time through image load,
  pixel read, QR/layout, marker/homography processing, crop preparation, model
  initialization, digit inference, review checks, and result readiness. It does
  not change OCR, capture, homography, provider selection, confidence, or marks.
- Focused telemetry/provider/real-ONNX.js-CPU tests pass. A modern smoke populated
  every stage and read the selected P08 capture 6/6. On that run, marker detection,
  homography, and crop extraction consumed 1.753 of 2.328 seconds (75%). Do not
  assume the same share on iOS 12 until its next physical export measures it.
- Full methodology and raw Chromium/WebKit reports are preserved under
  `private-evidence/reports/orange-ipad-performance-comparison-20260809/`.
- Beta 15.94 is deployed with timing telemetry only. Build label:
  `2026.08.09-legacy-ipad-stage-timing-beta-15-94`. Complete suite **472/472**,
  focused real ONNX.js CPU integration, deploy-pruned build, browser stage-trace
  smoke, and `git diff --check` pass.
- Static preview: `https://7348487d.scangrade.pages.dev/`. Production immutable:
  `https://cce485a8.scangrade.pages.dev/`. Public production:
  `https://scangrade.io/`. Local/preview/immutable/public HTML SHA-256:
  `19e10e9a4b2b14ef8d22a888040afd396cfc6923b27fe63d2746838bc394186e`.
  JavaScript `assets/index-Cmj72aaG.js` SHA-256:
  `6b80a50b1fd1268a88e44a8b8ad05d4f75814f7a3fbc320afb9d077600c35dda`.
  Deployment used the isolated 254-file static directory, not the repository
  root. API-shaped paths remain static Pages responses; no recognition backend
  was attached.
- Next physical step: confirm Beta 15.94, repeat P08 without correcting before
  the automatic result settles, then manually Export. Use `ocrStageTrace` to
  select a regression-backed optimization; do not reduce preprocessing variants
  or alter homography speculatively.

### 2026-08-09 Beta 15.95 old-iPad viewport fit (deployed; physical fit check pending)

- Tony's orange-iPad screenshots showed that Safari's persistent browser chrome,
  the app header, an over-conservative 148 px legacy bottom reserve, and the
  60 px app footer left the worksheet materially smaller than necessary.
- The patch is strictly gated by the existing old-Safari capability test
  (`100dvh` or `aspect-ratio` unavailable). In legacy capture only, the preview
  bottom reserve is 96 px, the logo is 30 px, and the app footer is 50 px.
  Current browsers retain the prior 44 px logo, 60 px footer, and modern preview
  calculations. Safari's own address and tab bars cannot be changed by the app.
- No OCR, capture criteria, homography, inference, confidence, grading, marks,
  correction behavior, or modern-device CSS changed. Regression coverage locks
  both the legacy compaction and the unchanged modern dimensions.
- Verification: focused layout/correction/runtime tests, complete repository
  suite **474/474**, deploy-pruned production build, built-app modern-browser
  dimension check, and `git diff --check` pass. Source commit `6eafee7` is pushed
  on `autobuild/safe-20260223`.
- Build label: `2026.08.09-legacy-ipad-viewport-fit-beta-15-95`. Corrected
  static-only preview: `https://be149e6e.scangrade.pages.dev/`. Production
  immutable: `https://c2e91eca.scangrade.pages.dev/`. Public production:
  `https://scangrade.io/`.
- Local/preview/immutable/public HTML SHA-256:
  `dd3c588ced36d74760800a4d21fb24fb77adfeaf595a3d0d9a0aa96aced9520b`.
  JavaScript `assets/index-BsHlLNJa.js` SHA-256:
  `d045d010002c080f46e76702b091ae46e869dc3fda5b512750ee62bea0bc1dc6`.
  `/api/submissions` and `/review-model/health` return the same static HTML.
- An initial preview `397c1c6c` accidentally picked up dormant repository
  Functions because Wrangler was launched from the repository root. Integrity
  checking caught it before production. It was superseded by `be149e6e`, run
  from inside the isolated 254-file static directory; production used that same
  safe directory and contains no Functions bundle.
- Next physical step: confirm the Beta 15.95 label and that the worksheet,
  correction keypad, and complete footer all fit comfortably on the orange iPad.
  Then collect one uncorrected P08 `ocrStageTrace` export for latency work.

### 2026-08-09 Beta 15.95 physical stage trace and Beta 15.96 fixed workspace

- Tony physically retested P08 on the orange iPad and reported about 40 seconds.
  The manual export is preserved at
  `private-evidence/debug-scans/2026-08-09/2026-08-09-orange-ipad-beta15-95-stage-trace/debug.json`
  (239,988 bytes; SHA-256
  `e5bc01caa059248c61ba97025b52b0a1fee1f7b6512d6d17f46517593891450f`).
- Automatic grading again passed rather than falling back: execution provider
  `onnxjs-webgl`, `digitEngineFallback: false`, `reviewOnlyFallback: false`,
  five automatic decisions, and one yellow question before Tony corrected Q6
  to 19. `questionReviewCount` is 1.
- Passive timing reached `result ready` at 35.214 seconds. The dominant stage is
  `finding worksheet markers` (including marker/homography processing) at
  22.021 seconds. Model initialization was 3.229 seconds and digit inference
  was 6.240 seconds. This is now the measured optimization target; do not alter
  geometry or preprocessing without first reproducing and profiling it against
  the saved physical capture.
- Tony's screenshots confirmed the Beta 15.95 worksheet and complete bottom bar
  fit, but requested a higher, non-scrolling landing cluster; a lower and larger
  capture header; and a footer lifted from the screen edge.
- Beta 15.96 applies those changes only when the existing old-Safari capability
  gate is active. The legacy root is locked to the measured visible viewport,
  the landing cluster starts 72 px below the app top, the capture top padding is
  12 px, logo/title are 38/19 px, and the 50 px footer has 12 px below it.
  Current-browser dimensions remain the prior 44 px logo and 60 px footer.
- No OCR, capture criteria, homography, inference, confidence, grading, marks,
  correction behavior, or modern-device layout changed. Complete suite
  **474/474**, focused old-Safari/correction tests, deploy-pruned build, and
  `git diff --check` pass. Source commit `7fbba68` is pushed.
- Build label: `2026.08.09-legacy-ipad-fixed-workspace-beta-15-96`. Preview:
  `https://1ac35be2.scangrade.pages.dev/`. Production immutable:
  `https://41bc3bfa.scangrade.pages.dev/`. Public: `https://scangrade.io/`.
- Local/preview/immutable/public HTML SHA-256:
  `04a5a2fa0580151c401b12ef7c5a05eec0d38f6894a3224fa86d3eed114cb98b`.
  JavaScript `assets/index-DyaNVDzj.js` SHA-256:
  `f02123578d10e6e5cf41425212d1de9f9bed860b2bac412be7f719d3e7c55888`.
  CSS `assets/index-DqJTo1dY.css` SHA-256:
  `395ff402f20833d49b3daa4d40541298c9c2ee55eafce9eec61fa87c8a8afa60`.
  Deployment used the isolated 254-file static directory; API-shaped routes
  return the identical static HTML and no Functions bundle is attached.
- Next physical step: reload ordinary Safari, confirm Beta 15.96, and report
  whether landing and capture placement now feel correct. No new OCR scan is
  required solely for this CSS/layout acceptance check.

### 2026-08-09 Beta 15.97 diagnostic-raster speed candidate (deployed; physical timing pending)

- Profiling the 22.021-second physical aggregate exposed a debug-only hot path:
  successful Debug Scans converted the 1080×1398 marker binary into a PNG using
  about 1.5 million individual `binary.ucharAt(...)` JavaScript-to-OpenCV calls.
  The diagnostic PNG does not feed marker selection, homography, crops,
  recognition, confidence, or grading.
- Beta 15.97 replaces only that raster copy with `cv.imshow(canvas, binary)`.
  The permanent browser benchmark at
  `scripts/benchmark_marker_debug_raster.mjs` compares both implementations at
  the physical image size. Chromium measured 34.1 ms versus 14.0 ms (2.4×) and
  WebKit 50.0 ms versus 16.0 ms (3.1×). Both produced identical PNG data and
  zero mismatched RGBA bytes. These modern timings validate the replacement but
  do not predict the old iPad's absolute saving.
- A preserved physical worksheet replay remained 8/8, with result-ready at
  2.422 seconds. Its 1.760-second aggregate worksheet stage split into 0.234
  seconds marker detection, 0.624 orientation selection, 0.117 answer-box
  registration, and 0.784 tensor preparation.
- Passive `worksheetStageTrace` now exports those same boundaries on physical
  Debug Scans. It does not change processing options or control flow and is also
  retained in failure exports.
- No marker acceptance, page geometry, warp, orientation scoring, crop,
  preprocessing, model, confidence, review, or grading behavior changed.
  Complete suite **476/476**, exact raster pixel-equivalence benchmark, physical
  worksheet replay, deploy-pruned build, and `git diff --check` pass. Source
  commit `00ee514` is pushed.
- Build label: `2026.08.09-legacy-debug-raster-speed-beta-15-97`. Preview:
  `https://366ff3ce.scangrade.pages.dev/`. Production immutable:
  `https://3bbd4588.scangrade.pages.dev/`. Public: `https://scangrade.io/`.
- Local/preview/immutable/public HTML SHA-256:
  `260402b9756fa9143780002713f7f082963e09a26e75edad7da598148d2fc340`.
  JavaScript `assets/index-DWlxJY31.js` SHA-256:
  `e164cbf84c814289508588db321bbfebdc7992f7cd24be60eb8d03c160ec0293`.
  CSS `assets/index-C5uXJUVT.css` SHA-256:
  `dcf3d3eabc64747759defd8c15b85931c9a4a0e80ece561b965f1485efd6b35a`.
  Deployment used the isolated 254-file static directory; API-shaped routes
  return identical static HTML and no Functions bundle is attached.
- **Do not claim a physical speedup yet.** Next step: one P08 Debug Scan on the
  orange iPad, record capture-to-result time, and manually Export before
  correction. Use `worksheetStageTrace` to select any next optimization.

### 2026-08-09 Beta 15.97 physical trace and Beta 15.98 exact-performance candidate

- Tony physically ran Beta 15.97 on the orange iPad and reported about 37
  seconds from capture until marking began. The exported trace measured 40.768
  seconds to `result ready`; five questions were automatic and only E required
  review. The engine remained `onnxjs-webgl`, with `digitEngineFallback:false`
  and `reviewOnlyFallback:false`. This is another physical automatic-grading
  success, not an all-yellow fallback.
- The compact export is preserved locally at
  `private-evidence/debug-scans/2026-08-09/2026-08-09-orange-ipad-beta15-97-stage-trace/debug.json`
  (242,166 bytes; SHA-256
  `0f6f83a7438f3358af457cf9addac0c7d5c2572bb379170e346a65af50c469fd`).
  It is private/ignored and must not be committed.
- The physical worksheet substages identified the real bottlenecks: orientation
  selection 11.270 seconds, tensor preparation 9.472 seconds, answer-box
  registration 2.773 seconds, model initialization 5.428 seconds, digit
  inference 6.287 seconds, and the post-recognition result work 1.700 seconds.
- Beta 15.98 keeps recognition inputs and policy outputs exact while removing
  redundant work:
  - a decoded QR selects rotation early only when its template distance is at
    most 0.08 and leads the runner-up by at least 0.18; ambiguous/QR-less pages
    retain the four-warp alignment fallback. All 15 eligible historical traces
    chose the same shift as the established full scorer;
  - non-contiguous OpenCV crop rows are copied directly from the WASM heap using
    `Mat.step`, avoiding 144 canvas upload/readbacks. Chromium and WebKit both
    produced zero byte mismatches against `cv.imshow + getImageData`;
  - exact linear-time percentile selection replaces full numeric sorts. It
    returned the identical ranked value and measured 46.9x faster in Chromium
    and 33.1x faster in WebKit on 144 physical-sized percentile selections;
  - byte-identical tensor variants reuse one model inference while retaining
    every named variant, probability, policy vote, and weight;
  - the model begins loading only after capture is committed, overlapping image
    decode/layout fetch, and public scans skip burst-review preparation when no
    optional review endpoint exists. Live-viewfinder model exclusion remains.
- An untouched Beta 15.97 build and Beta 15.98 processed the same ten saved
  layouts in WebKit. All ten had exactly identical predictions, confidence
  metadata, and question groups. Candidate mean result-ready time was 1.631
  seconds versus 2.261 seconds for the control (27.9% lower); a separate
  preserved physical worksheet remained 8/8. Complete suite **483/483**,
  deploy-pruned build, and `git diff --check` pass.
- Build label:
  `2026.08.09-legacy-qr-tensor-speed-beta-15-98`. Source commit `8fb85cc` is
  pushed on `autobuild/safe-20260223`. Static preview:
  `https://5ca0ae0b.scangrade.pages.dev/`. Production immutable:
  `https://6a819d3a.scangrade.pages.dev/`. Public production:
  `https://scangrade.io/`.
- Local/preview/immutable/public HTML SHA-256:
  `b8ac6518187e0e370d46193f6ca1e306be32ea45679cf55bf22fa101372df2d4`.
  JavaScript `assets/index-BGZ5vkiG.js` SHA-256:
  `39973a5df002cebea346a3192c2348dcc02077ff6cbf3702897e7cf05abc52b7`.
  CSS `assets/index-CGXVU6lz.css` SHA-256:
  `24cd4c1218c7f2425aa2478e1bafd8edd408176c23c992a4fbf336966634d652`.
  ONNX JavaScript `assets/onnx.min-QMqBnv2M.js` SHA-256:
  `b08dcf125e58cc4f4e7c6e1c25a2861333029fa091d5f3092185f114c4c1041d`.
  Deployment used the isolated 254-file static directory; `/api/submissions`
  and `/review-model/health` return the identical static app shell, confirming
  that no dormant Functions bundle is attached. A `main`-branch upload was a
  preview only and never reached the custom domain; the final production upload
  used the configured `autobuild/safe-20260223` production branch.
- **Do not claim the orange iPad is under 20 seconds yet.** The next gate is one
  physical P08 Debug Scan, with capture-to-marking time, automatic/yellow result
  count, and an export before manual correction. The trace will show whether
  another exact optimization is needed.

### 2026-08-10 Beta 15.98 physical trace and Beta 15.99 exact-performance candidate

- Tony physically ran Beta 15.98 on the orange iPad and reported about 34
  seconds from capture until marking began. Five questions were automatic; only
  the first digit of E was yellow. The compact export is preserved at
  `private-evidence/debug-scans/2026-08-10/2026-08-10-orange-ipad-beta15-98-stage-trace/debug.json`
  (240,089 bytes; SHA-256
  `f5434c0b0f7fc3b4861669e2f37304920f0cf842ff5e3fbb8880578910c90aac`).
  It is private/ignored and must not be committed.
- The trace reached `result ready` at 32.342 seconds. The Beta 15.98 QR fast
  path worked physically: orientation fell from 11.270 seconds to 0.577
  seconds. The remaining dominant stages were answer-box registration at 9.272
  seconds, tensor preparation at 8.442 seconds, inference at 5.378 seconds, and
  model initialization at 2.993 seconds. Engine remained `onnxjs-webgl`, with
  `digitEngineFallback:false` and `reviewOnlyFallback:false`.
- Beta 15.99 preserves the detector's exact acceptance conjunction but rejects
  geometrically impossible contours before reading their pixels. Accepted
  binary regions use direct single-channel WASM-heap reads, with `ucharPtr`
  retained as a fallback. This targets the Safari bridge calls exposed by the
  9.272-second physical registration stage.
- Four cleanup variants for each virtual digit previously recomputed the same
  luminance, percentile, local mean, and initial ink mask. Beta 15.99 computes
  that mathematically identical prefix once, clones its Float32 ink values, and
  retains all four independent cleanup endings and every tensor variant.
- Against untouched Beta 15.98, ten saved captures produced byte-identical
  replay result JSON, crop geometry, model-input previews, raw-crop previews,
  variant previews, and V3 zone artifacts. Candidate wall time was 18.66
  seconds versus 22.03 seconds for the concurrently started control (15.3%
  lower); an earlier sequential comparison was 17.41 versus 20.81 seconds.
  These modern measurements validate work removal but do not predict the old
  iPad's absolute saving.
- Tony's landing screenshot confirmed the legacy landing cluster should move
  slightly lower. Its old-Safari-only top padding is now 96 px instead of 72
  px. Capture/grading placement and all current-browser landing dimensions are
  unchanged.
- Build label:
  `2026.08.10-legacy-registration-tensor-speed-beta-15-99`. Complete suite
  **485/485**, deploy-pruned build, and `git diff --check` pass. Source commit
  `e6dc22a` is pushed on `autobuild/safe-20260223`.
- Static preview: `https://b2938f09.scangrade.pages.dev/`. Production
  immutable: `https://1d9dedf6.scangrade.pages.dev/`. Public production:
  `https://scangrade.io/`. Local/preview/immutable/public HTML SHA-256:
  `d823f9bd603dab80db8f0a90bb70e07ad5865cd34c58df26ecea04b0d3d2f506`.
  JavaScript `assets/index-D0l1GSlI.js` SHA-256:
  `0cb613d65db8f09738ccd735b790b45bf6f1f228164ed64a2cac1eb8dc772cf6`.
  CSS `assets/index-B-MtZWm5.css` SHA-256:
  `60b1e52b9b8a2dd987fd0024030acfbc1d643ba15dc0ad49234cf83c9b8b93b9`.
  ONNX JavaScript `assets/onnx.min-DOl_hElN.js` SHA-256:
  `b7c971a2a2eff1c1333c741bc3c02d8e3475d9fc2a21677de3404206de6dbf35`.
  Deployment used the isolated 254-file static directory; `/api/submissions`
  and `/review-model/health` return the identical current static app shell, so
  no dormant Functions bundle is attached.
- **Do not claim an orange-iPad speedup or under-20 result until physically
  retested.** Next gate: reload Beta 15.99, run one P08 Debug Scan, time capture
  to marking, note automatic/yellow results before correction, and Export.

### 2026-08-10 Beta 15.99 physical Debug-Scan failure and Beta 15.100 hotfix

- Beta 15.99 failed immediately before marking on the orange iPad. The failure
  export is preserved at
  `private-evidence/debug-scans/2026-08-10/2026-08-10-orange-ipad-beta15-99-immediate-failure/debug.json`
  (7,797 bytes; SHA-256
  `00b17bff9d94abc12d1a379388602b76e377a86cce7ab5d15c1027b8d887150e`).
  It is private/ignored and must not be committed.
- The export identified the exact regression: `ReferenceError: Can't find
  variable: total` inside the Debug-Scan-only preprocess statistics branch.
  Shared-prefix refactoring moved `total` into the prefix builder, while the
  statistics ending still referenced it. Normal saved-capture replays do not
  enable `window.__SCANGRADE_DEBUG_PREPROCESS_STATS`, so the otherwise exact
  ten-capture comparison did not execute this branch.
- The physical trace nevertheless validates the new registration hot path:
  marker detection took 0.415 seconds, decisive orientation 0.466 seconds, and
  answer-box registration **0.676 seconds**, down from Beta 15.98's 9.272
  seconds. Tensor preparation then threw before completing; no grading result
  exists and Beta 15.99 must not be treated as a successful speed test.
- Beta 15.100 restores `total = width * height` in the finalized extraction
  scope. A permanent browser verifier enables the real statistics array and
  executes `preprocessToMNISTWithDebug`; Chromium and WebKit both produced one
  complete finite 96×112 statistics record and a finite 784-value tensor.
  Static regression coverage also locks the scoped total declaration.
- The old-Safari-only landing top padding moves from 96 px to 120 px at Tony's
  request. Capture/grading placement and modern-device CSS remain unchanged.
- Build label: `2026.08.10-legacy-debug-stats-hotfix-beta-15-100`. **Do not
  claim success until automatic grading and timing are physically verified on
  the orange iPad.** Complete suite **486/486**, the Chromium/WebKit Debug-Scan
  statistics verifier, deploy-pruned build, and `git diff --check` pass. Source
  commit `5ee0e6a` is pushed on `autobuild/safe-20260223`.
- Static preview: `https://b6fe004d.scangrade.pages.dev/`. Production
  immutable: `https://4f1cab2f.scangrade.pages.dev/`. Public production:
  `https://scangrade.io/`. Local/preview/immutable/public HTML SHA-256:
  `a99463ad0d86cf98fc5035031f4cc86e374a73cbef81d3a7f98da08de333703b`.
  JavaScript `assets/index-BPrPyP0O.js` SHA-256:
  `53cd6ee6316653317accf626be205101714bbdb176a96b176cd9804f60224a8f`.
  CSS `assets/index-x9tuAvbJ.css` SHA-256:
  `37e9dc61cb3e8c81f6a06c5f9af61c149bf437c086428e18797d2dba3d971386`.
  ONNX JavaScript `assets/onnx.min-C2otTiac.js` SHA-256:
  `d4241e1ba7a65b3edae9a5025037e92f4464ceb266836df8b0dde12ed0ecf2e7`.
  Deployment used the isolated 254-file static directory; API-shaped routes
  return the identical current app shell and no Functions bundle is attached.

### 2026-08-10 Beta 15.100 physical success and Beta 15.101 diagnostic-stat speed candidate

- Tony physically ran Beta 15.100 on the orange iPad and reported about 28
  seconds from capture until marking. This is the definitive compatibility
  success required by the active mission: all six questions were graded
  automatically, `questionReviewCount` was zero, every `questionReview` value
  was false, every `questionCorrect` value was true, and neither
  `digitEngineFallback` nor `reviewOnlyFallback` activated. The engine was the
  intended legacy `onnxjs-webgl` route. This was not an all-yellow fallback.
- The passive trace reached `result ready` at 23.315 seconds. Main stages were
  marker detection 1.333 seconds, orientation 0.601 seconds, answer-box
  registration 0.837 seconds, tensor preparation 7.262 seconds, model
  initialization 2.931 seconds, inference 5.422 seconds, and final optional
  result work 1.663 seconds. Debug export/save happens after `result ready`, so
  it is not included in that 23.315-second OCR trace; Tony's approximately
  28-second observation may additionally include marking/UI time and evidence
  handling.
- The compact physical export is preserved privately at
  `private-evidence/debug-scans/2026-08-10/2026-08-10-orange-ipad-beta15-100-stage-trace/debug.json`
  (239,838 bytes; SHA-256
  `0e56a1cabd663fca67d4040aeddd829ce64a17f8bf30321b21e317de2092bb78`).
  It is ignored and must not be committed.
- Debug Scan, unlike ordinary Start Scan, computes and exports preprocessing
  summaries for all 144 tensor variants. The old implementation repeatedly
  converted typed arrays into ordinary arrays and used large spread calls.
  Beta 15.101 replaces only those diagnostic reductions with allocation-free
  scalar loops. A permanent parity test confirms the summaries are exactly
  equal to the former calculation, and the real debug-preprocessing verifier
  passes in Chromium and WebKit.
- The physical-size 144-summary benchmark measured 91.0 ms versus 4.2 ms in
  Chromium (21.7x) and 68.0 ms versus 4.0 ms in WebKit (17.0x). These modern
  figures validate the removed work but do not predict the old iPad's absolute
  saving. Recognition tensors, model calls, confidence, review policy, grading,
  capture, homography, layout, UI, and modern-device behavior are unchanged.
- Build label: `2026.08.10-legacy-debug-stats-speed-beta-15-101`. Complete suite
  **487/487**, exact diagnostic parity, Chromium/WebKit real-path verification,
  browser benchmarks, production build, and `git diff --check` pass.
- Source commit `58cbb20` is pushed on `autobuild/safe-20260223`. Static-only
  preview: `https://1677309f.scangrade.pages.dev/`. Production immutable:
  `https://a642c969.scangrade.pages.dev/`. Public production:
  `https://scangrade.io/`. Local/preview/immutable/public HTML SHA-256:
  `218807707ebb569d261dc188b1a4519063b77571171eabd20a0d4f86033a590d`.
  JavaScript `assets/index-Cwmhi-Yn.js` SHA-256:
  `dd5fc8b4f35c3cd8a8e3b48bfa9ad87248af4616a725e42e78e4a266ad359ae1`.
  CSS `assets/index-BSf2uRRR.css` SHA-256:
  `456d17d1f001a4fc0811f6579489b907c94a3e5089e70079ee6121c17c58892d`.
  ONNX JavaScript `assets/onnx.min-lF6kYrbw.js` SHA-256:
  `62ae1a2c6a6ad18684116f28b903ddd583429dfad575a215b6d311e06695d32a`.
- Deployment used the isolated 254-file static directory. Root,
  `/api/submissions`, and `/review-model/health` are byte-identical static app
  shells. A first preview (`b9d3e4be`) was accidentally launched from the
  repository working directory and therefore discovered the dormant D1
  Function; the pre-production route check caught it. It was preview-only,
  never reached the custom domain, and was superseded by launching Wrangler
  from inside the isolated directory. The final preview and production uploads
  showed no Functions compilation or upload.
- **The original orange-iPad automatic-grading compatibility problem is now
  physically solved, but the newer under-20-second target is not yet verified.**
  After deployment, run one ordinary Start Scan for product-path timing, then
  one Debug Scan only if an export is needed. Do not claim under 20 seconds
  until the orange iPad physically demonstrates it.
