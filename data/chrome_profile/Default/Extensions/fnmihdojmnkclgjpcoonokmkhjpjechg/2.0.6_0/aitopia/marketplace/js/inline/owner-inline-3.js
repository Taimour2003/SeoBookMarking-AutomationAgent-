let allModels = [];
let owner = '';
let ownerDisplayName = '';
let currentCategoryFilter = 'all';

const USD_PER_CREDIT = 0.02;
const DEFAULT_ESTIMATE_SECONDS = 4;

function creditsFromUsd(usd) {
  const safe = Math.max(0, Number(usd) || 0);
  if (safe === 0) return 0;
  return Math.max(1, Math.ceil(safe / USD_PER_CREDIT));
}

function formatCredits(cost) {
  if (!cost) return 'Credits vary';
  if (typeof cost.perSecond === 'number' && Number.isFinite(cost.perSecond)) {
    const credits = creditsFromUsd(cost.perSecond * DEFAULT_ESTIMATE_SECONDS);
    if (credits === 0) return '0 credits';
    return `~${credits} credits (${DEFAULT_ESTIMATE_SECONDS}s)`;
  }
  if (typeof cost.perOutput === 'number' && Number.isFinite(cost.perOutput)) {
    const credits = creditsFromUsd(cost.perOutput);
    return `${credits} credits`;
  }
  return 'Credits vary';
}

function buildPublicModelUrl(modelId) {
  const normalized = String(modelId || '').trim();
  if (!normalized) return '/aitopia/marketplace/models.html';
  const slashIndex = normalized.indexOf('/');
  if (slashIndex === -1) return `/models?search=${encodeURIComponent(normalized)}`;
  const owner = normalized.slice(0, slashIndex);
  const model = normalized.slice(slashIndex + 1);
  if (!owner || !model) {
    return `/models?search=${encodeURIComponent(normalized)}`;
  }
  if (model.includes('/')) {
    return `/${encodeURIComponent(owner)}/${model.split('/').map((segment) => encodeURIComponent(segment)).join('/')}`;
  }
  return `/${encodeURIComponent(owner)}/${encodeURIComponent(model)}`;
}

// Owner colors/logos mapping (fallback gradients)
const ownerConfig = {
  'google': { gradient: 'from-blue-500 to-green-500', logo: 'G' },
  'bytedance': { gradient: 'from-pink-500 to-red-500', logo: 'B' },
  'stability-ai': { gradient: 'from-primary/90 to-pink-500', logo: 'S' },
  'black-forest-labs': { gradient: 'from-emerald-500 to-teal-500', logo: 'BFL' },
  'nvidia': { gradient: 'from-green-600 to-lime-500', logo: 'N' },
  'wan-video': { gradient: 'from-orange-500 to-yellow-500', logo: 'W' },
  'minimax': { gradient: 'from-blue-500 to-cyan-500', logo: 'M' },
  'kwaivgi': { gradient: 'from-rose-500 to-orange-500', logo: 'K' },
  'meta': { gradient: 'from-blue-600 to-indigo-600', logo: 'M' },
  'openai': { gradient: 'from-emerald-500 to-green-500', logo: 'O' },
  'easel': { gradient: 'from-violet-500 to-primary/90', logo: 'E' },
  'fal-ai': { gradient: 'from-amber-500 to-orange-500', logo: 'F' }
};

// Provider logo URLs (crawled from Replicate)
const PROVIDER_LOGOS = {
  'google': 'https://tjzk.replicate.delivery/models_organizations_avatar/27e1e3fe-f766-4748-83b3-777bc282d8dd/1342004.png',
  'stability-ai': 'https://github.com/stability-ai.png',
  'black-forest-labs': 'https://tjzk.replicate.delivery/models_organizations_avatar/01ed70be-0d47-4a4a-85fb-32c02cdd4ab5/bfl.png',
  'bytedance': 'https://github.com/bytedance.png',
  'nvidia': 'https://tjzk.replicate.delivery/models_organizations_avatar/8e143283-55a9-4a67-a949-5b599abb62d0/NVIDIA-logo-white-16x9.png',
  'meta': 'https://github.com/facebookresearch.png',
  'minimax': 'https://tjzk.replicate.delivery/models_organizations_avatar/7fdef700-78e0-418d-b804-4b61ef4efc5e/130440902.png',
  'kwaivgi': 'https://github.com/kwaivgi.png',
  'luma': 'https://github.com/lumalabs.png',
  'lightricks': 'https://github.com/lightricks.png',
  'wan-video': 'https://tjzk.replicate.delivery/models_organizations_avatar/3f376d34-057f-4002-9c23-911959d60460/200620180.png',
  'lucataco': 'https://github.com/lucataco.png',
  'tencentarc': 'https://github.com/tencentarc.png',
  'nightmareai': 'https://github.com/nightmareai.png',
  'easel': 'https://tjzk.replicate.delivery/models_organizations_avatar/ef2835d0-a0dd-429e-b180-d87252570d55/easel_ai_inc_logo.jpg',
  'cuuupid': 'https://github.com/cuuupid.png',
  'jagilley': 'https://github.com/jagilley.png',
  'yan-ops': 'https://github.com/yan-Ops.png',
  'viktorfa': 'https://github.com/viktorfa.png',
};

