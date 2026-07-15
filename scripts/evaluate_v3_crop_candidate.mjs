#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const MAIN = path.join(ROOT, 'private-evidence/reports/v3-crop-candidate-replay-20260714')
const RESUME = path.join(ROOT, 'private-evidence/reports/v3-crop-candidate-replay-20260714-resume')
const NARROW = path.join(ROOT, 'private-evidence/reports/v3-crop-candidate-replay-20260714-narrow-six')
const OUT = path.join(ROOT, 'private-evidence/reports/v3-crop-candidate-evaluation-20260714-final.json')
const TRUTH_FILES = [
  'private-evidence/hybrid-v2-prospective/handwritten-truth-development.json',
  'private-evidence/hybrid-v2-prospective/handwritten-truth-p03-p09-primary.json',
  'private-evidence/hybrid-v2-prospective/handwritten-truth-p02-verified.json',
]
const EXPECTED_LAYOUTS = Array.from({ length: 10 }, (_, index) =>
  `sg-g1-lw-${String(index + 1).padStart(2, '0')}-${[
    'add-1digit', 'add-2digit', 'sub-1digit', 'sub-2digit', 'mixed-20',
    'ten-frames', 'dot-collections', 'number-bonds', 'number-patterns', 'place-value-50',
  ][index]}`)
const BASELINE = {
  overall: { scorableAnswers: 275, automatic: 235, automaticCorrect: 235, automaticWrong: 0 },
  row: { scorableAnswers: 160, automatic: 141, automaticCorrect: 141, automaticWrong: 0 },
  'non-row': { scorableAnswers: 115, automatic: 94, automaticCorrect: 94, automaticWrong: 0 },
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const digits = (value) => String(value ?? '').replace(/\D/g, '') || null
const pct = (n, d) => d ? Number((100 * n / d).toFixed(1)) : null

function findFiles(root, name, output = []) {
  if (!fs.existsSync(root)) return output
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const resolved = path.join(root, entry.name)
    if (entry.isDirectory()) findFiles(resolved, name, output)
    else if (entry.isFile() && entry.name === name) output.push(resolved)
  }
  return output
}

function layoutFamily(layoutId) {
  const layout = readJson(path.join(ROOT, 'public/layouts', `${layoutId}.json`))
  return layout?.metadata?.layout_family === 'fact_rows' ? 'row' : 'non-row'
}

function summarize(rows) {
  const scorable = rows.filter((row) => row.scorable)
  const automatic = scorable.filter((row) => row.overlayAutomatic)
  const v2Automatic = scorable.filter((row) => row.v2Automatic)
  return {
    answers: rows.length,
    scorableAnswers: scorable.length,
    ambiguousTruthExcluded: rows.length - scorable.length,
    v2Automatic: v2Automatic.length,
    v2CoveragePct: pct(v2Automatic.length, scorable.length),
    v2AutomaticCorrect: v2Automatic.filter((row) => row.v2Read === row.truthText).length,
    v2AutomaticWrong: v2Automatic.filter((row) => row.v2Read !== row.truthText).length,
    automatic: automatic.length,
    coveragePct: pct(automatic.length, scorable.length),
    automaticCorrect: automatic.filter((row) => row.overlayCorrect).length,
    automaticWrong: automatic.filter((row) => !row.overlayCorrect).length,
    manualReview: scorable.length - automatic.length,
    fallbackPromoted: scorable.filter((row) => row.overlayPromoted).length,
    fallbackPromotedWrong: scorable.filter((row) => row.overlayPromoted && !row.overlayCorrect).length,
    disagreementVetoes: scorable.filter((row) => row.disagreementVeto).length,
    strongSlotOverridesBlocked: scorable.filter((row) => row.strongSlotOverrideBlocked).length,
  }
}

