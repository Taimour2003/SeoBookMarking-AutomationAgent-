const API_BASE = '';

    // All 20 creative AI agents with their full configurations
    const agents = [
      {
        id: '01-image-generator',
        number: '01',
        name: 'Image Generator',
        description: 'Multi-provider image generation (DALL-E, Stability AI, Flux)',
        category: 'image',
        features: ['DALL-E 3', 'SDXL', 'Flux', 'Multiple Styles', 'Batch Generation'],
        async: true,
        tools: ['generate_dalle', 'generate_stability', 'generate_flux', 'wait_for_job'],
        testInput: {
          prompt: 'A futuristic city at sunset with flying cars',
          provider: 'stability',
          width: 1024,
          height: 1024,
          style: 'photographic'
        }
      },
      {
        id: '02-video-generator',
        number: '02',
        name: 'Video Generator',
        description: 'AI video generation using Runway Gen-3',
        category: 'video',
        features: ['Text-to-Video', 'Image-to-Video', 'Gen-3 Alpha', 'Multiple Durations'],
        async: true,
        tools: ['text_to_video', 'image_to_video', 'check_status', 'poll_until_complete'],
        testInput: {
          prompt: 'A drone flying over mountain peaks',
          model: 'gen3',
          duration: '4',
          aspectRatio: '16:9'
        }
      },
      {
        id: '03-face-swap-video',
        number: '03',
        name: 'Face Swap Video',
        description: 'Video face swapping with consent validation',
        category: 'biometric',
        features: ['Consent Required', 'Face Detection', 'Video Processing', 'Watermarking'],
        requiresConsent: true,
        async: true,
        tools: ['validate_consent', 'detect_faces', 'swap_face_video', 'apply_watermark'],
        testInput: {
          sourceVideoUrl: 'https://example.com/source.mp4',
          targetFaceUrl: 'https://example.com/face.jpg',
          consent: {
            subjectId: 'test-subject',
            subjectName: 'Test User',
            consentToken: 'test-token',
            purpose: 'Testing'
          }
        }
      },
      {
        id: '04-lip-sync',
        number: '04',
        name: 'Lip Sync',
        description: 'AI-powered lip synchronization for videos',
        category: 'video',
        features: ['Audio Sync', 'Multiple Models', 'Quality Control', 'Emotion Transfer'],
        async: true,
        tools: ['sync_lips', 'analyze_audio', 'enhance_sync', 'wait_for_job'],
        testInput: {
          videoUrl: 'https://example.com/video.mp4',
          audioUrl: 'https://example.com/audio.mp3',
          model: 'wav2lip'
        }
      },
      {
        id: '05-talking-avatar',
        number: '05',
        name: 'Talking Avatar',
        description: 'Generate talking head videos from images',
        category: 'video',
        features: ['Image to Video', 'Text-to-Speech', 'Expression Control', 'Multiple Styles'],
        async: true,
        tools: ['create_avatar', 'generate_speech', 'animate_avatar', 'combine_av'],
        testInput: {
          imageUrl: 'https://example.com/portrait.jpg',
          text: 'Hello! Welcome to our platform.',
          voice: 'professional',
          emotion: 'happy'
        }
      },
      {
        id: '06-headshot-generator',
        number: '06',
        name: 'Headshot Generator',
        description: 'Professional AI headshots from photos',
        category: 'image',
        features: ['Professional Styles', 'Background Removal', 'Lighting Enhancement', 'Multiple Outputs'],
        async: true,
        tools: ['generate_headshot', 'enhance_photo', 'change_background', 'batch_generate'],
        testInput: {
          photoUrl: 'https://example.com/selfie.jpg',
          style: 'corporate',
          background: 'office',
          outputCount: 4
        }
      },
      {
        id: '07-character-creator',
        number: '07',
        name: 'Character Creator',
        description: 'Consistent AI character generation',
        category: 'image',
        features: ['Character Consistency', 'Multiple Poses', 'Style Transfer', 'Persistence'],
        tools: ['createCharacter', 'generatePose', 'transferStyle', 'getCharacter'],
        testInput: {
          name: 'Hero Character',
          description: 'A brave warrior with golden armor',
          style: 'fantasy',
          baseImage: 'https://example.com/reference.jpg'
        }
      },
      {
        id: '08-image-upscaler',
        number: '08',
        name: 'Image Upscaler',
        description: 'AI image upscaling and enhancement',
        category: 'image',
        features: ['4x Upscale', 'Noise Reduction', 'Face Enhancement', 'Detail Restoration'],
        tools: ['upscale_image', 'enhance_faces', 'reduce_noise', 'sharpen'],
        testInput: {
          imageUrl: 'https://example.com/low-res.jpg',
          scale: 4,
          enhanceFaces: true,
          model: 'real-esrgan'
        }
      },
      {
        id: '09-object-remover',
        number: '09',
        name: 'Object Remover',
        description: 'Remove unwanted objects from images',
        category: 'image',
        features: ['Smart Inpainting', 'Mask Detection', 'Background Fill', 'Batch Processing'],
        tools: ['detect_objects', 'create_mask', 'remove_object', 'fill_background'],
        testInput: {
          imageUrl: 'https://example.com/photo.jpg',
          objectDescription: 'person in red shirt',
          fillMethod: 'inpaint'
        }
      },
      {
        id: '10-style-transfer',
        number: '10',
        name: 'Style Transfer',
        description: 'Apply artistic styles to images',
        category: 'image',
        features: ['Art Styles', 'Custom Styles', 'Intensity Control', 'Preset Library'],
        tools: ['apply_style', 'create_style', 'blend_styles', 'list_presets'],
        testInput: {
          imageUrl: 'https://example.com/photo.jpg',
          style: 'van_gogh',
          intensity: 0.8
        }
      },
      {
        id: '11-background-replacer',
        number: '11',
        name: 'Background Replacer',
        description: 'Replace and generate image backgrounds',
        category: 'image',
        features: ['AI Background', 'Custom Backgrounds', 'Edge Refinement', 'Lighting Match'],
        tools: ['remove_background', 'replace_background', 'generate_background', 'match_lighting'],
        testInput: {
          imageUrl: 'https://example.com/portrait.jpg',
          newBackground: 'modern office with city view',
          matchLighting: true
        }
      },
      {
        id: '12-image-animator',
        number: '12',
        name: 'Image Animator',
        description: 'Animate still images with AI',
        category: 'video',
        features: ['Motion Synthesis', 'Loop Creation', 'Depth Estimation', 'Parallax Effect'],
        async: true,
        tools: ['animate_image', 'create_loop', 'add_parallax', 'estimate_depth'],
        testInput: {
          imageUrl: 'https://example.com/landscape.jpg',
          motionType: 'zoom',
          duration: 3,
          loop: true
        }
      },
      {
        id: '13-video-upscaler',
        number: '13',
        name: 'Video Upscaler',
        description: 'Upscale and enhance video quality',
        category: 'video',
        features: ['4K Upscale', 'Frame Interpolation', 'Stabilization', 'Denoising'],
        async: true,
        tools: ['upscale_video', 'interpolate_frames', 'stabilize', 'denoise'],
        testInput: {
          videoUrl: 'https://example.com/video.mp4',
          targetResolution: '4k',
          interpolate: true,
          stabilize: true
        }
      },
      {
        id: '14-scene-generator',
        number: '14',
        name: 'Scene Generator',
        description: 'Generate complete scenes with multiple elements',
        category: 'image',
        features: ['Multi-Element', 'Composition AI', 'Lighting Control', 'Style Consistency'],
        async: true,
        tools: ['generate_scene', 'add_element', 'adjust_lighting', 'composite'],
        testInput: {
          sceneDescription: 'A cozy coffee shop interior with warm lighting',
          elements: ['coffee cup', 'book', 'plant'],
          style: 'photorealistic',
          lighting: 'warm'
        }
      },
      {
        id: '15-product-photographer',
        number: '15',
        name: 'Product Photographer',
        description: 'AI product photography and staging',
        category: 'image',
        features: ['Product Staging', 'Lifestyle Shots', 'Shadow Generation', 'Multi-Angle'],
        tools: ['stage_product', 'generate_lifestyle', 'add_shadows', 'create_angles'],
        testInput: {
          productImageUrl: 'https://example.com/product.png',
          style: 'lifestyle',
          background: 'kitchen counter',
          angles: ['front', 'side', 'detail']
        }
      },
      {
        id: '16-portrait-enhancer',
        number: '16',
        name: 'Portrait Enhancer',
        description: 'Professional portrait enhancement and retouching',
        category: 'biometric',
        features: ['Consent Aware', 'Skin Smoothing', 'Eye Enhancement', 'Lighting Fix'],
        tools: ['enhance_portrait', 'smooth_skin', 'enhance_eyes', 'fix_lighting'],
        testInput: {
          imageUrl: 'https://example.com/portrait.jpg',
          enhancements: ['skin', 'eyes', 'lighting'],
          intensity: 'natural'
        }
      },
      {
        id: '17-sketch-to-image',
        number: '17',
        name: 'Sketch to Image',
        description: 'Convert sketches to realistic images',
        category: 'image',
        features: ['ControlNet', 'Multiple Styles', 'Line Art Coloring', 'Fidelity Control'],
        tools: ['convert_sketch', 'color_lineart', 'generate_variations', 'analyze_sketch'],
        testInput: {
          sketchUrl: 'https://example.com/sketch.png',
          prompt: 'A beautiful forest scene',
          style: 'realistic',
          fidelity: 0.7
        }
      },
      {
        id: '18-music-generator',
        number: '18',
        name: 'Music Generator',
        description: 'AI music and sound effect generation',
        category: 'audio',
        features: ['MusicGen', 'Sound Effects', 'Ambient', 'Style Control'],
        async: true,
        tools: ['generate_music', 'generate_sfx', 'generate_ambient', 'continue_music'],
        testInput: {
          type: 'music',
          prompt: 'Upbeat corporate background music',
          genre: 'corporate',
          mood: 'uplifting',
          duration: 30
        }
      },
      {
        id: '19-voice-cloner',
        number: '19',
        name: 'Voice Cloner',
        description: 'AI voice cloning with consent validation',
        category: 'biometric',
        features: ['Consent Required', 'Voice Synthesis', 'Style Transfer', 'Multi-Language'],
        requiresConsent: true,
        tools: ['validate_consent', 'clone_voice', 'synthesize_speech', 'transfer_style'],
        testInput: {
          operation: 'synthesize',
          text: 'Hello, this is a test of voice synthesis.',
          voiceId: 'preset-voice-1',
          targetStyle: 'professional'
        }
      },
      {
        id: '20-ai-assistant',
        number: '20',
        name: 'AI Assistant',
        description: 'Multi-agent orchestration and task management',
        category: 'ai',
        features: ['Multi-Agent', 'Task Planning', 'Workflow Automation', 'Context Management'],
        tools: ['plan_task', 'execute_agent', 'manage_workflow', 'synthesize_results'],
        testInput: {
          task: 'Create a marketing campaign with images and copy',
          context: 'Product launch for a tech startup',
          agents: ['image-generator', 'blog-writer']
        }
      }
    ];

    const categoryMap = {
      all: () => true,
      image: (a) => a.category === 'image',
      video: (a) => a.category === 'video',
      audio: (a) => a.category === 'audio',
      biometric: (a) => a.requiresConsent || a.category === 'biometric',
      ai: (a) => a.category === 'ai'
    };

    let activeJobs = new Map();
    let currentCategory = 'all';

    // Initialize
    document.addEventListener('DOMContentLoaded', () => {
      renderAgents();
      checkHealth();
      loadAgentCatalog();
      setupTabs();
    });

    function setupTabs() {
      document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
          document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          currentCategory = tab.dataset.category;
          renderAgents();
        });
      });
    }

    function renderAgents() {
      const grid = document.getElementById('agentGrid');
      const filteredAgents = agents.filter(categoryMap[currentCategory]);

      grid.innerHTML = filteredAgents.map(agent => `
        <div class="agent-card" data-id="${agent.id}">
          <div class="agent-header">
            <div class="agent-number">Agent ${agent.number}</div>
            <div class="agent-name">${agent.name}</div>
            <div class="agent-desc">${agent.description}</div>
          </div>
          <div class="agent-body">
            <div class="feature-tags">
              ${agent.requiresConsent ? '<span class="tag consent">Requires Consent</span>' : ''}
              ${agent.async ? '<span class="tag async">Async</span>' : ''}
              ${agent.features.slice(0, 3).map(f => `<span class="tag">${f}</span>`).join('')}
            </div>
            <div class="tool-list">
              <strong style="font-size: 0.75rem; color: var(--text-secondary);">Tools:</strong>
              ${agent.tools.map(t => `<div class="tool-item"><span class="tool-name">${t}</span></div>`).join('')}
            </div>
            <div class="test-form">
              <button class="btn btn-primary" data-action="testAgent" data-param="${agent.id}">
                Test Agent
              </button>
              <button class="btn btn-secondary" data-action="showDetails" data-param="${agent.id}">
                Details
              </button>
            </div>
            <div class="result-area" id="result-${agent.id}">
              <div class="result-status" id="status-${agent.id}"></div>
              <div class="result-content" id="content-${agent.id}"></div>
            </div>
          </div>
        </div>
      `).join('');
    }

    async function checkHealth() {
      const dot = document.getElementById('healthDot');
      const status = document.getElementById('healthStatus');
      if (dot) dot.className = 'health-dot checking';
      if (status) status.textContent = 'Checking...';

      try {
        const res = await fetch(`${API_BASE}/health`);
        const data = await res.json();

        if (dot) dot.className = 'health-dot';
        if (status) status.textContent = `API ${data.status} - v${data.version}`;
      } catch (error) {
        if (dot) dot.className = 'health-dot offline';
        if (status) status.textContent = 'API Offline';
      }
    }

    async function loadAgentCatalog() {
      try {
        const res = await fetch(`${API_BASE}/api/store`);
        const data = await res.json();

        const el = document.getElementById('availableAgents');
        if (el) el.textContent = data.agents?.length || 0;
      } catch (error) {
        const el = document.getElementById('availableAgents');
        if (el) el.textContent = 'N/A';
      }
    }

    async function testAgent(agentId) {
      const agent = agents.find(a => a.id === agentId);
      if (!agent) return;

      const resultArea = document.getElementById(`result-${agentId}`);
      const statusEl = document.getElementById(`status-${agentId}`);
      const contentEl = document.getElementById(`content-${agentId}`);

      resultArea.classList.add('show');
      statusEl.className = 'result-status pending';
      statusEl.innerHTML = '<div class="spinner"></div> Testing...';
      contentEl.textContent = '';

      try {
        // Get the API agent ID (without the number prefix)
        const apiAgentId = agent.id.replace(/^\d+-/, '');

        // First, try to get agent info
        const infoRes = await fetch(`${API_BASE}/api/store/${apiAgentId}`);

        if (!infoRes.ok && infoRes.status !== 404) {
          throw new Error(`API returned ${infoRes.status}`);
        }

        // Then try to run the agent
        const runRes = await fetch(`${API_BASE}/api/store/${apiAgentId}/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input: agent.testInput })
        });

        const runData = await runRes.json();

        if (runRes.ok) {
          statusEl.className = 'result-status success';
          statusEl.textContent = runData.jobId ? 'Job Created' : 'Completed';
          contentEl.textContent = JSON.stringify(runData, null, 2);

          if (runData.jobId) {
            activeJobs.set(runData.jobId, agentId);
            updateActiveJobsCount();
            pollJob(runData.jobId, agentId);
          }
        } else {
          statusEl.className = 'result-status error';
          statusEl.textContent = 'Error';
          contentEl.textContent = JSON.stringify(runData, null, 2);
        }
      } catch (error) {
        statusEl.className = 'result-status error';
        statusEl.textContent = 'Request Failed';
        contentEl.textContent = error.message;
      }
    }

    async function pollJob(jobId, agentId) {
      try {
        const res = await fetch(`${API_BASE}/jobs/${jobId}`);
        const data = await res.json();

        const statusEl = document.getElementById(`status-${agentId}`);
        const contentEl = document.getElementById(`content-${agentId}`);

        if (data.status === 'completed') {
          statusEl.className = 'result-status success';
          statusEl.textContent = 'Completed';
          contentEl.textContent = JSON.stringify(data, null, 2);
          activeJobs.delete(jobId);
          updateActiveJobsCount();
        } else if (data.status === 'failed') {
          statusEl.className = 'result-status error';
          statusEl.textContent = 'Failed';
          contentEl.textContent = JSON.stringify(data, null, 2);
          activeJobs.delete(jobId);
          updateActiveJobsCount();
        } else {
          statusEl.innerHTML = `<div class="spinner"></div> ${data.status} (${data.progress || 0}%)`;
          contentEl.textContent = JSON.stringify(data, null, 2);
          setTimeout(() => pollJob(jobId, agentId), 2000);
        }
      } catch (error) {
        console.error('Poll error:', error);
      }
    }

    function updateActiveJobsCount() {
      const el = document.getElementById('activeJobs');
      if (el) el.textContent = activeJobs.size;
    }

    function showDetails(agentId) {
      const agent = agents.find(a => a.id === agentId);
      if (!agent) return;

      const modalTitleEl = document.getElementById('modalTitle');
      if (modalTitleEl) modalTitleEl.textContent = `${agent.name} - Details`;
      const modalBodyEl = document.getElementById('modalBody');
      if (modalBodyEl) modalBodyEl.innerHTML = `
        <div style="margin-bottom: 1.5rem;">
          <h4 style="color: var(--aifnmjmchg-m-accent); margin-bottom: 0.5rem;">Description</h4>
          <p style="color: var(--text-secondary);">${agent.description}</p>
        </div>

        <div style="margin-bottom: 1.5rem;">
          <h4 style="color: var(--aifnmjmchg-m-accent); margin-bottom: 0.5rem;">Features</h4>
          <div class="feature-tags">
            ${agent.features.map(f => `<span class="tag">${f}</span>`).join('')}
          </div>
        </div>

        <div style="margin-bottom: 1.5rem;">
          <h4 style="color: var(--aifnmjmchg-m-accent); margin-bottom: 0.5rem;">Available Tools</h4>
          ${agent.tools.map(t => `<div class="tool-item"><span class="tool-name">${t}</span></div>`).join('')}
        </div>

        <div style="margin-bottom: 1.5rem;">
          <h4 style="color: var(--aifnmjmchg-m-accent); margin-bottom: 0.5rem;">Test Input Schema</h4>
          <div class="json-viewer">${syntaxHighlight(agent.testInput)}</div>
        </div>

        <div style="display: flex; gap: 1rem;">
          <button class="btn btn-primary" data-action="testAgent" data-param="${agent.id}" data-after="closeModal">
            Run Test
          </button>
          <button class="btn btn-secondary" data-action="copyTestInput" data-param="${agent.id}">
            Copy Test Input
          </button>
        </div>
      `;

      document.getElementById('detailModal')?.classList.add('show');
    }

    function closeModal() {
      document.getElementById('detailModal')?.classList.remove('show');
    }

    function openConsole() {
      document.getElementById('consoleModal')?.classList.add('show');
    }

    function closeConsole() {
      document.getElementById('consoleModal')?.classList.remove('show');
    }

    async function sendConsoleRequest() {
      const method = document.getElementById('consoleMethod')?.value;
      const endpoint = document.getElementById('consoleEndpoint')?.value;
      const bodyText = document.getElementById('consoleBody')?.value;
      const responseEl = document.getElementById('consoleResponse');

      try {
        const options = {
          method,
          headers: { 'Content-Type': 'application/json' }
        };

        if (method !== 'GET' && bodyText) {
          options.body = bodyText;
        }

        const res = await fetch(`${API_BASE}${endpoint}`, options);
        const data = await res.json();

        if (responseEl) responseEl.innerHTML = syntaxHighlight(data);
      } catch (error) {
        if (responseEl) responseEl.textContent = `Error: ${error.message}`;
      }
    }

    async function runAllTests() {
      for (const agent of agents.slice(0, 5)) { // Test first 5 for demo
        await testAgent(agent.id);
        await new Promise(r => setTimeout(r, 500));
      }
    }

    function clearAllResults() {
      document.querySelectorAll('.result-area').forEach(el => {
        el.classList.remove('show');
      });
    }

    function copyTestInput(agentId) {
      const agent = agents.find(a => a.id === agentId);
      if (agent) {
        navigator.clipboard.writeText(JSON.stringify(agent.testInput, null, 2));
        alert('Test input copied to clipboard!');
      }
    }

    function syntaxHighlight(obj) {
      const json = JSON.stringify(obj, null, 2);
      return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, match => {
        let cls = 'json-number';
        if (/^"/.test(match)) {
          cls = /:$/.test(match) ? 'json-key' : 'json-string';
        } else if (/true|false/.test(match)) {
          cls = 'json-boolean';
        }
        return `<span class="${cls}">${match}</span>`;
      });
    }

    // Close modals on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeModal();
        closeConsole();
      }
    });

    // Close modals on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.classList.remove('show');
        }
      });
    });

    // CSP-safe event delegation
    document.addEventListener('click', function(e) {
      const el = e.target.closest('[data-action]');
      if (!el) return;
      const action = el.dataset.action;
      if (action === 'checkHealth') checkHealth();
      else if (action === 'loadAgentCatalog') loadAgentCatalog();
      else if (action === 'runAllTests') runAllTests();
      else if (action === 'clearAllResults') clearAllResults();
      else if (action === 'openConsole') openConsole();
      else if (action === 'closeModal') closeModal();
      else if (action === 'closeConsole') closeConsole();
      else if (action === 'sendConsoleRequest') sendConsoleRequest();
    });