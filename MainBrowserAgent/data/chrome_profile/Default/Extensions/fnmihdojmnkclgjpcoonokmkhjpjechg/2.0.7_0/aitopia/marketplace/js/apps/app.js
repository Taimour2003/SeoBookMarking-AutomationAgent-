import { fetchHelper } from '../shared/fetch-helper.js';
import { renderSchemaForm } from '../runner/schema-form.js';
import { renderOutput } from '../runner/result-renderer.js';

const els = {
  title: document.getElementById('appTitle'),
  description: document.getElementById('appDescription'),
  root: document.getElementById('appRoot'),
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

async function readJson(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text };
  }
}

function getQueryParam(name) {
  try {
    const params = new URLSearchParams(window.location.search);
    const value = params.get(name);
    return value && value.trim().length > 0 ? value.trim() : null;
  } catch {
    return null;
  }
}

function setRootHtml(html) {
  if (!els.root) return;
  els.root.innerHTML = html;
}

function setHeader({ title, description }) {
  if (els.title) els.title.textContent = title || 'App Runner';
  if (els.description) els.description.textContent = description || '';
  if (title) document.title = `${title} | AITOPIA`;
}

function renderError(message) {
  setRootHtml(`
    <div class="rounded-ios-2xl border border-red-500/30 bg-red-500/10 text-red-500 px-5 py-4 text-sm">
      ${escapeHtml(message || 'Something went wrong')}
    </div>
  `);
}

