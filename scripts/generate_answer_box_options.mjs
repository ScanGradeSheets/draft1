import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import QRCode from 'qrcode'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const outDir = join(root, 'public', 'worksheets', 'answer-box-options')
const qrDir = join(outDir, 'qr')
const logoPath = join(root, 'public', 'scangrade-logo-transparent.png')
const fontPath = join(root, 'public', 'fonts', 'Lexend-wght.ttf')
const logoDataUrl = existsSync(logoPath)
  ? `data:image/png;base64,${readFileSync(logoPath).toString('base64')}`
  : ''
const fontDataUrl = existsSync(fontPath)
  ? `data:font/truetype;base64,${readFileSync(fontPath).toString('base64')}`
  : '../fonts/Lexend-wght.ttf'

const page = { width: 215.9, height: 279.4 }
const rankedPage = { width: 279.4, height: 215.9 }
const marker = { size: 11.4, margin: 12.2 }
marker.cxLeft = marker.margin + marker.size / 2
marker.cxRight = page.width - marker.cxLeft
marker.cyTop = marker.cxLeft
marker.cyBottom = page.height - marker.cyTop
const rankedMarker = {
  size: 9.8,
  margin: 11.8
}

const answer = {
  digitWidth: 17.2,
  gap: 1.35,
  height: 18.4,
  stroke: 0.58
}
answer.width = answer.digitWidth * 2 + answer.gap

const qrSize = 25.8
const qr = {
  x: (page.width - qrSize) / 2,
  y: marker.cyBottom - qrSize / 2 - 5.1,
  size: qrSize
}

const sampleQuestions = [
  ['23 + 14', 37],
  ['48 - 19', 29],
  ['16 + 27', 43],
  ['50 - 22', 28],
  ['34 + 8', 42],
  ['41 - 16', 25],
  ['19 + 18', 37],
  ['45 - 7', 38],
  ['26 + 15', 41],
  ['39 - 24', 15]
]

const options = [
  {
    id: 'option-d-twin-cells',
    label: 'Option D',
    title: 'Twin Cells',
    subtitle: 'Two clear digit cells with a real blank gutter between them.',
    filename: 'option-d-twin-cells.svg',
    code: 'SG-G2-C-OPT-D',
    recommendation: 'Strongest OCR geometry: no center line can be mistaken for a digit.'
  },
  {
    id: 'option-e-center-band',
    label: 'Option E',
    title: 'Center Band',
    subtitle: 'One answer box with a soft no-writing band between digits.',
    filename: 'option-e-center-band.svg',
    code: 'SG-G2-C-OPT-E',
    recommendation: 'Best A-like variant if we want one visual box but clearer digit lanes.'
  },
  {
    id: 'option-f-open-divider',
    label: 'Option F',
    title: 'Open Divider',
    subtitle: 'A joined box with only top and bottom split marks, leaving handwriting space open.',
    filename: 'option-f-open-divider.svg',
    code: 'SG-G2-C-OPT-F',
    recommendation: 'Most elegant compromise: visible structure with fewer OCR artifacts.'
  },
  {
    id: 'option-a-joined-cells',
    label: 'Option A',
    title: 'Joined Digit Cells',
    subtitle: 'Most OCR-first. Two obvious cells inside one answer.',
    filename: 'option-a-joined-cells.svg',
    code: 'SG-G2-C-OPT-A',
    recommendation: 'Best when reliability matters more than looking traditional.'
  },
  {
    id: 'option-b-side-notches',
    label: 'Option B',
    title: 'Side Notch Split',
    subtitle: 'Most traditional. One answer box with subtle midpoint notches.',
    filename: 'option-b-side-notches.svg',
    code: 'SG-G2-C-OPT-B',
    recommendation: 'Best when you want the sheet to feel like a familiar worksheet.'
  },
  {
    id: 'option-c-quiet-gutter',
    label: 'Option C',
    title: 'Quiet Center Gutter',
    subtitle: 'Balanced. Clear digit zones without a full OCR-confusing line.',
    filename: 'option-c-quiet-gutter.svg',
    code: 'SG-G2-C-OPT-C',
    recommendation: 'My pick: strongest balance of classroom feel and scan reliability.'
  }
]

