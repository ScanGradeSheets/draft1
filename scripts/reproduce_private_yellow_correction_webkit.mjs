#!/usr/bin/env node

import fs from 'node:fs/promises'
import { webkit } from 'playwright'

const input = process.argv[2]
const baseUrl = process.env.SG_PRIVATE_TEST_URL || 'https://hobbes-mac-mini.tail415e0b.ts.net:8443/debug'
if (!input) throw new Error('Usage: node scripts/reproduce_private_yellow_correction_webkit.mjs DEBUG_JSON')

const debug = JSON.parse(await fs.readFile(input, 'utf8'))
const captureMatch = String(debug.capturedImageDataUrl || '').match(/^data:image\/(png|jpeg);base64,(.+)$/)
if (!captureMatch) throw new Error('debug bundle has no captured image')
const frames = (debug.hybridBurstFrameDataUrls || []).slice(0, 3).map((imageDataUrl, index) => ({
  index,
  score: 1000 - index,
  focusScore: 1000 - index,
  sheetOk: true,
  imageDataUrl,
}))
if (frames.length !== 3) throw new Error('debug bundle does not contain exactly three retained frames')

const answers = new Map([[1, '11'], [2, '12'], [3, '15'], [4, '16'], [5, '14'], [6, '16'], [7, '18'], [8, '17']])
const url = new URL(baseUrl)
Object.entries({
  test: 'webkit-correction-repro',
  hybridV2: '1',
  v3BurstReplay: '1',
  v3BrowserLocalStrongShadow: '1',
  v3BrowserLocalStrongApply: '1',
  v3BrowserLocalStrongFrames: '3',
  v3BrowserLocalStrongLimit: '20',
  v3BrowserLocalStrongTimeoutMs: '90000',
}).forEach(([key, value]) => url.searchParams.set(key, value))

