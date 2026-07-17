# ScanGrade P05 safety private beta 7 deployment

Date: 2026-07-17

## Release identity

- Branch: `autobuild/safe-20260223`
- Build label: `2026.07.17-p05-safety-private-beta-7`
- Runtime release: `p05-safety-private-beta-7`
- Private URL: `https://hobbes-mac-mini.tail9a3379.ts.net/`

The source commit and final live verification are recorded after push below.

## Shipped scope

- Blocks the demonstrated P05 `17 -> 12` automatic promotion when retained-material ambiguity or the narrow high-risk/near-certain compact conflict is present.
- Keeps independent transcription disputes yellow rather than styling them as confident red math errors.
- Uses one review decision consistently for cards, marked-sheet annotations, and overlay debug.
- Formats review cards using physical worksheet slot metadata, including one-box number bonds.
- Generates deterministic annotation seeds so identical evidence draws identical marks.

The rejected all-red strong-model screen and unproved stricter capture gate are not included. Strong-model work remains yellow-only. Research-only frame decode, geometry reuse, frame fusion, and browser TrOCR-small paths remain explicit query-flag features and are off by default.

## Evidence boundary

- Original untouched P05: 48/70 automatic, 48/48 matching the handwriting audit, 22 yellow.
- Full-debug rescan before repair: 55/70 automatic, 54 correct and one confident error.
- Retrospective repaired estimate: 54/70 automatic, 54/54 matching the audit, 16 yellow.

This release fixes a demonstrated safety failure and UI inconsistency. It does not restore the historical 90.9% development coverage and must not be marketed as doing so.

## Verification

- `node --test tests/*.test.mjs`: 130/130 passed.
- `npm run build`: passed.
- `npm run build:github`: passed.
- `git diff --check`: passed.
- Identical-input grading decisions matched on two ten-page replays; deterministic annotation A/B matched after the seed repair.

## Rollback

- Whole private candidate: append `?consensusCandidate=0`.
- Git rollback authority: Candidate 6 source commit `b7a5df4` and its verified Rugged backup.

## Final deployment record

Pending commit, push, and live verification.
