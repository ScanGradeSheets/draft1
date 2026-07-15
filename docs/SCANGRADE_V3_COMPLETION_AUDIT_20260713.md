# ScanGrade V3 completion audit — 2026-07-13

This audit treats the active goal as unproven. “Implemented” is not equivalent to “validated for launch.”

| Goal requirement | Authoritative evidence | Status |
|---|---|---|
| Preserve V2/control | 582-answer replay: 323 automatic, 323 correct; V3 is query-flagged and shadow-only | Proven on saved evidence |
| Continuous grayscale zones before segmentation | `src/v3/answer-zones.js`; 582/582 exact live-refined artifacts, zero missing/duplicates | Proven on saved evidence |
| Multiple real frames retained and independently registered | Auto-capture retains three; three saved real captures processed end to end with 3/3 registrations | Implementation proven; authentic adjacent live burst still missing |
| Existing slot OCR on all answers | Current V2 pipeline unchanged; V3 shadow receives its predictions | Proven |
| Compact ScanGrade whole-answer reader | 1.31M parameters, 5.8 MB ONNX; 72.8% validation, 57.9% historical holdout | Proven as independent evidence, not sole OCR |
| Independent larger whole-answer reader | Adapted TrOCR 77.2% validation, 80.7% historical holdout; complete three-frame browser request passed | Proven on saved evidence |
| Blank/artifact/quality lane on all answers | 582-row evaluation; 3/4 blanks, 0 false blanks, 90 artifact flags | Runs on all answers; artifact calibration incomplete and advisory |
| Key-blind calibrated abstention | Answer-key fields rejected in client, service, shadow boundary and policy tests; historical fusion has zero selected errors | Proven historically; prospective calibration missing |
| Local grading returns before optional models | Browser integration and outage test produced identical local predictions | Proven |
| Asynchronous suggestions | Both readers completed after local result; two correct disagreement alternatives recorded in three-frame replay | Proven on saved evidence |
| Modular boundaries | Separate answer-zone, client, decision, shadow-evaluation, service, evaluator and freeze modules with tests | Proven structurally |
| Offline/service fallback | Missing service test completed local grading; compact and larger services can run offline from cached/private weights | Proven locally |
| Packet/student/template holdouts | Frozen plan: P08/P03/P09 development, P02 locked; actual nine-packet inventory leaves P01/P04-P07 reserve | P08 captured; P03/P09 and locked P02 remain |
| Reproducible V2-versus-V3 saved-evidence comparison | Head-to-head report and evaluator; freeze self-verifies 55+ policy/model/layout files | Proven historically |
| Prospective V2-versus-V3 comparison | P08: V2 42/70 automatic and 42/42 correct on primary-only truth; research hybrid replay 52/70 and 52/52; P03/P09/P02 still required | P08 provisional; not independently truth-verified and not sufficient for promotion |
| Teacher outcome improvement | Evaluator records one-tap availability, final accuracy and review duration | Instrumented but no prospective teacher data |
| Old-device compatibility | WebKit/iPad emulation passed over HTTPS | Partial; actual old-iPad camera, burst memory and model-load test missing |
| Cloud availability without Mac dependency | Provider comparison, privacy-safe four-file staging context, canonical native service with 114/114 frozen-read parity, auth/origin/no-store controls, and Cloud Run contract exist | Cloud Run selected; not deployed because project credentials, teacher identity boundary, privacy approval, Linux build and cold-start evidence are missing |

## Completion judgment

The V3 software and saved-evidence evaluation are substantially implemented. The full active goal is not complete because the prospective intact-packet comparison, teacher outcomes, actual old-device test, and launch cloud boundary remain unverified. No automatic V3 promotion or public accuracy claim is authorized.
