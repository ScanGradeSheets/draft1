import { browserLocalThreeFrameConsensus } from './browser-local-frame-consensus.js'

export const ADD2_STITCHED_YELLOW_LAYOUT_ID = 'sg-g1-lw-02-add-2digit'
export const ADD2_STITCHED_YELLOW_MIN_PROBABILITY = 0.999

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

/**
 * Key-blind single-view rescue for the one layout supported by the saved
 * evidence. This deliberately cannot replace an accepted browser answer.
 * A result must be the complete stitched whole-answer crop, valid, nonblank,
 * digit-only, and at or above the frozen 0.999 minimum token probability.
 */
export function browserLocalAdd2StitchedYellowDecisions({
  layoutId = '',
  answerGroups = [],
  predictions = [],
  strongRows = [],
} = {}) {
  const supportedLayout = String(layoutId) === ADD2_STITCHED_YELLOW_LAYOUT_ID
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
      const rows = rowsByQuestion.get(questionNum) || []
      const row = rows.length === 1 ? rows[0] : null
      const text = String(row?.text || '')
      const completeStitchedRead = Boolean(
        row &&
        row.status === 'complete' &&
        row.cropVariant === 'stitched-original-grayscale' &&
        row.valid === true &&
        row.blank !== true &&
        /^\d{1,2}$/.test(text) &&
        Number(row?.contract?.physicalSlotCount) === 2 &&
        Number(row?.contract?.maxHandwrittenDigits) === 2 &&
        Number(row.minTokenProbability) >= ADD2_STITCHED_YELLOW_MIN_PROBABILITY,
      )
      const vetoed = blockingSafetyVeto(
        predictionsByQuestion.get(questionNum) || [],
      )
      const automatic = supportedLayout && !vetoed && completeStitchedRead
      return {
        questionNum,
        initiallyAutomatic: false,
        currentRead: String(group?.answerText || ''),
        blockingSafetyVeto: vetoed,
        evidence: {
          stitched: row ? {
            status: row.status,
            cropVariant: row.cropVariant,
            read: text,
            valid: row.valid === true,
            blank: row.blank === true,
            probability: Number(row.minTokenProbability) || 0,
          } : null,
        },
        decision: {
          automatic,
          read: automatic ? text : String(group?.answerText || ''),
          reason: automatic
            ? 'add2-original-yellow-stitched-min-0.999'
            : !supportedLayout
              ? 'unsupported-layout'
              : vetoed
                ? 'blocking-safety-veto'
                : 'insufficient-add2-stitched-evidence',
          preAcceptance: true,
          answerKeyUsed: false,
        },
      }
    })
}
