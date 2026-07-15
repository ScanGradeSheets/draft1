# ScanGrade local-first yellow-review protocol — frozen 2026-07-14

## Purpose

Test whether ScanGrade can resolve most yellow answers with immediate key-blind compact-model choices and reserve the optional strong reader for an explicit teacher request.

This protocol changes review assistance only. It must not alter capture acceptance, page registration used by production OCR, digit transcription, confidence, mathematical grading, red/green/yellow status, or automatic coverage.

## Frozen order of operations

1. Complete the existing browser OCR and grading path.
2. Identify yellow questions using the existing `questionReview` flags.
3. Send only their larger continuous grayscale zones to the compact reader.
4. Preserve the existing three browser choices and append at most three distinct compact alternatives: no more than six immediate choices. The third compact choice was retained only after the exact 40-page replay improved immediate truth availability from 78/104 to 88/104, removed no existing choice, and changed no automatic result.
5. Do not request strong inference during initial page processing when local-first mode is enabled.
6. Show an explicit **None of these** action for each yellow answer.
7. Only that action may request strong inference for that one question's retained frames.
8. If strong inference succeeds, add at most one distinct key-blind suggestion (seven choices maximum) without removing the current transcription or an existing correct local choice.
9. If it fails, times out, or the service is unavailable, keep manual entry and all local choices usable.
10. Neither compact nor strong output may automatically change a grade.

## Privacy and truth separation

- Recognition requests may contain image identity fields and answer images only.
- Answer keys, expected answers, mathematical correctness, handwritten truth, and teacher corrections are forbidden model inputs.
- Handwritten truth is joined only in offline evaluation.
- Requests and responses remain `no-store`; optional service failure is fail-open.

## Acceptance gates

### Invariants

- Automatic browser reads, confidence, grading, and yellow flags are exactly unchanged on matched replay.
- Zero new automatic transcription errors.
- Current browser transcription remains the first review choice.
- No previously available correct local choice disappears.
- Candidate lists contain no duplicates, preserve the three-choice browser control, and never exceed six before **None of these**.
- Strong inference is absent from initial processing in local-first mode.
- One **None of these** action sends only one yellow question, never the page or non-yellow answers.
- Manual entry works during compact outage, strong outage, timeout, malformed response, and model-load failure.

### Evidence targets

- Report four-packet overall, packet, row/non-row, and layout results.
- Report historical development/validation/holdout separately.
- Report local truth-choice availability, strong-fallback truth-choice availability, list sizes, and answers that lose an existing correct choice.
- Measure local-result latency, compact-choice latency, on-demand strong latency, request count, bytes, model memory, and old-device/browser behavior.
- Report teacher actions for local success, **None of these** success, and manual entry.

## Stop conditions

Reject or revise the candidate if it changes any automatic result, removes a correct existing choice, sends strong work before an explicit request, leaks answer-key context, requires strong availability to finish review, or obtains an apparent gain only by tuning against the three known residual yellow answers.

## Deployment boundary

This work remains behind an experimental query flag until all gates pass. Do not deploy or push without Tony's approval.
