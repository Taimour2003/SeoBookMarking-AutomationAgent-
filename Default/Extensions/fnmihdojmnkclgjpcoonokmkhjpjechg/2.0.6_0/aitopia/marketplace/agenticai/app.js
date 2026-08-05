// Main Application - Handles chat, streaming, and UI updates

(function() {
  'use strict';

  // State
  let conversationHistory = [];
  let isProcessing = false;
  const SESSION_STORAGE_KEY = 'agenticai_session_id';
  const MODEL_SELECTIONS_KEY = 'agenticai.modelSelections.v1';
  let sessionId = null;
  let currentModelSelections = {};

  // DOM Elements
  let messagesContainer;
  let chatScrollContainer;
  let chatForm;
  let messageInput;
  let sendButton;
  let micButton;
  let uploadButton;
  let newChatButton;
  let globalNavResizeObserver;

  function generateSessionId() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID().replace(/-/g, '');
    return `s_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
  }

  function loadSessionId() {
    try {
      const existing = localStorage.getItem(SESSION_STORAGE_KEY);
      return existing && typeof existing === 'string' ? existing : null;
    } catch {
      return null;
    }
  }

  function persistSessionId(id) {
    sessionId = id;
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, String(id || ''));
    } catch {
      // ignore
    }
  }

  function initMarkdown() {
    if (!window.marked) return;

    const renderer = new window.marked.Renderer();
    renderer.link = (href, title, text) => {
      const safeHref = String(href ?? '');
      const safeText = String(text ?? safeHref);
      const safeTitle = title ? ` title="${escapeHtml(title)}"` : '';
      return `<a href="${escapeHtml(safeHref)}"${safeTitle} target="_blank" rel="noopener noreferrer">${escapeHtml(safeText)}</a>`;
    };

    window.marked.setOptions({
      gfm: true,
      breaks: true,
      renderer,
    });
  }

  function syncGlobalNavHeight() {
    const root = document.documentElement;
    const container = document.getElementById('navbar-container');
    if (!root || !container) return;

    const set = () => {
      const height = container.offsetHeight || 0;
      root.style.setProperty('--global-nav-height', `${height}px`);
    };

    set();
    try {
      globalNavResizeObserver = new ResizeObserver(() => set());
      globalNavResizeObserver.observe(container);
    } catch {
      // ignore (older browsers)
    }
    window.addEventListener('resize', set, { passive: true });
  }

  // Initialize
  function init() {
    messagesContainer = document.getElementById('messages');
    chatScrollContainer = messagesContainer?.closest?.('.chat-container') || null;
    chatForm = document.getElementById('chat-form');
    messageInput = document.getElementById('message-input');
    sendButton = document.getElementById('send-button');
    micButton = document.getElementById('mic-button');
    uploadButton = document.getElementById('upload-button');
    newChatButton = document.getElementById('new-chat-button');

    const storedSession = loadSessionId();
    persistSessionId(storedSession || generateSessionId());

    if (newChatButton) {
      newChatButton.addEventListener('click', () => {
        try {
          localStorage.removeItem(SESSION_STORAGE_KEY);
        } catch {
          // ignore
        }
        persistSessionId(generateSessionId());
        window.location.reload();
      });
    }

    syncGlobalNavHeight();
    initMarkdown();
    initVoiceInput();
    initUpload();
    window.AgenticAiSettings?.init?.();

    chatForm.addEventListener('submit', handleSubmit);
    messageInput.addEventListener('keydown', handleKeyDown);
    messageInput.addEventListener('input', autoResize);
  }

  function initUpload() {
    if (!uploadButton || !window.UploadComponent) return;
    window.UploadComponent.init(uploadButton, messageInput);
  }

  // Voice input handling
  function initVoiceInput() {
    if (!micButton || !window.VoiceComponent) return;

    let isRecording = false;

    micButton.addEventListener('click', async () => {
      if (isProcessing) return;

      if (isRecording) {
        // Stop recording
        micButton.classList.remove('recording');
        micButton.classList.add('processing');
        isRecording = false;

        try {
          const audioBlob = await window.VoiceComponent.stopRecording();
          const result = await window.VoiceComponent.transcribe(audioBlob);

          micButton.classList.remove('processing');

          if (result.error) {
            console.error('Transcription error:', result.error);
            return;
          }

          if (result.text) {
            messageInput.value = result.text;
            autoResize();
            messageInput.focus();
          }
        } catch (error) {
          console.error('Voice input error:', error);
          micButton.classList.remove('processing');
        }
      } else {
        // Start recording
        const started = await window.VoiceComponent.startRecording(
          () => {
            micButton.classList.add('recording');
            isRecording = true;
          },
          (error) => {
            console.error('Recording error:', error);
            micButton.classList.remove('recording');
            isRecording = false;
          }
        );
      }
    });
  }

  function autoResize() {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 150) + 'px';
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      chatForm.dispatchEvent(new Event('submit'));
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const userMessage = messageInput.value.trim();
    if (!userMessage || isProcessing) return;

    messageInput.value = '';
    autoResize();

    const welcomeMsg = messagesContainer.querySelector('.welcome-message');
    if (welcomeMsg) welcomeMsg.remove();

    // Add user message
    messagesContainer.appendChild(window.MessageComponent?.createUserMessage(userMessage) || createUserMessage(userMessage));
    conversationHistory.push({ role: 'user', content: userMessage });

    await processChat(userMessage);
  }

  async function processChat(userMessage, options = {}) {
    isProcessing = true;
    sendButton.disabled = true;

    const responseContainer = document.createElement('div');
    responseContainer.className = 'message assistant';

    const activity = document.createElement('div');
    activity.className = 'activity';

    const assistantBubble = document.createElement('div');
    assistantBubble.className = 'message-content';
    assistantBubble.hidden = true;

    responseContainer.appendChild(activity);
    responseContainer.appendChild(assistantBubble);
    messagesContainer.appendChild(responseContainer);

    let assistantText = '';
    let currentThinkingNode = null;
	    let activeToolId = null;
	    const toolNodesById = new Map();
	    const toolInputById = new Map();
	    let todoNode = null;

    try {
      const requestId = (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function')
        ? globalThis.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

      const settingsPatch = window.AgenticAiSettings?.buildChatRequestSettings?.() || {};
      const resume = options && typeof options === 'object' ? options.resume : null;

      const response = await fetch('https://aitopia.ai/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: userMessage, requestId, ...settingsPatch, ...(resume ? { resume } : {}) })
      });

      if (!response.ok) {
        let message = `HTTP error: ${response.status}`;
        try {
          const err = await response.json();
          if (err?.error) message = String(err.error);
          else if (err?.message) message = String(err.message);
        } catch {
          // ignore
        }
        throw new Error(message);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        let boundaryIndex;
        while ((boundaryIndex = buffer.indexOf('\n\n')) !== -1) {
          const raw = buffer.slice(0, boundaryIndex).trim();
          buffer = buffer.slice(boundaryIndex + 2);
          if (!raw) continue;

          const dataLines = raw
            .split('\n')
            .map((l) => l.trimEnd())
            .filter((l) => l.startsWith('data:'));
          if (!dataLines.length) continue;

          const data = dataLines.map((l) => l.slice(5).trimStart()).join('\n');
          if (!data) continue;

          let event;
          try {
            event = JSON.parse(data);
          } catch {
            continue;
          }

          switch (event.type) {
            case 'session': {
              if (event.sessionId) persistSessionId(String(event.sessionId));
              break;
            }

            case 'thinking_start': {
              currentThinkingNode = window.NodeComponent?.createThinkingNode?.() || null;
              if (currentThinkingNode) activity.appendChild(currentThinkingNode);
              scrollToBottom();
              break;
            }

            case 'thinking_delta': {
              if (currentThinkingNode) {
                window.NodeComponent?.appendToNodeText?.(currentThinkingNode, event.thinking || '');
                scrollToBottom();
              }
              break;
            }

            case 'tool_use_start': {
              if (event.name === 'update_todos') {
                todoNode = todoNode || ensureTodoNode(activity);
                toolNodesById.set(event.id, todoNode);
                window.NodeComponent?.setNodeBadge?.(todoNode, 'Updating…', 'running');
                scrollToBottom();
                window.MediaPanel?.onToolEvent?.(event);
                break;
              }

              const title = toolNameToTitle(event.name);
              const toolNode = window.NodeComponent?.createToolNode?.(event.id, title);
              if (!toolNode) break;

              toolNode.dataset.toolName = String(event.name || '');
              toolNodesById.set(event.id, toolNode);
              toolInputById.set(event.id, '');
              activeToolId = event.id;

	              if (event.name === 'enter_plan_mode') {
	                // Keep plan mode near the top (after todos if present).
	                if (todoNode && activity.firstChild === todoNode) {
	                  activity.insertBefore(toolNode, todoNode.nextSibling);
	                } else {
                  activity.prepend(toolNode);
                }
              } else {
                activity.appendChild(toolNode);
              }

              scrollToBottom();
              window.MediaPanel?.onToolEvent?.(event);
              break;
            }

            case 'tool_input_delta': {
              if (!activeToolId) break;
              const prev = toolInputById.get(activeToolId) || '';
              const next = prev + String(event.partial_json || '');
              toolInputById.set(activeToolId, next);
              const toolNode = toolNodesById.get(activeToolId);
              if (toolNode) window.NodeComponent?.setToolInput?.(toolNode, next);
              break;
            }

            case 'tool_use_complete': {
              const toolNode = toolNodesById.get(event.id);
              if (event.name === 'update_todos') {
                todoNode = todoNode || ensureTodoNode(activity);
                const todos = Array.isArray(event.input?.todos) ? event.input.todos : [];
                renderTodosIntoNode(todoNode, todos);
                window.NodeComponent?.setNodeBadge?.(todoNode, todoBadgeText(todos), 'pending');
              } else if (toolNode) {
                const pretty = JSON.stringify(event.input ?? {}, null, 2);
                window.NodeComponent?.setToolInput?.(toolNode, pretty);
                window.NodeComponent?.setNodeBadge?.(toolNode, 'Queued', 'pending');
              }

              // Collapse thinking only when a "real" external tool starts.
              if (currentThinkingNode && (
                event.name === 'web_search'
                || event.name === 'generate_image'
                || event.name === 'text_to_speech'
                || event.name === 'generate_video'
                || event.name === 'image_to_video'
                || event.name === 'merge_videos'
                || event.name === 'add_background_music'
                || event.name === 'add_narration'
                || event.name === 'generate_music'
                || event.name === 'export_audio'
              )) {
                currentThinkingNode.classList.add('collapsed');
              }
              activeToolId = null;
              scrollToBottom();
              window.MediaPanel?.onToolEvent?.(event);
              break;
            }

            case 'tool_executing': {
              const toolNode = toolNodesById.get(event.id);
              if (toolNode) {
                const state = event.name === 'update_todos' ? 'running' : 'running';
                window.NodeComponent?.setNodeBadge?.(toolNode, 'Running…', state);
              }
              scrollToBottom();
              window.MediaPanel?.onToolEvent?.(event);
              break;
            }

            case 'tool_result': {
              const toolNode = toolNodesById.get(event.id);
              if (toolNode) {
                if (event.name === 'update_todos') {
                  window.NodeComponent?.setNodeBadge?.(toolNode, todoBadgeTextFromNode(toolNode) || 'Updated', 'complete');
                } else {
                  window.NodeComponent?.setNodeBadge?.(toolNode, 'Complete', 'complete');
                }
                renderToolResultIntoNode(toolNode, event.name, event.result);
              }
              scrollToBottom();
              window.MediaPanel?.onToolEvent?.(event);
              break;
            }

            case 'text_delta': {
              assistantText += String(event.text || '');
              assistantBubble.hidden = false;
              assistantBubble.innerHTML = renderMarkdown(assistantText);
              scrollToBottom();
              break;
            }

            case 'error': {
              const errNode = window.NodeComponent?.createErrorNode?.(event.message);
              if (errNode) activity.appendChild(errNode);
              assistantBubble.hidden = false;
              assistantBubble.innerHTML = `<p>${escapeHtml(event.message || 'An error occurred')}</p>`;
              scrollToBottom();
              break;
            }

            case 'approval_required': {
              const kind =
                event.kind === 'budget'
                  ? 'budget'
                  : event.kind === 'checkpoint'
                    ? 'checkpoint'
                    : event.kind === 'images'
                      ? 'images'
                      : 'plan';
              const title =
                kind === 'plan'
                  ? 'Plan approval required'
                  : kind === 'budget'
                    ? 'Budget checkpoint'
                    : kind === 'images'
                      ? 'Keyframes approval required'
                      : 'Checkpoint';
              const node = window.NodeComponent?.createNode?.('approval', title, { collapsed: false, badgeText: 'Approval required', badgeState: 'pending' });
              if (!node) break;

              try {
                const uid = (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function')
                  ? globalThis.crypto.randomUUID()
                  : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
                node.id = `agenticai-approval-${uid}`;
                node.dataset.approvalKind = kind;
              } catch {
                // ignore
              }

              const settings = window.AgenticAiSettings?.get?.() || {};
              const ms = settings.modelSelection || {};
              const showModelSelection =
                ms.enabled !== false
                && (kind === 'plan'
                  ? ms.showInPlanApprovals !== false
                  : kind === 'budget'
                    ? ms.showInBudgetPauses !== false
                    : ms.showInCheckpoints !== false);
              const stickyModelSelection = Boolean(ms.sticky);

              const formatUsd = (n) => {
                const value = typeof n === 'number' && Number.isFinite(n) ? n : 0;
                return `$${value.toFixed(2)}`;
              };

              const plan = event.plan && typeof event.plan === 'object' ? event.plan : null;
              const costEstimate = event.costEstimate && typeof event.costEstimate === 'object' ? event.costEstimate : null;
              const models = event.models && typeof event.models === 'object' ? event.models : null;

              const message = typeof event.message === 'string' ? event.message : (kind === 'budget' ? 'Budget checkpoint reached.' : 'Plan ready.');
              const spentUsd = typeof event.spentUsd === 'number' && Number.isFinite(event.spentUsd) ? event.spentUsd : null;
              const maxCostUsd = typeof event.maxCostUsd === 'number' && Number.isFinite(event.maxCostUsd) ? event.maxCostUsd : null;

              const details = spentUsd !== null && maxCostUsd !== null
                ? `<div class="approval-meta">Spent: $${spentUsd.toFixed(3)} • Budget: $${maxCostUsd.toFixed(3)}</div>`
                : '';

              const loadStickyModelSelections = () => {
                if (!stickyModelSelection) return null;
                try {
                  const raw = localStorage.getItem(MODEL_SELECTIONS_KEY);
                  const parsed = raw ? JSON.parse(raw) : null;
                  if (!parsed || typeof parsed !== 'object') return null;
                  return parsed;
                } catch {
                  return null;
                }
              };
              const saveStickyModelSelections = (next) => {
                if (!stickyModelSelection) return;
                try {
                  localStorage.setItem(MODEL_SELECTIONS_KEY, JSON.stringify(next || {}));
                } catch {
                  // ignore
                }
              };

              const stickySelections = loadStickyModelSelections();
              const buildModelSelect = (label, key, section) => {
                if (!showModelSelection) return '';
                if (!section || typeof section !== 'object') return '';
                const options = Array.isArray(section.options) ? section.options : [];
                if (!options.length) return '';
                const defaultSelected = typeof section.selectedId === 'string' ? section.selectedId : (options[0]?.id || '');
                const stickySelected = stickySelections && typeof stickySelections[key] === 'string' ? String(stickySelections[key]) : '';
                const selected = stickySelected && options.some((o) => o?.id === stickySelected) ? stickySelected : defaultSelected;
                return `
                  <div class="plan-model-field">
                    <label class="plan-model-label">${escapeHtml(label)}</label>
                    <select class="plan-model-select" data-model-key="${escapeHtml(key)}">
                      ${options.map((o) => {
                        const id = o?.id ? String(o.id) : '';
                        const lbl = o?.label ? String(o.label) : id;
                        const isSelected = id && id === selected;
                        return `<option value="${escapeHtml(id)}" ${isSelected ? 'selected' : ''}>${escapeHtml(lbl)}</option>`;
                      }).join('')}
                    </select>
                  </div>
                `;
              };

              const renderPlannedToolCalls = (calls) => {
                const list = Array.isArray(calls) ? calls : [];
                if (!list.length) return '';
                const rows = list.map((c) => {
                  const tool = c?.tool ? String(c.tool) : '';
                  const count = typeof c?.count === 'number' && Number.isFinite(c.count) ? c.count : null;
                  const seconds = typeof c?.seconds === 'number' && Number.isFinite(c.seconds) ? c.seconds : null;
                  const ttsChars = typeof c?.ttsChars === 'number' && Number.isFinite(c.ttsChars)
                    ? c.ttsChars
                    : (typeof c?.tts_chars === 'number' && Number.isFinite(c.tts_chars) ? c.tts_chars : null);
                  const note = c?.note ? String(c.note) : '';
                  const meta = [
                    count !== null ? `×${count}` : '',
                    seconds !== null ? `${seconds}s` : '',
                    ttsChars !== null ? `${ttsChars} chars` : '',
                  ].filter(Boolean).join(' ');
                  return `<li class="plan-tool-call"><span class="plan-tool-name">${escapeHtml(tool)}</span> <span class="plan-tool-meta">${escapeHtml(meta || '')}</span> ${note ? `<span class="plan-tool-note">(${escapeHtml(note)})</span>` : ''}</li>`;
                }).join('');
                return `<ul class="plan-tool-calls">${rows}</ul>`;
              };

              const renderSteps = (steps) => {
                const list = Array.isArray(steps) ? steps : [];
                if (!list.length) return '';
                return `
                  <div class="plan-section">
                    <div class="plan-section-title">Steps</div>
                    <div class="plan-steps">
                      ${list.map((s, idx) => {
                        const titleText = s?.title ? String(s.title) : `Step ${idx + 1}`;
                        const desc = s?.description ? String(s.description) : '';
                        const planned = s?.plannedToolCalls || s?.planned_tool_calls || [];
                        return `
                          <div class="plan-step">
                            <div class="plan-step-title">${escapeHtml(String(idx + 1))}. ${escapeHtml(titleText)}</div>
                            ${desc ? `<div class="plan-step-desc">${escapeHtml(desc)}</div>` : ''}
                            ${planned && Array.isArray(planned) && planned.length ? `
                              <div class="plan-step-subtitle">Planned tool calls</div>
                              ${renderPlannedToolCalls(planned)}
                            ` : ''}
                          </div>
                        `;
                      }).join('')}
                    </div>
                  </div>
                `;
              };

              const renderBullets = (titleText, items) => {
                const list = Array.isArray(items) ? items : [];
                if (!list.length) return '';
                return `
                  <div class="plan-section">
                    <div class="plan-section-title">${escapeHtml(titleText)}</div>
                    <ul class="plan-bullets">
                      ${list.map((i) => `<li>${escapeHtml(String(i))}</li>`).join('')}
                    </ul>
                  </div>
                `;
              };

              let planHtml = '';
              if (kind === 'plan' && plan) {
                const summary = plan.summary ? String(plan.summary) : '';
                const steps = Array.isArray(plan.steps) ? plan.steps : [];
                const checkpoints = Array.isArray(plan.checkpoints) ? plan.checkpoints : [];
                const risks = Array.isArray(plan.risks) ? plan.risks : [];

                const costHtml = costEstimate && typeof costEstimate.minUsd === 'number'
                  ? `
                    <div class="plan-section">
                      <div class="plan-section-title">Cost estimate (includes LLM tokens)</div>
                      <div class="plan-cost-grid">
                        <div class="plan-cost-item">
                          <div class="plan-cost-label">Min</div>
                          <div class="plan-cost-value" data-cost-key="min">${formatUsd(costEstimate.minUsd)}</div>
                        </div>
                        <div class="plan-cost-item">
                          <div class="plan-cost-label">Likely</div>
                          <div class="plan-cost-value" data-cost-key="likely">${formatUsd(costEstimate.likelyUsd)}</div>
                        </div>
                        <div class="plan-cost-item">
                          <div class="plan-cost-label">Max</div>
                          <div class="plan-cost-value" data-cost-key="max">${formatUsd(costEstimate.maxUsd)}</div>
                        </div>
                      </div>
                    </div>
                  `
                  : '';

                const modelsHtml = models && showModelSelection
                  ? `
                    <div class="plan-section">
                      <div class="plan-section-title">Models</div>
                      <div class="plan-model-grid">
                        ${buildModelSelect('Image model', 'imageModelId', models.image)}
                        ${buildModelSelect('Video model', 'videoModelId', models.video)}
                        ${buildModelSelect('Voice model', 'voiceModelId', models.voice)}
                      </div>
                    </div>
                  `
                  : '';

                planHtml = `
                  <div class="plan-approval">
                    ${summary ? `<div class="plan-summary">${escapeHtml(summary)}</div>` : ''}
                    ${costHtml}
                    ${modelsHtml}
                    ${renderSteps(steps)}
                    ${renderBullets('Planned checkpoints', checkpoints)}
                    ${renderBullets('Risks', risks)}
                  </div>
                `;
              }
              if (kind === 'images') {
                const images = Array.isArray(event.images) ? event.images : [];
                const plannedVideoClips =
                  typeof event.plannedVideoClips === 'number' && Number.isFinite(event.plannedVideoClips)
                    ? Math.max(0, Math.trunc(event.plannedVideoClips))
                    : null;

                const gridHtml = images.length
                  ? `
                    <div class="plan-section">
                      <div class="plan-section-title">Keyframes</div>
                      <div class="keyframes-grid">
                        ${images.slice(0, 24).map((img) => {
                          const url = img?.url ? String(img.url) : '';
                          const prompt = img?.prompt ? String(img.prompt) : '';
                          const toolUseId = img?.toolUseId ? String(img.toolUseId) : '';
                          if (!url) return '';
                          return `
                            <div class="keyframe-item" data-tool-use-id="${escapeHtml(toolUseId)}" data-original-url="${escapeHtml(url)}" data-original-prompt="${escapeHtml(prompt)}">
                              <div class="keyframe-thumb">
                                <img src="${escapeHtml(url)}" alt="Keyframe" loading="lazy" />
                                <div class="keyframe-selection-badge" data-role="keyframe-selection-badge"></div>
                              </div>
                              ${prompt ? `<div class="keyframe-caption">${escapeHtml(prompt)}</div>` : ''}
                            </div>
                          `;
                        }).join('')}
                      </div>
                    </div>
                  `
                  : `<div class="plan-summary">No keyframes were generated.</div>`;

                planHtml = `
                  <div class="plan-approval">
                    ${plannedVideoClips !== null ? `<div class="plan-summary">Planned video clips: ${escapeHtml(String(plannedVideoClips))}</div>` : ''}
                    ${gridHtml}
                  </div>
                `;
              }

              window.NodeComponent?.setNodeHTML?.(node, `
                <div class="approval-card ${kind === 'plan' ? 'approval-card-plan' : ''}">
                  <div class="approval-text">${escapeHtml(message)}</div>
                  ${details}
                  ${planHtml}
                  <div class="approval-actions">
                    <button type="button" class="approval-btn secondary" data-action="stop">${kind === 'plan' || kind === 'images' ? 'Reject' : 'Stop'}</button>
                    <button type="button" class="approval-btn primary" data-action="continue">${kind === 'plan' || kind === 'images' ? 'Approve' : 'Continue'}</button>
                  </div>
                </div>
              `);
              if (kind === 'images') {
                syncKeyframeApprovalNode(node);
              }

              // Optional: update the "Likely" cost estimate when the user changes model selections.
              if (kind === 'plan' && costEstimate && models && showModelSelection) {
                const getOptionCost = (section, modelId) => {
                  if (!section || typeof section !== 'object') return 0;
                  const options = Array.isArray(section.options) ? section.options : [];
                  const found = options.find((o) => o && o.id === modelId);
                  const cost = found && typeof found.estimatedCostUsd === 'number' ? found.estimatedCostUsd : 0;
                  return typeof cost === 'number' && Number.isFinite(cost) ? cost : 0;
                };

                const getCurrentToolLikely = () => {
                  let total = 0;
                  const selectEls = Array.from(node.querySelectorAll('select[data-model-key]'));
                  for (const sel of selectEls) {
                    const key = sel.getAttribute('data-model-key');
                    const modelId = sel.value ? String(sel.value) : '';
                    if (!key || !modelId) continue;
                    if (key === 'imageModelId') total += getOptionCost(models.image, modelId);
                    if (key === 'videoModelId') total += getOptionCost(models.video, modelId);
                    if (key === 'voiceModelId') total += getOptionCost(models.voice, modelId);
                  }
                  return total;
                };

                const baseLlmLikely = (() => {
                  const likely = typeof costEstimate.likelyUsd === 'number' && Number.isFinite(costEstimate.likelyUsd) ? costEstimate.likelyUsd : 0;
                  const toolLikely = getCurrentToolLikely();
                  return Math.max(0, likely - toolLikely);
                })();

                const likelyEl = node.querySelector('[data-cost-key="likely"]');
                const updateLikely = () => {
                  if (!likelyEl) return;
                  const next = baseLlmLikely + getCurrentToolLikely();
                  likelyEl.textContent = formatUsd(next);
                };

                node.querySelectorAll('select[data-model-key]').forEach((sel) => {
                  sel.addEventListener('change', updateLikely);
                });
              }

              node.querySelector('[data-action="stop"]')?.addEventListener('click', async () => {
                if (kind !== 'plan' && kind !== 'images') {
                  window.NodeComponent?.setNodeBadge?.(node, 'Stopped', 'error');
                  window.MediaPanel?.onApprovalResolved?.({
                    approvalNodeId: node.id || '',
                    kind,
                    decision: 'stop',
                  });
                  return;
                }

                if (isProcessing) return;
                window.NodeComponent?.setNodeBadge?.(node, 'Replanning…', 'running');
                try {
                  const feedback = await window.AgenticAiFeedbackModal?.open?.({
                    title: kind === 'images' ? 'Revise keyframes' : 'Revise plan',
                    hint:
                      kind === 'images'
                        ? 'What should change about the images (style, character design, colors, composition, etc.)?'
                        : 'What should change about the plan (structure, steps, style, duration, content constraints, etc.)?',
                    submitLabel: 'Revise',
                    cancelLabel: 'Cancel',
                  });
                  if (feedback === null) {
                    window.NodeComponent?.setNodeBadge?.(node, 'Pending', 'pending');
                    return;
                  }

                  window.MediaPanel?.onApprovalResolved?.({
                    approvalNodeId: node.id || '',
                    kind,
                    decision: 'reject',
                  });

                  const message =
                    feedback && feedback.trim()
                      ? (kind === 'images'
                          ? `Revise the keyframe images with these changes:\n${feedback.trim()}`
                          : `Revise the plan with these changes:\n${feedback.trim()}`)
                      : (kind === 'images' ? 'Please revise the keyframe images.' : 'Please revise the plan.');

                  await processChat(message, {
                    resume: {
                      kind,
                      decision: 'reject',
                      ...(Object.keys(currentModelSelections || {}).length ? { modelSelections: currentModelSelections } : {}),
                    },
                  });
                  window.NodeComponent?.setNodeBadge?.(node, 'Rejected', 'error');
                } catch {
                  window.NodeComponent?.setNodeBadge?.(node, 'Error', 'error');
                }
              });

              node.querySelector('[data-action="continue"]')?.addEventListener('click', async () => {
                if (isProcessing) return;
                window.NodeComponent?.setNodeBadge?.(node, 'Continuing…', 'running');
                try {
                  window.MediaPanel?.onApprovalResolved?.({
                    approvalNodeId: node.id || '',
                    kind,
                    decision: kind === 'plan' || kind === 'images' ? 'approve' : 'continue',
                  });
                  const selection = {};
                  node.querySelectorAll('select[data-model-key]').forEach((sel) => {
                    const key = sel.getAttribute('data-model-key');
                    const value = sel.value ? String(sel.value) : '';
                    if (key && value) selection[key] = value;
                  });
                  if (Object.keys(selection).length) {
                    currentModelSelections = { ...(currentModelSelections || {}), ...selection };
                    if (kind === 'plan' && stickyModelSelection) saveStickyModelSelections(currentModelSelections);
                  }
                  const selectionsToSend = Object.keys(currentModelSelections || {}).length ? currentModelSelections : null;
                  const approvedKeyframes = kind === 'images' ? collectApprovedKeyframesFromNode(node) : [];

                  const continueMessage =
                    kind === 'images'
                      ? 'Approved keyframes. Proceed to generate videos using the approved images as keyframes (unless text-to-video was explicitly requested).'
                      : 'Continue.';

                  await processChat(continueMessage, {
                    resume: {
                      kind,
                      decision: 'approve',
                      ...(selectionsToSend ? { modelSelections: selectionsToSend } : {}),
                      ...(kind === 'budget' ? { budgetOverride: true } : {}),
                      ...(approvedKeyframes && approvedKeyframes.length ? { approvedKeyframes } : {}),
                    },
                  });
                  window.NodeComponent?.setNodeBadge?.(node, 'Approved', 'complete');
                } catch (err) {
                  window.NodeComponent?.setNodeBadge?.(node, 'Error', 'error');
                }
              });

              activity.appendChild(node);
              scrollToBottom();
              try {
                event.approvalNodeId = node.id;
                event.approvalKind = kind;
              } catch {
                // ignore
              }
              window.MediaPanel?.onToolEvent?.(event);
              break;
            }

            case 'done': {
              // Collapse thinking by default at the end of a turn.
              responseContainer.querySelectorAll('.node[data-type="thinking"]').forEach((el) => {
                el.classList.add('collapsed');
              });

              // Add speaker button for TTS if there's text
              if (assistantText && window.VoiceComponent?.createSpeakerButton) {
                const speakerBtn = window.VoiceComponent.createSpeakerButton(assistantText);
                assistantBubble.appendChild(speakerBtn);
              }
              break;
            }
          }
        }
      }

      if (assistantText) conversationHistory.push({ role: 'assistant', content: assistantText });

    } catch (error) {
      const errNode = window.NodeComponent?.createErrorNode?.(error?.message || String(error));
      if (errNode) activity.appendChild(errNode);
      assistantBubble.hidden = false;
      assistantBubble.innerHTML = `<p>${escapeHtml(error?.message || 'An error occurred')}</p>`;
    } finally {
      isProcessing = false;
      sendButton.disabled = false;
      scrollToBottom();
      const source = options && typeof options === 'object' ? String(options.source || '') : '';
      if (source === 'studio') {
        try {
          window.NavbarComponent?.invalidateCreditsCache?.(true);
          // Settlement can lag slightly behind the SSE response; retry once.
          setTimeout(() => window.NavbarComponent?.invalidateCreditsCache?.(true), 1500);
        } catch {
          // ignore
        }
      }
    }
  }

  function renderToolResultIntoNode(node, toolName, result) {
    if (!node) return;

    // Handle tool errors consistently
    if (result && typeof result === 'object' && result.error) {
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

      const html = `
        <div class="tool-error">
          <div class="tool-error-title">Error: ${escapeHtml(title)}</div>
          ${message ? `<div class="tool-error-message">${escapeHtml(message)}</div>` : ''}
          ${(requestedSeconds != null || allowedDurations.length) ? `
            <div class="tool-error-meta">
              ${requestedSeconds != null ? `<div><span>Requested:</span> ${escapeHtml(String(requestedSeconds))}s</div>` : ''}
              ${allowedDurations.length ? `<div><span>Allowed durations:</span> ${escapeHtml(allowedDurations.join(', '))} (seconds)</div>` : ''}
            </div>
          ` : ''}
        </div>
      `;

      window.NodeComponent?.setToolOutputHTML?.(node, html);
      window.NodeComponent?.setNodeBadge?.(node, 'Error', 'error');
      return;
    }

    if (toolName === 'web_search') {
      const answer = result?.answer ? String(result.answer) : '';
      const items = Array.isArray(result?.results) ? result.results : [];

      const html = `
        ${answer ? `<div class="tool-answer">${escapeHtml(answer)}</div>` : ''}
        ${items.length ? `
          <ol class="tool-sources">
            ${items.slice(0, 5).map((r) => {
              const title = r?.title ? String(r.title) : 'Untitled';
              const url = r?.url ? String(r.url) : '';
              const content = r?.content ? String(r.content) : '';
              const snippet = content.length > 220 ? `${content.slice(0, 220)}…` : content;
              return `
                <li class="tool-source">
                  <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(title)}</a>
                  ${snippet ? `<div class="tool-snippet">${escapeHtml(snippet)}</div>` : ''}
                </li>
              `;
            }).join('')}
          </ol>
        ` : '<div class="tool-empty">No results.</div>'}
      `;

      window.NodeComponent?.setToolOutputHTML?.(node, html);
      return;
    }

    if (toolName === 'enter_plan_mode') {
      const msg = result?.message ? String(result.message) : 'Entered plan mode.';
      window.NodeComponent?.setToolOutputText?.(node, msg);
      return;
    }

    if (toolName === 'submit_plan') {
      const msg = result?.message ? String(result.message) : 'Plan submitted for approval.';
      const summary = result?.summary ? String(result.summary) : '';
      const steps = Array.isArray(result?.steps) ? result.steps : [];
      const checkpoints = Array.isArray(result?.checkpoints) ? result.checkpoints : [];
      const risks = Array.isArray(result?.risks) ? result.risks : [];

      const renderToolCalls = (calls) => {
        const list = Array.isArray(calls) ? calls : [];
        if (!list.length) return '';
        return `
          <ul class="plan-tool-calls">
            ${list.map((c) => {
              const tool = c?.tool ? String(c.tool) : '';
              const count = typeof c?.count === 'number' && Number.isFinite(c.count) ? c.count : null;
              const seconds = typeof c?.seconds === 'number' && Number.isFinite(c.seconds) ? c.seconds : null;
              const ttsChars = typeof c?.ttsChars === 'number' && Number.isFinite(c.ttsChars)
                ? c.ttsChars
                : (typeof c?.tts_chars === 'number' && Number.isFinite(c.tts_chars) ? c.tts_chars : null);
              const note = c?.note ? String(c.note) : '';
              const meta = [
                count !== null ? `×${count}` : '',
                seconds !== null ? `${seconds}s` : '',
                ttsChars !== null ? `${ttsChars} chars` : '',
              ].filter(Boolean).join(' ');
              return `<li class="plan-tool-call"><span class="plan-tool-name">${escapeHtml(tool)}</span> <span class="plan-tool-meta">${escapeHtml(meta || '')}</span> ${note ? `<span class="plan-tool-note">(${escapeHtml(note)})</span>` : ''}</li>`;
            }).join('')}
          </ul>
        `;
      };

      const html = `
        <div class="plan-submit">
          <div class="plan-submit-msg">${escapeHtml(msg)}</div>
          ${summary ? `<div class="plan-summary">${escapeHtml(summary)}</div>` : ''}
          ${steps.length ? `
            <div class="plan-section">
              <div class="plan-section-title">Submitted steps</div>
              <div class="plan-steps">
                ${steps.map((s, idx) => {
                  const titleText = s?.title ? String(s.title) : `Step ${idx + 1}`;
                  const desc = s?.description ? String(s.description) : '';
                  const planned = s?.plannedToolCalls || s?.planned_tool_calls || [];
                  return `
                    <div class="plan-step">
                      <div class="plan-step-title">${escapeHtml(String(idx + 1))}. ${escapeHtml(titleText)}</div>
                      ${desc ? `<div class="plan-step-desc">${escapeHtml(desc)}</div>` : ''}
                      ${planned && Array.isArray(planned) && planned.length ? `
                        <div class="plan-step-subtitle">Planned tool calls</div>
                        ${renderToolCalls(planned)}
                      ` : ''}
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          ` : ''}
          ${checkpoints.length ? `
            <div class="plan-section">
              <div class="plan-section-title">Planned checkpoints</div>
              <ul class="plan-bullets">${checkpoints.map((c) => `<li>${escapeHtml(String(c))}</li>`).join('')}</ul>
            </div>
          ` : ''}
          ${risks.length ? `
            <div class="plan-section">
              <div class="plan-section-title">Risks</div>
              <ul class="plan-bullets">${risks.map((r) => `<li>${escapeHtml(String(r))}</li>`).join('')}</ul>
            </div>
          ` : ''}
        </div>
      `;

      window.NodeComponent?.setToolOutputHTML?.(node, html);
      return;
    }

    if (toolName === 'generate_image') {
      const imageUrl = result?.imageUrl ? String(result.imageUrl) : '';
      const revisedPrompt = result?.revisedPrompt ? String(result.revisedPrompt) : '';

      const html = `
        ${revisedPrompt ? `<div class="tool-revised"><span>Revised prompt:</span> ${escapeHtml(revisedPrompt)}</div>` : ''}
        ${imageUrl ? `<div class="generated-image-container"><img src="${escapeHtml(imageUrl)}" class="generated-image" alt="Generated image"></div>` : '<div class="tool-empty">No image URL returned.</div>'}
      `;

      window.NodeComponent?.setToolOutputHTML?.(node, html);
      return;
    }

    if (toolName === 'text_to_speech') {
      const audioUrl = result?.audioUrl ? String(result.audioUrl) : '';
      const savedUrl = result?.savedUrl ? String(result.savedUrl) : '';
      const textPreview = result?.text ? String(result.text) : '';
      const voice = result?.voice ? String(result.voice) : 'alloy';

      if (audioUrl) {
        const html = `
          <div class="tts-result">
            <div class="tts-info"><span>Voice:</span> ${escapeHtml(voice)}</div>
            ${textPreview ? `<div class="tts-text">"${escapeHtml(textPreview)}"</div>` : ''}
            <audio class="tts-audio" controls preload="metadata">
              <source src="${escapeHtml(audioUrl)}" type="audio/mpeg">
              Your browser does not support the audio element.
            </audio>
            ${savedUrl ? `<div class="tts-saved"><span>Saved:</span> <a href="${escapeHtml(savedUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(savedUrl)}</a></div>` : ''}
          </div>
        `;
        window.NodeComponent?.setToolOutputHTML?.(node, html);
      } else {
        window.NodeComponent?.setToolOutputText?.(node, 'Audio generation failed - no audio returned.');
        window.NodeComponent?.setNodeBadge?.(node, 'Error', 'error');
      }
      return;
    }

    if (toolName === 'generate_video') {
      const videoUrl = result?.videoUrl ? String(result.videoUrl) : '';
      const requestedSeconds = typeof result?.requestedSeconds === 'number' && Number.isFinite(result.requestedSeconds)
        ? Math.trunc(result.requestedSeconds)
        : (typeof result?.seconds === 'number' && Number.isFinite(result.seconds) ? Math.trunc(result.seconds) : null);
      const durationSeconds = typeof result?.durationSeconds === 'number' && Number.isFinite(result.durationSeconds)
        ? result.durationSeconds
        : null;
      const aspect_ratio = result?.aspect_ratio ? String(result.aspect_ratio) : '';
      const mode = result?.mode ? String(result.mode) : '';
      const providerUsed = result?.provider_used ? String(result.provider_used) : '';
      const modelUsed = result?.model_used ? String(result.model_used) : '';
      const audioGenerated = typeof result?.audio_generated === 'boolean' ? result.audio_generated : null;
      const motionScore = typeof result?.motion_score === 'number' ? result.motion_score : null;
      const usedEndKeyframes = typeof result?.used_end_keyframes === 'boolean' ? result.used_end_keyframes : null;
      const fallbackType = result?.fallback_type ? String(result.fallback_type) : '';
      const staticStyle = result?.static_style ? String(result.static_style) : '';
      const savedUrl = result?.savedUrl ? String(result.savedUrl) : '';
      const replicateUrl = result?.replicate_url ? String(result.replicate_url) : '';
      const promptPreview = result?.prompt ? String(result.prompt) : '';
      const originalPrompt = result?.original_prompt ? String(result.original_prompt) : '';
      const fallbackUsed = Boolean(result?.fallback_used);
      const fallbackReason = result?.fallback_reason ? String(result.fallback_reason) : '';

      if (videoUrl) {
        const infoParts = [];
        if (durationSeconds != null) infoParts.push(`<span>Duration:</span> ${escapeHtml(durationSeconds.toFixed(1))}s`);
        if (requestedSeconds != null) infoParts.push(`<span>Requested:</span> ${escapeHtml(String(requestedSeconds))}s`);
        if (aspect_ratio) infoParts.push(`<span>Aspect:</span> ${escapeHtml(aspect_ratio)}`);
        if (mode) infoParts.push(`<span>Mode:</span> ${escapeHtml(mode)}`);
        if (providerUsed) infoParts.push(`<span>Provider:</span> ${escapeHtml(providerUsed)}`);
        if (modelUsed) infoParts.push(`<span>Model:</span> ${escapeHtml(modelUsed)}`);
        if (audioGenerated != null) infoParts.push(`<span>Audio:</span> ${audioGenerated ? 'yes' : 'no'}`);
        if (motionScore != null) infoParts.push(`<span>Motion score:</span> ${escapeHtml(motionScore.toFixed(4))}`);
        if (usedEndKeyframes != null) infoParts.push(`<span>End keyframes:</span> ${usedEndKeyframes ? 'yes' : 'no'}`);
        if (fallbackType) infoParts.push(`<span>Fallback type:</span> ${escapeHtml(fallbackType)}`);
        if (staticStyle) infoParts.push(`<span>Static style:</span> ${escapeHtml(staticStyle)}`);
        const mutedAttr = audioGenerated ? '' : 'muted';

        const html = `
          <div class="video-result">
            ${infoParts.length ? `<div class="video-info">${infoParts.join(' • ')}</div>` : ''}
            ${promptPreview ? `<div class="video-prompt"><span>Prompt:</span> "${escapeHtml(promptPreview)}"</div>` : ''}
            ${originalPrompt ? `<div class="video-prompt"><span>Original prompt:</span> "${escapeHtml(originalPrompt)}"</div>` : ''}
            ${fallbackUsed ? `<div class="tool-note">Fallback used${fallbackReason ? `: ${escapeHtml(fallbackReason)}` : ''}.</div>` : ''}
            ${savedUrl ? `<div class="video-link"><span>Saved:</span> <a href="${escapeHtml(savedUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(savedUrl)}</a></div>` : ''}
            ${replicateUrl ? `<div class="video-link"><a href="${escapeHtml(replicateUrl)}" target="_blank" rel="noopener noreferrer">Replicate output</a></div>` : ''}
            <div class="generated-video-container">
              <video class="generated-video" controls preload="metadata" playsinline ${mutedAttr}>
                <source src="${escapeHtml(videoUrl)}" type="video/mp4">
                Your browser does not support the video element.
              </video>
            </div>
          </div>
        `;
        window.NodeComponent?.setToolOutputHTML?.(node, html);
      } else {
        window.NodeComponent?.setToolOutputText?.(node, 'Video generation failed - no video returned.');
        window.NodeComponent?.setNodeBadge?.(node, 'Error', 'error');
      }
      return;
    }

    if (toolName === 'image_to_video') {
      const videoUrl = result?.videoUrl ? String(result.videoUrl) : '';
      const duration = result?.duration != null ? String(result.duration) : '';
      const aspect = result?.aspect_ratio ? String(result.aspect_ratio) : '';
      const effect = result?.effect ? String(result.effect) : '';

      if (videoUrl) {
        const html = `
          <div class="video-result">
            <div class="video-info">
              ${duration ? `<span>Duration:</span> ${escapeHtml(duration)}s` : ''}
              ${aspect ? ` • <span>Aspect:</span> ${escapeHtml(aspect)}` : ''}
              ${effect ? ` • <span>Effect:</span> ${escapeHtml(effect)}` : ''}
            </div>
            <div class="generated-video-container">
              <video class="generated-video" controls preload="metadata" playsinline>
                <source src="${escapeHtml(videoUrl)}" type="video/mp4">
                Your browser does not support the video element.
              </video>
            </div>
          </div>
        `;
        window.NodeComponent?.setToolOutputHTML?.(node, html);
      } else {
        window.NodeComponent?.setToolOutputText?.(node, 'No video URL returned.');
        window.NodeComponent?.setNodeBadge?.(node, 'Error', 'error');
      }
      return;
    }

    if (toolName === 'merge_videos') {
      const videoUrl = result?.videoUrl ? String(result.videoUrl) : '';
      const clipCount = result?.clipCount != null ? String(result.clipCount) : '';
      const duration = result?.duration != null ? String(result.duration) : '';
      const audioPreserved = typeof result?.audioPreserved === 'boolean' ? (result.audioPreserved ? 'yes' : 'no') : '';
      const transition = result?.transition ? String(result.transition) : '';
      const audioNote = result?.audioNote ? String(result.audioNote) : '';

      if (videoUrl) {
        const html = `
          <div class="video-result">
            <div class="video-info">
              ${clipCount ? `<span>Clips:</span> ${escapeHtml(clipCount)}` : ''}
              ${duration ? ` • <span>Duration:</span> ${escapeHtml(duration)}s` : ''}
              ${audioPreserved ? ` • <span>Audio:</span> ${escapeHtml(audioPreserved)}` : ''}
              ${transition ? ` • <span>Transition:</span> ${escapeHtml(transition)}` : ''}
            </div>
            ${audioNote ? `<div class="tool-note">${escapeHtml(audioNote)}</div>` : ''}
            <div class="generated-video-container">
              <video class="generated-video" controls preload="metadata" playsinline>
                <source src="${escapeHtml(videoUrl)}" type="video/mp4">
                Your browser does not support the video element.
              </video>
            </div>
          </div>
        `;
        window.NodeComponent?.setToolOutputHTML?.(node, html);
      } else {
        window.NodeComponent?.setToolOutputText?.(node, 'No merged video URL returned.');
        window.NodeComponent?.setNodeBadge?.(node, 'Error', 'error');
      }
      return;
    }

    if (toolName === 'add_background_music') {
      const videoUrl = result?.videoUrl ? String(result.videoUrl) : '';
      const volume = result?.volume != null ? String(result.volume) : '';
      const looped = typeof result?.looped === 'boolean' ? (result.looped ? 'yes' : 'no') : '';

      if (videoUrl) {
        const html = `
          <div class="video-result">
            <div class="video-info">
              <span>Music added</span>
              ${volume ? ` • <span>Volume:</span> ${escapeHtml(volume)}` : ''}
              ${looped ? ` • <span>Looped:</span> ${escapeHtml(looped)}` : ''}
            </div>
            <div class="generated-video-container">
              <video class="generated-video" controls preload="metadata" playsinline>
                <source src="${escapeHtml(videoUrl)}" type="video/mp4">
                Your browser does not support the video element.
              </video>
            </div>
          </div>
        `;
        window.NodeComponent?.setToolOutputHTML?.(node, html);
      } else {
        window.NodeComponent?.setToolOutputText?.(node, 'No video URL returned.');
        window.NodeComponent?.setNodeBadge?.(node, 'Error', 'error');
      }
      return;
    }

    if (toolName === 'add_narration') {
      const videoUrl = result?.videoUrl ? String(result.videoUrl) : '';
      const narrationUrl = result?.narrationUrl ? String(result.narrationUrl) : '';
      const voice = result?.voice ? String(result.voice) : '';
      const mode = result?.mode ? String(result.mode) : '';
      const sync = result?.sync ? String(result.sync) : '';

      if (videoUrl) {
        const html = `
          <div class="video-result">
            <div class="video-info">
              <span>Narration added</span>
              ${voice ? ` • <span>Voice:</span> ${escapeHtml(voice)}` : ''}
              ${mode ? ` • <span>Mode:</span> ${escapeHtml(mode)}` : ''}
              ${sync ? ` • <span>Sync:</span> ${escapeHtml(sync)}` : ''}
            </div>
            ${narrationUrl ? `
              <div class="media-audio-block">
                <div class="tts-info"><span>Narration file:</span> <a href="${escapeHtml(narrationUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(narrationUrl)}</a></div>
                <audio class="tts-audio" controls>
                  <source src="${escapeHtml(narrationUrl)}" type="audio/mpeg">
                  Your browser does not support the audio element.
                </audio>
              </div>
            ` : ''}
            <div class="generated-video-container">
              <video class="generated-video" controls preload="metadata" playsinline>
                <source src="${escapeHtml(videoUrl)}" type="video/mp4">
                Your browser does not support the video element.
              </video>
            </div>
          </div>
        `;
        window.NodeComponent?.setToolOutputHTML?.(node, html);
      } else {
        window.NodeComponent?.setToolOutputText?.(node, 'No video URL returned.');
        window.NodeComponent?.setNodeBadge?.(node, 'Error', 'error');
      }
      return;
    }

    if (toolName === 'generate_music') {
      const audioUrl = result?.audioUrl ? String(result.audioUrl) : '';
      const duration = result?.duration != null ? String(result.duration) : '';
      const promptPreview = result?.prompt ? String(result.prompt) : '';

      if (audioUrl) {
        const lower = audioUrl.toLowerCase();
        const mime = lower.endsWith('.wav') ? 'audio/wav' : (lower.endsWith('.m4a') ? 'audio/mp4' : 'audio/mpeg');
        const html = `
          <div class="tts-result">
            <div class="tts-info">
              <span>MusicGen</span>
              ${duration ? ` • <span>Duration:</span> ${escapeHtml(duration)}s` : ''}
            </div>
            ${promptPreview ? `<div class="tts-text">"${escapeHtml(promptPreview)}"</div>` : ''}
            <audio class="tts-audio" controls>
              <source src="${escapeHtml(audioUrl)}" type="${mime}">
              Your browser does not support the audio element.
            </audio>
          </div>
        `;
        window.NodeComponent?.setToolOutputHTML?.(node, html);
      } else {
        window.NodeComponent?.setToolOutputText?.(node, 'No audio URL returned.');
        window.NodeComponent?.setNodeBadge?.(node, 'Error', 'error');
      }
      return;
    }

    if (toolName === 'export_audio') {
      const audioUrl = result?.audioUrl ? String(result.audioUrl) : '';
      const duration = result?.duration != null ? String(result.duration) : '';
      const format = result?.format ? String(result.format) : '';

      if (audioUrl) {
        const html = `
          <div class="tts-result">
            <div class="tts-info">
              <span>Exported audio</span>
              ${format ? ` • <span>Format:</span> ${escapeHtml(format)}` : ''}
              ${duration ? ` • <span>Duration:</span> ${escapeHtml(duration)}s` : ''}
            </div>
            <div class="tts-info"><span>File:</span> <a href="${escapeHtml(audioUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(audioUrl)}</a></div>
            <audio class="tts-audio" controls>
              <source src="${escapeHtml(audioUrl)}" type="${format === 'wav' ? 'audio/wav' : 'audio/mpeg'}">
              Your browser does not support the audio element.
            </audio>
          </div>
        `;
        window.NodeComponent?.setToolOutputHTML?.(node, html);
      } else {
        window.NodeComponent?.setToolOutputText?.(node, 'No audio URL returned.');
        window.NodeComponent?.setNodeBadge?.(node, 'Error', 'error');
      }
      return;
    }

    // Default: stringify
    window.NodeComponent?.setToolOutputText?.(node, typeof result === 'string' ? result : JSON.stringify(result, null, 2));
  }

  function ensureTodoNode(activityEl) {
    const node = window.NodeComponent?.createNode?.('todo', 'Update Todos', { collapsed: false });
    if (!node) return null;
    node.dataset.todoNode = 'true';
    activityEl.prepend(node);
    return node;
  }

  function todoBadgeText(todos) {
    const list = Array.isArray(todos) ? todos : [];
    const total = list.length;
    const completed = list.filter((t) => t?.status === 'completed').length;
    const inProgress = list.filter((t) => t?.status === 'in_progress').length;
    if (!total) return '0';
    if (completed === total) return `${completed}/${total} done`;
    if (inProgress) return `${completed}/${total} • working`;
    return `${completed}/${total}`;
  }

  function todoBadgeTextFromNode(node) {
    const badgeEl = node?.querySelector?.('.node-badge');
    return badgeEl?.textContent || '';
  }

  function renderTodosIntoNode(node, todos) {
    if (!node) return;
    const list = Array.isArray(todos) ? todos : [];
    const html = `
      <div class="todo-items">
        ${list.map((t) => {
          const content = t?.content ? String(t.content) : '';
          const status = t?.status ? String(t.status) : 'pending';
          const icon = status === 'completed' ? '✓' : status === 'in_progress' ? '●' : '○';
          return `
            <div class="todo-item ${escapeHtml(status)}">
              <div class="todo-checkbox">${icon}</div>
              <div class="todo-text">${escapeHtml(content)}</div>
            </div>
          `;
        }).join('')}
      </div>
    `;
    window.NodeComponent?.setNodeHTML?.(node, html);
  }

  function toolNameToTitle(name) {
    switch (name) {
      case 'enter_plan_mode': return 'Enter Plan Mode';
      case 'submit_plan': return 'Submit Plan';
      case 'web_search': return 'Web Search';
      case 'generate_image': return 'Generate Image';
      case 'generate_video': return 'Generate Video';
      case 'text_to_speech': return 'Text to Speech';
      case 'image_to_video': return 'Image to Video';
      case 'merge_videos': return 'Merge Videos';
      case 'add_background_music': return 'Add Background Music';
      case 'add_narration': return 'Add Narration';
      case 'generate_music': return 'Generate Music';
      case 'export_audio': return 'Export Audio';
      default: return String(name || 'Tool');
    }
  }

  function renderMarkdown(text) {
    if (!text) return '';
    if (!window.marked) return `<p>${escapeHtml(text).replace(/\n/g, '<br>')}</p>`;

    const raw = window.marked.parse(text);
    if (!window.DOMPurify) return raw;
    return window.DOMPurify.sanitize(raw, { ADD_ATTR: ['target', 'rel'] });
  }

  function scrollToBottom() {
    const el = chatScrollContainer || messagesContainer;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }

  function createUserMessage(text) {
    const el = document.createElement('div');
    el.className = 'message user';
    el.innerHTML = `<div class="message-content">${escapeHtml(text)}</div>`;
    return el;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = String(text ?? '');
    return div.innerHTML;
  }

  function getStudioSelectedVersionInfo(toolUseId) {
    try {
      return window.MediaPanel?.getSelectedVersionInfoForToolUseId?.(toolUseId) || null;
    } catch {
      return null;
    }
  }

  function syncKeyframeApprovalNode(node) {
    if (!node || typeof node.querySelectorAll !== 'function') return;
    const items = Array.from(node.querySelectorAll('.keyframe-item[data-tool-use-id]'));
    if (!items.length) return;

    for (const item of items) {
      const toolUseId = item.getAttribute('data-tool-use-id') || '';
      const originalUrl = item.getAttribute('data-original-url') || '';
      const originalPrompt = item.getAttribute('data-original-prompt') || '';

      const selected = toolUseId ? getStudioSelectedVersionInfo(toolUseId) : null;
      const url = selected?.url ? String(selected.url) : originalUrl;
      const prompt = selected?.prompt ? String(selected.prompt) : originalPrompt;
      const versionLabel = selected?.selectedVersionLabel ? String(selected.selectedVersionLabel) : '';
      const isChanged = Boolean(selected?.changed);

      const img = item.querySelector('img');
      if (img && url) img.setAttribute('src', url);

      const caption = item.querySelector('.keyframe-caption');
      if (caption && prompt) caption.textContent = prompt;

      const badge = item.querySelector('[data-role="keyframe-selection-badge"]');
      if (badge) {
        badge.textContent = versionLabel ? `Using ${versionLabel}` : 'Using selected';
        badge.classList.toggle('is-changed', isChanged);
      }
      item.classList.toggle('is-version-changed', isChanged);
      if (selected?.selectedToolUseId) item.setAttribute('data-selected-tool-use-id', String(selected.selectedToolUseId));
    }
  }

  function syncAllKeyframeApprovalNodes() {
    try {
      document.querySelectorAll('.node[data-type="approval"][data-approval-kind="images"]').forEach((node) => syncKeyframeApprovalNode(node));
    } catch {
      // ignore
    }
  }

  function collectApprovedKeyframesFromNode(node) {
    const out = [];
    if (!node || typeof node.querySelectorAll !== 'function') return out;

    const items = Array.from(node.querySelectorAll('.keyframe-item[data-tool-use-id]'));
    for (const item of items) {
      const originalToolUseId = item.getAttribute('data-tool-use-id') || '';
      const selectedToolUseId = item.getAttribute('data-selected-tool-use-id') || '';
      const originalUrl = item.getAttribute('data-original-url') || '';
      const originalPrompt = item.getAttribute('data-original-prompt') || '';

      const selected = originalToolUseId ? getStudioSelectedVersionInfo(originalToolUseId) : null;
      const url = selected?.url ? String(selected.url) : originalUrl;
      const prompt = selected?.prompt ? String(selected.prompt) : originalPrompt;
      const versionLabel = selected?.selectedVersionLabel ? String(selected.selectedVersionLabel) : '';

      if (!url) continue;
      out.push({
        originalToolUseId: originalToolUseId || null,
        selectedToolUseId: (selected?.selectedToolUseId ? String(selected.selectedToolUseId) : selectedToolUseId) || originalToolUseId || null,
        originalUrl: originalUrl || null,
        url,
        ...(prompt ? { prompt } : {}),
        ...(versionLabel ? { selectedVersion: versionLabel } : {}),
        ...(selected?.changed ? { changed: true } : {}),
      });
    }

    return out;
  }

  window.AgenticAiStudio = {
    sendStudioEdit: async (payload) => {
      const data = payload && typeof payload === 'object' ? payload : null;
      const toolName = data && typeof data.toolName === 'string' ? data.toolName.trim() : '';
      const input = data && data.input && typeof data.input === 'object' ? data.input : null;
      if (!toolName || !input) {
        throw new Error('Invalid Studio edit payload (toolName + input required).');
      }
      const selections =
        currentModelSelections && typeof currentModelSelections === 'object' && Object.keys(currentModelSelections || {}).length
          ? currentModelSelections
          : null;
      const merged = selections && !data.modelSelections ? { ...data, modelSelections: selections } : data;
      const message = `[STUDIO_EDIT]\n${JSON.stringify(merged)}`;
      return processChat(message, { source: 'studio' });
    },
  };

  window.AgenticAiSession = {
    getSessionId: () => sessionId,
    setSessionId: (id) => {
      const next = typeof id === 'string' ? id.trim() : '';
      if (!next) return;
      persistSessionId(next);
    },
  };

  window.addEventListener('agenticai:studio-state-changed', () => {
    syncAllKeyframeApprovalNodes();
  });

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
