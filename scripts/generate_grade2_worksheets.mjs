import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import QRCode from 'qrcode'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const logoAssetPath = join(root, 'public', 'scangrade-logo.png')
const logoDataUrl = existsSync(logoAssetPath)
  ? `data:image/png;base64,${readFileSync(logoAssetPath).toString('base64')}`
  : ''

const page = { width: 215.9, height: 279.4 }
const worksheetFonts = [
  {
    family: 'Lexend',
    file: 'Lexend-wght.ttf',
    weight: '100 900',
    label: 'Lexend Variable'
  }
]
const worksheetFontStack = '"Lexend", -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif'
const qrAppBaseUrl = process.env.SG_QR_APP_URL || 'https://scangradesheets.github.io/draft1/'
const marker = {
  size: 11.4,
  margin: 12.2
}
marker.cxLeft = marker.margin + marker.size / 2
marker.cxRight = page.width - marker.cxLeft
marker.cyTop = marker.cxLeft
marker.cyBottom = page.height - marker.cyTop

const box = {
  width: 15.8,
  height: 17.2,
  gap: 1.15,
  stroke: 0.58
}
const answerFrame = {
  width: box.width * 2 + box.gap,
  height: box.height
}
const digitGuide = {
  insetY: 2.6,
  stroke: 0.34,
  dash: '1.05 1.25'
}
const qrSize = 25.8
const qr = {
  x: (page.width - qrSize) / 2,
  y: marker.cyBottom - qrSize / 2 - 5.1,
  size: qrSize
}
const headerLogo = {
  size: 11.1,
  cropViewBox: '205 180 640 665'
}
headerLogo.x = page.width / 2 - headerLogo.size / 2
headerLogo.y = marker.cyTop - headerLogo.size / 2
const nameField = {
  labelX: page.width / 2 - 36,
  labelY: 53.7,
  lineX1: page.width / 2 - 22.5,
  lineX2: page.width / 2 + 36,
  lineY: 54.5
}

