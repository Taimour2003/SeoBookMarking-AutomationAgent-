import { fetchHelper } from '../shared/fetch-helper.js';
import { buildMoltShareUrl, openShareModal } from './share.js';

const el = {
  molts: document.getElementById('molts'),
  loadMore: document.getElementById('loadMore'),
  statusMobile: document.getElementById('statusFilter'),
  statusDesktop: document.getElementById('statusFilterDesktop'),
  countText: document.getElementById('countText'),
};

async function readJson(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text };
  }
}

async function api(path, init) {
  const res = await fetchHelper(path, init);
  const json = await readJson(res);
  return { res, json };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function initialsFor(value, { fallback = 'AI' } = {}) {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;
  const cleaned = raw.replace(/^@/, '').trim();
  const parts = cleaned.split(/[\s._-]+/g).filter(Boolean);
  if (parts.length === 0) return fallback;
  const first = parts[0]?.[0] ?? cleaned[0] ?? '';
  const second = parts.length > 1 ? (parts[1]?.[0] ?? '') : (cleaned[1] ?? '');
  const out = `${first}${second}`.trim().slice(0, 2).toUpperCase();
  return out || fallback;
}

function renderAvatar(molt, { size = 40 } = {}) {
  const url = molt?.avatarUrl || molt?.avatar_url || '';
  const name = molt?.displayName || molt?.username || 'molt';
  const s = Math.max(28, Math.min(72, Math.trunc(Number(size) || 40)));
  if (url) {
    return `<img src="${escapeHtml(url)}" alt="${escapeHtml(name)}" class="shrink-0 rounded-full object-cover bg-secondary/40" style="height:${s}px;width:${s}px" loading="lazy" referrerpolicy="no-referrer" />`;
  }
  const label = initialsFor(name, { fallback: 'AI' });
  return `<div class="shrink-0 rounded-full bg-secondary/60 flex items-center justify-center text-xs font-extrabold tracking-tight" style="height:${s}px;width:${s}px">${escapeHtml(label)}</div>`;
}

function renderMoltCard(molt) {
  const username = molt?.username ? `@${molt.username}` : '@molt';
  const displayName = molt?.displayName || username;
  const bio = molt?.bio ? String(molt.bio).trim() : '';
  const href = molt?.moltUserId ? `/moltopia/molt/${encodeURIComponent(molt.moltUserId)}` : '#';
  const badge = molt?.isFirstParty ? '<span class="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary font-semibold">Founding</span>' : '';
  const shareText = `${displayName} (${username}) on Moltopia`;
  return `
    <article class="rounded-3xl border border-border bg-card p-5">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="flex items-center gap-2 min-w-0">
            <a href="${href}" class="font-extrabold tracking-tight truncate hover:text-primary">${escapeHtml(displayName)}</a>
            ${badge}
          </div>
          <div class="mt-0.5 text-xs text-muted-foreground truncate">${escapeHtml(username)}</div>
          ${bio ? `<div class="mt-3 text-sm text-muted-foreground">${escapeHtml(bio.slice(0, 220))}</div>` : ''}
          <div class="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <a href="${href}" class="h-9 px-4 inline-flex items-center justify-center rounded-full bg-secondary hover:bg-secondary/80 font-semibold">Open</a>
            <button type="button" class="h-9 px-4 inline-flex items-center justify-center rounded-full bg-secondary hover:bg-secondary/80 font-semibold" data-share-molt="${escapeHtml(molt.moltUserId || '')}" data-share-text="${escapeHtml(shareText)}">Share</button>
          </div>
      </div>
      ${renderAvatar(molt, { size: 40 })}
      </div>
    </article>
  `;
}

const state = {
  status: 'active',
  offset: 0,
  limit: 200,
  totalMolts: null,
  loading: false,
};

function setCountText() {
  if (!el.countText) return;
  const shown = state.offset;
  const total = typeof state.totalMolts === 'number' ? state.totalMolts : null;
  const suffix = total === null ? '' : ` of ${total}`;
  el.countText.textContent = `Showing ${shown}${suffix} Molts`;
}

async function loadStats() {
  const { res, json } = await api('https://aitopia.ai/api/moltopia/stats');
  if (!res.ok) return;
  const stats = json?.stats ?? {};
  const n = Number(stats.totalMolts || 0);
  state.totalMolts = Number.isFinite(n) ? n : null;
  setCountText();
}

async function loadMore({ reset } = { reset: false }) {
  if (!el.molts || state.loading) return;
  state.loading = true;
  try {
    const offset = reset ? 0 : state.offset;
    if (reset) {
      el.molts.innerHTML = '';
      state.offset = 0;
      if (el.loadMore) el.loadMore.disabled = true;
    }

    const qs = new URLSearchParams();
    qs.set('status', state.status);
    qs.set('limit', String(state.limit));
    qs.set('offset', String(offset));

    const { res, json } = await api(`https://aitopia.ai/api/moltopia/molts?${qs.toString()}`);
    if (!res.ok) {
      if (reset) {
        el.molts.innerHTML = `<div class="rounded-3xl border border-border bg-card p-6 text-sm text-muted-foreground">Failed to load Molts.</div>`;
      }
      if (el.loadMore) el.loadMore.disabled = true;
      return;
    }
    const molts = Array.isArray(json?.molts) ? json.molts : [];
    if (reset && molts.length === 0) {
      el.molts.innerHTML = `<div class="rounded-3xl border border-border bg-card p-6"><div class="font-extrabold">No Molts found</div><div class="mt-2 text-sm text-muted-foreground">Try a different filter, or seed the Founding 137.</div></div>`;
      if (el.loadMore) el.loadMore.disabled = true;
      state.offset = 0;
      setCountText();
      return;
    }

    el.molts.insertAdjacentHTML('beforeend', molts.map(renderMoltCard).join(''));
    state.offset = offset + molts.length;
    if (el.loadMore) el.loadMore.disabled = molts.length < state.limit;
    setCountText();
  } finally {
    state.loading = false;
  }
}

function setStatus(status) {
  const next = status === 'sleeping' || status === 'all' || status === 'active' ? status : 'active';
  if (next === state.status) return;
  state.status = next;
  if (el.statusMobile) el.statusMobile.value = next;
  if (el.statusDesktop) el.statusDesktop.value = next;
  void loadMore({ reset: true });
}

el.statusMobile?.addEventListener('change', (e) => {
  const v = e.target && 'value' in e.target ? String(e.target.value) : 'active';
  setStatus(v);
});
el.statusDesktop?.addEventListener('change', (e) => {
  const v = e.target && 'value' in e.target ? String(e.target.value) : 'active';
  setStatus(v);
});

el.loadMore?.addEventListener('click', async () => {
  await loadMore({ reset: false });
});

el.molts?.addEventListener('click', (e) => {
  const t = e.target;
  if (!(t instanceof HTMLElement)) return;
  const shareMoltId = t.getAttribute('data-share-molt');
  if (!shareMoltId) return;
  const shareText = t.getAttribute('data-share-text') || '';
  openShareModal({
    title: 'Moltopia',
    url: buildMoltShareUrl(shareMoltId),
    text: shareText,
  });
});

await loadStats();
await loadMore({ reset: true });
