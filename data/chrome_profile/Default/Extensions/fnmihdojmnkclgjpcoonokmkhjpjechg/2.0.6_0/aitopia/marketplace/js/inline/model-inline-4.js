// Global state
let modelInfo = null;
let modelSchema = null;
let uploadedFiles = {};
let pollingInterval = null;
let lastPlaygroundRunId = null;
const jobIdToRunId = {}; // runId for publish

document.addEventListener('click', (e) => {
  if (!e.target.closest('.relative')) {
    document.querySelectorAll('.custom-select-dropdown').forEach(d => {
      d.classList.add('hidden');
      const svg = d.previousElementSibling?.querySelector('svg');
      if (svg) svg.style.transform = '';
    });
  }
});

// ===== TAB SYSTEM (matching agent page) =====
const modelTabs = {
  playground: document.querySelector('[data-model-tab="playground"]'),
  details: document.querySelector('[data-model-tab="details"]'),
  history: document.querySelector('[data-model-tab="history"]'),
  info: document.querySelector('[data-model-tab="info"]'),
  similar: document.querySelector('[data-model-tab="similar"]')
};
const modelPanels = {
  playground: document.querySelector('[data-model-panel="playground"]'),
  details: document.querySelector('[data-model-panel="details"]'),
  history: document.querySelector('[data-model-panel="history"]'),
  info: document.querySelector('[data-model-panel="info"]'),
  similar: document.querySelector('[data-model-panel="similar"]')
};
const historyControls = document.getElementById('history-controls');
const shareMoreRow = document.getElementById('model-tab-row-share-more');

const isMobile = () => window.innerWidth < 1024;
let currentModelTab = 'details';
let historyLoaded = false;
let historyPanel = null;

const baseTabClasses = 'px-4 h-8 rounded-2xl text-[13px] font-semibold transition-all whitespace-nowrap';
const activeTabClasses = 'bg-white dark:bg-[#272727] text-[#0D0D0D] dark:text-foreground shadow-sm';
const inactiveTabClasses = 'text-[#898A8B] dark:text-muted-foreground hover:text-[#0D0D0D] dark:hover:text-foreground hover:bg-white/50 dark:hover:bg-[#272727]/50';

function switchModelTab(tabId) {
  currentModelTab = tabId;
  const mobile = isMobile();

  Object.keys(modelTabs).forEach(id => {
    const tab = modelTabs[id];
    if (!tab) return;
    const isActive = id === tabId;
    const lgHidden = id === 'playground' ? 'lg:hidden ' : '';
    tab.className = lgHidden + baseTabClasses + ' ' + (isActive ? activeTabClasses : inactiveTabClasses);
  });

  Object.keys(modelPanels).forEach(id => {
    const panel = modelPanels[id];
    if (!panel) return;
    if (id === 'playground') {
      // Left panel: Always visible on desktop, only on Create tab on mobile
      if (mobile) {
        panel.classList.toggle('hidden', tabId !== 'playground');
      } else {
        panel.classList.remove('hidden');
        panel.classList.add('lg:block');
      }
    } else {
      panel.classList.toggle('hidden', id !== tabId);
    }
  });

  // Show share menu only on details tab
  if (shareMoreRow) {
    const showShare = tabId === 'details';
    shareMoreRow.classList.toggle('hidden', !showShare);
  }

  // Show history controls only on history tab
  if (historyControls) {
    if (tabId === 'history') {
      historyControls.className = 'hidden lg:flex items-center gap-3';
    } else {
      historyControls.className = 'hidden items-center gap-3';
    }
  }

  // Load history on first visit
  if (tabId === 'history' && !historyLoaded && modelInfo) {
    historyLoaded = true;
    initHistoryPanel();
  }
}

// Attach tab click handlers
Object.keys(modelTabs).forEach(id => {
  modelTabs[id]?.addEventListener('click', () => switchModelTab(id));
});

// Set initial tab
if (isMobile()) {
  switchModelTab('playground');
} else {
  switchModelTab('details');
}

// Handle resize
let wasMobile = isMobile();
window.addEventListener('resize', () => {
  const nowMobile = isMobile();
  if (wasMobile !== nowMobile) {
    wasMobile = nowMobile;
    switchModelTab(currentModelTab);
  }
});

// ===== REMIX AREA =====

