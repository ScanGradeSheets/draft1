# ScanGrade no-new-packet improvement review — 2026-07-14

## Executive conclusion

The saved evidence supports one production-facing improvement now: make uncertain row-sheet answers much faster to review by showing a whole-answer suggestion when the same key-blind read appears on at least two of the three retained frames. This does **not** turn a yellow answer green, does not change the transcription used for grading, does not consult the math key, and adds no inference work.

On the complete four-packet row replay (20 pages, 160 answers), there were 14 yellow answers. The handwritten truth was available among the displayed tap choices for all 14 after the change, versus 11 before it. All 12 model-derived row suggestions were correct. The 160 browser transcriptions, review decisions, and math-correctness decisions were byte-for-byte unchanged.

The same relaxed display rule is unsafe on non-row pages. P09 number-pattern Q1 was written `34`, while the large reader returned `39` on all three frames with minimum consensus confidence 0.938. The implementation therefore keeps the old strict 0.98 single-frame threshold for six-answer/non-row layouts. A fresh replay verified that `39` is no longer displayed. Automatic grading was never changed.

No crop change, new automatic selector, custom model, writer adaptation, or blank detector cleared the zero-error and no-regression gates. Those experiments remain rejected or shadow-only. Do not spend another untouched packet on these unchanged candidates.

## Evidence boundaries

- Handwritten truth, OCR transcription, math correctness, confidence, and teacher correction were kept separate.
- The answer key was not used as handwriting truth or sent to either learned recognizer.
- P08 and P03 supplied development data; P09 was used as validation; P02 was evaluated once after model selection. P02 is no longer a pristine final holdout because its crops and labels had already been inspected during the requested crop audit.
- Two overwritten P02 answers and three overwritten development answers were excluded from value scoring. There were no verified clean blanks in these four packets.
- The four students and ten fixed templates remain far too small for a market-wide accuracy claim.

## What was tested

| Candidate | Measured result | Decision |
|---|---|---|
| Eight-frame two-column crop assignment | Recent matched replay: V2 110/160 to 112/160 automatic, both zero errors; overlay 140/160 to 146/160, both zero errors. Historical 33-page test lost one large-model automatic read (200 to 199); compact lane unchanged at 223. | Keep opt-in for research; production default restored. It is not a general improvement. |
| Alternate crop as a second review lane | 30 extra frame operations and 42 extra recognition items across 20 row pages; zero distinct choices and zero added correct choices. | Reject. It adds latency without user value. |
| Multi-crop candidate availability | Among 50 reviews, the correct answer was available in 45 control cases and 48 in the union, but no safe 3-of-3 automatic consensus gain resulted. | Diagnostic only. Selection remains unsafe. |
| Packet-aware compact sequence models | Three predetermined seeds scored 45/70, 37/70, and 40/70 on P09 validation, below the existing compact reader. | Reject. |
| Generic-base TrOCR adaptation | Best P09 validation result was 28/70. | Reject. |
| Gentle continuation of existing adapted TrOCR | P09 improved from 54/70 to 56/70; one P02 audit scored 44/68 versus 34/68 on the original crop. On the five alternate-crop pages per P09/P02 it improved only 70/80 to 71/80 and reduced conservative V3 accepts from 20 to 16. | Keep as a possible future review/shadow model; do not replace or auto-promote. The gain is real but not a safe product jump. |
| Writer-adaptive nearest handwriting prototypes | Automatic zero-error gate accepted 0. Even teacher-confirmed upper-bound prototypes made 1/3 validation and 4/7 P02 audit errors. | Reject. Same-writer similarity is not reliable enough. |
| Existing artifact/blank probability | Mean score 0.92 and 274/280 answers at least 0.5; the only predicted blank candidate was a written `9` whose crop lost ink. | Reject for automation. No clean blank sample exists in this packet set. |
| Capture-quality correlations | Focus, lighting, perspective, and related page metrics had weak associations with review; the largest simple correlation observed was only about 0.25. | Do not blame the camera globally. Page geometry, layout, and recognition dominate the remaining failures. |
| Relaxed row review suggestions | 14/14 yellow row answers had truth among tap choices; 12/12 model-derived choices were correct. Grading output changed on 0/160 answers. | Adopt for row review only. |
| Relaxed non-row review suggestions | Produced one convincing but wrong `39` suggestion for handwritten `34`. | Reject; retain strict non-row display threshold. |

## Fidelity and crop diagnosis

The original observation was valid: several black model-input thumbnails were visibly worse than the pencil writing on the captured page. The end-to-end trace found multiple causes rather than one universal blur problem:

