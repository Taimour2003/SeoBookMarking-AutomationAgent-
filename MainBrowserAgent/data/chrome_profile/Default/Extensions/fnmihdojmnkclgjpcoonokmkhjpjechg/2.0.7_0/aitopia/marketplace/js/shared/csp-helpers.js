/**
 * CSP-compliant event handlers.
 * Replaces inline onclick/onerror handlers with delegated listeners
 * using data-* attributes.
 *
 * Supported attributes:
 *   data-toggle-next-hidden  - click toggles .hidden on nextElementSibling
 *   data-fallback="url"      - on img error, set src to fallback URL (once)
 *   data-bg-on-error="color" - on img error, set background color
 *   data-copy-url            - click copies location.href, shows "Copied!" feedback
 *   data-share="twitter|facebook|linkedin|whatsapp|email"
 *       data-share-text="…"  - optional text for twitter/whatsapp/email
 *   data-hero-prev           - click calls heroMediaPrev() (transitions page)
 *   data-hero-next           - click calls heroMediaNext() (transitions page)
 *   data-hero-select="N"     - click calls selectHeroMedia(this, N) (transitions page)
 */
(function () {
  'use strict';

  /* ── Click delegation (single listener on document) ───────────── */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-toggle-next-hidden]');
    if (btn) {
      var next = btn.nextElementSibling;
      if (next) next.classList.toggle('hidden');
    }

    /* Copy current URL */
    var copyBtn = e.target.closest('[data-copy-url]');
    if (copyBtn) {
      navigator.clipboard.writeText(location.href);
      var orig = copyBtn.textContent;
      copyBtn.textContent = 'Copied!';
      setTimeout(function () { copyBtn.textContent = orig; }, 1500);
    }

    /* Social sharing */
    var shareBtn = e.target.closest('[data-share]');
    if (shareBtn) {
      var platform = shareBtn.getAttribute('data-share');
      var text = shareBtn.getAttribute('data-share-text') || document.title;
      var url = location.href;
      var shareUrl;
      switch (platform) {
        case 'twitter':
          shareUrl = 'https://twitter.com/intent/tweet?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(text);
          window.open(shareUrl, '_blank', 'width=550,height=420');
          break;
        case 'facebook':
          shareUrl = 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url);
          window.open(shareUrl, '_blank', 'width=550,height=420');
          break;
        case 'linkedin':
          shareUrl = 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(url);
          window.open(shareUrl, '_blank', 'width=550,height=420');
          break;
        case 'whatsapp':
          shareUrl = 'https://wa.me/?text=' + encodeURIComponent(text + ' ' + url);
          window.open(shareUrl, '_blank');
          break;
        case 'email':
          location.href = 'mailto:?subject=' + encodeURIComponent(text) + '&body=' + encodeURIComponent(url);
          break;
      }
    }

    /* Hero media navigation (transitions page) */
    if (e.target.closest('[data-hero-prev]')) {
      if (typeof heroMediaPrev === 'function') heroMediaPrev();
    }
    if (e.target.closest('[data-hero-next]')) {
      if (typeof heroMediaNext === 'function') heroMediaNext();
    }
    var heroSelect = e.target.closest('[data-hero-select]');
    if (heroSelect) {
      var index = parseInt(heroSelect.getAttribute('data-hero-select'), 10);
      if (typeof selectHeroMedia === 'function') selectHeroMedia(heroSelect, index);
    }
  });

  /* ── Image error handling (one-time per element) ──────────────── */
  document.addEventListener('error', function (e) {
    var el = e.target;
    if (el.tagName !== 'IMG') return;

    /* data-fallback: swap src once */
    var fallback = el.getAttribute('data-fallback');
    if (fallback) {
      el.removeAttribute('data-fallback'); // prevent infinite loop
      el.src = fallback;
      return;
    }

    /* data-bg-on-error: set background color */
    var bg = el.getAttribute('data-bg-on-error');
    if (bg) {
      el.removeAttribute('data-bg-on-error');
      el.style.background = bg;
    }
  }, true); // useCapture: error doesn't bubble, must capture
})();
