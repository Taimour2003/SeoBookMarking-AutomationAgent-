import { getStoreAgent, getAgentSchema, runStoreAgent, getJob, getRun, checkAuthOrRedirect } from '../shared/api.js';
import { renderSchemaForm } from './schema-form.js';
import { collectMediaUrls, renderOutput, renderError } from './result-renderer.js';
import { getOverrideModulePath } from './overrides-registry.js';
import { createProgressController, normalizeJobProgress } from './progress.js';
import { createCreationHistoryPanel } from './creation-history.js';
import { pricingModal } from '../shared/pricing-modal.js';
import { openPublishModal, openDynamicCreationModal } from '../shared/creation-modal.js';
import { extractThumb, saveSnapshot, renderPendingPaidInto, fetchBalance, isInsufficient, showAgreementModal } from '../shared/pending-paid.js';

function uuid() {
  try {
    return crypto.randomUUID();
  } catch {
    return `uuid-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function safeJsonParse(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text };
  }
}

function deepCloneJson(value) {
  try {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeFileName(value) {
  return String(value ?? "")
    .replaceAll("/", "-")
    .replaceAll("\\", "-")
    .replaceAll(":", "-")
    .replaceAll("*", "-")
    .replaceAll("?", "-")
    .replaceAll('"', "-")
    .replaceAll("<", "-")
    .replaceAll(">", "-")
    .replaceAll("|", "-");
}


function isEmbedRunnerDebugEnabled() {
  try {
    const params = new URLSearchParams(window.location.search || '');
    if (params.has('debugRunner') || params.has('debugEmbedRunner') || params.get('debug') === '1') return true;
    return window.localStorage?.getItem('DEBUG_EMBED_RUNNER') === '1';
  } catch {
    return false;
  }
}

function renderHistoryGenerating(container, { title = 'Generating…', subtitle = '', prompt = '', model = '' } = {}) {
  if (!container) return;
  const promptLine = String(prompt || '').trim();
  const modelLine = String(model || '').trim();
  const showDetailsBox = modelLine || promptLine;

  container.innerHTML = `
    <div class="w-full h-full min-h-[420px] flex flex-col items-center justify-center px-6 py-10">
      <div class="w-full max-w-sm rounded-ios-2xl border border-border bg-card/50 dark:bg-card/30 p-8 shadow-sm">
        <div class="flex flex-col items-center">
          <div class="relative w-14 h-14 mb-5">
            <div class="absolute inset-0 rounded-full border-2 border-primary/20"></div>
            <div class="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin" style="animation-duration: 1.2s;"></div>
            <div class="absolute inset-2 rounded-full bg-primary/5 flex items-center justify-center">
              <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6l4 2"></path>
                <path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
          </div>
          <p class="text-sm font-medium text-muted-foreground uppercase tracking-wider">${escapeHtml(title)}</p>
          ${subtitle ? `<p class="mt-1 text-xs text-muted-foreground">${escapeHtml(subtitle)}</p>` : ''}
          <div class="mt-4 w-full">
            <div class="h-2.5 w-full rounded-full bg-secondary/80 dark:bg-secondary/40 overflow-hidden">
              <div class="h-full w-1/3 rounded-full bg-gradient-to-r from-primary to-primary/80 animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>
      ${showDetailsBox ? `
      <div class="mt-6 w-full max-w-2xl text-left rounded-ios-xl border border-border bg-card/40 dark:bg-card/20 p-4 border-l-4 border-l-primary/50 min-h-[80px]">
        ${modelLine ? `<div class="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Model</div><div class="text-sm font-medium text-foreground">${escapeHtml(modelLine)}</div>` : ''}
        ${promptLine ? `<div class="text-xs font-medium text-muted-foreground uppercase tracking-wide mt-3 mb-1.5">Prompt</div><div class="text-sm text-foreground/90 whitespace-pre-wrap break-words">${escapeHtml(promptLine)}</div>` : ''}
      </div>
      ` : ''}
    </div>
  `;
}

function formatCostEstimate(costEstimate) {
  if (!costEstimate || typeof costEstimate !== 'object') return null;
  const min = Number(costEstimate.minCost);
  const max = Number(costEstimate.maxCost);
  const currency = String(costEstimate.currency || '').toUpperCase();
  if (!Number.isFinite(min) || !Number.isFinite(max) || !currency) return null;
  if (min === max) return `${min.toFixed(2)} ${currency}`;
  return `${min.toFixed(2)}–${max.toFixed(2)} ${currency}`;
}

/**
 * Sync the Creation History output panel height with the left panel.
 * Sets --left-panel-height CSS variable on the document root.
 */
function syncPanelHeights() {
  const leftPanel = document.querySelector('[data-agent-run-left]');
  if (!leftPanel) return;

  // Get the actual height of the left panel content
  const height = leftPanel.offsetHeight;
  if (height > 0) {
    document.documentElement.style.setProperty('--left-panel-height', `${height}px`);
  }
}

function setHistoryOutputContainerMode(container, output) {
  if (!container) return;
  const historyPanel = container.closest?.('[data-agent-run-panel="history"]');
  if (!historyPanel) return;
  //container.classList.add('history-output-height');
  const media = output ? collectMediaUrls(output) : { images: [], videos: [], audios: [] };
  const visualCount = (media.images?.length || 0) + (media.videos?.length || 0);
  const hasAudio = (media.audios?.length || 0) > 0;
  const singleVisual = visualCount === 1 && !hasAudio;
  container.classList.toggle('history-output-media-contained', singleVisual);
}

function queryScopedOrDocument(root, selector) {
  if (!selector) return null;
  const scoped = root?.querySelector?.(selector);
  if (scoped) return scoped;
  const doc = root?.ownerDocument || document;
  return doc?.querySelector?.(selector) || null;
}

function queryAllScopedOrDocument(root, selector) {
  const scoped = Array.from(root?.querySelectorAll?.(selector) || []);
  if (scoped.length > 0) return scoped;
  const doc = root?.ownerDocument || document;
  return Array.from(doc?.querySelectorAll?.(selector) || []);
}

function renderMiniAgentCard(agent) {
  const id = String(agent?.id || '').trim();
  const name = String(agent?.name || agent?.title || id || 'Agent').trim();
  const description = String(agent?.description || '').trim();
  const category = String(agent?.primaryCategory || agent?.category || '').trim();
  const cost = formatCostEstimate(agent?.costEstimate);

  const iconUrl = id ? `/agent-images/${encodeURIComponent(id)}-icon.webp` : '/marketplace/favicon.ico';
  const safeName = escapeHtml(name);
  const safeCategory = escapeHtml(category);
  const safeDesc = escapeHtml(description);
  const costLine = cost ? `<div class="text-xs text-muted-foreground">Estimated: ${escapeHtml(cost)}</div>` : '';

  return `
    <div class="flex items-start gap-3">
      <img
        src="${iconUrl}"
        alt="${safeName}"
        class="w-10 h-10 rounded-full border border-border bg-card object-cover"
        data-fallback="/marketplace/favicon.ico"
      />
      <div class="min-w-0 flex-1">
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <div class="font-semibold leading-tight truncate">${safeName}</div>
            ${category ? `<div class="text-xs text-muted-foreground truncate">${safeCategory}</div>` : ''}
          </div>
        </div>
        ${safeDesc ? `<div class="mt-2 text-xs text-muted-foreground line-clamp-2">${safeDesc}</div>` : ''}
        ${costLine ? `<div class="mt-2">${costLine}</div>` : ''}
      </div>
    </div>
  `;
}

function setupRunnerTabs(root) {
  const buttons = queryAllScopedOrDocument(root, '[data-agent-run-tab]');
  const panels = queryAllScopedOrDocument(root, '[data-agent-run-panel]');
  const creationsTab = queryScopedOrDocument(root, '[data-agent-run-tab="creations"]');
  const openCreationsBtn = root.querySelector('[data-agent-run-open-creations]');
  const rightPanel = root.querySelector('[data-agent-run-right]');

  // When the page's inline script already manages tabs (agent detail pages),
  // delegate to it instead of running a second, conflicting tab system.
  const pageManagesTabs = typeof window.__AITOPIA_SET_TAB__ === 'function';

  if (buttons.length === 0 || panels.length === 0 || pageManagesTabs) {
    let onTabChangeCallback = null;

    if (pageManagesTabs) {
      // Wrap the page's setActiveTab so embed-runner can listen for tab changes
      const origSetTab = window.__AITOPIA_SET_TAB__;
      window.__AITOPIA_SET_TAB__ = (id) => {
        origSetTab(id);
        if (onTabChangeCallback) {
          try { onTabChangeCallback(id); } catch (e) { console.error('[embed-runner] onTabChange error:', e); }
        }
      };

      // Also intercept click events on tab buttons for the onTabChange callback
      for (const btn of buttons) {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-agent-run-tab');
          if (id && onTabChangeCallback) {
            // Small delay to let the page's handler run first
            setTimeout(() => {
              try { onTabChangeCallback(id); } catch (e) { console.error('[embed-runner] onTabChange error:', e); }
            }, 0);
          }
        });
      }
    }

    return {
      setTab: (id) => {
        if (typeof window.__AITOPIA_SET_TAB__ === 'function') {
          window.__AITOPIA_SET_TAB__(id);
        }
      },
      showCreationsTab: () => { },
      get onTabChange() { return onTabChangeCallback; },
      set onTabChange(fn) { onTabChangeCallback = fn; },
    };
  }

  const selectedBtn = buttons.find((b) => b.getAttribute('aria-selected') === 'true');
  const hasAboutTab = buttons.some(b => b.getAttribute('data-agent-run-tab') === 'about');
  const hasOutputTab = buttons.some(b => b.getAttribute('data-agent-run-tab') === 'output');
  let active =
    selectedBtn?.getAttribute('data-agent-run-tab') ||
    (hasAboutTab ? 'about' : (hasOutputTab ? 'output' : (buttons[0]?.getAttribute('data-agent-run-tab') || 'about')));

  const mqDesktop = window.matchMedia('(min-width: 1024px)');
  const mqXl = window.matchMedia('(min-width: 1280px)');
  let creationsOpen = false;

  let onTabChangeCallback = null;

  function setButtonActive(btn, isActive) {
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    btn.classList.toggle('bg-card', isActive);
    btn.classList.toggle('bg-background', isActive);
    btn.classList.toggle('shadow-sm', isActive);
    btn.classList.toggle('text-foreground', isActive);
    btn.classList.toggle('text-muted-foreground', !isActive);
    btn.classList.toggle('bg-white', isActive);
    btn.classList.toggle('dark:bg-[#272727]', isActive);
    btn.classList.toggle('text-[#0D0D0D]', isActive);
    btn.classList.toggle('dark:text-foreground', isActive);
    btn.classList.toggle('text-[#898A8B]', !isActive);
    btn.classList.toggle('dark:text-muted-foreground', !isActive);
  }

  function apply() {
    const isDesktop = mqDesktop.matches;

    for (const panel of panels) {
      const id = panel.getAttribute('data-agent-run-panel');
      if (isDesktop) {
        if (id === 'creations') {
          panel.classList.toggle('hidden', !(mqXl.matches || creationsOpen));
        } else {
          panel.classList.toggle('hidden', id !== active);
        }
      } else {
        panel.classList.toggle('hidden', id !== active);
      }
    }

    for (const btn of buttons) {
      const id = btn.getAttribute('data-agent-run-tab');
      setButtonActive(btn, id === active);
    }

    if (!isDesktop && active === 'creations' && rightPanel) {
      rightPanel.classList.remove('hidden');
    }
  }

  for (const btn of buttons) {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-agent-run-tab') || active;
      const prevActive = active;
      active = id;
      apply();

      if (prevActive !== active && onTabChangeCallback) {
        try {
          onTabChangeCallback(active);
        } catch (err) {
          console.error('[embed-runner] onTabChange callback error:', err);
        }
      }
    });
  }

  mqDesktop.addEventListener?.('change', apply);
  mqXl.addEventListener?.('change', apply);

  if (openCreationsBtn && rightPanel) {
    openCreationsBtn.addEventListener('click', () => {
      if (!mqDesktop.matches) {
        active = 'creations';
      } else {
        creationsOpen = !creationsOpen;
      }
      if (creationsTab) creationsTab.classList.remove('hidden');
      apply();
    });
  }

  function setTab(id) {
    const prevActive = active;
    active = id;
    apply();

    if (prevActive !== active && onTabChangeCallback) {
      try {
        onTabChangeCallback(active);
      } catch (err) {
        console.error('[embed-runner] onTabChange callback error:', err);
      }
    }
  }

  function showCreationsTab() {
    if (creationsTab) creationsTab.classList.remove('hidden');
  }

  apply();

  return {
    setTab,
    showCreationsTab,
    get onTabChange() { return onTabChangeCallback; },
    set onTabChange(fn) { onTabChangeCallback = fn; },
  };
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

function renderCreationsSkeleton(count = 6) {
  const rows = [];
  for (let i = 0; i < count; i++) {
    rows.push(`
      <div class="flex items-center gap-3">
        <div class="w-14 h-14 rounded-ios-xl skeleton"></div>
        <div class="flex-1 space-y-2">
          <div class="h-3 w-2/3 rounded skeleton"></div>
          <div class="h-3 w-1/2 rounded skeleton"></div>
        </div>
      </div>
    `);
  }
  return rows.join('');
}

function renderCreationThumb(preview) {
  const kind = preview?.kind;
  const url = typeof preview?.url === 'string' ? preview.url : '';
  if (kind === 'image' && url) {
    return `<img src="${escapeHtml(url)}" alt="" class="w-14 h-14 rounded-ios-xl border border-border object-cover bg-card" loading="lazy" />`;
  }
  if (kind === 'video') {
    return `<div class="w-14 h-14 rounded-ios-xl border border-border bg-secondary flex items-center justify-center text-lg">🎬</div>`;
  }
  if (kind === 'audio') {
    return `<div class="w-14 h-14 rounded-ios-xl border border-border bg-secondary flex items-center justify-center text-lg">🎧</div>`;
  }
  return `<div class="w-14 h-14 rounded-ios-xl border border-border bg-secondary flex items-center justify-center text-lg">🎨</div>`;
}

function getCreatorDisplay(output, fallback) {
  const profile = output?.creatorProfile || output?.creator;
  if (profile?.username) {
    const href = `/u/${encodeURIComponent(profile.username)}`;
    return `<a href="${href}" class="text-primary hover:underline stop-propagation">@${escapeHtml(profile.username)}</a>`;
  }
  const uid = output?.creatorUserId;
  if (uid) return escapeHtml(String(uid).slice(0, 12));
  return escapeHtml(fallback || 'anonymous');
}

function renderCreationGridItem(output, tab) {
  const id = String(output?.id || output?.runId || '');
  const title = String(output?.title || output?.prompt || 'Untitled');
  const createdAt = output?.createdAt || '';
  const preview = output?.preview;
  const kind = preview?.kind;
  const url = typeof preview?.url === 'string' ? preview.url : '';
  const sourceStoreId = String(output?.sourceStoreId || output?.agentId || '');
  const isRun = Boolean(output?.runId);
  const isModelSource = sourceStoreId.includes('/');
  const remixHref = isModelSource
    ? `/${sourceStoreId}?remixRunId=${encodeURIComponent(id)}`
    : isRun
      ? `/aitopia/marketplace/agent/${encodeURIComponent(sourceStoreId)}.html?remixRunId=${encodeURIComponent(id)}`
      : `/aitopia/marketplace/agent/${encodeURIComponent(sourceStoreId)}.html?remixOutputId=${encodeURIComponent(id)}`;

  const isCommunity = tab !== 'mine';
  const likeCount = Number(output?.likeCount ?? 0);
  const viewerHasLiked = Boolean(output?.viewerHasLiked);
  const commentCount = Number(output?.commentCount ?? 0);
  const remixCount = Number(output?.remixCount ?? 0);

  let mediaHtml = '';
  if (kind === 'video' && url) {
    mediaHtml = `<video src="${escapeHtml(url)}" class="w-full h-auto rounded-ios-xl" autoplay muted loop playsinline></video>`;
  } else if (kind === 'audio') {
    mediaHtml = `<div class="rounded-ios-xl bg-secondary/50 min-h-[120px] flex items-center justify-center text-5xl">🎧</div>`;
  } else if ((kind === 'image' || !kind) && url) {
    mediaHtml = `<img src="${escapeHtml(url)}" alt="" class="w-full h-auto rounded-ios-xl" loading="lazy" />`;
  } else {
    mediaHtml = `<div class="rounded-ios-xl bg-secondary/50 min-h-[120px] flex items-center justify-center text-5xl">🎨</div>`;
  }

  const timeStr = createdAt ? formatRelativeTime(createdAt) : '';

  return `
    <div class="remix-item group cursor-pointer" data-creation-id="${escapeHtml(id)}">
      <div class="relative overflow-hidden rounded-ios-xl">
        ${mediaHtml}
        <div class="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-ios-xl flex flex-col justify-end p-3.5">
          <div class="transform translate-y-3 group-hover:translate-y-0 transition-transform duration-300 ease-out">
            <h3 class="text-white font-semibold text-[13px] leading-snug line-clamp-2">${escapeHtml(title)}</h3>
            <p class="text-white/80 text-[11px] mt-0.5 truncate">${escapeHtml(sourceStoreId || 'unknown')}${timeStr ? ` &middot; ${escapeHtml(timeStr)}` : ''}${!isRun ? ` &middot; ${getCreatorDisplay(output, isCommunity ? 'anonymous' : 'me')}` : ''}</p>
            ${!isRun ? `<div class="flex items-center gap-3 mt-1.5 text-white/70 text-[11px]">
              <span class="inline-flex items-center gap-1"><svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"/></svg><span data-like-count-display="${escapeHtml(id)}">${likeCount}</span></span>
              <span class="inline-flex items-center gap-1"><svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z"/></svg>${commentCount}</span>
              <span class="inline-flex items-center gap-1"><svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3"/></svg>${remixCount}</span>
            </div>` : ''}
            <div class="flex gap-1.5 sm:gap-2 mt-2 sm:mt-2.5">
              <button type="button" class="flex-1 h-7 sm:h-8 flex items-center justify-center rounded-full bg-white/95 text-gray-900 text-[11px] sm:text-xs font-semibold hover:bg-white transition-colors backdrop-blur-sm">
                View
              </button>
              <a href="${remixHref}" class="stop-propagation flex-1 h-7 sm:h-8 flex items-center justify-center gap-1 sm:gap-1.5 rounded-full bg-[#9335EC] hover:bg-[#7B2BD6] text-white text-[11px] sm:text-xs font-semibold transition-colors">
                <svg class="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3"/></svg>
                Remix
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderCreationsRailItem(output, tab) {
  const id = String(output?.id || output?.runId || '');
  const title = String(output?.title || output?.prompt || 'Untitled');
  const createdAt = output?.createdAt;
  const sourceStoreId = String(output?.sourceStoreId || output?.agentId || '');
  const isRun = Boolean(output?.runId);
  const remixHref = isRun
    ? `/aitopia/marketplace/agent/${encodeURIComponent(sourceStoreId)}.html?remixRunId=${encodeURIComponent(id)}`
    : `/aitopia/marketplace/agent/${encodeURIComponent(sourceStoreId)}.html?remixOutputId=${encodeURIComponent(id)}`;

  const badges = [];
  if (tab === 'mine' && !isRun) {
    const visibility = String(output?.visibility || '');
    const moderation = String(output?.moderationStatus || '');
    if (visibility) badges.push(`<span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-secondary text-muted-foreground">${escapeHtml(visibility)}</span>`);
    if (visibility === 'public' && moderation) {
      const tone = moderation === 'approved' ? 'bg-green-500/15 text-green-500'
        : moderation === 'rejected' ? 'bg-red-500/15 text-red-500'
          : 'bg-amber-500/15 text-amber-500';
      badges.push(`<span class="px-2 py-0.5 rounded-full text-[11px] font-semibold ${tone}">${escapeHtml(moderation)}</span>`);
    }
  }

  return `
      <div class="rounded-ios-xl border border-border bg-card p-3 hover:border-primary/30 transition-colors cursor-pointer" data-creation-id="${escapeHtml(id)}">
        <div class="flex items-center gap-3">
          ${renderCreationThumb(output?.preview)}
          <div class="min-w-0 flex-1">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <div class="text-sm font-semibold truncate" title="${escapeHtml(title)}">${escapeHtml(title)}</div>
                <div class="mt-0.5 text-xs text-muted-foreground truncate">
                  ${output?.creatorProfile?.username
                    ? `<a href="/aitopia/marketplace/profile.html?username=${encodeURIComponent(output.creatorProfile.username)}" class="text-primary hover:underline">@${escapeHtml(output.creatorProfile.username)}</a> • `
                    : ''}${escapeHtml(sourceStoreId)}${createdAt ? ` • ${escapeHtml(formatRelativeTime(createdAt))}` : ''}
                </div>
              </div>
              ${badges.length ? `<div class="flex flex-col items-end gap-1 shrink-0">${badges.join('')}</div>` : ''}
            </div>
            <div class="mt-2 flex items-center gap-2">
              <button type="button" class="flex-1 h-9 inline-flex items-center justify-center rounded-full bg-secondary hover:bg-secondary/80 text-xs font-semibold transition-colors">View</button>
              <a href="${remixHref}" class="flex-1 h-9 inline-flex items-center justify-center gap-1.5 rounded-full bg-[#9335EC] hover:bg-[#7B2BD6] text-white text-xs font-semibold transition-colors">
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
          </div>
        </div>
      </div>
    `;
}

