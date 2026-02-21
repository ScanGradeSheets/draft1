#!/usr/bin/env bash
set -euo pipefail

umask 077

REPO="/Users/openclaw/.openclaw/workspace/scan-grade"
LOGDIR="$REPO/logs"
mkdir -p "$LOGDIR"

STAMP=$(date +"%Y-%m-%d_%H-%M")
OUT="$LOGDIR/nightly_codex_review_$STAMP.txt"

cd "$REPO"
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

PATCH_COMMITS="$(git log --since="24 hours ago" -p --no-color --no-merges || true)"
PATCH_UNSTAGED="$(git diff --no-color || true)"
PATCH_STAGED="$(git diff --cached --no-color || true)"

UNTRACKED_LIST="$(git ls-files --others --exclude-standard || true)"
UNTRACKED_BLOCK=""
if [ -n "$UNTRACKED_LIST" ]; then
  UNTRACKED_BLOCK=$'---\nUNTRACKED FILES (first 200 lines each, max 200KB total patch):\n'
  while IFS= read -r f; do
    [ -f "$f" ] || continue
    UNTRACKED_BLOCK+=$'\n'"FILE: $f"$'\n'
    UNTRACKED_BLOCK+="$(head -n 200 "$f" 2>/dev/null || true)"
    UNTRACKED_BLOCK+=$'\n'
  done <<< "$UNTRACKED_LIST"
fi

PATCH="$PATCH_COMMITS"
[ -n "$PATCH_STAGED" ]   && PATCH+=$'\n\n---\nSTAGED DIFF:\n\n'"$PATCH_STAGED"
[ -n "$PATCH_UNSTAGED" ] && PATCH+=$'\n\n---\nUNSTAGED DIFF:\n\n'"$PATCH_UNSTAGED"
[ -n "$UNTRACKED_BLOCK" ] && PATCH+=$'\n\n'"$UNTRACKED_BLOCK"

[ -n "$PATCH" ] || exit 0

# Redact common secrets before sending anywhere or writing logs.
REDACTED_PATCH="$(printf "%s" "$PATCH" | \
  sed -E \
    -e 's/(sk-[A-Za-z0-9_-]{10,})/[REDACTED_OPENAI_KEY]/g' \
    -e 's/(Bearer[[:space:]]+[A-Za-z0-9._-]{10,})/[REDACTED_BEARER]/g' \
    -e 's/([A-Za-z0-9_]*token[[:space:]]*=[[:space:]]*)[^[:space:]]+/\1[REDACTED_TOKEN]/gi' \
    -e 's/([A-Za-z0-9_]*api[_-]?key[[:space:]]*=[[:space:]]*)[^[:space:]]+/\1[REDACTED_KEY]/gi' \
)"

# Hard cap to avoid OS argument-size issues.
MAX_BYTES=200000
if [ "$(printf "%s" "$REDACTED_PATCH" | wc -c | tr -d ' ')" -gt "$MAX_BYTES" ]; then
  REDACTED_PATCH="$(printf "%s" "$REDACTED_PATCH" | head -c "$MAX_BYTES")"
  REDACTED_PATCH+=$'\n\n[PATCH TRUNCATED TO 200KB]\n'
fi

PROMPT=$'NIGHTLY REVIEW (ScanGrade).\nReview ONLY the patch below (last 24 hours of commits + any staged/unstaged/untracked work).\nPriorities: (1) bugs/regressions, (2) privacy/security, (3) performance/memory, (4) complexity creep, (5) UX friction.\nOutput: Top 5 issues + concrete fixes + suggested tests.\nDo NOT propose deleting files. Avoid broad refactors unless necessary.\n\nPATCH:\n'"$REDACTED_PATCH"

codex exec \
  --cd "$REPO" \
  --model gpt-5.3-codex \
  --sandbox read-only \
  "$PROMPT" > "$OUT" 2>&1

chmod 600 "$OUT" || true
