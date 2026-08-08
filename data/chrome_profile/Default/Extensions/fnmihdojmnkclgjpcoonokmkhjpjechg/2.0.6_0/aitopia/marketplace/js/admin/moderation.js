import { fetchHelper } from '../shared/fetch-helper.js';

const KEY_STORAGE = 'aitopia_admin_api_key';
const ADMIN_ID_STORAGE = 'aitopia_admin_operator_id';

const el = {
  setKeyBtn: document.getElementById('setKeyBtn'),
  setAdminIdBtn: document.getElementById('setAdminIdBtn'),
  refreshBtn: document.getElementById('refreshBtn'),
  keyStatus: document.getElementById('keyStatus'),
  adminIdStatus: document.getElementById('adminIdStatus'),
  errorBanner: document.getElementById('errorBanner'),
  filtersForm: document.getElementById('filtersForm'),
  qInput: document.getElementById('qInput'),
  statusInput: document.getElementById('statusInput'),
  visibilityInput: document.getElementById('visibilityInput'),
  aiInput: document.getElementById('aiInput'),
  reportsInput: document.getElementById('reportsInput'),
  resetBtn: document.getElementById('resetBtn'),
  bulkApproveBtn: document.getElementById('bulkApproveBtn'),
  bulkRejectBtn: document.getElementById('bulkRejectBtn'),
  summary: document.getElementById('summary'),
  cards: document.getElementById('cards'),
  emptyState: document.getElementById('emptyState'),
  presetBtns: Array.from(document.querySelectorAll('.presetBtn')),
  drawer: document.getElementById('drawer'),
  drawerBackdrop: document.getElementById('drawerBackdrop'),
  closeDrawerBtn: document.getElementById('closeDrawerBtn'),
  drawerSubtitle: document.getElementById('drawerSubtitle'),
  dPreview: document.getElementById('dPreview'),
  dOutputId: document.getElementById('dOutputId'),
  dCreator: document.getElementById('dCreator'),
  dVisibility: document.getElementById('dVisibility'),
  dModeration: document.getElementById('dModeration'),
  dAiOutcome: document.getElementById('dAiOutcome'),
  dReportsSummary: document.getElementById('dReportsSummary'),
  dPrompt: document.getElementById('dPrompt'),
  dReports: document.getElementById('dReports'),
  dReviews: document.getElementById('dReviews'),
  detailNoteInput: document.getElementById('detailNoteInput'),
  approveDetailBtn: document.getElementById('approveDetailBtn'),
  rejectDetailBtn: document.getElementById('rejectDetailBtn'),
};

