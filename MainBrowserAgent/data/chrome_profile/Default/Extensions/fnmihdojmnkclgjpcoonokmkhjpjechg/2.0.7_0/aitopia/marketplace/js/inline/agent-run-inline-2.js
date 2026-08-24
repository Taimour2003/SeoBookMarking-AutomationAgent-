// Theme init (matches store.html behavior)
      (function initTheme() {
        const stored = localStorage.getItem('theme');
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const shouldUseDark = stored === 'dark' || (!stored && prefersDark);
        if (shouldUseDark) document.documentElement.classList.add('dark');
      })();