export const CONSENSUS_PRODUCTION_RELEASE = 'consensus-private-beta-1'

const FALSE_VALUES = new Set(['0', 'false', 'off', 'no'])
const TRUE_VALUES = new Set(['1', 'true', 'on', 'yes'])

function locationParts(locationLike = null) {
  const source = locationLike || (typeof window !== 'undefined' ? window.location : null)
  return {
    hostname: String(source?.hostname || '').toLowerCase(),
    href: String(source?.href || 'https://localhost/'),
    search: String(source?.search || ''),
  }
}

export function promotedConsensusRuntimeEnabled(locationLike = null) {
  const location = locationParts(locationLike)
  const override = new URLSearchParams(location.search).get('consensusCandidate')
  if (FALSE_VALUES.has(String(override || '').toLowerCase())) return false
  if (TRUE_VALUES.has(String(override || '').toLowerCase())) return true
  // The promoted automatic lane is initially private-beta only. Public static
  // hosting has no authenticated model boundary and stays on local OCR.
  return location.hostname.endsWith('.ts.net')
}

export function consensusFeatureEnabled(name, locationLike = null) {
  const location = locationParts(locationLike)
  const override = new URLSearchParams(location.search).get(name)
  if (FALSE_VALUES.has(String(override || '').toLowerCase())) return false
  if (TRUE_VALUES.has(String(override || '').toLowerCase())) return true
  return promotedConsensusRuntimeEnabled(locationLike)
}

export function consensusModelEndpoint(queryName, defaultPath, locationLike = null) {
  const location = locationParts(locationLike)
  const params = new URLSearchParams(location.search)
  const requested = String(params.get(queryName) || '').trim()
  if (FALSE_VALUES.has(requested.toLowerCase())) return ''
  const candidate = requested || (promotedConsensusRuntimeEnabled(locationLike) ? defaultPath : '')
  if (!candidate) return ''
  try {
    const url = new URL(candidate, location.href)
    const local = ['127.0.0.1', 'localhost', '::1'].includes(url.hostname)
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) return ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return ''
  }
}
