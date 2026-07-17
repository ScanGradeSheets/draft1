// XLM-R/SentencePiece tokens used by microsoft/trocr-small-handwritten for
// decimal strings 0-99. The ScanGrade model is constrained to elementary
// numeric answers; an unknown/non-numeric token is never guessed from the key.
export const TROCR_NUMBER_BY_TOKEN = Object.freeze({
  1596: '0', 267: '1', 252: '2', 271: '3', 319: '4', 331: '5', 467: '6', 531: '7', 539: '8', 641: '9',
  274: '10', 580: '11', 496: '12', 836: '13', 847: '14', 565: '15', 811: '16', 895: '17', 877: '18', 1258: '19',
  449: '20', 1304: '21', 1539: '22', 1707: '23', 1221: '24', 909: '25', 1860: '26', 1827: '27', 1850: '28', 2142: '29',
  557: '30', 2374: '31', 3240: '32', 3783: '33', 3964: '34', 2462: '35', 3716: '36', 4300: '37', 4209: '38', 4692: '39',
  1136: '40', 4951: '41', 4549: '42', 5236: '43', 4797: '44', 2464: '45', 5694: '46', 5514: '47', 4117: '48', 3892: '49',
  934: '50', 5921: '51', 5203: '52', 6563: '53', 6617: '54', 4574: '55', 6813: '56', 6291: '57', 6272: '58', 6523: '59',
  1694: '60', 7112: '61', 6849: '62', 7192: '63', 5863: '64', 3926: '65', 6590: '66', 6679: '67', 7373: '68', 6935: '69',
  2260: '70', 7880: '71', 5949: '72', 7424: '73', 8689: '74', 4075: '75', 6240: '76', 7850: '77', 8137: '78', 9017: '79',
  2408: '80', 8591: '81', 7955: '82', 9175: '83', 8797: '84', 6472: '85', 9164: '86', 8946: '87', 8965: '88', 10281: '89',
  2330: '90', 9879: '91', 9383: '92', 9982: '93', 9671: '94', 6734: '95', 10407: '96', 10020: '97', 10224: '98', 6655: '99',
})

export function decodeNumericTrocrTokens(tokens, { eosToken = 2, maximumDigits = 4 } = {}) {
  const content = (tokens || []).filter((token, index) => index > 0 && Number(token) !== eosToken)
  if (!content.length) return { text: '', blank: true, valid: true }
  const parts = content.map((token) => TROCR_NUMBER_BY_TOKEN[Number(token)])
  if (parts.some((part) => part == null)) return { text: '', blank: false, valid: false, reason: 'unknown-nonnumeric-token' }
  const text = parts.join('')
  if (!/^\d+$/.test(text) || text.length > maximumDigits) {
    return { text, blank: false, valid: false, reason: 'layout-length-contract' }
  }
  return { text, blank: false, valid: true }
}

export function inferBlankOptionalSlots({ text = '', blank = false, valid = false, physicalSlotCount = 0, optionalSlotIndices = [] } = {}) {
  const slots = Math.max(0, Number(physicalSlotCount) || 0)
  const optional = [...new Set((optionalSlotIndices || []).map(Number))]
    .filter((index) => Number.isInteger(index) && index >= 0 && index < slots)
    .sort((a, b) => a - b)
  if (!valid || !optional.length) return []
  if (blank) return optional
  const missing = slots - String(text).length
  return missing > 0 && missing <= optional.length ? optional.slice(0, missing) : []
}
