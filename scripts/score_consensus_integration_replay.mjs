#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const replayRoot = path.resolve(ROOT, process.argv[2] || 'private-evidence/reports/consensus-integration-four-packet-20260714')
const output = path.resolve(ROOT, process.argv[3] || 'private-evidence/reports/consensus-integration-four-packet-score-20260714.json')
const PACKETS = ['P08', 'P03', 'P09', 'P02']
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const digits = (value) => String(value ?? '').replace(/\D/g, '') || null
const pct = (n, d) => d ? Number((100 * n / d).toFixed(1)) : null

const truthReport = read(path.join(ROOT, 'private-evidence/reports/v3-crop-candidate-evaluation-20260714-final.json'))
const truthByKey = new Map(truthReport.rows.map((row) => [`${row.packetId}|${row.layoutId}|${Number(row.questionNum)}`, row]))

function summarize(rows) {
  const scorable = rows.filter((row) => row.scorable)
  const automatic = scorable.filter((row) => row.automatic)
  const promoted = scorable.filter((row) => row.promoted)
  return {
    answers: rows.length,
    scorableAnswers: scorable.length,
    ambiguousTruthExcluded: rows.length - scorable.length,
    automatic: automatic.length,
    coveragePct: pct(automatic.length, scorable.length),
    automaticCorrect: automatic.filter((row) => row.correct).length,
    automaticWrong: automatic.filter((row) => !row.correct).length,
    manualReview: scorable.length - automatic.length,
    promoted: promoted.length,
    promotedCorrect: promoted.filter((row) => row.correct).length,
    promotedWrong: promoted.filter((row) => !row.correct).length,
  }
}

const rows = []
const pageFailures = []
for (const packetId of PACKETS) {
  const packetRoot = path.join(replayRoot, packetId)
  const packetRowsFile = path.join(packetRoot, 'rows.json')
  if (!fs.existsSync(packetRowsFile)) {
    pageFailures.push({ packetId, reason: 'missing-packet-rows' })
    continue
  }
  const pageRows = read(packetRowsFile)
  for (const page of pageRows) {
    if (!page.ok) {
      pageFailures.push({ packetId, pageId: page.id, reason: page.error || 'page-failed' })
      continue
    }
    const debugFile = path.join(packetRoot, 'debug', page.id, 'ocr-debug.json')
    const debug = read(debugFile)
    const promotionByQuestion = new Map((debug.v3Shadow?.consensusApplication?.applied || [])
      .map((item) => [Number(item.questionNum), item]))
    const annotationByQuestion = new Map()
    for (const region of debug.annotationRegions || []) {
      const questionNum = Number(region.questionNum)
      if (!annotationByQuestion.has(questionNum)) annotationByQuestion.set(questionNum, [])
      annotationByQuestion.get(questionNum).push(region)
    }
    for (const group of debug.answerGroups || []) {
      const questionNum = Number(group.questionNum)
      const key = `${packetId}|${debug.layoutId}|${questionNum}`
      const truth = truthByKey.get(key)
      if (!truth) throw new Error(`missing truth ${key}`)
      const truthText = truth.scorable ? digits(truth.truthText) : null
      const readText = digits(group.answerText)
      const automatic = group.reviewNeeded !== true
      const promoted = promotionByQuestion.has(questionNum)
      const regions = annotationByQuestion.get(questionNum) || []
      rows.push({
        packetId,
        pageId: page.id,
        layoutId: debug.layoutId,
        layoutFamily: truth.layoutFamily,
        questionNum,
        answerLength: truthText?.length ?? null,
        truthState: truth.truthState,
        truthText,
        scorable: truthText != null,
        readText,
        automatic,
        correct: truthText != null && readText === truthText,
        promoted,
        promotion: promotionByQuestion.get(questionNum) || null,
        mathCorrect: group.correct,
        displayStatus: group.status,
        annotationRegionCount: regions.length,
        annotationReviewCount: regions.filter((region) => region.reviewNeeded).length,
        annotationConsistent: automatic ? regions.every((region) => region.reviewNeeded !== true) : true,
        markedSheetAvailable: Boolean(debug.markedSheetDataUrl),
        shadowStatus: debug.v3Shadow?.status || null,
        shadowAffectsGrade: debug.v3Shadow?.affectsGrade === true,
        debugFile: path.relative(ROOT, debugFile),
      })
    }
  }
}

const overall = summarize(rows)
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  status: 'experimental browser integration replay; production unchanged',
  answerKeyUsedForRecognition: false,
  answerKeyUsedAsHandwritingTruth: false,
  truthUsedOnlyForScoringAfterDecisions: true,
  pagesExpected: 40,
  pagesCompleted: new Set(rows.map((row) => `${row.packetId}|${row.pageId}`)).size,
  pageFailures,
  overall,
  byFamily: Object.fromEntries(['row', 'non-row'].map((family) => [family, summarize(rows.filter((row) => row.layoutFamily === family))])),
  byPacket: Object.fromEntries(PACKETS.map((packet) => [packet, summarize(rows.filter((row) => row.packetId === packet))])),
  byLayout: Object.fromEntries([...new Set(rows.map((row) => row.layoutId))].sort().map((layout) => [layout, summarize(rows.filter((row) => row.layoutId === layout))])),
  byAnswerLength: Object.fromEntries([1, 2].map((length) => [length, summarize(rows.filter((row) => row.answerLength === length))])),
  wrongAutomaticRows: rows.filter((row) => row.scorable && row.automatic && !row.correct),
  gates: {
    allFortyPagesComplete: pageFailures.length === 0 && new Set(rows.map((row) => `${row.packetId}|${row.pageId}`)).size === 40,
    allTwoHundredEightyAnswersPresent: rows.length === 280,
    zeroObservedAutomaticErrors: overall.automaticWrong === 0,
    allPromotionsCorrect: overall.promotedWrong === 0,
    allAutomaticAnnotationsConsistent: rows.filter((row) => row.automatic).every((row) => row.annotationConsistent),
    allPagesHaveMarkedSheet: rows.every((row) => row.markedSheetAvailable),
    productionChanged: false,
  },
  rows,
}

fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ output: path.relative(ROOT, output), pagesCompleted: report.pagesCompleted, pageFailures, overall, byFamily: report.byFamily, byPacket: report.byPacket, byAnswerLength: report.byAnswerLength, wrongAutomaticRows: report.wrongAutomaticRows, gates: report.gates }, null, 2))
