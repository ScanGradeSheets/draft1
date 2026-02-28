#!/usr/bin/env bash
set -euo pipefail

# Make sure we can find ollama
export PATH="/usr/local/bin:/usr/bin:/bin"

REPO="/Users/openclaw/.openclaw/workspace/scan-grade"
STATE="$REPO/tools/kanban/state"
BOARD="$REPO/dist/board_state.json"
OUT_JSON="$STATE/work_request.json"

# Local model to use
MODEL="qwen2.5:14b-instruct"

# If board is missing, just write an idle request and bail
if [[ ! -s "$BOARD" ]]; then
  echo "No board_state.json at $BOARD; writing idle work_request.json"
  cat > "$OUT_JSON" <<EOF2
{
  "kind": "idle",
  "card_id": null,
  "reason": "missing_board_state",
  "next_steps": []
}
EOF2
  exit 0
fi

TMP_PROMPT="$(mktemp -t hobbes_brain_prompt.XXXXXX)"
TMP_OUT="$(mktemp -t hobbes_brain_out.XXXXXX)"

echo "RUN_LOCAL_BRAIN model=$MODEL board=$BOARD"

BOARD_JSON="$(python3 - "$BOARD" << 'PY'
import json, sys, pathlib

board_path = pathlib.Path(sys.argv[1])
data = json.load(board_path.open("r", encoding="utf-8"))

filtered_columns = []

for col in data.get("columns", []):
    name = (col.get("name") or "").lower()
    # Skip Review and Done columns completely
    if "review" in name or "done" in name:
        continue

    # Keep other columns (In Progress, To Do, Backlog, etc.),
    # but drop any frozen cards.
    cards = []
    for card in col.get("cards", []):
        feedback = (card.get("feedback") or "")
        frozen = any(
            line.strip().startswith("HOBBES RULE: This card is frozen.")
            for line in feedback.splitlines()
        )
        if frozen:
            continue
        cards.append(card)

    if cards:
        new_col = dict(col)
        new_col["cards"] = cards
        filtered_columns.append(new_col)

data["columns"] = filtered_columns
print(json.dumps(data, ensure_ascii=False))
PY
)"

cat > "$TMP_PROMPT" <<EOF2
You are a planning assistant for a Kanban development board.

You will receive the full board JSON and must choose at most ONE card for Hobbes to work on next.

Your goals (in this order of priority):
- Prefer cards in a column whose name is "In Progress" (or very close).
- If none are suitable, prefer cards in a column whose name is "To Do" (or very close).
- If none are suitable there either, you may look at other columns such as "Backlog".
- Never pick cards from any column whose name includes "Review".
- Never pick cards from any column whose name includes "Done".

The board JSON structure looks like this (example):

{
  "current_mission": "...",
  "updated_at": "...",
  "columns": [
    {
      "id": "...",
      "name": "...",
      "cards": [
        {
          "id": "...",
          "title": "...",
          "status": "...",
          "notes": "...",
          "feedback": "..."
        }
      ]
    }
  ]
}

Special rules about card feedback:
- Each card may have a "feedback" field that contains human-written notes.
- If the feedback contains a line starting with:
  "HOBBES RULE: This card is frozen."
  then treat that card as OFF-LIMITS and do NOT select it for work.
- In general, obey any "HOBBES RULE" lines in the feedback before making your choice.

Here is the ACTUAL board JSON to use:

BOARD_JSON_START
$BOARD_JSON
BOARD_JSON_END

From this board, pick the single best next card (if any) for Hobbes to work on.

RESPOND ONLY with ONE JSON object, no extra text, in this exact schema:

{
  "kind": "work" or "idle",
  "card_id": "<the id of the chosen card, or null>",
  "reason": "<short one-line reason>",
  "next_steps": ["<short step 1>", "<short step 2>", "..."]
}

Rules:
- If there is no sensible card to work on (for example, if all non-frozen cards are in Review/Done, or none are appropriate), set "kind" to "idle" and "card_id" to null.
- "next_steps" should be 1–4 short, concrete actions (strings).
- Do NOT include any keys other than: kind, card_id, reason, next_steps.
- Do NOT include backticks, markdown, or any prose outside the JSON.
EOF2

# 1) Call the local model via Ollama
if ! /usr/local/bin/ollama run "$MODEL" < "$TMP_PROMPT" > "$TMP_OUT" 2>>"$REPO/logs/brain_tick.log"; then
  echo "ollama run failed; writing idle work_request.json"
  cat > "$OUT_JSON" <<EOF2
{
  "kind": "idle",
  "card_id": null,
  "reason": "ollama_run_failed",
  "next_steps": []
}
EOF2
  rm -f "$TMP_PROMPT" "$TMP_OUT"
  exit 0
fi

# 2) Extract JSON and coerce it into a safe schema
python3 - "$TMP_OUT" "$OUT_JSON" << 'PY'
import json, re, sys, pathlib

raw_path = pathlib.Path(sys.argv[1])
out_path = pathlib.Path(sys.argv[2])

raw = raw_path.read_text(encoding="utf-8", errors="ignore")

# Grab the first {...} block we see
m = re.search(r'\{.*\}', raw, re.S)
if not m:
    print("No JSON object found in model output.")
    data = {
        "kind": "idle",
        "card_id": None,
        "reason": "no_json_from_model",
        "next_steps": []
    }
else:
    text = m.group(0)
    try:
        data = json.loads(text)
    except Exception as e:
        print("Failed to parse JSON from model:", e)
        data = {
            "kind": "idle",
            "card_id": None,
            "reason": "bad_json_from_model",
            "next_steps": []
        }

# Normalise schema
if not isinstance(data, dict):
    data = {
        "kind": "idle",
        "card_id": None,
        "reason": "non_dict_json_from_model",
        "next_steps": []
    }

kind = data.get("kind", "idle")
if kind not in ("work", "idle"):
    kind = "idle"

card_id = data.get("card_id", None)
if card_id is not None and not isinstance(card_id, str):
    card_id = str(card_id)

reason = data.get("reason", "")
if not isinstance(reason, str):
    reason = str(reason)

steps = data.get("next_steps", [])
if not isinstance(steps, list):
    steps = [steps]
steps = [str(s) for s in steps][:6]

clean = {
    "kind": kind,
    "card_id": card_id,
    "reason": reason,
    "next_steps": steps,
}

out_path.write_text(json.dumps(clean, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"OK: wrote clean work_request.json -> {out_path}")
PY

rm -f "$TMP_PROMPT" "$TMP_OUT"
