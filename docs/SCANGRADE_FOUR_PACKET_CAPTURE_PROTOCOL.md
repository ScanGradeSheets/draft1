# ScanGrade four-packet prospective capture protocol

Status: approved test design for the remaining authentic paper corpus. This protocol consumes four of twelve intact packets and preserves eight unscanned.

## Why packets stay intact

Do not remove staples or mix pages across students. A mixed pile may look more diverse answer by answer, but it destroys the ability to measure whether the system generalizes to an unseen writer and hides packet-level correlation. Random selection gives a fair handwriting mix without sacrificing trustworthy evaluation.

## Assignment

1. Without judging handwriting, label the physical packets `P01` through `P12` in their existing pile order.
2. Generate and privately save a randomized assignment:

   ```bash
   npm run plan:four-packet-capture -- --out private-evidence/capture-plans/four-packet-plan.json
   ```

3. The plan assigns three packets to development, one to locked test, and eight to `reserveUnscanned`.
4. Do not substitute a packet because its writing looks unusually neat or messy. Record physical damage before scanning; do not exclude it silently.

The frozen assignment for this run is `P08`, `P03`, `P09`, then locked `P02`. Every capture URL must include its packet ID, assigned role, and the plan seed from `private-evidence/capture-plans/four-packet-plan.json`. The app records these fields plus a stable scan-session ID in every initial and correction upload.

## Before scanning all pages

- Use the same deployed app build for all four packets. Record its exact Git commit/build hash in the capture ledger.
- Enable V3 shadow (`hybridV3=1`) and private debug capture. Supply the approved review-model URLs only for this private test. Confirm that one page from `development-1` produces the selected capture, continuous V3 zones, OCR trace, and up to three burst frames.
- Confirm Mission Control receives the debug bundle before proceeding.
- Use diffuse room light, avoid a hard phone shadow, keep the device approximately parallel, and let automatic capture settle. Do not use camera enhancement or edit the images.
- If the app requests a retake, retain the failed attempt in debug evidence and then retake. Do not erase failures from the completion-rate denominator.

## Scan order and separation

Scan `development-1`, `development-2`, and `development-3` first. These packets may be labelled and used to repair implementation defects and freeze the policy.

Scan `locked-test` fourth with the same build and procedure. Store it privately, but do not compare its OCR with handwritten truth until all of the following are frozen:

- crop and normalization code;
- current OCR model and thresholds;
- whole-answer model and thresholds;
- cross-frame consensus policy;
- review-choice ordering;
- failure and timeout behavior;
- evaluation script.
- V3 blank/artifact thresholds and independent-fusion policy.

The locked packet may expose a catastrophic capture or storage defect before unblinding. If that happens, document the defect, invalidate the entire locked packet before reading transcription truth, repair the defect, and randomly promote one of the eight untouched packets to the replacement locked test.

Immediately before opening locked truth, freeze the policy:

```bash
npm run freeze:v3-policy
```

Locked evaluation requires both `--include-locked` and the freeze manifest. It refuses to run if any frozen source, model, layout, evaluator, or packet-plan file has changed.

## Truth labelling

- Label exactly what the student wrote, including incorrect math.
- Keep blank, erased, crossed-out, overwritten, and unreadable as separate states.
- A second pass must review every ambiguous label and a sample of ordinary labels.
- Never derive transcription truth from the answer key, grade result, model suggestion, or teacher correction history.
- Keep student identity pseudonymous and keep all images and labels outside Git.

## Head-to-head measurements

For every answer retain:

- packet, page, question, layout family, side/slot, and answer length;
- original handwritten truth and label state;
- control transcription, confidence, and automatic/yellow decision;
- Hybrid V2 frame reads, consensus, alternatives, and shadow decision;
- V3 slot, sequence, compact, blank/artifact, per-frame, and shadow decisions;
- mathematical correctness as a separate field;
- teacher final choice, source, correction, and review duration;
- capture attempts, retakes, failure reason, device, and processing time.

The app records bounded camera-gate attempt counts, rejection reasons, and elapsed capture time on the eventual scan bundle. These are diagnostic metrics only and do not change capture acceptance.

Primary comparison:

- confident transcription errors;
- automatic coverage;
- correct one-tap choice availability among yellow answers;
- final transcription accuracy after review;
- median and 90th-percentile review time;
- capture and grading completion rates.

Generate the development truth template only after the development scans arrive:

```bash
npm run template:hybrid-truth
```

The template deliberately omits answer keys. Every scorable row requires two distinct labelers and `qaStatus: "verified"`.

Run development scoring with:

```bash
npm run eval:hybrid-prospective
```

The evaluator groups correction uploads with their original scan session, rejects duplicate successful scans of the same packet/layout instead of selecting one, reports failed capture sessions, keeps mathematical correctness separate, and excludes ambiguous truth states from transcription metrics.

## Decision rule

Hybrid V2 can become the default review assistant if the locked packet has no increase in wrong final transcriptions and either:

- median yellow-answer review time improves by at least 25%; or
- correct one-tap choice availability improves by at least 20 percentage points.

Automatic promotion remains disabled unless the combined authentic prospective evidence contains no confident V3 errors—including incorrect student math—and is large enough for a defensible error-rate bound. One small locked packet cannot establish that claim by itself. The eight reserve packets remain untouched unless a pre-truth technical invalidation requires a randomized replacement or a later, separately pre-registered test.
