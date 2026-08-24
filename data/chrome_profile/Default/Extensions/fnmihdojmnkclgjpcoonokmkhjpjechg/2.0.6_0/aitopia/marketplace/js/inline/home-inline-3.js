// Wire up video play/pause for static hero gallery videos
    document.addEventListener('DOMContentLoaded', function() {
      var hero = document.querySelector('.flex.gap-3.overflow-x-auto');
      if (hero) window.AitopiaLazyMedia?.observe(hero);
    });