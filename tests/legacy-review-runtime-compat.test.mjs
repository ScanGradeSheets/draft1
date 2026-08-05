import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const cameraPath = new URL('../src/components/CameraCapture.vue', import.meta.url)
const legacyCriticalPaths = [
  cameraPath,
  new URL('../src/v3/teacher-score-plan.js', import.meta.url),
  new URL('../src/v3/browser-local-cascade.js', import.meta.url),
  new URL('../src/v3/trocr-small-shadow-client.js', import.meta.url),
]

test('legacy-critical review paths avoid unsupported Array.at and Promise.finally', async () => {
  for (const path of legacyCriticalPaths) {
    const source = await readFile(path, 'utf8')
    assert.doesNotMatch(source, /\.at\s*\(/, `${path.pathname} uses Array.at`)
    assert.doesNotMatch(source, /\.finally\s*\(/, `${path.pathname} uses Promise.finally`)
  }
})

test('manual review advances before optional legacy image and animation awaits', async () => {
  const source = await readFile(cameraPath, 'utf8')
  const start = source.indexOf('async function applyManualCorrectionCells')
  const end = source.indexOf('\nfunction clearAutoCaptureInterval', start)
  assert.ok(start >= 0 && end > start)
  const body = source.slice(start, end)
  const advance = body.indexOf('const nextReviewGroup = nextYellowReviewGroup')
  const compose = body.indexOf('await composeStudentAnnotatedImage')
  const animation = body.indexOf('await manualCorrectionAnimationBase')
  assert.ok(advance >= 0)
  assert.ok(compose > advance, 'review advance must precede image composition')
  assert.ok(animation > advance, 'review advance must precede animation preparation')
})