// Category to capability mapping
const categoryCapabilities = {
  'image': ['image-generation', 'image-editing', 'inpainting', 'image-variation', 'background-removal', 'background-generation', 'image-upscaling', 'face-swap', 'face-restoration', 'style-transfer', 'sketch-to-image', 'object-removal', 'virtual-try-on', 'edge-guided-generation', 'depth-guided-generation', 'headshot-generation', 'product-photography', 'ad-generation', 'thumbnail-generation', 'camera-angles', 'lora-generation', '3d-generation', 'model-training'],
  'video': ['video-generation', 'image-to-video', 'video-upscaling', 'video-face-swap', 'video-background-removal', 'sound-to-video', 'character-animation', 'lip-sync', 'video-processing', 'custom-image-to-video'],
  'audio': ['text-to-speech', 'voice-cloning', 'music-generation', 'audio-generation', 'speech-to-text', 'audio-processing'],
  'text': ['text-generation', 'vision-language', 'embeddings', 'safety-moderation']
};

// Parse owner from URL
function parseOwnerFromUrl() { const p = new URLSearchParams(window.location.search); if (p.get('owner')) return p.get('owner'); return null; }

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  owner = parseOwnerFromUrl();

  if (!owner) {
    showError('No owner specified');
    return;
  }

  // Setup filter tabs
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentCategoryFilter = tab.dataset.filter;
      renderModels();
    });
  });

  await loadModels();
});

// Load models for owner
async function loadModels() {
  try {
    const response = await fetch(`https://aitopia.ai/api/models/owners/${owner}`);
    if (!response.ok) {
      if (response.status === 404) {
        showError(`No models found for ${owner}`);
        return;
      }
      throw new Error('Failed to fetch models');
    }

    const data = await response.json();

    // Models already filtered and sorted by the API
    allModels = data.models || [];

    if (allModels.length === 0) {
      showError(`No models found for ${owner}`);
      return;
    }

    // Store owner display name from API
    ownerDisplayName = data.displayName || owner;

    // Update UI
    updateOwnerUI();
    renderModels();

    document.getElementById('loadingState')?.classList.add('hidden');
    document.getElementById('content')?.classList.remove('hidden');

  } catch (error) {
    showError(error.message);
  }
}

function showError(message) {
  document.getElementById('loadingState')?.classList.add('hidden');
  document.getElementById('errorState')?.classList.remove('hidden');
  const el = document.getElementById('errorMessage');
  if (el) el.textContent = message;
}

function updateOwnerUI() {
  const displayName = ownerDisplayName || owner;
  document.title = `${displayName} - AITOPIA Models`;
  const breadcrumbEl = document.getElementById('breadcrumbOwner');
  if (breadcrumbEl) breadcrumbEl.textContent = displayName;
  const ownerNameEl = document.getElementById('ownerName');
  if (ownerNameEl) ownerNameEl.textContent = displayName;
  const modelCountEl = document.getElementById('modelCount');
  if (modelCountEl) modelCountEl.textContent = `${allModels.length} model${allModels.length !== 1 ? 's' : ''} available`;

  // Set icon - use actual logo if available
  const logoUrl = PROVIDER_LOGOS[owner];
  const config = ownerConfig[owner] || { gradient: 'from-primary/90 to-indigo-600', logo: displayName.charAt(0).toUpperCase() };
  const iconEl = document.getElementById('ownerIcon');

  if (iconEl && logoUrl) {
    iconEl.className = `w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 shadow-lg bg-muted`;
    iconEl.innerHTML = `<img src="${logoUrl}" alt="${displayName}" class="w-full h-full object-cover" data-fallback-initial="${config.logo}" data-fallback-gradient="${config.gradient}">`;
  } else if (iconEl) {
    iconEl.className = `w-20 h-20 rounded-2xl bg-gradient-to-br ${config.gradient} flex items-center justify-center flex-shrink-0 text-2xl font-bold shadow-lg`;
    iconEl.textContent = config.logo;
  }
}

function getModelCategory(capabilities) {
  if (!capabilities || capabilities.length === 0) return 'other';

  for (const [category, caps] of Object.entries(categoryCapabilities)) {
    if (capabilities.some(c => caps.includes(c))) {
      return category;
    }
  }
  return 'other';
}