async function apiJson(path, options = {}) {
  const res = await fetchHelper(path, {
    headers: { Accept: 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const json = await readJson(res);
  if (!res.ok) {
    const msg = json?.error?.message || json?.error || json?._raw || `HTTP ${res.status}`;
    throw new Error(String(msg));
  }
  return json;
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

function formLayout() {
  return `
    <div class="grid lg:grid-cols-2 gap-6">
      <div class="rounded-ios-2xl border border-border bg-card p-6">
        <div class="flex items-center justify-between gap-3 mb-4">
          <h2 class="font-semibold">Input</h2>
          <div id="runMeta" class="text-xs text-muted-foreground"></div>
        </div>
        <div id="formContainer"></div>
        <button id="runBtn" type="button" class="mt-4 w-full h-12 rounded-2xl bg-primary/90 hover:bg-primary/90/90 text-white font-semibold text-[13px] disabled:opacity-60 disabled:cursor-not-allowed">
          Generate
        </button>
        <p id="runHint" class="mt-3 text-xs text-muted-foreground"></p>
      </div>

      <div class="rounded-ios-2xl border border-border bg-card p-6">
        <div class="flex items-center justify-between gap-3 mb-4">
          <h2 class="font-semibold">Result</h2>
          <div id="statusPill" class="hidden text-xs px-3 py-1 rounded-full bg-secondary text-foreground"></div>
        </div>
        <div id="outputContainer" class="min-h-[200px] flex items-center justify-center">
          <div class="text-center p-6">
            <p class="text-sm text-muted-foreground">Your result will appear here</p>
            <p class="text-xs text-muted-foreground mt-1">Fill the inputs and click Generate</p>
          </div>
        </div>
      </div>
    </div>
  `.trim();
}

function chatLayout() {
  return `
    <div class="rounded-ios-2xl border border-border bg-card overflow-hidden">
      <div class="p-4 border-b border-border flex items-center justify-between gap-3">
        <div>
          <div class="text-sm font-semibold">Chat</div>
          <div id="chatHint" class="text-xs text-muted-foreground mt-0.5"></div>
        </div>
        <button id="newChatBtn" type="button" class="h-9 px-4 rounded-full bg-secondary hover:bg-secondary/80 text-sm font-semibold transition-colors">
          New chat
        </button>
      </div>

      <div id="chatMessages" class="p-4 space-y-3 max-h-[65vh] overflow-auto bg-background/40"></div>

      <div class="p-4 border-t border-border flex items-end gap-2 bg-card">
        <textarea id="chatInput" rows="2" placeholder="Type a message…" class="flex-1 min-h-[44px] max-h-40 px-3 py-2 rounded-ios-xl bg-secondary/80 border-0 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-y"></textarea>
        <button id="chatSendBtn" type="button" class="h-11 px-5 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60">
          Send
        </button>
      </div>
    </div>
  `.trim();
}

function messageBubble({ role, content, pending }) {
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
    <div class="max-w-[85%] rounded-ios-2xl border border-border bg-background/40 px-4 py-3 text-sm whitespace-pre-wrap break-words">
      <div class="flex items-center gap-2 mb-2">
        <div class="w-6 h-6 rounded-full bg-gradient-to-br from-primary/90 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">✨</div>
        <div class="text-xs text-muted-foreground">${pending ? 'Thinking…' : 'Assistant'}</div>
      </div>
      <div class="assistant-content">${escapeHtml(content)}</div>
      <div class="assistant-meta text-xs text-muted-foreground mt-2"></div>
    </div>
  `;
  return row;
}

function appendChatMessage(container, role, content, { pending = false } = {}) {
  const node = messageBubble({ role, content, pending });
  container.appendChild(node);
  container.scrollTop = container.scrollHeight;
  return node;
}

function setAssistantContent(node, content, { pendingLabel } = {}) {
  const label = node?.querySelector?.('.text-xs.text-muted-foreground');
  if (label && typeof pendingLabel === 'string') label.textContent = pendingLabel;
  const contentEl = node?.querySelector?.('.assistant-content');
  if (contentEl) contentEl.textContent = content;
}

function setAssistantMeta(node, meta) {
  const metaEl = node?.querySelector?.('.assistant-meta');
  if (metaEl) metaEl.textContent = meta ? String(meta) : '';
}

async function pollJob(jobId, { onUpdate } = {}) {
  const started = Date.now();
  let attempt = 0;
  while (true) {
    attempt += 1;
    const res = await fetchHelper(`https://aitopia.ai/jobs/${encodeURIComponent(jobId)}`, { method: 'GET', headers: { Accept: 'application/json' } });
    const json = await readJson(res);
    if (!res.ok) throw new Error(json?.error?.message || json?.error || `Failed to poll job (${res.status})`);

    const status = json?.status || json?.job?.status;
    const output = json?.output || json?.job?.output;
    const error = json?.error || json?.job?.error;

    if (typeof onUpdate === 'function') onUpdate({ status, attempt, elapsedMs: Date.now() - started });

    if (status === 'completed') return { output };
    if (status === 'failed') throw new Error(error || 'Job failed');
    if (status === 'cancelled') throw new Error('Job cancelled');

    const sleepMs = Math.min(1500, 350 + attempt * 50);
    await new Promise((r) => setTimeout(r, sleepMs));
  }
}

async function bootFormMode(appId) {
  setRootHtml(formLayout());

  const formContainer = document.getElementById('formContainer');
  const outputContainer = document.getElementById('outputContainer');
  const runBtn = document.getElementById('runBtn');
  const hint = document.getElementById('runHint');
  const pill = document.getElementById('statusPill');
  const meta = document.getElementById('runMeta');

  const schemaRes = await apiJson(`https://aitopia.ai/api/apps/${encodeURIComponent(appId)}/schema/json`);
  const schema = { input: schemaRes?.input, output: schemaRes?.output };

  const form = renderSchemaForm({ schema, container: formContainer });

  const setHint = (text) => {
    if (!hint) return;
    hint.textContent = text || '';
  };

  const setStatus = (text) => {
    if (!pill) return;
    if (!text) {
      pill.classList.add('hidden');
      pill.textContent = '';
      return;
    }
    pill.classList.remove('hidden');
    pill.textContent = text;
  };

  const setMeta = (text) => {
    if (!meta) return;
    meta.textContent = text || '';
  };

  const setBusy = (busy) => {
    if (!runBtn) return;
    runBtn.disabled = Boolean(busy);
    runBtn.textContent = busy ? 'Generating…' : 'Generate';
  };

  runBtn?.addEventListener('click', async () => {
    setHint('');
    setStatus('');
    setMeta('');

    let input;
    try {
      input = form.getValues();
    } catch (err) {
      setHint(err instanceof Error ? err.message : String(err));
      return;
    }

    setBusy(true);
    try {
      const idempotencyKey = `app-${appId}-${uuid()}`;
      const res = await fetchHelper(`https://aitopia.ai/api/apps/${encodeURIComponent(appId)}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({ input, async: false }),
      });
      const json = await readJson(res);
      if (!res.ok) {
        const msg = json?.error?.message || json?.error || json?._raw || `Run failed (${res.status})`;
        throw new Error(String(msg));
      }

      if (res.status === 202 && json?.jobId) {
        setStatus('Processing…');
        const jobId = String(json.jobId);
        const jobResult = await pollJob(jobId, {
          onUpdate: ({ status }) => setMeta(status ? `Job: ${status}` : ''),
        });
        const out = jobResult?.output;
        setStatus('Done');
        if (outputContainer) renderOutput(outputContainer, out);
        return;
      }

      setStatus(String(json?.status || 'Done'));
      if (outputContainer) renderOutput(outputContainer, json?.output);

      const usage = json?.usage;
      if (usage && typeof usage === 'object') {
        const parts = [];
        if (typeof usage.costUsd === 'number' && Number.isFinite(usage.costUsd)) parts.push(`Cost: $${usage.costUsd.toFixed(2)}`);
        if (typeof usage.modelUsed === 'string' && usage.modelUsed.trim()) parts.push(`LLM: ${usage.modelUsed}`);
        if (typeof usage.durationMs === 'number' && Number.isFinite(usage.durationMs) && usage.durationMs > 0) parts.push(`Time: ${(usage.durationMs / 1000).toFixed(1)}s`);
        setMeta(parts.join(' • '));
      }
    } catch (err) {
      setHint(err instanceof Error ? err.message : String(err));
      setStatus('Error');
    } finally {
      setBusy(false);
    }
  });
}

async function bootChatMode(appId, { chatInputId }) {
  setRootHtml(chatLayout());

  const messagesEl = document.getElementById('chatMessages');
  const inputEl = document.getElementById('chatInput');
  const sendBtn = document.getElementById('chatSendBtn');
  const hintEl = document.getElementById('chatHint');
  const newChatBtn = document.getElementById('newChatBtn');

  if (!messagesEl || !inputEl || !sendBtn) {
    renderError('Chat UI failed to load.');
    return;
  }

  const setHint = (text) => {
    if (!hintEl) return;
    hintEl.textContent = text || '';
  };

  const conversationHistory = [];
  let activeController = null;

  const clearChat = () => {
    messagesEl.innerHTML = '';
    conversationHistory.length = 0;
    setHint('');
  };

  newChatBtn?.addEventListener('click', () => {
    if (activeController) activeController.abort();
    clearChat();
  });

  const send = async () => {
    const text = String(inputEl.value || '').trim();
    if (!text) return;

    if (activeController) activeController.abort();
    const controller = new AbortController();
    activeController = controller;

    inputEl.value = '';
    appendChatMessage(messagesEl, 'user', text);
    const contextHistory = conversationHistory.slice(-16);

    const assistantNode = appendChatMessage(messagesEl, 'assistant', '', { pending: true });
    let assistantText = '';

    sendBtn.disabled = true;
    inputEl.disabled = true;
    setHint('Connecting…');

    const res = await fetchHelper(`https://aitopia.ai/api/apps/${encodeURIComponent(appId)}/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        'Idempotency-Key': `appstream-${uuid()}`,
      },
      body: JSON.stringify({
        input: { [chatInputId]: text },
        context: { conversationHistory: contextHistory },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const raw = await res.text().catch(() => '');
      const msg = raw || `HTTP ${res.status}`;
      setAssistantContent(assistantNode, msg, { pendingLabel: 'Error' });
      setHint('');
      sendBtn.disabled = false;
      inputEl.disabled = false;
      activeController = null;
      return;
    }

    try {
      for await (const { eventType, payload: evt } of sseEvents(res, controller.signal)) {
        const type = evt?.type || eventType;
        const data = evt?.data || {};

        if (type === 'token') {
          assistantText += String(data?.content || '');
          setAssistantContent(assistantNode, assistantText, { pendingLabel: 'Assistant' });
          setHint('');
          continue;
        }

        if (type === 'thinking') {
          const t = String(data?.content || '').trim();
          if (t) setHint('Thinking…');
          continue;
        }

        if (type === 'error') {
          const msg = data?.message ? String(data.message) : 'Error';
          setAssistantContent(assistantNode, assistantText || msg, { pendingLabel: 'Error' });
          setHint('');
          continue;
        }

        if (type === 'done') {
          setHint('');
          const doneData = data || null;
          const usage = doneData?.usage;
          const metaParts = [];
          if (usage && typeof usage === 'object') {
            if (typeof usage.costUsd === 'number' && Number.isFinite(usage.costUsd)) metaParts.push(`Cost: $${usage.costUsd.toFixed(2)}`);
            if (typeof usage.modelUsed === 'string' && usage.modelUsed.trim()) metaParts.push(`LLM: ${usage.modelUsed}`);
            if (typeof usage.durationMs === 'number' && Number.isFinite(usage.durationMs) && usage.durationMs > 0) metaParts.push(`Time: ${(usage.durationMs / 1000).toFixed(1)}s`);
          }
          if (metaParts.length > 0) setAssistantMeta(assistantNode, metaParts.join(' • '));

          if (!assistantText.trim() && doneData?.result !== undefined) {
            const fallback = typeof doneData.result === 'string'
              ? doneData.result
              : (() => {
                try {
                  return JSON.stringify(doneData.result ?? null, null, 2);
                } catch {
                  return String(doneData.result ?? '');
                }
              })();
            setAssistantContent(assistantNode, fallback, { pendingLabel: 'Assistant' });
            assistantText = fallback;
          }

          conversationHistory.push({ role: 'user', content: text });
          conversationHistory.push({ role: 'assistant', content: assistantText || '' });
          break;
        }
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setAssistantContent(assistantNode, assistantText || (err instanceof Error ? err.message : String(err)), { pendingLabel: 'Error' });
        setHint('');
      }
    } finally {
      sendBtn.disabled = false;
      inputEl.disabled = false;
      activeController = null;
    }
  };

  sendBtn.addEventListener('click', () => void send());
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void send();
    }
  });

  setHint('Tip: Press Ctrl/Cmd+Enter to send');
}

async function init() {
  const appId = getQueryParam('appId');
  if (!appId) {
    setHeader({ title: 'Missing appId', description: '' });
    renderError('Missing `appId` query parameter.');
    return;
  }

  try {
    setRootHtml(`
      <div class="rounded-ios-2xl border border-border bg-card p-6">
        <div class="text-sm text-muted-foreground">Loading…</div>
      </div>
    `);

    const { app, currentVersion } = await apiJson(`https://aitopia.ai/api/apps/${encodeURIComponent(appId)}`);
    const title = app?.name ? String(app.name) : `App ${appId}`;
    const description = String(app?.description || currentVersion?.definition?.description || '').trim();
    setHeader({ title, description });

    const uiMode = currentVersion?.definition?.ui?.mode || 'form';
    if (uiMode === 'chat') {
      const inputs = Array.isArray(currentVersion?.definition?.inputs) ? currentVersion.definition.inputs : [];
      const chatInput = inputs.find((i) => i && i.type === 'chat') ?? null;
      const chatInputId = chatInput?.id ? String(chatInput.id) : '';
      if (!chatInputId) {
        renderError('This app is in chat mode but has no chat input defined.');
        return;
      }
      await bootChatMode(appId, { chatInputId });
      return;
    }
    await bootFormMode(appId);
  } catch (error) {
    renderError(error instanceof Error ? error.message : String(error));
  }
}

void init();
