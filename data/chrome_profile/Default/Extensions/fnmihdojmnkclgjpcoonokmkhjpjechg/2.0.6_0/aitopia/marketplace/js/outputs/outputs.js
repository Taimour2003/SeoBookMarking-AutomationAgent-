import { fetchHelper } from '../shared/fetch-helper.js';
import {
  openCreationModal as sharedOpenModal,
  closeCreationModal as sharedCloseModal,
  openPublishModal,
  escapeHtml,
  formatRelativeTime,
} from '../shared/creation-modal.js?v=2';
import { getJob } from '../shared/api.js';

const el = {
  tabCommunity: document.getElementById('tabCommunity'),
  tabMine: document.getElementById('tabMine'),
  searchInput: document.getElementById('searchInput'),
  notice: document.getElementById('notice'),
  grid: document.getElementById('grid'),
  emptyState: document.getElementById('emptyState'),
  loadMore: document.getElementById('loadMore'),
  scrollSentinel: document.getElementById('scrollSentinel'),
  // Modal elements
  detailModal: document.getElementById('detailModal'),
  modalMediaArea: document.getElementById('modalMediaArea'),
  modalClose: document.getElementById('modalClose'),
  modalCloseMobile: document.getElementById('modalCloseMobile'),
  modalMedia: document.getElementById('modalMedia'),
  modalShare: document.getElementById('modalShare'),
  shareDropdown: document.getElementById('shareDropdown'),
  shareCopyLink: document.getElementById('shareCopyLink'),
  shareEmail: document.getElementById('shareEmail'),
  shareTwitter: document.getElementById('shareTwitter'),
  shareFacebook: document.getElementById('shareFacebook'),
  shareLinkedIn: document.getElementById('shareLinkedIn'),
  shareWhatsApp: document.getElementById('shareWhatsApp'),
  modalAvatar: document.getElementById('modalAvatar'),
  modalAuthorName: document.getElementById('modalAuthorName'),
  modalAvatarMobile: document.getElementById('modalAvatarMobile'),
  modalAuthorNameMobile: document.getElementById('modalAuthorNameMobile'),
  modalCopyPrompt: document.getElementById('modalCopyPrompt'),
  modalPrompt: document.getElementById('modalPrompt'),
  modalInputMedia: document.getElementById('modalInputMedia'),
  modalInputMediaGrid: document.getElementById('modalInputMediaGrid'),
  modalTransitionPreview: document.getElementById('modalTransitionPreview'),
  modalTransitionVideo: document.getElementById('modalTransitionVideo'),
  modalTransitionType: document.getElementById('modalTransitionType'),
  modalInfoRows: document.getElementById('modalInfoRows'),
  modalSeeAll: document.getElementById('modalSeeAll'),
  modalExtraInfo: document.getElementById('modalExtraInfo'),
  modalTopActions: document.getElementById('modalTopActions'),
  modalRecreate: document.getElementById('modalRecreate'),
  modalPublish: document.getElementById('modalPublish'),
  modalDownload: document.getElementById('modalDownload'),
  modalUpscale: document.getElementById('modalUpscale'),
  // Report
  modalReportWrap: document.getElementById('modalReportWrap'),
  modalReport: document.getElementById('modalReport'),
  modalReportOverlay: document.getElementById('modalReportOverlay'),
  modalReportBackdrop: document.getElementById('modalReportBackdrop'),
  modalReportClose: document.getElementById('modalReportClose'),
  modalReportForm: document.getElementById('modalReportForm'),
  modalReportReason: document.getElementById('modalReportReason'),
  modalReportDetails: document.getElementById('modalReportDetails'),
  modalReportSubmitBtn: document.getElementById('modalReportSubmitBtn'),
  modalReportCancelBtn: document.getElementById('modalReportCancelBtn'),
};

let currentOutput = null;
const _activePollers = new Map(); // id → intervalId
let masonryInstance = null;

function initMasonry() {
  if (!el.grid || typeof Masonry === 'undefined') return;
  masonryInstance = new Masonry(el.grid, {
    itemSelector: '.creations-card',
    columnWidth: '.grid-sizer',
    percentPosition: true,
    gutter: 8,
  });
  window.masonryInstance = masonryInstance;
  // Re-layout after all images load to prevent overlapping
  if (typeof imagesLoaded !== 'undefined') {
    imagesLoaded(el.grid).on('progress', () => {
      masonryInstance.layout();
    });
  }

  el.grid.querySelectorAll('video').forEach(video => {
    video.addEventListener('loadeddata', () => {
      if (masonryInstance) masonryInstance.layout();
    });
  });
}


function isImageUrl(url) {
  if (typeof url !== 'string') return false;
  const lower = url.toLowerCase();
  return /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(lower) ||
         lower.includes('/image') ||
         lower.includes('cdn.') ||
         lower.includes('storage.') ||
         lower.includes('replicate.delivery') ||
         lower.includes('fal.media');
}

function isVideoUrl(url) {
  if (typeof url !== 'string') return false;
  const lower = url.toLowerCase();
  return /\.(mp4|webm|mov|avi|mkv)(\?|$)/i.test(lower) ||
         lower.includes('/video');
}

function extractInputMedia(input) {
  const media = [];
  if (!input || typeof input !== 'object') return media;

  const mediaFields = [
    'imageUrl', 'image_url', 'image', 'inputImage', 'input_image',
    'sourceImage', 'source_image', 'targetImage', 'target_image',
    'faceImage', 'face_image', 'referenceImage', 'reference_image',
    'videoUrl', 'video_url', 'video', 'inputVideo', 'input_video',
    'sourceVideo', 'source_video', 'audioUrl', 'audio_url', 'audio',
    'maskImage', 'mask_image', 'mask', 'humanImage', 'human_image',
    'clothImage', 'cloth_image', 'garmentImage', 'garment_image',
    'firstImage', 'first_image', 'secondImage', 'second_image',
    'startImage', 'start_image', 'endImage', 'end_image',
    'backgroundImage', 'background_image', 'foregroundImage', 'foreground_image'
  ];

  const isMediaValue = (val) => {
    if (typeof val !== 'string') return false;
    return val.startsWith('http') || val.startsWith('data:');
  };

  const getDataUriType = (val) => {
    if (!val.startsWith('data:')) return null;
    if (val.startsWith('data:video/')) return 'video';
    if (val.startsWith('data:image/')) return 'image';
    if (val.startsWith('data:audio/')) return 'audio';
    return null;
  };

  const checkObj = (obj, prefix = '') => {
    if (!obj || typeof obj !== 'object') return;

    for (const [key, value] of Object.entries(obj)) {
      if (isMediaValue(value)) {
        const keyLower = key.toLowerCase();
        const isVideoField = keyLower.includes('video');
        const isAudioField = keyLower.includes('audio');
        const dataUriType = getDataUriType(value);

        if (dataUriType === 'video' || isVideoUrl(value) || isVideoField) {
          media.push({ type: 'video', url: value, label: formatFieldLabel(key) });
        } else if (dataUriType === 'audio' || isAudioField) {
        } else if (dataUriType === 'image' || isImageUrl(value) || mediaFields.some(f => keyLower.includes(f.toLowerCase()))) {
          media.push({ type: 'image', url: value, label: formatFieldLabel(key) });
        }
      } else if (Array.isArray(value)) {
        const keyLower = key.toLowerCase();
        const isVideoField = keyLower.includes('video');
        value.forEach((item, idx) => {
          if (isMediaValue(item)) {
            const dataUriType = getDataUriType(item);
            if (dataUriType === 'video' || isVideoUrl(item) || isVideoField) {
              media.push({ type: 'video', url: item, label: `${formatFieldLabel(key)} ${idx + 1}` });
            } else if (dataUriType === 'image' || isImageUrl(item)) {
              media.push({ type: 'image', url: item, label: `${formatFieldLabel(key)} ${idx + 1}` });
            }
          }
        });
      }
    }
  };

  checkObj(input);

  if (input.parameters && typeof input.parameters === 'object') {
    checkObj(input.parameters);
  }

  if (input.task && typeof input.task === 'object') {
    checkObj(input.task);
  }

  if (Array.isArray(input.clips)) {
    input.clips.forEach((clip, idx) => {
      if (clip && typeof clip === 'object' && clip.videoUrl && isMediaValue(clip.videoUrl)) {
        const ordinals = ['First', 'Second', 'Third', 'Fourth', 'Fifth'];
        const label = ordinals[idx] || `Clip ${idx + 1}`;
        media.push({ type: 'video', url: clip.videoUrl, label: `${label} Video` });
      }
    });
  }

  return media;
}

