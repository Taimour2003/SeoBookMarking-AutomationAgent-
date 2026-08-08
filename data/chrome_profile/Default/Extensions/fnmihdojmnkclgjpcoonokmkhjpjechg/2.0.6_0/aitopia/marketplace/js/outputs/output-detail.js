import { fetchHelper } from '../shared/fetch-helper.js';
import { renderOutput } from '../runner/result-renderer.js';
import { openShareModal } from '../moltopia/share.js';

const el = {
  crumbTitle: document.getElementById('crumbTitle'),
  title: document.getElementById('title'),
  description: document.getElementById('description'),
  madeWith: document.getElementById('madeWith'),
  meta: document.getElementById('meta'),
  tags: document.getElementById('tags'),
  statusBanner: document.getElementById('statusBanner'),
  outputContainer: document.getElementById('outputContainer'),
  creatorHeaderLink: document.getElementById('creatorHeaderLink'),
  creatorAvatar: document.getElementById('creatorAvatar'),
  creatorAvatarFallback: document.getElementById('creatorAvatarFallback'),
  creatorUsername: document.getElementById('creatorUsername'),
  creatorTime: document.getElementById('creatorTime'),
	remixBtn: document.getElementById('remixBtn'),
	remixBtnDesktop: document.getElementById('remixBtnDesktop'),
	shareBtn: document.getElementById('shareBtn'),
	followCreatorBtn: document.getElementById('followCreatorBtn'),
	editBtn: document.getElementById('editBtn'),
	deleteBtn: document.getElementById('deleteBtn'),
	reportBtnWrap: document.getElementById('reportBtnWrap'),
	reportBtn: document.getElementById('reportBtn'),
	sourceStoreId: document.getElementById('sourceStoreId'),
	sourceStatus: document.getElementById('sourceStatus'),
  openSourceBtn: document.getElementById('openSourceBtn'),
  lineage: document.getElementById('lineage'),
  likeBtn: document.getElementById('likeBtn'),
  likeIcon: document.getElementById('likeIcon'),
  likeCount: document.getElementById('likeCount'),
  commentsTitle: document.getElementById('commentsTitle'),
  commentsAuthHint: document.getElementById('commentsAuthHint'),
  commentForm: document.getElementById('commentForm'),
  commentInput: document.getElementById('commentInput'),
  commentSubmit: document.getElementById('commentSubmit'),
  commentsList: document.getElementById('commentsList'),
  commentsEmpty: document.getElementById('commentsEmpty'),
  commentsLoadMore: document.getElementById('commentsLoadMore'),
  remixesTitle: document.getElementById('remixesTitle'),
  remixesSubtitle: document.getElementById('remixesSubtitle'),
  remixesGrid: document.getElementById('remixesGrid'),
  remixesLoadMore: document.getElementById('remixesLoadMore'),
  editModal: document.getElementById('editModal'),
  editModalBackdrop: document.getElementById('editModalBackdrop'),
  editModalClose: document.getElementById('editModalClose'),
  editForm: document.getElementById('editForm'),
  editTitle: document.getElementById('editTitle'),
  editDescription: document.getElementById('editDescription'),
  editTags: document.getElementById('editTags'),
  editVisibility: document.getElementById('editVisibility'),
  editSaveBtn: document.getElementById('editSaveBtn'),
  editCancelBtn: document.getElementById('editCancelBtn'),
  reportModal: document.getElementById('reportModal'),
  reportModalBackdrop: document.getElementById('reportModalBackdrop'),
  reportModalClose: document.getElementById('reportModalClose'),
  reportForm: document.getElementById('reportForm'),
  reportReason: document.getElementById('reportReason'),
  reportDetails: document.getElementById('reportDetails'),
  reportSubmitBtn: document.getElementById('reportSubmitBtn'),
  reportCancelBtn: document.getElementById('reportCancelBtn'),
};

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

const REPORT_REASON_LABELS = { nsfw: 'NSFW / Sexual content', spam: 'Spam', copyright: 'Copyright', hate: 'Hate / Harassment', violence: 'Violence', impersonation: 'Impersonation', other: 'Other' };
const FLAG_SVG = '<svg class="w-3 h-3 inline-block mr-0.5 align-[-1px]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5"/></svg>';

