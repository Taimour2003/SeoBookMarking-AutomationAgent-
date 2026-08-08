import { getMarketplaceSearch, escapeHtml } from './marketplace-search.js';
import { attachAutocomplete } from './autocomplete.js';

function getQueryFromLocation() {
  const params = new URLSearchParams(window.location.search);
  return (params.get('q') || '').trim();
}

function updateLocationQuery(query, replace = false) {
  const next = new URL(window.location.href);
  if (query) next.searchParams.set('q', query);
  else next.searchParams.delete('q');
  const target = `${next.pathname}${next.search}`;
  if (replace) window.history.replaceState({ q: query }, '', target);
  else window.history.pushState({ q: query }, '', target);
}

function renderSummary(summaryEl, query, total) {
  if (!(summaryEl instanceof HTMLElement)) return;
  if (!query) {
    summaryEl.textContent = 'Type and press Enter to search across agents, models, and categories.';
    return;
  }
  summaryEl.innerHTML = `<span class="font-medium">${total}</span> result${total === 1 ? '' : 's'} for "<span class="font-medium">${escapeHtml(query)}</span>"`;
}

function renderGroup(container, title, items) {
  if (!(container instanceof HTMLElement)) return;
  if (!items.length) {
    container.innerHTML = '';
    return;
  }

  const rows = items.map((item) => {
    const name = escapeHtml(item.name || item.id || '');
    const description = escapeHtml(item.description || '');
    const category = escapeHtml(item.category || item.subtitle || '');
    const badge = escapeHtml(item.type || '');
    const href = escapeHtml(item.url || '#');
    return `
      <a href="${href}" class="block p-4 rounded-2xl border border-border/60 bg-card hover:bg-muted/40 transition-colors">
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <div class="text-base font-semibold truncate">${name}</div>
            <div class="text-xs text-muted-foreground mt-1">${category}</div>
            ${description ? `<div class="text-sm text-muted-foreground mt-2 line-clamp-2">${description}</div>` : ''}
          </div>
          <span class="text-[10px] uppercase tracking-wide text-muted-foreground">${badge}</span>
        </div>
      </a>
    `;
  }).join('');

  container.innerHTML = `
    <section class="space-y-3">
      <h2 class="text-lg font-semibold">${escapeHtml(title)} <span class="text-muted-foreground text-sm">(${items.length})</span></h2>
      <div class="grid gap-3">${rows}</div>
    </section>
  `;
}

function renderEmpty(emptyEl, query, isLoading) {
  if (!(emptyEl instanceof HTMLElement)) return;
  if (isLoading) {
    emptyEl.innerHTML = '<p class="text-muted-foreground text-sm">Loading search index...</p>';
    emptyEl.classList.remove('hidden');
    return;
  }
  if (!query) {
    emptyEl.innerHTML = `
      <p class="text-muted-foreground text-sm">Try: <strong>video</strong>, <strong>background remover</strong>, <strong>veo</strong>, <strong>image</strong>.</p>
    `;
    emptyEl.classList.remove('hidden');
    return;
  }
  emptyEl.innerHTML = `
    <p class="text-muted-foreground text-sm">No results found for "<strong>${escapeHtml(query)}</strong>".</p>
  `;
  emptyEl.classList.remove('hidden');
}

function hideEmpty(emptyEl) {
  if (!(emptyEl instanceof HTMLElement)) return;
  emptyEl.classList.add('hidden');
  emptyEl.innerHTML = '';
}

document.addEventListener('DOMContentLoaded', async () => {
  const searchEngine = getMarketplaceSearch();
  const inputEl = document.getElementById('searchPageInput');
  const formEl = document.getElementById('searchPageForm');
  const dropdownEl = document.getElementById('searchPageAutocomplete');
  const summaryEl = document.getElementById('searchSummary');
  const agentsEl = document.getElementById('searchGroupAgents');
  const modelsEl = document.getElementById('searchGroupModels');
  const categoriesEl = document.getElementById('searchGroupCategories');
  const emptyEl = document.getElementById('searchEmptyState');

  if (!(inputEl instanceof HTMLInputElement) || !(formEl instanceof HTMLFormElement) || !(dropdownEl instanceof HTMLElement)) {
    return;
  }

  renderEmpty(emptyEl, '', true);
  await searchEngine.init();
  hideEmpty(emptyEl);

  function navigateToQuery(query, replace = false) {
    const q = (query || '').trim();
    updateLocationQuery(q, replace);
    renderResults(q);
  }

  function renderResults(query) {
    const q = (query || '').trim();
    inputEl.value = q;
    if (!q) {
      renderSummary(summaryEl, '', 0);
      if (agentsEl instanceof HTMLElement) agentsEl.innerHTML = '';
      if (modelsEl instanceof HTMLElement) modelsEl.innerHTML = '';
      if (categoriesEl instanceof HTMLElement) categoriesEl.innerHTML = '';
      renderEmpty(emptyEl, '', false);
      return;
    }

    const result = searchEngine.search(q);
    renderSummary(summaryEl, q, result.total);
    renderGroup(agentsEl, 'Agents', result.groups.agents || []);
    renderGroup(modelsEl, 'Models', result.groups.models || []);
    renderGroup(categoriesEl, 'Categories', result.groups.categories || []);

    if (result.total === 0) renderEmpty(emptyEl, q, false);
    else hideEmpty(emptyEl);
  }

  attachAutocomplete({
    input: inputEl,
    dropdown: dropdownEl,
    search: searchEngine,
    onSelect: (item) => {
      if (item?.url) window.location.assign(item.url);
    },
    onSubmitWithoutSelection: (query) => {
      navigateToQuery(query, false);
    },
  });

  formEl.addEventListener('submit', (event) => {
    event.preventDefault();
    navigateToQuery(inputEl.value, false);
  });

  window.addEventListener('popstate', () => {
    renderResults(getQueryFromLocation());
  });

  renderResults(getQueryFromLocation());
});
