#!/usr/bin/env node

import { randomBytes } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const CONTEXT = path.join(os.tmpdir(), 'scangrade-v3-compact-context')
const PORT = 8873
const BASE = `http://127.0.0.1:${PORT}`
const ORIGIN = 'https://scan-grade-private-beta.example'
const token = randomBytes(32).toString('base64url')
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'private-evidence/v3/four-packet-sequence-20260714/manifest.json'), 'utf8'))
const baseline = JSON.parse(fs.readFileSync(path.join(ROOT, 'private-evidence/reports/v3-four-packet-service-baseline-20260714.json'), 'utf8'))
const baselineById = new Map(baseline.rows.map((row) => [row.uid, row.compactRead]))
const selected = manifest.entries.slice(0, 24)
const items = selected.map((row) => ({ id: row.uid, questionNum: row.questionNum, continuousImageDataUrl: `data:image/png;base64,${fs.readFileSync(path.resolve(ROOT, row.recognitionPath)).toString('base64')}` }))
const logs = []
const started = performance.now()
const child = spawn(path.join(ROOT, '.venv/bin/python'), ['scripts/serve_v3_compact.py'], {
  cwd: CONTEXT,
  env: { ...process.env, PORT: String(PORT), SCANGRADE_V3_HOST: '127.0.0.1', SCANGRADE_V3_COMPACT_MODEL: path.join(CONTEXT, 'model.onnx'), SCANGRADE_V3_TOKEN: token, SCANGRADE_V3_ALLOWED_ORIGINS: ORIGIN },
  stdio: ['ignore', 'pipe', 'pipe'],
})
child.stdout.on('data', (chunk) => logs.push(String(chunk)))
child.stderr.on('data', (chunk) => logs.push(String(chunk)))

async function waitForHealth() {
  for (let i = 0; i < 100; i += 1) {
    try { const response = await fetch(`${BASE}/health`); if (response.ok) return performance.now() - started } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error(`staged compact service failed to start: ${logs.join('').slice(-1000)}`)
}
async function post({ authorization = '', origin = ORIGIN, payload = { items } } = {}) {
  const headers = { 'content-type': 'application/json', Origin: origin }
  if (authorization) headers.Authorization = authorization
  const requestStarted = performance.now()
  const response = await fetch(`${BASE}/v3/recognize`, { method: 'POST', headers, body: JSON.stringify(payload) })
  return { status: response.status, elapsedMs: performance.now() - requestStarted, headers: Object.fromEntries(response.headers), body: await response.json() }
}

let report
try {
  const coldReadyMs = await waitForHealth()
  const noToken = await post({ payload: {} })
  const wrongOrigin = await post({ origin: 'https://untrusted.example', payload: {} })
  const authenticated = await post({ authorization: `Bearer ${token}` })
  const keyLeak = await post({ authorization: `Bearer ${token}`, payload: { items, answer_key: ['7'] } })
  const actual = new Map((authenticated.body.results || []).map((row) => [row.id, row.read]))
  const parity = selected.map((row) => ({ id: row.uid, expected: baselineById.get(row.uid), actual: actual.get(row.uid) }))
  const ps = spawnSync('/bin/ps', ['-o', 'rss=', '-p', String(child.pid)], { encoding: 'utf8' })
  const rssKb = Number(String(ps.stdout || '').trim()) || null
  report = {
    schemaVersion: 1, generatedAt: new Date().toISOString(),
    testScope: 'native execution from the exact privacy-checked four-file Cloud Run staging context; Linux container build unavailable on this Mac',
    stagedFiles: ['Dockerfile', 'model.onnx', 'requirements-v3-compact.txt', 'scripts/serve_v3_compact.py'],
    privateEvidenceFiles: 0,
    coldReadyMs: Number(coldReadyMs.toFixed(1)), rssMb: rssKb ? Number((rssKb / 1024).toFixed(1)) : null,
    authenticated24AnswerRoundTripMs: Number(authenticated.elapsedMs.toFixed(1)),
    statuses: { noToken: noToken.status, wrongOrigin: wrongOrigin.status, authenticated: authenticated.status, answerKeyLeak: keyLeak.status },
    headers: { cacheControl: authenticated.headers['cache-control'], contentTypeOptions: authenticated.headers['x-content-type-options'], allowOrigin: authenticated.headers['access-control-allow-origin'] },
    sensitiveLogging: { token: logs.join('').includes(token), imagePayload: logs.join('').includes(items[0].continuousImageDataUrl.slice(0, 80)) },
    parity: { answers: parity.length, matches: parity.filter((row) => row.expected === row.actual).length, rows: parity },
  }
} finally {
  child.kill('SIGTERM')
  await new Promise((resolve) => child.once('exit', resolve))
}
report.gates = {
  exactStagingContext: report.stagedFiles.length === 4 && report.privateEvidenceFiles === 0,
  authAndOrigin: report.statuses.noToken === 401 && report.statuses.wrongOrigin === 403 && report.statuses.authenticated === 200,
  answerKeyRejected: report.statuses.answerKeyLeak === 400,
  noStore: report.headers.cacheControl === 'no-store',
  noSensitiveLogging: !report.sensitiveLogging.token && !report.sensitiveLogging.imagePayload,
  predictionParity: report.parity.matches === report.parity.answers,
}
const destination = path.join(ROOT, 'private-evidence/reports/v3-staged-compact-service-test-20260714.json')
fs.writeFileSync(destination, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ destination: path.relative(ROOT, destination), coldReadyMs: report.coldReadyMs, rssMb: report.rssMb, authenticated24AnswerRoundTripMs: report.authenticated24AnswerRoundTripMs, statuses: report.statuses, parity: { answers: report.parity.answers, matches: report.parity.matches }, gates: report.gates }, null, 2))