const truths = new Map()
for (const relative of TRUTH_FILES) {
  const truth = readJson(path.join(ROOT, relative))
  if (truth.answerKeyUsedAsTruth !== false) throw new Error(`${relative} does not reject answer-key truth`)
  for (const label of truth.labels || []) {
    const key = `${label.packetId}|${label.layoutId}|${Number(label.questionNum)}`
    if (truths.has(key)) throw new Error(`duplicate truth ${key}`)
    truths.set(key, label)
  }
}

const debugFiles = [
  ...findFiles(path.join(MAIN, 'P08'), 'ocr-debug.json').map((file) => ({ file, packetId: 'P08', layouts: EXPECTED_LAYOUTS.slice(0, 5) })),
  ...findFiles(path.join(MAIN, 'P03'), 'ocr-debug.json').map((file) => ({ file, packetId: 'P03', layouts: EXPECTED_LAYOUTS.slice(0, 5) })),
  ...findFiles(path.join(MAIN, 'P09'), 'ocr-debug.json').map((file) => ({ file, packetId: 'P09', layouts: EXPECTED_LAYOUTS.slice(0, 5) })),
  ...findFiles(path.join(RESUME, 'P02'), 'ocr-debug.json').map((file) => ({ file, packetId: 'P02', layouts: EXPECTED_LAYOUTS.slice(0, 5) })),
  ...['P08', 'P03', 'P09', 'P02'].flatMap((packetId) => findFiles(path.join(NARROW, packetId), 'ocr-debug.json')
    .map((file) => ({ file, packetId, layouts: EXPECTED_LAYOUTS.slice(5) }))),
]
const pages = new Map()
for (const { file, packetId, layouts } of debugFiles) {
  const debug = readJson(file)
  if (!debug.layoutId || !layouts.includes(debug.layoutId) || debug.v3Shadow?.status !== 'complete') continue
  debug.packetId = packetId
  const key = `${packetId}|${debug.layoutId}`
  if (pages.has(key)) throw new Error(`duplicate candidate page ${key}`)
  pages.set(key, { file, debug })
}
if (pages.size !== 40) throw new Error(`expected 40 complete candidate pages, found ${pages.size}`)

const rows = []
for (const { file, debug } of [...pages.values()].sort((a, b) => `${a.debug.packetId}|${a.debug.layoutId}`.localeCompare(`${b.debug.packetId}|${b.debug.layoutId}`))) {
  const decisions = new Map((debug.v3Shadow.decisions || []).map((item) => [Number(item.questionNum), item]))
  const predictions = new Map((debug.predictions || []).map((item) => [Number(item.id), item]))
  for (const group of debug.answerGroups || []) {
    const questionNum = Number(group.questionNum)
    const key = `${debug.packetId}|${debug.layoutId}|${questionNum}`
    const label = truths.get(key)
    if (!label) throw new Error(`missing truth ${key}`)
    const truthText = label.truthState === 'value' ? digits(label.handwrittenTruth) : null
    const scorable = truthText != null
    const decision = decisions.get(questionNum)
    if (!decision) throw new Error(`missing V3 decision ${key}`)
    const v2Read = digits(group.answerText)
    const v2Automatic = group.reviewNeeded !== true
    const consensus = decision.sequenceFrameConsensus
    const frozenRead = digits(consensus?.text)
    const fallbackPromoted = !v2Automatic && frozenRead &&
      Number(consensus?.usableFrameCount) === 3 && Number(consensus?.count) === 3 &&
      consensus?.tied === false && Number(consensus?.minConfidence) >= 0.70
    const slotPredictions = (group.digitBoxIds || []).map((id) => predictions.get(Number(id)))
    const strongSlotEvidence = slotPredictions.length > 0 && slotPredictions.every((prediction) =>
      prediction?.robust === true && Number(prediction.confidence) >= 0.98 && Number(prediction.topGap) >= 0.98)
    const strongSlotOverrideBlocked = Boolean(fallbackPromoted && strongSlotEvidence)
    const overlayPromoted = Boolean(fallbackPromoted && !strongSlotEvidence)
    const sequenceRead = digits(decision.sequenceRead)
    const compactRead = digits(decision.compactRead)
    const disagreementVeto = Boolean(v2Automatic && sequenceRead && compactRead && sequenceRead !== v2Read && compactRead !== v2Read)
    const overlayRead = disagreementVeto ? null : v2Automatic ? v2Read : overlayPromoted ? frozenRead : null
    rows.push({
      packetId: debug.packetId,
      layoutId: debug.layoutId,
      layoutFamily: layoutFamily(debug.layoutId),
      questionNum,
      truthState: label.truthState,
      truthQaStatus: label.qaStatus,
      truthText,
      scorable,
      v2Read,
      v2Automatic,
      sequenceRead,
      compactRead,
      frozenRead,
      fallbackPromoted: Boolean(fallbackPromoted),
      strongSlotEvidence,
      strongSlotOverrideBlocked,
      overlayPromoted,
      disagreementVeto,
      overlayRead,
      overlayAutomatic: overlayRead != null,
      overlayCorrect: scorable && overlayRead != null ? overlayRead === truthText : null,
      evidenceFile: path.relative(ROOT, file),
    })
  }
}
if (rows.length !== 280) throw new Error(`expected 280 labelled answers, found ${rows.length}`)

const overall = summarize(rows)
const byFamily = Object.fromEntries(['row', 'non-row'].map((family) => [family, summarize(rows.filter((row) => row.layoutFamily === family))]))
const byPacket = Object.fromEntries(['P08', 'P03', 'P09', 'P02'].map((packet) => [packet, summarize(rows.filter((row) => row.packetId === packet))]))
const byLayout = Object.fromEntries([...new Set(rows.map((row) => row.layoutId))].sort().map((layout) => [layout, summarize(rows.filter((row) => row.layoutId === layout))]))
const result = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  status: 'isolated-crop-candidate; not deployed',
  answerKeyUsedForRecognition: false,
  answerKeyUsedAsTruth: false,
  recognitionPolicyChanged: false,
  candidateChange: 'Generalize two-column answer-frame column-order assignment from exactly 10 frames to even counts of at least 8; six-answer activities retain the prior matching path.',
  policy: {
    fallback: 'Large key-blind reader must return the same digits on all 3 frames with minimum visible-token confidence >= 0.70.',
    disagreementVeto: 'Review a V2 automatic read when both independent readers are non-empty and both differ from it.',
    strongSlotGuard: 'Do not override a V2 review when every physical slot is robust with confidence and top-gap >= 0.98.',
  },
  truth: { totalLabels: rows.length, scorableValues: overall.scorableAnswers, excludedAmbiguous: overall.ambiguousTruthExcluded, p02IndependentlyVerified: true },
  baseline: BASELINE,
  candidate: { overall, byFamily, byPacket, byLayout },
  delta: {
    automatic: overall.automatic - BASELINE.overall.automatic,
    manualReview: (overall.scorableAnswers - overall.automatic) - (BASELINE.overall.scorableAnswers - BASELINE.overall.automatic),
    automaticWrong: overall.automaticWrong - BASELINE.overall.automaticWrong,
    rowAutomatic: byFamily.row.automatic - BASELINE.row.automatic,
    nonRowAutomatic: byFamily['non-row'].automatic - BASELINE['non-row'].automatic,
  },
  gate: {
    allFortyPagesComplete: pages.size === 40,
    allTruthPresent: rows.length === truths.size,
    zeroObservedAutomaticErrors: overall.automaticWrong === 0,
    noFamilyRegression: byFamily.row.automatic >= BASELINE.row.automatic && byFamily['non-row'].automatic >= BASELINE['non-row'].automatic,
  },
  rows,
}
fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' })
console.log(JSON.stringify({ out: path.relative(ROOT, OUT), baseline: result.baseline, candidate: result.candidate, delta: result.delta, gate: result.gate }, null, 2))
