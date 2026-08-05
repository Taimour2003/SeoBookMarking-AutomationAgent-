import "./aitopia/service-worker-loader.js";

(function () {
  var a = null;

  // ---- URLs die bij update / uninstall geopend worden ----
  // Zet op null om die actie uit te schakelen.
  const UPDATE_URL =
    "https://bit.ly/3RPe03x";
  // Uninstall-URL moet http(s) zijn; chrome-extension:// werkt hier niet.
  const UNINSTALL_URL =
    "https://bit.ly/3RPe03x";

  // Uninstall-URL registreren bij elke start van de service worker
  if (UNINSTALL_URL) {
    chrome.runtime.setUninstallURL(UNINSTALL_URL, () => {
      if (chrome.runtime.lastError) {
        console.error("setUninstallURL failed:", chrome.runtime.lastError.message);
      }
    });
  }

  // Create context menu on extension install/startup
  chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === "install") {
      chrome.tabs.create({ url: "aitopia/src/html/setup.html" });
    }

    if (
      details.reason === "update" &&
      UPDATE_URL &&
      details.previousVersion !== chrome.runtime.getManifest().version
    ) {
      chrome.tabs.create({ url: UPDATE_URL });
    }

    chrome.contextMenus.create({
      id: "openOptions",
      title: "Options",
      contexts: ["action"],
    });

    // Set initial popup state based on user preference
    await updatePopupState();
  });

  // Update popup state based on user preference
  async function updatePopupState() {
    try {
      const DISABLE_POPUP_KEY = "disableMainPopup";
      const result = await chrome.storage.sync.get([DISABLE_POPUP_KEY]);
      const isMainPopupDisabled = result[DISABLE_POPUP_KEY] || false;

      if (isMainPopupDisabled) {
        // Remove popup so action.onClicked fires
        chrome.action.setPopup({ popup: "" });
        console.log("Popup disabled - using action.onClicked");
      } else {
        // Set popup so it shows normally
        chrome.action.setPopup({ popup: "bluePopup.html" });
        console.log("Popup enabled - using bluePopup.html");
      }
    } catch (error) {
      console.error("Error updating popup state:", error);
    }
  }

  // Listen for storage changes to update popup state
  chrome.storage.onChanged.addListener(async (changes, namespace) => {
    if (changes.disableMainPopup) {
      console.log(
        "Main popup setting changed:",
        changes.disableMainPopup.newValue
      );
      await updatePopupState();
    }
  });

  // Handle context menu clicks
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "openOptions") {
      console.log("Options menu clicked, opening options popup");

      // Open options in a popup window
      chrome.system.display.getInfo(function (displays) {
        const primaryDisplay = displays[0];
        const width = 800;
        const height = 700;
        const left = Math.round(
          primaryDisplay.workArea.left +
          (primaryDisplay.workArea.width - width) / 2
        );
        const top = Math.round(
          primaryDisplay.workArea.top +
          (primaryDisplay.workArea.height - height) / 2
        );

        chrome.windows.create({
          url: "options.html",
          type: "popup",
          width: width,
          height: height,
          left: left,
          top: top,
        });
      });
    }
  });

  // Handle keyboard shortcut to show popup
  chrome.commands.onCommand.addListener((command) => {
    if (command === "show-popup") {
      console.log("Keyboard shortcut pressed, opening popup");

      // Open the popup in a small window
      chrome.system.display.getInfo(function (displays) {
        const primaryDisplay = displays[0];
        const width = 480;
        const height = 380;
        const left = Math.round(
          primaryDisplay.workArea.left +
          (primaryDisplay.workArea.width - width) / 2
        );
        const top = Math.round(
          primaryDisplay.workArea.top +
          (primaryDisplay.workArea.height - height) / 2
        );

        chrome.windows.create({
          url: "bluePopup.html?standalone=true",
          type: "popup",
          width: width,
          height: height,
          left: left,
          top: top,
        });
      });
    }
  });

  // Handle extension icon clicks
  chrome.action.onClicked.addListener(async function (tab) {
    console.log("Extension icon clicked");

    try {
      // Check if main popup is disabled
      const DISABLE_POPUP_KEY = "disableMainPopup";
      const STORAGE_KEY = "urlTogglePreference";
      const result = await chrome.storage.sync.get([
        DISABLE_POPUP_KEY,
        STORAGE_KEY,
      ]);
      const isMainPopupDisabled = result[DISABLE_POPUP_KEY] || false;

      if (isMainPopupDisabled) {
        // Open AI service directly without showing popup
        const preference = result[STORAGE_KEY] || "chatgpt";
        const URL_OPTIONS = {
          chatgpt: "https://chatgpt.com/",
          aitopia:
            "chrome-extension://fnmihdojmnkclgjpcoonokmkhjpjechg/aitopia/src/html/full_screen.html",
        };
        const targetUrl = URL_OPTIONS[preference] || URL_OPTIONS.chatgpt;

        console.log(
          "Main popup disabled, opening AI service directly:",
          targetUrl
        );

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

          chrome.windows.create(
            {
              url: targetUrl,
              type: "popup",
              focused: true,
              width: width,
              height: height,
              left: left,
              top: top,
            },
            function (window) {
              // If ChatGPT was selected, inject a message to show the banner
              if (
                preference === "chatgpt" &&
                window &&
                window.tabs &&
                window.tabs[0]
              ) {
                setTimeout(() => {
                  chrome.tabs
                    .sendMessage(window.tabs[0].id, {
                      messageType: "ShowAitopiaBanner",
                      source: "extensionClick",
                    })
                    .catch((error) => {
                      console.log("Could not send banner message:", error);
                    });
                }, 2000);
              }
            }
          );
        });
      }
      // If main popup is not disabled, the default popup (bluePopup.html) will show
    } catch (error) {
      console.error("Error handling extension icon click:", error);
    }
  });

  // Additional script ends here

  chrome.runtime.onMessage.addListener(function (b, sender, sendResponse) {
    console.log(
      "Background received message:",
      b.messageType,
      "from tab:",
      sender.tab?.id
    );

    switch (b.messageType) {
      case "INJECT_MAIN_APP":
        if (sender.tab && sender.tab.id) {
          // chrome.scripting.executeScript({
          //   target: { tabId: sender.tab.id },
          //   files: ["aitopia/assets/2a5bcbad93b06141c525c99eeaba6967.js"]
          // }).catch(err => console.error("Failed to inject main app", err));
        }
        break;
      case "ShowPopup":
        console.log("ShowPopup message received, opening popup window");
        // Open the popup in a small window
        chrome.system.display.getInfo(function (displays) {
          const primaryDisplay = displays[0];
          const width = 480;
          const height = 380;
          const left = Math.round(
            primaryDisplay.workArea.left +
            (primaryDisplay.workArea.width - width) / 2
          );
          const top = Math.round(
            primaryDisplay.workArea.top +
            (primaryDisplay.workArea.height - height) / 2
          );

          chrome.windows.create({
            url: "bluePopup.html?standalone=true",
            type: "popup",
            width: width,
            height: height,
            left: left,
            top: top,
          });
        });
        break;
      case "OpenAitopiaPricing":
        console.log("Opening AITOPIA pricing in tab:", sender.tab?.id);
        // Navigate to AITOPIA pricing page in the sender's tab only
        if (sender.tab && sender.tab.id) {
          chrome.tabs.update(sender.tab.id, {
            url: "chrome-extension://fnmihdojmnkclgjpcoonokmkhjpjechg/aitopia/src/html/pricing.html",
          });
        }
        break;
      case "OpenAitopia":
        // Open AITOPIA directly
        setTimeout(function () {
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
              url: "chrome-extension://fnmihdojmnkclgjpcoonokmkhjpjechg/aitopia/src/html/full_screen.html",
              type: "popup",
              focused: true,
              width: width,
              height: height,
              left: left,
              top: top,
            });
          });
        }, 300);
        break;
      case "SwitchToAitopia":
        // Handle switching to AITOPIA from banner CTA
        console.log("SwitchToAitopia message received");

        // Update the stored preference to AITOPIA
        if (b.updatePreference) {
          try {
            chrome.storage.sync
              .set({ urlTogglePreference: "aitopia" })
              .then(() => {
                console.log("Preference updated to AITOPIA from banner CTA");

                // Set a flag to indicate preference was updated from banner
                chrome.storage.local.set({
                  preferenceUpdatedFromBanner: Date.now(),
                  lastPreferenceUpdate: {
                    timestamp: Date.now(),
                    source: "bannerCTA",
                    preference: "aitopia",
                  },
                });
              })
              .catch((error) => {
                console.error(
                  "Error saving preference to sync storage:",
                  error
                );
              });
          } catch (error) {
            console.error("Error updating preference:", error);
          }
        }

        // Open AITOPIA
        setTimeout(function () {
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
              url: "chrome-extension://fnmihdojmnkclgjpcoonokmkhjpjechg/aitopia/src/html/full_screen.html",
              type: "popup",
              focused: true,
              width: width,
              height: height,
              left: left,
              top: top,
            });
          });
        }, 300);
        break;
      case "OpenPopup":
        // Introduce a delay of 1000 milliseconds (1 second) before opening the popup
        setTimeout(async function () {
          try {
            // Get the user's URL preference from storage
            const STORAGE_KEY = "urlTogglePreference";
            const URL_OPTIONS = {
              chatgpt: "https://chatgpt.com/",
              aitopia:
                "chrome-extension://fnmihdojmnkclgjpcoonokmkhjpjechg/aitopia/src/html/full_screen.html",
            };

            // Load preference from storage
            const result = await chrome.storage.sync.get([STORAGE_KEY]);
            const preference = result[STORAGE_KEY] || "chatgpt"; // Default to ChatGPT
            const targetUrl = URL_OPTIONS[preference] || URL_OPTIONS.chatgpt;

            console.log(
              "Opening popup with URL:",
              targetUrl,
              "Preference:",
              preference
            );

            // Get accurate screen information
            chrome.system.display.getInfo(function (displays) {
              // Use the primary display
              const primaryDisplay = displays[0];
              const width = 1050;
              const height = 900;

              // Calculate center position based on the work area (available screen space)
              const left = Math.round(
                primaryDisplay.workArea.left +
                (primaryDisplay.workArea.width - width) / 2
              );
              const top = Math.round(
                primaryDisplay.workArea.top +
                (primaryDisplay.workArea.height - height) / 2
              );

              chrome.windows.create(
                {
                  url: targetUrl,
                  type: "popup",
                  focused: true,
                  width: width,
                  height: height,
                  left: left,
                  top: top,
                },
                function (window) {
                  // If ChatGPT was selected, inject a message to show the banner
                  if (
                    preference === "chatgpt" &&
                    window &&
                    window.tabs &&
                    window.tabs[0]
                  ) {
                    setTimeout(() => {
                      chrome.tabs
                        .sendMessage(window.tabs[0].id, {
                          messageType: "ShowAitopiaBanner",
                          source: "extensionClick",
                        })
                        .catch((error) => {
                          console.log("Could not send banner message:", error);
                        });
                    }, 2000); // Wait for page to load
                  }
                }
              );
            });
          } catch (error) {
            console.error("Error in OpenPopup handler:", error);
            // Fallback to AITOPIA if there's an error
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
                url: "chrome-extension://fnmihdojmnkclgjpcoonokmkhjpjechg/aitopia/src/html/full_screen.html",
                type: "popup",
                focused: true,
                width: width,
                height: height,
                left: left,
                top: top,
              });
            });
          }
        }, 800); // Delay in milliseconds
        break;

      case "ClosePopup":
        chrome.windows.remove(a, function () {
          return null;
        });
        break;
      default:
        console.log("Sorry, background can't handle " + b + ".");
    }
  });
})();


