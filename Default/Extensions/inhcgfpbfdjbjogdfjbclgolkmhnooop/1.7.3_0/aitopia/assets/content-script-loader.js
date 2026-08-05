// Content Script Loader for ES Modules
// This script dynamically loads ES modules as content scripts since Chrome Manifest V3
// doesn't support "type": "module" for content scripts in the manifest

// CRITICAL: Exit immediately if this is an extension page to prevent flash during install
if (
  window.location.protocol === "chrome-extension:" ||
  window.location.href.includes("consent-gate.html") ||
  window.location.href.includes("privacy-policy.html")
) {
  console.log("[DeepSeek AI Extension] Skipping - extension page detected");
  // Stop execution entirely - don't even run the IIFE
} else {
  // Only run the main script on regular web pages
  (function () {
    "use strict";

    // Load CSS files dynamically (not via manifest to prevent flash on extension pages)
    const cssFiles = [
      "aitopia/assets/b1787eab876d2c84860f82cc9bc36451.css",
      "aitopia/assets/86211712efab768f9d4be4adfecbebbe.css",
    ];

    cssFiles.forEach((cssFile) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = chrome.runtime.getURL(cssFile);
      document.head.appendChild(link);
    });

    // GDPR Compliance: Consent is now handled only via consent-gate.html on first install
    // No need for consent banner on every page
    // Set privacy policy URL via data attribute instead of inline script (CSP compliant)
    window.aiinhbfoopPrivacyPolicyURL = chrome.runtime.getURL(
      "privacy-policy.html",
    );

    // Check if user already gave consent previously and load app if yes
    checkExistingConsent();

    // Check if user already consented in previous session
    async function checkExistingConsent() {
      try {
        // Check chrome.storage first (cross-domain consent storage)
        const result = await chrome.storage.local.get([
          "aiinhbfoop_user_consent",
        ]);
        if (result.aiinhbfoop_user_consent) {
          const data = JSON.parse(result.aiinhbfoop_user_consent);

          // Also sync to localStorage for consistency
          localStorage.setItem(
            "aiinhbfoop_user_consent",
            result.aiinhbfoop_user_consent,
          );

          if (data.version === "1.0" && data.accepted === true) {
            // User previously accepted - load main app
            loadMainApp();
            return;
          } else if (data.version === "1.0" && data.accepted === false) {
            // User explicitly declined - do NOT load main app
            console.log(
              "[DeepSeek AI Extension] User previously declined consent - extension disabled",
            );
            return;
          }
        }

        // Fallback to localStorage for backwards compatibility
        const consent = localStorage.getItem("aiinhbfoop_user_consent");
        if (consent) {
          const data = JSON.parse(consent);
          if (data.version === "1.0" && data.accepted === true) {
            // User previously accepted - load main app
            loadMainApp();
            return;
          } else if (data.version === "1.0" && data.accepted === false) {
            // User explicitly declined - do NOT load main app
            console.log(
              "[DeepSeek AI Extension] User previously declined consent - extension disabled",
            );
            return;
          }
        }

        // If no consent data found, do nothing - user needs to accept via consent-gate.html first
        console.log(
          "[DeepSeek AI Extension] No consent found - please accept consent via extension icon",
        );
      } catch (e) {
        console.error("[DeepSeek AI Extension] Error checking consent:", e);
      }
    }

    // Load the main extension app (only if consent given)
    async function loadMainApp() {
      console.log("[DeepSeek AI Extension] Loading main sidebar app...");

      // Set chatFlag for aitopia sidebar compatibility
      try {
        // await chrome.storage.local.set({ chatFlag: true });
        console.log(
          "[DeepSeek AI Extension] Set chatFlag=true for aitopia sidebar",
        );
      } catch (e) {
        console.error("[DeepSeek AI Extension] Error setting chatFlag:", e);
      }

      // Load sidebar using the same method as original extension
      const injectTime = performance.now();

      (async () => {
        try {
          const { onExecute } = await import(
            /* @vite-ignore */
            chrome.runtime.getURL(
              "aitopia/assets/a06923325df9fc23634226f1be1668ff.js",
            )
          );
          onExecute?.({
            perf: { injectTime, loadTime: performance.now() - injectTime },
          });
          console.log(
            "[DeepSeek AI Extension] Main sidebar app loaded successfully",
          );
        } catch (error) {
          console.error(
            "[DeepSeek AI Extension] Error loading main sidebar app:",
            error,
          );
        }
      })();
    }

    // Listen for consent messages from consent-gate
    chrome.runtime.onMessage.addListener(
      function (message, sender, sendResponse) {
        const CONSENT_KEY = "aiinhbfoop_user_consent";
        const CONSENT_VERSION = "1.0";

        if (
          message.type === "CONSENT_ACCEPTED" &&
          message.action === "update_consent"
        ) {
          // Update localStorage on this page when consent is accepted
          const consentData = JSON.stringify({
            accepted: true,
            version: CONSENT_VERSION,
            timestamp: new Date().toISOString(),
          });
          localStorage.setItem(CONSENT_KEY, consentData);
          console.log(
            "[DeepSeek AI Extension] Consent accepted - localStorage updated",
          );

          // Load the main app now that consent is given
          loadMainApp();

          sendResponse({ success: true });
        }

        if (
          message.type === "CONSENT_DECLINED" &&
          message.action === "remove_sidebar"
        ) {
          // Update localStorage on this page when consent is declined
          const consentData = JSON.stringify({
            accepted: false,
            version: CONSENT_VERSION,
            timestamp: new Date().toISOString(),
          });
          localStorage.setItem(CONSENT_KEY, consentData);

          // Remove all extension elements from the page
          const sidebarElements = document.querySelectorAll(
            '[id*="aiinhbfoop"], [class*="aiinhbfoop"]',
          );
          sidebarElements.forEach((el) => el.remove());

          // Remove consent banner if visible
          const consentBanner = document.getElementById(
            "aiinhbfoop-consent-banner",
          );
          if (consentBanner) {
            consentBanner.remove();
          }

          console.log(
            "[DeepSeek AI Extension] Sidebar removed - consent declined",
          );
          sendResponse({ success: true });
        }
      },
    );
  })(); // End of IIFE
} // End of else block - only runs on regular web pages
