/* AIconomy — Video + Provenance Royalties (client-only)
 *
 * This page is a visual simulator for the “AITOPIA Provenance Economy”:
 * - AI-generated-only videos
 * - Free viewing (ads) + premium pool (ad-free)
 * - Generation run economics (compute bucket + fee bucket)
 * - Spend credits vs Earn credits separation (anti-arbitrage)
 * - 5-level ancestry (50% decay) for both content and tool lineage
 *
 * No backend calls; numbers are illustrative but net-based.
 */

function clampInt(value, { min = -Infinity, max = Infinity } = {}) {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function clampNumber(value, { min = -Infinity, max = Infinity } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function formatUsd(n) {
  const value = Number(n) || 0;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function formatCredits(n) {
  const value = Number(n) || 0;
  return new Intl.NumberFormat('en-US').format(Math.trunc(value));
}

function formatPct(pct) {
  const value = Number(pct) || 0;
  const abs = Math.abs(value);
  const text = abs >= 10 ? abs.toFixed(0) : abs.toFixed(1);
  const sign = value < 0 ? '-' : '';
  return `${sign}${text}%`;
}

function escapeHtml(text) {
  return String(text ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
}

function setHtml(id, html) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = html;
}

function allocateInteger(total, weights, { remainderTo = 0 } = {}) {
  const safeTotal = Math.max(0, Math.trunc(Number(total) || 0));
  const safeWeights = Array.isArray(weights) ? weights.map((w) => Math.max(0, Number(w) || 0)) : [];
  const sum = safeWeights.reduce((a, b) => a + b, 0);
  if (safeTotal === 0 || safeWeights.length === 0 || sum <= 0) return safeWeights.map(() => 0);

  const raw = safeWeights.map((w) => (safeTotal * w) / sum);
  const floored = raw.map((x) => Math.floor(x));
  const used = floored.reduce((a, b) => a + b, 0);
  let remaining = Math.max(0, safeTotal - used);

  const remainders = raw
    .map((x, i) => ({ i, r: x - floored[i] }))
    .sort((a, b) => b.r - a.r);

  const out = floored.slice();
  while (remaining > 0) {
    const next = remainders.shift();
    if (!next) break;
    out[next.i] += 1;
    remaining -= 1;
  }

  if (remaining > 0) {
    const idx = clampInt(remainderTo, { min: 0, max: out.length - 1 });
    out[idx] += remaining;
  }

  return out;
}

function normalizeSplit(split) {
  const content = Math.max(0, Number(split.content) || 0);
  const tool = Math.max(0, Number(split.tool) || 0);
  const growth = Math.max(0, Number(split.growth) || 0);
  const platform = Math.max(0, Number(split.platform) || 0);
  const sum = content + tool + growth + platform;
  if (sum <= 0) return { content: 0, tool: 0, growth: 0, platform: 0 };
  return { content: content / sum, tool: tool / sum, growth: growth / sum, platform: platform / sum };
}

function decayWeights(levels) {
  const n = Math.max(1, Math.trunc(levels));
  // L0..L4: 50%, 25%, 12.5%, 6.25%, 3.125% (then remainder → growth/platform)
  const base = [0.5, 0.25, 0.125, 0.0625, 0.03125].slice(0, n);
  return base.length ? base : [1];
}

function splitByAncestry(poolCredits, depth) {
  const safeDepth = clampInt(depth, { min: 0, max: 4 });
  const weights = decayWeights(5);
  const raw = allocateInteger(poolCredits, weights, { remainderTo: 0 });

  // Keep L0..Ldepth, roll the rest into L0 (missing ancestors).
  const out = raw.slice(0, 5);
  for (let i = safeDepth + 1; i < out.length; i += 1) {
    out[0] += out[i];
    out[i] = 0;
  }
  return out;
}

const CASHOUT_TIERS = [
  { holdDays: 0, rate: 0.50, label: 'Instant (50%)' },
  { holdDays: 7, rate: 0.65, label: '7 days (65%)' },
  { holdDays: 30, rate: 0.80, label: '30 days (80%)' },
  { holdDays: 60, rate: 0.90, label: '60 days (90%)' },
  { holdDays: 90, rate: 1.00, label: '90 days (100%)' },
];

const PRESETS = {
  balanced: {
    id: 'balanced',
    name: 'Balanced (recommended)',
    desc: 'Net split for views/premium: 50% content, 20% tool, 25% platform, 5% growth. Fee bucket: 60/10/5/25.',
    tags: ['recommended', 'net-based', 'viral-safe'],
    viewSplit: { content: 0.50, tool: 0.20, platform: 0.25, growth: 0.05 },
    feeSplit: { tool: 0.60, contentRemix: 0.10, platform: 0.25, growth: 0.05 },
    defaults: {
      ads: { views: 250000, eCPM: 3.5, adFeePct: 32, cdnPer1k: 0.15, reservePct: 5, domain: 'registered' },
      premium: { grossUsd: 100000, storeFeePct: 30, infraUsd: 5000, reservePct: 4, watchSharePct: 0.25 },
      generation: { computeCredits: 80, feeCredits: 20, hasRemix: true },
    },
  },
  platform_safe: {
    id: 'platform_safe',
    name: 'Platform-safe',
    desc: 'Net split: 45% content, 20% tool, 30% platform, 5% growth. Higher platform margin for ops + fraud.',
    tags: ['safer margin'],
    viewSplit: { content: 0.45, tool: 0.20, platform: 0.30, growth: 0.05 },
    feeSplit: { tool: 0.55, contentRemix: 0.10, platform: 0.30, growth: 0.05 },
    defaults: {
      ads: { views: 250000, eCPM: 3.0, adFeePct: 32, cdnPer1k: 0.15, reservePct: 6, domain: 'registered' },
      premium: { grossUsd: 100000, storeFeePct: 30, infraUsd: 6000, reservePct: 5, watchSharePct: 0.25 },
      generation: { computeCredits: 80, feeCredits: 25, hasRemix: true },
    },
  },
  creator_first: {
    id: 'creator_first',
    name: 'Creator-first',
    desc: 'Net split: 55% content, 25% tool, 15% platform, 5% growth. Strong incentives, higher risk if costs rise.',
    tags: ['aggressive', 'high creator pay'],
    viewSplit: { content: 0.55, tool: 0.25, platform: 0.15, growth: 0.05 },
    feeSplit: { tool: 0.65, contentRemix: 0.10, platform: 0.20, growth: 0.05 },
    defaults: {
      ads: { views: 250000, eCPM: 4.0, adFeePct: 32, cdnPer1k: 0.15, reservePct: 5, domain: 'registered' },
      premium: { grossUsd: 100000, storeFeePct: 30, infraUsd: 5000, reservePct: 4, watchSharePct: 0.25 },
      generation: { computeCredits: 80, feeCredits: 30, hasRemix: true },
    },
  },
};

function computeAds(state) {
  const usdPerCredit = clampNumber(state.usdPerCredit, { min: 0.001, max: 10 });
  const views = clampInt(state.ads.views, { min: 0, max: 1_000_000_000 });
  const eCPM = clampNumber(state.ads.eCPM, { min: 0, max: 1000 });
  const adFeePct = clampNumber(state.ads.adFeePct, { min: 0, max: 95 }) / 100;
  const cdnPer1k = clampNumber(state.ads.cdnPer1k, { min: 0, max: 100 }) ;
  const reservePct = clampNumber(state.ads.reservePct, { min: 0, max: 50 }) / 100;
  const domain = state.ads.domain === 'unknown' ? 'unknown' : 'registered';

  const grossUsd = (views / 1000) * eCPM;
  const adNetworkFeeUsd = grossUsd * adFeePct;
  const afterNetworkUsd = Math.max(0, grossUsd - adNetworkFeeUsd);
  const cdnCostUsd = (views / 1000) * cdnPer1k;
  const reserveUsd = afterNetworkUsd * reservePct;
  const netUsd = Math.max(0, afterNetworkUsd - cdnCostUsd - reserveUsd);

  const netCredits = Math.max(0, Math.trunc(Math.floor(netUsd / usdPerCredit)));
  const split = normalizeSplit(state.viewSplit);

  let [contentCredits, toolCredits, growthCredits, platformCredits] = allocateInteger(
    netCredits,
    [split.content, split.tool, split.growth, split.platform],
    { remainderTo: 3 }
  );

  const payoutEligible = domain === 'registered';
  if (!payoutEligible && netCredits > 0) {
    // Open embed works, but earnings are blocked until domain is registered.
    platformCredits = netCredits;
    contentCredits = 0;
    toolCredits = 0;
    growthCredits = 0;
  }

  const contentLevels = splitByAncestry(contentCredits, state.ads.contentDepth);
  const toolLevels = splitByAncestry(toolCredits, state.ads.toolDepth);

  return {
    mode: 'ads',
    payoutEligible,
    usdPerCredit,
    grossUsd,
    adNetworkFeeUsd,
    cdnCostUsd,
    reserveUsd,
    netUsd,
    netCredits,
    buckets: { contentCredits, toolCredits, growthCredits, platformCredits },
    contentLevels,
    toolLevels,
    notes: {
      calc: `Gross ${formatUsd(grossUsd)} − network fee ${formatUsd(adNetworkFeeUsd)} − CDN ${formatUsd(cdnCostUsd)} − reserve ${formatUsd(reserveUsd)} = Net ${formatUsd(netUsd)} → ${formatCredits(netCredits)} earn credits`,
      warning: payoutEligible ? 'Registered domain: payouts enabled.' : 'Unknown domain: payouts disabled (embed still plays).',
    },
  };
}

function computePremium(state) {
  const usdPerCredit = clampNumber(state.usdPerCredit, { min: 0.001, max: 10 });
  const grossUsd = clampNumber(state.premium.grossUsd, { min: 0, max: 1_000_000_000 });
  const storeFeePct = clampNumber(state.premium.storeFeePct, { min: 0, max: 95 }) / 100;
  const infraUsd = clampNumber(state.premium.infraUsd, { min: 0, max: 1_000_000_000 });
  const reservePct = clampNumber(state.premium.reservePct, { min: 0, max: 50 }) / 100;
  const watchSharePct = clampNumber(state.premium.watchSharePct, { min: 0, max: 100 }) / 100;

  const storeFeeUsd = grossUsd * storeFeePct;
  const afterStoreUsd = Math.max(0, grossUsd - storeFeeUsd);
  const reserveUsd = afterStoreUsd * reservePct;
  const netUsd = Math.max(0, afterStoreUsd - infraUsd - reserveUsd);

  const split = normalizeSplit(state.viewSplit);
  const contentUsd = netUsd * split.content * watchSharePct;
  const toolUsd = netUsd * split.tool * watchSharePct;
  const growthUsd = netUsd * split.growth;
  const platformUsd = netUsd * split.platform;

  const contentCredits = Math.max(0, Math.trunc(Math.floor(contentUsd / usdPerCredit)));
  const toolCredits = Math.max(0, Math.trunc(Math.floor(toolUsd / usdPerCredit)));
  const growthCredits = Math.max(0, Math.trunc(Math.floor(growthUsd / usdPerCredit)));
  const platformCredits = Math.max(0, Math.trunc(Math.floor(platformUsd / usdPerCredit)));

  const netCreditsThisVideo = contentCredits + toolCredits;

  const contentLevels = splitByAncestry(contentCredits, state.premium.contentDepth);
  const toolLevels = splitByAncestry(toolCredits, state.premium.toolDepth);

  return {
    mode: 'premium',
    payoutEligible: true,
    usdPerCredit,
    grossUsd,
    storeFeeUsd,
    infraUsd,
    reserveUsd,
    netUsd,
    watchSharePct,
    netCredits: netCreditsThisVideo,
    buckets: { contentCredits, toolCredits, growthCredits, platformCredits },
    contentLevels,
    toolLevels,
    notes: {
      calc: `Gross ${formatUsd(grossUsd)} − store fee ${formatUsd(storeFeeUsd)} − infra ${formatUsd(infraUsd)} − reserve ${formatUsd(reserveUsd)} = Net ${formatUsd(netUsd)}; this video share ${formatPct(watchSharePct * 100)} → ${formatCredits(netCreditsThisVideo)} earn credits`,
      warning: 'Premium pool: payouts are proportional to qualified watch time share.',
    },
  };
}

function computeGeneration(state) {
  const usdPerCredit = clampNumber(state.usdPerCredit, { min: 0.001, max: 10 });
  const computeCredits = clampInt(state.generation.computeCredits, { min: 0, max: 1_000_000_000 });
  const feeCredits = clampInt(state.generation.feeCredits, { min: 0, max: 1_000_000_000 });
  const hasRemix = Boolean(state.generation.hasRemix);

  const splitFee = {
    tool: Math.max(0, Number(state.feeSplit.tool) || 0),
    contentRemix: Math.max(0, Number(state.feeSplit.contentRemix) || 0),
    growth: Math.max(0, Number(state.feeSplit.growth) || 0),
    platform: Math.max(0, Number(state.feeSplit.platform) || 0),
  };

  // If no remix source, roll the content remix share into tool (default).
  const effective = hasRemix ? splitFee : { ...splitFee, tool: splitFee.tool + splitFee.contentRemix, contentRemix: 0 };
  const normalized = normalizeSplit({
    content: effective.contentRemix,
    tool: effective.tool,
    growth: effective.growth,
    platform: effective.platform,
  });

  const [contentCredits, toolCredits, growthCredits, platformCredits] = allocateInteger(
    feeCredits,
    [normalized.content, normalized.tool, normalized.growth, normalized.platform],
    { remainderTo: 1 }
  );

  const contentLevels = splitByAncestry(contentCredits, state.generation.contentDepth);
  const toolLevels = splitByAncestry(toolCredits, state.generation.toolDepth);

  const earnCreditsToCreators = contentCredits + toolCredits;
  const totalSpend = computeCredits + feeCredits;

  return {
    mode: 'generation',
    payoutEligible: true,
    usdPerCredit,
    computeCredits,
    feeCredits,
    totalSpend,
    netCredits: earnCreditsToCreators,
    buckets: { contentCredits, toolCredits, growthCredits, platformCredits },
    contentLevels,
    toolLevels,
    notes: {
      calc: `User pays ${formatCredits(totalSpend)} spend credits = compute ${formatCredits(computeCredits)} + fee ${formatCredits(feeCredits)}; earn credits credited to creators: ${formatCredits(earnCreditsToCreators)}`,
      warning: hasRemix
        ? 'Generation with content remix: fee bucket funds both tool royalties and source-content royalties.'
        : 'No content remix: content share rolls into tool pool (default).',
    },
  };
}

function computeResult(state) {
  if (state.mode === 'premium') return computePremium(state);
  if (state.mode === 'generation') return computeGeneration(state);
  return computeAds(state);
}

function buildModeControls(mode, state) {
  if (mode === 'premium') {
    return `
      <div class="controls">
        <div class="control">
          <label for="premiumGrossUsd">Subscription gross (monthly)</label>
          <input id="premiumGrossUsd" type="number" step="1" value="${escapeHtml(state.premium.grossUsd)}" />
          <small>Before app-store fees & infra</small>
        </div>
        <div class="control">
          <label for="premiumStoreFeePct">App store fee %</label>
          <input id="premiumStoreFeePct" type="number" step="1" value="${escapeHtml(state.premium.storeFeePct)}" />
          <small>Typical iOS: 30% (or 15%)</small>
        </div>
        <div class="control">
          <label for="premiumInfraUsd">Infra cost (monthly)</label>
          <input id="premiumInfraUsd" type="number" step="1" value="${escapeHtml(state.premium.infraUsd)}" />
          <small>Streaming + storage + ops</small>
        </div>
        <div class="control">
          <label for="premiumReservePct">Fraud reserve %</label>
          <input id="premiumReservePct" type="number" step="0.5" value="${escapeHtml(state.premium.reservePct)}" />
          <small>Held for clawbacks</small>
        </div>
        <div class="control">
          <label for="premiumWatchSharePct">This video watch share %</label>
          <input id="premiumWatchSharePct" type="number" step="0.01" value="${escapeHtml(state.premium.watchSharePct)}" />
          <small>Qualified watch time share</small>
        </div>
        <div class="control">
          <label for="premiumContentDepth">Content ancestry depth</label>
          <select id="premiumContentDepth">
            ${[0, 1, 2, 3, 4].map((d) => `<option value="${d}"${d === state.premium.contentDepth ? ' selected' : ''}>${d}</option>`).join('')}
          </select>
          <small>0 = only publisher</small>
        </div>
        <div class="control">
          <label for="premiumToolDepth">Tool ancestry depth</label>
          <select id="premiumToolDepth">
            ${[0, 1, 2, 3, 4].map((d) => `<option value="${d}"${d === state.premium.toolDepth ? ' selected' : ''}>${d}</option>`).join('')}
          </select>
          <small>0 = only direct tool</small>
        </div>
      </div>
    `;
  }

  if (mode === 'generation') {
    return `
      <div class="controls">
        <div class="control">
          <label for="genComputeCredits">Compute credits (Spend)</label>
          <input id="genComputeCredits" type="number" step="1" value="${escapeHtml(state.generation.computeCredits)}" />
          <small>COGS bucket (not split)</small>
        </div>
        <div class="control">
          <label for="genFeeCredits">Fee credits (Spend)</label>
          <input id="genFeeCredits" type="number" step="1" value="${escapeHtml(state.generation.feeCredits)}" />
          <small>Service fee bucket (split)</small>
        </div>
        <div class="control">
          <label for="genHasRemix">Uses a published video as input?</label>
          <select id="genHasRemix">
            <option value="yes"${state.generation.hasRemix ? ' selected' : ''}>Yes (content remix)</option>
            <option value="no"${!state.generation.hasRemix ? ' selected' : ''}>No</option>
          </select>
          <small>Content remix pool only applies if yes</small>
        </div>
        <div class="control">
          <label for="genToolDepth">Tool ancestry depth</label>
          <select id="genToolDepth">
            ${[0, 1, 2, 3, 4].map((d) => `<option value="${d}"${d === state.generation.toolDepth ? ' selected' : ''}>${d}</option>`).join('')}
          </select>
          <small>5-level max, 50% decay</small>
        </div>
        <div class="control">
          <label for="genContentDepth">Content ancestry depth</label>
          <select id="genContentDepth">
            ${[0, 1, 2, 3, 4].map((d) => `<option value="${d}"${d === state.generation.contentDepth ? ' selected' : ''}>${d}</option>`).join('')}
          </select>
          <small>0 = only source publisher</small>
        </div>
      </div>
    `;
  }

  // Ads mode
  return `
    <div class="controls">
      <div class="control">
        <label for="adsViews">Views</label>
        <input id="adsViews" type="number" step="1" value="${escapeHtml(state.ads.views)}" />
        <small>Qualified views (after validation)</small>
      </div>
      <div class="control">
        <label for="adsEcpm">eCPM (USD / 1k views)</label>
        <input id="adsEcpm" type="number" step="0.1" value="${escapeHtml(state.ads.eCPM)}" />
        <small>Gross before ad-network fee</small>
      </div>
      <div class="control">
        <label for="adsAdFeePct">Ad network fee %</label>
        <input id="adsAdFeePct" type="number" step="1" value="${escapeHtml(state.ads.adFeePct)}" />
        <small>Network takes a cut</small>
      </div>
      <div class="control">
        <label for="adsCdnPer1k">CDN cost (USD / 1k views)</label>
        <input id="adsCdnPer1k" type="number" step="0.01" value="${escapeHtml(state.ads.cdnPer1k)}" />
        <small>Streaming egress estimate</small>
      </div>
      <div class="control">
        <label for="adsReservePct">Fraud reserve %</label>
        <input id="adsReservePct" type="number" step="0.5" value="${escapeHtml(state.ads.reservePct)}" />
        <small>Held for clawbacks</small>
      </div>
      <div class="control">
        <label for="adsDomain">Embed domain status</label>
        <select id="adsDomain">
          <option value="registered"${state.ads.domain === 'registered' ? ' selected' : ''}>Registered / verified</option>
          <option value="unknown"${state.ads.domain === 'unknown' ? ' selected' : ''}>Unknown (no payouts)</option>
        </select>
        <small>Open embed allowed either way</small>
      </div>
      <div class="control">
        <label for="adsContentDepth">Content ancestry depth</label>
        <select id="adsContentDepth">
          ${[0, 1, 2, 3, 4].map((d) => `<option value="${d}"${d === state.ads.contentDepth ? ' selected' : ''}>${d}</option>`).join('')}
        </select>
        <small>0 = only publisher</small>
      </div>
      <div class="control">
        <label for="adsToolDepth">Tool ancestry depth</label>
        <select id="adsToolDepth">
          ${[0, 1, 2, 3, 4].map((d) => `<option value="${d}"${d === state.ads.toolDepth ? ' selected' : ''}>${d}</option>`).join('')}
        </select>
        <small>0 = only direct tool</small>
      </div>
    </div>
  `;
}

function ensureChartJs() {
  return typeof window.Chart === 'function';
}

function initCharts() {
  if (!ensureChartJs()) return { split: null, levels: null };
  const splitCtx = document.getElementById('chartSplit')?.getContext?.('2d');
  const levelsCtx = document.getElementById('chartLevels')?.getContext?.('2d');
  if (!splitCtx || !levelsCtx) return { split: null, levels: null };

  const colors = {
    content: '#7c3aed',
    tool: '#0ea5e9',
    growth: '#d1d5db',
    platform: '#9ca3af',
  };

  const split = new window.Chart(splitCtx, {
    type: 'bar',
    data: {
      labels: ['Net'],
      datasets: [
        { label: 'Content', data: [0], backgroundColor: colors.content, borderWidth: 0, stack: 'stack' },
        { label: 'Tool', data: [0], backgroundColor: colors.tool, borderWidth: 0, stack: 'stack' },
        { label: 'Growth', data: [0], backgroundColor: colors.growth, borderWidth: 0, stack: 'stack' },
        { label: 'Platform', data: [0], backgroundColor: colors.platform, borderWidth: 0, stack: 'stack' },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, boxHeight: 12 } },
        tooltip: {
          callbacks: {
            label(context) {
              const v = Number(context.raw) || 0;
              return `${context.dataset.label}: ${formatCredits(v)} credits`;
            },
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          grid: { color: 'rgba(0,0,0,0.04)' },
          ticks: { callback: (value) => formatCredits(value) },
        },
        y: { stacked: true, grid: { display: false } },
      },
    },
  });

  const levels = new window.Chart(levelsCtx, {
    type: 'bar',
    data: {
      labels: ['L0', 'L1', 'L2', 'L3', 'L4'],
      datasets: [
        { label: 'Content', data: [0, 0, 0, 0, 0], backgroundColor: colors.content, borderWidth: 0 },
        { label: 'Tool', data: [0, 0, 0, 0, 0], backgroundColor: colors.tool, borderWidth: 0 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, boxHeight: 12 } },
        tooltip: {
          callbacks: {
            label(context) {
              const v = Number(context.raw) || 0;
              return `${formatCredits(v)} credits`;
            },
          },
        },
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          grid: { color: 'rgba(0,0,0,0.04)' },
          ticks: { callback: (value) => formatCredits(value) },
        },
      },
    },
  });

  return { split, levels };
}

