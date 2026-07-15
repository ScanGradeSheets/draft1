#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const OUT = path.join(ROOT, process.env.SG_CONFIDENCE_AUDIT_OUT || 'private-evidence/reports/confidence-clearance-audit-20260714.json')
const PACKETS = ['P08', 'P03', 'P09', 'P02']
const LAYOUTS = Array.from({ length: 10 }, (_, index) =>
  `sg-g1-lw-${String(index + 1).padStart(2, '0')}-${[
    'add-1digit', 'add-2digit', 'sub-1digit', 'sub-2digit', 'mixed-20',
    'ten-frames', 'dot-collections', 'number-bonds', 'number-patterns', 'place-value-50',
  ][index]}`)
const CANONICAL_P02_DOT = '2026-07-14_03-52-45-221-sg-g1-lw-07-dot-collections-39ec2eb4'

function read(file) { return JSON.parse(fs.readFileSync(file, 'utf8')) }
function debugFiles(root, output = []) {
  if (!fs.existsSync(root)) return output
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const resolved = path.join(root, entry.name)
    if (entry.isDirectory()) debugFiles(resolved, output)
    else if (entry.isFile() && entry.name === 'debug.json') output.push(resolved)
  }
  return output
}

function selectInputs() {
  const currentReplayRoot = path.resolve(ROOT, process.env.SG_CURRENT_BROWSER_REPLAY_DIR || 'private-evidence/reports/current-four-packet-browser-replay-20260714-full/debug')
  if (fs.existsSync(currentReplayRoot)) {
    const sourceMeta = new Map()
    for (const date of ['2026-07-13', '2026-07-14']) {
      for (const sourceFile of debugFiles(path.join(ROOT, 'private-evidence/debug-scans', date))) {
        try {
          const wrapper = read(sourceFile)
          const debug = wrapper.debug || wrapper
          const shortId = path.basename(path.dirname(sourceFile)).split('-').at(-1)
          if (PACKETS.includes(debug.packetId) && LAYOUTS.includes(debug.layoutId)) {
            sourceMeta.set(shortId, { packetId: debug.packetId, layoutId: debug.layoutId })
          }
        } catch {}
      }
    }
    const current = []
    for (const directory of fs.readdirSync(currentReplayRoot)) {
      const file = path.join(currentReplayRoot, directory, 'ocr-debug.json')
      if (!fs.existsSync(file)) continue
      const debug = read(file)
      const meta = sourceMeta.get(directory.split('-')[0])
      const packetId = debug.packetId || meta?.packetId
      const layoutId = debug.layoutId || meta?.layoutId
      if (PACKETS.includes(packetId) && LAYOUTS.includes(layoutId)) {
        current.push({ file, dir: path.dirname(file), debug, packetId, layoutId })
      }
    }
    if (current.length !== 40) throw new Error(`current replay must contain 40 pages, found ${current.length}`)
    for (const packetId of PACKETS) for (const layoutId of LAYOUTS) {
      const matches = current.filter((row) => row.packetId === packetId && row.layoutId === layoutId)
      if (matches.length !== 1) throw new Error(`current replay ${packetId}|${layoutId}: ${matches.length} pages`)
    }
    return current
  }
  const roots = ['2026-07-13', '2026-07-14'].map((date) => path.join(ROOT, 'private-evidence/debug-scans', date))
  const versions = []
  for (const file of roots.flatMap((root) => debugFiles(root))) {
    try {
      const wrapper = read(file)
      const debug = wrapper.debug || wrapper
      if (PACKETS.includes(debug.packetId) && LAYOUTS.includes(debug.layoutId)) {
        versions.push({ file, dir: path.dirname(file), debug })
      }
    } catch {}
  }
  const selected = []
  for (const packetId of PACKETS) {
    for (const layoutId of LAYOUTS) {
      const candidates = versions.filter((row) => row.debug.packetId === packetId && row.debug.layoutId === layoutId)
      const sessions = new Map()
      for (const row of candidates) {
        const sessionId = row.debug.scanSessionId || path.basename(row.dir)
        if (!sessions.has(sessionId)) sessions.set(sessionId, [])
        sessions.get(sessionId).push(row)
      }
      let eligible = [...sessions.values()].filter((rows) =>
        rows.some((row) => Array.isArray(row.debug.answerGroups) && row.debug.answerGroups.length > 0) &&
        rows.some((row) => fs.existsSync(path.join(row.dir, 'captured.png')) && fs.existsSync(path.join(row.dir, 'burst-frames'))))
      if (packetId === 'P02' && layoutId === 'sg-g1-lw-07-dot-collections') {
        eligible = eligible.filter((rows) => rows.some((row) => path.basename(row.dir) === CANONICAL_P02_DOT))
      }
      if (eligible.length !== 1) throw new Error(`${packetId}|${layoutId}: ${eligible.length} canonical sessions`)
      const row = eligible[0].find((item) => Array.isArray(item.debug.predictions) && item.debug.predictions.length)
      if (!row) throw new Error(`${packetId}|${layoutId}: missing predictions`)
      selected.push({ packetId, layoutId, ...row })
    }
  }
  return selected
}

