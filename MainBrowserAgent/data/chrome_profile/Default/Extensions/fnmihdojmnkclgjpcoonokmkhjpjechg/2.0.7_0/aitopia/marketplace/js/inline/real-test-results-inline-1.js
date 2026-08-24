function openModal(src) {
      const modalImg = document.getElementById('modalImage');
      if (modalImg) modalImg.src = src;
      document.getElementById('imageModal')?.classList.add('active');
    }
    function closeModal() {
      document.getElementById('imageModal')?.classList.remove('active');
    }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });