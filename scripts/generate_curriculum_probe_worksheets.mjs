import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import QRCode from 'qrcode'
import { chromium } from 'playwright'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const outDir = join(root, 'public', 'worksheets', 'curriculum-probe-g1-g3')
const outLayoutDir = join(outDir, 'layouts')
const printableDir = join(outDir, 'printables')
const qrDir = join(outDir, 'qr')
const publicLayoutDir = join(root, 'public', 'layouts')
const rootLayoutDir = join(root, 'layouts')
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

const boxStyles = {
  2: {
    width: 13.4,
    height: 16.55,
    gap: 1,
    stroke: 0.54,
    leftAnswerX: 65,
    rightAnswerX: 161
  },
  3: {
    width: 12.25,
    height: 16.55,
    gap: 0.95,
    stroke: 0.54,
    leftAnswerX: 61.8,
    rightAnswerX: 157.3
  }
}
const digitGuide = {
  stroke: 0.46,
  markLength: 4.18
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
    id: 'sg-probe-g1-add-sub-20',
    code: 'CP01',
    humanCode: 'SG-CP-01',
    grade: 1,
    title: 'Addition and Subtraction Within 20',
    filename: 'cp01-grade1-add-sub-within-20.svg',
    answerSlots: 2,
    tier: 'supported',
    curriculum: 'Grade 1 Number: addition and subtraction facts/mental strategies within 20',
    questions: [
      ['4 + 5', 9],
      ['10 - 4', 6],
      ['7 + 5', 12],
      ['14 - 6', 8],
      ['8 + 7', 15],
      ['16 - 5', 11],
      ['3 + 4', 7],
      ['20 - 7', 13],
      ['9 + 5', 14],
      ['18 - 8', 10]
    ]
  },
  {
    id: 'sg-probe-g1-number-place-50',
    code: 'CP02',
    humanCode: 'SG-CP-02',
    grade: 1,
    title: 'Numbers and Place Value to 50',
    filename: 'cp02-grade1-numbers-place-value-to-50.svg',
    answerSlots: 2,
    tier: 'supported',
    curriculum: 'Grade 1 Number: read, represent, compare, compose, and decompose numbers to 50',
    questions: [
      ['after 29', 30],
      ['before 40', 39],
      ['2T + 6O', 26],
      ['max 34,43', 43],
      ['30 + 5', 35],
      ['5 tens', 50],
      ['5,10,15,__', 20],
      ['28 - 1', 27],
      ['36 + 3', 39],
      ['4T + 1O', 41]
    ]
  },
  {
    id: 'sg-probe-g1-patterns-missing',
    code: 'CP03',
    humanCode: 'SG-CP-03',
    grade: 1,
    title: 'Patterns and Missing Numbers',
    filename: 'cp03-grade1-patterns-missing-numbers.svg',
    answerSlots: 2,
    tier: 'supported',
    curriculum: 'Grade 1 Algebra: patterns, equality, and missing numbers using whole numbers to 50',
    questions: [
      ['4,6,8,__', 10],
      ['10+__=15', 5],
      ['__+3=10', 7],
      ['2,4,6,8,__', 10],
      ['5,10,15,__', 20],
      ['12-__=6', 6],
      ['20,25,__', 30],
      ['7+__=14', 7],
      ['30,35,40,__', 45],
      ['__-4=9', 13]
    ]
  },
  {
    id: 'sg-probe-g2-add-sub-100',
    code: 'CP04',
    humanCode: 'SG-CP-04',
    grade: 2,
    title: 'Addition and Subtraction Within 100',
    filename: 'cp04-grade2-add-sub-within-100.svg',
    answerSlots: 2,
    tier: 'supported',
    curriculum: 'Grade 2 Number: addition and subtraction situations with totals to 100',
    questions: [
      ['38 + 27', 65],
      ['94 - 36', 58],
      ['46 + 39', 85],
      ['72 - 19', 53],
      ['55 + 26', 81],
      ['100 - 47', 53],
      ['29 + 44', 73],
      ['86 - 28', 58],
      ['63 + 35', 98],
      ['90 - 17', 73]
    ]
  },
  {
    id: 'sg-probe-g2-place-value-200',
    code: 'CP05',
    humanCode: 'SG-CP-05',
    grade: 2,
    title: 'Place Value to 200',
    filename: 'cp05-grade2-place-value-to-200.svg',
    answerSlots: 3,
    tier: 'stress',
    curriculum: 'Grade 2 Number: read, represent, compare, compose, and decompose numbers to 200',
    questions: [
      ['100 + 40 + 6', 146],
      ['100 + 70 + 2', 172],
      ['2 hundreds', 200],
      ['100 + 9', 109],
      ['100 + 60 + 5', 165],
      ['12 tens', 120],
      ['100 + 30 + 4', 134],
      ['200 - 2', 198],
      ['180 + 1', 181],
      ['15 tens', 150]
    ]
  },
  {
    id: 'sg-probe-g2-equal-groups',
    code: 'CP06',
    humanCode: 'SG-CP-06',
    grade: 2,
    title: 'Equal Groups and Sharing',
    filename: 'cp06-grade2-equal-groups-sharing.svg',
    answerSlots: 2,
    tier: 'supported',
    curriculum: 'Grade 2 Number: repeated equal groups and simple division situations',
    questions: [
      ['3 grps of 4', 12],
      ['5 grps of 4', 20],
      ['3 x 5', 15],
      ['12 / 2', 6],
      ['4 grps of 4', 16],
      ['16 / 4', 4],
      ['6 grps of 3', 18],
      ['12 / 4', 3],
      ['4 x 6', 24],
      ['20 / 2', 10]
    ]
  },
  {
    id: 'sg-probe-g2-money-cents',
    code: 'CP07',
    humanCode: 'SG-CP-07',
    grade: 2,
    title: 'Money in Cents',
    filename: 'cp07-grade2-money-in-cents.svg',
    answerSlots: 3,
    tier: 'stress',
    curriculum: 'Grade 2 Financial Literacy: represent money amounts to 200 cents',
    questions: [
      ['25c + 50c', 75],
      ['100c + 25c', 125],
      ['2 dollars in cents', 200],
      ['50c + 15c', 65],
      ['100c + 80c', 180],
      ['45c + 45c', 90],
      ['75c + 75c', 150],
      ['100c + 35c', 135],
      ['10c + 15c', 25],
      ['50c + 50c', 100]
    ]
  },
  {
    id: 'sg-probe-g3-add-sub-1000',
    code: 'CP08',
    humanCode: 'SG-CP-08',
    grade: 3,
    title: 'Addition and Subtraction to 1000',
    filename: 'cp08-grade3-add-sub-to-1000.svg',
    answerSlots: 3,
    tier: 'stress',
    curriculum: 'Grade 3 Number: add and subtract whole numbers with answers to 1000',
    questions: [
      ['258 + 229', 487],
      ['612 - 243', 369],
      ['575 + 326', 901],
      ['804 - 276', 528],
      ['642 + 158', 800],
      ['1000 - 435', 565],
      ['219 + 364', 583],
      ['700 - 248', 452],
      ['386 + 407', 793],
      ['950 - 125', 825]
    ]
  },
  {
    id: 'sg-probe-g3-mult-div-facts',
    code: 'CP09',
    humanCode: 'SG-CP-09',
    grade: 3,
    title: 'Multiplication and Division Facts',
    filename: 'cp09-grade3-multiplication-division-facts.svg',
    answerSlots: 3,
    tier: 'stress',
    curriculum: 'Grade 3 Number: multiplication facts and related division facts',
    questions: [
      ['9 x 2', 18],
      ['5 x 10', 50],
      ['40 / 5', 8],
      ['6 x 6', 36],
      ['45 / 5', 9],
      ['7 x 10', 70],
      ['36 / 3', 12],
      ['9 x 7', 63],
      ['10 x 10', 100],
      ['48 / 8', 6]
    ]
  },
  {
    id: 'sg-probe-g3-measure-data-time',
    code: 'CP10',
    humanCode: 'SG-CP-10',
    grade: 3,
    title: 'Measurement, Data, and Time Numbers',
    filename: 'cp10-grade3-measurement-data-time.svg',
    answerSlots: 3,
    tier: 'future',
    curriculum: 'Grade 3 Spatial Sense/Data/Financial Literacy: measurement, time, money, and simple data with numeric answers',
    questions: [
      ['perim 6+6+6+6', 24],
      ['1m 50cm in cm', 150],
      ['area 4 x 8', 32],
      ['3 quarters hr min', 45],
      ['4 rows of 4', 16],
      ['3m in cm', 300],
      ['75 cents', 75],
      ['1 hour in min', 60],
      ['mode 18,18', 18],
      ['half turn deg', 180]
    ]
  }
]

