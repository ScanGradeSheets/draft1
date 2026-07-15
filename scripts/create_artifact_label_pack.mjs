#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { createCanvas } from 'canvas'

const DEFAULT_REPORT = 'private-evidence/reports/visual-quality-audit-20260708/full-browser.json'

function parseArgs(argv) {
  const opts = {
    report: DEFAULT_REPORT,
    outDir: 'private-evidence/artifact-label-packs/20260708-visual-quality',
    perClass: 80
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--report') opts.report = argv[++i]
    else if (arg === '--out-dir') opts.outDir = argv[++i]
    else if (arg === '--per-class') opts.perClass = Number(argv[++i])
  }
  return opts
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'))
}

function tensorToImageData(ctx, tensor, x0, y0, scale) {
  for (let y = 0; y < 28; y += 1) {
    for (let x = 0; x < 28; x += 1) {
      const value = Math.max(0, Math.min(1, Number(tensor?.[y * 28 + x]) || 0))
      const shade = Math.round(value * 255)
      ctx.fillStyle = `rgb(${shade},${shade},${shade})`
      ctx.fillRect(x0 + x * scale, y0 + y * scale, scale, scale)
    }
  }
}

function slotRecordsFromExamples(examples, className, limit) {
  const out = []
  const seen = new Set()
  for (const example of examples || []) {
    for (const slot of example.slotQualities || []) {
      const key = `${example.captureId}::${slot.id}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({
        uid: `${className}-${String(out.length + 1).padStart(3, '0')}`,
        proposedClass: className,
        label: '',
        captureId: example.captureId,
        layoutId: example.layoutId,
        family: example.family,
        questionLabel: example.questionLabel,
        expected: example.expected,
        truth: example.truth,
        appPrediction: example.appPrediction,
        debugFile: example.debugFile,
        tensorId: slot.id,
        digitIndex: slot.digitIndex,
        bestVariantName: slot.bestVariantName,
        usableVariantRatio: slot.usableVariantRatio,
        artifactVariantRatio: slot.artifactVariantRatio,
        weakVariantRatio: slot.weakVariantRatio,
        allVariantsWeak: slot.allVariantsWeak,
        bestQuality: slot.bestQuality
      })
      if (out.length >= limit) return out
    }
  }
  return out
}

function pickVariantTensor(tensorItem, variantName) {
  if (!tensorItem) return null
  if (variantName === 'base') return tensorItem.tensor
  const variant = (tensorItem.tensorVariants || []).find((item) => item.name === variantName)
  return variant?.tensor || tensorItem.tensor || null
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 3) {
  const words = String(text).split(/\s+/)
  let line = ''
  let lines = 0
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y)
      y += lineHeight
      lines += 1
      line = word
      if (lines >= maxLines) return y
    } else {
      line = test
    }
  }
  if (line && lines < maxLines) ctx.fillText(line, x, y)
  return y + lineHeight
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const report = await readJson(opts.report)
  const suspicious = slotRecordsFromExamples(report.examples?.yellowWrongHighArtifact, 'suspicious-artifact', opts.perClass)
  const cleanSource = [
    ...(report.examples?.autoCorrectClean || []),
    ...(report.examples?.yellowCorrectClean || [])
  ]
  const clean = slotRecordsFromExamples(cleanSource, 'comparison-auto-correct', opts.perClass)
  const records = suspicious.concat(clean)
  const debugCache = new Map()

  await fs.mkdir(opts.outDir, { recursive: true })
  const cellW = 220
  const cellH = 174
  const cols = 4
  const rows = Math.ceil(records.length / cols)
  const canvas = createCanvas(cols * cellW, rows * cellH)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#111'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.font = '12px sans-serif'
  ctx.textBaseline = 'top'

  for (let i = 0; i < records.length; i += 1) {
    const record = records[i]
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = col * cellW
    const y = row * cellH
    ctx.fillStyle = record.proposedClass === 'suspicious-artifact' ? '#2b1b1b' : '#172417'
    ctx.fillRect(x + 4, y + 4, cellW - 8, cellH - 8)
    ctx.strokeStyle = record.proposedClass === 'suspicious-artifact' ? '#f08b75' : '#76d18b'
    ctx.lineWidth = 2
    ctx.strokeRect(x + 4, y + 4, cellW - 8, cellH - 8)

    if (!debugCache.has(record.debugFile)) {
      const wrapped = await readJson(record.debugFile)
      debugCache.set(record.debugFile, wrapped.debug || wrapped)
    }
    const debug = debugCache.get(record.debugFile)
    const tensorItem = (debug.tensors || []).find((item) => Number(item.id) === Number(record.tensorId))
    const baseTensor = tensorItem?.tensor
    const bestTensor = pickVariantTensor(tensorItem, record.bestVariantName)
    tensorToImageData(ctx, baseTensor, x + 12, y + 28, 4)
    tensorToImageData(ctx, bestTensor, x + 132, y + 28, 4)

    ctx.fillStyle = '#fff'
    ctx.font = 'bold 12px sans-serif'
    ctx.fillText(record.uid, x + 10, y + 10)
    ctx.font = '11px sans-serif'
    ctx.fillText('base', x + 12, y + 142)
    ctx.fillText(record.bestVariantName || 'best', x + 132, y + 142)
    const meta = `${record.layoutId?.replace('sg-g1-lw-', '')} Q${record.questionLabel} T:${record.truth} App:${record.appPrediction}`
    wrapText(ctx, meta, x + 10, y + 156, cellW - 20, 12, 1)
  }

  const contactSheet = path.join(opts.outDir, 'contact-sheet.png')
  const recordsPath = path.join(opts.outDir, 'records.json')
  const instructionsPath = path.join(opts.outDir, 'README.md')
  await fs.writeFile(contactSheet, canvas.toBuffer('image/png'))
  await fs.writeFile(recordsPath, `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    report: opts.report,
    labelOptions: ['real-writing', 'blank', 'box-line-divider', 'fragment-noise', 'unclear'],
    records
  }, null, 2)}\n`)
  await fs.writeFile(instructionsPath, [
    '# ScanGrade Artifact Label Pack',
    '',
    'Use `contact-sheet.png` and `records.json` to label whether each tensor looks like real handwriting or an artifact.',
    '',
    'The green comparison examples came from auto-correct or yellow-correct cases, but they are not guaranteed to be real handwriting. Label only the visible tensor.',
    '',
    'Suggested labels:',
    '',
    '- `real-writing`',
    '- `blank`',
    '- `box-line-divider`',
    '- `fragment-noise`',
    '- `unclear`',
    '',
    'Only label what is visible in the tensor, not whether the math answer is correct.',
    ''
  ].join('\n'))
  console.log(JSON.stringify({
    outDir: opts.outDir,
    contactSheet,
    recordsPath,
    suspicious: suspicious.length,
    clean: clean.length,
    total: records.length
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
