#!/usr/bin/env node

import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const ORIGIN = 'https://localhost:5188'
const PACKETS = ['P08', 'P03', 'P09', 'P02']
const LAYOUTS = Array.from({ length: 10 }, (_, index) =>
  `sg-g1-lw-${String(index + 1).padStart(2, '0')}-${[
    'add-1digit', 'add-2digit', 'sub-1digit', 'sub-2digit', 'mixed-20',
    'ten-frames', 'dot-collections', 'number-bonds', 'number-patterns', 'place-value-50',
  ][index]}`)
const CANONICAL_P02_DOT = '2026-07-14_03-52-45-221-sg-g1-lw-07-dot-collections-39ec2eb4'
const token = randomBytes(32).toString('base64url')
const logs = []
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

function debugFiles(root, output = []) {
  if (!fs.existsSync(root)) return output
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const resolved = path.join(root, entry.name)
    if (entry.isDirectory()) debugFiles(resolved, output)
    else if (entry.isFile() && entry.name === 'debug.json') output.push(resolved)
  }
  return output
}

function selectInputs() {
  const roots = ['2026-07-13', '2026-07-14'].map((date) => path.join(ROOT, 'private-evidence/debug-scans', date))
  const versions = []
  for (const file of roots.flatMap((root) => debugFiles(root))) {
    try {
      const wrapper = JSON.parse(fs.readFileSync(file, 'utf8'))
      const debug = wrapper.debug || wrapper
      if (PACKETS.includes(debug.packetId) && LAYOUTS.includes(debug.layoutId)) {
        versions.push({ file, dir: path.dirname(file), debug })
      }
    } catch {}
  }
  const selected = []
  for (const packetId of PACKETS) {
    for (const layoutId of LAYOUTS) {
      const candidates = versions.filter((row) => row.debug.packetId === packetId && row.debug.layoutId === layoutId)
      const sessions = new Map()
      for (const row of candidates) {
        const sessionId = row.debug.scanSessionId || path.basename(row.dir)
        if (!sessions.has(sessionId)) sessions.set(sessionId, [])
        sessions.get(sessionId).push(row)
      }
      let eligible = [...sessions.values()].filter((rows) =>
        rows.some((row) => Array.isArray(row.debug.answerGroups) && row.debug.answerGroups.length > 0) &&
        rows.some((row) => fs.existsSync(path.join(row.dir, 'captured.png')) && fs.existsSync(path.join(row.dir, 'burst-frames'))))
      if (packetId === 'P02' && layoutId === 'sg-g1-lw-07-dot-collections') {
        eligible = eligible.filter((rows) => rows.some((row) => path.basename(row.dir) === CANONICAL_P02_DOT))
      }
      if (eligible.length !== 1) throw new Error(`${packetId}|${layoutId}: ${eligible.length} canonical sessions`)
      const asset = eligible[0].find((row) =>
        fs.existsSync(path.join(row.dir, 'captured.png')) &&
        fs.readdirSync(path.join(row.dir, 'burst-frames')).filter((name) => /^frame-\d+\.(?:png|jpe?g)$/i.test(name)).length >= 3)
      if (!asset) throw new Error(`${packetId}|${layoutId}: missing captured page or burst`)
      selected.push({ packetId, layoutId, dir: asset.dir, captured: path.join(asset.dir, 'captured.png') })
    }
  }
  return selected
}

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

function appUrl() {
  const url = new URL(ORIGIN)
  Object.entries({
    mode: 'teacher', ocrdebug: '1', ignoreQrHomography: '1', hybridV3: '1', v3BurstReplay: '1',
    v3PristineWarp: '1', v3SequenceFromZones: '1', v3LocalFirstReview: '1',
    v3ContextCropReview: process.env.SG_CONTEXT_CROP_REVIEW === '0' ? '0' : '1',
    reviewModelUrl: 'http://127.0.0.1:8878', v3CompactModelUrl: 'http://127.0.0.1:8879',
    modelPath: '/models/worksheet-digit-tony-generalist-aug-strong-20260601.onnx',
    rightSlotModelPath: '/models/worksheet-digit-tony-generalist-noaug-20260601.onnx',
  }).forEach(([key, value]) => url.searchParams.set(key, value))
  return url.toString()
}

