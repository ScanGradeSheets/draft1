# ScanGrade Hybrid V2 architecture

Status: opt-in shadow implementation. The existing browser OCR remains the control and default.

## Product contract

Hybrid V2 must improve the number of answers teachers can resolve quickly without changing what a student wrote, using the mathematical key as transcription truth, or making network/model availability necessary for grading.

The app remains useful when every hybrid component is unavailable.

## Runtime flow

```text
8-frame camera burst
  -> existing capture scorer chooses the legacy control frame
  -> Hybrid V2 preserves the best 3 full camera frames
  -> existing page warp, gray crops, digit OCR, grading, and confidence policy
  -> yellow answers only:
       each preserved frame -> page warp -> full gray whole-answer crop
       -> key-blind whole-answer service
       -> exact cross-frame consensus
  -> teacher choices:
       current browser OCR first
       whole-answer/cross-frame alternative
       existing OCR alternative
       manual keypad fallback
  -> one tap records choice source and review duration, then advances to next yellow answer
```

## Isolation from the control

- Hybrid capture is enabled only with `?hybridV2=1` or `?hybridRecognition=1`.
- Whole-answer inference remains enabled only when `reviewModelUrl` is supplied.
- The current OCR decision is always the first review choice.
- Hybrid code never changes a non-yellow answer.
- A whole-answer read alone cannot promote a yellow answer.
- Cross-frame agreement is shadow-only. `automaticText` remains null for every yellow answer.
- Default replays must remain bit-for-bit equivalent at the answer-policy level.

Control verification after the first implementation:

- 374 handwritten-truth answers
- 233 automatic
- 233/233 automatic correct
- 141 yellow
- exactly matches the pre-Hybrid V2 control

Evidence: `private-evidence/reports/hybrid-v2-control-check-20260713/truth-score.json`.

## Evidence preserved

When Hybrid V2 and debug capture are enabled, the private debug bundle contains:

- selected lossless page capture;
- up to three high-quality burst-frame JPEGs;
- burst rank, focus, lighting, selection, encoded byte size, and encoding-time metadata;
- selected-frame perspective-corrected page;
- full gray answer crops;
- model-input tiles and variants;
- whole-answer reads by frame;
- exact frame consensus;
- shadow-promotion eligibility;
- teacher correction source, one-tap status, and review duration.

Every prospective scan also records packet ID, assigned development/locked role, capture-plan seed, and a stable scan-session ID. Lightweight correction uploads reuse the session ID without re-uploading student images, so review timing and final choices can be joined to the original evidence without duplicating image payloads.

Mission Control writes burst frames under `burst-frames/` in the private scan directory. Student evidence must never enter Git.

The capture implementation retains at most three full camera canvases at once and releases the two non-selected canvases immediately after JPEG encoding. On 115 readable non-placeholder saved captures, a quality-92 JPEG was about 0.46 MB at the median and 0.56 MB at the 90th percentile; three base64 evidence frames were about 1.84 MB at the median. Three raw RGBA canvases represent about 32.2 MB before browser/GPU overhead. Real encoding time and old-iPad memory behavior still require prospective device measurement. Evidence: `private-evidence/reports/hybrid-capture-payload-20260713.json`.

## Recognition policy

The pure policy module is `src/hybrid-recognition.js`.

Current shadow rule:

- at least two of three usable frames must agree exactly;
- agreeing frames must represent at least two thirds of usable frames;
- every agreeing frame must have minimum token probability at least `0.95`;
- at least one matching read must have minimum token probability at least `0.999`;
- the answer must already be yellow;
- the result is recorded but still requires teacher confirmation.

Pseudo-frame testing on the existing 100 yellow-answer model subset found 13–14 shadow-eligible answers, all correct, including 6–7 of 40 in the holdout block. Because the pseudo-frames share one original crop, this is design evidence only. Real burst frames from the new packets are the promotion gate.

Evidence: `private-evidence/reports/pseudo-frame-consensus-20260713.json`.

## Service portability

The key-blind service:

- rejects requests containing `answerKey` or `expected`;
- returns per-frame identity and token probabilities;
- supports batched yellow crops;
- can run on the Mac for development;
- can run from `Dockerfile.review` with the private adapter mounted separately;
- supports bearer-token and allowed-origin environment configuration;
- rejects disallowed browser origins before reading image payloads and marks responses `no-store`;
- must be deployed behind the application backend/auth layer for a real cloud launch.

The model adapter and child evidence are deliberately excluded from the container and repository.

On a Mac with the base model already cached, start with `--offline` (or `SCANGRADE_REVIEW_OFFLINE=1`) so service availability does not depend on the model registry. The processor is explicitly pinned to its current slow implementation to prevent a future library default from silently changing predictions.

When an HTTPS proxy exposes the service below a path such as `/review-model`, set `SCANGRADE_REVIEW_ROUTE_PREFIX=/review-model` and use that path as `reviewModelUrl`. The service port defaults to `PORT` when a cloud platform supplies it, otherwise `8766`.

For local testing, an origin-restricted direct browser endpoint is acceptable. A production cloud endpoint must not be anonymously public: put it behind the product backend/session boundary (or issue short-lived per-session credentials), configure `SCANGRADE_REVIEW_ALLOWED_ORIGINS`, apply request-size/rate limits at the platform edge, disable provider request-body logging, and document deletion/retention. A permanent token must never be embedded in the browser URL or JavaScript bundle.

## Deployment sequence

1. Local shadow test on saved evidence.
2. Capture four intact new packets: three development, one locked test.
3. Run real burst consensus and measure review time without promotion.
4. Freeze policy.
5. Open the locked packet once.
6. Deploy the service to a replaceable cloud container only if review benefit survives.
7. Keep browser-only fallback permanently.

OpenAI Sites is not used: the project has no Sites hosting configuration, and a public page builder is not an appropriate boundary for private student images or model inference.

The prospective protocol is `docs/SCANGRADE_FOUR_PACKET_CAPTURE_PROTOCOL.md`. It deliberately keeps packets intact and consumes four of the twelve remaining packets, not ten.

## Acceptance gates

- Default control replay unchanged.
- Zero hybrid overwrites of current OCR choices.
- Zero answer-key fields sent to recognition.
- Service timeout/error leaves a complete browser result.
- At least 25% lower median teacher review time or at least 20 percentage points more yellow answers with a correct one-tap choice.
- No wrong final transcription increase.
- Any confident hybrid error on authentic incorrect math blocks automatic promotion.
