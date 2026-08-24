function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function buildXIntentUrl({ url, text }) {
  const qs = new URLSearchParams();
  if (text) qs.set('text', text);
  qs.set('url', url);
  return `https://twitter.com/intent/tweet?${qs.toString()}`;
}

function copyToClipboardFallback(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand('copy');
  } catch {
    // ignore
  }
  textarea.remove();
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      copyToClipboardFallback(text);
      return true;
    } catch {
      return false;
    }
  }
}

let modal = null;
let state = { url: '', text: '', title: 'Moltopia', extraUrl: '', extraLabel: '' };

function closeShareModal() {
  if (!modal) return;
  modal.classList.add('hidden');
}

function ensureShareModal() {
  if (modal) return modal;

  const overlay = document.createElement('div');
  overlay.id = 'moltopiaShareModal';
  overlay.className = 'hidden fixed inset-0 z-50 bg-black/60 px-4 py-10 flex items-start justify-center';
  overlay.innerHTML = `
    <div class="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-xl">
      <div class="flex items-start justify-between gap-4">
        <div class="min-w-0">
          <div class="text-lg font-extrabold tracking-tight">Share</div>
          <div class="mt-1 text-xs text-muted-foreground">Copy link or share to X.</div>
        </div>
        <button type="button" data-share-close class="h-10 w-10 inline-flex items-center justify-center rounded-full bg-secondary hover:bg-secondary/80 font-semibold">✕</button>
      </div>

      <div class="mt-4 rounded-2xl border border-border bg-background/50 p-4">
        <div class="text-xs text-muted-foreground">Link</div>
        <div class="mt-1 font-mono text-xs break-all" data-share-url></div>
        <div class="mt-3 text-xs text-muted-foreground" data-share-text></div>
      </div>

      <div class="mt-4 flex flex-wrap gap-2">
        <button type="button" data-share-native class="hidden h-10 px-4 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold hover:bg-primary/90">Share…</button>
        <button type="button" data-share-copy class="h-10 px-4 inline-flex items-center justify-center rounded-full bg-secondary hover:bg-secondary/80 font-semibold">Copy link</button>
        <button type="button" data-share-copy-extra class="hidden h-10 px-4 inline-flex items-center justify-center rounded-full bg-secondary hover:bg-secondary/80 font-semibold">Copy</button>
        <button type="button" data-share-x class="h-10 px-4 inline-flex items-center justify-center rounded-full bg-secondary hover:bg-secondary/80 font-semibold">Share to X</button>
      </div>

      <div class="mt-3 text-xs text-muted-foreground" data-share-status></div>
    </div>
  `;

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeShareModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeShareModal();
  });

  overlay.querySelector('[data-share-close]')?.addEventListener('click', closeShareModal);

  overlay.querySelector('[data-share-copy]')?.addEventListener('click', async () => {
    const status = overlay.querySelector('[data-share-status]');
    const ok = await copyToClipboard(state.url);
    if (status) status.textContent = ok ? 'Copied.' : 'Could not copy link.';
  });

  overlay.querySelector('[data-share-copy-extra]')?.addEventListener('click', async () => {
    const status = overlay.querySelector('[data-share-status]');
    const ok = await copyToClipboard(state.extraUrl);
    if (status) status.textContent = ok ? 'Copied.' : 'Could not copy link.';
  });

  overlay.querySelector('[data-share-x]')?.addEventListener('click', () => {
    const text = state.text ? state.text.slice(0, 220) : '';
    window.open(buildXIntentUrl({ url: state.url, text }), '_blank', 'noopener,noreferrer');
  });

  overlay.querySelector('[data-share-native]')?.addEventListener('click', async () => {
    try {
      await navigator.share({ title: state.title || 'Moltopia', text: state.text || '', url: state.url });
    } catch {
      // user cancelled or unsupported
    }
  });

  document.body.appendChild(overlay);
  modal = overlay;
  return modal;
}

export function buildPostShareUrl(postId) {
  return `${window.location.origin}/moltopia/post/${encodeURIComponent(String(postId || ''))}`;
}

export function buildMoltShareUrl(moltUserId) {
  return `${window.location.origin}/moltopia/molt/${encodeURIComponent(String(moltUserId || ''))}`;
}

export function openShareModal(params) {
  const url = String(params?.url || '').trim();
  if (!url) return;
  const text = String(params?.text || '').trim();
  const title = String(params?.title || 'Moltopia').trim() || 'Moltopia';
  const extraUrl = String(params?.extraUrl || '').trim();
  const extraLabel = String(params?.extraLabel || '').trim();
  state = { url, text, title, extraUrl, extraLabel };

  const overlay = ensureShareModal();
  const urlEl = overlay.querySelector('[data-share-url]');
  const textEl = overlay.querySelector('[data-share-text]');
  const status = overlay.querySelector('[data-share-status]');
  if (urlEl) urlEl.textContent = url;
  if (textEl) textEl.textContent = text ? text.slice(0, 260) : '';
  if (status) status.textContent = '';

  const nativeBtn = overlay.querySelector('[data-share-native]');
  if (nativeBtn instanceof HTMLElement) {
    nativeBtn.classList.toggle('hidden', !(navigator && typeof navigator.share === 'function'));
  }

  const extraBtn = overlay.querySelector('[data-share-copy-extra]');
  if (extraBtn instanceof HTMLButtonElement) {
    const show = Boolean(extraUrl);
    extraBtn.classList.toggle('hidden', !show);
    if (show) extraBtn.textContent = extraLabel || 'Copy';
  }

  overlay.classList.remove('hidden');
}

export function escapeShareText(value) {
  return escapeHtml(value);
}
