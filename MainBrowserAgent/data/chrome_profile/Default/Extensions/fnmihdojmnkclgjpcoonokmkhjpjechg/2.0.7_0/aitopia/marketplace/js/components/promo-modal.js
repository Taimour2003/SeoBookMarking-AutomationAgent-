import PromoTicket from '/aitopia/marketplace/js/components/promo-ticket.js';

const PROMO_MODAL_STYLE_ID = 'promo-modal-styles';

function injectStyles() {
  if (document.getElementById(PROMO_MODAL_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = PROMO_MODAL_STYLE_ID;
  style.textContent = `
    /* Promo modal color tokens */
    :root {
      --pm-bg-from: #42176B;
      --pm-bg-via: #4D2573;
      --pm-bg-to: #451B6D;
      --pm-purple: #9436EC;
      --pm-gift-bg: #7c3aed;
      --pm-yellow: #FFD91F;
      --pm-text-muted: #9CA3AF;
      --pm-surface: rgba(255,255,255,0.04);
      --pm-surface-hover: rgba(255,255,255,0.15);
      --pm-border-soft: rgba(255,255,255,0.06);
      --pm-border: rgba(255,255,255,0.08);
      --pm-border-mid: rgba(255,255,255,0.1);
      --pm-divider: rgba(255,255,255,0.15);
      --pm-title-color: var(--pm-purple);
    }
    /* Dark mode: deeper background */
    .dark {
      --pm-bg-from: #131115;
      --pm-bg-via: #1A1420;
      --pm-bg-to: #111012;
    }
    /* Light mode: yellow title instead of purple */
    html:not(.dark) { --pm-title-color: var(--promo-bar-bg); }

    .pm-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.72);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 99999;
      padding: 16px;
      animation: pm-fade-in 0.2s ease;
    }
    .pm-overlay.pm-hiding {
      animation: pm-fade-out 0.2s ease forwards;
    }
    @keyframes pm-fade-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes pm-fade-out {
      from { opacity: 1; }
      to   { opacity: 0; }
    }
    .pm-card {
      position: relative;
      background: linear-gradient(160deg, var(--pm-bg-from) 0%, var(--pm-bg-via) 50%, var(--pm-bg-to) 100%);
      border-radius: 24px;
      width: min(520px, calc(100vw - 32px));
      max-height: calc(100vh - 32px);
      overflow: hidden;
      padding: 0;
      box-shadow: 0 32px 80px rgba(0,0,0,0.6);
      animation: pm-slide-up 0.25s cubic-bezier(0.34,1.56,0.64,1);
    }
    @keyframes pm-slide-up {
      from { transform: translateY(32px) scale(0.96); opacity: 0; }
      to   { transform: translateY(0)    scale(1);    opacity: 1; }
    }
    .pm-dot {
      position: absolute;
      border-radius: 50%;
      pointer-events: none;
    }
    .pm-dot-cyan   { width:14px;height:14px;background:#22d3ee;top:48px;left:20px; }
    .pm-dot-green  { width:16px;height:16px;background:#4ade80;top:120px;right:20px; }
    .pm-dot-yellow { width:18px;height:18px;background:#facc15;bottom:140px;left:16px; }
    .pm-dot-pink   { width:10px;height:10px;background:#f472b6;bottom:40px;right:20px; }
    .pm-dot-blue   { width:12px;height:12px;background:#818cf8;top:300px;right:18px; }
    .pm-inner {
      padding: 20px 28px 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 0;
    }
    .pm-topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 20px;
      background: var(--pm-surface);
      border-bottom: 1px solid var(--pm-border-soft);
    }
    .pm-topbar-label {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--pm-text-muted);
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.04em;
      font-family: 'Inter', sans-serif;
      text-transform: uppercase;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    @media (min-width: 400px) {
      .pm-topbar-label { font-size: 11px; }
    }
    @media (min-width: 520px) {
      .pm-topbar-label { font-size: 12px; }
    }
    .pm-close-btn {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: var(--pm-border);
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--pm-text-muted);
      transition: background 0.15s;
      flex-shrink: 0;
    }
    .pm-close-btn:hover { background: var(--pm-surface-hover); color: #fff; }
    .pm-gift-icon {
      width: 76px;
      height: 76px;
      border-radius: 20px;
      background: var(--pm-gift-bg);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 16px auto 16px;
      flex-shrink: 0;
    }
    .pm-headline {
      color: #ffffff;
      font-size: 1rem;
      font-weight: 700;
      line-height: 1.3;
      font-family: 'Inter', sans-serif;
      margin-bottom: 6px;
    }
    .pm-title {
      color: var(--pm-title-color);
      font-size: 1rem;
      font-weight: 700;
      line-height: 1.3;
      font-family: 'Inter', sans-serif;
      margin-bottom: 14px;
    }
    @media (min-width: 400px) {
      .pm-headline { font-size: 1.1rem; }
      .pm-title    { font-size: 1.1rem; }
    }
    @media (min-width: 520px) {
      .pm-headline { font-size: 1.2rem; }
      .pm-title    { font-size: 1.2rem; }
    }
    @media (min-width: 1280px) {
      .pm-headline { font-size: 1.15rem; }
      .pm-title    { font-size: 1.15rem; }
    }
    .pm-promo-bar {
      width: 100%;
      background: rgba(255,255,255,0.05);
      border: 1px solid var(--pm-border-mid);
      border-radius: 12px;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-bottom: 0;
    }
    .pm-promo-code {
      color: var(--pm-yellow);
      font-size: 11px;
      font-weight: 700;
      font-family: 'Inter', sans-serif;
      letter-spacing: 0.04em;
    }
    .pm-promo-label {
      color: var(--pm-text-muted);
      font-size: 11px;
      font-weight: 500;
      font-family: 'Inter', sans-serif;
    }
    @media (min-width: 400px) {
      .pm-promo-code  { font-size: 12px; }
      .pm-promo-label { font-size: 12px; }
    }
    @media (min-width: 520px) {
      .pm-promo-code  { font-size: 13px; }
      .pm-promo-label { font-size: 13px; }
    }
    .pm-info-grid {
      width: 100%;
      background: var(--pm-surface);
      border: 1px solid var(--pm-border);
      border-radius: 12px;
      display: grid;
      grid-template-columns: 1fr 1px 1fr;
      overflow: hidden;
      margin-top: 12px;
    }
    .pm-info-divider {
      background: var(--pm-border-mid);
      border: none;
      width: 1px;
      margin: 16px 0;
      border-left: 1px dashed var(--pm-divider);
    }
    .pm-info-cell {
      padding: 16px 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    .pm-discount-val {
      color: var(--pm-yellow);
      font-size: 1.4rem;
      font-weight: 700;
      font-family: 'Inter', sans-serif;
      line-height: 1;
    }
    .pm-discount-sub {
      color: var(--pm-text-muted);
      font-size: 11px;
      font-weight: 500;
      font-family: 'Inter', sans-serif;
    }
    .pm-countdown-val {
      color: #ffffff;
      font-size: 1.4rem;
      font-weight: 700;
      font-family: 'Inter', sans-serif;
      line-height: 1;
      letter-spacing: 0.04em;
      font-variant-numeric: tabular-nums;
    }
    .pm-countdown-labels {
      display: flex;
      gap: 14px;
      color: var(--pm-text-muted);
      font-size: 10px;
      font-weight: 500;
      font-family: 'Inter', sans-serif;
    }
    .pm-footer-text {
      color: var(--pm-text-muted);
      font-size: 11px;
      font-weight: 500;
      font-family: 'Inter', sans-serif;
      line-height: 1.5;
      margin-top: 10px;
    }
    @media (min-width: 400px) {
      .pm-discount-val     { font-size: 1.5rem; }
      .pm-countdown-val    { font-size: 1.5rem; }
      .pm-discount-sub     { font-size: 11px; }
      .pm-countdown-labels { font-size: 11px; }
      .pm-footer-text      { font-size: 11px; }
    }
    @media (min-width: 520px) {
      .pm-discount-val     { font-size: 1.65rem; }
      .pm-countdown-val    { font-size: 1.65rem; }
      .pm-discount-sub     { font-size: 12px; }
      .pm-countdown-labels { font-size: 12px; gap: 16px; }
      .pm-footer-text      { font-size: 12px; }
    }
    @media (min-width: 1280px) {
      .pm-discount-val     { font-size: 1.65rem; }
      .pm-countdown-val    { font-size: 1.65rem; }
      .pm-discount-sub     { font-size: 12px; }
      .pm-countdown-labels { font-size: 12px; gap: 16px; }
      .pm-footer-text      { font-size: 12px; }
    }
    .pm-cta {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      padding: 12px;
      border-radius: 100px;
      background: linear-gradient(135deg, var(--pm-gift-bg) 0%, var(--pm-purple) 100%);
      color: #ffffff;
      font-size: 0.95rem;
      font-weight: 700;
      font-family: 'Inter', sans-serif;
      text-decoration: none;
      border: none;
      cursor: pointer;
      margin-top: 14px;
      transition: opacity 0.15s, transform 0.15s;
    }
    .pm-cta:hover   { opacity: 0.92; transform: translateY(-1px); }
    .pm-cta:active  { transform: scale(0.98); }

    /* Smaller ticket sizes inside modal */
    .pm-card .promo-ticket-percent { font-size: 2rem !important; }
    .pm-card .promo-ticket-digits  { font-size: 2rem !important; }
    .pm-card .promo-ticket-top     { padding: 10px 24px !important; }
    .pm-card .promo-ticket-discount,
    .pm-card .promo-ticket-timer   { padding: 20px 16px !important; }

    .pm-card .promo-ticket { background: #41166A !important; }
    .pm-card .promo-ticket-top { border-bottom-color: rgba(255,255,255,0.14) !important; }
    .pm-card .promo-ticket-code,
    .pm-card .promo-ticket-check,
    .pm-card .promo-ticket-percent { color: #FFCC00 !important; }
    .pm-card .promo-ticket-label { color: rgba(255,255,255,0.55) !important; }
    .pm-card .promo-ticket-sub,
    .pm-card .promo-ticket-sep,
    .pm-card .promo-ticket-unit-label { color: rgba(255,255,255,0.35) !important; }
    .pm-card .promo-ticket-digits { color: #ffffff !important; }
    .pm-card .promo-ticket-discount::after { border-right-color: rgba(255,255,255,0.14) !important; }
    .pm-card .promo-ticket-notch { background: transparent !important; }
    .pm-card .promo-ticket-outer { background: transparent !important; }

    /* In dark mode, use a slightly lighter card bg */
    .dark .pm-card .promo-ticket { background: #1E1A22 !important; }
  `;
  document.head.appendChild(style);
}

class PromoModal {
  constructor(options = {}) {
    this.options = Object.assign({
      promoCode: 'PROMO_CODE',
      discountPercent: 52,
      headline: 'You are in %5 who received this personal %52 OFF with',
      title: 'Nano Banana 2 Pro & Early Access To Advanced AI Models',
      footerText: 'This offer is active for limited time only. Get Premium plans with 52% OFF',
      ctaText: 'Claim Discount',
      ctaHref: '/aitopia/marketplace/pricing.html',
      durationMs: 3 * 60 * 60 * 1000,
      storageKey: 'promo_expiry',
      onClaim: null,
      onClose: null,
    }, options);

    this._overlay = null;
    this._timer = null;
    injectStyles();
  }

  _getExpiry() {
    const key = this.options.storageKey;
    let expiry = parseInt(localStorage.getItem(key) || '0', 10);
    if (!expiry || expiry < Date.now()) {
      expiry = Date.now() + this.options.durationMs;
      localStorage.setItem(key, String(expiry));
    }
    return expiry;
  }

  _startCountdown() {
    const expiry = this._getExpiry();
    const el = this._overlay?.querySelector('.pm-countdown-val');
    if (!el) return;

    const tick = () => {
      const remaining = Math.max(0, expiry - Date.now());
      const h = Math.floor(remaining / 3600000);
      const m = Math.floor((remaining % 3600000) / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      const pad = (n) => String(n).padStart(2, '0');
      el.textContent = `${pad(h)} : ${pad(m)} : ${pad(s)}`;
      if (remaining > 0) {
        this._timer = setTimeout(tick, 1000);
      }
    };
    tick();
  }

  _stopCountdown() {
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
  }

  _buildHTML() {
    const o = this.options;
    return `
      <div class="pm-topbar">
        <div class="pm-topbar-label">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v14M9 5v14"/></svg>
          CONGRATS, YOU ARE IN 5% WHO RECEIVES THIS OFFER
        </div>
        <button class="pm-close-btn" aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="pm-inner">
        <!-- Gift icon -->
        <div class="pm-gift-icon">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12v10H4V12"/><path d="M22 7H2v5h20V7z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>
        </div>

        <!-- Headline -->
        <p class="pm-headline">${o.headline}</p>
        <p class="pm-title">${o.title}</p>

        <!-- Promo Ticket -->
        <div id="pm-ticket-container" style="width:100%;margin-bottom:8px;"></div>

        <!-- Footer text -->
        <p class="pm-footer-text">${o.footerText}</p>

        <!-- CTA -->
        <a href="${o.ctaHref}" class="pm-cta" role="button">${o.ctaText}</a>
      </div>
    `;
  }

  _loadConfettiLib() {
    if (window.confetti) return Promise.resolve(window.confetti);
    return import(/* @vite-ignore */ '/aitopia/marketplace/js/vendor/confetti.browser.esm.js')
      .then(function(m){ return (m && m.default) || window.confetti; })
      .catch(function(){ return window.confetti; });
  }

  async _launchConfetti() {
    const card = this._overlay?.querySelector('.pm-card');
    if (!card) return;

    const confetti = await this._loadConfettiLib();
    if (!this._overlay) return;

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:10;border-radius:24px;';
    card.appendChild(canvas);
    this._confettiCanvas = canvas;

    const myConfetti = confetti.create(canvas, { resize: true, useWorker: false });

    const COLORS = ['#7c3aed','#a855f7','#ffd91f','#facc15','#f472b6','#22d3ee','#4ade80','#ffffff','#c084fc'];

    const burst = (origin, angle, spread) => myConfetti({
      particleCount: 60,
      angle,
      spread,
      origin,
      colors: COLORS,
      startVelocity: 45,
      gravity: 0.8,
      scalar: 0.9,
      ticks: 200,
      shapes: ['square', 'circle'],
    });

    burst({ x: 0.5, y: 1 }, 90, 70);

    setTimeout(() => {
      if (!this._overlay) return;
      burst({ x: 0.1, y: 1 }, 65, 55);
      burst({ x: 0.9, y: 1 }, 115, 55);
    }, 200);

    this._confettiTimeout = setTimeout(() => {
      myConfetti.reset();
      canvas.remove();
      this._confettiCanvas = null;
    }, 4500);
  }

  _stopConfetti() {
    if (this._confettiTimeout) { clearTimeout(this._confettiTimeout); this._confettiTimeout = null; }
    this._confettiCanvas?.remove();
    this._confettiCanvas = null;
  }

  show() {
    if (this._overlay) return;

    const overlay = document.createElement('div');
    overlay.className = 'pm-overlay';

    const card = document.createElement('div');
    card.className = 'pm-card';
    card.innerHTML = this._buildHTML();
    overlay.appendChild(card);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.hide();
    });

    card.querySelector('.pm-close-btn').addEventListener('click', () => {
      if (typeof this.options.onClose === 'function') this.options.onClose(this);
      this.hide();
    });

    card.querySelector('.pm-cta').addEventListener('click', (e) => {
      if (typeof this.options.onClaim === 'function') {
        e.preventDefault();
        this.options.onClaim(this);
      }
    });

    document.body.appendChild(overlay);
    this._overlay = overlay;

    const ticketContainer = card.querySelector('#pm-ticket-container');
    if (ticketContainer) {
      this._ticket = new PromoTicket({ container: ticketContainer, id: 'pt-modal', promoCode: this.options.promoCode });
      this._ticket.init();
    }

    setTimeout(() => this._launchConfetti(), 260);
  }

  hide() {
    if (!this._overlay) return;
    this._stopCountdown();
    this._stopConfetti();
    this._ticket?.destroy();
    this._overlay.classList.add('pm-hiding');
    this._overlay.addEventListener('animationend', () => {
      this._overlay?.remove();
      this._overlay = null;
    }, { once: true });
  }

  destroy() {
    this._stopCountdown();
    this._stopConfetti();
    this._ticket?.destroy();
    this._overlay?.remove();
    this._overlay = null;
  }
}

export default PromoModal;
