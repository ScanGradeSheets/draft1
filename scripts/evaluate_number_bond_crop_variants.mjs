#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCanvas, loadImage } from 'canvas'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const scorePath = path.resolve(ROOT, process.argv[2] || 'private-evidence/reports/evidence-pipeline-final-score-20260714.json')
const outPath = path.resolve(ROOT, process.argv[3] || 'private-evidence/reports/number-bond-crop-variants-20260715.json')
const baseUrl = String(process.env.SG_REVIEW_URL || 'https://hobbes-mac-mini.tail9a3379.ts.net/review-model').replace(/\/$/, '')
const requestOrigin = String(process.env.SG_REVIEW_ORIGIN || new URL(baseUrl).origin)
const layoutFilter = String(process.env.SG_LAYOUT_FILTER || 'sg-g1-lw-08-number-bonds')
const digits = (value) => String(value ?? '').replace(/\D/g, '')
const pct = (n, d) => d ? Number((100 * n / d).toFixed(1)) : null

function crop(source, x, y, width, height, outWidth = width, outHeight = height) {
  const canvas = createCanvas(Math.max(1, Math.round(outWidth)), Math.max(1, Math.round(outHeight)))
  const context = canvas.getContext('2d')
  context.fillStyle = '#fff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(source, x, y, width, height, 0, 0, canvas.width, canvas.height)
  return canvas
}

function masked(source, fraction, slotCount, center = false) {
  const canvas = crop(source, 0, 0, source.width, source.height)
  const context = canvas.getContext('2d')
  const x = Math.max(1, Math.round(canvas.width * fraction))
  const y = Math.max(1, Math.round(canvas.height * fraction))
  context.fillStyle = '#fff'
  context.fillRect(0, 0, canvas.width, y)
  context.fillRect(0, canvas.height - y, canvas.width, y)
  context.fillRect(0, 0, x, canvas.height)
  context.fillRect(canvas.width - x, 0, x, canvas.height)
  if (center && slotCount > 1) {
    const centerWidth = Math.max(2, Math.round(canvas.width * 0.018))
    const centerX = Math.round((canvas.width - centerWidth) / 2)
    const endpointHeight = Math.round(canvas.height * 0.22)
    context.fillRect(centerX, 0, centerWidth, endpointHeight)
    context.fillRect(centerX, canvas.height - endpointHeight, centerWidth, endpointHeight)
  }
  return canvas
}

function primaryVariants(primary, contextImage, primaryRect, contextRect, slotCount) {
  const variants = new Map([['primary', crop(primary, 0, 0, primary.width, primary.height)]])
  for (const fraction of [.02, .04, .06]) {
    const dx = Math.max(1, Math.round(primary.width * fraction))
    const dy = Math.max(1, Math.round(primary.height * fraction))
    variants.set(`trim-all-${fraction}`, crop(primary, dx, dy, primary.width - 2 * dx, primary.height - 2 * dy))
    variants.set(`trim-x-${fraction}`, crop(primary, dx, 0, primary.width - 2 * dx, primary.height))
    variants.set(`trim-y-${fraction}`, crop(primary, 0, dy, primary.width, primary.height - 2 * dy))
    variants.set(`mask-edge-${fraction}`, masked(primary, fraction, slotCount, false))
    if (slotCount > 1) variants.set(`mask-edge-center-${fraction}`, masked(primary, fraction, slotCount, true))
  }
  if (contextImage && primaryRect && contextRect) {
    const baseX = primaryRect.x - contextRect.x
    const baseY = primaryRect.y - contextRect.y
    for (const fraction of [.04, .08]) {
      const dx = Math.round(primary.width * fraction)
      const dy = Math.round(primary.height * fraction)
      for (const [name, sx, sy] of [
        ['left', -dx, 0], ['right', dx, 0], ['up', 0, -dy], ['down', 0, dy],
      ]) {
        variants.set(`context-shift-${name}-${fraction}`, crop(contextImage, baseX + sx, baseY + sy, primary.width, primary.height))
      }
      variants.set(`context-expand-${fraction}`, crop(contextImage, baseX - dx, baseY - dy, primary.width + 2 * dx, primary.height + 2 * dy))
    }
  }
  return variants
}

