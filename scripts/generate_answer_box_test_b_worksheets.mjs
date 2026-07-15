import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const sourceDir = join(root, 'public', 'worksheets')
const sourceLayoutDir = join(root, 'public', 'layouts')
const outDir = join(sourceDir, 'answer-box-test-b')
const outLayoutDir = join(outDir, 'layouts')
const printableDir = join(outDir, 'printables')

const page = { width: 215.9, height: 279.4 }
const currentBox = { width: 14, height: 17.2, gap: 1 }
const testBox = {
  width: 13,
  height: 18.92,
  gap: 0.95,
  markLength: 5.15
}
const testFrameWidth = testBox.width * 2 + testBox.gap
const testLabel = 'Answer Box Test B: Taller/Narrower'

const sheets = [
  {
    title: 'Addition Within 20',
    label: 'Worksheet A',
    layout: 'g2-add-within-20-v1.json',
    source: 'grade2-addition-within-20-v1.svg',
    svg: 'grade2-addition-within-20-answer-box-test-b.svg',
    pdf: 'ScanGrade-Grade2-Worksheet-A-Addition-Within-20-Answer-Box-Test-B.pdf'
  },
  {
    title: 'Subtraction Within 20',
    label: 'Worksheet B',
    layout: 'g2-sub-within-20-v1.json',
    source: 'grade2-subtraction-within-20-v1.svg',
    svg: 'grade2-subtraction-within-20-answer-box-test-b.svg',
    pdf: 'ScanGrade-Grade2-Worksheet-B-Subtraction-Within-20-Answer-Box-Test-B.pdf'
  },
  {
    title: 'Mixed Within 50',
    label: 'Worksheet C',
    layout: 'g2-mixed-within-50-v1.json',
    source: 'grade2-mixed-within-50-v1.svg',
    svg: 'grade2-mixed-within-50-answer-box-test-b.svg',
    pdf: 'ScanGrade-Grade2-Worksheet-C-Mixed-Within-50-Answer-Box-Test-B.pdf'
  }
]

function ensureDir(path) {
  if (!existsSync(path)) mkdirSync(path, { recursive: true })
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
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

function transformAnswerBoxBlock(_match, boxIds, xValue, yValue) {
  const x = Number(xValue)
  const oldY = Number(yValue)
  const y = oldY - (testBox.height - currentBox.height) / 2
  const seamX = x + testBox.width + testBox.gap / 2
  const upperEnd = y + testBox.markLength
  const lowerStart = y + testBox.height - testBox.markLength
  const bottom = y + testBox.height

  return `<line class="open-divider-guide" x1="${trimNumber(seamX)}" y1="${trimNumber(y)}" x2="${trimNumber(seamX)}" y2="${trimNumber(upperEnd)}" />
      <line class="open-divider-guide" x1="${trimNumber(seamX)}" y1="${trimNumber(lowerStart)}" x2="${trimNumber(seamX)}" y2="${trimNumber(bottom)}" />
      <rect class="answer-box answer-box-wide" data-question-boxes="${boxIds}" x="${trimNumber(x)}" y="${trimNumber(y)}" width="${trimNumber(testFrameWidth)}" height="${trimNumber(testBox.height)}" />`
}

function transformSvg(sourceSvg) {
  return sourceSvg
    .replace(
      /<line class="open-divider-guide" x1="[^"]+" y1="[^"]+" x2="[^"]+" y2="[^"]+" \/>\s*\n\s*<line class="open-divider-guide" x1="[^"]+" y1="[^"]+" x2="[^"]+" y2="[^"]+" \/>\s*\n\s*<rect class="answer-box answer-box-wide" data-question-boxes="([^"]+)" x="([^"]+)" y="([^"]+)" width="[^"]+" height="[^"]+" \/>/g,
      transformAnswerBoxBlock
    )
    .replace('<metadata>', `<metadata>${testLabel}\n`)
}