let remixTab = 'community';
let remixLoading = false;
let mineRuns = []; // Cache for "Mine" tab data

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function extractMediaUrl(output, depth) {
  if (!output) return null;
  if (typeof depth === 'undefined') depth = 0;
  if (depth > 4) return null;
  if (typeof output === 'string') return output.startsWith('http') ? output : null;
  if (Array.isArray(output)) {
    for (let i = 0; i < Math.min(output.length, 5); i++) {
      const found = extractMediaUrl(output[i], depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof output !== 'object') return null;
  // Check common keys first for faster match
  const priority = ['url', 'output', 'image', 'images', 'video', 'audio', 'result', 'results',
    'resultUrl', 'video_url', 'image_url', 'audio_url', 'outputs', 'data', 'src', 'href', 'file'];
  for (const k of priority) {
    const v = output[k];
    if (v) {
      const found = extractMediaUrl(v, depth + 1);
      if (found) return found;
    }
  }
  // Fallback: scan remaining keys
  for (const k of Object.keys(output)) {
    if (priority.includes(k)) continue;
    const v = output[k];
    if (typeof v === 'string' && v.startsWith('http')) return v;
    if ((Array.isArray(v) || (typeof v === 'object' && v)) && depth < 2) {
      const found = extractMediaUrl(v, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function detectMediaKind(url) {
  if (!url) return 'unknown';
  const lower = url.toLowerCase();
  if (lower.match(/\.(mp4|webm|mov|avi)/)) return 'video';
  if (lower.match(/\.(png|jpg|jpeg|webp|gif|svg)/)) return 'image';
  if (lower.match(/\.(mp3|wav|ogg|flac|m4a)/)) return 'audio';
  if (lower.includes('/video/') || lower.includes('video')) return 'video';
  if (lower.includes('/audio/') || lower.includes('audio')) return 'audio';
  return 'image';
}

/** Mount remix area tab switching and load initial data */
function mountRemixArea() {
  const tabs = document.querySelectorAll('[data-remix-tab]');
  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      const newTab = btn.getAttribute('data-remix-tab');
      if (newTab && newTab !== remixTab) {
        remixTab = newTab;
        // Update active/inactive styles
        tabs.forEach(b => {
          const isActive = b.getAttribute('data-remix-tab') === newTab;
          b.classList.toggle('bg-white', isActive);
          b.classList.toggle('dark:bg-[#272727]', isActive);
          b.classList.toggle('text-[#0D0D0D]', isActive);
          b.classList.toggle('dark:text-foreground', isActive);
          b.classList.toggle('shadow-sm', isActive);
          b.classList.toggle('text-[#898A8B]', !isActive);
          b.classList.toggle('dark:text-muted-foreground', !isActive);
        });
        loadRemixGrid();
      }
    });
  });
  // Initial load
  loadRemixGrid();
}

async function loadRemixGrid() {
  if (!modelInfo?.id || remixLoading) return;
  remixLoading = true;

  const grid = document.getElementById('remixGrid');
  grid.innerHTML = `
    <div class="w-full flex items-center justify-center py-8" style="column-span:all">
      <div class="animate-spin w-6 h-6 border-2 border-primary/90 border-t-transparent rounded-full"></div>
    </div>`;

  try {
    let items = [];

    if (remixTab === 'community') {
      // Fetch public outputs for this model
      const res = await fetch(`https://aitopia.ai/api/outputs?limit=12&offset=0&sourceStoreId=${encodeURIComponent(modelInfo.id)}`);
      if (res.ok) {
        const json = await res.json();
        items = json?.outputs || [];
      }
    } else {
      // Mine: fetch user's runs for this model
      const historyUrl = new URL(buildModelApiUrl('history', modelInfo.id), window.location.origin);
      historyUrl.searchParams.set('limit', '20');
      historyUrl.searchParams.set('offset', '0');
      const res = await fetch(historyUrl.toString());
      if (res.ok) {
        const json = await res.json();
        mineRuns = json?.runs || [];
        // Convert runs to output-like items for grid rendering
        items = mineRuns.map(run => ({
          id: run.id,
          runId: run.id,
          preview: getRunPreview(run),
          sourceStoreId: modelInfo.id,
          prompt: run.input?.prompt || '',
          input: run.input,
          output: run.output,
          createdAt: run.createdAt,
        }));
      }
    }

    if (items.length === 0) {
      grid.innerHTML = `
        <div class="w-full flex flex-col items-center justify-center min-h-[200px] text-[#898A8B]" style="column-span:all">
          <img src="https://aitopia.ai/icons/gallery.svg" alt="" class="w-9 h-9 mb-3" data-hide-on-error>
          <p class="text-sm">${remixTab === 'mine' ? 'No creations yet.' : 'No shared posts yet.'}</p>
        </div>`;
    } else {
      grid.innerHTML = items.map(item => renderRemixGridItem(item)).join('');
      // Autoplay videos
      grid.querySelectorAll('.remix-item video').forEach(v => v.play?.().catch(() => {}));
    }
  } catch (err) {
    console.error('Failed to load remix grid:', err);
    grid.innerHTML = `
      <div class="w-full text-center py-8 text-[#898A8B] text-sm" style="column-span:all">Failed to load</div>`;
  }

  remixLoading = false;
}

function getRunPreview(run) {
  const url = extractMediaUrl(run.output);
  if (url) return { kind: detectMediaKind(url), url };
  // Text fallback for text-to-text models
  const out = run.output;
  if (typeof out === 'string' && out.trim()) {
    return { kind: 'text', text: out.length > 160 ? out.slice(0, 159) + '…' : out };
  }
  if (Array.isArray(out) && out.length > 0 && out.every(i => typeof i === 'string')) {
    const joined = out.join('');
    if (joined.trim()) return { kind: 'text', text: joined.length > 160 ? joined.slice(0, 159) + '…' : joined };
  }
  return null;
}

function formatRemixTime(ts) {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

function renderRemixGridItem(item) {
  const id = String(item?.id || item?.runId || '');
  const preview = item?.preview;
  const kind = preview?.kind || 'image';
  const url = typeof preview?.url === 'string' ? preview.url : '';
  const isRun = Boolean(item?.runId);
  const title = String(item?.title || item?.prompt || '');
  const sourceStoreId = String(item?.sourceStoreId || modelInfo?.id || '');
  const createdAt = item?.createdAt || '';

  const viewHref = isRun
    ? `/aitopia/marketplace/outputs.html?runId=${encodeURIComponent(id)}`
    : `/aitopia/marketplace/outputs.html?id=${encodeURIComponent(id)}`;

  const isModelSource = sourceStoreId.includes('/');
  const remixParam = isRun ? 'remixRunId' : 'remixOutputId';
  const remixHref = isModelSource
    ? `/aitopia/marketplace/model.html?owner=${encodeURIComponent(sourceStoreId.split("/")[0])}&model=${encodeURIComponent(sourceStoreId.split("/").slice(1).join("/"))}&${remixParam}=${encodeURIComponent(id)}`
    : `/aitopia/marketplace/agent/${encodeURIComponent(sourceStoreId)}.html?${remixParam}=${encodeURIComponent(id)}`;

  const previewText = typeof preview?.text === 'string' ? preview.text : '';
  let mediaHtml = '';
  if (kind === 'text' && previewText) {
    mediaHtml = `
      <div class="bg-secondary/50 overflow-hidden rounded-ios-xl min-h-[120px]">
        <p class="p-3 text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">${escapeHtml(previewText)}</p>
      </div>`;
  } else if (kind === 'video' && url) {
    mediaHtml = `<video src="${escapeHtml(url)}" class="w-full h-auto rounded-ios-xl" autoplay muted loop playsinline></video>`;
  } else if ((kind === 'image' || !kind) && url) {
    mediaHtml = `<img src="${escapeHtml(url)}" alt="" class="w-full h-auto rounded-ios-xl" loading="lazy" />`;
  } else {
    mediaHtml = `<div class="rounded-ios-xl bg-secondary/50 min-h-[120px] flex items-center justify-center text-5xl">🎨</div>`;
  }

  const likeCount = Number(item?.likeCount ?? 0);
  const commentCount = Number(item?.commentCount ?? 0);
  const remixCount = Number(item?.remixCount ?? 0);
  const timeStr = formatRemixTime(createdAt);

  return `
    <div class="remix-item group cursor-pointer" data-creation-id="${escapeHtml(id)}">
      <div class="relative overflow-hidden rounded-ios-xl">
        ${mediaHtml}
        <div class="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-ios-xl flex flex-col justify-end p-3.5">
          <div class="transform translate-y-3 group-hover:translate-y-0 transition-transform duration-300 ease-out">
            ${title ? `<h3 class="text-white font-semibold text-[13px] leading-snug line-clamp-2">${escapeHtml(title)}</h3>` : ''}
            <p class="text-white/80 text-[11px] mt-0.5 truncate">${escapeHtml(sourceStoreId || '')}${timeStr ? ` &middot; ${escapeHtml(timeStr)}` : ''}</p>
            ${!isRun ? `<div class="flex items-center gap-3 mt-1.5 text-white/70 text-[11px]">
              <span class="inline-flex items-center gap-1"><svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"/></svg>${likeCount}</span>
              <span class="inline-flex items-center gap-1"><svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z"/></svg>${commentCount}</span>
              <span class="inline-flex items-center gap-1"><svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3"/></svg>${remixCount}</span>
            </div>` : ''}
            <div class="flex gap-1.5 sm:gap-2 mt-2 sm:mt-2.5">
              <a href="${viewHref}" class="flex-1 h-7 sm:h-8 flex items-center justify-center rounded-full bg-white/95 text-gray-900 text-[11px] sm:text-xs font-semibold hover:bg-white transition-colors backdrop-blur-sm stop-propagation">
                View
              </a>
              <a href="${remixHref}" class="flex-1 h-7 sm:h-8 flex items-center justify-center gap-1 sm:gap-1.5 rounded-full bg-primary/90 hover:bg-primary text-primary-foreground text-[11px] sm:text-xs font-semibold transition-colors stop-propagation">
                <svg class="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3"/></svg>
                Remix
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

/** Apply remix defaults to schema before building form (same pattern as agent embed-runner) */
function applyRemixDefaultsToSchema(schema, defaults) {
  if (!schema || !defaults || typeof defaults !== 'object') return schema;
  const cloned = JSON.parse(JSON.stringify(schema));
  const properties = cloned?.properties;
  if (!properties) return cloned;
  for (const [key, value] of Object.entries(defaults)) {
    if (properties[key] && typeof properties[key] === 'object') {
      properties[key].default = value;
    }
  }
  return cloned;
}

/** After a new generation completes, refresh history */
function addToHistoryCache(formData, output) {
  if (!modelInfo?.id) return;
  if (remixTab === 'mine') {
    loadRemixGrid();
  }
  if (historyPanel) {
    historyPanel.refresh();
  }
}

/** Push an in-progress or completed creation into the history panel */
function pushToHistoryPanel(jobId, formData, status, output) {
  if (!historyPanel || !modelInfo?.id) return;
  const runId = jobIdToRunId[jobId] || lastPlaygroundRunId || jobId;
  historyPanel.addCreation({
    id: runId,
    runId: runId,
    jobId: jobId,
    idempotencyKey: runId,
    agentId: modelInfo.id,
    modelUsed: modelInfo.name || modelInfo.id,
    prompt: formData?.prompt || formData?.text || '',
    input: formData || {},
    status: status,
    output: output || null,
    createdAt: new Date().toISOString(),
  });
}

// ===== PUBLISH MODAL =====
const _publishModalReady = import('/aitopia/marketplace/js/shared/creation-modal.js').then(mod => {
  if (mod.openPublishModal) {
    window.__AITOPIA_OPEN_PUBLISH_MODAL__ = mod.openPublishModal;
  }
}).catch(() => {});

// ===== CREATION HISTORY (via creation-history.js module) =====
let historyViewMode = 'list'; // 'list' or 'grid'

async function initHistoryPanel() {
  if (!modelInfo?.id) return;
  const listContainer = document.getElementById('modelHistoryList');
  if (!listContainer) return;

  try {
    await _publishModalReady;
    const { createCreationHistoryPanel } = await import('/aitopia/marketplace/js/runner/creation-history.js');
    historyPanel = createCreationHistoryPanel(listContainer, {
      sourceStoreId: modelInfo.id,
      onSelect: (creation) => {
        // Optional: handle selection if needed
      },
    });
    historyPanel.load();
  } catch (err) {
    console.error('Failed to init creation history panel:', err);
    listContainer.innerHTML = `
      <div class="flex items-center justify-center py-16 min-h-[350px]">
        <p class="text-sm text-muted-foreground">Failed to load history</p>
      </div>`;
  }
}

// ===== VIEW TOGGLE (List/Grid) =====
(() => {
  const listBtn = document.querySelector('[data-view-mode="list"]');
  const gridBtn = document.querySelector('[data-view-mode="grid"]');
  if (!listBtn || !gridBtn) return;

  function setView(mode) {
    historyViewMode = mode;
    if (mode === 'list') {
      listBtn.classList.add('active');
      gridBtn.classList.remove('active');
    } else {
      gridBtn.classList.add('active');
      listBtn.classList.remove('active');
    }
    if (historyPanel) {
      historyPanel.setViewMode(mode);
    }
  }

  listBtn.addEventListener('click', () => setView('list'));
  gridBtn.addEventListener('click', () => setView('grid'));
})();

// ===== SIZE SLIDER =====
(() => {
  const slider = document.getElementById('preview-size-slider');
  const gridContainer = document.querySelector('[data-history-grid-view]');
  if (!slider) return;

  function updateSize(value) {
    if (gridContainer) {
      if (value <= 33) {
        gridContainer.className = gridContainer.className.replace(/cols-\d/g, '') + ' cols-4';
      } else if (value <= 66) {
        gridContainer.className = gridContainer.className.replace(/cols-\d/g, '') + ' cols-3';
      } else {
        gridContainer.className = gridContainer.className.replace(/cols-\d/g, '') + ' cols-2';
      }
    }
  }
  slider.addEventListener('input', (e) => updateSize(parseInt(e.target.value, 10)));
  updateSize(parseInt(slider.value, 10));
})();

// ===== SHARE MENU =====
document.addEventListener('click', (e) => {
  const shareMenu = document.getElementById('model-share-menu');
  if (shareMenu && !shareMenu.contains(e.target)) {
    const dropdown = shareMenu.querySelector('[role="menu"]');
    if (dropdown) dropdown.classList.add('hidden');
  }
});

(() => {
  const shareMenu = document.getElementById('model-share-menu');
  if (!shareMenu) return;
  const toggle = shareMenu.querySelector('[data-model-share-toggle]');
  const dropdown = shareMenu.querySelector('[role="menu"]');
  if (!toggle || !dropdown) return;

  const pageUrl = window.__AITOPIA_DOMAIN__ || 'https://aitopia.ai' + window.location.pathname;
  const shareText = 'Check out this model on AITOPIA: ' + pageUrl;

  toggle.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    const isOpen = !dropdown.classList.contains('hidden');
    dropdown.classList.toggle('hidden', isOpen);
    toggle.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
  });

  shareMenu.querySelectorAll('[data-model-share]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const kind = btn.getAttribute('data-model-share');
      dropdown.classList.add('hidden');
      toggle.setAttribute('aria-expanded', 'false');
      if (kind === 'copy') {
        try { await navigator.clipboard.writeText(pageUrl); } catch {}
        return;
      }
      if (kind === 'email') {
        window.location.href = 'mailto:?subject=' + encodeURIComponent('AITOPIA Model') + '&body=' + encodeURIComponent(pageUrl);
        return;
      }
      if (kind === 'x') {
        window.open('https://twitter.com/intent/tweet?url=' + encodeURIComponent(pageUrl) + '&text=' + encodeURIComponent(shareText), '_blank', 'width=550,height=420');
        return;
      }
      if (kind === 'facebook') {
        window.open('https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(pageUrl), '_blank', 'width=550,height=420');
        return;
      }
      if (kind === 'linkedin') {
        window.open('https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(pageUrl), '_blank', 'width=550,height=420');
        return;
      }
      if (kind === 'whatsapp') {
        window.open('https://wa.me/?text=' + encodeURIComponent(shareText), '_blank');
      }
    });
  });
})();

// Parse URL to get model info
function isSimpleOwnerModelId(modelId) {
  const parts = String(modelId || '').split('/').filter(Boolean);
  return parts.length === 2;
}

function buildModelApiUrl(kind, modelId) {
  const normalized = String(modelId || '').trim();
  if (!normalized) return 'https://aitopia.ai/api/models';

  const parts = normalized.split('/').filter(Boolean);
  if (parts.length < 2) return 'https://aitopia.ai/api/models';

  const owner = encodeURIComponent(parts[0]);
  const modelPath = parts.slice(1).map((segment) => encodeURIComponent(segment)).join('/');

  if (kind === 'info') return `https://aitopia.ai/api/models/info/${owner}/${modelPath}`;
  if (kind === 'schema') return `https://aitopia.ai/api/models/info/${owner}/${modelPath}/schema`;
  if (kind === 'examples') return `https://aitopia.ai/api/models/info/${owner}/${modelPath}/examples`;
  if (kind === 'history') return `https://aitopia.ai/api/models/info/${owner}/${modelPath}/history`;
  if (kind === 'run') return `https://aitopia.ai/api/models/info/${owner}/${modelPath}/run`;
  return 'https://aitopia.ai/api/models';
}

function parseModelFromUrl() {
  const params = new URLSearchParams(window.location.search);

  // Check query params first
  if (params.has('modelId')) {
    return {
      modelId: params.get('modelId')
    };
  }
  if (params.has('owner') && params.has('model')) {
    return {
      modelId: `${params.get('owner')}/${params.get('model')}`
    };
  }

  // Owner-only query param: redirect to owner page (e.g., /model.html?owner=black-forest-labs → /black-forest-labs)
  if (params.has('owner') && !params.has('model')) {
    window.location.href = '/aitopia/marketplace/owner.html?owner=' + encodeURIComponent(params.get('owner'));
    return null;
  }

  const encodedPathMatch = window.location.pathname.match(/^\/models\/id\/([^/]+)$/);
  if (encodedPathMatch) {
    return {
      modelId: decodeURIComponent(encodedPathMatch[1])
    };
  }

  // Parse from path: /:owner/:model or /:owner/:nested/model/path
  const pathMatch = window.location.pathname.match(/^\/([^/]+)\/(.+)$/);
  if (pathMatch) {
    const owner = pathMatch[1];
    const model = pathMatch[2];
    // Skip if owner looks like a static file path
    if (['api', 'category', 'store', 'docs', 'assets', 'favicon'].includes(owner)) {
      return null;
    }
    return {
      modelId: `${owner}/${decodeURIComponent(model)}`
    };
  }

  // Fallback: handle /models.html/:owner/:model or /model.html/:owner/:model (wrong format)
  const fallbackMatch = window.location.pathname.match(/^\/(?:models?\.html)\/([^/]+)\/([^/]+)$/);
  if (fallbackMatch) {
    const owner = fallbackMatch[1];
    const model = fallbackMatch[2];
    // Redirect to correct URL format
    const correctUrl = `/${owner}/${model}`;
    console.warn(`Redirecting from legacy URL to: ${correctUrl}`);
    window.location.href = correctUrl;
    return null;
  }

  return null;
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[DEBUG] DOMContentLoaded fired');
  const modelParams = parseModelFromUrl();
  console.log('[DEBUG] modelParams:', modelParams);

  if (!modelParams) {
    showError('No model specified. Use URL like /google/veo-3');
    return;
  }

  console.log('[DEBUG] Calling loadModel with:', modelParams.modelId);
  await loadModel(modelParams.modelId);
  console.log('[DEBUG] loadModel completed');
});

// Load model info and schema
async function loadModel(modelId) {
  console.log('[DEBUG] loadModel started for:', modelId);
  try {
    // Fetch model info (API will detect provider from registry)
    const infoUrl = buildModelApiUrl('info', modelId);
    console.log('[DEBUG] Fetching from:', infoUrl);
    const modelResponse = await fetch(infoUrl);
    console.log('[DEBUG] modelResponse status:', modelResponse.status, modelResponse.ok);
    if (!modelResponse.ok) {
      const err = await modelResponse.json();
      throw new Error(err.error || `Model not found: ${modelId}`);
    }
    modelInfo = await modelResponse.json();
    console.log('[DEBUG] modelInfo received:', modelInfo?.id, modelInfo?.name);

    // Check if model is callable
    if (modelInfo.callable === false) {
      const reason = modelInfo.deprecatedReason || 'This model is not available for execution';
      showModelUnavailable(modelInfo, reason);
      return;
    }

    // Check for remixRunId or remixOutputId URL param (same pattern as agent embed-runner)
    const urlParams = new URLSearchParams(window.location.search);
    const remixRunId = urlParams.get('remixRunId') || null;
    const remixOutputId = urlParams.get('remixOutputId') || null;
    let remixDefaults = null;

    if (remixOutputId) {
      // Published output remix: fetch via /api/outputs/:id/remix which resolves source_run_id internally
      try {
        const remixRes = await fetch(`https://aitopia.ai/api/outputs/${encodeURIComponent(remixOutputId)}/remix`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
          credentials: 'include',
        });
        if (remixRes.ok) {
          const remixData = await remixRes.json();
          if (remixData?.defaults && typeof remixData.defaults === 'object') {
            remixDefaults = remixData.defaults;
          }
        }
      } catch (e) {
        console.warn('[model] Failed to load remix output:', e);
      }
    } else if (remixRunId) {
      // Direct run remix: fetch run data
      try {
        const runRes = await fetch(`https://aitopia.ai/runs/${encodeURIComponent(remixRunId)}`, { cache: 'no-store', credentials: 'include' });
        if (runRes.ok) {
          const runData = await runRes.json();
          const rawInput = runData?.input;
          if (rawInput && typeof rawInput === 'object') {
            remixDefaults = rawInput;
          }
        }
      } catch (e) {
        console.warn('[model] Failed to load remix run:', e);
      }
    }

    // Fetch schema
    console.log('[DEBUG] Fetching schema...');
    const schemaResponse = await fetch(buildModelApiUrl('schema', modelId));
    console.log('[DEBUG] schemaResponse status:', schemaResponse.status, schemaResponse.ok);
    if (schemaResponse.ok) {
      modelSchema = await schemaResponse.json();
      console.log('[DEBUG] Schema received, properties:', Object.keys(modelSchema?.properties || {}));
    }

    // Apply remix defaults to schema before building form (same as agent's applyRemixToSchema)
    if (remixDefaults && modelSchema) {
      modelSchema = applyRemixDefaultsToSchema(modelSchema, remixDefaults);
    }

    // Restore form state from sessionStorage snapshot (survives login redirect)
    if (!remixDefaults) {
      try {
        const snapRaw = sessionStorage.getItem('model_form_snapshot');
        if (snapRaw) {
          const snapAll = JSON.parse(snapRaw);
          const saved = snapAll?.[window.location.pathname];
          if (saved && typeof saved === 'object' && Object.keys(saved).length > 0 && modelSchema) {
            modelSchema = applyRemixDefaultsToSchema(modelSchema, saved);
          }
          sessionStorage.removeItem('model_form_snapshot');
        }
      } catch (_) { /* corrupt snapshot — ignore */ }
    }

    // Update UI
    console.log('[DEBUG] Calling updateModelUI and buildForm...');
    updateModelUI();
    buildForm();
    console.log('[DEBUG] UI updated, form built');

    // Generate API code examples
    generateCodeExamples();

    // Show content
    document.getElementById('loadingState')?.classList.add('hidden');
    document.getElementById('modelContent')?.classList.remove('hidden');

    // Mount remix area (tab switching + initial grid load)
    mountRemixArea();

    // Set the initial tab (re-set after content is visible)
    if (isMobile()) {
      switchModelTab('playground');
    } else {
      switchModelTab('details');
    }

  } catch (error) {
    console.error('[DEBUG] loadModel error:', error);
    showError(error.message);
  }
}

// Show model unavailable state (for non-callable models)
function showModelUnavailable(model, reason) {
  document.getElementById('loadingState')?.classList.add('hidden');

  // Create unavailable state if it doesn't exist
  let unavailableState = document.getElementById('unavailableState');
  if (!unavailableState) {
    unavailableState = document.createElement('div');
    unavailableState.id = 'unavailableState';
    unavailableState.className = 'flex flex-col items-center justify-center py-20';
    document.querySelector('main').appendChild(unavailableState);
  }

  unavailableState.innerHTML = `
    <div class="max-w-lg text-center">
      <div class="w-20 h-20 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto mb-6">
        <svg class="w-10 h-10 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
        </svg>
      </div>
      <h2 class="text-2xl font-bold mb-3">${model.displayName || model.id}</h2>
      <p class="text-lg text-yellow-400 mb-4">Model Unavailable</p>
      <div class="bg-[#F2F5F9] dark:bg-[#131517] border border-[#D9D9D9]/20 dark:border-[#D9D9D9]/[4%] rounded-ios-lg p-4 mb-6">
        <p class="text-muted-foreground">${reason}</p>
      </div>
      <div class="flex flex-col sm:flex-row gap-3 justify-center">
        <a href="/marketplace/${model.id.split('/')[0]}" class="px-5 py-2.5 bg-[#E9EEF7] dark:bg-[#1C1E20] hover:bg-[#DFE4EC] dark:hover:bg-[#252729] rounded-2xl text-sm font-medium transition-colors">
          Browse ${model.id.split('/')[0]} Models
        </a>
        <a href="/aitopia/marketplace/models.html" class="px-5 py-2.5 bg-primary/90 hover:bg-primary text-primary-foreground rounded-2xl text-sm font-medium transition-colors">
          Browse All Models
        </a>
      </div>
    </div>
  `;

  unavailableState.classList.remove('hidden');
}

// Load and display example media
async function loadExamples(modelId) {
  try {
    // Use cache: 'no-store' to prevent browser caching stale examples
    const response = await fetch(buildModelApiUrl('examples', modelId), { cache: 'no-store' });
    if (!response.ok) return;

    const data = await response.json();
    const examples = data.examples || [];

    if (examples.length === 0) return;

    const heroGrad = document.getElementById('heroGradient');
    const heroImg = document.getElementById('heroCoverImage');
    const heroVid = document.getElementById('heroCoverVideo');
    if (heroGrad && !heroGrad.classList.contains('hidden') === true) {
      const firstVisual = examples.find(e => e.type === 'video' || e.type === 'gif' || e.type === 'image' || (!e.type && e.url));
      if (firstVisual && firstVisual.url) {
        const isVid = firstVisual.type === 'video' || /\.(mp4|webm|mov)(\?|$)/i.test(firstVisual.url);
        if (isVid) {
          heroVid.src = firstVisual.url;
          heroVid.classList.remove('hidden');
          heroGrad.classList.add('hidden');
        } else {
          heroImg.src = firstVisual.url;
          heroImg.classList.remove('hidden');
          heroGrad.classList.add('hidden');
        }
      }
    }

    // Show gallery (if Examples tab exists)
    const gallery = document.getElementById('exampleGallery');
    const grid = document.getElementById('galleryGrid');
    if (!grid) return;

    grid.innerHTML = examples.map((example, index) => {
      const isVideo = example.type === 'video';
      const isGif = example.type === 'gif';
      const isAudio = example.type === 'audio';

      if (isAudio) {
        return `
          <div class="bg-[#E9EEF7] dark:bg-[#1C1E20] border border-[#D9D9D9]/20 dark:border-[#D9D9D9]/[4%] rounded-ios-lg p-3 flex items-center gap-2 cursor-pointer hover:bg-[#DFE4EC] dark:hover:bg-[#252729] transition" data-action="playAudio" data-param="${example.url}">
            <div class="w-10 h-10 bg-primary/90/15 rounded-full flex items-center justify-center">
              <svg class="w-5 h-5 text-primary" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"/>
              </svg>
            </div>
            <span class="text-sm text-muted-foreground truncate">${example.prompt ? example.prompt.slice(0, 30) + '...' : 'Audio'}</span>
          </div>
        `;
      }

	      if (isVideo) {
	        return `
	          <div class="relative aspect-video bg-[#E9EEF7] dark:bg-[#1C1E20] rounded-ios-lg overflow-hidden cursor-pointer group" data-action="openMediaModal" data-param="${example.url}" data-param2="video">
	            <video src="${example.url}" class="w-full h-full object-cover js-example-video" autoplay muted loop playsinline preload="metadata"></video>
	            <div class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
	              <div class="w-12 h-12 bg-primary-foreground/20 rounded-full flex items-center justify-center">
	                <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
	                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/>
	                </svg>
              </div>
            </div>
            <div class="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/60 rounded text-[10px] text-white">VIDEO</div>
          </div>
        `;
      }

      // Image or GIF
      return `
        <div class="relative aspect-square bg-[#E9EEF7] dark:bg-[#1C1E20] rounded-ios-lg overflow-hidden cursor-pointer group" data-action="openMediaModal" data-param="${example.url}" data-param2="image">
          <img src="${example.url}" alt="Example ${index + 1}" class="w-full h-full object-cover" loading="lazy">
          <div class="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition"></div>
          ${isGif ? '<div class="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/60 rounded text-[10px] text-white">GIF</div>' : ''}
        </div>
      `;
	    }).join('');

	    // Autoplay all visible preview videos; pause when off-screen.
	    // Reduced motion disables autoplay entirely.
	    const prefersReducedMotion = (() => {
	      try {
	        return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
	      } catch {
	        return false;
	      }
	    })();

	    const exampleVideos = grid.querySelectorAll('video.js-example-video');
	    if (exampleVideos.length > 0) {
	      exampleVideos.forEach((video) => {
	        video.muted = true;
	        video.loop = true;
	        video.playsInline = true;
	        video.setAttribute('playsinline', '');

	        if (prefersReducedMotion) {
	          video.autoplay = false;
	          video.removeAttribute('autoplay');
	          video.pause();
	        }
	      });

	      if (!prefersReducedMotion) {
	        if (window.__AITOPIA_EXAMPLE_VIDEO_OBSERVER__) {
	          try { window.__AITOPIA_EXAMPLE_VIDEO_OBSERVER__.disconnect(); } catch {}
	        }

	        if (typeof IntersectionObserver !== 'undefined') {
	          const observer = new IntersectionObserver((entries) => {
	            entries.forEach((entry) => {
	              const video = entry.target;
	              if (!video || typeof video.play !== 'function') return;

	              if (entry.isIntersecting) {
	                video.play().catch(() => {});
	              } else {
	                video.pause();
	              }
	            });
	          }, { threshold: 0.25 });

	          exampleVideos.forEach((video) => observer.observe(video));
	          window.__AITOPIA_EXAMPLE_VIDEO_OBSERVER__ = observer;
	        } else {
	          exampleVideos.forEach((video) => video.play().catch(() => {}));
	        }
	      }
	    }

	    const emptyState = document.getElementById('examplesEmpty');
	    if (emptyState) emptyState.classList.add('hidden');

    // Update toggle button visibility
    if (examples.length <= 4) {
      const toggleBtn = gallery.querySelector('button[onclick*="toggleGallery"]');
      if (toggleBtn) toggleBtn.classList.add('hidden');
    }

  } catch (error) {
    console.warn('Failed to load examples:', error);
  }
}

// Toggle gallery expand/collapse
function toggleGallery() {
  const grid = document.getElementById('galleryGrid');
  const toggleText = document.getElementById('galleryToggleText');
  if (!grid) return;
  const expanded = grid.dataset.expanded === 'true';

  if (expanded) {
    grid.classList.add('max-h-64');
    grid.dataset.expanded = 'false';
    toggleText.textContent = 'Show all';
  } else {
    grid.classList.remove('max-h-64');
    grid.dataset.expanded = 'true';
    toggleText.textContent = 'Show less';
  }
}

// Download media via fetch+blob (cross-origin safe)
async function downloadOutputUrl(url) {
  if (!url) return;
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const pathname = new URL(url, window.location.origin).pathname;
    const basename = pathname.split('/').filter(Boolean).pop() || 'output';
    const filename = basename.replace(/[^a-z0-9._-]/gi, '_') || 'output';
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

// Open media in modal
function openMediaModal(url, type) {
  const modal = document.createElement('div');
  modal.id = 'mediaModal';
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4';
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

	  let content = '';
	  if (type === 'video') {
	    content = `<video src="${url}" controls autoplay playsinline class="max-w-full max-h-[80vh] rounded-ios-xl"></video>`;
	  } else {
	    content = `<img src="${url}" class="max-w-full max-h-[80vh] rounded-ios-xl" alt="Example">`;
	  }

  modal.innerHTML = `
    <button data-action="removeMediaModal" class="absolute top-4 right-4 w-10 h-10 bg-primary-foreground/10 hover:bg-primary-foreground/20 rounded-full flex items-center justify-center transition">
      <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
      </svg>
    </button>
    <div class="flex flex-col items-center">
      ${content}
      <button data-action="downloadOutputUrl" data-param="${url}" class="mt-4 px-4 py-2 bg-primary/90 hover:bg-[#7B2BD6] rounded-ios-lg text-sm font-medium transition-colors flex items-center gap-2">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
        </svg>
        Download
      </button>
    </div>
  `;

  document.body.appendChild(modal);
}

// CSP-safe helper: remove media modal
window.removeMediaModal = function() { document.getElementById('mediaModal')?.remove(); };

// CSP-safe helper: copy element text content by ID
window.copyElementText = function(id) { const el = document.getElementById(id); if (el) copyToClipboard(el.textContent); };

// Play audio
function playAudio(url) {
  const audio = new Audio(url);
  audio.play();
}

// Show error state
function showError(message) {
  document.getElementById('loadingState')?.classList.add('hidden');
  document.getElementById('errorState')?.classList.remove('hidden');
  const errorMsgEl = document.getElementById('errorMessage'); if (errorMsgEl) errorMsgEl.textContent = message;
}

const DOLLARS_PER_CREDIT = 0.02;
const MIN_CREDITS_PER_RUN = 1;
const DEFAULT_ESTIMATE_SECONDS = 4;

function creditsFromDollars(dollars) {
  const safe = Number(dollars);
  if (!Number.isFinite(safe) || safe <= 0) return MIN_CREDITS_PER_RUN;
  return Math.max(MIN_CREDITS_PER_RUN, Math.ceil(safe / DOLLARS_PER_CREDIT));
}

function formatCredits(cost) {
  if (!cost) return 'Credits vary';
  if (typeof cost.perSecond === 'number' && Number.isFinite(cost.perSecond)) {
    const credits = creditsFromDollars(cost.perSecond * DEFAULT_ESTIMATE_SECONDS);
    return `~${credits} credits (${DEFAULT_ESTIMATE_SECONDS}s)`;
  }
  if (typeof cost.perOutput === 'number' && Number.isFinite(cost.perOutput)) {
    const credits = creditsFromDollars(cost.perOutput);
    return `${credits} credits`;
  }
  return 'Credits vary';
}

function extractCreditsNumber(creditsStr) {
  if (!creditsStr || creditsStr === 'Credits vary') return null;
  const match = creditsStr.match(/~?(\d+)/);
  return match ? (creditsStr.startsWith('~') ? '~' + match[1] : match[1]) : null;
}

// Global variable to store model behavior hint for prompt tooltip
let currentModelHint = '';

// Get model behavior hint based on capabilities
// Returns hint text for display in prompt field tooltip
function getModelBehaviorHint() {
  const caps = modelInfo?.capabilities || [];
  const modelId = (modelInfo?.id || '').toLowerCase();
  const name = (modelInfo?.name || '').toLowerCase();
  const combined = modelId + ' ' + name;

  // General-purpose multi-capability models should not show a specialized hint
  const isSpecialized = caps.length <= 4;

  // I2V (Image-to-Video) detection
  if (caps.includes('image-to-video') || combined.includes('i2v') || combined.includes('img2vid')) {
    return 'Image-to-Video model: Animates your INPUT IMAGE. The prompt guides motion/style, not content.';
  }
  // T2V (Text-to-Video) detection
  if (caps.includes('text-to-video') || combined.includes('t2v') || combined.includes('txt2vid')) {
    return 'Text-to-Video model: Generates video purely from your text prompt.';
  }
  // Face swap detection — only for dedicated face-swap models
  if (isSpecialized && (caps.includes('face-swap') || combined.includes('face-swap') || combined.includes('faceswap'))) {
    return 'Face swap model: Swaps faces between images. Upload a source face and a target.';
  }
  // Virtual try-on detection — only for dedicated try-on models
  if (isSpecialized && (caps.includes('virtual-try-on') || combined.includes('try-on') || combined.includes('tryon'))) {
    return 'Virtual try-on model: Puts clothing on a person. Upload person + garment.';
  }
  // Inpainting detection — only for dedicated inpainting models
  if (isSpecialized && (caps.includes('inpainting') || combined.includes('inpaint'))) {
    return 'Inpainting model: Edits specific areas of an image. You may need a mask.';
  }
  // Background removal detection — only for dedicated removal models
  if (isSpecialized && (caps.includes('background-removal') || combined.includes('rembg') || combined.includes('background'))) {
    return 'Background removal model: Removes backgrounds from images.';
  }
  // Upscaling detection
  if (caps.includes('image-upscaling') || caps.includes('video-upscaling') || combined.includes('upscale')) {
    return 'Upscaling model: Enhances image/video resolution.';
  }
  return '';
}

// Update UI with model info
function updateModelUI() {
  const parts = modelInfo.id.split('/');
  const owner = parts.length > 1 ? parts[0] : modelInfo.provider;
  const name = parts.length > 1 ? parts[1] : parts[0];

  // Update page title
  document.title = `${modelInfo.name || modelInfo.id} - AITOPIA Playground`;

  // Breadcrumb - link to owner page
  const breadcrumbProviderEl = document.getElementById('breadcrumbProvider');
  if (breadcrumbProviderEl) { breadcrumbProviderEl.textContent = owner; breadcrumbProviderEl.href = `/${owner}`; }
  const breadcrumbModelEl = document.getElementById('breadcrumbModel'); if (breadcrumbModelEl) breadcrumbModelEl.textContent = name;

  // Model header
  const modelNameEl = document.getElementById('modelName'); if (modelNameEl) modelNameEl.textContent = modelInfo.name || modelInfo.id;
  const modelIdEl = document.getElementById('modelId'); if (modelIdEl) modelIdEl.textContent = modelInfo.id;
  const modelDescEl = document.getElementById('modelDescription'); if (modelDescEl) modelDescEl.textContent = modelInfo.description || 'No description available.';

  // Set model behavior hint for prompt field tooltip
  currentModelHint = getModelBehaviorHint();

  // Credits (derived from cost; enforcement is server-side)
  const creditsStr = formatCredits(modelInfo.cost);

  const costEl = document.getElementById('modelCost');
  if (costEl) {
    costEl.textContent = creditsStr;
    costEl.className = 'px-2.5 py-1 text-xs font-semibold bg-black/30 text-white rounded-full backdrop-blur-sm';
  }

  const generateBtnCost = document.getElementById('generateBtnCost');
  const generateBtnCostValue = document.getElementById('generateBtnCostValue');
  if (generateBtnCost && generateBtnCostValue) {
    const creditsNum = extractCreditsNumber(creditsStr);
    if (creditsNum !== null) {
      generateBtnCostValue.textContent = creditsNum;
      generateBtnCost.classList.remove('hidden');
    } else {
      generateBtnCost.classList.add('hidden');
    }
  }

  // Tags
  //document.getElementById('modelProvider').textContent = modelInfo.provider;

  // Run count
  if (modelInfo.runCount) {
    const runCountEl = document.getElementById('modelRunCount');
    runCountEl.textContent = `${Number(modelInfo.runCount).toLocaleString()} runs`;
    runCountEl.classList.remove('hidden');
  }

  // Capabilities
  const capList = document.getElementById('capabilitiesList');
  if (modelInfo.capabilities && modelInfo.capabilities.length > 0) {
    capList.innerHTML = modelInfo.capabilities.map(cap =>
      `<span class="px-2 py-1 text-xs bg-[#E9EEF7] dark:bg-[#1C1E20] text-muted-foreground rounded-full">${cap}</span>`
    ).join('');
  } else {
    capList.innerHTML = '<span class="text-sm text-muted-foreground">No capabilities listed</span>';
  }

  // Schema info
  const schemaInfoEl = document.getElementById('schemaInfo');
  if (modelSchema) {
    const required = modelSchema.required || [];
    const properties = Object.keys(modelSchema.properties || {});
    schemaInfoEl.innerHTML = `
      <div class="flex justify-between">
        <dt class="text-muted-foreground">Total Fields</dt>
        <dd class="text-foreground font-medium">${properties.length}</dd>
      </div>
      <div class="flex justify-between">
        <dt class="text-muted-foreground">Required</dt>
        <dd class="text-foreground font-medium">${required.length}</dd>
      </div>
      <div class="flex justify-between">
        <dt class="text-muted-foreground">Optional</dt>
        <dd class="text-foreground font-medium">${properties.length - required.length}</dd>
      </div>
    `;
  }

  // Set hero cover image/video 
  const heroCoverImage = document.getElementById('heroCoverImage');
  const heroCoverVideo = document.getElementById('heroCoverVideo');
  const heroGradient = document.getElementById('heroGradient');
  const coverUrl = modelInfo.coverImageUrl || '';

  if (coverUrl) {
    const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(coverUrl);
    if (isVideo) {
      heroCoverVideo.src = coverUrl;
      heroCoverVideo.classList.remove('hidden');
      heroGradient.classList.add('hidden');
    } else {
      heroCoverImage.src = coverUrl;
      heroCoverImage.classList.remove('hidden');
      heroGradient.classList.add('hidden');
    }
  }

  // Cover image or icon based on capabilities
  const iconEl = document.getElementById('modelIcon');
  const caps = modelInfo.capabilities || [];

  // Small icon in hero overlay
  if (modelInfo.coverImageUrl) {
    iconEl.innerHTML = `<img src="${modelInfo.coverImageUrl}" alt="${modelInfo.name || modelInfo.id}" class="w-full h-full object-cover" data-error-replace-fn="getDefaultIcon">`;
    iconEl.className = 'w-10 h-10 rounded-xl overflow-hidden flex-shrink-0';
  } else if (caps.some(c => c.includes('video'))) {
    iconEl.innerHTML = `<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
    </svg>`;
  } else if (caps.some(c => c.includes('audio') || c.includes('speech') || c.includes('music'))) {
    iconEl.innerHTML = `<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
    </svg>`;
  } else if (caps.some(c => c.includes('image'))) {
    iconEl.innerHTML = `<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
    </svg>`;
  }

  // Update Details tab hero section
  const heroName = document.getElementById('heroModelName');
  const heroNameMobile = document.getElementById('heroModelNameMobile');
  const heroDesc = document.getElementById('heroModelDescription');
  const heroDescMobile = document.getElementById('heroModelDescMobile');
  if (heroName) heroName.textContent = modelInfo.name || modelInfo.id;
  if (heroNameMobile) heroNameMobile.textContent = modelInfo.name || modelInfo.id;
  if (heroDesc) heroDesc.textContent = modelInfo.description || 'No description available.';
  if (heroDescMobile) heroDescMobile.textContent = modelInfo.description || 'No description available.';

  // Detail hero cover image/video
  const heroDetailImg = document.getElementById('heroDetailImage');
  const heroDetailVid = document.getElementById('heroDetailVideo');
  const heroDetailGrad = document.getElementById('heroDetailGradient');
  const heroMobileContainer = document.getElementById('hero-media-main-mobile');
  if (coverUrl && heroDetailImg && heroDetailGrad) {
    const isVid = /\.(mp4|webm|mov)(\?|$)/i.test(coverUrl);
    if (isVid) {
      heroDetailVid.src = coverUrl;
      heroDetailVid.classList.remove('hidden');
      heroDetailGrad.classList.add('hidden');
    } else {
      heroDetailImg.src = coverUrl;
      heroDetailImg.classList.remove('hidden');
      heroDetailGrad.classList.add('hidden');
    }
    // Mobile hero
    if (heroMobileContainer) {
      if (isVid) {
        heroMobileContainer.innerHTML = `<video src="${coverUrl}" class="w-full h-full object-cover" autoplay muted loop playsinline></video>`;
      } else {
        heroMobileContainer.innerHTML = `<img src="${coverUrl}" alt="" class="w-full h-full object-cover">`;
      }
    }
  }
}

// Default icon fallback
function getDefaultIcon() {
  return `<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
  </svg>`;
}

// ============================================================================
// ENHANCED COMPONENT INFERENCE
// Per UNIVERSAL-PLAYGROUND-GUIDE.md - comprehensive field detection
// ============================================================================
function inferComponent(key, field) {
  const ui = field.ui || {};
  const keyLower = key.toLowerCase();
  const titleLower = (field.title || '').toLowerCase();
  const descLower = (field.description || '').toLowerCase();
  const combined = keyLower + ' ' + titleLower + ' ' + descLower;

  // Comprehensive keyword matching for media types
  const imageKeywords = ['image', 'photo', 'face', 'mask', 'subject', 'picture', 'garment',
                        'human', 'person', 'portrait', 'reference', 'control', 'style',
                        'source', 'target', 'background', 'foreground', 'input_image',
                        'init_image', 'start_image', 'end_image', 'first_frame', 'last_frame',
                        'canny', 'depth', 'pose', 'sketch', 'scribble', 'openpose', 'lineart',
                        'thumbnail', 'avatar', 'logo', 'icon', 'cover', 'banner',
                        'redux', 'structure', 'fill']; // FLUX Redux, Kontext, Fill models
  const videoKeywords = ['video', 'clip', 'footage', 'movie', 'input_video', 'source_video',
                        'reference_video', 'driving_video', 'motion'];
  const audioKeywords = ['audio', 'voice', 'sound', 'music', 'speech', 'song', 'input_audio',
                        'reference_audio', 'wav', 'mp3', 'sample', 'recording'];

  // 1. ARRAY TYPE - check FIRST before ui.component (handles input_images, image_input, etc.)
  if (field.type === 'array') {
    // Check if array items are media URIs
    const itemFormat = field.items?.format || field._raw?.items?.format;
    const hasMediaFormat = field.format === 'image' || field.format === 'video' || field.format === 'audio' ||
                          itemFormat === 'uri' || itemFormat === 'image' || itemFormat === 'video' || itemFormat === 'audio';

    if (hasMediaFormat || imageKeywords.some(kw => combined.includes(kw))) {
      // PRIORITY: Check explicit format first
      if (field.format === 'audio' || itemFormat === 'audio') return 'multi-audio-upload';
      if (field.format === 'video' || itemFormat === 'video') return 'multi-video-upload';
      if (field.format === 'image' || itemFormat === 'image') return 'multi-image-upload';

      // Then check KEY NAME (higher priority than description)
      if (audioKeywords.some(kw => keyLower.includes(kw))) return 'multi-audio-upload';
      if (videoKeywords.some(kw => keyLower.includes(kw))) return 'multi-video-upload';
      if (imageKeywords.some(kw => keyLower.includes(kw))) return 'multi-image-upload';

      // Finally check combined (title + description)
      if (audioKeywords.some(kw => combined.includes(kw))) return 'multi-audio-upload';
      if (videoKeywords.some(kw => combined.includes(kw))) return 'multi-video-upload';
      return 'multi-image-upload';
    }
    // Non-media arrays → JSON input
    return 'json-input';
  }

  // 2. Hidden fields - skip rendering in form but include in data
  if (ui.hidden === true) return 'hidden';

  // 3. Explicit ui.component (but NOT for file-upload on non-array - we override below)
  if (ui.component && ui.component !== 'file-upload') return ui.component;

  // 4. Format-based detection for file uploads (SINGLE file)
  // Supports: uri, data-url, base64, image, video, audio
  if (field.format === 'uri' || field.format === 'data-url' || field.format === 'base64' ||
      field.format === 'image' || field.format === 'video' || field.format === 'audio') {
    // PRIORITY 1: Check explicit format first (most reliable)
    if (field.format === 'audio') return 'audio-upload';
    if (field.format === 'video') return 'video-upload';
    if (field.format === 'image') return 'image-upload';

    // PRIORITY 2: Check KEY NAME (higher priority than description)
    // This fixes bugs where description mentions other media types (e.g., "video quality" in audio field)
    if (audioKeywords.some(kw => keyLower.includes(kw))) return 'audio-upload';
    if (videoKeywords.some(kw => keyLower.includes(kw))) return 'video-upload';
    if (imageKeywords.some(kw => keyLower.includes(kw))) return 'image-upload';

    // PRIORITY 3: Check TITLE (field.title)
    if (audioKeywords.some(kw => titleLower.includes(kw))) return 'audio-upload';
    if (videoKeywords.some(kw => titleLower.includes(kw))) return 'video-upload';
    if (imageKeywords.some(kw => titleLower.includes(kw))) return 'image-upload';

    // PRIORITY 4: Check DESCRIPTION (lowest priority - can have false positives)
    if (audioKeywords.some(kw => descLower.includes(kw))) return 'audio-upload';
    if (videoKeywords.some(kw => descLower.includes(kw))) return 'video-upload';
    if (imageKeywords.some(kw => descLower.includes(kw))) return 'image-upload';

    return 'file-upload'; // generic
  }

  // 5. Color picker detection
  if (field.format === 'color' || (field.type === 'string' && keyLower.match(/colou?r/))) {
    return 'color-picker';
  }

  // 6. Type-based detection
  if (field.type === 'boolean') return 'toggle';

  if (field.enum && field.enum.length > 0) {
    // Use radio buttons for small enums (2-4 options), select for more
    if (field.enum.length <= 4) return 'radio-group';
    return 'select';
  }

  // Slider requires BOTH minimum AND maximum defined
  if ((field.type === 'number' || field.type === 'integer') &&
      field.minimum !== undefined && field.maximum !== undefined) {
    return 'slider';
  }

  // 7. Title/description based detection for textarea
  const textareaKeywords = ['prompt', 'negative_prompt', 'negative prompt', 'description',
                           'text prompt', 'caption', 'instruction', 'query', 'message',
                           'system_prompt', 'user_prompt', 'context', 'input_text', 'content'];
  if (textareaKeywords.some(kw => titleLower.includes(kw) || keyLower.includes(kw)) ||
      descLower.includes('text prompt') ||
      (titleLower.includes('text') && field.type === 'string')) {
    return 'textarea';
  }

  // 8. Object types
  if (field.type === 'object') return 'json-input';

  return 'input'; // default text/number input
}

// DEBUG: Inspect form elements (call from console: debugForm())
window.debugForm = function() {
  console.log('=== FORM DEBUG ===');
  console.log('modelSchema:', modelSchema);
  console.log('modelSchema.properties:', modelSchema?.properties);
  console.log('modelSchema.required:', modelSchema?.required);

  if (modelSchema?.properties) {
    for (const [key, field] of Object.entries(modelSchema.properties)) {
      const component = inferComponent(key, field);
      const element = document.getElementById(`input_${key}`);
      const dropzone = document.getElementById(`dropzone_${key}`);
      const fileInput = document.getElementById(`file_${key}`);
      const urlInput = document.getElementById(`url_${key}`);

      console.log(`Field "${key}":`, {
        component,
        format: field.format,
        uiComponent: field.ui?.component,
        elementFound: !!element,
        dropzoneFound: !!dropzone,
        fileInputFound: !!fileInput,
        urlInputFound: !!urlInput,
        uploadedFile: uploadedFiles[key] ? (typeof uploadedFiles[key] === 'string' && uploadedFiles[key].startsWith('data:') ? `DATA_URL(${uploadedFiles[key].length} chars)` : uploadedFiles[key]) : null,
      });
    }
  }

  console.log('uploadedFiles keys:', Object.keys(uploadedFiles));
  for (const [k, v] of Object.entries(uploadedFiles)) {
    console.log(`  uploadedFiles["${k}"]:`, typeof v === 'string' && v.startsWith('data:') ? `DATA_URL (${v.length} chars)` : v);
  }

  const formData = collectFormData();
  console.log('collectFormData() result keys:', Object.keys(formData));
  for (const [k, v] of Object.entries(formData)) {
    console.log(`  formData["${k}"]:`, typeof v === 'string' && v.startsWith('data:') ? `DATA_URL (${v.length} chars)` : v);
  }
  console.log('=== END DEBUG ===');
};

// Build form from schema - ALL FIELDS EXPANDED
function buildForm() {
  const form = document.getElementById('playgroundForm');
  form.innerHTML = '';

  if (!modelSchema || !modelSchema.properties) {
    form.innerHTML = '<p class="text-muted-foreground">No schema available for this model.</p>';
    return;
  }

  const properties = modelSchema.properties;
  const required = modelSchema.required || [];
  const fieldOrder = modelSchema.fieldOrder || Object.keys(properties);

  // Separate required and optional fields
  const requiredFields = fieldOrder.filter(key => required.includes(key));
  const optionalFields = fieldOrder.filter(key => !required.includes(key));

  // Build required fields first
  if (requiredFields.length > 0) {
    const requiredSection = document.createElement('div');
    requiredSection.style.display = 'flex';
    requiredSection.style.flexDirection = 'column';
    requiredSection.style.gap = '1rem';
    requiredFields.forEach(key => {
      const field = properties[key];
      requiredSection.appendChild(buildFieldElement(key, field, true));
    });
    form.appendChild(requiredSection);
  }

  // Build optional fields inside a collapsible "More options" disclosure
  if (optionalFields.length > 0) {
    const fieldsContainer = document.createElement('div');
    fieldsContainer.className = 'space-y-5';
    optionalFields.forEach(key => {
      const field = properties[key];
      fieldsContainer.appendChild(buildFieldElement(key, field, false));
    });

    const details = document.createElement('details');

    const summary = document.createElement('summary');
    summary.className = 'flex items-center justify-between cursor-pointer select-none agent-form-value focus:outline-none list-none';
    summary.style.listStyle = 'none';

    const left = document.createElement('span');
    left.className = 'agent-form-value';
    left.textContent = 'More options';

    const chevron = document.createElement('span');
    chevron.className = 'inline-flex items-center justify-center text-muted-foreground';
    chevron.style.transition = 'transform 150ms ease';
    chevron.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>';

    summary.appendChild(left);
    summary.appendChild(chevron);
    details.appendChild(summary);

    const bodyWrap = document.createElement('div');
    bodyWrap.className = 'space-y-3';
    bodyWrap.appendChild(fieldsContainer);
    details.appendChild(bodyWrap);

    function syncChevron() {
      chevron.style.transform = details.open ? 'rotate(180deg)' : 'rotate(0deg)';
    }
    details.addEventListener('toggle', syncChevron);
    syncChevron();

    form.appendChild(details);
  }
}

// Convert snake_case/camelCase keys to human-friendly Title Case
function humanizeLabel(raw) {
  let str = raw.replace(/_/g, ' ');
  // Only split camelCase if the original had no spaces (raw key, not a formatted title)
  if (!raw.includes(' ')) {
    str = str.replace(/([a-z])([A-Z])/g, '$1 $2');
  }
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

// Filter out useless auto-generated descriptions
function isUsefulDescription(desc) {
  if (!desc) return false;
  const lower = desc.toLowerCase().trim();
  return lower !== 'an enumeration.' && lower !== 'an enumeration' && lower.length > 2;
}

// Build a help toggle (? button + tooltip panel) matching agent detail style
function buildHelpToggle(labelText, helpText) {
  const text = String(helpText ?? '').trim();
  if (!text) return null;

  const wrap = document.createElement('span');
  wrap.className = 'relative inline-flex ml-2';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className =
    'inline-flex items-center justify-center w-4 h-4 rounded-full border border-[#D9D9D9]/40 dark:border-[#D9D9D9]/20 ' +
    'text-[#898A8B] hover:text-[#0D0D0D] dark:hover:text-white hover:border-[#D9D9D9]/60 dark:hover:border-[#D9D9D9]/40 ' +
    'focus:outline-none text-[11px] font-semibold leading-none transition-colors';
  btn.textContent = '?';

  const panel = document.createElement('div');
  panel.hidden = true;
  panel.setAttribute('data-model-hint-panel', '');
  panel.className =
    'fixed z-[9999] w-[260px] max-w-[80vw] rounded-xl ' +
    'border border-[#D9D9D9]/30 dark:border-[#D9D9D9]/20 bg-white dark:bg-[#111213] ' +
    'px-3 py-2 text-xs leading-relaxed text-[#232323] dark:text-[#e8e8e8] shadow-xl';
  panel.textContent = text;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const wasOpen = !panel.hidden;
    document.querySelectorAll('[data-model-hint-panel]').forEach(p => { p.hidden = true; });
    if (!wasOpen) {
      const rect = btn.getBoundingClientRect();
      panel.hidden = false;
      panel.style.left = rect.left + 'px';
      panel.style.top = (rect.top - panel.offsetHeight - 8) + 'px';
      if (panel.getBoundingClientRect().top < 4) {
        panel.style.top = (rect.bottom + 8) + 'px';
      }
    }
  });

  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target) && !panel.contains(e.target)) {
      panel.hidden = true;
    }
  });
  window.addEventListener('scroll', () => { panel.hidden = true; }, { passive: true });

  wrap.appendChild(btn);
  document.body.appendChild(panel);
  return wrap;
}

