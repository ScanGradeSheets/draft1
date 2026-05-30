# ScanGrade Brand Asset Inventory

Date: 2026-05-30

This inventory documents the current ScanGrade logo/brand assets without committing the whole untracked brainstorm folder.

## Current Tracked App Logos

- `public/scangrade-logo.png`
  - 1024 x 1024 PNG
  - RGB
  - About 236 KB

- `public/scangrade-logo-transparent.png`
  - 1024 x 1024 PNG
  - RGBA with transparency
  - About 192 KB
  - Used by Mission Control as the visible ScanGrade logo.

These are the current canonical app-facing logo files unless Tony chooses a new final brand asset.

## Untracked Logo Reference Folder

- `logos/`
  - About 4.0 MB total
  - Contains March 2026 brainstorm screenshots and candidate images.
  - Contains `.DS_Store`, which should not be committed.

Notable files:

- `logos/SG logo contender.png`
  - 1024 x 1024 PNG
  - About 234 KB

- `logos/3 variants.png`
  - 1536 x 1024 PNG
  - About 163 KB

- `logos/logos for refinement.png`
  - 1536 x 1024 PNG
  - About 158 KB

## Recommendation

- Keep `public/scangrade-logo.png` and `public/scangrade-logo-transparent.png` tracked.
- Preserve `logos/` locally as design/reference history.
- Do not commit all of `logos/` as a bundle.
- Do not commit `logos/.DS_Store`.
- If Tony wants brand source files preserved in Git, choose a small canonical subset first, ideally final logo source/export files rather than every brainstorm screenshot.

## Mission Control Note

Mission Control currently uses `public/scangrade-logo-transparent.png`. This matches Tony's request that the dashboard include the ScanGrade logo and use the ScanGrade green as its main color direction.
