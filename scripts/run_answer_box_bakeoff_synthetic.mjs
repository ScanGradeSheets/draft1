#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCanvas, loadImage } from 'canvas'
import { chromium } from 'playwright'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const DEFAULT_TRUTH = path.join(
  ROOT,
  'private-evidence',
  'truth-labels',
  '20260703-flex-duplicate-accepted-needs-label',
  'handwritten-truth-labelled.json'
)
const DEFAULT_OUT = path.join(ROOT, 'private-evidence', 'reports', 'answer-box-bakeoff-synthetic-20260704')
const DEFAULT_URL = process.env.SG_REPLAY_URL || 'https://127.0.0.1:5174'
const PAGE_W = 1700
const PAGE_H = 2200

function parseArgs(argv) {
  const opts = {
    truth: DEFAULT_TRUTH,
    outDir: DEFAULT_OUT,
    url: DEFAULT_URL,
    limit: 120,
    seed: 7,
    generateOnly: false
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--truth') opts.truth = path.resolve(argv[++i])
    else if (arg === '--out-dir') opts.outDir = path.resolve(argv[++i])
    else if (arg === '--url') opts.url = argv[++i] || opts.url
    else if (arg === '--limit') opts.limit = Math.max(1, Number(argv[++i]) || opts.limit)
    else if (arg === '--seed') opts.seed = Number(argv[++i]) || opts.seed
    else if (arg === '--generate-only') opts.generateOnly = true
    else throw new Error(`Unknown argument: ${arg}`)
  }
  return opts
}

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a += 0x6d2b79f5
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle(items, seed) {
  const rng = mulberry32(seed)
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function normalized(value) {
  return String(value ?? '').replace(/_/g, '').trim()
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'))
}

async function imageFromFile(file) {
  return loadImage(file)
}

function imagePixels(image) {
  const canvas = createCanvas(image.width, image.height)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(image, 0, 0)
  return {
    canvas,
    ctx,
    data: ctx.getImageData(0, 0, image.width, image.height)
  }
}

function lumaAt(data, index) {
  const r = data.data[index]
  const g = data.data[index + 1]
  const b = data.data[index + 2]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function percentile(sorted, p) {
  if (!sorted.length) return 0
  const index = Math.max(0, Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p)))
  return sorted[index]
}

function estimateInkThreshold(data) {
  const values = []
  for (let offset = 0; offset < data.data.length; offset += 4) {
    if (data.data[offset + 3] <= 20) continue
    const luma = lumaAt(data, offset)
    if (luma < 245) values.push(luma)
  }
  values.sort((a, b) => a - b)
  if (!values.length) return 145
  return Math.max(112, Math.min(150, percentile(values, 0.08) + 8))
}

function cleanDarkMask(dark, w, h) {
  const out = new Uint8Array(w * h)
  const seen = new Uint8Array(w * h)
  const stack = []
  for (let index = 0; index < dark.length; index += 1) {
    if (!dark[index] || seen[index]) continue
    stack.length = 0
    stack.push(index)
    seen[index] = 1
    const pixels = []
    let minX = w
    let minY = h
    let maxX = -1
    let maxY = -1
    while (stack.length) {
      const current = stack.pop()
      pixels.push(current)
      const y = Math.floor(current / w)
      const x = current - y * w
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
      const neighbors = [
        x > 0 ? current - 1 : -1,
        x < w - 1 ? current + 1 : -1,
        y > 0 ? current - w : -1,
        y < h - 1 ? current + w : -1
      ]
      for (const next of neighbors) {
        if (next < 0 || !dark[next] || seen[next]) continue
        seen[next] = 1
        stack.push(next)
      }
    }
    const boxW = maxX - minX + 1
    const boxH = maxY - minY + 1
    if (pixels.length < 5 || boxW < 2 || boxH < 3) continue
    for (const pixel of pixels) out[pixel] = 1
  }
  return out
}

