(function () {
  const SCRIPT_MARK = "global-nav-v1";
  if (window.__AITOPIA_GLOBAL_NAV__ === SCRIPT_MARK) return;
  window.__AITOPIA_GLOBAL_NAV__ = SCRIPT_MARK;

  const getCache = () => window.AitopiaCache;
  const getUserProfile = () => getCache()?.getUserProfile?.() ?? null;
  const setUserProfile = (data) => getCache()?.setUserProfile?.(data);
  const getUserCredits = () => getCache()?.getUserCredits?.() ?? null;
  const setUserCredits = (credits) => getCache()?.setUserCredits?.(credits);
  const clearUserCache = () => getCache()?.clearUserData?.();
  let developerStatusPromise = null;

  async function fetchIsDeveloper(forceRefresh = false) {
    if (!forceRefresh && developerStatusPromise) return developerStatusPromise;
    developerStatusPromise = (async () => {
      try {
        const res = await fetch('https://aitopia.ai/api/developers/me?soft=1', {
          method: 'GET',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });
        return res.ok;
      } catch {
        return false;
      }
    })();
    return developerStatusPromise;
  }

  const unhideFailsafe = setTimeout(() => {
    try {
      document.documentElement.classList.remove("global-nav-loading");
      document.documentElement.classList.add("global-nav-ready");
    } catch (e) {}
  }, 2000);

	  function injectDrawerStyles() {
	    if (document.getElementById("globalNavDrawerStyles")) return;
	    const style = document.createElement("style");
	    style.id = "globalNavDrawerStyles";
	    style.textContent = `
      .nav-drawer-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.5);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        z-index: 998;
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
        transition: opacity 0.3s ease, visibility 0.3s ease;
      }
      .nav-drawer-overlay.open {
        opacity: 1;
        visibility: visible;
        pointer-events: auto;
      }
      .nav-drawer {
        position: fixed;
        top: 0;
        left: 0;
        width: 320px;
        max-width: 85vw;
        height: 100%;
        background: hsl(var(--aifnmjmchg-m-card));
        z-index: 999;
        transform: translateX(-100%);
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        display: flex;
        flex-direction: column;
        box-shadow: 4px 0 24px rgba(0,0,0,0.15);
      }
      .nav-drawer.open {
        transform: translateX(0);
      }
      .nav-drawer-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        border-bottom: 1px solid hsl(var(--aifnmjmchg-m-border));
        position: sticky;
        top: 0;
        background: hsl(var(--aifnmjmchg-m-card));
        z-index: 1;
        min-height: 60px;
      }
      .nav-drawer-title {
        font-size: 18px;
        font-weight: 700;
      }
      .nav-drawer-close {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: hsl(var(--aifnmjmchg-m-secondary));
        display: flex;
        align-items: center;
        justify-content: center;
        border: none;
        cursor: pointer;
        transition: background 0.15s ease;
      }
      .nav-drawer-close:hover {
        background: hsl(var(--aifnmjmchg-m-secondary) / 0.8);
      }
      .nav-drawer-content {
        flex: 1;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
      }
      .nav-section {
        padding: 16px 20px;
        border-bottom: 1px solid hsl(var(--aifnmjmchg-m-border));
      }
      .nav-section:last-child {
        border-bottom: none;
      }
	      .nav-section-title {
	        font-size: 11px;
	        font-weight: 600;
	        text-transform: uppercase;
	        letter-spacing: 0.5px;
	        color: hsl(var(--aifnmjmchg-m-muted-foreground));
	        margin-bottom: 12px;
	      }

	      /* Store-style drawer items (scoped to global drawer) */
	      #globalNavDrawer .nav-item {
	        display: flex;
	        align-items: center;
	        gap: 12px;
	        padding: 12px 16px;
	        margin: 2px 0;
	        cursor: pointer;
	        transition: all 0.15s;
	        border-radius: 10px;
	        text-decoration: none;
	        color: inherit;
	      }
	      #globalNavDrawer .nav-item:hover {
	        background: hsl(var(--aifnmjmchg-m-secondary) / 0.5);
	      }
	      #globalNavDrawer .nav-item:active {
	        background: hsl(var(--aifnmjmchg-m-secondary));
	      }
	      #globalNavDrawer .nav-item-icon {
	        width: 32px;
	        height: 32px;
	        border-radius: 8px;
	        display: flex;
	        align-items: center;
	        justify-content: center;
	        font-size: 16px;
	        flex-shrink: 0;
	        background: #F3F5F9;
	      }
	      .dark #globalNavDrawer .nav-item-icon {
	        background: #262626;
	      }
	      .dark #globalNavDrawer .nav-item-icon img {
	        filter: brightness(0) invert(1);
	      }
	      #globalNavDrawer .nav-item-text {
	        flex: 1;
	        font-size: 15px;
	        font-weight: 500;
	        min-width: 0;
	      }
	      #globalNavDrawer .nav-item-count {
	        font-size: 13px;
	        color: hsl(var(--aifnmjmchg-m-muted-foreground));
	      }
	      #globalNavDrawer .nav-item-arrow {
	        width: 16px;
	        height: 16px;
	        color: hsl(var(--aifnmjmchg-m-muted-foreground));
	        flex-shrink: 0;
	      }
	      @media (max-width: 1023px) {
	        #globalNavDrawer .nav-item {
	          padding: 8px 16px;
	          margin: 1px 0;
	        }
	      }
	    `;
	    document.head.appendChild(style);
	  }

	  const categoryIcons = {
	    image: "/aitopia/marketplace/icons/image.svg",
	    video: "/aitopia/marketplace/icons/video.svg",
	    audio: "/aitopia/marketplace/icons/audio-voice.svg",
	    productivity: "/aitopia/marketplace/icons/productivity.svg",
	    marketing: "/aitopia/marketplace/icons/marketing-social.svg",
	    commerce: "/aitopia/marketplace/icons/commerce.svg",
	    dev: "/aitopia/marketplace/icons/dev-data.svg",
	    business: "/aitopia/marketplace/icons/business.svg",
	    all: "/aitopia/marketplace/icons/agents.svg",

	    "audio-voice": "/aitopia/marketplace/icons/audio-voice.svg",
	    "marketing-social": "/aitopia/marketplace/icons/marketing-social.svg",
	    "commerce-websites": "/aitopia/marketplace/icons/commerce.svg",
	    "dev-data": "/aitopia/marketplace/icons/dev-data.svg",
	    models: "/aitopia/marketplace/icons/models.svg",
	    "ai-models": "/aitopia/marketplace/icons/models.svg",
	    "sales-support": "/aitopia/marketplace/icons/sales-support.svg",
	    "industry-packs": "/aitopia/marketplace/icons/business.svg",
	    travel: "/aitopia/marketplace/icons/business.svg",
	    education: "/aitopia/marketplace/icons/education.svg",
	    "text-vision": "/aitopia/marketplace/icons/text-vision.svg",
	  };

	  const categoryGradients = {
	    image: "linear-gradient(135deg, #FF6B6B, #FF8E53)",
	    video: "linear-gradient(135deg, #4ECDC4, #45B7AA)",
	    audio: "linear-gradient(135deg, #667eea, #764ba2)",
	    productivity: "linear-gradient(135deg, #f093fb, #f5576c)",
	    commerce: "linear-gradient(135deg, #00C6FF, #0072FF)",
	    marketing: "linear-gradient(135deg, #ee0979, #ff6a00)",
	    dev: "linear-gradient(135deg, #11998e, #38ef7d)",
	    business: "linear-gradient(135deg, #fa709a, #fee140)",

	    "audio-voice": "linear-gradient(135deg, #667eea, #764ba2)",
	    "commerce-websites": "linear-gradient(135deg, #00C6FF, #0072FF)",
	    "marketing-social": "linear-gradient(135deg, #ee0979, #ff6a00)",
	    "dev-data": "linear-gradient(135deg, #11998e, #38ef7d)",
	    models: "linear-gradient(135deg, #8B5CF6, #6366F1)",
	    "ai-models": "linear-gradient(135deg, #8B5CF6, #6366F1)",
	    "sales-support": "linear-gradient(135deg, #fa709a, #fee140)",
	    "industry-packs": "linear-gradient(135deg, #fa709a, #fee140)",

	    all: "linear-gradient(135deg, #667eea, #764ba2)",
	    default: "linear-gradient(135deg, #667eea, #764ba2)",
	  };

	  function buildNavItem({ href, icon, emoji, title, count }) {
	    const safeHref = typeof href === "string" ? href : "/";
	    const badge =
	      typeof count === "number" ? `<span class="nav-item-count">${count}</span>` : "";

	    let iconContent;
	    if (icon) {
	      iconContent = `<img src="${icon}" alt="" style="width: 18px; height: 18px; object-fit: contain;">`;
	    } else {
	      iconContent = `<span>${emoji || "📱"}</span>`;
	    }

	    return `
	      <a class="nav-item" href="${safeHref}" data-drawer-link="1">
	        <div class="nav-item-icon">
	          ${iconContent}
	        </div>
	        <span class="nav-item-text">${title}</span>
	        ${badge}
	        <svg class="nav-item-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
	          <path d="M9 18l6-6-6-6"></path>
	        </svg>
	      </a>
	    `;
	  }

	  async function renderGlobalDrawerCategories() {
	    const container = document.getElementById("globalDrawerCategoriesList");
	    if (!container) return;

	    container.innerHTML = `<div style="padding: 8px 0; font-size: 13px; color: hsl(var(--aifnmjmchg-m-muted-foreground));">Loading categories…</div>`;

	    try {
	      const res = await fetch("https://aitopia.ai/api/store/categories");
	      if (!res.ok) throw new Error(`Failed to load categories: ${res.status}`);
	      const data = await res.json();
	      const cats = Array.isArray(data?.categories) ? data.categories : [];

	      const totalAgents = cats.reduce((sum, c) => sum + (Number(c?.agentCount) || 0), 0);
	      const visible = cats.filter((c) => c && (c.visible === true || Number(c.agentCount) > 0));

	      let html = buildNavItem({
	        href: "/aitopia/marketplace/agents.html",
	        icon: categoryIcons.all,
	        title: "All Agents",
	        count: totalAgents,
	      });

	      for (const cat of visible) {
	        const id = String(cat.id || "").trim();
	        if (!id) continue;
	        html += buildNavItem({
	          href: `/agents?category=${encodeURIComponent(id)}`,
	          icon: categoryIcons[id] || null,
	          emoji: categoryIcons[id] ? null : "📱",
	          title: String(cat.name || id),
	          count: Number(cat.agentCount) || 0,
	        });
	      }

	      container.innerHTML = html;
	    } catch (e) {
	      console.error(e);
	      container.innerHTML = `<div style="padding: 8px 0; font-size: 13px; color: hsl(var(--aifnmjmchg-m-muted-foreground));">Could not load categories.</div>`;
	    }
	  }

	  function injectGlobalDrawerSections(drawer) {
	    const content = drawer?.querySelector?.(".nav-drawer-content");
	    if (!content) return;
	    if (content.querySelector("#globalDrawerCategoriesList")) return;

	    content.insertAdjacentHTML(
	      "beforeend",
	      `
	        <div class="nav-section" id="globalDrawerNavSection">
	          <h3 class="nav-section-title">Navigation</h3>
	          ${buildNavItem({
	            href: "/",
	            icon: "/aitopia/marketplace/icons/store.svg",
	            title: "Store",
	          })}
	          ${/* Assistant - disabled
	          buildNavItem({
	            href: "/aitopia/marketplace/assistant.html",
	            icon: "/aitopia/marketplace/icons/store.svg",
	            title: "Assistant",
	          })
	          */ ''}
	          ${/* Create Agent - commented out
	          buildNavItem({
	            href: "/aitopia/marketplace/create.html",
	            icon: "/aitopia/marketplace/icons/store.svg",
	            title: "Create Agent",
	          })
	          */ ''}
		          ${buildNavItem({
		            href: "/aitopia/marketplace/outputs.html",
		            icon: "/aitopia/marketplace/icons/creations.png",
		            title: "Creations",
		          })}
	          ${buildNavItem({
	            href: "/aitopia/marketplace/earnings.html",
	            icon: "/aitopia/marketplace/icons/earnings.svg",
	            title: "Earnings",
	          })}
	          ${buildNavItem({
	            href: "/aitopia/marketplace/agents.html",
	            icon: "/aitopia/marketplace/icons/agents.svg",
	            title: "Agents",
	          })}
	          ${buildNavItem({
	            href: "/aitopia/marketplace/models.html",
	            icon: "/aitopia/marketplace/icons/models.svg",
	            title: "Models",
	          })}
	          ${buildNavItem({
	            href: "/aitopia/marketplace/outputs.html",
	            icon: "/aitopia/marketplace/icons/community.svg",
	            title: "Community",
	          })}
	          ${buildNavItem({
	            href: "/aitopia/marketplace/pricing.html",
	            icon: "/aitopia/marketplace/icons/pricing.svg",
	            title: "Pricing",
	          })}
	        </div>

	        <div class="nav-section" id="globalDrawerCategoriesSection">
	          <h3 class="nav-section-title">Agent Categories</h3>
	          <div id="globalDrawerCategoriesList"></div>
	        </div>

	        <div class="nav-section" id="globalDrawerModelTypesSection">
	          <h3 class="nav-section-title">Model Types</h3>
	          ${buildNavItem({
	            href: "/aitopia/marketplace/models.html",
	            icon: "/aitopia/marketplace/icons/models.svg",
	            title: "All Models",
	          })}
	          ${buildNavItem({
	            href: "/models/image",
	            icon: "/aitopia/marketplace/icons/image.svg",
	            title: "Image",
	          })}
	          ${buildNavItem({
	            href: "/models/video",
	            icon: "/aitopia/marketplace/icons/video.svg",
	            title: "Video",
	          })}
	          ${buildNavItem({
	            href: "/models/audio",
	            icon: "/aitopia/marketplace/icons/audio-voice.svg",
	            title: "Audio",
	          })}
	          ${buildNavItem({
	            href: "/models/text",
	            icon: "/aitopia/marketplace/icons/text-vision.svg",
	            title: "Text & Vision",
	          })}
	        </div>
	      `
	    );

	    content.addEventListener("click", (e) => {
	      const link = e.target?.closest?.('a[data-drawer-link="1"]');
	      if (!link) return;
	      const isModified = e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;
	      if (!isModified) window.closeNavDrawer?.();
	    });

	    void renderGlobalDrawerCategories();
	  }

	  function ensureToggleTheme() {
	    if (typeof window.toggleTheme === "function") return;
	    window.toggleTheme = function toggleTheme() {
	      const html = document.documentElement;
      const isDark = html.classList.contains("dark");
      if (isDark) {
        html.classList.remove("dark");
        localStorage.setItem("theme", "light");
      } else {
        html.classList.add("dark");
        localStorage.setItem("theme", "dark");
      }
    };
  }

  function createThemeToggleButton() {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("aria-label", "Toggle theme");
    btn.className =
      "w-10 h-10 rounded-full flex items-center justify-center hover:bg-secondary transition-colors btn-press";
    btn.addEventListener("click", () => {
      try {
        ensureToggleTheme();
        window.toggleTheme();
      } catch (e) {}
    });

    btn.innerHTML = `
      <svg class="w-5 h-5 dark:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-width="2" d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
      </svg>
      <svg class="w-5 h-5 hidden dark:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="5" stroke-width="2"></circle>
        <path stroke-width="2" d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path>
      </svg>
    `;

    return btn;
  }

  function createHamburgerButton() {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = "globalHamburgerBtn";
    btn.className = "hamburger-btn relative";
    btn.setAttribute("aria-label", "Open navigation menu");
    btn.innerHTML = `
      <div class="hamburger-icon">
        <span></span>
        <span></span>
        <span></span>
      </div>
    `;
    btn.addEventListener("click", () => window.toggleNavDrawer?.());
    return btn;
  }

  function ensureHeaderStructure() {
    const header =
      document.getElementById("header") ||
      document.querySelector("body > header.glass") ||
      document.querySelector("header.glass") ||
      document.querySelector("body > header.sticky") ||
      document.querySelector("header.sticky");
    if (!header) return;

    // Don't touch store.html (it has its own drawer + hamburger)
    if (document.getElementById("navDrawer") || document.getElementById("navDrawerOverlay")) return;
    if (header.dataset.globalNavApplied === "1") return;
    header.dataset.globalNavApplied = "1";

    const row =
      header.querySelector(".flex.h-16.items-center.justify-between") ||
      header.querySelector("div.flex.h-16.items-center.justify-between");
    if (!row) return;

    const desktopNav =
      row.querySelector(".hidden.lg\\:flex.items-center") ||
      row.querySelector(".hidden.lg\\:flex.items-center.gap-1") ||
      row.querySelector(".hidden.lg\\:flex");

    const logoLink = row.querySelector('a[href="/marketplace/"], a[href="/marketplace/"]');
    if (logoLink) {
      // Keep the logo href as "/" for SEO/canonical purposes, but route users to /store.
      // This avoids a hard server redirect while still making the UX consistent.
      if (logoLink.dataset.homeRedirectApplied !== "1") {
        logoLink.dataset.homeRedirectApplied = "1";
        logoLink.addEventListener("click", (e) => {
          const isModified = e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;
          if (isModified) return;
          e.preventDefault();
          window.location.assign("/aitopia/marketplace/index.html");
        });
      }

      let leftWrap = logoLink.parentElement;
      const leftWrapIsDirectChild = leftWrap === row;
      const alreadyWrapped =
        !leftWrapIsDirectChild && leftWrap && leftWrap.classList.contains("items-center");

      if (!alreadyWrapped) {
        const wrap = document.createElement("div");
        wrap.className = "flex items-center gap-2";
        row.insertBefore(wrap, logoLink);
        wrap.appendChild(createHamburgerButton());
        wrap.appendChild(logoLink);
      } else {
        if (!leftWrap.querySelector("#globalHamburgerBtn") && !leftWrap.querySelector("#hamburgerBtn")) {
          leftWrap.insertBefore(createHamburgerButton(), logoLink);
        }
      }

      const brandStack = logoLink.querySelector(".flex.flex-col.hidden.sm\\:flex");
      if (brandStack) {
        brandStack.classList.remove("flex", "flex-col");
        brandStack.classList.add("sm:flex", "sm:flex-col");
      }
    }

    const rowHasThemeBtn = row.querySelector('button[aria-label="Toggle theme"]');

    if (desktopNav) {
      const rightWrap = document.createElement("div");
      rightWrap.className = "flex items-center gap-1 flex-shrink-0";

      const insertBefore = desktopNav.nextSibling;
      const parent = desktopNav.parentNode;

      desktopNav.classList.add("lg:flex");
      rightWrap.appendChild(desktopNav);

      const themeInDesktopNav =
        desktopNav.querySelector('button[data-action="NavbarComponent.toggleTheme"]') ||
        desktopNav.querySelector('button[aria-label="Toggle theme"]');

      if (!themeInDesktopNav && !rowHasThemeBtn) {
        const themeBtn = createThemeToggleButton();
        rightWrap.appendChild(themeBtn);
      }
      parent.insertBefore(rightWrap, insertBefore);
    } else if (!rowHasThemeBtn) {
      const rightWrap = document.createElement("div");
      rightWrap.className = "flex items-center gap-1 flex-shrink-0";
      rightWrap.appendChild(createThemeToggleButton());
      row.appendChild(rightWrap);
    }

    // mobile-only notifications button (mirrors desktop notificationsBtn, shown when logged in)
    if (!row.querySelector('#mobileNotificationsBtn')) {
      const mobileNotifBtn = document.createElement("button");
      mobileNotifBtn.id = "mobileNotificationsBtn";
      mobileNotifBtn.type = "button";
      mobileNotifBtn.setAttribute("aria-label", "Notifications");
      mobileNotifBtn.className = "hidden lg:hidden relative h-10 w-10 items-center justify-center rounded-full hover:bg-secondary transition-colors btn-press";
      mobileNotifBtn.innerHTML = `
        <svg class="w-5 h-5 text-foreground/80" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
          <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 01-3.46 0"></path>
        </svg>
        <span id="mobileNotificationsBadge" class="hidden absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-extrabold flex items-center justify-center">0</span>
      `;
      row.appendChild(mobileNotifBtn);
    }

    // mobile-only theme toggle
    const existingMobileToggle = row.querySelector('button.lg\\:hidden[aria-label="Toggle theme"]');
    if (!existingMobileToggle && !row.querySelector('button[aria-label="Toggle theme"]')) {
      const mobileThemeBtn = document.createElement("button");
      mobileThemeBtn.type = "button";
      mobileThemeBtn.setAttribute("aria-label", "Toggle theme");
      mobileThemeBtn.className = "flex lg:hidden w-10 h-10 rounded-full items-center justify-center hover:bg-secondary transition-colors btn-press";
      mobileThemeBtn.addEventListener("click", () => {
        ensureToggleTheme();
        window.toggleTheme();
      });
      mobileThemeBtn.innerHTML = `
        <svg class="w-5 h-5 dark:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-width="2" d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
        <svg class="w-5 h-5 hidden dark:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="5" stroke-width="2"></circle>
          <path stroke-width="2" d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path>
        </svg>
      `;
      row.appendChild(mobileThemeBtn);
    }
  }

  function injectDrawer() {
    if (document.getElementById("navDrawer") || document.getElementById("navDrawerOverlay")) return;
    if (document.getElementById("globalNavDrawer")) return;

    const overlay = document.createElement("div");
    overlay.id = "globalNavDrawerOverlay";
    overlay.className = "nav-drawer-overlay";
    overlay.addEventListener("click", () => window.closeNavDrawer?.());

    const drawer = document.createElement("nav");
    drawer.id = "globalNavDrawer";
    drawer.className = "nav-drawer";
    drawer.setAttribute("role", "navigation");
    drawer.setAttribute("aria-label", "Main navigation");

    drawer.innerHTML = `
      <div class="nav-drawer-header">
        <h2 class="nav-drawer-title">Menu</h2>
        <button class="nav-drawer-close" type="button" aria-label="Close navigation">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M18 6L6 18M6 6l12 12"></path>
          </svg>
        </button>
      </div>
      <div class="nav-drawer-content" style="overflow-y:auto; height:100%; -webkit-overflow-scrolling:touch;">
        <!-- Account Section -->
        <div class="nav-section lg:hidden">
          <h3 class="nav-section-title">Account</h3>

          <!-- Sign in Button -->
          <a href="/aitopia/marketplace/login.html" id="globalDrawerLoginBtn" style="display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px 16px; border-radius: 12px; background: hsl(var(--aifnmjmchg-m-primary)); color: hsl(var(--aifnmjmchg-m-primary-foreground)); font-weight: 600; font-size: 15px; text-decoration: none; transition: opacity 0.15s; margin-top: 8px;" class="hover-fade">
            <svg style="width: 20px; height: 20px;" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"/>
            </svg>
            Sign in
          </a>

          <!-- Logged In State -->
          <div id="globalDrawerLoggedIn" class="hidden" style="margin-top: 8px;">
            <div style="display: flex; align-items: center; gap: 12px; padding: 8px 12px; margin-bottom: 8px;">
              <div style="width: 40px; height: 40px; border-radius: 50%; background: hsl(var(--aifnmjmchg-m-primary) / 0.1); display: flex; align-items: center; justify-content: center;">
                <svg style="width: 20px; height: 20px; color: hsl(var(--aifnmjmchg-m-primary));" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/>
                </svg>
              </div>
              <div style="flex: 1; min-width: 0;">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                  <div id="globalDrawerUserName" style="font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"></div>
                  <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
                    <button id="globalDrawerThemeBtn" type="button" data-action="toggleTheme" aria-label="Toggle theme" style="width:28px;height:28px;border-radius:50%;border:none;background:hsl(var(--aifnmjmchg-m-secondary));cursor:pointer;display:flex;align-items:center;justify-content:center;color:hsl(var(--aifnmjmchg-m-muted-foreground));">
                      <svg id="globalDrawerThemeIconMoon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"/>
                      </svg>
                      <svg id="globalDrawerThemeIconSun" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none;">
                        <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                      </svg>
                    </button>
                    <span id="globalDrawerPlanBadge" style="padding: 2px 8px; font-size: 10px; font-weight: 600; text-transform: uppercase; border-radius: 9999px; background: hsl(var(--aifnmjmchg-m-primary) / 0.1); color: hsl(var(--aifnmjmchg-m-primary));"></span>
                  </div>
                </div>
                <div id="globalDrawerUserEmail" style="font-size: 12px; color: hsl(var(--aifnmjmchg-m-muted-foreground)); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 2px;"></div>
              </div>
            </div>

            <a id="globalDrawerUpgradeBtn" href="/aitopia/marketplace/pricing.html" class="hover-fade" style="display: none; align-items: center; justify-content: center; gap: 6px; margin: 8px 12px 4px 12px; padding: 10px 12px; font-size: 13px; font-weight: 600; border-radius: 10px; background: linear-gradient(to right, #9335EC, #d946ef); color: white; text-decoration: none; transition: opacity 0.15s;">
              <svg style="width: 15px; height: 15px;" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                <path d="M13 10V3L4 14h7v7l9-11h-7z"></path>
              </svg>
              Upgrade
            </a>

            <div id="globalDrawerCreditsDisplay" class="hidden" style="display: none; align-items: center; justify-content: center; gap: 6px; margin: 4px 12px 12px 12px; padding: 10px 12px; background: linear-gradient(135deg, hsl(var(--aifnmjmchg-m-primary) / 0.15), hsl(var(--aifnmjmchg-m-primary) / 0.08)); border-radius: 10px;">
              <svg style="width: 15px; height: 15px; color: hsl(var(--aifnmjmchg-m-primary));" fill="currentColor" viewBox="0 0 14 14">
                <path d="M4.48963 7.68204H5.79855V11.5184C5.79855 12.0831 6.3577 12.3496 6.65422 11.9233L9.86088 7.34104C10.1405 6.94142 9.91595 6.31802 9.49235 6.31802H8.18342V2.48171C8.18342 1.91692 7.62426 1.65051 7.32774 2.07676L4.1211 6.65903C3.84576 7.05864 4.07026 7.68204 4.48963 7.68204Z"></path>
              </svg>
              <span id="globalDrawerCreditsAmount" style="font-size: 13px; font-weight: 700; color: hsl(var(--aifnmjmchg-m-primary));">—</span>
              <span style="font-size: 13px; font-weight: 500; color: hsl(var(--aifnmjmchg-m-muted-foreground));">credits</span>
            </div>

            <div style="display: flex; flex-direction: column;">
              <a id="globalDrawerProfileLink" href="/aitopia/marketplace/settings-profile.html" class="nav-item" data-drawer-link="1">
                <div class="nav-item-icon">
                  <svg style="width: 18px; height: 18px;" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/>
                  </svg>
                </div>
                <span class="nav-item-text">Profile</span>
              </a>
              <a href="/aitopia/marketplace/outputs.html" class="nav-item" data-drawer-link="1">
                <div class="nav-item-icon">
                  <svg style="width: 18px; height: 18px;" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"/>
                  </svg>
                </div>
                <span class="nav-item-text">Creations</span>
              </a>
              <a href="/aitopia/marketplace/earnings.html" class="nav-item" data-drawer-link="1">
                <div class="nav-item-icon">
                  <svg style="width: 18px; height: 18px;" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </div>
                <span class="nav-item-text">Earnings</span>
              </a>
              <a id="globalDrawerDeveloperLink" href="/aitopia/marketplace/developers-dashboard.html" class="nav-item" data-drawer-link="1" style="display: none;">
                <div class="nav-item-icon">
                  <svg style="width: 18px; height: 18px;" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
                    <rect x="3" y="3" width="7" height="7" rx="1"></rect>
                    <rect x="14" y="3" width="7" height="7" rx="1"></rect>
                    <rect x="3" y="14" width="7" height="7" rx="1"></rect>
                    <rect x="14" y="14" width="7" height="7" rx="1"></rect>
                  </svg>
                </div>
                <span class="nav-item-text">Developer Dashboard</span>
              </a>
              <button id="globalDrawerLogoutBtn" type="button" class="nav-item" style="width: 100%; border: none; background: transparent; cursor: pointer; color: #ef4444; text-align: left;">
                <div class="nav-item-icon" style="background: rgba(239, 68, 68, 0.1);">
                  <svg style="width: 18px; height: 18px; color: #ef4444;" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"/>
                  </svg>
                </div>
                <span class="nav-item-text" style="color: #ef4444;">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

	    document.body.appendChild(overlay);
	    document.body.appendChild(drawer);
	    injectGlobalDrawerSections(drawer);

	    drawer.querySelector(".nav-drawer-close")?.addEventListener("click", () => window.closeNavDrawer?.());

    // Sync theme button icon/label on open and on theme change
    function syncDrawerTheme() {
      const isDark = document.documentElement.classList.contains('dark');
      const moon = document.getElementById('globalDrawerThemeIconMoon');
      const sun  = document.getElementById('globalDrawerThemeIconSun');
      if (moon) moon.style.display = isDark ? 'none' : 'block';
      if (sun)  sun.style.display  = isDark ? 'block' : 'none';
    }
    syncDrawerTheme();
    drawer.querySelector("#globalDrawerThemeBtn")?.addEventListener("click", syncDrawerTheme);
	    drawer.querySelector("#globalDrawerLogoutBtn")?.addEventListener("click", async () => {
	      try {
	        clearUserCache();
        await fetch("https://aitopia.ai/auth/logout", { method: "POST", credentials: "include" });
      } catch (e) {
        console.error("Logout error:", e);
      }
      window.location.reload();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") window.closeNavDrawer?.();
    });
  }

  function injectBottomTabBar() {
    if (document.querySelector('nav[data-bottom-tabs="1"]')) {
      try {
        document.body.classList.add("has-bottom-tabs");
      } catch {}
      return;
    }

    const nav = document.createElement("nav");
    nav.setAttribute("data-bottom-tabs", "1");
    nav.className = "fixed bottom-0 left-0 right-0 z-50 glass border-t border-border/40 safe-bottom lg:hidden";

    const path = window.location?.pathname || "";
    // const isFeed = path === "/aitopia/marketplace/feed.html" || path.startsWith("/feed/");
    // const isDiscover = path === "/aitopia/marketplace/discover.html" || path.startsWith("/discover/");
    // const isCreate = path === "/aitopia/marketplace/uap.html" || path.startsWith("/uap/") || path === "/aitopia/marketplace/create.html" || path.startsWith("/create/");
    // const isProfile = path === "/aitopia/marketplace/profile.html" || path.startsWith("/profile/") || path.startsWith("/u/");
    // const isSocialRoute = isFeed || isDiscover || isCreate || isProfile;
    //
    // if (isSocialRoute) {
    //   const feedCls = isFeed ? "text-primary" : "text-muted-foreground hover:text-primary transition-colors";
    //   const discoverCls = isDiscover ? "text-primary" : "text-muted-foreground hover:text-primary transition-colors";
    //   const createCls = isCreate ? "text-primary" : "text-muted-foreground hover:text-primary transition-colors";
    //   const profileCls = isProfile ? "text-primary" : "text-muted-foreground hover:text-primary transition-colors";
    //   const feedCurrent = isFeed ? 'aria-current="page"' : "";
    //   const discoverCurrent = isDiscover ? 'aria-current="page"' : "";
    //   const createCurrent = isCreate ? 'aria-current="page"' : "";
    //   const profileCurrent = isProfile ? 'aria-current="page"' : "";
    //   nav.innerHTML = `
    //     <div class="flex justify-around items-center h-16">
    //       <a href="/aitopia/marketplace/feed.html" aria-label="Feed" ${feedCurrent} class="flex flex-col items-center justify-center gap-0.5 px-3 py-2 ${feedCls}">
    //         <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
    //           <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 6.75h-15A2.25 2.25 0 0 0 2.25 9v8.25A2.25 2.25 0 0 0 4.5 19.5h15A2.25 2.25 0 0 0 21.75 17.25V9A2.25 2.25 0 0 0 19.5 6.75Z"/>
    //           <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 4.5h10.5"/>
    //         </svg>
    //         <span class="text-[10px] font-medium">Feed</span>
    //       </a>
    //       <a href="/aitopia/marketplace/discover.html" aria-label="Discover" ${discoverCurrent} class="flex flex-col items-center justify-center gap-0.5 px-3 py-2 ${discoverCls}">
    //         <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
    //           <circle cx="12" cy="12" r="9"/>
    //           <path stroke-linecap="round" stroke-linejoin="round" d="M15.5 8.5 13 13l-4.5 2.5L11 11l4.5-2.5Z"/>
    //         </svg>
    //         <span class="text-[10px] font-medium">Discover</span>
    //       </a>
    //       <a href="/aitopia/marketplace/uap.html" aria-label="Create" ${createCurrent} class="flex flex-col items-center justify-center gap-0.5 px-3 py-2 ${createCls}">
    //         <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
    //           <path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14M5 12h14"/>
    //         </svg>
    //         <span class="text-[10px] font-medium">Create</span>
    //       </a>
    //       <a id="bottomNavNotifications" href="/marketplace/feed?openNotifications=1" aria-label="Notifications" class="flex flex-col items-center justify-center gap-0.5 px-3 py-2 text-muted-foreground hover:text-primary transition-colors">
    //         <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
    //           <path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5"/>
    //           <path stroke-linecap="round" stroke-linejoin="round" d="M10 20a2 2 0 0 0 4 0"/>
    //         </svg>
    //         <span class="text-[10px] font-medium">Alerts</span>
    //       </a>
    //       <a href="/aitopia/marketplace/settings-profile.html" aria-label="Profile" ${profileCurrent} class="flex flex-col items-center justify-center gap-0.5 px-3 py-2 ${profileCls}">
    //         <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
    //           <circle cx="12" cy="8" r="3.5"/>
    //           <path stroke-linecap="round" stroke-linejoin="round" d="M5 19.5a7 7 0 0 1 14 0"/>
    //         </svg>
    //         <span class="text-[10px] font-medium">Profile</span>
    //       </a>
    //     </div>
    //   `;
    //   document.body.appendChild(nav);
    //   try { document.body.classList.add("has-bottom-tabs"); } catch {}
    //   return;
    // }

    const isStore = path === "/" || path === "/aitopia/marketplace/index.html" || path.startsWith("/store/");
    const isAgents = path === "/aitopia/marketplace/agents.html" || path.startsWith("/agents/") || path.startsWith("/agent/");
    const isModels = path === "/aitopia/marketplace/models.html" || path.startsWith("/models/") || path.startsWith("/model/");
    const isProfile = path === "/aitopia/marketplace/profile.html" || path.startsWith("/profile/") || path.startsWith("/u/");

    const storeCls = isStore ? "text-primary" : "text-muted-foreground hover:text-primary transition-colors";
    const agentsCls = isAgents ? "text-primary" : "text-muted-foreground hover:text-primary transition-colors";
    const modelsCls = isModels ? "text-primary" : "text-muted-foreground hover:text-primary transition-colors";
    const profileCls = isProfile ? "text-primary" : "text-muted-foreground hover:text-primary transition-colors";

    // Consistent bottom navigation across all pages
    nav.innerHTML = `
        <div class="flex justify-around items-center h-[60px]">
          <a href="/aitopia/marketplace/owner.html?owner=store" class="flex flex-col items-center justify-center gap-0.5 px-3 py-2 ${storeCls}">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
              <path d="M9 22V12h6v10"/>
            </svg>
            <span class="text-[10px] font-medium">Home</span>
          </a>
          <a href="/aitopia/marketplace/agents.html" class="flex flex-col items-center justify-center gap-0.5 px-3 py-2 ${agentsCls}">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
              <rect x="3" y="3" width="7" height="7" rx="1"/>
              <rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/>
              <rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
            <span class="text-[10px] font-medium">Agents</span>
          </a>
          <a href="/aitopia/marketplace/models.html" class="flex flex-col items-center justify-center gap-0.5 px-3 py-2 ${modelsCls}">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
              <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
              <path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12"/>
            </svg>
            <span class="text-[10px] font-medium">Models</span>
          </a>
          <a href="/aitopia/marketplace/profile.html" data-bottom-profile class="hidden flex-col items-center justify-center gap-0.5 px-3 py-2 ${profileCls}">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
              <circle cx="12" cy="8" r="3.5"/>
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 19.5a7 7 0 0 1 14 0"/>
            </svg>
            <span class="text-[10px] font-medium">Profile</span>
          </a>
        </div>
      `;

    document.body.appendChild(nav);
    try {
      document.body.classList.add("has-bottom-tabs");
    } catch {}

    // Show profile tab only when logged in
    const profileEl = nav.querySelector('[data-bottom-profile]');
    if (profileEl) {
      const syncHref = () => {
        const href = document.getElementById('profileLink')?.getAttribute('href') || '';
        if (href && href !== "/aitopia/marketplace/settings-profile.html") profileEl.href = href;
      };
      const showProfile = () => {
        const dropdown = document.getElementById('profileDropdown');
        if (dropdown && !dropdown.classList.contains('hidden')) {
          syncHref();
          profileEl.classList.remove('hidden');
          profileEl.classList.add('flex');
        }
      };
      const dropdown = document.getElementById('profileDropdown');
      if (dropdown) {
        new MutationObserver(showProfile).observe(dropdown, { attributes: true, attributeFilter: ['class'] });
      }
      const profileLink = document.getElementById('profileLink');
      if (profileLink) {
        new MutationObserver(syncHref).observe(profileLink, { attributes: true, attributeFilter: ['href'] });
      }
      showProfile();
    }
  }

  function setDrawerOpen(overlay, drawer, open) {
    if (overlay) overlay.classList.toggle("open", Boolean(open));
    if (drawer) drawer.classList.toggle("open", Boolean(open));
  }

  function getLegacyDrawerEls() {
    return {
      overlay: document.getElementById("navDrawerOverlay"),
      drawer: document.getElementById("navDrawer"),
    };
  }

  function getGlobalDrawerEls() {
    return {
      overlay: document.getElementById("globalNavDrawerOverlay"),
      drawer: document.getElementById("globalNavDrawer"),
    };
  }

  window.toggleNavDrawer = function toggleNavDrawer() {
    // Compatibility: some pages still ship a legacy drawer (`#navDrawerOverlay/#navDrawer`).
    // If it exists, prefer it to avoid opening a second overlay.
    const legacy = getLegacyDrawerEls();
    const global = getGlobalDrawerEls();

    if (legacy.overlay || legacy.drawer) {
      setDrawerOpen(global.overlay, global.drawer, false);
      setDrawerOpen(legacy.overlay, legacy.drawer, true);
      return;
    }

    if (global.overlay || global.drawer) {
      setDrawerOpen(global.overlay, global.drawer, true);
    }
  };

  window.closeNavDrawer = function closeNavDrawer() {
    const legacy = getLegacyDrawerEls();
    const global = getGlobalDrawerEls();
    // Always close both to avoid stuck overlays that block clicks.
    setDrawerOpen(legacy.overlay, legacy.drawer, false);
    setDrawerOpen(global.overlay, global.drawer, false);
  };

  async function syncDrawerAuth() {
    const loginBtn = document.getElementById("globalDrawerLoginBtn");
    const loggedIn = document.getElementById("globalDrawerLoggedIn");
    const upgradeBtn = document.getElementById("globalDrawerUpgradeBtn");
    const emailEl = document.getElementById("globalDrawerUserEmail");
    const nameEl = document.getElementById("globalDrawerUserName");
    const planEl = document.getElementById("globalDrawerPlanBadge");
    const creditsWrap = document.getElementById("globalDrawerCreditsDisplay");
    const creditsAmount = document.getElementById("globalDrawerCreditsAmount");
    const developerLink = document.getElementById("globalDrawerDeveloperLink");

    if (!loginBtn || !loggedIn) return;

    const setDeveloperLinkVisible = (visible) => {
      if (!(developerLink instanceof HTMLElement)) return;
      developerLink.style.display = visible ? "flex" : "none";
    };

    const showLoggedOut = () => {
      loginBtn.style.display = "flex";
      loggedIn.style.display = "none";
      if (upgradeBtn) upgradeBtn.style.display = "none";
      if (creditsWrap) creditsWrap.style.display = "none";
      setDeveloperLinkVisible(false);
      developerStatusPromise = null;
    };

    const showLoggedIn = (profileData, credits) => {
      const { fullName, email, plan } = profileData;
      loginBtn.style.display = "none";
      loggedIn.classList.remove("hidden");
      loggedIn.style.display = "block";
      if (upgradeBtn) upgradeBtn.style.display = "flex";
      if (nameEl) nameEl.textContent = fullName;
      if (emailEl) emailEl.textContent = email;
      if (planEl && plan) {
        planEl.textContent = plan.toUpperCase();
        planEl.style.display = "inline-block";
      } else if (planEl) {
        planEl.style.display = "none";
      }
      if (creditsAmount) creditsAmount.textContent = credits !== null ? String(credits) : "—";
      if (creditsWrap && credits !== null) {
        creditsWrap.classList.remove("hidden");
        creditsWrap.style.display = "flex";
      }
      setDeveloperLinkVisible(false);
      void fetchIsDeveloper().then((isDeveloper) => {
        setDeveloperLinkVisible(Boolean(isDeveloper));
      });
      void updateDrawerProfileLink();
    };

    async function updateDrawerProfileLink() {
      const link = document.getElementById("globalDrawerProfileLink");
      if (!link) return;
      try {
        const res = await fetch("https://aitopia.ai/api/users/me", { method: "GET", credentials: "include" });
        if (!res.ok) return;
        const json = await res.json();
        const username = json?.profile?.username;
        if (username) link.href = "/aitopia/marketplace/profile.html?username=" + encodeURIComponent(username);
      } catch (e) {}
    }

    const cachedProfile = getUserProfile();
    const cachedCredits = getUserCredits();

    if (cachedProfile) {
      showLoggedIn(cachedProfile, cachedCredits);
      if (cachedCredits === null) {
        try {
          let balanceData;
          if (window.AitopiaCredits?.loadCreditsBalance) {
            balanceData = await window.AitopiaCredits.loadCreditsBalance();
          } else {
            const res = await fetch("https://aitopia.ai/api/credits/balance", { credentials: "include" });
            if (res.ok) balanceData = await res.json();
          }
          if (balanceData?.balance) {
            const totalCredits = balanceData.balance.totalCredits ?? balanceData.balance.totalCreditsRemaining ?? 0;
            setUserCredits(totalCredits);
            if (creditsAmount) creditsAmount.textContent = String(totalCredits);
            if (creditsWrap) {
              creditsWrap.classList.remove("hidden");
              creditsWrap.style.display = "flex";
            }
          }
        } catch {}
      }
      return;
    }

    try {
      const response = await fetch("https://aitopia.ai/auth/me", { method: "GET", credentials: "include" });
      if (!response.ok) throw new Error("not ok");
      const resp = await response.json();
      const userData = resp?.data?.user || resp?.data || resp?.user || resp;
      const isLoggedIn = userData && !Array.isArray(userData) && typeof userData === "object" && (userData.email || userData.key);

      if (isLoggedIn) {
        const email = userData.email || "";
        const name = userData.name || "";
        const lastname = userData.lastname || "";
        const fullName = [name, lastname].filter(Boolean).join(" ") || (email ? email.split("@")[0] : "User");
        const plan = resp?.data?.plan || resp?.data?.licences?.plan_type || userData.plan || userData.planName || "";
        const licences = resp?.data?.licences || null;

        const profileData = { fullName, email, plan, licences};
        setUserProfile(profileData);

        let credits = null;
        try {
          let balanceData;
          if (window.AitopiaCredits?.loadCreditsBalance) {
            balanceData = await window.AitopiaCredits.loadCreditsBalance();
          } else {
            const res = await fetch("https://aitopia.ai/api/credits/balance", { credentials: "include" });
            if (res.ok) balanceData = await res.json();
          }
          if (balanceData?.balance) {
            credits = balanceData.balance.totalCredits ?? balanceData.balance.totalCreditsRemaining ?? 0;
            setUserCredits(credits);
          }
        } catch {}

        showLoggedIn(profileData, credits);
        return;
      }
    } catch {}

    showLoggedOut();
  }

  function injectHeaderCss() {
    const css = {
      dark: ["/aitopia/marketplace/css/vendor/github-dark.min.css"],
      light: ["/aitopia/marketplace/css/vendor/github.min.css"],
    };
    let inject_html = "";
    document.querySelectorAll(".headerCss").forEach(item => {
      item.remove()
    });
    if (document.documentElement.classList.contains("dark") == true) {
      css["dark"].forEach((cssItem) => {
        inject_html += `<link rel="stylesheet" class="headerCss" href="${cssItem}">`;
      });
    } else {
      css["light"].forEach((cssItem) => {
        inject_html += `<link rel="stylesheet" class="headerCss" href="${cssItem}">`;
      });
    }
    document.querySelector("head").innerHTML += inject_html;
  }

  function setUrlCookie() {
    
    const currentPath = window.location.pathname;
    const unListingPages = ["pricing", "login", "register"];
    let checkPage = true;
    unListingPages.forEach((item) => {
      if (currentPath.indexOf(`/${item}`) !== -1) {
        checkPage = false;
      }
    });

    const cookieValue = checkPage
      ? window.location.href
      : window.location.origin;

    const expires = new Date(Date.now() + 3600000).toUTCString(); // 1 hour
    document.cookie = `aitopia_last_url=${encodeURIComponent(cookieValue)}; expires=${expires}; path=/; Secure; SameSite=None; Domain=.aitopia.ai`;

  }

  function init() {
    injectDrawerStyles();
    ensureToggleTheme();
    ensureHeaderStructure();
    injectDrawer();
    injectBottomTabBar();
    setTimeout(syncDrawerAuth, 1000);
    setUrlCookie();
    window.addEventListener('aifnmjmchg-credits-updated', (e) => {
      const totalCredits = e.detail?.balance?.totalCredits ?? e.detail?.balance?.totalCreditsRemaining;
      if (typeof totalCredits === 'number') {
        setUserCredits(totalCredits);
        const creditsAmount = document.getElementById("globalDrawerCreditsAmount");
        if (creditsAmount) creditsAmount.textContent = String(totalCredits);
      }
    });

    try {
      document.documentElement.classList.remove("global-nav-loading");
      document.documentElement.classList.add("global-nav-ready");
    } catch (e) {}
    clearTimeout(unhideFailsafe);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
  window.injectHeaderCss = injectHeaderCss;
  window.injectHeaderCss();
})();
