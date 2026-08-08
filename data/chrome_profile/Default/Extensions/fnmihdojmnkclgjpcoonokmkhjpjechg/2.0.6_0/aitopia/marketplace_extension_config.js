window.__AITOPIA_API_BASE_URL__ = 'https://aitopia.ai/';
window.API_BASE_URL = window.__AITOPIA_API_BASE_URL__;
window.__AITOPIA_DOMAIN__ = 'https://aitopia.ai';
window.__AITOPIA_RUNTIME_DOMAIN__ =
  'chrome-extension://fnmihdojmnkclgjpcoonokmkhjpjechg';
(() => {
  var _extBase = window.__AITOPIA_RUNTIME_DOMAIN__;
  // Only run for this extension's own pages
  if (
    _extBase &&
    window.location.protocol === 'chrome-extension:' &&
    window.location.origin !== _extBase
  )
    return;
  var _domain = window.__AITOPIA_DOMAIN__ || 'https://aitopia.ai';
  var _nf = window.fetch.bind(window);
  var _isExtension =
    window.location && window.location.protocol === 'chrome-extension:';

  if (!_isExtension) {
    // External sites: proxy bridge via postMessage → background
    var _pending = {};
    var _rid = 0;
    window.addEventListener('message', function (e) {
      if (e.data && e.data.type === '__aitopia_fetch_res__') {
        var p = _pending[e.data.rid];
        if (p) {
          delete _pending[e.data.rid];
          if (e.data.error) {
            p.reject(new Error(e.data.error));
          } else {
            var st = e.data.status;
            if (!st || st < 200 || st > 599) st = e.data.ok ? 200 : 502;
            var ct = e.data.contentType || 'application/json';
            p.resolve(
              new Response(e.data.body, {
                status: st,
                statusText: e.data.ok ? 'OK' : 'Error',
                headers: {
                  'Content-Type': ct
                }
              })
            );
          }
        }
      }
    });

    function _proxyFetch(url, opts) {
      var id = ++_rid;
      return new Promise(function (ok, fail) {
        _pending[id] = {
          resolve: ok,
          reject: fail
        };
        window.postMessage(
          {
            type: '__aitopia_fetch_req__',
            rid: id,
            url: url,
            options: {
              method: (opts && opts.method) || 'GET',
              headers: (opts && opts.headers) || {},
              credentials: (opts && opts.credentials) || undefined
            }
          },
          'location.origin'
        );
      });
    }
    window.fetch = async function (input, init) {
      try {
        var u = typeof input === 'string' ? input : input && input.url;
        if (typeof u === 'string') {
          var ce = window.__AITOPIA_RUNTIME_DOMAIN__ || '';
          if (ce && u.startsWith(ce)) u = u.slice(ce.length);
          if (u.startsWith('/') && !u.startsWith('//')) {
            u = _domain + u;
          }
          if (u.indexOf(_domain) !== -1) {
            return await _proxyFetch(u, init);
          }
        }
      } catch (e) {}
      return await _nf(input, init);
    };
  } else {
    // Extension pages (iframe): rewrite relative URLs to aitopia.ai, use native fetch
    window.fetch = async function (input, init) {
      try {
        var u = typeof input === 'string' ? input : input && input.url;
        if (typeof u === 'string') {
          var ce = window.__AITOPIA_RUNTIME_DOMAIN__ || '';
          if (ce && u.startsWith(ce)) u = u.slice(ce.length);
          if (u.startsWith('/') && !u.startsWith('//')) {
            u = _domain + u;
          }
          if (u !== (typeof input === 'string' ? input : input && input.url)) {
            return await _nf(u, init);
          }
        }
      } catch (e) {}
      return await _nf(input, init);
    };
  }
})();
(() => {
  var _extBase = window.__AITOPIA_RUNTIME_DOMAIN__;
  // Only run for this extension's own pages
  if (
    _extBase &&
    window.location.protocol === 'chrome-extension:' &&
    window.location.origin !== _extBase
  )
    return;
  var _f = window.fetch;
  // Expose the native fetch so debug code (or critical loaders) can bypass
  // the wrapper below if it ever swallows responses.
  window.__AITOPIA_NATIVE_FETCH__ = _f;
  window.fetch = async function (input, init) {
    var _u =
      typeof input === 'string' ? input : (input && input.url) || '<unknown>';
    var r = await _f.call(this, input, init);
    try {
      // Refresh extension key after logout
      if (_u.indexOf('/auth/logout') !== -1) {
        try {
          chrome.runtime.sendMessage({ fn: 'action.uuid' });
        } catch (_) {}
      }
      // Intercept OAuth: open Google/Apple login in new tab
      if (
        _u.indexOf('/auth/google/get_url') !== -1 ||
        _u.indexOf('/auth/apple/get_url') !== -1
      ) {
        try {
          var data = await r.clone().json();
          var authUri =
            (data.data && data.data.google_auth_uri) ||
            (data.data && data.data.apple_auth_uri);
          if (authUri) {
            window.open(authUri, '_blank');
          }
        } catch (_) {}
        return r;
      }
      // Rewrite image paths inside .json responses
      if (_u.indexOf('.json') !== -1) {
        var t = await r.clone().text();
        var fixed = t.replace(
          /(?:"\.?\/|'\.?\/)(agent-images|agent-images-backup|uploads|moltopia|model-icons)\//g,
          function (m, dir) {
            return m[0] + 'https://aitopia.ai/' + dir + '/';
          }
        );
        return new Response(fixed, {
          status: r.status,
          statusText: r.statusText,
          headers: r.headers
        });
      }
    } catch (e) {
      console.log('[fetch-wrap] post-process error:', e, _u);
    }
    return r;
  };
})();
(() => {
  var _extBase = window.__AITOPIA_RUNTIME_DOMAIN__;
  // Only run for this extension's own pages
  if (
    _extBase &&
    window.location.protocol === 'chrome-extension:' &&
    window.location.origin !== _extBase
  )
    return;
  var p = window.location.pathname;
  if (/\/marketplace\/?$/.test(p)) {
    window.location.replace(p.replace(/\/?$/, '/index.html'));
    return;
  }
  // Redirect /?login=success (extension root after login) → marketplace home
  if (
    window.location.protocol === 'chrome-extension:' &&
    p.indexOf('/marketplace/') === -1 &&
    window.location.search.indexOf('login=success') !== -1
  ) {
    // Notify background to refresh uuid/session
    try {
      chrome.runtime.sendMessage({ fn: 'action.uuid' });
    } catch (_) {}
    window.location.replace('/aitopia/marketplace/home.html');
  }
})();
(() => {
  // Intercept navigations to /marketplace/ paths without .html extension
  // and resolve them to proper .html URLs (e.g. /aitopia/marketplace/agent/X.html → /aitopia/marketplace/agent/X.html)
  var _extBase = window.__AITOPIA_RUNTIME_DOMAIN__;
  if (!_extBase) return;
  if (window.location.protocol !== 'chrome-extension:') return;
  // Only run for this extension's own pages — prevent duplicate listeners
  // when multiple extensions are loaded simultaneously
  if (window.location.origin !== _extBase) return;

  function _resolveBarePath(url) {
    try {
      var u = new URL(url, location.origin);
      if (u.pathname.indexOf('/marketplace/') === -1) return null;
      if (/\.html(\?|$)/.test(u.pathname)) return null;
      if (
        /\/(?:js|css|fonts|images|assets|icons|vendor|favicon)\//i.test(
          u.pathname
        )
      )
        return null;
      // Append .html to the last segment
      var resolved = _extBase + u.pathname + '.html' + u.search;
      // console.log('[Config] resolve bare path:', url, '→', resolved);
      return resolved;
    } catch (e) {
      return null;
    }
  }

  // Override Location.prototype.assign
  var _origAssign = Location.prototype.assign;
  Location.prototype.assign = function (url) {
    var resolved = _resolveBarePath(url);
    return _origAssign.call(this, resolved || url);
  };

  // Override Location.prototype.replace
  var _origReplace = Location.prototype.replace;
  Location.prototype.replace = function (url) {
    var resolved = _resolveBarePath(url);
    return _origReplace.call(this, resolved || url);
  };

  // Catch window.location.href = '...' via beforeunload + monkey-patched setter
  // Since Location.href setter can't be reliably overridden, use a navigation event listener
  // to catch and redirect bare marketplace paths on the 'click' of the event loop.
  window.addEventListener('beforeunload', function (e) {
    // Can't prevent here, but we log for debugging
  });

  // Use Navigation API if available (Chrome 102+)
  if (window.navigation) {
    window.navigation.addEventListener('navigate', function (e) {
      if (!e.canIntercept) return;
      try {
        var destUrl = new URL(e.destination.url);
        // Redirect /?login=success (extension root after login) → marketplace home
        if (
          destUrl.pathname.indexOf('/marketplace/') === -1 &&
          destUrl.search.indexOf('login=success') !== -1
        ) {
          // Notify background to refresh uuid/session
          try {
            chrome.runtime.sendMessage({ fn: 'action.uuid' });
          } catch (_) {}
          e.intercept({
            handler: function () {
              window.location.replace(_extBase + '/aitopia/marketplace/home.html');
            }
          });
          return;
        }
      } catch (_) {}
      var resolved = _resolveBarePath(e.destination.url);
      if (resolved) {
        e.intercept({
          handler: function () {
            window.location.replace(resolved);
          }
        });
      }
    });
  }
})();
(() => {
  // Rewrite media src attributes that point to local media dirs → aitopia.ai
  var _ce = window.__AITOPIA_RUNTIME_DOMAIN__ || '';
  // Only run for this extension's own pages
  if (
    _ce &&
    window.location.protocol === 'chrome-extension:' &&
    window.location.origin !== _ce
  )
    return;
  var _mediaDirs =
    /^\/?(?:agent-images|agent-images-backup|uploads|moltopia|model-icons)\//;
  var _domain = 'https://aitopia.ai/';

  function fixSrc(el) {
    var src = el.getAttribute('src');
    if (!src) return;
    // // .mp4 videos: disable autoplay, set preload=metadata, add hover play/pause
    // if (el.tagName === 'VIDEO') {
    //   el.autoplay = false;
    //   el.removeAttribute('autoplay');
    //   el.setAttribute('preload', 'metadata');
    //   el.pause();
    //   console.log(src, el);
    //   if (!el.__aitopiaHover) {
    //     el.__aitopiaHover = true;
    //     el.addEventListener('mouseover', function () {
    //       el.play();
    //     });
    //     el.addEventListener('mouseout', function () {
    //       el.pause();
    //     });
    //   }
    // }
    // Strip chrome-extension://ID/ prefix if present
    if (_ce && src.indexOf(_ce) === 0) src = src.slice(_ce.length);
    // Strip leading /marketplace/
    src = src.replace(/^\/marketplace\//, '/');
    // Strip leading slash
    var bare = src.replace(/^\//, '');
    if (_mediaDirs.test(bare)) {
      var fullUrl = _domain + bare;
      el.setAttribute('src', fullUrl);
    }
  }

  // Fix existing elements
  document.querySelectorAll('img[src],source[src],video[src]').forEach(fixSrc);

  // Watch for dynamically added/changed elements
  var obs = new MutationObserver(function (mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var m = mutations[i];
      if (m.type === 'attributes' && m.attributeName === 'src') {
        fixSrc(m.target);
      }
      if (m.type === 'childList') {
        for (var j = 0; j < m.addedNodes.length; j++) {
          var node = m.addedNodes[j];
          if (node.nodeType === 1) {
            if (node.hasAttribute && node.hasAttribute('src')) fixSrc(node);
            if (node.querySelectorAll) {
              node
                .querySelectorAll('img[src],source[src],video[src]')
                .forEach(fixSrc);
            }
          }
        }
      }
    }
  });
  obs.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src']
  });
})();
(() => {
  // Theme sync: iframe ↔ extension parent
  var _rt = window.__AITOPIA_RUNTIME_DOMAIN__;
  // Only run for this extension's own pages
  if (
    _rt &&
    window.location.protocol === 'chrome-extension:' &&
    window.location.origin !== _rt
  )
    return;
  // 1) When NavbarComponent.toggleTheme runs inside iframe, notify parent
  function _notifyParentTheme() {
    try {
      var isDark = document.documentElement.classList.contains('dark');
      var theme = isDark ? 'dark' : 'light';
      if (window.parent && window.parent !== window) {
        var _extId = (_rt || '').replace('chrome-extension://', '');
        window.parent.postMessage(
          {
            type: '__aitopia_theme_change__',
            theme: theme,
            extensionId: _extId
          },
          location.origin
        );
      }
    } catch (e) {}
  }
  // Hook into NavbarComponent.toggleTheme after it's defined
  var _hookInterval = setInterval(function () {
    if (window.NavbarComponent && window.NavbarComponent.toggleTheme) {
      var _origToggle = window.NavbarComponent.toggleTheme;
      window.NavbarComponent.toggleTheme = function () {
        _origToggle.apply(this, arguments);
        _notifyParentTheme();
      };
      // Also update the global alias
      if (window.toggleTheme) {
        window.toggleTheme = window.NavbarComponent.toggleTheme;
      }
      clearInterval(_hookInterval);
    }
  }, 100);
  setTimeout(function () {
    clearInterval(_hookInterval);
  }, 10000);

  // 2) Listen for theme changes from extension parent
  window.addEventListener('message', function (e) {
    if (e.data && e.data.type === '__aitopia_theme_change__' && e.data.theme) {
      var theme = e.data.theme;
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      }
      if (typeof window.injectHeaderCss === 'function')
        window.injectHeaderCss();
    }
  });
})();
(() => {
  var _rt = window.__AITOPIA_RUNTIME_DOMAIN__;
  if (!_rt) return;
  // Only run for this extension's own pages
  if (
    window.location.protocol === 'chrome-extension:' &&
    window.location.origin !== _rt
  )
    return;

  function _hasAitopia() {
    return (
      !!(document.body && document.body.classList.contains('aifnmjmchg')) ||
      !!document.querySelector('[data-marketplace-home]') ||
      !!document.querySelector('.aifnmjmchg')
    );
  }

  function _load() {
    if (document.querySelector('.aifnmjmchg [data-bottom-tabs]')) {
      document.querySelector('.aifnmjmchg [data-bottom-tabs]').remove();
    }
    if (
      document.querySelector('#navbar-container [data-home-redirect-applied]')
    ) {
      document
        .querySelector('#navbar-container [data-home-redirect-applied]')
        .remove();
    }
    if (!_hasAitopia()) return;
    if (document.querySelector('script[data-aifnmjmchg-router]')) return;
    if (!window.__aitopiaRouterLoaded) {
      window.__aitopiaRouterLoaded = true;
      var _routerUrl = _rt + '/aitopia/marketplace/js/inline/router.js';
      import(/* @vite-ignore */ _routerUrl).catch(function () {});
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _load);
  } else {
    _load();
  }
  var _obs = new MutationObserver(function () {
    if (_hasAitopia()) {
      _load();
      _obs.disconnect();
    }
  });
  _obs.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
  setTimeout(function () {
    _obs.disconnect();
  }, 10000);
})();
