#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { createCanvas, loadImage } from 'canvas'

const ROOT = 'private-evidence/reports/pipeline-stage-samples-20260709'
const OUT = 'private-evidence/reports/pipeline-stage-contact-sheet-20260709.png'
const samples = [
  { dir: 'row-single-wrong', id: 0, label: 'Row single: truth 5, read 4' },
  { dir: 'row-single-correct', id: 0, label: 'Row single: truth 5, read 5' },
  { dir: 'row-two-right-wrong', id: 9, label: 'Row right slot: truth 5, read 4' },
  { dir: 'nonrow-single-wrong', id: 5, label: 'Non-row single: truth 1, read 7' },
  { dir: 'nonrow-left-wrong', id: 4, label: 'Non-row left slot: truth 4, read 1' },
  { dir: 'nonrow-right-wrong', id: 3, label: 'Non-row right slot: truth 5, read 6' }
]
const stages = [
  ['raw', 'Raw crop'], ['gray', 'Grayscale'], ['ink', 'Strict ink'], ['tensor', 'Strict 28×28'],
  ['gentle-ink', 'Gentle ink'], ['gentle-tensor', 'Gentle 28×28'],
  ['no-component-cleanup-tensor', 'Keep components'], ['no-rule-cleanup-tensor', 'Keep rules']
]

const cellW = 150, cellH = 150, labelW = 265, headerH = 72, rowH = 190
const canvas = createCanvas(labelW + stages.length * cellW, headerH + samples.length * rowH)
const ctx = canvas.getContext('2d')
ctx.fillStyle = '#f4f6f8'; ctx.fillRect(0, 0, canvas.width, canvas.height)
ctx.fillStyle = '#111827'; ctx.font = 'bold 25px sans-serif'; ctx.fillText('ScanGrade image fidelity through preprocessing', 18, 31)
ctx.font = '14px sans-serif'; ctx.fillStyle = '#4b5563'; ctx.fillText('Same handwriting across each row; black stages are classifier inputs.', 18, 55)
ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = '#1f2937'
for (let i = 0; i < stages.length; i += 1) ctx.fillText(stages[i][1], labelW + i * cellW + 12, headerH - 8)

for (let rowIndex = 0; rowIndex < samples.length; rowIndex += 1) {
  const sample = samples[rowIndex]
  const y = headerH + rowIndex * rowH
  ctx.fillStyle = rowIndex % 2 ? '#ffffff' : '#eef2f7'; ctx.fillRect(0, y, canvas.width, rowH)
  ctx.fillStyle = '#111827'; ctx.font = 'bold 15px sans-serif'
  const parts = sample.label.split(': '); ctx.fillText(parts[0], 16, y + 55)
  ctx.fillStyle = sample.label.includes('read 5') ? '#147d43' : '#b42318'; ctx.fillText(parts[1], 16, y + 80)
  ctx.fillStyle = '#6b7280'; ctx.font = '12px sans-serif'; ctx.fillText(sample.dir, 16, y + 105)
  for (let stageIndex = 0; stageIndex < stages.length; stageIndex += 1) {
    const [suffix] = stages[stageIndex]
    const prefix = `crop-${String(sample.id).padStart(2, '0')}`
    const file = path.join(ROOT, sample.dir, `${prefix}-${suffix}.png`)
    const image = await loadImage(file)
    const x = labelW + stageIndex * cellW + 10
    const size = 130
    ctx.fillStyle = suffix.includes('tensor') || suffix === 'ink' || suffix.includes('-ink') ? '#000' : '#fff'
    ctx.fillRect(x, y + 24, size, size)
    ctx.imageSmoothingEnabled = suffix === 'raw' || suffix === 'gray'
    const scale = Math.min(size / image.width, size / image.height)
    const w = image.width * scale, h = image.height * scale
    ctx.drawImage(image, x + (size - w) / 2, y + 24 + (size - h) / 2, w, h)
  }
}

await fs.mkdir(path.dirname(OUT), { recursive: true })
await fs.writeFile(OUT, canvas.toBuffer('image/png'))
console.log(OUT)
