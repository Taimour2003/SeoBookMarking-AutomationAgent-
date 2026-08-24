const API_BASE = window.__AITOPIA_DOMAIN__ || 'https://aitopia.ai';
    const state = {
      apps: [],
      selectedAppId: null,
      definition: null,
      inputs: {},
      polling: null,
    };

    const el = {
      tenantId: document.getElementById('tenantId'),
      userId: document.getElementById('userId'),
      userTier: document.getElementById('userTier'),
      asyncMode: document.getElementById('asyncMode'),
      refreshBtn: document.getElementById('refreshBtn'),
      appsList: document.getElementById('appsList'),
      appsMeta: document.getElementById('appsMeta'),
      detailTitle: document.getElementById('detailTitle'),
      runBtn: document.getElementById('runBtn'),
      stopBtn: document.getElementById('stopBtn'),
      statusBox: document.getElementById('statusBox'),
      inputsBox: document.getElementById('inputsBox'),
      resultBox: document.getElementById('resultBox'),
    };

    function uuid() {
      if (crypto && crypto.randomUUID) return crypto.randomUUID();
      return 'id-' + Math.random().toString(16).slice(2) + '-' + Date.now().toString(16);
    }

    function getHeaders(extra = {}) {
      const tenantId = (el.tenantId.value || 'public').trim();
      const userId = el.userId.value.trim();
      const userTier = el.userTier.value.trim();
      const headers = {
        'Content-Type': 'application/json',
        'X-Tenant-Id': tenantId,
        ...extra,
      };
      if (userId) headers['X-User-Id'] = userId;
      if (userTier) headers['X-User-Tier'] = userTier;
      return headers;
    }

    function showStatus(type, message) {
      if (!message) {
        el.statusBox.innerHTML = '';
        return;
      }
      const cls = type === 'error' ? 'error' : type === 'success' ? 'success' : 'success';
      el.statusBox.innerHTML = `<div class="${cls}">${escapeHtml(message)}</div>`;
    }

    function escapeHtml(str) {
      return String(str)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
    }

    async function api(path, options = {}) {
      const res = await fetch(API_BASE + path, {
        ...options,
        headers: { ...getHeaders(), ...(options.headers || {}) },
      });
      const text = await res.text();
      let json;
      try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
      if (!res.ok) {
        const msg = json?.error?.message || json?.error || json?.message || `HTTP ${res.status}`;
        const err = new Error(msg);
        err.status = res.status;
        err.body = json;
        throw err;
      }
      return json;
    }

    function renderAppsList() {
      el.appsMeta.textContent = String(state.apps.length);
      el.appsList.innerHTML = '';
      if (!state.apps.length) {
        el.appsList.innerHTML = `<div class="content"><div class="hint">No apps found for this tenant/user.</div></div>`;
        return;
      }

      for (const app of state.apps) {
        const item = document.createElement('div');
        item.className = 'app-item' + (app.id === state.selectedAppId ? ' active' : '');
        item.innerHTML = `
          <div class="name">${escapeHtml(app.name)}</div>
          <div class="meta">${escapeHtml(app.id)} · v${escapeHtml(app.currentVersion)} · ${escapeHtml(app.visibility)}</div>
        `;
        item.addEventListener('click', () => selectApp(app.id));
        el.appsList.appendChild(item);
      }
    }

    function stopPolling() {
      if (state.polling) {
        clearInterval(state.polling.timer);
        state.polling = null;
      }
      el.stopBtn.disabled = true;
    }

    function inferMediaType(url) {
      const lower = url.toLowerCase();
      if (lower.startsWith('data:image/')) return 'image';
      if (lower.startsWith('data:video/')) return 'video';
      if (lower.startsWith('data:audio/')) return 'audio';
      if (/\.(png|jpg|jpeg|webp|gif)(\?|#|$)/.test(lower)) return 'image';
      if (/\.(mp4|webm|mov|m4v)(\?|#|$)/.test(lower)) return 'video';
      if (/\.(mp3|wav|m4a|aac|ogg)(\?|#|$)/.test(lower)) return 'audio';
      return 'unknown';
    }

    function renderNormalized(normalized) {
      if (!normalized) return '';
      if (normalized.type === 'text') return `<pre>${escapeHtml(normalized.text)}</pre>`;
      if (normalized.type === 'json') return `<pre>${escapeHtml(JSON.stringify(normalized.data, null, 2))}</pre>`;
      if (normalized.type === 'image') return `<div class="result-media"><img src="${escapeHtml(normalized.url)}" alt="image" /></div>`;
      if (normalized.type === 'video') return `<div class="result-media"><video src="${escapeHtml(normalized.url)}" controls></video></div>`;
      if (normalized.type === 'audio') return `<div class="result-media"><audio src="${escapeHtml(normalized.url)}" controls></audio></div>`;
      if (normalized.type === 'gallery') {
        const items = normalized.urls.map(u => {
          const t = inferMediaType(u);
          if (t === 'video') return `<video src="${escapeHtml(u)}" controls></video>`;
          if (t === 'audio') return `<audio src="${escapeHtml(u)}" controls></audio>`;
          return `<img src="${escapeHtml(u)}" alt="media" />`;
        }).join('');
        return `<div class="result-media" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap:10px;">${items}</div>`;
      }
      return `<pre>${escapeHtml(JSON.stringify(normalized, null, 2))}</pre>`;
    }

    function renderResult(result) {
      el.resultBox.innerHTML = '';
      if (!result) return;

      const normalizedHtml = result.normalizedOutput ? renderNormalized(result.normalizedOutput) : '';
      const raw = result.output ?? result.result ?? result;

      el.resultBox.innerHTML = `
        <div class="input-card">
          <div class="title"><strong>Result</strong><span class="badge">${escapeHtml(result.status || 'ok')}</span></div>
          ${normalizedHtml ? `<div>${normalizedHtml}</div>` : ''}
          <details style="margin-top:10px;">
            <summary>Raw output / metadata</summary>
            <pre>${escapeHtml(JSON.stringify(result, null, 2))}</pre>
          </details>
        </div>
      `;
    }

    function setDefaultInputs(definition) {
      state.inputs = {};
      for (const inp of (definition.inputs || [])) {
        if (inp.default !== undefined) state.inputs[inp.id] = inp.default;
      }
    }

    function readFileAsDataUrl(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('File read failed'));
        reader.readAsDataURL(file);
      });
    }

    function renderInputs(definition) {
      el.inputsBox.innerHTML = '';
      if (!definition) return;

      const inputs = definition.inputs || [];
      if (!inputs.length) {
        el.inputsBox.innerHTML = `<div class="hint">This app has no inputs.</div>`;
        return;
      }

      for (const inputDef of inputs) {
        const card = document.createElement('div');
        card.className = 'input-card';
        const label = inputDef.ui?.label || inputDef.id;
        const required = inputDef.required === true;
        const help = inputDef.ui?.helpText || '';
        const placeholder = inputDef.ui?.placeholder || '';
        const type = inputDef.type;

        const title = document.createElement('div');
        title.className = 'title';
        title.innerHTML = `<strong>${escapeHtml(label)}</strong>${required ? `<span class="badge req">required</span>` : `<span class="badge">${escapeHtml(type)}</span>`}`;
        card.appendChild(title);

        const id = inputDef.id;
        const current = state.inputs[id];

        const renderTextInput = () => {
          const input = document.createElement('input');
          input.type = 'text';
          input.placeholder = placeholder;
          if (typeof current === 'string') input.value = current;
          input.addEventListener('input', () => { state.inputs[id] = input.value; });
          return input;
        };

        const renderTextarea = () => {
          const ta = document.createElement('textarea');
          ta.placeholder = placeholder;
          if (typeof current === 'string') ta.value = current;
          ta.addEventListener('input', () => { state.inputs[id] = ta.value; });
          return ta;
        };

        const renderNumber = () => {
          const input = document.createElement('input');
          input.type = 'number';
          input.placeholder = placeholder;
          if (typeof current === 'number') input.value = String(current);
          input.addEventListener('input', () => {
            const v = input.value.trim();
            state.inputs[id] = v.length ? Number(v) : undefined;
          });
          return input;
        };

        const renderBoolean = () => {
          const wrap = document.createElement('div');
          wrap.style.display = 'flex';
          wrap.style.alignItems = 'center';
          wrap.style.gap = '10px';
          const input = document.createElement('input');
          input.type = 'checkbox';
          input.checked = current === true;
          input.addEventListener('change', () => { state.inputs[id] = input.checked; });
          const text = document.createElement('div');
          text.className = 'hint';
          text.textContent = inputDef.ui?.helpText || '';
          wrap.appendChild(input);
          wrap.appendChild(document.createTextNode('Enabled'));
          wrap.appendChild(text);
          return wrap;
        };

        const renderSelect = () => {
          const sel = document.createElement('select');
          const options = inputDef.options || [];
          if (!options.length) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = '(no options)';
            sel.appendChild(opt);
            sel.disabled = true;
          } else {
            const emptyOpt = document.createElement('option');
            emptyOpt.value = '';
            emptyOpt.textContent = '(choose)';
            sel.appendChild(emptyOpt);

            for (const optValue of options) {
              const opt = document.createElement('option');
              opt.value = String(optValue);
              opt.textContent = String(optValue);
              sel.appendChild(opt);
            }
          }
          if (current !== undefined && current !== null) sel.value = String(current);
          sel.addEventListener('change', () => {
            const v = sel.value;
            state.inputs[id] = v === '' ? undefined : v;
          });
          return sel;
        };

        const renderJson = () => {
          const ta = document.createElement('textarea');
          ta.placeholder = placeholder || '{"key":"value"}';
          if (current !== undefined) {
            ta.value = typeof current === 'string' ? current : JSON.stringify(current, null, 2);
          }
          ta.addEventListener('input', () => { state.inputs[id] = ta.value; });
          return ta;
        };

        const renderMedia = (kind) => {
          const accept = inputDef.ui?.accept || (inputDef.constraints?.mimeTypes ? inputDef.constraints.mimeTypes.join(',') : '');
          const minItems = Number.isFinite(inputDef.constraints?.minItems) ? inputDef.constraints.minItems : 0;
          const maxItems = Number.isFinite(inputDef.constraints?.maxItems) ? inputDef.constraints.maxItems : 10;
          const isMultiple =
            (typeof inputDef.constraints?.maxItems === 'number' && inputDef.constraints.maxItems > 1) ||
            (typeof inputDef.constraints?.minItems === 'number' && inputDef.constraints.minItems > 1);

          // Single media input (existing behavior)
          if (!isMultiple) {
            const wrap = document.createElement('div');
            wrap.className = 'row';

            const urlField = document.createElement('div');
            const urlInput = document.createElement('input');
            urlInput.type = 'text';
            urlInput.placeholder = 'Paste a URL (or use file upload)';
            if (typeof current === 'string' && !current.startsWith('data:')) urlInput.value = current;
            urlInput.addEventListener('input', () => {
              const v = urlInput.value.trim();
              state.inputs[id] = v.length ? v : undefined;
            });
            urlField.appendChild(urlInput);

            const fileField = document.createElement('div');
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            if (accept) fileInput.accept = accept;
            fileInput.addEventListener('change', async () => {
              const file = fileInput.files && fileInput.files[0];
              if (!file) return;
              try {
                const dataUrl = await readFileAsDataUrl(file);
                state.inputs[id] = dataUrl;
                urlInput.value = '';
                showStatus('success', `${kind} loaded (${file.name})`);
              } catch (e) {
                showStatus('error', e.message || 'File read failed');
              }
            });
            fileField.appendChild(fileInput);

            wrap.appendChild(urlField);
            wrap.appendChild(fileField);
            return wrap;
          }

          // Multiple media input (array)
          const container = document.createElement('div');

          const items = Array.isArray(current) ? current.slice() : [];
          while (items.length < minItems) items.push('');
          state.inputs[id] = items;

          const list = document.createElement('div');

          const renderItems = () => {
            list.innerHTML = '';
            const arr = Array.isArray(state.inputs[id]) ? state.inputs[id] : [];

            arr.forEach((val, idx) => {
              const row = document.createElement('div');
              row.className = 'row';
              row.style.marginTop = '8px';

              const urlInput = document.createElement('input');
              urlInput.type = 'text';
              urlInput.placeholder = `URL for item #${idx + 1}`;
              if (typeof val === 'string' && val && !val.startsWith('data:')) urlInput.value = val;
              urlInput.addEventListener('input', () => {
                const v = urlInput.value.trim();
                const next = Array.isArray(state.inputs[id]) ? state.inputs[id].slice() : [];
                next[idx] = v;
                state.inputs[id] = next;
              });

              const fileInput = document.createElement('input');
              fileInput.type = 'file';
              if (accept) fileInput.accept = accept;
              fileInput.addEventListener('change', async () => {
                const file = fileInput.files && fileInput.files[0];
                if (!file) return;
                try {
                  const dataUrl = await readFileAsDataUrl(file);
                  const next = Array.isArray(state.inputs[id]) ? state.inputs[id].slice() : [];
                  next[idx] = dataUrl;
                  state.inputs[id] = next;
                  urlInput.value = '';
                  showStatus('success', `${kind} loaded (${file.name})`);
                } catch (e) {
                  showStatus('error', e.message || 'File read failed');
                }
              });

              const removeBtn = document.createElement('button');
              removeBtn.className = 'btn';
              removeBtn.textContent = 'Remove';
              removeBtn.addEventListener('click', () => {
                const next = Array.isArray(state.inputs[id]) ? state.inputs[id].slice() : [];
                next.splice(idx, 1);
                while (next.length < minItems) next.push('');
                state.inputs[id] = next;
                renderItems();
              });

              row.appendChild(urlInput);
              row.appendChild(fileInput);
              row.appendChild(removeBtn);
              list.appendChild(row);
            });

            const addBtn = document.createElement('button');
            addBtn.className = 'btn';
            addBtn.textContent = `Add ${kind}`;
            addBtn.disabled = arr.length >= maxItems;
            addBtn.addEventListener('click', () => {
              const next = Array.isArray(state.inputs[id]) ? state.inputs[id].slice() : [];
              next.push('');
              state.inputs[id] = next;
              renderItems();
            });
            list.appendChild(addBtn);
          };

          renderItems();
          container.appendChild(list);
          return container;
        };

        let control;
        if (type === 'text') control = renderTextInput();
        else if (type === 'chat') control = renderTextarea();
        else if (type === 'number') control = renderNumber();
        else if (type === 'select') control = renderSelect();
        else if (type === 'boolean') control = renderBoolean();
        else if (type === 'json') control = renderJson();
        else if (type === 'image') control = renderMedia('image');
        else if (type === 'video') control = renderMedia('video');
        else if (type === 'audio') control = renderMedia('audio');
        else if (type === 'image_pair') {
          const wrap = document.createElement('div');
          const left = document.createElement('input');
          left.type = 'file';
          left.accept = 'image/*';
          const right = document.createElement('input');
          right.type = 'file';
          right.accept = 'image/*';
          wrap.className = 'row';
          wrap.appendChild(left);
          wrap.appendChild(right);
          const updatePair = async () => {
            const a = left.files && left.files[0] ? await readFileAsDataUrl(left.files[0]) : undefined;
            const b = right.files && right.files[0] ? await readFileAsDataUrl(right.files[0]) : undefined;
            state.inputs[id] = [a, b].filter(Boolean);
          };
          left.addEventListener('change', () => updatePair().catch(e => showStatus('error', e.message)));
          right.addEventListener('change', () => updatePair().catch(e => showStatus('error', e.message)));
          control = wrap;
        } else {
          const unknown = document.createElement('textarea');
          unknown.placeholder = `Unsupported input type '${type}' in UI; edit raw JSON here`;
          if (current !== undefined) unknown.value = typeof current === 'string' ? current : JSON.stringify(current, null, 2);
          unknown.addEventListener('input', () => { state.inputs[id] = unknown.value; });
          control = unknown;
        }

        card.appendChild(control);
        if (help) {
          const hint = document.createElement('div');
          hint.className = 'hint';
          hint.textContent = help;
          card.appendChild(hint);
        }
        el.inputsBox.appendChild(card);
      }
    }

    async function refreshApps() {
      showStatus(null, null);
      stopPolling();
      try {
        const res = await api('https://aitopia.ai/api/apps');
        state.apps = res.apps || [];
        renderAppsList();
      } catch (e) {
        showStatus('error', e.message || 'Failed to load apps');
      }
    }

    async function selectApp(appId) {
      stopPolling();
      el.resultBox.innerHTML = '';
      showStatus(null, null);
      state.selectedAppId = appId;
      renderAppsList();
      el.runBtn.disabled = true;

      try {
        const res = await api(`https://aitopia.ai/api/apps/${appId}`);
        state.definition = res.currentVersion?.definition || null;
        el.detailTitle.textContent = res.app?.name ? `Run: ${res.app.name}` : `Run: ${appId}`;
        if (!state.definition) {
          showStatus('error', 'No current definition found for this app');
          el.inputsBox.innerHTML = '';
          return;
        }
        setDefaultInputs(state.definition);
        renderInputs(state.definition);
        el.runBtn.disabled = false;
      } catch (e) {
        showStatus('error', e.message || 'Failed to load app');
      }
    }

    function buildRunPayload(definition) {
      const payload = {};
      for (const inputDef of (definition.inputs || [])) {
        const id = inputDef.id;
        const type = inputDef.type;
        const required = inputDef.required === true;
        let v = state.inputs[id];

        if (type === 'json') {
          if (typeof v === 'string' && v.trim().length > 0) {
            try { v = JSON.parse(v); } catch { throw new Error(`Invalid JSON for input '${id}'`); }
          } else if (typeof v === 'string') {
            v = undefined;
          }
        }

        if (Array.isArray(v)) {
          const cleaned = v.filter(x => typeof x === 'string' ? x.trim().length > 0 : x !== undefined && x !== null);
          if (required && cleaned.length === 0) {
            throw new Error(`Missing required input '${id}'`);
          }
          if (cleaned.length > 0) payload[id] = cleaned;
          continue;
        }

        if (required && (v === undefined || v === null || (typeof v === 'string' && v.trim() === ''))) {
          throw new Error(`Missing required input '${id}'`);
        }
        if (v !== undefined) payload[id] = v;
      }
      return payload;
    }

    async function pollJob(jobId) {
      el.stopBtn.disabled = false;
      stopPolling();
      state.polling = {
        jobId,
        startedAt: Date.now(),
        timer: setInterval(async () => {
          try {
            const job = await api(`/jobs/${jobId}`);
            const status = job.status || job.stats || job.state || 'unknown';
            showStatus('success', `Job ${jobId} · ${status} · progress ${job.progress ?? '—'}`);
            if (status === 'completed' || status === 'failed' || status === 'cancelled') {
              stopPolling();
              renderResult(job.status === 'completed' ? { status: 'completed', output: job.output ?? job.result ?? job, normalizedOutput: null } : job);
            }
          } catch (e) {
            stopPolling();
            showStatus('error', e.message || 'Job poll failed');
          }
        }, 750),
      };
    }

    async function runSelected() {
      if (!state.selectedAppId || !state.definition) return;
      stopPolling();
      el.resultBox.innerHTML = '';
      showStatus(null, null);

      let input;
      try {
        input = buildRunPayload(state.definition);
      } catch (e) {
        showStatus('error', e.message || 'Invalid input');
        return;
      }

      const asyncMode = el.asyncMode.value;
      const body = { input };
      if (asyncMode === 'true') body.async = true;
      if (asyncMode === 'false') body.async = false;

      try {
        const res = await fetch(`${API_BASE}/api/apps/${state.selectedAppId}/run`, {
          method: 'POST',
          headers: getHeaders({ 'Idempotency-Key': `appcore-ui-${uuid()}` }),
          body: JSON.stringify(body),
        });
        const text = await res.text();
        let json;
        try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }

        if (res.status === 202 && json && json.jobId) {
          showStatus('success', `Accepted · jobId=${json.jobId}`);
          renderResult(json);
          await pollJob(json.jobId);
          return;
        }

        if (!res.ok) {
          const msg = json?.error?.message || json?.error || `HTTP ${res.status}`;
          showStatus('error', msg);
          renderResult(json);
          return;
        }

        showStatus('success', `OK · ${json.status || 'success'}`);
        renderResult(json);
      } catch (e) {
        showStatus('error', e.message || 'Run failed');
      }
    }

    el.refreshBtn.addEventListener('click', refreshApps);
    el.runBtn.addEventListener('click', runSelected);
    el.stopBtn.addEventListener('click', () => {
      stopPolling();
      showStatus('success', 'Polling stopped.');
    });

    // Initial load (optional deep link: ?appId=...)
    (async () => {
      await refreshApps();
      const appId = new URLSearchParams(window.location.search).get('appId');
      if (appId) {
        const found = state.apps.find(a => a.id === appId);
        if (found) {
          await selectApp(appId);
        } else {
          showStatus('error', `App not found: ${appId}`);
        }
      }
    })();