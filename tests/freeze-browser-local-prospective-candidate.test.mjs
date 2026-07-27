import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import test from 'node:test'

const ROOT = process.cwd()
const script = path.join(ROOT, 'scripts/freeze_browser_local_prospective_candidate.mjs')

function writeFixture(dir, candidate) {
  fs.mkdirSync(path.join(dir, 'candidate'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'candidate', 'policy.js'), 'export const policy = "safe"\n')
  fs.writeFileSync(path.join(dir, 'candidate', 'model.onnx'), 'local-model-bytes\n')
  fs.writeFileSync(path.join(dir, 'candidate.json'), `${JSON.stringify(candidate, null, 2)}\n`)
}

test('writes a hash-locked browser-local prospective freeze with no recognition truth', () => {
  const relative = path.relative(ROOT, fs.mkdtempSync(path.join(ROOT, '.tmp-prospective-freeze-')))
  try {
    writeFixture(path.join(ROOT, relative), {
      candidateId: 'local-reader-a', runtime: 'browser-local', uploadFree: true, zeroInferenceCost: true,
      answerKeyUsed: false, teacherCorrectionsUsed: false,
      sourceFiles: [`${relative}/candidate/policy.js`], modelAssets: [`${relative}/candidate/model.onnx`],
      failOpenPolicy: 'yellow', deviceFallback: 'browser-ocr-yellow', featureFlags: { localReader: true },
    })
    const output = `${relative}/freeze.json`
    execFileSync(process.execPath, [script, `${relative}/candidate.json`, output], { cwd: ROOT })
    const freeze = JSON.parse(fs.readFileSync(path.join(ROOT, output), 'utf8'))
    assert.equal(freeze.candidate.runtime, 'browser-local')
    assert.equal(freeze.publicDeploymentAuthorized, false)
    assert.equal(freeze.identities.sourceFiles.length, 1)
    assert.equal(freeze.identities.modelAssets.length, 1)
  } finally {
    fs.rmSync(path.join(ROOT, relative), { recursive: true, force: true })
  }
})

test('fails closed if an answer-key-shaped field is included', () => {
  const relative = path.relative(ROOT, fs.mkdtempSync(path.join(ROOT, '.tmp-prospective-freeze-')))
  try {
    writeFixture(path.join(ROOT, relative), {
      candidateId: 'leaky-reader', runtime: 'browser-local', uploadFree: true, zeroInferenceCost: true,
      answerKeyUsed: false, teacherCorrectionsUsed: false, answerKeyHint: 'forbidden',
      sourceFiles: [`${relative}/candidate/policy.js`], modelAssets: [`${relative}/candidate/model.onnx`],
    })
    assert.throws(
      () => execFileSync(process.execPath, [script, `${relative}/candidate.json`, `${relative}/freeze.json`], { cwd: ROOT, stdio: 'pipe' }),
      /answerKeyHint is forbidden/,
    )
    assert.equal(fs.existsSync(path.join(ROOT, relative, 'freeze.json')), false)
  } finally {
    fs.rmSync(path.join(ROOT, relative), { recursive: true, force: true })
  }
})
