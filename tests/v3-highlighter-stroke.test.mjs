import test from 'node:test'
import assert from 'node:assert/strict'
import { fluorescentHighlighterGeometry } from '../src/v3/highlighter-stroke.js'

test('fluorescent highlighter has a visible seeded tilt and restrained overhang', () => {
  const rect = { x: 100, y: 80, w: 80, h: 40 }
  const geometry = fluorescentHighlighterGeometry(rect, 262)
  const first = geometry.centerline[0]
  const last = geometry.centerline.at(-1)
  assert.ok(Math.abs(last[1] - first[1]) >= rect.w * 0.015)
  const xs = geometry.polygon.map(([x]) => x)
  assert.ok(Math.min(...xs) >= rect.x - rect.w * 0.07)
  assert.ok(Math.max(...xs) <= rect.x + rect.w * 1.07)
  assert.ok(geometry.width >= rect.h * 0.9)
  const leftCapRun = geometry.polygon.at(-1)[0] - geometry.polygon[0][0]
  const rightCapRun = geometry.polygon[4][0] - geometry.polygon[3][0]
  assert.ok(leftCapRun * rightCapRun > 0, 'both chisel ends lean in the same direction')
  assert.ok(Math.abs(leftCapRun - rightCapRun) < rect.h * 0.02, 'chisel ends remain roughly parallel')
})

test('highlighter shape is reproducible but varies between questions', () => {
  const rect = { x: 100, y: 80, w: 80, h: 40 }
  const first = fluorescentHighlighterGeometry(rect, 131)
  assert.deepEqual(first, fluorescentHighlighterGeometry(rect, 131))
  assert.notDeepEqual(first, fluorescentHighlighterGeometry(rect, 262))
})
