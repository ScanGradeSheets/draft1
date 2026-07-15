#!/usr/bin/env node

// Estimates the value and limits of cross-frame exact agreement by treating
// controlled variants of each authentic gray crop as pseudo-frames. These are
// correlated simulations, not substitutes for real camera bursts.

import fs from 'node:fs'

const input = process.argv[2] || 'private-evidence/reports/capture-quality-consensus-confidence-20260713.json'
const output = process.argv[3] || 'private-evidence/reports/pseudo-frame-consensus-20260713.json'
const appModelReportPath = process.argv[4] || 'private-evidence/reports/trocr-lora-calibrated-2epoch-20260709.json'
const report = JSON.parse(fs.readFileSync(input, 'utf8'))
const appModelReport = JSON.parse(fs.readFileSync(appModelReportPath, 'utf8'))
const appReviewByKey = new Map([
  ...(appModelReport.validationRows || []),
  ...(appModelReport.holdoutRows || []),
].map((row) => [key(row), row.appReview === true]))
const conditionNames = Object.keys(report.conditions || {}).filter((name) => name !== 'enhanced')

function key(row) {
  return `${row.captureId}::${row.questionLabel}`
}

const rowsByCondition = new Map(conditionNames.map((name) => [
  name,
  new Map((report.conditions[name]?.rows || []).map((row) => [key(row), row])),
]))
const originalRows = report.conditions?.original?.rows || []

function chooseThree(values, start = 0, prefix = [], out = []) {
  if (prefix.length === 3) {
    out.push(prefix)
    return out
  }
  for (let index = start; index < values.length; index += 1) {
    chooseThree(values, index + 1, prefix.concat(values[index]), out)
  }
  return out
}

function summarize(rows, field = 'consensus') {
  const selected = rows.filter((row) => row[field])
  const correct = selected.filter((row) => row[field] === row.truth).length
  return {
    total: rows.length,
    consensus: selected.length,
    consensusCoveragePct: rows.length ? +(100 * selected.length / rows.length).toFixed(1) : 0,
    consensusCorrect: correct,
    consensusWrong: selected.length - correct,
    consensusAccuracyPct: selected.length ? +(100 * correct / selected.length).toFixed(1) : null,
    oracleAnyCorrect: rows.filter((row) => row.reads.some((item) => item.read === row.truth)).length,
  }
}

const combinations = chooseThree(conditionNames).map((conditions) => {
  const rows = originalRows.map((original) => {
    const reads = conditions.map((condition) => ({
      condition,
      read: rowsByCondition.get(condition)?.get(key(original))?.read || '',
      minTokenProbability: Number(rowsByCondition.get(condition)?.get(key(original))?.minTokenProbability || 0),
    }))
    const consensusAt = (threshold) => {
      const counts = new Map()
      for (const item of reads) {
        if (!item.read || item.minTokenProbability < threshold) continue
        counts.set(item.read, (counts.get(item.read) || 0) + 1)
      }
      const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1])
      return ranked[0]?.[1] >= 2 && ranked[0]?.[1] > (ranked[1]?.[1] || 0)
        ? ranked[0][0]
        : null
    }
    const counts = new Map()
    for (const item of reads) {
      if (!item.read) continue
      counts.set(item.read, (counts.get(item.read) || 0) + 1)
    }
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1])
    const consensus = ranked[0]?.[1] >= 2 && ranked[0]?.[1] > (ranked[1]?.[1] || 0)
      ? ranked[0][0]
      : null
    const consensus95 = consensusAt(0.95)
    const shadowHybrid = consensus95 && reads.some((item) => (
      item.read === consensus95 && item.minTokenProbability >= 0.999
    )) ? consensus95 : null
    return {
      captureId: original.captureId,
      questionLabel: original.questionLabel,
      split: original.split,
      layoutFamily: original.layoutFamily,
      answerLength: original.answerLength,
      currentNeedsReview: appReviewByKey.get(key(original)) === true,
      truth: original.truth,
      reads,
      consensus,
      consensus95,
      consensus98: consensusAt(0.98),
      consensus99: consensusAt(0.99),
      consensus995: consensusAt(0.995),
      consensus999: consensusAt(0.999),
      shadowHybrid,
    }
  })
  const confidencePolicies = Object.fromEntries([
    ['shadowHybrid', 'shadowHybrid'],
    ['0.95', 'consensus95'],
    ['0.98', 'consensus98'],
    ['0.99', 'consensus99'],
    ['0.995', 'consensus995'],
    ['0.999', 'consensus999'],
  ].map(([threshold, field]) => [threshold, {
    overall: summarize(rows, field),
    validation: summarize(rows.filter((row) => row.split === 'validation'), field),
    holdout: summarize(rows.filter((row) => row.split === 'holdout'), field),
  }]))
  return {
    conditions,
    overall: summarize(rows),
    validation: summarize(rows.filter((row) => row.split === 'validation')),
    holdout: summarize(rows.filter((row) => row.split === 'holdout')),
    row: summarize(rows.filter((row) => row.layoutFamily === 'row')),
    nonRow: summarize(rows.filter((row) => row.layoutFamily === 'non-row')),
    oneDigit: summarize(rows.filter((row) => Number(row.answerLength) === 1)),
    multiDigit: summarize(rows.filter((row) => Number(row.answerLength) > 1)),
    confidencePolicies,
    yellowShadowPolicy: {
      overall: summarize(rows.filter((row) => row.currentNeedsReview), 'shadowHybrid'),
      validation: summarize(rows.filter((row) => row.currentNeedsReview && row.split === 'validation'), 'shadowHybrid'),
      holdout: summarize(rows.filter((row) => row.currentNeedsReview && row.split === 'holdout'), 'shadowHybrid'),
    },
    rows,
  }
}).sort((a, b) =>
  b.holdout.consensusAccuracyPct - a.holdout.consensusAccuracyPct ||
  b.holdout.consensusCoveragePct - a.holdout.consensusCoveragePct)

const result = {
  generatedAt: new Date().toISOString(),
  method: 'Two-of-three exact agreement over simulated variants of authentic gray answer crops.',
  warning: 'Pseudo-frames share one source crop and therefore overstate independence. Use to design the policy; real burst captures are required for product evidence.',
  excludedCondition: 'enhanced (already shown to destroy pencil evidence)',
  combinations,
}
fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`)
console.log(JSON.stringify(combinations.map(({ conditions, overall, holdout }) => ({ conditions, overall, holdout })), null, 2))
console.log(output)
