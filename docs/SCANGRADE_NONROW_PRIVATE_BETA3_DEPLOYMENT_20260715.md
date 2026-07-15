# ScanGrade non-row private candidate 3 deployment

Date: 2026-07-15 (America/Toronto)

## Release decision

Tony explicitly authorized replacing private candidate 2 with candidate 3, committing, pushing, and publishing the private release.

Candidate 3 is now the default only on the private tailnet deployment:

`https://hobbes-mac-mini.tail9a3379.ts.net/`

The public GitHub Pages scanner remains on build `2026.07.14-consensus-private-beta-1`. Its `gh-pages-v2` branch was not changed. This preserves the public behavior and prevents the private optional-model lane from becoming a public promise.

## Private runtime

Build label: `2026.07.15-nonrow-dual-crop-private-beta-3`

The existing private candidate features remain enabled on `.ts.net`. Candidate 3 additionally enables:

- `v3NumberBondShiftDown`: a second number-bond answer crop shifted down by 4% of slot height;
- `v3NonrowTrimEvidence`: a second 4%-trimmed crop for ten frames, dot collections, number patterns, and place value;
- automatic use of alternate pixels only when both crops agree on all three retained frames and all existing safety vetoes pass.

Public and non-tailnet hosts keep both features off unless explicitly enabled for development. `?consensusCandidate=0` remains the immediate private rollback and disables the whole candidate, including both new crop lanes.

## Evidence and verification

- Frozen control: 234/275 automatic (85.1%), zero observed errors.
- Candidate 3: 237/275 automatic (86.2%), 237/237 correct.
- Rows: 144/160 (90.0%), unchanged.
- Non-row: 93/115 (80.9%).
- Number bonds: 13/22 (59.1%).
- Independent second non-row replay: 20/20 pages identical on inputs, probabilities, alternate evidence, decisions, and application.
- Complete JavaScript suite: 105/105 passed.
- Standard Vite build: passed.
- Pruned public build: passed but intentionally not published.
- Candidate manifest: 63/63 files verified.
- Private root loaded in the in-app browser and displayed the candidate 3 build label.
- Private strong and compact health endpoints both returned OK; the strong service remained offline/local-model-only and rejected answer-key input.
- Live private source exposed both new runtime flags through `consensusFeatureEnabled`.
- Public Pages still served asset `assets/index-9msytI_D.js` with build label `2026.07.14-consensus-private-beta-1`.

## Source control

- Branch: `autobuild/safe-20260223`
- Release commit: `6883acf` (`Promote non-row dual-crop private candidate`)
- Remote source branch verified at the exact release commit.
- Private evidence, student images, model experiments, Mission Control state, and unrelated dirty-worktree files were not committed.

## Rollback

Immediate runtime rollback:

`https://hobbes-mac-mini.tail9a3379.ts.net/?consensusCandidate=0`

Candidate 2 remains documented and reproducible as the 234/275 evidence-pipeline control. Git commit `2257609` is the source branch state immediately before candidate 3.

No public accuracy claim is authorized by this deployment.
