import test from 'node:test'
import assert from 'node:assert/strict'

import {
  STUDENT_AUTO_CAPTURE_FINAL_FOCUS_MIN,
  STUDENT_AUTO_CAPTURE_STABILITY_HOLD_MS,
  STUDENT_AUTO_CAPTURE_TRIGGER_FOCUS_MIN,
  STUDENT_MANUAL_CAPTURE_FOCUS_MIN,
  studentCaptureFocusDecision,
  studentSheetAppearanceDecision,
} from '../src/v3/student-capture-policy.js'

test('auto-capture starts its burst sooner but preserves the final quality floor', () => {
  assert.equal(STUDENT_AUTO_CAPTURE_TRIGGER_FOCUS_MIN, 220)
  assert.equal(STUDENT_AUTO_CAPTURE_STABILITY_HOLD_MS, 100)
  assert.ok(STUDENT_AUTO_CAPTURE_TRIGGER_FOCUS_MIN < STUDENT_AUTO_CAPTURE_FINAL_FOCUS_MIN)
})

test('automatic capture accepts a clear usable frame without requiring the former 650 score', () => {
  assert.equal(STUDENT_AUTO_CAPTURE_FINAL_FOCUS_MIN, 560)
  assert.equal(studentCaptureFocusDecision({ source: 'auto', focusScore: 559 }).accepted, false)
  assert.equal(studentCaptureFocusDecision({ source: 'auto', focusScore: 560 }).accepted, true)
  assert.equal(studentCaptureFocusDecision({ source: 'auto', focusScore: 649 }).accepted, true)
})

test('manual capture retains its existing sharpness floor', () => {
  assert.equal(STUDENT_MANUAL_CAPTURE_FOCUS_MIN, 340)
  assert.equal(studentCaptureFocusDecision({ source: 'manual', focusScore: 339 }).accepted, false)
  assert.equal(studentCaptureFocusDecision({ source: 'manual', focusScore: 340 }).accepted, true)
})

test('dim but readable ScanGrade paper can open the capture burst', () => {
  const decision = studentSheetAppearanceDecision({
    markerStats: Array.from({ length: 4 }, () => ({ darkFraction: 0.18, mean: 176 })),
    paperStats: { mean: 116, brightFraction: 0.15, darkFraction: 0.03 },
  })
  assert.equal(decision.accepted, true)
  assert.equal(decision.preferred, false)
  assert.equal(decision.status, 'Hold steady')
})

test('soft live-video marker patches can pass without weakening the four-marker requirement', () => {
  const decision = studentSheetAppearanceDecision({
    markerStats: Array.from({ length: 4 }, () => ({ darkFraction: 0.08, mean: 205 })),
    paperStats: { mean: 128, brightFraction: 0.3, darkFraction: 0.08 },
  })
  assert.equal(decision.accepted, true)
  assert.equal(decision.darkMarkerCount, 4)
})

test('bright clean paper remains the preferred burst evidence', () => {
  const decision = studentSheetAppearanceDecision({
    markerStats: Array.from({ length: 4 }, () => ({ darkFraction: 0.3, mean: 130 })),
    paperStats: { mean: 165, brightFraction: 0.75, darkFraction: 0.02 },
  })
  assert.equal(decision.accepted, true)
  assert.equal(decision.preferred, true)
})

test('dark scenes and fewer than four black markers remain blocked', () => {
  const darkScene = studentSheetAppearanceDecision({
    markerStats: Array.from({ length: 4 }, () => ({ darkFraction: 0.2, mean: 170 })),
    paperStats: { mean: 84, brightFraction: 0.08, darkFraction: 0.42 },
  })
  assert.equal(darkScene.accepted, false)
  assert.equal(darkScene.status, 'Find the worksheet page')

  const missingMarker = studentSheetAppearanceDecision({
    markerStats: [
      ...Array.from({ length: 3 }, () => ({ darkFraction: 0.2, mean: 170 })),
      { darkFraction: 0.02, mean: 238 },
    ],
    paperStats: { mean: 165, brightFraction: 0.75, darkFraction: 0.02 },
  })
  assert.equal(missingMarker.accepted, false)
  assert.equal(missingMarker.status, 'Find all 4 black squares')
})
