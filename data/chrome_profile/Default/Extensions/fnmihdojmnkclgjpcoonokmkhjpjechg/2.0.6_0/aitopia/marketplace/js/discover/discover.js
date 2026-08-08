import { fetchHelper } from '../shared/fetch-helper.js';

const el = {
  tabAll: document.getElementById('tabAll'),
  tabCreations: document.getElementById('tabCreations'),
  tabRemixes: document.getElementById('tabRemixes'),
  sortTrending: document.getElementById('sortTrending'),
  sortNew: document.getElementById('sortNew'),
  searchInput: document.getElementById('searchInput'),
  tagInput: document.getElementById('tagInput'),
  notice: document.getElementById('notice'),
  grid: document.getElementById('grid'),
  scrollSentinel: document.getElementById('scrollSentinel'),
  endState: document.getElementById('endState'),
  emptyState: document.getElementById('emptyState'),
  loadMore: document.getElementById('loadMore'),
};

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatRelativeTime(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';

  const now = Date.now();
  const diffMs = now - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

function setNotice(message, tone = 'info') {
  if (!el.notice) return;
  if (!message) {
    el.notice.classList.add('hidden');
    el.notice.textContent = '';
    return;
  }
  el.notice.classList.remove('hidden');
  el.notice.classList.toggle('text-red-500', tone === 'error');
  el.notice.classList.toggle('text-muted-foreground', tone !== 'error');
  el.notice.textContent = message;
}

function setActiveTab(tab) {
  const on = (btn) => {
    btn.classList.add('bg-background', 'shadow-sm');
    btn.classList.remove('text-muted-foreground');
  };
  const off = (btn) => {
    btn.classList.remove('bg-background', 'shadow-sm');
    btn.classList.add('text-muted-foreground');
  };

  if (tab === 'creations') {
    off(el.tabAll);
    on(el.tabCreations);
    off(el.tabRemixes);
    return;
  }
  if (tab === 'remixes') {
    off(el.tabAll);
    off(el.tabCreations);
    on(el.tabRemixes);
    return;
  }
  on(el.tabAll);
  off(el.tabCreations);
  off(el.tabRemixes);
}

function setActiveSort(sort) {
  const on = (btn) => {
    btn.classList.add('bg-background', 'shadow-sm');
    btn.classList.remove('text-muted-foreground');
  };
  const off = (btn) => {
    btn.classList.remove('bg-background', 'shadow-sm');
    btn.classList.add('text-muted-foreground');
  };

  if (sort === 'new') {
    off(el.sortTrending);
    on(el.sortNew);
    return;
  }

  on(el.sortTrending);
  off(el.sortNew);
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

async function api(path) {
  const res = await fetchHelper(path, { method: 'GET', headers: { Accept: 'application/json' }, credentials: 'include' });
  const json = await readJson(res);
  return { res, json };
}

function renderCard(output) {
  const id = String(output?.id || '');
  if (!id) return '';

  const previewKind = output?.preview?.kind;
  const previewUrl = typeof output?.preview?.url === 'string' ? output.preview.url : '';
  const title = String(output?.title || 'Creation');
  const viewHref = `/creations/${encodeURIComponent(id)}`;
  const sourceStoreId = String(output?.sourceStoreId || output?.agentId || '');
  const remixHref = `/aitopia/marketplace/agent/${encodeURIComponent(sourceStoreId)}.html?remixOutputId=${encodeURIComponent(id)}`;
  const remixCount = Number(output?.remixCount ?? 0);
  const likeCount = Number(output?.likeCount ?? 0);
  const commentCount = Number(output?.commentCount ?? 0);

  const media =
    previewKind === 'image' && previewUrl
      ? `<img src="${escapeHtml(previewUrl)}" alt="${escapeHtml(title)}" class="w-full h-full object-cover" loading="lazy" />`
      : `<div class="w-full h-full flex items-center justify-center text-2xl text-muted-foreground">${
          previewKind === 'video' ? '🎬' : previewKind === 'audio' ? '🎧' : '🎨'
        }</div>`;

  const overlay = `
    <div class="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:flex flex-col items-center justify-center gap-3">
      <div class="flex items-center gap-5 text-white text-sm font-semibold">
        <span title="Likes">❤️ ${Number.isFinite(likeCount) ? likeCount : 0}</span>
        <span title="Comments">💬 ${Number.isFinite(commentCount) ? commentCount : 0}</span>
        <span title="Remixes">🎨 ${Number.isFinite(remixCount) ? remixCount : 0}</span>
      </div>
      <a href="${remixHref}" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary/90 hover:bg-primary text-primary-foreground text-xs font-semibold transition-colors" class="stop-propagation">
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
          <path d="M12 22.75C6.07 22.75 1.25 17.93 1.25 12C1.25 6.07 6.07 1.25 12 1.25C17.93 1.25 22.75 6.07 22.75 12C22.75 17.93 17.93 22.75 12 22.75ZM12 2.75C6.9 2.75 2.75 6.9 2.75 12C2.75 17.1 6.9 21.25 12 21.25C17.1 21.25 21.25 17.1 21.25 12C21.25 6.9 17.1 2.75 12 2.75Z" fill="currentColor"/>
          <path d="M12.0014 17.4701C10.6014 17.4701 9.20141 16.9401 8.13141 15.8701C7.85141 15.5901 7.6014 15.2801 7.3714 14.9101C7.1514 14.5601 7.26139 14.1001 7.61139 13.8801C7.96139 13.6601 8.42142 13.7701 8.64142 14.1201C8.81142 14.4001 8.99141 14.6201 9.19141 14.8201C10.7414 16.3701 13.2614 16.3701 14.8114 14.8201C15.4114 14.2201 15.7914 13.4401 15.9214 12.5701C15.9814 12.1601 16.3614 11.8601 16.7714 11.9301C17.1814 11.9901 17.4614 12.3701 17.4114 12.7801C17.2414 13.9701 16.7114 15.0401 15.8814 15.8801C14.8014 16.9401 13.4014 17.4701 12.0014 17.4701Z" fill="currentColor"/>
          <path d="M7.3399 12.0801C7.2999 12.0801 7.26991 12.0801 7.22991 12.0701C6.81991 12.0101 6.5299 11.6301 6.5899 11.2201C6.7599 10.0301 7.2899 8.96008 8.1199 8.12008C10.2499 5.99008 13.7199 5.99008 15.8599 8.12008C16.1399 8.40008 16.3899 8.71011 16.6199 9.09011C16.8399 9.44011 16.7299 9.90008 16.3799 10.1201C16.0299 10.3401 15.5699 10.2301 15.3499 9.88009C15.1799 9.61009 14.9999 9.38008 14.7999 9.18008C13.2499 7.63008 10.7299 7.63008 9.17989 9.18008C8.57989 9.78008 8.19991 10.5601 8.06991 11.4301C8.02991 11.8101 7.7099 12.0801 7.3399 12.0801Z" fill="currentColor"/>
          <path d="M7.82031 17.9297C7.41031 17.9297 7.07031 17.5897 7.07031 17.1797V14.5098C7.07031 14.0998 7.41031 13.7598 7.82031 13.7598H10.4903C10.9003 13.7598 11.2403 14.0998 11.2403 14.5098C11.2403 14.9198 10.9003 15.2598 10.4903 15.2598H8.57031V17.1797C8.57031 17.5897 8.24031 17.9297 7.82031 17.9297Z" fill="currentColor"/>
          <path d="M16.1778 10.2403H13.5078C13.0978 10.2403 12.7578 9.9003 12.7578 9.4903C12.7578 9.0803 13.0978 8.7403 13.5078 8.7403H15.4278V6.82031C15.4278 6.41031 15.7678 6.07031 16.1778 6.07031C16.5878 6.07031 16.9278 6.41031 16.9278 6.82031V9.4903C16.9278 9.9103 16.5878 10.2403 16.1778 10.2403Z" fill="currentColor"/>
        </svg>
        Remix
      </a>
    </div>
  `;

  return `
    <a href="${viewHref}" class="relative block aspect-square overflow-hidden group hover:opacity-95 transition-opacity" aria-label="${escapeHtml(title)}">
      ${media}
      ${overlay}
    </a>
  `;
}

function renderGrid(outputs) {
  if (!el.grid) return;
  el.grid.innerHTML = outputs.map(renderCard).join('');
  if (el.emptyState) el.emptyState.classList.toggle('hidden', outputs.length > 0);
}

const state = {
  type: 'all',
  sort: 'trending',
  cursor: null,
  loading: false,
  outputs: [],
  debounceTimer: null,
};

function buildQuery({ append }) {
  const qs = new URLSearchParams();
  qs.set('type', state.type);
  qs.set('sort', state.sort);
  const q = (el.searchInput?.value || '').trim();
  const tag = (el.tagInput?.value || '').trim();
  if (q) qs.set('q', q);
  if (tag) qs.set('tag', tag);
  qs.set('limit', '30');
  if (append && state.cursor) qs.set('cursor', state.cursor);
  return qs.toString();
}

async function load({ append } = { append: false }) {
  if (state.loading) return;
  if (append && !state.cursor) return;
  state.loading = true;
  setNotice('');

  if (!append) {
    state.cursor = null;
    state.outputs = [];
    if (el.grid) {
      el.grid.innerHTML = Array.from({ length: 15 })
        .map(() => '<div data-skeleton="1" class="aspect-square skeleton"></div>')
        .join('');
    }
    if (el.emptyState) el.emptyState.classList.add('hidden');
    if (el.loadMore) el.loadMore.classList.add('hidden');
    if (el.endState) el.endState.classList.add('hidden');
  } else if (el.grid) {
    el.grid.insertAdjacentHTML(
      'beforeend',
      Array.from({ length: 9 })
        .map(() => '<div data-skeleton="1" class="aspect-square skeleton"></div>')
        .join(''),
    );
  }

  const { res, json } = await api(`https://aitopia.ai/api/discover?${buildQuery({ append })}`);
  el.grid?.querySelectorAll?.('[data-skeleton="1"]')?.forEach?.((node) => node.remove());
  if (!res.ok) {
    const msg = json?.error?.message || json?.error || `Failed to load (${res.status})`;
    setNotice(String(msg), 'error');
    state.loading = false;
    return;
  }

  const outputs = Array.isArray(json?.outputs) ? json.outputs : [];
  state.outputs = append ? state.outputs.concat(outputs) : outputs;
  state.cursor = json?.nextCursor || null;

  renderGrid(state.outputs);
  if (el.loadMore) el.loadMore.classList.toggle('hidden', !state.cursor);
  if (el.endState) el.endState.classList.toggle('hidden', Boolean(state.cursor) || state.outputs.length === 0);

  state.loading = false;
}

function scheduleReload() {
  if (state.debounceTimer) clearTimeout(state.debounceTimer);
  state.debounceTimer = setTimeout(() => void load({ append: false }), 250);
}

function init() {
  setActiveTab('all');
  setActiveSort('trending');

  el.tabAll?.addEventListener('click', () => {
    state.type = 'all';
    setActiveTab('all');
    void load({ append: false });
  });
  el.tabCreations?.addEventListener('click', () => {
    state.type = 'creations';
    setActiveTab('creations');
    void load({ append: false });
  });
  el.tabRemixes?.addEventListener('click', () => {
    state.type = 'remixes';
    setActiveTab('remixes');
    void load({ append: false });
  });

  el.sortTrending?.addEventListener('click', () => {
    state.sort = 'trending';
    setActiveSort('trending');
    void load({ append: false });
  });
  el.sortNew?.addEventListener('click', () => {
    state.sort = 'new';
    setActiveSort('new');
    void load({ append: false });
  });

  el.loadMore?.addEventListener('click', () => void load({ append: true }));
  el.searchInput?.addEventListener('input', scheduleReload);
  el.tagInput?.addEventListener('input', scheduleReload);

  if (el.scrollSentinel && 'IntersectionObserver' in window) {
    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries?.[0]?.isIntersecting) return;
        if (state.loading) return;
        if (!state.cursor) return;
        void load({ append: true });
      },
      { rootMargin: '300px 0px' },
    );
    obs.observe(el.scrollSentinel);
  }

  void load({ append: false });
}

init();
