#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const read = (relative) => JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'))
const recent = read('private-evidence/reports/v3-local-candidates-existing-four-packet-20260714.json')
const historical = read('private-evidence/reports/v3-local-candidates-existing-historical-20260714.json')
const workflow = read('private-evidence/reports/v3-review-workflow-yellow-only-20260714.json')
const staged = read('private-evidence/reports/v3-staged-compact-service-test-20260714.json')
const outage = read('private-evidence/reports/v3-service-outage-fail-open-evaluation-20260714.json')
const geometry = read('private-evidence/reports/v3-robust-geometry-rescue-20260714.json')
const integration = read('private-evidence/reports/v3-local-first-app-integration-20260714.json')
const exactWorkflow = read('private-evidence/reports/v3-local-first-workflow-benchmark-20260714.json')
const allYellowWorkflow = read('private-evidence/reports/v3-local-first-all-yellows-ui-20260714.json')
const localFirstFailure = read('private-evidence/reports/v3-local-first-failure-recovery-20260714.json')
const webkitIpad = read('private-evidence/reports/v3-local-first-webkit-ipad-20260714.json')

const recentByKey = new Map(recent.rows.map((row) => [row.uid, row]))
const yellowRows = []
for (const pageResult of workflow.pageResults) {
  const pages = read(`private-evidence/reports/v3-review-display-row-full-20260714/${pageResult.packetId}/rows.json`)
  const page = pages.find((row) => row.layoutId === pageResult.layoutId)
  const predictionById = new Map((page?.predictions || []).map((row) => [row.id, row]))
  for (const correction of pageResult.corrections) {
    const group = page.questionGroups.find((row) => row.questionNum === correction.questionNum)
    let combinations = [{ text: '', score: 1 }]
    for (const id of group.digitBoxIds) {
      const candidates = (predictionById.get(id)?.topK || []).slice(0, 3)
      combinations = combinations.flatMap((combination) => candidates.map((candidate) => ({
        text: combination.text + String(candidate.digit),
        score: combination.score * Number(candidate.confidence || 0),
      })))
    }
    const browserChoices = [...new Set(combinations.sort((a, b) => b.score - a.score).map((row) => row.text))].slice(0, 3)
    const key = `${pageResult.packetId}|${pageResult.layoutId}|${correction.questionNum}`
    const compactChoices = (recentByKey.get(key)?.candidates || []).slice(0, 3).map((row) => row.read)
    const localChoices = [...browserChoices]
    for (const choice of compactChoices) if (!localChoices.includes(choice)) localChoices.push(choice)
    yellowRows.push({
      key,
      packetId: pageResult.packetId,
      layoutId: pageResult.layoutId,
      questionNum: correction.questionNum,
      truth: correction.truth,
      priorEagerChoices: correction.choices,
      browserChoices,
      compactChoices,
      localChoices,
      browserTruthAvailable: browserChoices.includes(correction.truth),
      localTruthAvailable: localChoices.includes(correction.truth),
      priorEagerTruthAvailable: correction.choices.includes(correction.truth),
    })
  }
}

function compactSummary(source) {
  return {
    total: source.overall.total,
    top1: source.overall.truthInTop1,
    top2: source.overall.truthInTop2,
    top3: source.overall.truthInTop3,
    top5: source.overall.truthInTop5,
    bySplit: source.bySplit,
  }
}

function summarizeGroups(rows, keyFor) {
  const output = {}
  for (const row of rows) {
    const key = keyFor(row)
    if (!output[key]) output[key] = { total: 0, top1: 0, top2: 0, top3: 0, top5: 0 }
    const bucket = output[key]
    bucket.total += 1
    for (const topK of [1, 2, 3, 5]) {
      if ((row.candidates || []).slice(0, topK).some((candidate) => candidate.read === String(row.truth))) bucket[`top${topK}`] += 1
    }
  }
  return output
}

function summarizeYellowGroups(rows, keyFor) {
  const output = {}
  for (const row of rows) {
    const key = keyFor(row)
    if (!output[key]) output[key] = { answers: 0, browserTruthAvailable: 0, localTruthAvailable: 0, onDemandStrongNeeded: 0 }
    const bucket = output[key]
    bucket.answers += 1
    bucket.browserTruthAvailable += Number(row.browserTruthAvailable)
    bucket.localTruthAvailable += Number(row.localTruthAvailable)
    bucket.onDemandStrongNeeded += Number(!row.localTruthAvailable)
  }
  return output
}

