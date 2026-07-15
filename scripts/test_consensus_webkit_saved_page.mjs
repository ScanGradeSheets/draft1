#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { webkit } from 'playwright'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const APP = process.env.SG_APP_URL || 'https://127.0.0.1:5191'
const LARGE = process.env.SG_LARGE_URL || 'https://127.0.0.1:8894'
const COMPACT = process.env.SG_COMPACT_URL || 'https://127.0.0.1:8895'
const LARGE_DEVICE = process.env.SG_LARGE_DEVICE || 'cpu'
const token = randomBytes(32).toString('base64url')
const tlsPem = path.join(ROOT, 'node_modules/.vite/basic-ssl/_cert.pem')
const logs = []
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

const origin = new URL(APP).origin
const ownedServices = !process.env.SG_LARGE_URL && !process.env.SG_COMPACT_URL
const largeService = ownedServices ? start(path.join(ROOT, '.venv/bin/python'), [
  'scripts/serve_trocr_review.py', '--host', '127.0.0.1', '--port', '8894', '--device', LARGE_DEVICE, '--offline',
  '--adapter', 'private-evidence/models/trocr-lora-calibrated-2epoch-20260709',
], {
  SCANGRADE_REVIEW_TOKEN: token, SCANGRADE_REVIEW_ALLOWED_ORIGINS: origin,
  SCANGRADE_REVIEW_TLS_CERT: tlsPem, SCANGRADE_REVIEW_TLS_KEY: tlsPem,
}) : null
const compactService = ownedServices ? start(path.join(ROOT, '.venv/bin/python'), ['scripts/serve_v3_compact.py'], {
  PORT: '8895', SCANGRADE_V3_HOST: '127.0.0.1', SCANGRADE_V3_TOKEN: token,
  SCANGRADE_V3_ALLOWED_ORIGINS: origin, SCANGRADE_V3_TLS_CERT: tlsPem, SCANGRADE_V3_TLS_KEY: tlsPem,
}) : null
const source = JSON.parse(fs.readFileSync(path.join(ROOT, 'private-evidence/reports/current-four-packet-confidence-safety-20260714/rows.json'), 'utf8'))
  .find((row) => row.id === '2080d9f1-captured')
if (!source) throw new Error('saved P09 number-pattern source is missing')
const captured = source.file
const captureDir = path.dirname(captured)
const frameDir = path.join(captureDir, 'burst-frames')
const frameNames = fs.readdirSync(frameDir).filter((name) => /^frame-\d+\.(?:png|jpe?g)$/i.test(name)).sort().slice(0, 3)
const frames = frameNames.map((name, index) => ({
  index,
  score: 1000 - index,
  focusScore: 1000 - index,
  sheetOk: true,
  imageDataUrl: `data:image/png;base64,${fs.readFileSync(path.join(frameDir, name)).toString('base64')}`,
}))

const url = new URL(APP)
Object.entries({
  mode: 'teacher', ocrdebug: '1', ignoreQrHomography: '1', hybridV3: '1',
  v3BurstReplay: '1', v3PristineWarp: '1', v3SequenceFromZones: '1',
  v3EightFrameColumnOrder: '1', v3LocalFirstReview: '1', v3ConfidenceSafety: '1',
  v3ConsensusPromotion: '1', v3NumberBondShiftDown: '1', v3NonrowTrimEvidence: '1',
  v3CoreCropEvidence: '1', reviewModelUrl: LARGE, v3CompactModelUrl: COMPACT,
  ...(process.env.SG_DEFER_CORROBORATION === '1' ? { v3DeferredCorroboration: '1' } : {}),
  ...(process.env.SG_SHARED_FRAME_PROCESSING === '1' ? { v3SharedFrameProcessing: '1' } : {}),
  modelPath: '/models/worksheet-digit-tony-generalist-aug-strong-20260601.onnx',
  rightSlotModelPath: '/models/worksheet-digit-tony-generalist-noaug-20260601.onnx',
}).forEach(([key, value]) => url.searchParams.set(key, value))