function formatFieldLabel(fieldName) {
  const numberedMatch = fieldName.match(/^(.+?)(\d+)$/);
  let baseName = numberedMatch ? numberedMatch[1] : fieldName;
  const number = numberedMatch ? numberedMatch[2] : null;

  const ordinals = { '1': 'First', '2': 'Second', '3': 'Third', '4': 'Fourth', '5': 'Fifth' };

  let label = baseName
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/url$/i, '')
    .replace(/image$/i, '')
    .replace(/video$/i, '')
    .trim()
    .split(' ')
    .filter(w => w.length > 0)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
    .trim() || 'Input';

  if (number && ordinals[number]) {
    label = `${ordinals[number]} ${label}`;
  } else if (number) {
    label = `${label} ${number}`;
  }

  return label;
}

function renderInputMedia(mediaItems) {
  if (!el.modalInputMedia || !el.modalInputMediaGrid) return;

  if (!mediaItems || mediaItems.length === 0) {
    el.modalInputMedia.classList.add('hidden');
    el.modalInputMediaGrid.innerHTML = '';
    return;
  }

  el.modalInputMedia.classList.remove('hidden');
  el.modalInputMediaGrid.innerHTML = mediaItems.map(item => {
    if (item.type === 'video') {
      return `
        <div class="relative group">
          <video src="${escapeHtml(item.url)}" class="w-full aspect-square object-cover rounded-lg" autoplay muted loop playsinline></video>
          <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
            <span class="text-white text-xs font-medium px-2 py-1 bg-black/50 rounded">${escapeHtml(item.label)}</span>
          </div>
        </div>
      `;
    }
    return `
      <div class="relative group">
        <img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.label)}" class="w-full aspect-square object-cover rounded-lg" loading="lazy" data-remove-parent-on-error />
        <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
          <span class="text-white text-xs font-medium px-2 py-1 bg-black/50 rounded">${escapeHtml(item.label)}</span>
        </div>
      </div>
    `;
  }).join('');

  el.modalInputMediaGrid.querySelectorAll('video').forEach(video => {
    video.play().catch(() => {});
  });
}

function getTransitionVideoUrl(transitionType) {
  if (!transitionType) return null;
  const normalized = transitionType.toLowerCase().replace(/\s+/g, '-');
  const typeMap = {
    'fire-lava': 'firelava',
    'firelava': 'firelava',
    'seamless': 'morph',
  };
  const filename = typeMap[normalized] || normalized;
  return `/agent-images/transition-${filename}.mp4`;
}

function renderTransitionPreview(sourceStoreId, input) {
  if (!el.modalTransitionPreview || !el.modalTransitionVideo || !el.modalTransitionType) return;

  if (sourceStoreId !== 'transitions') {
    el.modalTransitionPreview.classList.add('hidden');
    return;
  }

  const transitionType = input?.parameters?.transitionType || input?.transitionType;
  if (!transitionType) {
    el.modalTransitionPreview.classList.add('hidden');
    return;
  }

  const videoUrl = getTransitionVideoUrl(transitionType);
  el.modalTransitionVideo.src = videoUrl;
  el.modalTransitionType.textContent = transitionType.toUpperCase();
  el.modalTransitionPreview.classList.remove('hidden');
  el.modalTransitionVideo.play().catch(() => {});
}

async function fetchOutputDetails(outputId) {
  if (!outputId) return null;
  try {
    const res = await fetchHelper(`https://aitopia.ai/api/outputs/${encodeURIComponent(outputId)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'include',
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json || null;
  } catch (e) {
    console.error('Failed to fetch output details:', e);
    return null;
  }
}

async function fetchRunDetails(runId) {
  if (!runId) return null;
  try {
    const res = await fetchHelper(`https://aitopia.ai/api/me/creations/${encodeURIComponent(runId)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'include',
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json?.run?.input) {
      const modelId = json.run?.modelId || json.charge?.modelId || null;
      return { sourceRun: { input: json.run.input }, modelId };
    }
    return null;
  } catch (e) {
    console.error('Failed to fetch run details:', e);
    return null;
  }
}

function getCreatorDisplay(output, fallback) {
  const profile = output?.creatorProfile || output?.creator;
  if (profile?.username) {
    const href = `/u/${encodeURIComponent(profile.username)}`;
    return `<a href="${href}" class="text-primary hover:underline">@${escapeHtml(profile.username)}</a>`;
  }
  const uid = output?.creatorUserId;
  if (uid) return escapeHtml(String(uid).slice(0, 12));
  return escapeHtml(fallback || 'anonymous');
}

// escapeHtml and formatRelativeTime imported from shared/creation-modal.js

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

function setActiveTab(tab) {
  const on = (btn) => {
    btn.classList.add('bg-background', 'shadow-sm');
    btn.classList.remove('text-muted-foreground');
  };
  const off = (btn) => {
    btn.classList.remove('bg-background', 'shadow-sm');
    btn.classList.add('text-muted-foreground');
  };

  if (tab === 'mine') {
    off(el.tabCommunity);
    on(el.tabMine);
  } else {
    on(el.tabCommunity);
    off(el.tabMine);
  }
}

function cardBadge(text, tone) {
  const base = 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold';
  if (tone === 'green') return `<span class="${base} bg-green-500/15 text-green-500">${escapeHtml(text)}</span>`;
  if (tone === 'red') return `<span class="${base} bg-red-500/15 text-red-500">${escapeHtml(text)}</span>`;
  if (tone === 'amber') return `<span class="${base} bg-amber-500/15 text-amber-500">${escapeHtml(text)}</span>`;
  return `<span class="${base} bg-secondary text-muted-foreground">${escapeHtml(text)}</span>`;
}

/**
 * Open modal with URL state push
 */
