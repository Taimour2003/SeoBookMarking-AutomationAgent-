// Agent Database (with real assets)
    const agents = {
      'virtual-try-on': {
        id: 'virtual-try-on',
        name: 'Virtual Try-On',
        category: 'E-Commerce',
        description: 'Transform flat-lay clothing into photorealistic model shots. Eliminate expensive photoshoots while maintaining studio quality. Our AI analyzes garment details, fabric textures, and creates natural-looking fits on virtual models.',
        icon: 'https://agent-assets-prod.muleusercontent.com/agents/agent-aitopia/assets/20251111/54e2dc15-d602-40aa-9b09-0983f7a4f8b3/虚拟试衣.png',
        screenshots: [
          'https://agent-assets-prod.muleusercontent.com/agents/agent-aitopia/assets/20251111/71b89f38-5a95-496a-bdbd-2e1c30bdb993/cover-1_(10).png',
          'https://agent-assets-prod.muleusercontent.com/agents/agent-aitopia/assets/20251111/cbadc961-804c-4059-a140-fff3fddc70d7/cover_(12).png',
          'https://agent-assets-prod.muleusercontent.com/agents/agent-aitopia/assets/20251111/c36c0f2f-c914-45a7-9b66-55db2c3e64fe/cover-1_(9).png'
        ],
        rating: 4.8,
        reviews: '15.2K',
        tier: 'Pro',
        features: ['Person validation', 'Garment classification', 'Virtual fitting', 'Multiple garment types'],
        version: '1.0.0',
        size: '~30 sec',
        developer: 'AI Marketplace'
      },
      'face-swap': {
        id: 'face-swap',
        name: 'Face Swap',
        category: 'Creative',
        description: 'Swap faces between two images seamlessly using advanced AI. Features high quality swap, face detection, natural blending, and support for multiple faces in a single image.',
        icon: 'https://agent-assets-prod.muleusercontent.com/agents/agent-aitopia/assets/20251111/3b3049b7-bc21-46a8-b445-f2e339e3e65a/换脸.png',
        screenshots: [
          'https://agent-assets-prod.muleusercontent.com/agents/agent-aitopia/assets/20251111/a72088b2-0505-4924-bf9b-6c9e1c49db8b/cover-2_(3).png',
          'https://agent-assets-prod.muleusercontent.com/agents/agent-aitopia/assets/20251111/129840a5-8f47-4006-b9ba-ca4b0615ca62/cover_(16).png'
        ],
        rating: 4.7,
        reviews: '12.8K',
        tier: 'Pro',
        features: ['High quality swap', 'Face detection', 'Natural blending', 'Multiple faces'],
        version: '1.0.0',
        size: '~45 sec',
        developer: 'AI Marketplace'
      },
      'image-generator': {
        id: 'image-generator',
        name: 'Image Generator',
        category: 'AI Art',
        description: 'Multi-provider AI image generation using DALL-E 3, Stability AI, and Flux models. Create stunning visuals from text prompts with multiple style options and batch generation support.',
        icon: 'https://assets-01.mulerun.com/agent/311be0d7-cd68-4fa7-99bc-232e535ebb39/v2025.09.02-07.37.32/showcase-1.png',
        screenshots: [
          'https://assets-01.mulerun.com/agent/311be0d7-cd68-4fa7-99bc-232e535ebb39/v2025.09.02-07.37.32/showcase-2.webp',
          'https://dqv0cqkoy5oj7.cloudfront.net/user_2vtxM3DRcDcQIjpmiCpUDF2wcAT/453bc1ba-2cf6-4897-9268-a4403f35e18e_min.webp',
          'https://d8j0ntlcm91z4.cloudfront.net/content_user_id/83034e1a-1d32-4053-a1bc-bbcb7a9491c8.jpeg'
        ],
        rating: 4.9,
        reviews: '28.5K',
        tier: 'Pro',
        features: ['DALL-E 3', 'Stability SDXL', 'Flux Models', 'Multiple Styles', 'Batch Generation'],
        version: '1.0.0',
        size: '~20 sec',
        developer: 'AI Marketplace'
      },
      'background-remover': {
        id: 'background-remover',
        name: 'Background Remover',
        category: 'Image Processing',
        description: 'Remove backgrounds from images instantly using AI. Get high quality edges and transparent PNG output. Perfect for product photography, portrait editing, and marketing materials.',
        icon: 'https://assets-01.mulerun.com/agent/10aa0000-d27e-49f0-9ee9-0ad7d99f57b3/v1.0.3/showcase-1.webp',
        screenshots: [
          'https://assets-01.mulerun.com/agent/10aa0000-d27e-49f0-9ee9-0ad7d99f57b3/v1.0.3/showcase-2.webp'
        ],
        rating: 4.8,
        reviews: '45.1K',
        tier: 'Starter',
        features: ['Instant removal', 'High quality edges', 'Transparent PNG output', 'Batch processing'],
        version: '1.0.0',
        size: '~5 sec',
        developer: 'AI Marketplace'
      },
      'video-generator': {
        id: 'video-generator',
        name: 'Video Generator',
        category: 'Video',
        description: 'AI video generation using Runway Gen-3 Alpha. Create stunning videos from text prompts or transform images into motion. Perfect for marketing videos, social media content, and creative projects.',
        icon: 'https://cdn.higgsfield.ai/card/ae2180fa-cbab-47a1-b52e-bf07432f34f5.webp',
        screenshots: [],
        videos: [
          'https://static.higgsfield.ai/70e490b9-26b7-4572-8d9c-2ac8dcc9adc0.mp4',
          'https://cdn.higgsfield.ai/kling_motion/8c4795a8-e7ef-4272-8fb3-9d349192a013.mp4'
        ],
        rating: 4.9,
        reviews: '8.3K',
        tier: 'Enterprise',
        features: ['Text-to-Video', 'Image-to-Video', 'Gen-3 Alpha', 'Multiple Durations'],
        version: '1.0.0',
        size: '~2 min',
        developer: 'AI Marketplace'
      },
      'lip-sync': {
        id: 'lip-sync',
        name: 'Lip Sync',
        category: 'Video',
        description: 'AI-powered lip synchronization for videos. Sync any audio to video with natural mouth movements and emotion transfer.',
        icon: 'https://cdn.higgsfield.ai/card/75702883-8d92-4737-94f0-975af4036cec.webp',
        screenshots: [],
        videos: [
          'https://cdn.higgsfield.ai/kling_motion/dbe2fcf5-9605-41ea-96ed-b5b655bbbeb0.mp4'
        ],
        rating: 4.6,
        reviews: '5.2K',
        tier: 'Pro',
        features: ['Audio Sync', 'Multiple Models', 'Quality Control', 'Emotion Transfer'],
        version: '1.0.0',
        size: '~1 min',
        developer: 'AI Marketplace'
      },
      'talking-avatar': {
        id: 'talking-avatar',
        name: 'Talking Avatar',
        category: 'Video',
        description: 'Generate talking head videos from still images. Perfect for virtual presenters, educational content, and marketing videos.',
        icon: 'https://cdn.higgsfield.ai/8ab53648-e4d3-41ad-900e-b38b6f33dbaf.webp',
        screenshots: [
          'https://cdn.higgsfield.ai/8ab53648-e4d3-41ad-900e-b38b6f33dbaf.webp'
        ],
        rating: 4.7,
        reviews: '6.8K',
        tier: 'Pro',
        features: ['Image to Video', 'Text-to-Speech', 'Expression Control', 'Multiple Styles'],
        version: '1.0.0',
        size: '~1 min',
        developer: 'AI Marketplace'
      },
      'image-upscaler': {
        id: 'image-upscaler',
        name: 'Image Upscaler',
        category: 'Image Processing',
        description: 'AI image upscaling and enhancement up to 4x resolution. Features noise reduction, face enhancement, and detail restoration.',
        icon: 'https://assets-01.mulerun.com/agent/c55ea644-5e6f-45ca-bcb7-30135f3e984c/v1.0.1/showcase-1.webp',
        screenshots: [
          'https://assets-01.mulerun.com/agent/c55ea644-5e6f-45ca-bcb7-30135f3e984c/v1.0.1/showcase-2.webp',
          'https://assets-01.mulerun.com/agent/c55ea644-5e6f-45ca-bcb7-30135f3e984c/v1.0.1/showcase-3.webp'
        ],
        rating: 4.8,
        reviews: '22.4K',
        tier: 'Starter',
        features: ['4x Upscale', 'Noise Reduction', 'Face Enhancement', 'Detail Restoration'],
        version: '1.0.0',
        size: '~15 sec',
        developer: 'AI Marketplace'
      },
      'portrait-enhancer': {
        id: 'portrait-enhancer',
        name: 'Portrait Enhancer',
        category: 'Image Processing',
        description: 'Professional portrait enhancement and retouching with AI. Features skin smoothing, eye enhancement, lighting fix, and natural results.',
        icon: 'https://agent-assets-prod.muleusercontent.com/agents/agent-aitopia/assets/20251111/71b89f38-5a95-496a-bdbd-2e1c30bdb993/cover-1_(10).png',
        screenshots: [],
        rating: 4.6,
        reviews: '9.1K',
        tier: 'Starter',
        features: ['Skin Smoothing', 'Eye Enhancement', 'Lighting Fix', 'Natural Results'],
        version: '1.0.0',
        size: '~10 sec',
        developer: 'AI Marketplace'
      },
      'style-transfer': {
        id: 'style-transfer',
        name: 'Style Transfer',
        category: 'Creative',
        description: 'Apply artistic styles to images with AI. Choose from art styles, custom styles, intensity control, and a preset library.',
        icon: 'https://agent-assets-prod.muleusercontent.com/agents/agent-aitopia/assets/20251111/129840a5-8f47-4006-b9ba-ca4b0615ca62/cover_(16).png',
        screenshots: [],
        rating: 4.5,
        reviews: '7.3K',
        tier: 'Starter',
        features: ['Art Styles', 'Custom Styles', 'Intensity Control', 'Preset Library'],
        version: '1.0.0',
        size: '~20 sec',
        developer: 'AI Marketplace'
      },
      'image-animator': {
        id: 'image-animator',
        name: 'Image Animator',
        category: 'Video',
        description: 'Animate still images with AI motion synthesis. Create motion synthesis, loop creation, depth estimation, and parallax effects.',
        icon: 'https://cdn.higgsfield.ai/card/ae2180fa-cbab-47a1-b52e-bf07432f34f5.webp',
        screenshots: [],
        videos: [
          'https://cdn.higgsfield.ai/wan2_2_motion/22b6f9ca-5469-4086-8956-a2deb4944307.mp4',
          'https://cdn.higgsfield.ai/minimax_hailuo_motion/382ba2da-a405-4459-89c2-c31a31469185.mp4'
        ],
        rating: 4.7,
        reviews: '4.2K',
        tier: 'Pro',
        features: ['Motion Synthesis', 'Loop Creation', 'Depth Estimation', 'Parallax Effect'],
        version: '1.0.0',
        size: '~30 sec',
        developer: 'AI Marketplace'
      },
      'video-upscaler': {
        id: 'video-upscaler',
        name: 'Video Upscaler',
        category: 'Video',
        description: 'Upscale and enhance video quality up to 4K. Features 4K upscale, frame interpolation, stabilization, and denoising.',
        icon: 'https://cdn.higgsfield.ai/card/ae2180fa-cbab-47a1-b52e-bf07432f34f5.webp',
        screenshots: [],
        rating: 4.6,
        reviews: '3.8K',
        tier: 'Pro',
        features: ['4K Upscale', 'Frame Interpolation', 'Stabilization', 'Denoising'],
        version: '1.0.0',
        size: '~5 min',
        developer: 'AI Marketplace'
      },
      'music-generator': {
        id: 'music-generator',
        name: 'Music Generator',
        category: 'Audio',
        description: 'AI music and sound effect generation with MusicGen. Create soundtracks, sound effects, ambient music with style control.',
        icon: 'https://assets-01.mulerun.com/pages/landing/agents/agent-head-3.webp',
        screenshots: [],
        rating: 4.5,
        reviews: '2.1K',
        tier: 'Pro',
        features: ['MusicGen', 'Sound Effects', 'Ambient', 'Style Control'],
        version: '1.0.0',
        size: '~45 sec',
        developer: 'AI Marketplace'
      },
      'voice-cloner': {
        id: 'voice-cloner',
        name: 'Voice Cloner',
        category: 'Audio',
        description: 'AI voice synthesis with multiple voice presets using Bark model. Features voice synthesis, multiple presets, natural speech, and multi-language support.',
        icon: 'https://assets-01.mulerun.com/pages/landing/agents/agent-head-4.webp',
        screenshots: [],
        rating: 4.4,
        reviews: '1.8K',
        tier: 'Enterprise',
        features: ['Voice Synthesis', 'Multiple Presets', 'Natural Speech', 'Multi-Language'],
        version: '1.0.0',
        size: '~3 min',
        developer: 'AI Marketplace'
      },
      'ai-model-swap': {
        id: 'ai-model-swap',
        name: 'AI Model Swap',
        category: 'E-Commerce',
        description: 'Swap fashion models in product photos while keeping garments intact. Perfect for fashion photography, e-commerce, marketing, and catalog production.',
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
        developer: 'AI Marketplace'
      },
      'product-description-writer': {
        id: 'product-description-writer',
        name: 'Product Description Writer',
        category: 'Content',
        description: 'Generate compelling product descriptions optimized for different platforms. Features platform optimization, SEO integration, multiple variations, and benefit highlighting.',
        icon: 'https://agent-assets-prod.muleusercontent.com/agents/agent-aitopia/assets/20251110/c3e5fd64-938e-4bd1-b389-71d113b3ed28/mulerun3.png',
        screenshots: [
          'https://agent-assets-prod.muleusercontent.com/agents/agent-aitopia/assets/20251110/b9d40528-104f-4146-a83b-9997afafb338/mulerun2.png'
        ],
        rating: 4.8,
        reviews: '18.2K',
        tier: 'Free',
        features: ['Platform optimization', 'SEO integration', 'Multiple variations', 'Benefit highlighting'],
        version: '1.0.0',
        size: '~5 sec',
        developer: 'AI Marketplace'
      },
      'chibi-sticker-maker': {
        id: 'chibi-sticker-maker',
        name: 'Chibi Sticker Maker',
        category: 'Creative',
        description: 'Turn your photo into a complete cute sticker pack instantly. Perfect for social media, messaging apps, and personal branding.',
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
        developer: 'AI Marketplace'
      }
    };

    // Page Navigation
    function showPage(pageId) {
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));

      document.getElementById(pageId)?.classList.add('active');
      document.querySelector(`[data-page="${pageId}"]`)?.classList.add('active');

      if (pageId === 'appsPage') {
        populateTopAgents();
      }
    }

    // Populate Top Agents
    function populateTopAgents() {
      const container = document.getElementById('topAgentsList');
      if (!container) return;
      container.innerHTML = Object.values(agents).map(agent => `
        <a class="app-card" href="#" data-action="showAgentDetail" data-param="${agent.id}">
          <img class="app-icon" src="${agent.icon}" alt="${agent.name}">
          <div class="app-info">
            <div class="app-name">${agent.name}</div>
            <div class="app-subtitle">${agent.description.substring(0, 50)}...</div>
            <div class="app-category">${agent.category}</div>
          </div>
          <button class="app-get-btn">${agent.tier === 'Free' ? 'FREE' : 'GET'}</button>
        </a>
      `).join('');
    }

    // Filter by Category
    function filterByCategory(category) {
      showPage('searchPage');
      const filtered = Object.values(agents).filter(a =>
        a.category.toLowerCase().includes(category.toLowerCase())
      );
      displaySearchResults(filtered);
    }

    // Search Agents
    function searchAgents(query) {
      const filtered = Object.values(agents).filter(a =>
        a.name.toLowerCase().includes(query.toLowerCase()) ||
        a.description.toLowerCase().includes(query.toLowerCase()) ||
        a.category.toLowerCase().includes(query.toLowerCase())
      );
      displaySearchResults(filtered);
    }

    // Display Search Results
    function displaySearchResults(results) {
      const container = document.getElementById('searchResults');
      if (!container) return;
      if (results.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--ios-label-tertiary); padding: 40px;">No agents found.</p>';
        return;
      }
      container.innerHTML = results.map(agent => `
        <a class="app-card" href="#" data-action="showAgentDetail" data-param="${agent.id}">
          <img class="app-icon" src="${agent.icon}" alt="${agent.name}">
          <div class="app-info">
            <div class="app-name">${agent.name}</div>
            <div class="app-subtitle">${agent.description.substring(0, 50)}...</div>
            <div class="app-category">${agent.category}</div>
          </div>
          <button class="app-get-btn">${agent.tier === 'Free' ? 'FREE' : 'GET'}</button>
        </a>
      `).join('');
    }

    // Search Input Handler
    document.getElementById('searchInput')?.addEventListener('input', (e) => {
      if (e.target.value.length > 0) {
        showPage('searchPage');
        searchAgents(e.target.value);
      }
    });

    // Show Agent Detail
    function showAgentDetail(agentId) {
      const agent = agents[agentId];
      if (!agent) return;

      const stars = Array(5).fill(0).map((_, i) =>
        `<svg class="star ${i < Math.floor(agent.rating) ? '' : 'empty'}" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>`
      ).join('');

      const screenshots = agent.screenshots?.map(src => `
        <div class="screenshot-item">
          <img src="${src}" alt="Screenshot">
        </div>
      `).join('') || '';

      const videos = agent.videos?.map(src => `
        <div class="screenshot-item">
          <video autoplay muted loop playsinline>
            <source src="${src}" type="video/mp4">
          </video>
        </div>
      `).join('') || '';

      const features = agent.features.map(f => `
        <li>
          <svg class="feature-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
          <span class="feature-text">${f}</span>
        </li>
      `).join('');

      const modalContent = document.getElementById('modalContent');
      if (modalContent) modalContent.innerHTML = `
        <div class="detail-header">
          <img class="detail-icon" src="${agent.icon}" alt="${agent.name}">
          <div class="detail-info">
            <h1 class="detail-name">${agent.name}</h1>
            <div class="detail-developer">${agent.developer}</div>
            <a class="detail-get-btn" href="/aitopia/marketplace/test-all-agents.html#${agent.id}">
              ${agent.tier === 'Free' ? 'GET - FREE' : 'GET'}
            </a>
          </div>
        </div>

        <div class="info-bar">
          <div class="info-item">
            <div class="info-value">${agent.rating}</div>
            <div class="info-label">${agent.reviews} Ratings</div>
          </div>
          <div class="info-separator"></div>
          <div class="info-item">
            <div class="info-value">${agent.tier}</div>
            <div class="info-label">Tier</div>
          </div>
          <div class="info-separator"></div>
          <div class="info-item">
            <div class="info-value">${agent.size}</div>
            <div class="info-label">Processing</div>
          </div>
        </div>

        ${(screenshots || videos) ? `
          <div class="section-header">
            <h2 class="section-title">Preview</h2>
          </div>
          <div class="screenshot-gallery">
            ${videos}
            ${screenshots}
          </div>
        ` : ''}

        <div class="detail-section">
          <h3 class="detail-section-title">Description</h3>
          <p class="detail-description">${agent.description}</p>
        </div>

        <div class="detail-section">
          <h3 class="detail-section-title">What's New</h3>
          <div class="version-info">Version ${agent.version}</div>
          <p class="detail-description">Latest updates and improvements</p>
        </div>

        <div class="detail-section">
          <h3 class="detail-section-title">Features</h3>
          <ul class="feature-list">
            ${features}
          </ul>
        </div>

        <div class="detail-section">
          <h3 class="detail-section-title">Ratings & Reviews</h3>
          <div class="rating">
            <span style="font: var(--font-large-title);">${agent.rating}</span>
            <div>
              <div class="stars">${stars}</div>
              <div class="rating-count">${agent.reviews} Reviews</div>
            </div>
          </div>
        </div>
      `;

      document.getElementById('modalOverlay')?.classList.add('active');
      document.getElementById('agentModal')?.classList.add('active');
    }

    // Close Modal
    function closeModal() {
      document.getElementById('modalOverlay')?.classList.remove('active');
      document.getElementById('agentModal')?.classList.remove('active');
    }

    // Prevent default on all links
    document.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', (e) => {
        if (a.getAttribute('href') === '#') {
          e.preventDefault();
        }
      });
    });

    // Initialize
    populateTopAgents();