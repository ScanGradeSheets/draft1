#!/bin/zsh
set -euo pipefail

REPO="/Users/openclaw/.openclaw/workspace/scan-grade"
LOGDIR="$REPO/logs"
mkdir -p "$LOGDIR"

STAMP=$(date +"%Y-%m-%d_%H-%M")
OUT="$LOGDIR/nightly_codex_review_$STAMP.txt"

cd "$REPO"
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

# Patch for commits in the last 24 hours
PATCH_COMMITS=$(git log --since="24 hours ago" -p --no-color --no-merges || true)

# Include any uncommitted work too (so nothing is missed)
PATCH_WORKTREE=$(git diff --no-color || true)

PATCH="$PATCH_COMMITS"
if [ -n "$PATCH_WORKTREE" ]; then
  PATCH="$PATCH\n\n---\nUNCOMMITTED WORKTREE DIFF:\n\n$PATCH_WORKTREE"
fi

# If nothing changed, exit quietly
[ -n "$PATCH" ] || exit 0

PROMPT="NIGHTLY REVIEW (ScanGrade). Review ONLY the patch below (last 24 hours of commits + any uncommitted diff). Priorities: (1) bugs/regressions, (2) privacy/security, (3) performance/memory, (4) complexity creep, (5) UX friction. Output: Top 5 issues + concrete fixes + suggested tests. Do NOT propose deleting files. Avoid broad refactors unless necessary.\n\nPATCH:\n$PATCH"

script -q "$OUT" codex "$PROMPT"
