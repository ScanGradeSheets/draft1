#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const DEFAULT_DEBUG_DIR = '/Users/teecush/Downloads';
const DEFAULT_URL = process.env.SG_REPLAY_URL || 'https://localhost:5174';
const DEFAULT_EXCLUDED_IDS = new Set([
  '1777087500592'
]);

const ROBUST_RETRY_CONFIDENCE_THRESHOLD = 0.86;
const ROBUST_RETRY_MARGIN_THRESHOLD = 0.18;
const LOW_CONFIDENCE_THRESHOLD = 0.78;
const LOW_MARGIN_THRESHOLD = 0.08;
const AUTO_CHECK_CONFIDENCE_THRESHOLD = 0.45;
const AUTO_CHECK_MARGIN_THRESHOLD = 0.06;
const AUTO_X_CONFIDENCE_THRESHOLD = LOW_CONFIDENCE_THRESHOLD;
const AUTO_X_MARGIN_THRESHOLD = LOW_MARGIN_THRESHOLD;
const TWO_DIGIT_AUTO_X_CONFIDENCE_THRESHOLD = 0.88;
const TWO_DIGIT_AUTO_X_MARGIN_THRESHOLD = 0.20;
const TWO_DIGIT_RIGHT_SLOT_AUTO_X_CONFIDENCE_THRESHOLD = 0.92;
const TWO_DIGIT_RIGHT_SLOT_AUTO_X_MARGIN_THRESHOLD = 0.28;
const TWO_DIGIT_OPTIONAL_LEADING_AUTO_X_CONFIDENCE_THRESHOLD = 0.92;
const TWO_DIGIT_OPTIONAL_LEADING_AUTO_X_MARGIN_THRESHOLD = 0.50;

function normalizeGradingDigit(value) {
  if (value == null || value === '' || value === '_') return null;
  const digit = Number(value);
  return Number.isInteger(digit) && digit >= 0 && digit <= 9 ? digit : undefined;
}

function normalizeGradingCells(cells) {
  if (!Array.isArray(cells)) return null;
  const out = [];
  for (const cell of cells) {
    const normalized = normalizeGradingDigit(cell);
    if (normalized === undefined) return null;
    out.push(normalized);
  }
  return out;
}

function acceptedResponsesFromAnswer(answer, slotCount) {
  if (answer == null) return [];
  const text = String(answer).trim();
  if (!/^\d+$/.test(text)) return [];
  const digits = text.split('').map((digit) => Number(digit));
  if (slotCount === 2 && digits.length === 1) {
    const digit = digits[0];
    return [
      [null, digit],
      [digit, null],
      [0, digit]
    ];
  }
  if (digits.length === slotCount) return [digits];
  if (digits.length < slotCount) {
    return [Array(slotCount - digits.length).fill(null).concat(digits)];
  }
  return [];
}

function acceptedResponsesForGroup(group, slotCount) {
  const configured = Array.isArray(group?.accepted_digit_responses)
    ? group.accepted_digit_responses
      .map((response) => normalizeGradingCells(Array.isArray(response) ? response : response?.digits))
      .filter(Boolean)
    : [];
  if (configured.length > 0) return configured;
  return acceptedResponsesFromAnswer(group?.answer, slotCount);
}

function predictionCellsForIds(ids, byId) {
  const cells = [];
  for (const id of ids) {
    const prediction = byId.get(id);
    if (!prediction) return null;
    const normalized = normalizeGradingDigit(
      prediction.blank === true || prediction.empty === true ? null : prediction.digit
    );
    if (normalized === undefined) return null;
    cells.push(normalized);
  }
  return cells;
}

