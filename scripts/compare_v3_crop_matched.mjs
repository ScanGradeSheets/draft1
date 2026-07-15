#!/usr/bin/env node

import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const CONTROL = path.join(ROOT, 'private-evidence/reports/v3-crop-matched-control-20260714')
const CANDIDATE = path.join(ROOT, 'private-evidence/reports/v3-crop-matched-candidate-20260714')
const OUT = path.join(ROOT, 'private-evidence/reports/v3-crop-matched-comparison-20260714.json')
const PACKETS = ['P08', 'P03', 'P09', 'P02']
const TRUTH_FILES = [
  'private-evidence/hybrid-v2-prospective/handwritten-truth-development.json',
  'private-evidence/hybrid-v2-prospective/handwritten-truth-p03-p09-primary.json',
  'private-evidence/hybrid-v2-prospective/handwritten-truth-p02-verified.json',
]

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const digits = (value) => String(value ?? '').replace(/\D/g, '') || null
const pct = (n, d) => d ? Number((100 * n / d).toFixed(1)) : null
const sha256 = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex')

function findFiles(root, name, output = []) {
  if (!fs.existsSync(root)) return output
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const resolved = path.join(root, entry.name)
    if (entry.isDirectory()) findFiles(resolved, name, output)
    else if (entry.isFile() && entry.name === name) output.push(resolved)
  }
  return output
}

const truth = new Map()
for (const relative of TRUTH_FILES) {
  const document = readJson(path.join(ROOT, relative))
  if (document.answerKeyUsedAsTruth !== false) throw new Error(`${relative} does not reject answer-key truth`)
  for (const label of document.labels || []) {
    if (label.truthState !== 'value') continue
    truth.set(`${label.packetId}|${label.layoutId}|${Number(label.questionNum)}`, {
      text: digits(label.handwrittenTruth), qaStatus: label.qaStatus,
    })
  }
}

function loadRun(root, expectedMode) {
  const inputs = readJson(path.join(root, 'inputs.json'))
  if (inputs.cropMode !== expectedMode) throw new Error(`${root} crop mode is ${inputs.cropMode}`)
  const answers = new Map()
  let pageCount = 0
  for (const packetId of PACKETS) {
    const files = findFiles(path.join(root, packetId), 'ocr-debug.json')
    if (files.length !== 5) throw new Error(`${expectedMode} ${packetId} has ${files.length} pages`)
    for (const file of files) {
      const debug = readJson(file)
      if (debug.v3Shadow?.status !== 'complete') throw new Error(`${file} has incomplete V3 evidence`)
      pageCount += 1
      const decisions = new Map((debug.v3Shadow.decisions || []).map((item) => [Number(item.questionNum), item]))
      const predictions = new Map((debug.predictions || []).map((item) => [Number(item.id), item]))
      const outputDir = path.dirname(file)
      for (const group of debug.answerGroups || []) {
        const questionNum = Number(group.questionNum)
        const key = `${packetId}|${debug.layoutId}|${questionNum}`
        const label = truth.get(key)
        if (!label?.text) throw new Error(`missing value truth ${key}`)
        const decision = decisions.get(questionNum)
        if (!decision) throw new Error(`missing V3 decision ${key}`)
        const v2Read = digits(group.answerText)
        const v2Automatic = group.reviewNeeded !== true
        const consensus = decision.sequenceFrameConsensus
        const sequenceConsensusRead = digits(consensus?.text)
        const fallbackPromoted = Boolean(!v2Automatic && sequenceConsensusRead &&
          Number(consensus?.usableFrameCount) === 3 && Number(consensus?.count) === 3 &&
          consensus?.tied === false && Number(consensus?.minConfidence) >= 0.70)
        const slotPredictions = (group.digitBoxIds || []).map((id) => predictions.get(Number(id)))
        const strongSlotEvidence = slotPredictions.length > 0 && slotPredictions.every((prediction) =>
          prediction?.robust === true && Number(prediction.confidence) >= 0.98 && Number(prediction.topGap) >= 0.98)
        const overlayPromoted = fallbackPromoted && !strongSlotEvidence
        const sequenceRead = digits(decision.sequenceRead)
        const compactRead = digits(decision.compactRead)
        const disagreementVeto = Boolean(v2Automatic && sequenceRead && compactRead && sequenceRead !== v2Read && compactRead !== v2Read)
        const overlayRead = disagreementVeto ? null : v2Automatic ? v2Read : overlayPromoted ? sequenceConsensusRead : null
        const zoneFile = path.join(outputDir, `v3-zone-q${questionNum}.png`)
        answers.set(key, {
          packetId, layoutId: debug.layoutId, questionNum, truthText: label.text, truthQaStatus: label.qaStatus,
          v2Read, v2Automatic, v2Correct: v2Automatic ? v2Read === label.text : null,
          sequenceRead, compactRead, sequenceConsensusRead,
          sequenceConsensusCount: Number(consensus?.count) || 0,
          sequenceConsensusMinConfidence: Number(consensus?.minConfidence) || null,
          fallbackPromoted, strongSlotEvidence, disagreementVeto, overlayPromoted,
          overlayRead, overlayAutomatic: overlayRead != null,
          overlayCorrect: overlayRead != null ? overlayRead === label.text : null,
          zoneSha256: fs.existsSync(zoneFile) ? sha256(zoneFile) : null,
          evidenceFile: path.relative(ROOT, file),
        })
      }
    }
  }
  if (pageCount !== 20 || answers.size !== 160) throw new Error(`${expectedMode} expected 20 pages/160 answers, found ${pageCount}/${answers.size}`)
  return { inputs, answers }
}

