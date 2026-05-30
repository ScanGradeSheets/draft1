# Student Sample Privacy And Storage

Created 2026-05-30 for real classroom worksheet samples.

## Principle

Student worksheet photos are evidence for improving ScanGrade, not product assets. Treat them as private local test material unless Tony explicitly decides otherwise.

## Default Rules

- Do not commit student-identifiable photos to git.
- Do not push student photos to GitHub Pages.
- Do not use student photos in marketing, demos, TPT previews, or public docs without Tony's explicit approval.
- Keep original received files intact until the evaluation summary is reviewed.
- Prefer anonymous filenames such as `sheet-a-student-01.jpg`.
- Avoid names, initials, student numbers, or classroom identifiers in filenames.

## If Names Appear On Sheets

For internal testing:

- Preserve the original locally.
- Note that a student name is visible.
- Use the original only for private evaluation.

For any shareable artifact:

- Make a redacted copy.
- Crop or cover the name area.
- Keep the redacted copy separate from the original.
- Clearly label the copy as redacted.

## Suggested Local Folder

Use:

```text
worksheet photos/student-samples/open-divider-2026-05/
```

Possible structure:

```text
worksheet photos/student-samples/open-divider-2026-05/originals/
worksheet photos/student-samples/open-divider-2026-05/redacted/
worksheet photos/student-samples/open-divider-2026-05/results/
```

Do not create this structure until samples arrive unless it is useful for organization.

## Git And Cleanup Warnings

Before any cleanup:

- Check `git status --short`.
- Check for untracked files under `worksheet photos/`.
- Back up samples before moving or deleting anything.

Never use broad cleanup commands like:

```text
git clean -fd
git reset --hard
```

These could destroy untracked classroom evidence.

## Reporting Results

When reporting sample results, use teacher-safe language:

- "3 of 5 pages were detected cleanly."
- "Two answers need teacher review."
- "One photo was too blurred for a fair test."

Avoid including names, raw student images, or unnecessary identifying details in summaries.

## Future Decision Needed

Tony should eventually decide a retention rule:

- Keep all classroom samples until the first pilot is complete.
- Keep only redacted samples after evaluation.
- Delete originals after confirmed backup and summarized results.

Until that decision is made, preserve originals locally and keep them out of public surfaces.
