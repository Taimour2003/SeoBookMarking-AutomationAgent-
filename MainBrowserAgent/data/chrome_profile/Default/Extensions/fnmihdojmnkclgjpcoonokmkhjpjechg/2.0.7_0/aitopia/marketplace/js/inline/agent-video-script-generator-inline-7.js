(() => {
  const tabs = {
    create: document.querySelector('[data-agent-run-tab="create"]'),
    about: document.querySelector('[data-agent-run-tab="about"]'),
    history: document.querySelector('[data-agent-run-tab="history"]'),
    similar: document.querySelector('[data-agent-run-tab="similar"]')
  };
  const panels = {
    create: document.querySelector('[data-agent-run-panel="create"]'),
    about: document.querySelector('[data-agent-run-panel="about"]'),
    history: document.querySelector('[data-agent-run-panel="history"]'),
    similar: document.querySelector('[data-agent-run-panel="similar"]')
  };
  const historyControls = document.getElementById('history-controls');
  const shareMoreRow = document.getElementById('agent-tab-row-share-more');

  const isMobile = () => window.innerWidth < 1024;

  const baseClasses = 'px-4 h-8 rounded-2xl text-[13px] font-semibold transition-all whitespace-nowrap';
  const activeClasses = 'bg-white dark:bg-[#272727] text-[#0D0D0D] dark:text-foreground shadow-sm';
  const inactiveClasses = 'text-[#898A8B] dark:text-muted-foreground hover:text-[#0D0D0D] dark:hover:text-foreground hover:bg-white/50 dark:hover:bg-[#272727]/50';

  function setActiveTab(tabId) {
    const mobile = isMobile();

    Object.keys(tabs).forEach(id => {
      const tab = tabs[id];
      if (!tab) return;

      const isActive = id === tabId;
      const lgHidden = id === 'create' ? 'lg:hidden ' : '';
      tab.className = lgHidden + baseClasses + ' ' + (isActive ? activeClasses : inactiveClasses);
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    Object.keys(panels).forEach(id => {
      const panel = panels[id];
      if (!panel) return;

      if (id === 'create') {
        // Create panel: Always visible on desktop, only visible when create tab active on mobile
        if (mobile) {
          panel.classList.toggle('hidden', tabId !== 'create');
        } else {
          panel.classList.remove('hidden');
        }
      } else {
        // Other panels: Toggle based on active tab
        panel.classList.toggle('hidden', id !== tabId);
      }
    });

    if (shareMoreRow) {
      const showShareMore = tabId === 'about';
      shareMoreRow.classList.toggle('hidden', !showShareMore);
      if (!showShareMore) {
        const shareDropdown = document.querySelector('#agent-share-menu [role="menu"]');
        const moreDropdown = document.querySelector('#agent-more-menu [data-agent-more-dropdown]');
        if (shareDropdown) shareDropdown.classList.add('hidden');
        if (moreDropdown) moreDropdown.classList.add('hidden');
      }
    }

    if (historyControls) {
      if (tabId === 'history') {
        historyControls.className = 'hidden lg:flex items-center gap-3';
      } else {
        historyControls.className = 'hidden items-center gap-3';
      }
    }
  }

  tabs.create?.addEventListener('click', () => setActiveTab('create'));
  tabs.about?.addEventListener('click', () => setActiveTab('about'));
  tabs.history?.addEventListener('click', () => setActiveTab('history'));
  tabs.similar?.addEventListener('click', () => setActiveTab('similar'));

  window.__AITOPIA_SET_TAB__ = setActiveTab;

  // Set initial tab
  if (isMobile()) {
    setActiveTab('create');
  } else {
    setActiveTab('about');
  }

  // Handle resize
  let wasMobile = isMobile();
  window.addEventListener('resize', () => {
    const nowMobile = isMobile();
    if (wasMobile !== nowMobile) {
      wasMobile = nowMobile;
      const activeTab = Object.keys(tabs).find(id => tabs[id]?.getAttribute('aria-selected') === 'true');
      if (activeTab) setActiveTab(activeTab);
    }
  });

  /* Change button -> Similar tab */
  const changeBtn = document.getElementById('change-agent-btn');
  changeBtn?.addEventListener('click', () => {
    setActiveTab('similar');
  });
})();