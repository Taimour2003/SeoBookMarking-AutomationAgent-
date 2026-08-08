function filterResults(filter) {
      const cards = document.querySelectorAll('.result-card');
      const btns = document.querySelectorAll('.filter-btn');

      btns.forEach(b => {
        if (b.onclick.toString().includes("'" + filter + "'")) {
          b.classList.add('active');
        } else if (filter === 'all' && b.textContent.startsWith('All')) {
          b.classList.add('active');
        } else {
          b.classList.remove('active');
        }
      });

      cards.forEach(card => {
        const status = card.dataset.status;
        const type = card.dataset.type;
        if (filter === 'all') {
          card.style.display = 'block';
        } else if (['success', 'error', 'timeout', 'skipped'].includes(filter)) {
          card.style.display = status === filter ? 'block' : 'none';
        } else {
          card.style.display = type === filter ? 'block' : 'none';
        }
      });
    }