function openModal(output) {
  currentOutput = output;
  const isOwn = state.tab === 'mine' || Boolean(output?.runId);
  (el.modalReportWrap || el.modalReport)?.classList.add('hidden'); // hide until confirmed
  sharedOpenModal(output, {
    elements: el,
    pushState: true,
    isOwner: isOwn,
    getAuthorName: (o) => {
      const profile = o?.creatorProfile || o?.creator;
      return profile?.username || (isOwn ? 'You' : 'Anonymous');
    },
  });
  if (output?.id) updateReportButton(output.id);
}

/**
 * Open modal without URL state push (for popstate events)
 */
function openModalWithoutPush(output) {
  currentOutput = output;
  const isOwn = state.tab === 'mine' || Boolean(output?.runId);
  el.modalReport?.classList.add('hidden');
  sharedOpenModal(output, {
    elements: el,
    pushState: false,
    isOwner: isOwn,
    getAuthorName: (o) => {
      const profile = o?.creatorProfile || o?.creator;
      return profile?.username || (isOwn ? 'You' : 'Anonymous');
    },
  });
  if (output?.id) updateReportButton(output.id);
}

function createInfoRow(label, value, thumbnail = null, allowWrap = false, isMediaRow = false) {
  const thumbHtml = thumbnail
    ? `<img src="${escapeHtml(thumbnail)}" alt="" class="w-9 h-9 rounded-lg object-cover flex-shrink-0 creation-info-media-thumb" data-remove-parent-on-error />`
    : '';
  const valueStr = String(value ?? '').trim() || '—';
  const valueClasses = allowWrap
    ? 'text-foreground text-sm font-medium text-left break-words whitespace-normal'
    : 'text-foreground text-sm font-medium text-right truncate';
  const rowLayout = allowWrap
    ? 'flex flex-col gap-1 py-3 border-b border-border/50 last:border-0'
    : 'flex items-center justify-between gap-3 py-3 border-b border-border/50 last:border-0';
  const mediaClass = isMediaRow ? ' creation-info-row--media' : '';
  return `
    <div class="${rowLayout}${mediaClass}">
      <span class="text-muted-foreground text-sm flex-shrink-0">${escapeHtml(label)}</span>
      <div class="flex items-center gap-2 min-w-0 ${allowWrap ? 'flex-col items-stretch' : 'justify-end'}">
        <span class="${valueClasses} ${allowWrap ? 'w-full' : ''}">${escapeHtml(valueStr)}</span>
        ${thumbHtml}
      </div>
    </div>
  `;
}

function closeModal() {
  if (!el.detailModal) return;

  el.detailModal.classList.add('hidden');
  document.body.style.overflow = '';
  currentOutput = null;
  closeShareDropdown();
  closeReportModal();
  (el.modalReportWrap || el.modalReport)?.classList.add('hidden');

  const bottomNav = document.querySelector('[data-bottom-tabs]');
  if (bottomNav) bottomNav.style.display = '';
  const topNav = document.getElementById('header');
  if (topNav) topNav.style.display = '';

  if (el.modalMedia) {
    const video = el.modalMedia.querySelector('video');
    const audio = el.modalMedia.querySelector('audio');
    if (video) video.pause();
    if (audio) audio.pause();
  }

  // Clean URL params without navigating away
  const url = new URL(window.location.href);
  if (url.searchParams.has('id') || url.searchParams.has('runId')) {
    url.searchParams.delete('id');
    url.searchParams.delete('runId');
    window.history.replaceState({}, '', url.toString());
  }
}

/* ---------- Report helpers ---------- */

const REPORT_REASON_LABELS = { nsfw: 'NSFW / Sexual content', spam: 'Spam', copyright: 'Copyright', hate: 'Hate / Harassment', violence: 'Violence', impersonation: 'Impersonation', other: 'Other' };
const FLAG_SVG = '<svg class="w-3 h-3 inline-block mr-0.5 align-[-1px]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5"/></svg>';

function applyReportBtnState(btn, viewer) {
  const textMode = btn.dataset.reportTextMode === 'true';
  const hasReported = Boolean(viewer?.hasReported);

  if (hasReported) {
    const label = REPORT_REASON_LABELS[viewer?.reportReason] || viewer?.reportReason || 'Reported';
    btn.disabled = true;
    if (textMode) {
      btn.innerHTML = `${FLAG_SVG} Reported: ${escapeHtml(label)}`;
      btn.className = 'text-xs text-red-500/70 cursor-not-allowed transition-colors';
    } else {
      btn.innerHTML = `${FLAG_SVG} Reported: ${escapeHtml(label)}`;
      btn.className = 'w-full h-11 flex items-center justify-center gap-2 rounded-ios-xl bg-secondary text-foreground text-sm font-medium opacity-60 cursor-not-allowed transition-colors';
    }
  } else {
    btn.disabled = false;
    if (textMode) {
      btn.innerHTML = `${FLAG_SVG} Report`;
      btn.className = 'text-xs text-muted-foreground hover:text-foreground transition-colors';
    } else {
      btn.innerHTML = `${FLAG_SVG} Report`;
      btn.className = 'w-full h-11 flex items-center justify-center gap-2 rounded-ios-xl bg-secondary hover:bg-secondary/80 text-foreground text-sm font-medium transition-colors';
    }
  }
}

function updateReportButton(outputId) {
  const wrap = el.modalReportWrap || el.modalReport;
  if (!el.modalReport || !outputId) {
    wrap?.classList.add('hidden');
    return;
  }
  fetchOutputDetails(outputId).then(details => {
    if (!details) { wrap?.classList.add('hidden'); return; }
    const visibility = details.output?.visibility || 'private';
    const moderation = details.output?.moderationStatus || 'pending';
    const isOwner = Boolean(details.viewer?.isOwner);
    const shouldHide = isOwner || visibility !== 'public' || moderation !== 'approved';
    wrap?.classList.toggle('hidden', shouldHide);
    if (!shouldHide && el.modalReport) applyReportBtnState(el.modalReport, details.viewer);
  }).catch(() => wrap?.classList.add('hidden'));
}

function openReportModal() {
  if (el.modalReportOverlay) {
    el.modalReportOverlay.classList.remove('hidden');
    if (el.modalReportReason) el.modalReportReason.value = 'nsfw';
    if (el.modalReportDetails) el.modalReportDetails.value = '';
  }
}

function closeReportModal() {
  if (el.modalReportOverlay) el.modalReportOverlay.classList.add('hidden');
}