// Show an inline error below a field input
function showFieldError(key, message) {
  const input = document.getElementById(`input_${key}`) ||
                document.getElementById(`multi_container_${key}`) ||
                document.getElementById(`dropzone_${key}`);
  if (!input) return;
  const wrapper = input.closest('.space-y-2') || input.parentElement;
  if (!wrapper) return;

  let errorEl = wrapper.querySelector(`[data-field-error="${key}"]`);
  if (!errorEl) {
    errorEl = document.createElement('p');
    errorEl.setAttribute('data-field-error', key);
    errorEl.className = 'text-[11px] leading-normal text-red-500 dark:text-red-400';
    errorEl.setAttribute('role', 'alert');
    wrapper.appendChild(errorEl);
  }
  errorEl.textContent = message;

  const inputEl = document.getElementById(`input_${key}`);
  if (inputEl) inputEl.style.outline = '1.5px solid #f87171';

  wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });

  const clearOnInput = () => { clearFieldError(key); inputEl?.removeEventListener('input', clearOnInput); inputEl?.removeEventListener('change', clearOnInput); };
  if (inputEl) {
    inputEl.addEventListener('input', clearOnInput);
    inputEl.addEventListener('change', clearOnInput);
  }
}

function clearFieldError(key) {
  const input = document.getElementById(`input_${key}`) ||
                document.getElementById(`multi_container_${key}`);
  if (!input) return;
  const wrapper = input.closest('.space-y-2') || input.parentElement;
  wrapper?.querySelector(`[data-field-error="${key}"]`)?.remove();
  const inputEl = document.getElementById(`input_${key}`);
  if (inputEl) inputEl.style.outline = '';
}