function applyReportBtnState(btn, viewer) {
  const textMode = btn.dataset.reportTextMode === 'true';
  const hasReported = Boolean(viewer?.hasReported);

  if (hasReported) {
    const label = REPORT_REASON_LABELS[viewer?.reportReason] || viewer?.reportReason || 'Reported';
    btn.disabled = true;
    if (textMode) {
      btn.innerHTML = `${FLAG_SVG} Reported: ${escapeHtml(label)}`;
      btn.className = 'text-xs text-red-500/70 cursor-not-allowed transition-colors';
    } else {
      btn.innerHTML = `${FLAG_SVG} Reported: ${escapeHtml(label)}`;
      btn.className = 'h-10 px-4 rounded-full bg-secondary text-sm font-semibold opacity-60 cursor-not-allowed transition-colors';
    }
  } else {
    btn.disabled = false;
    if (textMode) {
      btn.innerHTML = `${FLAG_SVG} Report`;
      btn.className = 'text-xs text-muted-foreground hover:text-foreground transition-colors';
    } else {
      btn.textContent = 'Report';
      btn.className = 'h-10 px-4 rounded-full bg-secondary hover:bg-secondary/80 text-sm font-semibold transition-colors';
    }
  }
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

async function readJson(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text };
  }
}

function getOutputIdFromPath() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  if (parts.length >= 2 && (parts[0] === 'outputs' || parts[0] === 'creations')) return parts[1];
  return null;
}

function setStatus(message, tone = 'info') {
  if (!el.statusBanner) return;
  if (!message) {
    el.statusBanner.classList.add('hidden');
    el.statusBanner.textContent = '';
    return;
  }
  el.statusBanner.classList.remove('hidden');
  el.statusBanner.classList.toggle('text-red-500', tone === 'error');
  el.statusBanner.classList.toggle('text-muted-foreground', tone !== 'error');
  el.statusBanner.textContent = message;
}

function openModal(modalEl) {
  if (!modalEl) return;
  modalEl.classList.remove('hidden');
}

function closeModal(modalEl) {
  if (!modalEl) return;
  modalEl.classList.add('hidden');
}

function setTags(tags) {
  if (!el.tags) return;
  const list = Array.isArray(tags) ? tags.filter((t) => typeof t === 'string' && t.trim()) : [];
  el.tags.innerHTML = list
    .slice(0, 20)
    .map((t) => `<span class="px-2 py-1 rounded-full bg-secondary text-xs font-semibold text-muted-foreground">${escapeHtml(t)}</span>`)
    .join('');
}

function renderCreatorMeta({ creatorProfile, creatorUserId }) {
  const username = creatorProfile?.username ? String(creatorProfile.username) : '';
  if (username) {
    const href = `/u/${encodeURIComponent(username)}`;
    return `by <a class="text-primary hover:underline" href="${href}">@${escapeHtml(username)}</a>`;
  }
  const fallback = creatorUserId ? String(creatorUserId).slice(0, 16) : 'anonymous';
  return `by ${escapeHtml(fallback)}`;
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      return ok;
    } catch {
      return false;
    }
  }
}

let lastLoaded = null;

function handleShareClick() {
  if (!lastLoaded?.outputId) return;
  const outputId = String(lastLoaded.outputId);
  const url = `${window.location.origin}/creations/${encodeURIComponent(outputId)}`;
  const remixUrl = `${url}/remix`;

  const title = String(lastLoaded?.output?.title || 'Creation').trim() || 'Creation';
  const creator = lastLoaded?.creatorProfile?.username ? `@${String(lastLoaded.creatorProfile.username)}` : 'AITOPIA';
  const text = `${title} by ${creator}`;

  openShareModal({
    title: 'AITOPIA',
    url,
    text,
    extraUrl: remixUrl,
    extraLabel: 'Copy remix link',
  });
}

el.shareBtn?.addEventListener('click', handleShareClick);

