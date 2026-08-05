const DEFAULT_SUGGEST_LIMIT = 10;
const DEFAULT_SEARCH_LIMIT = 80;
const MIN_QUERY_LENGTH = 2;

function safeString(value) {
  return typeof value === 'string' ? value : '';
}

function normalizeText(value) {
  return safeString(value).replace(/\s+/g, ' ').trim();
}

function normalizeArray(values) {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => normalizeText(String(value || '')))
    .filter(Boolean);
}

function dedupeByDocKey(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    if (!item || !item.docKey || seen.has(item.docKey)) continue;
    seen.add(item.docKey);
    out.push(item);
  }
  return out;
}

export function buildPublicModelUrl(modelId) {
  const normalized = normalizeText(modelId);
  if (!normalized) return '/aitopia/marketplace/models.html';
  const slashIndex = normalized.indexOf('/');
  if (slashIndex === -1) return `/models?search=${encodeURIComponent(normalized)}`;
  const owner = normalized.slice(0, slashIndex);
  const model = normalized.slice(slashIndex + 1);
  if (!owner || !model) {
    return `/models?search=${encodeURIComponent(normalized)}`;
  }
  if (model.includes('/')) {
    return `/${encodeURIComponent(owner)}/${model.split('/').map((segment) => encodeURIComponent(segment)).join('/')}`;
  }
  return `/${encodeURIComponent(owner)}/${encodeURIComponent(model)}`;
}

