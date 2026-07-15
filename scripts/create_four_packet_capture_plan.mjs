#!/usr/bin/env node

import { createHash, randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

function seededUnit(seed, counter) {
  const digest = createHash('sha256').update(`${seed}:${counter}`).digest()
  return digest.readUInt32BE(0) / 0x1_0000_0000
}

export function createPacketPlan(packetIds, seed) {
  if (!Array.isArray(packetIds) || packetIds.length < 4) {
    throw new Error('At least four packet IDs are required')
  }
  if (new Set(packetIds).size !== packetIds.length) {
    throw new Error('Packet IDs must be unique')
  }

  const shuffled = [...packetIds]
  let counter = 0
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(seededUnit(seed, counter) * (index + 1))
    counter += 1
    ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
  }

  const selected = shuffled.slice(0, 4)
  return {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    seed,
    selectionMethod: 'seeded SHA-256 Fisher-Yates shuffle; selected first four',
    selected: [
      { packetId: selected[0], role: 'development-1', scanOrder: 1 },
      { packetId: selected[1], role: 'development-2', scanOrder: 2 },
      { packetId: selected[2], role: 'development-3', scanOrder: 3 },
      { packetId: selected[3], role: 'locked-test', scanOrder: 4 },
    ],
    reserveUnscanned: shuffled.slice(4),
    lockRules: [
      'Keep every packet intact and preserve its packet ID.',
      'Do not tune thresholds, models, crops, or prompts using the locked-test packet.',
      'Do not inspect locked-test OCR results against handwritten truth until the Hybrid V2 policy is frozen.',
      'Never place student images or labels in Git.',
    ],
  }
}

function parseArgs(argv) {
  const options = { packetIds: [], out: null, seed: null }
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--out') options.out = argv[++index]
    else if (value === '--seed') options.seed = argv[++index]
    else options.packetIds.push(value)
  }
  return options
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const packetIds = options.packetIds.length
    ? options.packetIds
    : Array.from({ length: 12 }, (_, index) => `P${String(index + 1).padStart(2, '0')}`)
  const seed = options.seed || randomBytes(16).toString('hex')
  const plan = createPacketPlan(packetIds, seed)
  const output = `${JSON.stringify(plan, null, 2)}\n`

  if (options.out) {
    const outPath = resolve(options.out)
    await mkdir(dirname(outPath), { recursive: true })
    await writeFile(outPath, output, { flag: 'wx' })
    process.stdout.write(`Capture plan written to ${outPath}\n`)
  } else {
    process.stdout.write(output)
  }
}

const isDirect = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])
if (isDirect) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  })
}
