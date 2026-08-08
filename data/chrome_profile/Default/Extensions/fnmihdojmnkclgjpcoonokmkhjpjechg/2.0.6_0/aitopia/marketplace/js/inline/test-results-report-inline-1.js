function toggleDetails(agentId) {
      const details = document.getElementById('details-' + agentId);
      details.style.display = details.style.display === 'none' ? 'block' : 'none';
    }

    function filterResults(status) {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      event.target.classList.add('active');

      document.querySelectorAll('.agent-result').forEach(el => {
        if (status === 'all' || el.dataset.status === status) {
          el.style.display = 'block';
        } else {
          el.style.display = 'none';
        }
      });
    }

    function filterByPriority(priority) {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      event.target.classList.add('active');

      document.querySelectorAll('.agent-result').forEach(el => {
        el.style.display = el.dataset.priority === priority ? 'block' : 'none';
      });
    }