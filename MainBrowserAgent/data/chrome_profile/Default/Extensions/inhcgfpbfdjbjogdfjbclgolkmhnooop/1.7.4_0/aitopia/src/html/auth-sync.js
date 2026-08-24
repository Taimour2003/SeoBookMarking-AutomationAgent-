// Auth Sync Script
// This script syncs aitopia authentication from setup page to chrome.storage
// so it can be used by the sidebar on other domains

(async function syncAitopiaAuth() {
  'use strict';

  // Run on aitopia domains AND chrome-extension:// (setup page)
  const isAitopia = window.location.hostname.includes('aitopia');
  const isExtension = window.location.protocol === 'chrome-extension:';

  if (!isAitopia && !isExtension) {
    return;
  }

  console.log('[Auth Sync] Running on:', window.location.href);

  // Function to get cookie value
  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }

  // Function to sync auth to chrome.storage
  async function syncAuthToStorage() {
    try {
      let hopekey = null;
      let uuid_hopekey = null;
      let user = null;

      // FIRST: Check chrome.storage.local (where aitopia stores auth)
      try {
        const storageData = await chrome.storage.local.get(['uuid_hopekey', 'hopekey', 'user']);
        if (storageData.uuid_hopekey) {
          uuid_hopekey = storageData.uuid_hopekey;
          console.log('[Auth Sync] Found uuid_hopekey in chrome.storage');
        }
        if (storageData.hopekey) {
          hopekey = storageData.hopekey;
          console.log('[Auth Sync] Found hopekey in chrome.storage');
        }
        if (storageData.user) {
          user = storageData.user;
          console.log('[Auth Sync] Found user in chrome.storage');
        }
      } catch (e) {
        console.log('[Auth Sync] Could not read chrome.storage:', e);
      }

      // SECOND: Check cookies
      if (!hopekey) {
        hopekey = getCookie('hopekey');
        if (hopekey) {
          console.log('[Auth Sync] Found hopekey in cookies');
        }
      }

      // THIRD: Check localStorage
      if (!uuid_hopekey) {
        uuid_hopekey = localStorage.getItem('uuid_hopekey');
        if (uuid_hopekey) {
          console.log('[Auth Sync] Found uuid_hopekey in localStorage');
        }
      }

      if (!user) {
        const userStr = localStorage.getItem('user');
        if (userStr) {
          try {
            user = JSON.parse(userStr);
            console.log('[Auth Sync] Found user in localStorage');
          } catch (e) {
            console.log('[Auth Sync] Could not parse user data');
          }
        }
      }

      if (hopekey || uuid_hopekey) {
        console.log('[Auth Sync] Found authentication data, syncing to aiinhbfoop_auth');

        // Save to chrome.storage for cross-domain access
        const authData = {
          aiinhbfoop_auth: JSON.stringify({
            hopekey: hopekey || uuid_hopekey,
            uuid_hopekey: uuid_hopekey || hopekey,
            user: user,
            timestamp: new Date().toISOString(),
            domain: window.location.hostname
          })
        };

        await chrome.storage.local.set(authData);
        console.log('[Auth Sync] Authentication synced successfully to aiinhbfoop_auth');

        return true;
      } else {
        console.log('[Auth Sync] No authentication data found yet');
        return false;
      }
    } catch (e) {
      console.error('[Auth Sync] Error syncing auth:', e);
      return false;
    }
  }

  // Try to sync immediately
  await syncAuthToStorage();

  // Watch for changes in localStorage (when user logs in)
  const originalSetItem = localStorage.setItem;
  localStorage.setItem = function(key, value) {
    originalSetItem.apply(this, arguments);

    // If uuid_hopekey or hopekey is set, sync immediately
    if (key === 'uuid_hopekey' || key === 'hopekey' || key === 'user') {
      console.log('[Auth Sync] Auth data changed, syncing...');
      setTimeout(() => syncAuthToStorage(), 100);
    }
  };

  // Also watch for changes in chrome.storage.local (aitopia app stores auth there)
  if (chrome && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local') {
        const authKeys = ['uuid_hopekey', 'hopekey', 'user', 'uuid_search'];
        const hasAuthChange = Object.keys(changes).some(key => authKeys.includes(key));

        if (hasAuthChange) {
          console.log('[Auth Sync] chrome.storage auth data changed, syncing...');
          setTimeout(() => syncAuthToStorage(), 100);
        }
      }
    });
  }

  // Also watch for cookie changes
  let lastCookies = document.cookie;
  setInterval(() => {
    if (document.cookie !== lastCookies) {
      lastCookies = document.cookie;
      if (document.cookie.includes('hopekey')) {
        console.log('[Auth Sync] Cookie changed, syncing...');
        syncAuthToStorage();
      }
    }
  }, 1000);

  console.log('[Auth Sync] Auth sync watcher initialized');
})();
