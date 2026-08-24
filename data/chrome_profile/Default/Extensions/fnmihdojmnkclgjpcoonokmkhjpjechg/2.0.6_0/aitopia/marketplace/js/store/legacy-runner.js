// Extracted legacy in-store runner code.
// Loaded dynamically only when the URL includes ?legacy=1 (or ?legacy=true).
//
// This keeps the default /store experience fast while preserving the legacy runner as a safety net.

// Large upload support: inline small files as data URLs, upload larger files to `https://aitopia.ai/api/uploads`.
// This avoids blowing up JSON payload limits when running video agents.
const LEGACY_MAX_IMAGE_INLINE_BYTES = 10 * 1024 * 1024; // 10MB
const LEGACY_MAX_AUDIO_INLINE_BYTES = 10 * 1024 * 1024; // 10MB
const LEGACY_MAX_VIDEO_INLINE_BYTES = 15 * 1024 * 1024; // 15MB

const LEGACY_MAX_IMAGE_UPLOAD_BYTES = 20 * 1024 * 1024; // 20MB
const LEGACY_MAX_AUDIO_UPLOAD_BYTES = 50 * 1024 * 1024; // 50MB
const LEGACY_MAX_VIDEO_UPLOAD_BYTES = 150 * 1024 * 1024; // 150MB

