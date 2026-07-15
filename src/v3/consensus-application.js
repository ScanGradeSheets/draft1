import { cellsForReviewText } from './local-first-review.js'

export const CONSENSUS_APPLICATION_VERSION = 'consensus-application-experimental-1'

/**
 * Apply already-authorized key-blind consensus decisions to cloned browser
 * predictions. This function does not grade and never accepts an answer key.
 */
export function applyConsensusPromotionsToPredictions({
  questionGroups = [],
  predictions = [],
  decisions = [],
} = {}) {
  const nextPredictions = (predictions || []).map((prediction) => ({ ...prediction }))
  const byId = new Map(nextPredictions.map((prediction) => [Number(prediction.id), prediction]))
  const decisionByQuestion = new Map((decisions || [])
    .filter((decision) => decision?.promote === true && /^\d{1,4}$/.test(String(decision?.automaticText || '')))
    .map((decision) => [Number(decision.questionNum), decision]))
  const applied = []

  for (const group of questionGroups || []) {
    const questionNum = Number(group?.question_num)
    const decision = decisionByQuestion.get(questionNum)
    if (!decision) continue
    const ids = Array.isArray(group?.digit_box_ids) ? group.digit_box_ids.map(Number) : []
    const cells = cellsForReviewText(decision.automaticText, ids.length)
    if (!cells || cells.length !== ids.length) continue
    for (let index = 0; index < ids.length; index += 1) {
      const prediction = byId.get(ids[index])
      if (!prediction) continue
      const digit = cells[index]
      prediction.digit = digit
      prediction.blank = digit == null
      prediction.empty = digit == null
      prediction.reviewNeeded = false
      prediction.preprocessReviewReason = null
      prediction.consensusPromotion = {
        version: CONSENSUS_APPLICATION_VERSION,
        policyVersion: decision.policyVersion,
        questionNum,
        automaticText: decision.automaticText,
        reason: decision.reason,
        evidence: decision.evidence || null,
      }
      // Per-slot mathematical correctness is deliberately removed. Grading is
      // recomputed by the existing grading layer after transcription changes.
      delete prediction.correct
    }
    applied.push({
      questionNum,
      automaticText: String(decision.automaticText),
      digitBoxIds: ids,
      policyVersion: decision.policyVersion,
      reason: decision.reason,
    })
  }

  return {
    version: CONSENSUS_APPLICATION_VERSION,
    answerKeyUsed: false,
    predictions: nextPredictions,
    applied,
  }
}
