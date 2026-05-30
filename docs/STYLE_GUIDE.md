# ScanGrade Style Guide

Updated 2026-05-30 from Tony's vision interview, the recovered project memory, and the current open-divider worksheet packet.

This guide describes ScanGrade's visual and product feel. It should guide small UI polish, worksheet artifacts, preview assets, and teacher-facing copy. It does not authorize changing scan-critical worksheet geometry without evidence.

## Product Feel

ScanGrade should feel like:

- a modern Scantron for early elementary classrooms
- professional, calm, and trustworthy
- paper-first rather than tech-first
- simple enough for Grade 1/2 students
- useful to a busy teacher in a real classroom

ScanGrade should not feel:

- flashy
- overhyped
- cartoonish
- like a generic worksheet factory
- like an OCR/debug console
- like a platform that creates more work than it saves

## Core Visual Principles

1. Clarity first.
2. Teacher trust over novelty.
3. Calm hierarchy over decoration.
4. Paper workflow over app complexity.
5. Small reversible polish over big redesigns.

When in doubt, make the interface quieter, clearer, and easier to scan.

## Brand

### Name

Use `ScanGrade.io` when the URL matters, especially on worksheets and teacher-facing materials.

Use visual hierarchy:

- `ScanGrade` carries the main brand weight.
- `.io` should be attached with no space but lighter in weight.

### Logo

Canonical app-facing assets:

- `public/scangrade-logo.png`
- `public/scangrade-logo-transparent.png`

Use the logo confidently but sparingly. It should support trust and recognition, not dominate the classroom task.

### ScanGrade.io Visibility Rule

Keep `ScanGrade.io` visible on worksheets unless Tony explicitly approves removing it.

Reason: a teacher may see a ScanGrade sheet at the photocopier, type in the URL later, and become a customer.

The URL should be noticeable to teachers but quiet for students.

## Color

### Core UI Palette

Use a restrained palette:

- black or near-black for primary text
- white and soft gray for surfaces
- ScanGrade green for primary success/action moments
- red only for correction or teacher-markup moments
- yellow/amber only for uncertainty or review-needed states

Avoid one-note color themes. ScanGrade should not become a green-only interface.

### Current Green

The current ScanGrade green family in the app is centered around:

- `#126c39`
- hover/deeper action: `#0f5d31`

Use green for:

- primary scan/retry action
- successful checks
- gentle brand accents

Do not overuse green on student worksheets.

## Typography

Use Lexend where possible.

Typography should feel:

- readable
- rounded enough for young students
- professional enough for teachers
- consistent across app, worksheets, and product assets

Avoid:

- decorative fonts
- comic-style worksheet fonts
- tiny instructional text
- marketing-size headings inside compact app panels

## App UI

### Student Mode

Student Mode should feel:

- immediate
- calm
- simple
- hard to mess up

Show only what students need:

- start scan
- identity/name when needed
- clear scan status
- simple feedback
- obvious retry/new scan path

Hide or avoid:

- OCR details
- model names
- confidence internals
- developer language
- complex settings

### Teacher Mode

Teacher Mode can expose more control, but it should still translate technical work into teacher language.

Prefer:

- "Needs review"
- "Unclear answer"
- "Saved for teacher review"
- "Scan again"

Avoid as primary UI language:

- homography
- tensor
- ONNX
- OCR pipeline
- threshold tuning

### Review Feel

Review should feel like a teacher marking a paper, not like a machine debugging output.

Useful visual language:

- checkmarks
- circles
- corrections
- restrained red-pen markup
- confidence or review flags

The teacher must always feel able to override the system.

## Buttons And Actions

Use one clear primary action per moment.

Examples:

- `Start Scan`
- `New Scan`
- `Save`
- `Review`

Secondary actions should be visually quieter:

- `Login`
- `Menu`
- `Back`
- `Cancel`

Do not make secondary actions compete with the scan task.

## Printed Worksheets

### Worksheet Feel

Worksheets should be:

- clean
- structured
- uncluttered
- purposeful
- premium but practical
- useful even without the app

Avoid:

- clipart for decoration
- borders that add noise
- heavy color dependencies
- tiny answer spaces
- layout experiments during active validation

### Current Scan-Safe Format

The current canonical test packet uses:

- 10 questions per page
- two-column layout
- large open-divider answer boxes
- black square corner markers
- QR/layout payload
- small quiet ScanGrade branding
- title, grade/subject subtitle, and name line

Reference the full worksheet system before creating variants:

- `docs/WORKSHEET_DESIGN_SYSTEM.md`

### Marker And QR Rules

Use black square corner markers as the current marker system.

Use QR as the layout/template handshake, not as the entire layout definition.

Do not change marker geometry, QR placement, answer-box positions, or crop assumptions without real evidence or Tony approval.

## Feedback Colors

Use feedback color conservatively:

| State | Color Role | Product Meaning |
| --- | --- | --- |
| Correct | Green | Looks good |
| Incorrect | Red | Needs correction or teacher attention |
| Uncertain | Yellow/amber | Review needed |
| Neutral | Gray/black | Normal classroom information |

Uncertainty is not failure. The system should visibly ask for review rather than confidently invent.

## Product And TPT Assets

Product assets should show the real worksheet clearly.

Prefer:

- full-page worksheet previews
- answer-box close-ups
- packet overview
- answer key preview
- honest teacher use case

Avoid:

- vague lifestyle graphics
- screenshots that imply unproven automation
- over-promising classroom outcomes
- copied marketplace phrasing

## Copy Voice

Tone should be:

- teacher-to-teacher
- honest
- useful
- lightly warm
- concise

Good:

- "Large answer boxes give students room to write."
- "Clean layout keeps the focus on the math."
- "Answer key included for quick checking."

Avoid:

- "Transform your classroom."
- "Never mark again."
- "AI-powered learning gains."
- "Perfect automatic grading."

## Codex Rules

Codex may autonomously make small, reversible visual polish when it improves:

- spacing
- hierarchy
- contrast
- labels
- mobile fit
- visual calm
- teacher-language clarity

Codex must ask Tony before:

- major redesigns
- brand identity changes
- new navigation models
- worksheet geometry changes
- marketing claims
- customer-facing promises
- OCR/capture/homography/model/backend changes without evidence

## Validation Reminder

Attractive design is not proof of classroom readiness.

Before calling a workflow ready, ScanGrade needs real student samples, clear failure categories, and evidence that teacher review is faster or more trustworthy than marking from scratch.

