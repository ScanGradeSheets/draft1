#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'

const DEFAULT_TRUTH = 'private-evidence/truth-labels/20260703-flex-duplicate-accepted-needs-label/handwritten-truth-labelled.json'

function parseArgs(argv) {
  const opts = {
    truth: DEFAULT_TRUTH,
    out: null,
    dirs: []
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--truth') opts.truth = argv[++i]
    else if (arg === '--out') opts.out = argv[++i]
    else opts.dirs.push(arg)
  }
  if (!opts.dirs.length) {
    throw new Error('Usage: node scripts/analyze_replay_review_opportunities.mjs [--truth file] [--out file] <replay-dir>...')
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

function normalizeAnswer(value) {
  return String(value ?? '').replace(/_/g, '').trim()
}

function normalizeDigit(value) {
  if (value === null || value === undefined || value === '' || value === '_') return null
  const digit = Number(value)
  return Number.isInteger(digit) && digit >= 0 && digit <= 9 ? digit : undefined
}

function digitsFromAnswer(value) {
  const text = normalizeAnswer(value)
  if (!/^\d+$/.test(text)) return []
  return text.split('').map((char) => Number(char))
}

function questionKey(captureId, label) {
  return `${String(captureId ?? '').trim()}::${String(label ?? '').trim()}`
}

function captureIdFromReplay(result, file) {
  return result?.file || path.basename(file, '-replay-result.json')
}

function layoutFamily(layoutId) {
  if (/sg-g1-lw-0[1-5]-/.test(layoutId || '')) return 'row'
  if (/sg-g1-lw-(0[6-9]|10)-/.test(layoutId || '')) return 'non-row'
  return 'other'
}

function inc(map, key, n = 1) {
  map.set(key, (map.get(key) || 0) + n)
}

function topEntries(map, limit = 20) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }))
}

function predictionDetailsForGroup(result, group) {
  const questionNum = Number(group?.label)
  return (result.predictionDetails || [])
    .filter((detail) => Number(detail.questionNum) === questionNum)
    .sort((a, b) => Number(a.digitIndex || 0) - Number(b.digitIndex || 0))
}

function addEvidence(out, reason, confidence) {
  const score = Math.max(0, Math.min(1, Number(confidence) || 0))
  if (score <= 0) return
  out.push({ reason, confidence: Number(score.toFixed(4)) })
}

function evidenceForDigit(prediction, digit) {
  const target = normalizeDigit(digit)
  if (target === null || target === undefined || !prediction) return []
  const out = []
  const current = normalizeDigit(prediction.blank || prediction.empty ? null : prediction.digit)
  if (current === target) addEvidence(out, 'current-read', prediction.confidence || 0.2)
  for (const item of prediction.topK || []) {
    if (normalizeDigit(item?.digit) === target) addEvidence(out, 'model-topk', item.confidence || 0.01)
  }
  for (const variant of prediction.preprocessVariants || []) {
    if (normalizeDigit(variant?.digit) === target) {
      addEvidence(out, `variant:${variant.name || 'unnamed'}`, variant.confidence || variant.topGap || 0.01)
    }
    for (const item of variant?.topK || []) {
      if (normalizeDigit(item?.digit) === target) {
        addEvidence(out, `variant-topk:${variant.name || 'unnamed'}`, item.confidence || 0.01)
      }
    }
  }
  return out.sort((a, b) => b.confidence - a.confidence)
}

function slotTruthDigits(truthText, slotCount) {
  const digits = digitsFromAnswer(truthText)
  if (!digits.length) return []
  if (digits.length === slotCount) return digits
  if (digits.length < slotCount) return Array(slotCount - digits.length).fill(null).concat(digits)
  return digits.slice(-slotCount)
}

