#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const APP_URL = process.env.SG_REVIEW_BENCHMARK_URL || 'https://localhost:5174'
const LARGE_URL = process.env.SG_REVIEW_MODEL_URL || 'http://127.0.0.1:8768'
const COMPACT_URL = process.env.SG_COMPACT_MODEL_URL || 'http://127.0.0.1:8769'
const OUT = path.resolve(ROOT, process.env.SG_REVIEW_BENCHMARK_OUT || 'private-evidence/reports/v3-review-workflow-benchmark-20260714.json')
const evidence = JSON.parse(await fs.readFile(path.join(ROOT, 'private-evidence/reports/v3-review-display-row-full-evaluation-20260714.json'), 'utf8'))
const inputs = JSON.parse(await fs.readFile(path.join(ROOT, 'private-evidence/reports/v3-review-display-row-full-20260714/inputs.json'), 'utf8'))

const reviewsByPage = new Map()
for (const row of evidence.rows.filter((item) => item.scorable)) {
  const key = `${row.packetId}|${row.layoutId}`
  if (!reviewsByPage.has(key)) reviewsByPage.set(key, [])
  reviewsByPage.get(key).push({ questionNum: Number(row.questionNum), truth: String(row.truth) })
}
const pages = inputs.selected
  .filter((item) => reviewsByPage.has(`${item.packetId}|${item.layoutId}`))
  .map((item) => ({ ...item, reviews: reviewsByPage.get(`${item.packetId}|${item.layoutId}`).sort((a, b) => a.questionNum - b.questionNum) }))

function appUrl() {
  const url = new URL(APP_URL)
  Object.entries({
    mode: 'teacher', ocrdebug: '1', ignoreQrHomography: '1', hybridV3: '1',
    v3BurstReplay: '1', v3PristineWarp: '1', v3SequenceFromZones: '1',
    reviewModelUrl: LARGE_URL, v3CompactModelUrl: COMPACT_URL,
    modelPath: '/models/worksheet-digit-tony-generalist-aug-strong-20260601.onnx',
    rightSlotModelPath: '/models/worksheet-digit-tony-generalist-noaug-20260601.onnx',
  }).forEach(([key, value]) => url.searchParams.set(key, value))
  return url.toString()
}

function questionNumFromLabel(label) {
  const clean = String(label || '').trim().toUpperCase()
  const match = clean.match(/[A-Z]/)
  return match ? match[0].charCodeAt(0) - 64 : NaN
}

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  ignoreHTTPSErrors: true,
  viewport: { width: 1024, height: 1366 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPad; CPU OS 15_7 like Mac OS X) AppleWebKit/605.1.15 Version/15.0 Mobile/15E148 Safari/604.1',
})
const page = await context.newPage()
page.setDefaultTimeout(60_000)
const pageResults = []

