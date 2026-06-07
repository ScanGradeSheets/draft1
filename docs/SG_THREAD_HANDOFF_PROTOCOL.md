# ScanGrade Thread Handoff Protocol

Purpose:
Keep ScanGrade recoverable when Codex Desktop updates, crashes, compacts context, or opens a new thread instead of the old one.

This protocol is deliberately small. The goal is not to create another giant recovery archive. The goal is to leave the next Codex agent enough current state to continue from the last real checkpoint.

## Source Of Truth Order

Read in this order:

1. `AGENTS.md`
2. `SCANGRADE_ACTIVE_HANDOFF.md`
3. `SCANGRADE_RECOVERED_PROJECT_MEMORY.md`
4. `SCANGRADE_VISION_AND_PRODUCT_PRINCIPLES.md`
5. `SCANGRADE_VISION_INTERVIEW_ADDENDUM.md`
6. Mission Control state under `mission-control/state/`
7. Current repo state with `git status --short`

Older generated recovery files are useful background, not current truth.

## When To Update The Handoff

Update `SCANGRADE_ACTIVE_HANDOFF.md` before ending a meaningful ScanGrade work turn when any of these happened:

- The active mission changed.
- New evidence arrived, such as photos, debug JSONs, crops, screenshots, or test outputs.
- A benchmark or replay was run.
- OCR/confidence/capture/homography/model code changed.
- Mission Control state changed.
- A commit, push, or rollback point was created.
- A blocker was discovered.
- The thread is likely to be interrupted or context is getting long.

For a long tuning run, update it after each benchmark loop or before trying a riskier patch.

## Minimum Handoff Entry

Add a short running-log entry with:

```text
Date / thread:
What changed:
Evidence used:
Commands run:
Results:
Files changed:
Rollback point:
Next action:
Open risks:
```

If no files changed, say so. If a command could not run, say why.

## OCR-Specific Rules

For OCR/confidence work, the handoff must keep these numbers separate:

- handwritten-truth accuracy,
- answer-key correctness,
- confident-read coverage,
- confident-wrong count,
- review/low-confidence count.

Do not count a student-written wrong answer as an OCR failure if the OCR read matches the handwriting.

Do not call a patch successful just because it lowers review flags. It must keep confident-wrong reads at zero on the evidence set being used.

## Privacy Rules

Do not commit private student photos, screenshots, raw crops, or exported crop bundles unless Tony explicitly approves that exact artifact.

It is okay to record local paths to private evidence so a future local thread can find them.

Use local paths like:

```text
/tmp/codex-remote-attachments/...
/Users/openclaw/Desktop/3/...
```

## Mission Control Rules

Mission Control should summarize current project state in teacher/product language.

Update Mission Control when the project status materially changes, but do not use it as the detailed OCR lab notebook. Keep detailed benchmark facts in `SCANGRADE_ACTIVE_HANDOFF.md` or a dedicated benchmark report.

Do not change core product vision, positioning, UX direction, brand identity, launch strategy, marketing claims, or customer promises without Tony's approval.

## Crash Recovery Rule

If a future SG thread starts after a Codex update or crash:

1. Do not try to resume a huge old thread if it triggers errors.
2. Rename the new thread as the next SG number if possible.
3. Read `SCANGRADE_ACTIVE_HANDOFF.md`.
4. Inspect repo state.
5. Continue from the `Next Action` section.
6. Update the handoff once the new thread is stable.