function legacyFormatBytes(bytes) {
  if (!Number.isFinite(bytes)) return `${bytes}`;
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function legacyNotify(message, type = 'info') {
  if (typeof showNotification === 'function') {
    try {
      showNotification(message, type);
      return;
    } catch { }
  }
  if (type === 'error') console.error(message);
  else console.warn(message);
}

function legacyClearMediaState(el) {
  if (!el || !el.dataset) return;
  const objectUrl = el.dataset.objectUrl;
  if (objectUrl) {
    try {
      URL.revokeObjectURL(objectUrl);
    } catch { }
  }
  delete el.dataset.objectUrl;
  delete el.dataset.uploadedUrl;
}

function legacyGetMediaValue(el) {
  if (!el) return '';
  const uploadedUrl = el.dataset?.uploadedUrl;
  if (uploadedUrl) return uploadedUrl;
  return el.src || '';
}

async function legacyUploadFileToServer(file, options = {}) {
  if (!(file instanceof File)) throw new Error('Invalid file');

  const filename = typeof options.filename === 'string' && options.filename.trim().length > 0
    ? options.filename.trim()
    : file.name;

  const params = new URLSearchParams();
  if (filename) params.set('filename', filename);

  const baseUrl = typeof API_BASE_URL === 'string' && API_BASE_URL ? API_BASE_URL : window.location.origin;
  const url = `${baseUrl}/api/uploads${params.toString() ? `?${params.toString()}` : ''}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });

  let json = null;
  try {
    const text = await res.text();
    json = text ? JSON.parse(text) : null;
  } catch { }

  if (!res.ok) {
    const message = json?.error || json?.message || `Upload failed (${res.status})`;
    throw new Error(message);
  }

  const uploadedUrl = json?.url;
  if (!uploadedUrl || typeof uploadedUrl !== 'string') {
    throw new Error('Upload failed: missing URL in response');
  }
  return uploadedUrl;
}

const legacyPendingUploads = new Map();

function legacyUploadKey(agentId, slot) {
  return `${agentId}::${slot}`;
}

function legacyTrackPendingUpload(agentId, slot, promise) {
  const key = legacyUploadKey(agentId, slot);
  legacyPendingUploads.set(key, promise);
  promise.finally(() => {
    if (legacyPendingUploads.get(key) === promise) legacyPendingUploads.delete(key);
  });
  return promise;
}

async function legacyWaitForPendingUploads(agentId) {
  const prefix = `${agentId}::`;
  const pending = [];
  for (const [key, promise] of legacyPendingUploads.entries()) {
    if (key.startsWith(prefix)) pending.push(promise);
  }
  if (pending.length === 0) return;
  await Promise.all(pending);
}

function getModelIconForId(modelId) {
  if (!modelId || typeof modelId !== 'string') return '🤖';
  const id = modelId.toLowerCase();
  if (id === 'google/nano-banana') return '⚡';
  if (id === 'google/nano-banana-pro') return '✨';
  if (id.includes('rembg') || id.includes('remove-bg')) return '🧼';
  if (id.includes('gpt-image') || id.includes('dall-e') || id.includes('imagen')) return '🖼️';
  if (id.includes('flux')) return '🎨';
  if (id.includes('esrgan') || id.includes('upscaler') || id.includes('upscale')) return '🔍';
  if (id.includes('inpaint')) return '🩹';
  if (id.includes('vton') || id.includes('oot')) return '👗';
  return '🤖';
}

function getCreditsDisplayForModelChoice(choice) {
  return window.AitopiaCredits?.getCreditsDisplayForModelChoice?.(choice) ?? '';
}

function getDefaultModelIcon(agent) {
  const modelChoices = Array.isArray(agent?.modelChoices) ? agent.modelChoices : [];
  if (modelChoices[0]?.id) return getModelIconForId(modelChoices[0].id);
  const models = Array.isArray(agent?.models) ? agent.models : [];
  if (models[0]?.icon) return models[0].icon;
  return '🤖';
}

function renderModelSelectOptions(agent) {
  const modelChoices = Array.isArray(agent?.modelChoices) ? agent.modelChoices : [];
  if (modelChoices.length > 0) {
    return modelChoices.map((m, i) => {
      const id = String(m.id || '');
      const name = String(m.displayName || m.id || 'Model');
      const icon = getModelIconForId(id);
      const credits = getCreditsDisplayForModelChoice(m);
      const star = m.recommended ? ' ★' : '';
      return `<option value="${id}" ${i === 0 ? 'selected' : ''}>${icon} ${name}${credits}${star}</option>`;
    }).join('');
  }

  const models = Array.isArray(agent?.models) ? agent.models : [];
  return models.map((m, i) => `<option value="${m.id || m.name}" ${i === 0 ? 'selected' : ''}>${m.icon || '🤖'} ${m.name || m.id || 'Model'}</option>`).join('');
}

function getSelectedModelIdForAgent(agentId) {
  const agent = agents?.[agentId];
  const modelSelect = document.getElementById(`modelSelect-${agentId}`);
  if (!modelSelect || !modelSelect.value) return undefined;

  const raw = String(modelSelect.value).trim();
  if (!raw) return undefined;

  const modelChoices = Array.isArray(agent?.modelChoices) ? agent.modelChoices : [];
  if (modelChoices.some(m => m.id === raw)) return raw;

  // Legacy short IDs → registry IDs (best-effort backcompat)
  const legacyMap = {
    'nano-banana': 'google/nano-banana',
    'nano-banana-pro': 'google/nano-banana-pro',
    'flux-schnell': 'black-forest-labs/flux-schnell',
    'flux-dev': 'black-forest-labs/flux-dev',
    'flux-pro': 'black-forest-labs/flux-pro',
    'dall-e-3': 'openai/dall-e-3',
    'stable-diffusion-xl': 'stability-ai/sdxl',
  };
  const mapped = legacyMap[raw];
  if (mapped) {
    if (modelChoices.length === 0 || modelChoices.some(m => m.id === mapped)) return mapped;
  }

  if (raw.includes('/')) return raw;
  return undefined;
}

function getAgentSpecificUI(agent) {
  switch (agent.id) {
    case 'virtual-try-on':
      return `
            <!-- Step 1: Select or Upload Model Photo -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-3">Step 1: Select Model (or upload your own)</label>
              <div class="flex gap-2 mb-4">
                <button class="model-tab-btn px-4 py-2 rounded-ios bg-primary text-primary-foreground text-sm font-medium" data-tab="default">Default models</button>
                <button class="model-tab-btn px-4 py-2 rounded-ios bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80" data-tab="custom">Upload custom</button>
              </div>

              <!-- Default Model Gallery -->
              <div id="defaultModelTab" class="mb-4">
                <div class="flex gap-3 mb-3">
                  <select class="flex-1 px-3 py-2 rounded-ios bg-secondary text-sm border-0">
                    ${agent.genderOptions.map(g => `<option>${g}</option>`).join('')}
                  </select>
                  <select class="flex-1 px-3 py-2 rounded-ios bg-secondary text-sm border-0">
                    ${agent.bodyTypes.map(b => `<option>${b}</option>`).join('')}
                  </select>
                </div>
                <div class="grid grid-cols-4 gap-2">
                  ${agent.modelGallery.map((img, i) => `
                    <div class="aspect-[3/4] rounded-ios-lg overflow-hidden cursor-pointer border-2 ${i === 0 ? 'border-primary' : 'border-transparent hover:border-primary/50'} transition-colors model-select" data-action="selectModel" data-param="${agent.id}">
                      <img src="${img}" class="w-full h-full object-cover" alt="Model ${i + 1}">
                    </div>
                  `).join('')}
                </div>
              </div>

              <!-- Custom Model Upload - In-box preview -->
              <div id="customModelTab" class="hidden">
                <div id="uploadBox-${agent.id}" class="relative border-2 border-dashed border-border rounded-ios-xl aspect-[3/4] max-w-[200px] overflow-hidden cursor-pointer hover:border-primary/50 transition-colors" data-trigger-file="fileInput-${agent.id}">
                  <input type="file" id="fileInput-${agent.id}" class="hidden" accept="image/*" data-onchange="handleUploadInBox" data-param="${agent.id}">
                  <div id="placeholder-${agent.id}" class="absolute inset-0 flex flex-col items-center justify-center p-4">
                    <svg class="w-10 h-10 mb-2 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-width="1.5" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0"/>
                    </svg>
                    <p class="text-sm font-medium text-center">Upload full-body photo</p>
                    <p class="text-xs text-muted-foreground mt-1 text-center">Clear, front-facing</p>
                  </div>
                  <img id="previewImg-${agent.id}" class="absolute inset-0 w-full h-full object-cover hidden" alt="Preview">
                  <button id="clearBtn-${agent.id}" data-action="clearUploadInBox" data-param="${agent.id}" data-stop-propagation class="absolute top-2 right-2 w-6 h-6 bg-ios-red text-white rounded-full items-center justify-center hidden z-10">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
              </div>
            </div>

            <!-- Step 2: Upload Outfit/Clothing Reference - In-box preview -->
            <div class="mb-6">
              <div class="flex items-center justify-between mb-3">
                <label class="text-sm font-semibold">Step 2: Upload Outfit Reference</label>
                <select class="px-3 py-1.5 rounded-ios bg-secondary text-sm border-0">
                  ${agent.garmentTypes.map(t => `<option value="${t}">${t.charAt(0).toUpperCase() + t.slice(1)}</option>`).join('')}
                </select>
              </div>
              <div id="uploadBox2-${agent.id}" class="relative border-2 border-dashed border-border rounded-ios-xl aspect-[3/4] max-w-[200px] overflow-hidden cursor-pointer hover:border-primary/50 transition-colors" data-trigger-file="fileInput2-${agent.id}">
                <input type="file" id="fileInput2-${agent.id}" class="hidden" accept="image/*" data-onchange="handleUploadInBox2" data-param="${agent.id}">
                <div id="placeholder2-${agent.id}" class="absolute inset-0 flex flex-col items-center justify-center p-4">
                  <svg class="w-10 h-10 mb-2 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-width="1.5" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z"/>
                    <path stroke-width="1.5" d="M6 6h.008v.008H6V6z"/>
                  </svg>
                  <p class="text-sm font-medium text-center">Upload clothing image</p>
                  <p class="text-xs text-muted-foreground mt-1 text-center">Full outfit photo</p>
                </div>
                <img id="previewImg2-${agent.id}" class="absolute inset-0 w-full h-full object-cover hidden" alt="Outfit Preview">
                <button id="clearBtn2-${agent.id}" data-action="clearUploadInBox2" data-param="${agent.id}" data-stop-propagation class="absolute top-2 right-2 w-6 h-6 bg-ios-red text-white rounded-full items-center justify-center hidden z-10">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            </div>
          `;

    case 'video-generator':
      return `
            <!-- Start/End Frame Upload -->
            <div class="grid grid-cols-2 gap-4 mb-6">
              <div>
                <div class="flex items-center gap-2 mb-2">
                  <svg class="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                  <span class="text-sm font-semibold">Start frame</span>
                  <span class="text-xs text-muted-foreground">Required</span>
                </div>
                <div id="uploadBox-${agent.id}" class="relative border-2 border-dashed border-border rounded-ios-xl aspect-video overflow-hidden cursor-pointer hover:border-primary/50 transition-colors" data-trigger-file="fileInput-${agent.id}">
                  <input type="file" id="fileInput-${agent.id}" class="hidden" accept="image/*" data-onchange="handleUploadInBox" data-param="${agent.id}">
                  <div id="placeholder-${agent.id}" class="absolute inset-0 flex flex-col items-center justify-center p-4">
                    <svg class="w-8 h-8 mb-2 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                    <p class="text-xs text-muted-foreground">Click to upload</p>
                  </div>
                  <img id="previewImg-${agent.id}" class="absolute inset-0 w-full h-full object-cover hidden" alt="Start Frame">
                  <button id="clearBtn-${agent.id}" data-action="clearUploadInBox" data-param="${agent.id}" data-stop-propagation class="absolute top-2 right-2 w-6 h-6 bg-ios-red text-white rounded-full items-center justify-center hidden z-10">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
              </div>
              <div>
                <div class="flex items-center gap-2 mb-2">
                  <svg class="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                  <span class="text-sm font-semibold">End frame</span>
                  <span class="text-xs text-muted-foreground">Optional</span>
                </div>
                <div id="uploadBox2-${agent.id}" class="relative border-2 border-dashed border-border rounded-ios-xl aspect-video overflow-hidden cursor-pointer hover:border-primary/50 transition-colors" data-trigger-file="fileInput2-${agent.id}">
                  <input type="file" id="fileInput2-${agent.id}" class="hidden" accept="image/*" data-onchange="handleUploadInBox2" data-param="${agent.id}">
                  <div id="placeholder2-${agent.id}" class="absolute inset-0 flex flex-col items-center justify-center p-4">
                    <svg class="w-8 h-8 mb-2 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                    <p class="text-xs text-muted-foreground">Click to upload</p>
                  </div>
                  <img id="previewImg2-${agent.id}" class="absolute inset-0 w-full h-full object-cover hidden" alt="End Frame">
                  <button id="clearBtn2-${agent.id}" data-action="clearUploadInBox2" data-param="${agent.id}" data-stop-propagation class="absolute top-2 right-2 w-6 h-6 bg-ios-red text-white rounded-full items-center justify-center hidden z-10">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
              </div>
            </div>

            <!-- Prompt -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-2">Prompt</label>
              <textarea id="prompt-${agent.id}" rows="3" placeholder="Describe the scene you imagine, with details." class="w-full px-4 py-3 rounded-ios-lg bg-muted border-0 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"></textarea>
              <div class="flex items-center gap-2 mt-2">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" id="enhanceOn-${agent.id}" class="w-4 h-4 rounded accent-primary">
                  <span class="text-sm">Enhance on</span>
                </label>
              </div>
            </div>

            <!-- Model Selection -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-2">Model</label>
              <div class="flex items-center gap-3 p-3 rounded-ios-lg bg-muted">
                <span id="modelIcon-${agent.id}" class="text-lg">${agent.models[0].icon}</span>
                <select id="modelSelect-${agent.id}" class="flex-1 bg-transparent border-0 text-sm font-medium focus:outline-none" data-onchange="updateModelIcon" data-param="${agent.id}">
                  ${agent.models.map((m, i) => `<option value="${m.id || m.name}" ${i === 0 ? 'selected' : ''}>${m.icon} ${m.name}</option>`).join('')}
                </select>
              </div>
            </div>

            <!-- Duration & Resolution -->
            <div class="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label class="block text-sm font-semibold mb-2">Duration</label>
                <select class="w-full px-3 py-2 rounded-ios bg-muted border-0 text-sm">
                  ${agent.durations.map(d => `<option>${d}</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="block text-sm font-semibold mb-2">Resolution</label>
                <select class="w-full px-3 py-2 rounded-ios bg-muted border-0 text-sm">
                  ${agent.resolutions.map(r => `<option>${r}</option>`).join('')}
                </select>
              </div>
            </div>
          `;

    case 'lip-sync':
      return `
            <!-- Upload Portrait -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-3">Upload Portrait Image or Video</label>
              <div id="uploadBox-${agent.id}" class="border-2 border-dashed border-border rounded-ios-xl p-8 text-center hover:border-primary/50 transition-all cursor-pointer" data-trigger-file="fileInput-${agent.id}">
                <input type="file" id="fileInput-${agent.id}" class="hidden" accept="image/*,video/*" data-onchange="handleFileUpload" data-param="${agent.id}">
                <svg class="w-12 h-12 mx-auto mb-3 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-width="1.5" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0"/>
                </svg>
                <p class="text-sm font-medium">Upload portrait</p>
                <p class="text-xs text-muted-foreground mt-1">Image or video with face</p>
              </div>
              <!-- Preview container -->
              <div id="preview-${agent.id}" class="hidden mt-4 relative">
                <img id="previewImg-${agent.id}" class="w-full rounded-ios-lg object-cover max-h-48" />
                <video id="previewVideo-${agent.id}" class="hidden w-full rounded-ios-lg max-h-48" controls></video>
                <button data-action="clearPortraitPreview" data-param="${agent.id}" class="absolute top-2 right-2 p-1 bg-black/50 rounded-full hover:bg-black/70">
                  <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            </div>

            <!-- Audio Input Mode -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-3">Audio Input</label>
              <div id="audioModeButtons-${agent.id}" class="flex gap-2 mb-4">
                ${agent.audioModes.map((mode, i) => `
                  <button
                    data-mode="${mode.toLowerCase().replace(/-/g, '').replace(/\s+/g, '-')}"
                    data-action="switchAudioMode" data-param="${agent.id}" data-param2="${mode.toLowerCase().replace(/-/g, '').replace(/\s+/g, '-')}"
                    class="flex-1 px-3 py-2 rounded-ios ${i === 0 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'} text-sm font-medium transition-colors audio-mode-btn-${agent.id}"
                  >${mode}</button>
                `).join('')}
              </div>

              <!-- Upload Audio Mode -->
              <div id="audioMode-upload-audio-${agent.id}" class="audio-mode-content-${agent.id}">
                <div class="border-2 border-dashed border-border rounded-ios-xl p-6 text-center hover:border-primary/50 cursor-pointer" data-trigger-file="audioFileInput-${agent.id}">
                  <input type="file" id="audioFileInput-${agent.id}" class="hidden" accept="audio/*" data-onchange="handleAudioUpload" data-param="${agent.id}">
                  <svg class="w-8 h-8 mx-auto mb-2 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-width="1.5" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/>
                  </svg>
                  <p class="text-sm text-muted-foreground">Upload audio file</p>
                  <p class="text-xs text-muted-foreground mt-1">MP3, WAV, M4A</p>
                </div>
                <div id="audioPreview-${agent.id}" class="hidden mt-3">
                  <audio id="audioPlayer-${agent.id}" controls class="w-full"></audio>
                  <button data-action="clearAudioPreview" data-param="${agent.id}" class="mt-2 text-xs text-muted-foreground hover:text-foreground">Remove audio</button>
                </div>
              </div>

              <!-- Text-to-Speech Mode -->
              <div id="audioMode-texttospeech-${agent.id}" class="hidden audio-mode-content-${agent.id}">
                <textarea
                  id="ttsText-${agent.id}"
                  rows="4"
                  placeholder="Enter the text you want the AI to speak..."
                  class="w-full px-4 py-3 rounded-ios-lg bg-muted border-0 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                ></textarea>
                <p class="text-xs text-muted-foreground mt-2">The AI will convert your text to speech</p>
              </div>

              <!-- Record Mode -->
              <div id="audioMode-record-${agent.id}" class="hidden audio-mode-content-${agent.id}">
                <div class="border-2 border-dashed border-border rounded-ios-xl p-6 text-center">
                  <button id="recordBtn-${agent.id}" data-action="toggleRecording" data-param="${agent.id}" class="w-16 h-16 mx-auto mb-3 rounded-full bg-ios-red hover:bg-ios-red/80 flex items-center justify-center transition-all">
                    <svg id="recordIcon-${agent.id}" class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="6"/>
                    </svg>
                  </button>
                  <p id="recordStatus-${agent.id}" class="text-sm text-muted-foreground">Click to start recording</p>
                  <p id="recordTimer-${agent.id}" class="text-xs text-muted-foreground mt-1 hidden">00:00</p>
                </div>
                <div id="recordingPreview-${agent.id}" class="hidden mt-3">
                  <audio id="recordingPlayer-${agent.id}" controls class="w-full"></audio>
                  <button data-action="clearRecording" data-param="${agent.id}" class="mt-2 text-xs text-muted-foreground hover:text-foreground">Remove recording</button>
                </div>
              </div>
            </div>

            <!-- Language & Voice -->
            <div class="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label class="block text-sm font-semibold mb-2">Language</label>
                <select id="language-${agent.id}" class="w-full px-3 py-2 rounded-ios bg-muted border-0 text-sm">
                  ${agent.languages.map((l, i) => `<option value="${l.toLowerCase()}" ${i === 0 ? 'selected' : ''}>${l}</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="block text-sm font-semibold mb-2">Voice Style</label>
                <select id="voiceStyle-${agent.id}" class="w-full px-3 py-2 rounded-ios bg-muted border-0 text-sm">
                  ${agent.voiceStyles.map((v, i) => `<option value="${v.toLowerCase()}" ${i === 0 ? 'selected' : ''}>${v}</option>`).join('')}
                </select>
              </div>
            </div>
          `;

    case 'music-generator':
      return `
            <!-- Prompt -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-3">Describe your music</label>
              <textarea rows="4" placeholder="Describe the music you want to create... e.g., 'Upbeat electronic track with synths and a catchy melody'" class="w-full px-4 py-3 rounded-ios-lg bg-muted border-0 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"></textarea>
            </div>

            <!-- Genre Selection -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-3">Genre</label>
              <div id="genreSelection-${agent.id}" class="flex flex-wrap gap-2" data-selected="${agent.genres[0]}">
                ${agent.genres.map((genre, i) => `
                  <button data-action="selectOption" data-param="genre-${agent.id}" class="px-4 py-2 rounded-full ${i === 0 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'} text-sm font-medium transition-colors">${genre}</button>
                `).join('')}
              </div>
            </div>

            <!-- Mood Selection -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-3">Mood</label>
              <div id="moodSelection-${agent.id}" class="flex flex-wrap gap-2" data-selected="${agent.moods[0]}">
                ${agent.moods.map((mood, i) => `
                  <button data-action="selectOption" data-param="mood-${agent.id}" class="px-4 py-2 rounded-full ${i === 0 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'} text-sm font-medium transition-colors">${mood}</button>
                `).join('')}
              </div>
            </div>

            <!-- Duration -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-3">Duration</label>
              <div id="musicDurationSelection-${agent.id}" class="flex gap-2" data-selected="${agent.durations[1]}">
                ${agent.durations.map((dur, i) => `
                  <button data-action="selectOption" data-param="musicDuration-${agent.id}" class="flex-1 px-3 py-2 rounded-ios ${i === 1 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'} text-sm font-medium transition-colors">${dur}</button>
                `).join('')}
              </div>
            </div>
          `;

    case 'voice-cloner':
      return `
            <!-- Voice Type -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-3">Voice Type</label>
              <div id="voiceTypeSelection-${agent.id}" class="grid grid-cols-4 gap-2" data-selected="${agent.voiceTypes[0]}">
                ${agent.voiceTypes.map((type, i) => `
                  <button data-action="selectOption" data-param="voiceType-${agent.id}" class="px-3 py-3 rounded-ios-lg ${i === 0 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'} text-sm font-medium transition-colors">${type}</button>
                `).join('')}
              </div>
            </div>

            <!-- Clone Voice Upload -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-3">Upload Voice Sample (for cloning)</label>
              <div class="border-2 border-dashed border-border rounded-ios-xl p-6 text-center hover:border-primary/50 cursor-pointer">
                <svg class="w-10 h-10 mx-auto mb-2 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-width="1.5" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"/>
                </svg>
                <p class="text-sm font-medium">Upload audio sample</p>
                <p class="text-xs text-muted-foreground mt-1">MP3, WAV up to 30 seconds</p>
              </div>
            </div>

            <!-- Text Input -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-3">Text to Speak</label>
              <textarea rows="4" placeholder="Enter the text you want the AI to speak..." class="w-full px-4 py-3 rounded-ios-lg bg-muted border-0 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"></textarea>
            </div>

            <!-- Language & Emotion -->
            <div class="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label class="block text-sm font-semibold mb-2">Language</label>
                <select class="w-full px-3 py-2 rounded-ios bg-muted border-0 text-sm">
                  ${agent.languages.map(l => `<option>${l}</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="block text-sm font-semibold mb-2">Emotion</label>
                <select class="w-full px-3 py-2 rounded-ios bg-muted border-0 text-sm">
                  ${agent.emotions.map(e => `<option>${e}</option>`).join('')}
                </select>
              </div>
            </div>
          `;

    case 'chibi-sticker-maker':
      return `
            <!-- Upload Photo -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-3">Upload Your Photo</label>
              <div id="uploadBox-${agent.id}" class="border-2 border-dashed border-border rounded-ios-xl p-8 text-center hover:border-primary/50 transition-all cursor-pointer" data-trigger-file="fileInput-${agent.id}">
                <input type="file" id="fileInput-${agent.id}" class="hidden" accept="image/*" data-onchange="handleFileUpload" data-param="${agent.id}">
                <div id="placeholder-${agent.id}">
                  <svg class="w-12 h-12 mx-auto mb-3 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-width="1.5" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0"/>
                  </svg>
                  <p class="text-sm font-medium">Upload a photo with your face</p>
                  <p class="text-xs text-muted-foreground mt-1">Clear face photo works best</p>
                </div>
              </div>
              <!-- Preview container -->
              <div id="preview-${agent.id}" class="hidden mt-4 relative">
                <img id="previewImg-${agent.id}" class="w-full rounded-ios-lg object-cover max-h-48" alt="Preview" />
                <video id="previewVideo-${agent.id}" class="hidden w-full rounded-ios-lg max-h-48" controls></video>
                <button data-action="clearUpload" data-param="${agent.id}" class="absolute top-2 right-2 p-2 bg-black/50 rounded-full hover:bg-black/70 transition-colors">
                  <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            </div>

            <!-- Sticker Style -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-3">Sticker Style</label>
              <div id="stickerStyleSelection-${agent.id}" class="grid grid-cols-4 gap-2" data-selected="${agent.stickerStyles[0]}">
                ${agent.stickerStyles.map((style, i) => `
                  <button data-action="selectOption" data-param="stickerStyle-${agent.id}" class="px-3 py-3 rounded-ios-lg ${i === 0 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'} text-xs font-medium transition-colors">${style}</button>
                `).join('')}
              </div>
            </div>

            <!-- Pack Size -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-3">Pack Size</label>
              <div id="packSizeSelection-${agent.id}" class="flex gap-2" data-selected="${agent.packSizes[1]}">
                ${agent.packSizes.map((size, i) => `
                  <button data-action="selectOption" data-param="packSize-${agent.id}" class="flex-1 px-3 py-2 rounded-ios ${i === 1 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'} text-sm font-medium transition-colors">${size}</button>
                `).join('')}
              </div>
            </div>

            <!-- Expressions -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-3">Expressions to Include</label>
              <div id="expressionsSelection-${agent.id}" class="flex flex-wrap gap-2" data-selected="${agent.expressions.slice(0, 4).join(',')}">
                ${agent.expressions.map((exp, i) => `
                  <button data-action="toggleMultiSelect" data-param="expressions-${agent.id}" class="px-3 py-1.5 rounded-full ${i < 4 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'} text-xs font-medium transition-colors">${exp}</button>
                `).join('')}
              </div>
              <p class="text-xs text-muted-foreground mt-2">Select the expressions you want in your sticker pack</p>
            </div>
          `;

    case 'product-description-writer':
      return `
            <!-- Product Info -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-3">Product Name</label>
              <input type="text" placeholder="Enter your product name..." class="w-full px-4 py-3 rounded-ios-lg bg-muted border-0 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
            </div>

            <div class="mb-6">
              <label class="block text-sm font-semibold mb-3">Key Features (comma separated)</label>
              <textarea rows="3" placeholder="e.g., waterproof, lightweight, eco-friendly materials..." class="w-full px-4 py-3 rounded-ios-lg bg-muted border-0 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"></textarea>
            </div>

            <!-- Platform -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-3">Target Platform</label>
              <div id="platformSelection-${agent.id}" class="flex flex-wrap gap-2" data-selected="${agent.platforms[0]}">
                ${agent.platforms.map((platform, i) => `
                  <button data-action="selectOption" data-param="platform-${agent.id}" class="px-4 py-2 rounded-full ${i === 0 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'} text-sm font-medium transition-colors">${platform}</button>
                `).join('')}
              </div>
            </div>

            <!-- Tone -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-3">Tone</label>
              <div id="toneSelection-${agent.id}" class="flex flex-wrap gap-2" data-selected="${agent.tones[0]}">
                ${agent.tones.map((tone, i) => `
                  <button data-action="selectOption" data-param="tone-${agent.id}" class="px-4 py-2 rounded-full ${i === 0 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'} text-sm font-medium transition-colors">${tone}</button>
                `).join('')}
              </div>
            </div>

            <!-- Length -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-3">Description Length</label>
              <div id="lengthSelection-${agent.id}" class="flex gap-2" data-selected="${agent.lengths[1]}">
                ${agent.lengths.map((len, i) => `
                  <button data-action="selectOption" data-param="length-${agent.id}" class="flex-1 px-3 py-2 rounded-ios ${i === 1 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'} text-xs font-medium transition-colors">${len}</button>
                `).join('')}
              </div>
            </div>
          `;

    case 'face-swap':
      return `
            <!-- Two-column upload for face swap -->
            <div class="grid grid-cols-2 gap-4 mb-6">
              <!-- Source Face -->
              <div>
                <div class="flex items-center gap-2 mb-2">
                  <svg class="w-5 h-5 text-ios-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-width="1.5" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0"/>
                  </svg>
                  <span class="text-sm font-semibold">Source Face</span>
                </div>
                <p class="text-xs text-muted-foreground mb-2">The face you want to use</p>
                <div id="uploadBox-${agent.id}" class="relative border-2 border-dashed border-border rounded-ios-xl aspect-square overflow-hidden cursor-pointer hover:border-primary/50 transition-colors" data-trigger-file="fileInput-${agent.id}">
                  <input type="file" id="fileInput-${agent.id}" class="hidden" accept="image/*" data-onchange="handleUploadInBox" data-param="${agent.id}">
                  <!-- Placeholder -->
                  <div id="placeholder-${agent.id}" class="absolute inset-0 flex flex-col items-center justify-center p-4">
                    <svg class="w-8 h-8 mb-2 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-width="1.5" d="M12 4v16m8-8H4"/>
                    </svg>
                    <p class="text-xs text-muted-foreground text-center">Upload face photo</p>
                  </div>
                  <!-- Preview (hidden by default) -->
                  <img id="previewImg-${agent.id}" class="absolute inset-0 w-full h-full object-cover hidden" alt="Source Face">
                  <!-- Clear button (hidden by default) -->
                  <button id="clearBtn-${agent.id}" data-action="clearUploadInBox" data-param="${agent.id}" data-stop-propagation class="absolute top-2 right-2 w-6 h-6 bg-ios-red text-white rounded-full items-center justify-center hidden z-10">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
              </div>

              <!-- Target Image -->
              <div>
                <div class="flex items-center gap-2 mb-2">
                  <svg class="w-5 h-5 text-ios-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                  </svg>
                  <span class="text-sm font-semibold">Target Image</span>
                </div>
                <p class="text-xs text-muted-foreground mb-2">Photo to swap face into</p>
                <div id="uploadBox2-${agent.id}" class="relative border-2 border-dashed border-border rounded-ios-xl aspect-square overflow-hidden cursor-pointer hover:border-primary/50 transition-colors" data-trigger-file="fileInput2-${agent.id}">
                  <input type="file" id="fileInput2-${agent.id}" class="hidden" accept="image/*" data-onchange="handleUploadInBox2" data-param="${agent.id}">
                  <!-- Placeholder -->
                  <div id="placeholder2-${agent.id}" class="absolute inset-0 flex flex-col items-center justify-center p-4">
                    <svg class="w-8 h-8 mb-2 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-width="1.5" d="M12 4v16m8-8H4"/>
                    </svg>
                    <p class="text-xs text-muted-foreground text-center">Upload target photo</p>
                  </div>
                  <!-- Preview (hidden by default) -->
                  <img id="previewImg2-${agent.id}" class="absolute inset-0 w-full h-full object-cover hidden" alt="Target Image">
                  <!-- Clear button (hidden by default) -->
                  <button id="clearBtn2-${agent.id}" data-action="clearUploadInBox2" data-param="${agent.id}" data-stop-propagation class="absolute top-2 right-2 w-6 h-6 bg-ios-red text-white rounded-full items-center justify-center hidden z-10">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
              </div>
            </div>

            <!-- Swap Mode -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-3">Swap Mode</label>
              <div id="swapModeSelection-${agent.id}" class="flex gap-2" data-selected="${agent.swapModes[0]}">
                ${agent.swapModes.map((mode, i) => `
                  <button data-action="selectOption" data-param="swapMode-${agent.id}" class="flex-1 px-3 py-2 rounded-ios ${i === 0 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'} text-sm font-medium transition-colors">${mode}</button>
                `).join('')}
              </div>
            </div>

            <!-- Enhancement Options -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-3">Enhancement Options</label>
              <div id="featuresToggle-${agent.id}" class="space-y-2">
                ${agent.enhancementOptions.map((opt, i) => `
                  <label class="flex items-center gap-3 p-3 rounded-ios-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors">
                    <input type="checkbox" id="enhancement-${agent.id}-${i}" data-feature="${opt.toLowerCase().replace(/\s+/g, '_')}" ${i === 0 || i === 2 ? 'checked' : ''} class="w-4 h-4 rounded accent-primary">
                    <span class="text-sm">${opt}</span>
                  </label>
                `).join('')}
              </div>
            </div>
          `;

    case 'video-face-swap':
      return `
            <!-- Two-column upload for video face swap -->
            <div class="grid grid-cols-2 gap-4 mb-6">
              <!-- Source Face (Image) -->
              <div>
                <div class="flex items-center gap-2 mb-2">
                  <svg class="w-5 h-5 text-ios-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-width="1.5" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0"/>
                  </svg>
                  <span class="text-sm font-semibold">Source Face</span>
                </div>
                <p class="text-xs text-muted-foreground mb-2">The face you want to use</p>
                <div id="uploadBox-${agent.id}" class="relative border-2 border-dashed border-border rounded-ios-xl aspect-square overflow-hidden cursor-pointer hover:border-primary/50 transition-colors" data-trigger-file="fileInput-${agent.id}">
                  <input type="file" id="fileInput-${agent.id}" class="hidden" accept="image/*" data-onchange="handleUploadInBox" data-param="${agent.id}">
                  <!-- Placeholder -->
                  <div id="placeholder-${agent.id}" class="absolute inset-0 flex flex-col items-center justify-center p-4">
                    <svg class="w-8 h-8 mb-2 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-width="1.5" d="M12 4v16m8-8H4"/>
                    </svg>
                    <p class="text-xs text-muted-foreground text-center">Upload face photo</p>
                  </div>
                  <!-- Preview (hidden by default) -->
                  <img id="previewImg-${agent.id}" class="absolute inset-0 w-full h-full object-cover hidden" alt="Source Face">
                  <!-- Clear button (hidden by default) -->
                  <button id="clearBtn-${agent.id}" data-action="clearUploadInBox" data-param="${agent.id}" data-stop-propagation class="absolute top-2 right-2 w-6 h-6 bg-ios-red text-white rounded-full items-center justify-center hidden z-10">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
              </div>

              <!-- Target Video -->
              <div>
                <div class="flex items-center gap-2 mb-2">
                  <svg class="w-5 h-5 text-ios-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-width="1.5" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z"/>
                  </svg>
                  <span class="text-sm font-semibold">Target Video</span>
                </div>
                <p class="text-xs text-muted-foreground mb-2">Video to swap face into</p>
                <div id="uploadBox2-${agent.id}" class="relative border-2 border-dashed border-border rounded-ios-xl aspect-square overflow-hidden cursor-pointer hover:border-primary/50 transition-colors" data-trigger-file="fileInput2-${agent.id}">
                  <input type="file" id="fileInput2-${agent.id}" class="hidden" accept="video/*" data-onchange="handleVideoUploadInBox2" data-param="${agent.id}">
                  <!-- Placeholder -->
                  <div id="placeholder2-${agent.id}" class="absolute inset-0 flex flex-col items-center justify-center p-4">
                    <svg class="w-8 h-8 mb-2 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-width="1.5" d="M12 4v16m8-8H4"/>
                    </svg>
                    <p class="text-xs text-muted-foreground text-center">Upload target video</p>
                  </div>
                  <!-- Video Preview (hidden by default) -->
                  <video id="previewVideo2-${agent.id}" class="absolute inset-0 w-full h-full object-cover hidden" autoplay muted loop playsinline></video>
                  <!-- Clear button (hidden by default) -->
                  <button id="clearBtn2-${agent.id}" data-action="clearVideoUploadInBox2" data-param="${agent.id}" data-stop-propagation class="absolute top-2 right-2 w-6 h-6 bg-ios-red text-white rounded-full items-center justify-center hidden z-10">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
              </div>
            </div>

            <!-- Features Pills -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-3">Features</label>
              <div class="flex flex-wrap gap-2">
                <span class="px-3 py-1 bg-secondary text-secondary-foreground text-xs rounded-full">Temporal Consistency</span>
                <span class="px-3 py-1 bg-secondary text-secondary-foreground text-xs rounded-full">Frame Interpolation</span>
                <span class="px-3 py-1 bg-secondary text-secondary-foreground text-xs rounded-full">Quality Preservation</span>
                <span class="px-3 py-1 bg-secondary text-secondary-foreground text-xs rounded-full">Multi-Face Support</span>
              </div>
            </div>
          `;

    case 'ai-model-swap':
      return `
            <!-- Two-column upload for model swap -->
            <div class="grid grid-cols-2 gap-4 mb-6">
              <!-- Original Product Photo -->
              <div>
                <div class="flex items-center gap-2 mb-2">
                  <svg class="w-5 h-5 text-ios-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-width="1.5" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z"/>
                  </svg>
                  <span class="text-sm font-semibold">Product Photo</span>
                </div>
                <p class="text-xs text-muted-foreground mb-2">Original with current model</p>
                <div id="uploadBox-${agent.id}" class="relative border-2 border-dashed border-border rounded-ios-xl aspect-[3/4] overflow-hidden cursor-pointer hover:border-primary/50 transition-colors" data-trigger-file="fileInput-${agent.id}">
                  <input type="file" id="fileInput-${agent.id}" class="hidden" accept="image/*" data-onchange="handleUploadInBox" data-param="${agent.id}">
                  <!-- Placeholder -->
                  <div id="placeholder-${agent.id}" class="absolute inset-0 flex flex-col items-center justify-center p-4">
                    <svg class="w-8 h-8 mb-2 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-width="1.5" d="M12 4v16m8-8H4"/>
                    </svg>
                    <p class="text-xs text-muted-foreground text-center">Upload product photo</p>
                  </div>
                  <!-- Preview (hidden by default) -->
                  <img id="previewImg-${agent.id}" class="absolute inset-0 w-full h-full object-cover hidden" alt="Product Photo">
                  <!-- Clear button (hidden by default) -->
                  <button id="clearBtn-${agent.id}" data-action="clearUploadInBox" data-param="${agent.id}" data-stop-propagation class="absolute top-2 right-2 w-6 h-6 bg-ios-red text-white rounded-full items-center justify-center hidden z-10">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
              </div>

              <!-- New Model Reference -->
              <div>
                <div class="flex items-center gap-2 mb-2">
                  <svg class="w-5 h-5 text-ios-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-width="1.5" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0"/>
                  </svg>
                  <span class="text-sm font-semibold">New Model</span>
                </div>
                <p class="text-xs text-muted-foreground mb-2">Reference for replacement</p>
                <div id="uploadBox2-${agent.id}" class="relative border-2 border-dashed border-border rounded-ios-xl aspect-[3/4] overflow-hidden cursor-pointer hover:border-primary/50 transition-colors" data-trigger-file="fileInput2-${agent.id}">
                  <input type="file" id="fileInput2-${agent.id}" class="hidden" accept="image/*" data-onchange="handleUploadInBox2" data-param="${agent.id}">
                  <!-- Placeholder -->
                  <div id="placeholder2-${agent.id}" class="absolute inset-0 flex flex-col items-center justify-center p-4">
                    <svg class="w-8 h-8 mb-2 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-width="1.5" d="M12 4v16m8-8H4"/>
                    </svg>
                    <p class="text-xs text-muted-foreground text-center">Upload model reference</p>
                  </div>
                  <!-- Preview (hidden by default) -->
                  <img id="previewImg2-${agent.id}" class="absolute inset-0 w-full h-full object-cover hidden" alt="New Model">
                  <!-- Clear button (hidden by default) -->
                  <button id="clearBtn2-${agent.id}" data-action="clearUploadInBox2" data-param="${agent.id}" data-stop-propagation class="absolute top-2 right-2 w-6 h-6 bg-ios-red text-white rounded-full items-center justify-center hidden z-10">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
              </div>
            </div>

            <!-- Model Diversity Options -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-3">Model Preferences</label>
              <div id="modelDiversitySelection-${agent.id}" class="grid grid-cols-3 gap-2" data-selected="${agent.modelDiversity[0]}">
                ${agent.modelDiversity.map((opt, i) => `
                  <button data-action="selectOption" data-param="modelDiversity-${agent.id}" class="px-3 py-2 rounded-ios ${i === 0 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'} text-xs font-medium transition-colors">${opt}</button>
                `).join('')}
              </div>
            </div>

            <!-- Body Type -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-3">Body Type</label>
              <div id="bodyTypeSelection-${agent.id}" class="flex gap-2" data-selected="${agent.bodyTypes[0]}">
                ${agent.bodyTypes.map((type, i) => `
                  <button data-action="selectOption" data-param="bodyType-${agent.id}" class="flex-1 px-2 py-2 rounded-ios ${i === 0 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'} text-xs font-medium transition-colors">${type}</button>
                `).join('')}
              </div>
            </div>

            <!-- Pose Matching -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-3">Pose Matching</label>
              <div id="poseMatchingSelection-${agent.id}" class="flex gap-2" data-selected="${agent.poseMatching[0]}">
                ${agent.poseMatching.map((pose, i) => `
                  <button data-action="selectOption" data-param="poseMatching-${agent.id}" class="flex-1 px-3 py-2 rounded-ios ${i === 0 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'} text-sm font-medium transition-colors">${pose}</button>
                `).join('')}
              </div>
            </div>
          `;

    case 'image-generator':
      return `
            <!-- Prompt Input -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-3">Describe your image</label>
              <textarea
                id="prompt-${agent.id}"
                rows="4"
                placeholder="Describe the image you want to create in detail..."
                class="w-full px-4 py-3 rounded-ios-xl bg-muted border-0 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              ></textarea>
              <div class="flex flex-wrap gap-2 mt-3">
                ${agent.promptSuggestions.map(p => `
                  <button data-action="setPrompt" data-param="${agent.id}" data-param2="${p}" class="px-3 py-1.5 rounded-full bg-secondary/70 hover:bg-secondary text-xs text-secondary-foreground transition-colors">${p.substring(0, 30)}...</button>
                `).join('')}
              </div>
            </div>

            <!-- Model Selection -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-2">AI Model</label>
              <div class="flex items-center gap-3 p-3 rounded-ios-lg bg-muted">
                <span id="modelIcon-${agent.id}" class="text-lg">${getDefaultModelIcon(agent)}</span>
                <select id="modelSelect-${agent.id}" class="flex-1 bg-transparent border-0 text-sm font-medium focus:outline-none cursor-pointer" data-onchange="updateModelIcon" data-param="${agent.id}">
                  ${renderModelSelectOptions(agent)}
                </select>
              </div>
              <p class="text-xs text-muted-foreground mt-2">Model availability depends on your credits and configured API keys.</p>
            </div>

            <!-- Style Selection -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-3">Style</label>
              <div id="styleSelection-${agent.id}" class="flex flex-wrap gap-2" data-selected="${agent.styles[0] || ''}">
                ${agent.styles.map((style, i) => `
                  <button data-action="selectOption" data-param="style-${agent.id}" class="style-btn px-4 py-2 rounded-full ${i === 0 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'} text-sm font-medium transition-colors">${style}</button>
                `).join('')}
              </div>
            </div>

            <!-- Aspect Ratio -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-3">Aspect Ratio</label>
              <div id="ratioSelection-${agent.id}" class="flex gap-2" data-selected="${agent.aspectRatios[0] || ''}">
                ${agent.aspectRatios.map((ratio, i) => `
                  <button data-action="selectOption" data-param="ratio-${agent.id}" class="flex-1 px-3 py-2 rounded-ios ${i === 0 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'} text-sm font-medium transition-colors">${ratio}</button>
                `).join('')}
              </div>
            </div>

            <!-- Number of Images -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-3">Number of Images</label>
              <div id="numImagesSelection-${agent.id}" class="flex gap-2" data-selected="1">
                ${[1, 2, 4].map((n, i) => `
                  <button data-action="selectOption" data-param="numImages-${agent.id}" class="flex-1 px-3 py-2 rounded-ios ${i === 0 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'} text-sm font-medium transition-colors">${n}</button>
                `).join('')}
              </div>
            </div>
          `;

    case 'image-animator':
      return `
            <!-- Upload Image to Animate -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-3">Upload Image to Animate</label>
              <div id="uploadBox-${agent.id}" class="relative border-2 border-dashed border-border rounded-ios-xl aspect-video overflow-hidden cursor-pointer hover:border-primary/50 transition-colors" data-trigger-file="fileInput-${agent.id}">
                <input type="file" id="fileInput-${agent.id}" class="hidden" accept="image/*" data-onchange="handleUploadInBox" data-param="${agent.id}">
                <div id="placeholder-${agent.id}" class="absolute inset-0 flex flex-col items-center justify-center p-4">
                  <svg class="w-12 h-12 mb-3 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                  </svg>
                  <p class="text-sm font-medium">Upload a static image</p>
                  <p class="text-xs text-muted-foreground mt-1">PNG, JPG, WEBP up to 10MB</p>
                </div>
                <img id="previewImg-${agent.id}" class="absolute inset-0 w-full h-full object-cover hidden" alt="Preview">
                <button id="clearBtn-${agent.id}" data-action="clearUploadInBox" data-param="${agent.id}" data-stop-propagation class="absolute top-2 right-2 w-6 h-6 bg-ios-red text-white rounded-full items-center justify-center hidden z-10">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            </div>

            <!-- Motion Type -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-3">Motion Type</label>
              <div id="motionSelection-${agent.id}" class="flex flex-wrap gap-2" data-selected="${agent.motionTypes[0] || ''}">
                ${agent.motionTypes.map((motion, i) => `
                  <button data-action="selectOption" data-param="motion-${agent.id}" class="px-4 py-2 rounded-full ${i === 0 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'} text-sm font-medium transition-colors">${motion}</button>
                `).join('')}
              </div>
            </div>

            <!-- Loop Options -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-3">Loop Style</label>
              <div id="loopSelection-${agent.id}" class="flex gap-2" data-selected="${agent.loopOptions[0] || ''}">
                ${agent.loopOptions.map((opt, i) => `
                  <button data-action="selectOption" data-param="loop-${agent.id}" class="flex-1 px-3 py-2 rounded-ios ${i === 0 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'} text-sm font-medium transition-colors">${opt}</button>
                `).join('')}
              </div>
            </div>

            <!-- Duration -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-3">Duration</label>
              <div id="durationSelection-${agent.id}" class="flex gap-2" data-selected="${agent.durationOptions[1] || ''}">
                ${agent.durationOptions.map((dur, i) => `
                  <button data-action="selectOption" data-param="duration-${agent.id}" class="flex-1 px-3 py-2 rounded-ios ${i === 1 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'} text-sm font-medium transition-colors">${dur}</button>
                `).join('')}
              </div>
            </div>
          `;

    case 'talking-avatar':
      return `
            <!-- Upload Portrait Image -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-3">Upload Portrait Image</label>
              <div id="uploadBox-${agent.id}" class="relative border-2 border-dashed border-border rounded-ios-xl aspect-square overflow-hidden cursor-pointer hover:border-primary/50 transition-colors" data-trigger-file="fileInput-${agent.id}">
                <input type="file" id="fileInput-${agent.id}" class="hidden" accept="image/*" data-onchange="handleUploadInBox" data-param="${agent.id}">
                <div id="placeholder-${agent.id}" class="absolute inset-0 flex flex-col items-center justify-center p-4">
                  <svg class="w-12 h-12 mb-3 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-width="1.5" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0"/>
                  </svg>
                  <p class="text-sm font-medium">Upload a portrait photo</p>
                  <p class="text-xs text-muted-foreground mt-1">Clear face photo with good lighting</p>
                </div>
                <img id="previewImg-${agent.id}" class="absolute inset-0 w-full h-full object-cover hidden" alt="Portrait">
                <button id="clearBtn-${agent.id}" data-action="clearUploadInBox" data-param="${agent.id}" data-stop-propagation class="absolute top-2 right-2 w-6 h-6 bg-ios-red text-white rounded-full items-center justify-center hidden z-10">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            </div>

            <!-- Text to Speak -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-3">Text to Speak</label>
              <textarea id="text-${agent.id}" rows="4" placeholder="Enter the text you want the avatar to speak..." class="w-full px-4 py-3 rounded-ios-lg bg-muted border-0 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"></textarea>
            </div>

            <!-- Avatar Style -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-3">Avatar Style</label>
              <div id="avatarStyleSelection-${agent.id}" class="flex flex-wrap gap-2" data-selected="${agent.avatarStyles[0] || ''}">
                ${agent.avatarStyles.map((style, i) => `
                  <button data-action="selectOption" data-param="avatarStyle-${agent.id}" class="px-4 py-2 rounded-full ${i === 0 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'} text-sm font-medium transition-colors">${style}</button>
                `).join('')}
              </div>
            </div>

            <!-- Expression -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-3">Expression</label>
              <div id="expressionSelection-${agent.id}" class="flex flex-wrap gap-2" data-selected="${agent.expressions[0] || ''}">
                ${agent.expressions.map((exp, i) => `
                  <button data-action="selectOption" data-param="expression-${agent.id}" class="px-4 py-2 rounded-full ${i === 0 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'} text-sm font-medium transition-colors">${exp}</button>
                `).join('')}
              </div>
            </div>

            <!-- Background -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-3">Background</label>
              <div id="backgroundSelection-${agent.id}" class="flex gap-2" data-selected="${agent.backgrounds[0] || ''}">
                ${agent.backgrounds.map((bg, i) => `
                  <button data-action="selectOption" data-param="background-${agent.id}" class="flex-1 px-3 py-2 rounded-ios ${i === 0 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'} text-xs font-medium transition-colors">${bg}</button>
                `).join('')}
              </div>
            </div>
          `;

    case 'video-upscaler':
      return `
            <!-- Upload Video -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-3">Upload Video to Upscale</label>
              <div class="border-2 border-dashed border-border rounded-ios-xl p-8 text-center hover:border-primary/50 transition-all cursor-pointer" data-trigger-file="fileInput-${agent.id}">
                <input type="file" id="fileInput-${agent.id}" class="hidden" accept="video/*" data-onchange="handleFileUpload" data-param="${agent.id}">
                <svg class="w-12 h-12 mx-auto mb-3 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-width="1.5" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z"/>
                </svg>
                <p class="text-sm font-medium">Upload video file</p>
                <p class="text-xs text-muted-foreground mt-1">MP4, MOV up to 100MB</p>
              </div>
              <div id="preview-${agent.id}" class="mt-4 hidden">
                <div class="relative inline-block">
                  <video id="previewVideo-${agent.id}" class="max-h-48 rounded-ios-lg" controls></video>
                  <button data-action="clearUpload" data-param="${agent.id}" class="absolute -top-2 -right-2 w-6 h-6 bg-ios-red text-white rounded-full flex items-center justify-center">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
              </div>
            </div>

            <!-- Target Resolution -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-3">Target Resolution</label>
              <div id="resolutionSelection-${agent.id}" class="flex gap-2" data-selected="${agent.targetResolutions[2] || ''}">
                ${agent.targetResolutions.map((res, i) => `
                  <button data-action="selectOption" data-param="resolution-${agent.id}" class="flex-1 px-3 py-2 rounded-ios ${i === 2 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'} text-sm font-medium transition-colors">${res}</button>
                `).join('')}
              </div>
            </div>

            <!-- Frame Rate -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-3">Frame Rate</label>
              <div id="frameRateSelection-${agent.id}" class="flex gap-2" data-selected="${agent.frameRates[0] || ''}">
                ${agent.frameRates.map((rate, i) => `
                  <button data-action="selectOption" data-param="frameRate-${agent.id}" class="flex-1 px-3 py-2 rounded-ios ${i === 0 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'} text-sm font-medium transition-colors">${rate}</button>
                `).join('')}
              </div>
            </div>

            <!-- Stabilization -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-3">Stabilization</label>
              <div id="stabSelection-${agent.id}" class="flex gap-2" data-selected="${agent.stabilization[2] || ''}">
                ${agent.stabilization.map((stab, i) => `
                  <button data-action="selectOption" data-param="stab-${agent.id}" class="flex-1 px-3 py-2 rounded-ios ${i === 2 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'} text-xs font-medium transition-colors">${stab}</button>
                `).join('')}
              </div>
            </div>
          `;

    case 'background-remover':
      return `
            <!-- Upload Image -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-3">Upload Image</label>
              <div id="uploadBox-${agent.id}" class="relative border-2 border-dashed border-border rounded-ios-xl aspect-video overflow-hidden cursor-pointer hover:border-primary/50 transition-colors" data-trigger-file="fileInput-${agent.id}">
                <input type="file" id="fileInput-${agent.id}" class="hidden" accept="image/*" data-onchange="handleUploadInBox" data-param="${agent.id}">
                <div id="placeholder-${agent.id}" class="absolute inset-0 flex flex-col items-center justify-center p-4">
                  <svg class="w-12 h-12 mb-3 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                  </svg>
                  <p class="text-sm font-medium">Upload image</p>
                  <p class="text-xs text-muted-foreground mt-1">PNG, JPG, WEBP up to 10MB</p>
                </div>
                <img id="previewImg-${agent.id}" class="absolute inset-0 w-full h-full object-cover hidden" alt="Preview">
                <button id="clearBtn-${agent.id}" data-action="clearUploadInBox" data-param="${agent.id}" data-stop-propagation class="absolute top-2 right-2 w-6 h-6 bg-ios-red text-white rounded-full items-center justify-center hidden z-10">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            </div>

            <!-- Output Format -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-3">Output Format</label>
              <div id="formatSelection-${agent.id}" class="flex gap-2" data-selected="PNG (Transparent)">
                <button data-action="selectOption" data-param="format-${agent.id}" class="flex-1 px-3 py-2 rounded-ios bg-primary text-primary-foreground text-sm font-medium">PNG (Transparent)</button>
                <button data-action="selectOption" data-param="format-${agent.id}" class="flex-1 px-3 py-2 rounded-ios bg-secondary text-secondary-foreground hover:bg-secondary/80 text-sm font-medium transition-colors">JPG (White BG)</button>
              </div>
            </div>

            <!-- Model Selection -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-2">AI Model</label>
              <div class="flex items-center gap-3 p-3 rounded-ios-lg bg-muted">
                <span id="modelIcon-${agent.id}" class="text-lg">${getDefaultModelIcon(agent)}</span>
                <select id="modelSelect-${agent.id}" class="flex-1 bg-transparent border-0 text-sm font-medium focus:outline-none cursor-pointer" data-onchange="updateModelIcon" data-param="${agent.id}">
                  ${renderModelSelectOptions(agent)}
                </select>
              </div>
              <p class="text-xs text-muted-foreground mt-2">Model availability depends on your credits and configured API keys.</p>
            </div>
          `;

    case 'portrait-enhancer':
      return `
            <!-- Upload Portrait -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-3">Upload Portrait</label>
              <div id="uploadBox-${agent.id}" class="relative border-2 border-dashed border-border rounded-ios-xl aspect-square overflow-hidden cursor-pointer hover:border-primary/50 transition-colors" data-trigger-file="fileInput-${agent.id}">
                <input type="file" id="fileInput-${agent.id}" class="hidden" accept="image/*" data-onchange="handleUploadInBox" data-param="${agent.id}">
                <div id="placeholder-${agent.id}" class="absolute inset-0 flex flex-col items-center justify-center p-4">
                  <svg class="w-12 h-12 mb-3 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-width="1.5" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0"/>
                  </svg>
                  <p class="text-sm font-medium">Upload portrait photo</p>
                  <p class="text-xs text-muted-foreground mt-1">Face should be clearly visible</p>
                </div>
                <img id="previewImg-${agent.id}" class="absolute inset-0 w-full h-full object-cover hidden" alt="Portrait">
                <button id="clearBtn-${agent.id}" data-action="clearUploadInBox" data-param="${agent.id}" data-stop-propagation class="absolute top-2 right-2 w-6 h-6 bg-ios-red text-white rounded-full items-center justify-center hidden z-10">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            </div>

            <!-- Enhancement Level -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-3">Enhancement Level</label>
              <div id="enhancementSelection-${agent.id}" class="flex gap-2" data-selected="${agent.enhancementLevel[1] || ''}">
                ${agent.enhancementLevel.map((level, i) => `
                  <button data-action="selectOption" data-param="enhancement-${agent.id}" class="flex-1 px-3 py-2 rounded-ios ${i === 1 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'} text-sm font-medium transition-colors">${level}</button>
                `).join('')}
              </div>
            </div>

            <!-- Features Toggle -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-3">Enhancement Features</label>
              <div id="featuresToggle-${agent.id}" class="space-y-2">
                ${agent.features_toggle.map((feat, i) => `
                  <label class="flex items-center gap-3 p-3 rounded-ios-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors">
                    <input type="checkbox" id="feature-${agent.id}-${i}" data-feature="${feat.toLowerCase().replace(/\s+/g, '_')}" checked class="w-4 h-4 rounded accent-primary">
                    <span class="text-sm">${feat}</span>
                  </label>
                `).join('')}
              </div>
            </div>

            <!-- Model Selection -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-2">AI Model</label>
              <div class="flex items-center gap-3 p-3 rounded-ios-lg bg-muted">
                <span id="modelIcon-${agent.id}" class="text-lg">${getDefaultModelIcon(agent)}</span>
                <select id="modelSelect-${agent.id}" class="flex-1 bg-transparent border-0 text-sm font-medium focus:outline-none cursor-pointer" data-onchange="updateModelIcon" data-param="${agent.id}">
                  ${renderModelSelectOptions(agent)}
                </select>
              </div>
              <p class="text-xs text-muted-foreground mt-2">Model availability depends on your credits and configured API keys.</p>
            </div>
          `;

    case 'style-transfer':
      return `
            <!-- Upload Image -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-3">Upload Image</label>
              <div id="uploadBox-${agent.id}" class="relative border-2 border-dashed border-border rounded-ios-xl aspect-video overflow-hidden cursor-pointer hover:border-primary/50 transition-colors" data-trigger-file="fileInput-${agent.id}">
                <input type="file" id="fileInput-${agent.id}" class="hidden" accept="image/*" data-onchange="handleUploadInBox" data-param="${agent.id}">
                <div id="placeholder-${agent.id}" class="absolute inset-0 flex flex-col items-center justify-center p-4">
                  <svg class="w-12 h-12 mb-3 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                  </svg>
                  <p class="text-sm font-medium">Upload your photo</p>
                  <p class="text-xs text-muted-foreground mt-1">PNG, JPG, WEBP up to 10MB</p>
                </div>
                <img id="previewImg-${agent.id}" class="absolute inset-0 w-full h-full object-cover hidden" alt="Preview">
                <button id="clearBtn-${agent.id}" data-action="clearUploadInBox" data-param="${agent.id}" data-stop-propagation class="absolute top-2 right-2 w-6 h-6 bg-ios-red text-white rounded-full items-center justify-center hidden z-10">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            </div>

            <!-- Popular Styles -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-3">Popular Styles</label>
              <div id="popularStyleSelection-${agent.id}" class="flex flex-wrap gap-2" data-selected="${agent.popularStyles[0]}">
                ${agent.popularStyles.map((style, i) => `
                  <button data-action="selectOption" data-param="popularStyle-${agent.id}" class="px-4 py-2 rounded-full ${i === 0 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'} text-sm font-medium transition-colors">${style}</button>
                `).join('')}
              </div>
            </div>

            <!-- Style Category -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-3">Style Category</label>
              <div id="styleCategorySelection-${agent.id}" class="flex flex-wrap gap-2" data-selected="${agent.styleCategories[2]}">
                ${agent.styleCategories.map((cat, i) => `
                  <button data-action="selectOption" data-param="styleCategory-${agent.id}" class="px-4 py-2 rounded-full ${i === 2 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'} text-sm font-medium transition-colors">${cat}</button>
                `).join('')}
              </div>
            </div>

            <!-- Intensity -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-3">Style Intensity</label>
              <div id="intensitySelection-${agent.id}" class="flex gap-2" data-selected="${agent.intensity[1]}">
                ${agent.intensity.map((int, i) => `
                  <button data-action="selectOption" data-param="intensity-${agent.id}" class="flex-1 px-3 py-2 rounded-ios ${i === 1 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'} text-sm font-medium transition-colors">${int}</button>
                `).join('')}
              </div>
            </div>

            <!-- Model Selection -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-2">AI Model</label>
              <div class="flex items-center gap-3 p-3 rounded-ios-lg bg-muted">
                <span id="modelIcon-${agent.id}" class="text-lg">${getDefaultModelIcon(agent)}</span>
                <select id="modelSelect-${agent.id}" class="flex-1 bg-transparent border-0 text-sm font-medium focus:outline-none cursor-pointer" data-onchange="updateModelIcon" data-param="${agent.id}">
                  ${renderModelSelectOptions(agent)}
                </select>
              </div>
              <p class="text-xs text-muted-foreground mt-2">Model availability depends on your credits and configured API keys.</p>
            </div>
          `;

    case 'image-upscaler':
      return `
            <!-- Upload Image -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-3">Upload Image</label>
              <div id="uploadBox-${agent.id}" class="relative border-2 border-dashed border-border rounded-ios-xl aspect-video overflow-hidden cursor-pointer hover:border-primary/50 transition-colors" data-trigger-file="fileInput-${agent.id}">
                <input type="file" id="fileInput-${agent.id}" class="hidden" accept="image/*" data-onchange="handleUploadInBox" data-param="${agent.id}">
                <div id="placeholder-${agent.id}" class="absolute inset-0 flex flex-col items-center justify-center p-4">
                  <svg class="w-12 h-12 mb-3 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                  </svg>
                  <p class="text-sm font-medium">Upload image to upscale</p>
                  <p class="text-xs text-muted-foreground mt-1">PNG, JPG, WEBP</p>
                </div>
                <img id="previewImg-${agent.id}" class="absolute inset-0 w-full h-full object-cover hidden" alt="Preview">
                <button id="clearBtn-${agent.id}" data-action="clearUploadInBox" data-param="${agent.id}" data-stop-propagation class="absolute top-2 right-2 w-6 h-6 bg-ios-red text-white rounded-full items-center justify-center hidden z-10">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            </div>

            <!-- Scale -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-3">Scale</label>
              <div id="scaleSelection-${agent.id}" class="flex gap-2" data-selected="${agent.scaleOptions[1]}">
                ${agent.scaleOptions.map((scale, i) => `
                  <button data-action="selectOption" data-param="scale-${agent.id}" class="flex-1 px-3 py-2 rounded-ios ${i === 1 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'} text-sm font-medium transition-colors">${scale}</button>
                `).join('')}
              </div>
            </div>

            <!-- Enhancement Type -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-3">Enhancement Type</label>
              <div id="enhancementTypeSelection-${agent.id}" class="flex flex-wrap gap-2" data-selected="${agent.enhancementTypes[0]}">
                ${agent.enhancementTypes.map((type, i) => `
                  <button data-action="selectOption" data-param="enhancementType-${agent.id}" class="px-4 py-2 rounded-full ${i === 0 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'} text-sm font-medium transition-colors">${type}</button>
                `).join('')}
              </div>
            </div>

            <!-- Noise Reduction -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-3">Noise Reduction</label>
              <div id="noiseReductionSelection-${agent.id}" class="flex gap-2" data-selected="${agent.noiseReduction[1]}">
                ${agent.noiseReduction.map((level, i) => `
                  <button data-action="selectOption" data-param="noiseReduction-${agent.id}" class="flex-1 px-3 py-2 rounded-ios ${i === 1 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'} text-xs font-medium transition-colors">${level}</button>
                `).join('')}
              </div>
            </div>

            <!-- Model Selection -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-2">AI Model</label>
              <div class="flex items-center gap-3 p-3 rounded-ios-lg bg-muted">
                <span id="modelIcon-${agent.id}" class="text-lg">${getDefaultModelIcon(agent)}</span>
                <select id="modelSelect-${agent.id}" class="flex-1 bg-transparent border-0 text-sm font-medium focus:outline-none cursor-pointer" data-onchange="updateModelIcon" data-param="${agent.id}">
                  ${renderModelSelectOptions(agent)}
                </select>
              </div>
              <p class="text-xs text-muted-foreground mt-2">Model availability depends on your credits and configured API keys.</p>
            </div>
          `;

    case 'object-remover':
      return `
            <!-- Upload Image -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-3">Upload Image</label>
              <div class="border-2 border-dashed border-border rounded-ios-xl p-8 text-center hover:border-primary/50 hover:bg-muted/30 transition-all cursor-pointer" data-trigger-file="fileInput-${agent.id}">
                <input type="file" id="fileInput-${agent.id}" class="hidden" accept="image/png,image/jpeg,image/webp,image/heic,image/heif,image/gif,image/*" data-onchange="handleFileUpload" data-param="${agent.id}">
                <svg class="w-12 h-12 mx-auto mb-3 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
                <p class="text-sm font-medium">Click to upload or drag and drop</p>
                <p class="text-xs text-muted-foreground">PNG, JPG, WEBP, HEIC, GIF up to 10MB</p>
              </div>
              <div id="preview-${agent.id}" class="mt-4 hidden">
                <div class="relative inline-block">
                  <img id="previewImg-${agent.id}" class="max-h-48 rounded-ios-lg object-contain" alt="Preview">
                  <button data-action="clearUpload" data-param="${agent.id}" class="absolute -top-2 -right-2 w-6 h-6 bg-ios-red text-white rounded-full flex items-center justify-center">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
              </div>
            </div>

            <!-- What to Remove (Required Prompt) -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-2">What do you want to remove?</label>
              <textarea
                id="prompt-${agent.id}"
                rows="2"
                placeholder="e.g., the person in the background, the watermark, the text on the left"
                class="w-full px-4 py-3 rounded-ios-lg bg-muted border-0 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              ></textarea>
              <p class="text-xs text-muted-foreground mt-2">Describe what you want to remove from the image. Be specific for best results.</p>
            </div>

            <!-- Model Selection -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-2">AI Model</label>
              <div class="flex items-center gap-3 p-3 rounded-ios-lg bg-muted">
                <span id="modelIcon-${agent.id}" class="text-lg">${getDefaultModelIcon(agent)}</span>
                <select id="modelSelect-${agent.id}" class="flex-1 bg-transparent border-0 text-sm font-medium focus:outline-none cursor-pointer" data-onchange="updateModelIcon" data-param="${agent.id}">
                  ${renderModelSelectOptions(agent)}
                </select>
              </div>
              <p class="text-xs text-muted-foreground mt-2">Model availability depends on your credits and configured API keys.</p>
            </div>

            <!-- Optional Mask Upload (Advanced) -->
            <details class="mb-6">
              <summary class="text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/>
                </svg>
                Advanced: Upload custom mask
              </summary>
              <div class="mt-3 p-4 rounded-ios-lg bg-muted/30 border border-border/50">
                <p class="text-xs text-muted-foreground mb-3">Upload a black/white mask image where white areas will be removed. If not provided, AI will detect the object from your description.</p>
                <div class="border-2 border-dashed border-border rounded-ios-lg p-4 text-center hover:border-primary/50 cursor-pointer" data-trigger-file="fileInput2-${agent.id}">
                  <input type="file" id="fileInput2-${agent.id}" class="hidden" accept="image/*" data-onchange="handleFileUpload2" data-param="${agent.id}">
                  <svg class="w-8 h-8 mx-auto mb-2 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14"/>
                  </svg>
                  <p class="text-xs text-muted-foreground">Upload mask image (optional)</p>
                </div>
                <div id="preview2-${agent.id}" class="mt-3 hidden">
                  <div class="relative inline-block">
                    <img id="previewImg2-${agent.id}" class="max-h-32 rounded-ios-lg object-contain" alt="Mask Preview">
                    <button data-action="clearUpload2" data-param="${agent.id}" class="absolute -top-2 -right-2 w-5 h-5 bg-ios-red text-white rounded-full flex items-center justify-center">
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            </details>

            <!-- Features display -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-3">Features</label>
              <div class="flex flex-wrap gap-2">
                ${agent.features?.map(f => `<span class="px-3 py-1 rounded-full bg-muted text-xs">${f}</span>`).join('') || ''}
              </div>
            </div>
          `;

    case 'sand-worm':
      return `
            <!-- Upload Image -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-3">Upload Image</label>
              <div class="border-2 border-dashed border-border rounded-ios-xl p-8 text-center hover:border-primary/50 hover:bg-muted/30 transition-all cursor-pointer" data-trigger-file="fileInput-${agent.id}">
                <input type="file" id="fileInput-${agent.id}" class="hidden" accept="image/png,image/jpeg,image/webp,image/heic,image/heif,image/gif,image/*" data-onchange="handleFileUpload" data-param="${agent.id}">
                <svg class="w-12 h-12 mx-auto mb-3 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
                <p class="text-sm font-medium">Click to upload or drag and drop</p>
                <p class="text-xs text-muted-foreground">PNG, JPG, WEBP, HEIC, GIF up to 10MB</p>
              </div>
              <div id="preview-${agent.id}" class="mt-4 hidden">
                <div class="relative inline-block">
                  <img id="previewImg-${agent.id}" class="max-h-48 rounded-ios-xl object-contain border border-border" alt="Preview">
                  <button data-action="clearUpload" data-param="${agent.id}" class="absolute -top-2 -right-2 w-6 h-6 bg-ios-red text-white rounded-full flex items-center justify-center shadow-lg hover:bg-ios-red/90 transition-colors">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
              </div>
            </div>

            <!-- Prompt Section -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-2">Describe the Scene</label>
              <textarea id="prompt-${agent.id}" rows="3" placeholder="Describe how you want to appear with the sand worm..." class="w-full px-4 py-3 rounded-ios-lg bg-muted border-0 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"></textarea>
              <div class="flex flex-wrap gap-2 mt-3">
                ${agent.promptSuggestions?.map(p => `
                  <button data-action="setPrompt" data-param="${agent.id}" data-param2="${p.replace(/'/g, "\\'")}" class="px-3 py-1.5 rounded-full bg-secondary/70 hover:bg-secondary text-xs text-secondary-foreground transition-colors">${p}</button>
                `).join('') || ''}
              </div>
            </div>

            <!-- Model Selection -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-2">Model</label>
              <div class="flex items-center gap-3 p-3 rounded-ios-lg bg-muted">
                <span id="modelIcon-${agent.id}" class="text-lg">${agent.models?.[0]?.icon || '🎬'}</span>
                <select id="modelSelect-${agent.id}" class="flex-1 bg-transparent border-0 text-sm font-medium focus:outline-none" data-onchange="updateModelIcon" data-param="${agent.id}">
                  ${agent.models?.map((m, i) => `<option value="${m.id || m.name}" ${i === 0 ? 'selected' : ''}>${m.icon} ${m.name}</option>`).join('') || ''}
                </select>
              </div>
            </div>

            <!-- Duration Selection -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-2">Duration</label>
              <select id="durationSelect-${agent.id}" class="w-full px-3 py-2 rounded-ios bg-muted border-0 text-sm">
                ${agent.durations?.map((d, i) => `<option value="${d}" ${i === 0 ? 'selected' : ''}>${d}</option>`).join('') || '<option value="5s">5s</option><option value="10s">10s</option>'}
              </select>
            </div>

            <!-- Features display -->
            <div class="mb-6">
              <label class="block text-sm font-semibold mb-3">Features</label>
              <div class="flex flex-wrap gap-2">
                ${agent.features?.map(f => `<span class="px-3 py-1 rounded-full bg-muted text-xs">${f}</span>`).join('') || ''}
              </div>
            </div>
          `;

    default:
      return getDefaultAgentUI(agent);
  }
}

// Default UI for agents without specific templates
function getDefaultAgentUI(agent) {
  // Use inputTypes from API for accurate detection, fallback to modalities, then categoryKey
  const inputTypes = agent.inputTypes || [];
  const modalities = agent.modalities || [];

  // Check if agent accepts image input
  const needsImageUpload = inputTypes.some(t => t.startsWith('image/')) ||
    modalities.includes('image') ||
    ['image', 'creative', 'ecommerce', 'commerce-websites', 'marketing-social'].some(c => agent.categoryKey?.includes(c));

  // Check if agent accepts video input
  const needsVideoUpload = inputTypes.some(t => t.startsWith('video/')) ||
    modalities.includes('video') ||
    agent.categoryKey === 'video';

  // Check if agent accepts audio input
  const isAudio = inputTypes.some(t => t.startsWith('audio/')) ||
    modalities.includes('audio') ||
    agent.categoryKey === 'audio' ||
    agent.categoryKey === 'audio-voice';

  const isText = agent.categoryKey === 'productivity';

  let ui = '';

  // Upload section - show for both image and video agents
  if (needsImageUpload || needsVideoUpload) {
    const isVideoMode = needsVideoUpload && !needsImageUpload;
    const acceptTypes = isVideoMode
      ? 'video/mp4,video/quicktime,video/webm,video/*'
      : 'image/png,image/jpeg,image/webp,image/heic,image/heif,image/gif,image/*';
    const uploadLabel = isVideoMode ? 'Upload Video' : 'Upload Image';
    const formatHint = isVideoMode ? 'MP4, MOV, WEBM up to 100MB' : 'PNG, JPG, WEBP, HEIC, GIF up to 10MB';

    ui += `
          <div class="mb-6">
            <label class="block text-sm font-semibold mb-3">${uploadLabel}</label>
            <div class="border-2 border-dashed border-border rounded-ios-xl p-8 text-center hover:border-primary/50 hover:bg-muted/30 transition-all cursor-pointer" data-trigger-file="fileInput-${agent.id}">
              <input type="file" id="fileInput-${agent.id}" class="hidden" accept="${acceptTypes}" data-onchange="handleFileUpload" data-param="${agent.id}">
              <svg class="w-12 h-12 mx-auto mb-3 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
              <p class="text-sm font-medium">Click to upload or drag and drop</p>
              <p class="text-xs text-muted-foreground">${formatHint}</p>
            </div>
            <div id="preview-${agent.id}" class="mt-4 hidden">
              <div class="relative inline-block">
                ${isVideoMode
        ? `<video id="previewVideo-${agent.id}" class="max-h-48 rounded-ios-lg object-contain" controls></video>`
        : `<img id="previewImg-${agent.id}" class="max-h-48 rounded-ios-lg object-contain" alt="Preview">`
      }
                <button data-action="clearUpload" data-param="${agent.id}" class="absolute -top-2 -right-2 w-6 h-6 bg-ios-red text-white rounded-full flex items-center justify-center">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            </div>
          </div>
        `;
  }

  // Second image for face-swap type agents
  if (agent.id === 'face-swap' || agent.id === 'ai-model-swap') {
    ui += `
          <div class="mb-6">
            <label class="block text-sm font-semibold mb-3">${agent.id === 'face-swap' ? 'Target Face Image' : 'Target Model Image'}</label>
            <div class="border-2 border-dashed border-border rounded-ios-xl p-6 text-center hover:border-primary/50 cursor-pointer" data-trigger-file="fileInput2-${agent.id}">
              <input type="file" id="fileInput2-${agent.id}" class="hidden" accept="image/*" data-onchange="handleFileUpload2" data-param="${agent.id}">
              <svg class="w-8 h-8 mx-auto mb-2 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="1.5" d="M12 4v16m8-8H4"/></svg>
              <p class="text-xs text-muted-foreground">Add second image</p>
            </div>
          </div>
        `;
  }

  // Options from agent config
  if (agent.swapModes) {
    ui += `
          <div class="mb-6">
            <label class="block text-sm font-semibold mb-3">Swap Mode</label>
            <div id="swapModeSelection-${agent.id}" class="flex gap-2" data-selected="${agent.swapModes[0]}">
              ${agent.swapModes.map((mode, i) => `
                <button data-action="selectOption" data-param="swapMode-${agent.id}" class="flex-1 px-3 py-2 rounded-ios ${i === 0 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'} text-sm font-medium transition-colors">${mode}</button>
              `).join('')}
            </div>
          </div>
        `;
  }

  if (agent.scaleOptions) {
    ui += `
          <div class="mb-6">
            <label class="block text-sm font-semibold mb-3">Scale</label>
            <div id="scaleSelection-${agent.id}" class="flex gap-2" data-selected="${agent.scaleOptions[1]}">
              ${agent.scaleOptions.map((scale, i) => `
                <button data-action="selectOption" data-param="scale-${agent.id}" class="flex-1 px-3 py-2 rounded-ios ${i === 1 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'} text-sm font-medium transition-colors">${scale}</button>
              `).join('')}
            </div>
          </div>
        `;
  }

  if (agent.motionTypes) {
    ui += `
          <div class="mb-6">
            <label class="block text-sm font-semibold mb-3">Motion Type</label>
            <div id="motionTypeSelection-${agent.id}" class="flex flex-wrap gap-2" data-selected="${agent.motionTypes[0]}">
              ${agent.motionTypes.map((motion, i) => `
                <button data-action="selectOption" data-param="motionType-${agent.id}" class="px-4 py-2 rounded-full ${i === 0 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'} text-sm font-medium transition-colors">${motion}</button>
              `).join('')}
            </div>
          </div>
        `;
  }

  if (agent.styleCategories || agent.popularStyles) {
    const styles = agent.popularStyles || agent.styleCategories;
    ui += `
          <div class="mb-6">
            <label class="block text-sm font-semibold mb-3">Style</label>
            <div id="defaultStyleSelection-${agent.id}" class="flex flex-wrap gap-2" data-selected="${styles[0]}">
              ${styles.map((style, i) => `
                <button data-action="selectOption" data-param="defaultStyle-${agent.id}" class="px-4 py-2 rounded-full ${i === 0 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'} text-sm font-medium transition-colors">${style}</button>
              `).join('')}
            </div>
          </div>
        `;
  }

  // Features display
  if (agent.features && agent.features.length > 0) {
    ui += `
          <div class="mb-6">
            <label class="block text-sm font-semibold mb-3">Features</label>
            <div class="flex flex-wrap gap-2">
              ${agent.features.map(f => `<span class="px-3 py-1 rounded-full bg-muted text-xs">${f}</span>`).join('')}
            </div>
          </div>
        `;
  }

  return ui;
}

// File upload handlers
async function handleFileUpload(event, agentId) {
  let file = event.target.files[0];
  if (!file) return;

  const previewContainer = document.getElementById(`preview-${agentId}`);
  const previewImg = document.getElementById(`previewImg-${agentId}`);
  const previewVideo = document.getElementById(`previewVideo-${agentId}`);

  // Handle video files
  if (file.type.startsWith('video/')) {
    if (file.size > LEGACY_MAX_VIDEO_UPLOAD_BYTES) {
      legacyNotify(
        `Video is too large (${legacyFormatBytes(file.size)}). Max upload is ${legacyFormatBytes(LEGACY_MAX_VIDEO_UPLOAD_BYTES)}.`,
        'error'
      );
      try { event.target.value = ''; } catch { }
      return;
    }

    if (previewImg) previewImg.classList.add('hidden');
    if (previewVideo) {
      previewVideo.classList.remove('hidden');
      legacyClearMediaState(previewVideo);
      const objectUrl = URL.createObjectURL(file);
      previewVideo.dataset.objectUrl = objectUrl;
      previewVideo.src = objectUrl;
    }
    if (previewContainer) previewContainer.classList.remove('hidden');

    // Always upload video to CDN
    try {
      const uploadPromise = legacyTrackPendingUpload(
        agentId,
        'file',
        legacyUploadFileToServer(file, { filename: file.name })
      );
      const uploadedUrl = await uploadPromise;
      if (previewVideo) previewVideo.dataset.uploadedUrl = uploadedUrl;
    } catch (err) {
      legacyNotify(err?.message ? String(err.message) : 'Video upload failed', 'error');
      clearUpload(agentId);
      return;
    }
    return;
  }

  // Handle HEIC/HEIF conversion
  if (file.type === 'image/heic' || file.type === 'image/heif' || file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
    try {
      // Show loading state
      if (previewImg) previewImg.alt = 'Converting HEIC...';
      previewContainer.classList.remove('hidden');

      // Load heic2any dynamically if not loaded
      if (typeof heic2any === 'undefined') {
        await import(/* @vite-ignore */ '/aitopia/marketplace/js/vendor/heic2any.esm.js')
          .then(function(m){ if (m && m.default && typeof window !== "undefined" && !window.heic2any) window.heic2any = m.default; })
          .catch(function(){ throw new Error('Failed to load heic2any'); });
      }

      // Convert HEIC to PNG
      const convertedBlob = await heic2any({
        blob: file,
        toType: 'image/png',
        quality: 0.92
      });

      file = new File([convertedBlob], file.name.replace(/\.heic$/i, '.png'), { type: 'image/png' });
    } catch (err) {
      console.error('HEIC conversion failed:', err);
      showNotification('HEIC conversion failed. Please use PNG or JPG.', 'error');
      return;
    }
  }

  // Handle regular image files - Always upload to CDN
  if (previewImg) {
    legacyClearMediaState(previewImg);
    const objectUrl = URL.createObjectURL(file);
    previewImg.dataset.objectUrl = objectUrl;
    previewImg.src = objectUrl;
    previewImg.classList.remove('hidden');
  }
  if (previewVideo) {
    legacyClearMediaState(previewVideo);
    previewVideo.classList.add('hidden');
  }
  previewContainer.classList.remove('hidden');

  try {
    const uploadPromise = legacyTrackPendingUpload(
      agentId,
      'file',
      legacyUploadFileToServer(file, { filename: file.name })
    );
    const uploadedUrl = await uploadPromise;
    if (previewImg) previewImg.dataset.uploadedUrl = uploadedUrl;
  } catch (err) {
    legacyNotify(err?.message ? String(err.message) : 'Image upload failed', 'error');
    clearUpload(agentId);
  }
}

async function handleFileUpload2(event, agentId) {
  const file = event.target.files[0];
  if (file) {
    // Immediate preview
    const img = document.getElementById(`previewImg2-${agentId}`);
    const container = document.getElementById(`preview2-${agentId}`);

    legacyClearMediaState(img);
    const objectUrl = URL.createObjectURL(file);
    img.dataset.objectUrl = objectUrl;
    img.src = objectUrl;
    container.classList.remove('hidden');

    // Upload
    try {
      const uploadPromise = legacyTrackPendingUpload(
        agentId,
        'file2',
        legacyUploadFileToServer(file, { filename: file.name })
      );
      const uploadedUrl = await uploadPromise;
      if (img) img.dataset.uploadedUrl = uploadedUrl;
    } catch (err) {
      legacyNotify(err?.message ? String(err.message) : 'Upload failed', 'error');
      container.classList.add('hidden');
    }
  }
}

function clearUpload(agentId) {
  const fileInput = document.getElementById(`fileInput-${agentId}`);
  const preview = document.getElementById(`preview-${agentId}`);
  const previewImg = document.getElementById(`previewImg-${agentId}`);
  const previewVideo = document.getElementById(`previewVideo-${agentId}`);
  if (fileInput) fileInput.value = '';
  if (preview) preview.classList.add('hidden');
  if (previewImg) {
    legacyClearMediaState(previewImg);
    previewImg.src = '';
  }
  if (previewVideo) {
    legacyClearMediaState(previewVideo);
    previewVideo.src = '';
    previewVideo.classList.add('hidden');
  }
}

function clearUpload2(agentId) {
  const fileInput2 = document.getElementById(`fileInput2-${agentId}`);
  if (fileInput2) fileInput2.value = '';
  document.getElementById(`preview2-${agentId}`)?.classList.add('hidden');
}

// ============================================
// LIP-SYNC AUDIO MODE HANDLERS
// ============================================

// Global state for lipsync agents
const lipsyncState = {};

function initLipsyncState(agentId) {
  if (!lipsyncState[agentId]) {
    lipsyncState[agentId] = {
      audioMode: 'upload-audio',
      audioData: null,
      isRecording: false,
      mediaRecorder: null,
      audioChunks: [],
      recordingTimer: null,
      recordingSeconds: 0
    };
  }
  return lipsyncState[agentId];
}

function switchAudioMode(agentId, mode) {
  const state = initLipsyncState(agentId);
  state.audioMode = mode;

  // Update button styles
  const buttons = document.querySelectorAll(`.audio-mode-btn-${agentId}`);
  buttons.forEach(btn => {
    const btnMode = btn.dataset.mode;
    if (btnMode === mode) {
      btn.classList.remove('bg-secondary', 'text-secondary-foreground', 'hover:bg-secondary/80');
      btn.classList.add('bg-primary', 'text-primary-foreground');
    } else {
      btn.classList.remove('bg-primary', 'text-primary-foreground');
      btn.classList.add('bg-secondary', 'text-secondary-foreground', 'hover:bg-secondary/80');
    }
  });

  // Show/hide content areas
  const contents = document.querySelectorAll(`.audio-mode-content-${agentId}`);
  contents.forEach(content => content.classList.add('hidden'));

  const activeContent = document.getElementById(`audioMode-${mode}-${agentId}`);
  if (activeContent) {
    activeContent.classList.remove('hidden');
  }
}

async function handleAudioUpload(event, agentId) {
  const file = event.target.files[0];
  if (!file) return;

  const state = initLipsyncState(agentId);

  // Immediate preview (if supported by browser audio player with object URL)
  const objectUrl = URL.createObjectURL(file);
  const audioPlayer = document.getElementById(`audioPlayer-${agentId}`);
  const audioPreview = document.getElementById(`audioPreview-${agentId}`);

  if (audioPlayer) {
    legacyClearMediaState(audioPlayer);
    audioPlayer.dataset.objectUrl = objectUrl;
    audioPlayer.src = objectUrl;
  }
  if (audioPreview) {
    audioPreview.classList.remove('hidden');
  }

  // Upload
  try {
    const uploadPromise = legacyTrackPendingUpload(
      agentId,
      'audio',
      legacyUploadFileToServer(file, { filename: file.name })
    );
    const uploadedUrl = await uploadPromise;
    if (state) state.audioUrl = uploadedUrl; // Store in state or dataset?
    // Lipsync might look at state.audioData OR state.audioUrl.
    // We need to ensure the runner knows about this URL.
    // Usually, the runner gathers inputs. I'll attach it to the player dataset for consistency.
    if (audioPlayer) audioPlayer.dataset.uploadedUrl = uploadedUrl;
  } catch (err) {
    legacyNotify('Audio upload failed', 'error');
    clearAudioPreview(agentId);
  }
}

function clearAudioPreview(agentId) {
  const state = initLipsyncState(agentId);
  state.audioData = null;
  const audioInput = document.getElementById(`audioFileInput-${agentId}`);
  const audioPreview = document.getElementById(`audioPreview-${agentId}`);
  const audioPlayer = document.getElementById(`audioPlayer-${agentId}`);
  if (audioInput) audioInput.value = '';
  if (audioPreview) audioPreview.classList.add('hidden');
  if (audioPlayer) audioPlayer.src = '';
}

function clearPortraitPreview(agentId) {
  const fileInput = document.getElementById(`fileInput-${agentId}`);
  const preview = document.getElementById(`preview-${agentId}`);
  const previewImg = document.getElementById(`previewImg-${agentId}`);
  const previewVideo = document.getElementById(`previewVideo-${agentId}`);
  if (fileInput) fileInput.value = '';
  if (preview) preview.classList.add('hidden');
  if (previewImg) {
    legacyClearMediaState(previewImg);
    previewImg.src = '';
  }
  if (previewVideo) {
    legacyClearMediaState(previewVideo);
    previewVideo.src = '';
    previewVideo.classList.add('hidden');
  }
}

async function toggleRecording(agentId) {
  const state = initLipsyncState(agentId);

  if (state.isRecording) {
    // Stop recording
    stopRecording(agentId);
  } else {
    // Start recording
    await startRecording(agentId);
  }
}

async function startRecording(agentId) {
  const state = initLipsyncState(agentId);

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    state.mediaRecorder = new MediaRecorder(stream);
    state.audioChunks = [];
    state.recordingSeconds = 0;

    state.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        state.audioChunks.push(e.data);
      }
    };

    state.mediaRecorder.onstop = () => {
      const audioBlob = new Blob(state.audioChunks, { type: 'audio/webm' });
      const reader = new FileReader();
      reader.onload = (e) => {
        state.audioData = e.target.result;
        const recordingPlayer = document.getElementById(`recordingPlayer-${agentId}`);
        const recordingPreview = document.getElementById(`recordingPreview-${agentId}`);
        if (recordingPlayer) recordingPlayer.src = e.target.result;
        if (recordingPreview) recordingPreview.classList.remove('hidden');
      };
      reader.readAsDataURL(audioBlob);

      // Stop all tracks
      stream.getTracks().forEach(track => track.stop());
    };

    state.mediaRecorder.start();
    state.isRecording = true;

    // Update UI
    const recordBtn = document.getElementById(`recordBtn-${agentId}`);
    const recordIcon = document.getElementById(`recordIcon-${agentId}`);
    const recordStatus = document.getElementById(`recordStatus-${agentId}`);
    const recordTimer = document.getElementById(`recordTimer-${agentId}`);

    if (recordBtn) recordBtn.classList.add('animate-pulse');
    if (recordIcon) recordIcon.innerHTML = '<rect x="6" y="6" width="12" height="12"/>';
    if (recordStatus) recordStatus.textContent = 'Recording... Click to stop';
    if (recordTimer) {
      recordTimer.classList.remove('hidden');
      recordTimer.textContent = '00:00';
    }

    // Start timer
    state.recordingTimer = setInterval(() => {
      state.recordingSeconds++;
      const mins = Math.floor(state.recordingSeconds / 60).toString().padStart(2, '0');
      const secs = (state.recordingSeconds % 60).toString().padStart(2, '0');
      if (recordTimer) recordTimer.textContent = `${mins}:${secs}`;
    }, 1000);

  } catch (err) {
    console.error('Failed to start recording:', err);
    showToast('Microphone access denied. Please allow microphone access.', 5000);
  }
}

function stopRecording(agentId) {
  const state = initLipsyncState(agentId);

  if (state.mediaRecorder && state.isRecording) {
    state.mediaRecorder.stop();
    state.isRecording = false;

    if (state.recordingTimer) {
      clearInterval(state.recordingTimer);
      state.recordingTimer = null;
    }

    // Update UI
    const recordBtn = document.getElementById(`recordBtn-${agentId}`);
    const recordIcon = document.getElementById(`recordIcon-${agentId}`);
    const recordStatus = document.getElementById(`recordStatus-${agentId}`);
    const recordTimer = document.getElementById(`recordTimer-${agentId}`);

    if (recordBtn) recordBtn.classList.remove('animate-pulse');
    if (recordIcon) recordIcon.innerHTML = '<circle cx="12" cy="12" r="6"/>';
    if (recordStatus) recordStatus.textContent = 'Click to start recording';
    if (recordTimer) recordTimer.classList.add('hidden');
  }
}

function clearRecording(agentId) {
  const state = initLipsyncState(agentId);
  state.audioData = null;
  state.audioChunks = [];
  const recordingPreview = document.getElementById(`recordingPreview-${agentId}`);
  const recordingPlayer = document.getElementById(`recordingPlayer-${agentId}`);
  if (recordingPreview) recordingPreview.classList.add('hidden');
  if (recordingPlayer) recordingPlayer.src = '';
}

// ============================================
// END LIP-SYNC AUDIO MODE HANDLERS
// ============================================

// Upload handlers for in-box preview (Face Swap, AI Model Swap)
async function handleUploadInBox(event, agentId) {
  const file = event.target.files[0];
  if (file) {
    const placeholder = document.getElementById(`placeholder-${agentId}`);
    const preview = document.getElementById(`previewImg-${agentId}`);
    const clearBtn = document.getElementById(`clearBtn-${agentId}`);
    const uploadBox = document.getElementById(`uploadBox-${agentId}`);

    if (placeholder) placeholder.classList.add('hidden');
    if (preview) {
      legacyClearMediaState(preview);
      const objectUrl = URL.createObjectURL(file);
      preview.dataset.objectUrl = objectUrl;
      preview.src = objectUrl;
      preview.classList.remove('hidden');
    }
    if (clearBtn) { clearBtn.classList.remove('hidden'); clearBtn.classList.add('flex'); }
    if (uploadBox) {
      uploadBox.classList.remove('border-dashed');
      uploadBox.classList.add('border-solid', 'border-primary');
    }

    try {
      const uploadPromise = legacyTrackPendingUpload(
        agentId,
        'file',
        legacyUploadFileToServer(file, { filename: file.name })
      );
      const uploadedUrl = await uploadPromise;
      if (preview) preview.dataset.uploadedUrl = uploadedUrl;
    } catch (err) {
      legacyNotify('Upload failed', 'error');
      clearUploadInBox(agentId);
    }
  }
}

async function handleUploadInBox2(event, agentId) {
  const file = event.target.files[0];
  if (file) {
    const placeholder = document.getElementById(`placeholder2-${agentId}`);
    const preview = document.getElementById(`previewImg2-${agentId}`);
    const clearBtn = document.getElementById(`clearBtn2-${agentId}`);
    const uploadBox = document.getElementById(`uploadBox2-${agentId}`);

    if (placeholder) placeholder.classList.add('hidden');
    if (preview) {
      legacyClearMediaState(preview);
      const objectUrl = URL.createObjectURL(file);
      preview.dataset.objectUrl = objectUrl;
      preview.src = objectUrl;
      preview.classList.remove('hidden');
    }
    if (clearBtn) { clearBtn.classList.remove('hidden'); clearBtn.classList.add('flex'); }
    if (uploadBox) {
      uploadBox.classList.remove('border-dashed');
      uploadBox.classList.add('border-solid', 'border-primary');
    }

    try {
      const uploadPromise = legacyTrackPendingUpload(
        agentId,
        'file2',
        legacyUploadFileToServer(file, { filename: file.name })
      );
      const uploadedUrl = await uploadPromise;
      if (preview) preview.dataset.uploadedUrl = uploadedUrl;
    } catch (err) {
      legacyNotify('Upload failed', 'error');
      clearUploadInBox2(agentId);
    }
  }
}

function clearUploadInBox(agentId) {
  const fileInput = document.getElementById(`fileInput-${agentId}`);
  const placeholder = document.getElementById(`placeholder-${agentId}`);
  const preview = document.getElementById(`previewImg-${agentId}`);
  const clearBtn = document.getElementById(`clearBtn-${agentId}`);
  const uploadBox = document.getElementById(`uploadBox-${agentId}`);

  if (fileInput) fileInput.value = '';
  if (placeholder) placeholder.classList.remove('hidden');
  if (preview) preview.classList.add('hidden');
  if (clearBtn) {
    clearBtn.classList.add('hidden');
    clearBtn.classList.remove('flex');
  }
  if (uploadBox) {
    uploadBox.classList.add('border-dashed');
    uploadBox.classList.remove('border-solid', 'border-primary');
  }
}

function clearUploadInBox2(agentId) {
  const fileInput = document.getElementById(`fileInput2-${agentId}`);
  const placeholder = document.getElementById(`placeholder2-${agentId}`);
  const preview = document.getElementById(`previewImg2-${agentId}`);
  const clearBtn = document.getElementById(`clearBtn2-${agentId}`);
  const uploadBox = document.getElementById(`uploadBox2-${agentId}`);

  if (fileInput) fileInput.value = '';
  if (placeholder) placeholder.classList.remove('hidden');
  if (preview) preview.classList.add('hidden');
  if (clearBtn) {
    clearBtn.classList.add('hidden');
    clearBtn.classList.remove('flex');
  }
  if (uploadBox) {
    uploadBox.classList.add('border-dashed');
    uploadBox.classList.remove('border-solid', 'border-primary');
  }
}

// Video upload handler for video-face-swap (slot 2)
async function handleVideoUploadInBox2(event, agentId) {
  const file = event.target.files[0];
  if (file) {
    if (file.size > LEGACY_MAX_VIDEO_UPLOAD_BYTES) {
      legacyNotify(
        `Video is too large (${legacyFormatBytes(file.size)}). Max upload is ${legacyFormatBytes(LEGACY_MAX_VIDEO_UPLOAD_BYTES)}.`,
        'error'
      );
      try { event.target.value = ''; } catch { }
      return;
    }

    const placeholder = document.getElementById(`placeholder2-${agentId}`);
    const preview = document.getElementById(`previewVideo2-${agentId}`);
    const clearBtn = document.getElementById(`clearBtn2-${agentId}`);
    const uploadBox = document.getElementById(`uploadBox2-${agentId}`);

    if (placeholder) placeholder.classList.add('hidden');
    if (preview) {
      legacyClearMediaState(preview);
      const objectUrl = URL.createObjectURL(file);
      preview.dataset.objectUrl = objectUrl;
      preview.src = objectUrl;
      preview.classList.remove('hidden');
    }
    if (clearBtn) clearBtn.classList.remove('hidden');
    if (clearBtn) clearBtn.classList.add('flex');
    if (uploadBox) {
      uploadBox.classList.remove('border-dashed');
      uploadBox.classList.add('border-solid', 'border-primary');
    }

    // Always upload video
    try {
      const uploadPromise = legacyTrackPendingUpload(
        agentId,
        'video2',
        legacyUploadFileToServer(file, { filename: file.name })
      );
      const uploadedUrl = await uploadPromise;
      if (preview) preview.dataset.uploadedUrl = uploadedUrl;
    } catch (err) {
      legacyNotify(err?.message ? String(err.message) : 'Video upload failed', 'error');
      clearVideoUploadInBox2(agentId);
      return;
    }
  }
}

function clearVideoUploadInBox2(agentId) {
  const fileInput = document.getElementById(`fileInput2-${agentId}`);
  const placeholder = document.getElementById(`placeholder2-${agentId}`);
  const preview = document.getElementById(`previewVideo2-${agentId}`);
  const clearBtn = document.getElementById(`clearBtn2-${agentId}`);
  const uploadBox = document.getElementById(`uploadBox2-${agentId}`);

  if (fileInput) fileInput.value = '';
  if (placeholder) placeholder.classList.remove('hidden');
  if (preview) {
    legacyClearMediaState(preview);
    preview.src = '';
    preview.classList.add('hidden');
  }
  if (clearBtn) {
    clearBtn.classList.add('hidden');
    clearBtn.classList.remove('flex');
  }
  if (uploadBox) {
    uploadBox.classList.add('border-dashed');
    uploadBox.classList.remove('border-solid', 'border-primary');
  }
}

// Model selection for Virtual Try-On
function selectModel(element, agentId) {
  // Remove selection from all models
  document.querySelectorAll('.model-select').forEach(el => {
    el.classList.remove('border-primary');
    el.classList.add('border-transparent');
  });
  // Add selection to clicked model
  element.classList.remove('border-transparent');
  element.classList.add('border-primary');
  const img = element.querySelector('img');
  if (agentId && img?.src) {
    selectedModels[agentId] = img.src;
  }
}

// Update model icon when dropdown selection changes (for video-generator, etc.)
function updateModelIcon(agentId, selectEl) {
  const iconSpan = document.getElementById(`modelIcon-${agentId}`);
  if (iconSpan && selectEl.selectedOptions[0]) {
    // Extract icon from the option text (e.g., "⚡ Kling 2.5 Turbo" -> "⚡")
    const optionText = selectEl.selectedOptions[0].textContent;
    const icon = optionText.split(' ')[0];
    iconSpan.textContent = icon;
  }
}

// Generic button group selection (for Image Generator, etc.)
function selectOption(element, groupId) {
  const container = element.parentElement;
  // Remove selection from all buttons in the group
  container.querySelectorAll('button').forEach(btn => {
    btn.classList.remove('bg-primary', 'text-primary-foreground');
    btn.classList.add('bg-secondary', 'text-secondary-foreground', 'hover:bg-secondary/80');
  });
  // Add selection to clicked button
  element.classList.remove('bg-secondary', 'text-secondary-foreground', 'hover:bg-secondary/80');
  element.classList.add('bg-primary', 'text-primary-foreground');
  // Store selected value in a data attribute on the container
  container.dataset.selected = element.textContent.trim();
}

// Multi-select toggle for buttons (like expressions)
function toggleMultiSelect(element, groupId) {
  const container = element.parentElement;
  const isSelected = element.classList.contains('bg-primary');

  if (isSelected) {
    // Deselect
    element.classList.remove('bg-primary', 'text-primary-foreground');
    element.classList.add('bg-secondary', 'text-secondary-foreground', 'hover:bg-secondary/80');
  } else {
    // Select
    element.classList.remove('bg-secondary', 'text-secondary-foreground', 'hover:bg-secondary/80');
    element.classList.add('bg-primary', 'text-primary-foreground');
  }

  // Update data-selected with all selected values (comma separated)
  const selectedValues = [];
  container.querySelectorAll('button').forEach(btn => {
    if (btn.classList.contains('bg-primary')) {
      selectedValues.push(btn.textContent.trim());
    }
  });
  container.dataset.selected = selectedValues.join(',');
}

// Generic button group selection for grid layouts (2-column model selection)
function selectGridOption(element, groupId) {
  const container = element.parentElement;
  // Remove selection from all buttons in the group
  container.querySelectorAll('button').forEach(btn => {
    btn.classList.remove('bg-primary', 'text-primary-foreground');
    btn.classList.add('bg-muted', 'hover:bg-muted/80');
  });
  // Add selection to clicked button
  element.classList.remove('bg-muted', 'hover:bg-muted/80');
  element.classList.add('bg-primary', 'text-primary-foreground');
  // Store selected value in a data attribute on the container
  container.dataset.selected = element.querySelector('span:last-child')?.textContent.trim() || element.textContent.trim();
}

// Model tab switching for Virtual Try-On
function initModelTabs() {
  document.querySelectorAll('.model-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;

      // Update button styles
      document.querySelectorAll('.model-tab-btn').forEach(b => {
        if (b.dataset.tab === tab) {
          b.classList.add('bg-primary', 'text-primary-foreground');
          b.classList.remove('bg-secondary', 'text-secondary-foreground', 'hover:bg-secondary/80');
        } else {
          b.classList.remove('bg-primary', 'text-primary-foreground');
          b.classList.add('bg-secondary', 'text-secondary-foreground', 'hover:bg-secondary/80');
        }
      });

      // Show/hide tab content
      const defaultTab = document.getElementById('defaultModelTab');
      const customTab = document.getElementById('customModelTab');

      if (tab === 'default') {
        defaultTab?.classList.remove('hidden');
        customTab?.classList.add('hidden');
      } else {
        defaultTab?.classList.add('hidden');
        customTab?.classList.remove('hidden');
      }
    });
  });
}

