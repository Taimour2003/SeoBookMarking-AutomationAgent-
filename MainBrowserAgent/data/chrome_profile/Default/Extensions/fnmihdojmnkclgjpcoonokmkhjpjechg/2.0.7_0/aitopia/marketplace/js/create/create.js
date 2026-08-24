import { fetchHelper } from '../shared/fetch-helper.js';

const el = {
  search: document.getElementById('templateSearch'),
  grid: document.getElementById('templatesGrid'),
  empty: document.getElementById('templatesEmpty'),
  result: document.getElementById('createResult'),
};

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function readJson(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text };
  }
}

function badge(text) {
  return `<span class="px-2 py-0.5 rounded-full bg-secondary text-[11px] font-semibold text-muted-foreground">${escapeHtml(text)}</span>`;
}

function renderTemplateCard(tpl) {
  const id = String(tpl?.id || '');
  const name = tpl?.name || id;
  const desc = tpl?.description || '';
  const type = tpl?.type || '';
  const style = tpl?.style || '';

  return `
    <div class="rounded-ios-2xl border border-border bg-card p-6 hover:border-primary/40 transition-colors flex flex-col">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="text-lg font-semibold truncate">${escapeHtml(name)}</div>
          <div class="mt-1 text-sm text-muted-foreground line-clamp-3">${escapeHtml(desc)}</div>
        </div>
      </div>

      <div class="mt-4 flex flex-wrap gap-2">
        ${type ? badge(type) : ''}
        ${style ? badge(style) : ''}
        ${tpl?.templateVersion ? badge(`v${tpl.templateVersion}`) : ''}
      </div>

      <div class="mt-6 flex items-center gap-2">
        <button
          type="button"
          class="flex-1 h-11 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          data-create-template="${escapeHtml(id)}"
        >
          Use template
        </button>
        <a
          href="/aitopia/marketplace/app-studio.html"
          class="h-11 px-5 inline-flex items-center justify-center rounded-full bg-secondary hover:bg-secondary/80 text-sm font-semibold transition-colors"
          title="Open the full builder"
        >
          Studio
        </a>
      </div>
    </div>
  `;
}

function render(templates) {
  const q = (el.search?.value || '').trim().toLowerCase();
  const filtered = q
    ? templates.filter((t) => {
      const hay = `${t?.name || ''} ${t?.description || ''} ${t?.type || ''} ${t?.style || ''}`.toLowerCase();
      return hay.includes(q);
    })
    : templates;

  if (el.grid) el.grid.innerHTML = filtered.map(renderTemplateCard).join('');
  if (el.empty) el.empty.classList.toggle('hidden', filtered.length > 0);
}

