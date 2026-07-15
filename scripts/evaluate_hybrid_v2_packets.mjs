#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const VALUE_STATES = new Set(['value', 'blank'])
const KNOWN_TRUTH_STATES = new Set(['value', 'blank', 'erased', 'crossed-out', 'overwritten', 'unreadable'])

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function walkFiles(root, filename, output = []) {
  if (!fs.existsSync(root)) return output
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const resolved = path.join(root, entry.name)
    if (entry.isDirectory()) walkFiles(resolved, filename, output)
    else if (entry.isFile() && entry.name === filename) output.push(resolved)
  }
  return output
}

function normalizedRead(value) {
  const raw = String(value ?? '').trim().toLowerCase()
  if (raw === 'blank' || raw === '') return 'blank'
  const digits = raw.replace(/\D/g, '')
  return digits && digits.length <= 4 ? digits : null
}

function normalizedTruth(label) {
  if (label.truthState === 'blank') return 'blank'
  if (label.truthState !== 'value') return null
  const digits = String(label.handwrittenTruth ?? '').replace(/\D/g, '')
  return digits && digits.length <= 4 ? digits : null
}

function roleByPacket(plan) {
  return new Map((plan.selected || []).map((row) => [row.packetId, row.role]))
}

export function validateTruthFile(truth, plan) {
  const issues = []
  const roles = roleByPacket(plan)
  const seen = new Set()
  for (const [index, label] of (truth.labels || []).entries()) {
    const key = `${label.packetId}|${label.layoutId}|${Number(label.questionNum)}`
    if (seen.has(key)) issues.push(`duplicate truth label ${key}`)
    seen.add(key)
    if (!roles.has(label.packetId)) issues.push(`truth label ${index} has packet outside capture plan`)
    if (!label.layoutId || !Number.isInteger(Number(label.questionNum))) issues.push(`truth label ${index} lacks layout/question identity`)
    if (!KNOWN_TRUTH_STATES.has(label.truthState)) issues.push(`truth label ${key} has unknown truthState`)
    if (label.qaStatus !== 'verified') issues.push(`truth label ${key} is not independently verified`)
    if (!label.primaryLabeler || !label.verificationLabeler || label.primaryLabeler === label.verificationLabeler) {
      issues.push(`truth label ${key} lacks two distinct labelers`)
    }
    if (VALUE_STATES.has(label.truthState) && normalizedTruth(label) == null) issues.push(`truth label ${key} has invalid transcription target`)
  }
  if (!Array.isArray(truth.labels) || !truth.labels.length) issues.push('truth file has no labels')
  return issues
}

export function loadProspectiveSessions(scanRoot) {
  const versions = walkFiles(scanRoot, 'debug.json').map((file) => {
    const wrapper = readJson(file)
    const debug = wrapper.debug || wrapper
    const scanDir = path.dirname(file)
    const summaryPath = path.join(scanDir, 'summary.json')
    const summary = fs.existsSync(summaryPath) ? readJson(summaryPath) : {}
    return {
      file,
      scanDir,
      scanId: path.basename(scanDir),
      receivedAt: wrapper.receivedAt || summary.receivedAt || debug.generatedAt || '',
      uploadReason: wrapper.upload?.uploadReason || summary.uploadReason || null,
      debug,
      summary,
      sessionId: debug.scanSessionId || summary.scanSessionId || path.basename(scanDir),
    }
  }).filter((row) => row.debug.packetId)

  const grouped = new Map()
  for (const version of versions) {
    if (!grouped.has(version.sessionId)) grouped.set(version.sessionId, [])
    grouped.get(version.sessionId).push(version)
  }
  return [...grouped.entries()].map(([sessionId, rows]) => {
    rows.sort((a, b) => String(a.receivedAt).localeCompare(String(b.receivedAt)))
    const latest = rows.at(-1)
    return {
      ...latest,
      sessionId,
      versions: rows.length,
      firstReceivedAt: rows[0].receivedAt,
      burstFrameCount: Math.max(...rows.map((row) => Number(row.summary?.assets?.hybridBurstFrameCount || row.debug?.hybridBurstFrameDataUrls?.length || 0))),
      successful: !latest.debug.error && Array.isArray(latest.debug.answerGroups) && latest.debug.answerGroups.length > 0,
    }
  })
}

