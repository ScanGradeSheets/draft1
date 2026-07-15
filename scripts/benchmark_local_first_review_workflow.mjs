#!/usr/bin/env node

import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const ORIGIN = 'https://localhost:5185'
const token = randomBytes(32).toString('base64url')
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

async function health(url, child, attempts = 300) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (child.exitCode != null) throw new Error(`service exited ${child.exitCode}: ${logs.slice(-8).join('')}`)
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`health timeout: ${url}`)
}

function appUrl() {
  const url = new URL(ORIGIN)
  Object.entries({
    mode: 'teacher', ocrdebug: '1', ignoreQrHomography: '1', hybridV3: '1',
    v3BurstReplay: '1', v3PristineWarp: '1', v3SequenceFromZones: '1',
    v3LocalFirstReview: '1', reviewModelUrl: 'http://127.0.0.1:8874',
    v3CompactModelUrl: 'http://127.0.0.1:8875',
    modelPath: '/models/worksheet-digit-tony-generalist-aug-strong-20260601.onnx',
    rightSlotModelPath: '/models/worksheet-digit-tony-generalist-noaug-20260601.onnx',
  }).forEach(([key, value]) => url.searchParams.set(key, value))
  return url.toString()
}

function questionNumFromLabel(label) {
  const match = String(label || '').trim().toUpperCase().match(/[A-Z]/)
  return match ? match[0].charCodeAt(0) - 64 : NaN
}

function automaticSignature(debug) {
  return {
    predictions: (debug?.predictions || []).map((item) => ({
      id: item.id,
      digit: item.blank === true || item.empty === true ? null : item.digit,
      reviewNeeded: item.reviewNeeded === true,
      correct: item.correct === true,
    })),
    answers: (debug?.answerGroups || []).map((item) => ({
      questionNum: Number(item.questionNum),
      answerText: item.answerText,
      reviewNeeded: item.reviewNeeded === true,
      correct: item.correct === true,
    })),
    questionReview: debug?.questionReview || [],
    questionCorrect: debug?.questionCorrect || [],
  }
}

const evidence = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'private-evidence/reports/v3-review-display-row-full-evaluation-20260714.json'),
  'utf8',
))
const inputs = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'private-evidence/reports/v3-review-display-row-full-20260714/inputs.json'),
  'utf8',
))
const reviewsByPage = new Map()
for (const row of evidence.rows.filter((item) => item.scorable)) {
  const key = `${row.packetId}|${row.layoutId}`
  if (!reviewsByPage.has(key)) reviewsByPage.set(key, [])
  reviewsByPage.get(key).push({ questionNum: Number(row.questionNum), truth: String(row.truth) })
}
const pages = inputs.selected
  .filter((item) => reviewsByPage.has(`${item.packetId}|${item.layoutId}`))
  .map((item) => ({
    ...item,
    reviews: reviewsByPage.get(`${item.packetId}|${item.layoutId}`).sort((a, b) => a.questionNum - b.questionNum),
  }))

