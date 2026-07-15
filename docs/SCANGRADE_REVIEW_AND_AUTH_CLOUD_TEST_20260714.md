# ScanGrade review workflow and authenticated-cloud test — 2026-07-14

## Bottom line

The review workflow is mechanically fast and the authenticated service design works end to end, but two constraints remain:

1. A real human teacher has not yet supplied reading/decision time. Automated UI timing cannot substitute for that.
2. The strong whole-answer model uses about 2.0 GB RAM and is not ready for the previously proposed 1 GB low-cost container. The compact reader is cloud-ready at about 177 MB, but it is not accurate enough to replace the strong review reader.

No public cloud service was created. This Mac has no Docker engine, Google Cloud CLI, configured project, or deployment authorization in the workspace. The tests reached the local authenticated deployment boundary and identified what must change before an actual Cloud Run deployment.

## Test 1: end-to-end review workflow

The benchmark uploaded the 10 saved row pages containing all 14 yellow answers, waited for the real local OCR and optional models, opened the first yellow hotspot, selected verified handwritten truth, followed auto-advance, redrew annotations, and checked correction telemetry.

Results:

- 14/14 verified handwritten answers were available as tap choices.
- 14/14 corrections completed and recorded source, one-tap state, and timing.
- 24 taps total: 10 first-hotspot taps plus 14 answer-choice taps.
- Auto-advance saved four additional hotspot taps on pages with multiple yellow answers.
- Mean correction click-to-settled UI time: 56 ms; p95: 79 ms.
- Mean local grading result: 3.46 seconds after upload.
- Mean review-suggestion readiness: 12.63 seconds after upload.
- The optional suggestions therefore arrived 9.18 seconds after the local result on average.

The test found and caused two repairs:

- Auto-advance had used a broad answer-group flag and could open a confidently wrong red answer. It now uses `questionReview` and visits only yellow answers.
- A partially uncertain two-digit answer could hide a correct whole-answer suggestion behind a one-digit correction panel. A validated whole-answer suggestion now opens whole-answer review mode. The current browser OCR remains the first choice.

The 56 ms UI time means software response after a tap is not the review bottleneck. Human reading and the nine-second model delay are the issues to validate/improve.

## Required human timing pass

Use three already-scanned physical pages; do not use an untouched packet:

1. P08 page 1 (`add-1digit`): three yellow answers.
2. P03 page 2 (`add-2digit`): one yellow answer, including the partial-slot/whole-answer case.
3. P02 page 4 (`sub-2digit`): two yellow answers and auto-advance.

Run them in that order without rehearsing the answers. Use the app naturally—do not deliberately wait for the model. Record:

- time from visible local result to completing the final yellow answer;
- whether the correct choice was present on first opening each review;
- any manual typing, hesitation, wrong tap, red answer opened, or need to close/reopen;
- subjective confidence from 1–5.

The app already records per-answer `reviewDurationMs`, `correctionSource`, and `oneTap`. The human gate for this six-answer usability check is:

- correct final transcription 6/6;
- no red-answer auto-open;
- no required keypad entry on these known suggestion-covered cases;
- median decision time at most 3 seconds per yellow answer and no answer above 6 seconds;
- teacher confidence at least 4/5.

This remains a formative usability test, not a marketing statistic.

## Test 2: authenticated service and cloud boundary

### Strong whole-answer reader

- Temporary 256-bit bearer token required: passed (`401` missing/wrong token).
- Origin restriction: passed (`403` untrusted origin without valid authentication; blocked origin cannot read an authenticated response through CORS).
- Answer-key-bearing request: rejected (`400`).
- `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`: passed.
- Token or image body in service logs: none observed.
- Prediction parity: 8/8 matched the existing reference service.
- Cold process-to-health: 1.57 seconds with the base model already cached locally.
- Eight-answer request: 1.59 seconds.
- Resident memory: approximately 2,028 MB.

### Compact reader staging context

- Exact four-file context: Dockerfile, service, requirements, and model only.
- Student/debug/truth/evidence files: zero.
- Temporary token and origin enforcement: passed.
- Answer-key request rejected, no-store response, no sensitive request logging: passed.
- Prediction parity: 24/24.
- Cold process-to-health: 132 ms.
- 24-answer request: 82 ms.
- Resident memory: approximately 177 MB.

### Full authenticated browser path

The browser stored a temporary test token in `sessionStorage`—not in the URL or request body—and called both protected services.

- Strong reader available: yes.
- Compact reader available: yes.
- Actual P03 two-digit review choices: `14`, `15`, `74`.
- Correct whole-answer choice `15` selected and correction recorded with source `key-blind-whole-answer-model`.
- Token in URL/logs: no.
- Image payload in service logs: no.

This session-token path is suitable only as a private-beta integration seam. A paid beta still requires teacher identity, short-lived token issuance/refresh, revocation, and server-side verification.

### Service outage

One saved page was replayed with both optional endpoints deliberately unreachable. Local processing completed. Core predictions, question correctness, yellow-review flags, and answer groups were identical to the service-available run. Both model-availability flags were false. This passes the Mac/cloud-outage requirement: optional AI can disappear without stopping grading.

## Decision

- Keep local browser OCR as the grading authority.
- Keep the strong reader asynchronous and review-only.
- Do not make the home Mac Mini a production dependency.
- Do not deploy the strong reader in the current 1 GB compact configuration.
- The compact container is technically ready for a small authenticated Cloud Run test, but commercial usefulness still depends on the strong reader.
- Before deploying the strong reader, reduce/measure its cloud footprint—quantization/ONNX or a larger-memory costed container—and bake/cache the base model plus private adapter without including student data.
- The immediate UX optimization target is the 9.18-second suggestion delay, not correction-button responsiveness.

## Evidence

- `private-evidence/reports/v3-review-workflow-benchmark-20260714.json`
- `private-evidence/reports/v3-authenticated-review-service-test-20260714.json`
- `private-evidence/reports/v3-staged-compact-service-test-20260714.json`
- `private-evidence/reports/v3-authenticated-app-integration-20260714.json`
- `private-evidence/reports/v3-service-outage-fail-open-evaluation-20260714.json`
