#!/usr/bin/env bash
set -euo pipefail

MSG="${1:-}"
[ -n "$MSG" ] || exit 0

TOOLS="/Users/openclaw/.openclaw/workspace/scan-grade/tools/kanban"

# 1. Standard OpenClaw logic: Try to add a card if requested
"$TOOLS/imessage_add_card_handler.sh" "$MSG" >/dev/null 2>&1 || true

# 2. INSTANT REPLY: Call the 35B Brain immediately
# We use a short timeout so it doesn't hang the terminal
RESPONSE=$(ollama run hobbes-35b "Tony texted: '$MSG'. Give a witty, 1-sentence acknowledgement of the text or the task.")

# 3. Send that response back to your phone
# Assuming IMESSAGE_TO is set in your environment or imessage_to.conf
TARGET=$(cat "$TOOLS/../imessage_to.conf" 2>/dev/null || echo "tony")
/usr/local/bin/openclaw message send --channel imessage --target "$TARGET" --message "Hobbes: $RESPONSE" >/dev/null 2>&1 || true

exit 0