function updateCharts(charts, result) {
  if (charts.split) {
    const ds = charts.split.data.datasets;
    ds[0].data[0] = result.buckets.contentCredits;
    ds[1].data[0] = result.buckets.toolCredits;
    ds[2].data[0] = result.buckets.growthCredits;
    ds[3].data[0] = result.buckets.platformCredits;
    charts.split.update();
  }

  if (charts.levels) {
    charts.levels.data.datasets[0].data = result.contentLevels.slice(0, 5);
    charts.levels.data.datasets[1].data = result.toolLevels.slice(0, 5);
    charts.levels.update();
  }
}

function buildScenarioCards(container, { onSelect }) {
  container.innerHTML = '';
  Object.values(PRESETS).forEach((p) => {
    const div = document.createElement('div');
    div.className = 'scenario';
    div.innerHTML = `
      <div class="scenario-title">${escapeHtml(p.name)}</div>
      <div class="scenario-desc">${escapeHtml(p.desc)}</div>
      <div class="scenario-tags">
        ${p.tags.map((t) => `<span class="tag${t === 'recommended' ? ' purple' : ''}">${escapeHtml(t)}</span>`).join('')}
      </div>
    `;
    div.addEventListener('click', () => onSelect(p.id));
    container.appendChild(div);
  });
}

