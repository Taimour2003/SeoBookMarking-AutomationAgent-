// ==========================================================================
    // STATE
    // ==========================================================================
	    const state = {
	      providers: [],
	      models: [],
	      types: [],
	      currentType: '',
	      currentProvider: null,
	      searchQuery: '',
	      providersExpanded: false,
	    };

    // Provider colors for icons (fallback)
    const PROVIDER_COLORS = {
      'google': '#4285F4',
      'black-forest-labs': '#FF6B35',
      'stability-ai': '#9333EA',
      'bytedance': '#00F2EA',
      'nvidia': '#76B900',
      'minimax': '#FF4081',
      'kwaivgi': '#1DB954',
      'wan-video': '#FF5722',
      'fal-ai': '#06B6D4',
      'openai': '#10A37F',
      'meta': '#0668E1',
      'easel': '#F59E0B',
      'lucataco': '#EC4899',
      'tencentarc': '#1E40AF',
      'cuuupid': '#F43F5E',
      'cjwbw': '#8B5CF6',
      'nightmareai': '#6366F1',
      'bria': '#14B8A6',
      'jagilley': '#F97316',
      'yan-ops': '#EF4444',
      'arielreplicate': '#A855F7',
      'viktorfa': '#22D3EE',
      'luma': '#FF1493',
      'lightricks': '#00CED1',
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

    // ==========================================================================
    // ROUTING
    // ==========================================================================
    function parseRoute() {
      const path = window.location.pathname.replace(/^\/+|\/+$/g, '');
      const parts = path.split('/').filter(Boolean);

      // /models/video, /models/image, etc.
      if (parts[0] === 'models' && parts.length === 2) {
        return { type: 'category', category: parts[1] };
      }

      // Support ?type=video query param (e.g. /models.html?type=video)
      const params = new URLSearchParams(window.location.search);
      const typeParam = params.get('type');
      if (typeParam) {
        return { type: 'category', category: typeParam };
      }

      // /models.html or /models
      if (path === 'models.html' || path === 'models' || path === '') {
        return { type: 'home' };
      }

      return { type: 'home' };
    }

    function navigateTo(path) {
      window.history.pushState({}, '', path);
      handleRoute();
      closeSidebar();
    }

    async function handleRoute() {
      const route = parseRoute();

      if (route.type === 'home') {
        state.currentType = '';
        state.currentProvider = null;
        const typeAllEl = document.getElementById('type-all');
        if (typeAllEl) typeAllEl.checked = true;
        await renderHomePage();
      } else if (route.type === 'category') {
        state.currentType = route.category;
        state.currentProvider = null;
        const typeRadio = document.getElementById(`type-${route.category}`);
        if (typeRadio) typeRadio.checked = true;
        await renderCategoryPage(route.category);
      }
    }

    // ==========================================================================
    // API
    // ==========================================================================
    async function fetchProviders() {
      const res = await fetch('https://aitopia.ai/api/models/owners');
      if (!res.ok) throw new Error(`Failed to load providers: ${res.status}`);
      const data = await res.json();
      return data.owners || [];
    }

    async function fetchTypes() {
      const res = await fetch('https://aitopia.ai/api/models/types');
      if (!res.ok) throw new Error(`Failed to load model types: ${res.status}`);
      const data = await res.json();
      return data.types || [];
    }

	    async function fetchAllModels(shuffle = true) {
	      const params = new URLSearchParams();
	      if (shuffle) params.set('shuffle', 'true');
	      const res = await fetch(`https://aitopia.ai/api/models/all?${params}`);
	      if (!res.ok) throw new Error(`Failed to load models: ${res.status}`);
	      return await res.json();
	    }

	    async function fetchModelsByType(type) {
	      const params = new URLSearchParams();
	      const res = await fetch(`https://aitopia.ai/api/models/types/${type}?${params}`);
	      if (!res.ok) {
	        let data = null;
	        try {
	          data = await res.json();
	        } catch {
	          // ignore
	        }
	        const error = new Error((data && data.error) ? data.error : `Failed to load category: ${res.status}`);
	        error.status = res.status;
	        throw error;
	      }
	      return await res.json();
	    }


    async function renderProviderList() {
      const filtered = state.providers.filter(p => {
        if (state.searchQuery) {
          const q = state.searchQuery.toLowerCase();
          return p.displayName.toLowerCase().includes(q) ||
                 p.models.some(m => (m.displayName || m.id).toLowerCase().includes(q));
        }
        return true;
      });

      const html = filtered.map(provider => `
        <a href="/marketplace/${provider.owner}"
           class="flex items-center gap-2.5 px-1 py-2 rounded-lg text-sm hover:bg-neutral-800/50 transition group">
          ${renderProviderIcon(provider.owner, 'w-5 h-5 text-xs')}
          <span class="truncate flex-1">${provider.displayName}</span>
          <span class="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">${provider.modelCount}</span>
        </a>
      `).join('');

      const providerListEl = document.getElementById('provider-list');
      if (providerListEl) providerListEl.innerHTML = html || '<div class="text-center py-4 text-muted-foreground text-sm">No results</div>';
    }

    // ==========================================================================
    // PROVIDER ICON GENERATOR
    // ==========================================================================
    function renderProviderIcon(owner, sizeClass = 'w-12 h-12 text-xl') {
      const logoUrl = PROVIDER_LOGOS[owner];
      const color = PROVIDER_COLORS[owner] || getRandomColor(owner);
      const initial = owner.charAt(0).toUpperCase();

      // If we have a logo URL, use an image
      if (logoUrl) {
        return `
          <div class="${sizeClass} rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden bg-neutral-800">
            <img src="${logoUrl}" alt="${formatOwnerName(owner)}" class="w-full h-full object-cover"
              data-fallback-initial="${initial}" data-fallback-color="${color}">
          </div>
        `;
      }

      // Fallback to colored initial
      return `
        <div class="${sizeClass} rounded-xl flex items-center justify-center flex-shrink-0" style="background: ${color}">
          <span class="font-bold">${initial}</span>
        </div>
      `;
    }

    function getRandomColor(str) {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
      }
      const colors = ['#EF4444', '#F97316', '#F59E0B', '#84CC16', '#22C55E', '#14B8A6', '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#EC4899'];
      return colors[Math.abs(hash) % colors.length];
    }

    // ==========================================================================
    // RENDER PAGES
    // ==========================================================================
    async function renderHomePage() {
      document.title = 'AI Models - AITOPIA';

      // Show providers grid + all models
      const visibleProviders = state.providersExpanded ? state.providers : state.providers.slice(0, 9);
      const remainingCount = state.providers.length - 9;

      let filteredModels = state.models;
      if (state.searchQuery) {
        const q = state.searchQuery.toLowerCase();
        filteredModels = state.models.filter(m =>
          (m.displayName || m.id).toLowerCase().includes(q) ||
          m.id.toLowerCase().includes(q)
        );
      }

      const html = `

        <!-- Page Header -->
        <div class="mb-6">
          <div class="flex items-center justify-between mb-2">
            <h1 class="text-2xl font-bold">AI Models</h1>
            <span class="text-sm text-muted-foreground">${state.models.length} models</span>
          </div>
          <p class="text-muted-foreground">Browse and run AI models from top providers</p>
        </div>

        <!-- Providers Grid -->
        <section class="mb-8">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-semibold">Model Providers</h2>
            ${remainingCount > 0 ? `
              <button data-action="toggleProvidersExpanded" class="text-sm text-primary-400 hover:text-primary-300 transition">
                ${state.providersExpanded ? 'Show less' : `Show all ${state.providers.length} providers`}
              </button>
            ` : ''}
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4" id="providers-grid">
            ${visibleProviders.map(p => renderProviderCard(p)).join('')}
          </div>
          ${!state.providersExpanded && remainingCount > 0 ? `
            <button data-action="toggleProvidersExpanded" class="mt-4 w-full py-3 border border-border rounded-xl text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors flex items-center justify-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
              </svg>
              Show ${remainingCount} more providers
            </button>
          ` : ''}
        </section>

        <!-- All Models -->
        <section>
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-semibold">All Models</h2>
            <span class="text-sm text-muted-foreground">${filteredModels.length} models</span>
          </div>
          ${filteredModels.length > 0 ? `
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              ${filteredModels.map(m => renderModelCard(m)).join('')}
            </div>
          ` : `
            <div class="text-center py-12 text-muted-foreground">
              No models match your search
            </div>
          `}
        </section>
      `;

      const mainContentEl = document.getElementById('main-content');
      if (mainContentEl) mainContentEl.innerHTML = html;
    }

    async function renderCategoryPage(type) {
      try {
        const data = await fetchModelsByType(type);
        document.title = `${data.displayName} - AITOPIA`;

        let filteredModels = data.models;
        if (state.searchQuery) {
          const q = state.searchQuery.toLowerCase();
          filteredModels = data.models.filter(m =>
            (m.displayName || m.id).toLowerCase().includes(q) ||
            m.id.toLowerCase().includes(q)
          );
        }

        const html = `
          <!-- Page Header -->
          <div class="mb-6">
            <a href="/aitopia/marketplace/models.html" class="text-sm text-muted-foreground hover:text-foreground transition mb-3 inline-block">
              ← All Models
            </a>
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <span class="text-2xl">${data.icon}</span>
                <h1 class="text-2xl font-bold">${data.displayName}</h1>
              </div>
              <span class="text-sm text-muted-foreground">${filteredModels.length} models</span>
            </div>
            <p class="text-muted-foreground">${data.description}</p>
          </div>

          <!-- Models Grid -->
          <section>
            ${filteredModels.length > 0 ? `
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                ${filteredModels.map(m => renderModelCard(m)).join('')}
              </div>
            ` : `
              <div class="text-center py-12 text-gray-500">
                No models match your search
              </div>
            `}
          </section>
        `;

        const mcEl = document.getElementById('main-content');
        if (mcEl) mcEl.innerHTML = html;
      } catch (err) {
        const status = err && typeof err === 'object' && 'status' in err ? err.status : null;
        const mcEl = document.getElementById('main-content');

        if (status === 404) {
          if (mcEl) mcEl.innerHTML = `
            <div class="text-center py-20">
              <div class="text-6xl mb-4">😕</div>
              <h2 class="text-2xl font-bold mb-2">Category Not Found</h2>
              <p class="text-muted-foreground mb-4">"${type}" is not a valid category.</p>
              <a href="/aitopia/marketplace/models.html" class="text-primary hover:underline">← Back to all models</a>
            </div>
          `;
          return;
        }

        console.error('Category load error:', err);
        if (mcEl) mcEl.innerHTML = `
          <div class="text-center py-20">
            <div class="text-6xl mb-4">😕</div>
            <h2 class="text-2xl font-bold mb-2">Failed to Load</h2>
            <p class="text-muted-foreground mb-4">Could not load models. Is the API server running?</p>
            <button data-action="locationReload" class="px-4 py-2 bg-primary-600 rounded-lg hover:bg-primary-700 transition">
              Retry
            </button>
          </div>
        `;
      }
    }

    // ==========================================================================
    // RENDER COMPONENTS
    // ==========================================================================
    function renderProviderCard(provider) {
      return `
        <a href="/marketplace/${provider.owner}" class="provider-card bg-card border border-border rounded-2xl p-5 hover:shadow-lg transition-all">
          <div class="flex items-center gap-4">
            ${renderProviderIcon(provider.owner, 'w-14 h-14 text-2xl')}
            <div class="flex-1 min-w-0">
              <h3 class="font-semibold text-base truncate">${provider.displayName}</h3>
              <p class="text-sm text-muted-foreground">${provider.modelCount} models</p>
            </div>
          </div>
        </a>
      `;
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

	    function renderModelCard(model) {
      const owner = model.id.split('/')[0];
      const modelName = model.id.split('/').slice(1).join('/');
      const coverUrl = model.coverImageUrl;
      const isVideo = coverUrl && (coverUrl.includes('.mp4') || coverUrl.includes('.webm') || coverUrl.includes('video'));
      const runCount = model.runCount ? formatRunCount(model.runCount) : null;
      const modelUrl = buildPublicModelUrl(model.id);

      return `
        <a href="${modelUrl}" class="model-card bg-card border border-border rounded-2xl overflow-hidden group hover:shadow-lg transition-all">
          <!-- Thumbnail -->
          <div class="model-thumbnail aspect-video bg-muted relative overflow-hidden">
            ${coverUrl ? `
              ${isVideo ? `
                <video src="${coverUrl}" class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition video-hover-play" muted loop playsinline></video>
              ` : `
                <img src="${coverUrl}" alt="${model.displayName || modelName}" class="w-full h-full object-cover"
                  data-hide-on-error>
              `}
            ` : `
              <div class="w-full h-full flex items-center justify-center">
                ${renderProviderIcon(owner, 'w-16 h-16 text-2xl')}
              </div>
            `}
            <!-- Type Badge -->
            ${model.mediaType ? `
              <span class="absolute top-2 left-2 px-2 py-0.5 text-xs font-medium bg-black/60 text-white rounded-full capitalize">
                ${model.mediaType}
              </span>
            ` : ''}
          </div>

          <!-- Info -->
          <div class="p-4">
            <div class="flex items-start justify-between gap-2 mb-2">
              <h3 class="font-semibold text-sm line-clamp-1 group-hover:text-primary-400 transition">
                ${model.displayName || modelName}
              </h3>
              ${model.recommended ? `
                <span class="flex-shrink-0 w-2 h-2 rounded-full bg-primary-500" title="Recommended"></span>
              ` : ''}
            </div>
            <div class="flex items-center gap-2 text-xs text-muted-foreground mb-3">
              ${renderProviderIcon(owner, 'w-4 h-4 text-[8px]')}
              <span class="truncate">${formatOwnerName(owner)}</span>
              ${runCount ? `
                <span class="text-muted-foreground/50">•</span>
                <span>${runCount} runs</span>
              ` : ''}
            </div>
            <div class="flex items-center justify-between">
	              <span class="text-xs text-green-400 font-medium">${formatCredits(model.cost)}</span>
	            </div>
	          </div>
	        </a>
	      `;
	    }

    // ==========================================================================
    // HELPERS
    // ==========================================================================
    function toggleProvidersExpanded() {
      state.providersExpanded = !state.providersExpanded;
      renderHomePage();
    }
    window.toggleProvidersExpanded = toggleProvidersExpanded;

	    function formatOwnerName(owner) {
      const names = {
        'google': 'Google',
        'black-forest-labs': 'Black Forest Labs',
        'stability-ai': 'Stability AI',
        'wan-video': 'Wan Video',
        'bytedance': 'ByteDance',
        'nvidia': 'NVIDIA',
        'minimax': 'Minimax',
        'kwaivgi': 'Kuaishou (Kling)',
        'fal-ai': 'FAL',
        'openai': 'OpenAI',
        'meta': 'Meta',
      };
      return names[owner] || owner.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
	    }

	    const DOLLARS_PER_CREDIT = 0.02;
      const MIN_CREDITS_PER_RUN = 1;
	    const DEFAULT_ESTIMATE_SECONDS = 4;

	    function creditsFromDollars(dollars) {
	      const safe = Number(dollars);
	      if (!Number.isFinite(safe) || safe <= 0) return MIN_CREDITS_PER_RUN;
	      return Math.max(MIN_CREDITS_PER_RUN, Math.ceil(safe / DOLLARS_PER_CREDIT));
	    }

	    function formatCredits(cost) {
	      if (!cost) return 'Credits vary';
	      if (typeof cost.perSecond === 'number' && Number.isFinite(cost.perSecond)) {
	        const credits = creditsFromDollars(cost.perSecond * DEFAULT_ESTIMATE_SECONDS);
	        return `~${credits} credits (${DEFAULT_ESTIMATE_SECONDS}s)`;
	      }
	      if (typeof cost.perOutput === 'number' && Number.isFinite(cost.perOutput)) {
	        const credits = creditsFromDollars(cost.perOutput);
	        return `${credits} credits`;
	      }
	      return 'Credits vary';
	    }

    function formatRunCount(count) {
      if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
      if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
      return count.toString();
    }

	    // ==========================================================================
	    // EVENT LISTENERS
	    // ==========================================================================
    document.getElementById('search-input')?.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      renderProviderList();
      handleRoute();
    });

	    // Type filter change
	    document.querySelectorAll('input.filter-radio[name="type"]').forEach(radio => {
	      radio.addEventListener('change', (e) => {
        const type = e.target.value;
        if (type) {
          navigateTo(`/models/${type}`);
        } else {
          navigateTo('/aitopia/marketplace/models.html');
        }
      });
    });

    // Mobile filter button is added dynamically in renderHomePage/renderCategoryPage

    window.addEventListener('popstate', handleRoute);

    // ==========================================================================
    // INIT
    // ==========================================================================
    async function init() {
      try {
        // Read search from URL 
        const urlParams = new URLSearchParams(window.location.search);
        state.searchQuery = urlParams.get('search') || '';
        const searchEl = document.getElementById('search-input');
        if (searchEl) searchEl.value = state.searchQuery;

        // Fetch all data in parallel
        const [providers, types, modelsData] = await Promise.all([
          fetchProviders(),
          fetchTypes(),
          fetchAllModels(true),
        ]);

        state.providers = providers;
        state.types = types;
        state.models = modelsData.models || [];

        // Render sidebar
        renderProviderList();

        // Handle initial route
        handleRoute();
      } catch (err) {
        console.error('Init error:', err);
        const mcEl = document.getElementById('main-content');
        if (mcEl) mcEl.innerHTML = `
          <div class="text-center py-20">
            <div class="text-6xl mb-4">😕</div>
            <h2 class="text-2xl font-bold mb-2">Failed to Load</h2>
            <p class="text-muted-foreground mb-4">Could not load models. Please try again.</p>
            <button data-action="locationReload" class="px-4 py-2 bg-primary-600 rounded-lg hover:bg-primary-700 transition">
              Retry
            </button>
          </div>
        `;
      }
    }

    // Event delegation handled by csp-event-handlers.js (capture phase)
    // Functions exposed on window: toggleProvidersExpanded, locationReload

    // Image error fallback delegation
    document.addEventListener('error', function(e) {
      const el = e.target;
      if (el.tagName === 'IMG' && el.hasAttribute('data-fallback-initial')) {
        el.style.display = 'none';
        const p = el.parentElement;
        if (p) {
          p.innerHTML = '<span class="font-bold text-white">' + el.dataset.fallbackInitial + '</span>';
          p.style.background = el.dataset.fallbackColor;
        }
      } else if (el.tagName === 'IMG' && el.hasAttribute('data-hide-on-error')) {
        el.style.display = 'none';
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

    init();