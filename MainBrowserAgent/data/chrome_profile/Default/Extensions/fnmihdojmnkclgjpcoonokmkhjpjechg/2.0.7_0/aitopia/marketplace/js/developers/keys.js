import {
  api,
  asArray,
  ensureDeveloperSession,
  escapeHtml,
  formatIsoDate,
  renderDeveloperSidebar,
  setStatusMessage,
} from './common.js';

const messageEl = document.getElementById('keysMessage');
const listEl = document.getElementById('keysList');
const form = document.getElementById('createKeyForm');
const labelInput = document.getElementById('keyLabel');
const generatedWrap = document.getElementById('generatedKeyWrap');
const generatedValue = document.getElementById('generatedKeyValue');

async function loadKeys() {
  const { response, body } = await api('https://aitopia.ai/api/developers/me/keys', { method: 'GET' });
  if (!response.ok) {
    throw new Error(body?.error?.message || 'Failed to load API keys');
  }

  const keys = asArray(body?.keys);
  if (!keys.length) {
    listEl.innerHTML = '<div class="text-sm text-muted-foreground">No API keys yet.</div>';
    return;
  }

  listEl.innerHTML = keys
    .map((item) => `
      <div class="rounded-xl border border-border p-4 flex items-start justify-between gap-3">
        <div>
          <div class="text-sm font-semibold">${escapeHtml(item.keyPrefix || '-')}</div>
          <div class="text-xs text-muted-foreground mt-1">Label: ${escapeHtml(item.label || '-')}</div>
          <div class="text-xs text-muted-foreground">Created: ${escapeHtml(formatIsoDate(item.createdAt))}</div>
          <div class="text-xs text-muted-foreground">Last used: ${escapeHtml(formatIsoDate(item.lastUsedAt))}</div>
        </div>
        <button class="px-3 py-1.5 rounded-full text-xs font-semibold bg-red-500/10 text-red-600 hover:bg-red-500/20" data-revoke-id="${escapeHtml(item.id)}">Revoke</button>
      </div>
    `)
    .join('');

  listEl.querySelectorAll('[data-revoke-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      const keyId = String(button.getAttribute('data-revoke-id') || '');
      if (!keyId) return;
      setStatusMessage(messageEl, 'info', 'Revoking key...');
      const { response: revokeRes, body: revokeBody } = await api(`https://aitopia.ai/api/developers/me/keys/${encodeURIComponent(keyId)}`, {
        method: 'DELETE',
      });
      if (!revokeRes.ok) {
        setStatusMessage(messageEl, 'error', revokeBody?.error?.message || 'Failed to revoke key');
        return;
      }
      setStatusMessage(messageEl, 'success', 'Key revoked.');
      await loadKeys();
    });
  });
}

async function createKey(event) {
  event.preventDefault();
  const label = String(labelInput?.value || '').trim();
  if (!label) {
    setStatusMessage(messageEl, 'error', 'Key label is required.');
    return;
  }

  setStatusMessage(messageEl, 'info', 'Creating API key...');
  const { response, body } = await api('https://aitopia.ai/api/developers/me/keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ label }),
  });

  if (!response.ok) {
    setStatusMessage(messageEl, 'error', body?.error?.message || 'Failed to create key');
    return;
  }

  const apiKey = String(body?.apiKey || '');
  generatedWrap.classList.remove('hidden');
  generatedValue.textContent = apiKey;
  labelInput.value = '';
  setStatusMessage(messageEl, 'success', 'API key created. Copy it now, it will not be shown again.');
  await loadKeys();
}

document.getElementById('copyGeneratedKeyBtn')?.addEventListener('click', async () => {
  const value = String(generatedValue?.textContent || '').trim();
  if (!value) return;
  await navigator.clipboard.writeText(value).catch(() => {});
});

form?.addEventListener('submit', createKey);

async function init() {
  const developer = await ensureDeveloperSession();
  if (!developer) return;
  renderDeveloperSidebar('keys', developer);
  await loadKeys();
}

void init().catch((error) => {
  setStatusMessage(messageEl, 'error', error instanceof Error ? error.message : 'Failed to initialize API key page.');
});
