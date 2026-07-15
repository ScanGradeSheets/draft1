import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import QRCode from 'qrcode'
import { chromium } from 'playwright'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const outDir = join(root, 'public', 'worksheets', 'curriculum-probe-g1-g2-v2')
const outLayoutDir = join(outDir, 'layouts')
const printableDir = join(outDir, 'printables')
const qrDir = join(outDir, 'qr')
const publicLayoutDir = join(root, 'public', 'layouts')
const rootLayoutDir = join(root, 'layouts')
const logoCandidates = [
  join(root, 'public', 'scangrade-logo.png'),
  join(root, 'public', 'scangrade-logo-transparent.png')
]
const logoAssetPath = logoCandidates.find((path) => existsSync(path))
const logoDataUrl = logoAssetPath
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
    stroke: 0.54
  },
  3: {
    width: 12.25,
    height: 16.55,
    gap: 0.95,
    stroke: 0.54
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
    id: 'sg-v2-g1-add-sub-20-work',
    code: 'V2-01',
    humanCode: 'SG-V2-G1-01',
    grade: 1,
    title: 'Addition and Subtraction Within 20',
    filename: 'v2-01-grade1-add-sub-within-20-work.svg',
    answerSlots: 2,
    family: 'fact_rows',
    curriculum: 'Grade 1 Number: addition and subtraction facts and mental strategies within 20',
    questions: [
      { prompt: '6 + 3', answer: 9 },
      { prompt: '10 - 4', answer: 6 },
      { prompt: '7 + 5', answer: 12 },
      { prompt: '14 - 8', answer: 6 },
      { prompt: '8 + 8', answer: 16 },
      { prompt: '17 - 9', answer: 8 },
      { prompt: '9 + 6', answer: 15 },
      { prompt: '20 - 7', answer: 13 }
    ]
  },
  {
    id: 'sg-v2-g1-ten-frames-20',
    code: 'V2-02',
    humanCode: 'SG-V2-G1-02',
    grade: 1,
    title: 'Ten Frames to 20',
    filename: 'v2-02-grade1-ten-frames-to-20.svg',
    answerSlots: 2,
    family: 'ten_frames',
    curriculum: 'Grade 1 Number: count, compose, and represent numbers to 20 using ten frames',
    questions: [
      { prompt: 'How many?', count: 7, answer: 7 },
      { prompt: 'How many?', count: 10, answer: 10 },
      { prompt: 'How many?', count: 12, answer: 12 },
      { prompt: 'How many?', count: 15, answer: 15 },
      { prompt: 'How many?', count: 18, answer: 18 },
      { prompt: 'How many?', count: 20, answer: 20 }
    ]
  },
  {
    id: 'sg-v2-g1-dot-collections-20',
    code: 'V2-03',
    humanCode: 'SG-V2-G1-03',
    grade: 1,
    title: 'Dot Collections to 20',
    filename: 'v2-03-grade1-dot-collections-to-20.svg',
    answerSlots: 2,
    family: 'dot_collections',
    curriculum: 'Grade 1 Number: count and subitize arranged dot collections to 20',
    questions: [
      { prompt: 'How many dots?', count: 6, answer: 6 },
      { prompt: 'How many dots?', count: 9, answer: 9 },
      { prompt: 'How many dots?', count: 11, answer: 11 },
      { prompt: 'How many dots?', count: 13, answer: 13 },
      { prompt: 'How many dots?', count: 16, answer: 16 },
      { prompt: 'How many dots?', count: 19, answer: 19 }
    ]
  },
  {
    id: 'sg-v2-g1-number-bonds-20',
    code: 'V2-04',
    humanCode: 'SG-V2-G1-04',
    grade: 1,
    title: 'Number Bonds to 20',
    filename: 'v2-04-grade1-number-bonds-to-20.svg',
    answerSlots: 2,
    family: 'number_bonds',
    curriculum: 'Grade 1 Number: compose and decompose numbers to 20 with part-part-whole models',
    questions: [
      { prompt: '5 and 7 make', parts: [5, 7], missing: 'total', answer: 12 },
      { prompt: '15 is 9 and', total: 15, parts: [9, null], missing: 'right', answer: 6 },
      { prompt: '8 and 6 make', parts: [8, 6], missing: 'total', answer: 14 },
      { prompt: '18 is 10 and', total: 18, parts: [10, null], missing: 'right', answer: 8 },
      { prompt: '4 and 11 make', parts: [4, 11], missing: 'total', answer: 15 },
      { prompt: '20 is 13 and', total: 20, parts: [13, null], missing: 'right', answer: 7 }
    ]
  },
  {
    id: 'sg-v2-g1-number-patterns',
    code: 'V2-05',
    humanCode: 'SG-V2-G1-05',
    grade: 1,
    title: 'Number Patterns and Missing Numbers',
    filename: 'v2-05-grade1-number-patterns-missing.svg',
    answerSlots: 2,
    family: 'patterns',
    curriculum: 'Grade 1 Algebra: identify growing and shrinking number patterns and missing numbers to 50',
    questions: [
      { prompt: '2, 4, __, 8', prefix: '2, 4,', suffix: ', 8', answer: 6 },
      { prompt: '5, 10, __, 20', prefix: '5, 10,', suffix: ', 20', answer: 15 },
      { prompt: '9, 10, __, 12', prefix: '9, 10,', suffix: ', 12', answer: 11 },
      { prompt: '20, 18, __, 14', prefix: '20, 18,', suffix: ', 14', answer: 16 },
      { prompt: '3, 6, 9, __', prefix: '3, 6, 9,', suffix: '', answer: 12 },
      { prompt: '30, 35, __, 45', prefix: '30, 35,', suffix: ', 45', answer: 40 }
    ]
  },
  {
    id: 'sg-v2-g2-stacked-add-100',
    code: 'V2-06',
    humanCode: 'SG-V2-G2-06',
    grade: 2,
    title: 'Two-Digit Addition, Stacked',
    filename: 'v2-06-grade2-stacked-addition-within-100.svg',
    answerSlots: 2,
    family: 'stacked',
    curriculum: 'Grade 2 Number: add two-digit whole numbers using standard vertical form and place value',
    questions: [
      { topNumber: 38, operator: '+', bottomNumber: 27, answer: 65 },
      { topNumber: 46, operator: '+', bottomNumber: 39, answer: 85 },
      { topNumber: 55, operator: '+', bottomNumber: 26, answer: 81 },
      { topNumber: 29, operator: '+', bottomNumber: 44, answer: 73 },
      { topNumber: 63, operator: '+', bottomNumber: 35, answer: 98 },
      { topNumber: 47, operator: '+', bottomNumber: 28, answer: 75 }
    ]
  },
  {
    id: 'sg-v2-g2-stacked-sub-100',
    code: 'V2-07',
    humanCode: 'SG-V2-G2-07',
    grade: 2,
    title: 'Two-Digit Subtraction, Stacked',
    filename: 'v2-07-grade2-stacked-subtraction-within-100.svg',
    answerSlots: 2,
    family: 'stacked',
    curriculum: 'Grade 2 Number: subtract two-digit whole numbers using standard vertical form and place value',
    questions: [
      { topNumber: 94, operator: '-', bottomNumber: 36, answer: 58 },
      { topNumber: 72, operator: '-', bottomNumber: 19, answer: 53 },
      { topNumber: 86, operator: '-', bottomNumber: 28, answer: 58 },
      { topNumber: 90, operator: '-', bottomNumber: 17, answer: 73 },
      { topNumber: 63, operator: '-', bottomNumber: 25, answer: 38 },
      { topNumber: 81, operator: '-', bottomNumber: 47, answer: 34 }
    ]
  },
  {
    id: 'sg-v2-g2-place-value-200',
    code: 'V2-08',
    humanCode: 'SG-V2-G2-08',
    grade: 2,
    title: 'Place Value to 200',
    filename: 'v2-08-grade2-place-value-to-200.svg',
    answerSlots: 3,
    family: 'work_cards',
    curriculum: 'Grade 2 Number: compose, decompose, and represent whole numbers to 200',
    questions: [
      { lines: ['100 + 40 + 6'], answer: 146 },
      { lines: ['12 tens'], answer: 120 },
      { lines: ['200 - 2'], answer: 198 },
      { lines: ['100 + 9'], answer: 109 },
      { lines: ['15 tens'], answer: 150 },
      { lines: ['180 + 1'], answer: 181 }
    ]
  },
  {
    id: 'sg-v2-g2-equal-groups-sharing',
    code: 'V2-09',
    humanCode: 'SG-V2-G2-09',
    grade: 2,
    title: 'Equal Groups and Sharing',
    filename: 'v2-09-grade2-equal-groups-sharing.svg',
    answerSlots: 2,
    family: 'work_cards',
    curriculum: 'Grade 2 Number: repeated equal groups, arrays, and fair-sharing situations',
    questions: [
      { lines: ['3 groups of 4'], answer: 12 },
      { lines: ['5 groups of 4'], answer: 20 },
      { lines: ['3 rows of 5'], answer: 15 },
      { lines: ['16 shared by 4'], answer: 4 },
      { lines: ['6 groups of 3'], answer: 18 },
      { lines: ['20 shared by 2'], answer: 10 }
    ]
  },
  {
    id: 'sg-v2-g2-money-cents',
    code: 'V2-10',
    humanCode: 'SG-V2-G2-10',
    grade: 2,
    title: 'Money in Cents',
    filename: 'v2-10-grade2-money-in-cents.svg',
    answerSlots: 3,
    family: 'work_cards',
    curriculum: 'Grade 2 Financial Literacy: represent and combine money amounts to 200 cents',
    questions: [
      { lines: ['25c + 50c'], answer: 75 },
      { lines: ['100c + 25c'], answer: 125 },
      { lines: ['$2 in cents'], answer: 200 },
      { lines: ['50c + 15c'], answer: 65 },
      { lines: ['75c + 75c'], answer: 150 },
      { lines: ['100c + 35c'], answer: 135 }
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

function gridBlock(sheet, questionIndex) {
  if (sheet.family === 'fact_rows') {
    const row = questionIndex % 4
    const col = questionIndex < 4 ? 0 : 1
    const x = col === 0 ? 22.8 : 111.6
    const y = 66.8 + row * 38.9
    const width = 81.5
    const height = 34.6
    return {
      x,
      y,
      width,
      height,
      col,
      row,
      bubbleX: x + 4.8,
      bubbleY: y + height / 2,
      contentX: x + 14.2,
      contentY: y + 7
    }
  }

  const row = questionIndex % 3
  const col = questionIndex < 3 ? 0 : 1
  const x = col === 0 ? 21.6 : 111.1
  const y = 64.8 + row * 59
  const width = 83.2
  const height = 55
  return {
    x,
    y,
    width,
    height,
    col,
    row,
    bubbleX: x + 4.8,
    bubbleY: y + height / 2,
    contentX: x + 14.2,
    contentY: y + 7.1
  }
}

function answerGeometry(sheet, questionIndex) {
  const block = gridBlock(sheet, questionIndex)
  const frameWidth = answerFrameWidth(sheet.answerSlots)
  const style = boxStyleForSlots(sheet.answerSlots)
  const commonRightX = block.x + block.width - frameWidth - 6

  if (sheet.family === 'fact_rows') {
    return {
      block,
      answerX: commonRightX,
      top: block.y + block.height / 2 - style.height / 2
    }
  }

  if (sheet.family === 'patterns') {
    return {
      block,
      answerX: block.x + 41,
      top: block.y + 20.3
    }
  }

  if (sheet.family === 'stacked') {
    return {
      block,
      answerX: block.x + 42.4,
      top: block.y + 27.2
    }
  }

  if (sheet.family === 'number_bonds') {
    const question = sheet.questions[questionIndex]
    const topX = block.x + 50.5 - frameWidth / 2
    const leftX = block.x + 35.2 - frameWidth / 2
    const rightX = block.x + 65.8 - frameWidth / 2
    const circleTopY = block.y + 13.2
    const partY = block.y + 34.4
    const answerX = question.missing === 'total'
      ? topX
      : question.missing === 'left'
        ? leftX
        : rightX
    const top = question.missing === 'total'
      ? circleTopY - style.height / 2
      : partY - style.height / 2
    return { block, answerX, top }
  }

  return {
    block,
    answerX: commonRightX,
    top: block.y + block.height - style.height - 2.9
  }
}

function digitPlaceName(slotCount, digitIndex) {
  if (slotCount === 2) return digitIndex === 0 ? 'tens' : 'ones'
  if (slotCount === 3) return ['hundreds', 'tens', 'ones'][digitIndex]
  return `slot_${digitIndex}`
}

function problemLabel(question) {
  if (question.prompt) return question.prompt
  if (question.lines) return question.lines.join(' ')
  if (question.topNumber != null) return `${question.topNumber} ${question.operator} ${question.bottomNumber}`
  return ''
}

function buildLayout(sheet) {
  const boxes = []
  const answerKey = []
  const questionGroups = []
  const questionRegions = []
  const workRegions = []
  const style = boxStyleForSlots(sheet.answerSlots)

  sheet.questions.forEach((question, qIndex) => {
    const digits = canonicalDigitCells(question.answer, sheet.answerSlots)
    const acceptedResponses = acceptedDigitResponses(question.answer, sheet.answerSlots)
    const geometry = answerGeometry(sheet, qIndex)
    const block = geometry.block
    const digitBoxIds = []

    digits.forEach((digit, digitIndex) => {
      const id = boxes.length
      const left = geometry.answerX + digitIndex * (style.width + style.gap)
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
      problem: problemLabel(question),
      answer: question.answer,
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

    questionRegions.push({
      question_num: qIndex + 1,
      layout_family: sheet.family,
      x: normalizeX(block.x),
      y: normalizeY(block.y),
      width: normalizeX(block.width),
      height: normalizeY(block.height),
      letter_bubble: {
        x: normalizeX(block.bubbleX),
        y: normalizeY(block.bubbleY)
      }
    })

    if (['fact_rows', 'work_cards', 'ten_frames', 'dot_collections'].includes(sheet.family)) {
      workRegions.push({
        question_num: qIndex + 1,
        x: normalizeX(block.contentX),
        y: normalizeY(block.y + 17),
        width: normalizeX(block.width - 20),
        height: normalizeY(Math.max(8, geometry.top - block.y - 19.4)),
        graded: false
      })
    }
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
    question_regions: questionRegions,
    work_regions: workRegions,
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
      layout_family: sheet.family,
      total_questions: sheet.questions.length,
      answer_box_count: boxes.length,
      printed_text_font_family: 'Lexend',
      required_font_files: worksheetFonts.map((font) => `public/fonts/${font.file}`),
      digit_box_width_mm: style.width,
      digit_box_height_mm: style.height,
      answer_slots_per_question: sheet.answerSlots,
      marker_size_mm: marker.size,
      curriculum_probe: true,
      curriculum_probe_v2: true,
      curriculum_note: sheet.curriculum,
      grading_policy: {
        answer_slots_per_question: sheet.answerSlots,
        graded_region: 'final_numeric_answer_boxes_only',
        work_space_graded: false,
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

function answerFrame(sheet, layout, questionIndex, geometry) {
  const style = boxStyleForSlots(sheet.answerSlots)
  const ids = layout.question_groups[questionIndex].digit_box_ids.join(',')
  return `${dividerLines(sheet, geometry)}
      <rect class="answer-box" data-question-boxes="${ids}" x="${trimNumber(geometry.answerX)}" y="${trimNumber(geometry.top)}" width="${trimNumber(answerFrameWidth(sheet.answerSlots))}" height="${trimNumber(style.height)}" />`
}

function questionBubble(block, letter) {
  return `<g class="scantron-question-label" transform="translate(${trimNumber(block.bubbleX)} ${trimNumber(block.bubbleY)})">
        <ellipse class="scantron-bubble" cx="0" cy="0" rx="3.88" ry="3.02" />
        <text class="scantron-letter" x="0" y="0.25" text-anchor="middle">${escapeXml(letter)}</text>
      </g>`
}

function drawFactRow(sheet, layout, question, qIndex, geometry) {
  const block = geometry.block
  const prompt = `${question.prompt} =`
  return `
    <g class="question fact-row" data-question="${qIndex + 1}">
      ${questionBubble(block, questionLetter(qIndex))}
      <text class="problem-text" x="${trimNumber(block.contentX)}" y="${trimNumber(block.y + 14.2)}">${escapeXml(prompt)}</text>
      <line class="work-line" x1="${trimNumber(block.contentX)}" y1="${trimNumber(block.y + 25.9)}" x2="${trimNumber(geometry.answerX - 5.5)}" y2="${trimNumber(block.y + 25.9)}" />
      ${answerFrame(sheet, layout, qIndex, geometry)}
    </g>`
}

function tenFrameMarkup(block, count) {
  const cell = 5.4
  const gapX = 4.2
  const frameWidth = 5 * cell
  const frameHeight = 2 * cell
  const startX = block.contentX + 4.5
  const startY = block.y + 14.5
  const frameStarts = [
    { x: startX, y: startY },
    { x: startX + frameWidth + gapX, y: startY }
  ]
  const pieces = []
  frameStarts.forEach((frame, frameIndex) => {
    pieces.push(`<rect class="ten-frame-outline" x="${trimNumber(frame.x)}" y="${trimNumber(frame.y)}" width="${trimNumber(frameWidth)}" height="${trimNumber(frameHeight)}" />`)
    for (let col = 1; col < 5; col++) {
      const x = frame.x + col * cell
      pieces.push(`<line class="ten-frame-line" x1="${trimNumber(x)}" y1="${trimNumber(frame.y)}" x2="${trimNumber(x)}" y2="${trimNumber(frame.y + frameHeight)}" />`)
    }
    const midY = frame.y + cell
    pieces.push(`<line class="ten-frame-line" x1="${trimNumber(frame.x)}" y1="${trimNumber(midY)}" x2="${trimNumber(frame.x + frameWidth)}" y2="${trimNumber(midY)}" />`)
    const frameCount = Math.max(0, Math.min(10, count - frameIndex * 10))
    for (let dot = 0; dot < frameCount; dot++) {
      const row = dot >= 5 ? 1 : 0
      const col = dot % 5
      pieces.push(`<circle class="counter-dot" cx="${trimNumber(frame.x + col * cell + cell / 2)}" cy="${trimNumber(frame.y + row * cell + cell / 2)}" r="1.65" />`)
    }
  })
  return pieces.join('\n      ')
}

function drawTenFrame(sheet, layout, question, qIndex, geometry) {
  const block = geometry.block
  return `
    <g class="question visual-card" data-question="${qIndex + 1}">
      ${questionBubble(block, questionLetter(qIndex))}
      <text class="prompt-small" x="${trimNumber(block.contentX + 4.5)}" y="${trimNumber(block.y + 8.4)}">${escapeXml(question.prompt)}</text>
      ${tenFrameMarkup(block, question.count)}
      ${answerFrame(sheet, layout, qIndex, geometry)}
    </g>`
}

function dotCollectionMarkup(block, count, questionIndex) {
  const cols = count > 15 ? 5 : 4
  const spacingX = count > 15 ? 8.4 : 9.4
  const spacingY = 7.7
  const startX = block.contentX + 7.8
  const startY = block.y + 14.2
  const pieces = []
  for (let index = 0; index < count; index++) {
    const row = Math.floor(index / cols)
    const col = index % cols
    const offset = ((row + questionIndex) % 2) * 1.2
    pieces.push(`<circle class="counter-dot" cx="${trimNumber(startX + col * spacingX + offset)}" cy="${trimNumber(startY + row * spacingY)}" r="1.85" />`)
  }
  return pieces.join('\n      ')
}

function drawDotCollection(sheet, layout, question, qIndex, geometry) {
  const block = geometry.block
  return `
    <g class="question visual-card" data-question="${qIndex + 1}">
      ${questionBubble(block, questionLetter(qIndex))}
      <text class="prompt-small" x="${trimNumber(block.contentX)}" y="${trimNumber(block.y + 8.4)}">${escapeXml(question.prompt)}</text>
      ${dotCollectionMarkup(block, question.count, qIndex)}
      ${answerFrame(sheet, layout, qIndex, geometry)}
    </g>`
}

function knownCircle(cx, cy, value) {
  return `<circle class="bond-circle" cx="${trimNumber(cx)}" cy="${trimNumber(cy)}" r="7.2" />
      <text class="bond-number" x="${trimNumber(cx)}" y="${trimNumber(cy + 0.35)}" text-anchor="middle">${escapeXml(value)}</text>`
}

function drawNumberBond(sheet, layout, question, qIndex, geometry) {
  const block = geometry.block
  const top = { cx: block.x + 50.5, cy: block.y + 13.2 }
  const left = { cx: block.x + 35.2, cy: block.y + 34.4 }
  const right = { cx: block.x + 65.8, cy: block.y + 34.4 }
  const total = question.total ?? question.answer
  const leftValue = question.parts[0]
  const rightValue = question.parts[1]
  const topMarkup = question.missing === 'total' ? '' : knownCircle(top.cx, top.cy, total)
  const leftMarkup = question.missing === 'left' ? '' : knownCircle(left.cx, left.cy, leftValue)
  const rightMarkup = question.missing === 'right' ? '' : knownCircle(right.cx, right.cy, rightValue)
  return `
    <g class="question number-bond-card" data-question="${qIndex + 1}">
      ${questionBubble(block, questionLetter(qIndex))}
      <line class="bond-line" x1="${trimNumber(top.cx - 4.2)}" y1="${trimNumber(top.cy + 6.5)}" x2="${trimNumber(left.cx + 3.2)}" y2="${trimNumber(left.cy - 6.4)}" />
      <line class="bond-line" x1="${trimNumber(top.cx + 4.2)}" y1="${trimNumber(top.cy + 6.5)}" x2="${trimNumber(right.cx - 3.2)}" y2="${trimNumber(right.cy - 6.4)}" />
      ${topMarkup}
      ${leftMarkup}
      ${rightMarkup}
      ${answerFrame(sheet, layout, qIndex, geometry)}
    </g>`
}

function drawPattern(sheet, layout, question, qIndex, geometry) {
  const block = geometry.block
  const afterX = geometry.answerX + answerFrameWidth(sheet.answerSlots) + 2.6
  return `
    <g class="question pattern-card" data-question="${qIndex + 1}">
      ${questionBubble(block, questionLetter(qIndex))}
      <text class="pattern-label" x="${trimNumber(block.contentX)}" y="${trimNumber(block.y + 9)}">Fill the missing number.</text>
      <text class="pattern-text" x="${trimNumber(geometry.answerX - 2.5)}" y="${trimNumber(geometry.top + 9.05)}" text-anchor="end">${escapeXml(question.prefix)}</text>
      ${answerFrame(sheet, layout, qIndex, geometry)}
      <text class="pattern-text" x="${trimNumber(afterX)}" y="${trimNumber(geometry.top + 9.05)}">${escapeXml(question.suffix)}</text>
      <line class="work-line" x1="${trimNumber(block.contentX)}" y1="${trimNumber(block.y + 43)}" x2="${trimNumber(block.x + block.width - 8)}" y2="${trimNumber(block.y + 43)}" />
    </g>`
}

function drawStacked(sheet, layout, question, qIndex, geometry) {
  const block = geometry.block
  const centerX = geometry.answerX + answerFrameWidth(sheet.answerSlots) / 2
  const underlineY = geometry.top - 2.6
  const numberX = centerX + 4.2
  return `
    <g class="question stacked-card" data-question="${qIndex + 1}">
      ${questionBubble(block, questionLetter(qIndex))}
      <text class="stacked-number" x="${trimNumber(numberX)}" y="${trimNumber(block.y + 10.7)}" text-anchor="end">${escapeXml(question.topNumber)}</text>
      <text class="stacked-operator" x="${trimNumber(centerX - 16.6)}" y="${trimNumber(block.y + 22.2)}" text-anchor="middle">${escapeXml(question.operator)}</text>
      <text class="stacked-number" x="${trimNumber(numberX)}" y="${trimNumber(block.y + 22.2)}" text-anchor="end">${escapeXml(question.bottomNumber)}</text>
      <line class="stacked-line" x1="${trimNumber(geometry.answerX - 1.2)}" y1="${trimNumber(underlineY)}" x2="${trimNumber(geometry.answerX + answerFrameWidth(sheet.answerSlots) + 1.2)}" y2="${trimNumber(underlineY)}" />
      ${answerFrame(sheet, layout, qIndex, geometry)}
      <line class="work-line" x1="${trimNumber(block.contentX)}" y1="${trimNumber(block.y + 45.4)}" x2="${trimNumber(block.x + block.width - 8)}" y2="${trimNumber(block.y + 45.4)}" />
    </g>`
}

function drawWorkCard(sheet, layout, question, qIndex, geometry) {
  const block = geometry.block
  const lines = question.lines ?? [question.prompt]
  const textLines = lines.map((line, lineIndex) =>
    `<text class="problem-text work-card-prompt" x="${trimNumber(block.contentX)}" y="${trimNumber(block.y + 9.5 + lineIndex * 6.1)}">${escapeXml(line)}</text>`
  ).join('\n      ')
  return `
    <g class="question work-card" data-question="${qIndex + 1}">
      ${questionBubble(block, questionLetter(qIndex))}
      ${textLines}
      <rect class="student-work-area" x="${trimNumber(block.contentX)}" y="${trimNumber(block.y + 17)}" width="${trimNumber(block.width - 20.2)}" height="${trimNumber(Math.max(8, geometry.top - block.y - 19.4))}" rx="1.6" />
      ${answerFrame(sheet, layout, qIndex, geometry)}
    </g>`
}

function drawQuestion(sheet, layout, question, qIndex) {
  const geometry = answerGeometry(sheet, qIndex)
  if (sheet.family === 'fact_rows') return drawFactRow(sheet, layout, question, qIndex, geometry)
  if (sheet.family === 'ten_frames') return drawTenFrame(sheet, layout, question, qIndex, geometry)
  if (sheet.family === 'dot_collections') return drawDotCollection(sheet, layout, question, qIndex, geometry)
  if (sheet.family === 'number_bonds') return drawNumberBond(sheet, layout, question, qIndex, geometry)
  if (sheet.family === 'patterns') return drawPattern(sheet, layout, question, qIndex, geometry)
  if (sheet.family === 'stacked') return drawStacked(sheet, layout, question, qIndex, geometry)
  if (sheet.family === 'work_cards') return drawWorkCard(sheet, layout, question, qIndex, geometry)
  throw new Error(`Unsupported family ${sheet.family}`)
}

function buildSvg(sheet, layout, qrBase64, payloadString) {
  const rows = sheet.questions.map((question, index) => drawQuestion(sheet, layout, question, index)).join('\n')
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
      .name-label, .sheet-title, .sheet-subtitle, .problem-text, .prompt-small, .scantron-letter, .qr-label, .pattern-label, .pattern-text, .bond-number, .stacked-number, .stacked-operator, .qr-sheet-code {
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
      .problem-text { font-size: 6.05px; font-weight: 430; }
      .prompt-small { font-size: 4.55px; font-weight: 560; }
      .scantron-letter { dominant-baseline: middle; font-size: 4.45px; font-weight: 600; fill: #626b74; }
      .scantron-bubble { fill: none; stroke: #c4c8ce; stroke-width: 0.34; }
      .answer-box { fill: none; stroke: #111; stroke-width: 0.54; shape-rendering: geometricPrecision; }
      .open-divider-guide { fill: none; stroke: #707780; stroke-width: ${digitGuide.stroke}; stroke-linecap: round; }
      .work-line { stroke: #d6d9de; stroke-width: 0.48; stroke-linecap: round; }
      .student-work-area { fill: none; stroke: #e1e4e8; stroke-width: 0.42; stroke-dasharray: 1.2 1.4; }
      .ten-frame-outline, .ten-frame-line { fill: none; stroke: #3c4043; stroke-width: 0.42; }
      .counter-dot { fill: #222; }
      .bond-line { stroke: #9aa0a6; stroke-width: 0.58; stroke-linecap: round; }
      .bond-circle { fill: none; stroke: #3c4043; stroke-width: 0.52; }
      .bond-number { font-size: 5.7px; font-weight: 560; dominant-baseline: middle; }
      .pattern-label { font-size: 4.2px; font-weight: 520; fill: #5f6368; }
      .pattern-text { font-size: 5.4px; font-weight: 500; dominant-baseline: middle; }
      .stacked-number { font-size: 6.15px; font-weight: 520; }
      .stacked-operator { font-size: 6.15px; font-weight: 620; }
      .stacked-line { stroke: #111; stroke-width: 0.55; stroke-linecap: round; }
      .qr-label { font-size: 3.2px; }
      .qr-label-name { fill: #202124; font-weight: 650; }
      .qr-label-domain { fill: #6e6e73; font-weight: 420; }
      .qr-sheet-code { font-size: 3.05px; fill: #555; font-weight: 400; }
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
${rows}
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
    const rows = sheet.questions.map((question, index) => `
        <tr>
          <td>${questionLetter(index)}</td>
          <td>${escapeHtml(problemLabel(question))}</td>
          <td>${question.answer}</td>
        </tr>`).join('')
    return `
      <section class="sheet">
        <h2>${escapeHtml(sheet.humanCode)} ${escapeHtml(sheet.title)}</h2>
        <p>Grade ${sheet.grade}. ${escapeHtml(sheet.family)}. ${escapeHtml(sheet.curriculum)}</p>
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
    <title>ScanGrade Grade 1-2 Curriculum Probe V2 Answer Key</title>
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
    <h1>ScanGrade Grade 1-2 Curriculum Probe V2 Answer Key</h1>
    <p class="intro">Generated ${escapeHtml(registry.generated_at)}. The packet tests multiple worksheet formats. Score OCR against what the student wrote in the final answer boxes.</p>
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
          <p>Grade ${template.grade_level}. ${escapeHtml(template.layout_family)}. ${template.total_questions} questions. ${template.answer_slots_per_question} answer slots per question.</p>
          <p><a href="./${escapeHtml(template.filename)}" target="_blank" rel="noreferrer">SVG</a> <a href="./layouts/${escapeHtml(template.layout_id)}.json" target="_blank" rel="noreferrer">Layout JSON</a></p>
        </div>
      </article>`).join('\n')

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>ScanGrade Grade 1-2 Curriculum Probe V2</title>
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
      .intro { max-width: 870px; margin: 0 0 22px; color: #626970; line-height: 1.45; }
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
      <h1>ScanGrade Grade 1-2 Curriculum Probe V2</h1>
      <p class="intro">Ten worksheet formats for classroom stress testing: short facts, visual counting, number bonds, missing-number patterns, stacked algorithms, and work-card layouts. ScanGrade grades only the final numeric answer boxes.</p>
      <div class="actions">
        <a class="action" href="./printables/ScanGrade-Grade1-2-Curriculum-Probe-V2-Packet.pdf" target="_blank" rel="noreferrer">Open print packet PDF</a>
        <a class="action" href="./printables/ScanGrade-Grade1-2-Curriculum-Probe-V2-Answer-Key.pdf" target="_blank" rel="noreferrer">Open answer key PDF</a>
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
  purpose: 'Grade 1-2 curriculum versatility probe V2. Not a launch claim.',
  source_doc: 'docs/CURRICULUM_PROBE_G1_G2_V2_PLAN.md',
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
    worksheet_url: `worksheets/curriculum-probe-g1-g2-v2/${sheet.filename}`,
    layout_url: `layouts/${sheet.id}.json`,
    probe_layout_url: `worksheets/curriculum-probe-g1-g2-v2/layouts/${sheet.id}.json`,
    qr_payload_url: payloadString,
    grade_level: sheet.grade,
    layout_family: sheet.family,
    curriculum_note: sheet.curriculum,
    total_questions: sheet.questions.length,
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
    join(printableDir, 'ScanGrade-Grade1-2-Curriculum-Probe-V2-Packet.pdf')
  )
  await writePdf(
    pageHandle,
    answerKey,
    join(printableDir, 'ScanGrade-Grade1-2-Curriculum-Probe-V2-Answer-Key.pdf')
  )
} finally {
  await browser.close()
}

console.log(`Generated ${sheets.length} Grade 1-2 curriculum probe V2 worksheets.`)
console.log(`Index: ${join(outDir, 'index.html')}`)
console.log(`Packet: ${join(printableDir, 'ScanGrade-Grade1-2-Curriculum-Probe-V2-Packet.pdf')}`)
