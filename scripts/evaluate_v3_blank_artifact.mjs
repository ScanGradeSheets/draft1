#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { createCanvas, loadImage } from 'canvas'
import { analyzeBlankArtifact } from '../src/v3/answer-zones.js'

const root = path.resolve(import.meta.dirname, '..')
const manifestPath = process.argv[2] || 'private-evidence/v3/live-continuous-answer-zones-manifest.json'
const outPath = process.argv[3] || 'private-evidence/reports/v3-blank-artifact-shadow.json'
const manifest = JSON.parse(await fs.readFile(path.resolve(root, manifestPath), 'utf8'))
const rows = []
for (const entry of manifest.entries || []) {
  const image = await loadImage(path.resolve(root, entry.imagePath))
  const canvas = createCanvas(image.width, image.height)
  const context = canvas.getContext('2d')
  context.drawImage(image, 0, 0)
  const rgba = context.getImageData(0, 0, image.width, image.height).data
  const gray = new Uint8Array(image.width * image.height)
  for (let index = 0; index < gray.length; index += 1) {
    const offset = index * 4
    gray[index] = Math.round(.299 * rgba[offset] + .587 * rgba[offset + 1] + .114 * rgba[offset + 2])
  }
  const result = analyzeBlankArtifact(gray, image.width, image.height)
  rows.push({
    uid: entry.uid, captureId: entry.captureId, questionNum: entry.questionNum, split: entry.split,
    layoutId: entry.layoutId, truth: entry.truth, truthStatus: entry.truthStatus,
    truthBlank: entry.truthStatus === 'blank' || String(entry.truth || '') === '', ...result,
  })
}

function bucket(items) {
  const blank = items.filter((row) => row.truthBlank)
  const written = items.filter((row) => !row.truthBlank)
  return {
    total: items.length,
    truthBlank: blank.length,
    blankCandidates: items.filter((row) => row.isBlankCandidate).length,
    trueBlankCandidates: blank.filter((row) => row.isBlankCandidate).length,
    falseBlankCandidates: written.filter((row) => row.isBlankCandidate).length,
    artifactCandidates: items.filter((row) => row.artifactProbability > .08).length,
  }
}

const report = {
  generatedAt: new Date().toISOString(), manifest: manifestPath,
  policy: 'shadow only; no blank/artifact decision changes grading',
  overall: bucket(rows),
  bySplit: Object.fromEntries(['development', 'validation', 'holdout'].map((split) => [split, bucket(rows.filter((row) => row.split === split))])),
  blankRows: rows.filter((row) => row.truthBlank),
  falseBlankRows: rows.filter((row) => !row.truthBlank && row.isBlankCandidate),
  rows,
}
await fs.mkdir(path.dirname(path.resolve(root, outPath)), { recursive: true })
await fs.writeFile(path.resolve(root, outPath), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ overall: report.overall, bySplit: report.bySplit }, null, 2))
