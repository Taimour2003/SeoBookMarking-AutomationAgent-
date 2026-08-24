import { getStoreAgent, getAgentSchema, runStoreAgent, getJob, checkAuthOrRedirect } from '../shared/api.js';
import { renderSchemaForm } from './schema-form.js';
import { renderOutput, renderError } from './result-renderer.js';
import { getOverrideModulePath } from './overrides-registry.js';
import { saveSnapshot, renderPendingPaidInto, fetchBalance, isInsufficient, showAgreementModal } from '../shared/pending-paid.js';

function $(id) {
  return document.getElementById(id);
}

function setHidden(el, hidden) {
  if (!el) return;
  el.classList.toggle('hidden', hidden);
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
  pill.classList.remove('bg-red-500/10', 'text-red-600', 'dark:text-red-400', 'bg-green-500/10', 'text-green-700', 'dark:text-green-300');
  if (tone === 'error') pill.classList.add('bg-red-500/10', 'text-red-600', 'dark:text-red-400');
  if (tone === 'success') pill.classList.add('bg-green-500/10', 'text-green-700', 'dark:text-green-300');
}

function parseAgentIdFromPathname() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  // Expected: /agent/:id/run
  if (parts.length >= 3 && parts[0] === 'agent' && parts[2] === 'run') return parts[1];
  return null;
}

function normalizeAssetUrl(url) {
  if (typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }
  if (trimmed.startsWith('/')) return trimmed;
  if (trimmed.startsWith('./')) return `/${trimmed.slice(2)}`;
  return `/${trimmed}`;
}

let showcaseDataCache = null;

async function loadShowcaseData() {
  if (Array.isArray(showcaseDataCache)) return showcaseDataCache;
  try {
    const res = await fetch('https://aitopia.ai/agent-showcase-data.json', { cache: 'force-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    showcaseDataCache = Array.isArray(json) ? json : [];
  } catch {
    showcaseDataCache = [];
  }
  return showcaseDataCache;
}

async function getShowcaseEntryForAgent(agentId) {
  const data = await loadShowcaseData();
  return data.find((entry) => entry && typeof entry === 'object' && entry.id === agentId) || null;
}

function mergeAgentWithShowcase(agent, showcase) {
  if (!showcase || typeof showcase !== 'object') return agent;
  const showcaseImages = Array.isArray(showcase.showcase_images) ? showcase.showcase_images : null;
  const showcaseVideos = Array.isArray(showcase.showcase_videos) ? showcase.showcase_videos : null;
  const featuredVideo = typeof showcase.featured_video === 'string' ? showcase.featured_video : null;
  const icon = typeof showcase.icon === 'string' ? showcase.icon : null;

  return {
    ...agent,
    icon: icon || agent.icon,
    featured_video: featuredVideo ?? agent.featured_video,
    showcase_images: showcaseImages ?? agent.showcase_images,
    showcase_videos: showcaseVideos ?? agent.showcase_videos,
    screenshots: showcaseImages && showcaseImages.length > 0 ? showcaseImages : agent.screenshots,
  };
}

function toStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((v) => typeof v === 'string');
}

function isProbablyVideoUrl(url) {
  return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url);
}

