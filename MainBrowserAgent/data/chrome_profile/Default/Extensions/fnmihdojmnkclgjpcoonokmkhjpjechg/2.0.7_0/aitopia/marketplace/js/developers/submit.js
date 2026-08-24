import { api, ensureDeveloperSession, renderDeveloperSidebar, setStatusMessage } from './common.js';

const messageEl = document.getElementById('submitMessage');
const form = document.getElementById('submissionForm');
const submitButton = document.getElementById('submitAgentBtn');
const namespacePrefixEl = document.getElementById('namespacePrefix');
const fullAgentIdEl = document.getElementById('fullAgentIdPreview');

let currentNamespace = '';

function toSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
}

function updateAgentPreview() {
  const suffixInput = document.getElementById('agentSuffix');
  const suffix = toSlug(suffixInput?.value || '');
  if (suffixInput && suffixInput.value !== suffix) {
    suffixInput.value = suffix;
  }

  const fullAgentId = suffix ? `dev.${currentNamespace}.${suffix}` : `dev.${currentNamespace}.<agent-id>`;
  if (fullAgentIdEl) fullAgentIdEl.textContent = fullAgentId;
}

function parseTags(raw) {
  return String(raw || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 15);
}

function validateInput(payload) {
  if (!payload.agentIdSuffix) return 'Agent ID suffix is required.';
  if (!payload.version) return 'Version is required.';
  if (!payload.endpointUrl) return 'Endpoint URL is required.';
  if (!payload.name) return 'Agent name is required.';
  if (!payload.description) return 'Description is required.';
  if (!Number.isFinite(payload.fixedCreditsPerRun) || payload.fixedCreditsPerRun < 5) {
    return 'BYOM minimum is 5 credits per run.';
  }
  return null;
}

async function submitAgent(event) {
  event.preventDefault();
  const formData = new FormData(form);

  const payload = {
    agentIdSuffix: toSlug(formData.get('agentSuffix')),
    version: String(formData.get('version') || '').trim(),
    endpointUrl: String(formData.get('endpointUrl') || '').trim(),
    fixedCreditsPerRun: Number(formData.get('fixedCreditsPerRun') || 0),
    name: String(formData.get('name') || '').trim(),
    description: String(formData.get('description') || '').trim(),
    category: String(formData.get('category') || 'general').trim(),
    tags: parseTags(formData.get('tags')),
  };

  const validationError = validateInput(payload);
  if (validationError) {
    setStatusMessage(messageEl, 'error', validationError);
    return;
  }

  const agentId = `dev.${currentNamespace}.${payload.agentIdSuffix}`;

  submitButton.disabled = true;
  setStatusMessage(messageEl, 'info', 'Submitting agent for review...');

  try {
    const { response, body } = await api('https://aitopia.ai/api/developers/agents/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        agentId,
        version: payload.version,
        agentType: 'remote_http',
        endpointUrl: payload.endpointUrl,
        pricing: {
          mode: 'byom',
          fixedCreditsPerRun: payload.fixedCreditsPerRun,
        },
        metadata: {
          name: payload.name,
          description: payload.description,
          category: payload.category,
          tags: payload.tags,
        },
      }),
    });

    if (!response.ok) {
      setStatusMessage(messageEl, 'error', body?.error?.message || 'Submission failed.');
      return;
    }

    const submissionId = body?.submission?.id || '-';
    setStatusMessage(messageEl, 'success', `Submission created (${submissionId}). Redirecting to My Agents...`);
    window.setTimeout(() => {
      location.href="/aitopia/marketplace/developers-agents.html";
    }, 800);
  } catch (error) {
    setStatusMessage(messageEl, 'error', error instanceof Error ? error.message : 'Submission failed.');
  } finally {
    submitButton.disabled = false;
  }
}

async function init() {
  const developer = await ensureDeveloperSession();
  if (!developer) return;

  currentNamespace = String(developer.namespace || '').trim();
  renderDeveloperSidebar('submit', developer);

  if (namespacePrefixEl) namespacePrefixEl.textContent = `dev.${currentNamespace}.`;
  updateAgentPreview();
}

form?.addEventListener('submit', submitAgent);
document.getElementById('agentSuffix')?.addEventListener('input', updateAgentPreview);

void init().catch((error) => {
  setStatusMessage(messageEl, 'error', error instanceof Error ? error.message : 'Failed to initialize submission page.');
});