function setPrompt(agentId, text) {
  const el = document.getElementById(`prompt-${agentId}`);
  if (el) el.value = text;
}

// Collect form inputs based on agent type
function collectAgentInputs(agentId) {
  const inputs = {};
  const agent = agents[agentId];

  // Special handling for virtual-try-on - uses personImage and garmentImage
  if (agentId === 'virtual-try-on') {
    const previewImg = document.getElementById(`previewImg-${agentId}`);
    if (previewImg && previewImg.src && !previewImg.classList.contains('hidden')) {
      inputs.personImage = legacyGetMediaValue(previewImg);
    }
    if (!inputs.personImage && selectedModels[agentId]) {
      inputs.personImage = selectedModels[agentId];
    }

    const previewImg2 = document.getElementById(`previewImg2-${agentId}`);
    if (previewImg2 && previewImg2.src && !previewImg2.classList.contains('hidden')) {
      inputs.garmentImage = legacyGetMediaValue(previewImg2);
    }

    // Get category/garment type from the select element in step 2
    const uploadBox2 = document.getElementById(`uploadBox2-${agentId}`);
    let selectedCategory = '';
    if (uploadBox2) {
      const categorySelect = uploadBox2.parentElement?.querySelector('select');
      if (categorySelect && categorySelect.value) {
        selectedCategory = categorySelect.value;
      }
    }

    // Normalize garment category to what the backend expects
    const categoryMap = {
      'tops': 'upper_body',
      'upper_body': 'upper_body',
      'upper-body': 'upper_body',
      'outerwear': 'upper_body',
      'jackets': 'upper_body',
      'coats': 'upper_body',
      'bottoms': 'lower_body',
      'lower_body': 'lower_body',
      'lower-body': 'lower_body',
      'pants': 'lower_body',
      'shorts': 'lower_body',
      'dresses': 'dresses',
      'dress': 'dresses',
      'full-body': 'dresses',
      'full_body': 'dresses',
    };
    const normalizedCategory = (selectedCategory || '').toLowerCase();
    inputs.category = categoryMap[normalizedCategory] || 'upper_body';

    return inputs;
  }

  // Special handling for lip-sync - uses portrait, audio, language, voice style
  if (agentId === 'lip-sync') {
    // Get portrait image or video
    const previewImg = document.getElementById(`previewImg-${agentId}`);
    const previewVideo = document.getElementById(`previewVideo-${agentId}`);

    if (previewVideo && previewVideo.src && !previewVideo.classList.contains('hidden')) {
      inputs.videoUrl = legacyGetMediaValue(previewVideo);
    } else if (previewImg && previewImg.src && !previewImg.classList.contains('hidden')) {
      inputs.image = legacyGetMediaValue(previewImg);
    }

    // Get audio input based on current mode
    const state = lipsyncState[agentId] || { audioMode: 'upload-audio' };

    if (state.audioMode === 'texttospeech') {
      // Text-to-Speech mode
      const ttsText = document.getElementById(`ttsText-${agentId}`);
      if (ttsText && ttsText.value.trim()) {
        inputs.text = ttsText.value.trim();
      }
    } else {
      // Upload Audio or Record mode
      if (state.audioData) {
        inputs.audioUrl = state.audioData;
      }
    }

    // Get language
    const languageSelect = document.getElementById(`language-${agentId}`);
    if (languageSelect && languageSelect.value) {
      inputs.language = languageSelect.value;
    }

    // Get voice style and map to voice preset
    const voiceStyleSelect = document.getElementById(`voiceStyle-${agentId}`);
    if (voiceStyleSelect && voiceStyleSelect.value) {
      // Map voice style to backend voice preset
      const voiceStyleMap = {
        'natural': 'female-professional',
        'professional': 'male-professional',
        'casual': 'female-warm',
        'energetic': 'male-young'
      };
      inputs.voice = voiceStyleMap[voiceStyleSelect.value] || 'female-professional';
    }

    // Set audio mode for backend
    inputs.audioMode = state.audioMode;

    return inputs;
  }

  // Special handling for face-swap agents - uses sourceImage and targetImage
  if (agentId === 'face-swap' || agentId === 'ai-model-swap' || agentId === 'character-swap') {
    const previewImg = document.getElementById(`previewImg-${agentId}`);
    if (previewImg && previewImg.src && !previewImg.classList.contains('hidden')) {
      inputs.sourceImage = legacyGetMediaValue(previewImg);
    }

    const previewImg2 = document.getElementById(`previewImg2-${agentId}`);
    if (previewImg2 && previewImg2.src && !previewImg2.classList.contains('hidden')) {
      inputs.targetImage = legacyGetMediaValue(previewImg2);
    }

    // Add consent for same-person swap (default for the UI - biometric consent)
    inputs.samePersonSwap = true;

    // Debug logging
    console.log(`[${agentId}] Input collection:`, {
      hasSourceImage: !!inputs.sourceImage,
      hasTargetImage: !!inputs.targetImage,
      sourceImageLen: inputs.sourceImage?.length,
      targetImageLen: inputs.targetImage?.length,
      sourceImagePrefix: inputs.sourceImage?.substring(0, 50),
      targetImagePrefix: inputs.targetImage?.substring(0, 50),
    });

    return inputs;
  }

  // Special handling for video-face-swap - uses sourceImage (face) and targetVideo (video)
  if (agentId === 'video-face-swap') {
    const previewImg = document.getElementById(`previewImg-${agentId}`);
    console.log('[video-face-swap] previewImg:', previewImg?.id, 'src:', previewImg?.src?.substring(0, 50), 'hidden:', previewImg?.classList?.contains('hidden'));
    if (previewImg && previewImg.src && !previewImg.classList.contains('hidden')) {
      inputs.sourceImage = legacyGetMediaValue(previewImg);
    }

    const previewVideo2 = document.getElementById(`previewVideo2-${agentId}`);
    console.log('[video-face-swap] previewVideo2:', previewVideo2?.id, 'src:', previewVideo2?.src?.substring(0, 50), 'hidden:', previewVideo2?.classList?.contains('hidden'));
    if (previewVideo2 && previewVideo2.src && !previewVideo2.classList.contains('hidden')) {
      inputs.targetVideo = legacyGetMediaValue(previewVideo2);
    }

    console.log('[video-face-swap] Final inputs:', { hasSourceImage: !!inputs.sourceImage, hasTargetVideo: !!inputs.targetVideo, sourceImageLen: inputs.sourceImage?.length, targetVideoLen: inputs.targetVideo?.length });

    // Add default consent for same-person swap (user can be editing their own video)
    inputs.consent = {
      subjectConsent: true,
      samePersonSwap: true,
      ageVerified: true,
      intendedUse: 'personal',
      timestamp: new Date().toISOString(),
      method: 'checkbox'
    };

    return inputs;
  }

  // Special handling for sand-worm - uses imageUrl, prompt, model, duration
  if (agentId === 'sand-worm') {
    const previewImg = document.getElementById(`previewImg-${agentId}`);
    if (previewImg && previewImg.src && !previewImg.classList.contains('hidden')) {
      inputs.imageUrl = legacyGetMediaValue(previewImg);
    }

    // Get the prompt (describes scene with sand worm)
    const promptEl = document.getElementById(`prompt-${agentId}`);
    if (promptEl && promptEl.value) {
      inputs.prompt = promptEl.value;
    }

    // Get model selection
    const modelSelect = document.getElementById(`modelSelect-${agentId}`);
    if (modelSelect && modelSelect.value) {
      inputs.model = modelSelect.value;
    }

    // Get duration selection
    const durationSelect = document.getElementById(`durationSelect-${agentId}`);
    if (durationSelect && durationSelect.value) {
      inputs.duration = durationSelect.value;
    }

    return inputs;
  }

  // Special handling for video-generator - uses startFrame and endFrame
  if (agentId === 'video-generator') {
    const previewImg = document.getElementById(`previewImg-${agentId}`);
    if (previewImg && previewImg.src && !previewImg.classList.contains('hidden')) {
      inputs.startFrame = legacyGetMediaValue(previewImg);
    }

    const previewImg2 = document.getElementById(`previewImg2-${agentId}`);
    if (previewImg2 && previewImg2.src && !previewImg2.classList.contains('hidden')) {
      inputs.endFrame = legacyGetMediaValue(previewImg2);
    }

    // Get the prompt (describes motion/scene)
    const promptEl = document.getElementById(`prompt-${agentId}`);
    if (promptEl && promptEl.value) {
      inputs.prompt = promptEl.value;
    }

    // Get model selection (e.g., 'kling-2.5-turbo', 'kling-pro', etc.)
    const modelSelect = document.getElementById(`modelSelect-${agentId}`);
    if (modelSelect && modelSelect.value) {
      inputs.model = modelSelect.value;
    }

    // Models that support end frame transitions
    const endFrameModels = ['kling-pro', 'minimax-hailuo', 'luma-ray'];

    // If end frame is provided but model doesn't support it, auto-switch to kling-pro
    if (inputs.endFrame && inputs.model && !endFrameModels.includes(inputs.model)) {
      console.warn(`[video-generator] Model ${inputs.model} doesn't support end frame, switching to kling-pro`);
      inputs.model = 'kling-pro';
      // Update UI to reflect the change
      if (modelSelect) {
        modelSelect.value = 'kling-pro';
        updateModelIcon(agentId, modelSelect);
      }
    }

    // Get duration and resolution from the grid selects
    const modal = document.getElementById(`modal-${agentId}`);
    if (modal) {
      const selects = modal.querySelectorAll('.grid.grid-cols-2 select');
      if (selects[0] && selects[0].value) {
        inputs.duration = selects[0].value;
      }
      if (selects[1] && selects[1].value) {
        inputs.resolution = selects[1].value;
      }
    }

    return inputs;
  }

  // Special handling for object-remover - needs image and prompt, mask is optional
  if (agentId === 'object-remover') {
    const previewImg = document.getElementById(`previewImg-${agentId}`);
    if (previewImg && previewImg.src && !previewImg.classList.contains('hidden')) {
      inputs.image = legacyGetMediaValue(previewImg);
    }

    // Get the prompt (required - describes what to remove)
    const promptEl = document.getElementById(`prompt-${agentId}`);
    if (promptEl && promptEl.value) {
      inputs.prompt = promptEl.value;
    }

    // Get the selected model (nano-banana-pro or nano-banana)
    const modelSelect = document.getElementById(`modelSelect-${agentId}`);
    if (modelSelect && modelSelect.value) {
      inputs.model = modelSelect.value;
    }

    // Optional mask upload for advanced users
    const previewImg2 = document.getElementById(`previewImg2-${agentId}`);
    if (previewImg2 && previewImg2.src && !previewImg2.classList.contains('hidden')) {
      inputs.mask = legacyGetMediaValue(previewImg2);
    }

    return inputs;
  }

  // Special handling for talking-avatar - needs faceUrl and text (for TTS)
  if (agentId === 'talking-avatar') {
    const previewImg = document.getElementById(`previewImg-${agentId}`);
    if (previewImg && previewImg.src && !previewImg.classList.contains('hidden')) {
      inputs.faceUrl = legacyGetMediaValue(previewImg);
    }

    // Get the text to speak (for TTS mode)
    const textEl = document.getElementById(`text-${agentId}`);
    if (textEl && textEl.value.trim()) {
      inputs.text = textEl.value.trim();
    }

    // Get selection options
    const avatarStyleEl = document.getElementById(`avatarStyleSelection-${agentId}`);
    if (avatarStyleEl && avatarStyleEl.dataset.selected) {
      inputs.avatarStyle = avatarStyleEl.dataset.selected;
    }

    const expressionEl = document.getElementById(`expressionSelection-${agentId}`);
    if (expressionEl && expressionEl.dataset.selected) {
      inputs.expression = expressionEl.dataset.selected;
    }

    const backgroundEl = document.getElementById(`backgroundSelection-${agentId}`);
    if (backgroundEl && backgroundEl.dataset.selected) {
      inputs.background = backgroundEl.dataset.selected;
    }

    console.log(`[${agentId}] Input collection:`, {
      hasFaceUrl: !!inputs.faceUrl,
      hasText: !!inputs.text,
      textLength: inputs.text?.length,
      avatarStyle: inputs.avatarStyle,
      expression: inputs.expression,
      background: inputs.background,
    });

    return inputs;
  }

  // Get uploaded image/file (base64)
  const previewImg = document.getElementById(`previewImg-${agentId}`);
  if (previewImg && previewImg.src && !previewImg.classList.contains('hidden')) {
    inputs.image = legacyGetMediaValue(previewImg);
  }

  // Note: Most agents don't use a second image.
  // Agents with special handling (virtual-try-on, face-swap, video-generator, etc.) already returned above.

  // Get prompt if available
  const promptEl = document.getElementById(`prompt-${agentId}`);
  if (promptEl && promptEl.value) {
    inputs.prompt = promptEl.value;
  }

  // Get selected options from data attributes
  const selectionIds = [
    'modelSelection', 'styleSelection', 'ratioSelection', 'numImagesSelection',
    'motionSelection', 'loopSelection', 'durationSelection',
    'avatarStyleSelection', 'expressionSelection', 'backgroundSelection',
    'resolutionSelection', 'frameRateSelection', 'stabSelection',
    'formatSelection', 'enhancementSelection',
    // Chibi sticker maker
    'stickerStyleSelection', 'packSizeSelection', 'expressionsSelection',
    // Music generator
    'genreSelection', 'moodSelection', 'musicDurationSelection',
    // Voice cloner
    'voiceTypeSelection',
    // Product description writer
    'platformSelection', 'toneSelection', 'lengthSelection',
    // Face swap
    'swapModeSelection',
    // AI model swap / Virtual try-on
    'modelDiversitySelection', 'bodyTypeSelection', 'poseMatchingSelection',
    // Style transfer
    'styleCategorySelection', 'intensitySelection', 'popularStyleSelection',
    // Image upscaler
    'scaleSelection', 'enhancementTypeSelection', 'noiseReductionSelection',
    // Default UI options
    'motionTypeSelection', 'defaultStyleSelection'
  ];

  selectionIds.forEach(id => {
    const el = document.getElementById(`${id}-${agentId}`);
    if (el && el.dataset.selected) {
      // Convert ID to input field name
      const fieldName = id.replace('Selection', '').replace(/([A-Z])/g, '_$1').toLowerCase();
      inputs[fieldName] = el.dataset.selected;
    }
  });

  // Get the selected AI model (nano-banana or nano-banana-pro) for agents with model selector
  const modelSelect = document.getElementById(`modelSelect-${agentId}`);
  if (modelSelect && modelSelect.value) {
    const raw = String(modelSelect.value);
    // Only keep legacy "model" inputs when the dropdown uses a legacy short code.
    // When the dropdown contains real registry IDs, selection is sent via `selectedModelId` instead.
    if (!raw.includes('/')) {
      inputs.model = raw;
    }
  }

  // Collect feature toggle checkboxes (portrait-enhancer, face-swap, and similar agents)
  const featuresContainer = document.getElementById(`featuresToggle-${agentId}`);
  if (featuresContainer) {
    const checkboxes = featuresContainer.querySelectorAll('input[type="checkbox"]');
    const enabledFeatures = [];
    checkboxes.forEach(cb => {
      if (cb.checked && cb.dataset.feature) {
        enabledFeatures.push(cb.dataset.feature);
      }
    });
    if (enabledFeatures.length > 0) {
      inputs.features = enabledFeatures;
    }
  }

  // Collect individual checkboxes with IDs (video-generator enhance, etc.)
  const enhanceOnCheckbox = document.getElementById(`enhanceOn-${agentId}`);
  if (enhanceOnCheckbox) {
    inputs.enhanceOn = enhanceOnCheckbox.checked;
  }

  return inputs;
}

