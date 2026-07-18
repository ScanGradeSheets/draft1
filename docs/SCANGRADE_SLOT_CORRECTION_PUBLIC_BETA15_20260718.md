# ScanGrade Slot-Correction Public Beta 15 — 2026-07-18

## Trigger

Live Dot Collections testing showed that a teacher correcting one uncertain digit in a two-slot answer could cause the complete answer to be drawn inside that one slot. A confirmed optional blank could also receive a white replacement strip.

## Changes

- Slot corrections render only the corrected slot's digit.
- A complete multi-digit answer is rendered in one box only when the worksheet truly has one physical answer box.
- Confirmed blanks remain visually blank.
- Flexible one-digit/two-box worksheets may suppress an unused slot only from layout placement metadata plus conservative handwriting/artifact evidence. Mathematical correctness is not an input.
- One-digit manual entry is focused immediately and applies after a single numeric keystroke. Suggestions remain one tap; multi-digit entry retains Save.

## Safety boundary

No recognition threshold, confidence policy, capture gate, crop geometry, homography, grading rule, or answer-key usage changed. The public site remains a static browser-local application with no public Mac Mini endpoint or Pages Function.

## Verification

- 177/177 repository tests passed.
- Production build passed.
- Production, immutable deployment, static API fallback, static health fallback, and local release HTML matched exactly.
- HTML SHA-256: `a6322becb43ac52176c864b76f37e9c70de6ce7ce795375bae83d09a2614b822`.
- JavaScript SHA-256: `9920da26e4d6320a2d62d2238bf24144af27507bcd9122e974341de78f450dc2`.

## Release and rollback

- Source: `0d50ebd0c50789aad60630ee5e7246fbe6b60291`.
- Production: `https://scangrade.io/`.
- Immutable Beta 15: `https://ae4f7e48.scangrade.pages.dev/`.
- Beta 14.1 rollback: `https://bf5e2107.scangrade.pages.dev/`.

## Animation architecture

The current public site does not run the Mac Mini fallback or an enabled strong cloud/local second reader. Its pen animation presents decisions already made by browser OCR; it does not provide hidden inference time. Keep confident marking in worksheet order. If a public second-stage reader is later enabled, unresolved yellows should remain pending until that pass completes while already-settled marks can animate.