function ensureDir(path) {
  if (!existsSync(path)) mkdirSync(path, { recursive: true })
}

function round(value, places = 4) {
  return Number(value.toFixed(places))
}

function trimNumber(value) {
  return Number(value.toFixed(3)).toString()
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

function escapeHtml(value) {
  return escapeXml(value).replaceAll("'", '&#39;')
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

function boxStyleForSlots(slotCount) {
  const style = boxStyles[slotCount]
  if (!style) throw new Error(`Unsupported answer slot count: ${slotCount}`)
  return style
}

function answerFrameWidth(slotCount) {
  const style = boxStyleForSlots(slotCount)
  return style.width * slotCount + style.gap * (slotCount - 1)
}

function canonicalDigitCells(answer, slotCount) {
  const digits = digitArray(answer)
  if (digits.length > slotCount) {
    throw new Error(`Answer ${answer} does not fit ${slotCount} slots.`)
  }
  return Array(slotCount - digits.length).fill(null).concat(digits)
}

function uniqueResponseList(responses) {
  const seen = new Set()
  const out = []
  for (const response of responses) {
    const key = response.map((digit) => digit == null ? '_' : String(digit)).join(',')
    if (seen.has(key)) continue
    seen.add(key)
    out.push(response)
  }
  return out
}

function acceptedDigitResponses(answer, slotCount) {
  const digits = digitArray(answer)
  if (digits.length > slotCount) return []
  const responses = []
  const rightAligned = Array(slotCount - digits.length).fill(null).concat(digits)
  responses.push(rightAligned)
  if (digits.length < slotCount) {
    responses.push(Array(slotCount - digits.length).fill(0).concat(digits))
    responses.push(digits.concat(Array(slotCount - digits.length).fill(null)))
    if (digits.length === 1 && slotCount === 3) responses.push([null, digits[0], null])
  }
  if (digits.length === 1 && slotCount === 2) responses.push([digits[0], null])
  return uniqueResponseList(responses).map((digitsForResponse) => ({
    label: digitsForResponse.map((digit) => digit == null ? '_' : String(digit)).join(''),
    digits: digitsForResponse,
    meaning: 'accepted numeric placement for young-student handwriting'
  }))
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
    ...missing.map((font) => `  - public/fonts/${font.file} (${font.label})`)
  ].join('\n')
  throw new Error(message)
}

async function qrPngForPayload(sheetId, payloadString) {
  ensureDir(qrDir)
  const outPath = join(qrDir, `${sheetId}.png`)
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
  const text = String(problem).trim()
  return text.length > 11
    || text.includes(',')
    || text.includes('__')
    || /\b(grps|groups|greater|before|after|perim|perimeter|quarters|degrees|hour|mode|dollars)\b/i.test(text)
}

function needsTinyProblemText(problem) {
  const text = String(problem).trim()
  return text.length > 16
}

function answerGeometry(sheet, questionIndex) {
  const slotCount = sheet.answerSlots
  const style = boxStyleForSlots(slotCount)
  const col = questionIndex < 5 ? 0 : 1
  const row = questionIndex % 5
  const rowTop = 68 + row * 31
  const top = rowTop + (17.2 - style.height) / 2
  const answerX = col === 0 ? style.leftAnswerX : style.rightAnswerX
  const xs = Array.from({ length: slotCount }, (_, digitIndex) =>
    answerX + digitIndex * (style.width + style.gap)
  )
  const answerCenterY = top + style.height / 2
  const compactProblem = needsCompactProblemText(sheet.questions[questionIndex][0])
  const labelOffset = slotCount === 3
    ? (col === 1 ? 39 : 48)
    : (col === 1 ? (compactProblem ? 45 : 42) : (compactProblem ? 45 : 35.5))
  const problemGap = slotCount === 3
    ? (col === 1 ? 1.8 : 4.6)
    : 2.4
  return {
    col,
    row,
    top,
    xs,
    answerX,
    labelX: answerX - labelOffset,
    labelCenterY: answerCenterY,
    problemX: answerX - problemGap,
    problemCenterY: answerCenterY
  }
}

function digitPlaceName(slotCount, digitIndex) {
  if (slotCount === 2) return digitIndex === 0 ? 'tens' : 'ones'
  if (slotCount === 3) return ['hundreds', 'tens', 'ones'][digitIndex]
  return `slot_${digitIndex}`
}

function buildLayout(sheet) {
  const boxes = []
  const answerKey = []
  const questionGroups = []
  const style = boxStyleForSlots(sheet.answerSlots)

  sheet.questions.forEach(([problem, answer], qIndex) => {
    const digits = canonicalDigitCells(answer, sheet.answerSlots)
    const acceptedResponses = acceptedDigitResponses(answer, sheet.answerSlots)
    const geometry = answerGeometry(sheet, qIndex)
    const digitBoxIds = []

    digits.forEach((digit, digitIndex) => {
      const id = boxes.length
      const left = geometry.xs[digitIndex]
      const top = geometry.top
      boxes.push({
        id,
        question_num: qIndex + 1,
        digit_index: digitIndex,
        digit_place: digitPlaceName(sheet.answerSlots, digitIndex),
        x: normalizeX(left + style.width),
        y: normalizeY(top + style.height),
        width: normalizeX(style.width),
        height: normalizeY(style.height),
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
        type: 'open_divider',
        slot_count: sheet.answerSlots,
        printed: true,
        x_values: Array.from({ length: sheet.answerSlots - 1 }, (_, seamIndex) => (
          normalizeX(geometry.answerX + (seamIndex + 1) * style.width + (seamIndex + 0.5) * style.gap)
        )),
        y1: normalizeY(geometry.top),
        y2: normalizeY(geometry.top + style.height)
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
      grade_level: sheet.grade,
      total_questions: 10,
      answer_box_count: boxes.length,
      printed_text_font_family: 'Lexend',
      required_font_files: worksheetFonts.map((font) => `public/fonts/${font.file}`),
      digit_box_width_mm: style.width,
      digit_box_height_mm: style.height,
      answer_slots_per_question: sheet.answerSlots,
      marker_size_mm: marker.size,
      curriculum_probe: true,
      curriculum_tier: sheet.tier,
      curriculum_note: sheet.curriculum,
      grading_policy: {
        answer_slots_per_question: sheet.answerSlots,
        printed_digit_split_guide: 'open center divider notches',
        blank_digit_value: null,
        shorter_answers_accept_left_or_right_placement: true
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

function dividerLines(sheet, geometry) {
  const style = boxStyleForSlots(sheet.answerSlots)
  const top = geometry.top
  const bottom = geometry.top + style.height
  const upperEnd = top + digitGuide.markLength
  const lowerStart = bottom - digitGuide.markLength
  return Array.from({ length: sheet.answerSlots - 1 }, (_, seamIndex) => {
    const x = geometry.answerX + (seamIndex + 1) * style.width + (seamIndex + 0.5) * style.gap
    return `<line class="open-divider-guide" x1="${trimNumber(x)}" y1="${trimNumber(top)}" x2="${trimNumber(x)}" y2="${trimNumber(upperEnd)}" />
      <line class="open-divider-guide" x1="${trimNumber(x)}" y1="${trimNumber(lowerStart)}" x2="${trimNumber(x)}" y2="${trimNumber(bottom)}" />`
  }).join('\n      ')
}

function buildSvg(sheet, layout, qrBase64, payloadString) {
  const rows = []
  const style = boxStyleForSlots(sheet.answerSlots)
  for (let i = 0; i < sheet.questions.length; i++) {
    const [problem] = sheet.questions[i]
    const geometry = answerGeometry(sheet, i)
    const questionLabel = questionLetter(i)
    const problemText = String(problem).includes('=') ? String(problem) : `${problem} =`
    const problemClass = [
      'problem-text',
      sheet.answerSlots === 3 ? 'problem-text-slots-3' : '',
      needsCompactProblemText(problem) ? 'problem-text-compact' : '',
      needsTinyProblemText(problem) ? 'problem-text-tiny' : ''
    ].filter(Boolean).join(' ')
    const rects = `${dividerLines(sheet, geometry)}
      <rect class="answer-box answer-box-wide" data-question-boxes="${layout.question_groups[i].digit_box_ids.join(',')}" x="${trimNumber(geometry.answerX)}" y="${trimNumber(geometry.top)}" width="${trimNumber(answerFrameWidth(sheet.answerSlots))}" height="${trimNumber(style.height)}" />`
    rows.push(`
    <g class="question" data-question="${i + 1}">
      <g class="scantron-question-label" transform="translate(${trimNumber(geometry.labelX)} ${trimNumber(geometry.labelCenterY)})">
        <ellipse class="scantron-bubble" cx="0" cy="0" rx="3.88" ry="3.02" />
        <text class="scantron-letter" x="0" y="0.25" text-anchor="middle">${escapeXml(questionLabel)}</text>
      </g>
      <text class="${problemClass}" x="${trimNumber(geometry.problemX)}" y="${trimNumber(geometry.problemCenterY)}" text-anchor="end">${escapeXml(problemText)}</text>
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
      .sheet-title { font-size: 6.75px; font-weight: 650; fill: #222; }
      .sheet-subtitle { font-size: 4px; font-weight: 400; fill: #555; }
      .problem-text { font-size: 6.15px; font-weight: 430; }
      .problem-text-compact { font-size: 5.28px; }
      .problem-text-tiny { font-size: 4.58px; }
      .problem-text-slots-3 { font-size: 5.05px; }
      .problem-text-slots-3.problem-text-compact { font-size: 4.35px; }
      .problem-text-slots-3.problem-text-tiny { font-size: 3.75px; }
      .problem-text, .scantron-letter { dominant-baseline: middle; }
      .scantron-bubble { fill: none; stroke: #c4c8ce; stroke-width: 0.34; }
      .scantron-letter { font-size: 4.45px; font-weight: 600; fill: #626b74; }
      .answer-box { fill: none; stroke: #111; stroke-width: ${style.stroke}; shape-rendering: geometricPrecision; }
      .open-divider-guide { fill: none; stroke: #707780; stroke-width: ${digitGuide.stroke}; stroke-linecap: round; }
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
  <text class="sheet-subtitle" x="${page.width / 2}" y="40.7" text-anchor="middle">Grade ${sheet.grade} Math</text>
  <text class="name-label" x="${nameField.labelX}" y="${nameField.labelY}">Name</text>
  <line class="name-line" x1="${nameField.lineX1}" y1="${nameField.lineY}" x2="${nameField.lineX2}" y2="${nameField.lineY}" />

  <g id="questions">
${rows.join('\n')}
  </g>

  <image class="qr-code" href="data:image/png;base64,${qrBase64}" x="${qr.x}" y="${qr.y}" width="${qr.size}" height="${qr.size}" />
  <text class="qr-label" x="${page.width / 2}" y="${qr.y - 1.2}" text-anchor="middle"><tspan class="qr-label-name">ScanGrade</tspan><tspan class="qr-label-domain">.io</tspan></text>
  <text class="qr-sheet-code" x="${page.width / 2}" y="${qr.y + qr.size + 3.35}" text-anchor="middle">${escapeXml(sheet.humanCode)}</text>

  <metadata>${escapeXml(payloadString)}</metadata>
</svg>
`
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function printableHtml(svgList) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      @page { size: Letter; margin: 0; }
      html, body { margin: 0; padding: 0; background: #fff; }
      .sheet-page {
        width: 8.5in;
        height: 11in;
        page-break-after: always;
        break-after: page;
        overflow: hidden;
        background: #fff;
      }
      .sheet-page:last-child { page-break-after: auto; break-after: auto; }
      svg { display: block; width: 8.5in; height: 11in; }
    </style>
  </head>
  <body>
    ${svgList.map((svg) => `<section class="sheet-page">${svg}</section>`).join('\n')}
  </body>
</html>`
}

function answerKeyHtml(registry) {
  const sheetSections = sheets.map((sheet) => {
    const rows = sheet.questions.map(([problem, answer], index) => `
        <tr>
          <td>${questionLetter(index)}</td>
          <td>${escapeHtml(problem)}</td>
          <td>${answer}</td>
        </tr>`).join('')
    return `
      <section class="sheet">
        <h2>${escapeHtml(sheet.humanCode)} ${escapeHtml(sheet.title)}</h2>
        <p>Grade ${sheet.grade}. ${escapeHtml(sheet.tier)}. ${escapeHtml(sheet.curriculum)}</p>
        <table>
          <thead><tr><th>Item</th><th>Prompt</th><th>Answer</th></tr></thead>
          <tbody>${rows}
          </tbody>
        </table>
      </section>`
  }).join('\n')

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>ScanGrade Grade 1-3 Curriculum Probe Answer Key</title>
    <style>
      @font-face {
        font-family: "Lexend";
        src: url("../../fonts/Lexend-wght.ttf") format("truetype");
        font-weight: 100 900;
      }
      @page { size: Letter; margin: 0.55in; }
      body {
        margin: 0;
        color: #202124;
        font-family: "Lexend", -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
      }
      h1 { margin: 0 0 8px; font-size: 28px; letter-spacing: 0; }
      .intro { margin: 0 0 18px; color: #5f6368; line-height: 1.45; }
      .sheet { break-inside: avoid; margin: 0 0 20px; }
      h2 { margin: 0 0 4px; font-size: 17px; }
      p { margin: 0 0 8px; color: #5f6368; font-size: 11px; line-height: 1.4; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; }
      th, td { border-bottom: 1px solid #d8dadd; padding: 5px 6px; text-align: left; }
      th { color: #5f6368; font-size: 9px; text-transform: uppercase; letter-spacing: 0.02em; }
      td:first-child, td:last-child { width: 52px; font-weight: 700; }
    </style>
  </head>
  <body>
    <h1>ScanGrade Grade 1-3 Curriculum Probe Answer Key</h1>
    <p class="intro">Generated ${escapeHtml(registry.generated_at)}. This packet is for classroom testing. Score OCR against what the student wrote, not only against this answer key.</p>
${sheetSections}
  </body>
</html>`
}

function indexHtml(registry) {
  const cards = registry.templates.map((template) => `
      <article class="card">
        <a href="./${escapeHtml(template.filename)}" target="_blank" rel="noreferrer">
          <img alt="${escapeHtml(template.title)} preview" src="./${escapeHtml(template.filename)}">
        </a>
        <div>
          <h2>${escapeHtml(template.human_code)} ${escapeHtml(template.title)}</h2>
          <p>Grade ${template.grade_level}. ${escapeHtml(template.curriculum_tier)}. ${template.answer_slots_per_question} answer slots per question.</p>
          <p><a href="./${escapeHtml(template.filename)}" target="_blank" rel="noreferrer">SVG</a> <a href="./layouts/${escapeHtml(template.layout_id)}.json" target="_blank" rel="noreferrer">Layout JSON</a></p>
        </div>
      </article>`).join('\n')

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>ScanGrade Grade 1-3 Curriculum Probe</title>
    <style>
      @font-face {
        font-family: "Lexend";
        src: url("../../fonts/Lexend-wght.ttf") format("truetype");
        font-weight: 100 900;
      }
      body {
        margin: 0;
        background: #f4f5f7;
        color: #202124;
        font-family: "Lexend", -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
      }
      main { max-width: 1180px; margin: 0 auto; padding: 34px 20px 44px; }
      h1 { margin: 0 0 8px; font-size: clamp(28px, 4vw, 42px); letter-spacing: 0; }
      .intro { max-width: 850px; margin: 0 0 22px; color: #626970; line-height: 1.45; }
      .actions { display: flex; flex-wrap: wrap; gap: 12px; margin: 0 0 24px; }
      .action {
        display: inline-flex;
        align-items: center;
        min-height: 44px;
        padding: 0 17px;
        border-radius: 8px;
        background: #0f7a3f;
        color: #fff;
        font-weight: 760;
        text-decoration: none;
      }
      .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
      .card {
        overflow: hidden;
        border: 1px solid #dde1e6;
        border-radius: 8px;
        background: #fff;
        box-shadow: 0 12px 26px rgba(15, 23, 42, 0.08);
      }
      img { display: block; width: 100%; height: 620px; object-fit: contain; background: #fff; border-bottom: 1px solid #eceff2; }
      .card div { padding: 17px 18px 20px; }
      h2 { margin: 0 0 7px; font-size: 19px; }
      p { margin: 0 0 12px; color: #626970; line-height: 1.45; }
      a { color: #0057d8; font-weight: 750; }
      .action { color: #fff; }
      @media (max-width: 900px) {
        .grid { grid-template-columns: 1fr; }
        img { height: 700px; }
      }
    </style>
  </head>
  <body>
    <main>
      <h1>ScanGrade Grade 1-3 Curriculum Probe</h1>
      <p class="intro">Ten original worksheets based on Ontario Grade 1-3 math surfaces and common printable worksheet categories. This is a classroom versatility probe, not a launch claim.</p>
      <div class="actions">
        <a class="action" href="./printables/ScanGrade-Grade1-3-Curriculum-Probe-Packet.pdf" target="_blank" rel="noreferrer">Open print packet PDF</a>
        <a class="action" href="./printables/ScanGrade-Grade1-3-Curriculum-Probe-Answer-Key.pdf" target="_blank" rel="noreferrer">Open answer key PDF</a>
        <a class="action" href="./manifest.json" target="_blank" rel="noreferrer">Open manifest</a>
      </div>
      <section class="grid">
${cards}
      </section>
    </main>
  </body>
</html>`
}

async function writePdf(pageHandle, html, path) {
  await pageHandle.setContent(html, { waitUntil: 'load' })
  await pageHandle.pdf({
    path,
    width: '8.5in',
    height: '11in',
    printBackground: true,
    margin: { top: '0in', right: '0in', bottom: '0in', left: '0in' },
    preferCSSPageSize: true
  })
}

ensureDir(outDir)
ensureDir(outLayoutDir)
ensureDir(printableDir)
ensureDir(qrDir)
ensureDir(publicLayoutDir)
ensureDir(rootLayoutDir)
reportMissingWorksheetFonts()

const registry = {
  generated_at: new Date().toISOString(),
  purpose: 'Grade 1-3 curriculum versatility probe. Not a launch claim.',
  source_doc: 'docs/CURRICULUM_PROBE_G1_G3_MATRIX.md',
  templates: []
}
const svgList = []

for (const sheet of sheets) {
  const layout = buildLayout(sheet)
  const checksum = answerKeyChecksum(layout.answer_key)
  const scanGradePayload = `SG1:${sheet.id}:1:${checksum}`
  const payloadString = qrUrlForPayload(scanGradePayload)
  const qrPng = await qrPngForPayload(sheet.id, payloadString)
  const svg = buildSvg(sheet, layout, qrPng.base64, payloadString)

  writeJson(join(outLayoutDir, `${sheet.id}.json`), layout)
  writeJson(join(publicLayoutDir, `${sheet.id}.json`), layout)
  writeJson(join(rootLayoutDir, `${sheet.id}.json`), layout)
  writeFileSync(join(outDir, sheet.filename), svg)
  svgList.push(svg)

  registry.templates.push({
    template_id: sheet.id,
    layout_id: sheet.id,
    human_code: sheet.humanCode,
    title: sheet.title,
    filename: sheet.filename,
    worksheet_url: `worksheets/curriculum-probe-g1-g3/${sheet.filename}`,
    layout_url: `layouts/${sheet.id}.json`,
    probe_layout_url: `worksheets/curriculum-probe-g1-g3/layouts/${sheet.id}.json`,
    qr_payload_url: payloadString,
    grade_level: sheet.grade,
    curriculum_tier: sheet.tier,
    curriculum_note: sheet.curriculum,
    total_questions: 10,
    answer_box_count: layout.boxes.length,
    answer_slots_per_question: sheet.answerSlots,
    answer_key_checksum: checksum
  })
}

writeJson(join(outDir, 'manifest.json'), registry)
writeFileSync(join(outDir, 'index.html'), indexHtml(registry))
const answerKey = answerKeyHtml(registry)
writeFileSync(join(outDir, 'teacher-answer-key.html'), answerKey)

const browser = await chromium.launch()
try {
  const pageHandle = await browser.newPage()
  await writePdf(
    pageHandle,
    printableHtml(svgList),
    join(printableDir, 'ScanGrade-Grade1-3-Curriculum-Probe-Packet.pdf')
  )
  await writePdf(
    pageHandle,
    answerKey,
    join(printableDir, 'ScanGrade-Grade1-3-Curriculum-Probe-Answer-Key.pdf')
  )
} finally {
  await browser.close()
}

console.log(`Generated ${sheets.length} Grade 1-3 curriculum probe worksheets.`)
console.log(`Index: ${join(outDir, 'index.html')}`)
console.log(`Packet: ${join(printableDir, 'ScanGrade-Grade1-3-Curriculum-Probe-Packet.pdf')}`)