function transformLayout(layout) {
  const next = structuredClone(layout)
  next.layout_id = `${layout.layout_id}-answer-box-test-b`
  next.metadata = {
    ...next.metadata,
    test_variant: testLabel,
    digit_box_width_mm: testBox.width,
    digit_box_height_mm: testBox.height,
    printed_text_font_family: layout.metadata?.printed_text_font_family ?? 'Lexend'
  }

  const byQuestion = new Map()
  for (const box of next.boxes) {
    if (!byQuestion.has(box.question_num)) byQuestion.set(box.question_num, [])
    byQuestion.get(box.question_num).push(box)
  }

  for (const boxes of byQuestion.values()) {
    boxes.sort((a, b) => a.digit_index - b.digit_index)
    const oldLeft = boxes[0].x * page.width - boxes[0].width * page.width
    const oldTop = boxes[0].y * page.height - boxes[0].height * page.height
    const top = oldTop - (testBox.height - currentBox.height) / 2

    boxes.forEach((box, digitIndex) => {
      const left = oldLeft + digitIndex * (testBox.width + testBox.gap)
      box.x = normalizeX(left + testBox.width)
      box.y = normalizeY(top + testBox.height)
      box.width = normalizeX(testBox.width)
      box.height = normalizeY(testBox.height)
    })
  }

  for (const group of next.question_groups) {
    const boxes = group.digit_box_ids.map((id) => next.boxes[id])
    const left = boxes[0].x * page.width - boxes[0].width * page.width
    const top = boxes[0].y * page.height - boxes[0].height * page.height
    group.guide_line = {
      ...group.guide_line,
      x: normalizeX(left + testBox.width + testBox.gap / 2),
      y1: normalizeY(top),
      y2: normalizeY(top + testBox.height)
    }
  }

  return next
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

async function writePdf(pageHandle, svgList, path) {
  await pageHandle.setContent(printableHtml(svgList), { waitUntil: 'load' })
  await pageHandle.pdf({
    path,
    width: '8.5in',
    height: '11in',
    printBackground: true,
    margin: { top: '0in', right: '0in', bottom: '0in', left: '0in' },
    preferCSSPageSize: true
  })
}

function buildIndex() {
  const cards = sheets.map((sheet) => `
      <article class="card">
        <a href="./${escapeHtml(sheet.svg)}" target="_blank" rel="noreferrer">
          <img alt="${escapeHtml(sheet.label)} ${escapeHtml(sheet.title)} ${escapeHtml(testLabel)} preview" src="./${escapeHtml(sheet.svg)}">
        </a>
        <div>
          <h2>${escapeHtml(sheet.label)}: ${escapeHtml(sheet.title)}</h2>
          <p>${escapeHtml(testLabel)}. Same worksheet structure, with answer boxes about 10% taller, 7% narrower, and slightly longer center guide marks.</p>
          <p><a href="./${escapeHtml(sheet.svg)}" target="_blank" rel="noreferrer">SVG</a> <a href="./printables/${escapeHtml(sheet.pdf)}" target="_blank" rel="noreferrer">PDF</a></p>
        </div>
      </article>`).join('\n')

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(testLabel)}</title>
    <style>
      @font-face {
        font-family: "Lexend";
        src: url("../fonts/Lexend-wght.ttf") format("truetype");
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
      .intro { max-width: 780px; margin: 0 0 22px; color: #626970; line-height: 1.45; }
      .actions { display: flex; flex-wrap: wrap; gap: 12px; margin: 0 0 24px; }
      .action {
        display: inline-flex;
        align-items: center;
        min-height: 44px;
        padding: 0 17px;
        border-radius: 9px;
        background: #0066d9;
        color: #fff;
        font-weight: 760;
        text-decoration: none;
      }
      .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; }
      .card {
        overflow: hidden;
        border: 1px solid #dde1e6;
        border-radius: 10px;
        background: #fff;
        box-shadow: 0 16px 34px rgba(15, 23, 42, 0.08);
      }
      img { display: block; width: 100%; height: 620px; object-fit: contain; background: #fff; border-bottom: 1px solid #eceff2; }
      .card div { padding: 17px 18px 20px; }
      h2 { margin: 0 0 7px; font-size: 20px; }
      p { margin: 0 0 12px; color: #626970; line-height: 1.45; }
      a { color: #0066d9; font-weight: 750; }
      .action { color: #fff; }
      @media (max-width: 980px) {
        .grid { grid-template-columns: 1fr; }
        img { height: 700px; }
      }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(testLabel)}</h1>
      <p class="intro">Controlled OCR comparison set. Current worksheet spacing, title, bubbles, QR code, corner markers, and two-column structure are held steady. Only the answer-box shape and center guide mark length change.</p>
      <div class="actions">
        <a class="action" href="./printables/ScanGrade-Grade2-Worksheets-A-B-C-Answer-Box-Test-B-Packet.pdf" target="_blank" rel="noreferrer">Open print packet PDF</a>
      </div>
      <section class="grid">
${cards}
      </section>
    </main>
  </body>
</html>
`
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

ensureDir(outDir)
ensureDir(outLayoutDir)
ensureDir(printableDir)

const svgs = sheets.map((sheet) => {
  const sourcePath = join(sourceDir, sheet.source)
  const layoutPath = join(sourceLayoutDir, sheet.layout)
  if (!existsSync(sourcePath)) throw new Error(`Missing source worksheet: ${sourcePath}`)
  if (!existsSync(layoutPath)) throw new Error(`Missing source layout: ${layoutPath}`)

  const svg = transformSvg(readFileSync(sourcePath, 'utf8'))
  const layout = transformLayout(JSON.parse(readFileSync(layoutPath, 'utf8')))
  writeFileSync(join(outDir, sheet.svg), svg)
  writeJson(join(outLayoutDir, sheet.layout.replace('.json', '-answer-box-test-b.json')), layout)
  return svg
})

writeFileSync(join(outDir, 'index.html'), buildIndex())

const browser = await chromium.launch()
const pageHandle = await browser.newPage({ viewport: { width: 816, height: 1056 } })

for (let i = 0; i < sheets.length; i += 1) {
  await writePdf(pageHandle, [svgs[i]], join(printableDir, sheets[i].pdf))
  console.log(`Wrote ${sheets[i].pdf}`)
}

await writePdf(
  pageHandle,
  svgs,
  join(printableDir, 'ScanGrade-Grade2-Worksheets-A-B-C-Answer-Box-Test-B-Packet.pdf')
)
await browser.close()

console.log(`Generated ${testLabel} in ${outDir}`)
