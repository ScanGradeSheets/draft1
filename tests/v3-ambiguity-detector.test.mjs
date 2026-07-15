import test from 'node:test'
import assert from 'node:assert/strict'
import { detectAnswerAmbiguity } from '../src/v3/ambiguity-detector.js'

test('catches the historical 19-to-11 override with a material 9 rival', () => {
  const result = detectAnswerAmbiguity({ predictions: [{
    id: 11,
    digitIndex: 1,
    digit: 1,
    confidence: 0.429788,
    topGap: 0.161493,
    entropyNorm: 0.722568,
    robustOverride: 'right-slot-expected-edge-default',
    confidencePolicyCleared: true,
    topK: [
      { digit: 1, confidence: 0.429788 },
      { digit: 9, confidence: 0.268295 },
    ],
  }] })
  assert.equal(result.detected, true)
  assert.equal(result.reasons[0].reason, 'override-retained-material-rival')
  assert.equal(result.reasons[0].rivalDigit, 9)
})

test('does not flag ordinary decisive evidence or a weak rival', () => {
  for (const prediction of [
    { digit: 1, confidence: .95, topGap: .90, entropyNorm: .1, confidencePolicyCleared: true, topK: [{ digit: 1, confidence: .95 }, { digit: 9, confidence: .05 }] },
    { digit: 1, confidence: .50, topGap: .40, entropyNorm: .3, confidencePolicyCleared: true, topK: [{ digit: 1, confidence: .50 }, { digit: 9, confidence: .10 }] },
    { digit: 1, confidence: .55, topGap: .15, entropyNorm: .75, confidencePolicyCleared: true, topK: [{ digit: 1, confidence: .55 }, { digit: 9, confidence: .30 }] },
    { digit: 1, confidence: .43, topGap: .16, entropyNorm: .72, confidencePolicyCleared: false, robustOverride: null, topK: [{ digit: 1, confidence: .43 }, { digit: 9, confidence: .27 }] },
  ]) assert.equal(detectAnswerAmbiguity({ predictions: [prediction] }).detected, false)
})

test('model-family disagreement and crop clipping force review without choosing a read', () => {
  const family = detectAnswerAmbiguity({ modelFamilyReads: ['34', '39', '34'] })
  assert.equal(family.detected, true)
  assert.equal(family.reasons[0].reason, 'model-families-disagree')
  const crop = detectAnswerAmbiguity({ cropQuality: { inkTouchesCropEdge: true } })
  assert.equal(crop.detected, true)
  assert.equal(crop.reasons[0].reason, 'answer-ink-may-be-clipped')
})

test('answer-key-like fields have no influence', () => {
  const base = { predictions: [{ digit: 4, confidence: .9, topGap: .8, entropyNorm: .1, topK: [{ digit: 4, confidence: .9 }] }] }
  assert.deepEqual(
    detectAnswerAmbiguity({ ...base, answer: 9, answerKey: 9 }),
    detectAnswerAmbiguity({ ...base, answer: 4, answerKey: 4 }),
  )
})
