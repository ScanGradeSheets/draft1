#!/usr/bin/env bash
set -euo pipefail

MSG="${1:-}"
[ -n "$MSG" ] || exit 0

TOOLS="/Users/openclaw/.openclaw/workspace/scan-grade/tools/kanban"

TITLE="$("$TOOLS/parse_add_card.py" "$MSG" | tr -d "\r")"
TITLE="$(echo "${TITLE:-}" | sed "s/^[[:space:]]*//;s/[[:space:]]*$//")"
[ -n "${TITLE:-}" ] || exit 0

# Always add to Backlog (safe). Notes include the raw message.
"$TOOLS/board_add_card.py" "$TITLE" "Backlog" "From text: $MSG"

echo "ADD_CARD_OK title=$TITLE"

# Reply to Tony confirming card creation (fallback to allowFrom[0] if IMESSAGE_TO not set)
TO="${IMESSAGE_TO:-}"
if [ -z "${TO:-}" ] && [ -f "/Users/openclaw/.openclaw/credentials/imessage-allowFrom.json" ]; then
  TO="$(python3 - <<'PY'
import json
p="/Users/openclaw/.openclaw/credentials/imessage-allowFrom.json"
j=json.load(open(p,"r",encoding="utf-8"))
vals = j.get("allowFrom") if isinstance(j, dict) else (j if isinstance(j, list) else [])
vals = [str(x).strip() for x in (vals or []) if str(x).strip()]
print(vals[0] if vals else "")
PY
)"
fi

if [ -n "${TO:-}" ]; then
  openclaw message send --channel imessage --target "$TO" --message "✅ Added to Backlog: $TITLE" >/dev/null 2>&1 || true
  echo "REPLIED_TO=$TO"
else
  echo "REPLY_SKIPPED no_target"
fi
