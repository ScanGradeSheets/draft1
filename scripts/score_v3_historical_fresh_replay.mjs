#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.resolve(ROOT, file), 'utf8'))
}

function digits(value) {
  const raw = String(value ?? '').trim().toLowerCase()
  if (raw === 'blank') return 'blank'
  const result = raw.replace(/\D/g, '')
  return result && result.length <= 4 ? result : null
}

function pct(numerator, denominator) {
  return denominator ? Number((numerator / denominator * 100).toFixed(1)) : null
}

function aggregate(rows) {
  const automatic = rows.filter((row) => row.v2Automatic)
  const review = rows.filter((row) => !row.v2Automatic)
  const highLarge = review.filter((row) => row.largeRead && row.largeMinConfidence >= .70)
  const agreement = review.filter((row) => row.largeRead && row.largeRead === row.compactRead)
  const highAgreement = agreement.filter((row) => row.largeMinConfidence >= .70 && row.compactMinConfidence >= .70)
  return {
    answers: rows.length,
    v2Automatic: automatic.length,
    v2CoveragePct: pct(automatic.length, rows.length),
    v2AutomaticCorrect: automatic.filter((row) => row.v2Correct).length,
    v2AutomaticWrong: automatic.filter((row) => !row.v2Correct).length,
    largeCorrectAll: rows.filter((row) => row.largeCorrect).length,
    largeAccuracyPct: pct(rows.filter((row) => row.largeCorrect).length, rows.length),
    compactCorrectAll: rows.filter((row) => row.compactCorrect).length,
    compactAccuracyPct: pct(rows.filter((row) => row.compactCorrect).length, rows.length),
    correctCandidateAvailable: rows.filter((row) => row.candidateReads.includes(row.truth)).length,
    correctCandidateAvailabilityPct: pct(rows.filter((row) => row.candidateReads.includes(row.truth)).length, rows.length),
    diagnosticHighConfidenceLargeOnV2Review: highLarge.length,
    diagnosticHighConfidenceLargeCorrect: highLarge.filter((row) => row.largeCorrect).length,
    diagnosticHighConfidenceLargeWrong: highLarge.filter((row) => !row.largeCorrect).length,
    diagnosticLargeCompactAgreementOnV2Review: agreement.length,
    diagnosticLargeCompactAgreementCorrect: agreement.filter((row) => row.largeCorrect).length,
    diagnosticLargeCompactAgreementWrong: agreement.filter((row) => !row.largeCorrect).length,
    diagnosticHighConfidenceAgreementOnV2Review: highAgreement.length,
    diagnosticHighConfidenceAgreementCorrect: highAgreement.filter((row) => row.largeCorrect).length,
    diagnosticHighConfidenceAgreementWrong: highAgreement.filter((row) => !row.largeCorrect).length,
    studentMathCorrect: rows.filter((row) => row.studentMathCorrect).length,
    studentMathWrong: rows.filter((row) => row.studentMathCorrect === false).length,
  }
}

