import { fetchHelper } from '../shared/fetch-helper.js';

const STORAGE_KEY = 'aitopia_admin_api_key';

const el = {
  setKeyBtn: document.getElementById('setKeyBtn'),
  clearKeyBtn: document.getElementById('clearKeyBtn'),
  refreshBtn: document.getElementById('refreshBtn'),
  keyStatus: document.getElementById('keyStatus'),
  errorBanner: document.getElementById('errorBanner'),
  summary: document.getElementById('summary'),
  rows: document.getElementById('rows'),
  emptyState: document.getElementById('emptyState'),
  prevBtn: document.getElementById('prevBtn'),
  nextBtn: document.getElementById('nextBtn'),

  filtersForm: document.getElementById('filtersForm'),
  qInput: document.getElementById('qInput'),
  userIdInput: document.getElementById('userIdInput'),
  agentIdInput: document.getElementById('agentIdInput'),
  providerInput: document.getElementById('providerInput'),
  modelIdInput: document.getElementById('modelIdInput'),
  statusInput: document.getElementById('statusInput'),
  fromInput: document.getElementById('fromInput'),
  toInput: document.getElementById('toInput'),
  hasErrorInput: document.getElementById('hasErrorInput'),
  resetBtn: document.getElementById('resetBtn'),

  drawer: document.getElementById('drawer'),
  drawerBackdrop: document.getElementById('drawerBackdrop'),
  closeDrawerBtn: document.getElementById('closeDrawerBtn'),
  drawerSubtitle: document.getElementById('drawerSubtitle'),
  drawerLoading: document.getElementById('drawerLoading'),
  copyRunIdBtn: document.getElementById('copyRunIdBtn'),
  copyPromptBtn: document.getElementById('copyPromptBtn'),
  copyProviderJobsBtn: document.getElementById('copyProviderJobsBtn'),
  copyAllJsonBtn: document.getElementById('copyAllJsonBtn'),

  dRunId: document.getElementById('dRunId'),
  dUserId: document.getElementById('dUserId'),
  dAgentId: document.getElementById('dAgentId'),
  dStatus: document.getElementById('dStatus'),
  dTraceId: document.getElementById('dTraceId'),
  dIdem: document.getElementById('dIdem'),
  dPrimaryUrl: document.getElementById('dPrimaryUrl'),
  dPreview: document.getElementById('dPreview'),
  dPrompt: document.getElementById('dPrompt'),
  dProviderJobs: document.getElementById('dProviderJobs'),
  dRaw: document.getElementById('dRaw'),
};