for (const item of pages) {
  await page.goto(appUrl(), { waitUntil: 'networkidle' })
  await page.waitForFunction(() => !!window.cv?.Mat)
  const burstNames = (await fs.readdir(path.join(item.dir, 'burst-frames')))
    .filter((name) => /^frame-\d+\.(?:png|jpe?g)$/i.test(name)).sort().slice(0, 3)
  const frames = await Promise.all(burstNames.map(async (name, index) => ({
    index, score: 1000 - index, focusScore: 1000 - index, sheetOk: true,
    imageDataUrl: `data:image/png;base64,${(await fs.readFile(path.join(item.dir, 'burst-frames', name))).toString('base64')}`,
  })))
  await page.evaluate((values) => window.__SCANGRADE_SET_V3_BURST_FRAMES?.(values), frames)

  const processingStarted = performance.now()
  await page.setInputFiles('input[type=file]', item.captured)
  await page.waitForFunction(() => {
    const debug = window.__SCANGRADE_LIVE_OCR_DEBUG
    return debug?.predictions?.length > 0 && debug?.answerGroups?.length > 0
  })
  const localReadyMs = performance.now() - processingStarted
  await page.waitForFunction(() => ['complete', 'unavailable'].includes(window.__SCANGRADE_LIVE_OCR_DEBUG?.v3Shadow?.status), undefined, { timeout: 60_000 })
  await page.waitForSelector('.annotation-hotspot')
  const suggestionReadyMs = performance.now() - processingStarted
  const truthByQuestion = new Map(item.reviews.map((review) => [review.questionNum, review.truth]))
  const corrections = []
  let hotspotOpens = 0
  let automaticAdvances = 0
  let previousQuestion = null
  const reviewStarted = performance.now()

  while (truthByQuestion.size) {
    const panel = page.locator('.student-correction-panel')
    if (!(await panel.isVisible().catch(() => false))) {
      await page.locator('.annotation-hotspot').first().click()
      hotspotOpens += 1
      await panel.waitFor({ state: 'visible' })
    } else if (previousQuestion != null) {
      automaticAdvances += 1
    }
    const label = (await page.locator('.student-correction-label').getAttribute('aria-label'))?.trim()
    const questionNum = questionNumFromLabel(label)
    const truth = truthByQuestion.get(questionNum)
    if (!truth) throw new Error(`${item.packetId}|${item.layoutId}: unexpected active review ${label}`)
    const choiceTexts = (await page.locator('.correction-choice-btn').allTextContents()).map((value) => value.trim())
    if (!choiceTexts.includes(truth)) throw new Error(`${item.packetId}|${item.layoutId}|Q${questionNum}: truth ${truth} absent from ${choiceTexts.join(',')}`)
    const choice = page.locator('.correction-choice-btn').filter({ hasText: new RegExp(`^\\s*${truth}\\s*$`) }).first()
    const clickStarted = performance.now()
    await choice.click()
    truthByQuestion.delete(questionNum)
    previousQuestion = questionNum
    await page.waitForFunction(({ prior, remaining }) => {
      const active = document.querySelector('.student-correction-label')?.textContent?.trim() || ''
      const activeNumber = active.length === 1 ? active.toUpperCase().charCodeAt(0) - 64 : NaN
      const corrections = window.__SCANGRADE_LIVE_OCR_DEBUG?.manualCorrections || {}
      return Object.prototype.hasOwnProperty.call(corrections, String(prior)) && (remaining === 0 || activeNumber !== prior || !document.querySelector('.student-correction-panel'))
    }, { prior: questionNum, remaining: truthByQuestion.size })
    corrections.push({ questionNum, truth, choices: choiceTexts, clickToSettledMs: Number((performance.now() - clickStarted).toFixed(1)) })
  }
  const reviewMs = performance.now() - reviewStarted
  const telemetry = await page.evaluate(() => window.__SCANGRADE_LIVE_OCR_DEBUG?.manualCorrections || {})
  pageResults.push({
    packetId: item.packetId, layoutId: item.layoutId, reviewAnswers: item.reviews.length,
    localReadyMs: Number(localReadyMs.toFixed(1)),
    suggestionReadyMs: Number(suggestionReadyMs.toFixed(1)),
    suggestionDelayAfterLocalMs: Number((suggestionReadyMs - localReadyMs).toFixed(1)),
    reviewAutomationMs: Number(reviewMs.toFixed(1)),
    hotspotOpens, choiceTaps: item.reviews.length, automaticAdvances, corrections, telemetry,
  })
  console.log(`[ok] ${item.packetId} ${item.layoutId}: ${item.reviews.length} reviews, ${reviewMs.toFixed(0)} ms automation`)
}

await browser.close()
const correctionLatencies = pageResults.flatMap((item) => item.corrections.map((row) => row.clickToSettledMs)).sort((a, b) => a - b)
const totalReviews = pageResults.reduce((sum, item) => sum + item.reviewAnswers, 0)
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  measurementType: 'automated end-to-end UI latency and interaction-count baseline; not human teacher reading time',
  answerKeyUsedAsTruth: false,
  pages: pageResults.length,
  reviewAnswers: totalReviews,
  interactionCounts: {
    firstHotspotTaps: pageResults.reduce((sum, item) => sum + item.hotspotOpens, 0),
    correctionChoiceTaps: totalReviews,
    totalRequiredTaps: pageResults.reduce((sum, item) => sum + item.hotspotOpens, 0) + totalReviews,
    automaticAdvances: pageResults.reduce((sum, item) => sum + item.automaticAdvances, 0),
  },
  latency: {
    meanLocalResultReadyMs: Number((pageResults.reduce((sum, item) => sum + item.localReadyMs, 0) / pageResults.length).toFixed(1)),
    meanSuggestionReadyMs: Number((pageResults.reduce((sum, item) => sum + item.suggestionReadyMs, 0) / pageResults.length).toFixed(1)),
    meanSuggestionDelayAfterLocalMs: Number((pageResults.reduce((sum, item) => sum + item.suggestionDelayAfterLocalMs, 0) / pageResults.length).toFixed(1)),
    totalReviewAutomationMs: Number(pageResults.reduce((sum, item) => sum + item.reviewAutomationMs, 0).toFixed(1)),
    meanCorrectionClickToSettledMs: Number((correctionLatencies.reduce((sum, value) => sum + value, 0) / correctionLatencies.length).toFixed(1)),
    p95CorrectionClickToSettledMs: correctionLatencies[Math.min(correctionLatencies.length - 1, Math.ceil(correctionLatencies.length * 0.95) - 1)],
  },
  integrity: {
    truthChoiceAvailable: totalReviews,
    truthChoiceMissing: 0,
    telemetryRecorded: pageResults.reduce((sum, item) => sum + Object.keys(item.telemetry).length, 0),
  },
  pageResults,
}
await fs.writeFile(OUT, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ output: path.relative(ROOT, OUT), pages: report.pages, reviewAnswers: report.reviewAnswers, interactionCounts: report.interactionCounts, latency: report.latency, integrity: report.integrity }, null, 2))
