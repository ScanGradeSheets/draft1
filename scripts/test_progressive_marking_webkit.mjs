#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { webkit } from 'playwright'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const APP = process.env.SG_APP_URL || 'https://127.0.0.1:5173'
const LARGE = 'https://127.0.0.1:8894'
const COMPACT = 'https://127.0.0.1:8895'
const token = randomBytes(32).toString('base64url')
const tlsPem = path.join(ROOT, 'node_modules/.vite/basic-ssl/_cert.pem')
const logs = []
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

function start(command, args, env = {}) {
  const child = spawn(command, args, {
    cwd: ROOT,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stdout.on('data', (chunk) => logs.push(String(chunk)))
  child.stderr.on('data', (chunk) => logs.push(String(chunk)))
  return child
}

async function health(url, child) {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    if (child.exitCode != null) throw new Error(`service exited ${child.exitCode}: ${logs.slice(-8).join('')}`)
    try { if ((await fetch(url)).ok) return } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`health timeout: ${url}`)
}

const origin = new URL(APP).origin
const commonEnv = {
  SCANGRADE_REVIEW_TOKEN: token,
  SCANGRADE_REVIEW_ALLOWED_ORIGINS: origin,
  SCANGRADE_REVIEW_TLS_CERT: tlsPem,
  SCANGRADE_REVIEW_TLS_KEY: tlsPem,
}
const largeService = start(path.join(ROOT, '.venv/bin/python'), [
  'scripts/serve_trocr_review.py', '--host', '127.0.0.1', '--port', '8894', '--device', process.env.SG_LARGE_DEVICE || 'mps', '--offline',
  '--adapter', 'private-evidence/models/trocr-lora-calibrated-2epoch-20260709',
], commonEnv)
const compactService = start(path.join(ROOT, '.venv/bin/python'), ['scripts/serve_v3_compact.py'], {
  PORT: '8895',
  SCANGRADE_V3_HOST: '127.0.0.1',
  SCANGRADE_V3_TOKEN: token,
  SCANGRADE_V3_ALLOWED_ORIGINS: origin,
  SCANGRADE_V3_TLS_CERT: tlsPem,
  SCANGRADE_V3_TLS_KEY: tlsPem,
})

const source = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'private-evidence/reports/v3-review-display-nonrow-safety-20260714/P09/rows.json'),
  'utf8',
)).find((row) => row.id === '2080d9f1-captured')
if (!source) throw new Error('saved P09 number-pattern source is missing')
const frameDir = path.join(path.dirname(source.file), 'burst-frames')
const frames = fs.readdirSync(frameDir)
  .filter((name) => /^frame-\d+\.(?:png|jpe?g)$/i.test(name))
  .sort()
  .slice(0, 3)
  .map((name, index) => ({
    index,
    score: 1000 - index,
    focusScore: 1000 - index,
    sheetOk: true,
    imageDataUrl: `data:image/png;base64,${fs.readFileSync(path.join(frameDir, name)).toString('base64')}`,
  }))

const url = new URL(APP)
Object.entries({
  mode: 'student',
  ocrdebug: '1',
  ignoreQrHomography: '1',
  hybridV3: '1',
  v3BurstReplay: '1',
  v3PristineWarp: '1',
  v3SequenceFromZones: '1',
  v3EightFrameColumnOrder: '1',
  v3LocalFirstReview: '1',
  v3ConfidenceSafety: '1',
  v3ConsensusPromotion: '1',
  v3NumberBondShiftDown: '1',
  v3NonrowTrimEvidence: '1',
  v3CoreCropEvidence: '1',
  reviewModelUrl: LARGE,
  v3CompactModelUrl: COMPACT,
  modelPath: '/models/worksheet-digit-tony-generalist-aug-strong-20260601.onnx',
  rightSlotModelPath: '/models/worksheet-digit-tony-generalist-noaug-20260601.onnx',
}).forEach(([key, value]) => url.searchParams.set(key, value))