function topGap(item) {
  if (Number.isFinite(Number(item?.topGap))) return Number(item.topGap)
  const top = item?.topK || []
  return top.length >= 2 ? Number(top[0]?.confidence || 0) - Number(top[1]?.confidence || 0) : 1
}
function digit(item) {
  if (item?.blank === true || item?.empty === true || item?.digit == null) return null
  const value = Number(item.digit)
  return Number.isInteger(value) ? value : null
}
function answerText(predictions) {
  const text = predictions.map((item) => digit(item) == null ? '' : String(digit(item))).join('')
  return text || 'blank'
}
function strictVariant(prediction) {
  return (prediction?.preprocessVariants || []).find((item) => item?.name === 'strict') || prediction?.preprocessVariants?.[0] || null
}
function hasRewrite(prediction) {
  return [
    prediction?.originalDigitBeforeShapeRescue,
    prediction?.originalDigitBeforeContextAssist,
    prediction?.originalDigitBeforeBlankOverride,
    prediction?.trustedSuggestionPromotion?.originalDigit,
  ].some((value) => value !== undefined && value !== null && Number(value) !== digit(prediction))
}
function weakOverrideConflict(prediction) {
  const selected = digit(prediction)
  if (selected == null) return false
  const vote = prediction?.preprocessVoteSummary || {}
  const voteTop = vote.top || null
  const voteConflict = voteTop && Number(voteTop.digit) !== selected && Number(voteTop.share || 0) >= 0.52 && Number(vote.margin || 0) >= 0.14
  const strict = strictVariant(prediction)
  const strictConflict = strict && Number(strict.digit) !== selected && Number(strict.confidence || 0) >= 0.70 && topGap(strict) >= 0.40
  const override = String(prediction?.robustOverride || prediction?.confidencePolicyClearanceReason || '')
  return Boolean(voteConflict || (override && strictConflict))
}
function dangerousBoxSafeClearance(prediction) {
  const selected = digit(prediction)
  const vote = prediction?.preprocessVoteSummary || {}
  const voteTop = vote.top || null
  if (selected == null || !voteTop || Number(voteTop.digit) === selected) return false
  const clearance = String(prediction?.confidencePolicyClearanceReason || '')
  return prediction?.confidencePolicyCleared === true &&
    prediction?.preprocessDisagreement === true &&
    clearance === 'validated-review-reason:box-safe-default' &&
    Number(voteTop.share || 0) >= 0.52 &&
    Number(vote.margin || 0) >= 0.05
}
function majorityAlternativeRead(read, prediction) {
  const selected = digit(prediction)
  const voteTop = prediction?.preprocessVoteSummary?.top
  const index = Number(prediction?.digitIndex)
  if (selected == null || !voteTop || !Number.isInteger(index)) return null
  const text = String(read || '')
  if (index < 0 || index >= text.length || text[index] !== String(selected)) return null
  return `${text.slice(0, index)}${Number(voteTop.digit)}${text.slice(index + 1)}`
}
function keyBlindMinimumFails(prediction) {
  if (digit(prediction) == null) return false
  const confidence = Number(prediction?.originalChosenDigitConfidence ?? prediction?.confidence ?? 0)
  const gap = topGap(prediction)
  if (prediction?.isVirtualDigitBox !== true) return confidence < 0.78 || gap < 0.08
  if (Number(prediction?.slotCount) === 1) return confidence < 0.78 || gap < 0.08
  return Number(prediction?.digitIndex) === 1
    ? confidence < 0.92 || gap < 0.28
    : confidence < 0.88 || gap < 0.20
}

const truthReport = read(path.join(ROOT, 'private-evidence/reports/v3-crop-candidate-evaluation-20260714-final.json'))
const truthByKey = new Map(truthReport.rows.map((row) => [`${row.packetId}|${row.layoutId}|${Number(row.questionNum)}`, row]))
const rows = []

