import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

import { scoreBrowserLocalProspective } from '../scripts/score_browser_local_prospective_candidate.mjs'

const ROOT = process.cwd()
const scorer = path.join(ROOT, 'scripts/score_browser_local_prospective_candidate.mjs')
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex')

function fixture({ wrong = false, leaky = false } = {}) {
  return {
    freeze: { candidate: { candidateId: 'local-a' }, publicDeploymentAuthorized: false, _fileSha256: 'freeze-sha' },
    predictions: {
      candidateId: 'local-a', candidateFreezeSha256: 'freeze-sha', runtime: 'browser-local', noUploads: true,
      zeroInferenceCost: true, deterministic: true,
      rows: [
        { uid: 'P10|t1|1', packetId: 'P10', studentId: 'S10', templateId: 't1', layoutFamily: 'row', captureQuality: 'good', automatic: true, transcription: wrong ? '9' : '6', reason: 'agreement' },
        { uid: 'P10|t1|2', packetId: 'P10', studentId: 'S10', templateId: 't1', layoutFamily: 'row', captureQuality: 'good', automatic: false, transcription: '8', reason: 'yellow' },
      ],
      ...(leaky ? { expectedAnswer: '6' } : {}),
    },
    truth: {
      answerKeyUsedAsTruth: false,
      labels: [
        { uid: 'P10|t1|1', packetId: 'P10', studentId: 'S10', templateId: 't1', layoutFamily: 'row', truthState: 'value', handwrittenTruth: '6', qaStatus: 'verified' },
        { uid: 'P10|t1|2', packetId: 'P10', studentId: 'S10', templateId: 't1', layoutFamily: 'row', truthState: 'value', handwrittenTruth: '8', qaStatus: 'verified' },
      ],
    },
  }
}

test('scores transcription separately from yellow review and reports stratified zero-error gates', () => {
  const report = scoreBrowserLocalProspective(fixture())
  assert.deepEqual(report.overall, {
    scorable: 2, automatic: 1, automaticCorrect: 1, automaticWrong: 0, yellow: 1, coveragePct: 50,
  })
  assert.equal(report.gate.zeroKnownConfidentErrors, true)
  assert.equal(report.gate.reaches90PctCoverage, false)
  assert.equal(report.gate.passed, false)
  assert.equal(report.byPacket.P10.automaticCorrect, 1)
  assert.equal(report.byLayoutFamily.row.yellow, 1)
})

test('one confident transcription error fails the hard gate', () => {
  const report = scoreBrowserLocalProspective(fixture({ wrong: true }))
  assert.equal(report.overall.automaticWrong, 1)
  assert.equal(report.confidentErrors[0].uid, 'P10|t1|1')
  assert.equal(report.gate.zeroKnownConfidentErrors, false)
})

test('answer-key-shaped prediction inputs fail closed', () => {
  assert.throws(() => scoreBrowserLocalProspective(fixture({ leaky: true })), /expectedAnswer is forbidden/)
})

test('CLI verifies frozen identities and refuses to overwrite a prospective report', () => {
  const absolute = fs.mkdtempSync(path.join(ROOT, '.tmp-prospective-score-'))
  const relative = path.relative(ROOT, absolute)
  try {
    fs.mkdirSync(path.join(absolute, 'candidate'))
    const policy = 'export const version = 1\n'
    const model = 'model-bytes\n'
    fs.writeFileSync(path.join(absolute, 'candidate', 'policy.js'), policy)
    fs.writeFileSync(path.join(absolute, 'candidate', 'model.onnx'), model)
    const freeze = {
      candidate: { candidateId: 'local-a' }, publicDeploymentAuthorized: false,
      identities: {
        sourceFiles: [{ path: `${relative}/candidate/policy.js`, bytes: Buffer.byteLength(policy), sha256: sha256(policy) }],
        modelAssets: [{ path: `${relative}/candidate/model.onnx`, bytes: Buffer.byteLength(model), sha256: sha256(model) }],
      },
    }
    const freezeText = `${JSON.stringify(freeze, null, 2)}\n`
    fs.writeFileSync(path.join(absolute, 'freeze.json'), freezeText)
    const input = fixture()
    input.predictions.candidateFreezeSha256 = sha256(freezeText)
    fs.writeFileSync(path.join(absolute, 'predictions.json'), `${JSON.stringify(input.predictions)}\n`)
    fs.writeFileSync(path.join(absolute, 'truth.json'), `${JSON.stringify(input.truth)}\n`)
    const args = [scorer, `${relative}/freeze.json`, `${relative}/predictions.json`, `${relative}/truth.json`, `${relative}/report.json`]
    assert.throws(
      () => execFileSync(process.execPath, args, { cwd: ROOT, stdio: 'pipe' }),
      (error) => error?.status === 2,
      'the score intentionally fails the 90 percent gate but must still write the audit report',
    )
    assert.equal(fs.existsSync(path.join(absolute, 'report.json')), true)
    assert.throws(
      () => execFileSync(process.execPath, args, { cwd: ROOT, stdio: 'pipe' }),
      (error) => error?.status === 1 && String(error?.stderr || '').includes('EEXIST'),
    )
  } finally {
    fs.rmSync(absolute, { recursive: true, force: true })
  }
})
