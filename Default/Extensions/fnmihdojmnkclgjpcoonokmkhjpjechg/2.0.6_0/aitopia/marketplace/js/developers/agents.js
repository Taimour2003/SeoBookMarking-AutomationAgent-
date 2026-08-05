import {
  api,
  asArray,
  ensureDeveloperSession,
  escapeHtml,
  formatIsoDate,
  renderDeveloperSidebar,
  setStatusMessage,
} from './common.js';

const messageEl = document.getElementById('agentsMessage');
const submissionsEl = document.getElementById('submissionList');
const publishedEl = document.getElementById('publishedAgentsList');

function renderSubmissionRows(submissions) {
  if (!submissions.length) {
    submissionsEl.innerHTML = '<div class="text-sm text-muted-foreground">No submissions yet.</div>';
    return;
  }

  submissionsEl.innerHTML = submissions
    .map((item) => `
      <div class="rounded-xl border border-border p-4">
        <div class="text-sm font-semibold truncate">${escapeHtml(item?.agent_id || '-')}</div>
        <div class="mt-1 text-xs text-muted-foreground">Version: ${escapeHtml(item?.version || '-')}</div>
        <div class="mt-1 text-xs text-muted-foreground">Status: ${escapeHtml(String(item?.status || 'pending').replaceAll('_', ' '))}</div>
        <div class="mt-1 text-xs text-muted-foreground">Submitted: ${escapeHtml(formatIsoDate(item?.submitted_at))}</div>
        <div class="mt-1 text-xs text-muted-foreground">Review notes: ${escapeHtml(item?.review_notes || '-')}</div>
      </div>
    `)
    .join('');
}

function renderPublishedRows(agents) {
  if (!agents.length) {
    publishedEl.innerHTML = '<div class="text-sm text-muted-foreground">No registered agents yet.</div>';
    return;
  }

  publishedEl.innerHTML = agents
    .map((agent) => {
      const quality = Number(agent?.quality_score || 0);
      return `
        <div class="rounded-xl border border-border p-4">
          <div class="text-sm font-semibold truncate">${escapeHtml(agent?.name || agent?.id || '-')}</div>
          <div class="mt-1 text-xs text-muted-foreground">Agent ID: ${escapeHtml(agent?.id || '-')}</div>
          <div class="mt-1 text-xs text-muted-foreground">Status: ${escapeHtml(agent?.status || 'pending')} | Enabled: ${Number(agent?.enabled || 0) ? 'Yes' : 'No'} | Published: ${Number(agent?.published || 0) ? 'Yes' : 'No'}</div>
          <div class="mt-1 text-xs text-muted-foreground">Quality score: ${Number.isFinite(quality) ? quality.toFixed(1) : '-'} / 100</div>
          <div class="mt-1 text-xs text-muted-foreground">Updated: ${escapeHtml(formatIsoDate(agent?.updated_at || agent?.updatedAt))}</div>
        </div>
      `;
    })
    .join('');
}

async function loadData() {
  setStatusMessage(messageEl, 'info', 'Loading agents and submissions...');

  const [submissionsRes, agentsRes] = await Promise.all([
    api('https://aitopia.ai/api/developers/agents/submissions', { method: 'GET' }),
    api('https://aitopia.ai/api/developers/me/agents', { method: 'GET' }),
  ]);

  if (!submissionsRes.response.ok) {
    throw new Error(submissionsRes.body?.error?.message || 'Failed to load submissions');
  }

  if (!agentsRes.response.ok) {
    throw new Error(agentsRes.body?.error?.message || 'Failed to load agents');
  }

  renderSubmissionRows(asArray(submissionsRes.body?.submissions));
  renderPublishedRows(asArray(agentsRes.body?.agents));
  setStatusMessage(messageEl, null, '');
}

async function init() {
  const developer = await ensureDeveloperSession();
  if (!developer) return;
  renderDeveloperSidebar('agents', developer);
  await loadData();
}

document.getElementById('refreshAgentsBtn')?.addEventListener('click', () => {
  void loadData().catch((error) => {
    setStatusMessage(messageEl, 'error', error instanceof Error ? error.message : 'Failed to refresh data.');
  });
});

void init().catch((error) => {
  setStatusMessage(messageEl, 'error', error instanceof Error ? error.message : 'Failed to initialize agents page.');
});