for (const page of selectInputs()) {
  const debug = page.debug
  const layout = read(path.join(ROOT, 'layouts', `${page.layoutId}.json`))
  const byId = new Map((debug.predictions || []).map((item) => [item.id, item]))
  const finalGroupByQuestion = new Map((debug.answerGroups || []).map((item, index) => [Number(item?.questionNum ?? index + 1), item]))
  for (const [index, group] of (layout.question_groups || []).entries()) {
    const questionNum = Number(group?.question_num ?? index + 1)
    const predictions = (group?.digit_box_ids || []).map((id) => byId.get(id)).filter(Boolean)
    const finalGroup = finalGroupByQuestion.get(questionNum)
    const truth = truthByKey.get(`${page.packetId}|${page.layoutId}|${questionNum}`)
    const finalRead = String(finalGroup?.answerText || answerText(predictions))
    const compactRead = truth?.compactRead == null ? null : String(truth.compactRead)
    const compactSupportsDangerousMajorityAlternative = predictions.some((prediction) =>
      dangerousBoxSafeClearance(prediction) &&
      compactRead != null &&
      majorityAlternativeRead(finalRead, prediction) === compactRead)
    const signals = {
      weakOverrideConflict: predictions.some(weakOverrideConflict),
      dangerousBoxSafeClearance: predictions.some(dangerousBoxSafeClearance),
      compactSupportsDangerousMajorityAlternative,
      transcriptionRewrite: predictions.some(hasRewrite),
      keyBlindMinimumFails: predictions.some(keyBlindMinimumFails),
      confidenceClearance: predictions.some((item) => item?.confidencePolicyCleared === true),
      trustedSuggestionPromotion: predictions.some((item) => item?.trustedSuggestionPromotion),
      contextLeadingOneRewrite: predictions.some((item) => item?.contextAssistEvidence || item?.robustOverride === 'context-assisted-leading-one'),
      preprocessingDisagreement: predictions.some((item) => item?.preprocessDisagreement === true),
    }
    rows.push({
      packetId: page.packetId,
      layoutId: page.layoutId,
      layoutFamily: Number(page.layoutId.match(/sg-g1-lw-(\d{2})/)?.[1]) <= 5 ? 'row' : 'non-row',
      questionNum,
      truth: truth?.scorable ? String(truth.truthText) : null,
      scorable: truth?.scorable === true,
      read: finalRead,
      automatic: finalGroup?.reviewNeeded === false,
      correct: truth?.scorable === true ? finalRead === String(truth.truthText) : null,
      compactRead,
      signals,
      predictions: predictions.map((item) => ({
        id: item.id, digitIndex: item.digitIndex, digit: digit(item), confidence: item.confidence, topGap: topGap(item),
        reviewNeeded: item.reviewNeeded === true, robustOverride: item.robustOverride || null,
        clearance: item.confidencePolicyClearanceReason || null, vote: item.preprocessVoteSummary || null,
        strict: strictVariant(item), rewrite: hasRewrite(item),
      })),
      evidenceFile: path.relative(ROOT, page.file),
    })
  }
}

const policies = {
  current: () => false,
  weak_override_conflict_veto: (row) => row.signals.weakOverrideConflict,
  dangerous_box_safe_clearance_veto: (row) => row.signals.dangerousBoxSafeClearance,
  compact_confirmed_majority_alternative_veto: (row) => row.signals.compactSupportsDangerousMajorityAlternative,
  rewrite_veto: (row) => row.signals.transcriptionRewrite,
  key_blind_minimum_veto: (row) => row.signals.keyBlindMinimumFails,
  combined_safety_veto: (row) => row.signals.weakOverrideConflict || row.signals.transcriptionRewrite || row.signals.keyBlindMinimumFails,
}

function summarize(selectedRows, veto) {
  const scorable = selectedRows.filter((row) => row.scorable)
  const automatic = scorable.filter((row) => row.automatic && !veto(row))
  const baselineAutomatic = scorable.filter((row) => row.automatic)
  return {
    answers: scorable.length,
    baselineAutomatic: baselineAutomatic.length,
    automatic: automatic.length,
    coveragePct: Number((100 * automatic.length / Math.max(1, scorable.length)).toFixed(1)),
    correctAutomatic: automatic.filter((row) => row.correct).length,
    wrongAutomatic: automatic.filter((row) => row.correct === false).length,
    vetoed: baselineAutomatic.filter(veto).length,
    vetoedCorrect: baselineAutomatic.filter((row) => veto(row) && row.correct).length,
    vetoedWrong: baselineAutomatic.filter((row) => veto(row) && row.correct === false).length,
  }
}

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  scope: 'Canonical 40-page/four-packet browser acceptance-path audit. Truth is used only after key-blind veto decisions for scoring.',
  answerKeyUsedByCandidateVeto: false,
  pages: 40,
  rows: rows.length,
  policies: Object.fromEntries(Object.entries(policies).map(([name, veto]) => [name, {
    overall: summarize(rows, veto),
    row: summarize(rows.filter((item) => item.layoutFamily === 'row'), veto),
    nonRow: summarize(rows.filter((item) => item.layoutFamily === 'non-row'), veto),
    vetoedExamples: rows.filter((item) => item.automatic && veto(item)).map((item) => ({
      packetId: item.packetId, layoutId: item.layoutId, questionNum: item.questionNum,
      truth: item.truth, read: item.read, correct: item.correct, signals: item.signals,
    })),
  }])),
  acceptancePathCounts: Object.fromEntries(Object.keys(rows[0].signals).map((signal) => [signal, {
    automatic: rows.filter((row) => row.automatic && row.signals[signal]).length,
    automaticCorrect: rows.filter((row) => row.automatic && row.correct && row.signals[signal]).length,
    automaticWrong: rows.filter((row) => row.automatic && row.correct === false && row.signals[signal]).length,
  }])),
  answerRows: rows,
}

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ out: path.relative(ROOT, OUT), policies: report.policies, acceptancePathCounts: report.acceptancePathCounts }, null, 2))
