import { escapeHtml } from './marketplace-search.js';

const DEFAULT_DEBOUNCE_MS = 120;
const DEFAULT_MIN_QUERY_LENGTH = 2;

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightMatch(text, query) {
  const normalizedText = String(text || '');
  const normalizedQuery = String(query || '').trim();
  if (!normalizedQuery) return escapeHtml(normalizedText);
  const regex = new RegExp(`(${escapeRegExp(normalizedQuery)})`, 'ig');
  let lastIndex = 0;
  let out = '';
  let match;

  while ((match = regex.exec(normalizedText)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    out += escapeHtml(normalizedText.slice(lastIndex, start));
    out += `<mark class="bg-yellow-300/40 dark:bg-yellow-500/25 rounded px-0.5">${escapeHtml(match[0])}</mark>`;
    lastIndex = end;
  }

  out += escapeHtml(normalizedText.slice(lastIndex));
  return out;
}

function ensureComboboxAria(input, dropdown) {
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-controls', dropdown.id);
  dropdown.setAttribute('role', 'listbox');
}

function buildSectionTitle(title) {
  return `<div class="px-4 py-1.5 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">${escapeHtml(title)}</div>`;
}

function buildOptionRow({ item, query, rowId, selected }) {
  const category = escapeHtml(item.category || item.subtitle || '');
  const badge = escapeHtml(item.type || '');
  const title = highlightMatch(item.name || item.id, query);
  return `
    <div
      id="${escapeHtml(rowId)}"
      role="option"
      aria-selected="${selected ? 'true' : 'false'}"
      data-row-type="item"
      data-row-url="${escapeHtml(item.url || '')}"
      class="autocomplete-row flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${selected ? 'bg-muted' : 'hover:bg-muted/60'}"
    >
      <div class="flex-1 min-w-0">
        <div class="text-sm font-medium truncate">${title}</div>
        <div class="text-xs text-muted-foreground truncate">${category}</div>
      </div>
      <span class="text-[10px] uppercase text-muted-foreground/75">${badge}</span>
    </div>
  `;
}

function buildSearchRow({ query, rowId, selected }) {
  const escapedQuery = escapeHtml(query);
  return `
    <div
      id="${escapeHtml(rowId)}"
      role="option"
      aria-selected="${selected ? 'true' : 'false'}"
      data-row-type="search"
      data-row-query="${escapedQuery}"
      class="autocomplete-row flex items-center gap-3 px-4 py-3 border-t border-border cursor-pointer transition-colors ${selected ? 'bg-muted' : 'hover:bg-muted/60'}"
    >
      <svg class="w-4 h-4 text-muted-foreground shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="8"></circle>
        <path d="M21 21l-4.35-4.35" stroke-width="2" stroke-linecap="round"></path>
      </svg>
      <span class="text-sm">Search for "<strong>${escapedQuery}</strong>"</span>
    </div>
  `;
}

function buildEmptyState(query) {
  return `
    <div class="px-4 py-3 text-sm text-muted-foreground text-center">
      No suggestions for "${escapeHtml(query)}"
    </div>
  `;
}

export function attachAutocomplete(options) {
  const input = options?.input;
  const dropdown = options?.dropdown;
  const search = options?.search;
  const onSelect = options?.onSelect;
  const onSubmitWithoutSelection = options?.onSubmitWithoutSelection;
  const minQueryLength = Number.isFinite(options?.minQueryLength) ? options.minQueryLength : DEFAULT_MIN_QUERY_LENGTH;
  const debounceMs = Number.isFinite(options?.debounceMs) ? options.debounceMs : DEFAULT_DEBOUNCE_MS;
  const suggestionLimit = Number.isFinite(options?.suggestionLimit) ? options.suggestionLimit : 10;

  if (!(input instanceof HTMLInputElement) || !(dropdown instanceof HTMLElement) || !search) {
    return { destroy() {}, close() {} };
  }

  ensureComboboxAria(input, dropdown);
  if (!dropdown.id) {
    dropdown.id = `autocomplete-${Math.random().toString(36).slice(2, 10)}`;
    input.setAttribute('aria-controls', dropdown.id);
  }

  let debounceHandle = null;
  let isOpen = false;
  let activeIndex = -1;
  let rows = [];
  let lastQuery = '';

  function setExpanded(expanded) {
    input.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  }

  function close() {
    isOpen = false;
    activeIndex = -1;
    rows = [];
    dropdown.classList.add('hidden');
    setExpanded(false);
    input.removeAttribute('aria-activedescendant');
  }

  function open() {
    isOpen = true;
    dropdown.classList.remove('hidden');
    setExpanded(true);
  }

  function runSubmitWithoutSelection(query) {
    if (typeof onSubmitWithoutSelection === 'function') {
      onSubmitWithoutSelection(query);
    }
  }

  function runSelect(item) {
    if (typeof onSelect === 'function') {
      onSelect(item);
      return;
    }
    if (item?.url) {
      window.location.assign(item.url);
    }
  }

  function syncActiveRow() {
    const rowEls = dropdown.querySelectorAll('.autocomplete-row');
    rowEls.forEach((rowEl, index) => {
      const selected = index === activeIndex;
      rowEl.setAttribute('aria-selected', selected ? 'true' : 'false');
      rowEl.classList.toggle('bg-muted', selected);
    });
    if (activeIndex >= 0 && rows[activeIndex]) {
      input.setAttribute('aria-activedescendant', rows[activeIndex].rowId);
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  }

  function render(query, result) {
    const sections = [];
    rows = [];
    activeIndex = -1;
    const sectionOrder = [
      ['Categories', result.groups.categories || []],
      ['Agents', result.groups.agents || []],
      ['Models', result.groups.models || []],
    ];

    for (const [title, items] of sectionOrder) {
      if (!items.length) continue;
      sections.push(buildSectionTitle(title));
      for (const item of items) {
        const rowId = `${dropdown.id}-row-${rows.length}`;
        rows.push({ rowId, type: 'item', item });
        sections.push(buildOptionRow({
          item,
          query,
          rowId,
          selected: false,
        }));
      }
    }

    if (!rows.length) {
      sections.push(buildEmptyState(query));
    }

    const searchRowId = `${dropdown.id}-row-${rows.length}`;
    rows.push({ rowId: searchRowId, type: 'search', query });
    sections.push(buildSearchRow({
      query,
      rowId: searchRowId,
      selected: false,
    }));

    dropdown.innerHTML = sections.join('');
    open();
    syncActiveRow();
  }

  function runLookup() {
    const query = input.value.trim();
    lastQuery = query;
    if (query.length < minQueryLength) {
      close();
      return;
    }
    const result = search.suggest(query, suggestionLimit);
    render(query, result);
  }

  function handleInput() {
    if (debounceHandle) window.clearTimeout(debounceHandle);
    debounceHandle = window.setTimeout(runLookup, debounceMs);
  }

  function activateByIndex(index) {
    if (!rows.length) return;
    activeIndex = Math.max(-1, Math.min(index, rows.length - 1));
    syncActiveRow();
  }

  function resolveRowTarget(row) {
    if (!row) return null;
    if (row.type === 'item') return row.item || null;
    return { query: row.query || input.value.trim(), type: 'search' };
  }

  function triggerActiveSelection() {
    const query = input.value.trim();
    const activeRow = activeIndex >= 0 ? rows[activeIndex] : null;
    if (!activeRow) {
      if (query) runSubmitWithoutSelection(query);
      close();
      return;
    }
    const target = resolveRowTarget(activeRow);
    if (!target) {
      if (query) runSubmitWithoutSelection(query);
      close();
      return;
    }
    if (target.type === 'search') {
      runSubmitWithoutSelection(target.query || query);
    } else {
      runSelect(target);
    }
    close();
  }

  function handleKeydown(event) {
    if (event.key === 'Escape') {
      if (isOpen) {
        event.preventDefault();
        close();
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      if (!isOpen) {
        runLookup();
      }
      if (rows.length) {
        event.preventDefault();
        activateByIndex(activeIndex + 1);
      }
      return;
    }

    if (event.key === 'ArrowUp') {
      if (!isOpen) return;
      if (rows.length) {
        event.preventDefault();
        activateByIndex(activeIndex - 1);
      }
      return;
    }

    if (event.key === 'Enter') {
      const query = input.value.trim();
      if (!query) return;
      if (isOpen) {
        event.preventDefault();
        triggerActiveSelection();
        return;
      }
      event.preventDefault();
      runSubmitWithoutSelection(query);
    }
  }

  function handleDropdownClick(event) {
    const rowEl = event.target.closest('.autocomplete-row');
    if (!(rowEl instanceof HTMLElement)) return;
    const rowType = rowEl.getAttribute('data-row-type');
    if (rowType === 'search') {
      const query = rowEl.getAttribute('data-row-query') || input.value.trim();
      runSubmitWithoutSelection(query);
      close();
      return;
    }
    const url = rowEl.getAttribute('data-row-url') || '';
    if (!url) return;
    const item = rows.find((row) => row.type === 'item' && row.item?.url === url)?.item;
    if (item) {
      runSelect(item);
    } else {
      window.location.assign(url);
    }
    close();
  }

  function handleDocumentClick(event) {
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (input.contains(target) || dropdown.contains(target)) return;
    close();
  }

  input.addEventListener('input', handleInput);
  input.addEventListener('keydown', handleKeydown);
  dropdown.addEventListener('click', handleDropdownClick);
  document.addEventListener('click', handleDocumentClick);

  return {
    close,
    destroy() {
      if (debounceHandle) window.clearTimeout(debounceHandle);
      input.removeEventListener('input', handleInput);
      input.removeEventListener('keydown', handleKeydown);
      dropdown.removeEventListener('click', handleDropdownClick);
      document.removeEventListener('click', handleDocumentClick);
      close();
    },
    refresh() {
      if (input.value.trim().length >= minQueryLength) runLookup();
      else close();
    },
    getLastQuery() {
      return lastQuery;
    },
  };
}
