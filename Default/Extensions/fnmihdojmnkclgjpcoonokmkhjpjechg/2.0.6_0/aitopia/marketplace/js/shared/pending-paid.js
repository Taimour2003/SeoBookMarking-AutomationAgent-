/**
 * Pending-Paid UI Module
 * Shared across agent pages (embed-runner, runner) and model pages (model.html)
 *
 * Handles:
 * - Balance check (zero credits / insufficient credits)
 * - Form snapshot save (survives pricing page redirect)
 * - Pending UI render (spinner + Retry + Upgrade Now)
 * - Pricing modal trigger (fire-and-forget)
 */

const THUMB_KEYS = ['image', 'imageUrl', 'source_image', 'human_img'];

/**
 * Extract thumbnail URL from form data
 */
function extractThumb(formData) {
  if (!formData || typeof formData !== 'object') return null;
  for (const key of THUMB_KEYS) {
    if (formData[key] && typeof formData[key] === 'string' && formData[key].startsWith('http')) {
      return formData[key];
    }
  }
  return null;
}

/**
 * Save form data to sessionStorage snapshot
 * @param {string} snapshotKey - 'agent_form_snapshot' or 'model_form_snapshot'
 * @param {object} formData - form values to persist
 */
function saveSnapshot(snapshotKey, formData) {
  try {
    if (formData && Object.keys(formData).length > 0) {
      const all = {};
      all[window.location.pathname] = formData;
      sessionStorage.setItem(snapshotKey, JSON.stringify(all));
    }
  } catch (_) { /* quota exceeded or private browsing */ }
}

/**
 * Generate the pending-paid HTML template
 * @param {object} opts
 * @param {string|null} opts.thumbUrl - input preview image URL
 * @returns {string} HTML string
 */
function renderPendingPaidHTML(opts = {}) {
  const thumbHtml = opts.thumbUrl
    ? `<img src="${opts.thumbUrl}" class="w-full h-48 object-contain rounded-lg mb-4 opacity-60" alt="Input preview" />`
    : '';

  return `
    <div class="flex flex-col items-center justify-center text-center py-8 px-4">
      ${thumbHtml}
      <div class="relative w-12 h-12 mb-4 flex items-center justify-center rounded-full bg-red-500/10 border-2 border-red-500/20">
        <svg class="w-6 h-6 text-red-500" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>
      </div>
      <div class="text-sm font-semibold text-foreground">${opts.title || 'Out of Credits'}</div>
      <div class="mt-1.5 text-xs text-muted-foreground max-w-xs">${(opts.message || 'You have no credits remaining. Upgrade your plan or purchase credits to continue generating.').replace(/\n/g, '<br>')}</div>
      <div class="mt-5 flex items-center gap-3">
        <button data-pending-retry class="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#1C1E20] hover:bg-[#252729] border border-[#2A2C2E] text-white text-sm font-medium transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182"/></svg>
          Retry
        </button>
        <button data-pending-upgrade class="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#FFD128] hover:bg-[#E6BC23] text-black text-sm font-medium transition-colors shadow-lg shadow-[#FFD128]/25 cursor-pointer">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"/></svg>
          Upgrade Now
        </button>
      </div>
    </div>
  `;
}

/**
 * Render pending-paid UI into a container and wire up retry
 * @param {HTMLElement} container - DOM element to render into
 * @param {object} opts
 * @param {string|null} opts.thumbUrl - input preview
 * @param {function} opts.onRetry - called when Retry is clicked
 */
function renderPendingPaidInto(container, opts = {}) {
  if (!container) return;
  container.innerHTML = renderPendingPaidHTML({ thumbUrl: opts.thumbUrl, title: opts.title, message: opts.message });
  const retryBtn = container.querySelector('[data-pending-retry]');
  if (retryBtn && typeof opts.onRetry === 'function') {
    retryBtn.addEventListener('click', () => {
      container.innerHTML = '';
      container.classList.add('hidden');
      opts.onRetry();
    });
  }
  const upgradeBtn = container.querySelector('[data-pending-upgrade]');
  if (upgradeBtn) {
    upgradeBtn.addEventListener('click', () => firePricingModal());
  }
}

/**
 * Fetch current credit balance
 * @returns {Promise<number|null>} totalCredits or null if unavailable
 */
