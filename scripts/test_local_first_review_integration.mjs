#!/usr/bin/env node

import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const ORIGIN = 'https://localhost:5184'
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
const token = randomBytes(32).toString('base64url')
const logs = []

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

async function health(url, child, attempts = 240) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (child?.exitCode != null) throw new Error(`service exited ${child.exitCode}: ${logs.slice(-5).join('')}`)
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`health timeout: ${url}`)
}

const vite = start('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '5184'])
const large = start(path.join(ROOT, '.venv/bin/python'), [
  'scripts/serve_trocr_review.py', '--host', '127.0.0.1', '--port', '8872', '--device', 'cpu', '--offline',
  '--adapter', 'private-evidence/models/trocr-lora-calibrated-2epoch-20260709',
], { SCANGRADE_REVIEW_TOKEN: token, SCANGRADE_REVIEW_ALLOWED_ORIGINS: ORIGIN })
const compact = start(path.join(ROOT, '.venv/bin/python'), ['scripts/serve_v3_compact.py'], {
  PORT: '8873',
  SCANGRADE_V3_HOST: '127.0.0.1',
  SCANGRADE_V3_TOKEN: token,
  SCANGRADE_V3_ALLOWED_ORIGINS: ORIGIN,
})

let browser
let report = null
try {
  await Promise.all([
    health(ORIGIN, vite),
    health('http://127.0.0.1:8872/health', large),
    health('http://127.0.0.1:8873/health', compact),
  ])
  const selected = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'private-evidence/reports/v3-review-display-row-full-20260714/inputs.json'),
    'utf8',
  )).selected.find((row) => row.packetId === 'P03' && row.layoutId === 'sg-g1-lw-02-add-2digit')
  const burstNames = fs.readdirSync(path.join(selected.dir, 'burst-frames'))
    .filter((name) => /^frame-\d+\.(?:png|jpe?g)$/i.test(name)).sort().slice(0, 3)
  const frames = burstNames.map((name, index) => ({
    index,
    score: 1000 - index,
    focusScore: 1000 - index,
    sheetOk: true,
    imageDataUrl: `data:image/png;base64,${fs.readFileSync(path.join(selected.dir, 'burst-frames', name)).toString('base64')}`,
  }))

  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ ignoreHTTPSErrors: true })
  await context.addInitScript(({ key, value }) => {
    sessionStorage.setItem(key, value)
    window.__SG_REVIEW_REQUESTS = []
    const originalFetch = window.fetch.bind(window)
    window.fetch = (input, init = {}) => {
      const url = String(input?.url || input || '')
      if (url.includes('127.0.0.1:8872')) {
        let body = null
        try { body = JSON.parse(String(init?.body || '{}')) } catch {}
        window.__SG_REVIEW_REQUESTS.push({ url, questionNums: (body?.items || []).map((item) => item.questionNum) })
      }
      return originalFetch(input, init)
    }
  }, { key: 'scangrade.reviewAccessToken.v1', value: token })
  const page = await context.newPage()
  const url = new URL(ORIGIN)
  Object.entries({
    mode: 'teacher', ocrdebug: '1', ignoreQrHomography: '1', hybridV3: '1', v3BurstReplay: '1',
    v3PristineWarp: '1', v3SequenceFromZones: '1', v3LocalFirstReview: '1',
    reviewModelUrl: 'http://127.0.0.1:8872', v3CompactModelUrl: 'http://127.0.0.1:8873',
    modelPath: '/models/worksheet-digit-tony-generalist-aug-strong-20260601.onnx',
    rightSlotModelPath: '/models/worksheet-digit-tony-generalist-noaug-20260601.onnx',
  }).forEach(([key, value]) => url.searchParams.set(key, value))
  await page.goto(url.toString(), { waitUntil: 'networkidle' })
  await page.waitForFunction(() => !!window.cv?.Mat)
  await page.evaluate((values) => window.__SCANGRADE_SET_V3_BURST_FRAMES?.(values), frames)
  const scanStarted = performance.now()
  await page.setInputFiles('input[type=file]', selected.captured)
  await page.waitForFunction(() => Array.isArray(window.__SCANGRADE_LIVE_OCR_DEBUG?.predictions))
  const localResultReadyMs = performance.now() - scanStarted
  await page.waitForFunction(() => ['compact-ready', 'complete'].includes(window.__SCANGRADE_LIVE_OCR_DEBUG?.v3Shadow?.status), undefined, { timeout: 60_000 })
  const compactChoicesReadyMs = performance.now() - scanStarted
  await page.waitForFunction(() => window.__SCANGRADE_LIVE_OCR_DEBUG?.v3Shadow?.status === 'complete', undefined, { timeout: 60_000 })
  const initialShadow = await page.evaluate(() => window.__SCANGRADE_LIVE_OCR_DEBUG?.v3Shadow)
  const requestsBeforeTeacherAction = await page.evaluate(() => window.__SG_REVIEW_REQUESTS.length)
  const hotspots = page.locator('.annotation-hotspot')
  let openedLocalFirst = false
  for (let index = 0; index < await hotspots.count(); index += 1) {
    await hotspots.nth(index).click()
    if (await page.locator('.local-first-none-btn').isVisible()) {
      openedLocalFirst = true
      break
    }
    await page.locator('.student-correction-close').click().catch(() => {})
  }
  if (!openedLocalFirst) {
    const diagnostics = await page.evaluate(() => ({
      shadow: window.__SCANGRADE_LIVE_OCR_DEBUG?.v3Shadow,
      suggestions: window.__SCANGRADE_LIVE_OCR_DEBUG?.predictions?.map((prediction) => ({
        id: prediction.id,
        count: prediction.wholeAnswerReviewSuggestions?.length || 0,
      })).filter((row) => row.count),
      hotspotCount: document.querySelectorAll('.annotation-hotspot').length,
    }))
    throw new Error(`no local-first review panel: ${JSON.stringify(diagnostics)}`)
  }
  const initialChoices = (await page.locator('.correction-choice-btn').allTextContents()).map((value) => value.trim())
  const strongStarted = performance.now()
  await page.locator('.local-first-none-btn').click()
  await page.waitForFunction(() => window.__SG_REVIEW_REQUESTS.length === 1, undefined, { timeout: 30_000 })
  await page.waitForFunction(() => {
    const status = document.querySelector('.local-first-none-btn')?.textContent || ''
    return !status.includes('Checking another reader')
  }, undefined, { timeout: 60_000 }).catch(() => {})
  const onDemandStrongReadyMs = performance.now() - strongStarted
  const request = await page.evaluate(() => window.__SG_REVIEW_REQUESTS[0])
  const choicesAfterStrong = (await page.locator('.correction-choice-btn').allTextContents()).map((value) => value.trim())
  const uniqueQuestions = [...new Set(request.questionNums)]
  report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    initialArchitecture: initialShadow.reviewArchitecture,
    compactChoiceCount: initialShadow.compactChoiceCount,
    strongInferenceDeferred: initialShadow.strongInferenceDeferred,
    requestsBeforeTeacherAction,
    strongRequestsAfterNoneOfThese: 1,
    strongRequestItemCount: request.questionNums.length,
    strongRequestQuestionNums: uniqueQuestions,
    latencyMs: {
      localResultReady: Number(localResultReadyMs.toFixed(1)),
      compactChoicesReady: Number(compactChoicesReadyMs.toFixed(1)),
      compactDelayAfterLocal: Number((compactChoicesReadyMs - localResultReadyMs).toFixed(1)),
      onDemandStrongReady: Number(onDemandStrongReadyMs.toFixed(1)),
    },
    initialChoices,
    choicesAfterStrong,
    existingChoicesPreserved: initialChoices.every((choice) => choicesAfterStrong.includes(choice)),
    tokenAppearedInUrl: page.url().includes(token),
    tokenAppearedInLogs: logs.join('').includes(token),
  }
  report.gates = {
    compactWasImmediate: report.compactChoiceCount > 0,
    strongWasDeferred: report.strongInferenceDeferred && requestsBeforeTeacherAction === 0,
    oneQuestionOnly: uniqueQuestions.length === 1,
    existingChoicesPreserved: report.existingChoicesPreserved,
    tokenNotLeaked: !report.tokenAppearedInUrl && !report.tokenAppearedInLogs,
  }
} finally {
  await browser?.close().catch(() => {})
  for (const child of [vite, large, compact]) if (child.exitCode == null) child.kill('SIGTERM')
  await Promise.all([vite, large, compact].map((child) => child.exitCode == null
    ? new Promise((resolve) => child.once('exit', resolve))
    : Promise.resolve()))
}

if (!report || !Object.values(report.gates).every(Boolean)) throw new Error(`local-first integration failed: ${JSON.stringify(report)}`)
const destination = path.join(ROOT, 'private-evidence/reports/v3-local-first-app-integration-20260714.json')
fs.writeFileSync(destination, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ destination: path.relative(ROOT, destination), ...report }, null, 2))
