#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const controlPath = path.resolve(ROOT, process.argv[2] || 'private-evidence/reports/consensus-matched-control-four-packet-score-20260714.json')
const candidatePath = path.resolve(ROOT, process.argv[3] || 'private-evidence/reports/consensus-integration-four-packet-score-20260714.json')
const outputPath = path.resolve(ROOT, process.argv[4] || 'private-evidence/reports/consensus-matched-comparison-20260714.json')
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const key = (row) => `${row.packetId}|${row.pageId}|${row.layoutId}|${row.questionNum}`

const control = read(controlPath)
const candidate = read(candidatePath)
const controlByKey = new Map(control.rows.map((row) => [key(row), row]))
const candidateByKey = new Map(candidate.rows.map((row) => [key(row), row]))
const missingFromControl = [...candidateByKey.keys()].filter((item) => !controlByKey.has(item))
const missingFromCandidate = [...controlByKey.keys()].filter((item) => !candidateByKey.has(item))
const diffs = []

for (const [rowKey, before] of controlByKey) {
  const after = candidateByKey.get(rowKey)
  if (!after) continue
  const changed = {
    readText: before.readText !== after.readText,
    automatic: before.automatic !== after.automatic,
    mathCorrect: before.mathCorrect !== after.mathCorrect,
    displayStatus: before.displayStatus !== after.displayStatus,
    annotationReviewCount: before.annotationReviewCount !== after.annotationReviewCount,
  }
  if (Object.values(changed).some(Boolean) || after.promoted) {
    diffs.push({
      key: rowKey,
      packetId: after.packetId,
      pageId: after.pageId,
      layoutId: after.layoutId,
      layoutFamily: after.layoutFamily,
      questionNum: after.questionNum,
      truthText: after.truthText,
      scorable: after.scorable,
      before: {
        readText: before.readText,
        automatic: before.automatic,
        correct: before.correct,
        mathCorrect: before.mathCorrect,
        displayStatus: before.displayStatus,
        annotationReviewCount: before.annotationReviewCount,
      },
      after: {
        readText: after.readText,
        automatic: after.automatic,
        correct: after.correct,
        promoted: after.promoted,
        mathCorrect: after.mathCorrect,
        displayStatus: after.displayStatus,
        annotationReviewCount: after.annotationReviewCount,
      },
      changed,
    })
  }
}

const promotions = diffs.filter((row) => row.after.promoted)
const automaticDemotions = diffs.filter((row) => row.before.automatic && !row.after.automatic)
const preexistingAutomaticChanged = diffs.filter((row) => row.before.automatic && (
  row.changed.readText || row.changed.mathCorrect || row.changed.displayStatus || row.changed.annotationReviewCount
))
const nonPromotionChanges = diffs.filter((row) => !row.after.promoted)
const promotedFromReview = promotions.filter((row) => !row.before.automatic && row.after.automatic)
const promotedCorrect = promotions.filter((row) => !row.scorable || row.after.correct)
const promotedWrong = promotions.filter((row) => row.scorable && !row.after.correct)

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  status: 'matched experimental comparison; production unchanged',
  controlPath: path.relative(ROOT, controlPath),
  candidatePath: path.relative(ROOT, candidatePath),
  answerKeyUsedForRecognition: false,
  truthUsedOnlyForScoringAfterDecisions: true,
  summary: {
    rowsCompared: controlByKey.size,
    controlAutomatic: control.overall.automatic,
    controlCoveragePct: control.overall.coveragePct,
    candidateAutomatic: candidate.overall.automatic,
    candidateCoveragePct: candidate.overall.coveragePct,
    automaticGain: candidate.overall.automatic - control.overall.automatic,
    promotions: promotions.length,
    promotedFromReview: promotedFromReview.length,
    promotedCorrect: promotedCorrect.length,
    promotedWrong: promotedWrong.length,
    automaticDemotions: automaticDemotions.length,
    preexistingAutomaticChanged: preexistingAutomaticChanged.length,
    nonPromotionChanges: nonPromotionChanges.length,
  },
  byFamily: Object.fromEntries(['row', 'non-row'].map((family) => {
    const before = control.byFamily[family]
    const after = candidate.byFamily[family]
    return [family, {
      controlAutomatic: before.automatic,
      controlCoveragePct: before.coveragePct,
      candidateAutomatic: after.automatic,
      candidateCoveragePct: after.coveragePct,
      automaticGain: after.automatic - before.automatic,
      promotedCorrect: promotions.filter((row) => row.layoutFamily === family && row.after.correct).length,
      promotedWrong: promotions.filter((row) => row.layoutFamily === family && row.scorable && !row.after.correct).length,
    }]
  })),
  gates: {
    sameRowSet: missingFromControl.length === 0 && missingFromCandidate.length === 0 && controlByKey.size === candidateByKey.size,
    exactFiftyPromotions: promotions.length === 50,
    everyPromotionCameFromReview: promotedFromReview.length === promotions.length,
    everyScorablePromotionCorrect: promotedWrong.length === 0,
    noAutomaticDemotions: automaticDemotions.length === 0,
    noPreexistingAutomaticOutputChanged: preexistingAutomaticChanged.length === 0,
    noUnexplainedNonPromotionChanges: nonPromotionChanges.length === 0,
    productionChanged: false,
  },
  missingFromControl,
  missingFromCandidate,
  automaticDemotions,
  preexistingAutomaticChanged,
  nonPromotionChanges,
  promotions,
}

fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ output: path.relative(ROOT, outputPath), summary: report.summary, byFamily: report.byFamily, gates: report.gates }, null, 2))
