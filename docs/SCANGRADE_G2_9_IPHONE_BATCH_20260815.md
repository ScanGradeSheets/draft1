# ScanGrade G2-9 iPhone Batch — 2026-08-15

## Scope

- Device/runtime: iPhone, iOS 18.7, Mobile Safari 26.4.
- Public build: `2026.08.15-known-packet-batch-beta-15-112`.
- Route: `/debug/batch?packetId=G2-9&liveOcrDebug=1`.
- Cohort: the nine previously documented Grade 2 legacy sheets in
  `docs/SG3_9_PHOTO_OCR_SCORECARD.md`.
- This is a backward-compatibility cohort. Do not mix it into the primary
  Grade 1 packet launch metric.
- No manual corrections were entered. Results below are the untouched
  automatic decisions.

## Completeness

- Nine distinct scan sessions arrived.
- Template balance is exact: three Addition Within 20, three Subtraction
  Within 20, and three Mixed Within 50.
- Each session contains the captured page, warped page, marked result, 20 raw
  crops, 20 model inputs, predictions, QR/layout metadata, and capture/model
  telemetry.
- Each scan uploaded an `ocr-complete` record and an
  `accepted-answer-safety-shadow-complete` record. These share one session ID
  and count as one scan, not two.

## Handwritten-truth result

| Metric | Result |
| --- | ---: |
| Total questions | 90 |
| Automatically resolved questions | 66 / 90 (73.3%) |
| Questions sent to review | 24 / 90 (26.7%) |
| Correct automatic question reads | 66 / 66 (100%) |
| Confident wrong question reads | 0 |
| Total digit slots | 180 |
| Automatically resolved digit slots | 151 / 180 (83.9%) |
| Digit slots sent to review | 29 / 180 (16.1%) |
| Correct automatic digit reads | 151 / 151 (100%) |
| Confident wrong digit reads | 0 |

The matching used the locked handwritten truth in the existing scorecard.
Where two sheets have identical truth, exchanging their identities does not
change any metric. All non-identical sheets were distinguishable from their
handwritten answer vectors. Reviewed predictions were not treated as automatic
reads.

## Automatic question coverage by scan

| Template | Automatic | Review | Confident wrong |
| --- | ---: | ---: | ---: |
| Addition 1 | 7 | 3 | 0 |
| Addition 2 | 9 | 1 | 0 |
| Addition 3 | 8 | 2 | 0 |
| Subtraction 1 | 6 | 4 | 0 |
| Subtraction 2 | 9 | 1 | 0 |
| Subtraction 3 | 9 | 1 | 0 |
| Mixed 1 | 7 | 3 | 0 |
| Mixed 2 | 3 | 7 | 0 |
| Mixed 3 | 8 | 2 | 0 |

## Timing telemetry

- Median capture-gate time: 6.166 seconds.
- Median OCR time after accepted capture: 2.235 seconds.
- Median time from accepted capture through receipt of the completed safety
  shadow bundle: 15.223 seconds. This includes evidence encoding and upload;
  it is not the public marking-start latency.

## Interpretation and next gate

- The safety policy was conservative and clean: it produced zero confident
  wrong OCR reads on this cohort.
- Automatic coverage is materially below the desired 90% question-level
  experience. Because these sheets predate the packet format, this does not by
  itself invalidate the current Grade 1 public engine.
- Do not tune from these nine alone. First run the already-used Grade 1 packet
  diagnostic cohort through the unchanged public engine. Only then compare
  residual patterns and evaluate reproducible candidate changes offline.
- Keep P01, P04, P06, and P07 sealed as prospective holdouts.