function gradingCellsMatch(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function optionalSingleDigitForGroup(group, ids) {
  if (!Array.isArray(ids) || ids.length !== 2) return null;
  const answer = group?.answer == null ? '' : String(group.answer).trim();
  if (!/^\d$/.test(answer)) return null;
  const digit = Number(answer);
  const acceptedResponses = acceptedResponsesForGroup(group, ids.length);
  const hasFlexibleBlank = acceptedResponses.some((response) => (
    Array.isArray(response) &&
    response.length === ids.length &&
    response.includes(digit) &&
    response.includes(null)
  ));
  return hasFlexibleBlank ? digit : null;
}

function matchingOptionalDigitLooksUsable(prediction, quality) {
  if (!prediction) return false;
  const confidence = numberOrZero(prediction.confidence);
  const topGap = numberOrZero(prediction.topGap);
  if (confidence >= 0.70 && topGap >= 0.40) return true;
  const inkPixels = numberOrZero(quality?.inkPixels);
  const maxRowCount = numberOrZero(quality?.maxRowCount);
  const weakRatio = numberOrZero(quality?.weakVariantRatio);
  const artifactRatio = numberOrZero(quality?.artifactVariantRatio);
  return (
    confidence >= 0.58 &&
    topGap >= 0.26 &&
    inkPixels >= 28 &&
    maxRowCount >= 4 &&
    weakRatio < 0.45 &&
    artifactRatio < 0.35
  );
}

function optionalBlankSlotLooksLikeArtifact(prediction, quality) {
  if (!prediction) return false;
  const confidence = numberOrZero(prediction.confidence);
  const topGap = numberOrZero(prediction.topGap);
  const reason = String(prediction.preprocessReviewReason || '');
  const reviewSignal =
    prediction.reviewNeeded === true ||
    prediction.highRiskPreprocessReview === true ||
    prediction.structuralReview === true ||
    prediction.preprocessDisagreement === true ||
    reason.length > 0;
  const weakModel = confidence < 0.72 || topGap < 0.35;
  const weakInk =
    !quality?.ok ||
    quality?.allVariantsWeak === true ||
    numberOrZero(quality?.weakVariantRatio) >= 0.35 ||
    numberOrZero(quality?.artifactVariantRatio) >= 0.15 ||
    numberOrZero(quality?.inkPixels) <= 38 ||
    numberOrZero(quality?.maxRowCount) <= 4 ||
    numberOrZero(quality?.inkW) <= 8;
  const guideLineOne =
    prediction.digit === 1 &&
    reviewSignal &&
    (
      prediction.highRiskPreprocessReview === true ||
      reason.includes('mismatch') ||
      reason.includes('guide') ||
      reason.includes('two-digit')
    );
  const strongExtraDigit =
    confidence >= 0.93 &&
    topGap >= 0.82 &&
    prediction.reviewNeeded !== true &&
    !weakInk;
  return !strongExtraDigit && (guideLineOne || (reviewSignal && (weakModel || weakInk)));
}

function plausibleSingleDigitResponseSlot(prediction, quality) {
  if (!prediction) return false;
  const digit = normalizeGradingDigit(
    prediction.blank === true || prediction.empty === true ? null : prediction.digit
  );
  if (digit === null || digit === undefined) return false;
  const confidence = numberOrZero(prediction.confidence);
  const topGap = numberOrZero(prediction.topGap);
  const inkPixels = numberOrZero(quality?.inkPixels);
  const inkW = numberOrZero(quality?.inkW);
  const inkH = numberOrZero(quality?.inkH);
  const weakRatio = numberOrZero(quality?.weakVariantRatio);
  const artifactRatio = numberOrZero(quality?.artifactVariantRatio);
  if (
    quality?.lineArtifactLikely === true ||
    quality?.horizontalArtifactLikely === true ||
    quality?.edgeArtifactLikely === true ||
    artifactRatio >= 0.30 ||
    weakRatio >= 0.55
  ) {
    return false;
  }
  if (quality?.ok && inkPixels >= 42 && inkW >= 9 && inkH >= 10 && weakRatio < 0.55 && artifactRatio < 0.30) {
    return true;
  }
  return confidence >= 0.66 && topGap >= 0.34 && inkPixels >= 28 && inkW >= 7 && inkH >= 9 && weakRatio < 0.55 && artifactRatio < 0.35;
}

function oneDigitResponseSlotCanAutoGrade(prediction, quality) {
  if (!prediction || !plausibleSingleDigitResponseSlot(prediction, quality)) return false;
  const confidence = numberOrZero(prediction.confidence);
  const topGap = numberOrZero(prediction.topGap);
  const weakRatio = numberOrZero(quality?.weakVariantRatio);
  const artifactRatio = numberOrZero(quality?.artifactVariantRatio);
  return (
    confidence >= 0.82 &&
    topGap >= 0.52 &&
    weakRatio < 0.25 &&
    artifactRatio < 0.12 &&
    prediction.highRiskPreprocessReview !== true &&
    prediction.structuralReview !== true &&
    prediction.highRiskMismatchReview !== true
  );
}

function applyOptionalSingleDigitBlankOverrides(questionGroups, predictions, cropQuality) {
  if (!Array.isArray(questionGroups) || !Array.isArray(predictions)) return [];
  const predictionById = new Map(predictions.map((prediction) => [prediction.id, prediction]));
  const qualityById = new Map((cropQuality || []).map((quality) => [quality.id, quality]));
  const overrides = [];

  for (const group of questionGroups) {
    const ids = Array.isArray(group?.digit_box_ids) ? group.digit_box_ids : [];
    const expectedDigit = optionalSingleDigitForGroup(group, ids);
    if (expectedDigit === null) continue;

    const slots = ids.map((id, slotIndex) => ({
      id,
      slotIndex,
      prediction: predictionById.get(id),
      quality: qualityById.get(id)
    }));
    if (slots.some((slot) => !slot.prediction)) continue;

    const expectedMatchingSlots = slots.filter((slot) => (
      slot.prediction.digit === expectedDigit &&
      matchingOptionalDigitLooksUsable(slot.prediction, slot.quality)
    ));
    const plausibleDigitSlots = slots.filter((slot) => plausibleSingleDigitResponseSlot(slot.prediction, slot.quality));
    const matchingSlots = expectedMatchingSlots.length === 1 ? expectedMatchingSlots : plausibleDigitSlots;
    if (matchingSlots.length !== 1) continue;

    const blankSlot = slots.find((slot) => slot.slotIndex !== matchingSlots[0].slotIndex);
    if (!blankSlot) continue;
    if (expectedMatchingSlots.length === 1 && blankSlot.prediction.digit === expectedDigit) continue;
    if (!optionalBlankSlotLooksLikeArtifact(blankSlot.prediction, blankSlot.quality)) continue;

    const matchedPrediction = matchingSlots[0].prediction;
    const blankPrediction = blankSlot.prediction;
    const canAutoGrade = expectedMatchingSlots.length === 1
      ? matchingOptionalDigitLooksUsable(matchedPrediction, matchingSlots[0].quality)
      : oneDigitResponseSlotCanAutoGrade(matchedPrediction, matchingSlots[0].quality);
    if (matchedPrediction.reviewNeeded === true && canAutoGrade) {
      matchedPrediction.reviewNeeded = false;
      matchedPrediction.preprocessReviewReason = matchedPrediction.preprocessReviewReason || 'flexible-one-digit-answer';
      matchedPrediction.confidencePolicyCleared = true;
      matchedPrediction.confidencePolicyClearanceReason = 'flexible-one-digit-answer';
    }
    blankPrediction.originalDigitBeforeBlankOverride = blankPrediction.digit;
    blankPrediction.originalConfidenceBeforeBlankOverride = blankPrediction.confidence;
    blankPrediction.digit = null;
    blankPrediction.blank = true;
    blankPrediction.empty = true;
    blankPrediction.reviewNeeded = false;
    blankPrediction.preprocessReviewReason = 'flexible-one-digit-optional-blank';
    blankPrediction.confidencePolicyCleared = true;
    blankPrediction.confidencePolicyClearanceReason = 'flexible-one-digit-optional-blank';
    overrides.push({
      questionNum: group?.question_num ?? null,
      expectedDigit,
      matchedSlotIndex: matchingSlots[0].slotIndex,
      blankSlotIndex: blankSlot.slotIndex,
      blankDigitBoxId: blankSlot.id,
      matchedDigit: matchedPrediction.digit,
      expectedMatch: expectedMatchingSlots.length === 1,
      autoGradeCleared: canAutoGrade,
      originalDigit: blankPrediction.originalDigitBeforeBlankOverride,
      reason: blankPrediction.preprocessReviewReason
    });
  }

  return overrides;
}

function buildQuestionCorrect(questionGroups, predictions) {
  if (!Array.isArray(questionGroups) || questionGroups.length === 0) return null;
  const byId = new Map(predictions.map((prediction) => [prediction.id, prediction]));
  const out = [];
  for (const group of questionGroups) {
    const ids = Array.isArray(group?.digit_box_ids) ? group.digit_box_ids : [];
    if (ids.length === 0) return null;
    const predictionCells = predictionCellsForIds(ids, byId);
    if (!predictionCells) return null;
    const acceptedResponses = acceptedResponsesForGroup(group, ids.length);
    if (acceptedResponses.length > 0) {
      out.push(acceptedResponses.some((response) => gradingCellsMatch(predictionCells, response)));
      continue;
    }
    const groupPredictions = ids.map((id) => byId.get(id));
    if (groupPredictions.some((prediction) => prediction?.correct === undefined)) return null;
    out.push(groupPredictions.every((prediction) => prediction.correct === true));
  }
  return out;
}

function buildQuestionReviewFlags(questionGroups, predictions) {
  if (!Array.isArray(questionGroups) || questionGroups.length === 0) return null;
  const byId = new Map(predictions.map((prediction) => [prediction.id, prediction]));
  return questionGroups.map((group) => {
    const ids = Array.isArray(group?.digit_box_ids) ? group.digit_box_ids : [];
    return ids.some((id) => byId.get(id)?.reviewNeeded);
  });
}

function tensorInkQuality(tensor, id = null) {
  const values = tensor && typeof tensor.length === 'number' ? tensor : [];
  let inkPixels = 0;
  let minX = 28;
  let minY = 28;
  let maxX = -1;
  let maxY = -1;
  const rowCounts = Array(28).fill(0);
  const colCounts = Array(28).fill(0);
  let edgeInkPixels = 0;
  for (let i = 0; i < Math.min(values.length, 28 * 28); i++) {
    const value = Number(values[i]) || 0;
    if (value <= 0.16) continue;
    const y = Math.floor(i / 28);
    const x = i - y * 28;
    inkPixels += 1;
    rowCounts[y] += 1;
    colCounts[x] += 1;
    if (x <= 1 || x >= 26 || y <= 1 || y >= 26) edgeInkPixels += 1;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  const inkW = maxX >= minX ? maxX - minX + 1 : 0;
  const inkH = maxY >= minY ? maxY - minY + 1 : 0;
  const density = inkW > 0 && inkH > 0 ? inkPixels / (inkW * inkH) : 0;
  const maxRowCount = rowCounts.length ? Math.max(...rowCounts) : 0;
  const maxColCount = colCounts.length ? Math.max(...colCounts) : 0;
  const edgeInkRatio = inkPixels ? edgeInkPixels / inkPixels : 0;
  const horizontalArtifactLikely =
    inkPixels >= 8 &&
    inkW >= 11 &&
    (
      inkH <= 6 ||
      maxRowCount >= Math.max(9, Math.round(inkPixels * 0.42))
    );
  const verticalEdgeArtifactLikely =
    inkPixels >= 10 &&
    inkPixels <= 90 &&
    inkW <= 7 &&
    inkH >= 12 &&
    density <= 0.72 &&
    edgeInkRatio >= 0.30;
  const edgeArtifactLikely =
    inkPixels >= 8 &&
    edgeInkRatio >= 0.48 &&
    (inkW <= 8 || inkH <= 8 || density <= 0.46);
  const lineArtifactLikely =
    horizontalArtifactLikely ||
    verticalEdgeArtifactLikely ||
    edgeArtifactLikely;
  const plausibleDigitShape =
    inkPixels >= 14 &&
    inkW >= 3 &&
    inkH >= 8 &&
    !horizontalArtifactLikely &&
    !edgeArtifactLikely;
  return {
    id,
    inkPixels,
    inkW,
    inkH,
    density,
    maxRowCount,
    maxColCount,
    edgeInkRatio,
    horizontalArtifactLikely,
    verticalEdgeArtifactLikely,
    edgeArtifactLikely,
    lineArtifactLikely,
    ok: plausibleDigitShape
  };
}

function tensorQualityScore(quality) {
  if (!quality) return -Infinity;
  let score = 0;
  if (quality.ok) score += 1000;
  if (!quality.lineArtifactLikely) score += 220;
  if (quality.horizontalArtifactLikely) score -= 220;
  if (quality.edgeArtifactLikely) score -= 160;
  if (quality.verticalEdgeArtifactLikely) score -= 120;
  score += Math.min(quality.inkPixels || 0, 120);
  score += Math.min(quality.inkW || 0, 20) * 4;
  score += Math.min(quality.inkH || 0, 24) * 4;
  score -= Math.round((quality.edgeInkRatio || 0) * 90);
  return score;
}

function bestTensorInkQualityFromItem(item) {
  const candidates = [
    { name: 'base', tensor: item?.tensor },
    ...(Array.isArray(item?.tensorVariants) ? item.tensorVariants : [])
  ].filter((candidate) => candidate?.tensor);

  let best = null;
  let base = null;
  let strict = null;
  const variantQualities = [];
  for (const candidate of candidates) {
    const quality = {
      ...tensorInkQuality(candidate.tensor, item?.id),
      variantName: candidate.name || 'variant'
    };
    variantQualities.push(quality);
    if (quality.variantName === 'base') base = quality;
    if (quality.variantName === 'strict') strict = quality;
    if (!best || tensorQualityScore(quality) > tensorQualityScore(best)) {
      best = quality;
    }
  }

  const summaryQualities = variantQualities.some((quality) => quality.variantName !== 'base')
    ? variantQualities.filter((quality) => quality.variantName !== 'base')
    : variantQualities;
  const variantCount = summaryQualities.length;
  const usableVariantCount = summaryQualities.filter((quality) => (
    quality.ok &&
    !quality.lineArtifactLikely &&
    !quality.horizontalArtifactLikely &&
    !quality.edgeArtifactLikely &&
    (quality.inkPixels || 0) >= 14 &&
    (quality.inkH || 0) >= 7
  )).length;
  const artifactVariantCount = summaryQualities.filter((quality) => (
    quality.lineArtifactLikely ||
    quality.horizontalArtifactLikely ||
    quality.edgeArtifactLikely ||
    quality.verticalEdgeArtifactLikely
  )).length;
  const weakVariantCount = summaryQualities.filter((quality) => (
    !quality.ok ||
    (quality.inkPixels || 0) < 12 ||
    (quality.inkH || 0) < 6 ||
    quality.horizontalArtifactLikely ||
    quality.edgeArtifactLikely
  )).length;
  const artifactVariantRatio = variantCount ? artifactVariantCount / variantCount : 0;
  const weakVariantRatio = variantCount ? weakVariantCount / variantCount : 0;
  const allVariantsWeak = variantCount > 0 && usableVariantCount === 0;
  const guard = strict || base || best || tensorInkQuality(item?.tensor, item?.id);
  return {
    ...guard,
    id: item?.id,
    guardVariantName: guard.variantName || 'guard',
    bestVariantName: best?.variantName || guard.variantName || 'guard',
    bestQuality: best,
    baseQuality: base,
    strictQuality: strict,
    variantQualities,
    variantCount,
    usableVariantCount,
    artifactVariantCount,
    weakVariantCount,
    artifactVariantRatio,
    weakVariantRatio,
    allVariantsWeak
  };
}

function detectTwoDigitCropFailure(questionGroups, cropQuality) {
  if (!Array.isArray(questionGroups) || !questionGroups.length || !Array.isArray(cropQuality)) return null;
  const qualityById = new Map(cropQuality.map((quality) => [quality.id, quality]));
  let expectedTwoDigitGroups = 0;
  let missingLeft = 0;
  let missingRight = 0;
  let oneSidedGroups = 0;
  let artifactGroups = 0;
  let variantWeakGroups = 0;
  let variantArtifactGroups = 0;

  for (const group of questionGroups) {
    const ids = Array.isArray(group?.digit_box_ids) ? group.digit_box_ids : [];
    const answer = group?.answer == null ? '' : String(group.answer).trim();
    if (ids.length !== 2 || !/^\d{2,}$/.test(answer)) continue;
    expectedTwoDigitGroups += 1;
    const left = qualityById.get(ids[0]);
    const right = qualityById.get(ids[1]);
    if (!left || !right) continue;
    const leftVariantWeak = left.allVariantsWeak || (left.weakVariantRatio || 0) >= 0.78;
    const rightVariantWeak = right.allVariantsWeak || (right.weakVariantRatio || 0) >= 0.78;
    const leftVariantArtifact = (left.artifactVariantRatio || 0) >= 0.50;
    const rightVariantArtifact = (right.artifactVariantRatio || 0) >= 0.50;
    const leftArtifact = left.horizontalArtifactLikely || left.edgeArtifactLikely || leftVariantArtifact;
    const rightArtifact = right.horizontalArtifactLikely || right.edgeArtifactLikely || rightVariantArtifact;
    if (leftVariantWeak || rightVariantWeak) variantWeakGroups += 1;
    if (leftVariantArtifact || rightVariantArtifact) variantArtifactGroups += 1;
    if (!left.ok || !right.ok || leftArtifact || rightArtifact || leftVariantWeak || rightVariantWeak) {
      artifactGroups += 1;
    }
    if ((!left.ok || leftVariantWeak) && right.ok && !rightVariantWeak) {
      missingLeft += 1;
      oneSidedGroups += 1;
    } else if (left.ok && !leftVariantWeak && (!right.ok || rightVariantWeak)) {
      missingRight += 1;
      oneSidedGroups += 1;
    }
  }

  if (expectedTwoDigitGroups < 4) return null;
  const repeatedOneSided = oneSidedGroups >= Math.max(3, Math.ceil(expectedTwoDigitGroups * 0.35));
  const sidePattern = Math.max(missingLeft, missingRight) >= Math.max(3, Math.ceil(expectedTwoDigitGroups * 0.3));
  const repeatedArtifacts = artifactGroups >= Math.max(5, Math.ceil(expectedTwoDigitGroups * 0.55));
  const repeatedVariantWeak = variantWeakGroups >= Math.max(4, Math.ceil(expectedTwoDigitGroups * 0.45));
  const repeatedVariantArtifacts = variantArtifactGroups >= Math.max(4, Math.ceil(expectedTwoDigitGroups * 0.45));
  if (!(repeatedArtifacts || repeatedVariantWeak || repeatedVariantArtifacts || (repeatedOneSided && sidePattern))) return null;
  return {
    expectedTwoDigitGroups,
    missingLeft,
    missingRight,
    oneSidedGroups,
    artifactGroups,
    variantWeakGroups,
    variantArtifactGroups
  };
}

function detectTwoDigitRecognitionFailure(questionGroups, cropQuality, predictions, answerKey) {
  if (
    !Array.isArray(questionGroups) ||
    !questionGroups.length ||
    !Array.isArray(cropQuality) ||
    !Array.isArray(predictions) ||
    !Array.isArray(answerKey)
  ) {
    return null;
  }

  const qualityById = new Map(cropQuality.map((quality) => [quality.id, quality]));
  const predictionById = new Map(predictions.map((prediction) => [prediction.id, prediction]));
  let expectedTwoDigitGroups = 0;
  let reviewGroups = 0;
  let guideOneMismatchGroups = 0;
  let guideOneMismatchCells = 0;

  for (const group of questionGroups) {
    const ids = Array.isArray(group?.digit_box_ids) ? group.digit_box_ids : [];
    const answer = group?.answer == null ? '' : String(group.answer).trim();
    if (ids.length !== 2 || !/^\d{2,}$/.test(answer)) continue;
    expectedTwoDigitGroups += 1;
    let groupHasReview = false;
    let groupHasGuideOneMismatch = false;
    for (const id of ids) {
      const quality = qualityById.get(id);
      const prediction = predictionById.get(id);
      const expectedDigit = answerKey[id];
      if (!quality || !prediction) continue;
      if (prediction.reviewNeeded) groupHasReview = true;
      const guideOnlyOne =
        quality.lineArtifactLikely &&
        prediction.digit === 1 &&
        expectedDigit !== 1 &&
        (prediction.confidence ?? 0) < 0.86;
      if (guideOnlyOne) {
        guideOneMismatchCells += 1;
        groupHasGuideOneMismatch = true;
      }
    }
    if (groupHasReview) reviewGroups += 1;
    if (groupHasGuideOneMismatch) guideOneMismatchGroups += 1;
  }

  if (expectedTwoDigitGroups < 4) return null;
  const repeatedReview = reviewGroups >= Math.max(5, Math.ceil(expectedTwoDigitGroups * 0.58));
  const repeatedGuideOnes = guideOneMismatchGroups >= Math.max(3, Math.ceil(expectedTwoDigitGroups * 0.34));
  if (!repeatedReview || !repeatedGuideOnes) return null;
  return {
    expectedTwoDigitGroups,
    reviewGroups,
    guideOneMismatchGroups,
    guideOneMismatchCells
  };
}

function analyzeTwoDigitScanSignals(questionGroups, cropQuality, predictions, questionCorrect, questionReview) {
  if (
    !Array.isArray(questionGroups) ||
    !Array.isArray(cropQuality) ||
    !Array.isArray(predictions) ||
    !Array.isArray(questionCorrect) ||
    !Array.isArray(questionReview)
  ) {
    return null;
  }

  const qualityById = new Map(cropQuality.map((quality) => [quality.id, quality]));
  const predictionById = new Map(predictions.map((prediction) => [prediction.id, prediction]));
  const total = questionGroups.length;
  const score = questionCorrect.filter(Boolean).length;
  const reviewCount = questionReview.filter(Boolean).length;
  let expectedTwoDigitGroups = 0;
  let suspiciousTwoDigitGroups = 0;
  let oneOrBlankDominatedGroups = 0;
  let artifactDominatedGroups = 0;
  let lowInkGroups = 0;
  let lowGapGroups = 0;
  let mismatchGroups = 0;
  let reviewMismatchGroups = 0;
  let signalMismatchGroups = 0;
  let reviewSignalGroups = 0;
  const usablePredictions = predictions.filter((prediction) => prediction && Number.isFinite(Number(prediction.confidence)));
  const avgConfidence = usablePredictions.length
    ? usablePredictions.reduce((sum, prediction) => sum + (Number(prediction.confidence) || 0), 0) / usablePredictions.length
    : 0;
  const avgTopGap = usablePredictions.length
    ? usablePredictions.reduce((sum, prediction) => sum + (Number(prediction.topGap) || 0), 0) / usablePredictions.length
    : 0;

  for (const [index, group] of questionGroups.entries()) {
    const ids = Array.isArray(group?.digit_box_ids) ? group.digit_box_ids : [];
    const answer = group?.answer == null ? '' : String(group.answer).trim();
    if (ids.length !== 2 || !/^\d{2,}$/.test(answer)) continue;
    expectedTwoDigitGroups += 1;
    let suspiciousCells = 0;
    let oneOrBlankCells = 0;
    let artifactCells = 0;
    let lowInkCells = 0;
    let lowGapCells = 0;
    for (const id of ids) {
      const quality = qualityById.get(id);
      const prediction = predictionById.get(id);
      if (!quality || !prediction) continue;
      const confidence = Number(prediction.confidence) || 0;
      const topGap = Number(prediction.topGap) || 0;
      const variantWeak = quality.allVariantsWeak || (quality.weakVariantRatio || 0) >= 0.75;
      const variantArtifact = (quality.artifactVariantRatio || 0) >= 0.50;
      const skinnySignal =
        variantArtifact ||
        quality.lineArtifactLikely ||
        (quality.inkPixels <= 115 && quality.inkW <= 8 && quality.inkH >= 10 && quality.density <= 0.78);
      if (skinnySignal && (prediction.reviewNeeded || confidence < 0.92 || topGap < 0.5)) suspiciousCells += 1;
      if (prediction.digit === 1 || !quality.ok || quality.inkPixels < 18 || variantWeak) oneOrBlankCells += 1;
      if (!quality.ok || quality.horizontalArtifactLikely || quality.edgeArtifactLikely || variantArtifact) artifactCells += 1;
      if (quality.inkPixels < 24 || quality.inkW <= 4 || quality.inkH < 8 || variantWeak) lowInkCells += 1;
      if (topGap < 0.22 || confidence < 0.62) lowGapCells += 1;
    }
    const predictionCells = predictionCellsForIds(ids, predictionById);
    const acceptedResponses = acceptedResponsesForGroup(group, ids.length);
    const groupMatches = predictionCells && acceptedResponses.length > 0
      ? acceptedResponses.some((response) => gradingCellsMatch(predictionCells, response))
      : questionCorrect[index] === true;
    const groupHasReview = questionReview[index] === true;
    const groupHasSignal = suspiciousCells > 0 || artifactCells > 0 || lowInkCells > 0 || lowGapCells > 0;
    if (suspiciousCells > 0) suspiciousTwoDigitGroups += 1;
    if (oneOrBlankCells >= 1) oneOrBlankDominatedGroups += 1;
    if (artifactCells >= 1) artifactDominatedGroups += 1;
    if (lowInkCells >= 1) lowInkGroups += 1;
    if (lowGapCells >= 1) lowGapGroups += 1;
    if (!groupMatches) mismatchGroups += 1;
    if (!groupMatches && groupHasReview) reviewMismatchGroups += 1;
    if (!groupMatches && groupHasSignal) signalMismatchGroups += 1;
    if (groupHasReview && groupHasSignal) reviewSignalGroups += 1;
  }

  if (expectedTwoDigitGroups < 5 || total < 8) return null;
  return {
    total,
    score,
    reviewCount,
    expectedTwoDigitGroups,
    suspiciousTwoDigitGroups,
    oneOrBlankDominatedGroups,
    artifactDominatedGroups,
    lowInkGroups,
    lowGapGroups,
    mismatchGroups,
    reviewMismatchGroups,
    signalMismatchGroups,
    reviewSignalGroups,
    avgConfidence,
    avgTopGap
  };
}

function detectUnusableTwoDigitScan(questionGroups, cropQuality, predictions, questionCorrect, questionReview) {
  const signals = analyzeTwoDigitScanSignals(questionGroups, cropQuality, predictions, questionCorrect, questionReview);
  if (!signals) return null;

  const {
    total,
    score,
    reviewCount,
    expectedTwoDigitGroups,
    suspiciousTwoDigitGroups,
    oneOrBlankDominatedGroups,
    artifactDominatedGroups,
    lowInkGroups,
    lowGapGroups,
    mismatchGroups,
    reviewMismatchGroups,
    signalMismatchGroups,
    reviewSignalGroups,
    avgConfidence,
    avgTopGap
  } = signals;

  const catastrophicLowScore = score <= Math.max(1, Math.floor(total * 0.15));
  const veryLowScore = score <= Math.floor(total * 0.35);
  const mostlyReview = reviewCount >= Math.ceil(total * 0.72);
  const almostAllReview = reviewCount >= Math.ceil(total * 0.88);
  const repeatedSuspicious = suspiciousTwoDigitGroups >= Math.ceil(expectedTwoDigitGroups * 0.35);
  const repeatedOneOrBlank = oneOrBlankDominatedGroups >= Math.ceil(expectedTwoDigitGroups * 0.65);
  const repeatedArtifacts = artifactDominatedGroups >= Math.ceil(expectedTwoDigitGroups * 0.55);
  const lowSignalCapture = avgConfidence < 0.68 || avgTopGap < 0.34;
  const mostlyTwoDigitWorksheet = expectedTwoDigitGroups >= Math.ceil(total * 0.75);
  const allReviewLowSignalCapture =
    score <= Math.max(1, Math.floor(total * 0.22)) &&
    reviewCount >= Math.ceil(total * 0.9) &&
    avgConfidence < 0.62 &&
    avgTopGap < 0.32;
  const broadLowSignalTwoDigitCapture =
    mostlyTwoDigitWorksheet &&
    score <= Math.max(2, Math.floor(total * 0.30)) &&
    reviewCount >= Math.ceil(total * 0.75) &&
    avgConfidence < 0.74 &&
    avgTopGap < 0.43;
  const allReviewWrongTwoDigitCapture =
    mostlyTwoDigitWorksheet &&
    score <= Math.max(2, Math.floor(total * 0.35)) &&
    reviewCount >= Math.ceil(total * 0.85) &&
    avgConfidence < 0.72 &&
    avgTopGap < 0.36;
  const allReviewUnstableTwoDigitCapture =
    mostlyTwoDigitWorksheet &&
    reviewCount >= Math.ceil(total * 0.95) &&
    lowGapGroups >= Math.ceil(expectedTwoDigitGroups * 0.90) &&
    avgConfidence < 0.66 &&
    avgTopGap < 0.16 &&
    (
      lowInkGroups >= Math.ceil(expectedTwoDigitGroups * 0.10) ||
      oneOrBlankDominatedGroups >= Math.ceil(expectedTwoDigitGroups * 0.20) ||
      mismatchGroups >= 1 ||
      reviewSignalGroups >= Math.ceil(expectedTwoDigitGroups * 0.85)
    );
  const severeLowSignalTwoDigitCapture =
    mostlyTwoDigitWorksheet &&
    score <= Math.max(1, Math.floor(total * 0.22)) &&
    reviewCount >= Math.ceil(total * 0.65) &&
    avgConfidence < 0.80 &&
    avgTopGap < 0.50;
  const lowConfidenceReviewPileup =
    mostlyTwoDigitWorksheet &&
    score <= Math.max(3, Math.floor(total * 0.35)) &&
    reviewCount >= Math.ceil(total * 0.70) &&
    avgConfidence < 0.70 &&
    (repeatedSuspicious || repeatedArtifacts);
  const mismatchReviewPileup =
    mostlyTwoDigitWorksheet &&
    mismatchGroups >= Math.ceil(total * 0.45) &&
    reviewCount >= Math.ceil(total * 0.45) &&
    (
      reviewMismatchGroups >= Math.ceil(total * 0.35) ||
      signalMismatchGroups >= Math.ceil(expectedTwoDigitGroups * 0.35) ||
      reviewSignalGroups >= Math.ceil(expectedTwoDigitGroups * 0.45)
    ) &&
    (
      lowGapGroups >= Math.ceil(expectedTwoDigitGroups * 0.45) ||
      lowInkGroups >= Math.ceil(expectedTwoDigitGroups * 0.30) ||
      avgConfidence < 0.80 ||
      avgTopGap < 0.62
    );
  const broadMismatchLowSignalCapture =
    mostlyTwoDigitWorksheet &&
    mismatchGroups >= Math.ceil(total * 0.50) &&
    reviewCount >= Math.ceil(total * 0.40) &&
    signalMismatchGroups >= Math.ceil(expectedTwoDigitGroups * 0.40) &&
    (lowGapGroups >= Math.ceil(expectedTwoDigitGroups * 0.50) || avgConfidence < 0.82);
  const weakTwoDigitReviewPileup =
    mostlyTwoDigitWorksheet &&
    reviewCount >= Math.ceil(total * 0.50) &&
    avgConfidence < 0.70 &&
    avgTopGap < 0.56 &&
    lowGapGroups >= Math.ceil(expectedTwoDigitGroups * 0.65) &&
    lowInkGroups >= Math.ceil(expectedTwoDigitGroups * 0.60) &&
    artifactDominatedGroups >= Math.ceil(expectedTwoDigitGroups * 0.25);
  const repeatedSlotCollapse =
    mostlyTwoDigitWorksheet &&
    oneOrBlankDominatedGroups >= Math.ceil(expectedTwoDigitGroups * 0.85) &&
    lowInkGroups >= Math.ceil(expectedTwoDigitGroups * 0.65) &&
    (
      mismatchGroups >= Math.ceil(total * 0.30) ||
      signalMismatchGroups >= Math.ceil(expectedTwoDigitGroups * 0.30) ||
      reviewSignalGroups >= Math.ceil(expectedTwoDigitGroups * 0.30) ||
      lowGapGroups >= Math.ceil(expectedTwoDigitGroups * 0.45)
    );
  const highReviewLowGapCapture =
    mostlyTwoDigitWorksheet &&
    score <= Math.floor(total * 0.70) &&
    reviewCount >= Math.ceil(total * 0.70) &&
    lowGapGroups >= Math.ceil(expectedTwoDigitGroups * 0.70) &&
    avgConfidence < 0.74 &&
    avgTopGap < 0.42;
  const highReviewMismatchCapture =
    mostlyTwoDigitWorksheet &&
    score <= Math.max(2, Math.floor(total * 0.25)) &&
    reviewCount >= Math.ceil(total * 0.60) &&
    reviewMismatchGroups >= Math.ceil(total * 0.55) &&
    avgConfidence < 0.84 &&
    avgTopGap < 0.75;
  if (!(
    (catastrophicLowScore && mostlyReview && (repeatedSuspicious || repeatedOneOrBlank || repeatedArtifacts)) ||
    (veryLowScore && almostAllReview && lowSignalCapture && (repeatedSuspicious || repeatedArtifacts)) ||
    allReviewLowSignalCapture ||
    broadLowSignalTwoDigitCapture ||
    allReviewWrongTwoDigitCapture ||
    allReviewUnstableTwoDigitCapture ||
    severeLowSignalTwoDigitCapture ||
    lowConfidenceReviewPileup ||
    mismatchReviewPileup ||
    broadMismatchLowSignalCapture ||
    weakTwoDigitReviewPileup ||
    repeatedSlotCollapse ||
    highReviewLowGapCapture ||
    highReviewMismatchCapture
  )) return null;

  return {
    total,
    score,
    reviewCount,
    expectedTwoDigitGroups,
    suspiciousTwoDigitGroups,
    oneOrBlankDominatedGroups,
    artifactDominatedGroups,
    lowInkGroups,
    lowGapGroups,
    mismatchGroups,
    reviewMismatchGroups,
    signalMismatchGroups,
    reviewSignalGroups,
    avgConfidence,
    avgTopGap,
    allReviewLowSignalCapture,
    broadLowSignalTwoDigitCapture,
    allReviewWrongTwoDigitCapture,
    allReviewUnstableTwoDigitCapture,
    severeLowSignalTwoDigitCapture,
    lowConfidenceReviewPileup,
    mismatchReviewPileup,
    broadMismatchLowSignalCapture,
    weakTwoDigitReviewPileup,
    repeatedSlotCollapse,
    highReviewLowGapCapture,
    highReviewMismatchCapture
  };
}

function evaluateCaptureGuards(questionGroups, tensorData, predictions, answerKey) {
  const cropQuality = (tensorData || []).map((item) => bestTensorInkQualityFromItem(item));
  const questionCorrect = buildQuestionCorrect(questionGroups, predictions);
  const questionReview = buildQuestionReviewFlags(questionGroups, predictions);
  const cropFailure = detectTwoDigitCropFailure(questionGroups, cropQuality);
  const recognitionFailure = detectTwoDigitRecognitionFailure(questionGroups, cropQuality, predictions, answerKey);
  const unusable = detectUnusableTwoDigitScan(questionGroups, cropQuality, predictions, questionCorrect, questionReview);
  return {
    cropQuality,
    questionCorrect,
    questionReview,
    summary: summarizeTwoDigitSignals(questionGroups, cropQuality, predictions, questionCorrect, questionReview),
    cropFailure,
    recognitionFailure,
    unusable,
    wouldReject: !!(cropFailure || recognitionFailure || unusable)
  };
}

function summarizeTwoDigitSignals(questionGroups, cropQuality, predictions, questionCorrect, questionReview) {
  return analyzeTwoDigitScanSignals(questionGroups, cropQuality, predictions, questionCorrect, questionReview);
}

function debugId(file) {
  return path.basename(file, '.json').replace(/^scangrade-live-ocr-debug-/, '');
}

async function listDebugJsons(explicitFiles) {
  if (explicitFiles.length) return explicitFiles;
  const names = await fs.readdir(DEFAULT_DEBUG_DIR).catch(() => []);
  return names
    .filter((name) => /^scangrade-live-ocr-debug-\d+\.json$/.test(name))
    .sort()
    .map((name) => path.join(DEFAULT_DEBUG_DIR, name));
}

function parseArgs() {
  const files = [];
  let includeKnownBad = false;
  let allowImperfect = false;
  let url = DEFAULT_URL;
  let outDir = null;
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === '--include-known-bad') {
      includeKnownBad = true;
    } else if (arg === '--allow-imperfect') {
      allowImperfect = true;
    } else if (arg === '--url') {
      url = process.argv[++i] || url;
    } else if (arg === '--out-dir') {
      outDir = process.argv[++i] || outDir;
    } else {
      files.push(arg);
    }
  }
  return { files, includeKnownBad, allowImperfect, url, outDir };
}

