#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const read = (relative) => JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'))

const pageRows = read('private-evidence/reports/current-historical-browser-replay-20260714/rows.json')
const scored = read('private-evidence/reports/v3-historical-fresh-replay-20260713-score-visual-audited.json')
const compact = read('private-evidence/reports/v3-local-candidates-existing-historical-20260714.json')
const labelledPages = read('private-evidence/truth-labels/20260703-flex-duplicate-accepted-needs-label/handwritten-truth-labelled-pages.json').pages

const captureIdByShortId = new Map(labelledPages.map((page) => [page.captureId.split('-').at(-1), page.captureId]))
const captureIdForPage = (page) => captureIdByShortId.get(String(page?.id || '').replace(/-captured$/, '')) || null
const pageByCapture = new Map(pageRows.map((page) => [captureIdForPage(page), page]).filter(([captureId]) => captureId))
const compactByAnswer = new Map(compact.rows.map((row) => [`${row.captureId}|${row.questionNum}`, row]))

function browserTopThree(page, questionNum) {
  const group = (page?.questionGroups || []).find((row) => Number(row.questionNum) === Number(questionNum))
  const byId = new Map((page?.predictions || []).map((row) => [row.id, row]))
  let combinations = [{ text: '', score: 1 }]
  for (const id of group?.digitBoxIds || []) {
    const candidates = (byId.get(id)?.topK || []).slice(0, 3)
    combinations = combinations.flatMap((combination) => candidates.map((candidate) => ({
      text: combination.text + String(candidate.digit),
      score: combination.score * Number(candidate.confidence || 0),
    })))
  }
  return [...new Set(combinations.sort((a, b) => b.score - a.score).map((row) => row.text))].slice(0, 3)
}

function summarize(rows) {
  const answers = rows.length
  const automaticRows = rows.filter((row) => row.v2Automatic)
  const yellowRows = rows.filter((row) => !row.v2Automatic)
  const scorableYellowRows = yellowRows.filter((row) => row.scorable)
  const local = scorableYellowRows.filter((row) => row.localTruthAvailable).length
  const afterStrong = scorableYellowRows.filter((row) => row.truthAvailableAfterSingleFrameStrong).length
  return {
    answers,
    automatic: automaticRows.length,
    automaticCoveragePct: answers ? Number((100 * automaticRows.length / answers).toFixed(1)) : null,
    automaticCorrect: automaticRows.filter((row) => row.v2Correct).length,
    automaticWrong: automaticRows.filter((row) => !row.v2Correct).length,
    yellow: yellowRows.length,
    scorableYellow: scorableYellowRows.length,
    blankYellow: yellowRows.length - scorableYellowRows.length,
    immediateLocalTruth: local,
    immediateLocalTruthPct: scorableYellowRows.length ? Number((100 * local / scorableYellowRows.length).toFixed(1)) : null,
    afterSingleFrameStrongTruth: afterStrong,
    afterSingleFrameStrongTruthPct: scorableYellowRows.length ? Number((100 * afterStrong / scorableYellowRows.length).toFixed(1)) : null,
    manualEntryNeeded: scorableYellowRows.length - afterStrong,
    singleFrameStrongRequests: scorableYellowRows.length - local,
  }
}

function grouped(rows, keyFor) {
  const output = {}
  for (const key of [...new Set(rows.map(keyFor))]) output[key] = summarize(rows.filter((row) => keyFor(row) === key))
  return output
}

function captureTime(captureId) {
  const match = String(captureId).match(/^(\d{4}-\d{2}-\d{2})_(\d{2})-(\d{2})-(\d{2})/)
  if (!match) return NaN
  return Date.parse(`${match[1]}T${match[2]}:${match[3]}:${match[4]}Z`)
}

function historicalBatches(pages) {
  const batches = []
  for (const page of pages) {
    const previous = batches.at(-1)
    const previousPage = previous?.pages.at(-1)
    const gapMs = previousPage ? captureTime(page.captureId) - captureTime(previousPage.captureId) : Infinity
    const repeatedStart = previous?.layouts.has('sg-g1-lw-07-dot-collections') && page.layoutId === 'sg-g1-lw-07-dot-collections'
    if (!previous || gapMs > 20 * 60 * 1000 || repeatedStart) {
      batches.push({ id: `H${String(batches.length + 1).padStart(2, '0')}`, pages: [], layouts: new Set() })
    }
    batches.at(-1).pages.push(page)
    batches.at(-1).layouts.add(page.layoutId)
  }
  return batches.map((batch) => ({
    id: batch.id,
    pageCount: batch.pages.length,
    captureIds: batch.pages.map((page) => page.captureId),
    layouts: [...batch.layouts],
    completeTenLayoutPacket: batch.pages.length === 10 && batch.layouts.size === 10,
  }))
}

