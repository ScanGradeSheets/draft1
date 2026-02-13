#!/usr/bin/env bash
set -euo pipefail
umask 077

REPO="/Users/openclaw/.openclaw/workspace/scan-grade"
LOGDIR="$REPO/logs"
STATE="$LOGDIR/progress_checkin.state"
mkdir -p "$LOGDIR"

TO="+16479868669"

TS="$(date +"%Y-%m-%d %H:%M:%S")"
NOW_EPOCH="$(date +%s)"
LAST_EPOCH="0"
if [ -r "$STATE" ]; then LAST_EPOCH="$(tr -d '[:space:]' < "$STATE")"; fi

cd "$REPO"

# Detect any git changes
CHANGES="no"
git diff --quiet || CHANGES="yes"
git diff --cached --quiet || CHANGES="yes"
[ -n "$(git status --porcelain 2>/dev/null || true)" ] && CHANGES="yes"

# Detect recent log activity (any log file modified since last epoch)
LOG_ACTIVITY="no"
if find "$LOGDIR" -type f -name "*.log" -newermt "@$LAST_EPOCH" 2>/dev/null | head -n 1 | grep -q .; then
  LOG_ACTIVITY="yes"
fi

if [ "$CHANGES" = "no" ] && [ "$LOG_ACTIVITY" = "no" ]; then
  echo "$NOW_EPOCH" > "$STATE"
  exit 0
fi

# Compose a short message (no LLM)
BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")"
LAST_COMMIT="$(git log -1 --pretty=format:'%h — %s' 2>/dev/null || true)"
STATUS_SUMMARY="$(git status --porcelain 2>/dev/null | head -n 12 || true)"

MSG="ScanGrade check-in ($TS)
Branch: $BRANCH
Last commit: ${LAST_COMMIT:-none}

Changes:
${STATUS_SUMMARY:-<none shown>}

If you want details: reply DETAILS"

openclaw message send --channel imessage --target "$TO" --message "$MSG" >/dev/null

echo "$NOW_EPOCH" > "$STATE"