async function fetchOutputsList({ tab, sourceStoreId, limit = 12, offset = 0 } = {}) {
  // If tab is 'mine', fetch personal run history from /api/me/creations
  if (tab === 'mine') {
    const base = 'https://aitopia.ai/api/me/creations';
    // Pass agentId filter if we are on a specific agent page
    const url = `${base}?limit=${encodeURIComponent(String(limit))}&agentId=${encodeURIComponent(String(sourceStoreId || ''))}`;
    try {
      const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
      const json = safeJsonParse(await res.text());
      return { res, json, error: null };
    } catch (error) {
      return { res: null, json: null, error };
    }
  }

  const base = 'https://aitopia.ai/api/outputs';
  const url = `${base}?limit=${encodeURIComponent(String(limit))}&offset=${encodeURIComponent(String(offset))}&sourceStoreId=${encodeURIComponent(String(sourceStoreId || ''))}`;
  try {
    const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } });
    const json = safeJsonParse(await res.text());
    return { res, json, error: null };
  } catch (error) {
    return { res: null, json: null, error };
  }
}

function mountCreationsRail(container, { sourceStoreId, tabs }) {
  if (!container) return { refresh: () => { } };

  tabs?.showCreationsTab?.();

  const state = { tab: 'community', loading: false, outputs: [], offset: 0, hasMore: true };
  const tabPanelId = `creations-panel-${Math.random().toString(16).slice(2)}`;

  const parentCard = container.closest('[data-agent-run-creations]');
  const hasRemixTabs = Boolean(parentCard?.querySelector?.('[data-remix-tab]'));
  const hasRemixGrid = Boolean(parentCard?.querySelector?.('.remix-grid') || container.querySelector?.('.remix-grid'));
  const isNewRemixLayout = container.classList.contains('p-4') || hasRemixTabs || hasRemixGrid;

  if (isNewRemixLayout) {
    if (parentCard) parentCard.style.overflow = 'visible';
    const existingTabs = parentCard?.querySelectorAll('[data-remix-tab]');
    const gridContainer = container.querySelector('.remix-grid') || container;

    gridContainer.addEventListener('click', (e) => {
      const card = e.target.closest('[data-creation-id]');
      if (!card) return;
      if (e.target.closest('a')) return;
      const creationId = card.getAttribute('data-creation-id');
      const output = state.outputs.find(o => String(o?.id || o?.runId || '') === creationId);
      if (output) openDynamicCreationModal(output);
    });

    if (existingTabs?.length) {
      existingTabs.forEach(btn => {
        btn.addEventListener('click', () => {
          const newTab = btn.getAttribute('data-remix-tab');
          if (newTab && newTab !== state.tab) {
            state.tab = newTab;
            existingTabs.forEach(b => {
              const isActive = b.getAttribute('data-remix-tab') === newTab;
              // Active classes
              b.classList.toggle('bg-white', isActive);
              b.classList.toggle('dark:bg-[#272727]', isActive);
              b.classList.toggle('text-[#0D0D0D]', isActive);
              b.classList.toggle('dark:text-foreground', isActive);
              b.classList.toggle('shadow-sm', isActive);
              // Inactive classes
              b.classList.toggle('text-[#898A8B]', !isActive);
              b.classList.toggle('dark:text-muted-foreground', !isActive);
            });
            void loadNewLayout();
          }
        });
      });
    }

    async function loadNewLayout({ append } = { append: false }) {
      if (state.loading) return;
      if (append && !state.hasMore) return;
      state.loading = true;

      if (!append) {
        state.offset = 0;
        state.outputs = [];
        state.hasMore = true;
        gridContainer.innerHTML = `
          <div class="w-full flex items-center justify-center py-8">
            <div class="animate-spin w-6 h-6 border-2 border-primary/90 border-t-transparent rounded-full"></div>
          </div>
        `;
      }

      const { res, json, error } = await fetchOutputsList({ tab: state.tab, sourceStoreId, limit: 10, offset: state.offset });

      if (!res || !res.ok) {
        if (!append) {
          const msg = error?.message || json?.error || 'Failed to load';
          gridContainer.innerHTML = `
            <div class="w-full text-center py-8 text-muted-foreground text-sm">${escapeHtml(msg)}</div>
          `;
        }
        state.loading = false;
        return;
      }

      const list = json?.outputs || json?.creations || [];
      const outputs = Array.isArray(list) ? list : [];
      state.outputs = append ? state.outputs.concat(outputs) : outputs;
      state.offset += outputs.length;
      state.hasMore = outputs.length >= 10;

      if (state.outputs.length === 0) {
        gridContainer.innerHTML = `
          <div class="w-full flex flex-col items-center justify-center min-h-[200px] text-[#898A8B]" style="column-span:all">
            <img src="https://aitopia.ai/icons/gallery.svg" alt="" class="w-9 h-9 mb-3">
            <p class="text-sm">No creations yet.</p>
          </div>
        `;
      } else if (append) {
        const temp = document.createElement('div');
        temp.innerHTML = outputs.map(o => renderCreationGridItem(o, state.tab)).join('');
        Array.from(temp.children).forEach(child => gridContainer.appendChild(child));
        gridContainer.querySelectorAll('.remix-item video').forEach(video => {
          video.play?.().catch(() => {});
        });
      } else {
        gridContainer.innerHTML = outputs.map(o => renderCreationGridItem(o, state.tab)).join('');
        gridContainer.querySelectorAll('.remix-item video').forEach(video => {
          video.play?.().catch(() => {});
        });
      }

      state.loading = false;
    }

    // Infinite scroll
    {
      const sentinel = document.createElement('div');
      sentinel.className = 'creations-scroll-sentinel';
      sentinel.style.height = '1px';
      const remixArea = container.closest('[data-agent-run-creations]');
      (remixArea?.parentElement || gridContainer.parentElement)?.insertBefore(sentinel, (remixArea || gridContainer).nextSibling);

      const obs = new IntersectionObserver((entries) => {
        if (!entries?.[0]?.isIntersecting || state.loading || !state.hasMore) return;
        void loadNewLayout({ append: true });
      }, { rootMargin: '400px 0px' });

      let userScrolled = false;
      function onFirstScroll() {
        userScrolled = true;
        window.removeEventListener('scroll', onFirstScroll);
        if (!state.loading && state.hasMore) obs.observe(sentinel);
      }
      window.addEventListener('scroll', onFirstScroll, { passive: true });

      const origLoadNew = loadNewLayout;
      loadNewLayout = async function(opts) {
        await origLoadNew(opts);
        if (state.hasMore && userScrolled) {
          obs.disconnect();
          setTimeout(() => { if (state.hasMore) obs.observe(sentinel); }, 300);
        }
      };
    }

    void loadNewLayout();

    return {
      refresh: () => void loadNewLayout({ append: false }),
      destroy: () => { },
    };
  }

  container.innerHTML = `
    <div class="inline-flex rounded-full bg-secondary p-1 w-fit" role="tablist" aria-label="Creations filter">
      <button type="button" role="tab" aria-controls="${tabPanelId}" data-creations-tab="community" class="px-3 py-1.5 text-xs font-semibold rounded-full bg-background shadow-sm">Community</button>
      <button type="button" role="tab" aria-controls="${tabPanelId}" data-creations-tab="mine" class="px-3 py-1.5 text-xs font-semibold rounded-full text-muted-foreground hover:text-foreground">Mine</button>
    </div>
    <div data-creations-notice class="mt-2 hidden rounded-ios-xl border border-border bg-card p-3 text-xs"></div>
    <div id="${tabPanelId}" role="tabpanel" data-creations-list class="mt-2 space-y-2">${renderCreationsSkeleton()}</div>
    <div class="mt-2">
      <a href="/aitopia/marketplace/outputs.html" class="text-xs text-muted-foreground hover:text-foreground transition-colors">Open full Creations gallery →</a>
    </div>
  `;

  const notice = container.querySelector('[data-creations-notice]');
  const listEl = container.querySelector('[data-creations-list]');
  const btnCommunity = container.querySelector('[data-creations-tab="community"]');
  const btnMine = container.querySelector('[data-creations-tab="mine"]');

  if (listEl) {
    listEl.addEventListener('click', (e) => {
      const card = e.target.closest('[data-creation-id]');
      if (!card) return;
      if (e.target.closest('a')) return;
      const creationId = card.getAttribute('data-creation-id');
      const output = state.outputs.find(o => String(o?.id || o?.runId || '') === creationId);
      if (output) openDynamicCreationModal(output);
    });
  }

  function setNotice(message, tone = 'info') {
    if (!notice) return;
    if (!message) {
      notice.classList.add('hidden');
      notice.textContent = '';
      return;
    }
    notice.classList.remove('hidden');
    notice.classList.toggle('text-red-500', tone === 'error');
    notice.classList.toggle('text-muted-foreground', tone !== 'error');
    notice.textContent = message;
    notice.setAttribute('role', tone === 'error' ? 'alert' : 'status');
    notice.setAttribute('aria-live', 'polite');
  }

  function setActiveTab(tab) {
    const on = (btn) => {
      btn.classList.add('bg-background', 'shadow-sm');
      btn.classList.remove('text-muted-foreground');
      btn.setAttribute('aria-selected', 'true');
      btn.tabIndex = 0;
    };
    const off = (btn) => {
      btn.classList.remove('bg-background', 'shadow-sm');
      btn.classList.add('text-muted-foreground');
      btn.setAttribute('aria-selected', 'false');
      btn.tabIndex = -1;
    };

    if (tab === 'mine') {
      off(btnCommunity);
      on(btnMine);
    } else {
      on(btnCommunity);
      off(btnMine);
    }
  }

  async function load({ force, append } = {}) {
    if (state.loading && !force) return;
    if (append && !state.hasMore) return;
    state.loading = true;
    setNotice('');

    if (!append) {
      state.offset = 0;
      state.outputs = [];
      state.hasMore = true;
      if (listEl) listEl.innerHTML = renderCreationsSkeleton();
    }

    const { res, json, error } = await fetchOutputsList({ tab: state.tab, sourceStoreId, limit: 10, offset: state.offset });
    if (!res) {
      const msg = error instanceof Error ? error.message : String(error || 'Network error');
      setNotice(`Failed to load creations: ${msg}`, 'error');
      if (listEl) {
        listEl.innerHTML = `
          <div class="rounded-ios-xl border border-border bg-card p-4 text-sm">
            <div class="text-red-500 font-semibold">Could not load creations</div>
            <div class="mt-2 text-xs text-muted-foreground">${escapeHtml(String(msg))}</div>
            <button type="button" data-creations-retry aria-label="Retry loading creations" class="mt-3 h-9 px-4 rounded-full bg-secondary hover:bg-secondary/80 text-xs font-semibold">Retry</button>
          </div>
        `;
        listEl.querySelector('[data-creations-retry]')?.addEventListener('click', () => void load({ force: true }));
      }
      state.loading = false;
      return;
    }

    if (!res.ok) {
      if (state.tab === 'mine' && (res.status === 401 || res.status === 403)) {
        setNotice('Sign in to see your private/unlisted creations.', 'error');
        if (listEl) listEl.innerHTML = '';
        state.loading = false;
        return;
      }

      const msg = json?.error?.message || json?.error || `Failed to load creations (${res.status})`;
      setNotice(String(msg), 'error');
      if (listEl) {
        listEl.innerHTML = `
          <div class="rounded-ios-xl border border-border bg-card p-4 text-sm">
            <div class="text-red-500 font-semibold">Could not load creations</div>
            <div class="mt-2 text-xs text-muted-foreground">${escapeHtml(String(msg))}</div>
            <button type="button" data-creations-retry aria-label="Retry loading creations" class="mt-3 h-9 px-4 rounded-full bg-secondary hover:bg-secondary/80 text-xs font-semibold">Retry</button>
          </div>
        `;
        listEl.querySelector('[data-creations-retry]')?.addEventListener('click', () => void load({ force: true }));
      }
      state.loading = false;
      return;
    }

    const list = json?.outputs || json?.creations || [];
    const outputs = Array.isArray(list) ? list : [];
    state.outputs = append ? state.outputs.concat(outputs) : outputs;
    state.offset += outputs.length;
    state.hasMore = outputs.length >= 10;

    if (listEl) {
      if (append && outputs.length > 0) {
        listEl.insertAdjacentHTML('beforeend', outputs.map((o) => renderCreationsRailItem(o, state.tab)).join(''));
      } else if (!append) {
        listEl.innerHTML = state.outputs.length
          ? state.outputs.map((o) => renderCreationsRailItem(o, state.tab)).join('')
          : `<div class="w-full flex flex-col items-center justify-center min-h-[200px] text-[#898A8B]" style="column-span:all"><img src="https://aitopia.ai/icons/gallery.svg" alt="" class="w-9 h-9 mb-3"><p class="text-sm">No creations yet.</p></div>`;
      }
    }

    state.loading = false;
  }

  btnCommunity?.addEventListener('click', () => {
    state.tab = 'community';
    setActiveTab('community');
    void load();
  });
  btnMine?.addEventListener('click', () => {
    state.tab = 'mine';
    setActiveTab('mine');
    void load();
  });

  setActiveTab('community');

  // Allow container to grow for infinite scroll
  const legacyRemixArea = container.closest('[data-agent-run-creations]');
  if (legacyRemixArea) legacyRemixArea.style.overflow = 'visible';

  // Infinite scroll for legacy rail
  if (listEl) {
    const sentinel = document.createElement('div');
    sentinel.className = 'creations-scroll-sentinel';
    sentinel.style.height = '1px';
    const railArea = container.closest('[data-agent-run-creations]');
    (railArea?.parentElement || listEl.parentElement)?.insertBefore(sentinel, (railArea || listEl).nextSibling);

    const obs = new IntersectionObserver((entries) => {
      if (!entries?.[0]?.isIntersecting || state.loading || !state.hasMore) return;
      void load({ append: true });
    }, { rootMargin: '400px 0px' });

    let userScrolledRail = false;
    function onFirstRailScroll() {
      userScrolledRail = true;
      window.removeEventListener('scroll', onFirstRailScroll);
      if (!state.loading && state.hasMore) obs.observe(sentinel);
    }
    window.addEventListener('scroll', onFirstRailScroll, { passive: true });

    const origRailLoad = load;
    load = async function(opts) {
      await origRailLoad(opts);
      if (state.hasMore && userScrolledRail) {
        obs.disconnect();
        setTimeout(() => { if (state.hasMore) obs.observe(sentinel); }, 300);
      }
    };
  }

  void load();

  const onPublished = (e) => {
    const d = e?.detail || {};
    if (!d?.outputId) return;
    if (d?.sourceStoreId && String(d.sourceStoreId) !== String(sourceStoreId)) return;
    if (state.tab === 'mine') void load({ force: true });
  };
  window.addEventListener('aitopia:outputs:published', onPublished);

  return {
    refresh: () => void load({ force: true }),
    destroy: () => window.removeEventListener('aitopia:outputs:published', onPublished),
  };
}

function applyXuapReadOnly(propSchema, value) {
  if (!propSchema || typeof propSchema !== 'object') return;
  const direct = propSchema;
  const nested = direct['x-uap'] && typeof direct['x-uap'] === 'object' ? direct['x-uap'] : {};
  direct['x-uap'] = nested;
  nested.readOnly = Boolean(value);
}

// Maps alternative key names to the canonical data-id used by override forms.
// Lookup: try original key first; if no element found, try alias.
// All override create*Field() functions now set data-id from their id param,
// so most keys match directly. Aliases handle legacy/alternative key names
// that may arrive from older saved runs or schema property names.
const REMIX_KEY_ALIASES = {
  // "Url"-suffixed alternates → canonical data-id (some agents use short names)
  sourceImageUrl: 'sourceImage',
  targetImageUrl: 'targetImage',
  targetVideoUrl: 'targetVideo',
  contentImageUrl: 'contentImage',
  styleImageUrl: 'styleImage',
  personImageUrl: 'personImage',
  garmentImageUrl: 'garmentImage',
  productImageUrl: 'productImage',
  modelImageUrl: 'modelImage',
  startImageUrl: 'startImage',
  endImageUrl: 'endImage',
  maskUrl: 'mask',
  // Short names → canonical data-id with Url suffix (reverse direction)
  image: 'imageUrl',
  video: 'videoUrl',
  audio: 'audioUrl',
  // Face / lip-sync / talking-avatar aliases
  face: 'faceUrl',
  faceImage: 'sourceImage',
  source: 'sourceImage',
  sourceFaceUrl: 'sourceImage',
  target: 'targetVideo',
  // Mockup / billboard / design aliases
  designImage: 'designImageUrl',
  design: 'designImageUrl',
  adImage: 'adImageUrl',
  // Virtual try-on short aliases
  person: 'personImageUrl',
  garment: 'garmentImageUrl',
  personImage: 'personImageUrl',
  garmentImage: 'garmentImageUrl',
  // Sketch / selfie / subject aliases
  sketch: 'sketchUrl',
  selfie: 'selfieUrl',
  subjectImage: 'subjectImageUrl',
  // Character swap alias
  characterImage: 'characterImageUrl',
  // Transitions agent aliases
  videoUrl1: 'videoUrl1',
  videoUrl2: 'videoUrl2',
  video1: 'videoUrl1',
  video2: 'videoUrl2',
  firstVideo: 'videoUrl1',
  secondVideo: 'videoUrl2',
  transitionType: 'transitionType',
  transitionDuration: 'transitionDuration',
  blendStyle: 'blendStyle',
  customEffect: 'customEffect',
};

function applyRemixDefaultsToForm(container, defaults) {
  if (!container || !defaults || typeof defaults !== 'object') return;
  if (Object.keys(defaults).length === 0) return;
  console.log('[embed-runner] applyRemixDefaultsToForm called with:', defaults);

  for (const [key, value] of Object.entries(defaults)) {
    if (value == null) continue;

    // Try original key first, then alias
    const aliasKey = REMIX_KEY_ALIASES[key];
    let element = container.querySelector(`[data-id="${key}"]`);
    if (!element && aliasKey) {
      element = container.querySelector(`[data-id="${aliasKey}"]`);
    }

    if (!element) {
      console.log(`[embed-runner] No element found for data-id="${key}" or "${aliasKey}"`);
      continue;
    }

    // Open parent <details> if element is inside one (e.g. "More options" accordion)
    const parentDetails = element.closest('details');
    if (parentDetails) parentDetails.open = true;

    // 1. Textarea
    const textarea = element.querySelector('textarea');
    if (textarea) {
      textarea.value = String(value);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      console.log(`[embed-runner] Set textarea "${key}" to:`, value);
      continue;
    }

    // 2. Select (custom dropdown: hidden <select.sr-only> + visible button + dropdown menu)
    const select = element.querySelector('select');
    if (select) {
      select.value = String(value);
      select.dispatchEvent(new Event('change', { bubbles: true }));
      // Update custom dropdown button text
      const selectRow = select.parentElement;  // div.relative containing select + button + menu
      const dropdownBtn = selectRow?.querySelector(':scope > button[type="button"]');
      if (dropdownBtn) {
        // btnValue is the nested div: button > div.text-left > div.text-[13px]
        const btnValueEl = dropdownBtn.querySelector('div > div');
        const matchedOption = select.querySelector(`option[value="${CSS.escape(String(value))}"]`);
        const label = matchedOption ? matchedOption.textContent : String(value);
        if (btnValueEl) {
          btnValueEl.textContent = label;
        } else {
          const fallback = dropdownBtn.querySelector('div');
          if (fallback) fallback.textContent = label;
        }
      }
      // Update checkmarks in dropdown menu items
      const dropdownMenu = selectRow?.querySelector(':scope > div:last-child');
      if (dropdownMenu) {
        dropdownMenu.querySelectorAll('button[data-value]').forEach(btn => {
          const check = btn.querySelector('span:last-child');
          if (check) check.className = btn.dataset.value === String(value) ? 'text-primary/90' : 'invisible';
        });
      }
      console.log(`[embed-runner] Set select "${key}" to:`, value);
      continue;
    }

    // 3. Input (text/number/url) - NOT the hidden media URL input
    const input = element.querySelector('input[type="text"], input[type="number"], input[type="url"]:not([data-media-url])');
    if (input) {
      input.value = String(value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      console.log(`[embed-runner] Set input "${key}" to:`, value);
      continue;
    }

    // 4. Checkbox
    const checkbox = element.querySelector('input[type="checkbox"]');
    if (checkbox) {
      checkbox.checked = Boolean(value);
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));
      console.log(`[embed-runner] Set checkbox "${key}" to:`, value);
      continue;
    }

    // 5. Media field - dispatch custom event so createMediaField's setFromUrl runs
    // Must be checked BEFORE chip group - media wrappers contain button[type="button"] (dropzone)
    const mediaUrlInput = element.querySelector('input[type="url"][data-media-url]');
    if (mediaUrlInput) {
      element.dispatchEvent(new CustomEvent('remix-set-value', { detail: { value: String(value) } }));
      //console.log(`[embed-runner] Set media field "${key}" to:`, value);
      continue;
    }

    // 6. Chip group (buttons) - match by text content
    const buttons = element.querySelectorAll('button[type="button"]');
    if (buttons.length > 0) {
      const stringValue = String(value);
      for (const btn of buttons) {
        const btn_text = btn.textContent?.trim();
        if (btn_text === stringValue || btn_text?.toLowerCase() === stringValue.toLowerCase()) {
          btn.click();
          console.log(`[embed-runner] Clicked chip "${key}" with value:`, stringValue);
          break;
        }
      }
      continue;
    }
  }
}

