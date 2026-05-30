# Teacher Workflow Prototype

Created 2026-05-30 from Tony's ScanGrade vision interview.

This is a product/UX prototype spec for the teacher-facing ScanGrade workflow. It is not an implementation request by itself. Use it to guide future UI changes after the current real-student worksheet test provides evidence.

## Product Promise

The teacher should be able to print a worksheet, let students complete it naturally, scan it, and receive trustworthy results without manually defining answer regions or managing a complicated setup.

The app should feel like a faster review assistant, not a replacement for teacher judgment.

## Primary Teacher Jobs

1. Choose the worksheet.
2. Scan or receive scans.
3. See whether each scan succeeded.
4. Review uncertain answers.
5. Correct or override results.
6. Identify who needs support.
7. Move on with teaching.

## Modes

### Practice Mode

Purpose: fast student feedback and correction.

Practice mode can be more automated:

- Immediate feedback is allowed.
- Student can correct and rescan.
- Teacher may only review exceptions or summaries.
- Results may be informal.

### Assessment Mode

Purpose: teacher-owned official review.

Assessment mode should be more conservative:

- Teacher controls final score.
- Uncertain answers require review.
- Overrides are prominent.
- Export/recording should wait for teacher confirmation.

## Main Teacher Screen

The teacher's daily screen should be simple.

Show:

- Current worksheet or class activity
- Scan button / scan queue
- Recent scans
- Review-needed count
- Clear next action

Do not show by default:

- OCR internals
- Model names
- Raw confidence math
- Debug crops
- Engineering logs

Technical detail can live behind Teacher/debug tools or Mission Control.

## Scan States

Every scan should land in one obvious state:

### Success

Meaning: ScanGrade confidently processed the page.

UI should say something like:

> Scanned successfully

Show:

- Student name if known
- Worksheet title
- Score or practice feedback
- Any minor review flags

### Needs Review

Meaning: ScanGrade processed the page but one or more answers need teacher judgment.

UI should say something like:

> Review 2 answers

Show:

- Flagged answers first
- Student writing crop
- ScanGrade's interpretation
- Suggested correct/incorrect state
- Teacher override controls

### Scan Failed

Meaning: ScanGrade could not reliably process the page.

UI should say something like:

> Scan did not work

Explain the likely fix in teacher/student language:

- Move closer.
- Include the whole page.
- Flatten the paper.
- Try better light.
- Make sure the corner markers are visible.

Avoid technical explanations unless expanded.

## Review Screen

The review screen should feel like marking a paper.

For each flagged item, show:

- Question number
- Expected answer
- Student answer image crop
- ScanGrade interpretation
- Confidence label
- Suggested score
- Override buttons

Use plain confidence labels:

- Looks clear
- Check this
- Could not read

Avoid exposing raw percentages as the main language. Percentages can appear in an expanded debug section if needed.

## Override Behavior

Teacher should be able to:

- Mark correct
- Mark incorrect
- Edit interpreted answer
- Ignore/skip
- Add note later if notes become part of the product

Overrides should feel lightweight and reversible.

The system should remember that the teacher is the final authority.

## Confidence And Trust Rules

When ScanGrade is uncertain, it should ask.

Never confidently invent.

Good behavior:

- "I think this is 15, please check."
- "Could not read this answer."
- "This may be correct, but handwriting is unclear."

Bad behavior:

- Confidently marking unclear answers correct.
- Hiding uncertainty.
- Requiring the teacher to inspect every raw crop.

## Class Summary

After scans, teacher should be able to see:

- Who completed the worksheet
- Who needs review
- Commonly missed questions
- Students who may need support
- Scans that failed or need retry

Keep this summary practical. The first version should not pretend to be a full analytics platform.

## Student-Independence Goal

The long-term classroom loop should not make the teacher a scanning clerk.

Students should eventually be able to:

1. Finish worksheet.
2. Scan independently on a shared iPad.
3. See simple feedback.
4. Correct mistakes.
5. Rescan when appropriate.

Teacher sees the summary and review queue.

## UX Tone

The teacher UI should feel:

- Confident
- Calm
- Fast
- Trustworthy
- Slightly satisfying

Avoid:

- Buzzwords
- "AI magic" language
- Over-celebration
- Cute mascots or childish framing
- Dense technical panels in the normal workflow

## First Prototype Scope

The first teacher workflow prototype should include:

- Worksheet selection
- Upload/scan entry point
- Scan result state
- Review-needed state
- Override controls
- Simple class/session summary

It does not need:

- Full rostering
- Gradebook integration
- Complex analytics
- Product upsells
- Marketplace browsing

## Open UX Decisions For Tony

1. How much feedback should students see immediately in practice mode?
2. Should assessment mode hide correctness from students until teacher review?
3. What labels feel best for confidence: "Looks clear", "Check this", "Could not read", or something else?
4. Should teacher review be organized by student first or by question first?
5. What is the minimum class summary Tony would actually use during a busy school day?

## Implementation Guardrails

- Do not redesign the production app from this spec without Tony approval.
- Do not add new workflow complexity until real classroom testing exposes the need.
- Do not expose technical OCR detail in the main teacher workflow.
- Do not weaken teacher override/control.
- Keep the first implementation small enough to test honestly.
