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
- Production deployment ID: `a5b4bc89-aeb0-4fed-9e72-f6125283a6c7`
- Immutable deployment URL: `https://a5b4bc89.scangrade.pages.dev/`
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
- Public HTML references Beta 8 asset `assets/index-Bokf8J_g.js`.
- Cloudflare Pages production deployment is listed under deployment ID `a5b4bc89-aeb0-4fed-9e72-f6125283a6c7`.
- Security headers are present.
- Private-model and submission paths do not expose services.

## Important limits

- Public `scangrade.io` uses only browser-local recognition. It does not currently receive the Mac Mini strong-model rescues.
- Existing printed worksheet QR codes still point to the previously encoded public URL. They were not silently rewritten. Future worksheet generation can move to `https://scangrade.io/` after the QR target change is approved and tested.
- `www.scangrade.io` was not configured.
- Public shared storage, login, upload recovery, abuse controls, and a safe authenticated strong-model gateway remain separate future work.

## Rollback

Cloudflare retains the immutable Pages deployment. A prior static build can be redeployed through Wrangler or the dashboard. Source recovery is available from GitHub commit `478d92d` and the verified Rugged-drive Beta 8 Git bundle recorded in the active handoff.
