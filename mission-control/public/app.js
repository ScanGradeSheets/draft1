const typeLabels = {
  app: 'App',
  worksheet: 'Worksheet',
  validation: 'Validation',
  backend: 'Backend',
  tpt: 'TPT',
  marketing: 'Marketing',
  'mission-control': 'Mission Control',
  decision: 'Tony Decision',
  tony: 'Tony Task',
};

let currentStatus = null;
let missionDraftBeforeEdit = '';

const $ = (id) => document.getElementById(id);

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function fetchJson(url, options) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

function renderList(id, items) {
  $(id).innerHTML = (items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('');
}

function renderToday(data) {
  const state = data.state || {};
  const allCards = (state.focus_board || data.board?.columns || []).flatMap((column) => column.cards || []);
  const activeCards = (state.focus_board || data.board?.columns || [])
    .filter((column) => !['Done', 'done'].includes(column.id || column.column))
    .flatMap((column) => column.cards || []);
  $('missionDisplay').textContent = state.current_mission || '';
  $('missionInput').value = state.current_mission || '';
  $('northStar').textContent = state.north_star || '';
  $('nextBestMove').textContent = state.next_best_move || '';
  $('plainStatus').textContent = state.plain_english_status || '';
  $('codexRule').textContent = state.codex_autonomy_rule || '';
  renderList('needsTony', state.needs_tony || []);
  renderList('riskList', state.blocked_or_risky || []);
  $('riskCount').textContent = String((state.blocked_or_risky || []).length);
  $('worksheetCount').textContent = String((data.worksheetLibrary?.current_test_set?.templates || data.worksheets?.templates || []).length);
  $('openDecisionCount').textContent = String((data.decisions?.decisions || []).filter((d) => d.status !== 'answered').length);
  $('activeCardCount').textContent = String(activeCards.length || allCards.length);
}

function renderStrategic(data) {
  const cards = data.strategic?.cards || [];
  $('strategicCards').innerHTML = cards.map((card) => `
    <article class="milestone type-${escapeHtml(card.type)}">
      <div class="milestone-marker"></div>
      <div>
        <div class="badge-row">
          <span class="badge">${escapeHtml(card.status)}</span>
          <span class="badge">${escapeHtml(typeLabels[card.type] || card.type)}</span>
        </div>
        <h3>${escapeHtml(card.title)}</h3>
        <p>${escapeHtml(card.summary)}</p>
        <details>
          <summary>Why this matters</summary>
          <p>${escapeHtml(card.why_it_matters)}</p>
        </details>
      </div>
    </article>
  `).join('');
}

function typeClass(type) {
  const value = String(type || '').toLowerCase();
  if (value.includes('worksheet')) return 'type-worksheet';
  if (value.includes('validation') || value.includes('test')) return 'type-validation';
  if (value.includes('marketing')) return 'type-marketing';
  if (value.includes('tpt')) return 'type-tpt';
  if (value.includes('backend')) return 'type-backend';
  if (value.includes('decision')) return 'type-decision';
  if (value.includes('tony')) return 'type-tony';
  if (value.includes('mission')) return 'type-mission-control';
  if (value.includes('spec')) return 'type-spec';
  if (value.includes('app')) return 'type-app';
  return 'type-general';
}

function cardType(card) {
  if (card.type) return card.type;
  const tags = card.tags || [];
  if (tags.some((tag) => String(tag).includes('worksheet'))) return 'worksheet';
  if (tags.some((tag) => String(tag).includes('spec'))) return 'spec';
  if (tags.some((tag) => String(tag).includes('test'))) return 'validation';
  if (tags.some((tag) => String(tag).includes('app'))) return 'app';
  return 'general';
}

function renderLegend() {
  const types = ['app', 'validation', 'worksheet', 'tony', 'decision', 'backend', 'tpt', 'marketing', 'mission-control'];
  $('typeLegend').innerHTML = types.map((type) => `
    <span class="legend-item ${typeClass(type)}">
      <i></i>${escapeHtml(typeLabels[type] || type)}
    </span>
  `).join('');
}

function renderBoard(data) {
  const columns = data.state?.focus_board || data.board?.columns || [];
  renderLegend();
  $('boardColumns').innerHTML = columns.map((column) => `
    <div class="column">
      <h3>${escapeHtml(column.column || column.name)} <span>${(column.cards || []).length}</span></h3>
      ${(column.cards || []).map((card) => `
        <details class="mini-card ${escapeHtml(typeClass(cardType(card)))}">
          <summary>
            <span>${escapeHtml(card.title)}</span>
            <b>${escapeHtml(card.owner || typeLabels[cardType(card)] || card.priority || '')}</b>
          </summary>
          <p>${escapeHtml(card.summary || card.notes || card.feedback || '')}</p>
          ${card.detail ? `<p>${escapeHtml(card.detail)}</p>` : ''}
          <div class="badge-row">
            <span class="badge">${escapeHtml(typeLabels[cardType(card)] || cardType(card))}</span>
            ${card.owner ? `<span class="badge">${escapeHtml(card.owner)}</span>` : ''}
            ${(card.tags || []).map((tag) => `<span class="badge">${escapeHtml(tag)}</span>`).join('')}
          </div>
          ${card.filepath ? `<p class="file-hint">${escapeHtml(card.filepath)}</p>` : ''}
        </details>
      `).join('') || '<p class="muted">No cards.</p>'}
    </div>
  `).join('');
}

function renderDecisions(data) {
  const decisions = data.decisions?.decisions || [];
  const open = decisions
    .map((decision, index) => ({ decision, index }))
    .filter(({ decision }) => decision.status !== 'answered');
  const answered = decisions
    .map((decision, index) => ({ decision, index }))
    .filter(({ decision }) => decision.status === 'answered');

  $('decisionList').innerHTML = open.length ? open.map(({ decision, index }) => `
    <article class="decision" data-index="${index}">
      <div class="badge-row">
        <span class="badge">${escapeHtml(decision.priority)}</span>
        <span class="badge">${escapeHtml(decision.status)}</span>
      </div>
      <h3>${escapeHtml(decision.question)}</h3>
      <p><strong>Why it matters:</strong> ${escapeHtml(decision.why)}</p>
      <p><strong>Codex recommendation:</strong> ${escapeHtml(decision.recommendation)}</p>
      <div class="decision-controls">
        <select data-role="option">
          <option value="">Choose an answer...</option>
          ${(decision.options || []).map((option) => `<option ${decision.answer === option ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')}
        </select>
        <input data-role="answer" value="${escapeHtml(decision.answer || '')}" placeholder="Or type Tony's answer..." />
        <button data-role="save-decision" type="button">Save</button>
      </div>
    </article>
  `).join('') : '<article class="panel empty-state"><h3>No open Tony questions.</h3><p>Answered questions are hidden below and can be reopened if needed.</p></article>';

  $('answeredDecisionList').innerHTML = answered.length ? answered.map(({ decision, index }) => `
    <article class="decision answered" data-index="${index}">
      <div class="badge-row">
        <span class="badge">${escapeHtml(decision.priority)}</span>
        <span class="badge">answered</span>
      </div>
      <h3>${escapeHtml(decision.question)}</h3>
      <p><strong>Answer:</strong> ${escapeHtml(decision.answer)}</p>
      <button data-role="reopen-decision" class="secondary" type="button">Reopen</button>
    </article>
  `).join('') : '<p class="muted">No answered questions yet.</p>';
}

function renderWorksheets(data) {
  const currentSet = data.worksheetLibrary?.current_test_set || {};
  const templates = currentSet.templates || data.worksheets?.templates || [];
  const olderTemplates = data.worksheets?.templates || [];
  const packetHref = currentSet.packet_pdf ? `/repo/public/${currentSet.packet_pdf}` : '#';

  $('worksheetSetLabel').textContent = currentSet.label || 'Current test set';
  $('worksheetSetStatus').textContent = currentSet.status || 'Awaiting samples';
  $('worksheetSetSummary').textContent = currentSet.summary || '';
  $('worksheetPacketLink').href = packetHref;
  $('worksheetPacketLink').hidden = !currentSet.packet_pdf;
  $('olderWorksheetNote').textContent = data.worksheetLibrary?.older_manifest_note || 'Older worksheet assets from the public manifest.';

  $('worksheetList').innerHTML = templates.map((template) => `
    <article class="worksheet-card">
      <a class="worksheet-preview" href="/repo/public/${escapeHtml(template.worksheet_url)}" target="_blank" rel="noreferrer">
        <img src="/repo/public/${escapeHtml(template.worksheet_url)}" alt="${escapeHtml(template.title)} preview" />
      </a>
      <div class="badge-row">
        <span class="badge">${escapeHtml(template.human_code || template.template_id)}</span>
        <span class="badge">${escapeHtml(template.total_questions)} questions</span>
      </div>
      <h3>${escapeHtml(template.title)}</h3>
      <p>${escapeHtml(template.template_id)}</p>
      <div class="worksheet-actions">
        <a href="/repo/public/${escapeHtml(template.worksheet_url)}" target="_blank" rel="noreferrer">Open sheet</a>
        ${template.pdf_url ? `<a href="/repo/public/${escapeHtml(template.pdf_url)}" target="_blank" rel="noreferrer">PDF</a>` : ''}
        <a href="/repo/public/${escapeHtml(template.layout_url)}" target="_blank" rel="noreferrer">Layout</a>
      </div>
      <details>
        <summary>Technical details</summary>
        <p>${escapeHtml(template.answer_box_style || `Answer boxes: ${template.answer_box_count}`)}. QR checksum: ${escapeHtml(template.qr_payload?.answer_key_checksum || 'same layout family / not listed here')}.</p>
      </details>
    </article>
  `).join('');

  $('olderWorksheetList').innerHTML = olderTemplates.map((template) => `
    <article class="worksheet-card older">
      <a class="worksheet-preview" href="/repo/public/${escapeHtml(template.worksheet_url)}" target="_blank" rel="noreferrer">
        <img src="/repo/public/${escapeHtml(template.worksheet_url)}" alt="${escapeHtml(template.title)} old preview" />
      </a>
      <div class="badge-row">
        <span class="badge">${escapeHtml(template.human_code || template.template_id)}</span>
        <span class="badge">older manifest</span>
      </div>
      <h3>${escapeHtml(template.title)}</h3>
      <p>${escapeHtml(template.template_id)}</p>
      <div class="worksheet-actions">
        <a href="/repo/public/${escapeHtml(template.worksheet_url)}" target="_blank" rel="noreferrer">Open old sheet</a>
      </div>
    </article>
  `).join('');
}

function renderValidation(data) {
  const runs = data.tests?.runs || [];
  $('testHistory').innerHTML = runs.map((run) => `
    <article class="test-run ${escapeHtml(run.result)}">
      <div class="badge-row">
        <span class="badge">${escapeHtml(run.date)}</span>
        <span class="badge">${escapeHtml(run.result)}</span>
      </div>
      <h3>${escapeHtml(run.name)}</h3>
      <p>${escapeHtml(run.plain_english)}</p>
      <details>
        <summary>Command and path</summary>
        <p><strong>Path:</strong> ${escapeHtml(run.path_exercised)}</p>
        <pre>${escapeHtml(run.command)}</pre>
      </details>
    </article>
  `).join('');
}

function renderDocs(data) {
  const docs = data.docs || [];
  $('docList').innerHTML = docs.map((doc) => `
    <a class="doc-item" href="/repo/${escapeHtml(doc.file)}" target="_blank" rel="noreferrer">
      <div>
        <strong>${escapeHtml(doc.title)}</strong>
        <p>${escapeHtml(doc.file)}</p>
      </div>
      <span class="badge">${doc.exists ? 'present' : 'missing'}</span>
    </a>
  `).join('');
}

function renderGit(data) {
  const git = data.git || {};
  const lines = [
    `dirty: ${git.dirty}`,
    `modified tracked: ${git.modified_tracked ?? 'unknown'}`,
    `untracked: ${git.untracked ?? 'unknown'}`,
    '',
    ...(git.lines || []),
    git.truncated ? '... truncated ...' : '',
    git.error ? `error: ${git.error}` : '',
  ].filter((line) => line !== null && line !== undefined);
  $('gitStatus').textContent = lines.join('\n');
}

function render(data) {
  currentStatus = data;
  renderToday(data);
  renderStrategic(data);
  renderBoard(data);
  renderDecisions(data);
  renderWorksheets(data);
  renderValidation(data);
  renderDocs(data);
  renderGit(data);
}

async function loadStatus() {
  render(await fetchJson('/api/status'));
}

async function saveMission() {
  const state = {
    ...(currentStatus?.state || {}),
    current_mission: $('missionInput').value.trim(),
  };
  await fetchJson('/api/mission', {
    method: 'POST',
    body: JSON.stringify(state),
  });
  await loadStatus();
  setMissionEditing(false);
}

async function saveDecision(article) {
  const index = Number(article.dataset.index);
  const decisions = structuredClone(currentStatus.decisions);
  const option = article.querySelector('[data-role="option"]').value;
  const answer = article.querySelector('[data-role="answer"]').value.trim() || option;
  decisions.decisions[index].answer = answer;
  decisions.decisions[index].status = answer ? 'answered' : 'open';
  await fetchJson('/api/decisions', {
    method: 'POST',
    body: JSON.stringify(decisions),
  });
  await loadStatus();
}

async function reopenDecision(article) {
  const index = Number(article.dataset.index);
  const decisions = structuredClone(currentStatus.decisions);
  decisions.decisions[index].answer = '';
  decisions.decisions[index].status = 'open';
  await fetchJson('/api/decisions', {
    method: 'POST',
    body: JSON.stringify(decisions),
  });
  await loadStatus();
}

function setMissionEditing(isEditing) {
  $('missionEditor').hidden = !isEditing;
  $('missionDisplay').hidden = isEditing;
  $('editMissionButton').hidden = isEditing;
  if (isEditing) {
    missionDraftBeforeEdit = $('missionInput').value;
    $('missionInput').focus();
  } else {
    $('missionInput').value = currentStatus?.state?.current_mission || missionDraftBeforeEdit || '';
  }
}

document.addEventListener('click', async (event) => {
  if (event.target.id === 'refreshButton') {
    await loadStatus();
  }
  if (event.target.id === 'saveMissionButton') {
    await saveMission();
  }
  if (event.target.id === 'editMissionButton') {
    setMissionEditing(true);
  }
  if (event.target.id === 'cancelMissionButton') {
    setMissionEditing(false);
  }
  if (event.target.dataset.role === 'save-decision') {
    await saveDecision(event.target.closest('.decision'));
  }
  if (event.target.dataset.role === 'reopen-decision') {
    await reopenDecision(event.target.closest('.decision'));
  }
});

document.addEventListener('change', (event) => {
  if (event.target.dataset.role === 'option') {
    const article = event.target.closest('.decision');
    const input = article.querySelector('[data-role="answer"]');
    if (!input.value.trim()) input.value = event.target.value;
  }
});

loadStatus().catch((error) => {
  document.body.innerHTML = `<pre>Mission Control failed to load: ${escapeHtml(error.message)}</pre>`;
});
