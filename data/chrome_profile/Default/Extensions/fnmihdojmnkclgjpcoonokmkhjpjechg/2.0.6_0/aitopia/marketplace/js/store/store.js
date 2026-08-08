import { getMarketplaceSearch } from '../search/marketplace-search.js';
import { attachAutocomplete } from '../search/autocomplete.js';

// Auto-extracted from public/store.html (Phase C)
// NOTE: Loaded as ES6 module. Functions used by inline onclick handlers are exposed to window object.
// API Backend URL - uses current origin for production deployment
    const API_BASE_URL = window.__AITOPIA_DOMAIN__ || 'https://aitopia.ai';

    // Agent Database
    const agents = window.__AITOPIA_STORE_FEATURED_AGENTS__ || {};

    // Tracks selected default model images per agent (virtual try-on)
    const selectedModels = {};


    // Phase C follow-up: load the heavy legacy in-store runner code ONLY when explicitly requested.
    // This preserves /agent/:id/run?legacy=1 behavior without bloating the default /store page.
    const LEGACY_RUNNER_SCRIPT_URL = '/aitopia/marketplace/js/store/legacy-runner.js';
    let legacyRunnerReady = Promise.resolve();

    (function initLegacyRunnerLoader() {
      const params = new URLSearchParams(window.location.search);
      const isLegacy = params.get('legacy') === '1' || params.get('legacy') === 'true';
      if (!isLegacy) return;

      legacyRunnerReady = import(/* @vite-ignore */ LEGACY_RUNNER_SCRIPT_URL)
        .then(function(){})
        .catch(function(){ throw new Error('Failed to load legacy runner script'); });
    })();

    // AI Models from /api/models endpoint
    let aiModels = [];
    const marketplaceSearch = getMarketplaceSearch();
    let searchAutocompleteBindings = [];

    function navigateToSearchResults(query) {
      const normalized = String(query || '').trim();
      if (!normalized) {
        location.href='/aitopia/marketplace/search.html';
        return;
      }
      location.href=`/aitopia/marketplace/search.html?q=${encodeURIComponent(normalized)}`;
    }

    function setupStoreAutocomplete() {
      const bindings = [];
      const bind = (inputId, dropdownId) => {
        const input = document.getElementById(inputId);
        const dropdown = document.getElementById(dropdownId);
        if (!(input instanceof HTMLInputElement) || !(dropdown instanceof HTMLElement)) return;

        const binding = attachAutocomplete({
          input,
          dropdown,
          search: marketplaceSearch,
          onSelect: (item) => {
            if (item?.url) {
              window.location.assign(item.url);
              return;
            }
            if (item?.type === 'agent' && item.id) {
              window.location.assign(`/aitopia/marketplace/agent/${encodeURIComponent(item.id)}.html`);
              return;
            }
            if (item?.type === 'model' && item.id) {
              location.href=`/aitopia/marketplace/models.html?search=${encodeURIComponent(item.id)}`;
              return;
            }
            navigateToSearchResults(input.value);
          },
          onSubmitWithoutSelection: (query) => {
            navigateToSearchResults(query);
          },
        });

        bindings.push(binding);
      };

      bind('searchInput', 'searchAutocompleteHeader');
      bind('searchInputMain', 'searchAutocompleteMain');
      return bindings;
    }

    // Balance masonry grid with variety: horizontal (15) vs square (24)
    function balanceMasonryGrid(gridElement) {
      if (!gridElement) return;


      const cards = gridElement.querySelectorAll('.agent-card');
      const n = cards.length;
      if (n === 0) return;
      if (window.innerWidth >= 1024) {
        cards.forEach((card, i) => {
          if (card.style?.gridRow) {
            card.style.gridRow = "";
          }
        })
        return;
      }

      // H = horizontal (span 15 = 120px), S = square (span 24 = 192px)
      const H = 15, S = 24;
      const patterns = {
        1: [[S], []],
        2: [[H], [H]],
        3: [[H, H], [S]],
        3: [[H, S], [H + S - H]],
        4: [[H, S], [S, H]],
        5: [[H, S, H], [S, S]],
        6: [[H, S, H], [S, H, H]],
        7: [[H, S, H, S], [S, S, H]],
        8: [[H, S, H, S], [S, H, S, H]],
      };

      const balancedPatterns = {
        1: [[20], []],
        2: [[18], [18]],
        3: [[15, 21], [36]],
        4: [[15, 24], [24, 15]],
        5: [[15, 24, 15], [27, 27]],
        6: [[15, 24, 15], [24, 15, 15]],
        7: [[15, 24, 15, 18], [24, 24, 24]],
        8: [[15, 24, 15, 24], [24, 15, 24, 15]],
        9: [[15, 24, 15, 24, 15], [24, 15, 24, 30]],
        10: [[15, 24, 15, 24, 15], [24, 15, 24, 15, 15]],
      };

      const col1Count = Math.ceil(n / 2);
      const col2Count = Math.floor(n / 2);

      let col1Spans, col2Spans;
      if (balancedPatterns[n]) {
        [col1Spans, col2Spans] = balancedPatterns[n];
      } else {
        col1Spans = Array(col1Count).fill(0).map((_, i) => i % 2 === 0 ? H : S);
        col2Spans = Array(col2Count).fill(0).map((_, i) => i % 2 === 0 ? S : H);
      }

      let col1Idx = 0, col2Idx = 0;
      cards.forEach((card, i) => {
        const cardNum = i + 1;
        if (cardNum % 2 === 1 && col1Idx < col1Spans.length) {
          card.style.gridRow = `span ${col1Spans[col1Idx++]}`;
        } else if (col2Idx < col2Spans.length) {
          card.style.gridRow = `span ${col2Spans[col2Idx++]}`;
        }
      });
    }

    function balanceAllMasonryGrids() {
      document.querySelectorAll('.masonry-grid').forEach(balanceMasonryGrid);
    }

    // Current filter
    let currentCategory = 'all';

    // Category mapping from API to frontend
    // Legacy to primary category mapping (aligns with server-side legacyToPrimary)
    const categoryMapping = {
      'analytics': { name: 'Dev & Data', key: 'dev-data' },
      'ecommerce': { name: 'Commerce & Websites', key: 'commerce-websites' },
      'creative': { name: 'Image', key: 'image' },
      'productivity': { name: 'Productivity', key: 'productivity' },
      'marketing': { name: 'Marketing & Social', key: 'marketing-social' },
      'translation': { name: 'Productivity', key: 'productivity' },
      'content': { name: 'Marketing & Social', key: 'marketing-social' },
      'business': { name: 'Business', key: 'business' },
      'higgsfield-image': { name: 'Image', key: 'image' },
      'higgsfield-video': { name: 'Video', key: 'video' },
      'higgsfield-audio': { name: 'Audio & Voice', key: 'audio-voice' },
      'higgsfield-ai': { name: 'Productivity', key: 'productivity' },
      // New primary categories (identity mapping)
      'image': { name: 'Image', key: 'image' },
      'video': { name: 'Video', key: 'video' },
      'audio-voice': { name: 'Audio & Voice', key: 'audio-voice' },
      'marketing-social': { name: 'Marketing & Social', key: 'marketing-social' },
      'commerce-websites': { name: 'Commerce & Websites', key: 'commerce-websites' },
      'sales-support': { name: 'Sales & Support', key: 'sales-support' },
      'dev-data': { name: 'Dev & Data', key: 'dev-data' },
      'travel': { name: 'Travel', key: 'travel' },
      'education': { name: 'Education', key: 'education' },
      'industry-packs': { name: 'Industry Packs', key: 'industry-packs' },
      'models': { name: 'Models', key: 'models' }
    };

    // =============================================================================
    // CANONICAL CATEGORY URLS (Option C)
    // =============================================================================

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
      'analytics': 'dev',
      'ecommerce': 'commerce',
      'creative': 'image',
      'translation': 'productivity',
      'content': 'marketing',
      'marketing': 'marketing',
      'productivity': 'productivity',
      'business': 'business',

      // Primary -> canonical
      'audio-voice': 'audio',
      'marketing-social': 'marketing',
      'commerce-websites': 'commerce',
      'dev-data': 'dev',
      'sales-support': 'business',
      'travel': 'productivity',
      'education': 'productivity',
      'industry-packs': 'business',
      'models': 'dev',

      // Primary snake_case aliases
      'audio_voice': 'audio',
      'marketing_social': 'marketing',
      'commerce_websites': 'commerce',
      'dev_data': 'dev',
      'sales_support': 'business',
      'industry_packs': 'business',

      // Higgsfield legacy categories
      'higgsfield-image': 'image',
      'higgsfield-video': 'video',
      'higgsfield-audio': 'audio',
      'higgsfield-ai': 'productivity',
    };

    function normalizeCategorySlug(slug) {
      return String(slug || '').trim().toLowerCase();
    }

    function resolveCanonicalCategorySlug(rawSlug) {
      const slug = normalizeCategorySlug(rawSlug);
      if (!slug) return null;
      if (CANONICAL_CATEGORY_DEFS.some(d => d.slug === slug)) return slug;
      return CATEGORY_SLUG_REDIRECTS[slug] || null;
    }

    // =============================================================================
    // MOBILE GRID LAYOUT (CSS handles the 2-column grid with square images)
    // =============================================================================

    // No JavaScript needed - CSS grid with aspect-ratio: 1 handles everything
    function applyAllMasonryLayouts() {
      // CSS handles the layout, this function exists for compatibility
    }

    function buildCanonicalCategories(primaryCategories) {
      const byId = Object.fromEntries((primaryCategories || []).map(c => [c.id, c]));
      return CANONICAL_CATEGORY_DEFS.map(def => {
        const agentCount = def.primaryCategories.reduce((sum, id) => sum + (byId[id]?.agentCount || 0), 0);
        return {
          id: def.slug,
          name: def.name,
          description: def.description,
          agentCount,
          visible: agentCount > 0,
        };
      });
    }

    // Store API categories (loaded dynamically)
    let apiPrimaryCategories = [];
    let apiCategories = [];

    // Store tag buckets for filter chips
    let tagBuckets = {
      platforms: {},
      socialChannels: {},
      verticals: {},
      modalities: {},
      actions: {},
      models: {},
      providers: {}
    };

    // Active tag filters
    let activeFilters = {
      platforms: [],
      socialChannels: [],
      verticals: [],
      modalities: [],
      models: [],
      providers: [],   // Filter by API provider (replicate, fal, openai, etc.)
      vendors: []      // Filter by model vendor/owner (black-forest-labs, stability-ai, etc.)
    };

	    // Credits pricing configuration (display-only; enforcement is server-side)
	    function getCreditsInfoForAgent(agent) {
	      return window.AitopiaCredits?.getCreditsInfoForAgent?.(agent) || { label: 'Credits vary', minCredits: null, maxCredits: null };
	    }

	    function getCreditsLabelForAgent(agent) {
	      return window.AitopiaCredits?.getCreditsLabelForAgent?.(agent) || getCreditsInfoForAgent(agent).label;
	    }

	    function isAgentFree(agent) {
	      const { minCredits, maxCredits } = getCreditsInfoForAgent(agent);
	      return minCredits === 0 && maxCredits === 0;
	    }

    /**
     * Extract unique providers from an agent's modelChoices
     * Returns array like ['replicate', 'fal', 'openai']
     */
    function getAgentProviders(agent) {
      if (!agent.modelChoices || agent.modelChoices.length === 0) return [];
      const providers = new Set();
      agent.modelChoices.forEach(m => {
        if (m.provider) providers.add(m.provider.toLowerCase());
      });
      return Array.from(providers);
    }

    /**
     * Extract unique vendors (model owners) from an agent's modelChoices
     * For id like 'black-forest-labs/flux-schnell', returns 'black-forest-labs'
     * Returns array like ['black-forest-labs', 'stability-ai']
     */
    function getAgentVendors(agent) {
      if (!agent.modelChoices || agent.modelChoices.length === 0) return [];
      const vendors = new Set();
      agent.modelChoices.forEach(m => {
        if (m.id && m.id.includes('/')) {
          const vendor = m.id.split('/')[0].toLowerCase();
          vendors.add(vendor);
        }
      });
      return Array.from(vendors);
    }

    /**
     * Check if agent uses a specific provider
     */
    function agentHasProvider(agent, provider) {
      return getAgentProviders(agent).includes(provider.toLowerCase());
    }

    /**
     * Check if agent uses a specific vendor (model owner)
     */
    function agentHasVendor(agent, vendor) {
      return getAgentVendors(agent).includes(vendor.toLowerCase());
    }

    // Default icons by category
    const defaultIcons = {
      // Canonical
      'image': 'https://aitopia.ai/agent-images/image-generator-1.webp',
      'video': 'https://aitopia.ai/agent-images/video-generator-1.webp',
      'audio': 'https://aitopia.ai/agent-images/music-generator-1.webp',
      'productivity': 'https://aitopia.ai/agent-images/smart-data-analyzer-1.webp',
      'marketing': 'https://aitopia.ai/agent-images/smart-data-analyzer-1.webp',
      'commerce': 'https://aitopia.ai/agent-images/virtual-try-on-1.webp',
      'dev': 'https://aitopia.ai/agent-images/smart-data-analyzer-1.webp',
      'business': 'https://aitopia.ai/agent-images/smart-data-analyzer-1.webp',

      // Primary/legacy fallbacks
      'audio-voice': 'https://aitopia.ai/agent-images/music-generator-1.webp',
      'marketing-social': 'https://aitopia.ai/agent-images/smart-data-analyzer-1.webp',
      'commerce-websites': 'https://aitopia.ai/agent-images/virtual-try-on-1.webp',
      'dev-data': 'https://aitopia.ai/agent-images/smart-data-analyzer-1.webp',
      'models': 'https://aitopia.ai/agent-images/smart-data-analyzer-1.webp',
      'sales-support': 'https://aitopia.ai/agent-images/smart-data-analyzer-1.webp',
      'industry-packs': 'https://aitopia.ai/agent-images/smart-data-analyzer-1.webp',
      'ecommerce': 'https://aitopia.ai/agent-images/virtual-try-on-1.webp',
      'creative': 'https://aitopia.ai/agent-images/style-transfer-1.webp'
    };

    // Category icons and gradients for Apple App Store-style navigation
    const categoryStyles = {
      'image': { emoji: '🖼️', gradient: 'linear-gradient(135deg, #FF6B6B, #FF8E53)', name: 'Image' },
      'video': { emoji: '🎬', gradient: 'linear-gradient(135deg, #4ECDC4, #45B7AA)', name: 'Video' },
      'audio': { emoji: '🎧', gradient: 'linear-gradient(135deg, #A18CD1, #FBC2EB)', name: 'Audio & Voice' },
      'productivity': { emoji: '⚡', gradient: 'linear-gradient(135deg, #11998e, #38ef7d)', name: 'Productivity' },
      'marketing': { emoji: '📱', gradient: 'linear-gradient(135deg, #ee0979, #ff6a00)', name: 'Marketing' },
      'commerce': { emoji: '🛒', gradient: 'linear-gradient(135deg, #667eea, #764ba2)', name: 'Commerce' },
      'dev': { emoji: '💻', gradient: 'linear-gradient(135deg, #4facfe, #00f2fe)', name: 'Dev & Data' },
      'business': { emoji: '📊', gradient: 'linear-gradient(135deg, #fa709a, #fee140)', name: 'Business' },

      // Aliases / primary categories (for filtering + fallbacks)
      'audio-voice': { emoji: '🎧', gradient: 'linear-gradient(135deg, #A18CD1, #FBC2EB)', name: 'Audio & Voice' },
      'marketing-social': { emoji: '📱', gradient: 'linear-gradient(135deg, #ee0979, #ff6a00)', name: 'Marketing' },
      'commerce-websites': { emoji: '🛒', gradient: 'linear-gradient(135deg, #667eea, #764ba2)', name: 'Commerce' },
      'dev-data': { emoji: '💻', gradient: 'linear-gradient(135deg, #4facfe, #00f2fe)', name: 'Dev & Data' },
      'models': { emoji: '💻', gradient: 'linear-gradient(135deg, #4facfe, #00f2fe)', name: 'Dev & Data' },
      'sales-support': { emoji: '📊', gradient: 'linear-gradient(135deg, #fa709a, #fee140)', name: 'Business' },
      'industry-packs': { emoji: '📊', gradient: 'linear-gradient(135deg, #fa709a, #fee140)', name: 'Business' },
      'travel': { emoji: '⚡', gradient: 'linear-gradient(135deg, #11998e, #38ef7d)', name: 'Productivity' },
      'education': { emoji: '⚡', gradient: 'linear-gradient(135deg, #11998e, #38ef7d)', name: 'Productivity' }
    };

    // Load agents from API and merge with local visual metadata
    async function loadAgentsFromAPI() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/store`);
        if (!response.ok) {
          console.warn('⚠️ Could not fetch agents from API, using local data only');
          return;
        }

        const data = await response.json();
        const apiAgents = data.agents || [];
        console.log(`✅ Loaded ${apiAgents.length} agents from API`);

        let addedCount = 0;
        let updatedCount = 0;

        apiAgents.forEach(apiAgent => {
          // Use primaryCategory if available, fallback to legacy category mapping
          const primaryCat = apiAgent.primaryCategory || 'productivity';
          const categoryInfo = categoryMapping[primaryCat] || categoryMapping[apiAgent.category] || { name: primaryCat, key: primaryCat };

          if (agents[apiAgent.id]) {
            // Agent exists in local data - update with API data but keep visual metadata
            // IMPORTANT: Preserve local UI-friendly models, styles, etc. - don't overwrite with API model IDs
            const localAgent = agents[apiAgent.id];
            agents[apiAgent.id] = {
              ...localAgent,
              description: apiAgent.description || localAgent.description,
              features: apiAgent.features || localAgent.features,
              available: apiAgent.available,
              unavailableReason: apiAgent.unavailableReason,
              async: apiAgent.async,
              inputTypes: apiAgent.inputTypes,
              outputTypes: apiAgent.outputTypes,
              // New category fields
              primaryCategory: primaryCat,
              additionalCategories: apiAgent.additionalCategories || [],
              categoryKey: categoryInfo.key,
              platforms: apiAgent.platforms || [],
              socialChannels: apiAgent.socialChannels || [],
              verticals: apiAgent.verticals || [],
              modalities: apiAgent.modalities || [],
              actions: apiAgent.actions || [],
              // Keep local UI-friendly models if they exist (with name/icon objects)
              // Only use API models if no local models defined
              models: localAgent.models?.length ? localAgent.models : apiAgent.models || [],
              // Model choices with cost information from capability registry
              modelChoices: apiAgent.modelChoices || [],
              costEstimate: apiAgent.costEstimate,
            };
            updatedCount++;
          } else {
            // New agent from API - create with default visual metadata
            const categoryKey = categoryInfo.key;
            agents[apiAgent.id] = {
              id: apiAgent.id,
              name: apiAgent.name,
              category: categoryInfo.name,
              categoryKey: categoryKey,
              description: apiAgent.description,
              icon: defaultIcons[categoryKey] || 'https://aitopia.ai/agent-images/ai-assistant-1.webp',
              screenshots: [],
              rating: (4.5 + Math.random() * 0.4).toFixed(1),
              reviews: `${Math.floor(Math.random() * 10 + 1)}.${Math.floor(Math.random() * 9)}K`,
              features: apiAgent.features || [],
              developer: 'MuleRun',
              popular: false,
              available: apiAgent.available,
              unavailableReason: apiAgent.unavailableReason,
              async: apiAgent.async,
              inputTypes: apiAgent.inputTypes,
              outputTypes: apiAgent.outputTypes,
              // New category fields
              primaryCategory: primaryCat,
              additionalCategories: apiAgent.additionalCategories || [],
              platforms: apiAgent.platforms || [],
              socialChannels: apiAgent.socialChannels || [],
              verticals: apiAgent.verticals || [],
              modalities: apiAgent.modalities || [],
              actions: apiAgent.actions || [],
              models: apiAgent.models || [],
              // Model choices with cost information from capability registry
              modelChoices: apiAgent.modelChoices || [],
              costEstimate: apiAgent.costEstimate,
            };
            addedCount++;
            console.log(`  + Added: ${apiAgent.id} (${categoryInfo.name})`);
          }
        });

        console.log(`✅ API merge complete: ${addedCount} added, ${updatedCount} updated`);
      } catch (err) {
        console.error('❌ Error loading agents from API:', err);
      }
    }

    // Load categories from API
    async function loadCategoriesFromAPI() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/store/categories`);
        if (!response.ok) {
          console.warn('⚠️ Could not fetch categories from API');
          return;
        }
        const data = await response.json();
        apiPrimaryCategories = data.categories || [];
        apiCategories = buildCanonicalCategories(apiPrimaryCategories);
        tagBuckets = data.tagBuckets || tagBuckets;
        // console.log(`✅ Loaded ${apiCategories.length} categories from API`);
        // console.log(`✅ Tag buckets: ${Object.keys(tagBuckets.platforms || {}).length} platforms, ${Object.keys(tagBuckets.verticals || {}).length} verticals`);
        renderCategoryButtons();
        renderCategoryList();
        renderFilterChips();
        // Populate iOS-style navigation drawer
        renderNavCategories();
      } catch (err) {
        console.error('❌ Error loading categories from API:', err);
      }
    }

    // Render category buttons dynamically
    function renderCategoryButtons() {
      const container = document.querySelector('.category-buttons-container');
      if (!container) return;

      // Filter to visible categories only
      const visibleCategories = apiCategories.filter(c => c.visible);

      let html = `<button data-action="goToAgentsPage" class="category-btn active flex-shrink-0 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium transition-all btn-press" data-category="all">All Agents</button>`;

      visibleCategories.forEach(cat => {
        html += `<button data-action="goToAgentsPage" data-param="${cat.id}" class="category-btn flex-shrink-0 px-4 py-2 rounded-full bg-secondary hover:bg-secondary/80 text-secondary-foreground text-sm font-medium transition-all btn-press" data-category="${cat.id}">${cat.name}</button>`;
      });

      // Add AI Models button at the end
      html += `<button data-nav="/aitopia/marketplace/models.html" class="category-btn flex-shrink-0 px-4 py-2 rounded-full bg-violet-500/20 hover:bg-violet-500/30 text-violet-400 text-sm font-medium transition-all btn-press" data-category="models">AI Models</button>`;

      container.innerHTML = html;
    }

    // Render category list for Agents tab (Apple App Store style)
    function renderCategoryList() {
      const container = document.getElementById('categoryListContainer');
      if (!container) return;

      // Show visible categories, sorted by agent count
      const visibleCategories = apiCategories
        .filter(c => c.visible)
        .sort((a, b) => b.agentCount - a.agentCount);

      let html = '';
      visibleCategories.forEach(cat => {
        const style = categoryStyles[cat.id] || { emoji: '📦', gradient: 'linear-gradient(135deg, #667eea, #764ba2)', name: cat.name };
        html += `
          <a href="/marketplace/category/${cat.id}" data-action="navigateToCategory" data-param="${cat.id}" class="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors">
            <div class="w-10 h-10 rounded-ios flex items-center justify-center text-xl" style="background: ${style.gradient};">
              <span>${style.emoji}</span>
            </div>
            <div class="flex-1">
              <span class="font-medium">${cat.name}</span>
              <span class="text-xs text-muted-foreground ml-2">${cat.agentCount} agents</span>
            </div>
            <svg class="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M9 5l7 7-7 7"/></svg>
          </a>`;
      });

      container.innerHTML = html;
    }

    function navigateToAllAgents() {
      activeFilters = { platforms: [], socialChannels: [], verticals: [], modalities: [], models: [], providers: [], vendors: [] };
      renderFilterChips();
      renderNavFilters();
      history.pushState({ category: 'all' }, '', "/aitopia/marketplace/index.html");
      filterCategory('all');
      showTab('today');
    }

    // Navigate to canonical category URL: /category/:slug
    function navigateToCategory(categoryId) {
      const canonical = resolveCanonicalCategorySlug(categoryId);
      if (!canonical) return navigateToAllAgents();

      activeFilters = { platforms: [], socialChannels: [], verticals: [], modalities: [], models: [], providers: [], vendors: [] };
      renderFilterChips();
      renderNavFilters();
      history.pushState({ category: canonical }, '', `/category/${canonical}`);
      filterCategory(canonical);
      showTab('today');
      document.getElementById('allAgents').scrollIntoView({ behavior: 'smooth' });
    }

    // Navigate to /agents browse page
    function goToAgentsPage(category = null) {
      const params = new URLSearchParams();
      if (category && category !== 'all') {
        params.set('category', category);
      }
      const url = params.toString() ? `/aitopia/marketplace/agents.html?${params}` : '/aitopia/marketplace/agents.html';
      window.location.href = url;
    }

    // Handle browser back/forward navigation
    window.addEventListener('popstate', (event) => {
      handleDeepLinks();
    });

    // Initialize category from URL on page load
    function initFromUrl() {
      const pathMatch = window.location.pathname.match(/\/store\/category\/([^/]+)/);
      const urlParams = new URLSearchParams(window.location.search);
      const categoryParam = urlParams.get('category') || urlParams.get('primary');

      if (pathMatch) {
        filterCategory(pathMatch[1]);
        showTab('today');
      } else if (categoryParam) {
        filterCategory(categoryParam);
        showTab('today');
      }
    }

    // =========================================================================
    // FILTER-BASED NAVIGATION DRAWER FUNCTIONS
    // =========================================================================

    // Toggle navigation drawer
    function toggleNavDrawer() {
      const drawer = document.getElementById('navDrawer');
      const overlay = document.getElementById('navDrawerOverlay');
      if (!drawer || !overlay) return;
      const isOpen = drawer.classList.contains('open') || overlay.classList.contains('open');

      if (isOpen) {
        closeNavDrawer();
      } else {
        drawer.classList.add('open');
        overlay.classList.add('open');
        document.body.style.overflow = 'hidden';
        // Render categories when opening
        renderNavCategories();
      }
    }

    // Close navigation drawer
    function closeNavDrawer() {
      const drawer = document.getElementById('navDrawer');
      const overlay = document.getElementById('navDrawerOverlay');
      // Be defensive: if DOM changes or a script fails mid-flow, avoid trapping the UI behind an overlay.
      try {
        drawer?.classList?.remove('open');
      } catch {}
      try {
        overlay?.classList?.remove('open');
      } catch {}
      document.body.style.overflow = '';
    }

    // Format tag for display
    function formatTagName(tag) {
      return tag.replace(/_/g, ' ').replace(/-/g, ' ')
        .split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }

    // Update the filter badge indicator on hamburger
    function updateFilterBadge() {
      const badge = document.getElementById('filterBadge');
      if (!badge) return;

      const hasActiveFilters = Object.values(activeFilters).some(arr => arr.length > 0) || currentCategory !== 'all';
      if (hasActiveFilters) {
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }

    // Category icons for nav drawer
    const categoryIcons = {
      // Canonical (Option C)
      'image': '/aitopia/marketplace/icons/image.svg',
      'video': '/aitopia/marketplace/icons/video.svg',
      'audio': '/aitopia/marketplace/icons/audio-voice.svg',
      'productivity': '/aitopia/marketplace/icons/productivity.svg',
      'marketing': '/aitopia/marketplace/icons/marketing-social.svg',
      'commerce': '/aitopia/marketplace/icons/commerce.svg',
      'dev': '/aitopia/marketplace/icons/dev-data.svg',
      'business': '/aitopia/marketplace/icons/business.svg',
      'all': '/aitopia/marketplace/icons/agents.svg',

      // Aliases / primary categories
      'audio-voice': '/aitopia/marketplace/icons/audio-voice.svg',
      'marketing-social': '/aitopia/marketplace/icons/marketing-social.svg',
      'commerce-websites': '/aitopia/marketplace/icons/commerce.svg',
      'dev-data': '/aitopia/marketplace/icons/dev-data.svg',
      'models': '/aitopia/marketplace/icons/models.svg',
      'ai-models': '/aitopia/marketplace/icons/models.svg',
      'sales-support': '/aitopia/marketplace/icons/sales-support.svg',
      'industry-packs': '/aitopia/marketplace/icons/business.svg',
      'travel': '/aitopia/marketplace/icons/business.svg',
      'education': '/aitopia/marketplace/icons/education.svg',
      'text-vision': '/aitopia/marketplace/icons/text-vision.svg',

      // Legacy
      'creative': '/aitopia/marketplace/icons/image.svg',
      'ecommerce': '/aitopia/marketplace/icons/commerce.svg',
      'content': '/aitopia/marketplace/icons/productivity.svg',
      'analytics': '/aitopia/marketplace/icons/business.svg',
      'audio-legacy': '/aitopia/marketplace/icons/audio-voice.svg',
      'video-production': '/aitopia/marketplace/icons/video.svg'
    };

    // Category gradients
    const categoryGradients = {
      // Canonical (Option C)
      'image': 'linear-gradient(135deg, #FF6B6B, #FF8E53)',
      'video': 'linear-gradient(135deg, #4ECDC4, #45B7AA)',
      'audio': 'linear-gradient(135deg, #667eea, #764ba2)',
      'productivity': 'linear-gradient(135deg, #f093fb, #f5576c)',
      'commerce': 'linear-gradient(135deg, #00C6FF, #0072FF)',
      'marketing': 'linear-gradient(135deg, #ee0979, #ff6a00)',
      'dev': 'linear-gradient(135deg, #11998e, #38ef7d)',
      'business': 'linear-gradient(135deg, #fa709a, #fee140)',

      // Aliases / primary categories
      'audio-voice': 'linear-gradient(135deg, #667eea, #764ba2)',
      'commerce-websites': 'linear-gradient(135deg, #00C6FF, #0072FF)',
      'marketing-social': 'linear-gradient(135deg, #ee0979, #ff6a00)',
      'dev-data': 'linear-gradient(135deg, #11998e, #38ef7d)',
      'models': 'linear-gradient(135deg, #8B5CF6, #6366F1)',
      'ai-models': 'linear-gradient(135deg, #8B5CF6, #6366F1)',
      'sales-support': 'linear-gradient(135deg, #fa709a, #fee140)',
      'industry-packs': 'linear-gradient(135deg, #fa709a, #fee140)',

      'all': 'linear-gradient(135deg, #667eea, #764ba2)',
      'default': 'linear-gradient(135deg, #667eea, #764ba2)'
    };

    // Filter icons
    const filterIcons = {
      // Platforms
      'shopify': '🛍️', 'wordpress': '📝', 'woocommerce': '🛒', 'magento': '🏪',
      'bigcommerce': '📦', 'squarespace': '◼️', 'wix': '✨', 'api': '🔌',
      // Industries/Verticals
      'fashion': '👗', 'beauty': '💄', 'sports': '⚽', 'food': '🍕',
      'real-estate': '🏠', 'automotive': '🚗', 'healthcare': '🏥', 'education': '📚',
      'finance': '💰', 'entertainment': '🎭', 'travel': '✈️', 'tech': '💻',
      'retail': '🏬', 'hospitality': '🏨', 'media': '📺',
      // Social Channels
      'instagram': '📸', 'tiktok': '🎵', 'youtube': '▶️', 'twitter': '🐦',
      'facebook': '👍', 'linkedin': '💼', 'pinterest': '📌', 'snapchat': '👻',
      // AI Models
      'flux': '✨', 'stable-diffusion': '🎨', 'dall-e': '🖌️', 'midjourney': '🌈',
      'runway': '🎬', 'replicate': '🔄', 'openai': '🤖', 'anthropic': '🧠',
      'default': '📱'
    };

    // Get icon for filter item
    function getFilterIcon(slug) {
      return filterIcons[slug?.toLowerCase()] || filterIcons['default'];
    }

    // Initialize nav drawer - render categories
    function renderNavCategories() {
      const container = document.getElementById('navCategoriesList');
      if (!container) return;

      // Add "All" option first
      let html = `
        <div class="nav-item ${currentCategory === 'all' ? 'selected' : ''}" data-action="goToAgentsPage">
          <div class="nav-item-icon">
            <img src="${categoryIcons['all']}" alt="" style="width: 18px; height: 18px; object-fit: contain;">
          </div>
          <span class="nav-item-text">All Agents</span>
          <span class="nav-item-count">${Object.keys(agents).length}</span>
          <svg class="nav-item-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
        </div>
      `;

      // Add each category (filter to visible only)
      const visibleCats = apiCategories.filter(c => c.visible);
      visibleCats.forEach(cat => {
        const icon = categoryIcons[cat.id] || '/aitopia/marketplace/icons/agents.svg';
        const isSelected = currentCategory === cat.id;
        html += `
          <div class="nav-item ${isSelected ? 'selected' : ''}" data-action="goToAgentsPage" data-param="${cat.id}">
            <div class="nav-item-icon">
              <img src="${icon}" alt="" style="width: 18px; height: 18px; object-fit: contain;">
            </div>
            <span class="nav-item-text">${cat.name}</span>
            <span class="nav-item-count">${cat.agentCount || 0}</span>
            <svg class="nav-item-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
          </div>
        `;
      });

      // Add AI Models section
      html += `
        <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--aifnmjmchg-m-border);">
          <div style="padding: 8px 0; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--aifnmjmchg-m-muted-foreground);">
            AI Models
          </div>

          <div class="nav-item" data-nav="/models/image">
            <div class="nav-item-icon">
              <img src="https://aitopia.ai/icons/image.svg" alt="" style="width: 18px; height: 18px; object-fit: contain;">
            </div>
            <span class="nav-item-text">Image</span>
            <svg class="nav-item-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </div>

          <div class="nav-item" data-nav="/models/video">
            <div class="nav-item-icon">
              <img src="https://aitopia.ai/icons/video.svg" alt="" style="width: 18px; height: 18px; object-fit: contain;">
            </div>
            <span class="nav-item-text">Video</span>
            <svg class="nav-item-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </div>

          <div class="nav-item" data-nav="/models/audio">
            <div class="nav-item-icon">
              <img src="https://aitopia.ai/icons/audio-voice.svg" alt="" style="width: 18px; height: 18px; object-fit: contain;">
            </div>
            <span class="nav-item-text">Audio</span>
            <svg class="nav-item-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </div>

          <div class="nav-item" data-nav="/models/text">
            <div class="nav-item-icon">
              <img src="https://aitopia.ai/icons/text-vision.svg" alt="" style="width: 18px; height: 18px; object-fit: contain;">
            </div>
            <span class="nav-item-text">Text & Vision</span>
            <svg class="nav-item-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </div>
        </div>
      `;

      container.innerHTML = html;
      updateFilterBadge();
    }

    // Render filter sections (platforms, industries, channels, models)
    function renderNavFilters() {
      const formatTag = (tag) => tag.replace(/_/g, ' ').replace(/-/g, ' ')
        .split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

      // Render Platforms
      const platformsContainer = document.getElementById('navPlatformsList');
      if (platformsContainer && tagBuckets.platforms) {
        const platforms = Object.entries(tagBuckets.platforms).sort((a, b) => b[1] - a[1]).slice(0, 10);
        platformsContainer.innerHTML = platforms.map(([tag, count]) => {
          const isActive = activeFilters.platforms.includes(tag);
          const icon = getFilterIcon(tag);
          return `
            <div class="nav-filter-item ${isActive ? 'active' : ''}" data-action="toggleNavFilter" data-param="platforms" data-param2="${tag}">
              <div class="nav-filter-item-left">
                <div class="nav-filter-item-icon" style="background: linear-gradient(135deg, #00C6FF, #0072FF);">
                  <span>${icon}</span>
                </div>
                <span class="nav-filter-item-text">${formatTag(tag)}</span>
              </div>
              <span class="nav-filter-item-count">${count}</span>
            </div>
          `;
        }).join('');
      }

      // Render Industries/Verticals
      const industriesContainer = document.getElementById('navIndustriesList');
      if (industriesContainer && tagBuckets.verticals) {
        const verticals = Object.entries(tagBuckets.verticals).sort((a, b) => b[1] - a[1]).slice(0, 10);
        industriesContainer.innerHTML = verticals.map(([tag, count]) => {
          const isActive = activeFilters.verticals.includes(tag);
          const icon = getFilterIcon(tag);
          return `
            <div class="nav-filter-item ${isActive ? 'active' : ''}" data-action="toggleNavFilter" data-param="verticals" data-param2="${tag}">
              <div class="nav-filter-item-left">
                <div class="nav-filter-item-icon" style="background: linear-gradient(135deg, #11998e, #38ef7d);">
                  <span>${icon}</span>
                </div>
                <span class="nav-filter-item-text">${formatTag(tag)}</span>
              </div>
              <span class="nav-filter-item-count">${count}</span>
            </div>
          `;
        }).join('');
      }

      // Render Social Channels
      const channelsContainer = document.getElementById('navChannelsList');
      if (channelsContainer && tagBuckets.socialChannels) {
        const channels = Object.entries(tagBuckets.socialChannels).sort((a, b) => b[1] - a[1]).slice(0, 10);
        channelsContainer.innerHTML = channels.map(([tag, count]) => {
          const isActive = activeFilters.socialChannels.includes(tag);
          const icon = getFilterIcon(tag);
          return `
            <div class="nav-filter-item ${isActive ? 'active' : ''}" data-action="toggleNavFilter" data-param="socialChannels" data-param2="${tag}">
              <div class="nav-filter-item-left">
                <div class="nav-filter-item-icon" style="background: linear-gradient(135deg, #ee0979, #ff6a00);">
                  <span>${icon}</span>
                </div>
                <span class="nav-filter-item-text">${formatTag(tag)}</span>
              </div>
              <span class="nav-filter-item-count">${count}</span>
            </div>
          `;
        }).join('');
      }

      // Render AI Models
      const modelsContainer = document.getElementById('navModelsList');
      if (modelsContainer && tagBuckets.models) {
        const models = Object.entries(tagBuckets.models).sort((a, b) => b[1] - a[1]).slice(0, 10);
        modelsContainer.innerHTML = models.map(([tag, count]) => {
          const isActive = activeFilters.models.includes(tag);
          const icon = getFilterIcon(tag);
          return `
            <div class="nav-filter-item ${isActive ? 'active' : ''}" data-action="toggleNavFilter" data-param="models" data-param2="${tag}">
              <div class="nav-filter-item-left">
                <div class="nav-filter-item-icon" style="background: linear-gradient(135deg, #8E2DE2, #4A00E0);">
                  <span>${icon}</span>
                </div>
                <span class="nav-filter-item-text">${formatTag(tag)}</span>
              </div>
              <span class="nav-filter-item-count">${count}</span>
            </div>
          `;
        }).join('');
      }

      // Render API Providers
      const providersContainer = document.getElementById('navProvidersList');
      if (providersContainer && tagBuckets.providers) {
        const providers = Object.entries(tagBuckets.providers).sort((a, b) => b[1] - a[1]).slice(0, 10);
        providersContainer.innerHTML = providers.map(([tag, count]) => {
          const isActive = activeFilters.providers.includes(tag);
          const icon = getFilterIcon(tag);
          return `
            <div class="nav-filter-item ${isActive ? 'active' : ''}" data-action="toggleNavFilter" data-param="providers" data-param2="${tag}">
              <div class="nav-filter-item-left">
                <div class="nav-filter-item-icon" style="background: linear-gradient(135deg, #F97316, #EA580C);">
                  <span>${icon}</span>
                </div>
                <span class="nav-filter-item-text">${formatTag(tag)}</span>
              </div>
              <span class="nav-filter-item-count">${count}</span>
            </div>
          `;
        }).join('');
      }

      // Show/hide clear filters button
      updateClearFiltersButton();
      updateFilterBadge();
    }

    // Select a category from nav drawer
    function selectNavCategory(categoryId) {
      if (categoryId === 'all') {
        activeFilters = { platforms: [], socialChannels: [], verticals: [], modalities: [], models: [], providers: [], vendors: [] };
        renderFilterChips();
        renderNavFilters();
        history.pushState({ category: 'all' }, '', "/aitopia/marketplace/index.html");
        filterCategory('all');
      } else {
        const canonical = resolveCanonicalCategorySlug(categoryId);
        if (canonical) {
          activeFilters = { platforms: [], socialChannels: [], verticals: [], modalities: [], models: [], providers: [], vendors: [] };
          renderFilterChips();
          renderNavFilters();
          history.pushState({ category: canonical }, '', `/category/${canonical}`);
          filterCategory(canonical);
        } else {
          activeFilters = { platforms: [], socialChannels: [], verticals: [], modalities: [], models: [], providers: [], vendors: [] };
          renderFilterChips();
          renderNavFilters();
          history.pushState({ category: 'all' }, '', "/aitopia/marketplace/index.html");
          filterCategory('all');
        }
      }
      renderNavCategories();
      closeNavDrawer();
      // Scroll to agents section
      document.getElementById('agentsTab')?.scrollIntoView({ behavior: 'smooth' });
    }

    // Toggle a filter from nav drawer
    function toggleNavFilter(type, value) {
      const index = activeFilters[type].indexOf(value);
      if (index === -1) {
        activeFilters[type].push(value);
      } else {
        activeFilters[type].splice(index, 1);
      }
      renderNavFilters();
      renderFilterChips();
      populateAgents();
    }

    // Update clear filters button visibility
    function updateClearFiltersButton() {
      const btn = document.getElementById('navClearFiltersBtn');
      if (!btn) return;
      const hasActiveFilters = Object.values(activeFilters).some(arr => arr.length > 0);
      btn.style.display = hasActiveFilters ? 'block' : 'none';
    }

    // Close drawer on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeNavDrawer();
      }
    });

    // =========================================================================
    // END FILTER-BASED NAVIGATION DRAWER FUNCTIONS
    // =========================================================================

    // Render filter chips for platforms, verticals, channels, models (legacy inline chips)
    function renderFilterChips() {
      const container = document.getElementById('filterChipsContainer');
      if (!container) return;

      // Format tag display names
      const formatTag = (tag) => tag.replace(/_/g, ' ').replace(/-/g, ' ')
        .split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

      let html = '';

      // Platforms (show top 8 by count)
      const platforms = Object.entries(tagBuckets.platforms || {})
        .sort((a, b) => b[1] - a[1]).slice(0, 8);
      if (platforms.length > 0) {
        html += `<div class="flex items-center gap-2 flex-wrap">
          <span class="text-xs text-muted-foreground font-medium">Platform:</span>`;
        platforms.forEach(([tag, count]) => {
          const isActive = activeFilters.platforms.includes(tag);
          html += `<button data-action="toggleFilter" data-param="platforms" data-param2="${tag}" class="filter-chip text-xs px-2 py-1 rounded-full transition-all ${isActive ? 'bg-ios-blue text-white' : 'bg-secondary/50 text-secondary-foreground hover:bg-secondary'}" data-filter-type="platforms" data-filter-value="${tag}">${formatTag(tag)} <span class="opacity-60">${count}</span></button>`;
        });
        html += `</div>`;
      }

      // Verticals (show top 6 by count)
      const verticals = Object.entries(tagBuckets.verticals || {})
        .sort((a, b) => b[1] - a[1]).slice(0, 6);
      if (verticals.length > 0) {
        html += `<div class="flex items-center gap-2 flex-wrap mt-2">
          <span class="text-xs text-muted-foreground font-medium">Industry:</span>`;
        verticals.forEach(([tag, count]) => {
          const isActive = activeFilters.verticals.includes(tag);
          html += `<button data-action="toggleFilter" data-param="verticals" data-param2="${tag}" class="filter-chip text-xs px-2 py-1 rounded-full transition-all ${isActive ? 'bg-ios-purple text-white' : 'bg-secondary/50 text-secondary-foreground hover:bg-secondary'}" data-filter-type="verticals" data-filter-value="${tag}">${formatTag(tag)} <span class="opacity-60">${count}</span></button>`;
        });
        html += `</div>`;
      }

      // Social Channels (show top 6)
      const channels = Object.entries(tagBuckets.socialChannels || {})
        .sort((a, b) => b[1] - a[1]).slice(0, 6);
      if (channels.length > 0) {
        html += `<div class="flex items-center gap-2 flex-wrap mt-2">
          <span class="text-xs text-muted-foreground font-medium">Channel:</span>`;
        channels.forEach(([tag, count]) => {
          const isActive = activeFilters.socialChannels.includes(tag);
          html += `<button data-action="toggleFilter" data-param="socialChannels" data-param2="${tag}" class="filter-chip text-xs px-2 py-1 rounded-full transition-all ${isActive ? 'bg-ios-pink text-white' : 'bg-secondary/50 text-secondary-foreground hover:bg-secondary'}" data-filter-type="socialChannels" data-filter-value="${tag}">${formatTag(tag)} <span class="opacity-60">${count}</span></button>`;
        });
        html += `</div>`;
      }

      // Models (show top 6)
      const models = Object.entries(tagBuckets.models || {})
        .sort((a, b) => b[1] - a[1]).slice(0, 6);
      if (models.length > 0) {
        html += `<div class="flex items-center gap-2 flex-wrap mt-2">
          <span class="text-xs text-muted-foreground font-medium">Model:</span>`;
        models.forEach(([tag, count]) => {
          const isActive = activeFilters.models.includes(tag);
          html += `<button data-action="toggleFilter" data-param="models" data-param2="${tag}" class="filter-chip text-xs px-2 py-1 rounded-full transition-all ${isActive ? 'bg-ios-green text-white' : 'bg-secondary/50 text-secondary-foreground hover:bg-secondary'}" data-filter-type="models" data-filter-value="${tag}">${formatTag(tag)} <span class="opacity-60">${count}</span></button>`;
        });
        html += `</div>`;
      }

      // Show active vendor/model filter if set
      if (activeFilters.vendors.length > 0 || window._vendorModelFilter) {
        html += `<div class="flex items-center gap-2 flex-wrap mt-2">
          <span class="text-xs text-muted-foreground font-medium">Vendor:</span>`;
        activeFilters.vendors.forEach(vendor => {
          html += `<button data-action="toggleFilter" data-param="vendors" data-param2="${vendor}" class="filter-chip text-xs px-2 py-1 rounded-full transition-all bg-primary/90 text-primary-foreground" data-filter-type="vendors" data-filter-value="${vendor}">${formatTag(vendor)} ×</button>`;
        });
        if (window._vendorModelFilter) {
          html += `<button data-action="clearVendorModelFilter" class="filter-chip text-xs px-2 py-1 rounded-full transition-all bg-[#7B2BD6] text-white">${window._vendorModelFilter} ×</button>`;
        }
        html += `</div>`;
      }

      // Show active provider filter if set
      if (activeFilters.providers.length > 0) {
        html += `<div class="flex items-center gap-2 flex-wrap mt-2">
          <span class="text-xs text-muted-foreground font-medium">Provider:</span>`;
        activeFilters.providers.forEach(provider => {
          html += `<button data-action="toggleFilter" data-param="providers" data-param2="${provider}" class="filter-chip text-xs px-2 py-1 rounded-full transition-all bg-orange-500 text-white" data-filter-type="providers" data-filter-value="${provider}">${formatTag(provider)} ×</button>`;
        });
        html += `</div>`;
      }

      // Clear filters button (shown only when filters are active)
      const hasActiveFilters = Object.values(activeFilters).some(arr => arr.length > 0) || window._vendorModelFilter;
      if (hasActiveFilters) {
        html += `<div class="mt-2"><button data-action="clearAllFilters" class="text-xs text-ios-red hover:underline">Clear all filters</button></div>`;
      }

      container.innerHTML = html;
    }

    // Clear vendor model filter
    function clearVendorModelFilter() {
      window._vendorModelFilter = null;
      renderFilterChips();
      populateAgents();
    }

    // Toggle a tag filter
    function toggleFilter(type, value) {
      const index = activeFilters[type].indexOf(value);
      if (index === -1) {
        activeFilters[type].push(value);
      } else {
        activeFilters[type].splice(index, 1);
      }
      renderFilterChips();
      populateAgents();
    }

    // Clear all filters
    function clearAllFilters() {
      activeFilters = {
        platforms: [],
        socialChannels: [],
        verticals: [],
        modalities: [],
        models: [],
        providers: [],
        vendors: []
      };
      window._vendorModelFilter = null;
      renderFilterChips();
      renderNavFilters();
      updateFilterBadge();
      populateAgents();
    }

    // Load showcase metadata (SINGLE SOURCE OF TRUTH for visual assets)
    async function loadShowcaseMetadata() {
      try {
        const response = await fetch("https://aitopia.ai/agent-showcase-data.json");
        const showcaseData = await response.json();
        console.log('✅ Loaded showcase metadata for', showcaseData.length, 'agents');

        // Merge showcase data with agents - showcase data overrides hardcoded visuals
        let mergeCount = 0;
        showcaseData.forEach(showcase => {
          if (agents[showcase.id]) {
            // Update visual assets from showcase data (source of truth)
            agents[showcase.id] = {
              ...agents[showcase.id],
              // Override icon if provided
              icon: showcase.icon || agents[showcase.id].icon,
              // Override screenshots with showcase_images (new naming)
              screenshots: showcase.showcase_images?.length > 0
                ? showcase.showcase_images
                : agents[showcase.id].screenshots,
              // Add new fields
              featured_video: showcase.featured_video,
              showcase_images: showcase.showcase_images,
              showcase_videos: showcase.showcase_videos,
              capabilities: showcase.capabilities || agents[showcase.id].capabilities,
              tags: showcase.tags || agents[showcase.id].tags,
              source: showcase.source || 'local'
            };
            mergeCount++;
          } else {
            // Add new agent from showcase data
            agents[showcase.id] = {
              id: showcase.id,
              name: showcase.name,
              description: showcase.description,
              category: showcase.category,
              categoryKey: showcase.category,
              icon: showcase.icon,
              screenshots: showcase.showcase_images || [],
              featured_video: showcase.featured_video,
              showcase_images: showcase.showcase_images,
              showcase_videos: showcase.showcase_videos,
              capabilities: showcase.capabilities || [],
              tags: showcase.tags || [],
	              source: showcase.source || 'local',
	              rating: 4.5,
	              reviews: '1K',
	              price: '$0.25',
	              features: showcase.capabilities || []
	            };
            mergeCount++;
            //console.log(`  + New agent from showcase: ${showcase.id}`);
          }
        });
        //console.log(`✅ Merged/added showcase data for ${mergeCount} agents`);
      } catch (err) {
        console.error('❌ Could not load showcase metadata:', err);
      }
    }

    // Load AI models from /api/models/all endpoint
    async function loadModelsFromAPI() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/models/all?shuffle=true`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        // Store models with cover images
        aiModels = data.models || [];

        //console.log(`✅ Loaded ${aiModels.length} AI models from API`);
        populateModelsGrid();
      } catch (err) {
        console.error('❌ Could not load AI models:', err);
      }
    }

	    // Render functions
	    function renderAgentCard(agent, isPopular = false) {
      // For video category agents
      const cat = agent.category?.toLowerCase() || '';
      const isVideoCategory = cat === 'video' || cat === 'higgsfield-video' || cat.includes('video');
      let mediaUrl;
      if (isVideoCategory) {
        mediaUrl = agent.featured_video || agent.showcase_videos?.[0] || agent.videos?.[0] || agent.showcase_images?.[0] || agent.icon || agent.screenshots?.[0];
      } else {
        mediaUrl = agent.showcase_images?.[0] || agent.featured_video || agent.showcase_videos?.[0] || agent.icon || agent.videos?.[0] || agent.screenshots?.[0];
      }
      const isVideo = mediaUrl?.endsWith('.mp4') || mediaUrl?.endsWith('.webm');
	      const isUnavailable = agent.available === false;
      const showPopular = Boolean(agent.popular) || Boolean(isPopular);

	      return `
	        <a href="/aitopia/marketplace/agent/${agent.id}.html" class="agent-card group bg-card rounded-ios-2xl border border-border/40 overflow-hidden card-hover cursor-pointer stagger-item w-full flex flex-col no-underline text-inherit ${isUnavailable ? 'opacity-75' : ''}">
          <div class="card-media relative aspect-square bg-secondary/50 overflow-hidden flex items-center justify-center rounded-b-[20px]"${isVideo ? ` data-video-src="${mediaUrl}"` : ''}>
            ${
              isVideo
                ? `<video class="w-full h-full object-cover rounded-b-[20px] pointer-events-none" preload="metadata" muted playsinline><source src="${mediaUrl}" type="video/mp4"></video>`
                  + `<div class="absolute inset-0 flex items-center justify-center pointer-events-none"><div class="w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center"><svg class="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div></div>`
                : `<img src="${mediaUrl}" alt="${agent.name}" class="w-full h-full object-cover img-zoom rounded-b-[20px] pointer-events-none" loading="lazy">`
            }
            ${showPopular ? '<span class="popular-badge absolute top-3 left-3 px-3 py-1 rounded-full bg-primary/90 text-primary-foreground text-xs font-semibold shadow-sm">Popular</span>' : ''}
            ${isUnavailable ? '<span class="absolute top-3 right-3 px-3 py-1 rounded-full bg-amber-500/90 text-white text-xs font-semibold shadow-sm">Coming Soon</span>' : ''}
          </div>
	          <div class="card-info p-4 flex flex-col flex-1">
              <h3 class="mt-1 text-[16px] leading-snug font-semibold text-foreground truncate">${agent.name}</h3>
	            <p class="mt-2 text-[12px] font-normal text-muted-foreground line-clamp-2 leading-snug">${agent.description}</p>

	            <div class="mt-auto pt-4 flex items-center justify-between gap-3">
                <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground text-[12px] font-medium max-w-[140px] text-center whitespace-normal leading-tight">
                  <svg class="w-4 h-4 opacity-80" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M14.6667 5.66634C14.6667 8.05967 12.7267 9.99967 10.3333 9.99967C10.22 9.99967 10.1 9.99302 9.98667 9.98635C9.82001 7.87302 8.12666 6.17967 6.01333 6.013C6.00666 5.89967 6 5.77967 6 5.66634C6 3.27301 7.94 1.33301 10.3333 1.33301C12.7267 1.33301 14.6667 3.27301 14.6667 5.66634Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M10 10.3333C10 12.7267 8.06004 14.6667 5.66671 14.6667C3.27337 14.6667 1.33337 12.7267 1.33337 10.3333C1.33337 7.94 3.27337 6 5.66671 6C5.78004 6 5.90003 6.00666 6.01337 6.01333C8.1267 6.17999 9.82005 7.87334 9.98671 9.98667C9.99338 10.1 10 10.22 10 10.3333Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M5.08 9.74699L5.66667 8.66699L6.25334 9.74699L7.33333 10.3337L6.25334 10.9203L5.66667 12.0003L5.08 10.9203L4 10.3337L5.08 9.74699Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  <span>${getCreditsLabelForAgent(agent)}</span>
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

    function renderAgentRow(agent) {
      // Always use image thumbnail for row view (never load video for tiny 16x16 thumbnails)
      const thumbUrl = agent.showcase_images?.[0] || agent.icon || agent.screenshots?.[0];

      return `
        <a href="/aitopia/marketplace/agent/${agent.id}.html" class="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors cursor-pointer stagger-item no-underline text-inherit">
          <img src="${thumbUrl}" alt="${agent.name}" class="w-16 h-16 rounded-ios-lg object-cover app-icon flex-shrink-0" loading="lazy">
          <div class="flex-1 min-w-0">
            <h3 class="font-semibold text-sm truncate">${agent.name}</h3>
            <p class="text-xs text-muted-foreground truncate">${agent.description}</p>
            <div class="flex items-center gap-2 mt-1">
              <div class="flex items-center gap-0.5">
                <svg class="w-3 h-3 text-ios-orange" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                </svg>
                <span class="text-xs">${agent.rating}</span>
              </div>
              <span class="text-xs text-muted-foreground">${agent.category}</span>
            </div>
          </div>
	          <button class="px-4 py-1.5 rounded-full ${isAgentFree(agent) ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'} text-xs font-semibold btn-press flex-shrink-0">
	            ${getCreditsLabelForAgent(agent)}
	          </button>
        </a>
      `;
    }

	    // Render model card (for AI Models section)
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
	      const displayName = model.displayName || model.id.split('/').pop();
	      const provider = model.id.split('/')[0] || model.provider;
	      const capability = model.capabilities?.[0] || model.mediaType || 'AI Model';
      // Use a gradient background div as fallback instead of placeholder service
      const hasCoverImage = model.coverImageUrl && model.coverImageUrl !== 'null';

      // Link to model playground
      const modelUrl = buildPublicModelUrl(model.id);

      return `
        <a href="${modelUrl}" class="group w-full bg-card rounded-ios-2xl border border-border/50 overflow-hidden card-hover cursor-pointer stagger-item no-underline text-inherit">
          <div class="relative aspect-[4/3] bg-muted overflow-hidden">
            ${hasCoverImage
              ? `<img src="${model.coverImageUrl}" alt="${displayName}" class="absolute inset-0 w-full h-full object-cover img-zoom pointer-events-none" loading="lazy" data-hide-on-error-show-sibling>
                 <div class="absolute inset-0 w-full h-full items-center justify-center text-4xl hidden" style="background: linear-gradient(135deg, #8B5CF6, #6366F1);">🤖</div>`
              : `<div class="absolute inset-0 w-full h-full flex items-center justify-center text-4xl" style="background: linear-gradient(135deg, #8B5CF6, #6366F1);">🤖</div>`
            }
            <span class="absolute top-3 left-3 px-2 py-0.5 rounded-full bg-violet-500/90 text-white text-xs font-medium">${capability}</span>
          </div>
	          <div class="p-4">
	            <div class="flex items-start justify-between gap-2 mb-2">
	              <div class="flex-1 min-w-0">
	                <h3 class="font-semibold text-sm truncate">${displayName}</h3>
	                <p class="text-xs text-muted-foreground">${provider}</p>
	              </div>
	            </div>
	            <div class="flex items-center justify-between">
              <div class="flex items-center gap-1">
                <svg class="w-3.5 h-3.5 text-violet-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd"/>
                </svg>
                <span class="text-xs font-medium">Playground</span>
              </div>
              <button class="px-3 py-1.5 rounded-full bg-violet-500/10 text-violet-400 text-xs font-semibold btn-press">
                Try It
              </button>
            </div>
          </div>
        </a>
      `;
    }

    // Category display names (updated for new primary categories)
    const categoryNames = {
      'all': 'All',
      'image': 'Image',
      'video': 'Video',
      'audio': 'Audio & Voice',
      'productivity': 'Productivity',
      'marketing': 'Marketing',
      'commerce': 'Commerce',
      'dev': 'Dev & Data',
      'business': 'Business',
      // Legacy fallbacks
      'audio-voice': 'Audio & Voice',
      'marketing-social': 'Marketing',
      'commerce-websites': 'Commerce',
      'dev-data': 'Dev & Data',
      'models': 'Dev & Data',
      'sales-support': 'Business',
      'industry-packs': 'Business',
      'travel': 'Productivity',
      'education': 'Productivity',
      'creative': 'Image',
      'ecommerce': 'Commerce',
      'analytics': 'Dev & Data'
    };

    // Check if agent matches a category (supports primaryCategory + additionalCategories)
    function agentMatchesCategory(agent, category) {
      if (category === 'all') return true;
      const canonical = resolveCanonicalCategorySlug(category);

      // Canonical category match (Option C): map agent categories -> canonical and compare
      if (canonical) {
        const candidates = [
          agent.primaryCategory,
          ...(agent.additionalCategories || []),
          agent.categoryKey,
        ].filter(Boolean);
        return candidates.some(c => resolveCanonicalCategorySlug(c) === canonical);
      }

      // Fallback: match by primaryCategory/additionalCategories/categoryKey as-is
      if (agent.primaryCategory === category) return true;
      if (agent.additionalCategories && agent.additionalCategories.includes(category)) return true;
      if (agent.categoryKey === category) return true;
      return false;
    }

    // Check if agent matches all active tag filters (AND logic within each type, OR logic between items)
    function matchesTagFilters(agent) {
      // If no filters active, match all
      const hasAnyFilter = Object.values(activeFilters).some(arr => arr.length > 0);
      if (!hasAnyFilter) return true;

      // Check each filter type - agent must match at least one value in each active filter type
      if (activeFilters.platforms.length > 0) {
        if (!agent.platforms || !activeFilters.platforms.some(p => agent.platforms.includes(p))) {
          return false;
        }
      }
      if (activeFilters.socialChannels.length > 0) {
        if (!agent.socialChannels || !activeFilters.socialChannels.some(c => agent.socialChannels.includes(c))) {
          return false;
        }
      }
      if (activeFilters.verticals.length > 0) {
        if (!agent.verticals || !activeFilters.verticals.some(v => agent.verticals.includes(v))) {
          return false;
        }
      }
      if (activeFilters.modalities.length > 0) {
        if (!agent.modalities || !activeFilters.modalities.some(m => agent.modalities.includes(m))) {
          return false;
        }
      }
      if (activeFilters.models.length > 0) {
        if (!agent.models || !activeFilters.models.some(m => agent.models.includes(m))) {
          return false;
        }
      }
      // Provider filter - check modelChoices for matching providers
      if (activeFilters.providers.length > 0) {
        const agentProviders = getAgentProviders(agent);
        if (agentProviders.length === 0 || !activeFilters.providers.some(p => agentProviders.includes(p.toLowerCase()))) {
          return false;
        }
      }
      // Vendor filter - check modelChoices for matching vendors (model owners)
      if (activeFilters.vendors.length > 0) {
        const agentVendors = getAgentVendors(agent);
        if (agentVendors.length === 0 || !activeFilters.vendors.some(v => agentVendors.includes(v.toLowerCase()))) {
          return false;
        }
      }
      // Specific model filter (from /vendor/model-name routes)
      if (window._vendorModelFilter) {
        const modelFilter = window._vendorModelFilter.toLowerCase();
        if (!agent.modelChoices || agent.modelChoices.length === 0) return false;
        const hasModel = agent.modelChoices.some(m => m.id && m.id.toLowerCase().includes(modelFilter));
        if (!hasModel) return false;
      }
      return true;
    }

    // Combined filter: category + tags
    function agentMatchesFilters(agent) {
      return agentMatchesCategory(agent, currentCategory) && matchesTagFilters(agent);
    }

    // Populate agents
    // Track if showing all agents in the list
    let showingAllAgents = false;
    const INITIAL_AGENT_LIMIT = 18;
    const POPULAR_AGENT_LIMIT = 10;

    let _lastPopularKey = '';
    let _lastAllKey = '';
    function populateAgents() {
      const popular = Object.values(agents).filter(a => a.popular && agentMatchesFilters(a));
      const filtered = Object.values(agents).filter(a => agentMatchesFilters(a));
      const displayPopular = popular.slice(0, POPULAR_AGENT_LIMIT);
      const displayFiltered = showingAllAgents ? filtered : filtered.slice(0, INITIAL_AGENT_LIMIT);

      // Titles (cheap, always update)
      const categoryName = categoryNames[currentCategory] || currentCategory;
      document.getElementById('popularTitle').textContent = currentCategory === 'all'
        ? 'Popular Right Now' : `Popular ${categoryName} Agents`;
      document.getElementById('allAgentsTitle').textContent = currentCategory === 'all'
        ? 'All Agents' : `${categoryName} Agents`;
      document.getElementById('agentCount').textContent = `${filtered.length} agents`;

      // Skip DOM rebuild if same agents are shown
      const popKey = displayPopular.map(a => a.id).join();
      const allKey = displayFiltered.map(a => a.id).join() + (showingAllAgents ? ':all' : '');

      const popularContainer = document.getElementById('popularAgents');
      if (popKey !== _lastPopularKey) {
        _lastPopularKey = popKey;
        if (popular.length > 0) {
          popularContainer.innerHTML = displayPopular.map(a => renderAgentCard(a, true)).join('');
          window.AitopiaLazyMedia?.observe(popularContainer);
          requestAnimationFrame(() => balanceMasonryGrid(popularContainer));
        } else {
          popularContainer.innerHTML = `<p class="text-muted-foreground text-sm col-span-full text-center py-8">No popular agents matching filters</p>`;
        }
      }

      if (allKey !== _lastAllKey) {
        _lastAllKey = allKey;
        let allAgentsHtml = displayFiltered.map(a => renderAgentRow(a)).join('');
        if (!showingAllAgents && filtered.length > INITIAL_AGENT_LIMIT) {
          allAgentsHtml += `
            <div class="col-span-full text-center py-6">
              <button data-action="goToAgentsPage" data-param="${currentCategory}" class="px-6 py-3 rounded-full bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors btn-press">
                See All Agents
              </button>
            </div>
          `;
        }
        const allAgentsEl = document.getElementById('allAgents');
        allAgentsEl.innerHTML = allAgentsHtml;
        window.AitopiaLazyMedia?.observe(allAgentsEl);
      }

      populateCategoryGrids();
    }

    // Show all agents when "See All" is clicked
    function showAllAgents() {
      showingAllAgents = true;
      populateAgents();
      // Scroll to the agents section
      document.getElementById('allAgents')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Populate category grids (Image, Video, Commerce, Productivity) — one-time
    let _catGridsDone = false;
    function populateCategoryGrids() {
      if (_catGridsDone) { populateModelsGrid(); return; }
      _catGridsDone = true;

      const imageAgents = Object.values(agents).filter(a => agentMatchesCategory(a, 'image')).slice(0, 5);
      const videoAgents = Object.values(agents).filter(a => agentMatchesCategory(a, 'video')).slice(0, 5);
      const ecommerceAgents = Object.values(agents).filter(a => agentMatchesCategory(a, 'commerce')).slice(0, 5);
      const productivityAgents = Object.values(agents).filter(a => agentMatchesCategory(a, 'productivity')).slice(0, 5);

      const imageGrid = document.getElementById('imageAgentsGrid');
      const videoGrid = document.getElementById('videoAgentsGrid');
      const ecommerceGrid = document.getElementById('ecommerceAgentsGrid');
      const productivityGrid = document.getElementById('productivityAgentsGrid');

      if (imageGrid) {
        imageGrid.innerHTML = imageAgents.map(a => renderAgentCard(a)).join('');
        window.AitopiaLazyMedia?.observe(imageGrid);
      }
      if (videoGrid) {
        videoGrid.innerHTML = videoAgents.map(a => renderAgentCard(a)).join('');
        window.AitopiaLazyMedia?.observe(videoGrid);
      }
      if (ecommerceGrid) {
        ecommerceGrid.innerHTML = ecommerceAgents.map(a => renderAgentCard(a)).join('');
        window.AitopiaLazyMedia?.observe(ecommerceGrid);
      }
      if (productivityGrid) {
        productivityGrid.innerHTML = productivityAgents.map(a => renderAgentCard(a)).join('');
        window.AitopiaLazyMedia?.observe(productivityGrid);
      }

      populateModelsGrid();
    }

    // Populate AI Models grid — one-time
    let _modelsGridDone = false;
    function populateModelsGrid() {
      if (_modelsGridDone) return;
      const modelsGrid = document.getElementById('modelsGrid');
      if (modelsGrid && aiModels.length > 0) {
        _modelsGridDone = true;
        const displayModels = aiModels.slice(0, 5);
        modelsGrid.innerHTML = displayModels.map(m => renderModelCard(m)).join('');
      }
    }

    // ── Community Creations
    let communityCreations = [];

    async function loadCommunityCreations() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/discover?sort=trending&limit=10`);
        if (!res.ok) return;
        const data = await res.json();
        communityCreations = data.outputs || [];
      } catch (e) {
        console.warn('Could not load community creations', e);
      }
    }

    function renderCommunityCard(output) {
      const id = String(output.id || '');
      const title = String(output.title || output.prompt || '');
      const agentId = String(output.sourceStoreId || '');
      const creator = output.creator?.username || output.creatorProfile?.username || '';
      const previewUrl = output.preview?.url || '';
      const isVideo = output.preview?.kind === 'video';

      const escapedUrl = escapeHtml(previewUrl);
      const media = isVideo
        ? `<video class="w-full h-full object-cover pointer-events-none" preload="metadata" muted playsinline><source src="${escapedUrl}" type="video/mp4"></video>`
        : `<img src="${escapedUrl}" alt="" class="w-full h-full object-cover pointer-events-none" loading="lazy" />`;

      return `
        <a href="/aitopia/marketplace/outputs.html?id=${escapeHtml(id)}" class="group block rounded-ios-xl overflow-hidden bg-card border border-border/40 cursor-pointer">
          <div class="relative aspect-square overflow-hidden"${isVideo ? ` data-video-src="${escapedUrl}"` : ''}>
            ${media}${isVideo ? '<div class="absolute inset-0 flex items-center justify-center pointer-events-none"><div class="w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center"><svg class="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div></div>' : ''}
            <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-3">
              <div class="transform translate-y-3 group-hover:translate-y-0 transition-transform duration-200">
                <h3 class="text-white font-semibold text-xs line-clamp-2 mb-0.5">${escapeHtml(title)}</h3>
                <p class="text-white/70 text-[11px]">${escapeHtml(agentId)}</p>
                <p class="text-white/60 text-[11px]">by ${escapeHtml(creator)}</p>
              </div>
            </div>
          </div>
        </a>`;
    }

    let _communityDone = false;
    function populateCommunityCreations() {
      if (_communityDone) return;
      const section = document.getElementById('communityCreationsSection');
      const grid = document.getElementById('communityCreationsGrid');
      if (!grid || !communityCreations.length) return;
      _communityDone = true;
      grid.innerHTML = communityCreations.map(o => renderCommunityCard(o)).join('');
      if (section) section.style.display = '';
      window.AitopiaLazyMedia?.observe(grid);
    }

    // Populate New & Noteworthy grid — one-time
    let _newNoteworthyDone = false;
    function populateNewNoteworthy() {
      if (_newNoteworthyDone) return;
      const grid = document.getElementById('newNoteworthyGrid');
      if (!grid) return;
      _newNoteworthyDone = true;
      const newAgents = Object.values(agents).slice(0, 10);
      grid.innerHTML = newAgents.map(a => renderAgentCard(a)).join('');
      window.AitopiaLazyMedia?.observe(grid);
    }

    // Populate Top Charts grid — one-time
    let _topChartsDone = false;
    function populateTopCharts() {
      if (_topChartsDone) return;
      const grid = document.getElementById('topChartsGrid');
      if (!grid) return;
      _topChartsDone = true;
      const topCharts = Object.values(agents)
        .sort((a, b) => parseFloat(b.downloads) - parseFloat(a.downloads))
        .slice(0, 9);
      grid.innerHTML = topCharts.map((a, i) => renderTopChartCard(a, i + 1)).join('');
    }

    // Render top chart card with ranking
    function renderTopChartCard(agent, rank) {
      return `
        <a href="/aitopia/marketplace/agent/${agent.id}.html" class="flex items-center gap-3 p-3 bg-card rounded-ios-xl border border-border/50 cursor-pointer hover:bg-muted/30 transition-colors no-underline text-inherit">
          <span class="text-2xl font-bold text-muted-foreground w-8">${rank}</span>
          <img src="${agent.showcase_images?.[0] || agent.icon}" class="w-14 h-14 rounded-ios object-cover app-icon" alt="${agent.name}" loading="lazy">
          <div class="flex-1 min-w-0">
            <p class="font-medium truncate">${agent.name}</p>
            <p class="text-sm text-muted-foreground truncate">${agent.subtitle}</p>
          </div>
          <button class="px-4 py-1.5 rounded-full bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors btn-press flex-shrink-0">
            Get
          </button>
        </a>
      `;
    }

    // Populate Top Rated grid — one-time
    let _topRatedDone = false;
    function populateTopRated() {
      if (_topRatedDone) return;
      const grid = document.getElementById('topRatedGrid');
      if (!grid) return;
      _topRatedDone = true;
      const topRated = Object.values(agents)
        .sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating))
        .slice(0, 8);
      grid.innerHTML = topRated.map(a => renderAgentCard(a)).join('');
      window.AitopiaLazyMedia?.observe(grid);
    }

    // Populate Editor's Choice grid — one-time
    let _editorsChoiceDone = false;
    function populateEditorsChoice() {
      if (_editorsChoiceDone) return;
      const grid = document.getElementById('editorsChoiceGrid');
      if (!grid) return;
      _editorsChoiceDone = true;
      const editorsPicks = Object.values(agents)
        .filter(a => a.popular)
        .slice(0, 8);
      grid.innerHTML = editorsPicks.map(a => renderAgentCard(a)).join('');
      window.AitopiaLazyMedia?.observe(grid);
    }

    // Switch between slider tabs (4 tabs)
    function switchSliderTab(tab) {
      // Update tab button states
      document.querySelectorAll('.slider-tab').forEach(btn => {
        if (btn.dataset.slider === tab) {
          btn.classList.add('active');
          btn.classList.remove('text-muted-foreground');
        } else {
          btn.classList.remove('active');
          btn.classList.add('text-muted-foreground');
        }
      });

      // Show/hide slider content
      document.querySelectorAll('.slider-content').forEach(content => {
        content.classList.add('hidden');
      });

      // Show the selected tab content and populate
      switch(tab) {
        case 'new-noteworthy':
          document.getElementById('sliderNewNoteworthyContent').classList.remove('hidden');
          populateNewNoteworthy();
          break;
        case 'top-charts':
          document.getElementById('sliderTopChartsContent').classList.remove('hidden');
          populateTopCharts();
          break;
        case 'top-rated':
          document.getElementById('sliderTopRatedContent').classList.remove('hidden');
          populateTopRated();
          break;
        case 'editors-choice':
          document.getElementById('sliderEditorsChoiceContent').classList.remove('hidden');
          populateEditorsChoice();
          break;
      }

      // Balance masonry grids after content changes
      setTimeout(balanceAllMasonryGrids, 0);
    }

    // Filter by category
    function filterCategory(category) {
      const resolved = category === 'all' ? 'all' : (resolveCanonicalCategorySlug(category) || category);
      currentCategory = resolved;
      showingAllAgents = false; // Reset to show limited agents when category changes

      // Update button states
      document.querySelectorAll('.category-btn').forEach(btn => {
        if (btn.dataset.category === resolved) {
          btn.classList.add('bg-primary', 'text-primary-foreground');
          btn.classList.remove('bg-secondary', 'text-secondary-foreground');
        } else {
          btn.classList.remove('bg-primary', 'text-primary-foreground');
          btn.classList.add('bg-secondary', 'text-secondary-foreground');
        }
      });

      populateAgents();
    }

    // Search from header
    let _searchDebounce = null;
    document.getElementById('searchInput').addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      if (query.length === 0) {
        clearTimeout(_searchDebounce);
        showingAllAgents = false;
        populateAgents();
        return;
      }

      clearTimeout(_searchDebounce);
      _searchDebounce = setTimeout(() => {
      // Reset category to all and clear tag filters when searching
      currentCategory = 'all';
      showingAllAgents = false;
      activeFilters = { platforms: [], socialChannels: [], verticals: [], modalities: [], models: [], providers: [], vendors: [] };
      document.querySelectorAll('.category-btn').forEach(btn => {
        if (btn.dataset.category === 'all') {
          btn.classList.add('bg-primary', 'text-primary-foreground');
          btn.classList.remove('bg-secondary', 'text-secondary-foreground');
        } else {
          btn.classList.remove('bg-primary', 'text-primary-foreground');
          btn.classList.add('bg-secondary', 'text-secondary-foreground');
        }
      });
      renderFilterChips();

      const filtered = Object.values(agents).filter(a =>
        a.name?.toString().toLowerCase().includes(query) ||
        a.description?.toString().toLowerCase().includes(query) ||
        (a.category && a.category?.toString().toLowerCase().includes(query)) ||
        (a.primaryCategory && a.primaryCategory?.toString().toLowerCase().includes(query))
      );

      // Update section titles for search
      document.getElementById('popularTitle').textContent = `Search Results`;
      document.getElementById('allAgentsTitle').textContent = `Results for "${query}"`;

      // Update Popular section with search results
      const popularFiltered = filtered.filter(a => a.popular);
      const popularContainer = document.getElementById('popularAgents');
      if (popularFiltered.length > 0) {
        popularContainer.innerHTML = popularFiltered.map(a => renderAgentCard(a, true)).join('');
      } else if (filtered.length > 0) {
        popularContainer.innerHTML = `<p class="text-muted-foreground text-sm col-span-full text-center py-8">No popular agents match "${query}"</p>`;
      } else {
        popularContainer.innerHTML = `<p class="text-muted-foreground text-sm col-span-full text-center py-8">No results found</p>`;
      }

      // Update All Agents section
      document.getElementById('allAgents').innerHTML = filtered.length > 0
        ? filtered.map(a => renderAgentRow(a)).join('')
        : `<p class="text-muted-foreground text-sm text-center py-8">No agents found for "${query}"</p>`;
      document.getElementById('agentCount').textContent = `${filtered.length} results`;

      // Don't auto-scroll — let the user see suggestions/results without losing scroll position
/*       if (filtered.length > 0) {
        document.getElementById('allAgents').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } */
      }, 500);
    });

    /**
     * Format unit price from model cost information
     * @param {Object} agent - Agent with modelChoices array
     * @returns {string} Formatted price string like "$0.04/image" or null if no cost info
     */
    function formatUnitPrice(agent) {
      const modelChoices = agent.modelChoices || [];
      // Get the recommended model (first one) or any model with cost info
      const modelWithCost = modelChoices.find(m => m.recommended && m.cost) || modelChoices.find(m => m.cost);

      if (!modelWithCost?.cost) return null;

      const cost = modelWithCost.cost;
      const price = cost.perOutput || cost.perSecond;
      if (!price) return null;

      // Format unit label
      const unitLabels = {
        'image': 'image',
        'video_sec': 'sec',
        'audio_sec': 'sec',
        'run': 'run',
        'edit': 'edit',
        'podcast': 'podcast',
        'transcription': 'transcription'
      };
      const unitLabel = unitLabels[cost.unit] || cost.unit;

      // Format price - show minimal decimal places
      let priceStr;
      if (price >= 1) {
        priceStr = `$${price.toFixed(2)}`;
      } else if (price >= 0.1) {
        priceStr = `$${price.toFixed(2)}`;
      } else if (price >= 0.01) {
        priceStr = `$${price.toFixed(3).replace(/0+$/, '')}`;
      } else {
        priceStr = `$${price.toFixed(4).replace(/0+$/, '')}`;
      }

      return `${priceStr}/${unitLabel}`;
    }

    /**
     * Get cost display text for an agent
     * @param {Object} agent - Agent object
     * @returns {string} Cost display text
     */
    function getCostDisplayText(agent) {
      const unitPrice = formatUnitPrice(agent);
      if (unitPrice) {
        return unitPrice;
      }
	      return getCreditsLabelForAgent(agent);
    }

    // Generate agent-specific modal content
    // Open detail modal with interactive workspace
    // skipPushState: true when called from deep links/popstate to avoid history loops
    async function openDetail(agentId, skipPushState = false) {
      const agent = agents[agentId];
      if (!agent) return;

      // Check if agent is unavailable
      const isUnavailable = agent.available === false;
      const unavailableReason = agent.unavailableReason || 'Coming soon - implementation in progress';

      // Get unit price from model cost information
      const unitPrice = formatUnitPrice(agent);
      const costDisplay = getCostDisplayText(agent);

      // Phase B: Keep /store as discovery-only by default.
      // Legacy safety net: /agent/:id/run?legacy=1 serves store.html and should retain the old in-store runner UX.
      const urlParams = new URLSearchParams(window.location.search);
      const isLegacyRunner = urlParams.get('legacy') === '1' || urlParams.get('legacy') === 'true';

      // New canonical behavior: Store is discovery-only. Clicking an agent should immediately
      // full-navigate to the canonical SEO page at /agents/:id (runner is embedded there).
      const encodedAgentId = encodeURIComponent(agent.id);
      if (!isLegacyRunner) {
        window.location.href = `/aitopia/marketplace/agent/${encodedAgentId}.html`;
        return;
      }

      if (isLegacyRunner) {
        try {
          await legacyRunnerReady;
        } catch (err) {
          console.error('Failed to load legacy runner script:', err);
          if (typeof showNotification === 'function') {
            showNotification('Failed to load legacy runner. Please reload the page.', 'error');
          }
        }
      }

      const agentDetailUrl = `/aitopia/marketplace/agent/${encodedAgentId}.html`;
      const runnerUrl = `/aitopia/marketplace/agent/${encodedAgentId}.html`;
      const legacyRunnerUrl = `/agent/${encodedAgentId}/run?legacy=1`;

      const runnerInfoUI = `
        <div class="p-4 rounded-ios-xl border border-border/50 bg-muted/20">
          <p class="text-sm text-muted-foreground">
            Execution runs directly on the agent page for faster loading and better reliability.
          </p>
          <div class="flex flex-wrap gap-2 mt-3">
            <a href="${agentDetailUrl}" class="px-3 py-2 rounded-ios bg-secondary text-secondary-foreground hover:bg-secondary/80 text-xs font-medium transition-colors">
              Open SEO Page
            </a>
          </div>
        </div>
      `;

      // Get agent-specific UI (legacy runner only) or the runner CTA (default)
      const agentSpecificUI = (isLegacyRunner && typeof getAgentSpecificUI === 'function') ? getAgentSpecificUI(agent) : runnerInfoUI;

      const primaryActionHtml = isLegacyRunner
        ? `
          <button
            id="generateBtn-${agent.id}"
            data-action="generateOutput" data-param="${agent.id}"
            class="w-full py-4 rounded-ios-xl ${isUnavailable ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-primary text-primary-foreground hover:opacity-90 btn-press'} font-semibold text-base transition-all flex items-center justify-center gap-2"
            ${isUnavailable ? 'disabled' : ''}
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
	            ${isUnavailable ? 'Coming Soon' : `Generate — ${getCreditsLabelForAgent(agent)}`}
          </button>
        `
        : `
          <a
            href="${runnerUrl}"
            id="openRunnerBtn-${agent.id}"
            class="w-full py-4 rounded-ios-xl ${isUnavailable ? 'bg-muted text-muted-foreground cursor-not-allowed pointer-events-none' : 'bg-primary text-primary-foreground hover:opacity-90 btn-press'} font-semibold text-base transition-all flex items-center justify-center gap-2"
            ${isUnavailable ? 'aria-disabled="true"' : ''}
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
	            ${isUnavailable ? 'Coming Soon' : `Open Runner — ${getCreditsLabelForAgent(agent)}`}
          </a>
        `;

      document.getElementById('modalContent').innerHTML = `
        <div class="max-w-5xl mx-auto">
          <!-- Header Section -->
          <div class="p-6 pb-4 border-b border-border/50">
            <div class="flex gap-4">
              <img src="${agent.showcase_images?.[0] || agent.icon}" alt="${agent.name}" class="w-16 h-16 md:w-20 md:h-20 rounded-ios-xl object-cover app-icon flex-shrink-0">
              <div class="flex-1 min-w-0">
                <h2 class="text-xl md:text-2xl font-bold mb-0.5">${agent.name}</h2>
                <p class="text-sm text-muted-foreground">${agent.category}</p>
                <div class="flex items-center gap-2 mt-1">
                  <svg class="w-4 h-4 text-ios-orange" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
                  </svg>
                  <span class="text-sm font-medium">${agent.rating}</span>
                  <span class="text-xs text-muted-foreground">(${agent.reviews})</span>
	                  <span class="px-2 py-0.5 rounded-full ${isAgentFree(agent) ? 'bg-ios-green/20 text-ios-green' : 'bg-ios-blue/20 text-ios-blue'} text-xs font-medium ml-2">${getCreditsLabelForAgent(agent)}</span>
                </div>
              </div>
              <!-- Share Button -->
              <div class="relative flex-shrink-0">
                <button
                  data-action="toggleAgentShareMenu" data-param="${agent.id}"
                  class="share-toggle-btn p-2 rounded-ios-lg hover:bg-muted transition-colors"
                  title="Share"
                  aria-label="Share agent"
                >
                  <svg class="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/>
                  </svg>
                </button>
                <!-- Share Dropdown Menu -->
                <div id="agentShareMenu-${agent.id}" class="hidden share-menu absolute right-0 top-full mt-2 w-48 bg-card rounded-ios-xl border border-border shadow-lg z-50 overflow-hidden">
                  <button data-action="copyAgentLink" data-param="${agent.id}" class="share-menu-item w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm">
                    <svg class="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
                    </svg>
                    <span>Copy Link</span>
                  </button>
                  <button data-action="shareAgent" data-param="${agent.id}" data-param2="email" class="share-menu-item w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm">
                    <svg class="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                    </svg>
                    <span>Email</span>
                  </button>
                  <div class="border-t border-border/50"></div>
                  <button data-action="shareAgent" data-param="${agent.id}" data-param2="twitter" class="share-menu-item w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm">
                    <svg class="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                    <span>X (Twitter)</span>
                  </button>
                  <button data-action="shareAgent" data-param="${agent.id}" data-param2="facebook" class="share-menu-item w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm">
                    <svg class="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                    <span>Facebook</span>
                  </button>
                  <button data-action="shareAgent" data-param="${agent.id}" data-param2="linkedin" class="share-menu-item w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm">
                    <svg class="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                    <span>LinkedIn</span>
                  </button>
                  <button data-action="shareAgent" data-param="${agent.id}" data-param2="whatsapp" class="share-menu-item w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm">
                    <svg class="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    <span>WhatsApp</span>
                  </button>
                </div>
              </div>
            </div>
            <p class="text-sm text-muted-foreground mt-4">${agent.description}</p>
            ${isUnavailable ? `
              <div class="mt-4 p-3 rounded-ios-lg bg-amber-500/10 border border-amber-500/30">
                <div class="flex items-center gap-2">
                  <svg class="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <span class="text-sm text-amber-500 font-medium">${unavailableReason}</span>
                </div>
              </div>
            ` : ''}
          </div>

          <!-- Two-column layout on desktop -->
          <div class="md:grid md:grid-cols-2 md:gap-6">
            <!-- Left Column: Inputs -->
            <div class="p-6">
              <h3 class="text-lg font-semibold mb-4">${isLegacyRunner ? 'Configuration' : 'Run'}</h3>
              ${agentSpecificUI}

              ${primaryActionHtml}

              <!-- Run via API Button -->
              <button
                data-action="openApiModal" data-param="${agent.id}"
                class="w-full mt-3 py-3 rounded-ios-xl border border-border ${isUnavailable ? 'bg-muted/30 text-muted-foreground cursor-not-allowed' : 'bg-background text-foreground hover:bg-muted/50 btn-press'} font-medium text-sm transition-all flex items-center justify-center gap-2"
                ${isUnavailable ? 'disabled' : ''}
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/>
                </svg>
                Run via API
              </button>

              <p class="text-xs text-center text-muted-foreground mt-3">
	                ${isUnavailable ? 'This agent is not yet available' : `Estimated cost: ${getCreditsLabelForAgent(agent)}`}
              </p>
            </div>

            <!-- Right Column: Output -->
            <div class="p-6 md:border-l md:border-border/50 bg-muted/30">
              <div class="flex items-center justify-between mb-4">
                <h3 class="text-lg font-semibold">Result</h3>
                <!-- Output Share Menu -->
                <div class="relative">
                  <button
                    data-action="toggleOutputShareMenu" data-param="${agent.id}"
                    class="share-toggle-btn p-1.5 rounded-ios hover:bg-muted transition-colors"
                    title="More options"
                    aria-label="Result options"
                  >
                    <svg class="w-5 h-5 text-muted-foreground" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 12c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm8 0c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm8 0c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2z"/>
                    </svg>
                  </button>
                  <!-- Output Dropdown Menu -->
                  <div id="outputShareMenu-${agent.id}" class="hidden share-menu absolute right-0 top-full mt-2 w-52 bg-card rounded-ios-xl border border-border shadow-lg z-50 overflow-hidden">
                    <button data-action="downloadOutput" data-param="${agent.id}" class="share-menu-item w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm" disabled aria-disabled="true">
                      <svg class="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                      </svg>
                      <span>Download</span>
                    </button>
                    <button data-action="copyOutputLink" data-param="${agent.id}" class="share-menu-item w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm" disabled aria-disabled="true">
                      <svg class="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
                      </svg>
                      <span>Copy Link</span>
                    </button>
                    <button data-action="copyOutputText" data-param="${agent.id}" class="share-menu-item w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm" disabled aria-disabled="true">
                      <svg class="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                      </svg>
                      <span>Copy Text</span>
                    </button>
                    <div class="border-t border-border/50"></div>
                    <button data-action="shareOutput" data-param="${agent.id}" data-param2="email" class="share-menu-item w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm" disabled aria-disabled="true">
                      <svg class="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                      </svg>
                      <span>Email</span>
                    </button>
                    <button data-action="shareOutput" data-param="${agent.id}" data-param2="twitter" class="share-menu-item w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm" disabled aria-disabled="true">
                      <svg class="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                      </svg>
                      <span>X (Twitter)</span>
                    </button>
                    <button data-action="shareOutput" data-param="${agent.id}" data-param2="facebook" class="share-menu-item w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm" disabled aria-disabled="true">
                      <svg class="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                      <span>Facebook</span>
                    </button>
                    <button data-action="shareOutput" data-param="${agent.id}" data-param2="linkedin" class="share-menu-item w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm" disabled aria-disabled="true">
                      <svg class="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                      </svg>
                      <span>LinkedIn</span>
                    </button>
                    <button data-action="shareOutput" data-param="${agent.id}" data-param2="whatsapp" class="share-menu-item w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm" disabled aria-disabled="true">
                      <svg class="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                      <span>WhatsApp</span>
                    </button>
                  </div>
                </div>
              </div>
              <div id="output-${agent.id}" class="min-h-64 rounded-ios-xl bg-background border border-border flex items-center justify-center">
                <div class="text-center p-6">
                  <svg class="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-width="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                  </svg>
                  <p class="text-sm text-muted-foreground">Your generated result will appear here</p>
                  <p class="text-xs text-muted-foreground/70 mt-1">${isLegacyRunner ? 'Fill in the configuration and click Generate' : 'Open the runner page to execute and view results'}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Automations Section - Tabbed Interface -->
          <div class="border-t border-border/50 p-6" id="automations-section-${agent.id}">
            <!-- Header with Title -->
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center gap-2">
                <svg class="w-5 h-5 text-ios-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                </svg>
                <h3 class="text-lg font-semibold">Automations</h3>
                <span class="automation-count-badge text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground" id="automation-count-${agent.id}">0</span>
              </div>
              <a href="/aitopia/marketplace/docs/triggers-actions.html" target="_blank" class="text-xs text-primary hover:underline flex items-center gap-1">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                </svg>
                Docs
              </a>
            </div>

            <!-- Tab Navigation -->
            <div class="flex items-center gap-1 mb-4 p-1 rounded-ios-xl bg-muted/30 border border-border/50">
              <button data-action="switchAutomationTab" data-param="${agent.id}" data-param2="webhooks"
                      class="automation-tab flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-ios-lg text-xs font-medium transition-all hover:bg-background/50"
                      data-tab="webhooks" data-agent="${agent.id}">
                <svg class="w-4 h-4 text-ios-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
                </svg>
                <span>Webhooks</span>
                <span class="webhook-count text-[10px] px-1.5 py-0.5 rounded-full bg-ios-blue/10 text-ios-blue hidden">0</span>
                <button data-action="showAutomationInfo" data-param="webhook" class="stop-propagation ml-1 w-4 h-4 rounded-full border border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/50 flex items-center justify-center text-[10px] transition-colors">?</button>
              </button>
              <button data-action="switchAutomationTab" data-param="${agent.id}" data-param2="schedules"
                      class="automation-tab flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-ios-lg text-xs font-medium transition-all hover:bg-background/50"
                      data-tab="schedules" data-agent="${agent.id}">
                <svg class="w-4 h-4 text-ios-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <span>Schedules</span>
                <span class="schedule-count text-[10px] px-1.5 py-0.5 rounded-full bg-ios-orange/10 text-ios-orange hidden">0</span>
                <button data-action="showAutomationInfo" data-param="schedule" class="stop-propagation ml-1 w-4 h-4 rounded-full border border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/50 flex items-center justify-center text-[10px] transition-colors">?</button>
              </button>
              <button data-action="switchAutomationTab" data-param="${agent.id}" data-param2="actions"
                      class="automation-tab flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-ios-lg text-xs font-medium transition-all hover:bg-background/50"
                      data-tab="actions" data-agent="${agent.id}">
                <svg class="w-4 h-4 text-ios-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-width="2" d="M9 5l7 7-7 7"/>
                </svg>
                <span>Actions</span>
                <span class="action-count text-[10px] px-1.5 py-0.5 rounded-full bg-ios-green/10 text-ios-green hidden">0</span>
                <button data-action="showAutomationInfo" data-param="action" class="stop-propagation ml-1 w-4 h-4 rounded-full border border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/50 flex items-center justify-center text-[10px] transition-colors">?</button>
              </button>
            </div>

            <!-- Tab Content -->
            <div class="automation-tab-content rounded-ios-xl border border-border/50 bg-muted/20 overflow-hidden">
              <!-- Webhooks Tab -->
              <div id="tab-webhooks-${agent.id}" class="automation-tab-panel p-4" data-agent="${agent.id}">
                <!-- Info Banner -->
                <div class="flex items-start gap-3 p-3 mb-4 rounded-ios-lg bg-ios-blue/5 border border-ios-blue/20">
                  <svg class="w-5 h-5 text-ios-blue mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
                  </svg>
                  <div class="flex-1">
                    <p class="text-sm font-medium text-foreground">Webhook Triggers</p>
                    <p class="text-xs text-muted-foreground mt-1">Create HTTP endpoints to trigger this agent from external services like GitHub, Stripe, or Zapier.</p>
                    <div class="flex flex-wrap gap-2 mt-2">
                      <span class="px-2 py-0.5 rounded-full bg-ios-blue/10 text-ios-blue text-[10px]">HMAC Signatures</span>
                      <span class="px-2 py-0.5 rounded-full bg-ios-green/10 text-ios-green text-[10px]">Rate Limiting</span>
                      <span class="px-2 py-0.5 rounded-full bg-ios-purple/10 text-ios-purple text-[10px]">Idempotency Keys</span>
                    </div>
                  </div>
                </div>
                <!-- Webhook List -->
                <div id="webhook-list-${agent.id}" class="space-y-2 mb-4">
                  <div class="text-center py-4 text-muted-foreground text-xs">Loading webhooks...</div>
                </div>
                <!-- Create Button -->
                <button data-action="openAutomationModal" data-param="${agent.id}" data-param2="webhook" class="w-full p-3 rounded-ios-lg border-2 border-dashed border-border/60 hover:border-ios-blue/50 hover:bg-ios-blue/5 transition-all flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-ios-blue">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-width="2" d="M12 4v16m8-8H4"/>
                  </svg>
                  Create Webhook Trigger
                </button>
              </div>

              <!-- Schedules Tab -->
              <div id="tab-schedules-${agent.id}" class="automation-tab-panel p-4 hidden" data-agent="${agent.id}">
                <!-- Info Banner -->
                <div class="flex items-start gap-3 p-3 mb-4 rounded-ios-lg bg-ios-orange/5 border border-ios-orange/20">
                  <svg class="w-5 h-5 text-ios-orange mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <div class="flex-1">
                    <p class="text-sm font-medium text-foreground">Scheduled Runs</p>
                    <p class="text-xs text-muted-foreground mt-1">Run this agent automatically on a schedule using cron expressions. Perfect for daily reports, hourly checks, or weekly summaries.</p>
                    <div class="flex flex-wrap gap-2 mt-2">
                      <span class="px-2 py-0.5 rounded-full bg-ios-orange/10 text-ios-orange text-[10px]">Cron Expressions</span>
                      <span class="px-2 py-0.5 rounded-full bg-ios-teal/10 text-ios-teal text-[10px]">Timezone Support</span>
                      <span class="px-2 py-0.5 rounded-full bg-ios-pink/10 text-ios-pink text-[10px]">Presets Available</span>
                    </div>
                  </div>
                </div>
                <!-- Schedule List -->
                <div id="schedule-list-${agent.id}" class="space-y-2 mb-4">
                  <div class="text-center py-4 text-muted-foreground text-xs">Loading schedules...</div>
                </div>
                <!-- Create Button -->
                <button data-action="openAutomationModal" data-param="${agent.id}" data-param2="schedule" class="w-full p-3 rounded-ios-lg border-2 border-dashed border-border/60 hover:border-ios-orange/50 hover:bg-ios-orange/5 transition-all flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-ios-orange">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-width="2" d="M12 4v16m8-8H4"/>
                  </svg>
                  Create Schedule
                </button>
              </div>

              <!-- Actions Tab -->
              <div id="tab-actions-${agent.id}" class="automation-tab-panel p-4 hidden" data-agent="${agent.id}">
                <!-- Info Banner -->
                <div class="flex items-start gap-3 p-3 mb-4 rounded-ios-lg bg-ios-green/5 border border-ios-green/20">
                  <svg class="w-5 h-5 text-ios-green mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-width="2" d="M9 5l7 7-7 7"/>
                  </svg>
                  <div class="flex-1">
                    <p class="text-sm font-medium text-foreground">Post-Run Actions</p>
                    <p class="text-xs text-muted-foreground mt-1">Execute actions after this agent completes. Send webhooks to notify systems or chain to another agent for multi-step workflows.</p>
                    <div class="flex flex-wrap gap-2 mt-2">
                      <span class="px-2 py-0.5 rounded-full bg-ios-green/10 text-ios-green text-[10px]">Webhook Notify</span>
                      <span class="px-2 py-0.5 rounded-full bg-ios-pink/10 text-ios-pink text-[10px]">Agent Chains</span>
                      <span class="px-2 py-0.5 rounded-full bg-ios-yellow/10 text-ios-yellow text-[10px]">Budget Propagation</span>
                    </div>
                  </div>
                </div>
                <!-- Actions List -->
                <div id="action-list-${agent.id}" class="space-y-2 mb-4">
                  <div class="text-center py-4 text-muted-foreground text-xs">Loading actions...</div>
                </div>
                <!-- Create Button -->
                <button data-action="openAutomationModal" data-param="${agent.id}" data-param2="action" class="w-full p-3 rounded-ios-lg border-2 border-dashed border-border/60 hover:border-ios-green/50 hover:bg-ios-green/5 transition-all flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-ios-green">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-width="2" d="M12 4v16m8-8H4"/>
                  </svg>
                  Create Post-Run Action
                </button>
              </div>
            </div>

            <!-- Quick API Reference (Collapsed by default) -->
            <details class="mt-3 group">
              <summary class="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors py-2">
                <svg class="w-3.5 h-3.5 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-width="2" d="M9 5l7 7-7 7"/>
                </svg>
                API Endpoints
              </summary>
              <div class="mt-2 p-3 rounded-ios-lg bg-muted/30 border border-border/30">
                <div class="flex flex-wrap gap-2 text-xs">
                  <code class="px-2 py-1 rounded bg-background border border-border/50">POST /triggers</code>
                  <code class="px-2 py-1 rounded bg-background border border-border/50">POST /actions</code>
                  <code class="px-2 py-1 rounded bg-background border border-border/50">POST /webhooks/:path</code>
                  <code class="px-2 py-1 rounded bg-background border border-border/50">GET /triggers?agentId=${agent.id}</code>
                </div>
              </div>
            </details>
          </div>
        </div>
      `;

      // Initialize model tabs and Virtual Try-On model selection
      setTimeout(() => {
        if (typeof initModelTabs === 'function') {
          initModelTabs();
        }
        if (agentId === 'virtual-try-on') {
          const preselected = document.querySelector('.model-select.border-primary img');
          if (preselected?.src) {
            selectedModels[agentId] = preselected.src;
          }
        }
      }, 100);

      // Load automations for this agent
      loadAutomations(agent.id);

      // Show full-page detail view
      const detailPage = document.getElementById('agentDetailPage');
      document.getElementById('detailPageTitle').textContent = agent.name;

      detailPage.classList.remove('translate-x-full');
      detailPage.classList.add('translate-x-0');
      document.body.style.overflow = 'hidden';

      // Update URL to reflect agent run page (skip when called from deep links)
      if (!skipPushState) {
        const nextUrl = `/agent/${encodedAgentId}/run?legacy=1`;
        history.pushState({ agent: agentId, view: 'run' }, '', nextUrl);
      }
    }

    // ============================================
    // AUTOMATIONS (TRIGGERS & ACTIONS) - Tabbed Interface
    // ============================================
    const automationState = {};

    // Switch between automation tabs
    function switchAutomationTab(agentId, tabName) {
      // Update tab buttons
      const tabs = document.querySelectorAll(`.automation-tab[data-agent="${agentId}"]`);
      tabs.forEach(tab => {
        const isActive = tab.dataset.tab === tabName;
        tab.classList.toggle('bg-background', isActive);
        tab.classList.toggle('shadow-sm', isActive);
        tab.classList.toggle('text-foreground', isActive);
        tab.classList.toggle('text-muted-foreground', !isActive);
      });

      // Update tab panels
      const panels = ['webhooks', 'schedules', 'actions'];
      panels.forEach(panel => {
        const el = document.getElementById(`tab-${panel}-${agentId}`);
        if (el) {
          el.classList.toggle('hidden', panel !== tabName);
        }
      });
    }

    // Show info modal for automation types
    function showAutomationInfo(type) {
      const infoContent = {
        webhook: {
          title: 'Webhook Triggers',
          icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
          color: 'ios-blue',
          description: 'Create custom HTTP endpoints that trigger this agent when called. Perfect for integrating with external services.',
          features: [
            { name: 'HMAC Signatures', desc: 'Secure your webhooks with SHA-256 HMAC signature verification' },
            { name: 'Rate Limiting', desc: 'Control how often the webhook can be called (e.g., 10 requests per minute)' },
            { name: 'Idempotency Keys', desc: 'Prevent duplicate executions with unique request identifiers' },
            { name: 'Input Mapping', desc: 'Map incoming webhook data to agent input fields' },
          ],
          example: 'POST /webhooks/my-trigger\\n\\nUse cases:\\n• GitHub PR events\\n• Stripe payment webhooks\\n• Zapier integrations\\n• Custom API triggers'
        },
        schedule: {
          title: 'Scheduled Runs',
          icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
          color: 'ios-orange',
          description: 'Run this agent automatically on a recurring schedule using cron expressions.',
          features: [
            { name: 'Cron Expressions', desc: 'Standard cron syntax for flexible scheduling (minute, hour, day, month, weekday)' },
            { name: 'Timezone Support', desc: 'Schedule runs in any timezone (e.g., America/New_York, Europe/London)' },
            { name: 'Presets', desc: 'Quick presets for common schedules: hourly, daily, weekly, monthly' },
            { name: 'Static Inputs', desc: 'Pre-configure inputs that are used for every scheduled run' },
          ],
          example: 'Common cron patterns:\\n• 0 * * * *  (every hour)\\n• 0 9 * * *  (daily at 9am)\\n• 0 9 * * 1  (Mondays at 9am)\\n• 0 0 1 * *  (1st of month)'
        },
        action: {
          title: 'Post-Run Actions',
          icon: 'M9 5l7 7-7 7',
          color: 'ios-green',
          description: 'Execute actions automatically after this agent completes. Build multi-step workflows.',
          features: [
            { name: 'Webhook Notify', desc: 'Send results to an external URL (Slack, Discord, custom API)' },
            { name: 'Agent Chains', desc: 'Trigger another agent with the output of this one' },
            { name: 'Conditional Execution', desc: 'Run only on success, failure, or specific conditions' },
            { name: 'Budget Propagation', desc: 'Pass remaining budget to chained agents' },
          ],
          example: 'Example workflows:\\n• Analyze data → Send Slack notification\\n• Generate image → Upload to S3\\n• Transcribe audio → Summarize → Email'
        }
      };

      const info = infoContent[type];
      if (!info) return;

      // Create and show modal
      const modal = document.createElement('div');
      modal.id = 'automationInfoModal';
      modal.className = 'fixed inset-0 z-[100] flex items-center justify-center p-4';
      modal.innerHTML = `
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" data-action="closeAutomationInfoModal"></div>
        <div class="relative bg-card border border-border rounded-ios-2xl shadow-2xl w-full max-w-lg p-6 animate-modal-in">
          <div class="flex items-start gap-3 mb-4">
            <div class="w-10 h-10 rounded-ios-lg bg-${info.color}/10 flex items-center justify-center flex-shrink-0">
              <svg class="w-5 h-5 text-${info.color}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-width="2" d="${info.icon}"/>
              </svg>
            </div>
            <div class="flex-1">
              <h3 class="text-lg font-semibold">${info.title}</h3>
              <p class="text-sm text-muted-foreground mt-1">${info.description}</p>
            </div>
            <button data-action="closeAutomationInfoModal" class="p-2 rounded-ios-lg hover:bg-muted transition-colors -mt-1 -mr-1">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <div class="space-y-3 mb-4">
            <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Features</p>
            ${info.features.map(f => `
              <div class="flex items-start gap-2 p-2 rounded-ios-lg bg-muted/30">
                <svg class="w-4 h-4 text-${info.color} mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-width="2" d="M5 13l4 4L19 7"/>
                </svg>
                <div>
                  <p class="text-sm font-medium">${f.name}</p>
                  <p class="text-xs text-muted-foreground">${f.desc}</p>
                </div>
              </div>
            `).join('')}
          </div>

          <div class="p-3 rounded-ios-lg bg-muted/50 border border-border/50">
            <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Examples</p>
            <pre class="text-xs text-muted-foreground whitespace-pre-wrap font-mono">${info.example}</pre>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    function closeAutomationInfoModal() {
      const modal = document.getElementById('automationInfoModal');
      if (modal) modal.remove();
    }

    async function loadAutomations(agentId) {
      // Show loading state in all tabs
      const webhookList = document.getElementById(`webhook-list-${agentId}`);
      const scheduleList = document.getElementById(`schedule-list-${agentId}`);
      const actionList = document.getElementById(`action-list-${agentId}`);

      const loadingHtml = '<div class="text-center py-4 text-muted-foreground text-xs">Loading...</div>';
      if (webhookList) webhookList.innerHTML = loadingHtml;
      if (scheduleList) scheduleList.innerHTML = loadingHtml;
      if (actionList) actionList.innerHTML = loadingHtml;

      try {
        const [triggersRes, actionsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/triggers?agentId=${agentId}`, { headers: { 'X-Tenant-Id': 'default' } }),
          fetch(`${API_BASE_URL}/actions?agentId=${agentId}`, { headers: { 'X-Tenant-Id': 'default' } }),
        ]);

        const triggersData = triggersRes.ok ? await triggersRes.json() : { triggers: [] };
        const actionsData = actionsRes.ok ? await actionsRes.json() : { actions: [] };

        automationState[agentId] = {
          triggers: triggersData.triggers || [],
          actions: actionsData.actions || [],
        };

        renderAutomations(agentId);

        // Set first tab as active
        switchAutomationTab(agentId, 'webhooks');
      } catch (err) {
        console.error('Error loading automations', err);
        const errorHtml = '<p class="text-center py-4 text-red-500 text-xs">Failed to load. Try again.</p>';
        if (webhookList) webhookList.innerHTML = errorHtml;
        if (scheduleList) scheduleList.innerHTML = errorHtml;
        if (actionList) actionList.innerHTML = errorHtml;
      }
    }

    function renderAutomations(agentId) {
      const state = automationState[agentId] || { triggers: [], actions: [] };

      // Separate webhooks and schedules
      const webhooks = state.triggers.filter(t => t.type === 'webhook');
      const schedules = state.triggers.filter(t => t.type === 'schedule');
      const actions = state.actions;

      // Update counts
      const totalCount = webhooks.length + schedules.length + actions.length;
      const countBadge = document.getElementById(`automation-count-${agentId}`);
      if (countBadge) {
        countBadge.textContent = totalCount;
        countBadge.classList.toggle('bg-ios-purple/10', totalCount > 0);
        countBadge.classList.toggle('text-ios-purple', totalCount > 0);
        countBadge.classList.toggle('bg-muted', totalCount === 0);
        countBadge.classList.toggle('text-muted-foreground', totalCount === 0);
      }

      // Update tab count badges
      updateTabCount(agentId, 'webhook', webhooks.length);
      updateTabCount(agentId, 'schedule', schedules.length);
      updateTabCount(agentId, 'action', actions.length);

      // Render webhooks
      renderWebhookList(agentId, webhooks);

      // Render schedules
      renderScheduleList(agentId, schedules);

      // Render actions
      renderActionList(agentId, actions);
    }

    function updateTabCount(agentId, type, count) {
      const section = document.getElementById(`automations-section-${agentId}`);
      if (!section) return;
      const badge = section.querySelector(`.${type}-count`);
      if (badge) {
        badge.textContent = count;
        badge.classList.toggle('hidden', count === 0);
      }
    }

    function renderWebhookList(agentId, webhooks) {
      const container = document.getElementById(`webhook-list-${agentId}`);
      if (!container) return;

      if (webhooks.length === 0) {
        container.innerHTML = `
          <div class="text-center py-4">
            <svg class="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-width="1.5" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
            </svg>
            <p class="text-xs text-muted-foreground">No webhook triggers yet</p>
          </div>
        `;
        return;
      }

      container.innerHTML = webhooks.map(trigger => `
        <div class="flex items-center justify-between p-3 rounded-ios-lg border border-border/60 bg-background/60 hover:border-ios-blue/30 transition-colors">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-sm font-semibold truncate">${trigger.name}</span>
              <span class="text-[10px] px-2 py-0.5 rounded-full ${trigger.enabled ? 'bg-green-500/10 text-green-600' : 'bg-muted text-muted-foreground'}">${trigger.enabled ? 'Active' : 'Paused'}</span>
            </div>
            <div class="flex items-center gap-2 mt-1">
              <code class="text-[11px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">/webhooks/${trigger.path}</code>
              <button data-action="copyToClipboard" data-param="${API_BASE_URL}/webhooks/${trigger.path}" class="text-muted-foreground hover:text-foreground transition-colors" title="Copy URL">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                </svg>
              </button>
            </div>
          </div>
          <div class="flex items-center gap-1 ml-2">
            <button class="text-[11px] px-2 py-1 rounded-ios border border-border hover:border-primary transition-colors" data-action="toggleTriggerEnabled" data-param="${trigger.id}" data-param2="${!trigger.enabled}" data-param3="${agentId}">
              ${trigger.enabled ? 'Pause' : 'Enable'}
            </button>
            <button class="p-1.5 rounded-ios border border-border hover:border-red-500/50 text-red-500 transition-colors" data-action="deleteTrigger" data-param="${trigger.id}" data-param2="${agentId}" title="Delete">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </button>
          </div>
        </div>
      `).join('');
    }

    function renderScheduleList(agentId, schedules) {
      const container = document.getElementById(`schedule-list-${agentId}`);
      if (!container) return;

      if (schedules.length === 0) {
        container.innerHTML = `
          <div class="text-center py-4">
            <svg class="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <p class="text-xs text-muted-foreground">No schedules yet</p>
          </div>
        `;
        return;
      }

      container.innerHTML = schedules.map(trigger => `
        <div class="flex items-center justify-between p-3 rounded-ios-lg border border-border/60 bg-background/60 hover:border-ios-orange/30 transition-colors">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-sm font-semibold truncate">${trigger.name}</span>
              <span class="text-[10px] px-2 py-0.5 rounded-full ${trigger.enabled ? 'bg-green-500/10 text-green-600' : 'bg-muted text-muted-foreground'}">${trigger.enabled ? 'Active' : 'Paused'}</span>
            </div>
            <div class="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
              <code class="bg-muted/50 px-1.5 py-0.5 rounded">${trigger.cron}</code>
              <span>${trigger.timezone || 'UTC'}</span>
            </div>
          </div>
          <div class="flex items-center gap-1 ml-2">
            <button class="text-[11px] px-2 py-1 rounded-ios border border-border hover:border-primary transition-colors" data-action="toggleTriggerEnabled" data-param="${trigger.id}" data-param2="${!trigger.enabled}" data-param3="${agentId}">
              ${trigger.enabled ? 'Pause' : 'Enable'}
            </button>
            <button class="p-1.5 rounded-ios border border-border hover:border-red-500/50 text-red-500 transition-colors" data-action="deleteTrigger" data-param="${trigger.id}" data-param2="${agentId}" title="Delete">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </button>
          </div>
        </div>
      `).join('');
    }

    function renderActionList(agentId, actions) {
      const container = document.getElementById(`action-list-${agentId}`);
      if (!container) return;

      if (actions.length === 0) {
        container.innerHTML = `
          <div class="text-center py-4">
            <svg class="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-width="1.5" d="M9 5l7 7-7 7"/>
            </svg>
            <p class="text-xs text-muted-foreground">No post-run actions yet</p>
          </div>
        `;
        return;
      }

      container.innerHTML = actions.map(action => {
        const isChain = action.type === 'agent_chain';
        const typeLabel = isChain ? 'Agent Chain' : 'Webhook';
        const typeColor = isChain ? 'ios-pink' : 'ios-green';
        const runOn = action.conditions?.status?.join(', ') || 'success';

        return `
          <div class="flex items-center justify-between p-3 rounded-ios-lg border border-border/60 bg-background/60 hover:border-ios-green/30 transition-colors">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="text-sm font-semibold truncate">${action.name}</span>
                <span class="text-[10px] px-2 py-0.5 rounded-full bg-${typeColor}/10 text-${typeColor}">${typeLabel}</span>
              </div>
              <p class="text-[11px] text-muted-foreground mt-1">Runs on: ${runOn}</p>
            </div>
            <div class="flex items-center gap-1 ml-2">
              <button class="p-1.5 rounded-ios border border-border hover:border-red-500/50 text-red-500 transition-colors" data-action="deleteAction" data-param="${action.id}" data-param2="${agentId}" title="Delete">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                </svg>
              </button>
            </div>
          </div>
        `;
      }).join('');
    }

    // Copy to clipboard helper
    function copyToClipboard(text) {
      navigator.clipboard.writeText(text).then(() => {
        showToast('Copied to clipboard!');
      }).catch(() => {
        // Fallback for older browsers
        const el = document.createElement('textarea');
        el.value = text;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        showToast('Copied to clipboard!');
      });
    }

    function openAutomationModal(agentId, type) {
      const modal = document.getElementById('automationModal');
      modal.dataset.agentId = agentId;
      modal.dataset.type = type;
      document.getElementById('automationType').textContent = type === 'webhook' ? 'Webhook Trigger' : type === 'schedule' ? 'Schedule' : 'Post-Run Action';
      document.getElementById('automationName').value = '';
      document.getElementById('automationPath').value = '';
      document.getElementById('automationCron').value = '0 9 * * *';
      document.getElementById('automationTimezone').value = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      document.getElementById('automationUrlBase').textContent = API_BASE_URL;
      document.getElementById('automationPathPreview').textContent = 'my-webhook';
      document.getElementById('automationWebhookFields').classList.toggle('hidden', type !== 'webhook');
      document.getElementById('automationScheduleFields').classList.toggle('hidden', type !== 'schedule');
      document.getElementById('automationActionNotice').classList.toggle('hidden', type !== 'action');
      document.getElementById('automationPath').addEventListener('input', (e) => {
        document.getElementById('automationPathPreview').textContent = e.target.value || 'my-webhook';
      }, { once: true });
      modal.classList.remove('hidden');
    }

    function closeAutomationModal() {
      document.getElementById('automationModal').classList.add('hidden');
    }

    async function submitAutomationForm() {
      const modal = document.getElementById('automationModal');
      const agentId = modal.dataset.agentId;
      const type = modal.dataset.type;
      const name = document.getElementById('automationName').value.trim();

      if (!agentId || !type) return;
      if (!name) {
        alert('Please enter a name');
        return;
      }

      try {
        if (type === 'webhook' || type === 'schedule') {
          const body = {
            name,
            agentId,
            enabled: true,
            type: type,
            inputMapping: {},
          };

          if (type === 'webhook') {
            const path = document.getElementById('automationPath').value.trim();
            if (!path) {
              alert('Please enter a webhook path');
              return;
            }
            body.path = path;
            const secret = document.getElementById('automationSecret').value.trim();
            if (secret) body.secret = secret;
          } else {
            const cron = document.getElementById('automationCron').value.trim() || '0 9 * * *';
            body.cron = cron;
            body.timezone = document.getElementById('automationTimezone').value || 'UTC';
          }

          const res = await fetch(`${API_BASE_URL}/triggers`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Tenant-Id': 'default',
            },
            body: JSON.stringify(body),
          });

          if (!res.ok) {
            const errorText = await res.text();
            throw new Error(errorText || 'Failed to create trigger');
          }
        } else {
          alert('Post-run action creation from UI is not available yet. Use the API.');
          return;
        }

        closeAutomationModal();
        loadAutomations(agentId);
      } catch (err) {
        console.error('Failed to create automation', err);
        alert('Failed to create automation. Please try again.');
      }
    }

    async function toggleTriggerEnabled(triggerId, enabled, agentId) {
      try {
        const res = await fetch(`${API_BASE_URL}/triggers/${triggerId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-Id': 'default',
          },
          body: JSON.stringify({ enabled }),
        });
        if (!res.ok) throw new Error('Failed to update trigger');
        loadAutomations(agentId);
      } catch (err) {
        console.error(err);
        alert('Could not update trigger status.');
      }
    }

    async function deleteTrigger(triggerId, agentId) {
      if (!confirm('Delete this trigger?')) return;
      try {
        const res = await fetch(`${API_BASE_URL}/triggers/${triggerId}`, {
          method: 'DELETE',
          headers: { 'X-Tenant-Id': 'default' },
        });
        if (!res.ok) throw new Error('Failed to delete trigger');
        loadAutomations(agentId);
      } catch (err) {
        console.error(err);
        alert('Could not delete trigger.');
      }
    }

    async function deleteAction(actionId, agentId) {
      if (!confirm('Delete this action?')) return;
      try {
        const res = await fetch(`${API_BASE_URL}/actions/${actionId}`, {
          method: 'DELETE',
          headers: { 'X-Tenant-Id': 'default' },
        });
        if (!res.ok) throw new Error('Failed to delete action');
        loadAutomations(agentId);
      } catch (err) {
        console.error(err);
        alert('Could not delete action.');
      }
    }

    // ============================================
    // SHARE FUNCTIONALITY
    // ============================================

    // Store generated output data for sharing
    const outputData = {};

    // Build agent share link
    function buildAgentLink(agentId) {
      return `${window.location.origin}/agents/${agentId}`;
    }

    // Social share URL templates
    function getShareUrl(platform, text, url) {
      const encodedText = encodeURIComponent(text);
      const encodedUrl = encodeURIComponent(url);

      const shareUrls = {
        twitter: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
        linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
        whatsapp: `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
        email: `mailto:?subject=${encodedText}&body=${encodedText}%0A%0A${encodedUrl}`
      };

      return shareUrls[platform] || '';
    }

    // Toast notification
    function showToast(message, duration = 2000) {
      // Remove existing toast if any
      const existingToast = document.getElementById('shareToast');
      if (existingToast) existingToast.remove();

      const toast = document.createElement('div');
      toast.id = 'shareToast';
      toast.className = 'toast fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2.5 bg-card border border-border rounded-ios-xl shadow-lg z-[100] flex items-center gap-2';
      toast.innerHTML = `
        <svg class="w-4 h-4 text-ios-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-width="2" d="M5 13l4 4L19 7"/>
        </svg>
        <span class="text-sm font-medium">${message}</span>
      `;
      document.body.appendChild(toast);

      setTimeout(() => {
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 200);
      }, duration);
    }

    // Toggle agent share menu
    function toggleAgentShareMenu(agentId, event) {
      event.stopPropagation();
      closeAllShareMenus();
      const menu = document.getElementById(`agentShareMenu-${agentId}`);
      if (menu) {
        menu.classList.toggle('hidden');
      }
    }

    // Toggle output share menu
    function toggleOutputShareMenu(agentId, event) {
      event.stopPropagation();
      closeAllShareMenus();
      const menu = document.getElementById(`outputShareMenu-${agentId}`);
      if (menu) {
        menu.classList.toggle('hidden');
        updateOutputMenuState(agentId);
      }
    }

    // Close all share menus
    function closeAllShareMenus() {
      document.querySelectorAll('[id^="agentShareMenu-"], [id^="outputShareMenu-"]').forEach(menu => {
        menu.classList.add('hidden');
      });
    }

    // Update output menu item states based on available data
    function updateOutputMenuState(agentId) {
      const data = outputData[agentId];
      const menu = document.getElementById(`outputShareMenu-${agentId}`);
      if (!menu) return;

      const hasContent = !!data;
      const hasUrl = data?.url;
      const isImage = data?.type === 'image';
      const isText = data?.type === 'text';

      // Update button states
      menu.querySelectorAll('.share-menu-item').forEach(btn => {
        const action = btn.dataset.action;
        let enabled = false;

        switch(action) {
          case 'download':
            enabled = hasUrl;
            break;
          case 'copy-image':
            enabled = isImage && hasUrl;
            break;
          case 'copy-link':
            enabled = hasUrl;
            break;
          case 'copy-text':
            enabled = isText && data?.content;
            break;
          default:
            enabled = hasContent;
        }

        btn.disabled = !enabled;
        btn.setAttribute('aria-disabled', !enabled);
      });
    }

    // Share agent on social media
    function shareAgent(agentId, platform) {
      const agent = agents[agentId];
      if (!agent) return;

      const text = `Check out ${agent.name} on AITOPIA`;
      const url = buildAgentLink(agentId);
      const shareUrl = getShareUrl(platform, text, url);

      if (platform === 'email') {
        // Use window.open for email to avoid navigation issues
        window.open(shareUrl, '_self');
      } else {
        window.open(shareUrl, '_blank', 'noopener,noreferrer');
      }
      closeAllShareMenus();
    }

    // Share output on social media
    function shareOutput(agentId, platform) {
      const agent = agents[agentId];
      const data = outputData[agentId];
      if (!agent) return;

      const text = `Created with ${agent.name} on AITOPIA`;
      const url = data?.url || buildAgentLink(agentId);
      const shareUrl = getShareUrl(platform, text, url);

      if (platform === 'email') {
        // Use window.open for email to avoid navigation issues
        window.open(shareUrl, '_self');
      } else {
        window.open(shareUrl, '_blank', 'noopener,noreferrer');
      }
      closeAllShareMenus();
    }

    // Copy agent link to clipboard
    async function copyAgentLink(agentId) {
      const url = buildAgentLink(agentId);
      try {
        await navigator.clipboard.writeText(url);
        showToast('Link copied!');
      } catch (err) {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = url;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('Link copied!');
      }
      closeAllShareMenus();
    }

    // Copy output link to clipboard
    async function copyOutputLink(agentId) {
      const data = outputData[agentId];
      const url = data?.url || buildAgentLink(agentId);
      try {
        await navigator.clipboard.writeText(url);
        showToast('Link copied!');
      } catch (err) {
        const textarea = document.createElement('textarea');
        textarea.value = url;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('Link copied!');
      }
      closeAllShareMenus();
    }

    // Copy output text content to clipboard
    async function copyOutputText(agentId) {
      const data = outputData[agentId];
      if (!data?.content) return;

      try {
        await navigator.clipboard.writeText(data.content);
        showToast('Text copied!');
      } catch (err) {
        const textarea = document.createElement('textarea');
        textarea.value = data.content;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('Text copied!');
      }
      closeAllShareMenus();
    }

    // Download output
    async function downloadOutput(agentId) {
      const data = outputData[agentId];
      if (!data?.url) return;

      const filename = `${agentId}-output.${data.type === 'video' ? 'mp4' : data.type === 'audio' ? 'mp3' : 'png'}`;
      closeAllShareMenus();

      // Show downloading toast
      showToast('Downloading...', 10000);
      // Fetch the file as blob to force download (works for cross-origin URLs)
      try {
        const response = await fetch(data.url);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up blob URL
        URL.revokeObjectURL(blobUrl);
        showToast('Download complete!');
      } catch (error) {
        console.error('Download failed:', error);
        // Fallback: open in new tab
        window.open(data.url, '_blank');
        showToast('Opening in new tab...');
      }
    }

    // Document click listener to close menus
    document.addEventListener('click', (e) => {
      if (!e.target.closest('[id^="agentShareMenu-"]') &&
          !e.target.closest('[id^="outputShareMenu-"]') &&
          !e.target.closest('.share-toggle-btn')) {
        closeAllShareMenus();
      }
    });

    // ============================================
    // END SHARE FUNCTIONALITY
    // ============================================

    // Close detail page
    // skipHistoryBack: true when called from popstate (browser back button) to avoid double navigation
    function closeDetail(skipHistoryBack = false) {
      const detailPage = document.getElementById('agentDetailPage');

      // Close any open share menus
      closeAllShareMenus();

      detailPage.classList.add('translate-x-full');
      detailPage.classList.remove('translate-x-0');

      setTimeout(() => {
        document.body.style.overflow = '';
      }, 300);

      // Navigate back in history (skip when called from popstate)
      if (!skipHistoryBack) {
        history.back();
      }
    }

    // Tab navigation
    function showTab(tab) {
      // Update tab buttons
      document.querySelectorAll('.tab-btn').forEach(btn => {
        if (btn.dataset.tab === tab) {
          btn.classList.add('text-primary');
          btn.classList.remove('text-muted-foreground');
        } else {
          btn.classList.remove('text-primary');
          btn.classList.add('text-muted-foreground');
        }
      });

      // Show/hide tab content
      document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
      });
      document.getElementById(tab + 'Tab').classList.remove('hidden');

      // Focus search input if search tab
      if (tab === 'search') {
        document.getElementById('searchInputMain').focus();
      }

      // Populate agents tab if needed
      if (tab === 'agents') {
        populateAgentsTab();
      }
    }

	    // Populate Agents Tab
	    function populateAgentsTab() {
	      const scored = Object.values(agents).map(a => {
	        const info = getCreditsInfoForAgent(a);
	        const minCredits = typeof info.minCredits === 'number' ? info.minCredits : Number.POSITIVE_INFINITY;
	        const maxCredits = typeof info.maxCredits === 'number' ? info.maxCredits : minCredits;
	        return { agent: a, minCredits, maxCredits };
	      });

	      const lowCostAgents = [...scored]
	        .sort((a, b) => a.minCredits - b.minCredits)
	        .slice(0, 5)
	        .map(row => row.agent);

	      const premiumPool = scored.filter(row => Number.isFinite(row.maxCredits));
	      const premiumAgents = [...(premiumPool.length ? premiumPool : scored)]
	        .sort((a, b) => b.maxCredits - a.maxCredits)
	        .slice(0, 5)
	        .map(row => row.agent);

	      document.getElementById('topFreeAgents').innerHTML = lowCostAgents.map((a, i) => `
	        <a href="/aitopia/marketplace/agent/${a.id}.html" class="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors cursor-pointer no-underline text-inherit">
	          <span class="text-lg font-bold text-muted-foreground w-6">${i + 1}</span>
	          <img src="${a.showcase_images?.[0] || a.icon}" class="w-14 h-14 rounded-ios object-cover app-icon" alt="${a.name}" loading="lazy">
	          <div class="flex-1 min-w-0">
	            <h3 class="font-semibold text-sm truncate">${a.name}</h3>
	            <p class="text-xs text-muted-foreground truncate">${a.category}</p>
	          </div>
	          <button class="px-4 py-1.5 rounded-full bg-secondary text-primary text-xs font-semibold">${getCreditsLabelForAgent(a)}</button>
	        </a>
	      `).join('');

	      document.getElementById('topPaidAgents').innerHTML = premiumAgents.map((a, i) => `
	        <a href="/aitopia/marketplace/agent/${a.id}.html" class="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors cursor-pointer no-underline text-inherit">
	          <span class="text-lg font-bold text-muted-foreground w-6">${i + 1}</span>
	          <img src="${a.showcase_images?.[0] || a.icon}" class="w-14 h-14 rounded-ios object-cover app-icon" alt="${a.name}" loading="lazy">
	          <div class="flex-1 min-w-0">
	            <h3 class="font-semibold text-sm truncate">${a.name}</h3>
	            <p class="text-xs text-muted-foreground truncate">${a.category}</p>
	          </div>
	          <button class="px-4 py-1.5 rounded-full bg-secondary text-primary text-xs font-semibold">${getCreditsLabelForAgent(a)}</button>
	        </a>
	      `).join('');
	    }

    // Search functionality for main search
    let _mainSearchDebounce = null;
    document.getElementById('searchInputMain')?.addEventListener('input', (e) => {
      clearTimeout(_mainSearchDebounce);
      _mainSearchDebounce = setTimeout(() => searchFor(e.target.value), 500);
    });

    function searchFor(query) {
      if (!query) {
        document.getElementById('searchResults').innerHTML = Object.values(agents).slice(0, 5).map(a => renderSearchRow(a)).join('');
        document.getElementById('searchResultsTitle').textContent = 'Suggested';
        return;
      }

      const filtered = Object.values(agents).filter(a =>
        a.name.toLowerCase().includes(query.toLowerCase()) ||
        a.description.toLowerCase().includes(query.toLowerCase()) ||
        a.category.toLowerCase().includes(query.toLowerCase())
      );

      document.getElementById('searchResults').innerHTML = filtered.length
        ? filtered.map(a => renderSearchRow(a)).join('')
        : '<p class="p-6 text-center text-muted-foreground">No results found</p>';
      document.getElementById('searchResultsTitle').textContent = `Results for "${query}"`;
    }

    function renderSearchRow(agent) {
      return `
        <a href="/aitopia/marketplace/agent/${agent.id}.html" class="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors cursor-pointer no-underline text-inherit">
          <img src="${agent.showcase_images?.[0] || agent.icon}" class="w-14 h-14 rounded-ios object-cover app-icon" alt="${agent.name}" loading="lazy">
          <div class="flex-1 min-w-0">
            <h3 class="font-semibold text-sm truncate">${agent.name}</h3>
            <p class="text-xs text-muted-foreground truncate">${agent.description}</p>
            <div class="flex items-center gap-2 mt-1">
              <svg class="w-3 h-3 text-ios-orange" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
              </svg>
              <span class="text-xs">${agent.rating}</span>
            </div>
          </div>
	          <button class="px-4 py-1.5 rounded-full ${isAgentFree(agent) ? 'bg-primary text-primary-foreground' : 'bg-secondary text-primary'} text-xs font-semibold">
	            ${getCreditsLabelForAgent(agent)}
	          </button>
        </a>
      `;
    }

    // Initialize search results
    searchFor('');

    // Theme toggle - attached to window for onclick handlers
    window.toggleTheme = function() {
      document.documentElement.classList.toggle('dark');
      localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
      if (typeof window.injectHeaderCss == 'function') window.injectHeaderCss();
    };

    // Scroll effects for header
    let lastScroll = 0;
    window.addEventListener('scroll', () => {
      const header = document.getElementById('header');
      const currentScroll = window.scrollY;

      if (currentScroll > 50) {
        header.classList.add('shadow-sm');
      } else {
        header.classList.remove('shadow-sm');
      }

      lastScroll = currentScroll;
    });

    // =============================================================================
    // API MODAL FUNCTIONALITY
    // =============================================================================

    // Cache for API docs to avoid refetching
    const apiDocsCache = new Map();
    let currentApiAgentId = null;
    let currentApiDocs = null;
    let currentApiTab = 'curl';
    let isStreamingMode = false;

    // Open the API modal
    async function openApiModal(agentId) {
      currentApiAgentId = agentId;
      const modal = document.getElementById('apiModal');
      const title = document.getElementById('apiModalTitle');

      // Find agent name (agents is an object, not array)
      const agent = agents[agentId];
      title.textContent = `Run "${agent?.name || agentId}" via API`;

      // Show modal
      modal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';

      // Reset state
      showApiLoading();
      setActiveApiTab('curl');
      isStreamingMode = false;
      document.getElementById('streamingCheckbox').checked = false;

      // Fetch API docs
      await fetchApiDocs(agentId);

      // Add ESC key listener
      document.addEventListener('keydown', handleApiModalEsc);
    }

    // Close the API modal
    function closeApiModal() {
      const modal = document.getElementById('apiModal');
      modal.classList.add('hidden');
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleApiModalEsc);
      currentApiAgentId = null;
      currentApiDocs = null;
    }

    // Handle ESC key
    function handleApiModalEsc(event) {
      if (event.key === 'Escape') {
        closeApiModal();
      }
    }

    // Fetch API documentation
    async function fetchApiDocs(agentId) {
      // Check cache first
      if (apiDocsCache.has(agentId)) {
        currentApiDocs = apiDocsCache.get(agentId);
        renderApiContent();
        return;
      }

      try {
        const response = await fetch(`https://aitopia.ai/api/agents/${agentId}/api-docs`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const docs = await response.json();
        apiDocsCache.set(agentId, docs);
        currentApiDocs = docs;
        renderApiContent();
      } catch (error) {
        console.error('Failed to fetch API docs:', error);
        showApiError(error.message);
      }
    }

    // Retry fetching API docs
    function retryApiDocs() {
      if (currentApiAgentId) {
        apiDocsCache.delete(currentApiAgentId);
        showApiLoading();
        fetchApiDocs(currentApiAgentId);
      }
    }

    // Show loading state
    function showApiLoading() {
      document.getElementById('apiModalLoading').classList.remove('hidden');
      document.getElementById('apiModalError').classList.add('hidden');
      document.getElementById('apiCodeContainer').classList.add('hidden');
      document.getElementById('apiModalNotes').classList.add('hidden');
    }

    // Show error state
    function showApiError(message) {
      document.getElementById('apiModalLoading').classList.add('hidden');
      document.getElementById('apiModalError').classList.remove('hidden');
      document.getElementById('apiModalError').classList.add('flex');
      document.getElementById('apiCodeContainer').classList.add('hidden');
      document.getElementById('apiModalNotes').classList.add('hidden');
      document.getElementById('apiModalErrorMsg').textContent = message || 'Failed to load API documentation';
    }

    // Render API content
    function renderApiContent() {
      if (!currentApiDocs) return;

      document.getElementById('apiModalLoading').classList.add('hidden');
      document.getElementById('apiModalError').classList.add('hidden');
      document.getElementById('apiCodeContainer').classList.remove('hidden');
      document.getElementById('apiModalNotes').classList.remove('hidden');

      // Show/hide streaming toggle based on support
      const streamingToggle = document.getElementById('streamingToggle');
      const supportsStreaming = currentApiDocs.streaming?.supported &&
        (currentApiTab === 'curl' || currentApiTab === 'javascript' || currentApiTab === 'python');
      streamingToggle.classList.toggle('hidden', !supportsStreaming);

      // Render current tab content
      renderTabContent();

      // Render notes
      renderNotes();
    }

    // Render tab content
    function renderTabContent() {
      if (!currentApiDocs) return;

      const codeBlock = document.getElementById('apiCodeBlock');
      let code = '';

      switch (currentApiTab) {
        case 'curl':
          code = isStreamingMode && currentApiDocs.examples.curlStreaming
            ? currentApiDocs.examples.curlStreaming
            : currentApiDocs.examples.curl;
          break;
        case 'javascript':
          code = isStreamingMode && currentApiDocs.examples.javascriptStreaming
            ? currentApiDocs.examples.javascriptStreaming
            : currentApiDocs.examples.javascript;
          break;
        case 'python':
          code = isStreamingMode && currentApiDocs.examples.pythonStreaming
            ? currentApiDocs.examples.pythonStreaming
            : currentApiDocs.examples.python;
          break;
        case 'prompt':
          code = currentApiDocs.examples.prompt;
          break;
        case 'jsonschema':
          code = JSON.stringify(currentApiDocs.schemas.input, null, 2);
          break;
      }

      // Apply syntax highlighting
      codeBlock.innerHTML = highlightSyntax(code, currentApiTab);

      // Update streaming toggle visibility
      const streamingToggle = document.getElementById('streamingToggle');
      const supportsStreaming = currentApiDocs.streaming?.supported &&
        (currentApiTab === 'curl' || currentApiTab === 'javascript' || currentApiTab === 'python');
      streamingToggle.classList.toggle('hidden', !supportsStreaming);
    }

    // Render notes
    function renderNotes() {
      if (!currentApiDocs?.notes) return;

      const notesList = document.getElementById('apiNotesList');
      notesList.innerHTML = currentApiDocs.notes
        .map(note => `<li class="flex items-start gap-2"><span class="text-primary">•</span>${escapeHtml(note)}</li>`)
        .join('');
    }

    // Switch API tab
    function switchApiTab(tab) {
      currentApiTab = tab;
      setActiveApiTab(tab);
      if (currentApiDocs) {
        renderTabContent();
      }
    }

    // Set active tab styling
    function setActiveApiTab(tab) {
      document.querySelectorAll('.api-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
      });
    }

    // Toggle streaming mode
    function toggleStreaming() {
      isStreamingMode = document.getElementById('streamingCheckbox').checked;
      renderTabContent();
    }

    // Copy code to clipboard
    async function copyApiCode() {
      const codeBlock = document.getElementById('apiCodeBlock');
      const code = codeBlock.textContent;

      try {
        await navigator.clipboard.writeText(code);
        // Show success feedback
        document.getElementById('copyIcon').classList.add('hidden');
        document.getElementById('copySuccessIcon').classList.remove('hidden');
        setTimeout(() => {
          document.getElementById('copyIcon').classList.remove('hidden');
          document.getElementById('copySuccessIcon').classList.add('hidden');
        }, 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }

    // Simple syntax highlighting
    function highlightSyntax(code, lang) {
      if (!code) return '';

      // Escape HTML first
      let escaped = escapeHtml(code);

      if (lang === 'jsonschema' || lang === 'prompt') {
        // JSON syntax highlighting
        escaped = escaped
          .replace(/"([^"]+)":/g, '<span class="syntax-key">"$1"</span>:')
          .replace(/: "([^"]+)"/g, ': <span class="syntax-string">"$1"</span>')
          .replace(/: (\d+)/g, ': <span class="syntax-number">$1</span>')
          .replace(/: (true|false|null)/g, ': <span class="syntax-keyword">$1</span>');
      } else if (lang === 'curl') {
        // cURL syntax highlighting
        escaped = escaped
          .replace(/^(curl)/gm, '<span class="syntax-keyword">curl</span>')
          .replace(/(-[HXd])\s/g, '<span class="syntax-keyword">$1</span> ')
          .replace(/"([^"]+)":/g, '<span class="syntax-key">"$1"</span>:')
          .replace(/: "([^"]+)"/g, ': <span class="syntax-string">"$1"</span>')
          .replace(/(#[^\n]*)/g, '<span class="syntax-comment">$1</span>');
      } else if (lang === 'javascript') {
        // JavaScript syntax highlighting
        escaped = escaped
          .replace(/\b(const|let|var|async|await|function|return|if|else|switch|case|break|for|while|new|throw|try|catch)\b/g, '<span class="syntax-keyword">$1</span>')
          .replace(/"([^"]+)":/g, '<span class="syntax-key">"$1"</span>:')
          .replace(/: "([^"]+)"/g, ': <span class="syntax-string">"$1"</span>')
          .replace(/(\/\/[^\n]*)/g, '<span class="syntax-comment">$1</span>')
          .replace(/(\d+)/g, '<span class="syntax-number">$1</span>');
      } else if (lang === 'python') {
        // Python syntax highlighting
        escaped = escaped
          .replace(/\b(import|from|def|async|await|return|if|else|elif|for|while|try|except|raise|with|as|class|True|False|None)\b/g, '<span class="syntax-keyword">$1</span>')
          .replace(/"([^"]+)":/g, '<span class="syntax-key">"$1"</span>:')
          .replace(/: "([^"]+)"/g, ': <span class="syntax-string">"$1"</span>')
          .replace(/(#[^\n]*)/g, '<span class="syntax-comment">$1</span>')
          .replace(/(\d+)/g, '<span class="syntax-number">$1</span>');
      }

      return escaped;
    }

    // Escape HTML
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // Handle deep links from SEO pages or direct URLs.
    // Called AFTER agents are loaded to avoid race conditions.
    function handleDeepLinks() {
      const params = new URLSearchParams(window.location.search);
      const rawPath = window.location.pathname || '/';
      const path = rawPath.endsWith('/') && rawPath.length > 1 ? rawPath.slice(0, -1) : rawPath;

      function clearAllTagFilters() {
        activeFilters = { platforms: [], socialChannels: [], verticals: [], modalities: [], models: [], providers: [], vendors: [] };
        window._vendorModelFilter = null; // Clear specific model filter from /vendor/model routes
        renderFilterChips();
        renderNavFilters();
      }

      function applyCategory(canonicalSlug) {
        clearAllTagFilters();
        filterCategory(canonicalSlug);
        showTab('today');
      }

      function applySingleFilter(type, value) {
        clearAllTagFilters();
        activeFilters[type] = [value];
        renderFilterChips();
        renderNavFilters();
        filterCategory('all');
        showTab('today');
      }

      // ---------------------------------------------------------------------
      // Agent routes
      // ---------------------------------------------------------------------

      const agentRunMatch = path.match(/^\/agent\/([^/]+)\/run$/);
      if (agentRunMatch) {
        const agentId = decodeURIComponent(agentRunMatch[1]);
        if (agents[agentId]) {
          console.log(`🔗 Deep link: /agent/${agentId}/run`);
          openDetail(agentId, true); // skipPushState=true from deep link
          setTimeout(() => {
            const runBtn = document.querySelector('#detailModal [data-action="run"]');
            if (runBtn) runBtn.click();
          }, 300);
        } else {
          console.warn(`⚠️ Deep link: agent "${agentId}" not found`);
        }
        return;
      }

      const agentMatch = path.match(/^\/agent\/([^/]+)$/);
      if (agentMatch) {
        const agentId = decodeURIComponent(agentMatch[1]);
        if (agents[agentId]) {
          console.log(`🔗 Deep link: /agent/${agentId}`);
          openDetail(agentId, true); // skipPushState=true from deep link
        } else {
          console.warn(`⚠️ Deep link: agent "${agentId}" not found`);
        }
        return;
      }

      const agentIdFromQuery = params.get('agent') || params.get('run');
      if (agentIdFromQuery) {
        if (agents[agentIdFromQuery]) {
          console.log(`🔗 Deep link: agent "${agentIdFromQuery}" (query)`);
          openDetail(agentIdFromQuery, true); // skipPushState=true from deep link
          if (params.get('run')) {
            setTimeout(() => {
              const runBtn = document.querySelector('#detailModal [data-action="run"]');
              if (runBtn) runBtn.click();
            }, 300);
          }
        } else {
          console.warn(`⚠️ Deep link: agent "${agentIdFromQuery}" not found`);
        }
        return;
      }

      // ---------------------------------------------------------------------
      // Category routes (Option C canonical slugs)
      // ---------------------------------------------------------------------

      const categoryMatch =
        path.match(/^\/category\/([^/]+)$/) ||
        path.match(/^\/store\/category\/([^/]+)$/);

      if (categoryMatch) {
        const rawSlug = decodeURIComponent(categoryMatch[1]);
        const canonical = resolveCanonicalCategorySlug(rawSlug);
        if (canonical) {
          console.log(`🔗 Deep link: /category/${canonical}`);
          applyCategory(canonical);
        } else {
          console.warn(`⚠️ Deep link: unknown category "${rawSlug}"`);
          applyCategory('all');
        }
        return;
      }

      // ---------------------------------------------------------------------
      // Filter routes
      // ---------------------------------------------------------------------

      const platformMatch =
        path.match(/^\/platform\/([^/]+)$/) ||
        path.match(/^\/store\/platform\/([^/]+)$/);
      if (platformMatch) {
        const platform = decodeURIComponent(platformMatch[1]);
        console.log(`🔗 Deep link: platform "${platform}"`);
        applySingleFilter('platforms', platform);
        return;
      }

      const verticalMatch =
        path.match(/^\/vertical\/([^/]+)$/) ||
        path.match(/^\/store\/vertical\/([^/]+)$/) ||
        path.match(/^\/store\/industry\/([^/]+)$/);
      if (verticalMatch) {
        const vertical = decodeURIComponent(verticalMatch[1]);
        console.log(`🔗 Deep link: vertical "${vertical}"`);
        applySingleFilter('verticals', vertical);
        return;
      }

      const channelMatch =
        path.match(/^\/channel\/([^/]+)$/) ||
        path.match(/^\/store\/channel\/([^/]+)$/);
      if (channelMatch) {
        const channel = decodeURIComponent(channelMatch[1]);
        console.log(`🔗 Deep link: channel "${channel}"`);
        applySingleFilter('socialChannels', channel);
        return;
      }

      const modelMatch =
        path.match(/^\/model\/([^/]+)$/) ||
        path.match(/^\/store\/model\/([^/]+)$/);
      if (modelMatch) {
        const model = decodeURIComponent(modelMatch[1]);
        console.log(`🔗 Deep link: model "${model}"`);
        applySingleFilter('models', model);
        return;
      }

      // Provider routes (replicate, fal, openai, stability, elevenlabs, runway)
      const providerMatch =
        path.match(/^\/provider\/([^/]+)$/) ||
        path.match(/^\/store\/provider\/([^/]+)$/);
      if (providerMatch) {
        const provider = decodeURIComponent(providerMatch[1]).toLowerCase();
        console.log(`🔗 Deep link: provider "${provider}"`);
        applySingleFilter('providers', provider);
        return;
      }

      // Vendor routes (model owner: black-forest-labs, stability-ai, etc.)
      const vendorMatch =
        path.match(/^\/vendor\/([^/]+)$/) ||
        path.match(/^\/store\/vendor\/([^/]+)$/);
      if (vendorMatch) {
        const vendor = decodeURIComponent(vendorMatch[1]).toLowerCase();
        console.log(`🔗 Deep link: vendor "${vendor}"`);
        applySingleFilter('vendors', vendor);
        return;
      }

      // =====================================================================
      // Vendor Shortcut Routes - /vendor-name and /vendor-name/model-name
      // =====================================================================

      // Known vendors from capability registry
      const KNOWN_VENDORS = {
        'black-forest-labs': ['flux', 'bfl'],
        'google': ['veo', 'gemini'],
        'nvidia': ['sana', 'sana-sprint', 'chronoedit', 'canary', 'parakeet', 'nemotron', 'prismer', 'pdf-to-podcast'],
        'bytedance': ['seedance', 'seededit', 'sdxl-lightning', 'pulid'],
        'wan-video': ['wan'],
        'stability-ai': ['stable-diffusion', 'sd', 'sdxl', 'sd3', 'svd'],
        'minimax': ['hailuo'],
        'luma': ['ray', 'dream-machine'],
        'lightricks': ['ltx'],
        'runway': ['gen3'],
        'kwaivgi': ['kling'],
        'openai': ['dalle', 'dall-e', 'gpt-image'],
        'ideogram': [],
        'recraft': ['recraft-v3'],
        'lucataco': ['faceswap'],
        'easel': ['face-swap'],
        'cuuupid': ['idm-vton', 'virtual-try-on'],
        'tencentarc': ['gfpgan', 'photomaker'],
        'cjwbw': ['rembg'],
        'allenhooo': ['lama'],
        'schananas': ['grounded-sam'],
        'arielreplicate': ['robust-video-matting'],
      };

      // Check for /vendor-name/model-name format first (more specific)
      const vendorModelMatch = path.match(/^\/(?:store\/)?([a-z0-9-]+)\/([a-z0-9-]+(?:\/[a-z0-9-]+)?)$/i);
      if (vendorModelMatch) {
        const vendor = vendorModelMatch[1].toLowerCase();
        const modelPart = vendorModelMatch[2].toLowerCase();

        // Check if this is a known vendor
        if (KNOWN_VENDORS[vendor] || Object.values(KNOWN_VENDORS).flat().includes(vendor)) {
          const actualVendor = KNOWN_VENDORS[vendor] ? vendor :
            Object.entries(KNOWN_VENDORS).find(([v, aliases]) => aliases.includes(vendor))?.[0];

          if (actualVendor) {
            // Filter by vendor AND set a model filter hint
            const fullModelId = `${actualVendor}/${modelPart}`;
            console.log(`🔗 Deep link: vendor model "${fullModelId}"`);
            // Filter to show agents using this specific model
            clearAllTagFilters();
            activeFilters.vendors = [actualVendor];
            // Store the model filter for additional filtering
            window._vendorModelFilter = fullModelId;
            renderFilterChips();
            renderNavFilters();
            filterCategory('all');
            showTab('today');
            return;
          }
        }
      }

      // Check for /vendor-name format (vendor landing page)
      const vendorShortcutMatch = path.match(/^\/(?:store\/)?([a-z0-9-]+)$/i);
      if (vendorShortcutMatch) {
        const vendor = vendorShortcutMatch[1].toLowerCase();

        // Check if it's a known vendor or alias
        if (KNOWN_VENDORS[vendor]) {
          console.log(`🔗 Deep link: vendor "${vendor}"`);
          applySingleFilter('vendors', vendor);
          return;
        }

        // Check aliases
        for (const [actualVendor, aliases] of Object.entries(KNOWN_VENDORS)) {
          if (aliases.includes(vendor)) {
            console.log(`🔗 Deep link: vendor alias "${vendor}" → "${actualVendor}"`);
            applySingleFilter('vendors', actualVendor);
            return;
          }
        }
      }

      // ---------------------------------------------------------------------
      // Query param fallbacks for filters/categories
      // ---------------------------------------------------------------------

      const categoryFromQuery = params.get('category') || params.get('primary');
      if (categoryFromQuery) {
        const canonical = resolveCanonicalCategorySlug(categoryFromQuery);
        if (canonical) {
          applyCategory(canonical);
          return;
        }
      }

      const platformParam = params.get('platform');
      if (platformParam) {
        applySingleFilter('platforms', platformParam.split(',')[0]);
        return;
      }

      const verticalParam = params.get('vertical');
      if (verticalParam) {
        applySingleFilter('verticals', verticalParam.split(',')[0]);
        return;
      }

      const channelParam = params.get('channel');
      if (channelParam) {
        applySingleFilter('socialChannels', channelParam.split(',')[0]);
        return;
      }

      const modelParam = params.get('model');
      if (modelParam) {
        applySingleFilter('models', modelParam.split(',')[0]);
        return;
      }

      const providerParam = params.get('provider');
      if (providerParam) {
        applySingleFilter('providers', providerParam.split(',')[0].toLowerCase());
        return;
      }

      const vendorParam = params.get('vendor');
      if (vendorParam) {
        applySingleFilter('vendors', vendorParam.split(',')[0].toLowerCase());
        return;
      }

      // Default: store home
      if (path === "/aitopia/marketplace/index.html" || path === '/store.html' || path === '/') {
        // Close detail panel if open (from browser back button)
        const detailPage = document.getElementById('agentDetailPage');
        if (detailPage && !detailPage.classList.contains('translate-x-full')) {
          closeDetail(true); // skipHistoryBack=true since we're already at /store from popstate
        }
        clearAllTagFilters();
        filterCategory('all');
      }
    }

    // Initialize - load agents from API, then showcase metadata, then render
    async function initialize() {
      console.log('🚀 Initializing AITOPIA Store...');

      //window.AitopiaCredits?.loadBillingConfig?.().catch(() => null);

      // Load all data in parallel, wait for completion before rendering
      // No Promise.all — plain sequential calls, errors visible in console
try { await loadAgentsFromAPI(); } catch(e) { console.log("[store] loadAgentsFromAPI failed:", e); }
try { await loadCategoriesFromAPI(); } catch(e) { console.log("[store] loadCategoriesFromAPI failed:", e); }
try { await loadShowcaseMetadata(); } catch(e) { console.log("[store] loadShowcaseMetadata failed:", e); }
try { await loadModelsFromAPI(); } catch(e) { console.log("[store] loadModelsFromAPI failed:", e); }
try { await loadCommunityCreations(); } catch(e) { console.log("[store] loadCommunityCreations failed:", e); }
try { await marketplaceSearch.init(); } catch(e) { console.log("[store] marketplaceSearch.init failed:", e); }

      // Initial render (after all data is loaded)
      populateAgents();
      
      populateCommunityCreations();

      // Populate default slider tab (New & Noteworthy)
      populateNewNoteworthy();
      requestAnimationFrame(() => {
        balanceAllMasonryGrids();
      });

      let resizeTimeout;
      window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(balanceAllMasonryGrids, 100);
      });

      // Handle deep links AFTER agents are loaded (fixes race condition)
      handleDeepLinks();

      // Initialize autocomplete only after the search index load attempt completes.
      searchAutocompleteBindings.forEach((binding) => {
        try { binding.destroy(); } catch {}
      });
      searchAutocompleteBindings = setupStoreAutocomplete();

      console.log(`✅ Store initialized with ${Object.keys(agents).length} agents and ${aiModels.length} models`);
    }

    initialize();

