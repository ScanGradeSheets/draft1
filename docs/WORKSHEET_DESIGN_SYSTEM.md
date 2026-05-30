# ScanGrade Worksheet Design System

Created 2026-05-30 from Tony's ScanGrade vision interview and the current Grade 2 open-divider worksheet packet.

This is an internal design guide for Codex agents. It should guide new worksheet artifacts, preview assets, and TPT product pages. It does not replace classroom validation, and it should not be used as permission to change current worksheet geometry without evidence.

## Design Goal

ScanGrade worksheets should preserve the simplicity of paper while making scanning and review reliable.

They should feel:

- Clean
- Structured
- Professional
- Calm
- Purposeful
- Easy for Grade 1/2 students to understand

They should not feel:

- Decorative for decoration's sake
- Like a technical form
- Like cartoonish educational software
- Like generic worksheet-factory output

## Core Principles

### Every Element Earns Its Place

Avoid visual clutter. A worksheet element should support one of these jobs:

- Help the student understand the task.
- Give the student a clear place to answer.
- Help ScanGrade detect the page and layout.
- Help the teacher identify or review the sheet.
- Support brand recognition without distracting from work.

### Paper First, Scanning Second, Marketing Third

The worksheet must work as a normal classroom worksheet even if the app is not used.

After that, it must be scan-friendly.

Only after those two needs are met should marketplace polish be layered on.

### Teacher Trust Beats Visual Novelty

Do not invent a new answer-box style, QR placement, marker system, or layout structure just because it looks interesting. Changes to scan-critical geometry need reproducible test evidence or Tony's approval.

## Current Canonical Test Format

The current classroom test packet uses:

- Grade 2 math sheets
- 10 questions per page
- Two-column layout
- Large open-divider answer boxes
- Four black corner markers
- QR payload near the lower area of the sheet
- Small ScanGrade brand mark
- Clean title/subtitle/name area

Current files:

- `public/worksheets/open-divider-test/grade2-addition-within-20-open-divider.svg`
- `public/worksheets/open-divider-test/grade2-subtraction-within-20-open-divider.svg`
- `public/worksheets/open-divider-test/grade2-mixed-within-50-open-divider.svg`
- `public/worksheets/open-divider-test/printables/ScanGrade-Grade2-Worksheets-A-B-C-Open-Divider-Test-Packet.pdf`

This packet is the active classroom validation target.

## Page Structure

### Header

Use a clear, centered title and grade/subject subtitle.

Include a name line. Early elementary classrooms still need normal paper-management affordances.

Do not make the header feel like marketing space. It should orient the student quickly.

### Question Area

Use predictable repeated question rows.

Keep problem text, question labels, and answer boxes aligned consistently. Grade 1/2 students should be able to scan the page visually and understand the pattern without verbal explanation.

### Footer / Technical Area

Keep QR/layout metadata away from the main work area.

Technical affordances should be present but visually quiet.

## Answer Boxes

### Current Open-Divider Direction

The current preferred test direction is the open-divider answer box:

- Wide rectangular answer area
- A subtle center divider cue
- Enough room for two-digit Grade 2 answers
- Visually simple enough for students
- Structured enough for digit cropping

The current open-divider generator uses:

- Answer box height: `17.2`
- Open divider guide stroke: `#707780`
- Open mark length: `4.35`
- Divider guide inset: `2.6`

These values should not be changed casually.

### Student Writing Needs

Answer boxes must tolerate:

- Large handwriting
- Uneven spacing
- Reversed numbers
- Incomplete erasures
- Imperfect pencil marks

Do not require students to write like adults or perfectly center every digit.

### Scan Needs

Answer boxes must support:

- Stable crop locations
- Clear digit separation
- Low visual noise
- Enough contrast for pencil marks
- Robustness to slight page skew

### What To Avoid

Avoid:

- Tiny answer boxes
- Decorative answer boxes
- Heavy internal grid lines that compete with handwriting
- Ambiguous writing regions
- Layouts where students may write outside the intended crop area

## Typography

Use Lexend where possible because it is already used in current worksheet and product assets.

Typography should be:

- Clear
- Rounded enough for young students
- Professional enough for teachers
- Consistent across a product family

Avoid:

- Comic-style fonts
- Overly decorative display fonts
- Tiny instructional text
- Large marketing-style headlines on student worksheets

## Visual Style

### Palette

Student worksheets should stay mostly black, white, and quiet gray for print reliability.

ScanGrade green can be used in preview assets, cover pages, Mission Control, and teacher-facing product materials. Use it sparingly on student pages unless print testing proves it is helpful and does not distract.

### Branding

Current canonical app-facing logo files:

- `public/scangrade-logo.png`
- `public/scangrade-logo-transparent.png`

Student worksheet branding should be small and quiet. Product covers/previews can be more visibly branded.

### Decoration

Avoid decorative filler. If an icon, shape, border, or illustration is present, it should clarify the worksheet's purpose or support the product package.

## Scan-Safe Rules

Before a worksheet is considered scan-ready:

- Corner markers must be visible.
- QR/layout payload must remain readable.
- Answer boxes must match a layout definition.
- Question order must match the answer key.
- No decorative element should resemble a marker, digit, answer line, or QR.
- The worksheet should print cleanly in black and white.
- The full page should remain understandable when photographed.

## Answer Keys

Every worksheet product should include a teacher answer key.

Answer keys should:

- Be easy to skim.
- Match worksheet labels and titles.
- Avoid raw layout or OCR terminology.
- Include a caution if the worksheet is still in classroom-testing status.

Current example:

- `public/worksheets/open-divider-test/teacher-answer-key.html`
- `public/worksheets/open-divider-test/printables/ScanGrade-Grade2-Open-Divider-Teacher-Answer-Key.pdf`

## Product Packaging

Each future worksheet product should aim to include:

- Student worksheet PDFs
- Combined packet PDF
- Teacher answer key
- Terms-of-use page
- Preview image or cover
- Listing copy

Do not publish or over-market a ScanGrade-compatible product until the worksheet format and teacher-facing promise are supported by classroom evidence.

## Validation Checklist For New Worksheets

Before committing a new worksheet family:

- [ ] Student can tell where to write.
- [ ] Teacher can use it as a normal worksheet without the app.
- [ ] Answer key exists.
- [ ] Layout metadata exists.
- [ ] QR payload points to the intended layout.
- [ ] Answer boxes align with expected crops.
- [ ] PDF prints at correct page size.
- [ ] Preview page links to all artifacts.
- [ ] App/upload path has been tested with at least one fixture.
- [ ] Any scan-critical geometry change is documented.

## Codex Rules

Codex may:

- Draft new worksheet ideas.
- Create product packaging assets.
- Create answer keys and preview pages.
- Document layout standards.
- Suggest variants for Tony to approve.

Codex must not:

- Change active classroom-test worksheet geometry without evidence.
- Change QR/layout/answer-key relationships casually.
- Add broad curriculum claims.
- Replace Tony's product positioning.
- Treat attractive preview assets as proof of scan readiness.

## Open Design Questions

These need Tony or classroom evidence:

1. Final answer-box dimensions after real Grade 2 handwriting tests.
2. Whether the open-divider box becomes the canonical ScanGrade style.
3. How much ScanGrade branding belongs on student worksheets.
4. Whether student feedback sheets need a different visual design from printable practice sheets.
5. How worksheet families should scale across grades and subjects.
