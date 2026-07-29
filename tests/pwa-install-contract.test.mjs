import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const rootUrl = new URL('../', import.meta.url)
const read = (path) => fs.readFileSync(new URL(path, rootUrl), 'utf8')

function pngDimensions(path) {
  const bytes = fs.readFileSync(new URL(path, rootUrl))
  assert.equal(bytes.toString('ascii', 1, 4), 'PNG')
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  }
}

test('manifest installs ScanGrade as a standalone education app with the approved logo', () => {
  const manifest = JSON.parse(read('public/manifest.webmanifest'))
  assert.equal(manifest.name, 'ScanGrade')
  assert.equal(manifest.short_name, 'ScanGrade')
  assert.equal(manifest.id, './')
  assert.equal(manifest.start_url, './')
  assert.equal(manifest.scope, './')
  assert.equal(manifest.display, 'standalone')
  assert.equal(manifest.background_color, '#f5f5f7')
  assert.equal(manifest.theme_color, '#f5f5f7')
  assert.ok(manifest.categories.includes('education'))

  const expected = new Map([
    ['icons/scangrade-icon-192.png', 192],
    ['icons/scangrade-icon-512.png', 512],
    ['icons/scangrade-icon-maskable-512.png', 512],
  ])
  for (const icon of manifest.icons) {
    const size = expected.get(icon.src)
    assert.ok(size, icon.src)
    assert.deepEqual(pngDimensions(`public/${icon.src}`), { width: size, height: size })
  }
  assert.ok(manifest.icons.some((icon) => icon.purpose === 'maskable'))
  assert.deepEqual(
    pngDimensions('public/icons/apple-touch-icon-180.png'),
    { width: 180, height: 180 },
  )
})

test('document advertises the manifest, Apple icon, standalone mode and app title', () => {
  const html = read('index.html')
  assert.match(html, /rel="manifest" href="%BASE_URL%manifest\.webmanifest"/)
  assert.match(html, /rel="apple-touch-icon" sizes="180x180"/)
  assert.match(html, /name="apple-mobile-web-app-capable" content="yes"/)
  assert.match(html, /name="apple-mobile-web-app-title" content="ScanGrade"/)
})

test('service worker is update-aware and never caches student or server traffic', () => {
  const main = read('src/main.js')
  const worker = read('public/sw.js')
  const headers = read('public/_headers')

  assert.match(main, /import\.meta\.env\.PROD/)
  assert.match(main, /updateViaCache:\s*'none'/)
  assert.match(main, /registration\.update\(\)/)
  assert.match(worker, /request\.method !== 'GET'/)
  assert.match(worker, /url\.origin !== scopeUrl\.origin/)
  assert.match(worker, /url\.pathname\.includes\('\/api\/'\)/)
  assert.doesNotMatch(worker, /localStorage|indexedDB|studentReviewStore/)
  assert.match(worker, /request\.mode === 'navigate'/)
  assert.match(worker, /isHashedAppAsset/)
  assert.match(headers, /\/sw\.js\n\s+Cache-Control: no-cache, no-store, must-revalidate/)
  assert.match(headers, /\/manifest\.webmanifest\n\s+Cache-Control: no-cache, max-age=0, must-revalidate/)
})
