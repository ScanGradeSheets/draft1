import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import onnxSchema from '../node_modules/onnxruntime-web/lib/onnxjs/ort-schema/protobuf/onnx.js'

const { ModelProto } = onnxSchema.onnx
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const models = [
  'worksheet-digit-tony-generalist-noaug-20260601',
  'worksheet-digit-live-trusted-temp',
  'worksheet-digit-generalist',
]

for (const stem of models) {
  const sourcePath = resolve(root, 'public/models', `${stem}.onnx`)
  const targetPath = resolve(root, 'public/models', `${stem}-opset9-onnxjs.onnx`)
  const model = ModelProto.decode(readFileSync(sourcePath))
  if (!model.opsetImport?.length) throw new Error(`No opset import in ${sourcePath}`)
  const originalVersion = model.opsetImport[0].version
  model.opsetImport[0].version = 9
  const bytes = ModelProto.encode(model).finish()
  mkdirSync(dirname(targetPath), { recursive: true })
  writeFileSync(targetPath, bytes)
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  console.log(JSON.stringify({ stem, sourcePath, targetPath, originalVersion: originalVersion?.toString?.() ?? originalVersion, opset: 9, byteLength: bytes.length, sha256 }))
}
