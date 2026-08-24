import { fetchHelper } from '../shared/fetch-helper.js';
import { openShareModal } from '../moltopia/share.js';

const el = {
  notice: document.getElementById('notice'),
  list: document.getElementById('list'),
  emptyState: document.getElementById('emptyState'),
  loadMore: document.getElementById('loadMore'),
  scrollSentinel: document.getElementById('scrollSentinel'),
  endState: document.getElementById('endState'),
};

function escapeHtml(value) {
  return String(value ?? '')
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
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 30) return `${days}d`;
  return date.toLocaleDateString();
}

function formatCount(value) {
  const n = Math.max(0, Math.trunc(Number(value) || 0));
  if (n >= 1_000_000) return `${Math.round(n / 100_000) / 10}M`;
  if (n >= 10_000) return `${Math.round(n / 100) / 10}K`;
  if (n >= 1_000) return `${Math.round(n / 10) / 100}K`;
  return String(n);
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

function renderSkeletonPost() {
  return `
    <article class="px-4 py-4 bg-background">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-full skeleton"></div>
        <div class="flex-1">
          <div class="h-3 w-28 rounded skeleton"></div>
          <div class="mt-2 h-2 w-16 rounded skeleton"></div>
        </div>
      </div>
      <div class="mt-3 w-full aspect-square sm:aspect-[4/3] bg-secondary/60 skeleton rounded-ios-xl"></div>
      <div class="mt-3 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="w-11 h-11 rounded-full bg-secondary/60 skeleton"></div>
          <div class="w-11 h-11 rounded-full bg-secondary/60 skeleton"></div>
          <div class="w-11 h-11 rounded-full bg-secondary/60 skeleton"></div>
        </div>
        <div class="w-11 h-11 rounded-full bg-secondary/60 skeleton"></div>
      </div>
      <div class="mt-2 h-3 w-24 rounded skeleton"></div>
      <div class="mt-2 h-3 w-64 rounded skeleton"></div>
    </article>
  `;
}

function renderSkeletonList(count = 3) {
  const n = Math.max(1, Math.min(6, Math.trunc(Number(count) || 3)));
  return Array.from({ length: n }).map(renderSkeletonPost).join('');
}

function buildMadeWithLine(sourceStoreId) {
  const raw = typeof sourceStoreId === 'string' ? sourceStoreId.trim() : '';
  if (!raw || raw === 'unknown') return '';
  const href = `/aitopia/marketplace/agent/${encodeURIComponent(raw)}.html`;
  return `
    <div class="mt-1 text-xs text-muted-foreground">
      Made with <a class="text-foreground/80 hover:underline" href="${href}">${escapeHtml(raw)}</a>
    </div>
  `;
}

function renderPost(item) {
  const output = item?.output || {};
  const actor = item?.actor || output?.actor || null;

  const outputId = String(output?.id || item?.id || '');
  if (!outputId) return '';

  const viewHref = `/creations/${encodeURIComponent(outputId)}`;
  const remixHref = `${viewHref}/remix`;

  const createdAt = item?.createdAt || output?.createdAt || '';
  const time = formatRelativeTime(createdAt);

  const usernameRaw = actor?.username ? String(actor.username) : '';
  const usernameLabel = usernameRaw ? `@${usernameRaw}` : 'Unknown';
  const profileHref = usernameRaw ? `/u/${encodeURIComponent(usernameRaw)}` : '#';
  const avatarUrl = actor?.avatarUrl ? String(actor.avatarUrl) : '';
  const avatar = avatarUrl
    ? `<img src="${escapeHtml(avatarUrl)}" class="w-9 h-9 rounded-full object-cover" alt="" loading="lazy" />`
    : `<div class="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-muted-foreground">@</div>`;

  const title = String(output?.title || 'Untitled');
  const description = String(output?.description || '').trim();

  const previewKind = output?.preview?.kind;
  const previewUrl = typeof output?.preview?.url === 'string' ? output.preview.url : '';

  const media =
    previewKind === 'image' && previewUrl
      ? `
        <a href="${viewHref}" class="block bg-black/5 dark:bg-white/5">
          <img src="${escapeHtml(previewUrl)}" alt="" class="w-full h-auto" loading="lazy" />
        </a>
      `
      : previewKind === 'video' && previewUrl
        ? `
          <a href="${viewHref}" class="block bg-black/5 dark:bg-white/5">
            <video src="${escapeHtml(previewUrl)}" class="w-full h-auto" muted playsinline preload="metadata" controls></video>
          </a>
        `
        : `
          <a href="${viewHref}" class="block bg-gradient-to-br from-primary/90/15 via-indigo-600/10 to-fuchsia-600/15">
            <div class="w-full aspect-square sm:aspect-[4/3] flex items-center justify-center text-4xl">
              ${previewKind === 'audio' ? '🎧' : '🎨'}
            </div>
          </a>
        `;

  const liked = Boolean(output?.viewerHasLiked);
  const likeCount = Number(output?.likeCount ?? 0);
  const commentCount = Number(output?.commentCount ?? 0);

  const caption = description ? `${title} — ${description}` : title;
  const captionShort = caption.length > 240 ? `${caption.slice(0, 239)}…` : caption;

  return `
    <article data-output-id="${escapeHtml(outputId)}" class="bg-background">
      <header class="px-4 pt-4 pb-3 flex items-center justify-between gap-3">
        <a href="${profileHref}" class="flex items-center gap-3 min-w-0">
          ${avatar}
          <div class="min-w-0">
            <div class="text-sm font-semibold truncate">${escapeHtml(usernameLabel)}</div>
            <div class="text-[11px] text-muted-foreground">${escapeHtml(time)}</div>
          </div>
        </a>
        <a href="${viewHref}" class="text-[11px] text-muted-foreground hover:text-foreground transition-colors">View</a>
      </header>

      ${media}

      <div class="px-4 pt-2 pb-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1">
            <button type="button" data-action="like" class="social-tap inline-flex items-center justify-center rounded-full hover:bg-secondary/60 transition-colors ${liked ? 'text-red-500' : ''}" aria-label="Like" aria-pressed="${liked ? 'true' : 'false'}">
              <span data-like-icon aria-hidden="true" class="text-[22px] leading-none">${liked ? '♥' : '♡'}</span>
            </button>
            <a href="${viewHref}#comments" class="social-tap inline-flex items-center justify-center rounded-full hover:bg-secondary/60 transition-colors" aria-label="Comment">
              <span aria-hidden="true" class="text-[20px] leading-none">💬</span>
            </a>
            <button type="button" data-action="share" class="social-tap inline-flex items-center justify-center rounded-full hover:bg-secondary/60 transition-colors" aria-label="Share">
              <span aria-hidden="true" class="text-[18px] leading-none">↗</span>
            </button>
          </div>
          <a href="${remixHref}" class="social-tap inline-flex items-center justify-center rounded-full hover:bg-secondary/60 transition-colors text-primary" aria-label="Remix">
            <span aria-hidden="true" class="text-[18px] leading-none">🎨</span>
          </a>
        </div>

        <div class="mt-1 text-sm font-semibold" data-like-summary>${escapeHtml(formatCount(likeCount))} likes</div>
        <div class="mt-1 text-sm">
          <a href="${profileHref}" class="font-semibold hover:underline">${escapeHtml(usernameLabel)}</a>
          <span class="ml-1 text-foreground/90">${escapeHtml(captionShort)}</span>
        </div>
        ${buildMadeWithLine(output?.sourceStoreId)}
        ${
          Number.isFinite(commentCount) && commentCount > 0
            ? `<a href="${viewHref}#comments" class="mt-1 inline-block text-xs text-muted-foreground hover:underline">View all ${escapeHtml(
                String(commentCount)
              )} comments</a>`
            : ''
        }
      </div>
    </article>
  `;
}

function upsertStateFromItems(items) {
  const list = Array.isArray(items) ? items : [];
  for (const it of list) {
    const output = it?.output;
    const id = output?.id ? String(output.id) : it?.id ? String(it.id) : '';
    if (!id) continue;
    state.byId.set(id, { item: it, output });
  }
}

function renderItems(items, { append }) {
  if (!el.list) return;
  const list = Array.isArray(items) ? items : [];

  if (!append) {
    el.list.innerHTML = list.map(renderPost).join('');
    return;
  }

  const html = list.map(renderPost).join('');
  el.list.insertAdjacentHTML('beforeend', html);
}

const state = {
  cursor: null,
  loading: false,
  items: [],
  byId: new Map(),
  observer: null,
};

async function load({ append } = { append: false }) {
  if (state.loading) return;
  state.loading = true;
  setNotice('');
  if (el.endState) el.endState.classList.add('hidden');

  if (!append) {
    state.cursor = null;
    state.items = [];
    state.byId = new Map();
    if (el.list) el.list.innerHTML = renderSkeletonList(3);
    if (el.emptyState) el.emptyState.classList.add('hidden');
    if (el.loadMore) el.loadMore.classList.add('hidden');
  }

  const qs = new URLSearchParams();
  qs.set('limit', '30');
  if (append && state.cursor) qs.set('cursor', state.cursor);

  const { res, json } = await api(`https://aitopia.ai/api/feed?${qs.toString()}`);
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      setNotice('Sign in to view your feed.', 'error');
      if (el.list) el.list.innerHTML = '';
      if (el.emptyState) el.emptyState.classList.remove('hidden');
      state.loading = false;
      return;
    }
    const msg = json?.error?.message || json?.error || `Failed to load feed (${res.status})`;
    setNotice(String(msg), 'error');
    if (!append && el.list) el.list.innerHTML = '';
    state.loading = false;
    return;
  }

  const items = Array.isArray(json?.items) ? json.items : [];
  const nextCursor = json?.nextCursor || null;

  state.items = append ? state.items.concat(items) : items;
  state.cursor = nextCursor;
  upsertStateFromItems(items);

  if (!append) {
    renderItems(state.items, { append: false });
  } else {
    renderItems(items, { append: true });
  }

  if (el.emptyState) el.emptyState.classList.toggle('hidden', state.items.length > 0);
  if (el.loadMore) el.loadMore.classList.toggle('hidden', !state.cursor);
  if (el.endState) el.endState.classList.toggle('hidden', Boolean(state.cursor) || state.items.length === 0);

  state.loading = false;
}