// Build a single field element
function buildFieldElement(key, field, isRequired) {
  const wrapper = document.createElement('div');
  wrapper.className = '!space-y-2';

  // Determine UI component
  const component = inferComponent(key, field);
  const ui = field.ui || {};

  // Label with required/optional indicator and optional hint tooltip
  const label = document.createElement('label');
  label.className = 'block text-sm font-medium flex items-center gap-2';

  // Check if this is the main prompt textarea field (not "Enable Prompt Expansion" etc)
  const keyLower = key.toLowerCase();
  const isPromptField = (keyLower === 'prompt' || keyLower === 'negative_prompt' || keyLower.endsWith('_prompt')) &&
                        component === 'textarea';
  const showHint = isPromptField && currentModelHint;

  const displayLabel = humanizeLabel(field.title || key);
  label.className += ' text-foreground';
  if (isRequired) {
    label.innerHTML = `${displayLabel} <span class="text-muted-foreground">*</span>`;
  } else {
    label.textContent = displayLabel;
  }

  if (showHint) {
    const hintWrap = document.createElement('span');
    hintWrap.className = 'relative inline-flex ml-2';
    const hintBtn = document.createElement('button');
    hintBtn.type = 'button';
    hintBtn.className =
      'inline-flex items-center justify-center w-4 h-4 rounded-full border border-[#D9D9D9]/40 dark:border-[#D9D9D9]/20 ' +
      'text-[#898A8B] hover:text-[#0D0D0D] dark:hover:text-white hover:border-[#D9D9D9]/60 dark:hover:border-[#D9D9D9]/40 ' +
      'focus:outline-none text-[11px] font-semibold leading-none transition-colors';
    hintBtn.textContent = '?';
    const hintPanel = document.createElement('div');
    hintPanel.hidden = true;
    hintPanel.className =
      'fixed z-[9999] w-[260px] max-w-[80vw] rounded-xl ' +
      'border border-[#D9D9D9]/30 dark:border-[#D9D9D9]/20 bg-white dark:bg-[#111213] ' +
      'px-3 py-2 text-xs leading-relaxed text-[#232323] dark:text-[#e8e8e8] shadow-xl';
    hintPanel.textContent = currentModelHint;
    hintBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasOpen = !hintPanel.hidden;
      document.querySelectorAll('[data-model-hint-panel]').forEach(p => { p.hidden = true; });
      if (!wasOpen) {
        const rect = hintBtn.getBoundingClientRect();
        hintPanel.hidden = false;
        hintPanel.style.left = rect.left + 'px';
        hintPanel.style.top = (rect.top - hintPanel.offsetHeight - 8) + 'px';
        if (hintPanel.getBoundingClientRect().top < 4) {
          hintPanel.style.top = (rect.bottom + 8) + 'px';
        }
      }
    });
    hintPanel.setAttribute('data-model-hint-panel', '');
    hintWrap.appendChild(hintBtn);
    document.body.appendChild(hintPanel);
    label.appendChild(hintWrap);

    document.addEventListener('click', (e) => {
      if (!hintWrap.contains(e.target) && !hintPanel.contains(e.target)) {
        hintPanel.hidden = true;
      }
    }, { once: false });
    window.addEventListener('scroll', () => { hintPanel.hidden = true; }, { passive: true });
  }
  wrapper.appendChild(label);

  let input;

  switch (component) {
    case 'textarea':
      input = document.createElement('textarea');
      input.className =
        'block w-full text-[13px] bg-[#EAEFF6] dark:bg-[#1C1E20] border border-[#D9D9D9]/[4%] dark:border-[#D9D9D9]/[4%] rounded-2xl px-4 py-3 ' +
        'text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 ' +
        'focus:outline-none focus:border-[#D9D9D9]/40 dark:focus:border-[#D9D9D9]/20 transition-colors resize-none';
      input.rows = 4;
      input.placeholder = ui.placeholder || field.description || 'Text prompt describing what you want to generate';
      if (field.default !== undefined) input.value = field.default;
      break;

    case 'select': {
      const selectContainer = document.createElement('div');
      selectContainer.className = 'relative';

      const hiddenInput = document.createElement('input');
      hiddenInput.type = 'hidden';
      hiddenInput.name = key;
      hiddenInput.id = `input_${key}`;
      const options = field.enum || [];
      const labels = field.enumLabels || [];
      const defaultVal = field.default !== undefined ? field.default : options[0];
      hiddenInput.value = defaultVal !== undefined ? defaultVal : '';
      const defaultLabel = labels[options.indexOf(defaultVal)] || defaultVal || 'Select...';

      const triggerBtn = document.createElement('button');
      triggerBtn.type = 'button';
      triggerBtn.className =
        'w-full flex items-center justify-between rounded-xl bg-[#EAEFF6] dark:bg-[#1C1E20] ' +
        'border border-[#D9D9D9]/[4%] dark:border-[#D9D9D9]/[4%] ' +
        'px-2.5 py-3 cursor-pointer hover:bg-[#dde4ed] dark:hover:bg-[#252729] transition-colors ' +
        'focus:outline-none focus:border-[#D9D9D9]/40 dark:focus:border-[#D9D9D9]/20';

      const btnContent = document.createElement('div');
      btnContent.className = 'text-left min-w-0 flex-1';
      const btnValue = document.createElement('div');
      btnValue.className = 'text-[13px] font-semibold text-gray-900 dark:text-white truncate';
      btnValue.textContent = defaultLabel;
      btnContent.appendChild(btnValue);

      const chevronEl = document.createElement('div');
      chevronEl.className = 'text-gray-500 dark:text-gray-400 shrink-0 ml-2';
      chevronEl.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>';

      triggerBtn.appendChild(btnContent);
      triggerBtn.appendChild(chevronEl);

      // Dropdown menu — fixed position like agent detail
      const dropdown = document.createElement('div');
      dropdown.className =
        'hidden fixed z-[9999] rounded-2xl bg-[#EAEFF6] dark:bg-[#1C1E20] ' +
        'border border-[#D9D9D9]/20 dark:border-[#333] shadow-2xl overflow-y-auto max-h-[280px]';

      function positionDropdown() {
        const btnRect = triggerBtn.getBoundingClientRect();
        const spaceBelow = window.innerHeight - btnRect.bottom;
        const menuHeight = Math.min(280, options.length * 48);
        const dropdownWidth = Math.max(200, btnRect.width);
        dropdown.style.width = dropdownWidth + 'px';
        let leftPos = Math.max(8, Math.min(btnRect.left, window.innerWidth - dropdownWidth - 8));
        dropdown.style.left = leftPos + 'px';
        if (spaceBelow < menuHeight && btnRect.top > spaceBelow) {
          dropdown.style.bottom = (window.innerHeight - btnRect.top + 4) + 'px';
          dropdown.style.top = 'auto';
        } else {
          dropdown.style.top = (btnRect.bottom + 4) + 'px';
          dropdown.style.bottom = 'auto';
        }
      }

      options.forEach((opt, idx) => {
        const item = document.createElement('button');
        item.type = 'button';
        const lbl = labels[idx] || opt;
        item.className =
          'w-full flex items-center justify-between px-4 py-3 text-left text-[13px] ' +
          'text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#252525] transition-colors';
        item.dataset.value = String(opt);

        const itemLabel = document.createElement('span');
        itemLabel.textContent = lbl;
        const itemCheck = document.createElement('span');
        itemCheck.className = String(opt) === String(defaultVal) ? 'text-primary/90' : 'invisible';
        itemCheck.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>';

        item.appendChild(itemLabel);
        item.appendChild(itemCheck);
        dropdown.appendChild(item);

        item.addEventListener('click', () => {
          hiddenInput.value = opt;
          btnValue.textContent = lbl;
          dropdown.querySelectorAll('button').forEach(b => {
            const check = b.querySelector('span:last-child');
            if (check) check.className = b.dataset.value === String(opt) ? 'text-primary/90' : 'invisible';
          });
          dropdown.classList.add('hidden');
        });
      });

      // "Custom" option for fields with object alternative (e.g., image_size with { width, height })
      let customDimsContainer = null;
      if (field.objectAlternative) {
        const divider = document.createElement('div');
        divider.className = 'border-t border-gray-200 dark:border-gray-700 my-1';
        dropdown.appendChild(divider);

        const customItem = document.createElement('button');
        customItem.type = 'button';
        customItem.className =
          'w-full flex items-center justify-between px-4 py-3 text-left text-[13px] ' +
          'text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#252525] transition-colors';
        customItem.dataset.value = '__custom__';

        const customLabel = document.createElement('span');
        customLabel.textContent = 'Custom';
        const customCheck = document.createElement('span');
        customCheck.className = 'invisible';
        customCheck.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>';
        customItem.appendChild(customLabel);
        customItem.appendChild(customCheck);
        dropdown.appendChild(customItem);

        customDimsContainer = document.createElement('div');
        customDimsContainer.className = 'hidden mt-2 flex gap-3';
        customDimsContainer.id = `custom_dims_${key}`;

        const altProps = field.objectAlternative.properties;
        for (const [propKey, propDef] of Object.entries(altProps)) {
          const inputWrapper = document.createElement('div');
          inputWrapper.className = 'flex-1';
          const dimLabel = document.createElement('label');
          dimLabel.className = 'block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1';
          dimLabel.textContent = propDef.title || (propKey.charAt(0).toUpperCase() + propKey.slice(1));
          const numInput = document.createElement('input');
          numInput.type = 'number';
          numInput.id = `input_${key}_${propKey}`;
          numInput.className =
            'block w-full text-[13px] bg-[#EAEFF6] dark:bg-[#1C1E20] border border-[#D9D9D9]/[4%] ' +
            'rounded-xl px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-[#D9D9D9]/40 transition-colors';
          if (propDef.minimum !== undefined && propDef.minimum !== null) numInput.min = propDef.minimum;
          if (propDef.maximum !== undefined && propDef.maximum !== null) numInput.max = propDef.maximum;
          numInput.value = propDef.default || 1024;
          numInput.step = 1;
          inputWrapper.appendChild(dimLabel);
          inputWrapper.appendChild(numInput);
          customDimsContainer.appendChild(inputWrapper);
        }

        customItem.addEventListener('click', () => {
          hiddenInput.value = '__custom__';
          btnValue.textContent = 'Custom';
          dropdown.querySelectorAll('button').forEach(b => {
            const check = b.querySelector('span:last-child');
            if (check) check.className = b.dataset.value === '__custom__' ? 'text-[#9335EC]' : 'invisible';
          });
          customDimsContainer.classList.remove('hidden');
          dropdown.classList.add('hidden');
        });

        // Hide custom dims when a preset is selected
        options.forEach((opt, idx) => {
          const presetItem = dropdown.querySelector(`button[data-value="${opt}"]`);
          if (presetItem) {
            presetItem.addEventListener('click', () => {
              customDimsContainer.classList.add('hidden');
            });
          }
        });
      }

      triggerBtn.addEventListener('click', () => {
        const wasHidden = dropdown.classList.contains('hidden');
        if (wasHidden) positionDropdown();
        dropdown.classList.toggle('hidden');
      });

      document.addEventListener('click', (e) => {
        if (!selectContainer.contains(e.target) && !dropdown.contains(e.target)) {
          dropdown.classList.add('hidden');
        }
      });

      window.addEventListener('scroll', () => {
        if (!dropdown.classList.contains('hidden')) positionDropdown();
      }, true);

      selectContainer.appendChild(hiddenInput);
      selectContainer.appendChild(triggerBtn);
      document.body.appendChild(dropdown);
      wrapper.appendChild(selectContainer);
      if (customDimsContainer) wrapper.appendChild(customDimsContainer);
      input = null;
      break;
    }

    case 'radio-group':
      const radioWrapper = document.createElement('div');
      radioWrapper.className = 'flex flex-wrap gap-2';
      (field.enum || []).forEach((opt, idx) => {
        const radioLabel = document.createElement('label');
        radioLabel.className = 'radio-option cursor-pointer';
        const isChecked = opt === field.default || (idx === 0 && !field.default);
        radioLabel.innerHTML = `
          <input type="radio" name="${key}" value="${opt}" ${isChecked ? 'checked' : ''} class="hidden peer">
          <span class="block px-4 py-2 rounded-xl bg-[#EAEFF6] dark:bg-[#1C1E20] border border-[#D9D9D9]/[4%] dark:border-[#D9D9D9]/[4%] text-[13px] text-gray-900 dark:text-white transition-colors hover:bg-[#dde4ed] dark:hover:bg-[#252729]">
            ${field.enumLabels?.[idx] || opt}
          </span>
        `;
        radioWrapper.appendChild(radioLabel);
      });
      wrapper.appendChild(radioWrapper);
      input = null;
      break;

    case 'slider': {
      // Render as number input (same as agent detail) instead of range slider
      const isInteger = field._raw?.type === 'integer' || field.type === 'integer';
      input = document.createElement('input');
      input.type = 'number';
      input.step = isInteger ? '1' : 'any';
      input.className =
        'block w-full text-[13px] bg-[#EAEFF6] dark:bg-[#1C1E20] border border-[#D9D9D9]/[4%] dark:border-[#D9D9D9]/[4%] rounded-2xl px-4 py-3 ' +
        'text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 ' +
        'focus:outline-none focus:border-[#D9D9D9]/40 dark:focus:border-[#D9D9D9]/20 transition-colors';
      if (field.minimum != null) input.min = field.minimum;
      if (field.maximum != null) input.max = field.maximum;
      if (field.default != null) input.value = field.default;
      break;
    }

    case 'toggle': {
      // Remove the separate label since toggle has its own inline label
      if (wrapper.contains(label)) wrapper.removeChild(label);

      const row = document.createElement('label');
      row.className =
        'flex items-center justify-between gap-4 select-none cursor-pointer ' +
        'rounded-2xl bg-[#EAEFF6] dark:bg-[#1C1E20] ' +
        'hover:bg-[#dde4ed] dark:hover:bg-[#252729] transition-colors px-4 py-3 ' +
        'focus-within:ring-2 focus-within:ring-primary/90/30';

      const textWrap = document.createElement('div');
      textWrap.className = 'min-w-0 flex-1';
      const titleRow = document.createElement('div');
      titleRow.className = 'flex items-center gap-1';
      const titleEl = document.createElement('div');
      titleEl.className = 'agent-form-value text-sm leading-snug';
      titleEl.textContent = displayLabel;
      titleRow.appendChild(titleEl);
      if (isUsefulDescription(field.description)) {
        const helpToggle = buildHelpToggle(displayLabel, field.description);
        if (helpToggle) titleRow.appendChild(helpToggle);
      }
      textWrap.appendChild(titleRow);

      const toggleWrap = document.createElement('div');
      toggleWrap.className = 'shrink-0 relative';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'sr-only';
      checkbox.checked = field.default === true;
      checkbox.name = key;
      checkbox.id = `input_${key}`;
      checkbox.setAttribute('role', 'switch');
      checkbox.setAttribute('aria-checked', checkbox.checked ? 'true' : 'false');

      const track = document.createElement('div');
      track.className = 'w-9 h-5 rounded-full transition-colors cursor-pointer bg-neutral-300 dark:bg-neutral-700';

      const knob = document.createElement('div');
      knob.className = 'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-md transition-transform';

      function syncVisual() {
        checkbox.setAttribute('aria-checked', checkbox.checked ? 'true' : 'false');
        track.classList.toggle('bg-primary/90', checkbox.checked);
        track.classList.toggle('bg-neutral-300', !checkbox.checked);
        track.classList.toggle('dark:bg-neutral-700', !checkbox.checked);
        knob.style.transform = checkbox.checked ? 'translateX(16px)' : 'translateX(0px)';
      }
      checkbox.addEventListener('change', syncVisual);
      syncVisual();

      function handleToggleClick(e) {
        e.preventDefault();
        e.stopPropagation();
        checkbox.checked = !checkbox.checked;
        syncVisual();
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
      }
      track.addEventListener('click', handleToggleClick);
      knob.addEventListener('click', handleToggleClick);

      toggleWrap.appendChild(checkbox);
      toggleWrap.appendChild(track);
      toggleWrap.appendChild(knob);

      row.appendChild(textWrap);
      row.appendChild(toggleWrap);
      wrapper.appendChild(row);
      input = null;
      break;
    }

    case 'image-upload':
      wrapper.appendChild(buildFileUploadElement(key, field, 'image/*', '🖼️', 'Drop image here or click to upload', 'Supports JPG, PNG, WebP, GIF'));
      input = null;
      break;

    case 'video-upload':
      wrapper.appendChild(buildFileUploadElement(key, field, 'video/*', '🎥', 'Drop video here or click to upload', 'Supports MP4, WebM, MOV'));
      input = null;
      break;

    case 'audio-upload':
      wrapper.appendChild(buildFileUploadElement(key, field, 'audio/*', '🎵', 'Drop audio file here or click to upload', 'Supports MP3, WAV, M4A, AAC'));
      input = null;
      break;

    case 'file-upload':
      wrapper.appendChild(buildFileUploadElement(key, field, '*/*', '📁', 'Drop file here or click to upload', ''));
      input = null;
      break;

    case 'multi-image-upload':
      wrapper.appendChild(buildMultiFileUploadElement(key, field, 'image/*', '🖼️', 'Drop images here or click to upload', 'Supports JPG, PNG, WebP, GIF', 10));
      input = null;
      break;

    case 'multi-video-upload':
      wrapper.appendChild(buildMultiFileUploadElement(key, field, 'video/*', '🎥', 'Drop videos here or click to upload', 'Supports MP4, WebM, MOV', 5));
      input = null;
      break;

    case 'multi-audio-upload':
      wrapper.appendChild(buildMultiFileUploadElement(key, field, '.mp3,.wav,.m4a,.aac', '🎵', 'Drop audio files here or click to upload', 'Supports MP3, WAV, M4A, AAC', 5));
      input = null;
      break;

    case 'json-input':
      input = document.createElement('textarea');
      input.className =
        'block w-full text-[13px] font-mono bg-[#EAEFF6] dark:bg-[#1C1E20] border border-[#D9D9D9]/[4%] dark:border-[#D9D9D9]/[4%] rounded-2xl px-4 py-3 ' +
        'text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 ' +
        'focus:outline-none focus:border-[#D9D9D9]/40 dark:focus:border-[#D9D9D9]/20 transition-colors resize-none';
      input.rows = 6;
      input.placeholder = ui.placeholder || '{"key": "value"}';
      if (field.default !== undefined) input.value = JSON.stringify(field.default, null, 2);
      break;

    case 'color-picker':
      const colorWrapper = document.createElement('div');
      colorWrapper.className = 'flex items-center gap-3';

      input = document.createElement('input');
      input.type = 'color';
      input.className = 'w-12 h-10 rounded-lg cursor-pointer border-0 bg-transparent';
      input.value = field.default || '#ffffff';

      const colorHex = document.createElement('input');
      colorHex.type = 'text';
      colorHex.className = 'flex-1 text-[13px] font-mono bg-[#EAEFF6] dark:bg-[#1C1E20] border border-[#D9D9D9]/[4%] dark:border-[#D9D9D9]/[4%] rounded-2xl px-4 py-2 text-gray-900 dark:text-white focus:outline-none focus:border-[#D9D9D9]/40 dark:focus:border-[#D9D9D9]/20 transition-colors';
      colorHex.value = input.value;
      colorHex.id = `color_hex_${key}`;

      // Capture reference to color input BEFORE setting input to null
      const colorInput = input;
      colorInput.addEventListener('input', () => { colorHex.value = colorInput.value; });
      colorHex.addEventListener('change', () => { colorInput.value = colorHex.value; });

      colorWrapper.appendChild(colorInput);
      colorWrapper.appendChild(colorHex);
      wrapper.appendChild(colorWrapper);
      colorInput.name = key;
      colorInput.id = `input_${key}`;
      input = null;
      break;

    case 'hidden':
      // Hidden fields are not rendered but their default values are collected
      wrapper.style.display = 'none';
      input = document.createElement('input');
      input.type = 'hidden';
      if (field.default !== undefined) input.value = field.default;
      break;

    default: { // input (number, text)
      const isNum = field.type === 'number' || field.type === 'integer';
      input = document.createElement('input');
      input.type = isNum ? 'number' : 'text';
      if (isNum) input.step = field.type === 'integer' ? '1' : 'any';
      input.className =
        'block w-full text-[13px] bg-[#EAEFF6] dark:bg-[#1C1E20] border border-[#D9D9D9]/[4%] dark:border-[#D9D9D9]/[4%] rounded-2xl px-4 py-3 ' +
        'text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 ' +
        'focus:outline-none focus:border-[#D9D9D9]/40 dark:focus:border-[#D9D9D9]/20 transition-colors';
      input.placeholder = ui.placeholder || '';
      if (field.minimum !== undefined) input.min = field.minimum;
      if (field.maximum !== undefined) input.max = field.maximum;
      if (field.default !== undefined) input.value = field.default;
      break;
    }
  }

  if (input) {
    input.name = key;
    input.id = `input_${key}`;
    if (isRequired) input.required = true;
    wrapper.appendChild(input);
  }

  // Description as tooltip on the label (skip for components that show description elsewhere or are hidden)
  const skipDescriptionFor = ['image-upload', 'video-upload', 'audio-upload', 'file-upload', 'textarea', 'hidden', 'color-picker', 'toggle'];
  if (isUsefulDescription(field.description) && !skipDescriptionFor.includes(component)) {
    const helpToggle = buildHelpToggle(displayLabel, field.description);
    if (helpToggle) label.appendChild(helpToggle);
  }

  return wrapper;
}