function payoutRowsHtml(result) {
  const rows = [];

  const contentNames = ['Publisher', 'Content parent', 'Content grandparent', 'Content g-grandparent', 'Content root'];
  const toolNames = ['Tool creator (L0)', 'Tool parent', 'Tool grandparent', 'Tool g-grandparent', 'Tool root'];

  for (let i = 0; i < 5; i += 1) {
    const c = result.contentLevels[i] || 0;
    if (c > 0) {
      rows.push({
        pool: 'Content',
        level: `L${i}`,
        recipient: contentNames[i] || `Content L${i}`,
        credits: c,
      });
    }
  }
  for (let i = 0; i < 5; i += 1) {
    const t = result.toolLevels[i] || 0;
    if (t > 0) {
      rows.push({
        pool: 'Tool',
        level: `L${i}`,
        recipient: toolNames[i] || `Tool L${i}`,
        credits: t,
      });
    }
  }

  if (result.buckets.growthCredits > 0) {
    rows.push({ pool: 'Growth', level: '—', recipient: 'Boosts / bounties / moderation', credits: result.buckets.growthCredits });
  }
  if (result.buckets.platformCredits > 0) {
    rows.push({ pool: 'Platform', level: '—', recipient: 'AITOPIA ops + profit', credits: result.buckets.platformCredits });
  }

  if (rows.length === 0) {
    return `<tr><td colspan="4" class="td-muted">No payouts for this configuration.</td></tr>`;
  }

  return rows.map((r) => {
    const isContent = r.pool === 'Content';
    const pillClass = r.level === 'L0' ? 'l0' : r.level === 'L1' ? 'l1' : 'l2';
    return `
      <tr>
        <td class="${isContent ? 'td-purple' : ''}">${escapeHtml(r.pool)}</td>
        <td><span class="level-pill ${pillClass}">${escapeHtml(r.level)}</span></td>
        <td class="td-muted">${escapeHtml(r.recipient)}</td>
        <td>${formatCredits(r.credits)}</td>
      </tr>
    `;
  }).join('');
}