await Promise.all([health(`${LARGE}/health`, largeService), health(`${COMPACT}/health`, compactService)])
const browser = await webkit.launch({ headless: true })
let report
try {
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true })
  await context.addInitScript(({ key, value }) => sessionStorage.setItem(key, value), {
    key: 'scangrade.reviewAccessToken.v1',
    value: token,
  })
  const page = await context.newPage()
  page.setDefaultTimeout(120_000)
  // Hold only the large-reader response long enough to inspect the compact-ready
  // UI state deterministically. The compact safety pass remains unmodified.
  await page.route('**/recognize', async (route) => {
    if (new URL(route.request().url()).port !== '8894') {
      await route.continue()
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 15000))
    await route.continue()
  })
  await page.goto(url.toString(), { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Debug Scan (exports)' }).click()
  await page.waitForFunction(() => !!window.cv?.Mat)
  await page.evaluate((value) => window.__SCANGRADE_SET_V3_BURST_FRAMES?.(value), frames)
  await page.setInputFiles('input[type=file]', source.file)
  await page.waitForFunction(() => ['compact-ready', 'complete', 'unavailable']
    .includes(window.__SCANGRADE_LIVE_OCR_DEBUG?.v3Shadow?.status))
  await page.waitForFunction(() => !!document.querySelector('mask[id^="progressive-mask-"]'))
  await page.waitForTimeout(180)

  const during = await page.evaluate(() => ({
    status: document.querySelector('.student-scan-grading-word')?.textContent?.trim() || '',
    revealQuestionNums: [...document.querySelectorAll('mask[id^="progressive-mask-"]')]
      .map((node) => Number(node.id.replace('progressive-mask-', ''))),
    revealedStrokeCounts: [...document.querySelectorAll('mask[id^="progressive-mask-"]')]
      .map((node) => node.querySelectorAll('.progressive-marking-stroke').length),
    pendingQuestionNums: window.__SCANGRADE_LIVE_OCR_DEBUG?.v3Shadow?.pendingReviewQuestionNums || [],
    finalImageVisible: document.querySelector('.captured-image')?.getAttribute('src') === window.__SCANGRADE_LIVE_OCR_DEBUG?.markedSheetDataUrl,
  }))

  await page.waitForFunction(() => [...document.querySelectorAll('mask[id^="progressive-mask-"]')]
    .some((node) => node.querySelectorAll('.progressive-marking-stroke').length === 1))
  const singleStrokeCheckPresent = await page.evaluate(() => [...document.querySelectorAll('mask[id^="progressive-mask-"]')]
    .some((node) => node.querySelectorAll('.progressive-marking-stroke').length === 1))
  await page.screenshot({
    path: path.join(ROOT, 'private-evidence/reports/progressive-marking-webkit-20260717.png'),
    fullPage: true,
  })

  await page.waitForFunction(() => ['complete', 'unavailable'].includes(window.__SCANGRADE_LIVE_OCR_DEBUG?.v3Shadow?.status))
  await page.waitForFunction(() => !document.querySelector('.student-scan-grading-word'))
  const after = await page.evaluate(() => ({
    shadowStatus: window.__SCANGRADE_LIVE_OCR_DEBUG?.v3Shadow?.status || '',
    progressiveStatusVisible: !!document.querySelector('.student-scan-grading-word'),
    markedSheetAvailable: !!window.__SCANGRADE_LIVE_OCR_DEBUG?.markedSheetDataUrl,
  }))
  console.log('[webkit] initial grading complete')
  await page.screenshot({
    path: path.join(ROOT, 'private-evidence/reports/progressive-marking-highlighter-webkit-20260718.png'),
    fullPage: true,
  })
  await page.locator('.annotation-hotspot').filter({ hasText: /^A/ }).last().click()
  await page.waitForFunction(() => !!document.querySelector('.student-correction-panel--image'))
  const correctionOpen = await page.evaluate(() => {
    const panel = document.querySelector('.student-correction-panel--image')
    const hotspot = document.querySelector('.annotation-hotspot--active')
    const input = panel?.querySelector('input')
    if (!panel || !hotspot || !input) return null
    const panelRect = panel.getBoundingClientRect()
    const hotspotRect = hotspot.getBoundingClientRect()
    const wrapRect = panel.closest('.captured-image-wrap')?.getBoundingClientRect()
    const focusRect = wrapRect ? {
      left: wrapRect.left + wrapRect.width * Number(hotspot.dataset.focusLeftPct) / 100,
      top: wrapRect.top + wrapRect.height * Number(hotspot.dataset.focusTopPct) / 100,
      right: wrapRect.left + wrapRect.width * (Number(hotspot.dataset.focusLeftPct) + Number(hotspot.dataset.focusWidthPct)) / 100,
      bottom: wrapRect.top + wrapRect.height * (Number(hotspot.dataset.focusTopPct) + Number(hotspot.dataset.focusHeightPct)) / 100,
    } : hotspotRect
    const arrowX = Number.parseFloat(getComputedStyle(panel).getPropertyValue('--correction-arrow-x'))
    const above = panel.classList.contains('student-correction-panel--above')
    const below = panel.classList.contains('student-correction-panel--below')
    const arrowPoint = {
      x: panelRect.left + panelRect.width * arrowX / 100,
      y: above ? panelRect.bottom : panelRect.top,
    }
    return {
      above,
      below,
      inputFocused: document.activeElement === input,
      arrowInsideActiveHotspot:
        arrowPoint.x >= hotspotRect.left && arrowPoint.x <= hotspotRect.right &&
        arrowPoint.y >= hotspotRect.top - 16 && arrowPoint.y <= hotspotRect.bottom + 16,
      panelOverlapsActiveAnswer: !(
        panelRect.right <= focusRect.left ||
        panelRect.left >= focusRect.right ||
        panelRect.bottom <= focusRect.top ||
        panelRect.top >= focusRect.bottom
      ),
      choiceCount: panel.querySelectorAll('.correction-choice-btn').length,
    }
  })
  await page.locator('.captured-image').click({ position: { x: 8, y: 8 } })
  await page.waitForFunction(() => !document.querySelector('.student-correction-panel--image'))
  const outsideTapClosed = await page.evaluate(() => !document.querySelector('.student-correction-panel--image'))
  console.log('[webkit] correction placement and outside-close complete')

  await page.locator('.annotation-hotspot').filter({ hasText: /^A/ }).last().click({ force: true })
  const firstChoice = page.locator('.correction-choice-btn').first()
  await firstChoice.waitFor()
  await firstChoice.click()
  await page.waitForFunction(() => !document.querySelector('.student-correction-panel--image'))
  const oneTapChoiceClosed = await page.evaluate(() => !document.querySelector('.student-correction-panel--image'))
  console.log('[webkit] one-tap correction complete')

  const questionCHotspot = page.locator('.annotation-hotspot').filter({ hasText: /^C/ }).first()
  await questionCHotspot.click({ force: true })
  const wholeAnswerInput = page.locator('.student-correction-panel--image input')
  await wholeAnswerInput.waitFor()
  const wholeAnswerMaxLength = await wholeAnswerInput.getAttribute('maxlength')
  const imageBeforeManualCorrection = await page.locator('.captured-image').getAttribute('src')
  await wholeAnswerInput.fill('11')
  await page.locator('.student-correction-save').click()
  await page.waitForFunction(() => !document.querySelector('.student-correction-panel--image'))
  console.log('[webkit] two-digit correction saved')
  await page.waitForFunction(() => document.querySelector('.student-scan-grading-word')?.textContent?.trim() === 'Grading')
  await page.waitForFunction(() => !!document.querySelector('mask[id="progressive-mask-3"]'))
  const manualCorrectionAnimation = await page.evaluate(() => ({
    status: document.querySelector('.student-scan-grading-word')?.textContent?.trim() || '',
    strokeCount: document.querySelector('mask[id="progressive-mask-3"]')
      ?.querySelectorAll('.progressive-marking-stroke').length || 0,
  }))
  await page.waitForFunction(() => {
    const item = [...document.querySelectorAll('.student-answer-item')]
      .find((node) => node.querySelector('.student-answer-label')?.getAttribute('aria-label')?.startsWith('C'))
    return item?.classList.contains('student-answer-item--correct')
  })
  await page.waitForFunction(() => !document.querySelector('.student-scan-grading-word'))
  console.log('[webkit] correction animation complete')
  const manualWholeAnswerCorrection = await page.evaluate((imageBefore) => {
    const item = [...document.querySelectorAll('.student-answer-item')]
      .find((node) => node.querySelector('.student-answer-label')?.getAttribute('aria-label')?.startsWith('C'))
    return {
      maxLength: document.querySelector('.student-correction-panel--image input')?.getAttribute('maxlength') || null,
      displayText: [...(item?.querySelectorAll('.student-answer-pill') || [])]
        .map((node) => node.textContent?.trim() || '')
        .join(''),
      correct: item?.classList.contains('student-answer-item--correct') === true,
      annotationRecomposed: document.querySelector('.captured-image')?.getAttribute('src') !== imageBefore,
    }
  }, imageBeforeManualCorrection)
  manualWholeAnswerCorrection.maxLength = wholeAnswerMaxLength

  await page.locator('.annotation-hotspot').filter({ hasText: /^A/ }).last().click({ force: true })
  const positionedInput = page.locator('.student-correction-panel--image input')
  await positionedInput.fill('9')
  await page.locator('.student-correction-save').click()
  const ambiguousSingleDigitBlocked = await page.locator('.student-correction-error').isVisible()
  await page.getByRole('button', { name: 'Left blank' }).click()
  const positionedEntry = await positionedInput.inputValue()
  await page.locator('.student-correction-save').click()
  await page.waitForFunction(() => !document.querySelector('.student-correction-panel--image'))
  await page.waitForFunction(() => !document.querySelector('.student-scan-grading-word'))
  console.log('[webkit] positioned one-digit correction complete')
  const positionedDisplay = await page.evaluate(() => {
    const item = [...document.querySelectorAll('.student-answer-item')]
      .find((node) => node.querySelector('.student-answer-label')?.getAttribute('aria-label')?.startsWith('A'))
    return [...(item?.querySelectorAll('.student-answer-pill') || [])]
      .map((node) => node.textContent?.trim() || '')
  })

  await page.locator('.annotation-hotspot').filter({ hasText: /^A/ }).last().click({ force: true })
  await page.getByRole('button', { name: 'No answer' }).click()
  await page.waitForFunction(() => !document.querySelector('.student-correction-panel--image'))
  await page.waitForFunction(() => !document.querySelector('.student-scan-grading-word'))
  console.log('[webkit] no-answer correction complete')
  const noAnswerCorrection = await page.evaluate(() => {
    const item = [...document.querySelectorAll('.student-answer-item')]
      .find((node) => node.querySelector('.student-answer-label')?.getAttribute('aria-label')?.startsWith('A'))
    return {
      display: [...(item?.querySelectorAll('.student-answer-pill') || [])]
        .map((node) => node.textContent?.trim() || ''),
      review: item?.classList.contains('student-answer-item--review') === true,
      incorrect: item?.classList.contains('student-answer-item--incorrect') === true,
    }
  })
  const manualBlankCorrection = {
    ambiguousSingleDigitBlocked,
    positionedEntry,
    positionedDisplay,
    noAnswerCorrection,
  }
  const overlap = during.revealQuestionNums.filter((questionNum) => during.pendingQuestionNums.includes(questionNum))
  report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    during,
    after,
    correctionInteraction: {
      ...correctionOpen,
      outsideTapClosed,
      oneTapChoiceClosed,
      manualWholeAnswerCorrection,
      manualCorrectionAnimation,
      manualBlankCorrection,
    },
    gates: {
      earlySettledMarkVisible: during.revealQuestionNums.length > 0,
      teacherStrokeStructure: during.revealedStrokeCounts.length > 0 &&
        during.revealedStrokeCounts.every((count) => count === 1 || count === 2),
      singleStrokeCheckPresent,
      pendingQuestionsNotRevealed: overlap.length === 0,
      provisionalFinalImageHidden: during.finalImageVisible === false,
      strongReviewCompleted: after.shadowStatus === 'complete',
      animationFinished: after.progressiveStatusVisible === false && after.markedSheetAvailable,
      correctionArrowAnchored: correctionOpen?.arrowInsideActiveHotspot === true,
      correctionPanelDoesNotCoverAnswer: correctionOpen?.panelOverlapsActiveAnswer === false,
      correctionUsesVerticalArrow: correctionOpen?.above === true || correctionOpen?.below === true,
      manualInputFocused: correctionOpen?.inputFocused === true,
      outsideTapClosed,
      oneTapChoiceClosed,
      manualWholeAnswerCorrection:
        manualWholeAnswerCorrection.maxLength === '2' &&
        manualWholeAnswerCorrection.displayText === '11' &&
        manualWholeAnswerCorrection.correct === true &&
        manualWholeAnswerCorrection.annotationRecomposed === true,
      manualCorrectionAnimated:
        manualCorrectionAnimation.status === 'Grading' &&
        manualCorrectionAnimation.strokeCount >= 2,
      manualBlankCorrection:
        manualBlankCorrection.ambiguousSingleDigitBlocked === true &&
        manualBlankCorrection.positionedEntry === '_9' &&
        JSON.stringify(manualBlankCorrection.positionedDisplay) === JSON.stringify(['', '9']) &&
        JSON.stringify(manualBlankCorrection.noAnswerCorrection.display) === JSON.stringify(['', '']) &&
        manualBlankCorrection.noAnswerCorrection.review === false &&
        manualBlankCorrection.noAnswerCorrection.incorrect === true,
    },
  }
  await page.close()
} finally {
  await browser.close()
  for (const child of [largeService, compactService]) {
    if (child.exitCode == null) child.kill('SIGTERM')
  }
}

const destination = path.join(ROOT, 'private-evidence/reports/progressive-marking-webkit-20260717.json')
fs.writeFileSync(destination, `${JSON.stringify(report, null, 2)}\n`)
if (!Object.values(report.gates).every(Boolean)) throw new Error(`progressive marking gates failed: ${JSON.stringify(report)}`)
console.log(JSON.stringify({ destination: path.relative(ROOT, destination), ...report }, null, 2))