function extractDigitMasks(image, digitCount) {
  const { data } = imagePixels(image)
  const w = image.width
  const h = image.height
  const dark = new Uint8Array(w * h)
  const threshold = estimateInkThreshold(data)
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const offset = (y * w + x) * 4
      const luma = lumaAt(data, offset)
      const alpha = data.data[offset + 3]
      if (alpha > 20 && luma < threshold) {
        dark[y * w + x] = 1
      }
    }
  }
  const cleaned = cleanDarkMask(dark, w, h)
  const colCounts = new Array(w).fill(0)
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (cleaned[y * w + x]) colCounts[x] += 1
    }
  }

  const activeCols = []
  for (let x = 0; x < w; x += 1) {
    if (colCounts[x] >= 1) activeCols.push(x)
  }
  if (!activeCols.length) return []

  let clusters = []
  let start = activeCols[0]
  let prev = activeCols[0]
  for (const x of activeCols.slice(1)) {
    if (x - prev > 8) {
      clusters.push([start, prev])
      start = x
    }
    prev = x
  }
  clusters.push([start, prev])
  clusters = clusters
    .map(([x0, x1]) => {
      let ink = 0
      for (let y = 0; y < h; y += 1) {
        for (let x = x0; x <= x1; x += 1) ink += dark[y * w + x]
      }
      return { x0, x1, ink }
    })
    .filter((cluster) => cluster.ink >= 8)

  if (clusters.length !== digitCount) {
    const xMin = Math.min(...activeCols)
    const xMax = Math.max(...activeCols)
    const cuts = largestGapCuts(colCounts, xMin, xMax, digitCount)
    clusters = []
    for (let i = 0; i < digitCount; i += 1) {
      const x0 = i === 0 ? xMin : cuts[i - 1] + 1
      const x1 = i === digitCount - 1 ? xMax : cuts[i]
      clusters.push({ x0, x1, ink: 1 })
    }
  }

  return clusters.slice(0, digitCount).map((cluster) => cropInkMask(data, cleaned, w, h, cluster.x0, cluster.x1))
}

function largestGapCuts(colCounts, xMin, xMax, digitCount) {
  if (digitCount <= 1) return []
  const gaps = []
  let inGap = false
  let gapStart = xMin
  for (let x = xMin; x <= xMax; x += 1) {
    const empty = colCounts[x] === 0
    if (empty && !inGap) {
      inGap = true
      gapStart = x
    } else if (!empty && inGap) {
      gaps.push({ x0: gapStart, x1: x - 1, size: x - gapStart })
      inGap = false
    }
  }
  if (inGap) gaps.push({ x0: gapStart, x1: xMax, size: xMax - gapStart + 1 })
  const usable = gaps
    .filter((gap) => gap.x0 > xMin + 3 && gap.x1 < xMax - 3)
    .sort((a, b) => b.size - a.size)
    .slice(0, digitCount - 1)
    .map((gap) => Math.round((gap.x0 + gap.x1) / 2))
    .sort((a, b) => a - b)
  if (usable.length === digitCount - 1) return usable
  const fallback = []
  for (let i = 1; i < digitCount; i += 1) {
    fallback.push(Math.round(xMin + ((xMax - xMin) * i) / digitCount))
  }
  return fallback
}

function cropInkMask(imageData, dark, imageW, imageH, x0, x1) {
  let minX = imageW
  let minY = imageH
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < imageH; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      if (!dark[y * imageW + x]) continue
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  }
  if (maxX < minX || maxY < minY) return null
  const pad = 5
  minX = Math.max(0, minX - pad)
  minY = Math.max(0, minY - pad)
  maxX = Math.min(imageW - 1, maxX + pad)
  maxY = Math.min(imageH - 1, maxY + pad)
  const outW = maxX - minX + 1
  const outH = maxY - minY + 1
  const canvas = createCanvas(outW, outH)
  const ctx = canvas.getContext('2d')
  const out = ctx.createImageData(outW, outH)
  for (let y = 0; y < outH; y += 1) {
    for (let x = 0; x < outW; x += 1) {
      const srcX = minX + x
      const srcY = minY + y
      const srcOffset = (srcY * imageW + srcX) * 4
      const dstOffset = (y * outW + x) * 4
      const luma = lumaAt(imageData, srcOffset)
      if (dark[srcY * imageW + srcX]) {
        const alpha = Math.max(80, Math.min(230, Math.round((180 - luma) * 2.0)))
        out.data[dstOffset] = 48
        out.data[dstOffset + 1] = 48
        out.data[dstOffset + 2] = 48
        out.data[dstOffset + 3] = alpha
      }
    }
  }
  ctx.putImageData(out, 0, 0)
  return canvas
}

function truthEntriesForBakeoff(truth) {
  return (truth.entries || [])
    .filter((entry) => {
      const value = normalized(entry.truth)
      return (
        value.length >= 1 &&
        value.length <= 2 &&
        /^\d+$/.test(value) &&
        entry.truthStatus !== 'needs-label' &&
        entry.truthStatus !== 'unclear' &&
        entry.cropPath
      )
    })
}

