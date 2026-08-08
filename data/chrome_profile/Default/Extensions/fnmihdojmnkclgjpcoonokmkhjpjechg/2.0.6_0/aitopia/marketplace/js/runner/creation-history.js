import { renderOutput, renderImageSlider } from './result-renderer.js';
import { collectMediaUrls } from './collect-media-urls.js';
import { escapeHtml, renderInputFieldsHtml } from '../shared/input-rendering.js';
import { getJob } from '../shared/api.js';
import { fetchHelper } from '../shared/fetch-helper.js';

const REPORT_REASON_LABELS = { nsfw: 'NSFW / Sexual content', spam: 'Spam', copyright: 'Copyright', hate: 'Hate / Harassment', violence: 'Violence', impersonation: 'Impersonation', other: 'Other' };
const FLAG_SVG_SM = '<svg class="w-3 h-3 inline-block mr-0.5 align-[-1px]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5"/></svg>';

function getMediaUrl(creation) {
  if (!creation) return null;
  if (creation.preview?.url) return creation.preview.url;
  const output = creation.output || creation;
  // Direct field check (fast path)
  const direct = output?.resultUrl || output?.url || output?.imageUrl || output?.videoUrl || output?.audioUrl || output?.mediaUrl;
  if (direct) return direct;
  // Deep scan fallback via collectMediaUrls
  if (output && typeof output === 'object') {
    const media = collectMediaUrls(output);
    if (media.videos.length > 0) return media.videos[0];
    if (media.images.length > 0) return media.images[0];
    if (media.audios.length > 0) return media.audios[0];
  }
  return null;
}

function getAllMediaImages(creation) {
  if (!creation) return [];
  const output = creation.output;
  if (output && typeof output === 'object') {
    const media = collectMediaUrls(output);
    return media.images || [];
  }
  return [];
}

async function downloadMedia(url) {
  if (!url) return;

  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    const urlPath = new URL(url).pathname;
    const filename = urlPath.split('/').pop() || 'download';

    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error('Download failed:', error);
    window.open(url, '_blank');
  }
}

let activeModal = null;

function openCreationModal(creation) {
  if (activeModal) closeCreationModal();

  const mediaUrl = getMediaUrl(creation);
  const kind = getMediaKind(creation);
  const prompt = creation.prompt || creation.input?.prompt || creation.input?.text || '';
  const isVideo = kind === 'video';
  const isAudio = kind === 'audio';

  let mediaHtml = '';
  if (mediaUrl) {
    if (isVideo) {
      mediaHtml = `<video src="${escapeHtml(mediaUrl)}" class="max-w-full max-h-[70vh] rounded-2xl" controls autoplay playsinline></video>`;
    } else if (isAudio) {
      mediaHtml = `
        <div class="w-full max-w-xl rounded-3xl bg-gradient-to-br from-primary/90/10 to-pink-100 dark:from-primary/90/20 dark:to-pink-500/20 flex flex-col items-center justify-center p-12">
          <svg class="w-24 h-24 text-primary/90 mb-8" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/>
          </svg>
          <audio src="${escapeHtml(mediaUrl)}" controls autoplay class="w-full [color-scheme:dark]"></audio>
        </div>`;
    } else {
      const allImages = getAllMediaImages(creation);
      if (allImages.length > 1) {
        // Slider rendered after modal is in DOM
        mediaHtml = `<div data-modal-slider class="max-w-full max-h-[70vh]"></div>`;
      } else {
        mediaHtml = `<img src="${escapeHtml(mediaUrl)}" alt="" class="max-w-full max-h-[70vh] rounded-2xl object-contain">`;
      }
    }
  }

  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-[9999] flex items-center justify-center p-4';
  modal.innerHTML = `
    <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" data-modal-backdrop></div>
    <div class="relative z-10 flex flex-col items-center max-w-4xl w-full max-h-[90vh]" data-modal-content>
      <!-- Close button -->
      <button data-modal-close class="absolute -top-2 -right-2 lg:top-4 lg:right-4 w-10 h-10 rounded-full bg-primary-foreground/10 hover:bg-primary-foreground/20 text-white flex items-center justify-center transition-colors z-20">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>

      <!-- Media -->
      <div class="flex items-center justify-center mb-4">
        ${mediaHtml}
      </div>

      <!-- Prompt -->
      ${prompt ? `<p class="text-white/80 text-sm text-center max-w-2xl line-clamp-3 px-4">${escapeHtml(prompt)}</p>` : ''}

      <!-- Actions -->
      <div class="flex items-center gap-3 mt-4">
        ${mediaUrl ? `
          <button data-action="download" class="flex items-center gap-2 px-4 py-2 rounded-full bg-primary-foreground/10 hover:bg-primary-foreground/20 text-white text-sm transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>
            Download
          </button>
        ` : ''}
        <button data-action="copy" class="flex items-center gap-2 px-4 py-2 rounded-full bg-primary-foreground/10 hover:bg-primary-foreground/20 text-white text-sm transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
          Copy URL
        </button>
      </div>
      <!-- Report (shown only for published outputs, after API check) -->
      <div data-report-wrap class="hidden w-full flex justify-center mt-3">
        <button data-action="report" data-report-text-mode="true" class="text-xs text-white/40 hover:text-white/70 transition-colors">
          ${FLAG_SVG_SM} Report
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';
  activeModal = modal;

  const sliderMount = modal.querySelector('[data-modal-slider]');
  if (sliderMount) {
    const allImages = getAllMediaImages(creation);
    renderImageSlider(sliderMount, allImages, {});
  }

  const closeBtn = modal.querySelector('[data-modal-close]');
  const backdrop = modal.querySelector('[data-modal-backdrop]');

  closeBtn?.addEventListener('click', closeCreationModal);
  backdrop?.addEventListener('click', closeCreationModal);

  const escHandler = (e) => {
    if (e.key === 'Escape') closeCreationModal();
  };
  document.addEventListener('keydown', escHandler);
  modal._escHandler = escHandler;

  const downloadBtn = modal.querySelector('[data-action="download"]');
  if (downloadBtn && mediaUrl) {
    downloadBtn.addEventListener('click', () => downloadMedia(mediaUrl));
  }

  const copyBtn = modal.querySelector('[data-action="copy"]');
  if (copyBtn && mediaUrl) {
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(mediaUrl);
        copyBtn.innerHTML = `
          <svg class="w-4 h-4 text-green-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
          Copied!
        `;
        setTimeout(() => {
          copyBtn.innerHTML = `
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
            Copy URL
          `;
        }, 2000);
      } catch (err) {
        console.error('Copy failed:', err);
      }
    });
  }

  // Report button — only for published outputs
  const outputId = creation?.outputId || creation?.id;
  if (outputId) {
    wireReportButton(modal, outputId);
  }
}

async function wireReportButton(modal, outputId) {
  const wrap = modal.querySelector('[data-report-wrap]');
  const btn = modal.querySelector('[data-action="report"]');
  if (!wrap || !btn) return;

  try {
    const res = await fetchHelper(`https://aitopia.ai/api/outputs/${encodeURIComponent(outputId)}`, {
      method: 'GET', headers: { Accept: 'application/json' }, credentials: 'include',
    });
    if (!res.ok) return;
    const details = await res.json();

    const visibility = details.output?.visibility || 'private';
    const moderation = details.output?.moderationStatus || 'pending';
    const isOwner = Boolean(details.viewer?.isOwner);
    if (isOwner || visibility !== 'public' || moderation !== 'approved') return;

    wrap.classList.remove('hidden');

    const hasReported = Boolean(details.viewer?.hasReported);
    if (hasReported) {
      const label = REPORT_REASON_LABELS[details.viewer?.reportReason] || details.viewer?.reportReason || 'Reported';
      btn.disabled = true;
      btn.innerHTML = `${FLAG_SVG_SM} Reported: ${escapeHtml(label)}`;
      btn.className = 'text-xs text-red-400/70 cursor-not-allowed transition-colors';
      return;
    }

    btn.addEventListener('click', () => openReportOverlay(modal, outputId, btn));
  } catch { /* silent */ }
}

