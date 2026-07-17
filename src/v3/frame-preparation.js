let decodeWorker = null
let nextRequestId = 1
const pending = new Map()

function rejectPending(error) {
  for (const request of pending.values()) request.reject(error)
  pending.clear()
}

function getDecodeWorker() {
  if (decodeWorker) return decodeWorker
  if (typeof Worker !== 'function') throw new Error('Web Worker unavailable')
  decodeWorker = new Worker(new URL('../workers/frame-preparation.worker.js', import.meta.url), { type: 'module' })
  decodeWorker.onmessage = (event) => {
    const result = event.data || {}
    const request = pending.get(result.id)
    if (!request) {
      try { result.bitmap?.close?.() } catch (_) {}
      return
    }
    pending.delete(result.id)
    if (result.error) request.reject(new Error(result.error))
    else if (!result.bitmap) request.reject(new Error('worker returned no bitmap'))
    else request.resolve(result.bitmap)
  }
  decodeWorker.onerror = (event) => {
    const error = new Error(event?.message || 'frame decode worker failed')
    rejectPending(error)
    try { decodeWorker?.terminate?.() } catch (_) {}
    decodeWorker = null
  }
  return decodeWorker
}

export function frameDecodeWorkerSupported() {
  return typeof Worker === 'function' && typeof URL === 'function'
}

export function decodeFrameDataUrlInWorker(imageDataUrl, { timeoutMs = 5000 } = {}) {
  const worker = getDecodeWorker()
  const id = `frame-${nextRequestId++}`
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (!pending.has(id)) return
      pending.delete(id)
      reject(new Error('frame decode worker timed out'))
    }, timeoutMs)
    pending.set(id, {
      resolve: (bitmap) => {
        clearTimeout(timeout)
        resolve(bitmap)
      },
      reject: (error) => {
        clearTimeout(timeout)
        reject(error)
      },
    })
    worker.postMessage({ id, imageDataUrl })
  })
}
