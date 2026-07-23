#!/usr/bin/env node

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  consensusPromotionDecision as repairedDecision,
  consensusReviewVetoQuestionNums,
} from '../src/v3/consensus-promotion.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_OUT = path.join(ROOT, 'private-evidence/reports/beta7-independent-safety-audit-20260723.json')
const PREDECESSOR_COMMIT = 'b7a5df4'
const HISTORICAL_ROOT = path.join(ROOT, 'private-evidence/reports/stitched-on-demand-review-replay-20260717')
const P05_ROOT = path.join(ROOT, 'private-evidence/reports/p05f-production-determinism-a-20260717')
const FOUR_PACKET_TRUTH = path.join(ROOT, 'private-evidence/reports/v3-crop-candidate-evaluation-20260714-final.json')
const P05_TRUTH = path.join(ROOT, 'private-evidence/reports/p05-strong-evidence-view-benchmark-20260717.json')
const PACKETS = ['P02', 'P03', 'P08', 'P09', 'P05']

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const digits = (value) => {
  const normalized = String(value ?? '').replace(/\D/g, '')
  return normalized || null
}
const pct = (n, d) => d ? Number((100 * n / d).toFixed(1)) : null
const round = (n, places = 4) => Number(Number(n || 0).toFixed(places))
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex')

function walkFiles(root, basename) {
  const out = []
  if (!fs.existsSync(root)) return out
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const file = path.join(root, entry.name)
    if (entry.isDirectory()) out.push(...walkFiles(file, basename))
    else if (entry.isFile() && entry.name === basename) out.push(file)
  }
  return out.sort()
}

function predecessorDecision(inputs) {
  // Candidate 6 (`b7a5df4`) differs from Beta 7 in exactly two decision
  // conditions. Recreate it by removing only those additions, then verify the
  // result against every saved shadow-2 decision before trusting the audit.
  const ambiguityReasons = Array.isArray(inputs?.ambiguity?.reasons)
    ? inputs.ambiguity.reasons
    : []
  const proposed = digits(inputs?.sequenceFrameConsensus?.text ?? inputs?.sequenceFrameConsensus?.read)
  const current = digits(inputs?.currentRead)
  const retainedRival = ambiguityReasons.some((item) => item?.reason === 'override-retained-material-rival')
  const oldRetainedRivalBlocks = retainedRival && proposed === current
  const filteredReasons = oldRetainedRivalBlocks
    ? ambiguityReasons
    : ambiguityReasons.filter((item) => item?.reason !== 'override-retained-material-rival')
  const sanitized = {
    ...inputs,
    currentPredictions: (inputs.currentPredictions || []).map((prediction) => ({
      ...prediction,
      // This flag was not consulted by shadow-2's selector. All other browser
      // evidence is preserved byte-for-byte.
      highRiskPreprocessReview: false,
    })),
    ambiguityDetected: oldRetainedRivalBlocks ||
      filteredReasons.some((item) =>
        item?.reason === 'model-families-disagree' ||
        item?.reason === 'answer-ink-may-be-clipped'),
    ambiguity: inputs.ambiguity ? {
      ...inputs.ambiguity,
      detected: oldRetainedRivalBlocks ||
        filteredReasons.some((item) =>
          item?.reason === 'model-families-disagree' ||
          item?.reason === 'answer-ink-may-be-clipped'),
      reasons: filteredReasons,
    } : null,
  }
  const result = repairedDecision(sanitized)
  return { ...result, policyVersion: 'consensus-promotion-shadow-2' }
}

function layoutFamily(layoutId) {
  return /^sg-g1-lw-0[1-5]-/.test(layoutId || '') ? 'row'
    : /^sg-g1-lw-(0[6-9]|10)-/.test(layoutId || '') ? 'non-row'
      : 'unknown'
}

function consensusForQuestion(review, questionNum) {
  const item = (review?.decisions || []).find((row) => Number(row?.questionNum) === Number(questionNum))
  return item?.sequenceFrameConsensus || null
}

