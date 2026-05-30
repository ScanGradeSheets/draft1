import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { extname, normalize, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const MC_ROOT = resolve(ROOT, 'mission-control');
const PUBLIC_ROOT = resolve(MC_ROOT, 'public');
const STATE_ROOT = resolve(MC_ROOT, 'state');
const PORT = Number(process.env.SG_MISSION_CONTROL_PORT || 8787);
const HOST = process.env.SG_MISSION_CONTROL_HOST || '127.0.0.1';

const jsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
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
    ['Benchmark Artifact Inventory', 'docs/BENCHMARK_ARTIFACT_INVENTORY.md'],
    ['Backend Readiness', 'docs/BACKEND_DEPLOYMENT_READINESS.md'],
    ['Model Artifact Inventory', 'docs/MODEL_ARTIFACT_INVENTORY.md'],
    ['Operating Goals', 'docs/GOALS.md'],
    ['Prototype Roadmap', 'docs/PROTOTYPE_ROADMAP.md'],
    ['Student Mode UX', 'docs/SCAN_GRADE_STUDENT_MODE_UX_SPEC.md'],
    ['Student Sample Intake', 'docs/STUDENT_SAMPLE_INTAKE.md'],
    ['Scratch File Inventory', 'docs/SCRATCH_FILE_INVENTORY.md'],
    ['TPT First Product Plan', 'products/TPT_FIRST_OPEN_DIVIDER_PRODUCT_PLAN.md'],
    ['Untracked Preservation', 'UNTRACKED_WORK_PRESERVATION_PLAN.md'],
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

async function collectBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

function sendJson(res, code, payload) {
  res.writeHead(code, jsonHeaders);
  res.end(`${JSON.stringify(payload, null, 2)}\n`);
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (url.pathname.startsWith('/repo/')) {
    const repoPath = url.pathname.replace(/^\/repo\//, '');
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

  const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
  const target = normalize(resolve(PUBLIC_ROOT, `.${pathname}`));
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

    if (req.method === 'GET' && url.pathname === '/api/status') {
      return sendJson(res, 200, await statusPayload());
    }

    if (req.method === 'POST' && url.pathname === '/api/mission') {
      const body = await collectBody(req);
      const current = await readJson(resolve(STATE_ROOT, 'mission-state.json'), {});
      return sendJson(res, 200, await writeJson(resolve(STATE_ROOT, 'mission-state.json'), { ...current, ...body }));
    }

    if (req.method === 'POST' && url.pathname === '/api/decisions') {
      const body = await collectBody(req);
      if (!Array.isArray(body.decisions)) return sendJson(res, 400, { error: 'decisions must be an array' });
      return sendJson(res, 200, await writeJson(resolve(STATE_ROOT, 'decisions.json'), body));
    }

    if (req.method === 'POST' && url.pathname === '/api/strategic-backlog') {
      const body = await collectBody(req);
      if (!Array.isArray(body.cards)) return sendJson(res, 400, { error: 'cards must be an array' });
      return sendJson(res, 200, await writeJson(resolve(STATE_ROOT, 'strategic-backlog.json'), body));
    }

    return serveStatic(req, res);
  } catch (error) {
    return sendJson(res, 500, { error: String(error.stack || error.message || error) });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`ScanGrade Mission Control: http://${HOST}:${PORT}`);
  console.log('For Tailscale access, expose this localhost service with Tailscale Serve or set SG_MISSION_CONTROL_HOST to a Tailnet interface.');
});
