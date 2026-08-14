#!/usr/bin/env node
import http from 'node:http'
import https from 'node:https'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const modelRoot = process.env.SG_TROCR_ONNX_DIR
if (!modelRoot) throw new Error('SG_TROCR_ONNX_DIR is required')
const sample = process.env.SG_TROCR_SAMPLE || path.join(root,
  'private-evidence/v3/strong-evidence-candidate5-20260717/holdout/P02-sg-g1-lw-07-dot-collections-q01-stitched.png')
const manifestPath = path.resolve(process.env.SG_TROCR_MANIFEST || path.join(root,
  'private-evidence/v3/stitched-distillation-20260717/recent-manifest.json'))
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const packetSamples = manifest.entries.filter(entry => entry.packetId === 'P02').slice(0, 8)
const port = Number(process.env.PORT || 8791)
const encoderFile = process.env.SG_TROCR_ENCODER_FILE || 'encoder-fp32.onnx'
const decoderFile = process.env.SG_TROCR_DECODER_FILE || 'decoder-int8.onnx'
const manifestView = process.env.SG_TROCR_VIEW === 'continuous' ? 'continuous' : 'stitched'
const modelsOnly = process.env.SG_TROCR_MODELS_ONLY === '1'

const routes = new Map([
  ['/', path.join(root, 'scripts/browser-probes/trocr-small.html')],
  ['/models/encoder-fp32.onnx', path.join(modelRoot, encoderFile)],
  ['/models/decoder-int8.onnx', path.join(modelRoot, decoderFile)],
])
if (!modelsOnly) routes.set('/sample.png', sample)

function contentType(file) {
  if (file.endsWith('.html')) return 'text/html; charset=utf-8'
  if (file.endsWith('.js')) return 'text/javascript; charset=utf-8'
  if (file.endsWith('.wasm')) return 'application/wasm'
  if (file.endsWith('.onnx')) return 'application/octet-stream'
  if (file.endsWith('.png')) return 'image/png'
  return 'application/octet-stream'
}

const handleRequest = (request, response) => {
  let file = routes.get(request.url)
  if (!file && request.url.startsWith('/ort/')) {
    file = path.join(root, 'node_modules/onnxruntime-web/dist', path.basename(request.url))
  }
  if (!modelsOnly && !file && request.url.startsWith('/samples/')) {
    const index = Number(path.basename(request.url, '.png'))
    const entry = Number.isInteger(index) ? packetSamples[index] : null
    const imagePath = entry?.recognitionPath ||
      entry?.paths?.[manifestView] ||
      entry?.paths?.stitched ||
      entry?.paths?.continuous
    file = imagePath ? path.resolve(root, imagePath) : null
  }
  if (!modelsOnly && !file && request.url.startsWith('/manifest/')) {
    const index = Number(path.basename(request.url, '.png'))
    const entry = Number.isInteger(index) ? manifest.entries[index] : null
    const imagePath = entry?.recognitionPath ||
      entry?.paths?.[manifestView] ||
      entry?.paths?.stitched ||
      entry?.paths?.continuous
    file = imagePath ? path.resolve(root, imagePath) : null
  }
  if (!file || !fs.existsSync(file)) {
    response.writeHead(404); response.end('not found'); return
  }
  const stat = fs.statSync(file)
  const isReusableBinary = file.endsWith('.onnx') || file.endsWith('.wasm') ||
    file.endsWith('.mjs') || file.endsWith('.js')
  response.writeHead(200, {
    'Content-Type': contentType(file),
    'Content-Length': stat.size,
    'Cache-Control': isReusableBinary
      ? 'public, max-age=31536000, immutable'
      : 'no-store',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Resource-Policy': 'cross-origin',
    'Access-Control-Allow-Origin': '*',
  })
  fs.createReadStream(file).pipe(response)
}

const useHttps = process.env.SG_HTTPS === '1'
const server = useHttps
  ? https.createServer({
      key: fs.readFileSync(process.env.SG_HTTPS_KEY),
      cert: fs.readFileSync(process.env.SG_HTTPS_CERT),
    }, handleRequest)
  : http.createServer(handleRequest)

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(JSON.stringify({
    url: `${useHttps ? 'https' : 'http'}://127.0.0.1:${port}/`,
    modelRoot,
    sample,
    manifestPath,
    manifestEntries: manifest.entries.length,
    manifestView,
    modelsOnly,
  }) + '\n')
})
