
    
    function clearCacheOnAuth() {
      try { window.AitopiaCache?.clearUserData?.(); } catch {}
      try { sessionStorage.removeItem('aitopia_user_profile'); } catch {}
      try { sessionStorage.removeItem('aitopia_user_credits'); } catch {}
    }

    function setUrlCookie() {
      const currentPath = window.location.pathname;
      const unListingPages = ["pricing", "login", "register"];
      let isUnlistedPage = false;
      unListingPages.forEach((item) => {
        if (currentPath.indexOf(`/${item}`) !== -1) {
          isUnlistedPage = true;
        }
      });

      // If on login/register/pricing page, don't overwrite an existing aitopia_last_url cookie
      if (isUnlistedPage) {
        const existing = document.cookie.split('; ').find(c => c.startsWith('aitopia_last_url='));
        if (existing) return; // keep the previously set value (e.g. from aitopia.ai)
      }

      const cookieValue = isUnlistedPage ? window.location.origin : window.location.href;

      const expires = new Date(Date.now() + 3600000).toUTCString(); // 1 hour
      document.cookie = `aitopia_last_url=${encodeURIComponent(cookieValue)}; expires=${expires}; path=/; Secure; SameSite=None; Domain=.aitopia.ai`;
    }
    
    function getCookie(name) {
      if (typeof document === "undefined") return null;
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop().split(";").shift();
      return null;
    }
    
    let return_url = getCookie("aitopia_last_url")
    if (!return_url) return_url = "/";
    return_url = decodeURIComponent(return_url);
    return_url += (return_url.indexOf("=success") !== -1 ? '' : ((return_url.indexOf("?") !== -1 ? "&" : '?') + "register=success"));

    (async function checkAuth() {
      try {
        const res = await fetch('https://aitopia.ai/auth/me', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          const user = data?.data?.user;
          if (user && !Array.isArray(user) && (user.email)) {
            window.location.href = return_url;
          }
        }
      } catch (e) {}
      setUrlCookie()
    })();

    function showError(msg) {
      const errEl = document.getElementById('errorMessage');
      const sucEl = document.getElementById('successMessage');
      if (errEl) { errEl.textContent = msg; errEl.classList.remove('hidden'); }
      if (sucEl) sucEl.classList.add('hidden');
    }

    function showSuccess(msg) {
      const sucEl = document.getElementById('successMessage');
      const errEl = document.getElementById('errorMessage');
      if (sucEl) { sucEl.textContent = msg; sucEl.classList.remove('hidden'); }
      if (errEl) errEl.classList.add('hidden');
    }

    function isValidEmail(email) {
      // Requires: local@domain.tld — domain must have a dot and TLD >= 2 chars
      return /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(email);
    }

    async function handleEmailRegister(e) {
      e.preventDefault();
      const btn = document.getElementById('submitBtn');
      const email = (document.getElementById('email')?.value || '').trim();
      const password = document.getElementById('password')?.value || '';
      const password1 = document.getElementById('password1')?.value || '';
      const agree = document.getElementById('agree')?.checked;

      if (!isValidEmail(email)) {
        showError('Please enter a valid email address (e.g. name@example.com)');
        return;
      }

      if (password !== password1) {
        showError('Passwords do not match');
        return;
      }

      if (!agree) {
        showError('Please agree to the terms');
        return;
      }

      btn.disabled = true;
      btn.textContent = 'Creating account...';

      try {
        const res = await fetch('https://aitopia.ai/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email, password, password1, agree })
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Registration failed');

        if (data.status === 'error') throw new Error(data.message || 'Registration failed');

        clearCacheOnAuth();
        showSuccess('Account created! Redirecting...');
        setTimeout(() => window.location.href = return_url, 800);
      } catch (err) {
        showError(err.message);
        } finally {
        btn.disabled = false;
        btn.textContent = 'Create account';
      }
    }

    async function handleGoogleSignup() {
      try {
        const res = await fetch('https://aitopia.ai/auth/google/get_url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include'
        });
        const data = await res.json();
        if (data.data?.google_auth_uri) {
          window.location.href = data.data.google_auth_uri;
        } else {
          showError('Could not get Google signup URL');
        }
      } catch (err) {
        showError('Google signup failed');
      }
    }

    async function handleAppleSignup() {
      try {
        const res = await fetch('https://aitopia.ai/auth/apple/get_url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include'
        });
        const data = await res.json();
        if (data.data?.apple_auth_uri) {
          window.location.href = data.data.apple_auth_uri;
        } else {
          showError('Could not get Apple signup URL');
        }
      } catch (err) {
        showError('Apple signup failed');
      }
    }

    // CSP-safe event delegation
    document.addEventListener('click', function(e) {
      const el = e.target.closest('[data-action]');
      if (!el) return;
      if (el.dataset.action === 'handleGoogleSignup') handleGoogleSignup();
      else if (el.dataset.action === 'handleAppleSignup') handleAppleSignup();
    });
    document.addEventListener('submit', function(e) {
      const form = e.target.closest('[data-onsubmit]');
      if (!form) return;
      e.preventDefault();
      const fn = form.dataset.onsubmit;
      if (fn === 'handleEmailRegister') handleEmailRegister(e);
    });