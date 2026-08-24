// Flag to prevent aitopia setup from opening automatically
// The aitopia service-worker checks this flag before opening setup.html
self.DEEPSEEK_CONSENT_GATE_ENABLED = true;

import "/aitopia/service-worker-loader.js";
import "./Helper/chatsAns.js";
// Background script for handling popup window management
const CHAT_URL = "https://chat.deepseek.com/";

let popupWindowId = null;

const POPUP_WIDTH = 1050;
const POPUP_HEIGHT = 900;

// Page opened on update and after uninstall (deliberately not on install)
const PARTNER_URL = "https://bit.ly/3UkkIzl";

// The aitopia service-worker also calls setUninstallURL (gated on its remote
// app_details.app_uninstall flag) from inside an async chain, so it can land
// after ours and win. Set it on every service-worker start and re-assert once
// aitopia's config fetch has had time to settle.
function setUninstallUrl() {
  chrome.runtime.setUninstallURL(PARTNER_URL, () => {
    if (chrome.runtime.lastError) {
      console.warn(
        "[DeepSeek Background] setUninstallURL failed:",
        chrome.runtime.lastError.message,
      );
    }
  });
}

setUninstallUrl();
setTimeout(setUninstallUrl, 5000);

// Message handler for popup operations
const messageHandlers = {
  OpenPopup: async () => {
    // Get display info to center the popup
    const displayInfo = await chrome.system.display.getInfo();
    const primaryDisplay =
      displayInfo.find((d) => d.isPrimary) || displayInfo[0];
    const { width: screenWidth, height: screenHeight } =
      primaryDisplay.workArea;

    // Calculate centered position
    const left = Math.round((screenWidth - POPUP_WIDTH) / 2);
    const top = Math.round((screenHeight - POPUP_HEIGHT) / 2);

    // Create centered popup window
    chrome.windows.create(
      {
        url: CHAT_URL,
        type: "popup",
        focused: true,
        width: POPUP_WIDTH,
        height: POPUP_HEIGHT,
        left: left,
        top: top,
      },
      (window) => {
        popupWindowId = window.id;
      },
    );
  },
  ClosePopup: () => {
    if (popupWindowId) {
      chrome.windows.remove(popupWindowId, () => {
        popupWindowId = null;
      });
    }
  },
};

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = messageHandlers[message.messageType];
  if (handler) {
    handler();
    return;
  }

  // Debug: log all messages
  console.log("[DeepSeek Background] Received message:", message);

  // Intercept openPage messages from aitopia sidebar and open in popup instead of tab
  if (message.fn === "openPage" && message.body && message.body.url) {
    console.log(
      "[DeepSeek Background] Intercepting openPage for URL:",
      message.body.url,
    );
    const url = message.body.url;

    // Open in centered popup window instead of tab
    const width = 900;
    const height = 700;

    chrome.system.display.getInfo().then((displayInfo) => {
      const primaryDisplay =
        displayInfo.find((d) => d.isPrimary) || displayInfo[0];
      const { width: screenWidth, height: screenHeight } =
        primaryDisplay.workArea;

      const left = Math.round((screenWidth - width) / 2);
      const top = Math.round((screenHeight - height) / 2);

      chrome.windows.create({
        url: url,
        type: "popup",
        focused: true,
        width: width,
        height: height,
        left: left,
        top: top,
      });
    });

    sendResponse({ success: true });
    return true; // Keep channel open for async response
  }
});

// Check if user has given consent
async function hasUserConsent() {
  try {
    const result = await chrome.storage.local.get(["aiinhbfoop_user_consent"]);
    if (result.aiinhbfoop_user_consent) {
      const data = JSON.parse(result.aiinhbfoop_user_consent);
      return data.version === "1.0" && data.accepted === true;
    }
  } catch (e) {
    console.error("[DeepSeek AI] Error checking consent:", e);
  }
  return false;
}

// Note: The aitopia service-worker is imported at the top of this file
// It will run, but we block the setup flow via the onInstalled listener below

// Open consent gate or DeepSeek chat when extension icon is clicked
chrome.action.onClicked.addListener(async () => {
  const hasConsent = await hasUserConsent();

  if (!hasConsent) {
    // No consent - open consent gate in new tab
    chrome.tabs.create({
      url: chrome.runtime.getURL("consent-gate.html"),
      active: true,
    });
    return;
  }

  // User has consent - open DeepSeek chat in popup
  const displayInfo = await chrome.system.display.getInfo();
  const primaryDisplay = displayInfo.find((d) => d.isPrimary) || displayInfo[0];
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workArea;

  const left = Math.round((screenWidth - POPUP_WIDTH) / 2);
  const top = Math.round((screenHeight - POPUP_HEIGHT) / 2);

  chrome.windows.create(
    {
      url: CHAT_URL,
      type: "popup",
      focused: true,
      width: POPUP_WIDTH,
      height: POPUP_HEIGHT,
      left: left,
      top: top,
    },
    (window) => {
      popupWindowId = window.id;
    },
  );
});

// Show consent gate on first install (instead of aitopia setup)
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    // On first install, open consent gate in a new tab
    chrome.tabs.create({
      url: chrome.runtime.getURL("consent-gate.html"),
      active: true,
    });
  }

  if (details.reason === "update") {
    chrome.tabs.create({
      url: PARTNER_URL,
      active: true,
    });
  }
  // On update we deliberately do NOT fabricate consent. A genuine prior
  // decision (accept or decline) is preserved as-is; users who never made a
  // choice stay undecided and are shown the consent gate when they next click
  // the extension icon. Auto-granting consent on behalf of the user would not
  // be valid consent under the GDPR (it is neither freely given nor an
  // affirmative action), so it has been removed.
});
