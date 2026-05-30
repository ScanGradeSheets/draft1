# ScanGrade Vision And Product Principles

Created 2026-05-30 from Tony's ScanGrade vision interview. This is internal project memory for Codex agents. Treat it as a product-direction source of truth unless Tony later supersedes it.

Read with `SCANGRADE_VISION_INTERVIEW_ADDENDUM.md`, which captures follow-up details about red teacher-pen review, modern Scantron heritage, Mission Control translation, Codex autonomy, classroom reality, worksheet quality gaps, ScanGrade.io visibility, question queues, and trust thresholds.

## Core Product Vision

### Why ScanGrade Exists

ScanGrade exists because grading simple classroom worksheets consumes teacher time that could be spent teaching, conferencing with students, planning instruction, or providing targeted support.

Current tools often:

- Require teachers to manually grade everything.
- Require teachers to create digital assignments.
- Shift ownership of learning away from paper-based classroom workflows.
- Feel overly technical or cumbersome.

Tony wants a system that preserves the simplicity of paper while adding the speed and feedback advantages of technology.

### Core Problem

A teacher should be able to:

1. Print a worksheet.
2. Have students complete it naturally.
3. Scan it.
4. Instantly receive trustworthy results.

There should be no complicated setup, no manually defining answer regions, and no complex configuration for every worksheet.

### Success In The Classroom

Success feels like:

- Students independently scan practice work.
- Students receive immediate feedback.
- Students correct mistakes and try again.
- Teacher instantly identifies who needs support.
- Teacher spends less time marking and more time teaching.
- ScanGrade becomes part of the normal classroom routine.

### What ScanGrade Should Never Become

ScanGrade should never become:

- A gimmicky AI product.
- An unreliable grading tool.
- A complex teacher-tech platform full of settings.
- A product that creates more work than it saves.
- A product that makes teachers question every result.
- A generic worksheet generator with no clear identity.
- A platform that promises learning gains it cannot prove.

## Teacher Experience

### Before Class

The teacher selects or creates a worksheet, prints it, and has the answer key embedded or available. The teacher should not need to manually define grading regions.

The goal is minimal preparation.

### During Class

Students complete worksheets, scan independently when finished, and receive immediate feedback for practice activities.

The teacher monitors the classroom, reviews flagged items when needed, and uses data to guide support. The teacher should not become a scanning clerk.

### After Class

The teacher reviews class results, checks uncertain answers, looks for patterns, identifies intervention groups, and uses results for instructional decisions.

The goal is fast review rather than full manual marking.

### Scanning Experience

Scanning should feel:

- Instant
- Confident
- Clean
- Slightly satisfying
- Predictable

The user should immediately understand whether the scan succeeded, failed, or needs review.

### Review Experience

Review should feel like a teacher marking a paper, not like reviewing raw OCR output.

Possible visual language includes checkmarks, circles, corrections, and a restrained red-pen/teacher-markup aesthetic. The goal is familiar teacher judgment, not machine-debug output.

The teacher should see:

- Student response
- Scan interpretation
- Confidence indicator
- Suggested score

The teacher can override any decision, adjust scores, and correct recognition errors.

### Trust Model

Teacher trust is the most important product requirement.

Trust is earned through:

- High accuracy
- Visible confidence indicators
- Easy overrides
- Conservative grading behavior

When uncertain, the system should ask. It should never confidently invent.

### Automatic Vs Teacher Controlled

Automatic:

- Detection
- Recognition
- Preliminary grading
- Confidence scoring

Teacher controlled:

- Final grades
- Overrides
- Assessment settings
- Official records

Practice mode may be more automated. Formal assessment mode remains teacher-owned.

Student Mode should support self-correction and rescan loops. Teacher Mode should control final scores, overrides, assessment settings, and official records. Formal assessments should be more locked down than practice work.

## Student Experience

### Student Workflow

The student:

1. Completes worksheet.
2. Scans worksheet.
3. Receives feedback.
4. Fixes mistakes.
5. Rescans if appropriate.

