export function normalizeJobProgress(raw) {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
  // Support both 0..100 (preferred) and legacy 0..1 fraction progress formats.
  const pct = (raw > 0 && raw < 1) ? raw * 100 : raw;
  return Math.min(100, Math.max(0, Math.round(pct)));
}

function escapeHtml(s) {
  if (typeof s !== 'string') return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function createProgressController() {
  let timer = null;
  let simulated = 0;
  let real = null;
  let options = { prompt: '', model: '' };

  function clear() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    simulated = 0;
    real = null;
  }

  /** Update only percentage and bar */
  function patchProgress(container, percent) {
    if (!container) return;
    const pct = Math.min(100, Math.max(0, Math.round(percent)));
    const root = container.querySelector('[data-progress-root]');
    if (!root) return;
    const centerNum = root.querySelector('[data-progress-pct]');
    const barFill = root.querySelector('[data-progress-bar-fill]');
    if (centerNum) centerNum.textContent = pct;
    if (barFill) {
      barFill.style.width = `${pct}%`;
      barFill.style.minWidth = pct > 0 ? '0.5rem' : '0';
    }
  }

  function render(container, percent = 0) {
    return;
    if (!container) return;
    const pct = Math.min(100, Math.max(0, Math.round(percent)));
    const promptLine = String(options.prompt || '').trim();
    const modelLine = String(options.model || '').trim();

    const hasActualModel = modelLine && modelLine !== 'Preparing…' && modelLine !== 'Model';
    const hasActualPrompt = promptLine.length > 0;
    const showDetailsBox = hasActualModel || hasActualPrompt;

    container.innerHTML = `
      <div class="w-full h-full min-h-[300px] flex flex-col items-center justify-center px-4 py-6" data-progress-root>
        <div class="w-full max-w-xs rounded-2xl border border-border/80 bg-card dark:bg-card/80 p-8 shadow-lg shadow-black/5 dark:shadow-black/20 backdrop-blur-sm">
          <div class="flex flex-col items-center">
            <div class="relative w-16 h-16 mb-4">
              <div class="absolute inset-0 rounded-full border-[3px] border-primary/15"></div>
              <div class="absolute inset-0 rounded-full border-[3px] border-primary border-t-transparent animate-spin" style="animation-duration: 2s;"></div>
              <div class="absolute inset-2 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                <span class="text-xl font-bold tabular-nums text-primary drop-shadow-sm" data-progress-pct>${pct}</span>
              </div>
            </div>
            <p class="text-xs font-semibold text-muted-foreground uppercase tracking-[0.2em]">Processing</p>
            <div class="mt-4 w-full">
              <div class="h-2.5 w-full rounded-full bg-secondary/60 dark:bg-secondary/30 overflow-hidden">
                <div class="h-full rounded-full bg-gradient-to-r from-primary via-primary to-primary/90 transition-all duration-500 ease-out" data-progress-bar-fill style="width: ${pct}%; min-width: ${pct > 0 ? '0.5rem' : '0'}"></div>
              </div>
            </div>
          </div>
        </div>
        ${showDetailsBox ? `
        <div class="mt-4 w-full max-w-md text-left rounded-xl border border-border/80 bg-card/60 dark:bg-card/30 p-4 border-l-4 border-l-primary/60 shadow-sm">
          ${hasActualModel ? `<div class="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">Model</div><div class="text-sm font-medium text-foreground">${escapeHtml(modelLine)}</div>` : ''}
          ${hasActualPrompt ? `<div class="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest ${hasActualModel ? 'mt-3' : ''} mb-1">Prompt</div><div class="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap break-words line-clamp-3">${escapeHtml(promptLine)}</div>` : ''}
        </div>
        ` : ''}
      </div>
    `;
  }

  /** Update prompt/model without resetting progress or timer. */
  function setDetails(container, newOptions = {}) {
    options.prompt = newOptions.prompt ?? options.prompt;
    options.model = newOptions.model ?? options.model;
    render(container, simulated);
  }

  function start(container, onUpdate, startOptions = {}) {
    clear();
    options = { prompt: startOptions.prompt ?? '', model: startOptions.model ?? '' };
    simulated = 0;
    real = null;
    render(container, 0);

    timer = setInterval(() => {
      const baseCap = real != null
        ? Math.min(99, Math.max(90, real + 5))
        : 90;
      const cap = Math.max(simulated, baseCap);
      if (simulated >= cap) return;

      const remaining = cap - simulated;
      const increment = Math.max(0.5, remaining * 0.05);
      simulated = Math.min(cap, simulated + increment);
      patchProgress(container, simulated);
      onUpdate?.(simulated);
    }, 400);
  }

  function update(container, realPercent) {
    if (typeof realPercent === 'number' && Number.isFinite(realPercent)) {
      const sanitized = Math.min(100, Math.max(0, realPercent));
      real = real == null ? sanitized : Math.max(real, sanitized);
      simulated = Math.max(simulated, real);
    }
    if (container?.querySelector?.('[data-progress-root]')) {
      patchProgress(container, simulated);
    } else {
      render(container, simulated);
    }
  }

  function finish(container) {
    clear();
    render(container, 100);
  }

  return { clear, start, update, finish, setDetails };
}

