# ScanGrade stitched-review private beta 6 deployment

Date: 2026-07-16

## Release identity

- Source commit: `b7a5df488836ec3b3e1010bec3979bf714f1d76e`
- Branch: `autobuild/safe-20260223`
- Build label: `2026.07.16-stitched-review-private-beta-6`
- Private URL: `https://hobbes-mac-mini.tail9a3379.ts.net/`

The source commit was pushed to GitHub and independently confirmed at the remote branch tip.

## Live verification

- Private URL returned HTTP 200.
- Live `App.vue` served the Candidate 6 build label.
- Live production runtime served `stitched-review-private-beta-6`.
- Live camera source contained the yellow-only `selected-frame-stitched-review-only` path.
- Strong review health reported the MPS TrOCR adapter loaded, offline, and answer-key input rejected.
- Compact health reported the frozen `v3-sequence-live/model.onnx` service loaded.

The private app is a source-served development deployment. The worktree also contains older research code, but those paths require explicit research query flags and are forbidden by the Candidate 6 protocol. The committed Candidate 6 source is the disaster-recovery authority.

## Deployment boundary

- Private Tailnet: Candidate 6 enabled by default.
- Public GitHub Pages: not redeployed and remains local-only by default.
- Stitched review rollback: `?v3StitchedOnDemandReview=0`.
- Whole private-candidate rollback: `?consensusCandidate=0`.

## Prospective boundary

P05 remains sealed. Its Candidate 6 freeze is:

`private-evidence/protocols/p05-prospective-candidate6-freeze-20260716.json`

All 16 file identities verified. P05 must be scanned once using the private URL with no query string and no research flags. The old Candidate 5 freeze remains historical and must not be mistaken for the currently served build.

## Recovery backup

Candidate 6 is backed up at:

`/Volumes/Tony's Rugged HD/Codex/ScanGrade Offloads/2026-07-16-stitched-review-private-beta6/`

The verified 577 MB backup contains:

- A complete Git bundle ending at Candidate 6 source commit `b7a5df4`.
- The exact rejected stitched-primary, control, and accepted on-demand replay directories.
- Compact score and parity reports.
- The Candidate 6 P05 freeze and locked-packet protocol.
- The private strong adapter, compact models, and P05 shadow model identities.
- The key-blind P05 recovery/scoring scripts.

After byte comparison and bundle verification, the three large replay directories were removed locally, recovering about 540 MB. Their compact reports remain in `private-evidence/reports/`.
