#!/usr/bin/env node

import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const digest = (value) => crypto.createHash('sha256').update(String(value || '')).digest('hex')

function normalizedPrediction(prediction) {
  return {
    id: prediction?.id ?? null,
    questionNum: prediction?.questionNum ?? null,
    digitIndex: prediction?.digitIndex ?? null,
    digit: prediction?.digit ?? null,
    blank: prediction?.blank === true,
    confidence: prediction?.confidence ?? null,
    probs: prediction?.probs || [],
    topK: prediction?.topK || [],
    preprocessVariants: prediction?.preprocessVariants || [],
    preprocessVoteSummary: prediction?.preprocessVoteSummary || null,
  }
}

export function deterministicEvidence(debug) {
  return {
    candidateIdentity: debug?.candidateIdentity || null,
    layoutId: debug?.layoutId || null,
    modelInputHashes: (debug?.modelInputDataUrls || []).map(digest),
    predictions: (debug?.predictions || []).map(normalizedPrediction),
  }
}

export function compareDeterministicReplays(left, right) {
  const a = deterministicEvidence(left)
  const b = deterministicEvidence(right)
  try {
    assert.deepEqual(b, a)
    return { ok: true, evidence: a, mismatch: null }
  } catch (error) {
    return { ok: false, evidence: null, mismatch: String(error?.message || error) }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [leftArg, rightArg] = process.argv.slice(2)
  if (!leftArg || !rightArg) throw new Error('Usage: compare_replay_determinism.mjs LEFT_DEBUG RIGHT_DEBUG')
  const leftPath = path.resolve(ROOT, leftArg)
  const rightPath = path.resolve(ROOT, rightArg)
  const result = compareDeterministicReplays(
    JSON.parse(fs.readFileSync(leftPath, 'utf8')),
    JSON.parse(fs.readFileSync(rightPath, 'utf8')),
  )
  console.log(JSON.stringify({ left: path.relative(ROOT, leftPath), right: path.relative(ROOT, rightPath), ...result }, null, 2))
  if (!result.ok) process.exitCode = 1
}