async function fetchBalance() {
  try {
    let balData = await window.AitopiaCredits?.loadCreditsBalance?.({ force: true });
    if (!balData?.balance) {
      const r = await fetch('https://aitopia.ai/api/credits/balance', { credentials: 'include' });
      if (r.ok) balData = await r.json();
    }
    return balData?.balance?.totalCredits ?? null;
  } catch (_) {
    return null;
  }
}

/**
 * Check if credits are insufficient
 * @param {number|null} available - current balance
 * @param {number|null} required - estimated cost (null if unknown)
 * @returns {boolean}
 */
function isInsufficient(available, required) {
  if (available == null) return false;
  if (available <= 0) return true;
  if (required != null && required > 0 && available < required) return true;
  return false;
}

/**
 * Fire pricing modal in the background (non-blocking)
 */
function firePricingModal() {
  if (typeof window.__pricingModal === 'function') {
    setTimeout(() => window.__pricingModal(), 0);
    return;
  }
  // Fallback: dynamically import pricing-modal.js
  import('./pricing-modal.js')
    .then(m => { if (typeof m.pricingModal === 'function') m.pricingModal(); })
    .catch(() => { location.href='/aitopia/marketplace/pricing.html'; });
}

/**
 * Show media upload agreement modal and return a Promise.
 * Resolves `true` when user agrees (POST /api/users/me/agreement is called),
 * resolves `false` when user cancels — caller must abort the generate flow.
 *
 * If the user already approved (`agreementApproval === 1` in profile),
 * resolves `true` immediately without showing the modal.
 *
 * @returns {Promise<boolean>}
 */
function showAgreementModal() {
  return new Promise((resolve) => {
    // Check cached profile first
    const cached = window.__agreementApproved;
    if (cached) { resolve(true); return; }

    // Fetch profile to check agreement status
    fetch('https://aitopia.ai/api/users/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.profile?.agreementApproval === 1) {
          window.__agreementApproved = true;
          resolve(true);
          return;
        }
        // Show modal
        _renderAgreementModal(resolve);
      })
      .catch(() => {
        // On error, show modal as fallback
        _renderAgreementModal(resolve);
      });
  });
}

