import PromoModal from '/aitopia/marketplace/js/components/promo-modal.js';
import PromoTicket from '/aitopia/marketplace/js/components/promo-ticket.js';

const PLANS_ENDPOINT = "/auth/get_plans";
const PLAN_ORDER = { basic: 1, pro: 2, premium: 3, creator: 4 };
const PLAN_DESCRIPTIONS = {
  basic: "For beginners first exploring AI creation",
  pro: "For enthusiasts creating occasionally",
  premium: "The smart choice for pros creating daily",
  creator: "For experts scaling production to the max",
};
const PLAN_CREDIT_COLOR = "#9335EC";

// Static model comparison data (credits per generation, USD_PER_CREDIT = $0.02)
const MODEL_COMPARISON = {
  video: [
    { name: 'Kling 2.5 Turbo',    sub: '5s · 18 credits', credits: 18,  minPlan: 'basic'   },
    { name: 'Kling 1.6 Pro',      sub: '5s · 24 credits', credits: 24,  minPlan: 'basic'   },
    { name: 'Seedance 1.5 Pro',   sub: '5s · 30 credits', credits: 30,  minPlan: 'pro'     },
    { name: 'Google Veo 3 Fast',  sub: '5s · 38 credits', credits: 38,  minPlan: 'pro'     },
    { name: 'Kling 2.1 Master',   sub: '5s · 70 credits', credits: 70,  minPlan: 'premium' },
    { name: 'Google Veo 3',       sub: '5s · 100 credits',credits: 100, minPlan: 'premium' },
  ],
  image: [
    { name: 'FLUX Schnell',       sub: '1 credit/image',  credits: 1,   minPlan: 'basic'   },
    { name: 'Nano Banana',        sub: '2 credits/image', credits: 2,   minPlan: 'basic'   },
    { name: 'Seedream 4.5',       sub: '2 credits/image', credits: 2,   minPlan: 'basic'   },
    { name: 'FLUX 1.1 Pro',       sub: '2 credits/image', credits: 2,   minPlan: 'basic'   },
    { name: 'DALL-E 3',           sub: '6 credits/image', credits: 6,   minPlan: 'pro'     },
    { name: 'Nano Banana Pro',    sub: '15 credits/image',credits: 15,  minPlan: 'pro'     },
  ],
};

const PAYMENT_BASE_URL = "https://chat.aitopia.ai";
const PAYMENT_PATH = "/payment";
const AUTH_BOOTSTRAP_TIMEOUT_MS = 5000;
const PLANS_FETCH_TIMEOUT_MS = 8000;
const PLANS_MAX_ATTEMPTS = 2;

let currentPeriod = "year";
let plansResponse = null;

const getUserProfile = () => window.AitopiaCache?.getUserProfile?.() ?? null;
window.AitopiaProfile = getUserProfile();
window.AitopiaLicences = null;
if (window.AitopiaProfile == null) {
  let bootstrapTimeout = null;
  try {
    const controller = new AbortController();
    bootstrapTimeout = setTimeout(
      () => controller.abort(),
      AUTH_BOOTSTRAP_TIMEOUT_MS,
    );
    const response = await fetch("https://aitopia.ai/auth/me", {
      method: "GET",
      credentials: "include",
      signal: controller.signal,
    });
    const me = response.ok ? await response.json() : null;
    if (me?.data) {
      window.AitopiaLicences = me?.data?.licences || null;
      window.AitopiaProfile = getUserProfile();
    }
  } catch (error) {
    console.warn(
      "[pricing] /auth/me bootstrap failed, continuing without profile",
      error,
    );
  } finally {
    if (bootstrapTimeout) clearTimeout(bootstrapTimeout);
  }
}

if (window.AitopiaProfile?.licences)
  window.AitopiaLicences = window.AitopiaProfile?.licences;

function shouldHidePromo() {
  const plan = (window.AitopiaLicences?.plan_type || window.AitopiaProfile?.plan || '').toLowerCase();
  return plan === 'creator';
}
function switchPricing(period) {
  if (typeof period === 'undefined') {
    period = currentPeriod;
    const _t = document.getElementById('pricingToggle');
    const _s = document.getElementById('pricingSwitch');
    if (_s) _s.classList.toggle('active-year', period === 'year');
    if (_t) _t.querySelectorAll('.pricing-toggle-label').forEach((l) => {
      const sel = l.getAttribute('data-value') === period;
      l.classList.toggle('active', sel);
      l.setAttribute('aria-selected', sel);
    });
    return;
  }
  if (currentPeriod === period) return;

  currentPeriod = period;
  const toggle = document.getElementById("pricingToggle");
  if (!toggle) return;

  const switchEl = document.getElementById("pricingSwitch");
  if (switchEl) {
    switchEl.classList.toggle("active-year", period === "year");
  }

  toggle.querySelectorAll(".pricing-toggle-label").forEach((label) => {
    const isSelected = label.getAttribute("data-value") === period;
    label.classList.toggle("active", isSelected);
    label.setAttribute("aria-selected", isSelected);
  });

  renderPricing();
  if (window.AitopiaLicences) {
    //border-gray-200 bg-gray-50 text-gray-500 shadow-none dark:border-gray-700 dark:bg-gray-800/20
    const element = document.querySelector(
      `[data-plan="${window.AitopiaLicences.plan_type}"][data-cycle="${window.AitopiaLicences.cycle}"]`,
    );
    if (element) {
      element.setAttribute(
        "class",
        element.getAttribute("class") +
          " border-gray-200 bg-gray-50 shadow-none dark:border-gray-700 dark:bg-gray-800/20 text-gray-400 cursor-no-drop",
      );
      // element.classList.add(
      //   "border-gray-200 bg-gray-50 text-gray-500 shadow-none dark:border-gray-700 dark:bg-gray-800/20",
      // );
      element.innerHTML = "Current Plan";
      element.setAttribute("href", "./pricing#");
    }
  }
}

