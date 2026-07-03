import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import basicSsl from '@vitejs/plugin-basic-ssl'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const base = process.env.SG_BASE || '/'
const pruneDeployAssets = process.env.SG_PRUNE_DEPLOY === '1'

const deployKeepFiles = new Set([
  'ort-wasm-nosimd.wasm',
  'ort-wasm-simd-1.17.wasm',
  'models/mnist-model.onnx',
  'models/worksheet-digit-generalist.onnx',
  'models/worksheet-digit-live-trusted-temp.onnx',
  'models/worksheet-digit-tony-generalist-noaug-20260601.onnx'
])

function lastCliValue(flag) {
  const index = process.argv.lastIndexOf(flag)
  return index >= 0 ? process.argv[index + 1] : null
}

const cliHost = lastCliValue('--host')
const hmrHost = process.env.SG_HMR_HOST ||
  (cliHost === '127.0.0.1' || cliHost === 'localhost' ? cliHost : '100.90.211.12')

export default defineConfig({
  base,
  plugins: [
    vue(),
    basicSsl(),
    {
      name: 'serve-onnx-static',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const pathname = req.url?.split('?')[0] || ''
          if (pathname.startsWith('/ort-') && (pathname.endsWith('.mjs') || pathname.endsWith('.wasm'))) {
            const file = path.join(__dirname, 'public', pathname)
            if (fs.existsSync(file)) {
              res.setHeader('Content-Type', pathname.endsWith('.mjs') ? 'application/javascript' : 'application/wasm')
              fs.createReadStream(file).pipe(res)
              return
            }
          }
          next()
        })
      },
    },
    {
      name: 'prune-pages-deploy-assets',
      apply: 'build',
      closeBundle() {
        if (!pruneDeployAssets) return
        const outDir = path.join(__dirname, 'dist')
        const rootFiles = fs.existsSync(outDir) ? fs.readdirSync(outDir) : []
        for (const file of rootFiles) {
          if (!file.startsWith('ort')) continue
          if (deployKeepFiles.has(file)) continue
          fs.rmSync(path.join(outDir, file), { force: true })
        }

        const modelsDir = path.join(outDir, 'models')
        if (!fs.existsSync(modelsDir)) return
        for (const file of fs.readdirSync(modelsDir)) {
          const rel = `models/${file}`
          if (deployKeepFiles.has(rel)) continue
          fs.rmSync(path.join(modelsDir, file), { force: true })
        }
      }
    },
  ],
  server: {
    host: '0.0.0.0',
    port: 5174,
    strictPort: true,
    https: true,
    hmr: {
      host: hmrHost,
      overlay: false,
      protocol: 'wss'
    }
  },
  optimizeDeps: {
    exclude: ['onnxruntime-web']
  },
  build: {
    target: ['es2018', 'safari12'],
    assetsInlineLimit: 0
  }
})