async function toggleFollowCreator() {
  if (!el.followCreatorBtn) return;

  const username = lastLoaded?.creatorProfile?.username ? String(lastLoaded.creatorProfile.username) : '';
  if (!username) return;

  const viewerUserId = lastLoaded?.viewer?.userId ? String(lastLoaded.viewer.userId) : '';
  if (!viewerUserId) {
    setStatus('Sign in to follow creators.', 'error');
    return;
  }
  if (Boolean(lastLoaded?.viewer?.isOwner)) return;

  el.followCreatorBtn.disabled = true;
  setStatus('');

  const following = Boolean(lastLoaded?.viewer?.isFollowingCreator);
  const method = following ? 'DELETE' : 'POST';

  const res = await fetchHelper(`https://aitopia.ai/api/users/${encodeURIComponent(username)}/follow`, {
    method,
    headers: { ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}), Accept: 'application/json' },
    credentials: 'include',
    ...(method === 'POST' ? { body: '{}' } : {}),
  });
  const json = await readJson(res);

  if (!res.ok && res.status !== 204) {
    const msg =
      json?.error?.message ||
      json?.error ||
      (res.status === 401 ? 'Sign in to follow creators.' : `Failed to follow (${res.status})`);
    setStatus(String(msg), 'error');
    el.followCreatorBtn.disabled = false;
    return;
  }

  const nextFollowing = method === 'POST';
  lastLoaded.viewer = { ...(lastLoaded.viewer || {}), isFollowingCreator: nextFollowing };
  el.followCreatorBtn.textContent = nextFollowing ? 'Following' : 'Follow';
  el.followCreatorBtn.disabled = false;
}

el.followCreatorBtn?.addEventListener('click', () => void toggleFollowCreator());

const remixesState = {
  loading: false,
  cursor: null,
  outputs: [],
};

const commentsState = {
  loading: false,
  cursor: null,
  comments: [],
};

