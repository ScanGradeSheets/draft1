#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCanvas, loadImage } from 'canvas'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const AUDIT_PATH = path.join(
  ROOT,
  'private-evidence/reports/beta7-independent-safety-audit-20260723.json',
)
const OUTPUT_DIR = path.join(
  ROOT,
  'private-evidence/reports/beta7-independent-safety-audit-visual-20260723',
)
const DEBUG_SCAN_ROOT = path.join(ROOT, 'private-evidence/debug-scans')

function findOriginalScan(row) {
  const timestamp = row.pageId.replace(/--captured$/, '')
  const day = timestamp.slice(0, 10)
  const dayDir = path.join(DEBUG_SCAN_ROOT, day)
  const match = fs.readdirSync(dayDir)
    .find((name) => name.startsWith(`${timestamp}-${row.layoutId}-`))
  if (!match) throw new Error(`Original scan not found for ${row.uid}`)
  return path.join(dayDir, match)
}

async function cropForRow(row) {
  const replayDebug = JSON.parse(fs.readFileSync(path.join(ROOT, row.debugFile), 'utf8'))
  const zone = (replayDebug.v3AnswerZones || [])
    .find((item) => Number(item.questionNum) === Number(row.questionNum))
  if (!zone?.rect) throw new Error(`Answer zone not found for ${row.uid}`)

  const scanDir = findOriginalScan(row)
  const imagePath = path.join(scanDir, 'warped.png')
  const image = await loadImage(imagePath)
  const padX = Math.max(24, Math.round(zone.rect.w * 0.2))
  const padY = Math.max(24, Math.round(zone.rect.h * 0.2))
  const sx = Math.max(0, zone.rect.x - padX)
  const sy = Math.max(0, zone.rect.y - padY)
  const sw = Math.min(image.width - sx, zone.rect.w + 2 * padX)
  const sh = Math.min(image.height - sy, zone.rect.h + 2 * padY)
  return { image, sx, sy, sw, sh, imagePath }
}

function wrapLabel(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ')
  let line = ''
  let offset = 0
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width > maxWidth && line) {
      ctx.fillText(line, x, y + offset)
      line = word
      offset += lineHeight
    } else {
      line = next
    }
  }
  if (line) ctx.fillText(line, x, y + offset)
}

async function buildSheet(rows, name, title, columns = 4) {
  const cardWidth = 410
  const cardHeight = 270
  const headerHeight = 72
  const gutter = 14
  const rowCount = Math.ceil(rows.length / columns)
  const canvas = createCanvas(
    columns * cardWidth + (columns + 1) * gutter,
    headerHeight + rowCount * cardHeight + (rowCount + 1) * gutter,
  )
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#f5f6f8'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#111827'
  ctx.font = 'bold 26px sans-serif'
  ctx.fillText(title, gutter, 35)
  ctx.font = '16px sans-serif'
  ctx.fillStyle = '#4b5563'
  ctx.fillText(`${rows.length} independently selected answer zones; mathematical keys are not shown.`, gutter, 60)

  const manifest = []
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    const col = index % columns
    const gridRow = Math.floor(index / columns)
    const x = gutter + col * cardWidth
    const y = headerHeight + gutter + gridRow * cardHeight
    const crop = await cropForRow(row)

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(x, y, cardWidth - gutter, cardHeight - gutter)
    ctx.strokeStyle = '#d1d5db'
    ctx.strokeRect(x + 0.5, y + 0.5, cardWidth - gutter - 1, cardHeight - gutter - 1)

    const imageX = x + 12
    const imageY = y + 64
    const imageW = cardWidth - gutter - 24
    const imageH = 154
    ctx.fillStyle = '#e5e7eb'
    ctx.fillRect(imageX, imageY, imageW, imageH)
    const scale = Math.min(imageW / crop.sw, imageH / crop.sh)
    const drawW = crop.sw * scale
    const drawH = crop.sh * scale
    ctx.drawImage(
      crop.image,
      crop.sx,
      crop.sy,
      crop.sw,
      crop.sh,
      imageX + (imageW - drawW) / 2,
      imageY + (imageH - drawH) / 2,
      drawW,
      drawH,
    )

    ctx.fillStyle = '#111827'
    ctx.font = 'bold 15px sans-serif'
    wrapLabel(ctx, row.uid, x + 12, y + 21, cardWidth - gutter - 24, 18)
    ctx.font = '15px sans-serif'
    const oldRead = row.predecessor?.read ?? '—'
    const newRead = row.beta7?.read ?? '—'
    ctx.fillText(
      `Truth: ${row.truthText}   predecessor: ${oldRead}${row.predecessor?.automatic ? ' auto' : ' yellow'}   Beta 7: ${newRead}${row.beta7?.automatic ? ' auto' : ' yellow'}`,
      x + 12,
      y + 51,
    )
    ctx.font = '13px sans-serif'
    ctx.fillStyle = '#4b5563'
    ctx.fillText(
      `Source: ${path.relative(ROOT, crop.imagePath)}`,
      x + 12,
      y + cardHeight - gutter - 12,
    )
    manifest.push({
      uid: row.uid,
      truthText: row.truthText,
      predecessor: row.predecessor,
      beta7: row.beta7,
      sourceImage: path.relative(ROOT, crop.imagePath),
    })
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  fs.writeFileSync(path.join(OUTPUT_DIR, `${name}.png`), canvas.toBuffer('image/png'))
  fs.writeFileSync(
    path.join(OUTPUT_DIR, `${name}.json`),
    `${JSON.stringify(manifest, null, 2)}\n`,
  )
}

const audit = JSON.parse(fs.readFileSync(AUDIT_PATH, 'utf8'))
await buildSheet(
  audit.changedRows,
  'changed-decisions',
  'Beta 7 visual audit — every changed decision',
)
await buildSheet(
  audit.confidentErrorRows,
  'confident-errors',
  'Beta 7 visual audit — every confident transcription error',
)
console.log(path.relative(ROOT, OUTPUT_DIR))
