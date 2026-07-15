#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadProspectiveSessions } from './evaluate_hybrid_v2_packets.mjs'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const readJson = (file) => JSON.parse(fs.readFileSync(path.resolve(ROOT, file), 'utf8'))
const pct = (n, d) => d ? Number((n / d * 100).toFixed(1)) : null

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

function args(argv) {
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

const options = args(process.argv.slice(2))
const original = readJson(options.report)
const sessions = loadProspectiveSessions(path.resolve(ROOT, options.scanRoot))
  .filter((session) => session.debug.packetId === original.packetId)
const statuses = new Map()
for (const session of sessions) {
  const layoutId = session.debug.layoutId || session.debug.qrPayload?.template_id
  for (const group of session.debug.answerGroups || []) {
    statuses.set(`${layoutId}|${Number(group.questionNum ?? group.question_num)}`, group.status)
  }
}

const rows = original.rows.map((row) => {
  const visibleStatus = statuses.get(`${row.layoutId}|${row.questionNum}`)
  if (!['correct', 'incorrect', 'review'].includes(visibleStatus)) {
    throw new Error(`missing visible status for ${row.layoutId}|${row.questionNum}`)
  }
  const v2Automatic = visibleStatus !== 'review'
  const fallbackPromoted = visibleStatus === 'review' && row.fallbackPromoted
  const frozenRead = v2Automatic ? row.v2Read : fallbackPromoted ? row.frozenRead : null
  const frozenAutomatic = frozenRead != null
  return {
    ...row,
    legacyV2Automatic: row.v2Automatic,
    legacyFallbackPromoted: row.fallbackPromoted,
    visibleV2Status: visibleStatus,
    v2Automatic,
    fallbackPromoted,
    fallbackReason: v2Automatic ? 'v2-visible-status-already-automatic' : row.fallbackReason,
    frozenRead,
    frozenAutomatic,
    frozenCorrect: row.scorable && frozenAutomatic ? frozenRead === row.truthText : null,
  }
})

const byFamily = {
  row: aggregate(rows.filter((row) => row.layoutFamily === 'row')),
  'non-row': aggregate(rows.filter((row) => row.layoutFamily === 'non-row')),
}
const overall = aggregate(rows)
const protocol = readJson('private-evidence/v3-prospective/prospective-evaluator-protocol.json')
const gate = {
  truthVerified: original.gate.truthVerified,
  integrityValid: original.gate.integrityValid,
  completePacket: original.gate.completePacket,
  zeroFrozenAutomaticErrors: overall.frozenAutomaticWrong === 0,
  zeroFallbackPromotionErrors: overall.fallbackPromotedWrong === 0,
  nonRowCoverageAtLeastTarget: Number(byFamily['non-row'].frozenCoveragePct) >= Number(protocol.nonRowCoverageTargetPct),
  nonRowWithinParityPointsOfRow: Number(byFamily['non-row'].frozenCoveragePct) + Number(protocol.maximumNonRowCoverageGapPoints) >= Number(byFamily.row.frozenCoveragePct),
}
gate.productionPromotionEligible = Object.values(gate).every(Boolean)

const corrected = {
  ...original,
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  semanticCorrection: {
    status: 'diagnostic-correction-not-a-refreeze',
    reason: 'The frozen evaluator used answerGroups.reviewNeeded, which also becomes true for confidently incorrect red answers. The intended fallback applies only to visible yellow/review answers.',
    frozenPolicyChanged: false,
  },
  gate,
  overall,
  byFamily,
  rows,
}
fs.writeFileSync(path.resolve(ROOT, options.out), `${JSON.stringify(corrected, null, 2)}\n`, { flag: 'wx' })
console.log(JSON.stringify({ out: options.out, overall, byFamily, gate }, null, 2))