function suggestionForGroup(group, predictions) {
  const ids = group.digitBoxIds || group.digit_box_ids || []
  const first = predictions.find((prediction) => Number(prediction.id) === Number(ids[0]))
  const suggestion = first?.wholeAnswerReviewSuggestion || null
  const decision = first?.hybridDecision || suggestion?.hybridDecision || null
  const choices = new Set([normalizedRead(group.answerText)])
  if (suggestion?.text) choices.add(normalizedRead(suggestion.text))
  for (const choice of decision?.choices || []) choices.add(normalizedRead(choice.text))
  choices.delete(null)
  return { suggestion, decision, choices: [...choices] }
}

function aggregate(rows) {
  const scored = rows.filter((row) => row.scorable)
  const automatic = scored.filter((row) => row.controlAutomatic)
  const yellow = scored.filter((row) => !row.controlAutomatic)
  const shadow = scored.filter((row) => row.shadowEligible)
  const v3Accepted = scored.filter((row) => row.v3ShadowAccepted)
  const reviewed = scored.filter((row) => row.finalText != null)
  const reviewDurations = reviewed.map((row) => row.reviewDurationMs).filter(Number.isFinite).sort((a, b) => a - b)
  const percentile = (values, fraction) => values.length ? values[Math.round((values.length - 1) * fraction)] : null
  return {
    answers: rows.length,
    scoredAnswers: scored.length,
    excludedAmbiguousTruth: rows.length - scored.length,
    controlAutomatic: automatic.length,
    controlAutomaticCoveragePct: scored.length ? Number((automatic.length / scored.length * 100).toFixed(1)) : null,
    controlAutomaticCorrect: automatic.filter((row) => row.controlCorrect).length,
    controlAutomaticWrong: automatic.filter((row) => !row.controlCorrect).length,
    yellowAnswers: yellow.length,
    hybridCorrectChoiceAvailable: yellow.filter((row) => row.hybridChoiceCorrect).length,
    hybridAdditionalCorrectChoices: yellow.filter((row) => !row.controlCorrect && row.hybridChoiceCorrect).length,
    shadowEligible: shadow.length,
    shadowCorrect: shadow.filter((row) => row.shadowCorrect).length,
    shadowWrong: shadow.filter((row) => !row.shadowCorrect).length,
    v3ShadowAccepted: v3Accepted.length,
    v3ShadowCoveragePct: scored.length ? Number((v3Accepted.length / scored.length * 100).toFixed(1)) : null,
    v3ShadowCorrect: v3Accepted.filter((row) => row.v3ShadowCorrect).length,
    v3ShadowWrong: v3Accepted.filter((row) => !row.v3ShadowCorrect).length,
    v3CorrectChoiceAvailable: yellow.filter((row) => row.v3ChoiceCorrect).length,
    v3AdditionalCorrectChoices: yellow.filter((row) => !row.controlCorrect && row.v3ChoiceCorrect).length,
    reviewedAnswers: reviewed.length,
    finalReviewedCorrect: reviewed.filter((row) => row.finalCorrect).length,
    medianReviewDurationMs: percentile(reviewDurations, 0.5),
    p90ReviewDurationMs: percentile(reviewDurations, 0.9),
  }
}

