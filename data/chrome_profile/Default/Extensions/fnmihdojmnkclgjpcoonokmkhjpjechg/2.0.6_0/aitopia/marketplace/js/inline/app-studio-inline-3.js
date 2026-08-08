const API_BASE = window.__AITOPIA_DOMAIN__ || 'https://aitopia.ai';

	    const el = {
	      tenantId: document.getElementById('tenantId'),
	      userId: document.getElementById('userId'),
	      userTier: document.getElementById('userTier'),
	      defaultVisibility: document.getElementById('defaultVisibility'),
	      refreshBtn: document.getElementById('refreshBtn'),
	      createBtn: document.getElementById('createBtn'),
	      cloneBtn: document.getElementById('cloneBtn'),
	      appsList: document.getElementById('appsList'),
	      appsMeta: document.getElementById('appsMeta'),
	      detailTitle: document.getElementById('detailTitle'),
	      saveBtn: document.getElementById('saveBtn'),
	      previewBtn: document.getElementById('previewBtn'),
	      runBtn: document.getElementById('runBtn'),
	      shareBtn: document.getElementById('shareBtn'),
	      publishBtn: document.getElementById('publishBtn'),
	      statusBox: document.getElementById('statusBox'),
	      tabBuild: document.getElementById('tabBuild'),
	      tabRun: document.getElementById('tabRun'),
	      tabBuildPanel: document.getElementById('tabBuildPanel'),
	      tabRunPanel: document.getElementById('tabRunPanel'),
	      cloneDialog: document.getElementById('cloneDialog'),
	      cloneCloseBtn: document.getElementById('cloneCloseBtn'),
	      cloneCreateBtn: document.getElementById('cloneCreateBtn'),
	      cloneAgentId: document.getElementById('cloneAgentId'),
	      cloneMode: document.getElementById('cloneMode'),
	      cloneVisibility: document.getElementById('cloneVisibility'),
	      cloneName: document.getElementById('cloneName'),
	      agentsDatalist: document.getElementById('agentsDatalist'),
	      previewDialog: document.getElementById('previewDialog'),
	      previewCloseBtn: document.getElementById('previewCloseBtn'),
	      previewCopyBtn: document.getElementById('previewCopyBtn'),
	      previewPre: document.getElementById('previewPre'),
	    };

	    const state = {
	      apps: [],
	      selectedAppId: null,
	      app: null,
	      currentVersion: null,
	      definition: null,
	      transforms: [],
	      capabilities: [],
	      modelsByCapability: new Map(),
	      modelSchemasByKey: new Map(),
	      modelSchemasLoading: new Set(),
	      modelSchemasErrors: new Map(),
	      agents: [],
	      agentCardsById: new Map(),
	      agentCardsLoading: new Set(),
	      agentCardsErrors: new Map(),
	      runInputs: {},
	      runResult: null,
	      pollTimer: null,
	      activeTab: 'build',
	      runAsyncMode: 'auto', // auto | true | false
	    };

    function escapeHtml(text) {
      return String(text)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
    }

    function showStatus(kind, message, details) {
      if (!kind || !message) {
        el.statusBox.innerHTML = '';
        return;
      }
      const extra = details ? `<pre>${escapeHtml(typeof details === 'string' ? details : JSON.stringify(details, null, 2))}</pre>` : '';
      el.statusBox.innerHTML = `<div class="status ${kind}">${escapeHtml(message)}${extra}</div>`;
    }

    function getHeaders() {
      const h = { 'Content-Type': 'application/json' };
      const tenantId = el.tenantId.value.trim() || 'public';
      h['X-Tenant-Id'] = tenantId;
      const userId = el.userId.value.trim();
      if (userId) h['X-User-Id'] = userId;
      const userTier = el.userTier.value;
      if (userTier) h['X-User-Tier'] = userTier;
      return h;
    }

	    async function api(path, opts = {}) {
	      const res = await fetch(API_BASE + path, {
	        method: opts.method || 'GET',
	        headers: { ...getHeaders(), ...(opts.headers || {}) },
	        body: opts.body ? JSON.stringify(opts.body) : undefined,
	      });

      const text = await res.text();
      let json = null;
      try { json = text ? JSON.parse(text) : null; } catch { /* ignore */ }

      if (!res.ok) {
        const err = (json && (json.error?.message || json.error)) || res.statusText || 'Request failed';
        const details = json?.error?.details || json || text;
        const error = new Error(err);
        error.details = details;
        error.status = res.status;
        throw error;
      }
	
	      return json;
	    }

	    function schemaRequiredList(schema) {
	      return Array.isArray(schema?.required) ? schema.required : [];
	    }

	    function schemaProperties(schema) {
	      return schema?.properties && typeof schema.properties === 'object' ? schema.properties : {};
	    }

	    function describeSchemaProp(prop) {
	      if (!prop || typeof prop !== 'object') return { type: 'unknown', description: '' };
	      // Normalized model schema (src/models/types.ts)
	      if (typeof prop.type === 'string') {
	        const fmt = prop.format ? `/${prop.format}` : '';
	        const title = prop.title && prop.title !== prop.description ? prop.title : '';
	        const desc = prop.description || '';
	        return { type: `${prop.type}${fmt}`, description: title ? `${title}${desc ? ` — ${desc}` : ''}` : desc };
	      }
	      // JSON schema-ish
	      const t = prop.type ? String(prop.type) : (prop.format ? `string/${prop.format}` : 'unknown');
	      const desc = prop.description ? String(prop.description) : '';
	      return { type: t, description: desc };
	    }

	    function renderSchemaSummary(schema, opts = {}) {
	      const maxFields = typeof opts.maxFields === 'number' ? opts.maxFields : 40;
	      const properties = schemaProperties(schema);
	      const required = new Set(schemaRequiredList(schema));

	      const keys = Object.keys(properties);
	      if (!keys.length) return `<div class="hint">No schema fields available.</div>`;

	      const shown = keys.slice(0, maxFields);
	      const requiredKeys = shown.filter(k => required.has(k));
	      const requiredHint = requiredKeys.length
	        ? `<div class="hint">Required: ${requiredKeys.map(k => `<code>${escapeHtml(k)}</code>`).join(', ')}</div>`
	        : `<div class="hint">Required: none</div>`;

	      const rows = shown.map((key) => {
	        const prop = properties[key];
	        const d = describeSchemaProp(prop);
	        const req = required.has(key) ? `<span class="badge req">required</span>` : `<span class="badge">optional</span>`;
	        const desc = d.description ? ` — ${escapeHtml(d.description)}` : '';
	        return `<div style="display:flex; gap:8px; align-items:baseline; flex-wrap:wrap;">
	          <code>${escapeHtml(key)}</code>
	          ${req}
	          <span class="hint">${escapeHtml(d.type)}${desc}</span>
	        </div>`;
	      }).join('');

	      const more = keys.length > maxFields ? `<div class="hint" style="margin-top:8px;">+ ${keys.length - maxFields} more fields not shown</div>` : '';

	      return `${requiredHint}<div style="display:flex; flex-direction:column; gap:6px; margin-top:10px;">${rows}</div>${more}`;
	    }

	    function modelSchemaKey(provider, modelId) {
	      return `${provider}::${modelId}`;
	    }

	    function buildModelSchemaPath(provider, modelId) {
	      const parts = String(modelId || '').split('/').filter(Boolean);
	      if (parts.length === 2) {
	        return `https://aitopia.ai/api/models/${encodeURIComponent(provider)}/${encodeURIComponent(parts[0])}/${encodeURIComponent(parts[1])}/schema`;
	      }
	      if (parts.length === 1) {
	        return `https://aitopia.ai/api/models/${encodeURIComponent(provider)}/${encodeURIComponent(modelId)}/schema`;
	      }
	      return null;
	    }

	    async function ensureAgentCard(agentId) {
	      const id = String(agentId || '').trim();
	      if (!id) return;
	      if (state.agentCardsById.has(id)) return;
	      if (state.agentCardsLoading.has(id)) return;
	      state.agentCardsLoading.add(id);
	      try {
	        const agent = await api(`https://aitopia.ai/api/agents/${encodeURIComponent(id)}`);
	        state.agentCardsById.set(id, agent);
	        state.agentCardsErrors.delete(id);
	      } catch (err) {
	        state.agentCardsErrors.set(id, err?.message || String(err));
	      } finally {
	        state.agentCardsLoading.delete(id);
	        if (state.activeTab === 'build') renderBuildTab();
	      }
	    }

	    async function ensureModelSchema(provider, modelId) {
	      const p = String(provider || '').trim();
	      const id = String(modelId || '').trim();
	      if (!p || !id) return;

	      const key = modelSchemaKey(p, id);
	      if (state.modelSchemasByKey.has(key)) return;
	      if (state.modelSchemasLoading.has(key)) return;

	      const path = buildModelSchemaPath(p, id);
	      if (!path) {
	        state.modelSchemasErrors.set(key, 'Unsupported modelId format (expected owner/name or single-segment id)');
	        return;
	      }

	      state.modelSchemasLoading.add(key);
	      try {
	        const schema = await api(path);
	        state.modelSchemasByKey.set(key, schema);
	        state.modelSchemasErrors.delete(key);
	      } catch (err) {
	        state.modelSchemasErrors.set(key, err?.message || String(err));
	      } finally {
	        state.modelSchemasLoading.delete(key);
	        if (state.activeTab === 'build') renderBuildTab();
	      }
	    }

	    function stopPolling() {
	      if (state.pollTimer) clearInterval(state.pollTimer);
	      state.pollTimer = null;
	    }

    function setActiveTab(tab) {
      state.activeTab = tab;
      el.tabBuild.classList.toggle('active', tab === 'build');
      el.tabRun.classList.toggle('active', tab === 'run');
      el.tabBuildPanel.style.display = tab === 'build' ? '' : 'none';
      el.tabRunPanel.style.display = tab === 'run' ? '' : 'none';
    }

    function toIdentifier(name, fallbackPrefix) {
      const raw = String(name || '').trim();
      const snake = raw
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .toLowerCase()
        .replace(/^_+/, '')
        .replace(/_+$/, '');

      let out = snake;
      if (!out || !/^[a-z]/.test(out)) out = `${fallbackPrefix || 'input'}_${out || '1'}`.replace(/[^a-z0-9_]+/g, '_');
      out = out.slice(0, 64);
      return out;
    }

	    function uniqueId(base, existing) {
	      let id = base;
	      let i = 2;
	      while (existing.has(id)) {
	        id = `${base}_${i}`;
	        i++;
	      }
	      return id;
	    }

	    function parseCommaList(value, maxItems = 100) {
	      const parts = String(value || '')
	        .split(',')
	        .map(s => s.trim())
	        .filter(Boolean);
	      const seen = new Set();
	      const out = [];
	      for (const p of parts) {
	        const key = p.toLowerCase();
	        if (seen.has(key)) continue;
	        seen.add(key);
	        out.push(p);
	        if (out.length >= maxItems) break;
	      }
	      return out;
	    }

	    function ensureDefinitionLoaded() {
	      if (!state.definition) throw new Error('No app selected');
	    }

    function normalizeWorkflowMode(def) {
      const nodeCount = (def.workflow?.nodes || []).length;
      def.workflow.mode = nodeCount > 1 ? 'workflow' : 'single';
      def.workflow.entryNodeId = def.workflow.nodes?.[0]?.id;
      if (def.workflow.mode === 'workflow') {
        def.workflow.edges = def.workflow.nodes.slice(0, -1).map((n, idx) => ({ from: n.id, to: def.workflow.nodes[idx + 1].id }));
      } else {
        delete def.workflow.edges;
      }
    }

    function defaultOutput(def) {
      const nodes = def.workflow.nodes || [];
      if (!nodes.length) { def.outputs = []; return; }
      const last = nodes[nodes.length - 1];
      def.outputs = [{
        id: 'output',
        renderer: 'auto',
        from: { nodeId: last.id },
      }];
    }

    function inferInputFromJsonSchemaProperty(propName, propSchema) {
      const prop = propSchema || {};
      const description = String(prop.description || '').toLowerCase();
      const title = String(prop.title || '').toLowerCase();
      const key = String(propName || '').toLowerCase();
      const combined = `${key} ${title} ${description}`;

      const required = false;

      // enum -> select
      if (Array.isArray(prop.enum) && prop.enum.length) {
        return { type: 'select', required, options: prop.enum.slice(0, 200) };
      }

      // boolean/number
      if (prop.type === 'boolean') return { type: 'boolean', required };
      if (prop.type === 'number' || prop.type === 'integer') return { type: 'number', required };

      // array -> media/text array via constraints
      if (prop.type === 'array' && prop.items) {
        const inner = inferInputFromJsonSchemaProperty(propName, prop.items);
        const constraints = {};
        if (typeof prop.minItems === 'number') constraints.minItems = prop.minItems;
        if (typeof prop.maxItems === 'number') constraints.maxItems = prop.maxItems;
        return { ...inner, constraints };
      }

      // object -> json
      if (prop.type === 'object') return { type: 'json', required };

      // string heuristics
      const format = String(prop.format || '').toLowerCase();
      const looksLikeUrl = format === 'uri' || format === 'url' || combined.includes('http') || combined.includes('url');
      const looksLikeImage = combined.includes('image') || combined.includes('photo') || combined.includes('picture') || combined.includes('portrait');
      const looksLikeVideo = combined.includes('video');
      const looksLikeAudio = combined.includes('audio') || combined.includes('voice') || combined.includes('speech');
      const looksLikeChat = combined.includes('chat') || combined.includes('conversation');

      if (looksLikeUrl && looksLikeVideo) return { type: 'video', required };
      if (looksLikeUrl && looksLikeAudio) return { type: 'audio', required };
      if (looksLikeUrl && looksLikeImage) return { type: 'image', required };
      if (looksLikeVideo) return { type: 'video', required };
      if (looksLikeAudio) return { type: 'audio', required };
      if (looksLikeImage) return { type: 'image', required };
      if (looksLikeChat) return { type: 'chat', required };
      return { type: 'text', required };
    }

    function renderAppsList() {
      el.appsMeta.textContent = String(state.apps.length);
      el.appsList.innerHTML = '';
      if (!state.apps.length) {
        el.appsList.innerHTML = `<div class="hint" style="padding:12px 14px;">No apps yet.</div>`;
        return;
      }
      for (const app of state.apps) {
        const div = document.createElement('div');
        div.className = 'app-item' + (state.selectedAppId === app.id ? ' active' : '');
        div.innerHTML = `
          <div class="name">${escapeHtml(app.name || app.id)}</div>
          <div class="meta">${escapeHtml(app.visibility || 'private')} • v${escapeHtml(app.currentVersion || '')} • ${escapeHtml(app.id)}</div>
        `;
        div.addEventListener('click', () => selectApp(app.id));
        el.appsList.appendChild(div);
      }
    }

    function renderBuildTab() {
      el.tabBuildPanel.innerHTML = '';
      if (!state.definition) {
        el.tabBuildPanel.innerHTML = `<div class="hint">Select an app to edit, or create one.</div>`;
        return;
      }

      const def = state.definition;
      normalizeWorkflowMode(def);
      if (!def.outputs || def.outputs.length === 0) defaultOutput(def);

      // App Info
      const info = document.createElement('div');
      info.className = 'section';
      info.innerHTML = `<h3>App Info <span class="badge">format v${escapeHtml(def.formatVersion || 1)}</span></h3>`;

      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `
        <div class="field">
          <label>Name</label>
          <input id="appNameInput" value="${escapeHtml(def.name || '')}" placeholder="My App" />
        </div>
        <div class="field">
          <label>UI Mode</label>
          <select id="uiModeSelect">
            <option value="form">form</option>
            <option value="chat">chat</option>
            <option value="hybrid">hybrid</option>
          </select>
        </div>
      `;
      info.appendChild(row);

	      const row2 = document.createElement('div');
	      row2.className = 'row';
	      row2.style.marginTop = '10px';
	      row2.innerHTML = `
	        <div class="field">
	          <label>Description</label>
	          <input id="appDescInput" value="${escapeHtml(def.description || '')}" placeholder="What does this app do?" />
	        </div>
	        <div class="field">
	          <label>Visibility</label>
	          <select id="appVisibilitySelect">
	            <option value="private">private</option>
	            <option value="unlisted">unlisted</option>
	            <option value="public">public</option>
	          </select>
	        </div>
	      `;
	      info.appendChild(row2);

	      const row3 = document.createElement('div');
	      row3.className = 'row';
	      row3.style.marginTop = '10px';
	      row3.innerHTML = `
	        <div class="field">
	          <label>Tags (comma-separated)</label>
	          <input id="appTagsInput" value="${escapeHtml((def.meta?.tags || []).join(', '))}" placeholder="e.g. image, ecommerce, fashion" />
	          <div class="hint">Optional metadata for organization/discovery.</div>
	        </div>
	        <div class="field">
	          <label>Features (comma-separated)</label>
	          <input id="appFeaturesInput" value="${escapeHtml((def.meta?.features || []).join(', '))}" placeholder="e.g. style, ratio, seed, upscale" />
	          <div class="hint">Optional “feature names” for your app UI/marketing.</div>
	        </div>
	      `;
	      info.appendChild(row3);

	      const uiMode = def.ui?.mode || 'form';
	      const uiModeSelect = row.querySelector('#uiModeSelect');
	      uiModeSelect.value = uiMode;
	      uiModeSelect.addEventListener('change', () => {
	        def.ui = def.ui || {};
	        def.ui.mode = uiModeSelect.value;
	      });

      const visSelect = row2.querySelector('#appVisibilitySelect');
      visSelect.value = def.visibility || 'private';
      visSelect.addEventListener('change', () => {
        def.visibility = visSelect.value;
      });

	      const nameInput = row.querySelector('#appNameInput');
	      nameInput.addEventListener('input', () => { def.name = nameInput.value; });
	      const descInput = row2.querySelector('#appDescInput');
	      descInput.addEventListener('input', () => { def.description = descInput.value; });

	      const tagsInput = row3.querySelector('#appTagsInput');
	      tagsInput.addEventListener('input', () => {
	        const tags = parseCommaList(tagsInput.value, 100);
	        if (!tags.length && !def.meta?.features?.length) {
	          delete def.meta;
	          return;
	        }
	        def.meta = def.meta || {};
	        if (tags.length) def.meta.tags = tags;
	        else delete def.meta.tags;
	        if (def.meta && !def.meta.tags?.length && !def.meta.features?.length) delete def.meta;
	      });

	      const featuresInput = row3.querySelector('#appFeaturesInput');
	      featuresInput.addEventListener('input', () => {
	        const features = parseCommaList(featuresInput.value, 200);
	        if (!features.length && !def.meta?.tags?.length) {
	          delete def.meta;
	          return;
	        }
	        def.meta = def.meta || {};
	        if (features.length) def.meta.features = features;
	        else delete def.meta.features;
	        if (def.meta && !def.meta.tags?.length && !def.meta.features?.length) delete def.meta;
	      });

	      el.tabBuildPanel.appendChild(info);

      // Inputs
      const inputsSection = document.createElement('div');
      inputsSection.className = 'section';
      const addRow = document.createElement('div');
      addRow.className = 'row';
      addRow.innerHTML = `
        <div class="field">
          <label>New Input ID</label>
          <input id="newInputId" placeholder="e.g. prompt" />
        </div>
        <div class="field">
          <label>Type</label>
          <select id="newInputType">
            <option value="text">text</option>
            <option value="chat">chat</option>
            <option value="image">image</option>
            <option value="video">video</option>
            <option value="audio">audio</option>
            <option value="number">number</option>
            <option value="boolean">boolean</option>
            <option value="select">select</option>
            <option value="json">json</option>
            <option value="image_pair">image_pair</option>
          </select>
        </div>
      `;

      inputsSection.innerHTML = `<h3>Inputs <button id="addInputBtn" class="btn mini">Add</button></h3>`;
      inputsSection.appendChild(addRow);
      const inputsHint = document.createElement('div');
      inputsHint.className = 'hint';
      inputsHint.textContent = 'For media arrays, enable “Allow multiple” and set min/max.';
      inputsSection.appendChild(inputsHint);

      const inputsList = document.createElement('div');
      inputsSection.appendChild(inputsList);

      function renderInputsList() {
        inputsList.innerHTML = '';
        const inputs = def.inputs || [];
        if (!inputs.length) {
          inputsList.innerHTML = `<div class="hint">No inputs yet.</div>`;
          return;
        }

        for (const inputDef of inputs) {
          const card = document.createElement('div');
          card.className = 'card';
          const label = inputDef.ui?.label || inputDef.id;
          const required = inputDef.required === true;
          card.innerHTML = `
            <div class="card-header">
              <div class="title">
                <strong>${escapeHtml(label)}</strong>
                <span class="badge">${escapeHtml(inputDef.type)}</span>
                ${required ? `<span class="badge req">required</span>` : ``}
              </div>
              <div class="card-actions">
                <button class="btn mini danger" data-del-input="${escapeHtml(inputDef.id)}">Delete</button>
              </div>
            </div>
          `;

          const config = document.createElement('div');
          config.className = 'row';
          config.innerHTML = `
            <div class="field">
              <label>ID</label>
              <input value="${escapeHtml(inputDef.id)}" data-input-id="${escapeHtml(inputDef.id)}" data-field="id" />
            </div>
            <div class="field">
              <label>Label</label>
              <input value="${escapeHtml(inputDef.ui?.label || '')}" data-input-id="${escapeHtml(inputDef.id)}" data-field="label" placeholder="Optional label" />
            </div>
          `;
          card.appendChild(config);

          const config2 = document.createElement('div');
          config2.className = 'row';
          config2.style.marginTop = '10px';
          config2.innerHTML = `
            <div class="field">
              <label>Placeholder</label>
              <input value="${escapeHtml(inputDef.ui?.placeholder || '')}" data-input-id="${escapeHtml(inputDef.id)}" data-field="placeholder" placeholder="Optional placeholder" />
            </div>
            <div class="field">
              <label>Help</label>
              <input value="${escapeHtml(inputDef.ui?.helpText || '')}" data-input-id="${escapeHtml(inputDef.id)}" data-field="helpText" placeholder="Optional help text" />
            </div>
          `;
          card.appendChild(config2);

          const reqRow = document.createElement('div');
          reqRow.className = 'row';
          reqRow.style.marginTop = '10px';
          reqRow.innerHTML = `
            <div class="field">
              <label>Required</label>
              <select data-input-id="${escapeHtml(inputDef.id)}" data-field="required">
                <option value="false">false</option>
                <option value="true">true</option>
              </select>
            </div>
            <div class="field">
              <label>Group (optional)</label>
              <input value="${escapeHtml(inputDef.ui?.group || '')}" data-input-id="${escapeHtml(inputDef.id)}" data-field="group" placeholder="e.g. Advanced" />
            </div>
          `;
          card.appendChild(reqRow);

          const requiredSel = reqRow.querySelector('select');
          requiredSel.value = inputDef.required ? 'true' : 'false';

          if (inputDef.type === 'select') {
            const optRow = document.createElement('div');
            optRow.style.marginTop = '10px';
            optRow.className = 'field';
            optRow.innerHTML = `
              <label>Options (comma separated)</label>
              <input value="${escapeHtml((inputDef.options || []).join(', '))}" data-input-id="${escapeHtml(inputDef.id)}" data-field="options" placeholder="a, b, c" />
            `;
            card.appendChild(optRow);
          }

          if (inputDef.type === 'image' || inputDef.type === 'video' || inputDef.type === 'audio') {
            const mediaRow = document.createElement('div');
            mediaRow.className = 'row';
            mediaRow.style.marginTop = '10px';

            const constraints = inputDef.constraints || {};
            const allowMultiple = (typeof constraints.maxItems === 'number' && constraints.maxItems > 1) || (typeof constraints.minItems === 'number' && constraints.minItems > 1);

            mediaRow.innerHTML = `
              <div class="field">
                <label>Accept (optional)</label>
                <input value="${escapeHtml(inputDef.ui?.accept || '')}" data-input-id="${escapeHtml(inputDef.id)}" data-field="accept" placeholder="image/*,video/*" />
              </div>
              <div class="field">
                <label>Allow multiple</label>
                <select data-input-id="${escapeHtml(inputDef.id)}" data-field="allowMultiple">
                  <option value="false">false</option>
                  <option value="true">true</option>
                </select>
              </div>
            `;
            card.appendChild(mediaRow);

            const allowSel = mediaRow.querySelector('select');
            allowSel.value = allowMultiple ? 'true' : 'false';

            const multiCfg = document.createElement('div');
            multiCfg.className = 'row';
            multiCfg.style.marginTop = '10px';
            multiCfg.style.display = allowMultiple ? '' : 'none';
            multiCfg.innerHTML = `
              <div class="field">
                <label>Min items</label>
                <input type="number" min="0" value="${escapeHtml(String(constraints.minItems ?? 0))}" data-input-id="${escapeHtml(inputDef.id)}" data-field="minItems" />
              </div>
              <div class="field">
                <label>Max items</label>
                <input type="number" min="1" value="${escapeHtml(String(constraints.maxItems ?? 5))}" data-input-id="${escapeHtml(inputDef.id)}" data-field="maxItems" />
              </div>
            `;
            card.appendChild(multiCfg);

            allowSel.addEventListener('change', () => {
              const on = allowSel.value === 'true';
              inputDef.constraints = inputDef.constraints || {};
              if (on) {
                inputDef.constraints.minItems = inputDef.constraints.minItems ?? 1;
                inputDef.constraints.maxItems = inputDef.constraints.maxItems ?? 5;
              } else {
                delete inputDef.constraints.minItems;
                delete inputDef.constraints.maxItems;
              }
              renderBuildTab();
            });
          }

          inputsList.appendChild(card);
        }

        // Wire deletes + inline edits
        inputsList.querySelectorAll('[data-del-input]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-del-input');
            def.inputs = (def.inputs || []).filter(i => i.id !== id);
            // Remove mappings that reference deleted input
            for (const node of def.workflow.nodes || []) {
              for (const [k, ref] of Object.entries(node.inputMapping || {})) {
                if (ref && ref.from === 'input' && ref.inputId === id) delete node.inputMapping[k];
              }
            }
            renderBuildTab();
          });
        });

        inputsList.querySelectorAll('[data-input-id][data-field]').forEach((control) => {
          const inputId = control.getAttribute('data-input-id');
          const field = control.getAttribute('data-field');
          const inputDef = (def.inputs || []).find(i => i.id === inputId);
          if (!inputDef) return;

          control.addEventListener('input', () => {
            if (field === 'id') {
              // ID rename requires updating mappings
              const next = toIdentifier(control.value, 'input');
              if (next === inputDef.id) return;
              const taken = new Set((def.inputs || []).map(i => i.id));
              taken.delete(inputDef.id);
              const finalId = uniqueId(next, taken);

              const old = inputDef.id;
              inputDef.id = finalId;
              for (const node of def.workflow.nodes || []) {
                for (const ref of Object.values(node.inputMapping || {})) {
                  if (ref && ref.from === 'input' && ref.inputId === old) ref.inputId = finalId;
                }
              }
              renderBuildTab();
              return;
            }

            if (field === 'label') {
              inputDef.ui = inputDef.ui || {};
              inputDef.ui.label = control.value || undefined;
              return;
            }
            if (field === 'placeholder') {
              inputDef.ui = inputDef.ui || {};
              inputDef.ui.placeholder = control.value || undefined;
              return;
            }
            if (field === 'helpText') {
              inputDef.ui = inputDef.ui || {};
              inputDef.ui.helpText = control.value || undefined;
              return;
            }
            if (field === 'group') {
              inputDef.ui = inputDef.ui || {};
              inputDef.ui.group = control.value || undefined;
              return;
            }
            if (field === 'accept') {
              inputDef.ui = inputDef.ui || {};
              inputDef.ui.accept = control.value || undefined;
              return;
            }
            if (field === 'options') {
              inputDef.options = control.value
                .split(',')
                .map(s => s.trim())
                .filter(Boolean)
                .slice(0, 200);
              return;
            }
            if (field === 'required') {
              inputDef.required = control.value === 'true';
              return;
            }
            if (field === 'minItems' || field === 'maxItems') {
              const n = Number(control.value);
              inputDef.constraints = inputDef.constraints || {};
              if (field === 'minItems') inputDef.constraints.minItems = Number.isFinite(n) ? n : undefined;
              if (field === 'maxItems') inputDef.constraints.maxItems = Number.isFinite(n) ? n : undefined;
              return;
            }
          });

          control.addEventListener('change', () => {
            if (field === 'required') {
              inputDef.required = control.value === 'true';
            }
          });
        });
      }

      function addInput() {
        const rawId = addRow.querySelector('#newInputId').value.trim();
        const type = addRow.querySelector('#newInputType').value;
        const base = toIdentifier(rawId || type, 'input');
        const taken = new Set((def.inputs || []).map(i => i.id));
        const id = uniqueId(base, taken);
        const inputDef = {
          id,
          type,
          required: false,
          ui: { label: rawId || id },
        };
        if (type === 'select') inputDef.options = [];
        def.inputs = def.inputs || [];
        def.inputs.push(inputDef);
        addRow.querySelector('#newInputId').value = '';
        renderInputsList();
      }

      inputsSection.querySelector('#addInputBtn').addEventListener('click', addInput);
      renderInputsList();
      el.tabBuildPanel.appendChild(inputsSection);

      // Steps
      const stepsSection = document.createElement('div');
      stepsSection.className = 'section';
      stepsSection.innerHTML = `<h3>Pipeline (Linear Steps)</h3>`;
      const stepsHint = document.createElement('div');
      stepsHint.className = 'hint';
      stepsHint.textContent = 'V1 supports sequential execution (Agent / Model / Transform). Use Transform “get” to extract nested outputs.';
      stepsSection.appendChild(stepsHint);

      const addStepRow = document.createElement('div');
      addStepRow.className = 'row';
      addStepRow.style.marginTop = '10px';
      addStepRow.innerHTML = `
        <div class="field">
          <label>Add Step</label>
          <select id="newStepType">
            <option value="agent" selected>Agent</option>
            <option value="model">Model</option>
            <option value="transform">Transform</option>
          </select>
        </div>
        <div class="field" style="display:flex; gap:10px; align-items:end;">
          <button id="addStepBtn" class="btn mini">Add Step</button>
          <div class="hint" style="margin:0;">Nodes: <span class="badge">${escapeHtml(String(def.workflow.nodes.length))}</span></div>
        </div>
      `;
      stepsSection.appendChild(addStepRow);

      const stepsList = document.createElement('div');
      stepsSection.appendChild(stepsList);

      function mappingEditor(node, nodeIndex) {
        const wrap = document.createElement('div');

        const passRow = document.createElement('div');
        passRow.className = 'row';
        passRow.style.marginTop = '8px';
        passRow.innerHTML = `
          <div class="field">
            <label>Mapping mode</label>
            <select>
              <option value="pass">Pass-through (send all app inputs)</option>
              <option value="map">Custom mapping</option>
            </select>
          </div>
          <div class="field">
            <label>Note</label>
            <div class="hint" style="margin-top:8px;">For node outputs, use <code>from: node</code> + a dot path (e.g. <code>output.0</code>).</div>
          </div>
        `;
        wrap.appendChild(passRow);

        const modeSel = passRow.querySelector('select');
        const hasMapping = node.inputMapping && Object.keys(node.inputMapping).length > 0;
        modeSel.value = hasMapping ? 'map' : 'pass';

        const editor = document.createElement('div');
        editor.style.marginTop = '10px';
        wrap.appendChild(editor);

        const inputs = def.inputs || [];
        const priorNodes = def.workflow.nodes.slice(0, nodeIndex);

        const renderRows = () => {
          editor.innerHTML = '';
          if (modeSel.value !== 'map') return;

          const addBtn = document.createElement('button');
          addBtn.className = 'btn mini';
          addBtn.textContent = 'Add mapping';
          addBtn.addEventListener('click', () => {
            node.inputMapping = node.inputMapping || {};
            const baseKey = 'param';
            const existingKeys = new Set(Object.keys(node.inputMapping));
            const key = uniqueId(baseKey, existingKeys);
            node.inputMapping[key] = { from: 'input', inputId: inputs[0]?.id || 'prompt' };
            renderBuildTab();
          });
          editor.appendChild(addBtn);

          const entries = Object.entries(node.inputMapping || {});
          if (!entries.length) {
            const h = document.createElement('div');
            h.className = 'hint';
            h.textContent = 'No mappings yet.';
            editor.appendChild(h);
          }

          for (const [mapKey, ref] of entries) {
            const row = document.createElement('div');
            row.className = 'mapping-row';

            const keyInput = document.createElement('input');
            keyInput.value = mapKey;
            keyInput.placeholder = 'parameter name';

            const fromSel = document.createElement('select');
            fromSel.innerHTML = `
              <option value="input">input</option>
              <option value="node">node</option>
              <option value="const">const</option>
            `;
            fromSel.value = ref?.from || 'input';

            const source = document.createElement('div');
            const pathBox = document.createElement('div');
            const removeBtn = document.createElement('button');
            removeBtn.className = 'btn danger';
            removeBtn.textContent = 'Remove';

            function renderSource() {
              source.innerHTML = '';
              pathBox.innerHTML = '';
              const from = fromSel.value;

              if (from === 'input') {
                const sel = document.createElement('select');
                for (const inp of inputs) {
                  const opt = document.createElement('option');
                  opt.value = inp.id;
                  opt.textContent = `${inp.id} (${inp.type})`;
                  sel.appendChild(opt);
                }
                sel.value = ref?.from === 'input' ? (ref.inputId || '') : (inputs[0]?.id || '');
                sel.addEventListener('change', () => {
                  node.inputMapping[mapKey] = { from: 'input', inputId: sel.value };
                });
                source.appendChild(sel);
                return;
              }

              if (from === 'node') {
                const sel = document.createElement('select');
                for (const n of priorNodes) {
                  const opt = document.createElement('option');
                  opt.value = n.id;
                  opt.textContent = n.id;
                  sel.appendChild(opt);
                }
                if (!priorNodes.length) {
                  const opt = document.createElement('option');
                  opt.value = '';
                  opt.textContent = '(no previous steps)';
                  sel.appendChild(opt);
                  sel.disabled = true;
                }
                sel.value = ref?.from === 'node' ? (ref.nodeId || '') : (priorNodes[priorNodes.length - 1]?.id || '');
                sel.addEventListener('change', () => {
                  node.inputMapping[mapKey] = { from: 'node', nodeId: sel.value, path: pathInput.value.trim() || undefined };
                });
                source.appendChild(sel);

                const pathInput = document.createElement('input');
                pathInput.placeholder = 'path (optional) e.g. output.url';
                pathInput.value = ref?.from === 'node' ? (ref.path || '') : '';
                pathInput.addEventListener('input', () => {
                  node.inputMapping[mapKey] = { from: 'node', nodeId: sel.value, path: pathInput.value.trim() || undefined };
                });
                pathBox.appendChild(pathInput);
                return;
              }

              // const
              const typeSel = document.createElement('select');
              typeSel.innerHTML = `
                <option value="string">string</option>
                <option value="number">number</option>
                <option value="boolean">boolean</option>
                <option value="json">json</option>
              `;

              const raw = ref?.from === 'const' ? ref.value : '';
              let guess = 'string';
              if (typeof raw === 'number') guess = 'number';
              else if (typeof raw === 'boolean') guess = 'boolean';
              else if (raw && typeof raw === 'object') guess = 'json';
              typeSel.value = guess;

              const valueBox = document.createElement('div');

              function renderConstValue() {
                valueBox.innerHTML = '';
                const t = typeSel.value;
                if (t === 'string') {
                  const inp = document.createElement('input');
                  inp.value = raw === undefined || raw === null ? '' : String(raw);
                  inp.placeholder = 'text';
                  inp.addEventListener('input', () => {
                    node.inputMapping[mapKey] = { from: 'const', value: inp.value };
                  });
                  valueBox.appendChild(inp);
                } else if (t === 'number') {
                  const inp = document.createElement('input');
                  inp.type = 'number';
                  inp.value = typeof raw === 'number' ? String(raw) : '';
                  inp.placeholder = '0';
                  inp.addEventListener('input', () => {
                    const v = inp.value.trim();
                    node.inputMapping[mapKey] = { from: 'const', value: v ? Number(v) : 0 };
                  });
                  valueBox.appendChild(inp);
                } else if (t === 'boolean') {
                  const sel = document.createElement('select');
                  sel.innerHTML = `<option value="true">true</option><option value="false">false</option>`;
                  sel.value = raw === false ? 'false' : 'true';
                  sel.addEventListener('change', () => {
                    node.inputMapping[mapKey] = { from: 'const', value: sel.value === 'true' };
                  });
                  valueBox.appendChild(sel);
                } else {
                  const ta = document.createElement('textarea');
                  ta.rows = 4;
                  ta.placeholder = '{"key":"value"}';
                  ta.value = (raw && typeof raw === 'object') ? JSON.stringify(raw, null, 2) : (typeof raw === 'string' ? raw : '');
                  ta.addEventListener('input', () => {
                    try {
                      const parsed = JSON.parse(ta.value);
                      node.inputMapping[mapKey] = { from: 'const', value: parsed };
                      ta.style.borderColor = '';
                    } catch {
                      ta.style.borderColor = 'rgba(239,68,68,0.6)';
                    }
                  });
                  valueBox.appendChild(ta);
                }
              }

              typeSel.addEventListener('change', () => {
                if (typeSel.value === 'string') node.inputMapping[mapKey] = { from: 'const', value: '' };
                if (typeSel.value === 'number') node.inputMapping[mapKey] = { from: 'const', value: 0 };
                if (typeSel.value === 'boolean') node.inputMapping[mapKey] = { from: 'const', value: true };
                if (typeSel.value === 'json') node.inputMapping[mapKey] = { from: 'const', value: {} };
                renderBuildTab();
              });

              source.appendChild(typeSel);
              source.appendChild(valueBox);
              renderConstValue();
            }

            fromSel.addEventListener('change', () => {
              const from = fromSel.value;
              if (from === 'input') node.inputMapping[mapKey] = { from: 'input', inputId: inputs[0]?.id || 'prompt' };
              if (from === 'node') node.inputMapping[mapKey] = { from: 'node', nodeId: priorNodes[priorNodes.length - 1]?.id || '', path: undefined };
              if (from === 'const') node.inputMapping[mapKey] = { from: 'const', value: '' };
              renderBuildTab();
            });

            keyInput.addEventListener('input', () => {
              const nextKey = keyInput.value.trim();
              if (!nextKey || nextKey === mapKey) return;
              const current = node.inputMapping[mapKey];
              delete node.inputMapping[mapKey];
              node.inputMapping[nextKey] = current;
              renderBuildTab();
            });

            removeBtn.addEventListener('click', () => {
              delete node.inputMapping[mapKey];
              renderBuildTab();
            });

            row.appendChild(keyInput);
            row.appendChild(fromSel);
            row.appendChild(source);
            row.appendChild(pathBox);
            row.appendChild(removeBtn);
            editor.appendChild(row);
            renderSource();
          }
        };

        modeSel.addEventListener('change', () => {
          if (modeSel.value === 'pass') node.inputMapping = {};
          renderBuildTab();
        });

        renderRows();
        return wrap;
      }

      function renderStepsList() {
        stepsList.innerHTML = '';
        const nodes = def.workflow.nodes || [];

        if (!nodes.length) {
          stepsList.innerHTML = `<div class="hint">No steps yet. Add an Agent / Model / Transform step.</div>`;
          return;
        }

        nodes.forEach((node, idx) => {
          const card = document.createElement('div');
          card.className = 'card';

          const title = node.type === 'agent'
            ? `Agent: ${node.agentId || ''}`
            : node.type === 'model'
              ? `Model: ${node.selection?.strategy === 'capability' ? (node.selection.capability || '') : (node.selection.modelId || '')}`
              : `Transform: ${node.transformId || ''}`;

          card.innerHTML = `
            <div class="card-header">
              <div class="title">
                <strong>${escapeHtml(node.id)}</strong>
                <span class="badge">${escapeHtml(node.type)}</span>
                <span class="badge">${escapeHtml(title || '')}</span>
              </div>
              <div class="card-actions">
                <button class="btn mini" data-move="up" data-node="${escapeHtml(node.id)}">↑</button>
                <button class="btn mini" data-move="down" data-node="${escapeHtml(node.id)}">↓</button>
                <button class="btn mini danger" data-del-node="${escapeHtml(node.id)}">Delete</button>
              </div>
            </div>
          `;

          // Basic config
          const cfg = document.createElement('div');
          cfg.className = 'row';
          cfg.innerHTML = `
            <div class="field">
              <label>Step ID</label>
              <input value="${escapeHtml(node.id)}" data-node-id="${escapeHtml(node.id)}" data-node-field="id" />
            </div>
            <div class="field">
              <label>Type</label>
              <input value="${escapeHtml(node.type)}" disabled />
            </div>
          `;
          card.appendChild(cfg);

          // Agent config
	          if (node.type === 'agent') {
	            const agentRow = document.createElement('div');
	            agentRow.className = 'row';
	            agentRow.style.marginTop = '10px';

            const agentOptions = state.agents || [];
            const agentSelect = document.createElement('select');
            for (const a of agentOptions) {
              const opt = document.createElement('option');
              opt.value = a.id;
              opt.textContent = `${a.id}${a.name ? ` — ${a.name}` : ''}`;
              agentSelect.appendChild(opt);
            }
            if (!agentOptions.length) {
              const opt = document.createElement('option');
              opt.value = '';
              opt.textContent = '(agents not loaded)';
              agentSelect.appendChild(opt);
              agentSelect.disabled = true;
            }
            agentSelect.value = node.agentId || agentOptions[0]?.id || '';
            agentSelect.addEventListener('change', () => {
              node.agentId = agentSelect.value;
              renderBuildTab();
            });

            agentRow.innerHTML = `
              <div class="field">
                <label>Agent</label>
              </div>
              <div class="field">
                <label>Task (optional)</label>
                <input value="${escapeHtml(node.task || '')}" data-node-id="${escapeHtml(node.id)}" data-node-field="task" placeholder="Optional instruction" />
              </div>
	            `;
	            agentRow.children[0].appendChild(agentSelect);
	            card.appendChild(agentRow);

	            const schemaDetails = document.createElement('details');
	            schemaDetails.style.marginTop = '10px';
	            schemaDetails.innerHTML = `<summary class="hint">Agent input schema</summary>`;
	            const schemaBody = document.createElement('div');
	            schemaBody.style.marginTop = '10px';

	            const agentId = node.agentId || agentOptions[0]?.id || '';
	            if (agentId) ensureAgentCard(agentId);
	            if (!agentId) {
	              schemaBody.innerHTML = `<div class="hint">Pick an agent to see its schema.</div>`;
	            } else if (state.agentCardsLoading.has(agentId)) {
	              schemaBody.innerHTML = `<div class="hint">Loading schema…</div>`;
	            } else if (state.agentCardsErrors.has(agentId)) {
	              schemaBody.innerHTML = `<div class="status error">${escapeHtml(state.agentCardsErrors.get(agentId))}</div>`;
	            } else {
	              const cardData = state.agentCardsById.get(agentId);
	              const schema = cardData?.inputSchema;
	              schemaBody.innerHTML = schema ? renderSchemaSummary(schema, { maxFields: 50 }) : `<div class="hint">No input schema available.</div>`;
	            }

	            schemaDetails.appendChild(schemaBody);
	            card.appendChild(schemaDetails);
	          }

          // Model config
          if (node.type === 'model') {
            const sel = node.selection || { strategy: 'capability', capability: state.capabilities[0]?.id || 'image-generation' };
            node.selection = sel;

            const modelRow = document.createElement('div');
            modelRow.className = 'row';
            modelRow.style.marginTop = '10px';
            modelRow.innerHTML = `
              <div class="field">
                <label>Selection Strategy</label>
                <select data-node-id="${escapeHtml(node.id)}" data-node-field="modelStrategy">
                  <option value="capability">capability</option>
                  <option value="explicit">explicit</option>
                </select>
              </div>
              <div class="field">
                <label>Capability / Model</label>
                <div id="modelPicker-${escapeHtml(node.id)}"></div>
              </div>
            `;
            card.appendChild(modelRow);

            const stratSel = modelRow.querySelector('select');
            stratSel.value = sel.strategy;
            stratSel.addEventListener('change', () => {
              if (stratSel.value === 'explicit') {
                node.selection = { strategy: 'explicit', provider: 'replicate', modelId: '' };
              } else {
                node.selection = { strategy: 'capability', capability: state.capabilities[0]?.id || 'image-generation' };
              }
              renderBuildTab();
            });

            const picker = modelRow.querySelector(`#modelPicker-${CSS.escape(node.id)}`);
            picker.innerHTML = '';

            if (node.selection.strategy === 'capability') {
              const capSel = document.createElement('select');
              for (const c of state.capabilities) {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = `${c.id} (${c.modelCount || 0})`;
                capSel.appendChild(opt);
              }
              capSel.value = node.selection.capability || state.capabilities[0]?.id || '';
              capSel.addEventListener('change', async () => {
                node.selection.capability = capSel.value;
                delete node.selection.selectedModelId;
                delete node.selection.preferredProvider;
                renderBuildTab();
              });

              const modelSel = document.createElement('select');
              modelSel.style.marginTop = '8px';
              modelSel.innerHTML = `<option value="">Auto (recommended)</option>`;

              const cap = capSel.value;
              const models = state.modelsByCapability.get(cap) || [];
              for (const m of models) {
                const opt = document.createElement('option');
                opt.value = m.id;
                opt.textContent = `${m.displayName || m.id} — ${m.provider} (${m.tier})${m.recommended ? ' ★' : ''}`;
                modelSel.appendChild(opt);
              }
	              modelSel.value = node.selection.selectedModelId || '';
	              modelSel.addEventListener('change', () => {
	                const v = modelSel.value;
	                node.selection.selectedModelId = v || undefined;
	                renderBuildTab();
	              });

              picker.appendChild(capSel);
              picker.appendChild(modelSel);
            } else {
              const providerSel = document.createElement('select');
              providerSel.innerHTML = `
                <option value="replicate">replicate</option>
                <option value="fal">fal</option>
                <option value="openai">openai</option>
                <option value="stability">stability</option>
                <option value="elevenlabs">elevenlabs</option>
                <option value="runway">runway</option>
              `;
	              providerSel.value = node.selection.provider || 'replicate';
	              providerSel.addEventListener('change', () => {
	                node.selection.provider = providerSel.value;
	                renderBuildTab();
	              });

              const modelIdInput = document.createElement('input');
              modelIdInput.placeholder = 'Model ID (e.g. owner/name or provider slug)';
	              modelIdInput.value = node.selection.modelId || '';
	              modelIdInput.style.marginTop = '8px';
	              modelIdInput.addEventListener('input', () => {
	                node.selection.modelId = modelIdInput.value.trim();
	              });
	              modelIdInput.addEventListener('change', () => {
	                node.selection.modelId = modelIdInput.value.trim();
	                renderBuildTab();
	              });

	              picker.appendChild(providerSel);
	              picker.appendChild(modelIdInput);
	            }

	            const schemaDetails = document.createElement('details');
	            schemaDetails.style.marginTop = '10px';
	            schemaDetails.innerHTML = `<summary class="hint">Model schema</summary>`;
	            const schemaBody = document.createElement('div');
	            schemaBody.style.marginTop = '10px';

	            let previewProvider = '';
	            let previewModelId = '';
	            let previewNote = '';

	            if (node.selection.strategy === 'capability') {
	              const cap = node.selection.capability || '';
	              const models = state.modelsByCapability.get(cap) || [];
	              const selected = node.selection.selectedModelId ? models.find(m => m.id === node.selection.selectedModelId) : null;
	              const recommended = models.find(m => m.recommended) || models[0] || null;

	              if (selected) {
	                previewProvider = selected.provider;
	                previewModelId = selected.id;
	                previewNote = `Selected: ${selected.displayName || selected.id} (${selected.provider})`;
	              } else if (recommended) {
	                // Avoid fetching schemas for auto-selection to keep the UI snappy.
	                // Users can pick a concrete model to preview its exact schema.
	                previewNote = `Auto (recommended): ${recommended.displayName || recommended.id} (${recommended.provider}) — select a model above to preview schema.`;
	              } else {
	                previewNote = 'No models available for this capability/tier.';
	              }
	            } else {
	              previewProvider = node.selection.provider || '';
	              previewModelId = node.selection.modelId || '';
	              if (previewModelId) previewNote = `Explicit: ${previewProvider} / ${previewModelId}`;
	            }

	            if (previewNote) schemaBody.innerHTML += `<div class="hint">${escapeHtml(previewNote)}</div>`;

	            if (!previewProvider || !previewModelId) {
	              schemaBody.innerHTML += `<div class="hint" style="margin-top:8px;">Select a model to preview its input fields.</div>`;
	            } else {
	              ensureModelSchema(previewProvider, previewModelId);
	              const key = modelSchemaKey(previewProvider, previewModelId);
	              if (state.modelSchemasLoading.has(key)) {
	                schemaBody.innerHTML += `<div class="hint" style="margin-top:8px;">Loading schema…</div>`;
	              } else if (state.modelSchemasErrors.has(key)) {
	                schemaBody.innerHTML += `<div class="status error" style="margin-top:8px;">${escapeHtml(state.modelSchemasErrors.get(key))}</div>`;
	              } else {
	                const schema = state.modelSchemasByKey.get(key);
	                schemaBody.innerHTML += schema ? `<div style="margin-top:10px;">${renderSchemaSummary(schema, { maxFields: 50 })}</div>` : `<div class="hint" style="margin-top:8px;">Schema not available.</div>`;
	              }
	            }

	            schemaDetails.appendChild(schemaBody);
	            card.appendChild(schemaDetails);
	          }

          // Transform config
          if (node.type === 'transform') {
            const row = document.createElement('div');
            row.className = 'row';
            row.style.marginTop = '10px';

            const transformSel = document.createElement('select');
            for (const t of state.transforms) {
              const opt = document.createElement('option');
              opt.value = t.id;
              opt.textContent = `${t.id} — ${t.name}`;
              transformSel.appendChild(opt);
            }
            if (!state.transforms.length) {
              const opt = document.createElement('option');
              opt.value = '';
              opt.textContent = '(transforms not loaded)';
              transformSel.appendChild(opt);
              transformSel.disabled = true;
            }
            transformSel.value = node.transformId || state.transforms[0]?.id || 'get';
            transformSel.addEventListener('change', () => {
              node.transformId = transformSel.value;
              // Provide a helpful default mapping stub per transform
              node.inputMapping = node.inputMapping || {};
              if (node.transformId === 'get') {
                node.inputMapping.object = node.inputMapping.object || { from: 'node', nodeId: def.workflow.nodes[Math.max(0, idx - 1)]?.id || def.workflow.nodes[0]?.id || '', path: undefined };
                node.inputMapping.path = node.inputMapping.path || { from: 'const', value: 'output' };
              }
              renderBuildTab();
            });

            row.innerHTML = `
              <div class="field">
                <label>Transform</label>
              </div>
              <div class="field">
                <label>Description</label>
                <div class="hint" style="margin-top:8px;" id="transformDesc-${escapeHtml(node.id)}"></div>
              </div>
            `;
            row.children[0].appendChild(transformSel);
            card.appendChild(row);

            const descEl = row.querySelector(`#transformDesc-${CSS.escape(node.id)}`);
            const spec = state.transforms.find(t => t.id === transformSel.value);
            descEl.textContent = spec ? spec.description : '';
          }

          // Mapping editor
          const map = document.createElement('div');
          map.style.marginTop = '10px';
          map.appendChild(mappingEditor(node, idx));
          card.appendChild(map);

          stepsList.appendChild(card);
        });

        // Wire node actions
        stepsList.querySelectorAll('[data-del-node]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-del-node');
            def.workflow.nodes = def.workflow.nodes.filter(n => n.id !== id);
            // Remove node refs pointing to deleted node
            for (const node of def.workflow.nodes) {
              for (const [k, ref] of Object.entries(node.inputMapping || {})) {
                if (ref && ref.from === 'node' && ref.nodeId === id) delete node.inputMapping[k];
              }
            }
            defaultOutput(def);
            renderBuildTab();
          });
        });

        stepsList.querySelectorAll('[data-move][data-node]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const dir = btn.getAttribute('data-move');
            const id = btn.getAttribute('data-node');
            const nodes = def.workflow.nodes;
            const idx = nodes.findIndex(n => n.id === id);
            if (idx < 0) return;
            const nextIdx = dir === 'up' ? idx - 1 : idx + 1;
            if (nextIdx < 0 || nextIdx >= nodes.length) return;
            const tmp = nodes[idx];
            nodes[idx] = nodes[nextIdx];
            nodes[nextIdx] = tmp;
            defaultOutput(def);
            renderBuildTab();
          });
        });

        stepsList.querySelectorAll('[data-node-id][data-node-field]').forEach((control) => {
          const nodeId = control.getAttribute('data-node-id');
          const field = control.getAttribute('data-node-field');
          const node = def.workflow.nodes.find(n => n.id === nodeId);
          if (!node) return;
          control.addEventListener('input', () => {
            if (field === 'id') {
              const next = toIdentifier(control.value, 'step');
              if (next === node.id) return;
              const taken = new Set(def.workflow.nodes.map(n => n.id));
              taken.delete(node.id);
              const finalId = uniqueId(next, taken);
              const old = node.id;
              node.id = finalId;
              for (const n of def.workflow.nodes) {
                for (const ref of Object.values(n.inputMapping || {})) {
                  if (ref && ref.from === 'node' && ref.nodeId === old) ref.nodeId = finalId;
                }
              }
              if (def.workflow.entryNodeId === old) def.workflow.entryNodeId = finalId;
              for (const out of def.outputs || []) {
                if (out.from?.nodeId === old) out.from.nodeId = finalId;
              }
              renderBuildTab();
              return;
            }
            if (field === 'task') {
              node.task = control.value || undefined;
              return;
            }
          });
        });
      }

      function addStep() {
        const type = addStepRow.querySelector('#newStepType').value;
        const taken = new Set(def.workflow.nodes.map(n => n.id));
        const id = uniqueId(toIdentifier(`step_${def.workflow.nodes.length + 1}`, 'step'), taken);

        let node;
        if (type === 'agent') {
          node = { id, type: 'agent', agentId: state.agents[0]?.id || 'background-remover', inputMapping: {} };
        } else if (type === 'model') {
          node = { id, type: 'model', selection: { strategy: 'capability', capability: state.capabilities[0]?.id || 'image-generation' }, inputMapping: {}, params: {} };
        } else {
          node = { id, type: 'transform', transformId: state.transforms[0]?.id || 'get', inputMapping: {}, params: {} };
          if (node.transformId === 'get') {
            const prev = def.workflow.nodes[def.workflow.nodes.length - 1];
            if (prev) node.inputMapping.object = { from: 'node', nodeId: prev.id };
            node.inputMapping.path = { from: 'const', value: 'output' };
          }
        }

        def.workflow.nodes.push(node);
        defaultOutput(def);
        renderBuildTab();
      }

      addStepRow.querySelector('#addStepBtn').addEventListener('click', addStep);
      renderStepsList();
      el.tabBuildPanel.appendChild(stepsSection);

      // Output (minimal)
      const outSection = document.createElement('div');
      outSection.className = 'section';
      outSection.innerHTML = `<h3>Result</h3>`;

      const nodes = def.workflow.nodes || [];
      const out = (def.outputs && def.outputs[0]) ? def.outputs[0] : null;
      if (!nodes.length || !out) {
        outSection.innerHTML += `<div class="hint">Add at least one step to produce output.</div>`;
      } else {
        const outRow = document.createElement('div');
        outRow.className = 'row';
        outRow.innerHTML = `
          <div class="field">
            <label>Renderer</label>
            <select id="outRenderer">
              <option value="auto">auto</option>
              <option value="image">image</option>
              <option value="image_or_gallery">image_or_gallery</option>
              <option value="video">video</option>
              <option value="audio">audio</option>
              <option value="text">text</option>
              <option value="json">json</option>
            </select>
          </div>
          <div class="field">
            <label>From Step</label>
            <select id="outNodeId"></select>
          </div>
        `;
        outSection.appendChild(outRow);

        const rendererSel = outRow.querySelector('#outRenderer');
        rendererSel.value = out.renderer || 'auto';
        rendererSel.addEventListener('change', () => { out.renderer = rendererSel.value; });

        const nodeSel = outRow.querySelector('#outNodeId');
        nodes.forEach(n => {
          const opt = document.createElement('option');
          opt.value = n.id;
          opt.textContent = n.id;
          nodeSel.appendChild(opt);
        });
        nodeSel.value = out.from?.nodeId || nodes[nodes.length - 1].id;
        nodeSel.addEventListener('change', () => {
          out.from = out.from || {};
          out.from.nodeId = nodeSel.value;
        });

        const pathRow = document.createElement('div');
        pathRow.className = 'field';
        pathRow.style.marginTop = '10px';
        pathRow.innerHTML = `
          <label>Path (optional)</label>
          <input id="outPath" placeholder="e.g. output.url" value="${escapeHtml(out.from?.path || '')}" />
          <div class="hint">Most nodes already put the “real” output under <code>output</code>; use Transform “get” when you need deep extraction.</div>
        `;
        outSection.appendChild(pathRow);

        const outPath = pathRow.querySelector('#outPath');
        outPath.addEventListener('input', () => {
          out.from = out.from || {};
          out.from.path = outPath.value.trim() || undefined;
        });
      }

      el.tabBuildPanel.appendChild(outSection);
    }

    function setDefaultRunInputs(definition) {
      state.runInputs = state.runInputs || {};
      for (const inputDef of (definition.inputs || [])) {
        if (state.runInputs[inputDef.id] !== undefined) continue;
        if (inputDef.default !== undefined) state.runInputs[inputDef.id] = inputDef.default;
        else if (inputDef.type === 'boolean') state.runInputs[inputDef.id] = false;
        else if ((inputDef.type === 'image' || inputDef.type === 'video' || inputDef.type === 'audio') && (inputDef.constraints?.minItems || 0) > 0) {
          state.runInputs[inputDef.id] = [];
        }
      }
    }

    function isMultipleMedia(inputDef) {
      const c = inputDef.constraints || {};
      return (typeof c.maxItems === 'number' && c.maxItems > 1) || (typeof c.minItems === 'number' && c.minItems > 1);
    }

    // Minimal client-side output normalizer (mirrors src/appcore/normalize-output.ts)
    function isRecord(value) {
      return value !== null && typeof value === 'object' && !Array.isArray(value);
    }
    function isLikelyUrl(value) {
      const lower = String(value).toLowerCase();
      return lower.startsWith('http://') || lower.startsWith('https://') || lower.startsWith('data:') || lower.startsWith('https://aitopia.ai/uploads/');
    }
    function inferMediaTypeFromUrl(url) {
      const lower = String(url).toLowerCase();
      if (lower.startsWith('data:image/')) return 'image';
      if (lower.startsWith('data:video/')) return 'video';
      if (lower.startsWith('data:audio/')) return 'audio';
      if (/\.(png|jpg|jpeg|webp|gif)(\?|#|$)/.test(lower)) return 'image';
      if (/\.(mp4|webm|mov|m4v)(\?|#|$)/.test(lower)) return 'video';
      if (/\.(mp3|wav|m4a|aac|ogg)(\?|#|$)/.test(lower)) return 'audio';
      return 'unknown';
    }
    function firstString(values) {
      for (const v of values) if (typeof v === 'string' && v.trim()) return v;
      return undefined;
    }
    function extractUrl(value) {
      if (value === null || value === undefined) return undefined;
      if (typeof value === 'string') return value.trim() ? value : undefined;
      if (Array.isArray(value)) return extractUrl(value[0]);
      if (isRecord(value)) {
        if ('output' in value) {
          const nested = extractUrl(value.output);
          if (nested) return nested;
        }
        return firstString([
          value.url,
          value.href,
          value.resultUrl,
          value.outputUrl,
          value.imageUrl,
          value.videoUrl,
          value.audioUrl,
          (isRecord(value.video) ? value.video.url : value.video),
          (isRecord(value.audio) ? value.audio.url : value.audio),
        ]);
      }
      return undefined;
    }
    function extractUrls(value) {
      if (value === null || value === undefined) return undefined;
      if (Array.isArray(value)) {
        const urls = value.map(extractUrl).filter(u => typeof u === 'string' && u.length > 0);
        return urls.length ? urls : undefined;
      }
      if (isRecord(value)) {
        if (Array.isArray(value.images)) {
          const urls = value.images.map(extractUrl).filter(u => typeof u === 'string' && u.length > 0);
          return urls.length ? urls : undefined;
        }
        if (isRecord(value.output) && Array.isArray(value.output.images)) {
          const urls = value.output.images.map(extractUrl).filter(u => typeof u === 'string' && u.length > 0);
          return urls.length ? urls : undefined;
        }
      }
      return undefined;
    }
    function normalizeClientOutput(raw) {
      if (raw === null || raw === undefined) return { type: 'unknown', data: raw };
      if (typeof raw === 'string') {
        if (isLikelyUrl(raw)) {
          const t = inferMediaTypeFromUrl(raw);
          if (t === 'image') return { type: 'image', url: raw };
          if (t === 'video') return { type: 'video', url: raw };
          if (t === 'audio') return { type: 'audio', url: raw };
          return { type: 'unknown', data: raw };
        }
        return { type: 'text', text: raw };
      }
      const urls = extractUrls(raw);
      if (urls && urls.length) return { type: 'gallery', urls };
      const url = extractUrl(raw);
      if (url && isLikelyUrl(url)) {
        const t = inferMediaTypeFromUrl(url);
        if (t === 'image') return { type: 'image', url };
        if (t === 'video') return { type: 'video', url };
        if (t === 'audio') return { type: 'audio', url };
        return { type: 'unknown', data: raw };
      }
      if (isRecord(raw)) {
        const text = firstString([raw.text, raw.content, raw.message]);
        if (text) return { type: 'text', text };
      }
      return { type: 'json', data: raw };
    }

    async function readFileAsDataUrl(file) {
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });
    }

    function renderRunTab() {
      el.tabRunPanel.innerHTML = '';
      if (!state.definition) {
        el.tabRunPanel.innerHTML = `<div class="hint">Select an app to run.</div>`;
        return;
      }

      setDefaultRunInputs(state.definition);

      const optionsBox = document.createElement('div');
      optionsBox.className = 'section';
      optionsBox.innerHTML = `<h3>Run Options</h3>`;
      const optRow = document.createElement('div');
      optRow.className = 'row';
      optRow.innerHTML = `
        <div class="field">
          <label>Async</label>
          <select id="runAsyncMode">
            <option value="auto">auto</option>
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
          <div class="hint">Auto is recommended: AppCore may force sync for model/self‑executing nodes.</div>
        </div>
        <div class="field">
          <label>Tier</label>
          <input value="${escapeHtml(el.userTier.value)}" disabled />
          <div class="hint">Set tier in the header.</div>
        </div>
      `;
      optionsBox.appendChild(optRow);
      const asyncSel = optRow.querySelector('#runAsyncMode');
      asyncSel.value = state.runAsyncMode;
      asyncSel.addEventListener('change', () => { state.runAsyncMode = asyncSel.value; });
      el.tabRunPanel.appendChild(optionsBox);

      const box = document.createElement('div');
      box.className = 'section';
      box.innerHTML = `<h3>Inputs</h3>`;

      const inputs = state.definition.inputs || [];
      if (!inputs.length) {
        box.innerHTML += `<div class="hint">This app has no inputs.</div>`;
      } else {
        for (const inputDef of inputs) {
          const card = document.createElement('div');
          card.className = 'card';
          const label = inputDef.ui?.label || inputDef.id;
          const required = inputDef.required === true;
          card.innerHTML = `
            <div class="card-header">
              <div class="title">
                <strong>${escapeHtml(label)}</strong>
                <span class="badge">${escapeHtml(inputDef.type)}</span>
                ${required ? `<span class="badge req">required</span>` : ``}
              </div>
              <div class="card-actions"></div>
            </div>
          `;

          const id = inputDef.id;
          const current = state.runInputs[id];

          const controlWrap = document.createElement('div');
          controlWrap.style.marginTop = '10px';

          if (inputDef.type === 'text' || inputDef.type === 'chat') {
            const ta = document.createElement(inputDef.type === 'chat' ? 'textarea' : 'input');
            if (ta.tagName.toLowerCase() === 'input') {
              ta.type = 'text';
              ta.value = typeof current === 'string' ? current : '';
              ta.placeholder = inputDef.ui?.placeholder || '';
              ta.addEventListener('input', () => { state.runInputs[id] = ta.value; });
            } else {
              ta.rows = 4;
              ta.value = typeof current === 'string' ? current : '';
              ta.placeholder = inputDef.ui?.placeholder || '';
              ta.addEventListener('input', () => { state.runInputs[id] = ta.value; });
            }
            controlWrap.appendChild(ta);
          } else if (inputDef.type === 'number') {
            const inp = document.createElement('input');
            inp.type = 'number';
            inp.value = typeof current === 'number' ? String(current) : '';
            inp.placeholder = inputDef.ui?.placeholder || '';
            inp.addEventListener('input', () => {
              const v = inp.value.trim();
              state.runInputs[id] = v.length ? Number(v) : undefined;
            });
            controlWrap.appendChild(inp);
          } else if (inputDef.type === 'boolean') {
            const sel = document.createElement('select');
            sel.innerHTML = `<option value="false">false</option><option value="true">true</option>`;
            sel.value = current === true ? 'true' : 'false';
            sel.addEventListener('change', () => { state.runInputs[id] = sel.value === 'true'; });
            controlWrap.appendChild(sel);
          } else if (inputDef.type === 'select') {
            const sel = document.createElement('select');
            sel.innerHTML = `<option value="">(choose)</option>`;
            for (const opt of (inputDef.options || [])) {
              const o = document.createElement('option');
              o.value = String(opt);
              o.textContent = String(opt);
              sel.appendChild(o);
            }
            sel.value = current !== undefined && current !== null ? String(current) : '';
            sel.addEventListener('change', () => {
              state.runInputs[id] = sel.value === '' ? undefined : sel.value;
            });
            controlWrap.appendChild(sel);
          } else if (inputDef.type === 'json') {
            const ta = document.createElement('textarea');
            ta.rows = 5;
            ta.placeholder = inputDef.ui?.placeholder || '{"key":"value"}';
            if (current !== undefined) {
              ta.value = typeof current === 'string' ? current : JSON.stringify(current, null, 2);
            }
            ta.addEventListener('input', () => { state.runInputs[id] = ta.value; });
            controlWrap.appendChild(ta);
          } else if (inputDef.type === 'image_pair') {
            const wrap = document.createElement('div');
            wrap.className = 'row';
            const left = document.createElement('input');
            left.type = 'file';
            left.accept = 'image/*';
            const right = document.createElement('input');
            right.type = 'file';
            right.accept = 'image/*';
            wrap.appendChild(left);
            wrap.appendChild(right);
            const update = async () => {
              const a = left.files && left.files[0] ? await readFileAsDataUrl(left.files[0]) : undefined;
              const b = right.files && right.files[0] ? await readFileAsDataUrl(right.files[0]) : undefined;
              state.runInputs[id] = [a, b].filter(Boolean);
            };
            left.addEventListener('change', () => update().catch(e => showStatus('error', e.message)));
            right.addEventListener('change', () => update().catch(e => showStatus('error', e.message)));
            controlWrap.appendChild(wrap);
          } else if (inputDef.type === 'image' || inputDef.type === 'video' || inputDef.type === 'audio') {
            const multiple = isMultipleMedia(inputDef);
            const accept = inputDef.ui?.accept || (inputDef.constraints?.mimeTypes ? inputDef.constraints.mimeTypes.join(',') : '');

            if (!multiple) {
              const wrap = document.createElement('div');
              wrap.className = 'row';

              const urlInput = document.createElement('input');
              urlInput.type = 'text';
              urlInput.placeholder = 'Paste a URL (or use file upload)';
              if (typeof current === 'string' && !current.startsWith('data:')) urlInput.value = current;
              urlInput.addEventListener('input', () => {
                const v = urlInput.value.trim();
                state.runInputs[id] = v.length ? v : undefined;
              });

              const fileInput = document.createElement('input');
              fileInput.type = 'file';
              if (accept) fileInput.accept = accept;
              fileInput.addEventListener('change', async () => {
                const file = fileInput.files && fileInput.files[0];
                if (!file) return;
                const dataUrl = await readFileAsDataUrl(file);
                state.runInputs[id] = dataUrl;
                urlInput.value = '';
              });

              wrap.appendChild(urlInput);
              wrap.appendChild(fileInput);
              controlWrap.appendChild(wrap);
            } else {
              const arr = Array.isArray(current) ? current.slice() : [];
              const minItems = Number.isFinite(inputDef.constraints?.minItems) ? inputDef.constraints.minItems : 0;
              const maxItems = Number.isFinite(inputDef.constraints?.maxItems) ? inputDef.constraints.maxItems : 10;

              while (arr.length < minItems) arr.push('');
              state.runInputs[id] = arr;

              const list = document.createElement('div');
              const renderItems = () => {
                list.innerHTML = '';
                const items = Array.isArray(state.runInputs[id]) ? state.runInputs[id] : [];
                items.forEach((val, idx) => {
                  const row = document.createElement('div');
                  row.className = 'row';
                  row.style.marginTop = '8px';

                  const urlInput = document.createElement('input');
                  urlInput.type = 'text';
                  urlInput.placeholder = `URL for item #${idx + 1}`;
                  if (typeof val === 'string' && val && !val.startsWith('data:')) urlInput.value = val;
                  urlInput.addEventListener('input', () => {
                    const v = urlInput.value.trim();
                    const items2 = Array.isArray(state.runInputs[id]) ? state.runInputs[id].slice() : [];
                    items2[idx] = v;
                    state.runInputs[id] = items2;
                  });

                  const fileInput = document.createElement('input');
                  fileInput.type = 'file';
                  if (accept) fileInput.accept = accept;
                  fileInput.addEventListener('change', async () => {
                    const file = fileInput.files && fileInput.files[0];
                    if (!file) return;
                    const dataUrl = await readFileAsDataUrl(file);
                    const items2 = Array.isArray(state.runInputs[id]) ? state.runInputs[id].slice() : [];
                    items2[idx] = dataUrl;
                    state.runInputs[id] = items2;
                    urlInput.value = '';
                  });

                  const remove = document.createElement('button');
                  remove.className = 'btn danger';
                  remove.textContent = 'Remove';
                  remove.addEventListener('click', () => {
                    const items2 = Array.isArray(state.runInputs[id]) ? state.runInputs[id].slice() : [];
                    items2.splice(idx, 1);
                    while (items2.length < minItems) items2.push('');
                    state.runInputs[id] = items2;
                    renderItems();
                  });

                  row.appendChild(urlInput);
                  row.appendChild(fileInput);
                  row.appendChild(remove);
                  list.appendChild(row);
                });

                const addBtn = document.createElement('button');
                addBtn.className = 'btn mini';
                addBtn.textContent = 'Add item';
                addBtn.disabled = (Array.isArray(state.runInputs[id]) ? state.runInputs[id].length : 0) >= maxItems;
                addBtn.addEventListener('click', () => {
                  const items2 = Array.isArray(state.runInputs[id]) ? state.runInputs[id].slice() : [];
                  items2.push('');
                  state.runInputs[id] = items2;
                  renderItems();
                });
                list.appendChild(addBtn);
              };
              renderItems();
              controlWrap.appendChild(list);
            }
          } else {
            const ta = document.createElement('textarea');
            ta.rows = 4;
            ta.placeholder = `Unsupported input type '${inputDef.type}'`;
            ta.value = current !== undefined ? (typeof current === 'string' ? current : JSON.stringify(current, null, 2)) : '';
            ta.addEventListener('input', () => { state.runInputs[id] = ta.value; });
            controlWrap.appendChild(ta);
          }

          card.appendChild(controlWrap);

          if (inputDef.ui?.helpText) {
            const h = document.createElement('div');
            h.className = 'hint';
            h.textContent = inputDef.ui.helpText;
            card.appendChild(h);
          }

          box.appendChild(card);
        }
      }

      el.tabRunPanel.appendChild(box);

      const outBox = document.createElement('div');
      outBox.className = 'section';
      outBox.innerHTML = `<h3>Result</h3>`;

      const result = state.runResult;
      if (!result) {
        outBox.innerHTML += `<div class="hint">No run yet.</div>`;
      } else {
        const status = result.status || 'unknown';
        outBox.innerHTML += `<div class="hint">Status: <span class="badge">${escapeHtml(status)}</span> ${result.jobId ? `• Job: <code>${escapeHtml(result.jobId)}</code>` : ''}</div>`;

        const normalized = result.normalizedOutput || (result.output ? normalizeClientOutput(result.output) : null);
        if (normalized) {
          const n = normalized;
          if (n.type === 'image') outBox.innerHTML += `<div style="margin-top:10px;"><img src="${escapeHtml(n.url)}" style="max-width:100%; border-radius:12px; border:1px solid hsl(var(--aifnmjmchg-m-border));" /></div>`;
          else if (n.type === 'video') outBox.innerHTML += `<div style="margin-top:10px;"><video controls src="${escapeHtml(n.url)}" style="max-width:100%; border-radius:12px; border:1px solid hsl(var(--aifnmjmchg-m-border));"></video></div>`;
          else if (n.type === 'audio') outBox.innerHTML += `<div style="margin-top:10px;"><audio controls src="${escapeHtml(n.url)}" style="width:100%;"></audio></div>`;
          else if (n.type === 'gallery') outBox.innerHTML += `<div class="hint" style="margin-top:10px;">Gallery (${n.urls.length})</div>` +
            `<div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap:10px; margin-top:10px;">` +
            n.urls.map(u => `<img src="${escapeHtml(u)}" style="width:100%; border-radius:12px; border:1px solid hsl(var(--aifnmjmchg-m-border));" />`).join('') +
            `</div>`;
          else if (n.type === 'text') outBox.innerHTML += `<pre>${escapeHtml(n.text)}</pre>`;
        }

        outBox.innerHTML += `<details style="margin-top:10px;"><summary class="hint">Raw JSON</summary><pre>${escapeHtml(JSON.stringify(result, null, 2))}</pre></details>`;
      }

      el.tabRunPanel.appendChild(outBox);
    }

    async function refreshApps() {
      showStatus(null, null);
      stopPolling();
      const res = await api('https://aitopia.ai/api/apps');
      state.apps = res.apps || [];
      renderAppsList();
    }

    async function selectApp(appId) {
      showStatus(null, null);
      stopPolling();
      state.selectedAppId = appId;
      state.runResult = null;
      setActiveTab('build');
      renderAppsList();

      const res = await api(`https://aitopia.ai/api/apps/${appId}`);
      state.app = res.app || null;
      state.currentVersion = res.currentVersion || null;
      state.definition = res.currentVersion?.definition ? structuredClone(res.currentVersion.definition) : null;

	      el.detailTitle.textContent = state.app?.name ? `App: ${state.app.name}` : `App: ${appId}`;
	      el.saveBtn.disabled = !state.definition;
	      el.previewBtn.disabled = !state.definition;
	      el.runBtn.disabled = !state.definition;
	      el.shareBtn.disabled = !state.app?.id;
	      el.publishBtn.disabled = !state.app?.id;

      if (!state.definition) {
        showStatus('error', 'No current definition found for this app');
        el.tabBuildPanel.innerHTML = `<div class="hint">No definition.</div>`;
        el.tabRunPanel.innerHTML = '';
        return;
      }

      renderBuildTab();
      renderRunTab();
    }

    async function createApp() {
      showStatus(null, null);
      const name = prompt('App name?');
      if (!name) return;
      const visibility = el.defaultVisibility.value;

      const res = await api('https://aitopia.ai/api/apps', {
        method: 'POST',
        body: { name, visibility },
      });
      await refreshApps();
      if (res.app?.id) await selectApp(res.app.id);
    }

	    async function saveApp() {
	      ensureDefinitionLoaded();
	      showStatus('info', 'Saving...');
	      const def = state.definition;

      normalizeWorkflowMode(def);
      if (!def.outputs || def.outputs.length === 0) defaultOutput(def);

      const res = await api(`https://aitopia.ai/api/apps/${state.selectedAppId}`, {
        method: 'PUT',
        body: {
          name: def.name,
          description: def.description ?? null,
          visibility: def.visibility,
          definition: def,
          reason: 'studio-save',
        },
      });

      state.app = res.app;
      state.currentVersion = res.currentVersion;
	      showStatus('success', `Saved (v${res.currentVersion?.version || '?'})`);
	      await refreshApps();
	      renderAppsList();
	    }

    async function createShareLink() {
      if (!state.app?.id) return;
      showStatus('info', 'Creating share link...');
      const res = await api(`https://aitopia.ai/api/apps/${state.app.id}/share`, {
        method: 'POST',
        body: { permissions: 'view,run', expiresIn: '7d', versionMode: 'pinned' },
      });
      const url = res?.url ? `${window.location.origin}${res.url}` : null;
      if (url) {
        try {
          await navigator.clipboard.writeText(url);
          showStatus('success', `Share link copied to clipboard`, { url });
        } catch {
          showStatus('success', `Share link created`, { url });
        }
      } else {
        showStatus('success', 'Share created');
      }
    }

    async function requestReview() {
      if (!state.app?.id) return;
      showStatus('info', 'Requesting review...');
      const res = await api(`https://aitopia.ai/api/apps/${state.app.id}/request-review`, { method: 'POST', body: {} });
      const status = res?.published?.status ? ` (${res.published.status})` : '';
      showStatus('success', `Review requested${status}`);
      await refreshApps();
      await selectApp(state.app.id);
    }

	    function getDefinitionForPreview() {
	      ensureDefinitionLoaded();
	      const def = structuredClone(state.definition);
	      normalizeWorkflowMode(def);
	      if (!def.outputs || def.outputs.length === 0) defaultOutput(def);
	      return def;
	    }

	    async function openPreviewDialog() {
	      try {
	        const def = getDefinitionForPreview();
	        el.previewPre.textContent = JSON.stringify(def, null, 2);
	        el.previewDialog.showModal();
	      } catch (e) {
	        showStatus('error', e.message || 'Preview failed', e.details);
	      }
	    }

	    async function copyPreviewJson() {
	      const text = el.previewPre.textContent || '';
	      try {
	        await navigator.clipboard.writeText(text);
	        showStatus('success', 'Copied definition JSON to clipboard');
	      } catch {
	        // Fallback: select text
	        const range = document.createRange();
	        range.selectNodeContents(el.previewPre);
	        const sel = window.getSelection();
	        sel.removeAllRanges();
	        sel.addRange(range);
	        showStatus('info', 'Select + copy (Ctrl/Cmd+C)');
	      }
	    }

    function buildRunPayload(definition) {
      const payload = {};
      for (const inputDef of (definition.inputs || [])) {
        let value = state.runInputs[inputDef.id];
        if (value === undefined || value === null || value === '') continue;

        if (inputDef.type === 'json') {
          if (typeof value === 'string') {
            try { value = JSON.parse(value); } catch { /* keep string */ }
          }
        }

        // For media arrays, remove empty placeholders
        if ((inputDef.type === 'image' || inputDef.type === 'video' || inputDef.type === 'audio') && Array.isArray(value)) {
          value = value.filter(v => typeof v === 'string' && v.trim().length > 0);
          if (!value.length) continue;
        }

        payload[inputDef.id] = value;
      }
      return payload;
    }

    async function pollJob(jobId) {
      stopPolling();
      state.pollTimer = setInterval(async () => {
        try {
          const job = await api(`/jobs/${jobId}`);
          const rawOutput = job?.output?.output ?? job?.output ?? job?.result ?? null;
          state.runResult = {
            status: job.status,
            jobId: job.id,
            output: rawOutput,
            normalizedOutput: rawOutput ? normalizeClientOutput(rawOutput) : null,
            job,
          };

          if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
            stopPolling();
          }
          renderRunTab();
        } catch (e) {
          stopPolling();
          showStatus('error', e.message || 'Job polling failed', e.details);
        }
      }, 1000);
    }

    async function testRun() {
      ensureDefinitionLoaded();
      setActiveTab('run');
      showStatus(null, null);
      stopPolling();

      const payload = buildRunPayload(state.definition);
      showStatus('info', 'Running...');

      const res = await fetch(`${API_BASE}/api/apps/${state.selectedAppId}/run`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify((() => {
          const body = { tier: el.userTier.value, input: payload };
          if (state.runAsyncMode === 'true') body.async = true;
          else if (state.runAsyncMode === 'false') body.async = false;
          return body;
        })()),
      });

      const json = await res.json().catch(() => ({}));
      if (res.status === 202 && json.jobId) {
        if (!json.normalizedOutput && json.output) json.normalizedOutput = normalizeClientOutput(json.output);
        state.runResult = json;
        renderRunTab();
        await pollJob(json.jobId);
        return;
      }

      if (!res.ok) {
        const msg = json?.error?.message || json?.error || 'Run failed';
        showStatus('error', msg, json?.error?.details || json);
        if (!json.normalizedOutput && json.output) json.normalizedOutput = normalizeClientOutput(json.output);
        state.runResult = json;
        renderRunTab();
        return;
      }

      if (!json.normalizedOutput && json.output) json.normalizedOutput = normalizeClientOutput(json.output);
      state.runResult = json;
      showStatus('success', 'Run complete');
      renderRunTab();
    }

    async function preloadTransforms() {
      try {
        const res = await api('https://aitopia.ai/api/apps/transforms');
        state.transforms = res.transforms || [];
      } catch {
        state.transforms = [];
      }
    }

    async function preloadCapabilities() {
      try {
        const res = await api('https://aitopia.ai/api/models/capabilities');
        state.capabilities = (res.capabilities || []).map(c => ({ id: c.id, modelCount: c.modelCount || 0 }));

        // Warm model list for each capability (tier-filtered)
        state.modelsByCapability = new Map();
        for (const cap of state.capabilities) {
          try {
            const modelsRes = await api(`https://aitopia.ai/api/models?capability=${encodeURIComponent(cap.id)}&tier=${encodeURIComponent(el.userTier.value)}`);
            state.modelsByCapability.set(cap.id, modelsRes.models || []);
          } catch {
            state.modelsByCapability.set(cap.id, []);
          }
        }
      } catch {
        state.capabilities = [];
        state.modelsByCapability = new Map();
      }
    }

    async function preloadAgents() {
      try {
        const res = await api('https://aitopia.ai/api/agents');
        state.agents = res.agents || [];
        el.agentsDatalist.innerHTML = '';
        for (const a of state.agents) {
          const opt = document.createElement('option');
          opt.value = a.id;
          el.agentsDatalist.appendChild(opt);
        }
      } catch {
        state.agents = [];
      }
    }

    async function openCloneDialog() {
      el.cloneAgentId.value = '';
      el.cloneName.value = '';
      el.cloneVisibility.value = el.defaultVisibility.value;
      el.cloneDialog.showModal();
    }

    async function cloneFromAgent() {
      const agentId = el.cloneAgentId.value.trim();
      if (!agentId) {
        showStatus('error', 'Pick an agent ID to clone');
        return;
      }

      showStatus('info', 'Cloning agent...');

      // Fetch agent card with inputSchema
      const agent = await api(`https://aitopia.ai/api/agents/${encodeURIComponent(agentId)}`);

      const schema = agent.inputSchema || {};
      const properties = schema.properties || {};
      const requiredList = Array.isArray(schema.required) ? schema.required : [];

      const inputs = [];
      const taken = new Set();
      const mapping = {};

      for (const [propName, propSchema] of Object.entries(properties)) {
        const baseId = toIdentifier(propName, 'input');
        const id = uniqueId(baseId, taken);
        taken.add(id);

        const inferred = inferInputFromJsonSchemaProperty(propName, propSchema);
        const inputDef = {
          id,
          type: inferred.type,
          required: requiredList.includes(propName),
          ui: {
            label: propSchema && propSchema.title ? propSchema.title : propName,
            helpText: propSchema && propSchema.description ? propSchema.description : undefined,
          },
        };
        if (inferred.options) inputDef.options = inferred.options;
        if (inferred.constraints && Object.keys(inferred.constraints).length) inputDef.constraints = inferred.constraints;
        inputs.push(inputDef);

        mapping[propName] = { from: 'input', inputId: id };
      }

      const appName = (el.cloneName.value.trim() || agent.name || agent.id || agentId).slice(0, 120);
      const visibility = el.cloneVisibility.value;

      const definition = {
        formatVersion: 1,
        name: appName,
        description: agent.description || '',
        visibility,
        ui: { mode: 'form' },
        inputs,
        workflow: {
          mode: 'single',
          entryNodeId: 'step_1',
          nodes: [{
            id: 'step_1',
            type: 'agent',
            agentId: agentId,
            inputMapping: mapping,
          }],
        },
        outputs: [{
          id: 'output',
          renderer: 'auto',
          from: { nodeId: 'step_1' },
        }],
      };

      const created = await api('https://aitopia.ai/api/apps', {
        method: 'POST',
        body: {
          name: appName,
          description: agent.description || '',
          visibility,
          definition,
          reason: 'clone-agent',
        },
      });

      el.cloneDialog.close();
      await refreshApps();
      if (created.app?.id) await selectApp(created.app.id);
      showStatus('success', `Cloned agent '${agentId}'`);
    }

    // UI wiring
    el.tabBuild.addEventListener('click', () => setActiveTab('build'));
    el.tabRun.addEventListener('click', () => setActiveTab('run'));

	    el.refreshBtn.addEventListener('click', () => refreshApps().catch(e => showStatus('error', e.message, e.details)));
	    el.createBtn.addEventListener('click', () => createApp().catch(e => showStatus('error', e.message, e.details)));
	    el.saveBtn.addEventListener('click', () => saveApp().catch(e => showStatus('error', e.message, e.details)));
	    el.previewBtn.addEventListener('click', () => openPreviewDialog().catch(e => showStatus('error', e.message, e.details)));
	    el.runBtn.addEventListener('click', () => testRun().catch(e => showStatus('error', e.message, e.details)));
	    el.shareBtn.addEventListener('click', () => createShareLink().catch(e => showStatus('error', e.message, e.details)));
	    el.publishBtn.addEventListener('click', () => requestReview().catch(e => showStatus('error', e.message, e.details)));

	    el.cloneBtn.addEventListener('click', () => openCloneDialog().catch(e => showStatus('error', e.message, e.details)));
	    el.cloneCloseBtn.addEventListener('click', () => el.cloneDialog.close());
	    el.cloneCreateBtn.addEventListener('click', () => cloneFromAgent().catch(e => showStatus('error', e.message, e.details)));

	    el.previewCloseBtn.addEventListener('click', () => el.previewDialog.close());
	    el.previewCopyBtn.addEventListener('click', () => copyPreviewJson().catch(() => {}));

    el.userTier.addEventListener('change', () => {
      // Refresh capability model lists for the new tier
      preloadCapabilities().catch(() => {});
      if (state.definition) renderBuildTab();
    });

    // Startup
    (async () => {
      try {
        await Promise.all([
          preloadTransforms(),
          preloadAgents(),
          preloadCapabilities(),
        ]);
        await refreshApps();
      } catch (e) {
        showStatus('error', e.message || 'Initialization failed', e.details);
      }
    })();