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
  const completionEmit = source.lastIndexOf("emit('ocr-complete', ocrResult.value)")

  assert.ok(hold >= 0)
  assert.ok(initialPresentation > hold)
  assert.ok(promiseAssignment > initialPresentation)
  assert.ok(completionAwait > promiseAssignment)
  assert.ok(completionEmit > completionAwait)
})

test('candidate failure remains a Beta 15.3 fail-open result before completion', () => {
  const failure = source.indexOf("status: 'fail-open'")
  const resultAssignment = source.indexOf(
    'ocrResult.value = mergeAsyncOcrPayloadPreservingTeacherState(ocrResult.value, payload)',
    failure,
  )
  const completionAwait = source.indexOf('await candidatePresentationPromise')

  assert.ok(failure >= 0)
  assert.ok(resultAssignment > failure)
  assert.ok(completionAwait > resultAssignment)
})