This should be simple enough for Grade 1/2 students.

### Worksheet Experience

Students should immediately understand where to write, where answers belong, and what is expected.

Worksheets should feel:

- Clean
- Structured
- Uncluttered
- Professional

### Grade 1/2 Considerations

ScanGrade must handle:

- Large handwriting
- Reversed numbers
- Uneven spacing
- Incomplete erasures
- Imperfect pencil marks

It should not require precise scanning technique, technical knowledge, or multi-step workflows.

### Student Correction Philosophy

Students should learn from mistakes.

ScanGrade provides feedback. Teacher provides learning. ScanGrade is not intended to replace instructional conversations.

## UI/UX Principles

### Overall Feel

Reference points:

- Modern Scantron
- Professional teacher tool
- Simple and trustworthy

Modern Scantron means more than visual style: it should borrow Scantron's familiarity, institutional trust, and fast paper workflow, while becoming warmer, more flexible, and friendlier for Grade 1/2 students.

ScanGrade should not feel like:

- Startup-tech flash
- Overly corporate software
- Cartoonish educational software

### Design Priorities

1. Clarity
2. Trust
3. Speed
4. Simplicity
5. Professional polish

### Main Screen

The main screen should show:

- Scan
- Recent scans
- Worksheet selection
- Key actions

It should not show:

- Technical OCR details
- AI terminology
- Model names
- Engineering concepts

### Technical Detail Philosophy

Tony does not want constant technical information. Mission Control can contain deeper details. Daily workflow should remain simple.

Mission Control should translate engineering into teacher/product language. Tony should not need to understand terms like OCR pipeline, homography, or confidence thresholding in order to steer the project.

### Personality

Tone:

- Confident
- Helpful
- Teacher-oriented
- Slightly playful

Not:

- Cute
- Overhyped
- Buzzword-heavy

## Worksheet And Product Principles

### Initial Worksheet Focus

Priority: core classroom worksheets.

Likely categories:

- Math facts
- Number sense
- Computation
- Literacy basics
- Early elementary practice

Focus on highly reusable classroom materials.

### High Quality Worksheet Characteristics

High quality worksheets are:

- Cleanly designed
- Consistent
- Easy to understand
- Purposeful
- Efficient

Every element should earn its place. Avoid visual clutter and decorative filler.

### ScanGrade Worksheet Characteristics

Worksheets should:

- Work exceptionally well with scanning.
- Feel premium.
- Have recognizable ScanGrade identity.
- Maintain classroom practicality.

### Product Line Expansion

After core worksheets, possible additions include:

- Skill packs
- Intervention packs
- Seasonal products
- Assessment collections
- Cross-grade bundles

Later possibilities include a marketplace ecosystem and larger worksheet library.

### What Should Wait

Before proven classroom success, avoid:

- Massive marketplace ambitions
- Broad curriculum claims
- Large platform complexity

Earn credibility first.

## TPT And Marketing Principles

### First Customer

The likely first customer is an elementary classroom teacher, especially one who still relies heavily on paper workflows.

### Current Safe Promise

"We help you save marking time and quickly see what students know."

This can be supported immediately.

### Promises To Avoid

Avoid claims like:

- Improves achievement
- Guarantees learning gains
- Replaces assessment
- Replaces teacher judgment

Do not make these claims unless and until classroom evidence supports them.

### Marketing Style

Preferred:

- Authentic
- Teacher-to-teacher
- Honest
- Slightly witty

Avoid:

- Fake enthusiasm
- Inflated claims
- "Transform your classroom" language

### Marketing Philosophy

Demonstrate. Do not exaggerate.

Show:

- Worksheets
- Workflow
- Time savings
- Real classroom use

## Mission Control Vision

### Purpose

Mission Control is Tony's executive dashboard.

It is not a developer dashboard, a bug tracker, or a code repository.

It should answer:

> What is happening with ScanGrade?

### At A Glance

