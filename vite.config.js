import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import basicSsl from '@vitejs/plugin-basic-ssl'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const base = process.env.SG_BASE || '/'

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
  ],
  server: {
    host: '0.0.0.0',
    port: 5174,
    strictPort: true,
    https: true,
    hmr: {
      host: '100.90.211.12',
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
