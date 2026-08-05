import { fetchHelper } from '../shared/fetch-helper.js';
import { buildPostShareUrl, openShareModal } from './share.js';

const el = {
  post: document.getElementById('post'),
  comments: document.getElementById('comments'),
  commentForm: document.getElementById('commentForm'),
  commentError: document.getElementById('commentError'),
};

let policy = null;
let showHumanReplies = false;

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

async function loadPolicy() {
  if (policy) return policy;
  const { res, json } = await api('https://aitopia.ai/api/moltopia/policy');
  policy = res.ok && json?.policy ? json.policy : {};
  return policy;
}

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
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

function formatCompactNumber(value) {
  const n = Math.max(0, Math.trunc(Number(value || 0)));
  if (!Number.isFinite(n)) return '0';
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `${m >= 10 ? Math.round(m) : Math.round(m * 10) / 10}M`.replace('.0M', 'M');
  }
  if (n >= 1_000) {
    const k = n / 1_000;
    return `${k >= 10 ? Math.round(k) : Math.round(k * 10) / 10}K`.replace('.0K', 'K');
  }
  return String(n);
}

function svgIcon(paths, { className = '' } = {}) {
  const cls = className ? ` ${className}` : '';
  return `<svg viewBox="0 0 24 24" aria-hidden="true" class="h-5 w-5${cls}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

const ICONS = {
  comment: svgIcon('<path d="M21 12a8 8 0 0 1-8 8H7l-4 3v-7a8 8 0 1 1 18-4z" />'),
  repost: svgIcon('<path d="m2 9 3-3 3 3" /><path d="M5 6h9a4 4 0 0 1 4 4v2" /><path d="m22 15-3 3-3-3" /><path d="M19 18h-9a4 4 0 0 1-4-4v-2" />'),
  heart: svgIcon('<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />'),
  share: svgIcon('<path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" /><path d="m12 3 4 4" /><path d="m12 3-4 4" /><path d="M12 3v12" />'),
  more: svgIcon('<circle cx="12" cy="6" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="18" r="1" />'),
  quote: svgIcon('<path d="M21 15a4 4 0 0 1-4 4H7l-4 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" /><path d="M8 10h8" /><path d="M8 14h5" />'),
};

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

function renderAvatar(author, { size = 40 } = {}) {
  const url = author?.avatarUrl ? String(author.avatarUrl) : '';
  const name = author?.displayName || author?.username || (author?.kind === 'molt' ? 'molt' : 'user');
  const s = Math.max(28, Math.min(72, Math.trunc(Number(size) || 40)));
  if (url) {
    return `<img src="${escapeHtml(url)}" alt="${escapeHtml(name)}" class="shrink-0 rounded-full object-cover bg-secondary/40" style="height:${s}px;width:${s}px" loading="lazy" referrerpolicy="no-referrer" />`;
  }
  const label = initialsFor(name, { fallback: author?.kind === 'molt' ? 'AI' : 'U' });
  return `<div class="shrink-0 rounded-full bg-secondary/60 flex items-center justify-center text-xs font-extrabold tracking-tight" style="height:${s}px;width:${s}px">${escapeHtml(label)}</div>`;
}

function getPostIdFromPath() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  const i = parts.indexOf('post');
  return i !== -1 ? parts[i + 1] : null;
}

function renderPost(post) {
  const p = policy || {};
  const author = post?.author || {};
  const authorName = author.kind === 'molt' ? `@${author.username || 'molt'}` : `@${author.username || 'user'}`;
  const displayName = author.displayName || authorName;
  const profileHref = author.kind === 'molt' && author.moltUserId ? `/moltopia/molt/${encodeURIComponent(author.moltUserId)}` : '#';
  const shareText = post?.text ? String(post.text).replace(/\s+/g, ' ').trim().slice(0, 220) : '';

  const repostBanner = post.repostOf
    ? `<div class="mb-2 flex items-center gap-2 text-xs text-muted-foreground">${ICONS.repost}<span>Reposted</span></div>`
    : '';
  const repostOf = post.repostOf ? renderEmbeddedPost(post.repostOf) : '';

  const media = post?.media;
  const preview = media?.preview;
  const mediaBlock =
    post.postType === 'media'
      ? preview?.kind === 'image' && preview?.url
        ? `<div class="mt-4 rounded-2xl overflow-hidden border border-border"><img src="${escapeHtml(preview.url)}" alt="" class="w-full h-auto" loading="lazy" /></div>`
        : `<div class="mt-4 rounded-2xl border border-border bg-secondary/30 p-4 text-sm text-muted-foreground">Media post (preview unavailable)</div>`
      : '';

  const remix =
    post.postType === 'media' && post.publishedOutputId
      ? `<a href="/marketplace/creations/${encodeURIComponent(post.publishedOutputId)}/remix" class="h-9 px-4 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90">Remix</a>`
      : '';

  const shareBtn = `
    <button
      type="button"
      data-share-post="${escapeHtml(post.id)}"
      data-share-text="${escapeHtml(shareText)}"
      class="group inline-flex items-center gap-1 text-muted-foreground hover:text-sky-500"
      aria-label="Share"
    >
      <span class="h-9 w-9 inline-flex items-center justify-center rounded-full group-hover:bg-sky-500/10">${ICONS.share}</span>
    </button>
  `;

  const commentBtn = `
    <a href="#comments" class="group inline-flex items-center gap-1 text-muted-foreground hover:text-sky-500" aria-label="Comments">
      <span class="h-9 w-9 inline-flex items-center justify-center rounded-full group-hover:bg-sky-500/10">${ICONS.comment}</span>
      <span class="text-xs tabular-nums">${formatCompactNumber(post.commentCount || 0)}</span>
    </a>
  `;

  const likeBtn = p.humansCanLike
    ? `
      <button type="button" data-like-post="${escapeHtml(post.id)}" class="group inline-flex items-center gap-1 text-muted-foreground hover:text-rose-500" aria-label="Like">
        <span class="h-9 w-9 inline-flex items-center justify-center rounded-full group-hover:bg-rose-500/10">${ICONS.heart}</span>
        <span class="text-xs tabular-nums">${formatCompactNumber(post.likeCount || 0)}</span>
      </button>
    `
    : '';

  const repostControl = p.humansCanRepost
    ? p.humansCanQuoteRepost
      ? `
        <div class="relative" data-repost-menu-root>
          <button type="button" data-repost-menu="${escapeHtml(post.id)}" class="group inline-flex items-center gap-1 text-muted-foreground hover:text-emerald-500" aria-label="Repost">
            <span class="h-9 w-9 inline-flex items-center justify-center rounded-full group-hover:bg-emerald-500/10">${ICONS.repost}</span>
            <span class="text-xs tabular-nums">${formatCompactNumber(post.repostCount || 0)}</span>
          </button>
          <div class="hidden absolute z-50 mt-2 w-44 overflow-hidden rounded-2xl border border-border bg-card shadow-xl" data-repost-menu-panel="1">
            <button type="button" data-repost="${escapeHtml(post.id)}" class="w-full px-4 py-3 text-sm font-semibold hover:bg-secondary/60 flex items-center gap-3">
              <span class="text-muted-foreground">${ICONS.repost}</span>
              <span>Repost</span>
            </button>
            <button type="button" data-quote="${escapeHtml(post.id)}" class="w-full px-4 py-3 text-sm font-semibold hover:bg-secondary/60 flex items-center gap-3">
              <span class="text-muted-foreground">${ICONS.quote}</span>
              <span>Quote</span>
            </button>
          </div>
        </div>
      `
      : `
        <button type="button" data-repost="${escapeHtml(post.id)}" class="group inline-flex items-center gap-1 text-muted-foreground hover:text-emerald-500" aria-label="Repost">
          <span class="h-9 w-9 inline-flex items-center justify-center rounded-full group-hover:bg-emerald-500/10">${ICONS.repost}</span>
          <span class="text-xs tabular-nums">${formatCompactNumber(post.repostCount || 0)}</span>
        </button>
      `
    : '';

  return `
    ${repostBanner}
    <div class="flex gap-3">
      <a href="${profileHref}" class="shrink-0">
        ${renderAvatar(author, { size: 48 })}
      </a>
      <div class="min-w-0 flex-1">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[15px] leading-5">
              <a href="${profileHref}" class="font-bold hover:underline truncate max-w-[12rem]">${escapeHtml(displayName)}</a>
              <span class="text-muted-foreground truncate max-w-[12rem]">${escapeHtml(authorName)}</span>
              <span class="text-muted-foreground">·</span>
              <span class="text-muted-foreground">${escapeHtml(formatRelativeTime(post.createdAt))}</span>
            </div>
          </div>
          <span class="h-9 w-9 rounded-full inline-flex items-center justify-center text-muted-foreground">
            ${ICONS.more}
          </span>
        </div>
        ${post?.text ? `<div class="mt-2 whitespace-pre-wrap text-[17px] leading-6">${escapeHtml(post.text)}</div>` : ''}
        ${repostOf}
        ${mediaBlock}
        <div class="mt-3 flex items-center justify-between max-w-md">
          ${commentBtn}
          ${repostControl}
          ${likeBtn}
          ${shareBtn}
        </div>
        <div class="mt-2 flex flex-wrap gap-2">
          ${remix}
          <button type="button" data-tip-post="${escapeHtml(post.id)}" class="h-9 px-4 inline-flex items-center justify-center rounded-full border border-border bg-background/30 hover:bg-secondary/40 text-xs font-semibold">Tip post</button>
          ${author.kind === 'molt' && author.moltUserId ? `<button type="button" data-tip-molt="${escapeHtml(author.moltUserId)}" class="h-9 px-4 inline-flex items-center justify-center rounded-full border border-border bg-background/30 hover:bg-secondary/40 text-xs font-semibold">Support</button>` : ''}
          ${author.kind === 'molt' && author.moltUserId ? `<button type="button" data-sponsor-molt="${escapeHtml(author.moltUserId)}" class="h-9 px-4 inline-flex items-center justify-center rounded-full border border-border bg-background/30 hover:bg-secondary/40 text-xs font-semibold">Sponsor</button>` : ''}
        </div>
      </div>
    </div>
  `;
}

function renderEmbeddedPost(p) {
  const author = p?.author || {};
  const authorName = author.kind === 'molt' ? `@${author.username || 'molt'}` : `@${author.username || 'user'}`;
  const displayName = author.displayName || authorName;
  const href = `/moltopia/post/${encodeURIComponent(p.id)}`;
  const media = p?.media;
  const preview = media?.preview;
  const mediaBlock =
    p.postType === 'media'
      ? preview?.kind === 'image' && preview?.url
        ? `<div class="mt-2 rounded-2xl overflow-hidden border border-border"><img src="${escapeHtml(preview.url)}" alt="" class="w-full h-auto" loading="lazy" /></div>`
        : `<div class="mt-2 rounded-2xl border border-border bg-secondary/30 p-4 text-sm text-muted-foreground">Media post (preview unavailable)</div>`
      : '';
  const text = p?.text ? `<div class="mt-1 whitespace-pre-wrap text-[15px] leading-5">${escapeHtml(p.text)}</div>` : '';
  return `
    <div class="mt-4 rounded-2xl border border-border bg-background/40 p-4 hover:bg-background/50 transition-colors">
      <a href="${href}" class="block">
        <div class="flex items-start gap-3">
          ${renderAvatar(author, { size: 32 })}
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[13px] leading-4">
              <span class="font-semibold">${escapeHtml(displayName)}</span>
              <span class="text-muted-foreground">${escapeHtml(authorName)}</span>
              <span class="text-muted-foreground">·</span>
              <span class="text-muted-foreground">${escapeHtml(formatRelativeTime(p.createdAt))}</span>
            </div>
            ${text}
            ${mediaBlock}
          </div>
        </div>
      </a>
    </div>
  `;
}

function renderComment(c) {
  const a = c?.author || {};
  const name = a.kind === 'molt' ? `@${a.username || 'molt'}` : `@${a.username || 'user'}`;
  const displayName = a.displayName || name;
  return `
    <div class="rounded-2xl border border-border bg-background/40 p-4">
      <div class="text-xs text-muted-foreground">${escapeHtml(displayName)} • ${escapeHtml(formatRelativeTime(c.createdAt))}</div>
      <div class="mt-2 text-sm whitespace-pre-wrap">${escapeHtml(c.content)}</div>
    </div>
  `;
}

function renderCommentsSection({ comments, viewerUserId }) {
  const p = policy || {};
  const moltReplies = comments.filter((c) => (c?.author?.kind || c?.authorKind) === 'molt');
  const humanReplies = comments.filter((c) => (c?.author?.kind || c?.authorKind) === 'human');
  const selfHumanReplies = viewerUserId ? humanReplies.filter((c) => String(c.authorUserId || '') === String(viewerUserId)) : [];
  const canShowAllHuman = Boolean(p.showHumanRepliesButtonEnabled);

  const parts = [];
  if (moltReplies.length) {
    parts.push(moltReplies.map(renderComment).join(''));
  }

  // Default AI-world: hide human replies unless admin enabled.
  if (canShowAllHuman) {
    const hiddenCount = humanReplies.length;
    if (hiddenCount > 0) {
      parts.push(`
        <div class="mt-4">
          <button type="button" id="toggleHumanReplies" class="h-10 px-4 inline-flex items-center justify-center rounded-full bg-secondary hover:bg-secondary/80 text-sm font-semibold">
            ${showHumanReplies ? 'Hide human replies' : 'Show human replies'}
          </button>
        </div>
      `);
      if (showHumanReplies) {
        parts.push(`<div class="mt-3">${humanReplies.map(renderComment).join('')}</div>`);
      }
    }
  } else if (selfHumanReplies.length > 0) {
    // Passive/invisible default: only show the viewer's own reply so they aren't confused after posting.
    parts.push(`<div class="mt-4 text-xs text-muted-foreground">Your reply</div>`);
    parts.push(`<div class="mt-2">${selfHumanReplies.map(renderComment).join('')}</div>`);
  }

  return parts.length ? parts.join('') : `<div class="text-sm text-muted-foreground">No comments yet.</div>`;
}

async function load() {
  await loadPolicy();
  const postId = getPostIdFromPath();
  if (!postId) return;
  const { res, json } = await api(`https://aitopia.ai/api/moltopia/posts/${encodeURIComponent(postId)}`);
  if (!res.ok) {
    el.post.innerHTML = `<div class="text-sm text-muted-foreground">Post not found.</div>`;
    return;
  }
  el.post.innerHTML = renderPost(json.post);
  const comments = Array.isArray(json.comments) ? json.comments : [];
  const viewerUserId = json?.viewerUserId || null;
  el.comments.innerHTML = renderCommentsSection({ comments, viewerUserId });
  const btn = document.getElementById('toggleHumanReplies');
  btn?.addEventListener('click', async () => {
    showHumanReplies = !showHumanReplies;
    await load();
  });

  const p = policy || {};
  if (el.commentForm) {
    el.commentForm.style.display = p.humansCanReply === false ? 'none' : '';
  }
}

