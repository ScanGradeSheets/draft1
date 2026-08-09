#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

import {
  ACCEPTED_ANSWER_ONE_SEVEN_SCOUT_MIN_PROBABILITY,
  acceptedAnswerSafetyDecision,
  acceptedAnswerSafetyRoute,
} from '../src/v3/accepted-answer-safety.js'

const root = process.cwd()
const reportDir = path.join(root, 'private-evidence/reports')
const source = JSON.parse(fs.readFileSync(path.join(
  reportDir,
  'exact-live-uniform-frame-union-20260723.json',
), 'utf8')).strongestZeroKnownError.rows
const fivePacket = JSON.parse(fs.readFileSync(path.join(
  reportDir,
  'browser-local-co-primary-candidate3-20260724.json',
), 'utf8'))
const historicalEvidence = JSON.parse(fs.readFileSync(path.join(
  reportDir,
  'browser-local-historical-holdout-views-20260724.json',
), 'utf8'))
const safetyRepair = JSON.parse(fs.readFileSync(path.join(
  reportDir,
  'browser-local-co-primary-safety-repair-20260724.json',
), 'utf8'))
const outputPath = path.join(
  reportDir,
  'public-critical-confusion-scout-veto-20260801.json',
)

const layoutDir = path.join(
  root,
  'public/worksheets/grade1-last-week-test-20260617/layouts',
)
const layouts = new Map(fs.readdirSync(layoutDir)
  .filter((name) => name.endsWith('.json'))
  .map((name) => {
    const layout = JSON.parse(fs.readFileSync(path.join(layoutDir, name), 'utf8'))
    return [String(layout.layout_id), layout]
  }))

function slotCount(layoutId, questionNum) {
  const group = layouts.get(String(layoutId))?.question_groups?.find((item) =>
    Number(item.question_num) === Number(questionNum))
  return Array.isArray(group?.digit_box_ids) ? group.digit_box_ids.length : null
}

function summarize(rows, field = 'decision') {
  const automatic = rows.filter((row) => row[field]?.automatic === true)
  const correct = automatic.filter((row) =>
    String(row[field].read) === String(row.scoredTruth))
  return {
    answers: rows.length,
    automatic: automatic.length,
    automaticCoveragePct: Number((100 * automatic.length / rows.length).toFixed(1)),
    automaticCorrect: correct.length,
    automaticAccuracyPct: automatic.length
      ? Number((100 * correct.length / automatic.length).toFixed(3))
      : null,
    confidentErrors: automatic.length - correct.length,
    yellow: rows.length - automatic.length,
  }
}

function applyVeto({ id, packetId, layoutId, questionNum, scoredTruth, baseDecision, scout }) {
  const slots = slotCount(layoutId, questionNum)
  const route = acceptedAnswerSafetyRoute({
    currentAutomatic: baseDecision?.automatic === true,
    currentRead: baseDecision?.read,
    scout,
    predictions: [],
    slotCount: slots,
    layoutId,
    policyScope: 'six-eight-only',
  })
  const veto = acceptedAnswerSafetyDecision({
    routed: route.route,
    currentRead: baseDecision?.read,
    scout,
    predictions: [],
    slotCount: slots,
    layoutId,
    policyScope: 'six-eight-only',
  })
  const decision = veto.veto
    ? {
        ...baseDecision,
        automatic: false,
        reason: veto.reason,
        changedAcceptedRead: false,
        answerKeyUsed: false,
      }
    : baseDecision
  return {
    id,
    packetId,
    layoutId,
    questionNum,
    slotCount: slots,
    scoredTruth,
    scout: {
      read: String(scout?.read ?? scout?.text ?? ''),
      probability: Number(scout?.probability ?? scout?.sequenceProbability ?? 0),
    },
    baseDecision,
    route,
    veto,
    decision,
    changed: decision?.automatic !== baseDecision?.automatic,
  }
}

const sourceById = new Map(source.map((row) => [row.id, row]))
const fiveRows = fivePacket.rows.map((row) => {
  const evidence = sourceById.get(row.id)
  if (!evidence) throw new Error(`missing five-packet evidence ${row.id}`)
  return applyVeto({
    id: row.id,
    packetId: row.packetId,
    layoutId: row.layoutId,
    questionNum: Number(row.id.split('|').at(-1)),
    scoredTruth: row.truthText,
    baseDecision: row.decision,
    scout: {
      read: evidence.evidence.scoutRead,
      probability: evidence.evidence.scoutProbability,
    },
  })
})

const historicalById = new Map(historicalEvidence.rowsDetail
  .map((row) => [row.uid, row]))
const pageByCapture = new Map(historicalEvidence.pageResults
  .map((page) => [page.captureId, page]))
