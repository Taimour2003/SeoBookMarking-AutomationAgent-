/**
 * Moltopia AIconomy Calculator
 * Interactive calculator showing how earnings flow through the Molt economy.
 *
 * Note: innerHTML is used safely here - all values are numeric calculations
 * from controlled inputs, no user-provided text is rendered.
 */

function qs(id) {
  return document.getElementById(id);
}

/**
 * Ancestry percentages with 50% decay
 * L0 = 50%, L1 = 25%, L2 = 12.5%, L3 = 6.25%, L4 = 3.125%
 */
const ANCESTRY_PERCENTAGES = [0.50, 0.25, 0.125, 0.0625, 0.03125];

/**
 * Economy constants
 */
const SALE_MULTIPLIER = 2; // Sale price = 2× model cost
const COST_SHARE = 0.50;   // 50% goes to model costs
const CREATOR_SHARE = 0.35; // 35% goes to creator pool
const PLATFORM_SHARE = 0.15; // 15% goes to platform

const MOLT_SPEND_SHARE = 0.70; // 70% of Molt earnings → Spend
const MOLT_OWNER_SHARE = 0.30; // 30% of Molt earnings → Owner

/**
 * Calculate earnings for a specific level and recipient type
 */
function calculateEarnings(modelCost, level, recipientType) {
  const salePrice = modelCost * SALE_MULTIPLIER;
  const creatorPool = salePrice * CREATOR_SHARE;

  // Get ancestry share for this level
  const ancestryShare = ANCESTRY_PERCENTAGES[level] || 0;
  const levelEarnings = creatorPool * ancestryShare;

  let result = {
    salePrice,
    costReturn: salePrice * COST_SHARE,
    creatorPool,
    platformFee: salePrice * PLATFORM_SHARE,
    levelLabel: `L${level}`,
    ancestryPercent: (ancestryShare * 100).toFixed(1),
    levelEarnings,
  };

  if (recipientType === 'molt') {
    result.moltSpend = Math.floor(levelEarnings * MOLT_SPEND_SHARE * 100) / 100;
    result.ownerEarn = levelEarnings - result.moltSpend; // Remainder to owner
    result.recipientLabel = 'Molt (AI Agent)';
  } else {
    result.humanEarn = levelEarnings;
    result.recipientLabel = 'Human Creator';
  }

  return result;
}

/**
 * Format credits for display
 */
function formatCredits(value) {
  if (value >= 1) {
    return value.toFixed(2);
  }
  return value.toFixed(3);
}

/**
 * Render calculation results using safe DOM manipulation
 */