// Build file upload element with preview
function buildFileUploadElement(key, field, accept, emoji, dropText, formatText) {
  const container = document.createElement('div');
  container.className = 'space-y-2';

  const isImage = accept.includes('image');
  const isVideo = accept.includes('video');
  const isAudio = accept.includes('audio');
  const uploadLabel = isImage ? 'Upload Image' : isVideo ? 'Upload Video' : isAudio ? 'Upload Audio' : 'Upload File';
  const subtitleText = formatText || (isImage ? 'PNG, JPG, WEBP up to 10MB' : isVideo ? 'MP4, MOV, WEBM' : isAudio ? 'MP3, WAV, OGG up to 20MB' : '');
  const typeLabel = isVideo ? 'Video' : isAudio ? 'Audio' : 'Image';

  // Dropzone (empty state)
  const dropZone = document.createElement('button');
  dropZone.type = 'button';
  dropZone.className =
    'dropzone-empty relative w-full h-[115px] rounded-[16px] border border-dashed border-white dark:border-[#3a3a3a] ' +
    'bg-[#EAEFF6] dark:bg-[#1C1E20] ' +
    'hover:border-[#ddd] dark:hover:border-[#555] hover:bg-[#dde4ed] dark:hover:bg-[#252729] transition-colors ' +
    'focus:outline-none focus:border-[#ccc] dark:focus:border-[#555] ' +
    'px-4 py-5 flex flex-col items-center justify-center text-center gap-2 cursor-pointer';
  dropZone.id = `dropzone_${key}`;
  dropZone.innerHTML = `
    <div id="dropzone_empty_${key}" class="flex flex-col items-center gap-2">
      <div class="w-8 h-8 flex items-center justify-center">
        <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.338-2.32 3.75 3.75 0 013.57 4.26A4.5 4.5 0 0118 19.5H6.75z"/></svg>
      </div>
      <div class="space-y-1">
        <div class="agent-form-upload-title">${uploadLabel}</div>
        ${subtitleText ? `<div class="agent-form-hint">${subtitleText}</div>` : ''}
      </div>
    </div>
  `;

  // Preview wrap
  const previewWrap = document.createElement('div');
  previewWrap.id = `dropzone_preview_${key}`;
  previewWrap.className =
    'hidden w-full h-[115px] rounded-[16px] border border-dashed border-white dark:border-[#3a3a3a] ' +
    'bg-[#EAEFF6] dark:bg-[#1C1E20] flex items-center justify-center px-4 py-5';

  const previewContainer = document.createElement('div');
  previewContainer.className = 'relative inline-block';

  if (isImage) {
    const imgEl = document.createElement('img');
    imgEl.id = `preview_img_${key}`;
    imgEl.alt = 'Preview';
    imgEl.className = 'w-[180px] h-[100px] rounded-2xl object-cover bg-neutral-200 dark:bg-neutral-800';
    previewContainer.appendChild(imgEl);
  }
  if (isVideo) {
    const vidEl = document.createElement('video');
    vidEl.id = `preview_video_${key}`;
    vidEl.controls = false; vidEl.muted = true; vidEl.loop = true; vidEl.autoplay = true; vidEl.playsInline = true;
    vidEl.className = 'w-[180px] h-[100px] rounded-2xl object-cover bg-neutral-200 dark:bg-neutral-800';
    previewContainer.appendChild(vidEl);
  }
  if (isAudio) {
    const audEl = document.createElement('audio');
    audEl.id = `preview_audio_${key}`;
    audEl.controls = true;
    audEl.className = 'flex-1 min-w-0';
    previewContainer.appendChild(audEl);
  }

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.id = `clear_btn_${key}`;
  removeBtn.className =
    'absolute top-2 right-2 w-7 h-7 rounded-full bg-neutral-800/70 hover:bg-neutral-800/90 ' +
    'backdrop-blur flex items-center justify-center transition-colors z-10';
  removeBtn.innerHTML = `<svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>`;
  removeBtn.addEventListener('click', (e) => clearFileUpload(e, key));
  previewContainer.appendChild(removeBtn);

  const typePill = document.createElement('div');
  typePill.className =
    'absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full ' +
    'bg-neutral-800/70 text-xs font-medium text-white backdrop-blur';
  typePill.textContent = typeLabel;
  previewContainer.appendChild(typePill);

  previewWrap.appendChild(previewContainer);

  // Hidden file input
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = accept;
  fileInput.className = 'hidden';
  fileInput.id = `file_${key}`;

  // URL input
  const urlInput = document.createElement('input');
  urlInput.type = 'text';
  urlInput.className = 'mt-1.5 w-full h-11 text-[13px] bg-[#EAEFF6] dark:bg-[#1C1E20] border border-[#D9D9D9]/[4%] dark:border-[#D9D9D9]/[4%] rounded-2xl px-5 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-500 focus:outline-none focus:border-[#D9D9D9]/40 dark:focus:border-[#D9D9D9]/20 transition-colors hidden';
  urlInput.placeholder = 'Paste URL';
  urlInput.id = `url_${key}`;

  // Add note for audio uploads about URL preference
  let audioNote = null;
  if (accept.includes('audio')) {
    audioNote = document.createElement('p');
    audioNote.className = 'text-xs text-amber-400/70 mt-1';
    audioNote.innerHTML = '💡 <span class="text-muted-foreground/60">Tip: Some models require a public URL instead of file upload. If upload fails, try pasting an audio URL.</span>';
  }

  // Event handlers
  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragenter', (e) => { e.preventDefault(); dropZone.classList.add('border-primary/90/40', 'bg-primary/90/5'); });
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); });
  dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('border-primary/90/40', 'bg-primary/90/5'); });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-primary/90/40', 'bg-primary/90/5');
    if (e.dataTransfer.files.length) {
      handleFileUpload(key, e.dataTransfer.files[0], accept);
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) {
      handleFileUpload(key, fileInput.files[0], accept);
    }
  });

  urlInput.addEventListener('change', () => {
    handleUrlInput(key, urlInput.value, accept);
  });

  container.appendChild(fileInput);
  container.appendChild(dropZone);
  container.appendChild(previewWrap);
  container.appendChild(urlInput);
  if (audioNote) container.appendChild(audioNote);

  return container;
}

