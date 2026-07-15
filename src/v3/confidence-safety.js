import { compactSuggestionsByQuestion } from './local-first-review.js'

export const CONFIDENCE_SAFETY_POLICY_VERSION = 'confidence-safety-1'
export const CONFIDENCE_SAFETY_COMPACT_LIMIT = 2
export const CONFIDENCE_SAFETY_MIN_JOINT_PROBABILITY = 0.15
export const CONFIDENCE_SAFETY_MIN_COMPONENT_PROBABILITY = 0.20

function finalDigit(prediction) {
  if (prediction?.blank === true || prediction?.empty === true || prediction?.digit == null) return null
  const value = Number(prediction.digit)
  return Number.isInteger(value) ? value : null
}

function dangerousBoxSafeClearance(prediction) {
  const selected = finalDigit(prediction)
  const vote = prediction?.preprocessVoteSummary || {}
  if (selected == null || !vote.top || Number(vote.top.digit) === selected) return false
  return prediction?.confidencePolicyCleared === true &&
    prediction?.preprocessDisagreement === true &&
    prediction?.confidencePolicyClearanceReason === 'validated-review-reason:box-safe-default' &&
    Number(vote.top.share || 0) >= 0.52 &&
    Number(vote.margin || 0) >= 0.05
}

function majorityAlternativeRead(read, prediction) {
  const selected = finalDigit(prediction)
  const majorityDigit = Number(prediction?.preprocessVoteSummary?.top?.digit)
  const index = Number(prediction?.digitIndex)
  const text = String(read || '').replace(/[^0-9]/g, '')
  if (selected == null || !Number.isInteger(majorityDigit) || !Number.isInteger(index)) return null
  if (index < 0 || index >= text.length || text[index] !== String(selected)) return null
  return `${text.slice(0, index)}${majorityDigit}${text.slice(index + 1)}`
}

export function confidenceSafetyCandidateQuestionNumbers(questionGroups = [], predictions = []) {
  const byId = new Map((predictions || []).map((prediction) => [prediction.id, prediction]))
  return (questionGroups || [])
    .filter((group) => (group?.digit_box_ids || []).some((id) => dangerousBoxSafeClearance(byId.get(id))))
    .map((group) => Number(group?.question_num))
    .filter(Number.isFinite)
}

export function confidenceClearanceVetoes(questionGroups = [], predictions = []) {
  const byId = new Map((predictions || []).map((prediction) => [prediction.id, prediction]))
  const vetoes = []
  for (const group of questionGroups || []) {
    const questionNum = Number(group?.question_num)
    for (const id of group?.digit_box_ids || []) {
      const prediction = byId.get(id)
      if (!dangerousBoxSafeClearance(prediction)) continue
      vetoes.push({
        policyVersion: CONFIDENCE_SAFETY_POLICY_VERSION,
        reason: 'weak-clearance-preprocess-majority-conflict',
        questionNum,
        predictionId: id,
        digitIndex: Number(prediction.digitIndex),
        selectedDigit: finalDigit(prediction),
        majorityDigit: Number(prediction.preprocessVoteSummary.top.digit),
        majorityShare: Number(prediction.preprocessVoteSummary.top.share),
        majorityMargin: Number(prediction.preprocessVoteSummary.margin),
      })
    }
  }
  return vetoes
}

/**
 * Key-blind safety check for one known dangerous path. A veto requires:
 * 1) a weak box-safe override cleared an internal preprocessing disagreement;
 * 2) the preprocessing majority describes a complete alternate answer; and
 * 3) the independent whole-answer compact model ranks that exact alternate first.
 *
 * This function does not inspect the answer key or mathematical correctness.
 */
export function confidenceSafetyVetoes({
  questionGroups = [],
  answerGroups = [],
  predictions = [],
  compactReads = [],
} = {}) {
  const byId = new Map((predictions || []).map((prediction) => [prediction.id, prediction]))
  const answerByQuestion = new Map((answerGroups || []).map((group, index) => [
    Number(group?.questionNum ?? index + 1),
    String(group?.answerText || '').replace(/[^0-9]/g, ''),
  ]))
  const compactByQuestion = compactSuggestionsByQuestion(compactReads, { limit: CONFIDENCE_SAFETY_COMPACT_LIMIT })
  const vetoes = []
  for (const group of questionGroups || []) {
    const questionNum = Number(group?.question_num)
    const currentRead = answerByQuestion.get(questionNum) || ''
    const compactChoices = compactByQuestion.get(questionNum) || []
    if (!currentRead || !compactChoices.length) continue
    for (const id of group?.digit_box_ids || []) {
      const prediction = byId.get(id)
      if (!dangerousBoxSafeClearance(prediction)) continue
      const majorityAlternative = majorityAlternativeRead(currentRead, prediction)
      const compactRank = compactChoices.findIndex((choice) =>
        choice.text === majorityAlternative &&
        Number(choice.bestJointProbability || 0) >= CONFIDENCE_SAFETY_MIN_JOINT_PROBABILITY &&
        Number(choice.minComponentProbability || 0) >= CONFIDENCE_SAFETY_MIN_COMPONENT_PROBABILITY)
      if (!majorityAlternative || compactRank < 0) continue
      const compactChoice = compactChoices[compactRank]
      vetoes.push({
        policyVersion: CONFIDENCE_SAFETY_POLICY_VERSION,
        reason: 'compact-confirmed-preprocess-majority-alternative',
        questionNum,
        predictionId: id,
        digitIndex: Number(prediction.digitIndex),
        currentRead,
        majorityAlternative,
        compactRead: compactChoice.text,
        compactRank: compactRank + 1,
        compactJointProbability: Number(compactChoice.bestJointProbability || 0),
        compactMinComponentProbability: Number(compactChoice.minComponentProbability || 0),
        selectedDigit: finalDigit(prediction),
        majorityDigit: Number(prediction.preprocessVoteSummary.top.digit),
        majorityShare: Number(prediction.preprocessVoteSummary.top.share),
        majorityMargin: Number(prediction.preprocessVoteSummary.margin),
      })
    }
  }
  return vetoes
}

export function applyConfidenceSafetyVetoes(predictions = [], vetoes = []) {
  const byId = new Map((predictions || []).map((prediction) => [prediction.id, prediction]))
  for (const veto of vetoes || []) {
    const prediction = byId.get(veto.predictionId)
    if (!prediction) continue
    prediction.reviewNeeded = true
    prediction.confidenceSafetyVeto = { ...veto }
    prediction.preprocessReviewReason = veto.reason
  }
  return vetoes.length
}
