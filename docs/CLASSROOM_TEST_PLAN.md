# Classroom Test Plan

Created 2026-05-30 from Tony's ScanGrade vision interview and the current open-divider worksheet mission.

## Purpose

This plan defines what ScanGrade needs to prove in Tony's classroom before the product can honestly move from "promising prototype" toward classroom pilot, stronger marketing, or TPT publishing.

The goal is not to prove that the app is perfect. The goal is to learn whether the current worksheet format, scanning flow, and review workflow are trustworthy enough to save teacher time without creating new confusion.

## Current Test Question

Can normal Grade 2 students complete the three current open-divider worksheets, scan or photograph them in realistic classroom conditions, and produce results that a teacher can review faster than marking from scratch?

## Current Test Materials

Use the current open-divider packet:

- Sheet A: Addition Within 20
- Sheet B: Subtraction Within 20
- Sheet C: Mixed Within 50

Packet:

- `public/worksheets/open-divider-test/printables/ScanGrade-Grade2-Worksheets-A-B-C-Open-Divider-Test-Packet.pdf`

Answer key:

- `public/worksheets/open-divider-test/printables/ScanGrade-Grade2-Open-Divider-Teacher-Answer-Key.pdf`

Intake checklist:

- `docs/STUDENT_SAMPLE_INTAKE.md`

Teacher trust scorecard:

- `docs/TEACHER_TRUST_SCORECARD.md`

## What This Test Should Prove

### Worksheet Usability

The worksheet format is usable if:

- Students know where to write without extra explanation.
- The open-divider answer boxes give enough space for normal Grade 2 handwriting.
- Students do not consistently write outside the boxes in ways that make scanning unrealistic.
- The sheets still feel like clean classroom worksheets, not technical forms.

### Scanning Reliability

The scan path is promising if:

- Full-page images are detected reliably.
- QR/layout identification works.
- Answer boxes crop consistently.
- Common classroom photo imperfections do not immediately break the flow.
- Failures are clear enough to explain in plain English.

### Grading Trust

The grading path is promising if:

- Correct answers are usually recognized correctly.
- Incorrect answers are usually identified as incorrect.
- Uncertain answers are surfaced for review rather than treated as confidently correct.
- Teacher override remains easy.
- The teacher can review problem cases faster than marking the full page manually.

### Student Feedback

The student loop is promising if:

- Students can understand whether they got something right or need to fix it.
- Feedback does not shame or confuse students.
- Rescanning after corrections feels possible for practice work.
- The flow is simple enough for Grade 1/2 students with minimal teacher help.

## Recommended First Classroom Test

### Minimum Useful Test

- 3 completed sheets total:
  - 1 Sheet A
  - 1 Sheet B
  - 1 Sheet C
- Clear photos or scans with full page visible.
- Normal student handwriting, not cleaned up for the test.

### Better First Test

- 6-9 completed sheets total:
  - 2-3 students per sheet type
- Mix of neat and typical handwriting.
- At least one realistic imperfect photo if that reflects actual classroom conditions.

### Do Not Over-Optimize The Samples

Do not ask students to write unusually neatly just for ScanGrade. The point is to learn from real classroom behavior.

## What Tony Should Observe In Class

While students complete the worksheets, Tony should notice:

- Do students understand the answer boxes?
- Do students write too large, too small, or across the divider?
- Do erasures leave marks that might confuse the app?
- Are reversed numbers common?
- Do students try to write units, marks, or extra notes in the answer box?
- Does the page layout feel calm or crowded?

These observations matter as much as the OCR results.

## What Codex Should Do When Samples Arrive

Before changing code, Codex should:

1. Preserve the original files.
2. List received files and identify sheet types.
3. Confirm each image has full page, corners, QR, and answer boxes visible.
4. Run current smoke tests.
5. Run the current upload/OCR path on each sample.
6. Record exact results and likely failure category.
7. Produce a plain-English classroom test report.
8. Recommend one next action.

Failure categories:

- Photo quality
- Page/corner detection
- QR/layout detection
- Answer-box crop
- Digit recognition
- Confidence/review UX
- Student writing behavior
- Worksheet design issue

## Good Enough For The Next Milestone

The next milestone is not public launch. It is a small classroom pilot.

ScanGrade is good enough for the next milestone if:

- The app handles at least a small set of real student sheets without total workflow failure.
- Most failures are understandable and fixable.
- The review experience helps Tony find issues quickly.
- The system is conservative when uncertain.
- Tony feels he could try another small round without the app wasting class time.

## Not Good Enough Yet

Do not move toward public claims if:

- The app guesses confidently on unclear answers.
- Teacher review feels slower than manual marking.
- Students need too much help to scan or understand feedback.
- The worksheet design causes repeated writing problems.
- Failures cannot be explained or reproduced.

## Teacher Trust Rubric

Use `docs/TEACHER_TRUST_SCORECARD.md` after each classroom test. Short version:

| Area | Green | Yellow | Red |
| --- | --- | --- | --- |
| Scan success | Most pages process cleanly | Some retries needed | Frequent failures |
| Answer recognition | Mostly correct | Mixed but reviewable | Unreliable |
| Uncertainty handling | Flags doubtful answers | Some overconfidence | Confident wrong results |
| Teacher review | Faster than marking | Similar effort | Slower than marking |
| Student usability | Students understand flow | Some support needed | Too much teacher help |
| Worksheet design | Clear and scan-friendly | Minor writing issues | Layout causes failures |

## Report Template

```text
Classroom Test Report

Date:
Worksheet set:
Sample count:

What Tony observed:
- ...

What worked:
- ...

What failed:
- ...

Failure categories:
- ...

Teacher trust rating:
- Green / Yellow / Red

Student usability rating:
- Green / Yellow / Red

Recommended next action:
- ...
```

## Rules For Codex

- Do not tune OCR blind.
- Do not make marketing claims from partial evidence.
- Do not treat one perfect scan as proof of classroom readiness.
- Do not treat one bad photo as proof the worksheet format is bad.
- Separate app problems from worksheet-design problems.
- Prefer one clear next action over a pile of speculative fixes.

## Relationship To TPT

The first TPT mini pack should stay in draft until the classroom test supports the answer-box design and teacher-facing promise.

Safe current promise:

> Helps teachers save marking time and quickly see what students know.

Avoid stronger claims until evidence exists:

- Perfect scanning
- Fully automated grading
- No teacher review needed
- Proven learning gains