function applyRemixToSchema(schema, remix) {
  const cloned = deepCloneJson(schema);
  if (!cloned || typeof cloned !== 'object') return cloned;

  const inputSchema = cloned.input && typeof cloned.input === 'object' ? cloned.input : cloned;
  const properties = inputSchema?.properties && typeof inputSchema.properties === 'object' ? inputSchema.properties : null;
  if (!properties) return cloned;

  const defaults = remix?.defaults && typeof remix.defaults === 'object' ? remix.defaults : {};
  for (const [key, value] of Object.entries(defaults)) {
    const prop = properties[key];
    if (!prop || typeof prop !== 'object') continue;
    prop.default = value;
  }

  const pinned = new Set(Array.isArray(remix?.remixSpec?.pinnedInputKeys) ? remix.remixSpec.pinnedInputKeys : []);
  const editable = Array.isArray(remix?.remixSpec?.editableInputKeys) ? remix.remixSpec.editableInputKeys : null;
  if (editable && editable.length > 0) {
    const editableSet = new Set(editable);
    for (const key of Object.keys(properties)) {
      if (!editableSet.has(key)) pinned.add(key);
    }
  }

  for (const key of pinned) {
    const prop = properties[key];
    if (!prop || typeof prop !== 'object') continue;
    applyXuapReadOnly(prop, true);
  }

  return cloned;
}

async function loadRemixSpec(outputId) {
  const res = await fetch(`https://aitopia.ai/api/outputs/${encodeURIComponent(outputId)}/remix`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  const json = safeJsonParse(await res.text());
  if (!res.ok) {
    const msg = json?.error?.message || json?.error || `Failed to load remix (${res.status})`;
    throw new Error(String(msg));
  }
  return json;
}

function parseAgentIdFromPathname() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  // Expected: /agents/:id (canonical) or /agent/:id (legacy)
  if (parts.length >= 2 && (parts[0] === 'agents' || parts[0] === 'agent')) return parts[1];
  return null;
}

function getCreditsDisplayForModelChoice(choice) {
  return window.AitopiaCredits?.getCreditsDisplayForModelChoice?.(choice) ?? '';
}

const MODEL_SCHEMA_CACHE = new Map();
const MODEL_UI_HINTS_CACHE = new Map();

function getModelTags(choice) {
  const tags = choice && typeof choice === 'object' && Array.isArray(choice.tags) ? choice.tags : [];
  return tags.map(t => String(t)).filter(Boolean);
}

function parseDurationTagSeconds(tags) {
  // Supported formats:
  // - durations:5,10,15
  // - durations=5,10,15
  // - duration:5,10
  // - duration=5,10
  for (const tag of tags) {
    const m = tag.match(/^(durations?|duration)\s*[:=]\s*([\d,\s]+)$/i);
    if (!m) continue;
    const nums = m[2]
      .split(',')
      .map(s => Number.parseInt(s.trim(), 10))
      .filter(n => Number.isFinite(n) && n > 0);
    const uniq = Array.from(new Set(nums));
    uniq.sort((a, b) => a - b);
    if (uniq.length > 0) return uniq;
  }
  return null;
}

function parseResolutionTags(tags) {
  const out = [];
  for (const tag of tags) {
    const t = tag.trim().toLowerCase();
    if (/^\d{3,4}p$/.test(t)) out.push(t);
  }
  const uniq = Array.from(new Set(out));
  uniq.sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10));
  return uniq;
}

function parseResolutionOptionsTag(tags) {
  // Supported formats:
  // - resolution-options:720p,1080p
  // - resolution_options=768p,1080p
  // - resolutions:720p,1080p
  for (const tag of tags) {
    const m = tag.match(/^(resolution_options|resolution-options|resolutions?)\s*[:=]\s*([0-9pP,\s]+)$/);
    if (!m) continue;
    const values = m[2]
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(v => /^\d{3,4}p$/.test(v));
    const uniq = Array.from(new Set(values));
    uniq.sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10));
    if (uniq.length > 0) return uniq;
  }
  return null;
}

function hasAudioTag(tags) {
  const set = new Set(tags.map(t => t.trim().toLowerCase()));
  return set.has('audio-sync') || set.has('audio');
}

function parseModelModes(tags) {
  const set = new Set(tags.map(t => t.trim().toLowerCase()));
  return {
    textToVideo: set.has('text-to-video'),
    imageToVideo: set.has('image-to-video'),
  };
}

function parseAspectRatioTags(tags) {
  // Supported formats:
  // - aspect:16:9,9:16,1:1
  // - aspect_ratios=16:9,9:16
  // - ar:16:9,9:16
  for (const tag of tags) {
    const m = tag.match(/^(aspect_ratios?|aspectratios|aspect|ar|ratios?)\s*[:=]\s*([0-9:,\s]+)$/i);
    if (!m) continue;
    const values = m[2]
      .split(',')
      .map(s => s.trim())
      .filter(v => /^\d{1,2}:\d{1,2}$/.test(v));
    const uniq = Array.from(new Set(values));
    if (uniq.length > 0) return uniq;
  }
  return null;
}

async function fetchNormalizedModelSchema(modelId) {
  if (!modelId || typeof modelId !== 'string') return null;
  const cached = MODEL_SCHEMA_CACHE.get(modelId);
  if (cached) return cached;

  const promise = (async () => {
    const parts = modelId.split('/').filter(Boolean);
    let res;
    if (parts.length === 2) {
      const [owner, name] = parts;
      res = await fetch(`https://aitopia.ai/api/models/info/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/schema`);
    } else {
      // Multi-segment model IDs (common for FAL) cannot be represented as /:owner/:name
      // so we use a query-based endpoint.
      res = await fetch(`https://aitopia.ai/api/models/schema?modelId=${encodeURIComponent(modelId)}`);
    }
    const json = safeJsonParse(await res.text());
    if (!res.ok) return null;

    if (!json || typeof json !== 'object') return null;
    if (!json.properties || typeof json.properties !== 'object') return null;
    return json;
  })();

  MODEL_SCHEMA_CACHE.set(modelId, promise);
  return promise;
}

function parseEnumSeconds(value) {
  if (typeof value !== 'string') return null;
  const match = value.trim().toLowerCase().match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const parsed = Number.parseFloat(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function deriveDurationOptionsFromSchema(schema) {
  const props = schema?.properties;
  if (!props || typeof props !== 'object') return null;

  const durationCandidates = [
    'duration',
    'duration_s',
    'duration_seconds',
    'seconds',
    'length',
    'video_length',
    'video_duration',
  ];

  for (const key of durationCandidates) {
    const prop = props[key];
    if (!prop || typeof prop !== 'object') continue;

    if (prop.type === 'number') {
      if (Array.isArray(prop.enum) && prop.enum.length > 0) {
        const nums = prop.enum.filter(v => typeof v === 'number' && Number.isFinite(v));
        const uniq = Array.from(new Set(nums));
        uniq.sort((a, b) => a - b);
        if (uniq.length > 0) return uniq;
      }

      if (typeof prop.minimum === 'number' && typeof prop.maximum === 'number' && Number.isFinite(prop.minimum) && Number.isFinite(prop.maximum)) {
        const min = Math.max(1, Math.ceil(prop.minimum));
        const max = Math.max(min, Math.floor(prop.maximum));
        if (max - min <= 20) {
          const out = [];
          for (let v = min; v <= max; v += 1) out.push(v);
          return out;
        }
      }
    }

    if (prop.type === 'string') {
      if (Array.isArray(prop.enum) && prop.enum.length > 0) {
        const seconds = prop.enum
          .map(v => (typeof v === 'string' ? parseEnumSeconds(v) : null))
          .filter(v => typeof v === 'number' && Number.isFinite(v))
          .map(v => Math.max(1, Math.round(v)));
        const uniq = Array.from(new Set(seconds));
        uniq.sort((a, b) => a - b);
        if (uniq.length > 0) return uniq;
      }
    }
  }

  // Fall back to frame-based inputs (approx seconds @ 24fps)
  const frameCandidates = ['num_frames', 'frames', 'n_frames', 'total_frames', 'frame_num'];
  for (const key of frameCandidates) {
    const prop = props[key];
    if (!prop || typeof prop !== 'object') continue;
    if (!Array.isArray(prop.enum) || prop.enum.length === 0) continue;
    const frames = prop.enum.filter(v => typeof v === 'number' && Number.isFinite(v) && v > 0);
    if (frames.length === 0) continue;
    const seconds = frames.map(f => Math.max(1, Math.round(f / 24)));
    const uniq = Array.from(new Set(seconds));
    uniq.sort((a, b) => a - b);
    if (uniq.length > 0) return uniq;
  }

  return null;
}

function deriveAspectRatioOptionsFromSchema(schema) {
  const props = schema?.properties;
  if (!props || typeof props !== 'object') return null;

  const candidates = ['aspect_ratio', 'aspectRatio', 'ratio', 'ar'];
  for (const key of candidates) {
    const prop = props[key];
    if (!prop || typeof prop !== 'object') continue;
    if (prop.type !== 'string') continue;
    if (!Array.isArray(prop.enum) || prop.enum.length === 0) continue;
    const values = prop.enum.filter(v => typeof v === 'string').map(v => String(v));
    const uniq = Array.from(new Set(values));
    if (uniq.length > 0) return uniq;
  }
  return null;
}

async function getModelUiHints(choice) {
  const modelId = typeof choice === 'string' ? choice : choice?.id;
  if (!modelId) return null;

  const cached = MODEL_UI_HINTS_CACHE.get(modelId);
  if (cached) return cached;

  const promise = (async () => {
    const tags = getModelTags(choice);
    const uiRes = typeof choice === 'object' ? choice?.ui?.specs?.resolution : null;
    const uiAudio = typeof choice === 'object' ? Boolean(choice?.ui?.specs?.hasAudio) : false;

    const parsedResolutions = parseResolutionTags(tags);
    const resolutions =
      parsedResolutions.length > 0
        ? parsedResolutions
        : (typeof uiRes === 'string' && uiRes.trim() ? [uiRes.trim()] : []);
    const audio = hasAudioTag(tags) || uiAudio;
    const modes = parseModelModes(tags);
    const durationFromTags = parseDurationTagSeconds(tags);
    const aspectRatiosFromTags = parseAspectRatioTags(tags);
    const resolutionOptions = parseResolutionOptionsTag(tags);

    const needsSchema = !durationFromTags || !aspectRatiosFromTags;
    const schema = needsSchema ? await fetchNormalizedModelSchema(String(modelId)).catch(() => null) : null;
    const durationFromSchema = !durationFromTags && schema ? deriveDurationOptionsFromSchema(schema) : null;
    const aspectRatiosFromSchema = !aspectRatiosFromTags && schema ? deriveAspectRatioOptionsFromSchema(schema) : null;

    return {
      modelId: String(modelId),
      resolutions,
      resolutionOptions,
      audio,
      modes,
      durationOptions: durationFromTags || durationFromSchema || null,
      aspectRatios: aspectRatiosFromTags || aspectRatiosFromSchema || null,
    };
  })();

  MODEL_UI_HINTS_CACHE.set(modelId, promise);
  return promise;
}

function renderModelCapabilitiesChips(hints, { loading = false, hideAspectRatios = false } = {}) {
  if (!hints || typeof hints !== 'object') return '';
  const chips = [];

  const wrap = (text) =>
    `<span class="inline-flex items-center gap-1 rounded-full border border-black/10 dark:border-white/10 bg-white/60 dark:bg-neutral-950/30 px-2.5 py-1 text-[11px] font-semibold text-gray-700 dark:text-gray-200">${text}</span>`;

  if (Array.isArray(hints.resolutions) && hints.resolutions.length > 0) {
    const values = hints.resolutions.map(String).filter(Boolean);
    const numeric = values.filter(v => /^\d{3,4}p$/.test(v));
    if (numeric.length === values.length && values.length > 1) {
      numeric.sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10));
      const min = numeric[0];
      const max = numeric[numeric.length - 1];
      chips.push(wrap(`📹 ${min}–${max}`));
    } else {
      chips.push(wrap(`📹 ${values.join(' / ')}`));
    }
  }

  if (Array.isArray(hints.durationOptions) && hints.durationOptions.length > 0) {
    const min = Math.min(...hints.durationOptions);
    const max = Math.max(...hints.durationOptions);
    const label = min === max ? `${min}s` : `${min}–${max}s`;
    chips.push(wrap(`⏱ ${label}`));
  }

  if (!hideAspectRatios && Array.isArray(hints.aspectRatios) && hints.aspectRatios.length > 0) {
    chips.push(wrap(`▭ ${hints.aspectRatios.join(', ')}`));
  }

  if (hints.audio) {
    chips.push(wrap('🔊 Audio'));
  }

  if (loading) {
  }

  return chips.join('');
}

function setHidden(el, hidden) {
  if (!el) return;
  el.classList.toggle('hidden', hidden);
}

const progressController = createProgressController();

// Output share menu functionality
let lastOutputData = null;
let lastPublishContext = null;

window.addEventListener('aitopia:carousel:publish-single', (e) => {
  if (!lastPublishContext) return;
  openPublishModal({ ...lastPublishContext, selectedOutputUrl: e.detail?.url });
});

function setLastOutput(data) {
  lastOutputData = data;
}

function getOutputUrl(outputData) {
  const media = collectMediaUrls(outputData);
  return media.videos?.[0] || media.images?.[0] || media.audios?.[0] || null;
}

function getOutputText(outputData, outputUrl) {
  if (outputUrl) return null;
  if (outputData == null) return null;
  if (typeof outputData === 'string') return outputData;
  try {
    return JSON.stringify(outputData, null, 2);
  } catch {
    return String(outputData);
  }
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

function getFilenameFromUrl(url) {
  try {
    const parsed = new URL(url, window.location.origin);
    const basename = parsed.pathname.split('/').filter(Boolean).pop() || 'output';
    const sanitized = basename.replace(/[^a-z0-9._-]/gi, '_');
    return sanitized.length > 0 ? sanitized : 'output';
  } catch {
    return 'output';
  }
}

async function downloadOutputUrl(url) {
  const filename = getFilenameFromUrl(url);
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error('Download failed:', error);
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

function renderOutputShareMenu(dropdown, outputData, agentName) {
  if (!dropdown) return;

  const outputUrl = getOutputUrl(outputData);
  const shareUrl = outputUrl || '';
  const shareText = `Created with ${agentName || 'AI'} on AITOPIA`;
  const outputText = getOutputText(outputData, outputUrl);
  const canPublish = Boolean(lastPublishContext?.idempotencyKey || lastPublishContext?.sourceRunId) && outputData != null;
  const media = outputData != null ? collectMediaUrls(outputData) : { images: [] };
  const isMultiImage = media.images.length > 1;
  const publishLabel = isMultiImage ? 'Publish All' : 'Publish this output';

  const canDownload = Boolean(outputUrl);
  const canCopyLink = Boolean(outputUrl);
  const canCopyText = Boolean(outputText);
  const canShare = Boolean(outputUrl);
  const disabledClass = 'opacity-50 cursor-not-allowed';

  dropdown.innerHTML = `
    <button data-action="publish" class="w-full px-4 py-2.5 text-left hover:bg-white/5 flex items-center gap-3 ${canPublish ? '' : disabledClass}" ${canPublish ? '' : 'disabled'} title="${publishLabel}">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 16V4m0 0l-4 4m4-4l4 4M4 20h16"/></svg>
      ${publishLabel}
    </button>
    <div class="border-t border-white/10 my-1"></div>
    <button data-action="download" class="w-full px-4 py-2.5 text-left hover:bg-white/5 flex items-center gap-3 ${canDownload ? '' : disabledClass}" ${canDownload ? '' : 'disabled'}>
      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
      Download
    </button>
    <button data-action="copy-link" class="w-full px-4 py-2.5 text-left hover:bg-white/5 flex items-center gap-3 ${canCopyLink ? '' : disabledClass}" ${canCopyLink ? '' : 'disabled'}>
      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
      Copy Link
    </button>
    <button data-action="copy-text" class="w-full px-4 py-2.5 text-left hover:bg-white/5 flex items-center gap-3 ${canCopyText ? '' : disabledClass}" ${canCopyText ? '' : 'disabled'}>
      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
      Copy Text
    </button>
    <button data-action="email" class="w-full px-4 py-2.5 text-left hover:bg-white/5 flex items-center gap-3 ${canShare ? '' : disabledClass}" ${canShare ? '' : 'disabled'}>
      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
      Email
    </button>
    <div class="border-t border-white/10 my-1"></div>
    <button data-action="twitter" class="w-full px-4 py-2.5 text-left hover:bg-white/5 flex items-center gap-3 ${canShare ? '' : disabledClass}" ${canShare ? '' : 'disabled'}>
      <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
      X (Twitter)
    </button>
    <button data-action="facebook" class="w-full px-4 py-2.5 text-left hover:bg-white/5 flex items-center gap-3 ${canShare ? '' : disabledClass}" ${canShare ? '' : 'disabled'}>
      <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
      Facebook
    </button>
    <button data-action="linkedin" class="w-full px-4 py-2.5 text-left hover:bg-white/5 flex items-center gap-3 ${canShare ? '' : disabledClass}" ${canShare ? '' : 'disabled'}>
      <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
      LinkedIn
    </button>
    <button data-action="whatsapp" class="w-full px-4 py-2.5 text-left hover:bg-white/5 flex items-center gap-3 ${canShare ? '' : disabledClass}" ${canShare ? '' : 'disabled'}>
      <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
      WhatsApp
    </button>
  `;

  // Wire up click handlers
  dropdown.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (btn.disabled) return;
      const action = btn.dataset.action;
      dropdown.classList.add('hidden');

      switch (action) {
        case 'publish':
          if (lastPublishContext?.idempotencyKey || lastPublishContext?.sourceRunId) {
            openPublishModal(isMultiImage ? { ...lastPublishContext, batchCount: media.images.length, batchImageUrls: media.images } : lastPublishContext);
          }
          break;
        case 'download':
          if (outputUrl) await downloadOutputUrl(outputUrl);
          break;
        case 'copy-link':
          if (!outputUrl) break;
          await copyToClipboard(outputUrl);
          btn.textContent = 'Copied!';
          setTimeout(() => { btn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg> Copy Link'; }, 1500);
          break;
        case 'copy-text':
          if (!outputText) break;
          await copyToClipboard(outputText);
          btn.textContent = 'Copied!';
          setTimeout(() => { btn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg> Copy Text'; }, 1500);
          break;
        case 'email':
          if (!outputUrl) break;
          window.location.href = `mailto:?subject=${encodeURIComponent(shareText)}&body=${encodeURIComponent(outputUrl)}`;
          break;
        case 'twitter':
          if (!outputUrl) break;
          window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(outputUrl)}&text=${encodeURIComponent(shareText)}`, '_blank', 'width=550,height=420');
          break;
        case 'facebook':
          if (!outputUrl) break;
          window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(outputUrl)}`, '_blank', 'width=550,height=420');
          break;
        case 'linkedin':
          if (!outputUrl) break;
          window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(outputUrl)}`, '_blank', 'width=550,height=420');
          break;
        case 'whatsapp':
          if (!outputUrl) break;
          window.open(`https://wa.me/?text=${encodeURIComponent(shareText + ' ' + outputUrl)}`, '_blank');
          break;
      }
    });
  });
}

window.__AITOPIA_OPEN_PUBLISH_MODAL__ = openPublishModal;

function showOutputShareMenu(root, outputData, agentName) {
  const toggle = root.querySelector('[data-output-share-toggle]');
  const dropdown = root.querySelector('[data-output-share-dropdown]');

  if (toggle && dropdown) {
    setHidden(toggle, false);
    toggle.classList.remove('hidden');
    renderOutputShareMenu(dropdown, outputData, agentName);
  }

  setLastOutput(outputData);
}

function hideOutputShareMenu(root, agentName) {
  const toggle = root.querySelector('[data-output-share-toggle]');
  const dropdown = root.querySelector('[data-output-share-dropdown]');
  if (toggle) {
    setHidden(toggle, false);
    toggle.classList.remove('hidden');
  }
  if (dropdown) {
    dropdown.classList.add('hidden');
    renderOutputShareMenu(dropdown, null, agentName);
  }
  setLastOutput(null);
  lastPublishContext = null;
}

function setStatus(root, text, tone = 'neutral') {
  const pill = root.querySelector('[data-agent-run-status]');
  if (!pill) return;
  if (!text) {
    setHidden(pill, true);
    return;
  }
  setHidden(pill, false);
  pill.textContent = text;
  pill.classList.remove('bg-red-500/10', 'text-red-400', 'bg-green-500/10', 'text-green-300', 'bg-primary-foreground/10', 'text-gray-200');
  if (tone === 'error') pill.classList.add('bg-red-500/10', 'text-red-400');
  else if (tone === 'success') pill.classList.add('bg-green-500/10', 'text-green-300');
  else pill.classList.add('bg-primary-foreground/10', 'text-gray-200');
}

function getRunButtonLabel(agent, creditsNumber) {
  if (creditsNumber) {
    return `<span>Generate</span><span class="ml-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary-foreground/20 text-xs font-medium"><svg class="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>${creditsNumber}</span>`;
  }
  return 'Generate';
}

