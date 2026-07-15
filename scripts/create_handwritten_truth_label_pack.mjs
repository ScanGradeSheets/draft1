#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCanvas, loadImage } from 'canvas'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const DEFAULT_REPLAY_DIRS = [
  'private-evidence/reports/current-replay-20260703-flex-duplicate-a',
  'private-evidence/reports/current-replay-20260703-flex-duplicate-b',
  'private-evidence/reports/current-replay-20260703-flex-duplicate-c'
].map((dir) => path.join(ROOT, dir))
const DEFAULT_DEBUG_ROOT = path.join(ROOT, 'private-evidence', 'debug-scans')
const DEFAULT_OUT = path.join(ROOT, 'private-evidence', 'truth-labels', '20260703-flex-duplicate')

function parseArgs(argv) {
  const opts = {
    replayDirs: DEFAULT_REPLAY_DIRS,
    debugRoot: DEFAULT_DEBUG_ROOT,
    outDir: DEFAULT_OUT,
    acceptedOnly: false,
    needsLabelOnly: false,
    pageOffset: 0,
    pageLimit: null
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--replay-dir') opts.replayDirs.push(path.resolve(argv[++i]))
    else if (arg === '--debug-root') opts.debugRoot = path.resolve(argv[++i])
    else if (arg === '--out-dir') opts.outDir = path.resolve(argv[++i])
    else if (arg === '--accepted-only') opts.acceptedOnly = true
    else if (arg === '--needs-label-only') opts.needsLabelOnly = true
    else if (arg === '--page-offset') opts.pageOffset = Math.max(0, Number(argv[++i]) || 0)
    else if (arg === '--page-limit') {
      const parsed = Number(argv[++i])
      opts.pageLimit = Number.isFinite(parsed) && parsed > 0 ? parsed : null
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }
  return opts
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'))
}

async function walk(dir) {
  const out = []
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => [])
  for (const entry of entries) {
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...await walk(file))
    else out.push(file)
  }
  return out
}

function captureIdFromReplayFile(file) {
  return path.basename(file, '-replay-result.json')
}

function isRejected(row) {
  return Boolean(row.guard?.wouldReject || (typeof row.guard === 'string' && row.guard.startsWith('REJECT')))
}

async function loadReplayRows(opts) {
  const files = []
  for (const dir of opts.replayDirs) {
    const entries = await fs.readdir(dir).catch(() => [])
    for (const entry of entries) {
      if (entry.endsWith('-replay-result.json')) files.push(path.join(dir, entry))
    }
  }
  files.sort()
  const rows = []
  for (const file of files) {
    const replay = await readJson(file)
    const captureId = replay.file || captureIdFromReplayFile(file)
    const rejected = isRejected(replay)
    if (opts.acceptedOnly && rejected) continue
    rows.push({ captureId, replay, replayFile: file, rejected })
  }
  return rows.slice(opts.pageOffset, opts.pageLimit == null ? undefined : opts.pageOffset + opts.pageLimit)
}

async function buildDebugIndex(debugRoot) {
  const files = (await walk(debugRoot)).filter((file) => file.endsWith('/debug.json'))
  const index = new Map()
  for (const file of files) {
    index.set(path.basename(path.dirname(file)), file)
  }
  return index
}

