# ScanGrade release-candidate device test protocol

Status: prepared before selecting or opening another untouched packet.

## Purpose

Lock an exceptional browser-only ScanGrade release across the current iPhone,
the four-to-five-year-old black iPad, and the approximately nine-year-old
orange iPad without turning the remaining unseen handwriting into development
data.

The ordinary user experience is `https://scangrade.io/`. Diagnostic capture is
deliberately separate at `https://scangrade.io/debug`.

## Stop point 0: confirm the physical inventory

Before selecting anything, Tony confirms which packets remain intact and
untouched. The current ledger expects P01, P04, P06, and P07, but the physical
labels are authoritative. Do not inspect handwriting quality while confirming
IDs.

Use only one randomly selected packet for qualification. Preserve the others.
If qualification exposes a defect, repair it against already opened evidence;
do not use another untouched packet until the candidate is frozen again.

## Session 0: no new packet consumed

Use already opened worksheets to check all three devices:

1. Charge both iPads above 50%; record device, OS, browser, and battery.
2. Close the old ScanGrade tab, open `https://scangrade.io/`, and confirm the
   exact build label.
3. Confirm the landing page has only Start Scan and Get Worksheets.
4. Confirm the page is fixed in place, the viewfinder and bars fit, and no
   control overlaps browser chrome.
5. Run one ordinary cold scan and one warm scan. Record capture-to-first-mark
   time, capture attempts, automatic/yellow count, and any fallback message.
6. On an already opened page containing review, verify yellow focus, keypad,
   correction, repeated correction, annotation persistence, score, Export/New
   Scan placement, Back, and Home.
7. Open `https://scangrade.io/debug`, confirm its dedicated landing, run one
   Debug Scan, and verify Export sits left of and clear of the recognition
   arrow. Export the bundle.

Any crash, hang, missing mark, displaced annotation, unusable camera, all-yellow
fallback, or broken navigation stops the phase before an untouched packet is
selected.

## Qualification packet: three-device crossover

After Session 0 passes, select one remaining packet by a recorded random draw
without viewing handwriting. Keep its ten pages intact and in order.

Each device scans all ten pages, producing 30 page runs total. Rotate device
order by page so one device is not always first. Use normal indoor light and
ordinary handling; do not seek a better result with repeated successful scans.
Retain every failed attempt and retake in the denominator.

For each run record:

- packet, page/layout, device, OS/browser, battery, and run order;
- cold/warm state, capture attempts, rejection reason, and accepted-capture time;
- capture-to-first-mark and capture-to-complete time;
- exact transcription, automatic/yellow state, mathematical mark, and fallback;
- annotation box/meaning, score, mark persistence, and manual correction result;
- crash, reload, memory, heat, camera lag, or navigation issue;
- Debug bundle only when a failure or device discrepancy needs diagnosis.

Create handwriting truth only after all device runs are frozen. Transcribe what
the child wrote—including incorrect mathematics, blanks, erasures, and
overwrites—without looking at ScanGrade's reading or the answer key. Keep
mathematical correctness as a separate field.

## Qualification gates

- Zero confidently incorrect automatic transcriptions.
- Zero wrong-page, wrong-question, corrupt-result, lost-mark, or silent-fallback
  incidents.
- Every accepted capture completes grading.
- At least 98% of page runs capture within two attempts.
- Correct annotation placement/meaning and correction behavior on every
  inspected page.
- Automatic coverage reported by packet, layout, answer length, and device;
  yellow review is a safe outcome and must never be hidden to improve coverage.
- No sustained device degradation across each ten-page run.
- Orange-iPad processing reported separately; the demonstrated reference is
  19.005 seconds to result ready, not a promise that every page must match it.

## Defect policy

Reproduce before changing code. OCR, capture, homography, and device logic do
not change without a saved reproducer. Cosmetic fixes receive focused visual
checks on all three devices. A confident transcription error is a release
blocker; the opened packet may diagnose it but cannot validate its repair.

After any behavior-sensitive repair, freeze a new candidate and use one newly
randomized untouched packet for the final locked confirmation. If the first
qualification passes without such a repair, preserve all remaining packets for
classroom rollout evidence rather than spending another packet automatically.

## Release handoff

After the gate passes: tag and back up the exact release, retain the immutable
Cloudflare rollback URL, publish the supported-device matrix and honest beta
scope, then move primary effort to rollout, onboarding, worksheet packaging,
marketing, and promotion. Numerical reliability or time-saving claims remain
gated on broader prospective classroom evidence.
