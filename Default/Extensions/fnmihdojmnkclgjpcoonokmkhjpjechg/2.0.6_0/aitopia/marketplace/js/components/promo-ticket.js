const STYLE_ID = 'promo-ticket-styles';
const LS_KEY   = 'promo_expiry';
const NOTCH_R  = 11; // notch radius px

const CSS = `
/* Promo ticket color tokens — light mode default */
:root {
  --pt-bg: #FFF8D6;
  --pt-border: rgba(0,0,0,0.12);
  --pt-accent: #7A5C00;
  --pt-label: rgba(0,0,0,0.45);
  --pt-dim: rgba(0,0,0,0.32);
  --pt-digits: #1A1200;
  --pt-notch: #FFFFFF;
}
/* Dark mode overrides */
.dark {
  --pt-bg: #18181b;
  --pt-border: rgba(255,255,255,0.14);
  --pt-accent: #FFCC00;
  --pt-label: rgba(255,255,255,0.55);
  --pt-dim: rgba(255,255,255,0.3);
  --pt-digits: #ffffff;
  --pt-notch: #0F1113;
}

.promo-ticket-outer {
  position: relative;
  border-radius: 16px;
  width: 100%;
}
.promo-ticket {
  background: var(--pt-bg);
  border-radius: 16px;
  overflow: hidden;
  font-family: 'Inter', sans-serif;
  width: 100%;
  position: relative;
}
.promo-ticket-top {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 40px;
  border-bottom: 1px dashed var(--pt-border);
}
.promo-ticket-check {
  color: var(--pt-accent);
  display: flex;
  align-items: center;
  flex-shrink: 0;
}
.promo-ticket-code {
  font-weight: 700;
  font-size: 14px;
  color: var(--pt-accent);
  letter-spacing: 0.06em;
}
.promo-ticket-label {
  font-size: 14px;
  font-weight: 400;
  color: var(--pt-label);
}
.promo-ticket-body {
  display: flex;
  align-items: stretch;
}
.promo-ticket-discount {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 24px;
  position: relative;
}
.promo-ticket-discount::after {
  content: '';
  position: absolute;
  right: 0;
  top: 12px;
  bottom: 12px;
  border-right: 1px dashed var(--pt-border);
}
.promo-ticket-percent {
  font-size: 3rem;
  font-weight: 800;
  color: var(--pt-accent);
  line-height: 1;
  letter-spacing: -0.02em;
}
.promo-ticket-sub {
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.06em;
  color: var(--pt-dim);
  margin-top: 8px;
}
.promo-ticket-timer {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 24px;
}
.promo-ticket-digits {
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 3rem;
  font-weight: 800;
  color: var(--pt-digits);
  letter-spacing: -0.02em;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.promo-ticket-sep {
  padding: 0 2px;
  color: var(--pt-dim);
}
.promo-ticket-units {
  display: flex;
  margin-top: 8px;
  width: 100%;
  justify-content: space-around;
  padding: 0 4px;
}
.promo-ticket-unit-label {
  font-size: 12px;
  font-weight: 400;
  letter-spacing: 0.06em;
  color: var(--pt-dim);
  text-transform: lowercase;
  text-align: center;
}
/* Notch circles — children of outer wrapper, so they render over its border */
.promo-ticket-notch {
  position: absolute;
  width: ${NOTCH_R * 2}px;
  height: ${NOTCH_R * 2}px;
  border-radius: 50%;
  background: var(--pt-notch);
  z-index: 2;
}
.promo-ticket-notch.left  { left:  -${NOTCH_R}px; transform: translateY(-50%); }
.promo-ticket-notch.right { right: -${NOTCH_R}px; transform: translateY(-50%); }
.promo-ticket-notch.bottom {
  bottom: -${NOTCH_R}px;
}

/* Mobile */
@media (max-width: 480px) {
  .promo-ticket-top {
    padding: 10px 16px;
    gap: 6px;
  }
  .promo-ticket-code {
    font-size: 11px;
  }
  .promo-ticket-label {
    font-size: 11px;
  }
  .promo-ticket-discount {
    padding: 20px 16px;
  }
  .promo-ticket-timer {
    padding: 20px 16px;
  }
  .promo-ticket-percent {
    font-size: 2rem;
  }
  .promo-ticket-digits {
    font-size: 2rem;
  }
}
`;

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

function pad(n) {
  return String(Math.max(0, Math.floor(n))).padStart(2, '0');
}

class PromoTicket {
  constructor({ container, id = 'pt', promoCode: promoCodeOverride = null } = {}) {
    this.container = container || null;
    this._timer = null;
    this._id = id;
    this._promoCodeOverride = promoCodeOverride;
  }

