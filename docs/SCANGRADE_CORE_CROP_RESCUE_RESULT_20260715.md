# ScanGrade selected-core-crop rescue result — 2026-07-15

## Verdict

The larger grayscale reader can safely recover most of Candidate 3's compact-model vetoes when its original selected answer image, a 2% interior trim, and a 4% interior trim all produce the same transcription, and the existing three retained frames also agree. With an additional rule that no existing ambiguity or confidence-safety veto may be overridden, the four-packet development replay reaches **250/275 automatic (90.9%), 250/250 correct, zero observed automatic transcription errors**.

This is a strong private candidate, not a launch accuracy claim. The four packets and templates have influenced development. The initial experiment was opt-in only (`v3CoreCropEvidence=1`); the deployment addendum below records its later private-beta promotion after second-stage routing passed.

## Deployment addendum — second-stage implementation

The release implementation no longer sends the three core-crop views for every yellow answer. It first applies Candidate 3, then requests core-crop evidence only for unresolved compact-support or stable-browser-conflict vetoes that have no ambiguity flag.

- Exact 40-page result remains 250/275 automatic, 250/250 correct.
- Final answer groups match the eager implementation on all 40 pages.
- Core-crop workload fell from 309 images on 36 pages to 48 images on 14 pages (84.5% fewer images).
- Real warmed tailnet WebKit timing was 3.93 seconds to the local result and 21.64 seconds to optional consensus; warm repeat was 4.02/21.32 seconds.
- Deliberate optional-model outage remains fail-open.

This was promoted to private beta 4 only. Public behavior and public claims remain unchanged.

## Frozen control and residual inventory

Candidate 3 control:

- 237/275 automatic (86.2%), 237/237 correct.
- Rows: 144/160 (90.0%).
- Non-row: 93/115 (80.9%).
- 38 scorable yellow answers.

The 38 yellows comprised:

- 15 exact three-frame strong reads vetoed by the compact reader; 14 of those strong reads matched handwritten truth and one was the overwritten `34→39` case.
- 1 stable browser-preprocessing conflict; the strong read matched truth.
- 18 frame/strong-confidence instabilities; only 8 representative strong reads matched truth.
- 4 confidence-safety vetoes; 3 representative strong reads matched truth, but the vetoes deliberately remain absolute.

Inventory: `private-evidence/reports/candidate3-yellow-inventory-20260715.json`.

## Key-blind crop experiment

The recognizer received only answer images and identifiers. It did not receive answer keys, mathematical correctness, handwritten truth, or teacher corrections. Truth was joined after inference for scoring.

Eleven selected-image variants were tested. The useful conservative rule required exact agreement among:

1. the selected grayscale answer image;
2. the same image trimmed 2% on all edges; and
3. the same image trimmed 4% on all edges.

Among the 15 compact-veto answers this selected 13, all 13 correct. It rejected the dangerous overwritten `34→39` because the 4% trim changed the strong read to `30`. The browser-conflict answer was also selected correctly. One further correct veto remained yellow because its 4% trim duplicated `12→1212`.

The current 5 MB compact model failed the same test: its original view was correct on only 6/38 yellows, its best variant on 8/38, and its three-view agreement selected 11 compact-veto answers that were all wrong. Crop variation cannot turn the current compact model into the strong reader.

Reports:

- `private-evidence/reports/candidate3-yellow-multicrop-20260715.json`
- `private-evidence/reports/candidate3-yellow-multicrop-compact-20260715.json`

The historical-crop script found no saved V3 zones in the older referenced debug artifacts, so that run selected zero answers and is explicitly inconclusive: `private-evidence/reports/candidate3-historical-core-crop-stress-20260715.json`.

## Browser integration result

The first integration run exposed a service-control mismatch: a temporary compact service returned three choices while frozen Candidate 3 returned one. The result happened to remain 251/275 with zero observed errors, but it was rejected as an unmatched control.

The exact frozen services were then replayed over all 40 pages. Before the final ambiguity guard, the result was 251/275 and zero errors. One rescued answer carried the existing `override-retained-material-rival` ambiguity flag. Although its strong transcription was correct, repeated views from one model must not weaken an existing handwriting warning. The candidate was tightened so core-crop evidence cannot bypass any ambiguity signal.

