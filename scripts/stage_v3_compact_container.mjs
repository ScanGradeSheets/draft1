#!/usr/bin/env node
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const model = path.resolve(root, process.env.SG_V3_MODEL || 'private-evidence/models/v3-sequence-live/model.onnx')
const out = path.resolve(process.env.SG_V3_CONTAINER_CONTEXT || path.join(os.tmpdir(), 'scangrade-v3-compact-context'))
const tempRelative = path.relative(path.resolve(os.tmpdir()), out)
if (tempRelative.startsWith('..') || path.isAbsolute(tempRelative)) {
  throw new Error('SG_V3_CONTAINER_CONTEXT must stay inside the operating-system temporary directory')
}
const files = [
  ['Dockerfile.v3-compact', 'Dockerfile'],
  ['requirements-v3-compact.txt', 'requirements-v3-compact.txt'],
  ['scripts/serve_v3_compact.py', 'scripts/serve_v3_compact.py'],
]

await fs.rm(out, { recursive: true, force: true })
await fs.mkdir(path.join(out, 'scripts'), { recursive: true })
for (const [source, destination] of files) await fs.copyFile(path.join(root, source), path.join(out, destination))
await fs.copyFile(model, path.join(out, 'model.onnx'))
const staged = []
async function walk(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) await walk(absolute)
    else staged.push(path.relative(out, absolute))
  }
}
await walk(out)
const forbidden = staged.filter((file) => /debug|evidence|truth|student|capture/i.test(file))
if (forbidden.length) throw new Error(`private evidence leaked into container context: ${forbidden.join(', ')}`)
console.log(JSON.stringify({ out, model, staged: staged.sort(), privateEvidenceFiles: 0 }, null, 2))