function compactReadsForQuestion(debug, questionNum) {
  const topLevel = Array.isArray(debug.wholeAnswerReviewSuggestions)
    ? debug.wholeAnswerReviewSuggestions.filter((item) => Number(item?.questionNum) === Number(questionNum))
    : []
  const perPrediction = predictionsForQuestion(debug, questionNum)
    .flatMap((prediction) => prediction?.wholeAnswerReviewSuggestions || [])
    .map((item) => ({ questionNum, ...item }))
  const unique = new Map()
  for (const item of [...topLevel, ...perPrediction]) {
    const key = `${digits(item?.text)}|${Number(item?.bestJointProbability || 0)}|${Number(item?.minComponentProbability || 0)}`
    if (!unique.has(key)) unique.set(key, item)
  }
  return [...unique.values()].map((item) => ({
    questionNum,
    read: digits(item?.text),
    meanComponentProbability: Number(item?.bestJointProbability || item?.meanComponentProbability || 0),
    minComponentProbability: Number(item?.minComponentProbability || 0),
    frameIndex: Array.isArray(item?.frameIndices) ? item.frameIndices[0] : item?.frameIndex,
  }))
}

function predictionsForQuestion(debug, questionNum) {
  return (debug.predictions || [])
    .filter((item) => Number(item?.questionNum) === Number(questionNum))
    .sort((a, b) => Number(a?.digitIndex || 0) - Number(b?.digitIndex || 0))
}

function selectedPolicyInputs(debug, shadowDecision, savedDecision) {
  const questionNum = Number(shadowDecision.questionNum)
  const predictions = predictionsForQuestion(debug, questionNum)
  const slotCount = Number(savedDecision?.evidence?.slotCount) ||
    Number(predictions[0]?.slotCount) ||
    Number((debug.answerGroups || []).find((group) => Number(group.questionNum) === questionNum)?.digitBoxIds?.length) ||
    null
  const vetoes = [
    ...(debug.confidenceSafetyVetoes || []),
    ...(debug.confidenceClearanceVetoes || []),
    ...(debug.v3Shadow?.confidenceSafetyVetoes || []),
  ]
  return {
    currentRead: shadowDecision.slotRead,
    currentAutomatic: savedDecision?.reason === 'already-automatic-not-a-promotion-candidate',
    currentPredictions: predictions,
    confidenceSafetyVetoed: vetoes.some((item) => Number(item?.questionNum) === questionNum),
    sequenceFrameConsensus: shadowDecision.sequenceFrameConsensus,
    alternateSequenceFrameConsensus: consensusForQuestion(debug.v3Shadow?.alternateCropReview, questionNum),
    coreCropConsensus: consensusForQuestion(debug.v3Shadow?.coreCropReview, questionNum),
    compactReads: compactReadsForQuestion(debug, questionNum),
    slotCount,
    ambiguityDetected: savedDecision?.ambiguity?.detected === true,
    ambiguity: savedDecision?.ambiguity || null,
  }
}

function applyPolicy({ baseRead, baseAutomatic, decision, displayVeto = false }) {
  if (displayVeto) {
    return {
      read: decision?.promote === true ? digits(decision.automaticText) : baseRead,
      automatic: false,
      reason: 'beta7-display-review-veto',
      promotion: decision?.promote === true,
    }
  }
  if (decision?.promote === true) {
    return {
      read: digits(decision.automaticText),
      automatic: true,
      reason: decision.reason,
      promotion: true,
    }
  }
  return {
    read: baseRead,
    automatic: Boolean(baseAutomatic),
    reason: decision?.reason || null,
    promotion: false,
  }
}

function pageQuality(debug) {
  const coherence = debug.answerBoxRegistration?.coherence || {}
  const residualRatio = Number(coherence.reference) > 0
    ? Number(coherence.maxResidual || 0) / Number(coherence.reference)
    : null
  const anchors = debug.activeHomography?.anchors || debug.warpOrientation?.detectedAnchors || []
  const byId = Object.fromEntries(anchors.map((item) => [item.id, item]))
  const length = (a, b) => a && b ? Math.hypot(a.x - b.x, a.y - b.y) : null
  const top = length(byId.tl, byId.tr)
  const bottom = length(byId.bl, byId.br)
  const left = length(byId.tl, byId.bl)
  const right = length(byId.tr, byId.br)
  const ratios = [
    top && bottom ? Math.max(top, bottom) / Math.min(top, bottom) : null,
    left && right ? Math.max(left, right) / Math.min(left, right) : null,
  ].filter(Number.isFinite)
  const opposingEdgeRatio = ratios.length ? Math.max(...ratios) : null
  let bucket = 'unknown'
  if (coherence.coherent === false || (residualRatio != null && residualRatio > 0.08) || (opposingEdgeRatio != null && opposingEdgeRatio > 1.2)) {
    bucket = 'poor'
  } else if (coherence.coherent === true && residualRatio != null && residualRatio <= 0.03 && opposingEdgeRatio != null && opposingEdgeRatio <= 1.08) {
    bucket = 'good'
  } else if (coherence.coherent === true || residualRatio != null || opposingEdgeRatio != null) {
    bucket = 'fair'
  }
  return {
    bucket,
    registrationCoherent: coherence.coherent ?? null,
    registrationResidualRatio: residualRatio == null ? null : round(residualRatio),
    opposingEdgeRatio: opposingEdgeRatio == null ? null : round(opposingEdgeRatio),
    note: 'Replay-derived geometry bucket; original live focus/luma values were replaced by replay sentinels and are not claimed.',
  }
}

