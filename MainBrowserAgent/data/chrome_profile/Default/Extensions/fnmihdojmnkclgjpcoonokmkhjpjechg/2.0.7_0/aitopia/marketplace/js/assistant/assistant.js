import { fetchHelper } from '../shared/fetch-helper.js';

const el = {
  messages: document.getElementById('messages'),
  input: document.getElementById('input'),
  sendBtn: document.getElementById('sendBtn'),
  newChatBtn: document.getElementById('newChatBtn'),
  settingsBtn: document.getElementById('settingsBtn'),
  hint: document.getElementById('hint'),
  activityPanel: document.getElementById('activityPanel'),
  activity: document.getElementById('activity'),
  toggleActivity: document.getElementById('toggleActivity'),
  clearActivityBtn: document.getElementById('clearActivityBtn'),
  todoPanel: document.getElementById('todoPanel'),
  todoProgress: document.getElementById('todoProgress'),
  todoList: document.getElementById('todoList'),
};

function uuid() {
  try {
    return crypto.randomUUID();
  } catch {
    return `uuid-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function setHint(message) {
  if (!el.hint) return;
  el.hint.textContent = message || '';
}

function ensureActivityPanelVisible() {
  // Assistant now renders activity inline (AgenticAI-style).
}

function clearActivity() {
  toolNodes.clear();
  renderTodos([]);
}

function appendActivityNode(container, html) {
  if (!container) return;
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  const node = wrapper.firstElementChild;
  if (!node) return null;
  container.appendChild(node);
  container.scrollTop = container.scrollHeight;
  return node;
}

function messageBubble({ role, content, pending = false }) {
  const row = document.createElement('div');
  row.className = role === 'user' ? 'flex justify-end' : 'flex justify-start';

  if (role === 'user') {
    row.innerHTML = `
      <div class="max-w-[85%] rounded-ios-2xl bg-primary text-primary-foreground px-4 py-3 text-sm whitespace-pre-wrap break-words">
        ${escapeHtml(content)}
      </div>
    `;
    return row;
  }

  row.innerHTML = `
    <div class="w-full space-y-2">
      <div class="assistant-activity space-y-2"></div>
      <div class="assistant-bubble rounded-ios-2xl border border-border bg-background/40 px-4 py-3 text-sm whitespace-pre-wrap break-words">
        <div class="flex items-center gap-2 mb-2">
          <div class="w-6 h-6 rounded-full bg-gradient-to-br from-primary/90 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">✨</div>
          <div class="text-xs text-muted-foreground">${pending ? 'Thinking…' : 'Assistant'}</div>
        </div>
        <div class="assistant-content">${escapeHtml(content)}</div>
        <details class="assistant-thinking hidden mt-2 rounded-ios-xl border border-border bg-secondary/20 px-3 py-2">
          <summary class="cursor-pointer select-none text-xs text-muted-foreground">Thinking (stream)</summary>
          <pre class="assistant-thinking-content mt-2 text-xs text-muted-foreground whitespace-pre-wrap break-words"></pre>
        </details>
        <div class="assistant-meta text-xs text-muted-foreground mt-2"></div>
      </div>
    </div>
  `;
  return row;
}

function appendMessage(role, content, { pending = false } = {}) {
  if (!el.messages) return null;
  const node = messageBubble({ role, content, pending });
  el.messages.appendChild(node);
  el.messages.scrollTop = el.messages.scrollHeight;
  return node;
}

function setAssistantContent(node, content, { pendingLabel } = {}) {
  const label = node?.querySelector?.('.text-xs.text-muted-foreground');
  if (label && typeof pendingLabel === 'string') label.textContent = pendingLabel;
  const contentEl = node?.querySelector?.('.assistant-content');
  if (contentEl) contentEl.textContent = content;
  if (el.messages) el.messages.scrollTop = el.messages.scrollHeight;
}

function setAssistantMeta(node, meta) {
  const metaEl = node?.querySelector?.('.assistant-meta');
  if (metaEl) metaEl.textContent = meta ? String(meta) : '';
}

function ensureAssistantActions(node) {
  if (!node) return null;
  const bubble = node.querySelector?.('.assistant-bubble');
  if (!bubble) return null;
  let actions = bubble.querySelector('.assistant-actions');
  if (!actions) {
    actions = document.createElement('div');
    actions.className = 'assistant-actions mt-2 flex flex-wrap gap-2';
    bubble.appendChild(actions);
  }
  actions.innerHTML = '';
  return actions;
}

function setAssistantThinking(node, thinkingText, { open } = {}) {
  const details = node?.querySelector?.('.assistant-thinking');
  const contentEl = node?.querySelector?.('.assistant-thinking-content');
  if (!details || !contentEl) return;
  const text = String(thinkingText || '').trim();
  if (!text) {
    details.classList.add('hidden');
    contentEl.textContent = '';
    return;
  }
  details.classList.remove('hidden');
  if (typeof open === 'boolean') details.open = open;
  contentEl.textContent = text;
  if (el.messages) el.messages.scrollTop = el.messages.scrollHeight;
}

async function* sseEvents(res, signal) {
  const reader = res.body?.getReader?.();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    if (signal?.aborted) return;
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const raw = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);

      const trimmed = raw.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith(':')) continue; // keep-alive

      const lines = raw.split('\n');
      let eventType = '';
      const dataLines = [];
      for (const line of lines) {
        if (line.startsWith('event:')) eventType = line.slice('event:'.length).trim();
        if (line.startsWith('data:')) dataLines.push(line.slice('data:'.length).trim());
      }
      const dataStr = dataLines.join('\n');
      if (!dataStr) continue;

      let parsed = null;
      try {
        parsed = JSON.parse(dataStr);
      } catch {
        parsed = { type: eventType, data: { raw: dataStr } };
      }

      yield { eventType, payload: parsed };
    }
  }
}

const conversationHistory = [];
const toolNodes = new Map(); // callId -> element
let activeController = null;
let supervisorPolicy = null;
let supervisorOptions = null;
const MAX_CONVERSATION_HISTORY = 50;

function pushHistory(role, content) {
  conversationHistory.push({ role, content: content || '' });
  while (conversationHistory.length > MAX_CONVERSATION_HISTORY) {
    conversationHistory.shift();
  }
}

const UI_PREFS_KEY = 'assistant.superagent.prefs.v2';
const LEGACY_UI_PREFS_KEY = 'assistant.superagent.prefs.v1';

function normalizeTier(value) {
  const t = String(value || '').trim().toLowerCase();
  if (t === 'free' || t === 'starter' || t === 'pro' || t === 'enterprise') return t;
  return 'starter';
}

function loadUiPrefs() {
  try {
    const raw = localStorage.getItem(UI_PREFS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object') {
      const models = parsed?.models && typeof parsed.models === 'object' ? parsed.models : {};
      const video = models?.video && typeof models.video === 'object' ? models.video : {};
      const image = models?.image && typeof models.image === 'object' ? models.image : {};
      const voice = models?.voice && typeof models.voice === 'object' ? models.voice : {};
      const llm = models?.llm && typeof models.llm === 'object' ? models.llm : {};
      const budgets = parsed?.budgets && typeof parsed.budgets === 'object' ? parsed.budgets : {};
      const creative = parsed?.creative && typeof parsed.creative === 'object' ? parsed.creative : {};
      const creativeCharacter = creative?.character && typeof creative.character === 'object' ? creative.character : {};

      const maxTaskCreditsRaw = budgets?.maxTaskCredits;
      const maxTaskCreditsNum = Number(maxTaskCreditsRaw);
      const maxTaskCredits =
        Number.isFinite(maxTaskCreditsNum) && maxTaskCreditsNum > 0 ? Math.floor(maxTaskCreditsNum) : null;

      const warnAtPercentRaw = budgets?.warnAtPercent;
      const warnAtPercentNum = Number(warnAtPercentRaw);
      const warnAtPercent =
        Number.isFinite(warnAtPercentNum) ? Math.max(1, Math.min(99, Math.round(warnAtPercentNum))) : 80;

      const maxByModelCreditsJson =
        typeof budgets?.maxByModelCreditsJson === 'string' ? budgets.maxByModelCreditsJson : '';

      return {
        userTier: normalizeTier(parsed?.userTier),
        models: {
          llm: { modelId: typeof llm?.modelId === 'string' ? llm.modelId : '' },
          video: {
            selectedModelId: typeof video.selectedModelId === 'string' ? video.selectedModelId : '',
            preferredProvider: typeof video.preferredProvider === 'string' ? video.preferredProvider : '',
          },
          image: {
            selectedModelId: typeof image.selectedModelId === 'string' ? image.selectedModelId : '',
            preferredProvider: typeof image.preferredProvider === 'string' ? image.preferredProvider : '',
          },
          voice: {
            selectedModelId: typeof voice.selectedModelId === 'string' ? voice.selectedModelId : '',
            preferredProvider: typeof voice.preferredProvider === 'string' ? voice.preferredProvider : '',
          },
        },
        budgets: { maxTaskCredits, warnAtPercent, maxByModelCreditsJson },
        creative: {
          styleDirective: typeof creative?.styleDirective === 'string' ? creative.styleDirective : '',
          character: {
            name: typeof creativeCharacter?.name === 'string' ? creativeCharacter.name : '',
            description: typeof creativeCharacter?.description === 'string' ? creativeCharacter.description : '',
            referenceImageUrl: typeof creativeCharacter?.referenceImageUrl === 'string' ? creativeCharacter.referenceImageUrl : '',
          },
        },
      };
    }

    const legacyRaw = localStorage.getItem(LEGACY_UI_PREFS_KEY);
    const legacy = legacyRaw ? JSON.parse(legacyRaw) : null;
    const legacyTier = normalizeTier(legacy?.userTier);
    const legacyVideo = legacy?.video && typeof legacy.video === 'object' ? legacy.video : {};
    return {
      userTier: legacyTier,
      models: {
        llm: { modelId: '' },
        video: {
          selectedModelId: typeof legacyVideo.selectedModelId === 'string' ? legacyVideo.selectedModelId : '',
          preferredProvider: typeof legacyVideo.preferredProvider === 'string' ? legacyVideo.preferredProvider : '',
        },
        image: { selectedModelId: '', preferredProvider: '' },
        voice: { selectedModelId: '', preferredProvider: '' },
      },
      budgets: { maxTaskCredits: null, warnAtPercent: 80, maxByModelCreditsJson: '' },
      creative: { styleDirective: '', character: { name: '', description: '', referenceImageUrl: '' } },
    };
  } catch {
    return {
      userTier: 'starter',
      models: {
        llm: { modelId: '' },
        video: { selectedModelId: '', preferredProvider: '' },
        image: { selectedModelId: '', preferredProvider: '' },
        voice: { selectedModelId: '', preferredProvider: '' },
      },
      budgets: { maxTaskCredits: null, warnAtPercent: 80, maxByModelCreditsJson: '' },
      creative: { styleDirective: '', character: { name: '', description: '', referenceImageUrl: '' } },
    };
  }
}

function saveUiPrefs(next) {
  localStorage.setItem(UI_PREFS_KEY, JSON.stringify(next));
  return next;
}

let uiPrefs = loadUiPrefs();

function safeJsonStringify(value, maxLen) {
  try {
    const json = JSON.stringify(value ?? null, null, 2);
    if (typeof maxLen === 'number' && json.length > maxLen) return `${json.slice(0, maxLen)}…`;
    return json;
  } catch {
    return String(value ?? '');
  }
}

async function apiJson(path, options = {}) {
  const res = await fetchHelper(path, {
    headers: { Accept: 'application/json', ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

let billingConfig = { billingMode: 'unknown', usdPerCredit: 0.02 };
let billingConfigPromise = null;

async function loadBillingConfig(options = {}) {
  if (billingConfigPromise && !options.force) return billingConfigPromise;
  billingConfigPromise = apiJson('https://aitopia.ai/api/config/billing')
    .then((cfg) => {
      if (cfg && typeof cfg === 'object') {
        const mode = typeof cfg.billingMode === 'string' ? cfg.billingMode : billingConfig.billingMode;
        const usdPerCredit = Number(cfg.usdPerCredit);
        billingConfig = {
          billingMode: mode,
          usdPerCredit: Number.isFinite(usdPerCredit) && usdPerCredit > 0 ? usdPerCredit : billingConfig.usdPerCredit,
        };
      }
      return billingConfig;
    })
    .catch(() => billingConfig)
    .finally(() => {
      billingConfigPromise = null;
    });
  return billingConfigPromise;
}

function isCreditsMode() {
  return billingConfig?.billingMode === 'credits';
}

function creditsFromUsd(costUsd) {
  const usd = Number(costUsd);
  if (!Number.isFinite(usd) || usd <= 0) return 0;
  const usdPerCredit = Number(billingConfig?.usdPerCredit) || 0.02;
  if (!Number.isFinite(usdPerCredit) || usdPerCredit <= 0) return 0;
  return Math.max(1, Math.ceil(usd / usdPerCredit));
}

function formatCost(costUsd, options = {}) {
  const usd = Number(costUsd);
  if (!Number.isFinite(usd) || usd <= 0) return '';

  const approx = options.approx === true;
  const credits = creditsFromUsd(usd);

  if (isCreditsMode()) {
    const creditLabel = `${approx ? '~' : ''}${credits} credits`;
    return options.includeUsd === false ? creditLabel : `${creditLabel} (${formatUsd(usd)})`;
  }

  return `${approx ? '~' : ''}${formatUsd(usd)}`;
}

function getMediaTypeFromUrl(url) {
  if (typeof url !== 'string') return null;
  const cleaned = url.split('?')[0].split('#')[0].toLowerCase();
  if (/\.(png|jpg|jpeg|webp|gif)$/.test(cleaned)) return 'image';
  if (/\.(mp4|webm|mov)$/.test(cleaned)) return 'video';
  if (/\.(mp3|wav|m4a|ogg)$/.test(cleaned)) return 'audio';
  return null;
}

function renderMediaPreview(output) {
  const urls = [];
  if (typeof output === 'string') {
    urls.push(output);
  } else if (Array.isArray(output)) {
    for (const item of output) {
      if (typeof item === 'string') urls.push(item);
    }
  }

  const mediaUrls = urls
    .map((u) => ({ url: u, type: getMediaTypeFromUrl(u) }))
    .filter((u) => u.type !== null)
    .slice(0, 12);

  if (mediaUrls.length === 0) return '';

  const parts = [];
  for (const item of mediaUrls) {
    const safeUrl = escapeHtml(item.url);
    const media = item.type === 'image'
      ? `<img src="${safeUrl}" alt="Generated image" class="w-full rounded-ios-xl border border-border bg-secondary/10 object-contain max-h-[420px]" />`
      : item.type === 'video'
        ? `<video src="${safeUrl}" controls class="w-full rounded-ios-xl border border-border bg-secondary/10 max-h-[420px]"></video>`
        : `<audio src="${safeUrl}" controls class="w-full"></audio>`;

    parts.push(`
      <div class="space-y-1">
        ${media}
        <div class="text-xs text-muted-foreground">
          <a class="underline hover:no-underline" href="${safeUrl}" target="_blank" rel="noopener">Open</a>
        </div>
      </div>
    `);
  }

  return `<div class="space-y-2">${parts.join('')}</div>`;
}

async function loadSupervisorPolicy() {
  supervisorPolicy = await apiJson('https://aitopia.ai/api/policies/superagent');
  return supervisorPolicy;
}

async function loadSupervisorOptions() {
  supervisorOptions = await apiJson('https://aitopia.ai/api/policies/superagent/options');
  return supervisorOptions;
}

function showToast(message) {
  const node = document.createElement('div');
  node.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-ios-xl border border-border bg-card px-4 py-3 text-sm shadow-lg';
  node.textContent = message;
  document.body.appendChild(node);
  setTimeout(() => node.remove(), 2800);
}

function renderTodos(todos) {
  if (!el.todoPanel || !el.todoList || !el.todoProgress) return;
  const list = Array.isArray(todos) ? todos : [];
  if (list.length === 0) {
    el.todoPanel.classList.add('hidden');
    el.todoList.innerHTML = '';
    el.todoProgress.textContent = '';
    return;
  }

  const completed = list.filter((t) => t && t.status === 'completed').length;
  el.todoProgress.textContent = `${completed}/${list.length}`;
  el.todoPanel.classList.remove('hidden');

  el.todoList.innerHTML = list
    .map((todo) => {
      const status = todo?.status || 'pending';
      const icon = status === 'completed' ? '●' : status === 'in_progress' ? '◐' : '○';
      const costUsd = typeof todo?.estimatedCostUsd === 'number' ? todo.estimatedCostUsd : null;
      const cost = typeof costUsd === 'number' ? formatCost(costUsd, { approx: true, includeUsd: false }) : '';
      return `
        <div class="flex items-start gap-3 rounded-ios-xl border border-border bg-background/40 px-3 py-2">
          <div class="mt-0.5 text-xs text-muted-foreground">${icon}</div>
          <div class="min-w-0 flex-1">
            <div class="text-sm break-words">${escapeHtml(todo?.title || '')}</div>
            ${todo?.tool ? `<div class="text-xs text-muted-foreground mt-0.5">tool: ${escapeHtml(todo.tool)}</div>` : ''}
          </div>
          ${cost ? `<div class="text-xs text-muted-foreground whitespace-nowrap">${escapeHtml(cost)}</div>` : ''}
        </div>
      `;
    })
    .join('');
}

function getAssistantActivityContainer(node) {
  if (!node) return null;
  const container = node.querySelector?.('.assistant-activity');
  return container instanceof HTMLElement ? container : null;
}

function renderTodosInline(todos) {
  const list = Array.isArray(todos) ? todos : [];
  if (list.length === 0) return '<div class="text-xs text-muted-foreground">No steps.</div>';
  return `
    <div class="space-y-2">
      ${list
        .slice(0, 60)
        .map((todo) => {
          const status = todo?.status || 'pending';
          const icon =
            status === 'completed'
              ? '<span class="inline-block h-2.5 w-2.5 rounded-full bg-primary"></span>'
              : status === 'in_progress'
                ? '<span class="inline-block h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin"></span>'
                : '<span class="inline-block h-2.5 w-2.5 rounded-full border border-muted-foreground/60"></span>';
          const costUsd = typeof todo?.estimatedCostUsd === 'number' ? todo.estimatedCostUsd : null;
          const cost = typeof costUsd === 'number' ? formatCost(costUsd, { approx: true }) : '';
          return `
            <div class="flex items-start gap-3 rounded-ios-xl border border-border bg-secondary/20 px-3 py-2">
              <div class="mt-1 flex items-center justify-center w-4">${icon}</div>
              <div class="min-w-0 flex-1">
                <div class="text-sm break-words">${escapeHtml(todo?.title || '')}</div>
                ${todo?.tool ? `<div class="text-xs text-muted-foreground mt-0.5">tool: ${escapeHtml(todo.tool)}</div>` : ''}
              </div>
              ${cost ? `<div class="text-xs text-muted-foreground whitespace-nowrap">${escapeHtml(cost)}</div>` : ''}
            </div>
          `;
        })
        .join('')}
    </div>
  `;
}

function addToolCall(callId, name, input, options = {}) {
  const safeName = escapeHtml(name || 'tool');
  const inputPreview = safeJsonStringify(input, 1200);
  const container = options?.container || el.activity;

  const toolHint = (() => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return '';
    if (name === 'enter_plan_mode' && typeof input.reason === 'string') return String(input.reason).trim();
    if (name === 'submit_plan' && typeof input.summary === 'string') return String(input.summary).trim();
    if (name === 'update_todos' && Array.isArray(input.todos)) return `${input.todos.length} step${input.todos.length === 1 ? '' : 's'}`;
    if (name === 'generate_images' && typeof input.count === 'number') return `${input.count} image${input.count === 1 ? '' : 's'}`;
    if (name === 'generate_image' && typeof input.prompt === 'string') return String(input.prompt).trim();
    if (name === 'generate_video' && typeof input.durationSeconds === 'number') return `${input.durationSeconds}s video`;
    if (name === 'text_to_speech' && input.input && typeof input.input === 'object' && typeof input.input.text === 'string') {
      return String(input.input.text).trim();
    }
    return '';
  })();

  const node = appendActivityNode(
    container,
    `
      <div class="assistant-node rounded-ios-xl border border-border bg-background/40 overflow-hidden" data-call-id="${escapeHtml(callId)}">
        <button type="button" class="assistant-node-header w-full text-left px-3 py-2 flex items-center justify-between gap-3">
          <div class="min-w-0 flex items-start gap-2">
            <div class="mt-1.5 h-2 w-2 rounded-full bg-primary/70 flex-shrink-0"></div>
            <div class="min-w-0">
              <div class="font-semibold text-sm truncate">${safeName}</div>
              ${toolHint ? `<div class="text-xs text-muted-foreground truncate">${escapeHtml(toolHint)}</div>` : ''}
            </div>
          </div>
          <div class="flex items-center gap-2 flex-shrink-0">
            <div class="assistant-node-status text-[11px] font-semibold rounded-full border border-border bg-secondary/30 px-2 py-0.5 text-muted-foreground flex items-center gap-1">
              <span class="assistant-node-spinner inline-block h-3 w-3 rounded-full border-2 border-muted-foreground border-t-transparent animate-spin"></span>
              <span class="assistant-node-status-text">Running</span>
            </div>
            <div class="assistant-node-toggle text-xs text-muted-foreground transition-transform -rotate-90">▼</div>
          </div>
        </button>
        <div class="assistant-node-body hidden border-t border-border px-3 py-2 space-y-2">
          <div class="grid grid-cols-[34px,1fr] gap-2 items-start">
            <div class="text-[11px] font-bold tracking-wider text-muted-foreground">IN</div>
            <pre class="assistant-node-in text-xs text-muted-foreground whitespace-pre-wrap break-words bg-secondary/20 border border-border rounded-ios-xl px-3 py-2 max-h-48 overflow-auto"><code>${escapeHtml(inputPreview)}</code></pre>
          </div>
          <div class="grid grid-cols-[34px,1fr] gap-2 items-start">
            <div class="text-[11px] font-bold tracking-wider text-muted-foreground">OUT</div>
            <div class="assistant-node-out text-xs text-muted-foreground bg-secondary/20 border border-border rounded-ios-xl px-3 py-2 max-h-48 overflow-auto">—</div>
          </div>
        </div>
      </div>
    `
  );

  if (node) {
    node.dataset.toolName = String(name || '');
    toolNodes.set(callId, node);
    const header = node.querySelector?.('.assistant-node-header');
    const body = node.querySelector?.('.assistant-node-body');
    const toggle = node.querySelector?.('.assistant-node-toggle');
    header?.addEventListener('click', () => {
      if (!body) return;
      body.classList.toggle('hidden');
      toggle?.classList.toggle('-rotate-90');
    });
  }
}

function updateToolResult(callId, result, isError) {
  const node = toolNodes.get(callId);
  const toolName = node?.dataset?.toolName || '';
  const statusEl = node?.querySelector?.('.assistant-node-status');
  const statusTextEl = statusEl?.querySelector?.('.assistant-node-status-text');
  const statusSpinnerEl = statusEl?.querySelector?.('.assistant-node-spinner');
  const statusText = isError ? 'error' : 'done';
  const actualCostUsd = typeof result?.usage?.costUsd === 'number' ? result.usage.costUsd : null;
  const estimatedCostUsd = typeof result?.result?.model?.estimatedCostUsd === 'number' ? result.result.model.estimatedCostUsd : null;
  const costUsd = actualCostUsd ?? estimatedCostUsd;
  const isEstimate = actualCostUsd === null && estimatedCostUsd !== null;
  if (statusEl) {
    const label = typeof costUsd === 'number' && Number.isFinite(costUsd) && costUsd > 0
      ? formatCost(costUsd, { approx: isEstimate, includeUsd: true })
      : '';
    if (statusSpinnerEl) statusSpinnerEl.classList.add('hidden');
    if (statusTextEl) statusTextEl.textContent = label ? `${statusText} • ${label}` : statusText;
    statusEl.classList.remove('text-muted-foreground', 'bg-secondary/30', 'text-red-500', 'bg-red-500/10', 'text-green-500', 'bg-green-500/10');
    statusEl.classList.add(isError ? 'text-red-500' : 'text-green-500');
    statusEl.classList.add(isError ? 'bg-red-500/10' : 'bg-green-500/10');
  }

  const outEl = node?.querySelector?.('.assistant-node-out');
  let shouldAutoExpand = false;
  if (outEl) {
    if (!isError && toolName === 'update_todos') {
      const todos = result?.todos || result?.result?.todos;
      outEl.innerHTML = renderTodosInline(todos);
    } else {
      const raw = safeJsonStringify(result, 3000);
      const output = result?.result?.output ?? result?.output;
      const media = renderMediaPreview(output);
      if (media) {
        shouldAutoExpand = true;
        outEl.innerHTML = `
          <div class="space-y-2">
            ${media}
            <details class="rounded-ios-xl border border-border bg-secondary/10 px-3 py-2">
              <summary class="cursor-pointer text-xs font-semibold text-muted-foreground">Raw output</summary>
              <pre class="mt-2 text-xs text-muted-foreground whitespace-pre-wrap break-words"><code>${escapeHtml(raw)}</code></pre>
            </details>
          </div>
        `;
      } else {
        outEl.textContent = raw;
      }
      if (isError) outEl.classList.add('text-red-500');
    }
  }

  if (node && (isError || shouldAutoExpand)) {
    const body = node.querySelector?.('.assistant-node-body');
    const toggle = node.querySelector?.('.assistant-node-toggle');
    if (body?.classList.contains('hidden')) {
      body.classList.remove('hidden');
      toggle?.classList.remove('-rotate-90');
    }
  }

  // Special rendering for planning checkpoints.
  if (!isError && toolName === 'update_todos') {
    const todos = result?.todos || result?.result?.todos;
    renderTodos(todos);
  }
}

function removeModal(id) {
  const existing = document.getElementById(id);
  if (existing) existing.remove();
}

function showModal({ id, title, bodyHtml, actionsHtml }) {
  removeModal(id);
  const overlay = document.createElement('div');
  overlay.id = id;
  overlay.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4';
  overlay.innerHTML = `
    <div class="w-full max-w-2xl rounded-ios-2xl border border-border bg-card shadow-xl overflow-hidden">
      <div class="p-4 border-b border-border flex items-center justify-between gap-3">
        <div class="font-semibold">${escapeHtml(title)}</div>
        <button data-close type="button" class="h-9 px-4 rounded-full bg-secondary hover:bg-secondary/80 text-sm font-semibold transition-colors">Close</button>
      </div>
      <div class="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
        ${bodyHtml || ''}
      </div>
      <div class="p-4 border-t border-border flex items-center justify-end gap-2">
        ${actionsHtml || ''}
      </div>
    </div>
  `;
  overlay.addEventListener('click', (e) => {
    const target = e.target;
    if (target === overlay) removeModal(id);
    if (target?.dataset?.close !== undefined) removeModal(id);
  });
  document.body.appendChild(overlay);
  return overlay;
}

function formatUsd(usd) {
  const v = Number(usd);
  if (!Number.isFinite(v) || v <= 0) return '$0';
  if (v < 0.01) return `$${v.toFixed(4)}`;
  if (v < 0.1) return `$${v.toFixed(3)}`;
  return `$${v.toFixed(2)}`;
}

function clampRange(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return { min: value, likely: value, max: value };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { min: 0, likely: 0, max: 0 };
  const min = Number(value.min);
  const likely = Number(value.likely);
  const max = Number(value.max);
  if (Number.isFinite(min) && Number.isFinite(likely) && Number.isFinite(max)) {
    return { min: Math.max(0, min), likely: Math.max(0, likely), max: Math.max(0, max) };
  }
  return { min: 0, likely: 0, max: 0 };
}

function parseFirstNumber(text) {
  const match = String(text || '').match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}

function inferPlanQuantities(planInput) {
  const todos = Array.isArray(planInput?.todos) ? planInput.todos : [];
  const steps = Array.isArray(planInput?.steps) ? planInput.steps : [];
  const topPlanned = Array.isArray(planInput?.plannedToolCalls) ? planInput.plannedToolCalls : [];

  const sum = (a, b) => ({ min: a.min + b.min, likely: a.likely + b.likely, max: a.max + b.max });
  let imageOutputs = { min: 0, likely: 0, max: 0 };
  let videoRuns = { min: 0, likely: 0, max: 0 };
  let videoSeconds = { min: 0, likely: 0, max: 0 };
  let voiceRuns = { min: 0, likely: 0, max: 0 };
  let voiceSeconds = { min: 0, likely: 0, max: 0 };

  const addSeconds = (count, secondsRange) => ({
    min: count.min * secondsRange.min,
    likely: count.likely * secondsRange.likely,
    max: count.max * secondsRange.max,
  });

  const parseRangeFromAny = (value) => {
    if (typeof value === 'number' && Number.isFinite(value)) return { min: value, likely: value, max: value };
    if (typeof value === 'string') {
      const text = value.trim();
      const triple = text.match(/(\d+)\s*\/\s*(\d+)\s*\/\s*(\d+)/);
      if (triple) return { min: Number(triple[1]), likely: Number(triple[2]), max: Number(triple[3]) };
      const range = text.match(/(\d+)\s*-\s*(\d+)/);
      if (range) {
        const a = Number(range[1]);
        const b = Number(range[2]);
        return { min: Math.min(a, b), likely: Math.round((a + b) / 2), max: Math.max(a, b) };
      }
      const n = parseFirstNumber(text);
      if (n && n > 0) return { min: n, likely: n, max: n };
      return null;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const r = clampRange(value);
      return r.min > 0 || r.likely > 0 || r.max > 0 ? r : null;
    }
    return null;
  };

  const applyPlannedCall = (toolName, countRange, secondsRange) => {
    if (!toolName || !countRange) return;
    if (toolName === 'generate_image' || toolName === 'generate_images') {
      imageOutputs = sum(imageOutputs, countRange);
      return;
    }
    if (toolName === 'generate_video') {
      videoRuns = sum(videoRuns, countRange);
      if (secondsRange) videoSeconds = sum(videoSeconds, addSeconds(countRange, secondsRange));
      return;
    }
    if (toolName === 'text_to_speech') {
      voiceRuns = sum(voiceRuns, countRange);
      if (secondsRange) voiceSeconds = sum(voiceSeconds, addSeconds(countRange, secondsRange));
    }
  };

  let usedStructured = false;
  const structuredBatches = [
    ...topPlanned,
    ...steps.flatMap((s) => {
      if (!s || typeof s !== 'object') return [];
      const planned = (s.planned_tool_calls || s.plannedToolCalls || s.plannedTools || s.tool_calls || s.toolCalls) ?? [];
      return Array.isArray(planned) ? planned : [];
    }),
  ];

  for (const call of structuredBatches) {
    if (!call || typeof call !== 'object') continue;
    const toolName = String(call.tool || call.name || call.toolName || '').trim();
    if (!toolName) continue;

    const countRange = parseRangeFromAny(call.count ?? call.times ?? call.n ?? call.x ?? 1) || { min: 1, likely: 1, max: 1 };
    const secondsRange = parseRangeFromAny(call.secondsRange ?? call.seconds ?? call.durationSeconds ?? call.duration_seconds ?? call.duration);
    applyPlannedCall(toolName, countRange, secondsRange);
    usedStructured = true;
  }

  if (!usedStructured) {
    for (const todo of todos) {
      const title = String(todo?.title || '');
      const lower = title.toLowerCase();
      const tool = typeof todo?.tool === 'string' ? todo.tool : '';
      const toolName =
        tool ||
        (lower.includes('text to speech') || lower.includes('tts') || lower.includes('voiceover') || lower.includes('narration')
          ? 'text_to_speech'
          : lower.includes('video')
            ? 'generate_video'
            : lower.includes('image')
              ? 'generate_image'
              : '');

      if (!toolName) continue;

      const count = (() => {
        const m = title.match(/(?:^|\s)(\d+)\s*(?:x|\b)/i);
        if (m) return Math.max(1, Number(m[1]));
        const n = parseFirstNumber(title);
        return n && n > 0 ? Math.max(1, Math.floor(n)) : 1;
      })();
      const countRange = { min: count, likely: count, max: count };

      const secondsRange = (() => {
        const triple = title.match(/(\d+)\s*\/\s*(\d+)\s*\/\s*(\d+)/);
        if (triple) return { min: Number(triple[1]), likely: Number(triple[2]), max: Number(triple[3]) };
        const range = title.match(/(\d+)\s*-\s*(\d+)\s*(?:seconds|secs|s)\b/i);
        if (range) {
          const a = Number(range[1]);
          const b = Number(range[2]);
          return { min: Math.min(a, b), likely: Math.round((a + b) / 2), max: Math.max(a, b) };
        }
        const single = title.match(/(\d+)\s*(?:seconds|secs|s)\b/i);
        if (single) {
          const s = Number(single[1]);
          return { min: s, likely: s, max: s };
        }
        return null;
      })();

      applyPlannedCall(toolName, countRange, secondsRange);
    }
  }

  if (voiceRuns.likely > 0 && voiceSeconds.likely === 0 && videoSeconds.likely > 0) {
    voiceSeconds = { ...videoSeconds };
  }

  return { imageOutputs, videoRuns, videoSeconds, voiceRuns, voiceSeconds };
}

function estimateSelectorCostRangeUsd({ selector, model, quantities }) {
  const cost = model?.cost || {};
  const perOutput = Number(cost?.perOutput);
  const perSecond = Number(cost?.perSecond);

  const mul = (usdPerUnit, range) => ({
    min: Math.max(0, usdPerUnit) * Math.max(0, range.min),
    likely: Math.max(0, usdPerUnit) * Math.max(0, range.likely),
    max: Math.max(0, usdPerUnit) * Math.max(0, range.max),
  });

  if (selector === 'image') {
    return Number.isFinite(perOutput) ? mul(perOutput, quantities.imageOutputs) : { min: 0, likely: 0, max: 0 };
  }

  if (selector === 'video') {
    if (Number.isFinite(perSecond) && quantities.videoSeconds.likely > 0) return mul(perSecond, quantities.videoSeconds);
    return Number.isFinite(perOutput) ? mul(perOutput, quantities.videoRuns) : { min: 0, likely: 0, max: 0 };
  }

  if (selector === 'voice') {
    if (Number.isFinite(perSecond) && quantities.voiceSeconds.likely > 0) return mul(perSecond, quantities.voiceSeconds);
    return Number.isFinite(perOutput) ? mul(perOutput, quantities.voiceRuns) : { min: 0, likely: 0, max: 0 };
  }

  return { min: 0, likely: 0, max: 0 };
}

function formatCostRange(range) {
  const r = clampRange(range);
  if (isCreditsMode()) {
    const usdPerCredit = Number(billingConfig?.usdPerCredit) || 0.02;
    const toCredits = (usd) => (usdPerCredit > 0 ? Math.max(1, Math.ceil(Math.max(0, usd) / usdPerCredit)) : 0);
    return {
      min: `${toCredits(r.min)} credits (${formatUsd(r.min)})`,
      likely: `${toCredits(r.likely)} credits (${formatUsd(r.likely)})`,
      max: `${toCredits(r.max)} credits (${formatUsd(r.max)})`,
    };
  }
  return { min: formatUsd(r.min), likely: formatUsd(r.likely), max: formatUsd(r.max) };
}

function buildApprovalModelOptions({ models, selectedId, selector, quantities }) {
  const recommended = models.find((m) => m?.recommended) || models[0] || null;
  const recLabel = recommended ? String(recommended?.displayName || recommended?.id || '').trim() : '';
  const recCost = recommended ? estimateSelectorCostRangeUsd({ selector, model: recommended, quantities }) : { min: 0, likely: 0, max: 0 };
  const recSuffix = recCost.likely > 0 ? ` — ${formatCost(recCost.likely)}` : '';
  const options = [
    `<option value="" ${!selectedId ? 'selected' : ''}>Auto${recLabel ? ` (recommended: ${escapeHtml(recLabel)}${escapeHtml(recSuffix)})` : ' (recommended)'}</option>`,
  ];
  for (const m of models) {
    const id = String(m?.id || '');
    const label = String(m?.displayName || id);
    const provider = String(m?.provider || '');
    const selected = selectedId === id ? 'selected' : '';
    const cost = estimateSelectorCostRangeUsd({ selector, model: m, quantities });
    const suffix = cost.likely > 0 ? ` — ${formatCost(cost.likely)}` : '';
    options.push(`<option value="${escapeHtml(id)}" ${selected}>${escapeHtml(label)}${escapeHtml(suffix)}${provider ? ` (${escapeHtml(provider)})` : ''}</option>`);
  }
  options.push('<option value="__other__">Other…</option>');
  return options.join('');
}

async function showApprovalModal({ approvalId, runId, assistantNode, planningCostUsd }) {
  await loadBillingConfig().catch(() => {});

  const approval = await apiJson(`https://aitopia.ai/api/approvals/user/${encodeURIComponent(approvalId)}`);
  const a = approval?.approval;
  const action = a?.action || {};
  const input = action?.input || {};
  const riskFactors = Array.isArray(a?.riskFactors) ? a.riskFactors : [];

  const toolName = action?.toolName || 'tool';
  const toolDesc = action?.description || '';

  const container = getAssistantActivityContainer(assistantNode) || el.activity;
  if (!container) {
    showToast('Approval UI unavailable: no container');
    return;
  }

  const card = document.createElement('div');
  card.className = 'rounded-ios-2xl border border-border bg-background/40 p-3 space-y-3';
  card.dataset.approvalId = String(approvalId || '');

  card.innerHTML = `
    <div class="flex items-center justify-between gap-3">
      <div class="min-w-0">
        <div class="text-sm font-semibold">${escapeHtml(toolName === 'submit_plan' ? 'Plan approval required' : 'Approval required')}</div>
        <div class="text-xs text-muted-foreground mt-1">Risk level: ${escapeHtml(a?.riskLevel || 'unknown')}</div>
      </div>
      <div class="text-xs text-muted-foreground">Approval</div>
    </div>
  `;

  if (toolName === 'submit_plan') {
    const summary = typeof input?.summary === 'string' ? input.summary : '';
    const risks = Array.isArray(input?.risks) ? input.risks.filter((r) => typeof r === 'string').slice(0, 20) : [];
    const todos = Array.isArray(input?.todos) ? input.todos : [];

    const quantities = inferPlanQuantities(input);
    const tierQuery = isCreditsMode() ? '' : (uiPrefs?.userTier ? `&tier=${encodeURIComponent(uiPrefs.userTier)}` : '');
    const [videoModels, imageModels, voiceModels] = await Promise.all([
      apiJson(`https://aitopia.ai/api/models?capability=video-generation${tierQuery}`).then((r) => (Array.isArray(r?.models) ? r.models : [])).catch(() => []),
      apiJson(`https://aitopia.ai/api/models?capability=image-generation${tierQuery}`).then((r) => (Array.isArray(r?.models) ? r.models : [])).catch(() => []),
      apiJson(`https://aitopia.ai/api/models?capability=text-to-speech${tierQuery}`).then((r) => (Array.isArray(r?.models) ? r.models : [])).catch(() => []),
    ]);

    const selectedVideo = uiPrefs?.models?.video?.selectedModelId || '';
    const selectedImage = uiPrefs?.models?.image?.selectedModelId || '';
    const selectedVoice = uiPrefs?.models?.voice?.selectedModelId || '';

    const planningUsd = Number(planningCostUsd);
    const llmAllowance = Number.isFinite(planningUsd) && planningUsd > 0 ? { min: planningUsd * 0.5, likely: planningUsd * 1.5, max: planningUsd * 3 } : { min: 0.05, likely: 0.15, max: 0.4 };

    const computeTotal = (picked) => {
      const imageCost = picked.image ? estimateSelectorCostRangeUsd({ selector: 'image', model: picked.image, quantities }) : { min: 0, likely: 0, max: 0 };
      const videoCost = picked.video ? estimateSelectorCostRangeUsd({ selector: 'video', model: picked.video, quantities }) : { min: 0, likely: 0, max: 0 };
      const voiceCost = picked.voice ? estimateSelectorCostRangeUsd({ selector: 'voice', model: picked.voice, quantities }) : { min: 0, likely: 0, max: 0 };
      return {
        min: imageCost.min + videoCost.min + voiceCost.min + llmAllowance.min,
        likely: imageCost.likely + videoCost.likely + voiceCost.likely + llmAllowance.likely,
        max: imageCost.max + videoCost.max + voiceCost.max + llmAllowance.max,
      };
    };

    const resolveById = (models, id) => (id ? models.find((m) => m && m.id === id) : null);
    const recommended = (models) => models.find((m) => m?.recommended) || models[0] || null;

    const initialPicked = {
      image: resolveById(imageModels, selectedImage) || recommended(imageModels),
      video: resolveById(videoModels, selectedVideo) || recommended(videoModels),
      voice: resolveById(voiceModels, selectedVoice) || recommended(voiceModels),
    };
    const totalFormatted = formatCostRange(computeTotal(initialPicked));

    const planHtml = `
      ${summary ? `<div class="text-sm">${escapeHtml(summary)}</div>` : ''}
      ${toolDesc ? `<div class="text-xs text-muted-foreground whitespace-pre-wrap">${escapeHtml(toolDesc)}</div>` : ''}

      <div class="text-sm font-semibold mt-3">Cost estimate (includes tools + LLM allowance)</div>
      <div class="text-xs text-muted-foreground" data-role="planCost">
        <div>Min: ${escapeHtml(totalFormatted.min)}</div>
        <div>Likely: ${escapeHtml(totalFormatted.likely)}</div>
        <div>Max: ${escapeHtml(totalFormatted.max)}</div>
      </div>

      <div class="text-sm font-semibold mt-3">Models</div>
      <div class="space-y-2">
        <label class="flex items-center justify-between gap-3 text-sm">
          <span class="text-muted-foreground">Image model</span>
          <select data-role="imageModel" class="bg-secondary/80 rounded-ios-xl px-3 py-2 text-sm">
            ${buildApprovalModelOptions({ models: imageModels, selectedId: selectedImage, selector: 'image', quantities })}
          </select>
        </label>
        <div data-role="imageOther" class="hidden">
          <input type="text" data-role="imageOtherInput" class="w-full bg-secondary/80 rounded-ios-xl px-3 py-2 text-sm" placeholder="provider:model-id" />
        </div>
        <label class="flex items-center justify-between gap-3 text-sm">
          <span class="text-muted-foreground">Video model</span>
          <select data-role="videoModel" class="bg-secondary/80 rounded-ios-xl px-3 py-2 text-sm">
            ${buildApprovalModelOptions({ models: videoModels, selectedId: selectedVideo, selector: 'video', quantities })}
          </select>
        </label>
        <div data-role="videoOther" class="hidden">
          <input type="text" data-role="videoOtherInput" class="w-full bg-secondary/80 rounded-ios-xl px-3 py-2 text-sm" placeholder="provider:model-id" />
        </div>
        <label class="flex items-center justify-between gap-3 text-sm">
          <span class="text-muted-foreground">Voice model</span>
          <select data-role="voiceModel" class="bg-secondary/80 rounded-ios-xl px-3 py-2 text-sm">
            ${buildApprovalModelOptions({ models: voiceModels, selectedId: selectedVoice, selector: 'voice', quantities })}
          </select>
        </label>
        <div data-role="voiceOther" class="hidden">
          <input type="text" data-role="voiceOtherInput" class="w-full bg-secondary/80 rounded-ios-xl px-3 py-2 text-sm" placeholder="provider:model-id" />
        </div>
      </div>

      <div class="text-sm font-semibold mt-3">Steps</div>
      ${renderTodosInline(todos)}

      ${risks.length ? `
        <div class="text-sm font-semibold mt-3">Risks</div>
        <ul class="text-sm space-y-1">${risks.map((r) => `<li>• ${escapeHtml(r)}</li>`).join('')}</ul>
      ` : ''}
    `;

    const block = document.createElement('div');
    block.className = 'space-y-3';
    block.innerHTML = planHtml;
    card.appendChild(block);

    const footer = document.createElement('div');
    footer.className = 'flex items-center gap-2 pt-2';
    footer.innerHTML = `
      <button type="button" data-role="rejectBtn" class="h-9 px-4 rounded-full bg-secondary hover:bg-secondary/80 text-sm font-semibold transition-colors">Reject</button>
      <button type="button" data-role="approveBtn" class="h-9 px-4 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold transition-colors">Approve</button>
    `;
    card.appendChild(footer);

    const rejection = document.createElement('div');
    rejection.className = 'hidden space-y-2';
    rejection.innerHTML = `
      <div class="text-sm font-semibold">Feedback (optional)</div>
      <textarea data-role="rejectReason" rows="3" class="w-full bg-secondary/80 rounded-ios-xl px-3 py-2 text-sm" placeholder="What should change?"></textarea>
      <button type="button" data-role="submitRejectBtn" class="h-9 px-4 rounded-full bg-secondary hover:bg-secondary/80 text-sm font-semibold transition-colors">Submit rejection</button>
    `;
    card.appendChild(rejection);

    const imageSelect = card.querySelector('select[data-role="imageModel"]');
    const videoSelect = card.querySelector('select[data-role="videoModel"]');
    const voiceSelect = card.querySelector('select[data-role="voiceModel"]');
    const costEl = card.querySelector('[data-role="planCost"]');

    const toggleOther = (select, wrap) => wrap?.classList.toggle('hidden', select?.value !== '__other__');
    const imageOtherWrap = card.querySelector('[data-role="imageOther"]');
    const videoOtherWrap = card.querySelector('[data-role="videoOther"]');
    const voiceOtherWrap = card.querySelector('[data-role="voiceOther"]');

    const refreshTotal = () => {
      const picked = {
        image: resolveById(imageModels, imageSelect.value) || recommended(imageModels),
        video: resolveById(videoModels, videoSelect.value) || recommended(videoModels),
        voice: resolveById(voiceModels, voiceSelect.value) || recommended(voiceModels),
      };
      const formatted = formatCostRange(computeTotal(picked));
      if (costEl) {
        costEl.innerHTML = `<div>Min: ${escapeHtml(formatted.min)}</div><div>Likely: ${escapeHtml(formatted.likely)}</div><div>Max: ${escapeHtml(formatted.max)}</div>`;
      }
    };

    imageSelect?.addEventListener('change', () => {
      toggleOther(imageSelect, imageOtherWrap);
      refreshTotal();
    });
    videoSelect?.addEventListener('change', () => {
      toggleOther(videoSelect, videoOtherWrap);
      refreshTotal();
    });
    voiceSelect?.addEventListener('change', () => {
      toggleOther(voiceSelect, voiceOtherWrap);
      refreshTotal();
    });

    const disableAll = () => {
      card.querySelectorAll('button,select,input,textarea').forEach((n) => { n.disabled = true; });
    };

    card.querySelector('[data-role="rejectBtn"]')?.addEventListener('click', () => {
      rejection.classList.toggle('hidden');
    });

    const makeSelection = (select, otherInput, models) => {
      const value = select?.value || '';
      if (!value) return { selectedModelId: '', preferredProvider: '' };
      if (value === '__other__') {
        const raw = String(otherInput?.value || '').trim();
        if (!raw) return { selectedModelId: '', preferredProvider: '' };
        const idx = raw.indexOf(':');
        if (idx !== -1) return { selectedModelId: raw.slice(idx + 1), preferredProvider: raw.slice(0, idx) };
        return { selectedModelId: raw, preferredProvider: '' };
      }
      const found = models.find((m) => m && m.id === value);
      return { selectedModelId: value, preferredProvider: found?.provider ? String(found.provider) : '' };
    };

    card.querySelector('[data-role="approveBtn"]')?.addEventListener('click', async () => {
      try {
        disableAll();
        const imageOtherInput = card.querySelector('[data-role="imageOtherInput"]');
        const videoOtherInput = card.querySelector('[data-role="videoOtherInput"]');
        const voiceOtherInput = card.querySelector('[data-role="voiceOtherInput"]');

        const nextPrefs = {
          image: makeSelection(imageSelect, imageOtherInput, imageModels),
          video: makeSelection(videoSelect, videoOtherInput, videoModels),
          voice: makeSelection(voiceSelect, voiceOtherInput, voiceModels),
        };

        await apiJson(`https://aitopia.ai/api/approvals/user/${encodeURIComponent(approvalId)}/resolve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ approved: true, modifiedInput: { ...input, modelPreferences: nextPrefs } }),
        });
        showToast('Approved. Resuming…');
        await resumeStream(runId);
      } catch (err) {
        showToast(err?.message || 'Approve failed');
      }
    });

    card.querySelector('[data-role="submitRejectBtn"]')?.addEventListener('click', async () => {
      try {
        disableAll();
        const reason = card.querySelector('[data-role="rejectReason"]')?.value || '';
        await apiJson(`https://aitopia.ai/api/approvals/user/${encodeURIComponent(approvalId)}/resolve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ approved: false, reason: String(reason || '').trim() || undefined }),
        });
        showToast('Rejected.');
      } catch (err) {
        showToast(err?.message || 'Reject failed');
      }
    });
  } else {
    const inputPreview = safeJsonStringify(input, 4000);
    const block = document.createElement('div');
    block.className = 'space-y-3';
    block.innerHTML = `
      <div class="text-sm"><span class="font-semibold">Tool:</span> ${escapeHtml(toolName)}</div>
      ${toolDesc ? `<div class="text-xs text-muted-foreground whitespace-pre-wrap">${escapeHtml(toolDesc)}</div>` : ''}
      ${riskFactors.length ? `
        <div class="rounded-ios-xl border border-border bg-secondary/20 p-3">
          <div class="text-sm font-semibold mb-2">Reasons</div>
          <ul class="space-y-1 text-sm">
            ${riskFactors.map((r) => `<li>• ${escapeHtml(r)}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
      <div class="rounded-ios-xl border border-border bg-secondary/20 p-3">
        <div class="text-sm font-semibold mb-2">Input</div>
        <pre class="text-xs text-muted-foreground whitespace-pre-wrap break-words">${escapeHtml(inputPreview)}</pre>
      </div>
    `;
    card.appendChild(block);

    const footer = document.createElement('div');
    footer.className = 'flex items-center gap-2 pt-2';
    footer.innerHTML = `
      <button type="button" data-role="declineBtn" class="h-9 px-4 rounded-full bg-secondary hover:bg-secondary/80 text-sm font-semibold transition-colors">Reject</button>
      <button type="button" data-role="approveBtn" class="h-9 px-4 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold transition-colors">Approve</button>
    `;
    card.appendChild(footer);

    const disableAll = () => {
      card.querySelectorAll('button,select,input,textarea').forEach((n) => { n.disabled = true; });
    };

    card.querySelector('[data-role="declineBtn"]')?.addEventListener('click', async () => {
      try {
        disableAll();
        await apiJson(`https://aitopia.ai/api/approvals/user/${encodeURIComponent(approvalId)}/resolve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ approved: false }),
        });
        showToast('Rejected.');
      } catch (err) {
        showToast(err?.message || 'Reject failed');
      }
    });

    card.querySelector('[data-role="approveBtn"]')?.addEventListener('click', async () => {
      try {
        disableAll();
        await apiJson(`https://aitopia.ai/api/approvals/user/${encodeURIComponent(approvalId)}/resolve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ approved: true }),
        });
        showToast('Approved. Resuming…');
        await resumeStream(runId);
      } catch (err) {
        showToast(err?.message || 'Approve failed');
      }
    });
  }

  container.appendChild(card);
  container.scrollTop = container.scrollHeight;
}

async function streamFrom(endpoint, payload, { attachToAssistantNode, onDisconnect } = {}) {
  // Abort previous stream
  if (activeController) activeController.abort();
  const controller = new AbortController();
  activeController = controller;

  const assistantNode = attachToAssistantNode || appendMessage('assistant', '', { pending: true });
  const assistantActivity = getAssistantActivityContainer(assistantNode);
  let assistantText = '';
  let assistantThinking = '';
  let doneData = null;
  let gotDone = false;
  let observedRunId = null;

  el.sendBtn && (el.sendBtn.disabled = true);
  el.input && (el.input.disabled = true);
  setHint('Connecting…');

  await loadBillingConfig().catch(() => {});
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
    'Idempotency-Key': `assistant-${uuid()}`,
  };
  if (!isCreditsMode() && uiPrefs?.userTier) {
    headers['X-User-Tier'] = uiPrefs.userTier;
  }

  const res = await fetchHelper(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: controller.signal,
  });

  if (!res.ok) {
    const text = await res.text();
    const message = text || `HTTP ${res.status}`;
    setAssistantContent(assistantNode, message, { pendingLabel: 'Error' });
    setHint('');
    el.sendBtn && (el.sendBtn.disabled = false);
    el.input && (el.input.disabled = false);
    return { assistantText, doneData };
  }

  try {
    for await (const { eventType, payload: evt } of sseEvents(res, controller.signal)) {
      const type = evt?.type || eventType;
      const data = evt?.data || {};

      if (type === 'start') {
        const rid = typeof data?.runId === 'string' ? data.runId : null;
        if (rid && rid.trim()) observedRunId = rid.trim();
        continue;
      }

      if (type === 'token') {
        assistantText += String(data?.content || '');
        setAssistantContent(assistantNode, assistantText, { pendingLabel: 'Assistant' });
        setHint('');
        continue;
      }

      if (type === 'progress') {
        const pct = typeof data?.percent === 'number' ? Math.round(data.percent) : null;
        const msg = data?.message ? String(data.message) : '';
        setHint(pct != null ? `${pct}% ${msg}`.trim() : msg);
        continue;
      }

      if (type === 'warning') {
        const msg = data?.message ? String(data.message) : '';
        if (msg.trim()) {
          showToast(msg);
          setHint(msg);
        }
        continue;
      }

      if (type === 'thinking') {
        const t = String(data?.content || '');
        if (t.trim()) {
          assistantThinking = `${assistantThinking}${t}`;
          if (assistantThinking.length > 8000) assistantThinking = assistantThinking.slice(-8000);
          setAssistantThinking(assistantNode, assistantThinking, { open: true });
          setHint('Thinking…');
        }
        continue;
      }

      if (type === 'tool_call') {
        addToolCall(String(data?.callId || ''), String(data?.name || ''), data?.input, { container: assistantActivity });
        continue;
      }

      if (type === 'tool_result') {
        updateToolResult(String(data?.callId || ''), data?.result, Boolean(data?.error));
        continue;
      }

      if (type === 'error') {
        const msg = data?.message ? String(data.message) : 'Error';
        setHint('');
        setAssistantContent(assistantNode, assistantText || msg, { pendingLabel: 'Error' });
        gotDone = true;
        continue;
      }

      if (type === 'done') {
        doneData = data || null;
        setHint('');
        setAssistantThinking(assistantNode, assistantThinking, { open: false });
        gotDone = true;
        const costUsd = doneData?.usage?.costUsd;
	        const durationMs = doneData?.usage?.durationMs;
	        const modelUsed = doneData?.usage?.modelUsed;
	        const metaParts = [];
	        if (typeof costUsd === 'number' && Number.isFinite(costUsd)) {
            const label = formatCost(costUsd, { includeUsd: true });
            if (label) metaParts.push(`Cost: ${label}`);
          }
	        if (typeof modelUsed === 'string' && modelUsed.trim()) metaParts.push(`LLM: ${modelUsed}`);
	        if (typeof durationMs === 'number' && Number.isFinite(durationMs) && durationMs > 0) metaParts.push(`Time: ${(durationMs / 1000).toFixed(1)}s`);
	        if (metaParts.length > 0) setAssistantMeta(assistantNode, metaParts.join(' • '));

	        if (!assistantText.trim() && doneData?.result !== undefined) {
	          const fallback = typeof doneData.result === 'string' ? doneData.result : safeJsonStringify(doneData.result, 4000);
	          setAssistantContent(assistantNode, fallback, { pendingLabel: 'Assistant' });
	        }
        break;
      }
    }
    if (!gotDone && !controller.signal.aborted) {
      if (typeof onDisconnect === 'function') {
        onDisconnect({ assistantNode, assistantText, payload, runId: observedRunId });
      } else {
        setAssistantContent(assistantNode, assistantText || 'Connection lost.', { pendingLabel: 'Disconnected' });
      }
    }
  } catch (err) {
    if (controller.signal.aborted) return { assistantText, doneData };
    setAssistantContent(assistantNode, assistantText || (err?.message || 'Stream failed'), { pendingLabel: 'Error' });
    setHint('');
  } finally {
    el.sendBtn && (el.sendBtn.disabled = false);
    el.input && (el.input.disabled = false);
    activeController = null;
  }

  return { assistantText, doneData };
}

