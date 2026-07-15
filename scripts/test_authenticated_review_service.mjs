#!/usr/bin/env node

import { randomBytes } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const PORT = Number(process.env.SG_AUTH_TEST_PORT || 8872)
const BASE = `http://127.0.0.1:${PORT}`
const ALLOWED_ORIGIN = 'https://scan-grade-private-beta.example'
const BLOCKED_ORIGIN = 'https://untrusted.example'
const token = randomBytes(32).toString('base64url')
const extraArgs = String(process.env.SG_REVIEW_SERVICE_EXTRA_ARGS || '').split(/\s+/).filter(Boolean)
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'private-evidence/v3/four-packet-sequence-20260714/manifest.json'), 'utf8'))
const baseline = JSON.parse(fs.readFileSync(path.join(ROOT, 'private-evidence/reports/v3-four-packet-service-baseline-20260714.json'), 'utf8'))
const baselineById = new Map(baseline.rows.map((row) => [row.uid, row.largeRead]))
const selected = manifest.entries.slice(0, 8)
const items = selected.map((row) => ({
  id: row.uid,
  questionNum: row.questionNum,
  imageDataUrl: `data:image/png;base64,${fs.readFileSync(path.resolve(ROOT, row.recognitionPath)).toString('base64')}`,
}))
const logs = []
const startedAt = performance.now()
const child = spawn(path.join(ROOT, '.venv/bin/python'), [
  'scripts/serve_trocr_review.py', '--host', '127.0.0.1', '--port', String(PORT),
  '--device', 'cpu', '--offline', '--adapter', 'private-evidence/models/trocr-lora-calibrated-2epoch-20260709',
  ...extraArgs,
], {
  cwd: ROOT,
  env: {
    ...process.env,
    SCANGRADE_REVIEW_TOKEN: token,
    SCANGRADE_REVIEW_ALLOWED_ORIGINS: ALLOWED_ORIGIN,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})
child.stdout.on('data', (chunk) => logs.push(String(chunk)))
child.stderr.on('data', (chunk) => logs.push(String(chunk)))

async function waitForHealth() {
  let lastError
  for (let attempt = 0; attempt < 180; attempt += 1) {
    if (child.exitCode != null) throw new Error(`review service exited ${child.exitCode}: ${logs.join('').slice(-1000)}`)
    try {
      const response = await fetch(`${BASE}/health`)
      if (response.ok) return { payload: await response.json(), coldReadyMs: performance.now() - startedAt }
    } catch (error) { lastError = error }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw lastError || new Error('review service health timeout')
}

async function request({ origin = ALLOWED_ORIGIN, authorization = '', payload = { items } } = {}) {
  const headers = { 'content-type': 'application/json', Origin: origin }
  if (authorization) headers.Authorization = authorization
  const started = performance.now()
  const response = await fetch(`${BASE}/recognize`, { method: 'POST', headers, body: JSON.stringify(payload) })
  const body = await response.json().catch(() => ({}))
  return {
    status: response.status,
    elapsedMs: Number((performance.now() - started).toFixed(1)),
    cacheControl: response.headers.get('cache-control'),
    contentTypeOptions: response.headers.get('x-content-type-options'),
    allowOrigin: response.headers.get('access-control-allow-origin'),
    body,
  }
}

let report
try {
  const health = await waitForHealth()
  const noToken = await request()
  const wrongToken = await request({ authorization: 'Bearer wrong-token' })
  const blockedOrigin = await request({ origin: BLOCKED_ORIGIN })
  const authenticated = await request({ authorization: `Bearer ${token}` })
  const authenticatedBlockedOrigin = await request({ origin: BLOCKED_ORIGIN, authorization: `Bearer ${token}` })
  const keyLeak = await request({ authorization: `Bearer ${token}`, payload: { answerKey: '7', items } })
  const allowedPreflight = await fetch(`${BASE}/recognize`, { method: 'OPTIONS', headers: { Origin: ALLOWED_ORIGIN } })
  const blockedPreflight = await fetch(`${BASE}/recognize`, { method: 'OPTIONS', headers: { Origin: BLOCKED_ORIGIN } })
  const resultById = new Map((authenticated.body.results || []).map((row) => [row.id, row.read]))
  const parityRows = selected.map((row) => ({ id: row.uid, expectedRead: baselineById.get(row.uid), authenticatedRead: resultById.get(row.uid) }))
  const ps = spawnSync('/bin/ps', ['-o', 'rss=', '-p', String(child.pid)], { encoding: 'utf8' })
  const rssKb = Number(String(ps.stdout || '').trim()) || null
  report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    testScope: 'local process exercising the intended authenticated cloud-service boundary; not a deployed Linux Cloud Run instance',
    service: {
      device: health.payload.device,
      modelLoadSeconds: health.payload.loadSeconds,
      coldProcessToHealthMs: Number(health.coldReadyMs.toFixed(1)),
      rssMb: rssKb ? Number((rssKb / 1024).toFixed(1)) : null,
      offline: health.payload.offline,
      answerKeyAccepted: health.payload.answerKeyAccepted,
      quantization: health.payload.quantization || 'none',
    },
    authentication: {
      noTokenStatus: noToken.status,
      wrongTokenStatus: wrongToken.status,
      blockedOriginNoTokenStatus: blockedOrigin.status,
      correctTokenStatus: authenticated.status,
      correctTokenBlockedOriginStatus: authenticatedBlockedOrigin.status,
      correctTokenBlockedOriginReadableByBrowser: authenticatedBlockedOrigin.allowOrigin === BLOCKED_ORIGIN,
      allowedPreflightStatus: allowedPreflight.status,
      blockedPreflightStatus: blockedPreflight.status,
    },
    privacyAndIntegrity: {
      answerKeyRequestStatus: keyLeak.status,
      answerKeyUsed: authenticated.body.answerKeyUsed,
      cacheControl: authenticated.cacheControl,
      contentTypeOptions: authenticated.contentTypeOptions,
      exactAllowedOriginEchoed: authenticated.allowOrigin === ALLOWED_ORIGIN,
      tokenAppearedInLogs: logs.join('').includes(token),
      imagePayloadAppearedInLogs: logs.join('').includes(items[0].imageDataUrl.slice(0, 80)),
    },
    performance: {
      authenticatedEightAnswerRoundTripMs: authenticated.elapsedMs,
      authenticatedEightAnswerInferenceMs: authenticated.body.inferenceMs,
    },
    parity: {
      answers: parityRows.length,
      matches: parityRows.filter((row) => row.expectedRead === row.authenticatedRead).length,
      rows: parityRows,
    },
  }
} finally {
  if (child.exitCode == null) {
    child.kill('SIGTERM')
    await new Promise((resolve) => child.once('exit', resolve))
  }
}

report.gates = {
  tokenRequired: report.authentication.noTokenStatus === 401 && report.authentication.wrongTokenStatus === 401,
  originRestricted: report.authentication.blockedOriginNoTokenStatus === 403 && report.authentication.blockedPreflightStatus === 403,
  authenticatedRequestWorks: report.authentication.correctTokenStatus === 200,
  browserCannotReadBlockedOrigin: report.authentication.correctTokenBlockedOriginReadableByBrowser === false,
  answerKeyRejected: report.privacyAndIntegrity.answerKeyRequestStatus === 400 && report.privacyAndIntegrity.answerKeyUsed === false,
  noSensitiveRequestLogging: !report.privacyAndIntegrity.tokenAppearedInLogs && !report.privacyAndIntegrity.imagePayloadAppearedInLogs,
  noStore: report.privacyAndIntegrity.cacheControl === 'no-store',
  predictionParity: report.parity.matches === report.parity.answers,
}
const destination = path.resolve(ROOT, process.env.SG_AUTH_TEST_OUT || 'private-evidence/reports/v3-authenticated-review-service-test-20260714.json')
fs.writeFileSync(destination, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ destination: path.relative(ROOT, destination), service: report.service, authentication: report.authentication, privacyAndIntegrity: report.privacyAndIntegrity, performance: report.performance, parity: { answers: report.parity.answers, matches: report.parity.matches }, gates: report.gates }, null, 2))
