export function chooseBestEligibleCaptureCandidate(best, candidate) {
  if (!candidate || candidate.sampleSheetCheck?.ok !== true) return best || null
  if (!best || Number(candidate.score) > Number(best.score)) return candidate
  return best
}