function drawPage({ variant, entries, masksByUid }) {
  const canvas = createCanvas(PAGE_W, PAGE_H)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, PAGE_W, PAGE_H)

  drawMarkers(ctx)
  ctx.fillStyle = '#202124'
  ctx.font = '700 54px Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(`ScanGrade Answer Box Bakeoff: ${variant.label}`, PAGE_W / 2, 190)
  ctx.font = '400 27px Arial, sans-serif'
  ctx.fillStyle = '#5f6368'
  ctx.fillText('Synthetic page using real student handwriting crops', PAGE_W / 2, 238)

  const layout = {
    layout_id: `synthetic-${variant.id}`,
    version: 1,
    answer_key: [],
    page: { aspect_ratio: 0.7727, units: 'normalized' },
    homography: {
      marker_size: 0.05,
      anchors: [
        { id: 'tl', x: 0.05, y: 0.05 },
        { id: 'tr', x: 0.95, y: 0.05 },
        { id: 'br', x: 0.95, y: 0.95 },
        { id: 'bl', x: 0.05, y: 0.95 }
      ]
    },
    boxes: [],
    question_groups: []
  }

  const positions = answerPositions()
  let boxId = 0
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i]
    const value = normalized(entry.truth)
    const position = positions[i]
    const cells = cellRects(position.x, position.y)
    const digits = value.length === 1 ? [null, value[0]] : [value[0], value[1]]

    drawPrompt(ctx, entry, position)
    drawAnswerFrame(ctx, variant, cells)
    const masks = masksByUid.get(entry.uid) || []
    const maskOffset = value.length === 1 ? 1 : 0
    for (let slot = 0; slot < 2; slot += 1) {
      const digit = digits[slot]
      const cell = cells[slot]
      layout.answer_key.push(digit == null ? null : Number(digit))
      layout.boxes.push({
        id: boxId,
        question_num: i + 1,
        digit_index: slot,
        digit_place: slot === 0 ? 'tens' : 'ones',
        x: (cell.x + cell.w) / PAGE_W,
        y: (cell.y + cell.h) / PAGE_H,
        width: cell.w / PAGE_W,
        height: cell.h / PAGE_H,
        expected_type: digit == null ? 'optional_blank_or_digit' : 'digit',
        expected_digit: digit == null ? null : Number(digit)
      })
      if (digit != null) {
        const mask = masks[slot - maskOffset]
        if (mask) drawDigitMask(ctx, mask, cell, i, slot)
      }
      boxId += 1
    }

    const labels = value.length === 1
      ? [
          { label: `_${value}`, digits: [null, Number(value)] },
          { label: `${value}_`, digits: [Number(value), null] },
          { label: `0${value}`, digits: [0, Number(value)] }
        ]
      : [{ label: value, digits: value.split('').map(Number) }]
    layout.question_groups.push({
      question_num: i + 1,
      problem: entry.problem || 'Synthetic handwriting sample',
      answer: Number(value),
      digit_box_ids: [boxId - 2, boxId - 1],
      canonical_digits: digits.map((digit) => digit == null ? null : Number(digit)),
      guide_line: {
        type: variant.id,
        slot_count: 2,
        printed: true,
        x_values: [((cells[0].x + cells[0].w + cells[1].x) / 2) / PAGE_W],
        y1: cells[0].y / PAGE_H,
        y2: (cells[0].y + cells[0].h) / PAGE_H
      },
      accepted_digit_responses: labels.map((item) => ({
        ...item,
        meaning: 'accepted numeric placement for synthetic bakeoff'
      }))
    })
  }

  return { canvas, layout }
}

function drawMarkers(ctx) {
  ctx.fillStyle = '#111'
  const size = 86
  const centers = [
    [PAGE_W * 0.05, PAGE_H * 0.05],
    [PAGE_W * 0.95, PAGE_H * 0.05],
    [PAGE_W * 0.95, PAGE_H * 0.95],
    [PAGE_W * 0.05, PAGE_H * 0.95]
  ]
  for (const [cx, cy] of centers) {
    ctx.fillRect(cx - size / 2, cy - size / 2, size, size)
  }
}

function answerPositions() {
  const rows = [520, 760, 1000, 1240, 1480]
  const cols = [590, 1110]
  const out = []
  for (const x of cols) {
    for (const y of rows) out.push({ x, y })
  }
  return out
}

function cellRects(x, y) {
  const w = 126
  const h = 134
  const gap = 30
  return [
    { x, y, w, h },
    { x: x + w + gap, y, w, h }
  ]
}

function drawPrompt(ctx, entry, position) {
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#202124'
  const cy = position.y + 67
  const bubbleX = position.x - 92
  ctx.textAlign = 'center'
  ctx.font = '700 25px Arial, sans-serif'
  ctx.beginPath()
  ctx.arc(bubbleX, cy, 23, 0, Math.PI * 2)
  ctx.strokeStyle = '#555b62'
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.fillText(String.fromCharCode(65 + ((Number(entry.questionLabel) || 1) - 1) % 26), bubbleX, cy + 1)
}

