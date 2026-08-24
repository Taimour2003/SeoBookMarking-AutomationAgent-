import {
  api,
  asArray,
  ensureDeveloperSession,
  escapeHtml,
  formatCredits,
  formatIsoDate,
  renderDeveloperSidebar,
  setStatusMessage,
} from './common.js';

const messageEl = document.getElementById('dashboardMessage');

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(value);
}

function renderRecentSubmissions(submissions) {
  const host = document.getElementById('recentSubmissions');
  if (!host) return;

  if (!submissions.length) {
    host.innerHTML = '<div class="text-sm text-muted-foreground">No submissions yet.</div>';
    return;
  }

  host.innerHTML = submissions
    .slice(0, 5)
    .map((item) => {
      const status = escapeHtml(String(item?.status || 'pending').replaceAll('_', ' '));
      return `
        <div class="rounded-xl border border-border p-3">
          <div class="text-sm font-semibold truncate">${escapeHtml(item?.agent_id || item?.agentId || '-')}</div>
          <div class="mt-1 text-xs text-muted-foreground">Status: ${status}</div>
          <div class="mt-1 text-xs text-muted-foreground">Submitted: ${escapeHtml(formatIsoDate(item?.submitted_at || item?.submittedAt))}</div>
        </div>
      `;
    })
    .join('');
}

function renderRecentAgents(agents) {
  const host = document.getElementById('recentAgents');
  if (!host) return;

  if (!agents.length) {
    host.innerHTML = '<div class="text-sm text-muted-foreground">No approved agents yet.</div>';
    return;
  }

  host.innerHTML = agents
    .slice(0, 5)
    .map((agent) => {
      const quality = Number(agent?.quality_score || 0);
      return `
        <div class="rounded-xl border border-border p-3">
          <div class="text-sm font-semibold truncate">${escapeHtml(agent?.name || agent?.id || '-')}</div>
          <div class="mt-1 text-xs text-muted-foreground">Status: ${escapeHtml(agent?.status || 'pending')} | Published: ${Number(agent?.published || 0) ? 'Yes' : 'No'}</div>
          <div class="mt-1 text-xs text-muted-foreground">Quality: ${Number.isFinite(quality) ? quality.toFixed(1) : '-'} / 100</div>
        </div>
      `;
    })
    .join('');
}

async function init() {
  const developer = await ensureDeveloperSession();
  if (!developer) return;

  renderDeveloperSidebar('dashboard', developer);
  setText('developerName', developer.displayName || 'Developer');
  setText('developerNamespace', `dev.${developer.namespace}.*`);

  setStatusMessage(messageEl, 'info', 'Loading dashboard...');

  const [summaryRes, agentsRes, submissionsRes] = await Promise.all([
    api('https://aitopia.ai/api/developers/me/earnings/summary', { method: 'GET' }),
    api('https://aitopia.ai/api/developers/me/agents', { method: 'GET' }),
    api('https://aitopia.ai/api/developers/agents/submissions', { method: 'GET' }),
  ]);

  if (!summaryRes.response.ok) {
    throw new Error(summaryRes.body?.error?.message || 'Failed to load dashboard summary');
  }

  const summary = summaryRes.body?.summary || {};
  const agents = agentsRes.response.ok ? asArray(agentsRes.body?.agents) : [];
  const submissions = submissionsRes.response.ok ? asArray(submissionsRes.body?.submissions) : [];

  setText('statRuns', formatCredits(agents.reduce((sum, item) => sum + Number(item?.total_runs || 0), 0)));
  setText('statEarned', formatCredits(summary.allTime || 0));
  setText('statAvailable', formatCredits(summary.available || 0));
  setText('statEscrowed', formatCredits(summary.escrowed || 0));
  setText('statAgents', formatCredits(agents.length));
  setText('statPending', formatCredits(submissions.filter((item) => String(item?.status || '').includes('review') || String(item?.status || '') === 'pending').length));

  renderRecentAgents(agents);
  renderRecentSubmissions(submissions);
  setStatusMessage(messageEl, null, '');
}

void init().catch((error) => {
  setStatusMessage(messageEl, 'error', error instanceof Error ? error.message : 'Failed to load dashboard.');
});