const state = {
  adminKey: null,
  limit: 50,
  offset: 0,
  creations: [],
  loading: false,
  selectedRunId: null,
  selectedDetail: null,
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function setError(message) {
  if (!el.errorBanner) return;
  if (!message) {
    el.errorBanner.classList.add('hidden');
    el.errorBanner.textContent = '';
    return;
  }
  el.errorBanner.classList.remove('hidden');
  el.errorBanner.textContent = message;
}

function formatDateTime(value) {
  const d = value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  return d.toLocaleString();
}

function formatDuration(ms) {
  const n = typeof ms === 'number' && Number.isFinite(ms) ? ms : null;
  if (n == null) return '—';
  if (n < 1000) return `${Math.round(n)}ms`;
  const sec = Math.round(n / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return `${min}m ${rem}s`;
}

function formatUsd(value) {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : null;
  if (n == null) return '—';
  return `$${n.toFixed(2)}`;
}

function badge(text, tone) {
  const base = 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold';
  if (tone === 'green') return `<span class="${base} bg-green-500/15 text-green-500">${escapeHtml(text)}</span>`;
  if (tone === 'red') return `<span class="${base} bg-red-500/15 text-red-500">${escapeHtml(text)}</span>`;
  if (tone === 'amber') return `<span class="${base} bg-amber-500/15 text-amber-500">${escapeHtml(text)}</span>`;
  return `<span class="${base} bg-secondary text-muted-foreground">${escapeHtml(text)}</span>`;
}

function statusBadge(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'completed') return badge('completed', 'green');
  if (s === 'failed') return badge('failed', 'red');
  if (s === 'running') return badge('running', 'amber');
  if (s === 'partial') return badge('partial', 'amber');
  if (s === 'cancelled') return badge('cancelled', 'neutral');
  return badge(s || 'unknown', 'neutral');
}

function getAdminKey() {
  return localStorage.getItem(STORAGE_KEY);
}

function setAdminKey(key) {
  if (!key) return;
  localStorage.setItem(STORAGE_KEY, key);
  state.adminKey = key;
  updateKeyStatus();
}

function clearAdminKey() {
  localStorage.removeItem(STORAGE_KEY);
  state.adminKey = null;
  updateKeyStatus();
}

function updateKeyStatus() {
  const key = state.adminKey || getAdminKey();
  state.adminKey = key;
  if (!el.keyStatus) return;
  if (!key) {
    el.keyStatus.textContent = 'No admin key set. Click “Set admin key” to continue.';
    return;
  }
  const masked = `${key.slice(0, 4)}…${key.slice(-4)}`;
  el.keyStatus.textContent = `Admin key loaded (${masked}).`;
}

async function ensureAdminKey() {
  let key = state.adminKey || getAdminKey();
  if (!key) {
    key = window.prompt('Enter admin key (ADMIN_API_KEY):') || '';
    key = key.trim();
    if (key) setAdminKey(key);
  }
  return key;
}

async function api(path) {
  const key = await ensureAdminKey();
  if (!key) throw new Error('Admin key is required.');

  const res = await fetchHelper(path, {
    method: 'GET',
    headers: {
      'X-Tenant-Id': 'admin',
      'X-Admin-Key': key,
    },
  });

  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  return { res, json };
}

function buildQuery() {
  const qs = new URLSearchParams();
  qs.set('limit', String(state.limit));
  qs.set('offset', String(state.offset));

  const q = el.qInput?.value?.trim();
  const userId = el.userIdInput?.value?.trim();
  const agentId = el.agentIdInput?.value?.trim();
  const provider = el.providerInput?.value?.trim();
  const modelId = el.modelIdInput?.value?.trim();
  const status = el.statusInput?.value?.trim();
  const from = el.fromInput?.value?.trim();
  const to = el.toInput?.value?.trim();
  const hasError = Boolean(el.hasErrorInput?.checked);

  if (q) qs.set('q', q);
  if (userId) qs.set('userId', userId);
  if (agentId) qs.set('agentId', agentId);
  if (provider) qs.set('provider', provider);
  if (modelId) qs.set('modelId', modelId);
  if (status) qs.set('status', status);
  if (from) qs.set('from', new Date(from).toISOString());
  if (to) qs.set('to', new Date(to).toISOString());
  if (hasError) qs.set('hasError', 'true');

  return qs.toString();
}

function renderTable() {
  const rows = Array.isArray(state.creations) ? state.creations : [];
  if (!el.rows) return;

  el.rows.innerHTML = rows
    .map((c) => {
      const createdAt = c?.createdAt ? formatDateTime(c.createdAt) : '—';
      const userId = c?.userId || '—';
      const agentId = c?.agentId || '—';
      const provider = c?.provider || '—';
      const modelId = c?.modelId || '—';
      const duration = formatDuration(c?.durationMs);
      const cost = formatUsd(c?.costUsd);
      const err = c?.error?.code || c?.error?.message ? '⚠︎' : '';

      return `
        <tr class="hover:bg-secondary/20 cursor-pointer" data-run-id="${escapeHtml(c?.runId || '')}">
          <td class="px-4 py-3 whitespace-nowrap">${escapeHtml(createdAt)}</td>
          <td class="px-4 py-3 font-mono text-xs max-w-[240px] truncate">${escapeHtml(userId)}</td>
          <td class="px-4 py-3 font-mono text-xs max-w-[260px] truncate">${escapeHtml(agentId)}</td>
          <td class="px-4 py-3 whitespace-nowrap">${statusBadge(c?.status)}</td>
          <td class="px-4 py-3 font-mono text-xs max-w-[180px] truncate">${escapeHtml(provider)}</td>
          <td class="px-4 py-3 font-mono text-xs max-w-[260px] truncate">${escapeHtml(modelId)}</td>
          <td class="px-4 py-3 whitespace-nowrap">${escapeHtml(duration)}</td>
          <td class="px-4 py-3 whitespace-nowrap">${escapeHtml(cost)}</td>
          <td class="px-4 py-3 whitespace-nowrap text-red-500">${escapeHtml(err)}</td>
        </tr>
      `;
    })
    .join('');

  if (el.emptyState) el.emptyState.classList.toggle('hidden', rows.length > 0);
}

function updatePager(hasMore) {
  if (el.prevBtn) el.prevBtn.classList.toggle('hidden', state.offset === 0);
  if (el.nextBtn) el.nextBtn.classList.toggle('hidden', !hasMore);
}

async function loadList({ resetOffset = false } = {}) {
  if (state.loading) return;
  state.loading = true;
  setError('');

  if (resetOffset) state.offset = 0;
  if (el.summary) el.summary.textContent = 'Loading…';

  try {
    const qs = buildQuery();
    const { res, json } = await api(`https://aitopia.ai/api/admin/creations?${qs}`);

    if (!res.ok) {
      const msg = json?.error?.message || json?.error || `Request failed (${res.status})`;
      throw new Error(String(msg));
    }

    state.creations = Array.isArray(json?.creations) ? json.creations : [];
    renderTable();
    updatePager(Boolean(json?.hasMore));

    if (el.summary) {
      el.summary.textContent = `Showing ${state.creations.length} rows • offset ${state.offset} • limit ${state.limit}`;
    }
  } catch (err) {
    setError(err instanceof Error ? err.message : String(err));
    state.creations = [];
    renderTable();
    updatePager(false);
    if (el.summary) el.summary.textContent = '—';
  } finally {
    state.loading = false;
  }
}

function openDrawer() {
  el.drawer?.classList.remove('hidden');
}

function closeDrawer() {
  el.drawer?.classList.add('hidden');
  state.selectedRunId = null;
  state.selectedDetail = null;
}

async function copyText(value) {
  const text = String(value ?? '');
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      document.execCommand('copy');
    } finally {
      ta.remove();
    }
  }
}

