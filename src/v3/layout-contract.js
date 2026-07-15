export const ANSWER_ZONE_CONTRACT_VERSION = 'answer-zone-contract-1'

/** Physical crop geometry and permitted handwritten answer length are distinct.
 * A child can fit "19" inside one printed box, so one physical box must not
 * imply a one-character transcription contract. */
export function maxHandwrittenDigitsForGroup(group) {
  const physicalSlots = Array.isArray(group?.digit_box_ids) ? group.digit_box_ids.length : 0
  const configured = Number(group?.max_handwritten_digits)
  if (Number.isInteger(configured) && configured >= Math.max(1, physicalSlots) && configured <= 4) return configured
  return Math.max(1, physicalSlots)
}

export function optionalDigitIndicesForGroup(group, boxes = []) {
  const byId = new Map((boxes || []).map((box) => [Number(box?.id), box]))
  return (group?.digit_box_ids || [])
    .map((id, index) => byId.get(Number(id))?.expected_type === 'optional_blank_or_digit' ? index : -1)
    .filter((index) => index >= 0)
}
