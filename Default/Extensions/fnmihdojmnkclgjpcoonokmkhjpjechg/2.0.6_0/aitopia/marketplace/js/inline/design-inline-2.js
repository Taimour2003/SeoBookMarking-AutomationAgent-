function toggleTheme() {
      document.documentElement.classList.toggle('dark');
      localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    }

    if (localStorage.getItem('theme') === 'dark' || (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    }

    document.addEventListener('click', function(e) {
      const el = e.target.closest('[data-action]');
      if (!el) return;
      if (el.dataset.action === 'toggleTheme') toggleTheme();
    });