async function recognize(items) {
  const output = []
  for (let offset = 0; offset < items.length; offset += 24) {
    const batch = items.slice(offset, offset + 24)
    const response = await fetch(`${baseUrl}/recognize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: requestOrigin },
      body: JSON.stringify({ items: batch }),
    })
    if (!response.ok) throw new Error(`strong service returned ${response.status}`)
    const payload = await response.json()
    if (payload.answerKeyUsed !== false || payload.results?.length !== batch.length) throw new Error('key-blind/completeness contract failed')
    output.push(...payload.results)
  }
  return output
}

const score = JSON.parse(fs.readFileSync(scorePath, 'utf8'))
const sourceRows = score.rows.filter((row) => row.scorable && (
  layoutFilter === 'non-row' ? row.layoutFamily === 'non-row' : row.layoutId === layoutFilter
))
const items = []
const metadata = new Map()
for (const row of sourceRows) {
  const debug = JSON.parse(fs.readFileSync(path.join(ROOT, row.debugFile), 'utf8'))
  const primaryZone = (debug.v3AnswerZones || []).find((zone) => Number(zone.questionNum) === Number(row.questionNum))
  const contextZone = (debug.v3ContextAnswerZones || []).find((zone) => Number(zone.questionNum) === Number(row.questionNum))
  if (!primaryZone?.imageDataUrl) throw new Error(`missing primary zone ${row.packetId}|${row.questionNum}`)
  const primary = await loadImage(primaryZone.imageDataUrl)
  const contextImage = contextZone?.imageDataUrl ? await loadImage(contextZone.imageDataUrl) : null
  const variants = primaryVariants(primary, contextImage, primaryZone.rect, contextZone?.rect, primaryZone.digitBoxIds?.length || row.answerLength)
  for (const [variant, canvas] of variants) {
    const id = `${row.packetId}|${row.layoutId}|${row.questionNum}|${variant}`
    items.push({ id, questionNum: Number(row.questionNum), imageDataUrl: canvas.toDataURL('image/png') })
    metadata.set(id, { row, variant })
  }
}

const inference = await recognize(items)
const rows = inference.map((result) => {
  const source = metadata.get(String(result.id))
  const read = digits(result.read)
  return {
    packetId: source.row.packetId,
    layoutId: source.row.layoutId,
    questionNum: source.row.questionNum,
    truthText: source.row.truthText,
    currentAutomatic: source.row.automatic,
    variant: source.variant,
    read,
    correct: read === source.row.truthText,
    minTokenProbability: Number(result.minTokenProbability || 0),
    meanTokenProbability: Number(result.meanTokenProbability || 0),
  }
})

const variantNames = [...new Set(rows.map((row) => row.variant))].sort()
const byVariant = Object.fromEntries(variantNames.map((variant) => {
  const group = rows.filter((row) => row.variant === variant)
  const yellow = group.filter((row) => !row.currentAutomatic)
  return [variant, {
    answers: group.length,
    correct: group.filter((row) => row.correct).length,
    accuracyPct: pct(group.filter((row) => row.correct).length, group.length),
    yellowAnswers: yellow.length,
    yellowCorrect: yellow.filter((row) => row.correct).length,
    yellowAccuracyPct: pct(yellow.filter((row) => row.correct).length, yellow.length),
    confidentCorrect: group.filter((row) => row.correct && row.minTokenProbability >= .70).length,
    confidentWrong: group.filter((row) => !row.correct && row.minTokenProbability >= .70).length,
  }]
}))
const perAnswer = sourceRows.map((source) => {
  const group = rows.filter((row) => row.packetId === source.packetId && row.layoutId === source.layoutId && Number(row.questionNum) === Number(source.questionNum))
  const votes = new Map()
  for (const row of group) votes.set(row.read, (votes.get(row.read) || 0) + 1)
  const ranking = [...votes.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  return {
    packetId: source.packetId,
    layoutId: source.layoutId,
    questionNum: source.questionNum,
    truthText: source.truthText,
    currentAutomatic: source.automatic,
    variantCount: group.length,
    correctVariantCount: group.filter((row) => row.correct).length,
    majorityRead: ranking[0]?.[0] || '',
    majorityCount: ranking[0]?.[1] || 0,
    majorityCorrect: ranking[0]?.[0] === source.truthText,
    reads: ranking.map(([read, count]) => ({ read, count })),
  }
})
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  purpose: `Key-blind selected-frame crop-geometry and restrained print-mask diagnostic across ${layoutFilter}.`,
  layoutFilter,
  answerKeyProvidedToModel: false,
  truthUsedOnlyAfterInference: true,
  sourceScore: path.relative(ROOT, scorePath),
  service: baseUrl,
  answers: sourceRows.length,
  inferenceItems: items.length,
  byVariant,
  perAnswer,
  rows,
}
fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({
  out: path.relative(ROOT, outPath),
  answers: sourceRows.length,
  inferenceItems: items.length,
  bestVariants: Object.entries(byVariant).sort((a, b) => b[1].correct - a[1].correct || a[1].confidentWrong - b[1].confidentWrong).slice(0, 12),
  yellowMajorityCorrect: perAnswer.filter((row) => !row.currentAutomatic && row.majorityCorrect).length,
}, null, 2))
