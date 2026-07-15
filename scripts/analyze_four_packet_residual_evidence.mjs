#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const PACKETS = ['P08', 'P03', 'P09', 'P02']
const LAYOUTS = Array.from({ length: 10 }, (_, index) =>
  `sg-g1-lw-${String(index + 1).padStart(2, '0')}-${[
    'add-1digit', 'add-2digit', 'sub-1digit', 'sub-2digit', 'mixed-20',
    'ten-frames', 'dot-collections', 'number-bonds', 'number-patterns', 'place-value-50',
  ][index]}`)
const CANONICAL_P02_DOT = '2026-07-14_03-52-45-221-sg-g1-lw-07-dot-collections-39ec2eb4'
const TRUTH_FILES = [
  'private-evidence/hybrid-v2-prospective/handwritten-truth-development.json',
  'private-evidence/hybrid-v2-prospective/handwritten-truth-p03-p09-primary.json',
  'private-evidence/hybrid-v2-prospective/handwritten-truth-p02-verified.json',
]

function walkDebugFiles(root, output = []) {
  if (!fs.existsSync(root)) return output
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const resolved = path.join(root, entry.name)
    if (entry.isDirectory()) walkDebugFiles(resolved, output)
    else if (entry.isFile() && entry.name === 'debug.json') output.push(resolved)
  }
  return output
}

function loadTruth() {
  const labels = TRUTH_FILES.flatMap((relative) =>
    JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8')).labels)
  const selected = labels.filter((row) => PACKETS.includes(row.packetId))
  const keyed = new Map(selected.map((row) => [`${row.packetId}|${row.layoutId}|${row.questionNum}`, row]))
  if (selected.length !== 280 || keyed.size !== 280) throw new Error(`expected 280 unique labels; got ${selected.length}/${keyed.size}`)
  return keyed
}

function loadVersions() {
  const files = ['2026-07-13', '2026-07-14'].flatMap((date) =>
    walkDebugFiles(path.join(ROOT, 'private-evidence/debug-scans', date)))
  const versions = []
  for (const file of files) {
    try {
      const wrapper = JSON.parse(fs.readFileSync(file, 'utf8'))
      const debug = wrapper.debug || wrapper
      if (!PACKETS.includes(debug.packetId) || !LAYOUTS.includes(debug.layoutId)) continue
      versions.push({ file, dir: path.dirname(file), debug })
    } catch {
      // Ignore unrelated or interrupted debug writes.
    }
  }
  return versions
}

function selectCanonicalPages(versions) {
  const pages = []
  for (const packetId of PACKETS) {
    for (const layoutId of LAYOUTS) {
      const candidates = versions.filter((row) => row.debug.packetId === packetId && row.debug.layoutId === layoutId)
      const sessions = new Map()
      for (const row of candidates) {
        const sessionId = row.debug.scanSessionId || path.basename(row.dir)
        if (!sessions.has(sessionId)) sessions.set(sessionId, [])
        sessions.get(sessionId).push(row)
      }
      let eligible = [...sessions.values()].filter((rows) =>
        rows.some((row) => Array.isArray(row.debug.answerGroups) && row.debug.answerGroups.length > 0) &&
        rows.some((row) => fs.existsSync(path.join(row.dir, 'captured.png'))))
      if (packetId === 'P02' && layoutId === 'sg-g1-lw-07-dot-collections') {
        eligible = eligible.filter((rows) => rows.some((row) => path.basename(row.dir) === CANONICAL_P02_DOT))
      }
      if (eligible.length !== 1) throw new Error(`${packetId}|${layoutId}: expected one canonical session, got ${eligible.length}`)
      const rows = eligible[0]
      const best = [...rows].sort((a, b) => {
        const az = Array.isArray(a.debug.v3AnswerZones) ? a.debug.v3AnswerZones.length : 0
        const bz = Array.isArray(b.debug.v3AnswerZones) ? b.debug.v3AnswerZones.length : 0
        const ag = Array.isArray(a.debug.answerGroups) ? a.debug.answerGroups.length : 0
        const bg = Array.isArray(b.debug.answerGroups) ? b.debug.answerGroups.length : 0
        return (bz + bg) - (az + ag)
      })[0]
      pages.push({ packetId, layoutId, file: best.file, debug: best.debug })
    }
  }
  if (pages.length !== 40) throw new Error(`expected 40 pages; got ${pages.length}`)
  return pages
}

function round(value, digits = 3) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null
}

