const API_BASE = window.__AITOPIA_DOMAIN__ || 'https://aitopia.ai';
    const state = {
      apps: [],
      selectedAppId: null,
      app: null,
      currentVersion: null,
      versions: [],
    };

    const el = {
      tenantId: document.getElementById('tenantId'),
      userId: document.getElementById('userId'),
      visibility: document.getElementById('visibility'),
      refreshBtn: document.getElementById('refreshBtn'),
      createBtn: document.getElementById('createBtn'),
      appsList: document.getElementById('appsList'),
      appsMeta: document.getElementById('appsMeta'),
      detailTitle: document.getElementById('detailTitle'),
      runnerLink: document.getElementById('runnerLink'),
      saveBtn: document.getElementById('saveBtn'),
      loadVersionsBtn: document.getElementById('loadVersionsBtn'),
      versionsBox: document.getElementById('versionsBox'),
      statusBox: document.getElementById('statusBox'),
      appName: document.getElementById('appName'),
      appDescription: document.getElementById('appDescription'),
      appReason: document.getElementById('appReason'),
      definitionJson: document.getElementById('definitionJson'),
    };

    function escapeHtml(str) {
      return String(str)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
    }

    function showStatus(type, message) {
      if (!message) { el.statusBox.innerHTML = ''; return; }
      const cls = type === 'error' ? 'error' : 'success';
      el.statusBox.innerHTML = `<div class="${cls}">${escapeHtml(message)}</div>`;
    }

    function getHeaders(extra = {}) {
      const tenantId = (el.tenantId.value || 'public').trim();
      const userId = el.userId.value.trim();
      const headers = {
        'Content-Type': 'application/json',
        'X-Tenant-Id': tenantId,
        ...extra,
      };
      if (userId) headers['X-User-Id'] = userId;
      return headers;
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

    async function refreshApps() {
      showStatus(null, null);
      el.versionsBox.innerHTML = '';
      try {
        const res = await api('https://aitopia.ai/api/apps');
        state.apps = res.apps || [];
        renderAppsList();
      } catch (e) {
        showStatus('error', e.message || 'Failed to load apps');
      }
    }

    async function selectApp(appId) {
      showStatus(null, null);
      el.versionsBox.innerHTML = '';
      state.selectedAppId = appId;
      renderAppsList();
      el.saveBtn.disabled = true;
      el.loadVersionsBtn.disabled = true;
      el.runnerLink.style.display = 'none';

      try {
        const res = await api(`https://aitopia.ai/api/apps/${appId}`);
        state.app = res.app;
        state.currentVersion = res.currentVersion;

        el.detailTitle.textContent = state.app?.name ? `Edit: ${state.app.name}` : `Edit: ${appId}`;
        el.runnerLink.href = `/app-runner.html?appId=${encodeURIComponent(appId)}`;
        el.runnerLink.style.display = 'inline-flex';

        el.appName.value = state.app?.name || '';
        el.appDescription.value = state.app?.description || '';
        el.definitionJson.value = JSON.stringify(state.currentVersion?.definition || {}, null, 2);

        el.saveBtn.disabled = false;
        el.loadVersionsBtn.disabled = false;
      } catch (e) {
        showStatus('error', e.message || 'Failed to load app');
      }
    }

    async function createNewApp() {
      showStatus(null, null);
      const name = prompt('New app name?');
      if (!name) return;
      const description = prompt('Description (optional)?') || undefined;
      const visibility = el.visibility.value || 'private';

      try {
        const res = await api('https://aitopia.ai/api/apps', {
          method: 'POST',
          body: JSON.stringify({ name, description, visibility }),
        });
        await refreshApps();
        await selectApp(res.app.id);
        showStatus('success', `Created app ${res.app.id}`);
      } catch (e) {
        showStatus('error', e.message || 'Create failed');
      }
    }

    async function saveVersion() {
      if (!state.selectedAppId) return;
      showStatus(null, null);

      const name = el.appName.value.trim();
      const description = el.appDescription.value.trim();
      const reason = el.appReason.value.trim() || 'update';

      let definition;
      try {
        definition = JSON.parse(el.definitionJson.value || '{}');
      } catch (e) {
        showStatus('error', 'Invalid JSON: ' + (e.message || 'parse error'));
        return;
      }

      const body = {
        name: name || undefined,
        description: description.length ? description : null,
        definition,
        reason,
      };

      try {
        const res = await api(`https://aitopia.ai/api/apps/${state.selectedAppId}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
        state.app = res.app;
        state.currentVersion = res.currentVersion;
        el.detailTitle.textContent = `Edit: ${res.app.name}`;
        showStatus('success', `Saved version v${res.currentVersion?.version ?? '?'}`);
        await refreshApps();
      } catch (e) {
        const details = e.body?.error?.details;
        if (details) {
          showStatus('error', `${e.message}\n\nDetails:\n${JSON.stringify(details, null, 2)}`);
        } else {
          showStatus('error', e.message || 'Save failed');
        }
      }
    }

    async function loadVersions() {
      if (!state.selectedAppId) return;
      showStatus(null, null);
      try {
        const res = await api(`https://aitopia.ai/api/apps/${state.selectedAppId}/versions`);
        state.versions = res.versions || [];
        renderVersions();
      } catch (e) {
        showStatus('error', e.message || 'Failed to load versions');
      }
    }

    async function restoreVersion(versionId) {
      if (!state.selectedAppId) return;
      showStatus(null, null);
      try {
        const res = await api(`https://aitopia.ai/api/apps/${state.selectedAppId}/versions/${versionId}/restore`, { method: 'POST' });
        state.app = res.app;
        state.currentVersion = res.currentVersion;
        el.definitionJson.value = JSON.stringify(state.currentVersion?.definition || {}, null, 2);
        showStatus('success', `Restored version v${res.currentVersion?.version ?? '?'}`);
        await refreshApps();
      } catch (e) {
        showStatus('error', e.message || 'Restore failed');
      }
    }

    function renderVersions() {
      if (!state.versions.length) {
        el.versionsBox.innerHTML = `<div class="hint">No versions found.</div>`;
        return;
      }

      const currentId = state.currentVersion?.id;
      const items = state.versions.map(v => {
        const isCurrent = v.id === currentId;
        const createdAt = v.createdAt ? new Date(v.createdAt).toLocaleString() : '';
        return `
          <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; border-bottom:1px solid hsl(var(--aifnmjmchg-m-border)); padding:10px 0;">
            <div>
              <div style="font-weight:600;">v${escapeHtml(v.version)} ${isCurrent ? '<span class="badge">current</span>' : ''}</div>
              <div class="hint">${escapeHtml(createdAt)} · ${escapeHtml(v.createdByReason || '')}</div>
            </div>
            <button class="btn" data-restore="${escapeHtml(v.id)}" ${isCurrent ? 'disabled' : ''}>Restore</button>
          </div>
        `;
      }).join('');

      el.versionsBox.innerHTML = `
        <details open>
          <summary>Versions</summary>
          <div style="margin-top:10px;">
            ${items}
          </div>
        </details>
      `;

      el.versionsBox.querySelectorAll('button[data-restore]').forEach((btn) => {
        btn.addEventListener('click', () => restoreVersion(btn.getAttribute('data-restore')));
      });
    }

    el.refreshBtn.addEventListener('click', refreshApps);
    el.createBtn.addEventListener('click', createNewApp);
    el.saveBtn.addEventListener('click', saveVersion);
    el.loadVersionsBtn.addEventListener('click', loadVersions);

    refreshApps();