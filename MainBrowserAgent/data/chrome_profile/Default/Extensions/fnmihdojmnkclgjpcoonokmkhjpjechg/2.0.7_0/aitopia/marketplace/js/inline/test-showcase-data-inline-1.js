async function testShowcaseData() {
      const output = document.getElementById('output');

      try {
        console.log('🔍 Fetching agent-showcase-data.json...');
        const response = await fetch("https://aitopia.ai/agent-showcase-data.json");
        const showcaseData = await response.json();

        console.log(`✅ Loaded ${showcaseData.length} agents from showcase data`);

        let html = `<p style="color: #90ee90;">✅ Successfully loaded ${showcaseData.length} agents from showcase-data.json</p>`;

        showcaseData.slice(0, 8).forEach(agent => {
          html += `
            <div class="agent">
              <h3>${agent.name} (${agent.id})</h3>
              <p>Category: <strong>${agent.category}</strong></p>
              <p>Showcase Images: <strong>${agent.showcase_images?.length || 0}</strong></p>
              ${agent.showcase_images?.length > 0 ? `
                <div class="image-list">
                  ${agent.showcase_images.map(img => `<div>📷 ${img}</div>`).join('')}
                </div>
              ` : '<p style="color: #ff6b6b;">❌ No showcase images found</p>'}
            </div>
          `;
        });

        output.innerHTML = html;
      } catch (err) {
        output.innerHTML = `<p style="color: #ff6b6b;">❌ Error: ${err.message}</p>`;
        console.error('Error loading showcase data:', err);
      }
    }

    // Run test on page load
    window.addEventListener('load', testShowcaseData);