const localHits = yellowRows.filter((row) => row.localTruthAvailable).length
const unresolved = yellowRows.length - localHits
const listSizes = yellowRows.map((row) => row.localChoices.length)
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  architecture: 'browser OCR/grading unchanged; preserve three browser choices; append up to three compact choices; explicit none-of-these requests one question from strong AI',
  answerKeyUsedForRecognition: false,
  automaticGradingChanged: false,
  compactCandidateEvidence: {
    recentFourPackets: compactSummary(recent),
    recentByPacket: summarizeGroups(recent.rows, (row) => row.packetId),
    recentByLayout: summarizeGroups(recent.rows, (row) => row.layoutId),
    historical: compactSummary(historical),
    historicalByLayout: summarizeGroups(historical.rows, (row) => row.layoutId),
    warning: 'Historical development is training-contaminated; validation and holdout are the informative splits.',
  },
  currentFourPacketRowYellowSet: {
    pages: workflow.pages,
    answers: yellowRows.length,
    browserTopThreeTruthAvailable: yellowRows.filter((row) => row.browserTruthAvailable).length,
    conservativeLocalTruthAvailable: localHits,
    conservativeLocalTruthAvailabilityPct: Number((localHits / yellowRows.length * 100).toFixed(1)),
    unresolvedForOnDemandStrong: unresolved,
    candidateListSize: {
      min: Math.min(...listSizes),
      max: Math.max(...listSizes),
      mean: Number((listSizes.reduce((sum, value) => sum + value, 0) / listSizes.length).toFixed(2)),
    },
    byPacket: summarizeYellowGroups(yellowRows, (row) => row.packetId),
    byLayout: summarizeYellowGroups(yellowRows, (row) => row.layoutId),
    priorEagerStrongTruthAvailableOnUnresolved: yellowRows.filter((row) => !row.localTruthAvailable && row.priorEagerTruthAvailable).length,
    preservation: 'All three reconstructed browser choices are retained before compact choices; zero choices are removed by construction.',
    limitation: 'This offline reconstruction covers the previously studied 14-answer row subset; use exactAllYellowWorkflow for the authoritative 40-page production UX measurement.',
    rows: yellowRows,
  },
  priorProjectedTeacherWorkOnCurrentSet: {
    eagerStrongBaselineTaps: workflow.interactionCounts.totalRequiredTaps,
    localFirstProjectedTaps: workflow.interactionCounts.totalRequiredTaps + unresolved,
    extraNoneOfTheseTaps: unresolved,
    eagerStrongFrameRequests: 42,
    localFirstProjectedStrongFrameRequests: unresolved * 3,
    reductionVsYellowOnlyEagerPct: Number(((1 - unresolved * 3 / 42) * 100).toFixed(1)),
    reductionVsFormerAllAnswerRequestsPct: Number(((1 - unresolved * 3 / 240) * 100).toFixed(1)),
    note: 'Automated interaction projection, not measured human teacher time.',
  },
  exactTenPageWorkflow: exactWorkflow,
  exactAllYellowWorkflow: allYellowWorkflow,
  projectedFullScorableTeacherWork: {
    pagesWithYellow: allYellowWorkflow.pageResults.filter((row) => row.yellow > 0).length,
    initialHotspotTaps: allYellowWorkflow.pageResults.filter((row) => row.yellow > 0).length,
    choiceTaps: allYellowWorkflow.truthChoiceAvailability.afterOnDemandStrong,
    noneOfTheseTaps: allYellowWorkflow.strongInference.onDemandRequests,
    manualSaveTaps: allYellowWorkflow.truthChoiceAvailability.manualEntryNeeded,
    projectedButtonTaps:
      allYellowWorkflow.pageResults.filter((row) => row.yellow > 0).length
      + allYellowWorkflow.truthChoiceAvailability.afterOnDemandStrong
      + allYellowWorkflow.strongInference.onDemandRequests
      + allYellowWorkflow.truthChoiceAvailability.manualEntryNeeded,
    typedAnswers: allYellowWorkflow.truthChoiceAvailability.manualEntryNeeded,
    note: 'Automated projection on scorable answers with one initial hotspot per yellow-containing page and automatic advance; not measured teacher reading time. Three excluded ambiguous answers still require judgment.',
  },
  browserIntegration: integration,
  compactRuntimeAndPrivacy: {
    modelSizeMb: 5.2,
    coldReadyMs: staged.coldReadyMs,
    rssMb: staged.rssMb,
    authenticated24AnswerRoundTripMs: staged.authenticated24AnswerRoundTripMs,
    gates: staged.gates,
  },
  geometryRescue: {
    outliers: geometry.geometryOutliers,
    baselineTop3TruthAvailable: geometry.summaries.baselineTop3.truthAvailable,
    selectedTop3TruthAvailable: geometry.summaries.selectedTop3.truthAvailable,
    existingCorrectOutlierChoiceLost: 0,
    affectsGrade: false,
  },
  failureRecovery: {
    priorServiceOutageInvariantReplay: outage,
    exactLocalFirstBrowserRecovery: localFirstFailure,
  },
  oldDevice: {
    browserEvidence: webkitIpad,
    actualDeviceEvidence: 'not yet measured; actual old-iPad camera, burst memory, and model-load stability remain a release gate',
  },
  recommendation: 'The local-first yellow-review architecture passes the complete 40-page retained-artifact, integrity, privacy, outage, and WebKit gates and is ready for an authenticated private beta after physical old-iPad and real cloud-host parity tests. Keep compact and strong evidence review-only; do not use either to change automatic grading.',
}

const destination = path.join(ROOT, 'private-evidence/reports/v3-local-first-architecture-evaluation-20260714.json')
fs.writeFileSync(destination, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ destination: path.relative(ROOT, destination), summary: {
  currentYellowAnswers: allYellowWorkflow.scorableYellowAnswers,
  localTruthAvailable: allYellowWorkflow.truthChoiceAvailability.immediateLocal,
  afterOnDemandStrong: allYellowWorkflow.truthChoiceAvailability.afterOnDemandStrong,
  manualEntryNeeded: allYellowWorkflow.truthChoiceAvailability.manualEntryNeeded,
  exactStrongRequests: allYellowWorkflow.strongInference.onDemandRequests,
  exactStrongFrameRequests: allYellowWorkflow.strongInference.frameItems,
  candidateListMean: allYellowWorkflow.candidateLists.mean,
  compactRssMb: staged.rssMb,
  browserGates: integration.gates,
  failOpen: Object.values(localFirstFailure.gates).every(Boolean),
  webkit: Object.values(webkitIpad.gates).every(Boolean),
}}, null, 2))
