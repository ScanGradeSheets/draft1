#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'

const DEFAULT_TRUTH = 'private-evidence/truth-labels/20260703-flex-duplicate-accepted-needs-label/handwritten-truth-labelled.json'
const DEFAULT_DEBUG_ROOT = 'private-evidence/debug-scans'

function parseArgs(argv) {
  const opts = {
    truth: DEFAULT_TRUTH,
    debugRoot: DEFAULT_DEBUG_ROOT,
    out: null,
    dirs: []
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--truth') opts.truth = argv[++i]
    else if (arg === '--debug-root') opts.debugRoot = argv[++i]
    else if (arg === '--out') opts.out = argv[++i]
    else opts.dirs.push(arg)
  }
  if (!opts.dirs.length) {
    throw new Error('Usage: node scripts/analyze_replay_visual_quality.mjs [--out file] <replay-dir>...')
  }
  return opts
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'))
}

async function collectReplayFiles(entry) {
  const stat = await fs.stat(entry).catch(() => null)
  if (!stat) return []
  if (stat.isFile()) return entry.endsWith('-replay-result.json') ? [entry] : []
  if (!stat.isDirectory()) return []
  const out = []
  const names = await fs.readdir(entry, { withFileTypes: true })
  for (const name of names) {
    const child = path.join(entry, name.name)
    if (name.isDirectory()) out.push(...await collectReplayFiles(child))
    else if (name.isFile() && name.name.endsWith('-replay-result.json')) out.push(child)
  }
  return out
}

async function collectDebugFiles(entry) {
  const stat = await fs.stat(entry).catch(() => null)
  if (!stat) return []
  if (stat.isFile()) return path.basename(entry) === 'debug.json' ? [entry] : []
  if (!stat.isDirectory()) return []
  const out = []
  const names = await fs.readdir(entry, { withFileTypes: true })
  for (const name of names) {
    const child = path.join(entry, name.name)
    if (name.isDirectory()) out.push(...await collectDebugFiles(child))
    else if (name.isFile() && name.name === 'debug.json') out.push(child)
  }
  return out
}

function normalize(value) {
  return String(value ?? '').replace(/_/g, '').trim()
}

function normalizeDigit(value) {
  if (value === null || value === undefined || value === '' || value === '_') return null
  const digit = Number(value)
  return Number.isInteger(digit) && digit >= 0 && digit <= 9 ? digit : undefined
}

function captureIdFromReplay(result, file) {
  return result?.file || path.basename(file, '-replay-result.json')
}

function questionKey(captureId, label) {
  return `${String(captureId ?? '').trim()}::${String(label ?? '').trim()}`
}

function layoutFamily(layoutId) {
  if (/sg-g1-lw-0[1-5]-/.test(layoutId || '')) return 'row'
  if (/sg-g1-lw-(0[6-9]|10)-/.test(layoutId || '')) return 'non-row'
  return 'other'
}

function predictionDetailsForGroup(result, group) {
  const questionNum = Number(group?.label)
  return (result.predictionDetails || [])
    .filter((detail) => Number(detail.questionNum) === questionNum)
    .sort((a, b) => Number(a.digitIndex || 0) - Number(b.digitIndex || 0))
}