async function toggleLike() {
  if (!lastLoaded?.outputId) return;
  if (!el.likeBtn) return;

  el.likeBtn.disabled = true;
  setStatus('');

  const liked = Boolean(lastLoaded?.viewer?.hasLiked);
  const method = liked ? 'DELETE' : 'POST';

  const res = await fetchHelper(`https://aitopia.ai/api/outputs/${encodeURIComponent(lastLoaded.outputId)}/like`, {
    method,
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  const json = await readJson(res);

  if (!res.ok) {
    const msg = json?.error?.message || json?.error || (res.status === 401 ? 'Sign in to like creations.' : `Failed to like (${res.status})`);
    setStatus(String(msg), 'error');
    el.likeBtn.disabled = false;
    return;
  }

  const nextLiked = Boolean(json?.liked);
  const nextCount = Number(json?.likeCount ?? lastLoaded?.output?.likeCount ?? 0);
  lastLoaded.viewer = { ...(lastLoaded.viewer || {}), hasLiked: nextLiked };
  lastLoaded.output = { ...(lastLoaded.output || {}), likeCount: nextCount };

  if (el.likeIcon) el.likeIcon.textContent = nextLiked ? '♥' : '♡';
  if (el.likeCount) el.likeCount.textContent = String(Number.isFinite(nextCount) ? nextCount : 0);
  el.likeBtn.classList.toggle('text-red-500', nextLiked);

  el.likeBtn.disabled = false;
}

el.likeBtn?.addEventListener('click', () => void toggleLike());

function canDeleteComment(comment) {
  const viewerId = lastLoaded?.viewer?.userId;
  if (!viewerId) return false;
  if (lastLoaded?.viewer?.isOwner) return true;
  return String(comment?.author?.userId || '') === String(viewerId);
}

function renderCommentCard(comment) {
  const id = String(comment?.id || '');
  const content = String(comment?.content || '');
  const createdAt = comment?.createdAt || '';

  const username = comment?.author?.username ? String(comment.author.username) : '';
  const authorLabel = username ? `@${username}` : 'Unknown';
  const authorHref = username ? `/u/${encodeURIComponent(username)}` : '#';
  const avatarUrl = comment?.author?.avatarUrl ? String(comment.author.avatarUrl) : '';

  const deleteBtn = canDeleteComment(comment)
    ? `<button type="button" data-comment-delete="${escapeHtml(id)}" class="ml-auto text-xs font-semibold text-red-500 hover:underline">Delete</button>`
    : '';

  return `
    <div class="flex gap-3 rounded-ios-xl border border-border bg-background/40 p-4">
      <a href="${authorHref}" class="shrink-0">
        ${
          avatarUrl
            ? `<img src="${escapeHtml(avatarUrl)}" alt="" class="w-10 h-10 rounded-full object-cover" loading="lazy" />`
            : `<div class="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-xs font-extrabold text-muted-foreground">👤</div>`
        }
      </a>
      <div class="min-w-0 flex-1">
        <div class="flex items-start gap-3">
          <div class="min-w-0">
            <a href="${authorHref}" class="text-sm font-semibold hover:underline">${escapeHtml(authorLabel)}</a>
            <span class="ml-2 text-xs text-muted-foreground">${escapeHtml(formatRelativeTime(createdAt))}</span>
          </div>
          ${deleteBtn}
        </div>
        <div class="mt-2 text-sm whitespace-pre-wrap break-words">${escapeHtml(content)}</div>
      </div>
    </div>
  `;
}

function renderCommentsList(comments) {
  if (!el.commentsList) return;
  const list = Array.isArray(comments) ? comments : [];
  el.commentsList.innerHTML = list.map(renderCommentCard).join('');
  if (el.commentsEmpty) el.commentsEmpty.classList.toggle('hidden', list.length > 0);
}

async function loadComments({ append } = { append: false }) {
  if (commentsState.loading) return;
  if (!lastLoaded?.outputId) return;
  if (!el.commentsList) return;

  commentsState.loading = true;

  if (!append) {
    commentsState.cursor = null;
    commentsState.comments = [];
    renderCommentsList([]);
    if (el.commentsLoadMore) el.commentsLoadMore.classList.add('hidden');
  }

  const qs = new URLSearchParams();
  qs.set('limit', '20');
  if (append && commentsState.cursor) qs.set('cursor', commentsState.cursor);

  const res = await fetchHelper(`https://aitopia.ai/api/outputs/${encodeURIComponent(lastLoaded.outputId)}/comments?${qs.toString()}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  const json = await readJson(res);
  if (!res.ok) {
    commentsState.loading = false;
    return;
  }

  const comments = Array.isArray(json?.comments) ? json.comments : [];
  commentsState.comments = append ? commentsState.comments.concat(comments) : comments;
  commentsState.cursor = json?.nextCursor || null;

  renderCommentsList(commentsState.comments);
  if (el.commentsLoadMore) el.commentsLoadMore.classList.toggle('hidden', !commentsState.cursor);

  commentsState.loading = false;
}

el.commentsLoadMore?.addEventListener('click', () => void loadComments({ append: true }));

async function submitComment(e) {
  e.preventDefault();
  if (!lastLoaded?.outputId) return;
  if (!el.commentInput) return;

  const content = (el.commentInput.value || '').trim();
  if (!content) return;

  if (el.commentSubmit) {
    el.commentSubmit.disabled = true;
    el.commentSubmit.textContent = 'Posting…';
  }
  setStatus('');

  try {
    const res = await fetchHelper(`https://aitopia.ai/api/outputs/${encodeURIComponent(lastLoaded.outputId)}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ content }),
    });
    const json = await readJson(res);
    if (!res.ok) {
      const msg = json?.error?.message || json?.error || (res.status === 401 ? 'Sign in to comment.' : `Failed to comment (${res.status})`);
      setStatus(String(msg), 'error');
      return;
    }

    const nextCount = Number(json?.commentCount ?? lastLoaded?.output?.commentCount ?? 0);
    lastLoaded.output = { ...(lastLoaded.output || {}), commentCount: nextCount };
    if (el.commentsTitle) el.commentsTitle.textContent = `Comments (${Number.isFinite(nextCount) ? nextCount : 0})`;

    el.commentInput.value = '';
    void loadComments({ append: false });
  } finally {
    if (el.commentSubmit) {
      el.commentSubmit.disabled = false;
      el.commentSubmit.textContent = 'Post';
    }
  }
}

el.commentForm?.addEventListener('submit', (e) => void submitComment(e));

