import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { evaluateProspective, loadProspectiveSessions, validateTruthFile } from '../scripts/evaluate_hybrid_v2_packets.mjs'

const plan = {
  seed: 'abc123',
  selected: [
    { packetId: 'P08', role: 'development-1' },
    { packetId: 'P02', role: 'locked-test' },
  ],
}

const truth = {
  labels: [
    { packetId: 'P08', layoutId: 'layout-a', questionNum: 1, truthState: 'value', handwrittenTruth: '6', qaStatus: 'verified', primaryLabeler: 'a', verificationLabeler: 'b' },
    { packetId: 'P08', layoutId: 'layout-a', questionNum: 2, truthState: 'value', handwrittenTruth: '9', qaStatus: 'verified', primaryLabeler: 'a', verificationLabeler: 'b' },
    { packetId: 'P02', layoutId: 'layout-a', questionNum: 1, truthState: 'value', handwrittenTruth: '5', qaStatus: 'verified', primaryLabeler: 'a', verificationLabeler: 'b' },
  ],
}

function session(packetId, role, answerGroups, predictions = [], suffix = 'one') {
  return {
    sessionId: `${packetId}-${suffix}`,
    burstFrameCount: 3,
    successful: true,
    debug: {
      packetId,
      captureRole: role,
      capturePlanSeed: 'abc123',
      layoutId: 'layout-a',
      captureQuality: {
        captureGateTelemetry: { attempts: 2, accepted: 1, rejectionCounts: { 'focus-gate': 1 } },
      },
      answerGroups,
      predictions,
      v3Shadow: {
        policyVersion: 'test-v3',
        frameCount: 3,
        decisions: answerGroups.map((group) => ({
          questionNum: group.questionNum,
          slotRead: group.answerText,
          sequenceRead: group.questionNum === 2 ? '9' : group.answerText,
          compactRead: group.questionNum === 2 ? '9' : group.answerText,
          decision: group.questionNum === 2 ? { action: 'accept', read: '9' } : { action: 'review', read: null },
        })),
      },
    },
  }
}

test('prospective evaluator preserves control, scores hybrid choices, and excludes locked packet by default', () => {
  const development = session('P08', 'development-1', [
    { questionNum: 1, digitBoxIds: [0], answerText: '6', reviewNeeded: false, answer: 7 },
    { questionNum: 2, digitBoxIds: [1], answerText: '4', reviewNeeded: true, answer: 9 },
  ], [
    { id: 0 },
    {
      id: 1,
      wholeAnswerReviewSuggestion: { text: '9' },
      hybridDecision: {
        choices: [{ text: '4' }, { text: '9' }],
        shadowPromotionEligible: true,
        shadowPromotionText: '9',
      },
    },
  ])
  const locked = session('P02', 'locked-test', [
    { questionNum: 1, digitBoxIds: [0], answerText: '5', reviewNeeded: false, answer: 5 },
  ])
  const report = evaluateProspective({ sessions: [development, locked], truth, plan })
  assert.equal(report.integrity.valid, true)
  assert.equal(report.overall.scoredAnswers, 2)
  assert.equal(report.overall.controlAutomatic, 1)
  assert.equal(report.overall.controlAutomaticCorrect, 1)
  assert.equal(report.overall.hybridAdditionalCorrectChoices, 1)
  assert.equal(report.overall.shadowEligible, 1)
  assert.equal(report.overall.shadowCorrect, 1)
  assert.equal(report.overall.v3ShadowAccepted, 1)
  assert.equal(report.overall.v3ShadowCorrect, 1)
  assert.equal(report.overall.v3AdditionalCorrectChoices, 1)
  assert.equal(report.includedLockedPacket, false)
  assert.equal(report.capture.cameraGateAttempts, 2)
  assert.equal(report.capture.cameraGateRejections, 1)
  assert.equal(report.capture.cameraGateRejectionCounts['focus-gate'], 1)
  assert.equal(report.rows.some((row) => row.packetId === 'P02'), false)
  assert.equal(report.rows[0].mathCorrect, false)
})

test('duplicate successful page sessions fail integrity instead of selecting a favorable scan', () => {
  const page = [{ questionNum: 1, digitBoxIds: [0], answerText: '6', reviewNeeded: false, answer: 7 }]
  const report = evaluateProspective({
    sessions: [
      session('P08', 'development-1', page, [], 'one'),
      session('P08', 'development-1', page, [], 'two'),
    ],
    truth,
    plan,
  })
  assert.equal(report.integrity.valid, false)
  assert.match(report.integrity.issues.join('\n'), /explicit duplicate adjudication required/)
  assert.equal(report.overall.scoredAnswers, 0)
})

test('truth validation rejects unverified and answerless value labels', () => {
  const issues = validateTruthFile({ labels: [
    { packetId: 'P08', layoutId: 'layout-a', questionNum: 1, truthState: 'value', handwrittenTruth: '', qaStatus: 'single', primaryLabeler: 'same', verificationLabeler: 'same' },
  ] }, plan)
  assert.match(issues.join('\n'), /not independently verified/)
  assert.match(issues.join('\n'), /invalid transcription target/)
  assert.match(issues.join('\n'), /two distinct labelers/)
})

test('scan loader joins lightweight correction uploads to the original session', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scangrade-hybrid-eval-'))
  const writeVersion = (name, receivedAt, debug, burstCount) => {
    const dir = path.join(root, name)
    fs.mkdirSync(dir)
    fs.writeFileSync(path.join(dir, 'debug.json'), JSON.stringify({ receivedAt, upload: { uploadReason: name }, debug }))
    fs.writeFileSync(path.join(dir, 'summary.json'), JSON.stringify({ receivedAt, assets: { hybridBurstFrameCount: burstCount } }))
  }
  writeVersion('initial', '2026-01-01T00:00:00Z', {
    scanSessionId: 'joined-session',
    packetId: 'P08',
    layoutId: 'layout-a',
    answerGroups: [{ questionNum: 1 }],
  }, 3)
  writeVersion('correction', '2026-01-01T00:00:01Z', {
    scanSessionId: 'joined-session',
    packetId: 'P08',
    layoutId: 'layout-a',
    answerGroups: [{ questionNum: 1 }],
    manualCorrections: { '1': { text: '7' } },
  }, 0)
  const sessions = loadProspectiveSessions(root)
  assert.equal(sessions.length, 1)
  assert.equal(sessions[0].versions, 2)
  assert.equal(sessions[0].burstFrameCount, 3)
  assert.equal(sessions[0].debug.manualCorrections['1'].text, '7')
})
