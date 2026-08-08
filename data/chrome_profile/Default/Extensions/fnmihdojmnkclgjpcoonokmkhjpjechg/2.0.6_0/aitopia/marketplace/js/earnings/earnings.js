import { fetchHelper } from '../shared/fetch-helper.js';

const el = {
  authRequired: document.getElementById('authRequired'),
  content: document.getElementById('content'),
  creditsAllTime: document.getElementById('creditsAllTime'),
  creditsToday: document.getElementById('creditsToday'),
  entriesCount: document.getElementById('entriesCount'),
  entries: document.getElementById('entries'),
  empty: document.getElementById('empty'),
  refreshBtn: document.getElementById('refreshBtn'),
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

function formatDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
}

function renderEntry(entry) {
  const credits = Number(entry?.credits) || 0;
  const reason = entry?.reason || entry?.type || 'earnings';
  const createdAt = entry?.createdAt || '';
  const source = entry?.sourceId || entry?.sourceOutputId || entry?.sourceStoreId || '';

  return `
    <div class="p-4 flex items-start justify-between gap-4">
      <div class="min-w-0">
        <div class="font-semibold truncate">${escapeHtml(reason)}</div>
        <div class="text-xs text-muted-foreground mt-1 truncate">${escapeHtml(source)}</div>
        <div class="text-xs text-muted-foreground mt-1">${escapeHtml(formatDate(createdAt))}</div>
      </div>
      <div class="shrink-0 font-bold text-green-500">+${escapeHtml(String(credits))}</div>
    </div>
  `;
}

async function load() {
  const res = await fetchHelper('https://aitopia.ai/api/earnings/me', { method: 'GET', headers: { Accept: 'application/json' } });
  const json = await readJson(res);

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      el.authRequired?.classList.remove('hidden');
      el.content?.classList.add('hidden');
      return;
    }
    const msg = json?.error?.message || json?.error || `Failed to load earnings (${res.status})`;
    el.authRequired?.classList.remove('hidden');
    el.content?.classList.add('hidden');
    if (el.authRequired) {
      el.authRequired.querySelector('p')?.append?.(` (${String(msg)})`);
    }
    return;
  }

  el.authRequired?.classList.add('hidden');
  el.content?.classList.remove('hidden');

  const totals = json?.totals || {};
  const creditsAllTime = Number(totals.creditsAllTime) || 0;
  const creditsToday = Number(totals.creditsToday) || 0;
  const entries = Array.isArray(json?.entries) ? json.entries : [];

  if (el.creditsAllTime) el.creditsAllTime.textContent = creditsAllTime.toLocaleString();
  if (el.creditsToday) el.creditsToday.textContent = creditsToday.toLocaleString();
  if (el.entriesCount) el.entriesCount.textContent = entries.length.toLocaleString();

  if (el.entries) {
    el.entries.innerHTML = entries.map(renderEntry).join('');
  }
  if (el.empty) {
    el.empty.classList.toggle('hidden', entries.length > 0);
  }
}

el.refreshBtn?.addEventListener('click', () => void load());
void load();