async function deleteComment(commentId) {
  if (!lastLoaded?.outputId) return;
  const id = String(commentId || '');
  if (!id) return;

  setStatus('');
  const res = await fetchHelper(`https://aitopia.ai/api/outputs/${encodeURIComponent(lastLoaded.outputId)}/comments/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  const json = await readJson(res);
  if (!res.ok) {
    const msg = json?.error?.message || json?.error || `Failed to delete comment (${res.status})`;
    setStatus(String(msg), 'error');
    return;
  }

  const nextCount = Number(json?.commentCount ?? lastLoaded?.output?.commentCount ?? 0);
  lastLoaded.output = { ...(lastLoaded.output || {}), commentCount: nextCount };
  if (el.commentsTitle) el.commentsTitle.textContent = `Comments (${Number.isFinite(nextCount) ? nextCount : 0})`;

  void loadComments({ append: false });
}

el.commentsList?.addEventListener('click', (e) => {
  const target = e.target instanceof Element ? e.target : null;
  const btn = target?.closest?.('[data-comment-delete]');
  if (!btn) return;
  const id = btn.getAttribute('data-comment-delete');
  if (!id) return;
  void deleteComment(id);
});

	function renderRemixCard(output) {
	  const id = String(output?.id || '');
	  if (!id) return '';

	  const title = String(output?.title || 'Creation');
	  const viewHref = `/creations/${encodeURIComponent(id)}`;

	  const previewKind = output?.preview?.kind;
	  const previewUrl = typeof output?.preview?.url === 'string' ? output.preview.url : '';
	  const previewText = typeof output?.preview?.text === 'string' ? output.preview.text : '';
	  const media =
	    previewKind === 'text' && previewText
	      ? `<div class="w-full h-full flex items-start p-3 bg-secondary/50 overflow-hidden"><p class="text-xs text-foreground/80 leading-relaxed line-clamp-[6] whitespace-pre-wrap">${escapeHtml(previewText)}</p></div>`
	      : previewKind === 'image' && previewUrl
	      ? `<img src="${escapeHtml(previewUrl)}" alt="${escapeHtml(title)}" class="w-full h-full object-cover" loading="lazy" />`
	      : `<div class="w-full h-full flex items-center justify-center text-2xl text-muted-foreground">${
	          previewKind === 'video' ? '🎬' : previewKind === 'audio' ? '🎧' : '🎨'
	        }</div>`;

	  return `
	    <a href="${viewHref}" class="relative block aspect-square overflow-hidden hover:opacity-95 transition-opacity" aria-label="${escapeHtml(title)}">
	      ${media}
	    </a>
	  `;
	}

function renderRemixesGrid(outputs) {
  if (!el.remixesGrid) return;
  el.remixesGrid.innerHTML = outputs.map(renderRemixCard).join('');
}

async function loadRemixes({ append } = { append: false }) {
  if (remixesState.loading) return;
  if (!lastLoaded?.outputId) return;
  if (!el.remixesGrid) return;

  remixesState.loading = true;

  if (!append) {
    remixesState.cursor = null;
    remixesState.outputs = [];
    renderRemixesGrid([]);
    if (el.remixesLoadMore) el.remixesLoadMore.classList.add('hidden');
  }

  const qs = new URLSearchParams();
  qs.set('limit', '12');
  if (append && remixesState.cursor) qs.set('cursor', remixesState.cursor);

  const res = await fetchHelper(`https://aitopia.ai/api/outputs/${encodeURIComponent(lastLoaded.outputId)}/remixes?${qs.toString()}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'include',
  });
  const json = await readJson(res);

  if (!res.ok) {
    remixesState.loading = false;
    return;
  }

  const outputs = Array.isArray(json?.outputs) ? json.outputs : [];
  remixesState.outputs = append ? remixesState.outputs.concat(outputs) : outputs;
  remixesState.cursor = json?.nextCursor || null;

  renderRemixesGrid(remixesState.outputs);

  if (el.remixesSubtitle) {
    el.remixesSubtitle.textContent =
      remixesState.outputs.length > 0 ? 'Explore creations inspired by this one.' : 'No public remixes yet. Be the first to remix!';
  }

  if (el.remixesLoadMore) el.remixesLoadMore.classList.toggle('hidden', !remixesState.cursor);
  remixesState.loading = false;
}

el.remixesLoadMore?.addEventListener('click', () => void loadRemixes({ append: true }));