Mission Control should show:

- Current project status
- What Codex completed
- What Codex is working on
- Questions awaiting Tony
- Roadmap progress
- Upcoming decisions

### Kanban Structure

Suggested sections:

- Ideas
- Planned
- In Progress
- Waiting For Tony
- Testing
- Completed

### Tony Questions

Questions should be collected, not scattered across conversations. Mission Control becomes the single source of truth for Tony-facing open questions.

### Codex Updates

Codex should:

- Update automatically.
- Move cards automatically.
- Create missing tasks.
- Suggest next priorities.

### Tony Authority

Tony can:

- Override priorities.
- Change roadmap.
- Approve direction changes.
- Reject proposals.

Mission Control should also collect and batch questions for Tony so Codex does not interrupt constantly. Answered questions should disappear from the active queue but remain reopenable if needed.

## Business And Roadmap Priorities

Major milestones:

1. Reliable worksheet format
2. Reliable scanning
3. Reliable grading
4. Real classroom testing
5. Refined worksheet library
6. Early customer validation

Everything else follows.

## Work Codex Can Do Autonomously

Codex can autonomously work on:

- Worksheet creation
- Asset creation
- Marketing drafts
- Product descriptions
- Landing pages
- Documentation
- Mission Control updates
- Competitive research
- Roadmap suggestions

This autonomy is a requirement, not just a convenience. Codex should not wait for Tony when safe, reversible, vision-aligned work is available.

## Risks

Primary risks:

- Scanning reliability
- Teacher trust
- Excessive complexity
- Weak differentiation
- Launching before classroom validation

## Codex Autonomy Rules

### Codex Should Do Without Asking

- Improve documentation.
- Create assets.
- Create drafts.
- Organize roadmap.
- Generate options.
- Suggest missing work.
- Maintain Mission Control.

### Codex Should Never Change Without Asking

- Core product vision
- Product positioning
- Major UX direction
- Brand identity
- Launch strategy
- Business priorities

### Preferred Presentation Style

When decisions are needed, present:

- Option A
- Option B
- Option C

Include:

- Recommendation
- Pros
- Cons
- Confidence level

Keep concise.

### Handling Uncertainty

If uncertain:

- State uncertainty.
- Present assumptions.
- Recommend next action.

Never pretend certainty.

## Decisions Requiring Tony

Always require Tony's approval for:

- Major UI redesigns
- New product categories
- Pricing strategy
- Marketplace strategy
- Brand changes
- Marketing claims
- Customer-facing promises
- Core workflow changes

## Open Questions

1. Exact worksheet template architecture.
2. Teacher mode vs student mode permissions.
3. How answer keys are stored.
4. How confidence scoring is presented.
5. Class dashboard design.
6. TPT product roadmap order.
7. Branding system and visual identity.
8. Monetization model.
9. Classroom testing plan.
10. Long-term marketplace strategy.
11. Detailed worksheet design philosophy.
12. Mission Control's day-to-day question and autonomy behavior.
13. Trust thresholds for auto-grade, review, and refusal.

## Immediate Next Artifacts Codex Should Build

1. Mission Control v1
   - Executive dashboard
   - Kanban workflow
   - Tony question queue
2. Worksheet Design System
   - Layout rules
   - Typography rules
   - Scan-safe regions
   - Branding standards
3. ScanGrade Brand Guide
   - Logo concepts
   - Color palette
   - Visual language
   - Cover templates
4. Teacher Workflow Prototype
   - Scan flow
   - Review flow
   - Override flow
5. Student Workflow Prototype
   - Scan flow
   - Feedback flow
   - Rescan flow
6. TPT Launch Framework
   - First 20 products
   - Bundle strategy
   - Preview templates
   - Product descriptions
7. Classroom Test Plan
   - Reliability testing
   - Student usability testing
   - Teacher trust validation
8. Marketing Asset Pipeline
   - Landing page
   - Demo screenshots
   - Social posts
   - Teacher-facing ads