function summarize(rows) {
  const v2 = rows.filter((row) => row.v2Automatic)
  const overlay = rows.filter((row) => row.overlayAutomatic)
  return {
    answers: rows.length,
    v2Automatic: v2.length,
    v2CoveragePct: pct(v2.length, rows.length),
    v2AutomaticCorrect: v2.filter((row) => row.v2Correct).length,
    v2AutomaticWrong: v2.filter((row) => !row.v2Correct).length,
    overlayAutomatic: overlay.length,
    overlayCoveragePct: pct(overlay.length, rows.length),
    overlayAutomaticCorrect: overlay.filter((row) => row.overlayCorrect).length,
    overlayAutomaticWrong: overlay.filter((row) => !row.overlayCorrect).length,
    fallbackPromoted: rows.filter((row) => row.overlayPromoted).length,
    disagreementVetoes: rows.filter((row) => row.disagreementVeto).length,
  }
}

const control = loadRun(CONTROL, 'production-default-control')
const candidate = loadRun(CANDIDATE, 'eight-frame-column-order-candidate')
const pairs = []
for (const [key, before] of control.answers) {
  const after = candidate.answers.get(key)
  if (!after) throw new Error(`candidate missing ${key}`)
  pairs.push({
    key,
    packetId: before.packetId,
    layoutId: before.layoutId,
    questionNum: before.questionNum,
    truthText: before.truthText,
    truthQaStatus: before.truthQaStatus,
    cropChanged: before.zoneSha256 !== after.zoneSha256,
    v2DecisionChanged: before.v2Read !== after.v2Read || before.v2Automatic !== after.v2Automatic,
    sequenceChanged: before.sequenceRead !== after.sequenceRead || before.sequenceConsensusRead !== after.sequenceConsensusRead,
    compactChanged: before.compactRead !== after.compactRead,
    overlayDecisionChanged: before.overlayRead !== after.overlayRead || before.overlayAutomatic !== after.overlayAutomatic,
    control: before,
    candidate: after,
  })
}

const controlRows = [...control.answers.values()]
const candidateRows = [...candidate.answers.values()]
const result = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  answerKeyUsedForRecognition: false,
  answerKeyUsedAsTruth: false,
  recognitionPolicyChanged: false,
  matchedDesign: 'Same build, saved captures, burst frames, models, and confidence policy; only v3EightFrameColumnOrder differs.',
  control: summarize(controlRows),
  candidate: summarize(candidateRows),
  byPacket: Object.fromEntries(PACKETS.map((packetId) => [packetId, {
    control: summarize(controlRows.filter((row) => row.packetId === packetId)),
    candidate: summarize(candidateRows.filter((row) => row.packetId === packetId)),
  }])),
  pairedChanges: {
    cropsChanged: pairs.filter((row) => row.cropChanged).length,
    v2DecisionsChanged: pairs.filter((row) => row.v2DecisionChanged).length,
    sequenceReadsChanged: pairs.filter((row) => row.sequenceChanged).length,
    compactReadsChanged: pairs.filter((row) => row.compactChanged).length,
    overlayDecisionsChanged: pairs.filter((row) => row.overlayDecisionChanged).length,
    candidateNewAutomatic: pairs.filter((row) => !row.control.overlayAutomatic && row.candidate.overlayAutomatic).length,
    candidateRemovedAutomatic: pairs.filter((row) => row.control.overlayAutomatic && !row.candidate.overlayAutomatic).length,
    candidateNewCorrectAutomatic: pairs.filter((row) => !row.control.overlayAutomatic && row.candidate.overlayAutomatic && row.candidate.overlayCorrect).length,
    candidateNewWrongAutomatic: pairs.filter((row) => !row.control.overlayAutomatic && row.candidate.overlayAutomatic && !row.candidate.overlayCorrect).length,
  },
  gate: {
    completeMatchedRuns: pairs.length === 160,
    zeroCandidateV2Errors: summarize(candidateRows).v2AutomaticWrong === 0,
    zeroCandidateOverlayErrors: summarize(candidateRows).overlayAutomaticWrong === 0,
    noV2CoverageRegression: summarize(candidateRows).v2Automatic >= summarize(controlRows).v2Automatic,
    noOverlayCoverageRegression: summarize(candidateRows).overlayAutomatic >= summarize(controlRows).overlayAutomatic,
  },
  pairs,
}
fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' })
console.log(JSON.stringify({ out: path.relative(ROOT, OUT), control: result.control, candidate: result.candidate, pairedChanges: result.pairedChanges, gate: result.gate }, null, 2))
