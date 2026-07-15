#!/usr/bin/env node
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

const DEFAULT_TRUTH = 'private-evidence/truth-labels/20260703-flex-duplicate-accepted-needs-label/handwritten-truth-labelled.json'
const DEFAULT_REPLAY = 'private-evidence/reports/independent-review-20260709-current-374'
const DEFAULT_DEBUG = 'private-evidence/debug-scans/2026-07-02'
const DEFAULT_OUT = 'private-evidence/reports/independent-review-20260709-corpus-audit.json'

function parseArgs(argv) {
  const opts = { truth: DEFAULT_TRUTH, replay: DEFAULT_REPLAY, debug: DEFAULT_DEBUG, out: DEFAULT_OUT }
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--truth') opts.truth = argv[++i]
    else if (argv[i] === '--replay') opts.replay = argv[++i]
    else if (argv[i] === '--debug') opts.debug = argv[++i]
    else if (argv[i] === '--out') opts.out = argv[++i]
    else throw new Error(`Unknown argument: ${argv[i]}`)
  }
  return opts
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'))
}

function normalize(value) {
  return String(value ?? '').replaceAll('_', '').trim()
}

function questionKey(captureId, label) {
  return `${captureId}::${String(label ?? '').trim()}`
}

function bump(map, key, fields) {
  if (!map[key]) map[key] = { total: 0, auto: 0, autoCorrect: 0, autoWrong: 0, yellow: 0 }
  const bucket = map[key]
  bucket.total += 1
  if (fields.review) bucket.yellow += 1
  else {
    bucket.auto += 1
    if (fields.correct) bucket.autoCorrect += 1
    else bucket.autoWrong += 1
  }
}

function percentages(map) {
  return Object.fromEntries(Object.entries(map).map(([key, value]) => [key, {
    ...value,
    autoCoveragePct: value.total ? Number((100 * value.auto / value.total).toFixed(1)) : 0,
    autoAccuracyPct: value.auto ? Number((100 * value.autoCorrect / value.auto).toFixed(1)) : 0
  }]))
}

async function sha256(file) {
  const data = await fs.readFile(file)
  return crypto.createHash('sha256').update(data).digest('hex')
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const truth = await readJson(opts.truth)
  const truthByQuestion = new Map((truth.entries || []).map((entry) => [
    questionKey(entry.captureId, entry.questionLabel), entry
  ]))

  const replayNames = (await fs.readdir(opts.replay)).filter((name) => name.endsWith('-replay-result.json')).sort()
  const debugDirs = (await fs.readdir(opts.debug, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
  const debugByCapture = new Map(debugDirs.map((name) => [name, path.join(opts.debug, name)]))

  const byAnswerLength = {}
  const byQuestionPosition = {}
  const devices = {}
  const truthStatus = {}
  const imageHashes = new Map()
  const missing = { truthGroups: 0, debugBundles: 0, capturedImages: 0, studentIds: 0, packetIds: 0, templateIds: 0 }
  let matchedGroups = 0

  for (const replayName of replayNames) {
    const replay = await readJson(path.join(opts.replay, replayName))
    const captureId = replay.file || replayName.replace(/-replay-result\.json$/, '')
    const debugDir = debugByCapture.get(captureId)
    let bundle = null
    if (debugDir) bundle = await readJson(path.join(debugDir, 'debug.json')).catch(() => null)
    else missing.debugBundles += 1

    const debug = bundle?.debug || {}
    const upload = bundle?.upload || {}
    const userAgent = upload.userAgent || debug.runtime?.userAgent || 'unknown'
    const platform = debug.runtime?.platform || (/iPhone/.test(userAgent) ? 'iPhone' : /iPad/.test(userAgent) ? 'iPad' : 'unknown')
    const deviceKey = `${platform} | ${userAgent}`
    devices[deviceKey] = (devices[deviceKey] || 0) + 1
    if (!debug.studentId && !debug.student_id) missing.studentIds += 1
    if (!debug.packetId && !debug.packet_id) missing.packetIds += 1
    if (!debug.templateId && !debug.template_id) missing.templateIds += 1

    if (debugDir) {
      const image = path.join(debugDir, 'captured.png')
      const digest = await sha256(image).catch(() => null)
      if (digest) {
        if (!imageHashes.has(digest)) imageHashes.set(digest, [])
        imageHashes.get(digest).push(captureId)
      } else missing.capturedImages += 1
    }

    for (const group of replay.groups || []) {
      const entry = truthByQuestion.get(questionKey(captureId, group.label))
      if (!entry) {
        missing.truthGroups += 1
        continue
      }
      matchedGroups += 1
      const correct = normalize(group.predicted) === normalize(entry.truth)
      const review = !!group.review
      bump(byAnswerLength, String(normalize(entry.truth).length), { correct, review })
      bump(byQuestionPosition, String(entry.questionLabel), { correct, review })
      truthStatus[entry.truthStatus || 'unknown'] = (truthStatus[entry.truthStatus || 'unknown'] || 0) + 1
    }
  }

  const exactDuplicateGroups = [...imageHashes.entries()]
    .filter(([, captures]) => captures.length > 1)
    .map(([hash, captures]) => ({ hash, count: captures.length, captures }))

  const result = {
    generatedAt: new Date().toISOString(),
    inputs: opts,
    replayFiles: replayNames.length,
    debugDirectories: debugDirs.length,
    matchedGroups,
    missing,
    truthStatus,
    byAnswerLength: percentages(byAnswerLength),
    byQuestionPosition: percentages(byQuestionPosition),
    devices,
    exactDuplicateImageGroups: exactDuplicateGroups,
    exactDuplicateImageCount: exactDuplicateGroups.reduce((sum, group) => sum + group.count - 1, 0),
    identityAudit: {
      studentIdentityAvailable: missing.studentIds < replayNames.length,
      packetIdentityAvailable: missing.packetIds < replayNames.length,
      templateIdentityAvailable: missing.templateIds < replayNames.length,
      warning: 'Missing durable student/packet identities prevents defensible student-level and packet-level holdouts.'
    }
  }
  await fs.mkdir(path.dirname(opts.out), { recursive: true })
  await fs.writeFile(opts.out, `${JSON.stringify(result, null, 2)}\n`)
  console.log(JSON.stringify(result, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