const sheets = [
  {
    id: 'g2-add-within-20-v1',
    code: 'A',
    humanCode: 'SG-G2-A-001',
    title: 'Addition Within 20',
    filename: 'grade2-addition-within-20-v1.svg',
    questions: [
      ['8 + 7', 15],
      ['9 + 6', 15],
      ['12 + 5', 17],
      ['4 + 9', 13],
      ['11 + 8', 19],
      ['7 + 4', 11],
      ['6 + 6', 12],
      ['13 + 4', 17],
      ['5 + 8', 13],
      ['10 + 9', 19]
    ]
  },
  {
    id: 'g2-sub-within-20-v1',
    code: 'B',
    humanCode: 'SG-G2-B-001',
    title: 'Subtraction Within 20',
    filename: 'grade2-subtraction-within-20-v1.svg',
    questions: [
      ['20 - 3', 17],
      ['19 - 4', 15],
      ['18 - 6', 12],
      ['17 - 5', 12],
      ['16 - 4', 12],
      ['15 - 3', 12],
      ['20 - 8', 12],
      ['19 - 7', 12],
      ['18 - 4', 14],
      ['17 - 6', 11]
    ]
  },
  {
    id: 'g2-mixed-within-50-v1',
    code: 'C',
    humanCode: 'SG-G2-C-001',
    title: 'Mixed Within 50',
    filename: 'grade2-mixed-within-50-v1.svg',
    questions: [
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
  }
]

function round(value, places = 4) {
  return Number(value.toFixed(places))
}

function normalizeX(value) {
  return round(value / page.width)
}

function normalizeY(value) {
  return round(value / page.height)
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function digitArray(answer) {
  return String(answer).split('').map((digit) => Number(digit))
}

function answerKeyChecksum(answerKey) {
  return createHash('sha256')
    .update(answerKey.map((digit) => digit == null ? '_' : String(digit)).join(','))
    .digest('hex')
    .slice(0, 12)
}

function qrUrlForPayload(scanGradePayload) {
  const url = new URL(qrAppBaseUrl)
  url.searchParams.set('sg', scanGradePayload)
  return url.toString()
}

function questionLetter(index) {
  return String.fromCharCode(65 + index)
}

function ensureDir(path) {
  if (!existsSync(path)) mkdirSync(path, { recursive: true })
}

function canonicalDigitCells(answer) {
  const digits = digitArray(answer)
  if (digits.length > 2) {
    throw new Error(`Grade 2 worksheet answers must fit two digit boxes. Got "${answer}".`)
  }
  return digits.length === 1 ? [null, digits[0]] : digits
}

function acceptedDigitResponses(answer) {
  const digits = digitArray(answer)
  if (digits.length === 1) {
    const digit = digits[0]
    return [
      {
        label: `_${digit}`,
        digits: [null, digit],
        meaning: 'blank tens box, digit in ones box'
      },
      {
        label: `${digit}_`,
        digits: [digit, null],
        meaning: 'digit in tens-side box, blank ones-side box'
      },
      {
        label: `0${digit}`,
        digits: [0, digit],
        meaning: 'leading zero, digit in ones box'
      }
    ]
  }
  return [
    {
      label: String(answer),
      digits,
      meaning: 'exact two-digit answer'
    }
  ]
}

function worksheetFontStatus() {
  return worksheetFonts.map((font) => ({
    ...font,
    path: join(root, 'public', 'fonts', font.file),
    present: existsSync(join(root, 'public', 'fonts', font.file))
  }))
}

function worksheetFontCss() {
  return worksheetFonts.map((font) => {
    const fontPath = join(root, 'public', 'fonts', font.file)
    const format = font.file.endsWith('.ttf') ? 'truetype' : 'woff2'
    const source = existsSync(fontPath)
      ? `data:font/${format};base64,${readFileSync(fontPath).toString('base64')}`
      : `../fonts/${font.file}`

    return `
      @font-face {
        font-family: "${font.family}";
        src: url("${source}") format("${format}");
        font-style: normal;
        font-weight: ${font.weight};
      }`
  }).join('\n')
}

function reportMissingWorksheetFonts() {
  const missing = worksheetFontStatus().filter((font) => !font.present)
  if (!missing.length) return

  const message = [
    'Missing printed worksheet font files:',
    ...missing.map((font) => `  - public/fonts/${font.file} (${font.label})`),
    'The generated SVGs explicitly request Lexend, but browsers will fall back until the font files are added.'
  ].join('\n')

  if (process.env.SG_REQUIRE_LEXEND_FONT === '1') {
    throw new Error(message)
  }

  console.warn(message)
}

async function qrPngForPayload(sheetId, payloadString) {
  const outDir = join(root, 'public', 'worksheets', 'qr')
  ensureDir(outDir)
  const outPath = join(outDir, `${sheetId}.png`)
  const dataUrl = await QRCode.toDataURL(payloadString, {
    errorCorrectionLevel: 'H',
    margin: 2,
    scale: 10,
    color: {
      dark: '#000000',
      light: '#ffffff'
    }
  })
  const base64 = dataUrl.split(',')[1]
  writeFileSync(outPath, Buffer.from(base64, 'base64'))
  return {
    path: outPath,
    base64: readFileSync(outPath).toString('base64')
  }
}

function needsCompactProblemText(problem) {
  return /^\d{2}\s*-\s*\d{2}$/.test(String(problem).trim())
}

function answerGeometry(questionIndex) {
  const col = questionIndex < 5 ? 0 : 1
  const row = questionIndex % 5
  const top = 68 + row * 31
  const answerX = col === 0 ? 64 : 160
  const onesX = answerX + box.width + box.gap
  const tensX = answerX
  return {
    col,
    row,
    top,
    xs: [tensX, onesX],
    answerX,
    labelX: answerX - 38,
    labelCenterY: top + 9.35,
    problemX: answerX - 3.8,
    baseline: top + 11.7,
    seamX: tensX + box.width + box.gap / 2
  }
}

function buildLayout(sheet) {
  const boxes = []
  const answerKey = []
  const questionGroups = []

  sheet.questions.forEach(([problem, answer], qIndex) => {
    const digits = canonicalDigitCells(answer)
    const acceptedResponses = acceptedDigitResponses(answer)
    const geometry = answerGeometry(qIndex)
    const digitBoxIds = []

    digits.forEach((digit, digitIndex) => {
      const id = boxes.length
      const left = geometry.xs[digitIndex]
      const top = geometry.top
      boxes.push({
        id,
        question_num: qIndex + 1,
        digit_index: digitIndex,
        digit_place: digitIndex === 0 ? 'tens' : 'ones',
        x: normalizeX(left + box.width),
        y: normalizeY(top + box.height),
        width: normalizeX(box.width),
        height: normalizeY(box.height),
        expected_type: digit == null ? 'optional_blank_or_digit' : 'digit',
        expected_digit: digit
      })
      answerKey.push(digit)
      digitBoxIds.push(id)
    })

    questionGroups.push({
      question_num: qIndex + 1,
      problem,
      answer,
      digit_box_ids: digitBoxIds,
      canonical_digits: digits,
      guide_line: {
        type: 'vertical_digit_split',
        x: normalizeX(geometry.seamX),
        y1: normalizeY(geometry.top + digitGuide.insetY),
        y2: normalizeY(geometry.top + box.height - digitGuide.insetY),
        printed: true
      },
      accepted_digit_responses: acceptedResponses
    })
  })

  return {
    layout_id: sheet.id,
    version: 1,
    answer_key: answerKey,
    page: {
      aspect_ratio: round(page.width / page.height),
      units: 'normalized'
    },
    boxes,
    question_groups: questionGroups,
    homography: {
      anchors: [
        { id: 'tl', x: normalizeX(marker.cxLeft), y: normalizeY(marker.cyTop) },
        { id: 'tr', x: normalizeX(marker.cxRight), y: normalizeY(marker.cyTop) },
        { id: 'br', x: normalizeX(marker.cxRight), y: normalizeY(marker.cyBottom) },
        { id: 'bl', x: normalizeX(marker.cxLeft), y: normalizeY(marker.cyBottom) }
      ],
      marker_size: normalizeX(marker.size)
    },
    metadata: {
      title: sheet.title,
      human_code: sheet.humanCode,
      grade_level: 2,
      total_questions: 10,
      answer_box_count: boxes.length,
      printed_text_font_family: 'Lexend',
      required_font_files: worksheetFonts.map((font) => `public/fonts/${font.file}`),
      digit_box_width_mm: box.width,
      digit_box_height_mm: box.height,
      marker_size_mm: marker.size,
      grading_policy: {
        answer_slots_per_question: 2,
        printed_digit_split_guide: 'vertical dashed center line',
        blank_digit_value: null,
        single_digit_two_slot_accepts: ['_d', 'd_', '0d'],
        single_digit_two_slot_rejects: ['d0']
      },
      qr_position: {
        x: normalizeX(qr.x),
        y: normalizeY(qr.y),
        width: normalizeX(qr.size),
        height: normalizeY(qr.size)
      }
    }
  }
}

function buildSvg(sheet, layout, qrBase64, payloadString) {
  const rows = []
  for (let i = 0; i < sheet.questions.length; i++) {
    const [problem] = sheet.questions[i]
    const geometry = answerGeometry(i)
    const questionLabel = questionLetter(i)
    const problemText = `${problem} =`
    const problemClass = needsCompactProblemText(problem) ? 'problem-text problem-text-compact' : 'problem-text'
    const rects = `<rect class="answer-box answer-box-wide" data-question-boxes="${layout.question_groups[i].digit_box_ids.join(',')}" x="${geometry.answerX}" y="${geometry.top}" width="${answerFrame.width}" height="${answerFrame.height}" />
      <line class="digit-guide" x1="${geometry.seamX}" y1="${geometry.top + digitGuide.insetY}" x2="${geometry.seamX}" y2="${geometry.top + box.height - digitGuide.insetY}" />`
    rows.push(`
    <g class="question" data-question="${i + 1}">
      <g class="scantron-question-label" transform="translate(${geometry.labelX} ${geometry.labelCenterY})">
        <ellipse class="scantron-bubble" cx="0" cy="0" rx="4.05" ry="3.15" />
        <text class="scantron-letter" x="0" y="1.55" text-anchor="middle">${escapeXml(questionLabel)}</text>
      </g>
      <text class="${problemClass}" x="${geometry.problemX}" y="${geometry.baseline}" text-anchor="end">${escapeXml(problemText)}</text>
      ${rects}
    </g>`)
  }

  const logoMarkup = logoDataUrl
    ? `<svg class="header-logo" x="${headerLogo.x}" y="${headerLogo.y}" width="${headerLogo.size}" height="${headerLogo.size}" viewBox="${headerLogo.cropViewBox}" preserveAspectRatio="xMidYMid meet">
    <image href="${logoDataUrl}" x="0" y="0" width="1024" height="1024" />
  </svg>`
    : `<g class="header-logo-fallback" transform="translate(${page.width / 2 - 4.1} ${headerLogo.y + 2.1})">
    <rect class="brand-logo-page" x="1.9" y="1.5" width="4.9" height="5.4" rx="0.7" />
    <path class="brand-logo-check" d="M2.9 4.45 L4.1 5.75 L6.25 3.1" />
    <path class="brand-logo-corner" d="M0.75 2.05 V0.95 H1.85" />
    <path class="brand-logo-corner" d="M0.75 6.1 V7.2 H1.85" />
    <path class="brand-logo-corner" d="M7.35 6.1 V7.2 H6.25" />
  </g>`

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="0 0 ${page.width} ${page.height}"
     width="8.5in" height="11in"
     preserveAspectRatio="xMidYMid meet">
  <defs>
    <style>
${worksheetFontCss()}
      .page { fill: #fff; }
      .corner-marker { fill: #111; }
      .name-label, .sheet-title, .sheet-subtitle, .problem-text, .scantron-letter, .footer, .qr-label {
        font-family: ${worksheetFontStack};
        fill: #222;
      }
      .name-label { font-size: 4.1px; font-weight: 500; }
      .name-line { stroke: #444; stroke-width: 0.45; }
      .brand-logo-page { fill: #111; }
      .brand-logo-check, .brand-logo-corner { fill: none; stroke-linecap: round; stroke-linejoin: round; }
      .brand-logo-check { stroke: #fff; stroke-width: 1.05; }
      .brand-logo-corner { stroke: #111; stroke-width: 0.85; }
      .sheet-title { font-size: 7px; font-weight: 600; fill: #222; }
      .sheet-subtitle { font-size: 4px; font-weight: 400; fill: #555; }
      .problem-text { font-size: 6.75px; font-weight: 430; }
      .problem-text-compact { font-size: 6.35px; }
      .scantron-bubble { fill: none; stroke: #b8bdc3; stroke-width: 0.42; }
      .scantron-letter { font-size: 4.55px; font-weight: 600; fill: #4f575f; }
      .answer-box { fill: none; stroke: #111; stroke-width: ${box.stroke}; shape-rendering: crispEdges; }
      .digit-guide { fill: none; stroke: #c7ccd2; stroke-width: ${digitGuide.stroke}; stroke-linecap: round; stroke-dasharray: ${digitGuide.dash}; }
      .footer { font-size: 3.4px; fill: #555; }
      .qr-label { font-size: 3.2px; }
      .qr-label-name { fill: #202124; font-weight: 650; }
      .qr-label-domain { fill: #6e6e73; font-weight: 420; }
      .qr-sheet-code { font-family: ${worksheetFontStack}; font-size: 3.05px; fill: #555; font-weight: 400; }
      .qr-code { image-rendering: pixelated; }
    </style>
  </defs>

  <rect class="page" width="${page.width}" height="${page.height}" />

  <rect class="corner-marker" x="${marker.margin}" y="${marker.margin}" width="${marker.size}" height="${marker.size}" />
  <rect class="corner-marker" x="${page.width - marker.margin - marker.size}" y="${marker.margin}" width="${marker.size}" height="${marker.size}" />
  <rect class="corner-marker" x="${page.width - marker.margin - marker.size}" y="${page.height - marker.margin - marker.size}" width="${marker.size}" height="${marker.size}" />
  <rect class="corner-marker" x="${marker.margin}" y="${page.height - marker.margin - marker.size}" width="${marker.size}" height="${marker.size}" />

  ${logoMarkup}
  <text class="sheet-title" x="${page.width / 2}" y="35.1" text-anchor="middle">${escapeXml(sheet.title)}</text>
  <text class="sheet-subtitle" x="${page.width / 2}" y="40.7" text-anchor="middle">Grade 2 Math</text>
  <text class="name-label" x="${nameField.labelX}" y="${nameField.labelY}">Name</text>
  <line class="name-line" x1="${nameField.lineX1}" y1="${nameField.lineY}" x2="${nameField.lineX2}" y2="${nameField.lineY}" />

  <g id="questions">
${rows.join('\n')}
  </g>

  <image class="qr-code" href="data:image/png;base64,${qrBase64}" x="${qr.x}" y="${qr.y}" width="${qr.size}" height="${qr.size}" />
  <text class="qr-label" x="${page.width / 2}" y="${qr.y - 2.4}" text-anchor="middle"><tspan class="qr-label-name">ScanGrade</tspan><tspan class="qr-label-domain">.io</tspan></text>
  <text class="qr-sheet-code" x="${page.width / 2}" y="${qr.y + qr.size + 3.35}" text-anchor="middle">${escapeXml(sheet.humanCode)}</text>

  <metadata>${escapeXml(payloadString)}</metadata>
</svg>
`
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function buildWorksheetIndex(registry) {
  const rows = registry.templates.map((template) => `
        <tr>
          <td>${escapeXml(template.title)}</td>
          <td>${template.total_questions}</td>
          <td>${template.answer_box_count}</td>
          <td><a href="./${escapeXml(template.worksheet_url.replace('worksheets/', ''))}">Open worksheet</a></td>
        </tr>`).join('')

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>ScanGrade Grade 2 Worksheets</title>
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
        margin: 40px auto;
        max-width: 860px;
        padding: 0 20px;
        color: #1d1d1f;
      }
      h1 {
        margin: 0 0 4px;
        font-size: 32px;
        letter-spacing: 0;
      }
      p {
        margin: 0 0 24px;
        color: #5f6368;
        font-size: 16px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 16px;
      }
      th, td {
        border-bottom: 1px solid #d8d8dc;
        padding: 14px 10px;
        text-align: left;
      }
      th {
        color: #5f6368;
        font-size: 13px;
        text-transform: uppercase;
      }
      a {
        color: #0057d8;
        font-weight: 700;
      }
    </style>
  </head>
  <body>
    <h1>ScanGrade Grade 2 Worksheets</h1>
    <p>Open a worksheet and scan it with the ScanGrade app.</p>
    <table>
      <thead>
        <tr>
          <th>Worksheet</th>
          <th>Questions</th>
          <th>Digit boxes</th>
          <th>File</th>
        </tr>
      </thead>
      <tbody>${rows}
      </tbody>
    </table>
  </body>
</html>
`
}

ensureDir(join(root, 'public', 'fonts'))
reportMissingWorksheetFonts()
ensureDir(join(root, 'public', 'worksheets'))
ensureDir(join(root, 'public', 'layouts'))
ensureDir(join(root, 'layouts'))

const registry = {
  generated_at: new Date().toISOString(),
  templates: []
}

for (const sheet of sheets) {
  const layout = buildLayout(sheet)
  const checksum = answerKeyChecksum(layout.answer_key)
  const payload = {
    schema_version: 1,
    template_id: sheet.id,
    template_version: 1,
    sheet_instance_id: `${sheet.id}-classroom-set`,
    layout_id: sheet.id,
    answer_key_checksum: checksum
  }
  const scanGradePayload = `SG1:${sheet.id}:1:${checksum}`
  const payloadString = qrUrlForPayload(scanGradePayload)
  const qrPng = await qrPngForPayload(sheet.id, payloadString)
  const svg = buildSvg(sheet, layout, qrPng.base64, payloadString)

  writeJson(join(root, 'public', 'layouts', `${sheet.id}.json`), layout)
  writeJson(join(root, 'layouts', `${sheet.id}.json`), layout)
  writeFileSync(join(root, 'public', 'worksheets', sheet.filename), svg)

  registry.templates.push({
    template_id: sheet.id,
    layout_id: sheet.id,
    human_code: sheet.humanCode,
    title: sheet.title,
    worksheet_url: `worksheets/${sheet.filename}`,
    layout_url: `layouts/${sheet.id}.json`,
    qr_payload: payload,
    qr_payload_url: payloadString,
    total_questions: 10,
    answer_box_count: layout.boxes.length
  })
}

writeJson(join(root, 'public', 'layouts', 'registry.json'), registry)
writeJson(join(root, 'layouts', 'registry.json'), registry)
writeJson(join(root, 'public', 'worksheets', 'manifest.json'), registry)
writeFileSync(join(root, 'public', 'worksheets', 'index.html'), buildWorksheetIndex(registry))

console.log(`Generated ${sheets.length} Grade 2 worksheets.`)
