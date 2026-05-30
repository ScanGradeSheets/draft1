# Student Mode Implementation Plan

Based on [SCAN_GRADE_STUDENT_MODE_UX_SPEC.md](./SCAN_GRADE_STUDENT_MODE_UX_SPEC.md).

---

## Goal

Separate **Student Mode** (simple, guided, low-reading, primary classroom flow) from **Teacher / Review Mode** (saved-result review, diagnostics, exports, OCR detail, test tools) without mixing teacher complexity into the student flow.

---

## Smallest Practical First Step

**Introduce a mode and hide all teacher/debug UI when in Student Mode.**

Do not yet:
- Add new prompt states (Hold still, Got it, Try again) beyond what exists
- Redesign the result screen
- Add a settings or mode-picker UI

Do:
- Add a single source of truth for “Student” vs “Teacher” mode
- In Student Mode, hide every teacher/debug element so the student sees only: camera, one outline, one short prompt, capture/retake/file fallback, and a minimal result
- Keep existing camera flow and auto-capture logic unchanged
- Preserve the direction that successful scans will later be saved for teacher review

---

## Step 1: Mode + Gate Teacher UI (this step)

### 1.1 Mode source

- **Option A (recommended):** URL query param `?mode=teacher` = Teacher Mode; absence or `?mode=student` = Student Mode.  
  - Student Mode is the default so classroom use needs no setup.
- **Option B:** In-app toggle (e.g. small “Teacher” link or switch) that sets the same two modes and optionally persists in `localStorage`.

Use **Option A** for the smallest change: read `mode` from the URL in `App.vue` (e.g. `useRoute().query.mode` or `new URLSearchParams(location.search).get('mode')`). No router required if the app is a single page.

### 1.2 App.vue changes

When `mode !== 'teacher'` (i.e. Student Mode):

- Hide the **Runtime Self-Test** and **Pipeline Smoke Test** buttons and the whole test section.
- Hide the **Test Output** console (or the whole console block).
- When showing **Results** after OCR:
  - Hide: “Detected: …”, “Avg Confidence”, “Time: …ms”, **Export JSON**, **Export CSV**.
  - Show: a short line like “Done” or “Scanned” and optionally a single **Done** (or “Try again”) action. No technical wording.
- Keep room in the layout for a student-name selector above the capture flow.

When `mode === 'teacher'`:

- Show everything as today (tests, console, full results, exports).

### 1.3 CameraCapture.vue changes

- Accept a prop, e.g. `studentMode: Boolean` (passed from App based on URL).
- When `studentMode` is true:
  - Hide the detailed **OCR result** block: digit grid, per-digit confidence, “flagged for review”, **Export crop preview**, **Export tensors JSON**.
  - After a successful capture/OCR, show only:
    - The captured image (already shown when `capturedImage` is set).
    - One short line of copy, e.g. “Got it” or “Done.”
    - **Retake** (or “Try again”) and optionally **Choose File** as fallback. No digits, no confidence, no export/debug.

When `studentMode` is false:

- Keep current behavior: full OCR result with digits, confidence, correct/incorrect, and export/debug buttons.

### 1.4 Files to touch

| File | Change |
|------|--------|
| `src/App.vue` | Read `?mode=teacher`; compute `isStudentMode`; conditionally render test section, console, and simplified results; pass `studentMode` to `CameraCapture`. |
| `src/components/CameraCapture.vue` | Add prop `studentMode`; when true, hide detailed OCR block and show only minimal success + Retake (and optional Choose File). |

### 1.5 Result after Step 1

- **Student Mode (default):** Camera, one portrait outline, “Line up your page”, auto-capture, then minimal “Done” + Retake. No tests, no console, no digits/confidence, no exports, no debug.
- **Teacher Mode (`?mode=teacher`):** Current full UI: tests, console, full results, exports, and inside CameraCapture the full OCR result and debug exports.

---

## Later Steps (not in this first step)

- **Student identity:** Add teacher-managed class roster and a simple student name selector before capture. Prefer manual selection first; treat handwritten-name OCR as optional later assistive behavior only if it proves reliable enough.
- **Saved results:** After successful capture/OCR, save result records for later teacher review rather than making the teacher inspect the live capture screen.
- **Prompt states:** Drive the copy under the overlay from capture state: “Line up your page” → “Hold still” when page-like + stable → “Got it” on success → “Try again” on retry (spec § Camera Prompt States).
- **Result screen:** In Student Mode, replace or simplify the current result block (e.g. “Got it” + image + Try again / Done only).
- **Error copy:** In Student Mode, map errors to student-facing phrases only (“Try again”, “Move your page a little”, “Need more light”) and hide technical messages.
- **Mode picker:** If desired, add a small, non-intrusive way to switch mode (e.g. “Teacher” link when in Student Mode) that sets URL or state; keep Student as default.

---

## Summary

**Smallest step:** Add URL-based Student vs Teacher mode; in Student Mode hide all test/debug/export and detailed OCR UI in App and CameraCapture; show only camera, outline, one prompt, and a minimal result with Retake. No new flows or prompt states yet.  
**Next product step after that:** add roster-based student selection and automatic save-for-review.
