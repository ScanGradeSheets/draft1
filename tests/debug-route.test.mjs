import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

import { isBatchDebugRoutePathname, isDebugRoutePathname } from '../src/debug-route.js'

const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')

test('diagnostic landing is available only at the dedicated debug path', () => {
  assert.equal(isDebugRoutePathname('/debug'), true)
  assert.equal(isDebugRoutePathname('/debug/'), true)
  assert.equal(isDebugRoutePathname('/'), false)
  assert.equal(isDebugRoutePathname('/debugging'), false)
  assert.match(appSource, /v-if="!debugRouteEnabled && !batchDebugRouteEnabled"[\s\S]*Start Scan/)
  assert.match(appSource, /v-else[\s\S]*Debug Scan \(exports\)/)
  assert.match(appSource, /Regular ScanGrade/)
})

test('known-packet batch route is isolated from public and ordinary debug routes', () => {
  assert.equal(isBatchDebugRoutePathname('/debug/batch'), true)
  assert.equal(isBatchDebugRoutePathname('/debug/batch/'), true)
  assert.equal(isBatchDebugRoutePathname('/debug'), false)
  assert.equal(isBatchDebugRoutePathname('/'), false)
  assert.match(appSource, /batchPacketOptions = Object\.freeze\(\['A', 'B1', 'B2', 'B3', 'B4', 'B5', 'P02', 'P03', 'P05', 'P08', 'P09', 'G2-9'\]\)/)
  assert.match(appSource, /Do not use P01, P04, P06, or P07/)
  assert.match(appSource, /debugAutoUploadState === 'saved' \? 'Next Page' : 'Saving…'/)
})

test('debug Export control stays left of the centered recognition arrow', () => {
  const selector = '.student-scan-bar--debug-result:not(.student-scan-bar--grading) .student-debug-export'
  const start = appSource.indexOf(selector)
  const end = appSource.indexOf('}', start)
  const rule = appSource.slice(start, end)
  assert.ok(start >= 0 && end > start)
  assert.match(rule, /grid-column: 2/)
  assert.match(rule, /justify-self: start/)
  assert.match(appSource, /\.student-scan-bar--debug-result[^}]*\.student-scan-actions[\s\S]*grid-column: 4/)
})

test('a stuck debug result keeps an emergency state export available', () => {
  assert.match(appSource, /v-if="studentScanStage && ocrResult && studentDebugMode"/)
  assert.match(appSource, /student-debug-export--during-stage/)
  assert.match(appSource, /\.student-debug-export--during-stage\s*\{[^}]*position:\s*absolute[^}]*z-index:\s*4/s)
})