async function resumeStream(runId) {
  const assistantNode = appendMessage('assistant', '', { pending: true });
  const handleDisconnect = ({ assistantNode: node, assistantText, runId: disconnectRunId }) => {
    setAssistantContent(node, assistantText || 'Connection lost.', { pendingLabel: 'Disconnected' });
    const actions = ensureAssistantActions(node);
    if (!actions) return;
    const retry = document.createElement('button');
    retry.className = 'rounded-ios-xl border border-border px-3 py-1 text-xs';
    retry.textContent = 'Retry';
    retry.onclick = () => resumeStream(runId);
    actions.appendChild(retry);

    const effectiveRunId = (disconnectRunId && disconnectRunId.trim()) ? disconnectRunId.trim() : runId;
    if (effectiveRunId && effectiveRunId.trim()) {
      const check = document.createElement('button');
      check.className = 'rounded-ios-xl border border-border px-3 py-1 text-xs';
      check.textContent = 'Check status';
      check.onclick = async () => {
        try {
          const status = await apiJson(`/runs/${encodeURIComponent(effectiveRunId)}`);
          const state = typeof status?.status === 'string' ? status.status : 'unknown';
          showToast(`Run status: ${state}`);
        } catch (err) {
          showToast(err?.message || 'Status check failed');
        }
      };
      actions.appendChild(check);
    }
  };
  const { assistantText, doneData } = await streamFrom('/stream/resume', { runId }, { attachToAssistantNode: assistantNode, onDisconnect: handleDisconnect });
  if (doneData?.result?.awaitingApproval && doneData?.result?.approvalId) {
    setAssistantContent(assistantNode, assistantText || 'Awaiting approval…', { pendingLabel: 'Awaiting approval' });
    await showApprovalModal({
      approvalId: doneData.result.approvalId,
      runId: doneData.result.runId || runId,
      assistantNode,
      planningCostUsd: doneData?.usage?.costUsd,
    });
  }
  pushHistory('assistant', assistantText || '');
}