// Build MULTI-file upload element for array inputs (flux-2-dev input_images, seedream image_input, etc.)
function buildMultiFileUploadElement(key, field, accept, emoji, dropText, formatText, maxFiles = 10) {
  const container = document.createElement('div');
  container.className = 'space-y-3';
  container.id = `multi_container_${key}`;

  // Initialize array storage for this field
  if (!uploadedFiles[key]) uploadedFiles[key] = [];

  // Header with count
  const header = document.createElement('div');
  header.className = 'flex items-center justify-between';
  header.innerHTML = `
    <span class="text-sm text-muted-foreground">
      <span id="multi_count_${key}">${uploadedFiles[key].length}</span>/${maxFiles} files
    </span>
    <button type="button" data-action="clearAllMultiFiles" data-param="${key}" class="text-xs text-red-400 hover:text-red-300 transition-colors hidden" id="multi_clear_all_${key}">
      Clear all
    </button>
  `;
  container.appendChild(header);

  // Drop zone for adding files
  const dropZone = document.createElement('div');
  dropZone.className = 'file-drop-zone rounded-[16px] h-[115px] px-4 py-5 text-center cursor-pointer flex flex-col items-center justify-center';
  dropZone.id = `multi_dropzone_${key}`;
  const multiUploadLabel = accept.includes('image') ? 'Upload Images' : accept.includes('video') ? 'Upload Videos' : accept.includes('audio') ? 'Upload Audio' : 'Upload Files';
  dropZone.innerHTML = `
    <div class="flex flex-col items-center gap-2">
      <div class="w-8 h-8 flex items-center justify-center">
        <svg class="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.338-2.32 3.75 3.75 0 013.57 4.26A4.5 4.5 0 0118 19.5H6.75z"/></svg>
      </div>
      <div class="space-y-1">
        <div class="agent-form-upload-title">${multiUploadLabel}</div>
        ${formatText ? `<div class="agent-form-hint">${formatText}</div>` : ''}
        <div class="agent-form-hint" style="color: #9335EC !important">Multiple files supported</div>
      </div>
    </div>
  `;

  // Hidden file input with multiple
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = accept;
  fileInput.multiple = true;
  fileInput.className = 'hidden';
  fileInput.id = `multi_file_${key}`;

  // Preview grid
  const previewGrid = document.createElement('div');
  previewGrid.className = 'grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3 hidden';
  previewGrid.id = `multi_preview_${key}`;

  // URL input for adding URLs
  const urlWrapper = document.createElement('div');
  urlWrapper.className = 'flex gap-2';

  const urlInput = document.createElement('input');
  urlInput.type = 'text';
  urlInput.className = 'flex-1 text-[13px] bg-[#EAEFF6] dark:bg-[#1C1E20] border border-[#D9D9D9]/[4%] dark:border-[#D9D9D9]/[4%] rounded-2xl px-4 py-2 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-[#D9D9D9]/40 dark:focus:border-[#D9D9D9]/20 transition-colors';
  urlInput.placeholder = 'Or paste URL and press Enter...';
  urlInput.id = `multi_url_${key}`;

  const addUrlBtn = document.createElement('button');
  addUrlBtn.type = 'button';
  addUrlBtn.className = 'px-3 py-2 text-[13px] bg-[#EAEFF6] dark:bg-[#1C1E20] border border-[#D9D9D9]/[4%] dark:border-[#D9D9D9]/[4%] hover:bg-[#dde4ed] dark:hover:bg-[#252729] rounded-2xl text-gray-900 dark:text-white transition-colors';
  addUrlBtn.textContent = 'Add';
  addUrlBtn.onclick = () => addMultiUrl(key, urlInput.value, maxFiles, accept);

  urlWrapper.appendChild(urlInput);
  urlWrapper.appendChild(addUrlBtn);

  // Event handlers
  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
      handleMultiFileUpload(key, e.dataTransfer.files, maxFiles, accept);
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) {
      handleMultiFileUpload(key, fileInput.files, maxFiles, accept);
    }
  });

  urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addMultiUrl(key, urlInput.value, maxFiles, accept);
    }
  });

  container.appendChild(fileInput);
  container.appendChild(dropZone);
  container.appendChild(previewGrid);
  container.appendChild(urlWrapper);

  return container;
}

// Handle multi-file upload
async function handleMultiFileUpload(key, files, maxFiles, accept) {
  if (!uploadedFiles[key]) uploadedFiles[key] = [];

  const remaining = maxFiles - uploadedFiles[key].length;
  const filesToAdd = Array.from(files).slice(0, remaining);

  for (const file of filesToAdd) {
    const reader = new FileReader();
    reader.onload = () => {
      uploadedFiles[key].push(reader.result);
      updateMultiPreview(key, accept);
    };
    reader.readAsDataURL(file);
  }
}

// Add URL to multi-file array
function addMultiUrl(key, url, maxFiles, accept) {
  if (!url || !url.trim()) return;
  if (!uploadedFiles[key]) uploadedFiles[key] = [];

  if (uploadedFiles[key].length >= maxFiles) {
    alert(`Maximum ${maxFiles} files allowed`);
    return;
  }

  uploadedFiles[key].push(url.trim());
  updateMultiPreview(key, accept);

  // Clear URL input
  const urlInput = document.getElementById(`multi_url_${key}`);
  if (urlInput) urlInput.value = '';
}

// Update multi-file preview
function updateMultiPreview(key, accept) {
  const files = uploadedFiles[key] || [];
  const previewGrid = document.getElementById(`multi_preview_${key}`);
  const countEl = document.getElementById(`multi_count_${key}`);
  const clearAllBtn = document.getElementById(`multi_clear_all_${key}`);

  if (countEl) countEl.textContent = files.length;

  if (files.length > 0) {
    if (previewGrid) previewGrid.classList.remove('hidden');
    if (clearAllBtn) clearAllBtn.classList.remove('hidden');
  } else {
    if (previewGrid) previewGrid.classList.add('hidden');
    if (clearAllBtn) clearAllBtn.classList.add('hidden');
  }

  if (previewGrid) {
    previewGrid.innerHTML = files.map((src, idx) => {
      const isImage = accept.includes('image');
      const isVideo = accept.includes('video');
      const isAudio = accept.includes('audio');

      let preview = '';
      if (isImage) {
        preview = `<img src="${src}" class="w-full h-20 object-cover rounded-xl" data-error-replace="<div class='w-full h-20 bg-[#E9EEF7] dark:bg-[#1C1E20] rounded-xl flex items-center justify-center text-muted-foreground text-xs'>Invalid</div>">`;
      } else if (isVideo) {
        preview = `<video src="${src}" class="w-full h-20 object-cover rounded-xl" muted></video>`;
      } else if (isAudio) {
        preview = `<div class="w-full h-20 bg-[#E9EEF7] dark:bg-[#1C1E20] rounded-xl flex items-center justify-center text-2xl">🎵</div>`;
      } else {
        preview = `<div class="w-full h-20 bg-[#E9EEF7] dark:bg-[#1C1E20] rounded-xl flex items-center justify-center text-2xl">📁</div>`;
      }

      return `
        <div class="relative group">
          ${preview}
          <button type="button" data-action="removeMultiFile" data-param="${key}" data-param2="${idx}" data-param3="${accept}" class="absolute top-1 right-1 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
          <div class="absolute bottom-1 left-1 px-1 bg-black/60 rounded text-[10px] text-white">${idx + 1}</div>
        </div>
      `;
    }).join('');
  }
}

// Remove single file from multi-file array
function removeMultiFile(key, index, accept) {
  if (!uploadedFiles[key]) return;
  uploadedFiles[key].splice(index, 1);
  updateMultiPreview(key, accept);
}

// Clear all files from multi-file array
function clearAllMultiFiles(key) {
  uploadedFiles[key] = [];
  const previewGrid = document.getElementById(`multi_preview_${key}`);
  const countEl = document.getElementById(`multi_count_${key}`);
  const clearAllBtn = document.getElementById(`multi_clear_all_${key}`);
  const fileInput = document.getElementById(`multi_file_${key}`);

  if (previewGrid) {
    previewGrid.innerHTML = '';
    previewGrid.classList.add('hidden');
  }
  if (countEl) countEl.textContent = '0';
  if (clearAllBtn) clearAllBtn.classList.add('hidden');
  if (fileInput) fileInput.value = '';
}

// Handle file upload
async function handleFileUpload(key, file, accept) {
  console.log(`[Upload] Starting upload for field "${key}": ${file.name} (${file.size} bytes)`);
  const reader = new FileReader();
  reader.onload = () => {
    uploadedFiles[key] = reader.result;
    const dataUrlLength = reader.result.length;
    console.log(`[Upload] File "${key}" loaded successfully: ${file.name}, data URL length: ${dataUrlLength}`);
    showFilePreview(key, reader.result, file.name, accept);
  };
  reader.onerror = (e) => {
    console.error(`[Upload] Error reading file "${key}":`, e);
  };
  reader.readAsDataURL(file);
}

// Handle URL input
function handleUrlInput(key, url, accept) {
  if (!url) {
    clearFileUploadState(key);
    return;
  }
  uploadedFiles[key] = url;
  showFilePreview(key, url, url.split('/').pop(), accept);
}

// Show file preview
function showFilePreview(key, src, filename, accept) {
  const dropZone = document.getElementById(`dropzone_${key}`);
  const previewEl = document.getElementById(`dropzone_preview_${key}`);

  // Hide dropzone, show preview
  if (dropZone) dropZone.classList.add('hidden');
  if (previewEl) previewEl.classList.remove('hidden');

  // Show appropriate media
  if (accept.includes('image')) {
    const img = document.getElementById(`preview_img_${key}`);
    if (img) { img.src = src; img.onerror = () => { img.style.display = 'none'; }; }
  } else if (accept.includes('video')) {
    const video = document.getElementById(`preview_video_${key}`);
    if (video) { video.src = src; video.play?.().catch(() => {}); }
  } else if (accept.includes('audio')) {
    const audio = document.getElementById(`preview_audio_${key}`);
    if (audio) audio.src = src;
  }

  // Clear URL input if file was uploaded
  const urlInput = document.getElementById(`url_${key}`);
  if (urlInput && src.startsWith('data:')) urlInput.value = '';
}

