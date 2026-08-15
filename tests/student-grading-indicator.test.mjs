import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')

test('quiet scanning keeps its sweep while animated grading holds a steady yellow band', () => {
  assert.match(
    source,
    /'student-scan-grading-word--steady': studentScanStage === 'grading'/,
  )
  assert.match(
    source,
    /\.student-scan-grading-word::before\s*\{[^}]*animation:\s*scan-grading-word-highlight 1\.16s ease-in-out infinite/s,
  )
  assert.match(
    source,
    /\.student-scan-grading-word--steady::before\s*\{[^}]*animation:\s*none/s,
  )
})

test('grading exclusively owns the result bar until the finished stamped sheet is visible', () => {
  const stageIndicator = source.indexOf('<div v-if="studentScanStage" class="student-scan-grading"')
  const completionControls = source.indexOf('<template v-if="!studentScanStage">', stageIndicator)
  const recognitionArrow = source.indexOf('class="student-recognition-toggle"', completionControls)
  const newScan = source.indexOf('New Scan', completionControls)

  assert.ok(stageIndicator >= 0)
  assert.ok(completionControls > stageIndicator)
  assert.ok(recognitionArrow > completionControls)
  assert.ok(newScan > completionControls)
  assert.doesNotMatch(source, /<template v-else>[\s\S]*class="student-recognition-toggle"/)
})
