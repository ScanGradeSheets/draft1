# ScanGrade Trust Threshold Decision Framework

Created 2026-05-30 as product guidance for future OCR/confidence decisions.

This document does not set implementation thresholds. It defines the teacher-trust behavior ScanGrade should aim for once real student samples provide evidence.

## Purpose

ScanGrade's core trust problem is not just "read answers accurately."

The deeper problem is deciding what the app should do when it is unsure:

- grade automatically
- flag for teacher review
- ask the student to rescan
- refuse to score

The system should never hide uncertainty or confidently invent.

## Product Principle

The teacher owns final judgment.

ScanGrade can assist with detection, recognition, preliminary grading, confidence scoring, and review suggestions, but formal records and official scores remain teacher-controlled.

## Plain-English Confidence Labels

Use teacher/student language before raw technical scores.

### Looks Clear

Meaning:

- ScanGrade has a strong read.
- The answer image and interpretation appear consistent.
- Auto-grading may be appropriate in practice mode.

Possible UI:

- "Looks clear"
- "Scanned successfully"
- "Marked"

### Check This

Meaning:

- ScanGrade has a likely interpretation but uncertainty is high enough that a teacher should review.
- The student may be able to correct/rescan in practice mode.

Possible UI:

- "Check this"
- "Review needed"
- "I think this is 15, but please check."

### Could Not Read

Meaning:

- ScanGrade should not score the answer.
- The image, crop, handwriting, or model confidence is too weak.

Possible UI:

- "Could not read"
- "Scan again"
- "Teacher review needed"

## Mode Differences

### Practice Mode

Goal:

- help students correct mistakes and keep moving.

Behavior:

- can auto-grade more often when answers look clear
- can let students rescan
- can show simple correction feedback
- should flag or ask for rescan when uncertain
- should not shame students or imply final judgment

Default bias:

- helpful and forgiving

### Assessment Mode

Goal:

- preserve teacher authority and trustworthy records.

Behavior:

- conservative grading
- uncertain answers require teacher review
- final scores should wait for teacher confirmation if stakes are high
- student feedback may be limited or delayed

Default bias:

- teacher-owned and conservative

## Decision Matrix

| Situation | Practice Mode | Assessment Mode |
| --- | --- | --- |
| Strong read, answer matches key | Mark correct, allow continue | Mark as suggested correct |
| Strong read, answer does not match key | Mark incorrect, allow correction/rescan | Mark as suggested incorrect |
| Likely read, handwriting unclear | Show check/rescan path | Require teacher review |
| Low confidence read | Ask for rescan or review | Require teacher review |
| Crop/page/QR issue | Ask for new scan | Ask for new scan or teacher review |
| Cannot explain result | Do not grade | Do not grade |

## What To Measure In Real Samples

When Tony sends student samples, record:

- raw interpreted answer
- expected answer
- correctness
- confidence/review status
- whether a teacher would agree with the label
- whether the student writing caused the issue
- whether crop/photo quality caused the issue
- whether the worksheet design caused the issue

The key question:

> Did ScanGrade make the teacher's review faster without hiding uncertainty?

## Failure Categories

Use these categories before touching OCR/capture logic:

- photo quality
- page/corner detection
- QR/layout detection
- answer-box crop
- digit recognition
- confidence/review UX
- student writing behavior
- worksheet design issue

## Teacher Review Cost

Flagging everything is safe but may waste teacher time.

Auto-grading too much is fast but may destroy trust.

The target is not maximum automation. The target is:

> automatic where clear, review where uncertain, refusal where unreliable.

## Tony Decisions Needed Later

After the first real sample test, Tony should decide:

1. In practice mode, how much uncertainty is acceptable before asking a student to rescan?
2. In assessment mode, should any score become official without teacher review?
3. What wording feels trustworthy: "Check this", "Needs review", "Could not read", or something else?
4. Should students see correctness immediately on all practice work?
5. Should students ever see confidence/review details?
6. How many review flags per page still feels faster than marking manually?

## Codex Rules

Codex must not hard-code new confidence threshold behavior without:

- real student sample evidence
- a reproducible test
- a plain-English failure summary
- Tony approval if product behavior changes

Codex may prepare:

- review labels
- test report templates
- confidence-analysis scripts
- teacher-facing UX mock/spec language
- Mission Control decision cards

## Default Recommendation

Until evidence says otherwise:

- practice mode should be helpful and allow correction/rescan
- assessment mode should be conservative
- uncertain answers should be visible
- unreadable answers should not be scored
- teacher override must remain easy and final