function replayUrl(baseUrl) {
  const url = new URL(baseUrl);
  url.searchParams.set('liveOcrDebug', '1');
  return url.toString();
}

const args = parseArgs();
const files = await listDebugJsons(args.files);
const excluded = args.includeKnownBad ? new Set() : DEFAULT_EXCLUDED_IDS;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ ignoreHTTPSErrors: true });
await page.goto(replayUrl(args.url), { waitUntil: 'networkidle', timeout: 45000 });
await page.waitForFunction(
  () => !!window.cv && typeof window.cv.Mat !== 'undefined',
  undefined,
  { timeout: 60000 }
);

const rows = [];
let perfect = 0;
let correctCells = 0;
let totalCells = 0;
let skipped = 0;

for (const file of files) {
  const id = debugId(file);
  if (excluded.has(id)) {
    rows.push({ file: path.basename(file), skipped: true, reason: 'known_bad_capture' });
    skipped++;
    continue;
  }

  const debug = JSON.parse(await fs.readFile(file, 'utf8'));
  if (!debug.capturedImageDataUrl || !Array.isArray(debug.answerKey) || debug.answerKey.length === 0) {
    rows.push({ file: path.basename(file), skipped: true, reason: 'missing_capture_or_answer_key' });
    skipped++;
    continue;
  }

  const result = await page.evaluate(async ({ debug }) => {
    const { processWorksheet } = await import('/src/homography.js');
    const {
      initDigitModel,
      recognizeDigits,
      recognizeDigitsRobust,
      recognizeDigitsWithPreprocessVariants
    } = await import('/src/ocr-pipeline.js');
    const ROBUST_RETRY_CONFIDENCE_THRESHOLD = 0.86;
    const ROBUST_RETRY_MARGIN_THRESHOLD = 0.18;
    const LOW_CONFIDENCE_THRESHOLD = 0.78;
    const LOW_MARGIN_THRESHOLD = 0.08;
    const AUTO_CHECK_CONFIDENCE_THRESHOLD = 0.45;
    const AUTO_CHECK_MARGIN_THRESHOLD = 0.06;
    const AUTO_X_CONFIDENCE_THRESHOLD = LOW_CONFIDENCE_THRESHOLD;
    const AUTO_X_MARGIN_THRESHOLD = LOW_MARGIN_THRESHOLD;
    const TWO_DIGIT_AUTO_X_CONFIDENCE_THRESHOLD = 0.88;
    const TWO_DIGIT_AUTO_X_MARGIN_THRESHOLD = 0.20;
    const TWO_DIGIT_RIGHT_SLOT_AUTO_X_CONFIDENCE_THRESHOLD = 0.92;
    const TWO_DIGIT_RIGHT_SLOT_AUTO_X_MARGIN_THRESHOLD = 0.28;
    const TWO_DIGIT_OPTIONAL_LEADING_AUTO_X_CONFIDENCE_THRESHOLD = 0.92;
    const TWO_DIGIT_OPTIONAL_LEADING_AUTO_X_MARGIN_THRESHOLD = 0.50;
    const TWO_DIGIT_AUTO_X_CALIBRATED_CONFIDENCE_THRESHOLD = 0.92;
    const TWO_DIGIT_AUTO_X_CALIBRATED_MARGIN_THRESHOLD = 0.50;
    const OCR_CONFIDENCE_CLEAR_REASONS = new Set([
      'box-safe-default',
      'left-slot-low-three-rescue',
      'left-slot-open-three-shape-rescue',
      'left-slot-sparse-four-shape-from-one-rescue',
      'preprocess-weighted-vote',
      'right-slot-center-low-agreement-rescue',
      'right-slot-cleanup-four-rescue',
      'right-slot-eight-shape-from-seven-rescue',
      'right-slot-expected-edge-default',
      'right-slot-five-shape-from-three-rescue',
      'right-slot-gentle-seven-rescue',
      'right-slot-preprocess-disagreement',
      'right-slot-raw-border-high-rescue',
      'right-slot-runnerup-four-shape-from-one-rescue',
      'right-slot-two-shape-from-nine-rescue',
      'right-slot-two-shape-from-one-rescue',
      'right-slot-two-shape-from-seven-rescue',
      'right-slot-wide-raw-agreement-rescue'
    ]);

    const digitTopGap = (result) => {
      const topK = result?.topK || [];
      return topK.length >= 2
        ? (Number(topK[0]?.confidence) || 0) - (Number(topK[1]?.confidence) || 0)
        : 1;
    };

    const preprocessSelectionReason = (result) =>
      result?.preprocessReviewReason || result?.robustOverride || null;

    const preprocessReasonMatches = (result, reason) =>
      result?.preprocessReviewReason === reason || result?.robustOverride === reason;

    const isReviewBoundOcrRescueReason = (reason) =>
      typeof reason === 'string' &&
      (reason.includes('rescue') || reason === 'box-safe-low-margin-override');

    const preprocessVariantByName = (result, name) => {
      const variants = Array.isArray(result?.preprocessVariants) ? result.preprocessVariants : [];
      return variants.find((variant) => variant?.name === name) || null;
    };

    const rightSlotExpectedEdgeConflictReview = (proc, result) => {
      if (!proc?.isVirtualDigitBox || Number(proc.digitIndex) !== 1 || !result) return false;
      if (!preprocessReasonMatches(result, 'right-slot-expected-edge-default')) return false;
      const digit = Number(result.digit);
      const voteTop = result.preprocessVoteSummary?.top || null;
      const voteMargin = Number(result.preprocessVoteSummary?.margin) || 0;
      if (
        voteTop &&
        Number(voteTop.digit) !== digit &&
        (Number(voteTop.share) || 0) >= 0.70 &&
        voteMargin >= 0.35
      ) {
        return true;
      }
      const rawBorder = preprocessVariantByName(result, 'raw-border-slot');
      return !!(
        rawBorder &&
        Number(rawBorder.digit) !== digit &&
        (Number(rawBorder.confidence) || 0) >= 0.70 &&
        (Number(rawBorder.topGap) || 0) >= 0.55
      );
    };

    const chosenDigitProbability = (result) => {
      const digit = Number(result?.digit);
      if (!Number.isInteger(digit) || digit < 0 || digit > 9) return Number(result?.confidence) || 0;
      const probs = Array.isArray(result?.probs) || ArrayBuffer.isView(result?.probs) ? result.probs : null;
      const probability = Number(probs?.[digit]);
      return Number.isFinite(probability) && probability > 0
        ? probability
        : (Number(result?.confidence) || 0);
    };

    const highRiskRightSlotPreprocessReview = (proc, result) => {
      if (!proc?.isVirtualDigitBox || Number(proc.digitIndex) !== 1 || !result) return false;
      const digit = Number(result.digit);
      if (rightSlotExpectedEdgeConflictReview(proc, result)) return true;
      if (digit !== 1 && digit !== 9) return false;
      const variants = Array.isArray(result.preprocessVariants) ? result.preprocessVariants : [];
      if (variants.length === 0) return false;

      const runnerShare = Number(result.preprocessVoteSummary?.runnerUp?.share) || 0;
      const confidence = Number(result.confidence) || 0;
      const topGap = digitTopGap(result);
      const alternativeSignals = variants.filter((variant) => {
        const variantDigit = Number(variant?.digit);
        if (!Number.isFinite(variantDigit) || variantDigit === digit) return false;
        const variantConfidence = Number(variant?.confidence) || 0;
        const variantGap = Number(variant?.topGap) || 0;
        return variantConfidence >= 0.30 || variantGap >= 0.05;
      }).length;

      return (
        runnerShare >= 0.14 ||
        alternativeSignals >= 3 ||
        (alternativeSignals >= 2 && (confidence < 0.86 || topGap < 0.52))
      );
    };

    const autoXAllowedForDigit = (proc, result, topGap) => {
      const confidence = Number(result?.confidence) || 0;
      const gap = Number.isFinite(topGap) ? topGap : 0;
      const reason = preprocessSelectionReason(result);
      if (isReviewBoundOcrRescueReason(reason) || rightSlotExpectedEdgeConflictReview(proc, result)) return false;
      if (!proc?.isVirtualDigitBox) {
        return confidence >= AUTO_X_CONFIDENCE_THRESHOLD && gap >= AUTO_X_MARGIN_THRESHOLD;
      }

      const isRightSlot = Number(proc.digitIndex) === 1;
      const minConfidence = isRightSlot
        ? TWO_DIGIT_RIGHT_SLOT_AUTO_X_CONFIDENCE_THRESHOLD
        : TWO_DIGIT_AUTO_X_CONFIDENCE_THRESHOLD;
      const minGap = isRightSlot
        ? TWO_DIGIT_RIGHT_SLOT_AUTO_X_MARGIN_THRESHOLD
        : TWO_DIGIT_AUTO_X_MARGIN_THRESHOLD;

      const runnerShare = Number(result?.preprocessVoteSummary?.runnerUp?.share) || 0;
      const variants = Array.isArray(result?.preprocessVariants) ? result.preprocessVariants : [];
      const digit = Number(result?.digit);
      const alternativeSignals = variants.filter((variant) => {
        const variantDigit = Number(variant?.digit);
        if (!Number.isFinite(variantDigit) || variantDigit === digit) return false;
        const variantConfidence = Number(variant?.confidence) || 0;
        const variantGap = Number(variant?.topGap) || 0;
        return variantConfidence >= 0.34 || variantGap >= 0.06;
      }).length;

      if (runnerShare >= 0.12 || alternativeSignals >= 3) return false;
      return confidence >= minConfidence && gap >= minGap;
    };

    const structuralTwoDigitReview = (proc, result, expectedDigit) => {
      if (!proc?.isVirtualDigitBox || Number(proc.digitIndex) !== 0 || !result) return false;
      const digit = Number(result.digit);
      const expected = Number(expectedDigit);
      return digit === 0 && Number.isFinite(expected) && expected !== 0;
    };

    const unexpectedOptionalLeadingDigitReview = (proc, result, expectedDigit) => {
      if (!proc?.isVirtualDigitBox || Number(proc.digitIndex) !== 0 || !result) return false;
      if (expectedDigit != null) return false;
      const digit = Number(result.digit);
      if (!Number.isInteger(digit) || digit < 0 || digit > 9) return false;
      const rawConfidence = chosenDigitProbability(result);
      const gap = digitTopGap(result);
      return (
        rawConfidence < TWO_DIGIT_OPTIONAL_LEADING_AUTO_X_CONFIDENCE_THRESHOLD ||
        gap < TWO_DIGIT_OPTIONAL_LEADING_AUTO_X_MARGIN_THRESHOLD
      );
    };

    const highRiskTwoDigitMismatchReview = (proc, result, expectedDigit) => {
      if (!proc?.isVirtualDigitBox || !result) return false;
      const digit = Number(result.digit);
      const expected = Number(expectedDigit);
      if (!Number.isFinite(digit) || !Number.isFinite(expected)) return false;
      if (digit === expected) return false;
      const reason = preprocessSelectionReason(result);
      if (isReviewBoundOcrRescueReason(reason) || rightSlotExpectedEdgeConflictReview(proc, result)) return true;
      const rawConfidence = chosenDigitProbability(result);
      const gap = digitTopGap(result);
      const isRightSlot = Number(proc.digitIndex) === 1;
      if (isRightSlot && preprocessReasonMatches(result, 'right-slot-expected-edge-default')) {
        return rawConfidence < 0.97 || gap < 0.75;
      }
      if (isRightSlot) return false;
      return expected === 3 && digit === 2;
    };

    const confidencePolicyClearanceForDigit = (proc, result, topGap, correct, reviewSignals) => {
      const reviewReason = reviewSignals?.structuralReview
        ? 'two-digit-leading-zero-structural-review'
        : reviewSignals?.unexpectedLeadingDigitReview
          ? 'two-digit-optional-leading-digit-review'
        : reviewSignals?.highRiskMismatchReview
          ? 'two-digit-mismatch-low-trust-review'
          : reviewSignals?.highRiskPreprocessReview
            ? 'right-slot-preprocess-disagreement'
            : (result?.preprocessReviewReason || null);
      const selectionReason = preprocessSelectionReason(result);
      const cameraCapture = reviewSignals?.cameraCapture === true;
      const reason = !cameraCapture && selectionReason
        ? selectionReason
        : (reviewReason || selectionReason);
      const rawConfidence = chosenDigitProbability(result);
      const gap = Number.isFinite(topGap) ? topGap : 0;
      if (
        reason &&
        OCR_CONFIDENCE_CLEAR_REASONS.has(reason) &&
        !rightSlotExpectedEdgeConflictReview(proc, result) &&
        (
          correct === true ||
          !cameraCapture ||
          (
            !isReviewBoundOcrRescueReason(reason) &&
            reason !== 'right-slot-expected-edge-default' &&
            rawConfidence >= 0.88 &&
            gap >= 0.35
          )
        )
      ) {
        return { allowed: true, reason: `validated-review-reason:${reason}` };
      }
      const isTwoDigitMismatch = proc?.isVirtualDigitBox === true && correct === false;
      if (
        isTwoDigitMismatch &&
        !reviewReason &&
        !isReviewBoundOcrRescueReason(selectionReason) &&
        !rightSlotExpectedEdgeConflictReview(proc, result) &&
        rawConfidence >= TWO_DIGIT_AUTO_X_CALIBRATED_CONFIDENCE_THRESHOLD &&
        gap >= TWO_DIGIT_AUTO_X_CALIBRATED_MARGIN_THRESHOLD
      ) {
        return { allowed: true, reason: 'calibrated-two-digit-auto-x' };
      }
      return { allowed: false, reason: null };
    };
    const layoutPath = debug.layoutId
      ? `/layouts/${debug.layoutId}.json`
      : '/layouts/sg-10-box-v1.json';
    const layout = await fetch(layoutPath).then((r) => r.json());
    await initDigitModel();

    const img = new Image();
    img.src = debug.capturedImageDataUrl;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d').drawImage(img, 0, 0);
    const src = cv.imread(canvas);
    const processed = processWorksheet(src, layout);
    src.delete();
    if (!processed) return { ok: false, predictions: [] };

    const tensorPreviewDataUrl = (items) => {
      const scale = 4;
      const cell = 28 * scale;
      const cols = Math.min(10, Math.max(1, items.length));
      const rows = Math.ceil(items.length / cols);
      const c = document.createElement('canvas');
      c.width = cols * cell;
      c.height = rows * cell;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, c.width, c.height);
      items.forEach((item, index) => {
        const x0 = (index % cols) * cell;
        const y0 = Math.floor(index / cols) * cell;
        const small = document.createElement('canvas');
        small.width = 28;
        small.height = 28;
        const smallCtx = small.getContext('2d');
        const idata = smallCtx.createImageData(28, 28);
        for (let i = 0; i < 784; i++) {
          const u = Math.max(0, Math.min(255, Math.round((item.tensor[i] ?? 0) * 255)));
          idata.data[i * 4] = u;
          idata.data[i * 4 + 1] = u;
          idata.data[i * 4 + 2] = u;
          idata.data[i * 4 + 3] = 255;
        }
        smallCtx.putImageData(idata, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(small, x0, y0, cell, cell);
      });
      return c.toDataURL('image/png');
    };

    const rawCropPreviewDataUrl = (crops) => {
      const maxCellW = 130;
      const maxCellH = 130;
      const gap = 8;
      const cols = Math.min(10, Math.max(1, crops.length));
      const rows = Math.ceil(crops.length / cols);
      const c = document.createElement('canvas');
      c.width = cols * maxCellW + (cols - 1) * gap;
      c.height = rows * maxCellH + (rows - 1) * gap;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, c.width, c.height);
      crops.forEach((crop, index) => {
        const x0 = (index % cols) * (maxCellW + gap);
        const y0 = Math.floor(index / cols) * (maxCellH + gap);
        const small = document.createElement('canvas');
        cv.imshow(small, crop.image);
        const scale = Math.min(maxCellW / small.width, maxCellH / small.height);
        const w = Math.max(1, Math.round(small.width * scale));
        const h = Math.max(1, Math.round(small.height * scale));
        ctx.drawImage(small, x0 + Math.floor((maxCellW - w) / 2), y0 + Math.floor((maxCellH - h) / 2), w, h);
      });
      return c.toDataURL('image/png');
    };

    const cropRects = processed.rawCrops.map((crop) => ({
      id: crop.id,
      questionNum: crop.questionNum,
      cropRect: crop.cropRect,
      boxRect: crop.boxRect,
      layoutBoxRect: crop.layoutBoxRect,
      isVirtualDigitBox: crop.isVirtualDigitBox
    }));

    const predictions = [];
    for (const tensor of processed.processedTensors) {
      let prediction;
      const hasPreprocessVariants =
        tensor.isVirtualDigitBox === true &&
        Array.isArray(tensor.tensorVariants) &&
        tensor.tensorVariants.length > 1;
      if (hasPreprocessVariants) {
        [prediction] = await recognizeDigitsWithPreprocessVariants(tensor.tensorVariants, null, {
          digitIndex: tensor.digitIndex
        });
      } else {
        [prediction] = await recognizeDigits(tensor.tensor);
        const topK = prediction.topK || [];
        const topGap = topK.length >= 2 ? topK[0].confidence - topK[1].confidence : 1;
        const forceRobust = tensor.isVirtualDigitBox === true;
        if (forceRobust || prediction.confidence < ROBUST_RETRY_CONFIDENCE_THRESHOLD || topGap < ROBUST_RETRY_MARGIN_THRESHOLD) {
          [prediction] = await recognizeDigitsRobust(tensor.tensor, prediction, { force: forceRobust });
        }
      }
      const robustTopK = prediction.topK || [];
      const robustTopGap = robustTopK.length >= 2 ? robustTopK[0].confidence - robustTopK[1].confidence : 1;
      const expected = debug.answerKey[tensor.id ?? predictions.length];
      const correct = expected !== undefined ? prediction.digit === expected : undefined;
      const autoCheckAllowed =
        prediction.confidence >= AUTO_CHECK_CONFIDENCE_THRESHOLD &&
        robustTopGap >= AUTO_CHECK_MARGIN_THRESHOLD;
      const autoXAllowed = autoXAllowedForDigit(tensor, prediction, robustTopGap);
      const lowSignal =
        prediction.confidence < LOW_CONFIDENCE_THRESHOLD ||
        robustTopGap < LOW_MARGIN_THRESHOLD;
      const highRiskPreprocessReview = highRiskRightSlotPreprocessReview(tensor, prediction);
      const structuralReview = structuralTwoDigitReview(tensor, prediction, expected);
      const unexpectedLeadingDigitReview = unexpectedOptionalLeadingDigitReview(tensor, prediction, expected);
      const highRiskMismatchReview = highRiskTwoDigitMismatchReview(tensor, prediction, expected);
      const confidencePolicyClearance = confidencePolicyClearanceForDigit(
        tensor,
        prediction,
        robustTopGap,
        correct,
        {
          highRiskPreprocessReview,
          structuralReview,
          unexpectedLeadingDigitReview,
          highRiskMismatchReview,
          cameraCapture: !!debug.captureQuality
        }
      );
      const reviewNeeded = confidencePolicyClearance.allowed ? false
        : correct === true
          ? !autoCheckAllowed
          : highRiskPreprocessReview || structuralReview || unexpectedLeadingDigitReview || highRiskMismatchReview ? true
          : correct === false
            ? !autoXAllowed
            : lowSignal;
      predictions.push({
        id: tensor.id ?? predictions.length,
        questionNum: tensor.questionNum,
        digitIndex: tensor.digitIndex,
        digit: prediction.digit,
        confidence: prediction.confidence,
        topGap: robustTopGap,
        robust: prediction.robust === true,
        robustOverride: prediction.robustOverride || null,
        variantCount: prediction.variantCount || 1,
        baseDigit: prediction.baseDigit ?? null,
        baseConfidence: prediction.baseConfidence ?? null,
        baseTopK: prediction.baseTopK || null,
        preprocessDisagreement: prediction.preprocessDisagreement === true,
        preprocessReviewReason: reviewNeeded && structuralReview
          ? 'two-digit-leading-zero-structural-review'
          : reviewNeeded && unexpectedLeadingDigitReview
            ? 'two-digit-optional-leading-digit-review'
          : reviewNeeded && highRiskMismatchReview
            ? 'two-digit-mismatch-low-trust-review'
          : reviewNeeded && highRiskPreprocessReview
            ? 'right-slot-preprocess-disagreement'
            : (prediction.preprocessReviewReason || null),
        confidencePolicyCleared: confidencePolicyClearance.allowed === true,
        confidencePolicyClearanceReason: confidencePolicyClearance.reason,
        originalChosenDigitConfidence: chosenDigitProbability(prediction),
        highRiskPreprocessReview,
        structuralReview,
        unexpectedLeadingDigitReview,
        highRiskMismatchReview,
        preprocessVariants: prediction.preprocessVariants || null,
        preprocessVoteSummary: prediction.preprocessVoteSummary || null,
        correct,
        reviewNeeded
      });
    }

    const rawCropPreview = rawCropPreviewDataUrl(processed.rawCrops);
    const modelInputPreview = tensorPreviewDataUrl(processed.processedTensors);
    const variantInputPreview = tensorPreviewDataUrl(
      processed.processedTensors.flatMap((tensor) => (
        Array.isArray(tensor.tensorVariants) && tensor.tensorVariants.length
          ? tensor.tensorVariants.map((variant) => ({ tensor: variant.tensor }))
          : [{ tensor: tensor.tensor }]
      ))
    );
    processed.rawCrops.forEach((crop) => crop.image.delete());
    processed.warpedImage.delete();
    return {
      ok: true,
      predictions,
      questionGroups: Array.isArray(layout.question_groups) ? layout.question_groups : [],
      tensorData: processed.processedTensors.map((tensor) => ({
        id: tensor.id,
        questionNum: tensor.questionNum,
        digitIndex: tensor.digitIndex,
        tensor: Array.from(tensor.tensor),
        tensorVariants: (tensor.tensorVariants || []).map((variant) => ({
          name: variant.name || 'variant',
          tensor: Array.from(variant.tensor)
        }))
      })),
      cropRects,
      rawCropPreviewDataUrl: rawCropPreview,
      modelInputPreviewDataUrl: modelInputPreview,
      variantInputPreviewDataUrl: variantInputPreview
    };
  }, { debug });

  const replayCropQuality = result.ok
    ? result.tensorData.map((item) => bestTensorInkQualityFromItem(item))
    : [];
  const optionalSingleDigitBlankOverrides = result.ok
    ? applyOptionalSingleDigitBlankOverrides(result.questionGroups, result.predictions, replayCropQuality)
    : [];
  const preds = result.predictions.map((p) => p.digit);
  const guard = result.ok
    ? evaluateCaptureGuards(result.questionGroups, result.tensorData, result.predictions, debug.answerKey)
    : null;
  if (guard?.wouldReject === true) {
    const forcedReason = guard.cropFailure
      ? 'two-digit-crop-quality-fallback-review'
      : guard.recognitionFailure
        ? 'two-digit-recognition-quality-fallback-review'
        : 'two-digit-unusable-quality-fallback-review';
    for (const prediction of result.predictions) {
      prediction.reviewNeeded = true;
      prediction.forcedReviewReason = forcedReason;
      prediction.preprocessReviewReason = prediction.preprocessReviewReason || forcedReason;
    }
    if (Array.isArray(guard.questionReview)) {
      guard.questionReview.fill(true);
    }
  }
  const correct = preds.reduce((sum, pred, idx) => sum + Number(pred === debug.answerKey[idx]), 0);
  const reviewCells = result.predictions.reduce((sum, prediction) => sum + Number(prediction.reviewNeeded), 0);
  const groupRows = [];
  if (Array.isArray(result.questionGroups) && result.questionGroups.length) {
    for (const group of result.questionGroups) {
      const ids = Array.isArray(group.digit_box_ids) ? group.digit_box_ids : [];
      const groupPredictions = ids.map((digitId) =>
        result.predictions.find((prediction) => prediction.id === digitId)
      );
      const expectedCells = ids.map((digitId) => debug.answerKey[digitId]);
      const predictedCells = groupPredictions.map((prediction) => prediction?.digit ?? null);
      const expectedText = expectedCells.map((value) => value ?? '_').join('');
      const predictedText = predictedCells.map((value) => value ?? '_').join('');
      groupRows.push({
        label: group.label || String(group.question_num ?? groupRows.length + 1),
        expected: expectedText,
        predicted: predictedText,
        correct: guard?.questionCorrect?.[groupRows.length] ?? (expectedText === predictedText),
        review: guard?.questionReview?.[groupRows.length] ?? groupPredictions.some((prediction) => prediction?.reviewNeeded)
      });
    }
  }
  correctCells += correct;
  totalCells += debug.answerKey.length;
  perfect += Number(correct === debug.answerKey.length);
  rows.push({
    file: path.basename(file),
    score: `${correct}/${debug.answerKey.length}`,
    predictions: preds,
    predictionDetails: result.predictions,
    optionalSingleDigitBlankOverrides,
    reviewCells,
    groups: groupRows,
    guard,
    questionScore: Array.isArray(guard?.questionCorrect)
      ? `${guard.questionCorrect.filter(Boolean).length}/${guard.questionCorrect.length}`
      : null,
    questionReviewCount: Array.isArray(guard?.questionReview)
      ? guard.questionReview.filter(Boolean).length
      : null,
    rawCropPreviewDataUrl: result.rawCropPreviewDataUrl,
    cropRects: result.cropRects,
    modelInputPreviewDataUrl: result.modelInputPreviewDataUrl,
    variantInputPreviewDataUrl: result.variantInputPreviewDataUrl,
    minConfidence: result.predictions.length
      ? Math.min(...result.predictions.map((p) => p.confidence))
      : 0
  });
}