function tensorInkQuality(tensor, id = null, variantName = 'base') {
  const values = tensor && typeof tensor.length === 'number' ? tensor : []
  const binary = Array(28 * 28).fill(false)
  let inkPixels = 0
  let weightedInk = 0
  let minX = 28
  let minY = 28
  let maxX = -1
  let maxY = -1
  const rowCounts = Array(28).fill(0)
  const colCounts = Array(28).fill(0)
  let edgeInkPixels = 0
  let centerInkPixels = 0
  let leftInkPixels = 0
  let rightInkPixels = 0
  let topInkPixels = 0
  let bottomInkPixels = 0
  for (let i = 0; i < Math.min(values.length, 28 * 28); i += 1) {
    const value = Number(values[i]) || 0
    if (value <= 0.16) continue
    const y = Math.floor(i / 28)
    const x = i - y * 28
    binary[i] = true
    inkPixels += 1
    weightedInk += value
    rowCounts[y] += 1
    colCounts[x] += 1
    if (x <= 1 || x >= 26 || y <= 1 || y >= 26) edgeInkPixels += 1
    if (x >= 7 && x <= 20 && y >= 6 && y <= 22) centerInkPixels += 1
    if (x < 14) leftInkPixels += 1
    else rightInkPixels += 1
    if (y < 14) topInkPixels += 1
    else bottomInkPixels += 1
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
  const centerInkRatio = inkPixels ? centerInkPixels / inkPixels : 0
  const verticalLineScore = inkPixels ? maxColCount / inkPixels : 0
  const horizontalLineScore = inkPixels ? maxRowCount / inkPixels : 0
  const sideBalance = inkPixels ? Math.abs(leftInkPixels - rightInkPixels) / inkPixels : 0
  const topBottomBalance = inkPixels ? Math.abs(topInkPixels - bottomInkPixels) / inkPixels : 0

  const visited = Array(28 * 28).fill(false)
  const components = []
  const stack = []
  for (let i = 0; i < binary.length; i += 1) {
    if (!binary[i] || visited[i]) continue
    let count = 0
    let touchesEdge = false
    stack.push(i)
    visited[i] = true
    while (stack.length) {
      const current = stack.pop()
      count += 1
      const y = Math.floor(current / 28)
      const x = current - y * 28
      if (x <= 1 || x >= 26 || y <= 1 || y >= 26) touchesEdge = true
      const neighbors = [
        current - 1,
        current + 1,
        current - 28,
        current + 28
      ]
      for (const next of neighbors) {
        if (next < 0 || next >= binary.length || visited[next] || !binary[next]) continue
        const ny = Math.floor(next / 28)
        const nx = next - ny * 28
        if (Math.abs(nx - x) + Math.abs(ny - y) !== 1) continue
        visited[next] = true
        stack.push(next)
      }
    }
    components.push({ count, touchesEdge })
  }
  components.sort((a, b) => b.count - a.count)
  const componentCount = components.length
  const largestComponentPixels = components[0]?.count || 0
  const largestComponentRatio = inkPixels ? largestComponentPixels / inkPixels : 0
  const smallComponentCount = components.filter((component) => component.count > 0 && component.count <= 4).length
  const edgeComponentCount = components.filter((component) => component.touchesEdge).length

  const horizontalArtifactLikely =
    inkPixels >= 8 &&
    inkW >= 11 &&
    (
      inkH <= 6 ||
      maxRowCount >= Math.max(9, Math.round(inkPixels * 0.42))
    )
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
  const fragmentedArtifactLikely =
    inkPixels >= 8 &&
    componentCount >= 4 &&
    largestComponentRatio <= 0.68
  const lineArtifactLikely =
    horizontalArtifactLikely ||
    verticalEdgeArtifactLikely ||
    edgeArtifactLikely ||
    fragmentedArtifactLikely
  const plausibleDigitShape =
    inkPixels >= 14 &&
    inkW >= 3 &&
    inkH >= 8 &&
    largestComponentRatio >= 0.48 &&
    !horizontalArtifactLikely &&
    !edgeArtifactLikely

  return {
    id,
    variantName,
    inkPixels,
    weightedInk: Number(weightedInk.toFixed(3)),
    inkW,
    inkH,
    density: Number(density.toFixed(4)),
    maxRowCount,
    maxColCount,
    edgeInkRatio: Number(edgeInkRatio.toFixed(4)),
    centerInkRatio: Number(centerInkRatio.toFixed(4)),
    verticalLineScore: Number(verticalLineScore.toFixed(4)),
    horizontalLineScore: Number(horizontalLineScore.toFixed(4)),
    sideBalance: Number(sideBalance.toFixed(4)),
    topBottomBalance: Number(topBottomBalance.toFixed(4)),
    componentCount,
    largestComponentPixels,
    largestComponentRatio: Number(largestComponentRatio.toFixed(4)),
    smallComponentCount,
    edgeComponentCount,
    horizontalArtifactLikely,
    verticalEdgeArtifactLikely,
    edgeArtifactLikely,
    fragmentedArtifactLikely,
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
  if (quality.fragmentedArtifactLikely) score -= 100
  score += Math.min(quality.inkPixels || 0, 120)
  score += Math.min(quality.inkW || 0, 20) * 4
  score += Math.min(quality.inkH || 0, 24) * 4
  score += Math.round((quality.largestComponentRatio || 0) * 80)
  score += Math.round((quality.centerInkRatio || 0) * 35)
  score -= Math.round((quality.edgeInkRatio || 0) * 90)
  score -= Math.max(0, (quality.componentCount || 0) - 2) * 12
  return score
}

function summarizeTensorItem(item) {
  const candidates = [
    { name: 'base', tensor: item?.tensor },
    ...(Array.isArray(item?.tensorVariants) ? item.tensorVariants : [])
  ].filter((candidate) => candidate?.tensor)
  const variantQualities = candidates.map((candidate) => tensorInkQuality(candidate.tensor, item?.id, candidate.name || 'variant'))
  let bestQuality = null
  for (const quality of variantQualities) {
    if (!bestQuality || tensorQualityScore(quality) > tensorQualityScore(bestQuality)) bestQuality = quality
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
  const artifactVariantCount = summaryQualities.filter((quality) => quality.lineArtifactLikely).length
  const weakVariantCount = summaryQualities.filter((quality) => (
    !quality.ok ||
    (quality.inkPixels || 0) < 12 ||
    (quality.inkH || 0) < 6 ||
    quality.horizontalArtifactLikely ||
    quality.edgeArtifactLikely
  )).length
  return {
    id: item?.id,
    questionNum: item?.questionNum,
    digitIndex: item?.digitIndex,
    variantCount,
    usableVariantCount,
    artifactVariantCount,
    weakVariantCount,
    usableVariantRatio: variantCount ? usableVariantCount / variantCount : 0,
    artifactVariantRatio: variantCount ? artifactVariantCount / variantCount : 0,
    weakVariantRatio: variantCount ? weakVariantCount / variantCount : 0,
    allVariantsWeak: variantCount > 0 && usableVariantCount === 0,
    bestQuality,
    baseQuality: variantQualities.find((quality) => quality.variantName === 'base') || null,
    strictQuality: variantQualities.find((quality) => quality.variantName === 'strict') || null,
    variantQualities
  }
}

function emptyStats() {
  return {
    count: 0,
    slots: 0,
    okSlots: 0,
    allWeakSlots: 0,
    artifactSlots: 0,
    weakSlots: 0,
    sums: {
      usableVariantRatio: 0,
      artifactVariantRatio: 0,
      weakVariantRatio: 0,
      bestInkPixels: 0,
      bestInkW: 0,
      bestInkH: 0,
      bestEdgeInkRatio: 0,
      bestCenterInkRatio: 0,
      bestLargestComponentRatio: 0,
      bestComponentCount: 0
    }
  }
}

function addToStats(stats, slotQualities) {
  stats.count += 1
  for (const slot of slotQualities) {
    if (!slot) continue
    stats.slots += 1
    if (slot.usableVariantCount > 0) stats.okSlots += 1
    if (slot.allVariantsWeak) stats.allWeakSlots += 1
    if ((slot.artifactVariantRatio || 0) >= 0.5) stats.artifactSlots += 1
    if ((slot.weakVariantRatio || 0) >= 0.75) stats.weakSlots += 1
    const best = slot.bestQuality || {}
    stats.sums.usableVariantRatio += slot.usableVariantRatio || 0
    stats.sums.artifactVariantRatio += slot.artifactVariantRatio || 0
    stats.sums.weakVariantRatio += slot.weakVariantRatio || 0
    stats.sums.bestInkPixels += best.inkPixels || 0
    stats.sums.bestInkW += best.inkW || 0
    stats.sums.bestInkH += best.inkH || 0
    stats.sums.bestEdgeInkRatio += best.edgeInkRatio || 0
    stats.sums.bestCenterInkRatio += best.centerInkRatio || 0
    stats.sums.bestLargestComponentRatio += best.largestComponentRatio || 0
    stats.sums.bestComponentCount += best.componentCount || 0
  }
}

function finalizeStats(stats) {
  const div = Math.max(1, stats.slots)
  const out = {
    ...stats,
    okSlotPct: Number((stats.okSlots / div * 100).toFixed(1)),
    allWeakSlotPct: Number((stats.allWeakSlots / div * 100).toFixed(1)),
    artifactSlotPct: Number((stats.artifactSlots / div * 100).toFixed(1)),
    weakSlotPct: Number((stats.weakSlots / div * 100).toFixed(1)),
    averages: {}
  }
  for (const [key, value] of Object.entries(stats.sums)) {
    out.averages[key] = Number((value / div).toFixed(4))
  }
  return out
}

function makeEvidenceByDigit(detail) {
  const out = new Map()
  const add = (digit, source, confidence, variantName = null) => {
    const normalized = normalizeDigit(digit)
    if (normalized === null || normalized === undefined) return
    if (!out.has(normalized)) {
      out.set(normalized, {
        digit: normalized,
        maxConfidence: 0,
        sources: new Set(),
        variantNames: new Set()
      })
    }
    const item = out.get(normalized)
    item.maxConfidence = Math.max(item.maxConfidence, Number(confidence) || 0)
    item.sources.add(source)
    if (variantName) item.variantNames.add(variantName)
  }
  if (!(detail?.blank || detail?.empty)) add(detail?.digit, 'current', detail?.confidence || 0)
  for (const top of detail?.topK || []) add(top?.digit, 'model-topk', top?.confidence || 0)
  for (const variant of detail?.preprocessVariants || []) {
    add(variant?.digit, 'variant-top1', variant?.confidence || 0, variant?.name || 'variant')
    for (const top of variant?.topK || []) add(top?.digit, 'variant-topk', top?.confidence || 0, variant?.name || 'variant')
  }
  return new Map([...out.entries()].map(([digit, item]) => [
    digit,
    {
      ...item,
      sources: [...item.sources].sort(),
      variantNames: [...item.variantNames].sort()
    }
  ]))
}

function alignedTruthDigits(truthText, details) {
  const chars = normalize(truthText).split('').map((ch) => normalizeDigit(ch))
  if (!chars.length || chars.some((digit) => digit === null || digit === undefined)) return null
  if (chars.length !== details.length) return null
  return chars
}

function topExamples(list, limit = 20) {
  return list
    .sort((a, b) =>
      (b.artifactScore || 0) - (a.artifactScore || 0) ||
      String(a.layoutId).localeCompare(String(b.layoutId)) ||
      String(a.captureId).localeCompare(String(b.captureId)) ||
      Number(a.questionLabel) - Number(b.questionLabel)
    )
    .slice(0, limit)
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const truth = await readJson(opts.truth)
  const truthEntries = (truth.entries || []).filter((entry) => entry.truthStatus !== 'unclear' && entry.truthStatus !== 'needs-label')
  const truthByQuestion = new Map(truthEntries.map((entry) => [questionKey(entry.captureId, entry.questionLabel), entry]))

  const debugFiles = await collectDebugFiles(opts.debugRoot)
  const debugByCapture = new Map()
  for (const file of debugFiles) {
    const captureId = path.basename(path.dirname(file))
    debugByCapture.set(captureId, file)
  }

  const replayFiles = (await Promise.all(opts.dirs.map(collectReplayFiles))).flat().sort()
  const debugCache = new Map()
  const stats = new Map()
  const byLayout = new Map()
  const examples = {
    yellowWrongHighArtifact: [],
    yellowWrongTruthEvidence: [],
    yellowCorrectClean: [],
    autoCorrectClean: [],
    autoWrong: []
  }
  const slotConfusions = new Map()
  let matchedGroups = 0
  let matchedWithDebug = 0
  let alignedSlotGroups = 0
  let missingDebug = 0

  const bucketFor = (name) => {
    if (!stats.has(name)) stats.set(name, emptyStats())
    return stats.get(name)
  }
  const layoutBucketFor = (layoutId) => {
    if (!byLayout.has(layoutId)) byLayout.set(layoutId, emptyStats())
    return byLayout.get(layoutId)
  }

  for (const replayFile of replayFiles) {
    const result = await readJson(replayFile)
    const captureId = captureIdFromReplay(result, replayFile)
    const debugFile = debugByCapture.get(captureId)
    let debug = null
    if (debugFile) {
      if (!debugCache.has(debugFile)) {
        const wrapped = await readJson(debugFile)
        debugCache.set(debugFile, wrapped.debug || wrapped)
      }
      debug = debugCache.get(debugFile)
    }
    const tensorById = new Map((debug?.tensors || []).map((item) => [Number(item.id), summarizeTensorItem(item)]))
    if (!debugFile) missingDebug += 1

    for (const group of result.groups || []) {
      const entry = truthByQuestion.get(questionKey(captureId, group.label))
      if (!entry) continue
      matchedGroups += 1
      if (debugFile) matchedWithDebug += 1
      const details = predictionDetailsForGroup(result, group)
      const slotQualities = details.map((detail) => tensorById.get(Number(detail.id))).filter(Boolean)
      const app = normalize(group.predicted)
      const truthText = normalize(entry.truth)
      const appMatchesTruth = app === truthText
      const family = layoutFamily(entry.layoutId)
      const status = group.review
        ? (appMatchesTruth ? 'yellow_lean_correct' : 'yellow_lean_wrong')
        : (appMatchesTruth ? 'auto_correct' : 'auto_wrong')
      const names = [
        'overall',
        family,
        status,
        `${family}:${status}`
      ]
      for (const name of names) addToStats(bucketFor(name), slotQualities)
      addToStats(layoutBucketFor(entry.layoutId), slotQualities)

      const artifactScore = slotQualities.reduce((sum, slot) => (
        sum +
        ((slot.artifactVariantRatio || 0) >= 0.5 ? 2 : 0) +
        ((slot.weakVariantRatio || 0) >= 0.75 ? 1 : 0) +
        (slot.allVariantsWeak ? 2 : 0)
      ), 0)
      const baseExample = {
        captureId,
        layoutId: entry.layoutId,
        family,
        questionLabel: entry.questionLabel,
        problem: entry.problem,
        expected: entry.expected,
        truth: entry.truth,
        appPrediction: group.predicted,
        review: Boolean(group.review),
        replayFile,
        debugFile,
        artifactScore,
        slotQualities: slotQualities.map((slot) => ({
          id: slot.id,
          digitIndex: slot.digitIndex,
          usableVariantRatio: Number((slot.usableVariantRatio || 0).toFixed(3)),
          artifactVariantRatio: Number((slot.artifactVariantRatio || 0).toFixed(3)),
          weakVariantRatio: Number((slot.weakVariantRatio || 0).toFixed(3)),
          allVariantsWeak: slot.allVariantsWeak,
          bestVariantName: slot.bestQuality?.variantName,
          bestQuality: slot.bestQuality
        }))
      }
      if (status === 'yellow_lean_wrong' && artifactScore > 0) examples.yellowWrongHighArtifact.push(baseExample)
      if (status === 'yellow_lean_correct' && artifactScore === 0) examples.yellowCorrectClean.push(baseExample)
      if (status === 'auto_correct' && artifactScore === 0) examples.autoCorrectClean.push(baseExample)
      if (status === 'auto_wrong') examples.autoWrong.push(baseExample)

      const truthDigits = alignedTruthDigits(entry.truth, details)
      if (truthDigits) {
        alignedSlotGroups += 1
        const truthEvidence = []
        for (let i = 0; i < details.length; i += 1) {
          const detail = details[i]
          const truthDigit = truthDigits[i]
          const currentDigit = normalizeDigit(detail?.blank || detail?.empty ? null : detail?.digit)
          const evidence = makeEvidenceByDigit(detail)
          const truthItem = evidence.get(truthDigit)
          if (currentDigit !== truthDigit) {
            const key = `${currentDigit ?? '_'}->${truthDigit}`
            slotConfusions.set(key, (slotConfusions.get(key) || 0) + 1)
          }
          if (truthItem && currentDigit !== truthDigit) {
            truthEvidence.push({
              slotIndex: i,
              currentDigit,
              truthDigit,
              evidence: truthItem,
              quality: slotQualities.find((slot) => Number(slot.id) === Number(detail.id)) || null
            })
          }
        }
        if (status === 'yellow_lean_wrong' && truthEvidence.length) {
          examples.yellowWrongTruthEvidence.push({
            ...baseExample,
            truthEvidence
          })
        }
      }
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    truth: opts.truth,
    debugRoot: opts.debugRoot,
    replayDirs: opts.dirs,
    replayFileCount: replayFiles.length,
    debugFileCount: debugFiles.length,
    matchedGroups,
    matchedWithDebug,
    missingReplayDebugFiles: missingDebug,
    alignedSlotGroups,
    buckets: Object.fromEntries([...stats.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => [key, finalizeStats(value)])),
    byLayout: Object.fromEntries([...byLayout.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => [key, finalizeStats(value)])),
    slotConfusions: [...slotConfusions.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([confusion, count]) => ({ confusion, count })),
    examples: {
      yellowWrongHighArtifact: topExamples(examples.yellowWrongHighArtifact, 30),
      yellowWrongTruthEvidence: topExamples(examples.yellowWrongTruthEvidence, 30),
      yellowCorrectClean: topExamples(examples.yellowCorrectClean, 20),
      autoCorrectClean: topExamples(examples.autoCorrectClean, 20),
      autoWrong: topExamples(examples.autoWrong, 20)
    }
  }

  const text = `${JSON.stringify(report, null, 2)}\n`
  if (opts.out) {
    await fs.mkdir(path.dirname(opts.out), { recursive: true })
    await fs.writeFile(opts.out, text)
  } else {
    process.stdout.write(text)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
