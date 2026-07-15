# ScanGrade V3 cloud-hosting decision — 2026-07-13

## Recommendation

Use Google Cloud Run for the compact V3 reader during private beta, with request-based billing, scale-to-zero, 1 vCPU, 1 GiB RAM, concurrency 1, maximum instances 2, and application-level teacher authentication. Keep both local OCR and service-outage fallback permanently.

This is not guaranteed to cost exactly zero. Cloud Run currently includes monthly free allowances of 240,000 vCPU-seconds and 450,000 GiB-seconds for instance-based billing (with a separate request-based free tier described on the same page), but billing must be enabled and regional/network/build costs can still apply. Treat “likely inside the free allowance at tiny beta volume” as a hypothesis and set a budget alert—not as a product promise. [Official Cloud Run pricing](https://cloud.google.com/run/pricing)

Cloud Run injects `PORT`, terminates TLS, supports scale-to-zero, and permits a 1 vCPU/1 GiB configuration. The staged V3 container listens on `0.0.0.0:$PORT` and emits no persistent student files. [Container contract](https://docs.cloud.google.com/run/docs/container-contract), [CPU and memory limits](https://docs.cloud.google.com/run/docs/configuring/services/cpu), [scale-to-zero behavior](https://docs.cloud.google.com/run/docs/overview/what-is-cloud-run)

Use the native Python/ONNX Runtime service in the container. It reproduced 114/114 frozen compact-model holdout reads and processed warm batches of 1, 10, and 30 answers in 43.8 ms, 41.8 ms, and 92.9 ms on the development Mac. The Node/WASM service differed on five borderline reads and was roughly an order of magnitude slower in large batches, so it remains a local convenience only.

## Why not the other free options

- Hugging Face CPU Basic offers 2 vCPU and 16 GB RAM for free, enough for either reader, but free Spaces sleep and the useful public/protected modes expose a public application; protected source requires a paid plan. A private Space is inaccessible to ordinary teachers. It is appropriate for a non-student demo, not the production child-data boundary. [Official Spaces hardware and visibility](https://huggingface.co/docs/hub/main/spaces-overview)
- Render Free has only 512 MB and 0.1 CPU, sleeps after 15 idle minutes, and may take about a minute to wake. The measured Node compact service used about 403 MB before browser/network overhead, so this is too close to the limit and the cold start is incompatible with scanning. [Official free-service limits](https://render.com/docs/free), [instance types](https://render.com/docs/compute-plans)
- Cloudflare Workers AI has a free daily allocation, but it serves Cloudflare's supported models rather than this private ONNX architecture. Replacing the model would create a new recognition experiment, not host V3. [Official Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)

## Authentication boundary

Do not make the inference URL anonymously public and do not embed a permanent bearer token in GitHub Pages, JavaScript, or a query string. Cloud Run's guidance for ordinary end users is to authenticate in the public app and send a verified Identity Platform/Firebase ID token to the service. [Official end-user authentication guidance](https://docs.cloud.google.com/run/docs/authenticating/end-users)

Before private beta, choose one:

1. Add teacher sign-in and verify short-lived ID tokens in a Cloud Run gateway. This is the correct production route.
2. For a founder-only packet test, keep the service origin-restricted and use a temporary bearer token entered locally for the session, then rotate it immediately. This is not a public beta architecture.

## Container procedure

The repository root is protected by `.dockerignore`, which excludes private evidence. The safer path creates a four-file temporary build context:

```bash
npm run stage:v3:container
```

Expected contents are only `Dockerfile`, `requirements-v3-compact.txt`, `scripts/serve_v3_compact.py`, and `model.onnx`. The staging verifier fails if a filename suggests student/debug/evidence/truth material.

Build and deploy only from that temporary directory. Configure:

- `SCANGRADE_V3_ALLOWED_ORIGINS` to the exact app origin;
- an authenticated gateway or short-lived identity tokens;
- request/body logging disabled or redacted;
- no image persistence;
- maximum request size at the platform edge;
- concurrency 1 and maximum instances 2 initially;
- budget alert and usage cap/operational alarm;
- Toronto or the selected jurisdiction after confirming the privacy agreement and school requirements.

## Deployment gate

Do not deploy student traffic merely because the container starts. First verify Linux-container prediction parity against the 582-artifact manifest, 1/10/30-answer latency, cold-start time, peak RAM, origin/auth rejection, answer-key rejection, no request-body logs, and simulated service outage. Then run P08 privately before P03/P09.