await browser.close();

for (const row of rows) {
  if (row.skipped) {
    console.log(`${row.file}: SKIP ${row.reason}`);
  } else {
    const reviewText = Number.isFinite(row.reviewCells) ? ` review_cells=${row.reviewCells}` : '';
    const guardReasons = [];
    if (row.guard?.cropFailure) guardReasons.push('crop');
    if (row.guard?.recognitionFailure) guardReasons.push('recognition');
    if (row.guard?.unusable) guardReasons.push('unusable');
    const guardText = row.guard
      ? ` guard=${row.guard.wouldReject ? `REJECT(${guardReasons.join('+')})` : 'pass'}`
      : '';
    const questionText = row.questionScore
      ? ` qscore=${row.questionScore} qreview=${row.questionReviewCount}`
      : '';
    console.log(`${row.file}: ${row.score} pred=${JSON.stringify(row.predictions)} min_conf=${row.minConfidence.toFixed(3)}${reviewText}${questionText}${guardText}`);
    if (row.guard?.summary) {
      const s = row.guard.summary;
      console.log(
        `  signals score=${s.score}/${s.total} review=${s.reviewCount}/${s.total}` +
        ` twoDigit=${s.expectedTwoDigitGroups}` +
        ` suspicious=${s.suspiciousTwoDigitGroups}` +
        ` oneBlank=${s.oneOrBlankDominatedGroups}` +
        ` artifact=${s.artifactDominatedGroups}` +
        ` lowInk=${s.lowInkGroups}` +
        ` lowGap=${s.lowGapGroups}` +
        ` mismatch=${s.mismatchGroups}` +
        ` reviewMismatch=${s.reviewMismatchGroups}` +
        ` signalMismatch=${s.signalMismatchGroups}` +
        ` reviewSignal=${s.reviewSignalGroups}` +
        ` avgConf=${s.avgConfidence.toFixed(3)}` +
        ` avgGap=${s.avgTopGap.toFixed(3)}`
      );
    }
    if (Array.isArray(row.groups) && row.groups.length) {
      const groupText = row.groups
        .map((group) => `${group.label}:${group.predicted}/${group.expected}${group.review ? '*' : ''}${group.correct ? '' : '!'}`)
        .join(' ');
      console.log(`  groups ${groupText}`);
    }
  }
}

