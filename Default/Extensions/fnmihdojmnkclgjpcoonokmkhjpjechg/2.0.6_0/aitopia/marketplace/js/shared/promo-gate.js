const PAID_PLANS   = ['basic', 'pro', 'creator', 'premium'];
const MODAL_DONE   = 'promo_modal_done';
const LOGIN_TS_KEY = 'promo_login_ts';

(async () => {
  try {
    const [meRes, cfg] = await Promise.all([
      fetch('https://aitopia.ai/auth/me', { method: 'GET', credentials: 'include' }).then(r => r.ok ? r.json() : null),
      fetch('https://aitopia.ai/store/promo-config.json').then(r => r.ok ? r.json() : {}),
    ]);

    // Must be logged in
    const user = meRes?.data?.user;
    const isLoggedIn = user && typeof user === 'object' && !Array.isArray(user) && (user.id || user.email);
    if (!isLoggedIn) {
      localStorage.removeItem(LOGIN_TS_KEY);
      return;
    }

    // Must NOT be on a paid plan
    const plan = meRes?.data?.licences?.plan_type?.toLowerCase();
    if (PAID_PLANS.includes(plan)) return;

    // Record login time on first detection
    if (!localStorage.getItem(LOGIN_TS_KEY)) {
      localStorage.setItem(LOGIN_TS_KEY, String(Date.now()));
    }
    const loginTs = parseInt(localStorage.getItem(LOGIN_TS_KEY), 10);
    const delay = Math.max(0, 2000 - (Date.now() - loginTs));

    await new Promise(r => setTimeout(r, delay));

    // ── Show announcement bar
    if (!localStorage.getItem('promo_bar_dismissed')) {
      localStorage.setItem('promo_bar_active', '1');
      const bar = document.getElementById('promo-announcement-bar');
      if (bar) bar.style.display = '';
    }

    // ── Show modal (only once ever)
    if (!localStorage.getItem(MODAL_DONE)) {
      const { default: PromoModal } = await import('/aitopia/marketplace/js/components/promo-modal.js');

      const ticket = cfg.ticket || {};
      const banner = cfg.banner || {};

      const baseSuffix = (ticket.promoCode || 'AITOPIA_PERSONAL_PROMO').replace(/^[^_]+/, '');
      const rawName = user.name || user.username || user.email?.split('@')[0] || '';
      const userPrefix = rawName.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
      const promoCode = userPrefix ? (userPrefix + baseSuffix) : (ticket.promoCode || 'PROMO');

      localStorage.setItem(MODAL_DONE, '1');
      new PromoModal({
        promoCode,
        discountPercent: ticket.discountPercent || 0,
        headline:        banner.description     || '',
        title:           banner.heading?.replace(/<[^>]*>/g, ' ').trim() || '',
        footerText:      cfg.text              || '',
        ctaText:         cfg.ctaText            || 'Claim Discount',
        ctaHref:         '/aitopia/marketplace/pricing.html',
        durationMs:      (ticket.durationHours || 3) * 3_600_000,
        storageKey:      'promo_expiry',
        onClaim:         (m) => { m.hide(); sessionStorage.setItem('pricing_ref', 'modal'); sessionStorage.setItem('pricing_promo_code', promoCode); location.href='/aitopia/marketplace/pricing.html'; },
      }).show();
    }
  } catch (e) {
    console.warn('[promo-gate] failed', e);
  }
})();