const rows = scored.rows.map((score) => {
  const page = pageByCapture.get(score.captureId)
  const compactRow = compactByAnswer.get(`${score.captureId}|${score.questionNum}`)
  if (!page || (!compactRow && score.truthStatus !== 'blank')) throw new Error(`missing page/compact join for ${score.captureId} Q${score.questionNum}`)
  const currentGroup = (page.questionGroups || []).find((row) => Number(row.questionNum) === Number(score.questionNum))
  if (!currentGroup) throw new Error(`missing current question group for ${score.captureId} Q${score.questionNum}`)
  const browserChoices = browserTopThree(page, score.questionNum)
  const compactChoices = (compactRow?.candidates || []).slice(0, 3).map((row) => String(row.read))
  const immediateChoices = [...new Set([...browserChoices, ...compactChoices])].slice(0, 6)
  const scorable = score.truth !== null && score.truth !== undefined
  const truth = scorable ? String(score.truth) : null
  const currentRead = String(currentGroup.answerText || '').replace(/[^0-9]/g, '') || null
  const currentAutomatic = currentGroup.reviewNeeded !== true
  const currentCorrect = scorable ? currentRead === truth : currentRead === null
  const localTruthAvailable = scorable && immediateChoices.includes(truth)
  const singleFrameStrongEligible = Number(score.largeMinConfidence || 0) >= 0.98
  const afterStrongChoices = localTruthAvailable || !singleFrameStrongEligible
    ? immediateChoices
    : [...new Set([...immediateChoices, String(score.largeRead || '')])].filter(Boolean).slice(0, 7)
  return {
    captureId: score.captureId,
    split: score.split,
    layoutId: score.layoutId,
    family: score.family,
    questionNum: score.questionNum,
    truthStatus: score.truthStatus,
    scorable,
    truth,
    studentMathCorrect: score.studentMathCorrect,
    v2Read: currentRead,
    v2Automatic: currentAutomatic,
    v2Correct: currentCorrect,
    browserChoices,
    compactChoices,
    immediateChoices,
    localTruthAvailable,
    singleFrameStrongRead: score.largeRead,
    singleFrameStrongMinConfidence: score.largeMinConfidence,
    singleFrameStrongEligible,
    afterStrongChoices,
    truthAvailableAfterSingleFrameStrong: scorable && afterStrongChoices.includes(truth),
  }
})

const batches = historicalBatches(labelledPages)
const batchByCapture = new Map(batches.flatMap((batch) => batch.captureIds.map((captureId) => [captureId, batch.id])))
for (const row of rows) row.historicalBatch = batchByCapture.get(row.captureId) || 'unassigned'

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  purpose: 'Historical single-frame stress test of the final local-first review choice policy.',
  answerKeyUsedForRecognition: false,
  answerKeyUsedAsTruth: false,
  limitations: [
    'These 86 pages influenced prior development and are not a prospective test.',
    'Historical scans retain one camera frame, so current three-frame burst consensus cannot be reproduced.',
    'The after-strong result includes only the current strict >=0.98 single-frame display rule; it does not simulate three-frame consensus.',
    'Historical files lack durable student/packet IDs. Chronological batches are reported as scan batches, not asserted student packets.',
    'The compact model trained on the development split. Validation and holdout are the informative compact-choice results.',
    'Seeded-auto-correct truth is weaker than manually labelled truth; the source audit and four visual corrections are preserved in the scored input.',
  ],
  integrity: {
    labelledPages: labelledPages.length,
    currentBrowserReplayPages: pageRows.length,
    scoredAnswers: rows.length,
    joinedPages: new Set(rows.map((row) => row.captureId)).size,
    missingBatchAssignments: rows.filter((row) => row.historicalBatch === 'unassigned').length,
    valid: labelledPages.length === 86 && pageRows.length === 86 && rows.length === 582 && rows.every((row) => row.historicalBatch !== 'unassigned'),
  },
  overall: summarize(rows),
  informativeNonDevelopment: summarize(rows.filter((row) => row.split !== 'development')),
  bySplit: grouped(rows, (row) => row.split),
  byFamily: grouped(rows, (row) => row.family),
  byFamilyNonDevelopment: grouped(rows.filter((row) => row.split !== 'development'), (row) => row.family),
  byLayout: grouped(rows, (row) => row.layoutId),
  byHistoricalBatch: grouped(rows, (row) => row.historicalBatch),
  historicalBatchInventory: batches,
  automaticErrors: rows.filter((row) => row.v2Automatic && !row.v2Correct),
  unresolvedYellowAnswers: rows.filter((row) => row.scorable && !row.v2Automatic && !row.truthAvailableAfterSingleFrameStrong),
  rows,
}

if (!report.integrity.valid) throw new Error(`historical integrity failed: ${JSON.stringify(report.integrity)}`)
const destination = path.join(ROOT, 'private-evidence/reports/v3-local-first-historical-single-frame-20260714.json')
fs.writeFileSync(destination, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({
  destination: path.relative(ROOT, destination),
  integrity: report.integrity,
  overall: report.overall,
  informativeNonDevelopment: report.informativeNonDevelopment,
  bySplit: report.bySplit,
  byFamily: report.byFamily,
  byFamilyNonDevelopment: report.byFamilyNonDevelopment,
  historicalBatches: batches.map(({ id, pageCount, completeTenLayoutPacket }) => ({ id, pageCount, completeTenLayoutPacket })),
  automaticErrors: report.automaticErrors.length,
  unresolvedYellowAnswers: report.unresolvedYellowAnswers.length,
}, null, 2))