function drawAnswerFrame(ctx, variant, cells) {
  ctx.save()
  ctx.strokeStyle = '#15171a'
  ctx.lineWidth = 5
  ctx.lineJoin = 'miter'
  if (variant.id === 'separate-cells') {
    for (const cell of cells) ctx.strokeRect(cell.x, cell.y, cell.w, cell.h)
  } else if (variant.id === 'joined-open-divider') {
    const x = cells[0].x
    const y = cells[0].y
    const w = cells[1].x + cells[1].w - cells[0].x
    const h = cells[0].h
    const mid = cells[0].x + cells[0].w + (cells[1].x - cells[0].x - cells[0].w) / 2
    ctx.strokeRect(x, y, w, h)
    ctx.strokeStyle = '#6f7782'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(mid, y)
    ctx.lineTo(mid, y + h * 0.24)
    ctx.moveTo(mid, y + h * 0.76)
    ctx.lineTo(mid, y + h)
    ctx.stroke()
  }
  ctx.restore()
}

function drawDigitMask(ctx, mask, cell, entryIndex, slot) {
  const maxW = cell.w * 0.66
  const maxH = cell.h * 0.75
  const scale = Math.min(maxW / mask.width, maxH / mask.height)
  const w = mask.width * scale
  const h = mask.height * scale
  const dx = cell.x + (cell.w - w) / 2 + ((entryIndex + slot) % 3 - 1) * cell.w * 0.035
  const dy = cell.y + (cell.h - h) / 2 + ((entryIndex + slot) % 2 ? -1 : 1) * cell.h * 0.025
  ctx.save()
  ctx.translate(dx + w / 2, dy + h / 2)
  ctx.rotate(((entryIndex + slot) % 5 - 2) * 0.018)
  ctx.drawImage(mask, -w / 2, -h / 2, w, h)
  ctx.restore()
}

async function buildPages(opts, entries) {
  const masksByUid = new Map()
  const usable = []
  for (const entry of entries) {
    const cropFile = path.isAbsolute(entry.cropPath) ? entry.cropPath : path.join(ROOT, entry.cropPath)
    const image = await imageFromFile(cropFile).catch(() => null)
    if (!image) continue
    const value = normalized(entry.truth)
    const masks = extractDigitMasks(image, value.length).filter(Boolean)
    if (masks.length !== value.length) continue
    masksByUid.set(entry.uid, masks)
    usable.push(entry)
  }

  const variants = [
    { id: 'joined-open-divider', label: 'Joined Open Divider' },
    { id: 'separate-cells', label: 'Separate Cells' }
  ]
  const pages = []
  for (let start = 0; start < usable.length; start += 10) {
    const pageEntries = usable.slice(start, start + 10)
    if (pageEntries.length < 10) break
    const pageIndex = pages.length + 1
    for (const variant of variants) {
      const { canvas, layout } = drawPage({ variant, entries: pageEntries, masksByUid })
      const base = `page-${String(pageIndex).padStart(3, '0')}-${variant.id}`
      const imagePath = path.join(opts.outDir, `${base}.png`)
      const layoutPath = path.join(opts.outDir, `${base}.layout.json`)
      await fs.writeFile(imagePath, canvas.toBuffer('image/png'))
      await fs.writeFile(layoutPath, JSON.stringify(layout, null, 2))
      pages.push({
        pageIndex,
        variant: variant.id,
        imagePath,
        layoutPath,
        layout,
        entries: pageEntries.map((entry) => ({
          uid: entry.uid,
          truth: normalized(entry.truth),
          layoutId: entry.layoutId,
          questionLabel: entry.questionLabel,
          problem: entry.problem
        }))
      })
    }
  }
  return pages
}

function pageDataUrl(file) {
  return fs.readFile(file).then((buffer) => `data:image/png;base64,${buffer.toString('base64')}`)
}

