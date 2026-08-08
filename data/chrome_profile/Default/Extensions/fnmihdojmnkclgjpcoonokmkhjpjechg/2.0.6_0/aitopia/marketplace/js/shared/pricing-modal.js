import {
  mainInnerHtml,
  loadPlans,
  switchPricing,
  toggleFaq,
  startCountdown,
  shouldHidePromo,
} from "./pricing-table.js";

// Mark as module import to prevent auto-init in pricing-table.js
window.__PRICING_TABLE_MODULE__ = true;

// Expose functions to global scope for inline onclick handlers
window.switchPricing = switchPricing;
window.toggleFaq = toggleFaq;

function closePricingModal() {
  const modal = document.querySelector(".pricing-modal-overlay");
  if (modal) {
    modal.classList.add("closing");
    setTimeout(() => modal.remove(), 200);
  }
}

function pricingModal() {
  if (document.querySelector(".pricing-modal-overlay")) return;

  // Create overlay
  const overlay = document.createElement("div");
  overlay.className =
    "pricing-modal-overlay fixed inset-0 z-[1000] flex items-center justify-center p-4 md:p-6";
  overlay.innerHTML = `
    <style>
      .pricing-modal-overlay {
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        animation: modalFadeIn 0.2s ease-out;
      }
      .pricing-modal-overlay.closing {
        animation: modalFadeOut 0.2s ease-out forwards;
      }
      .pricing-modal-overlay.closing .pricing-modal-container {
        animation: modalSlideDown 0.2s ease-out forwards;
      }
      .pricing-modal-container {
        animation: modalSlideUp 0.3s ease-out;
      }
      @keyframes modalFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes modalFadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
      }
      @keyframes modalSlideUp {
        from { opacity: 0; transform: translateY(24px) scale(0.96); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes modalSlideDown {
        from { opacity: 1; transform: translateY(0) scale(1); }
        to { opacity: 0; transform: translateY(24px) scale(0.96); }
      }
      .p-plan-text{
        display:none;
      }
    </style>

    <div class="pricing-modal-container relative w-full 2xl:max-w-[80%] max-h-[90vh] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl md:rounded-3xl shadow-xl shadow-black/20 dark:shadow-black/50 overflow-hidden">

      <!-- Header -->
      <div class="sticky top-0 z-10 flex items-center justify-between px-4 md:px-6 py-4 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm border-b border-zinc-200 dark:border-zinc-800">
        <h2 class="text-lg md:text-xl font-semibold text-zinc-900 dark:text-zinc-100">Choose Your Plan</h2>
        <button class="pricing-modal-close flex items-center justify-center w-9 h-9 md:w-10 md:h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100 transition-all duration-150 hover:scale-105 active:scale-95" aria-label="Close pricing modal">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <!-- Content -->
      <div class="pricing-modal-content px-4 md:px-8 py-1 overflow-y-auto max-h-[calc(90vh-65px)] bg-zinc-50 dark:bg-zinc-950">
        <div class="mx-auto max-w-3xl mt-4 mb-2 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40" data-credits-banner>
          <div class="flex items-center gap-3">
            <div class="flex items-center justify-center w-9 h-9 rounded-full bg-red-100 dark:bg-red-900/30 shrink-0">
              <svg class="w-5 h-5 text-red-500 dark:text-red-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>
            </div>
            <div>
              <p class="text-sm font-semibold text-red-800 dark:text-red-200">You've run out of credits</p>
              <p class="text-xs text-red-600 dark:text-red-400/80">Your generation was stopped. Pick a plan below to keep creating.</p>
            </div>
          </div>
        </div>
        ${mainInnerHtml()}
      </div>

    </div>
  `;

  document.body.appendChild(overlay);

  // Prevent body scroll
  document.body.style.overflow = "hidden";

  // Close button click
  overlay
    .querySelector(".pricing-modal-close")
    .addEventListener("click", closePricingModal);

  // Click outside to close
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closePricingModal();
  });

  // Escape key to close
  const handleEscape = (e) => {
    if (e.key === "Escape") {
      closePricingModal();
      document.removeEventListener("keydown", handleEscape);
    }
  };
  document.addEventListener("keydown", handleEscape);

  // Load plans data
  loadPlans();

  if (shouldHidePromo()) {
    const banner = overlay.querySelector('.countdown-banner');
    if (banner) banner.style.display = 'none';
  } else {
    // Start countdown timer
    fetch('https://aitopia.ai/store/promo-config.json')
      .then((r) => r.ok ? r.json() : {})
      .catch(() => ({}))
      .then((cfg) => {
        const b = cfg.banner || {};
        startCountdown(b.durationHours ?? 24);
      });
  }
}

function closePricingModalWithScroll() {
  document.body.style.overflow = "";
  const modal = document.querySelector(".pricing-modal-overlay");
  if (modal) {
    modal.classList.add("closing");
    setTimeout(() => modal.remove(), 200);
  }
}

// ES Module exports
export { pricingModal, closePricingModalWithScroll as closePricingModal };