async function load() {
  const outputId = getOutputIdFromPath();
  if (!outputId) {
    if (el.title) el.title.textContent = 'Invalid creation URL';
    setStatus('Missing creation id.', 'error');
    return;
  }

  const res = await fetchHelper(`https://aitopia.ai/api/outputs/${encodeURIComponent(outputId)}`, { method: 'GET', credentials: 'include' });
  const json = await readJson(res);

  if (!res.ok) {
    const msg = json?.error?.message || json?.error || `Failed to load creation (${res.status})`;
    if (el.title) el.title.textContent = 'Creation unavailable';
    if (el.crumbTitle) el.crumbTitle.textContent = 'Unavailable';
    setStatus(String(msg), 'error');
    if (el.outputContainer) {
      el.outputContainer.innerHTML = `<div class="text-sm text-red-500">${escapeHtml(String(msg))}</div>`;
    }
    return;
  }

  const output = json?.output;
  const creatorProfile = json?.creatorProfile;
  const viewer = json?.viewer;
  const sourceRun = json?.sourceRun;

  const title = output?.title || 'Untitled';
  document.title = `${title} - Creation | AITOPIA`;
  if (el.title) el.title.textContent = title;
  if (el.crumbTitle) el.crumbTitle.textContent = title;

  if (el.description) {
    const description = typeof output?.description === 'string' ? output.description.trim() : '';
    el.description.textContent = description;
  }

  const createdAt = output?.createdAt ? new Date(output.createdAt) : null;
  const creatorUserId = output?.creatorUserId ? String(output.creatorUserId) : '';
  const visibility = output?.visibility || 'private';
  const moderation = output?.moderationStatus || 'pending';

  const creatorUsername = creatorProfile?.username ? String(creatorProfile.username) : '';
  const creatorAvatarUrl = creatorProfile?.avatarUrl ? String(creatorProfile.avatarUrl) : '';
  const creatorHref = creatorUsername ? `/u/${encodeURIComponent(creatorUsername)}` : '#';

  if (el.creatorHeaderLink) el.creatorHeaderLink.href = creatorHref;
  if (el.creatorUsername) el.creatorUsername.textContent = creatorUsername ? `@${creatorUsername}` : '@anonymous';
  if (el.creatorTime) el.creatorTime.textContent = output?.createdAt ? formatRelativeTime(output.createdAt) : '';

  if (el.creatorAvatar) {
    if (creatorAvatarUrl) {
      el.creatorAvatar.src = creatorAvatarUrl;
      el.creatorAvatar.classList.remove('hidden');
      el.creatorAvatarFallback?.classList.add('hidden');
    } else {
      el.creatorAvatar.classList.add('hidden');
      el.creatorAvatarFallback?.classList.remove('hidden');
    }
  }
  if (el.meta) {
    const time = createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt.toLocaleString() : '';
    const by = renderCreatorMeta({ creatorProfile, creatorUserId });
    el.meta.innerHTML = `${escapeHtml(visibility)}${visibility === 'public' ? ` • ${escapeHtml(moderation)}` : ''} • ${by}${time ? ` • ${escapeHtml(time)}` : ''}`;
  }
  setTags(output?.tags);

  const storeId = output?.sourceStoreId || sourceRun?.agentId || 'unknown';
  if (el.sourceStoreId) el.sourceStoreId.textContent = storeId;
  if (el.sourceStatus) el.sourceStatus.textContent = sourceRun?.status ? `Run status: ${sourceRun.status}` : 'Run not available';
  if (el.openSourceBtn) el.openSourceBtn.href = `/uap?agentId=${encodeURIComponent(storeId)}`;

  const _outputIdForRemix = outputId;
  // Model IDs contain '/' (e.g. 'kwaivgi/kling-v2.1'), agent IDs don't
  const isModelSource = storeId.includes('/');
  const remixHref = isModelSource
    ? `/${storeId}?remixOutputId=${encodeURIComponent(_outputIdForRemix)}`
    : `/aitopia/marketplace/agent/${encodeURIComponent(storeId)}.html?remixOutputId=${encodeURIComponent(_outputIdForRemix)}`;
  if (el.remixBtn) el.remixBtn.href = remixHref;
  if (el.remixBtnDesktop) el.remixBtnDesktop.href = remixHref;

  if (el.madeWith) {
    if (storeId && storeId !== 'unknown') {
      el.madeWith.classList.remove('hidden');
      const madeWithHref = isModelSource ? `/${storeId}` : `/aitopia/marketplace/agent/${encodeURIComponent(storeId)}.html`;
      el.madeWith.innerHTML = `Made with <a class="text-primary hover:underline" href="${madeWithHref}">${escapeHtml(
        storeId,
      )}</a>`;
    } else {
      el.madeWith.classList.add('hidden');
      el.madeWith.textContent = '';
    }
  }

  if (el.lineage) {
    if (output?.derivedFromOutputId) {
      el.lineage.innerHTML = `Remixed from <a class="text-primary hover:underline" href="/marketplace/creations/${encodeURIComponent(output.derivedFromOutputId)}">${escapeHtml(output.derivedFromOutputId)}</a>`;
    } else {
      el.lineage.textContent = 'This is a root creation (not a remix).';
    }
  }

  const result = sourceRun?.output?.result ?? null;
  if (!el.outputContainer) return;
  const selectedOutputUrl = output?.remixSpec?.defaults?.__selectedOutputUrl;
  if (selectedOutputUrl && typeof selectedOutputUrl === 'string') {
    renderOutput(el.outputContainer, { url: selectedOutputUrl });
  } else {
    renderOutput(el.outputContainer, result);
  }

  if (visibility === 'public' && moderation !== 'approved') {
    setStatus('This creation is not approved for public viewing yet. If you are the owner, you can still view it here.', 'info');
  } else {
    setStatus('');
  }

  const isOwner = Boolean(viewer?.isOwner);
  if (el.editBtn) el.editBtn.classList.toggle('hidden', !isOwner);
  if (el.deleteBtn) el.deleteBtn.classList.toggle('hidden', !isOwner);

  const shouldHideReport = isOwner || visibility !== 'public' || moderation !== 'approved';
  const reportWrap = el.reportBtnWrap || el.reportBtn;
  if (reportWrap) reportWrap.classList.toggle('hidden', shouldHideReport);
  if (el.reportBtn && !shouldHideReport) applyReportBtnState(el.reportBtn, viewer);

  lastLoaded = { outputId, output, creatorProfile, viewer };

  if (el.followCreatorBtn) {
    const creatorUsername = creatorProfile?.username ? String(creatorProfile.username) : '';
    const viewerUserId = viewer?.userId ? String(viewer.userId) : '';
    const canFollow = Boolean(creatorUsername) && Boolean(viewerUserId) && !isOwner;
    el.followCreatorBtn.classList.toggle('hidden', !canFollow);
    if (canFollow) {
      const isFollowingCreator = Boolean(viewer?.isFollowingCreator);
      el.followCreatorBtn.textContent = isFollowingCreator ? 'Following' : 'Follow';
      el.followCreatorBtn.disabled = false;
    }
  }

  if (el.likeBtn) {
    const hasLiked = Boolean(viewer?.hasLiked);
    const likeCount = Number(output?.likeCount ?? 0);
    if (el.likeIcon) el.likeIcon.textContent = hasLiked ? '♥' : '♡';
    if (el.likeCount) el.likeCount.textContent = String(Number.isFinite(likeCount) ? likeCount : 0);
    el.likeBtn.classList.toggle('text-red-500', hasLiked);
    el.likeBtn.disabled = Boolean(isOwner) || visibility !== 'public' || moderation !== 'approved';
  }

  if (el.commentsTitle) {
    const commentCount = Number(output?.commentCount ?? 0);
    el.commentsTitle.textContent = `Comments (${Number.isFinite(commentCount) ? commentCount : 0})`;
  }
  if (el.commentForm || el.commentsAuthHint) {
    const viewerUserId = viewer?.userId ? String(viewer.userId) : '';
    const canComment = Boolean(viewerUserId) && visibility === 'public' && moderation === 'approved';

    if (el.commentForm) el.commentForm.classList.toggle('hidden', !canComment);

    if (el.commentsAuthHint) {
      if (!viewerUserId) {
        el.commentsAuthHint.textContent = 'Sign in to comment.';
        el.commentsAuthHint.classList.remove('hidden');
      } else if (!canComment) {
        el.commentsAuthHint.textContent = 'Comments are only enabled for public approved creations.';
        el.commentsAuthHint.classList.remove('hidden');
      } else {
        el.commentsAuthHint.classList.add('hidden');
      }
    }
  }
  void loadComments({ append: false });

  if (el.remixesTitle) {
    const remixCount = Number(output?.remixCount ?? 0);
    el.remixesTitle.textContent = `Remixes (${Number.isFinite(remixCount) ? remixCount : 0})`;
  }
  void loadRemixes({ append: false });
}

