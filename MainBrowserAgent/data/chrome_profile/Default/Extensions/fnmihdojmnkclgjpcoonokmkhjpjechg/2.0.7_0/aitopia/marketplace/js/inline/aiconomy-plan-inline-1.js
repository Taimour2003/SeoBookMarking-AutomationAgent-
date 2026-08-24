// Interactive Calculator
      const viewSlider = document.getElementById('viewSlider');
      const viewCount = document.getElementById('viewCount');
      const calcResults = document.getElementById('calcResults');

      function formatNumber(num) {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(0) + 'K';
        return num.toString();
      }

      function formatMoney(num) {
        return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }

      function updateCalculator() {
        const views = parseInt(viewSlider.value);
        viewCount.textContent = formatNumber(views);

        // Assumptions: $3.50 CPM, 32% ad network fee, $0.15/1K CDN, 5% fraud reserve
        const grossRevenue = (views / 1000) * 3.50;
        const adNetworkFee = grossRevenue * 0.32;
        const cdnCost = (views / 1000) * 0.15;
        const fraudReserve = grossRevenue * 0.05;
        const netRevenue = grossRevenue - adNetworkFee - cdnCost - fraudReserve;

        const contentShare = netRevenue * 0.45;
        const toolShare = netRevenue * 0.20;
        const platformShare = netRevenue * 0.30;

        calcResults.innerHTML = `
          <div class="calc-result">
            <div class="calc-result-value" style="color: var(--gray-700);">${formatMoney(grossRevenue)}</div>
            <div class="calc-result-label">Gross Revenue</div>
          </div>
          <div class="calc-result">
            <div class="calc-result-value" style="color: var(--purple-600);">${formatMoney(contentShare)}</div>
            <div class="calc-result-label">Content (45%)</div>
          </div>
          <div class="calc-result">
            <div class="calc-result-value" style="color: var(--cyan-600);">${formatMoney(toolShare)}</div>
            <div class="calc-result-label">Tool (20%)</div>
          </div>
          <div class="calc-result">
            <div class="calc-result-value" style="color: var(--gray-500);">${formatMoney(platformShare)}</div>
            <div class="calc-result-label">Platform (30%)</div>
          </div>
        `;
      }

      viewSlider.addEventListener('input', updateCalculator);
      updateCalculator();

      // Navigation active state
      const navLinks = document.querySelectorAll('.nav-link');
      const sections = document.querySelectorAll('section[id]');

      function updateActiveNav() {
        let current = '';
        sections.forEach(section => {
          const sectionTop = section.offsetTop - 100;
          if (window.scrollY >= sectionTop) {
            current = section.getAttribute('id');
          }
        });

        navLinks.forEach(link => {
          link.classList.remove('active');
          if (link.getAttribute('href') === '#' + current) {
            link.classList.add('active');
          }
        });
      }

      window.addEventListener('scroll', updateActiveNav);