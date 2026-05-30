# ScanGrade Student Mode UX Spec

## Purpose
Student Mode is the child-facing version of ScanGrade.
It is the primary classroom workflow, not a secondary demo mode.

It should feel simple, guided, and calm, similar in spirit to Brightspace Portfolio’s more guided student workflow. The app should lead the student through one task at a time with minimal reading and minimal decision-making.

The student experience should feel like:

1. choose name
1. open camera
2. line up page
3. hold still
4. capture
5. save result
6. see simple success state
7. retry if needed

Student Mode should not feel like a scanner dashboard or a teacher tool.

---

## Core Product Principle
Student Mode should reduce cognitive load by making the app do the technical work.

The student should not need to think about:
- camera settings
- markers
- image processing
- OCR
- exports
- tests
- diagnostics

The app should handle those invisibly.

---

## Design Principles

### 1. One task at a time
Only show the student the current step.

### 2. Minimal reading
Use very short prompts only.

Preferred prompts:
- Line up your page
- Hold still
- Got it
- Try again

### 3. Visual over verbal
The page target and camera behavior should do most of the teaching.

### 4. Automatic when possible
The app should detect readiness and capture automatically.

### 5. Friendly recovery
If something fails, guide the student back gently.

Avoid technical error language.

### 6. Shared-device friendly
The flow should work well on a small pool of shared iPads moving around a classroom.
Student identity and saved results should be quick to handle without adding adult-level setup during capture.

---

## Mode Structure

## A. Student Mode
Primary mode for student self-use, especially on iPad.

### Main goals
- simple camera workflow
- minimal controls
- low-reading interface
- automatic capture
- easy retry
- fast save for later teacher review

### Primary hardware target
Optimize first for:
- iPad held above worksheet on a desk or floor
- about 4 shared classroom iPads rather than one fixed mounted station

Support but do not optimize first for:
- worksheet held up to a laptop camera

---

## B. Teacher / Review Mode
Separate mode for teacher use.

Teacher / Review Mode can include:
- OCR detail
- exports
- diagnostics
- test buttons
- debug tools
- confidence information
- pipeline utilities

Do not mix teacher/debug features into Student Mode.

---

## Student Mode Capture Flow

### Step 1: Camera opens
- live preview fills the preview area
- no debug tools visible
- no extra clutter

### Step 0: Student identity
- student chooses their name from a simple class list before capture
- keep the list large-tap and low-reading
- once selected, the app should stay on that student until changed
- a future OCR read of a handwritten name line is optional assistive behavior, not the primary identification path

### Step 2: Student aligns page
- one full portrait worksheet outline is visible
- outside area is dimmed subtly
- prompt says: **Line up your page**

### Step 3: App detects readiness
When the worksheet is page-like enough and stable enough:
- prompt changes to: **Hold still**
- optional subtle glow or state change on the page target

### Step 4: Auto-capture
After a short stable hold:
- capture automatically
- brief success feedback: **Got it**

### Step 5: Show result
Show the captured result simply.

### Step 5.5: Save result
- on a successful read, save the scan result automatically for teacher review
- saving should not require the student to understand exports, diagnostics, or grading details

### Step 6: Retry if needed
If capture or OCR is not good enough:
- prompt says: **Try again**
- return to camera flow cleanly

---

## Camera Overlay Spec

### The overlay should be:
- one complete portrait 8.5×11 worksheet outline
- fully visible on screen
- centered in the camera preview
- clearly readable as one sheet of paper
- simple and calm
- supported by subtle outside dimming

### The overlay should not be:
- multiple nested boxes
- side bars that make the center feel narrow
- literal black corner squares
- technical guides
- scanner-style clutter

### Visual target
The student should immediately understand:
**This is where my page goes.**

---

## Camera Prompt States

### State 1: Looking
Prompt: **Line up your page**

Meaning:
- the app is looking for the worksheet

### State 2: Ready
Prompt: **Hold still**

Meaning:
- the page is good enough
- the stability timer has started

### State 3: Success
Prompt: **Got it**

Meaning:
- capture succeeded
- move to result

### State 4: Retry
Prompt: **Try again**

Meaning:
- capture or OCR was not good enough
- return to camera cleanly

---

## Auto-Capture Rules

### Goal
Auto-capture should feel helpful, not fussy.

### Suggested default
- stable hold time: about 1.2–1.5 seconds

### It should require:
- a page-like region
- roughly portrait shape
- roughly centered
- brief stability

### It should not trigger on:
- a face
- a room scene
- a wall
- the floor
- random stable textures

### Stability behavior
One bad frame should not instantly reset the whole process.

---

## Student-Facing Error Language

Use:
- Try again
- Move your page a little
- Hold still
- Need more light

Do not use:
- contour detection failed
- confidence threshold
- OCR error
- page not centered
- homography failure
- runtime error

---

## Student Mode Screen Content

### During capture
Show only:
- selected student name
- camera preview
- worksheet target
- one short instruction
- possibly one fallback button if needed

### After capture
Show only the essentials:
- captured page
- simple result state
- clear next action

Possible actions:
- Try again
- Done

---

## Teacher / Review Mode Screen Content
Keep these out of Student Mode.

Teacher / Review Mode can include:
- saved scan list / review queue
- student name and submission grouping
- runtime self-test
- pipeline smoke test
- OCR result details
- confidence values
- export JSON / CSV
- debug overlays
- technical logs
- development utilities

---

## Recommended Interaction Philosophy
Student Mode should be guided and calm.

The app should:
- tell the student only what matters right now
- avoid technical language
- avoid clutter
- use automatic capture when possible
- recover simply when something goes wrong

The app should feel like a student activity, not a technical tool.

---

## Immediate Product Direction
The best next structural move is to clearly separate:

- **Student Mode** = simple capture experience
- **Teacher / Review Mode** = diagnostics, exports, advanced controls

Student Mode should be the clean classroom-facing experience.
Teacher / Review Mode should keep the complexity.

---

## Summary
Student Mode should feel like this:

- open app
- line up page
- hold still
- app captures
- see result
- retry if needed

Everything technical should stay behind the scenes.
