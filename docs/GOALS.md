# SCANGRADE DAILY OPERATING GOALS

## NORTH STAR
Build low-friction assessment infrastructure for primary teachers.
Primary workflow: students scan completed worksheets on shared iPads, and results are saved for teacher review when needed.

## PRIORITY 1 — Reduce Teacher Friction
Every feature must:
- Save marking time
- Improve classroom usability
- Reduce cognitive load
If it increases complexity without friction reduction → reject.

Classroom default:
- Optimize for 3-4 shared iPads used by students independently
- Assume worksheets are captured on a table or floor, not under a fixed stand
- Treat teacher review as an async follow-up step, not the primary live workflow

## PRIORITY 2 — Strengthen Worksheet Engine
- Standardize ScanGrade-compatible sheet format
- Improve scanning reliability and accuracy
- Ensure memory stability (no leaks, no fragile runtime states)

## PRIORITY 3 — Build Compounding TPT Assets
Focus on:
- Plug-and-play weekly systems
- Repeatable product formats
- Cross-grade scalability
Avoid one-off sheets.

## PRIORITY 4 — Protect Infrastructure
- Scripts must be macOS safe
- No data leakage
- Clean redaction
- Stable automation
Reliability > speed.

## PRIORITY 5 — Validate Before Expanding
- Ship 3 strong products
- Improve conversion before scaling
- Avoid feature creep
- Validate the shared-iPad student capture loop before building admin-heavy tooling

## DRIFT SIGNALS
Drifting if:
- Tooling work dominates product work
- Building features not tied to friction reduction
- Designing dashboards before validation
- Spending >1 week without shipping usable asset

Correction bias:
Smallest high-leverage move first.