function renderPreview(preview) {
  if (!el.dPreview) return;
  el.dPreview.innerHTML = '';

  if (!preview) {
    el.dPreview.innerHTML = `<div class="text-sm text-muted-foreground">No preview available.</div>`;
    if (el.dPrimaryUrl) el.dPrimaryUrl.classList.add('hidden');
    return;
  }

  if (preview.kind === 'image' && preview.url) {
    el.dPreview.innerHTML = `<img src="${escapeHtml(preview.url)}" alt="" class="w-full h-full object-contain bg-black/10" />`;
  } else if (preview.kind === 'video' && preview.url) {
    el.dPreview.innerHTML = `<video src="${escapeHtml(preview.url)}" controls class="w-full h-full bg-black/10"></video>`;
  } else if (preview.kind === 'audio' && preview.url) {
    el.dPreview.innerHTML = `<audio src="${escapeHtml(preview.url)}" controls class="w-full"></audio>`;
  } else if (preview.kind === 'text' && preview.text) {
    el.dPreview.innerHTML = `<div class="p-4 text-sm text-muted-foreground whitespace-pre-wrap break-words">${escapeHtml(preview.text)}</div>`;
  } else {
    el.dPreview.innerHTML = `<div class="text-sm text-muted-foreground">No preview available.</div>`;
  }

  const url = preview.url || '';
  if (el.dPrimaryUrl) {
    if (url) {
      el.dPrimaryUrl.href = url;
      el.dPrimaryUrl.textContent = 'Open output';
      el.dPrimaryUrl.classList.remove('hidden');
    } else {
      el.dPrimaryUrl.classList.add('hidden');
    }
  }
}

function renderProviderJobs(items) {
  if (!el.dProviderJobs) return;
  const list = Array.isArray(items) ? items : [];
  if (!list.length) {
    el.dProviderJobs.innerHTML = `<div class="text-sm text-muted-foreground">No provider jobs linked.</div>`;
    return;
  }

  el.dProviderJobs.innerHTML = list
    .map((pj) => {
      const status = String(pj?.status || '');
      const resultUrl = pj?.resultUrl ? String(pj.resultUrl) : '';
      const external = pj?.externalJobId ? String(pj.externalJobId) : '';
      const header = `${pj?.provider || 'provider'} • ${status}`;
      const err = pj?.errorMessage || pj?.errorCode ? `${pj?.errorCode || ''} ${pj?.errorMessage || ''}`.trim() : '';
      return `
        <div class="rounded-ios-xl border border-border bg-background/40 p-3">
          <div class="flex items-center justify-between gap-3">
            <div class="font-semibold text-sm truncate">${escapeHtml(header)}</div>
            <button type="button" class="text-xs px-3 py-1 rounded-full bg-secondary hover:bg-secondary/80 font-semibold" data-copy="${escapeHtml(pj?.id || '')}">Copy id</button>
          </div>
          <div class="text-xs text-muted-foreground mt-1 font-mono break-all">${escapeHtml(external || pj?.id || '')}</div>
          ${resultUrl ? `<a href="${escapeHtml(resultUrl)}" target="_blank" rel="noreferrer" class="text-xs text-primary hover:underline mt-2 inline-block">Open result</a>` : ''}
          ${err ? `<div class="text-xs text-red-500 mt-2 whitespace-pre-wrap break-words">${escapeHtml(err)}</div>` : ''}
        </div>
      `;
    })
    .join('');

  el.dProviderJobs.querySelectorAll('button[data-copy]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = btn.getAttribute('data-copy');
      void copyText(id);
    });
  });
}

