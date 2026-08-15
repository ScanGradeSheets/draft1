#!/usr/bin/env node

import fs from 'node:fs/promises'
import { webkit } from 'playwright'

const input = process.argv[2]
const baseUrl = process.env.SG_TEST_URL || 'https://127.0.0.1:5174/debug'
if (!input) throw new Error('Usage: node scripts/test_correction_keypad_continuity_webkit.mjs DEBUG_JSON')

const parsed = JSON.parse(await fs.readFile(input, 'utf8'))
const debug = parsed?.debug && typeof parsed.debug === 'object' ? parsed.debug : parsed
if (!String(debug.capturedImageDataUrl || '').startsWith('data:image/')) {
  throw new Error('debug bundle has no captured image')
}

const answers = new Map([[1, '11'], [2, '12'], [3, '15'], [4, '16'], [5, '14'], [6, '16'], [7, '18'], [8, '17']])
const url = new URL(baseUrl)
url.searchParams.set('liveOcrDebug', '1')
url.searchParams.set('v3BurstReplay', '1')
url.searchParams.set('test', 'correction-keypad-continuity')

const browser = await webkit.launch({ headless: true })
const events = []
let report
try {
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
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

  await page.goto(url.toString(), { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Debug Scan (exports)' }).click()
  await page.waitForFunction(() => !!window.cv?.Mat)
  const replayStarted = await page.evaluate(
    (imageDataUrl) => window.__SCANGRADE_REPLAY_CAPTURE_DATA_URL?.(imageDataUrl),
    debug.capturedImageDataUrl,
  )
  if (!replayStarted) throw new Error('page rejected saved capture replay')
  await page.waitForFunction(() => !!document.querySelector('.correction-keypad'))

  await page.evaluate(() => {
    const node = document.querySelector('.correction-keypad')
    const state = {
      node,
      removed: 0,
      replaced: 0,
      frameAbsent: 0,
      gradingSamples: 0,
      gradingCompletionControlConflicts: 0,
      running: true,
    }
    const containsKeypad = (candidate) => candidate?.nodeType === 1 && (
      candidate.matches?.('.correction-keypad') || candidate.querySelector?.('.correction-keypad')
    )
    state.observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const removed of record.removedNodes) {
          if (containsKeypad(removed)) state.removed += 1
        }
      }
      const current = document.querySelector('.correction-keypad')
      if (current && current !== state.node) state.replaced += 1
    })
    state.observer.observe(document.documentElement, { childList: true, subtree: true })
    const sample = () => {
      if (!state.running) return
      if (!document.querySelector('.correction-keypad')) state.frameAbsent += 1
      const grading = document.querySelector('.student-scan-grading')
      if (grading) {
        state.gradingSamples += 1
        if (
          document.querySelector('.student-recognition-toggle') ||
          document.querySelector('.student-scan-reset')
        ) state.gradingCompletionControlConflicts += 1
      }
      requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
    window.__SCANGRADE_KEYPAD_CONTINUITY = state
  })

  const sequence = []
  for (let index = 0; index < 8; index += 1) {
    const state = await page.evaluate(() => window.__SCANGRADE_REPLAY_CORRECTION_STATE?.())
    const questionNum = Number(state?.questionNum)
    if (!Number.isFinite(questionNum)) break
    const truth = answers.get(questionNum)
    const entry = Number.isInteger(state?.slotIndex) ? truth?.[state.slotIndex] : truth
    if (!entry) throw new Error(`missing truth for question ${questionNum}`)
    sequence.push({ questionNum, slotIndex: state.slotIndex, entry })
    for (const digit of entry) {
      await page.locator('.correction-keypad-key').filter({ hasText: new RegExp(`^${digit}$`) }).click()
    }
    await page.waitForFunction((previous) => {
      const keypad = document.querySelector('.correction-keypad')
      const current = window.__SCANGRADE_REPLAY_CORRECTION_STATE?.()
      const currentQuestionNum = Number(current?.questionNum)
      if (!keypad) return true
      if (!Number.isFinite(currentQuestionNum)) return false
      return currentQuestionNum !== Number(previous.questionNum) ||
        current?.slotIndex !== previous.slotIndex
    }, { questionNum, slotIndex: state.slotIndex }, { timeout: 20_000 })
    if (await page.locator('.correction-keypad').count() === 0) break
  }

  await page.waitForFunction(() => (
    !document.querySelector('.student-scan-grading') &&
    !!document.querySelector('.student-recognition-toggle') &&
    !!document.querySelector('.student-scan-reset')
  ), null, { timeout: 30_000 })
  await page.waitForTimeout(250)
  const continuity = await page.evaluate(() => {
    const state = window.__SCANGRADE_KEYPAD_CONTINUITY
    state.running = false
    state.observer.disconnect()
    return {
      removed: state.removed,
      replaced: state.replaced,
      frameAbsent: state.frameAbsent,
      gradingSamples: state.gradingSamples,
      gradingCompletionControlConflicts: state.gradingCompletionControlConflicts,
      finalMounted: Boolean(document.querySelector('.correction-keypad')),
      finalGradingVisible: Boolean(document.querySelector('.student-scan-grading')),
      finalRecognitionArrowVisible: Boolean(document.querySelector('.student-recognition-toggle')),
      finalNewScanVisible: Boolean(document.querySelector('.student-scan-reset')),
    }
  })
  const pageErrors = events.filter((event) => event.type === 'pageerror')
  report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceDebug: input,
    engine: 'playwright-webkit-mobile-emulation',
    sequence,
    continuity,
    events,
    gates: {
      correctedMultipleYellows: sequence.length >= 2,
      sameKeypadNodeThroughoutQueue: continuity.replaced === 0,
      neverRemovedBetweenYellows: continuity.removed === 1,
      absentOnlyAfterFinalCorrection: continuity.frameAbsent > 0 && continuity.finalMounted === false,
      gradingObservedThroughCompletion: continuity.gradingSamples > 0,
      noCompletionControlsDuringGrading: continuity.gradingCompletionControlConflicts === 0,
      completionControlsReplaceGrading: continuity.finalGradingVisible === false &&
        continuity.finalRecognitionArrowVisible === true &&
        continuity.finalNewScanVisible === true,
      noPageErrors: pageErrors.length === 0,
    },
  }
  report.gates.pass = Object.values(report.gates).every(Boolean)
} finally {
  await browser.close()
}

console.log(JSON.stringify(report, null, 2))
if (!report?.gates?.pass) process.exitCode = 1