function buildExampleMediaItems(agent) {
  const items = [];
  const seen = new Set();

  const push = (type, url) => {
    const normalized = normalizeAssetUrl(url);
    if (!normalized) return;
    const key = `${type}:${normalized}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push({ type, url: normalized });
  };

  for (const url of toStringArray(agent?.showcase_images)) push('image', url);
  if (typeof agent?.featured_video === 'string' && agent.featured_video.trim()) push('video', agent.featured_video);
  for (const url of toStringArray(agent?.showcase_videos)) push('video', url);
  for (const url of toStringArray(agent?.gifs)) push('image', url);

  // Fall back to older / less-specific fields if needed.
  if (items.length === 0) {
    for (const url of toStringArray(agent?.screenshots)) push('image', url);
    for (const url of toStringArray(agent?.videos)) push('video', url);
  }

  // Some catalogs treat "videos" as mixed URLs; classify by extension.
  const normalizedItems = items.map((item) => {
    if (item.type !== 'video') return item;
    if (!isProbablyVideoUrl(item.url)) return { ...item, type: 'image' };
    return item;
  });

  return normalizedItems;
}

function renderAgentExamples(agent) {
  const root = $('agentExamples');
  const main = $('agentExamplesMain');
  const thumbs = $('agentExamplesThumbs');
  if (!root || !main || !thumbs) return;

  const items = buildExampleMediaItems(agent);
  if (items.length === 0) {
    setHidden(root, true);
    return;
  }

  setHidden(root, false);
  setHidden(thumbs, items.length <= 1);

  const thumbButtons = [];

  function renderMain(index) {
    const item = items[index];
    if (!item) return;

    main.innerHTML = '';

    if (item.type === 'video') {
      const video = document.createElement('video');
      video.className = 'w-full h-full object-cover';
      video.controls = true;
      video.playsInline = true;
      video.preload = 'metadata';
      video.src = item.url;
      main.appendChild(video);
    } else {
      const img = document.createElement('img');
      img.className = 'w-full h-full object-cover';
      img.loading = 'lazy';
      img.alt = `${agent?.name || 'Agent'} example`;
      img.src = item.url;
      main.appendChild(img);
    }

    thumbButtons.forEach((btn, idx) => {
      btn.classList.toggle('ring-2', idx === index);
      btn.classList.toggle('ring-primary/90', idx === index);
      btn.classList.toggle('opacity-70', idx !== index);
    });
  }

  thumbs.innerHTML = '';
  items.slice(0, 8).forEach((item, index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'w-20 h-20 rounded-ios-lg overflow-hidden flex-shrink-0 hover:opacity-100 transition-opacity cursor-pointer bg-transparent';
    btn.addEventListener('click', () => renderMain(index));

    if (item.type === 'video') {
      const video = document.createElement('video');
      video.className = 'w-full h-full object-cover';
      video.muted = true;
      video.playsInline = true;
      video.preload = 'metadata';
      video.src = item.url;
      btn.appendChild(video);
    } else {
      const img = document.createElement('img');
      img.className = 'w-full h-full object-cover';
      img.loading = 'lazy';
      img.alt = '';
      img.src = item.url;
      btn.appendChild(img);
    }

    thumbs.appendChild(btn);
    thumbButtons.push(btn);
  });

  renderMain(0);
}

async function pollJob(jobId, { onTick, intervalMs = 2000, timeoutMs = 10 * 60 * 1000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const job = await getJob(jobId);
    onTick?.(job);
    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') return job;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error('Job timed out');
}

async function main() {
  const agentId = parseAgentIdFromPathname();
  if (!agentId) {
    setHidden($('loading'), true);
    setHidden($('error'), false);
    $('errorMessage').textContent = 'Invalid URL. Expected /agent/:id/run';
    return;
  }

  $('backLink').href = `/aitopia/marketplace/agent/${encodeURIComponent(agentId)}.html`;
  $('legacyLink').href = `/agent/${encodeURIComponent(agentId)}/run?legacy=1`;

  try {
    const billingConfigPromise = window.AitopiaCredits?.loadBillingConfig?.().catch(() => null) ?? Promise.resolve(null);
    const showcasePromise = getShowcaseEntryForAgent(agentId);
    const [agent, schema, _billing, showcase] = await Promise.all([
      getStoreAgent(agentId),
      getAgentSchema(agentId, { ui: 'uap' }),
      billingConfigPromise,
      showcasePromise,
    ]);
    const mergedAgent = mergeAgentWithShowcase(agent, showcase);

    document.title = `Run ${mergedAgent.name || agentId} | AITOPIA`;
    $('agentName').textContent = mergedAgent.name || agentId;
    $('agentDescription').textContent = mergedAgent.description || '';
    $('agentIcon').src = normalizeAssetUrl(mergedAgent.icon) || '/marketplace/favicon.ico';
    $('agentIcon').alt = mergedAgent.name || agentId;
    renderAgentExamples(mergedAgent);

    const meta = $('agentMeta');
    meta.innerHTML = '';
    if (mergedAgent.category) meta.insertAdjacentHTML('beforeend', `<span>Category: <span class="font-medium">${mergedAgent.category}</span></span>`);
    const costLabel = window.AitopiaCredits?.getCreditsInfoForAgent?.(mergedAgent)?.label;
    if (costLabel) {
      const costSpan = document.createElement('span');
      costSpan.textContent = 'Est. cost: ';
      const strong = document.createElement('span');
      strong.className = 'font-medium';
      strong.textContent = String(costLabel);
      costSpan.appendChild(strong);
      meta.appendChild(costSpan);
    }

    const creditsMeta = document.createElement('span');
    creditsMeta.id = 'creditsMeta';
    creditsMeta.className = 'text-gray-500 dark:text-gray-400';
    meta.appendChild(creditsMeta);

    const refreshCreditsMeta = async (options) => {
      setHidden(creditsMeta, true);
      creditsMeta.textContent = '';
      const data = await window.AitopiaCredits?.loadCreditsBalance?.(options);
      if (!data?.balance) return;

      const balance = data.balance;
      const daily = `${balance.dailyCreditsRemaining} / ${balance.dailyAllowanceCredits}`;
      const paid = balance.paidCreditsBalance > 0 ? ` + ${balance.paidCreditsBalance} paid` : '';
      const label = data.subjectType === 'user' ? 'Credits today (registered)' : 'Credits today (guest)';
      creditsMeta.innerHTML = `${label}: <span class="font-medium">${daily}${paid}</span>`;
      setHidden(creditsMeta, false);
    };

    await refreshCreditsMeta();

    // Optional model selection (only if provided by backend)
    const modelChooser = $('modelChooser');
    const modelSelect = $('modelSelect');
    if (Array.isArray(mergedAgent.modelChoices) && mergedAgent.modelChoices.length > 0) {
      modelSelect.innerHTML = '';
      const choices = mergedAgent.modelChoices;
      for (const choice of choices) {
        const opt = document.createElement('option');
        const modelId = typeof choice === 'string' ? choice : choice?.id;
        if (!modelId) continue;
        opt.value = String(modelId);
        const label = typeof choice === 'string'
          ? choice
          : (choice.displayName || choice.id || String(modelId));
        const credits = getCreditsDisplayForModelChoice(choice);
        const star = typeof choice === 'object' && choice?.recommended ? ' ★' : '';
        opt.textContent = `${String(label)}${credits}${star}`;
        modelSelect.appendChild(opt);
      }
      const recommended = choices.find(c => typeof c === 'object' && c?.recommended && c?.id) || null;
      if (recommended?.id) modelSelect.value = String(recommended.id);
      setHidden(modelChooser, modelSelect.options.length === 0);

      const selectorEnabledForAgent = mergedAgent?.modelSelectorEnabled === true;
      modelSelect.disabled = !selectorEnabledForAgent;
      modelSelect.title = selectorEnabledForAgent ? '' : 'Model selection is not enabled for this agent/run.';
      modelSelect.classList.toggle('opacity-60', !selectorEnabledForAgent);
    } else {
      setHidden(modelChooser, true);
    }

    // Phase A: schema-driven form by default, with optional override module hook.
    const overridePath = getOverrideModulePath(agentId);
    let formController;
    if (overridePath) {
      const mod = await import(overridePath);
      formController = await mod.render({ agent: mergedAgent, schema, container: $('formContainer') });
    } else {
      formController = renderSchemaForm({ schema, container: $('formContainer'), collapseOptional: true });
    }

    setHidden($('loading'), true);
    setHidden($('content'), false);

    const runButton = $('runButton');
    const outputContainer = $('outputContainer');
    const runHint = $('runHint');

    runHint.textContent = mergedAgent.async
      ? 'This agent may run asynchronously. If queued, the page will auto-poll for results.'
      : '';

    runButton.addEventListener('click', async () => {
      if (!(await checkAuthOrRedirect())) return;

      // Agreement check — show modal if user hasn't agreed yet
      const agreed = await showAgreementModal();
      if (!agreed) return;

      // Show loading state first (before credit check, so it looks like a real run)
      runButton.disabled = true;
      setStatus('Running…');
      outputContainer.classList.remove('text-gray-500', 'dark:text-gray-400');
      outputContainer.innerHTML =
        '<div class="w-full"><div class="h-3 bg-neutral-200 dark:bg-neutral-800 rounded mb-2 animate-pulse"></div><div class="h-3 bg-neutral-200 dark:bg-neutral-800 rounded w-2/3 animate-pulse"></div></div>';

      // ── Pre-flight credit check (fake run flow) ───────────────────
      {
        const pfModel = modelSelect && !modelSelect.disabled && modelSelect.value
          ? mergedAgent?.modelChoices?.find(m => m.id === modelSelect.value)
          : null;
        const pfInfo = pfModel
          ? window.AitopiaCredits?.getCreditsInfoFromCost?.(pfModel.cost)
          : window.AitopiaCredits?.getCreditsInfoForAgent?.(mergedAgent);
        const pfRequired = pfInfo?.credits ?? pfInfo?.minCredits ?? null;

        try {
          const available = await fetchBalance();
          if (isInsufficient(available, pfRequired)) {
            const snapData = {};
            const fv = formController?.getValues ? await formController.getValues() : {};
            Object.assign(snapData, fv);
            const selId = (modelSelect && !modelSelect.disabled && modelSelect.value) ? modelSelect.value : null;
            if (selId) snapData.model_id = selId;
            saveSnapshot('agent_form_snapshot', snapData);
            runButton.disabled = false;
            setStatus('');
            renderPendingPaidInto(outputContainer, {
              thumbUrl: null,
              onRetry: () => runButton.click(),
            });
            return;
          }
        } catch (_) { /* proceed — backend will enforce */ }
      }
      // ── End pre-flight credit check ────────────────────────────────

      try {
        const input = await formController.getValues();
        const selectedModelId = (modelSelect && !modelSelect.disabled && modelSelect.value) ? String(modelSelect.value) : undefined;

        const storedConversationId = sessionStorage.getItem(`conversation_${agentId}`);
        if (storedConversationId && !input.conversationId) {
          input.conversationId = storedConversationId;
        }

        const body = { input };
        if (selectedModelId) body.selectedModelId = selectedModelId;
        if (mergedAgent.async) body.async = true;

        const { res, json } = await runStoreAgent(agentId, body);

        if (res.status === 202) {
          const jobId = json?.jobId;
          if (!jobId) throw new Error('Agent queued but jobId missing in response');

          setStatus('Queued…');
          await refreshCreditsMeta({ force: true });

          // Start queue polling in the global navbar
          window.NavbarComponent?.startQueuePolling?.();

          const job = await pollJob(jobId, {
            onTick: (j) => {
              setStatus('Running');
            },
          });

          if (job.status === 'failed') {
            const msg = job?.error?.message || 'Job failed';
            setStatus('Failed', 'error');
            renderError(outputContainer, msg);
            await refreshCreditsMeta({ force: true });
            return;
          }

          setStatus('Completed', 'success');
          renderOutput(outputContainer, job.output);

          if (job.output?.conversationId) {
            sessionStorage.setItem(`conversation_${agentId}`, job.output.conversationId);
          }

          await refreshCreditsMeta({ force: true });
          return;
        }

        if (!res.ok) {
          if (res.status === 402 && json?.code === 'QUEUE_LIMIT_EXCEEDED') {
            setStatus('Queue limit reached', 'error');
            renderPendingPaidInto(outputContainer, {
              title: 'Queue Limit Reached',
              message: json.error,
              onRetry: () => runButton.click(),
            });
            return;
          }

          if (res.status === 402) {
            const required = json?.requiredCredits;
            const available = json?.availableCredits;
            const suggested = Array.isArray(json?.suggestedModels) ? json.suggestedModels : [];

            setStatus('Insufficient credits', 'error');
            await refreshCreditsMeta({ force: true });

            const suggestedHtml = suggested.length
              ? `<div class="mt-3 text-xs text-gray-600 dark:text-gray-400">Try a cheaper model: ${suggested
                .map((m) => `${m.displayName || m.id} (${m.requiredCredits} credits)`)
                .join(', ')}</div>`
              : '';

            outputContainer.innerHTML = `
              <div class="text-sm text-red-600 dark:text-red-400 font-semibold">Insufficient credits</div>
              <div class="mt-2 text-xs text-gray-600 dark:text-gray-400">Need <span class="font-semibold">${required}</span> credits, have <span class="font-semibold">${available}</span>.</div>
              ${suggestedHtml}
            `;
            return;
          }

          const message = json?.error || json?.error?.message || `Run failed (${res.status})`;
          setStatus('Failed', 'error');
          renderError(outputContainer, message);
          return;
        }

        setStatus('Completed', 'success');
        renderOutput(outputContainer, json?.output);

        if (json?.output?.conversationId) {
          sessionStorage.setItem(`conversation_${agentId}`, json.output.conversationId);
        }

        await refreshCreditsMeta({ force: true });
      } catch (err) {
        setStatus('Failed', 'error');
        renderError(outputContainer, err?.message || String(err));
      } finally {
        runButton.disabled = false;
      }
    });
  } catch (err) {
    setHidden($('loading'), true);
    setHidden($('error'), false);
    $('errorMessage').textContent = err?.message || String(err);
  }
}

main();