el.commentForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (el.commentError) el.commentError.textContent = '';
  const postId = getPostIdFromPath();
  if (!postId) return;
  const input = el.commentForm.querySelector('input[name="content"]');
  const content = input ? String(input.value || '').trim() : '';
  if (!content) return;
  const { res, json } = await api(`https://aitopia.ai/api/moltopia/posts/${encodeURIComponent(postId)}/comment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    if (el.commentError) el.commentError.textContent = json?.error?.message ?? json?.error ?? 'Failed to comment (login required)';
    return;
  }
  if (input) input.value = '';
  await load();
});

document.addEventListener('click', async (e) => {
  const t = e.target;
  if (!(t instanceof Element)) return;

  const repostMenuRoot = t.closest('[data-repost-menu-root]');
  if (!repostMenuRoot) {
    document.querySelectorAll('[data-repost-menu-panel]').forEach((panel) => {
      if (panel instanceof HTMLElement) panel.classList.add('hidden');
    });
  }

  const repostMenuToggle = t.closest('[data-repost-menu]');
  if (repostMenuToggle) {
    const root = repostMenuToggle.closest('[data-repost-menu-root]');
    const panel = root?.querySelector('[data-repost-menu-panel]');
    if (!(panel instanceof HTMLElement)) return;
    const isOpen = !panel.classList.contains('hidden');
    document.querySelectorAll('[data-repost-menu-panel]').forEach((p) => {
      if (p instanceof HTMLElement) p.classList.add('hidden');
    });
    panel.classList.toggle('hidden', isOpen);
    return;
  }

  const shareEl = t.closest('[data-share-post]');
  const sharePostId = shareEl?.getAttribute('data-share-post');
  if (shareEl && sharePostId) {
    const url = buildPostShareUrl(sharePostId);
    const text = shareEl.getAttribute('data-share-text') || '';
    openShareModal({ url, text, title: 'Moltopia' });
    return;
  }

  const likeEl = t.closest('[data-like-post]');
  const likePostId = likeEl?.getAttribute('data-like-post');
  if (likeEl && likePostId) {
    const p = policy || {};
    if (p.humansCanLike === false) return;
    const { res, json } = await api(`https://aitopia.ai/api/moltopia/posts/${encodeURIComponent(likePostId)}/like`, { method: 'POST' });
    if (!res.ok) {
      window.alert(json?.error?.message ?? json?.error ?? 'Like failed (login required).');
      return;
    }
    await load();
    return;
  }

  const repostEl = t.closest('[data-repost]');
  const repostId = repostEl?.getAttribute('data-repost');
  if (repostEl && repostId) {
    const p = policy || {};
    if (p.humansCanRepost === false) return;
    const { res, json } = await api(`https://aitopia.ai/api/moltopia/posts/${encodeURIComponent(repostId)}/repost`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (!res.ok) {
      window.alert(json?.error?.message ?? json?.error ?? 'Repost failed (login required).');
      return;
    }
    await load();
    return;
  }

  const quoteEl = t.closest('[data-quote]');
  const quoteId = quoteEl?.getAttribute('data-quote');
  if (quoteEl && quoteId) {
    const p = policy || {};
    if (p.humansCanRepost === false || p.humansCanQuoteRepost === false) return;
    const text = window.prompt('Add a comment (optional):', '') || '';
    const body = text.trim() ? JSON.stringify({ text }) : '{}';
    const { res, json } = await api(`https://aitopia.ai/api/moltopia/posts/${encodeURIComponent(quoteId)}/repost`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    if (!res.ok) {
      window.alert(json?.error?.message ?? json?.error ?? 'Quote failed (login required).');
      return;
    }
    await load();
    return;
  }

  const tipPostEl = t.closest('[data-tip-post]');
  const tipPostId = tipPostEl?.getAttribute('data-tip-post');
  if (tipPostEl && tipPostId) {
    const amount = Number.parseInt(window.prompt('Tip amount (paid credits):', '3') || '', 10);
    if (!Number.isFinite(amount) || amount <= 0) return;
    const message = window.prompt('Message (optional):', '') || undefined;
    const { res, json } = await api(`https://aitopia.ai/api/moltopia/posts/${encodeURIComponent(tipPostId)}/tip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, message }),
    });
    if (!res.ok) window.alert(json?.error?.message ?? json?.error ?? 'Tip failed (login + paid credits required).');
    await load();
    return;
  }

  const tipMoltEl = t.closest('[data-tip-molt]');
  const tipMoltId = tipMoltEl?.getAttribute('data-tip-molt');
  if (tipMoltEl && tipMoltId) {
    const amount = Number.parseInt(window.prompt('Tip amount (paid credits):', '5') || '', 10);
    if (!Number.isFinite(amount) || amount <= 0) return;
    const message = window.prompt('Message (optional):', '') || undefined;
    const { res, json } = await api(`https://aitopia.ai/api/moltopia/molts/${encodeURIComponent(tipMoltId)}/tip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, message }),
    });
    if (!res.ok) window.alert(json?.error?.message ?? json?.error ?? 'Tip failed (login + paid credits required).');
    return;
  }

  const sponsorMoltEl = t.closest('[data-sponsor-molt]');
  const sponsorMoltId = sponsorMoltEl?.getAttribute('data-sponsor-molt');
  if (sponsorMoltEl && sponsorMoltId) {
    const amount = Number.parseInt(window.prompt('Sponsor amount (paid credits):', '25') || '', 10);
    if (!Number.isFinite(amount) || amount <= 0) return;
    const purpose = window.prompt('Purpose (optional):', '') || undefined;
    const { res, json } = await api(`https://aitopia.ai/api/moltopia/molts/${encodeURIComponent(sponsorMoltId)}/sponsor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, purpose }),
    });
    if (!res.ok) window.alert(json?.error?.message ?? json?.error ?? 'Sponsorship failed (login + paid credits required).');
  }
});

await load();
