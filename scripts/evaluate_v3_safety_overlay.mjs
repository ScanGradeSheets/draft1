#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadProspectiveSessions } from './evaluate_hybrid_v2_packets.mjs'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const readJson = (file) => JSON.parse(fs.readFileSync(path.resolve(ROOT, file), 'utf8'))
const digits = (value) => String(value ?? '').replace(/\D/g, '') || null
const pct = (n, d) => d ? Number((n / d * 100).toFixed(1)) : null

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--report') out.report = argv[++i]
    else if (argv[i] === '--scan-root') out.scanRoot = argv[++i]
    else if (argv[i] === '--out') out.out = argv[++i]
    else throw new Error(`unknown argument ${argv[i]}`)
  }
  if (!out.report || !out.scanRoot || !out.out) throw new Error('--report, --scan-root, and --out are required')
  return out
}

function summarize(rows) {
  const scorable = rows.filter((row) => row.scorable)
  const automatic = scorable.filter((row) => row.overlayAutomatic)
  const vetoed = scorable.filter((row) => row.disagreementVeto)
  const promoted = scorable.filter((row) => row.overlayPromoted)
  return {
    answers: rows.length,
    scorableAnswers: scorable.length,
    ambiguousTruthExcluded: rows.length - scorable.length,
    automatic: automatic.length,
    coveragePct: pct(automatic.length, scorable.length),
    automaticCorrect: automatic.filter((row) => row.overlayCorrect).length,
    automaticWrong: automatic.filter((row) => !row.overlayCorrect).length,
    manualReview: scorable.length - automatic.length,
    disagreementVetoes: vetoed.length,
    wrongV2ReadsVetoed: vetoed.filter((row) => row.v2Read !== row.truthText).length,
    correctV2ReadsVetoed: vetoed.filter((row) => row.v2Read === row.truthText).length,
    fallbackPromoted: promoted.length,
    fallbackPromotedWrong: promoted.filter((row) => !row.overlayCorrect).length,
    strongSlotOverridesBlocked: scorable.filter((row) => row.strongSlotOverrideBlocked).length,
  }
}

const options = parseArgs(process.argv.slice(2))
const report = readJson(options.report)
const sessions = loadProspectiveSessions(path.resolve(ROOT, options.scanRoot))
  .filter((session) => session.debug.packetId === report.packetId)
const evidence = new Map()
for (const session of sessions) {
  const debug = session.debug
  const layoutId = debug.layoutId || debug.qrPayload?.template_id
  const decisions = new Map((debug.v3Shadow?.decisions || []).map((row) => [Number(row.questionNum), row]))
  const predictions = new Map((debug.predictions || []).map((row) => [Number(row.id), row]))
  for (const group of debug.answerGroups || []) {
    const questionNum = Number(group.questionNum ?? group.question_num)
    const slotPredictions = (group.digitBoxIds || group.digit_box_ids || []).map((id) => predictions.get(Number(id)))
    evidence.set(`${layoutId}|${questionNum}`, { group, decision: decisions.get(questionNum), slotPredictions })
  }
}

const rows = report.rows.map((row) => {
  const item = evidence.get(`${row.layoutId}|${row.questionNum}`)
  if (!item?.decision) throw new Error(`missing V3 evidence for ${row.layoutId}|${row.questionNum}`)
  const sequenceRead = digits(item.decision.sequenceRead)
  const compactRead = digits(item.decision.compactRead)
  const disagreementVeto = row.v2Automatic && sequenceRead && compactRead &&
    sequenceRead !== row.v2Read && compactRead !== row.v2Read
  const strongSlotEvidence = item.slotPredictions.length > 0 && item.slotPredictions.every((prediction) =>
    prediction?.robust === true && Number(prediction.confidence) >= 0.98 && Number(prediction.topGap) >= 0.98)
  const strongSlotOverrideBlocked = !row.v2Automatic && row.fallbackPromoted && strongSlotEvidence
  const overlayPromoted = !row.v2Automatic && row.fallbackPromoted && !strongSlotEvidence
  const overlayRead = disagreementVeto ? null : row.v2Automatic ? row.v2Read : overlayPromoted ? row.frozenRead : null
  return {
    ...row,
    sequenceRead,
    compactRead,
    strongSlotEvidence,
    disagreementVeto: Boolean(disagreementVeto),
    strongSlotOverrideBlocked,
    overlayPromoted,
    overlayRead,
    overlayAutomatic: overlayRead != null,
    overlayCorrect: row.scorable && overlayRead != null ? overlayRead === row.truthText : null,
  }
})

const result = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  packetId: report.packetId,
  status: 'primary-truth-development-only',
  answerKeyUsedForRecognition: false,
  policy: {
    base: 'frozen-large-reader-3-of-3-min-visible-confidence-0.70',
    disagreementVeto: 'For a V2 automatic answer, review when both independent readers return non-empty reads and both differ from V2.',
    strongSlotGuard: 'For a V2 review answer, do not replace it when every physical slot is robust with confidence and top-gap at least 0.98.',
  },
  overall: summarize(rows),
  byFamily: {
    row: summarize(rows.filter((row) => row.layoutFamily === 'row')),
    'non-row': summarize(rows.filter((row) => row.layoutFamily === 'non-row')),
  },
  rows,
}
fs.writeFileSync(path.resolve(ROOT, options.out), `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' })
console.log(JSON.stringify({ out: options.out, overall: result.overall, byFamily: result.byFamily }, null, 2))