function toggleFaq(index) {
  const faqItems = document.querySelectorAll(".faq-item");
  const clickedItem = faqItems[index];
  const isActive = clickedItem.classList.contains("active");
  const button = clickedItem.querySelector(".faq-question");

  faqItems.forEach((item, idx) => {
    item.classList.remove("active");
    const btn = item.querySelector(".faq-question");
    if (btn) btn.setAttribute("aria-expanded", "false");
  });

  if (!isActive) {
    clickedItem.classList.add("active");
    if (button) button.setAttribute("aria-expanded", "true");
  }
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function parseMoney(value) {
  const n = Number.parseFloat(String(value).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function formatUsd(value) {
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  return `$${safe.toFixed(2)}`;
}

function formatInt(value) {
  const n = Number.parseFloat(String(value).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n)) return String(value ?? "");
  return Math.round(n).toLocaleString();
}

function getPaymentUrl(planType, cycle) {
  const planParam = String(planType || "").toLowerCase();

  const url = new URL(PAYMENT_PATH, PAYMENT_BASE_URL);
  url.searchParams.set("plan", planParam);
  url.searchParams.set("cycle", cycle);

  return url.toString();
}

function getVisiblePlans() {
  let packages = plansResponse?.packages ?? [];
  packages = packages.filter((p) => String(p?.is_visible) === "1");
  const currentPlanType = window.AitopiaLicences?.plan_type?.toLowerCase();
  if (currentPlanType && currentPlanType !== "free") {
    packages = packages.filter(
      (p) => String(p?.plan_type || "").toLowerCase() !== currentPlanType,
    );
  }
  const count = packages?.length || 4;
  const grid = document.getElementById("pricingGrid");
  if (grid) grid.style.setProperty("--grid-cols", count);
  return packages;
}

function sortPlans(plans) {
  return [...plans].sort((a, b) => {
    const ao = PLAN_ORDER[String(a?.plan_type).toLowerCase()] ?? 99;
    const bo = PLAN_ORDER[String(b?.plan_type).toLowerCase()] ?? 99;
    if (ao !== bo) return ao - bo;
    return parseMoney(a?.month_price) - parseMoney(b?.month_price);
  });
}

function planMonthlyDisplayPrice(plan) {
  if (currentPeriod === "month") return parseMoney(plan?.month_price);
  const yearly = parseMoney(plan?.year_price);
  return yearly / 12;
}
function planMonthlyDisplayListPrice(plan) {
  if (currentPeriod === "month") return parseMoney(plan?.month_list_price);
  const yearly = parseMoney(plan?.year_list_price);
  return yearly / 12;
}

function createLoadingCard(isFeatured = false) {
  const baseClasses =
    "bg-card rounded-3xl p-10 border relative transition-all min-h-[600px] flex flex-col text-center";
  const borderClass = isFeatured ? "border-primary scale-105" : "border-border";
  const badgeAttr = isFeatured ? 'data-badge="Popular"' : "";

  return `<div class="${baseClasses} ${borderClass} ${isFeatured ? "featured" : ""}" ${badgeAttr}>
        <div class="skeleton skeleton-text-lg mx-auto" style="width: 60%;"></div>
        <div class="skeleton skeleton-text-sm mx-auto" style="width: 40%;"></div>
        <div class="skeleton skeleton-price"></div>
        <div class="skeleton skeleton-text-sm mx-auto" style="width: 50%;"></div>
        <div class="skeleton skeleton-text-sm mx-auto" style="width: 55%;"></div>
        <div class="flex-1 flex flex-col items-center justify-center my-8">
          <div class="skeleton skeleton-feature"></div>
          <div class="skeleton skeleton-feature"></div>
          <div class="skeleton skeleton-feature"></div>
          <div class="skeleton skeleton-feature" style="width: 70%;"></div>
        </div>
        <div class="skeleton skeleton-button"></div>
      </div>`;
}

function renderPricingLoading() {
  const grid = document.getElementById("pricingGrid");
  if (!grid) return;
  grid.innerHTML =
    createLoadingCard() +
    createLoadingCard() +
    createLoadingCard() +
    createLoadingCard();
}

function renderPricingError(message) {
  const grid = document.getElementById("pricingGrid");
  if (!grid) return;
  grid.innerHTML = `
        <div class="bg-card rounded-3xl p-10 border border-border relative transition-all min-h-[600px] flex flex-col text-center col-span-full">
          <h3 class="text-2xl font-bold mb-2">Plans unavailable</h3>
          <p class="text-muted-foreground mb-4">${escapeHtml(message || "Please try again later.")}</p>
          <button data-action="loadPlans" class="mt-4 w-full py-3.5 px-6 rounded-xl font-semibold inline-flex items-center justify-center transition-all border-0 cursor-pointer bg-secondary text-secondary-foreground border border-border hover:bg-muted active:scale-95">
            Retry
          </button>
        </div>
      `;
}

function createPriceCard(plan, isFeatured) {
  const price = planMonthlyDisplayPrice(plan);
  const list_price = planMonthlyDisplayListPrice(plan);
  const billedAnnually = parseMoney(plan?.year_price);
  const planName = escapeHtml(plan?.name ?? "");
  const type = escapeHtml(String(plan?.plan_type || "").toLowerCase());
  const planDescription = PLAN_DESCRIPTIONS[type] || "";

  const yearDiscount = parseMoney(plan?.year_discount);
  const showDiscount = currentPeriod === "year" && yearDiscount > 0;
  const discountPercent = Math.round(yearDiscount);
  const monthlyPrice = parseMoney(plan?.month_price);
  const yearlyPrice = parseMoney(plan?.year_price);
  const yearlySavings = Math.round(monthlyPrice * 12 - yearlyPrice);

  const agent = plan?.plan_detail?.agent ?? "";
  const features = plan?.plan_details;

  const isPremium = isFeatured;
  const isBestValue = type === "creator";

  const titleColor   = isPremium ? "var(--plan-premium-accent)" : isBestValue ? "var(--plan-creator-accent)" : "var(--plan-default-title)";
  const creditsColor = isBestValue ? "var(--plan-creator-accent)" : "var(--plan-premium-accent)";
  const accentColor  = isPremium ? "var(--plan-premium-accent)" : isBestValue ? "var(--plan-creator-accent)" : "#6b7280";

  const hasBanner = isPremium || isBestValue;

  const cardBorderStyle = isPremium
    ? "border:2px solid var(--plan-premium-accent);"
    : isBestValue
    ? "border:2px solid var(--plan-creator-accent);"
    : "border:1px solid var(--plan-default-outer-border);";

  const outerCardBg = hasBanner
    ? (isPremium ? "background:var(--plan-premium-outer-bg);" : "background:var(--plan-creator-outer-bg);")
    : "background:var(--plan-default-outer-bg);";

  const cardBg = isPremium
    ? "background:var(--plan-premium-card-bg);"
    : isBestValue
    ? "background:var(--plan-creator-card-bg);"
    : "background:var(--plan-default-card-bg);";

  const innerBorder = isPremium ? "var(--plan-premium-inner-border)" : isBestValue ? "var(--plan-creator-inner-border)" : "var(--plan-default-inner-border)";
  const innerBg     = isPremium ? "var(--plan-premium-inner-bg)"     : isBestValue ? "var(--plan-creator-inner-bg)"     : "var(--plan-default-inner-bg)";

  const topBanner = isPremium
    ? `<div style="background:var(--plan-premium-accent);color:var(--plan-premium-fg);text-align:center;padding:7px 16px;font-size:12px;font-weight:600;letter-spacing:0.06em;font-family:'Inter',sans-serif;">Most Popular</div>`
    : isBestValue
    ? `<div style="background:var(--plan-creator-accent);color:var(--plan-creator-fg);text-align:center;padding:7px 16px;font-size:12px;font-weight:600;letter-spacing:0.06em;font-family:'Inter',sans-serif;">Best Value</div>`
    : "";

  const offBadge = showDiscount && discountPercent > 0
    ? `<span style="background:${isBestValue ? "var(--plan-creator-accent)" : "var(--plan-premium-accent)"};color:${isBestValue ? "var(--plan-creator-fg)" : "var(--plan-premium-fg)"};font-size:11px;font-weight:700;padding:3px 10px;border-radius:100px;white-space:nowrap;font-family:'Inter',sans-serif;">${discountPercent}% OFF</span>`
    : "";

  const btnStyle = isPremium
    ? "background:var(--plan-premium-accent);color:var(--plan-premium-fg);border:none;"
    : isBestValue
    ? "background:var(--plan-creator-accent);color:var(--plan-creator-fg);border:none;"
    : "background:transparent;color:var(--plan-default-btn-text);border:1px solid var(--plan-default-btn-border);";

  const _badgeBg   = isBestValue ? 'var(--plan-creator-accent)' : 'var(--plan-premium-accent)';
  const _badgeText = isBestValue ? 'var(--plan-creator-fg)' : 'var(--plan-premium-fg)';

  let itemBadge = (data, is_true = true) => {
    return data
      .toString()
      .split("#")
      .map((item) => {
        return `<span class="lowercase rounded-md font-medium whitespace-nowrap py-1 px-2 text-[10px] leading-[14px] tracking-tight ${is_true == true ? "" : "dark:bg-[#272727] dark:text-[#898A8B] bg-neutral-200"}" style="${is_true == true ? `background:${_badgeBg};color:${_badgeText};` : ''}">${item}</span>`;
      })
      .join("  ");
  };

  const contentRadius = hasBanner ? "border-radius:20px 20px 0 0;" : "";
  const topSpacer = hasBanner ? "" : `<div style="padding:7px 16px;font-size:12px;visibility:hidden;" aria-hidden="true">x</div>`;

  return `
    <div class="price-card rounded-3xl relative flex flex-col text-left overflow-hidden transition-all hover:scale-[1.01]" style="${outerCardBg} ${cardBorderStyle} min-height:600px;">
      ${topBanner}${topSpacer}
      <div class="px-6 py-6 flex flex-col flex-1" style="${contentRadius}${cardBg}">

        <!-- Title + OFF badge -->
        <div class="flex items-center gap-2 mb-1">
          <h3 class="text-2xl font-bold" style="color:${titleColor};font-family:'Inter',sans-serif;">${planName}</h3>
          ${offBadge}
        </div>
        <p style="color:#6b7280;font-size:0.8rem;font-family:'Inter',sans-serif;" class="mb-4">${planDescription}</p>

        <!-- Price row -->
        <div class="mb-3">
          <div class="flex items-baseline gap-2">
            ${list_price > 0 && list_price > price ? `<span style="color:#6b7280;font-size:1rem;text-decoration:line-through;">${formatUsd(list_price)}</span>` : ""}
            <span style="color:var(--plan-default-title);font-size:1.5rem;font-weight:800;line-height:1;font-family:'Inter',sans-serif;">${formatUsd(price)}</span>
            <span style="color:#6b7280;font-size:0.875rem;">/mo</span>
          </div>
          ${showDiscount ? `<p style="color:#6b7280;font-size:0.8rem;margin-top:4px;font-family:'Inter',sans-serif;">${formatUsd(billedAnnually)} billed annually</p>` : ""}
        </div>

        <!-- CTA box (bordered) -->
        <div style="border:1px solid ${innerBorder};background:${innerBg};border-radius:16px;padding:16px;margin-bottom:12px;">
          <a href="${getPaymentUrl(type, currentPeriod)}"
             class="price-select-btn w-full py-3.5 px-6 rounded-xl font-semibold no-underline inline-flex items-center justify-center cursor-pointer"
             style="${btnStyle}font-family:'Inter',sans-serif;"
             data-plan="${type}" data-cycle="${currentPeriod}">
            Select Plan
          </a>
          ${yearlySavings > 0 ? `<p style="text-align:center;color:${accentColor};font-size:0.8rem;margin-top:10px;margin-bottom:0;font-family:'Inter',sans-serif;">Save $${yearlySavings} / year</p>` : ""}
        </div>

        <!-- Features box (bordered) -->
        <div style="border:1px solid ${innerBorder};background:${innerBg};border-radius:16px;padding:16px;flex:1;display:flex;flex-direction:column;">
          <!-- Credits -->
          <div class="flex items-center gap-2 mb-3">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" style="flex-shrink:0;"><path d="M3.33422 11.6667C3.17653 11.6673 3.02191 11.623 2.88835 11.5392C2.75479 11.4554 2.64775 11.3354 2.57968 11.1931C2.51161 11.0509 2.4853 10.8922 2.5038 10.7356C2.52231 10.579 2.58487 10.4309 2.68422 10.3084L10.9342 1.80839C10.9961 1.73696 11.0804 1.68868 11.1734 1.6715C11.2663 1.65431 11.3623 1.66923 11.4457 1.71381C11.529 1.75838 11.5947 1.82997 11.632 1.91681C11.6693 2.00365 11.676 2.10059 11.6509 2.19172L10.0509 7.20839C10.0037 7.33466 9.98786 7.47049 10.0047 7.60423C10.0216 7.73797 10.0706 7.86562 10.1476 7.97624C10.2247 8.08686 10.3274 8.17715 10.447 8.23935C10.5665 8.30156 10.6994 8.33383 10.8342 8.33339H16.6676C16.8253 8.33285 16.9799 8.37707 17.1134 8.46091C17.247 8.54474 17.354 8.66476 17.4221 8.80701C17.4902 8.94926 17.5165 9.1079 17.498 9.26451C17.4795 9.42111 17.4169 9.56926 17.3176 9.69172L9.06756 18.1917C9.00567 18.2632 8.92134 18.3114 8.8284 18.3286C8.73547 18.3458 8.63945 18.3309 8.55611 18.2863C8.47278 18.2417 8.40707 18.1701 8.36978 18.0833C8.33248 17.9965 8.32582 17.8995 8.35089 17.8084L9.95089 12.7917C9.99807 12.6655 10.0139 12.5296 9.99706 12.3959C9.98021 12.2621 9.93117 12.1345 9.85415 12.0239C9.77712 11.9132 9.67441 11.823 9.55483 11.7608C9.43524 11.6985 9.30235 11.6663 9.16756 11.6667H3.33422Z" style="stroke:${creditsColor}" stroke-width="1.66667" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span style="color:${creditsColor};font-size:0.875rem;font-weight:600;font-family:'Inter',sans-serif;">${Number(agent).toLocaleString()} Credits Per Month</span>
          </div>

          <!-- Divider -->
          <hr style="border:none;border-top:1px solid var(--plan-divider);margin:0 0 12px;">

          <!-- Features -->
          <ul class="price-features list-none flex-1 flex flex-col" style="gap:0;">
            <li class="py-2 flex items-center gap-3">
              <svg width="16" height="16" viewBox="0 0 22 22" fill="none" style="flex-shrink:0;"><path d="M11 21C16.5228 21 21 16.5228 21 11C21 5.47715 16.5228 1 11 1C5.47715 1 1 5.47715 1 11C1 16.5228 5.47715 21 11 21Z" style="stroke:${creditsColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 11L10 13L14 9" style="stroke:${creditsColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              <span style="color:var(--plan-default-title);font-size:0.875rem;font-family:'Inter',sans-serif;">${agent} Agent Queries/Month</span>
            </li>
            ${features?.map((f) => {
              const checkSvg = (color) => `<svg width="16" height="16" viewBox="0 0 22 22" fill="none" style="flex-shrink:0;"><path d="M11 21C16.5228 21 21 16.5228 21 11C21 5.47715 16.5228 1 11 1C5.47715 1 1 5.47715 1 11C1 16.5228 5.47715 21 11 21Z" style="stroke:${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 11L10 13L14 9" style="stroke:${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
              const xSvg = `<svg width="16" height="16" viewBox="0 0 22 22" fill="none" style="flex-shrink:0;"><path d="M11 21C16.523 21 21 16.523 21 11C21 5.477 16.523 1 11 1C5.477 1 1 5.477 1 11C1 16.523 5.477 21 11 21Z" stroke="#9CA3AF" stroke-width="2" stroke-linejoin="round"/><path d="M13.8289 8.17151L8.17188 13.8285M8.17188 8.17151L13.8289 13.8285" stroke="#9CA3AF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
              let html = "";
              if (f?.items) {
                html += `<div class="py-2 text-sm w-full mt-3 font-semibold" style="color:#6b7280;font-family:'Inter',sans-serif;letter-spacing:0.03em;text-transform:uppercase;font-size:0.7rem;">${f.name}</div>`;
                html += Object.values(f.items).map((item) => {
                  const isTrue = item.is_true == "1";
                  const icon = isTrue ? checkSvg(creditsColor) : xSvg;
                  const textColor = isTrue ? "var(--plan-default-title)" : '#9CA3AF';
                  let row = `<li ${item.tooltip ? 'data-tooltip="' + item.tooltip + '"' : ""} class="py-2 flex items-start gap-2">${icon}<div class="flex-1 min-w-0 flex flex-wrap justify-between items-center gap-x-2 gap-y-1"><span style="color:${textColor};font-size:0.875rem;font-family:'Inter',sans-serif;">${item.name}${item.tooltip ? ' <span style="color:#6b7280;font-size:0.8rem;">ⓘ</span>' : ""}</span>`;
                  if (item.badge) row += `<span class="flex items-center gap-1 flex-shrink-0">${itemBadge(item.badge, item.is_true)}</span>`;
                  row += "</div></li>";
                  return row;
                }).join("");
              } else {
                const isTrue = f.is_true == "1";
                const icon = isTrue ? checkSvg(creditsColor) : xSvg;
                const textColor = isTrue ? "var(--plan-default-title)" : '#9CA3AF';
                html += `<li ${f.tooltip ? 'data-tooltip="' + f.tooltip + '"' : ""} class="py-2 flex items-start gap-2">${icon}<div class="flex-1 min-w-0 flex flex-wrap justify-between items-center gap-x-2 gap-y-1"><span style="color:${textColor};font-size:0.875rem;font-family:'Inter',sans-serif;">${f.name}${f.tooltip ? ' <span style="color:#6b7280;font-size:0.8rem;">ⓘ</span>' : ""}</span>`;
                if (f.badge) html += `<span class="flex items-center gap-1 flex-shrink-0">${itemBadge(f.badge, f.is_true)}</span>`;
                html += "</div></li>";
              }
              return html;
            }).join("")}
          </ul>
        </div>
      </div>
    </div>
  `;
}

function updateSavingsText() {
  const savingsText = document.getElementById("savingsText");
  if (!savingsText || !plansResponse?.packages) return;

  const discounts = plansResponse.packages
    .filter((plan) => plan.is_visible === "1" && plan.year_discount)
    .map((plan) => parseFloat(plan.year_discount))
    .filter((discount) => discount > 0);

  if (discounts.length === 0) {
    savingsText.textContent = "";
    return;
  }

  const minDiscount = Math.min(...discounts);
  const maxDiscount = Math.max(...discounts);
  const minPercent = Math.round(minDiscount);
  const maxPercent = Math.round(maxDiscount);

  if (minPercent === maxPercent) {
    savingsText.innerHTML = `Save <span class="text-primary font-semibold">${minPercent}%</span> with annual plans!`;
  } else {
    savingsText.innerHTML = `Save <span class="text-primary font-semibold">${minPercent}% - ${maxPercent}%</span> with annual plans!`;
  }
}

function renderPricing() {
  const grid = document.getElementById("pricingGrid");
  if (!grid) return;

  const visible = sortPlans(getVisiblePlans());
  if (!visible.length) {
    grid.innerHTML = `
          <div class="bg-card rounded-3xl p-10 border border-border relative transition-all min-h-[600px] flex flex-col text-center col-span-full">
            <h3 class="text-2xl font-bold mb-2">No plans found</h3>
            <p class="text-muted-foreground">Please try again later.</p>
          </div>
        `;
    return;
  }

  updateSavingsText();

  const cards = visible.map((plan) => {
    const type = String(plan?.plan_type || "").toLowerCase();
    const isFeatured = type === "premium";
    return createPriceCard(plan, isFeatured);
  });

  grid.innerHTML = cards.join("");
  renderComparePlans(visible);
}

function renderComparePlans(plans) {
  const el = document.getElementById("comparePlansTable");
  if (!el || !plans?.length) return;

  plans.forEach((p) => {
    p._featureMap = {};
    p.plan_details?.forEach((f) => {
      if (f.items) {
        Object.values(f.items).forEach((item) => { p._featureMap[item.name] = item; });
      } else {
        p._featureMap[f.name] = f;
      }
    });
  });

  const template = plans.reduce((max, p) =>
    (p.plan_details?.length || 0) > (max.plan_details?.length || 0) ? p : max, plans[0]);

  const checkIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" style="fill:var(--plan-premium-accent-subtle)"/><path d="M8 12l3 3 5-5" style="stroke:var(--plan-premium-accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const xIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#374151" stroke-width="1.5"/><path d="M9 9l6 6M15 9l-6 6" stroke="#4b5563" stroke-width="1.5" stroke-linecap="round"/></svg>`;

  const planAccentColor = (p) => {
    const t = String(p?.plan_type || "").toLowerCase();
    if (t === "premium") return "var(--plan-premium-accent)";
    if (t === "creator") return "var(--plan-creator-accent)";
    return "var(--plan-default-title)";
  };

  // ── MOBILE: tab-based
  const buildMobilePanel = (plan) => {
    const type = String(plan?.plan_type || "").toLowerCase();
    const color = planAccentColor(plan);
    const price = currentPeriod === "year" ? (plan.price_year ?? plan.price_month) : plan.price_month;
    const isPremium = type === "premium";
    const isCreator = type === "creator";
    const btnBg = isPremium ? "var(--plan-premium-accent)" : isCreator ? "var(--plan-creator-accent)" : "transparent";
    const btnColor = isCreator ? "var(--plan-creator-fg)" : "#fff";
    const btnBorder = (!isPremium && !isCreator) ? "1px solid var(--plan-default-btn-border)" : "none";

    // Light/dark adaptive colors via CSS tokens
    const mHeadingColor = 'var(--compare-heading)';
    const mTextColor    = 'var(--compare-text)';
    const mSubColor     = 'var(--compare-sub)';
    const mValColor     = 'var(--compare-text)';
    const mBadgeColor   = 'var(--compare-badge)';
    const mBorder       = 'var(--compare-border)';
    const mCardBg       = 'var(--compare-surface)';
    const mPriceBtnColor = (!isPremium && !isCreator) ? 'var(--plan-default-btn-text)' : btnColor;

    const pOrder = PLAN_ORDER[type] ?? 99;
    const planCredits = Number(plan?.plan_detail?.agent || 0);

    let rows = "";
    template.plan_details?.forEach((f) => {
      if (!f.items) return;
      if (/unlimited/i.test(f.name ?? "")) return;
      rows += `<div style="padding:14px 0 6px;">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
          <div style="width:3px;height:16px;background:var(--plan-premium-accent);border-radius:2px;flex-shrink:0;"></div>
          <span style="color:${mHeadingColor};font-weight:700;font-size:13px;font-family:'Inter',sans-serif;">${f.name}</span>
        </div>
      </div>`;
      Object.values(f.items).forEach((item) => {
        const fi = plan._featureMap[item.name];
        let val;
        if (!fi) val = xIcon;
        else if (fi.badge) val = `<span style="font-size:12px;color:${mBadgeColor};font-family:'Inter',sans-serif;">${fi.badge.replace(/#/g, " ")}</span>`;
        else if (fi.is_true == "1") val = checkIcon;
        else val = xIcon;
        rows += `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid ${mBorder};">
          <span style="color:${mTextColor};font-size:14px;font-family:'Inter',sans-serif;flex:1;min-width:0;">${item.name}</span>
          <span style="flex-shrink:0;">${val}</span>
        </div>`;
      });
    });

    [
      { label: 'Video', models: MODEL_COMPARISON.video, unit: 'videos' },
      { label: 'Image', models: MODEL_COMPARISON.image, unit: 'images' },
    ].forEach(({ label, models, unit }) => {
      rows += `<div style="padding:18px 0 6px;">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
          <div style="width:3px;height:16px;background:var(--plan-premium-accent);border-radius:2px;flex-shrink:0;"></div>
          <span style="color:${mHeadingColor};font-weight:700;font-size:13px;font-family:'Inter',sans-serif;">${label}</span>
        </div>
      </div>`;
      models.forEach((m) => {
        const mOrder = PLAN_ORDER[m.minPlan] ?? 1;
        let val;
        if (pOrder < mOrder) {
          val = xIcon;
        } else {
          const count = planCredits > 0 ? Math.floor(planCredits / m.credits) : 0;
          val = `<span style="font-size:13px;color:${mValColor};font-family:'Inter',sans-serif;">${count.toLocaleString()} ${unit}</span>`;
        }
        rows += `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid ${mBorder};">
          <div style="flex:1;min-width:0;">
            <div style="color:${mTextColor};font-size:14px;font-family:'Inter',sans-serif;">${m.name}</div>
            <div style="color:${mSubColor};font-size:11px;margin-top:1px;font-family:'Inter',sans-serif;">${m.sub}</div>
          </div>
          <span style="flex-shrink:0;">${val}</span>
        </div>`;
      });
    });

    return `<div class="cmp-panel" data-plan="${type}" style="display:none;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;background:${mCardBg};border-radius:12px;padding:14px 16px;margin-top:12px;">
        <div>
          <div style="color:${color};font-weight:700;font-size:17px;font-family:'Inter',sans-serif;">${escapeHtml(plan.name ?? "")}</div>
          ${price != null ? `<div style="color:${mHeadingColor};font-size:1.4rem;font-weight:800;font-family:'Inter',sans-serif;line-height:1.2;">${formatUsd(price)}<span style="color:${mSubColor};font-size:0.75rem;font-weight:400;"> /mo</span></div>` : ""}
        </div>
        <a href="${getPaymentUrl(type, currentPeriod)}" class="price-select-btn" style="display:inline-flex;align-items:center;justify-content:center;background:${btnBg};color:${mPriceBtnColor};border:${btnBorder};border-radius:8px;padding:9px 18px;font-size:13px;font-weight:600;text-decoration:none;white-space:nowrap;font-family:'Inter',sans-serif;flex-shrink:0;">Select Plan</a>
      </div>
      ${rows}
    </div>`;
  };

  const firstType = String(plans[0]?.plan_type || "").toLowerCase();

  const _mobDark = document.documentElement.classList.contains('dark');
  const mobileTabs = plans.map((p) => {
    const t = String(p?.plan_type || "").toLowerCase();
    return `<button class="cmp-tab" data-plan="${t}" data-action="_cmpSelect" data-param="${t}"
      style="flex:1;padding:10px 4px;font-size:13px;font-weight:600;font-family:'Inter',sans-serif;background:transparent;border:none;border-bottom:2px solid transparent;color:${_mobDark ? '#6b7280' : '#9ca3af'};cursor:pointer;transition:color 0.15s,border-color 0.15s;white-space:nowrap;">
      ${escapeHtml(p.name ?? "")}
    </button>`;
  }).join("");

  const mobilePanels = plans.map(buildMobilePanel).join("");

  // ── DESKTOP: full comparison table
  let bodyRows = "";
  template.plan_details?.forEach((f) => {
    if (!f.items) return;
    if (/unlimited/i.test(f.name ?? "")) return;
    bodyRows += `<tr>
      <td colspan="${plans.length + 1}" style="padding:20px 0 8px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:3px;height:20px;background:var(--plan-premium-accent);border-radius:2px;flex-shrink:0;"></div>
          <span style="color:var(--compare-heading);font-weight:700;font-size:15px;font-family:'Inter',sans-serif;">${f.name}</span>
        </div>
      </td>
    </tr>`;
    Object.values(f.items).forEach((item) => {
      bodyRows += `<tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
        <td style="padding:14px 0;vertical-align:middle;">
          <div style="color:var(--compare-heading);font-weight:600;font-size:14px;font-family:'Inter',sans-serif;">${item.name}</div>
          ${item.tooltip ? `<div style="color:#6b7280;font-size:11px;margin-top:2px;">${item.tooltip}</div>` : ""}
        </td>
        ${plans.map((p) => {
          const fi = p._featureMap[item.name];
          if (!fi) return `<td style="text-align:center;padding:14px 16px;vertical-align:middle;">${xIcon}</td>`;
          if (fi.badge) return `<td style="text-align:center;padding:14px 16px;vertical-align:middle;color:#9ca3af;font-size:14px;font-family:'Inter',sans-serif;">${fi.badge.replace(/#/g, " ")}</td>`;
          if (fi.is_true == "1") return `<td style="text-align:center;padding:14px 16px;vertical-align:middle;color:var(--plan-premium-accent);font-size:18px;">✓</td>`;
          return `<td style="text-align:center;padding:14px 16px;vertical-align:middle;">${xIcon}</td>`;
        }).join("")}
      </tr>`;
    });
  });

  // ── Model comparison sections (Video + Image)
  const _cmpText   = 'var(--compare-heading)';
  const _cmpSub    = '#6b7280';
  const _cmpVal    = 'var(--compare-text)';
  const _cmpBorder = 'var(--compare-border)';

  const buildModelSectionRows = (label, models, colCount) => {
    const unit = label === 'Video' ? 'videos' : 'images';
    let html = `<tr>
      <td colspan="${colCount}" style="padding:24px 0 8px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:3px;height:20px;background:var(--plan-premium-accent);border-radius:2px;flex-shrink:0;"></div>
          <span style="color:${_cmpText};font-weight:700;font-size:15px;font-family:'Inter',sans-serif;">${label} Models</span>
        </div>
      </td>
    </tr>`;
    models.forEach((m) => {
      html += `<tr style="border-bottom:1px solid ${_cmpBorder};">
        <td style="padding:14px 0;vertical-align:middle;">
          <div style="color:${_cmpText};font-weight:600;font-size:14px;font-family:'Inter',sans-serif;">${m.name}</div>
          <div style="color:${_cmpSub};font-size:11px;margin-top:2px;font-family:'Inter',sans-serif;">${m.sub}</div>
        </td>
        ${plans.map((p) => {
          const pType = String(p?.plan_type || "").toLowerCase();
          const pOrder = PLAN_ORDER[pType] ?? 99;
          const mOrder = PLAN_ORDER[m.minPlan] ?? 1;
          const cell = (inner) => `<td style="padding:14px 16px;vertical-align:middle;"><div style="display:flex;align-items:center;justify-content:center;">${inner}</div></td>`;
          if (pOrder < mOrder) return cell(xIcon);
          const planCredits = Number(p?.plan_detail?.agent || 0);
          const count = planCredits > 0 ? Math.floor(planCredits / m.credits) : 0;
          return cell(`<span style="color:${_cmpVal};font-size:14px;font-family:'Inter',sans-serif;">${count.toLocaleString()} ${unit}</span>`);
        }).join("")}
      </tr>`;
    });
    return html;
  };

  bodyRows += buildModelSectionRows('Video', MODEL_COMPARISON.video, plans.length + 1);
  bodyRows += buildModelSectionRows('Image', MODEL_COMPARISON.image, plans.length + 1);

  const planHeaders = plans.map((p) => {
    const type = String(p?.plan_type || "").toLowerCase();
    return `<th style="text-align:center;padding:0 16px 20px;vertical-align:bottom;">
      <div style="color:${_cmpText};font-weight:700;font-size:1.05rem;margin-bottom:4px;font-family:'Inter',sans-serif;">${escapeHtml(p.name ?? "")}</div>
      <div style="color:#6b7280;font-size:12px;margin-bottom:12px;font-family:'Inter',sans-serif;">${PLAN_DESCRIPTIONS[type] || ''}</div>
      <a href="${getPaymentUrl(type, currentPeriod)}" class="price-select-btn" style="display:inline-flex;align-items:center;justify-content:center;background:transparent;color:${_cmpText};border:1px solid var(--plan-default-btn-border);border-radius:8px;padding:8px 20px;font-size:13px;font-weight:600;text-decoration:none;cursor:pointer;font-family:'Inter',sans-serif;">Select Plan</a>
    </th>`;
  }).join("");

  const isYear = currentPeriod === "year";

  el.innerHTML = `
    <!-- Mobile: plan tabs -->
    <div class="md:hidden" style="background:var(--plan-default-card-bg);border:1px solid var(--compare-border);border-radius:16px;overflow:hidden;">
      <div style="display:flex;border-bottom:1px solid var(--plan-divider);padding:0 4px;" id="cmpTabs">${mobileTabs}</div>
      <div style="padding:0 16px 20px;" id="cmpPanels">${mobilePanels}</div>
    </div>

    <!-- Desktop: full table -->
    <div class="hidden md:block" style="background:var(--plan-default-card-bg);border:1px solid var(--compare-border);border-radius:16px;padding:32px;">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th style="text-align:left;padding:0 0 20px;min-width:200px;vertical-align:bottom;">
              <div style="color:${_cmpText};font-weight:700;font-size:1.05rem;margin-bottom:4px;font-family:'Inter',sans-serif;">Plans</div>
              <div style="color:#6b7280;font-size:12px;margin-bottom:16px;font-family:'Inter',sans-serif;">Plan details based on the credits</div>
              <div style="display:flex;align-items:center;gap:8px;">
                <span style="color:#9ca3af;font-size:13px;font-family:'Inter',sans-serif;">${isYear ? "Annual" : "Monthly"}</span>
                ${isYear ? `<span style="background:var(--plan-premium-accent);color:var(--plan-premium-fg);font-size:11px;font-weight:700;padding:2px 8px;border-radius:100px;font-family:'Inter',sans-serif;">52% OFF</span>` : ""}
                <div class="pricing-switch${isYear ? " active-year" : ""}" data-action="togglePricingSwitch" style="cursor:pointer;">
                  <div class="pricing-switch-ball"></div>
                </div>
              </div>
            </th>
            ${planHeaders}
          </tr>
        </thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>
  `;

  window._cmpSelect = function(planType) {
    document.querySelectorAll(".cmp-tab").forEach((btn) => {
      const active = btn.dataset.plan === planType;
      btn.style.color = active ? "var(--plan-premium-accent)" : "var(--compare-badge)";
      btn.style.borderBottomColor = active ? "var(--plan-premium-accent)" : "transparent";
    });
    document.querySelectorAll(".cmp-panel").forEach((panel) => {
      panel.style.display = panel.dataset.plan === planType ? "block" : "none";
    });
  };
  window._cmpSelect(firstType);
}

function createFaqItem(item, index) {
  const title = escapeHtml(item?.title ?? "");
  const detail = escapeHtml(item?.detail ?? "").replace(/\n/g, "<br>");
  return `
        <div class="faq-item rounded-3xl border border-border/50 overflow-hidden mb-3 transition-all bg-card">
          <button class="faq-question w-full p-6 text-left flex items-center justify-between bg-transparent border-none cursor-pointer transition-colors hover:bg-muted/50" data-action="toggleFaq" data-param="${index}" aria-expanded="false">
            <span class="font-semibold text-lg">${title}</span>
            <svg class="faq-icon w-5 h-5 text-muted-foreground transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
            </svg>
          </button>
          <div class="faq-answer px-6 pb-6 mt-2 max-h-0 overflow-hidden transition-all" style="display: none;">
            <p class="text-muted-foreground">${detail}</p>
          </div>
        </div>
      `;
}

function renderFaq() {
  const container = document.getElementById("faqContainer");
  if (!container) return;

  const faqs = plansResponse?.faq ?? [];
  if (!Array.isArray(faqs) || faqs.length === 0) {
    container.innerHTML = `
          <div class="rounded-3xl border border-border/50 overflow-hidden mb-3 bg-card">
            <div class="w-full p-6 text-center">
              <span class="font-semibold text-lg text-muted-foreground">No FAQs available</span>
            </div>
          </div>
        `;
    return;
  }

  container.innerHTML = faqs
    .map((item, idx) => createFaqItem(item, idx))
    .join("");
}

async function loadPlans() {
  let attempt = 1;
  renderPricingLoading();

  while (attempt <= PLANS_MAX_ATTEMPTS) {
    let timeoutHandle = null;
    try {
      const controller = new AbortController();
      timeoutHandle = setTimeout(
        () => controller.abort(),
        PLANS_FETCH_TIMEOUT_MS,
      );
      const response = await fetch(PLANS_ENDPOINT, {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const res = await response.json();
      if (!res.data) {
        throw new Error(
          `Failed to load plans: ${response.status} ${response.statusText}`,
        );
      }

      const data = res.data;
      plansResponse = data;
      if (typeof plansResponse?.data !== "undefined")
        plansResponse = plansResponse.data;
      window.__plansLoaded = true;
      renderPricing();
      renderFaq();
      switchPricing();
      return;
    } catch (err) {
      const isLastAttempt = attempt >= PLANS_MAX_ATTEMPTS;
      console.error("Error loading plans:", {
        attempt,
        maxAttempts: PLANS_MAX_ATTEMPTS,
        name: err?.name,
        message: err?.message,
        origin: window.location?.origin,
        apiBase: window.API_BASE_URL || null,
        online: typeof navigator !== "undefined" ? navigator.onLine : null,
      });

      if (isLastAttempt) {
        const userMessage =
          err?.name === "AbortError"
            ? "Request timed out. Please check your connection and retry."
            : err?.message || "Failed to load plans. Please try again later.";
        renderPricingError(userMessage);
        const faqContainer = document.getElementById("faqContainer");
        if (faqContainer) faqContainer.innerHTML = "";
        return;
      }

      const retryDelayMs = 1000 + Math.floor(Math.random() * 500);
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      attempt += 1;
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
  }
}

function renderMainHtml(render_element = "main") {
  const mainEl = document.querySelector(render_element);
  if (!mainEl) return;

  const fromModal = sessionStorage.getItem('pricing_ref') === 'modal';
  sessionStorage.removeItem('pricing_ref');

  const fullHtml = mainInnerHtml();
  const splitMarker = '<!-- Pricing Section -->';
  const splitIdx = fullHtml.indexOf(splitMarker);

  const countdownEl = document.getElementById('countdown-container');
  if (countdownEl && splitIdx !== -1) {
    countdownEl.innerHTML = fullHtml.substring(0, splitIdx);
    mainEl.innerHTML = fullHtml.substring(splitIdx);
  } else {
    mainEl.innerHTML = fullHtml;
  }

  if (fromModal) {
    // Came from modal CTA: hide countdown-banner, show promo-ticket-container
    if (countdownEl) countdownEl.style.display = 'none';
    const ticketContainer = document.getElementById('promo-ticket-container');
    if (ticketContainer) {
      const storedCode = sessionStorage.getItem('pricing_promo_code');
      sessionStorage.removeItem('pricing_promo_code');
      new PromoTicket({ container: ticketContainer, promoCode: storedCode || null }).init();
    }
  } else {
    // Came from navbar or direct: show countdown-banner, hide promo-ticket-container
    const ticketWrap = document.getElementById('promo-ticket-container')?.parentElement;
    if (ticketWrap) ticketWrap.style.display = 'none';

    if (shouldHidePromo()) {
      if (countdownEl) countdownEl.style.display = 'none';
    } else {
      fetch('https://aitopia.ai/store/promo-config.json')
        .then((r) => r.ok ? r.json() : {})
        .catch(() => ({}))
        .then((cfg) => {
          const b = cfg.banner || {};
          const setText = (id, val) => { const el = document.getElementById(id); if (el && val) el.innerHTML = val; };
          const setTextNode = (id, val) => { const el = document.getElementById(id); if (el && val) el.textContent = val; };
          setTextNode('banner-badge-1-text', b.badge1);
          setTextNode('banner-badge-2-text', b.badge2);
          setText('banner-heading', b.heading);
          setText('banner-desc',    b.description);
          startCountdown(b.durationHours ?? 24);
        });
    }
  }
}

function startCountdown(durationHours = 24) {
  const DURATION_MS = durationHours * 60 * 60 * 1000;
  const KEY = 'promo_expiry';
  let expiry = parseInt(localStorage.getItem(KEY) || '0', 10);
  if (!expiry || expiry < Date.now()) {
    expiry = Date.now() + DURATION_MS;
    localStorage.setItem(KEY, String(expiry));
  }
  function pad(n) { return String(Math.max(0, n)).padStart(2, '0'); }
  function tick() {
    const diff = Math.max(0, expiry - Date.now());
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    const hEl = document.getElementById('cd-hours');
    const mEl = document.getElementById('cd-minutes');
    const sEl = document.getElementById('cd-seconds');
    if (hEl) hEl.textContent = pad(h);
    if (mEl) mEl.textContent = pad(m);
    if (sEl) sEl.textContent = pad(s);
    if (diff > 0) setTimeout(tick, 1000);
  }
  tick();
}

function mainInnerHtml() {
  let style = `<style>.price-card[data-badge]::before {
      content: attr(data-badge);
      position: absolute;
      top: -12px;
      left: 50%;
      transform: translateX(-50%);
      background: hsl(var(--aifnmjmchg-m-primary));
      padding: 0.5rem 1.5rem;
      border-radius: 50px;
      font-size: 0.8rem;
      color: white;
      font-weight: 600;
      white-space: nowrap;
    }
    .price-features li{
      font-size:13px
    }
    .price-features li::before {
      content: none;
    }
    .price-features li.no::before {
      content: none;
    }

    /* New toggle switch style */
    .pricing-toggle-wrap {
      display: flex;
      align-items: center;
      gap: 14px;
      flex-wrap: wrap;
      justify-content: center;
    }
    .pricing-toggle-label {
      font-size: 15px;
      font-weight: 500;
      font-family: 'Inter', sans-serif;
      color: #6b7280;
      cursor: pointer;
      transition: color 0.2s;
    }
    .pricing-toggle-label.active {
      color: var(--plan-default-title);
    }
    .pricing-switch {
      position: relative;
      width: 56px;
      height: 30px;
      background: #374151;
      border-radius: 100px;
      cursor: pointer;
      transition: background 0.3s;
      flex-shrink: 0;
    }
    .pricing-switch-ball {
      position: absolute;
      top: 3px;
      left: 3px;
      width: 24px;
      height: 24px;
      background: #ffffff;
      border-radius: 50%;
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 1px 4px rgba(0,0,0,0.3);
    }
    .pricing-switch.active-year .pricing-switch-ball {
      transform: translateX(26px);
    }
    .pricing-off-badge {
      display: inline-flex;
      align-items: center;
      background: var(--plan-premium-accent);
      color: var(--plan-premium-fg);
      font-size: 13px;
      font-weight: 700;
      font-family: 'Inter', sans-serif;
      padding: 6px 16px;
      border-radius: 100px;
      letter-spacing: 0.01em;
      white-space: nowrap;
    }
    @media (max-width: 480px) {
      .pricing-toggle-wrap { gap: 10px; }
      .pricing-toggle-label { font-size: 13px; }
      .pricing-off-badge { font-size: 11px; padding: 4px 12px; }
      .pricing-switch { width: 48px; height: 26px; }
      .pricing-switch-ball { width: 20px; height: 20px; }
      .pricing-switch.active-year .pricing-switch-ball { transform: translateX(22px); }
    }

    @keyframes slideDown {
      from {
        opacity: 0;
        max-height: 0;
      }
      to {
        opacity: 1;
        max-height: 500px;
      }
    }

    .faq-item.active .faq-answer {
      display: block !important;
      animation: slideDown 0.3s ease-out;
      max-height: 500px;
      opacity: 1;
    }

    .faq-item.active .faq-icon {
      transform: rotate(180deg);
    }

    .price-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
    }

    .price-card.featured:hover {
      transform: translateY(-4px) scale(1.02);
      box-shadow: 0 25px 50px rgba(99, 102, 241, 0.2);
    }

    .price-card.featured {
      /*background: linear-gradient(135deg, rgba(139, 92, 246, 0.3) 0%, rgba(167, 139, 250, 0.25) 30%, rgba(255, 255, 255, 0.4) 60%, rgba(196, 181, 253, 0.2) 100%);*/
      background:hsl(262deg 83% 58% / 8%);
      box-shadow: 0 10px 25px rgba(99, 102, 241, 0.15);
    }

    .price-select-btn {
      transition: filter 0.15s ease, transform 0.1s ease;
    }
    .price-select-btn:hover {
      filter: brightness(0.88);
    }
    .price-select-btn:active {
      transform: scale(0.97);
    }

    .original-price {
      text-decoration: line-through;
      opacity: 0.7;
    }

    /* Skeleton Loader Styles */
    @keyframes shimmer {
      0% {
        background-position: -1000px 0;
      }
      100% {
        background-position: 1000px 0;
      }
    }

    .skeleton {
      background: linear-gradient(
        90deg,
        hsl(var(--aifnmjmchg-m-muted)) 0%,
        hsl(var(--aifnmjmchg-m-muted) / 0.5) 50%,
        hsl(var(--aifnmjmchg-m-muted)) 100%
      );
      background-size: 2000px 100%;
      animation: shimmer 2s infinite;
      border-radius: 8px;
    }

    .skeleton-text {
      height: 1.5rem;
      margin-bottom: 0.75rem;
    }

    .skeleton-text-sm {
      height: 1rem;
      margin-bottom: 0.5rem;
    }

    .skeleton-text-lg {
      height: 3rem;
      margin-bottom: 1rem;
    }

    .skeleton-price {
      height: 4rem;
      width: 60%;
      margin: 1rem auto;
    }

    .skeleton-feature {
      height: 1.25rem;
      width: 80%;
      margin: 0.75rem auto;
    }

    .skeleton-button {
      height: 3rem;
      width: 100%;
      margin-top: 1rem;
      border-radius: 12px;
    }
[data-tooltip] {
  position: relative;
  cursor: help;
  /*opacity: 0.6;*/
}

[data-tooltip]:hover {
  opacity: 1;
}

[data-tooltip]::after {
  content: attr(data-tooltip);
  position: absolute;
  bottom: 100%;
  width: max-content;
  max-width: 220px;
  left: 50%;
  transform: translateX(-50%);
  background: #1a1a1a;
  color: #fff;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 12px;
  white-space: normal;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.2s, visibility 0.2s;
  margin-bottom: 6px;
  z-index: 100;
}

[data-tooltip]:hover::after {
  opacity: 1;
  visibility: visible;
}

html:not(.dark) [data-tooltip]::after {
  background: #ffffff;
  color: #111827;
  border: 1px solid #e5e7eb;
  box-shadow: 0 2px 8px rgba(0,0,0,0.12);
}

/* Countdown Banner */
.countdown-banner {
  background: var(--cd-banner-bg);
  border: 1px solid var(--cd-banner-border);
  border-radius: 20px;
  margin-bottom: 2.5rem;
  height: 335px;
  box-sizing: border-box;
  width: 100%;
  margin-top: 2rem;
}
.countdown-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--cd-badge-bg);
  border: 1px solid var(--cd-badge-border);
  color: var(--cd-badge-color);
  font-weight: 600;
  font-family: 'Inter', sans-serif;
  padding: 5px 12px;
  border-radius: 16px;
  letter-spacing: 0.01em;
}
.countdown-heading {
  font-weight: 700;
  font-family: 'Inter', sans-serif;
  color: var(--cd-heading);
  text-transform: uppercase;
  line-height: 1.1;
  letter-spacing: -0.01em;
  margin: 12px 0px;
}
.countdown-desc {
  color: var(--cd-desc);
  font-weight: 500;
  font-family: 'Inter', sans-serif;
  line-height: 1.5;
  max-width: 640px;
}
.countdown-right {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  flex-shrink: 0;
  background: var(--cd-right-bg);
  border: 1px solid var(--cd-right-border);
  border-radius: 24px;
  padding: 24px 28px;
  align-self: stretch;
}
.countdown-title {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--cd-title);
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-family: 'Inter', sans-serif;
}
.countdown-digits {
  display: flex;
  align-items: center;
  gap: 10px;
}
.countdown-unit {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: var(--cd-unit-bg);
  border: 1px solid var(--cd-unit-border);
  border-radius: 16px;
  width: 128px;
  height: 144px;
}
.countdown-unit span:first-child {
  font-size: 3rem;
  font-weight: 800;
  color: var(--cd-accent);
  line-height: 1;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}
.countdown-unit .cd-label {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--cd-accent-dim);
  text-transform: uppercase;
}
.countdown-sep {
  font-size: 2rem;
  font-weight: 800;
  color: var(--cd-sep);
  margin-bottom: 20px;
  flex-shrink: 0;
}
@media (max-width: 1023px) {
  .countdown-banner {
    height: auto;
    align-items: center;
  }
  .banner-left {
    align-items: center;
    text-align: center;
    width: 100%;
  }
  .countdown-heading { text-align: center; }
  .countdown-desc { text-align: center; }
  .banner-left > div:first-child { justify-content: center; } /* badges row */
  .countdown-right {
    width: 100%;
    padding: 16px;
  }
  .countdown-unit { width: 72px; height: 72px; }
  .countdown-unit span:first-child { font-size: 2rem; }
  .countdown-digits { gap: 6px; }
  .countdown-sep { font-size: 1.5rem; margin-bottom: 16px; }
}
@media (max-width: 480px) {
  .countdown-unit { width: 60px; height: 60px; border-radius: 12px; }
  .countdown-unit span:first-child { font-size: 1.5rem; }
  .countdown-unit .cd-label { font-size: 7px; }
  .countdown-digits { gap: 4px; }
  .countdown-sep { font-size: 1.25rem; margin-bottom: 12px; }
  .countdown-right { padding: 12px; border-radius: 16px; }
  .countdown-title { font-size: 12px; }
}

/* Pricing title */
.pricing-main-title { color: var(--pricing-title); }
.pricing-main-subtitle { color: var(--pricing-subtitle); }
.pricing-toggle-label { color: var(--pricing-toggle-color); }
.pricing-toggle-label.active { color: var(--pricing-toggle-active); }

/* Mobile: horizontal scroll carousel */
@media (max-width: 767px) {
  #pricingGrid {
    display: flex;
    flex-direction: row;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    -webkit-overflow-scrolling: touch;
    gap: 16px;
    padding: 0 16px 20px;
    margin: 0 -16px;
    scrollbar-width: none;
  }
  #pricingGrid::-webkit-scrollbar { display: none; }
  #pricingGrid > * {
    flex-shrink: 0;
    width: calc(88vw - 16px);
    scroll-snap-align: start;
  }
}
@media (min-width: 768px) {
  #pricingGrid {
    display: grid;
    grid-template-columns: repeat(var(--grid-cols, 4), 1fr);
    gap: 12px;
  }
}
.banner-left {
  gap: 10px;
}
@media (min-width: 768px) {
  .banner-left {
    gap: 32px;
  }
}
</style>`;
  return `${style}

  <!-- Countdown Banner -->
  <div class="px-3 lg:px-5">
  <div class="countdown-banner px-6 py-6 lg:px-6 lg:py-5 flex flex-col lg:flex-row items-start lg:items-center gap-8 mb-10">
    <div class="flex-1 flex flex-col banner-left">
      <div class="flex flex-wrap gap-2">
        <span id="banner-badge-1" class="countdown-badge text-[11px] sm:text-xs md:text-sm lg:text-sm xl:text-base"><svg width="14" height="14" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;"><g clip-path="url(#clip-banner-bolt)"><path d="M3.0006 10.0555C2.85868 10.0559 2.71953 10.0178 2.59932 9.94554C2.47911 9.87328 2.38278 9.76984 2.32152 9.64724C2.26025 9.52463 2.23657 9.3879 2.25323 9.25292C2.26988 9.11794 2.32619 8.99025 2.4156 8.8847L9.8406 1.55854C9.8963 1.49698 9.9722 1.45537 10.0558 1.44056C10.1395 1.42575 10.2259 1.4386 10.3009 1.47702C10.3759 1.51545 10.435 1.57714 10.4686 1.65199C10.5022 1.72684 10.5082 1.8104 10.4856 1.88894L9.0456 6.21281C9.00314 6.32164 8.98888 6.43871 9.00405 6.55398C9.01921 6.66925 9.06335 6.77928 9.13267 6.87462C9.202 6.96997 9.29443 7.04779 9.40206 7.1014C9.50969 7.15501 9.62929 7.18283 9.7506 7.18245H15.0006C15.1425 7.18198 15.2817 7.2201 15.4019 7.29236C15.5221 7.36461 15.6184 7.46806 15.6797 7.59066C15.741 7.71326 15.7646 7.85 15.748 7.98498C15.7313 8.11996 15.675 8.24764 15.5856 8.3532L8.1606 15.6794C8.10491 15.7409 8.02901 15.7825 7.94537 15.7973C7.86173 15.8122 7.77531 15.7993 7.70031 15.7609C7.6253 15.7225 7.56617 15.6608 7.5326 15.5859C7.49904 15.5111 7.49305 15.4275 7.51561 15.349L8.9556 11.0251C8.99807 10.9163 9.01233 10.7992 8.99716 10.6839C8.982 10.5686 8.93786 10.4586 8.86854 10.3633C8.79921 10.2679 8.70677 10.1901 8.59915 10.1365C8.49152 10.0829 8.37192 10.0551 8.2506 10.0555H3.0006Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></g><defs><clipPath id="clip-banner-bolt"><rect width="18" height="18" fill="white" transform="scale(1 0.957668)"/></clipPath></defs></svg><span id="banner-badge-1-text">Free Generations</span></span>
        <span id="banner-badge-2" class="countdown-badge text-[11px] sm:text-xs md:text-sm lg:text-sm xl:text-base"><svg width="14" height="14" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;"><g clip-path="url(#clip-banner-tag)"><path d="M9.4395 1.85742C9.15826 1.588 8.77679 1.4366 8.379 1.43652H3C2.60218 1.43652 2.22064 1.58787 1.93934 1.85726C1.65804 2.12666 1.5 2.49204 1.5 2.87303L1.5 8.02432C1.50008 8.40527 1.65818 8.77059 1.9395 9.03993L8.4675 15.2916C8.80839 15.616 9.26943 15.798 9.75 15.798C10.2306 15.798 10.6916 15.616 11.0325 15.2916L15.9675 10.5655C16.3062 10.239 16.4964 9.7975 16.4964 9.33728C16.4964 8.87706 16.3062 8.43553 15.9675 8.10907L9.4395 1.85742Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M5.625 5.74608C5.83211 5.74608 6 5.5853 6 5.38696C6 5.18862 5.83211 5.02783 5.625 5.02783C5.41789 5.02783 5.25 5.18862 5.25 5.38696C5.25 5.5853 5.41789 5.74608 5.625 5.74608Z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></g><defs><clipPath id="clip-banner-tag"><rect width="18" height="18" fill="white" transform="scale(1 0.957668)"/></clipPath></defs></svg><span id="banner-badge-2-text">Personal 52% OFF</span></span>
      </div>
      <div id="banner-heading" class="countdown-heading text-3xl md:text-3xl xl:text-4xl">Nano Banana Pro & Early Access to<br>Advanced AI Models</div>
      <p id="banner-desc" class="countdown-desc text-xs sm:text-sm md:text-base lg:text-base xl:text-lg">Get Nano Banana 2 & Pro Unlimited on Creator plan for 7 days with personal 52% discount.</p>
    </div>
    <div class="countdown-right">
      <div class="countdown-title">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        Offer Expires In
      </div>
      <div class="countdown-digits">
        <div class="countdown-unit"><span id="cd-hours">00</span><span class="cd-label">Hours</span></div>
        <div class="countdown-sep">:</div>
        <div class="countdown-unit"><span id="cd-minutes">00</span><span class="cd-label">Minutes</span></div>
        <div class="countdown-sep">:</div>
        <div class="countdown-unit"><span id="cd-seconds">00</span><span class="cd-label">Seconds</span></div>
      </div>
    </div>
  </div>
  </div>

  <!-- Pricing Section -->
    <section id="pricing" class="max-w-full overflow-visible">
      <div class="flex justify-center mb-8">
        <div id="promo-ticket-container" class="w-full max-w-2xl"></div>
      </div>
      <div class="text-center mb-12 p-plan-text">
        <h1 style="font-family:'Inter',sans-serif;font-weight:700;font-size:48px;line-height:1.1;" class="pricing-main-title mb-4">Pick Your Plan</h1>
        <p style="font-family:'Inter',sans-serif;font-weight:400;font-size:16px;" class="pricing-main-subtitle max-w-2xl mx-auto">Be the first to access advanced AI models exclusively on Nano Banana Pro 365 with 52% OFF</p>
      </div>

      <!-- Toggle Switch -->
      <div class="flex flex-col items-center my-8 mb-16">
        <div class="pricing-toggle-wrap" id="pricingToggle" role="tablist" aria-label="Pricing period">
          <span class="pricing-toggle-label" data-value="month" data-action="switchPricing" data-param="month" role="tab" aria-selected="false">Monthly</span>
          <div class="pricing-switch active-year" id="pricingSwitch" data-action="togglePricingSwitch" aria-hidden="true">
            <div class="pricing-switch-ball"></div>
          </div>
          <span class="pricing-toggle-label active" data-value="year" data-action="switchPricing" data-param="year" role="tab" aria-selected="true">Annual</span>
          <span class="pricing-off-badge">20%-52% OFF</span>
        </div>
        <p class="text-sm text-muted-foreground mt-4" id="savingsText"></p>
      </div>

      <div id="pricingGrid" role="tabpanel" aria-labelledby="pricing-toggle"></div>
    </section>

    <!-- Compare Plans Section -->
    <section class="py-12 md:py-16">
      <div class="text-center mb-10">
        <h2 style="font-size:2.5rem;font-weight:700;font-family:'Inter',sans-serif;" class="pricing-main-title">Compare Plans</h2>
      </div>
      <div id="comparePlansTable"></div>
    </section>

    <!-- FAQ Section -->
    <section class="py-12 md:py-16">
      <div class="text-center mb-12">
        <h2 class="text-3xl md:text-4xl text-primary font-bold mt-12">Frequently Asked Questions</h2>
      </div>

      <div class="max-w-3xl mx-auto" id="faqContainer"></div>
  </section>`;
}

window.switchPricing = switchPricing;
window.toggleFaq = toggleFaq;
window.loadPlans = loadPlans;
window.togglePricingSwitch = function (e) {
  const el = e?.target?.closest?.('.pricing-switch') || e?.currentTarget;
  if (!el) return;
  switchPricing(el.classList.contains('active-year') ? 'month' : 'year');
};

// Re-render cards when theme toggles (dark ↔ light)
new MutationObserver(() => { if (window.__plansLoaded) renderPricing(); })
  .observe(document.documentElement, { attributeFilter: ['class'] });
// ES Module exports
export { renderMainHtml, loadPlans, switchPricing, toggleFaq, mainInnerHtml, startCountdown, shouldHidePromo };
