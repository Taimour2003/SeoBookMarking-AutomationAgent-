const BASE_URL = window.__AITOPIA_DOMAIN__ || 'https://aitopia.ai';

    // Capabilities (from AgentwithChatControls)
    const CAPABILITIES = {
      image_processing: { name: 'Image Processing', description: 'Process and transform images using AI models (Replicate)' },
      image_generation: { name: 'Image Generation', description: 'Generate images from text prompts using SDXL' },
      video_processing: { name: 'Video Processing', description: 'Process and generate videos using Stable Video Diffusion' },
      audio_processing: { name: 'Audio Processing', description: 'Generate music and speech using MusicGen/Bark' },
      text_generation: { name: 'Text Generation', description: 'Generate and analyze text using GPT-4' },
      web_search: { name: 'Web Search', description: 'Search the web for current information' },
      data_analysis: { name: 'Data Analysis', description: 'Analyze data and generate insights' },
      file_upload: { name: 'File Upload', description: 'Upload and process files' },
      task_progress: { name: 'Task Progress', description: 'Show progress tracking for multi-step tasks' },
    };

    // Agent definitions with form configurations
    const AGENTS = {
      // IMAGE PROCESSING
      'background-remover': {
        name: 'Background Remover',
        icon: '🖼️',
        category: 'image',
        description: 'Remove backgrounds from images instantly using rembg',
        capabilities: ['image_processing', 'file_upload'],
        inputs: [
          { name: 'image', label: 'Image', type: 'image', required: true, hint: 'Upload an image or paste a URL' }
        ]
      },
      'background-replacer': {
        name: 'Background Replacer',
        icon: '🌄',
        category: 'image',
        description: 'Replace backgrounds with AI-generated scenes',
        capabilities: ['image_processing', 'image_generation', 'file_upload'],
        inputs: [
          { name: 'image', label: 'Image', type: 'image', required: true },
          { name: 'newBackground', label: 'New Background Description', type: 'text', placeholder: 'e.g., tropical beach sunset, professional office' }
        ]
      },
      'image-upscaler': {
        name: 'Image Upscaler',
        icon: '🔍',
        category: 'image',
        description: 'Upscale images up to 4x with Real-ESRGAN',
        capabilities: ['image_processing', 'file_upload'],
        inputs: [
          { name: 'image', label: 'Image', type: 'image', required: true },
          { name: 'scale', label: 'Scale Factor', type: 'select', options: ['2', '4'], default: '4' },
          { name: 'faceEnhance', label: 'Face Enhancement', type: 'select', options: ['true', 'false'], default: 'true' }
        ]
      },
      'portrait-enhancer': {
        name: 'Portrait Enhancer',
        icon: '👤',
        category: 'image',
        description: 'Enhance and restore portrait photos with GFPGAN',
        capabilities: ['image_processing', 'file_upload'],
        inputs: [
          { name: 'image', label: 'Portrait Image', type: 'image', required: true, hint: 'Best results with face clearly visible' }
        ]
      },
      'face-swap': {
        name: 'Face Swap',
        icon: '🎭',
        category: 'image',
        description: 'Swap faces between two images seamlessly',
        capabilities: ['image_processing', 'file_upload'],
        inputs: [
          { name: 'sourceImage', label: 'Source Face', type: 'image', required: true, hint: 'The face to use' },
          { name: 'targetImage', label: 'Target Image', type: 'image', required: true, hint: 'The image to swap the face into' }
        ],
        twoColumn: true
      },
      'virtual-try-on': {
        name: 'Virtual Try-On',
        icon: '👔',
        category: 'ecommerce',
        description: 'Try on clothes virtually using IDM-VTON',
        capabilities: ['image_processing', 'file_upload', 'task_progress'],
        inputs: [
          { name: 'personImage', label: 'Person Image', type: 'image', required: true, hint: 'Full body photo of person' },
          { name: 'garmentImage', label: 'Garment Image', type: 'image', required: true, hint: 'Clothing item to try on' },
          { name: 'category', label: 'Clothing Type', type: 'select', options: ['upper_body', 'lower_body', 'dresses'], default: 'upper_body' }
        ],
        twoColumn: true
      },
      'style-transfer': {
        name: 'Style Transfer',
        icon: '🎨',
        category: 'creative',
        description: 'Apply artistic styles to images',
        capabilities: ['image_processing', 'image_generation', 'file_upload'],
        inputs: [
          { name: 'image', label: 'Image', type: 'image', required: true },
          { name: 'style', label: 'Style', type: 'text', placeholder: 'e.g., oil painting, watercolor, anime, Van Gogh' }
        ]
      },
      'sketch-to-image': {
        name: 'Sketch to Image',
        icon: '✏️',
        category: 'creative',
        description: 'Convert sketches to realistic images with ControlNet',
        capabilities: ['image_processing', 'image_generation', 'file_upload'],
        inputs: [
          { name: 'sketch', label: 'Sketch', type: 'image', required: true },
          { name: 'prompt', label: 'Description', type: 'textarea', placeholder: 'Describe what the sketch should become...' }
        ]
      },
      'object-remover': {
        name: 'Object Remover',
        icon: '🗑️',
        category: 'image',
        description: 'Remove unwanted objects from images using AI inpainting',
        capabilities: ['image_processing', 'file_upload'],
        inputs: [
          { name: 'image', label: 'Image', type: 'image', required: true },
          { name: 'mask', label: 'Mask Image', type: 'image', required: true, hint: 'White areas mark objects to remove' },
          { name: 'fillPrompt', label: 'Fill With (optional)', type: 'text', placeholder: 'e.g., clean background, grass, sky' }
        ],
        twoColumn: true
      },
      'image-generator': {
        name: 'Image Generator',
        icon: '🌟',
        category: 'creative',
        description: 'Generate images from text with SDXL',
        capabilities: ['image_generation', 'task_progress'],
        inputs: [
          { name: 'prompt', label: 'Prompt', type: 'textarea', required: true, placeholder: 'Describe the image you want to create...' },
          { name: 'negativePrompt', label: 'Negative Prompt', type: 'text', placeholder: 'What to avoid...' },
          { name: 'width', label: 'Width', type: 'select', options: ['512', '768', '1024'], default: '1024' },
          { name: 'height', label: 'Height', type: 'select', options: ['512', '768', '1024'], default: '1024' }
        ]
      },
      'scene-generator': {
        name: 'Scene Generator',
        icon: '🎬',
        category: 'creative',
        description: 'Generate cinematic scenes and environments',
        capabilities: ['image_generation', 'task_progress'],
        inputs: [
          { name: 'prompt', label: 'Scene Description', type: 'textarea', required: true, placeholder: 'Describe the scene or environment...' }
        ]
      },
      'product-photographer': {
        name: 'Product Photographer',
        icon: '📸',
        category: 'ecommerce',
        description: 'Create professional product photos',
        capabilities: ['image_processing', 'image_generation', 'file_upload'],
        inputs: [
          { name: 'image', label: 'Product Image (optional)', type: 'image', hint: 'Or describe your product below' },
          { name: 'product', label: 'Product Description', type: 'text', placeholder: 'e.g., sleek wireless headphones, silver laptop' }
        ]
      },
      'character-creator': {
        name: 'Character Creator',
        icon: '🧙',
        category: 'creative',
        description: 'Design unique character concepts',
        capabilities: ['image_generation', 'task_progress'],
        inputs: [
          { name: 'description', label: 'Character Description', type: 'textarea', required: true, placeholder: 'Describe the character in detail...' },
          { name: 'style', label: 'Art Style', type: 'text', placeholder: 'e.g., anime, realistic, cartoon, fantasy' }
        ]
      },
      'headshot-generator': {
        name: 'Headshot Generator',
        icon: '🧑‍💼',
        category: 'image',
        description: 'Generate professional headshots',
        capabilities: ['image_processing', 'file_upload'],
        inputs: [
          { name: 'image', label: 'Portrait Image', type: 'image', required: true }
        ]
      },
      'portrait-retoucher': {
        name: 'Portrait Retoucher',
        icon: '✨',
        category: 'image',
        description: 'Retouch and enhance portraits',
        capabilities: ['image_processing', 'file_upload'],
        inputs: [
          { name: 'image', label: 'Portrait Image', type: 'image', required: true }
        ]
      },
      'ai-model-swap': {
        name: 'AI Model Swap',
        icon: '👗',
        category: 'ecommerce',
        description: 'Swap models in fashion photos',
        capabilities: ['image_processing', 'file_upload'],
        inputs: [
          { name: 'sourceImage', label: 'Source Model', type: 'image', required: true },
          { name: 'targetImage', label: 'Target Photo', type: 'image', required: true }
        ],
        twoColumn: true
      },
      // VIDEO PROCESSING
      'video-generator': {
        name: 'Video Generator',
        icon: '🎥',
        category: 'video',
        description: 'Generate videos from images with Stable Video Diffusion',
        capabilities: ['video_processing', 'file_upload', 'task_progress'],
        inputs: [
          { name: 'image', label: 'Source Image', type: 'image', required: true },
          { name: 'motionAmount', label: 'Motion Amount', type: 'select', options: ['64', '127', '200'], default: '127' },
          { name: 'fps', label: 'FPS', type: 'select', options: ['6', '7', '8'], default: '7' }
        ]
      },
      'image-animator': {
        name: 'Image Animator',
        icon: '🎞️',
        category: 'video',
        description: 'Animate still images',
        capabilities: ['video_processing', 'file_upload', 'task_progress'],
        inputs: [
          { name: 'image', label: 'Image to Animate', type: 'image', required: true }
        ]
      },
      'lip-sync': {
        name: 'Lip Sync',
        icon: '🗣️',
        category: 'video',
        description: 'Sync lips to audio with Wav2Lip',
        capabilities: ['video_processing', 'audio_processing', 'file_upload', 'task_progress'],
        inputs: [
          { name: 'face', label: 'Face Image/Video', type: 'image', required: true },
          { name: 'audio', label: 'Audio URL', type: 'url', required: true, placeholder: 'https://example.com/audio.mp3' }
        ]
      },
      'talking-avatar': {
        name: 'Talking Avatar',
        icon: '👤',
        category: 'video',
        description: 'Create talking avatar videos',
        capabilities: ['video_processing', 'audio_processing', 'file_upload', 'task_progress'],
        inputs: [
          { name: 'face', label: 'Avatar Face', type: 'image', required: true },
          { name: 'audio', label: 'Speech Audio URL', type: 'url', required: true }
        ]
      },
      'face-swap-video': {
        name: 'Face Swap Video',
        icon: '🎬',
        category: 'video',
        description: 'Swap faces in videos',
        capabilities: ['video_processing', 'file_upload', 'task_progress'],
        inputs: [
          { name: 'sourceImage', label: 'Source Face', type: 'image', required: true },
          { name: 'targetImage', label: 'Target Video/Image', type: 'image', required: true }
        ],
        twoColumn: true
      },
      // AUDIO
      'music-generator': {
        name: 'Music Generator',
        icon: '🎵',
        category: 'audio',
        description: 'Generate music from text with MusicGen',
        capabilities: ['audio_processing', 'task_progress'],
        inputs: [
          { name: 'prompt', label: 'Music Description', type: 'textarea', required: true, placeholder: 'e.g., upbeat electronic dance music with heavy bass' },
          { name: 'duration', label: 'Duration (seconds)', type: 'select', options: ['5', '8', '10', '15', '20'], default: '8' }
        ]
      },
      'voice-cloner': {
        name: 'Voice Cloner',
        icon: '🎙️',
        category: 'audio',
        description: 'Convert text to speech with Bark',
        capabilities: ['audio_processing', 'text_generation'],
        inputs: [
          { name: 'text', label: 'Text to Speak', type: 'textarea', required: true, placeholder: 'Enter the text to convert to speech...' },
          { name: 'voicePreset', label: 'Voice', type: 'select', options: ['en_speaker_0', 'en_speaker_1', 'en_speaker_6', 'en_speaker_9', 'announcer'], default: 'en_speaker_6' }
        ]
      },
      // TEXT/ANALYTICS
      'smart-data-analyzer': {
        name: 'Data Analyzer',
        icon: '📊',
        category: 'analytics',
        description: 'Analyze data and provide insights',
        capabilities: ['data_analysis', 'text_generation'],
        inputs: [
          { name: 'data', label: 'Data', type: 'textarea', required: true, placeholder: 'Paste your data here (JSON, CSV, or plain text)...' }
        ]
      },
      'product-description-writer': {
        name: 'Product Writer',
        icon: '✍️',
        category: 'marketing',
        description: 'Write compelling product descriptions',
        capabilities: ['text_generation'],
        inputs: [
          { name: 'product', label: 'Product Name', type: 'text', required: true },
          { name: 'features', label: 'Features', type: 'textarea', placeholder: 'List key features...' },
          { name: 'audience', label: 'Target Audience', type: 'text', placeholder: 'Who is this for?' }
        ]
      },
      'email-template-generator': {
        name: 'Email Generator',
        icon: '📧',
        category: 'marketing',
        description: 'Create professional email templates',
        capabilities: ['text_generation'],
        inputs: [
          { name: 'purpose', label: 'Email Purpose', type: 'text', required: true, placeholder: 'e.g., product launch, newsletter, follow-up' },
          { name: 'tone', label: 'Tone', type: 'select', options: ['professional', 'friendly', 'urgent', 'casual'], default: 'professional' },
          { name: 'details', label: 'Key Details', type: 'textarea', placeholder: 'What should the email include?' }
        ]
      },
      'seo-content-optimizer': {
        name: 'SEO Optimizer',
        icon: '🔎',
        category: 'marketing',
        description: 'Optimize content for search engines',
        capabilities: ['text_generation', 'web_search'],
        inputs: [
          { name: 'content', label: 'Content', type: 'textarea', required: true, placeholder: 'Paste your content to optimize...' },
          { name: 'keywords', label: 'Target Keywords', type: 'text', placeholder: 'Comma-separated keywords' }
        ]
      },
      'social-media-caption-generator': {
        name: 'Caption Generator',
        icon: '💬',
        category: 'marketing',
        description: 'Generate social media captions',
        capabilities: ['text_generation'],
        inputs: [
          { name: 'topic', label: 'Topic/Product', type: 'text', required: true },
          { name: 'platform', label: 'Platform', type: 'select', options: ['instagram', 'twitter', 'linkedin', 'all'], default: 'all' },
          { name: 'tone', label: 'Tone', type: 'select', options: ['fun', 'professional', 'inspiring', 'casual'], default: 'fun' }
        ]
      },
      'video-script-generator': {
        name: 'Script Generator',
        icon: '🎬',
        category: 'content',
        description: 'Write engaging video scripts',
        capabilities: ['text_generation'],
        inputs: [
          { name: 'topic', label: 'Video Topic', type: 'text', required: true },
          { name: 'duration', label: 'Target Duration', type: 'select', options: ['30 seconds', '1 minute', '2 minutes', '5 minutes'], default: '1 minute' },
          { name: 'style', label: 'Style', type: 'select', options: ['tutorial', 'promotional', 'educational', 'entertainment'], default: 'tutorial' }
        ]
      },
      'customer-support-bot': {
        name: 'Support Bot',
        icon: '💁',
        category: 'productivity',
        description: 'Generate customer support responses',
        capabilities: ['text_generation'],
        inputs: [
          { name: 'query', label: 'Customer Query', type: 'textarea', required: true, placeholder: 'Enter the customer question or issue...' },
          { name: 'context', label: 'Context', type: 'textarea', placeholder: 'Any relevant background information...' }
        ]
      },
      'resume-builder': {
        name: 'Resume Builder',
        icon: '📄',
        category: 'productivity',
        description: 'Create professional resume content',
        capabilities: ['text_generation'],
        inputs: [
          { name: 'role', label: 'Target Role', type: 'text', required: true },
          { name: 'experience', label: 'Experience', type: 'textarea', placeholder: 'Describe your relevant experience...' },
          { name: 'skills', label: 'Skills', type: 'text', placeholder: 'Comma-separated skills' }
        ]
      },
      'data-visualization': {
        name: 'Data Viz Advisor',
        icon: '📈',
        category: 'analytics',
        description: 'Get data visualization suggestions',
        capabilities: ['data_analysis', 'text_generation'],
        inputs: [
          { name: 'data', label: 'Data Description', type: 'textarea', required: true, placeholder: 'Describe your data structure and what you want to show...' }
        ]
      },
      'ai-assistant': {
        name: 'AI Assistant',
        icon: '🤖',
        category: 'productivity',
        description: 'General purpose AI assistant',
        capabilities: ['text_generation', 'web_search', 'data_analysis', 'task_progress'],
        inputs: [
          { name: 'prompt', label: 'Your Request', type: 'textarea', required: true, placeholder: 'Ask me anything...' }
        ]
      }
    };

    // State
    let currentAgent = null;
    let settings = {};
    let uploadedFiles = {};
    let isProcessing = false;
    let activeCategory = 'all';

    // Initialize
    document.addEventListener('DOMContentLoaded', () => {
      renderCategories();
      renderAgentList();
      renderQuickActions();
    });

    function renderCategories() {
      const categories = ['all', ...new Set(Object.values(AGENTS).map(a => a.category))];
      const categoryTabsEl = document.getElementById('categoryTabs');
      if (categoryTabsEl) categoryTabsEl.innerHTML = categories.map(cat => `
        <button class="category-tab ${cat === 'all' ? 'active' : ''}" data-action="filterByCategory" data-param="${cat}">
          ${cat.charAt(0).toUpperCase() + cat.slice(1)}
        </button>
      `).join('');
    }

    function renderAgentList(filter = '') {
      const agents = Object.entries(AGENTS).filter(([id, agent]) => {
        const matchesSearch = agent.name.toLowerCase().includes(filter.toLowerCase()) ||
          agent.description.toLowerCase().includes(filter.toLowerCase());
        const matchesCategory = activeCategory === 'all' || agent.category === activeCategory;
        return matchesSearch && matchesCategory;
      });

      const agentListEl = document.getElementById('agentList');
      if (agentListEl) agentListEl.innerHTML = agents.map(([id, agent]) => `
        <div class="agent-item ${currentAgent === id ? 'active' : ''}" data-action="selectAgent" data-param="${id}">
          <div class="agent-icon">${agent.icon}</div>
          <div class="agent-item-info">
            <h3>${agent.name}</h3>
            <p>${agent.description}</p>
          </div>
        </div>
      `).join('');
    }

    function renderQuickActions() {
      const featured = ['image-generator', 'background-remover', 'face-swap', 'music-generator'];
      const quickActionsEl = document.getElementById('quickActions');
      if (quickActionsEl) quickActionsEl.innerHTML = featured.map(id => {
        const agent = AGENTS[id];
        return `
          <div class="quick-action" data-action="selectAgent" data-param="${id}">
            <div class="quick-action-icon">${agent.icon}</div>
            <h4>${agent.name}</h4>
            <p>${agent.description}</p>
          </div>
        `;
      }).join('');
    }

    function filterAgents() {
      renderAgentList(document.getElementById('agentSearch')?.value || '');
    }

    function filterByCategory(category) {
      activeCategory = category;
      document.querySelectorAll('.category-tab').forEach(tab => {
        tab.classList.toggle('active', tab.textContent.trim().toLowerCase() === category);
      });
      renderAgentList(document.getElementById('agentSearch')?.value || '');
    }

    function selectAgent(agentId) {
      currentAgent = agentId;
      const agent = AGENTS[agentId];
      uploadedFiles = {};

      // Initialize settings
      settings = {};
      agent.capabilities.forEach(cap => settings[cap] = true);

      // Update header
      const welcomeEl = document.getElementById('welcomeScreen');
      if (welcomeEl) welcomeEl.style.display = 'none';
      const contentHeaderEl = document.getElementById('contentHeader');
      if (contentHeaderEl) contentHeaderEl.style.display = 'flex';
      const formAreaEl = document.getElementById('formArea');
      if (formAreaEl) formAreaEl.style.display = 'block';
      const headerIconEl = document.getElementById('headerIcon');
      if (headerIconEl) headerIconEl.textContent = agent.icon;
      const headerTitleEl = document.getElementById('headerTitle');
      if (headerTitleEl) headerTitleEl.textContent = agent.name;
      const headerDescEl = document.getElementById('headerDescription');
      if (headerDescEl) headerDescEl.textContent = agent.description;

      // Render form
      renderAgentForm(agent);
      renderControls();
      renderAgentList(document.getElementById('agentSearch')?.value || '');
    }

    function renderAgentForm(agent) {
      const hasImageInputs = agent.inputs.filter(i => i.type === 'image').length > 1 && agent.twoColumn;

      let inputsHtml = agent.inputs.map(input => {
        if (input.type === 'image') {
          return `
            <div class="form-group">
              <label>${input.label}${input.required ? ' *' : ''}</label>
              <div class="upload-zone" id="upload-${input.name}"
                   ondrop="handleDrop(event, '${input.name}')"
                   ondragover="handleDragOver(event, '${input.name}')"
                   ondragleave="handleDragLeave(event, '${input.name}')">
                <div class="upload-icon">📁</div>
                <div class="upload-text">Drop image here or click to upload</div>
                <div class="upload-hint">Or paste an image URL below</div>
                <input type="file" accept="image/*" data-onchange="handleFileUpload" data-param="${input.name}">
              </div>
              <input type="url" id="url-${input.name}" placeholder="https://example.com/image.jpg" style="margin-top: 8px;">
              ${input.hint ? `<div class="hint">${input.hint}</div>` : ''}
            </div>
          `;
        } else if (input.type === 'select') {
          return `
            <div class="form-group">
              <label>${input.label}</label>
              <select id="input-${input.name}">
                ${input.options.map(opt => `<option value="${opt}" ${opt === input.default ? 'selected' : ''}>${opt}</option>`).join('')}
              </select>
            </div>
          `;
        } else if (input.type === 'textarea') {
          return `
            <div class="form-group">
              <label>${input.label}${input.required ? ' *' : ''}</label>
              <textarea id="input-${input.name}" placeholder="${input.placeholder || ''}"></textarea>
              ${input.hint ? `<div class="hint">${input.hint}</div>` : ''}
            </div>
          `;
        } else {
          return `
            <div class="form-group">
              <label>${input.label}${input.required ? ' *' : ''}</label>
              <input type="${input.type || 'text'}" id="input-${input.name}" placeholder="${input.placeholder || ''}">
              ${input.hint ? `<div class="hint">${input.hint}</div>` : ''}
            </div>
          `;
        }
      }).join('');

      // Wrap two-column uploads
      if (hasImageInputs) {
        const imageInputs = agent.inputs.filter(i => i.type === 'image');
        const otherInputs = agent.inputs.filter(i => i.type !== 'image');

        const imageHtml = imageInputs.map(input => `
          <div class="form-group">
            <label>${input.label}${input.required ? ' *' : ''}</label>
            <div class="upload-zone" id="upload-${input.name}"
                 ondrop="handleDrop(event, '${input.name}')"
                 ondragover="handleDragOver(event, '${input.name}')"
                 ondragleave="handleDragLeave(event, '${input.name}')">
              <div class="upload-icon">📁</div>
              <div class="upload-text">Drop image here</div>
              <input type="file" accept="image/*" data-onchange="handleFileUpload" data-param="${input.name}">
            </div>
            <input type="url" id="url-${input.name}" placeholder="Or paste URL" style="margin-top: 8px; font-size: 12px;">
            ${input.hint ? `<div class="hint">${input.hint}</div>` : ''}
          </div>
        `).join('');

        const otherHtml = otherInputs.map(input => {
          if (input.type === 'select') {
            return `
              <div class="form-group">
                <label>${input.label}</label>
                <select id="input-${input.name}">
                  ${input.options.map(opt => `<option value="${opt}" ${opt === input.default ? 'selected' : ''}>${opt}</option>`).join('')}
                </select>
              </div>
            `;
          } else if (input.type === 'textarea') {
            return `
              <div class="form-group">
                <label>${input.label}${input.required ? ' *' : ''}</label>
                <textarea id="input-${input.name}" placeholder="${input.placeholder || ''}"></textarea>
              </div>
            `;
          } else {
            return `
              <div class="form-group">
                <label>${input.label}${input.required ? ' *' : ''}</label>
                <input type="${input.type || 'text'}" id="input-${input.name}" placeholder="${input.placeholder || ''}">
              </div>
            `;
          }
        }).join('');

        inputsHtml = `<div class="two-col-uploads">${imageHtml}</div>${otherHtml}`;
      }

      // Capability badges
      const capBadges = agent.capabilities.map(cap => {
        const capInfo = CAPABILITIES[cap];
        return `<span class="cap-badge" id="badge-${cap}">${capInfo?.name || cap}</span>`;
      }).join('');

      const agentFormCardEl = document.getElementById('agentFormCard');
      if (agentFormCardEl) agentFormCardEl.innerHTML = `
        <div class="form-section">
          <div class="form-section-title">Inputs</div>
          ${inputsHtml}
        </div>
        <div class="form-section">
          <div class="form-section-title">Active Capabilities</div>
          <div class="capability-badges">${capBadges}</div>
        </div>
        <div class="run-section">
          <button class="run-btn" id="runBtn" data-action="runAgent">
            <span>▶</span> Run ${agent.name}
          </button>
        </div>
        <div class="result-section" id="resultSection">
          <div class="result-header">
            <div class="result-status" id="resultStatus">Processing...</div>
            <button class="download-btn" id="downloadBtn" style="display: none;" data-action="downloadResult">Download</button>
          </div>
          <div class="progress-bar"><div class="progress-fill" id="progressFill"></div></div>
          <div class="result-media" id="resultMedia"></div>
          <div class="result-json" id="resultJson"></div>
        </div>
      `;
    }

    function renderControls() {
      if (!currentAgent) return;
      const agent = AGENTS[currentAgent];

      const controlsListEl = document.getElementById('controlsList');
      if (controlsListEl) controlsListEl.innerHTML = agent.capabilities.map(capKey => {
        const cap = CAPABILITIES[capKey];
        if (!cap) return '';
        return `
          <div class="control-row">
            <div class="control-info">
              <h4>${cap.name}</h4>
              <p>${cap.description}</p>
            </div>
            <label class="toggle">
              <input type="checkbox" ${settings[capKey] ? 'checked' : ''} data-onchange="toggleCapability" data-param="${capKey}">
              <span class="toggle-slider"></span>
            </label>
          </div>
        `;
      }).join('');
    }

    function toggleCapability(key) {
      settings[key] = !settings[key];
      const badge = document.getElementById(`badge-${key}`);
      if (badge) badge.classList.toggle('disabled', !settings[key]);
    }

    function toggleControls() {
      document.getElementById('controlsDrawer')?.classList.toggle('open');
      document.getElementById('overlay')?.classList.toggle('visible');
    }

    // File handling
    function handleFileUpload(event, inputName) {
      const file = event.target.files[0];
      if (!file) return;
      processFile(file, inputName);
    }

    function handleDrop(event, inputName) {
      event.preventDefault();
      const zone = document.getElementById(`upload-${inputName}`);
      zone.classList.remove('dragover');
      const file = event.dataTransfer.files[0];
      if (file) processFile(file, inputName);
    }

    function handleDragOver(event, inputName) {
      event.preventDefault();
      document.getElementById(`upload-${inputName}`)?.classList.add('dragover');
    }

    function handleDragLeave(event, inputName) {
      document.getElementById(`upload-${inputName}`)?.classList.remove('dragover');
    }

    function processFile(file, inputName) {
      const zone = document.getElementById(`upload-${inputName}`);
      const reader = new FileReader();
      reader.onload = (e) => {
        uploadedFiles[inputName] = e.target.result;
        zone.innerHTML = `
          <img src="${e.target.result}" class="upload-preview" alt="Preview">
          <div class="upload-filename">${file.name}</div>
          <input type="file" accept="image/*" data-onchange="handleFileUpload" data-param="${inputName}">
        `;
        zone.classList.add('has-file');
      };
      reader.readAsDataURL(file);
    }

    // Run agent

    // checkAuthOrRedirect is provided by window.PendingPaid (pending-paid.js)
    function checkAuthOrRedirect() {
      return window.PendingPaid?.checkAuthOrRedirect() ?? Promise.resolve(true);
    }

    async function runAgent() {
      if (!(await checkAuthOrRedirect())) return;

      if (!currentAgent || isProcessing) return;
      const agent = AGENTS[currentAgent];
      const input = {};

      // Collect inputs
      for (const inp of agent.inputs) {
        if (inp.type === 'image') {
          // Check uploaded file first, then URL
          if (uploadedFiles[inp.name]) {
            input[inp.name] = uploadedFiles[inp.name];
          } else {
            const urlEl = document.getElementById(`url-${inp.name}`);
            if (urlEl && urlEl.value.trim()) {
              input[inp.name] = urlEl.value.trim();
            }
          }
        } else {
          const el = document.getElementById(`input-${inp.name}`);
          if (el && el.value.trim()) {
            input[inp.name] = el.value.trim();
          }
        }
      }

      // Show result section
      const resultSection = document.getElementById('resultSection');
      const resultStatus = document.getElementById('resultStatus');
      const progressFill = document.getElementById('progressFill');
      const resultMedia = document.getElementById('resultMedia');
      const resultJson = document.getElementById('resultJson');
      const downloadBtn = document.getElementById('downloadBtn');
      const runBtn = document.getElementById('runBtn');

      resultSection.classList.add('show');
      resultStatus.className = 'result-status processing';
      resultStatus.textContent = 'Processing...';
      progressFill.style.width = '20%';
      resultMedia.innerHTML = '';
      resultJson.textContent = '';
      downloadBtn.style.display = 'none';
      runBtn.disabled = true;
      runBtn.classList.add('loading');
      runBtn.innerHTML = '<span>⏳</span> Processing...';
      isProcessing = true;

      try {
        const response = await fetch(`${BASE_URL}/api/store/${currentAgent}/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input, settings })
        });

        const data = await response.json();

        if (data.jobId) {
          // Async job - poll for result
          await pollJob(data.jobId, progressFill, resultStatus);
        } else {
          // Sync result
          progressFill.style.width = '100%';
          displayResult(data, resultStatus, resultMedia, resultJson, downloadBtn);
        }
      } catch (error) {
        resultStatus.className = 'result-status failed';
        resultStatus.textContent = `Error: ${error.message}`;
      }

      isProcessing = false;
      runBtn.disabled = false;
      runBtn.classList.remove('loading');
      runBtn.innerHTML = `<span>▶</span> Run ${agent.name}`;
    }

    async function pollJob(jobId, progressFill, resultStatus) {
      return new Promise((resolve) => {
        const poll = async () => {
          const res = await fetch(`${BASE_URL}/jobs/${jobId}`);
          const job = await res.json();

          progressFill.style.width = `${job.progress || 50}%`;
          resultStatus.textContent = `${job.status} - ${job.progress || 0}%`;

          if (job.status === 'completed') {
            progressFill.style.width = '100%';
            displayResult({ output: job.output },
              document.getElementById('resultStatus'),
              document.getElementById('resultMedia'),
              document.getElementById('resultJson'),
              document.getElementById('downloadBtn'));
            resolve();
          } else if (job.status === 'failed') {
            resultStatus.className = 'result-status failed';
            resultStatus.textContent = `Failed: ${job.error}`;
            resolve();
          } else {
            setTimeout(poll, 2000);
          }
        };
        poll();
      });
    }

    function displayResult(data, statusEl, mediaEl, jsonEl, downloadBtn) {
      // Check for errors first
      if (data.error || data.status === 'failed') {
        statusEl.className = 'result-status failed';
        statusEl.textContent = 'Failed';
        mediaEl.innerHTML = `<div style="color: var(--error); padding: 16px; background: rgba(255,59,48,0.1); border-radius: 10px;">
          <strong>Error:</strong> ${data.error || 'Processing failed'}
        </div>`;
        jsonEl.textContent = JSON.stringify(data, null, 2);
        return;
      }

      statusEl.className = 'result-status completed';
      statusEl.textContent = 'Completed';

      const output = data.output || data;
      let mediaHtml = '';
      let downloadUrl = null;

      // Extract and display media
      const imageUrls = extractImageUrls(output);
      const videoUrl = extractVideoUrl(output);
      const audioUrl = extractAudioUrl(output);

      if (imageUrls.length > 0) {
        mediaHtml = `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
          ${imageUrls.map(url => `<img src="${url}" alt="Result" style="width: 100%; border-radius: 12px; cursor: pointer;" data-open-url="${url}">`).join('')}
        </div>`;
        downloadUrl = imageUrls[0];
      }

      if (videoUrl) {
        mediaHtml += `<video src="${videoUrl}" controls style="width: 100%; border-radius: 12px; margin-top: 12px;"></video>`;
        downloadUrl = downloadUrl || videoUrl;
      }

      if (audioUrl) {
        mediaHtml += `<audio src="${audioUrl}" controls style="width: 100%; margin-top: 12px;"></audio>`;
        downloadUrl = downloadUrl || audioUrl;
      }

      // Show text output for text-based agents
      if (!mediaHtml) {
        let textContent = '';
        // Check various text output fields
        if (output.response) textContent = output.response;
        else if (output.headline) textContent = `<strong>${output.headline}</strong><br><br>${output.description || ''}`;
        else if (output.caption) textContent = output.caption;
        else if (output.optimizedContent) textContent = output.optimizedContent;
        else if (output.professionalSummary) textContent = output.professionalSummary;
        else if (output.summary) textContent = output.summary;

        if (textContent) {
          mediaHtml = `<div style="padding: 16px; background: var(--bg-input); border-radius: 10px; white-space: pre-wrap;">${textContent}</div>`;
        }
      }

      if (downloadUrl) {
        downloadBtn.style.display = 'block';
        downloadBtn.onclick = () => window.open(downloadUrl, '_blank');
      }

      mediaEl.innerHTML = mediaHtml || '<div style="color: var(--text-secondary);">Processing complete. See details below.</div>';
      jsonEl.textContent = JSON.stringify(output, null, 2);
    }

    function extractImageUrls(obj) {
      const urls = [];
      // Check all possible image output fields
      if (Array.isArray(obj.images)) urls.push(...obj.images);
      if (Array.isArray(obj.output)) urls.push(...obj.output.filter(u => typeof u === 'string' && (u.startsWith('http') || u.startsWith('data:'))));
      // resultImage can be string or array (Virtual Try-On returns array)
      if (Array.isArray(obj.resultImage)) {
        urls.push(...obj.resultImage.filter(u => typeof u === 'string'));
      } else if (obj.resultImage) {
        urls.push(obj.resultImage);
      }
      if (obj.enhancedImage) urls.push(obj.enhancedImage);
      if (obj.upscaledImage) urls.push(obj.upscaledImage);
      if (obj.generatedImage) urls.push(obj.generatedImage);
      if (obj.stylizedImage) urls.push(obj.stylizedImage);
      if (obj.sceneImage) urls.push(obj.sceneImage);
      if (obj.productImage) urls.push(obj.productImage);
      if (Array.isArray(obj.characterImages)) urls.push(...obj.characterImages);
      if (obj.subjectWithTransparentBg) urls.push(obj.subjectWithTransparentBg);
      if (obj.productWithTransparentBg) urls.push(obj.productWithTransparentBg);
      if (obj.generatedBackground) urls.push(obj.generatedBackground);
      if (obj.imageUrl) urls.push(obj.imageUrl);
      // Support array-based outputs (mockups, thumbnails, creatives, packshots)
      if (Array.isArray(obj.mockups)) urls.push(...obj.mockups.map(m => m.imageUrl).filter(Boolean));
      if (Array.isArray(obj.thumbnails)) urls.push(...obj.thumbnails.map(t => t.url || t.imageUrl).filter(Boolean));
      if (Array.isArray(obj.creatives)) urls.push(...obj.creatives.map(c => c.imageUrl).filter(Boolean));
      if (Array.isArray(obj.packshots)) urls.push(...obj.packshots.map(p => p.imageUrl).filter(Boolean));
      if (Array.isArray(obj.variations)) urls.push(...obj.variations.map(v => v.imageUrl || v.url).filter(Boolean));
      if (Array.isArray(obj.results)) urls.push(...obj.results.map(r => r.imageUrl || r.url).filter(Boolean));
      // Single output field
      if (typeof obj.output === 'string' && (obj.output.startsWith('http') || obj.output.startsWith('data:'))) {
        if (!obj.output.includes('.mp4') && !obj.output.includes('.webm') && !obj.output.includes('.mp3') && !obj.output.includes('.wav')) {
          urls.push(obj.output);
        }
      }
      return urls.filter(u => u && typeof u === 'string');
    }

    function extractVideoUrl(obj) {
      return obj.video || obj.syncedVideo || obj.videoUrl ||
        (typeof obj.output === 'string' && (obj.output.includes('.mp4') || obj.output.includes('.webm')) ? obj.output : null);
    }

    function extractAudioUrl(obj) {
      return obj.audioUrl || obj.audio ||
        (typeof obj.output === 'string' && (obj.output.includes('.mp3') || obj.output.includes('.wav')) ? obj.output : null);
    }

    // CSP-safe event delegation
    document.addEventListener('click', function(e) {
      const el = e.target.closest('[data-action]');
      if (!el) return;
      if (el.dataset.action === 'toggleControls') toggleControls();
    });
    document.addEventListener('input', function(e) {
      const el = e.target.closest('[data-oninput]');
      if (!el) return;
      const fn = el.dataset.oninput;
      if (fn === 'filterAgents') filterAgents();
    });