#!/usr/bin/env bash
set -euo pipefail

umask 077

REPO="/Users/openclaw/.openclaw/workspace/scan-grade"
LOGDIR="$REPO/logs"
PLANDIR="$REPO/logs/hobbes_plans"
mkdir -p "$PLANDIR"

LATEST="$(ls -1t "$LOGDIR"/nightly_codex_review_*.txt 2>/dev/null | head -n 1 || true)"
[ -n "${LATEST:-}" ] || { echo "No nightly_codex_review_*.txt found. Exiting."; exit 0; }
[ -r "$LATEST" ] || { echo "Latest log not readable: $LATEST"; exit 0; }

STAMP="$(date +"%Y-%m-%d_%H-%M")"

# Allow disabling iMessage delivery during manual runs
: "${SEND_IMESSAGE:=1}"
PLAN_OUT="$PLANDIR/hobbes_plan_$STAMP.txt"
TEXT_OUT="/tmp/scangrade_text_to_tony.txt"

REPORT_HEAD="$(basename "$LATEST")"
REPORT_TXT="$(cat "$LATEST")"

PROMPT="$(cat <<EOF
You are Hobbes.

Read the nightly review below and output EXACTLY two blocks with the exact tags.

RULES:
- Output MUST contain the exact tags below.
- Output NOTHING outside the tags.
- Do NOT output JSON.
- Do NOT call tools.
- TEXT_TO_TONY must be under 900 characters.
- End TEXT_TO_TONY with: Reply with: DETAILS | BUILD: APPLY SAFE | BUILD: CRITICAL

===TEXT_TO_TONY===
<one friendly iMessage to Tony summarizing the 2–4 most important points and what to do today>
===END_TEXT_TO_TONY===

===HOBBES_PLAN===
<bullet plan with file targets, tests to run, and risk notes>
===END_HOBBES_PLAN===

NIGHTLY REVIEW FILE: $REPORT_HEAD

$REPORT_TXT
EOF
)"

JSON_FILE="$(mktemp)"
JSON_DEBUG="$LOGDIR/morning_hobbes_summary_debug_$STAMP.json"

# Get structured output from agent (hard timeout so it can't hang forever)
if ! openclaw agent --agent main --message "$PROMPT" --timeout 300 --json > "$JSON_FILE"; then
  echo "Agent call failed."
  exit 1
fi

# Keep a copy for debugging if parsing fails
cp "$JSON_FILE" "$JSON_DEBUG" 2>/dev/null || true

python3 - "$JSON_FILE" "$PLAN_OUT" "$TEXT_OUT" <<'PY'
import json, re, sys, pathlib

json_path = pathlib.Path(sys.argv[1])
plan_path = pathlib.Path(sys.argv[2])
text_out  = pathlib.Path(sys.argv[3])

data = json.loads(json_path.read_text(encoding="utf-8"))
payloads = data.get("result", {}).get("payloads", [])

if not payloads:
    raise SystemExit("No payloads returned from agent (debug JSON saved).")

text = payloads[0].get("text", "")
if not text.strip():
    raise SystemExit("Payload text is empty (debug JSON saved).")

# Preferred strict format
m_text = re.search(r"===TEXT_TO_TONY===\n(.*?)\n===END_TEXT_TO_TONY===", text, re.S)
m_plan = re.search(r"===HOBBES_PLAN===\n(.*?)\n===END_HOBBES_PLAN===", text, re.S)

if m_text and m_plan:
    text_to_tony = m_text.group(1).strip()
    hobbes_plan  = m_plan.group(1).strip()
else:
    # Fallback: treat entire output as plan, generate a safe minimal text
    hobbes_plan = text.strip()
    text_to_tony = (
        "Morning — I generated the review summary, but the formatting tags failed today.\n\n"
        "Here’s the key output (saved as Hobbes plan). If you want me to retry the formatted version, reply: DETAILS.\n\n"
        "Reply with: DETAILS | BUILD: APPLY SAFE | BUILD: CRITICAL"
    )

plan_path.write_text(hobbes_plan + "\n", encoding="utf-8")
text_out.write_text(text_to_tony + "\n", encoding="utf-8")

print(text_to_tony)
PY

rm -f "$JSON_FILE"

echo ""
echo "----- DEBUG: attempting iMessage delivery -----"
echo ""

# Prefer env var, but fall back to locked-down config file for cron safety.
if [ -z "${IMESSAGE_TO:-}" ]; then
  CONF="$REPO/tools/imessage_to.conf"
  if [ -r "$CONF" ]; then
    IMESSAGE_TO="$(tr -d '[:space:]' < "$CONF")"
  fi
fi

if [ -z "${IMESSAGE_TO:-}" ]; then
  echo "IMESSAGE_TO is not set and tools/imessage_to.conf not readable. Skipping delivery."
  echo "Saved:"
  echo "  Text: $TEXT_OUT"
  echo "  Plan: $PLAN_OUT"
  echo "  Debug JSON: $JSON_DEBUG"
  exit 0
fi

# Send the generated TEXT_TO_TONY as a raw iMessage (no agent turn, no session routing).
if [ "$SEND_IMESSAGE" = "1" ]; then
  openclaw message send --channel imessage --target "$IMESSAGE_TO" --message "$(cat "$TEXT_OUT")" >/dev/null
fi

echo "✅ Sent via iMessage to $IMESSAGE_TO"
echo ""
echo "Saved:"
echo "  Text: $TEXT_OUT"
echo "  Plan: $PLAN_OUT"
echo "  Debug JSON: $JSON_DEBUG"
