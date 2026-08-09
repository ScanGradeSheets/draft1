# ScanGrade Vision Interview Addendum

Created 2026-05-30 from Tony's follow-up notes after the ScanGrade voice interview.

This file captures important interview details that were likely discussed but did not fully survive into the first structured summary. Treat these as product-memory refinements. Where this addendum conflicts with generic wording elsewhere, prefer the more specific rule here unless Tony later supersedes it.

## 0. Two-Box One-Digit Classroom Rule

When a worksheet prints two digit boxes but the student's handwritten answer contains only one digit, the answer has the same meaning whether the child writes the digit in the left box or the right box.

- `_9` and `9_` both represent the handwritten answer `9`.
- ScanGrade should preserve the physical position for annotation and teacher review.
- The blank companion box should not be highlighted merely because the child chose the other box.
- A true two-digit response still requires both digits in their written order.
- A leading zero such as `09` is not implied by this rule unless the worksheet explicitly permits it.
- This is a placement/grading contract, not permission for OCR to guess the mathematically correct digit.

## 1. Red Teacher Pen / Teacher Markup Feel

Review and correction should feel closer to a teacher marking a paper than a computer reviewing OCR output.

Possible visual language:

- Checkmarks
- Circles
- Corrections
- Teacher-like markup
- Possibly red pen aesthetics

This does not mean the interface should become messy or gimmicky. The useful principle is that review should feel familiar, human, and teacher-owned. ScanGrade should show its interpretation in a way that invites quick teacher judgment, not in a way that feels like debugging machine output.

## 2. Student Mode Vs Teacher Mode

Student Mode and Teacher Mode need clearer permission boundaries.

Likely direction:

- Student Mode supports practice, self-correction, and rescan loops.
- Teacher Mode has authority over final scores, overrides, and records.
- Formal assessment workflows should be locked down differently from practice workflows.

Open details remain:

- How much correctness feedback students see in assessment mode.
- Whether students can rescan formal assessments.
- Whether teacher approval is required before results are saved officially.
- Whether student mode should hide confidence/review details.

## 3. Scantron Heritage

"Modern Scantron" is not just a visual reference. It carries a trust signal.

ScanGrade should borrow the useful parts of Scantron heritage:

- Familiarity
- Institutional trust
- Fast paper-based workflow
- Clear answer regions
- A sense that paper and technology can cooperate

ScanGrade should avoid the bad parts:

- Rigid forms that are unfriendly to young children
- Cold institutional design
- Requiring overly precise student marks
- Making teachers feel trapped by the machine's decision

The target is a warmer, more flexible, classroom-friendly modern Scantron for early elementary paper workflows.

## 4. Mission Control Must Translate Engineering Into Teacher Language

Mission Control is not just an executive dashboard. It must actively translate technical work into Tony-readable teacher/product language.

Instead of:

- Refactored OCR pipeline
- Added confidence thresholding
- Tuned homography

Mission Control should say:

- Scanning accuracy improved
- Unclear answers are now flagged for review
- Worksheet photos line up more reliably
- Student review screen completed

Technical detail can be available when expanded, but the first read should answer:

> What does this mean for ScanGrade in the classroom?

Tony should not have to understand what Codex is doing internally to steer the project.

## 5. "Do Not Wait For Me" Is A Requirement

Codex autonomy is not merely convenient. It is part of the operating model.

When Tony is unavailable, Codex should continue safe, useful work by:

- Identifying missing work
- Creating tasks
- Proposing improvements
- Preparing assets
- Improving documentation
- Maintaining Mission Control
- Drafting options for later Tony decisions

Codex should not block on Tony for work that is clearly safe, reversible, and aligned with the vision.

Codex should still stop for:

- Core product vision changes
- Major UX direction
- Brand identity
- Marketing claims
- Customer-facing promises
- OCR/capture/homography/iPad logic without evidence

## 6. Classroom Reality

ScanGrade must survive Tony's real classroom, not an idealized edtech demo.

Important realities:

- Grade 1/2 students
- Limited teacher time
- Students working independently while Tony supports small groups
- Shared or older classroom devices
- Imperfect handwriting
- Pencil marks, erasures, interruptions, movement, imperfect photos
- Very little patience for multi-step workflows

If a process takes more than a minute or two, it will not get used consistently.

This should guide all workflow decisions. The app must reduce classroom load, not introduce another routine Tony has to supervise.

## 7. Worksheet Quality Needs A Deeper Interview

Worksheet quality is still under-specified.

Known direction:

- Clean
- Structured
- Purposeful
- Professional
- Minimal decorative filler
- Useful even without the app

Still needs deeper Tony input:

- Ideal white space
- Questions per page by grade/skill
- Preferred fonts
- Illustration philosophy
- Color vs black-and-white rules
- How much fun vs academic tone
- What makes Tony instantly reject a TPT worksheet
- How ScanGrade worksheet families should evolve visually

This likely deserves a dedicated second interview.

## 8. ScanGrade.io Visibility Rule

ScanGrade.io should remain visible on worksheets because teachers may see a page at the photocopier, type in the URL later, and become customers.

This is a product-growth and brand-recognition rule, not just decoration.

Guidance:

- Keep `ScanGrade.io` visible enough to be noticed by a teacher.
- Keep it quiet enough that it does not distract students.
- Do not remove it from worksheet designs without Tony approval.
- Treat it as a low-friction discovery path for paper-based teachers.

## 9. Mission Control Question Queue

Mission Control should reduce interruptions, not create more.

Tony does not want Codex constantly stopping the work with scattered questions. Instead, Mission Control should collect:

- Open questions
- Decisions waiting for Tony
- Deferred choices
- Codex recommendations
- Multiple-choice options when helpful
- "Defer to Codex recommendation" options where appropriate

Questions should be batched and easy to answer later. Once answered, they should disappear from the active queue but remain reopenable if needed.

## 10. Trust Thresholds Are A Major Open Product Area

"When uncertain, ask" is the right principle, but it is not yet enough.

ScanGrade still needs explicit trust-threshold decisions:

- When should it auto-grade?
- When should it flag for review?
- When should it refuse to grade?
- What confidence labels should teachers see?
- What confidence labels should students see?
- How should thresholds differ between practice mode and assessment mode?
- How much uncertainty is acceptable before teacher review becomes slower than manual marking?

This is one of the most important product and technical decision areas in the whole project.

## Highest-Value Second Interview Topics

Tony identified three biggest remaining gaps:

1. Worksheet design philosophy
   - Likely a full interview by itself.
2. Mission Control behavior
   - How Codex should operate day-to-day without interrupting Tony.
3. Trust and grading thresholds
   - The core product decision behind automation, review, and refusal.
