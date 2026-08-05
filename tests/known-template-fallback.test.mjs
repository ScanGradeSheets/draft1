import test from 'node:test'
import assert from 'node:assert/strict'

import { trustedKnownTemplateFallback } from '../src/v3/known-template-fallback.js'

const titleMatch = {
  accepted: true,
  layoutId: 'sg-g1-lw-07-dot-collections',
  score: 0.34,
  gap: 0.04,
}

const assignment = (id, x, trusted = true) => ({
  id,
  rect: {
    x,
    y: 20,
    w: 30,
    h: 40,
    trustedPhysicalDigitBox: trusted,
    parentAnswerFrameId: `frame-${Math.floor(Number(id) / 2)}`,
  },
})

test('missing QR can retain normal confidence only with a complete independent box map', () => {
  assert.equal(trustedKnownTemplateFallback({
    titleMatch,
    expectedBoxCount: 4,
    assignments: [assignment(0, 10), assignment(1, 50), assignment(2, 90), assignment(3, 130)],
  }), true)
})

test('paired logical slots may share one independently registered printed answer frame', () => {
  const assignments = [
    assignment(0, 10, true),
    assignment(1, 40, false),
    assignment(2, 90, true),
    assignment(3, 120, false),
  ]
  assert.equal(trustedKnownTemplateFallback({
    titleMatch,
    expectedBoxCount: 4,
    expectedFrameGroups: [[0, 1], [2, 3]],
    assignments,
  }), true)

  assert.equal(trustedKnownTemplateFallback({
    titleMatch,
    expectedBoxCount: 4,
    expectedFrameGroups: [[0, 1], [2, 3]],
    assignments: assignments.map((item) => (
      item.id < 2 ? item : { ...item, rect: { ...item.rect, trustedPhysicalDigitBox: false } }
    )),
  }), false)
})

test('ambiguous titles and incomplete box maps remain review-only', () => {
  assert.equal(trustedKnownTemplateFallback({
    titleMatch: { ...titleMatch, gap: 0.01 },
    expectedBoxCount: 2,
    assignments: [assignment(0, 10), assignment(1, 50)],
  }), false)
  assert.equal(trustedKnownTemplateFallback({
    titleMatch,
    expectedBoxCount: 4,
    assignments: [assignment(0, 10), assignment(1, 50), assignment(2, 90)],
  }), false)
  assert.equal(trustedKnownTemplateFallback({
    titleMatch,
    expectedBoxCount: 2,
    assignments: [assignment(0, 10, false), assignment(1, 50, false)],
  }), false)
})