async function pollJob(jobId, { onTick, intervalMs = 2000, timeoutMs = 10 * 60 * 1000 } = {}) {
  const start = Date.now();
  let consecutiveErrors = 0;

  const isRetryableError = (err) => {
    const status = err && typeof err === 'object' ? err.status : undefined;
    if (status === 502 || status === 503 || status === 504) return true;
    const message = String(err?.message || '');
    return message.includes('Failed to fetch') || message.toLowerCase().includes('bad gateway') || message.toLowerCase().includes('network');
  };

  while (Date.now() - start < timeoutMs) {
    let job;
    try {
      job = await getJob(jobId);
      consecutiveErrors = 0;
    } catch (err) {
      consecutiveErrors += 1;
      if (isRetryableError(err)) {
        onTick?.({ _transientError: err?.message || String(err) });
        const backoff = Math.min(10000, Math.round(intervalMs * Math.pow(1.5, Math.min(consecutiveErrors, 6))));
        await new Promise(r => setTimeout(r, backoff));
        continue;
      }
      throw err;
    }

    onTick?.(job);
    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') return job;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error('Job timed out');
}

function renderModelSelector(container, agent, { enabled } = {}) {
  if (!container) return null;

  const debug = isEmbedRunnerDebugEnabled();
  const agentId = agent?.id;
  let modelChoices = Array.isArray(agent?.modelChoices) ? agent.modelChoices : [];
  const selectorEnabledForAgent = agent?.modelSelectorEnabled === true;
  const canApplySelection = Boolean(enabled && selectorEnabledForAgent);
  const canUseFamilyPickerModal =
    canApplySelection && (String(agentId) === 'video-generator' || String(agentId) === 'image-animator');
  const canUseFamilyPicker = canUseFamilyPickerModal;
  const hideAspectRatiosInChips = true;

  const canShow = modelChoices.length > 0;
  if (!canShow) {
    container.innerHTML = '';
    setHidden(container, true);
    return null;
  }

  setHidden(container, false);

  const selectId = `modelSelect-${agentId}`;
  const metaId = `modelSelectMeta-${agentId}`;

  function getChoiceId(choice) {
    return typeof choice === 'string' ? choice : choice?.id;
  }

  function getChoiceLabel(choice) {
    if (typeof choice === 'string') return choice;
    return choice?.displayName || choice?.id || '';
  }

  function getChoiceDescription(choice) {
    if (!choice || typeof choice !== 'object') return '';
    const ui = choice?.ui || null;
    const candidates = [
      ui?.description,
      ui?.summary,
      ui?.subtitle,
      choice?.description,
      choice?.summary,
    ];
    for (const c of candidates) {
      if (typeof c === 'string' && c.trim()) return c.trim();
    }
    return '';
  }

  function formatOptionSuffix(choice) {
    if (!choice || typeof choice !== 'object') return '';
    const tags = getModelTags(choice);
    const parts = [];

    const resolutions = parseResolutionTags(tags);
    const uiRes = choice?.ui?.specs?.resolution;
    if (resolutions.length > 0) {
      const text = resolutions.length === 1 ? resolutions[0] : `${resolutions[0]}–${resolutions[resolutions.length - 1]}`;
      parts.push(text);
    } else if (typeof uiRes === 'string' && uiRes.trim()) {
      parts.push(uiRes.trim());
    }

    const durations = parseDurationTagSeconds(tags);
    const uiDur = choice?.ui?.specs?.duration;
    if (durations && durations.length > 0) {
      const min = Math.min(...durations);
      const max = Math.max(...durations);
      parts.push(min === max ? `${min}s` : `${min}–${max}s`);
    } else if (typeof uiDur === 'string' && uiDur.trim()) {
      parts.push(uiDur.trim());
    }

    if (hasAudioTag(tags) || choice?.ui?.specs?.hasAudio) parts.push('Audio');

    return parts.length > 0 ? ` — ${parts.join(' · ')}` : '';
  }

  function getDefaultModelId(choices) {
    const recommended = choices.find(c => typeof c === 'object' && c?.recommended && c?.id) || null;
    const firstChoice = choices[0];
    const defaultChoice = recommended || firstChoice;
    return typeof defaultChoice === 'string' ? defaultChoice : defaultChoice?.id;
  }

  function buildOptionsHtml(choices, selectedModelId) {
    return (Array.isArray(choices) ? choices : [])
      .map((choice) => {
        const modelId = getChoiceId(choice);
        if (!modelId) return '';
        const label = `${getChoiceLabel(choice)}${formatOptionSuffix(choice)}`;
        const credits = getCreditsDisplayForModelChoice(choice);
        const star = typeof choice === 'object' && choice?.recommended ? ' ★' : '';
        const isSelected = String(modelId) === String(selectedModelId);
        const safeValue = escapeHtml(String(modelId));
        const safeLabel = escapeHtml(String(label));
        const safeCredits = credits ? escapeHtml(String(credits)) : '';
        return `<option value="${safeValue}" ${isSelected ? 'selected' : ''}>${safeLabel}${safeCredits}${star}</option>`;
      })
      .join('');
  }

  const defaultModelId = getDefaultModelId(modelChoices);
  const optionsHtml = buildOptionsHtml(modelChoices, defaultModelId);
  const defaultChoice = modelChoices.find(c => String(getChoiceId(c)) === String(defaultModelId)) || modelChoices[0];
  const defaultLabel = getChoiceLabel(defaultChoice);
  const defaultCredits = getCreditsDisplayForModelChoice(defaultChoice);
  const defaultCreditsLabel = defaultCredits ? String(defaultCredits).replace(/^\s*[—–-]\s*/, '').trim() : '';
  const defaultStar = typeof defaultChoice === 'object' && defaultChoice?.recommended ? ' ★' : '';
  const dropdownMenuId = `${selectId}-dropdown`;

  const hasFamily = modelChoices.some(c => c?.ui?.family);

  function groupByFamily(choices) {
    const families = new Map();
    for (const choice of choices) {
      const family = choice?.ui?.family || '_none_';
      if (!families.has(family)) {
        families.set(family, {
          family,
          familyLabel: choice?.ui?.familyLabel || family,
          familyDescription: choice?.ui?.familyDescription || '',
          variants: []
        });
      }
      families.get(family).variants.push(choice);
    }
    return Array.from(families.values());
  }

  function calcCreditsText(choice) {
    const raw = getCreditsDisplayForModelChoice(choice);
    if (!raw) return '';
    return raw.replace(/^\s*[—–-]\s*/, '').replace(/~/, '').trim();
  }

  function getFamilyCreditsRange(variants) {
    const billingConfig = window.AitopiaCredits?.getBillingConfig?.() || {};
    const usdPerCreditRaw = Number(billingConfig.usdPerCredit);
    const defaultEstimateSecondsRaw = Number(billingConfig.defaultEstimateSeconds);
    const usdPerCredit = Number.isFinite(usdPerCreditRaw) && usdPerCreditRaw > 0 ? usdPerCreditRaw : 0.02;
    const defaultEstimateSeconds = Number.isFinite(defaultEstimateSecondsRaw) && defaultEstimateSecondsRaw > 0
      ? defaultEstimateSecondsRaw
      : 4;

    const credits = variants.map(v => {
      const cost = v?.cost;
      if (!cost) return null;
      if (cost.perSecond) return Math.max(1, Math.ceil((cost.perSecond * defaultEstimateSeconds) / usdPerCredit));
      if (cost.perOutput) return Math.max(1, Math.ceil(cost.perOutput / usdPerCredit));
      return null;
    }).filter(c => c !== null);
    if (credits.length === 0) return '';
    const min = Math.min(...credits);
    const max = Math.max(...credits);
    return min === max ? `${min} Credits` : `${min}-${max} Credits`;
  }

  function buildDropdownItemsHtml(choices, selectedModelId) {
    // If no family grouping, show simple list
    if (!hasFamily) {
      return choices.map(choice => {
        const modelId = getChoiceId(choice);
        if (!modelId) return '';
        const label = getChoiceLabel(choice);
        const creditsText = calcCreditsText(choice);
        const isSelected = String(modelId) === String(selectedModelId);
        const safeValue = escapeHtml(String(modelId));
        const safeLabel = escapeHtml(String(label));
        const safeCredits = escapeHtml(creditsText);
        return `
          <button type="button" data-value="${safeValue}" class="model-selector-list-item w-full px-4 py-3 text-left rounded-lg transition-colors flex items-center justify-between ${isSelected ? 'model-selector-item-selected' : ''}">
            <span class="agent-form-value">${safeLabel}</span>
            ${safeCredits ? `<span class="text-xs text-gray-500 dark:text-gray-400">${safeCredits}</span>` : ''}
          </button>
        `;
      }).join('');
    }

    const families = groupByFamily(choices);
    return families.map(fam => {
      const safeLabel = escapeHtml(fam.familyLabel);
      const safeDesc = escapeHtml(fam.familyDescription || 'Description');
      const familyId = escapeHtml(fam.family);
      
      let familyOwner = (fam.variants[0]['id'] || '').toString().split('/')[0];
      if (familyOwner === 'fal-ai') {
        // Try to find a non-FAL variant to get the true provider for the icon
        const originVariant = fam.variants.find(v => !(v.id || '').toString().startsWith('fal-ai/'));
        if (originVariant) {
          familyOwner = (originVariant.id || '').toString().split('/')[0];
        } else {
          // Fallback parsing for FAL-only families
          const subPath = (fam.variants[0]['id'] || '').toString().split('/')[1];
          if (subPath === 'bytedance') familyOwner = 'bytedance';
          else if (subPath === 'kling-video') familyOwner = 'kwaivgi';
          else if (subPath === 'minimax') familyOwner = 'minimax';
          else if (subPath === 'wan' || subPath === 'wan-25-preview') familyOwner = 'wan-video';
        }
      }

      // Hardcode known family mappings to ensure correct icons for third-party or fine-tuned models
      if (familyId === 'sora') familyOwner = 'openai';
      else if (familyId === 'veo') familyOwner = 'google';
      else if (familyId === 'seedance') familyOwner = 'bytedance';
      else if (familyId === 'kling') familyOwner = 'kwaivgi';
      else if (familyId === 'hailuo') familyOwner = 'minimax';
      else if (familyId === 'wan') familyOwner = 'wan-video';
      
      const familyIcon = `/model-icons/${familyOwner}.png`;

      const variantsHtml = fam.variants.map(choice => {
        const modelId = getChoiceId(choice);
        if (!modelId) return '';
        const label = choice?.ui?.variantLabel || getChoiceLabel(choice);
        const desc = choice?.ui?.variantDescription || '';
        const creditsText = calcCreditsText(choice);
        const isSelected = String(modelId) === String(selectedModelId);
        const safeValue = escapeHtml(String(modelId));
        const safeVLabel = escapeHtml(String(label));
        const safeVDesc = escapeHtml(String(desc));
        const safeCredits = escapeHtml(creditsText);

        const specs = choice?.ui?.specs || {};
        const featureTags = [];
        if (specs.resolution) featureTags.push({ icon: 'resolution', text: specs.resolution });
        if (specs.duration) featureTags.push({ icon: 'duration', text: specs.duration });
        const tags = getModelTags(choice);
        if (hasAudioTag(tags) || specs.hasAudio) featureTags.push({ icon: 'audio', text: 'Audio' });

        const featureTagsHtml = featureTags.map(tag => {
          let iconSvg = '';
          if (tag.icon === 'resolution') {
            iconSvg = '<svg class="w-3.5 h-3.5 opacity-70" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>';
          } else if (tag.icon === 'duration') {
            iconSvg = '<svg class="w-3.5 h-3.5 opacity-70" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>';
          } else if (tag.icon === 'audio') {
            iconSvg = '<svg class="w-3.5 h-3.5 opacity-70" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><rect x="4" y="5" width="3" height="14" rx="1"/><rect x="10.5" y="8" width="3" height="8" rx="1"/><rect x="17" y="11" width="3" height="2" rx="1"/></svg>';
          }
          return `<span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-300 dark:border-[#404040] bg-gray-100 dark:bg-[#1f1f1f] text-[11px] font-medium text-gray-600 dark:text-gray-300">${iconSvg}${escapeHtml(tag.text)}</span>`;
        }).join('');

        return `
          <button type="button" data-value="${safeValue}" class="model-selector-flyout-item w-full block text-left rounded-[12px] p-3 transition-colors ${isSelected ? 'model-selector-item-selected' : ''}">
            <div class="flex items-center gap-1 mb-1">
              <span class="agent-form-value">${safeVLabel}</span>
              ${safeCredits ? `<span data-credits-badge class="inline-flex items-center gap-1.5 rounded-full bg-primary/90/10 dark:bg-primary/90/30 px-2.5 py-1 text-[12px] font-semibold text-primary/90 dark:text-primary/90 shrink-0"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>${safeCredits}</span>` : ''}
            </div>
            ${safeVDesc ? `<div class="text-[12px] text-gray-500 dark:text-gray-400 mb-2 leading-snug">${safeVDesc}</div>` : ''}
            ${featureTagsHtml ? `<div class="flex flex-wrap gap-1.5 mt-1.5">${featureTagsHtml}</div>` : ''}
          </button>
        `;
      }).join('');

      return `
        <div class="family-item relative mb-2 last:mb-0" data-family="${familyId}">
          <div class="family-trigger w-full px-4 py-3 text-left rounded-[12px] hover:bg-[#DDE4ED] dark:hover:bg-[#252729] transition-colors flex items-center gap-3 cursor-pointer">
            <div class="w-8 h-8 rounded-lg bg-gray-200 dark:bg-[#2a2a2a] flex-shrink-0 overflow-hidden flex items-center justify-center">
              <img src="${familyIcon}" alt="${safeLabel}" class="w-full h-full object-cover" data-hide-on-error/>
            </div>
            <div class="flex-1 min-w-0">
              <div class="agent-form-value">${safeLabel}</div>
              <div class="text-[13px] text-gray-500 dark:text-gray-400 truncate">${safeDesc}</div>
            </div>
            <svg class="w-5 h-5 text-gray-400 dark:text-gray-500 flex-shrink-0 family-chevron" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
            </svg>
          </div>
          <div class="family-submenu hidden" style="display:none !important;">${variantsHtml}</div>
          <div class="family-inline-submenu hidden sm:hidden px-3 pb-3 pt-1 space-y-2 border-t border-gray-200 dark:border-white/10 -mx-1">${variantsHtml}</div>
        </div>
      `;
    }).join('');
  }

  const dropdownItemsHtml = buildDropdownItemsHtml(modelChoices, defaultModelId);

  container.innerHTML = `
    <div class="model-selector-wrap relative ${canApplySelection ? '' : 'opacity-60'}">
      <!-- Hidden native select for form compatibility -->
      <select id="${selectId}" class="sr-only" ${canApplySelection ? '' : 'disabled'}>
        ${optionsHtml}
      </select>

      <!-- Custom dropdown button -->
      <button type="button" id="${selectId}-btn" class="w-full flex items-center justify-between gap-3 rounded-2xl my-3 bg-[#EAEFF6] dark:bg-[#1C1E20] border border-[#D9D9D9]/[4%] dark:border-[#D9D9D9]/[4%] px-4 py-1.5 cursor-pointer hover:bg-[#dde4ed] dark:hover:bg-[#252729] transition-colors focus:outline-none focus:border-[#D9D9D9]/40 dark:focus:border-[#D9D9D9]/20" ${canApplySelection ? '' : 'disabled'}>
        <div class="text-left min-w-0 flex-1 overflow-hidden">
          <div class="agent-form-section-label mb-0">Model</div>
          <div id="${selectId}-display" class="flex items-baseline gap-2 overflow-hidden">
            <span class="agent-form-value truncate min-w-0 flex-1">${escapeHtml(defaultLabel)}${defaultStar}</span>
            ${defaultCreditsLabel ? `<span class="agent-form-hint shrink-0 whitespace-nowrap">${escapeHtml(defaultCreditsLabel)}</span>` : ''}
          </div>
        </div>
        <div class="agent-form-hint">
          <svg class="w-5 h-5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
          </svg>
        </div>
      </button>


      <!-- Dropdown menu -->
      <div id="${dropdownMenuId}" class="model-selector-dropdown hidden fixed z-[9999] w-[calc(100vw-24px)] sm:w-[313px] rounded-xl bg-[#EAEFF7] dark:bg-[#1C1E20] border border-gray-200 dark:border-[#2a2a2a] shadow-xl dark:shadow-2xl max-h-[70vh] overflow-y-auto overflow-x-visible">
        <div id="${dropdownMenuId}-content">
          ${dropdownItemsHtml}
        </div>
      </div>
      <!-- Flyout submenu (right on desktop; below + full width on mobile) -->
      <div id="${dropdownMenuId}-flyout" class="model-selector-flyout hidden fixed z-[9999] w-[380px] max-h-[420px] overflow-y-auto rounded-xl bg-[#EAEFF7] dark:bg-[#1C1E20] border border-gray-200 dark:border-[#333] shadow-xl dark:shadow-2xl sm:max-w-[380px]"></div>

    </div>
    <p class="mt-3 agent-form-hint">
      ${canApplySelection
      ? ''
      : 'Model selection is not available for this agent/run.'}
    </p>
  `;

  const selectEl = container.querySelector(`#${selectId}`);
  const dropdownBtn = container.querySelector(`#${selectId}-btn`);
  const dropdownMenu = container.querySelector(`#${dropdownMenuId}`);
  const displayEl = container.querySelector(`#${selectId}-display`);
  const wrapEl = container.querySelector('.model-selector-wrap');

  const changeListeners = new Set();
  let changeToken = 0;

  function getSelectedModelId() {
    return (canApplySelection && selectEl?.value ? String(selectEl.value) : undefined);
  }

  function getSelectedModelChoice() {
    const selectedId = getSelectedModelId();
    if (!selectedId) return null;
    return modelChoices.find(c => String(getChoiceId(c)) === String(selectedId)) || null;
  }

  function updateDisplayText(choice) {
    if (!displayEl) return;
    const label = `${getChoiceLabel(choice)}${formatOptionSuffix(choice)}`;
    const star = typeof choice === 'object' && choice?.recommended ? ' ★' : '';

    // Use dynamic pricing with current form data
    const formData = typeof window !== 'undefined' ? window.agent_form_data : {};
    const dynamicResult = window.AitopiaCredits?.getDynamicCreditsForModelChoice?.(choice, formData);
    const creditsClean = dynamicResult
      ? dynamicResult.label
      : (() => {
          const credits = getCreditsDisplayForModelChoice(choice);
          return credits ? String(credits).replace(/^\s*[—–-]\s*/, '').trim() : '';
        })();

    displayEl.textContent = '';
    displayEl.innerHTML = `
      <span class="agent-form-value truncate min-w-0 flex-1">${escapeHtml(label)}${star}</span>
      ${creditsClean ? `<span class="agent-form-hint shrink-0 whitespace-nowrap">${escapeHtml(creditsClean)}</span>` : ''}
    `;
  }

  function updateDropdownCheckmarks(selectedModelId) {
    if (!dropdownMenu) return;
    const contentEl = dropdownMenu.querySelector(`#${dropdownMenuId}-content`);
    if (!contentEl) return;
    contentEl.querySelectorAll('button[data-value].model-selector-list-item').forEach(btn => {
      const isSelected = btn.dataset.value === String(selectedModelId);
      btn.classList.toggle('model-selector-item-selected', isSelected);
    });
  }

  function rebuildDropdownItems() {
    if (!dropdownMenu) return;
    const contentEl = dropdownMenu.querySelector(`#${dropdownMenuId}-content`);
    if (!contentEl) return;
    const selectedId = getSelectedModelId();
    contentEl.innerHTML = buildDropdownItemsHtml(modelChoices, selectedId);
    wireDropdownItems();
  }

  function wireDropdownItems() {
    if (!dropdownMenu) return;
    const contentEl = dropdownMenu.querySelector(`#${dropdownMenuId}-content`);
    const flyoutEl = document.getElementById(`${dropdownMenuId}-flyout`);
    if (!contentEl) return;

    let hideTimeout = null;
    let activeFamilyId = null;

    const hideFlyout = () => {
      hideTimeout = setTimeout(() => {
        if (flyoutEl) {
          flyoutEl.classList.add('hidden');
          flyoutEl.innerHTML = '';
        }
        contentEl.querySelectorAll('.family-trigger').forEach(t => { t.classList.remove('bg-[#DDE4ED]'); t.classList.remove('dark:bg-[#252729]'); });
        activeFamilyId = null;
      }, 150);
    };

    const showFlyout = (trigger, familyId) => {
      if (hideTimeout) clearTimeout(hideTimeout);
      if (!flyoutEl) return;
      // On mobile we use inline accordion instead of flyout
      if (window.matchMedia('(max-width: 767px)').matches) return;

      // Get the submenu content for this family
      const familyItem = contentEl.querySelector(`.family-item[data-family="${familyId}"]`);
      const submenuContent = familyItem?.querySelector('.family-submenu')?.innerHTML || '';

      const triggerRect = trigger.getBoundingClientRect();
      const dropdownRect = dropdownMenu.getBoundingClientRect();

      flyoutEl.innerHTML = `<div class="px-2 py-2 space-y-1.5">${submenuContent}</div>`;

      // Position flyout: align top with trigger, clamp so it doesn't overflow viewport
      const pad = 16;
      let flyTop = triggerRect.top;
      flyoutEl.style.left = `${dropdownRect.right + 4}px`;
      flyoutEl.style.right = '';
      flyoutEl.style.width = '';
      flyoutEl.style.maxWidth = '';
      flyoutEl.classList.remove('hidden');
      const flyH = flyoutEl.offsetHeight || 200;
      if (flyTop + flyH > window.innerHeight - pad) {
        flyTop = Math.max(pad, window.innerHeight - pad - flyH);
      }
      flyoutEl.style.top = `${flyTop}px`;

      contentEl.querySelectorAll('.family-trigger').forEach(t => { t.classList.remove('bg-[#DDE4ED]'); t.classList.remove('dark:bg-[#252729]'); });
      trigger.classList.add('bg-[#DDE4ED]');
      trigger.classList.add('dark:bg-[#252729]');
      activeFamilyId = familyId;

      flyoutEl.querySelectorAll('button[data-value]').forEach(btn => {
        btn.addEventListener('click', () => {
          const modelId = btn.dataset.value;
          if (!modelId || !canApplySelection) return;
          selectEl.value = modelId;
          const choice = modelChoices.find(c => String(getChoiceId(c)) === String(modelId));
          if (choice) updateDisplayText(choice);
          dropdownMenu.classList.add('hidden');
          document.body.style.overflow = '';
          flyoutEl.classList.add('hidden');
          flyoutEl.innerHTML = '';
          selectEl.dispatchEvent(new Event('change', { bubbles: true }));
        });
      });
    };

    const isMobile = () => window.matchMedia('(max-width: 767px)').matches;
    contentEl.querySelectorAll('.family-item').forEach(item => {
      const trigger = item.querySelector('.family-trigger');
      const inlineSub = item.querySelector('.family-inline-submenu');
      const chevron = item.querySelector('.family-chevron');
      const familyId = item.dataset.family;
      if (!trigger || !familyId) return;

      trigger.addEventListener('mouseenter', () => showFlyout(trigger, familyId));
      trigger.addEventListener('mouseleave', hideFlyout);
      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isMobile() && inlineSub) {
          const isExpanded = !inlineSub.classList.contains('hidden');
          contentEl.querySelectorAll('.family-inline-submenu').forEach(el => el.classList.add('hidden'));
          contentEl.querySelectorAll('.family-trigger').forEach(t => { t.classList.remove('bg-[#DDE4ED]'); t.classList.remove('dark:bg-[#252729]'); });
          contentEl.querySelectorAll('.family-chevron').forEach(svg => { svg.style.transform = ''; });
          if (!isExpanded) {
            inlineSub.classList.remove('hidden');
            trigger.classList.add('bg-[#DDE4ED]');
            trigger.classList.add('dark:bg-[#252729]');
            if (chevron) chevron.style.transform = 'rotate(90deg)';
          }
        }
      });
    });

    contentEl.querySelectorAll('.family-inline-submenu button[data-value]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const modelId = btn.dataset.value;
        if (!modelId || !canApplySelection) return;
        selectEl.value = modelId;
        const choice = modelChoices.find(c => String(getChoiceId(c)) === String(modelId));
        if (choice) updateDisplayText(choice);
        dropdownMenu.classList.add('hidden');
        document.body.style.overflow = '';
        if (flyoutEl) { flyoutEl.classList.add('hidden'); flyoutEl.innerHTML = ''; }
        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });

    // Flyout hover handling
    if (flyoutEl) {
      flyoutEl.addEventListener('mouseenter', () => {
        if (hideTimeout) clearTimeout(hideTimeout);
      });
      flyoutEl.addEventListener('mouseleave', hideFlyout);
    }

    contentEl.querySelectorAll('button[data-value]').forEach(item => {
      if (item.closest('.family-submenu')) return;

      item.addEventListener('click', () => {
        const modelId = item.dataset.value;
        if (!modelId || !canApplySelection) return;
        selectEl.value = modelId;
        const choice = modelChoices.find(c => String(getChoiceId(c)) === String(modelId));
        if (choice) updateDisplayText(choice);
        dropdownMenu.classList.add('hidden');
        document.body.style.overflow = '';
        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });
  }

  const flyoutElForPortal = container.querySelector(`#${dropdownMenuId}-flyout`);
  if (dropdownMenu && dropdownMenu.parentNode) {
    document.body.appendChild(dropdownMenu);
  }
  if (flyoutElForPortal && flyoutElForPortal.parentNode) {
    document.body.appendChild(flyoutElForPortal);
  }

  if (dropdownBtn && dropdownMenu && canApplySelection) {
    const positionDropdown = () => {
      const btnRect = dropdownBtn.getBoundingClientRect();
      const isMobile = window.innerWidth < 640;
      const gap = 8;
      const pad = 16;
      const spaceBelow = window.innerHeight - btnRect.bottom - pad;
      const spaceAbove = btnRect.top - pad;

      // Prefer opening below; switch to above when more room there
      if (spaceBelow >= spaceAbove) {
        dropdownMenu.style.top = `${btnRect.bottom + gap}px`;
        dropdownMenu.style.bottom = 'auto';
        dropdownMenu.style.maxHeight = `${spaceBelow}px`;
      } else {
        dropdownMenu.style.bottom = `${window.innerHeight - btnRect.top + gap}px`;
        dropdownMenu.style.top = 'auto';
        dropdownMenu.style.maxHeight = `${spaceAbove}px`;
      }
      dropdownMenu.style.left = isMobile ? '12px' : `${btnRect.left}px`;
    };

    const lockBodyScroll = () => {
      if (window.innerWidth < 640) {
        document.body.style.overflow = 'hidden';
      }
    };
    const unlockBodyScroll = () => {
      document.body.style.overflow = '';
    };

    if (dropdownMenu && dropdownMenu.parentElement !== document.body) {
      document.body.appendChild(dropdownMenu);
    }
    const flyoutInit = document.getElementById(`${dropdownMenuId}-flyout`);
    if (flyoutInit && flyoutInit.parentElement !== document.body) {
      document.body.appendChild(flyoutInit);
    }

    dropdownBtn.addEventListener('click', () => {
      const wasHidden = dropdownMenu.classList.contains('hidden');
      if (wasHidden) {
        positionDropdown();
        lockBodyScroll();
      } else {
        unlockBodyScroll();
      }
      dropdownMenu.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
      const flyoutEl = document.getElementById(`${dropdownMenuId}-flyout`);
      const clickedOnButton = wrapEl && wrapEl.contains(e.target);
      const clickedOnDropdown = dropdownMenu && dropdownMenu.contains(e.target);
      const clickedOnFlyout = flyoutEl && flyoutEl.contains(e.target);
      if (!clickedOnButton && !clickedOnDropdown && !clickedOnFlyout) {
        dropdownMenu.classList.add('hidden');
        unlockBodyScroll();
        if (flyoutEl) {
          flyoutEl.classList.add('hidden');
          flyoutEl.innerHTML = '';
        }
      }
    });

    // Re-anchor dropdown to trigger button while page scrolls
    window.addEventListener('scroll', () => {
      if (!dropdownMenu.classList.contains('hidden')) positionDropdown();
    }, true);

    wireDropdownItems();
  }

  function updateMetaLoading(choice) {
  }

  function updateMetaFinal(hints) {
  }

  async function emitChange(choice) {
    if (!canApplySelection) return;
    const token = ++changeToken;
    updateMetaLoading(choice);
    const hintsPromise = getModelUiHints(choice);
    for (const cb of changeListeners) {
      try {
        cb(choice, hintsPromise, token);
      } catch (err) {
        if (debug) console.error('[embed-runner] modelSelector.onChange callback error', err);
      }
    }
    try {
      const hints = await hintsPromise;
      if (token === changeToken) updateMetaFinal(hints);
    } catch (err) {
      if (debug) console.warn('[embed-runner] model capabilities hint fetch failed', err);
      if (token === changeToken) updateMetaFinal(null);
    }
  }

  function setChoices(nextChoices) {
    if (!canApplySelection || !selectEl) return;
    modelChoices = Array.isArray(nextChoices) ? nextChoices : [];
    const current = selectEl.value;
    const nextDefault = getDefaultModelId(modelChoices);
    const hasCurrent = modelChoices.some(c => String(getChoiceId(c)) === String(current));
    const nextSelected = hasCurrent ? current : nextDefault;
    selectEl.innerHTML = buildOptionsHtml(modelChoices, nextSelected);
    if (nextSelected) selectEl.value = String(nextSelected);
    rebuildDropdownItems();
    const selectedChoice = modelChoices.find(c => String(getChoiceId(c)) === String(nextSelected));
    if (selectedChoice) updateDisplayText(selectedChoice);
    selectEl.dispatchEvent(new Event('change', { bubbles: true }));
    updateSelectedUiText();
  }

  if (canApplySelection && selectEl) {
    selectEl.addEventListener('change', () => {
      const choice = getSelectedModelChoice();
      if (choice) updateDisplayText(choice);
      updateDropdownCheckmarks(selectEl.value);
      emitChange(choice);
      updateSelectedUiText();
    });
  }

  // Initial meta render (and initial change event for listeners registered later)
  if (canApplySelection) {
    const initialChoice = getSelectedModelChoice();
    const token = ++changeToken;
    updateMetaLoading(initialChoice);
    getModelUiHints(initialChoice)
      .then((hints) => { if (token === changeToken) updateMetaFinal(hints); })
      .catch((err) => {
        if (debug) console.warn('[embed-runner] initial model capabilities hint fetch failed', err);
        if (token === changeToken) updateMetaFinal(null);
      });
  }

  function updateSelectedUiText() {
  }

  function openFamilyHoverPicker() {
    if (!canUseFamilyPicker || !selectEl) return;

    const FAMILY_ORDER = {
      sora: 0,
      veo: 1,
      kling: 2,
      wan: 3,
      hailuo: 4,
      seedance: 5,
      'omni-human': 6,
      other: 99,
    };

    const TIER_ORDER = {
      enterprise: 0,
      pro: 1,
      starter: 2,
      free: 3,
    };

    const FAMILY_FALLBACK = {
      sora: { icon: '🌀', label: 'OpenAI Sora 2', desc: 'Multi-shot video with sound generation' },
      veo: { icon: '🎬', label: 'Google Veo', desc: 'Precision video with sound control' },
      kling: { icon: '✨', label: 'Kling', desc: 'Perfect motion with advanced video control' },
      wan: { icon: '🌊', label: 'Wan', desc: 'Camera-controlled video with sound, more motion styles' },
      hailuo: { icon: '📊', label: 'Minimax Hailuo', desc: 'High-dynamic, VFX-ready, fastest and most cinematic' },
      seedance: { icon: '🎵', label: 'Seedance', desc: 'Cinematic, multi-shot video creation' },
      'omni-human': { icon: '🧑', label: 'Omni-Human', desc: 'Human image animation and motion transfer' },
      other: { icon: '📦', label: 'Other', desc: '' },
    };

    function familyOrder(id) {
      return Number.isFinite(FAMILY_ORDER?.[id]) ? FAMILY_ORDER[id] : 50;
    }

    function tierOrder(tier) {
      return Number.isFinite(TIER_ORDER?.[tier]) ? TIER_ORDER[tier] : 50;
    }

    function deriveFamilyId(modelId) {
      const id = String(modelId || '').toLowerCase();
      if (id.includes('omni-human')) return 'omni-human';
      if (id.includes('sora') || id.startsWith('openai/')) return 'sora';
      if (id.includes('veo') || id.startsWith('google/veo')) return 'veo';
      if (id.includes('kling') || id.startsWith('kwaivgi/')) return 'kling';
      if (id.includes('wan') || id.startsWith('wan-video/')) return 'wan';
      if (id.includes('hailuo') || id.includes('minimax/')) return 'hailuo';
      if (id.includes('seedance') || id.startsWith('bytedance/seedance')) return 'seedance';
      return 'other';
    }

    function groupChoices(choices) {
      const map = new Map();
      for (const choice of Array.isArray(choices) ? choices : []) {
        if (!choice || typeof choice !== 'object') continue;
        const modelId = getChoiceId(choice);
        if (!modelId) continue;
        const ui = choice?.ui || null;

        const familyId = typeof ui?.family === 'string' && ui.family ? ui.family : deriveFamilyId(modelId);
        const fallback = FAMILY_FALLBACK[familyId] || FAMILY_FALLBACK.other;
        const label = typeof ui?.familyLabel === 'string' && ui.familyLabel ? ui.familyLabel : fallback.label;
        const desc = typeof ui?.familyDescription === 'string' ? ui.familyDescription : fallback.desc;
        const icon = fallback.icon;

        if (!map.has(familyId)) {
          map.set(familyId, { id: familyId, label, description: desc, icon, models: [] });
        }
        map.get(familyId).models.push(choice);
      }

      const families = Array.from(map.values());
      families.sort((a, b) => familyOrder(a.id) - familyOrder(b.id));
      for (const fam of families) {
        fam.models.sort((a, b) => {
          const tierA = tierOrder(a?.tier);
          const tierB = tierOrder(b?.tier);
          if (tierA !== tierB) return tierA - tierB;
          return String(getChoiceLabel(a)).localeCompare(String(getChoiceLabel(b)));
        });
      }
      return families;
    }

    function getVariantLabel(choice) {
      const ui = choice?.ui || null;
      if (typeof ui?.variantLabel === 'string' && ui.variantLabel.trim()) return ui.variantLabel.trim();
      return getChoiceLabel(choice);
    }

    function getVariantDescription(choice) {
      const ui = choice?.ui || null;
      return typeof ui?.variantDescription === 'string' ? ui.variantDescription.trim() : '';
    }

    function getVariantBadge(choice) {
      const ui = choice?.ui || null;
      const badge = typeof ui?.badge === 'string' ? ui.badge : '';
      return badge === 'new' || badge === 'premium' ? badge : '';
    }

    function getSpecChips(choice) {
      const ui = choice?.ui || null;
      const tags = getModelTags(choice);
      const chips = [];

      const res = ui?.specs?.resolution;
      if (typeof res === 'string' && res.trim()) chips.push(res.trim());

      const dur = ui?.specs?.duration;
      if (typeof dur === 'string' && dur.trim()) chips.push(dur.trim());

      const hasAudio = Boolean(ui?.specs?.hasAudio) || hasAudioTag(tags);
      if (hasAudio) chips.push('Audio');

      return chips;
    }

    function renderBadge(badge) {
      if (badge === 'new') {
        return '<span class="ml-2 inline-flex items-center rounded-full bg-green-500/15 text-green-700 dark:text-green-300 px-2 py-0.5 text-[10px] font-semibold">New</span>';
      }
      if (badge === 'premium') {
        return '<span class="ml-2 inline-flex items-center rounded-full bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 px-2 py-0.5 text-[10px] font-semibold">Premium</span>';
      }
      return '';
    }

    function renderChips(chips) {
      if (!Array.isArray(chips) || chips.length === 0) return '';
      return chips
        .map((c) => `<span class="inline-flex items-center rounded-full border border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-gray-700 dark:text-white/80">${escapeHtml(String(c))}</span>`)
        .join('');
    }

    function parseCreditsNumber(text) {
      const s = String(text || '');
      const m = s.match(/(\d+)\s*credits?/i);
      if (m) return Number.parseInt(m[1], 10);
      const m2 = s.match(/~\s*(\d+)\s*credits?/i);
      if (m2) return Number.parseInt(m2[1], 10);
      return null;
    }

    function getFamilyCreditsBadge(models) {
      const nums = [];
      for (const c of Array.isArray(models) ? models : []) {
        const n = parseCreditsNumber(getCreditsDisplayForModelChoice(c));
        if (Number.isFinite(n)) nums.push(n);
      }
      if (nums.length === 0) return '';
      const min = Math.min(...nums);
      const max = Math.max(...nums);
      const label = min === max ? `${min} Credits` : `${min}-${max} Credits`;
      return `<span class="inline-flex items-center gap-1 rounded-full bg-primary/90/15 dark:bg-primary/90/20 text-[#7B2BD6] dark:text-primary/90 px-3 py-1.5 text-[11px] font-semibold border border-primary/90/20">${escapeHtml(label)}</span>`;
    }

    const families = groupChoices(modelChoices);
    if (families.length === 0) return;

    const selectedId = String(selectEl.value || '');
    const selectedChoice = modelChoices.find(c => String(getChoiceId(c)) === selectedId) || null;
    const selectedFamilyId = (() => {
      const uiFam = selectedChoice && typeof selectedChoice === 'object' ? selectedChoice?.ui?.family : null;
      return typeof uiFam === 'string' && uiFam ? uiFam : deriveFamilyId(selectedId);
    })();

    let activeFamily = families.find(f => f.id === selectedFamilyId) || families[0];

    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[110] bg-black/30 dark:bg-black/40';

    const panel = document.createElement('div');
    panel.className =
      'fixed rounded-[24px] bg-transparent flex flex-col min-h-[240px] max-h-[85vh] overflow-visible ' +
      'w-[760px] max-w-[calc(100vw-48px)]';

    const inner = document.createElement('div');
    inner.className = 'flex flex-1 min-h-0 gap-1.5 p-1.5 items-start';

    const left = document.createElement('div');
    left.className =
      'w-[300px] max-w-[42%] shrink-0 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] shadow-lg dark:shadow-black/20 overflow-y-auto overflow-x-hidden p-3 max-h-[85vh]';

    const right = document.createElement('div');
    right.className =
      'flex-1 min-w-0 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1a1a] shadow-lg dark:shadow-black/20 overflow-y-auto overflow-x-hidden p-4 hidden sm:block max-h-[85vh] -mt-24 transition-opacity duration-150';
    right.setAttribute('data-family-picker-right', '');
    right.style.opacity = '0';
    right.style.visibility = 'hidden';
    right.style.pointerEvents = 'none';

    const close = () => overlay.remove();
    function showRightPanel() {
      right.style.opacity = '1';
      right.style.visibility = 'visible';
      right.style.pointerEvents = '';
    }
    overlay.addEventListener('click', (ev) => { if (ev.target === overlay) close(); });
    document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') close(); }, { once: true });

    function renderFamilyList() {
      left.innerHTML = '';
      for (const fam of families) {
        const isActive = fam.id === activeFamily?.id;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className =
          'w-full text-left px-3 py-3 rounded-[18px] transition-colors flex items-center gap-3 ' +
          (isActive ? 'bg-primary/90/15 ring-1 ring-primary/90/25 dark:ring-primary/90/25' : 'hover:bg-gray-100 dark:hover:bg-white/5');

        btn.innerHTML = `
          <div class="w-11 h-11 rounded-full bg-gray-100 dark:bg-white/6 border border-gray-200 dark:border-white/10 flex items-center justify-center text-lg flex-shrink-0">${escapeHtml(fam.icon || '📦')}</div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <div class="text-sm font-semibold text-gray-900 dark:text-white truncate">${escapeHtml(fam.label || 'Other')}</div>
            </div>
            <div class="text-xs text-gray-500 dark:text-white/60 truncate">${escapeHtml(fam.description || '')}</div>
          </div>
        `;

        btn.addEventListener('mouseenter', () => {
          activeFamily = fam;
          renderFamilyList();
          showRightPanel();
          renderFamilyDetail();
        });
        btn.addEventListener('focus', () => {
          activeFamily = fam;
          renderFamilyList();
          showRightPanel();
          renderFamilyDetail();
        });

        left.appendChild(btn);
      }
    }

    function renderFamilyDetail() {
      if (!activeFamily) return;
      right.innerHTML = `
        <div class="space-y-3" data-family-variants>
          ${activeFamily.models.map((choice) => {
            const modelId = String(getChoiceId(choice) || '');
            if (!modelId) return '';
            const isSelected = modelId === selectedId;
            const label = getVariantLabel(choice);
            const desc = getVariantDescription(choice);
            const badge = getVariantBadge(choice);
            const chips = getSpecChips(choice);
            const credits = getCreditsDisplayForModelChoice(choice);
            const creditsText = credits ? String(credits).replace(/^(\s*—\s*)/, '').trim() : '';

            return `
              <button type="button" data-value="${escapeHtml(modelId)}" class="model-selector-list-item w-full text-left rounded-[20px] bg-[#EAEFF7] dark:bg-[#1C1E20] hover:bg-[#DDE4ED] dark:hover:bg-[#252729] transition-colors p-4 ${isSelected ? 'ring-2 ring-primary/90/35' : ''}">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <div class="flex items-center gap-2">
                      <div class="text-sm font-semibold text-gray-900 dark:text-white truncate">${escapeHtml(String(label))}</div>
                      ${renderBadge(badge)}
                    </div>
                    ${desc ? `<div class="mt-1 text-xs text-gray-500 dark:text-white/60">${escapeHtml(desc)}</div>` : ''}
                  </div>
                  <div class="flex items-center gap-2 shrink-0">
                    ${creditsText ? `<span data-credits class="text-xs font-semibold text-gray-700 dark:text-white/80">${escapeHtml(creditsText)}</span>` : ''}
                    <span class="${isSelected ? 'text-primary/90 dark:text-primary/90' : 'opacity-0'}">
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                    </span>
                  </div>
                </div>
                ${chips.length > 0 ? `<div class="mt-3 flex flex-wrap gap-2">${renderChips(chips)}</div>` : ''}
              </button>
            `;
          }).join('')}
        </div>
      `;

      right.querySelectorAll('button[data-value]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const modelId = btn.getAttribute('data-value');
          if (!modelId) return;
          selectEl.value = modelId;
          selectEl.dispatchEvent(new Event('change', { bubbles: true }));
          close();
        });
      });
    }

    inner.appendChild(left);
    inner.appendChild(right);
    panel.appendChild(inner);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    try {
      const rect = dropdownBtn.getBoundingClientRect();
      const width = Math.min(760, window.innerWidth - 48);
      const margin = 24;
      const topPx = rect.bottom + 2;
      let leftPx;
      if (rect.left + width <= window.innerWidth - margin) {
        leftPx = rect.left;
      } else if (rect.right - width >= margin) {
        leftPx = rect.right - width;
      } else {
        leftPx = Math.max(margin, Math.min(rect.left, window.innerWidth - margin - width));
      }
      leftPx = Math.max(margin, Math.min(leftPx, window.innerWidth - margin - width));
      panel.style.width = `${width}px`;
      panel.style.left = `${Math.round(leftPx)}px`;
      panel.style.top = `${Math.round(topPx)}px`;
    } catch (_) { }

    renderFamilyList();
  }

  function openFamilyPicker() {
    if (!canUseFamilyPicker || !selectEl) return;

    const FAMILY_ORDER = {
      sora: 0,
      veo: 1,
      kling: 2,
      wan: 3,
      hailuo: 4,
      seedance: 5,
      'omni-human': 6,
      other: 99,
    };

    const TIER_ORDER = {
      enterprise: 0,
      pro: 1,
      starter: 2,
      free: 3,
    };

    const FAMILY_FALLBACK = {
      sora: { icon: '🌀', label: 'OpenAI Sora 2', desc: 'Multi-shot video with sound generation' },
      veo: { icon: '🎬', label: 'Google Veo', desc: 'Precision video with sound control' },
      kling: { icon: '✨', label: 'Kling', desc: 'Perfect motion with advanced video control' },
      wan: { icon: '🌊', label: 'Wan', desc: 'Camera-controlled video with sound, more motion styles' },
      hailuo: { icon: '📊', label: 'Minimax Hailuo', desc: 'High-dynamic, VFX-ready, fastest and most cinematic' },
      seedance: { icon: '🎵', label: 'Seedance', desc: 'Cinematic, multi-shot video creation' },
      'omni-human': { icon: '🧑', label: 'Omni-Human', desc: 'Human image animation and motion transfer' },
      other: { icon: '📦', label: 'Other', desc: '' },
    };

    function familyOrder(id) {
      return Number.isFinite(FAMILY_ORDER?.[id]) ? FAMILY_ORDER[id] : 50;
    }

    function tierOrder(tier) {
      return Number.isFinite(TIER_ORDER?.[tier]) ? TIER_ORDER[tier] : 50;
    }

    function deriveFamilyId(modelId) {
      const id = String(modelId || '').toLowerCase();
      if (id.includes('omni-human')) return 'omni-human';
      if (id.includes('sora') || id.startsWith('openai/')) return 'sora';
      if (id.includes('veo') || id.startsWith('google/veo')) return 'veo';
      if (id.includes('kling') || id.startsWith('kwaivgi/')) return 'kling';
      if (id.includes('wan') || id.startsWith('wan-video/')) return 'wan';
      if (id.includes('hailuo') || id.includes('minimax/')) return 'hailuo';
      if (id.includes('seedance') || id.startsWith('bytedance/seedance')) return 'seedance';
      return 'other';
    }

    function groupChoices(choices) {
      const map = new Map();
      for (const choice of Array.isArray(choices) ? choices : []) {
        if (!choice || typeof choice !== 'object') continue;
        const modelId = getChoiceId(choice);
        if (!modelId) continue;
        const ui = choice?.ui || null;

        const familyId = typeof ui?.family === 'string' && ui.family ? ui.family : deriveFamilyId(modelId);
        const fallback = FAMILY_FALLBACK[familyId] || FAMILY_FALLBACK.other;
        const label = typeof ui?.familyLabel === 'string' && ui.familyLabel ? ui.familyLabel : fallback.label;
        const desc = typeof ui?.familyDescription === 'string' ? ui.familyDescription : fallback.desc;
        const icon = fallback.icon;

        if (!map.has(familyId)) {
          map.set(familyId, { id: familyId, label, description: desc, icon, models: [] });
        }
        map.get(familyId).models.push(choice);
      }

      const families = Array.from(map.values());
      families.sort((a, b) => familyOrder(a.id) - familyOrder(b.id));
      for (const fam of families) {
        fam.models.sort((a, b) => {
          const tierA = tierOrder(a?.tier);
          const tierB = tierOrder(b?.tier);
          if (tierA !== tierB) return tierA - tierB;
          return String(getChoiceLabel(a)).localeCompare(String(getChoiceLabel(b)));
        });
      }
      return families;
    }

    function getVariantLabel(choice) {
      const ui = choice?.ui || null;
      if (typeof ui?.variantLabel === 'string' && ui.variantLabel.trim()) return ui.variantLabel.trim();
      return getChoiceLabel(choice);
    }

    function getVariantDescription(choice) {
      const ui = choice?.ui || null;
      return typeof ui?.variantDescription === 'string' ? ui.variantDescription.trim() : '';
    }

    function getVariantBadge(choice) {
      const ui = choice?.ui || null;
      const badge = typeof ui?.badge === 'string' ? ui.badge : '';
      return badge === 'new' || badge === 'premium' ? badge : '';
    }

    function getSpecChips(choice) {
      const ui = choice?.ui || null;
      const tags = getModelTags(choice);
      const chips = [];

      const res = ui?.specs?.resolution;
      if (typeof res === 'string' && res.trim()) chips.push(res.trim());

      const dur = ui?.specs?.duration;
      if (typeof dur === 'string' && dur.trim()) chips.push(dur.trim());

      const hasAudio = Boolean(ui?.specs?.hasAudio) || hasAudioTag(tags);
      if (hasAudio) chips.push('Audio');

      return chips;
    }

    const families = groupChoices(modelChoices);
    const selectedId = String(selectEl.value || '');

    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[110] bg-black/60 flex items-end sm:items-center justify-center';
    overlay.setAttribute('data-model-picker-overlay', '');

    const modal = document.createElement('div');
    modal.className = 'w-full sm:max-w-lg max-h-[85vh] rounded-ios-2xl bg-white dark:bg-neutral-950 border border-black/10 dark:border-white/10 shadow-lg overflow-hidden flex flex-col';
    modal.setAttribute('data-model-picker-modal', '');

    const header = document.createElement('div');
    header.className = 'flex items-center gap-2 px-4 py-3 border-b border-black/10 dark:border-white/10';

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'hidden p-2 rounded-ios-lg hover:bg-black/5 dark:hover:bg-white/5';
    backBtn.setAttribute('aria-label', 'Back');
    backBtn.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>';

    const title = document.createElement('div');
    title.className = 'flex-1 min-w-0';
    const titleText = document.createElement('div');
    titleText.className = 'text-sm font-semibold text-gray-900 dark:text-white truncate';
    titleText.textContent = 'Select Model';
    const subText = document.createElement('div');
    subText.className = 'text-xs text-gray-600 dark:text-gray-300 truncate';
    subText.textContent = 'Choose a model family and variant';
    title.appendChild(titleText);
    title.appendChild(subText);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'p-2 rounded-ios-lg hover:bg-black/5 dark:hover:bg-white/5';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.innerHTML = '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" /></svg>';

    header.appendChild(backBtn);
    header.appendChild(title);
    header.appendChild(closeBtn);

    const content = document.createElement('div');
    content.className = 'flex-1 overflow-y-auto';

    const close = () => overlay.remove();
    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    function renderFamilies() {
      backBtn.classList.add('hidden');
      titleText.textContent = 'Select Model';
      subText.textContent = 'Choose a model family and variant';

      content.innerHTML = '';
      for (const fam of families) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('data-model-picker-family', String(fam.id || 'other'));
        btn.className = 'w-full text-left px-4 py-3 border-b border-black/5 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex items-center gap-3';
        btn.innerHTML = `
          <div class="text-xl">${escapeHtml(fam.icon || '📦')}</div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-semibold text-gray-900 dark:text-white truncate">${escapeHtml(fam.label || 'Other')}</div>
            <div class="text-xs text-gray-600 dark:text-gray-300 truncate">${escapeHtml(fam.description || '')}</div>
          </div>
          <svg class="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
          </svg>
        `;
        btn.addEventListener('click', () => renderVariants(fam));
        content.appendChild(btn);
      }
    }

    function renderBadge(badge) {
      if (badge === 'new') {
        return '<span class="ml-2 inline-flex items-center rounded-full bg-green-500/15 text-green-700 dark:text-green-300 px-2 py-0.5 text-[10px] font-semibold">New</span>';
      }
      if (badge === 'premium') {
        return '<span class="ml-2 inline-flex items-center rounded-full bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 px-2 py-0.5 text-[10px] font-semibold">Premium</span>';
      }
      return '';
    }

    function renderChips(chips) {
      if (!Array.isArray(chips) || chips.length === 0) return '';
      return chips
        .map((c) => `<span class="inline-flex items-center rounded-full border border-black/10 dark:border-white/10 bg-white/60 dark:bg-neutral-950/30 px-2.5 py-1 text-[11px] font-semibold text-gray-700 dark:text-gray-200">${escapeHtml(String(c))}</span>`)
        .join('');
    }

    function renderVariants(fam) {
      backBtn.classList.remove('hidden');
      titleText.textContent = fam.label || 'Select Model';
      subText.textContent = fam.description || '';

      content.innerHTML = '';
      for (const choice of fam.models) {
        const modelId = String(getChoiceId(choice) || '');
        const isSelected = String(modelId) === selectedId;
        const label = getVariantLabel(choice);
        const desc = getVariantDescription(choice);
        const badge = getVariantBadge(choice);
        const chips = getSpecChips(choice);

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('data-model-picker-variant', modelId);
        btn.className =
          'w-full text-left px-4 py-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors rounded-xl ' +
          (isSelected ? 'bg-primary/90/10' : '');
        btn.innerHTML = `
          <div class="flex items-center gap-2">
            <div class="text-sm font-semibold text-gray-900 dark:text-white truncate">${escapeHtml(String(label))}</div>
            ${renderBadge(badge)}
          </div>
          ${desc ? `<div class="mt-0.5 text-xs text-gray-600 dark:text-gray-300">${escapeHtml(desc)}</div>` : ''}
          ${chips.length > 0 ? `<div class="mt-2 flex flex-wrap gap-2">${renderChips(chips)}</div>` : ''}
        `;
        btn.addEventListener('click', () => {
          if (!modelId) return;
          selectEl.value = modelId;
          selectEl.dispatchEvent(new Event('change', { bubbles: true }));
          close();
        });
        content.appendChild(btn);
      }
    }

    backBtn.addEventListener('click', renderFamilies);

    modal.appendChild(header);
    modal.appendChild(content);
    overlay.appendChild(modal);

    renderFamilies();

    document.body.appendChild(overlay);
  }

  updateSelectedUiText();

  return {
    getSelectedModelId,
    getSelectedModelChoice,
    setChoices,
    getModelChoices: () => modelChoices,
    setSelectedModelId: (modelId) => {
      if (!canApplySelection || !selectEl || !modelId) return false;
      const id = String(modelId);
      const match = modelChoices.find(c => String(getChoiceId(c)) === id);
      if (!match) return false;
      selectEl.value = id;
      updateDisplayText(match);
      updateDropdownCheckmarks(id);
      selectEl.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    },
    onChange: (cb) => {
      if (typeof cb !== 'function') return () => { };
      changeListeners.add(cb);
      if (canApplySelection) {
        const choice = getSelectedModelChoice();
        const hintsPromise = getModelUiHints(choice);
        const token = changeToken;
        try {
          cb(choice, hintsPromise, token);
        } catch (err) {
          if (debug) console.error('[embed-runner] modelSelector.onChange immediate callback error', err);
        }
      }
      return () => changeListeners.delete(cb);
    },
    // Dynamic pricing: update display with current form data
    updateCreditsDisplay: () => {
      const choice = getSelectedModelChoice();
      if (choice) updateDisplayText(choice);
    },
  };
}

