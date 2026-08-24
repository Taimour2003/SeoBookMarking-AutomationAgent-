import { api } from './common.js';

function getUserFromAuthPayload(payload) {
  const source = payload?.data?.user || payload?.data || payload?.user || payload;
  if (!source || typeof source !== 'object' || Array.isArray(source)) return null;
  if (!source.email && !source.id && !source.key) return null;
  return source;
}

function setPrimaryCta(href, text) {
  const cta = document.getElementById('developerPrimaryCta');
  if (!cta) return;
  cta.setAttribute('href', href);
  cta.textContent = text;
}

async function init() {
  const authRes = await api('/auth/me', { method: 'GET' });
  const user = authRes.response.ok ? getUserFromAuthPayload(authRes.body) : null;

  if (!user) {
    setPrimaryCta('/login?redirect=%2Fdevelopers%2Fregister', 'Sign In to Join');
    return;
  }

  const devRes = await api('https://aitopia.ai/api/developers/me', { method: 'GET' });
  if (devRes.response.ok) {
    setPrimaryCta('/aitopia/marketplace/developers-dashboard.html', 'Go to Dashboard');
    return;
  }

  setPrimaryCta('/aitopia/marketplace/developers-register.html', 'Join as Developer');
}

void init().catch(() => {
  setPrimaryCta('/aitopia/marketplace/developers-register.html', 'Join as Developer');
});
