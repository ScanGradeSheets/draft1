#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCanvas, loadImage } from 'canvas'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const DEFAULT_ROOT = path.join(ROOT, 'private-evidence', 'debug-scans')
const DEFAULT_OUT = path.join(ROOT, 'private-evidence', 'reports', 'left-one-to-seven-contact.png')

function parseArgs(argv) {
  const opts = {
    root: DEFAULT_ROOT,
    out: DEFAULT_OUT,
    family: 'left-one-to-seven',
    max: 40
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--root') opts.root = path.resolve(argv[++i])
    else if (arg === '--out') opts.out = path.resolve(argv[++i])
    else if (arg === '--family') opts.family = argv[++i]
    else if (arg === '--max') opts.max = Number(argv[++i]) || opts.max
    else throw new Error(`Unknown argument: ${arg}`)
  }
  return opts
}

async function walk(dir) {
  const out = []
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...await walk(file))
    else out.push(file)
  }
  return out
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'))
}

function predictionDigitIndex(prediction) {
  const digitIndex = Number(prediction?.digitIndex)
  if (Number.isInteger(digitIndex)) return digitIndex
  const id = Number(prediction?.id)
  return Number.isInteger(id) ? id % 2 : 0
}

function expectedSlotsForGroup(group) {
  const ids = Array.isArray(group?.digitBoxIds) ? group.digitBoxIds : []
  const answerText = group?.answer == null ? '' : String(group.answer).replace(/\D/g, '')
  const digits = answerText.split('')
  const blanks = Math.max(0, ids.length - digits.length)
  return [...Array(blanks).fill(null), ...digits].slice(-ids.length)
}

function matchesFamily(opts, group, prediction, expectedDigit, slotIndex, slotCount) {
  const predictedDigit = prediction?.digit == null ? '' : String(prediction.digit)
  if (opts.family === 'left-one-to-seven') {
    return slotCount > 1 && slotIndex === 0 && expectedDigit === '1' && predictedDigit === '7'
  }
  if (opts.family === 'left-one-to-nine') {
    return slotCount > 1 && slotIndex === 0 && expectedDigit === '1' && predictedDigit === '9'
  }
  if (opts.family === 'left-one-not-one') {
    return slotCount > 1 && slotIndex === 0 && expectedDigit === '1' && predictedDigit !== '1'
  }
  if (opts.family === 'optional-leading-digit') {
    return slotCount > 1 && slotIndex === 0 && expectedDigit == null && predictedDigit !== ''
  }
  if (opts.family === 'single-six-to-five') {
    return slotCount === 1 && expectedDigit === '6' && predictedDigit === '5'
  }
  throw new Error(`Unknown family: ${opts.family}`)
}

function cropPaths(dir, id) {
  const index = String(Number(id) + 1).padStart(2, '0')
  return {
    raw: path.join(dir, 'raw-crops', `raw-${index}.png`),
    model: path.join(dir, 'model-inputs', `model-${index}.png`)
  }
}

async function collectRows(opts) {
  const files = (await walk(opts.root)).filter((file) => file.endsWith('/debug.json')).sort()
  const rows = []
  for (const file of files) {
    const outer = await readJson(file)
    const debug = outer.debug || outer
    const layoutId = debug?.layoutId || debug?.qrPayload?.layout_id || ''
    if (!Array.isArray(debug?.answerGroups) || !Array.isArray(debug?.predictions)) continue
    for (const group of debug.answerGroups) {
      const ids = Array.isArray(group?.digitBoxIds) ? group.digitBoxIds : []
      const expectedSlots = expectedSlotsForGroup(group)
      for (let slotIndex = 0; slotIndex < ids.length; slotIndex += 1) {
        const id = ids[slotIndex]
        const prediction = debug.predictions.find((candidate) => Number(candidate?.id) === Number(id))
        if (!prediction) continue
        if (!matchesFamily(opts, group, prediction, expectedSlots[slotIndex], slotIndex, ids.length)) continue
        const dir = path.dirname(file)
        const paths = cropPaths(dir, id)
        try {
          await fs.access(paths.raw)
          await fs.access(paths.model)
        } catch {
          continue
        }
        rows.push({
          file,
          dir,
          layoutId,
          questionNum: group.questionNum,
          slotIndex,
          id,
          expected: expectedSlots[slotIndex],
          predicted: prediction.digit,
          confidence: Number(prediction.confidence),
          topGap: Number(prediction.topGap),
          reviewNeeded: prediction.reviewNeeded === true || group.reviewNeeded === true,
          reason: prediction.preprocessReviewReason || prediction.confidencePolicyClearanceReason || prediction.robustOverride || '',
          rawPath: paths.raw,
          modelPath: paths.model,
          answerText: group.answerText,
          answer: group.answer
        })
      }
    }
  }
  rows.sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
  return rows.slice(0, opts.max)
}

async function drawContact(rows, opts) {
  const cellW = 260
  const cellH = 190
  const cols = 4
  const headerH = 72
  const rowsCount = Math.max(1, Math.ceil(rows.length / cols))
  const canvas = createCanvas(cols * cellW, headerH + rowsCount * cellH)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#f6f7f9'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#15171a'
  ctx.font = 'bold 24px sans-serif'
  ctx.fillText(`ScanGrade ${opts.family} (${rows.length})`, 18, 30)
  ctx.font = '14px sans-serif'
  ctx.fillStyle = '#555b64'
  ctx.fillText('Each tile shows raw crop at left and model input at right.', 18, 54)

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]
    const col = i % cols
    const tileRow = Math.floor(i / cols)
    const x = col * cellW
    const y = headerH + tileRow * cellH
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(x + 8, y + 8, cellW - 16, cellH - 16)
    ctx.strokeStyle = '#d8dde6'
    ctx.strokeRect(x + 8, y + 8, cellW - 16, cellH - 16)

    const raw = await loadImage(row.rawPath)
    const model = await loadImage(row.modelPath)
    ctx.imageSmoothingEnabled = false
    ctx.fillStyle = '#000'
    ctx.fillRect(x + 18, y + 36, 104, 104)
    ctx.drawImage(raw, x + 18, y + 36, 104, 104)
    ctx.fillRect(x + 138, y + 36, 104, 104)
    ctx.drawImage(model, x + 138, y + 36, 104, 104)

    ctx.font = 'bold 12px sans-serif'
    ctx.fillStyle = '#15171a'
    ctx.fillText(`${row.layoutId.replace('sg-g1-lw-', '')} q${row.questionNum} id${row.id}`, x + 18, y + 24)
    ctx.font = '12px sans-serif'
    ctx.fillStyle = '#424852'
    ctx.fillText(`${row.answerText}->${row.answer}  ${row.expected}->${row.predicted}`, x + 18, y + 154)
    ctx.fillText(`conf ${Number(row.confidence).toFixed(3)} gap ${Number(row.topGap).toFixed(3)}`, x + 18, y + 170)
    ctx.fillStyle = row.reviewNeeded ? '#9a6a00' : '#b42318'
    ctx.fillText(row.reviewNeeded ? 'review' : 'auto', x + 190, y + 170)
  }

  await fs.mkdir(path.dirname(opts.out), { recursive: true })
  await fs.writeFile(opts.out, canvas.toBuffer('image/png'))
}

const opts = parseArgs(process.argv.slice(2))
const rows = await collectRows(opts)
await drawContact(rows, opts)
console.log(path.relative(ROOT, opts.out))