const state = {
  adminKey: null,
  adminId: null,
  outputs: [],
  selectedIds: new Set(),
  activeOutputId: null,
  currentPreset: 'publicPending',
  loading: false,
  limit: 60,
  offset: 0,
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function badge(text, tone = 'neutral') {
  const base = 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold';
  if (tone === 'green') return `<span class="${base} bg-green-500/15 text-green-500">${escapeHtml(text)}</span>`;
  if (tone === 'red') return `<span class="${base} bg-red-500/15 text-red-500">${escapeHtml(text)}</span>`;
  if (tone === 'amber') return `<span class="${base} bg-amber-500/15 text-amber-500">${escapeHtml(text)}</span>`;
  return `<span class="${base} bg-secondary text-muted-foreground">${escapeHtml(text)}</span>`;
}

function getAdminKey() {
  return localStorage.getItem(KEY_STORAGE);
}

function getAdminId() {
  return localStorage.getItem(ADMIN_ID_STORAGE);
}

function setAdminKey(key) {
  if (!key) return;
  localStorage.setItem(KEY_STORAGE, key);
  state.adminKey = key;
  updateAuthStatus();
}

function setAdminId(adminId) {
  if (!adminId) {
    localStorage.removeItem(ADMIN_ID_STORAGE);
    state.adminId = null;
    updateAuthStatus();
    return;
  }
  localStorage.setItem(ADMIN_ID_STORAGE, adminId);
  state.adminId = adminId;
  updateAuthStatus();
}

function updateAuthStatus() {
  state.adminKey = state.adminKey || getAdminKey();
  state.adminId = state.adminId || getAdminId();
  if (el.keyStatus) {
    if (!state.adminKey) {
      el.keyStatus.textContent = 'No admin key set.';
    } else {
      const masked = `${state.adminKey.slice(0, 4)}...${state.adminKey.slice(-4)}`;
      el.keyStatus.textContent = `Admin key loaded (${masked}).`;
    }
  }
  if (el.adminIdStatus) {
    el.adminIdStatus.textContent = state.adminId
      ? `Operator label: ${state.adminId} (label only, not trusted identity).`
      : 'No operator label set.';
  }
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

async function ensureAdminKey() {
  let key = state.adminKey || getAdminKey();
  if (!key) {
    key = (window.prompt('Enter admin key (ADMIN_API_KEY):') || '').trim();
    if (key) setAdminKey(key);
  }
  return key;
}

function ensureAdminId() {
  let adminId = state.adminId || getAdminId();
  if (!adminId) {
    adminId = (window.prompt('Enter operator label for moderation actions:') || '').trim();
    if (adminId) setAdminId(adminId);
  }
  return adminId;
}

async function api(path, init = {}) {
  const key = await ensureAdminKey();
  if (!key) throw new Error('Admin key is required.');

  const headers = {
    'X-Tenant-Id': 'admin',
    'X-Admin-Key': key,
    ...(state.adminId ? { 'X-Admin-Id': state.adminId } : {}),
    ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    ...(init.headers || {}),
  };

  const res = await fetchHelper(path, {
    ...init,
    headers,
  });

  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(json?.error?.message || json?.error || `Request failed (${res.status})`);
  }
  return json;
}

function applyPreset(preset) {
  state.currentPreset = preset;
  if (preset === 'publicPending') {
    el.statusInput.value = 'pending';
    el.visibilityInput.value = 'public';
    el.aiInput.value = '';
    el.reportsInput.checked = false;
  } else if (preset === 'aiFlagged') {
    el.statusInput.value = '';
    el.visibilityInput.value = '';
    el.aiInput.value = 'flagged';
    el.reportsInput.checked = false;
  } else if (preset === 'privateMonitor') {
    el.statusInput.value = '';
    el.visibilityInput.value = 'private,unlisted';
    el.aiInput.value = '';
    el.reportsInput.checked = false;
  } else if (preset === 'reported') {
    el.statusInput.value = '';
    el.visibilityInput.value = '';
    el.aiInput.value = '';
    el.reportsInput.checked = true;
  }

  for (const btn of el.presetBtns) {
    const active = btn.dataset.preset === preset;
    btn.classList.toggle('bg-primary', active);
    btn.classList.toggle('text-primary-foreground', active);
    btn.classList.toggle('bg-secondary', !active);
    btn.classList.toggle('hover:bg-secondary/80', !active);
  }
}

function buildQuery() {
  const params = new URLSearchParams();
  params.set('limit', String(state.limit));
  params.set('offset', String(state.offset));
  const q = el.qInput.value.trim();
  if (q) params.set('q', q);
  if (el.statusInput.value) params.set('status', el.statusInput.value);
  if (el.visibilityInput.value) params.set('visibility', el.visibilityInput.value);
  if (el.aiInput.value) params.set('latestAiOutcome', el.aiInput.value);
  if (el.reportsInput.checked) params.set('hasReports', 'true');
  return params.toString();
}

function renderPreview(preview, title) {
  if (!preview) {
    return `<div class="w-full h-full min-h-[200px] flex items-center justify-center text-sm text-muted-foreground bg-background/40">No preview</div>`;
  }
  if (preview.kind === 'image') {
    return `<img src="${escapeHtml(preview.url)}" alt="${escapeHtml(title)}" class="w-full h-full object-cover" loading="lazy" />`;
  }
  if (preview.kind === 'video') {
    return `<video src="${escapeHtml(preview.url)}" class="w-full h-full object-cover" controls playsinline></video>`;
  }
  if (preview.kind === 'audio') {
    return `<div class="w-full min-h-[120px] flex items-center justify-center p-4"><audio src="${escapeHtml(preview.url)}" controls class="w-full"></audio></div>`;
  }
  return `<div class="w-full min-h-[120px] p-4 text-sm text-muted-foreground whitespace-pre-wrap">${escapeHtml(preview.text || '')}</div>`;
}

function renderCards() {
  const outputs = Array.isArray(state.outputs) ? state.outputs : [];
  el.cards.innerHTML = outputs.map((output, index) => {
    const selected = state.selectedIds.has(output.id);
    const active = state.activeOutputId === output.id;
    const title = output.title || output.prompt || 'Untitled output';
    const creator = output.creatorUsername || output.creatorUserId || 'unknown';
    const reportBadge = output.unresolvedReportCount > 0 ? badge(`${output.unresolvedReportCount} report${output.unresolvedReportCount === 1 ? '' : 's'}`, 'red') : '';
    const aiBadge =
      output.latestAiOutcome === 'flagged' ? badge('ai flagged', 'amber')
        : output.latestAiOutcome === 'unavailable' ? badge('ai unavailable', 'amber')
        : output.latestAiOutcome === 'clear' ? badge('ai clear', 'green')
        : badge('ai not_run', 'neutral');

    return `
      <article class="rounded-ios-2xl border ${active ? 'border-primary' : 'border-border'} bg-background/30 overflow-hidden shadow-sm" data-output-card="${escapeHtml(output.id)}" data-output-index="${index}">
        <button type="button" class="w-full text-left" data-open-detail="${escapeHtml(output.id)}">
          <div class="aspect-[4/3] bg-background/50 overflow-hidden">
            ${renderPreview(output.preview, title)}
          </div>
        </button>
        <div class="p-4">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h3 class="font-semibold text-sm line-clamp-2">${escapeHtml(title)}</h3>
              <div class="mt-1 text-xs text-muted-foreground truncate">${escapeHtml(creator)}</div>
            </div>
            <label class="shrink-0">
              <input type="checkbox" data-select-output="${escapeHtml(output.id)}" ${selected ? 'checked' : ''} />
            </label>
          </div>
          <div class="mt-3 flex flex-wrap gap-1.5">
            ${badge(output.visibility, output.visibility === 'public' ? 'green' : 'neutral')}
            ${badge(output.moderationStatus, output.moderationStatus === 'approved' ? 'green' : output.moderationStatus === 'rejected' ? 'red' : 'amber')}
            ${aiBadge}
            ${reportBadge}
          </div>
          ${output.latestReviewSummary ? `<div class="mt-3 text-xs text-muted-foreground line-clamp-3">${escapeHtml(output.latestReviewSummary)}</div>` : ''}
          <div class="mt-4 flex gap-2">
            <button type="button" class="flex-1 h-9 rounded-full bg-green-600 hover:bg-green-500 text-white text-xs font-semibold transition-colors" data-approve-output="${escapeHtml(output.id)}">Approve</button>
            <button type="button" class="flex-1 h-9 rounded-full bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors" data-reject-output="${escapeHtml(output.id)}">Reject</button>
          </div>
        </div>
      </article>
    `;
  }).join('');

  el.emptyState.classList.toggle('hidden', outputs.length > 0);
  el.summary.textContent = `${outputs.length} output${outputs.length === 1 ? '' : 's'} loaded.`;
}

async function loadOutputs() {
  state.loading = true;
  setError('');
  try {
    const data = await api(`https://aitopia.ai/api/admin/outputs?${buildQuery()}`);
    state.outputs = Array.isArray(data?.outputs) ? data.outputs : [];
    if (!state.activeOutputId && state.outputs[0]?.id) state.activeOutputId = state.outputs[0].id;
    renderCards();
  } catch (error) {
    setError(error instanceof Error ? error.message : String(error));
  } finally {
    state.loading = false;
  }
}

function closeDrawer() {
  el.drawer.classList.add('hidden');
}

function renderReports(reports) {
  if (!Array.isArray(reports) || reports.length === 0) {
    el.dReports.innerHTML = '<div class="text-sm text-muted-foreground">No unresolved reports.</div>';
    return;
  }
  el.dReports.innerHTML = reports.map((report) => {
    const detail = report.details ? ` - ${escapeHtml(report.details)}` : '';
    return `<div class="rounded-ios-xl border border-border bg-background/40 p-3"><strong>${escapeHtml(report.reason)}</strong>${detail}</div>`;
  }).join('');
}

function renderReviews(reviews) {
  if (!Array.isArray(reviews) || reviews.length === 0) {
    el.dReviews.innerHTML = '<div class="text-sm text-muted-foreground">No review history.</div>';
    return;
  }
  el.dReviews.innerHTML = reviews.map((review) => {
    const flags = Array.isArray(review.flags) && review.flags.length > 0
      ? `<div class="mt-2 flex flex-wrap gap-1.5">${review.flags.map((flag) => badge(`${flag.category}:${flag.severity}`, flag.severity === 'critical' ? 'red' : flag.severity === 'high' ? 'amber' : 'neutral')).join('')}</div>`
      : '';
    return `
      <div class="rounded-ios-xl border border-border bg-background/40 p-3">
        <div class="flex items-center justify-between gap-3">
          <div class="font-semibold text-sm">${escapeHtml(review.decision)}</div>
          <div class="text-xs text-muted-foreground">${escapeHtml(new Date(review.createdAt).toLocaleString())}</div>
        </div>
        <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(review.reviewerType)}${review.reviewerId ? ` - ${escapeHtml(review.reviewerId)}` : ''}</div>
        <div class="mt-2 text-sm">${escapeHtml(review.summary || '')}</div>
        ${flags}
      </div>
    `;
  }).join('');
}

async function openDetail(outputId) {
  setError('');
  try {
    const data = await api(`https://aitopia.ai/api/admin/outputs/${encodeURIComponent(outputId)}`);
    const output = data?.output;
    if (!output) throw new Error('Output detail not found.');
    state.activeOutputId = output.id;
    renderCards();

    el.drawer.classList.remove('hidden');
    el.drawerSubtitle.textContent = output.title || output.id;
    el.dPreview.innerHTML = renderPreview(output.preview, output.title || output.id);
    el.dOutputId.textContent = output.id || '-';
    el.dCreator.textContent = output.creatorUsername || output.creatorUserId || '-';
    el.dVisibility.textContent = output.visibility || '-';
    el.dModeration.textContent = output.moderationStatus || '-';
    el.dAiOutcome.textContent = output.latestAiOutcome || '-';
    el.dReportsSummary.textContent = `${Number(output.unresolvedReportCount || 0)} unresolved`;
    el.dPrompt.textContent = output.prompt || 'No prompt available.';
    renderReports(data?.reports);
    renderReviews(data?.reviews);
  } catch (error) {
    setError(error instanceof Error ? error.message : String(error));
  }
}

async function actOnOutput(outputId, action, notes) {
  await api(`https://aitopia.ai/api/admin/outputs/${encodeURIComponent(outputId)}/${action}`, {
    method: 'POST',
    body: JSON.stringify(notes ? { notes } : {}),
  });
  if (state.activeOutputId === outputId) {
    await openDetail(outputId).catch(() => closeDrawer());
  }
  await loadOutputs();
}

async function bulkAction(action) {
  const ids = Array.from(state.selectedIds);
  if (ids.length === 0) {
    setError('Select at least one output first.');
    return;
  }
  await api('https://aitopia.ai/api/admin/outputs/bulk', {
    method: 'POST',
    body: JSON.stringify({ ids, action }),
  });
  state.selectedIds.clear();
  await loadOutputs();
}

function toggleSelected(outputId) {
  if (state.selectedIds.has(outputId)) state.selectedIds.delete(outputId);
  else state.selectedIds.add(outputId);
  renderCards();
}

function moveActive(delta) {
  const outputs = state.outputs;
  if (!Array.isArray(outputs) || outputs.length === 0) return;
  const currentIndex = outputs.findIndex((item) => item.id === state.activeOutputId);
  const nextIndex = currentIndex < 0 ? 0 : Math.max(0, Math.min(outputs.length - 1, currentIndex + delta));
  state.activeOutputId = outputs[nextIndex].id;
  renderCards();
}

document.addEventListener('click', async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const openId = target.closest('[data-open-detail]')?.getAttribute('data-open-detail');
  if (openId) {
    await openDetail(openId);
    return;
  }

  const approveId = target.closest('[data-approve-output]')?.getAttribute('data-approve-output');
  if (approveId) {
    await actOnOutput(approveId, 'approve');
    return;
  }

  const rejectId = target.closest('[data-reject-output]')?.getAttribute('data-reject-output');
  if (rejectId) {
    await actOnOutput(rejectId, 'reject');
    return;
  }

  const selectId = target.closest('[data-select-output]')?.getAttribute('data-select-output');
  if (selectId && target.matches('input[type="checkbox"]')) {
    toggleSelected(selectId);
  }
});