function buildTruth() {
  const truth = new Map()
  const four = readJson(FOUR_PACKET_TRUTH)
  for (const row of four.rows || []) {
    const key = `${row.packetId}|${row.layoutId}|${Number(row.questionNum)}`
    truth.set(key, {
      packetId: row.packetId,
      layoutId: row.layoutId,
      layoutFamily: row.layoutFamily || layoutFamily(row.layoutId),
      questionNum: Number(row.questionNum),
      truthState: row.truthState,
      truthText: row.scorable === false ? null : digits(row.truthText),
      scorable: row.scorable !== false && digits(row.truthText) != null,
      truthSource: path.relative(ROOT, FOUR_PACKET_TRUTH),
      independentlyVerified: row.packetId === 'P02' ? true : null,
    })
  }
  const p05 = readJson(P05_TRUTH)
  for (const row of p05.rows || []) {
    const key = `${row.packetId}|${row.layoutId}|${Number(row.questionNum)}`
    truth.set(key, {
      packetId: row.packetId,
      layoutId: row.layoutId,
      layoutFamily: row.layoutFamily || layoutFamily(row.layoutId),
      questionNum: Number(row.questionNum),
      truthState: 'value',
      truthText: digits(row.truth),
      scorable: digits(row.truth) != null,
      truthSource: path.relative(ROOT, P05_TRUTH),
      independentlyVerified: false,
      truthLimitation: 'Single full-resolution visual handwriting audit; not a two-reader blinded adjudication.',
    })
  }
  return truth
}

function selectedDebugFiles() {
  const out = []
  for (const packetId of ['P02', 'P03', 'P08', 'P09']) {
    out.push(...walkFiles(path.join(HISTORICAL_ROOT, packetId), 'ocr-debug.json'))
  }
  out.push(...walkFiles(P05_ROOT, 'ocr-debug.json'))
  return out
}

function summarize(rows) {
  const scorable = rows.filter((row) => row.scorable)
  const automatic = scorable.filter((row) => row.automatic)
  const correctAll = scorable.filter((row) => row.read === row.truthText)
  const correctAutomatic = automatic.filter((row) => row.read === row.truthText)
  return {
    answers: rows.length,
    scorableAnswers: scorable.length,
    ambiguousTruthExcluded: rows.length - scorable.length,
    transcriptionCorrectAll: correctAll.length,
    transcriptionAccuracyPct: pct(correctAll.length, scorable.length),
    automatic: automatic.length,
    automaticCoveragePct: pct(automatic.length, scorable.length),
    automaticCorrect: correctAutomatic.length,
    automaticAccuracyPct: pct(correctAutomatic.length, automatic.length),
    confidentErrors: automatic.length - correctAutomatic.length,
    yellow: scorable.length - automatic.length,
    yellowRatePct: pct(scorable.length - automatic.length, scorable.length),
  }
}

function grouped(rows, field) {
  const values = [...new Set(rows.map((row) => String(row[field] ?? 'unknown')))].sort()
  return Object.fromEntries(values.map((value) => [
    value,
    {
      predecessor: summarize(rows.filter((row) => String(row[field] ?? 'unknown') === value).map((row) => row.predecessor)),
      beta7: summarize(rows.filter((row) => String(row[field] ?? 'unknown') === value).map((row) => row.beta7)),
    },
  ]))
}

function materialRegressions(groupedReport) {
  const out = []
  for (const [group, result] of Object.entries(groupedReport)) {
    const coverageDelta = Number(result.beta7.automaticCoveragePct || 0) - Number(result.predecessor.automaticCoveragePct || 0)
    const automaticDelta = result.beta7.automatic - result.predecessor.automatic
    if (result.beta7.confidentErrors > result.predecessor.confidentErrors) {
      out.push({ group, reason: 'new-confident-error', coverageDelta, automaticDelta })
    } else if (automaticDelta < -1 && coverageDelta < -5) {
      out.push({ group, reason: 'coverage-regression-over-one-answer-and-five-points', coverageDelta, automaticDelta })
    }
  }
  return out
}

