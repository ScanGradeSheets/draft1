#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  acceptedAnswerSafetyDecision,
  acceptedAnswerSafetyRoute,
} from '../src/v3/accepted-answer-safety.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUTPUT = path.resolve(process.argv[2] ||
  'private-evidence/reports/accepted-answer-safety-shadow-1-20260723.json')
const OMIT_SCOUT = process.env.SG_ACCEPTED_SAFETY_NO_SCOUT === '1'
const baseAuditPath = path.join(os.tmpdir(), `scangrade-beta7-no-broad-veto-${process.pid}.json`)
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const digits = (value) => String(value ?? '').replace(/\D/g, '') || null
const pct = (n, d) => d ? Number((100 * n / d).toFixed(1)) : null

function summarize(rows, field) {
  const scorable = rows.filter((row) => row.scorable)
  const automatic = scorable.filter((row) => row[field].automatic)
  const correct = automatic.filter((row) => row[field].read === row.truthText)
  return {
    scorableAnswers: scorable.length,
    automatic: automatic.length,
    automaticCoveragePct: pct(automatic.length, scorable.length),
    automaticCorrect: correct.length,
    automaticAccuracyPct: pct(correct.length, automatic.length),
    confidentErrors: automatic.length - correct.length,
    yellow: scorable.length - automatic.length,
    yellowRatePct: pct(scorable.length - automatic.length, scorable.length),
  }
}

function grouped(rows, field) {
  const values = [...new Set(rows.map((row) => String(row[field] ?? 'unknown')))].sort()
  return Object.fromEntries(values.map((value) => {
    const selected = rows.filter((row) => String(row[field] ?? 'unknown') === value)
    return [value, {
      noBroadVeto: summarize(selected, 'noBroadVeto'),
      repaired: summarize(selected, 'repaired'),
    }]
  }))
}

function predictionRows(debug, questionNum) {
  return (debug.predictions || [])
    .filter((prediction) => Number(prediction?.questionNum) === Number(questionNum))
    .sort((a, b) => Number(a?.digitIndex || 0) - Number(b?.digitIndex || 0))
}

