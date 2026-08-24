import { fetchHelper } from '../shared/fetch-helper.js';

export const USD_PER_CREDIT = 0.02;

const SIDEBAR_LINKS = [
  { key: 'dashboard', href: '/aitopia/marketplace/developers-dashboard.html', label: 'Overview' },
  { key: 'submit', href: '/aitopia/marketplace/developers-agents-submit.html', label: 'Submit Agent' },
  { key: 'agents', href: '/aitopia/marketplace/developers-agents.html', label: 'My Agents' },
  { key: 'keys', href: '/aitopia/marketplace/developers-keys.html', label: 'API Keys' },
  { key: 'earnings', href: '/aitopia/marketplace/developers-earnings.html', label: 'Earnings' },
];

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function formatCredits(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  return Math.trunc(n).toLocaleString();
}

export function creditsToUsd(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '$0.00';
  return `$${(n * USD_PER_CREDIT).toFixed(2)}`;
}

export function tierBadgeMeta(tier) {
  const normalized = String(tier || '').toLowerCase();
  if (normalized === 'trusted') return { label: 'Trusted', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' };
  if (normalized === 'verified') return { label: 'Verified', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300' };
  if (normalized === 'suspended') return { label: 'Suspended', cls: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300' };
  return { label: 'Sandbox', cls: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-700/40 dark:text-zinc-200' };
}

async function readJsonSafe(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text };
  }
}

export async function api(path, options = {}) {
  const response = await fetchHelper(path, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });
  const body = await readJsonSafe(response);
  return { response, body };
}

function toRedirectTarget() {
  const path = window.location.pathname || '/developers';
  const search = window.location.search || '';
  return `${path}${search}`;
}

function toLocalUser(payload) {
  const source = payload?.data?.user || payload?.data || payload?.user || payload;
  const user = source && typeof source === 'object' && !Array.isArray(source) ? source : null;
  if (!user) return null;
  if (!user.email && !user.id && !user.key) return null;
  return user;
}

export async function ensureSignedIn() {
  const { response, body } = await api('/auth/me', { method: 'GET' });
  const user = response.ok ? toLocalUser(body) : null;
  if (user) return user;
  location.href=`/aitopia/marketplace/login.html?redirect=${encodeURIComponent(toRedirectTarget())}`;
  return null;
}

export async function getDeveloperFromSession() {
  const { response, body } = await api('https://aitopia.ai/api/developers/me', { method: 'GET' });
  if (response.ok) {
    return { status: 200, developer: body?.developer || null };
  }
  return { status: response.status, developer: null, error: body?.error || null };
}

export async function ensureDeveloperSession(options = {}) {
  const user = await ensureSignedIn();
  if (!user) return null;

  const result = await getDeveloperFromSession();
  if (result.status === 200 && result.developer) {
    return result.developer;
  }

  if (result.status === 404 && options.allowUnregistered) {
    return null;
  }

  if (result.status === 404 || result.status === 403) {
    location.href="/aitopia/marketplace/developers-register.html";
    return null;
  }

  if (result.status === 401) {
    location.href=`/aitopia/marketplace/login.html?redirect=${encodeURIComponent(toRedirectTarget())}`;
    return null;
  }

  throw new Error(result?.error?.message || 'Failed to load developer session');
}

export function setStatusMessage(el, type, message) {
  if (!el) return;
  if (!message) {
    el.className = 'hidden';
    el.textContent = '';
    return;
  }

  const base = 'rounded-xl border px-4 py-3 text-sm';
  if (type === 'error') {
    el.className = `${base} border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300`;
  } else if (type === 'success') {
    el.className = `${base} border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300`;
  } else {
    el.className = `${base} border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300`;
  }
  el.textContent = String(message);
}

export function renderDeveloperSidebar(activeKey, developer) {
  const host = document.getElementById('developerSidebar');
  if (!host) return;

  const meta = tierBadgeMeta(developer?.tier);
  const displayName = escapeHtml(developer?.displayName || 'Developer');
  const namespace = escapeHtml(developer?.namespace || '');

  const links = SIDEBAR_LINKS
    .map((item) => {
      const active = item.key === activeKey;
      const cls = active
        ? 'bg-primary text-primary-foreground'
        : 'bg-secondary text-foreground hover:bg-secondary/70';
      return `<a href="${item.href}" class="w-full inline-flex items-center rounded-full px-4 py-2 text-sm font-medium transition-colors ${cls}">${item.label}</a>`;
    })
    .join('');

  host.innerHTML = `
    <div class="rounded-ios-2xl border border-border bg-card p-5 sticky top-24">
      <div class="flex items-center justify-between gap-2">
        <div class="text-sm font-semibold truncate">${displayName}</div>
        <span class="px-2 py-0.5 rounded-full text-[11px] font-semibold ${meta.cls}">${meta.label}</span>
      </div>
      <div class="mt-1 text-xs text-muted-foreground">dev.${namespace}.*</div>
      <div class="mt-4 flex flex-col gap-2">${links}</div>
    </div>
  `;
}

export function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function formatIsoDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}
