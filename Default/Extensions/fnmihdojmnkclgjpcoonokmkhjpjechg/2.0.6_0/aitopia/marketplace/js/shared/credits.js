(function () {
  const existing = typeof window !== 'undefined' && window.AitopiaCredits ? window.AitopiaCredits : {};

  const DEFAULT_CONFIG = {
    billingMode: 'unknown',
    usdPerCredit: 0.02,
    defaultEstimateSeconds: 4,
    guestDailyCredits: 50,
    registeredDailyCredits: 10,
  };

  const setUserCredits = (credits) => window.AitopiaCache?.setUserCredits?.(credits);

  window.dismissCreditsToast = function () {
    const el = document.getElementById('credits-low-toast');
    if (el) el.remove();
  };

  let config = { ...DEFAULT_CONFIG, ...(existing.getBillingConfig?.() || {}) };
  let configPromise = null;
  let balancePromise = null;

  function clampPositiveNumber(value, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return fallback;
    return n;
  }

  function clampNonNegativeInt(value, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return fallback;
    return Math.floor(n);
  }

  function setBillingConfig(next) {
    if (!next || typeof next !== 'object') return getBillingConfig();

    config = {
      ...config,
      billingMode: typeof next.billingMode === 'string' ? next.billingMode : config.billingMode,
      usdPerCredit: clampPositiveNumber(next.usdPerCredit, config.usdPerCredit),
      defaultEstimateSeconds: clampNonNegativeInt(next.defaultEstimateSeconds, config.defaultEstimateSeconds),
      guestDailyCredits: clampNonNegativeInt(next.guestDailyCredits, config.guestDailyCredits),
      registeredDailyCredits: clampNonNegativeInt(next.registeredDailyCredits, config.registeredDailyCredits),
    };

    return getBillingConfig();
  }

  function getBillingConfig() {
    return { ...config };
  }

  async function loadBillingConfig(options) {
    if (configPromise && !options?.force) return configPromise;

    const fetchFn = typeof window !== 'undefined' && window.fetchHelper ? window.fetchHelper : fetch;
    configPromise = fetchFn('https://aitopia.ai/api/config/billing', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'include',
      signal: options?.signal,
    })
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json().catch(() => null);
      })
      .then((json) => {
        if (json) setBillingConfig(json);
        return getBillingConfig();
      })
      .catch(() => getBillingConfig())
      .finally(() => {
        configPromise = null;
      });

    return configPromise;
  }

  function creditsFromUsd(costUsd) {
    const usd = Number(costUsd);
    if (!Number.isFinite(usd) || usd <= 0) return 0;
    const usdPerCredit = clampPositiveNumber(config.usdPerCredit, DEFAULT_CONFIG.usdPerCredit);
    return Math.max(1, Math.ceil(usd / usdPerCredit));
  }

  function parseUsdFromPriceString(price) {
    if (typeof price !== 'string') return null;
    const match = price.match(/\$([0-9]+(?:\.[0-9]+)?)/);
    if (!match) return null;
    const value = Number(match[1]);
    return Number.isFinite(value) ? value : null;
  }

  function getCreditsInfoFromCost(cost) {
    if (!cost || typeof cost !== 'object') return null;

    if (typeof cost.perOutput === 'number' && Number.isFinite(cost.perOutput)) {
      if (cost.perOutput <= 0) return null;
      const credits = creditsFromUsd(cost.perOutput);
      return { label: `${credits} credits`, minCredits: credits, maxCredits: credits };
    }

    if (typeof cost.perSecond === 'number' && Number.isFinite(cost.perSecond)) {
      if (cost.perSecond <= 0) return null;
      const seconds = clampNonNegativeInt(config.defaultEstimateSeconds, DEFAULT_CONFIG.defaultEstimateSeconds) || DEFAULT_CONFIG.defaultEstimateSeconds;
      const credits = creditsFromUsd(cost.perSecond * seconds);
      return {
        label: `~${credits} credits (${seconds}s)`,
        minCredits: credits,
        maxCredits: credits,
      };
    }

    return null;
  }

  function getCreditsInfoForAgent(agent) {
    // Prefer explicit per-run estimate from backend
    if (agent?.costEstimate && typeof agent.costEstimate === 'object') {
      const minUsd = Number(agent.costEstimate.minCost);
      const maxUsd = Number(agent.costEstimate.maxCost);
      if (Number.isFinite(minUsd) && Number.isFinite(maxUsd) && minUsd > 0 && maxUsd > 0) {
        const minCredits = creditsFromUsd(minUsd);
        const maxCredits = creditsFromUsd(maxUsd);
        const label = minCredits === maxCredits ? `${minCredits} credits` : `${minCredits}–${maxCredits} credits`;
        return { label, minCredits, maxCredits };
      }
    }

    // Otherwise, estimate from the recommended model's unit pricing
    const modelChoices = Array.isArray(agent?.modelChoices) ? agent.modelChoices : [];
    const model = modelChoices.find((m) => m?.recommended && m?.cost) || modelChoices.find((m) => m?.cost);
    const modelInfo = getCreditsInfoFromCost(model?.cost);
    if (modelInfo) return modelInfo;

    // Final fallback: legacy USD price strings (avoid surfacing tiers/subscription text)
    const legacyUsd = parseUsdFromPriceString(agent?.price);
    if (legacyUsd !== null) {
      if (legacyUsd <= 0) return { label: 'Credits vary', minCredits: null, maxCredits: null };
      const credits = creditsFromUsd(legacyUsd);
      return { label: `${credits} credits`, minCredits: credits, maxCredits: credits };
    }

    return { label: 'Credits vary', minCredits: null, maxCredits: null };
  }

  function getCreditsLabelForAgent(agent) {
    return getCreditsInfoForAgent(agent).label;
  }

  function getCreditsDisplayForModelChoice(choice) {
    if (!choice || typeof choice !== 'object') return '';
    const cost = choice.cost;
    if (!cost || typeof cost !== 'object') return '';

    if (typeof cost.perOutput === 'number' && Number.isFinite(cost.perOutput)) {
      if (cost.perOutput <= 0) return '';
      const usd = Math.max(0, cost.perOutput);
      const credits = usd === 0 ? 0 : creditsFromUsd(usd);
      return ` — ${credits} credits`;
    }

    if (typeof cost.perSecond === 'number' && Number.isFinite(cost.perSecond)) {
      if (cost.perSecond <= 0) return '';
      const seconds = clampNonNegativeInt(config.defaultEstimateSeconds, DEFAULT_CONFIG.defaultEstimateSeconds) || DEFAULT_CONFIG.defaultEstimateSeconds;
      const usd = Math.max(0, cost.perSecond) * seconds;
      const credits = usd === 0 ? 0 : creditsFromUsd(usd);
      return ` — ~${credits} credits (${seconds}s)`;
    }

    return '';
  }

  // ============================================
  // Dynamic Pricing (form-data aware)
  // ============================================

  // All price-affecting field names (UI controllable only)
  const PRICE_AFFECTING_FIELDS = {
    // Duration (per-second models)
    duration: ['duration', 'durationSeconds', 'durationImage', 'seconds', 'videoDuration', 'audioDuration', 'length'],
    // Mode (can change which duration field is active)
    mode: ['mode'],
    // Count (multiplier)
    count: ['count', 'numOutputs', 'num_outputs', 'batchSize'],
    // Quality
    quality: ['quality'],
    // Scale
    scale: ['scale'],
    // Resolution (model-dependent pricing for specific models)
    resolution: ['resolution'],
    // Post-processing (minor impact)
    postProcess: ['enhanceFaces', 'denoise']
  };

  // Flat list for quick lookup
  const ALL_PRICE_AFFECTING_FIELDS = Object.values(PRICE_AFFECTING_FIELDS).flat();

  // Extract value from form data with fallback
  function getFormValue(formData, fieldNames, defaultValue = null) {
    if (!formData || typeof formData !== 'object') return defaultValue;
    for (const field of fieldNames) {
      const val = formData[field];
      if (val !== undefined && val !== null && val !== '') {
        return val;
      }
    }
    return defaultValue;
  }

  // Calculate credits with dynamic parameters
  function getDynamicCreditsForModelChoice(choice, formData = {}) {
    const cost = choice?.cost;
    if (!cost || typeof cost !== 'object') return null;

    let baseUsd = 0;
    let multiplier = 1;
    let seconds = null;
    let isDynamic = false;
    const breakdown = {};

    // 1. Per-Second Models (Duration-based)
    if (typeof cost.perSecond === 'number' && cost.perSecond > 0) {
      const modeVal = String(getFormValue(formData, PRICE_AFFECTING_FIELDS.mode, '') || '').trim().toLowerCase();
      const durationFields = modeVal === 'image'
        ? ['durationImage', 'duration', 'durationSeconds', 'seconds', 'videoDuration', 'audioDuration', 'length']
        : PRICE_AFFECTING_FIELDS.duration;
      const durationVal = getFormValue(formData, durationFields, null);
      seconds = durationVal !== null ? Number(durationVal) : (config.defaultEstimateSeconds || DEFAULT_CONFIG.defaultEstimateSeconds);
      if (Number.isFinite(seconds) && seconds > 0) {
        baseUsd = cost.perSecond * seconds;
        isDynamic = durationVal !== null;
        breakdown.duration = seconds;
      }

      // Wan 2.5 has explicit resolution-based per-second rates in backend pricing.
      const resolutionVal = String(getFormValue(formData, PRICE_AFFECTING_FIELDS.resolution, '') || '').trim();
      if (resolutionVal && Number.isFinite(seconds) && seconds > 0) {
        const modelId = String(choice?.id || '');
        const wan25Rates = {
          'wan-video/wan-2.5-i2v': { '480p': 0.05, '720p': 0.10, '1080p': 0.15 },
          'wan-video/wan-2.5-t2v': { '480p': 0.05, '720p': 0.10, '1080p': 0.15 }
        };
        const modelRates = wan25Rates[modelId];
        const overrideRate = modelRates?.[resolutionVal];
        if (typeof overrideRate === 'number' && overrideRate > 0) {
          baseUsd = overrideRate * seconds;
          isDynamic = true;
          breakdown.resolution = resolutionVal;
        }
      }
    }
    // 2. Per-Output Models (Fixed base, with resolution overrides)
    else if (typeof cost.perOutput === 'number' && cost.perOutput > 0) {
      baseUsd = cost.perOutput;

      // Resolution-based pricing for per-output models (e.g., nano-banana-2/edit)
      const resolutionVal = String(getFormValue(formData, PRICE_AFFECTING_FIELDS.resolution, '') || '').trim();
      if (resolutionVal) {
        const modelId = String(choice?.id || '');
        const perOutputResRates = {
          'fal-ai/nano-banana-2/edit': { '0.5K': 0.04, '1K': 0.08, '2K': 0.12 },
        };
        const modelRates = perOutputResRates[modelId];
        const overridePrice = modelRates?.[resolutionVal];
        if (typeof overridePrice === 'number' && overridePrice > 0) {
          baseUsd = overridePrice;
          isDynamic = true;
          breakdown.resolution = resolutionVal;
        }
      }
    }

    if (baseUsd <= 0) return null;

    // Apply Count Multiplier
    const countVal = getFormValue(formData, PRICE_AFFECTING_FIELDS.count, 1);
    const count = Number(countVal) || 1;
    if (count > 1) {
      multiplier *= count;
      isDynamic = true;
      breakdown.count = count;
    }

    // Apply Quality Modifier (DALL-E HD = ~1.5x)
    const quality = getFormValue(formData, PRICE_AFFECTING_FIELDS.quality, 'standard');
    if (quality === 'hd' || quality === 'HD') {
      multiplier *= 1.5;
      isDynamic = true;
      breakdown.quality = 'hd';
    }

    // Apply Scale Modifier (4x = ~1.5x cost of 2x)
    const scale = getFormValue(formData, PRICE_AFFECTING_FIELDS.scale, null);
    if (scale === 4 || scale === '4' || scale === '4x' || scale === '4×') {
      multiplier *= 1.5;
      isDynamic = true;
      breakdown.scale = '4x';
    }

    // Calculate final
    const usdPerCredit = clampPositiveNumber(config.usdPerCredit, DEFAULT_CONFIG.usdPerCredit);
    const finalUsd = baseUsd * multiplier;
    const credits = Math.max(1, Math.ceil(finalUsd / usdPerCredit));

    // Build label
    let label = `${credits} credits`;
    if (seconds !== null && count > 1) {
      label = `~${credits} credits (${seconds}s × ${count})`;
    } else if (seconds !== null) {
      label = `~${credits} credits (${seconds}s)`;
    } else if (count > 1) {
      label = `~${credits} credits (${count}×)`;
    }

    return {
      credits,
      label,
      seconds,
      count,
      isDynamic,
      breakdown,
      usd: finalUsd
    };
  }

  // Format display string for dynamic pricing
  function getCreditsDisplayForModelChoiceDynamic(choice, formData) {
    const result = getDynamicCreditsForModelChoice(choice, formData);
    return result ? ` — ${result.label}` : '';
  }

  // Check if a field affects pricing
  function isPriceAffectingField(fieldName) {
    if (!fieldName || typeof fieldName !== 'string') return false;
    return ALL_PRICE_AFFECTING_FIELDS.includes(fieldName);
  }

  function updateGlobalCreditsDisplay(data) {
    if (!data || !data.balance) return;
    const { totalCreditsRemaining, totalCredits } = data.balance;
    const credits = typeof totalCredits === 'number' ? totalCredits : totalCreditsRemaining;
    if (typeof credits !== 'number') return;

    setUserCredits(credits);

    // Dispatch global event for other components
    try {
      window.dispatchEvent(new CustomEvent('aifnmjmchg-credits-updated', { detail: data }));
    } catch (e) {
      console.warn('Failed to dispatch credits event', e);
    }

    maybeShowLowCreditsToast(data.balance);

    // Auto-update common UI elements if they exist
    const selectors = [
      '#credits-balance',
      '#nav-credits',
      '#user-credits',
      '#header-credits',
      '.credits-display',
      '[data-credits-display]'
    ];

    selectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        if (el) {
          // Preserve existing text structure if possible, just replacing the number
          // or straightforward replacement
          el.textContent = `${totalCreditsRemaining} credits`;
          el.classList.remove('hidden');
        }
      });
    });
  }

  function maybeShowLowCreditsToast(balance) {
    try {
      if (window.location.pathname === '/aitopia/marketplace/pricing.html') return;

      const total     = balance?.dailyAllowanceCredits;
      const remaining = balance?.dailyCreditsRemaining;
      if (!total || total <= 0 || remaining == null) return;
      if (((total - remaining) / total) * 100 < 90) return;

      document.getElementById('credits-low-toast')?.remove();

      if (!document.getElementById('_clt-styles')) {
        const s = document.createElement('style');
        s.id = '_clt-styles';
        s.textContent = `
          @keyframes _clt-in{from{transform:translateY(16px);opacity:0}to{transform:translateY(0);opacity:1}}
          #credits-low-toast{background:linear-gradient(135deg,#F5F3F8 0%,#EBE7F1 50%,#F5F3F8 100%)}
          #credits-low-toast .clt-text{color:#111}
          #credits-low-toast .clt-close{background:#EDE9F3;color:#111}
          html.dark #credits-low-toast{background:linear-gradient(135deg,#1C1E20 0%,#31233E 50%,#1C1E20 100%)}
          html.dark #credits-low-toast .clt-text{color:#fff}
          html.dark #credits-low-toast .clt-close{background:#1C1E20;color:#fff}
        `;
        document.head.appendChild(s);
      }

      const toast = document.createElement('div');
      toast.id = 'credits-low-toast';
      toast.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:99999;display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:14px 16px 14px 20px;border-radius:24px;box-shadow:0 8px 32px rgba(0,0,0,0.5);font-family:Inter,sans-serif;max-width:calc(100vw - 48px);animation:_clt-in 0.3s cubic-bezier(0.34,1.56,0.64,1);overflow:visible';
      toast.innerHTML = `
        <span class="clt-text" style="font-size:14px;flex:1;min-width:140px"><strong>Credits are running low!</strong> All credits used</span>
        <a href="/aitopia/marketplace/pricing.html" style="display:inline-flex;align-items:center;flex-shrink:0;padding:8px 18px;border-radius:24px;background:#9334EB;color:#fff;font-size:13px;font-weight:700;text-decoration:none;white-space:nowrap">Upgrade</a>
        <button class="clt-close" data-action="dismissCreditsToast" style="position:absolute;top:0;right:0;transform:translate(25%,-25%);width:24px;height:24px;border-radius:50%;border:none;cursor:pointer;font-size:13px;line-height:1;display:flex;align-items:center;justify-content:center" aria-label="Close">&times;</button>
      `;
      document.body.appendChild(toast);
    } catch (e) {}
  }

  async function loadCreditsBalance(options) {
    if (balancePromise && !options?.force) return balancePromise;

    // Clear cached credits before fetching fresh balance
    window.AitopiaCache?.remove?.(window.AitopiaCache?.KEYS?.USER_CREDITS);

    const fetchFn = typeof window !== 'undefined' && window.fetchHelper ? window.fetchHelper : fetch;
    balancePromise = fetchFn('https://aitopia.ai/api/credits/balance', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'include',
      signal: options?.signal,
    })
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json().catch(() => null);
      })
      .then((json) => {
        if (json) {
          updateGlobalCreditsDisplay(json);
        }
        return json;
      })
      .catch(() => null)
      .finally(() => {
        balancePromise = null;
      });
    return balancePromise;
  }

  window.AitopiaCredits = {
    ...existing,
    setBillingConfig,
    getBillingConfig,
    loadBillingConfig,
    creditsFromUsd,
    getCreditsInfoFromCost,
    getCreditsInfoForAgent,
    getCreditsLabelForAgent,
    getCreditsDisplayForModelChoice,
    loadCreditsBalance,
    // Dynamic pricing (form-data aware)
    getDynamicCreditsForModelChoice,
    getCreditsDisplayForModelChoiceDynamic,
    isPriceAffectingField,
  };
})();