function mean(values) {
  const finite = values.filter(Number.isFinite)
  return finite.length ? finite.reduce((sum, value) => sum + value, 0) / finite.length : NaN
}

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b)
  if (!sorted.length) return NaN
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

function pearson(xs, ys) {
  const pairs = xs.map((x, index) => [x, ys[index]]).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y))
  if (pairs.length < 3) return NaN
  const mx = mean(pairs.map(([x]) => x))
  const my = mean(pairs.map(([, y]) => y))
  const numerator = pairs.reduce((sum, [x, y]) => sum + ((x - mx) * (y - my)), 0)
  const dx = Math.sqrt(pairs.reduce((sum, [x]) => sum + ((x - mx) ** 2), 0))
  const dy = Math.sqrt(pairs.reduce((sum, [, y]) => sum + ((y - my) ** 2), 0))
  return dx && dy ? numerator / (dx * dy) : NaN
}

function summarizeZones(rows, predicate) {
  const selected = rows.filter(predicate)
  const artifact = selected.map((row) => row.blankArtifact?.artifactProbability).filter(Number.isFinite)
  const ink = selected.map((row) => row.blankArtifact?.residualInkFraction).filter(Number.isFinite)
  const components = selected.map((row) => row.blankArtifact?.meaningfulComponentCount).filter(Number.isFinite)
  return {
    answers: selected.length,
    blankCandidates: selected.filter((row) => row.blankArtifact?.isBlankCandidate === true).length,
    artifactProbability: { mean: round(mean(artifact)), median: round(median(artifact)), atLeast050: artifact.filter((v) => v >= 0.5).length, atLeast090: artifact.filter((v) => v >= 0.9).length },
    residualInkFraction: { mean: round(mean(ink)), median: round(median(ink)) },
    meaningfulComponentCount: { mean: round(mean(components)), median: round(median(components)) },
  }
}