if (ownedServices) await Promise.all([
  health(`${LARGE}/health`, largeService),
  health(`${COMPACT}/health`, compactService),
])
const browser = await webkit.launch({ headless: true })
let report
try {
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1024, height: 1366 }, isMobile: true, hasTouch: true })
  await context.addInitScript(({ key, value }) => sessionStorage.setItem(key, value), {
    key: 'scangrade.reviewAccessToken.v1', value: token,
  })
  const runSavedPage = async () => {
    const page = await context.newPage()
    page.setDefaultTimeout(120_000)
    try {
      await page.goto(url.toString(), { waitUntil: 'networkidle' })
      await page.waitForFunction(() => !!window.cv?.Mat)
      await page.evaluate((value) => window.__SCANGRADE_SET_V3_BURST_FRAMES?.(value), frames)
      const started = Date.now()
      await page.setInputFiles('input[type=file]', captured)
      await page.waitForFunction(() => Array.isArray(window.__SCANGRADE_LIVE_OCR_DEBUG?.predictions))
      const localReadyMs = Date.now() - started
      await page.waitForFunction(() => ['complete', 'unavailable'].includes(window.__SCANGRADE_LIVE_OCR_DEBUG?.v3Shadow?.status))
      const completeMs = Date.now() - started
      const debug = await page.evaluate(() => window.__SCANGRADE_LIVE_OCR_DEBUG)
      return { page, debug, localReadyMs, completeMs }
    } catch (error) {
      await page.close()
      throw error
    }
  }
  const first = await runSavedPage()
  const warm = process.env.SG_WEBKIT_WARM_REPEAT === '1' ? await runSavedPage() : null
  const page = first.page
  const debug = first.debug
  const q1 = debug.answerGroups.find((group) => Number(group.questionNum) === 1)
  report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    engine: 'playwright-webkit-mobile-emulation',
    userAgent: await page.evaluate(() => navigator.userAgent),
    localReadyMs: first.localReadyMs,
    consensusCompleteMs: first.completeMs,
    warmRepeat: warm ? {
      localReadyMs: warm.localReadyMs,
      consensusCompleteMs: warm.completeMs,
      pageCompleted: warm.debug.v3Shadow?.status === 'complete',
      consensusPromotionCount: Number(warm.debug.v3Shadow?.consensusPromotionCount || 0),
    } : null,
    pageCompleted: debug.v3Shadow?.status === 'complete',
    consensusPromotionCount: Number(debug.v3Shadow?.consensusPromotionCount || 0),
    stageTimingsMs: debug.v3Shadow?.stageTimingsMs || null,
    consensusAffectedGrade: debug.v3Shadow?.affectsGrade === true,
    overwrittenQuestionOne: {
      read: q1?.answerText || null,
      reviewNeeded: q1?.reviewNeeded === true,
      promoted: (debug.v3Shadow?.consensusApplication?.applied || []).some((item) => Number(item.questionNum) === 1),
    },
    markedSheetAvailable: Boolean(debug.markedSheetDataUrl),
    answerKeyUsedForRecognition: false,
  }
  report.gates = {
    completed: report.pageCompleted,
    experimentalPromotionsApplied: report.consensusPromotionCount > 0 && report.consensusAffectedGrade,
    overwrittenWorkStayedReview: report.overwrittenQuestionOne.reviewNeeded && !report.overwrittenQuestionOne.promoted,
    markedSheetRegenerated: report.markedSheetAvailable,
    warmRepeatCompleted: !warm || (report.warmRepeat.pageCompleted && report.warmRepeat.consensusPromotionCount > 0),
  }
  await first.page.close()
  if (warm) await warm.page.close()
} finally {
  await browser.close()
  for (const child of [largeService, compactService].filter(Boolean)) {
    if (child.exitCode == null) child.kill('SIGTERM')
    if (child.exitCode == null) await new Promise((resolve) => child.once('exit', resolve))
  }
}

if (!Object.values(report.gates).every(Boolean)) throw new Error(`WebKit consensus gates failed: ${JSON.stringify(report)}`)
const destination = path.join(ROOT, process.env.SG_WEBKIT_OUT || 'private-evidence/reports/consensus-webkit-saved-page-20260714.json')
fs.writeFileSync(destination, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ destination: path.relative(ROOT, destination), ...report }, null, 2))
