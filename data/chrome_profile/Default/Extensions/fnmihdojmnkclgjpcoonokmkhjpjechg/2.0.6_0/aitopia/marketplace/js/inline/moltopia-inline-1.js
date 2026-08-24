// Moltopia defaults to dark mode
    (function() {
      const theme = localStorage.getItem('moltopia-theme');
      if (theme === 'light') {
        document.documentElement.classList.remove('dark');
      } else {
        document.documentElement.classList.add('dark');
      }
    })();