#!/usr/bin/env node

import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadProspectiveSessions } from './evaluate_hybrid_v2_packets.mjs'
import { verifyV3PolicyFreeze } from './freeze_v3_policy.mjs'
import { verifyProspectiveProtocolFreeze } from './freeze_v3_prospective_protocol.mjs'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const KNOWN_TRUTH_STATES = new Set(['value', 'blank', 'erased', 'crossed-out', 'overwritten', 'unreadable'])

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.resolve(ROOT, file), 'utf8'))
}

function sha256(file) {
  return createHash('sha256').update(fs.readFileSync(path.resolve(ROOT, file))).digest('hex')
}

function digits(value) {
  const result = String(value ?? '').replace(/\D/g, '')
  return result && result.length <= 4 ? result : null
}

function truthText(label) {
  if (label?.truthState === 'blank') return 'blank'
  if (label?.truthState !== 'value') return null
  return digits(label.handwrittenTruth)
}

function pct(numerator, denominator) {
  return denominator ? Number((numerator / denominator * 100).toFixed(1)) : null
}

function expectedLayouts(protocol) {
  return new Set(protocol.expectedLayoutIds || [])
}

function layoutFamily(layoutId) {
  const file = path.resolve(ROOT, 'public/layouts', `${layoutId}.json`)
  if (!fs.existsSync(file)) return 'unknown'
  return readJson(path.relative(ROOT, file))?.metadata?.layout_family === 'fact_rows' ? 'row' : 'non-row'
}

function validateTruth(truth, packetId, expectedKeys, allowPrimaryTruth) {
  const issues = []
  if (truth.answerKeyUsedAsTruth !== false) issues.push('truth file does not explicitly reject answer-key truth')
  const packetLabels = (truth.labels || []).filter((label) => label.packetId === packetId)
  const labels = new Map()
  for (const label of packetLabels) {
    const key = `${label.layoutId}|${Number(label.questionNum)}`
    if (labels.has(key)) issues.push(`duplicate truth label ${packetId}|${key}`)
    labels.set(key, label)
    if (!KNOWN_TRUTH_STATES.has(label.truthState)) issues.push(`invalid truth state ${packetId}|${key}`)
    if (label.truthState === 'value' && !digits(label.handwrittenTruth)) issues.push(`invalid handwritten value ${packetId}|${key}`)
    if (label.qaStatus !== 'verified') {
      if (!allowPrimaryTruth || label.qaStatus !== 'primary-labelled') issues.push(`truth not verified ${packetId}|${key}`)
    }
    if (label.qaStatus === 'verified' && (
      !label.primaryLabeler || !label.verificationLabeler || label.primaryLabeler === label.verificationLabeler
    )) issues.push(`verified truth lacks two distinct labelers ${packetId}|${key}`)
  }
  for (const key of expectedKeys) if (!labels.has(key)) issues.push(`missing truth label ${packetId}|${key}`)
  for (const key of labels.keys()) if (!expectedKeys.has(key)) issues.push(`unexpected truth label ${packetId}|${key}`)
  return { labels, issues, verified: packetLabels.length > 0 && packetLabels.every((label) => label.qaStatus === 'verified') }
}

function frozenPromotion(decision, group, rule) {
  if (group.reviewNeeded !== true) return { promoted: false, reason: 'v2-already-automatic' }
  const consensus = decision?.sequenceFrameConsensus
  const read = digits(consensus?.text)
  if (!read) return { promoted: false, reason: 'no-digit-consensus' }
  if (Number(consensus.usableFrameCount) !== Number(rule.requiredUsableFrames)) return { promoted: false, reason: 'usable-frame-count' }
  if (Number(consensus.count) !== Number(rule.requiredMatchingFrames)) return { promoted: false, reason: 'matching-frame-count' }
  if (consensus.tied === true || rule.tiesAllowed === false && consensus.tied !== false) return { promoted: false, reason: 'tie' }
  if (Number(consensus.minConfidence) < Number(rule.minimumVisibleTokenConfidence)) return { promoted: false, reason: 'confidence' }
  return {
    promoted: true,
    read,
    reason: 'frozen-large-reader-three-frame-consensus',
    minVisibleTokenConfidence: Number(consensus.minConfidence),
  }
}

