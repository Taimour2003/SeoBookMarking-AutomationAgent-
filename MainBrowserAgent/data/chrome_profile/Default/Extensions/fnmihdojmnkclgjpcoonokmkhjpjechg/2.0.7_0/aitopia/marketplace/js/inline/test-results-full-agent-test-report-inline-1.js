function filterResults(filter) {
      const cards = document.querySelectorAll('.result-card');
      const sections = document.querySelectorAll('.category-section');
      const btns = document.querySelectorAll('.filter-btn');
      btns.forEach(b => b.classList.remove('active'));
      event.target.classList.add('active');

      sections.forEach(s => s.style.display = 'block');
      cards.forEach(card => {
        const status = card.dataset.status;
        if (filter === 'all') {
          card.style.display = 'block';
        } else {
          card.style.display = status === filter ? 'block' : 'none';
        }
      });
    }

    function filterCategory(category) {
      const sections = document.querySelectorAll('.category-section');
      const btns = document.querySelectorAll('.filter-btn');
      btns.forEach(b => b.classList.remove('active'));
      event.target.classList.add('active');

      sections.forEach(s => {
        s.style.display = s.dataset.category === category ? 'block' : 'none';
      });
      document.querySelectorAll('.result-card').forEach(c => c.style.display = 'block');
    }