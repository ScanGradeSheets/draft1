#!/usr/bin/env python3
import re, sys

text = " ".join(sys.argv[1:]).strip()
if not text:
    print("")
    raise SystemExit(0)

t = text.lower()

# If it doesn't look like an add request: return empty
if not any(k in t for k in ["add a card", "add card", "create a card", "make a card", "new card", "put a card"]):
    print("")
    raise SystemExit(0)

# Common patterns
# e.g. "add a card to: digits normalization"
m = re.search(r'(?:add a card|add card|create a card|make a card|new card|put a card)\s*(?:to|for|about|that says|:)?\s*(.*)$', text, flags=re.I)
title = (m.group(1).strip() if m else "")

# Strip trailing politeness
title = re.sub(r'\s*(please|thanks|thank you)\s*$', '', title, flags=re.I).strip()

# If they said "add a card" but gave nothing, force a placeholder
if not title:
    title = "Clarify task (added via text)"

print(title)
