# ScanGrade Prototype Roadmap

## Goal

Get a real classroom-grade prototype working for one disciplined worksheet type first, then deploy it to `scangrade.io` so it can be tested on shared iPads.

Initial target:
- Grade 2 addition worksheet
- Student chooses name
- Student scans completed sheet on a shared iPad
- Result is saved for teacher review

---

## Product Principle

Do not generalize too early.

The first prototype should prove one complete classroom loop with one real worksheet template before expanding to many sheet types.

That means:
- one template
- one marker system
- one QR format
- one saved-result flow
- one teacher review flow

---

## Recommended Architecture

### Worksheet identification

Use the QR as the handshake, not the full layout container.

Preferred QR payload:
- `template_id`
- `template_version`
- `sheet_instance_id`
- `answer_key`
- optional small integrity/version fields

The app should use `template_id` + `template_version` to load a known template definition from the app or backend registry.

Template definition should contain:
- page geometry
- marker positions
- crop boxes
- question map
- answer type
- scoring rules

This keeps layout logic centralized and makes debugging much easier than embedding full box coordinates in every QR.

---

## Prototype Scope

### Phase 1: One real worksheet

Create one production-quality worksheet template:
- `addition_2digit_v1`
- black square corner markers
- stable QR placement
- disciplined answer box layout
- enough whitespace for reliable crop separation

Success criteria:
- students can fill it out by hand
- scanner can read it reliably under classroom lighting
- teacher can review saved scans later

### Phase 2: One template registry

The app should have a simple registry of supported templates.

For the first pass, this can live in the repo:
- `public/layouts/addition_2digit_v1.json`

Later, it can move to a hosted registry/API if needed.

### Phase 3: Shared-device student flow

Student flow should be:
1. choose name
2. line up sheet
3. auto-capture
4. OCR
5. auto-save
6. done

Teacher flow should be:
1. open review mode
2. see saved scans grouped by student
3. mark reviewed / inspect problem cases

---

## What Must Be True Before `scangrade.io` Pilot

### 1. HTTPS hosting

Because browser camera access requires a secure context, the production app must run over HTTPS.

### 2. Real persistence

LocalStorage is good for workflow validation on one device, but not for a real classroom deployment across multiple iPads.

For `scangrade.io`, saved scans should move to a shared backend so:
- all iPads can submit to the same class/session
- teacher review is not tied to one device
- data survives refreshes/device swaps

Minimum backend requirements:
- class roster storage
- submission storage
- teacher review status updates

### 3. One reliable template

Do not deploy a “template platform” first.
Deploy one worksheet type that is known to work well.

### 4. Real classroom retry behavior

Students need:
- obvious success state
- obvious retry path
- no technical errors

Teachers need:
- confidence that failed reads are surfaced cleanly
- easy way to identify items needing review

---

## Recommended Deployment Shape

### Frontend

The current app can be deployed as a static HTTPS site.

That means `scangrade.io` can serve:
- the Vue app
- static template definitions
- static worksheet assets

### Backend

Add a minimal API for:
- roster CRUD
- submission create/list/update/delete
- optional class/session scoping

This can be implemented as:
- serverless functions attached to the frontend host, or
- a small separate API service

For the prototype, avoid heavy admin tooling.
Just support the core student capture and teacher review loop.

---

## Suggested Data Model

### Class roster
- class id
- student id
- display name

### Submission
- submission id
- class id
- student id
- template id
- template version
- sheet instance id
- saved at
- digits
- confidences
- correctness when available
- status: `review` | `ready` | `done`

---

## Best Next Implementation Order

1. Finalize one printable worksheet template: `addition_2digit_v1`
2. Generate a real QR-backed worksheet asset for that template
3. Test the OCR loop on real filled sheets locally
4. Replace localStorage review data with a shared backend
5. Deploy the app over HTTPS on `scangrade.io`
6. Run a small classroom pilot with a few students first
7. Expand only after one template works reliably

---

## Advice for the First Classroom Pilot

Keep the first pilot intentionally narrow:
- one class
- one worksheet type
- one teacher
- a few shared iPads
- one review workflow

What to measure:
- how often students can scan without help
- how often scans need retry
- how often OCR needs teacher correction
- whether teacher review feels faster than current practice

---

## Explicit Non-Goals For The First Prototype

Do not block on:
- name-line OCR
- many worksheet formats
- fancy analytics
- polished dashboards
- batch exports for every edge case
- printable worksheet generation for many products

Those can come later.

The first real win is:
**one worksheet, real students, real scans, saved results, teacher review.**