function main() {
  const replayDir = process.argv[2] || 'private-evidence/reports/v3-historical-fresh-replay-20260713'
  const out = process.argv[3] || 'private-evidence/reports/v3-historical-fresh-replay-20260713-score.json'
  const correctionsFile = process.argv[4] || null
  const manifest = readJson('private-evidence/v3/live-continuous-answer-zones-manifest.json')
  const replay = readJson(path.join(replayDir, 'rows.json'))
  const corrections = correctionsFile ? readJson(correctionsFile).corrections || [] : []
  const correctionsByKey = new Map(corrections.map((entry) => [`${entry.captureId}|${Number(entry.questionNum)}`, entry]))
  const truthByKey = new Map((manifest.entries || []).map((entry) => [`${entry.captureId}|${entry.questionNum}`, entry]))
  const rows = []
  const issues = []
  for (const page of replay) {
    if (!page.ok) { issues.push(`${page.id} failed replay: ${page.error || 'unknown'}`); continue }
    const captureId = path.basename(path.dirname(page.file))
    const decisions = new Map((page.v3Shadow?.decisions || []).map((decision) => [Number(decision.questionNum), decision]))
    for (const group of page.questionGroups || []) {
      const questionNum = Number(group.questionNum ?? group.question_num)
      const entry = truthByKey.get(`${captureId}|${questionNum}`)
      if (!entry) { issues.push(`missing truth ${captureId}|${questionNum}`); continue }
      const decision = decisions.get(questionNum)
      const correction = correctionsByKey.get(`${captureId}|${questionNum}`)
      if (correction && digits(entry.truth) !== digits(correction.from)) {
        issues.push(`correction source mismatch ${captureId}|${questionNum}: expected ${correction.from}, found ${entry.truth}`)
      }
      const truth = digits(correction?.to ?? entry.truth)
      const v2Read = digits(group.answerText)
      const largeRead = digits(decision?.sequenceRead)
      const compactRead = digits(decision?.compactRead)
      const answerKey = digits(group.answer)
      rows.push({
        captureId,
        split: entry.split,
        truthStatus: entry.truthStatus,
        truthCorrection: correction || null,
        layoutId: page.layoutId,
        family: /^sg-g1-lw-0[1-5]-/.test(page.layoutId) ? 'row' : 'non-row',
        questionNum,
        truth,
        answerKey,
        studentMathCorrect: answerKey === truth,
        v2Read,
        v2Automatic: group.reviewNeeded !== true,
        v2Correct: v2Read === truth,
        largeRead,
        largeMinConfidence: Number(decision?.sequenceFrameConsensus?.minConfidence || 0),
        largeCorrect: largeRead === truth,
        compactRead,
        compactMinConfidence: Number(decision?.compactFrameConsensus?.minConfidence || 0),
        compactCorrect: compactRead === truth,
        candidateReads: [...new Set([v2Read, largeRead, compactRead].filter(Boolean))],
      })
    }
  }
  if (rows.length !== manifest.entries.length) issues.push(`matched ${rows.length}/${manifest.entries.length} truth entries`)
  const byLayout = Object.fromEntries([...new Set(rows.map((row) => row.layoutId))].sort().map((layoutId) => [
    layoutId,
    aggregate(rows.filter((row) => row.layoutId === layoutId)),
  ]))
  const bySplit = Object.fromEntries([...new Set(rows.map((row) => row.split))].sort().map((split) => [
    split,
    aggregate(rows.filter((row) => row.split === split)),
  ]))
  const byTruthStatus = Object.fromEntries([...new Set(rows.map((row) => row.truthStatus))].sort().map((status) => [
    status,
    aggregate(rows.filter((row) => row.truthStatus === status)),
  ]))
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    purpose: 'Historical, development-influenced fresh-zone stress test; not prospective proof and not the three-frame frozen rule.',
    answerKeyUsedForRecognition: false,
    answerKeyUsedAsTruth: false,
    truthCorrectionsFile: correctionsFile,
    truthCorrectionCount: corrections.length,
    limitations: [
      'Historical corpus influenced prior development and threshold choices.',
      'Most pages retain only one captured frame, so 3-of-3 safety coverage cannot be measured.',
      'Seeded-auto-correct truth entries are weaker than manually transcribed entries and are reported separately.',
    ],
    integrity: { valid: issues.length === 0, issues },
    overall: aggregate(rows),
    byFamily: {
      row: aggregate(rows.filter((row) => row.family === 'row')),
      'non-row': aggregate(rows.filter((row) => row.family === 'non-row')),
    },
    byLayout,
    bySplit,
    byTruthStatus,
    rows,
  }
  fs.mkdirSync(path.dirname(path.resolve(ROOT, out)), { recursive: true })
  fs.writeFileSync(path.resolve(ROOT, out), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' })
  console.log(JSON.stringify({ out, integrity: report.integrity, overall: report.overall, byFamily: report.byFamily, byTruthStatus: report.byTruthStatus }, null, 2))
  if (!report.integrity.valid) process.exitCode = 2
}

try { main() } catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