async function submitModalReport(e) {
  e.preventDefault();
  const outputId = currentOutput?.id;
  if (!outputId) return;

  if (el.modalReportSubmitBtn) {
    el.modalReportSubmitBtn.disabled = true;
    el.modalReportSubmitBtn.textContent = 'Submitting…';
  }

  try {
    const reason = el.modalReportReason?.value ?? 'other';
    const details = (el.modalReportDetails?.value ?? '').trim() || undefined;
    if (reason === 'other' && !details) {
      alert('Please provide details when selecting "Other".');
      if (el.modalReportSubmitBtn) { el.modalReportSubmitBtn.disabled = false; el.modalReportSubmitBtn.textContent = 'Submit report'; }
      return;
    }
    const body = { reason, details };

    const res = await fetchHelper(`https://aitopia.ai/api/outputs/${encodeURIComponent(outputId)}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });

    if (res.status === 409) {
      alert('You have already reported this content.');
      closeReportModal();
      return;
    }
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      alert(json?.error?.message || json?.error || `Failed to report (${res.status})`);
      return;
    }

    closeReportModal();
    if (el.modalReport) {
      const reason = el.modalReportReason?.value ?? 'other';
      applyReportBtnState(el.modalReport, { hasReported: true, reportReason: reason });
    }
    alert('Report submitted. Thank you.');
  } finally {
    if (el.modalReportSubmitBtn) {
      el.modalReportSubmitBtn.disabled = false;
      el.modalReportSubmitBtn.textContent = 'Submit report';
    }
  }
}

/* ---------- End Report helpers ---------- */

async function copyPromptToClipboard() {
  if (!currentOutput) return;
  const prompt = currentOutput?.prompt ?? currentOutput?.description ?? '';
  if (!prompt) return;
  const btn = el.modalCopyPrompt;
  try {
    await navigator.clipboard.writeText(prompt);
    if (btn) {
      const origText = btn.textContent;
      btn.textContent = 'Copied!';
      btn.classList.add('bg-primary', 'text-primary-foreground');
      btn.classList.remove('bg-secondary');
      setTimeout(() => {
        btn.textContent = origText;
        btn.classList.remove('bg-primary', 'text-primary-foreground');
        btn.classList.add('bg-secondary');
      }, 1800);
    }
  } catch (e) {
    console.error('Failed to copy:', e);
  }
}

async function downloadMedia() {
  if (!currentOutput) return;
  const previewUrl = currentOutput?.preview?.url;
  if (!previewUrl) return;
  try {
    const response = await fetch(previewUrl);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const ext = currentOutput?.preview?.kind === 'video' ? 'mp4' : currentOutput?.preview?.kind === 'audio' ? 'mp3' : 'png';
    a.download = `creation-${currentOutput?.id || 'download'}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch (e) {
    console.error('Failed to download:', e);
    window.open(previewUrl, '_blank');
  }
}

function toggleShareDropdown(e) {
  e?.stopPropagation();
  el.shareDropdown?.classList.toggle('hidden');
}

function closeShareDropdown() {
  el.shareDropdown?.classList.add('hidden');
}

function getShareUrl() {
  if (!currentOutput) return window.location.href;
  const id = currentOutput?.id;
  const runId = currentOutput?.runId;
  if (id) {
    return `${window.location.origin}/creations?id=${encodeURIComponent(id)}`;
  } else if (runId) {
    return `${window.location.origin}/creations?runId=${encodeURIComponent(runId)}`;
  }
  return currentOutput?.preview?.url || window.location.href;
}

function getShareText() {
  if (!currentOutput) return 'Check out this creation on AITOPIA';
  return currentOutput?.title || currentOutput?.prompt || 'Check out this creation on AITOPIA';
}

async function shareCopyLink() {
  closeShareDropdown();
  const url = getShareUrl();
  try {
    await navigator.clipboard.writeText(url);
    // Show feedback on button
    const btn = el.shareCopyLink;
    if (btn) {
      const origHtml = btn.innerHTML;
      btn.innerHTML = `<svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg> Copied!`;
      setTimeout(() => { btn.innerHTML = origHtml; }, 2000);
    }
  } catch (e) {
    console.error('Copy failed:', e);
  }
}

function shareEmail() {
  closeShareDropdown();
  const url = getShareUrl();
  const text = getShareText();
  window.open(`mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(url)}`, '_blank');
}

function shareTwitter() {
  closeShareDropdown();
  const url = getShareUrl();
  const text = getShareText();
  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank', 'width=550,height=420');
}

function shareFacebook() {
  closeShareDropdown();
  const url = getShareUrl();
  window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank', 'width=550,height=420');
}

function shareLinkedIn() {
  closeShareDropdown();
  const url = getShareUrl();
  window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank', 'width=550,height=420');
}

function shareWhatsApp() {
  closeShareDropdown();
  const url = getShareUrl();
  const text = getShareText();
  window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`, '_blank');
}

function isOutputInProgress(output) {
  return Boolean(output?._queueStatus);
}

function renderInProgressCard(output) {
  const id = String(output?.id || output?.runId || '');
  const sourceStoreId = String(output?.sourceStoreId || output?.agentId || '');
  const createdAt = output?.createdAt || '';
  const prompt = String(output?.title || output?.prompt || 'Generating…');
  const queueStatus = output._queueStatus || 'processing';
  const isQueued = queueStatus === 'pending';
  const pctMatch = String(output._queueProgress || '').match?.(/\d+/);
  const pct = pctMatch ? parseInt(pctMatch[0], 10) : (typeof output._queueProgress === 'number' ? output._queueProgress : 0);

  const statusLabel = isQueued ? 'In Queue' : `Processing ${pct}%`;
  const barColor = isQueued ? 'bg-[#FFD128]' : 'bg-primary/90';
  const statusColor = isQueued ? 'text-[#FFD128]' : 'text-primary/90';

  return `
    <div class="creations-card rounded-ios-2xl border border-border bg-card overflow-hidden" data-queue-id="${escapeHtml(id)}" data-output-id="${escapeHtml(id)}">
      <div class="h-48 bg-secondary/50 flex items-center justify-center overflow-hidden relative">
        <div class="flex flex-col items-center gap-3">
          <div class="relative w-14 h-14">
            <div class="absolute inset-0 rounded-full border-2 ${isQueued ? 'border-[#FFD128]/20' : 'border-primary/90/20'}"></div>
            <div class="absolute inset-0 rounded-full border-2 ${isQueued ? 'border-[#FFD128]' : 'border-primary/90'} border-t-transparent animate-spin"></div>
            <div class="absolute inset-2 rounded-full ${isQueued ? 'bg-[#FFD128]/5' : 'bg-primary/90/5'} flex items-center justify-center">
              <span class="text-sm font-bold ${statusColor}">${pct}%</span>
            </div>
          </div>
          <p class="text-xs font-medium ${statusColor}">${escapeHtml(statusLabel)}</p>
          <div class="w-32 h-1.5 rounded-full bg-secondary overflow-hidden">
            <div class="h-full rounded-full ${barColor} transition-all duration-500" style="width: ${pct}%"></div>
          </div>
        </div>
      </div>
      <div class="p-4">
        <div class="font-semibold truncate" title="${escapeHtml(prompt)}">${escapeHtml(prompt)}</div>
        <div class="text-xs text-muted-foreground mt-1 truncate">
          ${escapeHtml(sourceStoreId || 'unknown')} • ${escapeHtml(formatRelativeTime(createdAt))}
        </div>
      </div>
    </div>
  `;
}

function showToast(message) {
  const existing = document.getElementById('aifnmjmchg-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'aifnmjmchg-toast';
  toast.textContent = message;
  Object.assign(toast.style, {
    position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
    padding: '10px 20px', borderRadius: '12px', fontSize: '13px', fontWeight: '500',
    color: '#fff', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
    zIndex: '9999', transition: 'opacity 0.3s', opacity: '0',
  });
  document.body.appendChild(toast);
  requestAnimationFrame(() => { toast.style.opacity = '1'; });
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 2500);
}

function wireLikeButtons(container) {
  if (!container) return;
  container.querySelectorAll('button[data-like-id]').forEach(btn => {
    if (btn._likeWired) return;
    btn._likeWired = true;
    let liked = btn.dataset.liked === 'true';
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const outputId = btn.dataset.likeId;
      if (!outputId || btn.disabled) return;
      btn.disabled = true;
      const method = liked ? 'DELETE' : 'POST';
      try {
        const res = await fetchHelper(`https://aitopia.ai/api/outputs/${encodeURIComponent(outputId)}/like`, {
          method,
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
        if (res.ok) {
          const json = await res.json();
          liked = json.liked;
          const icon = btn.querySelector('.like-icon');
          if (icon) icon.setAttribute('fill', liked ? 'currentColor' : 'none');
          if (liked) {
            btn.classList.add('text-primary/90', '!opacity-100');
            btn.classList.remove('text-white/90', 'bg-black/30', 'backdrop-blur-md');
          } else {
            btn.classList.remove('text-primary/90', '!opacity-100');
            btn.classList.add('text-white/90', 'bg-black/30', 'backdrop-blur-md');
          }
          const countEl = btn.closest('.creations-card')?.querySelector(`[data-like-count-display="${CSS.escape(outputId)}"]`);
          if (countEl) countEl.textContent = Number(json.likeCount ?? 0);
        } else if (res.status === 401 || res.status === 403) {
          location.href='/aitopia/marketplace/login.html?redirect=' + encodeURIComponent(window.location.pathname);
        } else {
          const json = await res.json().catch(() => null);
          showToast(json?.error?.message || 'Something went wrong');
        }
      } catch (err) {
        console.error('Like failed:', err);
      } finally {
        btn.disabled = false;
      }
    });
  });
}

