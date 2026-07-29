import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createCanvas, loadImage } from 'canvas'

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

function pngRgba(path) {
  const bytes = fs.readFileSync(new URL(path, rootUrl))
  const signature = bytes.subarray(0, 8)
  assert.deepEqual([...signature], [137, 80, 78, 71, 13, 10, 26, 10])
  const width = bytes.readUInt32BE(16)
  const height = bytes.readUInt32BE(20)
  return { bytes, width, height }
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
    ['icons/scangrade-icon-192-v5.png', 192],
    ['icons/scangrade-icon-512-v5.png', 512],
    ['icons/scangrade-icon-maskable-512-v5.png', 512],
  ])
  for (const icon of manifest.icons) {
    const size = expected.get(icon.src)
    assert.ok(size, icon.src)
    assert.deepEqual(pngDimensions(`public/${icon.src}`), { width: size, height: size })
  }
  assert.ok(manifest.icons.some((icon) => icon.purpose === 'maskable'))
  assert.deepEqual(
    pngDimensions('public/icons/apple-touch-icon-180-v5.png'),
    { width: 180, height: 180 },
  )
})

test('document advertises the manifest, Apple icon, standalone mode and app title', () => {
  const html = read('index.html')
  assert.match(html, /rel="manifest" href="%BASE_URL%manifest\.webmanifest"/)
  assert.match(html, /rel="apple-touch-icon" sizes="180x180" href="%BASE_URL%icons\/apple-touch-icon-180-v5\.png"/)
  assert.match(html, /name="apple-mobile-web-app-capable" content="yes"/)
  assert.match(html, /name="apple-mobile-web-app-title" content="ScanGrade"/)
})

test('Apple Home Screen icon is a full-resolution PNG with a versioned path', () => {
  const icon = pngRgba('public/icons/apple-touch-icon-180-v5.png')
  assert.equal(icon.width, 180)
  assert.equal(icon.height, 180)
  assert.ok(icon.bytes.length > 8_000)
})

test('Apple Home Screen icon has a pure-white edge and equidistant lower markers', async () => {
  const image = await loadImage(fileURLToPath(new URL(
    'public/icons/apple-touch-icon-180-v5.png',
    rootUrl,
  )))
  const canvas = createCanvas(image.width, image.height)
  const context = canvas.getContext('2d')
  context.drawImage(image, 0, 0)
  const pixels = context.getImageData(0, 0, image.width, image.height).data

  let weightedX = 0
  let weightedY = 0
  let inkWeight = 0
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const offset = (y * image.width + x) * 4
      const red = pixels[offset]
      const green = pixels[offset + 1]
      const blue = pixels[offset + 2]
      const alpha = pixels[offset + 3]
      const edge = x < 3 || y < 3 || x >= image.width - 3 || y >= image.height - 3
      if (edge) assert.deepEqual([red, green, blue, alpha], [255, 255, 255, 255])

      const luminance = (red + green + blue) / 3
      if (luminance < 128) {
        const weight = alpha * (255 - luminance) / 255
        weightedX += x * weight
        weightedY += y * weight
        inkWeight += weight
      }
    }
  }

  assert.ok(Math.abs(weightedY / inkWeight - image.height / 2) < 1)

  let lowerInkMinX = image.width
  let lowerInkMaxX = -1
  for (let y = Math.floor(image.height * 0.7); y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const offset = (y * image.width + x) * 4
      const luminance = (
        pixels[offset] +
        pixels[offset + 1] +
        pixels[offset + 2]
      ) / 3
      if (luminance < 128) {
        lowerInkMinX = Math.min(lowerInkMinX, x)
        lowerInkMaxX = Math.max(lowerInkMaxX, x)
      }
    }
  }
  assert.ok(lowerInkMaxX >= 0)
  assert.ok(Math.abs(lowerInkMinX - (image.width - 1 - lowerInkMaxX)) <= 1)
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
