#!/usr/bin/env node

import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { webkit } from 'playwright'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const ORIGIN = 'https://localhost:5187'
const token = randomBytes(32).toString('base64url')
const logs = []
const tlsPem = path.join(ROOT, 'node_modules/.vite/basic-ssl/_cert.pem')
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

function start(command, args, env = {}) {
  const child = spawn(command, args, { cwd: ROOT, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] })
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

const vite = start('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '5187'])
const large = start(path.join(ROOT, '.venv/bin/python'), [
  'scripts/serve_trocr_review.py', '--host', '127.0.0.1', '--port', '8876', '--device', 'cpu', '--offline',
  '--adapter', 'private-evidence/models/trocr-lora-calibrated-2epoch-20260709',
], {
  SCANGRADE_REVIEW_TOKEN: token, SCANGRADE_REVIEW_ALLOWED_ORIGINS: ORIGIN,
  SCANGRADE_REVIEW_TLS_CERT: tlsPem, SCANGRADE_REVIEW_TLS_KEY: tlsPem,
})
const compact = start(path.join(ROOT, '.venv/bin/python'), ['scripts/serve_v3_compact.py'], {
  PORT: '8877', SCANGRADE_V3_HOST: '127.0.0.1', SCANGRADE_V3_TOKEN: token,
  SCANGRADE_V3_ALLOWED_ORIGINS: ORIGIN,
  SCANGRADE_V3_TLS_CERT: tlsPem, SCANGRADE_V3_TLS_KEY: tlsPem,
})

let browser
let report
try {
  await Promise.all([
    health(ORIGIN, vite), health('https://127.0.0.1:8876/health', large), health('https://127.0.0.1:8877/health', compact),
  ])
  const input = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'private-evidence/reports/v3-review-display-row-full-20260714/inputs.json'), 'utf8',
  )).selected.find((row) => row.packetId === 'P02' && row.layoutId === 'sg-g1-lw-05-mixed-20')
  const names = fs.readdirSync(path.join(input.dir, 'burst-frames'))
    .filter((name) => /^frame-\d+\.(?:png|jpe?g)$/i.test(name)).sort().slice(0, 3)
  const frames = names.map((name, index) => ({
    index, score: 1000 - index, focusScore: 1000 - index, sheetOk: true,
    imageDataUrl: `data:image/png;base64,${fs.readFileSync(path.join(input.dir, 'burst-frames', name)).toString('base64')}`,
  }))
  browser = await webkit.launch({ headless: true })
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 768, height: 1024 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 15_7 like Mac OS X) AppleWebKit/605.1.15 Version/15.0 Mobile/15E148 Safari/604.1',
  })
  await context.addInitScript(({ key, value }) => {
    sessionStorage.setItem(key, value)
    window.__SG_STRONG_REQUESTS = []
    const originalFetch = window.fetch.bind(window)
    window.fetch = (input, init = {}) => {
      const url = String(input?.url || input || '')
      if (url.includes('127.0.0.1:8876')) {
        let body = null
        try { body = JSON.parse(String(init?.body || '{}')) } catch {}
        window.__SG_STRONG_REQUESTS.push((body?.items || []).map((item) => ({
          questionNum: Number(item.questionNum),
          cropVariant: item.cropVariant || null,
        })))
      }
      return originalFetch(input, init)
    }
  }, { key: 'scangrade.reviewAccessToken.v1', value: token })
  const page = await context.newPage()
  page.setDefaultTimeout(90_000)
  const url = new URL(ORIGIN)
  Object.entries({
    mode: 'teacher', ocrdebug: '1', ignoreQrHomography: '1', hybridV3: '1', v3BurstReplay: '1',
    v3PristineWarp: '1', v3SequenceFromZones: '1', v3LocalFirstReview: '1',
    v3StitchedOnDemandReview: '1', v3ContextCropReview: '0',
    reviewModelUrl: 'https://127.0.0.1:8876', v3CompactModelUrl: 'https://127.0.0.1:8877',
    modelPath: '/models/worksheet-digit-tony-generalist-aug-strong-20260601.onnx',
    rightSlotModelPath: '/models/worksheet-digit-tony-generalist-noaug-20260601.onnx',
  }).forEach(([key, value]) => url.searchParams.set(key, value))
  const navigationStarted = performance.now()
  await page.goto(url.toString(), { waitUntil: 'networkidle' })
  await page.waitForFunction(() => !!window.cv?.Mat)
  const appReadyMs = performance.now() - navigationStarted
  await page.evaluate((values) => window.__SCANGRADE_SET_V3_BURST_FRAMES?.(values), frames)
  const scanStarted = performance.now()
  await page.setInputFiles('input[type=file]', input.captured)
  await page.waitForFunction(() => Array.isArray(window.__SCANGRADE_LIVE_OCR_DEBUG?.predictions))
  const localReadyMs = performance.now() - scanStarted
  await page.waitForFunction(() => ['compact-ready', 'complete'].includes(window.__SCANGRADE_LIVE_OCR_DEBUG?.v3Shadow?.status))
  const compactReadyMs = performance.now() - scanStarted
  await page.waitForFunction(() => window.__SCANGRADE_LIVE_OCR_DEBUG?.v3Shadow?.status === 'complete')
  const preparedMs = performance.now() - scanStarted
  const requestsBeforeTeacher = await page.evaluate(() => window.__SG_STRONG_REQUESTS.length)

  let openedQ4 = false
  const hotspots = page.locator('.annotation-hotspot')
  for (let index = 0; index < await hotspots.count(); index += 1) {
    await hotspots.nth(index).click()
    const label = await page.locator('.student-correction-label').getAttribute('aria-label')
    if (String(label || '').toUpperCase().includes('D')) { openedQ4 = true; break }
    await page.locator('.student-correction-close').click()
  }
  if (!openedQ4) throw new Error('could not open P02 mixed Q4 in WebKit')
  const initialChoices = (await page.locator('.correction-choice-btn').allTextContents()).map((value) => value.trim())
  const strongStarted = performance.now()
  await page.locator('.local-first-none-btn').click()
  await page.waitForFunction(() => window.__SG_STRONG_REQUESTS.length === 1)
  await page.waitForFunction(() => (window.__SCANGRADE_LIVE_OCR_DEBUG?.localFirstStrongRequests || []).some((request) => Number(request.questionNum) === 4))
  const strongReadyMs = performance.now() - strongStarted
  const finalChoices = (await page.locator('.correction-choice-btn').allTextContents()).map((value) => value.trim())
  const truthChoiceIndex = finalChoices.indexOf('9')
  if (truthChoiceIndex < 0) throw new Error(`WebKit strong result did not expose 9: ${JSON.stringify(finalChoices)}`)
  await page.locator('.correction-choice-btn').nth(truthChoiceIndex).click()
  await page.waitForFunction(() => window.__SCANGRADE_LIVE_OCR_DEBUG?.manualCorrections?.['4']?.text === '9')
  const debug = await page.evaluate(() => window.__SCANGRADE_LIVE_OCR_DEBUG)
  const strongRequests = await page.evaluate(() => window.__SG_STRONG_REQUESTS)
  report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    engine: 'Playwright WebKit',
    emulatedDevice: 'older iPad viewport and iPadOS 15.7 Safari user-agent; not physical-device proof',
    latencyMs: {
      appReady: Number(appReadyMs.toFixed(1)), localResult: Number(localReadyMs.toFixed(1)),
      compactChoices: Number(compactReadyMs.toFixed(1)), compactDelayAfterLocal: Number((compactReadyMs - localReadyMs).toFixed(1)),
      strongContextPrepared: Number(preparedMs.toFixed(1)), onDemandStrong: Number(strongReadyMs.toFixed(1)),
    },
    modelInfo: debug.modelInfo,
    retainedFrameCount: frames.length,
    retainedFramePayloadBytes: frames.reduce((sum, frame) => sum + Math.ceil(frame.imageDataUrl.length * .75), 0),
    requestsBeforeTeacher,
    strongRequests,
    initialChoices,
    finalChoices,
    truthAvailableAfterStrong: finalChoices.includes('9'),
    correctionRecorded: debug.manualCorrections?.['4']?.text === '9',
    existingChoicesPreserved: initialChoices.every((choice) => finalChoices.includes(choice)),
    tokenAppearedInUrlOrLogs: page.url().includes(token) || logs.join('').includes(token),
    physicalDeviceStillRequired: true,
  }
  report.gates = {
    appAndModelsLoaded: Array.isArray(debug.predictions) && debug.predictions.length > 0,
    localFirstCompleted: debug.v3Shadow?.status === 'complete',
    strongDeferred: requestsBeforeTeacher === 0,
    oneQuestionOneStitchedCrop: strongRequests.length === 1 && strongRequests[0].length === 1 &&
      strongRequests[0][0]?.questionNum === 4 && strongRequests[0][0]?.cropVariant === 'stitched-original-grayscale',
    truthChoiceUsable: report.truthAvailableAfterStrong && report.correctionRecorded,
    noChoiceLoss: report.existingChoicesPreserved,
    tokenNotLeaked: !report.tokenAppearedInUrlOrLogs,
  }
} finally {
  await browser?.close().catch(() => {})
  for (const child of [vite, large, compact]) if (child.exitCode == null) child.kill('SIGTERM')
  await Promise.all([vite, large, compact].map((child) => child.exitCode == null ? new Promise((resolve) => child.once('exit', resolve)) : Promise.resolve()))
}

if (!report || !Object.values(report.gates).every(Boolean)) throw new Error(`WebKit gates failed: ${JSON.stringify(report)}`)
const destination = path.join(ROOT, 'private-evidence/reports/v3-local-first-webkit-ipad-20260714.json')
fs.writeFileSync(destination, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ destination: path.relative(ROOT, destination), ...report }, null, 2))
