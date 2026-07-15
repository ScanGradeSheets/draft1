#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const truthPath = path.join(root, 'private-evidence/truth-labels/20260703-flex-duplicate-accepted-needs-label/handwritten-truth-labelled.json')
const replayDir = path.join(root, 'private-evidence/reports/nonrow-normalization-20260708/ocr-promotion-relaxed-full-browser')
const trocrPath = path.join(root, 'private-evidence/reports/trocr-lora-calibrated-2epoch-20260709.json')
const compactPath = path.join(root, 'private-evidence/reports/v3-sequence-live.json')
const blankPath = path.join(root, 'private-evidence/reports/v3-blank-artifact-shadow.json')
const outPath = path.join(root, 'private-evidence/reports/v3-fusion-policy.json')

const key = (captureId, questionNum) => `${captureId}::${Number(questionNum)}`
const digits = (value) => String(value ?? '').replace(/\D/g, '')
const splitFor = (entry) => Number(entry.pageIndex) >= 70 ? 'holdout' : Number(entry.pageIndex) >= 50 ? 'validation' : 'development'
const truth = JSON.parse(await fs.readFile(truthPath, 'utf8'))
const trocr = JSON.parse(await fs.readFile(trocrPath, 'utf8'))
const compact = JSON.parse(await fs.readFile(compactPath, 'utf8'))
const blank = JSON.parse(await fs.readFile(blankPath, 'utf8'))
const layouts = new Map()
const control = new Map()

for (const file of (await fs.readdir(replayDir)).filter((name) => name.endsWith('-replay-result.json'))) {
  const replay = JSON.parse(await fs.readFile(path.join(replayDir, file), 'utf8'))
  const captureId = replay.file || file.replace(/-replay-result\.json$/, '')
  const truthEntries = truth.entries.filter((entry) => entry.captureId === captureId)
  const layoutId = truthEntries[0]?.layoutId
  if (!layoutId) continue
  if (!layouts.has(layoutId)) layouts.set(layoutId, JSON.parse(await fs.readFile(path.join(root, 'layouts', `${layoutId}.json`), 'utf8')))
  const layout = layouts.get(layoutId)
  const byId = new Map((replay.predictionDetails || []).map((item) => [item.id, item]))
  for (const group of layout.question_groups || []) {
    const items = (group.digit_box_ids || []).map((id) => byId.get(id)).filter(Boolean)
    control.set(key(captureId, group.question_num), {
      read: digits(items.map((item) => item.digit == null ? '' : item.digit).join('')),
      confidence: items.length ? Math.min(...items.map((item) => Number(item.confidence || 0))) : 0,
      review: items.some((item) => item.reviewNeeded === true),
    })
  }
}

const trocrByKey = new Map([...trocr.validationRows, ...trocr.holdoutRows].map((row) => [key(row.captureId, row.questionLabel), row]))
const compactByKey = new Map([...compact.validationRows, ...compact.holdoutRows].map((row) => [key(row.captureId, row.questionNum), row]))
const blankByKey = new Map(blank.rows.map((row) => [key(row.captureId, row.questionNum), row]))
const rows = truth.entries
  .filter((entry) => ['validation', 'holdout'].includes(splitFor(entry)))
  .map((entry) => {
    const id = key(entry.captureId, entry.questionNum)
    const current = control.get(id)
    const large = trocrByKey.get(id)
    const small = compactByKey.get(id)
    const blankRow = blankByKey.get(id)
    if (!current || !large || !small) return null
    return {
      id, captureId: entry.captureId, questionNum: entry.questionNum, layoutId: entry.layoutId, split: splitFor(entry), truth: digits(entry.truth),
      controlRead: current.read, controlConfidence: current.confidence, controlReview: current.review,
      trocrRead: digits(large.modelRead), trocrConfidence: Number(large.minTokenProbability || 0),
      compactRead: digits(small.modelRead), compactConfidence: Number(small.minComponentProbability || 0),
      artifactProbability: Number(blankRow?.artifactProbability || 0),
    }
  }).filter(Boolean)

function evaluate(items, trocrThreshold, compactThreshold) {
  const decisions = items.map((row) => {
    const existingAuto = !row.controlReview
    const independentAgreement = row.controlReview && row.controlRead && row.controlRead === row.trocrRead && row.controlRead === row.compactRead &&
      row.trocrConfidence >= trocrThreshold && row.compactConfidence >= compactThreshold
    const auto = existingAuto || independentAgreement
    return { ...row, auto, promoted: independentAgreement, correct: row.controlRead === row.truth }
  })
  const promoted = decisions.filter((row) => row.promoted)
  const auto = decisions.filter((row) => row.auto)
  return {
    total: decisions.length, auto: auto.length, autoCorrect: auto.filter((row) => row.correct).length,
    autoWrong: auto.filter((row) => !row.correct).length, promoted: promoted.length,
    promotedCorrect: promoted.filter((row) => row.correct).length, promotedWrong: promoted.filter((row) => !row.correct).length,
    coveragePct: Number((100 * auto.length / decisions.length).toFixed(1)),
    promotionRows: promoted,
  }
}

const validationRows = rows.filter((row) => row.split === 'validation')
const holdoutRows = rows.filter((row) => row.split === 'holdout')
let selected = null
for (const trocrThreshold of [.90, .94, .96, .98, .99]) for (const compactThreshold of [.80, .88, .92, .96, .98, .99]) {
  const result = evaluate(validationRows, trocrThreshold, compactThreshold)
  if (result.promotedWrong > 0) continue
  const candidate = { trocrThreshold, compactThreshold, result }
  if (!selected || result.promotedCorrect > selected.result.promotedCorrect ||
      (result.promotedCorrect === selected.result.promotedCorrect && trocrThreshold + compactThreshold > selected.trocrThreshold + selected.compactThreshold)) selected = candidate
}
if (!selected) selected = { trocrThreshold: .99, compactThreshold: .99, result: evaluate(validationRows, .99, .99) }
const holdout = evaluate(holdoutRows, selected.trocrThreshold, selected.compactThreshold)

function availability(items) {
  return {
    total: items.length,
    controlCorrect: items.filter((row) => row.controlRead === row.truth).length,
    trocrCorrect: items.filter((row) => row.trocrRead === row.truth).length,
    compactCorrect: items.filter((row) => row.compactRead === row.truth).length,
    anyReaderCorrect: items.filter((row) => [row.controlRead, row.trocrRead, row.compactRead].includes(row.truth)).length,
    twoModelsAgree: items.filter((row) => row.trocrRead === row.compactRead).length,
    twoModelsAgreeCorrect: items.filter((row) => row.trocrRead === row.compactRead && row.trocrRead === row.truth).length,
    twoModelsAgreeWrong: items.filter((row) => row.trocrRead === row.compactRead && row.trocrRead !== row.truth).length,
  }
}

const report = {
  generatedAt: new Date().toISOString(), answerKeyUsedAsTruth: false,
  caveat: 'Historical page-block R&D splits; model selection has already touched this corpus. Prospective packet holdout remains decisive.',
  policy: {
    trocrThreshold: selected.trocrThreshold,
    compactThreshold: selected.compactThreshold,
    artifactMode: 'advisory-until-prospectively-calibrated',
    requiresControlPlusTwoIndependentReaders: true,
  },
  validation: selected.result, holdout,
  availability: { validation: availability(validationRows), holdout: availability(holdoutRows) },
  rows,
}
await fs.writeFile(outPath, JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ policy: report.policy, validation: report.validation, holdout: report.holdout, availability: report.availability }, null, 2))
