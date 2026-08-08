// Consent Gate JavaScript
// Handles user consent for the DeepSeek AI extension

const CONSENT_KEY = "aiinhbfoop_user_consent";
const CONSENT_VERSION = "1.0";
const DEEPSEEK_URL = "https://chat.deepseek.com/";

// Check if user already consented
checkExistingConsent();

async function checkExistingConsent() {
  try {
    const result = await chrome.storage.local.get([CONSENT_KEY]);
    if (result[CONSENT_KEY]) {
      const data = JSON.parse(result[CONSENT_KEY]);
      if (data.version === CONSENT_VERSION && data.accepted === true) {
        // Already consented - redirect to DeepSeek
        redirectToDeepSeek();
        return;
      }
    }
  } catch (e) {
    console.error("Error checking consent:", e);
  }
}

async function redirectToDeepSeek() {
  document.getElementById("loading").classList.add("active");
  document.querySelector(".consent-content").style.display = "none";
  document.querySelector(".buttons").style.display = "none";

  // Show success message
  const successMsg = document.createElement("div");
  successMsg.style.textAlign = "center";
  successMsg.style.padding = "40px 20px";
  successMsg.innerHTML = `
        <h2 style="color: #27ae60; margin-bottom: 20px;">✓ You're all set</h2>
        <p style="color: #555; line-height: 1.8; margin-bottom: 20px;">
            Opening the AI sidebar...<br>
            The sidebar will now be available on all websites.
        </p>
    `;
  document.querySelector(".container").appendChild(successMsg);

  // Small delay to show the message, then open a website with sidebar
  setTimeout(async () => {
    const currentTab = await chrome.tabs.getCurrent();

    // Open Google in the current tab (or any website where the sidebar will load)
    chrome.tabs.update(currentTab.id, {
      url: "https://www.google.com",
    });
  }, 1000);
}

// This is an informational first-run notice, not a consent wall. The processing
// it describes (sending your message to the AI provider) is strictly necessary to
// deliver the service the user asked for, so the legal basis is performance of the
// service rather than consent. Clicking "Continue" records that the notice was
// acknowledged and enables the sidebar; the genuine way to refuse is to not
// continue (the extension stays inactive) or to remove the extension. There is no
// "decline → blocked" dead-end, and no separate opt-in because the extension does
// no non-essential processing (no analytics, no page tracking).
function recordAcknowledgement() {
  const consentData = JSON.stringify({
    accepted: true,
    version: CONSENT_VERSION,
    timestamp: new Date().toISOString(),
  });

  // Save to chrome.storage
  chrome.storage.local.set({ [CONSENT_KEY]: consentData });

  // Also save to localStorage for content scripts
  localStorage.setItem(CONSENT_KEY, consentData);
}

// Continue button — acknowledge the notice and activate the sidebar
document
  .getElementById("continueBtn")
  .addEventListener("click", async function () {
    recordAcknowledgement();

    // Notify all open tabs so the sidebar activates immediately
    try {
      const tabs = await chrome.tabs.query({});
      const promises = tabs.map((tab) => {
        return chrome.tabs
          .sendMessage(tab.id, {
            type: "CONSENT_ACCEPTED",
            action: "update_consent",
          })
          .catch(() => {
            // Ignore errors for tabs that don't have the content script
            return null;
          });
      });

      // Wait for all tabs to respond (or timeout after 500ms)
      await Promise.race([
        Promise.all(promises),
        new Promise((resolve) => setTimeout(resolve, 500)),
      ]);
    } catch (e) {
      console.error("Error notifying tabs:", e);
    }

    // Small delay to ensure messages are processed
    await new Promise((resolve) => setTimeout(resolve, 100));

    redirectToDeepSeek();
  });

/**************************************************************************** */

// function attachClickListeners() {
//   globlChatVars2.chatbtnAllow()?.addEventListener("click", () => {
//     chrome.storage.local.set({ chatFlag: true }, function () {
//       msgPassing.sendMassage("OpenPopupclick", null);
//     });
//   });

//   globlChatVars2.chatbtmdecline()?.addEventListener("click", () => {
//     chrome.storage.local.set({ chatFlag: false }, function () {
//       msgPassing.sendMassage("ClosePopupclick", null);
//     });
//   });
// }

let msgPassing = {
  sendMassage: function (
    messageType,
    body,
    callback = (res) => {
      //  console.log("res", res);
    },
  ) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ messageType, body }, (response) => {
        if (chrome.runtime.lastError) {
          callback(chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else {
          callback(response);
          resolve(response);
        }
      });
    });
  },

  onMessage: function (callback) {
    chrome.runtime.onMessage.addListener((req, sender, sendr) => {
      callback(req, sender, sendr);
    });
  },

  hadleMessage: function (response, sender, sendResponse) {
    if (response.messageType == "OpenPopupclick") {
      chrome.storage.local.set({ chatFlag: true }, function () {
        gptRuntimeContext.chatFlag = true;
        gptSidebarBridge.fetchAssistantState({
          uId: gptRuntimeContext.chatId,
          chatFlag: gptRuntimeContext.chatFlag,
        });
        sendResponse("msg recive");
      });
    } else if (response.messageType == "ClosePopupclick") {
      chrome.storage.local.set({ chatFlag: false }, function () {
        gptRuntimeContext.chatFlag = false;
        gptSidebarBridge.fetchAssistantState({
          uId: gptRuntimeContext.chatId,
          chatFlag: gptRuntimeContext.chatFlag,
        });
        sendResponse("msg recive");
      });
    } else {
    }
  },
};

// setTimeout(attachClickListeners, 2000);