function _renderAgreementModal(resolve) {
  // Prevent duplicate modals
  const existing = document.getElementById('agreementModalOverlay');
  if (existing) { existing.remove(); }

  const overlay = document.createElement('div');
  overlay.id = 'agreementModalOverlay';
  overlay.className = 'fixed inset-0 z-[9999] flex items-center justify-center p-4';

  overlay.innerHTML = `
    <style>
      #agreementModalOverlay {
        background: rgba(0,0,0,0.6);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        animation: agmtFadeIn .2s ease-out;
      }
      #agreementModalOverlay.closing {
        animation: agmtFadeOut .2s ease-out forwards;
      }
      #agreementModalOverlay.closing #agreementModalCard {
        animation: agmtSlideDown .2s ease-out forwards;
      }
      #agreementModalCard {
        animation: agmtSlideUp .3s ease-out;
      }
      @keyframes agmtFadeIn  { from{opacity:0} to{opacity:1} }
      @keyframes agmtFadeOut { from{opacity:1} to{opacity:0} }
      @keyframes agmtSlideUp   { from{opacity:0;transform:translateY(24px) scale(.96)} to{opacity:1;transform:translateY(0) scale(1)} }
      @keyframes agmtSlideDown { from{opacity:1;transform:translateY(0) scale(1)} to{opacity:0;transform:translateY(24px) scale(.96)} }
    </style>

    <div id="agreementModalCard" class="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl shadow-black/40 p-6 sm:p-8">

      <!-- Close button -->
      <button id="agreementModalClose" class="absolute top-4 right-4 flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100 transition-all duration-150 hover:scale-105 active:scale-95" aria-label="Close">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>

      <!-- Logo -->
      <div class="mb-5">
        <svg class="h-9" el-logo-all style="color:hsl(var(--ait-m-primary))" fill="currentColor" width="343" height="73" viewBox="0 0 343 73" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M35.5587 69.0869C25.9618 69.0869 18.1549 61.2934 18.1549 51.715V21.8683C18.1549 12.2898 25.9618 4.49634 35.5587 4.49634C45.1555 4.49634 52.9624 12.2898 52.9624 21.8683V51.7167C52.9624 61.2934 45.1547 69.0869 35.5587 69.0869ZM35.5587 9.39436C28.6681 9.39436 23.0619 14.9903 23.0619 21.8683V51.7167C23.0619 58.593 28.6723 64.1856 35.5587 64.1856C42.445 64.1856 48.0554 58.593 48.0554 51.7167V21.8683C48.0554 14.9903 42.4492 9.39436 35.5587 9.39436Z" fill="currentColor"/>
<path d="M48.4771 61.6324C45.4306 61.63 42.4388 60.8246 39.8042 59.2976L13.9094 44.3751C11.9299 43.2345 10.1949 41.716 8.80338 39.9061C7.41187 38.0962 6.39114 36.0304 5.79948 33.8268C5.20781 31.6231 5.0568 29.3247 5.35506 27.0628C5.65332 24.8009 6.39502 22.6198 7.53779 20.644C12.3366 12.3484 23.0016 9.49645 31.3123 14.284L57.2079 29.2057C65.5187 33.9949 68.3767 44.6412 63.5796 52.9368C62.4419 54.917 60.9219 56.6523 59.1076 58.0421C57.2934 59.4319 55.2209 60.4485 53.0102 61.0332C51.5319 61.4298 50.0079 61.6313 48.4771 61.6324ZM22.636 16.8581C20.4382 16.8549 18.2782 17.4299 16.3739 18.5251C14.4695 19.6203 12.8879 21.1972 11.7883 23.0968C8.34347 29.0492 10.3958 36.6937 16.3625 40.1331L42.2539 55.0556C48.2214 58.4951 55.88 56.4473 59.3248 50.4898C60.9823 47.6252 61.4319 44.2207 60.5747 41.0251C59.7175 37.8296 57.6238 35.1048 54.754 33.4501L28.8593 18.5268C26.9679 17.434 24.8213 16.8585 22.636 16.8581Z" fill="currentColor"/>
<path d="M22.636 61.6324C21.1072 61.6307 19.5852 61.4293 18.1088 61.0332C14.783 60.1447 11.796 58.2915 9.52551 55.7082C7.25505 53.1248 5.80321 49.9273 5.35366 46.5202C4.90412 43.1131 5.47706 39.6494 7.00002 36.5674C8.52297 33.4853 10.9275 30.9234 13.9094 29.2057L39.8042 14.2848C48.1141 9.49561 58.7799 12.3484 63.5779 20.6448C68.3767 28.9404 65.5187 39.5858 57.2063 44.3759L31.3132 59.2976C28.6773 60.8252 25.6839 61.6306 22.636 61.6324ZM48.4813 16.8615C46.2949 16.8598 44.1467 17.4342 42.2539 18.5268L16.3625 33.4501C13.4922 35.1043 11.3977 37.8288 10.5399 41.0244C9.68209 44.2199 10.1312 47.6248 11.7883 50.4898C13.4455 53.3549 16.175 55.4455 19.3765 56.3018C22.5779 57.158 25.9889 56.7098 28.8593 55.0556L54.754 40.1331C60.7216 36.6937 62.7739 29.05 59.3282 23.0934L61.4526 21.8683L59.3282 23.0968C58.2292 21.1976 56.6483 19.621 54.7447 18.5258C52.841 17.4306 50.6819 16.8554 48.4847 16.8581L48.4813 16.8615Z" fill="currentColor"/>
<path d="M90.012 54.6653C88.7761 54.6653 87.645 54.3822 86.6187 53.8162C85.6132 53.2502 84.7754 52.4483 84.1051 51.4105L83.7595 54.1464H82V43.4388H83.9166C84.0423 46.4263 84.545 48.6118 85.4247 49.9954C86.3045 51.3791 87.6346 52.0709 89.415 52.0709C90.9022 52.0709 92.0228 51.6464 92.7769 50.7973C93.531 49.9168 93.908 48.6275 93.908 46.9294C93.908 45.5772 93.6776 44.4451 93.2168 43.5332C92.7769 42.6212 92.1276 41.8036 91.2688 41.0803C90.4309 40.3571 89.4255 39.6495 88.2525 38.9577C86.9329 38.1401 85.8122 37.3382 84.8906 36.552C83.969 35.7344 83.2673 34.7596 82.7855 33.6275C82.3247 32.464 82.0943 30.9703 82.0943 29.1464C82.0943 26.159 82.7122 23.8319 83.948 22.1653C85.2048 20.4986 86.8805 19.6653 88.9751 19.6653C91.0488 19.6653 92.735 20.5458 94.0337 22.3068L94.285 20.1841H96.0445V30.8917H94.2536C94.2536 27.8728 93.8766 25.6715 93.1225 24.2879C92.3684 22.9042 91.185 22.2124 89.5721 22.2124C86.7025 22.2124 85.2676 24.1778 85.2676 28.1086C85.2676 29.1464 85.3933 30.0112 85.6447 30.703C85.896 31.3634 86.3464 31.9766 86.9957 32.5426C87.666 33.1086 88.6086 33.7847 89.8235 34.5709C91.562 35.6715 92.9654 36.7407 94.0337 37.7785C95.1019 38.8162 95.8769 39.9483 96.3587 41.1747C96.8405 42.3697 97.0814 43.8005 97.0814 45.4671C97.0814 47.3854 96.7776 49.0363 96.1702 50.42C95.5837 51.8036 94.7563 52.8571 93.6881 53.5803C92.6407 54.3036 91.4154 54.6653 90.012 54.6653Z" fill="currentColor"/>
<path d="M114.005 49.8539L120.069 20.1841H127.421V22.2124L124.782 23.203V51.1275L127.421 52.1181V54.1464H119.346V52.1181L121.64 51.1275V23.2502L115.167 54.1464H111.46L104.925 23.2502V51.1275L107.218 52.1181V54.1464H100.243V52.1181L102.882 51.1275V23.203L100.243 22.2124V20.1841H107.721L113.879 49.8539H114.005Z" fill="currentColor"/>
<path d="M145.642 51.1275L143.789 42.7313H135.368L133.452 51.1275L136.059 52.1181V54.1464H128.707V52.1181L131.284 51.1275L138.824 19.7124H141.746L149.193 51.1275L151.706 52.1181V54.1464H143.066V52.1181L145.642 51.1275ZM139.673 23.9105L135.997 39.9954H143.192L139.798 23.9105H139.673Z" fill="currentColor"/>
<path d="M168.632 36.1275C168.255 36.5678 167.815 36.9451 167.313 37.2596C166.81 37.5741 166.192 37.8414 165.459 38.0615C165.647 38.3445 165.846 38.7061 166.056 39.1464C166.286 39.5866 166.506 40.0741 166.716 40.6086L170.894 51.2219L173.691 52.1181V54.1464H167.218V52.1181L162.694 38.9105H158.861V51.1275L161.846 52.1181V54.1464H153.079V52.1181L155.719 51.1275V23.203L153.079 22.2124V20.1841H163.888C164.893 20.1841 165.773 20.3256 166.527 20.6086C167.281 20.8917 167.962 21.3476 168.569 21.9766C169.344 22.7313 169.941 23.769 170.36 25.0898C170.8 26.4105 171.02 27.7313 171.02 29.052C171.02 30.3728 170.8 31.6778 170.36 32.9671C169.941 34.225 169.365 35.2785 168.632 36.1275ZM158.861 36.1747H163.354C164.506 36.1747 165.459 35.6873 166.213 34.7124C166.632 34.1464 166.956 33.3917 167.187 32.4483C167.438 31.4734 167.564 30.4357 167.564 29.3351C167.564 28.2344 167.438 27.2439 167.187 26.3634C166.956 25.4514 166.621 24.7124 166.181 24.1464C165.825 23.7061 165.406 23.3917 164.925 23.203C164.464 23.0143 163.898 22.92 163.228 22.92H158.861V36.1747Z" fill="currentColor"/>
<path d="M174.576 20.1841H193.302V30.0898H191.668L190.663 23.0143H185.51V50.986L188.84 52.1181V54.1464H179.037V52.1181L182.368 50.986V23.0143H177.184L176.21 30.0898H174.576V20.1841Z" fill="currentColor"/>
<path d="M211.548 54.6653C210.312 54.6653 209.181 54.3822 208.154 53.8162C207.149 53.2502 206.311 52.4483 205.641 51.4105L205.295 54.1464H203.536V43.4388H205.452C205.578 46.4263 206.081 48.6118 206.96 49.9954C207.84 51.3791 209.17 52.0709 210.951 52.0709C212.438 52.0709 213.559 51.6464 214.313 50.7973C215.067 49.9168 215.444 48.6275 215.444 46.9294C215.444 45.5772 215.213 44.4451 214.753 43.5332C214.313 42.6212 213.663 41.8036 212.805 41.0803C211.967 40.3571 210.961 39.6495 209.788 38.9577C208.469 38.1401 207.348 37.3382 206.426 36.552C205.505 35.7344 204.803 34.7596 204.321 33.6275C203.86 32.464 203.63 30.9703 203.63 29.1464C203.63 26.159 204.248 23.8319 205.484 22.1653C206.741 20.4986 208.416 19.6653 210.511 19.6653C212.585 19.6653 214.271 20.5458 215.569 22.3068L215.821 20.1841H217.58V30.8917H215.789C215.789 27.8728 215.412 25.6715 214.658 24.2879C213.904 22.9042 212.721 22.2124 211.108 22.2124C208.238 22.2124 206.803 24.1778 206.803 28.1086C206.803 29.1464 206.929 30.0112 207.18 30.703C207.432 31.3634 207.882 31.9766 208.531 32.5426C209.202 33.1086 210.144 33.7847 211.359 34.5709C213.098 35.6715 214.501 36.7407 215.569 37.7785C216.638 38.8162 217.413 39.9483 217.894 41.1747C218.376 42.3697 218.617 43.8005 218.617 45.4671C218.617 47.3854 218.313 49.0363 217.706 50.42C217.119 51.8036 216.292 52.8571 215.224 53.5803C214.176 54.3036 212.951 54.6653 211.548 54.6653Z" fill="currentColor"/>
<path d="M227.717 23.203V51.1275L230.671 52.1181V54.1464H221.622V52.1181L224.575 51.1275V23.203L221.622 22.2124V20.1841H230.671V22.2124L227.717 23.203Z" fill="currentColor"/>
<path d="M239.312 51.3162H244.182C245.313 51.3162 246.276 51.0646 247.072 50.5615C247.889 50.0583 248.56 49.2722 249.083 48.203C249.67 47.1024 250.099 45.6558 250.371 43.8634C250.665 42.0709 250.811 39.9325 250.811 37.4483C250.811 32.5426 250.235 28.8948 249.083 26.5049C248.539 25.3099 247.837 24.4294 246.978 23.8634C246.119 23.2973 245.082 23.0143 243.868 23.0143H239.312V51.3162ZM233.531 20.1841H244.088C247.209 20.1841 249.638 21.5049 251.377 24.1464C252.361 25.6558 253.115 27.5112 253.639 29.7124C254.163 31.9137 254.425 34.2722 254.425 36.7879C254.425 39.4294 254.142 41.9137 253.576 44.2407C253.032 46.5363 252.267 48.4703 251.283 50.0426C249.544 52.7785 247.051 54.1464 243.805 54.1464H233.531V52.1181L236.17 51.1275V23.203L233.531 22.2124V20.1841Z" fill="currentColor"/>
<path d="M270.54 42.92H268.937L268.372 38.1086H263.156V51.3162H272.645L273.619 43.6275H275.441V54.1464H257.061V52.1181L260.014 51.1275V23.203L257.061 22.2124V20.1841H274.75V30.1841H273.116L272.111 22.92H263.156V35.2785H268.372L268.937 30.4671H270.54V42.92Z" fill="currentColor"/>
<path d="M296.102 28.3445C296.102 29.5395 295.913 30.6558 295.536 31.6936C295.18 32.7313 294.688 33.5961 294.059 34.2879C293.431 34.9797 292.708 35.4042 291.892 35.5615V35.7502C293.525 36.2533 294.814 37.291 295.756 38.8634C296.699 40.4357 297.17 42.3697 297.17 44.6653C297.17 46.4263 296.856 48.0615 296.227 49.5709C295.62 51.0489 294.845 52.1495 293.902 52.8728C293.316 53.3131 292.593 53.6432 291.734 53.8634C290.876 54.052 289.671 54.1464 288.121 54.1464H278.727V52.1181L281.366 51.1275V23.203L278.727 22.2124V20.1841H289.284C291.483 20.1841 293.18 20.986 294.374 22.5898C294.918 23.3445 295.337 24.225 295.63 25.2313C295.945 26.2376 296.102 27.2753 296.102 28.3445ZM288.53 37.7785H284.508V51.3162H287.964C288.928 51.3162 289.703 51.2376 290.289 51.0803C290.876 50.9231 291.368 50.6715 291.766 50.3256C292.331 49.8225 292.792 49.0678 293.148 48.0615C293.504 47.0552 293.682 45.8445 293.682 44.4294C293.682 43.2344 293.546 42.1967 293.274 41.3162C293.002 40.4042 292.656 39.681 292.237 39.1464C291.86 38.6747 291.378 38.3288 290.792 38.1086C290.205 37.8885 289.451 37.7785 288.53 37.7785ZM284.508 22.92V35.0426H288.435C289.902 35.0426 290.98 34.4923 291.672 33.3917C291.986 32.8885 292.258 32.2439 292.489 31.4577C292.719 30.6715 292.834 29.791 292.834 28.8162C292.834 27.8414 292.719 26.9766 292.489 26.2219C292.258 25.4357 291.986 24.8068 291.672 24.3351C291.043 23.3917 290.006 22.92 288.561 22.92H284.508Z" fill="currentColor"/>
<path d="M314.952 51.1275L313.098 42.7313H304.678L302.761 51.1275L305.369 52.1181V54.1464H298.017V52.1181L300.593 51.1275L308.134 19.7124H311.056L318.502 51.1275L321.016 52.1181V54.1464H312.375V52.1181L314.952 51.1275ZM308.982 23.9105L305.306 39.9954H312.501L309.108 23.9105H308.982Z" fill="currentColor"/>
<path d="M337.941 36.1275C337.564 36.5678 337.125 36.9451 336.622 37.2596C336.119 37.5741 335.501 37.8414 334.768 38.0615C334.957 38.3445 335.156 38.7061 335.365 39.1464C335.595 39.5866 335.815 40.0741 336.025 40.6086L340.204 51.2219L343 52.1181V54.1464H336.528V52.1181L332.003 38.9105H328.17V51.1275L331.155 52.1181V54.1464H322.389V52.1181L325.028 51.1275V23.203L322.389 22.2124V20.1841H333.197C334.203 20.1841 335.082 20.3256 335.836 20.6086C336.59 20.8917 337.271 21.3476 337.879 21.9766C338.654 22.7313 339.251 23.769 339.67 25.0898C340.109 26.4105 340.329 27.7313 340.329 29.052C340.329 30.3728 340.109 31.6778 339.67 32.9671C339.251 34.225 338.675 35.2785 337.941 36.1275ZM328.17 36.1747H332.663C333.815 36.1747 334.768 35.6873 335.522 34.7124C335.941 34.1464 336.266 33.3917 336.496 32.4483C336.748 31.4734 336.873 30.4357 336.873 29.3351C336.873 28.2344 336.748 27.2439 336.496 26.3634C336.266 25.4514 335.931 24.7124 335.491 24.1464C335.135 23.7061 334.716 23.3917 334.234 23.203C333.773 23.0143 333.208 22.92 332.537 22.92H328.17V36.1747Z" fill="currentColor"/>
</svg>
      </div>

      <!-- Title -->
      <h2 class="text-xl font-bold text-zinc-100 mb-5">Media upload agreement</h2>

      <!-- Sections -->
      <div class="space-y-4 mb-6">
        <div>
          <p class="text-sm font-semibold text-zinc-100 mb-0.5">This process follows AiTopia's terms of service</p>
          <p class="text-[13px] leading-relaxed text-zinc-400">
            By starting, you agree to our
            <a href="/aitopia/marketplace/terms-conditions.html" target="_blank" rel="noopener" class="text-primary underline underline-offset-2 hover:brightness-125 transition-all" style="color:hsl(var(--aifnmjmchg-m-primary))">Terms of Service</a>
            and
            <a href="/aitopia/marketplace/privacy-policy.html" target="_blank" rel="noopener" class="text-primary underline underline-offset-2 hover:brightness-125 transition-all" style="color:hsl(var(--aifnmjmchg-m-primary))">Privacy Policy.</a>
            Violations may lead to account suspension and legal liability.
          </p>
        </div>
        <div>
          <p class="text-sm font-semibold text-zinc-100 mb-0.5">The media I upload is mine</p>
          <p class="text-[13px] leading-relaxed text-zinc-400">I certify that I own or have permission to use all media I upload for content generation.</p>
        </div>
        <div>
          <p class="text-sm font-semibold text-zinc-100 mb-0.5">People in my images have given consent</p>
          <p class="text-[13px] leading-relaxed text-zinc-400">You must have permission for every visible face. Use AI responsibly.</p>
        </div>
        <div>
          <p class="text-sm font-semibold text-zinc-100 mb-0.5">I understand generation uses compute credits</p>
          <p class="text-[13px] leading-relaxed text-zinc-400">It takes time and consumes credits. Track usage in your profile.</p>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex items-center justify-end gap-3">
        <button id="agreementCancelBtn" class="px-5 py-2.5 rounded-lg text-sm font-medium bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700 hover:text-zinc-100 transition-colors duration-150 cursor-pointer">Cancel</button>
        <button id="agreementAcceptBtn" class="px-5 py-2.5 rounded-lg text-sm font-semibold text-primary-foreground transition-colors duration-150 cursor-pointer hover:brightness-110" style="background:hsl(var(--aifnmjmchg-m-primary));color:hsl(var(--aifnmjmchg-m-primary-foreground))">I agree, continue</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  function closeModal(agreed) {
    overlay.classList.add('closing');
    document.body.style.overflow = '';
    setTimeout(() => { overlay.remove(); resolve(agreed); }, 200);
  }

  // Cancel
  document.getElementById('agreementCancelBtn')?.addEventListener('click', () => closeModal(false));
  document.getElementById('agreementModalClose')?.addEventListener('click', () => closeModal(false));

  // Click outside card = cancel
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal(false);
  });

  // ESC = cancel
  function onKey(e) {
    if (e.key === 'Escape') { document.removeEventListener('keydown', onKey); closeModal(false); }
  }
  document.addEventListener('keydown', onKey);

  // Accept — call API then resolve
  document.getElementById('agreementAcceptBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('agreementAcceptBtn');
    btn.disabled = true;
    btn.textContent = 'Saving…';
    btn.classList.add('opacity-70');
    try {
      const res = await fetch('https://aitopia.ai/api/users/me/agreement', { method: 'POST', credentials: 'include' });
      if (res.ok) {
        window.__agreementApproved = true;
        closeModal(true);
      } else {
        btn.textContent = 'I agree, continue';
        btn.disabled = false;
        btn.classList.remove('opacity-70');
      }
    } catch (_) {
      btn.textContent = 'I agree, continue';
      btn.disabled = false;
      btn.classList.remove('opacity-70');
    }
  });
}

/**
 * Check if user is authenticated, redirect to login if not
 * @returns {Promise<boolean>} true if authenticated
 */
async function checkAuthOrRedirect() {
  const profile = window.AitopiaCache?.getUserProfile?.();
  if (profile) return true;
  try {
    const res = await fetch('https://aitopia.ai/auth/me', { method: 'GET', credentials: 'include' });
    if (res.ok) {
      const json = await res.json();
      const userData = json?.data?.user || json?.data || json?.user || json;
      const isLoggedIn = userData && !Array.isArray(userData) && typeof userData === 'object' && (userData.email || userData.key);
      if (isLoggedIn) return true;
    }
  } catch (_) {}
  location.href='/aitopia/marketplace/login.html?redirect=' + encodeURIComponent(window.location.pathname + window.location.search);
  return false;
}

/**
 * Hide pending-paid and error output states by element IDs
 * @param  {...string} ids - element IDs to hide (defaults to outputPendingPaid, outputError)
 */
function clearOutputStates(...ids) {
  const defaults = ['outputPendingPaid', 'outputError'];
  for (const id of (ids.length ? ids : defaults)) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  }
}

export {
  extractThumb,
  saveSnapshot,
  renderPendingPaidHTML,
  renderPendingPaidInto,
  fetchBalance,
  isInsufficient,
  firePricingModal,
  checkAuthOrRedirect,
  clearOutputStates,
  showAgreementModal,
};
