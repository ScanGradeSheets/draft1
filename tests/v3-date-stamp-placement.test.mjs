import test from 'node:test'
import assert from 'node:assert/strict'
import { declaredDateStampRect } from '../src/v3/date-stamp-placement.js'

const LAUNCH_LAYOUT_IDS = [
  'sg-g1-lw-01-add-1digit',
  'sg-g1-lw-02-add-2digit',
  'sg-g1-lw-03-sub-1digit',
  'sg-g1-lw-04-sub-2digit',
  'sg-g1-lw-05-mixed-20',
  'sg-g1-lw-06-ten-frames',
  'sg-g1-lw-07-dot-collections',
  'sg-g1-lw-08-number-bonds',
  'sg-g1-lw-09-number-patterns',
  'sg-g1-lw-10-place-value-50',
]

test('all ten frozen launch layouts resolve a date zone clear of shared title and name line', () => {
  assert.equal(LAUNCH_LAYOUT_IDS.length, 10)
  for (const layoutId of LAUNCH_LAYOUT_IDS) {
    const rect = declaredDateStampRect({ layout_id: layoutId }, 215.9, 279.4)
    assert.ok(rect, layoutId)
    // Shared title/subtitle are centered above y=41 mm. The name line ends at
    // x=143.95 mm and y=54.5 mm; this reserved zone begins to its right.
    assert.ok(rect.x > 143.95, layoutId)
    assert.ok(rect.y > 41, layoutId)
    assert.ok(rect.y + rect.h < 84, layoutId)
    assert.ok(rect.x + rect.w < 193.5, layoutId)
  }
})

test('undeclared or invalid layouts omit the date instead of guessing', () => {
  assert.equal(declaredDateStampRect({}, 1000, 1300), null)
  assert.equal(declaredDateStampRect({ metadata: { annotation_zones: { date_stamp: {
    x: 0.9, y: 0.2, width: 0.2, height: 0.1,
  } } } }, 1000, 1300), null)
})

test('frozen launch IDs recover the approved zone from older QR-linked layout copies', () => {
  const rect = declaredDateStampRect({ layout_id: 'sg-g1-lw-09-number-patterns' }, 215.9, 279.4)
  assert.ok(rect)
  assert.ok(rect.x > 143.95)
  assert.equal(declaredDateStampRect({ layout_id: 'third-party-sheet' }, 215.9, 279.4), null)
})
