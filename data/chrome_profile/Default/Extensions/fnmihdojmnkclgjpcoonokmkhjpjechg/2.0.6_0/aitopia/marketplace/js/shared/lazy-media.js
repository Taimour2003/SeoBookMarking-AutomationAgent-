/**
 * Aitopia Lazy Media
 *
 * Config: window.AitopiaLazyMedia.loadPlay
 *   true  → videos autoplay when visible (IntersectionObserver), no hover needed
 *   false → hover-to-play for card videos, visibility-based for standalone videos (default)
 *
 * 1. Images: native loading="lazy" — zero JS needed
 * 2. Video cards [data-video-src]:
 *    - loadPlay=true:  autoplay when scrolled into view, pause when out
 *    - loadPlay=false: hover to play, pause on leave
 * 3. Standalone <video> (hero etc): visibility-based play/pause (both modes)
 */
(function () {
  'use strict';

  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var videoObserved = new WeakSet();
  var hoverBound = new WeakSet();
  var autoplayBound = new WeakSet();
  var loadPlay = true;

  // --- Visibility observer for standalone <video> elements ---
  var visObserver = new IntersectionObserver(function (entries) {
    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      var video = entry.target;
      if (prefersReducedMotion) { video.pause(); continue; }
      if (entry.isIntersecting) {
        video.play().catch(function () {});
      } else {
        video.pause();
      }
    }
  }, { threshold: 0.25 });

  // --- Autoplay observer for [data-video-src] cards (loadPlay=true) ---
  var cardAutoplayObserver = new IntersectionObserver(function (entries) {
    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      var card = entry.target;
      if (prefersReducedMotion) continue;
      if (entry.isIntersecting) {
        startCardVideo(card);
      } else {
        stopCardVideo(card);
      }
    }
  }, { rootMargin: '200px', threshold: 0.01 });

  function startCardVideo(card) {
    var src = card.dataset.videoSrc;
    if (!src) return;
    var video = card.querySelector('video');
    if (video) {
      video.loop = true;
      video.play().catch(function () {});
      hidePlayIcon(card);
      return;
    }
    // Create video dynamically
    video = document.createElement('video');
    video.className = 'w-full h-full object-cover absolute inset-0 pointer-events-none';
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = src;
    video.style.borderRadius = 'inherit';
    card.insertBefore(video, card.firstChild);
    video.play().catch(function () {});
    hidePlayIcon(card);
  }

  function stopCardVideo(card) {
    var video = card.querySelector('video');
    if (video) video.pause();
    showPlayIcon(card);
  }

  // --- Hover-to-play for [data-video-src] containers (loadPlay=false) ---
  function bindHoverVideo(container) {
    var cards = container.querySelectorAll('[data-video-src]');
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      if (hoverBound.has(card)) continue;
      hoverBound.add(card);
      card.addEventListener('mouseenter', onCardEnter);
      card.addEventListener('mouseleave', onCardLeave);
    }
  }

  // --- Autoplay bind for [data-video-src] containers (loadPlay=true) ---
  function bindAutoplayVideo(container) {
    var cards = container.querySelectorAll('[data-video-src]');
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      if (autoplayBound.has(card)) continue;
      autoplayBound.add(card);
      cardAutoplayObserver.observe(card);
    }
  }

  function onCardEnter(e) {
    if (prefersReducedMotion) return;
    startCardVideo(e.currentTarget);
  }

  function onCardLeave(e) {
    stopCardVideo(e.currentTarget);
  }

  function hidePlayIcon(card) {
    var icons = card.querySelectorAll('.pointer-events-none');
    for (var i = 0; i < icons.length; i++) {
      if (icons[i].querySelector('svg')) {
        icons[i].style.display = 'none';
        break;
      }
    }
  }

  function showPlayIcon(card) {
    var icons = card.querySelectorAll('.pointer-events-none');
    for (var i = 0; i < icons.length; i++) {
      if (icons[i].querySelector('svg')) {
        icons[i].style.display = '';
        break;
      }
    }
  }

  // --- Public API ---
  function observe(container) {
    if (!container) return;

    if (loadPlay) {
      bindAutoplayVideo(container);
    } else {
      bindHoverVideo(container);
    }

    // Standalone videos (not inside data-video-src cards)
    var videos = container.querySelectorAll('video');
    for (var i = 0; i < videos.length; i++) {
      var v = videos[i];
      if (v.closest('[data-video-src]')) continue;
      if (videoObserved.has(v)) continue;
      videoObserved.add(v);
      v.pause();
      visObserver.observe(v);
    }
  }

  function observeOne(el) {
    if (!el) return;
    if (el.dataset && el.dataset.videoSrc) {
      if (loadPlay) {
        if (!autoplayBound.has(el)) {
          autoplayBound.add(el);
          cardAutoplayObserver.observe(el);
        }
      } else {
        if (!hoverBound.has(el)) {
          hoverBound.add(el);
          el.addEventListener('mouseenter', onCardEnter);
          el.addEventListener('mouseleave', onCardLeave);
        }
      }
    } else if (el.tagName === 'VIDEO' && !videoObserved.has(el)) {
      if (el.closest('[data-video-src]')) return;
      videoObserved.add(el);
      el.pause();
      visObserver.observe(el);
    }
  }

  window.AitopiaLazyMedia = {
    observe: observe,
    observeOne: observeOne,
    get loadPlay() { return loadPlay; },
    set loadPlay(val) { loadPlay = Boolean(val); }
  };
})();
