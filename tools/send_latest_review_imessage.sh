#!/usr/bin/env bash
set -euo pipefail

REPO="/Users/openclaw/.openclaw/workspace/scan-grade"
LOGDIR="$REPO/logs"

LATEST="$(ls -t "$LOGDIR"/nightly_codex_review_*.txt 2>/dev/null | head -n 1 || true)"
[ -n "$LATEST" ] || exit 0

BODY="$(tail -n 220 "$LATEST")"

MESSAGE=$'Good morning — Nightly ScanGrade Review\n\n'"$BODY"$'\n\n---\nReply with:\nDETAILS — resend longer\nAPPROVE — generate minimal diff-only patch (no apply)\nIGNORE — do nothing\n'

# Send via iMessage directly to your phone number
openclaw agent --channel imessage --to +16479868669 --deliver --message "$MESSAGE"