function renderCard(output, tab) {
  if (isOutputInProgress(output)) return renderInProgressCard(output);
  const isRun = Boolean(output?.runId);
  const id = String(output?.id || output?.runId || '');
  const title = String(output?.title || output?.prompt || 'Untitled');
  const createdAt = output?.createdAt || '';
  const sourceStoreId = String(output?.sourceStoreId || output?.agentId || '');

  // Model IDs contain '/' (e.g. 'kwaivgi/kling-v2.1'), agent IDs don't
  const isModelSource = sourceStoreId.includes('/');
  const remixHref = isModelSource
    ? `/${sourceStoreId}?remixRunId=${encodeURIComponent(id)}`
    : isRun
      ? `/aitopia/marketplace/agent/${encodeURIComponent(sourceStoreId)}.html?remixRunId=${encodeURIComponent(id)}`
      : `/aitopia/marketplace/agent/${encodeURIComponent(sourceStoreId)}.html?remixOutputId=${encodeURIComponent(id)}`;

  const previewKind = output?.preview?.kind;
  const previewUrl = typeof output?.preview?.url === 'string' ? output.preview.url : '';

  const badges = [];
  if (tab === 'mine' && !isRun) {
    if (output?.visibility) {
      badges.push(cardBadge(output.visibility, output.visibility === 'public' ? 'green' : 'neutral'));
    }
    if (output?.moderationStatus && output.visibility === 'public') {
      badges.push(cardBadge(output.moderationStatus, output.moderationStatus === 'approved' ? 'green' : output.moderationStatus === 'rejected' ? 'red' : 'amber'));
    }
  }

  const previewText = typeof output?.preview?.text === 'string' ? output.preview.text : '';
  const mediaContent = previewKind === 'text' && previewText
    ? `<div class="rounded-ios-xl bg-secondary/50 p-4 min-h-[120px] flex items-start"><p class="text-sm text-foreground/80 leading-relaxed line-clamp-[8] whitespace-pre-wrap">${escapeHtml(previewText)}</p></div>`
    : previewKind === 'audio'
    ? `<div class="rounded-ios-xl bg-secondary/50 min-h-[120px] flex items-center justify-center text-5xl">🎧</div>`
    : ((previewKind === 'image' || !previewKind) && previewUrl)
    ? `<img src="${escapeHtml(previewUrl)}" alt="" class="w-full h-auto rounded-ios-xl" loading="lazy" />`
    : previewKind === 'video' && previewUrl
      ? `<video src="${escapeHtml(previewUrl)}" class="w-full h-auto rounded-ios-xl" autoplay muted loop playsinline></video>`
      : `<div class="creations-card-placeholder rounded-ios-xl bg-secondary/50 text-5xl">${previewKind === 'video' ? '🎬' : previewKind === 'audio' ? '🎧' : '🎨'}</div>`;

  const isCommunity = tab !== 'mine';
  const likeCount = Number(output?.likeCount ?? 0);
  const viewerHasLiked = Boolean(output?.viewerHasLiked);
  const commentCount = Number(output?.commentCount ?? 0);
  const remixCount = Number(output?.remixCount ?? 0);

  return `
    <div class="creations-card group cursor-pointer" data-output-id="${escapeHtml(id)}">
      <div class="relative overflow-hidden rounded-ios-xl">
        ${mediaContent}
        ${isCommunity && !isRun ? `
        <button type="button" data-like-id="${escapeHtml(id)}" data-liked="${viewerHasLiked ? 'true' : 'false'}" class="like-btn absolute top-2.5 right-2.5 z-10 w-8 h-8 rounded-full ${viewerHasLiked ? '' : 'bg-black/30 backdrop-blur-md'} flex items-center justify-center ${viewerHasLiked ? 'text-primary/90 !opacity-100' : 'text-white/90 opacity-0 group-hover:opacity-100'} transition-all duration-200 hover:text-primary/90 hover:scale-110 stop-propagation" aria-label="Like">
          <svg class="w-[18px] h-[18px] like-icon drop-shadow-sm" fill="${viewerHasLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"/></svg>
        </button>
        ` : ''}
        <div class="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-ios-xl flex flex-col justify-end p-3.5">
          <div class="transform translate-y-3 group-hover:translate-y-0 transition-transform duration-300 ease-out">
            ${badges.length ? `<div class="flex flex-wrap gap-1.5 mb-2">${badges.join('')}</div>` : ''}
            <h3 class="text-white font-semibold text-[13px] leading-snug line-clamp-2">${escapeHtml(title)}</h3>
            <p class="text-white/80 text-[11px] mt-0.5 truncate">${escapeHtml(sourceStoreId || 'unknown')} &middot; ${escapeHtml(formatRelativeTime(createdAt))}${!isRun ? ` &middot; ${getCreatorDisplay(output, tab === 'mine' ? 'me' : 'anonymous')}` : ''}</p>
            ${!isRun ? `<div class="flex items-center gap-3 mt-1.5 text-white/70 text-[11px]">
              <span class="inline-flex items-center gap-1"><svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"/></svg><span data-like-count-display="${escapeHtml(id)}">${likeCount}</span></span>
              <span class="inline-flex items-center gap-1"><svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z"/></svg>${commentCount}</span>
              <span class="inline-flex items-center gap-1"><svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3"/></svg>${remixCount}</span>
            </div>` : ''}
            <div class="flex gap-1.5 sm:gap-2 mt-2 sm:mt-2.5">
              <button type="button" data-output-id="${escapeHtml(id)}" class="view-btn flex-1 h-7 sm:h-8 flex items-center justify-center rounded-full bg-white/95 text-gray-900 text-[11px] sm:text-xs font-semibold hover:bg-white transition-colors backdrop-blur-sm">
                View
              </button>
              <a href="${remixHref}" class="flex-1 h-7 sm:h-8 flex items-center justify-center gap-1 sm:gap-1.5 rounded-full bg-primary/90 hover:bg-primary text-primary-foreground text-[11px] sm:text-xs font-semibold transition-colors stop-propagation">
                <svg class="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3"/></svg>
                Remix
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function filterBySearch(outputs) {
  const q = (el.searchInput?.value || '').trim().toLowerCase();
  if (!q) return outputs;
  return outputs.filter((o) => {
    const hay = `${o?.title || ''} ${o?.sourceStoreId || ''} ${o?.description || ''}`.toLowerCase();
    return hay.includes(q);
  });
}

function attachCardListeners(container) {
  if (!container) return;
  container.querySelectorAll('[data-output-id]').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      e.preventDefault();
      const outputId = card.dataset.outputId;
      const output = state.outputs.find((o) => String(o?.id || o?.runId) === outputId);
      if (output) openModal(output);
    });
  });
  container.querySelectorAll('video').forEach((video) => {
    video.play().catch(() => {});
  });
  wireLikeButtons(container);
}

function appendCardsToGrid(newOutputs, tab) {
  if (!el.grid || !newOutputs.length) return;
  const filtered = filterBySearch(newOutputs);
  if (!filtered.length) return;

  const fragment = document.createDocumentFragment();
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = filtered.map((o) => renderCard(o, tab)).join('');
  const newCards = Array.from(tempDiv.children);

  newCards.forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      e.preventDefault();
      const outputId = card.dataset.outputId;
      const output = state.outputs.find((o) => String(o?.id || o?.runId) === outputId);
      if (output) openModal(output);
    });
    const video = card.querySelector('video');
    if (video) video.play().catch(() => {});
    fragment.appendChild(card);
  });

  el.grid.appendChild(fragment);

  if (masonryInstance) {
    masonryInstance.appended(newCards);

    // Re-layout as each image loads to prevent overlapping
    if (typeof imagesLoaded !== 'undefined') {
      imagesLoaded(newCards).on('progress', () => {
        masonryInstance.layout();
      });
    }

    newCards.forEach(card => {
      const video = card.querySelector('video');
      if (video) {
        video.addEventListener('loadeddata', () => {
          if (masonryInstance) masonryInstance.layout();
        });
      }
    });
  }
  wireLikeButtons(el.grid);
}

function renderGrid(outputs, tab) {
  const filtered = filterBySearch(outputs);

  if (!el.grid) return;

  el.grid.innerHTML = '<div class="grid-sizer"></div>' + filtered.map((o) => renderCard(o, tab)).join('');
  attachCardListeners(el.grid);

  if (el.emptyState) {
    el.emptyState.classList.toggle('hidden', filtered.length > 0);
  }

  if (masonryInstance) {
    masonryInstance.destroy();
    masonryInstance = null;
  }
  initMasonry();
}

async function fetchJson(path, options = {}) {
  const res = await fetchHelper(path, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'include',
    cache: 'no-store',
    ...options,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { _raw: text };
  }
  return { res, json };
}

const state = {
  tab: 'community',
  limit: 30,
  offset: 0, 
  nextCursor: null,
  loading: false,
  outputs: [],
};

let currentLoadId = 0;

async function load({ append } = { append: false }) {
  const thisLoadId = ++currentLoadId;
  state.loading = true;

  if (append && el.loadMore) {
    el.loadMore.disabled = true;
    el.loadMore.textContent = 'Loading...';
  }

  if (!append) {
    state.offset = 0;
    state.nextCursor = null;
    state.outputs = [];
    setNotice('');
    if (el.grid) el.grid.innerHTML = '';
    if (el.emptyState) el.emptyState.classList.add('hidden');
    if (el.loadMore) el.loadMore.classList.add('hidden');
  }

  // Community: /api/outputs uses limit + offset. My creations: /api/me/creations uses limit + cursor.
  const base = state.tab === 'mine' ? 'https://aitopia.ai/api/me/creations' : 'https://aitopia.ai/api/outputs';
  const url =
    state.tab === 'mine'
      ? `${base}?limit=${state.limit}${state.nextCursor ? `&cursor=${encodeURIComponent(state.nextCursor)}` : ''}`
      : `${base}?limit=${state.limit}&offset=${state.offset}`;
  const { res, json } = await fetchJson(url);

  if (thisLoadId !== currentLoadId) {
    return;
  }

  if (!res.ok) {
    if (state.tab === 'mine' && (res.status === 401 || res.status === 403)) {
      setNotice('Sign in to view your private/unlisted creations.', 'error');
      if (el.emptyState) el.emptyState.classList.remove('hidden');
      state.loading = false;
      return;
    }

    const msg = json?.error?.message || json?.error || `Failed to load creations (${res.status})`;
    setNotice(String(msg), 'error');
    state.loading = false;
    return;
  }

  const list = json?.outputs || json?.creations || [];
  const outputs = Array.isArray(list) ? list : [];
  if (append) {
    state.outputs = state.outputs.concat(outputs);
  } else {
    state.outputs = outputs;
  }

  if (state.tab === 'mine') {
    state.nextCursor = json?.nextCursor ?? null;
  } else {
    state.offset += outputs.length;
  }

  // Fetch active queue items for "mine" tab (first page only)
  if (state.tab === 'mine' && !append) {
    try {
      const qRes = await fetchJson('https://aitopia.ai/api/queue?limit=20&status=pending,processing');
      if (qRes.res.ok) {
        const qItems = Array.isArray(qRes.json?.items) ? qRes.json.items : [];
        const existingIds = new Set(state.outputs.map(o => String(o?.id || o?.runId || '')));
        const maxAge = 30 * 60_000; // ignore queue items older than 30 minutes
        const now = Date.now();
        const queueOutputs = qItems
          .filter(qi => {
            if (existingIds.has(qi.refId || qi.id)) return false;
            const age = qi.createdAt ? now - new Date(qi.createdAt).getTime() : 0;
            return age < maxAge;
          })
          .map(qi => ({
            id: qi.refId || qi.id,
            runId: qi.refId || qi.id,
            sourceStoreId: qi.agentId || '',
            agentId: qi.agentId || '',
            title: qi.input?.prompt || qi.input?.text || '',
            prompt: qi.input?.prompt || qi.input?.text || '',
            input: qi.input || {},
            createdAt: qi.createdAt || new Date().toISOString(),
            _queueStatus: qi.status,
            _queueProgress: qi.progress || 0,
          }));
        if (queueOutputs.length > 0) {
          state.outputs = [...queueOutputs, ...state.outputs];
        }
      }
    } catch (qErr) {
      console.warn('[outputs] Queue fetch failed (non-fatal):', qErr);
    }
  }

  if (append) {
    if (outputs.length > 0) {
      appendCardsToGrid(outputs, state.tab);
    }
  } else {
    renderGrid(state.outputs, state.tab);
  }

  // Start polling for in-progress queue items
  if (state.tab === 'mine') {
    resumeQueuePolling();
  }

  if (el.loadMore) {
    const hasMore =
      state.tab === 'mine' ? state.nextCursor != null : outputs.length >= state.limit;

    if (hasMore) {
      el.loadMore.classList.remove('hidden');
    } else {
      el.loadMore.classList.add('hidden');
    }
    el.loadMore.disabled = false;
    el.loadMore.textContent = 'Load more';
  }

  state.loading = false;
}

function resumeQueuePolling() {
  const inProgress = state.outputs.filter(isOutputInProgress);
  for (const output of inProgress) {
    const id = String(output?.id || output?.runId || '');
    if (!id || _activePollers.has(id)) continue;

    let consecutiveErrors = 0;
    let enriched = output;
    const intervalId = setInterval(async () => {
      let job;
      try {
        job = await getJob(id);
        consecutiveErrors = 0;
      } catch (err) {
        consecutiveErrors += 1;
        if (consecutiveErrors >= 10) {
          clearInterval(intervalId);
          _activePollers.delete(id);
        }
        return;
      }

      // Enrich with input from job
      if (job.input && typeof job.input === 'object') {
        enriched = {
          ...enriched,
          input: { ...job.input, ...(enriched.input || {}) },
          title: enriched.title || job.input.prompt || job.input.text || '',
          prompt: enriched.prompt || job.input.prompt || job.input.text || '',
          sourceStoreId: enriched.sourceStoreId || job.agentId || '',
          agentId: enriched.agentId || job.agentId || '',
        };
      }

      const isTerminal = job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled';

      // Remove stale queue items (older than 30 min and still not terminal)
      const createdTime = enriched.createdAt ? new Date(enriched.createdAt).getTime() : 0;
      if (!isTerminal && createdTime && (Date.now() - createdTime > 30 * 60_000)) {
        clearInterval(intervalId);
        _activePollers.delete(id);
        const staleIdx = state.outputs.findIndex(o => String(o?.id || o?.runId || '') === id);
        if (staleIdx !== -1) {
          state.outputs.splice(staleIdx, 1);
          renderGrid(state.outputs, state.tab);
        }
        return;
      }

      if (isTerminal) {
        clearInterval(intervalId);
        _activePollers.delete(id);

        // Replace queue item with completed creation
        const idx = state.outputs.findIndex(o => String(o?.id || o?.runId || '') === id);
        if (idx !== -1) {
          if (job.status === 'completed' && job.output) {
            // Build a proper creation entry from the completed job
            state.outputs[idx] = {
              ...enriched,
              _queueStatus: undefined,
              _queueProgress: undefined,
              preview: job.output ? pickPreviewFromOutput(job.output) : null,
              output: job.output,
            };
          } else {
            // Failed/cancelled — remove from list
            state.outputs.splice(idx, 1);
          }
          renderGrid(state.outputs, state.tab);
        }
        return;
      }

      // Still running — update progress
      const rawPct = typeof job.progress === 'number' && Number.isFinite(job.progress) ? job.progress : 0;
      const pct = rawPct > 0 && rawPct < 1 ? Math.round(rawPct * 100) : Math.round(rawPct);

      const idx = state.outputs.findIndex(o => String(o?.id || o?.runId || '') === id);
      if (idx !== -1) {
        state.outputs[idx] = {
          ...enriched,
          _queueStatus: job.status === 'pending' ? 'pending' : 'processing',
          _queueProgress: pct,
        };
        // Lightweight DOM update instead of full re-render
        const card = el.grid?.querySelector(`[data-queue-id="${CSS.escape(id)}"]`);
        if (card) {
          const pctEl = card.querySelector('.text-sm.font-bold');
          if (pctEl) pctEl.textContent = `${pct}%`;
          const barEl = card.querySelector('[style*="width"]');
          if (barEl) barEl.style.width = `${pct}%`;
          const labelEl = card.querySelector('p.text-xs.font-medium');
          if (labelEl) labelEl.textContent = job.status === 'pending' ? 'In Queue' : `Processing ${pct}%`;
          if (masonryInstance) masonryInstance.layout();
        }
      }
    }, 2000);

    _activePollers.set(id, intervalId);
  }
}

function pickPreviewFromOutput(output) {
  if (!output) return null;

  // Handle direct URL string (e.g. model playground raw output)
  if (typeof output === 'string' && output.startsWith('http')) {
    return { url: output, kind: detectMediaKind(output) };
  }

  // Handle direct array of URLs (e.g. Replicate output: ["https://..."])
  if (Array.isArray(output) && output.length > 0 && typeof output[0] === 'string' && output[0].startsWith('http')) {
    return { url: output[0], kind: detectMediaKind(output[0]) };
  }

  if (typeof output !== 'object') return null;

  // Check both top-level and nested result object
  const candidates = [output];
  if (output.result && typeof output.result === 'object') {
    candidates.push(output.result);
  }

  for (const obj of candidates) {
    const fieldCandidates = [
      [obj.resultImage, 'image'], [obj.resultVideo, 'video'], [obj.resultAudio, 'audio'],
      [obj.resultUrl, null], [obj.outputUrl, null], [obj.url, null],
      [obj.imageUrl, 'image'], [obj.videoUrl, 'video'], [obj.audioUrl, 'audio'],
      [obj.mediaUrl, null], [obj.enhancedImage, 'image'], [obj.upscaledImage, 'image'],
      [obj.syncedVideo, 'video'],
    ];
    for (const [val, hintKind] of fieldCandidates) {
      if (val && typeof val === 'string') {
        return { url: val, kind: hintKind || detectMediaKind(val) };
      }
    }
    // Check if value is an array with a URL
    if (Array.isArray(obj.output) && obj.output.length > 0 && typeof obj.output[0] === 'string' && obj.output[0].startsWith('http')) {
      return { url: obj.output[0], kind: detectMediaKind(obj.output[0]) };
    }
  }

  // Check for array fields (e.g., images: [...])
  for (const obj of candidates) {
    for (const [key, kind] of [['images', 'image'], ['videos', 'video'], ['audios', 'audio']]) {
      if (Array.isArray(obj[key]) && obj[key].length > 0 && typeof obj[key][0] === 'string') {
        return { url: obj[key][0], kind };
      }
    }
  }

  // Text fallback for text-to-text models (no media URLs found)
  if (typeof output === 'string' && output.trim()) {
    return { kind: 'text', text: output.length > 160 ? output.slice(0, 159) + '…' : output };
  }
  if (Array.isArray(output) && output.length > 0 && output.every(i => typeof i === 'string')) {
    const joined = output.join('');
    if (joined.trim()) {
      return { kind: 'text', text: joined.length > 160 ? joined.slice(0, 159) + '…' : joined };
    }
  }

  return null;
}

function detectMediaKind(url) {
  if (!url || typeof url !== 'string') return 'image';
  const lower = url.toLowerCase();
  if (/\.(mp4|webm|mov)(\?|#|$)/i.test(lower) || lower.includes('/video/')) return 'video';
  if (/\.(mp3|wav|ogg|m4a)(\?|#|$)/i.test(lower) || lower.includes('/audio/')) return 'audio';
  return 'image';
}

function stopAllPollers() {
  for (const [, intervalId] of _activePollers) clearInterval(intervalId);
  _activePollers.clear();
}

function init() {
  setActiveTab('community');

  initMasonry();

  el.tabCommunity?.addEventListener('click', () => {
    stopAllPollers();
    state.tab = 'community';
    setActiveTab('community');
    void load({ append: false });
  });
  el.tabMine?.addEventListener('click', () => {
    stopAllPollers();
    state.tab = 'mine';
    setActiveTab('mine');
    void load({ append: false });
  });

  el.loadMore?.addEventListener('click', () => {
    if (state.loading || el.loadMore?.disabled) return;
    void load({ append: true });
  });

  if (el.scrollSentinel && 'IntersectionObserver' in window) {
    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries?.[0]?.isIntersecting) return;
        if (state.loading) return;
        const hasMore = state.tab === 'mine' ? state.nextCursor != null : state.outputs.length >= state.limit;
        if (!hasMore) return;
        void load({ append: true });
      },
      { rootMargin: '400px 0px' },
    );
    obs.observe(el.scrollSentinel);
  }
  el.searchInput?.addEventListener('input', () => renderGrid(state.outputs, state.tab));

  el.modalClose?.addEventListener('click', closeModal);
  el.modalCloseMobile?.addEventListener('click', closeModal);
  el.modalMediaArea?.addEventListener('click', (e) => {
    if (e.target === el.modalMediaArea) {
      closeModal();
    }
  });
  el.modalCopyPrompt?.addEventListener('click', copyPromptToClipboard);
  el.modalDownload?.addEventListener('click', downloadMedia);
  el.modalShare?.addEventListener('click', toggleShareDropdown);
  el.shareCopyLink?.addEventListener('click', shareCopyLink);
  el.shareEmail?.addEventListener('click', shareEmail);
  el.shareTwitter?.addEventListener('click', shareTwitter);
  el.shareFacebook?.addEventListener('click', shareFacebook);
  el.shareLinkedIn?.addEventListener('click', shareLinkedIn);
  el.shareWhatsApp?.addEventListener('click', shareWhatsApp);
  // Report
  el.modalReport?.addEventListener('click', openReportModal);
  el.modalReportForm?.addEventListener('submit', (e) => void submitModalReport(e));
  el.modalReportBackdrop?.addEventListener('click', closeReportModal);
  el.modalReportClose?.addEventListener('click', closeReportModal);
  el.modalReportCancelBtn?.addEventListener('click', closeReportModal);

  el.modalUpscale?.addEventListener('click', () => {
    if (currentOutput) {
      const previewUrl = currentOutput?.preview?.url;
      const previewKind = currentOutput?.preview?.kind || 'image';
      if (previewUrl) {
        if (previewKind === 'video') {
          window.location.href = `/agents/video-upscaler?videoUrl=${encodeURIComponent(previewUrl)}`;
        } else {
          window.location.href = `/agents/image-upscaler?imageUrl=${encodeURIComponent(previewUrl)}`;
        }
      }
    }
  });

  el.modalPublish?.addEventListener('click', () => {
    if (!currentOutput) return;
    openPublishModal({
      runId: currentOutput.runId,
      idempotencyKey: currentOutput.idempotencyKey,
      prompt: currentOutput.prompt || currentOutput.title || currentOutput.description || '',
      input: currentOutput.input || {},
      agentId: currentOutput.sourceStoreId || currentOutput.agentId || '',
    });
  });

  window.addEventListener('aitopia:outputs:published', () => {
    if (el.modalPublish) {
      el.modalPublish.classList.add('hidden');
      el.modalPublish.style.display = '';
    }
    if (state.tab === 'mine') {
      void load({ append: false });
    }
  });

  // Close share dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#modalShare') && !e.target.closest('#shareDropdown')) {
      closeShareDropdown();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeShareDropdown();
      closeModal();
    }
  });

  window.addEventListener('popstate', (e) => {
    const urlParams = new URLSearchParams(window.location.search);
    const outputId = urlParams.get('id');
    const runId = urlParams.get('runId');
    if (outputId || runId) {
      const output = state.outputs.find(o =>
        (outputId && String(o?.id) === outputId) ||
        (runId && String(o?.runId) === runId)
      );
      if (output) {
        openModalWithoutPush(output);
      }
    } else {
      closeModalWithoutPush();
    }
  });

  load({ append: false }).then(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const outputId = urlParams.get('id');
    const runId = urlParams.get('runId');
    if (outputId || runId) {
      let output = state.outputs.find(o =>
        (outputId && String(o?.id) === outputId) ||
        (runId && String(o?.runId) === runId)
      );
      if (output) {
        openModalWithoutPush(output);
      } else if (outputId) {
        fetchOutputById(outputId).then(output => {
          if (output) {
            openModalWithoutPush(output);
          }
        });
      } else if (runId) {
        fetchHelper(`https://aitopia.ai/api/me/creations/${encodeURIComponent(runId)}`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          credentials: 'include',
        }).then(res => res.ok ? res.json() : null).then(json => {
          if (!json?.run) return;
          const run = json.run;
          const rawOutput = run.output?.result ?? run.output;
          const preview = pickPreviewFromOutput(rawOutput);
          const normalized = {
            runId: run.id,
            idempotencyKey: run.idempotencyKey,
            agentId: run.agentId,
            sourceStoreId: run.modelId || run.agentId,
            modelId: run.modelId || run.agentId,
            prompt: run.input?.prompt || run.input?.text || '',
            input: run.input,
            output: run.output,
            preview: preview,
            createdAt: run.createdAt,
          };
          openModalWithoutPush(normalized);
        }).catch(() => {});
      }
    }
  });
}


