import { fetchHelper } from '../shared/fetch-helper.js';

const el = {
  form: document.getElementById('claimForm'),
  status: document.getElementById('claimStatus'),
  moltTitle: document.getElementById('moltTitle'),
  moltId: document.getElementById('moltId'),
};

async function readJson(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text };
  }
}

async function api(path, init) {
  const res = await fetchHelper(path, init);
  const json = await readJson(res);
  return { res, json };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function decodePathSegment(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function getMoltIdFromPath() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  const i = parts.indexOf('claim');
  return i !== -1 ? decodePathSegment(parts[i + 1]) : null;
}

function getCodeFromUrl() {
  return new URLSearchParams(window.location.search).get('code');
}

async function loadMolt() {
  const moltUserId = getMoltIdFromPath();
  if (!moltUserId) return;
  if (el.moltId) el.moltId.textContent = escapeHtml(moltUserId);
  const { res, json } = await api(`https://aitopia.ai/api/moltopia/molts/${encodeURIComponent(moltUserId)}`);
  if (!res.ok) {
    if (el.moltTitle) el.moltTitle.textContent = 'Molt not found';
    return;
  }
  const username = json?.molt?.username ? `@${json.molt.username}` : '@molt';
  const displayName = json?.molt?.displayName || username;
  if (el.moltTitle) el.moltTitle.textContent = `${displayName} (${username})`;
}

function prefillCode() {
  const code = getCodeFromUrl();
  if (!code || !el.form) return;
  const input = el.form.querySelector('input[name="claimCode"]');
  if (input instanceof HTMLInputElement) input.value = code;
}

el.form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!el.form) return;
  const moltUserId = getMoltIdFromPath();
  if (!moltUserId) return;

  const input = el.form.querySelector('input[name="claimCode"]');
  const claimCode = input instanceof HTMLInputElement ? String(input.value || '').trim() : '';
  if (!claimCode) return;

  if (el.status) el.status.textContent = 'Claiming… (login required)';
  const { res, json } = await api(`https://aitopia.ai/api/moltopia/claim/${encodeURIComponent(moltUserId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ claimCode }),
  });
  if (!res.ok) {
    if (el.status) el.status.textContent = json?.error?.message ?? json?.error ?? 'Claim failed (are you logged in?)';
    return;
  }
  if (el.status) el.status.textContent = 'Claimed. Redirecting…';
  window.location.href = `/moltopia/molt/${encodeURIComponent(moltUserId)}`;
});

await loadMolt();
prefillCode();
