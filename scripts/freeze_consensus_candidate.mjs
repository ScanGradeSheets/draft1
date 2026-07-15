#!/usr/bin/env node

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const output = path.resolve(ROOT, process.argv[2] || 'private-evidence/protocols/consensus-candidate-freeze-20260714.json')
const requiredFiles = [
  'package.json',
  'package-lock.json',
  'src/components/CameraCapture.vue',
  'src/hybrid-recognition.js',
  'src/v3/answer-zones.js',
  'src/v3/compact-client.js',
  'src/v3/local-first-review.js',
  'src/v3/confidence-safety.js',
  'src/v3/consensus-promotion.js',
  'src/v3/ambiguity-detector.js',
  'src/v3/consensus-application.js',
  'scripts/serve_trocr_review.py',
  'scripts/serve_v3_compact.py',
  'scripts/replay_v3_crop_candidate_packets.mjs',
  'scripts/score_consensus_integration_replay.mjs',
  'scripts/compare_consensus_matched_control.mjs',
  'private-evidence/models/v3-sequence-live/model.onnx',
  'private-evidence/models/trocr-lora-calibrated-2epoch-20260709/adapter_model.safetensors',
  'private-evidence/models/trocr-lora-calibrated-2epoch-20260709/adapter_config.json',
  'private-evidence/truth-labels/20260703-flex-duplicate-accepted-needs-label/consensus-visual-audit-corrections-20260714.json',
  'private-evidence/reports/consensus-matched-control-four-packet-score-20260714.json',
  'private-evidence/reports/consensus-integration-four-packet-score-20260714.json',
  'private-evidence/reports/consensus-matched-comparison-20260714.json',
]
for (let index = 1; index <= 10; index += 1) {
  requiredFiles.push(`layouts/sg-g1-lw-${String(index).padStart(2, '0')}-${[
    'add-1digit', 'add-2digit', 'sub-1digit', 'sub-2digit', 'mixed-20',
    'ten-frames', 'dot-collections', 'number-bonds', 'number-patterns', 'place-value-50',
  ][index - 1]}.json`)
}

function sha256(file) {
  const bytes = fs.readFileSync(path.join(ROOT, file))
  return crypto.createHash('sha256').update(bytes).digest('hex')
}

const missing = requiredFiles.filter((file) => !fs.existsSync(path.join(ROOT, file)))
if (missing.length) throw new Error(`Missing freeze inputs:\n${missing.join('\n')}`)

const gitHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim()
const gitStatus = execFileSync('git', ['status', '--short'], { cwd: ROOT, encoding: 'utf8' })
  .split(/\r?\n/).filter(Boolean)
const manifest = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  candidate: 'ScanGrade conservative consensus private-beta candidate 1',
  policyVersions: {
    confidenceSafety: 'confidence-safety-1',
    consensusPromotion: 'consensus-promotion-shadow-1',
    ambiguity: 'answer-ambiguity-shadow-1',
    application: 'consensus-application-experimental-1',
  },
  browserFlags: {
    hybridV3: 1,
    v3BurstReplay: 1,
    v3PristineWarp: 1,
    v3SequenceFromZones: 1,
    v3EightFrameColumnOrder: 1,
    v3LocalFirstReview: 1,
    v3ConfidenceSafety: 1,
    v3ConsensusPromotion: 1,
  },
  modelIdentity: {
    strongBaseModel: 'microsoft/trocr-base-handwritten',
    strongAdapter: 'private-evidence/models/trocr-lora-calibrated-2epoch-20260709',
    compactModel: 'private-evidence/models/v3-sequence-live/model.onnx',
  },
  evaluationProtocol: {
    answerKeyUsedForRecognition: false,
    handwrittenTruthRevealedOnlyAfterDecisions: true,
    unitOfHoldout: 'entire predeclared packet; do not randomize answers',
    oneRunOnlyBeforeReporting: true,
    noRetuningOnLockedPacket: true,
    ambiguousLabelsAdjudicatedWithoutPredictionsOrAnswerKey: true,
    publicAccuracyClaimAuthorized: false,
  },
  referenceResult: {
    scorableAnswers: 275,
    matchedControlAutomatic: 172,
    matchedControlCoveragePct: 62.5,
    candidateAutomatic: 222,
    candidateCoveragePct: 80.7,
    candidateAutomaticWrong: 0,
    promotions: 50,
  },
  git: {
    head: gitHead,
    dirtySnapshot: gitStatus.length > 0,
    note: 'Repository contains pre-existing and current uncommitted work. File hashes, not HEAD alone, define this candidate.',
  },
  files: Object.fromEntries(requiredFiles.sort().map((file) => [file, {
    sha256: sha256(file),
    bytes: fs.statSync(path.join(ROOT, file)).size,
  }])),
}

fs.mkdirSync(path.dirname(output), { recursive: true })
fs.writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(JSON.stringify({ output: path.relative(ROOT, output), files: requiredFiles.length, gitHead, dirtySnapshot: gitStatus.length > 0 }, null, 2))
