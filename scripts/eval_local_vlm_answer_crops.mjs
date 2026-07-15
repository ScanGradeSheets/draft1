#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'

const TRUTH = 'private-evidence/truth-labels/20260703-flex-duplicate-accepted-needs-label/handwritten-truth-labelled.json'
const REPLAY = 'private-evidence/reports/independent-review-20260709-current-374'

function normalize(value) {
  return String(value ?? '').replace(/[^0-9]/g, '')
}

function key(captureId, label) {
  return `${captureId}::${String(label)}`
}

function parseArgs(argv) {
  const opts = {
    model: 'qwen3-vl:4b',
    out: 'private-evidence/reports/local-vlm-answer-crops-20260709.json',
    yellowPerLayout: 3,
    autoPerLayout: 1,
    layout: null,
    limit: null
  }
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--model') opts.model = argv[++i]
    else if (argv[i] === '--out') opts.out = argv[++i]
    else if (argv[i] === '--yellow-per-layout') opts.yellowPerLayout = Number(argv[++i])
    else if (argv[i] === '--auto-per-layout') opts.autoPerLayout = Number(argv[++i])
    else if (argv[i] === '--layout') opts.layout = argv[++i]
    else if (argv[i] === '--limit') opts.limit = Number(argv[++i])
    else throw new Error(`Unknown argument: ${argv[i]}`)
  }
  return opts
}

function extractJson(text) {
  const match = String(text || '').match(/\{[\s\S]*\}/)
  if (!match) return null
  try { return JSON.parse(match[0]) } catch { return null }
}

async function ask(model, imagePath) {
  const image = await fs.readFile(imagePath, 'base64')
  const started = Date.now()
  const response = await fetch('http://127.0.0.1:11434/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      think: false,
      format: 'json',
      options: { temperature: 0, seed: 7, num_predict: 60 },
      messages: [{
        role: 'user',
        content: '/no_think Transcribe only what the child wrote in this answer-box crop. The crop contains zero, one, or two handwritten decimal digits. Ignore printed borders, dividers, and guide lines. Do not solve any math and do not infer an expected answer. If no handwriting is present, use an empty read. If genuinely ambiguous, choose the most likely read but set status to unclear. Return JSON only: {"read":"digits-or-empty","status":"clear|unclear|blank","alternatives":["optional"]}.',
        images: [image]
      }]
    })
  })
  if (!response.ok) throw new Error(`Ollama HTTP ${response.status}: ${await response.text()}`)
  const payload = await response.json()
  const raw = payload.message?.content || payload.message?.thinking || ''
  return { raw, parsed: extractJson(raw), elapsedMs: Date.now() - started }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const truth = JSON.parse(await fs.readFile(TRUTH, 'utf8'))
  const truthByKey = new Map((truth.entries || []).map((entry) => [key(entry.captureId, entry.questionLabel), entry]))
  const names = (await fs.readdir(REPLAY)).filter((name) => name.endsWith('-replay-result.json')).sort()
  const candidates = []

  for (const name of names) {
    const replay = JSON.parse(await fs.readFile(path.join(REPLAY, name), 'utf8'))
    const captureId = replay.file || name.replace(/-replay-result\.json$/, '')
    for (const group of replay.groups || []) {
      const entry = truthByKey.get(key(captureId, group.label))
      if (!entry?.cropPath) continue
      candidates.push({ entry, group, captureId })
    }
  }

  let selected = []
  const layouts = [...new Set(candidates.map((item) => item.entry.layoutId))].sort().filter((layoutId) => !opts.layout || layoutId === opts.layout)
  for (const layoutId of layouts) {
    const items = candidates.filter((item) => item.entry.layoutId === layoutId)
    selected.push(...items.filter((item) => item.group.review).slice(0, opts.yellowPerLayout))
    selected.push(...items.filter((item) => !item.group.review).slice(0, opts.autoPerLayout))
  }
  if (Number.isFinite(opts.limit)) selected = selected.slice(0, opts.limit)

  const rows = []
  for (const [index, item] of selected.entries()) {
    const result = await ask(opts.model, item.entry.cropPath)
    const read = normalize(result.parsed?.read)
    const truthValue = normalize(item.entry.truth)
    const current = normalize(item.group.predicted)
    const row = {
      index: index + 1,
      captureId: item.captureId,
      questionLabel: item.group.label,
      layoutId: item.entry.layoutId,
      cropPath: item.entry.cropPath,
      truth: truthValue,
      expected: normalize(item.entry.expected),
      current,
      currentReview: !!item.group.review,
      vlmRead: read,
      vlmStatus: result.parsed?.status || 'unparsed',
      vlmAlternatives: result.parsed?.alternatives || [],
      vlmCorrect: read === truthValue,
      currentCorrect: current === truthValue,
      elapsedMs: result.elapsedMs,
      raw: result.raw
    }
    rows.push(row)
    console.log(`${index + 1}/${selected.length} ${row.layoutId} q${row.questionLabel} truth=${row.truth} current=${row.current}${row.currentReview ? '*' : ''} vlm=${row.vlmRead} ${row.vlmStatus} ${row.vlmCorrect ? 'OK' : 'WRONG'} ${row.elapsedMs}ms`)
  }

  const bucket = (items) => ({
    total: items.length,
    currentCorrect: items.filter((row) => row.currentCorrect).length,
    vlmCorrect: items.filter((row) => row.vlmCorrect).length,
    vlmClear: items.filter((row) => row.vlmStatus === 'clear').length,
    vlmClearCorrect: items.filter((row) => row.vlmStatus === 'clear' && row.vlmCorrect).length,
    vlmClearWrong: items.filter((row) => row.vlmStatus === 'clear' && !row.vlmCorrect).length,
    avgElapsedMs: items.length ? Math.round(items.reduce((sum, row) => sum + row.elapsedMs, 0) / items.length) : 0
  })
  const report = {
    generatedAt: new Date().toISOString(),
    model: opts.model,
    promptUsesAnswerKey: false,
    selection: { yellowPerLayout: opts.yellowPerLayout, autoPerLayout: opts.autoPerLayout },
    overall: bucket(rows),
    yellow: bucket(rows.filter((row) => row.currentReview)),
    auto: bucket(rows.filter((row) => !row.currentReview)),
    rows
  }
  await fs.mkdir(path.dirname(opts.out), { recursive: true })
  await fs.writeFile(opts.out, `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify({ overall: report.overall, yellow: report.yellow, auto: report.auto, out: opts.out }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
