export function isDebugRoutePathname(pathname) {
  const normalized = String(pathname || '').replace(/\/+$/, '') || '/'
  return normalized === '/debug'
}

export function isBatchDebugRoutePathname(pathname) {
  const normalized = String(pathname || '').replace(/\/+$/, '') || '/'
  return normalized === '/debug/batch'
}