function renderModels() {
  let filtered = allModels;

  // Category filter
  if (currentCategoryFilter !== 'all') {
    filtered = filtered.filter(m => {
      const category = getModelCategory(m.capabilities);
      return category === currentCategoryFilter;
    });
  }

  // Update count
  const filteredCountEl = document.getElementById('filteredCount');
  if (filteredCountEl) filteredCountEl.textContent = filtered.length;

  const grid = document.getElementById('modelsGrid');
  const emptyState = document.getElementById('emptyState');

  if (filtered.length === 0) {
    grid?.classList.add('hidden');
    emptyState?.classList.remove('hidden');
    return;
  }

  grid?.classList.remove('hidden');
  emptyState?.classList.add('hidden');

  if (!grid) return;
  grid.innerHTML = filtered.map(model => {
    const [modelOwner, modelName] = model.id.split('/');
    const modelUrl = buildPublicModelUrl(model.id);
    const costText = formatCredits(model.cost);
    const costClass = costText === 'Credits vary'
      ? 'text-muted-foreground'
      : costText.startsWith('~')
        ? 'text-yellow-400'
        : 'text-green-400';

    const capability = model.capabilities?.[0] || '';
    const category = getModelCategory(model.capabilities);
    const coverUrl = model.coverImageUrl;
    const isVideo = coverUrl && (coverUrl.includes('.mp4') || coverUrl.includes('.webm'));

    // Generate placeholder gradient based on model name
    const placeholderGradients = [
      'from-primary/90 to-blue-600',
      'from-pink-600 to-primary/90',
      'from-blue-600 to-cyan-600',
      'from-green-600 to-teal-600',
      'from-orange-600 to-red-600',
      'from-indigo-600 to-primary/90'
    ];
    const gradientIndex = model.id.length % placeholderGradients.length;
    const placeholderGradient = placeholderGradients[gradientIndex];

    return `
      <a href="${modelUrl}" class="model-card block bg-card border border-border rounded-ios-xl overflow-hidden hover:shadow-lg group transition-all">
        <!-- Cover Image -->
        <div class="aspect-[16/10] bg-muted overflow-hidden relative">
          ${coverUrl ? (isVideo ? `
            <video src="${coverUrl}" class="model-image w-full h-full object-cover video-hover-play" muted loop playsinline></video>
          ` : `
            <img src="${coverUrl}" alt="${model.displayName || modelName}" class="model-image w-full h-full object-cover"
              data-hide-on-error data-show-next-sibling>
            <div class="hidden absolute inset-0 bg-gradient-to-br ${placeholderGradient} items-center justify-center">
              ${getModelIcon(category)}
            </div>
          `) : `
            <div class="absolute inset-0 bg-gradient-to-br ${placeholderGradient} flex items-center justify-center">
              ${getModelIcon(category)}
            </div>
          `}

	          <!-- Recommended Badge -->
	          ${model.recommended ? `
            <div class="absolute top-3 left-3">
              <span class="px-2.5 py-1 text-xs font-semibold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-full backdrop-blur-sm flex items-center gap-1">
                <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                </svg>
                Recommended
              </span>
            </div>
          ` : ''}
        </div>

        <!-- Content -->
        <div class="p-4">
          <h3 class="font-semibold group-hover:text-primary transition-colors mb-1 truncate">${model.displayName || modelName}</h3>
          <p class="text-sm text-muted-foreground font-mono truncate mb-3">${model.id}</p>

          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              ${capability ? `<span class="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">${formatCapability(capability)}</span>` : ''}
            </div>
	            ${costText ? `<span class="text-sm font-medium ${costClass}">${costText}</span>` : ''}
	          </div>
	        </div>
	      </a>
    `;
  }).join('');
}

function getModelIcon(category) {
  const icons = {
    'video': `<svg class="w-12 h-12 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
    </svg>`,
    'audio': `<svg class="w-12 h-12 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z"/>
    </svg>`,
    'text': `<svg class="w-12 h-12 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
    </svg>`,
    'image': `<svg class="w-12 h-12 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
    </svg>`
  };
  return icons[category] || icons['image'];
}

function formatCapability(capability) {
  return capability.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function resetFilters() {
  currentCategoryFilter = 'all';
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  document.querySelector('[data-filter="all"]')?.classList.add('active');
  renderModels();
}

// CSP-safe event delegation
document.addEventListener('click', function(e) {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  if (el.dataset.action === 'resetFilters') resetFilters();
});

// Image error fallback delegation
document.addEventListener('error', function(e) {
  const el = e.target;
  if (el.tagName === 'IMG' && el.hasAttribute('data-fallback-initial')) {
    el.style.display = 'none';
    const p = el.parentElement;
    if (p) {
      p.className = 'w-20 h-20 rounded-2xl bg-gradient-to-br ' + el.dataset.fallbackGradient + ' flex items-center justify-center flex-shrink-0 text-2xl font-bold shadow-lg';
      p.textContent = el.dataset.fallbackInitial;
    }
  } else if (el.tagName === 'IMG' && el.hasAttribute('data-hide-on-error')) {
    el.style.display = 'none';
    if (el.hasAttribute('data-show-next-sibling') && el.nextElementSibling) {
      el.nextElementSibling.style.display = 'flex';
    }
  }
}, true);

// Video hover play delegation
document.addEventListener('mouseenter', function(e) {
  if (e.target.classList && e.target.classList.contains('video-hover-play')) {
    e.target.play();
  }
}, true);
document.addEventListener('mouseleave', function(e) {
  if (e.target.classList && e.target.classList.contains('video-hover-play')) {
    e.target.pause();
    e.target.currentTime = 0;
  }
}, true);