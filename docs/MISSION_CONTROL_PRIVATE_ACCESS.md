# Mission Control Private Access

Date: 2026-05-30

Mission Control is intended for Tony and Codex only. It should stay private, reachable from Tony's devices through Tailscale, and not be published to the public web.

## Current Local Service

Mission Control runs as a local Node server:

```bash
node mission-control/server.mjs
```

Default local URL:

```text
http://127.0.0.1:8787/
```

By default, the server binds to `127.0.0.1`, which is the safest posture for local work because it is not exposed to the LAN or public internet.

## Preferred Private Access

Use Tailscale Serve to proxy the local Mission Control server to Tony's tailnet.

Likely command, based on current Tailscale Serve documentation:

```bash
tailscale serve localhost:8787
```

Tailscale Serve is meant to route traffic from devices in the same tailnet to a local service. Tailscale's docs distinguish this from Funnel, which exposes a service publicly on the internet.

Sources checked on 2026-05-30:

- https://tailscale.com/kb/1242/tailscale-serve
- https://tailscale.com/docs/features/tailscale-serve

## Safety Rules

- Do not use Tailscale Funnel for Mission Control.
- Do not bind Mission Control to `0.0.0.0` unless Tony explicitly asks for a LAN-access test.
- Do not add a password system just because Tailscale is being used; Tony currently prefers Tailscale-only access.
- Do not place student-identifiable data in Mission Control until privacy/storage rules are decided.
- Do not expose `/repo/` publicly. It can serve project files and should remain private to the tailnet/local machine.

## Verification Checklist

Before telling Tony it is available from other devices:

1. Confirm Mission Control is running locally at `http://127.0.0.1:8787/`.
2. Enable Tailscale Serve for `localhost:8787`.
3. From another Tony-owned Tailscale device, open the Serve URL.
4. Confirm the dashboard loads and the Documents section works.
5. Confirm it is not available from a non-Tailscale browser/device.

## Current Limitation

The local `tailscale` CLI on this machine responded with `Failed to load preferences` during a read-only help check on 2026-05-30, so Codex did not run or configure Tailscale Serve. Tony may need to open/check the Tailscale app state before Codex can verify the Serve command locally.
