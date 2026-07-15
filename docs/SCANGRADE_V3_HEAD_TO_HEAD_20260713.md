# ScanGrade V2 versus V3 head-to-head — pre-prospective status

## Bottom line

V3 is now a working shadow architecture, not a replacement OCR claim. It preserves better evidence, adds two different whole-answer readers, processes multiple capture frames, and fails open. On already-used historical evidence, however, its conservative fusion did not improve automatic coverage on the holdout block. The next honest decision requires the four intact packets.

| Measure | V2 control | V3 historical shadow |
|---|---:|---:|
| Broad labelled corpus | 582 answers | Same source corpus; already touched by R&D |
| Automatic result | 323/582 (55.5%) | No production changes authorized |
| Confident errors | 0/323 | 0 in selected validation/holdout fusion |
| Validation fusion | Control plus 5 safe promotions | 88/136 accepted, 0 wrong |
| Holdout fusion | Control unchanged | 86/114 accepted, 0 promotions, 0 wrong |
| Reader ceiling | — | At least one reader correct on 109/114 holdout |
| Service outage | Local grading available | Identical local output; V3 suggestions absent |

The gap between 109 answers having a correct candidate and only 86 being safely accepted is the central V3 problem. A more permissive selector is not justified: the learned readers agreed on the wrong transcription five times in the historical holdout.

The blank/artifact lane is recorded on every answer but is advisory. Its four available blank labels are insufficient to authorize a hard veto, and a real-capture replay demonstrated that its artifact score overflags faint pencil/printed-rule combinations. Enabling a veto requires prospective manual artifact labels and a frozen calibration test.

## Prospective success gates

V3 may become the default review assistant after development and locked testing if:

1. no V3 suggestion silently changes a grade;
2. no increase in final transcription errors;
3. correct one-tap choice availability among V2-yellow answers improves by at least 20 percentage points, or median review time falls at least 25%;
4. capture/grading completion is at least 98% excluding documented unsupported-device failures;
5. p90 asynchronous suggestion time is at most 3 seconds on the intended service;
6. an optional service outage leaves successful local grading and correction;
7. packet P02 is opened only after `npm run freeze:v3-policy`.

Automatic V3 promotion has a higher bar: zero confident errors on the prospective evidence, including incorrect student math, plus a one-sided 95% upper confidence bound that is commercially tolerable. Four packets cannot establish a “near-zero error” marketing claim, so promotion should remain shadow/manual even if this test is clean.

## Decision outcomes

- If V3 improves choices/review time but not automatic coverage: launch it as an optional review assistant with local fallback.
- If V3 safely improves automatic coverage on development and locked packets: keep it shadowed through a larger September validation before enabling promotion.
- If V3 adds latency or complexity without teacher benefit: keep only continuous artifacts/telemetry and remove the remote runtime from launch.
- If failures cluster by layout: train/layout-calibrate only after preserving packet-level separation; do not pool answers randomly.
