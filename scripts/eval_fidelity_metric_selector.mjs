#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'

const DIGIT_ROWS = 'private-evidence/reports/digit-failure-dataset-20260705-current/digit-rows.json'
const STAGES = 'private-evidence/reports/preprocess-stage-fidelity-20260709.json'
const PIPELINE = 'private-evidence/reports/pipeline-fidelity-audit-20260709.json'
const OUT = 'private-evidence/reports/fidelity-metric-selector-20260709.json'

const digitRows = JSON.parse(await fs.readFile(DIGIT_ROWS, 'utf8')).filter((row) => row.truthDigit !== null)
const stageRows = JSON.parse(await fs.readFile(STAGES, 'utf8')).rowsData
const pipelineRows = JSON.parse(await fs.readFile(PIPELINE, 'utf8')).rows
const stageByKey = new Map(stageRows.map((row) => [row.key, row]))
const pipelineByKey = new Map(pipelineRows.map((row) => [`${row.captureId}::${row.detailId}`, row]))
const debugCache = new Map()
async function debugFor(file) {
  if (!debugCache.has(file)) {
    const parsed = JSON.parse(await fs.readFile(file, 'utf8'))
    debugCache.set(file, parsed?.debug || parsed)
  }
  return debugCache.get(file)
}
const rows = []
for (const row of digitRows) {
  const key = `${row.captureId}::${row.detailId}`
  const debug = await debugFor(row.debugPath)
  const prediction = (debug.predictions || []).find((item) => Number(item?.id) === Number(row.detailId))
  rows.push({
    ...row,
    stage: stageByKey.get(key),
    pipeline: pipelineByKey.get(key),
    alternatives: Object.fromEntries((prediction?.preprocessVariants || []).map((item) => [item.name, item.digit]))
  })
}
function pct(n, d) { return d ? Number((100 * n / d).toFixed(1)) : 0 }
function evaluate(items, policy) {
  let correct = 0, changed = 0, changesCorrect = 0, changesWrong = 0
  for (const row of items) {
    const read = policy(row)
    if (String(read) === String(row.truthDigit)) correct += 1
    if (String(read) !== String(row.detailDigit)) {
      changed += 1
      if (String(read) === String(row.truthDigit)) changesCorrect += 1
      else changesWrong += 1
    }
  }
  return { total: items.length, correct, accuracyPct: pct(correct, items.length), changed, changesCorrect, changesWrong }
}
const metricSpecs = {
  strictRemovedFromGentle: (row) => row.stage?.strictVsGentle?.removedFraction,
  boxCenterShiftMagnitude: (row) => row.pipeline?.boxCenterShiftMagnitude,
  boxWidthRatio: (row) => row.pipeline?.boxWidthRatio,
  boxHeightRatio: (row) => row.pipeline?.boxHeightRatio,
  rawLuminanceStd: (row) => row.pipeline?.rawLuminanceStd,
  preprocessScale: (row) => row.pipeline?.preprocessScale
}
const alternatives = ['gentle', 'edge-band-slot', 'wide-slot', 'raw-border-slot']
const calibration = rows.filter((row) => row.split === 'calibration')
const results = []
for (const [metricName, metric] of Object.entries(metricSpecs)) {
  const thresholds = [...new Set(calibration.map(metric).filter(Number.isFinite))].sort((a, b) => a - b)
  for (const alternative of alternatives) {
    for (const direction of ['high', 'low']) {
      let best = null
      for (const threshold of thresholds) {
        const policy = (row) => {
          const value = metric(row), alt = row.alternatives[alternative]
          const triggered = Number.isFinite(value) && (direction === 'high' ? value >= threshold : value <= threshold)
          return triggered && alt !== undefined ? alt : row.detailDigit
        }
        const score = evaluate(calibration, policy)
        if (!best || score.correct > best.calibration.correct || (score.correct === best.calibration.correct && score.changed < best.calibration.changed)) {
          best = { metric: metricName, alternative, direction, threshold, policy, calibration: score }
        }
      }
      if (!best) continue
      results.push({
        metric: best.metric,
        alternative: best.alternative,
        direction: best.direction,
        threshold: best.threshold,
        calibration: best.calibration,
        validation: evaluate(rows.filter((row) => row.split === 'validation'), best.policy),
        holdout: evaluate(rows.filter((row) => row.split === 'holdout'), best.policy)
      })
    }
  }
}
results.sort((a, b) => b.validation.correct - a.validation.correct || b.holdout.correct - a.holdout.correct)
const baseline = Object.fromEntries(['calibration', 'validation', 'holdout'].map((split) => [split, evaluate(rows.filter((row) => row.split === split), (row) => row.detailDigit)]))
const report = { generatedAt: new Date().toISOString(), answerKeyUsed: false, handwrittenTruthUsed: true, baseline, results }
await fs.mkdir(path.dirname(OUT), { recursive: true })
await fs.writeFile(OUT, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ baseline, top: results.slice(0, 12), out: OUT }, null, 2))