async function evaluatePages(opts, pages) {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ ignoreHTTPSErrors: true })
  await page.goto(`${opts.url}/?liveOcrDebug=1`, { waitUntil: 'networkidle', timeout: 45000 })
  await page.waitForFunction(
    () => !!window.cv && typeof window.cv.Mat !== 'undefined',
    undefined,
    { timeout: 60000 }
  )

  const rows = []
  for (const pageSpec of pages) {
    const imageDataUrl = await pageDataUrl(pageSpec.imagePath)
    const result = await page.evaluate(async ({ imageDataUrl, layout }) => {
      const { processWorksheet } = await import('/src/homography.js')
      const { initDigitModel, recognizeDigitsWithPreprocessVariants } = await import('/src/ocr-pipeline.js')
      await initDigitModel()

      const img = new Image()
      img.src = imageDataUrl
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
      })
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      canvas.getContext('2d').drawImage(img, 0, 0)
      const src = cv.imread(canvas)
      const processed = processWorksheet(src, layout)
      src.delete()
      if (!processed) return { ok: false, reason: 'processWorksheet returned null' }

      function tensorInk(tensor) {
        let inkPixels = 0
        let minX = 28
        let minY = 28
        let maxX = -1
        let maxY = -1
        for (let i = 0; i < tensor.length; i += 1) {
          const value = tensor[i] || 0
          if (value <= 0.16) continue
          const y = Math.floor(i / 28)
          const x = i - y * 28
          inkPixels += 1
          minX = Math.min(minX, x)
          minY = Math.min(minY, y)
          maxX = Math.max(maxX, x)
          maxY = Math.max(maxY, y)
        }
        return {
          inkPixels,
          inkW: maxX >= minX ? maxX - minX + 1 : 0,
          inkH: maxY >= minY ? maxY - minY + 1 : 0
        }
      }

      function tensorPreviewDataUrl() {
        const scale = 4
        const cell = 28 * scale
        const cols = 10
        const rows = Math.ceil(processed.processedTensors.length / cols)
        const out = document.createElement('canvas')
        out.width = cols * cell
        out.height = rows * cell
        const ctx = out.getContext('2d')
        ctx.fillStyle = '#000'
        ctx.fillRect(0, 0, out.width, out.height)
        for (let index = 0; index < processed.processedTensors.length; index += 1) {
          const item = processed.processedTensors[index]
          const tiny = document.createElement('canvas')
          tiny.width = 28
          tiny.height = 28
          const tinyCtx = tiny.getContext('2d')
          const data = tinyCtx.createImageData(28, 28)
          for (let i = 0; i < 784; i += 1) {
            const v = Math.max(0, Math.min(255, Math.round((item.tensor[i] || 0) * 255)))
            data.data[i * 4] = v
            data.data[i * 4 + 1] = v
            data.data[i * 4 + 2] = v
            data.data[i * 4 + 3] = 255
          }
          tinyCtx.putImageData(data, 0, 0)
          ctx.imageSmoothingEnabled = false
          ctx.drawImage(tiny, (index % cols) * cell, Math.floor(index / cols) * cell, cell, cell)
        }
        return out.toDataURL('image/png')
      }

      const digitRows = []
      for (let i = 0; i < processed.processedTensors.length; i += 1) {
        const tensor = processed.processedTensors[i]
        const expected = layout.answer_key[i]
        const ink = tensorInk(tensor.tensor)
        let pred = null
        if (ink.inkPixels >= 8) {
          const variants = Array.isArray(tensor.tensorVariants) && tensor.tensorVariants.length
            ? tensor.tensorVariants
            : [{ name: 'base', tensor: tensor.tensor }]
          const [prediction] = await recognizeDigitsWithPreprocessVariants(variants, null, {
            digitIndex: tensor.digitIndex,
            forceReviewOnDisagreement: true
          })
          const topK = prediction.topK || []
          pred = {
            digit: prediction.digit,
            confidence: prediction.confidence,
            topGap: topK.length >= 2 ? topK[0].confidence - topK[1].confidence : 1,
            review: prediction.preprocessDisagreement === true,
            topK: topK.slice(0, 3)
          }
        }
        digitRows.push({
          id: tensor.id,
          questionNum: tensor.questionNum,
          digitIndex: tensor.digitIndex,
          expected,
          ink,
          prediction: pred
        })
      }

      const preview = tensorPreviewDataUrl()
      processed.rawCrops.forEach((crop) => crop.image.delete())
      processed.warpedImage.delete()
      return { ok: true, digitRows, preview }
    }, { imageDataUrl, layout: pageSpec.layout })
    rows.push({ ...pageSpec, result })
  }

  await browser.close()
  return rows
}

async function writeDataUrl(file, dataUrl) {
  if (!dataUrl) return
  const base64 = dataUrl.split(',')[1]
  await fs.writeFile(file, Buffer.from(base64, 'base64'))
}

function boxBounds(box) {
  return {
    left: box.x - box.width,
    top: box.y - box.height,
    right: box.x,
    bottom: box.y,
    width: box.width,
    height: box.height
  }
}

