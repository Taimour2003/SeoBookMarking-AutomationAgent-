// State
    let currentDoc = null;
    let docs = [];

    // DOM elements
    const content = document.getElementById('content');
    const navCategories = document.getElementById('nav-categories');
    const breadcrumb = document.getElementById('breadcrumb');
    const breadcrumbCurrent = document.getElementById('breadcrumb-current');
    const lastUpdated = document.getElementById('last-updated');
    const toc = document.getElementById('toc');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const menuToggle = document.getElementById('menu-toggle');

    // Configure marked
    marked.setOptions({
      highlight: function(code, lang) {
        if (Prism.languages[lang]) {
          return Prism.highlight(code, Prism.languages[lang], lang);
        }
        return code;
      },
      breaks: true,
      gfm: true,
    });

    // Mobile menu toggle
    function toggleSidebar() {
      sidebar.classList.toggle('-translate-x-full');
      sidebarOverlay.classList.toggle('hidden');
    }

    menuToggle?.addEventListener('click', toggleSidebar);

    // Load documentation index
    async function loadIndex() {
      try {
        const response = await fetch('https://aitopia.ai/docs');
        const data = await response.json();
        docs = data.categories.flatMap(c => c.docs);
        renderNav(data.categories);

        // Load doc from URL or show welcome
        const urlParams = new URLSearchParams(window.location.search);
        const docId = urlParams.get('doc') || window.location.hash.slice(1);

        if (docId) {
          loadDoc(docId);
        } else {
          showWelcome(data.categories);
        }
      } catch (error) {
        console.error('Failed to load docs index:', error);
        navCategories.innerHTML = `
          <div class="text-red-500 dark:text-red-400 text-sm">Failed to load documentation</div>
        `;
      }
    }

    // Render navigation
    function renderNav(categories) {
      navCategories.innerHTML = categories.map(cat => `
        <div class="mb-6">
          <h3 class="text-xs font-semibold text-gray-500 dark:text-neutral-500 uppercase tracking-wider mb-2 px-3">
            ${cat.name}
          </h3>
          <ul class="space-y-1">
            ${cat.docs.map(doc => `
              <li>
                <a href="?doc=${doc.id}"
                   data-load-doc="${doc.id}"
                   class="sidebar-link block px-3 py-2 text-sm text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition-all"
                   data-doc-id="${doc.id}">
                  ${doc.title}
                </a>
              </li>
            `).join('')}
          </ul>
        </div>
      `).join('');
    }

    // Show welcome/index page
    function showWelcome(categories) {
      const totalDocs = categories.reduce((sum, c) => sum + c.docs.length, 0);

      content.innerHTML = `
        <h1>Documentation</h1>
        <p class="text-lg text-gray-500 dark:text-neutral-400 mb-8">
          Welcome to the Agent Marketplace documentation. Here you'll find comprehensive guides and references for all features.
        </p>

        <div class="grid gap-6 sm:grid-cols-2 mb-12">
          ${categories.map(cat => `
            <div class="bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-6 hover:border-gray-300 dark:hover:border-neutral-700 transition-colors">
              <h3 class="text-lg font-semibold mb-2">${cat.name}</h3>
              <p class="text-gray-500 dark:text-neutral-500 text-sm mb-4">${cat.docs.length} document${cat.docs.length !== 1 ? 's' : ''}</p>
              <ul class="space-y-2">
                ${cat.docs.slice(0, 3).map(doc => `
                  <li>
                    <a href="?doc=${doc.id}"
                       data-load-doc="${doc.id}"
                       class="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 text-sm flex items-center gap-2">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                      </svg>
                      ${doc.title}
                    </a>
                  </li>
                `).join('')}
                ${cat.docs.length > 3 ? `
                  <li class="text-gray-500 dark:text-neutral-500 text-sm pt-1">
                    +${cat.docs.length - 3} more...
                  </li>
                ` : ''}
              </ul>
            </div>
          `).join('')}
        </div>

        <div class="bg-gradient-to-r from-indigo-500/10 to-primary/90/10 border border-indigo-500/20 rounded-xl p-6">
          <h3 class="text-lg font-semibold mb-2">Quick Start</h3>
          <ul class="space-y-2 text-gray-700 dark:text-neutral-300">
            <li class="flex items-start gap-2">
              <span class="text-indigo-600 dark:text-indigo-400">1.</span>
              <span>Check out the <a href="?doc=shopify-integration" data-load-doc="shopify-integration" class="text-indigo-600 dark:text-indigo-400 hover:underline">Shopify Integration</a> guide for embedding the marketplace</span>
            </li>
            <li class="flex items-start gap-2">
              <span class="text-indigo-600 dark:text-indigo-400">2.</span>
              <span>Learn about <a href="?doc=triggers-and-actions" data-load-doc="triggers-and-actions" class="text-indigo-600 dark:text-indigo-400 hover:underline">Triggers & Actions</a> for automation</span>
            </li>
            <li class="flex items-start gap-2">
              <span class="text-indigo-600 dark:text-indigo-400">3.</span>
              <span>Browse the full <a href="/aitopia/marketplace/store.html" class="text-indigo-600 dark:text-indigo-400 hover:underline">Agent Store</a> to see available AI agents</span>
            </li>
          </ul>
        </div>
      `;

      breadcrumb.classList.add('hidden');
      toc.innerHTML = '';
      document.title = 'Documentation - Agent Marketplace';
    }

    // Load a specific document
    async function loadDoc(docId) {
      content.innerHTML = `
        <div class="flex items-center justify-center py-20">
          <div class="spinner"></div>
        </div>
      `;

      try {
        const response = await fetch(`https://aitopia.ai/docs/${docId}`);

        if (!response.ok) {
          throw new Error('Document not found');
        }

        const doc = await response.json();
        currentDoc = doc;

        // Render markdown
        content.innerHTML = marked.parse(doc.content);

        // Apply syntax highlighting
        Prism.highlightAllUnder(content);

        // Update breadcrumb
        breadcrumb.classList.remove('hidden');
        breadcrumbCurrent.textContent = doc.title;

        // Update last updated
        if (doc.lastModified) {
          lastUpdated.textContent = new Date(doc.lastModified).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
        }

        // Update page title
        document.title = `${doc.title} - Agent Marketplace Docs`;

        // Update active nav link
        document.querySelectorAll('.sidebar-link').forEach(link => {
          link.classList.remove('active');
          if (link.dataset.docId === docId) {
            link.classList.add('active');
          }
        });

        // Generate TOC
        generateTOC();

        // Scroll to top
        window.scrollTo(0, 0);

      } catch (error) {
        console.error('Failed to load doc:', error);
        content.innerHTML = `
          <div class="text-center py-20">
            <div class="text-6xl mb-4">404</div>
            <h1 class="text-2xl font-bold mb-2">Document Not Found</h1>
            <p class="text-gray-500 dark:text-neutral-400 mb-6">The requested documentation could not be found.</p>
            <a href="/aitopia/marketplace/docs.html" class="text-indigo-600 dark:text-indigo-400 hover:underline">Back to Documentation Index</a>
          </div>
        `;
        breadcrumb.classList.add('hidden');
      }
    }

    // Generate table of contents from headings
    function generateTOC() {
      const headings = content.querySelectorAll('h2, h3');

      if (headings.length === 0) {
        toc.innerHTML = '<p class="text-gray-400 dark:text-neutral-600 italic">No sections</p>';
        return;
      }

      toc.innerHTML = Array.from(headings).map((h, i) => {
        const id = `heading-${i}`;
        h.id = id;
        const isH3 = h.tagName === 'H3';
        return `
          <a href="#${id}"
             class="toc-link block ${isH3 ? 'pl-4' : ''}"
             data-scroll-to="${id}">
            ${h.textContent}
          </a>
        `;
      }).join('');
    }

    // Handle browser back/forward
    window.addEventListener('popstate', () => {
      const urlParams = new URLSearchParams(window.location.search);
      const docId = urlParams.get('doc') || window.location.hash.slice(1);

      if (docId) {
        loadDoc(docId);
      } else {
        loadIndex();
      }
    });

    // Initialize
    loadIndex();

    // CSP-safe event delegation
    document.addEventListener('click', function(e) {
      const el = e.target.closest('[data-action]');
      if (!el) return;
      if (el.dataset.action === 'toggleSidebar') toggleSidebar();
    });