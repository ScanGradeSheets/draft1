import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

import { isDebugRoutePathname } from '../src/debug-route.js'

const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')

test('diagnostic landing is available only at the dedicated debug path', () => {
  assert.equal(isDebugRoutePathname('/debug'), true)
  assert.equal(isDebugRoutePathname('/debug/'), true)
  assert.equal(isDebugRoutePathname('/'), false)
  assert.equal(isDebugRoutePathname('/debugging'), false)
  assert.match(appSource, /v-if="!debugRouteEnabled"[\s\S]*Start Scan/)
  assert.match(appSource, /v-else[\s\S]*Debug Scan \(exports\)/)
  assert.match(appSource, /Regular ScanGrade/)
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