// ============================================
// Dynamic Pricing Update Manager
// ============================================

class PricingUpdateManager {
  constructor({ modelSelectorApi, runButtonEl, agent }) {
    this.modelSelectorApi = modelSelectorApi;
    this.runButtonEl = runButtonEl;
    this.agent = agent;

    this.handleFormDataChange = this.handleFormDataChange.bind(this);
    window.addEventListener('aitopia:form:data-changed', this.handleFormDataChange);
  }

  // Call this after form is fully rendered to set initial pricing
  initialize() {
    const formData = typeof window !== 'undefined' ? window.agent_form_data : {};
    if (formData && Object.keys(formData).length > 0) {
      this.updateAllDisplays();
    }
  }

  handleFormDataChange(e) {
    const { key } = e?.detail || {};
    // Only update if price-affecting field changed
    if (window.AitopiaCredits?.isPriceAffectingField?.(key)) {
      this.updateAllDisplays();
    }
  }

  updateAllDisplays() {
    const choice = this.modelSelectorApi?.getSelectedModelChoice?.();
    if (!choice) return;

    const formData = typeof window !== 'undefined' ? window.agent_form_data : {};

    // 1. Update model selector display
    this.modelSelectorApi?.updateCreditsDisplay?.();

    // 2. Update run button
    this.updateRunButton(choice, formData);

    // 3. Update dropdown items if open
    this.updateDropdownItems(formData);
  }

