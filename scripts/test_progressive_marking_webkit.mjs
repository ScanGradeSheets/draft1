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
  await page.waitForTimeout(900)

  const during = await page.evaluate(() => ({
    status: document.querySelector('.progressive-marking-status')?.textContent?.trim() || '',
    revealQuestionNums: [...document.querySelectorAll('clipPath[id^="progressive-clip-"]')]
      .map((node) => Number(node.id.replace('progressive-clip-', ''))),
    pendingQuestionNums: window.__SCANGRADE_LIVE_OCR_DEBUG?.v3Shadow?.pendingReviewQuestionNums || [],
    finalImageVisible: document.querySelector('.captured-image')?.getAttribute('src') === window.__SCANGRADE_LIVE_OCR_DEBUG?.markedSheetDataUrl,
  }))

  await page.waitForFunction(() => ['complete', 'unavailable'].includes(window.__SCANGRADE_LIVE_OCR_DEBUG?.v3Shadow?.status))
  await page.waitForFunction(() => !document.querySelector('.progressive-marking-status'))
  const after = await page.evaluate(() => ({
    shadowStatus: window.__SCANGRADE_LIVE_OCR_DEBUG?.v3Shadow?.status || '',
    progressiveStatusVisible: !!document.querySelector('.progressive-marking-status'),
    markedSheetAvailable: !!window.__SCANGRADE_LIVE_OCR_DEBUG?.markedSheetDataUrl,
  }))
  const overlap = during.revealQuestionNums.filter((questionNum) => during.pendingQuestionNums.includes(questionNum))
  report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    during,
    after,
    gates: {
      earlySettledMarkVisible: during.revealQuestionNums.length > 0,
      pendingQuestionsNotRevealed: overlap.length === 0,
      provisionalFinalImageHidden: during.finalImageVisible === false,
      strongReviewCompleted: after.shadowStatus === 'complete',
      animationFinished: after.progressiveStatusVisible === false && after.markedSheetAvailable,
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
