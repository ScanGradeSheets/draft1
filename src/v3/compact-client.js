function safeBaseUrl(value) {
  const url = new URL(value, typeof window !== 'undefined' ? window.location.href : undefined)
  const local = ['127.0.0.1', 'localhost', '::1'].includes(url.hostname)
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) throw new Error('V3 compact model URL must use HTTPS')
  return url.toString().replace(/\/$/, '')
}

export async function requestCompactWholeAnswers({ baseUrl, items, timeoutMs = 5000, accessToken = '', onError, fetchImpl = globalThis.fetch } = {}) {
  if (!baseUrl || !Array.isArray(items) || !items.length) return []
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchImpl(`${safeBaseUrl(baseUrl)}/v3/recognize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ items: items.map((item) => ({
        id: item.id,
        questionNum: item.questionNum,
        continuousImageDataUrl: item.continuousImageDataUrl,
      })) }),
      signal: controller.signal,
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok || payload?.ok === false) throw new Error(payload?.error || `V3 compact model failed (${response.status})`)
    if (!Array.isArray(payload.results)) return []
    const sourceById = new Map(items.map((item) => [String(item.id), item]))
    return payload.results.map((result) => {
      const source = sourceById.get(String(result?.id))
      const topCandidates = (Array.isArray(result?.topCandidates) ? result.topCandidates : [])
        .map((candidate) => ({
          ...candidate,
          read: String(candidate?.read || '').replace(/\D/g, '').slice(0, 4),
        }))
        .filter((candidate) => candidate.read)
      return {
        ...result,
        topCandidates,
        frameIndex: source?.frameIndex ?? result?.frameIndex ?? null,
        cropVariant: source?.cropVariant ?? result?.cropVariant ?? null,
      }
    })
  } catch (error) {
    onError?.(error)
    return []
  } finally {
    clearTimeout(timer)
  }
}
