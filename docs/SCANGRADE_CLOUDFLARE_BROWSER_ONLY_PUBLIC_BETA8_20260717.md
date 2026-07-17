# ScanGrade Cloudflare browser-only public Beta 8

Date: 2026-07-17

## Outcome

The physical-annotation/live-marking Beta 8 frontend is publicly available at:

- `https://scangrade.io/`
- Cloudflare Pages fallback: `https://scangrade.pages.dev/`

The deployed frontend was built from the clean Git source commit `478d92d` on branch `autobuild/safe-20260223`. The visible build label is `2026.07.17-physical-annotations-live-marking-beta-8`. The recognition runtime label remains `p05-safety-private-beta-7`; this release did not change the frozen recognition policy.

## Public/private boundary

This deployment is intentionally static and browser-only.

- No Cloudflare Pages Functions directory was deployed.
- No D1 database or submission API was activated.
- No public proxy to the Mac Mini was created.
- The private adapted-TrOCR and compact services remain available only through the Tailnet origin.
- The frontend's hostname policy disables those private runtime endpoints away from the `.ts.net` origin.

Direct checks of `https://scangrade.io/review-model/health` and `https://scangrade.io/api/submissions` returned byte-identical copies of the static SPA homepage, not backend responses. All three files had SHA-256 `fcbd024803e03d433304aec6d711acad7c34eb20b9577c979517a158b553e59b` at verification time.

The public response also supplied:

- `Permissions-Policy: camera=(self)`
- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`

## Cloudflare configuration

- Account: `scangradesheets@gmail.com`
- Pages project: `scangrade`
- Production branch: `autobuild/safe-20260223`
- Current production deployment ID: `f3d5ea39-e2ed-47c7-9f84-b3870837e581`
- Current immutable deployment URL: `https://f3d5ea39.scangrade.pages.dev/`
- Custom apex domain: `scangrade.io`
- DNS: apex CNAME managed by Cloudflare to `scangrade.pages.dev`

The deployment uploaded the clean static `dist` directory only. It did not upload the repository's dormant backend scaffold.

## Agent tooling setup

The official Cloudflare setup prompt was fetched from `https://developers.cloudflare.com/agent-setup/prompt.md`.

- Eleven official Cloudflare skill folders were installed under `~/.agents/skills`.
- Cloudflare MCP server entries were added to `~/.codex/config.toml`.
- Wrangler OAuth completed successfully and can administer the Pages account.
- MCP OAuth was not completed because macOS blocked and removed the bundled CLI executable. That security control was not bypassed. Restart Codex before expecting newly installed skills or MCP entries to appear.

## Verification

- `https://scangrade.io/`: HTTP 200.
- Public HTML references the root-domain Beta 8 asset `assets/index-CqgTxVDW.js`.
- That JavaScript was served as `application/javascript` and matched the local production artifact byte-for-byte at SHA-256 `0ede0abb6eecddcb14dcb0056a08ee55b2e1490fc835bb0d77b20b58d9094813`.
- Cloudflare Pages production deployment is listed under deployment ID `f3d5ea39-e2ed-47c7-9f84-b3870837e581` with source commit `478d92d`.
- A live browser smoke test mounted the Beta 8 home screen and produced no console errors.
- Security headers are present.
- Private-model and submission paths do not expose services.

## Important limits

- Public `scangrade.io` uses only browser-local recognition. It does not currently receive the Mac Mini strong-model rescues.
- Existing printed worksheet QR codes still point to the previously encoded public URL. They were not silently rewritten. Future worksheet generation can move to `https://scangrade.io/` after the QR target change is approved and tested.
- `www.scangrade.io` was not configured.
- Public shared storage, login, upload recovery, abuse controls, and a safe authenticated strong-model gateway remain separate future work.

## Initial deployment incident and repair

The first Cloudflare upload (`a5b4bc89-aeb0-4fed-9e72-f6125283a6c7`) accidentally used the GitHub Pages build. Its HTML addressed scripts, styles, fonts, logo and OpenCV under `/draft1/`. That prefix is required only by the old GitHub Pages repository path. On the apex domain, Cloudflare returned the SPA HTML fallback for those missing module paths; Safari showed the loading screen and then a blank page.

The site was rebuilt from the same clean Beta 8 source commit with Vite base `/`, pruned to the same public runtime assets, and redeployed as `f3d5ea39-e2ed-47c7-9f84-b3870837e581`. The corrected public HTML contains no `/draft1/` prefix. During the few seconds of propagation, the custom domain briefly paired the new HTML with the old asset map; subsequent checks served the correct JavaScript and the browser mounted normally.

`draft1` was a GitHub Pages URL prefix, not the current product version. The present Beta 8 source branch is `autobuild/safe-20260223`; the public custom-domain path intentionally has no `draft1` or `draft2` segment.

## Rollback

Cloudflare retains the immutable Pages deployment. A prior static build can be redeployed through Wrangler or the dashboard. Source recovery is available from GitHub commit `478d92d` and the verified Rugged-drive Beta 8 Git bundle recorded in the active handoff.