function sameEntries(a, b) {
  if (!a || !b || a.length !== b.length) return false
  return a.every((entry, index) => {
    const other = b[index]
    return (
      entry.uid === other.uid &&
      normalized(entry.truth) === normalized(other.truth) &&
      String(entry.layoutId || '') === String(other.layoutId || '') &&
      String(entry.questionLabel || '') === String(other.questionLabel || '')
    )
  })
}

function sameAnswerKey(a, b) {
  if (!a || !b || a.length !== b.length) return false
  return a.every((value, index) => value === b[index])
}

function auditGeneratedPages(pages) {
  const errors = []
  const warnings = []
  const byVariant = {}
  const byPage = new Map()
  for (const page of pages) {
    byVariant[page.variant] = (byVariant[page.variant] || 0) + 1
    if (!byPage.has(page.pageIndex)) byPage.set(page.pageIndex, [])
    byPage.get(page.pageIndex).push(page)
    const { layout } = page
    if (layout.answer_key.length !== layout.boxes.length) {
      errors.push(`page ${page.pageIndex} ${page.variant}: answer_key length does not match boxes length`)
    }
    if (layout.boxes.length !== 20) {
      warnings.push(`page ${page.pageIndex} ${page.variant}: expected 20 digit boxes, found ${layout.boxes.length}`)
    }
    if (layout.question_groups.length !== 10) {
      warnings.push(`page ${page.pageIndex} ${page.variant}: expected 10 question groups, found ${layout.question_groups.length}`)
    }
    for (const box of layout.boxes) {
      const bounds = boxBounds(box)
      if (bounds.left < 0 || bounds.top < 0 || bounds.right > 1 || bounds.bottom > 1) {
        errors.push(`page ${page.pageIndex} ${page.variant}: box ${box.id} is out of normalized bounds`)
      }
      if (box.width <= 0 || box.height <= 0) {
        errors.push(`page ${page.pageIndex} ${page.variant}: box ${box.id} has non-positive dimensions`)
      }
      if (box.width < 0.04 || box.height < 0.04) {
        warnings.push(`page ${page.pageIndex} ${page.variant}: box ${box.id} is unusually small`)
      }
    }
    for (const group of layout.question_groups) {
      if (!Array.isArray(group.digit_box_ids) || group.digit_box_ids.length !== 2) {
        errors.push(`page ${page.pageIndex} ${page.variant}: question ${group.question_num} does not reference exactly two digit boxes`)
      }
      if (!Array.isArray(group.accepted_digit_responses) || !group.accepted_digit_responses.length) {
        warnings.push(`page ${page.pageIndex} ${page.variant}: question ${group.question_num} has no accepted digit response metadata`)
      }
    }
  }

  for (const [pageIndex, pair] of byPage.entries()) {
    if (pair.length !== 2) {
      errors.push(`page ${pageIndex}: expected two variants, found ${pair.length}`)
      continue
    }
    const joined = pair.find((page) => page.variant === 'joined-open-divider')
    const separate = pair.find((page) => page.variant === 'separate-cells')
    if (!joined || !separate) {
      errors.push(`page ${pageIndex}: missing joined-open-divider or separate-cells variant`)
      continue
    }
    if (!sameEntries(joined.entries, separate.entries)) {
      errors.push(`page ${pageIndex}: paired variants do not use the same handwriting entries`)
    }
    if (!sameAnswerKey(joined.layout.answer_key, separate.layout.answer_key)) {
      errors.push(`page ${pageIndex}: paired variants do not share the same answer key`)
    }
  }

  return {
    ok: errors.length === 0,
    pageCount: pages.length,
    pairCount: byPage.size,
    byVariant,
    errors,
    warnings
  }
}

