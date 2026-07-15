# ScanGrade shared-frame latency private beta 5

Date: 2026-07-15 (America/Toronto)

## Decision

Promote the shared-frame latency candidate on the private tailnet deployment only:

`https://hobbes-mac-mini.tail9a3379.ts.net/`

Public GitHub Pages remains unchanged. The release does not authorize a public accuracy or speed claim.

## What caused the delay

The 21.6-second difficult-page time was mostly browser image work, not Mac inference. Instrumented real-path Safari/WebKit timing showed:

- compact review ready: 0.11 s after optional work began;
- primary three-frame crop preparation: 6.03 s;
- redundant alternate crop preparation: another 8.52 s;
- primary adapted-model request: about 1.28 s of server inference;
- combined corroboration request: about 0.56 s of server inference.

Candidate 5 prepares primary and alternate crops from each corrected burst frame during one registration pass. It then requests alternate and selected-core corroboration together only for unresolved answers that are eligible under the existing safety policy.

## Results

- Difficult WebKit page: 21.64 s → 12.02 s, 44.5% faster.
- Warm repeat: 12.54 s.
- Local result: about 3.85 s.
- Full replay optional stage: mean 6.28 s, median 6.57 s, p90 9.81 s, maximum 11.95 s.
- 40/40 pages completed; 280/280 answer groups present.
- 250/275 scorable answers automatic (90.9%).
- 250/250 automatic answers matched handwritten truth; 25 remained yellow.
- Rows: 150/160 (93.8%); non-row: 100/115 (87.0%).
- Every final answer group matched private beta 4.
- The overwritten `34/39` remained yellow.

Five correct promotions now cite two-crop/six-read agreement rather than selected-core agreement because eliminating request contention made the alternate reads available. Their transcriptions, grades, and review states are unchanged.

## Verification

- 110/110 JavaScript tests passed.
- Standard Vite build passed.
- Pruned public build passed but was not published.
- Secure Safari/WebKit cold and warm smoke passed through the real warmed model path.
- Exact 40-page replay and post-decision truth scoring passed.
- Final-output comparison found zero changed answer groups.
- Strong-plus-compact outage remained fail-open; no unsafe promotion occurred and manual correction worked.
- Answer keys remain excluded from recognition requests.

## Boundary and rollback

Build label: `2026.07.15-shared-frame-private-beta-5`

Immediate rollback:

`https://hobbes-mac-mini.tail9a3379.ts.net/?consensusCandidate=0`

The remaining delay is primarily the registration of the two additional retained frames. Removing a frame would weaken the demonstrated 3/3 safety rule and is not part of this release.