// Clear file upload
function clearFileUpload(event, key) {
  event.stopPropagation();
  clearFileUploadState(key);
}

function clearFileUploadState(key) {
  delete uploadedFiles[key];

  const dropZone = document.getElementById(`dropzone_${key}`);
  const previewEl = document.getElementById(`dropzone_preview_${key}`);
  const fileInput = document.getElementById(`file_${key}`);
  const urlInput = document.getElementById(`url_${key}`);

  // Show dropzone, hide preview
  if (dropZone) dropZone.classList.remove('hidden');
  if (previewEl) previewEl.classList.add('hidden');
  if (fileInput) fileInput.value = '';
  if (urlInput) urlInput.value = '';
}

// Collect form data
function collectFormData() {
  const data = {};

  if (!modelSchema || !modelSchema.properties) return data;

  const properties = modelSchema.properties;

  for (const [key, field] of Object.entries(properties)) {
    const component = inferComponent(key, field);

    // Multi-file uploads (arrays) - flux-2-dev, seedream, etc.
    if (['multi-image-upload', 'multi-video-upload', 'multi-audio-upload'].includes(component)) {
      if (uploadedFiles[key] && Array.isArray(uploadedFiles[key]) && uploadedFiles[key].length > 0) {
        data[key] = uploadedFiles[key]; // Already an array
      }
      continue;
    }

    // Single file uploads
    if (['image-upload', 'video-upload', 'audio-upload', 'file-upload'].includes(component)) {
      if (uploadedFiles[key]) {
        data[key] = uploadedFiles[key];
      }
      continue;
    }

    // Toggle buttons
    if (component === 'toggle') {
      const cb = document.getElementById(`input_${key}`);
      if (cb) {
        data[key] = cb.checked === true;
      }
      continue;
    }

    // Radio groups - with type coercion for integer/number enums
    if (component === 'radio-group') {
      const checked = document.querySelector(`input[name="${key}"]:checked`);
      if (checked) {
        const val = checked.value;
        // Coerce to number/integer if schema indicates numeric type
        const rawType = field._raw?.type;
        if (rawType === 'integer') {
          data[key] = parseInt(val, 10);
        } else if (rawType === 'number' || (field.enum && field.enum.every(e => typeof e === 'number'))) {
          data[key] = parseFloat(val);
        } else {
          data[key] = val;
        }
      }
      continue;
    }

    // Sliders
    if (component === 'slider') {
      const input = document.querySelector(`input[name="${key}"]`);
      if (input) {
        const val = input.value;
        if (val !== undefined && val !== null && val !== '') {
          // Check _raw for original integer type (normalizer converts integer -> number)
          const isInteger = field._raw?.type === 'integer' || field.type === 'integer';
          data[key] = isInteger ? parseInt(val) : parseFloat(val);
        }
      }
      continue;
    }

    // Color picker
    if (component === 'color-picker') {
      const input = document.getElementById(`input_${key}`);
      if (input) {
        data[key] = input.value;
      }
      continue;
    }

    // Select dropdowns - with type coercion for integer/number enums
    if (component === 'select') {
      const input = document.getElementById(`input_${key}`);
      if (input) {
        const val = input.value;
        if (val === '__custom__' && field.objectAlternative) {
          // Build object from custom dimension inputs
          const obj = {};
          for (const propKey of Object.keys(field.objectAlternative.properties)) {
            const dimInput = document.getElementById(`input_${key}_${propKey}`);
            if (dimInput && dimInput.value) {
              obj[propKey] = parseInt(dimInput.value, 10);
            }
          }
          if (Object.keys(obj).length > 0) {
            data[key] = obj;
          }
        } else if (val !== undefined && val !== null && val !== '') {
          // Coerce to number/integer if schema indicates numeric type
          const rawType = field._raw?.type;
          if (rawType === 'integer') {
            data[key] = parseInt(val, 10);
          } else if (rawType === 'number' || (field.enum && field.enum.every(e => typeof e === 'number'))) {
            data[key] = parseFloat(val);
          } else {
            data[key] = val;
          }
        }
      }
      continue;
    }

    // Textarea - explicit handling for prompts and text inputs
    if (component === 'textarea' || component === 'json-input') {
      const input = document.getElementById(`input_${key}`);
      if (input) {
        const val = input.value;
        if (val !== undefined && val !== null && val !== '') {
          if (component === 'json-input') {
            try {
              data[key] = JSON.parse(val);
            } catch {
              data[key] = val;
            }
          } else {
            data[key] = val;
          }
        }
      }
      continue;
    }

    // Hidden fields - include default values with type coercion
    if (component === 'hidden') {
      const input = document.getElementById(`input_${key}`);
      let val = input ? input.value : undefined;

      // Use default if no value
      if (val === undefined || val === null || val === '') {
        val = field.default;
      }

      if (val !== undefined && val !== null && val !== '') {
        // Coerce to proper type
        const rawType = field._raw?.type;
        if (rawType === 'integer') {
          data[key] = parseInt(val, 10);
        } else if (rawType === 'number') {
          data[key] = parseFloat(val);
        } else if (rawType === 'boolean' || field.type === 'boolean') {
          data[key] = val === true || val === 'true';
        } else {
          data[key] = val;
        }
      }
      continue;
    }

    // Regular inputs (including text, number)
    const input = document.getElementById(`input_${key}`);
    if (input) {
      const val = input.value;
      if (val !== undefined && val !== null && val !== '') {
        // Check _raw for original integer type
        const rawType = field._raw?.type;
        const isInteger = rawType === 'integer' || field.type === 'integer';
        const isNumber = rawType === 'number' || field.type === 'number' ||
                        (field.enum && field.enum.every(e => typeof e === 'number'));

        if (isInteger) {
          data[key] = parseInt(val, 10);
        } else if (isNumber) {
          data[key] = parseFloat(val);
        } else if (rawType === 'boolean' || field.type === 'boolean') {
          data[key] = val === 'true' || val === true;
        } else {
          data[key] = val;
        }
      }
    }
  }

  return data;
}

// ============================================================================
// JOB QUEUE MANAGEMENT
// ============================================================================
const modelJobQueue = []; // { jobId, status, progress, error, output, createdAt, modelId }

function addJobToQueue(jobId, modelId) {
  modelJobQueue.unshift({
    jobId,
    modelId: modelId || modelInfo?.id || '',
    status: 'pending',
    progress: 0,
    error: null,
    output: null,
    createdAt: new Date().toISOString(),
  });
  renderJobQueue();
}

function updateJobInQueue(jobId, updates) {
  const job = modelJobQueue.find(j => j.jobId === jobId);
  if (job) {
    Object.assign(job, updates);
    renderJobQueue();
  }
}

function clearCompletedJobs() {
  const active = modelJobQueue.filter(j => j.status === 'pending' || j.status === 'processing');
  modelJobQueue.length = 0;
  modelJobQueue.push(...active);
  renderJobQueue();
  // If no active jobs remain, hide queue
  if (modelJobQueue.length === 0) {
    const queueEl = document.getElementById('jobQueue');
    if (queueEl) queueEl.classList.add('hidden');
  }
}

function renderJobQueue() {
  const queueEl = document.getElementById('jobQueue');
  const listEl = document.getElementById('jobQueueList');
  const countEl = document.getElementById('jobQueueCount');
  const clearBtn = document.getElementById('clearCompletedBtn');

  if (modelJobQueue.length === 0) {
    queueEl.classList.add('hidden');
    return;
  }

  queueEl.classList.remove('hidden');

  const activeCount = modelJobQueue.filter(j => j.status === 'pending' || j.status === 'processing').length;
  const completedCount = modelJobQueue.filter(j => j.status === 'completed' || j.status === 'failed').length;
  countEl.textContent = activeCount > 0 ? activeCount : modelJobQueue.length;

  clearBtn.classList.toggle('hidden', completedCount === 0);

  listEl.innerHTML = modelJobQueue.map(job => renderJobCard(job)).join('');
}

function renderJobCard(job) {
  const isPending = job.status === 'pending';
  const isProcessing = job.status === 'processing';
  const isCompleted = job.status === 'completed';
  const isFailed = job.status === 'failed';
  const isActive = isPending || isProcessing;

  const statusLabel = isPending ? 'In Queue' : isProcessing ? 'Processing' : isCompleted ? 'Completed' : 'Failed';
  const statusColor = isPending
    ? 'text-[#FFD128]' : isProcessing
    ? 'text-primary/90' : isCompleted
    ? 'text-green-500' : 'text-red-500';
  const bgColor = isPending
    ? 'bg-[#FFD128]/10' : isProcessing
    ? 'bg-primary/90/10' : isCompleted
    ? 'bg-green-500/10' : 'bg-red-500/10';
  const dotColor = isPending
    ? 'bg-[#FFD128]' : isProcessing
    ? 'bg-primary/90' : isCompleted
    ? 'bg-green-500' : 'bg-red-500';
  const barColor = isPending
    ? 'from-[#FFD128] to-[#FFD128]' : 'from-primary/90 to-primary/90';

  const timeAgo = getTimeAgo(job.createdAt);
  const shortId = job.jobId.slice(0, 8);
  const pct = job.progress || 0;

  // Thumbnail for completed jobs
  let thumbHtml = '';
  if (isCompleted && job.output) {
    const url = extractUrl(job.output);
    if (url) {
      const mediaType = detectMediaType(url);
      if (mediaType === 'image') {
        thumbHtml = `<img src="${url}" alt="" class="w-12 h-12 rounded-lg object-cover flex-shrink-0" data-hide-on-error>`;
      } else if (mediaType === 'video') {
        thumbHtml = `<div class="w-12 h-12 rounded-lg bg-primary/90/10 flex items-center justify-center flex-shrink-0"><svg class="w-5 h-5 text-primary/90" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>`;
      } else if (mediaType === 'audio') {
        thumbHtml = `<div class="w-12 h-12 rounded-lg bg-pink-500/10 flex items-center justify-center flex-shrink-0"><svg class="w-5 h-5 text-pink-500" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/></svg></div>`;
      }
    }
  }

  // Spinner for active jobs
  let spinnerHtml = '';
  if (isActive) {
    const spinBorder = isPending ? 'border-[#FFD128]' : 'border-primary/90';
    const spinBg = isPending ? 'border-[#FFD128]/15' : 'border-primary/90/15';
    spinnerHtml = `
      <div class="relative w-10 h-10 flex-shrink-0">
        <div class="absolute inset-0 rounded-full border-2 ${spinBg}"></div>
        <div class="absolute inset-0 rounded-full border-2 ${spinBorder} border-t-transparent animate-spin"></div>
        ${pct > 0 ? `<div class="absolute inset-0 flex items-center justify-center"><span class="text-[10px] font-bold ${statusColor}">${pct}%</span></div>` : ''}
      </div>`;
  }

  // Checkmark/X for terminal states
  let iconHtml = '';
  if (isCompleted && !thumbHtml) {
    iconHtml = `<div class="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0"><svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg></div>`;
  } else if (isFailed) {
    iconHtml = `<div class="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0"><svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></div>`;
  }

  const leftEl = thumbHtml || spinnerHtml || iconHtml;
  const clickAction = isCompleted ? `data-action="showJobResult" data-param="${job.jobId}"` : isFailed ? `data-action="showJobError" data-param="${job.jobId}"` : '';
  const cursorClass = (isCompleted || isFailed) ? 'cursor-pointer hover:bg-[#E9EEF7]/50 dark:hover:bg-[#1C1E20]/50' : '';

  return `
    <div class="flex items-center gap-3 p-3 transition-colors ${cursorClass}" ${clickAction} data-job-card="${job.jobId}">
      ${leftEl}
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-0.5">
          <span class="px-2 py-0.5 text-[11px] rounded-full ${bgColor} ${statusColor} font-medium">
            ${isActive ? `<span class="inline-block w-1.5 h-1.5 rounded-full ${dotColor} mr-1 animate-pulse"></span>` : ''}
            ${statusLabel}
          </span>
          <span class="text-[11px] text-muted-foreground">#${shortId}</span>
        </div>
        ${isActive && pct > 0 ? `
          <div class="w-full mt-1.5">
            <div class="h-1.5 w-full rounded-full bg-gray-200 dark:bg-[#272727] overflow-hidden">
              <div class="h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-500" style="width: ${pct}%"></div>
            </div>
          </div>` : ''}
        ${isFailed && job.error ? `<p class="text-[11px] text-red-400 mt-0.5 truncate">${job.error}</p>` : ''}
      </div>
      <span class="text-[11px] text-muted-foreground flex-shrink-0">${timeAgo}</span>
    </div>`;
}

function showJobResult(jobId) {
  const job = modelJobQueue.find(j => j.jobId === jobId);
  if (job?.output) {
    showOutputState('success', job.output);
  }
}

function showJobError(jobId) {
  const job = modelJobQueue.find(j => j.jobId === jobId);
  if (job?.error) {
    showOutputState('error', job.error);
  }
}

function getTimeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 5000) return 'now';
  if (diff < 60000) return `${Math.floor(diff / 1000)}s`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  return `${Math.floor(diff / 3600000)}h`;
}

// ============================================================================
// OUTPUT RENDERING
// ============================================================================
function showOutputState(state, data) {
  // Hide all output states (not job queue)
  document.getElementById('outputSuccess')?.classList.add('hidden');
  if (window.PendingPaid) {
    window.PendingPaid.clearOutputStates();
  } else {
    document.getElementById('outputError')?.classList.add('hidden');
    document.getElementById('outputPendingPaid')?.classList.add('hidden');
  }

  switch (state) {
    case 'success':
      document.getElementById('outputSuccess')?.classList.remove('hidden');
      const outputContentEl = document.getElementById('outputContent'); if (outputContentEl) outputContentEl.innerHTML = renderOutput(data);
      break;

    case 'error':
      document.getElementById('outputError')?.classList.remove('hidden');
      const outputErrMsgEl = document.getElementById('outputErrorMessage'); if (outputErrMsgEl) outputErrMsgEl.textContent = data || 'An unknown error occurred';
      break;

    case 'pending-paid': {
      const el = document.getElementById('outputPendingPaid');
      el.classList.remove('hidden');
      window.PendingPaid?.renderPendingPaidInto(el, {
        thumbUrl: data?.thumbUrl || null,
        title: data?.title || null,
        message: data?.message || null,
        reason: data?.reason || null,
        activeJobs: data?.activeJobs,
        maxConcurrentJobs: data?.maxConcurrentJobs,
        onRetry: () => generate(),
      });
      break;
    }
  }
}

function renderOutput(output) {
  if (!output) {
    return '<p class="text-muted-foreground text-center">No output</p>';
  }

  // Array of outputs
  if (Array.isArray(output)) {
    if (output.length === 0) return '<p class="text-muted-foreground text-center">No output</p>';

    // Detect streaming text token array: all strings, none are URLs
    const allStrings = output.every(item => typeof item === 'string');
    if (allStrings) {
      const anyUrl = output.some(item => {
        const s = item.trim();
        return s.startsWith('http://') || s.startsWith('https://') || s.startsWith('data:');
      });
      if (!anyUrl) {
        // Concatenate streaming text tokens into single text block
        const text = output.join('');
        return renderTextOutput(text);
      }
    }

    return `<div class="grid gap-4">${output.map(item => renderSingleOutput(item)).join('')}</div>`;
  }

  return renderSingleOutput(output);
}

function renderTextOutput(text) {
  if (!text || !text.trim()) {
    return '<p class="text-muted-foreground text-center">No output</p>';
  }
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const textId = 'textOutput_' + Math.random().toString(36).slice(2, 10);
  return `
    <div class="relative group">
      <div id="${textId}" class="bg-[#E9EEF7] dark:bg-[#1C1E20] rounded-2xl p-5 text-sm text-foreground whitespace-pre-wrap leading-relaxed">${escaped}</div>
      <div class="flex justify-end mt-2">
        <button data-action="copyElementText" data-param="${textId}" class="px-4 py-1.5 bg-[#E9EEF7] dark:bg-[#1C1E20] hover:bg-[#DFE4EC] dark:hover:bg-[#252729] text-foreground rounded-xl text-xs font-medium transition-colors">
          Copy text
        </button>
      </div>
    </div>
  `;
}

