#!/usr/bin/env node

// Build a reproducible, key-blind feature inventory for Candidate 3's yellow
// answers. Handwritten truth is joined only after all recognition evidence and
// policy reasons have been extracted, and is used solely for scoring/audit.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const sourceIndex = process.argv.indexOf('--source')
const outIndex = process.argv.indexOf('--out')
const SOURCE = sourceIndex >= 0 ? process.argv[sourceIndex + 1] : 'private-evidence/reports/nonrow-combined-private-candidate-score-20260715.json'
const OUT = outIndex >= 0 ? process.argv[outIndex + 1] : 'private-evidence/reports/candidate3-yellow-inventory-20260715.json'

const read = (relative) => JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'))
const digits = (value) => String(value ?? '').replace(/\D/g, '') || null
const pct = (n, d) => d ? Number((100 * n / d).toFixed(1)) : null

function summarize(items) {
  return {
    answers: items.length,
    browserReadCorrect: items.filter((row) => row.browserReadCorrect).length,
    strongReadCorrect: items.filter((row) => row.strongReadCorrect).length,
    compactReadCorrect: items.filter((row) => row.compactReadCorrect).length,
    ambiguityFlagged: items.filter((row) => row.ambiguityDetected).length,
  }
}

function proposedBrowserEvidence(proposed, predictions) {
  if (!proposed || proposed.length > predictions.length) return []
  const aligned = predictions.slice(-proposed.length)
  return [...proposed].map((character, index) => {
    const probabilities = Array.isArray(aligned[index]?.probs) ? aligned[index].probs : []
    const ordered = probabilities
      .map((probability, digit) => ({ digit, probability: Number(probability || 0) }))
      .sort((a, b) => b.probability - a.probability)
    const rank = ordered.findIndex((choice) => choice.digit === Number(character))
    return {
      digit: Number(character),
      rank: rank < 0 ? null : rank + 1,
      probability: Number(probabilities[Number(character)] || 0),
      browserTopDigit: ordered[0]?.digit ?? null,
      browserTopProbability: Number(ordered[0]?.probability || 0),
    }
  })
}

const score = read(SOURCE)
const debugCache = new Map()
const debugFor = (relative) => {
  if (!debugCache.has(relative)) debugCache.set(relative, read(relative))
  return debugCache.get(relative)
}

// Phase 1: extract only key-blind evidence and identifiers.
const evidenceRows = score.rows
  .filter((row) => row.scorable && !row.automatic)
  .map((row) => {
    const debug = debugFor(row.debugFile)
    const questionNum = Number(row.questionNum)
    const group = (debug.answerGroups || []).find((item) => Number(item.questionNum) === questionNum)
    const decision = (debug.v3Shadow?.decisions || []).find((item) => Number(item.questionNum) === questionNum)
    const promotion = (debug.v3Shadow?.consensusPromotionDecisions || [])
      .find((item) => Number(item.questionNum) === questionNum)
    const alternate = (debug.v3Shadow?.alternateCropReview?.decisions || [])
      .find((item) => Number(item.questionNum) === questionNum)
    if (!group || !decision || !promotion) {
      throw new Error(`Incomplete Candidate 3 evidence for ${row.packetId}|${row.layoutId}|${questionNum}`)
    }
    const byId = new Map((debug.predictions || []).map((item) => [Number(item.id), item]))
    const predictions = (group.digitBoxIds || []).map((id) => byId.get(Number(id))).filter(Boolean)
    const strongRead = digits(decision.sequenceRead)
    const compactRead = digits(decision.compactRead)
    const alternateRead = digits(alternate?.sequenceRead)
    const strongConsensus = decision.sequenceFrameConsensus || null
    const alternateConsensus = alternate?.sequenceFrameConsensus || null
    return {
      packetId: row.packetId,
      pageId: row.pageId,
      layoutId: row.layoutId,
      layoutFamily: row.layoutFamily,
      questionNum,
      answerLength: Number(row.answerLength || digits(row.truthText)?.length || 0),
      debugFile: row.debugFile,
      browserRead: digits(row.readText),
      strongRead,
      compactRead,
      alternateRead,
      policyReason: promotion.reason,
      ambiguityDetected: promotion.ambiguity?.detected === true,
      ambiguityReasons: (promotion.ambiguity?.reasons || []).map((item) => item.reason),
      slotCount: Number(group.digitBoxIds?.length || 0),
      strongConsensus,
      alternateConsensus,
      proposedBrowserEvidence: proposedBrowserEvidence(strongRead, predictions),
      browserPredictions: predictions.map((prediction) => ({
        digitIndex: Number(prediction.digitIndex),
        digit: prediction.digit == null ? null : Number(prediction.digit),
        confidence: Number(prediction.confidence || 0),
        topGap: Number(prediction.topGap || 0),
        reviewNeeded: prediction.reviewNeeded === true,
        robustOverride: prediction.robustOverride || null,
        preprocessTopDigit: prediction.preprocessVoteSummary?.top?.digit ?? null,
        preprocessTopShare: Number(prediction.preprocessVoteSummary?.top?.share || 0),
      })),
    }
  })

