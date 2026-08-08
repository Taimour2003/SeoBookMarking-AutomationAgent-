let currentSlide = 1;
    const totalSlides = 20;
    const slides = document.querySelectorAll('.slide');

    function updateSlide() {
      slides.forEach((slide, index) => {
        const slideNum = index + 1;
        slide.classList.remove('active', 'prev');
        if (slideNum === currentSlide) {
          slide.classList.add('active');
        } else if (slideNum < currentSlide) {
          slide.classList.add('prev');
        }
      });

      const currentSlideEl = document.getElementById('currentSlide');
      if (currentSlideEl) currentSlideEl.textContent = currentSlide;
      const progressBarEl = document.getElementById('progressBar');
      if (progressBarEl) progressBarEl.style.width = `${(currentSlide / totalSlides) * 100}%`;
    }

    function nextSlide() {
      if (currentSlide < totalSlides) {
        currentSlide++;
        updateSlide();
      }
    }

    function prevSlide() {
      if (currentSlide > 1) {
        currentSlide--;
        updateSlide();
      }
    }

    function goToSlide(num) {
      if (num >= 1 && num <= totalSlides) {
        currentSlide = num;
        updateSlide();
      }
    }

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        nextSlide();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevSlide();
      } else if (e.key === 'Home') {
        e.preventDefault();
        goToSlide(1);
      } else if (e.key === 'End') {
        e.preventDefault();
        goToSlide(totalSlides);
      } else if (e.key >= '1' && e.key <= '9') {
        goToSlide(parseInt(e.key));
      }
    });

    // Touch/swipe support
    let touchStartX = 0;
    let touchEndX = 0;

    document.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    });

    document.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      const diff = touchStartX - touchEndX;
      if (Math.abs(diff) > 50) {
        if (diff > 0) {
          nextSlide();
        } else {
          prevSlide();
        }
      }
    });

    // CSP-safe event delegation
    document.addEventListener('click', function(e) {
      const el = e.target.closest('[data-action]');
      if (!el) return;
      const action = el.dataset.action;
      if (action === 'nextSlide') nextSlide();
      else if (action === 'prevSlide') prevSlide();
      else if (action === 'goToSlide') goToSlide(parseInt(el.dataset.param));
    });

    // Initialize
    const totalSlidesEl = document.getElementById('totalSlides');
    if (totalSlidesEl) totalSlidesEl.textContent = totalSlides;
    updateSlide();