// Blue Popup JavaScript - URL Toggle Functionality
(async function () {
  console.log("Blue popup script loaded");

  // Storage keys
  const STORAGE_KEY = "urlTogglePreference";
  const DISMISS_KEY = "popupPermanentlyDismissed";
  const DISABLE_POPUP_KEY = "disableMainPopup";
  const URL_OPTIONS = {
    chatgpt: "https://chatgpt.com/",
    aitopia:
      "chrome-extension://fnmihdojmnkclgjpcoonokmkhjpjechg/aitopia/src/html/full_screen.html",
  };

  // DOM elements
  let urlToggle;
  let chatgptLabel;
  let aitopiaLabel;
  let closeButton;
  let permanentDismissToggle;
  let helpButton;
  let helpInfo;
  let helpClose;

  let rateUsButton;

  // Initialize the popup
  async function initializePopup() {
    try {
      // Get DOM elements
      urlToggle = document.getElementById("url-toggle");
      chatgptLabel = document.getElementById("chatgpt-label");
      aitopiaLabel = document.getElementById("google-label");
      closeButton = document.getElementById("closeButton");
      permanentDismissToggle = document.getElementById(
        "permanent-dismiss-toggle"
      );
      helpButton = document.getElementById("helpButton");
      helpInfo = document.getElementById("help-info");
      helpClose = document.getElementById("help-close");

      rateUsButton = document.getElementById("rateUsButton");

      // Enhance close button visibility
      if (closeButton) {
        // Add text fallback class for maximum visibility
        closeButton.classList.add("text-fallback");

        // Add additional attributes for accessibility
        closeButton.setAttribute("aria-label", "Close popup");
        closeButton.setAttribute("title", "Close");

        // Ensure it's always visible
        closeButton.style.zIndex = "9999";
        closeButton.style.pointerEvents = "auto";
      }

      // Load saved preference
      await loadToggleState();

      // Load permanent dismiss state
      await loadPermanentDismissState();

      // Set up event listeners
      setupEventListeners();

      // Check if we should auto-open the AI service
      const dismissResult = await chrome.storage.sync.get([DISMISS_KEY]);
      const isPermanentlyDismissed = dismissResult[DISMISS_KEY] || false;

      if (!isPermanentlyDismissed) {
        // Send OpenPopup message to background script only if not dismissed
        await chrome.runtime.sendMessage({ messageType: "OpenPopup" });
      } else {
        console.log("Auto-popup disabled by user preference");
      }
    } catch (error) {
      console.error("Error initializing popup:", error);
    }
  }

  // Load the toggle state from storage
  async function loadToggleState() {
    try {
      const result = await chrome.storage.sync.get([STORAGE_KEY]);
      const preference = result[STORAGE_KEY] || "chatgpt"; // Default to ChatGPT
      const isAitopia = preference === "aitopia";

      // Set toggle state (false = ChatGPT, true = AITOPIA)
      urlToggle.checked = isAitopia;
      updateToggleLabels(isAitopia);
    } catch (error) {
      console.error("Error loading toggle state:", error);
      // Default to ChatGPT if there's an error
      urlToggle.checked = false;
      updateToggleLabels(false);
    }
  }

  // Save the toggle state to storage
  async function saveToggleState(isAitopia) {
    try {
      const preference = isAitopia ? "aitopia" : "chatgpt";
      await chrome.storage.sync.set({ [STORAGE_KEY]: preference });
      console.log("Toggle preference saved:", preference);
    } catch (error) {
      console.error("Error saving toggle state:", error);
    }
  }

  // Update the visual state of toggle labels
  function updateToggleLabels(isAitopia) {
    if (chatgptLabel && aitopiaLabel) {
      chatgptLabel.classList.toggle("active", !isAitopia);
      aitopiaLabel.classList.toggle("active", isAitopia);
    }
  }

  // Set up event listeners
  function setupEventListeners() {
    // Toggle change event
    if (urlToggle) {
      urlToggle.addEventListener("change", async function () {
        const isAitopia = this.checked;
        updateToggleLabels(isAitopia);
        await saveToggleState(isAitopia);

        // Open the selected URL immediately in a new window
        const targetUrl = isAitopia ? URL_OPTIONS.aitopia : URL_OPTIONS.chatgpt;

        // Get screen dimensions for centering the window
        chrome.system.display.getInfo(function (displays) {
          const primaryDisplay = displays[0];
          const width = 1050;
          const height = 900;
          const left = Math.round(
            primaryDisplay.workArea.left +
              (primaryDisplay.workArea.width - width) / 2
          );
          const top = Math.round(
            primaryDisplay.workArea.top +
              (primaryDisplay.workArea.height - height) / 2
          );

          chrome.windows.create({
            url: targetUrl,
            type: "popup",
            focused: true,
            width: width,
            height: height,
            left: left,
            top: top,
          });
        });
      });
    }

    // Close button event - show help info first
    if (closeButton) {
      closeButton.addEventListener("click", function () {
        showHelpInfo();
      });
    }


    // Permanent dismiss toggle event
    if (permanentDismissToggle) {
      permanentDismissToggle.addEventListener("change", async function () {
        const isDismissed = this.checked;
        await savePermanentDismissState(isDismissed);
        updateDismissInfo(isDismissed);
        console.log(
          "Popup auto-show preference updated:",
          isDismissed ? "disabled" : "enabled"
        );
      });
    }

    // Help button event
    if (helpButton) {
      helpButton.addEventListener("click", function () {
        showHelpInfo();
      });
    }

    // Help close button event - close the entire popup
    if (helpClose) {
      helpClose.addEventListener("click", function () {
        window.close();
      });
    }


    // Help info background click to close popup
    if (helpInfo) {
      helpInfo.addEventListener("click", function (e) {
        if (e.target === helpInfo) {
          window.close();
        }
      });
    }

    // Make ChatGPT label clickable
    if (chatgptLabel) {
      chatgptLabel.addEventListener("click", function () {
        if (urlToggle && urlToggle.checked) {
          // Currently AITOPIA is selected, switch to ChatGPT
          urlToggle.checked = false;
          urlToggle.dispatchEvent(new Event("change"));
        }
      });
    }

    // Make AITOPIA label clickable
    if (aitopiaLabel) {
      aitopiaLabel.addEventListener("click", function () {
        if (urlToggle && !urlToggle.checked) {
          // Currently ChatGPT is selected, switch to AITOPIA
          urlToggle.checked = true;
          urlToggle.dispatchEvent(new Event("change"));
        }
      });
    }
  }

  // Listen for preference updates from storage changes
  function setupPreferenceListener() {
    // Listen for storage changes
    chrome.storage.onChanged.addListener(function (changes, namespace) {
      console.log("Storage changed:", changes, namespace);

      // Check if URL toggle preference was updated
      if (changes.urlTogglePreference) {
        const newPreference = changes.urlTogglePreference.newValue;
        console.log("URL preference updated to:", newPreference);

        // Update the toggle to reflect the new preference
        const isAitopia = newPreference === "aitopia";
        if (urlToggle) {
          urlToggle.checked = isAitopia;
          updateToggleLabels(isAitopia);
        }
      }

      // Check if preference was updated from banner
      if (changes.preferenceUpdatedFromBanner) {
        console.log("Preference was updated from banner CTA");
        // Reload the toggle state to ensure it's in sync
        loadToggleState();
      }
    });
  }

  // Load permanent dismiss state
  async function loadPermanentDismissState() {
    try {
      const result = await chrome.storage.sync.get([DISMISS_KEY]);
      const isDismissed = result[DISMISS_KEY] || false;

      if (permanentDismissToggle) {
        permanentDismissToggle.checked = isDismissed;
        updateDismissInfo(isDismissed);
      }
    } catch (error) {
      console.error("Error loading permanent dismiss state:", error);
    }
  }

  // Update dismiss info visibility
  function updateDismissInfo(isDismissed) {
    const dismissInfo = document.getElementById("dismiss-info");
    if (dismissInfo) {
      dismissInfo.style.display = isDismissed ? "block" : "none";
    }
  }

  // Save permanent dismiss state
  async function savePermanentDismissState(isDismissed) {
    try {
      await chrome.storage.sync.set({ [DISMISS_KEY]: isDismissed });
      console.log("Permanent dismiss state saved:", isDismissed);
    } catch (error) {
      console.error("Error saving permanent dismiss state:", error);
    }
  }

  // Show help info
  function showHelpInfo() {
    if (helpInfo) {
      helpInfo.style.display = "flex";
      // Hide the main close button when help info is shown
      if (closeButton) {
        closeButton.style.display = "none";
      }
      console.log("Help info shown");
    }
  }

  // Hide help info
  function hideHelpInfo() {
    if (helpInfo) {
      helpInfo.style.display = "none";
      // Show the main close button again when help info is hidden
      if (closeButton) {
        closeButton.style.display = "flex";
      }
      console.log("Help info hidden");
    }
  }

  // Wait for DOM to be ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", async function () {
      await initializePopup();
      setupPreferenceListener();
    });
  } else {
    await initializePopup();
    setupPreferenceListener();
  }

})();