  async init() {
    injectStyles();
    let cfg = {};
    try {
      const res = await fetch('https://aitopia.ai/store/promo-config.json');
      if (res.ok) cfg = (await res.json())?.ticket || {};
    } catch (e) {
      console.warn('[promo-ticket] config fetch failed', e);
    }

    const promoCode       = this._promoCodeOverride || cfg.promoCode || 'PROMO';
    const discountPercent = cfg.discountPercent  || 0;
    const subText         = cfg.subText          || 'With limited-offer promo';
    const durationHours   = cfg.durationHours    || 3;

    this._render(promoCode, discountPercent, subText);
    const afterRender = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          this._positionNotches();
          // Re-position on resize
          const outer = this.container?.querySelector('.promo-ticket-outer');
          if (outer && window.ResizeObserver) {
            new ResizeObserver(() => this._positionNotches()).observe(outer);
          }
        });
      });
    };
    if (document.fonts?.ready) {
      document.fonts.ready.then(afterRender);
    } else {
      afterRender();
    }
    this._startTimer(durationHours, this._id);
  }

  _render(promoCode, discountPercent, subText) {
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="promo-ticket-outer">
        <div class="promo-ticket">
          <div class="promo-ticket-top">
            <span class="promo-ticket-check">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/>
              </svg>
            </span>
            <span class="promo-ticket-code">${promoCode}</span>
            <span class="promo-ticket-label">promocode is applied</span>
          </div>
          <div class="promo-ticket-body">
            <div class="promo-ticket-discount">
              <div class="promo-ticket-percent">${discountPercent}% OFF</div>
              <div class="promo-ticket-sub">${subText}</div>
            </div>
            <div class="promo-ticket-timer">
              <div class="promo-ticket-digits">
                <span id="${this._id}-hours">00</span>
                <span class="promo-ticket-sep">:</span>
                <span id="${this._id}-minutes">00</span>
                <span class="promo-ticket-sep">:</span>
                <span id="${this._id}-seconds">00</span>
              </div>
              <div class="promo-ticket-units">
                <span class="promo-ticket-unit-label">hours</span>
                <span class="promo-ticket-unit-label">minutes</span>
                <span class="promo-ticket-unit-label">seconds</span>
              </div>
            </div>
          </div>
        </div>
        <div class="promo-ticket-notch left"></div>
        <div class="promo-ticket-notch right"></div>
        <div class="promo-ticket-notch bottom"></div>
      </div>
    `;
  }

  _positionNotches() {
    const outer    = this.container?.querySelector('.promo-ticket-outer');
    const topEl    = this.container?.querySelector('.promo-ticket-top');
    const discount = this.container?.querySelector('.promo-ticket-discount');
    if (!outer || !topEl || !discount) return;

    const outerRect    = outer.getBoundingClientRect();
    const topRect      = topEl.getBoundingClientRect();
    const discountRect = discount.getBoundingClientRect();

    const dividerY = topRect.bottom - outerRect.top;
    outer.querySelectorAll('.promo-ticket-notch.left, .promo-ticket-notch.right').forEach(el => {
      el.style.top = dividerY + 'px';
    });

    const dividerX = discountRect.right - outerRect.left;
    const bottomNotch = outer.querySelector('.promo-ticket-notch.bottom');
    if (bottomNotch) {
      bottomNotch.style.left = dividerX + 'px';
      bottomNotch.style.transform = 'translateX(-50%)';
    }
  }

  _startTimer(durationHours, idPrefix = 'pt') {
    const now    = Date.now();
    const stored = parseInt(localStorage.getItem(LS_KEY) || '0', 10);
    const end    = stored > now ? stored : now + durationHours * 3_600_000;
    if (!stored || stored <= now) localStorage.setItem(LS_KEY, String(end));

    const tick = () => {
      const rem = Math.max(0, end - Date.now());
      const h   = Math.floor(rem / 3_600_000);
      const m   = Math.floor((rem % 3_600_000) / 60_000);
      const s   = Math.floor((rem % 60_000) / 1_000);

      const elH = document.getElementById(`${idPrefix}-hours`);
      const elM = document.getElementById(`${idPrefix}-minutes`);
      const elS = document.getElementById(`${idPrefix}-seconds`);
      if (elH) elH.textContent = pad(h);
      if (elM) elM.textContent = pad(m);
      if (elS) elS.textContent = pad(s);

      if (rem <= 0) clearInterval(this._timer);
    };

    tick();
    this._timer = setInterval(tick, 1000);
  }

  destroy() {
    clearInterval(this._timer);
    if (this.container) this.container.innerHTML = '';
  }
}

export default PromoTicket;