export function evaluateProspective({ sessions, truth, plan, includeLocked = false }) {
  const issues = validateTruthFile(truth, plan)
  const roles = roleByPacket(plan)
  const expectedSeed = plan.seed || null
  const eligible = sessions.filter((session) => roles.has(session.debug.packetId))
  for (const session of eligible) {
    const expectedRole = roles.get(session.debug.packetId)
    if (session.debug.captureRole && session.debug.captureRole !== expectedRole) {
      issues.push(`${session.sessionId} role ${session.debug.captureRole} does not match plan ${expectedRole}`)
    }
    if (expectedSeed && session.debug.capturePlanSeed && session.debug.capturePlanSeed !== expectedSeed) {
      issues.push(`${session.sessionId} capture-plan seed mismatch`)
    }
    if (session.burstFrameCount < 2 && session.successful) issues.push(`${session.sessionId} lacks multi-frame evidence`)
  }

  const allowed = eligible.filter((session) => includeLocked || roles.get(session.debug.packetId) !== 'locked-test')
  const pageGroups = new Map()
  for (const session of allowed) {
    const layoutId = session.debug.layoutId || session.debug.qrPayload?.template_id
    const key = `${session.debug.packetId}|${layoutId || 'unknown'}`
    if (!pageGroups.has(key)) pageGroups.set(key, [])
    pageGroups.get(key).push(session)
  }
  const selectedPages = []
  for (const [key, attempts] of pageGroups) {
    const successes = attempts.filter((attempt) => attempt.successful)
    if (successes.length > 1) {
      issues.push(`${key} has ${successes.length} successful scan sessions; explicit duplicate adjudication required`)
      continue
    }
    if (successes.length === 1) selectedPages.push(successes[0])
  }

  const labelMap = new Map((truth.labels || []).map((label) => [
    `${label.packetId}|${label.layoutId}|${Number(label.questionNum)}`,
    label,
  ]))
  const rows = []
  for (const page of selectedPages) {
    const debug = page.debug
    const packetId = debug.packetId
    const layoutId = debug.layoutId || debug.qrPayload?.template_id
    const predictions = debug.predictions || []
    const v3ByQuestion = new Map((debug.v3Shadow?.decisions || []).map((item) => [Number(item.questionNum), item]))
    for (const group of debug.answerGroups || []) {
      const questionNum = Number(group.questionNum ?? group.question_num)
      const label = labelMap.get(`${packetId}|${layoutId}|${questionNum}`)
      if (!label) {
        issues.push(`missing truth label ${packetId}|${layoutId}|${questionNum}`)
        continue
      }
      const truthText = normalizedTruth(label)
      const controlText = normalizedRead(group.answerText)
      const { suggestion, decision, choices } = suggestionForGroup(group, predictions)
      const correction = debug.manualCorrections?.[String(questionNum)] || null
      const v3 = v3ByQuestion.get(questionNum) || null
      const v3ChoiceTexts = [...new Set([
        normalizedRead(v3?.slotRead),
        normalizedRead(v3?.sequenceRead),
        normalizedRead(v3?.compactRead),
      ].filter((value) => value != null))]
      const v3ShadowText = normalizedRead(v3?.decision?.read)
      const finalText = correction ? normalizedRead(correction.text) : null
      const scorable = truthText != null && label.qaStatus === 'verified'
      rows.push({
        packetId,
        role: roles.get(packetId),
        layoutId,
        questionNum,
        truthState: label.truthState,
        truthText,
        scorable,
        mathAnswerKey: group.answer ?? null,
        mathCorrect: scorable ? normalizedRead(group.answer) === truthText : null,
        controlText,
        controlAutomatic: group.reviewNeeded !== true,
        controlCorrect: scorable ? controlText === truthText : null,
        hybridChoiceTexts: choices,
        hybridChoiceCorrect: scorable ? choices.includes(truthText) : null,
        wholeAnswerText: normalizedRead(suggestion?.text),
        shadowEligible: decision?.shadowPromotionEligible === true,
        shadowText: normalizedRead(decision?.shadowPromotionText),
        shadowCorrect: scorable && decision?.shadowPromotionEligible === true
          ? normalizedRead(decision.shadowPromotionText) === truthText
          : null,
        v3PolicyVersion: debug.v3Shadow?.policyVersion || null,
        v3ChoiceTexts,
        v3ChoiceCorrect: scorable ? v3ChoiceTexts.includes(truthText) : null,
        v3ShadowAccepted: v3?.decision?.action === 'accept',
        v3ShadowText,
        v3ShadowCorrect: scorable && v3?.decision?.action === 'accept' ? v3ShadowText === truthText : null,
        v3FrameCount: Number(debug.v3Shadow?.frameCount || 0),
        finalText,
        finalCorrect: scorable && finalText != null ? finalText === truthText : null,
        reviewDurationMs: Number.isFinite(Number(correction?.reviewDurationMs)) ? Number(correction.reviewDurationMs) : null,
        correctionSource: correction?.correctionSource || null,
        scanSessionId: page.sessionId,
      })
    }
  }

  const byPacket = {}
  for (const packetId of new Set(rows.map((row) => row.packetId))) {
    byPacket[packetId] = aggregate(rows.filter((row) => row.packetId === packetId))
  }
  const attempts = allowed.length
  const successfulSessions = allowed.filter((session) => session.successful).length
  const gateTelemetry = allowed.map((session) => session.debug.captureQuality?.captureGateTelemetry).filter(Boolean)
  const gateAttempts = gateTelemetry.reduce((sum, item) => sum + Number(item.attempts || 0), 0)
  const gateAccepted = gateTelemetry.reduce((sum, item) => sum + Number(item.accepted || 0), 0)
  const gateElapsed = gateTelemetry.map((item) => Number(item.elapsedMs)).filter(Number.isFinite).sort((a, b) => a - b)
  const gateRejectionCounts = {}
  for (const item of gateTelemetry) {
    for (const [reason, count] of Object.entries(item.rejectionCounts || {})) {
      gateRejectionCounts[reason] = (gateRejectionCounts[reason] || 0) + Number(count || 0)
    }
  }
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    answerKeyUsedAsTruth: false,
    includedLockedPacket: includeLocked,
    integrity: {
      issues,
      valid: issues.length === 0,
      packetGroupingPreserved: true,
      duplicateSuccessfulPagesRejected: true,
    },
    capture: {
      sessions: attempts,
      successfulSessions,
      failedSessions: attempts - successfulSessions,
      completionPct: attempts ? Number((successfulSessions / attempts * 100).toFixed(1)) : null,
      selectedPages: selectedPages.length,
      cameraGateAttempts: gateAttempts,
      cameraGateAccepted: gateAccepted,
      cameraGateRejections: Math.max(0, gateAttempts - gateAccepted),
      cameraGateRejectionCounts: gateRejectionCounts,
      medianCameraGateElapsedMs: gateElapsed.length ? gateElapsed[Math.round((gateElapsed.length - 1) * 0.5)] : null,
      p90CameraGateElapsedMs: gateElapsed.length ? gateElapsed[Math.round((gateElapsed.length - 1) * 0.9)] : null,
    },
    overall: aggregate(rows),
    byPacket,
    rows,
  }
}

