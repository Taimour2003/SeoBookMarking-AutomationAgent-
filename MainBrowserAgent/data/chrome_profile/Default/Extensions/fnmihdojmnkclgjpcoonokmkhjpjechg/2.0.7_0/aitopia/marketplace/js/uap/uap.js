import { getStoreAgent, getAgentSchema, runStoreAgent, getJob } from '../shared/api.js';
import { renderSchemaForm } from '../runner/schema-form.js';
import { renderOutput } from '../runner/result-renderer.js';
import { getOverrideModulePath } from '../runner/overrides-registry.js';
import { createUAPState } from './uap-state.js';
import { createAgentPicker } from './uap-agent-picker.js';
import { buildTemplateFromSchema, formatJsonText, normalizeRunBodyFromRawJson, parseRawJson } from './uap-json-input.js';

function $(id) {
  return document.getElementById(id);
}

function setHidden(el, hidden) {
  if (!el) return;
  el.classList.toggle('hidden', Boolean(hidden));
}

function getCreditsDisplayForModelChoice(choice) {
  return window.AitopiaCredits?.getCreditsDisplayForModelChoice?.(choice) ?? '';
}

function setStatus(text, tone = 'neutral') {
  const pill = $('statusPill');
  if (!pill) return;
  if (!text) {
    setHidden(pill, true);
    return;
  }
  setHidden(pill, false);
  pill.textContent = text;
  pill.classList.remove(
    'bg-red-500/10',
    'text-red-600',
    'dark:text-red-400',
    'bg-green-500/10',
    'text-green-700',
    'dark:text-green-300',
    'bg-neutral-100',
    'text-neutral-700',
    'dark:bg-neutral-800',
    'dark:text-neutral-200'
  );
  if (tone === 'error') pill.classList.add('bg-red-500/10', 'text-red-600', 'dark:text-red-400');
  else if (tone === 'success') pill.classList.add('bg-green-500/10', 'text-green-700', 'dark:text-green-300');
  else pill.classList.add('bg-neutral-100', 'text-neutral-700', 'dark:bg-neutral-800', 'dark:text-neutral-200');
}

function setJsonError(message) {
  const el = $('jsonError');
  if (!el) return;
  if (!message) {
    el.textContent = '';
    setHidden(el, true);
    return;
  }
  el.textContent = message;
  setHidden(el, false);
}

function normalizeAssetUrl(url) {
  if (typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('/')
  ) {
    return trimmed;
  }
  if (trimmed.startsWith('./')) return `/${trimmed.slice(2)}`;
  return `/${trimmed}`;
}

function createAbortError() {
  try {
    return new DOMException('Aborted', 'AbortError');
  } catch {
    const err = new Error('Aborted');
    err.name = 'AbortError';
    return err;
  }
}

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

