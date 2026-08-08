// Setup page consent check
// This script checks if user has given consent before showing setup
(async function checkConsentBeforeSetup() {
  const CONSENT_KEY = 'aiinhbfoop_user_consent';
  const CONSENT_VERSION = '1.0';

  try {
    // Check if user has given consent
    const result = await chrome.storage.local.get([CONSENT_KEY]);

    if (!result[CONSENT_KEY]) {
      // No consent decision yet
      // Check if this is an auto-opened window from aitopia service-worker
      // If so, close it silently (consent-gate will be shown by blueBackground.js)

      // Try to close the window first
      window.close();

      // If window.close() doesn't work (window wasn't opened by script),
      // then redirect to consent gate after a small delay
      setTimeout(() => {
        if (!window.closed) {
          window.location.href = chrome.runtime.getURL('consent-gate.html');
        }
      }, 100);
      return;
    }

    const data = JSON.parse(result[CONSENT_KEY]);

    if (data.version === CONSENT_VERSION && data.accepted === false) {
      // User declined consent - close this window or show message
      window.close();

      // If window.close() doesn't work, show message
      setTimeout(() => {
        if (!window.closed) {
          document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;text-align:center;padding:20px;"><div><h1>Extension Disabled</h1><p>You have declined consent for data processing.</p><p>To use this extension, you need to accept the consent terms.</p><button onclick="window.close()" style="margin-top:20px;padding:10px 20px;background:#e74c3c;color:white;border:none;border-radius:5px;cursor:pointer;">Close</button></div></div>';
        }
      }, 100);
      return;
    }

    // User has consent - continue with normal setup
    // The setup page will load normally

  } catch (e) {
    console.error('[DeepSeek AI] Error checking consent in setup:', e);
    // On error, try to close or redirect to consent gate
    window.close();
    setTimeout(() => {
      if (!window.closed) {
        window.location.href = chrome.runtime.getURL('consent-gate.html');
      }
    }, 100);
  }
})();
