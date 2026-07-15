# ScanGrade yellow-only strong review and compression test — 2026-07-14

## Decision

Adopt yellow-only routing for the optional strong review model. Do not adopt any of the three CPU compression modes tested on the current adapted TrOCR model.

This changes only which crops are sent to the optional strong review service. The browser still reads and grades every answer locally. Its transcription, confidence policy, yellow flags, red/green grading, and fail-open behavior are unchanged. The strong service remains key-blind and can only offer a teacher a review choice for an answer the browser already marked yellow.

## Matched real-UI replay

The same ten saved row pages and fourteen yellow answers were run before and after filtering strong-model work to yellow questions.

| Measure | All answers sent | Yellow answers only | Change |
|---|---:|---:|---:|
| Truth present among review choices | 14/14 | 14/14 | unchanged |
| Required taps | 24 | 24 | unchanged |
| Automatic advances | 4 | 4 | unchanged |
| Mean local result ready | 3.46 s | 3.43 s | unchanged within run noise |
| Mean strong suggestion ready | 12.63 s | 9.49 s | 24.9% faster |
| Added wait after local result | 9.18 s | 6.05 s | 34.0% faster |
| Strong answer-frame requests | 240 | 42 | 82.5% fewer |

Request counts are deterministic for this replay: ten pages × eight answers × three frames before, versus fourteen yellow answers × three frames after. Compact-reader items remain unchanged because they are inexpensive and also supply shadow evidence; automatic grading is unchanged.

Evidence:

- Before: `private-evidence/reports/v3-review-workflow-benchmark-20260714.json`
- After: `private-evidence/reports/v3-review-workflow-yellow-only-20260714.json`
- Routing tests: `tests/v3-review-suggestion-display.test.mjs`

## Compressed strong-model screen

Each candidate exercised the same authenticated service boundary and the same eight answer crops. These are local Apple-silicon CPU measurements, useful for rejecting bad candidates but not a substitute for a Linux cloud benchmark.

| Model mode | Reads matching baseline | Eight-answer inference | Resident memory | Decision |
|---|---:|---:|---:|---|
| Existing float32 | 8/8 | 1.56 s | 2,028 MB | Keep |
| Dynamic int8 linear | 0/8 | 6.46 s | 2,761 MB | Reject: accuracy, speed, and memory all regressed |
| Float16 | 8/8 | 11.95 s | 1,239 MB | Reject on CPU: 39% less memory but about 7.7× slower |
| Bfloat16 | 8/8 | 13.59 s | 1,239 MB | Reject on CPU: 39% less memory but about 8.7× slower |

All runs also verified bearer-token enforcement, origin restrictions, `no-store`, no request-payload logging, and rejection of answer-key input. Eight matching answers are only a parity smoke test, not proof that compressed accuracy generalizes. The latency regressions are already large enough to reject the half-precision CPU candidates without spending the broader held-out evaluation set.

Compression flags remain explicit experimental service options for reproducibility and are not enabled by default.

Evidence:

- `private-evidence/reports/v3-authenticated-review-service-test-20260714.json`
- `private-evidence/reports/v3-authenticated-review-service-int8-test-20260714.json`
- `private-evidence/reports/v3-authenticated-review-service-float16-test-20260714.json`
- `private-evidence/reports/v3-authenticated-review-service-bfloat16-test-20260714.json`

## Product implication

The useful cost reduction comes from sending less work, not weakening the reader. On the observed workflow, yellow-only routing removes more than four-fifths of expensive inference while preserving the review benefit. A production cloud host should therefore use the unchanged float32 reader, scale to zero when idle, cap batch/request size, preserve the local fail-open result, and be benchmarked on its actual Linux CPU before pricing or latency claims are made.

Nothing in this experiment was deployed or pushed.
