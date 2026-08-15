#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const reportFiles = (process.env.SG_REPORT_FILES || [
  'private-evidence/reports/browser-local-strict-live-all-saved-webkit-20260723-20260815-current-strict-a.json',
  'private-evidence/reports/browser-local-strict-live-all-saved-webkit-20260723-20260815-current-strict-b.json',
].join(',')).split(',').map((value) => value.trim()).filter(Boolean)
const outputPath = path.join(
  root,
  process.env.SG_OUTPUT_PATH ||
    'private-evidence/reports/current-live-candidate-frontier-20260815.json',
)

const readJson = (relativePath) => JSON.parse(fs.readFileSync(
  path.join(root, relativePath),
  'utf8',
))
const liveReports = reportFiles.map(readJson)
const baselineAuthority = readJson(
  'private-evidence/reports/browser-local-strict-candidate-20260723.json',
)
const candidate7Rows = readJson(
  'private-evidence/reports/browser-local-co-primary-candidate7-20260724.json',
).fivePacketRows
const candidate7ById = new Map(candidate7Rows.map((row) => [row.id, row]))
const authorityByUid = new Map(baselineAuthority.rows.map((row) => {
  const candidate7 = candidate7ById.get(row.uid)
  return [row.uid, {
    ...row,
    truthText: candidate7?.scoredTruth ?? row.truthText,
    baselineDecision: candidate7?.decision ?? row.candidateDecision,
  }]
}))

const pct = (numerator, denominator) => denominator
  ? Number((100 * numerator / denominator).toFixed(1))
  : null
const questionNumber = (uid) => Number(uid.split('|').at(-1))
const decision = (automatic, read, reason) => ({ automatic, read, reason })

const rows = liveReports.flatMap((report) => report.pageResults.flatMap((page) =>
  page.actual.map((actual) => {
    const uid = `${page.packetId}|${page.layoutId}|${actual.questionNum}`
    const authority = authorityByUid.get(uid)
    if (!authority) throw new Error(`Missing authority row for ${uid}`)
    const candidateDecision = page.candidateDecisions?.find((item) =>
      Number(item.questionNum) === Number(actual.questionNum))
    const readerEvidence = page.candidateReaderEvidence?.find((item) =>
      Number(item.questionNum) === Number(actual.questionNum))
    const initial = page.initial.find((item) =>
      Number(item.questionNum) === Number(actual.questionNum))
    return {
      uid,
      packetId: page.packetId,
      layoutId: page.layoutId,
      layoutFamily: authority.layoutFamily,
      truthText: authority.truthText,
      initial,
      baseline: authority.baselineDecision,
      integrated: actual,
      strict: candidateDecision?.strictDecision || actual,
      readerEvidence,
    }
  })))

if (rows.length !== 345 || new Set(rows.map((row) => row.uid)).size !== 345) {
  throw new Error(`Expected 345 unique rows, received ${rows.length}`)
}

function summary(decisions) {
  const evaluated = rows.map((row) => ({ row, decision: decisions(row) }))
  const automatic = evaluated.filter((item) => item.decision?.automatic === true)
  const correct = automatic.filter((item) =>
    String(item.decision.read) === String(item.row.truthText))
  return {
    scorableAnswers: evaluated.length,
    automatic: automatic.length,
    automaticCoveragePct: pct(automatic.length, evaluated.length),
    automaticCorrect: correct.length,
    automaticAccuracyPct: pct(correct.length, automatic.length),
    confidentErrors: automatic.length - correct.length,
    yellow: evaluated.length - automatic.length,
    errorUids: automatic
      .filter((item) => String(item.decision.read) !== String(item.row.truthText))
      .map((item) => item.row.uid),
  }
}

function grouped(decisions, field) {
  return Object.fromEntries([...new Set(rows.map((row) => row[field]))]
    .sort()
    .map((value) => {
      const selected = rows.filter((row) => row[field] === value)
      const automatic = selected
        .map((row) => ({ row, decision: decisions(row) }))
        .filter((item) => item.decision?.automatic === true)
      const correct = automatic.filter((item) =>
        String(item.decision.read) === String(item.row.truthText))
      return [value, {
        scorableAnswers: selected.length,
        automatic: automatic.length,
        automaticCoveragePct: pct(automatic.length, selected.length),
        automaticCorrect: correct.length,
        confidentErrors: automatic.length - correct.length,
        yellow: selected.length - automatic.length,
      }]
    }))
}

