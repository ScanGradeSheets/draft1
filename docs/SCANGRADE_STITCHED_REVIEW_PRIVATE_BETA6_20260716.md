# ScanGrade stitched-review private beta 6

Date: 2026-07-16

## Decision

Keep Candidate 5's automatic recognition and promotion path unchanged. Improve only the teacher-requested second opinion for answers that remain yellow: send one carefully stitched, original-grayscale answer crop from the selected frame to the strong model instead of sending three continuous-frame crops.

The stitched result is review-only. It cannot automatically grade, promote, or replace a student's transcription.

## Evidence

- The frozen Candidate 5 result remains the conservative headline: 250 of 275 answers automatic (90.9%), all 250 correct, with 25 yellow.
- A fresh replay of the current corpus produced 251 of 275 automatic (91.3%), all 251 correct. This one-answer improvement is not promoted as a product claim because it is not prospective evidence.
- Replacing the automatic strong-model evidence with stitched crops was rejected: coverage fell to 237 of 275 (86.2%), although all 237 automatic reads were correct.
- The accepted on-demand-only implementation produced exactly the same automatic results as its control: 40 of 40 pages had identical evidence and final output; 251 of 275 answers were automatic and correct in both runs.
- Among the 24 current yellow answers, the continuous-frame strong view read 9 correctly and the stitched view read 13 correctly.
- At the former 0.98 display threshold, stitched suggestions would have shown five differing choices: four correct and one wrong. The stitched threshold is therefore 0.99. On this corpus it shows four differing choices, all four correct. This remains a small, retrospective sample and is not an automatic-accuracy claim.

## Timing and resilience

- WebKit iPad emulation: the teacher-requested strong-model wait fell from about 3.50 seconds to 1.30 seconds (about 63% faster).
- Warm Chromium integration run: about 0.40 seconds.
- Cold CPU-only integration run: about 2.75 seconds.
- If both optional model services are unavailable, local grading still completes, the yellow answer remains reviewable, manual correction works, and no remote result changes the grade.

These are controlled test timings, not yet physical-device service-level claims.

## Release boundaries

- Private Tailnet deployment: stitched on-demand review is enabled by default.
- Public GitHub Pages deployment: unchanged and local-only by default.
- Disable only this review improvement with `?v3StitchedOnDemandReview=0`.
- Disable the entire private consensus candidate with `?consensusCandidate=0`.

## Validation completed

- Full corpus replay and exact control/candidate parity check.
- Unit and production-runtime tests.
- Chromium local-first integration test.
- WebKit iPad-emulation integration test.
- Both-services-unavailable outage test.
- Standard build and pruned GitHub Pages build.

## Remaining gate

No untouched packet has been spent on this review-only change. Candidate 5's automatic evidence remains the basis of the 90.9% figure. Before making a public claim about how often stitched suggestions help teachers, test the review workflow prospectively on the next sealed packet and on a physical older iPad.