async function main() {
  const outFile = path.resolve(process.argv[2] || DEFAULT_OUT)
  const truth = buildTruth()
  const files = selectedDebugFiles()
  if (files.length !== 50) throw new Error(`Expected 50 canonical sheets, found ${files.length}`)

  const rows = []
  const pages = []
  const duplicateEvidence = new Map()
  let predecessorSavedDecisionMismatches = 0
  let beta7SavedDecisionMismatches = 0
  const predecessorMismatchRows = []
  const beta7MismatchRows = []

  for (const debugFile of files) {
    const debug = readJson(debugFile)
    const packetId = debugFile.includes(`${path.sep}P05${path.sep}`) || debugFile.startsWith(P05_ROOT)
      ? 'P05'
      : debugFile.match(/[/\\](P0[2389])[/\\]/)?.[1]
    if (!packetId) throw new Error(`Cannot infer packet for ${debugFile}`)
    const layoutId = debug.layoutId
    const pageId = path.basename(path.dirname(debugFile))
    const evidenceHash = hash(
      (debug.hybridBurstFrameDataUrls || []).find((item) => String(item || '').length > 1000) ||
      debug.capturedImageDataUrl ||
      debug.warpedDataUrl ||
      fs.readFileSync(debugFile)
    )
    if (!duplicateEvidence.has(evidenceHash)) duplicateEvidence.set(evidenceHash, [])
    duplicateEvidence.get(evidenceHash).push(`${packetId}|${layoutId}`)
    const quality = pageQuality(debug)
    const savedByQuestion = new Map((debug.v3Shadow?.consensusPromotionDecisions || [])
      .map((item) => [Number(item.questionNum), item]))
    const shadowByQuestion = new Map((debug.v3Shadow?.decisions || [])
      .map((item) => [Number(item.questionNum), item]))
    const oldDecisions = []
    const newDecisions = []
    const pageInputs = []

    for (const shadow of debug.v3Shadow?.decisions || []) {
      const questionNum = Number(shadow.questionNum)
      const saved = savedByQuestion.get(questionNum)
      const inputs = selectedPolicyInputs(debug, shadow, saved)
      const oldDecision = predecessorDecision(inputs)
      const newDecision = repairedDecision(inputs)
      oldDecisions.push({ questionNum, ...oldDecision })
      newDecisions.push({ questionNum, ...newDecision })
      pageInputs.push({ questionNum, inputs, saved })
      if (saved?.policyVersion === 'consensus-promotion-shadow-2' &&
          (saved.promote !== oldDecision.promote || digits(saved.automaticText) !== digits(oldDecision.automaticText))) {
        predecessorSavedDecisionMismatches += 1
        predecessorMismatchRows.push({
          uid: `${packetId}|${layoutId}|${questionNum}`,
          saved: { promote: saved.promote, reason: saved.reason, automaticText: saved.automaticText },
          replay: { promote: oldDecision.promote, reason: oldDecision.reason, automaticText: oldDecision.automaticText },
        })
      }
      if (saved?.policyVersion === 'consensus-promotion-shadow-3' &&
          (saved.promote !== newDecision.promote || digits(saved.automaticText) !== digits(newDecision.automaticText))) {
        beta7SavedDecisionMismatches += 1
        beta7MismatchRows.push({
          uid: `${packetId}|${layoutId}|${questionNum}`,
          saved: { promote: saved.promote, reason: saved.reason, automaticText: saved.automaticText },
          replay: { promote: newDecision.promote, reason: newDecision.reason, automaticText: newDecision.automaticText },
        })
      }
    }

    const displayVetoes = new Set(consensusReviewVetoQuestionNums({
      shadowDecisions: debug.v3Shadow?.decisions || [],
      promotionDecisions: newDecisions,
    }))

    for (const item of pageInputs) {
      const { questionNum, inputs } = item
      const key = `${packetId}|${layoutId}|${questionNum}`
      const truthRow = truth.get(key)
      if (!truthRow) throw new Error(`Missing handwritten truth: ${key}`)
      const oldDecision = oldDecisions.find((row) => row.questionNum === questionNum)
      const newDecision = newDecisions.find((row) => row.questionNum === questionNum)
      const baseRead = digits(inputs.currentRead)
      const oldApplied = applyPolicy({
        baseRead,
        baseAutomatic: inputs.currentAutomatic,
        decision: oldDecision,
      })
      const newApplied = applyPolicy({
        baseRead,
        baseAutomatic: inputs.currentAutomatic,
        decision: newDecision,
        displayVeto: displayVetoes.has(questionNum),
      })
      const common = {
        uid: key,
        packetId,
        studentId: packetId,
        pageId,
        layoutId,
        templateId: layoutId,
        layoutFamily: truthRow.layoutFamily,
        questionNum,
        truthState: truthRow.truthState,
        truthText: truthRow.truthText,
        scorable: truthRow.scorable,
        answerLength: truthRow.truthText?.length ?? null,
        captureQuality: quality.bucket,
        truthSource: truthRow.truthSource,
        debugFile: path.relative(ROOT, debugFile),
      }
      rows.push({
        ...common,
        predecessor: { ...common, ...oldApplied },
        beta7: { ...common, ...newApplied },
        changedDecision: oldApplied.read !== newApplied.read || oldApplied.automatic !== newApplied.automatic,
        predecessorDecision: oldDecision,
        beta7Decision: newDecision,
        beta7DisplayVeto: displayVetoes.has(questionNum),
        visualEvidence: {
          capturedImageDataUrlPresent: Boolean(debug.capturedImageDataUrl),
          warpedDataUrlPresent: Boolean(debug.warpedDataUrl),
          rawCropDataUrlCount: (debug.rawCropDataUrls || []).length,
          modelInputDataUrlCount: (debug.modelInputDataUrls || []).length,
          markedSheetDataUrlPresent: Boolean(debug.markedSheetDataUrl),
        },
      })
    }
    pages.push({
      packetId,
      studentId: packetId,
      pageId,
      layoutId,
      layoutFamily: layoutFamily(layoutId),
      captureQuality: quality,
      evidenceHash,
      debugFile: path.relative(ROOT, debugFile),
    })
  }

  const duplicateEvidenceGroups = [...duplicateEvidence.entries()]
    .filter(([, values]) => values.length > 1)
    .map(([evidenceHash, sheets]) => ({ evidenceHash, sheets }))
  const predecessorRows = rows.map((row) => row.predecessor)
  const beta7Rows = rows.map((row) => row.beta7)
  const changedRows = rows.filter((row) => row.changedDecision)
  const confidentErrorRows = rows.filter((row) =>
    (row.predecessor.scorable && row.predecessor.automatic && row.predecessor.read !== row.predecessor.truthText) ||
    (row.beta7.scorable && row.beta7.automatic && row.beta7.read !== row.beta7.truthText))

  const byStudent = grouped(rows, 'studentId')
  const byPacket = grouped(rows, 'packetId')
  const byTemplate = grouped(rows, 'templateId')
  const byLayoutFamily = grouped(rows, 'layoutFamily')
  const byAnswerLength = grouped(rows, 'answerLength')
  const byCaptureQuality = grouped(rows, 'captureQuality')
  const regressions = {
    student: materialRegressions(byStudent),
    packet: materialRegressions(byPacket),
    template: materialRegressions(byTemplate),
    layoutFamily: materialRegressions(byLayoutFamily),
    answerLength: materialRegressions(byAnswerLength),
    captureQuality: materialRegressions(byCaptureQuality),
  }
  const allRegressions = Object.values(regressions).flat()

  const deterministicProjection = (row) => JSON.stringify({
    uid: row.uid,
    predecessor: row.predecessor,
    beta7: row.beta7,
    predecessorDecision: row.predecessorDecision,
    beta7Decision: row.beta7Decision,
    beta7DisplayVeto: row.beta7DisplayVeto,
  })
  const deterministicHashes = rows.map((row) => hash(deterministicProjection(row)))
  const rerunHashes = rows.map((row) => hash(deterministicProjection(row)))

  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    purpose: 'Independent paired replay of frozen Candidate 6 predecessor and Beta 7 safety repair on identical saved evidence.',
    policyIdentity: {
      predecessorCommit: PREDECESSOR_COMMIT,
      predecessorPolicy: 'consensus-promotion-shadow-2',
      repairedPolicy: 'consensus-promotion-shadow-3',
      currentProductionRuntime: 'p05-safety-private-beta-7',
    },
    evidenceBoundary: {
      canonicalSheets: pages.length,
      packets: PACKETS,
      studentsRepresentedByPacketIds: PACKETS,
      totalAnswers: rows.length,
      scorableHandwrittenLabels: beta7Rows.filter((row) => row.scorable).length,
      predeclaredAmbiguousLabelsExcluded: beta7Rows.filter((row) => !row.scorable).length,
      olderLabelledCorpusNotPairReplayable: 374,
      exclusionReason: 'Older records do not preserve the three-frame, whole-answer, compact-reader, and ambiguity inputs required by both policies.',
      mathematicalAnswerKeyUsedAsTruth: false,
      truthJoinedAfterKeyBlindDecisions: true,
      p05TruthLimitation: 'P05 labels are from one full-resolution visual audit, not blinded two-reader adjudication.',
      duplicateEvidenceGroups,
    },
    predecessor: summarize(predecessorRows),
    beta7: summarize(beta7Rows),
    delta: {
      transcriptionCorrectAll: summarize(beta7Rows).transcriptionCorrectAll - summarize(predecessorRows).transcriptionCorrectAll,
      automatic: summarize(beta7Rows).automatic - summarize(predecessorRows).automatic,
      automaticCoveragePoints: round(Number(summarize(beta7Rows).automaticCoveragePct) - Number(summarize(predecessorRows).automaticCoveragePct), 1),
      confidentErrors: summarize(beta7Rows).confidentErrors - summarize(predecessorRows).confidentErrors,
      yellow: summarize(beta7Rows).yellow - summarize(predecessorRows).yellow,
    },
    byStudent,
    byPacket,
    byTemplate,
    byLayoutFamily,
    byAnswerLength,
    byCaptureQuality,
    changedDecisionCount: changedRows.length,
    confidentErrorCountEitherPolicy: confidentErrorRows.length,
    changedRows,
    confidentErrorRows,
    pages,
    integrity: {
      predecessorSavedDecisionMismatches,
      beta7SavedDecisionMismatches,
      predecessorMismatchRows,
      beta7MismatchRows,
      duplicateEvidenceGroupCount: duplicateEvidenceGroups.length,
      deterministicIdenticalInput: deterministicHashes.every((item, index) => item === rerunHashes[index]),
      deterministicRowCount: deterministicHashes.length,
      answerKeyFieldsPassedToPolicy: false,
      truthFieldsPassedToPolicy: false,
    },
    materialRegressionDefinition: 'A stratum fails if Beta 7 adds a confident error, or loses more than one automatic answer and more than five coverage points. A deliberate one-answer safety demotion is not material.',
    materialRegressions: regressions,
    gate: {
      everyCanonicalSheetPresent: pages.length === 50,
      everyExpectedAnswerPresent: rows.length === 350,
      noDuplicateSelectedEvidence: duplicateEvidenceGroups.length === 0,
      predecessorReplayMatchesSavedDecisions: predecessorSavedDecisionMismatches === 0,
      beta7ReplayMatchesSavedDecisions: beta7SavedDecisionMismatches === 0,
      deterministicIdenticalInput: deterministicHashes.every((item, index) => item === rerunHashes[index]),
      zeroKnownBeta7ConfidentErrors: summarize(beta7Rows).confidentErrors === 0,
      noMaterialRegression: allRegressions.length === 0,
      pass: false,
    },
    rows,
  }
  report.gate.pass = Object.entries(report.gate)
    .filter(([key]) => key !== 'pass')
    .every(([, value]) => value === true)

  fs.mkdirSync(path.dirname(outFile), { recursive: true })
  fs.writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify({
    output: path.relative(ROOT, outFile),
    evidenceBoundary: report.evidenceBoundary,
    predecessor: report.predecessor,
    beta7: report.beta7,
    delta: report.delta,
    changedDecisionCount: report.changedDecisionCount,
    confidentErrorCountEitherPolicy: report.confidentErrorCountEitherPolicy,
    changedRows: report.changedRows.map((row) => ({
      uid: row.uid,
      truth: row.truthText,
      predecessor: { read: row.predecessor.read, automatic: row.predecessor.automatic, reason: row.predecessor.reason },
      beta7: { read: row.beta7.read, automatic: row.beta7.automatic, reason: row.beta7.reason },
      beta7DisplayVeto: row.beta7DisplayVeto,
      debugFile: row.debugFile,
    })),
    confidentErrorRows: report.confidentErrorRows.map((row) => ({
      uid: row.uid,
      truth: row.truthText,
      predecessor: { read: row.predecessor.read, automatic: row.predecessor.automatic },
      beta7: { read: row.beta7.read, automatic: row.beta7.automatic },
      debugFile: row.debugFile,
    })),
    integrity: report.integrity,
    materialRegressions: report.materialRegressions,
    gate: report.gate,
  }, null, 2))
}

await main()
