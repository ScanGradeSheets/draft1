import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../src/components/CameraCapture.vue', import.meta.url), 'utf8')

function between(start, end) {
  const startIndex = source.indexOf(start)
  const endIndex = source.indexOf(end, startIndex + start.length)
  assert.ok(startIndex >= 0, `missing start marker: ${start}`)
  assert.ok(endIndex > startIndex, `missing end marker: ${end}`)
  return source.slice(startIndex, endIndex)
}

test('live camera startup does not initialize recognition models on the viewfinder thread', () => {
  const cameraStartup = between('const startCamera = async', 'const capturePhoto =')
  assert.equal(cameraStartup.includes('initDigitModel('), false)
  assert.equal(cameraStartup.includes('warmWholeSlotScout('), false)
})

test('student mount does not race model warmup against automatic camera startup', () => {
  const mounted = between('onMounted(() => {', "watch(\n  () => processing.value")
  assert.equal(mounted.includes('initDigitModel('), false)
  assert.equal(mounted.includes('warmWholeSlotScout('), false)
})

test('recognition still initializes its model after a capture is committed', () => {
  const recognition = between('const runRealOCR = async', 'const retake =')
  assert.match(
    recognition,
    /withDigitEngineTimeout\(\s*initDigitModel\(\),\s*'initializing digit model'/,
  )
})

test('automatic capture preserves its triggering full-resolution frame before announcing capture', () => {
  const capture = between("async function doCapture({ source = 'manual' } = {})", 'const capturePhoto =')
  const preservedIndex = capture.indexOf("const triggerFrame = source === 'auto' ? makeStudentCaptureCanvas(video) : null")
  const announcedIndex = capture.indexOf("studentAutoStatus.value = 'Choosing clearest frame'")
  const burstIndex = capture.indexOf('captureBestStudentFrame(video, source, triggerFrame)')
  assert.ok(preservedIndex >= 0)
  assert.ok(announcedIndex > preservedIndex)
  assert.ok(burstIndex > announcedIndex)
})

test('the first burst candidate uses the preserved frame without waiting for user movement', () => {
  const burst = between('async function captureBestStudentFrame', 'function hasUsableScanGradeQr')
  assert.equal(burst.includes('index === 0 ? initialFrame : null'), true)
  const candidate = between('async function captureStudentFrameCandidate', 'async function captureBestStudentFrame')
  assert.equal(candidate.includes('if (!initialFrame) await nextDrawableFrame(video)'), true)
})
