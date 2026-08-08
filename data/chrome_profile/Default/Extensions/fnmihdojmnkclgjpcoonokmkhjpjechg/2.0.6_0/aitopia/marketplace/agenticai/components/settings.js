// Settings Component - AgenticAI parity (HTL mode + budgets)

(function () {
  'use strict';

  const STORAGE_KEY = 'agenticai.settings.v1';

  const DEFAULT_SETTINGS = {
    htlMode: 'semi', // 'semi' | 'autopilot'
    budgets: {
      override: false,
      maxTaskUsd: 5,
      warnAtPercent: 80,
      maxByModelUsdMicrosJson:
        '{"anthropic:claude-opus-4-20250514":5000000,"replicate:*":10000000}',
    },
    modelSelection: {
      enabled: true,
      sticky: false,
      showInPlanApprovals: true,
      showInCheckpoints: true,
      showInBudgetPauses: true,
    },
  };

  function isRecord(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  function clampNumber(value, min, max, fallback) {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  function sanitizeSettings(input) {
    if (!isRecord(input)) return { ...DEFAULT_SETTINGS };
    const htlMode = input.htlMode === 'autopilot' || input.htlMode === 'semi' ? input.htlMode : DEFAULT_SETTINGS.htlMode;
    const budgets = isRecord(input.budgets) ? input.budgets : {};
    const modelSelection = isRecord(input.modelSelection) ? input.modelSelection : {};

    return {
      htlMode,
      budgets: {
        override: Boolean(budgets.override),
        maxTaskUsd: clampNumber(budgets.maxTaskUsd, 0.1, 1000, DEFAULT_SETTINGS.budgets.maxTaskUsd),
        warnAtPercent: clampNumber(budgets.warnAtPercent, 1, 99, DEFAULT_SETTINGS.budgets.warnAtPercent),
        maxByModelUsdMicrosJson:
          typeof budgets.maxByModelUsdMicrosJson === 'string'
            ? budgets.maxByModelUsdMicrosJson
            : DEFAULT_SETTINGS.budgets.maxByModelUsdMicrosJson,
      },
      modelSelection: {
        enabled: modelSelection.enabled !== false,
        sticky: Boolean(modelSelection.sticky),
        showInPlanApprovals: modelSelection.showInPlanApprovals !== false,
        showInCheckpoints: modelSelection.showInCheckpoints !== false,
        showInBudgetPauses: modelSelection.showInBudgetPauses !== false,
      },
    };
  }

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return sanitizeSettings(parsed);
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettings(next) {
    const sanitized = sanitizeSettings(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
    } catch {
      // ignore
    }
    return sanitized;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = String(text ?? '');
    return div.innerHTML;
  }

  let settings = loadSettings();
  let overlayEl = null;
  let modalEl = null;

  function close() {
    if (overlayEl) overlayEl.remove();
    overlayEl = null;
    modalEl = null;
    try {
      document.body.classList.remove('modal-open');
    } catch {
      // ignore
    }
  }

  function parseMaxByModelJson(value) {
    const raw = String(value || '').trim();
    if (!raw) return { ok: true, value: {} };
    try {
      const parsed = JSON.parse(raw);
      if (!isRecord(parsed)) return { ok: false, error: 'Must be a JSON object.' };
      return { ok: true, value: parsed };
    } catch (err) {
      return { ok: false, error: err?.message ? String(err.message) : 'Invalid JSON.' };
    }
  }

  function open() {
    close();

    overlayEl = document.createElement('div');
    overlayEl.className = 'modal-overlay';
    overlayEl.addEventListener('click', (e) => {
      if (e.target === overlayEl) close();
    });

    modalEl = document.createElement('div');
    modalEl.className = 'modal';
    modalEl.innerHTML = `
      <div class="modal-header">
        <div class="modal-title">Settings</div>
        <button type="button" class="modal-close" aria-label="Close">×</button>
      </div>

      <div class="modal-body">
        <div class="settings-section">
          <div class="settings-section-title">HTL Mode</div>
          <div class="settings-row">
            <label class="settings-label" for="agenticai-htl-mode">Mode</label>
            <select id="agenticai-htl-mode" class="settings-select">
              <option value="semi">Semi-copilot (plan + checkpoints)</option>
              <option value="autopilot">Autopilot</option>
            </select>
            <div class="settings-hint">Plan approvals and budget checkpoints appear as an “Approval required” card in chat.</div>
          </div>
        </div>

        <div class="settings-section">
          <div class="settings-section-title">Budgets</div>
          <label class="settings-checkbox">
            <input id="agenticai-budget-override" type="checkbox" />
            <span>Override server budgets for this browser</span>
          </label>

          <div class="settings-grid">
            <div class="settings-field">
              <label class="settings-label" for="agenticai-budget-max-task">Max task ($)</label>
              <input id="agenticai-budget-max-task" class="settings-input" inputmode="decimal" type="number" step="0.1" min="0.1" max="1000" />
            </div>
            <div class="settings-field">
              <label class="settings-label" for="agenticai-budget-warn-at">Warn at (%)</label>
              <input id="agenticai-budget-warn-at" class="settings-input" inputmode="numeric" type="number" step="1" min="1" max="99" />
            </div>
          </div>

          <div class="settings-field">
            <label class="settings-label" for="agenticai-budget-max-by-model">Max by model (JSON, usdMicros)</label>
            <textarea id="agenticai-budget-max-by-model" class="settings-textarea" rows="3" spellcheck="false"></textarea>
            <div id="agenticai-budget-max-by-model-error" class="settings-error" hidden></div>
          </div>
        </div>

        <div class="settings-section">
          <div class="settings-section-title">Model Selection</div>
          <label class="settings-checkbox">
            <input id="agenticai-model-selection-enabled" type="checkbox" />
            <span>Enable model selection in approvals</span>
          </label>
          <label class="settings-checkbox">
            <input id="agenticai-model-selection-sticky" type="checkbox" />
            <span>Remember selections for this session (sticky)</span>
          </label>
          <label class="settings-checkbox">
            <input id="agenticai-model-selection-plan" type="checkbox" />
            <span>Show in plan approvals</span>
          </label>
          <label class="settings-checkbox">
            <input id="agenticai-model-selection-checkpoints" type="checkbox" />
            <span>Show in checkpoints</span>
          </label>
          <label class="settings-checkbox">
            <input id="agenticai-model-selection-budget" type="checkbox" />
            <span>Show in budget pauses</span>
          </label>
          <div class="settings-hint">These toggles control whether model dropdowns appear in approvals and whether selections are remembered. Selected model IDs are sent to the server when you click Approve.</div>
        </div>

        <div class="settings-section">
          <div class="settings-section-title">Character Consistency</div>
          <label class="settings-checkbox">
            <input id="agenticai-character-mode-toggle" type="checkbox" />
            <span>Character Consistency Mode</span>
          </label>
          <div id="agenticai-character-mode-hint" class="settings-hint"></div>
          <div class="settings-hint">Active character: <strong id="agenticai-character-active-name">None</strong></div>
          <div class="approval-actions" style="margin-top:10px;">
            <button type="button" class="approval-btn secondary" id="agenticai-character-refresh">Refresh</button>
            <button type="button" class="approval-btn secondary" id="agenticai-character-clear">Clear</button>
          </div>
          <div id="agenticai-character-error" class="settings-error" hidden></div>
        </div>
      </div>
    `;

    const closeBtn = modalEl.querySelector('.modal-close');
    closeBtn?.addEventListener('click', close);

    const modeSelect = modalEl.querySelector('#agenticai-htl-mode');
    const budgetOverride = modalEl.querySelector('#agenticai-budget-override');
    const budgetMaxTask = modalEl.querySelector('#agenticai-budget-max-task');
    const budgetWarnAt = modalEl.querySelector('#agenticai-budget-warn-at');
    const budgetMaxByModel = modalEl.querySelector('#agenticai-budget-max-by-model');
    const budgetMaxByModelError = modalEl.querySelector('#agenticai-budget-max-by-model-error');

    const msEnabled = modalEl.querySelector('#agenticai-model-selection-enabled');
    const msSticky = modalEl.querySelector('#agenticai-model-selection-sticky');
    const msPlan = modalEl.querySelector('#agenticai-model-selection-plan');
    const msCheckpoints = modalEl.querySelector('#agenticai-model-selection-checkpoints');
    const msBudget = modalEl.querySelector('#agenticai-model-selection-budget');

    const ccToggle = modalEl.querySelector('#agenticai-character-mode-toggle');
    const ccHint = modalEl.querySelector('#agenticai-character-mode-hint');
    const ccActiveName = modalEl.querySelector('#agenticai-character-active-name');
    const ccRefresh = modalEl.querySelector('#agenticai-character-refresh');
    const ccClear = modalEl.querySelector('#agenticai-character-clear');
    const ccError = modalEl.querySelector('#agenticai-character-error');

    // Initial values
    modeSelect.value = settings.htlMode;
    budgetOverride.checked = Boolean(settings.budgets.override);
    budgetMaxTask.value = String(settings.budgets.maxTaskUsd ?? '');
    budgetWarnAt.value = String(settings.budgets.warnAtPercent ?? '');
    budgetMaxByModel.value = String(settings.budgets.maxByModelUsdMicrosJson ?? '');
    msEnabled.checked = settings.modelSelection.enabled !== false;
    msSticky.checked = Boolean(settings.modelSelection.sticky);
    msPlan.checked = settings.modelSelection.showInPlanApprovals !== false;
    msCheckpoints.checked = settings.modelSelection.showInCheckpoints !== false;
    msBudget.checked = settings.modelSelection.showInBudgetPauses !== false;

    const syncBudgetDisabled = () => {
      const enabled = Boolean(budgetOverride.checked);
      budgetMaxTask.disabled = !enabled;
      budgetWarnAt.disabled = !enabled;
      budgetMaxByModel.disabled = !enabled;
      budgetMaxByModelError.hidden = true;
      budgetMaxByModelError.textContent = '';
    };
    syncBudgetDisabled();

    let ccDeployed = false;

    const loadSessionId = () => {
      try {
        const sid = localStorage.getItem('agenticai_session_id');
        return sid && typeof sid === 'string' && sid.trim() ? sid.trim() : '';
      } catch {
        return '';
      }
    };

    const setSessionId = (id) => {
      const next = typeof id === 'string' ? id.trim() : '';
      if (!next) return;
      if (window.AgenticAiSession && typeof window.AgenticAiSession.setSessionId === 'function') {
        window.AgenticAiSession.setSessionId(next);
        return;
      }
      try {
        localStorage.setItem('agenticai_session_id', next);
      } catch {
        // ignore
      }
    };

    const setCcError = (message) => {
      if (!ccError) return;
      const msg = typeof message === 'string' ? message.trim() : '';
      if (!msg) {
        ccError.hidden = true;
        ccError.textContent = '';
        return;
      }
      ccError.hidden = false;
      ccError.textContent = msg;
    };

    const refreshCharacterState = async () => {
      if (!ccToggle || !ccHint || !ccActiveName || !ccRefresh || !ccClear) return;

      setCcError('');
      ccToggle.disabled = true;
      ccClear.disabled = true;
      ccRefresh.disabled = true;

      const sessionId = loadSessionId();
      if (!sessionId) {
        ccDeployed = false;
        ccToggle.checked = false;
        ccActiveName.textContent = 'None';
        ccHint.innerHTML = 'Start a chat first to initialize a session.';
        ccToggle.disabled = true;
        ccClear.disabled = true;
        ccRefresh.disabled = false;
        return;
      }

      try {
        const res = await fetch(`https://aitopia.ai/api/agenticai/character-state?sessionId=${encodeURIComponent(sessionId)}`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          const msg = json?.error ? String(json.error) : `HTTP ${res.status}`;
          throw new Error(msg);
        }

        ccDeployed = Boolean(json?.deployed);

        const returnedSessionId = typeof json?.sessionId === 'string' ? String(json.sessionId).trim() : '';
        if (returnedSessionId && returnedSessionId !== sessionId) setSessionId(returnedSessionId);

        const state = json?.state && typeof json.state === 'object' ? json.state : {};
        const cc = state?.characterConsistency && typeof state.characterConsistency === 'object' ? state.characterConsistency : {};
        const enabled = Boolean(cc.enabled);
        const activeId = typeof cc.activeCharacterId === 'string' ? cc.activeCharacterId : '';
        const characters = cc.characters && typeof cc.characters === 'object' ? cc.characters : {};
        const active = activeId && characters[activeId] && typeof characters[activeId] === 'object' ? characters[activeId] : null;
        const activeName = active && typeof active.name === 'string' ? active.name : '';

        ccToggle.checked = enabled;
        ccActiveName.textContent = activeName || 'None';

        ccHint.innerHTML = ccDeployed
          ? 'Tip: Click <strong>Set as Character</strong> on an image in the Studio media panel. For scenes without the character, include <em>“background only”</em> or <em>“no people”</em>.'
          : 'To enable Character Consistency on the server, set <code>FEATURE_CHARACTER_CONSISTENCY=1</code> and restart.';

        ccToggle.disabled = !ccDeployed;
        ccClear.disabled = !ccDeployed;
      } catch (err) {
        setCcError(err?.message ? String(err.message) : String(err));
      } finally {
        ccRefresh.disabled = false;
      }
    };

    const commit = () => {
      const next = {
        ...settings,
        htlMode: modeSelect.value === 'autopilot' ? 'autopilot' : 'semi',
        budgets: {
          ...settings.budgets,
          override: Boolean(budgetOverride.checked),
          maxTaskUsd: clampNumber(budgetMaxTask.value, 0.1, 1000, DEFAULT_SETTINGS.budgets.maxTaskUsd),
          warnAtPercent: clampNumber(budgetWarnAt.value, 1, 99, DEFAULT_SETTINGS.budgets.warnAtPercent),
          maxByModelUsdMicrosJson: String(budgetMaxByModel.value || ''),
        },
        modelSelection: {
          enabled: Boolean(msEnabled.checked),
          sticky: Boolean(msSticky.checked),
          showInPlanApprovals: Boolean(msPlan.checked),
          showInCheckpoints: Boolean(msCheckpoints.checked),
          showInBudgetPauses: Boolean(msBudget.checked),
        },
      };

      const parsedMaxByModel = parseMaxByModelJson(next.budgets.maxByModelUsdMicrosJson);
      if (!parsedMaxByModel.ok) {
        budgetMaxByModelError.hidden = false;
        budgetMaxByModelError.textContent = parsedMaxByModel.error;
      } else {
        budgetMaxByModelError.hidden = true;
        budgetMaxByModelError.textContent = '';
      }

      settings = saveSettings(next);
    };

    modeSelect.addEventListener('change', commit);
    budgetOverride.addEventListener('change', () => {
      syncBudgetDisabled();
      commit();
    });
    budgetMaxTask.addEventListener('input', commit);
    budgetWarnAt.addEventListener('input', commit);
    budgetMaxByModel.addEventListener('input', commit);
    msEnabled.addEventListener('change', commit);
    msSticky.addEventListener('change', commit);
    msPlan.addEventListener('change', commit);
    msCheckpoints.addEventListener('change', commit);
    msBudget.addEventListener('change', commit);

    ccRefresh?.addEventListener('click', () => {
      refreshCharacterState();
    });

    ccToggle?.addEventListener('change', async () => {
      if (!ccToggle) return;
      setCcError('');

      if (!ccDeployed) {
        ccToggle.checked = false;
        setCcError('Character Consistency is not deployed on the server (FEATURE_CHARACTER_CONSISTENCY=0).');
        return;
      }

      const sessionId = loadSessionId();
      if (!sessionId) {
        ccToggle.checked = false;
        setCcError('Missing sessionId. Start a chat first.');
        return;
      }

      const enabled = Boolean(ccToggle.checked);
      ccToggle.disabled = true;
      ccClear.disabled = true;
      ccRefresh.disabled = true;
      try {
        const res = await fetch('https://aitopia.ai/api/agenticai/character-mode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ sessionId, enabled }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          const msg = json?.error ? String(json.error) : `HTTP ${res.status}`;
          throw new Error(msg);
        }
        const returnedSessionId = typeof json?.sessionId === 'string' ? String(json.sessionId).trim() : '';
        if (returnedSessionId && returnedSessionId !== sessionId) setSessionId(returnedSessionId);
      } catch (err) {
        setCcError(err?.message ? String(err.message) : String(err));
        ccToggle.checked = !enabled;
      } finally {
        await refreshCharacterState();
      }
    });

    ccClear?.addEventListener('click', async () => {
      setCcError('');
      const sessionId = loadSessionId();
      if (!sessionId) return;
      ccToggle.disabled = true;
      ccClear.disabled = true;
      ccRefresh.disabled = true;
      try {
        const res = await fetch('https://aitopia.ai/api/agenticai/character-mode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ sessionId, enabled: false }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          const msg = json?.error ? String(json.error) : `HTTP ${res.status}`;
          throw new Error(msg);
        }
        const returnedSessionId = typeof json?.sessionId === 'string' ? String(json.sessionId).trim() : '';
        if (returnedSessionId && returnedSessionId !== sessionId) setSessionId(returnedSessionId);
      } catch (err) {
        setCcError(err?.message ? String(err.message) : String(err));
      } finally {
        await refreshCharacterState();
      }
    });

    overlayEl.appendChild(modalEl);
    document.body.appendChild(overlayEl);
    try {
      document.body.classList.add('modal-open');
    } catch {
      // ignore
    }

    // Keyboard trap: Esc closes.
    const onKeyDown = (e) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKeyDown, { once: true });

    refreshCharacterState();
  }

  function init() {
    const btn = document.getElementById('settings-button');
    if (btn) btn.addEventListener('click', open);
  }

  function get() {
    return settings;
  }

  function buildChatRequestSettings() {
    const maxByModel = parseMaxByModelJson(settings.budgets.maxByModelUsdMicrosJson);
    return {
      htl: {
        mode: settings.htlMode,
      },
      ...(settings.budgets.override
        ? {
            budgets: {
              maxTaskUsd: settings.budgets.maxTaskUsd,
              warnAtPercent: settings.budgets.warnAtPercent,
              maxByModelUsdMicros: maxByModel.ok ? maxByModel.value : {},
            },
          }
        : {}),
    };
  }

  window.AgenticAiSettings = {
    init,
    open,
    close,
    get,
    buildChatRequestSettings,
  };
})();
