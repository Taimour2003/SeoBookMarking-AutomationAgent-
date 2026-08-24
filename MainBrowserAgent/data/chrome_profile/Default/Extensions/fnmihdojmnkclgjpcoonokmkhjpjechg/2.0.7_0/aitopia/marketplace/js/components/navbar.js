(function() {
  // Load CSP-compliant event delegation handlers (once)
  if (!window.__CSP_HANDLERS_LOADED__) {
    window.__CSP_HANDLERS_LOADED__ = true;
    import(/* @vite-ignore */ '/aitopia/marketplace/js/csp-event-handlers.js').catch(function(){});
  }

  const NAVBAR_VERSION = 'navbar-v5';
  if (window.__AITOPIA_NAVBAR__ === NAVBAR_VERSION) return;
  window.__AITOPIA_NAVBAR__ = NAVBAR_VERSION;

  const getCache = () => window.AitopiaCache;
  const getUserProfile = () => getCache()?.getUserProfile?.() ?? null;
  const setUserProfile = (data) => getCache()?.setUserProfile?.(data);
  const getUserCredits = () => getCache()?.getUserCredits?.() ?? null;
  const setUserCredits = (credits) => getCache()?.setUserCredits?.(credits);
  const clearUserCache = () => getCache()?.clearUserData?.();

  let notificationsPoller = null;
  let notificationsModal = null;
  let developerStatusPromise = null;
  let queuePoller = null;
  let activeQueueItems = [];
  let lastUnreadCount = -1;

  // ---------------------------------------------------------------------------
  // Job toast notifications
  // ---------------------------------------------------------------------------
  function showJobToast(message, variant, url) {
    const id = 'jobToast-' + Date.now();
    const isSuccess = variant === 'success';
    const borderColor = 'border-[#1C1E20]';
    const iconColor = isSuccess ? 'text-green-500' : 'text-red-500';
    const iconPath = isSuccess
      ? '<path stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>'
      : '<path stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>';

    const toast = document.createElement('div');
    toast.id = id;
    toast.className = `fixed top-4 right-4 z-[9999] flex items-center gap-3 px-4 py-3 rounded-xl border ${borderColor} bg-card shadow-lg transition-all duration-300 translate-x-full opacity-0`;
    toast.style.maxWidth = '360px';
    toast.innerHTML = `
      <svg class="w-5 h-5 flex-shrink-0 ${iconColor}" fill="none" stroke="currentColor" viewBox="0 0 24 24">${iconPath}</svg>
      <span class="text-sm font-medium text-foreground flex-1">${escapeHtml(message)}</span>
      <button type="button" class="ml-1 p-0.5 rounded hover:bg-secondary transition-colors" aria-label="Close">
        <svg class="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    `;
    if (url) toast.style.cursor = 'pointer';
    document.body.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
      toast.classList.remove('translate-x-full', 'opacity-0');
      toast.classList.add('translate-x-0', 'opacity-100');
    });

    const dismiss = () => {
      toast.classList.add('translate-x-full', 'opacity-0');
      setTimeout(() => toast.remove(), 300);
    };

    toast.querySelector('button')?.addEventListener('click', (e) => { e.stopPropagation(); dismiss(); });
    if (url) toast.addEventListener('click', () => { dismiss(); window.location.href = url; });

    setTimeout(dismiss, 5000);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function formatRelativeTime(value) {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return '';

    const now = Date.now();
    const diffMs = now - date.getTime();
    const minutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMs / 3600000);
    const days = Math.floor(diffMs / 86400000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 30) return `${days}d ago`;
    return date.toLocaleDateString();
  }

  function setNotificationsBadge(count) {
    const n = Math.max(0, Math.trunc(Number(count) || 0));
    const label = n > 99 ? '99+' : String(n);

    // Desktop badge
    const btn = document.getElementById('notificationsBtn');
    const badge = document.getElementById('notificationsBadge');
    if (btn instanceof HTMLElement && badge instanceof HTMLElement) {
      badge.textContent = label;
      badge.classList.toggle('hidden', n === 0);
    }

    // Mobile badge
    const mBadge = document.getElementById('mobileNotificationsBadge');
    if (mBadge instanceof HTMLElement) {
      mBadge.textContent = label;
      mBadge.classList.toggle('hidden', n === 0);
    }
  }

  async function loadUnreadNotificationsCount() {
    try {
      const res = await fetch('https://aitopia.ai/api/notifications/unread-count', { method: 'GET', credentials: 'include', headers: { Accept: 'application/json' } });
      if (!res.ok) {
        setNotificationsBadge(0);
        return;
      }
      const json = await res.json().catch(() => null);
      const count = json?.count ?? 0;
      setNotificationsBadge(count);

      // When unread count changes and we have active jobs — fetch queue once
      if (lastUnreadCount >= 0 && count !== lastUnreadCount && queuePoller) {
        tickQueue();
      }
      lastUnreadCount = count;
    } catch {
      // ignore
    }
  }

