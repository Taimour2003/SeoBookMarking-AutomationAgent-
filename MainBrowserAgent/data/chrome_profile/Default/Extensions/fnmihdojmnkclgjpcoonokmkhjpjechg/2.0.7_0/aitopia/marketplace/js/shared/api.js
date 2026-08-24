import { fetchHelper } from './fetch-helper.js';

async function readJson(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text };
  }
}

export async function getStoreAgent(agentId) {
  const res = await fetchHelper(`https://aitopia.ai/api/store/${encodeURIComponent(agentId)}`);
  const json = await readJson(res);
  if (!res.ok) {
    const message = json?.error || `Failed to load agent (${res.status})`;
    throw new Error(message);
  }
  return json;
}

export async function getAgentSchema(agentId, options) {
  const ui = options?.ui;
  const qs = typeof ui === 'string' && ui ? `?ui=${encodeURIComponent(ui)}` : '';
  const res = await fetchHelper(`https://aitopia.ai/api/store/${encodeURIComponent(agentId)}/schema/json${qs}`);
  const json = await readJson(res);
  if (!res.ok) {
    const message = json?.error?.message || json?.error || `Failed to load schema (${res.status})`;
    throw new Error(message);
  }
  return json;
}

export async function runStoreAgent(agentId, body, options) {
  const extraHeaders = options?.headers && typeof options.headers === 'object' ? options.headers : {};
  const { headers: _ignored, ...restOptions } = options || {};

  const res = await fetchHelper(`https://aitopia.ai/api/store/${encodeURIComponent(agentId)}/run`, {
    method: 'POST',
    ...restOptions,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify(body),
  });
  const json = await readJson(res);
  return { res, json };
}

export async function getJob(jobId, options) {
  const fetchOptions = options && typeof options === 'object' ? { ...options } : {};
  if (!Object.prototype.hasOwnProperty.call(fetchOptions, 'cache')) {
    fetchOptions.cache = 'no-store';
  }

  //const res = await fetch(`https://aitopia.ai/jobs/${encodeURIComponent(jobId)}`, fetchOptions);
  const res = await fetchHelper(`https://aitopia.ai/jobs/${encodeURIComponent(jobId)}`, fetchOptions);
  const json = await readJson(res);
  if (!res.ok) {
    const rawMessage =
      json?.error?.message
      || json?.error
      || `Failed to load job (${res.status})`;
    const details = json?.details || json?.error?.details;
    const message = details && typeof details === 'string' && String(rawMessage).toLowerCase().includes('bad gateway')
      ? `${rawMessage}: ${details}`
      : String(rawMessage);
    const err = new Error(message);
    err.status = res.status;
    err.url = res.url;
    throw err;
  }
  return json;
}

export async function getRun(runId, options) {
  const fetchOptions = options && typeof options === 'object' ? { ...options } : {};
  if (!Object.prototype.hasOwnProperty.call(fetchOptions, 'cache')) {
    fetchOptions.cache = 'no-store';
  }

  const res = await fetchHelper(`https://aitopia.ai/runs/${encodeURIComponent(runId)}`, fetchOptions);
  const json = await readJson(res);
  if (!res.ok) {
    const rawMessage =
      json?.error?.message
      || json?.error
      || `Failed to load run (${res.status})`;
    const err = new Error(String(rawMessage));
    err.status = res.status;
    err.url = res.url;
    throw err;
  }
  return json;
}

export async function checkAuthOrRedirect() {
  const profile = window.AitopiaCache?.getUserProfile?.();
  if (profile) return true;

  try {
    const res = await fetch('https://aitopia.ai/auth/me', { method: 'GET', credentials: 'include' });
    if (res.ok) {
      const json = await res.json();
      console.log(res);
      const userData = json?.data?.user || json?.data || json?.user || json;
      const isLoggedIn = userData && !Array.isArray(userData) && typeof userData === 'object' && (userData.email || userData.key);
      if (isLoggedIn) {
        // Cache it for subsequent checks
        const email = userData.email || '';
        const name = userData.name || '';
        const lastname = userData.lastname || '';
        const fullName = [name, lastname].filter(Boolean).join(' ') || (email ? email.split('@')[0] : 'User');
        const plan = json?.data?.plan || json?.data?.licences?.plan_type || userData.plan || userData.planName || '';
        const licences = json?.data?.licences || null;
        window.AitopiaCache?.setUserProfile?.({
          fullName,
          email,
          plan,
          licences
        });
        return true;
      }
    }
  } catch (err) {
    console.error('[api] Auth check error:', err);
  }

  // Not logged in, redirect
  const currentUrl = window.location.pathname + window.location.search;
  location.href=`/aitopia/marketplace/login.html?redirect=${encodeURIComponent(currentUrl)}`;
  return false;
}
