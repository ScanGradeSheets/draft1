import assert from 'node:assert/strict'
import test from 'node:test'
import { coherentAnswerBoxAssignmentStats } from '../src/homography.js'

function fixture() {
  const expected = []
  const assignments = new Map()
  let id = 0
  for (const x of [400, 1200]) for (const y of [500, 800, 1100, 1400]) {
    const rect = { id, x, y, w: 110, h: 130 }
    expected.push(rect)
    assignments.set(id, {
      x: x * .96 - y * .018 + 35 + (id % 2 ? 5 : -4),
      y: x * .012 + y * .94 + 42 + (id % 3 - 1) * 4,
      w: 112,
      h: 132,
    })
    id += 1
  }
  return { expected, assignments }
}

test('complete coherent physical frames may correct curvature beyond a per-box template gate', () => {
  const { expected, assignments } = fixture()
  const stats = coherentAnswerBoxAssignmentStats(expected, assignments, { referenceSize: 130 })
  assert.equal(stats.coherent, true)
  assert.equal(stats.assigned, 8)
  assert.ok(stats.maxResidual < 34)
})

test('one unrelated contour cannot acquire page-coherent trust', () => {
  const { expected, assignments } = fixture()
  assignments.set(4, { x: 200, y: 1800, w: 110, h: 130 })
  assert.equal(coherentAnswerBoxAssignmentStats(expected, assignments, { referenceSize: 130 }).coherent, false)
})

test('partial frame detections remain untrusted', () => {
  const { expected, assignments } = fixture()
  assignments.delete(7)
  const stats = coherentAnswerBoxAssignmentStats(expected, assignments, { referenceSize: 130 })
  assert.equal(stats.coherent, false)
  assert.equal(stats.reason, 'incomplete-assignment')
})
