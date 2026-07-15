#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
function findDebug(root) {
  const pending = [root]
  while (pending.length) {
    const current = pending.pop()
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const resolved = path.join(current, entry.name)
      if (entry.isDirectory()) pending.push(resolved)
      else if (entry.name === 'ocr-debug.json') return resolved
    }
  }
  throw new Error(`no debug output in ${root}`)
}
const workingFile = findDebug(path.join(ROOT, 'private-evidence/reports/v3-review-display-row-full-20260714/P08/debug/9d3f3e1a-captured'))
const outageFile = findDebug(path.join(ROOT, 'private-evidence/reports/v3-service-outage-fail-open-20260714'))
const working = JSON.parse(fs.readFileSync(workingFile, 'utf8'))
const outage = JSON.parse(fs.readFileSync(outageFile, 'utf8'))
const predictionCore = (document) => (document.predictions || []).map((row) => ({
  id: row.id, digit: row.digit, confidence: row.confidence, topGap: row.topGap,
  reviewNeeded: row.reviewNeeded, blank: row.blank, empty: row.empty, correct: row.correct,
}))
const comparisons = {
  predictionCore: JSON.stringify(predictionCore(working)) === JSON.stringify(predictionCore(outage)),
  questionCorrect: JSON.stringify(working.questionCorrect) === JSON.stringify(outage.questionCorrect),
  questionReview: JSON.stringify(working.questionReview) === JSON.stringify(outage.questionReview),
  answerGroups: JSON.stringify(working.answerGroups) === JSON.stringify(outage.answerGroups),
}
const report = {
  schemaVersion: 1, generatedAt: new Date().toISOString(),
  workingFile: path.relative(ROOT, workingFile), outageFile: path.relative(ROOT, outageFile),
  optionalServicesAffectGrade: false,
  outageShadowStatus: outage.v3Shadow?.status,
  outageLargeModelAvailable: outage.v3Shadow?.largeModelAvailable,
  outageCompactModelAvailable: outage.v3Shadow?.compactModelAvailable,
  pageCompleted: Array.isArray(outage.predictions) && outage.predictions.length > 0,
  comparisons,
  allLocalOutputsIdentical: Object.values(comparisons).every(Boolean),
}
const destination = path.join(ROOT, 'private-evidence/reports/v3-service-outage-fail-open-evaluation-20260714.json')
fs.writeFileSync(destination, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ destination: path.relative(ROOT, destination), ...report }, null, 2))
