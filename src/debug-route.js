export function isDebugRoutePathname(pathname) {
  const normalized = String(pathname || '').replace(/\/+$/, '') || '/'
  return normalized === '/debug'
}
