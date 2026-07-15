#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { loadProspectiveSessions } from './evaluate_hybrid_v2_packets.mjs'

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function parseArgs(argv) {
  const options = {
    scanRoot: 'private-evidence/debug-scans',
    plan: 'private-evidence/capture-plans/four-packet-plan.json',
    out: 'private-evidence/hybrid-v2-prospective/handwritten-truth-development.json',
    includeLocked: false,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--scan-root') options.scanRoot = argv[++index]
    else if (value === '--plan') options.plan = argv[++index]
    else if (value === '--out') options.out = argv[++index]
    else if (value === '--include-locked') options.includeLocked = true
    else throw new Error(`Unknown argument: ${value}`)
  }
  return options
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  const plan = readJson(options.plan)
  const roles = new Map((plan.selected || []).map((row) => [row.packetId, row.role]))
  const sessions = loadProspectiveSessions(options.scanRoot)
    .filter((session) => session.successful && roles.has(session.debug.packetId))
    .filter((session) => options.includeLocked || roles.get(session.debug.packetId) !== 'locked-test')
  const pageKeys = new Set()
  const labels = []
  for (const session of sessions) {
    const packetId = session.debug.packetId
    const layoutId = session.debug.layoutId || session.debug.qrPayload?.template_id
    const pageKey = `${packetId}|${layoutId}`
    if (pageKeys.has(pageKey)) throw new Error(`duplicate successful page requires adjudication before labelling: ${pageKey}`)
    pageKeys.add(pageKey)
    for (const group of session.debug.answerGroups || []) {
      labels.push({
        packetId,
        role: roles.get(packetId),
        layoutId,
        questionNum: Number(group.questionNum ?? group.question_num),
        truthState: null,
        handwrittenTruth: null,
        qaStatus: 'unlabelled',
        primaryLabeler: null,
        verificationLabeler: null,
        verifiedAt: null,
        notes: '',
      })
    }
  }
  labels.sort((a, b) => a.packetId.localeCompare(b.packetId) || a.layoutId.localeCompare(b.layoutId) || a.questionNum - b.questionNum)
  const template = {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    capturePlanSeed: plan.seed,
    includesLockedPacket: options.includeLocked,
    answerKeyUsedAsTruth: false,
    instructions: [
      'Label only what is visibly written, not whether the math is correct.',
      'Allowed truthState: value, blank, erased, crossed-out, overwritten, unreadable.',
      'For value, handwrittenTruth must contain 1-4 digits. For blank, leave it empty.',
      'A second distinct labeler must verify every row before qaStatus becomes verified.',
    ],
    labels,
  }
  fs.mkdirSync(path.dirname(options.out), { recursive: true })
  fs.writeFileSync(options.out, `${JSON.stringify(template, null, 2)}\n`, { flag: 'wx' })
  console.log(JSON.stringify({ out: options.out, pages: pageKeys.size, labels: labels.length, includesLockedPacket: options.includeLocked }, null, 2))
}

try { main() } catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
