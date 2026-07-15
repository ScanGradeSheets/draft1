# ScanGrade Rugged-drive offload manifest — 2026-07-14

Destination root:

`/Volumes/Tony's Rugged HD/Codex/ScanGrade Offloads/2026-07-14-pre-large-grayscale/`

| Local path removed after verification | Backup path relative to destination | Files | Logical bytes reported by rsync |
|---|---|---:|---:|
| `benchmarks/uploaded_student_samples` | `benchmarks/uploaded_student_samples` | 15,298 | 8,547,471,712 |
| `private-evidence/sg3-9-photo-confidence-20260606` | `private-evidence/sg3-9-photo-confidence-20260606` | 11,053 | 3,850,531,662 |

Verification performed before local removal:

- `rsync -anrc --delete --itemize-changes` returned exit status 0 and produced no changed-file output for either tree.
- Source and destination regular-file counts matched exactly.
- The source directories were untracked/ignored archival outputs, not committed source.
- Current debug scans, truth labels, four-packet evidence, current reports, models, code, layouts, tests, and untouched evaluation material remain local.

Internal free space increased from approximately 562 MiB to 13 GiB.

Restore commands, run from the repository root:

```sh
rsync -a "/Volumes/Tony's Rugged HD/Codex/ScanGrade Offloads/2026-07-14-pre-large-grayscale/benchmarks/uploaded_student_samples/" "benchmarks/uploaded_student_samples/"
rsync -a "/Volumes/Tony's Rugged HD/Codex/ScanGrade Offloads/2026-07-14-pre-large-grayscale/private-evidence/sg3-9-photo-confidence-20260606/" "private-evidence/sg3-9-photo-confidence-20260606/"
```