const browser = await webkit.launch({ headless: true })
const events = []
let page
try {
  const context = await browser.newContext({
    ignoreHTTPSErrors: false,
    viewport: { width: 430, height: 932 },
    isMobile: true,
    hasTouch: true,
  })
  await context.addInitScript(() => {
    const reject = () => Promise.reject(new Error('replay camera intentionally unavailable'))
    if (!navigator.mediaDevices) Object.defineProperty(navigator, 'mediaDevices', { value: {} })
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: reject, configurable: true })
  })
  page = await context.newPage()
  page.setDefaultTimeout(120_000)
  page.on('console', (message) => events.push({ type: `console:${message.type()}`, text: message.text() }))
  page.on('pageerror', (error) => events.push({ type: 'pageerror', text: String(error?.stack || error) }))
  page.on('requestfailed', (request) => events.push({ type: 'requestfailed', text: `${request.url()} ${request.failure()?.errorText || ''}` }))
  await page.goto(url.toString(), { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Debug Scan (exports)' }).click()
  await page.waitForFunction(() => !!window.cv?.Mat)
  const accepted = await page.evaluate((value) => window.__SCANGRADE_SET_V3_BURST_FRAMES?.(value), frames)
  if (accepted !== 3) throw new Error(`page accepted ${accepted} retained frames`)

  const timeline = []
  const snapshot = async (label) => {
    timeline.push(await page.evaluate((name) => {
      const image = document.querySelector('.captured-image')
      return {
        label: name,
        at: performance.now(),
        stage: document.querySelector('.student-scan-grading-word')?.textContent?.trim() || '',
        imagePrefix: String(image?.getAttribute('src') || '').slice(0, 80),
        imageLength: String(image?.getAttribute('src') || '').length,
        masks: document.querySelectorAll('mask[id^="progressive-mask-"]').length,
        keypad: !!document.querySelector('.correction-keypad'),
        active: document.querySelector('.annotation-hotspot--active')?.textContent?.trim() || '',
        debugStatus: window.__SCANGRADE_LIVE_OCR_DEBUG?.v3BrowserLocalStrongShadow?.status || '',
      }
    }, label))
  }

  const replayStarted = await page.evaluate(
    (imageDataUrl) => window.__SCANGRADE_REPLAY_CAPTURE_DATA_URL?.(imageDataUrl),
    debug.capturedImageDataUrl,
  )
  if (!replayStarted) throw new Error('page rejected retained capture replay')
  await page.waitForFunction(() => !!window.__SCANGRADE_LIVE_OCR_DEBUG?.v3BrowserLocalStrongShadow)
  await page.waitForFunction(() => ['complete', 'fail-open'].includes(window.__SCANGRADE_LIVE_OCR_DEBUG?.v3BrowserLocalStrongShadow?.status))
  await snapshot('candidate-complete')
  const automaticReview = await page.locator('.correction-keypad').count() > 0
  if (!automaticReview) {
    const opened = await page.evaluate(() => window.__SCANGRADE_REPLAY_OPEN_CORRECTION?.(3))
    if (!opened) throw new Error('could not open deterministic replay correction')
  }
  await page.waitForFunction(() => !!document.querySelector('.correction-keypad'), null, { timeout: 30_000 })

  for (let correction = 0; correction < 8; correction += 1) {
    await snapshot(`correction-${correction}-open`)
    const state = await page.evaluate(() => {
      const activeText = document.querySelector('.annotation-hotspot--active')?.textContent?.trim() || ''
      const letter = activeText.match(/[A-H]/)?.[0] || ''
      const replay = window.__SCANGRADE_REPLAY_CORRECTION_STATE?.() || {}
      const questionNum = letter ? letter.charCodeAt(0) - 64 : Number(replay.questionNum)
      const predictions = (window.__SCANGRADE_LIVE_OCR_DEBUG?.predictions || [])
        .filter((row) => Number(row.questionNum) === questionNum)
      return {
        questionNum,
        reviewSlots: Number.isInteger(replay.slotIndex)
          ? [replay.slotIndex]
          : predictions
            .map((row, index) => ({ index: Number.isFinite(Number(row.digitIndex)) ? Number(row.digitIndex) : index, review: row.reviewNeeded === true }))
            .filter((row) => row.review)
            .map((row) => row.index),
      }
    })
    if (!Number.isFinite(state.questionNum)) throw new Error(`could not identify active correction: ${JSON.stringify(state)}`)
    const truth = answers.get(state.questionNum)
    const entry = state.reviewSlots.length === 1 ? truth[state.reviewSlots[0]] : truth
    for (const digit of entry) {
      await page.locator('.correction-keypad-key').filter({ hasText: new RegExp(`^${digit}$`) }).click()
    }
    await page.waitForTimeout(250)
    await snapshot(`correction-${correction}-submitted`)
    const remaining = await page.evaluate(() => (window.__SCANGRADE_LIVE_OCR_DEBUG?.answerGroups || [])
      .filter((group) => group.reviewNeeded === true).length)
    if (!remaining && !automaticReview && correction === 0) {
      await page.waitForFunction(() => !document.querySelector('.correction-keypad'))
      const opened = await page.evaluate(() => window.__SCANGRADE_REPLAY_OPEN_CORRECTION?.(7))
      if (!opened) throw new Error('could not open second deterministic replay correction')
      await page.waitForFunction(() => !!document.querySelector('.correction-keypad'))
      continue
    }
    if (!remaining) break
    await page.waitForFunction(() => !!document.querySelector('.correction-keypad'), null, { timeout: 15_000 })
  }
  await page.waitForTimeout(5000)
  await snapshot('five-seconds-after-final-correction')
  const final = await page.evaluate(() => ({
    stage: document.querySelector('.student-scan-grading-word')?.textContent?.trim() || '',
    keypad: !!document.querySelector('.correction-keypad'),
    debug: window.__SCANGRADE_LIVE_OCR_DEBUG,
  }))
  console.log(JSON.stringify({ url: url.toString(), timeline, final: {
    stage: final.stage,
    keypad: final.keypad,
    answerGroups: final.debug?.answerGroups,
    strongStatus: final.debug?.v3BrowserLocalStrongShadow?.status,
  }, events }, null, 2))
} finally {
  if (page) await page.screenshot({ path: '/tmp/scangrade-private-correction-repro.png', fullPage: true }).catch(() => {})
  await browser.close()
}
