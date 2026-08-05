function filterResults(filter) {
      const cards = document.querySelectorAll('.result-card');
      const btns = document.querySelectorAll('.filter-btn');
      btns.forEach(b => b.classList.remove('active'));
      event.target.classList.add('active');

      cards.forEach(card => {
        const status = card.dataset.status;
        const type = card.dataset.type;
        if (filter === 'all') {
          card.style.display = 'block';
        } else if (filter === 'success' || filter === 'error' || filter === 'timeout') {
          card.style.display = status === filter ? 'block' : 'none';
        } else {
          card.style.display = type === filter ? 'block' : 'none';
        }
      });
    }