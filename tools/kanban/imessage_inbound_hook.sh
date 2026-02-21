#!/usr/bin/env bash
set -euo pipefail

# OpenClaw should pass the inbound text as $1 (and optionally sender/metadata as later args).
MSG="${1:-}"
[ -n "$MSG" ] || exit 0

TOOLS="/Users/openclaw/.openclaw/workspace/scan-grade/tools/kanban"

# If message looks like "add a card ...", this will add to Backlog; otherwise it exits 0 quietly.
OUT="$("$TOOLS/imessage_add_card_handler.sh" "$MSG" 2>/dev/null || true)"

# Optional: send a quiet confirmation ONLY when a card was actually added.
# (comment this in if you want confirmations)
# if echo "$OUT" | grep -q "^ADD_CARD_OK "; then
#   TITLE="$(echo "$OUT" | sed -n 's/^ADD_CARD_OK title=//p' | head -n1)"
#   if [ -n "${IMESSAGE_TO:-}" ] && [ -n "${TITLE:-}" ]; then
#     openclaw message send --channel imessage --target "${IMESSAGE_TO}" --message "Added to Backlog: $TITLE" >/dev/null 2>&1 || true
#   fi
# fi

exit 0
