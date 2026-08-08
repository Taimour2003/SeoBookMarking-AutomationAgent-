// Constants
const REVIEW_URL =
  "https://chromewebstore.google.com/detail/deepseek/inhcgfpbfdjbjogdfjbclgolkmhnooop/reviews";

// DOM Elements
const rateButton = document.getElementById("rateUsButton");
const toggleInput = document.getElementById("switchToggle");
const privacyLink = document.getElementById("privacyLink");

// ===== Storage helpers =====
function getValue(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (r) => {
      resolve(r[key] || null);
    });
  });
}

function setValue(key, value) {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.set({ [key]: value }, () => {
        resolve("value saved");
      });
    } catch (e) {
      console.error(e);
      reject(e);
    }
  });
}

// ===== Message helper =====
function sendMessage(messageType, body) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ messageType, body }, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(response);
      }
    });
  });
}

// ===== Event handlers =====

// Rate button → open Chrome Web Store reviews
rateButton.addEventListener("click", () => {
  chrome.tabs.create({ url: REVIEW_URL });
});

// Toggle switch → persist flag and notify background
toggleInput.addEventListener("change", () => {
  const isChecked = toggleInput.checked;
  const msg = isChecked ? "OpenPopupclick" : "ClosePopupclick";
  sendMessage(msg, null).catch((err) =>
    console.error("Failed to send message:", err)
  );
});

// Privacy link → open bundled privacy policy
privacyLink.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: chrome.runtime.getURL("privacy-policy.html") });
});

// ===== Initialise =====
async function initOptions() {
  try {
    // Restore toggle state from storage
    const chatFlag = await getValue("chatFlag");
    toggleInput.checked = chatFlag || false;
  } catch (error) {
    console.error("Failed to initialise options:", error);
  }
}

document.addEventListener("DOMContentLoaded", initOptions);
