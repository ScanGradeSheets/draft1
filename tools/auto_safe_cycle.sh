#!/usr/bin/env bash
set -euo pipefail

umask 077

REPO="/Users/openclaw/.openclaw/workspace/scan-grade"
cd "$REPO"

LOGDIR="$REPO/logs"
STATE="$REPO/.state"
mkdir -p "$LOGDIR" "$STATE"

IMSG_CONF="$REPO/tools/imessage_to.conf"
IMESSAGE_TO="${IMESSAGE_TO:-}"
if [ -z "${IMESSAGE_TO:-}" ] && [ -r "$IMSG_CONF" ]; then
  IMESSAGE_TO="$(tr -d '[:space:]' < "$IMSG_CONF")"
fi

TS="$(date +"%Y-%m-%d_%H-%M-%S")"
RUNLOG="$LOGDIR/auto_safe_cycle_$TS.log"

echo "[auto-safe] start $TS" | tee -a "$RUNLOG"

# Simple lock to avoid overlapping runs
LOCK="$STATE/auto_safe.lock"
if [ -e "$LOCK" ]; then
  echo "[auto-safe] lock exists, skipping" | tee -a "$RUNLOG"
  exit 0
fi
trap 'rm -f "$LOCK"' EXIT
touch "$LOCK"

# Prompt: apply SAFE fixes (#1–#5) with strict guardrails
PROMPT=$'You are Hobbes working on ScanGrade.\n\nGoal: Apply SAFE fixes based on the latest review findings.\n\nScope (SAFE):\n- Tools scripts: tools/nightly_codex_review.sh, tools/send_latest_review_imessage.sh, and any tools scripts involved in redaction/sending.\n- src/App.vue ONLY for:\n  (a) ensuring OpenCV cv.Mat cleanup uses a finally block (no leaks)\n  (b) resetting runtimeStatus at the start of each runtime test run\n\nRules:\n- Do NOT touch anything outside tools/* and src/App.vue.\n- Do NOT introduce new dependencies.\n- Keep changes small and reversible.\n- After edits, summarize exactly what you changed and which files.\n\nNow do the edits.'

JSON="$(mktemp)"
if ! openclaw agent --agent main --message "$PROMPT" --timeout 900 --json > "$JSON"; then
  echo "[auto-safe] agent failed" | tee -a "$RUNLOG"
  rm -f "$JSON"
  if [ -n "${IMESSAGE_TO:-}" ]; then
    openclaw message send --channel imessage --target "$IMESSAGE_TO" --message "⚠️ ScanGrade SAFE auto-run: agent call failed. Check $RUNLOG" >/dev/null || true
  fi
  exit 0
fi
rm -f "$JSON"

# Verify
if ! tools/verify_safe.sh 2>&1 | tee -a "$RUNLOG"; then
  echo "[auto-safe] VERIFY FAILED" | tee -a "$RUNLOG"
  if [ -n "${IMESSAGE_TO:-}" ]; then
    openclaw message send --channel imessage --target "$IMESSAGE_TO" --message "⚠️ ScanGrade SAFE auto-run failed verification. See $RUNLOG (and logs/verify_safe_*.log). Reply DETAILS if you want me to summarize the logs." >/dev/null || true
  fi
  exit 0
fi

echo "[auto-safe] verify passed" | tee -a "$RUNLOG"

# Optional: regenerate the nightly review (fresh report after SAFE)
if [ -x tools/nightly_codex_review.sh ]; then
  echo "[auto-safe] running nightly review script for fresh report" | tee -a "$RUNLOG"
  ( BUILD_MODE="SAFE" tools/nightly_codex_review.sh ) 2>&1 | tee -a "$RUNLOG" || true
fi

echo "[auto-safe] done" | tee -a "$RUNLOG"
