#!/usr/bin/env node

import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const ORIGIN = 'https://localhost:5186'
const token = randomBytes(32).toString('base64url')
const logs = []
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

function start(command, args) {
  const child = spawn(command, args, { cwd: ROOT, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] })
  child.stdout.on('data', (chunk) => logs.push(String(chunk)))
  child.stderr.on('data', (chunk) => logs.push(String(chunk)))
  return child
}

async function health(url, child) {
  for (let attempt = 0; attempt < 240; attempt += 1) {
    if (child.exitCode != null) throw new Error(`vite exited ${child.exitCode}: ${logs.join('')}`)
    try { if ((await fetch(url)).ok) return } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('vite health timeout')
}

function core(debug) {
  return {
    predictions: (debug?.predictions || []).map((row) => ({
      id: row.id, digit: row.blank || row.empty ? null : row.digit,
      confidence: row.confidence, topGap: row.topGap,
      reviewNeeded: row.reviewNeeded, correct: row.correct,
    })),
    questionCorrect: debug?.questionCorrect,
    questionReview: debug?.questionReview,
    answerGroups: debug?.answerGroups,
  }
}

const vite = start('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '5186'])
let browser
let report
try {
  await health(ORIGIN, vite)
  const input = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'private-evidence/reports/v3-review-display-row-full-20260714/inputs.json'),
    'utf8',
  )).selected.find((row) => row.packetId === 'P02' && row.layoutId === 'sg-g1-lw-05-mixed-20')
  const burstNames = fs.readdirSync(path.join(input.dir, 'burst-frames'))
    .filter((name) => /^frame-\d+\.(?:png|jpe?g)$/i.test(name)).sort().slice(0, 3)
  const frames = burstNames.map((name, index) => ({
    index, score: 1000 - index, focusScore: 1000 - index, sheetOk: true,
    imageDataUrl: `data:image/png;base64,${fs.readFileSync(path.join(input.dir, 'burst-frames', name)).toString('base64')}`,
  }))
  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ ignoreHTTPSErrors: true })
  await context.addInitScript(({ key, value }) => {
    sessionStorage.setItem(key, value)
    window.__SG_FAILED_MODEL_REQUESTS = []
    const originalFetch = window.fetch.bind(window)
    window.fetch = (input, init = {}) => {
      const url = String(input?.url || input || '')
      if (url.includes('127.0.0.1:8997') || url.includes('127.0.0.1:8998')) {
        window.__SG_FAILED_MODEL_REQUESTS.push(url.includes('8997') ? 'strong' : 'compact')
      }
      return originalFetch(input, init)
    }
  }, { key: 'scangrade.reviewAccessToken.v1', value: token })
  const page = await context.newPage()
  page.setDefaultTimeout(60_000)
  const url = new URL(ORIGIN)
  Object.entries({
    mode: 'teacher', ocrdebug: '1', ignoreQrHomography: '1', hybridV3: '1',
    v3BurstReplay: '1', v3PristineWarp: '1', v3SequenceFromZones: '1', v3LocalFirstReview: '1',
    v3ConfidenceSafety: '1', v3ConsensusPromotion: '1',
    reviewModelUrl: 'http://127.0.0.1:8997', v3CompactModelUrl: 'http://127.0.0.1:8998',
    modelPath: '/models/worksheet-digit-tony-generalist-aug-strong-20260601.onnx',
    rightSlotModelPath: '/models/worksheet-digit-tony-generalist-noaug-20260601.onnx',
  }).forEach(([key, value]) => url.searchParams.set(key, value))
  await page.goto(url.toString(), { waitUntil: 'networkidle' })
  await page.waitForFunction(() => !!window.cv?.Mat)
  await page.evaluate((values) => window.__SCANGRADE_SET_V3_BURST_FRAMES?.(values), frames)
  await page.setInputFiles('input[type=file]', input.captured)
  await page.waitForFunction(() => window.__SCANGRADE_LIVE_OCR_DEBUG?.v3Shadow?.status === 'complete')
  const beforeFallback = core(await page.evaluate(() => window.__SCANGRADE_LIVE_OCR_DEBUG))
  const shadow = await page.evaluate(() => window.__SCANGRADE_LIVE_OCR_DEBUG.v3Shadow)

  let openedQ4 = false
  const hotspots = page.locator('.annotation-hotspot')
  for (let index = 0; index < await hotspots.count(); index += 1) {
    await hotspots.nth(index).click()
    const label = await page.locator('.student-correction-label').getAttribute('aria-label')
    if (String(label || '').toUpperCase().includes('D')) {
      openedQ4 = true
      break
    }
    await page.locator('.student-correction-close').click()
  }
  if (!openedQ4) throw new Error('could not open P02 mixed Q4')
  const noneVisibleWithoutCompact = await page.locator('.local-first-none-btn').isVisible()
  await page.locator('.local-first-none-btn').click()
  await page.waitForSelector('.local-first-strong-message', { state: 'visible' })
  const outageMessage = (await page.locator('.local-first-strong-message').textContent())?.trim()
  const afterFailedFallback = core(await page.evaluate(() => window.__SCANGRADE_LIVE_OCR_DEBUG))
  const requests = await page.evaluate(() => window.__SG_FAILED_MODEL_REQUESTS)
  const inputBox = page.locator('.student-correction-manual input')
  await inputBox.fill('9')
  await page.locator('.student-correction-save').click()
  await page.waitForFunction(() => window.__SCANGRADE_LIVE_OCR_DEBUG?.manualCorrections?.['4']?.text === '9')
  const correction = await page.evaluate(() => window.__SCANGRADE_LIVE_OCR_DEBUG.manualCorrections['4'])
  report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    scope: 'exact local-first browser recovery with both optional inference services unreachable',
    pageCompleted: beforeFallback.predictions.length > 0,
    compactUnavailable: shadow.compactModelAvailable === false,
    consensusPromotionCount: Number(shadow.consensusPromotionCount || 0),
    consensusAffectedGrade: shadow.affectsGrade === true,
    strongFallbackAccessibleWithoutCompactChoice: noneVisibleWithoutCompact,
    failedRequests: requests,
    outageMessage,
    localOutputsUnchangedByFailedStrongRequest: JSON.stringify(beforeFallback) === JSON.stringify(afterFailedFallback),
    manualEntryWorked: correction?.text === '9' && correction?.correctionSource === 'manual-keypad',
    tokenAppearedInUrlOrLogs: page.url().includes(token) || logs.join('').includes(token),
  }
  report.gates = {
    localPageCompleted: report.pageCompleted,
    compactFailureDidNotBlockFallback: report.compactUnavailable && report.strongFallbackAccessibleWithoutCompactChoice,
    optionalOutageDidNotPromote: report.consensusPromotionCount === 0 && report.consensusAffectedGrade === false,
    strongFailureDidNotChangeLocalOutput: report.localOutputsUnchangedByFailedStrongRequest,
    manualRecoveryWorked: report.manualEntryWorked,
    clearFailureMessage: /unavailable/i.test(report.outageMessage || ''),
    bothFailuresExercised: requests.includes('compact') && requests.includes('strong'),
    tokenNotLeaked: !report.tokenAppearedInUrlOrLogs,
  }
} finally {
  await browser?.close().catch(() => {})
  if (vite.exitCode == null) vite.kill('SIGTERM')
  if (vite.exitCode == null) await new Promise((resolve) => vite.once('exit', resolve))
}

if (!report || !Object.values(report.gates).every(Boolean)) throw new Error(`failure recovery gates failed: ${JSON.stringify(report)}`)
const destination = path.join(ROOT, 'private-evidence/reports/v3-local-first-failure-recovery-20260714.json')
fs.writeFileSync(destination, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ destination: path.relative(ROOT, destination), ...report }, null, 2))