function summarize(rows) {
  const byVariant = new Map()
  const examples = []
  for (const row of rows) {
    if (!byVariant.has(row.variant)) {
      byVariant.set(row.variant, {
        pages: 0,
        filledSlots: 0,
        filledCorrect: 0,
        filledReview: 0,
        blankSlots: 0,
        blankClean: 0,
        blankContaminated: 0,
        totalInkPixelsFilled: 0,
        totalInkPixelsBlank: 0
      })
    }
    const bucket = byVariant.get(row.variant)
    bucket.pages += 1
    if (!row.result?.ok) continue
    for (const digit of row.result.digitRows) {
      const expected = digit.expected
      if (expected == null) {
        bucket.blankSlots += 1
        bucket.totalInkPixelsBlank += digit.ink.inkPixels
        if (digit.ink.inkPixels <= 7) bucket.blankClean += 1
        else {
          bucket.blankContaminated += 1
          if (examples.length < 40) examples.push({ variant: row.variant, pageIndex: row.pageIndex, type: 'blank-contaminated', digit })
        }
      } else {
        bucket.filledSlots += 1
        bucket.totalInkPixelsFilled += digit.ink.inkPixels
        const ok = Number(digit.prediction?.digit) === Number(expected)
        if (ok) bucket.filledCorrect += 1
        if (digit.prediction?.review) bucket.filledReview += 1
        if (!ok && examples.length < 40) examples.push({ variant: row.variant, pageIndex: row.pageIndex, type: 'filled-miss', digit })
      }
    }
  }
  const pct = (n, d) => d ? Number((n / d * 100).toFixed(1)) : 0
  return {
    byVariant: Object.fromEntries([...byVariant.entries()].map(([variant, bucket]) => [variant, {
      ...bucket,
      filledAccuracyPct: pct(bucket.filledCorrect, bucket.filledSlots),
      blankCleanPct: pct(bucket.blankClean, bucket.blankSlots),
      avgInkPixelsFilled: bucket.filledSlots ? Number((bucket.totalInkPixelsFilled / bucket.filledSlots).toFixed(1)) : 0,
      avgInkPixelsBlank: bucket.blankSlots ? Number((bucket.totalInkPixelsBlank / bucket.blankSlots).toFixed(1)) : 0
    }])),
    examples
  }
}

async function drawFixtureContactSheet(opts, pages, audit) {
  const shownPairs = [...new Set(pages.map((page) => page.pageIndex))].slice(0, 4)
  const tileW = 520
  const tileH = 430
  const headerH = 150
  const canvas = createCanvas(tileW * 2, headerH + shownPairs.length * tileH)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#f5f6f8'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#1f2328'
  ctx.font = '700 34px Arial, sans-serif'
  ctx.fillText('Answer Box Bakeoff Fixtures', 24, 48)
  ctx.font = '18px Arial, sans-serif'
  ctx.fillStyle = '#5f6368'
  ctx.fillText(
    `${audit.pageCount} generated pages, ${audit.pairCount} paired handwriting sets, static audit ${audit.ok ? 'passed' : 'failed'}.`,
    24,
    82
  )
  ctx.fillText('Left: current joined/open divider. Right: proposed separate cells.', 24, 112)

  for (let row = 0; row < shownPairs.length; row += 1) {
    const pageIndex = shownPairs[row]
    const variants = [
      pages.find((page) => page.pageIndex === pageIndex && page.variant === 'joined-open-divider'),
      pages.find((page) => page.pageIndex === pageIndex && page.variant === 'separate-cells')
    ]
    for (let col = 0; col < variants.length; col += 1) {
      const page = variants[col]
      if (!page) continue
      const x = col * tileW + 18
      const y = headerH + row * tileH
      ctx.fillStyle = '#fff'
      ctx.fillRect(x, y, tileW - 36, tileH - 18)
      ctx.strokeStyle = '#d7dce4'
      ctx.strokeRect(x, y, tileW - 36, tileH - 18)
      ctx.fillStyle = '#202124'
      ctx.font = '700 20px Arial, sans-serif'
      ctx.fillText(`Page ${page.pageIndex}: ${page.variant}`, x + 14, y + 30)
      const image = await loadImage(page.imagePath).catch(() => null)
      if (!image) continue
      ctx.imageSmoothingEnabled = true
      const maxW = tileW - 70
      const maxH = tileH - 76
      const scale = Math.min(maxW / image.width, maxH / image.height)
      ctx.drawImage(image, x + 24, y + 48, image.width * scale, image.height * scale)
    }
  }

  const out = path.join(opts.outDir, 'fixture-contact-sheet.png')
  await fs.writeFile(out, canvas.toBuffer('image/png'))
  return out
}

