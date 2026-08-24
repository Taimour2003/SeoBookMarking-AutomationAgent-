function normalizeText(value) {
  return String(value || '').toLowerCase();
}

function createBadge(text, tone) {
  const badge = document.createElement('span');
  badge.className = 'text-[11px] px-2 py-0.5 rounded-full border';
  if (tone === 'ok') badge.classList.add('bg-green-500/10', 'text-green-700', 'border-green-500/20', 'dark:text-green-300');
  else if (tone === 'warn') badge.classList.add('bg-yellow-500/10', 'text-yellow-700', 'border-yellow-500/20', 'dark:text-yellow-300');
  else badge.classList.add('bg-neutral-100', 'text-neutral-700', 'border-black/10', 'dark:bg-neutral-800', 'dark:text-neutral-200', 'dark:border-white/10');
  badge.textContent = text;
  return badge;
}

function debounce(fn, delayMs) {
  let timer = null;
  return (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delayMs);
  };
}

export function createAgentPicker({ searchInput, listContainer, countEl, showUnavailableCheckbox, onSelect }) {
  let agents = [];
  let selectedId = null;

  function render() {
    const query = normalizeText(searchInput?.value);
    const showUnavailable = showUnavailableCheckbox?.checked !== false;

    const filtered = agents
      .filter(a => {
        if (!a || typeof a !== 'object') return false;
        if (!showUnavailable && a.available === false) return false;
        if (!query) return true;
        return (
          normalizeText(a.name).includes(query) ||
          normalizeText(a.id).includes(query) ||
          normalizeText(a.description).includes(query)
        );
      })
      .slice(0, 400);

    if (countEl) countEl.textContent = `${filtered.length}/${agents.length}`;

    listContainer.innerHTML = '';

    if (agents.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'p-4 text-sm text-gray-500 dark:text-gray-400';
      empty.textContent = 'Loading agents…';
      listContainer.appendChild(empty);
      return;
    }

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'p-4 text-sm text-gray-500 dark:text-gray-400';
      empty.textContent = 'No agents match your search.';
      listContainer.appendChild(empty);
      return;
    }

    for (const agent of filtered) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className =
        'w-full text-left p-3 rounded-ios-xl border transition ' +
        (agent.id === selectedId
          ? 'bg-primary/90/10 border-primary/90/30'
          : 'bg-white dark:bg-neutral-950/40 border-black/5 dark:border-white/10 hover:bg-neutral-50 dark:hover:bg-neutral-900/50');

      const top = document.createElement('div');
      top.className = 'flex items-start justify-between gap-3';

      const titleWrap = document.createElement('div');
      titleWrap.className = 'min-w-0';

      const title = document.createElement('div');
      title.className = 'text-sm font-semibold truncate';
      title.textContent = agent.name || agent.id;

      const subtitle = document.createElement('div');
      subtitle.className = 'text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5';
      subtitle.textContent = agent.id;

      titleWrap.appendChild(title);
      titleWrap.appendChild(subtitle);
      top.appendChild(titleWrap);

      const right = document.createElement('div');
      right.className = 'flex items-center gap-2 shrink-0';

      // Credits-based billing: do not surface legacy subscription tiers in UI.
      if (agent.available === false) right.appendChild(createBadge('Unavailable', 'warn'));
      top.appendChild(right);

      const desc = document.createElement('div');
      desc.className = 'mt-2 text-xs text-gray-600 dark:text-gray-400 line-clamp-2';
      desc.textContent = agent.description || '';

      btn.appendChild(top);
      if (agent.description) btn.appendChild(desc);

      btn.addEventListener('click', () => {
        selectedId = agent.id;
        onSelect?.(agent.id);
        render();
      });

      listContainer.appendChild(btn);
    }
  }

  function setAgents(nextAgents) {
    agents = Array.isArray(nextAgents) ? nextAgents : [];
    render();
  }

  function setSelected(nextId) {
    selectedId = nextId || null;
    render();
  }

  const debouncedRender = debounce(render, 75);
  searchInput?.addEventListener('input', debouncedRender);
  showUnavailableCheckbox?.addEventListener('change', render);

  return { setAgents, setSelected, render };
}
