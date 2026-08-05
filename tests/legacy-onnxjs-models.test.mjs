import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

import onnxSchema from '../node_modules/onnxruntime-web/lib/onnxjs/ort-schema/protobuf/onnx.js'

const { ModelProto } = onnxSchema.onnx

const CASES = [
  {
    source: '../public/models/worksheet-digit-tony-generalist-noaug-20260601.onnx',
    companion: '../public/models/worksheet-digit-tony-generalist-noaug-20260601-opset9-onnxjs.onnx',
    sha256: '52508ce8f675dc9ac75a710150b0420213440cdf95c204ac4914041e72674376',
  },
  {
    source: '../public/models/worksheet-digit-live-trusted-temp.onnx',
    companion: '../public/models/worksheet-digit-live-trusted-temp-opset9-onnxjs.onnx',
    sha256: 'c2283445cf77fb730b3b616c6481819b655b9d799e2ff03e5808a118c7c881b5',
  },
  {
    source: '../public/models/worksheet-digit-generalist.onnx',
    companion: '../public/models/worksheet-digit-generalist-opset9-onnxjs.onnx',
    sha256: '282bb2e9533711141a31ed807fd3014f182562a1e00e6a543e7b0d15c9645b4a',
  },
]

for (const fixture of CASES) {
  test(`opset-9 companion changes only the declared opset: ${fixture.companion}`, () => {
    const sourceBytes = readFileSync(new URL(fixture.source, import.meta.url))
    const companionBytes = readFileSync(new URL(fixture.companion, import.meta.url))
    const sourceModel = ModelProto.decode(sourceBytes)
    const companionModel = ModelProto.decode(companionBytes)
    const sourceOpset = sourceModel.opsetImport?.[0]
    const companionOpset = companionModel.opsetImport?.[0]
    assert.ok(sourceOpset)
    assert.ok(companionOpset)
    assert.equal(sourceOpset.version.toNumber(), 13)
    assert.equal(companionOpset.version.toNumber(), 9)
    sourceOpset.version = companionOpset.version
    assert.deepEqual(companionModel, sourceModel)
    assert.equal(createHash('sha256').update(companionBytes).digest('hex'), fixture.sha256)
  })
}