export function escapeHtml(value) {
  return safeString(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toAgentDoc(agent) {
  const id = normalizeText(String(agent?.id || ''));
  if (!id) return null;
  const name = normalizeText(agent?.name || id);
  const description = normalizeText(agent?.description || '');
  const category = normalizeText(agent?.primaryCategory || agent?.category || '');
  const featureKeywords = normalizeArray(agent?.features);
  const useCaseKeywords = normalizeArray(agent?.useCases);
  const modelKeywords = normalizeArray(agent?.models);
  const platformKeywords = normalizeArray(agent?.platforms);
  const channelKeywords = normalizeArray(agent?.socialChannels);
  const verticalKeywords = normalizeArray(agent?.verticals);
  const providerKeywords = normalizeArray(agent?.providers);
  const relationKeywords = normalizeText(agent?.searchBlob || '');
  const keywords = normalizeText([
    ...featureKeywords,
    ...useCaseKeywords,
    ...modelKeywords,
    ...platformKeywords,
    ...channelKeywords,
    ...verticalKeywords,
    ...providerKeywords,
    relationKeywords,
  ].join(' '));

  return {
    docKey: `agent:${id}`,
    id,
    type: 'agent',
    name,
    description,
    category,
    keywords,
    source: normalizeText(agent?.source || ''),
    badge: normalizeText(agent?.tier || ''),
    subtitle: category || 'Agent',
    url: `/aitopia/marketplace/agent/${encodeURIComponent(id)}.html`,
  };
}

function toModelDoc(model) {
  const id = normalizeText(model?.id || '');
  if (!id) return null;
  const name = normalizeText(model?.displayName || id);
  const description = normalizeText(model?.description || '');
  const category = normalizeText(model?.mediaType || '');
  const tags = normalizeArray(model?.tags);
  const capabilities = normalizeArray(model?.capabilities);
  const keywords = normalizeText([
    normalizeText(model?.provider || ''),
    ...tags,
    ...capabilities,
    id,
  ].join(' '));

  return {
    docKey: `model:${id}`,
    id,
    type: 'model',
    name,
    description,
    category,
    keywords,
    source: 'model-registry',
    badge: normalizeText(model?.tier || ''),
    subtitle: category ? `${category} model` : 'Model',
    url: buildPublicModelUrl(id),
  };
}

function toCategoryDoc(category) {
  const id = normalizeText(category?.id || '');
  if (!id) return null;
  const visible = category?.visible;
  if (visible === false) return null;
  const name = normalizeText(category?.name || id);
  const description = normalizeText(category?.description || '');
  const keywords = normalizeText([id, name, description].join(' '));

  return {
    docKey: `category:${id}`,
    id,
    type: 'category',
    name,
    description,
    category: id,
    keywords,
    source: 'category',
    badge: 'category',
    subtitle: 'Category',
    url: `/category/${encodeURIComponent(id)}`,
  };
}

function createFallbackSearch(docs, query, options = {}) {
  const normalizedQuery = normalizeText(query).toLowerCase();
  if (!normalizedQuery) return [];
  const tokens = normalizedQuery.split(' ').filter(Boolean);
  const results = [];

  for (const doc of docs) {
    const name = safeString(doc.name).toLowerCase();
    const category = safeString(doc.category).toLowerCase();
    const description = safeString(doc.description).toLowerCase();
    const keywords = safeString(doc.keywords).toLowerCase();
    let score = 0;

    if (name === normalizedQuery) score += 100;
    if (name.startsWith(normalizedQuery)) score += 60;
    if (name.includes(normalizedQuery)) score += 45;
    if (category.startsWith(normalizedQuery)) score += 24;
    if (category.includes(normalizedQuery)) score += 18;
    if (keywords.includes(normalizedQuery)) score += 12;
    if (description.includes(normalizedQuery)) score += 8;

    for (const token of tokens) {
      if (name.includes(token)) score += 14;
      if (category.includes(token)) score += 8;
      if (keywords.includes(token)) score += 6;
      if (description.includes(token)) score += 3;
    }

    if (score > 0) {
      results.push({ ...doc, score });
    }
  }

  results.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const limit = Number.isFinite(options.limit) ? options.limit : DEFAULT_SEARCH_LIMIT;
  return results.slice(0, limit);
}

class MarketplaceSearch {
  constructor() {
    this._ready = false;
    this._loading = null;
    this._docs = [];
    this._index = null;
  }

  async init() {
    if (this._ready) return;
    if (this._loading) {
      await this._loading;
      return;
    }
    this._loading = this._load();
    await this._loading;
  }

  async _load() {
    const [storePayload, modelsPayload, categoriesPayload] = await Promise.all([
      this._fetchJson('https://aitopia.ai/api/store'),
      this._fetchJson('https://aitopia.ai/api/models/all?callableOnly=true'),
      this._fetchJson('https://aitopia.ai/api/store/categories'),
    ]);

    const docs = [];
    const storeAgents = Array.isArray(storePayload?.agents) ? storePayload.agents : [];
    const allModels = Array.isArray(modelsPayload?.models) ? modelsPayload.models : [];
    const categories = Array.isArray(categoriesPayload?.categories) ? categoriesPayload.categories : [];

    for (const item of storeAgents) {
      const doc = toAgentDoc(item);
      if (doc) docs.push(doc);
    }

    for (const item of allModels) {
      const doc = toModelDoc(item);
      if (doc) docs.push(doc);
    }

    for (const item of categories) {
      const doc = toCategoryDoc(item);
      if (doc) docs.push(doc);
    }

    this._docs = dedupeByDocKey(docs);
    this._index = this._createIndex(this._docs);
    this._ready = true;
  }

  async _fetchJson(url) {
    try {
      const response = await fetch(url, {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      console.warn('[search] fetch failed', url, error);
      return null;
    }
  }

  _createIndex(docs) {
    const MiniSearchCtor = window.MiniSearch;
    if (!MiniSearchCtor) {
      console.warn('[search] MiniSearch unavailable, using fallback scoring');
      return null;
    }

    const index = new MiniSearchCtor({
      idField: 'docKey',
      fields: ['name', 'description', 'category', 'keywords'],
      storeFields: ['docKey', 'id', 'type', 'name', 'description', 'category', 'keywords', 'url', 'badge', 'subtitle', 'source'],
      searchOptions: {
        prefix: true,
        fuzzy: 0.2,
        boost: {
          name: 8,
          category: 3,
          keywords: 2,
          description: 1,
        },
      },
    });

    index.addAll(docs);
    return index;
  }

  _searchRaw(query, options = {}) {
    const normalizedQuery = normalizeText(query);
    if (!normalizedQuery) return [];

    const limit = Number.isFinite(options.limit) ? options.limit : DEFAULT_SEARCH_LIMIT;
    if (!this._index) {
      return createFallbackSearch(this._docs, normalizedQuery, { limit });
    }

    const raw = this._index.search(normalizedQuery, {
      prefix: true,
      fuzzy: options.fuzzy ?? 0.2,
      combineWith: 'OR',
      boost: options.boost || {
        name: 8,
        category: 3,
        keywords: 2,
        description: 1,
      },
    });

    return raw.slice(0, limit).map((item) => ({
      docKey: item.docKey,
      id: item.id,
      type: item.type,
      name: item.name,
      description: item.description,
      category: item.category,
      keywords: item.keywords,
      url: item.url,
      badge: item.badge,
      subtitle: item.subtitle,
      source: item.source,
      score: item.score || 0,
    }));
  }

  suggest(query, limit = DEFAULT_SUGGEST_LIMIT) {
    const normalizedQuery = normalizeText(query);
    if (normalizedQuery.length < MIN_QUERY_LENGTH) {
      return {
        query: normalizedQuery,
        total: 0,
        items: [],
        groups: { agents: [], models: [], categories: [] },
      };
    }

    const raw = this._searchRaw(normalizedQuery, {
      limit: Math.max(limit * 2, 20),
      fuzzy: 0.16,
      boost: {
        name: 10,
        category: 4,
        keywords: 2,
        description: 1,
      },
    });

    const groups = { agents: [], models: [], categories: [] };
    for (const item of raw) {
      if (item.type === 'category') {
        if (groups.categories.length < 2) groups.categories.push(item);
        continue;
      }
      if (item.type === 'model') {
        if (groups.models.length < 3) groups.models.push(item);
        continue;
      }
      if (groups.agents.length < 5) groups.agents.push(item);
    }

    const items = [...groups.categories, ...groups.agents, ...groups.models].slice(0, limit);
    return {
      query: normalizedQuery,
      total: items.length,
      items,
      groups,
    };
  }

  search(query, limit = DEFAULT_SEARCH_LIMIT) {
    const normalizedQuery = normalizeText(query);
    if (!normalizedQuery) {
      return {
        query: '',
        total: 0,
        items: [],
        groups: { agents: [], models: [], categories: [] },
      };
    }

    const items = this._searchRaw(normalizedQuery, {
      limit,
      fuzzy: 0.22,
    });
    const groups = { agents: [], models: [], categories: [] };
    for (const item of items) {
      if (item.type === 'category') groups.categories.push(item);
      else if (item.type === 'model') groups.models.push(item);
      else groups.agents.push(item);
    }

    return {
      query: normalizedQuery,
      total: items.length,
      items,
      groups,
    };
  }
}

let marketplaceSearchSingleton = null;

export function getMarketplaceSearch() {
  if (!marketplaceSearchSingleton) {
    marketplaceSearchSingleton = new MarketplaceSearch();
  }
  return marketplaceSearchSingleton;
}