const rankedBoxVariants = [
  {
    rank: 1,
    id: 'separate-cells',
    name: 'Separate cells',
    score: 'Highest',
    note: 'two independent crops, blank gutter'
  },
  {
    rank: 2,
    id: 'separate-cells-open-bridge',
    name: 'Separate cells, open bridge',
    score: 'Highest',
    note: 'reads as one answer, crops stay clean'
  },
  {
    rank: 3,
    id: 'joined-cells-light-divider',
    name: 'Joined cells, light divider',
    score: 'High',
    note: 'clear split, minimal extra ink'
  },
  {
    rank: 4,
    id: 'center-band',
    name: 'Quiet center band',
    score: 'High',
    note: 'no-write gutter guides placement'
  },
  {
    rank: 5,
    id: 'open-divider',
    name: 'Open divider',
    score: 'High',
    note: 'top/bottom marks avoid digit center'
  },
  {
    rank: 6,
    id: 'cell-tabs',
    name: 'Cell tabs',
    score: 'High',
    note: 'edge cues without center stroke'
  },
  {
    rank: 7,
    id: 'side-notch-plus-dots',
    name: 'Side notches + dots',
    score: 'Good',
    note: 'traditional feel, some ambiguity'
  },
  {
    rank: 8,
    id: 'corner-notch-cells',
    name: 'Corner-notch cells',
    score: 'Good',
    note: 'subtle cell boundary, low noise'
  },
  {
    rank: 9,
    id: 'split-corner-caps',
    name: 'Split corner caps',
    score: 'Good',
    note: 'visible lanes, no full divider'
  },
  {
    rank: 10,
    id: 'center-dots',
    name: 'Center dots',
    score: 'Good',
    note: 'low OCR noise, weaker student cue'
  },
  {
    rank: 11,
    id: 'full-divider',
    name: 'Full divider',
    score: 'Fair',
    note: 'good cue, line can look like a 1'
  },
  {
    rank: 12,
    id: 'dashed-divider',
    name: 'Dashed divider',
    score: 'Fair',
    note: 'familiar, but dot fragments enter crops'
  },
  {
    rank: 13,
    id: 'faint-half-fill',
    name: 'Faint half shading',
    score: 'Fair',
    note: 'clear lanes, risky under copier noise'
  },
  {
    rank: 14,
    id: 'bottom-tick-split',
    name: 'Bottom tick split',
    score: 'Fair',
    note: 'clean crops, weak placement cue'
  },
  {
    rank: 15,
    id: 'underline-slots',
    name: 'Underline slots',
    score: 'Low',
    note: 'too easy to write on printed line'
  },
  {
    rank: 16,
    id: 'single-box-side-notches',
    name: 'Single box, side notches',
    score: 'Low',
    note: 'traditional, but students may center'
  },
  {
    rank: 17,
    id: 'rounded-cells',
    name: 'Rounded cells',
    score: 'Low',
    note: 'friendly, weaker geometric corners'
  },
  {
    rank: 18,
    id: 'oval-slots',
    name: 'Oval slots',
    score: 'Low',
    note: 'invites bubble-sheet behavior'
  },
  {
    rank: 19,
    id: 'heavy-center-line',
    name: 'Heavy center line',
    score: 'Poor',
    note: 'divider dominates digit crops'
  },
  {
    rank: 20,
    id: 'plain-wide-box',
    name: 'Plain wide box',
    score: 'Poor',
    note: 'no dependable digit placement'
  }
]