void load();

function getTagsString(tags) {
  const list = Array.isArray(tags) ? tags.filter((t) => typeof t === 'string' && t.trim()) : [];
  return list.join(', ');
}

function parseTagsString(value) {
  const raw = String(value || '');
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 20);
}

async function submitEdit(e) {
  e.preventDefault();
  if (!lastLoaded?.outputId) return;

  if (el.editSaveBtn) {
    el.editSaveBtn.disabled = true;
    el.editSaveBtn.textContent = 'Saving…';
  }
  setStatus('');

  try {
    const payload = {
      title: el.editTitle?.value ?? '',
      description: el.editDescription?.value ?? '',
      tags: parseTagsString(el.editTags?.value ?? ''),
      visibility: el.editVisibility?.value ?? undefined,
    };

    const res = await fetchHelper(`https://aitopia.ai/api/outputs/${encodeURIComponent(lastLoaded.outputId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const json = await readJson(res);
    if (!res.ok) {
      const msg = json?.error?.message || json?.error || `Failed to update (${res.status})`;
      setStatus(String(msg), 'error');
      return;
    }

    closeModal(el.editModal);
    await load();
  } finally {
    if (el.editSaveBtn) {
      el.editSaveBtn.disabled = false;
      el.editSaveBtn.textContent = 'Save';
    }
  }
}

async function deleteOutput() {
  if (!lastLoaded?.outputId) return;
  const ok = window.confirm('Delete this creation? This cannot be undone.');
  if (!ok) return;

  setStatus('');
  const res = await fetchHelper(`https://aitopia.ai/api/outputs/${encodeURIComponent(lastLoaded.outputId)}`, { method: 'DELETE', credentials: 'include' });
  if (res.ok || res.status === 204) {
    window.location.href = '/aitopia/marketplace/outputs.html';
    return;
  }
  const json = await readJson(res);
  const msg = json?.error?.message || json?.error || `Failed to delete (${res.status})`;
  setStatus(String(msg), 'error');
}

async function submitReport(e) {
  e.preventDefault();
  if (!lastLoaded?.outputId) return;

  if (el.reportSubmitBtn) {
    el.reportSubmitBtn.disabled = true;
    el.reportSubmitBtn.textContent = 'Submitting…';
  }
  setStatus('');

  try {
    const reason = el.reportReason?.value ?? 'other';
    const details = (el.reportDetails?.value ?? '').trim() || undefined;
    if (reason === 'other' && !details) {
      setStatus('Please provide details when selecting "Other".', 'error');
      if (el.reportSubmitBtn) { el.reportSubmitBtn.disabled = false; el.reportSubmitBtn.textContent = 'Submit report'; }
      return;
    }
    const payload = { reason, details };

    const res = await fetchHelper(`https://aitopia.ai/api/outputs/${encodeURIComponent(lastLoaded.outputId)}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const json = await readJson(res);
    if (!res.ok) {
      const msg = json?.error?.message || json?.error || `Failed to report (${res.status})`;
      setStatus(String(msg), 'error');
      return;
    }

    closeModal(el.reportModal);
    if (el.reportBtn) {
      const reason = el.reportReason?.value ?? 'other';
      applyReportBtnState(el.reportBtn, { hasReported: true, reportReason: reason });
    }
    setStatus('Report submitted. Thank you.', 'info');
  } finally {
    if (el.reportSubmitBtn) {
      el.reportSubmitBtn.disabled = false;
      el.reportSubmitBtn.textContent = 'Submit report';
    }
  }
}

function initManageUi() {
  el.editBtn?.addEventListener('click', () => {
    const output = lastLoaded?.output;
    if (!output) return;

    if (el.editTitle) el.editTitle.value = output.title || '';
    if (el.editDescription) el.editDescription.value = output.description || '';
    if (el.editTags) el.editTags.value = getTagsString(output.tags);
    if (el.editVisibility) el.editVisibility.value = output.visibility || 'private';

    openModal(el.editModal);
  });

  el.deleteBtn?.addEventListener('click', () => void deleteOutput());

  el.reportBtn?.addEventListener('click', () => {
    if (el.reportReason) el.reportReason.value = 'nsfw';
    if (el.reportDetails) el.reportDetails.value = '';
    openModal(el.reportModal);
  });

  el.editModalBackdrop?.addEventListener('click', () => closeModal(el.editModal));
  el.editModalClose?.addEventListener('click', () => closeModal(el.editModal));
  el.editCancelBtn?.addEventListener('click', () => closeModal(el.editModal));
  el.editForm?.addEventListener('submit', (e) => void submitEdit(e));

  el.reportModalBackdrop?.addEventListener('click', () => closeModal(el.reportModal));
  el.reportModalClose?.addEventListener('click', () => closeModal(el.reportModal));
  el.reportCancelBtn?.addEventListener('click', () => closeModal(el.reportModal));
  el.reportForm?.addEventListener('submit', (e) => void submitReport(e));
}

initManageUi();