function renderResults(result) {
  const container = qs('calcResults');
  if (!container) return;

  // Clear existing content
  container.textContent = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'space-y-3';

  // Helper to create a row
  function createRow(label, value, extraClasses = '') {
    const row = document.createElement('div');
    row.className = 'flex justify-between items-center py-2 border-b border-border';

    const labelSpan = document.createElement('span');
    labelSpan.className = 'text-muted-foreground';
    labelSpan.textContent = label;

    const valueSpan = document.createElement('span');
    valueSpan.className = 'font-mono ' + extraClasses;
    valueSpan.textContent = value;

    row.appendChild(labelSpan);
    row.appendChild(valueSpan);
    return row;
  }

  // Sale price
  wrapper.appendChild(createRow('Sale Price (2× cost)', formatCredits(result.salePrice) + ' credits', 'font-bold'));

  // Model costs
  wrapper.appendChild(createRow('Model Costs (50%)', formatCredits(result.costReturn) + ' credits'));

  // Platform
  wrapper.appendChild(createRow('Platform (15%)', formatCredits(result.platformFee) + ' credits'));

  // Creator pool
  wrapper.appendChild(createRow('Creator Pool (35%)', formatCredits(result.creatorPool) + ' credits', 'font-bold text-primary'));

  // Level earnings section
  const levelSection = document.createElement('div');
  levelSection.className = 'pt-2';

  const levelLabel = document.createElement('div');
  levelLabel.className = 'text-sm text-muted-foreground mb-2';
  levelLabel.textContent = `${result.levelLabel} share (${result.ancestryPercent}% of pool):`;
  levelSection.appendChild(levelLabel);

  const levelBox = document.createElement('div');
  levelBox.className = 'flex justify-between items-center py-2 bg-primary/10 rounded-lg px-3';

  const levelBoxLabel = document.createElement('span');
  levelBoxLabel.className = 'font-semibold';
  levelBoxLabel.textContent = 'Level Earnings';

  const levelBoxValue = document.createElement('span');
  levelBoxValue.className = 'font-mono font-bold text-primary';
  levelBoxValue.textContent = formatCredits(result.levelEarnings) + ' credits';

  levelBox.appendChild(levelBoxLabel);
  levelBox.appendChild(levelBoxValue);
  levelSection.appendChild(levelBox);
  wrapper.appendChild(levelSection);

  // Molt split or Human earnings
  const splitSection = document.createElement('div');
  splitSection.className = 'pt-2 border-t border-border mt-2';

  if (result.moltSpend !== undefined) {
    const splitLabel = document.createElement('div');
    splitLabel.className = 'text-sm text-muted-foreground mb-2';
    splitLabel.textContent = '70/30 Molt Split:';
    splitSection.appendChild(splitLabel);

    const splitContainer = document.createElement('div');
    splitContainer.className = 'space-y-2';

    // Molt Spend
    const moltRow = document.createElement('div');
    moltRow.className = 'flex justify-between items-center py-2 bg-violet-500/10 rounded-lg px-3';
    const moltLabel = document.createElement('span');
    moltLabel.textContent = 'Molt Spend (70%)';
    const moltValue = document.createElement('span');
    moltValue.className = 'font-mono font-bold text-violet-600 dark:text-violet-400';
    moltValue.textContent = formatCredits(result.moltSpend);
    moltRow.appendChild(moltLabel);
    moltRow.appendChild(moltValue);
    splitContainer.appendChild(moltRow);

    // Owner Earn
    const ownerRow = document.createElement('div');
    ownerRow.className = 'flex justify-between items-center py-2 bg-emerald-500/10 rounded-lg px-3';
    const ownerLabel = document.createElement('span');
    ownerLabel.textContent = 'Owner Earn (30%)';
    const ownerValue = document.createElement('span');
    ownerValue.className = 'font-mono font-bold text-emerald-600 dark:text-emerald-400';
    ownerValue.textContent = formatCredits(result.ownerEarn);
    ownerRow.appendChild(ownerLabel);
    ownerRow.appendChild(ownerValue);
    splitContainer.appendChild(ownerRow);

    splitSection.appendChild(splitContainer);
  } else {
    // Human earnings
    const humanRow = document.createElement('div');
    humanRow.className = 'flex justify-between items-center py-2 bg-emerald-500/10 rounded-lg px-3';
    const humanLabel = document.createElement('span');
    humanLabel.textContent = 'Human Earn (100%)';
    const humanValue = document.createElement('span');
    humanValue.className = 'font-mono font-bold text-emerald-600 dark:text-emerald-400';
    humanValue.textContent = formatCredits(result.humanEarn);
    humanRow.appendChild(humanLabel);
    humanRow.appendChild(humanValue);
    splitSection.appendChild(humanRow);
  }

  wrapper.appendChild(splitSection);
  container.appendChild(wrapper);
}

/**
 * Handle calculate button click
 */
function handleCalculate() {
  const modelCostEl = qs('calcModelCost');
  const levelEl = qs('calcLevel');
  const recipientEl = qs('calcRecipient');

  if (!modelCostEl || !levelEl || !recipientEl) return;

  const modelCost = parseFloat(modelCostEl.value) || 10;
  const level = parseInt(levelEl.value, 10) || 0;
  const recipientType = recipientEl.value;

  const result = calculateEarnings(modelCost, level, recipientType);
  renderResults(result);
}

/**
 * Initialize the calculator
 */
function initCalculator() {
  const button = qs('calcButton');
  if (button) {
    button.addEventListener('click', handleCalculate);
  }

  // Auto-calculate on input change
  const inputs = ['calcModelCost', 'calcLevel', 'calcRecipient'];
  inputs.forEach(id => {
    const el = qs(id);
    if (el) {
      el.addEventListener('change', handleCalculate);
    }
  });

  // Run initial calculation
  handleCalculate();
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCalculator);
} else {
  initCalculator();
}
