/**
 * CSP-Compliant Event Delegation Handlers
 * Replaces all inline event handlers (onclick, onchange, onerror, etc.)
 * with data-attribute based event delegation for Chrome Extension MV3 compatibility.
 */
(function () {
  "use strict";

  // Global helper for data-action="locationReload"
  if (!window.locationReload) window.locationReload = () => location.reload();
  if (!window.historyBack) window.historyBack = () => history.back();

  // --- CLICK delegation ---
  document.addEventListener(
    "click",
    (e) => {
      // data-action (global function call with dotted path support)
      const actionEl = e.target.closest("[data-action]");
      if (actionEl) {
        const parts = actionEl.dataset.action.split(".");
        let fn = window;
        for (const p of parts) fn = fn?.[p];
        if (typeof fn === "function") {
          if (actionEl.tagName === "A" || actionEl.closest("a"))
            e.preventDefault();
          const param = actionEl.dataset.param;
          const param2 = actionEl.dataset.param2;
          const param3 = actionEl.dataset.param3;
          // stop-propagation class: also stop propagation when combined with data-action
          if (actionEl.classList.contains("stop-propagation"))
            e.stopPropagation();

          if (
            param !== undefined &&
            param2 !== undefined &&
            param3 !== undefined
          ) {
            fn(param, param2, param3);
          } else if (param !== undefined && param2 !== undefined) {
            fn(param, param2);
          } else if (param !== undefined) {
            fn(param, e);
          } else {
            if (fn.length > 0) { fn(e); } else { fn(); }
          }

          // data-after: run a second function after the primary action
          const after = actionEl.dataset.after;
          if (after) {
            const afterFn = window[after];
            if (typeof afterFn === "function") {
              const afterParam = actionEl.dataset.afterParam;
              afterParam !== undefined ? afterFn(afterParam) : afterFn();
            }
          }
          return;
        }
        // Function not found on window — don't consume the event,
        // let local page-level handlers handle it in bubble phase
      }

      // data-open-url (window.open)
      const openEl = e.target.closest("[data-open-url]");
      if (openEl) {
        window.open(openEl.dataset.openUrl, "_blank");
        return;
      }

      // data-copy (clipboard)
      const copyEl = e.target.closest("[data-copy]");
      if (copyEl) {
        const text =
          copyEl.dataset.copy === "location.href"
            ? location.href
            : copyEl.dataset.copy;
        navigator.clipboard.writeText(text).then(() => {
          const orig = copyEl.textContent;
          copyEl.textContent = "Copied!";
          setTimeout(() => (copyEl.textContent = orig), 1500);
        });
        return;
      }

      // data-copy-title (copy text to clipboard + show feedback)
      const copyTitleEl = e.target.closest("[data-copy-title]");
      if (copyTitleEl) {
        navigator.clipboard.writeText(copyTitleEl.dataset.copyTitle);
        const fb = copyTitleEl.querySelector(".copy-feedback");
        if (fb) {
          fb.classList.remove("hidden");
          setTimeout(() => fb.classList.add("hidden"), 1500);
        }
        return;
      }

      // data-load-doc (docs navigation)
      const docEl = e.target.closest("[data-load-doc]");
      if (docEl) {
        e.preventDefault();
        const docId = docEl.dataset.loadDoc;
        if (typeof loadDoc === "function") loadDoc(docId);
        history.pushState({}, "", "?doc=" + docId);
        return;
      }

      // data-scroll-to (smooth scroll to element)
      const scrollEl = e.target.closest("[data-scroll-to]");
      if (scrollEl) {
        e.preventDefault();
        const target = document.getElementById(scrollEl.dataset.scrollTo);
        if (target)
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      // data-click-target (programmatic click on another element by ID)
      const clickTargetEl = e.target.closest("[data-click-target]");
      if (clickTargetEl) {
        const target = document.getElementById(
          clickTargetEl.dataset.clickTarget,
        );
        if (target) target.click();
        return;
      }

      // data-nav (window.location.href navigation)
      const navEl = e.target.closest("[data-nav]");
      if (navEl) {
        window.location.href = navEl.dataset.nav;
        return;
      }

      // stop-propagation class
      if (e.target.closest(".stop-propagation")) {
        e.stopPropagation();
        return;
      }

      // toggle-next-hidden class
      const toggleEl = e.target.closest(".toggle-next-hidden");
      if (toggleEl && toggleEl.nextElementSibling) {
        toggleEl.nextElementSibling.classList.toggle("hidden");
      }
    },
    true,
  );

  // --- CHANGE delegation ---
  document.addEventListener("change", (e) => {
    const el = e.target.closest("[data-onchange]");
    if (!el) return;
    const fn = window[el.dataset.onchange];
    if (typeof fn === "function") {
      const param = el.dataset.param;
      const param2 = el.dataset.param2;
      if (param !== undefined && param2 !== undefined) {
        fn(param, param2, e.target);
      } else if (param !== undefined) {
        fn(e, param);
      } else {
        fn(e);
      }
    }
  });

  // --- SUBMIT delegation ---
  document.addEventListener("submit", (e) => {
    const el = e.target.closest("[data-onsubmit]");
    if (!el) return;
    e.preventDefault();
    const fn = window[el.dataset.onsubmit];
    if (typeof fn === "function") fn(e);
  });

  // --- INPUT delegation ---
  document.addEventListener("input", (e) => {
    if (e.target.classList.contains("sync-slider-value")) {
      const display = e.target.parentNode.querySelector(".slider-value");
      if (display) display.textContent = e.target.value;
    }
  });

  // --- Image/media error fallbacks (MutationObserver) ---
  function bindErrorHandlers(root) {
    const scope = root || document;

    // data-fallback (swap src on error)
    scope
      .querySelectorAll("[data-fallback]:not([data-fb-bound])")
      .forEach((el) => {
        el.dataset.fbBound = "1";
        el.addEventListener("error", function () {
          if (this.dataset.fallback) {
            this.src = this.dataset.fallback;
            delete this.dataset.fallback;
          }
        });
      });

    // data-hide-on-error
    scope
      .querySelectorAll("[data-hide-on-error]:not([data-hoe-bound])")
      .forEach((el) => {
        el.dataset.hoeBound = "1";
        el.addEventListener("error", function () {
          this.style.display = "none";
        });
      });

    // data-hide-on-error-show-sibling (hide self, show next sibling)
    scope
      .querySelectorAll(
        "[data-hide-on-error-show-sibling]:not([data-hoes-bound])",
      )
      .forEach((el) => {
        el.dataset.hoesBound = "1";
        el.addEventListener("error", function () {
          this.style.display = "none";
          if (this.nextElementSibling)
            this.nextElementSibling.style.display = "flex";
        });
      });

    // data-remove-parent-on-error
    scope
      .querySelectorAll("[data-remove-parent-on-error]:not([data-rp-bound])")
      .forEach((el) => {
        el.dataset.rpBound = "1";
        el.addEventListener("error", function () {
          const row =
            this.closest(".creation-info-row--media") || this.parentElement;
          if (row) row.remove();
        });
      });

    // data-error-replace (replace parent innerHTML on error)
    scope
      .querySelectorAll("[data-error-replace]:not([data-er-bound])")
      .forEach((el) => {
        el.dataset.erBound = "1";
        el.addEventListener("error", function () {
          if (this.parentElement && this.dataset.errorReplace) {
            this.parentElement.innerHTML = this.dataset.errorReplace;
          }
        });
      });

    // data-hide-on-error-show-id (hide self + show element by ID)
    scope
      .querySelectorAll("[data-hide-on-error-show-id]:not([data-hoesi-bound])")
      .forEach((el) => {
        el.dataset.hoesiBound = "1";
        el.addEventListener("error", function () {
          this.classList.add("hidden");
          const target = document.getElementById(this.dataset.hideOnErrorShowId);
          if (target) target.classList.remove("hidden");
        });
      });

    // data-error-replace-fn (replace parent innerHTML with return value of a window function)
    scope
      .querySelectorAll("[data-error-replace-fn]:not([data-erf-bound])")
      .forEach((el) => {
        el.dataset.erfBound = "1";
        el.addEventListener("error", function () {
          const fn = window[this.dataset.errorReplaceFn];
          if (typeof fn === "function" && this.parentElement) {
            this.parentElement.innerHTML = fn();
          }
        });
      });
  }

  bindErrorHandlers();
  new MutationObserver(() => bindErrorHandlers()).observe(
    document.documentElement,
    { childList: true, subtree: true },
  );
})();

export {};
