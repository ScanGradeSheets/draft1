# ScanGrade Model Artifact Inventory

Created 2026-05-30 during safe preservation work.

This is an inventory only. Do not commit, delete, replace, or promote model/runtime artifacts without a deliberate storage and verification decision.

## Already Tracked

These files are currently tracked by Git:

- `models/mnist-model.onnx` - 398 KB
- `models/worksheet-digit-generalist-metadata.json` - 22 KB
- `models/worksheet-digit-training-metadata.json` - 45 KB
- `public/models/mnist-model.onnx` - 1.1 MB
- `public/models/worksheet-digit-generalist.onnx` - 1.1 MB
- `public/ort-wasm-nosimd.wasm` - 9.3 MB
- `public/ort-wasm-simd-1.17.wasm` - 10 MB

## Still Untracked

Model candidates and metadata:

- `models/worksheet-digit-cnn-centered-metadata.json` - 220 KB
- `models/worksheet-digit-cnn-centered.pt` - 879 KB
- `models/worksheet-digit-cnn-local-rerun-metadata.json` - 256 KB
- `models/worksheet-digit-cnn-local-rerun.pt` - 891 KB
- `models/worksheet-digit-cnn.pt` - 913 KB
- `models/worksheet-digit-generalist-final-metadata.json` - 19 KB
- `models/worksheet-digit-generalist-final.pt` - 1.1 MB
- `models/worksheet-digit-generalist-smoke-metadata.json` - 83 KB
- `models/worksheet-digit-generalist-smoke.pt` - 1.1 MB
- `models/worksheet-digit-mlp-local-rerun*.json` - about 244 KB to 1.8 MB each
- `models/worksheet-digit-wide-cnn-*.pt` and metadata - about 259 KB to 2.0 MB each

Browser-facing candidate models:

- `public/mnist-model.onnx` - 398 KB
- `public/models/alt-mnist-model.onnx` - 398 KB
- `public/models/mnist-7.onnx`, `mnist-8.onnx`, `mnist-12.onnx`, `mnist-12-int8.onnx` - about 11 KB to 26 KB each
- `public/models/worksheet-digit-cnn-*.onnx` - about 810 KB each
- `public/models/worksheet-digit-generalist-final.onnx` - 1.1 MB
- `public/models/worksheet-digit-generalist-smoke.onnx` - 1.1 MB
- `public/models/worksheet-digit-mlp-*.json` - about 245 KB to 709 KB each
- `public/models/worksheet-digit-wide-cnn-local-rerun.onnx` - 1.9 MB

ONNX Runtime browser bundles:

- `ort-wasm-simd.wasm` - 12 MB at repo root
- `public/ort-wasm-simd-threaded.*.wasm` - about 12 MB to 26 MB each
- `public/ort*.mjs` - about 24 KB to 5.4 MB each
- `public/ort-wasm-simd.wasm` and `public/ort-wasm-simd.asyncify.wasm` are currently 0-byte files and need inspection before use.

## Current Recommendation

- Do not commit all untracked model/runtime artifacts as a bundle.
- First decide which one model path is the current browser default and which candidates are historical bake-off outputs.
- Prefer a small follow-up decision: either track only the currently required runtime/model files, or move large candidate artifacts to external storage/Git LFS with a manifest.
- Before promoting any model file, run the narrow Playwright smoke suite and a real-sample/bake-off command.
- Keep the full project snapshot until these artifacts have a clear storage policy.
