import {
  api,
  asArray,
  creditsToUsd,
  ensureDeveloperSession,
  escapeHtml,
  formatCredits,
  formatIsoDate,
  renderDeveloperSidebar,
  setStatusMessage,
} from './common.js';

const messageEl = document.getElementById('earningsMessage');

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(value);
}

function renderByAgent(items) {
  const host = document.getElementById('byAgentList');
  if (!host) return;

  if (!items.length) {
    host.innerHTML = '<div class="text-sm text-muted-foreground">No per-agent earnings yet.</div>';
    return;
  }

  host.innerHTML = items
    .map((row) => `
      <div class="rounded-xl border border-border p-4">
        <div class="text-sm font-semibold truncate">${escapeHtml(row?.agent_id || '-')}</div>
        <div class="mt-1 text-xs text-muted-foreground">Runs: ${formatCredits(row?.runs || 0)} | Earned: ${formatCredits(row?.developer_credits || 0)} credits</div>
        <div class="mt-1 text-xs text-muted-foreground">Last run: ${escapeHtml(formatIsoDate(row?.last_run_at))}</div>
      </div>
    `)
    .join('');
}

function renderHistory(entries) {
  const host = document.getElementById('historyList');
  if (!host) return;

  if (!entries.length) {
    host.innerHTML = '<div class="text-sm text-muted-foreground">No earnings history yet.</div>';
    return;
  }

  host.innerHTML = entries
    .map((row) => `
      <div class="rounded-xl border border-border p-4 flex items-start justify-between gap-3">
        <div>
          <div class="text-sm font-semibold truncate">${escapeHtml(row?.agent_id || '-')}</div>
          <div class="mt-1 text-xs text-muted-foreground">Status: ${escapeHtml(row?.settlement_status || '-')}</div>
          <div class="mt-1 text-xs text-muted-foreground">Created: ${escapeHtml(formatIsoDate(row?.created_at))}</div>
          <div class="mt-1 text-xs text-muted-foreground">Run: ${escapeHtml(row?.run_id || '-')}</div>
        </div>
        <div class="text-right">
          <div class="text-sm font-semibold text-emerald-500">+${formatCredits(row?.developer_credits || 0)} cr</div>
          <div class="mt-1 text-xs text-muted-foreground">${creditsToUsd(row?.developer_credits || 0)}</div>
        </div>
      </div>
    `)
    .join('');
}

async function init() {
  const developer = await ensureDeveloperSession();
  if (!developer) return;
  renderDeveloperSidebar('earnings', developer);

  setStatusMessage(messageEl, 'info', 'Loading earnings...');

  const [summaryRes, byAgentRes, historyRes] = await Promise.all([
    api('https://aitopia.ai/api/developers/me/earnings/summary', { method: 'GET' }),
    api('https://aitopia.ai/api/developers/me/earnings/by-agent', { method: 'GET' }),
    api('https://aitopia.ai/api/developers/me/earnings/history?limit=50', { method: 'GET' }),
  ]);

  if (!summaryRes.response.ok) {
    throw new Error(summaryRes.body?.error?.message || 'Failed to load earnings summary.');
  }

  const summary = summaryRes.body?.summary || {};
  setText('earningsToday', `${formatCredits(summary.today || 0)} (${creditsToUsd(summary.today || 0)})`);
  setText('earningsWeek', `${formatCredits(summary.week || 0)} (${creditsToUsd(summary.week || 0)})`);
  setText('earningsMonth', `${formatCredits(summary.month || 0)} (${creditsToUsd(summary.month || 0)})`);
  setText('earningsAllTime', `${formatCredits(summary.allTime || 0)} (${creditsToUsd(summary.allTime || 0)})`);
  setText('balanceAvailable', `${formatCredits(summary.available || 0)} (${creditsToUsd(summary.available || 0)})`);
  setText('balanceEscrowed', `${formatCredits(summary.escrowed || 0)} (${creditsToUsd(summary.escrowed || 0)})`);
  setText('balancePending', `${formatCredits(summary.pendingCost || 0)} (${creditsToUsd(summary.pendingCost || 0)})`);

  renderByAgent(byAgentRes.response.ok ? asArray(byAgentRes.body?.agents) : []);
  renderHistory(historyRes.response.ok ? asArray(historyRes.body?.entries) : []);

  setStatusMessage(messageEl, null, '');
}

void init().catch((error) => {
  setStatusMessage(messageEl, 'error', error instanceof Error ? error.message : 'Failed to load earnings page.');
});
