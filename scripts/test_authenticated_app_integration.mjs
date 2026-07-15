#!/usr/bin/env node

import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const ORIGIN = 'https://localhost:5174'
const token = randomBytes(32).toString('base64url')
const logs = []
function start(command, args, cwd, env) {
  const child = spawn(command, args, { cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] })
  child.stdout.on('data', (chunk) => logs.push(String(chunk)))
  child.stderr.on('data', (chunk) => logs.push(String(chunk)))
  return child
}
const large = start(path.join(ROOT, '.venv/bin/python'), [
  'scripts/serve_trocr_review.py', '--host', '127.0.0.1', '--port', '8872', '--device', 'cpu', '--offline',
  '--adapter', 'private-evidence/models/trocr-lora-calibrated-2epoch-20260709',
], ROOT, { SCANGRADE_REVIEW_TOKEN: token, SCANGRADE_REVIEW_ALLOWED_ORIGINS: ORIGIN })
const compactContext = path.join(os.tmpdir(), 'scangrade-v3-compact-context')
const compact = start(path.join(ROOT, '.venv/bin/python'), ['scripts/serve_v3_compact.py'], compactContext, {
  PORT: '8873', SCANGRADE_V3_HOST: '127.0.0.1', SCANGRADE_V3_COMPACT_MODEL: path.join(compactContext, 'model.onnx'),
  SCANGRADE_V3_TOKEN: token, SCANGRADE_V3_ALLOWED_ORIGINS: ORIGIN,
})
async function health(url, child) {
  for (let i = 0; i < 180; i += 1) {
    if (child.exitCode != null) throw new Error(`service exited ${child.exitCode}`)
    try { const response = await fetch(url); if (response.ok) return } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`health timeout ${url}`)
}

let browser
let report
try {
  await Promise.all([health('http://127.0.0.1:8872/health', large), health('http://127.0.0.1:8873/health', compact)])
  const input = JSON.parse(fs.readFileSync(path.join(ROOT, 'private-evidence/reports/v3-review-display-row-full-20260714/inputs.json'), 'utf8')).selected
    .find((row) => row.packetId === 'P03' && row.layoutId === 'sg-g1-lw-02-add-2digit')
  const burstNames = fs.readdirSync(path.join(input.dir, 'burst-frames')).filter((name) => /^frame-\d+\.(?:png|jpe?g)$/i.test(name)).sort().slice(0, 3)
  const frames = burstNames.map((name, index) => ({ index, score: 1000 - index, focusScore: 1000 - index, sheetOk: true, imageDataUrl: `data:image/png;base64,${fs.readFileSync(path.join(input.dir, 'burst-frames', name)).toString('base64')}` }))
  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ ignoreHTTPSErrors: true })
  await context.addInitScript(({ key, value }) => sessionStorage.setItem(key, value), { key: 'scangrade.reviewAccessToken.v1', value: token })
  const page = await context.newPage()
  const url = new URL(ORIGIN)
  Object.entries({
    mode: 'teacher', ocrdebug: '1', ignoreQrHomography: '1', hybridV3: '1', v3BurstReplay: '1',
    v3PristineWarp: '1', v3SequenceFromZones: '1', reviewModelUrl: 'http://127.0.0.1:8872',
    v3CompactModelUrl: 'http://127.0.0.1:8873',
    modelPath: '/models/worksheet-digit-tony-generalist-aug-strong-20260601.onnx',
    rightSlotModelPath: '/models/worksheet-digit-tony-generalist-noaug-20260601.onnx',
  }).forEach(([key, value]) => url.searchParams.set(key, value))
  await page.goto(url.toString(), { waitUntil: 'networkidle' })
  await page.waitForFunction(() => !!window.cv?.Mat)
  await page.evaluate((values) => window.__SCANGRADE_SET_V3_BURST_FRAMES?.(values), frames)
  await page.setInputFiles('input[type=file]', input.captured)
  await page.waitForFunction(() => window.__SCANGRADE_LIVE_OCR_DEBUG?.v3Shadow?.status === 'complete', undefined, { timeout: 60_000 })
  const modelState = await page.evaluate(() => window.__SCANGRADE_LIVE_OCR_DEBUG?.v3Shadow)
  await page.locator('.annotation-hotspot').first().click()
  const choices = (await page.locator('.correction-choice-btn').allTextContents()).map((value) => value.trim())
  await page.locator('.correction-choice-btn').filter({ hasText: /^\s*15\s*$/ }).click()
  await page.waitForFunction(() => !!window.__SCANGRADE_LIVE_OCR_DEBUG?.manualCorrections?.['4'])
  const correction = await page.evaluate(() => window.__SCANGRADE_LIVE_OCR_DEBUG.manualCorrections['4'])
  report = {
    schemaVersion: 1, generatedAt: new Date().toISOString(),
    testScope: 'full browser app against locally hosted services configured exactly as authenticated cloud endpoints; not a deployed Cloud Run instance',
    tokenStorage: 'sessionStorage only; absent from URL and request body',
    largeModelAvailable: modelState.largeModelAvailable,
    compactModelAvailable: modelState.compactModelAvailable,
    choices, correctWholeAnswerChoiceAvailable: choices.includes('15'),
    correctionRecorded: correction?.text === '15', correctionSource: correction?.correctionSource,
    tokenAppearedInUrl: page.url().includes(token), tokenAppearedInLogs: logs.join('').includes(token),
    imagePayloadAppearedInLogs: logs.join('').includes(frames[0].imageDataUrl.slice(0, 80)),
  }
} finally {
  await browser?.close().catch(() => {})
  for (const child of [large, compact]) if (child.exitCode == null) child.kill('SIGTERM')
  await Promise.all([large, compact].map((child) => child.exitCode == null ? new Promise((resolve) => child.once('exit', resolve)) : Promise.resolve()))
}
report.gates = {
  bothAuthenticatedModelsAvailable: report.largeModelAvailable && report.compactModelAvailable,
  correctChoiceUsable: report.correctWholeAnswerChoiceAvailable && report.correctionRecorded,
  tokenNotLeaked: !report.tokenAppearedInUrl && !report.tokenAppearedInLogs,
  imageNotLogged: !report.imagePayloadAppearedInLogs,
}
const destination = path.join(ROOT, 'private-evidence/reports/v3-authenticated-app-integration-20260714.json')
fs.writeFileSync(destination, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ destination: path.relative(ROOT, destination), ...report }, null, 2))
