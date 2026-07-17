self.onmessage = async (event) => {
  const { id, imageDataUrl } = event.data || {}
  try {
    if (!id || typeof imageDataUrl !== 'string') throw new Error('invalid frame decode request')
    if (typeof createImageBitmap !== 'function') throw new Error('createImageBitmap unavailable')
    const response = await fetch(imageDataUrl)
    const blob = await response.blob()
    const bitmap = await createImageBitmap(blob)
    self.postMessage({ id, bitmap }, [bitmap])
  } catch (error) {
    self.postMessage({ id, error: String(error?.message || error) })
  }
}
