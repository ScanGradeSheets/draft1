import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import QRCode from 'qrcode'
import { chromium } from 'playwright'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const outDir = join(root, 'public', 'worksheets', 'grade1-last-week-test-20260617')
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
const worksheetFont = {
  family: 'Lexend',
  file: 'Lexend-wght.ttf',
  weight: '100 900'
}
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

const boxStyle = {
  width: 13.4,
  height: 16.55,
  gap: 1,
  stroke: 0.54
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
    id: 'sg-g1-lw-01-add-1digit',
    humanCode: 'SG-G1-LW-01',
    title: 'Addition: Single-Digit Answers',
    subtitle: 'Find each sum.',
    filename: 'lw01-grade1-addition-single-digit-answers.svg',
    family: 'fact_rows',
    answerSlots: 1,
    questions: [
      { prompt: '2 + 3', answer: 5 },
      { prompt: '4 + 2', answer: 6 },
      { prompt: '1 + 7', answer: 8 },
      { prompt: '5 + 4', answer: 9 },
      { prompt: '3 + 3', answer: 6 },
      { prompt: '6 + 2', answer: 8 },
      { prompt: '7 + 1', answer: 8 },
      { prompt: '2 + 5', answer: 7 }
    ]
  },
  {
    id: 'sg-g1-lw-02-add-2digit',
    humanCode: 'SG-G1-LW-02',
    title: 'Addition: Two-Digit Answers',
    subtitle: 'Find each sum.',
    filename: 'lw02-grade1-addition-two-digit-answers.svg',
    family: 'fact_rows',
    questions: [
      { prompt: '6 + 5', answer: 11 },
      { prompt: '8 + 4', answer: 12 },
      { prompt: '9 + 6', answer: 15 },
      { prompt: '7 + 8', answer: 15 },
      { prompt: '5 + 9', answer: 14 },
      { prompt: '8 + 8', answer: 16 },
      { prompt: '9 + 9', answer: 18 },
      { prompt: '10 + 7', answer: 17 }
    ]
  },
  {
    id: 'sg-g1-lw-03-sub-1digit',
    humanCode: 'SG-G1-LW-03',
    title: 'Subtraction: Single-Digit Answers',
    subtitle: 'Find each difference.',
    filename: 'lw03-grade1-subtraction-single-digit-answers.svg',
    family: 'fact_rows',
    answerSlots: 1,
    questions: [
      { prompt: '9 - 4', answer: 5 },
      { prompt: '8 - 2', answer: 6 },
      { prompt: '10 - 3', answer: 7 },
      { prompt: '7 - 5', answer: 2 },
      { prompt: '11 - 6', answer: 5 },
      { prompt: '12 - 4', answer: 8 },
      { prompt: '14 - 9', answer: 5 },
      { prompt: '13 - 7', answer: 6 }
    ]
  },
  {
    id: 'sg-g1-lw-04-sub-2digit',
    humanCode: 'SG-G1-LW-04',
    title: 'Subtraction: Two-Digit Answers',
    subtitle: 'Find each difference.',
    filename: 'lw04-grade1-subtraction-two-digit-answers.svg',
    family: 'fact_rows',
    questions: [
      { prompt: '20 - 8', answer: 12 },
      { prompt: '19 - 4', answer: 15 },
      { prompt: '18 - 1', answer: 17 },
      { prompt: '20 - 6', answer: 14 },
      { prompt: '17 - 2', answer: 15 },
      { prompt: '19 - 2', answer: 17 },
      { prompt: '18 - 2', answer: 16 },
      { prompt: '20 - 2', answer: 18 }
    ]
  },
  {
    id: 'sg-g1-lw-05-mixed-20',
    humanCode: 'SG-G1-LW-05',
    title: 'Mixed Addition and Subtraction',
    subtitle: 'Add or subtract.',
    filename: 'lw05-grade1-mixed-add-sub-within-20.svg',
    family: 'fact_rows',
    answerSlots: 2,
    questions: [
      { prompt: '7 + 5', answer: 12 },
      { prompt: '16 - 9', answer: 7 },
      { prompt: '8 + 6', answer: 14 },
      { prompt: '15 - 6', answer: 9 },
      { prompt: '9 + 4', answer: 13 },
      { prompt: '18 - 7', answer: 11 },
      { prompt: '6 + 8', answer: 14 },
      { prompt: '20 - 5', answer: 15 }
    ]
  },
  {
    id: 'sg-g1-lw-06-ten-frames',
    humanCode: 'SG-G1-LW-06',
    title: 'Ten Frames to 20',
    subtitle: 'Count the ten frames.',
    filename: 'lw06-grade1-ten-frames-to-20.svg',
    family: 'ten_frames',
    answerSlots: 2,
    questions: [
      { prompt: 'How many?', count: 6, answer: 6 },
      { prompt: 'How many?', count: 10, answer: 10 },
      { prompt: 'How many?', count: 11, answer: 11 },
      { prompt: 'How many?', count: 14, answer: 14 },
      { prompt: 'How many?', count: 17, answer: 17 },
      { prompt: 'How many?', count: 20, answer: 20 }
    ]
  },
  {
    id: 'sg-g1-lw-07-dot-collections',
    humanCode: 'SG-G1-LW-07',
    title: 'Dot Collections to 20',
    subtitle: 'Count the dots.',
    filename: 'lw07-grade1-dot-collections-to-20.svg',
    family: 'dot_collections',
    answerSlots: 2,
    questions: [
      { prompt: 'How many dots?', count: 5, answer: 5 },
      { prompt: 'How many dots?', count: 8, answer: 8 },
      { prompt: 'How many dots?', count: 12, answer: 12 },
      { prompt: 'How many dots?', count: 13, answer: 13 },
      { prompt: 'How many dots?', count: 16, answer: 16 },
      { prompt: 'How many dots?', count: 19, answer: 19 }
    ]
  },
  {
    id: 'sg-g1-lw-08-number-bonds',
    humanCode: 'SG-G1-LW-08',
    title: 'Number Bonds to 20',
    subtitle: 'Find the missing number.',
    filename: 'lw08-grade1-number-bonds-to-20.svg',
    family: 'number_bonds',
    questions: [
      { parts: [4, 5], missing: 'total', answer: 9 },
      { total: 12, parts: [7, null], missing: 'right', answer: 5 },
      { parts: [8, 6], missing: 'total', answer: 14 },
      { total: 15, parts: [9, null], missing: 'right', answer: 6 },
      { parts: [10, 7], missing: 'total', answer: 17 },
      { total: 20, parts: [11, null], missing: 'right', answer: 9 }
    ]
  },
  {
    id: 'sg-g1-lw-09-number-patterns',
    humanCode: 'SG-G1-LW-09',
    title: 'Number Patterns',
    subtitle: 'Fill in the missing number.',
    filename: 'lw09-grade1-number-patterns.svg',
    family: 'patterns',
    answerSlots: 2,
    questions: [
      { prefix: '2, 4,', suffix: ', 8', answer: 6 },
      { prefix: '5, 10,', suffix: ', 20', answer: 15 },
      { prefix: '9, 10,', suffix: ', 12', answer: 11 },
      { prefix: '20, 18,', suffix: ', 14', answer: 16 },
      { prefix: '3, 6, 9,', suffix: '', answer: 12 },
      { prefix: '30, 35,', suffix: ', 45', answer: 40 }
    ]
  },
  {
    id: 'sg-g1-lw-10-place-value-50',
    humanCode: 'SG-G1-LW-10',
    title: 'Place Value and Number Sense',
    subtitle: 'Write the number.',
    filename: 'lw10-grade1-place-value-number-sense.svg',
    family: 'work_cards',
    questions: [
      { lines: ['3 tens + 4'], answer: 34 },
      { lines: ['after 39'], answer: 40 },
      { lines: ['before 50'], answer: 49 },
      { lines: ['greater:', '27 or 32'], answer: 32 },
      { lines: ['10 + 10 + 10'], answer: 30 },
      { lines: ['40 + 7'], answer: 47 }
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

function answerSlotCount(sheet, question) {
  if (question.answer_slots != null) return question.answer_slots
  if (sheet.answerSlots != null) return sheet.answerSlots
  return Math.min(2, Math.max(1, digitArray(question.answer).length))
}

function canonicalDigitCells(answer, slotCount) {
  const digits = digitArray(answer)
  if (digits.length > slotCount) throw new Error(`Answer ${answer} does not fit ${slotCount} slots.`)
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
  const responses = [Array(slotCount - digits.length).fill(null).concat(digits)]
  if (slotCount === 2 && digits.length === 1) {
    responses.push([0, digits[0]])
    responses.push([digits[0], null])
  }
  return uniqueResponseList(responses).map((digitsForResponse) => ({
    label: digitsForResponse.map((digit) => digit == null ? '_' : String(digit)).join(''),
    digits: digitsForResponse,
    meaning: 'accepted numeric placement for young-student handwriting'
  }))
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

function worksheetFontCss() {
  const fontPath = join(root, 'public', 'fonts', worksheetFont.file)
  if (!existsSync(fontPath)) {
    throw new Error(`Missing printed worksheet font file: public/fonts/${worksheetFont.file}`)
  }
  const source = `data:font/truetype;base64,${readFileSync(fontPath).toString('base64')}`
  return `
      @font-face {
        font-family: "${worksheetFont.family}";
        src: url("${source}") format("truetype");
        font-style: normal;
        font-weight: ${worksheetFont.weight};
      }`
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

function questionLetter(index) {
  return String.fromCharCode(65 + index)
}

function answerFrameWidth(slotCount) {
  return boxStyle.width * slotCount + boxStyle.gap * Math.max(0, slotCount - 1)
}

function estimatedPrintedTextWidth(value) {
  return String(value).split('').reduce((width, character) => {
    if (character === ' ') return width + 1.7
    if (/[0-9]/.test(character)) return width + 3.5
    if (/[,+\-:=?]/.test(character)) return width + 2.9
    return width + 3.25
  }, 0)
}

function closeBubbleX(blockX, textStartX, preferredGap = 7.4) {
  const minimum = blockX + 4.8
  return Math.max(minimum, textStartX - preferredGap)
}

function factRowBubbleX(sheet, questionIndex, blockX, blockWidth) {
  const col = questionIndex < 4 ? 0 : 1
  const starts = sheet.questions
    .map((question, index) => ({ question, index }))
    .filter(({ index }) => (index < 4 ? 0 : 1) === col)
    .map(({ question }) => {
      const slotCount = answerSlotCount(sheet, question)
      const frameWidth = answerFrameWidth(slotCount)
      const answerX = blockX + blockWidth - frameWidth - 6
      const textEndX = answerX - 2.4
      return textEndX - estimatedPrintedTextWidth(`${question.prompt} =`)
    })
  return closeBubbleX(blockX, Math.min(...starts), 10.2)
}

function patternBubbleX(sheet, questionIndex, blockX) {
  const col = questionIndex < 3 ? 0 : 1
  const starts = sheet.questions
    .map((question, index) => ({ question, index }))
    .filter(({ index }) => (index < 3 ? 0 : 1) === col)
    .map(({ question }) => blockX + 41 - 2.5 - estimatedPrintedTextWidth(question.prefix))
  return closeBubbleX(blockX, Math.min(...starts), 6.8)
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
      bubbleX: factRowBubbleX(sheet, questionIndex, x, width),
      bubbleY: y + height / 2,
      contentX: x + 14.2
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
    bubbleX: sheet.family === 'patterns'
      ? patternBubbleX(sheet, questionIndex, x)
      : sheet.family === 'number_bonds'
        ? x + 15.7
        : sheet.family === 'ten_frames' || sheet.family === 'dot_collections'
          ? x + 8.7
          : x + 6.4,
    bubbleY: y + height / 2,
    contentX: x + 14.2
  }
}

function answerGeometry(sheet, questionIndex) {
  const question = sheet.questions[questionIndex]
  const slotCount = answerSlotCount(sheet, question)
  const block = gridBlock(sheet, questionIndex)
  const frameWidth = answerFrameWidth(slotCount)
  const commonRightX = block.x + block.width - frameWidth - 6

  if (sheet.family === 'fact_rows') {
    return {
      block,
      slotCount,
      frameWidth,
      answerX: commonRightX,
      top: block.y + block.height / 2 - boxStyle.height / 2
    }
  }

  if (sheet.family === 'patterns') {
    return {
      block,
      slotCount,
      frameWidth,
      answerX: block.x + 41,
      top: block.bubbleY - boxStyle.height / 2
    }
  }

  if (sheet.family === 'ten_frames' || sheet.family === 'dot_collections' || sheet.family === 'work_cards') {
    return {
      block,
      slotCount,
      frameWidth,
      answerX: commonRightX,
      top: block.bubbleY - boxStyle.height / 2
    }
  }

  if (sheet.family === 'number_bonds') {
    const topX = block.x + 50.5 - frameWidth / 2
    const rightX = block.x + 65.8 - frameWidth / 2
    const circleTopY = block.y + 13.2
    const partY = block.y + 34.4
    return {
      block,
      slotCount,
      frameWidth,
      answerX: question.missing === 'total' ? topX : rightX,
      top: question.missing === 'total' ? circleTopY - boxStyle.height / 2 : partY - boxStyle.height / 2
    }
  }

  return {
    block,
    slotCount,
    frameWidth,
    answerX: commonRightX,
    top: block.y + block.height - boxStyle.height - 2.9
  }
}

function problemLabel(question) {
  if (question.prompt) return question.prompt
  if (question.lines) return question.lines.join(' ')
  if (question.prefix != null) return `${question.prefix} __${question.suffix}`
  if (question.parts) return question.missing === 'total'
    ? `${question.parts[0]} + ${question.parts[1]}`
    : `${question.total} - ${question.parts[0]}`
  return ''
}

function buildLayout(sheet) {
  const boxes = []
  const answerKey = []
  const questionGroups = []
  const questionRegions = []
  const workRegions = []

  sheet.questions.forEach((question, qIndex) => {
    const slotCount = answerSlotCount(sheet, question)
    const digits = canonicalDigitCells(question.answer, slotCount)
    const geometry = answerGeometry(sheet, qIndex)
    const block = geometry.block
    const digitBoxIds = []

    digits.forEach((digit, digitIndex) => {
      const id = boxes.length
      const left = geometry.answerX + digitIndex * (boxStyle.width + boxStyle.gap)
      const top = geometry.top
      boxes.push({
        id,
        question_num: qIndex + 1,
        digit_index: digitIndex,
        digit_place: slotCount === 1 ? 'ones' : digitIndex === 0 ? 'tens' : 'ones',
        x: normalizeX(left + boxStyle.width),
        y: normalizeY(top + boxStyle.height),
        width: normalizeX(boxStyle.width),
        height: normalizeY(boxStyle.height),
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
        type: slotCount === 1 ? 'single_slot' : 'open_divider',
        slot_count: slotCount,
        printed: slotCount > 1,
        x_values: slotCount > 1 ? [normalizeX(geometry.answerX + boxStyle.width + boxStyle.gap / 2)] : [],
        y1: normalizeY(geometry.top),
        y2: normalizeY(geometry.top + boxStyle.height)
      },
      accepted_digit_responses: acceptedDigitResponses(question.answer, slotCount)
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

  const slotCounts = sheet.questions.map((question) => answerSlotCount(sheet, question))
  const uniqueSlotCounts = [...new Set(slotCounts)]

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
      grade_level: 1,
      layout_family: sheet.family,
      total_questions: sheet.questions.length,
      answer_box_count: boxes.length,
      printed_text_font_family: 'Lexend',
      required_font_files: [`public/fonts/${worksheetFont.file}`],
      digit_box_width_mm: boxStyle.width,
      digit_box_height_mm: boxStyle.height,
      answer_slots_per_question: uniqueSlotCounts.length === 1 ? uniqueSlotCounts[0] : 'variable',
      answer_slot_counts: slotCounts,
      marker_size_mm: marker.size,
      classroom_test_packet: true,
      classroom_test_packet_date: '2026-06-17',
      annotation_zones: {
        date_stamp: { x: 0.695, y: 0.17, width: 0.175, height: 0.07 },
      },
      grading_policy: {
        answer_slots_per_question: uniqueSlotCounts.length === 1 ? uniqueSlotCounts[0] : 'variable',
        answer_slot_counts: slotCounts,
        graded_region: 'final_numeric_answer_boxes_only',
        work_space_graded: false,
        printed_digit_split_guide: 'one-slot boxes have no divider; two-slot boxes use open center divider notches',
        blank_digit_value: null,
        shorter_answers_accept_left_or_right_placement: uniqueSlotCounts.includes(2)
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

function dividerLines(geometry) {
  if (geometry.slotCount === 1) return ''
  const top = geometry.top
  const bottom = geometry.top + boxStyle.height
  const upperEnd = top + digitGuide.markLength
  const lowerStart = bottom - digitGuide.markLength
  const x = geometry.answerX + boxStyle.width + boxStyle.gap / 2
  return `<line class="open-divider-guide" x1="${trimNumber(x)}" y1="${trimNumber(top)}" x2="${trimNumber(x)}" y2="${trimNumber(upperEnd)}" />
      <line class="open-divider-guide" x1="${trimNumber(x)}" y1="${trimNumber(lowerStart)}" x2="${trimNumber(x)}" y2="${trimNumber(bottom)}" />`
}

function answerFrame(layout, questionIndex, geometry) {
  const ids = layout.question_groups[questionIndex].digit_box_ids.join(',')
  return `${dividerLines(geometry)}
      <rect class="answer-box" data-question-boxes="${ids}" x="${trimNumber(geometry.answerX)}" y="${trimNumber(geometry.top)}" width="${trimNumber(geometry.frameWidth)}" height="${trimNumber(boxStyle.height)}" />`
}

function questionBubble(block, letter) {
  return `<g class="scantron-question-label" transform="translate(${trimNumber(block.bubbleX)} ${trimNumber(block.bubbleY)})">
        <ellipse class="scantron-bubble" cx="0" cy="0" rx="3.88" ry="3.02" />
        <text class="scantron-letter" x="0" y="0.25" text-anchor="middle">${escapeXml(letter)}</text>
      </g>`
}

function drawFactRow(sheet, layout, question, qIndex, geometry) {
  const block = geometry.block
  return `
    <g class="question fact-row" data-question="${qIndex + 1}">
      ${questionBubble(block, questionLetter(qIndex))}
      <text class="problem-text" x="${trimNumber(geometry.answerX - 2.4)}" y="${trimNumber(geometry.top + boxStyle.height / 2 + 0.35)}" text-anchor="end">${escapeXml(`${question.prompt} =`)}</text>
      ${answerFrame(layout, qIndex, geometry)}
    </g>`
}

function tenFrameMarkup(block, count) {
  const cell = 4.85
  const frameWidth = 5 * cell
  const frameHeight = 2 * cell
  const gapY = 4.1
  const totalHeight = frameHeight * 2 + gapY
  const startX = block.contentX + 4.2
  const startY = block.bubbleY - totalHeight / 2
  const frameStarts = [
    { x: startX, y: startY },
    { x: startX, y: startY + frameHeight + gapY }
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

function drawTenFrame(layout, question, qIndex, geometry) {
  const block = geometry.block
  return `
    <g class="question visual-card" data-question="${qIndex + 1}">
      ${questionBubble(block, questionLetter(qIndex))}
      ${tenFrameMarkup(block, question.count)}
      ${answerFrame(layout, qIndex, geometry)}
    </g>`
}

function dotCollectionMarkup(block, count, questionIndex) {
  const cols = 4
  const spacingX = 6.9
  const spacingY = 6.2
  const rows = Math.ceil(count / cols)
  const startX = block.contentX + 4.8
  const startY = block.bubbleY - ((rows - 1) * spacingY) / 2
  const pieces = []
  for (let index = 0; index < count; index++) {
    const row = Math.floor(index / cols)
    const col = index % cols
    const offset = ((row + questionIndex) % 2) * 1.2
    pieces.push(`<circle class="counter-dot" cx="${trimNumber(startX + col * spacingX + offset)}" cy="${trimNumber(startY + row * spacingY)}" r="1.85" />`)
  }
  return pieces.join('\n      ')
}

function drawDotCollection(layout, question, qIndex, geometry) {
  const block = geometry.block
  return `
    <g class="question visual-card" data-question="${qIndex + 1}">
      ${questionBubble(block, questionLetter(qIndex))}
      ${dotCollectionMarkup(block, question.count, qIndex)}
      ${answerFrame(layout, qIndex, geometry)}
    </g>`
}

function knownCircle(cx, cy, value) {
  return `<circle class="bond-circle" cx="${trimNumber(cx)}" cy="${trimNumber(cy)}" r="7.2" />
      <text class="bond-number" x="${trimNumber(cx)}" y="${trimNumber(cy + 0.35)}" text-anchor="middle">${escapeXml(value)}</text>`
}

function drawNumberBond(layout, question, qIndex, geometry) {
  const block = geometry.block
  const top = { cx: block.x + 50.5, cy: block.y + 13.2 }
  const left = { cx: block.x + 35.2, cy: block.y + 34.4 }
  const right = { cx: block.x + 65.8, cy: block.y + 34.4 }
  const answerCenter = {
    cx: geometry.answerX + geometry.frameWidth / 2,
    top: geometry.top,
    bottom: geometry.top + boxStyle.height
  }
  const topLineStart = question.missing === 'total'
    ? { x: answerCenter.cx, y: answerCenter.bottom - 0.1 }
    : { x: top.cx, y: top.cy + 7.7 }
  const rightLineEnd = question.missing === 'right'
    ? { x: answerCenter.cx, y: answerCenter.top + 0.1 }
    : { x: right.cx - 3.2, y: right.cy - 6.4 }
  const total = question.total ?? question.answer
  const topMarkup = question.missing === 'total' ? '' : knownCircle(top.cx, top.cy, total)
  const leftMarkup = knownCircle(left.cx, left.cy, question.parts[0])
  const rightMarkup = question.missing === 'right' ? '' : knownCircle(right.cx, right.cy, question.parts[1])
  return `
    <g class="question number-bond-card" data-question="${qIndex + 1}">
      ${questionBubble(block, questionLetter(qIndex))}
      <line class="bond-line" x1="${trimNumber(topLineStart.x)}" y1="${trimNumber(topLineStart.y)}" x2="${trimNumber(left.cx + 3.2)}" y2="${trimNumber(left.cy - 6.4)}" />
      <line class="bond-line" x1="${trimNumber(topLineStart.x)}" y1="${trimNumber(topLineStart.y)}" x2="${trimNumber(rightLineEnd.x)}" y2="${trimNumber(rightLineEnd.y)}" />
      ${topMarkup}
      ${leftMarkup}
      ${rightMarkup}
      ${answerFrame(layout, qIndex, geometry)}
    </g>`
}

function drawPattern(layout, question, qIndex, geometry) {
  const block = geometry.block
  const afterX = geometry.answerX + geometry.frameWidth + 2.6
  return `
    <g class="question pattern-card" data-question="${qIndex + 1}">
      ${questionBubble(block, questionLetter(qIndex))}
      <text class="pattern-text" x="${trimNumber(geometry.answerX - 2.5)}" y="${trimNumber(geometry.top + boxStyle.height / 2 + 0.35)}" text-anchor="end">${escapeXml(question.prefix)}</text>
      ${answerFrame(layout, qIndex, geometry)}
      <text class="pattern-text" x="${trimNumber(afterX)}" y="${trimNumber(geometry.top + boxStyle.height / 2 + 0.35)}">${escapeXml(question.suffix)}</text>
    </g>`
}

function drawWorkCard(layout, question, qIndex, geometry) {
  const block = geometry.block
  const lineGap = 6.1
  const firstLineY = block.bubbleY - ((question.lines.length - 1) * lineGap) / 2 + 0.35
  const textLines = question.lines.map((line, lineIndex) =>
    `<text class="problem-text work-card-prompt" x="${trimNumber(block.contentX)}" y="${trimNumber(firstLineY + lineIndex * lineGap)}">${escapeXml(line)}</text>`
  ).join('\n      ')
  return `
    <g class="question work-card" data-question="${qIndex + 1}">
      ${questionBubble(block, questionLetter(qIndex))}
      ${textLines}
      ${answerFrame(layout, qIndex, geometry)}
    </g>`
}

function drawQuestion(sheet, layout, question, qIndex) {
  const geometry = answerGeometry(sheet, qIndex)
  if (sheet.family === 'fact_rows') return drawFactRow(sheet, layout, question, qIndex, geometry)
  if (sheet.family === 'ten_frames') return drawTenFrame(layout, question, qIndex, geometry)
  if (sheet.family === 'dot_collections') return drawDotCollection(layout, question, qIndex, geometry)
  if (sheet.family === 'number_bonds') return drawNumberBond(layout, question, qIndex, geometry)
  if (sheet.family === 'patterns') return drawPattern(layout, question, qIndex, geometry)
  if (sheet.family === 'work_cards') return drawWorkCard(layout, question, qIndex, geometry)
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
      .name-label, .sheet-title, .sheet-subtitle, .problem-text, .prompt-small, .scantron-letter, .qr-label, .pattern-label, .pattern-text, .bond-number, .qr-sheet-code {
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
      .problem-text { font-size: 6.75px; font-weight: 430; dominant-baseline: middle; }
      .prompt-small { font-size: 4.85px; font-weight: 560; }
      .scantron-letter { dominant-baseline: middle; font-size: 4.45px; font-weight: 600; fill: #626b74; }
      .scantron-bubble { fill: none; stroke: #c4c8ce; stroke-width: 0.34; }
      .answer-box { fill: none; stroke: #111; stroke-width: ${boxStyle.stroke}; shape-rendering: geometricPrecision; }
      .open-divider-guide { fill: none; stroke: #707780; stroke-width: ${digitGuide.stroke}; stroke-linecap: round; }
      .work-line { stroke: #d6d9de; stroke-width: 0.48; stroke-linecap: round; }
      .student-work-area { fill: none; stroke: #e1e4e8; stroke-width: 0.42; stroke-dasharray: 1.2 1.4; }
      .ten-frame-outline, .ten-frame-line { fill: none; stroke: #3c4043; stroke-width: 0.42; }
      .counter-dot { fill: #222; }
      .bond-line { stroke: #9aa0a6; stroke-width: 0.58; stroke-linecap: round; }
      .bond-circle { fill: #fff; stroke: #3c4043; stroke-width: 0.52; }
      .bond-number { font-size: 5.7px; font-weight: 560; dominant-baseline: middle; }
      .pattern-label { font-size: 4.2px; font-weight: 520; fill: #5f6368; }
      .pattern-text { font-size: 6.35px; font-weight: 500; dominant-baseline: middle; }
      .work-card-prompt { font-size: 5.75px; }
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
  <text class="sheet-subtitle" x="${page.width / 2}" y="40.7" text-anchor="middle">${escapeXml(sheet.subtitle || 'Write each answer.')}</text>
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
    <title>ScanGrade Grade 1 Last-Week Test Packet Answer Key</title>
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
      h2 { margin: 0 0 8px; font-size: 17px; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; }
      th, td { border-bottom: 1px solid #d8dadd; padding: 5px 6px; text-align: left; }
      th { color: #5f6368; font-size: 9px; text-transform: uppercase; letter-spacing: 0.02em; }
      td:first-child, td:last-child { width: 52px; font-weight: 700; }
    </style>
  </head>
  <body>
    <h1>ScanGrade Grade 1 Last-Week Test Packet Answer Key</h1>
    <p class="intro">Generated ${escapeHtml(registry.generated_at)}. Score OCR against what students wrote in the final answer boxes.</p>
${sheetSections}
  </body>
</html>`
}

function indexHtml(registry) {
  const slotLabel = (template) => {
    const slots = [...new Set(template.answer_slot_counts)]
    if (slots.length === 1) return `${slots[0]} final answer slot${slots[0] === 1 ? '' : 's'} per question`
    return `${slots.join(' and ')} final answer slots across the sheet`
  }
  const cards = registry.templates.map((template) => `
      <article class="card">
        <a href="./${escapeHtml(template.filename)}" target="_blank" rel="noreferrer">
          <img alt="${escapeHtml(template.title)} preview" src="./${escapeHtml(template.filename)}">
        </a>
        <div>
          <h2>${escapeHtml(template.human_code)} ${escapeHtml(template.title)}</h2>
          <p>${template.total_questions} questions. ${slotLabel(template)}.</p>
          <p><a href="./${escapeHtml(template.filename)}" target="_blank" rel="noreferrer">SVG</a> <a href="./layouts/${escapeHtml(template.layout_id)}.json" target="_blank" rel="noreferrer">Layout JSON</a></p>
        </div>
      </article>`).join('\n')

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>ScanGrade Grade 1 Last-Week Classroom Test Packet</title>
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
      <h1>ScanGrade Grade 1 Last-Week Classroom Test Packet</h1>
      <p class="intro">Ten printable sheets for collecting final classroom evidence before summer break. The packet intentionally mixes single-digit answers, two-digit answers, visual counting, number bonds, number patterns, and place value.</p>
      <div class="actions">
        <a class="action" href="./printables/ScanGrade-Grade1-Last-Week-Test-Packet.pdf" target="_blank" rel="noreferrer">Open print packet PDF</a>
        <a class="action" href="./printables/ScanGrade-Grade1-Last-Week-Test-Answer-Key.pdf" target="_blank" rel="noreferrer">Open answer key PDF</a>
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

const registry = {
  generated_at: new Date().toISOString(),
  purpose: 'Grade 1 last-week classroom test packet for final June evidence collection.',
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
    worksheet_url: `worksheets/grade1-last-week-test-20260617/${sheet.filename}`,
    layout_url: `layouts/${sheet.id}.json`,
    packet_layout_url: `worksheets/grade1-last-week-test-20260617/layouts/${sheet.id}.json`,
    qr_payload_url: payloadString,
    grade_level: 1,
    layout_family: sheet.family,
    total_questions: sheet.questions.length,
    answer_box_count: layout.boxes.length,
    answer_slots_per_question: layout.metadata.answer_slots_per_question,
    answer_slot_counts: layout.metadata.answer_slot_counts,
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
    join(printableDir, 'ScanGrade-Grade1-Last-Week-Test-Packet.pdf')
  )
  await writePdf(
    pageHandle,
    answerKey,
    join(printableDir, 'ScanGrade-Grade1-Last-Week-Test-Answer-Key.pdf')
  )
} finally {
  await browser.close()
}

console.log(`Generated ${sheets.length} Grade 1 last-week test worksheets.`)
console.log(`Index: ${join(outDir, 'index.html')}`)
console.log(`Packet: ${join(printableDir, 'ScanGrade-Grade1-Last-Week-Test-Packet.pdf')}`)
