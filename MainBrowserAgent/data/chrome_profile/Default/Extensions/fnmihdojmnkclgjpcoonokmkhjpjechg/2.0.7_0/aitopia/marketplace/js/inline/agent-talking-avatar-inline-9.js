document.addEventListener('click', (e) => {
  const shareMenu = document.getElementById('agent-share-menu');
  if (shareMenu && !shareMenu.contains(e.target)) {
    const dropdown = shareMenu.querySelector('[role="menu"]');
    if (dropdown) dropdown.classList.add('hidden');
  }
  const moreMenu = document.getElementById('agent-more-menu');
  if (moreMenu && !moreMenu.contains(e.target)) {
    const dropdown = moreMenu.querySelector('[data-agent-more-dropdown]');
    if (dropdown) dropdown.classList.add('hidden');
  }
});

(() => {
  const shareMenu = document.getElementById('agent-share-menu');
  if (!shareMenu) return;
  const toggle = shareMenu.querySelector('[data-agent-share-toggle]');
  const dropdown = shareMenu.querySelector('[role="menu"]');
  if (!toggle || !dropdown) return;

  const pageUrl = window.__AITOPIA_DOMAIN__ || 'https://aitopia.ai' + window.location.pathname;
  const shareText = 'Check out this agent on AITOPIA: ' + pageUrl;

  toggle.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    const isOpen = !dropdown.classList.contains('hidden');
    dropdown.classList.toggle('hidden', isOpen);
    toggle.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
  });

  shareMenu.querySelectorAll('[data-agent-share]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const kind = btn.getAttribute('data-agent-share');
      dropdown.classList.add('hidden');
      toggle.setAttribute('aria-expanded', 'false');

      if (kind === 'copy') {
        try { await navigator.clipboard.writeText(pageUrl); } catch {}
        return;
      }
      if (kind === 'email') {
        window.location.href = 'mailto:?subject=' + encodeURIComponent('AITOPIA Agent') + '&body=' + encodeURIComponent(pageUrl);
        return;
      }
      if (kind === 'x') {
        window.open('https://twitter.com/intent/tweet?url=' + encodeURIComponent(pageUrl) + '&text=' + encodeURIComponent(shareText), '_blank', 'width=550,height=420');
        return;
      }
      if (kind === 'facebook') {
        window.open('https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(pageUrl), '_blank', 'width=550,height=420');
        return;
      }
      if (kind === 'linkedin') {
        window.open('https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(pageUrl), '_blank', 'width=550,height=420');
        return;
      }
      if (kind === 'whatsapp') {
        window.open('https://wa.me/?text=' + encodeURIComponent(shareText), '_blank');
      }
    });
  });
})();

let heroMediaIndex = 0;
const heroThumbs = document.querySelectorAll('.hero-thumb');

function selectHeroMedia(thumb, index) {
  heroMediaIndex = index;
  const desktopContainer = document.getElementById('hero-media-main');
  const mobileContainer = document.getElementById('hero-media-main-mobile');

  const type = thumb.dataset.type;
  const url = thumb.dataset.url;

  if (desktopContainer) {
    if (type === 'video') {
      desktopContainer.innerHTML = '<video src="' + url + '" class="w-[439px] h-[247px] object-cover rounded-2xl" autoplay muted loop playsinline></video>';
    } else {
      desktopContainer.innerHTML = '<img src="' + url + '" alt="" class="w-[439px] h-[247px] object-cover rounded-2xl">';
    }
  }

  if (mobileContainer) {
    if (type === 'video') {
      mobileContainer.innerHTML = '<video src="' + url + '" class="w-full h-full object-cover" autoplay muted loop playsinline></video>';
    } else {
      mobileContainer.innerHTML = '<img src="' + url + '" alt="" class="w-full h-full object-cover">';
    }
  }

  heroThumbs.forEach((t, i) => {
    t.classList.toggle('ring-primary/90', i === index);
    t.classList.toggle('ring-transparent', i !== index);
  });
}

function heroMediaPrev() {
  if (heroThumbs.length === 0) return;
  heroMediaIndex = (heroMediaIndex - 1 + heroThumbs.length) % heroThumbs.length;
  selectHeroMedia(heroThumbs[heroMediaIndex], heroMediaIndex);
}

function heroMediaNext() {
  if (heroThumbs.length === 0) return;
  heroMediaIndex = (heroMediaIndex + 1) % heroThumbs.length;
  selectHeroMedia(heroThumbs[heroMediaIndex], heroMediaIndex);
}

(() => {
  const slider = document.getElementById('preview-size-slider');
  const gridContainer = document.querySelector('[data-history-grid-view]');
  const listContainer = document.querySelector('[data-history-list-view]');
  if (!slider) return;

  function updateSize(value) {
    // Grid view: Slider controls number of columns
    // 0-33: 4 cols, 34-66: 3 cols, 67-100: 2 cols
    if (gridContainer) {
      let cols;
      if (value < 34) cols = 4;
      else if (value < 67) cols = 3;
      else cols = 2;
      gridContainer.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
    }

    // List view: Two sizes
    // 0-50 (left half): Equal 50/50 split
    // 51-100 (right half): Large image, small info panel (280px)
    if (listContainer) {
      const isEqualSplit = value <= 50;
      // Media: flex-basis auto (grows) or 50% (equal)
      listContainer.style.setProperty('--list-media-flex', isEqualSplit ? '1' : '1');
      listContainer.style.setProperty('--list-media-basis', isEqualSplit ? '50%' : 'auto');
      // Info: flex-basis 50% (equal) or 280px (fixed)
      listContainer.style.setProperty('--list-info-flex', isEqualSplit ? '1' : '0');
      listContainer.style.setProperty('--list-info-basis', isEqualSplit ? '50%' : '280px');
    }
  }

  slider.addEventListener('input', (e) => updateSize(parseInt(e.target.value, 10)));
  updateSize(parseInt(slider.value, 10));
})();

// View Toggle (List / Grid)
(() => {
  const listBtn = document.querySelector('[data-view-mode="list"]');
  const gridBtn = document.querySelector('[data-view-mode="grid"]');
  const listView = document.querySelector('[data-history-list-view]');
  const gridView = document.querySelector('[data-history-grid-view]');
  if (!listBtn || !gridBtn) return;

  function setView(mode) {
    if (mode === 'list') {
      listBtn.classList.add('active');
      gridBtn.classList.remove('active');
      if (listView) listView.classList.remove('hidden');
      if (gridView) gridView.classList.add('hidden');
    } else {
      gridBtn.classList.add('active');
      listBtn.classList.remove('active');
      if (listView) listView.classList.add('hidden');
      if (gridView) {
        gridView.classList.remove('hidden');
        gridView.classList.add('grid'); // Ensure grid display
      }
    }
    window.dispatchEvent(new CustomEvent('history-view-change', { detail: { mode } }));
  }

  listBtn.addEventListener('click', () => setView('list'));
  gridBtn.addEventListener('click', () => setView('grid'));

  window.__AITOPIA_SET_HISTORY_VIEW__ = setView;
})();