function ensureDir(path) {
  if (!existsSync(path)) mkdirSync(path, { recursive: true })
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function questionLetter(index) {
  return String.fromCharCode(65 + index)
}

function needsCompactProblemText(problem) {
  return /^\d{2}\s*-\s*\d{2}$/.test(String(problem).trim())
}

function answerGeometry(questionIndex) {
  const col = questionIndex < 5 ? 0 : 1
  const row = questionIndex % 5
  const top = 68 + row * 31
  const answerX = col === 0 ? 64.5 : 160.5

  return {
    col,
    row,
    top,
    answerX,
    labelX: answerX - 39,
    labelCenterY: top + 9.95,
    problemX: answerX - 4.2,
    baseline: top + 12.15,
    splitX: answerX + answer.digitWidth + answer.gap / 2
  }
}

async function qrBase64ForOption(option) {
  const qrPayload = `https://scangradesheets.github.io/draft1/?sg=SG1:${option.code}:preview`
  const dataUrl = await QRCode.toDataURL(qrPayload, {
    errorCorrectionLevel: 'H',
    margin: 2,
    scale: 10,
    color: { dark: '#000000', light: '#ffffff' }
  })
  const base64 = dataUrl.split(',')[1]
  writeFileSync(join(qrDir, `${option.id}.png`), Buffer.from(base64, 'base64'))
  return base64
}

function optionStyles() {
  return `
      @font-face {
        font-family: "Lexend";
        src: url("${fontDataUrl}") format("truetype");
        font-style: normal;
        font-weight: 100 900;
      }
      .page { fill: #fff; }
      .corner-marker { fill: #111; }
      .sheet-title, .sheet-subtitle, .name-label, .problem-text, .scantron-letter,
      .qr-label, .qr-sheet-code {
        font-family: "Lexend", -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
        fill: #222;
      }
      .corner-marker, .answer-box, .cell-box, .hard-split { shape-rendering: crispEdges; }
      .header-logo-image { opacity: 0.96; }
      .sheet-title { font-size: 7.4px; font-weight: 650; }
      .sheet-subtitle { font-size: 4px; font-weight: 400; fill: #555; }
      .name-label { font-size: 4.1px; font-weight: 500; }
      .name-line { stroke: #444; stroke-width: 0.45; }
      .problem-text { font-size: 6.85px; font-weight: 440; }
      .problem-text-compact { font-size: 6.45px; }
      .scantron-bubble { fill: none; stroke: #b8bdc3; stroke-width: 0.42; }
      .scantron-letter { font-size: 4.55px; font-weight: 600; fill: #4f575f; }
      .answer-box { fill: none; stroke: #111; stroke-width: ${answer.stroke}; }
      .cell-box { fill: none; stroke: #111; stroke-width: ${answer.stroke}; }
      .hard-split { stroke: #8f969e; stroke-width: 0.42; }
      .soft-split { stroke: #cbd0d6; stroke-width: 0.32; stroke-linecap: round; stroke-dasharray: 1.05 1.25; }
      .micro-guide { fill: #cbd0d6; }
      .notch { stroke: #8e959d; stroke-width: 0.48; stroke-linecap: round; }
      .quiet-notch { stroke: #a8afb6; stroke-width: 0.42; stroke-linecap: round; }
      .gutter-band { fill: #f0f2f4; stroke: #cfd5db; stroke-width: 0.22; }
      .open-split { stroke: #8f969e; stroke-width: 0.42; stroke-linecap: round; }
      .center-tick { stroke: #9aa2aa; stroke-width: 0.4; stroke-linecap: round; }
      .qr-code { image-rendering: pixelated; }
      .qr-label { font-size: 3.2px; fill: #555; font-weight: 500; }
      .qr-sheet-code { font-size: 3.05px; fill: #555; font-weight: 400; }
    `
}

function logoMarkup() {
  const size = 9.8
  const x = page.width / 2 - size / 2
  const y = 15.2
  if (logoDataUrl) {
    return `<image class="header-logo-image" href="${logoDataUrl}" x="${x}" y="${y}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet" />`
  }

  return `<g transform="translate(${x} ${y})">
    <rect x="2.2" y="1.9" width="5.2" height="5.6" rx="0.7" fill="#111" />
    <path d="M3.05 4.65 L4.25 5.95 L6.55 3.1" fill="none" stroke="#fff" stroke-width="1.05" stroke-linecap="round" stroke-linejoin="round" />
  </g>`
}

function centeredLogoMarkup(centerX, y, size = 9.8) {
  const x = centerX - size / 2
  if (logoDataUrl) {
    return `<image class="header-logo-image" href="${logoDataUrl}" x="${x}" y="${y}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet" />`
  }

  return `<g transform="translate(${x} ${y})">
    <rect x="2.2" y="1.9" width="5.2" height="5.6" rx="0.7" fill="#111" />
    <path d="M3.05 4.65 L4.25 5.95 L6.55 3.1" fill="none" stroke="#fff" stroke-width="1.05" stroke-linecap="round" stroke-linejoin="round" />
  </g>`
}

function answerBoxMarkup(option, geometry) {
  const x = geometry.answerX
  const y = geometry.top
  const w = answer.width
  const h = answer.height
  const splitX = geometry.splitX
  const midY = y + h / 2

  if (option.id === 'option-a-joined-cells') {
    return `
      <rect class="answer-box" x="${x}" y="${y}" width="${w}" height="${h}" />
      <line class="hard-split" x1="${splitX}" y1="${y}" x2="${splitX}" y2="${y + h}" />`
  }

  if (option.id === 'option-d-twin-cells') {
    const gap = 2.25
    const digitWidth = (w - gap) / 2
    return `
      <rect class="cell-box" x="${x}" y="${y}" width="${digitWidth}" height="${h}" />
      <rect class="cell-box" x="${x + digitWidth + gap}" y="${y}" width="${digitWidth}" height="${h}" />
      <line class="quiet-notch" x1="${x + digitWidth + gap / 2}" y1="${y + 2.3}" x2="${x + digitWidth + gap / 2}" y2="${y + h - 2.3}" />`
  }

  if (option.id === 'option-e-center-band') {
    const bandWidth = 2.45
    return `
      <rect class="answer-box" x="${x}" y="${y}" width="${w}" height="${h}" />
      <rect class="gutter-band" x="${splitX - bandWidth / 2}" y="${y + 1.2}" width="${bandWidth}" height="${h - 2.4}" rx="0.55" />
      <line class="center-tick" x1="${splitX - 3.2}" y1="${midY}" x2="${splitX + 3.2}" y2="${midY}" />`
  }

  if (option.id === 'option-f-open-divider') {
    return `
      <rect class="answer-box" x="${x}" y="${y}" width="${w}" height="${h}" />
      <line class="open-split" x1="${splitX}" y1="${y}" x2="${splitX}" y2="${y + 4.35}" />
      <line class="open-split" x1="${splitX}" y1="${y + h - 4.35}" x2="${splitX}" y2="${y + h}" />
      <line class="center-tick" x1="${splitX - 2.7}" y1="${midY}" x2="${splitX + 2.7}" y2="${midY}" />`
  }

  if (option.id === 'option-b-side-notches') {
    return `
      <rect class="answer-box" x="${x}" y="${y}" width="${w}" height="${h}" />
      <line class="notch" x1="${x}" y1="${midY}" x2="${x + 5.2}" y2="${midY}" />
      <line class="notch" x1="${x + w - 5.2}" y1="${midY}" x2="${x + w}" y2="${midY}" />
      <circle class="micro-guide" cx="${splitX}" cy="${y + 4.25}" r="0.38" />
      <circle class="micro-guide" cx="${splitX}" cy="${y + h - 4.25}" r="0.38" />`
  }

  if (option.id === 'option-c-quiet-gutter') {
    return `
      <rect class="answer-box" x="${x}" y="${y}" width="${w}" height="${h}" />
      <line class="soft-split" x1="${splitX}" y1="${y + 2.1}" x2="${splitX}" y2="${y + 6.2}" />
      <line class="soft-split" x1="${splitX}" y1="${y + h - 6.2}" x2="${splitX}" y2="${y + h - 2.1}" />
      <line class="quiet-notch" x1="${splitX - 2.2}" y1="${midY}" x2="${splitX + 2.2}" y2="${midY}" />`
  }

  return `
      <rect class="answer-box" x="${x}" y="${y}" width="${w}" height="${h}" />`
}

function variantBoxMarkup(variant, x, y, w = 34, h = 13.4) {
  const gap = 2.2
  const digitW = (w - gap) / 2
  const splitX = x + w / 2
  const midY = y + h / 2
  const leftX = x
  const rightX = x + digitW + gap
  const outer = `<rect class="answer-box mini-answer-box" x="${x}" y="${y}" width="${w}" height="${h}" />`
  const separate = `<rect class="cell-box mini-answer-box" x="${leftX}" y="${y}" width="${digitW}" height="${h}" />
        <rect class="cell-box mini-answer-box" x="${rightX}" y="${y}" width="${digitW}" height="${h}" />`

  switch (variant.id) {
    case 'separate-cells':
      return separate
    case 'separate-cells-open-bridge':
      return `${separate}
        <line class="bridge-mark" x1="${leftX + digitW}" y1="${y}" x2="${rightX}" y2="${y}" />
        <line class="bridge-mark" x1="${leftX + digitW}" y1="${y + h}" x2="${rightX}" y2="${y + h}" />`
    case 'joined-cells-light-divider':
      return `${outer}<line class="hard-split" x1="${splitX}" y1="${y}" x2="${splitX}" y2="${y + h}" />`
    case 'center-band':
      return `${outer}<rect class="gutter-band" x="${splitX - 1.25}" y="${y + 0.9}" width="2.5" height="${h - 1.8}" rx="0.5" />`
    case 'open-divider':
      return `${outer}
        <line class="open-split" x1="${splitX}" y1="${y}" x2="${splitX}" y2="${y + 3.4}" />
        <line class="open-split" x1="${splitX}" y1="${y + h - 3.4}" x2="${splitX}" y2="${y + h}" />`
    case 'cell-tabs':
      return `${outer}
        <line class="center-tick" x1="${splitX - 3.1}" y1="${y}" x2="${splitX + 3.1}" y2="${y}" />
        <line class="center-tick" x1="${splitX - 3.1}" y1="${y + h}" x2="${splitX + 3.1}" y2="${y + h}" />`
    case 'side-notch-plus-dots':
      return `${outer}
        <line class="notch" x1="${x}" y1="${midY}" x2="${x + 4.6}" y2="${midY}" />
        <line class="notch" x1="${x + w - 4.6}" y1="${midY}" x2="${x + w}" y2="${midY}" />
        <circle class="micro-guide" cx="${splitX}" cy="${y + 3.2}" r="0.32" />
        <circle class="micro-guide" cx="${splitX}" cy="${y + h - 3.2}" r="0.32" />`
    case 'corner-notch-cells':
      return `${outer}
        <line class="center-tick" x1="${splitX - 2.6}" y1="${y + 1.2}" x2="${splitX}" y2="${y + 1.2}" />
        <line class="center-tick" x1="${splitX}" y1="${y + h - 1.2}" x2="${splitX + 2.6}" y2="${y + h - 1.2}" />`
    case 'split-corner-caps':
      return `${outer}
        <line class="center-tick" x1="${splitX}" y1="${y}" x2="${splitX}" y2="${y + 2.3}" />
        <line class="center-tick" x1="${splitX}" y1="${y + h - 2.3}" x2="${splitX}" y2="${y + h}" />
        <line class="quiet-notch" x1="${splitX - 2.5}" y1="${midY}" x2="${splitX + 2.5}" y2="${midY}" />`
    case 'center-dots':
      return `${outer}
        <circle class="micro-guide" cx="${splitX}" cy="${y + 3.1}" r="0.35" />
        <circle class="micro-guide" cx="${splitX}" cy="${midY}" r="0.35" />
        <circle class="micro-guide" cx="${splitX}" cy="${y + h - 3.1}" r="0.35" />`
    case 'full-divider':
      return `${outer}<line class="hard-split" x1="${splitX}" y1="${y}" x2="${splitX}" y2="${y + h}" />`
    case 'dashed-divider':
      return `${outer}<line class="soft-split full-dash" x1="${splitX}" y1="${y + 1.2}" x2="${splitX}" y2="${y + h - 1.2}" />`
    case 'faint-half-fill':
      return `<rect class="half-fill" x="${x}" y="${y}" width="${w / 2}" height="${h}" />
        ${outer}<line class="quiet-notch" x1="${splitX}" y1="${y + 1.4}" x2="${splitX}" y2="${y + h - 1.4}" />`
    case 'bottom-tick-split':
      return `${outer}<line class="center-tick" x1="${splitX}" y1="${y + h - 4.2}" x2="${splitX}" y2="${y + h}" />`
    case 'underline-slots':
      return `<line class="slot-line" x1="${x}" y1="${y + h}" x2="${x + digitW}" y2="${y + h}" />
        <line class="slot-line" x1="${rightX}" y1="${y + h}" x2="${x + w}" y2="${y + h}" />
        <line class="quiet-notch" x1="${splitX}" y1="${y + h - 3.5}" x2="${splitX}" y2="${y + h}" />`
    case 'single-box-side-notches':
      return `${outer}
        <line class="notch" x1="${x}" y1="${midY}" x2="${x + 5}" y2="${midY}" />
        <line class="notch" x1="${x + w - 5}" y1="${midY}" x2="${x + w}" y2="${midY}" />`
    case 'rounded-cells':
      return `<rect class="cell-box rounded-cell" x="${leftX}" y="${y}" width="${digitW}" height="${h}" rx="2.1" />
        <rect class="cell-box rounded-cell" x="${rightX}" y="${y}" width="${digitW}" height="${h}" rx="2.1" />`
    case 'oval-slots':
      return `<ellipse class="cell-box oval-cell" cx="${x + digitW / 2}" cy="${midY}" rx="${digitW / 2}" ry="${h / 2}" />
        <ellipse class="cell-box oval-cell" cx="${rightX + digitW / 2}" cy="${midY}" rx="${digitW / 2}" ry="${h / 2}" />`
    case 'heavy-center-line':
      return `${outer}<line class="heavy-split" x1="${splitX}" y1="${y}" x2="${splitX}" y2="${y + h}" />`
    case 'plain-wide-box':
      return outer
    default:
      return outer
  }
}

function buildRankedVariantRows() {
  const leftX = 16.4
  const rightX = 148.3
  const startY = 39.8
  const rowH = 15.3

  return rankedBoxVariants.map((variant, index) => {
    const col = index < 10 ? 0 : 1
    const row = index % 10
    const x = col === 0 ? leftX : rightX
    const y = startY + row * rowH
    const boxX = x + 76.5
    const boxY = y + 2.05
    const scoreClass = variant.rank <= 6 ? 'rank-high' : variant.rank <= 14 ? 'rank-fair' : 'rank-low'

    return `
    <g class="rank-row" data-rank="${variant.rank}" transform="translate(${x} ${y})">
      <text class="rank-number" x="5.2" y="7.25">${variant.rank}</text>
      <text class="rank-name" x="11.6" y="4.8">${escapeXml(variant.name)}</text>
      <text class="rank-note" x="11.6" y="9.2">${escapeXml(variant.note)}</text>
      <text class="rank-score ${scoreClass}" x="11.6" y="13.1">${escapeXml(variant.score)}</text>
      <g transform="translate(${boxX - x} ${boxY - y})">${variantBoxMarkup(variant, 0, 0, 31, 9.8)}</g>
    </g>`
  }).join('\n')
}

function buildRankedVariantSheet() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="0 0 ${rankedPage.width} ${rankedPage.height}"
     width="11in" height="8.5in"
     preserveAspectRatio="xMidYMid meet">
  <defs>
    <style>${optionStyles()}
      .rank-title { font-family: "Lexend", -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; font-size: 6.8px; font-weight: 680; fill: #202124; }
      .rank-subtitle { font-family: "Lexend", -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; font-size: 3.25px; font-weight: 430; fill: #5f6368; }
      .rank-number { font-family: "Lexend", -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; font-size: 5.35px; font-weight: 760; fill: #262a2f; text-anchor: end; }
      .rank-name { font-family: "Lexend", -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; font-size: 3.45px; font-weight: 650; fill: #202124; }
      .rank-note { font-family: "Lexend", -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; font-size: 2.55px; font-weight: 400; fill: #666c73; }
      .rank-score { font-family: "Lexend", -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; font-size: 2.55px; font-weight: 700; }
      .rank-high { fill: #1e7b52; }
      .rank-fair { fill: #8a681e; }
      .rank-low { fill: #9b3d35; }
      .mini-answer-box { stroke-width: 0.5; }
      .bridge-mark { stroke: #111; stroke-width: 0.5; }
      .full-dash { stroke-width: 0.34; }
      .half-fill { fill: #f4f5f7; }
      .slot-line { stroke: #111; stroke-width: 0.58; stroke-linecap: round; }
      .rounded-cell { shape-rendering: auto; }
      .oval-cell { shape-rendering: auto; }
      .heavy-split { stroke: #111; stroke-width: 1.15; }
      .legend-text { font-family: "Lexend", -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; font-size: 3.05px; fill: #626970; }
      .rank-divider { stroke: #edf0f3; stroke-width: 0.35; }
    </style>
  </defs>

  <rect class="page" width="${rankedPage.width}" height="${rankedPage.height}" />
  <rect class="corner-marker" x="${rankedMarker.margin}" y="${rankedMarker.margin}" width="${rankedMarker.size}" height="${rankedMarker.size}" />
  <rect class="corner-marker" x="${rankedPage.width - rankedMarker.margin - rankedMarker.size}" y="${rankedMarker.margin}" width="${rankedMarker.size}" height="${rankedMarker.size}" />
  <rect class="corner-marker" x="${rankedPage.width - rankedMarker.margin - rankedMarker.size}" y="${rankedPage.height - rankedMarker.margin - rankedMarker.size}" width="${rankedMarker.size}" height="${rankedMarker.size}" />
  <rect class="corner-marker" x="${rankedMarker.margin}" y="${rankedPage.height - rankedMarker.margin - rankedMarker.size}" width="${rankedMarker.size}" height="${rankedMarker.size}" />

  ${centeredLogoMarkup(rankedPage.width / 2, 10.8, 8.6)}
  <text class="rank-title" x="${rankedPage.width / 2}" y="25.8" text-anchor="middle">Two-Digit Answer Box Ranking</text>
  <text class="rank-subtitle" x="${rankedPage.width / 2}" y="31.5" text-anchor="middle">Best to worst for OCR: crop separation, student guidance, and printed-noise risk.</text>
  <line class="rank-divider" x1="15.5" y1="35.3" x2="${rankedPage.width - 15.5}" y2="35.3" />

  <g id="ranked-variants">
${buildRankedVariantRows()}
  </g>

  <line class="rank-divider" x1="15.5" y1="${rankedPage.height - 22.7}" x2="${rankedPage.width - 15.5}" y2="${rankedPage.height - 22.7}" />
  <text class="legend-text" x="${rankedPage.width / 2}" y="${rankedPage.height - 15.1}" text-anchor="middle">Design ranking only. Top candidates still need a handwriting/camera bake-off before becoming the template standard.</text>
  <text class="qr-label" x="${rankedPage.width / 2}" y="${rankedPage.height - 8.6}" text-anchor="middle">ScanGrade.io</text>
  <text class="qr-sheet-code" x="${rankedPage.width / 2}" y="${rankedPage.height - 4.6}" text-anchor="middle">SG-DESIGN-20</text>
</svg>
`
}

function buildRows(option) {
  return sampleQuestions.map(([problem], index) => {
    const g = answerGeometry(index)
    const problemClass = needsCompactProblemText(problem) ? 'problem-text problem-text-compact' : 'problem-text'
    return `
    <g class="question" data-question="${index + 1}">
      <g class="scantron-question-label" transform="translate(${g.labelX} ${g.labelCenterY})">
        <ellipse class="scantron-bubble" cx="0" cy="0" rx="4.05" ry="3.15" />
        <text class="scantron-letter" x="0" y="1.55" text-anchor="middle">${questionLetter(index)}</text>
      </g>
      <text class="${problemClass}" x="${g.problemX}" y="${g.baseline}" text-anchor="end">${escapeXml(problem)} =</text>
      ${answerBoxMarkup(option, g)}
    </g>`
  }).join('\n')
}

function buildSvg(option, qrBase64) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="0 0 ${page.width} ${page.height}"
     width="8.5in" height="11in"
     preserveAspectRatio="xMidYMid meet">
  <defs>
    <style>${optionStyles()}</style>
  </defs>

  <rect class="page" width="${page.width}" height="${page.height}" />

  <rect class="corner-marker" x="${marker.margin}" y="${marker.margin}" width="${marker.size}" height="${marker.size}" />
  <rect class="corner-marker" x="${page.width - marker.margin - marker.size}" y="${marker.margin}" width="${marker.size}" height="${marker.size}" />
  <rect class="corner-marker" x="${page.width - marker.margin - marker.size}" y="${page.height - marker.margin - marker.size}" width="${marker.size}" height="${marker.size}" />
  <rect class="corner-marker" x="${marker.margin}" y="${page.height - marker.margin - marker.size}" width="${marker.size}" height="${marker.size}" />

  ${logoMarkup()}
  <text class="sheet-title" x="${page.width / 2}" y="34.7" text-anchor="middle">Mixed Within 50</text>
  <text class="sheet-subtitle" x="${page.width / 2}" y="40.4" text-anchor="middle">Grade 2 Math</text>
  <text class="name-label" x="${page.width / 2 - 36}" y="53.7">Name</text>
  <line class="name-line" x1="${page.width / 2 - 22.5}" y1="54.5" x2="${page.width / 2 + 36}" y2="54.5" />

  <g id="questions">
${buildRows(option)}
  </g>

  <image class="qr-code" href="data:image/png;base64,${qrBase64}" x="${qr.x}" y="${qr.y}" width="${qr.size}" height="${qr.size}" />
  <text class="qr-label" x="${page.width / 2}" y="${qr.y - 3.2}" text-anchor="middle">ScanGrade.io</text>
  <text class="qr-sheet-code" x="${page.width / 2}" y="${qr.y + qr.size + 3.35}" text-anchor="middle">${escapeXml(option.code)}</text>
</svg>
`
}

function buildIndex() {
  const rankedCard = `
      <article class="card ranked-card">
        <a class="preview-link" href="./ranked-20-answer-box-variants.svg" target="_blank" rel="noreferrer">
          <img alt="Ranked 20 answer box variants" src="./ranked-20-answer-box-variants.svg">
        </a>
        <div class="copy">
          <h2>Ranked 20 Answer Box Variants</h2>
          <p>A single comparison sheet ordered by expected OCR reliability, from best to worst.</p>
          <p class="recommendation">Top recommendation to test first: #1 Separate cells or #2 Separate cells with open bridge.</p>
          <a href="./ranked-20-answer-box-variants.svg" target="_blank" rel="noreferrer">Open ranked SVG</a>
        </div>
      </article>`

  const cards = options.map((option) => `
      <article class="card">
        <a class="preview-link" href="./${escapeXml(option.filename)}" target="_blank" rel="noreferrer">
          <img alt="${escapeXml(option.label)} preview" src="./${escapeXml(option.filename)}">
        </a>
        <div class="copy">
          <h2>${escapeXml(option.label)}: ${escapeXml(option.title)}</h2>
          <p>${escapeXml(option.subtitle)}</p>
          <p class="recommendation">${escapeXml(option.recommendation)}</p>
          <a href="./${escapeXml(option.filename)}" target="_blank" rel="noreferrer">Open printable SVG</a>
        </div>
      </article>`).join('\n')

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>ScanGrade Answer Box Options</title>
    <style>
      @font-face {
        font-family: "Lexend";
        src: url("../../fonts/Lexend-wght.ttf") format("truetype");
        font-weight: 100 900;
      }
      body {
        font-family: "Lexend", -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
        margin: 0;
        background: #f4f5f7;
        color: #202124;
      }
      main {
        max-width: 1220px;
        margin: 0 auto;
        padding: 32px 20px 44px;
      }
      h1 {
        margin: 0 0 8px;
        font-size: clamp(28px, 4vw, 44px);
        letter-spacing: 0;
      }
      .intro {
        max-width: 760px;
        color: #666c73;
        font-size: 17px;
        line-height: 1.45;
        margin: 0 0 24px;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 18px;
      }
      .ranked-grid {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        margin-bottom: 20px;
      }
      .ranked-card img {
        height: 780px;
      }
      .card {
        background: #fff;
        border: 1px solid #dde1e6;
        border-radius: 10px;
        overflow: hidden;
        box-shadow: 0 16px 34px rgba(15, 23, 42, 0.08);
      }
      .preview-link {
        display: block;
        background: #f9fafb;
        border-bottom: 1px solid #eceff2;
      }
      img {
        display: block;
        width: 100%;
        height: 620px;
        object-fit: contain;
        background: #fff;
      }
      .copy {
        padding: 18px 18px 20px;
      }
      h2 {
        margin: 0 0 7px;
        font-size: 20px;
      }
      p {
        margin: 0 0 10px;
        color: #626970;
        line-height: 1.45;
      }
      .recommendation {
        color: #2f5e47;
        font-weight: 650;
      }
      a {
        color: #0066d9;
        font-weight: 750;
      }
      @media (max-width: 980px) {
        .grid {
          grid-template-columns: 1fr;
        }
        img {
          height: 720px;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Answer Box Design Options</h1>
      <p class="intro">D-F are three new worksheet-safe variants for two-digit answers, shown first. A-C remain below for comparison. These are comparison mockups only; the production worksheets and OCR layout files are untouched.</p>
      <section class="ranked-grid">
${rankedCard}
      </section>
      <section class="grid">
${cards}
      </section>
    </main>
  </body>
</html>
`
}

ensureDir(outDir)
ensureDir(qrDir)

for (const option of options) {
  const qrBase64 = await qrBase64ForOption(option)
  writeFileSync(join(outDir, option.filename), buildSvg(option, qrBase64))
}

writeFileSync(join(outDir, 'ranked-20-answer-box-variants.svg'), buildRankedVariantSheet())
writeFileSync(join(outDir, 'index.html'), buildIndex())

console.log(`Generated ${options.length} answer box option previews in ${outDir}`)
