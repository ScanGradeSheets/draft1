#!/usr/bin/env python3
import os, sys, json, time, urllib.request

# Usage:
#   run_brain_openrouter.py <prompt_path> <out_path> <model>
#
# Env:
#   OPENROUTER_API_KEY (required)

prompt_path = sys.argv[1] if len(sys.argv) > 1 else None
out_path    = sys.argv[2] if len(sys.argv) > 2 else None
model       = sys.argv[3] if len(sys.argv) > 3 else "google/gemini-2.0-flash"

if not prompt_path or not out_path:
    print("usage: run_brain_openrouter.py <prompt_path> <out_path> <model>", file=sys.stderr)
    sys.exit(2)

api_key = os.getenv("OPENROUTER_API_KEY", "").strip()
if not api_key:
    print("ERROR: OPENROUTER_API_KEY missing", file=sys.stderr)
    sys.exit(3)

prompt = open(prompt_path, "r", encoding="utf-8").read()

url = "https://openrouter.ai/api/v1/chat/completions"
payload = {
    "model": model,
    "messages": [
        {"role": "system", "content": "You are Hobbes. Follow the prompt exactly. Output MUST be key=value lines only."},
        {"role": "user", "content": prompt},
    ],
    "temperature": 0.2,
    "max_tokens": 700,
}

req = urllib.request.Request(
    url,
    data=json.dumps(payload).encode("utf-8"),
    headers={
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        # optional but helps on OpenRouter dashboards
        "HTTP-Referer": "http://localhost",
        "X-Title": "scan-grade-kanban-brain",
    },
    method="POST",
)

t0 = time.time()
try:
    with urllib.request.urlopen(req, timeout=35) as resp:
        raw = resp.read().decode("utf-8", errors="replace")
except Exception as e:
    open(out_path, "w", encoding="utf-8").write(f"STAMP_UTC={time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}\nBRAIN_ERROR={e}\n")
    raise

j = json.loads(raw)
content = (j.get("choices") or [{}])[0].get("message", {}).get("content", "")
stamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
lat = int((time.time() - t0) * 1000)

# Write verbatim content, but ensure we always have a timestamp header
out = f"STAMP_UTC={stamp}\nBRAIN_MODEL={model}\nBRAIN_LATENCY_MS={lat}\n" + content.strip() + "\n"
open(out_path, "w", encoding="utf-8").write(out)

print("OK")
