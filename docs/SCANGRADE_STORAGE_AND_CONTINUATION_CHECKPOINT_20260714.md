# ScanGrade storage and continuation checkpoint — 2026-07-14

## Exact state before storage offload

- The browser's existing recognition, confidence, grading, and yellow/red/green behavior remain the automatic authority.
- The optional strong whole-answer reader is key-blind, review-only, fail-open, and now receives only answers already marked yellow.
- Matched ten-page replay retained handwritten truth among review choices for 14/14 yellow answers. Strong answer-frame requests fell from 240 to 42 (82.5% fewer), and mean added suggestion wait fell from 9.18 s to 6.05 s.
- CPU compression was tested and rejected: dynamic int8 failed 0/8 parity and regressed memory/latency; float16 and bfloat16 retained 8/8 smoke parity but were about 7.7× and 8.7× slower than float32.
- The fourteen-yellow visual audit found no primary camera-quality failures. Two answers had definite blank/misaligned crops, and at least eight showed material loss between the readable raw crop and the 28×28 local model representation.
- The next technical objective is to determine how much yellow work can be handled locally by preserving a larger grayscale representation, without delegating it to the strong service and without changing the frozen automatic policy until replay passes.
- Nothing from the yellow-only, compression, or crop-quality work has been deployed or pushed.

Primary reports:

- `docs/SCANGRADE_YELLOW_ONLY_AND_COMPRESSION_20260714.md`
- `docs/SCANGRADE_YELLOW_CROP_QUALITY_AUDIT_20260714.md`
- `private-evidence/reports/v3-review-workflow-yellow-only-20260714.json`
- `private-evidence/reports/v3-authenticated-review-service-test-20260714.json`
- `private-evidence/reports/v3-authenticated-review-service-int8-test-20260714.json`
- `private-evidence/reports/v3-authenticated-review-service-float16-test-20260714.json`
- `private-evidence/reports/v3-authenticated-review-service-bfloat16-test-20260714.json`

## Storage situation

At checkpoint time the internal data volume had approximately 562 MiB free. `/Volumes/Tony's Rugged HD` was mounted with approximately 399 GiB free.

The intended offload contains only archival/reproducible experiment outputs:

- `benchmarks/uploaded_student_samples` — approximately 8.0 GiB of older generated replay outputs.
- `private-evidence/sg3-9-photo-confidence-20260606` — approximately 3.6 GiB of superseded June experiment variants.

The offload must not include the current `private-evidence/debug-scans`, truth labels, four-packet sequence corpus, current reports, active models, source code, layouts, tests, or untouched evaluation material.

Backup destination:

`/Volumes/Tony's Rugged HD/Codex/ScanGrade Offloads/2026-07-14-pre-large-grayscale/`

After copying, verify file counts, total byte counts, and a deterministic SHA-256 manifest before removing the local copies. Retain a small restore manifest in this repository.

Offload completed successfully. The checksum-mode `rsync` comparison found no file differences, both file counts matched, and the two local archival copies were removed. Internal free space increased to approximately 13 GiB. Restore details are in `docs/SCANGRADE_RUGGED_OFFLOAD_MANIFEST_20260714.md`.

## Continuation protocol

1. Build a reproducible local-only evaluation lane that consumes the existing larger continuous grayscale answer zones.
2. Keep handwritten truth scoring separate from inference; do not provide answer keys to recognition.
3. Compare against the exact frozen/current browser output on all available existing packet artifacts.
4. Test whether larger inputs fix the two blank/misaligned cases and the stroke-loss cases identified in the yellow audit.
5. Measure total transcription accuracy, zero-error automatic coverage, yellow count, per-layout results, runtime, memory, download size, and old-device feasibility.
6. Begin as shadow/review evidence. Promote nothing into automatic grading unless a matched replay produces no new confident transcription errors and passes held-out packet/student/template gates.

## Continuation result

The larger-grayscale investigation is complete and documented in `docs/SCANGRADE_LOCAL_LARGE_GRAYSCALE_INVESTIGATION_20260714.md`.

- Existing compact top-three candidate availability is 232/275 across the four recent packets and 10/14 on current yellows.
- Existing browser alternatives plus compact candidates cover 11/14 current yellows locally.
- A narrow robust-geometry rescue detected four outliers and increased selected compact truth availability by one, but did not solve the three residual yellow answers.
- Synthetic replacement training, fixed layout crops, high-resolution band-pass digit preprocessing, and Apple Vision did not pass their gates.
- No production recognition or grading behavior changed. The strong reader remains yellow-only, review-only, optional, and fail-open.
