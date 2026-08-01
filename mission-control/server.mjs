import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { extname, normalize, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const execFileAsync = promisify(execFile);

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const MC_ROOT = resolve(ROOT, 'mission-control');
const PUBLIC_ROOT = resolve(MC_ROOT, 'public');
const STATE_ROOT = resolve(MC_ROOT, 'state');
const DEBUG_SCAN_ROOT = resolve(ROOT, 'private-evidence', 'debug-scans');
const PORT = Number(process.env.SG_MISSION_CONTROL_PORT || 8787);
const HOST = process.env.SG_MISSION_CONTROL_HOST || '127.0.0.1';
const ROUTE_PREFIX = '/mission-control';
const MAX_DEFAULT_BODY_BYTES = 2 * 1024 * 1024;
const MAX_DEBUG_SCAN_BYTES = Number(process.env.SG_DEBUG_UPLOAD_MAX_BYTES || 80 * 1024 * 1024);

const jsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-ScanGrade-Debug-Token',
  // Public ScanGrade pages upload only authenticated debug evidence to this
  // tailnet address. Mobile browsers classify that hop as private-network
  // access and otherwise fail fetch() before the POST reaches this server.
  'Access-Control-Allow-Private-Network': 'true',
};

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return fallback;
  }
}

async function writeJson(path, data) {
  await mkdir(resolve(path, '..'), { recursive: true });
  const out = {
    ...data,
    updated_at: new Date().toISOString(),
  };
  await writeFile(path, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
  return out;
}

async function writePlainJson(path, data) {
  await mkdir(resolve(path, '..'), { recursive: true });
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function gitStatus() {
  try {
    const { stdout } = await execFileAsync('git', ['status', '--short'], {
      cwd: ROOT,
      timeout: 4000,
      maxBuffer: 1024 * 1024,
    });
    const lines = stdout.split('\n').filter(Boolean);
    return {
      dirty: lines.length > 0,
      modified_tracked: lines.filter((line) => !line.startsWith('??')).length,
      untracked: lines.filter((line) => line.startsWith('??')).length,
      lines: lines.slice(0, 80),
      truncated: lines.length > 80,
    };
  } catch (error) {
    return { dirty: null, error: String(error.message || error) };
  }
}

async function latestDocSummaries() {
  const docs = [
    ['Project Memory', 'SCANGRADE_RECOVERED_PROJECT_MEMORY.md'],
    ['Vision Interview Addendum', 'SCANGRADE_VISION_INTERVIEW_ADDENDUM.md'],
    ['Vision And Product Principles', 'SCANGRADE_VISION_AND_PRODUCT_PRINCIPLES.md'],
    ['Brand Asset Inventory', 'docs/BRAND_ASSET_INVENTORY.md'],
    ['Benchmark Artifact Inventory', 'docs/BENCHMARK_ARTIFACT_INVENTORY.md'],
    ['Backend Readiness', 'docs/BACKEND_DEPLOYMENT_READINESS.md'],
    ['Classroom Test Plan', 'docs/CLASSROOM_TEST_PLAN.md'],
    ['Classroom OCR Retest Protocol', 'docs/CLASSROOM_OCR_RETEST_PROTOCOL.md'],
    ['Classroom Sample Collection Card', 'docs/CLASSROOM_SAMPLE_COLLECTION_CARD.md'],
    ['Model Artifact Inventory', 'docs/MODEL_ARTIFACT_INVENTORY.md'],
    ['Legacy iPad Compatibility', 'docs/LEGACY_IPAD_COMPATIBILITY.md'],
    ['Marketing Asset Pipeline', 'products/MARKETING_ASSET_PIPELINE.md'],
    ['Mission Control Private Access', 'docs/MISSION_CONTROL_PRIVATE_ACCESS.md'],
    ['Mission Control Daily Summary 2026-06-01', 'mission-control/state/daily-summary-2026-06-01.md'],
    ['Mission Control Daily Summary 2026-05-31', 'mission-control/state/daily-summary-2026-05-31.md'],
    ['Mission Control Daily Summary 2026-05-30', 'mission-control/state/daily-summary-2026-05-30.md'],
    ['OCR Candidate Experiment Plan', 'docs/OCR_CANDIDATE_EXPERIMENT_PLAN.md'],
    ['OCR Debug Crop Review Checklist', 'docs/OCR_DEBUG_CROP_REVIEW_CHECKLIST.md'],
    ['OCR Labeled Handwriting Dataset Plan', 'docs/OCR_LABELED_HANDWRITING_DATASET_PLAN.md'],
    ['OCR Reliability Decision Record 2026-06-01', 'docs/OCR_RELIABILITY_DECISION_RECORD_2026-06-01.md'],
    ['OCR Reliability Operating Map', 'docs/OCR_RELIABILITY_OPERATING_MAP.md'],
    ['Operating Goals', 'docs/GOALS.md'],
    ['Open-Divider Sample Answer Keys', 'docs/OPEN_DIVIDER_SAMPLE_ANSWER_KEYS.md'],
    ['Prototype Roadmap', 'docs/PROTOTYPE_ROADMAP.md'],
    ['Review And Feedback Copy Guide', 'docs/REVIEW_AND_FEEDBACK_COPY_GUIDE.md'],
    ['Student Mode UX', 'docs/SCAN_GRADE_STUDENT_MODE_UX_SPEC.md'],
    ['Student Sample Eval Report Template', 'docs/STUDENT_SAMPLE_EVAL_REPORT_TEMPLATE.md'],
    ['Student Sample Intake', 'docs/STUDENT_SAMPLE_INTAKE.md'],
    ['Student Sample Privacy And Storage', 'docs/STUDENT_SAMPLE_PRIVACY_AND_STORAGE.md'],
    ['Student Sample Triage Runbook', 'docs/STUDENT_SAMPLE_TRIAGE_RUNBOOK.md'],
    ['Teacher Trust Scorecard', 'docs/TEACHER_TRUST_SCORECARD.md'],
    ['Two-Digit OCR Acceptance Gate', 'docs/TWO_DIGIT_OCR_ACCEPTANCE_GATE.md'],
    ['Scratch File Inventory', 'docs/SCRATCH_FILE_INVENTORY.md'],
    ['Teacher Workflow Prototype', 'docs/TEACHER_WORKFLOW_PROTOTYPE.md'],
    ['Trust Threshold Decision Framework', 'docs/TRUST_THRESHOLD_DECISION_FRAMEWORK.md'],
    ['TPT Copy Bank', 'products/TPT_COPY_BANK.md'],
    ['TPT Grade 2 First Paid Pack Blueprint', 'products/TPT_GRADE2_FIRST_PAID_PACK_BLUEPRINT.md'],
    ['TPT First Product Plan', 'products/TPT_FIRST_OPEN_DIVIDER_PRODUCT_PLAN.md'],
    ['TPT Launch Framework', 'products/TPT_LAUNCH_FRAMEWORK.md'],
    ['TPT Market Research Notes', 'products/TPT_MARKET_RESEARCH_NOTES.md'],
    ['Untracked Preservation', 'UNTRACKED_WORK_PRESERVATION_PLAN.md'],
    ['Worksheet Design Interview Guide', 'docs/WORKSHEET_DESIGN_INTERVIEW_GUIDE.md'],
    ['Worksheet Design System', 'docs/WORKSHEET_DESIGN_SYSTEM.md'],
    ['Worksheet Promotion Checklist', 'docs/WORKSHEET_PROMOTION_CHECKLIST.md'],
    ['Worksheet Quality Rubric', 'docs/WORKSHEET_QUALITY_RUBRIC.md'],
  ];

  return Promise.all(docs.map(async ([title, file]) => ({
    title,
    file,
    exists: await exists(resolve(ROOT, file)),
  })));
}

async function statusPayload() {
  const state = await readJson(resolve(STATE_ROOT, 'mission-state.json'), {});
  const decisions = await readJson(resolve(STATE_ROOT, 'decisions.json'), { decisions: [] });
  const strategic = await readJson(resolve(STATE_ROOT, 'strategic-backlog.json'), { cards: [] });
  const board = await readJson(resolve(ROOT, 'board_state.json'), { columns: [] });
  const worksheets = await readJson(resolve(ROOT, 'public/worksheets/manifest.json'), { templates: [] });
  const worksheetLibrary = await readJson(resolve(STATE_ROOT, 'worksheet-library.json'), {});
  const tests = await readJson(resolve(STATE_ROOT, 'test-history.json'), { runs: [] });

  return {
    generated_at: new Date().toISOString(),
    state,
    decisions,
    strategic,
    board,
    worksheets,
    worksheetLibrary,
    tests,
    docs: await latestDocSummaries(),
    git: await gitStatus(),
  };
}

async function collectBody(req, maxBytes = MAX_DEFAULT_BODY_BYTES) {
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    totalBytes += chunk.length;
    if (totalBytes > maxBytes) {
      const error = new Error(`Request body too large. Limit is ${Math.round(maxBytes / 1024 / 1024)} MB.`);
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

function safeSlug(value, fallback = 'scan') {
  const slug = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return slug || fallback;
}

function assertInside(root, target) {
  const normalizedRoot = root.endsWith('/') ? root : `${root}/`;
  if (target !== root && !target.startsWith(normalizedRoot)) {
    const error = new Error('Resolved path escaped debug scan root.');
    error.statusCode = 400;
    throw error;
  }
}

function dataUrlToBuffer(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return null;
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex === -1) return null;
  const meta = dataUrl.slice(0, commaIndex);
  const payload = dataUrl.slice(commaIndex + 1);
  if (meta.includes(';base64')) return Buffer.from(payload, 'base64');
  return Buffer.from(decodeURIComponent(payload), 'utf8');
}

async function writeDataUrl(path, dataUrl) {
  const buffer = dataUrlToBuffer(dataUrl);
  if (!buffer) return null;
  await mkdir(resolve(path, '..'), { recursive: true });
  await writeFile(path, buffer);
  return path;
}

function debugKeys(key) {
  return Array.isArray(key) ? key : [key];
}

function firstDebugString(debug, body, key) {
  for (const source of [debug, body, body?.debug]) {
    for (const candidate of debugKeys(key)) {
      if (typeof source?.[candidate] === 'string') return source[candidate];
    }
  }
  return null;
}

function firstDebugObject(debug, body, key) {
  for (const source of [debug, body, body?.debug]) {
    for (const candidate of debugKeys(key)) {
      if (source?.[candidate] && typeof source[candidate] === 'object' && !Array.isArray(source[candidate])) return source[candidate];
    }
  }
  return null;
}

function firstDebugArray(debug, body, key) {
  for (const source of [debug, body, body?.debug]) {
    for (const candidate of debugKeys(key)) {
      if (Array.isArray(source?.[candidate])) return source[candidate];
    }
  }
  return [];
}

const CAPTURED_IMAGE_KEYS = ['capturedImageDataUrl', 'capturedImage', 'captureDataUrl'];
const MARKED_SHEET_KEYS = ['markedSheetDataUrl', 'markedSheetImage', 'annotatedImageUrl'];
const CROPS_IMAGE_KEYS = ['cropsImageDataUrl', 'cropContactSheetDataUrl', 'cropsDataUrl', 'cropsImage'];

function summarizeDebugScan(debug, body, req, receivedAt) {
  const predictions = Array.isArray(debug.predictions) ? debug.predictions : [];
  const answerGroups = Array.isArray(debug.answerGroups) ? debug.answerGroups : [];
  const questionCorrect = Array.isArray(debug.questionCorrect) ? debug.questionCorrect : null;
  const questionReview = Array.isArray(debug.questionReview) ? debug.questionReview : null;
  const overlayDebug = firstDebugObject(debug, body, 'overlayDebug');
  return {
    receivedAt,
    source: body.source || 'scangrade-browser-debug',
    uploadReason: body.uploadReason || null,
    pageUrl: body.pageUrl || null,
    userAgent: body.userAgent || req.headers['user-agent'] || null,
    origin: req.headers.origin || null,
    generatedAt: debug.generatedAt || null,
    scanSessionId: debug.scanSessionId || debug.scan_session_id || null,
    packetId: debug.packetId || debug.packet_id || null,
    captureRole: debug.captureRole || debug.capture_role || null,
    capturePlanSeed: debug.capturePlanSeed || debug.capture_plan_seed || null,
    layoutId: debug.layoutId || debug.layout_id || debug.qrPayload?.template_id || null,
    sheetInstanceId: debug.qrPayload?.sheet_instance_id || null,
    qrPayload: debug.qrPayload || null,
    predictionCount: predictions.length,
    answerGroupCount: answerGroups.length,
    questionCount: questionCorrect?.length || answerGroups.length || null,
    questionScore: questionCorrect ? questionCorrect.filter(Boolean).length : null,
    questionReviewCount: questionReview ? questionReview.filter(Boolean).length : (debug.questionReviewCount ?? null),
    needsReviewCount: predictions.filter((prediction) => prediction?.reviewNeeded).length,
    digitEngineFallback: debug.digitEngineFallback === true,
    digitEngineError: debug.digitEngineError || null,
    forcedFallbackReviewReason: debug.forcedFallbackReviewReason || null,
    captureQuality: debug.captureQuality || null,
    cropQualityCount: Array.isArray(debug.cropQuality) ? debug.cropQuality.length : null,
    modelInfo: debug.modelInfo || null,
    runtime: debug.runtime || null,
    assets: {
      hasCapturedImage: !!firstDebugString(debug, body, CAPTURED_IMAGE_KEYS),
      hasMarkedSheet: !!firstDebugString(debug, body, MARKED_SHEET_KEYS),
      hasOverlayDebug: !!overlayDebug,
      hasWarpedImage: !!firstDebugString(debug, body, 'warpedDataUrl'),
      hasCropsImage: !!firstDebugString(debug, body, CROPS_IMAGE_KEYS),
      rawCropCount: firstDebugArray(debug, body, 'rawCropDataUrls').length,
      modelInputCount: firstDebugArray(debug, body, 'modelInputDataUrls').length,
      hybridBurstFrameCount: firstDebugArray(debug, body, 'hybridBurstFrameDataUrls').length,
      tensorCount: firstDebugArray(debug, body, 'tensors').length,
    },
  };
}

async function saveDebugScanUpload(body, req) {
  const debug = body?.debug && typeof body.debug === 'object' ? body.debug : body;
  if (!debug || typeof debug !== 'object' || Array.isArray(debug)) {
    const error = new Error('Expected a debug scan JSON object.');
    error.statusCode = 400;
    throw error;
  }

  const receivedAt = new Date().toISOString();
  const dateSlug = receivedAt.slice(0, 10);
  const layoutSlug = safeSlug(debug.layoutId || debug.layout_id || debug.qrPayload?.template_id, 'unknown-layout');
  const id = `${receivedAt.replace(/[:.]/g, '-').replace('T', '_').replace('Z', '')}-${layoutSlug}-${randomUUID().slice(0, 8)}`;
  const dir = normalize(resolve(DEBUG_SCAN_ROOT, dateSlug, id));
  assertInside(DEBUG_SCAN_ROOT, dir);
  await mkdir(dir, { recursive: true });

  const summary = summarizeDebugScan(debug, body, req, receivedAt);
  await writePlainJson(resolve(dir, 'summary.json'), summary);
  await writePlainJson(resolve(dir, 'debug.json'), {
    receivedAt,
    upload: {
      source: body.source || 'scangrade-browser-debug',
      uploadReason: body.uploadReason || null,
      pageUrl: body.pageUrl || null,
      userAgent: body.userAgent || req.headers['user-agent'] || null,
      origin: req.headers.origin || null,
    },
    debug,
  });

  const assetFiles = [];
  const capturedPath = await writeDataUrl(resolve(dir, 'captured.png'), firstDebugString(debug, body, CAPTURED_IMAGE_KEYS));
  if (capturedPath) assetFiles.push('captured.png');
  const markedSheetPath = await writeDataUrl(resolve(dir, 'marked-sheet.jpg'), firstDebugString(debug, body, MARKED_SHEET_KEYS));
  if (markedSheetPath) assetFiles.push('marked-sheet.jpg');
  const overlayDebug = firstDebugObject(debug, body, 'overlayDebug');
  if (overlayDebug) {
    await writePlainJson(resolve(dir, 'overlay-debug.json'), {
      receivedAt,
      debugScanId: id,
      ...overlayDebug,
    });
    assetFiles.push('overlay-debug.json');
  }
  const warpedPath = await writeDataUrl(resolve(dir, 'warped.png'), firstDebugString(debug, body, 'warpedDataUrl'));
  if (warpedPath) assetFiles.push('warped.png');
  const cropsPath = await writeDataUrl(resolve(dir, 'crops.png'), firstDebugString(debug, body, CROPS_IMAGE_KEYS));
  if (cropsPath) assetFiles.push('crops.png');

  const rawCropUrls = firstDebugArray(debug, body, 'rawCropDataUrls');
  for (let i = 0; i < rawCropUrls.length; i += 1) {
    const filename = `raw-crops/raw-${String(i + 1).padStart(2, '0')}.png`;
    const written = await writeDataUrl(resolve(dir, filename), rawCropUrls[i]);
    if (written) assetFiles.push(filename);
  }

  const modelInputUrls = firstDebugArray(debug, body, 'modelInputDataUrls');
  for (let i = 0; i < modelInputUrls.length; i += 1) {
    const filename = `model-inputs/model-${String(i + 1).padStart(2, '0')}.png`;
    const written = await writeDataUrl(resolve(dir, filename), modelInputUrls[i]);
    if (written) assetFiles.push(filename);
  }

  const hybridBurstFrameUrls = firstDebugArray(debug, body, 'hybridBurstFrameDataUrls');
  for (let i = 0; i < hybridBurstFrameUrls.length; i += 1) {
    const filename = `burst-frames/frame-${String(i + 1).padStart(2, '0')}.jpg`;
    const written = await writeDataUrl(resolve(dir, filename), hybridBurstFrameUrls[i]);
    if (written) assetFiles.push(filename);
  }

  return {
    ok: true,
    id,
    path: dir,
    summaryPath: resolve(dir, 'summary.json'),
    debugPath: resolve(dir, 'debug.json'),
    assetFiles,
  };
}

function sendJson(res, code, payload) {
  res.writeHead(code, jsonHeaders);
  res.end(`${JSON.stringify(payload, null, 2)}\n`);
}

function stripRoutePrefix(pathname) {
  if (pathname === ROUTE_PREFIX) return '/';
  if (pathname.startsWith(`${ROUTE_PREFIX}/`)) return pathname.slice(ROUTE_PREFIX.length) || '/';
  return pathname;
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = stripRoutePrefix(url.pathname);

  if (pathname.startsWith('/repo/')) {
    const repoPath = pathname.replace(/^\/repo\//, '');
    const target = normalize(resolve(ROOT, repoPath));
    if (!target.startsWith(ROOT)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    try {
      await stat(target);
      res.writeHead(200, {
        'Content-Type': mimeTypes[extname(target)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      createReadStream(target).pipe(res);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
    return;
  }

  const staticPathname = pathname === '/' ? '/index.html' : pathname;
  const target = normalize(resolve(PUBLIC_ROOT, `.${staticPathname}`));
  if (!target.startsWith(PUBLIC_ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  try {
    await stat(target);
    res.writeHead(200, {
      'Content-Type': mimeTypes[extname(target)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    createReadStream(target).pipe(res);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, jsonHeaders);
    res.end();
    return;
  }

  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = stripRoutePrefix(url.pathname);

    if (req.method === 'GET' && pathname === '/api/status') {
      return sendJson(res, 200, await statusPayload());
    }

    if (req.method === 'POST' && pathname === '/api/debug-scans') {
      const expectedToken = process.env.SG_DEBUG_UPLOAD_TOKEN || '';
      const suppliedToken = req.headers['x-scangrade-debug-token'] || '';
      if (!expectedToken) {
        return sendJson(res, 503, { error: 'Debug uploads require SG_DEBUG_UPLOAD_TOKEN on the Mission Control server.' });
      }
      if (expectedToken && suppliedToken !== expectedToken) {
        return sendJson(res, 401, { error: 'Invalid debug upload token.' });
      }
      const body = await collectBody(req, MAX_DEBUG_SCAN_BYTES);
      return sendJson(res, 201, await saveDebugScanUpload(body, req));
    }

    if (req.method === 'POST' && pathname === '/api/mission') {
      const body = await collectBody(req);
      const current = await readJson(resolve(STATE_ROOT, 'mission-state.json'), {});
      return sendJson(res, 200, await writeJson(resolve(STATE_ROOT, 'mission-state.json'), { ...current, ...body }));
    }

    if (req.method === 'POST' && pathname === '/api/decisions') {
      const body = await collectBody(req);
      if (!Array.isArray(body.decisions)) return sendJson(res, 400, { error: 'decisions must be an array' });
      return sendJson(res, 200, await writeJson(resolve(STATE_ROOT, 'decisions.json'), body));
    }

    if (req.method === 'POST' && pathname === '/api/strategic-backlog') {
      const body = await collectBody(req);
      if (!Array.isArray(body.cards)) return sendJson(res, 400, { error: 'cards must be an array' });
      return sendJson(res, 200, await writeJson(resolve(STATE_ROOT, 'strategic-backlog.json'), body));
    }

    return serveStatic(req, res);
  } catch (error) {
    return sendJson(res, error.statusCode || 500, { error: String(error.stack || error.message || error) });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`ScanGrade Mission Control: http://${HOST}:${PORT}`);
  console.log('For Tailscale access, expose this localhost service with Tailscale Serve or set SG_MISSION_CONTROL_HOST to a Tailnet interface.');
});
