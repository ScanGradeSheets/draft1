/**
 * Run an asynchronous review action and always release its UI lock without
 * relying on Promise.prototype.finally (missing on the oldest supported iPad).
 */
export function settleLegacyPromise(action, onSettled, onError = () => {}) {
  let result
  try {
    result = action()
  } catch (error) {
    onSettled()
    onError(error)
    return Promise.resolve(false)
  }

  return Promise.resolve(result).then(
    () => {
      onSettled()
      return true
    },
    (error) => {
      onSettled()
      onError(error)
      return false
    },
  )
}
