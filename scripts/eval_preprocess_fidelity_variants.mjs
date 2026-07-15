#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'

const ROWS_PATH = 'private-evidence/reports/digit-failure-dataset-20260705-current/digit-rows.json'
const OUT_PATH = 'private-evidence/reports/preprocess-fidelity-variant-eval-20260709.json'
const rows = JSON.parse(await fs.readFile(ROWS_PATH, 'utf8')).filter((row) => row.truthDigit !== null)
const debugCache = new Map()
async function debugFor(file) {
  if (!debugCache.has(file)) {
    const parsed = JSON.parse(await fs.readFile(file, 'utf8'))
    debugCache.set(file, parsed?.debug || parsed)
  }
  return debugCache.get(file)
}
function pct(n, d) { return d ? Number((100 * n / d).toFixed(1)) : 0 }
function bucket(items, read) {
  const usable = items.filter((item) => read(item) !== null)
  const correct = usable.filter((item) => String(read(item)) === String(item.truthDigit)).length
  return { total: items.length, available: usable.length, correct, accuracyOnAvailablePct: pct(correct, usable.length), effectiveCorrectPct: pct(correct, items.length) }
}

const joined = []
for (const row of rows) {
  const debug = await debugFor(row.debugPath)
  const prediction = (debug.predictions || []).find((item) => Number(item?.id) === Number(row.detailId))
  const variants = Object.fromEntries((prediction?.preprocessVariants || []).map((item) => [item.name, item.digit]))
  joined.push({ ...row, variantDigits: variants })
}
const variantNames = [...new Set(joined.flatMap((row) => Object.keys(row.variantDigits)))].sort()
const splits = ['calibration', 'validation', 'holdout']
const variants = {}
const currentRead = (row) => row.detailDigit
for (const name of variantNames) {
  const read = (row) => row.variantDigits[name] ?? null
  const availableRows = joined.filter((row) => read(row) !== null)
  variants[name] = {
    overall: bucket(joined, read),
    currentOnSameRows: bucket(availableRows, currentRead),
    bySplit: Object.fromEntries(splits.map((split) => [split, bucket(joined.filter((row) => row.split === split), read)])),
    byFamily: Object.fromEntries(['row', 'non-row'].map((family) => [family, bucket(joined.filter((row) => row.family === family), read)])),
    bySlot: Object.fromEntries(['single', 'left', 'right'].map((slot) => [slot, bucket(joined.filter((row) => row.slotName === slot), read)]))
  }
}
const report = {
  generatedAt: new Date().toISOString(),
  handwrittenTruthUsed: true,
  answerKeyUsed: false,
  current: {
    overall: bucket(joined, currentRead),
    bySplit: Object.fromEntries(splits.map((split) => [split, bucket(joined.filter((row) => row.split === split), currentRead)])),
    byFamily: Object.fromEntries(['row', 'non-row'].map((family) => [family, bucket(joined.filter((row) => row.family === family), currentRead)]))
  },
  variants
}
await fs.mkdir(path.dirname(OUT_PATH), { recursive: true })
await fs.writeFile(OUT_PATH, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ current: report.current, variants: Object.fromEntries(Object.entries(variants).map(([name, value]) => [name, { overall: value.overall, validation: value.bySplit.validation, holdout: value.bySplit.holdout }])) , out: OUT_PATH }, null, 2))