// Phase 2: join handwritten truth only after the evidence inventory is fixed.
const truthById = new Map(score.rows.map((row) => [
  `${row.packetId}|${row.layoutId}|${Number(row.questionNum)}`,
  digits(row.truthText),
]))
const rows = evidenceRows.map((row) => {
  const truthText = truthById.get(`${row.packetId}|${row.layoutId}|${row.questionNum}`)
  return {
    ...row,
    truthText,
    browserReadCorrect: row.browserRead === truthText,
    strongReadCorrect: row.strongRead === truthText,
    compactReadCorrect: row.compactRead === truthText,
    alternateReadCorrect: row.alternateRead != null ? row.alternateRead === truthText : null,
  }
})

const reasonNames = [...new Set(rows.map((row) => row.policyReason))].sort()
const layoutNames = [...new Set(rows.map((row) => row.layoutId))].sort()
const packetNames = [...new Set(rows.map((row) => row.packetId))].sort()
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  status: 'retrospective evidence inventory; production unchanged',
  source: SOURCE,
  answerKeyUsedForRecognition: false,
  truthUsedOnlyForScoringAfterEvidenceExtraction: true,
  candidate3: {
    scorableAnswers: Number(score.overall.scorableAnswers),
    automatic: Number(score.overall.automatic),
    coveragePct: Number(score.overall.coveragePct),
    automaticWrong: Number(score.overall.automaticWrong),
    manualReview: Number(score.overall.manualReview),
  },
  yellowSummary: summarize(rows),
  byReason: Object.fromEntries(reasonNames.map((reason) => [reason, summarize(rows.filter((row) => row.policyReason === reason))])),
  byFamily: Object.fromEntries(['row', 'non-row'].map((family) => [family, summarize(rows.filter((row) => row.layoutFamily === family))])),
  byLayout: Object.fromEntries(layoutNames.map((layout) => [layout, summarize(rows.filter((row) => row.layoutId === layout))])),
  byPacket: Object.fromEntries(packetNames.map((packet) => [packet, summarize(rows.filter((row) => row.packetId === packet))])),
  opportunity: {
    compactVetoAnswers: rows.filter((row) => row.policyReason === 'whole-answer-compact-model-does-not-support-consensus').length,
    compactVetoStrongCorrect: rows.filter((row) => row.policyReason === 'whole-answer-compact-model-does-not-support-consensus' && row.strongReadCorrect).length,
    compactVetoStrongWrong: rows.filter((row) => row.policyReason === 'whole-answer-compact-model-does-not-support-consensus' && !row.strongReadCorrect).length,
    browserConflictAnswers: rows.filter((row) => row.policyReason === 'browser-preprocessing-stably-conflicts').length,
    safeMaximumIfKnownCorrectStrongReadsCouldBeSelected: Number(score.overall.automatic) + rows.filter((row) =>
      ['whole-answer-compact-model-does-not-support-consensus', 'browser-preprocessing-stably-conflicts'].includes(row.policyReason) &&
      row.strongReadCorrect).length,
    safeMaximumCoveragePctIfKnownCorrectStrongReadsCouldBeSelected: pct(Number(score.overall.automatic) + rows.filter((row) =>
      ['whole-answer-compact-model-does-not-support-consensus', 'browser-preprocessing-stably-conflicts'].includes(row.policyReason) &&
      row.strongReadCorrect).length, Number(score.overall.scorableAnswers)),
  },
  rows,
}

fs.writeFileSync(path.join(ROOT, OUT), `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ out: OUT, candidate3: report.candidate3, yellowSummary: report.yellowSummary, byReason: report.byReason, opportunity: report.opportunity }, null, 2))
