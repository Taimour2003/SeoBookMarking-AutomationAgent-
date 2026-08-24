import { renderMainHtml, loadPlans } from '/aitopia/marketplace/js/shared/pricing-table.js';
    // Auto-init only if not imported as module
    if (typeof window !== 'undefined' && !window.__PRICING_TABLE_MODULE__) {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
          (renderMainHtml(), loadPlans());
        });
      } else {
        renderMainHtml();
        loadPlans();
      }
    }