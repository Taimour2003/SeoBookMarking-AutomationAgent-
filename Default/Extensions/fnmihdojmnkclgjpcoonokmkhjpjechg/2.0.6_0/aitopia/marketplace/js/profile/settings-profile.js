import { fetchHelper } from '../shared/fetch-helper.js';

const el = {
  notice: document.getElementById('notice'),
  form: document.getElementById('form'),
  username: document.getElementById('username'),
  usernameHint: document.getElementById('usernameHint'),
  displayName: document.getElementById('displayName'),
  bio: document.getElementById('bio'),
  websiteUrl: document.getElementById('websiteUrl'),
  avatarUrl: document.getElementById('avatarUrl'),
  avatarFile: document.getElementById('avatarFile'),
  avatarFileBtn: document.getElementById('avatarFileBtn'),
  avatarFileName: document.getElementById('avatarFileName'),
  avatarPreview: document.getElementById('avatarPreview'),
  avatarFallback: document.getElementById('avatarFallback'),
  avatarUploadStatus: document.getElementById('avatarUploadStatus'),
  saveBtn: document.getElementById('saveBtn'),
  viewProfileLink: document.getElementById('viewProfileLink'),
  deleteAccountBtn: document.getElementById('deleteAccountBtn'),
};

function setNotice(message, tone = 'info') {
  if (!el.notice) return;
  if (!message) {
    el.notice.classList.add('hidden');
    el.notice.textContent = '';
    return;
  }
  el.notice.classList.remove('hidden');
  el.notice.classList.toggle('text-red-500', tone === 'error');
  el.notice.classList.toggle('text-muted-foreground', tone !== 'error');
  el.notice.textContent = message;
}

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
  const res = await fetchHelper(path, { ...init, credentials: 'include' });
  const json = await readJson(res);
  return { res, json };
}

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase();
}

function setAvatarPreview(url) {
  const value = String(url || '').trim();
  if (!el.avatarPreview || !el.avatarFallback) return;
  if (!value) {
    el.avatarPreview.classList.add('hidden');
    el.avatarFallback.classList.remove('hidden');
    el.avatarPreview.src = '';
    return;
  }
  el.avatarPreview.src = value;
  el.avatarPreview.classList.remove('hidden');
  el.avatarFallback.classList.add('hidden');
}

async function loadProfile() {
  const { res, json } = await api('https://aitopia.ai/api/users/me', { method: 'GET' });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      setNotice('Sign in to edit your profile.', 'error');
      if (el.form) el.form.classList.add('hidden');
      return;
    }
    const msg = json?.error?.message || json?.error || `Failed to load profile (${res.status})`;
    setNotice(String(msg), 'error');
    return;
  }

  const profile = json?.profile;
  if (profile?.username && el.viewProfileLink) {
    el.viewProfileLink.href = `/aitopia/marketplace/profile.html?username=${encodeURIComponent(profile.username)}`;
    el.viewProfileLink.classList.remove('hidden');
    el.viewProfileLink.classList.add('inline-flex');
  }

  if (el.username) el.username.value = profile?.username || '';
  if (el.displayName) el.displayName.value = profile?.displayName || '';
  if (el.bio) el.bio.value = profile?.bio || '';
  if (el.websiteUrl) el.websiteUrl.value = profile?.websiteUrl || '';
  if (el.avatarUrl) el.avatarUrl.value = profile?.avatarUrl || '';
  setAvatarPreview(profile?.avatarUrl || '');
}

let usernameCheckTimer = null;
async function checkUsernameAvailability() {
  if (!el.username || !el.usernameHint) return;
  const username = normalizeUsername(el.username.value);
  if (!username) {
    el.usernameHint.textContent = '3–30 chars: lowercase letters, numbers, dot, underscore.';
    el.usernameHint.className = 'mt-2 text-xs text-muted-foreground';
    return;
  }

  const { res, json } = await api(`https://aitopia.ai/api/users/check/${encodeURIComponent(username)}`, { method: 'GET' });
  if (!res.ok) return;
  const available = Boolean(json?.available);
  el.usernameHint.textContent = available ? 'Username is available.' : 'Username is taken or reserved.';
  el.usernameHint.className = available ? 'mt-2 text-xs text-green-500' : 'mt-2 text-xs text-red-500';
}

async function uploadAvatar(file) {
  if (!file) return null;
  if (!el.avatarUploadStatus) return null;

  el.avatarUploadStatus.textContent = 'Uploading…';
  try {
    const filename = encodeURIComponent(file.name || 'avatar.png');
    const res = await fetchHelper(`https://aitopia.ai/api/uploads?filename=${filename}`, {
      method: 'POST',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    });
    const json = await readJson(res);
    if (!res.ok) {
      const msg = json?.error?.message || json?.error || `Upload failed (${res.status})`;
      el.avatarUploadStatus.textContent = String(msg);
      return null;
    }
    const url = json?.url;
    el.avatarUploadStatus.textContent = url ? 'Uploaded.' : 'Upload complete.';
    return typeof url === 'string' ? url : null;
  } catch (e) {
    el.avatarUploadStatus.textContent = 'Upload failed.';
    return null;
  }
}