function aggregate(rows) {
  const scorable = rows.filter((row) => row.scorable)
  const automatic = scorable.filter((row) => row.frozenAutomatic)
  const promotions = scorable.filter((row) => row.fallbackPromoted)
  const v2Automatic = scorable.filter((row) => row.v2Automatic)
  return {
    answers: rows.length,
    scorableAnswers: scorable.length,
    ambiguousTruthExcluded: rows.length - scorable.length,
    v2Automatic: v2Automatic.length,
    v2CoveragePct: pct(v2Automatic.length, scorable.length),
    v2AutomaticCorrect: v2Automatic.filter((row) => row.frozenCorrect).length,
    v2AutomaticWrong: v2Automatic.filter((row) => !row.frozenCorrect).length,
    fallbackPromoted: promotions.length,
    fallbackPromotedCorrect: promotions.filter((row) => row.frozenCorrect).length,
    fallbackPromotedWrong: promotions.filter((row) => !row.frozenCorrect).length,
    frozenAutomatic: automatic.length,
    frozenCoveragePct: pct(automatic.length, scorable.length),
    frozenAutomaticCorrect: automatic.filter((row) => row.frozenCorrect).length,
    frozenAutomaticWrong: automatic.filter((row) => !row.frozenCorrect).length,
    manualReview: scorable.length - automatic.length,
    correctCandidateAvailable: scorable.filter((row) => row.candidateReads.includes(row.truthText)).length,
    studentMathCorrect: scorable.filter((row) => row.studentMathCorrect).length,
    studentMathIncorrect: scorable.filter((row) => row.studentMathCorrect === false).length,
  }
}

