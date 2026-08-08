(function() {
  if (window.AitopiaCache) return;

  const CACHE_KEYS = {
    USER_PROFILE: 'aitopia_user_profile',
    USER_CREDITS: 'aitopia_user_credits'
  };

  const SYNC_KEY = 'aitopia_auth_sync';

  const CACHE_TTL = {
    USER_PROFILE: 30 * 1000,  // 1 minutes
    USER_CREDITS: 30 * 1000       // 1 minute
  };

  function get(key) {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      const { data, expiry } = JSON.parse(raw);
      if (Date.now() > expiry) {
        sessionStorage.removeItem(key);
        return null;
      }
      return data ?? null;
    } catch { return null; }
  }

  function set(key, data, ttl) {
    try {
      sessionStorage.setItem(key, JSON.stringify({
        data,
        expiry: Date.now() + ttl
      }));
    } catch {}
  }

  function remove(key) {
    try {
      sessionStorage.removeItem(key);
    } catch {}
  }

  function clearUserData() {
    remove(CACHE_KEYS.USER_PROFILE);
    remove(CACHE_KEYS.USER_CREDITS);

    try { localStorage.setItem(SYNC_KEY, Date.now().toString()); } catch {}
  }

  function getUserProfile() {
    return get(CACHE_KEYS.USER_PROFILE);
  }

  function setUserProfile(data) {
    set(CACHE_KEYS.USER_PROFILE, data, CACHE_TTL.USER_PROFILE);
  }

  function getUserCredits() {
    return get(CACHE_KEYS.USER_CREDITS);
  }

  function setUserCredits(credits) {
    set(CACHE_KEYS.USER_CREDITS, credits, CACHE_TTL.USER_CREDITS);
  }

  window.addEventListener('storage', (e) => {
    if (e.key === SYNC_KEY) {
      remove(CACHE_KEYS.USER_PROFILE);
      remove(CACHE_KEYS.USER_CREDITS);
      window.location.reload();
    }
  });

  window.AitopiaCache = {
    KEYS: CACHE_KEYS,
    TTL: CACHE_TTL,
    get,
    set,
    remove,
    clearUserData,
    getUserProfile,
    setUserProfile,
    getUserCredits,
    setUserCredits
  };
})();
