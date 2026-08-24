// Options page JavaScript
(function() {
    'use strict';

    const STORAGE_KEY = 'urlTogglePreference';
    const DISMISS_KEY = 'popupPermanentlyDismissed';
    const DISABLE_POPUP_KEY = 'disableMainPopup';

    // DOM elements
    let aiServiceToggle;
    let disableAutoPopup;
    let disableMainPopup;
    let resetButton;
    let showPopupBtn;
    let saveStatus;
    let currentServiceDisplay;

    // Initialize options page
    async function initializeOptions() {
        // Get DOM elements
        aiServiceToggle = document.getElementById('ai-service-toggle');
        disableAutoPopup = document.getElementById('disable-auto-popup');
        disableMainPopup = document.getElementById('disable-main-popup');
        resetButton = document.getElementById('reset-settings');
        showPopupBtn = document.getElementById('show-popup-btn');
        saveStatus = document.getElementById('save-status');
        currentServiceDisplay = document.getElementById('current-service');

        // Load current settings
        await loadSettings();

        // Set up event listeners
        setupEventListeners();
    }

    // Load settings from storage
    async function loadSettings() {
        try {
            const result = await chrome.storage.sync.get([STORAGE_KEY, DISMISS_KEY, DISABLE_POPUP_KEY]);
            
            // Load AI service preference
            const preference = result[STORAGE_KEY] || 'chatgpt';
            const isAitopia = preference === 'aitopia';
            
            if (aiServiceToggle) {
                aiServiceToggle.checked = isAitopia;
                updateCurrentServiceDisplay(isAitopia);
            }

            // Load dismiss preference
            const isDismissed = result[DISMISS_KEY] || false;
            if (disableAutoPopup) {
                disableAutoPopup.checked = isDismissed;
            }

            // Load disable main popup preference
            const isMainPopupDisabled = result[DISABLE_POPUP_KEY] || false;
            if (disableMainPopup) {
                disableMainPopup.checked = isMainPopupDisabled;
            }

            // Update toggle states based on main popup setting
            updateToggleStates();

        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    // Update current service display
    function updateCurrentServiceDisplay(isAitopia) {
        if (currentServiceDisplay) {
            currentServiceDisplay.textContent = `Current: ${isAitopia ? 'AITOPIA' : 'ChatGPT'}`;
        }
    }

    // Update toggle states based on main popup setting
    function updateToggleStates() {
        if (disableMainPopup && disableAutoPopup) {
            const isMainPopupDisabled = disableMainPopup.checked;
            
            // If main popup is disabled, automatically turn off auto-popup
            if (isMainPopupDisabled) {
                disableAutoPopup.checked = false;
            }
            
            // Disable auto-popup toggle when main popup is disabled
            disableAutoPopup.disabled = isMainPopupDisabled;
            
            // Add visual styling for disabled state
            const autoPopupContainer = disableAutoPopup.closest('.option-section');
            if (autoPopupContainer) {
                if (isMainPopupDisabled) {
                    autoPopupContainer.style.opacity = '0.5';
                    autoPopupContainer.style.pointerEvents = 'none';
                } else {
                    autoPopupContainer.style.opacity = '1';
                    autoPopupContainer.style.pointerEvents = 'auto';
                }
            }
        }
    }

    // Save settings to storage
    async function saveSettings() {
        try {
            const isAitopia = aiServiceToggle.checked;
            const isDismissed = disableAutoPopup.checked;
            const isMainPopupDisabled = disableMainPopup.checked;

            await chrome.storage.sync.set({
                [STORAGE_KEY]: isAitopia ? 'aitopia' : 'chatgpt',
                [DISMISS_KEY]: isDismissed,
                [DISABLE_POPUP_KEY]: isMainPopupDisabled
            });

            updateCurrentServiceDisplay(isAitopia);
            showSaveStatus('Settings saved successfully!', 'success');

        } catch (error) {
            console.error('Error saving settings:', error);
            showSaveStatus('Error saving settings', 'error');
        }
    }

    // Show save status message
    function showSaveStatus(message, type) {
        if (saveStatus) {
            saveStatus.textContent = message;
            saveStatus.className = `save-status ${type}`;
            saveStatus.style.display = 'block';

            setTimeout(() => {
                saveStatus.style.display = 'none';
            }, 3000);
        }
    }

    // Reset all settings
    async function resetSettings() {
        try {
            await chrome.storage.sync.clear();
            
            // Reset UI to defaults
            if (aiServiceToggle) aiServiceToggle.checked = false;
            if (disableAutoPopup) disableAutoPopup.checked = false;
            if (disableMainPopup) disableMainPopup.checked = false;
            updateCurrentServiceDisplay(false);
            
            showSaveStatus('All settings reset to defaults', 'success');

        } catch (error) {
            console.error('Error resetting settings:', error);
            showSaveStatus('Error resetting settings', 'error');
        }
    }

    // Set up event listeners
    function setupEventListeners() {
        if (aiServiceToggle) {
            aiServiceToggle.addEventListener('change', saveSettings);
        }

        if (disableAutoPopup) {
            disableAutoPopup.addEventListener('change', saveSettings);
        }

        if (disableMainPopup) {
            disableMainPopup.addEventListener('change', function() {
                updateToggleStates();
                saveSettings();
            });
        }

        if (resetButton) {
            resetButton.addEventListener('click', function() {
                if (confirm('Are you sure you want to reset all settings? This cannot be undone.')) {
                    resetSettings();
                }
            });
        }

        if (showPopupBtn) {
            showPopupBtn.addEventListener('click', function() {
                chrome.runtime.sendMessage({messageType: 'ShowPopup'});
                showSaveStatus('Opening extension popup...', 'success');
            });
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeOptions);
    } else {
        initializeOptions();
    }

})();