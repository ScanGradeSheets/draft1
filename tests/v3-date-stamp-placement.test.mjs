import test from 'node:test'
import assert from 'node:assert/strict'
import {
  completionDateStampRect,
  dateStampSpecForLayout,
  declaredDateStampRect,
  qrCompletionExclusionRect,
} from '../src/v3/date-stamp-placement.js'
import {
  teacherScorePlacement,
  teacherScoreSafetyRect,
} from '../src/v3/teacher-score-plan.js'

function overlaps(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  )
}

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

test('all ten frozen launch layouts retain their declared date safety contract', () => {
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

test('the completion date sits below the score and to the right of the QR code', () => {
  const layout = {
    layout_id: 'sg-g1-lw-06-ten-frames',
    metadata: {
      qr_position: { x: 0.4403, y: 0.8715, width: 0.1195, height: 0.0923 },
    },
  }
  const questionRects = [
    { x: 190, y: 420, w: 80, h: 65 },
    { x: 760, y: 1020, w: 90, h: 70 },
  ]
  const width = 1200
  const height = 1600
  const score = teacherScorePlacement({ width, height, layout, questionRects })
  const rect = completionDateStampRect(layout, width, height, questionRects)
  const qrExclusion = qrCompletionExclusionRect(layout, width, height)
  assert.ok(rect)
  assert.ok(rect.y >= score.y + Math.max(score.fontSize * 0.95, height * 0.035))
  assert.ok(rect.x > (0.4403 + 0.1195) * width)
  assert.ok(rect.x + rect.w * 0.5 > score.centerX)
  assert.ok(rect.x + rect.w < width)
  assert.ok(rect.y + rect.h < height)
  assert.equal(overlaps(rect, qrExclusion), false)
  assert.equal(overlaps(rect, teacherScoreSafetyRect(score, width, height)), false)
})

test('skewed ten-frame capture keeps the score and date clear of the visible QR footprint', () => {
  const layout = {
    layout_id: 'sg-g1-lw-06-ten-frames',
    metadata: {
      // Reproduces the lower-right QR shift visible in the 2026-07-29 phone
      // capture instead of testing only ideal PDF geometry.
      qr_position: { x: 0.535, y: 0.865, width: 0.115, height: 0.095 },
    },
  }
  const width = 1200
  const height = 1600
  const questionRects = [
    { x: 200, y: 520, w: 110, h: 90 },
    { x: 890, y: 1240, w: 115, h: 92 },
  ]
  const score = teacherScorePlacement({ width, height, layout, questionRects })
  const scoreRect = teacherScoreSafetyRect(score, width, height)
  const dateRect = completionDateStampRect(layout, width, height, questionRects)
  const qrExclusion = qrCompletionExclusionRect(layout, width, height)
  assert.ok(dateRect)
  assert.equal(overlaps(scoreRect, qrExclusion), false)
  assert.equal(overlaps(dateRect, qrExclusion), false)
  assert.equal(overlaps(dateRect, scoreRect), false)
  assert.ok(dateRect.x > (0.535 + 0.115) * width)
})

test('completion date is omitted when perspective leaves no safe space beside the QR', () => {
  const layout = {
    layout_id: 'sg-g1-lw-06-ten-frames',
    metadata: {
      qr_position: { x: 0.72, y: 0.86, width: 0.16, height: 0.1 },
    },
  }
  assert.equal(completionDateStampRect(layout, 1200, 1600, []), null)
})

test('completion stamps vary naturally by scan seed but remain deterministic and bounded', () => {
  const layout = {
    layout_id: 'sg-g1-lw-07-dot-collections',
    metadata: {
      qr_position: { x: 0.4403, y: 0.8715, width: 0.1195, height: 0.0923 },
    },
  }
  const date = new Date('2026-07-28T12:00:00Z')
  const first = dateStampSpecForLayout(layout, 2000, 2588, 12031, date)
  const replay = dateStampSpecForLayout(layout, 2000, 2588, 12031, date)
  const nextSheet = dateStampSpecForLayout(layout, 2000, 2588, 12032, date)
  assert.deepEqual(first, replay)
  assert.ok(first)
  assert.ok(nextSheet)
  assert.notDeepEqual(
    [first.x, first.y, first.rotation],
    [nextSheet.x, nextSheet.y, nextSheet.rotation],
  )
  for (const spec of [first, nextSheet]) {
    assert.ok(spec.x >= spec.rect.x)
    assert.ok(spec.x + spec.estimatedWidth <= spec.rect.x + spec.rect.w)
    assert.ok(spec.y >= spec.rect.y)
    assert.ok(spec.y <= spec.rect.y + spec.rect.h)
    assert.ok(Math.abs(spec.rotation) < 0.1)
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

test('the larger iPad date remains inside the declared safe zone', () => {
  const spec = dateStampSpecForLayout(
    { layout_id: 'sg-g1-lw-06-ten-frames' },
    2000,
    2588,
    9,
    new Date('2026-07-18T12:00:00Z'),
    [
      { x: 300, y: 700, w: 120, h: 90 },
      { x: 1380, y: 1700, w: 130, h: 95 },
    ],
  )
  assert.ok(spec)
  assert.ok(spec.fontSize >= 40)
  assert.ok(spec.x >= spec.rect.x)
  assert.ok(spec.x + spec.estimatedWidth <= spec.rect.x + spec.rect.w)
  assert.ok(spec.y >= spec.rect.y)
  assert.ok(spec.y <= spec.rect.y + spec.rect.h)
})
