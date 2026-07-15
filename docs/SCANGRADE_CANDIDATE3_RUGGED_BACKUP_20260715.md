# ScanGrade Candidate 3 rugged-drive disaster-recovery backup

Date: 2026-07-15 (America/Toronto)

## Backup location

`/Volumes/Tony's Rugged HD/Codex Rescue Backups/scan-grade-project-snapshots/scan-grade-candidate3-20260715/project/`

This is a new dated snapshot. It does not overwrite the older May recovery snapshot or the July 14 archival offloads.

## Included

- Complete ScanGrade working tree, including committed and uncommitted files.
- Complete `.git` directory and local Git history at the time of the snapshot.
- Candidate 3 source, layouts, tests, reports, handoffs, and deployment documentation.
- `private-evidence`, including authentic scans, truth labels, current replay artifacts, frozen score reports, and Candidate 3's freeze manifest.
- Active compact and strong-model artifacts required by the frozen candidate.
- Current datasets, benchmarks, worksheet generators, public assets, and reproducibility scripts.
- Current built application output.

The July 14 archival offloads remain separately stored on the same rugged drive at:

`/Volumes/Tony's Rugged HD/Codex/ScanGrade Offloads/2026-07-14-pre-large-grayscale/`

## Deliberate exclusions

- `node_modules/`
- `.venv/`
- `.venv-mnist/`
- `.DS_Store`
- `.git/fsmonitor--daemon.ipc`

The first three are reinstallable dependency caches. `.DS_Store` is Finder metadata. `fsmonitor--daemon.ipc` is a temporary Unix socket that cannot be stored on the external filesystem and contains no project data.

## Size and inventory

- 82,812 regular files
- 5 symbolic links
- 33,973,839,429 logical bytes reported by rsync
- approximately 33,501,288 KiB allocated in the backup tree
- approximately 346 GiB remained free on the rugged drive after verification

## Verification completed

1. Two rsync synchronization passes completed; the second completed with exit status 0 after excluding only the nonportable live Git socket.
2. A full `rsync -anrc --delete` checksum comparison reread all included source and destination content, returned exit status 0, and printed no differences.
3. Candidate 3's frozen manifest was verified from inside the backup: 63/63 required files matched their SHA-256 identities.
4. The backed-up repository resolved to Git commit `5827e0a451f2ebda89ba0d40b0ad78c9dee16e79` before this backup record was added.
5. `git fsck --full` run inside the backup returned exit status 0. It listed existing unreachable/dangling objects but no missing or corrupt objects.

## Recovery procedure after loss of the Mac

1. Connect Tony's Rugged HD to a replacement Mac.
2. Copy the snapshot to a writable development location:

   ```sh
   rsync -a "/Volumes/Tony's Rugged HD/Codex Rescue Backups/scan-grade-project-snapshots/scan-grade-candidate3-20260715/project/" "$HOME/Codex Projects/scan-grade-cursor/"
   ```

3. Reinstall Node dependencies with `npm ci`.
4. Recreate the Python environment from the repository requirements before starting the optional model services.
5. Read `AGENTS.md`, then `SCANGRADE_ACTIVE_HANDOFF.md`, `SCANGRADE_RECOVERED_PROJECT_MEMORY.md`, the two vision documents, and `docs/SG_THREAD_HANDOFF_PROTOCOL.md`.
6. Verify Candidate 3:

   ```sh
   node scripts/verify_consensus_candidate.mjs private-evidence/protocols/nonrow-dual-crop-candidate-freeze-20260715.json
   node --test tests/*.test.mjs
   npm run build
   ```

7. Reinstall and authenticate Tailscale, restart the compact and strong model services, and restore the documented Serve routes. The private hostname may change if the replacement Mac has a different Tailscale device identity.

## Redundancy status

- Candidate 3 source and recovery documentation are also pushed to GitHub.
- The rugged drive contains the irreplaceable private evidence and model artifacts that are intentionally not committed publicly.
- This backup protects against loss of the Mac. It does not protect against simultaneous loss or physical damage of both the Mac and the rugged drive; a future encrypted off-site copy would provide that additional layer.