// Poll async job until complete - with exponential backoff retry and smooth progress
async function pollJobUntilComplete(jobId, outputEl) {
  const maxAttempts = 300;
  let initialPollInterval = 1000;
  let consecutiveErrors = 0;
  const maxConsecutiveErrors = 5;
  let pollInterval = initialPollInterval;

  // Simulated progress state
  let simulatedProgress = 0;
  let isComplete = false;

  // Progress animation - runs independently of polling
  const progressInterval = setInterval(() => {
    if (isComplete) {
      clearInterval(progressInterval);
      return;
    }

    // Gradually increase progress, slowing down as we approach 90%
    if (simulatedProgress < 30) {
      simulatedProgress += Math.random() * 3 + 1; // Fast at start (1-4%)
    } else if (simulatedProgress < 60) {
      simulatedProgress += Math.random() * 2 + 0.5; // Medium (0.5-2.5%)
    } else if (simulatedProgress < 85) {
      simulatedProgress += Math.random() * 1 + 0.3; // Slower (0.3-1.3%)
    } else if (simulatedProgress < 90) {
      simulatedProgress += Math.random() * 0.3 + 0.1; // Very slow (0.1-0.4%)
    }
    // Cap at 90% until complete
    simulatedProgress = Math.min(simulatedProgress, 90);

    updateProgressUI(outputEl, Math.round(simulatedProgress));
  }, 500);

  function updateProgressUI(el, progress) {
    el.innerHTML = `
          <div class="p-6 text-center">
            <svg class="w-12 h-12 mx-auto mb-3 text-primary animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p class="text-sm font-medium">Processing... ${progress}%</p>
            <div class="mt-3 w-full bg-muted rounded-full h-2">
              <div class="bg-primary h-2 rounded-full transition-all duration-300" style="width: ${progress}%"></div>
            </div>
            ${progress >= 85 ? '<p class="text-xs text-muted-foreground mt-2">Almost there...</p>' : ''}
          </div>
        `;
  }

  try {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const res = await fetch(`${API_BASE_URL}/jobs/${jobId}`, {
          signal: controller.signal,
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          }
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        const job = await res.json();

        // Handle terminal states BEFORE resetting error counter
        if (job.status === 'completed') {
          isComplete = true;
          clearInterval(progressInterval);
          // Animate to 100%
          updateProgressUI(outputEl, 95);
          await new Promise(r => setTimeout(r, 200));
          updateProgressUI(outputEl, 100);
          await new Promise(r => setTimeout(r, 300));
          return job.output;
        }
        if (job.status === 'failed') {
          // Don't throw inside try - throw outside to exit poll loop properly
          isComplete = true;
          clearInterval(progressInterval);
          const errorMsg = job.error?.message || 'Processing failed';
          console.error('[POLL] Job failed:', errorMsg);
          throw new Error(errorMsg);
        }

        // Only reset error counter for successful non-terminal polls
        consecutiveErrors = 0;
        pollInterval = initialPollInterval;
      } catch (err) {
        // Check if this is a terminal failure (job.status was 'failed')
        // vs a network/transient error that should be retried
        if (isComplete) {
          // Job failed - don't retry, just propagate the error
          throw err;
        }

        consecutiveErrors++;
        pollInterval = Math.min(initialPollInterval * Math.pow(2, consecutiveErrors - 1), 16000);

        if (consecutiveErrors >= maxConsecutiveErrors) {
          isComplete = true;
          clearInterval(progressInterval);
          console.error(`[POLL] Max retries exceeded (${consecutiveErrors}/${maxConsecutiveErrors}):`, err.message);
          throw err;
        }
        console.warn(`[POLL] Error (${consecutiveErrors}/${maxConsecutiveErrors}) - Retrying in ${pollInterval}ms:`, err.message);
      }

      await new Promise(r => setTimeout(r, pollInterval));
    }
    isComplete = true;
    clearInterval(progressInterval);
    throw new Error('Request timed out after 10+ minutes');
  } catch (err) {
    isComplete = true;
    clearInterval(progressInterval);
    throw err;
  }
}

