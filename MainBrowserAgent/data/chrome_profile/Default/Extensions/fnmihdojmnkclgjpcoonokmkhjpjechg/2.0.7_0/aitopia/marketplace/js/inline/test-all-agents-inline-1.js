const BASE_URL = window.__AITOPIA_DOMAIN__ || 'https://aitopia.ai';
    let allAgents = [];
    let activeCategory = 'all';

    // Agent visual assets from Mule.run and Higgsfield
    const agentAssets = {
      'virtual-try-on': {
        preview: 'https://agent-assets-prod.muleusercontent.com/agents/agent-aitopia/assets/20251111/54e2dc15-d602-40aa-9b09-0983f7a4f8b3/虚拟试衣.png',
        demo: 'https://agent-assets-prod.muleusercontent.com/agents/agent-aitopia/assets/20251111/71b89f38-5a95-496a-bdbd-2e1c30bdb993/cover-1_(10).png',
        samples: {
          person: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=512',
          garment: 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=512'
        }
      },
      'face-swap': {
        preview: 'https://agent-assets-prod.muleusercontent.com/agents/agent-aitopia/assets/20251111/3b3049b7-bc21-46a8-b445-f2e339e3e65a/换脸.png',
        demo: 'https://agent-assets-prod.muleusercontent.com/agents/agent-aitopia/assets/20251111/a72088b2-0505-4924-bf9b-6c9e1c49db8b/cover-2_(3).png',
        samples: {
          source: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=512',
          target: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=512'
        }
      },
      'background-remover': {
        preview: 'https://assets-01.mulerun.com/agent/10aa0000-d27e-49f0-9ee9-0ad7d99f57b3/v1.0.3/showcase-1.webp',
        demo: 'https://assets-01.mulerun.com/agent/10aa0000-d27e-49f0-9ee9-0ad7d99f57b3/v1.0.3/showcase-2.webp',
        samples: {
          product: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=512',
          person: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=512'
        }
      },
      'image-upscaler': {
        preview: 'https://assets-01.mulerun.com/agent/c55ea644-5e6f-45ca-bcb7-30135f3e984c/v1.0.1/showcase-1.webp',
        demo: 'https://assets-01.mulerun.com/agent/c55ea644-5e6f-45ca-bcb7-30135f3e984c/v1.0.1/showcase-2.webp',
        samples: {
          lowres: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=256'
        }
      },
      'image-generator': {
        preview: 'https://assets-01.mulerun.com/agent/311be0d7-cd68-4fa7-99bc-232e535ebb39/v2025.09.02-07.37.32/showcase-1.png',
        demo: 'https://assets-01.mulerun.com/agent/311be0d7-cd68-4fa7-99bc-232e535ebb39/v2025.09.02-07.37.32/showcase-2.webp'
      },
      'chibi-sticker-maker': {
        preview: 'https://assets-01.mulerun.com/agent/82428895-e64f-4339-ba9f-1ac174b2bb4a/v1.0.1/showcase-1.png',
        demo: 'https://assets-01.mulerun.com/agent/82428895-e64f-4339-ba9f-1ac174b2bb4a/v1.0.1/showcase-2.webp',
        samples: {
          portrait: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=512'
        }
      },
      'headshot-generator': {
        preview: 'https://agent-assets-prod.muleusercontent.com/agents/agent-aitopia/assets/20251111/8e282302-b729-45c7-be39-7c48b3161a96/cover_(11).png',
        demo: 'https://agent-assets-prod.muleusercontent.com/agents/agent-aitopia/assets/20251111/c36c0f2f-c914-45a7-9b66-55db2c3e64fe/cover-1_(9).png',
        samples: {
          portrait: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=512'
        }
      },
      'portrait-enhancer': {
        preview: 'https://assets-01.mulerun.com/agent/c55ea644-5e6f-45ca-bcb7-30135f3e984c/v1.0.1/showcase-3.webp',
        demo: 'https://assets-01.mulerun.com/agent/c55ea644-5e6f-45ca-bcb7-30135f3e984c/v1.0.1/showcase-1.webp'
      },
      'ai-model-swap': {
        preview: 'https://agent-assets-prod.muleusercontent.com/agents/agent-aitopia/assets/20251111/09d4e979-5eb0-4e27-b865-c3856d6cccd0/模特换肤.png',
        demo: 'https://agent-assets-prod.muleusercontent.com/agents/agent-aitopia/assets/20251111/cbadc961-804c-4059-a140-fff3fddc70d7/cover_(12).png'
      },
      'product-description-writer': {
        preview: 'https://agent-assets-prod.muleusercontent.com/agents/agent-aitopia/assets/20251110/c3e5fd64-938e-4bd1-b389-71d113b3ed28/mulerun3.png',
        demo: 'https://agent-assets-prod.muleusercontent.com/agents/agent-aitopia/assets/20251110/b9d40528-104f-4146-a83b-9997afafb338/mulerun2.png'
      },
      'video-generator': {
        preview: 'https://agent-assets-prod.muleusercontent.com/agents/agent-aitopia/assets/20250919/e337c7b0-0780-4c1b-aaf0-34195ff2c802/Me_And_My_Mini-Me.webp',
        demo: 'https://agent-assets-prod.muleusercontent.com/agents/agent-aitopia/assets/20251111/129840a5-8f47-4006-b9ba-ca4b0615ca62/cover_(16).png'
      }
    };

    // Default preview for agents without custom assets
    const defaultPreviews = {
      'creative': 'https://assets-01.mulerun.com/agent/311be0d7-cd68-4fa7-99bc-232e535ebb39/v2025.09.02-07.37.32/showcase-1.png',
      'analytics': 'https://agent-assets-prod.muleusercontent.com/agents/agent-aitopia/assets/20251110/c3e5fd64-938e-4bd1-b389-71d113b3ed28/mulerun3.png',
      'content': 'https://agent-assets-prod.muleusercontent.com/agents/agent-aitopia/assets/20251110/b9d40528-104f-4146-a83b-9997afafb338/mulerun2.png',
      'marketing': 'https://agent-assets-prod.muleusercontent.com/agents/agent-aitopia/assets/20251110/c3e5fd64-938e-4bd1-b389-71d113b3ed28/mulerun3.png',
      'productivity': 'https://agent-assets-prod.muleusercontent.com/agents/agent-aitopia/assets/20251110/b9d40528-104f-4146-a83b-9997afafb338/mulerun2.png'
    };

    // Agent form configurations
    const agentForms = {
      'virtual-try-on': {
        inputs: [
          { name: 'personImage', label: 'Person Image', type: 'image', required: true },
          { name: 'garmentImage', label: 'Garment/Clothing Image', type: 'image', required: true },
          { name: 'category', label: 'Clothing Type', type: 'select', options: ['upper_body', 'lower_body', 'dresses'] }
        ],
        features: ['IDM-VTON', 'E-commerce', 'Fashion']
      },
      'face-swap': {
        inputs: [
          { name: 'sourceImage', label: 'Face Source (your face)', type: 'image', required: true },
          { name: 'targetImage', label: 'Target Image (body to swap onto)', type: 'image', required: true }
        ],
        features: ['Photorealistic', 'High Quality', 'Fast']
      },
      'background-remover': {
        inputs: [
          { name: 'image', label: 'Image to Process', type: 'image', required: true }
        ],
        features: ['rembg', 'Transparent PNG', 'E-commerce']
      },
      'background-replacer': {
        inputs: [
          { name: 'image', label: 'Original Image', type: 'image', required: true },
          { name: 'background', label: 'New Background Description', type: 'text', placeholder: 'Professional office with city skyline view' }
        ],
        features: ['AI Background', 'Scene Generation']
      },
      'image-upscaler': {
        inputs: [
          { name: 'image', label: 'Low Resolution Image', type: 'image', required: true },
          { name: 'scale', label: 'Upscale Factor', type: 'select', options: ['2', '4'] }
        ],
        features: ['Real-ESRGAN', 'Face Enhance', '4K Output']
      },
      'image-generator': {
        inputs: [
          { name: 'prompt', label: 'Image Description', type: 'textarea', placeholder: 'A beautiful sunset over mountains, digital art, vibrant colors, detailed' },
          { name: 'negativePrompt', label: 'Negative Prompt (avoid)', type: 'text', placeholder: 'blurry, low quality, distorted' },
          { name: 'width', label: 'Width', type: 'select', options: ['512', '768', '1024'] },
          { name: 'height', label: 'Height', type: 'select', options: ['512', '768', '1024'] }
        ],
        features: ['SDXL', 'High Resolution', 'Multiple Styles']
      },
      'portrait-enhancer': {
        inputs: [
          { name: 'image', label: 'Portrait Image', type: 'image', required: true }
        ],
        features: ['GFPGAN', 'Face Restoration', 'Photo Enhancement']
      },
      'headshot-generator': {
        inputs: [
          { name: 'image', label: 'Your Photo', type: 'image', required: true }
        ],
        features: ['Professional Headshots', 'AI Enhancement']
      },
      'style-transfer': {
        inputs: [
          { name: 'image', label: 'Original Image', type: 'image', required: true },
          { name: 'style', label: 'Art Style', type: 'select', options: ['oil painting', 'watercolor', 'van gogh', 'anime', 'pencil sketch', 'pop art', 'cyberpunk'] }
        ],
        features: ['Artistic Styles', 'AI Art', 'Multiple Effects']
      },
      'sketch-to-image': {
        inputs: [
          { name: 'sketch', label: 'Sketch/Drawing', type: 'image', required: true },
          { name: 'prompt', label: 'Description', type: 'text', placeholder: 'A detailed realistic mountain landscape' }
        ],
        features: ['ControlNet', 'Sketch2Image', 'AI Art']
      },
      'object-remover': {
        inputs: [
          { name: 'image', label: 'Original Image', type: 'image', required: true },
          { name: 'mask', label: 'Mask Image (white = remove)', type: 'image', required: true },
          { name: 'prompt', label: 'Fill Description', type: 'text', placeholder: 'Clean natural background' }
        ],
        features: ['Inpainting', 'Object Removal', 'AI Fill']
      },
      'chibi-sticker-maker': {
        inputs: [
          { name: 'image', label: 'Your Photo', type: 'image', required: true },
          { name: 'style', label: 'Sticker Style', type: 'select', options: ['cute chibi', 'kawaii', 'cartoon', 'anime'] }
        ],
        features: ['Cute Stickers', 'Character Design', 'Fun']
      },
      'product-photographer': {
        inputs: [
          { name: 'image', label: 'Product Image (optional)', type: 'image' },
          { name: 'product', label: 'Or Product Description', type: 'text', placeholder: 'Elegant gold wristwatch with leather strap' },
          { name: 'style', label: 'Photography Style', type: 'select', options: ['white background', 'lifestyle', 'studio', 'outdoor'] }
        ],
        features: ['Product Photos', 'E-commerce', 'Studio Quality']
      },
      'character-creator': {
        inputs: [
          { name: 'description', label: 'Character Description', type: 'textarea', placeholder: 'A brave female warrior with silver armor, red hair, holding a magical sword' },
          { name: 'style', label: 'Art Style', type: 'select', options: ['anime', 'realistic', 'cartoon', 'fantasy art', 'pixel art'] }
        ],
        features: ['Character Design', 'Concept Art', 'AI Art']
      },
      'scene-generator': {
        inputs: [
          { name: 'prompt', label: 'Scene Description', type: 'textarea', placeholder: 'A cozy coffee shop interior with warm lighting and wooden furniture' }
        ],
        features: ['Environment Art', 'Scene Generation', 'Backgrounds']
      },
      'video-generator': {
        inputs: [
          { name: 'image', label: 'Source Image', type: 'image', required: true },
          { name: 'motion', label: 'Motion Amount (0-255)', type: 'text', placeholder: '127' },
          { name: 'fps', label: 'FPS', type: 'select', options: ['7', '14', '24'] }
        ],
        features: ['Stable Video Diffusion', 'Image Animation', 'AI Video']
      },
      'lip-sync': {
        inputs: [
          { name: 'face', label: 'Face Image/Video', type: 'image', required: true },
          { name: 'audio', label: 'Audio URL', type: 'url', placeholder: 'https://example.com/speech.mp3' }
        ],
        features: ['Wav2Lip', 'Lip Sync', 'Talking Videos']
      },
      'music-generator': {
        inputs: [
          { name: 'prompt', label: 'Music Description', type: 'textarea', placeholder: 'Upbeat electronic music with synth melodies, energetic and happy mood' },
          { name: 'duration', label: 'Duration (seconds)', type: 'select', options: ['8', '15', '30'] }
        ],
        features: ['MusicGen', 'AI Music', 'Custom Audio']
      },
      'voice-cloner': {
        inputs: [
          { name: 'text', label: 'Text to Speak', type: 'textarea', placeholder: 'Hello! This is a test of the voice synthesis system.' },
          { name: 'voice', label: 'Voice Preset', type: 'select', options: ['v2/en_speaker_0', 'v2/en_speaker_1', 'v2/en_speaker_6', 'v2/en_speaker_9'] }
        ],
        features: ['Text-to-Speech', 'Voice Synthesis', 'Bark']
      },
      'product-description-writer': {
        inputs: [
          { name: 'product', label: 'Product Name', type: 'text', placeholder: 'Wireless Bluetooth Headphones Pro X' },
          { name: 'features', label: 'Key Features', type: 'textarea', placeholder: 'Active noise cancellation, 30h battery, comfortable memory foam, premium sound' },
          { name: 'tone', label: 'Writing Tone', type: 'select', options: ['professional', 'casual', 'luxury', 'technical'] }
        ],
        features: ['GPT-4', 'E-commerce', 'SEO']
      },
      'email-template-generator': {
        inputs: [
          { name: 'purpose', label: 'Email Purpose', type: 'text', placeholder: 'Product launch announcement' },
          { name: 'audience', label: 'Target Audience', type: 'text', placeholder: 'Existing customers' },
          { name: 'tone', label: 'Tone', type: 'select', options: ['professional', 'casual', 'urgent', 'friendly'] }
        ],
        features: ['GPT-4', 'Email Marketing', 'Templates']
      },
      'seo-content-optimizer': {
        inputs: [
          { name: 'content', label: 'Content to Optimize', type: 'textarea', placeholder: 'Paste your blog post or article here...' },
          { name: 'keywords', label: 'Target Keywords', type: 'text', placeholder: 'AI, machine learning, automation' }
        ],
        features: ['GPT-4', 'SEO', 'Content Optimization']
      },
      'social-media-caption-generator': {
        inputs: [
          { name: 'topic', label: 'Topic/Product', type: 'text', placeholder: 'New coffee blend launch' },
          { name: 'platform', label: 'Platform', type: 'select', options: ['all', 'instagram', 'twitter', 'linkedin', 'tiktok'] }
        ],
        features: ['GPT-4', 'Social Media', 'Hashtags']
      },
      'video-script-generator': {
        inputs: [
          { name: 'topic', label: 'Video Topic', type: 'text', placeholder: 'How to use our new app' },
          { name: 'duration', label: 'Target Duration', type: 'select', options: ['30 seconds', '1 minute', '3 minutes', '5 minutes'] },
          { name: 'style', label: 'Video Style', type: 'select', options: ['tutorial', 'promotional', 'educational', 'entertaining'] }
        ],
        features: ['GPT-4', 'YouTube', 'Scripts']
      },
      'customer-support-bot': {
        inputs: [
          { name: 'query', label: 'Customer Question', type: 'textarea', placeholder: 'I want to return my order but I lost the receipt. What should I do?' },
          { name: 'context', label: 'Business Context', type: 'text', placeholder: 'E-commerce clothing store' }
        ],
        features: ['GPT-4', 'Customer Service', 'AI Support']
      },
      'resume-builder': {
        inputs: [
          { name: 'experience', label: 'Experience Summary', type: 'textarea', placeholder: '5 years software engineer, Python, JavaScript, AWS, led team of 3' },
          { name: 'targetRole', label: 'Target Role', type: 'text', placeholder: 'Senior Software Developer' }
        ],
        features: ['GPT-4', 'Career', 'Resume']
      },
      'smart-data-analyzer': {
        inputs: [
          { name: 'data', label: 'Data to Analyze (JSON)', type: 'textarea', placeholder: '{"sales": [100, 200, 150, 300], "months": ["Jan", "Feb", "Mar", "Apr"]}' },
          { name: 'goal', label: 'Analysis Goal', type: 'text', placeholder: 'Find trends and insights' }
        ],
        features: ['GPT-4', 'Data Analysis', 'Insights']
      },
      'data-visualization': {
        inputs: [
          { name: 'data', label: 'Data (JSON)', type: 'textarea', placeholder: '{"labels": ["Q1", "Q2", "Q3"], "values": [100, 150, 200]}' },
          { name: 'goal', label: 'Visualization Goal', type: 'text', placeholder: 'Show quarterly growth trend' }
        ],
        features: ['GPT-4', 'Charts', 'Visualization']
      },
      'ai-assistant': {
        inputs: [
          { name: 'task', label: 'Your Request', type: 'textarea', placeholder: 'Help me plan a marketing strategy for a new product launch' }
        ],
        features: ['GPT-4', 'General AI', 'Versatile']
      }
    };

    // Initialize
    async function init() {
      await checkServer();
      await loadAgents();
      renderCategoryNav();
      renderAgents();
    }

    async function checkServer() {
      try {
        const res = await fetch(`${BASE_URL}/health`);
        const data = await res.json();
        document.getElementById('serverDot')?.classList.add('connected');
        const serverStatusEl = document.getElementById('serverStatus');
        if (serverStatusEl) serverStatusEl.textContent = data.status === 'healthy' ? 'Connected' : data.status;
      } catch (e) {
        const serverStatusEl = document.getElementById('serverStatus');
        if (serverStatusEl) serverStatusEl.textContent = 'Offline';
      }
    }

    async function loadAgents() {
      try {
        const res = await fetch(`${BASE_URL}/api/store`);
        const data = await res.json();
        allAgents = data.agents;
        const agentCountEl = document.getElementById('agentCount');
        if (agentCountEl) agentCountEl.textContent = `${data.total} Agents`;
      } catch (e) {
        console.error('Failed to load agents:', e);
      }
    }

    function renderCategoryNav() {
      const categories = ['all', ...new Set(allAgents.map(a => a.category))];
      const html = categories.map(cat =>
        `<button class="cat-btn ${cat === activeCategory ? 'active' : ''}" data-action="setCategory" data-param="${cat}">${cat.charAt(0).toUpperCase() + cat.slice(1)}</button>`
      ).join('');
      const categoryNavEl = document.getElementById('categoryNav');
      if (categoryNavEl) categoryNavEl.innerHTML = html;
    }

    function setCategory(cat) {
      activeCategory = cat;
      renderCategoryNav();
      renderAgents();
    }

    function renderAgents() {
      const filtered = activeCategory === 'all' ? allAgents : allAgents.filter(a => a.category === activeCategory);
      const html = filtered.map(agent => renderAgentCard(agent)).join('');
      const agentsGridEl = document.getElementById('agentsGrid');
      if (agentsGridEl) agentsGridEl.innerHTML = html;
    }

    function renderAgentCard(agent) {
      const assets = agentAssets[agent.id] || {};
      const form = agentForms[agent.id] || { inputs: [{ name: 'prompt', label: 'Input', type: 'textarea', placeholder: 'Enter your input...' }], features: [] };
      const previewImg = assets.preview || defaultPreviews[agent.category] || defaultPreviews['creative'];

      const inputsHtml = form.inputs.map(input => {
        if (input.type === 'image') {
          return `
            <div class="form-section">
              <label>${input.label}${input.required ? ' *' : ''}</label>
              <div class="upload-zone" id="upload-${agent.id}-${input.name}" data-click-target="file-${agent.id}-${input.name}">
                <input type="file" id="file-${agent.id}-${input.name}" accept="image/*" data-onchange="handleFileUpload" data-param="${agent.id}" data-param2="${input.name}">
                <div class="upload-icon">📷</div>
                <div class="upload-text">Click to upload or drag image here</div>
              </div>
              <div class="url-input-group" style="margin-top: 8px;">
                <input type="url" id="${agent.id}-${input.name}" placeholder="Or paste image URL">
              </div>
              <div class="sample-btns">
                <button class="sample-btn" data-action="setSample" data-param="${agent.id}" data-param2="${input.name}" data-param3="person">Person</button>
                <button class="sample-btn" data-action="setSample" data-param="${agent.id}" data-param2="${input.name}" data-param3="portrait">Portrait</button>
                <button class="sample-btn" data-action="setSample" data-param="${agent.id}" data-param2="${input.name}" data-param3="product">Product</button>
                <button class="sample-btn" data-action="setSample" data-param="${agent.id}" data-param2="${input.name}" data-param3="landscape">Landscape</button>
              </div>
            </div>
          `;
        } else if (input.type === 'select') {
          const opts = input.options.map(o => `<option value="${o}">${o}</option>`).join('');
          return `
            <div class="form-section">
              <label>${input.label}</label>
              <select id="${agent.id}-${input.name}">${opts}</select>
            </div>
          `;
        } else if (input.type === 'textarea') {
          return `
            <div class="form-section">
              <label>${input.label}</label>
              <textarea id="${agent.id}-${input.name}" placeholder="${input.placeholder || ''}"></textarea>
            </div>
          `;
        } else {
          return `
            <div class="form-section">
              <label>${input.label}</label>
              <input type="${input.type || 'text'}" id="${agent.id}-${input.name}" placeholder="${input.placeholder || ''}">
            </div>
          `;
        }
      }).join('');

      const tagsHtml = form.features.length > 0 ? `
        <div class="agent-tags">
          ${form.features.map(f => `<span class="agent-tag">${f}</span>`).join('')}
        </div>
      ` : '';

      return `
        <div class="agent-card" id="card-${agent.id}">
          <div class="agent-preview">
            <img src="${previewImg}" alt="${agent.name}" loading="lazy">
            <div class="preview-overlay">
              <div class="agent-badge">${agent.category}</div>
            </div>
          </div>
          <div class="agent-info">
            <h3>${agent.name}</h3>
            <p>${agent.description}</p>
            ${tagsHtml}
          </div>
          <div class="agent-form">
            ${inputsHtml}
            <button class="run-btn" id="btn-${agent.id}" data-action="runAgent" data-param="${agent.id}">
              <span>▶</span> Run ${agent.name}
            </button>
            <div class="result-section" id="result-${agent.id}">
              <div class="result-header">
                <div class="result-status" id="status-${agent.id}">Processing...</div>
                <button class="download-btn" id="download-${agent.id}" style="display: none;" data-action="downloadResult" data-param="${agent.id}">Download</button>
              </div>
              <div class="progress-bar"><div class="progress-fill" id="progress-${agent.id}"></div></div>
              <div class="result-media" id="media-${agent.id}"></div>
              <div class="result-json" id="json-${agent.id}"></div>
            </div>
          </div>
        </div>
      `;
    }

    // Sample images
    const sampleImages = {
      person: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=512',
      portrait: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=512',
      product: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=512',
      landscape: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=512',
      garment: 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=512'
    };

    function setSample(agentId, inputName, type) {
      const input = document.getElementById(`${agentId}-${inputName}`);
      if (input) {
        input.value = sampleImages[type] || sampleImages.person;
      }
    }

    function handleFileUpload(agentId, inputName, fileInput) {
      const file = fileInput.files[0];
      if (!file) return;

      const uploadZone = document.getElementById(`upload-${agentId}-${inputName}`);
      const urlInput = document.getElementById(`${agentId}-${inputName}`);

      // Create preview
      const reader = new FileReader();
      reader.onload = function(e) {
        uploadZone.innerHTML = `
          <img src="${e.target.result}" class="upload-preview" alt="Preview">
          <div class="upload-text" style="margin-top: 8px;">${file.name}</div>
          <input type="file" id="file-${agentId}-${inputName}" accept="image/*" data-onchange="handleFileUpload" data-param="${agentId}" data-param2="${inputName}">
        `;
        uploadZone.classList.add('has-file');

        // Store base64 in data attribute for later use
        uploadZone.dataset.base64 = e.target.result;

        // For now, we need to use a public URL, so prompt user to use URL instead
        // In production, you'd upload to a server and get back a URL
      };
      reader.readAsDataURL(file);
    }

    function normalizeInputForAgent(agentId, input) {
      if (!input || typeof input !== 'object') return input;

      if (agentId === 'style-transfer') {
        const presetMap = {
          'oil painting': 'oil_painting',
          watercolor: 'watercolor',
          'van gogh': 'van_gogh',
          anime: 'anime',
          'pencil sketch': 'pencil_sketch',
          'pop art': 'pop_art',
          cyberpunk: 'neon',
        };

        if (input.image && !input.contentImageUrl) input.contentImageUrl = input.image;
        if (input.style && !input.presetStyle) {
          const raw = String(input.style);
          input.presetStyle = presetMap[raw] || raw;
        }

        delete input.image;
        delete input.style;
      }

      if (agentId === 'resume-builder') {
        if (typeof input.experience === 'string' && input.experience.trim() && !input.summary) {
          input.summary = input.experience.trim();
        }

        if (typeof input.targetRole === 'string' && input.targetRole.trim() && !input.targetJob) {
          input.targetJob = { title: input.targetRole.trim() };
        }

        delete input.experience;
        delete input.targetRole;
      }

      return input;
    }

    async function runAgent(agentId) {
      const form = agentForms[agentId] || { inputs: [{ name: 'prompt' }] };
      const input = {};

      form.inputs.forEach(inp => {
        const el = document.getElementById(`${agentId}-${inp.name}`);
        if (el) {
          let value = el.value.trim();
          // Try parsing JSON for data fields
          if ((inp.name === 'data') && value) {
            try { value = JSON.parse(value); } catch(e) {}
          }
          if (value) input[inp.name] = value;
        }

        // Check for uploaded file base64
        const uploadZone = document.getElementById(`upload-${agentId}-${inp.name}`);
        if (uploadZone && uploadZone.dataset.base64 && !input[inp.name]) {
          input[inp.name] = uploadZone.dataset.base64;
        }
      });

      normalizeInputForAgent(agentId, input);

      const btn = document.getElementById(`btn-${agentId}`);
      const resultSection = document.getElementById(`result-${agentId}`);
      const statusEl = document.getElementById(`status-${agentId}`);
      const progressEl = document.getElementById(`progress-${agentId}`);
      const mediaEl = document.getElementById(`media-${agentId}`);
      const jsonEl = document.getElementById(`json-${agentId}`);
      const downloadBtn = document.getElementById(`download-${agentId}`);

      const startedAt = Date.now();
      const ensureMinimumLoading = async (minMs = 350) => {
        const elapsed = Date.now() - startedAt;
        const remaining = minMs - elapsed;
        if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
      };

      btn.disabled = true;
      btn.classList.add('loading');
      btn.innerHTML = '<span>⏳</span> Processing...';
      resultSection.classList.add('show');
      statusEl.className = 'result-status processing';
      statusEl.textContent = 'Processing...';
      progressEl.style.width = '20%';
      mediaEl.innerHTML = '';
      jsonEl.textContent = '';
      downloadBtn.style.display = 'none';

      try {
        const res = await fetch(`${BASE_URL}/api/store/${agentId}/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input })
        });

        let data = null;
        try {
          data = await res.json();
        } catch (e) {
          data = null;
        }

        if (!res.ok || (data && typeof data === 'object' && data.error)) {
          await ensureMinimumLoading();
          const retryAfter = (data && typeof data === 'object' && data.retryAfter) ? data.retryAfter : null;
          statusEl.className = 'result-status failed';
          statusEl.textContent =
            res.status === 429 && retryAfter
              ? `Failed: Rate limit exceeded (retry after ${retryAfter}s)`
              : `Failed: ${(data && typeof data === 'object' && data.error) ? data.error : (res.statusText || `HTTP ${res.status}`)}`;
          progressEl.style.width = '100%';
          jsonEl.textContent = JSON.stringify(data ?? { status: res.status, statusText: res.statusText }, null, 2);
          btn.disabled = false;
          btn.classList.remove('loading');
          btn.innerHTML = `<span>▶</span> Try Again`;
          return;
        }

        const responseStatus = (data && typeof data === 'object') ? data.status : undefined;
        const shouldPoll =
          res.status === 202 ||
          responseStatus === 'pending' ||
          responseStatus === 'processing';

        await ensureMinimumLoading();
        if (shouldPoll && data && typeof data === 'object' && data.jobId) {
          pollJob(agentId, data.jobId, 0);
        } else {
          displayResult(agentId, data);
        }
      } catch (e) {
        await ensureMinimumLoading();
        statusEl.className = 'result-status failed';
        statusEl.textContent = `Error: ${e.message}`;
        btn.disabled = false;
        btn.classList.remove('loading');
        btn.innerHTML = `<span>▶</span> Run Again`;
      }
    }

    async function pollJob(agentId, jobId, attempt = 0) {
      const statusEl = document.getElementById(`status-${agentId}`);
      const progressEl = document.getElementById(`progress-${agentId}`);
      const btn = document.getElementById(`btn-${agentId}`);

      try {
        const res = await fetch(`${BASE_URL}/jobs/${jobId}`);
        if (!res.ok) {
          const detail = await res.text().catch(() => '');
          throw new Error(`Job status HTTP ${res.status}${detail ? `: ${detail}` : ''}`);
        }
        const job = await res.json();

        progressEl.style.width = `${job.progress || 30}%`;
        statusEl.textContent = `${job.status} - ${job.progress || 0}%`;

        if (job.status === 'completed') {
          displayResult(agentId, job);
        } else if (job.status === 'failed') {
          statusEl.className = 'result-status failed';
          statusEl.textContent = `Failed: ${job.error?.message || 'Unknown error'}`;
          const jsonEl = document.getElementById(`json-${agentId}`);
          if (jsonEl) jsonEl.textContent = JSON.stringify(job, null, 2);
          btn.disabled = false;
          btn.classList.remove('loading');
          btn.innerHTML = `<span>▶</span> Try Again`;
        } else {
          setTimeout(() => pollJob(agentId, jobId, attempt + 1), 2000);
        }
      } catch (e) {
        if (attempt >= 10) {
          statusEl.className = 'result-status failed';
          statusEl.textContent = `Failed: ${e.message || 'Job polling error'}`;
          btn.disabled = false;
          btn.classList.remove('loading');
          btn.innerHTML = `<span>▶</span> Try Again`;
          return;
        }
        setTimeout(() => pollJob(agentId, jobId, attempt + 1), 3000);
      }
    }

    function displayResult(agentId, data) {
      const output = data.output || data;
      const statusEl = document.getElementById(`status-${agentId}`);
      const progressEl = document.getElementById(`progress-${agentId}`);
      const mediaEl = document.getElementById(`media-${agentId}`);
      const jsonEl = document.getElementById(`json-${agentId}`);
      const btn = document.getElementById(`btn-${agentId}`);
      const downloadBtn = document.getElementById(`download-${agentId}`);

      const topLevelError = (data && typeof data === 'object' && data.error) ? data.error : null;
      const outputError = (output && typeof output === 'object' && output.error) ? output.error : null;
      const errorMessage = topLevelError || (typeof outputError === 'string' ? outputError : (outputError && outputError.message) ? outputError.message : null);

      if (errorMessage) {
        statusEl.className = 'result-status failed';
        statusEl.textContent = `Failed: ${errorMessage}`;
        progressEl.style.width = '100%';
        jsonEl.textContent = JSON.stringify(data, null, 2);
        btn.disabled = false;
        btn.classList.remove('loading');
        btn.innerHTML = `<span>▶</span> Try Again`;
        downloadBtn.style.display = 'none';
        return;
      }

      statusEl.className = 'result-status completed';
      statusEl.textContent = `Completed${output.processingTime ? ` in ${(output.processingTime/1000).toFixed(1)}s` : ''}`;
      progressEl.style.width = '100%';

      // Extract media URLs - check ALL possible output fields
      const imageUrls = [];

      // Array fields
      if (Array.isArray(output.images)) imageUrls.push(...output.images);
      if (Array.isArray(output.characterImages)) imageUrls.push(...output.characterImages);
      if (Array.isArray(output.output)) {
        output.output.forEach(item => {
          if (typeof item === 'string' && (item.startsWith('http') || item.startsWith('data:image'))) {
            imageUrls.push(item);
          }
        });
      }
      // Support array-based outputs (mockups, thumbnails, creatives, packshots)
      if (Array.isArray(output.mockups)) imageUrls.push(...output.mockups.map(m => m.imageUrl).filter(Boolean));
      if (Array.isArray(output.thumbnails)) imageUrls.push(...output.thumbnails.map(t => t.url || t.imageUrl).filter(Boolean));
      if (Array.isArray(output.creatives)) imageUrls.push(...output.creatives.map(c => c.imageUrl).filter(Boolean));
      if (Array.isArray(output.packshots)) imageUrls.push(...output.packshots.map(p => p.imageUrl).filter(Boolean));
      if (Array.isArray(output.variations)) imageUrls.push(...output.variations.map(v => v.imageUrl || v.url).filter(Boolean));
      if (Array.isArray(output.results)) imageUrls.push(...output.results.map(r => r.imageUrl || r.url).filter(Boolean));

      // Common image field names (used by various agents)
      const imageFields = [
        'resultImage', 'upscaledImage', 'enhancedImage', 'stylizedImage',
        'generatedImage', 'sceneImage', 'productImage', 'subjectWithTransparentBg',
        'generatedBackground', 'productWithTransparentBg', 'image', 'imageUrl',
        // Virtual Try-On specific fields
        'personImage', 'tryOnImage', 'result', 'output_image',
        // Face swap fields
        'swappedImage', 'faceSwapResult',
        // Background remover fields
        'transparentImage', 'removedBgImage',
        // Portrait/headshot fields
        'headshotImage', 'portraitImage', 'enhancedPortrait',
        // Sketch to image
        'sketchResult', 'generatedFromSketch',
        // General output
        'url', 'image_url', 'imageURL'
      ];

      imageFields.forEach(field => {
        if (output[field]) imageUrls.push(output[field]);
      });

      // Also check nested result object
      if (output.result && typeof output.result === 'object') {
        imageFields.forEach(field => {
          if (output.result[field]) imageUrls.push(output.result[field]);
        });
      }

      // Filter valid images - support HTTP URLs, base64 data URLs, and same-origin relative paths.
      const validImages = imageUrls.filter(u => u && typeof u === 'string' && (
        u.startsWith('http') ||
        u.startsWith('data:image') ||
        u.startsWith('/') ||
        u.startsWith('./')
      ));

      if (validImages.length > 0) {
        mediaEl.innerHTML = validImages.map(url => {
          // For base64 images, can't open in new tab easily, so just show inline
          if (url.startsWith('data:image')) {
            return `<img src="${url}" alt="Result" style="cursor: pointer; max-width: 100%; border-radius: 12px;">`;
          }
          return `<img src="${url}" alt="Result" data-open-url="${url}" style="cursor: pointer;">`;
        }).join('');
        downloadBtn.style.display = 'block';
        // For download, prefer HTTP URL if available
        const httpImage = validImages.find(u => u.startsWith('http'));
        downloadBtn.dataset.url = httpImage || validImages[0];
      } else if (output.video || output.videoUrl || output.syncedVideo) {
        const videoUrl = output.video || output.videoUrl || output.syncedVideo;
        mediaEl.innerHTML = `<video src="${videoUrl}" controls></video>`;
        downloadBtn.style.display = 'block';
        downloadBtn.dataset.url = videoUrl;
      } else if (output.audioUrl || output.audio) {
        const audioUrl = output.audioUrl || output.audio;
        mediaEl.innerHTML = `<audio src="${audioUrl}" controls></audio>`;
        downloadBtn.style.display = 'block';
        downloadBtn.dataset.url = audioUrl;
      }

      jsonEl.textContent = JSON.stringify(data, null, 2);
      btn.disabled = false;
      btn.classList.remove('loading');
      btn.innerHTML = `<span>▶</span> Run Again`;
    }

    function downloadResult(agentId) {
      const btn = document.getElementById(`download-${agentId}`);
      const url = btn.dataset.url;
      if (url) {
        window.open(url, '_blank');
      }
    }

    // Start
    init();