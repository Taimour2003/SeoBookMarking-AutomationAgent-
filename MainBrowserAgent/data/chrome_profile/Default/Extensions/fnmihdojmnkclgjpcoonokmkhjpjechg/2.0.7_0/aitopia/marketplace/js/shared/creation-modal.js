/**
 * Shared Creation Modal Module
 *
 * Provides unified modal functionality for displaying creation details
 * across Creations page (outputs.js) and Profile page (profile.js).
 */

import { fetchHelper } from './fetch-helper.js';

export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function formatRelativeTime(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';

  const now = Date.now();
  const diffMs = now - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

export async function fetchOutputDetails(outputId) {
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

export async function fetchRunDetails(runId) {
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

export function extractInputMedia(input) {
  if (!input || typeof input !== 'object') return [];

  const media = [];
  const seenKeys = new Set();

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

  const detectType = (url) => {
    const dataType = getDataUriType(url);
    if (dataType) return dataType;
    const lower = url.toLowerCase();
    if (lower.match(/\.(mp4|webm|mov|avi|mkv)(\?|$)/)) return 'video';
    if (lower.match(/\.(mp3|wav|ogg|m4a|aac)(\?|$)/)) return 'audio';
    if (lower.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?|$)/)) return 'image';
    return 'image';
  };

  const formatLabel = (key) => {
    const labelMap = {
      'videoUrl1': 'Start',
      'videoUrl2': 'End',
      'imageUrl1': 'Start',
      'imageUrl2': 'End',
      'imageUrl': 'Input',
      'videoUrl': 'Input',
      'sourceImage': 'Source',
      'targetImage': 'Target',
      'sourceVideo': 'Source',
      'targetVideo': 'Target',
      'faceImage': 'Face',
      'referenceImage': 'Reference',
      'inputImage': 'Input',
      'inputVideo': 'Input',
    };
    if (labelMap[key]) return labelMap[key];

    let label = key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim();
    label = label.replace(/\s*(url|image|video|img|vid)$/i, '').trim();
    label = label.charAt(0).toUpperCase() + label.slice(1);
    return label || 'Input';
  };

  const searchForMedia = (obj, parentKey = '') => {
    if (!obj || typeof obj !== 'object') return;

    for (const [key, value] of Object.entries(obj)) {
      if (['output', 'result', 'preview', 'resultUrl', 'outputUrl'].includes(key)) continue;

      const fullKey = parentKey ? `${parentKey}.${key}` : key;

      if (typeof value === 'string' && isMediaValue(value) && !seenKeys.has(fullKey)) {
        seenKeys.add(fullKey);
        const type = detectType(value);
        const label = formatLabel(key);
        media.push({ url: value, type, label });
      } else if (Array.isArray(value)) {
        value.forEach((item, idx) => {
          const itemKey = `${fullKey}[${idx}]`;
          if (typeof item === 'string' && isMediaValue(item) && !seenKeys.has(itemKey)) {
            seenKeys.add(itemKey);
            const type = detectType(item);
            let label = formatLabel(key);
            if (value.length > 1) label += ` ${idx + 1}`;
            media.push({ url: item, type, label });
          } else if (typeof item === 'object') {
            searchForMedia(item, itemKey);
          }
        });
      } else if (typeof value === 'object') {
        searchForMedia(value, fullKey);
      }
    }
  };

  if (input.parameters && typeof input.parameters === 'object') {
    searchForMedia(input.parameters, 'parameters');
  }
  searchForMedia(input);

  return media;
}

/**
 * Render input media grid
 */
export function renderInputMedia(mediaItems, elements) {
  const { modalInputMedia, modalInputMediaGrid } = elements;
  if (!modalInputMedia || !modalInputMediaGrid) return;

  if (!mediaItems || mediaItems.length === 0) {
    modalInputMedia.classList.add('hidden');
    modalInputMediaGrid.innerHTML = '';
    return;
  }

  modalInputMedia.classList.remove('hidden');
  modalInputMediaGrid.innerHTML = mediaItems.map(item => {
    if (item.type === 'video') {
      return `
        <div class="relative group">
          <video src="${escapeHtml(item.url)}" class="w-full aspect-square object-cover rounded-lg" autoplay muted loop playsinline></video>
          <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 rounded-b-lg">
            <span class="text-white text-xs font-medium">${escapeHtml(item.label)}</span>
          </div>
        </div>
      `;
    } else if (item.type === 'audio') {
      return `
        <div class="relative bg-secondary rounded-lg p-3 flex flex-col items-center justify-center aspect-square">
          <div class="text-3xl mb-2">🎵</div>
          <audio src="${escapeHtml(item.url)}" class="w-full" controls></audio>
          <span class="text-xs text-muted-foreground mt-2">${escapeHtml(item.label)}</span>
        </div>
      `;
    } else {
      return `
        <div class="relative group">
          <img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.label)}" class="w-full aspect-square object-cover rounded-lg" />
          <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 rounded-b-lg">
            <span class="text-white text-xs font-medium">${escapeHtml(item.label)}</span>
          </div>
        </div>
      `;
    }
  }).join('');

  // Auto-play videos
  const videos = modalInputMediaGrid.querySelectorAll('video');
  videos.forEach(video => video.play().catch(() => {}));
}

export function getTransitionVideoUrl(transitionType) {
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

export function renderTransitionPreview(sourceStoreId, input, elements) {
  const { modalTransitionPreview, modalTransitionVideo, modalTransitionType } = elements;
  if (!modalTransitionPreview || !modalTransitionVideo || !modalTransitionType) return;

  if (sourceStoreId !== 'transitions') {
    modalTransitionPreview.classList.add('hidden');
    return;
  }

  const transitionType = input?.parameters?.transitionType || input?.transitionType;
  if (!transitionType) {
    modalTransitionPreview.classList.add('hidden');
    return;
  }

  const videoUrl = getTransitionVideoUrl(transitionType);
  modalTransitionVideo.src = videoUrl;
  modalTransitionType.textContent = transitionType.toUpperCase();
  modalTransitionPreview.classList.remove('hidden');
  modalTransitionVideo.play().catch(() => {});
}

export function createInfoRow(label, value, thumbnail = null, allowWrap = false, isMediaRow = false) {
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

const visibilityMeta = {
  public:   { label: 'Public' },
  unlisted: { label: 'Unlisted' },
  private:  { label: 'Private' },
};

function createVisibilityRow(currentVisibility, outputId, isOwner = false) {
  const cur = visibilityMeta[currentVisibility] || visibilityMeta.public;

  if (!isOwner) {
    return createInfoRow('Visibility', cur.label);
  }

  const optionsHtml = Object.entries(visibilityMeta).map(([key, m]) => {
    const active = key === currentVisibility;
    return `<button type="button" data-vis-opt="${key}" class="w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${active ? 'bg-primary/5 text-primary font-medium' : 'text-foreground hover:bg-secondary'}">${m.label}</button>`;
  }).join('');

  return `
    <div class="flex items-center justify-between gap-3 py-3 border-b border-border/50 last:border-0">
      <span class="text-muted-foreground text-sm flex-shrink-0">Visibility</span>
      <div class="relative" data-vis-edit data-output-id="${escapeHtml(outputId)}">
        <button type="button" data-vis-toggle class="flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-primary transition-colors cursor-pointer">
          <span data-vis-label>${escapeHtml(cur.label)}</span>
          <svg class="w-3.5 h-3.5 text-muted-foreground transition-transform" data-vis-chevron fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
        </button>
        <div data-vis-options class="hidden absolute right-0 top-full mt-1 bg-card border border-border rounded-lg overflow-hidden z-20 shadow-xl min-w-[160px]">
          ${optionsHtml}
        </div>
      </div>
    </div>
  `;
}

function wireVisibilityDropdown(container) {
  const wrapper = container?.querySelector('[data-vis-edit]');
  if (!wrapper) return;

  const toggle = wrapper.querySelector('[data-vis-toggle]');
  const options = wrapper.querySelector('[data-vis-options]');
  const chevron = wrapper.querySelector('[data-vis-chevron]');
  const labelEl = wrapper.querySelector('[data-vis-label]');
  const outputId = wrapper.getAttribute('data-output-id');
  if (!toggle || !options || !outputId) return;

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = !options.classList.contains('hidden');
    options.classList.toggle('hidden');
    if (chevron) chevron.style.transform = isOpen ? '' : 'rotate(180deg)';
  });

  const closeDropdown = () => {
    options.classList.add('hidden');
    if (chevron) chevron.style.transform = '';
  };

  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target)) closeDropdown();
  });

  options.querySelectorAll('[data-vis-opt]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const newVis = btn.getAttribute('data-vis-opt');
      closeDropdown();

      const meta = visibilityMeta[newVis];
      if (labelEl && meta) labelEl.textContent = meta.label;

      options.querySelectorAll('[data-vis-opt]').forEach(b => {
        const isActive = b.getAttribute('data-vis-opt') === newVis;
        b.classList.toggle('bg-primary/10', isActive);
        b.classList.toggle('text-primary', isActive);
        b.classList.toggle('font-medium', isActive);
        b.classList.toggle('text-foreground', !isActive);
        b.classList.toggle('hover:bg-secondary', !isActive);
      });

      try {
        const res = await fetch(`https://aitopia.ai/api/outputs/${encodeURIComponent(outputId)}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ visibility: newVis }),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => null);
          console.error('Visibility update failed:', json?.error || res.status);
        }
      } catch (err) {
        console.error('Visibility update failed:', err);
      }
    });
  });
}

function detectIsOwner(output, isOwnerHint) {
  if (isOwnerHint === true) return true;
  const profileLink = document.getElementById('profileLink');
  if (!profileLink) return false;
  const href = profileLink.getAttribute('href') || '';
  const match = href.match(/\/u\/([^/?#]+)/);
  if (!match) return false;
  const myUsername = decodeURIComponent(match[1]).toLowerCase();
  const creatorUsername = (
    output?.creatorProfile?.username || output?.creator?.username || ''
  ).toLowerCase();
  return Boolean(creatorUsername) && creatorUsername === myUsername;
}

export function openCreationModal(output, options = {}) {
  const {
    elements,
    pushState = false,
    isOwner: isOwnerHint = false,
    getAuthorName = (o) => o?.creatorProfile?.username || o?.creator?.username || 'Anonymous',
  } = options;

  if (!elements?.detailModal) return;

  const isOwner = detectIsOwner(output, isOwnerHint);
  const previewKind = output?.preview?.kind || 'image';
  const previewUrl = typeof output?.preview?.url === 'string' ? output.preview.url : '';
  const prompt = output?.prompt ?? output?.description ?? '';
  const sourceStoreId = String(output?.sourceStoreId || output?.agentId || '');
  const isRun = Boolean(output?.runId);
  const rmId = String(output?.id || output?.runId || '');

  const authorName = getAuthorName(output);
  const authorInitial = authorName.charAt(0).toUpperCase();

  if (elements.modalAvatar) {
    elements.modalAvatar.textContent = authorInitial;
  }
  if (elements.modalAuthorName) {
    elements.modalAuthorName.textContent = authorName;
  }
  // Sync mobile header duplicates
  if (elements.modalAvatarMobile) {
    elements.modalAvatarMobile.textContent = authorInitial;
  }
  if (elements.modalAuthorNameMobile) {
    elements.modalAuthorNameMobile.textContent = authorName;
  }

  if (elements.modalMedia) {
    const previewText = typeof output?.preview?.text === 'string' ? output.preview.text : '';
    if (previewKind === 'text' && previewText) {
      // Extract full text from raw output (preview.text is truncated to 160 chars)
      let fullText = previewText;
      const rawOut = output?.output;
      if (rawOut) {
        if (typeof rawOut === 'string') fullText = rawOut;
        else if (Array.isArray(rawOut) && rawOut.every(i => typeof i === 'string')) fullText = rawOut.join('');
        else if (typeof rawOut?.result === 'string') fullText = rawOut.result;
        else if (Array.isArray(rawOut?.result) && rawOut.result.every(i => typeof i === 'string')) fullText = rawOut.result.join('');
      }
      elements.modalMedia.innerHTML = `<div class="max-w-full max-h-[45vh] lg:max-h-[calc(100vh-2rem)] overflow-y-auto rounded-lg bg-secondary p-6"><p class="text-sm text-foreground whitespace-pre-wrap leading-relaxed">${escapeHtml(fullText)}</p></div>`;
    } else if (previewKind === 'video' && previewUrl) {
      elements.modalMedia.innerHTML = `<video src="${escapeHtml(previewUrl)}" class="max-w-full max-h-[45vh] lg:max-h-[calc(100vh-2rem)] rounded-lg" controls autoplay muted loop></video>`;
    } else if (previewKind === 'audio' && previewUrl) {
      elements.modalMedia.innerHTML = `
        <div class="flex flex-col items-center justify-center gap-6 p-8">
          <div class="w-24 h-24 lg:w-32 lg:h-32 rounded-ios-xl bg-secondary flex items-center justify-center text-5xl lg:text-6xl">🎧</div>
          <audio src="${escapeHtml(previewUrl)}" class="w-64 lg:w-80" controls autoplay></audio>
        </div>
      `;
    } else if (previewUrl) {
      elements.modalMedia.innerHTML = `<img src="${escapeHtml(previewUrl)}" alt="" class="w-full object-contain max-h-[70vh] lg:max-h-full lg:h-full" />`;
    } else {
      elements.modalMedia.innerHTML = `<div class="w-48 h-48 lg:w-64 lg:h-64 rounded-ios-xl bg-secondary flex items-center justify-center text-5xl lg:text-6xl">${previewKind === 'video' ? '🎬' : previewKind === 'audio' ? '🎧' : '🎨'}</div>`;
    }
  }

  // Prompt
  if (elements.modalPrompt) {
    elements.modalPrompt.textContent = prompt || 'No prompt available';
  }

  renderInputMedia([], elements);

  if (elements.modalTransitionPreview) {
    elements.modalTransitionPreview.classList.add('hidden');
  }

  // Info rows
  if (elements.modalInfoRows) {
    const meta = output?.meta && typeof output.meta === 'object' ? output.meta : {};
    const items = [];
    if (output?.title) items.push({ label: 'Name', value: output.title, thumbnail: null, allowWrap: false });
    if (output?.description) items.push({ label: 'Description', value: output.description, thumbnail: null, allowWrap: true });
    const isPublished = Boolean(output?.id) && !isRun && output?.visibility;
    if (isPublished) {
      items.push({ label: 'Visibility', value: output.visibility, thumbnail: null, allowWrap: false, isVisibility: true, outputId: output.id });
    }
    const isModelSource = sourceStoreId.includes('/');
    if (sourceStoreId) items.push({ label: isModelSource ? 'Model' : 'Agent', value: sourceStoreId, thumbnail: null, allowWrap: false });
    if (meta.preset) items.push({ label: 'Preset', value: meta.preset, thumbnail: meta.presetThumbnail || null, allowWrap: false });
    if (meta.feature) items.push({ label: 'Feature', value: meta.feature, thumbnail: null, allowWrap: false });
    if (meta.resolution) items.push({ label: 'Quality', value: meta.resolution, thumbnail: null, allowWrap: false });
    const sizeVal = meta.width && meta.height ? `${meta.width}×${meta.height}` : (meta.size || '');
    if (sizeVal) items.push({ label: 'Size', value: sizeVal, thumbnail: null, allowWrap: false });
    const modelVal = meta.model || output?.modelId || '';
    if (modelVal && modelVal !== sourceStoreId) items.push({ label: 'Model', value: modelVal, thumbnail: null, allowWrap: false });
    if (meta.duration) items.push({ label: 'Duration', value: meta.duration, thumbnail: null, allowWrap: false });
    if (output?.createdAt) items.push({ label: 'Created', value: formatRelativeTime(output.createdAt), thumbnail: null, allowWrap: false });

    const renderItem = (r) => {
      if (r.isVisibility) return createVisibilityRow(r.value, r.outputId, isOwner);
      return createInfoRow(r.label, r.value, r.thumbnail, r.allowWrap, r.isMediaRow);
    };

    const allHtml = items.map(renderItem).join('');
    if (items.length <= 5) {
      elements.modalInfoRows.innerHTML = `<div class="space-y-0">${allHtml}</div>`;
      if (elements.modalSeeAll) {
        elements.modalSeeAll.classList.add('hidden');
        elements.modalSeeAll.innerHTML = '';
      }
    } else {
      const visible = items.slice(0, 5);
      const extra = items.slice(5);
      const visibleHtml = visible.map(renderItem).join('');
      const extraHtml = extra.map(renderItem).join('');
      elements.modalInfoRows.innerHTML = `
        <div class="space-y-0">${visibleHtml}</div>
        <details class="mt-1 group">
          <summary class="flex items-center justify-between cursor-pointer text-muted-foreground text-sm hover:text-foreground py-2 list-none">
            <span class="group-open:inline hidden">Show less</span>
            <span class="group-open:hidden inline">Show more (${extra.length})</span>
            <svg class="w-4 h-4 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5"/></svg>
          </summary>
          <div class="space-y-0 pt-1">${extraHtml}</div>
        </details>
      `;
    }

    wireVisibilityDropdown(elements.modalInfoRows);
  }

  if (elements.modalRecreate) {
    // Model IDs contain '/' (e.g. 'kwaivgi/kling-v2.1'), agent IDs don't
    const isModelSource = sourceStoreId.includes('/');
    const remixParam = isRun ? 'remixRunId' : 'remixOutputId';
    elements.modalRecreate.href = isModelSource
      ? `/${sourceStoreId}?${remixParam}=${encodeURIComponent(rmId)}`
      : `/aitopia/marketplace/agent/${encodeURIComponent(sourceStoreId)}.html?${remixParam}=${encodeURIComponent(rmId)}`;
  }

  // Show Publish button for unpublished runs
  if (elements.modalPublish) {
    const canPublish = isRun && !output?._queueStatus;
    if (canPublish) {
      elements.modalPublish.classList.remove('hidden');
      elements.modalPublish.style.display = 'flex';
    } else {
      elements.modalPublish.classList.add('hidden');
      elements.modalPublish.style.display = '';
    }
    if (elements.modalTopActions) {
      elements.modalTopActions.classList.toggle('grid-cols-2', canPublish);
      elements.modalTopActions.classList.toggle('grid-cols-1', !canPublish);
    }
  }

  elements.detailModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  // Hide navbars on mobile so they don't overlap the modal
  const bottomNav = document.querySelector('[data-bottom-tabs]');
  if (bottomNav) bottomNav.style.display = 'none';
  const topNav = document.getElementById('header');
  if (topNav) topNav.style.display = 'none';

  const outputId = output?.id;
  const runId = output?.runId;
  if (pushState && (outputId || runId)) {
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.delete('id');
    newUrl.searchParams.delete('runId');
    if (outputId) {
      newUrl.searchParams.set('id', outputId);
    } else if (runId) {
      newUrl.searchParams.set('runId', runId);
    }
    window.history.pushState({ outputId, runId }, '', newUrl.toString());
  }

  const appendModelRow = (modelId) => {
    if (!modelId || !elements.modalInfoRows) return;
    const existing = elements.modalInfoRows.querySelectorAll('.text-muted-foreground');
    for (const el of existing) {
      if (el.textContent.trim() === 'Model') return;
    }
    const container = elements.modalInfoRows.querySelector('.space-y-0');
    if (container) container.insertAdjacentHTML('beforeend', createInfoRow('Model', modelId));
  };

  if (outputId) {
    fetchOutputDetails(outputId).then(details => {
      if (!details?.sourceRun?.input) return;
      const inputMedia = extractInputMedia(details.sourceRun.input);
      renderInputMedia(inputMedia, elements);
      renderTransitionPreview(sourceStoreId, details.sourceRun.input, elements);
      if (!output?.modelId && details.sourceRun?.modelId) {
        appendModelRow(details.sourceRun.modelId);
      }
    });
  } else if (runId) {
    fetchRunDetails(runId).then(details => {
      if (!details?.sourceRun?.input) return;
      const inputMedia = extractInputMedia(details.sourceRun.input);
      renderInputMedia(inputMedia, elements);
      renderTransitionPreview(sourceStoreId, details.sourceRun.input, elements);
      if (!output?.modelId && details.modelId) {
        appendModelRow(details.modelId);
      }
    });
  }

  return output;
}

export function buildPublishModalHtml() {
  return `
    <div class="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#333] rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
      <div class="flex items-start justify-between gap-3 mb-6">
        <div>
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Publish This Output</h2>
          <p class="text-sm text-gray-500 dark:text-[#888] mt-1">Share your creation with others</p>
        </div>
        <button type="button" data-publish-cancel class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-primary-foreground/10 transition-colors text-gray-500 dark:text-[#888] hover:text-gray-900 dark:hover:text-white" aria-label="Close">
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </div>
      <div class="space-y-5">
        <div>
          <label class="block text-sm font-medium text-gray-900 dark:text-white mb-2">Title</label>
          <input data-publish-title type="text" class="w-full text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-[#0f0f0f] border border-gray-200 dark:border-[#333] rounded-xl px-4 py-3 focus:outline-none focus:border-gray-400 dark:focus:border-[#555] placeholder-gray-400 dark:placeholder-[#555] transition-colors" placeholder="Give a memorable name" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-900 dark:text-white mb-2">Description - Optional</label>
          <textarea data-publish-description class="w-full text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-[#0f0f0f] border border-gray-200 dark:border-[#333] rounded-xl px-4 py-3 h-28 focus:outline-none focus:border-gray-400 dark:focus:border-[#555] placeholder-gray-400 dark:placeholder-[#555] resize-none transition-colors" placeholder="Type anything..."></textarea>
        </div>
        <div class="relative" data-publish-dropdown>
          <label class="block text-xs text-gray-500 dark:text-[#888] mb-1">Visibility</label>
          <button type="button" data-publish-visibility-toggle class="w-full text-left text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-[#0f0f0f] border border-gray-200 dark:border-[#333] rounded-lg px-3 py-2 focus:outline-none focus:border-gray-400 dark:focus:border-[#555] transition-colors flex items-center justify-between">
            <span data-publish-visibility-label>Public (Appears after review)</span>
            <svg class="w-4 h-4 text-gray-500 dark:text-[#888] transition-transform" data-publish-visibility-chevron fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
            </svg>
          </button>
          <input type="hidden" data-publish-visibility value="public" />
          <div data-publish-visibility-options class="hidden absolute left-0 right-0 top-full mt-1 bg-white dark:bg-[#0f0f0f] border border-gray-200 dark:border-[#333] rounded-lg overflow-hidden z-10 shadow-xl">
            <button type="button" data-visibility-option="public" class="w-full text-left px-3 py-2 text-sm text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors bg-gray-100 dark:bg-primary-foreground/10">Public (Appears after review)</button>
            <button type="button" data-visibility-option="unlisted" class="w-full text-left px-3 py-2 text-sm text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">Unlisted (Link only)</button>
            <button type="button" data-visibility-option="private" class="w-full text-left px-3 py-2 text-sm text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">Private (Only you)</button>
          </div>
        </div>
        <div class="flex items-center">
          <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 select-none cursor-pointer">
            <input data-publish-allow-remix type="checkbox" class="w-4 h-4 accent-primary/90 rounded" checked />
            Allow remixing
          </label>
        </div>
        <div data-publish-error class="hidden text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl px-4 py-3"></div>
        <div data-publish-success class="hidden text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-xl px-4 py-3"></div>
      </div>
      <div class="mt-6 flex gap-3">
        <button type="button" data-publish-cancel class="flex-1 h-12 rounded-xl bg-gray-100 dark:bg-[#333] hover:bg-gray-200 dark:hover:bg-[#444] text-gray-900 dark:text-white text-sm font-medium transition-colors">Cancel</button>
        <button type="button" data-publish-submit class="flex-1 h-12 rounded-xl bg-primary/90 hover:bg-primary/90/90 text-white text-sm font-medium transition-colors">Publish</button>
      </div>
    </div>
  `;
}

export function openPublishModal(context) {
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center';
  overlay.innerHTML = buildPublishModalHtml();

  const modal = overlay.firstElementChild;
  const titleEl = modal.querySelector('[data-publish-title]');
  const descEl = modal.querySelector('[data-publish-description]');
  const visEl = modal.querySelector('[data-publish-visibility]');
  const allowEl = modal.querySelector('[data-publish-allow-remix]');
  const errEl = modal.querySelector('[data-publish-error]');
  const okEl = modal.querySelector('[data-publish-success]');
  const submitBtn = modal.querySelector('[data-publish-submit]');

  if (titleEl && context?.prompt) {
    const prompt = String(context.prompt).trim();
    titleEl.value = prompt.length > 80 ? prompt.slice(0, 79) + '…' : prompt;
  }

  const visToggle = modal.querySelector('[data-publish-visibility-toggle]');
  const visLabel = modal.querySelector('[data-publish-visibility-label]');
  const visChevron = modal.querySelector('[data-publish-visibility-chevron]');
  const visOptions = modal.querySelector('[data-publish-visibility-options]');

  const visibilityLabels = {
    'public': 'Public (Appears after review)',
    'unlisted': 'Unlisted (Link only)',
    'private': 'Private (Only you)',
  };

  if (visToggle && visOptions) {
    visToggle.addEventListener('click', () => {
      const isOpen = !visOptions.classList.contains('hidden');
      visOptions.classList.toggle('hidden');
      if (visChevron) visChevron.style.transform = isOpen ? '' : 'rotate(180deg)';
    });

    visOptions.querySelectorAll('[data-visibility-option]').forEach(btn => {
      btn.addEventListener('click', () => {
        const value = btn.getAttribute('data-visibility-option');
        if (visEl) visEl.value = value;
        if (visLabel) visLabel.textContent = visibilityLabels[value] || value;
        visOptions.classList.add('hidden');
        if (visChevron) visChevron.style.transform = '';
        visOptions.querySelectorAll('[data-visibility-option]').forEach(b => {
          b.classList.toggle('bg-primary-foreground/10', b.getAttribute('data-visibility-option') === value);
        });
      });
    });

    overlay.addEventListener('click', (e) => {
      if (!visToggle.contains(e.target) && !visOptions.contains(e.target)) {
        visOptions.classList.add('hidden');
        if (visChevron) visChevron.style.transform = '';
      }
    });
  }

  const close = () => overlay.remove();
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  modal.querySelectorAll('[data-publish-cancel]').forEach((btn) => btn.addEventListener('click', close));

  const showError = (msg) => {
    if (!errEl) return;
    errEl.textContent = msg;
    errEl.classList.remove('hidden');
  };
  const clearError = () => {
    if (!errEl) return;
    errEl.textContent = '';
    errEl.classList.add('hidden');
  };
  const showSuccess = (msg) => {
    if (!okEl) return;
    okEl.textContent = msg;
    okEl.classList.remove('hidden');
  };

  submitBtn?.addEventListener('click', async () => {
    clearError();
    if (submitBtn) submitBtn.disabled = true;

    let succeeded = false;
    try {
      const title = String(titleEl?.value || '').trim();
      const description = String(descEl?.value || '').trim();
      const visibility = String(visEl?.value || 'public');
      const allowRemix = Boolean(allowEl?.checked);

      if (!title) {
        showError('Please enter a title');
        return;
      }

      const input = context?.input && typeof context.input === 'object' && !Array.isArray(context.input) ? context.input : {};
      const pinned = allowRemix ? [] : Object.keys(input);

      const sourceIdempotencyKey = typeof context?.idempotencyKey === 'string' && context.idempotencyKey.trim()
        ? context.idempotencyKey.trim()
        : null;
      let sourceRunId = typeof (context?.sourceRunId || context?.runId) === 'string'
        ? String(context.sourceRunId || context.runId).trim() || null
        : null;
      if (sourceRunId && sourceRunId.startsWith('runner-')) {
        sourceRunId = null;
      }

      if (!sourceRunId && !sourceIdempotencyKey) {
        showError('Cannot publish: missing creation identifier.');
        return;
      }

      const batchCount = Math.max(1, Math.min(20, Number(context?.batchCount) || 1));
      const selectedOutputUrl = typeof context?.selectedOutputUrl === 'string' && context.selectedOutputUrl.trim()
        ? context.selectedOutputUrl.trim()
        : null;

      const basePayload = {
        ...(sourceIdempotencyKey ? { sourceIdempotencyKey } : {}),
        ...(sourceRunId ? { sourceRunId } : {}),
        ...(context?.derivedFromOutputId ? { derivedFromOutputId: context.derivedFromOutputId } : {}),
        visibility,
        remixSpec: {
          version: 1,
          pinnedInputKeys: pinned,
          defaults: { ...input, ...(selectedOutputUrl ? { __selectedOutputUrl: selectedOutputUrl } : {}) },
        },
      };

      let lastOutput = null;
      let failCount = 0;

      const batchImageUrls = Array.isArray(context?.batchImageUrls) ? context.batchImageUrls : null;

      for (let i = 0; i < batchCount; i++) {
        const itemTitle = batchCount > 1 ? `${title} (${i + 1}/${batchCount})` : title;
        // For batch publish, override __selectedOutputUrl per image
        let payload = { ...basePayload, title: itemTitle, ...(description ? { description } : {}) };
        if (batchImageUrls && batchImageUrls[i]) {
          payload = {
            ...payload,
            remixSpec: {
              ...payload.remixSpec,
              defaults: { ...payload.remixSpec.defaults, __selectedOutputUrl: batchImageUrls[i] },
            },
          };
        }

        const res = await fetch('https://aitopia.ai/api/outputs', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        let json;
        try { json = JSON.parse(await res.text()); } catch { json = null; }
        if (!res.ok) {
          failCount++;
          if (i === 0) {
            const msg = json?.error?.message || json?.error || `Publish failed (${res.status})`;
            showError(String(msg));
            return;
          }
          continue;
        }
        lastOutput = json?.output;
      }

      succeeded = true;
      const output = lastOutput;
      const outputId = output?.id;
      if (!outputId) {
        showSuccess(batchCount > 1 ? `Published ${batchCount - failCount} of ${batchCount}.` : 'Published.');
        setTimeout(() => close(), 1200);
        return;
      }

      const shareUrl = `${window.location.origin}/creations/${encodeURIComponent(outputId)}`;
      const remixUrl = `${window.location.origin}/creations/${encodeURIComponent(outputId)}/remix`;
      const publicPending = output?.visibility === 'public' && output?.moderationStatus !== 'approved';
      const privatePending = output?.visibility !== 'public' && output?.moderationStatus === 'pending';

      const batchMsg = batchCount > 1 ? `Published ${batchCount - failCount} of ${batchCount}` : 'Published';
      if (publicPending) {
        showSuccess(`${batchMsg} (pending public review). Links copied.`);
      } else if (privatePending) {
        showSuccess(`${batchMsg} (private screening pending). Links copied.`);
      } else {
        showSuccess(`${batchMsg}. Links copied.`);
      }
      const text = `${shareUrl}\n${allowRemix ? `Remix: ${remixUrl}` : ''}`.trim();
      await navigator.clipboard?.writeText?.(text).catch(() => null);

      setTimeout(() => close(), 1000);

      window.dispatchEvent(new CustomEvent('aitopia:outputs:published', {
        detail: {
          outputId,
          sourceStoreId: context?.agentId || context?.sourceStoreId || null,
          visibility: output?.visibility,
          moderationStatus: output?.moderationStatus,
        },
      }));
    } catch (e) {
      showError(e?.message || 'Publish failed.');
    } finally {
      if (submitBtn && !succeeded) submitBtn.disabled = false;
    }
  });

  document.body.appendChild(overlay);
}

/* ── Lazy-created modal for pages ── */
let _dynamicModalElements = null;
let _dynamicCurrentOutput = null;

export function ensureCreationModal() {
  if (_dynamicModalElements) return _dynamicModalElements;

  const modal = document.createElement('div');
  modal.id = 'creationDetailModal';
  modal.className = 'fixed inset-0 z-50 hidden font-sans bg-background';
  modal.innerHTML = `
    <div class="h-full flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
      <div class="lg:hidden flex items-center gap-2 px-3 py-2 bg-card border-b border-border flex-shrink-0">
        <button data-cm-close-mobile type="button" class="h-9 w-9 flex items-center justify-center rounded-full hover:bg-secondary transition-colors">
          <svg class="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
        </button>
        <div data-cm-avatar-mobile class="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-xs flex-shrink-0">A</div>
        <div class="flex-1 min-w-0"><div data-cm-author-mobile class="text-foreground font-medium text-sm truncate">Anonymous</div></div>
      </div>
      <div data-cm-media-area class="order-2 lg:order-none relative flex items-center justify-center bg-gray-100 dark:bg-black cursor-pointer flex-shrink-0 min-h-[200px] lg:max-h-none lg:min-h-0 lg:flex-1 lg:overflow-hidden">
        <div data-cm-media class="w-full lg:h-full flex items-center justify-center"></div>
      </div>
      <div class="contents lg:w-[380px] lg:flex lg:flex-col lg:flex-shrink-0 lg:max-h-full lg:h-full lg:overflow-hidden lg:border-l lg:border-border">
        <div class="order-1 lg:order-none w-full bg-card flex flex-col lg:overflow-hidden border-t lg:border-t-0">
          <div class="hidden lg:flex items-center gap-2 px-4 py-2 border-b border-border">
            <div data-cm-avatar class="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm flex-shrink-0">A</div>
            <div class="flex-1 min-w-0"><div data-cm-author class="text-foreground font-medium text-sm truncate">Anonymous</div></div>
            <button data-cm-close type="button" class="w-10 h-10 flex items-center justify-center rounded-full hover:bg-secondary transition-colors">
              <svg class="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
          <div class="lg:flex-1 lg:overflow-y-auto">
            <div data-cm-transition-preview class="hidden">
              <div class="relative w-full h-32 overflow-hidden">
                <video data-cm-transition-video class="absolute inset-0 w-full h-full object-cover" autoplay muted loop playsinline></video>
                <div class="absolute inset-0 bg-black/30 flex items-center justify-center">
                  <span data-cm-transition-type class="text-2xl font-black italic uppercase tracking-wide" style="color:#9335EC;"></span>
                </div>
              </div>
            </div>
            <div class="p-4 border-b border-border">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75"/></svg>
                  PROMPT
                </div>
                <button data-cm-copy-prompt type="button" class="px-3 py-1 rounded-ios-lg bg-secondary hover:bg-secondary/80 text-foreground text-xs font-medium transition-colors">Copy</button>
              </div>
              <p data-cm-prompt class="text-foreground text-sm leading-relaxed">No prompt available</p>
              <div data-cm-input-media class="hidden mt-4"><div data-cm-input-media-grid class="grid grid-cols-2 gap-2"></div></div>
            </div>
            <div class="p-4">
              <div class="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-4">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z"/></svg>
                INFORMATION
              </div>
              <div data-cm-info-rows class="space-y-4"></div>
            </div>
          </div>
        </div>
        <div class="order-3 lg:order-none w-full bg-card flex-shrink-0 p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] border-t border-border space-y-3">
          <div data-cm-top-actions class="grid grid-cols-1 gap-3">
            <a data-cm-recreate href="#" class="h-12 flex items-center justify-center gap-2 rounded-ios-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold transition-colors">
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none"><path d="M12 22.75C6.07 22.75 1.25 17.93 1.25 12C1.25 6.07 6.07 1.25 12 1.25C17.93 1.25 22.75 6.07 22.75 12C22.75 17.93 17.93 22.75 12 22.75ZM12 2.75C6.9 2.75 2.75 6.9 2.75 12C2.75 17.1 6.9 21.25 12 21.25C17.1 21.25 21.25 17.1 21.25 12C21.25 6.9 17.1 2.75 12 2.75Z" fill="currentColor"/><path d="M12 17.47c-1.4 0-2.8-.53-3.87-1.6a5.55 5.55 0 0 1-.76-.96.75.75 0 1 1 1.27-.8c.17.28.35.5.55.7a3.97 3.97 0 0 0 5.62 0c.6-.6.98-1.38 1.1-2.25a.75.75 0 0 1 1.49.21 5.52 5.52 0 0 1-1.53 3.1A5.46 5.46 0 0 1 12 17.47Z" fill="currentColor"/><path d="M7.34 12.08a.75.75 0 0 1-.75-.85 5.52 5.52 0 0 1 1.53-3.1 5.47 5.47 0 0 1 7.74 0c.28.28.53.59.76.97a.75.75 0 1 1-1.27.79c-.17-.27-.35-.5-.55-.7a3.97 3.97 0 0 0-5.62 0c-.6.6-.98 1.38-1.1 2.25a.75.75 0 0 1-.74.64Z" fill="currentColor"/><path d="M7.82 17.93a.75.75 0 0 1-.75-.75v-2.67a.75.75 0 0 1 .75-.75h2.67a.75.75 0 1 1 0 1.5H8.57v1.92a.75.75 0 0 1-.75.75Z" fill="currentColor"/><path d="M16.18 10.24h-2.67a.75.75 0 1 1 0-1.5h1.92V6.82a.75.75 0 0 1 1.5 0v2.67a.75.75 0 0 1-.75.75Z" fill="currentColor"/></svg>
              Remix
            </a>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <button data-cm-download type="button" class="h-11 flex items-center justify-center gap-2 rounded-ios-xl bg-secondary hover:bg-secondary/80 text-foreground text-sm font-medium transition-colors">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>
              Download
            </button>
            <button data-cm-upscale type="button" class="h-11 flex items-center justify-center gap-2 rounded-ios-xl bg-secondary hover:bg-secondary/80 text-foreground text-sm font-medium transition-colors">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"/></svg>
              Upscale
            </button>
          </div>
          <div data-cm-report-wrap class="hidden w-full flex justify-center mt-1">
            <button data-cm-report data-report-text-mode="true" type="button" class="text-xs text-muted-foreground hover:text-foreground transition-colors">
              <svg class="w-3 h-3 inline-block mr-0.5 align-[-1px]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5"/></svg> Report
            </button>
          </div>
        </div>
      </div>
    </div>`;

  document.body.appendChild(modal);

  const q = (sel) => modal.querySelector(sel);
  _dynamicModalElements = {
    detailModal: modal,
    modalMedia: q('[data-cm-media]'),
    modalPrompt: q('[data-cm-prompt]'),
    modalInfoRows: q('[data-cm-info-rows]'),
    modalSeeAll: null,
    modalInputMedia: q('[data-cm-input-media]'),
    modalInputMediaGrid: q('[data-cm-input-media-grid]'),
    modalRecreate: q('[data-cm-recreate]'),
    modalPublish: null,
    modalTopActions: q('[data-cm-top-actions]'),
    modalAvatar: q('[data-cm-avatar]'),
    modalAuthorName: q('[data-cm-author]'),
    modalAvatarMobile: q('[data-cm-avatar-mobile]'),
    modalAuthorNameMobile: q('[data-cm-author-mobile]'),
    modalTransitionPreview: q('[data-cm-transition-preview]'),
    modalTransitionVideo: q('[data-cm-transition-video]'),
    modalTransitionType: q('[data-cm-transition-type]'),
    modalReportWrap: q('[data-cm-report-wrap]'),
    modalReport: q('[data-cm-report]'),
  };

  const doClose = () => closeCreationModal(_dynamicModalElements);

  q('[data-cm-close]')?.addEventListener('click', doClose);
  q('[data-cm-close-mobile]')?.addEventListener('click', doClose);
  q('[data-cm-media-area]')?.addEventListener('click', (e) => {
    if (e.target === q('[data-cm-media-area]')) doClose();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) doClose();
  });

  q('[data-cm-copy-prompt]')?.addEventListener('click', async () => {
    const text = q('[data-cm-prompt]')?.textContent || '';
    const btn = q('[data-cm-copy-prompt]');
    try {
      await navigator.clipboard.writeText(text);
      if (btn) {
        const orig = btn.textContent;
        btn.textContent = 'Copied!';
        btn.classList.add('bg-primary', 'text-primary-foreground');
        btn.classList.remove('bg-secondary');
        setTimeout(() => { btn.textContent = orig; btn.classList.remove('bg-primary', 'text-primary-foreground'); btn.classList.add('bg-secondary'); }, 1800);
      }
    } catch { /* ignore */ }
  });

  q('[data-cm-download]')?.addEventListener('click', async () => {
    const output = _dynamicCurrentOutput;
    const previewUrl = output?.preview?.url;
    if (!previewUrl) return;
    try {
      const res = await fetch(previewUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = output?.preview?.kind === 'video' ? 'mp4' : output?.preview?.kind === 'audio' ? 'mp3' : 'png';
      a.download = `creation-${output?.id || 'download'}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
  });

  q('[data-cm-upscale]')?.addEventListener('click', () => {
    const output = _dynamicCurrentOutput;
    const previewUrl = output?.preview?.url;
    const kind = output?.preview?.kind || 'image';
    if (!previewUrl) return;
    const agent = kind === 'video' ? 'video-upscaler' : 'image-upscaler';
    const param = kind === 'video' ? 'videoUrl' : 'imageUrl';
    window.location.href = `/aitopia/marketplace/agent/${agent}.html?${param}=${encodeURIComponent(previewUrl)}`;
  });

  q('[data-cm-report]')?.addEventListener('click', () => {
    const output = _dynamicCurrentOutput;
    const outputId = output?.id;
    if (!outputId) return;
    _openDynamicReportOverlay(modal, outputId, q('[data-cm-report]'));
  });

  return _dynamicModalElements;
}

const _REPORT_REASON_LABELS = { nsfw: 'NSFW / Sexual content', spam: 'Spam', copyright: 'Copyright', hate: 'Hate / Harassment', violence: 'Violence', impersonation: 'Impersonation', other: 'Other' };
const _FLAG_SVG = '<svg class="w-3 h-3 inline-block mr-0.5 align-[-1px]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5"/></svg>';

function _updateDynamicReportButton(outputId, elements) {
  const wrap = elements.modalReportWrap;
  const btn = elements.modalReport;
  if (!wrap || !btn) return;
  wrap.classList.add('hidden');

  fetchOutputDetails(outputId).then(details => {
    if (!details) return;
    const visibility = details.output?.visibility || 'private';
    const moderation = details.output?.moderationStatus || 'pending';
    const isOwner = Boolean(details.viewer?.isOwner);
    if (isOwner || visibility !== 'public' || moderation !== 'approved') return;

    wrap.classList.remove('hidden');
    const hasReported = Boolean(details.viewer?.hasReported);
    if (hasReported) {
      const label = _REPORT_REASON_LABELS[details.viewer?.reportReason] || details.viewer?.reportReason || 'Reported';
      btn.disabled = true;
      btn.innerHTML = `${_FLAG_SVG} Reported: ${escapeHtml(label)}`;
      btn.className = 'text-xs text-red-500/70 cursor-not-allowed transition-colors';
    } else {
      btn.disabled = false;
      btn.innerHTML = `${_FLAG_SVG} Report`;
      btn.className = 'text-xs text-muted-foreground hover:text-foreground transition-colors';
    }
  }).catch(() => {});
}

function _openDynamicReportOverlay(modal, outputId, reportBtn) {
  modal.querySelector('[data-cm-report-overlay]')?.remove();

  const overlay = document.createElement('div');
  overlay.setAttribute('data-cm-report-overlay', '');
  overlay.className = 'fixed inset-0 z-[60] flex items-center justify-center p-4';
  overlay.innerHTML = `
    <div class="absolute inset-0 bg-black/40" data-cm-report-backdrop></div>
    <div class="relative z-10 w-[min(480px,92vw)] rounded-ios-2xl border border-border bg-card shadow-xl overflow-hidden">
      <div class="p-4 border-b border-border flex items-center justify-between">
        <span class="font-semibold text-sm">Report creation</span>
        <button data-cm-report-close type="button" class="h-9 px-3 rounded-full bg-secondary hover:bg-secondary/80 text-sm font-semibold transition-colors">Close</button>
      </div>
      <form data-cm-report-form class="p-5 space-y-4">
        <div>
          <label class="block text-sm font-semibold mb-2">Reason</label>
          <select data-cm-report-reason class="w-full h-11 px-4 rounded-full bg-secondary/80 border-0 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all">
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
          <label class="block text-sm font-semibold mb-2">Details (optional)</label>
          <textarea data-cm-report-details rows="4" maxlength="500" class="w-full p-4 rounded-ios-xl bg-secondary/80 border-0 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" placeholder="Add context for moderators…"></textarea>
        </div>
        <div class="pt-2 flex items-center gap-2">
          <button type="submit" data-cm-report-submit class="h-11 px-6 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">Submit report</button>
          <button type="button" data-cm-report-cancel class="h-11 px-6 rounded-full bg-secondary hover:bg-secondary/80 text-sm font-semibold transition-colors">Cancel</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector('[data-cm-report-backdrop]')?.addEventListener('click', close);
  overlay.querySelector('[data-cm-report-close]')?.addEventListener('click', close);
  overlay.querySelector('[data-cm-report-cancel]')?.addEventListener('click', close);

  overlay.querySelector('[data-cm-report-form]')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = overlay.querySelector('[data-cm-report-submit]');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Submitting…'; }

    try {
      const reason = overlay.querySelector('[data-cm-report-reason]')?.value ?? 'other';
      const details = (overlay.querySelector('[data-cm-report-details]')?.value ?? '').trim() || undefined;
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
      const label = _REPORT_REASON_LABELS[reason] || reason;
      if (reportBtn) {
        reportBtn.disabled = true;
        reportBtn.innerHTML = `${_FLAG_SVG} Reported: ${escapeHtml(label)}`;
        reportBtn.className = 'text-xs text-red-500/70 cursor-not-allowed transition-colors';
      }
      alert('Report submitted. Thank you.');
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Submit report'; }
    }
  });
}

/**
 * Open the dynamic creation modal. Lazily creates the modal DOM if needed.
 */
export function openDynamicCreationModal(output) {
  const elements = ensureCreationModal();
  _dynamicCurrentOutput = output;
  // Hide report until verified
  elements.modalReportWrap?.classList.add('hidden');
  const result = openCreationModal(output, { elements, pushState: false });
  // Check report status for published outputs
  const outputId = output?.id;
  if (outputId && elements.modalReport) {
    _updateDynamicReportButton(outputId, elements);
  }
  return result;
}

export function closeCreationModal(elements, options = {}) {
  const { onClose } = options;

  if (!elements?.detailModal) return;
  elements.detailModal.classList.add('hidden');
  document.body.style.overflow = '';

  const bottomNav = document.querySelector('[data-bottom-tabs]');
  if (bottomNav) bottomNav.style.display = '';
  const topNav = document.getElementById('header');
  if (topNav) topNav.style.display = '';

  if (elements.modalMedia) {
    const video = elements.modalMedia.querySelector('video');
    const audio = elements.modalMedia.querySelector('audio');
    if (video) video.pause();
    if (audio) audio.pause();
  }

  if (onClose) onClose();
}
