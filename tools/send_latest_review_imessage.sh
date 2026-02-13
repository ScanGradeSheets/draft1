#!/usr/bin/env bash
set -euo pipefail
umask 077

REPO="/Users/openclaw/.openclaw/workspace/scan-grade"
LOGDIR="$REPO/logs"
TOOLS="$REPO/tools"
CONF="$TOOLS/imessage_to.conf"

# Recipient from config (no hardcoding)
IMESSAGE_TO="${IMESSAGE_TO:-}"
if [ -z "${IMESSAGE_TO:-}" ] && [ -r "$CONF" ]; then
  IMESSAGE_TO="$(tr -d '[:space:]' < "$CONF")"
fi
[ -n "${IMESSAGE_TO:-}" ] || exit 0

# Find latest nightly review report
LATEST="$(ls -1t "$LOGDIR"/nightly_codex_review_*.txt 2>/dev/null | head -n 1 || true)"
[ -n "${LATEST:-}" ] || exit 0

# Basic redaction (kept simple + portable)
redact () {
  # Redact obvious secrets / tokens / keys in a conservative way
  perl -pe '
    s/(api[_-]?key|token|secret|password)\s*[:=]\s*([^\s"'\''`]+)/$1: [REDACTED]/ig;
    s/(sk-[A-Za-z0-9]{10,})/[REDACTED]/g;
    s/(AIza[0-9A-Za-z\-_]{20,})/[REDACTED]/g;
    s/(-----BEGIN [A-Z ]+-----.*?-----END [A-Z ]+-----)/[REDACTED_KEY_BLOCK]/sg;
  '
}

# Keep message short enough for iMessage sanity
MSG="$(tail -n 220 "$LATEST" | redact | sed -e 's/[[:cntrl:]]//g' | head -c 3500)"

openclaw message send --channel imessage --target "$IMESSAGE_TO" --message "$MSG" >/dev/null
