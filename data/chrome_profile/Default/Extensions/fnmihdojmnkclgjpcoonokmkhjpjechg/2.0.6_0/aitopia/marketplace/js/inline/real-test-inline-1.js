const BASE = window.__AITOPIA_DOMAIN__ || 'https://aitopia.ai';

    async function callAgent(agentId, parameters, resultId) {
      const result = document.getElementById(`${resultId}-result`);
      const status = document.getElementById(`${resultId}-status`);
      const json = document.getElementById(`${resultId}-json`);
      const media = document.getElementById(`${resultId}-media`);

      result.classList.add('show');
      status.className = 'result-status loading';
      status.innerHTML = '<div class="spinner"></div><span>Processing...</span>';
      json.textContent = '';
      if (media) media.innerHTML = '';

      const startTime = Date.now();

      try {
        const res = await fetch(`${BASE}/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentId,
            input: { task: `Execute ${agentId}`, parameters },
            idempotencyKey: `${agentId}-${Date.now()}-${Math.random().toString(36).slice(2)}`
          })
        });

        const data = await res.json();
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));

        status.className = 'result-status success';
        status.innerHTML = `<span>Completed in ${elapsed}s</span>`;

        // Display media
        const r = data.result || {};
        if (media) {
          // Audio
          if (r.audioUrl) {
            media.innerHTML = `<audio controls src="${r.audioUrl}"></audio>`;
          }
          // Image
          if (r.outputUrl || r.imageUrl) {
            const src = r.outputUrl || r.imageUrl;
            media.innerHTML = `<img src="${src}" alt="Output">`;
          }
          // Video
          if (r.videoUrl) {
            media.innerHTML = `<video controls src="${r.videoUrl}"></video>`;
          }
        }

        json.textContent = JSON.stringify(data, null, 2);

      } catch (err) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        status.className = 'result-status error';
        status.innerHTML = `<span>Error after ${elapsed}s: ${err.message}</span>`;
        json.textContent = err.message;
      }
    }

    function runTTS() {
      callAgent('lipsync-studio-v2', {
        text: document.getElementById('tts-text')?.value,
        voice: document.getElementById('tts-voice')?.value,
        language: 'en',
        provider: 'elevenlabs',
        outputFormat: 'mp3'
      }, 'tts');
    }

    function runStyleTransfer() {
      callAgent('art-style-transfer', {
        imageUrl: document.getElementById('style-image')?.value,
        style: document.getElementById('style-type')?.value,
        intensity: 0.7,
        preserveStructure: true,
        provider: 'replicate'
      }, 'style');
    }

    function runBgRemoval() {
      callAgent('background-remover', {
        imageUrl: document.getElementById('bg-image')?.value,
        outputFormat: document.getElementById('bg-format')?.value,
        quality: 'balanced',
        edgeRefinement: true
      }, 'bg');
    }

    function runBlogWriter() {
      callAgent('blog-writer', {
        topic: document.getElementById('blog-topic')?.value,
        tone: document.getElementById('blog-tone')?.value,
        length: 'short',
        targetAudience: 'Tech professionals'
      }, 'blog');
    }