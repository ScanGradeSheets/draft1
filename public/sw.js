const SHELL_CACHE = 'scangrade-shell-v1'
const ASSET_CACHE = 'scangrade-assets-v1'
const CACHE_PREFIX = 'scangrade-'
const scopeUrl = new URL(self.registration.scope)
const scopeRoot = scopeUrl.href

const shellUrls = [
  scopeRoot,
  new URL('manifest.webmanifest', scopeRoot).href,
  new URL('icons/apple-touch-icon-180.png', scopeRoot).href,
  new URL('icons/scangrade-icon-192.png', scopeRoot).href,
  new URL('icons/scangrade-icon-512.png', scopeRoot).href,
  new URL('icons/scangrade-icon-maskable-512.png', scopeRoot).href,
]

function isSafeCacheResponse(response) {
  return !!response && response.ok && (response.type === 'basic' || response.type === 'default')
}

function isHashedAppAsset(url) {
  return url.pathname.includes('/assets/') &&
    /-[A-Za-z0-9_-]{6,}\.(?:js|css)$/.test(url.pathname)
}

function isStableVisualAsset(url) {
  return url.pathname.includes('/icons/') ||
    url.pathname.includes('/fonts/') ||
    url.pathname.endsWith('/scangrade-logo-transparent.png')
}

async function cacheSafeResponse(cacheName, key, response) {
  if (!isSafeCacheResponse(response)) return
  const cache = await caches.open(cacheName)
  await cache.put(key, response.clone())
}

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  await cacheSafeResponse(ASSET_CACHE, request, response)
  return response
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request)
    await cacheSafeResponse(SHELL_CACHE, scopeRoot, response)
    return response
  } catch {
    return (await caches.match(scopeRoot)) || Response.error()
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE)
    await Promise.all(shellUrls.map(async (url) => {
      try {
        const response = await fetch(url)
        if (isSafeCacheResponse(response)) await cache.put(url, response)
      } catch {
        // A partial precache must not prevent installation. Online launch
        // remains authoritative and fills any missing public shell assets.
      }
    }))
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys()
    await Promise.all(names
      .filter((name) => name.startsWith(CACHE_PREFIX) && name !== SHELL_CACHE && name !== ASSET_CACHE)
      .map((name) => caches.delete(name)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET' || request.headers.has('range')) return

  const url = new URL(request.url)
  if (url.origin !== scopeUrl.origin) return

  // Student scans, debug uploads, corrections, and all server routes remain
  // network-only. This worker stores only public application resources.
  if (url.pathname.includes('/api/')) return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request))
    return
  }

  if (isHashedAppAsset(url) || isStableVisualAsset(url)) {
    event.respondWith(cacheFirst(request))
  }
})