function rectUnion(rects) {
  const valid = rects.filter(Boolean)
  if (!valid.length) return null
  const x0 = Math.min(...valid.map((rect) => rect.x))
  const y0 = Math.min(...valid.map((rect) => rect.y))
  const x1 = Math.max(...valid.map((rect) => rect.x + rect.w))
  const y1 = Math.max(...valid.map((rect) => rect.y + rect.h))
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

function expandRect(rect, imageW, imageH, padRatio = 0.18) {
  if (!rect) return null
  const padX = Math.max(12, rect.w * padRatio)
  const padY = Math.max(10, rect.h * padRatio)
  const x = Math.max(0, rect.x - padX)
  const y = Math.max(0, rect.y - padY)
  const right = Math.min(imageW, rect.x + rect.w + padX)
  const bottom = Math.min(imageH, rect.y + rect.h + padY)
  return { x, y, w: right - x, h: bottom - y }
}

function answerTextFromGroup(group) {
  if (typeof group?.predicted === 'string') return group.predicted.replace(/_/g, '')
  return ''
}

function normalizedExpected(group) {
  return String(group?.expected ?? '').replace(/_/g, '')
}

function cropForGroup(debug, group, imageW, imageH) {
  const ids = Array.isArray(group?.digitBoxIds)
    ? group.digitBoxIds
    : Array.isArray(group?.digit_box_ids)
      ? group.digit_box_ids
      : []
  const cropById = new Map((debug.annotationGeometry?.crops || []).map((crop, index) => [Number(crop.id ?? index), crop]))
  const rects = ids.map((id) => {
    const crop = cropById.get(Number(id))
    return crop?.expectedRect || crop?.refinedRect || crop?.boxRect || crop?.cropRect || null
  })
  return expandRect(rectUnion(rects), imageW, imageH)
}

async function writeRawGroupCrop(debugFile, digitBoxIds, outFile) {
  const debugDir = path.dirname(debugFile)
  const images = []
  for (const id of digitBoxIds) {
    const rawPath = path.join(debugDir, 'raw-crops', `raw-${String(Number(id) + 1).padStart(2, '0')}.png`)
    const image = await loadImage(rawPath).catch(() => null)
    if (image) images.push(image)
  }
  if (!images.length) return false

  const gap = 10
  const margin = 8
  const width = images.reduce((sum, image) => sum + image.width, 0) + gap * (images.length - 1) + margin * 2
  const height = Math.max(...images.map((image) => image.height)) + margin * 2
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.strokeStyle = '#d4dae3'
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1)
  ctx.imageSmoothingEnabled = false

  let x = margin
  for (const image of images) {
    const y = margin + (height - margin * 2 - image.height) / 2
    ctx.drawImage(image, x, y)
    x += image.width + gap
  }

  await fs.writeFile(outFile, canvas.toBuffer('image/png'))
  return true
}

function truthSeedForGroup(group) {
  if (group.review === false && group.correct === true) return answerTextFromGroup(group)
  return null
}