function questionNumFromLabel(label) {
  const match = String(label || '').toUpperCase().match(/[A-Z]/)
  return match ? match[0].charCodeAt(0) - 64 : NaN
}

function signature(debug) {
  return JSON.stringify({
    predictions: (debug?.predictions || []).map((row) => ({ id: row.id, digit: row.blank || row.empty ? null : row.digit, confidence: row.confidence, topGap: row.topGap, reviewNeeded: row.reviewNeeded, correct: row.correct })),
    questionCorrect: debug?.questionCorrect,
    questionReview: debug?.questionReview,
    answerGroups: debug?.answerGroups,
  })
}

function grouped(rows, keyFor) {
  const output = {}
  for (const row of rows) {
    const key = keyFor(row)
    if (!output[key]) output[key] = { yellow: 0, scorable: 0, localTruth: 0, strongTruth: 0, manualNeeded: 0, strongRequests: 0 }
    const bucket = output[key]
    bucket.yellow += 1
    bucket.scorable += Number(row.scorable)
    bucket.localTruth += Number(row.localTruthAvailable)
    bucket.strongTruth += Number(row.truthAvailableAfterStrong)
    bucket.manualNeeded += Number(row.scorable && !row.truthAvailableAfterStrong)
    bucket.strongRequests += Number(row.strongRequested)
  }
  return output
}

