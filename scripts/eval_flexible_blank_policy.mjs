#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'

const DEFAULT_ROWS = 'private-evidence/reports/digit-failure-dataset-20260705-current/digit-rows.json'
const DEFAULT_OUT = 'private-evidence/reports/flexible-blank-policy-20260705/summary.json'

function parseArgs(argv) {
  const opts = { rows: DEFAULT_ROWS, out: DEFAULT_OUT }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--rows') opts.rows = argv[++i]
    else if (arg === '--out') opts.out = argv[++i]
  }
  return opts
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'))
}

function numberOrZero(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function tensorInkQuality(tensor, id = null) {
  const values = tensor && typeof tensor.length === 'number' ? tensor : []
  let inkPixels = 0
  let minX = 28
  let minY = 28
  let maxX = -1
  let maxY = -1
  const rowCounts = Array(28).fill(0)
  const colCounts = Array(28).fill(0)
  let edgeInkPixels = 0
  for (let i = 0; i < Math.min(values.length, 28 * 28); i += 1) {
    const value = Number(values[i]) || 0
    if (value <= 0.16) continue
    const y = Math.floor(i / 28)
    const x = i - y * 28
    inkPixels += 1
    rowCounts[y] += 1
    colCounts[x] += 1
    if (x <= 1 || x >= 26 || y <= 1 || y >= 26) edgeInkPixels += 1
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  const inkW = maxX >= minX ? maxX - minX + 1 : 0
  const inkH = maxY >= minY ? maxY - minY + 1 : 0
  const density = inkW > 0 && inkH > 0 ? inkPixels / (inkW * inkH) : 0
  const maxRowCount = rowCounts.length ? Math.max(...rowCounts) : 0
  const maxColCount = colCounts.length ? Math.max(...colCounts) : 0
  const edgeInkRatio = inkPixels ? edgeInkPixels / inkPixels : 0
  const horizontalArtifactLikely =
    inkPixels >= 8 &&
    inkW >= 11 &&
    (inkH <= 6 || maxRowCount >= Math.max(9, Math.round(inkPixels * 0.42)))
  const verticalEdgeArtifactLikely =
    inkPixels >= 10 &&
    inkPixels <= 90 &&
    inkW <= 7 &&
    inkH >= 12 &&
    density <= 0.72 &&
    edgeInkRatio >= 0.30
  const edgeArtifactLikely =
    inkPixels >= 8 &&
    edgeInkRatio >= 0.48 &&
    (inkW <= 8 || inkH <= 8 || density <= 0.46)
  const lineArtifactLikely =
    horizontalArtifactLikely ||
    verticalEdgeArtifactLikely ||
    edgeArtifactLikely
  const plausibleDigitShape =
    inkPixels >= 14 &&
    inkW >= 3 &&
    inkH >= 8 &&
    !horizontalArtifactLikely &&
    !edgeArtifactLikely
  return {
    id,
    inkPixels,
    inkW,
    inkH,
    density,
    maxRowCount,
    maxColCount,
    edgeInkRatio,
    horizontalArtifactLikely,
    verticalEdgeArtifactLikely,
    edgeArtifactLikely,
    lineArtifactLikely,
    ok: plausibleDigitShape
  }
}

function tensorQualityScore(quality) {
  if (!quality) return -Infinity
  let score = 0
  if (quality.ok) score += 1000
  if (!quality.lineArtifactLikely) score += 220
  if (quality.horizontalArtifactLikely) score -= 220
  if (quality.edgeArtifactLikely) score -= 160
  if (quality.verticalEdgeArtifactLikely) score -= 120
  score += Math.min(quality.inkPixels || 0, 120)
  score += Math.min(quality.inkW || 0, 20) * 4
  score += Math.min(quality.inkH || 0, 24) * 4
  score -= Math.round((quality.edgeInkRatio || 0) * 90)
  return score
}

function bestTensorInkQuality(proc) {
  const candidates = [
    { name: 'base', tensor: proc?.tensor },
    ...(Array.isArray(proc?.tensorVariants) ? proc.tensorVariants : [])
  ].filter((candidate) => candidate?.tensor)

  let best = null
  let base = null
  let strict = null
  const variantQualities = []
  for (const candidate of candidates) {
    const quality = {
      ...tensorInkQuality(candidate.tensor, proc?.id),
      variantName: candidate.name || 'variant'
    }
    variantQualities.push(quality)
    if (quality.variantName === 'base') base = quality
    if (quality.variantName === 'strict') strict = quality
    if (!best || tensorQualityScore(quality) > tensorQualityScore(best)) {
      best = quality
    }
  }

  const summaryQualities = variantQualities.some((quality) => quality.variantName !== 'base')
    ? variantQualities.filter((quality) => quality.variantName !== 'base')
    : variantQualities
  const variantCount = summaryQualities.length
  const usableVariantCount = summaryQualities.filter((quality) => (
    quality.ok &&
    !quality.lineArtifactLikely &&
    !quality.horizontalArtifactLikely &&
    !quality.edgeArtifactLikely &&
    (quality.inkPixels || 0) >= 14 &&
    (quality.inkH || 0) >= 7
  )).length
  const artifactVariantCount = summaryQualities.filter((quality) => (
    quality.lineArtifactLikely ||
    quality.horizontalArtifactLikely ||
    quality.edgeArtifactLikely ||
    quality.verticalEdgeArtifactLikely
  )).length
  const weakVariantCount = summaryQualities.filter((quality) => (
    !quality.ok ||
    (quality.inkPixels || 0) < 12 ||
    (quality.inkH || 0) < 6 ||
    quality.horizontalArtifactLikely ||
    quality.edgeArtifactLikely
  )).length
  const artifactVariantRatio = variantCount ? artifactVariantCount / variantCount : 0
  const weakVariantRatio = variantCount ? weakVariantCount / variantCount : 0
  const allVariantsWeak = variantCount > 0 && usableVariantCount === 0
  const guard = strict || base || best || tensorInkQuality(proc?.tensor, proc?.id)
  return {
    ...guard,
    id: proc?.id,
    guardVariantName: guard.variantName || 'guard',
    bestVariantName: best?.variantName || guard.variantName || 'guard',
    bestQuality: best,
    baseQuality: base,
    strictQuality: strict,
    variantQualities,
    variantCount,
    usableVariantCount,
    artifactVariantCount,
    weakVariantCount,
    artifactVariantRatio,
    weakVariantRatio,
    allVariantsWeak
  }
}

function matchingOptionalDigitLooksUsable(prediction, quality) {
  if (!prediction || !quality) return false
  const confidence = numberOrZero(prediction.confidence)
  const topGap = numberOrZero(prediction.topGap)
  const inkPixels = numberOrZero(quality?.inkPixels)
  const maxRowCount = numberOrZero(quality?.maxRowCount)
  const weakRatio = numberOrZero(quality?.weakVariantRatio)
  const artifactRatio = numberOrZero(quality?.artifactVariantRatio)
  if (confidence >= 0.86 && topGap >= 0.50) return true
  return (
    confidence >= 0.74 &&
    topGap >= 0.30 &&
    inkPixels >= 42 &&
    maxRowCount >= 5 &&
    weakRatio < 0.55 &&
    artifactRatio < 0.35
  )
}

function plausibleSingleDigitResponseSlot(prediction, quality) {
  if (!prediction || !quality) return false
  const confidence = numberOrZero(prediction.confidence)
  const topGap = numberOrZero(prediction.topGap)
  const inkPixels = numberOrZero(quality?.inkPixels)
  const inkW = numberOrZero(quality?.inkW)
  const inkH = numberOrZero(quality?.inkH)
  const weakRatio = numberOrZero(quality?.weakVariantRatio)
  const artifactRatio = numberOrZero(quality?.artifactVariantRatio)
  if (
    quality?.lineArtifactLikely === true ||
    quality?.horizontalArtifactLikely === true ||
    quality?.edgeArtifactLikely === true ||
    quality?.allVariantsWeak === true
  ) {
    return false
  }
  if (matchingOptionalDigitLooksUsable(prediction, quality)) return true
  if (quality?.ok && inkPixels >= 42 && inkW >= 9 && inkH >= 10 && weakRatio < 0.55 && artifactRatio < 0.30) {
    return confidence >= 0.50 && topGap >= 0.12
  }
  return false
}

function oneDigitResponseSlotCanAutoGrade(prediction, quality) {
  if (!prediction || !plausibleSingleDigitResponseSlot(prediction, quality)) return false
  const confidence = numberOrZero(prediction.confidence)
  const topGap = numberOrZero(prediction.topGap)
  const weakRatio = numberOrZero(quality?.weakVariantRatio)
  const artifactRatio = numberOrZero(quality?.artifactVariantRatio)
  return confidence >= 0.82 && topGap >= 0.42 && weakRatio < 0.45 && artifactRatio < 0.22
}

function optionalBlankSlotLooksLikeArtifact(prediction, quality, mode = 'current') {
  if (!prediction) return false
  const confidence = numberOrZero(prediction.confidence)
  const topGap = numberOrZero(prediction.topGap)
  const reason = String(prediction.preprocessReviewReason || '')
  const reviewSignal =
    prediction.reviewNeeded === true ||
    prediction.highRiskPreprocessReview === true ||
    prediction.structuralReview === true ||
    prediction.preprocessDisagreement === true ||
    reason.length > 0
  const weakModel = confidence < 0.72 || topGap < 0.35
  const weakInk =
    !quality?.ok ||
    quality?.allVariantsWeak === true ||
    numberOrZero(quality?.weakVariantRatio) >= 0.35 ||
    numberOrZero(quality?.artifactVariantRatio) >= 0.15 ||
    numberOrZero(quality?.inkPixels) <= 38 ||
    numberOrZero(quality?.maxRowCount) <= 4 ||
    numberOrZero(quality?.inkW) <= 8
  const guideLineOne =
    prediction.digit === 1 &&
    reviewSignal &&
    (
      prediction.highRiskPreprocessReview === true ||
      reason.includes('mismatch') ||
      reason.includes('guide') ||
      reason.includes('two-digit')
    )
  const strongExtraDigit =
    confidence >= 0.93 &&
    topGap >= 0.82 &&
    prediction.reviewNeeded !== true &&
    !weakInk
  if (mode === 'current') return !strongExtraDigit && (guideLineOne || (reviewSignal && (weakModel || weakInk)))

  const strictGuideLineOne =
    prediction.digit === 1 &&
    (reason.includes('mismatch') || reason.includes('two-digit') || prediction.preprocessDisagreement === true) &&
    (
      weakInk ||
      numberOrZero(quality?.inkW) <= 7 ||
      numberOrZero(quality?.edgeInkRatio) >= 0.30
    )
  const strictWeakArtifact =
    reviewSignal &&
    weakModel &&
    weakInk &&
    numberOrZero(quality?.usableVariantCount) <= 4
  return !strongExtraDigit && (strictGuideLineOne || strictWeakArtifact)
}

function questionKey(row) {
  return `${row.captureId}::${row.questionLabel}`
}

async function loadRowsWithQuality(rows) {
  const debugCache = new Map()
  const replayCache = new Map()
  const out = []
  for (const row of rows) {
    if (!row.debugPath || !row.replayFile || row.truthSlotSource === 'unusable-truth') continue
    if (!debugCache.has(row.debugPath)) {
      const raw = await readJson(row.debugPath)
      debugCache.set(row.debugPath, raw?.debug && typeof raw.debug === 'object' ? raw.debug : raw)
    }
    if (!replayCache.has(row.replayFile)) {
      replayCache.set(row.replayFile, await readJson(row.replayFile))
    }
    const debug = debugCache.get(row.debugPath)
    const replay = replayCache.get(row.replayFile)
    const tensor = (debug.tensors || []).find((item) => Number(item.id) === Number(row.detailId))
    const detail = (replay.predictionDetails || []).find((item) => Number(item.id) === Number(row.detailId))
    if (!tensor || !detail) continue
    out.push({ row, detail, quality: bestTensorInkQuality(tensor) })
  }
  return out
}

function evaluateGroups(items, mode) {
  const byQuestion = new Map()
  for (const item of items) {
    const key = questionKey(item.row)
    if (!byQuestion.has(key)) byQuestion.set(key, [])
    byQuestion.get(key).push(item)
  }

  const report = {
    mode,
    twoSlotGroups: 0,
    candidateGroups: 0,
    wouldBlankSlots: 0,
    trueBlankSlotsFixed: 0,
    falseBlankFilledSlots: 0,
    missedBlankSlots: 0,
    bySplit: {},
    byFamily: {},
    byLayout: {},
    examples: []
  }

  function bump(bucket, key, patch) {
    if (!bucket[key]) {
      bucket[key] = {
        candidateGroups: 0,
        wouldBlankSlots: 0,
        trueBlankSlotsFixed: 0,
        falseBlankFilledSlots: 0,
        missedBlankSlots: 0
      }
    }
    for (const [field, value] of Object.entries(patch)) bucket[key][field] += value
  }

  for (const groupItems of byQuestion.values()) {
    if (groupItems.length !== 2) continue
    if (!groupItems.every((item) => Number(item.row.slotCount) === 2)) continue
    report.twoSlotGroups += 1
    const slots = groupItems
      .sort((a, b) => Number(a.row.digitIndex) - Number(b.row.digitIndex))
      .map((item, slotIndex) => ({ ...item, slotIndex }))
    const plausible = slots.filter((slot) => plausibleSingleDigitResponseSlot(slot.detail, slot.quality))
    if (plausible.length !== 1) continue
    const blankSlot = slots.find((slot) => slot.slotIndex !== plausible[0].slotIndex)
    if (!blankSlot) continue
    if (!optionalBlankSlotLooksLikeArtifact(blankSlot.detail, blankSlot.quality, mode)) continue
    report.candidateGroups += 1
    report.wouldBlankSlots += 1
    const good = blankSlot.row.truthBlank === true
    const bad = blankSlot.row.truthDigit !== null
    if (good) report.trueBlankSlotsFixed += 1
    if (bad) report.falseBlankFilledSlots += 1
    const patch = {
      candidateGroups: 1,
      wouldBlankSlots: 1,
      trueBlankSlotsFixed: good ? 1 : 0,
      falseBlankFilledSlots: bad ? 1 : 0,
      missedBlankSlots: 0
    }
    bump(report.bySplit, String(blankSlot.row.split || 'unknown'), patch)
    bump(report.byFamily, String(blankSlot.row.family || 'unknown'), patch)
    bump(report.byLayout, String(blankSlot.row.layoutId || 'unknown'), patch)
    if (report.examples.length < 40) {
      report.examples.push({
        split: blankSlot.row.split,
        layoutId: blankSlot.row.layoutId,
        questionLabel: blankSlot.row.questionLabel,
        expected: blankSlot.row.expected,
        truth: blankSlot.row.truth,
        groupPredicted: blankSlot.row.groupPredicted,
        keptSlot: {
          index: plausible[0].slotIndex,
          digit: plausible[0].detail.digit,
          truthDigit: plausible[0].row.truthDigit,
          confidence: plausible[0].detail.confidence,
          topGap: plausible[0].detail.topGap
        },
        blankedSlot: {
          index: blankSlot.slotIndex,
          digit: blankSlot.detail.digit,
          truthDigit: blankSlot.row.truthDigit,
          truthBlank: blankSlot.row.truthBlank,
          confidence: blankSlot.detail.confidence,
          topGap: blankSlot.detail.topGap,
          reason: blankSlot.detail.preprocessReviewReason || null,
          quality: {
            inkPixels: blankSlot.quality.inkPixels,
            inkW: blankSlot.quality.inkW,
            inkH: blankSlot.quality.inkH,
            weakVariantRatio: blankSlot.quality.weakVariantRatio,
            artifactVariantRatio: blankSlot.quality.artifactVariantRatio,
            usableVariantCount: blankSlot.quality.usableVariantCount
          }
        }
      })
    }
  }

  const allBlankSlots = items.filter((item) => item.row.truthBlank === true)
  const fixedKeys = new Set(report.examples.filter((ex) => ex.blankedSlot.truthBlank).map((ex) => `${ex.layoutId}::${ex.questionLabel}::${ex.blankedSlot.index}`))
  report.missedBlankSlots = allBlankSlots.filter((item) => !fixedKeys.has(`${item.row.layoutId}::${item.row.questionLabel}::${Number(item.row.digitIndex)}`)).length
  return report
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const rows = await readJson(opts.rows)
  const items = await loadRowsWithQuality(rows)
  const current = evaluateGroups(items, 'current')
  const strict = evaluateGroups(items, 'strict')
  const report = {
    generatedAt: new Date().toISOString(),
    rows: opts.rows,
    itemCount: items.length,
    current,
    strict
  }
  await fs.mkdir(path.dirname(opts.out), { recursive: true })
  await fs.writeFile(opts.out, JSON.stringify(report, null, 2))
  console.log(JSON.stringify({
    out: opts.out,
    itemCount: items.length,
    current: {
      candidateGroups: current.candidateGroups,
      trueBlankSlotsFixed: current.trueBlankSlotsFixed,
      falseBlankFilledSlots: current.falseBlankFilledSlots
    },
    strict: {
      candidateGroups: strict.candidateGroups,
      trueBlankSlotsFixed: strict.trueBlankSlotsFixed,
      falseBlankFilledSlots: strict.falseBlankFilledSlots,
      bySplit: strict.bySplit
    }
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