async function saveProfile(e) {
  e.preventDefault();
  setNotice('');
  if (!el.saveBtn) return;
  el.saveBtn.disabled = true;
  el.saveBtn.textContent = 'Saving…';

  try {
    const payload = {
      username: normalizeUsername(el.username?.value),
      displayName: (el.displayName?.value || '').trim() || null,
      bio: (el.bio?.value || '').trim() || null,
      websiteUrl: (el.websiteUrl?.value || '').trim() || null,
      avatarUrl: (el.avatarUrl?.value || '').trim() || null,
    };

    const { res, json } = await api('https://aitopia.ai/api/users/me/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const msg = json?.error?.message || json?.error || `Save failed (${res.status})`;
      setNotice(String(msg), 'error');
      return;
    }

    const profile = json?.profile;
    if (profile?.username && el.viewProfileLink) {
      el.viewProfileLink.href = `/aitopia/marketplace/profile.html?username=${encodeURIComponent(profile.username)}`;
      el.viewProfileLink.classList.remove('hidden');
      el.viewProfileLink.classList.add('inline-flex');
    }

    setNotice('Saved.', 'info');
  } finally {
    el.saveBtn.disabled = false;
    el.saveBtn.textContent = 'Save';
  }
}

function showDeleteConfirm() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm';

    overlay.innerHTML = `
      <div class="w-full max-w-md mx-4 rounded-2xl border border-red-500/30 bg-card shadow-2xl p-6 space-y-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
            <svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"/>
            </svg>
          </div>
          <h3 class="text-lg font-semibold text-foreground">Delete Your Account</h3>
        </div>
        <div class="space-y-2 text-sm text-muted-foreground">
          <p class="font-medium text-foreground">This will <span class="text-red-500 font-bold">permanently delete</span> your entire account, including:</p>
          <ul class="list-disc pl-5 space-y-1">
            <li>Your profile, username, and avatar</li>
            <li>All your creations and saved outputs</li>
            <li>Your credits and subscription</li>
            <li>All associated data</li>
          </ul>
          <p class="pt-2 font-semibold text-red-500">This action is irreversible. There is no way to recover your account after deletion.</p>
        </div>
        <div class="flex items-center justify-end gap-3 pt-2">
          <button id="deleteConfirmCancel" type="button" class="h-10 px-5 rounded-full border border-border hover:bg-secondary text-sm font-medium transition-colors">
            Cancel
          </button>
          <button id="deleteConfirmYes" type="button" class="h-10 px-5 rounded-full bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors">
            Yes, Delete My Account
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const close = (confirmed) => {
      overlay.remove();
      resolve(confirmed);
    };

    overlay.querySelector('#deleteConfirmCancel').addEventListener('click', () => close(false));
    overlay.querySelector('#deleteConfirmYes').addEventListener('click', () => close(true));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
    document.addEventListener('keydown', function handler(e) {
      if (e.key === 'Escape') { document.removeEventListener('keydown', handler); close(false); }
    });
  });
}

async function deleteAccount() {
  const confirmed = await showDeleteConfirm();
  if (!confirmed) return;

  if (el.deleteAccountBtn) {
    el.deleteAccountBtn.disabled = true;
    el.deleteAccountBtn.textContent = 'Deleting…';
  }

  try {
    const { res, json } = await api('/auth/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const message = json?.data?.message || json?.error || (res.ok ? 'Account deleted.' : `Delete failed (${res.status})`);

    if (res.ok) {
      setNotice(message, 'info');
      setTimeout(() => { location.href='/aitopia/marketplace/login.html'; }, 1500);
    } else {
      setNotice(message, 'error');
    }
  } catch (e) {
    setNotice('Failed to delete account. Please try again.', 'error');
  } finally {
    if (el.deleteAccountBtn) {
      el.deleteAccountBtn.disabled = false;
      el.deleteAccountBtn.textContent = 'Delete Account';
    }
  }
}

function init() {
  el.form?.addEventListener('submit', saveProfile);

  el.username?.addEventListener('input', () => {
    if (usernameCheckTimer) clearTimeout(usernameCheckTimer);
    usernameCheckTimer = setTimeout(() => void checkUsernameAvailability(), 250);
  });

  el.avatarUrl?.addEventListener('input', () => setAvatarPreview(el.avatarUrl.value));

  // Wire up the styled button to trigger the hidden file input
  el.avatarFileBtn?.addEventListener('click', () => {
    el.avatarFile?.click();
  });

  el.avatarFile?.addEventListener('change', async () => {
    const file = el.avatarFile.files?.[0];
    if (!file) return;
    // Show filename
    if (el.avatarFileName) {
      el.avatarFileName.textContent = file.name;
      el.avatarFileName.title = file.name;
    }
    const url = await uploadAvatar(file);
    if (!url) return;
    if (el.avatarUrl) el.avatarUrl.value = url;
    setAvatarPreview(url);
  });

  el.deleteAccountBtn?.addEventListener('click', deleteAccount);

  void loadProfile();
}

init();

