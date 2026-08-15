import { randomBytes } from 'node:crypto'
import { execFileSync, spawn } from 'node:child_process'
import { closeSync, openSync } from 'node:fs'
import { request } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const gatewayScript = path.join(scriptDirectory, 'private_add2_test_gateway.mjs')
const plistPath = '/Users/openclaw/Library/LaunchAgents/com.scangrade.debug-upload-proxy.plist'
const port = Number(process.env.SG_PRIVATE_GATEWAY_PORT || 8794)
const durationMinutes = Number(process.env.SG_PRIVATE_GATEWAY_DURATION_MINUTES || 120)
const publicOrigin = String(
  process.env.SG_PRIVATE_GATEWAY_PUBLIC_ORIGIN || 'https://hobbes-mac-mini.tail415e0b.ts.net:10000',
).replace(/\/$/, '')
const expiresAt = Date.now() + durationMinutes * 60_000
const activationToken = randomBytes(24).toString('base64url')
const uploadToken = execFileSync('/usr/bin/plutil', [
  '-extract',
  'EnvironmentVariables.SG_DEBUG_UPLOAD_TOKEN',
  'raw',
  '-o',
  '-',
  plistPath,
], { encoding: 'utf8' }).trim()

if (!uploadToken) throw new Error('The private debug-upload token is unavailable')

const logPath = '/tmp/scangrade-private-add2-gateway.log'
const logFd = openSync(logPath, 'a')
const child = spawn(process.execPath, [gatewayScript], {
  detached: true,
  stdio: ['ignore', logFd, logFd],
  env: {
    ...process.env,
    SG_PRIVATE_GATEWAY_PORT: String(port),
    SG_PRIVATE_GATEWAY_PUBLIC_ORIGIN: publicOrigin,
    SG_PRIVATE_GATEWAY_ACTIVATION_TOKEN: activationToken,
    SG_PRIVATE_GATEWAY_EXPIRES_AT: String(expiresAt),
    SG_DEBUG_UPLOAD_TOKEN: uploadToken,
  },
})
child.unref()
closeSync(logFd)

async function waitForHealth() {
  const deadline = Date.now() + 8_000
  while (Date.now() < deadline) {
    const healthy = await new Promise((resolve) => {
      const req = request(`http://127.0.0.1:${port}/health`, { timeout: 500 }, (res) => {
        res.resume()
        resolve(res.statusCode === 200)
      })
      req.on('timeout', () => req.destroy())
      req.on('error', () => resolve(false))
      req.end()
    })
    if (healthy) return
    await new Promise((resolve) => setTimeout(resolve, 150))
  }
  throw new Error(`Private gateway did not start; inspect ${logPath}`)
}

await waitForHealth()

console.log(JSON.stringify({
  ok: true,
  pid: child.pid,
  port,
  expiresAt: new Date(expiresAt).toISOString(),
  activationUrl: `${publicOrigin}/activate/${activationToken}`,
  logPath,
}, null, 2))