async function drawSheets(entries, opts) {
  const perSheet = 24
  const tileW = 360
  const tileH = 184
  const cols = 3
  const headerH = 72
  const sheetFiles = []
  for (let start = 0; start < entries.length; start += perSheet) {
    const chunk = entries.slice(start, start + perSheet)
    const rows = Math.ceil(chunk.length / cols)
    const canvas = createCanvas(cols * tileW, headerH + rows * tileH)
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#f5f6f8'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#15171a'
    ctx.font = 'bold 24px sans-serif'
    const sheetNum = Math.floor(start / perSheet) + 1
    ctx.fillText(`ScanGrade handwritten truth labels ${sheetNum}`, 18, 30)
    ctx.font = '14px sans-serif'
    ctx.fillStyle = '#555b64'
    ctx.fillText('Read the handwriting crop. Seeded truth is only filled for accepted auto-correct groups.', 18, 54)

    for (let i = 0; i < chunk.length; i += 1) {
      const entry = chunk[i]
      const col = i % cols
      const row = Math.floor(i / cols)
      const x = col * tileW
      const y = headerH + row * tileH
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(x + 8, y + 8, tileW - 16, tileH - 16)
      ctx.strokeStyle = entry.rejected ? '#d56b00' : '#d8dde6'
      ctx.strokeRect(x + 8, y + 8, tileW - 16, tileH - 16)

      if (entry.cropPath) {
        const cropImagePath = path.isAbsolute(entry.cropPath)
          ? entry.cropPath
          : path.join(ROOT, entry.cropPath)
        const image = await loadImage(cropImagePath)
        const maxW = tileW - 36
        const maxH = 92
        const scale = Math.min(maxW / image.width, maxH / image.height)
        const w = image.width * scale
        const h = image.height * scale
        ctx.imageSmoothingEnabled = false
        ctx.fillStyle = '#f0f2f5'
        ctx.fillRect(x + 18, y + 38, maxW, maxH)
        ctx.drawImage(image, x + 18 + (maxW - w) / 2, y + 38 + (maxH - h) / 2, w, h)
      }

      ctx.font = 'bold 12px sans-serif'
      ctx.fillStyle = '#15171a'
      ctx.fillText(`${entry.uid} ${entry.layoutId}`, x + 18, y + 25)
      ctx.font = '12px sans-serif'
      ctx.fillStyle = '#424852'
      ctx.fillText(`expected=${entry.expected} app=${entry.appPrediction} ${entry.review ? 'yellow' : 'auto'}${entry.rejected ? ' rejected' : ''}`, x + 18, y + 150)
      ctx.fillText(`truth=${entry.truth ?? ''}  id=${entry.captureId.slice(0, 28)}`, x + 18, y + 167)
    }

    const outFile = path.join(opts.outDir, `truth-contact-${String(sheetNum).padStart(3, '0')}.png`)
    await fs.writeFile(outFile, canvas.toBuffer('image/png'))
    sheetFiles.push(outFile)
  }
  return sheetFiles
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  await fs.mkdir(opts.outDir, { recursive: true })
  const replayRows = await loadReplayRows(opts)
  const debugIndex = await buildDebugIndex(opts.debugRoot)
  const entries = []

  for (let pageIndex = 0; pageIndex < replayRows.length; pageIndex += 1) {
    const row = replayRows[pageIndex]
    const debugFile = debugIndex.get(row.captureId)
    if (!debugFile) continue
    const outer = await readJson(debugFile)
    const debug = outer.debug || outer
    const groupByQuestion = new Map((debug.answerGroups || []).map((group) => [Number(group.questionNum), group]))
    const cropDir = path.join(opts.outDir, 'crops')
    await fs.mkdir(cropDir, { recursive: true })
    let warped = null

    for (const group of row.replay.groups || []) {
      const questionNum = Number(String(group.label).replace(/\D/g, '')) || entries.length + 1
      const debugGroup = groupByQuestion.get(questionNum) || {}
      const ids = Array.isArray(debugGroup.digitBoxIds) ? debugGroup.digitBoxIds : []
      let cropPath = null
      const targetCropPath = path.join(cropDir, `${row.captureId}-q${String(questionNum).padStart(2, '0')}.png`)
      if (await writeRawGroupCrop(debugFile, ids, targetCropPath)) {
        cropPath = targetCropPath
      } else {
        if (!warped) {
          const warpedPath = path.join(path.dirname(debugFile), 'warped.png')
          warped = await loadImage(warpedPath)
        }
        const cropRect = cropForGroup(debug, debugGroup, warped.width, warped.height)
        if (!cropRect) continue
        cropPath = targetCropPath
        const cropCanvas = createCanvas(Math.max(1, Math.round(cropRect.w)), Math.max(1, Math.round(cropRect.h)))
        const cropCtx = cropCanvas.getContext('2d')
        cropCtx.imageSmoothingEnabled = false
        cropCtx.drawImage(
          warped,
          cropRect.x,
          cropRect.y,
          cropRect.w,
          cropRect.h,
          0,
          0,
          cropCanvas.width,
          cropCanvas.height
        )
        await fs.writeFile(cropPath, cropCanvas.toBuffer('image/png'))
      }

      entries.push({
        schemaVersion: 1,
        uid: `${pageIndex + 1}.${questionNum}`,
        captureId: row.captureId,
        pageIndex,
        rejected: row.rejected,
        layoutId: debug.layoutId || debug.qrPayload?.layout_id || '',
        questionLabel: group.label,
        questionNum,
        problem: debugGroup.problem || '',
        expected: normalizedExpected(group),
        appPrediction: answerTextFromGroup(group),
        review: group.review === true,
        appQuestionCorrectAgainstKey: group.correct === true,
        truth: truthSeedForGroup(group),
        truthStatus: truthSeedForGroup(group) == null ? 'needs-label' : 'seeded-auto-correct',
        cropPath: cropPath ? path.relative(ROOT, cropPath) : null,
        debugPath: path.relative(ROOT, debugFile),
        replayPath: path.relative(ROOT, row.replayFile)
      })
    }
  }

  const outputEntries = opts.needsLabelOnly
    ? entries.filter((entry) => entry.truthStatus === 'needs-label')
    : entries
  const jsonl = entries.map((entry) => JSON.stringify(entry)).join('\n') + '\n'
  const json = JSON.stringify({
    generatedAt: new Date().toISOString(),
    replayDirs: opts.replayDirs.map((dir) => path.relative(ROOT, dir)),
    acceptedOnly: opts.acceptedOnly,
    needsLabelOnly: opts.needsLabelOnly,
    entries
  }, null, 2)
  await fs.writeFile(path.join(opts.outDir, 'handwritten-truth-labels.jsonl'), jsonl)
  await fs.writeFile(path.join(opts.outDir, 'handwritten-truth-labels.json'), json)
  const sheets = await drawSheets(outputEntries, opts)
  console.log(JSON.stringify({
    outDir: path.relative(ROOT, opts.outDir),
    pages: replayRows.length,
    entries: entries.length,
    sheetEntries: outputEntries.length,
    seeded: entries.filter((entry) => entry.truthStatus === 'seeded-auto-correct').length,
    needsLabel: entries.filter((entry) => entry.truthStatus === 'needs-label').length,
    contactSheets: sheets.map((file) => path.relative(ROOT, file))
  }, null, 2))
}

await main()
