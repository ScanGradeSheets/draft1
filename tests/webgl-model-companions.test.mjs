import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

import onnxSchema from '../node_modules/onnxruntime-web/lib/onnxjs/ort-schema/protobuf/onnx.js'

const { ModelProto } = onnxSchema.onnx

const CASES = [
  {
    source: '../public/models/worksheet-digit-tony-generalist-noaug-20260601.onnx',
    companion: '../public/models/worksheet-digit-tony-generalist-noaug-20260601-batch1-webgl.onnx',
    sha256: '023f950e9c695d49ce572beae2d9a4c56da9b26f94b5b25d618aa73a42b75c8a',
  },
  {
    source: '../public/models/worksheet-digit-generalist.onnx',
    companion: '../public/models/worksheet-digit-generalist-batch1-webgl.onnx',
    sha256: 'ef634507867f2193efc7f6fb4248eb430954ecca85253cff457890ab64d5b640',
  },
  {
    source: '../public/models/worksheet-digit-live-trusted-temp.onnx',
    companion: '../public/models/worksheet-digit-live-trusted-temp-batch1-webgl.onnx',
    sha256: 'aad6bb469388bf2d7adc1fa6a330bf80d20c1d6137e94986be0f3894d6e13bd5',
  },
]

function copyLeadingBatchContract(sourceModel, companionModel) {
  const sourceValues = [...(sourceModel.graph?.input || []), ...(sourceModel.graph?.output || [])]
  const companionValues = [...(companionModel.graph?.input || []), ...(companionModel.graph?.output || [])]
  for (let index = 0; index < sourceValues.length; index += 1) {
    const sourceDimension = sourceValues[index].type?.tensorType?.shape?.dim?.[0]
    const companionDimension = companionValues[index].type?.tensorType?.shape?.dim?.[0]
    if (!sourceDimension || !companionDimension) continue
    sourceDimension.dimValue = companionDimension.dimValue
    delete sourceDimension.dimParam
  }
}

for (const fixture of CASES) {
  test(`WebGL companion only fixes the batch dimension: ${fixture.companion}`, () => {
    const sourceBytes = readFileSync(new URL(fixture.source, import.meta.url))
    const companionBytes = readFileSync(new URL(fixture.companion, import.meta.url))
    const sourceModel = ModelProto.decode(sourceBytes)
    const companionModel = ModelProto.decode(companionBytes)

    copyLeadingBatchContract(sourceModel, companionModel)

    assert.deepEqual(companionModel, sourceModel)
    assert.equal(createHash('sha256').update(companionBytes).digest('hex'), fixture.sha256)
    for (const value of [...companionModel.graph.input, ...companionModel.graph.output]) {
      assert.equal(value.type.tensorType.shape.dim[0].dimValue.toNumber(), 1)
    }
  })
}