async function runStream(userMessage) {
  const trimmed = String(userMessage || '').trim();
  if (!trimmed) return;

  // Abort previous stream
  appendMessage('user', trimmed);

  await loadBillingConfig().catch(() => {});
  const usdPerCredit = Number(billingConfig?.usdPerCredit) || 0.02;

  const selectedLlmModel = uiPrefs?.models?.llm?.modelId || '';
  const maxTaskCredits = uiPrefs?.budgets?.maxTaskCredits;
  const budget =
    typeof maxTaskCredits === 'number' && Number.isFinite(maxTaskCredits) && maxTaskCredits > 0
      ? { maxCostUsd: maxTaskCredits * usdPerCredit }
      : undefined;

  const budgetPrefs = {
    maxTaskCredits: typeof maxTaskCredits === 'number' && Number.isFinite(maxTaskCredits) && maxTaskCredits > 0 ? Math.floor(maxTaskCredits) : null,
    warnAtPercent:
      typeof uiPrefs?.budgets?.warnAtPercent === 'number' && Number.isFinite(uiPrefs.budgets.warnAtPercent)
        ? Math.max(1, Math.min(99, Math.round(uiPrefs.budgets.warnAtPercent)))
        : 80,
    maxByModelCreditsJson: typeof uiPrefs?.budgets?.maxByModelCreditsJson === 'string' ? uiPrefs.budgets.maxByModelCreditsJson : '',
  };

  const creativeContext = (() => {
    const creative = uiPrefs?.creative;
    if (!creative || typeof creative !== 'object' || Array.isArray(creative)) return null;
    const styleDirective = typeof creative.styleDirective === 'string' ? creative.styleDirective.trim() : '';
    const character = creative.character && typeof creative.character === 'object' && !Array.isArray(creative.character) ? creative.character : null;
    const name = character && typeof character.name === 'string' ? character.name.trim() : '';
    const description = character && typeof character.description === 'string' ? character.description.trim() : '';
    const referenceImageUrl = character && typeof character.referenceImageUrl === 'string' ? character.referenceImageUrl.trim() : '';

    if (!styleDirective && !name && !description && !referenceImageUrl) return null;
    const out = {};
    if (styleDirective) out.styleDirective = styleDirective;
    const ch = {};
    if (name) ch.name = name;
    if (description) ch.description = description;
    if (referenceImageUrl) ch.referenceImageUrl = referenceImageUrl;
    if (Object.keys(ch).length > 0) out.character = ch;
    return out;
  })();

  const payload = {
    agentId: 'superagent',
    task: trimmed,
    ...(selectedLlmModel ? { model: selectedLlmModel } : {}),
    ...(budget ? { budget } : {}),
    context: {
      conversationHistory: conversationHistory.slice(-16),
      budgets: budgetPrefs,
      modelPreferences: {
        llm: { modelId: selectedLlmModel || '' },
        video: {
          selectedModelId: uiPrefs?.models?.video?.selectedModelId || '',
          preferredProvider: uiPrefs?.models?.video?.preferredProvider || '',
        },
        image: {
          selectedModelId: uiPrefs?.models?.image?.selectedModelId || '',
          preferredProvider: uiPrefs?.models?.image?.preferredProvider || '',
        },
        voice: {
          selectedModelId: uiPrefs?.models?.voice?.selectedModelId || '',
          preferredProvider: uiPrefs?.models?.voice?.preferredProvider || '',
        },
      },
      ...(creativeContext ? { creative: creativeContext } : {}),
    },
  };
  const assistantNode = appendMessage('assistant', '', { pending: true });
  const handleDisconnect = ({ assistantNode: node, assistantText, payload, runId }) => {
    setAssistantContent(node, assistantText || 'Connection lost.', { pendingLabel: 'Disconnected' });
    const actions = ensureAssistantActions(node);
    if (!actions) return;
    const retry = document.createElement('button');
    retry.className = 'rounded-ios-xl border border-border px-3 py-1 text-xs';
    retry.textContent = 'Retry';
    retry.onclick = () => {
      actions.innerHTML = '';
      void streamFrom('/stream', payload, { attachToAssistantNode: node, onDisconnect: handleDisconnect });
    };
    actions.appendChild(retry);

    if (runId && runId.trim()) {
      const check = document.createElement('button');
      check.className = 'rounded-ios-xl border border-border px-3 py-1 text-xs';
      check.textContent = 'Check status';
      check.onclick = async () => {
        try {
          const status = await apiJson(`/runs/${encodeURIComponent(runId)}`);
          const state = typeof status?.status === 'string' ? status.status : 'unknown';
          showToast(`Run status: ${state}`);
        } catch (err) {
          showToast(err?.message || 'Status check failed');
        }
      };
      actions.appendChild(check);
    }
  };
  const { assistantText, doneData } = await streamFrom('/stream', payload, { attachToAssistantNode: assistantNode, onDisconnect: handleDisconnect });
  if (doneData?.result?.awaitingApproval && doneData?.result?.approvalId) {
    setAssistantContent(assistantNode, assistantText || 'Awaiting approval…', { pendingLabel: 'Awaiting approval' });
    await showApprovalModal({
      approvalId: doneData.result.approvalId,
      runId: doneData.result.runId || doneData.runId,
      assistantNode,
      planningCostUsd: doneData?.usage?.costUsd,
    });
  }

  // Persist conversation (simple string transcript; tool events are separate)
  pushHistory('user', trimmed);
  pushHistory('assistant', assistantText || '');
}