if (args.outDir) {
  await fs.mkdir(args.outDir, { recursive: true });
  await Promise.all(rows.map(async (row) => {
    const base = path.basename(row.file || 'capture', '.json');
    const writes = [];
    if (row.modelInputPreviewDataUrl) {
      const data = row.modelInputPreviewDataUrl.split(',')[1];
      if (data) {
        writes.push(fs.writeFile(path.join(args.outDir, `${base}-model-input-preview.png`), Buffer.from(data, 'base64')));
      }
    }
    if (row.rawCropPreviewDataUrl) {
      const data = row.rawCropPreviewDataUrl.split(',')[1];
      if (data) {
        writes.push(fs.writeFile(path.join(args.outDir, `${base}-raw-crops.png`), Buffer.from(data, 'base64')));
      }
    }
    if (row.variantInputPreviewDataUrl) {
      const data = row.variantInputPreviewDataUrl.split(',')[1];
      if (data) {
        writes.push(fs.writeFile(path.join(args.outDir, `${base}-variant-input-preview.png`), Buffer.from(data, 'base64')));
      }
    }
    if (row.cropRects) {
      writes.push(fs.writeFile(path.join(args.outDir, `${base}-crop-rects.json`), `${JSON.stringify(row.cropRects, null, 2)}\n`));
    }
    if (row.predictionDetails || row.groups || row.guard) {
      writes.push(fs.writeFile(path.join(args.outDir, `${base}-replay-result.json`), `${JSON.stringify({
        file: row.file,
        score: row.score,
        predictions: row.predictions,
        predictionDetails: row.predictionDetails || [],
        groups: row.groups || [],
        guard: row.guard || null,
        questionScore: row.questionScore,
        questionReviewCount: row.questionReviewCount,
        minConfidence: row.minConfidence
      }, null, 2)}\n`));
    }
    await Promise.all(writes);
  }));
  console.log(`Saved model-input previews to ${args.outDir}`);
}

const tested = files.length - skipped;
const rejected = rows.reduce((sum, row) => sum + Number(row.guard?.wouldReject === true), 0);
const accuracy = totalCells ? correctCells / totalCells : 0;
console.log('');
console.log(`Tested captures: ${tested}`);
console.log(`Skipped captures: ${skipped}`);
console.log(`Rejected by guards: ${rejected}/${tested}`);
console.log(`Perfect captures: ${perfect}/${tested}`);
console.log(`Cell accuracy: ${correctCells}/${totalCells} (${(accuracy * 100).toFixed(2)}%)`);

if (!args.allowImperfect && tested && (perfect !== tested || correctCells !== totalCells)) {
  process.exit(1);
}