function main() {
  const truth = loadTruth()
  const pages = selectCanonicalPages(loadVersions())
  const answerRows = []
  const pageRows = []

  for (const page of pages) {
    const debug = page.debug
    const groups = Array.isArray(debug.answerGroups) ? debug.answerGroups : []
    const zones = Array.isArray(debug.v3AnswerZones) ? debug.v3AnswerZones : []
    const expected = page.layoutId.includes('-0') && Number(page.layoutId.match(/lw-(\d+)/)?.[1]) <= 5 ? 8 : 6
    if (groups.length !== expected || zones.length !== expected) {
      throw new Error(`${page.packetId}|${page.layoutId}: expected ${expected} groups/zones, got ${groups.length}/${zones.length}`)
    }
    const cq = debug.captureQuality || {}
    let reviews = 0
    for (let questionNum = 1; questionNum <= expected; questionNum += 1) {
      const label = truth.get(`${page.packetId}|${page.layoutId}|${questionNum}`)
      const group = groups.find((row) => Number(row.questionNum) === questionNum)
      const zone = zones.find((row) => Number(row.questionNum) === questionNum)
      if (!label || !group || !zone) throw new Error(`${page.packetId}|${page.layoutId}|q${questionNum}: incomplete join`)
      const review = group.reviewNeeded === true || group.status === 'review'
      if (review) reviews += 1
      answerRows.push({
        packetId: page.packetId,
        layoutId: page.layoutId,
        layoutFamily: Number(page.layoutId.match(/lw-(\d+)/)?.[1]) <= 5 ? 'row' : 'non-row',
        questionNum,
        truthState: label.truthState,
        handwrittenTruth: label.handwrittenTruth,
        originalRead: String(group.answerText ?? ''),
        originalStatus: group.status,
        originalReview: review,
        blankArtifact: zone.blankArtifact || null,
        zoneQuality: zone.quality || null,
      })
    }
    const geometry = cq.sheetGeometry || {}
    pageRows.push({
      packetId: page.packetId,
      layoutId: page.layoutId,
      layoutFamily: Number(page.layoutId.match(/lw-(\d+)/)?.[1]) <= 5 ? 'row' : 'non-row',
      answers: expected,
      reviews,
      reviewRate: reviews / expected,
      focusScore: cq.focusScore,
      lumaMean: cq.lumaMean,
      lumaVariance: cq.lumaVariance,
      widthBalance: geometry.widthBalance,
      heightBalance: geometry.heightBalance,
      topTilt: geometry.topTilt,
      bottomTilt: geometry.bottomTilt,
      leftLean: geometry.leftLean,
      rightLean: geometry.rightLean,
      preferredPerspective: geometry.preferredPerspective,
      captureAttempts: cq.captureGateTelemetry?.attempts,
      captureElapsedMs: cq.captureGateTelemetry?.elapsedMs,
      sourceFile: path.relative(ROOT, page.file),
    })
  }

  const metrics = ['focusScore', 'lumaMean', 'lumaVariance', 'widthBalance', 'heightBalance', 'topTilt', 'bottomTilt', 'leftLean', 'rightLean', 'captureElapsedMs']
  const qualityAssociation = Object.fromEntries(metrics.map((metric) => [metric, {
    pageCount: pageRows.filter((row) => Number.isFinite(row[metric])).length,
    min: round(Math.min(...pageRows.map((row) => row[metric]).filter(Number.isFinite))),
    median: round(median(pageRows.map((row) => row[metric]))),
    max: round(Math.max(...pageRows.map((row) => row[metric]).filter(Number.isFinite))),
    correlationWithReviewRate: round(pearson(pageRows.map((row) => row[metric]), pageRows.map((row) => row.reviewRate))),
  }]))

  const overwritten = answerRows.filter((row) => row.truthState === 'overwritten').map((row) => ({
    packetId: row.packetId,
    layoutId: row.layoutId,
    questionNum: row.questionNum,
    apparentTruthNote: row.handwrittenTruth,
    originalRead: row.originalRead,
    originalStatus: row.originalStatus,
    blankCandidate: row.blankArtifact?.isBlankCandidate,
    artifactProbability: round(row.blankArtifact?.artifactProbability),
    residualInkFraction: round(row.blankArtifact?.residualInkFraction),
    meaningfulComponentCount: row.blankArtifact?.meaningfulComponentCount,
  }))

  const output = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    purpose: 'Audit blank/artifact/overwritten signals and page capture-quality associations on the four already-scanned packets without changing recognition policy.',
    caveats: [
      'These four packets contain no truth-labelled clean blank answers, so blank automation cannot be validated here.',
      'Only five overwritten answers exist; their statistics are descriptive and insufficient for a production threshold.',
      'Capture-quality associations are page-level correlations across 40 pages, not causal evidence.',
      'Original answer status is the status saved in the canonical scan debug record; it may differ from later replay policy.',
    ],
    completeness: {
      pages: pageRows.length,
      answers: answerRows.length,
      valueAnswers: answerRows.filter((row) => row.truthState === 'value').length,
      overwrittenAnswers: answerRows.filter((row) => row.truthState === 'overwritten').length,
      blankTruthAnswers: answerRows.filter((row) => row.truthState === 'blank').length,
    },
    blankArtifact: {
      all: summarizeZones(answerRows, () => true),
      value: summarizeZones(answerRows, (row) => row.truthState === 'value'),
      overwritten: summarizeZones(answerRows, (row) => row.truthState === 'overwritten'),
      blankCandidateCases: answerRows.filter((row) => row.blankArtifact?.isBlankCandidate === true).map((row) => ({
        packetId: row.packetId,
        layoutId: row.layoutId,
        questionNum: row.questionNum,
        truthState: row.truthState,
        handwrittenTruth: row.handwrittenTruth,
        originalRead: row.originalRead,
        originalStatus: row.originalStatus,
        blankConfidence: round(row.blankArtifact?.blankConfidence),
        artifactProbability: round(row.blankArtifact?.artifactProbability),
        residualInkFraction: round(row.blankArtifact?.residualInkFraction),
      })),
      overwrittenCases: overwritten,
    },
    captureQuality: {
      qualityAssociation,
      pagesSortedByReviewRate: [...pageRows].sort((a, b) => b.reviewRate - a.reviewRate || a.packetId.localeCompare(b.packetId)).map((row) => ({ ...row, reviewRate: round(row.reviewRate) })),
    },
  }

  const destination = path.join(ROOT, 'private-evidence/reports/v3-four-packet-residual-evidence-20260714.json')
  fs.writeFileSync(destination, `${JSON.stringify(output, null, 2)}\n`)
  console.log(JSON.stringify({ destination: path.relative(ROOT, destination), completeness: output.completeness, blankArtifact: output.blankArtifact, qualityAssociation }, null, 2))
}

main()
