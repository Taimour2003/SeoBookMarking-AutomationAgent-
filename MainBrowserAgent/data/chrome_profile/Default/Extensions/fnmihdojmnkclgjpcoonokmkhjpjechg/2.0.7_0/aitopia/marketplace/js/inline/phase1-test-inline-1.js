const BASE_URL = window.__AITOPIA_DOMAIN__ || 'https://aitopia.ai';

    // Check server status
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

    // Build input object for each agent
    function buildInput(agentId) {
      const inputs = {
        'video-upscaler-v2': () => ({
          videoUrl: document.getElementById('video-upscaler-v2-url')?.value,
          scale: document.getElementById('video-upscaler-v2-scale')?.value,  // Keep as string '2' or '4'
          targetFps: document.getElementById('video-upscaler-v2-fps')?.value ? parseInt(document.getElementById('video-upscaler-v2-fps')?.value) : undefined,
          interpolateFps: !!document.getElementById('video-upscaler-v2-fps')?.value,
          denoise: document.getElementById('video-upscaler-v2-denoise')?.value,
          enhanceFaces: document.getElementById('video-upscaler-v2-faces')?.value === 'true',
          provider: 'replicate',
          quality: 'high',
          outputFormat: 'mp4'
        }),

        'video-face-swap-v2': () => ({
          videoUrl: document.getElementById('video-face-swap-v2-video')?.value,
          sourceFaceUrl: document.getElementById('video-face-swap-v2-face')?.value,
          temporalMode: document.getElementById('video-face-swap-v2-mode')?.value,
          addWatermark: document.getElementById('video-face-swap-v2-watermark')?.value === 'true',
          provider: 'replicate',
          consent: {
            subjectId: 'demo-subject',
            subjectConsent: true,
            targetConsent: true,  // For different-person swap
            ageVerified: true,
            intendedUse: 'entertainment',
            method: 'checkbox',
            timestamp: new Date().toISOString()
          }
        }),

        'lipsync-studio-v2': () => {
          const videoUrl = document.getElementById('lipsync-studio-v2-video')?.value;
          return {
            text: document.getElementById('lipsync-studio-v2-text')?.value,
            videoUrl: videoUrl || undefined,
            voice: document.getElementById('lipsync-studio-v2-voice')?.value,
            language: document.getElementById('lipsync-studio-v2-lang')?.value,
            provider: 'replicate',
            outputFormat: videoUrl ? 'mp4' : 'mp3'  // Audio only if no video
          };
        },

        'youtube-thumbnail-gen': () => ({
          title: document.getElementById('youtube-thumbnail-gen-title')?.value,
          subtitle: document.getElementById('youtube-thumbnail-gen-subtitle')?.value || undefined,
          imageUrl: document.getElementById('youtube-thumbnail-gen-image')?.value || undefined,
          style: document.getElementById('youtube-thumbnail-gen-style')?.value,
          variations: parseInt(document.getElementById('youtube-thumbnail-gen-variations')?.value),
          enhanceFaces: true,
          provider: 'replicate'
        }),

        'art-style-transfer': () => ({
          imageUrl: document.getElementById('art-style-transfer-image')?.value,
          style: document.getElementById('art-style-transfer-style')?.value,
          intensity: parseFloat(document.getElementById('art-style-transfer-intensity')?.value),
          preserveStructure: document.getElementById('art-style-transfer-structure')?.value === 'true',
          animate: document.getElementById('art-style-transfer-animate')?.value === 'true',
          animationDuration: 3,
          provider: 'replicate'
        }),

        'background-remover': () => ({
          imageUrl: document.getElementById('background-remover-image')?.value,
          outputFormat: document.getElementById('background-remover-format')?.value,
          quality: document.getElementById('background-remover-quality')?.value,
          backgroundColor: document.getElementById('background-remover-bgcolor')?.value,
          edgeRefinement: true
        }),

        'blog-writer': () => ({
          topic: document.getElementById('blog-writer-topic')?.value,
          tone: document.getElementById('blog-writer-tone')?.value,
          length: document.getElementById('blog-writer-length')?.value,
          targetAudience: document.getElementById('blog-writer-audience')?.value || undefined,
          keywords: document.getElementById('blog-writer-keywords')?.value ? document.getElementById('blog-writer-keywords')?.value.split(',').map(k => k.trim()) : undefined,
          includeImages: true
        })
      };

      return inputs[agentId] ? inputs[agentId]() : {};
    }

    // Run agent
    async function runAgent(agentId) {
      const btn = event.target;
      const resultSection = document.getElementById(`result-${agentId}`);
      const statusEl = document.getElementById(`status-${agentId}`);
      const jsonEl = document.getElementById(`json-${agentId}`);
      const mediaEl = document.getElementById(`media-${agentId}`);

      // Reset UI
      btn.disabled = true;
      btn.classList.add('loading');
      btn.textContent = '⏳ Processing...';
      resultSection.classList.add('show');
      statusEl.className = 'result-status processing';
      statusEl.textContent = '⏳ Processing...';
      jsonEl.textContent = '';
      if (mediaEl) mediaEl.innerHTML = '';

      try {
        const parameters = buildInput(agentId);
        console.log(`Running ${agentId} with parameters:`, parameters);

        // Build request in the format the executor expects
        const requestBody = {
          agentId,
          input: {
            task: `Execute ${agentId} agent`,
            parameters: parameters
          },
          idempotencyKey: `${agentId}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
        };

        console.log('Request body:', requestBody);

        const res = await fetch(`${BASE_URL}/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });

        const data = await res.json();
        console.log(`${agentId} response:`, data);

        if (data.error) {
          throw new Error(data.error.message || JSON.stringify(data.error));
        }

        statusEl.className = 'result-status completed';
        const processingTime = data.result?.processingTime ? `(${(data.result.processingTime / 1000).toFixed(1)}s)` : '';
        statusEl.textContent = `✅ Completed ${processingTime}`;

        // Display media if available
        if (mediaEl) {
          const result = data.result || {};
          const imageFields = ['outputUrl', 'imageUrl', 'outputBase64', 'styledImageUrl'];
          const videoFields = ['videoUrl', 'syncedVideoUrl'];
          const audioFields = ['audioUrl'];

          // Check for images
          for (const field of imageFields) {
            if (result[field]) {
              const src = result[field].startsWith('data:') ? result[field] : result[field];
              mediaEl.innerHTML += `<img src="${src}" alt="Result" style="max-width: 100%; border-radius: 8px; margin-bottom: 10px;">`;
              break;
            }
          }

          // Check for thumbnails array
          if (result.thumbnails && Array.isArray(result.thumbnails)) {
            result.thumbnails.forEach((thumb, i) => {
              if (thumb.url) {
                mediaEl.innerHTML += `<img src="${thumb.url}" alt="Thumbnail ${i+1}" style="max-width: 100%; border-radius: 8px; margin-bottom: 10px;">`;
              }
            });
          }

          // Check for video
          for (const field of videoFields) {
            if (result[field]) {
              mediaEl.innerHTML += `<video src="${result[field]}" controls style="width: 100%; border-radius: 8px;"></video>`;
              break;
            }
          }

          // Check for audio
          for (const field of audioFields) {
            if (result[field]) {
              mediaEl.innerHTML += `<audio src="${result[field]}" controls style="width: 100%;"></audio>`;
              break;
            }
          }
        }

        jsonEl.textContent = JSON.stringify(data, null, 2);
        btn.classList.remove('loading');
        btn.classList.add('success');
        btn.textContent = '✓ Done - Run Again';

      } catch (error) {
        console.error(`${agentId} error:`, error);
        statusEl.className = 'result-status failed';
        statusEl.textContent = `❌ Error: ${error.message}`;
        jsonEl.textContent = error.message;
        btn.classList.remove('loading');
        btn.classList.add('error');
        btn.textContent = '✕ Error - Try Again';
      }

      setTimeout(() => {
        btn.disabled = false;
        btn.classList.remove('success', 'error');
        btn.textContent = `▶ Run Again`;
      }, 2000);
    }

    // Initialize
    checkServer();