1. The original V3 warp sometimes inherited white cleanup masks from the V2 path. Re-warping from untouched camera pixels restores lost handwriting for the V3 review reader and remains the correct V3 source path.
2. A real two-column assignment defect mispaired answer frames on some eight-answer row pages. The narrow crop candidate fixes those pages, but its historical regression means it is not safe as the production default yet.
3. Most remaining number-bond and number-pattern crops already contain clear handwriting. Those are recognition/selection failures, not missing pixels.
4. Aggressive border, divider, and printed-line removal repeatedly damaged pencil strokes and reduced accuracy. It should remain rejected.
5. Photo focus, lighting, tilt, and perspective did not explain most review cases in these 40 accepted captures. Capture gates still matter for unusable pages, but tightening them will not deliver a large recognition jump on this corpus.

## Adopted review behavior

- Automatic/local grading remains the existing conservative browser policy.
- The optional whole-answer model remains key-blind and review-only.
- Row sheets may display a lower-confidence whole-answer choice only when at least 2/3 retained real frames agree, there is no duplicate of the browser transcription, and consensus minimum confidence is at least 0.80.
- Non-row sheets retain the existing 0.98 single-frame display threshold.
- Choosing a suggestion is one tap; after correction, V3 automatically opens the next yellow answer.
- Correction source, one-tap/manual status, and review duration are recorded without re-uploading images.
- Service timeout or outage leaves the local grading result intact and simply removes optional suggestions.

This changes the teacher's work, not the machine's claim. It should be described as “faster review of uncertain answers,” never as higher automatic accuracy.

## Runtime and deployment

The current adapted TrOCR service, running offline on the Mac Mini CPU, loaded in 0.25 seconds and measured:

- one answer: 235 ms round trip;
- eight answers: 1.51 seconds;
- 24 answers: 4.27 seconds;
- answer-key-bearing requests: rejected.

That is acceptable for asynchronous suggestions but not for making the Mac Mini a single point of failure. The app already fails open: local grading completes without the service. For private beta, the best architecture remains a small authenticated cloud service for the optional reader plus permanent local fallback. The earlier hosting review recommends Cloud Run for the compact reader; the large TrOCR reader needs a separate container memory/cold-start measurement before choosing its cloud configuration. No “free forever” promise is justified.

## Verification

- Full JavaScript suite: 41/41 passing.
- TrOCR confidence tests: 2/2 passing.
- Production build: passing.
- Matched row replay: 20/20 pages, 160/160 answers compared, zero grading/review-decision differences.
- Review-choice replay: truth available 14/14 row yellows.
- Non-row safety replay: the known wrong `39` choice is hidden.
- Service benchmark: answer-key rejection passed.

## Launch recommendation from current evidence

Proceed toward a private/soft beta with:

1. the conservative browser OCR as the only automatic grading authority;
2. the adapted whole-answer model as an optional asynchronous review assistant;
3. the new row-sheet one-tap choices and auto-advance;
4. strict yellow review on non-row uncertainty;
5. explicit fail-open behavior when cloud or Mac inference is unavailable.

Do not enable the frozen whole-answer fallback for automatic grading. Do not deploy the broad eight-frame crop candidate. Do not enable writer adaptation or blank automation. Do not claim 90–95% automatic coverage or universal worksheet support.

The next decisive work is not another recognition sweep over these same four students. It is (a) a real teacher-timed review session using the saved scans, (b) authenticated cloud-container parity/outage testing, and (c) September evaluation on genuinely unseen students and captures. Preserve the remaining unscanned packets unless a materially new selector/model is frozen before opening one.

## Reproducible artifacts

- Main review result: `private-evidence/reports/v3-review-display-row-full-evaluation-20260714.json`
- Non-row safety result: `private-evidence/reports/v3-review-display-nonrow-safety-evaluation-20260714.json`
- Runtime: `private-evidence/reports/v3-review-service-runtime-20260714.json`
- Residual audit: `private-evidence/reports/v3-four-packet-residual-evidence-20260714.json`
- Crop matched comparison: `private-evidence/reports/v3-crop-matched-comparison-20260714.json`
- Historical crop comparison: `private-evidence/reports/v3-crop-historical-matched-comparison-20260714.json`
- Packet-aware service audit: `private-evidence/reports/v3-four-packet-packet-aware-continued-20260714.json`
- Writer adaptation: `private-evidence/reports/v3-writer-adaptive-knn-20260714.json`
- Review display policy: `src/v3/review-suggestion-display.js`
- Review display tests: `tests/v3-review-suggestion-display.test.mjs`