function closeModalWithoutPush() {
  if (!el.detailModal) return;
  el.detailModal.classList.add('hidden');
  document.body.style.overflow = '';
  currentOutput = null;
  closeShareDropdown();

  const bottomNav = document.querySelector('[data-bottom-tabs]');
  if (bottomNav) bottomNav.style.display = '';
  const topNav = document.getElementById('header');
  if (topNav) topNav.style.display = '';

  if (el.modalMedia) {
    const video = el.modalMedia.querySelector('video');
    const audio = el.modalMedia.querySelector('audio');
    if (video) video.pause();
    if (audio) audio.pause();
  }
}

async function fetchOutputById(id) {
  try {
    const res = await fetchHelper(`https://aitopia.ai/api/outputs/${encodeURIComponent(id)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'include',
    });
    if (!res.ok) return null;
    const json = await res.json();
    const output = json?.output;
    if (output) {
      if (json?.creatorProfile) output.creatorProfile = json.creatorProfile;
      output.isPublished = true;
      // Compute preview from the source run output when not already present
      if (!output.preview && json?.sourceRun?.output) {
        output.preview = pickPreviewFromOutput(json.sourceRun.output);
      }
    }
    return output || null;
  } catch (e) {
    console.error('Failed to fetch output:', e);
    return null;
  }
}

init();
