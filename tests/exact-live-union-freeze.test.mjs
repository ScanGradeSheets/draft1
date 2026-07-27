import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import test from 'node:test'

const manifest = JSON.parse(fs.readFileSync(
  new URL(
    '../private-evidence/reports/exact-live-uniform-frame-union-policy-freeze-v2-20260724.json',
    import.meta.url,
  ),
  'utf8',
))
const report = JSON.parse(fs.readFileSync(
  new URL(`../${manifest.evidence.report}`, import.meta.url),
  'utf8',
))

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

test('frozen lower-coverage frontier preserves exact decisions and safety gates', () => {
  const normalized = { ...report }
  delete normalized.generatedAt
  const normalizedHash = crypto
    .createHash('sha256')
    .update(canonicalJson(normalized))
    .digest('hex')

  assert.equal(
    normalizedHash,
    manifest.evidence.reportWithoutGeneratedAtSha256,
  )
  assert.equal(report.strongestZeroKnownError.automatic, 267)
  assert.equal(report.strongestZeroKnownError.confidentErrors, 0)
  assert.equal(report.integrity.acceptedTranscriptionsReplaced, 0)
  assert.equal(report.integrity.answerKeyUsedForDecision, false)
  assert.equal(manifest.gates.targetCoverageAtLeast90, false)
  assert.equal(manifest.gates.publicDeploymentAuthorized, false)
})