function main() {
  const usdPerCreditInput = document.getElementById('usdPerCredit');
  const cashoutTierSelect = document.getElementById('cashoutTier');
  const presetSelect = document.getElementById('preset');
  const modeControls = document.getElementById('modeControls');
  const modeBadge = document.getElementById('modeBadge');

  if (!usdPerCreditInput || !cashoutTierSelect || !presetSelect || !modeControls || !modeBadge) return;

  const state = {
    mode: 'ads',
    usdPerCredit: 0.02,
    cashoutHoldDays: 30,
    viewSplit: PRESETS.balanced.viewSplit,
    feeSplit: PRESETS.balanced.feeSplit,
    ads: { views: 250000, eCPM: 3.5, adFeePct: 32, cdnPer1k: 0.15, reservePct: 5, domain: 'registered', contentDepth: 3, toolDepth: 3 },
    premium: { grossUsd: 100000, storeFeePct: 30, infraUsd: 5000, reservePct: 4, watchSharePct: 0.25, contentDepth: 3, toolDepth: 3 },
    generation: { computeCredits: 80, feeCredits: 20, hasRemix: true, contentDepth: 3, toolDepth: 3 },
  };

  // Populate selects
  cashoutTierSelect.innerHTML = CASHOUT_TIERS
    .map((t) => `<option value="${t.holdDays}"${t.holdDays === state.cashoutHoldDays ? ' selected' : ''}>${escapeHtml(t.label)}</option>`)
    .join('');

  presetSelect.innerHTML = Object.values(PRESETS)
    .map((p) => `<option value="${escapeHtml(p.id)}"${p.id === 'balanced' ? ' selected' : ''}>${escapeHtml(p.name)}</option>`)
    .join('');

  const scenarioCards = document.getElementById('scenarioCards');
  if (scenarioCards) {
    buildScenarioCards(scenarioCards, {
      onSelect: (id) => {
        presetSelect.value = id;
        applyPreset(id);
        rerender();
      },
    });
  }

  // Charts
  const charts = initCharts();

  function setMode(nextMode) {
    state.mode = nextMode;
    document.querySelectorAll('button.tab[data-mode]').forEach((btn) => {
      const isSelected = btn.getAttribute('data-mode') === nextMode;
      btn.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    });
    modeControls.innerHTML = buildModeControls(nextMode, state);
    rerender();
  }

  function applyPreset(presetId) {
    const preset = PRESETS[presetId] ?? PRESETS.balanced;
    state.viewSplit = preset.viewSplit;
    state.feeSplit = preset.feeSplit;

    const d = preset.defaults;
    state.ads = { ...state.ads, ...d.ads };
    state.premium = { ...state.premium, ...d.premium };
    state.generation = { ...state.generation, ...d.generation };
  }

  function readCommonInputs() {
    state.usdPerCredit = clampNumber(usdPerCreditInput.value, { min: 0.001, max: 10 });
    state.cashoutHoldDays = clampInt(cashoutTierSelect.value, { min: 0, max: 365 });
  }

  function readModeInputs() {
    if (state.mode === 'premium') {
      state.premium.grossUsd = clampNumber(document.getElementById('premiumGrossUsd')?.value, { min: 0, max: 1_000_000_000 });
      state.premium.storeFeePct = clampNumber(document.getElementById('premiumStoreFeePct')?.value, { min: 0, max: 95 });
      state.premium.infraUsd = clampNumber(document.getElementById('premiumInfraUsd')?.value, { min: 0, max: 1_000_000_000 });
      state.premium.reservePct = clampNumber(document.getElementById('premiumReservePct')?.value, { min: 0, max: 50 });
      state.premium.watchSharePct = clampNumber(document.getElementById('premiumWatchSharePct')?.value, { min: 0, max: 100 });
      state.premium.contentDepth = clampInt(document.getElementById('premiumContentDepth')?.value, { min: 0, max: 4 });
      state.premium.toolDepth = clampInt(document.getElementById('premiumToolDepth')?.value, { min: 0, max: 4 });
      return;
    }

    if (state.mode === 'generation') {
      state.generation.computeCredits = clampInt(document.getElementById('genComputeCredits')?.value, { min: 0, max: 1_000_000_000 });
      state.generation.feeCredits = clampInt(document.getElementById('genFeeCredits')?.value, { min: 0, max: 1_000_000_000 });
      state.generation.hasRemix = (document.getElementById('genHasRemix')?.value || 'yes') === 'yes';
      state.generation.toolDepth = clampInt(document.getElementById('genToolDepth')?.value, { min: 0, max: 4 });
      state.generation.contentDepth = clampInt(document.getElementById('genContentDepth')?.value, { min: 0, max: 4 });
      return;
    }

    // ads
    state.ads.views = clampInt(document.getElementById('adsViews')?.value, { min: 0, max: 1_000_000_000 });
    state.ads.eCPM = clampNumber(document.getElementById('adsEcpm')?.value, { min: 0, max: 1000 });
    state.ads.adFeePct = clampNumber(document.getElementById('adsAdFeePct')?.value, { min: 0, max: 95 });
    state.ads.cdnPer1k = clampNumber(document.getElementById('adsCdnPer1k')?.value, { min: 0, max: 100 });
    state.ads.reservePct = clampNumber(document.getElementById('adsReservePct')?.value, { min: 0, max: 50 });
    state.ads.domain = (document.getElementById('adsDomain')?.value || 'registered') === 'unknown' ? 'unknown' : 'registered';
    state.ads.contentDepth = clampInt(document.getElementById('adsContentDepth')?.value, { min: 0, max: 4 });
    state.ads.toolDepth = clampInt(document.getElementById('adsToolDepth')?.value, { min: 0, max: 4 });
  }

  function cashoutValueUsd(earnCredits) {
    const tier = CASHOUT_TIERS.find((t) => t.holdDays === state.cashoutHoldDays) ?? CASHOUT_TIERS[2];
    const grossUsd = (Number(earnCredits) || 0) * state.usdPerCredit;
    return { tier, grossUsd, cashUsd: grossUsd * tier.rate };
  }

  function rerender() {
    readCommonInputs();
    readModeInputs();

    const result = computeResult(state);
    const cash = cashoutValueUsd(result.netCredits);

    // Header badge
    const modeName = result.mode === 'ads' ? 'Views (Ads)' : result.mode === 'premium' ? 'Premium Pool' : 'Generation Run';
    modeBadge.textContent = modeName;

    // KPIs
    setText('kpiNetCredits', `${formatCredits(result.netCredits)} credits`);
    setText('kpiNetUsd', formatUsd(result.netCredits * result.usdPerCredit));
    setText('kpiContentCredits', `${formatCredits(result.buckets.contentCredits)} credits`);
    setText('kpiContentUsd', formatUsd(result.buckets.contentCredits * result.usdPerCredit));
    setText('kpiToolCredits', `${formatCredits(result.buckets.toolCredits)} credits`);
    setText('kpiToolUsd', formatUsd(result.buckets.toolCredits * result.usdPerCredit));
    setText('kpiCashUsd', formatUsd(cash.cashUsd));
    setText('kpiCashNote', `${cash.tier.label} • gross ${formatUsd(cash.grossUsd)}`);

    setText('kpiCallout', result.mode === 'generation'
      ? `Generation uses Spend credits. Creator earnings are credited as Earn credits (cashable with holds). ${result.notes.warning}`
      : `Earn credits are minted from net value. ${result.notes.warning}`
    );

    // Net calc line + waterfall note
    setText('netCalcLine', result.notes.calc);
    setText('waterfallNote', result.mode === 'ads'
      ? 'Open embeds can play anywhere, but payouts are only enabled for registered/verified domains.'
      : result.mode === 'premium'
        ? 'Premium pool allocation is proportional to qualified watch time share (not raw views).'
        : 'Compute bucket covers COGS; fee bucket funds royalties, growth, and platform ops.'
    );

    // Waterfall segments (flex-grow proportional)
    const total = Math.max(1, result.buckets.contentCredits + result.buckets.toolCredits + result.buckets.growthCredits + result.buckets.platformCredits);
    const pct = (v) => (total > 0 ? (v / total) * 100 : 0);

    setText('segContentPct', formatPct(pct(result.buckets.contentCredits)));
    setText('segContentVal', `${formatCredits(result.buckets.contentCredits)} credits`);
    setText('segToolPct', formatPct(pct(result.buckets.toolCredits)));
    setText('segToolVal', `${formatCredits(result.buckets.toolCredits)} credits`);
    setText('segGrowthPct', formatPct(pct(result.buckets.growthCredits)));
    setText('segGrowthVal', `${formatCredits(result.buckets.growthCredits)} credits`);
    setText('segPlatformPct', formatPct(pct(result.buckets.platformCredits)));
    setText('segPlatformVal', `${formatCredits(result.buckets.platformCredits)} credits`);

    const segContent = document.getElementById('segContent');
    const segTool = document.getElementById('segTool');
    const segGrowth = document.getElementById('segGrowth');
    const segPlatform = document.getElementById('segPlatform');
    if (segContent) segContent.style.flexGrow = String(Math.max(1, result.buckets.contentCredits));
    if (segTool) segTool.style.flexGrow = String(Math.max(1, result.buckets.toolCredits));
    if (segGrowth) segGrowth.style.flexGrow = String(Math.max(1, result.buckets.growthCredits));
    if (segPlatform) segPlatform.style.flexGrow = String(Math.max(1, result.buckets.platformCredits));

    // Payout table
    setHtml('payoutRows', payoutRowsHtml(result));
    setText(
      'payoutNote',
      result.payoutEligible
        ? '5-level decay applies per pool. Missing ancestors roll into L0 (direct).'
        : 'This configuration is ineligible for payouts (e.g., unknown embed domain).'
    );

    setText('chartSplitCaption', `net buckets total: ${formatCredits(total)} credits`);
    updateCharts(charts, result);
  }

  // Event handlers (mode tabs)
  document.querySelectorAll('button.tab[data-mode]').forEach((btn) => {
    btn.addEventListener('click', () => setMode(btn.getAttribute('data-mode') || 'ads'));
  });

  // Global controls
  usdPerCreditInput.addEventListener('input', rerender);
  cashoutTierSelect.addEventListener('change', rerender);
  presetSelect.addEventListener('change', () => {
    applyPreset(presetSelect.value);
    modeControls.innerHTML = buildModeControls(state.mode, state);
    rerender();
  });

  // Delegate mode controls input events
  modeControls.addEventListener('input', rerender);
  modeControls.addEventListener('change', rerender);

  // Initial render
  modeControls.innerHTML = buildModeControls('ads', state);
  rerender();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}