async function toggleLikeFromEl(btn) {
  const article = btn?.closest?.('article[data-output-id]');
  const outputId = article?.getAttribute?.('data-output-id') || '';
  if (!outputId) return;

  const entry = state.byId.get(outputId);
  const output = entry?.output || {};

  btn.disabled = true;
  setNotice('');

  const liked = Boolean(output?.viewerHasLiked);
  const method = liked ? 'DELETE' : 'POST';

  const res = await fetchHelper(`https://aitopia.ai/api/outputs/${encodeURIComponent(outputId)}/like`, {
    method,
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  const json = await readJson(res);

  if (!res.ok) {
    const msg = json?.error?.message || json?.error || (res.status === 401 ? 'Sign in to like creations.' : `Failed to like (${res.status})`);
    setNotice(String(msg), 'error');
    btn.disabled = false;
    return;
  }

  const nextLiked = Boolean(json?.liked);
  const nextCount = Number(json?.likeCount ?? output?.likeCount ?? 0);

  const nextOutput = { ...output, viewerHasLiked: nextLiked, likeCount: nextCount };
  state.byId.set(outputId, { ...(entry || {}), output: nextOutput });

  btn.classList.toggle('text-red-500', nextLiked);
  btn.setAttribute('aria-pressed', nextLiked ? 'true' : 'false');
  const icon = article?.querySelector?.('[data-like-icon]');
  if (icon) icon.textContent = nextLiked ? '♥' : '♡';

  const summary = article?.querySelector?.('[data-like-summary]');
  if (summary) summary.textContent = `${formatCount(nextCount)} likes`;

  btn.disabled = false;
}

function shareFromEl(btn) {
  const article = btn?.closest?.('article[data-output-id]');
  const outputId = article?.getAttribute?.('data-output-id') || '';
  if (!outputId) return;

  const entry = state.byId.get(outputId);
  const output = entry?.output || {};
  const actor = entry?.item?.actor || output?.actor || null;

  const url = `${window.location.origin}/creations/${encodeURIComponent(outputId)}`;
  const remixUrl = `${url}/remix`;
  const title = String(output?.title || 'Creation').trim() || 'Creation';
  const creator = actor?.username ? `@${String(actor.username)}` : 'AITOPIA';
  const text = `${title} by ${creator}`;

  openShareModal({
    title: 'AITOPIA',
    url,
    text,
    extraUrl: remixUrl,
    extraLabel: 'Copy remix link',
  });
}

function initInteractions() {
  el.list?.addEventListener('click', (e) => {
    const target = e.target instanceof Element ? e.target : null;
    if (!target) return;

    const likeBtn = target.closest?.('[data-action="like"]');
    if (likeBtn instanceof HTMLButtonElement) {
      void toggleLikeFromEl(likeBtn);
      return;
    }

    const shareBtn = target.closest?.('[data-action="share"]');
    if (shareBtn instanceof HTMLButtonElement) {
      shareFromEl(shareBtn);
      return;
    }
  });
}

function initInfiniteScroll() {
  if (!el.scrollSentinel) return;
  if (typeof IntersectionObserver !== 'function') return;

  state.observer?.disconnect?.();
  state.observer = new IntersectionObserver(
    (entries) => {
      const first = entries?.[0];
      if (!first?.isIntersecting) return;
      if (!state.cursor || state.loading) return;
      void load({ append: true });
    },
    { rootMargin: '800px' }
  );

  state.observer.observe(el.scrollSentinel);
}

function init() {
  initInteractions();
  initInfiniteScroll();
  el.loadMore?.addEventListener('click', () => void load({ append: true }));
  void load({ append: false });
}

init();