  updateRunButton(choice, formData) {
    if (!this.runButtonEl) return;
    const result = window.AitopiaCredits?.getDynamicCreditsForModelChoice?.(choice, formData);
    if (result) {
      // Find the credits badge span (second span with the number)
      const badgeSpan = this.runButtonEl.querySelector('span:last-child');
      if (badgeSpan) {
        // Extract SVG and update just the number part
        const svg = badgeSpan.querySelector('svg');
        const svgHtml = svg ? svg.outerHTML : '';
        badgeSpan.innerHTML = svgHtml + result.credits;
      }
    }
  }

  updateDropdownItems(formData) {
    const choices = this.modelSelectorApi?.getModelChoices?.() || [];
    document.querySelectorAll('button[data-value].model-selector-list-item, button[data-value].model-selector-flyout-item').forEach(item => {
      const modelId = item.dataset.value;
      if (!modelId) return;
      const choice = choices.find(c => {
        const cId = typeof c === 'string' ? c : c?.id;
        return String(cId) === String(modelId);
      });
      if (!choice) return;

      const result = window.AitopiaCredits?.getDynamicCreditsForModelChoice?.(choice, formData);
      if (result) {
        // Update credits with data-credits attribute (family picker)
        const dataCreditsEl = item.querySelector('[data-credits]');
        if (dataCreditsEl) dataCreditsEl.textContent = result.label;

        // Update credits text in dropdown item
        const creditsEl = item.querySelector('.text-xs.text-gray-500, .text-xs.text-gray-400');
        if (creditsEl) creditsEl.textContent = result.label;

        const badgeEl = item.querySelector('[data-credits-badge]');
        if (badgeEl) {
          const textSpan = badgeEl.childNodes[badgeEl.childNodes.length - 1];
          if (textSpan && textSpan.nodeType === Node.TEXT_NODE) {
            textSpan.textContent = result.label;
          }
        }
      }
    });
  }

  destroy() {
    window.removeEventListener('aitopia:form:data-changed', this.handleFormDataChange);
  }
}

function looksLikeProviderModelSelectorField(key, propSchema) {
  if (!key || typeof key !== 'string') return false;
  const normalizedKey = key.trim().toLowerCase();
  if (normalizedKey === 'selectedmodelid') return true;
  if (normalizedKey === 'aimodel' || normalizedKey === 'modelvariant') return true;
  if (normalizedKey !== 'model') return false;

  if (!propSchema || typeof propSchema !== 'object') return false;
  if (String(propSchema.type || 'string').toLowerCase() !== 'string') return false;

  const description = String(propSchema.description || '').toLowerCase();
  const title = String(propSchema.title || '').toLowerCase();
  const enumValues = Array.isArray(propSchema.enum) ? propSchema.enum.map(v => String(v).toLowerCase()) : [];

  const enumLooksLikeModelIds =
    enumValues.some(v => v.includes('/')) ||
    enumValues.some(v => ['kling', 'sora', 'veo', 'wan', 'seedance', 'hailuo', 'nano', 'flux', 'imagen', 'gpt-image'].some(t => v.includes(t)));

  const textLooksLikeModelSelector =
    (title.includes('model') || description.includes('model')) &&
    (description.includes('use') || description.includes('select') || description.includes('provider') || description.includes('generation'));

  return enumLooksLikeModelIds || textLooksLikeModelSelector;
}

function hideModelSelectorFieldsInSchema(schema) {
  const inputSchema = schema?.input;
  if (!inputSchema || typeof inputSchema !== 'object') return schema;
  const props = inputSchema?.properties;
  if (!props || typeof props !== 'object') return schema;

  let changed = false;
  const nextProps = { ...props };

  for (const [key, propSchema] of Object.entries(props)) {
    if (!looksLikeProviderModelSelectorField(key, propSchema)) continue;
    if (!propSchema || typeof propSchema !== 'object') continue;

    const existingXuap = (propSchema['x-uap'] && typeof propSchema['x-uap'] === 'object') ? propSchema['x-uap'] : {};
    nextProps[key] = {
      ...propSchema,
      'x-uap': {
        ...existingXuap,
        hidden: true,
      },
    };
    changed = true;
  }

  if (!changed) return schema;
  return {
    ...schema,
    input: {
      ...inputSchema,
      properties: nextProps,
    },
  };
}