function unanimousStrongReader(row, minimumProbability, requireScout = false) {
  const evidence = row.readerEvidence
  const views = [evidence?.stitched, evidence?.continuous, evidence?.uniform]
  if (views.some((view) => !view?.read)) return null
  const reads = views.map((view) => String(view.read))
  if (!reads.every((read) => read === reads[0])) return null
  if (views.some((view) => Number(view.minTokenProbability || 0) < minimumProbability)) {
    return null
  }
  if (requireScout && String(evidence?.scout?.read || '') !== reads[0]) return null
  return reads[0]
}

function yellowRescue({ minimumProbability, rowOnly, requireScout }) {
  return (row) => {
    if (row.baseline?.automatic === true) return row.baseline
    if (rowOnly && row.layoutFamily !== 'row') return row.baseline
    const read = unanimousStrongReader(row, minimumProbability, requireScout)
    return read
      ? decision(true, read, 'yellow-unanimous-strong-reader-rescue')
      : row.baseline
  }
}

const policies = {
  initialBrowserControl: (row) => row.initial,
  historicalFrozenBaseline: (row) => row.baseline,
  currentIntegrated: (row) => row.integrated,
  currentStrictDecision: (row) => row.strict,
  currentIntegratedRowOnly: (row) =>
    row.layoutFamily === 'row' ? row.integrated : row.baseline,
  currentIntegratedAdd2Only: (row) =>
    row.layoutId === 'sg-g1-lw-02-add-2digit' ? row.integrated : row.baseline,
}

function currentInitiallyYellowRescue({ minimumProbability, rowOnly, requireScout }) {
  return (row) => {
    if (row.initial?.automatic === true) return row.integrated
    if (rowOnly && row.layoutFamily !== 'row') return row.integrated
    const read = unanimousStrongReader(row, minimumProbability, requireScout)
    return read
      ? decision(true, read, 'initial-yellow-unanimous-strong-reader-rescue')
      : row.integrated
  }
}
for (const minimumProbability of [0.5, 0.75, 0.9, 0.95, 0.98, 0.99]) {
  for (const rowOnly of [true, false]) {
    for (const requireScout of [true, false]) {
      const name = [
        rowOnly ? 'row' : 'all',
        'yellowUnanimous3',
        `p${String(minimumProbability).replace('.', '')}`,
        requireScout ? 'scoutAgree' : 'noScout',
      ].join('-')
      policies[name] = yellowRescue({ minimumProbability, rowOnly, requireScout })
      policies[`current-${name}`] = currentInitiallyYellowRescue({
        minimumProbability,
        rowOnly,
        requireScout,
      })
    }
  }
}

const policyResults = Object.fromEntries(Object.entries(policies).map(([name, apply]) => [
  name,
  {
    overall: summary(apply),
    byLayoutFamily: grouped(apply, 'layoutFamily'),
    byTemplate: grouped(apply, 'layoutId'),
    byPacket: grouped(apply, 'packetId'),
  },
]))
const zeroErrorFrontier = Object.entries(policyResults)
  .filter(([, result]) => result.overall.confidentErrors === 0)
  .sort((left, right) =>
    right[1].overall.automatic - left[1].overall.automatic)
  .map(([name, result]) => ({ name, ...result.overall }))

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  policyStatus: 'retrospective-research-only-not-deployable',
  purpose:
    'Compare current live WebKit candidate decisions with narrow key-blind yellow-rescue policies on all 345 saved answers.',
  integrity: {
    answerKeyProvidedToDecisionPolicies: false,
    truthUsedOnlyAfterDecisionsForScoring: true,
    existingFrozenAutomaticReadsChangedByYellowRescuePolicies: false,
    all345AnswersPresentExactlyOnce: true,
    sealedPacketsUsed: false,
  },
  reportFiles,
  zeroErrorFrontier,
  policies: policyResults,
  rows: rows.map((row) => ({
    uid: row.uid,
    packetId: row.packetId,
    layoutId: row.layoutId,
    layoutFamily: row.layoutFamily,
    truthText: row.truthText,
    initial: row.initial,
    baseline: row.baseline,
    integrated: row.integrated,
    strict: row.strict,
    readerEvidence: row.readerEvidence,
  })),
}

fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({
  outputPath: path.relative(root, outputPath),
  zeroErrorFrontier,
  baseline: policyResults.historicalFrozenBaseline,
  currentIntegrated: policyResults.currentIntegrated,
  currentIntegratedRowOnly: policyResults.currentIntegratedRowOnly,
  currentIntegratedAdd2Only: policyResults.currentIntegratedAdd2Only,
}, null, 2))