function openReportOverlay(parentModal, outputId, reportBtn) {
  // Remove existing overlay if any
  parentModal.querySelector('[data-report-overlay]')?.remove();

  const overlay = document.createElement('div');
  overlay.setAttribute('data-report-overlay', '');
  overlay.className = 'absolute inset-0 z-20 flex items-center justify-center p-4';
  overlay.innerHTML = `
    <div class="absolute inset-0 bg-black/60" data-report-backdrop></div>
    <div class="relative z-10 w-[min(440px,92vw)] rounded-2xl border border-white/10 bg-[#1a1a1a] shadow-xl overflow-hidden">
      <div class="p-4 border-b border-white/10 flex items-center justify-between">
        <span class="font-semibold text-white text-sm">Report creation</span>
        <button data-report-close class="text-xs text-white/50 hover:text-white transition-colors">Close</button>
      </div>
      <form data-report-form class="p-4 space-y-3">
        <div>
          <label class="block text-xs font-semibold text-white/70 mb-1">Reason</label>
          <select data-report-reason class="w-full h-9 px-3 rounded-lg bg-white/10 border-0 text-white text-sm focus:outline-none focus:ring-1 focus:ring-white/20">
            <option value="nsfw">NSFW / Sexual content</option>
            <option value="spam">Spam</option>
            <option value="copyright">Copyright</option>
            <option value="hate">Hate / Harassment</option>
            <option value="violence">Violence</option>
            <option value="impersonation">Impersonation</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-semibold text-white/70 mb-1">Details (optional)</label>
          <textarea data-report-details rows="3" maxlength="500" class="w-full p-3 rounded-lg bg-white/10 border-0 text-white text-sm focus:outline-none focus:ring-1 focus:ring-white/20 placeholder-white/30" placeholder="Add context for moderators…"></textarea>
        </div>
        <div class="flex items-center gap-2 pt-1">
          <button type="submit" data-report-submit class="h-9 px-5 rounded-full bg-white text-black text-xs font-semibold hover:bg-white/90 transition-colors">Submit report</button>
          <button type="button" data-report-cancel class="h-9 px-5 rounded-full bg-white/10 text-white text-xs font-semibold hover:bg-white/20 transition-colors">Cancel</button>
        </div>
      </form>
    </div>
  `;

  parentModal.querySelector('[data-modal-content]').appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector('[data-report-backdrop]')?.addEventListener('click', close);
  overlay.querySelector('[data-report-close]')?.addEventListener('click', close);
  overlay.querySelector('[data-report-cancel]')?.addEventListener('click', close);

  overlay.querySelector('[data-report-form]')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = overlay.querySelector('[data-report-submit]');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Submitting…'; }

    try {
      const reason = overlay.querySelector('[data-report-reason]')?.value ?? 'other';
      const details = (overlay.querySelector('[data-report-details]')?.value ?? '').trim() || undefined;
      if (reason === 'other' && !details) {
        alert('Please provide details when selecting "Other".');
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Submit report'; }
        return;
      }

      const res = await fetchHelper(`https://aitopia.ai/api/outputs/${encodeURIComponent(outputId)}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason, details }),
      });

      if (res.status === 409) {
        alert('You have already reported this content.');
        close();
        return;
      }
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        alert(json?.error?.message || json?.error || `Failed to report (${res.status})`);
        return;
      }

      close();
      // Update button to reported state
      const reason2 = overlay.querySelector('[data-report-reason]')?.value ?? reason;
      const label = REPORT_REASON_LABELS[reason2] || reason2;
      reportBtn.disabled = true;
      reportBtn.innerHTML = `${FLAG_SVG_SM} Reported: ${escapeHtml(label)}`;
      reportBtn.className = 'text-xs text-red-400/70 cursor-not-allowed transition-colors';
      alert('Report submitted. Thank you.');
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Submit report'; }
    }
  });
}

function openSingleImageModal(imageUrl, creation) {
  if (activeModal) closeCreationModal();

  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-[9999] flex items-center justify-center p-4';
  modal.innerHTML = `
    <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" data-modal-backdrop></div>
    <div class="relative z-10 flex flex-col items-center max-w-3xl w-full max-h-[90vh]" data-modal-content>
      <button data-modal-close class="absolute -top-2 -right-2 lg:top-4 lg:right-4 w-10 h-10 rounded-full bg-primary-foreground/10 hover:bg-primary-foreground/20 text-white flex items-center justify-center transition-colors z-20">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
      <div class="flex items-center justify-center mb-4">
        <img src="${escapeHtml(imageUrl)}" alt="" class="max-w-full max-h-[70vh] rounded-2xl object-contain">
      </div>
      <div class="flex items-center gap-3 mt-2">
        <button data-action="download" class="flex items-center gap-2 px-4 py-2 rounded-full bg-primary-foreground/10 hover:bg-primary-foreground/20 text-white text-sm transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>
          Download
        </button>
        <button data-action="publish" class="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/90 hover:bg-primary text-primary-foreground text-sm font-medium transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z"/></svg>
          Publish
        </button>
      </div>
      <!-- Report -->
      <div data-report-wrap class="hidden w-full flex justify-center mt-3">
        <button data-action="report" data-report-text-mode="true" class="text-xs text-white/40 hover:text-white/70 transition-colors">
          ${FLAG_SVG_SM} Report
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';
  activeModal = modal;

  modal.querySelector('[data-modal-close]')?.addEventListener('click', closeCreationModal);
  modal.querySelector('[data-modal-backdrop]')?.addEventListener('click', closeCreationModal);

  const escHandler = (e) => { if (e.key === 'Escape') closeCreationModal(); };
  document.addEventListener('keydown', escHandler);
  modal._escHandler = escHandler;

  modal.querySelector('[data-action="download"]')?.addEventListener('click', () => downloadMedia(imageUrl));

  modal.querySelector('[data-action="publish"]')?.addEventListener('click', () => {
    closeCreationModal();
    if (typeof window.__AITOPIA_OPEN_PUBLISH_MODAL__ === 'function') {
      const publishContext = creation ? {
        idempotencyKey: creation.idempotencyKey || creation.runId || creation.id,
        sourceRunId: creation.runId || creation.id,
      } : null;
      window.__AITOPIA_OPEN_PUBLISH_MODAL__({
        agentId: creation?.agentId,
        idempotencyKey: publishContext?.idempotencyKey,
        sourceRunId: publishContext?.sourceRunId,
        input: creation?.input || {},
        selectedImageUrl: imageUrl,
      });
    }
  });

  const singleOutputId = creation?.outputId || creation?.id;
  if (singleOutputId) wireReportButton(modal, singleOutputId);
}

function closeCreationModal() {
  if (!activeModal) return;

  if (activeModal._escHandler) {
    document.removeEventListener('keydown', activeModal._escHandler);
  }

  const video = activeModal.querySelector('video');
  const audio = activeModal.querySelector('audio');
  if (video) video.pause();
  if (audio) audio.pause();

  activeModal.remove();
  document.body.style.overflow = '';
  activeModal = null;
}

function getMediaKind(creation) {
  if (creation.preview?.kind) return creation.preview.kind;

  const output = creation.output || creation;
  if (output?.videoUrl) return 'video';
  if (output?.audioUrl) return 'audio';

  // Deep scan: if collectMediaUrls found videos/audios, use that kind
  if (output && typeof output === 'object') {
    const media = collectMediaUrls(output);
    if (media.videos.length > 0) return 'video';
    if (media.audios.length > 0) return 'audio';
    if (media.images.length > 0) return 'image';
  }

  const url = getMediaUrl(creation);
  if (!url) return 'unknown';
  const lower = url.toLowerCase();

  if (/\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(lower) || lower.includes('video/')) return 'video';
  if (/\.(mp3|wav|ogg|m4a|aac|flac)(\?|#|$)/i.test(lower) || lower.includes('audio/')) return 'audio';

  return 'image';
}

function getFullTextOutput(creation) {
  const output = creation.output || creation;
  if (!output) return null;
  if (typeof output === 'string') return output;
  if (typeof output === 'object') {
    // Direct text fields
    if (output.content) return output.content;
    if (output.text) return output.text;
    if (output.markdown) return output.markdown;
    if (output.html) return output.html;

    // Email template format: { templateA: { subject, body }, templateB?, templateC? }
    if (output.templateA && output.templateA.body) {
      const parts = [];
      ['templateA', 'templateB', 'templateC'].forEach((key, idx) => {
        const tpl = output[key];
        if (tpl && tpl.subject && tpl.body) {
          const label = idx === 0 ? 'Template A' : idx === 1 ? 'Template B' : 'Template C';
          parts.push(`=== ${label} ===\nSubject: ${tpl.subject}\n\n${tpl.body}`);
        }
      });
      if (parts.length > 0) return parts.join('\n\n');
    }

    // Script format: { script: { sections: [...] } }
    if (output.script && Array.isArray(output.script.sections)) {
      const sections = output.script.sections.map(s => s.text || s.content || '').filter(Boolean);
      if (sections.length > 0) return sections.join('\n\n');
    }

    // Generic
    for (const key of Object.keys(output)) {
      if (typeof output[key] === 'string' && output[key].length > 20) {
        return output[key];
      }
    }

    return null;
  }
  return null;
}

function isTextOnlyOutput(creation) {
  // check: if no media URL, it's text-only
  return !getMediaUrl(creation);
}

export function createCreationHistoryPanel(container, { sourceStoreId, onSelect }) {
  let creations = [];
  let loading = false;
  let selectedId = null;
  let hideSelectedInList = false;
  let currentViewMode = 'list';
  let highlightedId = null;
  const _activePollers = new Map(); // creationId → intervalId

  const listEl = container;
  const gridContainer = document.querySelector('[data-history-grid-view]');

  function getCreationId(creation) {
    return creation?.runId || creation?.id || creation?.idempotencyKey || creation?.outputId || null;
  }

  function getPublishContext(creation) {
    const output = creation?.output && typeof creation.output === 'object' ? creation.output : null;
    const idempotencyKey = typeof creation?.idempotencyKey === 'string' && creation.idempotencyKey.trim()
      ? creation.idempotencyKey.trim()
      : (typeof output?.idempotencyKey === 'string' && output.idempotencyKey.trim()
        ? output.idempotencyKey.trim()
        : (typeof output?.sourceIdempotencyKey === 'string' && output.sourceIdempotencyKey.trim()
          ? output.sourceIdempotencyKey.trim()
          : null));
    const sourceRunId = typeof creation?.runId === 'string' && creation.runId.trim()
      ? creation.runId.trim()
      : (typeof creation?.id === 'string' && creation.id.trim()
        ? creation.id.trim()
        : (typeof output?.runId === 'string' && output.runId.trim()
          ? output.runId.trim()
          : (typeof output?.sourceRunId === 'string' && output.sourceRunId.trim()
            ? output.sourceRunId.trim()
            : null)));

    if (!idempotencyKey && !sourceRunId) return null;
    return { idempotencyKey, sourceRunId };
  }

  function mergeCreationsPreferExisting(existing, fetched) {
    const map = new Map();
    // Keep existing first so drafts/running entries survive a load() that returns empty.
    for (const c of existing || []) {
      const id = getCreationId(c);
      if (id) map.set(id, c);
    }
    for (const c of fetched || []) {
      const id = getCreationId(c);
      if (!id) continue;
      if (!map.has(id)) map.set(id, c);
    }
    const merged = Array.from(map.values());
    // Newest first (fallback to 0)
    merged.sort((a, b) => {
      const ta = Date.parse(a?.createdAt || '') || 0;
      const tb = Date.parse(b?.createdAt || '') || 0;
      return tb - ta;
    });
    return merged;
  }

  function shouldShowCreation(creation) {
    const status = typeof creation?.status === 'string' ? creation.status.toLowerCase() : '';
    const isInProgress = status.includes('running') || status.includes('queue') || status.includes('pending');
    // In-progress items should be visible (rendered as loading cards)
    if (isInProgress) return true;

    const output = creation?.output ?? creation?.preview;
    if (output && (typeof output !== 'object' || Object.keys(output).length > 0)) return true;
    if (getMediaUrl(creation)) return true;
    if (getFullTextOutput(creation)) return true;
    return false;
  }

  function isCreationInProgress(creation) {
    const status = typeof creation?.status === 'string' ? creation.status.toLowerCase() : '';
    return status.includes('running') || status.includes('queue') || status.includes('pending') || status.includes('upload');
  }

  function renderInProgressCard(creation) {
    const id = getCreationId(creation);
    const status = creation.status || 'Processing';
    const lowerStatus = status.toLowerCase();
    const isUploading = lowerStatus.includes('upload');
    const isQueued = !isUploading && (lowerStatus.includes('queue') || lowerStatus === 'pending' || lowerStatus.includes('pending'));
    const prompt = creation.prompt || creation.input?.prompt || creation.input?.text || '';
    const modelName = creation.modelUsed || creation.modelId || creation.input?.selectedModelId || creation.agentId || '';
    const inputFieldsHtml = renderInputFieldsHtml(creation.input, { model: modelName });
    const createdAt = creation.createdAt ? new Date(creation.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
    // Parse progress percentage from status like "Running (45%)" or "Uploading (5%)"
    const pctMatch = status.match(/\((\d+)%\)/);
    const pct = pctMatch ? parseInt(pctMatch[1], 10) : (isQueued ? null : isUploading ? null : null);

    const statusLabel = isUploading ? 'Uploading' : isQueued ? 'In Queue' : 'Processing';
    const statusColor = isUploading ? 'text-blue-500' : isQueued ? 'text-[#FFD128]' : 'text-primary/90';
    const barColor = isUploading ? 'from-blue-500 to-blue-400' : isQueued ? 'from-[#FFD128] to-[#FFD128]' : 'from-primary/90 to-primary/90';

    return `
      <div class="history-list-card history-list-card-progress flex flex-col lg:flex-row gap-2 lg:gap-4 p-3 lg:p-0 rounded-2xl lg:rounded-none bg-[#F2F5F9] dark:bg-[#0F0F0F] lg:bg-transparent" data-creation-id="${escapeHtml(id)}">
        <!-- Loading / Progress area -->
        <div class="history-list-media relative min-w-0 w-full aspect-video lg:aspect-auto lg:h-[450px] rounded-xl lg:rounded-2xl overflow-hidden bg-gray-100 dark:bg-[#1a1a1a] flex flex-col">
          <div class="flex-1 flex flex-col items-center justify-center gap-4 w-full px-8">
            <!-- Spinner -->
            <div class="relative w-20 h-20" ${isQueued ? 'data-status-queued' : ''}>
              <div class="absolute inset-0 rounded-full border-[3px] ${isUploading ? 'border-blue-500/15' : isQueued ? 'border-[#FFD128]/15' : 'border-primary/90/15'}"></div>
              <div class="absolute inset-0 rounded-full border-[3px] ${isUploading ? 'border-blue-500' : isQueued ? 'border-[#FFD128]' : 'border-primary/90'} border-t-transparent animate-spin"></div>
              <div class="absolute inset-2 rounded-full ${isUploading ? 'bg-blue-500/5' : isQueued ? 'bg-[#FFD128]/5' : 'bg-primary/90/5'} flex items-center justify-center">
                ${pct != null
                  ? `<span class="text-lg font-bold ${statusColor}" data-progress-circle-pct>${pct}%</span>`
                  : isUploading
                    ? `<svg class="w-6 h-6 ${statusColor}" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.338-2.32 3.75 3.75 0 013.572 5.345A4.5 4.5 0 0118 19.5H6.75z"/></svg>`
                    : `<svg class="w-6 h-6 ${statusColor}" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/></svg>`
                }
              </div>
            </div>
            <!-- Status text -->
            <p class="text-sm font-medium ${statusColor}" data-progress-status>${escapeHtml(statusLabel)}</p>
            <!-- Progress bar -->
            <div class="w-full max-w-xs">
              <div class="h-2 w-full rounded-full bg-gray-200 dark:bg-[#272727] overflow-hidden">
                <div class="h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-500" data-progress-pct style="width: ${pct != null ? pct : 0}%"></div>
              </div>
            </div>
            ${modelName ? `<p class="text-xs text-gray-400 dark:text-[#666]">${escapeHtml(modelName)}</p>` : ''}
          </div>
          ${(() => {
            const _plan = String(window?.AitopiaLicences?.plan_type || '').toLowerCase();
            if (_plan === 'creator') return '';
            const _isPrem  = _plan === 'premium';
            const _label   = _isPrem ? 'Creator'  : 'Premium';
            const _color   = _isPrem ? 'var(--upgrade-gold)' : 'var(--upgrade-purple)';
            const _href    = '/aitopia/marketplace/pricing.html';
            const _feats   = _isPrem
              ? ['Unlimited API Access', 'White-label exports', 'Dedicated support']
              : ['Access Consistent Characters', 'Batch size up to 4', '10x faster generations'];
            const _check   = `<svg width="16" height="16" viewBox="0 0 22 22" fill="none" class="shrink-0"><path d="M11 21C16.5228 21 21 16.5228 21 11C21 5.47715 16.5228 1 11 1C5.47715 1 1 5.47715 1 11C1 16.5228 5.47715 21 11 21Z" style="stroke:${_color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 11L10 13L14 9" style="stroke:${_color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
            const _pills   = _feats.map(f => `<span class="inline-flex items-center gap-2 rounded-full border border-[var(--upgrade-pill-border)] h-9 px-4 text-[13px] font-medium text-[var(--upgrade-feature-text)] whitespace-nowrap">${_check}${escapeHtml(f)}</span>`).join('');
            const _rows    = _feats.map(f => `<span class="flex items-center gap-2 text-sm font-medium text-[var(--upgrade-feature-text)]">${_check}${escapeHtml(f)}</span>`).join('');
            const _desktop = `<div class="hidden lg:flex flex-col gap-2 py-4 px-4 bg-[var(--upgrade-surface)] border-t border-[var(--upgrade-strip-border)]">
                <div class="text-[13px] font-bold text-[var(--upgrade-title-text)]">Try AITOPIA <span style="color:${_color};">${_label}</span></div>
                <div class="flex items-center gap-2 flex-wrap">
                  ${_pills}
                  <a href="${_href}" class="ml-auto inline-flex items-center gap-[5px] shrink-0 rounded-full h-9 px-[18px] text-xs font-semibold no-underline whitespace-nowrap text-white bg-[var(--plan-premium-accent)]">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>Upgrade
                  </a>
                </div>
              </div>`;
            return _desktop;
          })()}
        </div>

        <!-- Mobile-only upgrade card -->
        ${(() => {
          const _plan = String(window?.AitopiaLicences?.plan_type || '').toLowerCase();
          if (_plan === 'creator') return '';
          const _isPrem = _plan === 'premium';
          const _label  = _isPrem ? 'Creator' : 'Premium';
          const _color  = _isPrem ? 'var(--upgrade-gold)' : 'var(--upgrade-purple)';
          const _href   = '/aitopia/marketplace/pricing.html';
          const _feats  = _isPrem
            ? ['Unlimited API Access', 'White-label exports', 'Dedicated support']
            : ['Access Consistent Characters', 'Batch size up to 4', '10x faster generations'];
          const _check  = `<svg width="16" height="16" viewBox="0 0 22 22" fill="none" class="shrink-0"><path d="M11 21C16.5228 21 21 16.5228 21 11C21 5.47715 16.5228 1 11 1C5.47715 1 1 5.47715 1 11C1 16.5228 5.47715 21 11 21Z" style="stroke:${_color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 11L10 13L14 9" style="stroke:${_color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
          const _rows   = _feats.map(f => `<span class="flex items-center gap-2 text-sm font-medium text-[var(--upgrade-feature-text)]">${_check}${escapeHtml(f)}</span>`).join('');
          return `<div class="flex lg:hidden flex-col gap-3 rounded-2xl p-4 bg-[var(--upgrade-surface)]">
            <div class="flex items-start justify-between gap-4">
              <div class="text-sm font-bold leading-[1.4] text-[var(--upgrade-title-text)]">Try<br>AITOPIA<br><span style="color:${_color};font-size:19px;">${_label}</span></div>
              <div class="flex flex-col gap-2.5 pt-0.5">${_rows}</div>
            </div>
            <a href="${_href}" class="flex items-center justify-center gap-1.5 rounded-xl p-[13px] text-[15px] font-bold no-underline text-white bg-[var(--plan-premium-accent)]">Upgrade &nbsp;→</a>
          </div>`;
        })()}

        <!-- Info Panel with inputs -->
        <div class="history-list-info flex flex-col gap-2 lg:gap-0 lg:justify-between w-full lg:min-w-[200px]">
          <div class="space-y-2 lg:space-y-3">
            <!-- Status badge -->
            <div class="flex flex-wrap gap-1.5 lg:gap-2">
              <span class="px-2.5 py-1 text-xs rounded-full ${isUploading ? 'bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' : isQueued ? 'bg-[#FFD128]/10 dark:bg-[#FFD128]/10 text-[#FFD128] dark:text-[#FFD128]' : 'bg-primary/90/10 dark:bg-primary/90/10 text-primary/90 dark:text-primary/90'}">
                <span class="inline-block w-1.5 h-1.5 rounded-full ${isUploading ? 'bg-blue-500' : isQueued ? 'bg-[#FFD128]' : 'bg-primary/90'} mr-1 animate-pulse"></span>
                ${escapeHtml(statusLabel)}
              </span>
              ${modelName ? `<span class="px-2.5 py-1 text-xs rounded-full bg-gray-200 dark:bg-[#272727] text-gray-600 dark:text-[#898A8B]">${escapeHtml(modelName)}</span>` : ''}
            </div>

            <!-- Prompt -->
            ${prompt ? `<p class="text-sm text-gray-500 dark:text-[#898A8B] line-clamp-6">${escapeHtml(prompt)}</p>` : ''}

            <!-- Input fields -->
            ${inputFieldsHtml}
          </div>

          <!-- Bottom: date -->
          <div class="lg:mt-auto pt-2 lg:pt-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-1">
                <span class="text-xs text-gray-400 dark:text-[#666] italic">${escapeHtml(statusLabel)}…</span>
              </div>
              ${createdAt ? `<span class="text-xs text-gray-400 dark:text-[#555]"${creation.provider ? ` title="${escapeHtml(creation.provider)}"` : ''}>${escapeHtml(createdAt)}</span>` : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderCreationCard(creation, index) {
    const mediaUrl = getMediaUrl(creation);
    const mediaKind = getMediaKind(creation);
    const prompt = creation.prompt || '';
    const id = getCreationId(creation);
    const modelName = creation.modelUsed || creation.modelId || creation.input?.selectedModelId || creation.agentId || 'Model';
    const duration = creation.duration ? `${creation.duration}s` : null;
    const status = typeof creation.status === 'string' ? creation.status : null;
    const isTextOnly = !mediaUrl;
    const displayText = prompt || (isTextOnly ? 'Text output' : '');

    let mediaHtml = '';
    if (mediaUrl) {
      if (mediaKind === 'video') {
        mediaHtml = `<video src="${escapeHtml(mediaUrl)}" class="history-card-media-el history-media-video" autoplay muted loop playsinline></video>`;
      } else if (mediaKind === 'audio') {
        mediaHtml = `
          <div class="history-card-media-el history-media-audio flex flex-col items-center justify-center bg-gradient-to-br from-primary/90/10 to-pink-100 dark:from-primary/90/20 dark:to-pink-500/20 p-4">
            <svg class="w-10 h-10 text-primary/90 mb-3" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/>
            </svg>
            <audio src="${escapeHtml(mediaUrl)}" controls class="w-full max-w-[200px]"></audio>
          </div>`;
      } else {
        mediaHtml = `<img src="${escapeHtml(mediaUrl)}" alt="" class="history-card-media-el history-media-image" loading="lazy">`;
      }
    } else {
      mediaHtml = `
        <div class="history-card-media-el history-media-placeholder history-media-text-only flex items-center justify-center bg-secondary">
          <svg class="w-10 h-10 text-muted-foreground/40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/>
          </svg>
        </div>
      `;
    }

    const textOnlyClass = isTextOnly ? ' history-card-text-only' : '';
    return `
      <div class="history-card cursor-pointer${textOnlyClass}" data-creation-id="${escapeHtml(id)}">
        <div class="history-card-media">${mediaHtml}</div>
        <div class="history-card-overlay">
          <div class="history-card-actions">
            <!-- Delete button - commented out for now
            <button class="history-card-action" data-action="delete" data-id="${escapeHtml(id)}" title="Delete">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </button>
            -->
            <button class="history-card-action" data-action="share" data-url="${escapeHtml(mediaUrl || '')}" title="Share">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/>
              </svg>
            </button>
            <button class="history-card-action" data-action="copy" data-url="${escapeHtml(mediaUrl || '')}" title="Copy">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
              </svg>
            </button>
          </div>
          <div class="history-card-meta">
            ${status ? `<span class="history-card-badge">${escapeHtml(status)}</span>` : ''}
            <span class="history-card-badge">${escapeHtml(modelName)}</span>
            ${duration ? `<span class="history-card-badge">${escapeHtml(duration)}</span>` : ''}
          </div>
          <div class="history-card-text">${escapeHtml(displayText || '')}</div>
        </div>
      </div>
    `;
  }

  function renderList() {
    if (!listEl) return;

    // Show loading state
    if (loading) {
      listEl.innerHTML = `
        <div class="flex items-center justify-center py-16">
          <div class="animate-spin w-8 h-8 border-2 border-primary/90 border-t-transparent rounded-full"></div>
        </div>
      `;
      return;
    }

    const visibleCreations = creations.filter(shouldShowCreation);

    // Show empty state
    if (visibleCreations.length === 0) {
      listEl.innerHTML = `
        <div class="history-empty-state flex flex-col items-center justify-center h-full min-h-[300px] text-center">
          <img src="https://aitopia.ai/icons/brush.svg" alt="" class="w-9 h-9 mb-3 opacity-60">
          <p class="text-sm text-[#898A8B]">Your generated results will appear here.</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = visibleCreations.map(c => {
      // In-progress items get a special loading card
      if (isCreationInProgress(c)) {
        return renderInProgressCard(c);
      }

      const id = getCreationId(c);
      const mediaUrl = getMediaUrl(c);
      const kind = getMediaKind(c);
      const isVideo = kind === 'video';
      const out = c.output || c;
      const isTextOnly = isTextOnlyOutput(c);
      const textContent = isTextOnly ? getFullTextOutput(c) : null;

      const status = typeof c?.status === 'string' ? c.status.toLowerCase() : '';
      const isInProgress = status.includes('running') || status.includes('queue') || status.includes('pending');

      const model = c.modelUsed || c.modelName || c.model || c.modelId || out?.modelUsed || out?.model || c.input?.selectedModelId || '';
      const provider = c.provider || '';
      const timeMs = out?.processingTime || out?.processingTimeMs || c.processingTime;
      const duration = c.duration || out?.duration || '';
      const quality = c.quality || out?.quality || '';
      const prompt = c.prompt || c.input?.prompt || c.input?.text || '';
      const inputFieldsHtml = renderInputFieldsHtml(c.input, { model });
      const createdAt = c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
      const badges = [];
      if (c.agentId) badges.push(c.agentId);
      if (duration) badges.push(typeof duration === 'number' ? `${duration}s` : duration);
      if (quality) badges.push(quality);
      if (timeMs) badges.push(`${Math.round(timeMs)}ms`);
      if (isInProgress && c.status) badges.push(c.status);

      const isHighlighted = highlightedId && id === highlightedId;
      const highlightBadge = isHighlighted
        ? '<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-[#FFD128]/10 dark:bg-[#FFD128]/15 text-[#FFD128] dark:text-[#FFD128] border border-[#FFD128]/30 dark:border-[#FFD128]/30 animate-pulse">Selected</span>'
        : '';
      const highlightRing = isHighlighted ? ' border-b-2 border-[#FFD128] dark:border-[#FFD128]/60' : '';

      if (isTextOnly) {
        return `
          <div class="history-list-card history-list-card-text flex flex-col gap-4 p-6 rounded-2xl bg-[#F2F5F9] dark:bg-[#0F0F0F] border border-black/5 dark:border-white/5${highlightRing}" data-creation-id="${escapeHtml(id)}" data-text-output="true">
            <!-- Header with badges and actions -->
            <div class="flex items-start justify-between gap-4">
              <div class="flex flex-wrap gap-2">
                ${highlightBadge}
                ${badges.length > 0
                  ? badges.map(b => `<span class="px-2.5 py-1 text-xs rounded-full bg-[#E5E7EB] dark:bg-[#272727] text-[#6B7280] dark:text-[#898A8B]">${escapeHtml(b)}</span>`).join('')
                  : '<span class="px-2.5 py-1 text-xs rounded-full bg-[#E5E7EB] dark:bg-[#272727] text-[#6B7280] dark:text-[#898A8B]">—</span>'
                }
              </div>
              <div class="flex items-center gap-2 flex-shrink-0">
                <button data-action="copy-text" class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#E5E7EB] dark:bg-[#272727] text-[#6B7280] dark:text-[#898A8B] text-sm hover:bg-[#D1D5DB] dark:hover:bg-[#373737] transition-colors">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                  Copy
                </button>
                <!-- Delete button - commented out for now
                <button data-action="delete" class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#E5E7EB] dark:bg-[#272727] text-[#6B7280] dark:text-[#898A8B] text-sm hover:bg-[#D1D5DB] dark:hover:bg-[#373737] transition-colors">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
                -->
              </div>
            </div>

            <!-- Text content - will be rendered by renderOutput -->
            <div class="text-output-container max-h-[500px] overflow-auto" data-output-container>${isInProgress ? `
              <div class="flex items-center justify-center py-8 text-[#898A8B]">
                <div class="animate-spin w-5 h-5 border-2 border-primary/90 border-t-transparent rounded-full mr-3"></div>
                <span class="text-sm">${escapeHtml(c.status || 'Processing...')}</span>
              </div>
            ` : ''}</div>

            <!-- Footer with prompt and date -->
            <div class="flex items-end justify-between gap-4 pt-3 border-t border-[#D9D9D9]/10 dark:border-[#D9D9D9]/[4%]">
              ${prompt ? `<p class="text-sm text-[#6B7280] dark:text-[#898A8B] line-clamp-2 flex-1">${escapeHtml(prompt)}</p>` : '<div></div>'}
              ${createdAt ? `<p class="text-xs text-[#9CA3AF] dark:text-[#898A8B] flex-shrink-0">${escapeHtml(createdAt)}</p>` : ''}
            </div>
          </div>
        `;
      }

      const isAudio = kind === 'audio';
      let mediaHtml = '';
      let isMultiImage = false;
      if (mediaUrl) {
        if (isVideo) {
          mediaHtml = `<video src="${escapeHtml(mediaUrl)}" class="w-full h-full object-contain rounded-2xl" controls></video>`;
        } else if (isAudio) {
          mediaHtml = `
            <div class="w-full h-full rounded-2xl bg-gradient-to-br from-primary/90/10 to-pink-100 dark:from-primary/90/20 dark:to-pink-500/20 flex flex-col items-center justify-center p-6">
              <svg class="w-16 h-16 text-primary/90 mb-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/>
              </svg>
              <audio src="${escapeHtml(mediaUrl)}" controls class="w-full max-w-[300px]"></audio>
            </div>`;
        } else {
          const allImages = getAllMediaImages(c);
          if (allImages.length > 1) {
            isMultiImage = true;
            mediaHtml = `<div data-list-slider data-images="${escapeHtml(JSON.stringify(allImages))}" style="position:absolute;inset:0"></div>`;
          } else {
            mediaHtml = `<img src="${escapeHtml(mediaUrl)}" alt="" class="w-full h-full object-contain rounded-2xl">`;
          }
        }
      } else {
        mediaHtml = `
          <div class="w-full h-full rounded-2xl bg-[#1a1a1a] flex items-center justify-center">
            <svg class="w-12 h-12 text-[#898A8B]/40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/>
            </svg>
          </div>
        `;
      }

      return `
        <div class="history-list-card flex flex-col lg:flex-row gap-2 lg:gap-4 p-3 lg:p-0 rounded-2xl lg:rounded-none bg-[#F2F5F9] dark:bg-[#0F0F0F] lg:bg-transparent${highlightRing}" data-creation-id="${escapeHtml(id)}">
          <!-- Media -->
          <div class="history-list-media relative min-w-0 w-full aspect-video lg:aspect-auto lg:h-[450px] rounded-xl lg:rounded-2xl overflow-hidden bg-gray-100 dark:bg-[#1a1a1a]">
            ${mediaHtml}
          </div>

          <!-- Info Panel -->
          <div class="history-list-info flex flex-col gap-2 lg:gap-0 lg:justify-between w-full lg:min-w-[200px]">
            <div class="space-y-2 lg:space-y-3">
              <!-- Badges -->
              <div class="flex flex-wrap gap-1.5 lg:gap-2">
                ${highlightBadge}
                ${badges.length > 0
                  ? badges.map(b => `<span class="px-2.5 py-1 text-xs rounded-full bg-gray-200 dark:bg-[#272727] text-gray-600 dark:text-[#898A8B]">${escapeHtml(b)}</span>`).join('')
                  : '<span class="px-2.5 py-1 text-xs rounded-full bg-gray-200 dark:bg-[#272727] text-gray-600 dark:text-[#898A8B]">—</span>'
                }
              </div>

              <!-- Prompt -->
              <p class="text-sm text-gray-500 dark:text-[#898A8B] line-clamp-6">${prompt ? escapeHtml(prompt) : 'No prompt available.'}</p>

              <!-- Input fields -->
              ${inputFieldsHtml}

              ${(c.output?.transcript && typeof c.output.transcript === 'string' && c.output.transcript.trim()) ? `
              <!-- Transcript toggle -->
              <div class="transcript-section mt-1">
                <button data-action="toggle-transcript" class="group flex items-center gap-2 w-full px-3 py-2 rounded-xl bg-gray-100 dark:bg-[#1a1a1a] hover:bg-gray-200 dark:hover:bg-[#222] border border-transparent hover:border-gray-200 dark:hover:border-[#333] transition-all">
                  <svg class="w-4 h-4 text-[#9335EC] transition-transform duration-200" data-transcript-chevron fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/></svg>
                  <svg class="w-4 h-4 text-[#9335EC]" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>
                  <span class="text-xs font-semibold text-gray-700 dark:text-[#ccc]">Transcript</span>
                  <span class="ml-auto text-[10px] text-gray-400 dark:text-[#555] group-hover:text-gray-500 dark:group-hover:text-[#777]">tap to expand</span>
                </button>
                <div data-transcript-content class="hidden mt-2">
                  <div class="rounded-xl border border-gray-200 dark:border-[#2a2a2a] bg-white dark:bg-[#111] overflow-hidden">
                    <div class="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-[#222] bg-gray-50 dark:bg-[#161616]">
                      <span class="text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:text-[#666]">Full Transcript</span>
                      <button data-action="copy-transcript" class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#9335EC]/10 hover:bg-[#9335EC]/20 text-[#9335EC] text-[11px] font-semibold transition-colors">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                        Copy
                      </button>
                    </div>
                    <pre class="text-[13px] leading-relaxed whitespace-pre-wrap break-words p-4 overflow-auto max-h-[320px] text-gray-700 dark:text-[#bbb] font-[system-ui,sans-serif]" style="scrollbar-width:thin">${escapeHtml(c.output.transcript)}</pre>
                  </div>
                </div>
              </div>
              ` : ''}

              <!-- Primary actions: Share, Download, Publish -->
              <div class="flex items-center gap-2 pt-2 lg:pt-3">
                <button data-action="share" class="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 dark:text-[#666] hover:text-gray-700 dark:hover:text-[#999] hover:bg-gray-100 dark:hover:bg-[#1a1a1a] transition-all" title="Share">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z"/></svg>
                </button>
                <button data-action="download" class="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 dark:text-[#666] hover:text-gray-700 dark:hover:text-[#999] hover:bg-gray-100 dark:hover:bg-[#1a1a1a] transition-all" title="Download">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>
                </button>
                <button data-action="publish" class="flex items-center gap-1 h-8 px-3 rounded-full bg-primary/90 hover:bg-primary text-primary-foreground text-xs font-medium shadow-sm hover:shadow transition-all" title="${isMultiImage ? 'Publish All' : 'Publish'}">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z"/></svg>
                  ${isMultiImage ? 'Publish All' : 'Publish'}
                </button>
              </div>
            </div>

            <!-- Bottom actions + date -->
            <div class="lg:mt-auto pt-2 lg:pt-4">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-1">
                  <button data-action="copy" class="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 dark:text-[#666] hover:text-gray-700 dark:hover:text-[#999] hover:bg-gray-100 dark:hover:bg-[#1a1a1a] transition-all" title="Copy URL">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                  </button>
                  <!-- Delete button - commented out for now
                  <button data-action="delete" class="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 dark:text-[#666] hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all" title="Delete">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg>
                  </button>
                  -->
                </div>
                ${createdAt ? `<span class="text-xs text-gray-400 dark:text-[#555]"${provider ? ` title="${escapeHtml(provider)}"` : ''}>${escapeHtml(createdAt)}</span>` : ''}
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('.history-list-card').forEach(card => {
      const id = card.dataset.creationId;
      const creation = visibleCreations.find(c => getCreationId(c) === id);
      if (!creation) return;

      const mediaUrl = getMediaUrl(creation);
      const textContent = getFullTextOutput(creation);

      card.querySelectorAll('[data-pick-url]').forEach(cell => {
        cell.onclick = () => openSingleImageModal(cell.dataset.pickUrl, creation);
      });

      const downloadBtn = card.querySelector('[data-action="download"]');
      if (downloadBtn && mediaUrl) {
        downloadBtn.onclick = () => downloadMedia(mediaUrl);
      }

      const copyBtn = card.querySelector('[data-action="copy"]');
      if (copyBtn && mediaUrl) {
        copyBtn.onclick = async () => {
          try {
            await navigator.clipboard.writeText(mediaUrl);
            copyBtn.classList.add('text-green-500', 'dark:text-green-400');
            copyBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>';
            setTimeout(() => {
              copyBtn.classList.remove('text-green-500', 'dark:text-green-400');
              copyBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>';
            }, 2000);
          } catch (e) {
            console.error('Copy failed:', e);
          }
        };
      }

      const copyTextBtn = card.querySelector('[data-action="copy-text"]');
      if (copyTextBtn && textContent) {
        copyTextBtn.onclick = async () => {
          try {
            await navigator.clipboard.writeText(textContent);
            copyTextBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg> Copied!';
            setTimeout(() => {
              copyTextBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg> Copy';
            }, 2000);
          } catch (e) {
            console.error('Copy text failed:', e);
          }
        };
      }

      const shareBtn = card.querySelector('[data-action="share"]');
      if (shareBtn && mediaUrl) {
        shareBtn.onclick = async () => {
          const shareData = {
            title: 'My AI Creation',
            text: creation.prompt || 'Check out my AI creation!',
            url: mediaUrl
          };
          try {
            if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
              await navigator.share(shareData);
            } else {
              await navigator.clipboard.writeText(mediaUrl);
              const originalHtml = shareBtn.innerHTML;
              shareBtn.classList.add('text-green-500', 'dark:text-green-400', 'border-green-300', 'dark:border-green-500/50');
              shareBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>';
              setTimeout(() => {
                shareBtn.classList.remove('text-green-500', 'dark:text-green-400', 'border-green-300', 'dark:border-green-500/50');
                shareBtn.innerHTML = originalHtml;
              }, 2000);
            }
          } catch (e) {
            if (e.name !== 'AbortError') {
              console.error('Share failed:', e);
            }
          }
        };
      }

      const publishBtn = card.querySelector('[data-action="publish"]');
      if (publishBtn && mediaUrl) {
        publishBtn.onclick = () => {
          const publishContext = getPublishContext(creation);
          if (!publishContext) {
            console.error('No publish identifier for publish');
            alert('Cannot publish: missing creation identifier');
            return;
          }
          const allImgs = getAllMediaImages(creation);
          if (typeof window.__AITOPIA_OPEN_PUBLISH_MODAL__ === 'function') {
            window.__AITOPIA_OPEN_PUBLISH_MODAL__({
              agentId: creation.agentId,
              idempotencyKey: publishContext.idempotencyKey,
              sourceRunId: publishContext.sourceRunId,
              input: creation.input || {},
              batchCount: allImgs.length > 1 ? allImgs.length : 1,
              batchImageUrls: allImgs.length > 1 ? allImgs : null,
            });
          } else {
            alert('Publish modal not available. Please refresh the page.');
          }
        };
      }

      const outputContainer = card.querySelector('[data-output-container]');
      if (outputContainer && card.dataset.textOutput === 'true') {
        // Only render if there's actual output
        const out = creation.output;
        if (out && typeof out === 'object' && Object.keys(out).length > 0 && !out.error) {
          renderOutput(outputContainer, out);
        }
      }

      // Transcript toggle
      const transcriptToggle = card.querySelector('[data-action="toggle-transcript"]');
      if (transcriptToggle) {
        const transcriptContent = card.querySelector('[data-transcript-content]');
        const chevron = card.querySelector('[data-transcript-chevron]');
        const hint = transcriptToggle.querySelector('span:last-child');
        transcriptToggle.onclick = () => {
          const isHidden = transcriptContent.classList.toggle('hidden');
          chevron.style.transform = isHidden ? '' : 'rotate(180deg)';
          if (hint) hint.textContent = isHidden ? 'tap to expand' : 'tap to collapse';
        };
      }

      const copyTranscriptBtn = card.querySelector('[data-action="copy-transcript"]');
      if (copyTranscriptBtn && creation.output?.transcript) {
        copyTranscriptBtn.onclick = async () => {
          try {
            await navigator.clipboard.writeText(creation.output.transcript);
            const svgIcon = copyTranscriptBtn.querySelector('svg');
            copyTranscriptBtn.innerHTML = `<svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg> Copied!`;
            setTimeout(() => {
              copyTranscriptBtn.innerHTML = `<svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg> Copy`;
            }, 2000);
          } catch (e) {
            console.error('Copy transcript failed:', e);
          }
        };
      }

      // Mount sliders for multi-image cards
      const sliderEl = card.querySelector('[data-list-slider]');
      if (sliderEl) {
        try {
          const imgs = JSON.parse(sliderEl.dataset.images);
          renderImageSlider(sliderEl, imgs, { showPublish: true, fitContainer: true });

          if (creation) {
            sliderEl.querySelectorAll('button[data-url]').forEach(btn => {
              btn.dataset.localPublish = 'true';
              btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const publishContext = getPublishContext(creation);
                if (!publishContext || typeof window.__AITOPIA_OPEN_PUBLISH_MODAL__ !== 'function') return;
                window.__AITOPIA_OPEN_PUBLISH_MODAL__({
                  agentId: creation.agentId,
                  idempotencyKey: publishContext.idempotencyKey,
                  sourceRunId: publishContext.sourceRunId,
                  input: creation.input || {},
                  selectedOutputUrl: btn.dataset.url,
                });
              });
            });
          }
        } catch (e) { /* ignore parse errors */ }
      }
    });
  }

  function renderGrid() {
    if (!gridContainer) return;
    if (loading) {
      gridContainer.innerHTML = `
        <div class="col-span-full flex items-center justify-center py-16">
          <div class="animate-spin w-8 h-8 border-2 border-primary/90 border-t-transparent rounded-full"></div>
        </div>
      `;
      return;
    }

    const visibleCreations = creations.filter(shouldShowCreation);

    if (visibleCreations.length === 0) {
      gridContainer.innerHTML = `
        <div class="col-span-full flex flex-col items-center justify-center min-h-[200px] text-[#898A8B]">
          <img src="https://aitopia.ai/icons/brush.svg" alt="" class="w-9 h-9 mb-3 opacity-60">
          <p class="text-sm">No creations yet.</p>
        </div>
      `;
      return;
    }
    gridContainer.innerHTML = visibleCreations.map(c => {
      const id = getCreationId(c);
      const mediaUrl = getMediaUrl(c);
      const kind = getMediaKind(c);
      const prompt = c.prompt || c.input?.prompt || c.input?.text || '';
      const isVideo = kind === 'video';
      const isAudio = kind === 'audio';

      let mediaHtml = '';
      if (isVideo) {
        mediaHtml = `<video src="${escapeHtml(mediaUrl)}" class="w-full h-full object-cover" muted loop></video>`;
      } else if (isAudio) {
        mediaHtml = `
          <div class="w-full h-full bg-gradient-to-br from-primary/90/10 to-pink-100 dark:from-primary/90/20 dark:to-pink-500/20 flex flex-col items-center justify-center p-4">
            <svg class="w-10 h-10 text-primary/90 mb-3" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/>
            </svg>
            <audio src="${escapeHtml(mediaUrl)}" controls class="w-full max-w-[150px]"></audio>
          </div>`;
      } else {
        const allImages = getAllMediaImages(c);
        if (allImages.length > 1) {
          mediaHtml = `<div class="relative w-full h-full"><img src="${escapeHtml(allImages[0])}" alt="" class="w-full h-full object-cover"><div class="absolute bottom-1.5 right-1.5 bg-black/60 backdrop-blur-sm text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full">1 / ${allImages.length}</div></div>`;
        } else {
          mediaHtml = `<img src="${escapeHtml(mediaUrl)}" alt="" class="w-full h-full object-cover">`;
        }
      }

      const isHighlighted = highlightedId && id === highlightedId;
      const gridHighlightRing = isHighlighted ? ' border-2 border-[#FFD128] dark:border-[#FFD128]/60' : '';
      const gridHighlightBadge = isHighlighted
        ? `<div class="absolute top-2 left-1/2 -translate-x-1/2 z-10"><span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-[#FFD128]/10 dark:bg-[#FFD128]/15 text-[#FFD128] dark:text-[#FFD128] border border-[#FFD128]/30 dark:border-[#FFD128]/30 shadow-sm animate-pulse">Selected</span></div>`
        : '';

      return `
        <div class="history-grid-item group cursor-pointer${gridHighlightRing}" data-creation-id="${escapeHtml(id)}">
          ${gridHighlightBadge}
          ${mediaHtml}
          <div class="history-grid-overlay">
            <!-- Top actions row -->
            <div class="absolute top-2 left-2 right-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
              <!-- Left: Secondary actions -->
              <div class="flex items-center gap-1">
                <button data-action="copy" class="flex items-center justify-center w-7 h-7 rounded-full bg-black/50 backdrop-blur-sm text-white/70 hover:text-white hover:bg-black/70 transition-all" title="Copy URL">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                </button>
                <!-- Delete button - commented out for now
                <button data-action="delete" class="flex items-center justify-center w-7 h-7 rounded-full bg-black/50 backdrop-blur-sm text-white/70 hover:text-red-400 hover:bg-black/70 transition-all" title="Delete">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg>
                </button>
                -->
              </div>
              <!-- Right: Primary actions -->
              <div class="flex items-center gap-1">
                <button data-action="share" class="flex items-center justify-center w-7 h-7 rounded-full bg-black/50 backdrop-blur-sm text-white/70 hover:text-white hover:bg-black/70 transition-all" title="Share">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z"/></svg>
                </button>
                <button data-action="download" class="flex items-center justify-center w-7 h-7 rounded-full bg-black/50 backdrop-blur-sm text-white/70 hover:text-white hover:bg-black/70 transition-all" title="Download">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>
                </button>
              </div>
            </div>
            <!-- Bottom: Publish button -->
            <div class="absolute bottom-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button data-action="publish" class="flex items-center justify-center gap-1 px-2.5 py-1 rounded-full bg-primary/90 hover:bg-primary text-primary-foreground text-[10px] font-medium shadow-lg transition-all">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z"/></svg>
                Publish
              </button>
            </div>
            <div class="history-grid-prompt">${escapeHtml(prompt)}</div>
          </div>
        </div>
      `;
    }).join('');

    gridContainer.querySelectorAll('.history-grid-item').forEach(item => {
      const id = item.dataset.creationId;
      const creation = visibleCreations.find(c => getCreationId(c) === id);
      if (!creation) return;

      const mediaUrl = getMediaUrl(creation);

      item.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        if (creation) {
          const cid = getCreationId(creation);
          const isRun = Boolean(creation.runId);
          const param = isRun ? 'runId' : 'id';
          window.location.href = `/aitopia/marketplace/outputs.html?${param}=${encodeURIComponent(cid)}`;
        }
      });

      const video = item.querySelector('video');
      if (video) {
        item.addEventListener('mouseenter', () => video.play());
        item.addEventListener('mouseleave', () => { video.pause(); video.currentTime = 0; });
      }

      const downloadBtn = item.querySelector('[data-action="download"]');
      if (downloadBtn && mediaUrl) {
        downloadBtn.onclick = (e) => {
          e.stopPropagation();
          downloadMedia(mediaUrl);
        };
      }

      // Copy button
      const copyBtn = item.querySelector('[data-action="copy"]');
      if (copyBtn && mediaUrl) {
        copyBtn.onclick = async (e) => {
          e.stopPropagation();
          try {
            await navigator.clipboard.writeText(mediaUrl);
            copyBtn.classList.add('!text-green-400');
            copyBtn.innerHTML = '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>';
            setTimeout(() => {
              copyBtn.classList.remove('!text-green-400');
              copyBtn.innerHTML = '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>';
            }, 2000);
          } catch (err) {
            console.error('Copy failed:', err);
          }
        };
      }

      const shareBtn = item.querySelector('[data-action="share"]');
      if (shareBtn && mediaUrl) {
        shareBtn.onclick = async (e) => {
          e.stopPropagation();
          const shareData = {
            title: 'My AI Creation',
            text: creation.prompt || 'Check out my AI creation!',
            url: mediaUrl
          };
          try {
            if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
              await navigator.share(shareData);
            } else {
              await navigator.clipboard.writeText(mediaUrl);
              shareBtn.classList.add('!bg-green-500', '!text-white');
              shareBtn.innerHTML = '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>';
              setTimeout(() => {
                shareBtn.classList.remove('!bg-green-500', '!text-white');
                shareBtn.innerHTML = '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z"/></svg>';
              }, 2000);
            }
          } catch (err) {
            if (err.name !== 'AbortError') console.error('Share failed:', err);
          }
        };
      }

      const publishBtn = item.querySelector('[data-action="publish"]');
      if (publishBtn && mediaUrl) {
        publishBtn.onclick = (e) => {
          e.stopPropagation();
          const publishContext = getPublishContext(creation);
          if (!publishContext) {
            console.error('No publish identifier for publish');
            alert('Cannot publish: missing creation identifier');
            return;
          }
          if (typeof window.__AITOPIA_OPEN_PUBLISH_MODAL__ === 'function') {
            window.__AITOPIA_OPEN_PUBLISH_MODAL__({
              agentId: creation.agentId,
              idempotencyKey: publishContext.idempotencyKey,
              sourceRunId: publishContext.sourceRunId,
              input: creation.input || {},
            });
          } else {
            alert('Publish modal not available. Please refresh the page.');
          }
        };
      }

      const deleteBtn = item.querySelector('[data-action="delete"]');
      if (deleteBtn) {
        deleteBtn.onclick = (e) => {
          e.stopPropagation();
          if (confirm('Are you sure you want to delete this creation?')) {
            creations = creations.filter(c => getCreationId(c) !== id);
            renderGrid();
          }
        };
      }

      const rerunBtn = item.querySelector('[data-action="rerun"]');
      if (rerunBtn) {
        rerunBtn.onclick = (e) => {
          e.stopPropagation();
          if (creation && onSelect) {
            selectedId = id;
            onSelect(creation);
          }
        };
      }
    });
  }

  function setViewMode(mode) {
    currentViewMode = mode;
    if (mode === 'grid') {
      renderGrid();
    } else {
      renderList();
    }
  }

  function renderAuthPrompt() {
    listEl.innerHTML = `
      <div class="col-span-full rounded-2xl border border-border bg-card/50 p-12 text-center">
        <svg class="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" fill="none" stroke="currentColor" stroke-width="1" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"/>
        </svg>
        <p class="text-muted-foreground font-medium">Sign in to see your creations</p>
        <p class="text-sm text-muted-foreground/70 mt-1">Your generated content will appear here</p>
      </div>
    `;
  }

  /**
   * Resume polling for in-progress queue items after page load/refresh.
   * Uses the same /jobs/:id endpoint that the generate flow uses.
   */
  function resumePollingForInProgressItems() {
    const inProgress = creations.filter(isCreationInProgress);
    if (inProgress.length === 0) return;

    for (const creation of inProgress) {
      const id = getCreationId(creation);
      if (!id || _activePollers.has(id)) continue;

      // Use jobId for polling /jobs/ endpoint; fall back to creation id
      const pollId = creation.jobId || id;

      console.log('[creation-history] Resuming poll for job:', pollId, 'creation:', id,creation);

      let consecutiveErrors = 0;
      // Mutable ref: enriched with job data on first successful poll
      let enrichedCreation = creation;
      if (pollId.indexOf("runner-")!== -1) return;
      const intervalId = setInterval(async () => {
        let job;
        try {
          job = await getJob(pollId);
          consecutiveErrors = 0;
        } catch (err) {
          consecutiveErrors += 1;
          console.warn('[creation-history] Poll error for', id, err?.message);
          // Give up after 10 consecutive errors
          if (consecutiveErrors >= 10) {
            console.error('[creation-history] Too many poll errors, stopping poll for', id);
            clearInterval(intervalId);
            _activePollers.delete(id);
          }
          return;
        }

        // Enrich creation with input/prompt from job response (first successful poll fills gaps)
        if (job.input && typeof job.input === 'object') {
          const jobInput = job.input;
          const existingInput = enrichedCreation.input || {};
          const mergedInput = { ...jobInput, ...existingInput };
          const prompt = enrichedCreation.prompt || jobInput.prompt || jobInput.text || '';
          enrichedCreation = {
            ...enrichedCreation,
            input: mergedInput,
            prompt,
            agentId: enrichedCreation.agentId || job.agentId || '',
            modelUsed: enrichedCreation.modelUsed || job.modelId || enrichedCreation.modelId || job.agentId || '',
          };
        }
        const resolvedRunId = job.runId || id;

        const isTerminal = job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled';

        if (isTerminal) {
          clearInterval(intervalId);
          _activePollers.delete(id);

          const updatedEntry = {
            ...enrichedCreation,
            id: resolvedRunId,
            runId: resolvedRunId,
            idempotencyKey: enrichedCreation.idempotencyKey || resolvedRunId,
            status: job.status === 'completed' ? 'Completed' : 'Failed',
            output: job.output || (job.status === 'failed' ? { error: job.error?.message || 'Job failed' } : undefined),
            completedAt: job.completedAt || new Date().toISOString(),
          };
          removeCreation(resolvedRunId);
          addCreation(updatedEntry);
          return;
        }

        // Still running — update progress in the card
        const rawPct = typeof job.progress === 'number' && Number.isFinite(job.progress) ? job.progress : null;
        const pct = rawPct != null ? (rawPct > 0 && rawPct < 1 ? Math.round(rawPct * 100) : Math.round(rawPct)) : null;
        const pctText = pct != null ? ` (${pct}%)` : '';
        const statusText = job.status === 'pending' ? 'In Queue' : `Running${pctText}`;
        removeCreation(resolvedRunId);
        removeCreation(id);
        addCreation({
          ...enrichedCreation,
          id,
          runId: resolvedRunId,
          status: statusText,
        });
      }, 2000);

      _activePollers.set(id, intervalId);
    }

    if (_activePollers.size > 0) {
      console.log('[creation-history] Resumed polling for', _activePollers.size, 'in-progress items');
    }
  }

  async function load() {
    if (loading) return;
    loading = true;
    renderList();

    try {
      const params = new URLSearchParams({ limit: '50' });
      if (sourceStoreId) params.set('agentId', sourceStoreId);

      console.log('[creation-history] Loading for agent:', sourceStoreId);

      const res = await fetch(`https://aitopia.ai/api/me/creations?${params}`, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Accept': 'application/json' },
      });

      console.log('[creation-history] Status:', res.status);

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          creations = [];
          loading = false;
          renderAuthPrompt();
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }

      const json = await res.json();
      console.log('[creation-history] Response:', json);

      const fetched = Array.isArray(json.creations) ? json.creations : [];
      // Merge with any local draft/running entries already inserted (avoid wiping them)
      creations = mergeCreationsPreferExisting(creations, fetched);
      console.log('[creation-history] Creations count:', creations.length);

      // Also fetch active queue items so in-progress jobs survive page refresh
      try {
        const qRes = await fetch('https://aitopia.ai/api/queue?limit=20&status=pending,processing', {
          method: 'GET',
          credentials: 'include',
          headers: { 'Accept': 'application/json' },
        });
        if (qRes.ok) {
          const qJson = await qRes.json();
          const qItems = Array.isArray(qJson?.items) ? qJson.items : [];
          // Convert queue items to creation-like entries and merge
          const queueCreations = qItems
            .filter(qi => !sourceStoreId || qi.agentId === sourceStoreId)
            .map(qi => ({
              id: qi.refId || qi.id,
              runId: qi.refId || qi.id,
              idempotencyKey: qi.refId || qi.id,
              agentId: qi.agentId || '',
              modelUsed: qi.modelId || qi.agentId || '',
              prompt: qi.input?.prompt || qi.input?.text || '',
              input: qi.input || {},
              status: qi.status === 'pending' ? 'In Queue' : `Running (${qi.progress || 0}%)`,
              notificationRead: qi.notificationRead ?? 0,
              createdAt: qi.createdAt || new Date().toISOString(),
            }));
          if (queueCreations.length > 0) {
            creations = mergeCreationsPreferExisting(creations, queueCreations);
            console.log('[creation-history] Merged queue items:', queueCreations.length);
          }
        }
      } catch (qErr) {
        console.warn('[creation-history] Queue fetch failed (non-fatal):', qErr);
      }

    } catch (err) {
      console.error('[creation-history] Error:', err);
      // Keep any local entries we already had
      creations = Array.isArray(creations) ? creations : [];
    } finally {
      loading = false;
      renderList();
      // Resume polling for any in-progress items found after page refresh
      resumePollingForInProgressItems();
    }
  }

  function addCreation(creation) {
    if (!creation) return;
    const id = getCreationId(creation);
    const status = typeof creation.status === 'string' ? creation.status.toLowerCase() : '';
    const isRunningOrPending = status.includes('running') || status.includes('queue') || status.includes('pending') || status.includes('upload');

    creations = creations.filter(c => getCreationId(c) !== id);
    creations.unshift(creation);
    selectedId = id;
    hideSelectedInList = !getMediaUrl(creation);

    // For running/pending items: try lightweight DOM update on existing card
    if (isRunningOrPending) {
      const existingCard = listEl?.querySelector(`[data-creation-id="${CSS.escape(id)}"]`);
      if (existingCard) {
        // Check if status category changed (uploading↔queue↔running) — needs full re-render for colors
        const wasUploading = existingCard.classList.contains('history-list-card-progress') &&
          existingCard.querySelector('.text-blue-500, .border-blue-500');
        const wasQueued = !wasUploading && existingCard.classList.contains('history-list-card-progress') &&
          existingCard.querySelector('[data-status-queued]');
        const nowUploading = status.includes('upload');
        const nowQueued = !nowUploading && (status.includes('queue') || status.includes('pending'));
        const prevCategory = wasUploading ? 'upload' : wasQueued ? 'queue' : 'running';
        const currCategory = nowUploading ? 'upload' : nowQueued ? 'queue' : 'running';
        const categoryChanged = prevCategory !== currCategory;

        if (categoryChanged) {
          // Status category changed — replace entire card HTML for correct colors
          const tmp = document.createElement('div');
          tmp.innerHTML = renderInProgressCard(creation);
          const newCard = tmp.firstElementChild;
          if (newCard) existingCard.replaceWith(newCard);
          return;
        }

        // Same category — lightweight DOM update (text + progress only)
        const progressEl = existingCard.querySelector('[data-progress-status]');
        const statusBase = nowUploading ? 'Uploading' : nowQueued ? 'In Queue' : 'Processing';
        if (progressEl) progressEl.textContent = statusBase;
        const match = (creation.status || '').match(/\((\d+)%\)/);
        if (match) {
          const pctVal = match[1];
          const barEl = existingCard.querySelector('[data-progress-pct]');
          if (barEl) barEl.style.width = `${pctVal}%`;
          const circleEl = existingCard.querySelector('[data-progress-circle-pct]');
          if (circleEl) {
            circleEl.textContent = `${pctVal}%`;
          } else {
            // First time showing percentage — need full re-render to swap icon → number
            const tmp = document.createElement('div');
            tmp.innerHTML = renderInProgressCard(creation);
            const newCard = tmp.firstElementChild;
            if (newCard) existingCard.replaceWith(newCard);
          }
        }
        return;
      }
      // No existing card → fall through to full render to show new queue item
    }

    if (currentViewMode === 'grid') {
      renderGrid();
    } else {
      renderList();
    }
  }

  window.addEventListener('history-view-change', (e) => {
    setViewMode(e.detail?.mode || 'list');
  });

  /**
   * Find a creation by jobId (matches runId, id, or idempotencyKey) and auto-select it.
   * Should be called after load() completes.
   */
  function selectByJobId(jobId) {
    if (!jobId) return false;
    const match = creations.find(c => {
      const cId = getCreationId(c);
      return cId === jobId || c.runId === jobId || c.id === jobId || c.idempotencyKey === jobId || c.jobId === jobId;
    });
    if (match) {
      selectedId = getCreationId(match);
      highlightedId = selectedId;
      if (currentViewMode === 'grid') {
        renderGrid();
      } else {
        renderList();
      }
      // Scroll to the highlighted card after render
      requestAnimationFrame(() => {
        const card = (listEl || gridContainer)?.querySelector(`[data-creation-id="${CSS.escape(selectedId)}"]`);
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
      return true;
    }
    return false;
  }

  function removeCreation(id) {
    if (!id) return;
    creations = creations.filter(c => getCreationId(c) !== id);
    const card = listEl?.querySelector(`[data-creation-id="${CSS.escape(id)}"]`);
    if (card) card.remove();
    const gridCard = gridContainer?.querySelector(`[data-creation-id="${CSS.escape(id)}"]`);
    if (gridCard) gridCard.remove();
  }

  return { load, refresh: load, setViewMode, addCreation, removeCreation, selectByJobId };
}
