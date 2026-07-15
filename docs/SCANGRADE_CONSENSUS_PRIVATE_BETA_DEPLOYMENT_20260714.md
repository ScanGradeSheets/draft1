# ScanGrade consensus private-beta deployment

Date: 2026-07-14 (America/Toronto)

## Deployment decision

The frozen conservative-consensus candidate is promoted by default on the private tailnet deployment only:

`https://hobbes-mac-mini.tail9a3379.ts.net/`

The public GitHub Pages build receives the same source release but remains on safe local browser OCR because it has no authenticated/private whole-answer model boundary. This avoids placing student answer images on an anonymous model endpoint.

On the private hostname, the app automatically enables:

- V3 retained-frame processing;
- fresh pristine warp for larger grayscale answer zones;
- zone-based whole-answer evidence;
- eight-frame column-order registration;
- local-first review;
- weak-confidence-clearance safety veto;
- conservative consensus promotion.

The model routes are same-origin and tailnet-only:

- `/review-model` → adapted large whole-answer reader;
- `/v3-compact` → independent compact whole-answer reader.

Any optional-model failure leaves the browser result yellow and preserves manual correction. Immediate rollback is available without rebuilding:

`?consensusCandidate=0`

## Release verification

- Focused release tests: 40/40 passed.
- Standard Vite build: passed.
- Pruned GitHub Pages build: passed.
- `git diff --check`: passed.
- Tailscale root, strong-reader health, compact-reader health, and browser preflights: passed.
- In-app browser loaded build `2026.07.14-consensus-private-beta-1` from the real private URL.
- Warm strong-reader batch through the Tailscale route: 15 answers in about 1.65 seconds; answer-key request rejected.

Live saved-page smoke on P09 number-patterns:

- both whole-answer readers available;
- consensus enabled;
- three promotions applied;
- overwritten `34` remained yellow;
- written `40` for mathematical key `15` stayed transcribed as `40` and became red without review;
- written `32` and `30` were also preserved and marked according to the ordinary grading layer;
- marked sheet regenerated.

The first strong-reader request after process/model cold start exceeded the client window and safely produced no promotions. The durable service then warmed; the repeated route test passed. Cold-start behavior is therefore fail-safe but remains a cloud/private-beta latency concern.

## Availability boundary

This is a real private deployment but not yet the final commercial architecture. The Mac mini is currently the optional model host. If it or Tailscale fails, scanning and manual review continue, but the additional consensus coverage disappears. A paid launch still needs authenticated hosted redundancy or a cloud service with equivalent model parity, privacy controls, and cold-start behavior.

No public accuracy claim is authorized by this deployment.
