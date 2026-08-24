// Complete Agent Database with Real Assets
    const agents = {
      'virtual-try-on': {
        id: 'virtual-try-on',
        name: 'Virtual Try-On',
        category: 'E-Commerce',
        categoryKey: 'ecommerce',
        description: 'Transform flat-lay clothing into photorealistic model shots. Eliminate expensive photoshoots while maintaining studio quality. Our AI analyzes garment details, fabric textures, and creates natural-looking fits on virtual models.',
        icon: 'https://agent-assets-prod.muleusercontent.com/agents/agent-aitopia/assets/20251111/54e2dc15-d602-40aa-9b09-0983f7a4f8b3/虚拟试衣.png',
        screenshots: [
          'https://agent-assets-prod.muleusercontent.com/agents/agent-aitopia/assets/20251111/71b89f38-5a95-496a-bdbd-2e1c30bdb993/cover-1_(10).png',
          'https://agent-assets-prod.muleusercontent.com/agents/agent-aitopia/assets/20251111/cbadc961-804c-4059-a140-fff3fddc70d7/cover_(12).png'
        ],
        rating: 4.8,
        reviews: '15.2K',
        tier: 'Pro',
        features: ['Person validation', 'Garment classification', 'Virtual fitting', 'Multiple garment types'],
        version: '1.0.0',
        size: '~30 sec',
        developer: 'MuleRun'
      },
      'face-swap': {
        id: 'face-swap',
        name: 'Face Swap',
        category: 'Creative',
        categoryKey: 'creative',
        description: 'Swap faces between two images seamlessly using advanced AI. Features high quality swap, face detection, natural blending, and support for multiple faces.',
        icon: 'https://agent-assets-prod.muleusercontent.com/agents/agent-aitopia/assets/20251111/3b3049b7-bc21-46a8-b445-f2e339e3e65a/换脸.png',
        screenshots: [
          'https://agent-assets-prod.muleusercontent.com/agents/agent-aitopia/assets/20251111/a72088b2-0505-4924-bf9b-6c9e1c49db8b/cover-2_(3).png'
        ],
        rating: 4.7,
        reviews: '12.8K',
        tier: 'Pro',
        features: ['High quality swap', 'Face detection', 'Natural blending', 'Multiple faces'],
        version: '1.0.0',
        size: '~45 sec',
        developer: 'Higgsfield AI'
      },
      'image-generator': {
        id: 'image-generator',
        name: 'Image Generator',
        category: 'AI Art',
        categoryKey: 'image',
        description: 'Multi-provider AI image generation using DALL-E 3, Stability AI, and Flux models. Create stunning visuals from text prompts.',
        icon: 'https://assets-01.mulerun.com/agent/311be0d7-cd68-4fa7-99bc-232e535ebb39/v2025.09.02-07.37.32/showcase-1.png',
        screenshots: [
          'https://assets-01.mulerun.com/agent/311be0d7-cd68-4fa7-99bc-232e535ebb39/v2025.09.02-07.37.32/showcase-2.webp',
          'https://dqv0cqkoy5oj7.cloudfront.net/user_2vtxM3DRcDcQIjpmiCpUDF2wcAT/453bc1ba-2cf6-4897-9268-a4403f35e18e_min.webp'
        ],
        rating: 4.9,
        reviews: '28.5K',
        tier: 'Pro',
        features: ['DALL-E 3', 'Stability SDXL', 'Flux Models', 'Multiple Styles'],
        version: '1.0.0',
        size: '~20 sec',
        developer: 'Higgsfield AI'
      },
      'background-remover': {
        id: 'background-remover',
        name: 'Background Remover',
        category: 'Image Processing',
        categoryKey: 'image',
        description: 'Remove backgrounds from images instantly using AI. Perfect for product photography and marketing materials.',
        icon: 'https://assets-01.mulerun.com/agent/10aa0000-d27e-49f0-9ee9-0ad7d99f57b3/v1.0.3/showcase-1.webp',
        screenshots: [
          'https://assets-01.mulerun.com/agent/10aa0000-d27e-49f0-9ee9-0ad7d99f57b3/v1.0.3/showcase-2.webp'
        ],
        rating: 4.8,
        reviews: '45.1K',
        tier: 'Starter',
        features: ['Instant removal', 'High quality edges', 'Transparent PNG', 'Batch processing'],
        version: '1.0.0',
        size: '~5 sec',
        developer: 'MuleRun'
      },
      'video-generator': {
        id: 'video-generator',
        name: 'Video Generator',
        category: 'Video',
        categoryKey: 'video',
        description: 'AI video generation using Runway Gen-3 Alpha. Create stunning videos from text or images.',
        icon: 'https://cdn.higgsfield.ai/card/ae2180fa-cbab-47a1-b52e-bf07432f34f5.webp',
        videos: ['https://static.higgsfield.ai/70e490b9-26b7-4572-8d9c-2ac8dcc9adc0.mp4'],
        rating: 4.9,
        reviews: '8.3K',
        tier: 'Enterprise',
        features: ['Text-to-Video', 'Image-to-Video', 'Gen-3 Alpha', 'Multiple Durations'],
        version: '1.0.0',
        size: '~2 min',
        developer: 'Higgsfield AI'
      },
      'image-upscaler': {
        id: 'image-upscaler',
        name: 'Image Upscaler',
        category: 'Image Processing',
        categoryKey: 'image',
        description: 'AI image upscaling and enhancement up to 4x resolution.',
        icon: 'https://assets-01.mulerun.com/agent/c55ea644-5e6f-45ca-bcb7-30135f3e984c/v1.0.1/showcase-1.webp',
        screenshots: [
          'https://assets-01.mulerun.com/agent/c55ea644-5e6f-45ca-bcb7-30135f3e984c/v1.0.1/showcase-2.webp'
        ],
        rating: 4.8,
        reviews: '22.4K',
        tier: 'Starter',
        features: ['4x Upscale', 'Noise Reduction', 'Face Enhancement', 'Detail Restoration'],
        version: '1.0.0',
        size: '~15 sec',
        developer: 'MuleRun'
      },
      'portrait-enhancer': {
        id: 'portrait-enhancer',
        name: 'Portrait Enhancer',
        category: 'Image Processing',
        categoryKey: 'image',
        description: 'Professional portrait enhancement and retouching with AI.',
        icon: 'https://agent-assets-prod.muleusercontent.com/agents/agent-aitopia/assets/20251111/71b89f38-5a95-496a-bdbd-2e1c30bdb993/cover-1_(10).png',
        screenshots: [],
        rating: 4.6,
        reviews: '9.1K',
        tier: 'Starter',
        features: ['Skin Smoothing', 'Eye Enhancement', 'Lighting Fix', 'Natural Results'],
        version: '1.0.0',
        size: '~10 sec',
        developer: 'MuleRun'
      },
      'image-animator': {
        id: 'image-animator',
        name: 'Image Animator',
        category: 'Video',
        categoryKey: 'video',
        description: 'Animate still images with AI motion synthesis.',
        icon: 'https://cdn.higgsfield.ai/card/ae2180fa-cbab-47a1-b52e-bf07432f34f5.webp',
        videos: ['https://cdn.higgsfield.ai/wan2_2_motion/22b6f9ca-5469-4086-8956-a2deb4944307.mp4'],
        rating: 4.7,
        reviews: '4.2K',
        tier: 'Pro',
        features: ['Motion Synthesis', 'Loop Creation', 'Depth Estimation', 'Parallax Effect'],
        version: '1.0.0',
        size: '~30 sec',
        developer: 'Higgsfield AI'
      },
      'video-upscaler': {
        id: 'video-upscaler',
        name: 'Video Upscaler',
        category: 'Video',
        categoryKey: 'video',
        description: 'Upscale and enhance video quality up to 4K.',
        icon: 'https://cdn.higgsfield.ai/card/ae2180fa-cbab-47a1-b52e-bf07432f34f5.webp',
        screenshots: [],
        rating: 4.6,
        reviews: '3.8K',
        tier: 'Pro',
        features: ['4K Upscale', 'Frame Interpolation', 'Stabilization', 'Denoising'],
        version: '1.0.0',
        size: '~5 min',
        developer: 'Higgsfield AI'
      },
      'music-generator': {
        id: 'music-generator',
        name: 'Music Generator',
        category: 'Audio',
        categoryKey: 'audio',
        description: 'AI music and sound effect generation with MusicGen.',
        icon: 'https://assets-01.mulerun.com/pages/landing/agents/agent-head-3.webp',
        screenshots: [],
        rating: 4.5,
        reviews: '2.1K',
        tier: 'Pro',
        features: ['MusicGen', 'Sound Effects', 'Ambient', 'Style Control'],
        version: '1.0.0',
        size: '~45 sec',
        developer: 'Higgsfield AI'
      },
      'voice-cloner': {
        id: 'voice-cloner',
        name: 'Voice Cloner',
        category: 'Audio',
        categoryKey: 'audio',
        description: 'AI voice synthesis with multiple voice presets using Bark.',
        icon: 'https://assets-01.mulerun.com/pages/landing/agents/agent-head-4.webp',
        screenshots: [],
        rating: 4.4,
        reviews: '1.8K',
        tier: 'Enterprise',
        features: ['Voice Synthesis', 'Multiple Presets', 'Natural Speech', 'Multi-Language'],
        version: '1.0.0',
        size: '~3 min',
        developer: 'Higgsfield AI'
      },
      'ai-model-swap': {
        id: 'ai-model-swap',
        name: 'AI Model Swap',
        category: 'E-Commerce',
        categoryKey: 'ecommerce',
        description: 'Swap fashion models in product photos while keeping garments intact.',
        icon: 'https://agent-assets-prod.muleusercontent.com/agents/agent-aitopia/assets/20251111/8e282302-b729-45c7-be39-7c48b3161a96/cover_(11).png',
        screenshots: [
          'https://agent-assets-prod.muleusercontent.com/agents/agent-aitopia/assets/20251111/09d4e979-5eb0-4e27-b865-c3856d6cccd0/模特换肤.png'
        ],
        rating: 4.7,
        reviews: '5.6K',
        tier: 'Pro',
        features: ['Model replacement', 'Garment preservation', 'Pose matching', 'Natural results'],
        version: '1.0.0',
        size: '~1 min',
        developer: 'MuleRun'
      },
      'chibi-sticker-maker': {
        id: 'chibi-sticker-maker',
        name: 'Chibi Sticker Maker',
        category: 'Creative',
        categoryKey: 'creative',
        description: 'Turn photos into cute sticker packs instantly.',
        icon: 'https://assets-01.mulerun.com/agent/82428895-e64f-4339-ba9f-1ac174b2bb4a/v1.0.1/showcase-1.png',
        screenshots: [
          'https://assets-01.mulerun.com/agent/82428895-e64f-4339-ba9f-1ac174b2bb4a/v1.0.1/showcase-2.webp'
        ],
        rating: 4.9,
        reviews: '8.4K',
        tier: 'Starter',
        features: ['Cute stickers', 'Multiple poses', 'Expression variants', 'Instant generation'],
        version: '1.0.0',
        size: '~15 sec',
        developer: 'MuleRun'
      },
      'product-description-writer': {
        id: 'product-description-writer',
        name: 'Product Description Writer',
        category: 'Content',
        categoryKey: 'productivity',
        description: 'Generate compelling product descriptions with SEO optimization.',
        icon: 'https://agent-assets-prod.muleusercontent.com/agents/agent-aitopia/assets/20251110/c3e5fd64-938e-4bd1-b389-71d113b3ed28/mulerun3.png',
        screenshots: [],
        rating: 4.8,
        reviews: '18.2K',
        tier: 'Free',
        features: ['Platform optimization', 'SEO integration', 'Multiple variations', 'Benefit highlighting'],
        version: '1.0.0',
        size: '~5 sec',
        developer: 'MuleRun'
      }
    };

    // Page Navigation
    function showPage(pageId) {
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));

      document.getElementById(pageId)?.classList.add('active');
      document.querySelector(`[data-page="${pageId}"]`)?.classList.add('active');

      // Update nav title
      const titles = { todayPage: 'Today', appsPage: 'Agents', searchPage: 'Search' };
      const titleText = titles[pageId] || 'Today';
      const navLarge = document.querySelector('.nav-large-title');
      if (navLarge) navLarge.textContent = titleText;
      const navInline = document.querySelector('.nav-inline-title');
      if (navInline) navInline.textContent = titleText;

      if (pageId === 'appsPage') populateAllAgents();
    }

    // Populate All Agents
    function populateAllAgents() {
      const container = document.getElementById('allAgentsList');
      if (!container) return;
      container.innerHTML = Object.values(agents).map(a => `
        <a class="app-row" href="#" data-action="openDetail" data-param="${a.id}">
          <img class="app-icon" src="${a.icon}" alt="${a.name}">
          <div class="app-info">
            <div class="app-name">${a.name}</div>
            <div class="app-subtitle">${a.description.substring(0, 40)}...</div>
            <div class="app-meta">${a.category}</div>
          </div>
          <button class="get-button">${a.tier === 'Free' ? 'FREE' : 'GET'}</button>
        </a>
      `).join('');
    }

    // Filter by Category
    function filterCategory(cat) {
      showPage('searchPage');
      const filtered = Object.values(agents).filter(a =>
        a.categoryKey === cat || a.category.toLowerCase().includes(cat)
      );
      displayResults(filtered);
      const searchTitleEl = document.getElementById('searchResultsTitle');
      if (searchTitleEl) searchTitleEl.textContent = `${cat.charAt(0).toUpperCase() + cat.slice(1)} Agents`;
    }

    // Search
    function searchFor(query) {
      const filtered = Object.values(agents).filter(a =>
        a.name.toLowerCase().includes(query.toLowerCase()) ||
        a.description.toLowerCase().includes(query.toLowerCase()) ||
        a.category.toLowerCase().includes(query.toLowerCase())
      );
      displayResults(filtered);
    }

    // Display Results
    function displayResults(results) {
      const container = document.getElementById('searchResults');
      if (!container) return;
      if (results.length === 0) {
        container.innerHTML = '<p style="padding: var(--space-5); text-align: center; color: var(--label-tertiary);">No results found</p>';
        return;
      }
      container.innerHTML = results.map(a => `
        <a class="app-row" href="#" data-action="openDetail" data-param="${a.id}">
          <img class="app-icon" src="${a.icon}" alt="${a.name}">
          <div class="app-info">
            <div class="app-name">${a.name}</div>
            <div class="app-subtitle">${a.description.substring(0, 40)}...</div>
            <div class="app-meta">${a.category}</div>
          </div>
          <button class="get-button">${a.tier === 'Free' ? 'FREE' : 'GET'}</button>
        </a>
      `).join('');
    }

    // Search Input
    document.getElementById('searchInput')?.addEventListener('input', e => {
      if (e.target.value.length > 0) {
        showPage('searchPage');
        searchFor(e.target.value);
        const titleEl = document.getElementById('searchResultsTitle');
        if (titleEl) titleEl.textContent = 'Search Results';
      }
    });

    // Open Detail
    function openDetail(agentId) {
      const agent = agents[agentId];
      if (!agent) return;

      const stars = Array(5).fill(0).map((_, i) =>
        `<svg class="${i < Math.floor(agent.rating) ? '' : 'empty'}" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>`
      ).join('');

      const media = agent.videos?.map(v => `
        <div class="screenshot-item">
          <video autoplay muted loop playsinline><source src="${v}" type="video/mp4"></video>
        </div>
      `).join('') || '';

      const screenshots = agent.screenshots?.map(s => `
        <div class="screenshot-item"><img src="${s}" alt="Screenshot"></div>
      `).join('') || '';

      const features = agent.features.map(f => `
        <li>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
          <span>${f}</span>
        </li>
      `).join('');

      const detailContent = document.getElementById('detailContent');
      if (!detailContent) return;
      detailContent.innerHTML = `
        <div class="detail-header">
          <div class="detail-app-row">
            <img class="detail-icon" src="${agent.icon}" alt="${agent.name}">
            <div class="detail-info">
              <h1 class="detail-name">${agent.name}</h1>
              <div class="detail-developer">${agent.developer}</div>
              <a class="detail-get-button" href="/aitopia/marketplace/test-all-agents.html#${agent.id}">
                ${agent.tier === 'Free' ? 'GET - FREE' : 'GET'}
              </a>
            </div>
          </div>
        </div>

        <div style="padding: 0 var(--space-4);">
          <div class="info-bar">
            <div class="info-item">
              <div class="info-value">${agent.rating}</div>
              <div class="info-label">${agent.reviews} Ratings</div>
            </div>
            <div class="info-divider"></div>
            <div class="info-item">
              <div class="info-value">${agent.tier}</div>
              <div class="info-label">Tier</div>
            </div>
            <div class="info-divider"></div>
            <div class="info-item">
              <div class="info-value">${agent.size}</div>
              <div class="info-label">Processing</div>
            </div>
          </div>
        </div>

        ${(media || screenshots) ? `
          <section class="section" style="margin: var(--space-4);">
            <div class="section-header">
              <h2 class="section-title">Preview</h2>
            </div>
            <div class="screenshot-scroll" style="margin: 0 calc(-1 * var(--space-4)); padding: 0 var(--space-4);">
              ${media}${screenshots}
            </div>
          </section>
        ` : ''}

        <div class="detail-section">
          <h3 class="detail-section-title">Description</h3>
          <p class="detail-text">${agent.description}</p>
        </div>

        <div class="detail-section">
          <h3 class="detail-section-title">What's New</h3>
          <p style="font: var(--text-caption-1); color: var(--label-tertiary); margin-bottom: var(--space-2);">Version ${agent.version}</p>
          <p class="detail-text">Latest updates and improvements</p>
        </div>

        <div class="detail-section">
          <h3 class="detail-section-title">Features</h3>
          <ul class="feature-list">${features}</ul>
        </div>

        <div class="detail-section" style="margin-bottom: 100px;">
          <h3 class="detail-section-title">Ratings & Reviews</h3>
          <div class="rating-display">
            <span class="rating-big">${agent.rating}</span>
            <div>
              <div class="rating-stars">${stars}</div>
              <div class="rating-count">${agent.reviews} Reviews</div>
            </div>
          </div>
        </div>
      `;

      document.getElementById('detailPage')?.classList.add('open');
      document.body.style.overflow = 'hidden';
    }

    // Close Detail
    function closeDetail() {
      document.getElementById('detailPage')?.classList.remove('open');
      document.body.style.overflow = '';
    }

    // Scroll Detection for Nav Bar
    let lastScroll = 0;
    window.addEventListener('scroll', () => {
      const navbar = document.getElementById('navbar');
      if (!navbar) return;
      if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    });

    // Initialize
    populateAllAgents();