document.addEventListener('keydown', async (event) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
  if (event.key === 'j') {
    event.preventDefault();
    moveActive(1);
  } else if (event.key === 'k') {
    event.preventDefault();
    moveActive(-1);
  } else if (event.key === ' ') {
    event.preventDefault();
    if (state.activeOutputId) toggleSelected(state.activeOutputId);
  } else if (event.key.toLowerCase() === 'a') {
    if (state.activeOutputId) await actOnOutput(state.activeOutputId, 'approve', el.detailNoteInput?.value?.trim());
  } else if (event.key.toLowerCase() === 'r') {
    if (state.activeOutputId) await actOnOutput(state.activeOutputId, 'reject', el.detailNoteInput?.value?.trim());
  } else if (event.key === 'Escape') {
    closeDrawer();
  }
});

el.setKeyBtn?.addEventListener('click', () => {
  const key = (window.prompt('Enter admin key (ADMIN_API_KEY):', state.adminKey || getAdminKey() || '') || '').trim();
  if (key) setAdminKey(key);
});

el.setAdminIdBtn?.addEventListener('click', () => {
  const adminId = (window.prompt('Enter operator label:', state.adminId || getAdminId() || '') || '').trim();
  setAdminId(adminId || null);
});

el.refreshBtn?.addEventListener('click', () => {
  loadOutputs();
});

el.filtersForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  await loadOutputs();
});

el.resetBtn?.addEventListener('click', async () => {
  el.qInput.value = '';
  applyPreset('publicPending');
  await loadOutputs();
});

for (const btn of el.presetBtns) {
  btn.addEventListener('click', async () => {
    applyPreset(btn.dataset.preset || 'publicPending');
    await loadOutputs();
  });
}

el.bulkApproveBtn?.addEventListener('click', async () => {
  await bulkAction('approve');
});

el.bulkRejectBtn?.addEventListener('click', async () => {
  await bulkAction('reject');
});

el.drawerBackdrop?.addEventListener('click', closeDrawer);
el.closeDrawerBtn?.addEventListener('click', closeDrawer);
el.approveDetailBtn?.addEventListener('click', async () => {
  if (state.activeOutputId) await actOnOutput(state.activeOutputId, 'approve', el.detailNoteInput?.value?.trim());
});
el.rejectDetailBtn?.addEventListener('click', async () => {
  if (state.activeOutputId) await actOnOutput(state.activeOutputId, 'reject', el.detailNoteInput?.value?.trim());
});

updateAuthStatus();
applyPreset('publicPending');
loadOutputs();
