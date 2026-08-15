#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { webkit } from 'playwright'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const app = process.env.SG_APP_URL || 'https://127.0.0.1:5174'
const modelBase = process.env.SG_MODEL_BASE || 'https://127.0.0.1:8792'
const usePublicDefaultFlags = process.env.SG_USE_PUBLIC_DEFAULT_FLAGS === '1'
const sourceDebug = process.env.SG_SOURCE_DEBUG || path.join(
  root,
  'private-evidence/reports/p05f-production-determinism-a-20260717/debug/2026-07-17_13-48-18-934--captured/ocr-debug.json',
)
const parsedDebug = JSON.parse(fs.readFileSync(sourceDebug, 'utf8'))
const debug = parsedDebug?.debug && typeof parsedDebug.debug === 'object'
  ? parsedDebug.debug
  : parsedDebug
const captured = process.env.SG_CAPTURED || path.join(
  root,
  'private-evidence/debug-scans/2026-07-17/2026-07-17_13-48-18-934-sg-g1-lw-08-number-bonds-5fdff7fa/captured.png',
)
if (!fs.existsSync(captured)) throw new Error(`captured page missing: ${captured}`)

const url = new URL(app)
const researchFeatureParams = usePublicDefaultFlags ? {} : {
  ignoreQrHomography: '1',
  hybridV3: '1',
  v3PristineWarp: '1',
  v3SequenceFromZones: '1',
  v3EightFrameColumnOrder: '1',
  v3LocalFirstReview: '1',
  v3ConfidenceSafety: '1',
  v3ConsensusPromotion: '1',
  v3NumberBondShiftDown: '1',
  v3NonrowTrimEvidence: '1',
  v3CoreCropEvidence: '1',
}
Object.entries({
  mode: 'teacher',
  ocrdebug: '1',
  ...researchFeatureParams,
  v3BrowserLocalCandidate: '1',
  v3BrowserLocalCandidateEncoderUrl: `${modelBase}/models/encoder-fp32.onnx`,
  v3BrowserLocalCandidateDecoderUrl: `${modelBase}/models/decoder-int8.onnx`,
}).forEach(([key, value]) => url.searchParams.set(key, value))
if (process.env.SG_DIGIT_MODEL_PATH) {
  url.searchParams.set('modelPath', process.env.SG_DIGIT_MODEL_PATH)
}
if (process.env.SG_RIGHT_SLOT_MODEL_PATH) {
  url.searchParams.set('rightSlotModelPath', process.env.SG_RIGHT_SLOT_MODEL_PATH)
}

const browser = await webkit.launch({ headless: true })
const nonReadRequests = []
let report
try {
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 820, height: 1180 },
    isMobile: true,
    hasTouch: true,
  })
  const page = await context.newPage()
  page.setDefaultTimeout(180_000)
  page.on('request', (request) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      nonReadRequests.push({ method: request.method(), url: request.url() })
    }
  })
  await page.route('**/*', async (route) => {
    const method = route.request().method()
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      await route.abort('blockedbyclient')
      return
    }
    await route.continue()
  })
  const started = Date.now()
  await page.goto(url.toString(), { waitUntil: 'networkidle' })
  await page.waitForFunction(() => !!window.cv?.Mat)
  await page.setInputFiles('input[type=file]', captured)
  await page.waitForFunction(() => {
    const status = window.__SCANGRADE_LIVE_OCR_DEBUG?.v3BrowserLocalCandidate?.status
    return ['pending', 'complete', 'fail-open', 'unavailable'].includes(status)
  })
  const preAcceptancePresentation = await page.evaluate(() => ({
    candidateStatus:
      window.__SCANGRADE_LIVE_OCR_DEBUG?.v3BrowserLocalCandidate?.status || null,
    resultVisible: document.querySelector('.ocr-result') !== null,
  }))
  await page.waitForFunction(() =>
    ['complete', 'fail-open', 'unavailable'].includes(
      window.__SCANGRADE_LIVE_OCR_DEBUG?.v3BrowserLocalCandidate?.status,
    ))
  const result = await page.evaluate(() => {
    const live = window.__SCANGRADE_LIVE_OCR_DEBUG
    return {
      candidate: live?.v3BrowserLocalCandidate || null,
      answers: (live?.answerGroups || []).map((group) => ({
        questionNum: Number(group.questionNum),
        read: group.answerText,
        automatic: group.reviewNeeded !== true,
      })),
      uniformViews: (live?.v3UniformAnswerViews || []).map((view) => ({
        questionNum: Number(view.questionNum),
        source: view.source,
        simpleScore: view.simpleFrame?.score,
        homographyScore: view.homographyFrame?.score,
      })),
    }
  })
  const candidate7 = JSON.parse(fs.readFileSync(path.join(
    root,
    'private-evidence/reports/browser-local-co-primary-candidate7-20260724.json',
  ), 'utf8')).fivePacketRows
  const expected = candidate7
    .filter((row) =>
      row.packetId === 'P05' &&
      row.templateId === debug.layoutId)
    .map((row) => ({
      questionNum: Number(row.id.split('|').at(-1)),
      read: row.decision.read,
      automatic: row.decision.automatic,
    }))
  report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceDebug,
    layoutId: debug.layoutId,
    engine: 'playwright-webkit-mobile-emulation',
    elapsedMs: Date.now() - started,
    result,
    expected,
    nonReadRequests,
    preAcceptancePresentation,
    gates: {
      candidateCompleted: result.candidate?.status === 'complete',
      exactDecisionParity: JSON.stringify(result.answers) === JSON.stringify(expected),
      noImageOrInferenceUpload: nonReadRequests.length === 0,
      noResultPresentedWhileCandidatePending:
        preAcceptancePresentation.candidateStatus !== 'pending' ||
        preAcceptancePresentation.resultVisible === false,
      persistentSessionReused:
        Number(result.candidate?.modelRuntime?.sessionReusedCount || 0) > 0,
    },
  }
  report.gates.pass = Object.values(report.gates).every(Boolean)
} finally {
  await browser.close()
}

const outputPath = path.resolve(
  process.env.SG_REPORT_PATH || path.join(
    root,
    'private-evidence/reports/browser-local-strict-live-webkit-smoke-20260723.json',
  ),
)
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ outputPath, ...report }, null, 2))
if (!report?.gates?.pass) process.exitCode = 1
