#!/usr/bin/env bash
set -euo pipefail
umask 077

REPO="/Users/openclaw/.openclaw/workspace/scan-grade"
cd "$REPO"

LOGDIR="$REPO/logs"
STATEDIR="$REPO/.state"
mkdir -p "$LOGDIR" "$STATEDIR"

TS="$(date +"%Y-%m-%d_%H-%M-%S")"
LOG="$LOGDIR/build_apply_safe_$TS.log"
RESULT="$STATEDIR/last_safe_result.txt"

# Allowlist: SAFE may only commit changes in these paths.
# Tighten/expand later as you like.
ALLOW_RE='^(tools/|docs/|README\.md$|\.gitignore$|package(-lock)?\.json$|pnpm-lock\.yaml$|yarn\.lock$|tests/|__tests__/|cypress/|vitest/|playwright/)'

echo "[SAFE] $TS starting" | tee "$LOG"

# Always fetch current branch name (don’t assume main)
BASE_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)"

# Create a daily safe branch off current HEAD
DAY="$(date +"%Y%m%d")"
BRANCH="autobuild/safe-$DAY"

# Clean up any half-finished rebase/merge state
git rebase --abort >/dev/null 2>&1 || true
git merge --abort  >/dev/null 2>&1 || true

# Ensure we’re on the safe branch
if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  git checkout "$BRANCH" >>"$LOG" 2>&1
else
  git checkout -b "$BRANCH" >>"$LOG" 2>&1
fi

# Helper: run npm script only if it exists
run_if_script () {
  local script="$1"
  if node -e "const p=require('./package.json'); process.exit((p.scripts && p.scripts['$script'])?0:1)" >/dev/null 2>&1; then
    echo "[SAFE] npm run $script" | tee -a "$LOG"
    npm run "$script" >>"$LOG" 2>&1
  else
    echo "[SAFE] (skip) no npm script: $script" | tee -a "$LOG"
  fi
}

# Install deps if needed (light touch)
if [ ! -d node_modules ]; then
  echo "[SAFE] node_modules missing; running npm install" | tee -a "$LOG"
  npm install >>"$LOG" 2>&1
fi

# Try a conservative sequence; skips what doesn’t exist
run_if_script lint
run_if_script typecheck
run_if_script test
run_if_script build

# If nothing changed, record and exit
if [ -z "$(git status --porcelain)" ]; then
  echo "SAFE_OK_NO_CHANGES $TS" | tee "$RESULT"
  echo "[SAFE] done: no changes" | tee -a "$LOG"
  exit 0
fi

# Enforce allowlist on changed files (fail-closed)
BAD=0
while IFS= read -r line; do
  f="${line#?? }"
  f="${f#M  }"; f="${f#A  }"; f="${f#D  }"; f="${f#R  }"; f="${f#C  }"
  f="${f#?? }"
  if [[ ! "$f" =~ $ALLOW_RE ]]; then
    echo "[SAFE] BLOCKED path: $f" | tee -a "$LOG"
    BAD=1
  fi
done < <(git status --porcelain)

if [ "$BAD" -eq 1 ]; then
  echo "SAFE_BLOCKED_FORBIDDEN_PATHS $TS (see $LOG)" | tee "$RESULT"
  exit 2
fi

# Commit allowed changes
git add -A >>"$LOG" 2>&1
git commit -m "SAFE autobuild ($TS)" >>"$LOG" 2>&1 || true

LAST_COMMIT="$(git log -1 --pretty=format:'%h — %s' 2>/dev/null || echo none)"
echo "SAFE_OK_COMMITTED $TS $BRANCH $LAST_COMMIT" | tee "$RESULT"
echo "[SAFE] committed: $LAST_COMMIT" | tee -a "$LOG"