function parseArgs(argv) {
  const options = {
    scanRoot: 'private-evidence/debug-scans',
    plan: 'private-evidence/capture-plans/four-packet-plan.json',
    truth: 'private-evidence/hybrid-v2-prospective/handwritten-truth-development.json',
    out: 'private-evidence/reports/hybrid-v2-prospective-development.json',
    includeLocked: false,
    freeze: null,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--scan-root') options.scanRoot = argv[++index]
    else if (value === '--plan') options.plan = argv[++index]
    else if (value === '--truth') options.truth = argv[++index]
    else if (value === '--out') options.out = argv[++index]
    else if (value === '--include-locked') options.includeLocked = true
    else if (value === '--freeze') options.freeze = argv[++index]
    else throw new Error(`Unknown argument: ${value}`)
  }
  return options
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.includeLocked) {
    if (!options.freeze) throw new Error('--include-locked requires --freeze')
    const manifest = readJson(options.freeze)
    const isV3 = String(manifest?.purpose || '').includes('V3')
    const verification = isV3
      ? (await import('./freeze_v3_policy.mjs')).verifyV3PolicyFreeze(manifest)
      : (await import('./freeze_hybrid_v2_policy.mjs')).verifyPolicyFreeze(manifest)
    if (!verification.valid) throw new Error(`policy freeze invalid: ${verification.issues.join('; ')}`)
  }
  const report = evaluateProspective({
    sessions: loadProspectiveSessions(options.scanRoot),
    truth: readJson(options.truth),
    plan: readJson(options.plan),
    includeLocked: options.includeLocked,
  })
  fs.mkdirSync(path.dirname(options.out), { recursive: true })
  fs.writeFileSync(options.out, `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify({ out: options.out, integrity: report.integrity, capture: report.capture, overall: report.overall }, null, 2))
  if (!report.integrity.valid) process.exitCode = 2
}

const isDirect = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
if (isDirect) main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
