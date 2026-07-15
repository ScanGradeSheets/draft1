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
  'src/App.vue',
  'src/components/CameraCapture.vue',
  'src/homography.js',
  'src/ocr-pipeline.js',
  'src/hybrid-recognition.js',
  'src/v3/answer-zones.js',
  'src/v3/compact-client.js',
  'src/v3/local-first-review.js',
  'src/v3/confidence-safety.js',
  'src/v3/consensus-promotion.js',
  'src/v3/ambiguity-detector.js',
  'src/v3/consensus-application.js',
  'src/v3/geometry-rescue.js',
  'src/v3/layout-contract.js',
  'src/v3/production-runtime.js',
  'tests/v3-production-runtime.test.mjs',
  'tests/v3-consensus-promotion.test.mjs',
  'scripts/freeze_consensus_candidate.mjs',
  'scripts/serve_trocr_review.py',
  'scripts/serve_v3_compact.py',
  'scripts/replay_v3_crop_candidate_packets.mjs',
  'scripts/test_consensus_webkit_saved_page.mjs',
  'scripts/proxy_tailnet_models_for_replay.py',
  'scripts/score_consensus_integration_replay.mjs',
  'scripts/compare_consensus_matched_control.mjs',
  'scripts/evaluate_nonrow_slot_strong_evidence.mjs',
  'scripts/evaluate_number_bond_crop_variants.mjs',
  'docs/SCANGRADE_CORE_CROP_RESCUE_RESULT_20260715.md',
  'docs/SCANGRADE_CORE_CROP_PRIVATE_BETA4_DEPLOYMENT_20260715.md',
  'private-evidence/models/v3-sequence-live/model.onnx',
  'public/models/worksheet-digit-tony-generalist-noaug-20260601.onnx',
  'public/models/worksheet-digit-live-trusted-temp.onnx',
  'public/models/worksheet-digit-generalist.onnx',
  'public/ort-wasm-nosimd.wasm',
  'public/ort-wasm-simd-1.17.wasm',
  'private-evidence/models/trocr-lora-calibrated-2epoch-20260709/adapter_model.safetensors',
  'private-evidence/models/trocr-lora-calibrated-2epoch-20260709/adapter_config.json',
  'private-evidence/truth-labels/20260703-flex-duplicate-accepted-needs-label/consensus-visual-audit-corrections-20260714.json',
  'private-evidence/reports/consensus-matched-control-four-packet-score-20260714.json',
  'private-evidence/reports/consensus-integration-four-packet-score-20260714.json',
  'private-evidence/reports/consensus-matched-comparison-20260714.json',
  'private-evidence/reports/evidence-pipeline-final-score-20260714.json',
  'private-evidence/reports/consensus-historical-single-frame-stress-20260714.json',
  'private-evidence/reports/nonrow-combined-private-candidate-score-20260715.json',
  'private-evidence/reports/nonrow-combined-private-candidate-score-repeat-20260715.json',
  'private-evidence/reports/core-crop-second-stage-score-20260715.json',
  'private-evidence/reports/core-crop-second-stage-parity-20260715.json',
  'private-evidence/reports/core-crop-second-stage-production-path-webkit-20260715.json',
]
for (let index = 1; index <= 10; index += 1) {
  const filename = `sg-g1-lw-${String(index).padStart(2, '0')}-${[
    'add-1digit', 'add-2digit', 'sub-1digit', 'sub-2digit', 'mixed-20',
    'ten-frames', 'dot-collections', 'number-bonds', 'number-patterns', 'place-value-50',
  ][index - 1]}.json`
  requiredFiles.push(`layouts/${filename}`, `public/layouts/${filename}`)
}
requiredFiles.push('public/worksheets/grade1-last-week-test-20260617/layouts/sg-g1-lw-08-number-bonds.json')

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
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  candidate: 'ScanGrade selected-core-crop private beta 4',
  policyVersions: {
    confidenceSafety: 'confidence-safety-1',
    consensusPromotion: 'consensus-promotion-shadow-2',
    ambiguity: 'answer-ambiguity-shadow-1',
    application: 'consensus-application-experimental-1',
    digitSelection: 'digit-selection-20260714-1',
    answerZoneContract: 'answer-zone-contract-1',
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
    v3NumberBondShiftDown: 1,
    v3NonrowTrimEvidence: 1,
    v3CoreCropEvidence: 1,
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
    pages: 40,
    candidateAutomatic: 250,
    candidateCoveragePct: 90.9,
    candidateAutomaticWrong: 0,
    rowCoveragePct: 93.8,
    nonRowCoveragePct: 87.0,
    promotions: 74,
    reproducibilityPages: 40,
    reproducibilityMismatches: 0,
    coreCropImagesBeforeSecondStage: 309,
    coreCropImagesAfterSecondStage: 48,
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
