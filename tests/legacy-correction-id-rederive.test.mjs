import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const cameraPath = new URL('../src/components/CameraCapture.vue', import.meta.url)
const source = await readFile(cameraPath, 'utf8')

function functionBody(name, nextName) {
  const start = source.indexOf(`function ${name}(`)
  const end = source.indexOf(`\nfunction ${nextName}(`, start)
  assert.ok(start >= 0 && end > start, `${name} body not found`)
  return source.slice(start, end)
}

test('legacy numeric ids remain canonical through the final 19 re-derivation path', () => {
  // The correction writer already normalizes ids. Guard the four downstream
  // computations so an old-WebKit numeric layout id cannot make a just-settled
  // string-id prediction look missing or yellow again.
  const correction = functionBody('applyManualCorrectionCells', 'clearAutoCaptureInterval')
  assert.match(correction, /predictionIndexById\.get\(predictionIdKey\(id\)\)/)

  const checks = [
    ['buildQuestionCorrect', 'questionRequiresTeacherReview'],
    ['buildQuestionReviewFlags', 'buildAnswerGroups'],
    ['buildAnswerGroups', 'clonePlain'],
    ['buildAnnotationRegions', 'buildOverlayDebugSnapshot'],
  ]
  for (const [name, nextName] of checks) {
    const body = functionBody(name, nextName)
    assert.match(body, /predictionMapById\(predictions\)/, `${name} must use canonical prediction keys`)
  }
  assert.match(functionBody('questionRequiresTeacherReview', 'buildQuestionReviewFlags'), /predictionForId\(/)
  assert.match(functionBody('buildAnswerGroups', 'clonePlain'), /predictionForId\(/)
  assert.match(functionBody('buildAnnotationRegions', 'buildOverlayDebugSnapshot'), /predictionForId\(/)
})
