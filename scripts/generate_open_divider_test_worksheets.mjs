import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const sourceDir = join(root, 'public', 'worksheets')
const outDir = join(sourceDir, 'open-divider-test')
const printableDir = join(outDir, 'printables')

const digitGuideInsetY = 2.6
const answerBoxHeight = 17.2
const openMarkLength = 4.35

const sheets = [
  {
    title: 'Addition Within 20',
    label: 'Worksheet A',
    source: 'grade2-addition-within-20-v1.svg',
    svg: 'grade2-addition-within-20-open-divider.svg',
    pdf: 'ScanGrade-Grade2-Worksheet-A-Addition-Within-20-Open-Divider.pdf'
  },
  {
    title: 'Subtraction Within 20',
    label: 'Worksheet B',
    source: 'grade2-subtraction-within-20-v1.svg',
    svg: 'grade2-subtraction-within-20-open-divider.svg',
    pdf: 'ScanGrade-Grade2-Worksheet-B-Subtraction-Within-20-Open-Divider.pdf'
  },
  {
    title: 'Mixed Within 50',
    label: 'Worksheet C',
    source: 'grade2-mixed-within-50-v1.svg',
    svg: 'grade2-mixed-within-50-open-divider.svg',
    pdf: 'ScanGrade-Grade2-Worksheet-C-Mixed-Within-50-Open-Divider.pdf'
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

function trimNumber(value) {
  return Number(value.toFixed(3)).toString()
}

function openDividerLines(xValue, y1Value, y2Value) {
  const x = Number(xValue)
  const y1 = Number(y1Value)
  const y2 = Number(y2Value)

  if (!Number.isFinite(x) || !Number.isFinite(y1) || !Number.isFinite(y2)) {
    throw new Error(`Cannot convert digit guide to open divider: ${xValue}, ${y1Value}, ${y2Value}`)
  }

  const top = y1 - digitGuideInsetY
  const bottom = top + answerBoxHeight
  const upperEnd = Math.min(top + openMarkLength, y2)
  const lowerStart = Math.max(bottom - openMarkLength, y1)

  return `<line class="open-divider-guide" x1="${trimNumber(x)}" y1="${trimNumber(top)}" x2="${trimNumber(x)}" y2="${trimNumber(upperEnd)}" />
      <line class="open-divider-guide" x1="${trimNumber(x)}" y1="${trimNumber(lowerStart)}" x2="${trimNumber(x)}" y2="${trimNumber(bottom)}" />`
}

function transformSvg(sourceSvg) {
  const transformed = sourceSvg
    .replace(
      /\.digit-guide \{ fill: none; stroke: #c7ccd2; stroke-width: [^;]+; stroke-linecap: round; stroke-dasharray: [^;]+; \}/,
      '.open-divider-guide { fill: none; stroke: #707780; stroke-width: 0.46; stroke-linecap: round; }'
    )
    .replace(
      /<line class="digit-guide" x1="([^"]+)" y1="([^"]+)" x2="([^"]+)" y2="([^"]+)" \/>/g,
      (_match, x1, y1, _x2, y2) => openDividerLines(x1, y1, y2)
    )

  if (transformed.includes('class="digit-guide"')) {
    throw new Error('Open-divider transform left a digit-guide element behind.')
  }

  return transformed
}

function printableHtml(svgList) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      @page {
        size: Letter;
        margin: 0;
      }

      html,
      body {
        margin: 0;
        padding: 0;
        background: #fff;
      }

      .sheet-page {
        width: 8.5in;
        height: 11in;
        page-break-after: always;
        break-after: page;
        overflow: hidden;
        background: #fff;
      }

      .sheet-page:last-child {
        page-break-after: auto;
        break-after: auto;
      }

      svg {
        display: block;
        width: 8.5in;
        height: 11in;
      }
    </style>
  </head>
  <body>
    ${svgList.map((svg) => `<section class="sheet-page">${svg}</section>`).join('\n')}
  </body>
</html>`
}

async function writePdf(page, svgList, path) {
  await page.setContent(printableHtml(svgList), { waitUntil: 'load' })
  await page.pdf({
    path,
    width: '8.5in',
    height: '11in',
    printBackground: true,
    margin: {
      top: '0in',
      right: '0in',
      bottom: '0in',
      left: '0in'
    },
    preferCSSPageSize: true
  })
}

function buildIndex() {
  const cards = sheets.map((sheet) => `
      <article class="card">
        <a class="preview-link" href="./${escapeHtml(sheet.svg)}" target="_blank" rel="noreferrer">
          <img alt="${escapeHtml(sheet.label)} ${escapeHtml(sheet.title)} open-divider preview" src="./${escapeHtml(sheet.svg)}">
        </a>
        <div class="copy">
          <h2>${escapeHtml(sheet.label)}: ${escapeHtml(sheet.title)}</h2>
          <p>Open-divider answer boxes. QR payloads and layout geometry match the current app templates.</p>
          <div class="links">
            <a href="./${escapeHtml(sheet.svg)}" target="_blank" rel="noreferrer">SVG</a>
            <a href="./printables/${escapeHtml(sheet.pdf)}" target="_blank" rel="noreferrer">PDF</a>
          </div>
        </div>
      </article>`).join('\n')

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>ScanGrade Open-Divider Worksheet Test Set</title>
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

      main {
        max-width: 1180px;
        margin: 0 auto;
        padding: 34px 20px 44px;
      }

      h1 {
        margin: 0 0 8px;
        font-size: clamp(28px, 4vw, 42px);
        letter-spacing: 0;
      }

      .intro {
        max-width: 760px;
        margin: 0 0 22px;
        color: #626970;
        font-size: 16px;
        line-height: 1.45;
      }

      .packet-link {
        display: inline-flex;
        align-items: center;
        min-height: 44px;
        padding: 0 17px;
        margin: 0 0 24px;
        border-radius: 9px;
        background: #0066d9;
        color: #fff;
        font-weight: 760;
        text-decoration: none;
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 18px;
      }

      .card {
        overflow: hidden;
        border: 1px solid #dde1e6;
        border-radius: 10px;
        background: #fff;
        box-shadow: 0 16px 34px rgba(15, 23, 42, 0.08);
      }

      .preview-link {
        display: block;
        border-bottom: 1px solid #eceff2;
        background: #fff;
      }

      img {
        display: block;
        width: 100%;
        height: 620px;
        object-fit: contain;
        background: #fff;
      }

      .copy {
        padding: 17px 18px 20px;
      }

      h2 {
        margin: 0 0 7px;
        font-size: 20px;
      }

      p {
        margin: 0 0 12px;
        color: #626970;
        line-height: 1.45;
      }

      .links {
        display: flex;
        gap: 14px;
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
          height: 700px;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Open-Divider Worksheet Test Set</h1>
      <p class="intro">These three printables use the #5 open-divider answer box. Everything else is intentionally held steady so scans compare against the current production worksheet geometry.</p>
      <a class="packet-link" href="./printables/ScanGrade-Grade2-Worksheets-A-B-C-Open-Divider-Test-Packet.pdf" target="_blank" rel="noreferrer">Open print packet PDF</a>
      <section class="grid">
${cards}
      </section>
    </main>
  </body>
</html>
`
}

ensureDir(outDir)
ensureDir(printableDir)

const svgs = sheets.map((sheet) => {
  const sourcePath = join(sourceDir, sheet.source)
  if (!existsSync(sourcePath)) {
    throw new Error(`Missing source worksheet: ${sourcePath}`)
  }

  const svg = transformSvg(readFileSync(sourcePath, 'utf8'))
  writeFileSync(join(outDir, sheet.svg), svg)
  return svg
})

writeFileSync(join(outDir, 'index.html'), buildIndex())

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 816, height: 1056 } })

for (let i = 0; i < sheets.length; i += 1) {
  await writePdf(page, [svgs[i]], join(printableDir, sheets[i].pdf))
  console.log(`Wrote ${sheets[i].pdf}`)
}

await writePdf(page, svgs, join(printableDir, 'ScanGrade-Grade2-Worksheets-A-B-C-Open-Divider-Test-Packet.pdf'))
await browser.close()

console.log(`Generated open-divider worksheet test set in ${outDir}`)