const historicalRows = safetyRepair.historicalRows.map((row) => {
  const detail = historicalById.get(row.id)
  const page = pageByCapture.get(detail?.captureId)
  const liveDecision = page?.decisions?.find((item) =>
    Number(item.questionNum) === Number(detail?.questionNum))
  return applyVeto({
    id: row.id,
    packetId: row.packetId,
    layoutId: row.templateId,
    questionNum: detail?.questionNum,
    scoredTruth: row.scoredTruth,
    baseDecision: row.priorDecision,
    scout: {
      read: liveDecision?.route?.evidence?.scoutRead,
      probability: liveDecision?.route?.evidence?.scoutProbability,
    },
  })
})

const rows = [...fiveRows, ...historicalRows]
const incident = applyVeto({
  id: 'live-20260729-sg-g1-lw-01-question-2',
  packetId: 'prospective-live-incident',
  layoutId: 'sg-g1-lw-01-add-1digit',
  questionNum: 2,
  scoredTruth: null,
  baseDecision: { automatic: true, read: '8', reason: 'public-browser-accepted' },
  scout: { read: '6', probability: 0.939 },
})
const oneSevenSource = sourceById.get('P03|sg-g1-lw-03-sub-1digit|3')
if (!oneSevenSource) throw new Error('missing labelled P03 one/seven target evidence')
const oneSevenIncident = applyVeto({
  id: 'P03|sg-g1-lw-03-sub-1digit|3-prospective-browser-acceptance',
  packetId: 'P03',
  layoutId: 'sg-g1-lw-03-sub-1digit',
  questionNum: 3,
  // Truth is deliberately withheld from both route and decision. It is joined
  // below only to score the completed policy output.
  scoredTruth: null,
  baseDecision: { automatic: true, read: '1', reason: 'public-browser-accepted' },
  scout: {
    read: oneSevenSource.evidence.scoutRead,
    probability: oneSevenSource.evidence.scoutProbability,
  },
})
const changed = rows.filter((row) => row.changed)
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  status: 'key-blind narrow safety replay; prospective incident plus frozen labelled evidence',
  integrity: {
    answerKeyProvidedToDecision: false,
    handwritingTruthProvidedToDecision: false,
    truthJoinedAfterDecision: true,
    acceptedReadReplacementPermitted: false,
  },
  policy: {
    name: 'single-digit-public-critical-confusion-scout-veto-2',
    action: 'preserve the browser read but require yellow review',
    minimumScoutProbabilityByConflict: {
      sixEight: 0.90,
      oneToSeven: ACCEPTED_ANSWER_ONE_SEVEN_SCOUT_MIN_PROBABILITY,
    },
    physicalSlotCount: 1,
    conflictPairs: ['6→8', '8→6', '1→7'],
  },
  baseline: summarize(rows, 'baseDecision'),
  candidate: summarize(rows),
  primary345: {
    baseline: summarize(fiveRows, 'baseDecision'),
    candidate: summarize(fiveRows),
    changedDecisions: fiveRows.filter((row) => row.changed).length,
  },
  historical40: {
    baseline: summarize(historicalRows, 'baseDecision'),
    candidate: summarize(historicalRows),
    changedDecisions: historicalRows.filter((row) => row.changed).length,
    note: 'Contains three unrelated legacy confident errors outside this narrow 6/8 repair.',
  },
  changedKnownDecisions: changed,
  prospectiveIncident: incident,
  oneSevenTarget: {
    ...oneSevenIncident,
    scoredTruthAfterDecision: oneSevenSource.truthText,
    sourceInitialRead: oneSevenSource.initialRead,
    sourceInitiallyAutomatic: oneSevenSource.initiallyAutomatic,
  },
  gate: {
    all385LabelsPresent: rows.length === 385,
    zeroKnownConfidentErrorsPrimary345:
      summarize(fiveRows).confidentErrors === 0,
    noNewHistoricalConfidentErrors:
      summarize(historicalRows).confidentErrors ===
      summarize(historicalRows, 'baseDecision').confidentErrors,
    noKnownCoverageRegression: changed.length === 0,
    incidentDemotedToReview: incident.decision.automatic === false,
    incidentTranscriptionPreserved: incident.decision.read === '8',
    oneSevenTargetDemotedToReview: oneSevenIncident.decision.automatic === false,
    oneSevenTargetTranscriptionPreserved: oneSevenIncident.decision.read === '1',
    oneSevenTargetScoutIndependentRead:
      oneSevenIncident.scout.read === '7' &&
      oneSevenIncident.scout.probability >= ACCEPTED_ANSWER_ONE_SEVEN_SCOUT_MIN_PROBABILITY,
    answerKeyBlind: true,
  },
}

fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({
  output: path.relative(root, outputPath),
  baseline: report.baseline,
  candidate: report.candidate,
  changedKnownDecisions: changed.length,
  prospectiveIncident: {
    automatic: incident.decision.automatic,
    preservedRead: incident.decision.read,
    reason: incident.decision.reason,
  },
  oneSevenTarget: {
    automatic: oneSevenIncident.decision.automatic,
    preservedRead: oneSevenIncident.decision.read,
    scout: oneSevenIncident.scout,
    reason: oneSevenIncident.decision.reason,
  },
  gate: report.gate,
}, null, 2))

if (Object.values(report.gate).some((value) => value !== true)) process.exitCode = 1