// Retry helper with exponential backoff
// Timeout set to 120 seconds to allow for long-running operations like image upscaling
async function fetchWithRetry(url, options, maxRetries = 3, timeout = 120000) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      const response = await fetch(url, { credentials: 'include', ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      return response;
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
        console.warn(`[FETCH] Attempt ${attempt}/${maxRetries} failed:`, err.message, `- Retrying in ${waitTime}ms`);
        await new Promise(r => setTimeout(r, waitTime));
      }
    }
  }
  throw lastError;
}

// Generate output (real API call)
async function generateOutput(agentId) {
  // Agreement check — show modal if user hasn't agreed yet
  if (window.PendingPaid?.showAgreementModal) {
    const agreed = await window.PendingPaid.showAgreementModal();
    if (!agreed) return;
  }

  const btn = document.getElementById(`generateBtn-${agentId}`);
  const output = document.getElementById(`output-${agentId}`);
  const agent = agents[agentId];
  if (!btn || !output) return;

  // Show loading
  btn.disabled = true;
  btn.innerHTML = `
        <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Generating...
      `;

  // Start with initial progress animation
  let initialProgress = 0;
  const initialProgressInterval = setInterval(() => {
    if (initialProgress < 15) {
      initialProgress += Math.random() * 2 + 0.5;
      initialProgress = Math.min(initialProgress, 15); // Cap at 15% during initial request
      output.innerHTML = `
            <div class="p-6 text-center">
              <svg class="w-12 h-12 mx-auto mb-3 text-primary animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p class="text-sm font-medium">Processing... ${Math.round(initialProgress)}%</p>
              <div class="mt-3 w-full bg-muted rounded-full h-2">
                <div class="bg-primary h-2 rounded-full transition-all duration-300" style="width: ${Math.round(initialProgress)}%"></div>
              </div>
              <p class="text-xs text-muted-foreground mt-2">Initializing...</p>
            </div>
          `;
    }
  }, 400);

  // Clear output data for sharing at start
  delete outputData[agentId];

  // Helper to stop initial progress
  const stopInitialProgress = () => clearInterval(initialProgressInterval);

  try {
    await legacyWaitForPendingUploads(agentId);
    // Collect inputs from the form
    const inputs = collectAgentInputs(agentId);
    const selectedModelId = getSelectedModelIdForAgent(agentId);
    const requestBody = { input: inputs };
    if (selectedModelId) requestBody.selectedModelId = selectedModelId;

    // Make API call to MuleRun agents endpoint with retries
    const response = await fetchWithRetry(`${API_BASE_URL}/api/store/${agentId}/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
      if (response.status === 402 && errorData?.code === 'QUEUE_LIMIT_EXCEEDED') {
        if (output && window.PendingPaid?.renderPendingPaidInto) {
          window.PendingPaid.renderPendingPaidInto(output, {
            title: 'Queue Limit Reached',
            message: errorData.error,
            onRetry: () => btn?.click(),
          });
          return;
        }
        throw new Error(errorData.error || 'Queue limit reached. Please wait for your current jobs to complete or upgrade your plan.');
      }
      if (response.status === 402 && errorData && typeof errorData === 'object') {
        const required = errorData.requiredCredits;
        const available = errorData.availableCredits;
        const suggested = Array.isArray(errorData.suggestedModels) ? errorData.suggestedModels : [];
        const suggestedText = suggested.length
          ? ` Try: ${suggested.map(m => `${m.displayName || m.id} (${m.requiredCredits} credits)`).join(', ')}`
          : '';
        throw new Error(`Insufficient credits: need ${required}, have ${available}.${suggestedText}`);
      }
      const errorMsg = errorData.detail || errorData.message || errorData.error || `API error: ${response.status}`;
      throw new Error(typeof errorMsg === 'object' ? JSON.stringify(errorMsg) : errorMsg);
    }

    const result = await response.json();

    // Stop initial progress animation
    stopInitialProgress();

    // Check if this is an async job - poll until complete
    let data;
    if (result.jobId && (result.status === 'processing' || result.status === 'pending')) {
      data = await pollJobUntilComplete(result.jobId, output);
    } else {
      data = result.output || result.data || result;
    }

    // Reset button
    btn.disabled = false;
    btn.innerHTML = `
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
          </svg>
          Generate ${isAgentFree(agent) ? '- Free' : `- ${getActualPrice(agent)}`}
        `;

    // Extract media URLs from various response formats
    // Helper to pull the first usable media URL from varying response shapes
    const getFirstUrl = (val) => {
      if (!val) return '';
      if (typeof val === 'string') return val;
      if (Array.isArray(val)) return getFirstUrl(val[0]);
      if (typeof val === 'object') {
        // Check common URL property names
        if (val.url) return val.url;
        if (val.imageUrl) return val.imageUrl;
        if (val.href) return val.href;
      }
      return '';
    };

    // Check for video URLs - explicit video fields first, then check resultUrl/url for video extensions
    const explicitVideoUrl = data?.video || data?.video_url || data?.videoUrl || data?.syncedVideo || data?.resultVideo;
    // Generic URL from various output formats (including Replicate's raw output)
    const rawOutput = data?.output;
    const firstRawOutput = Array.isArray(rawOutput) ? rawOutput[0] : rawOutput;
    const genericUrl = data?.resultUrl || data?.url || data?.outputUrl ||
      (typeof firstRawOutput === 'string' ? firstRawOutput : null);
    const isVideoUrl = (url) => {
      if (!url || typeof url !== 'string') return false;
      const lowerUrl = url.toLowerCase();
      // Check for actual video file extensions (not just replicate.delivery domain)
      return lowerUrl.includes('.mp4') || lowerUrl.includes('.webm') || lowerUrl.includes('.mov') ||
        lowerUrl.includes('.avi') || lowerUrl.includes('.mkv') ||
        lowerUrl.includes('/video/') || // explicit video path segment
        (lowerUrl.includes('replicate.delivery') && !lowerUrl.match(/\.(webp|png|jpg|jpeg|gif)$/i));
    };
    const isImageUrl = (url) => {
      if (!url || typeof url !== 'string') return false;
      const lowerUrl = url.toLowerCase();
      // Check for image file extensions
      return lowerUrl.match(/\.(webp|png|jpg|jpeg|gif|bmp|svg|tiff?)$/i) ||
        lowerUrl.includes('/image/') ||
        (lowerUrl.includes('replicate.delivery') && lowerUrl.match(/\.(webp|png|jpg|jpeg|gif)$/i));
    };
    const videoUrl = explicitVideoUrl || (isVideoUrl(genericUrl) ? genericUrl : null);
    const imageUrl =
      getFirstUrl(
        data?.resultImage ||
        data?.image ||
        data?.image_url ||
        data?.imageUrl ||
        data?.outputUrl ||     // art-style-transfer, resumepic-linkedin
        data?.processedImage ||
        data?.enhancedImage || // portrait-enhancer
        data?.upscaledImage || // image-upscaler
        data?.outputImageUrl || // image-translator
        data?.generatedImages || // character-creator, instadump
        data?.images ||
        data?.output ||        // Raw Replicate output (array or string)
        // Support array-based outputs from various agents
        data?.mockups ||       // mockup-studio, billboard-ad
        data?.thumbnails ||    // youtube-thumbnail-gen
        data?.creatives ||     // product-creative-studio
        data?.packshots ||     // packshot
        data?.variations ||    // agents with variations output
        data?.results ||       // generic results array
        (Array.isArray(data) ? data : null) ||
        // Fallback: use generic URL if it looks like an image
        (isImageUrl(genericUrl) ? genericUrl : null)
      );
    const audioUrl = data?.audio || data?.audio_url || data?.audioUrl;

    if (videoUrl) {
      outputData[agentId] = { type: 'video', url: videoUrl };
      output.innerHTML = `
            <video class="w-full rounded-ios-lg" autoplay muted loop playsinline controls>
              <source src="${videoUrl}" type="video/mp4">
            </video>
          `;
    } else if (imageUrl && typeof imageUrl === 'string' && (imageUrl.startsWith('http') || imageUrl.startsWith('data:'))) {
      // Check if there are multiple images to display as gallery
      const allImages = [];
      const imageArraySources = [
        data?.images, data?.output, data?.mockups, data?.thumbnails,
        data?.creatives, data?.packshots, data?.variations, data?.results,
        data?.generatedImages, // character-creator, instadump
      ];
      for (const src of imageArraySources) {
        if (Array.isArray(src)) {
          for (const item of src) {
            const url = typeof item === 'string' ? item :
              (item?.url || item?.imageUrl || item?.href);
            if (url && typeof url === 'string' && (url.startsWith('http') || url.startsWith('data:'))) {
              allImages.push(url);
            }
          }
        }
      }

      if (allImages.length > 1) {
        // Gallery view for multiple images
        outputData[agentId] = { type: 'gallery', urls: allImages };
        output.innerHTML = `
              <div class="grid ${allImages.length <= 4 ? 'grid-cols-2' : 'grid-cols-3'} gap-2">
                ${allImages.slice(0, 9).map((url, i) => `
                  <img src="${url}" class="w-full aspect-square object-cover rounded-ios-lg cursor-pointer hover:opacity-90 transition-opacity"
                       alt="Generated ${i + 1}" data-open-url="${url}">
                `).join('')}
              </div>
              ${allImages.length > 9 ? `<p class="text-xs text-muted-foreground mt-2 text-center">+${allImages.length - 9} more</p>` : ''}
            `;
      } else {
        // Single image view
        outputData[agentId] = { type: 'image', url: imageUrl };
        output.innerHTML = `
              <img src="${imageUrl}" class="w-full rounded-ios-lg" alt="Generated">
            `;
      }
    } else if (audioUrl) {
      outputData[agentId] = { type: 'audio', url: audioUrl };
      output.innerHTML = `
            <audio controls class="w-full rounded-ios-lg">
              <source src="${audioUrl}" type="audio/mpeg">
            </audio>
          `;
    } else if (data?.content || data?.text || data?.title) {
      // Text content (blog posts, etc.)
      outputData[agentId] = { type: 'text', content: data.content || data.text || '' };
      output.innerHTML = `
            <div class="p-4 text-left">
              ${data.title ? `<h3 class="text-lg font-bold mb-3">${data.title}</h3>` : ''}
              <div class="prose prose-sm max-w-none text-foreground whitespace-pre-wrap">${data.content || data.text || ''}</div>
              ${data.wordCount ? `<p class="text-xs text-muted-foreground mt-4">${data.wordCount} words</p>` : ''}
            </div>
          `;
    } else {
      outputData[agentId] = { type: 'json', content: JSON.stringify(data, null, 2) };
      output.innerHTML = `
            <div class="p-6 text-center">
              <svg class="w-12 h-12 mx-auto mb-3 text-ios-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              <p class="text-sm font-medium">Generation Complete!</p>
              <p class="text-xs text-muted-foreground mt-1">Your output is ready</p>
              <pre class="mt-4 text-left text-xs bg-muted p-3 rounded-ios overflow-auto max-h-48">${JSON.stringify(data, null, 2)}</pre>
            </div>
          `;
    }

  } catch (error) {
    // Stop initial progress animation on error
    stopInitialProgress();
    console.error('Generation error:', error);

    // Extract error message properly from various error formats
    let errorMessage = 'An unexpected error occurred';
    if (typeof error === 'string') {
      errorMessage = error;
    } else if (error && typeof error === 'object') {
      const msg = error.message || error.detail || error.error || '';
      // Provide user-friendly message for timeout/abort errors
      if (msg.includes('abort') || error.name === 'AbortError') {
        errorMessage = 'Request timed out. The server is taking longer than expected. Please try again.';
      } else {
        errorMessage = msg || JSON.stringify(error);
      }
    }

    btn.disabled = false;
    btn.innerHTML = `
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
          </svg>
          Generate ${isAgentFree(agent) ? '- Free' : `- ${getActualPrice(agent)}`}
        `;

    output.innerHTML = `
          <div class="p-6 text-center">
            <svg class="w-12 h-12 mx-auto mb-3 text-ios-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
            <p class="text-sm font-medium text-ios-red">Generation Failed</p>
            <p class="text-xs text-muted-foreground mt-1">${errorMessage}</p>
            <button data-action="generateOutput" data-param="${agentId}" class="mt-4 px-4 py-2 rounded-ios bg-primary text-primary-foreground text-sm font-medium">
              Try Again
            </button>
          </div>
        `;
  }
}

// ---------------------------------------------------------------------------
// CSP-compliant delegated event listeners
// Replaces all inline onclick/onchange handlers with data-attribute delegation.
// ---------------------------------------------------------------------------
(function initLegacyRunnerDelegation() {

  // -- Lookup table for data-action click handlers --
  // Functions that receive (element, param, param2)
  const actionHandlers = {
    selectModel:             (el, p)        => selectModel(el, p),
    selectOption:            (el, p)        => selectOption(el, p),
    toggleMultiSelect:       (el, p)        => toggleMultiSelect(el, p),
    clearUploadInBox:        (_el, p)       => clearUploadInBox(p),
    clearUploadInBox2:       (_el, p)       => clearUploadInBox2(p),
    clearVideoUploadInBox2:  (_el, p)       => clearVideoUploadInBox2(p),
    clearUpload:             (_el, p)       => clearUpload(p),
    clearUpload2:            (_el, p)       => clearUpload2(p),
    clearPortraitPreview:    (_el, p)       => clearPortraitPreview(p),
    clearAudioPreview:       (_el, p)       => clearAudioPreview(p),
    clearRecording:          (_el, p)       => clearRecording(p),
    switchAudioMode:         (_el, p, p2)   => switchAudioMode(p, p2),
    toggleRecording:         (_el, p)       => toggleRecording(p),
    setPrompt:               (_el, p, p2)   => setPrompt(p, p2),
    generateOutput:          (_el, p)       => generateOutput(p),
  };

  // -- Lookup table for data-onchange change handlers --
  const changeHandlers = {
    handleUploadInBox:        (ev, p)  => handleUploadInBox(ev, p),
    handleUploadInBox2:       (ev, p)  => handleUploadInBox2(ev, p),
    handleVideoUploadInBox2:  (ev, p)  => handleVideoUploadInBox2(ev, p),
    handleFileUpload:         (ev, p)  => handleFileUpload(ev, p),
    handleFileUpload2:        (ev, p)  => handleFileUpload2(ev, p),
    handleAudioUpload:        (ev, p)  => handleAudioUpload(ev, p),
    updateModelIcon:          (ev, p)  => updateModelIcon(p, ev.target),
  };

  // -- Delegated click handler --
  document.addEventListener('click', function (e) {
    // Walk up from the event target to find the nearest element with a data attribute
    const actionEl = e.target.closest('[data-action]');
    const triggerEl = e.target.closest('[data-trigger-file]');
    const openUrlEl = e.target.closest('[data-open-url]');

    if (actionEl) {
      const action = actionEl.getAttribute('data-action');
      const param  = actionEl.getAttribute('data-param');
      const param2 = actionEl.getAttribute('data-param2');
      if (actionEl.hasAttribute('data-stop-propagation')) {
        e.stopPropagation();
      }
      const handler = actionHandlers[action];
      if (handler) {
        handler(actionEl, param, param2);
      }
      return;
    }

    if (triggerEl) {
      const targetId = triggerEl.getAttribute('data-trigger-file');
      const fileInput = document.getElementById(targetId);
      if (fileInput) fileInput.click();
      return;
    }

    if (openUrlEl) {
      const url = openUrlEl.getAttribute('data-open-url');
      if (url) window.open(url, '_blank');
      return;
    }
  });

  // -- Delegated change handler --
  document.addEventListener('change', function (e) {
    const el = e.target.closest('[data-onchange]');
    if (!el) return;
    const fnName = el.getAttribute('data-onchange');
    const param  = el.getAttribute('data-param');
    const handler = changeHandlers[fnName];
    if (handler) {
      handler(e, param);
    }
  });
})();

export {};
