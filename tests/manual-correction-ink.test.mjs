import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import { drawManualCorrectionInk } from '../src/v3/manual-correction-ink.js'

function recordingContext() {
  const calls = []
  const ctx = new Proxy({ calls }, {
    get(target, property) {
      if (property in target) return target[property]
      return (...args) => calls.push([property, ...args])
    },
    set(target, property, value) {
      calls.push(['set', property, value])
      target[property] = value
      return true
    },
  })
  return ctx
}

test('manual correction ink is deterministic for live and settled renderers', () => {
  const rects = [
    { x: 200, y: 300, w: 68, h: 82 },
    { x: 268, y: 300, w: 68, h: 82 },
  ]
  const first = recordingContext()
  const second = recordingContext()
  drawManualCorrectionInk(first, rects, ['1', '5'], 309)
  drawManualCorrectionInk(second, rects, ['1', '5'], 309)
  assert.deepEqual(first.calls, second.calls)
  assert.ok(first.calls.some((call) => call[0] === 'fillText' && call[1] === '1'))
  assert.ok(first.calls.some((call) => call[0] === 'fillText' && call[1] === '5'))
})

test('CameraCapture uses the shared correction renderer for preview and final ink', () => {
  const source = fs.readFileSync(new URL('../src/components/CameraCapture.vue', import.meta.url), 'utf8')
  assert.match(source, /activeCorrectionInkPreviewUrl/)
  assert.equal(
    (source.match(/drawManualCorrectionInk\s*\(/g) || []).length,
    2,
    'one shared call renders the live preview and one renders the settled sheet',
  )
  assert.match(
    source,
    /drawManualCorrectionInk\(ctx,\s*rects,\s*cells,\s*\(groupIndex \+ 1\) \* 131 \+ 47\)/,
  )
  assert.match(source, /const seed = \(index \+ 1\) \* 131/)
  assert.match(
    source,
    /drawManualCorrectionInk\(ctx,\s*correctedEntries\.map\(\(entry\) => entry\.rect\),\s*displayCells,\s*seed \+ 47\)/,
  )
})
