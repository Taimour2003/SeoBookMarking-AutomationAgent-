import { api, ensureSignedIn, ensureDeveloperSession, setStatusMessage, escapeHtml } from './common.js';

const form = document.getElementById('developerRegisterForm');
const namespaceInput = document.getElementById('namespace');
const namespacePreview = document.getElementById('namespacePreview');
const messageEl = document.getElementById('registerMessage');
const submitBtn = document.getElementById('registerSubmitBtn');
const websiteInput = document.getElementById('websiteUrl');
const HOST_LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

function normalizeNamespace(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 64);
}

function validateNamespace(value) {
  if (!value) return 'Namespace is required';
  if (!/^[a-z][a-z0-9-]{2,63}$/.test(value)) {
    return 'Namespace must start with a letter and be 3-64 chars (a-z, 0-9, -).';
  }
  return null;
}

function normalizeWebsiteUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return { value: undefined };

  if (raw.length > 2048) {
    return { error: 'Website URL is too long (max 2048 characters).' };
  }

  if (/\s/.test(raw)) {
    return { error: 'Website URL cannot contain spaces.' };
  }

  const schemeMatch = raw.match(/^([a-z][a-z0-9+.-]*):/i);
  if (schemeMatch && !/^https?$/i.test(schemeMatch[1])) {
    return { error: 'Website URL must use http:// or https://.' };
  }

  const normalized = schemeMatch ? raw : `https://${raw}`;

  let parsed;
  try {
    parsed = new URL(normalized);
  } catch {
    return { error: 'Website URL looks invalid. Use something like acme.ai or https://acme.ai.' };
  }

  if (!parsed.hostname) {
    return { error: 'Website URL must include a valid domain.' };
  }

  const hostname = parsed.hostname.toLowerCase();
  const isIpv4 = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
  const isIpv6 = hostname.includes(':');
  const isSingleLabelHost = HOST_LABEL_RE.test(hostname);
  if (!hostname.includes('.') && hostname !== 'localhost' && !isIpv4 && !isIpv6 && !isSingleLabelHost) {
    return { error: 'Website URL must include a valid domain (for example: acme.ai or my-company).' };
  }

  return { value: normalized };
}

function updatePreview() {
  const normalized = normalizeNamespace(namespaceInput?.value || '');
  if (namespaceInput && namespaceInput.value !== normalized) {
    namespaceInput.value = normalized;
  }
  if (namespacePreview) {
    namespacePreview.textContent = normalized ? `dev.${normalized}.your-agent` : 'dev.your-namespace.your-agent';
  }
}

async function init() {
  const user = await ensureSignedIn();
  if (!user) return;

  // Keep URL validation logic under app control instead of browser-native strictness.
  if (websiteInput && websiteInput.type !== 'text') {
    websiteInput.type = 'text';
  }

  const existing = await ensureDeveloperSession({ allowUnregistered: true });
  if (existing) {
    location.href="/aitopia/marketplace/developers-dashboard.html";
    return;
  }

  updatePreview();
}

async function handleSubmit(event) {
  event.preventDefault();
  if (!form) return;

  const websiteUrlResult = normalizeWebsiteUrl(websiteInput?.value || '');
  if (websiteUrlResult.error) {
    setStatusMessage(messageEl, 'error', websiteUrlResult.error);
    return;
  }

  const payload = {
    displayName: String(document.getElementById('displayName')?.value || '').trim(),
    email: String(document.getElementById('email')?.value || '').trim(),
    namespace: normalizeNamespace(namespaceInput?.value || ''),
    websiteUrl: websiteUrlResult.value,
    description: String(document.getElementById('description')?.value || '').trim() || undefined,
  };

  const acceptedTerms = Boolean(document.getElementById('acceptTerms')?.checked);
  const acceptedRevenue = Boolean(document.getElementById('acceptRevenue')?.checked);

  if (!payload.displayName || !payload.email) {
    setStatusMessage(messageEl, 'error', 'Display name and email are required.');
    return;
  }

  const namespaceError = validateNamespace(payload.namespace);
  if (namespaceError) {
    setStatusMessage(messageEl, 'error', namespaceError);
    return;
  }

  if (!acceptedTerms || !acceptedRevenue) {
    setStatusMessage(messageEl, 'error', 'You must accept the terms and revenue policy to continue.');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating account...';
  setStatusMessage(messageEl, 'info', 'Creating developer account...');

  try {
    const { response, body } = await api('https://aitopia.ai/api/developers/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      setStatusMessage(messageEl, 'success', 'Developer account created. Redirecting to dashboard...');
      window.setTimeout(() => {
        location.href="/aitopia/marketplace/developers-dashboard.html?welcome=1";
      }, 600);
      return;
    }

    if (response.status === 409) {
      setStatusMessage(messageEl, 'info', 'Developer account already exists. Redirecting to dashboard...');
      window.setTimeout(() => {
        location.href="/aitopia/marketplace/developers-dashboard.html";
      }, 600);
      return;
    }

    const msg = body?.error?.message || 'Registration failed.';
    setStatusMessage(messageEl, 'error', msg);
  } catch (error) {
    setStatusMessage(messageEl, 'error', error instanceof Error ? error.message : 'Registration failed.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Create Developer Account';
  }
}

namespaceInput?.addEventListener('input', updatePreview);
form?.addEventListener('submit', handleSubmit);

void init().catch((error) => {
  setStatusMessage(messageEl, 'error', error instanceof Error ? error.message : 'Failed to initialize page.');
});
