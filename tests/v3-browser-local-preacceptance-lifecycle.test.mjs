import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../src/components/CameraCapture.vue', import.meta.url), 'utf8')

test('private browser-local candidate holds presentation and completion until its final decision', () => {
  const hold = source.indexOf('const holdBrowserLocalCandidatePresentation')
  const initialPresentation = source.indexOf('!holdStrongYellowPresentation', hold)
  const promiseAssignment = source.indexOf('candidatePresentationPromise = requestWholeSlotScout')
  const completionAwait = source.indexOf('await candidatePresentationPromise')
  const completionEmit = source.lastIndexOf("emit('ocr-complete', ocrResult.value)")

  assert.ok(hold >= 0)
  assert.ok(initialPresentation > hold)
  assert.ok(promiseAssignment > initialPresentation)
  assert.ok(completionAwait > promiseAssignment)
  assert.ok(completionEmit > completionAwait)
})

test('public critical-confusion safety check holds marks until its final key-blind decision', () => {
  assert.match(source, /acceptedSafetyRuntimeEnabled = !browserLocalStrongConfig\.requested &&\s+acceptedSafetyConfig\.requested/)
  assert.match(source, /acceptedSafetyConfig\.policyScope === 'six-eight-only'/)
  assert.match(source, /read === '1' \|\| read === '6' \|\| read === '8'/)
  const hold = source.indexOf('const holdAcceptedSafetyPresentation')
  const initialPresentation = source.indexOf('!holdStrongYellowPresentation', hold)
  const promiseAssignment = source.indexOf(
    'candidatePresentationPromise = acceptedSafetyPromise',
  )
  const completionAwait = source.indexOf('await candidatePresentationPromise')
  const completionEmit = source.lastIndexOf("emit('ocr-complete', ocrResult.value)")

  assert.ok(hold >= 0)
  assert.ok(initialPresentation > hold)
  assert.ok(promiseAssignment > initialPresentation)
  assert.ok(completionAwait > promiseAssignment)
  assert.ok(completionEmit > completionAwait)
})

test('private strong-yellow apply mode holds marks until its final fail-open decision', () => {
  const hold = source.indexOf('const holdStrongYellowPresentation')
  const initialPresentation = source.indexOf('!holdStrongYellowPresentation', hold)
  const promiseAssignment = source.indexOf(
    'candidatePresentationPromise = prepareShadowItems()',
    initialPresentation,
  )
  const completionAwait = source.indexOf('await candidatePresentationPromise')
  const processingComplete = source.indexOf('processing.value = false', completionAwait)
  const deferredPresentation = source.indexOf(
    'if (deferredStrongYellowPresentation)',
    processingComplete,
  )
  const completionEmit = source.lastIndexOf("emit('ocr-complete', ocrResult.value)")

  assert.ok(hold >= 0)
  assert.ok(initialPresentation > hold)
  assert.ok(promiseAssignment > initialPresentation)
  assert.ok(completionAwait > promiseAssignment)
  assert.ok(processingComplete > completionAwait)
  assert.ok(deferredPresentation > processingComplete)
  assert.ok(completionEmit > deferredPresentation)
})

test('candidate failure remains a Beta 15.3 fail-open result before completion', () => {
  const failure = source.indexOf("status: 'fail-open'")
  const deferredAssignment = source.indexOf(
    'deferredStrongYellowPresentation = payload',
    failure,
  )
  const completionAwait = source.indexOf('await candidatePresentationPromise')
  const processingComplete = source.indexOf('processing.value = false', completionAwait)
  const resultAssignment = source.indexOf(
    'ocrResult.value = mergeAsyncOcrPayloadPreservingTeacherState(',
    processingComplete,
  )

  assert.ok(failure >= 0)
  assert.ok(deferredAssignment > failure)
  assert.ok(completionAwait > deferredAssignment)
  assert.ok(processingComplete > completionAwait)
  assert.ok(resultAssignment > processingComplete)
})

test('retained-frame WebKit reproduction can inject a capture only behind the replay flag', () => {
  assert.match(source, /if \(hasDebugQueryFlag\('v3BurstReplay'\)\)/)
  assert.match(source, /window\.__SCANGRADE_REPLAY_CAPTURE_DATA_URL = \(imageDataUrl\) =>/)
  assert.match(source, /delete window\.__SCANGRADE_REPLAY_CAPTURE_DATA_URL/)
  assert.match(source, /window\.__SCANGRADE_REPLAY_OPEN_CORRECTION = \(questionNum\) =>/)
  assert.match(source, /delete window\.__SCANGRADE_REPLAY_OPEN_CORRECTION/)
  assert.match(source, /window\.__SCANGRADE_REPLAY_CORRECTION_STATE = \(\) =>/)
  assert.match(source, /delete window\.__SCANGRADE_REPLAY_CORRECTION_STATE/)
})

test('debug export records the physical correction lifecycle at export time', () => {
  assert.match(source, /function uiLifecycleSnapshot\(event = 'snapshot'\)/)
  assert.match(source, /uiLifecycleSnapshot:\s*uiLifecycleSnapshot\('export'\)/)
  assert.match(source, /uiLifecycleTrace:\s*\[\.\.\.uiLifecycleTrace\]/)
  assert.match(source, /recordUiLifecycle\('correction-start'\)/)
  assert.match(source, /recordUiLifecycle\('correction-complete'\)/)
})