async function loadDetail(runId) {
  if (!runId) return;
  state.selectedRunId = runId;
  state.selectedDetail = null;

  openDrawer();
  setError('');
  if (el.drawerLoading) el.drawerLoading.classList.remove('hidden');
  if (el.drawerSubtitle) el.drawerSubtitle.textContent = runId;

  try {
    const { res, json } = await api(`https://aitopia.ai/api/admin/creations/${encodeURIComponent(runId)}`);
    if (!res.ok) {
      const msg = json?.error?.message || json?.error || `Request failed (${res.status})`;
      throw new Error(String(msg));
    }

    state.selectedDetail = json;

    const run = json?.run || {};
    const derived = json?.derived || {};
    const preview = derived?.preview || null;
    const prompt = derived?.prompt || '';

    if (el.dRunId) el.dRunId.textContent = run?.id || '—';
    if (el.dUserId) el.dUserId.textContent = run?.userId || '—';
    if (el.dAgentId) el.dAgentId.textContent = run?.agentId || '—';
    if (el.dStatus) el.dStatus.innerHTML = statusBadge(run?.status || '');
    if (el.dTraceId) el.dTraceId.textContent = run?.traceId || '—';
    if (el.dIdem) el.dIdem.textContent = run?.idempotencyKey || '—';
    if (el.drawerSubtitle) el.drawerSubtitle.textContent = `${run?.agentId || 'run'} • ${run?.userId || 'user'} • ${formatDateTime(run?.createdAt)}`;

    renderPreview(preview);
    if (el.dPrompt) el.dPrompt.textContent = prompt || '—';

    renderProviderJobs(json?.providerJobs);

    if (el.dRaw) {
      el.dRaw.textContent = JSON.stringify(json, null, 2);
    }
  } catch (err) {
    setError(err instanceof Error ? err.message : String(err));
  } finally {
    if (el.drawerLoading) el.drawerLoading.classList.add('hidden');
  }
}

function init() {
  updateKeyStatus();

  el.setKeyBtn?.addEventListener('click', async () => {
    const key = (window.prompt('Enter admin key (ADMIN_API_KEY):', getAdminKey() || '') || '').trim();
    if (key) setAdminKey(key);
  });

  el.clearKeyBtn?.addEventListener('click', () => clearAdminKey());

  el.refreshBtn?.addEventListener('click', () => void loadList({ resetOffset: false }));

  el.filtersForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    void loadList({ resetOffset: true });
  });

  el.resetBtn?.addEventListener('click', () => {
    if (el.qInput) el.qInput.value = '';
    if (el.userIdInput) el.userIdInput.value = '';
    if (el.agentIdInput) el.agentIdInput.value = '';
    if (el.providerInput) el.providerInput.value = '';
    if (el.modelIdInput) el.modelIdInput.value = '';
    if (el.statusInput) el.statusInput.value = '';
    if (el.fromInput) el.fromInput.value = '';
    if (el.toInput) el.toInput.value = '';
    if (el.hasErrorInput) el.hasErrorInput.checked = false;
    state.offset = 0;
    void loadList({ resetOffset: true });
  });

  el.prevBtn?.addEventListener('click', () => {
    state.offset = Math.max(0, state.offset - state.limit);
    void loadList({ resetOffset: false });
  });
  el.nextBtn?.addEventListener('click', () => {
    state.offset = state.offset + state.limit;
    void loadList({ resetOffset: false });
  });

  el.rows?.addEventListener('click', (e) => {
    const tr = e.target?.closest?.('tr[data-run-id]');
    if (!tr) return;
    const runId = tr.getAttribute('data-run-id');
    void loadDetail(runId);
  });

  el.drawerBackdrop?.addEventListener('click', closeDrawer);
  el.closeDrawerBtn?.addEventListener('click', closeDrawer);

  el.copyRunIdBtn?.addEventListener('click', () => void copyText(state.selectedRunId));
  el.copyPromptBtn?.addEventListener('click', () => void copyText(el.dPrompt?.textContent || ''));
  el.copyProviderJobsBtn?.addEventListener('click', () => void copyText(JSON.stringify(state.selectedDetail?.providerJobs ?? [], null, 2)));
  el.copyAllJsonBtn?.addEventListener('click', () => void copyText(JSON.stringify(state.selectedDetail ?? {}, null, 2)));

  void loadList({ resetOffset: true });
}

init();