const vite = start('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '5185'])
const large = start(path.join(ROOT, '.venv/bin/python'), [
  'scripts/serve_trocr_review.py', '--host', '127.0.0.1', '--port', '8874', '--device', 'cpu', '--offline',
  '--adapter', 'private-evidence/models/trocr-lora-calibrated-2epoch-20260709',
], { SCANGRADE_REVIEW_TOKEN: token, SCANGRADE_REVIEW_ALLOWED_ORIGINS: ORIGIN })
const compact = start(path.join(ROOT, '.venv/bin/python'), ['scripts/serve_v3_compact.py'], {
  PORT: '8875', SCANGRADE_V3_HOST: '127.0.0.1', SCANGRADE_V3_TOKEN: token,
  SCANGRADE_V3_ALLOWED_ORIGINS: ORIGIN,
})

let browser
let report
try {
  await Promise.all([
    health(ORIGIN, vite),
    health('http://127.0.0.1:8874/health', large),
    health('http://127.0.0.1:8875/health', compact),
  ])
  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1024, height: 1366 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 15_7 like Mac OS X) AppleWebKit/605.1.15 Version/15.0 Mobile/15E148 Safari/604.1',
  })
  await context.addInitScript(({ key, value }) => {
    sessionStorage.setItem(key, value)
    window.__SG_MODEL_REQUESTS = []
    const originalFetch = window.fetch.bind(window)
    window.fetch = (input, init = {}) => {
      const url = String(input?.url || input || '')
      if (url.includes('127.0.0.1:8874') || url.includes('127.0.0.1:8875')) {
        let body = null
        try { body = JSON.parse(String(init?.body || '{}')) } catch {}
        window.__SG_MODEL_REQUESTS.push({
          kind: url.includes('8874') ? 'strong' : 'compact',
          at: performance.now(),
          questionNums: (body?.items || []).map((item) => Number(item.questionNum)),
          itemCount: (body?.items || []).length,
        })
      }
      return originalFetch(input, init)
    }
  }, { key: 'scangrade.reviewAccessToken.v1', value: token })

  const page = await context.newPage()
  page.setDefaultTimeout(60_000)
  const pageResults = []
  for (const item of pages) {
    await page.goto(appUrl(), { waitUntil: 'networkidle' })
    await page.waitForFunction(() => !!window.cv?.Mat)
    const burstNames = fs.readdirSync(path.join(item.dir, 'burst-frames'))
      .filter((name) => /^frame-\d+\.(?:png|jpe?g)$/i.test(name)).sort().slice(0, 3)
    const frames = burstNames.map((name, index) => ({
      index, score: 1000 - index, focusScore: 1000 - index, sheetOk: true,
      imageDataUrl: `data:image/png;base64,${fs.readFileSync(path.join(item.dir, 'burst-frames', name)).toString('base64')}`,
    }))
    await page.evaluate((values) => window.__SCANGRADE_SET_V3_BURST_FRAMES?.(values), frames)
    const started = performance.now()
    await page.setInputFiles('input[type=file]', item.captured)
    await page.waitForFunction(() => Array.isArray(window.__SCANGRADE_LIVE_OCR_DEBUG?.predictions))
    const localReadyMs = performance.now() - started
    const automaticBeforeCompact = await page.evaluate(() => ({
      predictions: (window.__SCANGRADE_LIVE_OCR_DEBUG?.predictions || []).map((x) => ({ id: x.id, digit: x.blank || x.empty ? null : x.digit, reviewNeeded: x.reviewNeeded === true, correct: x.correct === true })),
      answers: (window.__SCANGRADE_LIVE_OCR_DEBUG?.answerGroups || []).map((x) => ({ questionNum: Number(x.questionNum), answerText: x.answerText, reviewNeeded: x.reviewNeeded === true, correct: x.correct === true })),
      questionReview: window.__SCANGRADE_LIVE_OCR_DEBUG?.questionReview || [], questionCorrect: window.__SCANGRADE_LIVE_OCR_DEBUG?.questionCorrect || [],
    }))
    await page.waitForFunction(() => ['compact-ready', 'complete'].includes(window.__SCANGRADE_LIVE_OCR_DEBUG?.v3Shadow?.status))
    const compactReadyMs = performance.now() - started
    const automaticAfterCompact = automaticSignature(await page.evaluate(() => window.__SCANGRADE_LIVE_OCR_DEBUG))
    await page.waitForFunction(() => window.__SCANGRADE_LIVE_OCR_DEBUG?.v3Shadow?.status === 'complete')
    const preparedMs = performance.now() - started
    const requestsBeforeReview = await page.evaluate(() => window.__SG_MODEL_REQUESTS)
    const strongBeforeReview = requestsBeforeReview.filter((request) => request.kind === 'strong').length
    const truthByQuestion = new Map(item.reviews.map((review) => [review.questionNum, review.truth]))
    const corrections = []
    let hotspotTaps = 0
    let choiceTaps = 0
    let noneTaps = 0
    let automaticAdvances = 0
    let priorQuestion = null

    while (truthByQuestion.size) {
      const panel = page.locator('.student-correction-panel')
      if (!(await panel.isVisible().catch(() => false))) {
        await page.locator('.annotation-hotspot').first().click()
        hotspotTaps += 1
        await panel.waitFor({ state: 'visible' })
      } else if (priorQuestion != null) {
        automaticAdvances += 1
      }
      const label = await page.locator('.student-correction-label').getAttribute('aria-label')
      const questionNum = questionNumFromLabel(label)
      const truth = truthByQuestion.get(questionNum)
      if (!truth) throw new Error(`${item.packetId}|${item.layoutId}: unexpected review ${label}`)
      let choices = (await page.locator('.correction-choice-btn').allTextContents()).map((value) => value.trim())
      const initialChoices = [...choices]
      let strongRequested = false
      let strongWaitMs = null
      if (!choices.includes(truth)) {
        const button = page.locator('.local-first-none-btn')
        if (!(await button.isVisible())) throw new Error(`${item.packetId}|${item.layoutId}|Q${questionNum}: no local truth and no fallback`)
        const strongCount = await page.evaluate(() => window.__SG_MODEL_REQUESTS.filter((request) => request.kind === 'strong').length)
        const strongStarted = performance.now()
        await button.click()
        noneTaps += 1
        strongRequested = true
        await page.waitForFunction((count) => window.__SG_MODEL_REQUESTS.filter((request) => request.kind === 'strong').length === count + 1, strongCount)
        await page.waitForFunction((q) => (window.__SCANGRADE_LIVE_OCR_DEBUG?.localFirstStrongRequests || []).some((request) => Number(request.questionNum) === q), questionNum)
        strongWaitMs = performance.now() - strongStarted
        choices = (await page.locator('.correction-choice-btn').allTextContents()).map((value) => value.trim())
      }
      if (!choices.includes(truth)) throw new Error(`${item.packetId}|${item.layoutId}|Q${questionNum}: truth ${truth} absent from ${choices.join(',')}`)
      await page.locator('.correction-choice-btn').filter({ hasText: new RegExp(`^\\s*${truth}\\s*$`) }).first().click()
      choiceTaps += 1
      truthByQuestion.delete(questionNum)
      priorQuestion = questionNum
      await page.waitForFunction(({ q, remaining }) => {
        const corrections = window.__SCANGRADE_LIVE_OCR_DEBUG?.manualCorrections || {}
        if (!Object.prototype.hasOwnProperty.call(corrections, String(q))) return false
        const active = document.querySelector('.student-correction-label')?.getAttribute('aria-label') || ''
        const match = active.toUpperCase().match(/[A-Z]/)
        const activeQuestion = match ? match[0].charCodeAt(0) - 64 : NaN
        return remaining === 0 || activeQuestion !== q || !document.querySelector('.student-correction-panel')
      }, { q: questionNum, remaining: truthByQuestion.size })
      corrections.push({ questionNum, truth, initialChoices, finalChoices: choices, strongRequested, strongWaitMs: strongWaitMs == null ? null : Number(strongWaitMs.toFixed(1)) })
    }
    const requests = await page.evaluate(() => window.__SG_MODEL_REQUESTS)
    const strongRequests = requests.filter((request) => request.kind === 'strong')
    const telemetry = await page.evaluate(() => window.__SCANGRADE_LIVE_OCR_DEBUG?.manualCorrections || {})
    pageResults.push({
      packetId: item.packetId, layoutId: item.layoutId, reviewAnswers: item.reviews.length,
      latencyMs: { localReady: Number(localReadyMs.toFixed(1)), compactReady: Number(compactReadyMs.toFixed(1)), compactDelay: Number((compactReadyMs - localReadyMs).toFixed(1)), strongContextPrepared: Number(preparedMs.toFixed(1)) },
      automaticBeforeCompact, automaticAfterCompact,
      automaticInvariantPreserved: JSON.stringify(automaticBeforeCompact) === JSON.stringify(automaticAfterCompact),
      strongBeforeReview, compactRequests: requests.filter((request) => request.kind === 'compact').length,
      strongRequests: strongRequests.length, strongRequestItems: strongRequests.reduce((sum, request) => sum + request.itemCount, 0),
      interactions: { hotspotTaps, choiceTaps, noneTaps, total: hotspotTaps + choiceTaps + noneTaps, automaticAdvances },
      corrections, telemetryCount: Object.keys(telemetry).length,
    })
    console.log(`[ok] ${item.packetId} ${item.layoutId}: ${item.reviews.length} reviews, ${strongRequests.length} strong`)
  }

  const allCorrections = pageResults.flatMap((item) => item.corrections)
  const strongWaits = allCorrections.map((item) => item.strongWaitMs).filter(Number.isFinite).sort((a, b) => a - b)
  const totalReviews = allCorrections.length
  const initialTruth = allCorrections.filter((item) => item.initialChoices.includes(item.truth)).length
  const reportInteractions = pageResults.reduce((output, item) => {
    for (const key of Object.keys(output)) output[key] += item.interactions[key]
    return output
  }, { hotspotTaps: 0, choiceTaps: 0, noneTaps: 0, total: 0, automaticAdvances: 0 })
  report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    scope: 'exact ten-page local-first browser workflow on all retained four-packet row yellows; automated interactions are not human reading time',
    answerKeyUsedForRecognition: false,
    pages: pageResults.length,
    reviewAnswers: totalReviews,
    truthChoiceAvailability: { immediateLocal: initialTruth, afterOnDemandStrong: totalReviews, missing: 0 },
    candidateLists: {
      initialMin: Math.min(...allCorrections.map((item) => item.initialChoices.length)),
      initialMax: Math.max(...allCorrections.map((item) => item.initialChoices.length)),
      initialMean: Number((allCorrections.reduce((sum, item) => sum + item.initialChoices.length, 0) / totalReviews).toFixed(2)),
      existingChoiceLossAfterStrong: allCorrections.filter((item) => !item.initialChoices.every((choice) => item.finalChoices.includes(choice))).length,
    },
    interactions: reportInteractions,
    strongInference: {
      requestsBeforeTeacherAction: pageResults.reduce((sum, item) => sum + item.strongBeforeReview, 0),
      onDemandRequests: pageResults.reduce((sum, item) => sum + item.strongRequests, 0),
      frameItems: pageResults.reduce((sum, item) => sum + item.strongRequestItems, 0),
      reductionVsYellowOnlyEager42FramesPct: Number((100 * (1 - pageResults.reduce((sum, item) => sum + item.strongRequestItems, 0) / 42)).toFixed(1)),
    },
    latencyMs: {
      meanCompactDelayAfterLocal: Number((pageResults.reduce((sum, item) => sum + item.latencyMs.compactDelay, 0) / pageResults.length).toFixed(1)),
      meanOnDemandStrong: strongWaits.length ? Number((strongWaits.reduce((sum, value) => sum + value, 0) / strongWaits.length).toFixed(1)) : null,
      p95OnDemandStrong: strongWaits.length ? strongWaits[Math.min(strongWaits.length - 1, Math.ceil(strongWaits.length * .95) - 1)] : null,
    },
    integrity: {
      automaticInvariantPages: pageResults.filter((item) => item.automaticInvariantPreserved).length,
      allAutomaticInvariantsPreserved: pageResults.every((item) => item.automaticInvariantPreserved),
      telemetryRecorded: pageResults.reduce((sum, item) => sum + item.telemetryCount, 0),
      tokenAppearedInUrlOrLogs: page.url().includes(token) || logs.join('').includes(token),
    },
    pageResults,
  }
  report.gates = {
    allTruthChoicesAvailable: report.truthChoiceAvailability.afterOnDemandStrong === totalReviews,
    noExistingChoiceRemoved: report.candidateLists.existingChoiceLossAfterStrong === 0,
    strongFullyDeferred: report.strongInference.requestsBeforeTeacherAction === 0,
    strongOnlyForUnresolved: report.strongInference.onDemandRequests === totalReviews - initialTruth,
    oneQuestionThreeFramesPerStrongRequest: report.strongInference.frameItems === report.strongInference.onDemandRequests * 3,
    automaticInvariantsPreserved: report.integrity.allAutomaticInvariantsPreserved,
    telemetryComplete: report.integrity.telemetryRecorded === totalReviews,
    tokenNotLeaked: !report.integrity.tokenAppearedInUrlOrLogs,
  }
} finally {
  await browser?.close().catch(() => {})
  for (const child of [vite, large, compact]) if (child.exitCode == null) child.kill('SIGTERM')
  await Promise.all([vite, large, compact].map((child) => child.exitCode == null
    ? new Promise((resolve) => child.once('exit', resolve))
    : Promise.resolve()))
}

if (!report || !Object.values(report.gates).every(Boolean)) throw new Error(`local-first workflow gates failed: ${JSON.stringify(report?.gates)}`)
const destination = path.join(ROOT, 'private-evidence/reports/v3-local-first-workflow-benchmark-20260714.json')
fs.writeFileSync(destination, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ destination: path.relative(ROOT, destination), pages: report.pages, reviewAnswers: report.reviewAnswers, truthChoiceAvailability: report.truthChoiceAvailability, candidateLists: report.candidateLists, interactions: report.interactions, strongInference: report.strongInference, latencyMs: report.latencyMs, integrity: report.integrity, gates: report.gates }, null, 2))
