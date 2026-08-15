#!/usr/bin/env node

import fs from 'node:fs/promises'
import { webkit } from 'playwright'

const input = process.argv[2]
const baseUrl = process.env.SG_PRIVATE_TEST_URL || 'https://hobbes-mac-mini.tail415e0b.ts.net/debug'
if (!input) throw new Error('Usage: node scripts/test_add2_stitched_candidate_saved_page.mjs DEBUG_JSON')

const parsed = JSON.parse(await fs.readFile(input, 'utf8'))
const debug = parsed?.debug && typeof parsed.debug === 'object' ? parsed.debug : parsed
if (!String(debug.capturedImageDataUrl || '').startsWith('data:image/')) {
  throw new Error('debug bundle has no captured image')
}

const truth = new Map([[1, '11'], [2, '12'], [3, '15'], [4, '16'], [5, '14'], [6, '16'], [7, '18'], [8, '17']])
const url = new URL(baseUrl)
Object.entries({
  test: 'add2-stitched-saved-page',
  v3BurstReplay: '1',
  v3BrowserLocalStrongShadow: '1',
  v3BrowserLocalAdd2StitchedApply: '1',
  v3BrowserLocalStrongFrames: '1',
  v3BrowserLocalStrongLimit: '8',
  v3BrowserLocalStrongTimeoutMs: '90000',
}).forEach(([key, value]) => url.searchParams.set(key, value))

const browser = await webkit.launch({ headless: true })
const events = []
let report
try {
  const context = await browser.newContext({
    ignoreHTTPSErrors: false,
    viewport: { width: 430, height: 932 },
    isMobile: true,
    hasTouch: true,
  })
  await context.addInitScript(() => {
    const reject = () => Promise.reject(new Error('saved-page replay camera intentionally unavailable'))
    if (!navigator.mediaDevices) Object.defineProperty(navigator, 'mediaDevices', { value: {} })
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: reject, configurable: true })
  })
  const page = await context.newPage()
  page.setDefaultTimeout(120_000)
  page.on('console', (message) => events.push({ type: `console:${message.type()}`, text: message.text() }))
  page.on('pageerror', (error) => events.push({ type: 'pageerror', text: String(error?.stack || error) }))
  page.on('requestfailed', (request) => events.push({ type: 'requestfailed', text: `${request.url()} ${request.failure()?.errorText || ''}` }))

  const started = Date.now()
  await page.goto(url.toString(), { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Debug Scan (exports)' }).click()
  await page.waitForFunction(() => !!window.cv?.Mat)
  const replayStarted = await page.evaluate(
    (imageDataUrl) => window.__SCANGRADE_REPLAY_CAPTURE_DATA_URL?.(imageDataUrl),
    debug.capturedImageDataUrl,
  )
  if (!replayStarted) throw new Error('page rejected saved capture replay')

  await page.waitForFunction(() => !!window.__SCANGRADE_LIVE_OCR_DEBUG?.v3BrowserLocalStrongShadow)
  const pending = await page.evaluate(() => ({
    status: window.__SCANGRADE_LIVE_OCR_DEBUG?.v3BrowserLocalStrongShadow?.status || '',
    resultVisible: Boolean(document.querySelector('.student-result')),
  }))
  await page.waitForFunction(() => ['complete', 'fail-open'].includes(
    window.__SCANGRADE_LIVE_OCR_DEBUG?.v3BrowserLocalStrongShadow?.status,
  ))
  await page.waitForFunction(() => !document.querySelector('.student-scan-grading-word'))

  const final = await page.evaluate(() => {
    const live = window.__SCANGRADE_LIVE_OCR_DEBUG || {}
    return {
      candidate: live.v3BrowserLocalStrongShadow || null,
      answers: (live.answerGroups || []).map((group) => ({
        questionNum: Number(group.questionNum),
        read: String(group.answerText || ''),
        automatic: group.reviewNeeded !== true,
      })),
      questionReview: live.questionReview || [],
      stageText: document.querySelector('.student-scan-grading-word')?.textContent?.trim() || '',
      resultVisible: Boolean(document.querySelector('.student-result')),
    }
  })
  const promoted = final.candidate?.promoted || []
  const wrongPromotions = promoted.filter((row) => String(
    row?.automaticText || row?.read || row?.decision?.read || '',
  ) !== truth.get(Number(row?.questionNum)))
  const pageErrors = events.filter((event) => event.type === 'pageerror')
  report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceDebug: input,
    engine: 'playwright-webkit-mobile-emulation',
    elapsedMs: Date.now() - started,
    pending,
    final,
    events,
    gates: {
      candidateCompleted: final.candidate?.status === 'complete',
      exactPolicy: final.candidate?.policy === 'add2-original-yellow-single-stitched-min-0.999',
      noWrongPromotions: wrongPromotions.length === 0,
      noResultPresentedWhilePending: pending.status !== 'pending' || pending.resultVisible === false,
      noPageErrors: pageErrors.length === 0,
      settledOutOfScanning: final.stageText === '',
    },
  }
  report.gates.pass = Object.values(report.gates).every(Boolean)
} finally {
  await browser.close()
}

const outputPath = process.env.SG_REPORT_PATH || 'private-evidence/reports/add2-stitched-saved-page-webkit-20260815.json'
await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ outputPath, ...report }, null, 2))
if (!report?.gates?.pass) process.exitCode = 1