async function drawContactSheet(opts, rows, summary) {
  const variants = Object.keys(summary.byVariant)
  const tileW = 520
  const tileH = 380
  const cols = 2
  const shown = rows.filter((row) => row.pageIndex <= 3)
  const canvas = createCanvas(cols * tileW, 170 + Math.ceil(shown.length / cols) * tileH)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#f5f6f8'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#1f2328'
  ctx.font = '700 34px Arial, sans-serif'
  ctx.fillText('ScanGrade Answer Box Synthetic Bakeoff', 24, 48)
  ctx.font = '18px Arial, sans-serif'
  ctx.fillStyle = '#5f6368'
  ctx.fillText('Real student handwriting masks placed into candidate answer boxes; previews show model input crops.', 24, 82)
  let y = 115
  ctx.font = '700 18px Arial, sans-serif'
  for (const variant of variants) {
    const item = summary.byVariant[variant]
    ctx.fillStyle = variant === 'separate-cells' ? '#0f7a44' : '#7a5a0f'
    ctx.fillText(
      `${variant}: filled ${item.filledCorrect}/${item.filledSlots} (${item.filledAccuracyPct}%), blank clean ${item.blankClean}/${item.blankSlots} (${item.blankCleanPct}%)`,
      24,
      y
    )
    y += 25
  }

  for (let i = 0; i < shown.length; i += 1) {
    const row = shown[i]
    const col = i % cols
    const r = Math.floor(i / cols)
    const x = col * tileW + 18
    const top = 170 + r * tileH
    ctx.fillStyle = '#fff'
    ctx.fillRect(x, top, tileW - 36, tileH - 20)
    ctx.strokeStyle = '#d7dce4'
    ctx.strokeRect(x, top, tileW - 36, tileH - 20)
    ctx.fillStyle = '#202124'
    ctx.font = '700 20px Arial, sans-serif'
    ctx.fillText(`Page ${row.pageIndex}: ${row.variant}`, x + 14, top + 30)
    const previewPath = path.join(opts.outDir, `page-${String(row.pageIndex).padStart(3, '0')}-${row.variant}-model-input.png`)
    const preview = await loadImage(previewPath).catch(() => null)
    if (preview) {
      ctx.imageSmoothingEnabled = false
      const maxW = tileW - 68
      const maxH = 124
      const scale = Math.min(maxW / preview.width, maxH / preview.height)
      ctx.drawImage(preview, x + 20, top + 50, preview.width * scale, preview.height * scale)
    }
    const pageImage = await loadImage(row.imagePath).catch(() => null)
    if (pageImage) {
      ctx.imageSmoothingEnabled = true
      const maxW = tileW - 68
      const maxH = 164
      const scale = Math.min(maxW / pageImage.width, maxH / pageImage.height)
      ctx.drawImage(pageImage, x + 20, top + 190, pageImage.width * scale, pageImage.height * scale)
    }
  }
  const out = path.join(opts.outDir, 'contact-sheet.png')
  await fs.writeFile(out, canvas.toBuffer('image/png'))
  return out
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  await fs.mkdir(opts.outDir, { recursive: true })
  const truth = await readJson(opts.truth)
  const selected = shuffle(truthEntriesForBakeoff(truth), opts.seed).slice(0, opts.limit)
  const pages = await buildPages(opts, selected)
  if (opts.generateOnly) {
    const audit = auditGeneratedPages(pages)
    const staticAudit = path.join(opts.outDir, 'static-audit.json')
    await fs.writeFile(staticAudit, JSON.stringify(audit, null, 2))
    const fixtureContactSheet = await drawFixtureContactSheet(opts, pages, audit)
    const report = {
      generatedAt: new Date().toISOString(),
      truth: opts.truth,
      selectedCount: selected.length,
      pageCount: pages.length,
      staticAudit,
      fixtureContactSheet,
      pages: pages.map((page) => ({
        pageIndex: page.pageIndex,
        variant: page.variant,
        imagePath: page.imagePath,
        layoutPath: page.layoutPath,
        entries: page.entries
      }))
    }
    const manifest = path.join(opts.outDir, 'generation-manifest.json')
    await fs.writeFile(manifest, JSON.stringify(report, null, 2))
    console.log(JSON.stringify({ outDir: opts.outDir, manifest, staticAudit, fixtureContactSheet, ...audit }, null, 2))
    return
  }
  const rows = await evaluatePages(opts, pages)
  for (const row of rows) {
    if (row.result?.preview) {
      const base = `page-${String(row.pageIndex).padStart(3, '0')}-${row.variant}`
      await writeDataUrl(path.join(opts.outDir, `${base}-model-input.png`), row.result.preview)
    }
  }
  const summary = summarize(rows)
  const report = {
    generatedAt: new Date().toISOString(),
    truth: opts.truth,
    url: opts.url,
    selectedCount: selected.length,
    pageCount: pages.length,
    summary,
    rows: rows.map((row) => ({
      pageIndex: row.pageIndex,
      variant: row.variant,
      imagePath: row.imagePath,
      layoutPath: row.layoutPath,
      entries: row.entries,
      result: row.result?.ok ? {
        ok: true,
        digitRows: row.result.digitRows
      } : row.result
    }))
  }
  await fs.writeFile(path.join(opts.outDir, 'summary.json'), JSON.stringify(report, null, 2))
  const contactSheet = await drawContactSheet(opts, rows, summary)
  console.log(JSON.stringify({
    outDir: opts.outDir,
    contactSheet,
    ...summary
  }, null, 2))
}

await main()