Final result:

- 40/40 pages completed; 280/280 answer groups present.
- 275 scorable values; five ambiguous truth labels excluded.
- **250/275 automatic (90.9%).**
- **250/250 correct; zero observed automatic transcription errors.**
- 25 yellow/manual-review answers.
- Rows: 150/160 (93.8%).
- Non-row: 100/115 (87.0%).
- P08 64/70, P03 61/67, P09 65/70, P02 60/68.
- 13 new automatic answers versus Candidate 3, all correct; no prior automatic answer was removed or changed.
- The overwritten `34` remained yellow.
- The ambiguous written `15` remained yellow despite matching strong views.

Score: `private-evidence/reports/core-crop-candidate-score-final-20260715.json`.

## Reproducibility and compatibility

Two complete 40-page matched replays produced identical strong, alternate-crop, core-crop, and compact evidence. Thirty-nine pages were entirely identical. The only final-output difference was the intended ambiguity guard on P03 mixed Q8. Reproducibility report: `private-evidence/reports/core-crop-candidate-reproducibility-20260715.json`.

The full JavaScript suite passed 109/109, the production build passed, and `git diff --check` passed.

A secure HTTPS WebKit/mobile-emulation run completed, applied experimental promotions, regenerated the marked sheet, and kept the overwritten `34` yellow. It took 3.95 seconds to display the local result and 26.96 seconds to complete all optional strong evidence, versus 13.59 seconds for the earlier candidate on the same saved page. This proves fail-open browser compatibility, but the extra crop request is too slow for release and must be routed only to the small subset still vetoed after the first-stage consensus. Report: `private-evidence/reports/core-crop-candidate-webkit-secure-20260715.json`.

An HTTP WebKit replay correctly failed open because Safari blocks HTTPS-to-HTTP mixed content; local grading completed and the answer remained yellow. This is not a model failure and reinforces the same-origin authenticated deployment requirement.

## Other residual groups

The final 25 yellows are:

- 18 insufficient frame/strong-confidence consensus;
- 4 confidence-safety vetoes;
- 3 compact vetoes (two strong reads match truth, one is the overwritten `34→39` case); and
- 0 remaining stable browser conflicts.

A narrow post-hoc dual-crop rule selected 1/18 unstable answers correctly. A very strict primary/alternate/core agreement rule selected 2/4 safety-veto answers correctly. Neither is adopted: both were formulated after observing these development residuals, and weakening the safety veto on the same evidence would be overfitting. Report: `private-evidence/reports/candidate3-residual-experiments-20260715.json`.

## Can the Mac mini be removed?

Not yet if the target is the demonstrated 90.9% candidate. The 13-answer gain comes from the 335M-parameter adapted TrOCR reader. The current browser/compact model cannot reproduce it, and the tested dynamic-int8, float16, and bfloat16 CPU variants were either inaccurate or much slower.

The Mac mini is not a single point of total product failure: every optional reader is fail-open. If it is unavailable, ScanGrade still captures, performs browser OCR, grades safe answers, displays more yellow reviews, supports manual correction, and regenerates the marked sheet. What disappears is the higher automatic coverage and strong review suggestions.

The best long-term architecture is therefore:

1. retain local browser grading as the always-available base;
2. send only unresolved yellow answers to an authenticated strong service;
3. move that service from the home Mac to a small hosted CPU service before a public launch; and
4. in parallel, distill/train a genuinely stronger ScanGrade-specific browser model from key-blind real and synthetic answer crops.

There is no credible permanently free cloud tier with the privacy, uptime, memory, and latency guarantees needed for a paid classroom product. A free tier can host a prototype, not remove operational risk. Because only yellow answers are sent, a paid scale-to-zero service should be inexpensive enough to measure in beta before choosing a provider.

## Next decision

Private beta 4 now replaces Candidate 3 on the private tailnet URL. Keep `?consensusCandidate=0` as the immediate rollback. Before any public accuracy claim or broader launch, require a physical older-iPad sustained multi-page test, improve the roughly 21-second optional completion time, and validate without retuning on genuinely unseen packets or prospective beta traffic.
