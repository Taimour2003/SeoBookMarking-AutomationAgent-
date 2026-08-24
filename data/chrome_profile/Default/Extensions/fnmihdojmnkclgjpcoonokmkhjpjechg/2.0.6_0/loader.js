(function() {
    // Prevent running on extension pages (like setup.html) or Google Auth pages
    if (window.location.protocol === 'chrome-extension:') return;
    if (window.location.hostname === 'accounts.google.com') return;

    // Inject main app
    chrome.runtime.sendMessage({
        messageType: "INJECT_MAIN_APP"
    });
})();
