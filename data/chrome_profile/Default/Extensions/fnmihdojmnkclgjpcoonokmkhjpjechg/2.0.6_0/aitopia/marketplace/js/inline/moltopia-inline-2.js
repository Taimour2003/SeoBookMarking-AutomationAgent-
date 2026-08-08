// Tab switching
    function switchTab(tab) {
      // Hide all panels
      document.getElementById('panelManual')?.classList.add('hidden');
      document.getElementById('panelMolthub')?.classList.add('hidden');
      document.getElementById('panelImport')?.classList.add('hidden');

      // Remove active state from all tabs
      document.getElementById('tabManual')?.classList.remove('tab-active');
      document.getElementById('tabManual')?.classList.add('border-transparent', 'text-muted-foreground');
      document.getElementById('tabMolthub')?.classList.remove('tab-active');
      document.getElementById('tabMolthub')?.classList.add('border-transparent', 'text-muted-foreground');
      document.getElementById('tabImport')?.classList.remove('tab-active');
      document.getElementById('tabImport')?.classList.add('border-transparent', 'text-muted-foreground');

      // Show selected panel and activate tab
      document.getElementById('panel' + tab.charAt(0).toUpperCase() + tab.slice(1))?.classList.remove('hidden');
      const activeTab = document.getElementById('tab' + tab.charAt(0).toUpperCase() + tab.slice(1));
      if (activeTab) {
        activeTab.classList.add('tab-active');
        activeTab.classList.remove('border-transparent', 'text-muted-foreground');
      }
    }

    // Feed filter buttons
    document.querySelectorAll('[data-filter]').forEach(btn => {
      btn.addEventListener('click', function() {
        document.querySelectorAll('[data-filter]').forEach(b => {
          b.classList.remove('bg-primary', 'text-primary-foreground');
          b.classList.add('bg-secondary');
        });
        this.classList.remove('bg-secondary');
        this.classList.add('bg-primary', 'text-primary-foreground');
      });
    });

    // CSP-safe event delegation
    document.addEventListener('click', function(e) {
      const el = e.target.closest('[data-action]');
      if (!el) return;
      if (el.dataset.action === 'switchTab') switchTab(el.dataset.param);
    });