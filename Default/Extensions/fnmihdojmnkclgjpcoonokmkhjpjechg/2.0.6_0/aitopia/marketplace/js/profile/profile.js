import { fetchHelper } from '../shared/fetch-helper.js';
import {
  openCreationModal as sharedOpenModal,
  closeCreationModal as sharedCloseModal,
  openPublishModal,
  escapeHtml,
  formatRelativeTime,
  createInfoRow,
} from '../shared/creation-modal.js';
import { getJob } from '../shared/api.js';

const el = {
  errorBanner: document.getElementById('errorBanner'),
  avatar: document.getElementById('avatar'),
  avatarFallback: document.getElementById('avatarFallback'),
  username: document.getElementById('username'),
  displayName: document.getElementById('displayName'),
  bio: document.getElementById('bio'),
  website: document.getElementById('website'),
  websiteText: document.getElementById('websiteText'),
  editProfileBtn: document.getElementById('editProfileBtn'),
  followBtn: document.getElementById('followBtn'),
  countCreations: document.getElementById('countCreations'),
  countFollowers: document.getElementById('countFollowers'),
  countFollowing: document.getElementById('countFollowing'),
  countLikesReceived: document.getElementById('countLikesReceived'),
  countRemixesReceived: document.getElementById('countRemixesReceived'),
  statFollowers: document.getElementById('statFollowers'),
  statFollowing: document.getElementById('statFollowing'),
  tabCreations: document.getElementById('tabCreations'),
  tabRemixes: document.getElementById('tabRemixes'),
  tabHistory: document.getElementById('tabHistory'),
  tabPrivate: document.getElementById('tabPrivate'),
  grid: document.getElementById('grid'),
  emptyState: document.getElementById('emptyState'),
  emptyTitle: document.getElementById('emptyTitle'),
  emptySubtitle: document.getElementById('emptySubtitle'),
  loadMore: document.getElementById('loadMore'),
  scrollSentinel: document.getElementById('scrollSentinel'),
  endState: document.getElementById('endState'),
  followModal: document.getElementById('followModal'),
  followModalBackdrop: document.getElementById('followModalBackdrop'),
  followModalClose: document.getElementById('followModalClose'),
  followModalTitle: document.getElementById('followModalTitle'),
  followModalBody: document.getElementById('followModalBody'),
  followModalLoadMore: document.getElementById('followModalLoadMore'),
  historyModal: document.getElementById('historyModal'),
  historyModalBackdrop: document.getElementById('historyModalBackdrop'),
  historyModalClose: document.getElementById('historyModalClose'),
  historyModalSubtitle: document.getElementById('historyModalSubtitle'),
  historyModalBody: document.getElementById('historyModalBody'),
  historyCopyBtn: document.getElementById('historyCopyBtn'),
  historyFilters: document.getElementById('historyFilters'),
  historyType: document.getElementById('historyType'),
  detailModal: document.getElementById('detailModal'),
  modalClose: document.getElementById('modalClose'),
  modalCloseMobile: document.getElementById('modalCloseMobile'),
  modalMedia: document.getElementById('modalMedia'),
  modalMediaArea: document.getElementById('modalMediaArea'),
  modalAvatar: document.getElementById('modalAvatar'),
  modalAuthorName: document.getElementById('modalAuthorName'),
  modalAvatarMobile: document.getElementById('modalAvatarMobile'),
  modalAuthorNameMobile: document.getElementById('modalAuthorNameMobile'),
  modalPrompt: document.getElementById('modalPrompt'),
  modalCopyPrompt: document.getElementById('modalCopyPrompt'),
  modalInfoRows: document.getElementById('modalInfoRows'),
  modalTopActions: document.getElementById('modalTopActions'),
  modalRecreate: document.getElementById('modalRecreate'),
  modalPublish: document.getElementById('modalPublish'),
  modalDownload: document.getElementById('modalDownload'),
  modalTransitionPreview: document.getElementById('modalTransitionPreview'),
  modalTransitionVideo: document.getElementById('modalTransitionVideo'),
  modalTransitionType: document.getElementById('modalTransitionType'),
  modalInputMedia: document.getElementById('modalInputMedia'),
  modalInputMediaGrid: document.getElementById('modalInputMediaGrid'),
};

const _activePollers = new Map(); // id → intervalId

function getUsernameFromPath() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  if (parts.length >= 2 && parts[0] === 'u') return parts[1];
  const params = new URLSearchParams(window.location.search);
  if (params.get("username")) return params.get("username") || null;
  return null;
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