function supportLevel(evidence) {
  const independent = evidence.filter((item) => !String(item.reason || '').startsWith('answer-key-'))
  const best = independent[0]?.confidence || 0
  if (best >= 0.75) return 'strong'
  if (best >= 0.5) return 'medium'
  if (best >= 0.22) return 'weak'
  if (best > 0) return 'trace'
  return 'none'
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const truth = await readJson(opts.truth)
  const truthEntries = (truth.entries || [])
    .filter((entry) => entry.truthStatus !== 'unclear' && entry.truthStatus !== 'needs-label')
  const truthByQuestion = new Map(truthEntries.map((entry) => [
    questionKey(entry.captureId, entry.questionLabel),
    entry
  ]))
  const replayFiles = (await Promise.all(opts.dirs.map(collectReplayFiles))).flat().sort()

  const byFamily = new Map()
  const byLayout = new Map()
  const byWorstSupport = new Map()
  const byConfusion = new Map()
  const examples = []
  let matched = 0
  let yellowWrong = 0
  let yellowWrongWithTruthTrace = 0
  let yellowWrongAllWeakOrBetter = 0
  let yellowWrongAllMediumOrBetter = 0
  let yellowWrongAllStrong = 0
  let yellowCurrentCorrect = 0

  const order = ['none', 'trace', 'weak', 'medium', 'strong']
  const rank = (level) => order.indexOf(level)

  for (const file of replayFiles) {
    const result = await readJson(file)
    const captureId = captureIdFromReplay(result, file)
    for (const group of result.groups || []) {
      const entry = truthByQuestion.get(questionKey(captureId, group.label))
      if (!entry) continue
      matched += 1
      if (!group.review) continue

      const predicted = normalizeAnswer(group.predicted)
      const truthText = normalizeAnswer(entry.truth)
      if (predicted === truthText) {
        yellowCurrentCorrect += 1
        continue
      }

      yellowWrong += 1
      const details = predictionDetailsForGroup(result, group)
      const truthDigits = slotTruthDigits(truthText, details.length)
      const slotReports = details.map((detail, index) => {
        const target = truthDigits[index]
        const evidence = evidenceForDigit(detail, target)
        const level = target === null ? 'strong' : supportLevel(evidence)
        return {
          slotIndex: index,
          target,
          current: detail.digit,
          confidence: detail.confidence,
          reviewReason: detail.preprocessReviewReason || null,
          support: level,
          evidence: evidence.slice(0, 5)
        }
      })
      const worst = slotReports.reduce((acc, slot) => (
        rank(slot.support) < rank(acc) ? slot.support : acc
      ), 'strong')
      const family = layoutFamily(entry.layoutId)
      const confusion = `${predicted || 'blank'} -> ${truthText || 'blank'}`

      inc(byFamily, family)
      inc(byLayout, entry.layoutId)
      inc(byWorstSupport, worst)
      inc(byConfusion, confusion)
      if (rank(worst) >= rank('trace')) yellowWrongWithTruthTrace += 1
      if (rank(worst) >= rank('weak')) yellowWrongAllWeakOrBetter += 1
      if (rank(worst) >= rank('medium')) yellowWrongAllMediumOrBetter += 1
      if (rank(worst) >= rank('strong')) yellowWrongAllStrong += 1

      if (examples.length < 80 && rank(worst) >= rank('weak')) {
        examples.push({
          captureId,
          layoutId: entry.layoutId,
          family,
          questionLabel: entry.questionLabel,
          expected: entry.expected,
          truth: truthText,
          predicted,
          problem: entry.problem,
          confusion,
          worstSupport: worst,
          replayFile: file,
          cropPath: entry.cropPath,
          slots: slotReports
        })
      }
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    truth: opts.truth,
    replayDirs: opts.dirs,
    replayFileCount: replayFiles.length,
    matched,
    yellowCurrentCorrect,
    yellowWrong,
    yellowWrongWithTruthTrace,
    yellowWrongAllWeakOrBetter,
    yellowWrongAllMediumOrBetter,
    yellowWrongAllStrong,
    byFamily: topEntries(byFamily),
    byLayout: topEntries(byLayout, 30),
    byWorstSupport: topEntries(byWorstSupport, 10),
    byConfusion: topEntries(byConfusion, 30),
    examples
  }

  if (opts.out) {
    await fs.mkdir(path.dirname(opts.out), { recursive: true })
    await fs.writeFile(opts.out, `${JSON.stringify(report, null, 2)}\n`)
  }
  console.log(JSON.stringify({
    out: opts.out,
    replayFileCount: report.replayFileCount,
    matched,
    yellowCurrentCorrect,
    yellowWrong,
    yellowWrongWithTruthTrace,
    yellowWrongAllWeakOrBetter,
    yellowWrongAllMediumOrBetter,
    yellowWrongAllStrong,
    byFamily: report.byFamily,
    byWorstSupport: report.byWorstSupport,
    byLayout: report.byLayout.slice(0, 12)
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