function main() {
  const frozenBeta7Audit = readJson(path.join(
    ROOT,
    'private-evidence/reports/beta7-independent-safety-audit-20260723.json',
  ))
  execFileSync(process.execPath, [
    path.join(ROOT, 'scripts/audit_beta7_safety_repair.mjs'),
    baseAuditPath,
  ], { cwd: ROOT, stdio: 'ignore' })
  const audit = readJson(baseAuditPath)
  fs.unlinkSync(baseAuditPath)

  const strong = [
    ...readJson(path.join(ROOT, 'private-evidence/reports/v3-strong-evidence-view-benchmark-20260717.json')).rows,
    ...readJson(path.join(ROOT, 'private-evidence/reports/p05-strong-evidence-view-benchmark-20260717.json')).rows,
  ]
  const scout = [
    ...readJson(path.join(ROOT, 'private-evidence/reports/v3-whole-slot-crossfit-checkpointed-seed79-20260717.json'))
      .folds.flatMap((fold) => fold.heldOutRows),
    ...readJson(path.join(ROOT, 'private-evidence/reports/v3-whole-slot-crop-metadata-p05-external-seed79-20260717.json'))
      .folds.flatMap((fold) => fold.heldOutRows),
  ]
  const strongByUid = new Map(strong.map((row) => [row.uid, row]))
  const scoutByUid = new Map(scout.map((row) => [row.uid, row]))
  const debugCache = new Map()

  const rows = audit.rows.map((row) => {
    let debug = debugCache.get(row.debugFile)
    if (!debug) {
      debug = readJson(path.join(ROOT, row.debugFile))
      debugCache.set(row.debugFile, debug)
    }
    const predictions = predictionRows(debug, row.questionNum)
    const strongRow = strongByUid.get(row.uid)
    const scoutRow = scoutByUid.get(row.uid)
    if (row.scorable && (!strongRow || !scoutRow)) {
      throw new Error(`Missing independent evidence for ${row.uid}`)
    }
    const noBroadVeto = {
      read: row.beta7.read,
      automatic: row.beta7.automatic,
      reason: row.beta7.reason,
    }
    const route = acceptedAnswerSafetyRoute({
      currentAutomatic: noBroadVeto.automatic,
      currentRead: noBroadVeto.read,
      predictions,
      scout: OMIT_SCOUT ? null : (scoutRow || null),
      layoutId: row.layoutId,
    })
    const safety = acceptedAnswerSafetyDecision({
      routed: route.route,
      currentRead: noBroadVeto.read,
      continuous: strongRow?.reads?.continuous,
      stitched: strongRow?.reads?.stitched,
      scout: OMIT_SCOUT ? null : (scoutRow || null),
      predictions,
      slotCount: strongRow?.slotCount,
      layoutId: row.layoutId,
    })
    const repaired = {
      read: noBroadVeto.read,
      automatic: noBroadVeto.automatic && safety.veto !== true,
      reason: safety.veto ? safety.reason : noBroadVeto.reason,
    }
    return {
      uid: row.uid,
      packetId: row.packetId,
      studentId: row.studentId,
      pageId: row.pageId,
      layoutId: row.layoutId,
      templateId: row.templateId,
      layoutFamily: row.layoutFamily,
      answerLength: row.answerLength,
      captureQuality: row.captureQuality,
      questionNum: row.questionNum,
      truthText: row.truthText,
      scorable: row.scorable,
      debugFile: row.debugFile,
      noBroadVeto,
      repaired,
      route,
      safety,
      changed: noBroadVeto.automatic !== repaired.automatic,
      correctChangedDecision: row.scorable ? noBroadVeto.read === row.truthText : null,
      strongEvidencePaths: strongRow?.paths || null,
    }
  })

  const routed = rows.filter((row) => row.route.route)
  const changed = rows.filter((row) => row.changed)
  const confidentErrors = rows.filter((row) =>
    row.scorable && row.repaired.automatic && row.repaired.read !== row.truthText)
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    purpose: 'Key-blind shadow evaluation of Beta 15.3/Beta 7 without the over-broad yellow veto plus suspicious accepted-answer second-reader safety.',
    evidenceBoundary: audit.evidenceBoundary,
    answerKeyProvidedToPolicy: false,
    mathematicalCorrectnessUsedAsTruth: false,
    noBroadVeto: summarize(rows, 'noBroadVeto'),
    repaired: summarize(rows, 'repaired'),
    frozenBeta7: frozenBeta7Audit.beta7,
    routing: {
      acceptedAnswers: rows.filter((row) => row.scorable && row.noBroadVeto.automatic).length,
      routedAcceptedAnswers: routed.filter((row) => row.scorable && row.noBroadVeto.automatic).length,
      routedAcceptedPct: pct(
        routed.filter((row) => row.scorable && row.noBroadVeto.automatic).length,
        rows.filter((row) => row.scorable && row.noBroadVeto.automatic).length,
      ),
      pagesWithRoutedAnswers: new Set(routed.map((row) => row.pageId)).size,
      totalPages: new Set(rows.map((row) => row.pageId)).size,
    },
    changedDecisionCount: changed.length,
    changedCorrectToYellow: changed.filter((row) => row.correctChangedDecision === true).length,
    changedErrorToYellow: changed.filter((row) => row.correctChangedDecision === false).length,
    confidentErrorCount: confidentErrors.length,
    byStudent: grouped(rows, 'studentId'),
    byPacket: grouped(rows, 'packetId'),
    byTemplate: grouped(rows, 'templateId'),
    byLayoutFamily: grouped(rows, 'layoutFamily'),
    byAnswerLength: grouped(rows, 'answerLength'),
    byCaptureQuality: grouped(rows, 'captureQuality'),
    integrity: {
      deterministicIdenticalInput: JSON.stringify(rows.map((row) => ({
        uid: row.uid,
        route: acceptedAnswerSafetyRoute({
          currentAutomatic: row.noBroadVeto.automatic,
          currentRead: row.noBroadVeto.read,
          predictions: predictionRows(debugCache.get(row.debugFile), row.questionNum),
          scout: OMIT_SCOUT ? null : scoutByUid.get(row.uid),
          layoutId: row.layoutId,
        }),
      }))) === JSON.stringify(rows.map((row) => ({ uid: row.uid, route: row.route }))),
      answerKeyFieldsPassedToPolicy: false,
      truthFieldsPassedToPolicy: false,
      everyCanonicalAnswerJoined: rows.length === audit.rows.length,
    },
    regressionAudit: {
      definition: 'A material cohort regression is a new confident error or a loss of more than one correctly automatic answer versus frozen Beta 7.',
      byPacket: Object.fromEntries(Object.entries(grouped(rows, 'packetId')).map(([packetId, result]) => {
        const frozen = frozenBeta7Audit.byPacket?.[packetId]?.beta7
        const automaticCorrectDelta = result.repaired.automaticCorrect - Number(frozen?.automaticCorrect || 0)
        return [packetId, {
          frozenBeta7AutomaticCorrect: frozen?.automaticCorrect ?? null,
          repairedAutomaticCorrect: result.repaired.automaticCorrect,
          automaticCorrectDelta,
          repairedConfidentErrors: result.repaired.confidentErrors,
          materialRegression: result.repaired.confidentErrors > 0 || automaticCorrectDelta < -1,
        }]
      })),
    },
    gate: {
      zeroKnownConfidentErrors: confidentErrors.length === 0,
      improvesCoverageVersusFrozenBeta7:
        summarize(rows, 'repaired').automatic > frozenBeta7Audit.beta7.automatic,
      improvesCorrectAutomaticVersusFrozenBeta7:
        summarize(rows, 'repaired').automaticCorrect > frozenBeta7Audit.beta7.automaticCorrect,
      deterministicIdenticalInput: true,
      noMaterialPacketRegression: true,
      pass: false,
    },
    changedRows: changed,
    confidentErrorRows: confidentErrors,
    rows,
  }
  report.gate.deterministicIdenticalInput = report.integrity.deterministicIdenticalInput
  report.gate.noMaterialPacketRegression = Object.values(report.regressionAudit.byPacket)
    .every((item) => item.materialRegression === false)
  report.gate.pass = report.gate.zeroKnownConfidentErrors &&
    report.gate.improvesCoverageVersusFrozenBeta7 &&
    report.gate.improvesCorrectAutomaticVersusFrozenBeta7 &&
    report.gate.deterministicIdenticalInput &&
    report.gate.noMaterialPacketRegression

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true })
  fs.writeFileSync(OUTPUT, `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify({
    output: path.relative(ROOT, OUTPUT),
    noBroadVeto: report.noBroadVeto,
    repaired: report.repaired,
    routing: report.routing,
    changedDecisionCount: report.changedDecisionCount,
    changedCorrectToYellow: report.changedCorrectToYellow,
    changedErrorToYellow: report.changedErrorToYellow,
    gate: report.gate,
  }, null, 2))
}

main()
