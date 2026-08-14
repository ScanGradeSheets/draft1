import { browserLocalThreeFrameConsensus } from './browser-local-frame-consensus.js'

function blockingSafetyVeto(rows = []) {
  return rows.some((prediction) => Boolean(
    prediction?.forcedReviewReason ||
    prediction?.structuralReview ||
    prediction?.consensusReviewVeto ||
    prediction?.acceptedAnswerSafetyVeto,
  ))
}

/**
 * Key-blind decisions for the narrow private strong-reader trial.
 *
 * Only answers already yellow in the frozen browser result are eligible.
 * Three complete physical-frame reads must agree exactly and their weakest
 * token probability must meet the frozen 0.90 boundary.
 */
export function browserLocalStrongYellowDecisions({
  answerGroups = [],
  predictions = [],
  strongRows = [],
} = {}) {
  const predictionsByQuestion = new Map()
  for (const prediction of predictions) {
    const questionNum = Number(prediction?.questionNum)
    if (!predictionsByQuestion.has(questionNum)) predictionsByQuestion.set(questionNum, [])
    predictionsByQuestion.get(questionNum).push(prediction)
  }

  const rowsByQuestion = new Map()
  for (const row of strongRows) {
    const questionNum = Number(row?.questionNum)
    if (!rowsByQuestion.has(questionNum)) rowsByQuestion.set(questionNum, [])
    rowsByQuestion.get(questionNum).push(row)
  }

  return answerGroups
    .filter((group) => group?.reviewNeeded === true)
    .map((group) => {
      const questionNum = Number(group?.questionNum)
      const frame = browserLocalThreeFrameConsensus(
        rowsByQuestion.get(questionNum) || [],
      )
      const vetoed = blockingSafetyVeto(
        predictionsByQuestion.get(questionNum) || [],
      )
      const automatic =
        !vetoed &&
        frame.available === true &&
        frame.threeOfThree === true &&
        Number(frame.probability) >= 0.9
      return {
        questionNum,
        initiallyAutomatic: false,
        currentRead: String(group?.answerText || ''),
        blockingSafetyVeto: vetoed,
        evidence: { frame },
        decision: {
          automatic,
          read: automatic ? frame.read : String(group?.answerText || ''),
          reason: automatic
            ? 'three-frame-unanimous-original-yellow'
            : vetoed
              ? 'blocking-safety-veto'
              : 'insufficient-three-frame-consensus',
          preAcceptance: true,
          answerKeyUsed: false,
        },
      }
    })
}