function setUrlCookie() {
  const currentPath = window.location.pathname;
  const unListingPages = ["pricing", "login", "register"];
  let checkPage = true;
  unListingPages.forEach((item) => {
    if (currentPath.indexOf(`/${item}`) !== -1) {
      checkPage = false;
    }
  });

  const cookieValue = checkPage ? window.location.href : window.location.origin;

  const expires = new Date(Date.now() + 3600000).toUTCString(); // 1 hour
  document.cookie = `aitopia_last_url=${encodeURIComponent(cookieValue)}; expires=${expires}; path=/; Secure; SameSite=None; Domain=.aitopia.ai`;
}

  const NOTIF_POLL_NORMAL = 10000;  // 30s — idle
  const NOTIF_POLL_FAST   = 1000;   // 1s  — while jobs are active
  let currentNotifInterval = NOTIF_POLL_NORMAL;

  function notifTick() {
    if (document.hidden) return;
    void loadUnreadNotificationsCount();
  }

  function startNotificationsPolling() {
    if (notificationsPoller) return;
    currentNotifInterval = NOTIF_POLL_NORMAL;
    notificationsPoller = window.setInterval(notifTick, currentNotifInterval);
  }

  function setNotificationsPollingSpeed(fast) {
    const desired = fast ? NOTIF_POLL_FAST : NOTIF_POLL_NORMAL;
    if (desired === currentNotifInterval || !notificationsPoller) return;
    window.clearInterval(notificationsPoller);
    currentNotifInterval = desired;
    notificationsPoller = window.setInterval(notifTick, currentNotifInterval);
  }

  function stopNotificationsPolling() {
    if (notificationsPoller) {
      window.clearInterval(notificationsPoller);
      notificationsPoller = null;
    }
    setNotificationsBadge(0);
  }

  async function tickQueue() {
    if (document.hidden) return;
    try {
      const res = await fetch('https://aitopia.ai/api/queue?limit=20', {
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json' }
      });
      if (!res.ok) return;
      const json = await res.json();
      const items = Array.isArray(json?.items) ? json.items : [];

      const prevActiveIds = new Set(activeQueueItems.filter(i => i.status === 'pending' || i.status === 'processing').map(i => i.id));
      const newlyCompleted = items.filter(i =>
        (i.status === 'completed' || i.status === 'failed' || i.status === 'dead') &&
        prevActiveIds.has(i.id)
      );

      activeQueueItems = items;

      for (const item of newlyCompleted) {
        const agentLabel = item.agentId || 'Job';
        const shortId = (item.refId || item.id || '').slice(0, 8);
        const label = shortId ? `${agentLabel} #${shortId}` : agentLabel;
        if (item.status === 'completed') {
          const url = item.agentId ? `/aitopia/marketplace/agent/${encodeURIComponent(item.agentId)}.html?jobId=${encodeURIComponent(item.refId || item.id)}` : null;
          showJobToast(`${label} completed successfully`, 'success', url);
        } else {
          showJobToast(`${label} failed`, 'error', null);
        }
      }

      if (newlyCompleted.length > 0) {
        await loadUnreadNotificationsCount();
      }

      const hasActive = items.some(i => i.status === 'pending' || i.status === 'processing');
      if (!hasActive) {
        stopQueuePolling();
      }
    } catch {
      // ignore network errors
    }
  }

  // Called when a job is submitted — does a single initial queue fetch,
  // marks that we have active jobs. Subsequent updates come from
  // unread-count changes detected in the fast notifications polling (3s).
  function startQueuePolling() {
    queuePoller = true;
    setNotificationsPollingSpeed(true);
    void tickQueue();
  }

  function stopQueuePolling() {
    queuePoller = null;
    setNotificationsPollingSpeed(false);
  }

  async function fetchIsDeveloper(forceRefresh = false) {
    if (!forceRefresh && developerStatusPromise) return developerStatusPromise;
    developerStatusPromise = (async () => {
      try {
        const res = await fetch('https://aitopia.ai/api/developers/me?soft=1', {
          method: 'GET',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });
        return res.ok;
      } catch {
        return false;
      }
    })();
    return developerStatusPromise;
  }

  function getNotificationIcon(type) {
    const base = 'inline-flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0';
    switch (type) {
      case 'job_completed':
        return `<span class="${base} bg-green-500/10 text-green-500"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path d="M5 13l4 4L19 7"/></svg></span>`;
      case 'job_failed':
      case 'job_dead':
        return `<span class="${base} bg-red-500/10 text-red-500"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path d="M6 18L18 6M6 6l12 12"/></svg></span>`;
      case 'remix':
        return `<span class="${base} bg-primary/90/10 text-primary/90"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg></span>`;
      case 'follow':
        return `<span class="${base} bg-blue-500/10 text-blue-500"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6M23 11h-6"/></svg></span>`;
      case 'like_milestone':
        return `<span class="${base} bg-pink-500/10 text-pink-500"><svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg></span>`;
      case 'comment':
        return `<span class="${base} bg-yellow-500/10 text-yellow-500"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg></span>`;
      default:
        return `<span class="${base} bg-[#E9EEF7] dark:bg-[#1C1E20] text-muted-foreground"><span class="w-1.5 h-1.5 rounded-full bg-current"></span></span>`;
    }
  }

  // ---------------------------------------------------------------------------
  // Active queue items (progress rendering)
  // ---------------------------------------------------------------------------
  function renderActiveQueueItem(item) {
    const agent = escapeHtml(item.agentId || 'Job');
    const pct = Math.min(100, Math.max(0, Math.round(Number(item.progress) || 0)));
    const statusLabel = item.status === 'pending' ? 'Queued' : 'Processing';
    const barColor = item.status === 'pending' ? 'bg-yellow-500' : 'bg-primary/90';

    return `
      <div class="flex items-center gap-2.5 rounded-xl bg-primary/90/[0.04] dark:bg-primary/90/[0.06] border border-primary/90/10 px-3 py-2.5" data-queue-id="${escapeHtml(item.id)}">
        <span class="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-primary/90/10 text-primary/90 flex-shrink-0">
          <svg class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" class="opacity-25"/><path fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" class="opacity-75"/></svg>
        </span>
        <div class="min-w-0 flex-1">
          <div class="flex items-center justify-between gap-2">
            <span class="text-[12px] font-medium text-foreground truncate">${agent}</span>
            <span class="text-[11px] text-muted-foreground flex-shrink-0">${statusLabel} · ${pct}%</span>
          </div>
          <div class="mt-1.5 w-full bg-[#E9EEF7] dark:bg-[#1C1E20] rounded-full h-1 overflow-hidden">
            <div class="${barColor} h-full rounded-full transition-all duration-500" style="width:${pct}%"></div>
          </div>
        </div>
      </div>
    `;
  }

  let activeQueuePoller = null;

  function startActiveQueuePolling() {
    if (activeQueuePoller) return;
    const tick = async () => {
      if (!notificationsModal || notificationsModal.classList.contains('hidden')) {
        stopActiveQueuePolling();
        return;
      }
      try {
        const res = await fetch('https://aitopia.ai/api/queue?limit=20&status=pending,processing', {
          method: 'GET', credentials: 'include', headers: { Accept: 'application/json' },
        });
        if (!res.ok) return;
        const json = await res.json();
        const items = Array.isArray(json?.items) ? json.items : [];
        const container = notificationsModal.querySelector('[data-notif-active]');
        if (!container) return;

        if (items.length === 0) {
          container.innerHTML = '';
          stopActiveQueuePolling();
          return;
        }
        container.innerHTML = items.map(renderActiveQueueItem).join('');
      } catch { /* ignore */ }
    };
    activeQueuePoller = window.setInterval(tick, 2000);
    void tick();
  }

  function stopActiveQueuePolling() {
    if (activeQueuePoller) {
      window.clearInterval(activeQueuePoller);
      activeQueuePoller = null;
    }
  }

  function renderNotificationItem(n) {
    const icon = getNotificationIcon(n.type);
    const msg = escapeHtml(n?.message || 'Notification');
    const when = escapeHtml(formatRelativeTime(n?.createdAt || ''));
    const url = typeof n?.url === 'string' && n.url ? String(n.url) : '';
    const tag = url ? 'a' : 'div';
    const hrefAttr = url ? ` href="${escapeHtml(url)}"` : '';
    const unreadDot = !n.isRead ? '<span class="absolute top-1/2 -translate-y-1/2 right-2 w-1.5 h-1.5 rounded-full bg-primary/90"></span>' : '';

    // Job notification badges (agentId + short jobId + credits)
    const isJobNotif = n.type === 'job_completed' || n.type === 'job_failed' || n.type === 'job_dead';
    const meta = isJobNotif && n.metadata && typeof n.metadata === 'object' ? n.metadata : null;
    const agentBadge = "";//meta?.agentId ? `<span class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-primary/90/10 text-primary/90">${escapeHtml(meta.agentId)}</span>` : '';
    const jobIdBadge = "";//meta?.jobId ? `<span class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono bg-secondary text-muted-foreground">#${escapeHtml(String(meta.jobId).slice(0, 8))}</span>` : '';
    const creditCount = typeof n.credits === 'number' ? n.credits : (typeof meta?.credits === 'number' ? meta.credits : 0);
    const creditsBadge = "";//creditCount > 0 ? `<span class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono bg-secondary text-muted-foreground">${creditCount} credit${creditCount !== 1 ? 's' : ''}</span>` : '';
    const badgesHtml = (agentBadge || jobIdBadge || creditsBadge) ? `<div class="flex items-center gap-1.5 mt-1">${agentBadge}${jobIdBadge}${creditsBadge}</div>` : '';

    return `
      <${tag}${hrefAttr} class="relative flex items-start gap-2.5 rounded-xl px-3 py-2.5 hover:bg-[#E9EEF7] dark:hover:bg-[#1C1E20] transition-colors cursor-pointer group">
        ${unreadDot}
        ${icon}
        <div class="min-w-0 flex-1 pt-0.5">
          <p class="text-[12px] text-foreground leading-[1.4] ${n.isRead ? 'font-normal text-muted-foreground' : 'font-medium'}">${msg}</p>
          ${badgesHtml}
          <span class="text-[11px] text-muted-foreground/70 mt-0.5 block">${when}</span>
        </div>
      </${tag}>
    `;
  }

  let notifNextCursor = null;
  let notifIsLoading = false;

  async function loadNotifications(append = false) {
    if (notifIsLoading) return;
    notifIsLoading = true;

    const overlay = ensureNotificationsModal();
    const listEl = overlay.querySelector('[data-notif-list]');
    const emptyEl = overlay.querySelector('[data-notif-empty]');
    const loadMoreBtn = overlay.querySelector('[data-notif-load-more]');

    if (!append) {
      if (listEl) listEl.innerHTML = '<div class="text-sm text-muted-foreground">Loading…</div>';
      if (emptyEl) emptyEl.classList.add('hidden');
      notifNextCursor = null;
    }

    try {
      let url = 'https://aitopia.ai/api/notifications?limit=20';
      if (append && notifNextCursor) {
        url += '&cursor=' + encodeURIComponent(notifNextCursor);
      }

      const res = await fetch(url, {
        method: 'GET', credentials: 'include',
        headers: { Accept: 'application/json' }
      });
      if (!res.ok) throw new Error('fetch failed');

      const json = await res.json().catch(() => null);
      const items = Array.isArray(json?.notifications) ? json.notifications : [];
      notifNextCursor = json?.nextCursor || null;

      if (!append && items.length === 0) {
        if (listEl) listEl.innerHTML = '';
        if (emptyEl) emptyEl.classList.remove('hidden');
      } else {
        const html = items.map((n) => renderNotificationItem(n)).join('');
        if (append) {
          if (listEl) listEl.insertAdjacentHTML('beforeend', html);
        } else {
          if (listEl) listEl.innerHTML = html;
          if (emptyEl) emptyEl.classList.add('hidden');
        }
      }

      if (loadMoreBtn) {
        loadMoreBtn.classList.toggle('hidden', !notifNextCursor);
      }
      const footer = overlay.querySelector('[data-notif-footer]');
      if (footer) {
        footer.classList.toggle('hidden', !notifNextCursor);
      }
    } catch {
      if (!append && listEl) {
        listEl.innerHTML = '<div class="text-sm text-red-500">Failed to load notifications.</div>';
      }
    } finally {
      notifIsLoading = false;
    }
  }

  function closeNotificationsModal() {
    if (!notificationsModal) return;
    notificationsModal.classList.add('hidden');
    stopActiveQueuePolling();
  }

  function ensureNotificationsModal() {
    if (notificationsModal) return notificationsModal;

    const overlay = document.createElement('div');
    overlay.id = 'aitopiaNotificationsModal';
    overlay.className = 'hidden fixed inset-0 z-50';
    overlay.innerHTML = `
      <div class="fixed inset-0 bg-black/20" data-notif-backdrop></div>
      <div class="fixed top-14 right-3 sm:right-6 w-[calc(100vw-24px)] sm:w-[360px] max-h-[min(70vh,520px)] rounded-2xl border border-[#D9D9D9]/20 dark:border-[#D9D9D9]/[4%] bg-white dark:bg-[#131517] shadow-2xl flex flex-col overflow-hidden">
        <div class="flex items-center justify-between px-4 py-3 border-b border-[#D9D9D9]/15 dark:border-[#D9D9D9]/[4%]">
          <span class="text-[13px] font-semibold text-foreground">Notifications</span>
          <button type="button" data-notif-close class="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-[#E9EEF7] dark:hover:bg-[#1C1E20] text-muted-foreground transition-colors">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="flex-1 overflow-y-auto px-2 py-1.5 min-h-0 space-y-0.5" style="scrollbar-width: thin;">
          <div class="space-y-0.5" data-notif-active></div>
          <div data-notif-list></div>
          <div class="py-10 text-center hidden" data-notif-empty>
            <svg class="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"/></svg>
            <p class="text-[12px] text-muted-foreground/60">No notifications yet</p>
          </div>
        </div>
        <div class="px-2 py-1.5 border-t border-[#D9D9D9]/15 dark:border-[#D9D9D9]/[4%] hidden" data-notif-footer>
          <button type="button" data-notif-load-more class="hidden w-full py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-[#E9EEF7] dark:hover:bg-[#1C1E20] transition-colors rounded-lg">Load more</button>
        </div>
      </div>
    `;

    overlay.querySelector('[data-notif-backdrop]')?.addEventListener('click', closeNotificationsModal);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeNotificationsModal();
    });

    overlay.querySelector('[data-notif-close]')?.addEventListener('click', closeNotificationsModal);
    overlay.querySelector('[data-notif-load-more]')?.addEventListener('click', () => void loadNotifications(true));

    document.body.appendChild(overlay);
    notificationsModal = overlay;
    return overlay;
  }

  async function openNotificationsModal() {
    const overlay = ensureNotificationsModal();
    overlay.classList.remove('hidden');
    startActiveQueuePolling();
    await loadNotifications(false);

    await fetch('https://aitopia.ai/api/notifications/read', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({}),
    }).catch(() => {});
    await loadUnreadNotificationsCount();
  }

  function getHeaderSearchContext() {
    const pathname = String(window.location?.pathname || '').toLowerCase();
    const inModels = pathname.startsWith('/aitopia/marketplace/models.html') || pathname.startsWith('/model/');
    const inAgents = pathname.startsWith('/aitopia/marketplace/agents.html') || pathname.startsWith('/agent/');

    if (inModels) {
      return { targetPath: '/aitopia/marketplace/models.html', queryParam: 'search', linkedInputId: 'search-input' };
    }

    if (inAgents) {
      return { targetPath: '/aitopia/marketplace/agents.html', queryParam: 'q', linkedInputId: 'searchInput' };
    }

    return { targetPath: '/aitopia/marketplace/search.html', queryParam: 'q', linkedInputId: null };
  }

  function bindHeaderSearch() {
    const form = document.getElementById('navbarHeaderSearchForm');
    const input = document.getElementById('navbarHeaderSearchInput') || document.getElementById('searchInput');
    if (!(form instanceof HTMLFormElement) || !(input instanceof HTMLInputElement)) return;

    const { targetPath, queryParam, linkedInputId } = getHeaderSearchContext();
    const linkedEl = linkedInputId ? document.getElementById(linkedInputId) : null;
    const linkedSearchInput = linkedEl instanceof HTMLInputElement ? linkedEl : null;

    const params = new URLSearchParams(window.location.search);
    const queryFromUrl = params.get(queryParam) || params.get('q') || params.get('search') || '';

    if (linkedSearchInput?.value) {
      input.value = linkedSearchInput.value;
    } else if (queryFromUrl) {
      input.value = queryFromUrl;
    }

    let syncing = false;
    let dispatchTimer = null;

    const fireLinkedEvent = () => {
      syncing = true;
      try { linkedSearchInput.dispatchEvent(new Event('input', { bubbles: true })); }
      finally { syncing = false; }
    };

    const syncToLinkedInput = (immediate) => {
      if (!linkedSearchInput || syncing) return false;
      syncing = true;
      try {
        const changed = linkedSearchInput.value !== input.value;
        if (changed) linkedSearchInput.value = input.value;
        if (dispatchTimer) clearTimeout(dispatchTimer);
        console.log("SyncToLink",immediate);
        if (immediate) {
          fireLinkedEvent();
        } else if (changed) {
          dispatchTimer = setTimeout(fireLinkedEvent, 500);
        }
        return true;
      } finally {
        syncing = false;
      }
    };

    if (linkedSearchInput) {
      linkedSearchInput.addEventListener('input', () => {
        if (syncing) return;
        if (input.value !== linkedSearchInput.value) input.value = linkedSearchInput.value;
      });
      if (input.value) syncToLinkedInput(true);
    }

    input.addEventListener('input', () => {
      syncToLinkedInput(false);
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (syncToLinkedInput(true)) return;

      const query = input.value.trim();
      const url = new URL(targetPath, window.location.origin);
      if (query) url.searchParams.set(queryParam, query);
      window.location.assign(`${url.pathname}${url.search}`);
    });
  }

  // Navbar HTML template
  function getNavbarHTML() {
    const container = document.getElementById('navbar-container');
    const isHome = container && container.getAttribute('data-navbar-context') === 'home';
    const searchInputId = isHome ? 'searchInput' : 'navbarHeaderSearchInput';
    const searchWrapClass = 'flex-1 min-w-0 max-w-md mx-2 sm:mr-20';
    const searchFormClass = isHome ? 'relative w-full min-w-0' : 'max-w-[460px] mx-auto min-w-0';
    const autocompleteHtml = isHome
      ? '<div id="searchAutocompleteHeader" class="hidden absolute top-full left-0 right-0 mt-2 z-50 bg-card border border-border rounded-ios-xl shadow-2xl max-h-[420px] overflow-y-auto"></div>'
      : '';

    return `
	  <header id="header" class="sticky top-0 z-50 w-full glass border-b border-border/40 safe-top transition-all duration-300">
    <div id="promo-announcement-bar" class="w-full overflow-hidden text-center bg-[var(--promo-bar-bg)] py-2 px-4" style="display:none;">
      <div class="relative flex items-center justify-center">
        <!-- Single marquee track — entire row scrolls together when it overflows -->
        <div id="promo-bar-inner" class="inline-flex items-center gap-2.5 whitespace-nowrap">
          <span class="inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap rounded-full py-1 px-3 text-sm font-medium text-white bg-[var(--promo-bar-badge-bg)]">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" class="shrink-0"><path d="M12.9897 13.3478C12.7166 10.945 11.62 9.94907 10.8191 9.22282C10.2653 8.71876 9.99909 8.45657 9.99909 8.00001C9.99909 7.54969 10.2644 7.29251 10.8166 6.79876C11.6269 6.07469 12.7366 5.08282 12.9903 2.64751C13.0106 2.44291 12.9877 2.23633 12.9231 2.04114C12.8585 1.84594 12.7537 1.66649 12.6153 1.51438C12.4676 1.35192 12.2875 1.22221 12.0865 1.13361C11.8856 1.04502 11.6684 0.999505 11.4488 1.00001H4.5494C4.32951 0.999321 4.11191 1.04474 3.91066 1.13334C3.7094 1.22194 3.52896 1.35174 3.38096 1.51438C3.24304 1.6667 3.13858 1.84623 3.07431 2.0414C3.01005 2.23657 2.9874 2.44305 3.00784 2.64751C3.26065 5.07501 4.36628 6.05969 5.17346 6.77844C5.73096 7.27501 5.99909 7.53407 5.99909 8.00001C5.99909 8.47188 5.73034 8.73626 5.17096 9.24219C4.37409 9.96407 3.28034 10.9525 3.00846 13.3478C2.98641 13.5515 3.00757 13.7575 3.07058 13.9525C3.13358 14.1474 3.237 14.3268 3.37409 14.4791C3.52239 14.6436 3.70371 14.775 3.90622 14.8648C4.10873 14.9546 4.32789 15.0006 4.5494 15H11.4488C11.6703 15.0006 11.8894 14.9546 12.092 14.8648C12.2945 14.775 12.4758 14.6436 12.6241 14.4791C12.7612 14.3268 12.8646 14.1474 12.9276 13.9525C12.9906 13.7575 13.0118 13.5515 12.9897 13.3478ZM10.7272 13.5H5.2844C4.7969 13.5 4.6594 12.9375 5.00128 12.5888C5.82878 11.75 7.49909 11.1494 7.49909 10.1875V7.00001C7.49909 6.37969 6.31159 5.90626 5.5769 4.90001C5.45565 4.73407 5.46784 4.50001 5.77596 4.50001H10.2363C10.4991 4.50001 10.5557 4.73219 10.4363 4.89844C9.71221 5.90626 8.49909 6.37657 8.49909 7.00001V10.1875C8.49909 11.1416 10.24 11.6563 11.0116 12.5897C11.3225 12.9659 11.2138 13.5 10.7272 13.5Z" fill="#FFFFFF"/></svg>
            Discount Expires in <strong id="promo-bar-timer" class="text-sm font-bold tracking-[0.02em]">--h --m --s</strong>
          </span>
          <span id="promo-bar-text" class="text-[var(--promo-bar-text)] text-sm"></span>
          <a id="promo-bar-cta" href="/aitopia/marketplace/pricing.html" class="text-[var(--promo-bar-text)] text-sm font-bold underline underline-offset-2 whitespace-nowrap"></a>
        </div>
        <!-- Close button -->
        <button id="promo-bar-close" data-action="dismissPromoBar" aria-label="Close" style="position:absolute;right:0;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;padding:4px;display:flex;align-items:center;opacity:0.6;" class="hover-fade">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
    </div>
	    <div class="max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-6">
	      <div class="flex h-16 items-center justify-between">
	        <!-- Logo Section -->
	        <div class="flex items-center gap-2">
          <!-- Logo -->
	          <a href="/marketplace/" class="flex items-center">
            <svg class="h-8 w-8 sm:hidden" el-logo style="color:hsl(var(--ait-m-primary))" fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 830.12 868.33">
    <path fill="currentColor" d="M424.14,825.57c-114.47,0-207.59-93.13-207.59-207.59V261.32c0-114.46,93.12-207.59,207.59-207.59s207.59,93.13,207.59,207.59V618C631.73,732.44,538.6,825.57,424.14,825.57Zm0-713.31c-82.19,0-149.06,66.87-149.06,149.06V618C275.08,700.17,342,767,424.14,767S573.2,700.17,573.2,618V261.32C573.2,179.13,506.33,112.26,424.14,112.26Z"/>
    <path fill="currentColor" d="M578.23,736.49a206.33,206.33,0,0,1-103.45-27.9L165.91,530.27a207.59,207.59,0,0,1-76-283.58c57.24-99.13,184.45-133.21,283.58-76L682.37,349c99.13,57.23,133.22,184.45,76,283.58A206.21,206.21,0,0,1,632.3,729.33,208.85,208.85,0,0,1,578.23,736.49ZM270,201.45A149.18,149.18,0,0,0,140.61,276C99.52,347.13,124,438.48,195.17,479.58L504,657.9c71.18,41.1,162.53,16.63,203.62-54.56h0A149.06,149.06,0,0,0,653.1,399.72L344.23,221.39A148.22,148.22,0,0,0,270,201.45Z"/>
    <path fill="currentColor" d="M270,736.49A208.9,208.9,0,0,1,216,729.33,207.59,207.59,0,0,1,165.91,349L474.78,170.7c99.12-57.23,226.34-23.14,283.57,76h0c57.24,99.13,23.15,226.34-76,283.58L373.5,708.59A206.37,206.37,0,0,1,270,736.49Zm308.28-535A148.15,148.15,0,0,0,504,221.39L195.17,399.72A149.06,149.06,0,0,0,344.23,657.9L653.1,479.58c71.18-41.1,95.66-132.44,54.56-203.62L733,261.32,707.66,276A149.15,149.15,0,0,0,578.32,201.45Z"/>
</svg>
            <svg class="hidden sm:block h-10 w-auto" el-logo-all style="color:hsl(var(--ait-m-primary))" fill="currentColor" width="343" height="73" viewBox="0 0 343 73" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M35.5587 69.0869C25.9618 69.0869 18.1549 61.2934 18.1549 51.715V21.8683C18.1549 12.2898 25.9618 4.49634 35.5587 4.49634C45.1555 4.49634 52.9624 12.2898 52.9624 21.8683V51.7167C52.9624 61.2934 45.1547 69.0869 35.5587 69.0869ZM35.5587 9.39436C28.6681 9.39436 23.0619 14.9903 23.0619 21.8683V51.7167C23.0619 58.593 28.6723 64.1856 35.5587 64.1856C42.445 64.1856 48.0554 58.593 48.0554 51.7167V21.8683C48.0554 14.9903 42.4492 9.39436 35.5587 9.39436Z" fill="currentColor"/>
<path d="M48.4771 61.6324C45.4306 61.63 42.4388 60.8246 39.8042 59.2976L13.9094 44.3751C11.9299 43.2345 10.1949 41.716 8.80338 39.9061C7.41187 38.0962 6.39114 36.0304 5.79948 33.8268C5.20781 31.6231 5.0568 29.3247 5.35506 27.0628C5.65332 24.8009 6.39502 22.6198 7.53779 20.644C12.3366 12.3484 23.0016 9.49645 31.3123 14.284L57.2079 29.2057C65.5187 33.9949 68.3767 44.6412 63.5796 52.9368C62.4419 54.917 60.9219 56.6523 59.1076 58.0421C57.2934 59.4319 55.2209 60.4485 53.0102 61.0332C51.5319 61.4298 50.0079 61.6313 48.4771 61.6324ZM22.636 16.8581C20.4382 16.8549 18.2782 17.4299 16.3739 18.5251C14.4695 19.6203 12.8879 21.1972 11.7883 23.0968C8.34347 29.0492 10.3958 36.6937 16.3625 40.1331L42.2539 55.0556C48.2214 58.4951 55.88 56.4473 59.3248 50.4898C60.9823 47.6252 61.4319 44.2207 60.5747 41.0251C59.7175 37.8296 57.6238 35.1048 54.754 33.4501L28.8593 18.5268C26.9679 17.434 24.8213 16.8585 22.636 16.8581Z" fill="currentColor"/>
<path d="M22.636 61.6324C21.1072 61.6307 19.5852 61.4293 18.1088 61.0332C14.783 60.1447 11.796 58.2915 9.52551 55.7082C7.25505 53.1248 5.80321 49.9273 5.35366 46.5202C4.90412 43.1131 5.47706 39.6494 7.00002 36.5674C8.52297 33.4853 10.9275 30.9234 13.9094 29.2057L39.8042 14.2848C48.1141 9.49561 58.7799 12.3484 63.5779 20.6448C68.3767 28.9404 65.5187 39.5858 57.2063 44.3759L31.3132 59.2976C28.6773 60.8252 25.6839 61.6306 22.636 61.6324ZM48.4813 16.8615C46.2949 16.8598 44.1467 17.4342 42.2539 18.5268L16.3625 33.4501C13.4922 35.1043 11.3977 37.8288 10.5399 41.0244C9.68209 44.2199 10.1312 47.6248 11.7883 50.4898C13.4455 53.3549 16.175 55.4455 19.3765 56.3018C22.5779 57.158 25.9889 56.7098 28.8593 55.0556L54.754 40.1331C60.7216 36.6937 62.7739 29.05 59.3282 23.0934L61.4526 21.8683L59.3282 23.0968C58.2292 21.1976 56.6483 19.621 54.7447 18.5258C52.841 17.4306 50.6819 16.8554 48.4847 16.8581L48.4813 16.8615Z" fill="currentColor"/>
<path d="M90.012 54.6653C88.7761 54.6653 87.645 54.3822 86.6187 53.8162C85.6132 53.2502 84.7754 52.4483 84.1051 51.4105L83.7595 54.1464H82V43.4388H83.9166C84.0423 46.4263 84.545 48.6118 85.4247 49.9954C86.3045 51.3791 87.6346 52.0709 89.415 52.0709C90.9022 52.0709 92.0228 51.6464 92.7769 50.7973C93.531 49.9168 93.908 48.6275 93.908 46.9294C93.908 45.5772 93.6776 44.4451 93.2168 43.5332C92.7769 42.6212 92.1276 41.8036 91.2688 41.0803C90.4309 40.3571 89.4255 39.6495 88.2525 38.9577C86.9329 38.1401 85.8122 37.3382 84.8906 36.552C83.969 35.7344 83.2673 34.7596 82.7855 33.6275C82.3247 32.464 82.0943 30.9703 82.0943 29.1464C82.0943 26.159 82.7122 23.8319 83.948 22.1653C85.2048 20.4986 86.8805 19.6653 88.9751 19.6653C91.0488 19.6653 92.735 20.5458 94.0337 22.3068L94.285 20.1841H96.0445V30.8917H94.2536C94.2536 27.8728 93.8766 25.6715 93.1225 24.2879C92.3684 22.9042 91.185 22.2124 89.5721 22.2124C86.7025 22.2124 85.2676 24.1778 85.2676 28.1086C85.2676 29.1464 85.3933 30.0112 85.6447 30.703C85.896 31.3634 86.3464 31.9766 86.9957 32.5426C87.666 33.1086 88.6086 33.7847 89.8235 34.5709C91.562 35.6715 92.9654 36.7407 94.0337 37.7785C95.1019 38.8162 95.8769 39.9483 96.3587 41.1747C96.8405 42.3697 97.0814 43.8005 97.0814 45.4671C97.0814 47.3854 96.7776 49.0363 96.1702 50.42C95.5837 51.8036 94.7563 52.8571 93.6881 53.5803C92.6407 54.3036 91.4154 54.6653 90.012 54.6653Z" fill="currentColor"/>
<path d="M114.005 49.8539L120.069 20.1841H127.421V22.2124L124.782 23.203V51.1275L127.421 52.1181V54.1464H119.346V52.1181L121.64 51.1275V23.2502L115.167 54.1464H111.46L104.925 23.2502V51.1275L107.218 52.1181V54.1464H100.243V52.1181L102.882 51.1275V23.203L100.243 22.2124V20.1841H107.721L113.879 49.8539H114.005Z" fill="currentColor"/>
<path d="M145.642 51.1275L143.789 42.7313H135.368L133.452 51.1275L136.059 52.1181V54.1464H128.707V52.1181L131.284 51.1275L138.824 19.7124H141.746L149.193 51.1275L151.706 52.1181V54.1464H143.066V52.1181L145.642 51.1275ZM139.673 23.9105L135.997 39.9954H143.192L139.798 23.9105H139.673Z" fill="currentColor"/>
<path d="M168.632 36.1275C168.255 36.5678 167.815 36.9451 167.313 37.2596C166.81 37.5741 166.192 37.8414 165.459 38.0615C165.647 38.3445 165.846 38.7061 166.056 39.1464C166.286 39.5866 166.506 40.0741 166.716 40.6086L170.894 51.2219L173.691 52.1181V54.1464H167.218V52.1181L162.694 38.9105H158.861V51.1275L161.846 52.1181V54.1464H153.079V52.1181L155.719 51.1275V23.203L153.079 22.2124V20.1841H163.888C164.893 20.1841 165.773 20.3256 166.527 20.6086C167.281 20.8917 167.962 21.3476 168.569 21.9766C169.344 22.7313 169.941 23.769 170.36 25.0898C170.8 26.4105 171.02 27.7313 171.02 29.052C171.02 30.3728 170.8 31.6778 170.36 32.9671C169.941 34.225 169.365 35.2785 168.632 36.1275ZM158.861 36.1747H163.354C164.506 36.1747 165.459 35.6873 166.213 34.7124C166.632 34.1464 166.956 33.3917 167.187 32.4483C167.438 31.4734 167.564 30.4357 167.564 29.3351C167.564 28.2344 167.438 27.2439 167.187 26.3634C166.956 25.4514 166.621 24.7124 166.181 24.1464C165.825 23.7061 165.406 23.3917 164.925 23.203C164.464 23.0143 163.898 22.92 163.228 22.92H158.861V36.1747Z" fill="currentColor"/>
<path d="M174.576 20.1841H193.302V30.0898H191.668L190.663 23.0143H185.51V50.986L188.84 52.1181V54.1464H179.037V52.1181L182.368 50.986V23.0143H177.184L176.21 30.0898H174.576V20.1841Z" fill="currentColor"/>
<path d="M211.548 54.6653C210.312 54.6653 209.181 54.3822 208.154 53.8162C207.149 53.2502 206.311 52.4483 205.641 51.4105L205.295 54.1464H203.536V43.4388H205.452C205.578 46.4263 206.081 48.6118 206.96 49.9954C207.84 51.3791 209.17 52.0709 210.951 52.0709C212.438 52.0709 213.559 51.6464 214.313 50.7973C215.067 49.9168 215.444 48.6275 215.444 46.9294C215.444 45.5772 215.213 44.4451 214.753 43.5332C214.313 42.6212 213.663 41.8036 212.805 41.0803C211.967 40.3571 210.961 39.6495 209.788 38.9577C208.469 38.1401 207.348 37.3382 206.426 36.552C205.505 35.7344 204.803 34.7596 204.321 33.6275C203.86 32.464 203.63 30.9703 203.63 29.1464C203.63 26.159 204.248 23.8319 205.484 22.1653C206.741 20.4986 208.416 19.6653 210.511 19.6653C212.585 19.6653 214.271 20.5458 215.569 22.3068L215.821 20.1841H217.58V30.8917H215.789C215.789 27.8728 215.412 25.6715 214.658 24.2879C213.904 22.9042 212.721 22.2124 211.108 22.2124C208.238 22.2124 206.803 24.1778 206.803 28.1086C206.803 29.1464 206.929 30.0112 207.18 30.703C207.432 31.3634 207.882 31.9766 208.531 32.5426C209.202 33.1086 210.144 33.7847 211.359 34.5709C213.098 35.6715 214.501 36.7407 215.569 37.7785C216.638 38.8162 217.413 39.9483 217.894 41.1747C218.376 42.3697 218.617 43.8005 218.617 45.4671C218.617 47.3854 218.313 49.0363 217.706 50.42C217.119 51.8036 216.292 52.8571 215.224 53.5803C214.176 54.3036 212.951 54.6653 211.548 54.6653Z" fill="currentColor"/>
<path d="M227.717 23.203V51.1275L230.671 52.1181V54.1464H221.622V52.1181L224.575 51.1275V23.203L221.622 22.2124V20.1841H230.671V22.2124L227.717 23.203Z" fill="currentColor"/>
<path d="M239.312 51.3162H244.182C245.313 51.3162 246.276 51.0646 247.072 50.5615C247.889 50.0583 248.56 49.2722 249.083 48.203C249.67 47.1024 250.099 45.6558 250.371 43.8634C250.665 42.0709 250.811 39.9325 250.811 37.4483C250.811 32.5426 250.235 28.8948 249.083 26.5049C248.539 25.3099 247.837 24.4294 246.978 23.8634C246.119 23.2973 245.082 23.0143 243.868 23.0143H239.312V51.3162ZM233.531 20.1841H244.088C247.209 20.1841 249.638 21.5049 251.377 24.1464C252.361 25.6558 253.115 27.5112 253.639 29.7124C254.163 31.9137 254.425 34.2722 254.425 36.7879C254.425 39.4294 254.142 41.9137 253.576 44.2407C253.032 46.5363 252.267 48.4703 251.283 50.0426C249.544 52.7785 247.051 54.1464 243.805 54.1464H233.531V52.1181L236.17 51.1275V23.203L233.531 22.2124V20.1841Z" fill="currentColor"/>
<path d="M270.54 42.92H268.937L268.372 38.1086H263.156V51.3162H272.645L273.619 43.6275H275.441V54.1464H257.061V52.1181L260.014 51.1275V23.203L257.061 22.2124V20.1841H274.75V30.1841H273.116L272.111 22.92H263.156V35.2785H268.372L268.937 30.4671H270.54V42.92Z" fill="currentColor"/>
<path d="M296.102 28.3445C296.102 29.5395 295.913 30.6558 295.536 31.6936C295.18 32.7313 294.688 33.5961 294.059 34.2879C293.431 34.9797 292.708 35.4042 291.892 35.5615V35.7502C293.525 36.2533 294.814 37.291 295.756 38.8634C296.699 40.4357 297.17 42.3697 297.17 44.6653C297.17 46.4263 296.856 48.0615 296.227 49.5709C295.62 51.0489 294.845 52.1495 293.902 52.8728C293.316 53.3131 292.593 53.6432 291.734 53.8634C290.876 54.052 289.671 54.1464 288.121 54.1464H278.727V52.1181L281.366 51.1275V23.203L278.727 22.2124V20.1841H289.284C291.483 20.1841 293.18 20.986 294.374 22.5898C294.918 23.3445 295.337 24.225 295.63 25.2313C295.945 26.2376 296.102 27.2753 296.102 28.3445ZM288.53 37.7785H284.508V51.3162H287.964C288.928 51.3162 289.703 51.2376 290.289 51.0803C290.876 50.9231 291.368 50.6715 291.766 50.3256C292.331 49.8225 292.792 49.0678 293.148 48.0615C293.504 47.0552 293.682 45.8445 293.682 44.4294C293.682 43.2344 293.546 42.1967 293.274 41.3162C293.002 40.4042 292.656 39.681 292.237 39.1464C291.86 38.6747 291.378 38.3288 290.792 38.1086C290.205 37.8885 289.451 37.7785 288.53 37.7785ZM284.508 22.92V35.0426H288.435C289.902 35.0426 290.98 34.4923 291.672 33.3917C291.986 32.8885 292.258 32.2439 292.489 31.4577C292.719 30.6715 292.834 29.791 292.834 28.8162C292.834 27.8414 292.719 26.9766 292.489 26.2219C292.258 25.4357 291.986 24.8068 291.672 24.3351C291.043 23.3917 290.006 22.92 288.561 22.92H284.508Z" fill="currentColor"/>
<path d="M314.952 51.1275L313.098 42.7313H304.678L302.761 51.1275L305.369 52.1181V54.1464H298.017V52.1181L300.593 51.1275L308.134 19.7124H311.056L318.502 51.1275L321.016 52.1181V54.1464H312.375V52.1181L314.952 51.1275ZM308.982 23.9105L305.306 39.9954H312.501L309.108 23.9105H308.982Z" fill="currentColor"/>
<path d="M337.941 36.1275C337.564 36.5678 337.125 36.9451 336.622 37.2596C336.119 37.5741 335.501 37.8414 334.768 38.0615C334.957 38.3445 335.156 38.7061 335.365 39.1464C335.595 39.5866 335.815 40.0741 336.025 40.6086L340.204 51.2219L343 52.1181V54.1464H336.528V52.1181L332.003 38.9105H328.17V51.1275L331.155 52.1181V54.1464H322.389V52.1181L325.028 51.1275V23.203L322.389 22.2124V20.1841H333.197C334.203 20.1841 335.082 20.3256 335.836 20.6086C336.59 20.8917 337.271 21.3476 337.879 21.9766C338.654 22.7313 339.251 23.769 339.67 25.0898C340.109 26.4105 340.329 27.7313 340.329 29.052C340.329 30.3728 340.109 31.6778 339.67 32.9671C339.251 34.225 338.675 35.2785 337.941 36.1275ZM328.17 36.1747H332.663C333.815 36.1747 334.768 35.6873 335.522 34.7124C335.941 34.1464 336.266 33.3917 336.496 32.4483C336.748 31.4734 336.873 30.4357 336.873 29.3351C336.873 28.2344 336.748 27.2439 336.496 26.3634C336.266 25.4514 335.931 24.7124 335.491 24.1464C335.135 23.7061 334.716 23.3917 334.234 23.203C333.773 23.0143 333.208 22.92 332.537 22.92H328.17V36.1747Z" fill="currentColor"/>
</svg>
          </a>
        </div>

        <!-- Header search -->
        <div class="${searchWrapClass}">
          <form id="navbarHeaderSearchForm" class="${searchFormClass}">
            <label class="relative block min-w-0">
              <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0"/>
              </svg>
              <input id="${searchInputId}" type="search" placeholder="Search..."
                class="w-full min-w-0 h-10 pl-10 pr-4 rounded-full bg-[#F2F5F9]/80 dark:bg-[#262626]/80 border-0 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all">
              ${autocompleteHtml}
            </label>
          </form>
        </div>

        <!-- Right side -->
        <div class="flex items-center gap-1 flex-shrink-0">
          <div class="hidden lg:flex items-center gap-1">
          <a href="/aitopia/marketplace/agents.html" class="h-10 px-4 flex items-center justify-center gap-2 rounded-full hover:bg-secondary text-[14px] font-medium leading-5 transition-colors">
            <img src="https://aitopia.ai/icons/agents.svg" alt="" class="w-5 h-5 dark:invert" />
            Agents
          </a>
          <a href="/aitopia/marketplace/models.html" class="h-10 px-4 flex items-center justify-center gap-2 rounded-full hover:bg-secondary text-[14px] font-medium leading-5 transition-colors">
            <img src="https://aitopia.ai/icons/models.svg" alt="" class="w-5 h-5 dark:invert" />
            Models
          </a>
          <a href="/aitopia/marketplace/outputs.html" class="h-10 px-4 flex items-center justify-center gap-2 rounded-full hover:bg-secondary text-[14px] font-medium leading-5 transition-colors">
            <img src="https://aitopia.ai/icons/community.svg" alt="" class="w-5 h-5 dark:invert" />
            Community
          </a>
          <a href="/aitopia/marketplace/pricing.html" id="nav-pricing-link" class="h-10 px-4 flex items-center justify-center gap-2 rounded-full hover:bg-secondary text-[14px] font-medium leading-5 transition-colors">
            <img src="https://aitopia.ai/icons/pricing.svg" alt="" class="w-5 h-5 dark:invert" />
            Pricing
          </a>
          </div>

          <div class="hidden lg:flex items-center justify-end gap-0.5 w-[130px] flex-shrink-0 ml-4">
            <!-- Credits Display -->
            <div id="creditsDisplay" class="hidden items-center gap-0.5 px-2 py-1.5 bg-primary/10 rounded-full w-[80px] flex-shrink-0 opacity-0 pointer-events-none">
              <svg class="w-4 h-4 text-primary/90 dark:text-primary flex-shrink-0" fill="currentColor" viewBox="0 0 14 14" xmlns="http://www.w3.org/2000/svg">
                <path d="M4.48963 7.68204H5.79855V11.5184C5.79855 12.0831 6.3577 12.3496 6.65422 11.9233L9.86088 7.34104C10.1405 6.94142 9.91595 6.31802 9.49235 6.31802H8.18342V2.48171C8.18342 1.91692 7.62426 1.65051 7.32774 2.07676L4.1211 6.65903C3.84576 7.05864 4.07026 7.68204 4.48963 7.68204Z"/>
              </svg>
              <span id="creditsAmount" class="text-sm font-semibold text-primary/90 dark:text-primary relative flex-1 text-right min-w-0">
                <span class="credits-shimmer inline-block">—</span>
              </span>
            </div>

            <!-- Login Button (shown when not logged in) -->
            <a href="/aitopia/marketplace/login.html" id="loginBtn" class="hidden h-10 px-4 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium transition-colors hover:bg-primary/90">
              Sign in
            </a>

            <!-- Profile Dropdown (shown when logged in) -->
            <div class="relative hidden" id="profileDropdown">
            <button data-action="NavbarComponent.toggleProfileDropdown" class="flex items-center gap-2 h-10 px-3 rounded-full transition-colors btn-press cursor-pointer" aria-label="Profile menu">
              <div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <svg class="w-4 h-4 text-primary/90 dark:text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
            </button>
            <div id="profileMenu" class="hidden absolute right-0 top-full mt-2 w-56 bg-card border border-border rounded-xl shadow-xl z-50 py-1 overflow-hidden">
              <!-- User info header -->
              <div id="profileHeader" class="px-4 py-3 border-b border-border">
                <div class="flex items-center justify-between gap-2">
                  <p id="profileName" class="text-sm font-medium truncate"></p>
                  <span id="profilePlanBadge" class="px-2 py-0.5 text-[10px] font-semibold uppercase rounded-full bg-primary/5 text-primary"></span>
                </div>
                <p id="profileEmailFull" class="text-xs text-muted-foreground truncate mt-0.5"></p>
                <a id="profileUpgradeBtn" href="/aitopia/marketplace/pricing.html" class="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-[#9335EC] to-fuchsia-500 text-white hover:opacity-90 transition-opacity">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                    <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
                  </svg>
                  Upgrade
                </a>
              </div>
              <a id="profileLink" href="/aitopia/marketplace/settings-profile.html" class="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted transition-colors cursor-pointer">
                <svg class="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                Profile
              </a>
              <a href="/aitopia/marketplace/outputs.html" class="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted transition-colors cursor-pointer">
                <svg class="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                  <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
                Creations
              </a>
              <!--
              <a href="/aitopia/marketplace/create.html" class="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted transition-colors cursor-pointer">
                <svg class="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                  <path d="M12 4v16m8-8H4"/>
                </svg>
                Create
              </a>
              <a href="/aitopia/marketplace/feed.html" class="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted transition-colors cursor-pointer">
                <svg class="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                  <path d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2"/>
                </svg>
                Feed
              </a>
              <a href="/aitopia/marketplace/discover.html" class="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted transition-colors cursor-pointer">
                <svg class="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
                </svg>
                Discover
              </a>
              -->
              <a href="/aitopia/marketplace/earnings.html" class="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted transition-colors cursor-pointer">
                <svg class="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                  <line x1="12" y1="1" x2="12" y2="23"/>
                  <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
                </svg>
                Earnings
              </a>
              <a id="profileDeveloperLink" href="/aitopia/marketplace/developers-dashboard.html" class="hidden items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted transition-colors cursor-pointer">
                <svg class="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                  <rect x="3" y="3" width="7" height="7" rx="1"/>
                  <rect x="14" y="3" width="7" height="7" rx="1"/>
                  <rect x="3" y="14" width="7" height="7" rx="1"/>
                  <rect x="14" y="14" width="7" height="7" rx="1"/>
                </svg>
                Developer Dashboard
              </a>
              <!--
              <a href="https://chat.aitopia.ai/app/profile" class="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted transition-colors cursor-pointer">
                <svg class="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                My Account
              </a>
              <a href="https://chat.aitopia.ai/subscription" class="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted transition-colors cursor-pointer">
                <svg class="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                  <line x1="12" y1="22.08" x2="12" y2="12"/>
                </svg>
                My Plan
              </a>
              <a href="https://chat.aitopia.ai/src/html/options.html?mode=contact" class="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted transition-colors cursor-pointer">
                <svg class="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                Feedback
              </a>
              -->
              <div class="border-t border-border my-1"></div>
              <button data-action="NavbarComponent.handleLogout" class="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted transition-colors text-red-500 cursor-pointer">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Logout
              </button>
            </div>
          </div>
          </div>

          <!-- Mobile Pricing button -->
          <div id="mobile-pricing-btn-wrap" class="lg:hidden relative">
            <a href="/aitopia/marketplace/pricing.html" class="h-10 px-4 flex items-center justify-center rounded-full border border-border text-sm font-medium whitespace-nowrap hover:bg-secondary transition-colors">
              Pricing
            </a>
            <span id="mobile-pricing-badge" style="display:none;position:absolute;bottom:0;left:50%;transform:translate(-50%,50%);font-size:10px;font-weight:700;color:var(--promo-nav-badge-text);background:var(--promo-nav-badge-bg);border-radius:100px;padding:1px 7px;white-space:nowrap;letter-spacing:0.03em;pointer-events:none;z-index:10;"></span>
          </div>

          <!-- Mobile notifications (always in DOM — avoids race condition with global-nav.js) -->
          <button id="mobileNotificationsBtn" type="button" class="hidden relative h-10 w-10 items-center justify-center rounded-full hover:bg-secondary transition-colors btn-press lg:hidden" aria-label="Notifications">
            <svg class="w-5 h-5 text-foreground/80" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 01-3.46 0"/>
            </svg>
            <span id="mobileNotificationsBadge" class="hidden absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-extrabold flex items-center justify-center">0</span>
          </button>

          <!-- Notifications (shown when logged in, desktop) -->
          <button id="notificationsBtn" type="button" class="hidden max-lg:hidden lg:flex relative h-10 w-10 items-center justify-center rounded-full hover:bg-secondary transition-colors btn-press" aria-label="Notifications">
            <svg class="w-5 h-5 text-foreground/80" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
              <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 01-3.46 0"/>
            </svg>
            <span id="notificationsBadge" class="hidden absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-extrabold flex items-center justify-center">0</span>
          </button>

          <!-- Dark Mode Toggle (desktop only — inside hamburger drawer on mobile) -->
          <button data-action="NavbarComponent.toggleTheme" class="hidden lg:flex w-10 h-10 rounded-full items-center justify-center hover:bg-secondary transition-colors btn-press" aria-label="Toggle theme">
            <svg class="w-5 h-5 dark:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-width="2" d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
            <svg class="w-5 h-5 hidden dark:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="5" stroke-width="2"/>
              <path stroke-width="2" d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
    <span id="nav-pricing-badge" style="display:none;position:absolute;bottom:0;transform:translate(-50%,50%);font-size:10px;font-weight:700;color:var(--promo-nav-badge-text);background:var(--promo-nav-badge-bg);border-radius:100px;padding:1px 7px;white-space:nowrap;letter-spacing:0.03em;pointer-events:none;z-index:10;"></span>
  </header>
    `;
  }

  window.NavbarComponent = {
    startQueuePolling: startQueuePolling,
    stopQueuePolling: stopQueuePolling,

    showRunToast: function(agentLabel, url) {
      showJobToast(`${agentLabel} added to queue`, 'success', url);
    },

    incrementNotificationBadge: function(delta) {
      const n = Math.max(1, Math.trunc(Number(delta) || 1));
      const badge = document.getElementById('notificationsBadge');
      const current = badge ? parseInt(badge.textContent, 10) || 0 : 0;
      setNotificationsBadge(current + n);
    },

    invalidateCreditsCache: function(refresh = true) {
      window.AitopiaCache?.remove?.(window.AitopiaCache?.KEYS?.USER_CREDITS);
      if (refresh) {
        this.loadUserCredits();
      }
    },

    decrementCreditsOptimistic: function(deltaCredits) {
      const delta = Math.max(0, Math.trunc(Number(deltaCredits) || 0));
      if (!delta) return;

      const creditsAmount = document.getElementById('creditsAmount');
      const creditsShimmer = creditsAmount?.querySelector('.credits-shimmer');

      const currentCached = getUserCredits();
      const current =
        typeof currentCached === 'number' && Number.isFinite(currentCached)
          ? currentCached
          : (() => {
              const raw = creditsShimmer?.textContent ? String(creditsShimmer.textContent).trim() : '';
              const parsed = raw ? Number.parseInt(raw.replace(/[^0-9]/g, ''), 10) : NaN;
              return Number.isFinite(parsed) ? parsed : null;
            })();

      if (current === null) return;

      const next = Math.max(0, current - delta);
      setUserCredits(next);

      if (creditsShimmer) {
        creditsShimmer.textContent = String(next);
        creditsShimmer.classList.add('loaded');
      }
    },

    toggleTheme: function() {
      const html = document.documentElement;
      const isDark = html.classList.contains('dark');
      if (isDark) {
        html.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      } else {
        html.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      }
      if (typeof window.injectHeaderCss == 'function') window.injectHeaderCss();
    },

    toggleProfileDropdown: function() {
      const menu = document.getElementById('profileMenu');
      if (menu) menu.classList.toggle('hidden');
    },

    handleLogout: async function() {
      try {
        clearUserCache();
        stopQueuePolling();
        await fetch('https://aitopia.ai/auth/logout', { method: 'POST', credentials: 'include' });
      } catch (e) {
        console.error('Logout error:', e);
      }
      window.location.reload();
    },

    loadUserProfile: async function() {
      const loginBtn = document.getElementById('loginBtn');
      const notificationsBtn = document.getElementById('notificationsBtn');
      const profileDropdown = document.getElementById('profileDropdown');
      const creditsDisplay = document.getElementById('creditsDisplay');
      const profileName = document.getElementById('profileName');
      const profileEmailFull = document.getElementById('profileEmailFull');
      const profilePlanBadge = document.getElementById('profilePlanBadge');
      const profileDeveloperLink = document.getElementById('profileDeveloperLink');

      const setDeveloperLinkVisible = (visible) => {
        if (!profileDeveloperLink) return;
        if (visible) {
          profileDeveloperLink.classList.remove('hidden');
          profileDeveloperLink.classList.add('flex');
          return;
        }
        profileDeveloperLink.classList.add('hidden');
        profileDeveloperLink.classList.remove('flex');
      };

      const updateUI = (profileData) => {
        // Fresh lookup — global-nav.js may create this element after navbar.js init
        const mobileNotifBtn = document.getElementById('mobileNotificationsBtn');

        if (!profileData) {
          if (loginBtn) {
            loginBtn.classList.remove('hidden');
            loginBtn.classList.add('flex');
          }
          if (notificationsBtn) {
            notificationsBtn.classList.add('hidden');
            notificationsBtn.classList.remove('flex');
          }
          if (mobileNotifBtn) {
            mobileNotifBtn.classList.add('hidden');
            mobileNotifBtn.classList.remove('flex');
          }
          if (profileDropdown) profileDropdown.classList.add('hidden');
          if (creditsDisplay) {
            creditsDisplay.classList.add('hidden', 'opacity-0', 'pointer-events-none');
            creditsDisplay.classList.remove('flex', 'opacity-100');
          }
          setDeveloperLinkVisible(false);
          developerStatusPromise = null;
          stopNotificationsPolling();
          return;
        }

        const { fullName, email, plan } = profileData;
        if (loginBtn) {
          loginBtn.classList.add('hidden');
          loginBtn.classList.remove('flex');
        }
        if (notificationsBtn) {
          notificationsBtn.classList.remove('hidden');
          notificationsBtn.classList.add('flex');
        }
        if (mobileNotifBtn) {
          mobileNotifBtn.classList.remove('hidden');
          mobileNotifBtn.classList.add('flex');
        }
        if (profileDropdown) profileDropdown.classList.remove('hidden');
        if (creditsDisplay) {
          creditsDisplay.classList.remove('hidden', 'opacity-0', 'pointer-events-none');
          creditsDisplay.classList.add('flex', 'opacity-100');
        }
        if (profileName) profileName.textContent = fullName;
        if (profileEmailFull) profileEmailFull.textContent = email;
        if (profilePlanBadge && plan) {
          profilePlanBadge.textContent = plan.toUpperCase();
        }
        setDeveloperLinkVisible(false);
        void fetchIsDeveloper().then((isDeveloper) => {
          setDeveloperLinkVisible(Boolean(isDeveloper));
        });
        // Fetch notification badge FIRST, then check queue
        loadUnreadNotificationsCount().finally(() => {
          startNotificationsPolling();
          // Check if there are active queue jobs on login
          fetch('https://aitopia.ai/api/queue?limit=5', { method: 'GET', credentials: 'include', headers: { Accept: 'application/json' } })
            .then(r => r.ok ? r.json() : null)
            .then(json => {
              const items = Array.isArray(json?.items) ? json.items : [];
              if (items.some(i => i.status === 'pending' || i.status === 'processing')) {
                startQueuePolling();
              }
            })
            .catch(() => {});
        });
      };

      const cached = getUserProfile();
      if (cached) {
        updateUI(cached);
        this.loadUserCredits();
        this.loadSocialProfile();
        return;
      }
      try {
        const aitopia_response = await fetch(
          "https://extensions.aitopia.ai/extensions/app/key",
          { method: "GET", credentials: "include" },
        );
        if (aitopia_response?.key) {
          document.cookie = `hopekey=${aitopia_response?.key}; expires=${365 * 24 * 60 * 60 * 1000}; path=/; Secure; SameSite=None; Domain=.aitopia.ai`;
        }
      } catch (e) {}
      try {
        const response = await fetch('https://aitopia.ai/auth/me', { method: 'GET', credentials: 'include' });
        if (response.ok) {
          const resp = await response.json();
          const userData = resp?.data?.user || resp?.data || resp?.user || resp;
          const isLoggedIn = userData && !Array.isArray(userData) && typeof userData === 'object' && (userData.email || userData.key);

          if (isLoggedIn) {
            const email = userData.email || '';
            const name = userData.name || '';
            const lastname = userData.lastname || '';
            const fullName = [name, lastname].filter(Boolean).join(' ') || (email ? email.split('@')[0] : 'User');
            const plan = resp?.data?.plan || resp?.data?.licences?.plan_type || userData.plan || userData.planName || '';
            const licences = resp?.data?.licences || null;

            const profileData = { fullName, email, plan, licences };
            setUserProfile(profileData);
            updateUI(profileData);
            this.loadUserCredits();
            this.loadSocialProfile();
            // Hide promo elements for creator plan users
            if (String(plan || '').toLowerCase() === 'creator') {
              document.getElementById('nav-pricing-badge')?.style?.setProperty('display', 'none', 'important');
              document.getElementById('mobile-pricing-badge')?.style?.setProperty('display', 'none', 'important');
              const promoBar = document.getElementById('promo-announcement-bar');
              if (promoBar) promoBar.style.display = 'none';
              localStorage.removeItem('promo_bar_active');
            }
            return;
          }
        }
      } catch (e) {
      }

      updateUI(null);
    },

    loadUserCredits: async function() {
      const creditsAmount = document.getElementById('creditsAmount');
      const creditsShimmer = creditsAmount?.querySelector('.credits-shimmer');

      const updateCreditsUI = (credits, animate = false) => {
        if (creditsShimmer) {
          creditsShimmer.textContent = credits !== null ? String(credits) : '—';
          if (animate) {
            setTimeout(() => creditsShimmer.classList.add('loaded'), 300);
          } else {
            creditsShimmer.classList.add('loaded');
          }
        }
      };

      const cached = getUserCredits();
      if (cached !== null) {
        updateCreditsUI(cached, false);
        return;
      }
      if (creditsShimmer) {
        creditsShimmer.classList.remove('loaded');
      }

      try {
        let balanceData;
        if (window.AitopiaCredits?.loadCreditsBalance) {
          balanceData = await window.AitopiaCredits.loadCreditsBalance();
        } else {
          const res = await fetch('https://aitopia.ai/api/credits/balance', { credentials: 'include' });
          if (res.ok) balanceData = await res.json();
        }
        if (!balanceData?.balance) {
          updateCreditsUI(null, true);
          return;
        }
        const totalCredits = balanceData.balance.totalCredits ?? balanceData.balance.totalCreditsRemaining ?? 0;

        setUserCredits(totalCredits);
        updateCreditsUI(totalCredits, true);
      } catch (e) {
        updateCreditsUI(null, true);
      }
    },

    loadSocialProfile: async function() {
      try {
        const res = await fetch('https://aitopia.ai/api/users/me', { method: 'GET', credentials: 'include' });
        if (!res.ok) return;
        const json = await res.json();
        const username = json?.profile?.username;
        if (username) {
          const profileLink = document.getElementById('profileLink');
          if (profileLink) {
            profileLink.href = `/aitopia/marketplace/profile.html?username=${encodeURIComponent(username)}`;
          }
        }
      } catch (e) {
        // Ignore errors
      }
    },

    init: function() {
      const container = document.getElementById('navbar-container');
      const notificationsBtn = document.getElementById('notificationsBtn');

      if (!container) {
        if (notificationsBtn) {
          notificationsBtn.addEventListener('click', () => void openNotificationsModal());
          window.AitopiaNavbarNotifications = {
            startPolling: startNotificationsPolling,
            stopPolling: stopNotificationsPolling,
            openModal: openNotificationsModal,
          };
        } else {
          console.warn('NavbarComponent: #navbar-container not found');
        }
        return;
      }

      container.innerHTML = getNavbarHTML();
      initPromoBar();
      var ctx = getHeaderSearchContext();
      if (ctx && ctx.linkedInputId && !document.getElementById(ctx.linkedInputId)) {
        document.addEventListener('DOMContentLoaded', function () { bindHeaderSearch(); }, { once: true });
      } else {
        bindHeaderSearch();
      }
      try {
        document.documentElement.classList.remove('global-nav-loading');
        document.documentElement.classList.add('global-nav-ready');
      } catch {}

      this.loadUserProfile();

      document.getElementById('notificationsBtn')?.addEventListener('click', () => void openNotificationsModal());
      document.getElementById('mobileNotificationsBtn')?.addEventListener('click', () => void openNotificationsModal());
      try {
        const url = new URL(window.location.href);
        const shouldOpen = url.searchParams.get('openNotifications');
        if (shouldOpen === '1' || shouldOpen === 'true') {
          url.searchParams.delete('openNotifications');
          const nextSearch = url.searchParams.toString();
          window.history.replaceState({}, '', `${url.pathname}${nextSearch ? `?${nextSearch}` : ''}${url.hash || ''}`);
          void openNotificationsModal();
        }
      } catch {}

      window.addEventListener('aifnmjmchg-credits-updated', (e) => {
        const totalCredits = e.detail?.balance?.totalCredits ?? e.detail?.balance?.totalCreditsRemaining;
        if (typeof totalCredits === 'number') {
          setUserCredits(totalCredits);
          const creditsShimmer = document.getElementById('creditsAmount')?.querySelector('.credits-shimmer');
          if (creditsShimmer) {
            creditsShimmer.textContent = String(totalCredits);
            creditsShimmer.classList.add('loaded');
          }
        }
      });

      document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('profileDropdown');
        if (dropdown && !dropdown.contains(e.target)) {
          const menu = document.getElementById('profileMenu');
          if (menu) menu.classList.add('hidden');
        }
      });
    }
  };

  window.toggleTheme = window.NavbarComponent.toggleTheme;
  window.handleLogout = window.NavbarComponent.handleLogout;
  window.toggleProfileDropdown = window.NavbarComponent.toggleProfileDropdown;

  function initPromoBar() {
    function applyPromoBar(cfg) {
      const text       = cfg.text         || 'NanoBanana 2 UNLIMITED on Premium. Nano Banana Pro 2K & Seedream 4.5K generations.';
      const ctaText    = cfg.ctaText      || 'Personal %52 OFF';
      const ctaHref    = cfg.ctaHref      || '/aitopia/marketplace/pricing.html';
      const badgeText  = cfg.badgeText    || '%52 OFF';
      const durationMs = (cfg.durationHours ?? 3) * 3600000;

      const textEl  = document.getElementById('promo-bar-text');
      const ctaEl   = document.getElementById('promo-bar-cta');
      const timerEl = document.getElementById('promo-bar-timer');
      const cachedPlan = (getUserProfile()?.plan || '').toLowerCase();
      const hidePromo = cachedPlan === 'creator';
      const badgeEl = document.getElementById('nav-pricing-badge');
      if (badgeEl) badgeEl.textContent = badgeText;
      const mobileBadge = document.getElementById('mobile-pricing-badge');
      if (mobileBadge && !hidePromo) { mobileBadge.textContent = badgeText; mobileBadge.style.display = 'inline-block'; }
      if (!hidePromo) _positionPricingBadge();

      if (textEl) textEl.textContent = text;
      if (ctaEl) { ctaEl.textContent = ctaText; ctaEl.href = ctaHref; }

      // Enable marquee when content overflows the bar width
      requestAnimationFrame(function () {
        const inner = document.getElementById('promo-bar-inner');
        const outer = document.getElementById('promo-announcement-bar');
        if (!inner || !outer || inner.scrollWidth <= outer.clientWidth) return;
        // Duplicate content for seamless loop
        outer.style.textAlign = 'left';
        const sep = '<span style="display:inline-block;width:48px;flex-shrink:0;" aria-hidden="true"></span>';
        const original = inner.innerHTML;
        inner.innerHTML = original + sep + original + sep;
        inner.style.animation = 'promo-marquee 22s linear infinite';
      });

      if (!document.getElementById('promo-bar-timer')) return;

      const STORAGE_KEY = 'promo_expiry';
      let endMs = parseInt(localStorage.getItem(STORAGE_KEY), 10);
      if (!endMs || endMs < Date.now()) {
        endMs = Date.now() + durationMs;
        localStorage.setItem(STORAGE_KEY, endMs);
      }

      function fmt(n) { return String(n).padStart(2, '0'); }
      function tick() {
        const rem = Math.max(0, endMs - Date.now());
        const h = Math.floor(rem / 3600000);
        const m = Math.floor((rem % 3600000) / 60000);
        const s = Math.floor((rem % 60000) / 1000);
        const text = `${fmt(h)}h ${fmt(m)}m ${fmt(s)}s`;
        document.querySelectorAll('#promo-bar-timer').forEach(function (el) { el.textContent = text; });
        if (rem === 0) {
          endMs = Date.now() + durationMs;
          localStorage.setItem('promo_expiry', endMs);
        }
      }
      tick();
      setInterval(tick, 1000);
    }

    fetch('https://aitopia.ai/store/promo-config.json')
      .then(function (r) { return r.ok ? r.json() : {}; })
      .catch(function () { return {}; })
      .then(applyPromoBar);
  }

  function runInit() {
    if (window.__AITOPIA_NAVBAR_INIT_DONE__) return;
    window.__AITOPIA_NAVBAR_INIT_DONE__ = true;
    window.NavbarComponent.init();
    setUrlCookie();
    window.dismissPromoBar = function () {
      const bar = document.getElementById('promo-announcement-bar');
      if (bar) bar.style.display = 'none';
      localStorage.setItem('promo_bar_dismissed', '1');
      localStorage.removeItem('promo_bar_active');
    };
    if (localStorage.getItem('promo_bar_active') && !localStorage.getItem('promo_bar_dismissed')) {
      const bar = document.getElementById('promo-announcement-bar');
      if (bar) bar.style.display = '';
    }
  }
  if (document.getElementById('navbar-container')) {
    runInit();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runInit);
  } else {
    runInit();
  }


  function _positionPricingBadge() {
    const badge = document.getElementById('nav-pricing-badge');
    const link = document.getElementById('nav-pricing-link');
    const header = document.getElementById('header');
    if (!badge || !link || !header) return;
    const linkRect = link.getBoundingClientRect();
    if (linkRect.width === 0) {
      badge.style.display = 'none';
      return;
    }
    const headerRect = header.getBoundingClientRect();
    const centerX = linkRect.left + linkRect.width / 2 - headerRect.left;
    badge.style.left = centerX + 'px';
    badge.style.display = 'inline-block';
  }

  window.showNavPricingBadge = function () {
    _positionPricingBadge();
  };

  window.addEventListener('resize', () => {
    const badge = document.getElementById('nav-pricing-badge');
    if (badge) _positionPricingBadge();
  });

})();
