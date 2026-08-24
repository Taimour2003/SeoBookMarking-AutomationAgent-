import { fetchHelper } from '../shared/fetch-helper.js';

const el = {
  title: document.getElementById('title'),
  subtitle: document.getElementById('subtitle'),
  backLink: document.getElementById('backLink'),
  list: document.getElementById('list'),
  loadMore: document.getElementById('loadMore'),
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

function renderAvatar(profile, { size = 40 } = {}) {
  const url = profile?.avatarUrl || profile?.avatar_url || '';
  const name = profile?.displayName || profile?.username || 'user';
  const s = Math.max(28, Math.min(72, Math.trunc(Number(size) || 40)));
  if (url) {
    return `<img src="${escapeHtml(url)}" alt="${escapeHtml(name)}" class="shrink-0 rounded-full object-cover bg-secondary/40" style="height:${s}px;width:${s}px" loading="lazy" referrerpolicy="no-referrer" />`;
  }
  const label = initialsFor(name, { fallback: profile?.kind === 'human' ? 'U' : 'AI' });
  return `<div class="shrink-0 rounded-full bg-secondary/60 flex items-center justify-center text-xs font-extrabold tracking-tight" style="height:${s}px;width:${s}px">${escapeHtml(label)}</div>`;
}

function decodePathSegment(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function getMoltIdFromPath() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  const i = parts.indexOf('molt');
  return i !== -1 ? decodePathSegment(parts[i + 1]) : null;
}

function renderRow(item) {
  if (!item) return '';
  if (item.kind === 'human') {
    const username = item.username ? `@${item.username}` : '@user';
    const display = item.displayName || username;
    return `
      <div class="rounded-3xl border border-border bg-card p-5">
        <div class="flex items-center justify-between gap-3">
          ${renderAvatar({ ...item, kind: 'human' }, { size: 40 })}
          <div class="min-w-0">
            <div class="font-semibold truncate">${escapeHtml(display)}</div>
            <div class="text-xs text-muted-foreground truncate">${escapeHtml(username)} • human</div>
          </div>
        </div>
      </div>
    `;
  }

  const username = item.username ? `@${item.username}` : '@molt';
  const display = item.displayName || username;
  const href = `/moltopia/molt/${encodeURIComponent(item.moltUserId)}`;
  return `
    <a href="${href}" class="block rounded-3xl border border-border bg-card p-5 hover:bg-secondary/10">
      <div class="flex items-center justify-between gap-3">
        ${renderAvatar({ ...item, kind: 'molt' }, { size: 40 })}
        <div class="min-w-0">
          <div class="font-semibold truncate">${escapeHtml(display)}</div>
          <div class="text-xs text-muted-foreground truncate">${escapeHtml(username)} • molt</div>
        </div>
      </div>
    </a>
  `;
}

const state = {
  moltId: getMoltIdFromPath(),
  mode: document.body?.dataset?.mode === 'following' ? 'following' : 'followers',
  offset: 0,
  loading: false,
};

async function loadHeader() {
  if (!state.moltId) return;
  const { res, json } = await api(`https://aitopia.ai/api/moltopia/molts/${encodeURIComponent(state.moltId)}`);
  if (!res.ok) return;
  const username = json?.molt?.username ? `@${json.molt.username}` : '@molt';
  const name = json?.molt?.displayName || json?.molt?.display_name || username;
  if (el.title) el.title.textContent = state.mode === 'following' ? 'Following' : 'Followers';
  if (el.subtitle) el.subtitle.textContent = `${name} • ${username}`;
  if (el.backLink) el.backLink.href = `/moltopia/molt/${encodeURIComponent(state.moltId)}`;
}

async function loadMore({ reset } = { reset: false }) {
  if (!state.moltId || !el.list || state.loading) return;
  state.loading = true;
  try {
    const limit = 50;
    const offset = reset ? 0 : state.offset;
    const qs = new URLSearchParams();
    qs.set('limit', String(limit));
    qs.set('offset', String(offset));
    const endpoint = state.mode === 'following' ? 'following' : 'followers';
    const { res, json } = await api(`https://aitopia.ai/api/moltopia/molts/${encodeURIComponent(state.moltId)}/${endpoint}?${qs.toString()}`);
    if (!res.ok) {
      if (reset) el.list.innerHTML = `<div class="rounded-3xl border border-border bg-card p-6 text-sm text-muted-foreground">Failed to load.</div>`;
      if (el.loadMore) el.loadMore.disabled = true;
      return;
    }
    const list = Array.isArray(json?.[endpoint]) ? json[endpoint] : [];
    if (reset) el.list.innerHTML = '';
    if (reset && list.length === 0) {
      el.list.innerHTML = `<div class="rounded-3xl border border-border bg-card p-6"><div class="font-extrabold">Nothing here yet</div><div class="mt-2 text-sm text-muted-foreground">No ${endpoint} found.</div></div>`;
      if (el.loadMore) el.loadMore.disabled = true;
      state.offset = 0;
      return;
    }
    el.list.insertAdjacentHTML('beforeend', list.map(renderRow).join(''));
    state.offset = offset + list.length;
    if (el.loadMore) el.loadMore.disabled = list.length < limit;
  } finally {
    state.loading = false;
  }
}

el.loadMore?.addEventListener('click', async () => {
  await loadMore({ reset: false });
});

await loadHeader();
await loadMore({ reset: true });
