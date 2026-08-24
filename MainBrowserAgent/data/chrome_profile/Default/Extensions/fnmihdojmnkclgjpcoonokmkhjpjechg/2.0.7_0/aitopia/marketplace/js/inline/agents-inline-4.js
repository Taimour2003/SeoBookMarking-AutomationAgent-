// ============================================================================
    // MOBILE GRID LAYOUT (CSS handles the 2-column grid with square images)
    // ============================================================================

    function applyMasonryLayout(container) {
      
    }

    // ============================================================================
    // PRICING CONFIGURATION
    // ============================================================================
    const PRICING = {
      dollarsPerCredit: 0.02,
      minCreditsPerRun: 1,
    };

    // ============================================================================
    // CANONICAL CATEGORIES (align with /category/:slug and store.html)
    // ============================================================================
    const CANONICAL_CATEGORY_DEFS = [
      { slug: 'image', name: 'Image', description: 'AI image generation, editing, and enhancement tools', primaryCategories: ['image'] },
      { slug: 'video', name: 'Video', description: 'AI video creation, editing, and effects', primaryCategories: ['video'] },
      { slug: 'audio', name: 'Audio & Voice', description: 'Voice synthesis, music, and audio processing', primaryCategories: ['audio-voice'] },
      { slug: 'productivity', name: 'Productivity', description: 'Writing, utilities, translation, and productivity tools', primaryCategories: ['productivity', 'education', 'travel'] },
      { slug: 'marketing', name: 'Marketing', description: 'Social media, ads, and marketing content', primaryCategories: ['marketing-social'] },
      { slug: 'commerce', name: 'Commerce', description: 'E-commerce, product photos, and website tools', primaryCategories: ['commerce-websites'] },
      { slug: 'dev', name: 'Dev & Data', description: 'Development tools and data analysis', primaryCategories: ['dev-data', 'models'] },
      { slug: 'business', name: 'Business', description: 'Finance, operations, and customer support tools', primaryCategories: ['business', 'sales-support', 'industry-packs'] },
    ];

    const CATEGORY_SLUG_REDIRECTS = {
      // Legacy -> canonical
      analytics: 'dev',
      ecommerce: 'commerce',
      creative: 'image',
      translation: 'productivity',
      content: 'marketing',
      marketing: 'marketing',
      productivity: 'productivity',
      business: 'business',

      // Primary -> canonical
      'audio-voice': 'audio',
      'marketing-social': 'marketing',
      'commerce-websites': 'commerce',
      'dev-data': 'dev',
      'sales-support': 'business',
      travel: 'productivity',
      education: 'productivity',
      'industry-packs': 'business',
      models: 'dev',

      // Primary snake_case aliases
      audio_voice: 'audio',
      marketing_social: 'marketing',
      commerce_websites: 'commerce',
      dev_data: 'dev',
      sales_support: 'business',
      industry_packs: 'business',

      // Higgsfield legacy categories
      'higgsfield-image': 'image',
      'higgsfield-video': 'video',
      'higgsfield-audio': 'audio',
      'higgsfield-ai': 'productivity',
    };

    const CANONICAL_CATEGORY_SET = new Set(CANONICAL_CATEGORY_DEFS.map(d => d.slug));
    const CANONICAL_CATEGORY_NAME = Object.fromEntries(CANONICAL_CATEGORY_DEFS.map(d => [d.slug, d.name]));

    function normalizeCategorySlug(slug) {
      return String(slug || '').trim().toLowerCase();
    }

    function resolveCanonicalCategorySlug(rawSlug) {
      const slug = normalizeCategorySlug(rawSlug);
      if (!slug) return null;
      if (CANONICAL_CATEGORY_SET.has(slug)) return slug;
      return CATEGORY_SLUG_REDIRECTS[slug] || null;
    }

    function getAgentCanonicalCategories(agent) {
      const candidates = [
        agent.primaryCategory,
        ...(agent.additionalCategories || []),
        agent.categoryKey,
        agent.category,
      ].filter(Boolean);

      const canonical = new Set();
      for (const c of candidates) {
        const resolved = resolveCanonicalCategorySlug(c);
        if (resolved) canonical.add(resolved);
      }
      return [...canonical];
    }

    // ============================================================================
    // POPULARITY RANKING (static for MVP)
    // ============================================================================
    const POPULAR_AGENTS = [
      'background-remover', 'face-swap', 'virtual-try-on', 'image-upscaler',
      'ai-background-generator',
      'image-generator', 'chibi-sticker-maker', 'product-description-writer',
      'social-media-caption-generator', 'seo-content-optimizer', 'image-translator',
      'video-generator', 'voice-cloner', 'meeting-transcriber',
      'email-template-generator', 'resume-builder', 'smart-data-analyzer'
    ];

    // ============================================================================
    // STATE
    // ============================================================================
    const state = {
      category: 'all',
      search: '',
      sort: 'popular',
      inputTypes: new Set(),
      platforms: new Set(),
      industries: new Set(),
      channels: new Set(),
      models: new Set(),
      providers: new Set(),
    };

    let allAgents = [];
    let categories = [];
    let tagBuckets = null;

    // Canonical to primary category mapping (handles URL params from store.html)
    const CANONICAL_TO_PRIMARY = {
      'commerce': 'commerce-websites',
      'marketing': 'marketing-social',
      'audio': 'audio-voice',
      'dev': 'dev-data',
      // Direct mappings (already primary IDs)
      'image': 'image',
      'video': 'video',
      'productivity': 'productivity',
      'business': 'business',
      'travel': 'travel',
      'education': 'education',
      'sales-support': 'sales-support',
      'industry-packs': 'industry-packs',
      'models': 'models',
    };

    // Resolve canonical category to primary category ID
    function resolveToPrimary(category) {
      if (!category || category === 'all') return 'all';
      const lower = category.toLowerCase();
      return CANONICAL_TO_PRIMARY[lower] || lower;
    }

    // Filter icons mapping
    const filterIcons = {
      // Platforms
      'shopify': '🛍️', 'wordpress': '📝', 'woocommerce': '🛒', 'magento': '🏪',
      'bigcommerce': '📦', 'squarespace': '◼️', 'wix': '✨', 'api': '🔌',
      'zendesk': '📱', 'intercom': '📱', 'freshdesk': '📱', 'n8n': '📱',
      // Industries/Verticals
      'ecommerce-brand': '🛒', 'gaming-creator': '🎮', 'ads-agency': '📣',
      'education-training': '📚', 'real-estate': '🏠', 'fashion': '👗',
      'beauty': '💄', 'sports': '⚽', 'food': '🍕', 'automotive': '🚗',
      'healthcare': '🏥', 'finance': '💰', 'entertainment': '🎭',
      'travel': '✈️', 'tech': '💻', 'retail': '🏬', 'hospitality': '🏨',
      // Social Channels
      'instagram': '📸', 'tiktok': '🎵', 'youtube': '▶️', 'twitter': '🐦',
      'facebook': '👍', 'linkedin': '💼', 'pinterest': '📌', 'snapchat': '👻',
      'x': '📱', 'reddit': '📱',
      // AI Models
      'flux': '✨', 'stable-diffusion': '🎨', 'dall-e': '🖌️', 'midjourney': '🌈',
      'runway': '🎬', 'replicate': '🔄', 'claude': '📱', 'gpt': '📱',
      'sdxl': '📱', 'dalle': '📱', 'google-imagen': '📱', 'imagen-4': '📱',
      'imagen-3': '📱', 'gemini-flash': '📱',
      // Providers
      'fal': '📱', 'openai': '🤖', 'anthropic': '🧠', 'elevenlabs': '🎙️',
      'default': '📱'
    };

    function getFilterIcon(slug) {
      return filterIcons[slug?.toLowerCase()] || filterIcons['default'];
    }

    function formatTag(tag) {
      return tag.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }

    // ============================================================================
    // DATA LOADING
    // ============================================================================
    async function loadData() {
      try {
        const [showcaseResult, storeResult, categoriesResult] = await Promise.allSettled([
          fetch('https://aitopia.ai/agent-showcase-data.json'),
          fetch('https://aitopia.ai/api/store'),
          fetch('https://aitopia.ai/api/store/categories')
        ]);

        if (showcaseResult.status !== 'fulfilled') {
          throw showcaseResult.reason;
        }
        if (!showcaseResult.value.ok) {
          throw new Error(`Failed to load showcase agents: ${showcaseResult.value.status}`);
        }

        const showcaseAgentsRaw = await showcaseResult.value.json();
        const showcaseAgents = Array.isArray(showcaseAgentsRaw) ? showcaseAgentsRaw : [];

        let storeAgents = [];
        if (storeResult.status === 'fulfilled' && storeResult.value.ok) {
          const storeData = await storeResult.value.json();
          storeAgents = Array.isArray(storeData?.agents) ? storeData.agents : [];
        } else {
          console.warn('Store API unavailable; showing showcase agents only.');
        }

        if (categoriesResult.status === 'fulfilled' && categoriesResult.value.ok) {
          const categoriesData = await categoriesResult.value.json();
          categories = Array.isArray(categoriesData?.categories) ? categoriesData.categories : [];
          tagBuckets = categoriesData?.tagBuckets || null;
        } else {
          categories = [];
          tagBuckets = null;
        }

        // Create lookup maps
        const storeMap = new Map(storeAgents.map(a => [a.id, a]));
        const showcaseIds = new Set(showcaseAgents.map(s => s.id));

        // Merge: store base + showcase visuals overlay (showcase visuals)
        const agents = showcaseAgents.map(showcase => {
          const store = storeMap.get(showcase.id);
          return {
            ...showcase,
            ...store,  // Store data wins for overlapping fields
            // Keep showcase visuals
            icon: showcase.icon || store?.icon,
            showcase_images: showcase.showcase_images || store?.showcase_images,
            showcase_videos: showcase.showcase_videos || store?.showcase_videos,
            featured_video: showcase.featured_video || store?.featured_video,
          };
        });

        // Add store-only agents not in showcase (with fallback visuals)
        for (const store of storeAgents) {
          if (!showcaseIds.has(store.id)) {
            agents.push({
              ...store,
              icon: null,
              image: null,  // Will use gradient fallback in UI
            });
          }
        }

        return agents;
      } catch (err) {
        console.error('Failed to load agents:', err);
        return [];
      }
    }

    // ============================================================================
    // PRICE FORMATTING
    // ============================================================================
    function formatAgentPrice(agent) {
      const cost = agent.costEstimate;
      if (!cost || cost.minCost === undefined) return '\u2014';  // Em dash for missing

      const safeDollarsPerCredit = Number(PRICING.dollarsPerCredit) > 0 ? Number(PRICING.dollarsPerCredit) : 0.02;
      const minCredits = Math.max(PRICING.minCreditsPerRun, Math.ceil(Number(cost.minCost) / safeDollarsPerCredit));
      const maxCredits = Math.max(PRICING.minCreditsPerRun, Math.ceil(Number(cost.maxCost) / safeDollarsPerCredit));

      return minCredits === maxCredits
        ? `${minCredits} credits`
        : `${minCredits}\u2013${maxCredits} credits`;
    }

	    // ============================================================================
	    // FILTERING
	    // ============================================================================
	    function getAgentModalitiesForFiltering(agent) {
	      const explicit = Array.isArray(agent.modalities) ? agent.modalities : [];
	      const normalized = new Set(explicit.map(m => String(m || '').toLowerCase()).filter(Boolean));
	      if (normalized.size > 0) return normalized;

	      const inferred = new Set();
	      const inputTypes = Array.isArray(agent.inputTypes) ? agent.inputTypes : [];
	      for (const raw of inputTypes) {
	        const t = String(raw || '').toLowerCase();
	        if (!t) continue;
	        if (t.startsWith('image/') || t.includes('image')) inferred.add('image');
	        else if (t.startsWith('video/') || t.includes('video')) inferred.add('video');
	        else if (t.startsWith('audio/') || t.includes('audio')) inferred.add('audio');
	        else inferred.add('text');
	      }
	      return inferred;
	    }

	    function agentMatchesFilters(agent) {
	      // Category filter - check primaryCategory first (most agents use this)
	      if (state.category !== 'all') {
	        const agentCategory = (agent.primaryCategory || agent.canonicalCategory || agent.category || '').toLowerCase();
	        if (agentCategory !== state.category.toLowerCase()) return false;
      }

      // Search filter
      if (state.search) {
        const query = state.search.toLowerCase();
        const searchable = `${agent.searchBlob || ''} ${agent.name || ''} ${agent.description || ''} ${agent.id || ''} ${(agent.tags || []).join(' ')}`.toLowerCase();
        if (!searchable.includes(query)) return false;
      }

	      // Input type filter (OR logic within group)
	      if (state.inputTypes.size > 0) {
	        const agentModalities = getAgentModalitiesForFiltering(agent);
	        const hasMatch = [...state.inputTypes].some(t => agentModalities.has(t.toLowerCase()));
	        if (!hasMatch) return false;
	      }

      // Platform filter (OR logic within group)
      if (state.platforms.size > 0) {
        const agentPlatforms = new Set((agent.platforms || []).map(p => p.toLowerCase()));
        // API is always available for all agents
        if (state.platforms.has('api')) {
          // If only API is selected, all agents match
          if (state.platforms.size === 1) return true;
        }
        const hasMatch = [...state.platforms].some(p => {
          if (p === 'api') return true;
          return agentPlatforms.has(p.toLowerCase());
        });
        if (!hasMatch) return false;
      }

      // Industries/Verticals filter (OR logic)
      if (state.industries.size > 0) {
        const agentVerticals = new Set((agent.verticals || []).map(v => v.toLowerCase()));
        const hasMatch = [...state.industries].some(v => agentVerticals.has(v.toLowerCase()));
        if (!hasMatch) return false;
      }

      // Social Channels filter (OR logic)
      if (state.channels.size > 0) {
        const agentChannels = new Set((agent.socialChannels || []).map(c => c.toLowerCase()));
        const hasMatch = [...state.channels].some(c => agentChannels.has(c.toLowerCase()));
        if (!hasMatch) return false;
      }

      // AI Models filter (OR logic)
      if (state.models.size > 0) {
        const agentModels = new Set((agent.models || []).map(m => m.toLowerCase()));
        const hasMatch = [...state.models].some(m => agentModels.has(m.toLowerCase()));
        if (!hasMatch) return false;
      }

      // API Providers filter (OR logic)
      if (state.providers.size > 0) {
        const agentProviders = new Set((agent.providers || []).map(p => p.toLowerCase()));
        const hasMatch = [...state.providers].some(p => agentProviders.has(p.toLowerCase()));
        if (!hasMatch) return false;
      }

      return true;
    }

    // ============================================================================
    // SORTING
    // ============================================================================
    function getPopularityScore(agent) {
      const index = POPULAR_AGENTS.indexOf(agent.id);
      return index === -1 ? 0 : POPULAR_AGENTS.length - index;
    }

    function sortAgents(agents) {
      const sorted = [...agents];

      switch (state.sort) {
        case 'popular':
          return sorted.sort((a, b) => {
            const aScore = getPopularityScore(a);
            const bScore = getPopularityScore(b);
            return bScore - aScore;
          });

        case 'price-asc':
          return sorted.sort((a, b) => {
            const aCost = a.costEstimate?.minCost ?? Infinity;
            const bCost = b.costEstimate?.minCost ?? Infinity;
            return aCost - bCost;
          });

        case 'price-desc':
          return sorted.sort((a, b) => {
            const aCost = a.costEstimate?.maxCost ?? 0;
            const bCost = b.costEstimate?.maxCost ?? 0;
            return bCost - aCost;
          });

        case 'newest':
          return sorted.sort((a, b) => {
            const aDate = new Date(a.createdAt || 0);
            const bDate = new Date(b.createdAt || 0);
            return bDate - aDate;
          });

        case 'alphabetical':
          return sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        default:
          return sorted;
      }
    }

    // ============================================================================
    // URL STATE SYNC
    // ============================================================================
    function readStateFromURL() {
      const params = new URLSearchParams(location.search);

      state.category = resolveToPrimary(params.get('category') || 'all');
      state.search = params.get('q') || '';
      state.sort = params.get('sort') || 'popular';

      state.inputTypes.clear();
      const inputs = params.get('input')?.split(',').filter(Boolean) || [];
      inputs.forEach(t => state.inputTypes.add(t));

      state.platforms.clear();
      const platforms = params.get('platform')?.split(',').filter(Boolean) || [];
      platforms.forEach(p => state.platforms.add(p));

      state.industries.clear();
      const industries = params.get('industry')?.split(',').filter(Boolean) || [];
      industries.forEach(v => state.industries.add(v));

      state.channels.clear();
      const channels = params.get('channel')?.split(',').filter(Boolean) || [];
      channels.forEach(c => state.channels.add(c));

      state.models.clear();
      const models = params.get('model')?.split(',').filter(Boolean) || [];
      models.forEach(m => state.models.add(m));

      state.providers.clear();
      const providers = params.get('provider')?.split(',').filter(Boolean) || [];
      providers.forEach(p => state.providers.add(p));
    }

    function writeStateToURL() {
      const params = new URLSearchParams();

      if (state.category !== 'all') params.set('category', state.category);
      if (state.search) params.set('q', state.search);
      if (state.sort !== 'popular') params.set('sort', state.sort);
      if (state.inputTypes.size) params.set('input', [...state.inputTypes].join(','));
      if (state.platforms.size) params.set('platform', [...state.platforms].join(','));
      if (state.industries.size) params.set('industry', [...state.industries].join(','));
      if (state.channels.size) params.set('channel', [...state.channels].join(','));
      if (state.models.size) params.set('model', [...state.models].join(','));
      if (state.providers.size) params.set('provider', [...state.providers].join(','));

      const url = params.toString() ? `/aitopia/marketplace/agents.html?${params}` : '/aitopia/marketplace/agents.html';
      history.replaceState({}, '', url);
    }

    // ============================================================================
    // RENDERING
    // ============================================================================
    function renderCategoryFilters() {
      const container = document.getElementById('categoryFilters');

      // Build category counts
      const categoryCounts = new Map();
      categoryCounts.set('all', allAgents.length);

      for (const agent of allAgents) {
        const cat = (agent.canonicalCategory || agent.primaryCategory || agent.category || 'other').toLowerCase();
        categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
      }

      // Render
      let html = `
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="radio" name="category" class="filter-radio" value="all"
            ${state.category === 'all' ? 'checked' : ''} data-onchange="handleCategoryChange" data-param="all">
          <span class="text-sm">All</span>
          <span class="text-xs text-muted-foreground">(${categoryCounts.get('all') || 0})</span>
        </label>
      `;

      for (const cat of categories) {
        const slug = cat.slug || cat.id || cat.name?.toLowerCase();
        const count = categoryCounts.get(slug) || 0;
        if (count === 0) continue;

        html += `
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="category" class="filter-radio" value="${slug}"
              ${state.category === slug ? 'checked' : ''} data-onchange="handleCategoryChange" data-param="${slug}">
            <span class="text-sm">${cat.name || slug}</span>
            <span class="text-xs text-muted-foreground">(${count})</span>
          </label>
        `;
      }

      container.innerHTML = html;
    }

    function renderCategoryPills() {
      const container = document.getElementById('categoryPills');

      // Only show pills if we have categories
      if (categories.length === 0) {
        container.innerHTML = '';
        return;
      }

      let html = `
        <button data-action="handleCategoryChange" data-param="all"
          class="px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${state.category === 'all'
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted text-muted-foreground hover:text-foreground'
        }">
          All
        </button>
      `;

      for (const cat of categories.slice(0, 8)) {
        const slug = cat.slug || cat.id || cat.name?.toLowerCase();
        html += `
          <button data-action="handleCategoryChange" data-param="${slug}"
            class="px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${state.category === slug
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground hover:text-foreground'
          }">
            ${cat.name || slug}
          </button>
        `;
      }

      container.innerHTML = html;
    }

    function renderDynamicFilters() {
      // Render dynamic filter sections from tagBuckets
      if (!tagBuckets) return;

      // Platforms
      if (tagBuckets.platforms && Object.keys(tagBuckets.platforms).length > 0) {
        const section = document.getElementById('platformFilterSection');
        const container = document.getElementById('platformFilters');
        section.classList.remove('hidden');
        const items = Object.entries(tagBuckets.platforms).sort((a, b) => b[1] - a[1]).slice(0, 10);
        container.innerHTML = items.map(([tag, count]) => `
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" class="filter-checkbox" value="${tag}"
              ${state.platforms.has(tag) ? 'checked' : ''} data-onchange="handlePlatformChange">
            <span class="text-sm">${getFilterIcon(tag)} ${formatTag(tag)}</span>
            <span class="text-xs text-muted-foreground ml-auto">${count}</span>
          </label>
        `).join('');
      }

      // Industries/Verticals
      if (tagBuckets.verticals && Object.keys(tagBuckets.verticals).length > 0) {
        const section = document.getElementById('industriesFilterSection');
        const container = document.getElementById('industriesFilters');
        section.classList.remove('hidden');
        const items = Object.entries(tagBuckets.verticals).sort((a, b) => b[1] - a[1]).slice(0, 10);
        container.innerHTML = items.map(([tag, count]) => `
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" class="filter-checkbox" value="${tag}"
              ${state.industries.has(tag) ? 'checked' : ''} data-onchange="handleIndustryChange">
            <span class="text-sm">${getFilterIcon(tag)} ${formatTag(tag)}</span>
            <span class="text-xs text-muted-foreground ml-auto">${count}</span>
          </label>
        `).join('');
      }

      // Social Channels
      if (tagBuckets.socialChannels && Object.keys(tagBuckets.socialChannels).length > 0) {
        const section = document.getElementById('channelsFilterSection');
        const container = document.getElementById('channelsFilters');
        section.classList.remove('hidden');
        const items = Object.entries(tagBuckets.socialChannels).sort((a, b) => b[1] - a[1]).slice(0, 10);
        container.innerHTML = items.map(([tag, count]) => `
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" class="filter-checkbox" value="${tag}"
              ${state.channels.has(tag) ? 'checked' : ''} data-onchange="handleChannelChange">
            <span class="text-sm">${getFilterIcon(tag)} ${formatTag(tag)}</span>
            <span class="text-xs text-muted-foreground ml-auto">${count}</span>
          </label>
        `).join('');
      }

      // AI Models
      if (tagBuckets.models && Object.keys(tagBuckets.models).length > 0) {
        const section = document.getElementById('modelsFilterSection');
        const container = document.getElementById('modelsFilters');
        section.classList.remove('hidden');
        const items = Object.entries(tagBuckets.models).sort((a, b) => b[1] - a[1]).slice(0, 10);
        container.innerHTML = items.map(([tag, count]) => `
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" class="filter-checkbox" value="${tag}"
              ${state.models.has(tag) ? 'checked' : ''} data-onchange="handleModelChange">
            <span class="text-sm">${getFilterIcon(tag)} ${formatTag(tag)}</span>
            <span class="text-xs text-muted-foreground ml-auto">${count}</span>
          </label>
        `).join('');
      }

      // API Providers
      if (tagBuckets.providers && Object.keys(tagBuckets.providers).length > 0) {
        const section = document.getElementById('providersFilterSection');
        const container = document.getElementById('providersFilters');
        section.classList.remove('hidden');
        const items = Object.entries(tagBuckets.providers).sort((a, b) => b[1] - a[1]).slice(0, 10);
        container.innerHTML = items.map(([tag, count]) => `
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" class="filter-checkbox" value="${tag}"
              ${state.providers.has(tag) ? 'checked' : ''} data-onchange="handleProviderChange">
            <span class="text-sm">${getFilterIcon(tag)} ${formatTag(tag)}</span>
            <span class="text-xs text-muted-foreground ml-auto">${count}</span>
          </label>
        `).join('');
      }
    }

    function renderAgentCard(agent) {
      // For video category agents
      const cat = (agent.category || agent.primaryCategory || '').toLowerCase();
      const isVideoCategory = cat === 'video' || cat === 'higgsfield-video' || cat.includes('video');
      let mediaUrl;
      if (isVideoCategory) {
        mediaUrl = agent.featured_video || agent.showcase_videos?.[0] || agent.videos?.[0] || agent.showcase_images?.[0] || agent.icon || agent.screenshots?.[0];
      } else {
        mediaUrl = agent.showcase_images?.[0] || agent.featured_video || agent.showcase_videos?.[0] || agent.icon || agent.videos?.[0] || agent.screenshots?.[0];
      }
      const isVideo = mediaUrl?.endsWith('.mp4') || mediaUrl?.endsWith('.webm');
      const price = formatAgentPrice(agent);
      const isUnavailable = agent.available === false;
      const showPopular = POPULAR_AGENTS.includes(agent.id);

      return `
        <a href="/aitopia/marketplace/agent/${agent.id}.html" class="agent-card group bg-card rounded-ios-2xl border border-border/40 overflow-hidden card-hover cursor-pointer animate-fade-in max-w-[363px] w-full flex flex-col no-underline text-inherit ${isUnavailable ? 'opacity-75' : ''}">
          <div class="card-media relative aspect-square bg-secondary/50 overflow-hidden flex items-center justify-center rounded-b-[20px]">
            ${mediaUrl
          ? (isVideo
            ? `<video class="w-full h-full object-cover rounded-b-[20px] pointer-events-none" autoplay muted loop playsinline>
                       <source src="${mediaUrl}" type="video/mp4">
                     </video>`
            : `<img src="${mediaUrl}" alt="${agent.name}" class="w-full h-full object-cover img-zoom rounded-b-[20px] pointer-events-none"
                       data-hide-on-error-show-sibling>
                     <div class="gradient-fallback w-full h-full hidden items-center justify-center rounded-b-[20px]">
                       <span class="text-4xl">🤖</span>
                     </div>`)
          : `<div class="gradient-fallback w-full h-full flex items-center justify-center rounded-b-[20px]">
                   <span class="text-4xl">🤖</span>
                 </div>`
        }
            ${showPopular ? '<span class="popular-badge absolute top-3 left-3 px-3 py-1 rounded-full bg-primary/90 text-primary-foreground text-xs font-semibold shadow-sm">Popular</span>' : ''}
            ${isUnavailable ? '<span class="absolute top-3 right-3 px-3 py-1 rounded-full bg-amber-500/90 text-white text-xs font-semibold shadow-sm">Coming Soon</span>' : ''}
          </div>
          <div class="card-info p-4 flex flex-col flex-1">
            <h3 class="mt-1 text-[16px] leading-snug font-semibold text-foreground truncate">${agent.name || agent.id}</h3>
            <p class="mt-2 text-[12px] font-normal text-muted-foreground line-clamp-2 leading-snug">${agent.description || ''}</p>

            <div class="mt-auto pt-4 flex items-center justify-between gap-3">
              <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground text-[12px] font-medium max-w-[140px] text-center whitespace-normal leading-tight">
                <svg class="w-4 h-4 opacity-80" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M14.6667 5.66634C14.6667 8.05967 12.7267 9.99967 10.3333 9.99967C10.22 9.99967 10.1 9.99302 9.98667 9.98635C9.82001 7.87302 8.12666 6.17967 6.01333 6.013C6.00666 5.89967 6 5.77967 6 5.66634C6 3.27301 7.94 1.33301 10.3333 1.33301C12.7267 1.33301 14.6667 3.27301 14.6667 5.66634Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M10 10.3333C10 12.7267 8.06004 14.6667 5.66671 14.6667C3.27337 14.6667 1.33337 12.7267 1.33337 10.3333C1.33337 7.94 3.27337 6 5.66671 6C5.78004 6 5.90003 6.00666 6.01337 6.01333C8.1267 6.17999 9.82005 7.87334 9.98671 9.98667C9.99338 10.1 10 10.22 10 10.3333Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M5.08 9.74699L5.66667 8.66699L6.25334 9.74699L7.33333 10.3337L6.25334 10.9203L5.66667 12.0003L5.08 10.9203L4 10.3337L5.08 9.74699Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span>${price}</span>
              </div>

              <button class="w-10 h-10 rounded-full border border-border bg-card hover:bg-secondary transition-all btn-press flex items-center justify-center opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto" aria-label="Open">
                <svg class="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 18l6-6-6-6"></path>
                </svg>
              </button>
            </div>
          </div>
        </a>
      `;
    }

    function renderAgents() {
      const filtered = allAgents.filter(agentMatchesFilters);
      const sorted = sortAgents(filtered);

      const grid = document.getElementById('agentGrid');
      const emptyState = document.getElementById('emptyState');
      const countText = `${sorted.length} agent${sorted.length !== 1 ? 's' : ''}`;
      const agentCountEl = document.getElementById('agentCount');
      if (agentCountEl) agentCountEl.textContent = countText;
      const desktopCount = document.getElementById('agentCountDesktop');
      if (desktopCount) desktopCount.textContent = countText;

      if (sorted.length === 0) {
        if (grid) grid.innerHTML = '';
        emptyState?.classList.remove('hidden');
      } else {
        emptyState?.classList.add('hidden');
        if (grid) grid.innerHTML = sorted.map(renderAgentCard).join('');
      }

      // Show/hide clear filters button
      const hasFilters = state.category !== 'all' || state.search ||
        state.inputTypes.size > 0 || state.platforms.size > 0 ||
        state.industries.size > 0 || state.channels.size > 0 ||
        state.models.size > 0 || state.providers.size > 0;
      document.getElementById('clearFiltersBtn')?.classList.toggle('hidden', !hasFilters);
    }

    // ============================================================================
    // EVENT HANDLERS
    // ============================================================================
    function handleCategoryChange(categoryOrEvent, categoryParam) {
      // Support both direct call handleCategoryChange('slug') and CSP delegation (event, param)
      const category = categoryParam !== undefined ? categoryParam : (typeof categoryOrEvent === 'string' ? categoryOrEvent : 'all');
      state.category = category;
      writeStateToURL();
      renderCategoryFilters();
      renderCategoryPills();
      renderAgents();
    }

    function handleInputTypeChange(eventOrEl) {
      const checkbox = eventOrEl?.target || eventOrEl;
      if (checkbox.checked) {
        state.inputTypes.add(checkbox.value);
      } else {
        state.inputTypes.delete(checkbox.value);
      }
      writeStateToURL();
      renderAgents();
    }

    function handlePlatformChange(eventOrEl) {
      const checkbox = eventOrEl?.target || eventOrEl;
      if (checkbox.checked) {
        state.platforms.add(checkbox.value);
      } else {
        state.platforms.delete(checkbox.value);
      }
      writeStateToURL();
      renderAgents();
    }

    function handleIndustryChange(eventOrEl) {
      const checkbox = eventOrEl?.target || eventOrEl;
      if (checkbox.checked) {
        state.industries.add(checkbox.value);
      } else {
        state.industries.delete(checkbox.value);
      }
      writeStateToURL();
      renderAgents();
    }

    function handleChannelChange(eventOrEl) {
      const checkbox = eventOrEl?.target || eventOrEl;
      if (checkbox.checked) {
        state.channels.add(checkbox.value);
      } else {
        state.channels.delete(checkbox.value);
      }
      writeStateToURL();
      renderAgents();
    }

    function handleModelChange(eventOrEl) {
      const checkbox = eventOrEl?.target || eventOrEl;
      if (checkbox.checked) {
        state.models.add(checkbox.value);
      } else {
        state.models.delete(checkbox.value);
      }
      writeStateToURL();
      renderAgents();
    }

    function handleProviderChange(eventOrEl) {
      const checkbox = eventOrEl?.target || eventOrEl;
      if (checkbox.checked) {
        state.providers.add(checkbox.value);
      } else {
        state.providers.delete(checkbox.value);
      }
      writeStateToURL();
      renderAgents();
    }

    function clearFilters() {
      state.category = 'all';
      state.search = '';
      state.sort = 'popular';
      state.inputTypes.clear();
      state.platforms.clear();
      state.industries.clear();
      state.channels.clear();
      state.models.clear();
      state.providers.clear();

      // Reset UI
      const searchInputEl = document.getElementById('searchInput');
      if (searchInputEl) searchInputEl.value = '';
      updateSortSelect('popular');
      document.querySelectorAll('#inputTypeFilters input').forEach(cb => cb.checked = false);
      document.querySelectorAll('#platformFilters input').forEach(cb => cb.checked = false);
      document.querySelectorAll('#industriesFilters input').forEach(cb => cb.checked = false);
      document.querySelectorAll('#channelsFilters input').forEach(cb => cb.checked = false);
      document.querySelectorAll('#modelsFilters input').forEach(cb => cb.checked = false);
      document.querySelectorAll('#providersFilters input').forEach(cb => cb.checked = false);

      writeStateToURL();
      renderCategoryFilters();
      renderCategoryPills();
      renderDynamicFilters();
      renderAgents();
    }

    // Mobile sidebar
    function openMobileSidebar() {
      document.getElementById('sidebarOverlay')?.classList.add('open');
      document.getElementById('mobileSidebar')?.classList.add('open');
      document.body.style.overflow = 'hidden';

      // Clone filter content to mobile sidebar
      const desktopFilters = document.querySelector('aside.hidden.md\\:block > div');
      const mobileContent = document.getElementById('mobileFilterContent');
      if (mobileContent && desktopFilters) mobileContent.innerHTML = desktopFilters.innerHTML;

      // Fix duplicate IDs by prefixing with 'mobile-'
      mobileContent.querySelectorAll('[id]').forEach(el => {
        el.id = 'mobile-' + el.id;
      });

      // Search input
      const mobileSearch = mobileContent.querySelector('#mobile-searchInput');
      if (mobileSearch) mobileSearch.value = state.search;

      // Add event listener for mobile sort select
      const mobileSort = mobileContent.querySelector('select');
      if (mobileSort) {
        mobileSort.value = state.sort;
        mobileSort.addEventListener('change', (e) => {
          state.sort = e.target.value;
          // Sync desktop sort
          updateSortSelect(state.sort);
          writeStateToURL();
          renderAgents();
        });
      }
    }

    function closeMobileSidebar() {
      document.getElementById('sidebarOverlay')?.classList.remove('open');
      document.getElementById('mobileSidebar')?.classList.remove('open');
      document.body.style.overflow = '';
    }

    // ============================================================================
    // INITIALIZATION
    // ============================================================================
    async function init() {
      // Read state from URL
      readStateFromURL();

      // Apply state to UI
      const searchInputInit = document.getElementById('searchInput');
      if (searchInputInit) searchInputInit.value = state.search;
      updateSortSelect(state.sort);

      // Apply input type checkboxes
      state.inputTypes.forEach(type => {
        const cb = document.querySelector(`#inputTypeFilters input[value="${type}"]`);
        if (cb) cb.checked = true;
      });

      // Apply platform checkboxes
      state.platforms.forEach(platform => {
        const cb = document.querySelector(`#platformFilters input[value="${platform}"]`);
        if (cb) cb.checked = true;
      });

      // Load data
      allAgents = await loadData();

      // Render
      renderCategoryFilters();
      renderCategoryPills();
      renderDynamicFilters();
      renderAgents();

      // Apply dynamic filter checkboxes (after renderDynamicFilters creates them)
      state.industries.forEach(industry => {
        const cb = document.querySelector(`#industriesFilters input[value="${industry}"]`);
        if (cb) cb.checked = true;
      });
      state.channels.forEach(channel => {
        const cb = document.querySelector(`#channelsFilters input[value="${channel}"]`);
        if (cb) cb.checked = true;
      });
      state.models.forEach(model => {
        const cb = document.querySelector(`#modelsFilters input[value="${model}"]`);
        if (cb) cb.checked = true;
      });
      state.providers.forEach(provider => {
        const cb = document.querySelector(`#providersFilters input[value="${provider}"]`);
        if (cb) cb.checked = true;
      });

      // Setup event listeners
      const searchInput = document.getElementById('searchInput');
      let searchTimeout;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          state.search = e.target.value;
          writeStateToURL();
          renderAgents();
        }, 300);
      });

      window.toggleCustomSelect = function(eventOrEl) {
        const selectEl = eventOrEl?.target ? eventOrEl.target.closest('.custom-select') : eventOrEl;
        if (!selectEl) return;
        document.querySelectorAll('.custom-select.open').forEach(el => {
          if (el !== selectEl) el.classList.remove('open');
        });
        selectEl.classList.toggle('open');
      };

      window.selectCustomOption = function(eventOrEl) {
        const optionEl = eventOrEl?.target ? eventOrEl.target.closest('.custom-select-option') : eventOrEl;
        if (!optionEl) return;
        const selectEl = optionEl.closest('.custom-select');
        const value = optionEl.dataset.value;
        const text = optionEl.textContent;

        selectEl.querySelectorAll('.custom-select-option').forEach(opt => opt.classList.remove('selected'));
        optionEl.classList.add('selected');

        selectEl.querySelector('.custom-select-value').textContent = text;
        selectEl.dataset.value = value;
        selectEl.classList.remove('open');

        if (selectEl.id === 'sortSelect') {
          state.sort = value;
          writeStateToURL();
          renderAgents();
        }
      };

      document.addEventListener('click', (e) => {
        if (!e.target.closest('.custom-select')) {
          document.querySelectorAll('.custom-select.open').forEach(el => el.classList.remove('open'));
        }
      });

      function updateSortSelect(value) {
        const sortSelect = document.getElementById('sortSelect');
        const sortOption = sortSelect.querySelector(`.custom-select-option[data-value="${value}"]`);
        if (sortOption) {
          sortSelect.querySelectorAll('.custom-select-option').forEach(opt => opt.classList.remove('selected'));
          sortOption.classList.add('selected');
          sortSelect.querySelector('.custom-select-value').textContent = sortOption.textContent;
          sortSelect.dataset.value = value;
        }
      }

      // Handle browser back/forward
      window.addEventListener('popstate', () => {
        readStateFromURL();
        const searchInputPop = document.getElementById('searchInput');
        if (searchInputPop) searchInputPop.value = state.search;
        updateSortSelect(state.sort);

        // Reset all checkboxes first
        document.querySelectorAll('#inputTypeFilters input').forEach(cb => cb.checked = false);
        document.querySelectorAll('#platformFilters input').forEach(cb => cb.checked = false);
        document.querySelectorAll('#industriesFilters input').forEach(cb => cb.checked = false);
        document.querySelectorAll('#channelsFilters input').forEach(cb => cb.checked = false);
        document.querySelectorAll('#modelsFilters input').forEach(cb => cb.checked = false);
        document.querySelectorAll('#providersFilters input').forEach(cb => cb.checked = false);

        // Apply state to checkboxes
        state.inputTypes.forEach(type => {
          const cb = document.querySelector(`#inputTypeFilters input[value="${type}"]`);
          if (cb) cb.checked = true;
        });
        state.platforms.forEach(platform => {
          const cb = document.querySelector(`#platformFilters input[value="${platform}"]`);
          if (cb) cb.checked = true;
        });
        state.industries.forEach(industry => {
          const cb = document.querySelector(`#industriesFilters input[value="${industry}"]`);
          if (cb) cb.checked = true;
        });
        state.channels.forEach(channel => {
          const cb = document.querySelector(`#channelsFilters input[value="${channel}"]`);
          if (cb) cb.checked = true;
        });
        state.models.forEach(model => {
          const cb = document.querySelector(`#modelsFilters input[value="${model}"]`);
          if (cb) cb.checked = true;
        });
        state.providers.forEach(provider => {
          const cb = document.querySelector(`#providersFilters input[value="${provider}"]`);
          if (cb) cb.checked = true;
        });

        renderCategoryFilters();
        renderCategoryPills();
        renderAgents();
      });
    }

    // Start
    init();