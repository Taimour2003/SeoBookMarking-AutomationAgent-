// Media Panel - Studio queue + creations (AgenticAI split view)

(function () {
  'use strict';

  const MEDIA_TOOLS = new Set([
    'generate_image',
    'text_to_speech',
    'generate_video',
    'image_to_video',
    'merge_videos',
    'add_background_music',
    'add_narration',
    'generate_music',
    'export_audio',
  ]);

  const AUDIO_TOOLS = new Set(['text_to_speech', 'generate_music', 'export_audio']);
  const VIDEO_TOOLS = new Set([
    'generate_video',
    'image_to_video',
    'merge_videos',
    'add_background_music',
    'add_narration',
  ]);

  const MAX_QUEUE_ITEMS = 10;
  const MAX_CREATIONS = 30; // asset cards (not raw tool runs)
  const MAX_VERSIONS_PER_ASSET = 10;
  const NEW_PULSE_MS = 1800;
  const SESSION_STORAGE_KEY = 'agenticai_session_id';
  const PERSIST_KEY_PREFIX = 'agenticai.studio.v1:';

  let billingConfig = { billingMode: 'unknown', usdPerCredit: 0.02 };

  function creditsFromUsd(costUsd) {
    const usd = typeof costUsd === 'number' && Number.isFinite(costUsd) ? costUsd : 0;
    if (usd <= 0) return 0;
    const usdPerCredit = typeof billingConfig.usdPerCredit === 'number' && Number.isFinite(billingConfig.usdPerCredit) && billingConfig.usdPerCredit > 0
      ? billingConfig.usdPerCredit
      : 0.02;
    return Math.max(1, Math.ceil(usd / usdPerCredit));
  }

  function getCreditsEstimateLabelForResult(result) {
    if (!result || typeof result !== 'object') return '';
    const costUsd = typeof result.costUsd === 'number' && Number.isFinite(result.costUsd) ? result.costUsd : 0;
    const credits = creditsFromUsd(costUsd);
    if (!credits) return '';
    return `~${credits} credits`;
  }

  function getCreditsEstimateForResult(result) {
    if (!result || typeof result !== 'object') return 0;
    const costUsd = typeof result.costUsd === 'number' && Number.isFinite(result.costUsd) ? result.costUsd : 0;
    return creditsFromUsd(costUsd);
  }

  function optimisticallyDebitCredits(result) {
    const credits = getCreditsEstimateForResult(result);
    if (!credits) return;
    try {
      window.NavbarComponent?.decrementCreditsOptimistic?.(credits);
    } catch {
      // ignore
    }
  }

  async function loadBillingConfig() {
    const fetchFn = typeof window !== 'undefined' ? window.fetch : null;
    if (typeof fetchFn !== 'function') return;
    try {
      const res = await fetchFn('https://aitopia.ai/api/config/billing', { method: 'GET', headers: { Accept: 'application/json' } });
      if (!res.ok) return;
      const json = await res.json().catch(() => null);
      if (!json || typeof json !== 'object') return;
      billingConfig = {
        billingMode: typeof json.billingMode === 'string' ? json.billingMode : billingConfig.billingMode,
        usdPerCredit:
          typeof json.usdPerCredit === 'number' && Number.isFinite(json.usdPerCredit) && json.usdPerCredit > 0
            ? json.usdPerCredit
            : billingConfig.usdPerCredit,
      };
      renderCreations();
    } catch {
      // ignore
    }
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = String(text ?? '');
    return div.innerHTML;
  }

  function isRecord(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  function isMediaTool(name) {
    return MEDIA_TOOLS.has(String(name || ''));
  }

  function getMediaType(toolName) {
    if (toolName === 'generate_image') return 'image';
    if (AUDIO_TOOLS.has(toolName)) return 'audio';
    if (VIDEO_TOOLS.has(toolName)) return 'video';
    return 'unknown';
  }

  function getMediaUrl(toolName, result) {
    if (!result) return null;
    if (toolName === 'generate_image') return result?.imageUrl ? String(result.imageUrl) : null;
    if (AUDIO_TOOLS.has(toolName)) return result?.audioUrl ? String(result.audioUrl) : null;
    if (VIDEO_TOOLS.has(toolName)) return result?.videoUrl ? String(result.videoUrl) : null;
    return null;
  }

  function isToolErrorResult(result) {
    return !!(result && typeof result === 'object' && result.error);
  }

  function getCardLabel(toolName) {
    return ({
      generate_image: 'Image',
      text_to_speech: 'Speech',
      generate_video: 'Video',
      image_to_video: 'Animation',
      merge_videos: 'Merged Video',
      add_background_music: 'Video + Music',
      add_narration: 'Video + Narration',
      generate_music: 'Music',
      export_audio: 'Audio Export',
    })[toolName] || String(toolName || 'Media');
  }

  function statusLabel(status) {
    switch (status) {
      case 'preparing': return 'Preparing';
      case 'queued': return 'Queued';
      case 'running': return 'Running';
      case 'complete': return 'Complete';
      case 'failed': return 'Failed';
      case 'waiting': return 'Waiting';
      default: return '—';
    }
  }

  function approvalLabel(kind) {
    switch (kind) {
      case 'plan': return 'Plan approval';
      case 'images': return 'Keyframes approval';
      case 'budget': return 'Budget checkpoint';
      case 'checkpoint': return 'Checkpoint';
      default: return 'Approval';
    }
  }

  function nowMs() {
    return Date.now();
  }

  const state = {
    queueById: new Map(), // toolUseId -> { id, toolName, status, createdAt, input? }
    assetsById: new Map(), // assetId -> { assetId, toolName, mediaType, versionIds: [], selectedVersionId, createdAt, updatedAt }
    versionsById: new Map(), // versionId(toolUseId) -> { ...input/result/prompt/meta/url/status }
    versionToAssetId: new Map(), // versionId -> assetId
    approvalsById: new Map(), // approvalNodeId -> { approvalNodeId, kind, message, createdAt }
    stickToBottom: true,
  };

  function loadSessionId() {
    try {
      const v = localStorage.getItem(SESSION_STORAGE_KEY);
      return v && typeof v === 'string' && v.trim() ? v.trim() : '';
    } catch {
      return '';
    }
  }

  function persistKeyForSession(sessionId) {
    const sid = String(sessionId || '').trim();
    return sid ? `${PERSIST_KEY_PREFIX}${sid}` : '';
  }

  function schedulePersist() {
    if (schedulePersist.scheduled) return;
    schedulePersist.scheduled = true;
    requestAnimationFrame(() => {
      schedulePersist.scheduled = false;
      persistToLocalStorage();
    });
  }
  schedulePersist.scheduled = false;

  function persistToLocalStorage() {
    const sessionId = loadSessionId();
    const key = persistKeyForSession(sessionId);
    if (!key) return;

    try {
      const assets = Array.from(state.assetsById.values()).map((a) => ({
        assetId: String(a.assetId || ''),
        toolName: String(a.toolName || ''),
        mediaType: String(a.mediaType || ''),
        versionIds: Array.isArray(a.versionIds) ? a.versionIds.map((v) => String(v)) : [],
        selectedVersionId: String(a.selectedVersionId || ''),
        createdAt: typeof a.createdAt === 'number' ? a.createdAt : null,
        updatedAt: typeof a.updatedAt === 'number' ? a.updatedAt : null,
      }));

      const versions = Array.from(state.versionsById.values()).map((v) => ({
        id: String(v.id || ''),
        toolName: String(v.toolName || ''),
        mediaType: String(v.mediaType || ''),
        url: typeof v.url === 'string' ? v.url : '',
        status: String(v.status || ''),
        error: typeof v.error === 'string' ? v.error : '',
        createdAt: typeof v.createdAt === 'number' ? v.createdAt : null,
        meta: typeof v.meta === 'string' ? v.meta : '',
        prompt: typeof v.prompt === 'string' ? v.prompt : '',
        parentToolUseId: typeof v.parentToolUseId === 'string' ? v.parentToolUseId : '',
        input: isRecord(v.input) ? v.input : null,
        result: isRecord(v.result) ? v.result : null,
      }));

      const versionToAsset = {};
      for (const [versionId, assetId] of state.versionToAssetId.entries()) {
        versionToAsset[String(versionId)] = String(assetId);
      }

      const payload = {
        v: 1,
        savedAt: nowMs(),
        assets,
        versions,
        versionToAsset,
      };
      localStorage.setItem(key, JSON.stringify(payload));
    } catch {
      // ignore quota / serialization issues
    }
  }

  function restoreFromLocalStorage() {
    const sessionId = loadSessionId();
    const key = persistKeyForSession(sessionId);
    if (!key) return;

    let parsed = null;
    try {
      const raw = localStorage.getItem(key);
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = null;
    }
    if (!parsed || !isRecord(parsed)) return;

    const assetsRaw = Array.isArray(parsed.assets) ? parsed.assets : [];
    const versionsRaw = Array.isArray(parsed.versions) ? parsed.versions : [];
    const v2aRaw = isRecord(parsed.versionToAsset) ? parsed.versionToAsset : {};

    state.assetsById.clear();
    state.versionsById.clear();
    state.versionToAssetId.clear();

    for (const row of versionsRaw) {
      if (!isRecord(row)) continue;
      const id = typeof row.id === 'string' ? row.id : '';
      const toolName = typeof row.toolName === 'string' ? row.toolName : '';
      if (!id || !toolName) continue;
      const mediaType = typeof row.mediaType === 'string' ? row.mediaType : getMediaType(toolName);
      state.versionsById.set(id, {
        id,
        toolName,
        mediaType,
        url: typeof row.url === 'string' ? row.url : '',
        status: typeof row.status === 'string' ? row.status : 'complete',
        error: typeof row.error === 'string' ? row.error : '',
        createdAt: typeof row.createdAt === 'number' ? row.createdAt : nowMs(),
        meta: typeof row.meta === 'string' ? row.meta : '',
        prompt: typeof row.prompt === 'string' ? row.prompt : '',
        parentToolUseId: typeof row.parentToolUseId === 'string' ? row.parentToolUseId : '',
        input: isRecord(row.input) ? row.input : null,
        result: isRecord(row.result) ? row.result : null,
      });
    }

    for (const [versionId, assetId] of Object.entries(v2aRaw)) {
      if (!versionId || !assetId) continue;
      state.versionToAssetId.set(String(versionId), String(assetId));
    }

    for (const row of assetsRaw) {
      if (!isRecord(row)) continue;
      const assetId = typeof row.assetId === 'string' ? row.assetId : '';
      const toolName = typeof row.toolName === 'string' ? row.toolName : '';
      if (!assetId || !toolName) continue;
      const versionIds = Array.isArray(row.versionIds) ? row.versionIds.map((v) => String(v)).filter(Boolean) : [];
      const selectedVersionId = typeof row.selectedVersionId === 'string' ? row.selectedVersionId : '';
      const mediaType = typeof row.mediaType === 'string' ? row.mediaType : getMediaType(toolName);

      const existingSelectedOk = selectedVersionId && state.versionsById.has(selectedVersionId);
      const fallbackSelected = versionIds.find((v) => state.versionsById.has(v)) || '';

      state.assetsById.set(assetId, {
        assetId,
        toolName,
        mediaType,
        versionIds,
        selectedVersionId: existingSelectedOk ? selectedVersionId : fallbackSelected,
        createdAt: typeof row.createdAt === 'number' ? row.createdAt : nowMs(),
        updatedAt: typeof row.updatedAt === 'number' ? row.updatedAt : nowMs(),
      });
    }

    // Enforce caps after restore.
    enforceAssetCaps();
  }

  const dom = {
    app: null,
    paneToggle: null,
    paneToggleButtons: [],
    queueItems: null,
    queueCount: null,
    creationsItems: null,
    creationsCount: null,
    studioScroll: null,
    clearButton: null,
  };

  let resizeObserver = null;
  let scheduledScrollToBottom = false;
  let rescheduleScrollToBottom = false;

  function setActivePane(pane) {
    if (!dom.app) return;
    dom.app.dataset.activePane = pane === 'studio' ? 'studio' : 'chat';

    for (const btn of dom.paneToggleButtons) {
      const isActive = btn.getAttribute('data-pane') === dom.app.dataset.activePane;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    }
  }

  function ensureChatVisible() {
    setActivePane('chat');
  }

  function jumpToElement(el) {
    if (!el) return;
    ensureChatVisible();
    requestAnimationFrame(() => {
      try {
        el.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
      } catch {
        el.scrollIntoView();
      }
    });
  }

  function jumpToToolNode(toolUseId) {
    if (!toolUseId) return;
    const selector = `.node[data-tool-use-id="${CSS.escape(String(toolUseId))}"]`;
    const node = document.querySelector(selector);
    if (node) jumpToElement(node);
  }

  function jumpToApprovalNode(approvalNodeId) {
    if (!approvalNodeId) return;
    const node = document.getElementById(String(approvalNodeId));
    if (node) jumpToElement(node);
  }

  function formatMeta(toolName, result) {
    if (!isRecord(result)) return '';
    if (toolName === 'generate_video') {
      const seconds = result.seconds != null ? String(result.seconds) : '';
      const aspect = result.aspect_ratio ? String(result.aspect_ratio) : '';
      return [seconds ? `${seconds}s` : '', aspect].filter(Boolean).join(' • ');
    }
    if (toolName === 'image_to_video') {
      const duration = result.duration != null ? String(result.duration) : '';
      const aspect = result.aspect_ratio ? String(result.aspect_ratio) : '';
      return [duration ? `${duration}s` : '', aspect].filter(Boolean).join(' • ');
    }
    if (toolName === 'merge_videos') {
      const clipCount = result.clipCount != null ? String(result.clipCount) : '';
      const duration = result.duration != null ? String(result.duration) : '';
      return [clipCount ? `${clipCount} clips` : '', duration ? `${duration}s` : ''].filter(Boolean).join(' • ');
    }
    if (toolName === 'add_background_music') {
      const volume = result.volume != null ? String(result.volume) : '';
      return volume ? `volume ${volume}` : '';
    }
    if (toolName === 'add_narration') {
      const voice = result.voice ? String(result.voice) : '';
      return voice ? `voice ${voice}` : '';
    }
    if (toolName === 'text_to_speech') {
      const voice = result.voice ? String(result.voice) : '';
      return voice ? `voice ${voice}` : '';
    }
    if (toolName === 'generate_music') {
      const duration = result.duration != null ? String(result.duration) : '';
      return duration ? `${duration}s` : '';
    }
    if (toolName === 'export_audio') {
      const format = result.format ? String(result.format) : '';
      return format ? format : '';
    }
    return '';
  }

  function extractPrompt(toolName, input, result) {
    const inRec = isRecord(input) ? input : null;
    const resRec = isRecord(result) ? result : null;

    function coerceMaybeText(value) {
      if (value === undefined || value === null) return '';
      if (typeof value === 'string') return value.trim();
      if (typeof value === 'number' || typeof value === 'boolean') return String(value);
      return '';
    }

    function pickFirstNonEmpty(values) {
      for (const v of values) {
        const s = coerceMaybeText(v);
        if (!s) continue;
        // Some agents/toolchains use "auto" placeholders; show something better if possible.
        if (s.toLowerCase() === 'auto') continue;
        return s;
      }
      return '';
    }

    function deepFindPrompt(value, depth = 0) {
      if (!value || depth > 4) return '';
      if (typeof value === 'string') return value.trim();
      if (typeof value !== 'object') return '';

      const rec = value;
      // Priority keys (common across tool inputs + orchestrators)
      const direct =
        pickFirstNonEmpty([
          rec.prompt,
          rec.description,
          rec.text,
          rec.message,
          rec.instruction,
          rec.narration,
          rec.script,
        ]);
      if (direct) return direct;

      // Common nesting patterns: { params: {...} }, { inputs: [...] }, { payload: {...} }
      const candidates = [];
      if (isRecord(rec.params)) candidates.push(rec.params);
      if (isRecord(rec.payload)) candidates.push(rec.payload);
      if (Array.isArray(rec.inputs)) candidates.push(rec.inputs);
      if (Array.isArray(rec.keyframes)) candidates.push(rec.keyframes);

      for (const c of candidates) {
        const found = deepFindPrompt(c, depth + 1);
        if (found) return found;
      }

      // Fall back: scan a few properties (bounded) for prompt-like strings.
      const keys = Object.keys(rec).slice(0, 20);
      for (const k of keys) {
        const v = rec[k];
        if (!v) continue;
        if (typeof v === 'string') {
          const s = v.trim();
          if (s && s.toLowerCase() !== 'auto') return s;
        }
        if (typeof v === 'object') {
          const found = deepFindPrompt(v, depth + 1);
          if (found) return found;
        }
      }
      return '';
    }

    if (toolName === 'generate_image') {
      const revised = resRec?.revisedPrompt ? String(resRec.revisedPrompt) : '';
      const prompt = inRec?.prompt ? String(inRec.prompt) : '';
      return revised || prompt || deepFindPrompt(inRec) || deepFindPrompt(resRec);
    }

    if (AUDIO_TOOLS.has(toolName)) {
      const text = inRec?.text ? String(inRec.text) : '';
      const prompt = inRec?.prompt ? String(inRec.prompt) : '';
      return text || prompt || deepFindPrompt(inRec) || deepFindPrompt(resRec);
    }

    if (VIDEO_TOOLS.has(toolName)) {
      const prompt = inRec?.prompt ? String(inRec.prompt) : '';
      const description = inRec?.description ? String(inRec.description) : '';
      const text = inRec?.text ? String(inRec.text) : '';
      return prompt || description || text || deepFindPrompt(inRec) || deepFindPrompt(resRec);
    }

    return '';
  }

  function isNearBottom(el, thresholdPx = 40) {
    const distanceToBottom = el.scrollHeight - (el.scrollTop + el.clientHeight);
    return distanceToBottom < thresholdPx;
  }

  function shouldAutoStick() {
    if (!dom.studioScroll) return false;
    return state.stickToBottom || isNearBottom(dom.studioScroll, 40);
  }

  function scheduleScrollToBottom() {
    if (!dom.studioScroll) return;
    if (!shouldAutoStick()) return;
    if (scheduledScrollToBottom) {
      rescheduleScrollToBottom = true;
      // Best-effort immediate scroll so fast back-to-back renders (e.g. SSE bursts) don't lag behind
      // the next animation frame and leave the Studio visually "stuck" above the latest items.
      dom.studioScroll.scrollTop = dom.studioScroll.scrollHeight;
      return;
    }
    scheduledScrollToBottom = true;
    rescheduleScrollToBottom = false;

    // Best-effort immediate scroll before rAF so the UI stays pinned even under rapid updates.
    dom.studioScroll.scrollTop = dom.studioScroll.scrollHeight;

    // Two frames: first commits DOM updates, second accounts for media layout/metadata adjustments.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scheduledScrollToBottom = false;
        if (!dom.studioScroll) return;
        dom.studioScroll.scrollTop = dom.studioScroll.scrollHeight;
        if (rescheduleScrollToBottom && shouldAutoStick()) scheduleScrollToBottom();
      });
    });
  }

  function dispatchStudioStateChanged(detail) {
    try {
      if (typeof CustomEvent !== 'undefined') {
        window.dispatchEvent(new CustomEvent('agenticai:studio-state-changed', { detail: detail && typeof detail === 'object' ? detail : {} }));
      } else {
        window.dispatchEvent(new Event('agenticai:studio-state-changed'));
      }
    } catch {
      // ignore
    }
  }

  function resolveAssetIdForVersion(params) {
    const versionId = params && params.versionId ? String(params.versionId) : '';
    if (!versionId) return '';

    const existing = state.versionToAssetId.get(versionId);
    if (existing) return String(existing);

    const parentToolUseId = params && params.parentToolUseId ? String(params.parentToolUseId) : '';
    const inherited = parentToolUseId ? (state.versionToAssetId.get(parentToolUseId) || parentToolUseId) : '';
    const assetId = inherited ? String(inherited) : versionId;
    state.versionToAssetId.set(versionId, assetId);
    return assetId;
  }

  function enforceAssetCaps() {
    const assets = Array.from(state.assetsById.values());
    if (assets.length <= MAX_CREATIONS) return;

    const sortedOldestFirst = assets
      .slice()
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

    for (const a of sortedOldestFirst) {
      if (state.assetsById.size <= MAX_CREATIONS) break;
      const assetId = String(a.assetId || '');
      const asset = state.assetsById.get(assetId);
      if (!asset) continue;
      const versionIds = Array.isArray(asset.versionIds) ? asset.versionIds : [];
      for (const vid of versionIds) {
        state.versionsById.delete(String(vid));
        state.versionToAssetId.delete(String(vid));
      }
      state.assetsById.delete(assetId);
    }
  }

  function enforceVersionCapsForAsset(asset) {
    if (!asset || !Array.isArray(asset.versionIds)) return;
    while (asset.versionIds.length > MAX_VERSIONS_PER_ASSET) {
      const oldest = asset.versionIds.shift();
      if (!oldest) continue;
      const vid = String(oldest);
      state.versionsById.delete(vid);
      state.versionToAssetId.delete(vid);
      if (asset.selectedVersionId === vid) {
        asset.selectedVersionId = asset.versionIds[asset.versionIds.length - 1] || '';
      }
    }
  }

  function getSortedAssets() {
    return Array.from(state.assetsById.values())
      .slice()
      // Oldest -> newest so new items appear at the bottom (matches auto-scroll + legacy Studio order).
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  }

  function getSelectedVersion(asset) {
    if (!asset) return null;
    const selectedId = asset.selectedVersionId ? String(asset.selectedVersionId) : '';
    if (selectedId && state.versionsById.has(selectedId)) return state.versionsById.get(selectedId);
    const lastId = Array.isArray(asset.versionIds) ? asset.versionIds[asset.versionIds.length - 1] : '';
    if (lastId && state.versionsById.has(String(lastId))) return state.versionsById.get(String(lastId));
    return null;
  }

  function renderEmptyStates() {
    if (dom.queueItems) {
      dom.queueItems.innerHTML = '<div class="studio-empty">No active generations.</div>';
    }
    if (dom.creationsItems) {
      dom.creationsItems.innerHTML = '<div class="studio-empty">Your creations will appear here.</div>';
    }
    if (dom.queueCount) dom.queueCount.textContent = '0';
    if (dom.creationsCount) dom.creationsCount.textContent = '0';
  }

  function renderQueue() {
    if (!dom.queueItems || !dom.queueCount) return;

    const approvalItems = Array.from(state.approvalsById.values())
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    const toolItems = Array.from(state.queueById.values())
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    const totalCount = approvalItems.length + toolItems.length;
    dom.queueCount.textContent = String(totalCount);

    if (!totalCount) {
      dom.queueItems.innerHTML = '<div class="studio-empty">No active generations.</div>';
      return;
    }

    const rows = [];

    for (const a of approvalItems.slice(0, MAX_QUEUE_ITEMS)) {
      const title = approvalLabel(a.kind);
      const msg = a.message ? String(a.message) : 'Waiting for approval…';
      rows.push(`
        <div class="media-card media-card--waiting" data-approval-id="${escapeHtml(a.approvalNodeId)}">
          <div class="media-card-header">
            <div class="media-card-title">${escapeHtml(title)}</div>
            <div class="media-card-badge">${escapeHtml(statusLabel('waiting'))}</div>
          </div>
          <div class="media-card-body">
            <div class="media-card-status"><strong>Waiting:</strong> ${escapeHtml(msg)}</div>
            <div class="media-card-actions">
              <button type="button" class="media-card-link" data-action="view-approval" data-approval-node-id="${escapeHtml(a.approvalNodeId)}">View in chat →</button>
            </div>
          </div>
        </div>
      `);
    }

    const remainingSlots = Math.max(0, MAX_QUEUE_ITEMS - rows.length);
    for (const t of toolItems.slice(0, remainingSlots)) {
      const label = getCardLabel(t.toolName);
      rows.push(`
        <div class="media-card media-card--${escapeHtml(t.status)}" data-tool-use-id="${escapeHtml(t.id)}">
          <div class="media-card-header">
            <div class="media-card-title">${escapeHtml(label)}</div>
            <div class="media-card-badge">${escapeHtml(statusLabel(t.status))}</div>
          </div>
          <div class="media-card-body">
            <div class="media-card-status"><strong>Status:</strong> ${escapeHtml(statusLabel(t.status))}</div>
            <div class="media-card-actions">
              <button type="button" class="media-card-link" data-action="view-tool" data-tool-use-id="${escapeHtml(t.id)}">View in chat →</button>
            </div>
          </div>
        </div>
      `);
    }

    dom.queueItems.innerHTML = rows.join('');
  }

  function renderCreations() {
    if (!dom.creationsItems || !dom.creationsCount) return;

    const assets = getSortedAssets();
    dom.creationsCount.textContent = String(assets.length);

    if (!assets.length) {
      dom.creationsItems.innerHTML = '<div class="studio-empty">Your creations will appear here.</div>';
      return;
    }

    const guessAudioMime = (url) => {
      const lower = String(url || '').toLowerCase();
      if (lower.endsWith('.wav')) return 'audio/wav';
      if (lower.endsWith('.m4a') || lower.endsWith('.mp4')) return 'audio/mp4';
      return 'audio/mpeg';
    };

    const rows = assets.slice(0, MAX_CREATIONS).map((asset) => {
      const selected = getSelectedVersion(asset);
      if (!selected) return '';

      const assetId = String(asset.assetId || '');
      const versionIds = Array.isArray(asset.versionIds) ? asset.versionIds.map((v) => String(v)).filter(Boolean) : [];
      const selectedId = String(asset.selectedVersionId || selected.id || '');

      const label = getCardLabel(selected.toolName);
      const selectedVersionIndex = versionIds.length ? versionIds.findIndex((vid) => String(vid) === selectedId) : -1;
      const selectedVersionLabel = versionIds.length > 1 && selectedVersionIndex >= 0 ? `v${selectedVersionIndex + 1}` : '';
      const baseBadge = statusLabel(selected.status || 'complete');
      const badge = selectedVersionLabel ? `${baseBadge} • ${selectedVersionLabel}` : baseBadge;
      const isNew = selected.createdAt && nowMs() - selected.createdAt < NEW_PULSE_MS;

      const meta = selected.meta ? String(selected.meta) : '';
      const metaHtml = meta ? `<div class="media-card-status">${escapeHtml(meta)}</div>` : '';
      const prompt = selected.prompt ? String(selected.prompt) : '';
      const promptHtml = prompt ? `<div class="media-card-prompt">${escapeHtml(prompt)}</div>` : '';
      const creditsEstimate = getCreditsEstimateLabelForResult(selected.result);

      let preview = '';
      if (selected.status === 'failed') {
        preview = '';
      } else if (!selected.url) {
        preview = `
          <div class="media-thumb media-thumb--fixed media-thumb--placeholder" aria-label="Generating media">
            <div class="media-thumb-spinner" aria-hidden="true"></div>
          </div>
        `;
      } else if (selected.mediaType === 'image') {
        preview = `
          <div class="media-thumb media-thumb--fixed">
            <img loading="lazy" src="${escapeHtml(selected.url)}" alt="Generated image" />
          </div>
        `;
      } else if (selected.mediaType === 'audio') {
        preview = `
          <audio class="media-audio" controls>
            <source src="${escapeHtml(selected.url)}" type="${escapeHtml(guessAudioMime(selected.url))}" />
            Your browser does not support the audio element.
          </audio>
        `;
      } else if (selected.mediaType === 'video') {
        preview = `
          <div class="media-thumb media-thumb--fixed">
            <video class="media-video" controls preload="metadata" playsinline>
              <source src="${escapeHtml(selected.url)}" type="video/mp4" />
              Your browser does not support the video element.
            </video>
          </div>
        `;
      }

      const errorHtml = selected.error ? `<div class="media-card-error">${escapeHtml(selected.error)}</div>` : '';

      const versionsHtml = versionIds.length > 1
        ? `
          <div class="media-card-versions" role="tablist" aria-label="Versions">
            ${versionIds.map((vid, idx) => {
              const v = state.versionsById.get(String(vid));
              const isSelected = String(vid) === selectedId;
              const vStatus = v && v.status ? String(v.status) : '';
              const statusClass = vStatus ? `is-${escapeHtml(vStatus)}` : '';
              return `
                <button
                  type="button"
                  class="media-version-chip ${isSelected ? 'is-selected' : ''} ${statusClass}"
                  data-action="select-version"
                  data-asset-id="${escapeHtml(assetId)}"
                  data-version-id="${escapeHtml(String(vid))}"
                  role="tab"
                  aria-selected="${isSelected ? 'true' : 'false'}"
                  title="${escapeHtml(String(vid))}"
                >v${idx + 1}</button>
              `;
            }).join('')}
          </div>
        `
        : '';

      const toolUseId = String(selected.id || '');
      const setCharacterHtml =
        selected.mediaType === 'image' && selected.status === 'complete' && selected.url
          ? `<button type="button" class="media-card-link" data-action="set-character" data-asset-id="${escapeHtml(assetId)}">Set as Character</button>`
          : '';
      return `
        <div class="media-card ${isNew ? 'is-new' : ''} media-card--${escapeHtml(selected.status)}" data-asset-id="${escapeHtml(assetId)}" data-tool-use-id="${escapeHtml(toolUseId)}">
          <div class="media-card-header">
            <div class="media-card-title">${escapeHtml(label)}</div>
            <div class="media-card-badge">${escapeHtml(badge)}</div>
          </div>
          <div class="media-card-body">
            ${errorHtml}
            ${preview}
            ${versionsHtml}
            ${promptHtml}
            ${metaHtml}
            <div class="media-card-actions">
              <button type="button" class="media-card-link" data-action="edit-asset" data-asset-id="${escapeHtml(assetId)}">Edit</button>
              <button type="button" class="media-card-link" data-action="regen-asset" data-asset-id="${escapeHtml(assetId)}">Regenerate${creditsEstimate ? ` (${escapeHtml(creditsEstimate)})` : ''}</button>
              ${setCharacterHtml}
              <button type="button" class="media-card-link" data-action="view-tool" data-tool-use-id="${escapeHtml(toolUseId)}">View in chat →</button>
            </div>
          </div>
        </div>
      `;
    }).filter(Boolean);

    dom.creationsItems.innerHTML = rows.join('');
  }

  function renderAll() {
    renderQueue();
    renderCreations();
  }

  function handleApprovalRequired(event) {
    const approvalNodeId = event?.approvalNodeId ? String(event.approvalNodeId) : '';
    if (!approvalNodeId) return;

    const kind = event?.approvalKind ? String(event.approvalKind) : (event?.kind ? String(event.kind) : '');
    const message = event?.message ? String(event.message) : '';

    state.approvalsById.set(approvalNodeId, {
      approvalNodeId,
      kind: kind || 'plan',
      message,
      createdAt: nowMs(),
    });
    renderQueue();
  }

  function handleToolStart(event) {
    const id = event?.id ? String(event.id) : '';
    const toolName = event?.name ? String(event.name) : '';
    const parentToolUseId = event?.parentToolUseId ? String(event.parentToolUseId) : '';
    if (!id || !isMediaTool(toolName)) return;

    const existing = state.queueById.get(id);
    if (existing) {
      existing.status = existing.status || 'preparing';
      return;
    }

    state.queueById.set(id, {
      id,
      toolName,
      status: 'preparing',
      createdAt: nowMs(),
      parentToolUseId,
    });

    // Also show an in-grid placeholder immediately so users can see progress in the Studio "media area".
    upsertVersion({
      id,
      toolName,
      status: 'preparing',
      url: '',
      input: null,
      result: null,
      parentToolUseId,
    });
  }

  function handleToolQueued(event) {
    const id = event?.id ? String(event.id) : '';
    const toolName = event?.name ? String(event.name) : '';
    const parentToolUseId = event?.parentToolUseId ? String(event.parentToolUseId) : '';
    if (!id || !isMediaTool(toolName)) return;

    const existing = state.queueById.get(id);
    if (!existing) {
      state.queueById.set(id, {
        id,
        toolName,
        status: 'queued',
        createdAt: nowMs(),
        input: isRecord(event.input) ? event.input : null,
        parentToolUseId,
      });
      return;
    }

    existing.status = 'queued';
    existing.toolName = toolName;
    existing.input = isRecord(event.input) ? event.input : existing.input;
    existing.parentToolUseId = parentToolUseId || existing.parentToolUseId || '';

    upsertVersion({
      id,
      toolName,
      status: 'queued',
      url: '',
      input: isRecord(event.input) ? event.input : null,
      result: null,
      parentToolUseId,
    });
  }

  function handleToolRunning(event) {
    const id = event?.id ? String(event.id) : '';
    const toolName = event?.name ? String(event.name) : '';
    const parentToolUseId = event?.parentToolUseId ? String(event.parentToolUseId) : '';
    if (!id || !isMediaTool(toolName)) return;

    const existing = state.queueById.get(id);
    if (!existing) {
      state.queueById.set(id, { id, toolName, status: 'running', createdAt: nowMs(), parentToolUseId });
      upsertVersion({
        id,
        toolName,
        status: 'running',
        url: '',
        input: null,
        result: null,
        parentToolUseId,
      });
      return;
    }
    existing.status = 'running';
    existing.parentToolUseId = parentToolUseId || existing.parentToolUseId || '';

    upsertVersion({
      id,
      toolName,
      status: 'running',
      url: '',
      input: existing.input ?? null,
      result: null,
      parentToolUseId: existing.parentToolUseId || parentToolUseId || '',
    });
  }

  function upsertVersion(params) {
    const id = params?.id ? String(params.id) : '';
    const toolName = params?.toolName ? String(params.toolName) : '';
    if (!id || !toolName) return;

    const now = nowMs();
    const mediaType = getMediaType(toolName);

    const input = isRecord(params.input) ? params.input : null;
    const result = isRecord(params.result) ? params.result : null;
    const parentToolUseId = params?.parentToolUseId ? String(params.parentToolUseId) : '';

    const assetId = resolveAssetIdForVersion({ versionId: id, parentToolUseId });
    if (!assetId) return;

    let asset = state.assetsById.get(assetId);
    if (!asset) {
      asset = {
        assetId,
        toolName,
        mediaType,
        versionIds: [],
        selectedVersionId: '',
        createdAt: now,
        updatedAt: now,
      };
      state.assetsById.set(assetId, asset);
    }

    const versionAlreadyMapped = Array.isArray(asset.versionIds) && asset.versionIds.includes(id);
    if (!versionAlreadyMapped) {
      asset.versionIds.push(id);
      asset.selectedVersionId = id;
    }

    asset.toolName = toolName;
    asset.mediaType = mediaType;
    asset.updatedAt = now;

    let version = state.versionsById.get(id);
    if (!version) {
      version = {
        id,
        toolName,
        mediaType,
        url: '',
        status: 'queued',
        error: '',
        createdAt: now,
        meta: '',
        prompt: '',
        parentToolUseId: parentToolUseId || '',
        input: null,
        result: null,
      };
      state.versionsById.set(id, version);
    }

    version.toolName = toolName;
    version.mediaType = mediaType;
    version.status = params.status || version.status;
    version.url = typeof params.url === 'string' ? params.url : version.url;
    version.error = typeof params.error === 'string' ? params.error : version.error;
    version.parentToolUseId = parentToolUseId || version.parentToolUseId || '';
    version.createdAt = version.createdAt || now;

    if (input) version.input = input;
    if (result) version.result = result;

    const prompt = extractPrompt(toolName, input || version.input || null, result || version.result || null);
    if (prompt) version.prompt = prompt;

    const nextMeta = version.status === 'complete' && (result || version.result) ? formatMeta(toolName, result || version.result) : '';
    if (nextMeta) version.meta = nextMeta;

    enforceVersionCapsForAsset(asset);
    enforceAssetCaps();

    renderCreations();
    schedulePersist();
    scheduleScrollToBottom();
  }

  function handleToolResult(event) {
    const id = event?.id ? String(event.id) : '';
    const toolName = event?.name ? String(event.name) : '';
    const parentToolUseId = event?.parentToolUseId ? String(event.parentToolUseId) : '';
    if (!id || !isMediaTool(toolName)) return;

    const result = event?.result;
    const err = (() => {
      if (!isToolErrorResult(result)) return '';
      const rawError = String(result.error || '').trim() || 'tool_error';
      const rawMessage = typeof result.message === 'string' ? String(result.message).trim() : '';
      const allowedDurations = Array.isArray(result.allowedDurations)
        ? result.allowedDurations.map((n) => Number.parseInt(String(n), 10)).filter((n) => Number.isFinite(n) && n > 0)
        : [];
      const requestedSeconds = typeof result.requestedSeconds === 'number' && Number.isFinite(result.requestedSeconds)
        ? Math.trunc(result.requestedSeconds)
        : (typeof result.seconds === 'number' && Number.isFinite(result.seconds) ? Math.trunc(result.seconds) : null);

      const isLongMessageLike = rawError.length > 40 && rawError.includes(' ');
      const title = isLongMessageLike ? 'tool_error' : rawError;
      const message = rawMessage || (isLongMessageLike ? rawError : '');
      const meta = [
        requestedSeconds != null ? `requested ${requestedSeconds}s` : '',
        allowedDurations.length ? `allowed: ${allowedDurations.join(', ')}s` : '',
      ].filter(Boolean).join(' • ');

      const parts = [title, message, meta].filter(Boolean);
      return parts.join(' — ');
    })();
    const url = err ? null : getMediaUrl(toolName, result);

    const existing = state.queueById.get(id);
    state.queueById.delete(id);

    const shouldStickToBottom = shouldAutoStick();

    if (!url) {
      const message = err || 'No media URL returned.';
      upsertVersion({
        id,
        toolName,
        status: 'failed',
        url: '',
        error: message,
        input: existing?.input ?? null,
        result: null,
        parentToolUseId: existing?.parentToolUseId || parentToolUseId || '',
      });
    } else {
      upsertVersion({
        id,
        toolName,
        status: 'complete',
        url,
        error: '',
        input: existing?.input ?? null,
        result,
        parentToolUseId: existing?.parentToolUseId || parentToolUseId || '',
      });
    }

    dispatchStudioStateChanged({ reason: 'tool_result', toolUseId: id, toolName });
    renderQueue();
    if (shouldStickToBottom) scheduleScrollToBottom();
  }

  function onToolEvent(event) {
    if (!event || typeof event !== 'object') return;

    if (event.type === 'approval_required') {
      handleApprovalRequired(event);
      return;
    }

    if (!isMediaTool(event.name)) return;

    switch (event.type) {
      case 'tool_use_start':
        handleToolStart(event);
        renderQueue();
        return;
      case 'tool_use_complete':
        handleToolQueued(event);
        renderQueue();
        return;
      case 'tool_executing':
        handleToolRunning(event);
        renderQueue();
        return;
      case 'tool_result':
        handleToolResult(event);
        return;
      default:
        return;
    }
  }

  function onApprovalResolved(payload) {
    const approvalNodeId = payload && payload.approvalNodeId ? String(payload.approvalNodeId) : '';
    if (!approvalNodeId) return;
    state.approvalsById.delete(approvalNodeId);
    renderQueue();
  }

  let editOverlayEl = null;
  let editModalEl = null;

  function closeEditModal() {
    if (editOverlayEl) editOverlayEl.remove();
    editOverlayEl = null;
    editModalEl = null;
    try {
      document.body.classList.remove('modal-open');
    } catch {
      // ignore
    }
  }

  function openEditModal(assetId) {
    const id = String(assetId || '');
    const asset = id ? state.assetsById.get(id) : null;
    const selected = asset ? getSelectedVersion(asset) : null;
    if (!asset || !selected) return;

    const toolName = String(selected.toolName || '');
    const baseInput = isRecord(selected.input) ? selected.input : {};

    closeEditModal();

    editOverlayEl = document.createElement('div');
    editOverlayEl.className = 'modal-overlay';
    editOverlayEl.addEventListener('click', (e) => {
      if (e.target === editOverlayEl) closeEditModal();
    });

    editModalEl = document.createElement('div');
    editModalEl.className = 'modal';

    const title = `${getCardLabel(toolName)} — Edit`;
    const creditsEstimate = getCreditsEstimateLabelForResult(selected.result);

    const buildSelect = (field, options, value) => {
      const v = String(value ?? '');
      return `
        <select class="settings-select" data-field="${escapeHtml(field)}">
          ${options.map((o) => {
            const opt = typeof o === 'string' ? o : String(o.value);
            const label = typeof o === 'string' ? o : String(o.label);
            const selectedAttr = opt === v ? ' selected' : '';
            return `<option value="${escapeHtml(opt)}"${selectedAttr}>${escapeHtml(label)}</option>`;
          }).join('')}
        </select>
      `;
    };

    const section = (titleText, innerHtml) => `
      <div class="settings-section">
        <div class="settings-section-title">${escapeHtml(titleText)}</div>
        ${innerHtml}
      </div>
    `;

    const fieldRow = (label, controlHtml, hint) => `
      <div class="settings-row">
        <label class="settings-label">${escapeHtml(label)}</label>
        ${controlHtml}
        ${hint ? `<div class="settings-hint">${escapeHtml(hint)}</div>` : ''}
      </div>
    `;

    const textArea = (field, value, rows = 5, placeholder = '') => `
      <textarea class="settings-textarea" data-field="${escapeHtml(field)}" rows="${rows}" placeholder="${escapeHtml(placeholder)}">${escapeHtml(String(value ?? ''))}</textarea>
    `;

    const input = (field, value, placeholder = '', type = 'text', inputmode = '') => `
      <input class="settings-input" data-field="${escapeHtml(field)}" value="${escapeHtml(String(value ?? ''))}" placeholder="${escapeHtml(placeholder)}" type="${escapeHtml(type)}" ${inputmode ? `inputmode="${escapeHtml(inputmode)}"` : ''} />
    `;

    const checkbox = (field, checked) => `
      <label class="settings-checkbox">
        <input type="checkbox" data-field="${escapeHtml(field)}" ${checked ? 'checked' : ''} />
        <span>${escapeHtml(field)}</span>
      </label>
    `;

    const promptValue = typeof baseInput.prompt === 'string' ? baseInput.prompt : (selected.prompt || '');

    let bodyHtml = '';

    if (toolName === 'generate_image') {
      bodyHtml = [
        section(
          'Prompt',
          fieldRow('Prompt', textArea('prompt', promptValue, 6, 'Describe the image you want…'))
        ),
      ].join('');
    } else if (toolName === 'generate_video') {
      const seconds = typeof baseInput.seconds === 'number'
        ? baseInput.seconds
        : (typeof baseInput.duration === 'number' ? baseInput.duration : (selected.result && typeof selected.result.seconds === 'number' ? selected.result.seconds : 5));
      const aspect = typeof baseInput.aspect_ratio === 'string'
        ? baseInput.aspect_ratio
        : (selected.result && typeof selected.result.aspect_ratio === 'string' ? selected.result.aspect_ratio : 'auto');
      const imageUrl = typeof baseInput.image_url === 'string' ? baseInput.image_url : '';
      const endImageUrl = typeof baseInput.end_image_url === 'string' ? baseInput.end_image_url : '';

      bodyHtml = [
        section(
          'Prompt',
          fieldRow('Prompt', textArea('prompt', promptValue, 6, 'Describe motion + camera + style…'))
        ),
        section(
          'Parameters',
          [
            '<div class="settings-grid">',
            `<div class="settings-field">${fieldRow('Seconds', buildSelect('seconds', [4, 5, 6, 8, 10, 12].map((n) => ({ value: String(n), label: `${n}` })), String(seconds)))}</div>`,
            `<div class="settings-field">${fieldRow('Aspect', buildSelect('aspect_ratio', ['auto', 'portrait', 'landscape', 'square'], String(aspect)))}</div>`,
            '</div>',
            fieldRow('image_url (optional)', input('image_url', imageUrl, '/generated/... (start frame)')),
            fieldRow('end_image_url (optional)', input('end_image_url', endImageUrl, '/generated/... (end frame)')),
          ].join('')
        ),
      ].join('');
    } else if (toolName === 'text_to_speech') {
      const text = typeof baseInput.text === 'string' ? baseInput.text : '';
      const voice = typeof baseInput.voice === 'string' ? baseInput.voice : (selected.result && typeof selected.result.voice === 'string' ? selected.result.voice : 'onyx');
      bodyHtml = [
        section('Text', fieldRow('Text', textArea('text', text, 6, 'Narration text…'))),
        section('Voice', fieldRow('Voice', buildSelect('voice', ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'], voice))),
      ].join('');
    } else if (toolName === 'generate_music') {
      const prompt = typeof baseInput.prompt === 'string' ? baseInput.prompt : (selected.prompt || '');
      const duration = typeof baseInput.duration === 'number' ? baseInput.duration : (selected.result && typeof selected.result.duration === 'number' ? selected.result.duration : 15);
      bodyHtml = [
        section('Prompt', fieldRow('Prompt', textArea('prompt', prompt, 5, 'Genre, mood, tempo, instruments…'))),
        section('Duration', fieldRow('Seconds (5–30)', input('duration', duration, '15', 'number', 'decimal'))),
      ].join('');
    } else if (toolName === 'add_narration') {
      const videoUrl = typeof baseInput.video_url === 'string' ? baseInput.video_url : '';
      const text = typeof baseInput.text === 'string' ? baseInput.text : '';
      const voice = typeof baseInput.voice === 'string' ? baseInput.voice : 'onyx';
      const mode = baseInput.mode === 'replace' ? 'replace' : 'mix';
      const sync = baseInput.sync === 'audio' ? 'audio' : 'video';
      bodyHtml = [
        section('Inputs', fieldRow('video_url', input('video_url', videoUrl, '/generated/... mp4'))),
        section('Narration', fieldRow('Text', textArea('text', text, 6, 'Narration text…'))),
        section(
          'Parameters',
          [
            '<div class="settings-grid">',
            `<div class="settings-field">${fieldRow('Voice', buildSelect('voice', ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'], voice))}</div>`,
            `<div class="settings-field">${fieldRow('Mode', buildSelect('mode', ['mix', 'replace'], mode))}</div>`,
            '</div>',
            fieldRow('Sync', buildSelect('sync', [{ value: 'video', label: 'video (match video length)' }, { value: 'audio', label: 'audio (pad video to narration)' }], sync)),
          ].join('')
        ),
      ].join('');
    } else if (toolName === 'add_background_music') {
      const videoUrl = typeof baseInput.video_url === 'string' ? baseInput.video_url : '';
      const audioUrl = typeof baseInput.audio_url === 'string' ? baseInput.audio_url : '';
      const volume = typeof baseInput.volume === 'number' ? baseInput.volume : 0.3;
      const loop = typeof baseInput.loop === 'boolean' ? baseInput.loop : true;
      bodyHtml = [
        section('Inputs', [
          fieldRow('video_url', input('video_url', videoUrl, '/generated/... mp4')),
          fieldRow('audio_url', input('audio_url', audioUrl, '/generated/... mp3/wav')),
        ].join('')),
        section('Parameters', [
          '<div class="settings-grid">',
          `<div class="settings-field">${fieldRow('Volume (0–1)', input('volume', volume, '0.3', 'number', 'decimal'))}</div>`,
          `<div class="settings-field">${fieldRow('Loop', buildSelect('loop', [{ value: 'true', label: 'true' }, { value: 'false', label: 'false' }], loop ? 'true' : 'false'))}</div>`,
          '</div>',
        ].join('')),
      ].join('');
    } else if (toolName === 'merge_videos') {
      const urls = Array.isArray(baseInput.video_urls) ? baseInput.video_urls.map((u) => String(u)).filter(Boolean) : [];
      const transition = typeof baseInput.transition === 'string' ? baseInput.transition : 'none';
      const transitionDuration = typeof baseInput.transition_duration === 'number' ? baseInput.transition_duration : 0.5;
      bodyHtml = [
        section('Clips', fieldRow('video_urls (one per line)', textArea('video_urls', urls.join('\n'), 8, '/generated/... mp4'))),
        section('Transition', [
          fieldRow('Transition', buildSelect('transition', ['none', 'fade', 'crossfade'], transition)),
          fieldRow('Transition duration (0.1–2s)', input('transition_duration', transitionDuration, '0.5', 'number', 'decimal')),
        ].join('')),
      ].join('');
    } else {
      bodyHtml = section('Unsupported', `<div class="settings-hint">This tool is not yet editable in Studio.</div>`);
    }

    editModalEl.innerHTML = `
      <div class="modal-header">
        <div class="modal-title">${escapeHtml(title)}</div>
        <button type="button" class="modal-close" aria-label="Close">×</button>
      </div>
      <div class="modal-body">
        ${bodyHtml}
        <div class="studio-edit-actions">
          <button type="button" class="studio-edit-cancel">Cancel</button>
          <button type="button" class="studio-edit-submit">Regenerate${creditsEstimate ? ` (${escapeHtml(creditsEstimate)})` : ''}</button>
        </div>
      </div>
    `;

    const closeBtn = editModalEl.querySelector('.modal-close');
    closeBtn?.addEventListener('click', closeEditModal);
    editOverlayEl.appendChild(editModalEl);
    document.body.appendChild(editOverlayEl);
    try {
      document.body.classList.add('modal-open');
    } catch {
      // ignore
    }

    const getFieldValue = (field) => {
      if (!editModalEl) return '';
      const el = editModalEl.querySelector(`[data-field="${CSS.escape(String(field))}"]`);
      if (!el) return '';
      if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.tagName === 'SELECT') {
        return String(el.value ?? '');
      }
      if (el.type === 'checkbox') return Boolean(el.checked);
      return '';
    };

    const buildNextInput = () => {
      const next = (() => {
        try {
          return JSON.parse(JSON.stringify(baseInput));
        } catch {
          return { ...baseInput };
        }
      })();

      const setOrDeleteString = (key, value) => {
        const v = String(value || '').trim();
        if (!v) delete next[key];
        else next[key] = v;
      };

      if (toolName === 'generate_image') {
        setOrDeleteString('prompt', getFieldValue('prompt'));
        return next;
      }
      if (toolName === 'generate_video') {
        setOrDeleteString('prompt', getFieldValue('prompt'));
        const secondsRaw = String(getFieldValue('seconds') || '').trim();
        const seconds = secondsRaw ? Number.parseInt(secondsRaw, 10) : NaN;
        if (Number.isFinite(seconds)) next.seconds = seconds;
        setOrDeleteString('aspect_ratio', getFieldValue('aspect_ratio'));
        setOrDeleteString('image_url', getFieldValue('image_url'));
        setOrDeleteString('end_image_url', getFieldValue('end_image_url'));
        return next;
      }
      if (toolName === 'text_to_speech') {
        setOrDeleteString('text', getFieldValue('text'));
        setOrDeleteString('voice', getFieldValue('voice'));
        return next;
      }
      if (toolName === 'generate_music') {
        setOrDeleteString('prompt', getFieldValue('prompt'));
        const durationRaw = String(getFieldValue('duration') || '').trim();
        const duration = durationRaw ? Number.parseFloat(durationRaw) : NaN;
        if (Number.isFinite(duration)) next.duration = duration;
        return next;
      }
      if (toolName === 'add_narration') {
        setOrDeleteString('video_url', getFieldValue('video_url'));
        setOrDeleteString('text', getFieldValue('text'));
        setOrDeleteString('voice', getFieldValue('voice'));
        setOrDeleteString('mode', getFieldValue('mode'));
        setOrDeleteString('sync', getFieldValue('sync'));
        return next;
      }
      if (toolName === 'add_background_music') {
        setOrDeleteString('video_url', getFieldValue('video_url'));
        setOrDeleteString('audio_url', getFieldValue('audio_url'));
        const volumeRaw = String(getFieldValue('volume') || '').trim();
        const volume = volumeRaw ? Number.parseFloat(volumeRaw) : NaN;
        if (Number.isFinite(volume)) next.volume = Math.min(1, Math.max(0, volume));
        const loopRaw = String(getFieldValue('loop') || '').trim();
        next.loop = loopRaw === 'false' ? false : true;
        return next;
      }
      if (toolName === 'merge_videos') {
        const lines = String(getFieldValue('video_urls') || '')
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean);
        next.video_urls = lines;
        setOrDeleteString('transition', getFieldValue('transition'));
        const tdRaw = String(getFieldValue('transition_duration') || '').trim();
        const td = tdRaw ? Number.parseFloat(tdRaw) : NaN;
        if (Number.isFinite(td)) next.transition_duration = td;
        return next;
      }
      return next;
    };

    const send = (payload) => {
      if (window.AgenticAiStudio && typeof window.AgenticAiStudio.sendStudioEdit === 'function') {
        window.AgenticAiStudio.sendStudioEdit(payload);
        return true;
      }
      console.error('AgenticAiStudio.sendStudioEdit is not available');
      return false;
    };

    const cancelBtn = editModalEl.querySelector('.studio-edit-cancel');
    cancelBtn?.addEventListener('click', closeEditModal);

    const submitBtn = editModalEl.querySelector('.studio-edit-submit');
    submitBtn?.addEventListener('click', () => {
      const nextInput = buildNextInput();
      const prompt = (toolName === 'text_to_speech') ? String(nextInput.text || '').trim() : String(nextInput.prompt || '').trim();
      if (toolName === 'generate_image' || toolName === 'generate_video' || toolName === 'generate_music') {
        if (!prompt) {
          alert('Prompt is required.');
          return;
        }
      }
      if (toolName === 'text_to_speech') {
        if (!String(nextInput.text || '').trim()) {
          alert('Text is required.');
          return;
        }
      }
      if (toolName === 'merge_videos') {
        const list = Array.isArray(nextInput.video_urls) ? nextInput.video_urls : [];
        if (list.length < 2) {
          alert('merge_videos requires at least 2 video URLs.');
          return;
        }
      }

      // The Studio edit will spend credits; show an immediate (best-effort) debit before the SSE settles.
      // The navbar will refresh to the authoritative balance after the tool completes.
      optimisticallyDebitCredits(selected.result);

      const ok = send({
        toolName,
        parentToolUseId: String(selected.id || ''),
        input: nextInput,
      });
      if (ok) closeEditModal();
    });
  }

  function regenerateAsset(assetId) {
    const id = String(assetId || '');
    const asset = id ? state.assetsById.get(id) : null;
    const selected = asset ? getSelectedVersion(asset) : null;
    if (!asset || !selected) return;

    const baseInput = isRecord(selected.input) ? selected.input : {};
    const nextInput = (() => {
      try {
        return JSON.parse(JSON.stringify(baseInput));
      } catch {
        return { ...baseInput };
      }
    })();

    // Fallback minimal inputs when we don't have the original tool input.
    if ((!nextInput.prompt || typeof nextInput.prompt !== 'string') && (selected.toolName === 'generate_image' || selected.toolName === 'generate_video' || selected.toolName === 'generate_music')) {
      nextInput.prompt = String(selected.prompt || '').trim();
    }
    if ((!nextInput.text || typeof nextInput.text !== 'string') && selected.toolName === 'text_to_speech') {
      nextInput.text = String(selected.prompt || '').trim();
    }

    if (window.AgenticAiStudio && typeof window.AgenticAiStudio.sendStudioEdit === 'function') {
      // The Studio regen will spend credits; show an immediate (best-effort) debit before the SSE settles.
      // The navbar will refresh to the authoritative balance after the tool completes.
      optimisticallyDebitCredits(selected.result);
      window.AgenticAiStudio.sendStudioEdit({
        toolName: String(selected.toolName || ''),
        parentToolUseId: String(selected.id || ''),
        input: nextInput,
      });
    }
  }

  async function setAssetAsCharacter(assetId) {
    const id = String(assetId || '');
    const asset = id ? state.assetsById.get(id) : null;
    const selected = asset ? getSelectedVersion(asset) : null;
    if (!asset || !selected) return;
    if (selected.mediaType !== 'image') return;

    const imageUrl = selected.url ? String(selected.url) : '';
    if (!imageUrl) return;

    const sessionId = loadSessionId();
    if (!sessionId) {
      alert('Missing AgenticAI sessionId. Start a chat first.');
      return;
    }

    const nameRaw = prompt('Character name:', '');
    const name = typeof nameRaw === 'string' ? nameRaw.trim() : '';
    if (!name) return;

    try {
      const res = await fetch('https://aitopia.ai/api/agenticai/characters/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ sessionId, name, imageUrl }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = json?.error ? String(json.error) : `HTTP ${res.status}`;
        throw new Error(msg);
      }

      const returnedSessionId = typeof json?.sessionId === 'string' ? String(json.sessionId).trim() : '';
      if (returnedSessionId && returnedSessionId !== sessionId) {
        if (window.AgenticAiSession && typeof window.AgenticAiSession.setSessionId === 'function') {
          window.AgenticAiSession.setSessionId(returnedSessionId);
        } else {
          try {
            localStorage.setItem(SESSION_STORAGE_KEY, returnedSessionId);
          } catch {
            // ignore
          }
        }
      }

      alert(`Character "${name}" set. Character Consistency Mode is now enabled.`);
    } catch (err) {
      alert(err?.message ? String(err.message) : String(err));
    }
  }

  function clearAll() {
    state.queueById.clear();
    state.assetsById.clear();
    state.versionsById.clear();
    state.versionToAssetId.clear();
    state.approvalsById.clear();
    state.stickToBottom = true;
    renderEmptyStates();
    schedulePersist();
  }

  function handleActionClick(e) {
    const btn = e.target && e.target.closest ? e.target.closest('button[data-action]') : null;
    if (!btn) return;

    const action = btn.getAttribute('data-action') || '';
    if (action === 'view-tool') {
      const toolUseId = btn.getAttribute('data-tool-use-id') || '';
      jumpToToolNode(toolUseId);
      return;
    }

    if (action === 'view-approval') {
      const approvalNodeId = btn.getAttribute('data-approval-node-id') || '';
      jumpToApprovalNode(approvalNodeId);
      return;
    }

    if (action === 'select-version') {
      const assetId = btn.getAttribute('data-asset-id') || '';
      const versionId = btn.getAttribute('data-version-id') || '';
      const asset = assetId ? state.assetsById.get(assetId) : null;
      if (!asset) return;
      if (!versionId) return;
      asset.selectedVersionId = versionId;
      renderCreations();
      schedulePersist();
      dispatchStudioStateChanged({ reason: 'select_version', assetId, selectedVersionId: versionId });
      return;
    }

    if (action === 'set-character') {
      const assetId = btn.getAttribute('data-asset-id') || '';
      setAssetAsCharacter(assetId);
      return;
    }

    if (action === 'regen-asset') {
      const assetId = btn.getAttribute('data-asset-id') || '';
      regenerateAsset(assetId);
      return;
    }

    if (action === 'edit-asset') {
      const assetId = btn.getAttribute('data-asset-id') || '';
      openEditModal(assetId);
      return;
    }
  }

	  function init() {
    dom.app = document.querySelector('.app');
    dom.paneToggle = document.querySelector('.pane-toggle');
    dom.paneToggleButtons = Array.from(document.querySelectorAll('.pane-toggle-btn'));
    dom.queueItems = document.getElementById('studio-queue-items');
    dom.queueCount = document.getElementById('studio-queue-count');
    dom.creationsItems = document.getElementById('studio-creations-items');
    dom.creationsCount = document.getElementById('studio-creations-count');
    dom.studioScroll = document.querySelector('.pane-studio');
    dom.clearButton = document.getElementById('studio-clear-button');

    if (dom.paneToggleButtons.length) {
      for (const btn of dom.paneToggleButtons) {
        btn.addEventListener('click', () => setActivePane(btn.getAttribute('data-pane') || 'chat'));
      }
      // Ensure buttons reflect initial state
      setActivePane(dom.app?.dataset?.activePane || 'chat');
    }

    if (dom.clearButton) {
      dom.clearButton.addEventListener('click', () => clearAll());
    }

	    dom.queueItems?.addEventListener('click', handleActionClick);
	    dom.creationsItems?.addEventListener('click', handleActionClick);

	    // Media loads can change layout (especially <video>/<audio> metadata) after initial render.
	    // Keep the Studio pinned to bottom when stick-to-bottom is active.
	    const onMediaLayoutChange = () => scheduleScrollToBottom();
	    dom.creationsItems?.addEventListener('load', onMediaLayoutChange, true);
	    dom.creationsItems?.addEventListener('loadedmetadata', onMediaLayoutChange, true);
	    dom.creationsItems?.addEventListener('loadeddata', onMediaLayoutChange, true);
	    dom.queueItems?.addEventListener('load', onMediaLayoutChange, true);
	    dom.queueItems?.addEventListener('loadedmetadata', onMediaLayoutChange, true);
	    dom.queueItems?.addEventListener('loadeddata', onMediaLayoutChange, true);
    dom.studioScroll?.addEventListener('scroll', (e) => {
      const el = dom.studioScroll;
      if (!el) return;
      // Only treat *trusted* scrolls as intent (user moving away from bottom).
      // Programmatic scrolls (autoscroll) should never disable stick-to-bottom.
      if (e && typeof e === 'object' && 'isTrusted' in e && e.isTrusted === false) return;
      state.stickToBottom = isNearBottom(el, 40);
    }, { passive: true });

    // Some embedded media controls can "eat" wheel events, making the pane feel unscrollable.
    // Force wheel to scroll the Studio pane when it can scroll.
    if (dom.studioScroll) {
      dom.studioScroll.addEventListener(
        'wheel',
        (e) => {
          const el = dom.studioScroll;
          if (!el) return;
          if (el.scrollHeight <= el.clientHeight + 1) return;
          const before = el.scrollTop;
          el.scrollTop += e.deltaY;
          if (el.scrollTop !== before) {
            state.stickToBottom = isNearBottom(el, 40);
            e.preventDefault();
          }
        },
        { passive: false, capture: true }
      );
    }

    // Keep Studio pinned to bottom while "stick to bottom" is active, even as images/videos load and expand.
    if (typeof ResizeObserver !== 'undefined' && dom.studioScroll) {
      resizeObserver = new ResizeObserver(() => {
        scheduleScrollToBottom();
      });
      if (dom.queueItems) resizeObserver.observe(dom.queueItems);
      if (dom.creationsItems) resizeObserver.observe(dom.creationsItems);
    }

    restoreFromLocalStorage();
    renderAll();
    loadBillingConfig();
  }

  window.MediaPanel = {
    init,
    onToolEvent,
    onApprovalResolved,
    clearAll,
    getSelectedVersionInfoForToolUseId: (toolUseId) => {
      const id = String(toolUseId || '').trim();
      if (!id) return null;

      const assetId = state.versionToAssetId.get(id);
      if (!assetId) return null;
      const asset = state.assetsById.get(String(assetId));
      if (!asset) return null;

      const selected = getSelectedVersion(asset);
      if (!selected) return null;

      const ids = Array.isArray(asset.versionIds) ? asset.versionIds.map((v) => String(v)).filter(Boolean) : [];
      const selectedId = String(asset.selectedVersionId || selected.id || '');
      const selectedIdx = ids.indexOf(selectedId);
      const originalIdx = ids.indexOf(id);
      const selectedLabel = selectedIdx >= 0 ? `v${selectedIdx + 1}` : '';
      const originalLabel = originalIdx >= 0 ? `v${originalIdx + 1}` : '';

      return {
        assetId: String(asset.assetId || ''),
        originalToolUseId: id,
        originalVersionLabel: originalLabel,
        selectedToolUseId: String(selected.id || ''),
        selectedVersionLabel: selectedLabel,
        url: typeof selected.url === 'string' ? selected.url : '',
        prompt: typeof selected.prompt === 'string' ? selected.prompt : '',
        changed: String(selected.id || '') !== id,
      };
    },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
