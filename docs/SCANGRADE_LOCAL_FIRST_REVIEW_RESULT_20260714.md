# ScanGrade local-first yellow review — final retained-artifact result

## Verdict

Keep the browser OCR, confidence policy, and automatic grading frozen. For answers it already marks yellow, show key-blind choices from the compact 64×192 grayscale reader immediately, then offer an explicit **None of these** action that requests the strong reader for only that answer. Manual typing remains the final fallback.

This architecture materially improves review without making the optional models a grading dependency. It is suitable for an authenticated private beta after real cloud-host parity and a physical old-iPad test. It is not evidence for a public claim of 84.6% recognition accuracy: that number is truth availability among the current 104 scorable yellow answers, after the browser has already abstained.

## Frozen boundaries

- Browser transcription, confidence, red/green/yellow state, math grading, capture, registration, and annotation are unchanged.
- The compact and strong models receive images and identifiers, never an answer key, mathematical correctness, handwritten truth, or teacher correction.
- Preserve up to three browser choices, then append up to three distinct compact choices. Six immediate choices is the maximum.
- Strong inference starts only after **None of these**, sends one yellow question's three retained frames, and may add at most one distinct choice.
- Service failure must leave the local result and manual correction usable.

## Authoritative exact UI replay

The browser evaluator opened every answer actually displayed yellow on all 40 retained pages from P08, P03, P09, and P02.

| Measure | Result |
|---|---:|
| Displayed yellow answers | 107 |
| Scorable handwritten values | 104 |
| Excluded ambiguous/overwritten values | 3 |
| Truth immediately available locally | 88/104 (84.6%) |
| Truth available after on-demand strong reader | 90/104 (86.5%) |
| Manual typing required | 14/104 |
| Immediate row availability | 44/50 |
| Immediate non-row availability | 44/54 |
| Strong requests | 16 questions / 48 frames |
| Reduction versus eagerly sending all yellows | 84.6% |
| Immediate list size | 3–6, mean 4.86 |
| Existing choices removed | 0 |
| Automatic results changed | 0/40 pages |

The prior two-compact-choice version reached 78/104 locally and 89/104 after strong inference, with 26 strong requests. The third compact choice therefore added ten immediate truth choices, reduced strong requests by ten, and removed no existing choice.

The smaller ten-page correction workflow covers the previously studied 14 row yellows, not the complete yellow population. It now resolves 14/14 locally with zero strong calls, 24 button taps, and four automatic advances.

Across the 104 scorable yellows, an automated interaction projection is 35 initial hotspot taps (one per page containing yellow), 90 choice taps, 16 **None of these** taps, and 14 manual-save taps: 155 button taps plus typing 14 answers. The prior two-compact-choice version projected 165 button taps plus typing 15 answers. This is a workflow estimate, not measured teacher reading time; the three excluded ambiguous answers also still require teacher judgment.

## Candidate evidence

The compact 64×192 model is useful as a ranked candidate generator, not a confidence authority.

| Corpus | Top 1 | Top 3 | Top 5 |
|---|---:|---:|---:|
| Four recent packets (275) | 176 | 232 | 249 |
| Historical validation (136) | 99 | 117 | 127 |
| Historical holdout (114) | 66 | 97 | 99 |

Historical development data influenced model work and must not be presented as generalization evidence. Wrong compact reads can have confidence above 0.995, so compact confidence is not safe for automatic promotion.

A conservative same-page geometry rescue flagged four spatial outliers and moved compact top-three truth availability from 232 to 233. It remains review-only. It recovered a better crop for a visible `6`, but the model still called it `5`, confirming that crop quality is only part of the remaining limit.

## Runtime, privacy, and recovery

- Canonical native compact service: about 5.2 MB model, about 177 MB RSS, and 82 ms for an authenticated 24-answer warm round trip in the staged test.
- Current WebKit/iPadOS 15.7 emulation: local result at 6.31 s, compact choices 132.9 ms later, and an explicit strong request in 689.3 ms. These are smoke-test timings, not production percentiles.
- The three retained frames in the WebKit test occupied 1,123,014 bytes.
- With both optional services unreachable, local grading completed, the UI explained the outage, no existing output changed, and manual correction succeeded.
- Tokens did not appear in tested URLs or captured logs. Production still needs teacher identity, short-lived credentials, revocation, provider retention controls, and a real HTTPS product proxy.

## The overwritten `34`

P09 number-pattern Q1 ends as `34`, but visibly retains a 9-like first trace beneath the final `4`. The strong reader returned `39` on all three frames, the browser returned `37`, and compact returned `22`. This is a genuinely ambiguous overwrite, not an ordinary clean-digit miss.

It remains truth `34`, and automatic `39` remains an error. The disagreement is exactly the kind of evidence that should force yellow review. A post-hoc number-pattern veto produces 243/275 automatic answers (88.4%) with zero observed errors, but it was designed after inspecting this case and remains shadow-only until a genuinely untouched packet validates it.

## Recommendation and remaining gates

Retain the three-compact-choice local-first review candidate behind `?v3LocalFirstReview=1`. Do not promote compact or strong output into automatic grades. Before an authenticated private beta:

1. Run the exact deployed cloud service and outage tests, including cold start and provider memory limits.
2. Complete a physical old-iPad multi-page camera test for memory pressure, frame retention, model loading, and recovery.
3. Run a timed teacher review session; automated tap counts do not measure visual reading time.
4. Validate on genuinely untouched September students, packets, and captures before loosening any automatic policy or making accuracy claims.

Nothing in this result is deployed or pushed.

## Reproduction

- Full UI sweep: `node scripts/evaluate_local_first_all_yellows_ui.mjs`
- Ten-page correction workflow: `node scripts/benchmark_local_first_review_workflow.mjs`
- Dual-service outage: `node scripts/test_local_first_failure_recovery.mjs`
- WebKit/iPad emulation: `node scripts/test_local_first_webkit_ipad.mjs`
- Consolidated report: `node scripts/evaluate_local_first_review_architecture.mjs`

Private evidence reports are stored under `private-evidence/reports/` and remain excluded from version control.