export function evaluateFrozenProspective({ sessions, truth, plan, candidate, protocol, packetId, allowPrimaryTruth = false }) {
  const issues = []
  const roles = new Map((plan.selected || []).map((entry) => [entry.packetId, entry.role]))
  if (!candidate.prospectiveValidationPackets?.includes(packetId)) issues.push(`${packetId} is not a prospective validation packet`)
  const role = roles.get(packetId)
  if (!role) issues.push(`${packetId} is absent from capture plan`)
  const expected = expectedLayouts(protocol)
  const packetSessions = sessions.filter((session) => session.debug.packetId === packetId)
  const byLayout = new Map()
  for (const session of packetSessions) {
    const layoutId = session.debug.layoutId || session.debug.qrPayload?.template_id
    if (!layoutId) { issues.push(`${session.sessionId} lacks layout identity`); continue }
    if (!byLayout.has(layoutId)) byLayout.set(layoutId, [])
    byLayout.get(layoutId).push(session)
    if (session.debug.captureRole !== role) issues.push(`${session.sessionId} capture role mismatch`)
    if (session.debug.capturePlanSeed !== plan.seed) issues.push(`${session.sessionId} capture-plan seed mismatch`)
    if (!session.successful) issues.push(`${session.sessionId} was not a successful grading session`)
    if (Number(session.burstFrameCount) !== Number(protocol.requiredRetainedFrames)) issues.push(`${session.sessionId} retained-frame count is not ${protocol.requiredRetainedFrames}`)
    if (Number(session.debug.v3Shadow?.frameCount) !== Number(protocol.requiredRetainedFrames)) issues.push(`${session.sessionId} V3 frame count is not ${protocol.requiredRetainedFrames}`)
    if (session.debug.v3Shadow?.status !== 'complete') issues.push(`${session.sessionId} V3 shadow is incomplete`)
    if (session.debug.v3Shadow?.largeModelAvailable !== true) issues.push(`${session.sessionId} large reader unavailable`)
    if ((session.debug.v3AnswerZones || []).length !== (session.debug.answerGroups || []).length) issues.push(`${session.sessionId} answer-zone count mismatch`)
    if (session.debug.manualCorrections && Object.keys(session.debug.manualCorrections).length) issues.push(`${session.sessionId} contains teacher corrections; scorer will not use them`)
  }
  for (const layoutId of expected) {
    const attempts = byLayout.get(layoutId) || []
    if (attempts.length !== 1) issues.push(`${packetId}|${layoutId} has ${attempts.length} sessions; expected exactly one`)
  }
  for (const layoutId of byLayout.keys()) if (!expected.has(layoutId)) issues.push(`${packetId} has unexpected layout ${layoutId}`)

  const selected = [...byLayout.entries()]
    .filter(([layoutId, attempts]) => expected.has(layoutId) && attempts.length === 1 && attempts[0].successful)
    .map(([, attempts]) => attempts[0])
  const expectedTruthKeys = new Set(selected.flatMap((session) => {
    const layoutId = session.debug.layoutId || session.debug.qrPayload?.template_id
    return (session.debug.answerGroups || []).map((group) => `${layoutId}|${Number(group.questionNum ?? group.question_num)}`)
  }))
  const truthValidation = validateTruth(truth, packetId, expectedTruthKeys, allowPrimaryTruth)
  issues.push(...truthValidation.issues)

  const rows = []
  for (const session of selected) {
    const debug = session.debug
    const layoutId = debug.layoutId || debug.qrPayload?.template_id
    const v3 = new Map((debug.v3Shadow?.decisions || []).map((decision) => [Number(decision.questionNum), decision]))
    for (const group of debug.answerGroups || []) {
      const questionNum = Number(group.questionNum ?? group.question_num)
      const label = truthValidation.labels.get(`${layoutId}|${questionNum}`)
      const target = truthText(label)
      const decision = v3.get(questionNum)
      const promotion = frozenPromotion(decision, group, candidate.fallbackRule)
      const v2Read = digits(group.answerText)
      const v2Automatic = group.reviewNeeded !== true
      const frozenRead = v2Automatic ? v2Read : promotion.promoted ? promotion.read : null
      const scorable = target != null
      rows.push({
        packetId,
        role,
        layoutId,
        layoutFamily: layoutFamily(layoutId),
        questionNum,
        truthState: label?.truthState || null,
        truthQaStatus: label?.qaStatus || null,
        truthText: target,
        scorable,
        mathAnswerKey: group.answer ?? null,
        studentMathCorrect: scorable ? digits(group.answer) === target : null,
        v2Read,
        v2Automatic,
        fallbackPromoted: promotion.promoted,
        fallbackReason: promotion.reason,
        fallbackMinVisibleTokenConfidence: promotion.minVisibleTokenConfidence ?? null,
        frozenRead,
        frozenAutomatic: frozenRead != null,
        frozenCorrect: scorable && frozenRead != null ? frozenRead === target : null,
        candidateReads: [...new Set([
          v2Read,
          digits(decision?.sequenceRead),
          digits(decision?.compactRead),
          digits(decision?.sequenceFrameConsensus?.text),
          digits(decision?.compactFrameConsensus?.text),
        ].filter(Boolean))],
        scanSessionId: session.sessionId,
      })
    }
  }

  const byFamily = {
    row: aggregate(rows.filter((row) => row.layoutFamily === 'row')),
    'non-row': aggregate(rows.filter((row) => row.layoutFamily === 'non-row')),
  }
  const overall = aggregate(rows)
  const gate = {
    truthVerified: truthValidation.verified,
    integrityValid: issues.length === 0,
    completePacket: selected.length === expected.size && rows.length === Number(protocol.expectedAnswerCount),
    zeroFrozenAutomaticErrors: overall.frozenAutomaticWrong === 0,
    zeroFallbackPromotionErrors: overall.fallbackPromotedWrong === 0,
    nonRowCoverageAtLeastTarget: Number(byFamily['non-row'].frozenCoveragePct) >= Number(protocol.nonRowCoverageTargetPct),
    nonRowWithinParityPointsOfRow: Number(byFamily['non-row'].frozenCoveragePct) + Number(protocol.maximumNonRowCoverageGapPoints) >= Number(byFamily.row.frozenCoveragePct),
  }
  gate.productionPromotionEligible = Object.values(gate).every(Boolean)
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    packetId,
    role,
    frozenCandidate: candidate.name,
    answerKeyUsedForRecognition: false,
    answerKeyUsedAsTruth: false,
    teacherCorrectionsUsed: false,
    truthStatus: truthValidation.verified ? 'independently-verified' : allowPrimaryTruth ? 'primary-only-provisional' : 'invalid',
    integrity: { valid: issues.length === 0, issues },
    gate,
    capture: { sessionsFound: packetSessions.length, selectedPages: selected.length, expectedPages: expected.size },
    overall,
    byFamily,
    rows,
  }
}

