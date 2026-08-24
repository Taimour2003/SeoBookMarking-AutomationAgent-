(function () {
  // Guard: only run when extension runtime domain is available
  var _extBase = window.__AITOPIA_RUNTIME_DOMAIN__;
  if (!_extBase) return;
  // Extract extension ID from runtime domain for ownership checks
  var _extId = _extBase.replace('chrome-extension://', '');
  var BASE = _extBase + '/aitopia/marketplace/';
  function hasAitopiaContext() {
    return (
      !!document.querySelector('[data-marketplace-home]') ||
      !!document.querySelector('.aifnmjmchg-marketplace')
    );
  }
  // Check if current page belongs to this extension instance
  function _isOwnContext() {
    // Extension page: origin must match our extension ID
    if (window.location.protocol === 'chrome-extension:') {
      return window.location.origin === _extBase;
    }
    // Inject mode (external site): always own context
    return true;
  }
  var DIRS = new Set([
    'agent',
    'category',
    'docs',
    'store',
    'shopify',
    'agenticai'
  ]);
  var KNOWN = new Set([
    'creations',
    'outputs',
    'feed',
    'search',
    'profile',
    'settings',
    'agents',
    'models',
    'discover',
    'login',
    'register',
    'pricing',
    'earnings',
    'developers',
    'create',
    'design',
    'social',
    'assistant',
    'app-builder',
    'app-studio',
    'app-runner',
    'appstore',
    'downloads',
    'moltopia',
    'uap',
    'app',
    'output',
    'model',
    'plugin-terms',
    'privacy-policy',
    'terms-conditions',
    'terms-policies',
    'agent-run',
    'agent-chat',
    'docs'
  ]);
  var SPECIALS = {
    creations: 'outputs',
    'settings/profile': 'settings-profile'
  };
  // KNOWN pages whose sub-segments become ?type= query params
  var KNOWN_TYPE_PAGES = new Set(['models', 'agents', 'search']);

  // Resolve any URL pathname+search into an absolute chrome-extension marketplace URL.
  // Returns null if the path is not a marketplace route.
  function resolveMarketplacePath(pathname, search) {
    var p = pathname || '/';
    var qs = search || '';
    console.log(pathname, search);
    // Asset links — not a navigable route
    if (/\/(?:js|css|fonts|images|assets|icons|vendor|favicon)\//i.test(p))
      return null;

    if (pathname.endsWith(search)) {
      p = pathname.replace(search, '');
    }

    // Already a resolved marketplace .html — no need to transform
    if ((p.startsWith('/marketplace/') || p.startsWith('/aitopia/marketplace/')) && /\.html(\?|$)/.test(p))
      return _extBase + (p.startsWith('/aitopia/') ? '' : '/aitopia') + p + qs;

    // Strip /marketplace/ prefix to get the bare route
    var bare = p
      .replace(/^\/marketplace\/?/, '/')
      .replace(/\.html$/, '')
      .replace(/\/$/, '');

    // /u/username → profile page
    if (bare.startsWith('/u/')) {
      var username = bare.substring(3).split('?')[0];
      return (
        BASE +
        'profile.html?username=' +
        encodeURIComponent(username) +
        (qs ? qs.replace('?', '&') : '')
      );
    }

    // Get first segment for route matching
    var raw = bare.replace(/^\//, '');
    if (!raw) return BASE + 'home.html' + qs;

    // Apply SPECIALS mapping (e.g. creations → outputs, settings/profile → settings-profile)
    if (SPECIALS[raw]) return BASE + SPECIALS[raw] + '.html' + qs;
    var parts = raw.split('/');
    if (SPECIALS[parts[0]]) parts[0] = SPECIALS[parts[0]];
    var seg = parts[0].split('?')[0];

    // /agents/slug → /agent/slug
    if (seg === 'agents' && parts.length > 1) parts[0] = 'agent';
    seg = parts[0].split('?')[0];

    // /store → home
    if (seg === 'store' && parts.length === 1) return BASE + 'home.html' + qs;

    // Directory-based routes (agent/slug, category/sub, etc.)
    if (DIRS.has(seg) && parts.length > 1) {
      return BASE + parts.join('/') + '.html' + qs;
    }
    // Known pages with type sub-segment: /models/video → models.html?type=video
    if (KNOWN_TYPE_PAGES.has(seg) && parts.length === 2) {
      return (
        BASE +
        seg +
        '.html?type=' +
        encodeURIComponent(parts[1]) +
        (qs ? qs.replace('?', '&') : '')
      );
    }
    // Known single-page routes
    if (KNOWN.has(seg)) {
      return BASE + parts.join('-') + '.html' + qs;
    }
    // Dash-joined known pages (e.g. settings-profile → settings is KNOWN)
    if (
      parts.length === 1 &&
      seg.includes('-') &&
      KNOWN.has(seg.split('-')[0])
    ) {
      return BASE + seg + '.html' + qs;
    }
    // Single segment → owner page
    if (parts.length === 1) {
      return (
        BASE +
        'owner.html?owner=' +
        encodeURIComponent(parts[0]) +
        (qs ? qs.replace('?', '&') : '')
      );
    }
    // Two or more segments → owner/model page
    // parts[0] = owner, parts[1..] joined with "/" = model id
    // (model ids can be nested, e.g. bytedance/seedance-2.0/fast/text-to-video)
    if (parts.length >= 2) {
      return (
        BASE +
        'model.html?owner=' +
        encodeURIComponent(parts[0]) +
        '&model=' +
        encodeURIComponent(parts.slice(1).join('/')) +
        (qs ? qs.replace('?', '&') : '')
      );
    }
    // Fallback: join with dashes
    return BASE + parts.join('-') + '.html' + qs;
  }

  // Intercept all link clicks within marketplace pages
  document.addEventListener(
    'click',
    function (e) {
      if (!_isOwnContext()) return;
      if (!hasAitopiaContext()) return;
      var el = e.target;
      while (el && el.tagName !== 'A') el = el.parentElement;
      if (!el || !el.href) return;
      try {
        console.log(el.getAttribute('href'));
        var url = new URL(el.href);

        // /payment links → break out of iframe regardless of origin
        var rawHref = el.getAttribute('href') || el.href;
        if (
          rawHref.indexOf('/payment') !== -1 ||
          url.pathname.indexOf('/payment') !== -1
        ) {
          e.preventDefault();
          e.stopPropagation();
          var paymentUrl = el.href;
          console.log('[Router] payment → parent:', paymentUrl);
          if (window.parent && window.parent !== window) {
            window.parent.postMessage(
              {
                type: '__aitopia_navigate__',
                url: paymentUrl,
                extensionId: _extId
              },
              '*'
            );
          } else {
            window.location.href = paymentUrl;
          }
          return;
        }

        // Inject mode (non-extension page): open full_screen with marketplace page
        var _isInject = window.location.protocol !== 'chrome-extension:';
        if (_isInject) {
          if (!el?.closest('.aifnmjmchg-marketplace,[data-marketplace-home]'))
            return;
          var injectResolved = resolveMarketplacePath(rawHref, url.search);
          if (!injectResolved) return;
          e.preventDefault();
          e.stopPropagation();
          // Extract marketplace path from resolved chrome-extension:// URL
          var mPath = injectResolved;
          var extIdx = mPath.indexOf('/marketplace/');
          if (extIdx !== -1) mPath = mPath.substring(extIdx);
          var fullUrl =
            _extBase +
            '/src/html/full_screen.html?marketplace=' +
            encodeURIComponent(mPath);
          window.open(fullUrl, '_blank');
          return;
        }

        // Only intercept same-origin or extension-origin links
        var isExtOrigin = el.href.indexOf(_extBase) === 0;
        var isSameOrigin = url.origin === location.origin;
        if (!isExtOrigin && !isSameOrigin) return;
        if (!el?.closest('.aifnmjmchg-marketplace,[data-marketplace-home]'))
          return;
        let custom_url = rawHref;
        var resolved = resolveMarketplacePath(custom_url, url.search);
        e.preventDefault();
        e.stopPropagation();
        console.log('[Router] click:', el.href, '→', resolved);
        if (!resolved) return;

        window.location.href = resolved;
      } catch (err) {
        e.preventDefault();
        e.stopPropagation();
        console.error(err);
      }
    },
    true
  );
  if (window?.location?.origin?.indexOf('-extension://') !== -1) {
    // Also intercept programmatic navigation (pushState/replaceState)
    var _pushState = history.pushState;
    var _replaceState = history.replaceState;
    function interceptHistoryNav(original) {
      return function (state, title, url) {
        if (!_isOwnContext()) return original.call(this, state, title, url);
        if (!hasAitopiaContext()) return original.call(this, state, title, url);
        if (typeof url !== 'string')
          return original.call(this, state, title, url);
        try {
          var u = new URL(url, location.origin);
          var resolved = resolveMarketplacePath(u.pathname, u.search);
          if (!resolved) return original.call(this, state, title, url);
          console.log('[Router] pushState/replaceState:', url, '→', resolved);

          if (resolved.indexOf('/payment') !== -1) {
            if (window.parent && window.parent !== window) {
              window.parent.postMessage(
                {
                  type: '__aitopia_navigate__',
                  url: resolved,
                  extensionId: _extId
                },
                '*'
              );
              return;
            }
          }

          window.location.href = resolved;
          return;
        } catch (err) {}
        return original.call(this, state, title, url);
      };
    }
    history.pushState = interceptHistoryNav(_pushState);
    history.replaceState = interceptHistoryNav(_replaceState);

    // Legacy: handle hash-based URLs for backward compatibility
    function handleHash() {
      if (!_isOwnContext()) return;
      if (!hasAitopiaContext()) return;
      var raw = location.hash.replace(/^#\/?/, '').replace(/\/$/, '');
      if (!raw) return;
      var qIdx = raw.indexOf('?');
      var hash = qIdx === -1 ? raw : raw.substring(0, qIdx);
      var qs = qIdx === -1 ? '' : '?' + raw.substring(qIdx + 1);
      var resolved = resolveMarketplacePath('/marketplace/' + hash, qs);
      if (resolved) {
        console.log('[Router] hash:', location.hash, '→', resolved);
        location.replace(resolved);
      }
    }
    if (location.hash && location.hash.length > 2) handleHash();
    window.addEventListener('hashchange', handleHash);
  }
})();