function applyXuapReadOnly(propSchema, value) {
  if (!propSchema || typeof propSchema !== 'object') return;
  const direct = propSchema;
  const nested = direct['x-uap'] && typeof direct['x-uap'] === 'object' ? direct['x-uap'] : {};
  direct['x-uap'] = nested;
  nested.readOnly = Boolean(value);
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

let lastPublishContext = null;

function clearPublishActions(container) {
  if (!container) return;
  container.querySelector?.('[data-uap-output-actions="1"]')?.remove?.();
}

function buildPublishModalHtml() {
  return `
    <div class="bg-white dark:bg-neutral-900 border border-black/10 dark:border-white/10 rounded-ios-2xl shadow-2xl w-full max-w-lg mx-4 p-6">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h2 class="text-lg font-semibold">Publish creation</h2>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Create a shareable link and allow others to remix this creation.</p>
        </div>
        <button type="button" data-publish-cancel class="p-2 rounded-ios-lg hover:bg-neutral-100 dark:hover:bg-neutral-800" aria-label="Close">
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </div>

      <div class="mt-5 space-y-4">
        <div>
          <label class="block text-sm font-medium mb-1">Title</label>
          <input data-publish-title type="text" class="w-full text-sm bg-white dark:bg-neutral-950 border border-black/10 dark:border-white/10 rounded-ios-lg px-3 py-2" placeholder="Give it a memorable name" />
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">Description (optional)</label>
          <textarea data-publish-description class="w-full text-sm bg-white dark:bg-neutral-950 border border-black/10 dark:border-white/10 rounded-ios-lg px-3 py-2 h-20" placeholder="What did you create?"></textarea>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-medium mb-1">Visibility</label>
            <select data-publish-visibility class="w-full text-sm bg-white dark:bg-neutral-950 border border-black/10 dark:border-white/10 rounded-ios-lg px-3 py-2">
              <option value="public">Public (appears after review)</option>
              <option value="unlisted">Unlisted (link-only)</option>
              <option value="private">Private (only you)</option>
            </select>
          </div>
          <div class="flex items-end">
            <label class="flex items-center gap-2 text-sm select-none cursor-pointer">
              <input data-publish-allow-remix type="checkbox" class="w-4 h-4 accent-primary/90" checked />
              Allow remixing
            </label>
          </div>
        </div>

        <div data-publish-error class="hidden text-sm text-red-600 dark:text-red-400"></div>
        <div data-publish-success class="hidden text-sm text-green-600 dark:text-green-400"></div>
      </div>

      <div class="mt-6 flex gap-3">
        <button type="button" data-publish-cancel class="flex-1 h-11 rounded-full bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-sm font-semibold">Cancel</button>
        <button type="button" data-publish-submit class="flex-1 h-11 rounded-full bg-primary/90 hover:bg-primary/90/90 text-white text-sm font-semibold">Publish</button>
      </div>
    </div>
  `;
}

function openPublishModal(context) {
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-[100] bg-black/60 flex items-center justify-center';
  overlay.innerHTML = buildPublishModalHtml();

  const modal = overlay.firstElementChild;
  const titleEl = modal.querySelector('[data-publish-title]');
  const descEl = modal.querySelector('[data-publish-description]');
  const visEl = modal.querySelector('[data-publish-visibility]');
  const allowEl = modal.querySelector('[data-publish-allow-remix]');
  const errEl = modal.querySelector('[data-publish-error]');
  const okEl = modal.querySelector('[data-publish-success]');
  const submitBtn = modal.querySelector('[data-publish-submit]');

  const close = () => overlay.remove();
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  modal.querySelectorAll('[data-publish-cancel]').forEach((btn) => btn.addEventListener('click', close));

  const showError = (msg) => {
    if (!errEl) return;
    errEl.textContent = msg;
    errEl.classList.remove('hidden');
  };
  const clearError = () => {
    if (!errEl) return;
    errEl.textContent = '';
    errEl.classList.add('hidden');
  };
  const showSuccess = (msg) => {
    if (!okEl) return;
    okEl.textContent = msg;
    okEl.classList.remove('hidden');
  };

  submitBtn?.addEventListener('click', async () => {
    clearError();
    if (submitBtn) submitBtn.disabled = true;

    let succeeded = false;
    try {
      const title = String(titleEl?.value || '').trim();
      const description = String(descEl?.value || '').trim();
      const visibility = String(visEl?.value || 'public');
      const allowRemix = Boolean(allowEl?.checked);

      if (!title) {
        showError('Title is required.');
        return;
      }

      const input = context?.input && typeof context.input === 'object' && !Array.isArray(context.input) ? context.input : {};
      const pinned = allowRemix ? [] : Object.keys(input);

      const payload = {
        sourceIdempotencyKey: context.idempotencyKey,
        ...(context?.derivedFromOutputId ? { derivedFromOutputId: context.derivedFromOutputId } : {}),
        title,
        ...(description ? { description } : {}),
        visibility,
        remixSpec: {
          version: 1,
          pinnedInputKeys: pinned,
          defaults: input,
        },
      };

      const res = await fetch('https://aitopia.ai/api/outputs', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = safeJsonParse(await res.text());

      if (!res.ok) {
        const msg = json?.error?.message || json?.error || `Publish failed (${res.status})`;
        showError(String(msg));
        return;
      }

      succeeded = true;
      const output = json?.output;
      const outputId = output?.id;
      if (!outputId) {
        showSuccess('Published.');
        setTimeout(() => close(), 1200);
        return;
      }

      const shareUrl = `${window.location.origin}/creations/${encodeURIComponent(outputId)}`;
      const remixUrl = `${window.location.origin}/creations/${encodeURIComponent(outputId)}/remix`;
      const pending = output?.visibility === 'public' && output?.moderationStatus !== 'approved';

      showSuccess(pending ? 'Published (pending review). Links copied to clipboard.' : 'Published. Links copied to clipboard.');

      const text = `${shareUrl}\n${allowRemix ? `Remix creation: ${remixUrl}` : ''}`.trim();
      await navigator.clipboard?.writeText?.(text).catch(() => null);

      setTimeout(() => close(), 1000);
    } catch (e) {
      showError(e?.message || 'Publish failed.');
    } finally {
      if (submitBtn && !succeeded) submitBtn.disabled = false;
    }
  });

  document.body.appendChild(overlay);
}

function renderPublishActions(container, context) {
  if (!container) return;
  clearPublishActions(container);
  if (!context?.idempotencyKey) return;

  const bar = document.createElement('div');
  bar.dataset.uapOutputActions = '1';
  bar.className = 'mb-4 flex flex-wrap gap-2 items-center justify-between';
  bar.innerHTML = `
    <div class="text-xs text-gray-500 dark:text-gray-400 truncate">
      Publish this result as a Creation and allow remixing.
    </div>
    <div class="flex gap-2">
      <a href="/aitopia/marketplace/outputs.html" class="h-10 px-4 inline-flex items-center justify-center rounded-full bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-sm font-semibold">Creations</a>
      <button type="button" class="h-10 px-4 rounded-full bg-primary/90 hover:bg-primary/90/90 text-white text-sm font-semibold" data-publish-btn="1">Publish</button>
    </div>
  `;
  bar.querySelector('[data-publish-btn="1"]')?.addEventListener('click', () => openPublishModal(context));
  container.insertAdjacentElement('afterbegin', bar);
}

async function pollJob(jobId, { signal, onTick, intervalMs = 1500, timeoutMs = 10 * 60 * 1000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (signal?.aborted) throw createAbortError();
    const job = await getJob(jobId, signal ? { signal } : undefined);
    onTick?.(job);
    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') return job;
    await new Promise((resolve, reject) => {
      const t = setTimeout(resolve, intervalMs);
      if (signal) {
        signal.addEventListener('abort', () => {
          clearTimeout(t);
          reject(createAbortError());
        }, { once: true });
      }
    });
  }
  throw new Error('Job timed out');
}

function setActiveTab(tab) {
  const tabForm = $('tabForm');
  const tabJson = $('tabJson');
  const formTab = $('formTab');
  const jsonTab = $('jsonTab');

  const isForm = tab === 'form';
  setHidden(formTab, !isForm);
  setHidden(jsonTab, isForm);

  const formDisabled = Boolean(tabForm?.disabled);

  if (tabForm) {
    if (formDisabled) {
      tabForm.className =
        'px-3 py-1.5 rounded-ios-lg text-sm font-medium bg-neutral-100 text-gray-400 dark:bg-neutral-800 dark:text-gray-500 opacity-60 cursor-not-allowed';
    } else {
      tabForm.className = isForm
        ? 'px-3 py-1.5 rounded-ios-lg text-sm font-medium bg-primary/90 text-primary-foreground'
        : 'px-3 py-1.5 rounded-ios-lg text-sm font-medium bg-neutral-100 text-gray-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-gray-200 dark:hover:bg-neutral-700';
    }
  }
  if (tabJson) {
    tabJson.className = !isForm
      ? 'px-3 py-1.5 rounded-ios-lg text-sm font-medium bg-primary/90 text-primary-foreground'
      : 'px-3 py-1.5 rounded-ios-lg text-sm font-medium bg-neutral-100 text-gray-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-gray-200 dark:hover:bg-neutral-700';
  }
}

async function main() {
  const state = createUAPState({
    inputTab: 'form',
    agents: [],
    selectedAgentId: null,
    selectedAgent: null,
    selectedSchema: null,
    remix: null,
  });

  let formController = null;
  let selectionSeq = 0;
  let runSeq = 0;
  let runAbortController = null;
  let creditsBalanceData = null;

  function invalidateActiveRun({ abort } = { abort: true }) {
    runSeq += 1;
    if (abort && runAbortController) {
      try {
        runAbortController.abort();
      } catch {
        // ignore
      }
      runAbortController = null;
    }
    return runSeq;
  }

  const picker = createAgentPicker({
    searchInput: $('agentSearch'),
    listContainer: $('agentList'),
    countEl: $('agentCount'),
    showUnavailableCheckbox: $('showUnavailable'),
    onSelect: async (agentId) => {
      await selectAgent(agentId);
    },
  });

  $('tabForm')?.addEventListener('click', () => {
    if ($('tabForm')?.disabled) return;
    state.set({ inputTab: 'form' });
    setJsonError('');
    setActiveTab('form');
  });
  $('tabJson')?.addEventListener('click', () => {
    state.set({ inputTab: 'json' });
    setJsonError('');
    setActiveTab('json');
  });

  $('jsonFormatBtn')?.addEventListener('click', () => {
    try {
      const textarea = $('jsonTextarea');
      if (!textarea) return;
      textarea.value = formatJsonText(textarea.value);
      setJsonError('');
    } catch (err) {
      setJsonError(err?.message || String(err));
    }
  });

  $('runButton')?.addEventListener('click', async () => {
    await runSelected();
  });

  $('jsonTemplateBtn')?.addEventListener('click', () => {
    const textarea = $('jsonTextarea');
    if (!textarea) return;
    const s = state.get().selectedSchema;
    if (!s) {
      setJsonError('Schema not available for this agent. Paste an input JSON manually.');
      return;
    }
    textarea.value = JSON.stringify(buildTemplateFromSchema(s), null, 2);
    setJsonError('');
    setActiveTab('json');
    state.set({ inputTab: 'json' });
  });

  async function loadAgents() {
    $('agentCount').textContent = '…';
    try {
      const res = await fetch('https://aitopia.ai/api/store', { credentials: 'include' });
      const json = await res.json();
      const all = Array.isArray(json?.agents) ? json.agents : [];
      const agents = all
        .filter(a => a && typeof a === 'object' && typeof a.id === 'string')
        ;

      state.set({ agents });
      picker.setAgents(agents);
    } catch (err) {
      $('agentCount').textContent = '0';
      const list = $('agentList');
      list.innerHTML = '';
      const msg = document.createElement('div');
      msg.className = 'p-4 text-sm text-red-600 dark:text-red-400';
      msg.textContent = err?.message || String(err);
      list.appendChild(msg);
    }
  }

  function getGenerateButtonText(agent) {
    if (!agent) return 'Generate';
    const creditsInfo = window.AitopiaCredits?.getCreditsInfoForAgent?.(agent);
    if (creditsInfo?.label) {
      return `Generate · ${creditsInfo.label}`;
    }
    return 'Generate';
  }

  function setSelectedMeta(agent) {
    const meta = $('selectedMeta');
    if (!meta) return;
    meta.innerHTML = '';

    if (!agent) return;

    const entries = [];
    if (agent.category) entries.push(['Category', agent.category]);
    if (agent.primaryCategory) entries.push(['Primary', agent.primaryCategory]);
    if (agent.async != null) entries.push(['Mode', agent.async ? 'async' : 'sync']);
    if (agent.available === false) entries.push(['Status', 'unavailable']);
    if (agent.unavailableReason) entries.push(['Reason', agent.unavailableReason]);
    if (agent.modelCapability) entries.push(['Capability', agent.modelCapability]);
    const costLabel = window.AitopiaCredits?.getCreditsInfoForAgent?.(agent)?.label;
    if (costLabel) entries.push(['Est. cost', String(costLabel)]);
    // Credits today display disabled
    /*
    if (creditsBalanceData?.balance) {
      const balance = creditsBalanceData.balance;
      const daily = `${balance.dailyCreditsRemaining} / ${balance.dailyAllowanceCredits}`;
      const paid = balance.paidCreditsBalance > 0 ? ` + ${balance.paidCreditsBalance} paid` : '';
      const label = creditsBalanceData.subjectType === 'user' ? 'Credits today (registered)' : 'Credits today (guest)';
      entries.push([label, `${daily}${paid}`]);
    }
    */

    for (const [k, v] of entries) {
      const span = document.createElement('span');
      span.textContent = `${k}: `;
      const strong = document.createElement('span');
      strong.className = 'font-medium';
      strong.textContent = String(v);
      span.appendChild(strong);
      meta.appendChild(span);
    }
  }

  async function refreshCreditsBalance(options) {
    const data = await window.AitopiaCredits?.loadCreditsBalance?.(options);
    creditsBalanceData = data;
    const { selectedAgent } = state.get();
    if (selectedAgent) setSelectedMeta(selectedAgent);
  }

  function renderModelChooser(agent) {
    const modelChooser = $('modelChooser');
    const modelSelect = $('modelSelect');
    if (!modelChooser || !modelSelect) return;

    const hasChoices = Array.isArray(agent?.modelChoices) && agent.modelChoices.length > 0;
    const selectorEnabledForAgent = agent?.modelSelectorEnabled === true;
    const canShow = Boolean(agent?.id) && hasChoices;
    if (!canShow) {
      setHidden(modelChooser, true);
      modelSelect.innerHTML = '';
      return;
    }

    modelSelect.innerHTML = '';
    for (const choice of agent.modelChoices) {
      const modelId = typeof choice === 'string' ? choice : choice?.id;
      if (!modelId) continue;
      const opt = document.createElement('option');
      opt.value = String(modelId);
      const label = typeof choice === 'string'
        ? String(choice)
        : String(choice.displayName || choice.id || modelId);
      const credits = getCreditsDisplayForModelChoice(choice);
      const star = typeof choice === 'object' && choice?.recommended ? ' ★' : '';
      opt.textContent = `${label}${credits}${star}`;
      modelSelect.appendChild(opt);
    }

    const recommended = agent.modelChoices.find(c => typeof c === 'object' && c?.recommended && c?.id) || null;
    if (recommended?.id) modelSelect.value = String(recommended.id);

    setHidden(modelChooser, modelSelect.options.length === 0);
    modelChooser.classList.add('flex');

    modelSelect.disabled = !selectorEnabledForAgent;
    modelSelect.title = selectorEnabledForAgent
      ? ''
      : 'Model selection is not enabled for this agent/run.';
    modelSelect.classList.toggle('opacity-60', !selectorEnabledForAgent);
  }

  async function selectAgent(agentId) {
    const selectionOptions = arguments.length > 1 && arguments[1] && typeof arguments[1] === 'object'
      ? arguments[1]
      : {};
    const remix = selectionOptions.remix || null;
    const seq = ++selectionSeq;
    invalidateActiveRun({ abort: true });
    state.set({ selectedAgentId: agentId, selectedAgent: null, selectedSchema: null, remix });
    picker.setSelected(agentId);
    setStatus('Loading…');
    setJsonError('');

    const output = $('outputContainer');
    if (output) {
      output.classList.add('text-gray-500', 'dark:text-gray-400');
      output.innerHTML = 'Select an agent and generate to see results.';
    }

    const runBtn = $('runButton');
    if (runBtn) {
      runBtn.disabled = true;
      runBtn.textContent = 'Generate';
    }

    const nameEl = $('selectedName');
    const descEl = $('selectedDescription');
    if (nameEl) nameEl.textContent = agentId;
    if (descEl) descEl.textContent = '';
    setSelectedMeta(null);

    const icon = $('selectedIcon');
    setHidden(icon, true);
    if (icon) icon.src = '';

    const openRunnerLink = $('openRunnerLink');
    if (openRunnerLink) {
      const remixFrom = remix?.remixFromOutputId;
      openRunnerLink.href = remixFrom
        ? `/aitopia/marketplace/agent/${encodeURIComponent(agentId)}.html?remixOutputId=${encodeURIComponent(remixFrom)}`
        : `/aitopia/marketplace/agent/${encodeURIComponent(agentId)}.html`;
    }

    const jsonTextarea = $('jsonTextarea');
    if (jsonTextarea) jsonTextarea.value = '';
    setJsonError('');

    const formContainer = $('formContainer');
    if (formContainer) {
      formContainer.classList.add('text-gray-500', 'dark:text-gray-400');
      formContainer.innerHTML = 'Loading schema…';
    }

    let agent;
    try {
      agent = await getStoreAgent(agentId);
    } catch (err) {
      setStatus('Failed', 'error');
      if (formContainer) formContainer.innerHTML = `<div class="text-sm text-red-600 dark:text-red-400">${err?.message || String(err)}</div>`;
      return null;
    }
    if (seq !== selectionSeq) return null;

    state.set({ selectedAgent: agent });

    if (nameEl) nameEl.textContent = agent?.name || agentId;
    if (descEl) descEl.textContent = agent?.description || '';
    setSelectedMeta(agent);

    const iconUrl = normalizeAssetUrl(agent?.icon);
    if (icon && iconUrl) {
      icon.src = iconUrl;
      icon.alt = agent?.name || agentId;
      setHidden(icon, false);
    }

    renderModelChooser(agent);
    await refreshCreditsBalance();

    let schema = null;
    try {
      schema = await getAgentSchema(agentId, { ui: 'uap' });
      schema = remix ? applyRemixToSchema(schema, remix) : schema;
      state.set({ selectedSchema: schema });
    } catch (err) {
      schema = null;
      state.set({ selectedSchema: null });
    }
    if (seq !== selectionSeq) return null;

    const jsonTemplateBtn = $('jsonTemplateBtn');
    if (jsonTemplateBtn) jsonTemplateBtn.disabled = !schema;

    const tabForm = $('tabForm');
    if (tabForm) tabForm.disabled = !schema;

    if (!schema) {
      // Form schema not available: force Raw JSON tab.
      setActiveTab('json');
      state.set({ inputTab: 'json' });
      if (formContainer) formContainer.innerHTML = '<div class="text-sm text-gray-500 dark:text-gray-400">Schema not available. Use Raw JSON.</div>';
    } else {
      const overridePath = getOverrideModulePath(agentId);
      try {
        if (overridePath) {
          const mod = await import(overridePath);
          formController = await mod.render({ agent, schema, remix, container: formContainer });
        } else {
          formController = renderSchemaForm({ schema, container: formContainer });
        }
        setActiveTab(state.get().inputTab || 'form');
      } catch (err) {
        formController = null;
        setActiveTab('json');
        state.set({ inputTab: 'json' });
        if (formContainer) {
          formContainer.innerHTML = `<div class="text-sm text-red-600 dark:text-red-400">Failed to render form: ${err?.message || String(err)}. Use Raw JSON.</div>`;
        }
      }
    }

    const hint = $('runHint');
    if (hint) {
      hint.textContent = agent?.async ? 'This agent may run asynchronously. The page will auto-poll for results.' : '';
    }

    if (runBtn) {
      runBtn.disabled = agent?.available === false;
      runBtn.textContent = getGenerateButtonText(agent);
    }

    if (agent?.available === false) {
      setStatus('Unavailable', 'error');
    } else {
      setStatus('');
    }

    return agent;
  }

  async function runSelected() {
    const { selectedAgentId, selectedAgent, selectedSchema, inputTab, remix } = state.get();
    if (!selectedAgentId || !selectedAgent) return;
    if (selectedAgent.available === false) return;

    // Agreement check — show modal if user hasn't agreed yet
    if (window.PendingPaid?.showAgreementModal) {
      const agreed = await window.PendingPaid.showAgreementModal();
      if (!agreed) return;
    }

    const activeSeq = invalidateActiveRun({ abort: true });
    const abortController = new AbortController();
    runAbortController = abortController;
    const { signal } = abortController;

    const runBtn = $('runButton');
    const out = $('outputContainer');
    const modelSelect = $('modelSelect');

    runBtn.disabled = true;
    runBtn.textContent = 'Generating…';
    setStatus('Generating…');

    if (out) {
      clearPublishActions(out);
      lastPublishContext = null;
      out.classList.remove('text-gray-500', 'dark:text-gray-400');
      out.innerHTML =
        '<div class="w-full"><div class="h-3 bg-neutral-200 dark:bg-neutral-800 rounded mb-2 animate-pulse"></div><div class="h-3 bg-neutral-200 dark:bg-neutral-800 rounded w-2/3 animate-pulse"></div></div>';
    }

    try {
      let body;

      if (inputTab === 'json') {
        const textarea = $('jsonTextarea');
        const parsed = parseRawJson(textarea?.value);
        if (!parsed.ok) throw new Error(parsed.error);
        body = normalizeRunBodyFromRawJson(parsed.value);
      } else {
        if (!formController) {
          throw new Error('Form is not available. Use Raw JSON.');
        }
        if (!selectedSchema) {
          throw new Error('Schema not available. Use Raw JSON.');
        }
        const input = await formController.getValues();
        body = { input };
      }

      const selectedModelId = (modelSelect && !modelSelect.disabled && modelSelect.value) ? String(modelSelect.value) : undefined;
      if (selectedModelId && typeof body === 'object' && body && body.selectedModelId == null) {
        body.selectedModelId = selectedModelId;
      }
      if (remix?.remixFromOutputId && typeof body === 'object' && body) {
        const existing = body._aifnmjmchg && typeof body._aifnmjmchg === 'object' ? body._aifnmjmchg : {};
        body._aifnmjmchg = { ...existing, remixFromOutputId: remix.remixFromOutputId };
      }

      const idempotencyKey = `uap-${selectedAgentId}-${uuid()}`;
      lastPublishContext = {
        agentId: selectedAgentId,
        idempotencyKey,
        input: body?.input && typeof body.input === 'object' && body.input ? body.input : {},
        derivedFromOutputId: remix?.remixFromOutputId || null,
      };

      const { res, json } = await runStoreAgent(selectedAgentId, body, { signal, headers: { 'Idempotency-Key': idempotencyKey } });
      if (activeSeq !== runSeq) return;

      if (res.status === 202) {
        const jobId = json?.jobId;
        if (!jobId) throw new Error('Agent queued but jobId missing in response');

        setStatus('Queued…');
        await refreshCreditsBalance({ force: true });
        const job = await pollJob(jobId, {
          signal,
          onTick: (j) => {
            if (activeSeq !== runSeq) return;
            const pct = j?.progress != null ? ` (${Math.round(j.progress * 100)}%)` : '';
            setStatus(`Processing${pct}`);
          },
        });
        if (activeSeq !== runSeq) return;

        if (job.status === 'failed') {
          const msg = job?.error?.message || 'Job failed';
          setStatus('Failed', 'error');
          if (out) out.innerHTML = `<div class="text-sm text-red-600 dark:text-red-400">${msg}</div>`;
          await refreshCreditsBalance({ force: true });
          return;
        }

        setStatus('Completed', 'success');
        renderOutput(out, job.output);
        renderPublishActions(out, lastPublishContext);
        await refreshCreditsBalance({ force: true });
        return;
      }

      if (!res.ok) {
        if (res.status === 402 && json?.code === 'QUEUE_LIMIT_EXCEEDED') {
          setStatus('Queue limit reached', 'error');
          await refreshCreditsBalance({ force: true });
          if (out && window.PendingPaid?.renderPendingPaidInto) {
            window.PendingPaid.renderPendingPaidInto(out, {
              title: 'Queue Limit Reached',
              message: json.error,
              onRetry: () => runBtn?.click(),
            });
          }
          return;
        }

        if (res.status === 402) {
          const required = json?.requiredCredits;
          const available = json?.availableCredits;
          const suggested = Array.isArray(json?.suggestedModels) ? json.suggestedModels : [];

          setStatus('Insufficient credits', 'error');
          await refreshCreditsBalance({ force: true });

          const suggestedHtml = suggested.length
            ? `<div class="mt-3 text-xs text-gray-500 dark:text-gray-400">Try a cheaper model: ${suggested
                .map((m) => `${m.displayName || m.id} (${m.requiredCredits} credits)`)
                .join(', ')}</div>`
            : '';

          if (out) {
            out.innerHTML = `
              <div class="text-sm text-red-600 dark:text-red-400 font-semibold">Insufficient credits</div>
              <div class="mt-2 text-xs text-gray-500 dark:text-gray-400">Need <span class="font-semibold">${required}</span> credits, have <span class="font-semibold">${available}</span>.</div>
              ${suggestedHtml}
            `;
          }
          return;
        }

        const msg = json?.error?.message || json?.error || `Run failed (${res.status})`;
        setStatus('Failed', 'error');
        if (out) out.innerHTML = `<div class="text-sm text-red-600 dark:text-red-400">${msg}</div>`;
        return;
      }

      setStatus('Completed', 'success');
      renderOutput(out, json?.output);
      renderPublishActions(out, lastPublishContext);
      await refreshCreditsBalance({ force: true });
    } catch (err) {
      if (activeSeq !== runSeq) return;
      if (err?.name === 'AbortError') return;
      setStatus('Failed', 'error');
      if (out) out.innerHTML = `<div class="text-sm text-red-600 dark:text-red-400">${err?.message || String(err)}</div>`;
    } finally {
      if (activeSeq !== runSeq) return;
      runAbortController = null;
      runBtn.disabled = false;
      runBtn.textContent = getGenerateButtonText(selectedAgent);
    }
  }

  await window.AitopiaCredits?.loadBillingConfig?.().catch(() => null);
  await refreshCreditsBalance();
  await loadAgents();

  const params = new URLSearchParams(window.location.search);
  const remixOutputId = params.get('remixOutputId') || params.get('remix') || null;
  const initialAgentId = params.get('agentId') || params.get('agent') || null;

  if (remixOutputId) {
    try {
      setStatus('Loading remix…');
      const remixRes = await fetch(`https://aitopia.ai/api/outputs/${encodeURIComponent(remixOutputId)}/remix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const remixJson = safeJsonParse(await remixRes.text());
      if (!remixRes.ok) {
        const msg = remixJson?.error?.message || remixJson?.error || `Failed to load remix (${remixRes.status})`;
        throw new Error(msg);
      }
      const remix = {
        remixFromOutputId: remixJson?.remixFromOutputId,
        remixSpec: remixJson?.remixSpec,
        defaults: remixJson?.defaults,
      };
      const sourceStoreId = remixJson?.sourceStoreId || remixJson?.agentId;
      if (typeof sourceStoreId !== 'string' || !sourceStoreId) {
        throw new Error('Remix payload missing sourceStoreId');
      }
      const agent = await selectAgent(sourceStoreId, { remix });
      if (agent && agent.available !== false) {
        setStatus('Remix ready', 'success');
      }
    } catch (err) {
      setStatus('Remix failed', 'error');
      const out = $('outputContainer');
      if (out) {
        out.classList.remove('text-gray-500', 'dark:text-gray-400');
        out.innerHTML = `<div class="text-sm text-red-600 dark:text-red-400">${err?.message || String(err)}</div>`;
      }
    }
  } else if (initialAgentId) {
    await selectAgent(initialAgentId);
  }
}

main();