function resetChat() {
  if (activeController) activeController.abort();
  activeController = null;
  conversationHistory.length = 0;
  clearActivity();

  // Keep the initial welcome block and clear everything else.
  if (el.messages) {
    const nodes = Array.from(el.messages.children);
    for (const node of nodes) {
      if (node.querySelector?.('.suggestion')) continue;
    }
    // Remove all except first (welcome)
    while (el.messages.children.length > 1) el.messages.removeChild(el.messages.lastElementChild);
    el.messages.scrollTop = 0;
  }
  setHint('');
}

function autosizeTextarea(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = `${Math.min(160, textarea.scrollHeight)}px`;
}

el.sendBtn?.addEventListener('click', () => void runStream(el.input?.value));
el.newChatBtn?.addEventListener('click', resetChat);
el.settingsBtn?.addEventListener('click', async () => {
  try {
    await loadBillingConfig().catch(() => {});
    const creditsMode = isCreditsMode();
    const usdPerCredit = Number(billingConfig?.usdPerCredit) || 0.02;

    const policy = supervisorPolicy?.policy || (await loadSupervisorPolicy())?.policy;
    const options = supervisorOptions || (await loadSupervisorOptions());
    const prefs = uiPrefs || loadUiPrefs();

    const tierQuery = creditsMode ? '' : `&tier=${encodeURIComponent(prefs.userTier)}`;
    const fetchModels = async (capability) => {
      try {
        const res = await apiJson(`https://aitopia.ai/api/models?capability=${encodeURIComponent(capability)}${tierQuery}`);
        return Array.isArray(res?.models) ? res.models : [];
      } catch {
        return [];
      }
    };

    let [videoModels, imageModels, voiceModels] = await Promise.all([
      fetchModels('video-generation'),
      fetchModels('image-generation'),
      fetchModels('text-to-speech'),
    ]);

    const toolsByCategory = new Map();
    (options?.tools || []).forEach((t) => {
      const cat = t.category || 'misc';
      if (!toolsByCategory.has(cat)) toolsByCategory.set(cat, []);
      toolsByCategory.get(cat).push(t);
    });

    const toolSections = Array.from(toolsByCategory.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([cat, tools]) => {
        const items = tools
          .map((t) => {
            const checked = policy.allowedToolNames?.includes(t.name) ? 'checked' : '';
            return `
              <label class="flex items-start gap-3 py-1">
                <input type="checkbox" data-tool-name="${escapeHtml(t.name)}" ${checked} />
                <span class="min-w-0">
                  <span class="font-semibold text-sm">${escapeHtml(t.name)}</span>
                  <span class="block text-xs text-muted-foreground mt-0.5">${escapeHtml(t.description || '')}</span>
                </span>
              </label>
            `;
          })
          .join('');
        return `
          <div class="rounded-ios-2xl border border-border bg-background/40 p-4">
            <div class="font-semibold text-sm mb-2">${escapeHtml(cat)}</div>
            <div class="space-y-1">${items}</div>
          </div>
        `;
      })
      .join('');

    const agentCheckboxes = (options?.agents || [])
      .filter((a) => !a.deprecated)
      .map((a) => {
        const checked = policy.allowedAgentIds?.includes(a.id) ? 'checked' : '';
        return `
          <label class="flex items-start gap-3 py-1">
            <input type="checkbox" data-agent-id="${escapeHtml(a.id)}" ${checked} />
            <span class="min-w-0">
              <span class="font-semibold text-sm">${escapeHtml(a.name || a.id)}</span>
              <span class="block text-xs text-muted-foreground mt-0.5">${escapeHtml(a.description || '')}</span>
            </span>
          </label>
        `;
      })
      .join('');

    const buildModelOptions = (models, selectedId) => {
      return [
        `<option value="" ${!selectedId ? 'selected' : ''}>Auto (recommended)</option>`,
        ...models.map((m) => {
          const id = String(m?.id || '');
          const label = String(m?.displayName || id);
          const provider = String(m?.provider || '');
          const selected = selectedId === id ? 'selected' : '';
          return `<option value="${escapeHtml(id)}" ${selected}>${escapeHtml(label)}${provider ? ` (${escapeHtml(provider)})` : ''}</option>`;
        }),
      ].join('');
    };

    const llmModels = [
      { id: '', label: 'Auto (recommended)' },
      { id: 'claude-opus-4-20250514', label: 'Claude Opus 4' },
      { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
      { id: 'claude-haiku-3-5-20241022', label: 'Claude Haiku 3.5' },
    ];

    const selectedLlm = prefs?.models?.llm?.modelId || '';
    const selectedVideo = prefs?.models?.video?.selectedModelId || '';
    const selectedImage = prefs?.models?.image?.selectedModelId || '';
    const selectedVoice = prefs?.models?.voice?.selectedModelId || '';

    const llmOptions = llmModels
      .map((m) => `<option value="${escapeHtml(m.id)}" ${selectedLlm === m.id ? 'selected' : ''}>${escapeHtml(m.label)}</option>`)
      .join('');
    const videoOptions = buildModelOptions(videoModels, selectedVideo);
    const imageOptions = buildModelOptions(imageModels, selectedImage);
    const voiceOptions = buildModelOptions(voiceModels, selectedVoice);

    const costThresholdUsdDefault = Number(policy?.approvals?.modelsRunCostUsdOver ?? 0.5);
    const costThresholdDisplay = creditsMode
      ? Math.max(0, Math.round(costThresholdUsdDefault / usdPerCredit))
      : Math.max(0, costThresholdUsdDefault);

    const maxTaskCreditsDisplay =
      typeof prefs?.budgets?.maxTaskCredits === 'number' && Number.isFinite(prefs.budgets.maxTaskCredits)
        ? prefs.budgets.maxTaskCredits
        : '';
    const warnAtPercentDisplay =
      typeof prefs?.budgets?.warnAtPercent === 'number' && Number.isFinite(prefs.budgets.warnAtPercent)
        ? prefs.budgets.warnAtPercent
        : 80;
    const maxByModelCreditsJson = typeof prefs?.budgets?.maxByModelCreditsJson === 'string' ? prefs.budgets.maxByModelCreditsJson : '';

    const creativeStyleDirective = typeof prefs?.creative?.styleDirective === 'string' ? prefs.creative.styleDirective : '';
    const creativeCharacterName = typeof prefs?.creative?.character?.name === 'string' ? prefs.creative.character.name : '';
    const creativeCharacterDescription =
      typeof prefs?.creative?.character?.description === 'string' ? prefs.creative.character.description : '';
    const creativeReferenceImageUrl =
      typeof prefs?.creative?.character?.referenceImageUrl === 'string' ? prefs.creative.character.referenceImageUrl : '';

    const tierHtml = creditsMode
      ? `<div class="text-xs text-muted-foreground mt-2">Credits mode: tiers are ignored for model availability.</div>`
      : `
        <label class="text-sm">User tier:
          <select id="assistantUserTier" class="ml-2 bg-secondary/80 rounded-ios-xl px-3 py-2 text-sm">
            ${['free', 'starter', 'pro', 'enterprise']
              .map((t) => `<option value="${escapeHtml(t)}" ${prefs.userTier === t ? 'selected' : ''}>${escapeHtml(t)}</option>`)
              .join('')}
          </select>
        </label>
      `;

    const bodyHtml = `
      <div class="rounded-ios-2xl border border-border bg-background/40 p-4">
        <div class="font-semibold text-sm mb-2">Budgets (Credits)</div>
        <label class="flex items-center gap-2 text-sm">
          <span>Max task (credits)</span>
          <input id="assistantMaxTaskCredits" type="number" step="1" min="0" class="w-28 bg-secondary/80 rounded-ios-xl px-3 py-2 text-sm"
            value="${escapeHtml(String(maxTaskCreditsDisplay))}" placeholder="e.g. 25" />
        </label>
        <label class="flex items-center gap-2 text-sm mt-2">
          <span>Warn at (%)</span>
          <input id="assistantWarnAtPercent" type="number" step="1" min="1" max="99" class="w-24 bg-secondary/80 rounded-ios-xl px-3 py-2 text-sm"
            value="${escapeHtml(String(warnAtPercentDisplay))}" />
        </label>
        <label class="text-sm mt-2 block">
          <div class="mb-1">Max by model (JSON, credits)</div>
          <textarea id="assistantMaxByModelCreditsJson" rows="4" class="w-full bg-secondary/80 rounded-ios-xl px-3 py-2 text-sm"
            placeholder='{"anthropic:claude-opus-4-20250514":500,"replicate:wan-video/wan-2.2-t2v-fast":200}'>${escapeHtml(String(maxByModelCreditsJson || ''))}</textarea>
        </label>
        <div class="text-xs text-muted-foreground mt-2">Server still clamps to available credits; this is an extra per-run cap.</div>
      </div>

      <div class="rounded-ios-2xl border border-border bg-background/40 p-4">
        <div class="font-semibold text-sm mb-2">Creative Direction (optional)</div>
        <div class="text-xs text-muted-foreground mb-2">Applied to image/video generations unless you explicitly ask for background-only / no character.</div>
        <label class="text-sm block">
          <div class="mb-1">Style directive</div>
          <textarea id="assistantCreativeStyleDirective" rows="3" class="w-full bg-secondary/80 rounded-ios-xl px-3 py-2 text-sm"
            placeholder="e.g. cyberpunk aesthetic, neon lighting, cinematic, high contrast">${escapeHtml(String(creativeStyleDirective || ''))}</textarea>
        </label>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
          <label class="text-sm block">
            <div class="mb-1">Character name</div>
            <input id="assistantCreativeCharacterName" type="text" class="w-full bg-secondary/80 rounded-ios-xl px-3 py-2 text-sm"
              value="${escapeHtml(String(creativeCharacterName || ''))}" placeholder="optional" />
          </label>
          <label class="text-sm block">
            <div class="mb-1">Reference image URL</div>
            <input id="assistantCreativeReferenceImageUrl" type="text" class="w-full bg-secondary/80 rounded-ios-xl px-3 py-2 text-sm"
              value="${escapeHtml(String(creativeReferenceImageUrl || ''))}" placeholder="optional (https://...)" />
          </label>
        </div>
        <label class="text-sm block mt-3">
          <div class="mb-1">Character description</div>
          <textarea id="assistantCreativeCharacterDescription" rows="4" class="w-full bg-secondary/80 rounded-ios-xl px-3 py-2 text-sm"
            placeholder="e.g. tall woman with silver hair, red coat, serious expression">${escapeHtml(String(creativeCharacterDescription || ''))}</textarea>
        </label>
        <div class="flex items-center justify-end mt-3">
          <button id="assistantCreativeClearBtn" type="button" class="h-9 px-4 rounded-full bg-secondary hover:bg-secondary/80 text-sm font-semibold transition-colors">Clear</button>
        </div>
      </div>

      <div class="rounded-ios-2xl border border-border bg-background/40 p-4">
        <div class="font-semibold text-sm mb-2">Model Defaults</div>
        ${tierHtml}
        <div class="mt-3">
          <label class="text-sm">LLM model:
            <select id="assistantLlmModel" class="ml-2 bg-secondary/80 rounded-ios-xl px-3 py-2 text-sm max-w-full">
              ${llmOptions}
            </select>
          </label>
          <div class="text-xs text-muted-foreground mt-1">Applies to Superagent streaming (Claude).</div>
        </div>
        <div class="mt-3">
          <label class="text-sm">Video model:
            <select id="assistantVideoModel" class="ml-2 bg-secondary/80 rounded-ios-xl px-3 py-2 text-sm max-w-full">
              ${videoOptions}
            </select>
          </label>
          <div class="text-xs text-muted-foreground mt-1">Applies to generate_video tool calls when the agent does not specify a model.</div>
        </div>
        <div class="mt-3">
          <label class="text-sm">Image model:
            <select id="assistantImageModel" class="ml-2 bg-secondary/80 rounded-ios-xl px-3 py-2 text-sm max-w-full">
              ${imageOptions}
            </select>
          </label>
          <div class="text-xs text-muted-foreground mt-1">Applies to generate_image tool calls when the agent does not specify a model.</div>
        </div>
        <div class="mt-3">
          <label class="text-sm">Voice model:
            <select id="assistantVoiceModel" class="ml-2 bg-secondary/80 rounded-ios-xl px-3 py-2 text-sm max-w-full">
              ${voiceOptions}
            </select>
          </label>
          <div class="text-xs text-muted-foreground mt-1">Applies to text_to_speech tool calls when the agent does not specify a model.</div>
        </div>
      </div>

      <div class="rounded-ios-2xl border border-border bg-background/40 p-4">
        <div class="font-semibold text-sm mb-2">Planning</div>
        <label class="text-sm">Mode:
          <select id="policyPlanningMode" class="ml-2 bg-secondary/80 rounded-ios-xl px-3 py-2 text-sm">
            ${(options?.planningModes || ['off', 'explicit', 'auto', 'always'])
              .map((m) => `<option value="${escapeHtml(m)}" ${policy?.planning?.mode === m ? 'selected' : ''}>${escapeHtml(m)}</option>`)
              .join('')}
          </select>
        </label>
      </div>

      <div class="rounded-ios-2xl border border-border bg-background/40 p-4">
        <div class="font-semibold text-sm mb-2">Approvals (HITL)</div>
        <label class="flex items-center gap-2 text-sm">
          <span>Require approval if estimated cost &gt; ${creditsMode ? 'credits' : '$'}</span>
          <input id="policyCostThreshold" type="number" step="${creditsMode ? '1' : '0.01'}" min="0" class="w-28 bg-secondary/80 rounded-ios-xl px-3 py-2 text-sm"
            value="${escapeHtml(String(costThresholdDisplay))}" />
        </label>
        <label class="flex items-center gap-2 text-sm mt-2">
          <input id="policyApproveVideo" type="checkbox" ${policy?.approvals?.requireForVideo ? 'checked' : ''} />
          <span>Require approval for any video generation</span>
        </label>
        <label class="flex items-center gap-2 text-sm mt-2">
          <input id="policyApproveExternal" type="checkbox" ${policy?.approvals?.requireForExternalDomains ? 'checked' : ''} />
          <span>Require approval for external domains / web search</span>
        </label>
      </div>

      <div class="rounded-ios-2xl border border-border bg-background/40 p-4">
        <div class="font-semibold text-sm mb-2">Allowed Agents (for agents_execute)</div>
        <div class="text-xs text-muted-foreground mb-2">Default is empty: Superagent cannot call any internal agents until you allow them.</div>
        <div class="space-y-1 max-h-64 overflow-y-auto">${agentCheckboxes || '<div class="text-sm text-muted-foreground">No agents available.</div>'}</div>
      </div>

      <div class="space-y-3">
        <div class="font-semibold">Allowed Tools</div>
        ${toolSections}
      </div>
    `;

    showModal({
      id: 'settingsModal',
      title: 'Supervisor Settings',
      bodyHtml,
      actionsHtml: `
        <button id="policySaveBtn" type="button" class="h-9 px-4 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold transition-colors">Save</button>
      `,
    });

    document.getElementById('assistantCreativeClearBtn')?.addEventListener('click', () => {
      const style = document.getElementById('assistantCreativeStyleDirective');
      const name = document.getElementById('assistantCreativeCharacterName');
      const desc = document.getElementById('assistantCreativeCharacterDescription');
      const ref = document.getElementById('assistantCreativeReferenceImageUrl');
      if (style) style.value = '';
      if (name) name.value = '';
      if (desc) desc.value = '';
      if (ref) ref.value = '';
      showToast('Creative Direction cleared (click Save to persist).');
    });

    const updateSelectOptions = (selectId, models, selectedId) => {
      const el = document.getElementById(selectId);
      if (!el) return;
      el.innerHTML = buildModelOptions(models, selectedId);
    };

    if (!creditsMode) {
      document.getElementById('assistantUserTier')?.addEventListener('change', async (e) => {
        const nextTier = String(e?.target?.value || 'starter');
        const nextQuery = `&tier=${encodeURIComponent(nextTier)}`;
        const fetchTierModels = async (capability) => {
          try {
            const res = await apiJson(`https://aitopia.ai/api/models?capability=${encodeURIComponent(capability)}${nextQuery}`);
            return Array.isArray(res?.models) ? res.models : [];
          } catch {
            return [];
          }
        };

        const currentVideo = document.getElementById('assistantVideoModel')?.value || '';
        const currentImage = document.getElementById('assistantImageModel')?.value || '';
        const currentVoice = document.getElementById('assistantVoiceModel')?.value || '';

        [videoModels, imageModels, voiceModels] = await Promise.all([
          fetchTierModels('video-generation'),
          fetchTierModels('image-generation'),
          fetchTierModels('text-to-speech'),
        ]);

        updateSelectOptions('assistantVideoModel', videoModels, currentVideo);
        updateSelectOptions('assistantImageModel', imageModels, currentImage);
        updateSelectOptions('assistantVoiceModel', voiceModels, currentVoice);
      });
    }

    document.getElementById('policySaveBtn')?.addEventListener('click', async () => {
      try {
        const userTier = creditsMode ? prefs.userTier : (document.getElementById('assistantUserTier')?.value || 'starter');
        const llmModelId = document.getElementById('assistantLlmModel')?.value || '';

        const videoModelId = document.getElementById('assistantVideoModel')?.value || '';
        const imageModelId = document.getElementById('assistantImageModel')?.value || '';
        const voiceModelId = document.getElementById('assistantVoiceModel')?.value || '';

        const pickProvider = (models, selectedId) => {
          const picked = selectedId ? models.find((m) => m && m.id === selectedId) : null;
          return picked?.provider ? String(picked.provider) : '';
        };

        const maxTaskRaw = Number(document.getElementById('assistantMaxTaskCredits')?.value || 0);
        const maxTaskCredits = Number.isFinite(maxTaskRaw) && maxTaskRaw > 0 ? Math.floor(maxTaskRaw) : null;
        const warnRaw = Number(document.getElementById('assistantWarnAtPercent')?.value || 80);
        const warnAtPercent = Number.isFinite(warnRaw) ? Math.max(1, Math.min(99, Math.round(warnRaw))) : 80;
        const maxByModelCreditsJson = document.getElementById('assistantMaxByModelCreditsJson')?.value || '';

        const creativeStyleDirective = (document.getElementById('assistantCreativeStyleDirective')?.value || '').trim();
        const creativeCharacterName = (document.getElementById('assistantCreativeCharacterName')?.value || '').trim();
        const creativeCharacterDescription = (document.getElementById('assistantCreativeCharacterDescription')?.value || '').trim();
        const creativeReferenceImageUrl = (document.getElementById('assistantCreativeReferenceImageUrl')?.value || '').trim();

        uiPrefs = saveUiPrefs({
          ...prefs,
          userTier,
          models: {
            llm: { modelId: llmModelId },
            video: { selectedModelId: videoModelId, preferredProvider: pickProvider(videoModels, videoModelId) },
            image: { selectedModelId: imageModelId, preferredProvider: pickProvider(imageModels, imageModelId) },
            voice: { selectedModelId: voiceModelId, preferredProvider: pickProvider(voiceModels, voiceModelId) },
          },
          budgets: { maxTaskCredits, warnAtPercent, maxByModelCreditsJson },
          creative: {
            styleDirective: creativeStyleDirective,
            character: {
              name: creativeCharacterName,
              description: creativeCharacterDescription,
              referenceImageUrl: creativeReferenceImageUrl,
            },
          },
        });

        const allowedAgentIds = Array.from(document.querySelectorAll('#settingsModal input[data-agent-id]:checked'))
          .map((n) => n.getAttribute('data-agent-id'))
          .filter(Boolean);
        const allowedToolNames = Array.from(document.querySelectorAll('#settingsModal input[data-tool-name]:checked'))
          .map((n) => n.getAttribute('data-tool-name'))
          .filter(Boolean);

        const planningMode = document.getElementById('policyPlanningMode')?.value || 'auto';
        const thresholdRaw = Number(document.getElementById('policyCostThreshold')?.value || (creditsMode ? 25 : 0.5));
        const threshold = Number.isFinite(thresholdRaw) ? Math.max(0, thresholdRaw) : (creditsMode ? 25 : 0.5);
        const modelsRunCostUsdOver = creditsMode ? threshold * usdPerCredit : threshold;

        const requireForVideo = Boolean(document.getElementById('policyApproveVideo')?.checked);
        const requireForExternalDomains = Boolean(document.getElementById('policyApproveExternal')?.checked);

        const updated = await apiJson('https://aitopia.ai/api/policies/superagent', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            allowedAgentIds,
            allowedToolNames,
            planning: { mode: planningMode },
            approvals: { modelsRunCostUsdOver, requireForVideo, requireForExternalDomains },
          }),
        });

        supervisorPolicy = { agentId: 'superagent', policy: updated.policy, source: 'user' };
        removeModal('settingsModal');
        showToast('Saved.');
      } catch (err) {
        showToast(err?.message || 'Save failed');
      }
    });
  } catch (err) {
    showToast(err?.message || 'Failed to load settings');
  }
});
el.toggleActivity?.addEventListener('click', () => {
  if (!el.activityPanel) return;
  el.activityPanel.classList.toggle('hidden');
});
el.clearActivityBtn?.addEventListener('click', clearActivity);

document.querySelectorAll('.suggestion[data-prompt]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const prompt = btn.getAttribute('data-prompt') || '';
    if (el.input) el.input.value = prompt;
    void runStream(prompt);
  });
});

el.input?.addEventListener('input', () => autosizeTextarea(el.input));
el.input?.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  if (e.shiftKey) return;
  e.preventDefault();
  void runStream(el.input?.value);
});

if (el.input) autosizeTextarea(el.input);

// Best-effort preload policy/options so the Settings modal opens instantly.
void loadSupervisorPolicy().catch(() => {});
void loadSupervisorOptions().catch(() => {});
void loadBillingConfig().catch(() => {});
