(() => {
  const toggleBtn = document.querySelector('[data-run-panel-toggle]');
  let formContent = document.querySelector('[data-run-panel]');
  let backdrop = document.querySelector('[data-run-panel-backdrop]');
  const closeBtn = document.querySelector('[data-run-panel-close]');
  const toggleText = toggleBtn?.querySelector('[data-toggle-text]');

  // Sync mobile and desktop buttons
  const desktopBtn = document.querySelector('[data-agent-run-button]');
  const mobileBtn = document.querySelector('[data-agent-run-button-mobile]');
  const desktopCredits = document.querySelector('[data-agent-run-credits]');
  const mobileCredits = document.querySelector('[data-agent-run-credits-mobile]');

  if (!formContent) return;

  const isMobile = () => window.innerWidth < 1024;

  function ensureDrawerInBody() {
    if (!formContent || !document.body) return;
    if (backdrop && backdrop.parentNode !== document.body) document.body.appendChild(backdrop);
    if (formContent.parentNode !== document.body) document.body.appendChild(formContent);
    backdrop = document.querySelector('[data-run-panel-backdrop]');
    formContent = document.querySelector('[data-run-panel]');
  }

  function openDrawer() {
    ensureDrawerInBody();
    formContent.classList.add('open');
    backdrop?.classList.add('open');
    document.body.classList.add('drawer-open');
    if (toggleText) toggleText.textContent = 'Close';
  }

  function closeDrawer() {
    formContent.classList.remove('open');
    backdrop?.classList.remove('open');
    document.body.classList.remove('drawer-open');
    if (toggleText) toggleText.textContent = 'Start Creating';
  }

  toggleBtn?.addEventListener('click', () => {
    if (formContent.classList.contains('open')) {
      closeDrawer();
    } else {
      openDrawer();
    }
  });

  closeBtn?.addEventListener('click', closeDrawer);

  backdrop?.addEventListener('click', closeDrawer);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && formContent.classList.contains('open')) {
      closeDrawer();
    }
  });

  window.addEventListener('resize', () => {
    if (!isMobile() && formContent.classList.contains('open')) {
      closeDrawer();
    }
  });

  if (mobileBtn && desktopBtn) {
    // Mirror disabled state
    const syncButtons = () => {
      mobileBtn.disabled = desktopBtn.disabled;
      mobileBtn.textContent = desktopBtn.textContent;
    };
    const observer = new MutationObserver(syncButtons);
    observer.observe(desktopBtn, { attributes: true, childList: true, subtree: true });

    mobileBtn.addEventListener('click', () => {
      desktopBtn.click();
    });
  }

  if (mobileCredits && desktopCredits) {
    const syncCredits = () => {
      mobileCredits.textContent = desktopCredits.textContent;
      mobileCredits.className = desktopCredits.className;
    };
    const observer = new MutationObserver(syncCredits);
    observer.observe(desktopCredits, { attributes: true, childList: true, subtree: true, characterData: true });
  }
})();