function renderSingleOutput(output) {
  const url = extractUrl(output);

  // Plain text string (not a URL) — render as readable text, not JSON
  if (!url && typeof output === 'string') {
    return renderTextOutput(output);
  }

  if (url) {
    const mediaType = detectMediaType(url);

    if (mediaType === 'video') {
      return `
        <div class="space-y-3">
          <video src="${url}" controls autoplay class="w-full max-h-[500px] object-contain rounded-2xl bg-black"></video>
          <div class="flex gap-2 justify-center">
            <button data-action="downloadOutputUrl" data-param="${url}" class="px-6 py-2 bg-primary/90 hover:bg-primary text-primary-foreground rounded-xl text-xs font-medium transition-colors">
              Download
            </button>
            <button data-action="copyToClipboard" data-param="${url}" class="px-6 py-2 bg-[#E9EEF7] dark:bg-[#1C1E20] hover:bg-[#DFE4EC] dark:hover:bg-[#252729] text-foreground rounded-xl text-xs font-medium transition-colors">
              Copy URL
            </button>
          </div>
        </div>
      `;
    }

    if (mediaType === 'image') {
      return `
        <div class="space-y-3">
          <img src="${url}" alt="Generated image" class="w-full max-h-[500px] object-contain rounded-2xl cursor-pointer" data-action="openMediaModal" data-param="${url}" data-param2="image">
          <div class="flex gap-2 justify-center">
            <button data-action="downloadOutputUrl" data-param="${url}" class="px-6 py-2 bg-primary/90 hover:bg-primary text-primary-foreground rounded-xl text-xs font-medium transition-colors">
              Download
            </button>
            <button data-action="copyToClipboard" data-param="${url}" class="px-6 py-2 bg-[#E9EEF7] dark:bg-[#1C1E20] hover:bg-[#DFE4EC] dark:hover:bg-[#252729] text-foreground rounded-xl text-xs font-medium transition-colors">
              Copy URL
            </button>
          </div>
        </div>
      `;
    }

    if (mediaType === 'audio') {
      return `
        <div class="space-y-3">
          <audio src="${url}" controls class="w-full"></audio>
          <div class="flex gap-2 justify-center">
            <button data-action="downloadOutputUrl" data-param="${url}" class="px-6 py-2 bg-primary/90 hover:bg-primary text-primary-foreground rounded-xl text-xs font-medium transition-colors">
              Download
            </button>
            <button data-action="copyToClipboard" data-param="${url}" class="px-6 py-2 bg-[#E9EEF7] dark:bg-[#1C1E20] hover:bg-[#DFE4EC] dark:hover:bg-[#252729] text-foreground rounded-xl text-xs font-medium transition-colors">
              Copy URL
            </button>
          </div>
        </div>
      `;
    }

    // Unknown URL - show as link
    return `<a href="${url}" target="_blank" class="text-primary/90 hover:underline break-all">${url}</a>`;
  }

  // Fallback: JSON output
  console.log('Model output (JSON fallback):', output);
  return `<pre class="bg-[#E9EEF7] dark:bg-[#1C1E20] rounded-2xl p-4 overflow-x-auto text-sm text-foreground whitespace-pre-wrap">${JSON.stringify(output, null, 2)}</pre>`;
}

function extractUrl(output) {
  if (typeof output === 'string' && (output.startsWith('http') || output.startsWith('data:'))) {
    return output;
  }
  if (Array.isArray(output) && output.length > 0) {
    return extractUrl(output[0]);
  }
  if (typeof output === 'object' && output !== null) {
    // Check common URL properties
    const urlProps = ['url', 'output', 'image', 'video', 'audio', 'result', 'resultUrl', 'video_url', 'image_url', 'audio_url'];
    for (const prop of urlProps) {
      if (output[prop]) return extractUrl(output[prop]);
    }
    // Check array properties
    const arrayProps = ['images', 'outputs', 'results', 'urls'];
    for (const prop of arrayProps) {
      if (Array.isArray(output[prop]) && output[prop].length > 0) {
        return extractUrl(output[prop][0]);
      }
    }
  }
  return null;
}

function detectMediaType(url) {
  if (!url) return 'unknown';

  // Extension-based detection (highest priority)
  if (/\.(mp4|webm|mov|avi|mkv)($|\?)/i.test(url)) return 'video';
  if (/\.(jpg|jpeg|png|gif|webp|svg|bmp)($|\?)/i.test(url)) return 'image';
  if (/\.(mp3|wav|ogg|m4a|aac|flac)($|\?)/i.test(url)) return 'audio';

  // Path-based detection for CDN URLs
  if (url.includes('/video/') || url.includes('video.') || url.includes('/videos/')) return 'video';
  if (url.includes('/audio/') || url.includes('audio.') || url.includes('/sounds/')) return 'audio';
  if (url.includes('/image/') || url.includes('/aitopia/marketplace/images/')) return 'image';

  // Use model capabilities to infer output type for CDN URLs without extensions
  // (e.g., replicate.delivery/xezc/xxx/output has no extension)
  if (url.includes('replicate.delivery') || url.includes('fal.media') || url.includes('pbxt.replicate')) {
    // Check model capabilities for hints
    if (modelInfo?.capabilities) {
      const caps = modelInfo.capabilities;
      // Video models
      if (caps.some(c => c.includes('video-generation') || c.includes('text-to-video') ||
                         c.includes('image-to-video') || c.includes('video-upscaling') ||
                         c.includes('lip-sync') || c.includes('character-animation'))) {
        return 'video';
      }
      // Audio models
      if (caps.some(c => c.includes('text-to-speech') || c.includes('voice-cloning') ||
                         c.includes('audio-generation') || c.includes('music-generation') ||
                         c.includes('sound-generation'))) {
        return 'audio';
      }
    }
    // Default to image for CDN URLs when capabilities don't indicate video/audio
    return 'image';
  }

  return 'unknown';
}

// Copy to clipboard
function copyToClipboard(text) {
  navigator.clipboard.writeText(text);
  // Show brief feedback
  const btn = event.target;
  const originalText = btn.textContent;
  btn.textContent = 'Copied!';
  setTimeout(() => btn.textContent = originalText, 1500);
}

// ============================================================================
// CREDITS BALANCE REFRESH
// ============================================================================
function refreshCreditsBalance() {
  try {
    if (window.NavbarComponent?.invalidateCreditsCache) {
      window.NavbarComponent.invalidateCreditsCache(true);
    } else if (window.AitopiaCredits?.loadCreditsBalance) {
      window.AitopiaCredits.loadCreditsBalance({ force: true });
    } else {
      fetch('https://aitopia.ai/api/credits/balance', { credentials: 'include' })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (!data?.balance) return;
          const credits = data.balance.totalCredits ?? data.balance.totalCreditsRemaining ?? 0;
          const el = document.querySelector('#creditsAmount .credits-shimmer');
          if (el) el.textContent = String(credits);
        })
        .catch(() => {});
    }
  } catch (e) {
    console.warn('Failed to refresh credits balance', e);
  }
}

// ============================================================================
// MODEL EXECUTION
// ============================================================================
// checkAuthOrRedirect is provided by window.PendingPaid (pending-paid.js)
function checkAuthOrRedirect() {
  return window.PendingPaid?.checkAuthOrRedirect() ?? Promise.resolve(true);
}

async function generate() {
  // Save form snapshot before auth check (so form state survives login redirect)
  try {
    window.PendingPaid?.saveSnapshot('model_form_snapshot', collectFormData());
  } catch (_) {}

  // Auth check — redirect to login if not logged in
  if (!(await checkAuthOrRedirect())) return;

  // Agreement check — show modal if user hasn't agreed yet
  if (window.PendingPaid?.showAgreementModal) {
    const agreed = await window.PendingPaid.showAgreementModal();
    if (!agreed) return;
  }

  // Clear snapshot after successful auth (no longer needed)
  try { sessionStorage.removeItem('model_form_snapshot'); } catch (_) {}

  const formData = collectFormData();

  // DEBUG: Log what we're sending
  console.log('=== GENERATE DEBUG ===');
  console.log('Form data keys:', Object.keys(formData));
  console.log('Form data:', JSON.stringify(formData, (k, v) => {
    // Truncate data URLs for readability
    if (typeof v === 'string' && v.startsWith('data:')) {
      return v.substring(0, 50) + '... [DATA URL truncated, length=' + v.length + ']';
    }
    return v;
  }, 2));
  console.log('uploadedFiles:', Object.keys(uploadedFiles));
  for (const [k, v] of Object.entries(uploadedFiles)) {
    console.log(`  ${k}:`, typeof v === 'string' && v.startsWith('data:') ? `DATA URL (${v.length} chars)` : v);
  }
  console.log('=== END DEBUG ===');

  // Validate required fields
  const required = modelSchema?.required || [];
  for (const key of required) {
    if (formData[key] === undefined || formData[key] === '') {
      const field = modelSchema.properties[key];
      showFieldError(key, `${humanizeLabel(field.title || key)} is required`);
      return;
    }
  }

  // Clear any previous pending-paid / error state
  if (window.PendingPaid) {
    window.PendingPaid.clearOutputStates();
  } else {
    document.getElementById('outputPendingPaid')?.classList.add('hidden');
    document.getElementById('outputError')?.classList.add('hidden');
  }

  // Show loading state
  const btn = document.getElementById('generateBtn');
  btn.disabled = true;
  document.getElementById('generateBtnText')?.classList.add('hidden');
  document.getElementById('generateBtnCost')?.classList.add('hidden');
  document.getElementById('generateBtnLoading')?.classList.remove('hidden');

  // Switch to history tab and kick off balance check in parallel
  switchModelTab('history');
  const historyReady = (!historyPanel && modelInfo)
    ? (historyLoaded = true, initHistoryPanel())
    : Promise.resolve();
  // Start balance fetch immediately (parallel with history init)
  const balancePromise = window.PendingPaid ? window.PendingPaid.fetchBalance() : Promise.resolve(null);
  await historyReady;

  // ── Pre-flight credit check (fake run flow) ──────────────────────
  try {
    const available = await balancePromise;
    if (window.PendingPaid?.isInsufficient(available, null)) {
      window.PendingPaid.saveSnapshot('model_form_snapshot', formData);
      const thumbUrl = window.PendingPaid.extractThumb(formData);
      showOutputState('pending-paid', { thumbUrl });
      if (typeof window.__pricingModal === 'function') {
        setTimeout(() => window.__pricingModal(), 0);
      }
      btn.disabled = false;
      document.getElementById('generateBtnText')?.classList.remove('hidden');
      const costEl = document.getElementById('generateBtnCost');
      const costValEl = document.getElementById('generateBtnCostValue');
      if (costValEl && costValEl.textContent) costEl?.classList.remove('hidden');
      document.getElementById('generateBtnLoading')?.classList.add('hidden');
      return;
    }
  } catch (_) { /* balance check failed — proceed, backend will enforce */ }
  // ── End pre-flight credit check ──────────────────────────────────

  try {
    // All model runs are now async jobs — no more HTTP timeouts
    const response = await fetch(buildModelApiUrl('run', modelInfo.id), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    const result = await response.json();

    // Handle queue limit exceeded (402 + QUEUE_LIMIT_EXCEEDED)
    if (response.status === 402 && result.code === 'QUEUE_LIMIT_EXCEEDED') {
      const thumbUrl = window.PendingPaid?.extractThumb(formData) || null;
      showOutputState('pending-paid', {
        thumbUrl,
        title: 'Queue Limit Reached',
        message: result.error || 'Queue limit reached. Please wait for your current jobs to complete or upgrade your plan.',
      });
      return;
    }

    // Handle insufficient credits (402)
    if (response.status === 402 && result.requiredCredits !== undefined) {
      window.PendingPaid?.saveSnapshot('model_form_snapshot', formData);
      const thumbUrl = window.PendingPaid?.extractThumb(formData) || null;
      showOutputState('pending-paid', { thumbUrl });
      if (typeof window.__pricingModal === 'function') window.__pricingModal();
      return; // Skip the rest — button reset happens in finally block
    }

    if (result.error) {
      throw new Error(result.error);
    }

    // Credits reserved — refresh balance immediately
    refreshCreditsBalance();

    // Capture playground run ID for history tracking
    lastPlaygroundRunId = result.playgroundRunId || null;
    if (result.playgroundRunId && result.jobId) {
      jobIdToRunId[result.jobId] = result.playgroundRunId;
    }

    // All runs return jobId — push to history as in-progress, then poll
    if (result.jobId) {
      pushToHistoryPanel(result.jobId, formData, 'In Queue');
      await pollJobUntilComplete(result.jobId, formData);
      return;
    }

    // Fallback: direct result (shouldn't happen with new API, but kept for safety)
    if (result.output) {
      showOutputState('success', result.output);
      addToHistoryCache(formData, result.output);
    }

  } catch (error) {
    showOutputState('error', error.message);
  } finally {
    btn.disabled = false;
    document.getElementById('generateBtnText')?.classList.remove('hidden');
    const costEl = document.getElementById('generateBtnCost');
    const costValEl = document.getElementById('generateBtnCostValue');
    if (costValEl && costValEl.textContent) costEl?.classList.remove('hidden');
    document.getElementById('generateBtnLoading')?.classList.add('hidden');
  }
}

async function pollJobUntilComplete(jobId, originalFormData, maxAttempts = 180) {
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const response = await fetch(`https://aitopia.ai/api/models/jobs/${jobId}`);
      const job = await response.json();

      // Capture runId from job response
      if (job.runId && !jobIdToRunId[jobId]) {
        jobIdToRunId[jobId] = job.runId;
        lastPlaygroundRunId = job.runId;
      }

      if (job.status === 'completed') {
        refreshCreditsBalance();
        addToHistoryCache(originalFormData, job.output);
        return;
      }

      if (job.status === 'failed') {
        showOutputState('error', job.error || 'Job failed');
        refreshCreditsBalance();
        return;
      }

      // Update progress in creation history panel
      const progress = job.progress || Math.min((attempts / maxAttempts) * 100, 95);
      const statusText = job.progress > 0 ? `Running (${Math.round(progress)}%)` : 'Running';
      pushToHistoryPanel(jobId, originalFormData, statusText);

      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
    } catch (err) {
      console.error('Poll error:', err);
      await new Promise(resolve => setTimeout(resolve, 3000));
      attempts++;
    }
  }

  showOutputState('error', 'Job timed out after 6 minutes. The model may still be running.');
}

// ============================================================================
// API CODE EXAMPLES
// ============================================================================
let currentCodeTab = 'curl';

function generateCodeExamples() {
  if (!modelInfo) return;

  const baseUrl = window.__AITOPIA_DOMAIN__ || 'https://aitopia.ai';
  const apiEndpoint = `${baseUrl}${buildModelApiUrl('run', modelInfo.id)}`;
  const exampleInput = getExampleInput();

  // cURL example
  const curlCode = `curl -X POST "${apiEndpoint}" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -d '${JSON.stringify(exampleInput, null, 2)}'`;

  // Python example
  const pythonCode = `import requests

response = requests.post(
    "${apiEndpoint}",
    headers={
        "Content-Type": "application/json",
        "X-API-Key": "YOUR_API_KEY"
    },
    json=${JSON.stringify(exampleInput, null, 4).replace(/"/g, '"').split('\n').join('\n    ')}
)

result = response.json()
print(result)`;

  // JavaScript example
  const jsCode = `const response = await fetch("${apiEndpoint}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": "YOUR_API_KEY"
  },
  body: JSON.stringify(${JSON.stringify(exampleInput, null, 4).split('\n').join('\n  ')})
});

const result = await response.json();
console.log(result);`;

  const curlEl = document.getElementById('curlExample'); if (curlEl) curlEl.textContent = curlCode;
  const pythonEl = document.getElementById('pythonExample'); if (pythonEl) pythonEl.textContent = pythonCode;
  const jsEl = document.getElementById('jsExample'); if (jsEl) jsEl.textContent = jsCode;
}

function getExampleInput() {
  const input = {};
  if (!modelSchema?.properties) return input;

  const required = modelSchema.required || [];

  for (const field of required) {
    const prop = modelSchema.properties[field];
    if (!prop) continue;

    if (prop.default !== undefined) {
      input[field] = prop.default;
    } else if (prop.enum && prop.enum.length > 0) {
      input[field] = prop.enum[0];
    } else if (prop.type === 'string') {
      if (prop.format === 'uri' || prop.format === 'image') {
        input[field] = 'https://example.com/image.jpg';
      } else {
        input[field] = prop.title || field;
      }
    } else if (prop.type === 'number') {
      input[field] = prop.minimum || prop.default || 1;
    } else if (prop.type === 'boolean') {
      input[field] = prop.default || true;
    }
  }

  return input;
}

function showCodeExample(tab) {
  currentCodeTab = tab;

  document.querySelectorAll('.code-tab').forEach(btn => {
    const isActive = btn.dataset.tab === tab;
    btn.className = `code-tab text-xs px-3 py-1 rounded-md font-medium ${isActive ? 'bg-white dark:bg-[#272727] text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`;
  });

  document.getElementById('curlExample')?.classList.toggle('hidden', tab !== 'curl');
  document.getElementById('pythonExample')?.classList.toggle('hidden', tab !== 'python');
  document.getElementById('jsExample')?.classList.toggle('hidden', tab !== 'js');
}

function copyCodeExample() {
  const codeEl = document.getElementById(`${currentCodeTab}Example`);
  if (codeEl) {
    navigator.clipboard.writeText(codeEl.textContent);
    const btn = event.target;
    const originalText = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => btn.textContent = originalText, 1500);
  }
}