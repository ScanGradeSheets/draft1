# ScanGrade V3 Architecture Contract

V3 is an opt-in shadow system beside the preserved V2/control path. It may not change an automatic grade until a locked, key-blind policy passes the prospective packet gate.

## Non-negotiable boundaries

- The target is the student's written transcription, including incorrect math.
- Answer keys are excluded from recognition requests, model inputs, confidence features, and V3 promotion decisions.
- V2 remains available offline and is the immutable head-to-head control.
- A missing V3 model or network service cannot prevent capture, local OCR, review, correction, or recovery.
- Historical page-block splits are R&D evidence only. New packets must carry durable packet/student/template/device IDs.

## Evidence path

1. Capture retains a short burst locally and records per-frame capture quality.
2. Every usable frame is independently registered to the canonical 1700×2200 page.
3. The existing digit pipeline receives its existing slot crops unchanged.
4. V3 crops each complete answer once from the corrected page as continuous grayscale evidence. It never stitches digit crops.
5. Independent recognizers produce: slot OCR, whole-answer sequence OCR, and blank/artifact/quality evidence.
6. A key-blind abstention policy may accept only when independent evidence agrees under a locked threshold. Otherwise it asks the teacher.
7. Local grading returns first. Optional model suggestions arrive asynchronously and can improve review choices without blocking the scan.

## Artifact contract

Each V3 answer artifact contains scan/session, packet, student pseudonym, template/layout, question, frame, canonical rect, lossless grayscale PNG, capture/registration/answer-zone quality, recognizer outputs, policy version, and timing. It contains no answer key. Corrections are stored as separate immutable events and never overwrite raw recognition evidence.

## Implemented components

- `src/v3/answer-zones.js`: one-pass continuous crops from the canonical page, deterministic fidelity metrics, and key-blind blank/artifact evidence.
- `src/v3/decision-policy.js`: independent-architecture agreement with abstention; answer-key fields are rejected.
- `src/v3/shadow-evaluation.js`: all-answer grouping, frame representatives, and key-blind decision construction outside the camera UI.
- `src/v3/compact-client.js`: bounded, fail-open calls to the compact reader.
- `scripts/train_v3_sequence_model.py`: reproducible compact one/two-digit sequence model training and ONNX export.
- `scripts/serve_v3_compact.mjs` and `Dockerfile.v3-compact`: local/container inference without a paid API.
- `CameraCapture.vue`: opt-in `hybridV3=1` orchestration. Local V2 grading is displayed first; V3 processes all answers and up to three retained frames asynchronously and remains shadow-only.
- `scripts/evaluate_hybrid_v2_packets.mjs`: one head-to-head evaluator for control, Hybrid V2 review assistance, and V3 shadow decisions.
- `scripts/freeze_v3_policy.mjs`: hashes the control, V3 code, models, layouts, evaluator, and packet plan before locked evaluation.

The compact reader is deliberately limited to one- and two-digit answers. The larger adapted reader uses the proven cleaned/stitched view because direct raw continuous zones reduced its accuracy. Raw continuous evidence is still preserved so better models can be trained later without repeating capture.

`scripts/serve_v3_compact.py` with native ONNX Runtime is the canonical compact runtime: it reproduced every frozen holdout model read. The Node/WASM service is retained for zero-setup local work but differed on five borderline holdout answers and must not be used interchangeably for calibration or launch claims.

Blank/artifact evidence is always recorded, but its artifact probability is advisory until prospectively calibrated. The existing corpus contains only four labelled blanks and no sufficient manually verified artifact holdout; using that score as a hard veto overflagged faint pencil in real-capture replay. The blank lane may not automatically erase or rewrite a recognized answer.

## Activation and failure behavior

V3 requires `hybridV3=1`. `v3CompactModelUrl` enables the compact reader and `reviewModelUrl` enables the larger reader. Neither URL is required for ordinary grading. A timeout, outage, malformed response, or missing model produces no V3 suggestion and leaves the local result unchanged.

An HTTPS app must call an HTTPS model endpoint. The local compact service supports `SCANGRADE_V3_TLS_CERT` and `SCANGRADE_V3_TLS_KEY` for private testing; a deployed service should normally terminate trusted TLS at the authenticated product proxy/platform edge. Plain `http://127.0.0.1` is a Node/Chromium development convenience and is blocked as mixed content by Safari/WebKit.

The included Node service is an experiment/local implementation, not a public child-data endpoint. A cloud launch must add authenticated product sessions, strict origin configuration, HTTPS, platform rate/request limits, disabled body logging, retention/deletion controls, and a privacy agreement. Do not embed a permanent service secret in browser code or a query string.

The cloud decision and evidence are recorded in `SCANGRADE_V3_CLOUD_HOSTING_DECISION_20260713.md`. The risk-adjusted beta target is Cloud Run, not the home Mac, Render Free, or a public Hugging Face Space. `npm run stage:v3:container` creates a minimal temporary context and prevents the enormous private worktree from becoming Docker build input.

## Evidence status

Saved-evidence implementation tests have passed, but V3 is not authorized to change grades. The historical corpus has already influenced model and threshold choices and lacks durable student IDs. The pre-registered intact-packet evaluation is the decision gate. See `SCANGRADE_V3_HEAD_TO_HEAD_20260713.md` and `SCANGRADE_FOUR_PACKET_CAPTURE_PROTOCOL.md`.