// ============================================================================
// EXPOSE FUNCTIONS TO WINDOW FOR INLINE ONCLICK HANDLERS
// ============================================================================
// ES6 modules have their own scope, so functions must be explicitly exposed
// to the global window object for inline onclick handlers to access them.

window.openDetail = openDetail;
window.searchFor = searchFor;
window.navigateToAllAgents = navigateToAllAgents;
window.navigateToCategory = navigateToCategory;
window.goToAgentsPage = goToAgentsPage;
if (document.getElementById('navDrawer') && document.getElementById('navDrawerOverlay')) {
  window.toggleNavDrawer = toggleNavDrawer;
  window.closeNavDrawer = closeNavDrawer;
}
window.selectNavCategory = selectNavCategory;
window.toggleNavFilter = toggleNavFilter;
window.toggleFilter = toggleFilter;
window.clearAllFilters = clearAllFilters;
window.clearVendorModelFilter = clearVendorModelFilter;
window.showAllAgents = showAllAgents;
window.switchSliderTab = switchSliderTab;
window.closeDetail = closeDetail;
window.showTab = showTab;
window.switchAutomationTab = switchAutomationTab;
window.showAutomationInfo = showAutomationInfo;
window.closeAutomationInfoModal = closeAutomationInfoModal;
window.openAutomationModal = openAutomationModal;
window.closeAutomationModal = closeAutomationModal;
window.submitAutomationForm = submitAutomationForm;
window.toggleTriggerEnabled = toggleTriggerEnabled;
window.deleteTrigger = deleteTrigger;
window.deleteAction = deleteAction;
window.copyToClipboard = copyToClipboard;
window.toggleAgentShareMenu = toggleAgentShareMenu;
window.toggleOutputShareMenu = toggleOutputShareMenu;
window.shareAgent = shareAgent;
window.shareOutput = shareOutput;
window.copyAgentLink = copyAgentLink;
window.copyOutputLink = copyOutputLink;
window.copyOutputText = copyOutputText;
window.downloadOutput = downloadOutput;
window.openApiModal = openApiModal;
window.closeApiModal = closeApiModal;
window.retryApiDocs = retryApiDocs;
window.switchApiTab = switchApiTab;
window.toggleStreaming = toggleStreaming;
window.copyApiCode = copyApiCode;
  