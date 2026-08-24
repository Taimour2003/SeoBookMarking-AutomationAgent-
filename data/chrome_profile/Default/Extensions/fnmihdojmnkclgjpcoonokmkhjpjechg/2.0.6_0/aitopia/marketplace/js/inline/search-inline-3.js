document.addEventListener('click', function(e) {
      const el = e.target.closest('[data-action]');
      if (!el) return;
      if (el.dataset.action === 'toggleTheme') {
        document.documentElement.classList.toggle('dark');
        localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
      }
    });