#!/usr/bin/env node
import fs from 'node:fs/promises'
import { createCanvas, loadImage } from 'canvas'

const OUT = 'private-evidence/reports/perspective-stage-contact-sheet-20260709.png'
const samples = [
  {
    label: 'Lower perspective', metrics: '2.6° max corner deviation · 4/10 digit errors',
    captured: 'private-evidence/debug-scans/2026-07-01/2026-07-01_21-44-09-274-sg-g1-lw-09-number-patterns-f8e34890/captured.png',
    warped: 'private-evidence/debug-scans/2026-07-01/2026-07-01_21-44-09-274-sg-g1-lw-09-number-patterns-f8e34890/warped.png',
    overlay: 'private-evidence/reports/pipeline-stage-samples-20260709/perspective-low-patterns/overlay.png'
  },
  {
    label: 'Higher perspective', metrics: '17.8° max corner deviation · 8/10 digit errors',
    captured: 'private-evidence/debug-scans/2026-07-02/2026-07-02_03-40-53-193-sg-g1-lw-09-number-patterns-835b250a/captured.png',
    warped: 'private-evidence/debug-scans/2026-07-02/2026-07-02_03-40-53-193-sg-g1-lw-09-number-patterns-835b250a/warped.png',
    overlay: 'private-evidence/reports/pipeline-stage-samples-20260709/nonrow-right-wrong/overlay.png'
  }
]
const headers = ['Captured frame', 'Perspective-corrected page', 'Detected boxes and OCR crops']
const colW = 480, labelW = 260, headerH = 78, rowH = 610
const canvas = createCanvas(labelW + headers.length * colW, headerH + samples.length * rowH)
const ctx = canvas.getContext('2d')
ctx.fillStyle = '#f3f5f8'; ctx.fillRect(0, 0, canvas.width, canvas.height)
ctx.fillStyle = '#111827'; ctx.font = 'bold 25px sans-serif'; ctx.fillText('Perspective and downstream crop alignment', 18, 31)
ctx.fillStyle = '#4b5563'; ctx.font = '14px sans-serif'; ctx.fillText('Same worksheet layout; red rectangles are the actual OCR regions.', 18, 55)
ctx.fillStyle = '#1f2937'; ctx.font = 'bold 14px sans-serif'
for (let i = 0; i < headers.length; i += 1) ctx.fillText(headers[i], labelW + i * colW + 14, headerH - 8)

for (let row = 0; row < samples.length; row += 1) {
  const sample = samples[row], y = headerH + row * rowH
  ctx.fillStyle = row ? '#fff' : '#eaf0f7'; ctx.fillRect(0, y, canvas.width, rowH)
  ctx.fillStyle = '#111827'; ctx.font = 'bold 18px sans-serif'; ctx.fillText(sample.label, 16, y + 70)
  ctx.fillStyle = row ? '#b42318' : '#147d43'; ctx.font = '14px sans-serif'
  const words = sample.metrics.split(' · '); ctx.fillText(words[0], 16, y + 101); ctx.fillText(words[1], 16, y + 125)
  for (let col = 0; col < 3; col += 1) {
    const file = [sample.captured, sample.warped, sample.overlay][col]
    const image = await loadImage(file)
    const boxX = labelW + col * colW + 12, boxY = y + 18, boxW = colW - 24, boxH = rowH - 36
    ctx.fillStyle = '#d9dee7'; ctx.fillRect(boxX, boxY, boxW, boxH)
    const scale = Math.min(boxW / image.width, boxH / image.height)
    const w = image.width * scale, h = image.height * scale
    ctx.drawImage(image, boxX + (boxW - w) / 2, boxY + (boxH - h) / 2, w, h)
  }
}
await fs.writeFile(OUT, canvas.toBuffer('image/png'))
console.log(OUT)