function parseArgs(argv) {
  const options = {
    scanRoot: 'private-evidence/debug-scans',
    plan: 'private-evidence/capture-plans/four-packet-plan.json',
    candidate: 'private-evidence/v3-prospective/nonrow-parity-policy-candidate.json',
    mainFreeze: 'private-evidence/v3-prospective/nonrow-parity-policy-freeze-p08.json',
    protocol: 'private-evidence/v3-prospective/prospective-evaluator-protocol.json',
    protocolFreeze: 'private-evidence/v3-prospective/prospective-evaluator-freeze.json',
    truth: null,
    packet: null,
    out: null,
    allowPrimaryTruth: false,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--scan-root') options.scanRoot = argv[++index]
    else if (value === '--plan') options.plan = argv[++index]
    else if (value === '--candidate') options.candidate = argv[++index]
    else if (value === '--main-freeze') options.mainFreeze = argv[++index]
    else if (value === '--protocol') options.protocol = argv[++index]
    else if (value === '--protocol-freeze') options.protocolFreeze = argv[++index]
    else if (value === '--truth') options.truth = argv[++index]
    else if (value === '--packet') options.packet = argv[++index]
    else if (value === '--out') options.out = argv[++index]
    else if (value === '--allow-primary-truth') options.allowPrimaryTruth = true
    else throw new Error(`unknown argument: ${value}`)
  }
  if (!options.packet || !options.truth || !options.out) throw new Error('--packet, --truth, and --out are required')
  return options
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const mainFreeze = readJson(options.mainFreeze)
  const mainVerification = verifyV3PolicyFreeze(mainFreeze, ROOT)
  if (!mainVerification.valid) throw new Error(`main policy freeze invalid: ${mainVerification.issues.join('; ')}`)
  const protocolFreeze = readJson(options.protocolFreeze)
  const protocolVerification = verifyProspectiveProtocolFreeze(protocolFreeze, ROOT)
  if (!protocolVerification.valid) throw new Error(`prospective protocol freeze invalid: ${protocolVerification.issues.join('; ')}`)
  const protocol = readJson(options.protocol)
  if (protocol.mainPolicyFreezeSha256 !== sha256(options.mainFreeze)) throw new Error('protocol points to a different main policy freeze')
  const report = evaluateFrozenProspective({
    sessions: loadProspectiveSessions(path.resolve(ROOT, options.scanRoot)),
    truth: readJson(options.truth),
    plan: readJson(options.plan),
    candidate: readJson(options.candidate),
    protocol,
    packetId: options.packet,
    allowPrimaryTruth: options.allowPrimaryTruth,
  })
  const destination = path.resolve(ROOT, options.out)
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  fs.writeFileSync(destination, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' })
  console.log(JSON.stringify({ out: options.out, integrity: report.integrity, gate: report.gate, overall: report.overall, byFamily: report.byFamily }, null, 2))
  if (!report.integrity.valid || !report.gate.productionPromotionEligible) process.exitCode = 2
}

const isDirect = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
if (isDirect) main().catch((error) => { console.error(error.message); process.exitCode = 1 })
