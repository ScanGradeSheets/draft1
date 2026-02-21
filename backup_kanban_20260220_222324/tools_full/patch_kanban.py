#!/usr/bin/env python3
import re
from pathlib import Path

# Path to your kanban.html
f = Path.home() / ".openclaw/workspace/scan-grade/dist/kanban.html"

# Read existing HTML
html = f.read_text(encoding="utf-8")

# 1️⃣ Insert editable Current Mission panel right below the <h1> title
html = re.sub(
    r'(<h1>.*?</h1>)',
    r'\1\n  <div class="mission-panel" contenteditable="true" id="current-mission">\n    <strong>Current Mission:</strong> Ship ScanGrade MVP: one clean worksheet + scoring pipeline that WORKS end-to-end.\n  </div>',
    html,
    count=1,
)

# 2️⃣ Ensure Blocked column exists
if "Blocked" not in html:
    html = re.sub(
        r'(</div>\s*<!-- end columns container -->)',
        r'  <div class="column blocked-column">\n    <h2>Blocked</h2>\n    <ul></ul>\n  </div>\1',
        html,
        count=1
    )

# 3️⃣ Add CSS for mission panel if missing
if ".mission-panel" not in html:
    html = re.sub(
        r'(</style>)',
        r'.mission-panel { background: #fffbe6; border: 1px solid #f1c40f; padding: 12px 16px; border-radius: 6px; margin-bottom: 20px; font-size: 14px; }\n\1',
        html,
        count=1
    )

# Save patched HTML
f.write_text(html, encoding="utf-8")
print("✅ Kanban patched: Current Mission editable + Blocked column added")
