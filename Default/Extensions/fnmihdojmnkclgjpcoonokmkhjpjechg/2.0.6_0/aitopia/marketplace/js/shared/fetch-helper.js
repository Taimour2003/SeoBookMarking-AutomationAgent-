/**
 * Browser-side Fetch Helper
 * Centralized fetch management for client-side code
 * Can be used as ES module or global (window.fetchHelper)
 */

// Cache for API base URL loaded from server
let cachedApiBaseUrl = null;
let configLoadPromise = null;

/**
 * Load API configuration from server
 * @returns {Promise<string>} API base URL
 */
async function loadApiConfig() {
  if (cachedApiBaseUrl) {
    return cachedApiBaseUrl;
  }

  if (configLoadPromise) {
    return configLoadPromise;
  }

  configLoadPromise = (async () => {
    try {
      const response = await fetch('https://aitopia.ai/api/config', {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        await response.json();
        // Force browser calls through the current origin to avoid www/non-www cross-origin drift
        // and keep all client requests behind the same-origin web gateway proxy.
        cachedApiBaseUrl = window.location.origin;

        // Also set global for backward compatibility
        if (typeof window !== 'undefined') {
          window.API_BASE_URL = cachedApiBaseUrl;
        }

        return cachedApiBaseUrl;
      }
    } catch (error) {
      console.warn('[fetchHelper] Failed to load config, using window.location.origin', error);
    }

    // Fallback to origin
    cachedApiBaseUrl = window.location.origin;
    return cachedApiBaseUrl;
  })();

  return configLoadPromise;
}

/**
 * Get base URL for API calls
 * Uses server config, window.API_BASE_URL, or window.location.origin
 */
export function getBaseUrl() {
  // Check if there's a globally configured BASE_URL (set by loadApiConfig or manually)
  if (typeof window !== 'undefined' && window.API_BASE_URL) {
    return window.API_BASE_URL;
  }

  // Use cached value if available
  if (cachedApiBaseUrl) {
    return cachedApiBaseUrl;
  }

  // Fallback to current origin
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  return '';
}

/**
 * Get base URL asynchronously (waits for server config if not loaded)
 */
export async function getBaseUrlAsync() {
  if (cachedApiBaseUrl) {
    return cachedApiBaseUrl;
  }

  if (typeof window !== 'undefined' && window.API_BASE_URL) {
    return window.API_BASE_URL;
  }

  return loadApiConfig();
}

/**
 * Fetch wrapper that handles relative and absolute URLs
 * 
 * @param {string} uri - Relative path (e.g., 'https://aitopia.ai/api/store') or full URL
 * @param {RequestInit} [options] - Standard fetch options
 * @returns {Promise<Response>}
 * 
 * @example
 * // Relative URI
 * const response = await fetchHelper('https://aitopia.ai/api/agents', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({ name: 'test' })
 * });
 * 
 * // Full URL - used as-is
 * const response = await fetchHelper('https://api.example.com/data');
 */
export async function fetchHelper(uri, options = {}) {
  // Determine if uri is a relative path or full URL
  const isRelativePath = !uri.startsWith('http://') && !uri.startsWith('https://');

  // Construct final URL
  let url;
  if (isRelativePath) {
    const baseUrl = getBaseUrl();
    // Remove trailing slash from baseUrl and ensure uri starts with /
    const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const cleanUri = uri.startsWith('/') ? uri : `/${uri}`;
    url = `${cleanBaseUrl}${cleanUri}`;
  } else {
    url = uri;
  }

  // Execute fetch with credentials included for cookie support
  return fetch(url, {
    credentials: 'include',
    ...options,
  });
}

/**
 * Convenience method for JSON POST requests
 * 
 * @param {string} uri - API endpoint
 * @param {any} [data] - Data to send
 * @param {RequestInit} [options] - Additional fetch options
 * @returns {Promise<any>}
 */
export async function fetchJSON(uri, data, options = {}) {
  const response = await fetchHelper(uri, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: data ? JSON.stringify(data) : undefined,
    ...options,
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

/**
 * Convenience method for GET requests that return JSON
 *
 * @param {string} uri - API endpoint
 * @param {RequestInit} [options] - Additional fetch options
 * @returns {Promise<any>}
 */
export async function fetchGET(uri, options = {}) {
  const response = await fetchHelper(uri, {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

// Also expose as global for non-module scripts
if (typeof window !== 'undefined') {
  window.fetchHelper = fetchHelper;
  window.fetchJSON = fetchJSON;
  window.fetchGET = fetchGET;
  window.getBaseUrl = getBaseUrl;
  window.getBaseUrlAsync = getBaseUrlAsync;
  window.loadApiConfig = loadApiConfig;

  // Auto-load config on page load for optimal performance
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      loadApiConfig().catch(err => console.warn('[fetchHelper] Config load failed:', err));
    });
  } else {
    // DOM already loaded, load config immediately
    loadApiConfig().catch(err => console.warn('[fetchHelper] Config load failed:', err));
  }
}
