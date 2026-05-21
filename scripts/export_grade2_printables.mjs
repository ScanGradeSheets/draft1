import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const sourceDir = join(root, 'public', 'worksheets')
const outDir = join(sourceDir, 'printables')

const sheets = [
  {
    title: 'Worksheet A - Addition Within 20',
    source: 'grade2-addition-within-20-v1.svg',
    pdf: 'ScanGrade-Grade2-Worksheet-A-Addition-Within-20.pdf'
  },
  {
    title: 'Worksheet B - Subtraction Within 20',
    source: 'grade2-subtraction-within-20-v1.svg',
    pdf: 'ScanGrade-Grade2-Worksheet-B-Subtraction-Within-20.pdf'
  },
  {
    title: 'Worksheet C - Mixed Within 50',
    source: 'grade2-mixed-within-50-v1.svg',
    pdf: 'ScanGrade-Grade2-Worksheet-C-Mixed-Within-50.pdf'
  }
]

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

mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 816, height: 1056 } })
const svgs = sheets.map((sheet) => readFileSync(join(sourceDir, sheet.source), 'utf8'))

for (let i = 0; i < sheets.length; i += 1) {
  await writePdf(page, [svgs[i]], join(outDir, sheets[i].pdf))
  console.log(`Wrote ${sheets[i].pdf}`)
}

await writePdf(page, svgs, join(outDir, 'ScanGrade-Grade2-Worksheets-A-B-C-Print-Packet.pdf'))
console.log('Wrote ScanGrade-Grade2-Worksheets-A-B-C-Print-Packet.pdf')

await browser.close()
