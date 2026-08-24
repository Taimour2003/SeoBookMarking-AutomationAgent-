(function () {
	function setReady(fn) {
		if (document.readyState === 'loading') {
			document.addEventListener('DOMContentLoaded', fn, { once: true });
			return;
		}
		fn();
	}

	function normalizeMediaPath(value) {
		if (!value || typeof value !== 'string') return null;
		if (value.startsWith('http://') || value.startsWith('https://')) return value;
		if (value.startsWith('./')) return value.slice(1);
		if (value.startsWith('/')) return value;
		return `/${value}`;
	}

	function isVideoUrl(value) {
		if (!value || typeof value !== 'string') return false;
		return /\.(mp4|webm|mov)(?:$|\?)/i.test(value);
	}

	function prefersReducedMotion() {
		try {
			return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
		} catch {
			return false;
		}
	}

	const reducedMotion = prefersReducedMotion();

	let visibilityObserver = null;
	const observedVideos = new WeakSet();

	function ensurePreviewVideoAutoplay(video) {
		if (!video || typeof video !== 'object') return;

		video.muted = true;
		video.loop = true;
		video.autoplay = true;
		video.playsInline = true;
		video.setAttribute('playsinline', '');

		if (!video.preload) video.preload = 'metadata';

		if (reducedMotion) {
			video.autoplay = false;
			video.removeAttribute('autoplay');
			try {
				video.pause();
			} catch {
				// ignore
			}
			return;
		}

		if (typeof IntersectionObserver === 'undefined') {
			video.play?.().catch?.(() => {});
			return;
		}

		if (!visibilityObserver) {
			visibilityObserver = new IntersectionObserver((entries) => {
				for (const entry of entries) {
					const target = entry.target;
					if (!target || typeof target.play !== 'function') continue;
					if (entry.isIntersecting) {
						target.play().catch(() => {});
					} else {
						target.pause();
					}
				}
			}, { threshold: 0.25 });
		}

		if (observedVideos.has(video)) return;
		observedVideos.add(video);
		visibilityObserver.observe(video);
	}

	function getThumbMedia(el) {
		if (!el) return null;

		const srcAttr = el.getAttribute?.('data-aifnmjmchg-media-src');
		const typeAttr = el.getAttribute?.('data-aifnmjmchg-media-type');
		if (srcAttr && typeAttr) {
			return { src: srcAttr, type: typeAttr };
		}

		const video = el.querySelector?.('video');
		if (video) {
			const src = video.getAttribute?.('src') || video.src;
			if (typeof src === 'string' && src.trim()) return { src, type: 'video' };
		}

		const img = el.querySelector?.('img');
		if (img) {
			const src = img.getAttribute?.('src') || img.src;
			if (typeof src === 'string' && src.trim()) return { src, type: 'image' };
		}

		return null;
	}

	function setMainMedia(main, media) {
		if (!main || !media || !media.src) return;

		const src = String(media.src);
		const type = media.type === 'video' ? 'video' : 'image';
		const current = main.querySelector('img, video');

		if (type === 'video') {
			if (current && current.tagName.toLowerCase() === 'video') {
				current.src = src;
				current.load?.();
				current.controls = true;
				ensurePreviewVideoAutoplay(current);
				return;
			}

			const video = document.createElement('video');
			video.className = current?.className || 'w-full h-full object-cover';
			video.controls = true;
			video.src = src;
			ensurePreviewVideoAutoplay(video);
			if (current?.replaceWith) current.replaceWith(video);
			else {
				main.innerHTML = '';
				main.appendChild(video);
			}
			return;
		}

		if (current && current.tagName.toLowerCase() === 'img') {
			current.src = src;
			return;
		}

		const img = document.createElement('img');
		img.className = current?.className || 'w-full h-full object-cover';
		img.alt = '';
		img.src = src;
		if (current?.replaceWith) current.replaceWith(img);
		else {
			main.innerHTML = '';
			main.appendChild(img);
		}
	}

	function buildMediaItems({ icon, featured, videos, images }) {
		const items = [];
		const seen = new Set();

		const push = (url) => {
			if (!url || typeof url !== 'string') return;
			if (seen.has(url)) return;
			seen.add(url);
			items.push({ src: url, type: isVideoUrl(url) ? 'video' : 'image' });
		};

		push(featured);
		(videos || []).forEach(push);
		(images || []).forEach(push);
		push(icon);

		return items;
	}

	function getAgentIdFromPage() {
		const fromRunner = window.__AITOPIA_AGENT_RUN__?.agentId;
		if (typeof fromRunner === 'string' && fromRunner.trim()) return fromRunner.trim();

		const path = window.location?.pathname || '';
		const match = path.match(/^\/agents\/([^/?#]+)/);
		if (!match) return null;
		try {
			return decodeURIComponent(match[1]);
		} catch {
			return match[1];
		}
	}

	async function hydrateAgentShowcaseFromSource() {
		const agentId = getAgentIdFromPage();
		if (!agentId) return;

		let showcaseData;
		try {
			const res = await fetch('https://aitopia.ai/agent-showcase-data.json', { cache: 'no-cache' });
			if (!res.ok) return;
			showcaseData = await res.json();
		} catch {
			return;
		}

		if (!Array.isArray(showcaseData)) return;
		const entry = showcaseData.find((item) => item && item.id === agentId);
		if (!entry) return;

		const icon = normalizeMediaPath(entry.icon);
		const showcaseImages = Array.isArray(entry.showcase_images)
			? entry.showcase_images.map(normalizeMediaPath).filter(Boolean)
			: [];
		const showcaseVideos = Array.isArray(entry.showcase_videos)
			? entry.showcase_videos.map(normalizeMediaPath).filter(Boolean)
			: [];
		const featuredVideo = normalizeMediaPath(entry.featured_video);
		const bestMain = featuredVideo || showcaseVideos[0] || showcaseImages[0] || icon;
		const mediaItems = buildMediaItems({
			icon,
			featured: featuredVideo,
			videos: showcaseVideos,
			images: showcaseImages,
		});

		const description = typeof entry.description === 'string' ? entry.description.trim() : '';

		if (icon) {
			const headerH1 = document.querySelector('article h1');
			const header = headerH1?.closest?.('div.flex.items-start.gap-4');
			const headerImg = header?.querySelector?.('img');
			if (headerImg) headerImg.src = icon;
		}

		if (description) {
			const desc = document.querySelector('article p.text-gray-300.leading-relaxed');
			if (desc) desc.textContent = description;
		}

		const mediaSections = document.querySelectorAll('article .space-y-4');
		for (const section of mediaSections) {
			const main = section.querySelector('.aspect-video');
			if (!main) continue;

			if (bestMain) setMainMedia(main, { src: bestMain, type: isVideoUrl(bestMain) ? 'video' : 'image' });

			const thumbStrip = section.querySelector('.hide-scrollbar');
			if (!thumbStrip) continue;
			if (mediaItems.length < 2) continue;

			thumbStrip.innerHTML = '';
			mediaItems.slice(0, 5).forEach((item, index) => {
				const wrap = document.createElement('div');
				wrap.className = [
					'w-20 h-20 rounded-ios-lg overflow-hidden flex-shrink-0 transition-opacity cursor-pointer',
					index === 0 ? 'ring-2 ring-primary/90' : 'opacity-70 hover:opacity-100',
				].join(' ');
				wrap.setAttribute('data-aifnmjmchg-media-src', item.src);
				wrap.setAttribute('data-aifnmjmchg-media-type', item.type);

				if (item.type === 'video') {
					const video = document.createElement('video');
					video.src = item.src;
					video.className = 'w-full h-full object-cover pointer-events-none';
					ensurePreviewVideoAutoplay(video);
					wrap.appendChild(video);
				} else {
					const img = document.createElement('img');
					img.src = item.src;
					img.alt = '';
					img.loading = 'lazy';
					img.className = 'w-full h-full object-cover';
					wrap.appendChild(img);
				}
				thumbStrip.appendChild(wrap);
			});
		}
	}

	function initShowcaseThumbnailGalleries() {
		const mediaSections = document.querySelectorAll('article .space-y-4');
		for (const section of mediaSections) {
			const main = section.querySelector('.aspect-video');
			const thumbStrip = section.querySelector('.hide-scrollbar');
			if (!main) continue;

			const mainVideo = main.querySelector?.('video');
			if (mainVideo) ensurePreviewVideoAutoplay(mainVideo);

			if (!thumbStrip) continue;

			const thumbItems = Array.from(thumbStrip.children).filter((el) => el?.classList?.contains('cursor-pointer'));
			if (thumbItems.length < 2) continue;

			const setActive = (activeIndex) => {
				for (const [index, item] of thumbItems.entries()) {
					const active = index === activeIndex;
					item.classList.toggle('ring-2', active);
					item.classList.toggle('ring-primary/90', active);
					if (active) item.classList.remove('opacity-70');
					else item.classList.add('opacity-70');
				}

				const media = getThumbMedia(thumbItems[activeIndex]);
				if (!media) return;
				setMainMedia(main, media);
			};

			thumbItems.forEach((item, index) => {
				if (item.getAttribute('data-aifnmjmchg-showcase-init') === '1') return;
				item.setAttribute('data-aifnmjmchg-showcase-init', '1');

				item.setAttribute('role', 'button');
				item.setAttribute('tabindex', '0');
				item.setAttribute('aria-label', `Showcase ${index + 1}`);

				if (item.hasAttribute('onclick')) item.removeAttribute('onclick');

				const thumbVideo = item.querySelector?.('video');
				if (thumbVideo) ensurePreviewVideoAutoplay(thumbVideo);

				item.addEventListener('click', () => setActive(index));
				item.addEventListener('keydown', (e) => {
					if (e.key !== 'Enter' && e.key !== ' ') return;
					e.preventDefault();
					setActive(index);
				});
			});
		}
	}

	function initBreadcrumbCategoryRedirects() {
		const nav = document.querySelector('nav[aria-label="Breadcrumb"]');
		if (!nav) return;

		const isPlainLeftClick = (event) => (
			event?.button === 0 &&
			!event?.defaultPrevented &&
			!event?.metaKey &&
			!event?.ctrlKey &&
			!event?.shiftKey &&
			!event?.altKey
		);

		const navigate = (url) => {
			if (typeof window.__AITOPIA_NAVIGATE__ === 'function') {
				window.__AITOPIA_NAVIGATE__(url);
				return;
			}
			window.location.href = url;
		};

		nav.addEventListener('click', (event) => {
			if (!isPlainLeftClick(event)) return;

			const anchor = event.target?.closest?.('a');
			if (!anchor || !nav.contains(anchor)) return;

			const href = anchor.getAttribute('href') || '';
			if (!href.startsWith('/category/')) return;

			const match = href.match(/^\/category\/([^/?#]+)/);
			if (!match) return;

			let category = match[1];
			try {
				category = decodeURIComponent(category);
			} catch {
				// Ignore malformed escape sequences.
			}

			event.preventDefault();
			navigate(`/agents?category=${encodeURIComponent(category)}`);
		});
	}

	function resolveDropdown(container, selector) {
		if (!container) return null;
		if (selector) {
			const found = container.querySelector(selector);
			if (found) return found;
		}
		const direct = container.querySelector(':scope > div');
		return direct || null;
	}

	function closeDropdown(dropdown) {
		if (!dropdown) return;
		dropdown.classList.add('hidden');
	}

	function setToggleExpanded(toggle, dropdown) {
		if (!toggle || !dropdown) return;
		const expanded = !dropdown.classList.contains('hidden');
		toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
	}

	function copyTextToClipboard(text) {
		const value = typeof text === 'string' ? text : String(text || '');
		if (!value) return Promise.resolve(false);

		if (navigator.clipboard?.writeText) {
			return navigator.clipboard.writeText(value)
				.then(() => true)
				.catch(() => false);
		}

		try {
			const textarea = document.createElement('textarea');
			textarea.value = value;
			textarea.setAttribute('readonly', '');
			textarea.style.position = 'fixed';
			textarea.style.top = '-1000px';
			textarea.style.left = '-1000px';
			document.body.appendChild(textarea);
			textarea.select();
			const ok = document.execCommand('copy');
			textarea.remove();
			return Promise.resolve(Boolean(ok));
		} catch {
			return Promise.resolve(false);
		}
	}

	// =============================================================================
	// AGENT HEADER "..." MENU + RUN VIA API MODAL
	// =============================================================================

	const apiDocsCache = new Map();
	let apiModalState = {
		open: false,
		agentId: null,
		docs: null,
		tab: 'curl',
		streaming: false,
	};
	let apiModalEls = null;

	function ensureApiModal() {
		if (apiModalEls) return apiModalEls;

		const root = document.createElement('div');
		root.className = 'fixed inset-0 z-[100] hidden';
		root.setAttribute('data-aifnmjmchg-api-modal', '');
		root.innerHTML = `
			<div class="absolute inset-0 bg-black/55 backdrop-blur-sm" data-aifnmjmchg-api-backdrop></div>
			<div class="relative min-h-full flex items-end sm:items-center justify-center p-4">
				<div class="w-full max-w-3xl rounded-ios-3xl border border-border bg-background shadow-2xl overflow-hidden">
					<div class="p-5 sm:p-6 border-b border-border flex items-start justify-between gap-4">
						<div class="min-w-0">
							<div class="text-xs font-semibold text-muted-foreground">Run via API</div>
							<div class="mt-1 text-xl font-semibold truncate" data-aifnmjmchg-api-title>Run via API</div>
							<div class="mt-1 text-sm text-muted-foreground truncate" data-aifnmjmchg-api-subtitle></div>
						</div>
						<button type="button" class="h-9 px-3 rounded-full bg-secondary hover:bg-secondary/80 text-sm font-semibold transition-colors" data-aifnmjmchg-api-close>
							Close
						</button>
					</div>

					<div class="p-5 sm:p-6">
						<div class="flex flex-wrap items-center justify-between gap-3">
							<div class="flex flex-wrap gap-2" data-aifnmjmchg-api-tabs>
								<button type="button" class="h-9 px-3 rounded-full bg-secondary text-sm font-semibold transition-colors" data-aifnmjmchg-api-tab="curl">cURL</button>
								<button type="button" class="h-9 px-3 rounded-full bg-secondary text-sm font-semibold transition-colors" data-aifnmjmchg-api-tab="javascript">JavaScript</button>
								<button type="button" class="h-9 px-3 rounded-full bg-secondary text-sm font-semibold transition-colors" data-aifnmjmchg-api-tab="python">Python</button>
								<button type="button" class="h-9 px-3 rounded-full bg-secondary text-sm font-semibold transition-colors" data-aifnmjmchg-api-tab="prompt">Prompt</button>
								<button type="button" class="h-9 px-3 rounded-full bg-secondary text-sm font-semibold transition-colors" data-aifnmjmchg-api-tab="jsonschema">JSON Schema</button>
							</div>
							<div class="flex items-center gap-3">
								<label class="hidden items-center gap-2 text-sm font-medium text-muted-foreground" data-aifnmjmchg-api-streaming>
									<input type="checkbox" class="accent-primary/90" data-aifnmjmchg-api-streaming-checkbox />
									<span>Streaming</span>
								</label>
								<button type="button" class="h-9 px-3 rounded-full bg-secondary hover:bg-secondary/80 text-sm font-semibold transition-colors" data-aifnmjmchg-api-copy>
									Copy
								</button>
							</div>
						</div>

						<div class="mt-4">
							<div class="rounded-ios-2xl border border-border bg-card p-5 text-sm text-muted-foreground" data-aifnmjmchg-api-loading>
								Loading API docs…
							</div>
							<div class="hidden rounded-ios-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-600 dark:text-red-400" data-aifnmjmchg-api-error>
								<div class="font-semibold">Couldn’t load API docs</div>
								<div class="mt-2" data-aifnmjmchg-api-error-message></div>
							</div>
							<div class="hidden" data-aifnmjmchg-api-content>
								<div class="rounded-ios-2xl border border-border bg-card overflow-hidden">
									<pre class="p-4 text-xs sm:text-sm overflow-auto leading-relaxed"><code data-aifnmjmchg-api-code></code></pre>
								</div>
								<div class="mt-4">
									<div class="text-xs font-semibold text-muted-foreground">Notes</div>
									<ul class="mt-2 space-y-1 text-sm text-muted-foreground list-disc pl-5" data-aifnmjmchg-api-notes></ul>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		`.trim();

		document.body.appendChild(root);

		const title = root.querySelector('[data-aifnmjmchg-api-title]');
		const subtitle = root.querySelector('[data-aifnmjmchg-api-subtitle]');
		const loading = root.querySelector('[data-aifnmjmchg-api-loading]');
		const error = root.querySelector('[data-aifnmjmchg-api-error]');
		const errorMessage = root.querySelector('[data-aifnmjmchg-api-error-message]');
		const content = root.querySelector('[data-aifnmjmchg-api-content]');
		const code = root.querySelector('[data-aifnmjmchg-api-code]');
		const notes = root.querySelector('[data-aifnmjmchg-api-notes]');
		const streaming = root.querySelector('[data-aifnmjmchg-api-streaming]');
		const streamingCheckbox = root.querySelector('[data-aifnmjmchg-api-streaming-checkbox]');

		const setActiveTabUi = () => {
			const tabs = root.querySelectorAll('[data-aifnmjmchg-api-tab]');
			tabs.forEach((btn) => {
				const tab = btn.getAttribute('data-aifnmjmchg-api-tab');
				const active = tab === apiModalState.tab;
				btn.classList.toggle('bg-primary', active);
				btn.classList.toggle('text-primary-foreground', active);
				btn.classList.toggle('bg-secondary', !active);
			});
		};

		const render = () => {
			const docs = apiModalState.docs;
			if (!docs) {
				loading?.classList.remove('hidden');
				error?.classList.add('hidden');
				content?.classList.add('hidden');
				setActiveTabUi();
				return;
			}

			loading?.classList.add('hidden');
			error?.classList.add('hidden');
			content?.classList.remove('hidden');

			if (title) title.textContent = `Run “${docs.agent?.name || apiModalState.agentId || 'Agent'}” via API`;
			if (subtitle) subtitle.textContent = docs.endpoint?.url ? `${docs.endpoint.method || 'POST'} ${docs.endpoint.url}` : '';

			const isSnippetTab = apiModalState.tab === 'curl' || apiModalState.tab === 'javascript' || apiModalState.tab === 'python';
			const canStream = Boolean(docs.streaming?.supported) && isSnippetTab;
			if (streaming) {
				streaming.classList.toggle('hidden', !canStream);
				streaming.classList.toggle('flex', canStream);
			}
			if (streamingCheckbox) {
				streamingCheckbox.checked = Boolean(apiModalState.streaming);
			}

			let nextCode = '';
			const examples = docs.examples || {};
			const useStreaming = apiModalState.streaming && canStream;

			if (apiModalState.tab === 'curl') {
				nextCode = useStreaming && examples.curlStreaming ? String(examples.curlStreaming) : String(examples.curl || '');
			} else if (apiModalState.tab === 'javascript') {
				nextCode = useStreaming && examples.javascriptStreaming ? String(examples.javascriptStreaming) : String(examples.javascript || '');
			} else if (apiModalState.tab === 'python') {
				nextCode = useStreaming && examples.pythonStreaming ? String(examples.pythonStreaming) : String(examples.python || '');
			} else if (apiModalState.tab === 'prompt') {
				nextCode = String(examples.prompt || '');
			} else if (apiModalState.tab === 'jsonschema') {
				nextCode = JSON.stringify(docs.schemas?.input || {}, null, 2);
			}

			if (code) code.textContent = nextCode;

			if (notes) {
				notes.innerHTML = '';
				const list = Array.isArray(docs.notes) ? docs.notes : [];
				list.forEach((note) => {
					const li = document.createElement('li');
					li.textContent = String(note);
					notes.appendChild(li);
				});
			}

			setActiveTabUi();
		};

		root.addEventListener('click', (event) => {
			const target = event.target;

			if (target?.closest?.('[data-aifnmjmchg-api-close]') || target?.closest?.('[data-aifnmjmchg-api-backdrop]')) {
				closeApiModal();
				return;
			}

			const tabBtn = target?.closest?.('[data-aifnmjmchg-api-tab]');
			if (tabBtn) {
				const tab = tabBtn.getAttribute('data-aifnmjmchg-api-tab');
				if (tab) {
					apiModalState.tab = tab;
					apiModalState.streaming = false;
					render();
				}
				return;
			}

			const copyBtn = target?.closest?.('[data-aifnmjmchg-api-copy]');
			if (copyBtn) {
				const text = code?.textContent || '';
				void copyTextToClipboard(text);
				copyBtn.textContent = 'Copied';
				setTimeout(() => {
					copyBtn.textContent = 'Copy';
				}, 1400);
				return;
			}
		});

		streamingCheckbox?.addEventListener('change', () => {
			apiModalState.streaming = Boolean(streamingCheckbox.checked);
			render();
		});

		apiModalEls = { root, title, subtitle, loading, error, errorMessage, content, code, notes, streaming, streamingCheckbox, render };
		return apiModalEls;
	}

	function closeApiModal() {
		if (!apiModalState.open) return;
		apiModalState.open = false;
		apiModalState.agentId = null;
		apiModalState.docs = null;
		apiModalState.tab = 'curl';
		apiModalState.streaming = false;

		const modal = ensureApiModal();
		modal.root.classList.add('hidden');
		document.body.style.overflow = '';
	}

	async function openApiModal(agentId) {
		if (!agentId) return;
		const modal = ensureApiModal();

		apiModalState.open = true;
		apiModalState.agentId = agentId;
		apiModalState.docs = null;
		apiModalState.tab = 'curl';
		apiModalState.streaming = false;

		modal.root.classList.remove('hidden');
		document.body.style.overflow = 'hidden';
		modal.render();

		try {
			const cached = apiDocsCache.get(agentId);
			if (cached) {
				apiModalState.docs = cached;
				modal.render();
				return;
			}

			const res = await fetch(`https://aitopia.ai/api/agents/${encodeURIComponent(agentId)}/api-docs`, {
				headers: { Accept: 'application/json' },
			});
			if (!res.ok) {
				throw new Error(`HTTP ${res.status}: ${res.statusText}`);
			}
			const docs = await res.json();
			apiDocsCache.set(agentId, docs);
			apiModalState.docs = docs;
			modal.render();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			const modal = ensureApiModal();
			modal.loading?.classList.add('hidden');
			modal.content?.classList.add('hidden');
			modal.error?.classList.remove('hidden');
			if (modal.errorMessage) modal.errorMessage.textContent = message;
		}
	}

	function initAgentHeaderMenus() {
		const shareRoot = document.getElementById('agent-share-menu');
		const moreRoot = document.getElementById('agent-more-menu');
		if (!shareRoot && !moreRoot) return;

		const shareToggle = shareRoot?.querySelector?.('[data-agent-share-toggle]') || shareRoot?.querySelector?.('button');
		const shareDropdown = resolveDropdown(shareRoot, '[data-agent-share-dropdown]');
		const moreToggle = moreRoot?.querySelector?.('[data-agent-more-toggle]') || moreRoot?.querySelector?.('button');
		const moreDropdown = resolveDropdown(moreRoot, '[data-agent-more-dropdown]');

		if (shareToggle) {
			shareToggle.setAttribute('aria-haspopup', 'menu');
			shareToggle.setAttribute('aria-expanded', 'false');
		}
		if (moreToggle) {
			moreToggle.setAttribute('aria-haspopup', 'menu');
			moreToggle.setAttribute('aria-expanded', 'false');
		}

		const closeAll = () => {
			closeDropdown(shareDropdown);
			closeDropdown(moreDropdown);
			setToggleExpanded(shareToggle, shareDropdown);
			setToggleExpanded(moreToggle, moreDropdown);
		};

		shareToggle?.addEventListener('click', () => {
			closeDropdown(moreDropdown);
			setTimeout(() => {
				setToggleExpanded(shareToggle, shareDropdown);
				setToggleExpanded(moreToggle, moreDropdown);
			}, 0);
		});

		moreToggle?.addEventListener('click', () => {
			closeDropdown(shareDropdown);
			setTimeout(() => {
				setToggleExpanded(shareToggle, shareDropdown);
				setToggleExpanded(moreToggle, moreDropdown);
			}, 0);
		});

		document.addEventListener('click', (event) => {
			const target = event.target;
			if (shareRoot && !shareRoot.contains(target)) closeDropdown(shareDropdown);
			if (moreRoot && !moreRoot.contains(target)) closeDropdown(moreDropdown);
			setToggleExpanded(shareToggle, shareDropdown);
			setToggleExpanded(moreToggle, moreDropdown);
		});

		document.addEventListener('keydown', (event) => {
			if (event.key !== 'Escape') return;
			closeAll();
			closeApiModal();
		});

		moreRoot?.addEventListener('click', (event) => {
			const actionEl = event.target?.closest?.('[data-action]');
			const action = actionEl?.getAttribute?.('data-action');
			if (!action) return;

			if (action === 'agent-run-via-api') {
				event.preventDefault();
				closeDropdown(moreDropdown);
				setToggleExpanded(moreToggle, moreDropdown);
				const agentId = getAgentIdFromPage();
				void openApiModal(agentId);
				return;
			}

			if (action === 'agent-remix') {
				// Let the anchor navigate, but close the menu immediately for smoother UX.
				closeDropdown(moreDropdown);
				setToggleExpanded(moreToggle, moreDropdown);
			}
		});
	}

	setReady(() => {
		initAgentHeaderMenus();
		initBreadcrumbCategoryRedirects();

		Promise.resolve(hydrateAgentShowcaseFromSource())
			.catch(() => {})
			.finally(() => {
				initShowcaseThumbnailGalleries();
			});
	});
})();