async function api(path, init) {
  const res = await fetchHelper(path, { ...init, credentials: 'include' });
  const json = await readJson(res);
  return { res, json };
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

function setActiveTab(tab) {
  const on = (btn) => {
    if (!btn) return;
    btn.classList.add('border-primary', 'text-foreground');
    btn.classList.remove('border-transparent', 'text-muted-foreground');
  };
  const off = (btn) => {
    if (!btn) return;
    btn.classList.remove('border-primary', 'text-foreground');
    btn.classList.add('border-transparent', 'text-muted-foreground');
  };

  if (el.grid) {
    if (tab === 'history') {
      el.grid.className = 'mt-6 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3';
    } else {
      el.grid.className = 'mt-6 profile-grid';
    }
  }

  if (tab === 'history') {
    off(el.tabCreations);
    off(el.tabRemixes);
    if (el.tabPrivate) off(el.tabPrivate);
    on(el.tabHistory);
    el.historyFilters?.classList.remove('hidden');
    return;
  }

  if (tab === 'remixes') {
    off(el.tabCreations);
    on(el.tabRemixes);
    if (el.tabHistory) off(el.tabHistory);
    if (el.tabPrivate) off(el.tabPrivate);
    el.historyFilters?.classList.add('hidden');
    return;
  }

  if (tab === 'private') {
    off(el.tabCreations);
    off(el.tabRemixes);
    if (el.tabHistory) off(el.tabHistory);
    on(el.tabPrivate);
    el.historyFilters?.classList.add('hidden');
    return;
  }

  on(el.tabCreations);
  off(el.tabRemixes);
  if (el.tabHistory) off(el.tabHistory);
  if (el.tabPrivate) off(el.tabPrivate);
  el.historyFilters?.classList.add('hidden');
}

function cardBadge(text, tone) {
  const base = 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold';
  if (tone === 'green') return `<span class="${base} bg-green-500/15 text-green-500">${escapeHtml(text)}</span>`;
  if (tone === 'red') return `<span class="${base} bg-red-500/15 text-red-500">${escapeHtml(text)}</span>`;
  if (tone === 'amber') return `<span class="${base} bg-amber-500/15 text-amber-500">${escapeHtml(text)}</span>`;
  return `<span class="${base} bg-secondary text-muted-foreground">${escapeHtml(text)}</span>`;
}

function renderCard(output, tab) {
  const id = String(output?.id || '');
  if (!id) return '';

  const title = String(output?.title || output?.prompt || 'Creation');
  const viewHref = `/creations/${encodeURIComponent(id)}`;
  const sourceStoreId = String(output?.sourceStoreId || output?.agentId || '');
  const createdAt = output?.createdAt || '';
  const previewKind = output?.preview?.kind;
  const previewUrl = typeof output?.preview?.url === 'string' ? output.preview.url : '';
  const previewText = typeof output?.preview?.text === 'string' ? output.preview.text : '';

  const badges = [];
  if (tab === 'private') {
    if (output?.visibility) badges.push(cardBadge(output.visibility, output.visibility === 'public' ? 'green' : 'neutral'));
    if (output?.moderationStatus) {
      badges.push(
        cardBadge(
          output.moderationStatus,
          output.moderationStatus === 'approved' ? 'green' : output.moderationStatus === 'rejected' ? 'red' : 'amber'
        )
      );
    }
    if (output?.latestAiOutcome === 'flagged') {
      badges.push(cardBadge('ai flagged', 'amber'));
    } else if (output?.latestAiOutcome === 'unavailable') {
      badges.push(cardBadge('screening pending', 'amber'));
    }
  }

  const mediaContent = previewKind === 'text' && previewText
    ? `<div class="w-full h-full flex items-start p-3 bg-secondary/50"><p class="text-xs text-foreground/80 leading-relaxed line-clamp-[6] whitespace-pre-wrap">${escapeHtml(previewText)}</p></div>`
    : (previewKind === 'image' || !previewKind) && previewUrl
    ? `<img src="${escapeHtml(previewUrl)}" alt="${escapeHtml(title)}" class="w-full h-full object-cover" loading="lazy" />`
    : previewKind === 'video' && previewUrl
      ? `<video src="${escapeHtml(previewUrl)}" class="w-full h-full object-cover" autoplay muted loop playsinline></video>`
      : `<div class="w-full h-full flex items-center justify-center text-4xl text-muted-foreground">${previewKind === 'video' ? '🎬' : previewKind === 'audio' ? '🎧' : '🎨'}</div>`;

  const remixHref = sourceStoreId ? `/aitopia/marketplace/agent/${encodeURIComponent(sourceStoreId)}.html?remixOutputId=${encodeURIComponent(id)}` : viewHref;

  return `
    <div class="profile-card group block aspect-square overflow-hidden rounded-ios-xl cursor-pointer transition-opacity duration-200 hover:opacity-100" data-output-id="${escapeHtml(id)}" role="button" tabindex="0" aria-label="${escapeHtml(title)}">
      <div class="relative w-full h-full overflow-hidden rounded-ios-xl">
        ${mediaContent}
        ${badges.length ? `<div class="absolute top-2 left-2 flex flex-wrap gap-1.5 z-10">${badges.join('')}</div>` : ''}
        <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-ios-xl flex flex-col justify-end p-4">
          <div class="transform translate-y-4 group-hover:translate-y-0 transition-transform duration-200">
            <h3 class="text-white font-semibold text-sm line-clamp-2 mb-1">${escapeHtml(title)}</h3>
            <div class="text-white/80 text-xs mb-3">${escapeHtml(sourceStoreId || 'unknown')} • ${escapeHtml(formatRelativeTime(createdAt))}</div>
            <div class="flex gap-2">
              <span class="flex-1 h-8 flex items-center justify-center rounded-full bg-card text-card-foreground text-xs font-semibold">View</span>
              <a href="${remixHref}" class="stop-propagation flex-1 h-8 flex items-center justify-center rounded-full bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition-colors">Remix</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function formatDayGroupLabel(iso) {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.floor((startOfToday - startOfDay) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function isHistoryItemInProgress(item) {
  return Boolean(item?._queueStatus);
}

function renderInProgressHistoryCard(item) {
  const runId = String(item?.runId || '');
  const agentId = String(item?.agentId || 'unknown');
  const createdAt = item?.createdAt || '';
  const prompt = typeof item?.prompt === 'string' ? item.prompt : '';
  const queueStatus = item._queueStatus || 'processing';
  const isQueued = queueStatus === 'pending';
  const pct = typeof item._queueProgress === 'number' ? item._queueProgress : 0;

  const statusLabel = isQueued ? 'In Queue' : `Processing ${pct}%`;
  const statusColor = isQueued ? 'text-[#FFD128]' : 'text-primary/90';
  const barColor = isQueued ? 'bg-[#FFD128]' : 'bg-primary/90';
  const badgeTone = isQueued ? 'amber' : 'neutral';

  return `
    <div class="rounded-ios-2xl border border-border bg-card overflow-hidden" data-queue-id="${escapeHtml(runId)}">
      <div class="h-40 bg-gradient-to-br from-primary/90/15 via-indigo-600/10 to-fuchsia-600/15 flex items-center justify-center overflow-hidden">
        <div class="flex flex-col items-center gap-3">
          <div class="relative w-14 h-14">
            <div class="absolute inset-0 rounded-full border-2 ${isQueued ? 'border-[#FFD128]/20' : 'border-primary/90/20'}"></div>
            <div class="absolute inset-0 rounded-full border-2 ${isQueued ? 'border-[#FFD128]' : 'border-primary/90'} border-t-transparent animate-spin"></div>
            <div class="absolute inset-2 rounded-full ${isQueued ? 'bg-[#FFD128]/5' : 'bg-primary/90/5'} flex items-center justify-center">
              <span class="text-sm font-bold ${statusColor}">${pct}%</span>
            </div>
          </div>
          <p class="text-xs font-medium ${statusColor}">${escapeHtml(statusLabel)}</p>
          <div class="w-32 h-1.5 rounded-full bg-secondary overflow-hidden">
            <div class="h-full rounded-full ${barColor} transition-all duration-500" style="width: ${pct}%"></div>
          </div>
        </div>
      </div>
      <div class="p-5">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="font-semibold truncate">${escapeHtml(agentId)}</div>
            <div class="text-xs text-muted-foreground mt-1 truncate">${escapeHtml(formatRelativeTime(createdAt))}</div>
          </div>
          <div class="shrink-0">${cardBadge(isQueued ? 'queued' : 'processing', badgeTone)}</div>
        </div>
        ${prompt ? `<div class="mt-3 text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">${escapeHtml(prompt)}</div>` : ''}
      </div>
    </div>
  `;
}

function renderHistoryCard(item) {
  if (isHistoryItemInProgress(item)) return renderInProgressHistoryCard(item);

  const runId = String(item?.runId || '');
  const agentId = String(item?.agentId || 'unknown');
  const createdAt = item?.createdAt || '';
  const prompt = typeof item?.prompt === 'string' ? item.prompt : '';
  const preview = item?.preview || null;

  const previewKind = preview?.kind;
  const previewUrl = typeof preview?.url === 'string' ? preview.url : '';
  const previewText = typeof preview?.text === 'string' ? preview.text : '';

  const mediaContent = previewKind === 'text' && previewText
    ? `<div class="w-full h-full flex items-start p-3 bg-secondary/50"><p class="text-xs text-foreground/80 leading-relaxed line-clamp-[6] whitespace-pre-wrap">${escapeHtml(previewText)}</p></div>`
    : (previewKind === 'image' || !previewKind) && previewUrl
    ? `<img src="${escapeHtml(previewUrl)}" alt="" class="w-full h-full object-cover" loading="lazy" />`
    : previewKind === 'video' && previewUrl
      ? `<video src="${escapeHtml(previewUrl)}" class="w-full h-full object-cover" autoplay muted loop playsinline></video>`
      : `<div class="w-full h-full flex items-center justify-center text-4xl text-muted-foreground">${previewKind === 'video' ? '🎬' : previewKind === 'audio' ? '🎧' : '✨'}</div>`;

  const remixHref = agentId && agentId !== 'unknown' ? `/aitopia/marketplace/agent/${encodeURIComponent(agentId)}.html?remixRunId=${encodeURIComponent(runId)}` : '#';
  const titleText = prompt ? (prompt.length > 40 ? prompt.slice(0, 39) + '…' : prompt) : agentId;

  return `
    <div class="profile-history-card group relative overflow-hidden rounded-ios-xl bg-card transition-opacity cursor-pointer" data-history-run-id="${escapeHtml(runId)}">
      <div class="aspect-square w-full overflow-hidden rounded-ios-xl">
        ${mediaContent}
        <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-ios-xl flex flex-col justify-end p-4">
          <div class="transform translate-y-4 group-hover:translate-y-0 transition-transform duration-200">
            <div class="flex items-center gap-2 mb-1">${cardBadge('succeeded', 'green')}</div>
            <h3 class="text-white font-semibold text-sm line-clamp-2 mb-1">${escapeHtml(titleText)}</h3>
            <div class="text-white/80 text-xs mb-3">${escapeHtml(agentId)} • ${escapeHtml(formatRelativeTime(createdAt))}</div>
            <div class="flex gap-2">
              <button data-history-open="${escapeHtml(runId)}" type="button" class="view-btn flex-1 h-8 flex items-center justify-center rounded-full bg-card text-card-foreground text-xs font-semibold hover:bg-card/90 transition-colors">
                View
              </button>
              <a href="${remixHref}" class="stop-propagation flex-1 h-8 flex items-center justify-center rounded-full bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition-colors">Remix</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

let currentCreationModalOutput = null;

function openCreationModal(output) {
  currentCreationModalOutput = output;
  sharedOpenModal(output, {
    elements: el,
    pushState: false,
    isOwner: state.isSelf,
    getAuthorName: (o) => {
      const profile = o?.creatorProfile || o?.creator;
      return profile?.username || (state.isSelf ? 'You' : state.username ? `@${state.username}` : 'Anonymous');
    },
  });
}

function closeCreationModal() {
  if (!el.detailModal) return;
  el.detailModal.classList.add('hidden');
  document.body.style.overflow = '';
  currentCreationModalOutput = null;

  // Restore navbars
  const bottomNav = document.querySelector('[data-bottom-tabs]');
  if (bottomNav) bottomNav.style.display = '';
  const topNav = document.getElementById('header');
  if (topNav) topNav.style.display = '';

  if (el.modalMedia) {
    const video = el.modalMedia.querySelector('video');
    const audio = el.modalMedia.querySelector('audio');
    if (video) video.pause();
    if (audio) audio.pause();
  }
}


function renderGrid(outputs, tab) {
  if (!el.grid) return;
  if (tab === 'history') {
    let items = Array.isArray(outputs) ? outputs.slice() : [];
    // Sort by createdAt descending using Date parsing (createdAt may not be ISO format)
    items.sort((a, b) => {
      const ta = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (Number.isNaN(ta)) return 1;
      if (Number.isNaN(tb)) return -1;
      return tb - ta;
    });
    const type = state.historyType || 'all';
    if (type !== 'all') {
      items = items.filter((item) => item?.preview?.kind === type);
    }
    // Group by YYYY-MM-DD key (parse to Date to handle any date string format)
    const groups = new Map();
    for (const item of items) {
      let key = 'unknown';
      if (item?.createdAt) {
        const d = new Date(item.createdAt);
        if (!Number.isNaN(d.getTime())) {
          key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }
      }
      const list = groups.get(key) || [];
      list.push(item);
      groups.set(key, list);
    }

    const orderedKeys = Array.from(groups.keys()).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
    const parts = [];
    for (const key of orderedKeys) {
      const list = groups.get(key) || [];
      const label = list[0]?.createdAt ? formatDayGroupLabel(list[0].createdAt) : 'Unknown';
      parts.push(`<div class="col-span-full flex items-center justify-between mt-2"><div class="text-sm font-semibold">${escapeHtml(label)}</div></div>`);
      parts.push(list.map((it) => renderHistoryCard(it)).join(''));
    }

    el.grid.innerHTML = parts.join('');
    if (el.emptyTitle) el.emptyTitle.textContent = 'No history yet';
    if (el.emptySubtitle) el.emptySubtitle.textContent = 'Your successful media generations will appear here.';
    if (el.emptyState) el.emptyState.classList.toggle('hidden', items.length > 0);
    return;
  }

  el.grid.innerHTML = outputs.map((o) => renderCard(o, tab)).join('');
  if (el.emptyTitle) el.emptyTitle.textContent = 'Nothing here yet';
  if (el.emptySubtitle) el.emptySubtitle.textContent = "When this user publishes creations or remixes, they'll appear here.";
  if (el.emptyState) el.emptyState.classList.toggle('hidden', outputs.length > 0);
}

const state = {
  username: null,
  profile: null,
  counts: { creations: 0, remixes: 0, followers: 0, following: 0 },
  stats: { likesReceived: 0, remixesReceived: 0 },
  isSelf: false,
  isFollowing: false,
  tab: 'creations',
  loading: false,
  outputs: [],
  nextCursor: null,
  followModal: { open: false, mode: 'followers', users: [], nextCursor: null, loading: false },
  historyModal: { open: false, detail: null },
  historyType: 'all',
};

function setCounts(counts) {
  state.counts = counts || state.counts;
  if (el.countCreations) el.countCreations.textContent = String(state.counts.creations ?? 0);
  if (el.countFollowers) el.countFollowers.textContent = String(state.counts.followers ?? 0);
  if (el.countFollowing) el.countFollowing.textContent = String(state.counts.following ?? 0);
}

function setStats(stats) {
  state.stats = stats || state.stats;
  if (el.countLikesReceived) el.countLikesReceived.textContent = String(state.stats.likesReceived ?? 0);
  if (el.countRemixesReceived) el.countRemixesReceived.textContent = String(state.stats.remixesReceived ?? 0);
}

function renderHeader() {
  const profile = state.profile;
  if (!profile) return;

  const username = profile.username || state.username || 'user';
  document.title = `@${username} - Profile | AITOPIA`;

  if (el.username) el.username.textContent = `@${username}`;

  if (el.avatar) {
    const url = profile.avatarUrl || '';
    if (url) {
      el.avatar.src = url;
      el.avatar.classList.remove('hidden');
      el.avatarFallback?.classList.add('hidden');
    } else {
      el.avatar.classList.add('hidden');
      el.avatarFallback?.classList.remove('hidden');
      if (el.avatarFallback) {
        el.avatarFallback.textContent = username.charAt(0).toUpperCase();
      }
    }
  }

  if (el.displayName) {
    const name = profile.displayName || '';
    el.displayName.classList.toggle('hidden', !name);
    el.displayName.textContent = name;
  }

  if (el.bio) el.bio.textContent = profile.bio || '';

  if (el.website) {
    const url = profile.websiteUrl || '';
    el.website.classList.toggle('hidden', !url);
    el.website.href = url.startsWith('http') ? url : `https://${url}`;
    const displayUrl = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (el.websiteText) {
      el.websiteText.textContent = displayUrl;
    } else {
      el.website.textContent = displayUrl;
    }
  }

  if (el.editProfileBtn) {
    el.editProfileBtn.classList.toggle('hidden', !state.isSelf);
    el.editProfileBtn.classList.toggle('inline-flex', state.isSelf);
  }

  if (el.followBtn) {
    el.followBtn.classList.toggle('hidden', state.isSelf);
    el.followBtn.textContent = state.isFollowing ? 'Following' : 'Follow';
  }

  if (el.tabPrivate) {
    el.tabPrivate.classList.toggle('hidden', !state.isSelf);
  }

  if (el.tabHistory) {
    el.tabHistory.classList.toggle('hidden', !state.isSelf);
  }
}

async function loadProfile() {
  const username = state.username;
  if (!username) return;

  const { res, json } = await api(`https://aitopia.ai/api/users/${encodeURIComponent(username)}`, { method: 'GET' });
  if (!res.ok) {
    const msg = json?.error?.message || json?.error || `Failed to load profile (${res.status})`;
    setError(String(msg));
    return;
  }

  state.profile = json?.profile || null;
  state.isSelf = Boolean(json?.isSelf);
  state.isFollowing = Boolean(json?.isFollowing);
  setCounts(json?.counts || {});
  setStats(json?.stats || {});
  renderHeader();

  // Default tab: creations (or private if explicitly requested later)
  setActiveTab('creations');
  await loadTab('creations', { reset: true });
}

async function toggleFollow() {
  if (!state.username) return;
  if (state.isSelf) return;

  if (state.isFollowing) {
    const { res, json } = await api(`https://aitopia.ai/api/users/${encodeURIComponent(state.username)}/follow`, { method: 'DELETE' });
    if (!res.ok && res.status !== 204) {
      const msg = json?.error?.message || json?.error || `Failed to unfollow (${res.status})`;
      setError(String(msg));
      return;
    }
    state.isFollowing = false;
    state.counts.followers = Math.max(0, (state.counts.followers || 0) - 1);
  } else {
    const { res, json } = await api(`https://aitopia.ai/api/users/${encodeURIComponent(state.username)}/follow`, { method: 'POST', body: '{}' });
    if (!res.ok) {
      const msg = json?.error?.message || json?.error || `Failed to follow (${res.status})`;
      setError(String(msg));
      return;
    }
    state.isFollowing = true;
    state.counts.followers = (state.counts.followers || 0) + 1;
  }

  setCounts(state.counts);
  renderHeader();
}

async function loadTab(tab, { reset } = { reset: false }) {
  if (state.loading) return;
  if (!reset && !state.nextCursor) return;
  state.loading = true;
  setError('');

  if (reset) {
    state.outputs = [];
    state.nextCursor = null;
    if (el.grid) {
      if (tab === 'history') {
        el.grid.innerHTML = Array.from({ length: 6 })
          .map(
            () =>
              '<div data-skeleton="1" class="rounded-ios-2xl border border-border bg-card overflow-hidden"><div class="h-40 skeleton"></div><div class="p-5 space-y-3"><div class="h-4 w-2/3 skeleton rounded"></div><div class="h-3 w-1/2 skeleton rounded"></div><div class="h-9 w-full skeleton rounded-full"></div></div></div>',
          )
          .join('');
      } else {
        el.grid.innerHTML = Array.from({ length: 15 })
          .map(() => '<div data-skeleton="1" class="aspect-square skeleton"></div>')
          .join('');
      }
    }
    if (el.emptyState) el.emptyState.classList.add('hidden');
    if (el.loadMore) el.loadMore.classList.add('hidden');
    if (el.endState) el.endState.classList.add('hidden');
  } else if (el.grid && tab !== 'history') {
    el.grid.insertAdjacentHTML(
      'beforeend',
      Array.from({ length: 6 })
        .map(() => '<div data-skeleton="1" class="aspect-square skeleton"></div>')
        .join(''),
    );
  }

  const base =
    tab === 'history'
      ? 'https://aitopia.ai/api/me/creations'
      : `https://aitopia.ai/api/users/${encodeURIComponent(state.username)}/${tab === 'remixes' ? 'remixes' : tab === 'private' ? 'private' : 'creations'}`;
  const qs = new URLSearchParams();
  qs.set('limit', '30');
  if (!reset && state.nextCursor) qs.set('cursor', state.nextCursor);

  const { res, json } = await api(`${base}?${qs.toString()}`, { method: 'GET' });
  el.grid?.querySelectorAll?.('[data-skeleton="1"]')?.forEach?.((node) => node.remove());
  if (!res.ok) {
    const msg = json?.error?.message || json?.error || `Failed to load (${res.status})`;
    setError(String(msg));
    state.loading = false;
    return;
  }

  const outputs =
    tab === 'history'
      ? (Array.isArray(json?.creations) ? json.creations : [])
      : (Array.isArray(json?.outputs) ? json.outputs : []);
  state.outputs = state.outputs.concat(outputs);
  state.nextCursor = json?.nextCursor || null;

  // Fetch active queue items for history tab (first page only)
  if (tab === 'history' && reset) {
    try {
      const qRes = await api('https://aitopia.ai/api/queue?limit=20&status=pending,processing', { method: 'GET' });
      if (qRes.res.ok) {
        const qItems = Array.isArray(qRes.json?.items) ? qRes.json.items : [];
        const existingIds = new Set(state.outputs.map(o => String(o?.runId || o?.id || '')));
        const queueItems = qItems
          .filter(qi => !existingIds.has(qi.refId || qi.id))
          .map(qi => ({
            runId: qi.refId || qi.id,
            agentId: qi.agentId || '',
            prompt: qi.input?.prompt || qi.input?.text || '',
            input: qi.input || {},
            createdAt: qi.createdAt || new Date().toISOString(),
            _queueStatus: qi.status,
            _queueProgress: qi.progress || 0,
          }));
        if (queueItems.length > 0) {
          state.outputs = [...queueItems, ...state.outputs];
        }
      }
    } catch (qErr) {
      console.warn('[profile] Queue fetch failed (non-fatal):', qErr);
    }
  }

  renderGrid(state.outputs, tab);

  // Start polling for in-progress queue items
  if (tab === 'history') {
    resumeProfileQueuePolling();
  }

  if (el.loadMore) {
    el.loadMore.classList.toggle('hidden', !state.nextCursor);
  }
  if (el.endState) el.endState.classList.toggle('hidden', Boolean(state.nextCursor) || state.outputs.length === 0);

  state.loading = false;
}

function stopAllPollers() {
  for (const [, intervalId] of _activePollers) clearInterval(intervalId);
  _activePollers.clear();
}

function pickPreviewFromOutput(output) {
  if (!output) return null;
  // Handle direct URL string (e.g. model playground raw output)
  if (typeof output === 'string' && output.startsWith('http')) {
    const kind = detectMediaKindProfile(output);
    return { url: output, kind };
  }
  // Handle direct array of URLs (e.g. Replicate output: ["https://..."])
  if (Array.isArray(output) && output.length > 0 && typeof output[0] === 'string' && output[0].startsWith('http')) {
    const kind = detectMediaKindProfile(output[0]);
    return { url: output[0], kind };
  }
  if (typeof output !== 'object') {
    // Text fallback for text-to-text models
    if (typeof output === 'string' && output.trim()) {
      return { kind: 'text', text: output.length > 160 ? output.slice(0, 159) + '…' : output };
    }
    return null;
  }
  const url = output.resultUrl || output.url || output.imageUrl || output.videoUrl || output.audioUrl || output.mediaUrl || null;
  if (!url) return null;
  const kind = detectMediaKindProfile(url);
  return { url, kind };
}

function detectMediaKindProfile(url) {
  if (!url || typeof url !== 'string') return 'image';
  const lower = url.toLowerCase();
  if (/\.(mp4|webm|mov)(\?|#|$)/i.test(lower) || lower.includes('/video/')) return 'video';
  if (/\.(mp3|wav|ogg|m4a)(\?|#|$)/i.test(lower) || lower.includes('/audio/')) return 'audio';
  return 'image';
}

function resumeProfileQueuePolling() {
  const inProgress = state.outputs.filter(isHistoryItemInProgress);
  for (const item of inProgress) {
    const id = String(item?.runId || '');
    if (!id || _activePollers.has(id)) continue;

    let consecutiveErrors = 0;
    let enriched = item;
    const intervalId = setInterval(async () => {
      let job;
      try {
        job = await getJob(id);
        consecutiveErrors = 0;
      } catch (err) {
        consecutiveErrors += 1;
        if (consecutiveErrors >= 10) {
          clearInterval(intervalId);
          _activePollers.delete(id);
        }
        return;
      }

      // Enrich with input from job
      if (job.input && typeof job.input === 'object') {
        enriched = {
          ...enriched,
          input: { ...job.input, ...(enriched.input || {}) },
          prompt: enriched.prompt || job.input.prompt || job.input.text || '',
          agentId: enriched.agentId || job.agentId || '',
        };
      }

      const isTerminal = job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled';

      if (isTerminal) {
        clearInterval(intervalId);
        _activePollers.delete(id);

        const idx = state.outputs.findIndex(o => String(o?.runId || '') === id);
        if (idx !== -1) {
          if (job.status === 'completed' && job.output) {
            state.outputs[idx] = {
              ...enriched,
              _queueStatus: undefined,
              _queueProgress: undefined,
              preview: job.output ? pickPreviewFromOutput(job.output) : null,
            };
          } else {
            state.outputs.splice(idx, 1);
          }
          renderGrid(state.outputs, 'history');
        }
        return;
      }

      // Still running — lightweight DOM update
      const rawPct = typeof job.progress === 'number' && Number.isFinite(job.progress) ? job.progress : 0;
      const pct = rawPct > 0 && rawPct < 1 ? Math.round(rawPct * 100) : Math.round(rawPct);

      const idx = state.outputs.findIndex(o => String(o?.runId || '') === id);
      if (idx !== -1) {
        state.outputs[idx] = {
          ...enriched,
          _queueStatus: job.status === 'pending' ? 'pending' : 'processing',
          _queueProgress: pct,
        };
        const card = el.grid?.querySelector(`[data-queue-id="${CSS.escape(id)}"]`);
        if (card) {
          const pctEl = card.querySelector('.text-sm.font-bold');
          if (pctEl) pctEl.textContent = `${pct}%`;
          const barEl = card.querySelector('[style*="width"]');
          if (barEl) barEl.style.width = `${pct}%`;
          const labelEl = card.querySelector('p.text-xs.font-medium');
          if (labelEl) labelEl.textContent = job.status === 'pending' ? 'In Queue' : `Processing ${pct}%`;
        }
      }
    }, 2000);

    _activePollers.set(id, intervalId);
  }
}

function openFollowModal(mode) {
  state.followModal.open = true;
  state.followModal.mode = mode;
  state.followModal.users = [];
  state.followModal.nextCursor = null;
  if (el.followModalTitle) el.followModalTitle.textContent = mode === 'following' ? 'Following' : 'Followers';
  if (el.followModalBody) el.followModalBody.innerHTML = '';
  if (el.followModalLoadMore) el.followModalLoadMore.classList.add('hidden');
  el.followModal?.classList.remove('hidden');
  void loadFollowModalPage({ reset: true });
}

function closeFollowModal() {
  state.followModal.open = false;
  el.followModal?.classList.add('hidden');
}

function renderFollowModalUsers(users) {
  if (!el.followModalBody) return;
  el.followModalBody.innerHTML = users
    .map((u) => {
      const href = u?.username ? `/u/${encodeURIComponent(u.username)}` : '#';
      const avatar = u?.avatarUrl
        ? `<img src="${escapeHtml(u.avatarUrl)}" class="w-10 h-10 rounded-full object-cover" alt="" />`
        : `<div class="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-xs text-muted-foreground">@</div>`;
      return `
        <a href="${href}" class="flex items-center gap-3 p-2 rounded-ios-xl hover:bg-secondary/40 transition-colors">
          ${avatar}
          <div class="min-w-0">
            <div class="font-semibold truncate">@${escapeHtml(u.username || '')}</div>
            <div class="text-xs text-muted-foreground">${escapeHtml(formatRelativeTime(u.followedAt))}</div>
          </div>
        </a>
      `;
    })
    .join('');
}

async function loadFollowModalPage({ reset } = { reset: false }) {
  if (!state.followModal.open || state.followModal.loading) return;
  state.followModal.loading = true;
  setError('');

  if (reset) {
    state.followModal.users = [];
    state.followModal.nextCursor = null;
  }

  const qs = new URLSearchParams();
  qs.set('limit', '30');
  if (!reset && state.followModal.nextCursor) qs.set('cursor', state.followModal.nextCursor);
  const endpoint = `https://aitopia.ai/api/users/${encodeURIComponent(state.username)}/${state.followModal.mode}?${qs.toString()}`;

  const { res, json } = await api(endpoint, { method: 'GET' });
  if (!res.ok) {
    const msg = json?.error?.message || json?.error || `Failed to load (${res.status})`;
    setError(String(msg));
    state.followModal.loading = false;
    return;
  }

  const users = Array.isArray(json?.users) ? json.users : [];
  state.followModal.users = state.followModal.users.concat(users);
  state.followModal.nextCursor = json?.nextCursor || null;

  renderFollowModalUsers(state.followModal.users);

  if (el.followModalLoadMore) {
    el.followModalLoadMore.classList.toggle('hidden', !state.followModal.nextCursor);
  }

  state.followModal.loading = false;
}

function init() {
  state.username = getUsernameFromPath();
  if (!state.username) {
    setError('Invalid profile URL.');
    return;
  }

  el.followBtn?.addEventListener('click', () => void toggleFollow());

  el.tabCreations?.addEventListener('click', async () => {
    stopAllPollers();
    state.tab = 'creations';
    setActiveTab('creations');
    await loadTab('creations', { reset: true });
  });
  el.tabRemixes?.addEventListener('click', async () => {
    stopAllPollers();
    state.tab = 'remixes';
    setActiveTab('remixes');
    await loadTab('remixes', { reset: true });
  });
  el.tabHistory?.addEventListener('click', async () => {
    stopAllPollers();
    state.tab = 'history';
    setActiveTab('history');
    await loadTab('history', { reset: true });
  });
  el.tabPrivate?.addEventListener('click', async () => {
    stopAllPollers();
    state.tab = 'private';
    setActiveTab('private');
    await loadTab('private', { reset: true });
  });

  el.loadMore?.addEventListener('click', async () => {
    await loadTab(state.tab, { reset: false });
  });

  if (el.scrollSentinel && 'IntersectionObserver' in window) {
    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries?.[0]?.isIntersecting) return;
        if (state.loading) return;
        if (!state.nextCursor) return;
        void loadTab(state.tab, { reset: false });
      },
      { rootMargin: '300px 0px' },
    );
    obs.observe(el.scrollSentinel);
  }

  el.historyType?.addEventListener('change', () => {
    state.historyType = el.historyType?.value || 'all';
    if (state.tab === 'history') {
      renderGrid(state.outputs, 'history');
    }
  });

  el.statFollowers?.addEventListener('click', () => openFollowModal('followers'));
  el.statFollowing?.addEventListener('click', () => openFollowModal('following'));
  el.followModalBackdrop?.addEventListener('click', closeFollowModal);
  el.followModalClose?.addEventListener('click', closeFollowModal);
  el.followModalLoadMore?.addEventListener('click', () => void loadFollowModalPage({ reset: false }));

  // History modal
  const closeHistoryModal = () => {
    state.historyModal.open = false;
    state.historyModal.detail = null;
    el.historyModal?.classList.add('hidden');
    if (el.historyModalBody) el.historyModalBody.innerHTML = '';
  };

  async function openHistoryModal(runId) {
    if (!runId) return;
    state.historyModal.detail = null;

    const { res, json } = await api(`https://aitopia.ai/api/me/creations/${encodeURIComponent(runId)}`, { method: 'GET' });
    if (!res.ok) return;

    state.historyModal.detail = json;
    const run = json?.run || {};
    const derived = json?.derived || {};
    const output = {
      id: null, // History items don't have published output id, use runId for fetching
      runId: run.id,
      prompt: derived.prompt || '',
      // title and description are only for published creations, not history items
      preview: derived.preview || null,
      sourceStoreId: run.agentId || run.agent_id || '',
      agentId: run.agentId || run.agent_id || '',
      createdAt: run.createdAt || run.created_at || '',
      creatorProfile: null,
      creator: null,
      meta: {},
    };
    openCreationModal(output);
  }

  el.grid?.addEventListener('click', (e) => {
    const historyBtn = e.target?.closest?.('button[data-history-open]');
    if (historyBtn) {
      const runId = historyBtn.getAttribute('data-history-open');
      void openHistoryModal(runId);
      return;
    }
    const historyCard = e.target?.closest?.('.profile-history-card');
    if (historyCard && !e.target?.closest?.('a')) {
      const runId = historyCard.getAttribute('data-history-run-id');
      if (runId) void openHistoryModal(runId);
      return;
    }
    const card = e.target?.closest?.('.profile-card');
    if (card && !e.target?.closest?.('a')) {
      e.preventDefault();
      const id = card.getAttribute('data-output-id');
      const output = state.outputs.find((o) => String(o?.id || o?.runId) === id);
      if (output) openCreationModal(output);
    }
  });

  el.grid?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target?.closest?.('.profile-card');
    if (card) {
      e.preventDefault();
      const id = card.getAttribute('data-output-id');
      const output = state.outputs.find((o) => String(o?.id || o?.runId) === id);
      if (output) openCreationModal(output);
    }
  });

  el.modalClose?.addEventListener('click', closeCreationModal);
  el.modalCloseMobile?.addEventListener('click', closeCreationModal);
  el.modalMediaArea?.addEventListener('click', (e) => { if (e.target === el.modalMediaArea) closeCreationModal(); });
  el.modalCopyPrompt?.addEventListener('click', async () => {
    if (!currentCreationModalOutput) return;
    const text = currentCreationModalOutput?.prompt || currentCreationModalOutput?.title || currentCreationModalOutput?.description || '';
    try {
      await navigator.clipboard.writeText(text);
      const btn = el.modalCopyPrompt;
      if (btn) { const t = btn.textContent; btn.textContent = 'Copied!'; setTimeout(() => { btn.textContent = t; }, 1500); }
    } catch {}
  });
  el.modalDownload?.addEventListener('click', async () => {
    if (!currentCreationModalOutput?.preview?.url) return;
    const url = currentCreationModalOutput.preview.url;
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const ext = currentCreationModalOutput.preview.kind === 'video' ? 'mp4' : currentCreationModalOutput.preview.kind === 'audio' ? 'mp3' : 'png';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `creation-${currentCreationModalOutput?.id || 'download'}.${ext}`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(url, '_blank');
    }
  });

  el.modalPublish?.addEventListener('click', () => {
    if (!currentCreationModalOutput) return;
    openPublishModal({
      runId: currentCreationModalOutput.runId,
      idempotencyKey: currentCreationModalOutput.idempotencyKey,
      prompt: currentCreationModalOutput.prompt || currentCreationModalOutput.title || currentCreationModalOutput.description || '',
      input: currentCreationModalOutput.input || {},
      agentId: currentCreationModalOutput.sourceStoreId || currentCreationModalOutput.agentId || '',
    });
  });

  window.addEventListener('aitopia:outputs:published', () => {
    if (el.modalPublish) {
      el.modalPublish.classList.add('hidden');
      el.modalPublish.style.display = '';
    }
  });

  el.historyModalBackdrop?.addEventListener('click', closeHistoryModal);
  el.historyModalClose?.addEventListener('click', closeHistoryModal);
  el.historyCopyBtn?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(state.historyModal.detail ?? {}, null, 2));
    } catch {
      // ignore
    }
  });

  void loadProfile();
}

init();