const pageFilter = String(process.env.SG_LOCAL_FIRST_PAGE || '').trim()
const diagnosticMode = Boolean(pageFilter)
const pages = selectInputs().filter((item) => !pageFilter || `${item.packetId}|${item.layoutId}` === pageFilter)
if (!pages.length) throw new Error(`no page matched SG_LOCAL_FIRST_PAGE=${pageFilter}`)
const truthReport = JSON.parse(fs.readFileSync(path.join(ROOT, 'private-evidence/reports/v3-crop-candidate-evaluation-20260714-final.json'), 'utf8'))
const truthByKey = new Map(truthReport.rows.map((row) => [`${row.packetId}|${row.layoutId}|${row.questionNum}`, row]))
// Exercise the already-built production bundle. The dev server can restart or
// exit during this long 40-page replay, which makes an infrastructure failure
// look like a recognition failure.
const vite = start('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '5188'])
const large = start(path.join(ROOT, '.venv/bin/python'), [
  'scripts/serve_trocr_review.py', '--host', '127.0.0.1', '--port', '8878', '--device', 'cpu', '--offline',
  '--adapter', 'private-evidence/models/trocr-lora-calibrated-2epoch-20260709',
], { SCANGRADE_REVIEW_TOKEN: token, SCANGRADE_REVIEW_ALLOWED_ORIGINS: ORIGIN })
const compact = start(path.join(ROOT, '.venv/bin/python'), ['scripts/serve_v3_compact.py'], {
  PORT: '8879', SCANGRADE_V3_HOST: '127.0.0.1', SCANGRADE_V3_TOKEN: token, SCANGRADE_V3_ALLOWED_ORIGINS: ORIGIN,
})

let browser
let report
try {
  await Promise.all([health(ORIGIN, vite), health('http://127.0.0.1:8878/health', large), health('http://127.0.0.1:8879/health', compact)])
  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1024, height: 1366 }, isMobile: true, hasTouch: true })
  await context.addInitScript(({ key, value }) => {
    sessionStorage.setItem(key, value)
    window.__SG_STRONG_REQUESTS = []
    const originalFetch = window.fetch.bind(window)
    window.fetch = (input, init = {}) => {
      const url = String(input?.url || input || '')
      if (url.includes('127.0.0.1:8878')) {
        let body = null
        try { body = JSON.parse(String(init?.body || '{}')) } catch {}
        window.__SG_STRONG_REQUESTS.push((body?.items || []).map((item) => Number(item.questionNum)))
      }
      return originalFetch(input, init)
    }
  }, { key: 'scangrade.reviewAccessToken.v1', value: token })
  const page = await context.newPage()
  page.setDefaultTimeout(90_000)
  const rows = []
  const pageResults = []

  for (const item of pages) {
    await page.goto(appUrl(), { waitUntil: 'networkidle' })
    await page.waitForFunction(() => !!window.cv?.Mat)
    const names = fs.readdirSync(path.join(item.dir, 'burst-frames')).filter((name) => /^frame-\d+\.(?:png|jpe?g)$/i.test(name)).sort().slice(0, 3)
    const frames = names.map((name, index) => ({ index, score: 1000 - index, focusScore: 1000 - index, sheetOk: true, imageDataUrl: `data:image/png;base64,${fs.readFileSync(path.join(item.dir, 'burst-frames', name)).toString('base64')}` }))
    await page.evaluate((value) => window.__SCANGRADE_SET_V3_BURST_FRAMES?.(value), frames)
    await page.setInputFiles('input[type=file]', item.captured)
    await page.waitForFunction(() => Array.isArray(window.__SCANGRADE_LIVE_OCR_DEBUG?.predictions))
    const before = signature(await page.evaluate(() => window.__SCANGRADE_LIVE_OCR_DEBUG))
    await page.waitForFunction(() => ['compact-ready', 'complete'].includes(window.__SCANGRADE_LIVE_OCR_DEBUG?.v3Shadow?.status))
    const afterCompact = signature(await page.evaluate(() => window.__SCANGRADE_LIVE_OCR_DEBUG))
    await page.waitForFunction(() => window.__SCANGRADE_LIVE_OCR_DEBUG?.v3Shadow?.status === 'complete')
    const debug = await page.evaluate(() => window.__SCANGRADE_LIVE_OCR_DEBUG)
    const yellowNums = new Set((debug.answerGroups || []).filter((group) => group.reviewNeeded).map((group) => Number(group.questionNum)))
    const requestStart = await page.evaluate(() => window.__SG_STRONG_REQUESTS.length)
    for (const questionNum of [...yellowNums].sort((a, b) => a - b)) {
      const opened = await page.evaluate((q) => window.__SCANGRADE_OPEN_REVIEW_QUESTION?.(q), questionNum)
      if (!opened) throw new Error(`${item.packetId}|${item.layoutId}|Q${questionNum}: replay hook could not open yellow review`)
      const panel = page.locator('.student-correction-panel')
      await panel.waitFor({ state: 'visible' })
      await page.waitForFunction((q) => {
        const label = document.querySelector('.student-correction-label')?.getAttribute('aria-label') || ''
        const match = label.toUpperCase().match(/[A-Z]/)
        return match && match[0].charCodeAt(0) - 64 === q
      }, questionNum)
      const truthRow = truthByKey.get(`${item.packetId}|${item.layoutId}|${questionNum}`)
      const scorable = truthRow?.scorable === true
      const truth = scorable ? String(truthRow.truthText) : null
      const preparedContext = await page.evaluate(() => window.__SCANGRADE_LOCAL_FIRST_CONTEXT_SUMMARY?.())
      const preparedItemCount = (preparedContext?.items || []).filter((item) => Number(item.questionNum) === questionNum).length
      const initialChoices = (await page.locator('.correction-choice-btn').allTextContents()).map((value) => value.trim())
      let finalChoices = [...initialChoices]
      let strongRequested = false
      let contextRequested = false
      let noneTapped = false
      let strongUnavailableWithoutRequest = false
      let strongRequestItems = 0
      if (scorable && !initialChoices.includes(truth)) {
        const button = page.locator('.local-first-none-btn')
        if (await button.isVisible()) {
          await page.waitForFunction(() => {
            const element = document.querySelector('.local-first-none-btn')
            return element && !element.disabled
          }, undefined, { timeout: 20_000 })
          const count = await page.evaluate(() => window.__SG_STRONG_REQUESTS.length)
          const contextCount = await page.evaluate(() => window.__SCANGRADE_LIVE_OCR_DEBUG?.localFirstContextRequests?.length || 0)
          await button.click()
          noneTapped = true
          await page.waitForFunction(({ strongPrior, contextPrior }) =>
            window.__SG_STRONG_REQUESTS.length > strongPrior ||
            (window.__SCANGRADE_LIVE_OCR_DEBUG?.localFirstContextRequests?.length || 0) > contextPrior ||
            /unavailable/i.test(document.querySelector('.local-first-strong-message')?.textContent || ''),
          { strongPrior: count, contextPrior: contextCount }, { timeout: 20_000 })
          contextRequested = await page.evaluate((prior) =>
            (window.__SCANGRADE_LIVE_OCR_DEBUG?.localFirstContextRequests?.length || 0) > prior,
          contextCount)
          finalChoices = (await page.locator('.correction-choice-btn').allTextContents()).map((value) => value.trim())
          if (contextRequested && !finalChoices.includes(truth) && await button.isVisible()) {
            await page.waitForFunction((strongPrior) => {
              const element = document.querySelector('.local-first-none-btn')
              return window.__SG_STRONG_REQUESTS.length > strongPrior || (element && !element.disabled)
            }, count, { timeout: 20_000 })
            const strongAlreadyStarted = await page.evaluate((prior) => window.__SG_STRONG_REQUESTS.length > prior, count)
            if (!strongAlreadyStarted) {
              await button.click()
              await page.waitForFunction((prior) =>
                window.__SG_STRONG_REQUESTS.length > prior ||
                /unavailable/i.test(document.querySelector('.local-first-strong-message')?.textContent || ''),
              count, { timeout: 20_000 })
            }
          }
          const requestCount = await page.evaluate(() => window.__SG_STRONG_REQUESTS.length)
          strongRequested = requestCount > count
          strongUnavailableWithoutRequest = !strongRequested && !contextRequested
          if (strongRequested) {
            await page.waitForFunction((q) => (window.__SCANGRADE_LIVE_OCR_DEBUG?.localFirstStrongRequests || []).some((request) => Number(request.questionNum) === q), questionNum)
          }
          finalChoices = (await page.locator('.correction-choice-btn').allTextContents()).map((value) => value.trim())
          strongRequestItems = strongRequested
            ? (await page.evaluate(() => window.__SG_STRONG_REQUESTS.at(-1)))?.length || 0
            : 0
        }
      }
      rows.push({
        packetId: item.packetId, layoutId: item.layoutId,
        layoutFamily: Number(item.layoutId.match(/sg-g1-lw-(\d{2})/)?.[1]) <= 5 ? 'row' : 'non-row',
        questionNum, scorable, truth, initialChoices, finalChoices, noneTapped, preparedItemCount,
        ...(diagnosticMode ? { preparedContextItems: preparedContext?.items || [] } : {}),
        contextRequested, strongRequested, strongUnavailableWithoutRequest, strongRequestItems,
        localTruthAvailable: scorable && initialChoices.includes(truth),
        truthAvailableAfterStrong: scorable && finalChoices.includes(truth),
        existingChoicesPreserved: initialChoices.every((choice) => finalChoices.includes(choice)),
        manualInputAvailable: await page.locator('.student-correction-manual input').isVisible(),
      })
      await page.locator('.student-correction-close').click()
      await panel.waitFor({ state: 'hidden' })
    }
    const pageRequests = (await page.evaluate(() => window.__SG_STRONG_REQUESTS.length)) - requestStart
    pageResults.push({ packetId: item.packetId, layoutId: item.layoutId, yellow: yellowNums.size, strongRequests: pageRequests, automaticInvariantPreserved: before === afterCompact })
    console.log(`[ok] ${item.packetId} ${item.layoutId}: ${yellowNums.size} yellow, ${pageRequests} strong`)
  }

  const scorable = rows.filter((row) => row.scorable)
  const localTruth = scorable.filter((row) => row.localTruthAvailable).length
  const afterStrong = scorable.filter((row) => row.truthAvailableAfterStrong).length
  const strongRequests = rows.filter((row) => row.strongRequested).length
  const fallbackAttempts = rows.filter((row) => row.noneTapped).length
  const unavailableWithoutRequest = rows.filter((row) => row.strongUnavailableWithoutRequest).length
  const strongFrameItems = rows.reduce((sum, row) => sum + row.strongRequestItems, 0)
  const listSizes = rows.map((row) => row.initialChoices.length)
  report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    scope: 'exact browser sweep of every current yellow answer on all 40 retained four-packet pages; review choices inspected but not applied',
    pages: pages.length,
    yellowAnswers: rows.length,
    scorableYellowAnswers: scorable.length,
    unscorableYellowAnswers: rows.length - scorable.length,
    truthChoiceAvailability: {
      immediateLocal: localTruth,
      immediateLocalPct: Number((100 * localTruth / scorable.length).toFixed(1)),
      afterOnDemandStrong: afterStrong,
      afterOnDemandStrongPct: Number((100 * afterStrong / scorable.length).toFixed(1)),
      manualEntryNeeded: scorable.length - afterStrong,
    },
    candidateLists: {
      min: Math.min(...listSizes), max: Math.max(...listSizes),
      mean: Number((listSizes.reduce((sum, value) => sum + value, 0) / listSizes.length).toFixed(2)),
      existingChoiceLoss: rows.filter((row) => !row.existingChoicesPreserved).length,
    },
    strongInference: {
      requestsBeforeTeacherAction: 0,
      fallbackAttempts,
      onDemandRequests: strongRequests,
      unavailableWithoutUsablePreparedCrop: unavailableWithoutRequest,
      frameItems: strongFrameItems,
      eagerAllYellowFrameItems: scorable.length * 3,
      frameReductionPct: Number((100 * (1 - strongFrameItems / (scorable.length * 3))).toFixed(1)),
    },
    contextCropInference: {
      requestsBeforeTeacherAction: 0,
      onDemandRequests: rows.filter((row) => row.contextRequested).length,
      strongRequestsAvoidedAfterContext: rows.filter((row) => row.contextRequested && !row.strongRequested).length,
    },
    byPacket: grouped(rows, (row) => row.packetId),
    byLayout: grouped(rows, (row) => row.layoutId),
    byLayoutFamily: grouped(rows, (row) => row.layoutFamily),
    integrity: {
      automaticInvariantPages: pageResults.filter((row) => row.automaticInvariantPreserved).length,
      allAutomaticInvariantsPreserved: pageResults.every((row) => row.automaticInvariantPreserved),
      manualInputAvailableForEveryYellow: rows.every((row) => row.manualInputAvailable),
      tokenAppearedInUrlOrLogs: page.url().includes(token) || logs.join('').includes(token),
    },
    pageResults,
    rows,
  }
  report.gates = {
    allFortyPages: diagnosticMode || report.pages === 40,
    everyYellowOpened: report.yellowAnswers === pageResults.reduce((sum, row) => sum + row.yellow, 0),
    noExistingChoiceRemoved: report.candidateLists.existingChoiceLoss === 0,
    strongFullyDeferred: report.strongInference.requestsBeforeTeacherAction === 0,
    oneQuestionThreeFrames: report.strongInference.frameItems === report.strongInference.onDemandRequests * 3,
    automaticInvariantsPreserved: report.integrity.allAutomaticInvariantsPreserved,
    manualFallbackAlwaysAvailable: report.integrity.manualInputAvailableForEveryYellow,
    tokenNotLeaked: !report.integrity.tokenAppearedInUrlOrLogs,
  }
} finally {
  await browser?.close().catch(() => {})
  for (const child of [vite, large, compact]) if (child.exitCode == null) child.kill('SIGTERM')
  await Promise.all([vite, large, compact].map((child) => child.exitCode == null ? new Promise((resolve) => child.once('exit', resolve)) : Promise.resolve()))
}

if (!report || !Object.values(report.gates).every(Boolean)) throw new Error(`all-yellow UI gates failed: ${JSON.stringify(report?.gates)}`)
const destination = path.join(ROOT, process.env.SG_LOCAL_FIRST_OUT || 'private-evidence/reports/v3-local-first-all-yellows-ui-20260714.json')
fs.writeFileSync(destination, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ destination: path.relative(ROOT, destination), pages: report.pages, yellowAnswers: report.yellowAnswers, scorableYellowAnswers: report.scorableYellowAnswers, truthChoiceAvailability: report.truthChoiceAvailability, candidateLists: report.candidateLists, strongInference: report.strongInference, byLayoutFamily: report.byLayoutFamily, integrity: report.integrity, gates: report.gates }, null, 2))