async function main() {
  const root = document.querySelector('[data-agent-run-root]');
  if (!root) return;

  const tabs = setupRunnerTabs(root);

  const globalConfig = window.__AITOPIA_AGENT_RUN__ || {};
  const agentId = (typeof globalConfig.agentId === 'string' && globalConfig.agentId.trim())
    ? globalConfig.agentId.trim()
    : parseAgentIdFromPathname();

  const params = new URLSearchParams(window.location.search);
  const remixOutputId = params.get('remixOutputId') || params.get('remix') || null;
  const runId = params.get('runId') || null;
  const remixRunId = params.get('remixRunId') || null;
  const jobId = params.get('jobId') || null;

  if (!agentId) {
    setStatus(root, 'Invalid URL', 'error');
    const out = root.querySelector('[data-agent-run-output]');
    if (out) out.innerHTML = '<div class="text-sm text-red-400">Invalid URL. Expected /agents/:id</div>';
    return;
  }

  const enabledModelSelector = globalConfig.useModelSelector === true;

  const formContainer = root.querySelector('[data-agent-run-form]');
  let modelContainer = root.querySelector('[data-agent-run-model]');
  const agentCard = root.querySelector('[data-agent-run-agent-card]');
  const runButton = root.querySelector('[data-agent-run-button]');
  const runHint = root.querySelector('[data-agent-run-hint]');
  let creditsHint = root.querySelector('[data-agent-run-credits]');
  const outputContainer = root.querySelector('[data-agent-run-output]');
  const creationsContainer = root.querySelector('[data-agent-run-creations]');
  const historyContainer = root.querySelector('[data-agent-run-history]');
  const activeOutputContainer = outputContainer;

  if (!formContainer || !runButton || !activeOutputContainer) return;

  // Backwards-compat: older injected runner HTML may not include a dedicated model container.
  // If missing, create one and insert it directly above the form so the dropdown renders.
  if (!modelContainer) {
    modelContainer = document.createElement('div');
    modelContainer.setAttribute('data-agent-run-model', '');
    modelContainer.className = 'mb-3 hidden';
    formContainer.parentNode?.insertBefore(modelContainer, formContainer);
  }

  // Render the Output “…” menu immediately (disabled until output exists),
  // so users don't see an empty dropdown while the agent/schema load.
  hideOutputShareMenu(root);

  setStatus(root, 'Loading…');
  runButton.disabled = true;

  try {
    const billingConfigPromise = window.AitopiaCredits?.loadBillingConfig?.().catch(() => null) ?? Promise.resolve(null);
    const remixPromise = remixOutputId ? loadRemixSpec(remixOutputId) : Promise.resolve(null);
    const runPromise = runId ? getRun(runId).catch((err) => {
      if (isEmbedRunnerDebugEnabled()) console.warn('[embed-runner] Failed to load run:', err);
      return null;
    }) : Promise.resolve(null);
    const remixRunPromise = remixRunId ? getRun(remixRunId).catch((err) => {
      console.warn('[embed-runner] Failed to load remix run:', err?.message || err);
      return null;
    }) : Promise.resolve(null);
    const [agent, schema, _billingConfig, remixSpec, runData, remixRunData] = await Promise.all([
      getStoreAgent(agentId),
      getAgentSchema(agentId, { ui: 'uap' }),
      billingConfigPromise,
      remixPromise,
      runPromise,
      remixRunPromise,
    ]);

    if (agentCard) {
      agentCard.innerHTML = renderMiniAgentCard(agent);
    }

    if (creationsContainer) {
      const remixContentContainer = creationsContainer.querySelector('[data-remix-content]') || creationsContainer;
      mountCreationsRail(remixContentContainer, { sourceStoreId: agentId, tabs });
    }

    let historyPanel = null;
    let historyLoaded = false;
    const historyOutputContainer = root.querySelector('[data-agent-run-panel="history"] [data-agent-run-output]') || activeOutputContainer;

    const handleHistorySelect = (creation) => {
      console.log('[embed-runner] handleHistorySelect called:', creation);
      try {
        if (!creation) return;

        const status = typeof creation?.status === 'string' ? creation.status.toLowerCase() : '';
        const isInProgress = status.includes('running') || status.includes('queue') || status.includes('pending');

        // Only render if there's actual output content
        const out = creation.output;
        console.log('[embed-runner] Rendering output:', out, 'isInProgress:', isInProgress);
        if (historyOutputContainer) {
          if (isInProgress || !out || (typeof out === 'object' && Object.keys(out).length === 0)) {
            historyOutputContainer.classList.remove('hidden');
            historyOutputContainer.innerHTML = `
              <div class="flex items-center justify-center py-12 text-muted-foreground">
                <div class="animate-spin w-6 h-6 border-2 border-primary/90 border-t-transparent rounded-full mr-3"></div>
                <span class="text-sm">${creation.status || 'Processing...'}</span>
              </div>
            `;
          } else {
            setHistoryOutputContainerMode(historyOutputContainer, out);
            historyOutputContainer.classList.remove('hidden');
            renderOutput(historyOutputContainer, out, { showPublish: true });
          }
        }

        const historyPanel = root.querySelector('[data-agent-run-panel="history"]');
        if (historyPanel) {
          const infoPanel = historyPanel.querySelector('[data-history-info]');
          if (infoPanel) {
            infoPanel.classList.remove('hidden');
            infoPanel.classList.add('lg:flex');

            const badgesEl = infoPanel.querySelector('[data-history-badges]');
            if (badgesEl) {
              const badges = [];
              const out = creation.output || creation;
              const model = creation.modelUsed || creation.modelName || creation.model || out?.modelUsed || out?.model;
              if (model) badges.push(model);
              const provider = out?.provider || creation.provider;
              if (provider) badges.push(provider);
              const timeMs = out?.processingTime || out?.processingTimeMs || creation.processingTime;
              if (timeMs) badges.push(`${Math.round(timeMs)}ms`);
              if (badges.length === 0) badges.push('—');
              badgesEl.innerHTML = badges.map(b =>
                `<span class="px-2.5 py-1 text-xs rounded-full bg-[#272727] text-[#898A8B]">${escapeHtml(b)}</span>`
              ).join('');
            }

            const promptEl = infoPanel.querySelector('[data-history-prompt]');
            if (promptEl) {
              const prompt = creation.prompt || creation.input?.prompt || creation.input?.text || 'No prompt available.';
              promptEl.textContent = prompt;
            }

            const inputEl = infoPanel.querySelector('[data-history-input]');
            if (inputEl) {
              const inputUrl = creation.input?.image || creation.input?.imageUrl || creation.input?.source_image;
              if (inputUrl) {
                inputEl.classList.remove('hidden');
                const img = inputEl.querySelector('img');
                if (img) img.src = inputUrl;
              } else {
                inputEl.classList.add('hidden');
              }
            }

            const downloadBtn = infoPanel.querySelector('[data-action="download"]');
            if (downloadBtn) {
              downloadBtn.onclick = () => {
                const url = collectMediaUrls(out).videos[0] || collectMediaUrls(out).images[0] || collectMediaUrls(out).audios[0];
                if (url) downloadOutputUrl(url);
              };
            }

            const copyBtn = infoPanel.querySelector('[data-action="copy"]');
            if (copyBtn) {
              copyBtn.onclick = async () => {
                const url = collectMediaUrls(out).videos[0] || collectMediaUrls(out).images[0] || collectMediaUrls(out).audios[0];
                if (url) {
                  try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }
                }
              };
            }
          }
        }

        if (typeof creation.status === 'string' && creation.status.trim()) {
          setStatus(root, creation.status, creation.status.toLowerCase() === 'failed' ? 'error' : undefined);
        }

        const idempotencyKey = typeof creation?.idempotencyKey === 'string' && creation.idempotencyKey.trim()
          ? creation.idempotencyKey.trim()
          : (typeof out?.idempotencyKey === 'string' && out.idempotencyKey.trim()
            ? out.idempotencyKey.trim()
            : (typeof out?.sourceIdempotencyKey === 'string' && out.sourceIdempotencyKey.trim()
              ? out.sourceIdempotencyKey.trim()
              : null));
        const sourceRunId = typeof creation?.runId === 'string' && creation.runId.trim()
          ? creation.runId.trim()
          : (typeof creation?.id === 'string' && creation.id.trim()
            ? creation.id.trim()
            : (typeof out?.runId === 'string' && out.runId.trim()
              ? out.runId.trim()
              : (typeof out?.sourceRunId === 'string' && out.sourceRunId.trim()
                ? out.sourceRunId.trim()
                : null)));
        if (idempotencyKey || sourceRunId) {
          lastPublishContext = {
            agentId,
            idempotencyKey,
            sourceRunId,
            input: creation.input || {},
            modelName: creation.modelUsed || creation.modelName || creation.model || agent?.name,
          };
        }

        showOutputShareMenu(root, out, agent?.name);
      } catch (e) {
        console.error('[embed-runner] handleHistorySelect error:', e);
        if (historyOutputContainer) {
          setHistoryOutputContainerMode(historyOutputContainer, null);
          historyOutputContainer.classList.remove('hidden');
          renderError(historyOutputContainer, e?.message || String(e));
        }
      }
    };

    if (historyContainer) {
      const loadHistoryIfNeeded = () => {
        if (!historyLoaded) {
          console.log('[embed-runner] Loading history panel...');
          historyLoaded = true;
          historyPanel = createCreationHistoryPanel(historyContainer, {
            sourceStoreId: agentId,
            onSelect: handleHistorySelect,
          });
          historyPanel.load();
        }
      };

      tabs.onTabChange = (tabId) => {
        console.log('[embed-runner] Tab changed to:', tabId);
        if (tabId === 'history') {
          loadHistoryIfNeeded();
        }
      };

      const historyTabBtn = queryScopedOrDocument(root, '[data-agent-run-tab="history"]');
      if (historyTabBtn?.getAttribute('aria-selected') === 'true') {
        console.log('[embed-runner] History tab already active, loading immediately...');
        loadHistoryIfNeeded();
      }

      if (historyTabBtn) {
        historyTabBtn.addEventListener('click', () => {
          console.log('[embed-runner] History tab clicked');
          loadHistoryIfNeeded();
        });
      }
    } else {
      console.warn('[embed-runner] historyContainer not found!');
    }

    // If jobId is present (e.g. from notification link), auto-open history tab and select the creation
    if (jobId && historyContainer) {
      // Create panel before setTab so loadHistoryIfNeeded becomes a no-op
      if (!historyLoaded) {
        historyLoaded = true;
        historyPanel = createCreationHistoryPanel(historyContainer, {
          sourceStoreId: agentId,
          onSelect: handleHistorySelect,
        });
      }
      tabs.setTab('history');
      historyPanel.load().then(() => {
        historyPanel.selectByJobId(jobId);
      });
    }

    // If runId is present and we successfully loaded run data, display the output directly
    if (runId && runData && runData.output) {
      // Verify the run belongs to the same agent
      if (runData.agentId && runData.agentId !== agentId) {
        // Redirect to the correct agent page
        window.location.href = `/aitopia/marketplace/agent/${encodeURIComponent(runData.agentId)}.html?runId=${encodeURIComponent(runId)}`;
        return;
      }

      // Display the saved run output
      renderOutput(outputContainer, runData.output, { showPublish: true });
      showOutputShareMenu(root, runData.output, agent?.name);
      tabs.setTab('output');

      // Update status to show this is a saved run
      setStatus(root, `Run from ${new Date(runData.createdAt).toLocaleString()}`);

      // Still render the form so users can run a new execution
      const savedCreditsInfo = window.AitopiaCredits?.getCreditsInfoForAgent?.(agent);
      const savedCreditsNum = savedCreditsInfo?.minCredits
        ? (savedCreditsInfo.minCredits === savedCreditsInfo.maxCredits
            ? String(savedCreditsInfo.minCredits)
            : `${savedCreditsInfo.minCredits}-${savedCreditsInfo.maxCredits}`)
        : null;
      runButton.innerHTML = getRunButtonLabel(agent, savedCreditsNum);
      runButton.disabled = false;

      // Fall through to render the form for potential new runs
    }

    if (remixSpec && remixOutputId) {
      const remixedStoreId =
        typeof remixSpec?.sourceStoreId === 'string' && remixSpec.sourceStoreId.trim()
          ? remixSpec.sourceStoreId.trim()
          : (typeof remixSpec?.agentId === 'string' && remixSpec.agentId.trim() ? remixSpec.agentId.trim() : null);

      if (remixedStoreId && remixedStoreId !== agentId) {
        // URL doesn't match the creation's source agent; bounce to the correct page.
        window.location.href = `/aitopia/marketplace/agent/${encodeURIComponent(remixedStoreId)}.html?remixOutputId=${encodeURIComponent(remixOutputId)}`;
        return;
      }
    }

    // Verify remixRunId belongs to the same agent
    if (remixRunData && remixRunId) {
      if (remixRunData.agentId && remixRunData.agentId !== agentId) {
        // Redirect to the correct agent page
        window.location.href = `/aitopia/marketplace/agent/${encodeURIComponent(remixRunData.agentId)}.html?remixRunId=${encodeURIComponent(remixRunId)}`;
        return;
      }
    }

    // Set initial button label with credits badge (fallback to costEstimate for LLM agents)
    const initialCreditsInfo = window.AitopiaCredits?.getCreditsInfoForAgent?.(agent);
    const initialCreditsNumber = initialCreditsInfo?.minCredits
      ? (initialCreditsInfo.minCredits === initialCreditsInfo.maxCredits
          ? String(initialCreditsInfo.minCredits)
          : `${initialCreditsInfo.minCredits}-${initialCreditsInfo.maxCredits}`)
      : null;
    runButton.innerHTML = getRunButtonLabel(agent, initialCreditsNumber);

    const modelChoices = Array.isArray(agent?.modelChoices) ? agent.modelChoices : [];
    const selectorEnabledForAgent = agent?.modelSelectorEnabled === true;
    const canApplyModelSelection = Boolean(enabledModelSelector && selectorEnabledForAgent && modelChoices.length > 0);

    const modelSelector = renderModelSelector(modelContainer, agent, { enabled: enabledModelSelector });

    // Initialize dynamic pricing manager
    let pricingManager = null;
    if (modelSelector) {
      pricingManager = new PricingUpdateManager({
        modelSelectorApi: modelSelector,
        runButtonEl: runButton,
        agent
      });
    }

    const overridePath = getOverrideModulePath(agentId);

    // Build remix object from remixOutputId (outputs table) or remixRunId (runs table)
    let remix = null;
    if (remixSpec && remixOutputId) {
      remix = {
        remixFromOutputId: remixSpec?.remixFromOutputId || remixOutputId,
        remixSpec: remixSpec?.remixSpec,
        defaults: remixSpec?.defaults,
        modelUsed: remixSpec?.modelUsed || null,
      };
    } else if (remixRunData && remixRunId) {
      // Create remix spec from run data - extract parameters from input
      let runDefaults = {};
      const rawInput = remixRunData.input;
      if (rawInput && typeof rawInput === 'object') {
        const rawParams = rawInput.parameters;
        if (rawParams && typeof rawParams === 'object' && !Array.isArray(rawParams)) {
          runDefaults = rawParams;
        } else {
          // Legacy: fields may be directly in input
          const { task: _t, parameters: _p, context: _c, ...rest } = rawInput;
          if (Object.keys(rest).length > 0) runDefaults = rest;
        }
      }
      const runModelUsed = remixRunData?.modelId
        || remixRunData?.output?.result?.modelUsed
        || remixRunData?.output?.modelUsed
        || null;
      remix = {
        remixFromRunId: remixRunId,
        remixSpec: null,
        defaults: runDefaults,
        modelUsed: runModelUsed,
      };
    }
    const schemaForForm = remix
      ? applyRemixToSchema(canApplyModelSelection ? hideModelSelectorFieldsInSchema(schema) : schema, remix)
      : (canApplyModelSelection ? hideModelSelectorFieldsInSchema(schema) : schema);

    let formController;
    if (overridePath) {
      try {
        const mod = await import(overridePath);
        formController = await mod.render({ agent, schema: schemaForForm, remix, container: formContainer, modelSelector });
      } catch (err) {
        if (isEmbedRunnerDebugEnabled()) {
          console.warn('[embed-runner] override failed, using schema form', err);
        }
        formController = renderSchemaForm({ schema: schemaForForm, container: formContainer, collapseOptional: true });
      }
    } else {
      formController = renderSchemaForm({ schema: schemaForForm, container: formContainer, collapseOptional: true });
    }

    // Apply remix defaults to override forms (Path B) after DOM is built
    if (overridePath && remix?.defaults && Object.keys(remix.defaults).length > 0) {
      setTimeout(() => {
        applyRemixDefaultsToForm(formContainer, remix.defaults);
      }, 100);
    }

    // Restore model selection from remix: prefer modelUsed, fallback to defaults.model_id
    const remixModelId = remix?.modelUsed || remix?.defaults?.model_id || null;
    if (remixModelId && modelSelector?.setSelectedModelId) {
      const applied = modelSelector.setSelectedModelId(remixModelId);
      if (!applied && isEmbedRunnerDebugEnabled()) {
        console.log('[embed-runner] remix model_id not found in choices:', remixModelId);
      }
    }

    // ── Restore form state from sessionStorage snapshot (only when no remix) ──
    if (!remix) {
      try {
        const snapshotRaw = sessionStorage.getItem('agent_form_snapshot');
        if (snapshotRaw) {
          const snapshotAll = JSON.parse(snapshotRaw);
          const pathName = window.location.pathname;
          const saved = snapshotAll?.[pathName];
          const skipRestore = window.AitopiaProfile?.email && window.location.href.indexOf("=success") === -1;
          if (!skipRestore && saved && typeof saved === 'object' && Object.keys(saved).length > 0) {
            // Restore model_id first (before form fields, so model selector is ready)
            if (saved.model_id && modelSelector?.setSelectedModelId) {
              modelSelector.setSelectedModelId(saved.model_id);
            }
            // Restore form fields via the same mechanism as remix
            const { model_id: _m, ...formDefaults } = saved;
            if (Object.keys(formDefaults).length > 0) {
              setTimeout(() => {
                applyRemixDefaultsToForm(formContainer, formDefaults);
              }, 100);
            }
          }
        }
      } catch { /* corrupt/missing snapshot — ignore */ }
    }

    if (modelContainer && formContainer) {
      const modelSelectorWrap = modelContainer.querySelector('.model-selector-wrap');
      if (modelSelectorWrap) {
        const modelWrapper = document.createElement('div');
        modelWrapper.className = 'model-selector-in-form mb-3';
        while (modelContainer.firstChild) {
          modelWrapper.appendChild(modelContainer.firstChild);
        }

        // Priority 1: Find "More options" details element
        let insertBefore = null;
        let insertParent = formContainer;
        const moreOptionsDetails = Array.from(formContainer.querySelectorAll('details')).find(d => {
          const summary = d.querySelector('summary');
          return summary && /more\s*options/i.test(summary.textContent || '');
        });

        if (moreOptionsDetails) {
          const detailsParent = moreOptionsDetails.parentElement;
          if (detailsParent && detailsParent !== formContainer) {
            insertParent = detailsParent;
          }
          insertBefore = moreOptionsDetails;
        } else {
          const children = Array.from(formContainer.children);

          for (const child of children) {
            const isDetails = child.tagName === 'DETAILS';
            if (isDetails) {
              insertBefore = child;
              break;
            }

            const nestedDetails = child.querySelector('details');
            if (nestedDetails) {
              insertParent = child;
              insertBefore = nestedDetails;
              break;
            }

            const hasDropzone = child.querySelector('.dropzone-empty, [type="file"]');
            const hasTextarea = child.querySelector('textarea');
            const hasTextInput = child.querySelector('input[type="text"], input[type="url"], input[type="number"]');

            if (hasDropzone || hasTextarea || hasTextInput) {
              continue;
            }

            const hasSelect = child.querySelector('select, [role="listbox"], .relative > button');
            const hasCheckbox = child.querySelector('input[type="checkbox"], [role="switch"]');

            if (hasSelect || hasCheckbox) {
              insertBefore = child;
              break;
            }
          }
        }

        if (insertBefore) {
          insertParent.insertBefore(modelWrapper, insertBefore);
        } else {
          insertParent.appendChild(modelWrapper);
        }
        setHidden(modelContainer, true);
      }
    }

    if (formContainer) {
      formContainer.querySelectorAll('button.dropzone-empty').forEach((dropzone) => {
        const card = dropzone.closest('.rounded-2xl');
        const wrapper = card?.parentElement;
        if (wrapper) {
          const header = wrapper.querySelector(':scope > .mb-3');
          if (header) {
            header.style.display = 'none';
          }
        }
      });
    }

    const updateRunButtonCredits = (choice, formData) => {
      const safeFormData = (formData && typeof formData === 'object')
        ? formData
        : (typeof window !== 'undefined' && window.agent_form_data && typeof window.agent_form_data === 'object'
            ? window.agent_form_data
            : {});
      const dynamicResult = window.AitopiaCredits?.getDynamicCreditsForModelChoice?.(choice, safeFormData);
      let creditsNumber = null;
      if (dynamicResult?.credits) {
        creditsNumber = String(dynamicResult.credits);
      } else {
        const credits = getCreditsDisplayForModelChoice(choice);
        const match = credits ? String(credits).match(/~?(\d+)/) : null;
        creditsNumber = match ? match[1] : null;
      }
      // Fallback: use agent costEstimate when no model choice is available
      if (!creditsNumber && agent) {
        const agentInfo = window.AitopiaCredits?.getCreditsInfoForAgent?.(agent);
        if (agentInfo?.minCredits) {
          creditsNumber = agentInfo.minCredits === agentInfo.maxCredits
            ? String(agentInfo.minCredits)
            : `${agentInfo.minCredits}-${agentInfo.maxCredits}`;
        }
      }
      runButton.innerHTML = getRunButtonLabel(agent, creditsNumber);
    };

    if (modelSelector?.onChange) {
      modelSelector.onChange((choice, hintsPromise, token) => {
        // Sync model_id into agent_form_data
        const choiceId = choice && typeof choice === 'object' ? choice.id : (typeof choice === 'string' ? choice : undefined);
        if (typeof window !== 'undefined') {
          window.agent_form_data = window.agent_form_data || {};
          window.agent_form_data.model_id = choiceId || undefined;
        }

        // Get current form data to calculate dynamic price on model change
        const formData = typeof window !== 'undefined' ? window.agent_form_data : {};
        updateRunButtonCredits(choice, formData);
        if (typeof formController?.onModelChange === 'function') {
          try {
            formController.onModelChange(choice, hintsPromise, token);
          } catch (err) {
            if (isEmbedRunnerDebugEnabled()) {
              console.error('[embed-runner] formController.onModelChange failed', err);
            }
          }
        }
      });
    }

    if (!creditsHint) {
      creditsHint = document.createElement('p');
      creditsHint.setAttribute('data-agent-run-credits', '');
      creditsHint.className = 'mt-3 text-xs text-muted-foreground text-center';
      if (runHint?.parentNode) runHint.parentNode.insertBefore(creditsHint, runHint);
      else runButton.parentNode?.insertBefore(creditsHint, runButton.nextSibling);
    }

    const refreshCreditsHint = async (options) => {
      // Always refresh the global balance (updates navbar credits display)
      let data = null;
      try {
        data = await window.AitopiaCredits?.loadCreditsBalance?.(options);
      } catch {
        data = null;
      }

      if (!creditsHint) return;

      if (!data?.balance) {
        setHidden(creditsHint, true);
        return;
      }

      setHidden(creditsHint, true);
    };

    await refreshCreditsHint();

    // Initialize dynamic pricing after form is fully rendered
    // Use requestAnimationFrame to ensure form data is populated
    if (pricingManager) {
      requestAnimationFrame(() => {
        pricingManager.initialize();
      });
    }

    if (runHint) {
      runHint.textContent = agent.async
        ? 'This agent may run asynchronously. If queued, the page will auto-poll for results.'
        : '';
    }

    setStatus(root, '');
    runButton.disabled = false;
    const pathName = window.location.pathname;
    // ── agent_form_snapshot: persist form state via sessionStorage ──
    const snapshotKey = 'agent_form_snapshot';

    const saveSnapshot = (key, formData) => {
      if (window.AitopiaProfile?.email) key = "*"
      try {
        if (key === '*') {
          sessionStorage.removeItem(snapshotKey);
          return;
        }
        const set_data = {};
        set_data[pathName] = formData;
        sessionStorage.setItem(snapshotKey, JSON.stringify(set_data));
      } catch { /* quota exceeded or private browsing — ignore */ }
    };

    // Primary: Proxy-based listener (catches ALL writes including schema-form direct writes)
    if (typeof window.onAgentFormDataChange === 'function') {
      window.onAgentFormDataChange(({ key, formData }) => saveSnapshot(key, formData));
    }

    // Fallback: DOM event listener (always works for updateFormData calls from override forms)
    window.addEventListener('aitopia:form:data-changed', (e) => {
      const { key, formData } = e?.detail || {};
      if (key) saveSnapshot(key, formData);
    });

    syncPanelHeights();
    window.addEventListener('resize', syncPanelHeights);

    runButton.addEventListener('click', async () => {
      runButton.disabled = true;
      setStatus(root, 'Generating…');
      hideOutputShareMenu(root, agent?.name);

      const outputTabButton = queryScopedOrDocument(root, '[data-agent-run-tab="output"]');
      const historyTabBtn = queryScopedOrDocument(root, '[data-agent-run-tab="history"]');

      // Prefer modern History layout whenever available. Some pages can still
      // contain legacy Output tabs for back-compat, which should not override History.
      const useHistoryTabLayout = Boolean(historyTabBtn);

      const isMobileView = window.matchMedia('(max-width: 1023px)').matches;

      if (useHistoryTabLayout) {
        // On mobile, defer tab switch until after validation succeeds so the
        if (!isMobileView) {
          tabs.setTab('history');
          if (window.__AITOPIA_SET_TAB__) {
            window.__AITOPIA_SET_TAB__('history');
          }
        }
        if (activeOutputContainer) {
          setHistoryOutputContainerMode(activeOutputContainer, null);
          activeOutputContainer.classList.remove('hidden');
          const initialModel = modelSelector?.getSelectedModelChoice?.()?.displayName || modelSelector?.getSelectedModelChoice?.()?.id || agent?.name || 'Preparing…';
          progressController.start(activeOutputContainer, undefined, { model: initialModel, prompt: '' });
        }
        const historyInfoPanel = root.querySelector('[data-agent-run-panel="history"] [data-history-info]');
        if (historyInfoPanel) {
          historyInfoPanel.classList.add('hidden');
          historyInfoPanel.classList.remove('lg:flex');
        }
        if (!historyLoaded && historyContainer) {
          historyLoaded = true;
          historyPanel = createCreationHistoryPanel(historyContainer, {
            sourceStoreId: agentId,
            onSelect: handleHistorySelect,
          });
          historyPanel.load();
        }
      } else if (outputTabButton) {
        activeOutputContainer.classList.remove('hidden');
        progressController.start(activeOutputContainer);
        tabs.setTab('output');
      }

      if (!(await checkAuthOrRedirect())) {
        runButton.disabled = false;
        return;
      }

      // Agreement check — show modal if user hasn't agreed yet
      const agreed = await showAgreementModal();
      if (!agreed) {
        runButton.disabled = false;
        setStatus(root, '', '');
        if (activeOutputContainer) {
          setHistoryOutputContainerMode(activeOutputContainer, null);
        }
        progressController.clear();
        return;
      }

      // ── Pre-flight credit check (fake run flow) ──────────────────────
      {
        const pfModel = modelSelector?.getSelectedModelChoice?.();
        const pfFormData = formController?.getFormData?.() || {};
        const pfCreditsInfo = pfModel
          ? window.AitopiaCredits?.getDynamicCreditsForModelChoice?.(pfModel, pfFormData)
          : window.AitopiaCredits?.getCreditsInfoForAgent?.(agent);
        const pfRequired = pfCreditsInfo?.credits ?? pfCreditsInfo?.minCredits ?? null;

        try {
          const available = await fetchBalance();
          if (isInsufficient(available, pfRequired)) {
            const snapData = { ...pfFormData };
            if (pfModel?.id) snapData.model_id = pfModel.id;
            saveSnapshot('agent_form_snapshot', snapData);

            runButton.disabled = false;
            setStatus(root, '', '');
            if (activeOutputContainer) {
              setHistoryOutputContainerMode(activeOutputContainer, null);
              activeOutputContainer.classList.remove('hidden');
              renderPendingPaidInto(activeOutputContainer, {
                thumbUrl: extractThumb(pfFormData),
                onRetry: () => runButton.click(),
              });
            }
            setTimeout(() => pricingModal(), 0);
            return;
          }
        } catch (_) { /* balance check failed — proceed, backend will enforce */ }
      }
      // ── End pre-flight credit check ────────────────────────────────────

      let input = null;
      let idempotencyKey = `runner-${agentId}-${uuid()}`;
      let modelName = agent?.name || 'Model';
      let promptText = '';
      let inputThumbUrl = null;

      // Pre-compute model name for the uploading card
      const selectedModelEarly = modelSelector?.getSelectedModelChoice?.();
      modelName = selectedModelEarly?.displayName || selectedModelEarly?.id || agent?.name || 'Model';

      // Upload progress: show % that ticks up 1%/sec, jumps on real file completion
      let uploadSimPct = 0;
      let uploadSimTimer = null;
      let uploadSimCap = 30; // default cap when no callback info yet (first 30s → 1-30%)
      const updateUploadCard = (pct) => {
        if (!historyPanel) return;
        historyPanel.addCreation({
          id: idempotencyKey, runId: idempotencyKey, idempotencyKey, agentId,
          modelUsed: modelName, prompt: '', input: {},
          status: `Uploading (${pct}%)`,
          createdAt: new Date().toISOString(),
        });
      };

      // Start sim timer immediately — ticks +1%/sec from 0%
      if (historyPanel) {
        updateUploadCard(0);
        uploadSimTimer = setInterval(() => {
          if (uploadSimPct >= uploadSimCap) return;
          uploadSimPct = Math.min(uploadSimCap, uploadSimPct + 1);
          updateUploadCard(uploadSimPct);
        }, 1000);
      }

      // Real progress callback from overrides: onUploadProgress(completed, total)
      // e.g. 2 videos → after 1st: (1,2)→50%, after 2nd: (2,2)→100%
      const onUploadProgress = (completed, total) => {
        if (!historyPanel || !total) return;
        if (uploadSimTimer) { clearInterval(uploadSimTimer); uploadSimTimer = null; }
        const slicePct = Math.floor(100 / total);
        uploadSimPct = Math.min(100, completed * slicePct);
        updateUploadCard(uploadSimPct);
        // Between files: resume sim +1%/sec within next slice
        if (completed < total) {
          uploadSimCap = Math.min(99, (completed + 1) * slicePct - 1);
          uploadSimTimer = setInterval(() => {
            if (uploadSimPct >= uploadSimCap) return;
            uploadSimPct = Math.min(uploadSimCap, uploadSimPct + 1);
            updateUploadCard(uploadSimPct);
          }, 1000);
        }
      };

      try {
        input = await formController.getValues({ onUploadProgress });
        if (uploadSimTimer) { clearInterval(uploadSimTimer); uploadSimTimer = null; }

        // Validation passed — now switch to history tab on mobile
        if (useHistoryTabLayout && isMobileView) {
          tabs.setTab('history');
          if (window.__AITOPIA_SET_TAB__) window.__AITOPIA_SET_TAB__('history');
          const historyPanelEl = root.querySelector('[data-agent-run-panel="history"]');
          if (historyPanelEl) {
            requestAnimationFrame(() => {
              historyPanelEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
          }
        }

        const selectedModel = modelSelector?.getSelectedModelChoice?.();
        modelName = selectedModel?.displayName || selectedModel?.id || agent?.name || 'Model';
        promptText = input?.prompt || input?.text || input?.task || input?.description || input?.caption || input?.instructions || '';
        inputThumbUrl = input?.image || input?.imageUrl || input?.source_image || input?.human_img;

        if (useHistoryTabLayout && activeOutputContainer) {
          setHistoryOutputContainerMode(activeOutputContainer, null);
          activeOutputContainer.classList.remove('hidden');
          progressController.setDetails(activeOutputContainer, { prompt: promptText, model: modelName });
        }

        if (!useHistoryTabLayout) {
          activeOutputContainer.classList.remove('hidden');
          progressController.start(activeOutputContainer, undefined, { prompt: promptText, model: modelName });
        }

        const storedConversationId = sessionStorage.getItem(`conversation_${agentId}`);
        if (storedConversationId && !input.conversationId) {
          input.conversationId = storedConversationId;
        }

        const body = { input };
        if (remix?.remixFromOutputId && typeof body === 'object' && body) {
          const existing = body._aifnmjmchg && typeof body._aifnmjmchg === 'object' ? body._aifnmjmchg : {};
          body._aifnmjmchg = { ...existing, remixFromOutputId: remix.remixFromOutputId };
        }
        const selectedModelId = modelSelector?.getSelectedModelId?.();
        if (selectedModelId) body.selectedModelId = selectedModelId;

        lastPublishContext = {
          agentId,
          idempotencyKey,
          sourceRunId: null,
          input: body.input && typeof body.input === 'object' && body.input ? body.input : {},
          derivedFromOutputId: remix?.remixFromOutputId || null,
        };

        // Upload done — transition card from "Uploading" to "In Queue"
        // Note: jobId not yet available here; will be patched after API response
        if (historyPanel) {
          const draft = {
            id: idempotencyKey,
            runId: idempotencyKey,
            idempotencyKey,
            agentId,
            modelUsed: modelName,
            prompt: promptText || '',
            duration: input?.duration,
            input: input || {},
            status: 'In Queue',
            createdAt: new Date().toISOString(),
            ...(inputThumbUrl ? { preview: { url: inputThumbUrl } } : {}),
          };
          historyPanel.addCreation(draft);
        }

        // // TODO: TEMPORARY - skip API call to test loading card UI. Remove this block later.
        // runButton.disabled = false;
        // setStatus(root, 'Queued…');
        // return;

        const { res, json } = await runStoreAgent(agentId, body, { headers: { 'Idempotency-Key': idempotencyKey } });

        if (res.status === 202) {
          const jobId = json?.jobId;
          if (!jobId) throw new Error('Agent queued but jobId missing in response');

          setStatus(root, 'Queued…');
          await refreshCreditsHint({ force: true });

          // Start queue polling in the global navbar
          window.NavbarComponent?.startQueuePolling?.();

          // Show run toast and increment notification badge
          const agentLabel = agent?.name || agentId;
          const agentUrl = `/aitopia/marketplace/agent/${encodeURIComponent(agentId)}.html?jobId=${encodeURIComponent(jobId)}`;
          window.NavbarComponent?.showRunToast?.(agentLabel, agentUrl);
          window.NavbarComponent?.incrementNotificationBadge?.(1);

          // Re-enable button immediately so user can queue more runs
          runButton.disabled = false;

          const estimatedDurationMs = typeof json?.estimatedDurationMs === 'number' && Number.isFinite(json.estimatedDurationMs)
            ? json.estimatedDurationMs
            : null;
          const pollTimeoutMs = estimatedDurationMs
            ? Math.min(60 * 60 * 1000, Math.max(10 * 60 * 1000, estimatedDurationMs + 15 * 60 * 1000))
            : undefined;

          const job = await pollJob(jobId, {
            ...(pollTimeoutMs ? { timeoutMs: pollTimeoutMs } : {}),
            onTick: (j) => {
              if (j && typeof j === 'object' && j._transientError) {
                setStatus(root, 'Reconnecting…');
                return;
              }
              const pct = normalizeJobProgress(j?.progress);

              // Update progress UI
              if (pct != null && activeOutputContainer) {
                progressController.update(activeOutputContainer, pct);
              }

              if (historyPanel) {
                const pctText = pct != null ? ` (${Math.round(pct)}%)` : '';
                const runningEntry = {
                  id: idempotencyKey,
                  runId: idempotencyKey,
                  jobId,
                  idempotencyKey,
                  agentId,
                  modelUsed: modelName,
                  prompt: promptText || '',
                  duration: input?.duration,
                  input: input || {},
                  status: `Running${pctText}`,
                  createdAt: new Date().toISOString(),
                  ...(inputThumbUrl ? { preview: { url: inputThumbUrl } } : {}),
                };
                historyPanel.addCreation(runningEntry);
              }

              setStatus(root, 'Running');
            },
          });

          if (job.status === 'failed') {
            if (!useHistoryTabLayout) progressController.clear();
            const msg = job?.error?.message || 'Job failed';
            setStatus(root, 'Failed', 'error');

            if (activeOutputContainer) {
              setHistoryOutputContainerMode(activeOutputContainer, null);
              activeOutputContainer.classList.remove('hidden');
              renderError(activeOutputContainer, msg);
            }
            if (historyPanel) {
              const failedEntry = {
                id: idempotencyKey,
                runId: idempotencyKey,
                idempotencyKey,
                agentId,
                modelUsed: modelName,
                prompt: promptText || '',
                duration: input?.duration,
                input: input || {},
                status: 'Failed',
                createdAt: new Date().toISOString(),
                output: { error: msg },
                ...(inputThumbUrl ? { preview: { url: inputThumbUrl } } : {}),
              };
              historyPanel.addCreation(failedEntry);
            }

            await refreshCreditsHint({ force: true });
            return;
          }

          if (!useHistoryTabLayout) {
            progressController.finish(activeOutputContainer);
            await new Promise(r => setTimeout(r, 300)); // Brief pause to show 100%
          } else {
            progressController.clear();
            if (activeOutputContainer) activeOutputContainer.classList.add('hidden');
          }
          setStatus(root, 'Completed', 'success');

          if (activeOutputContainer && !useHistoryTabLayout) {
            setHistoryOutputContainerMode(activeOutputContainer, job.output);
            activeOutputContainer.classList.remove('hidden');
            renderOutput(activeOutputContainer, job.output, { showPublish: true });
          }
          if (!useHistoryTabLayout) showOutputShareMenu(root, job.output, agent?.name);

          if (historyPanel) {
            const finalUrl = getOutputUrl(job.output);
            const doneEntry = {
              id: idempotencyKey,
              runId: idempotencyKey,
              idempotencyKey,
              agentId,
              modelUsed: modelName,
              prompt: promptText || '',
              duration: input?.duration,
              input: input || {},
              status: 'Completed',
              createdAt: new Date().toISOString(),
              ...(finalUrl ? { preview: { url: finalUrl } } : {}),
              output: job.output,
            };
            historyPanel.addCreation(doneEntry);
            // if (useHistoryTabLayout) handleHistorySelect(doneEntry); // Only show list
          }

          if (job.output?.conversationId) {
            sessionStorage.setItem(`conversation_${agentId}`, job.output.conversationId);
          }


          await refreshCreditsHint({ force: true });
          return;
        }

        if (!res.ok) {
          if (!useHistoryTabLayout) progressController.clear();

          if (res.status === 402 && json?.code === 'QUEUE_LIMIT_EXCEEDED') {
            setStatus(root, 'Queue limit reached', 'error');
            pricingModal();
            if (activeOutputContainer) {
              setHistoryOutputContainerMode(activeOutputContainer, null);
              activeOutputContainer.classList.remove('hidden');
              renderPendingPaidInto(activeOutputContainer, {
                title: 'Queue Limit Reached',
                message: json.error,
                onRetry: () => runButton?.click(),
              });
            }
            historyPanel?.removeCreation?.(idempotencyKey);
            return;
          }

          if (res.status === 402) {
            const required = json?.requiredCredits;
            const available = json?.availableCredits;
            const suggested = Array.isArray(json?.suggestedModels) ? json.suggestedModels : [];

            setStatus(root, 'Insufficient credits', 'error');
            await refreshCreditsHint({ force: true });
            pricingModal();
            const suggestedHtml = suggested.length
              ? `<div class="mt-3 text-xs text-gray-300">Try a cheaper model: ${suggested
                .map((m) => `${m.displayName || m.id} (${m.requiredCredits} credits)`)
                .join(', ')}</div>`
              : '';

            if (activeOutputContainer) {
              setHistoryOutputContainerMode(activeOutputContainer, null);
              activeOutputContainer.classList.remove('hidden');
              activeOutputContainer.innerHTML = `
                <div class="flex flex-col items-center justify-center text-center py-8 px-4">
                  <div class="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center mb-3">
                    <svg class="w-5 h-5 text-red-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/></svg>
                  </div>
                  <div class="text-sm font-semibold text-foreground">Insufficient credits</div>
                  <div class="mt-1.5 text-xs text-muted-foreground">Need <span class="font-semibold text-foreground">${required}</span> credits, have <span class="font-semibold text-foreground">${available}</span></div>
                  <a href="/aitopia/marketplace/pricing.html" class="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary/90 text-primary-foreground text-xs font-medium hover:bg-[#7E2BD0] transition-colors">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
                    Get Credits
                  </a>
                  ${suggestedHtml}
                </div>
              `;
            }
            if (historyPanel) {
              const failedEntry = {
                id: idempotencyKey,
                runId: idempotencyKey,
                idempotencyKey,
                agentId,
                modelUsed: modelName,
                prompt: promptText || '',
                duration: input?.duration,
                input: input || {},
                status: 'Failed',
                createdAt: new Date().toISOString(),
                output: { error: `Insufficient credits: need ${required}, have ${available}.` },
                ...(inputThumbUrl ? { preview: { url: inputThumbUrl } } : {}),
              };
              historyPanel.addCreation(failedEntry);
            }
            return;
          }

          const message = json?.error || json?.error?.message || `Generate failed (${res.status})`;
          setStatus(root, 'Failed', 'error');
          if (activeOutputContainer) {
            setHistoryOutputContainerMode(activeOutputContainer, null);
            activeOutputContainer.classList.remove('hidden');
            renderError(activeOutputContainer, message);
          }
          if (historyPanel) {
            const failedEntry = {
              id: idempotencyKey,
              runId: idempotencyKey,
              idempotencyKey,
              agentId,
              modelUsed: modelName,
              prompt: promptText || '',
              duration: input?.duration,
              input: input || {},
              status: 'Failed',
              createdAt: new Date().toISOString(),
              output: { error: message },
              ...(inputThumbUrl ? { preview: { url: inputThumbUrl } } : {}),
            };
            historyPanel.addCreation(failedEntry);
          }
          return;
        }

        // Sync completion - finish progress and show output
        if (!useHistoryTabLayout) {
          progressController.finish(activeOutputContainer);
          await new Promise(r => setTimeout(r, 200)); // Brief pause to show 100%
        } else {
          progressController.clear();
          if (activeOutputContainer) activeOutputContainer.classList.add('hidden');
        }
        setStatus(root, 'Completed', 'success');

        if (activeOutputContainer && !useHistoryTabLayout) {
          setHistoryOutputContainerMode(activeOutputContainer, json?.output);
          activeOutputContainer.classList.remove('hidden');
          renderOutput(activeOutputContainer, json?.output, { showPublish: true });
        }
        if (!useHistoryTabLayout) showOutputShareMenu(root, json?.output, agent?.name);

        if (historyPanel) {
          const finalUrl = getOutputUrl(json?.output);
          const doneEntry = {
            id: idempotencyKey,
            runId: idempotencyKey,
            idempotencyKey,
            agentId,
            modelUsed: modelName,
            prompt: promptText || '',
            duration: input?.duration,
            status: 'Completed',
            createdAt: new Date().toISOString(),
            ...(finalUrl ? { preview: { url: finalUrl } } : {}),
            output: json?.output,
          };
          historyPanel.addCreation(doneEntry);
          // if (useHistoryTabLayout) handleHistorySelect(doneEntry); // Only show list
        }

        if (json?.output?.conversationId) {
          sessionStorage.setItem(`conversation_${agentId}`, json.output.conversationId);
        }


        await refreshCreditsHint({ force: true });
      } catch (err) {
        if (uploadSimTimer) { clearInterval(uploadSimTimer); uploadSimTimer = null; }
        if (err?.name === 'FieldValidationError' && err?.fieldId) {
          historyPanel?.removeCreation?.(idempotencyKey);
          progressController.clear();
          if (activeOutputContainer) {
            activeOutputContainer.classList.add('hidden');
          }
          setStatus(root, 'Ready');
          if (typeof formController?.setFieldError === 'function') {
            formController.setFieldError(err.fieldId, err.message);
          }
          runButton.disabled = false;
          return;
        }

        const errMsg = err?.message || String(err);
        const requiredMatch = errMsg.match(/^(.+?)\s+is\s+required\.?$/i);
        if (requiredMatch && typeof formController?.setFieldError === 'function') {
          const fieldLabel = requiredMatch[1].trim();
          const possibleIds = [
            fieldLabel.toLowerCase().replace(/\s+/g, ''),
            fieldLabel.toLowerCase().replace(/\s+/g, '_'),
            fieldLabel.toLowerCase().replace(/\s+/g, '-'),
            fieldLabel.charAt(0).toLowerCase() + fieldLabel.slice(1).replace(/\s+/g, ''),
          ];

          historyPanel?.removeCreation?.(idempotencyKey);
          progressController.clear();
          if (activeOutputContainer) {
            activeOutputContainer.classList.add('hidden');
          }
          setStatus(root, 'Ready');

          for (const fieldId of possibleIds) {
            formController.setFieldError(fieldId, `Please provide ${fieldLabel.toLowerCase()}`);
          }
          runButton.disabled = false;
          return;
        }

        if (!useHistoryTabLayout) progressController.clear();

        setStatus(root, 'Failed', 'error');
        if (activeOutputContainer) {
          setHistoryOutputContainerMode(activeOutputContainer, null);
          activeOutputContainer.classList.remove('hidden');
          renderError(activeOutputContainer, err?.message || String(err));
        }
        if (historyPanel) {
          const failedEntryId = idempotencyKey || `runner-${agentId}-${uuid()}`;
          const errorMessage = err?.message || String(err);
          const failedEntry = {
            id: failedEntryId,
            runId: failedEntryId,
            idempotencyKey: failedEntryId,
            agentId,
            modelUsed: modelName,
            prompt: promptText || '',
            duration: input?.duration,
            status: 'Failed',
            createdAt: new Date().toISOString(),
            output: { error: errorMessage },
            ...(inputThumbUrl ? { preview: { url: inputThumbUrl } } : {}),
          };
          historyPanel.addCreation(failedEntry);
        }
      } finally {
        runButton.disabled = false;
      }
    });
  } catch (err) {
    setStatus(root, 'Failed', 'error');
    renderError(activeOutputContainer, err?.message || String(err));
  } finally {
    runButton.disabled = false;
  }
}

main();