async function loadTemplates() {
  const res = await fetchHelper('https://aitopia.ai/api/apps/templates', { method: 'GET', headers: { Accept: 'application/json' } });
  const json = await readJson(res);
  if (!res.ok) {
    const msg = json?.error?.message || json?.error || `Failed to load templates (${res.status})`;
    if (el.grid) el.grid.innerHTML = `<div class="col-span-full text-sm text-red-500">${escapeHtml(String(msg))}</div>`;
    return [];
  }
  return Array.isArray(json?.templates) ? json.templates : [];
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function showResultCard(payload) {
  if (!el.result) return;
  el.result.classList.remove('hidden');

  const appId = payload?.app?.id || '';
  const storeId = appId ? `app:${appId}` : '';

  el.result.innerHTML = `
    <h2 class="text-lg font-semibold">Created</h2>
    <div class="mt-3 text-sm text-muted-foreground">Your agent is created as an AppCore app (private by default).</div>

    <div class="mt-4 rounded-ios-xl border border-border bg-background/40 p-4">
      <div class="text-xs text-muted-foreground">App ID</div>
      <div class="mt-1 font-mono text-sm break-all">${escapeHtml(appId)}</div>
      <div class="mt-3 text-xs text-muted-foreground">Store ID</div>
      <div class="mt-1 font-mono text-sm break-all">${escapeHtml(storeId)}</div>
      <div class="mt-4 flex gap-2">
        <button id="copyAppId" type="button" class="h-10 px-4 rounded-full bg-secondary hover:bg-secondary/80 text-sm font-semibold transition-colors">Copy</button>
        <a href="/aitopia/marketplace/app-runner.html?appId=${encodeURIComponent(appId)}" class="h-10 px-4 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">Generate</a>
      </div>
    </div>

    <div class="mt-4 text-sm text-muted-foreground">
      Want to edit advanced workflows? Open <a class="text-primary hover:underline" href="/aitopia/marketplace/app-studio.html">App Studio</a> and select your app from the list.
    </div>
  `;

  const copyBtn = document.getElementById('copyAppId');
  copyBtn?.addEventListener('click', async () => {
    const ok = await copyToClipboard(appId);
    if (!ok) return;
    copyBtn.textContent = 'Copied';
    setTimeout(() => (copyBtn.textContent = 'Copy'), 1200);
  });
}

function openCreateModal(template) {
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-[100] bg-black/60 flex items-center justify-center';

  const nameDefault = String(template?.name || '');
  const descDefault = String(template?.description || '');
  const templateId = String(template?.id || '');

  overlay.innerHTML = `
    <div class="bg-card border border-border rounded-ios-2xl shadow-2xl w-full max-w-lg mx-4 p-6">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h2 class="text-lg font-semibold">Create from template</h2>
          <p class="text-sm text-muted-foreground mt-1">${escapeHtml(nameDefault)}</p>
        </div>
        <button type="button" data-close class="p-2 rounded-ios-lg hover:bg-secondary transition-colors" aria-label="Close">
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </div>

      <div class="mt-5 space-y-4">
        <div>
          <label class="block text-sm font-medium mb-1">Name</label>
          <input data-name type="text" class="w-full text-sm bg-secondary/80 border-0 rounded-ios-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20" value="${escapeHtml(nameDefault)}" />
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Description</label>
          <textarea data-description class="w-full text-sm bg-secondary/80 border-0 rounded-ios-lg px-3 py-2 h-24 focus:outline-none focus:ring-2 focus:ring-primary/20">${escapeHtml(descDefault)}</textarea>
        </div>
        <div class="text-xs text-muted-foreground">
          Created apps are private by default. You can publish later from App Studio.
        </div>
        <div data-error class="hidden text-sm text-red-500"></div>
      </div>

      <div class="mt-6 flex gap-3">
        <button type="button" data-close class="flex-1 h-11 rounded-full bg-secondary hover:bg-secondary/80 text-sm font-semibold">Cancel</button>
        <button type="button" data-create class="flex-1 h-11 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold">Create</button>
      </div>
    </div>
  `;

  const modal = overlay.firstElementChild;
  const nameEl = modal.querySelector('[data-name]');
  const descEl = modal.querySelector('[data-description]');
  const errorEl = modal.querySelector('[data-error]');
  const createBtn = modal.querySelector('[data-create]');

  const close = () => overlay.remove();
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  modal.querySelectorAll('[data-close]').forEach((btn) => btn.addEventListener('click', close));

  const showError = (msg) => {
    if (!errorEl) return;
    errorEl.textContent = msg;
    errorEl.classList.remove('hidden');
  };
  const clearError = () => {
    if (!errorEl) return;
    errorEl.textContent = '';
    errorEl.classList.add('hidden');
  };

  createBtn?.addEventListener('click', async () => {
    clearError();
    if (createBtn) createBtn.disabled = true;
    try {
      const name = String(nameEl?.value || '').trim();
      const description = String(descEl?.value || '').trim();
      if (!name) {
        showError('Name is required.');
        return;
      }

      const res = await fetchHelper(`https://aitopia.ai/api/apps/templates/${encodeURIComponent(templateId)}/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, ...(description ? { description } : {}), visibility: 'private', reason: 'ui:create' }),
      });
      const json = await readJson(res);

      if (!res.ok) {
        const msg = json?.error?.message || json?.error || `Create failed (${res.status})`;
        showError(String(msg));
        return;
      }

      close();
      showResultCard(json);
    } catch (e) {
      showError(e?.message || 'Create failed.');
    } finally {
      if (createBtn) createBtn.disabled = false;
    }
  });

  document.body.appendChild(overlay);
}

let templates = [];

async function init() {
  templates = await loadTemplates();
  render(templates);

  el.search?.addEventListener('input', () => render(templates));

  document.addEventListener('click', (e) => {
    const btn = e.target?.closest?.('[data-create-template]');
    const templateId = btn?.getAttribute?.('data-create-template');
    if (!templateId) return;
    const tpl = templates.find((t) => String(t.id) === String(templateId));
    if (!tpl) return;
    openCreateModal(tpl);
  });
}

void init();
