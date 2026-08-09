import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const homographySource = await readFile(new URL('../src/homography.js', import.meta.url), 'utf8')

test('marker debug binary uses one bulk OpenCV canvas transfer', () => {
  const debugStart = homographySource.indexOf('if (debugMarkers) {')
  const debugEnd = homographySource.indexOf('// Clean up', debugStart)
  assert.ok(debugStart >= 0 && debugEnd > debugStart)
  const debugBlock = homographySource.slice(debugStart, debugEnd)
  assert.match(debugBlock, /cv\.imshow\(canvas, binary\)/)
  assert.doesNotMatch(debugBlock, /binary\.ucharAt/)
})

test('worksheet processing exports timing boundaries without changing processing options', () => {
  assert.match(homographySource, /typeof options\.onStage === 'function'/)
  for (const stage of [
    'detecting corner markers',
    'selecting page orientation',
    'registering answer boxes',
    'preparing recognition tensors',
    'worksheet processing complete',
  ]) {
    assert.match(homographySource, new RegExp(`notifyStage\\('${stage}'\\)`))
  }
})
