export async function requestKeyBlindWholeAnswers({
  baseUrl,
  items,
  timeoutMs = 2500,
  batchSize = 24,
  accessToken = '',
  fetchImpl = globalThis.fetch,
  onError = () => {},
} = {}) {
  if (!baseUrl || !Array.isArray(items) || !items.length || typeof fetchImpl !== 'function') return []
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const batches = []
    for (let index = 0; index < items.length; index += batchSize) {
      batches.push(items.slice(index, index + batchSize))
    }
    const payloads = await Promise.all(batches.map(async (batch) => {
      const response = await fetchImpl(`${baseUrl}/recognize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ items: batch }),
        signal: controller.signal,
      })
      if (!response?.ok) throw new Error(`review model returned ${response?.status ?? 'no status'}`)
      const payload = await response.json()
      if (payload?.answerKeyUsed !== false || !Array.isArray(payload?.results)) {
        throw new Error('review model did not confirm key-blind inference')
      }
      if (payload.results.length !== batch.length) {
        throw new Error('review model returned an incomplete batch')
      }
      return payload
    }))
    const results = payloads.flatMap((payload) => payload.results)
    return results.length === items.length ? results : []
  } catch (error) {
    onError(error)
    return []
  } finally {
    clearTimeout(timeout)
  }
}
