import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/components/CameraCapture.vue', import.meta.url), 'utf8')

function zIndexFor(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = source.match(new RegExp(`${escaped}\\s*\\{[^}]*z-index:\\s*(\\d+)`, 's'))
  return match ? Number(match[1]) : null
}

test('the on-sheet correction focus stays above blue recognition labels', () => {
  const recognitionLayer = zIndexFor('.recognition-read-overlay')
  const correctionLayer = zIndexFor('.on-sheet-correction-focus')

  assert.equal(Number.isFinite(recognitionLayer), true)
  assert.equal(Number.isFinite(correctionLayer), true)
  assert.equal(correctionLayer > recognitionLayer, true)
})
