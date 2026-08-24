import { collectMediaUrls } from './collect-media-urls.js';

export { collectMediaUrls, renderImageSlider };

// NOTE: highlight.js and markdown-it are loaded lazily from /vendor/ (local copies).
// Dynamic imports are used so that CI / sandboxed environments don't break
// if the libraries fail to load.
let mdInstance = null;
let mdLoadPromise = null;
let hljsModule = null;
let hljsLoadPromise = null;

function ensureHighlightJsLoaded() {
  if (hljsModule || hljsLoadPromise) return;
  hljsLoadPromise = import('/aitopia/marketplace/vendor/highlight.esm.js')
    .then((mod) => {
      hljsModule = mod?.default || mod;
    })
    .catch(() => {
      hljsLoadPromise = null;
      hljsModule = null;
    });
}

function ensureMarkdownItLoaded() {
  if (mdInstance || mdLoadPromise) return;
  mdLoadPromise = import('/aitopia/marketplace/vendor/markdown-it.esm.js')
    .then((mod) => {
      const markdownit = mod?.default || mod;
      if (typeof markdownit !== 'function') return;

      mdInstance = markdownit({
        html: true,
        linkify: true,
        typographer: true,
        highlight: function (str, lang) {
          const hljs = hljsModule;
          if (lang && hljs && typeof hljs.getLanguage === 'function' && hljs.getLanguage(lang)) {
            try {
              return '<pre><code class="hljs">' +
                     hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
                     '</code></pre>';
            } catch (__) {}
          }

          // Fallback: plain escaped code
          const safe = typeof markdownit?.utils?.escapeHtml === 'function'
            ? markdownit.utils.escapeHtml(str)
            : escapeHtml(str);
          return '<pre><code class="hljs">' + safe + '</code></pre>';
        },
      });
    })
    .catch(() => {
      mdLoadPromise = null;
      mdInstance = null;
    });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function renderImageSlider(container, urls, opts = {}) {
  const { labels, metadata, showPublish, fitContainer } = opts;
  const id = 'slider-' + Math.random().toString(36).slice(2, 9);
  const total = urls.length;
  const slideH = fitContainer ? '100%' : '65vh';
  const maxH = fitContainer ? '100%' : '65vh';
  const outerH = fitContainer ? 'height:100%;' : '';

  container.innerHTML = `
    <div id="${id}" class="relative select-none" style="position:relative;${outerH}">
      <div style="position:relative;${outerH}">
        <div style="overflow:hidden;border-radius:16px;max-height:${maxH};${outerH}">
          ${urls.map((u, i) => `
            <div class="${id}-slide" style="display:${i === 0 ? 'flex' : 'none'};align-items:center;justify-content:center;height:${slideH}">
              <div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%">
                <img src="${escapeHtml(u)}" alt="${labels && labels[i] ? escapeHtml(labels[i]) : ('Image ' + (i + 1))}" style="max-width:100%;max-height:100%;object-fit:contain;pointer-events:none;user-select:none" draggable="false" />
              </div>
            </div>
          `).join('')}

          <button class="${id}-prev carousel-nav-btn" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);width:36px;height:36px;border-radius:50%;background:rgba(0,0,0,0.45);backdrop-filter:blur(4px);border:none;color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:10;transition:background .15s" data-hover-bg="rgba(0,0,0,0.7)" data-default-bg="rgba(0,0,0,0.45)" aria-label="Previous">
            <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <button class="${id}-next carousel-nav-btn" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);width:36px;height:36px;border-radius:50%;background:rgba(0,0,0,0.45);backdrop-filter:blur(4px);border:none;color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:10;transition:background .15s" data-hover-bg="rgba(0,0,0,0.7)" data-default-bg="rgba(0,0,0,0.45)" aria-label="Next">
            <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
          </button>

          ${showPublish ? urls.map((u, i) => `
            <button class="${id}-publish-single carousel-nav-btn" data-slide-index="${i}" data-url="${escapeHtml(u)}" style="position:absolute;bottom:12px;left:50%;transform:translateX(-50%);height:32px;padding:0 14px;border-radius:999px;background:#9335EC;border:none;color:#fff;font-size:12px;font-weight:600;display:none;align-items:center;gap:5px;cursor:pointer;z-index:20;opacity:0;transition:opacity .2s,background .15s" data-hover-bg="#7b28d1" data-default-bg="#9335EC" title="Publish this image" aria-label="Publish this image">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z"/></svg>
              Publish
            </button>
          `).join('') : ''}
        </div>

        <div class="${id}-counter" style="position:absolute;bottom:12px;right:14px;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);color:#fff;font-size:13px;font-weight:600;padding:3px 10px;border-radius:999px;z-index:20;pointer-events:none">1 / ${total}</div>
      </div>

      ${metadata ? renderMetadataPills(metadata) : ''}
    </div>
  `;

  let current = 0;
  const root = container.querySelector('#' + id);
  if (!root) return;

  const slides = root.querySelectorAll('.' + id + '-slide');
  const counter = root.querySelector('.' + id + '-counter');
  const publishBtns = showPublish ? root.querySelectorAll('.' + id + '-publish-single') : [];
  let isHovered = false;

  function showPublishBtn() {
    if (publishBtns.length) { publishBtns[current].style.display = 'flex'; publishBtns[current].style.opacity = '1'; }
  }
  function hidePublishBtn() {
    if (publishBtns.length) { publishBtns[current].style.opacity = '0'; setTimeout(() => { if (!isHovered) publishBtns[current].style.display = 'none'; }, 200); }
  }

  function goTo(idx) {
    slides[current].style.display = 'none';
    if (publishBtns.length) { publishBtns[current].style.display = 'none'; publishBtns[current].style.opacity = '0'; }
    current = (idx + total) % total;
    slides[current].style.display = 'flex';
    if (isHovered) showPublishBtn();
    if (counter) counter.textContent = (current + 1) + ' / ' + total;
  }

  if (showPublish) {
    root.addEventListener('mouseenter', () => { isHovered = true; showPublishBtn(); });
    root.addEventListener('mouseleave', () => { isHovered = false; hidePublishBtn(); });
  }

  root.querySelector('.' + id + '-prev').addEventListener('click', (e) => { e.stopPropagation(); goTo(current - 1); });
  root.querySelector('.' + id + '-next').addEventListener('click', (e) => { e.stopPropagation(); goTo(current + 1); });

  if (showPublish) {
    root.querySelectorAll('.' + id + '-publish-single').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (btn.dataset.localPublish) return;
        window.dispatchEvent(new CustomEvent('aitopia:carousel:publish-single', {
          detail: { url: btn.dataset.url, index: Number(btn.dataset.slideIndex) }
        }));
      });
    });
  }

  root.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') goTo(current - 1);
    else if (e.key === 'ArrowRight') goTo(current + 1);
  });
  root.setAttribute('tabindex', '0');
}

function renderMarkdown(text) {
  ensureHighlightJsLoaded();
  ensureMarkdownItLoaded();

  if (!mdInstance || typeof mdInstance.render !== 'function') {
    // Fail-soft: render as plain text if markdown-it isn't available yet.
    return `<pre class="text-sm whitespace-pre-wrap break-words bg-neutral-100 dark:bg-neutral-900/60 border border-black/5 dark:border-white/10 rounded-ios-xl p-4 overflow-auto">${escapeHtml(text)}</pre>`;
  }

  return '<div class="my-2 aifnmjmchg-markdown">' + mdInstance.render(text) + "</div>";
}

ensureMarkdownItLoaded();

function parseSlides(content) {
  const slides = [];
  const slideRegex = /##\s*\*?\*?Slide\s+\d+[:\s]*/gi;
  const parts = content.split(slideRegex).filter(p => p.trim());

  const headerMatches = content.match(/##\s*\*?\*?Slide\s+\d+[^*\n]*\*?\*?/gi) || [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    if (!part) continue;


    let title = '';
    if (headerMatches[i]) {
      const titleMatch = headerMatches[i].match(/Slide\s+\d+[:\s]*\*?\*?([^*\n]+)/i);
      if (titleMatch) {
        title = titleMatch[1].replace(/\*+/g, '').trim();
      }
    }

    let mainContent = '';
    let visualElements = '';
    let speakerNotes = '';

    const visualMatch = part.match(/\*\*Visual\s*Elements?:?\*\*\s*([\s\S]*?)(?=\*\*Speaker|$)/i);
    if (visualMatch) {
      visualElements = visualMatch[1].trim().replace(/^[-•]\s*/gm, '• ');
    }

    const notesMatch = part.match(/\*\*Speaker\s*Notes?:?\*\*\s*([\s\S]*?)(?=---|$)/i);
    if (notesMatch) {
      speakerNotes = notesMatch[1].trim().replace(/^[-•]\s*/gm, '• ');
    }

    let contentEnd = part.length;
    const visualIdx = part.search(/\*\*Visual\s*Elements?:?\*\*/i);
    const notesIdx = part.search(/\*\*Speaker\s*Notes?:?\*\*/i);
    if (visualIdx > 0) contentEnd = Math.min(contentEnd, visualIdx);
    if (notesIdx > 0) contentEnd = Math.min(contentEnd, notesIdx);

    mainContent = part.substring(0, contentEnd).trim();
    mainContent = mainContent
      .replace(/\*\*Title:?\*\*/gi, 'Title:')
      .replace(/\*\*Subtitle:?\*\*/gi, 'Subtitle:')
      .replace(/\*\*Key\s*Points?:?\*\*/gi, 'Key Points:')
      .replace(/\*\*Content:?\*\*/gi, '')
      .replace(/\*\*/g, '')
      .replace(/^[-•]\s*/gm, '• ')
      .trim();

    slides.push({
      title,
      content: mainContent,
      visualElements,
      speakerNotes
    });
  }

  return slides;
}

function getOptionalText(value) {
  if (!value || typeof value !== 'object') return {};
  const revisedPrompt = typeof value.revisedPrompt === 'string' ? value.revisedPrompt : null;
  return { revisedPrompt };
}

function extractRunMetadata(value) {
  if (!value || typeof value !== 'object') return null;
  const model = typeof value.modelUsed === 'string'
    ? value.modelUsed
    : (typeof value.model === 'string' ? value.model : null);
  const provider = typeof value.provider === 'string' ? value.provider : null;
  const wasFallback = typeof value.wasFallback === 'boolean' ? value.wasFallback : null;
  const durationMs = typeof value.processingTime === 'number'
    ? value.processingTime
    : (typeof value.processingTimeMs === 'number' ? value.processingTimeMs : null);

  if (!model && !provider && wasFallback == null && durationMs == null) return null;
  return { model, provider, wasFallback, durationMs };
}

function renderMetadataPills(meta) {
  return '';
}

function isMeetingTranscriberOutput(value) {
  if (!value || typeof value !== 'object') return false;
  const transcript = value.transcript;
  if (!transcript || typeof transcript !== 'object') return false;
  return typeof transcript.text === 'string' && transcript.text.trim().length > 0;
}

function safeJsonStringify(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '';
  }
}

function renderMeetingTranscriber(container, value, metadata) {
  const transcriptText = value?.transcript?.text ? String(value.transcript.text) : '';
  const transcriptSegments = Array.isArray(value?.transcript?.segments) ? value.transcript.segments : [];
  const duration = typeof value?.transcript?.duration === 'number' ? value.transcript.duration : null;
  const language = typeof value?.transcript?.language === 'string' ? value.transcript.language : null;

  const summary = value?.summary && typeof value.summary === 'object' ? value.summary : null;
  const actionItems = Array.isArray(value?.actionItems) ? value.actionItems : [];
  const keyPoints = Array.isArray(value?.keyPoints) ? value.keyPoints : [];
  const speakers = Array.isArray(value?.speakers) ? value.speakers : [];
  const translations = Array.isArray(value?.translations) ? value.translations : [];
  const translationError = typeof value?.translationError === 'string' ? value.translationError : null;
  const hasSpeakerLabels = transcriptSegments.some((s) => typeof s?.speaker === 'string' && String(s.speaker).trim().length > 0);

  const speakerIds = hasSpeakerLabels
    ? Array.from(new Set(
      transcriptSegments
        .map((s) => (typeof s?.speaker === 'string' ? String(s.speaker).trim() : ''))
        .filter(Boolean)
    )).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    : [];

  const buildSpeakerTranscript = (labelForSpeaker) => {
    if (!hasSpeakerLabels) return '';
    let out = '';
    let lastSpeakerId = '';
    for (const seg of transcriptSegments) {
      const speakerId = typeof seg?.speaker === 'string' ? String(seg.speaker).trim() : '';
      const text = typeof seg?.text === 'string' ? String(seg.text).trim() : '';
      if (!speakerId || !text) continue;

      if (speakerId !== lastSpeakerId) {
        if (out) out += '\n\n';
        out += `${labelForSpeaker(speakerId)}:\n`;
        lastSpeakerId = speakerId;
      }
      out += (out.endsWith('\n') ? '' : ' ') + text;
    }
    return out.trim();
  };

  const speakerTranscript = hasSpeakerLabels ? buildSpeakerTranscript((id) => id) : '';

  const outputs = value?.outputs && typeof value.outputs === 'object' ? value.outputs : {};
  const textOut = typeof outputs.text === 'string' ? outputs.text : transcriptText;
  const srtOut = typeof outputs.srt === 'string' ? outputs.srt : null;
  const vttOut = typeof outputs.vtt === 'string' ? outputs.vtt : null;
  const jsonOut = typeof outputs.json === 'string' ? outputs.json : safeJsonStringify(value);

  const baseId = `mt-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const copyId = (suffix) => `${baseId}-${suffix}`;

  const durationLabel = duration != null && Number.isFinite(duration) ? `${Math.round(duration)}s` : null;

  container.innerHTML = `
    <div class="space-y-4">
      <div class="flex flex-wrap items-center gap-2">
        <span class="px-2 py-1 text-xs font-medium bg-primary/90/10 dark:bg-primary/90/40 text-primary/90 dark:text-primary/90 rounded-full">Meeting Transcriber</span>
        ${language ? `<span class="px-2 py-1 text-xs font-medium bg-neutral-100 dark:bg-neutral-900/60 text-neutral-700 dark:text-neutral-200 rounded-full">Lang: ${escapeHtml(language)}</span>` : ''}
        ${durationLabel ? `<span class="px-2 py-1 text-xs font-medium bg-neutral-100 dark:bg-neutral-900/60 text-neutral-700 dark:text-neutral-200 rounded-full">Audio: ${escapeHtml(durationLabel)}</span>` : ''}
      </div>

      <section class="rounded-ios-xl border border-black/5 dark:border-white/10 bg-white/60 dark:bg-neutral-950/20 p-4">
        <div class="flex items-center justify-between gap-3 mb-3">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white">Transcript</h3>
          <div class="flex items-center gap-2">
            <button id="${copyId('copy-transcript')}" class="px-3 py-1.5 rounded-full bg-secondary hover:bg-secondary/80 text-xs font-semibold transition-colors">Copy</button>
            <button id="${copyId('dl-transcript')}" class="px-3 py-1.5 rounded-full bg-secondary hover:bg-secondary/80 text-xs font-semibold transition-colors">Download .txt</button>
          </div>
        </div>
        <pre class="text-sm whitespace-pre-wrap break-words bg-neutral-100 dark:bg-neutral-900/60 border border-black/5 dark:border-white/10 rounded-ios-xl p-4 overflow-auto max-h-[420px]">${escapeHtml(transcriptText)}</pre>
      </section>

      ${translationError ? `
        <div class="rounded-ios-xl border border-black/5 dark:border-white/10 bg-yellow-50 dark:bg-yellow-950/20 p-4 text-xs text-yellow-900 dark:text-yellow-200">
          ${escapeHtml(translationError)}
        </div>
      ` : ''}

      ${translations.length ? translations.map((t, idx) => {
        const target = typeof t?.targetLang === 'string' ? String(t.targetLang).trim() : `T${idx + 1}`;
        const txt = typeof t?.text === 'string' ? String(t.text) : '';
        return `
          <section class="rounded-ios-xl border border-black/5 dark:border-white/10 bg-white/60 dark:bg-neutral-950/20 p-4">
            <div class="flex items-center justify-between gap-3 mb-3">
              <h3 class="text-sm font-semibold text-gray-900 dark:text-white">Translation (${escapeHtml(target)})</h3>
              <div class="flex items-center gap-2">
                <button id="${copyId(`copy-translation-${idx}`)}" class="px-3 py-1.5 rounded-full bg-secondary hover:bg-secondary/80 text-xs font-semibold transition-colors">Copy</button>
                <button id="${copyId(`dl-translation-${idx}`)}" class="px-3 py-1.5 rounded-full bg-secondary hover:bg-secondary/80 text-xs font-semibold transition-colors">Download .txt</button>
              </div>
            </div>
            <pre class="text-sm whitespace-pre-wrap break-words bg-neutral-100 dark:bg-neutral-900/60 border border-black/5 dark:border-white/10 rounded-ios-xl p-4 overflow-auto max-h-[420px]">${escapeHtml(txt)}</pre>
          </section>
        `;
      }).join('') : ''}

      ${hasSpeakerLabels && speakerTranscript ? `
        <section class="rounded-ios-xl border border-black/5 dark:border-white/10 bg-white/60 dark:bg-neutral-950/20 p-4">
          <div class="flex items-center justify-between gap-3 mb-3">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white">Transcript (by speaker)</h3>
            <span class="text-[11px] text-gray-500 dark:text-gray-400">Post-stop diarization</span>
          </div>
          <pre id="${copyId('speaker-transcript')}" class="text-sm whitespace-pre-wrap break-words bg-neutral-100 dark:bg-neutral-900/60 border border-black/5 dark:border-white/10 rounded-ios-xl p-4 overflow-auto max-h-[420px]">${escapeHtml(speakerTranscript)}</pre>
          ${speakerIds.length ? `
            <details class="mt-3">
              <summary class="cursor-pointer select-none text-xs font-semibold text-gray-700 dark:text-gray-200">Rename speakers</summary>
              <div class="mt-3 grid sm:grid-cols-2 gap-2">
                ${speakerIds.map((id) => `
                  <div class="rounded-ios-lg border border-black/5 dark:border-white/10 bg-neutral-50 dark:bg-neutral-900/40 p-3">
                    <div class="text-[11px] font-semibold text-gray-800 dark:text-gray-200">${escapeHtml(id)}</div>
                    <input
                      type="text"
                      inputmode="text"
                      autocomplete="off"
                      data-speaker-rename="${escapeHtml(baseId)}"
                      data-speaker-id="${escapeHtml(id)}"
                      placeholder="Name (optional)"
                      class="mt-2 w-full px-3 py-2 rounded-ios-lg border border-border bg-white/80 dark:bg-neutral-950/30 text-xs text-gray-900 dark:text-white"
                    />
                  </div>
                `).join('')}
              </div>
              <div class="mt-2 text-[11px] text-gray-500 dark:text-gray-400">Names are local to this page view; exports remain unchanged.</div>
            </details>
          ` : ''}
        </section>
      ` : ''}

      ${summary ? `
        <section class="rounded-ios-xl border border-black/5 dark:border-white/10 bg-white/60 dark:bg-neutral-950/20 p-4">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">Summary</h3>
          ${summary.title ? `<div class="text-sm font-semibold mb-2">${escapeHtml(summary.title)}</div>` : ''}
          ${summary.overview ? `<div class="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">${escapeHtml(summary.overview)}</div>` : ''}
          <div class="mt-3 grid md:grid-cols-2 gap-3">
            ${Array.isArray(summary.keyTopics) && summary.keyTopics.length ? `
              <div class="rounded-ios-lg border border-black/5 dark:border-white/10 bg-neutral-50 dark:bg-neutral-900/40 p-3">
                <div class="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">Key topics</div>
                <ul class="text-xs text-gray-600 dark:text-gray-300 list-disc pl-5">${summary.keyTopics.slice(0, 10).map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>
              </div>
            ` : ''}
            ${Array.isArray(summary.decisions) && summary.decisions.length ? `
              <div class="rounded-ios-lg border border-black/5 dark:border-white/10 bg-neutral-50 dark:bg-neutral-900/40 p-3">
                <div class="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">Decisions</div>
                <ul class="text-xs text-gray-600 dark:text-gray-300 list-disc pl-5">${summary.decisions.slice(0, 10).map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>
              </div>
            ` : ''}
            ${Array.isArray(summary.nextSteps) && summary.nextSteps.length ? `
              <div class="rounded-ios-lg border border-black/5 dark:border-white/10 bg-neutral-50 dark:bg-neutral-900/40 p-3 md:col-span-2">
                <div class="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">Next steps</div>
                <ul class="text-xs text-gray-600 dark:text-gray-300 list-disc pl-5">${summary.nextSteps.slice(0, 10).map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>
              </div>
            ` : ''}
          </div>
        </section>
      ` : ''}

      ${actionItems.length ? `
        <section class="rounded-ios-xl border border-black/5 dark:border-white/10 bg-white/60 dark:bg-neutral-950/20 p-4">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">Action items</h3>
          <div class="space-y-2">
            ${actionItems.slice(0, 25).map((item) => {
              const desc = typeof item?.description === 'string' ? item.description : '';
              const assignee = typeof item?.assignee === 'string' ? item.assignee : '';
              const due = typeof item?.dueDate === 'string' ? item.dueDate : '';
              const priority = typeof item?.priority === 'string' ? item.priority : '';
              return `
                <div class="rounded-ios-lg border border-black/5 dark:border-white/10 bg-neutral-50 dark:bg-neutral-900/40 p-3">
                  <div class="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">${escapeHtml(desc)}</div>
                  <div class="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-600 dark:text-gray-300">
                    ${assignee ? `<span class="px-2 py-1 rounded-full bg-neutral-100 dark:bg-neutral-900/60 border border-black/5 dark:border-white/10">Assignee: ${escapeHtml(assignee)}</span>` : ''}
                    ${due ? `<span class="px-2 py-1 rounded-full bg-neutral-100 dark:bg-neutral-900/60 border border-black/5 dark:border-white/10">Due: ${escapeHtml(due)}</span>` : ''}
                    ${priority ? `<span class="px-2 py-1 rounded-full bg-neutral-100 dark:bg-neutral-900/60 border border-black/5 dark:border-white/10">Priority: ${escapeHtml(priority)}</span>` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </section>
      ` : ''}

      ${keyPoints.length ? `
        <section class="rounded-ios-xl border border-black/5 dark:border-white/10 bg-white/60 dark:bg-neutral-950/20 p-4">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">Key points</h3>
          <div class="space-y-2">
            ${keyPoints.slice(0, 30).map((kp) => {
              const point = typeof kp?.point === 'string' ? kp.point : '';
              const category = typeof kp?.category === 'string' ? kp.category : '';
              return `
                <div class="rounded-ios-lg border border-black/5 dark:border-white/10 bg-neutral-50 dark:bg-neutral-900/40 p-3">
                  <div class="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">${escapeHtml(point)}</div>
                  ${category ? `<div class="mt-2 text-[11px] text-gray-600 dark:text-gray-300">Category: <span class="font-semibold">${escapeHtml(category)}</span></div>` : ''}
                </div>
              `;
            }).join('')}
          </div>
        </section>
      ` : ''}

      ${speakers.length ? `
        <section class="rounded-ios-xl border border-black/5 dark:border-white/10 bg-white/60 dark:bg-neutral-950/20 p-4">
          <div class="flex items-center justify-between gap-3 mb-2">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white">${hasSpeakerLabels ? 'Speakers' : 'Speakers (experimental)'}</h3>
            <span class="text-[11px] text-gray-500 dark:text-gray-400">${hasSpeakerLabels ? 'Diarization (best-effort)' : 'Not diarization'}</span>
          </div>
          <div class="text-xs text-gray-600 dark:text-gray-300">${hasSpeakerLabels ? 'Speaker labels are best-effort and may be inaccurate.' : 'Speaker estimation is heuristic and may be inaccurate.'}</div>
          <div class="mt-3 grid sm:grid-cols-2 gap-2">
            ${speakers.slice(0, 12).map((s) => {
              const id = typeof s?.id === 'string' ? s.id : '';
              const name = typeof s?.name === 'string' ? s.name : '';
              const time = typeof s?.speakingTime === 'number' ? `${Math.round(s.speakingTime)}s` : '';
              const segs = typeof s?.segmentCount === 'number' ? `${s.segmentCount} segments` : '';
              const label = name ? `${name} (${id})` : id;
              return `
                <div class="rounded-ios-lg border border-black/5 dark:border-white/10 bg-neutral-50 dark:bg-neutral-900/40 p-3">
                  <div class="text-xs font-semibold text-gray-800 dark:text-gray-200">${escapeHtml(label)}</div>
                  <div class="mt-1 text-[11px] text-gray-600 dark:text-gray-300">${escapeHtml([time, segs].filter(Boolean).join(' • '))}</div>
                </div>
              `;
            }).join('')}
          </div>
        </section>
      ` : ''}

      <section class="rounded-ios-xl border border-black/5 dark:border-white/10 bg-white/60 dark:bg-neutral-950/20 p-4">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">Exports</h3>
        <div class="grid sm:grid-cols-2 gap-3">
          <div class="rounded-ios-lg border border-black/5 dark:border-white/10 bg-neutral-50 dark:bg-neutral-900/40 p-3">
            <div class="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">Text</div>
            <div class="flex flex-wrap gap-2">
              <button id="${copyId('copy-text')}" class="px-3 py-1.5 rounded-full bg-secondary hover:bg-secondary/80 text-xs font-semibold transition-colors">Copy</button>
              <button id="${copyId('dl-text')}" class="px-3 py-1.5 rounded-full bg-secondary hover:bg-secondary/80 text-xs font-semibold transition-colors">Download</button>
            </div>
          </div>
          <div class="rounded-ios-lg border border-black/5 dark:border-white/10 bg-neutral-50 dark:bg-neutral-900/40 p-3">
            <div class="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">JSON</div>
            <div class="flex flex-wrap gap-2">
              <button id="${copyId('copy-json')}" class="px-3 py-1.5 rounded-full bg-secondary hover:bg-secondary/80 text-xs font-semibold transition-colors">Copy</button>
              <button id="${copyId('dl-json')}" class="px-3 py-1.5 rounded-full bg-secondary hover:bg-secondary/80 text-xs font-semibold transition-colors">Download</button>
            </div>
          </div>
          ${srtOut ? `
            <div class="rounded-ios-lg border border-black/5 dark:border-white/10 bg-neutral-50 dark:bg-neutral-900/40 p-3">
              <div class="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">SRT</div>
              <div class="flex flex-wrap gap-2">
                <button id="${copyId('copy-srt')}" class="px-3 py-1.5 rounded-full bg-secondary hover:bg-secondary/80 text-xs font-semibold transition-colors">Copy</button>
                <button id="${copyId('dl-srt')}" class="px-3 py-1.5 rounded-full bg-secondary hover:bg-secondary/80 text-xs font-semibold transition-colors">Download</button>
              </div>
            </div>
          ` : ''}
          ${vttOut ? `
            <div class="rounded-ios-lg border border-black/5 dark:border-white/10 bg-neutral-50 dark:bg-neutral-900/40 p-3">
              <div class="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">VTT</div>
              <div class="flex flex-wrap gap-2">
                <button id="${copyId('copy-vtt')}" class="px-3 py-1.5 rounded-full bg-secondary hover:bg-secondary/80 text-xs font-semibold transition-colors">Copy</button>
                <button id="${copyId('dl-vtt')}" class="px-3 py-1.5 rounded-full bg-secondary hover:bg-secondary/80 text-xs font-semibold transition-colors">Download</button>
              </div>
            </div>
          ` : ''}
        </div>
      </section>

      ${renderMetadataPills(metadata)}
    </div>
  `;

  function copyText(text, buttonId) {
    const btn = document.getElementById(buttonId);
    if (!btn) return;
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(String(text || ''));
        const prev = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = prev; }, 1500);
      } catch {
        // Fail-soft: no clipboard permissions.
      }
    });
  }

  function downloadText(text, filename, buttonId, mime = 'text/plain') {
    const btn = document.getElementById(buttonId);
    if (!btn) return;
    btn.addEventListener('click', () => {
      try {
        const blob = new Blob([String(text || '')], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2500);
      } catch {
        // ignore
      }
    });
  }

  copyText(transcriptText, copyId('copy-transcript'));
  downloadText(textOut, 'transcript.txt', copyId('dl-transcript'));

  if (translations.length) {
    translations.forEach((t, idx) => {
      const target = typeof t?.targetLang === 'string' ? String(t.targetLang).trim() : `t${idx + 1}`;
      const txt = typeof t?.text === 'string' ? String(t.text) : '';
      const safe = target.toLowerCase().replace(/[^a-z0-9._-]+/g, '_');
      copyText(txt, copyId(`copy-translation-${idx}`));
      downloadText(txt, `translation-${safe}.txt`, copyId(`dl-translation-${idx}`));
    });
  }

  copyText(textOut, copyId('copy-text'));
  downloadText(textOut, 'meeting.txt', copyId('dl-text'));

  copyText(jsonOut, copyId('copy-json'));
  downloadText(jsonOut, 'meeting.json', copyId('dl-json'), 'application/json');

  if (srtOut) {
    copyText(srtOut, copyId('copy-srt'));
    downloadText(srtOut, 'subtitles.srt', copyId('dl-srt'));
  }
  if (vttOut) {
    copyText(vttOut, copyId('copy-vtt'));
    downloadText(vttOut, 'subtitles.vtt', copyId('dl-vtt'));
  }

  if (hasSpeakerLabels && speakerTranscript && speakerIds.length) {
    const transcriptEl = container.querySelector(`#${copyId('speaker-transcript')}`);
    if (transcriptEl) {
      const nameOverrides = new Map();

      const update = () => {
        const next = buildSpeakerTranscript((speakerId) => {
          const name = nameOverrides.get(speakerId);
          return name ? name : speakerId;
        });
        transcriptEl.textContent = next;
      };

      container.querySelectorAll(`input[data-speaker-rename="${baseId}"]`).forEach((input) => {
        input.addEventListener('input', () => {
          const speakerId = input.getAttribute('data-speaker-id') || '';
          const name = String((input).value || '').trim();
          if (!speakerId) return;
          if (name) nameOverrides.set(speakerId, name);
          else nameOverrides.delete(speakerId);
          update();
        });
      });

      update();
    }
  }
}

export function renderError(container, message) {
  if (!container) return;
  container.classList.remove('text-gray-500', 'dark:text-gray-400', 'items-center', 'justify-center');
  container.classList.add('items-start', 'justify-start');

  const errorHtml = `
    <div class="w-full flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950/30 rounded-lg">
      <svg class="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
      </svg>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-red-800 dark:text-red-200">${escapeHtml(message)}</p>
      </div>
    </div>
  `;

  container.innerHTML = errorHtml;
}

export function renderOutput(container, value, renderOpts = {}) {
  if (!container) return;
  container.classList.remove('text-gray-500', 'dark:text-gray-400', 'items-center', 'justify-center');
  container.classList.add('text-gray-900', 'dark:text-white', 'items-start', 'justify-start');

  if (value == null) {
    container.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400">No output.</p>';
    return;
  }

  const media = collectMediaUrls(value);
  const { revisedPrompt } = getOptionalText(value);
  const metadata = extractRunMetadata(value);

  const seriesImagesData = value && typeof value === 'object' && (value.images || (value.content && typeof value.content === 'object' && value.content.images));
  if (Array.isArray(seriesImagesData) && seriesImagesData.length > 0 && typeof seriesImagesData[0] === 'object' && seriesImagesData[0] !== null && ('imageUrl' in seriesImagesData[0] || 'number' in seriesImagesData[0])) {
    const images = seriesImagesData.filter(img => img.imageUrl);
    if (images.length > 0) {
      const sourceImage = value.sourceImage || '';
      const style = value.style || '';
      const imagesGenerated = value.imagesGenerated || images.length;

      container.innerHTML = `<div class="space-y-4">
        <div class="bg-gradient-to-r from-blue-500 to-primary/90 rounded-xl p-4 text-white">
          <div class="flex items-center gap-3">
            <span class="text-3xl">🖼️</span>
            <div>
              <h2 class="font-bold text-lg">Image Series Generated</h2>
              <p class="text-sm opacity-90 mt-1">${images.length} variation${images.length > 1 ? 's' : ''} from source image</p>
            </div>
          </div>
          <div class="flex flex-wrap gap-2 mt-3">
            ${style ? `<span class="px-2 py-1 bg-primary-foreground/20 rounded-full text-xs">${escapeHtml(style)}</span>` : ''}
            <span class="px-2 py-1 bg-primary-foreground/20 rounded-full text-xs">${images.length} image${images.length > 1 ? 's' : ''}</span>
            ${imagesGenerated > 0 ? `<span class="px-2 py-1 bg-primary-foreground/20 rounded-full text-xs">${imagesGenerated} generated</span>` : ''}
          </div>
        </div>
        ${sourceImage ? `
          <div class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl p-4">
            <h4 class="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Source Image</h4>
            <a href="${escapeHtml(sourceImage)}" target="_blank" rel="noreferrer" class="block">
              <img src="${escapeHtml(sourceImage)}" alt="Source image" class="w-full max-w-md rounded-lg border border-gray-200 dark:border-neutral-700" />
            </a>
          </div>
        ` : ''}
        <div class="series-slider-mount"></div>
        ${renderMetadataPills(metadata)}
      </div>`;

      const sliderMount = container.querySelector('.series-slider-mount');
      if (sliderMount) {
        const urls = images.map(img => img.imageUrl);
        const labels = images.map(img => img.variation || (img.number ? ('Variation ' + img.number) : null)).filter(Boolean);
        renderImageSlider(sliderMount, urls, { labels: labels.length === urls.length ? labels : undefined, showPublish: renderOpts.showPublish });
      }
      return;
    }
  }

  if (isMeetingTranscriberOutput(value)) {
    renderMeetingTranscriber(container, value, metadata);
    return;
  }

  if (media.videos.length > 0) {
    const url = media.videos[0];
    container.innerHTML = `
      <video src="${escapeHtml(url)}" controls class="w-full rounded-ios-xl border border-black/5 dark:border-white/10"></video>
      ${renderMetadataPills(metadata)}
    `;
    return;
  }

  if (media.audios.length > 0) {
    const url = media.audios[0];
    container.innerHTML = `
      <audio src="${escapeHtml(url)}" controls class="w-full"></audio>
      ${renderMetadataPills(metadata)}
    `;
    return;
  }

  if (media.images.length > 0) {
    const urls = media.images;
    if (urls.length === 1) {
      container.innerHTML = `
        <a href="${escapeHtml(urls[0])}" target="_blank" rel="noreferrer" class="block">
          <img src="${escapeHtml(urls[0])}" alt="Result" class="w-full rounded-ios-xl border border-black/5 dark:border-white/10" />
        </a>
        ${revisedPrompt ? `<p class="mt-4 text-sm text-gray-600 dark:text-gray-300"><span class="font-medium">Revised prompt:</span> ${escapeHtml(revisedPrompt)}</p>` : ''}
        ${renderMetadataPills(metadata)}
      `;
    } else {
      renderImageSlider(container, urls, { metadata, showPublish: renderOpts.showPublish });
    }
    return;
  }

  if (typeof value === 'string') {
    container.innerHTML = `<pre class="text-sm whitespace-pre-wrap break-words bg-neutral-100 dark:bg-neutral-900/60 border border-black/5 dark:border-white/10 rounded-ios-xl p-4 overflow-auto">${escapeHtml(value)}</pre>`;
    return;
  }

  if (typeof value === 'object' && value !== null) {
    if (value.success === false && typeof value.error === 'string' && value.error.length > 0) {
      container.innerHTML = `
        <div class="w-full flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950/30 rounded-lg">
          <svg class="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
          </svg>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-red-800 dark:text-red-200">${escapeHtml(value.error)}</p>
          </div>
        </div>
      `;
      return;
    }

    if (value.script && value.script.sections && Array.isArray(value.script.sections)) {
      const script = value.script;
      const meta = script.metadata || {};
      const copyBtnId = 'copy-script-' + Date.now();

      const sectionTypeLabels = {
        hook: { label: 'Hook' },
        intro: { label: 'Introduction' },
        main_content: { label: 'Main Content' },
        transition: { label: 'Transition' },
        cta: { label: 'Call to Action' },
        outro: { label: 'Outro' },
      };

      const formatDuration = (seconds) => {
        if (!seconds) return '';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        if (mins > 0) return `${mins}m ${secs}s`;
        return `${secs}s`;
      };

      container.innerHTML = `
        <div class="space-y-4">
          <!-- Header with metadata -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <svg class="w-5 h-5 text-primary/90 dark:text-primary/90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
              </svg>
              <span class="text-sm font-medium text-primary/90 dark:text-primary/90">Script: ${escapeHtml(meta.title || 'Untitled')}</span>
            </div>
            <button id="${copyBtnId}" class="inline-flex items-center px-3 py-1.5 text-sm font-medium text-primary/90 dark:text-primary/90 bg-primary/90/10 dark:bg-primary/90/40 hover:bg-primary/90/20 dark:hover:bg-primary/90/40 rounded-lg transition-colors">
              <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
              </svg>
              Copy Script
            </button>
          </div>

          <!-- Metadata pills -->
          <div class="flex flex-wrap gap-2">
            ${meta.platform ? `<span class="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full">${escapeHtml(meta.platform)}</span>` : ''}
            ${meta.format ? `<span class="px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded-full">${escapeHtml(meta.format)}</span>` : ''}
            ${meta.totalDuration ? `<span class="px-2 py-1 text-xs font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded-full">${formatDuration(meta.totalDuration)}</span>` : ''}
            ${meta.wordCount ? `<span class="px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full">${meta.wordCount} words</span>` : ''}
          </div>

          <!-- Hooks section -->
          ${script.hooks && script.hooks.length > 0 ? `
            <div class="bg-primary/90/5 dark:bg-primary/90/20 border border-primary/90/20 dark:border-primary/90/30 rounded-xl p-4">
              <div class="text-xs font-medium text-primary/90 dark:text-primary/90 uppercase tracking-wide mb-3">Hook Options</div>
              <div class="space-y-2">
                ${script.hooks.map((hook) => `
                  <div class="bg-white dark:bg-neutral-900 rounded-lg p-3 border border-primary/90/10 dark:border-primary/90/30">
                    <div class="flex items-start justify-between gap-2">
                      <p class="text-sm text-gray-800 dark:text-gray-200 flex-1">"${escapeHtml(hook.text)}"</p>
                      <span class="px-2 py-0.5 text-xs font-medium rounded ${hook.estimatedRetention === 'high' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}">${hook.estimatedRetention || 'medium'}</span>
                    </div>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">${escapeHtml(hook.type)} hook</p>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Script sections -->
          <div class="space-y-3">
            ${script.sections.map((section) => {
              const typeInfo = sectionTypeLabels[section.type] || { label: section.type };
              return `
                <div class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl overflow-hidden shadow-sm">
                  <div class="bg-primary/90 dark:bg-primary/90 px-4 py-2 flex items-center justify-between">
                    <span class="text-white font-medium text-sm">${typeInfo.label}</span>
                    <span class="text-white/80 text-xs">${escapeHtml(section.timestamp || '')} • ${section.duration || 0}s</span>
                  </div>
                  <div class="p-4 space-y-3">
                    <div>
                      <div class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Voiceover</div>
                      <div class="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">${escapeHtml(section.voiceover || '')}</div>
                    </div>
                    ${section.onScreenText ? `
                      <div>
                        <div class="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-1">On-Screen Text</div>
                        <div class="text-sm text-blue-700 dark:text-blue-300 font-medium">${escapeHtml(section.onScreenText)}</div>
                      </div>
                    ` : ''}
                    ${section.visualCues && section.visualCues.length > 0 ? `
                      <div>
                        <div class="text-xs font-medium text-primary/90 dark:text-primary/90 uppercase tracking-wide mb-1">Visual Cues</div>
                        <div class="flex flex-wrap gap-1">
                          ${section.visualCues.map(cue => `<span class="px-2 py-0.5 text-xs bg-primary/90/10 dark:bg-primary/90/40 text-primary/90 dark:text-primary/90 rounded">${escapeHtml(cue)}</span>`).join('')}
                        </div>
                      </div>
                    ` : ''}
                    ${section.bRollSuggestions && section.bRollSuggestions.length > 0 ? `
                      <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-lg p-2">
                        <div class="text-xs font-medium text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-1">B-Roll Suggestions</div>
                        <div class="text-xs text-amber-800 dark:text-amber-200">${section.bRollSuggestions.map(s => escapeHtml(s)).join(' • ')}</div>
                      </div>
                    ` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          <!-- Engagement score -->
          ${value.estimatedEngagement ? `
            <div class="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-800/30 rounded-xl p-4">
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-medium text-[#6D28D9] dark:text-[#C4B5FD]">Estimated Retention</span>
                <span class="text-2xl font-bold text-[#7C3AED] dark:text-[#A78BFA]">${value.estimatedEngagement.retentionScore}%</span>
              </div>
              ${value.estimatedEngagement.factors && value.estimatedEngagement.factors.length > 0 ? `
                <div class="flex flex-wrap gap-1 mt-2">
                  ${value.estimatedEngagement.factors.map(f => `<span class="px-2 py-0.5 text-xs bg-emerald-100 dark:bg-emerald-900/40 text-[#6D28D9] dark:text-[#C4B5FD] rounded">✓ ${escapeHtml(f)}</span>`).join('')}
                </div>
              ` : ''}
            </div>
          ` : ''}

          <!-- Production notes -->
          ${value.productionNotes && value.productionNotes.length > 0 ? `
            <div class="bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
              <div class="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">Production Notes</div>
              <ul class="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                ${value.productionNotes.map(note => `<li>• ${escapeHtml(note)}</li>`).join('')}
              </ul>
            </div>
          ` : ''}

          ${renderMetadataPills(metadata)}
        </div>
      `;

      const copyBtn = document.getElementById(copyBtnId);
      if (copyBtn) {
        copyBtn.addEventListener('click', () => {
          navigator.clipboard.writeText(script.fullScript || '');
          copyBtn.innerHTML = '<svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>Copied!';
          setTimeout(() => {
            copyBtn.innerHTML = '<svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>Copy Script';
          }, 2000);
        });
      }
      return;
    }

    if (value.success === true && typeof value.content === 'string' && value.content.length > 0) {
      const content = value.content;

      const slidePattern = /##\s*\*?\*?Slide\s+(\d+)/gi;
      const hasSlides = slidePattern.test(content);

      if (hasSlides) {
        const slides = parseSlides(content);
        const copyBtnId = 'copy-presentation-' + Date.now();

        container.innerHTML = `
          <div class="space-y-4">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <svg class="w-5 h-5 text-primary/90 dark:text-primary/90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"></path>
                </svg>
                <span class="text-sm font-medium text-primary/90 dark:text-primary/90">Presentation (${slides.length} Slides)</span>
              </div>
              <button id="${copyBtnId}" class="inline-flex items-center px-3 py-1.5 text-sm font-medium text-primary/90 dark:text-primary/90 bg-primary/90/10 dark:bg-primary/90/40 hover:bg-primary/90/20 dark:hover:bg-primary/90/40 rounded-lg transition-colors">
                <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                </svg>
                Copy All
              </button>
            </div>
            <div class="space-y-4">
              ${slides.map((slide, index) => `
                <div class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl overflow-hidden shadow-sm">
                  <div class="bg-gradient-to-r from-primary/90 to-indigo-500 px-4 py-2">
                    <span class="text-white font-medium text-sm">Slide ${index + 1}${slide.title ? ': ' + escapeHtml(slide.title) : ''}</span>
                  </div>
                  <div class="p-4 space-y-3">
                    ${slide.content ? `
                      <div>
                        <div class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Content</div>
                        <div class="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">${escapeHtml(slide.content)}</div>
                      </div>
                    ` : ''}
                    ${slide.visualElements ? `
                      <div>
                        <div class="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-1">Visual Elements</div>
                        <div class="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">${escapeHtml(slide.visualElements)}</div>
                      </div>
                    ` : ''}
                    ${slide.speakerNotes ? `
                      <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-lg p-3">
                        <div class="text-xs font-medium text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-1">Speaker Notes</div>
                        <div class="text-sm text-amber-800 dark:text-amber-200 whitespace-pre-wrap">${escapeHtml(slide.speakerNotes)}</div>
                      </div>
                    ` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
            ${renderMetadataPills(metadata)}
          </div>
        `;

        const copyBtn = document.getElementById(copyBtnId);
        if (copyBtn) {
          copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(content);
            copyBtn.innerHTML = '<svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>Copied!';
            setTimeout(() => {
              copyBtn.innerHTML = '<svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>Copy All';
            }, 2000);
          });
        }
        return;
      }

      container.innerHTML = `
        <div class="space-y-4">
          <div class="bg-[#E4DDF5] dark:bg-[#1C1529] border border-[#C9BDE8] dark:border-[#2E2243] rounded-ios-xl p-6">
            <div class="flex items-center gap-2 mb-3">
              <svg class="w-5 h-5 text-[#7C3AED] dark:text-[#A78BFA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <span class="text-sm font-medium text-[#6D28D9] dark:text-[#C4B5FD]">Generated Content</span>
            </div>
            <div class="text-base leading-relaxed text-gray-800 dark:text-gray-200">${renderMarkdown(content)}</div>
          </div>
          ${renderMetadataPills(metadata)}
        </div>
      `;
      // If markdown-it wasn't ready yet, re-render once loaded so content shows as formatted markdown, not raw
      if (!mdInstance && mdLoadPromise) {
        mdLoadPromise.then(() => {
          if (container.isConnected && value?.success === true && typeof value?.content === 'string') {
            container.innerHTML = `
              <div class="space-y-4">
                <div class="bg-[#E4DDF5] dark:bg-[#1C1529] border border-[#C9BDE8] dark:border-[#2E2243] rounded-ios-xl p-6">
                  <div class="flex items-center gap-2 mb-3">
                    <svg class="w-5 h-5 text-[#7C3AED] dark:text-[#A78BFA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <span class="text-sm font-medium text-[#6D28D9] dark:text-[#C4B5FD]">Generated Content</span>
                  </div>
                  <div class="text-base leading-relaxed text-gray-800 dark:text-gray-200">${renderMarkdown(value.content)}</div>
                </div>
                ${renderMetadataPills(metadata)}
              </div>
            `;
          }
        });
      }
      return;
    }

    if (value.translation && typeof value.translation === 'object') {
      const t = value.translation;
      const original = t.originalText || '';
      const translated = t.translatedText || '';
      const sourceLang = t.sourceLanguage || 'Unknown';
      const targetLang = t.targetLanguage || 'Unknown';

      // friendly message when no text was found
      if (!original.trim() && !translated.trim()) {
        const msg = (typeof value.message === 'string' && value.message) || 'No text was found in this image.';
        container.innerHTML = `
          <div class="space-y-4">
            <div class="rounded-ios-xl p-8 text-center flex flex-col items-center gap-3">
              <div class="w-12 h-12 rounded-full bg-neutral-200/60 dark:bg-white/5 flex items-center justify-center">
                <svg class="w-6 h-6 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path>
                </svg>
              </div>
              <div class="max-w-[280px]">
                <p class="text-[13px] text-gray-500 dark:text-gray-400">${escapeHtml(msg)}</p>
                <p class="text-[13px] text-gray-400 dark:text-gray-500 mt-1">Try uploading an image that contains text.</p>
              </div>
            </div>
            ${renderMetadataPills(metadata)}
          </div>
        `;
        return;
      }

      container.innerHTML = `
        <div class="space-y-4">
          <div class="bg-neutral-100 dark:bg-neutral-900/60 border border-black/5 dark:border-white/10 rounded-ios-xl p-4">
            <div class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Original (${escapeHtml(sourceLang)})</div>
            <pre class="text-sm whitespace-pre-wrap break-words">${escapeHtml(original)}</pre>
          </div>
          <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/30 rounded-ios-xl p-4">
            <div class="text-xs font-medium text-blue-600 dark:text-blue-400 mb-2">Translation (${escapeHtml(targetLang)})</div>
            <pre class="text-sm whitespace-pre-wrap break-words">${escapeHtml(translated)}</pre>
          </div>
          ${renderMetadataPills(metadata)}
        </div>
      `;
      return;
    }

    const templateKeys = Object.keys(value).filter(key => key.startsWith('template') && /^[A-Z]$/.test(key.slice(-1)));
    if (templateKeys.length > 0) {
      const variantColors = [
        { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800/30', text: 'text-blue-600 dark:text-blue-400' },
        { bg: 'bg-primary/90/5 dark:bg-primary/90/20', border: 'border-primary/90/20 dark:border-primary/90/30', text: 'text-primary/90 dark:text-primary/90' },
        { bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800/30', text: 'text-green-600 dark:text-green-400' },
      ];

      templateKeys.sort((a, b) => a.slice(-1).localeCompare(b.slice(-1)));

      container.innerHTML = `
        <div class="space-y-6">
          ${templateKeys.map((key, idx) => {
            const template = value[key];
            const variantLetter = key.slice(-1);
            const color = variantColors[idx % variantColors.length];
            const subject = typeof template.subject === 'string' ? template.subject : (template.subject?.text || '');
          
            let body = '';
            if (typeof template.body === 'string') {
              let bodyStr = template.body.replace(/\\n/g, '\n');
              if (bodyStr.trim().startsWith('[')) {
                try {
                  const arr = JSON.parse(bodyStr);
                  if (Array.isArray(arr)) {
                    bodyStr = arr.join('\n\n');
                  }
                } catch (e) { }
              }
              body = bodyStr;
            } else if (Array.isArray(template.body)) {
              body = template.body.join('\n\n');
            } else if (template.body && typeof template.body === 'object') {
              const parts = [];
              if (template.body.greeting) parts.push(template.body.greeting);
              if (template.body.opening) parts.push(template.body.opening);
              if (Array.isArray(template.body.content)) {
                parts.push(...template.body.content);
              } else if (template.body.content) {
                parts.push(template.body.content);
              }
              if (template.body.callToAction?.text) parts.push(template.body.callToAction.text);
              if (template.body.closingNote) parts.push(template.body.closingNote);
              if (template.body.signature) parts.push(template.body.signature);
              if (parts.length === 0) {
                const values = Object.values(template.body).filter(v => typeof v === 'string');
                if (values.length > 0) {
                  parts.push(...values);
                } else {
                  body = JSON.stringify(template.body, null, 2);
                }
              }
              if (parts.length > 0) body = parts.join('\n\n');
            }

            if (typeof body !== 'string') {
              body = typeof body === 'object' ? JSON.stringify(body, null, 2) : String(body || '');
            }

            return `
              <div class="space-y-4 ${idx > 0 ? 'mt-8' : ''}">
                <div class="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                  Version ${variantLetter}
                </div>
                <div class="${color.bg} ${color.border} border rounded-ios-xl p-4">
                  <div class="text-xs font-medium ${color.text} mb-2">Subject Line</div>
                  <div class="text-sm font-medium">${escapeHtml(subject)}</div>
                </div>
                <div class="bg-neutral-100 dark:bg-neutral-900/60 border border-black/5 dark:border-white/10 rounded-ios-xl p-4">
                  <div class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Email Body</div>
                  <pre class="text-sm whitespace-pre-wrap break-words font-sans">${escapeHtml(body)}</pre>
                </div>
              </div>
            `;
          }).join('')}
          ${renderMetadataPills(metadata)}
        </div>
      `;
      return;
    }

    if (value.resume && typeof value.resume === 'object' && typeof value.resume.content === 'string') {
      const resumeContent = value.resume.content;
      const resumeFormat = value.resume.format || 'markdown';
      const atsScore = typeof value.atsScore === 'number' ? value.atsScore : null;
      const atsDetails = value.atsDetails || null;
      const keywordAnalysis = value.keywordAnalysis || null;
      const suggestions = Array.isArray(value.suggestions) ? value.suggestions : [];
      const strengths = Array.isArray(value.strengths) ? value.strengths : [];
      const weaknesses = Array.isArray(value.weaknesses) ? value.weaknesses : [];
      const jobFitScore = typeof value.jobFitScore === 'number' ? value.jobFitScore : null;
      const copyBtnId = 'copy-resume-' + Date.now();

      let renderedContent = '';
      const iframeId = 'resume-iframe-' + Date.now();
      if (resumeFormat === 'html') {
        renderedContent = `<iframe id="${iframeId}" class="w-full bg-white rounded-lg" style="min-height: 800px; height: auto; border: none;" sandbox="allow-same-origin"></iframe>`;
      } else if (resumeFormat === 'json') {
        renderedContent = `<pre class="text-sm whitespace-pre-wrap break-words bg-white dark:bg-neutral-800 p-4 rounded-lg">${escapeHtml(resumeContent)}</pre>`;
      } else {
        renderedContent = `<div class="prose prose-sm dark:prose-invert max-w-none bg-white dark:bg-neutral-800 p-6 rounded-lg">${renderMarkdown(resumeContent)}</div>`;
      }

      let scoreColor = 'text-red-600 dark:text-red-400';
      let scoreBg = 'bg-red-100 dark:bg-red-900/30';
      if (atsScore >= 80) {
        scoreColor = 'text-green-600 dark:text-green-400';
        scoreBg = 'bg-green-100 dark:bg-green-900/30';
      } else if (atsScore >= 60) {
        scoreColor = 'text-yellow-600 dark:text-yellow-400';
        scoreBg = 'bg-yellow-100 dark:bg-yellow-900/30';
      }

      container.innerHTML = `
        <div class="space-y-6">
          <!-- Header with ATS Score -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <svg class="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              <span class="text-lg font-semibold text-gray-800 dark:text-gray-200">Generated Resume</span>
            </div>
            ${atsScore !== null ? `
              <div class="flex items-center gap-2">
                <span class="text-sm text-gray-600 dark:text-gray-400">ATS Score:</span>
                <span class="px-3 py-1 rounded-full ${scoreBg} ${scoreColor} font-bold">${atsScore}/100</span>
              </div>
            ` : ''}
          </div>

          <!-- Resume Content -->
          <div class="border border-gray-200 dark:border-neutral-700 rounded-xl overflow-hidden">
            ${renderedContent}
          </div>

          <!-- Copy Button -->
          <div class="flex justify-end">
            <button id="${copyBtnId}" class="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/40 hover:bg-blue-200 dark:hover:bg-blue-800/40 rounded-lg transition-colors">
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
              </svg>
              Copy Resume
            </button>
          </div>

          ${atsDetails ? `
            <!-- ATS Details -->
            <div class="bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-200 dark:border-neutral-700 rounded-xl p-4">
              <div class="flex items-center justify-between mb-3">
                <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300">AI-Powered ATS Analysis</h4>
                ${jobFitScore !== null ? `
                  <div class="flex items-center gap-2">
                    <span class="text-xs text-gray-500 dark:text-gray-400">Job Fit:</span>
                    <span class="px-2 py-0.5 rounded text-xs font-bold ${
                      jobFitScore >= 80 ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' :
                      jobFitScore >= 60 ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300' :
                      'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                    }">${jobFitScore}%</span>
                  </div>
                ` : ''}
              </div>
              <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div class="text-center p-2 bg-white dark:bg-neutral-800 rounded-lg">
                  <div class="text-xl font-bold text-blue-600 dark:text-blue-400">${atsDetails.formatting || 0}</div>
                  <div class="text-xs text-gray-500 dark:text-gray-400">Formatting</div>
                </div>
                <div class="text-center p-2 bg-white dark:bg-neutral-800 rounded-lg">
                  <div class="text-xl font-bold text-primary/90 dark:text-primary/90">${atsDetails.keywords || 0}</div>
                  <div class="text-xs text-gray-500 dark:text-gray-400">Keywords</div>
                </div>
                <div class="text-center p-2 bg-white dark:bg-neutral-800 rounded-lg">
                  <div class="text-xl font-bold text-green-600 dark:text-green-400">${atsDetails.structure || 0}</div>
                  <div class="text-xs text-gray-500 dark:text-gray-400">Structure</div>
                </div>
                <div class="text-center p-2 bg-white dark:bg-neutral-800 rounded-lg">
                  <div class="text-xl font-bold text-amber-600 dark:text-amber-400">${atsDetails.readability || 0}</div>
                  <div class="text-xs text-gray-500 dark:text-gray-400">Readability</div>
                </div>
                <div class="text-center p-2 bg-white dark:bg-neutral-800 rounded-lg">
                  <div class="text-xl font-bold text-teal-600 dark:text-teal-400">${atsDetails.actionVerbs || 0}</div>
                  <div class="text-xs text-gray-500 dark:text-gray-400">Action Verbs</div>
                </div>
                <div class="text-center p-2 bg-white dark:bg-neutral-800 rounded-lg">
                  <div class="text-xl font-bold text-rose-600 dark:text-rose-400">${atsDetails.quantification || 0}</div>
                  <div class="text-xs text-gray-500 dark:text-gray-400">Metrics</div>
                </div>
              </div>
            </div>
          ` : ''}

          ${keywordAnalysis ? `
            <!-- Keyword Analysis -->
            <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/30 rounded-xl p-4">
              <h4 class="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-3 flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path>
                </svg>
                Keyword Analysis
              </h4>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                ${keywordAnalysis.matched && keywordAnalysis.matched.length > 0 ? `
                  <div>
                    <span class="text-xs font-medium text-green-700 dark:text-green-300 block mb-1">Matched Keywords (${keywordAnalysis.matched.length})</span>
                    <div class="flex flex-wrap gap-1">
                      ${keywordAnalysis.matched.slice(0, 10).map(k => `<span class="px-2 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 text-xs rounded">${escapeHtml(k)}</span>`).join('')}
                      ${keywordAnalysis.matched.length > 10 ? `<span class="px-2 py-0.5 text-gray-500 text-xs">+${keywordAnalysis.matched.length - 10} more</span>` : ''}
                    </div>
                  </div>
                ` : ''}
                ${keywordAnalysis.missing && keywordAnalysis.missing.length > 0 ? `
                  <div>
                    <span class="text-xs font-medium text-red-700 dark:text-red-300 block mb-1">Missing Keywords (${keywordAnalysis.missing.length})</span>
                    <div class="flex flex-wrap gap-1">
                      ${keywordAnalysis.missing.slice(0, 10).map(k => `<span class="px-2 py-0.5 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 text-xs rounded">${escapeHtml(k)}</span>`).join('')}
                      ${keywordAnalysis.missing.length > 10 ? `<span class="px-2 py-0.5 text-gray-500 text-xs">+${keywordAnalysis.missing.length - 10} more</span>` : ''}
                    </div>
                  </div>
                ` : ''}
              </div>
              ${keywordAnalysis.semanticMatches && keywordAnalysis.semanticMatches.length > 0 ? `
                <div class="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700">
                  <span class="text-xs font-medium text-blue-700 dark:text-blue-300 block mb-1">Semantic Matches</span>
                  <div class="flex flex-wrap gap-2">
                    ${keywordAnalysis.semanticMatches.slice(0, 5).map(m => `
                      <span class="text-xs text-gray-600 dark:text-gray-400">"${escapeHtml(m.resumeTerm)}" ≈ "${escapeHtml(m.jobTerm)}"</span>
                    `).join('')}
                  </div>
                </div>
              ` : ''}
            </div>
          ` : ''}

          ${(strengths.length > 0 || weaknesses.length > 0) ? `
            <!-- Strengths & Weaknesses -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              ${strengths.length > 0 ? `
                <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/30 rounded-xl p-4">
                  <h4 class="text-sm font-semibold text-green-800 dark:text-green-200 mb-2 flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    Strengths
                  </h4>
                  <ul class="space-y-1">
                    ${strengths.map(s => `<li class="text-sm text-green-700 dark:text-green-300 flex gap-2"><span class="text-green-500">✓</span> ${escapeHtml(s)}</li>`).join('')}
                  </ul>
                </div>
              ` : ''}
              ${weaknesses.length > 0 ? `
                <div class="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800/30 rounded-xl p-4">
                  <h4 class="text-sm font-semibold text-orange-800 dark:text-orange-200 mb-2 flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                    </svg>
                    Areas to Improve
                  </h4>
                  <ul class="space-y-1">
                    ${weaknesses.map(w => `<li class="text-sm text-orange-700 dark:text-orange-300 flex gap-2"><span class="text-orange-500">!</span> ${escapeHtml(w)}</li>`).join('')}
                  </ul>
                </div>
              ` : ''}
            </div>
          ` : ''}

          ${suggestions.length > 0 ? `
            <!-- Suggestions -->
            <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-xl p-4">
              <h4 class="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-3 flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                Improvement Suggestions
              </h4>
              <ul class="space-y-2">
                ${suggestions.map(s => `
                  <li class="flex gap-2 text-sm">
                    <span class="flex-shrink-0 px-2 py-0.5 rounded text-xs font-medium ${
                      s.priority === 'high' ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300' :
                      s.priority === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300' :
                      'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                    }">${escapeHtml(s.priority || 'tip')}</span>
                    <span class="text-gray-700 dark:text-gray-300">${escapeHtml(s.recommendation || '')}</span>
                  </li>
                `).join('')}
              </ul>
            </div>
          ` : ''}

          ${renderMetadataPills(metadata)}
        </div>
      `;

      if (resumeFormat === 'html') {
        setTimeout(() => {
          const iframe = document.getElementById(iframeId);
          if (iframe) {
            const doc = iframe.contentDocument || iframe.contentWindow.document;
            doc.open();
            doc.write(resumeContent);
            doc.close();
            setTimeout(() => {
              try {
                const contentHeight = doc.body.scrollHeight || doc.documentElement.scrollHeight;
                iframe.style.height = Math.max(800, contentHeight + 40) + 'px';
              } catch (e) {
                iframe.style.height = '1000px';
              }
            }, 100);
          }
        }, 0);
      }

      const copyBtn = document.getElementById(copyBtnId);
      if (copyBtn) {
        copyBtn.addEventListener('click', () => {
          navigator.clipboard.writeText(resumeContent);
          copyBtn.innerHTML = '<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>Copied!';
          setTimeout(() => {
            copyBtn.innerHTML = '<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>Copy Resume';
          }, 2000);
        });
      }
      return;
    }

    if (value.seoScore !== undefined && value.grade !== undefined && value.scoreBreakdown !== undefined) {
      const seoScore = value.seoScore;
      const seoGrade = value.grade;
      const scoreBreakdown = value.scoreBreakdown;
      const optimized = value.optimizedContent || {};

      const seen = new Set();
      const improvements = (value.recommendations || [])
        .map(r => r.action || r.suggestion || r.message)
        .filter(msg => {
          if (seen.has(msg)) return false;
          seen.add(msg);
          return true;
        });

      const keywords = Array.isArray(value.keywords) ? value.keywords.map(k => k.keyword) : [];

      const title = value.meta?.title?.text || optimized.suggestedTitle || '';
      const metaDesc = value.meta?.description?.text || optimized.suggestedDescription || '';
      const headings = optimized.suggestedHeadings || [];

      let scoreColor = 'text-red-600';
      let scoreBg = 'bg-red-100 dark:bg-red-900/30';
      if (seoScore >= 80) {
        scoreColor = 'text-green-600 dark:text-green-400';
        scoreBg = 'bg-green-100 dark:bg-green-900/30';
      } else if (seoScore >= 60) {
        scoreColor = 'text-yellow-600 dark:text-yellow-400';
        scoreBg = 'bg-yellow-100 dark:bg-yellow-900/30';
      }

      container.innerHTML = `
        <div class="space-y-4">
          <!-- Header with SEO Score -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <svg class="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
              </svg>
              <span class="text-lg font-semibold text-gray-800 dark:text-gray-200">SEO Analysis</span>
            </div>
            ${seoScore !== null ? `
              <div class="flex items-center gap-3">
                ${seoGrade ? `<span class="px-2 py-1 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold text-lg">${escapeHtml(seoGrade)}</span>` : ''}
                <div class="flex items-center gap-2">
                  <span class="text-sm text-gray-600 dark:text-gray-400">Score:</span>
                  <span class="px-3 py-1 rounded-full ${scoreBg} ${scoreColor} font-bold">${seoScore}/100</span>
                </div>
              </div>
            ` : ''}
          </div>

          ${scoreBreakdown ? `
            <!-- Score Breakdown -->
            <div class="grid grid-cols-3 sm:grid-cols-6 gap-3">
              ${Object.entries(scoreBreakdown).map(([key, val]) => `
                <div class="text-center p-3 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg">
                  <div class="text-xl font-bold ${val >= 80 ? 'text-green-600' : val >= 60 ? 'text-yellow-600' : 'text-red-600'}">${val}</div>
                  <div class="text-xs text-gray-500 dark:text-gray-400 capitalize">${escapeHtml(key.replace(/([A-Z])/g, ' $1').trim())}</div>
                </div>
              `).join('')}
            </div>
          ` : ''}

          ${title ? `
            <!-- Optimized Title -->
            <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/30 rounded-xl p-4">
              <div class="text-xs font-medium text-blue-600 dark:text-blue-400 mb-2">Optimized Title</div>
              <p class="text-gray-800 dark:text-gray-200 font-medium">${escapeHtml(title)}</p>
            </div>
          ` : ''}

          ${metaDesc ? `
            <!-- Meta Description -->
            <div class="bg-primary/90/5 dark:bg-primary/90/20 border border-primary/90/20 dark:border-primary/90/30 rounded-xl p-4">
              <div class="text-xs font-medium text-primary/90 dark:text-primary/90 mb-2">Meta Description</div>
              <p class="text-gray-700 dark:text-gray-300 text-sm">${escapeHtml(metaDesc)}</p>
              <div class="mt-2 text-xs text-gray-500">${metaDesc.length} characters</div>
            </div>
          ` : ''}

          ${Array.isArray(keywords) && keywords.length > 0 ? `
            <!-- Keywords -->
            <div class="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800/30 rounded-xl p-4">
              <div class="text-xs font-medium text-teal-600 dark:text-teal-400 mb-2">Keywords</div>
              <div class="flex flex-wrap gap-1.5">
                ${keywords.map(kw => `<span class="px-2 py-1 bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 text-sm rounded">${escapeHtml(kw)}</span>`).join('')}
              </div>
            </div>
          ` : ''}

          ${Array.isArray(headings) && headings.length > 0 ? `
            <!-- Suggested Headings/Keywords -->
            <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-xl p-4">
              <div class="text-xs font-medium text-amber-600 dark:text-amber-400 mb-2">Suggested Headings</div>
              <ul class="space-y-1">
                ${headings.map(h => `<li class="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2"><span class="text-amber-500">•</span> ${escapeHtml(h)}</li>`).join('')}
              </ul>
            </div>
          ` : ''}

          ${Array.isArray(improvements) && improvements.length > 0 ? `
            <!-- Improvements -->
            <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/30 rounded-xl p-4">
              <div class="text-xs font-medium text-green-600 dark:text-green-400 mb-2 flex items-center gap-1">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                Improvements Made
              </div>
              <ul class="space-y-1">
                ${improvements.map(imp => `<li class="text-sm text-green-700 dark:text-green-300 flex items-start gap-2"><span class="text-green-500">✓</span> ${escapeHtml(imp)}</li>`).join('')}
              </ul>
            </div>
          ` : ''}

          ${renderMetadataPills(metadata)}
        </div>
      `;
      return;
    }

    // Social Media Caption (single caption format)
    if (typeof value.caption === 'string' && value.caption.length > 0) {
      const caption = value.caption;
      const hashtags = Array.isArray(value.hashtags) ? value.hashtags : [];
      let emojis = [];
      if (Array.isArray(value.emojis)) {
        emojis = value.emojis;
      } else if (typeof value.emoji === 'string') {
        emojis = [value.emoji];
      } else if (typeof value.emojis === 'string') {
        emojis = [value.emojis];
      }
      const tone = value.tone || (value.engagementTactics && value.engagementTactics.tone) || '';
      const engagement = value.engagement_potential || value.engagement ||
        (value.engagement_strategy && value.engagement_strategy.style) || '';
      const platform = value.platform || '';
      const charCount = value.characterCount || value.character_count || null;
      const cta = (value.engagementTactics && value.engagementTactics.callToAction) ||
        (value.engagement_strategy && value.engagement_strategy.call_to_action) || '';
      const copyId = 'copy-caption-' + Date.now();
      const copyText = caption + (hashtags.length > 0 ? '\n\n' + hashtags.join(' ') : '');

      const platformIcons = {
        instagram: '📸', twitter: '𝕏', linkedin: '💼', tiktok: '🎵',
        facebook: '📘', threads: '🧵', pinterest: '📌'
      };
      const platformIcon = platform ? (platformIcons[platform.toLowerCase()] || '📱') : '📱';
      const platformName = platform ? platform.charAt(0).toUpperCase() + platform.slice(1) : '';

      container.innerHTML = `
        <div class="space-y-4">
          <div class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl overflow-hidden shadow-sm">
            <div class="bg-gradient-to-r from-primary/90 to-pink-500 px-4 py-3 flex items-center justify-between">
              <span class="text-white font-medium text-sm flex items-center gap-2">
                <span>${platformIcon}</span> ${platformName ? escapeHtml(platformName) + ' Caption' : 'Generated Caption'}
                ${tone ? `<span class="opacity-75 text-xs">• ${escapeHtml(tone)}</span>` : ''}
              </span>
              <div class="flex items-center gap-2">
                ${charCount ? `<span class="bg-primary-foreground/20 px-2 py-0.5 rounded text-white text-xs">${charCount} chars</span>` : ''}
                ${engagement ? `<span class="bg-primary-foreground/20 px-2 py-0.5 rounded text-white text-xs">${escapeHtml(engagement)}</span>` : ''}
              </div>
            </div>
            <div class="p-4">
              <p class="text-gray-800 dark:text-gray-200 whitespace-pre-wrap text-base leading-relaxed mb-4">${escapeHtml(caption)}</p>
              ${hashtags.length > 0 ? `
                <div class="mb-4">
                  <div class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Hashtags</div>
                  <div class="flex flex-wrap gap-1.5">
                    ${hashtags.map(tag => `<span class="px-2 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-sm rounded-full">${escapeHtml(String(tag).startsWith('#') ? tag : '#' + tag)}</span>`).join('')}
                  </div>
                </div>
              ` : ''}
              ${emojis.length > 0 ? `
                <div class="mb-4">
                  <div class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Suggested Emojis</div>
                  <div class="flex gap-2 text-2xl">${emojis.map(e => escapeHtml(e)).join(' ')}</div>
                </div>
              ` : ''}
              ${cta ? `
                <div class="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-lg">
                  <div class="text-xs font-medium text-amber-600 dark:text-amber-400 mb-1">Call to Action</div>
                  <p class="text-sm text-amber-800 dark:text-amber-200">${escapeHtml(cta)}</p>
                </div>
              ` : ''}
              <button id="${copyId}" class="inline-flex items-center px-4 py-2 text-sm font-medium text-primary/90 dark:text-primary/90 bg-primary/90/10 dark:bg-primary/90/40 hover:bg-primary/90/20 dark:hover:bg-primary/90/40 rounded-lg transition-colors">
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                </svg>
                Copy Caption
              </button>
            </div>
          </div>
          ${renderMetadataPills(metadata)}
        </div>
      `;

      const copyBtn = document.getElementById(copyId);
      if (copyBtn) {
        copyBtn.addEventListener('click', () => {
          navigator.clipboard.writeText(copyText);
          copyBtn.innerHTML = '<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>Copied!';
          setTimeout(() => {
            copyBtn.innerHTML = '<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>Copy Caption';
          }, 2000);
        });
      }
      return;
    }

    // Social Media Captions (array format)
    if (Array.isArray(value.captions) && value.captions.length > 0 && value.captions[0].text) {
      const captions = value.captions;
      const platformColors = {
        instagram: { bg: 'bg-gradient-to-r from-primary/90 to-pink-500', icon: '📸' },
        twitter: { bg: 'bg-blue-500', icon: '𝕏' },
        linkedin: { bg: 'bg-blue-700', icon: '💼' },
        tiktok: { bg: 'bg-black', icon: '🎵' },
        facebook: { bg: 'bg-blue-600', icon: '📘' },
        threads: { bg: 'bg-black', icon: '🧵' },
        pinterest: { bg: 'bg-red-600', icon: '📌' },
      };

      container.innerHTML = `
        <div class="space-y-4">
          <div class="flex items-center gap-2 mb-4">
            <svg class="w-5 h-5 text-primary/90 dark:text-primary/90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path>
            </svg>
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">${captions.length} Caption${captions.length > 1 ? 's' : ''} Generated</span>
          </div>

          ${captions.map((caption, idx) => {
            const platform = caption.platform || 'instagram';
            const colors = platformColors[platform] || platformColors.instagram;
            const copyId = 'copy-caption-' + Date.now() + '-' + idx;

            return `
              <div class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl overflow-hidden shadow-sm">
                <div class="${colors.bg} px-4 py-2 flex items-center justify-between">
                  <span class="text-white font-medium text-sm flex items-center gap-2">
                    <span>${colors.icon}</span>
                    ${escapeHtml(platform.charAt(0).toUpperCase() + platform.slice(1))}
                    ${caption.style ? `<span class="opacity-75">• ${escapeHtml(caption.style)}</span>` : ''}
                  </span>
                  ${caption.engagement ? `<span class="text-white/80 text-xs">Engagement: ${escapeHtml(caption.engagement)}</span>` : ''}
                </div>
                <div class="p-4">
                  <p class="text-gray-800 dark:text-gray-200 whitespace-pre-wrap mb-3">${escapeHtml(caption.text)}</p>
                  ${Array.isArray(caption.hashtags) && caption.hashtags.length > 0 ? `
                    <div class="flex flex-wrap gap-1 mb-3">
                      ${caption.hashtags.map(tag => `<span class="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs rounded-full">${escapeHtml(String(tag).startsWith('#') ? tag : '#' + tag)}</span>`).join('')}
                    </div>
                  ` : ''}
                  <button data-copy-id="${copyId}" data-copy-text="${escapeHtml(caption.text + (Array.isArray(caption.hashtags) && caption.hashtags.length > 0 ? '\n\n' + caption.hashtags.join(' ') : ''))}" class="copy-caption-btn inline-flex items-center px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 rounded-lg transition-colors">
                    <svg class="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                    </svg>
                    Copy
                  </button>
                </div>
              </div>
            `;
          }).join('')}
          ${renderMetadataPills(metadata)}
        </div>
      `;

      container.querySelectorAll('.copy-caption-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const text = btn.getAttribute('data-copy-text');
          navigator.clipboard.writeText(text);
          btn.innerHTML = '<svg class="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>Copied!';
          setTimeout(() => {
            btn.innerHTML = '<svg class="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>Copy';
          }, 2000);
        });
      });
      return;
    }

    const strategyData = value.strategy || (value.content && typeof value.content === 'object' && value.content.strategy);
    if (strategyData && strategyData.contentPillars && strategyData.weeklyCalendar) {
      const strategy = strategyData;
      const brandName = value.brandName || 'Your Brand';
      const timeframe = value.timeframe || '1 Month';
      const goals = value.goals || 'Brand Awareness';

      const categoryColors = {
        engagement: { bg: 'bg-[#E4DDF5] dark:bg-[#1C1529]', text: 'text-[#1C1529] dark:text-white', icon: '💬' },
        traffic: { bg: 'bg-[#E4DDF5] dark:bg-[#1C1529]', text: 'text-[#1C1529] dark:text-white', icon: '📈' },
        conversion: { bg: 'bg-[#E4DDF5] dark:bg-[#1C1529]', text: 'text-[#1C1529] dark:text-white', icon: '🎯' },
        seo: { bg: 'bg-[#E4DDF5] dark:bg-[#1C1529]', text: 'text-[#1C1529] dark:text-white', icon: '🔍' },
      };

      const pillarColors = [
        'bg-[#E4DDF5] dark:bg-[#1C1529]',
        'bg-[#E4DDF5] dark:bg-[#1C1529]',
        'bg-[#E4DDF5] dark:bg-[#1C1529]',
        'bg-[#E4DDF5] dark:bg-[#1C1529]',
      ];

      container.innerHTML = `
        <div class="space-y-6">
          <!-- Header -->
          <div class="bg-gradient-to-r from-indigo-600 to-primary/90 rounded-xl p-6 text-white">
            <div class="flex items-center gap-3 mb-2">
              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              <h2 class="text-xl font-bold">Content Strategy for ${escapeHtml(brandName)}</h2>
            </div>
            <div class="flex flex-wrap gap-3 text-sm opacity-90">
              <span class="bg-primary-foreground/20 px-3 py-1 rounded-full">📅 ${escapeHtml(timeframe)}</span>
              <span class="bg-primary-foreground/20 px-3 py-1 rounded-full">🎯 ${escapeHtml(goals)}</span>
              <span class="bg-primary-foreground/20 px-3 py-1 rounded-full">📊 ${strategy.contentPillars?.length || 0} Pillars</span>
              <span class="bg-primary-foreground/20 px-3 py-1 rounded-full">📝 ${strategy.weeklyCalendar?.length || 0} Weeks</span>
            </div>
          </div>

          <!-- Content Pillars -->
          <div class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl overflow-hidden">
            <div class="bg-gray-50 dark:bg-neutral-800 px-4 py-3 border-b border-gray-200 dark:border-neutral-700">
              <h3 class="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                <span class="text-lg">🏛️</span> Content Pillars
              </h3>
            </div>
            <div class="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              ${(strategy.contentPillars || []).map((pillar, idx) => `
                <div class="${pillarColors[idx % pillarColors.length]} rounded-lg p-4 text-[#1C1529] dark:text-white">
                  <h4 class="font-bold text-lg mb-2">${escapeHtml(pillar.name)}</h4>
                  <p class="text-sm opacity-80 mb-3">${escapeHtml(pillar.focus)}</p>
                  ${pillar.painPoints && pillar.painPoints.length > 0 ? `
                    <div class="mb-2">
                      <span class="text-xs font-semibold opacity-65">Pain Points:</span>
                      <div class="flex flex-wrap gap-1 mt-1">
                        ${pillar.painPoints.slice(0, 3).map(p => `<span class="bg-black/10 dark:bg-primary-foreground/20 px-2 py-0.5 rounded text-xs">${escapeHtml(p)}</span>`).join('')}
                      </div>
                    </div>
                  ` : ''}
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Weekly Calendar -->
          <div class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl overflow-hidden">
            <div class="bg-gray-50 dark:bg-neutral-800 px-4 py-3 border-b border-gray-200 dark:border-neutral-700">
              <h3 class="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                <span class="text-lg">📅</span> Weekly Content Calendar
              </h3>
            </div>
            <div class="p-4 space-y-4">
              ${(strategy.weeklyCalendar || []).map(week => `
                <details class="group border border-gray-200 dark:border-neutral-700 rounded-lg overflow-hidden">
                  <summary class="bg-gray-50 dark:bg-neutral-800 px-4 py-3 cursor-pointer flex items-center justify-between hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors">
                    <span class="font-medium text-gray-800 dark:text-gray-200">
                      Week ${week.week}: ${escapeHtml(week.theme || 'Content Week')}
                    </span>
                    <span class="text-sm text-gray-500 dark:text-gray-400">${week.content?.length || 0} items</span>
                  </summary>
                  <div class="p-4 space-y-2">
                    ${(week.content || []).map(item => {
                      const typeColors = {
                        blog: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
                        social: 'bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300',
                        video: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
                        email: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
                      };
                      const typeColor = typeColors[item.type?.toLowerCase()] || 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300';
                      return `
                        <div class="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800">
                          <span class="w-20 text-sm font-medium text-gray-500 dark:text-gray-400">${escapeHtml(item.day || '')}</span>
                          <span class="px-2 py-0.5 text-xs font-medium rounded ${typeColor}">${escapeHtml(item.type || '')}</span>
                          <span class="flex-1 text-sm text-gray-800 dark:text-gray-200">${escapeHtml(item.title || '')}</span>
                          <span class="text-xs text-gray-400 dark:text-gray-500">${escapeHtml(item.platform || '')}</span>
                        </div>
                      `;
                    }).join('')}
                  </div>
                </details>
              `).join('')}
            </div>
          </div>

          <!-- SEO Keywords -->
          ${strategy.seoKeywords ? `
            <div class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl overflow-hidden">
              <div class="bg-gray-50 dark:bg-neutral-800 px-4 py-3 border-b border-gray-200 dark:border-neutral-700">
                <h3 class="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                  <span class="text-lg">🔍</span> SEO Keywords
                </h3>
              </div>
              <div class="p-4">
                <div class="mb-4">
                  <h4 class="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">Primary Keywords</h4>
                  <div class="flex flex-wrap gap-2">
                    ${(strategy.seoKeywords.primary || []).map(kw => {
                      const diffColor = kw.difficulty === 'low' ? 'border-green-400' : kw.difficulty === 'high' ? 'border-red-400' : 'border-yellow-400';
                      return `<span class="px-3 py-1.5 bg-gray-100 dark:bg-neutral-800 border-l-4 ${diffColor} rounded text-sm">
                        ${escapeHtml(kw.keyword)} <span class="text-gray-400 text-xs">(${kw.monthlyVolume}/mo)</span>
                      </span>`;
                    }).join('')}
                  </div>
                </div>
                <div>
                  <h4 class="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">Long-tail Keywords</h4>
                  <div class="flex flex-wrap gap-2">
                    ${(strategy.seoKeywords.longTail || []).slice(0, 6).map(kw => `
                      <span class="px-2 py-1 bg-gray-50 dark:bg-neutral-800 text-gray-600 dark:text-gray-400 rounded text-xs">
                        ${escapeHtml(kw.keyword)}
                      </span>
                    `).join('')}
                  </div>
                </div>
              </div>
            </div>
          ` : ''}

          <!-- KPIs -->
          ${strategy.kpis && strategy.kpis.length > 0 ? `
            <div class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl overflow-hidden">
              <div class="bg-gray-50 dark:bg-neutral-800 px-4 py-3 border-b border-gray-200 dark:border-neutral-700">
                <h3 class="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                  <span class="text-lg">📊</span> Success Metrics (KPIs)
                </h3>
              </div>
              <div class="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                ${strategy.kpis.map(kpi => {
                  const cat = categoryColors[kpi.category] || categoryColors.engagement;
                  return `
                    <div class="p-3 rounded-lg ${cat.bg} text-center">
                      <span class="text-2xl">${cat.icon}</span>
                      <div class="font-bold ${cat.text} mt-1">${escapeHtml(kpi.target)}</div>
                      <div class="text-xs text-[#1C1529]/60 dark:text-gray-300">${escapeHtml(kpi.metric)}</div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          ` : ''}

          ${renderMetadataPills(metadata)}
        </div>
      `;
      return;
    }

    // KW SEO Tool output
    if (Array.isArray(value.primaryKeywords) && Array.isArray(value.longTailKeywords)) {
      const topic = value.topic || 'Keyword Research';
      const industry = value.industry || '';
      const primaryKeywords = value.primaryKeywords || [];
      const longTailKeywords = value.longTailKeywords || [];
      const relatedQuestions = value.relatedQuestions || [];
      const contentSuggestions = value.contentSuggestions || [];
      const onPageSeoTips = value.onPageSeoTips || [];

      const difficultyStyle = {
        low: 'text-[#7C3AED] dark:text-[#A78BFA] bg-emerald-50 dark:bg-emerald-500/10',
        medium: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10',
        high: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10',
      };

      const intentStyle = {
        informational: 'text-blue-600 dark:text-blue-400',
        navigational: 'text-violet-600 dark:text-violet-400',
        transactional: 'text-[#7C3AED] dark:text-[#A78BFA]',
        commercial: 'text-orange-600 dark:text-orange-400',
      };

      container.innerHTML = `
        <div class="space-y-6">
          <!-- Header -->
          <div class="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-neutral-700">
            <div>
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">${escapeHtml(topic)}</h2>
              ${industry ? `<p class="text-sm text-gray-500 dark:text-gray-400">${escapeHtml(industry)}</p>` : ''}
            </div>
            <div class="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
              <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-emerald-500"></span>Low</span>
              <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-amber-500"></span>Medium</span>
              <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-rose-500"></span>High</span>
            </div>
          </div>

          <!-- Primary Keywords -->
          ${primaryKeywords.length > 0 ? `
            <div class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-4">
              <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">Primary Keywords</h3>
              <div class="divide-y divide-gray-100 dark:divide-neutral-800">
                ${primaryKeywords.map(kw => {
                  const diff = difficultyStyle[kw.difficulty] || difficultyStyle.medium;
                  const intent = intentStyle[kw.intent] || intentStyle.informational;
                  return `
                    <div class="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                      <div>
                        <span class="text-sm font-medium text-gray-900 dark:text-white">${escapeHtml(kw.keyword)}</span>
                        <span class="ml-2 text-xs ${intent}">${escapeHtml(kw.intent)}</span>
                      </div>
                      <div class="flex items-center gap-3">
                        <span class="text-xs text-gray-500 dark:text-gray-400">${escapeHtml(kw.searchVolume)}/mo</span>
                        <span class="px-2 py-0.5 text-xs font-medium rounded-full ${diff}">${escapeHtml(kw.difficulty)}</span>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Long-tail Keywords -->
          ${longTailKeywords.length > 0 ? `
            <div class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-4">
              <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">Long-tail Keywords</h3>
              <div class="flex flex-wrap gap-2">
                ${longTailKeywords.map(kw => `
                    <span class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg">
                      <span class="text-gray-700 dark:text-gray-300">${escapeHtml(kw.keyword)}</span>
                      <span class="text-xs text-gray-400">${escapeHtml(kw.searchVolume)}</span>
                    </span>
                  `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Related Questions -->
          ${relatedQuestions.length > 0 ? `
            <div class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-4">
              <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">People Also Ask</h3>
              <div class="space-y-3">
                ${relatedQuestions.map(q => `
                    <div class="pl-3 border-l-2 border-blue-300 dark:border-blue-600">
                      <p class="text-sm text-gray-900 dark:text-white">${escapeHtml(q.question)}</p>
                      ${q.contentTip ? `<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">${escapeHtml(q.contentTip)}</p>` : ''}
                    </div>
                  `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Content Suggestions -->
          ${contentSuggestions.length > 0 ? `
            <div class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-4">
              <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">Content Ideas</h3>
              <div class="space-y-3">
                ${contentSuggestions.map(cs => `
                  <div class="p-3 bg-gray-50 dark:bg-neutral-800/50 rounded-lg">
                    <div class="flex items-start justify-between gap-2">
                      <span class="text-sm font-medium text-gray-900 dark:text-white">${escapeHtml(cs.title)}</span>
                      <span class="shrink-0 px-2 py-0.5 text-xs font-medium text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10 rounded">${escapeHtml(cs.type)}</span>
                    </div>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Target: <span class="text-gray-700 dark:text-gray-300">${escapeHtml(cs.targetKeyword)}</span></p>
                    ${cs.outline && cs.outline.length > 0 ? `
                      <ul class="mt-2 text-xs text-gray-600 dark:text-gray-400 space-y-1">
                        ${cs.outline.map(item => `<li class="flex items-start gap-2"><span class="text-gray-400 mt-0.5">—</span> ${escapeHtml(item)}</li>`).join('')}
                      </ul>
                    ` : ''}
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- SEO Tips -->
          ${onPageSeoTips.length > 0 ? `
            <div class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-4">
              <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">SEO Tips</h3>
              <div class="grid gap-3 sm:grid-cols-2">
                ${onPageSeoTips.map(tip => `
                  <div class="p-3 bg-amber-50/50 dark:bg-amber-500/5 border border-amber-200/50 dark:border-amber-500/20 rounded-lg">
                    <div class="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">${escapeHtml(tip.area.replace(/-/g, ' '))}</div>
                    <p class="text-sm text-gray-800 dark:text-gray-200 mt-1">${escapeHtml(tip.tip)}</p>
                    ${tip.example ? `<p class="text-xs text-gray-500 dark:text-gray-400 mt-1.5 italic">"${escapeHtml(tip.example)}"</p>` : ''}
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          ${renderMetadataPills(metadata)}
        </div>
      `;
      return;
    }

    // Instant SEO Blog output
    if (value.title && value.metaDescription && Array.isArray(value.sections) && value.seoAnalysis) {
      const title = value.title || '';
      const metaDescription = value.metaDescription || '';
      const slug = value.slug || '';
      const excerpt = value.excerpt || '';
      const sections = value.sections || [];
      const conclusion = value.conclusion || '';
      const seoAnalysis = value.seoAnalysis || {};
      const tags = value.tags || [];
      const copyBtnId = 'copy-blog-' + Date.now();

      let fullMarkdown = `# ${title}\n\n`;
      if (excerpt) fullMarkdown += `*${excerpt}*\n\n`;
      for (const section of sections) {
        fullMarkdown += `## ${section.heading}\n\n${section.content}\n\n`;
        if (section.subheadings) {
          for (const sub of section.subheadings) {
            fullMarkdown += `### ${sub.heading}\n\n${sub.content}\n\n`;
          }
        }
      }
      if (conclusion) fullMarkdown += `## Conclusion\n\n${conclusion}\n`;

      container.innerHTML = `
        <div class="space-y-5">
          <!-- Header with title and meta -->
          <div class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden">
            <div class="p-4 border-b border-gray-100 dark:border-neutral-800">
              <div class="flex items-start justify-between gap-3">
                <div class="flex-1">
                  <h2 class="text-lg font-bold text-gray-900 dark:text-white">${escapeHtml(title)}</h2>
                  ${slug ? `<p class="text-xs text-gray-400 dark:text-gray-500 mt-1 font-mono">/${escapeHtml(slug)}</p>` : ''}
                </div>
                <button id="${copyBtnId}" class="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 rounded-lg transition-colors">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                  Copy
                </button>
              </div>
            </div>
            <div class="p-4 bg-gray-50 dark:bg-neutral-800/50">
              <div class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Meta Description</div>
              <p class="text-sm text-gray-700 dark:text-gray-300">${escapeHtml(metaDescription)}</p>
            </div>
          </div>

          <!-- SEO Stats -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg p-3 text-center">
              <div class="text-lg font-bold text-gray-900 dark:text-white">${seoAnalysis.wordCount || '—'}</div>
              <div class="text-xs text-gray-500 dark:text-gray-400">Words</div>
            </div>
            <div class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg p-3 text-center">
              <div class="text-lg font-bold text-gray-900 dark:text-white">${escapeHtml(seoAnalysis.estimatedReadTime || '—')}</div>
              <div class="text-xs text-gray-500 dark:text-gray-400">Read Time</div>
            </div>
            <div class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg p-3 text-center">
              <div class="text-lg font-bold text-gray-900 dark:text-white">${escapeHtml(seoAnalysis.readabilityScore || '—')}</div>
              <div class="text-xs text-gray-500 dark:text-gray-400">Readability</div>
            </div>
            <div class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg p-3 text-center">
              <div class="text-lg font-bold text-[#7C3AED] dark:text-[#A78BFA]">${sections.length}</div>
              <div class="text-xs text-gray-500 dark:text-gray-400">Sections</div>
            </div>
          </div>

          <!-- Primary Keyword -->
          ${seoAnalysis.primaryKeyword ? `
            <div class="flex items-center gap-2 text-sm">
              <span class="text-gray-500 dark:text-gray-400">Primary Keyword:</span>
              <span class="px-2 py-0.5 bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 rounded font-medium">${escapeHtml(seoAnalysis.primaryKeyword)}</span>
            </div>
          ` : ''}

          <!-- Blog Content -->
          <div class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-5">
            <article class="prose prose-sm dark:prose-invert max-w-none">
              ${excerpt ? `<p class="lead text-gray-600 dark:text-gray-400 italic border-l-4 border-gray-200 dark:border-gray-700 pl-4 my-4">${escapeHtml(excerpt)}</p>` : ''}

              ${sections.map(section => `
                <h2 class="text-base font-semibold text-gray-900 dark:text-white mt-6 mb-3">${escapeHtml(section.heading)}</h2>
                <div class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">${escapeHtml(section.content)}</div>
                ${section.subheadings ? section.subheadings.map(sub => `
                  <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-4 mb-2">${escapeHtml(sub.heading)}</h3>
                  <div class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">${escapeHtml(sub.content)}</div>
                `).join('') : ''}
              `).join('')}

              ${conclusion ? `
                <h2 class="text-base font-semibold text-gray-900 dark:text-white mt-6 mb-3">Conclusion</h2>
                <div class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">${escapeHtml(conclusion)}</div>
              ` : ''}
            </article>
          </div>

          <!-- Tags -->
          ${tags.length > 0 ? `
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-xs text-gray-500 dark:text-gray-400">Tags:</span>
              ${tags.map(tag => `
                <span class="px-2 py-1 text-xs bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-400 rounded">${escapeHtml(tag)}</span>
              `).join('')}
            </div>
          ` : ''}

          ${renderMetadataPills(metadata)}
        </div>
      `;

      const copyBtn = document.getElementById(copyBtnId);
      if (copyBtn) {
        copyBtn.addEventListener('click', () => {
          navigator.clipboard.writeText(fullMarkdown);
          copyBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>Copied!';
          setTimeout(() => {
            copyBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>Copy';
          }, 2000);
        });
      }
      return;
    }

    // AI Social Creator output
    if (Array.isArray(value.posts) && Array.isArray(value.contentPillars) && value.posts[0]?.caption) {
      const posts = value.posts || [];
      const contentPillars = value.contentPillars || [];
      const platformTips = value.platformTips || [];
      const duration = value.duration || '';
      const postFrequency = value.postFrequency || '';

      const platformColors = {
        'instagram': 'bg-gradient-to-r from-primary/90 to-pink-500',
        'tiktok': 'bg-black',
        'linkedin': 'bg-blue-700',
        'twitter/x': 'bg-black',
        'twitter': 'bg-blue-500',
        'facebook': 'bg-blue-600',
      };

      const contentTypeIcons = {
        'image': '🖼️',
        'carousel': '📑',
        'video': '🎬',
        'reel': '🎞️',
        'story': '⏱️',
        'text': '📝',
        'thread': '🧵',
        'poll': '📊',
      };

      // Group posts by day
      const postsByDay = {};
      for (const post of posts) {
        const day = post.day || 1;
        if (!postsByDay[day]) postsByDay[day] = [];
        postsByDay[day].push(post);
      }
      const days = Object.keys(postsByDay).sort((a, b) => Number(a) - Number(b));

      container.innerHTML = `
        <div class="space-y-5">
          <!-- Header -->
          <div class="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-neutral-700">
            <div>
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Content Calendar</h2>
              <p class="text-sm text-gray-500 dark:text-gray-400">${escapeHtml(duration)} • ${escapeHtml(postFrequency)} • ${posts.length} posts</p>
            </div>
          </div>

          <!-- Content Pillars -->
          ${contentPillars.length > 0 ? `
            <div class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-4">
              <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">Content Pillars</h3>
              <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                ${contentPillars.map(pillar => `
                  <div class="p-3 bg-gray-50 dark:bg-neutral-800/50 rounded-lg">
                    <div class="flex items-center justify-between mb-1">
                      <span class="text-sm font-medium text-gray-900 dark:text-white">${escapeHtml(pillar.name)}</span>
                      <span class="text-xs text-gray-500 dark:text-gray-400">${pillar.percentage}%</span>
                    </div>
                    <p class="text-xs text-gray-600 dark:text-gray-400">${escapeHtml(pillar.description)}</p>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Calendar Posts -->
          <div class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden">
            <div class="p-4 border-b border-gray-100 dark:border-neutral-800">
              <h3 class="text-sm font-semibold text-gray-900 dark:text-white">Scheduled Posts</h3>
            </div>
            <div class="divide-y divide-gray-100 dark:divide-neutral-800">
              ${days.map(day => {
                const dayPosts = postsByDay[day];
                const firstPost = dayPosts[0];
                return `
                  <div class="p-4">
                    <div class="flex items-center gap-2 mb-3">
                      <span class="w-8 h-8 flex items-center justify-center bg-gray-100 dark:bg-neutral-800 rounded-full text-sm font-bold text-gray-700 dark:text-gray-300">${day}</span>
                      <span class="text-sm font-medium text-gray-600 dark:text-gray-400">${escapeHtml(firstPost.dayOfWeek || '')}</span>
                    </div>
                    <div class="space-y-3 pl-10">
                      ${dayPosts.map(post => {
                        const platformColor = platformColors[post.platform?.toLowerCase()] || 'bg-gray-500';
                        const typeIcon = contentTypeIcons[post.contentType] || '📝';
                        return `
                          <div class="p-3 bg-gray-50 dark:bg-neutral-800/50 rounded-lg">
                            <div class="flex items-center gap-2 mb-2">
                              <span class="px-2 py-0.5 text-xs font-medium text-white rounded ${platformColor}">${escapeHtml(post.platform)}</span>
                              <span class="text-xs text-gray-500 dark:text-gray-400">${typeIcon} ${escapeHtml(post.contentType)}</span>
                              <span class="text-xs text-gray-400 dark:text-gray-500 ml-auto">${escapeHtml(post.bestTime)}</span>
                            </div>
                            <p class="text-sm text-gray-800 dark:text-gray-200 mb-2">${escapeHtml(post.caption)}</p>
                            ${post.visualIdea ? `<p class="text-xs text-gray-500 dark:text-gray-400 mb-2">Visual: ${escapeHtml(post.visualIdea)}</p>` : ''}
                            ${post.hashtags && post.hashtags.length > 0 ? `
                              <div class="flex flex-wrap gap-1">
                                ${post.hashtags.slice(0, 5).map(tag => `<span class="text-xs text-blue-600 dark:text-blue-400">#${escapeHtml(tag.replace('#', ''))}</span>`).join('')}
                              </div>
                            ` : ''}
                            ${post.cta ? `<p class="text-xs text-[#7C3AED] dark:text-[#A78BFA] mt-1">CTA: ${escapeHtml(post.cta)}</p>` : ''}
                          </div>
                        `;
                      }).join('')}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Platform Tips -->
          ${platformTips.length > 0 ? `
            <div class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-4">
              <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">Platform Tips</h3>
              <div class="space-y-3">
                ${platformTips.map(pt => `
                  <div class="p-3 bg-amber-50/50 dark:bg-amber-500/5 border border-amber-200/50 dark:border-amber-500/20 rounded-lg">
                    <div class="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-2">${escapeHtml(pt.platform)}</div>
                    <ul class="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                      ${pt.tips.map(tip => `<li class="flex items-start gap-2"><span class="text-amber-500 mt-0.5">•</span> ${escapeHtml(tip)}</li>`).join('')}
                    </ul>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          ${renderMetadataPills(metadata)}
        </div>
      `;
      return;
    }

    // Product Description Writer output
    if ('shortDescription' in value && 'longDescription' in value && 'seoTitle' in value && 'bulletPoints' in value) {
      const title = value.title || 'Product Title';
      const shortDescription = value.shortDescription || '';
      const longDescription = value.longDescription || '';
      const bulletPoints = value.bulletPoints || [];
      const seoTitle = value.seoTitle || '';
      const seoDescription = value.seoDescription || '';
      const tags = Array.isArray(value.tags) ? value.tags : [];
      const keywords = Array.isArray(value.keywords) ? value.keywords : [];
      const platform = value.platform || 'generic';
      const charCounts = value.characterCounts || {};
      const suggestions = Array.isArray(value.suggestions) ? value.suggestions : [];

      const platformLabels = {
        generic: 'General',
        amazon: 'Amazon',
        shopify: 'Shopify',
        etsy: 'Etsy',
        ebay: 'eBay',
        woocommerce: 'WooCommerce'
      };

      const copyBtnId = (prefix) => `copy-${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      const titleCopyId = copyBtnId('title');
      const shortCopyId = copyBtnId('short');
      const longCopyId = copyBtnId('long');
      const bulletsCopyId = copyBtnId('bullets');
      const seoCopyId = copyBtnId('seo');

      container.innerHTML = `
        <div class="space-y-4">
          <!-- Platform Badge -->
          <div class="flex items-center gap-2">
            <span class="px-3 py-1 text-xs font-medium text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10 rounded-full">
              ${escapeHtml(platformLabels[platform] || platform)}
            </span>
            ${suggestions.length > 0 ? `<span class="px-2 py-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 rounded-full">${suggestions.length} suggestion${suggestions.length > 1 ? 's' : ''}</span>` : ''}
          </div>

          <!-- Title Section -->
          <div class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-4">
            <div class="flex items-start justify-between gap-2 mb-2">
              <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Product Title</h4>
              <button id="${titleCopyId}" class="copy-btn px-2 py-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded transition-colors flex items-center gap-1">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                Copy
              </button>
            </div>
            <p class="text-lg font-semibold text-gray-900 dark:text-white">${escapeHtml(title)}</p>
            ${charCounts.title ? `<p class="text-xs text-gray-400 mt-1">${charCounts.title} characters</p>` : ''}
          </div>

          <!-- Short Description -->
          <div class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-4">
            <div class="flex items-start justify-between gap-2 mb-2">
              <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Short Description</h4>
              <button id="${shortCopyId}" class="copy-btn px-2 py-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded transition-colors flex items-center gap-1">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                Copy
              </button>
            </div>
            <p class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">${escapeHtml(shortDescription)}</p>
            ${charCounts.shortDescription ? `<p class="text-xs text-gray-400 mt-2">${charCounts.shortDescription} characters</p>` : ''}
          </div>

          <!-- Long Description -->
          <div class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-4">
            <div class="flex items-start justify-between gap-2 mb-2">
              <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Long Description</h4>
              <button id="${longCopyId}" class="copy-btn px-2 py-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded transition-colors flex items-center gap-1">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                Copy
              </button>
            </div>
            <p class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">${escapeHtml(longDescription)}</p>
            ${charCounts.longDescription ? `<p class="text-xs text-gray-400 mt-2">${charCounts.longDescription} characters</p>` : ''}
          </div>

          <!-- Bullet Points -->
          ${bulletPoints.length > 0 ? `
            <div class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-4">
              <div class="flex items-start justify-between gap-2 mb-3">
                <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Key Features</h4>
                <button id="${bulletsCopyId}" class="copy-btn px-2 py-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded transition-colors flex items-center gap-1">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                  Copy
                </button>
              </div>
              <ul class="space-y-2">
                ${bulletPoints.map(bp => `
                  <li class="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <span class="text-primary mt-0.5">•</span>
                    <span>${escapeHtml(bp)}</span>
                  </li>
                `).join('')}
              </ul>
            </div>
          ` : ''}

          <!-- SEO Preview -->
          <div class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-4">
            <div class="flex items-start justify-between gap-2 mb-3">
              <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">SEO Preview</h4>
              <button id="${seoCopyId}" class="copy-btn px-2 py-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded transition-colors flex items-center gap-1">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                Copy
              </button>
            </div>
            <div class="bg-gray-50 dark:bg-neutral-800/50 rounded-lg p-3 border border-gray-100 dark:border-neutral-700">
              <p class="text-blue-600 dark:text-blue-400 text-sm font-medium truncate">${escapeHtml(seoTitle)}</p>
              <p class="text-green-600 dark:text-green-500 text-xs mt-0.5">www.example.com › product</p>
              <p class="text-gray-600 dark:text-gray-400 text-xs mt-1 line-clamp-2">${escapeHtml(seoDescription)}</p>
            </div>
          </div>

          <!-- Tags & Keywords -->
          ${tags.length > 0 || keywords.length > 0 ? `
            <div class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-4">
              ${tags.length > 0 ? `
                <div class="mb-3">
                  <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Tags</h4>
                  <div class="flex flex-wrap gap-1.5">
                    ${tags.map(tag => `<span class="px-2 py-0.5 text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-neutral-800 rounded">${escapeHtml(tag)}</span>`).join('')}
                  </div>
                </div>
              ` : ''}
              ${keywords.length > 0 ? `
                <div>
                  <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Keywords</h4>
                  <div class="flex flex-wrap gap-1.5">
                    ${keywords.map(kw => `<span class="px-2 py-0.5 text-xs text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10 rounded">${escapeHtml(kw)}</span>`).join('')}
                  </div>
                </div>
              ` : ''}
            </div>
          ` : ''}

          <!-- Suggestions -->
          ${suggestions.length > 0 ? `
            <div class="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-4">
              <h4 class="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-2">Suggestions</h4>
              <ul class="space-y-1">
                ${suggestions.map(s => `
                  <li class="text-xs text-amber-700 dark:text-amber-300">
                    <span class="font-medium">${escapeHtml(s.type)}:</span> ${escapeHtml(s.suggestion)}
                  </li>
                `).join('')}
              </ul>
            </div>
          ` : ''}

          ${renderMetadataPills(metadata)}
        </div>
      `;

      // Add copy event listeners
      const copyData = [
        { id: titleCopyId, text: title },
        { id: shortCopyId, text: shortDescription },
        { id: longCopyId, text: longDescription },
        { id: bulletsCopyId, text: bulletPoints.map(bp => '• ' + bp).join('\n') },
        { id: seoCopyId, text: `${seoTitle}\n${seoDescription}` },
      ];

      copyData.forEach(({ id, text }) => {
        const btn = document.getElementById(id);
        if (btn) {
          btn.addEventListener('click', function() {
            navigator.clipboard.writeText(text).then(() => {
              this.innerHTML = '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg> Copied!';
              this.classList.add('text-green-600');
              setTimeout(() => {
                this.innerHTML = '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg> Copy';
                this.classList.remove('text-green-600');
              }, 2000);
            });
          });
        }
      });

      return;
    }

    // One Prompt 10 Replies output
    if (Array.isArray(value.replies) && value.originalPrompt !== undefined) {
      const originalPrompt = value.originalPrompt || '';
      const tone = value.tone || '';
      const platform = value.platform || '';
      const replies = value.replies || [];
      const summary = value.summary || '';
      const containerId = 'replies-container-' + Date.now();

      container.innerHTML = `
        <div class="space-y-4">
          <!-- Header -->
          <div class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-4">
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-sm font-semibold text-gray-900 dark:text-white">${replies.length} Response Variations</h3>
              <div class="flex items-center gap-2">
                ${tone ? `<span class="px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 rounded">${escapeHtml(tone)}</span>` : ''}
                ${platform ? `<span class="px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-neutral-800 rounded">${escapeHtml(platform)}</span>` : ''}
              </div>
            </div>
            ${summary ? `<p class="text-sm text-gray-600 dark:text-gray-400">${escapeHtml(summary)}</p>` : ''}
          </div>

          <!-- Original Prompt -->
          <div class="bg-gray-50 dark:bg-neutral-800/50 border border-gray-200 dark:border-neutral-700 rounded-xl p-4">
            <div class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Original Message</div>
            <p class="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">${escapeHtml(originalPrompt)}</p>
          </div>

          <!-- Replies Grid -->
          <div id="${containerId}" class="space-y-3">
            ${replies.map((reply, index) => `
                <div class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-4 hover:border-gray-300 dark:hover:border-neutral-700 transition-colors">
                  <div class="flex items-start justify-between gap-3 mb-3">
                    <div class="flex items-center gap-2">
                      <span class="flex items-center justify-center w-6 h-6 text-xs font-semibold text-white bg-gradient-to-br from-violet-500 to-primary/90 rounded-full">${reply.id || index + 1}</span>
                      <span class="text-sm font-medium text-gray-900 dark:text-white">${escapeHtml(reply.style || 'Variation ' + (index + 1))}</span>
                    </div>
                    <button class="reply-copy-btn p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition-colors" data-reply-index="${index}" title="Copy response">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                    </button>
                  </div>
                  <p class="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed reply-text">${escapeHtml(reply.text || '')}</p>
                  ${reply.bestFor ? `
                    <div class="mt-3 pt-3 border-t border-gray-100 dark:border-neutral-800">
                      <span class="text-xs text-gray-500 dark:text-gray-400"><span class="font-medium">Best for:</span> ${escapeHtml(reply.bestFor)}</span>
                    </div>
                  ` : ''}
                </div>
              `).join('')}
          </div>

          ${renderMetadataPills(metadata)}
        </div>
      `;

      // Add copy button event listeners
      const repliesContainer = document.getElementById(containerId);
      if (repliesContainer) {
        repliesContainer.querySelectorAll('.reply-copy-btn').forEach(btn => {
          btn.addEventListener('click', function() {
            const card = this.closest('.bg-white, .dark\\:bg-neutral-900');
            const textEl = card?.querySelector('.reply-text');
            const text = textEl?.textContent || '';
            navigator.clipboard.writeText(text).then(() => {
              this.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
              this.classList.add('text-green-600');
              setTimeout(() => {
                this.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>';
                this.classList.remove('text-green-600');
              }, 2000);
            });
          });
        });
      }
      return;
    }

    // Reddit Hunter output
    if (Array.isArray(value.subreddits) && Array.isArray(value.discussions) && Array.isArray(value.insights)) {
      const topic = value.topic || '';
      const purpose = value.purpose || '';
      const subreddits = value.subreddits || [];
      const discussions = value.discussions || [];
      const trends = value.trends || [];
      const insights = value.insights || [];
      const summary = value.summary || '';

      const relevanceColors = {
        'high': 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400',
        'medium': 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400',
        'low': 'bg-gray-100 dark:bg-gray-500/20 text-gray-600 dark:text-gray-400',
      };

      const sentimentColors = {
        'positive': 'text-[#7C3AED] dark:text-[#A78BFA]',
        'negative': 'text-rose-600 dark:text-rose-400',
        'mixed': 'text-amber-600 dark:text-amber-400',
        'neutral': 'text-gray-600 dark:text-gray-400',
      };

      const momentumIcons = {
        'rising': '📈',
        'stable': '➡️',
        'declining': '📉',
      };

      const categoryStyles = {
        'opportunity': { bg: 'bg-emerald-50 dark:bg-emerald-500/10', border: 'border-emerald-200 dark:border-emerald-500/30', text: 'text-emerald-700 dark:text-emerald-400' },
        'pain-point': { bg: 'bg-rose-50 dark:bg-rose-500/10', border: 'border-rose-200 dark:border-rose-500/30', text: 'text-rose-700 dark:text-rose-400' },
        'competitor': { bg: 'bg-blue-50 dark:bg-blue-500/10', border: 'border-blue-200 dark:border-blue-500/30', text: 'text-blue-700 dark:text-blue-400' },
        'content-idea': { bg: 'bg-violet-50 dark:bg-violet-500/10', border: 'border-violet-200 dark:border-violet-500/30', text: 'text-violet-700 dark:text-violet-400' },
        'warning': { bg: 'bg-amber-50 dark:bg-amber-500/10', border: 'border-amber-200 dark:border-amber-500/30', text: 'text-amber-700 dark:text-amber-400' },
      };

      container.innerHTML = `
        <div class="space-y-5">
          <!-- Header -->
          <div class="pb-4 border-b border-gray-200 dark:border-neutral-700">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">${escapeHtml(topic)}</h2>
            <p class="text-sm text-gray-500 dark:text-gray-400">${escapeHtml(purpose)}</p>
          </div>

          <!-- Summary -->
          ${summary ? `
            <div class="p-4 bg-gray-50 dark:bg-neutral-800/50 rounded-xl">
              <p class="text-sm text-gray-700 dark:text-gray-300">${escapeHtml(summary)}</p>
            </div>
          ` : ''}

          <!-- Subreddits -->
          ${subreddits.length > 0 ? `
            <div class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-4">
              <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">Relevant Subreddits (${subreddits.length})</h3>
              <div class="space-y-2">
                ${subreddits.map(sub => {
                  const relColor = relevanceColors[sub.relevance] || relevanceColors.medium;
                  return `
                    <div class="flex items-start justify-between p-3 bg-gray-50 dark:bg-neutral-800/50 rounded-lg">
                      <div class="flex-1">
                        <div class="flex items-center gap-2">
                          <span class="text-sm font-medium text-orange-600 dark:text-orange-400">r/${escapeHtml(sub.name)}</span>
                          ${sub.subscribers ? `<span class="text-xs text-gray-400">${escapeHtml(sub.subscribers)}</span>` : ''}
                        </div>
                        <p class="text-xs text-gray-600 dark:text-gray-400 mt-1">${escapeHtml(sub.description)}</p>
                      </div>
                      <span class="shrink-0 px-2 py-0.5 text-xs font-medium rounded ${relColor}">${escapeHtml(sub.relevance)}</span>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Discussions -->
          ${discussions.length > 0 ? `
            <div class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-4">
              <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">Notable Discussions (${discussions.length})</h3>
              <div class="space-y-3">
                ${discussions.map(disc => {
                  const sentColor = sentimentColors[disc.sentiment] || sentimentColors.neutral;
                  return `
                    <div class="p-3 bg-gray-50 dark:bg-neutral-800/50 rounded-lg">
                      <div class="flex items-start justify-between gap-2 mb-2">
                        <span class="text-sm font-medium text-gray-900 dark:text-white">${escapeHtml(disc.title)}</span>
                        <span class="shrink-0 text-xs ${sentColor}">${escapeHtml(disc.sentiment)}</span>
                      </div>
                      <div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-2">
                        <span class="text-orange-500">r/${escapeHtml(disc.subreddit)}</span>
                        ${disc.engagement ? `<span>• ${escapeHtml(disc.engagement)}</span>` : ''}
                      </div>
                      ${disc.keyPoints && disc.keyPoints.length > 0 ? `
                        <ul class="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                          ${disc.keyPoints.map(point => `<li class="flex items-start gap-2"><span class="text-gray-400 mt-0.5">—</span> ${escapeHtml(point)}</li>`).join('')}
                        </ul>
                      ` : ''}
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Trends -->
          ${trends.length > 0 ? `
            <div class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-4">
              <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">Trends & Patterns (${trends.length})</h3>
              <div class="space-y-2">
                ${trends.map(trend => {
                  const icon = momentumIcons[trend.momentum] || '➡️';
                  return `
                    <div class="p-3 bg-gray-50 dark:bg-neutral-800/50 rounded-lg">
                      <div class="flex items-center gap-2 mb-1">
                        <span>${icon}</span>
                        <span class="text-sm font-medium text-gray-900 dark:text-white">${escapeHtml(trend.topic)}</span>
                        <span class="text-xs text-gray-500 dark:text-gray-400">(${escapeHtml(trend.momentum)})</span>
                      </div>
                      <p class="text-xs text-gray-600 dark:text-gray-400">${escapeHtml(trend.description)}</p>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Insights -->
          ${insights.length > 0 ? `
            <div class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-4">
              <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">Actionable Insights (${insights.length})</h3>
              <div class="space-y-2">
                ${insights.map(ins => {
                  const style = categoryStyles[ins.category] || categoryStyles.opportunity;
                  return `
                    <div class="p-3 ${style.bg} border ${style.border} rounded-lg">
                      <div class="text-xs font-semibold ${style.text} uppercase tracking-wide mb-1">${escapeHtml(ins.category.replace('-', ' '))}</div>
                      <p class="text-sm text-gray-800 dark:text-gray-200">${escapeHtml(ins.insight)}</p>
                      <p class="text-xs text-gray-600 dark:text-gray-400 mt-1.5">→ ${escapeHtml(ins.actionItem)}</p>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          ` : ''}

          ${renderMetadataPills(metadata)}
        </div>
      `;
      return;
    }

    const socialPostsData = value.posts || (value.content && typeof value.content === 'object' && value.content.posts);
    if (Array.isArray(socialPostsData) && socialPostsData.length > 0 && socialPostsData[0].platform && socialPostsData[0].hook) {
      const posts = socialPostsData;
      const videoInfo = value.videoInfo;
      const videoSummary = value.videoSummary || '';
      const keyTakeaways = value.keyTakeaways || [];

      const platformConfig = {
        instagram: { bg: 'from-primary/90 to-pink-500', icon: '📸', name: 'Instagram' },
        tiktok: { bg: 'from-black to-gray-800', icon: '🎵', name: 'TikTok' },
        'twitter/x': { bg: 'from-black to-gray-700', icon: '𝕏', name: 'Twitter/X' },
        twitter: { bg: 'from-blue-400 to-blue-600', icon: '𝕏', name: 'Twitter' },
        linkedin: { bg: 'from-blue-600 to-blue-800', icon: '💼', name: 'LinkedIn' },
        facebook: { bg: 'from-blue-500 to-blue-700', icon: '📘', name: 'Facebook' },
      };

      container.innerHTML = `
        <div class="space-y-6">
          <!-- Header -->
          ${videoInfo ? `
            <div class="bg-gradient-to-r from-red-500 to-red-600 rounded-xl p-4 text-white">
              <div class="flex items-center gap-3">
                <svg class="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
                <div>
                  <h2 class="font-bold">${escapeHtml(videoInfo.title || 'YouTube Video')}</h2>
                  ${videoInfo.channel ? `<p class="text-sm opacity-90">${escapeHtml(videoInfo.channel)}</p>` : ''}
                </div>
              </div>
            </div>
          ` : ''}

          <!-- Video Summary & Key Takeaways -->
          ${videoSummary || keyTakeaways.length > 0 ? `
            <div class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl p-4">
              ${videoSummary ? `
                <div class="mb-3">
                  <h4 class="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1">Video Summary</h4>
                  <p class="text-gray-800 dark:text-gray-200 text-sm">${escapeHtml(videoSummary)}</p>
                </div>
              ` : ''}
              ${keyTakeaways.length > 0 ? `
                <div>
                  <h4 class="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">Key Takeaways Used</h4>
                  <div class="flex flex-wrap gap-2">
                    ${keyTakeaways.map(t => `<span class="px-2 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded text-xs">${escapeHtml(t)}</span>`).join('')}
                  </div>
                </div>
              ` : ''}
            </div>
          ` : ''}

          <!-- Posts Header -->
          <div class="flex items-center gap-2">
            <span class="text-lg">📱</span>
            <span class="font-semibold text-gray-800 dark:text-gray-200">${posts.length} Social Media Post${posts.length > 1 ? 's' : ''} Generated</span>
          </div>

          <!-- Posts -->
          <div class="space-y-4">
            ${posts.map((post, idx) => {
              const platform = post.platform?.toLowerCase() || 'instagram';
              const config = platformConfig[platform] || platformConfig.instagram;
              const copyId = 'copy-social-post-' + Date.now() + '-' + idx;
              const fullText = post.hook + '\\n\\n' + post.content + '\\n\\n' + post.callToAction + (post.hashtags?.length > 0 ? '\\n\\n' + post.hashtags.map(h => '#' + h).join(' ') : '');

              return `
                <div class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl overflow-hidden">
                  <!-- Platform Header -->
                  <div class="bg-gradient-to-r ${config.bg} px-4 py-3 flex items-center justify-between text-white">
                    <span class="font-medium flex items-center gap-2">
                      <span class="text-lg">${config.icon}</span>
                      ${escapeHtml(config.name)}
                      ${post.postType ? `<span class="opacity-75 text-sm">• ${escapeHtml(post.postType)}</span>` : ''}
                    </span>
                    ${post.bestTimeToPost ? `<span class="text-xs opacity-75">🕐 ${escapeHtml(post.bestTimeToPost)}</span>` : ''}
                  </div>

                  <!-- Post Content -->
                  <div class="p-4 space-y-3">
                    <!-- Hook -->
                    <div class="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-3 rounded-r">
                      <span class="text-xs font-semibold text-yellow-600 dark:text-yellow-400">HOOK</span>
                      <p class="text-gray-800 dark:text-gray-200 font-medium mt-1">${escapeHtml(post.hook)}</p>
                    </div>

                    <!-- Main Content -->
                    <p class="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">${escapeHtml(post.content)}</p>

                    <!-- CTA -->
                    <div class="bg-green-50 dark:bg-green-900/20 border-l-4 border-green-400 p-3 rounded-r">
                      <span class="text-xs font-semibold text-green-600 dark:text-green-400">CALL TO ACTION</span>
                      <p class="text-gray-800 dark:text-gray-200 mt-1">${escapeHtml(post.callToAction)}</p>
                    </div>

                    <!-- Hashtags -->
                    ${post.hashtags && post.hashtags.length > 0 ? `
                      <div class="flex flex-wrap gap-1">
                        ${post.hashtags.map(tag => `<span class="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs rounded-full">#${escapeHtml(tag)}</span>`).join('')}
                      </div>
                    ` : ''}

                    <!-- Engagement Tip -->
                    ${post.engagementTip ? `
                      <div class="bg-primary/90/5 dark:bg-primary/90/20 p-3 rounded-lg flex items-start gap-2">
                        <span class="text-primary/90">💡</span>
                        <div>
                          <span class="text-xs font-semibold text-primary/90 dark:text-primary/90">Engagement Tip</span>
                          <p class="text-sm text-gray-600 dark:text-gray-400">${escapeHtml(post.engagementTip)}</p>
                        </div>
                      </div>
                    ` : ''}

                    <!-- Copy Button -->
                    <button data-copy-id="${copyId}" data-copy-text="${escapeHtml(fullText)}" class="copy-social-btn inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 rounded-lg transition-colors">
                      <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                      </svg>
                      Copy Full Post
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          ${renderMetadataPills(metadata)}
        </div>
      `;

      container.querySelectorAll('.copy-social-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const text = btn.getAttribute('data-copy-text').replace(/\\n/g, '\\n');
          navigator.clipboard.writeText(text);
          btn.innerHTML = '<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>Copied!';
          setTimeout(() => {
            btn.innerHTML = '<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>Copy Full Post';
          }, 2000);
        });
      });
      return;
    }

    const memesData = value.memes || (value.content && typeof value.content === 'object' && value.content.memes);
    if (Array.isArray(memesData) && memesData.length > 0 && memesData[0].suggestedTemplate) {
      const memes = memesData;
      const themeAnalysis = value.themeAnalysis || '';
      const topic = value.topic || '';
      const style = value.style || '';
      const audience = value.audience || '';
      const imagesGenerated = value.imagesGenerated || memes.filter(m => m.imageUrl).length;

      const viralColors = {
        high: { bg: 'bg-green-100 dark:bg-green-900/40', text: 'text-green-700 dark:text-green-300', icon: '🔥', label: 'High Viral Potential' },
        medium: { bg: 'bg-yellow-100 dark:bg-yellow-900/40', text: 'text-yellow-700 dark:text-yellow-300', icon: '👍', label: 'Medium Viral Potential' },
        low: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', icon: '📊', label: 'Low Viral Potential' },
      };

      const formatIcons = {
        'top/bottom': '📝',
        'single caption': '💬',
        'multi-panel': '🎞️',
        'reaction': '😮',
        'reaction image': '😮',
      };

      container.innerHTML = `
        <div class="space-y-6">
          <!-- Header -->
          <div class="bg-gradient-to-r from-primary/90 to-pink-500 rounded-xl p-4 text-white">
            <div class="flex items-center gap-3">
              <span class="text-3xl">😂</span>
              <div>
                <h2 class="font-bold text-lg">${memes.length} Meme${memes.length > 1 ? 's' : ''} Generated</h2>
                ${topic ? `<p class="text-sm opacity-90">Topic: ${escapeHtml(topic)}</p>` : ''}
              </div>
            </div>
            <div class="flex flex-wrap gap-2 mt-3">
              ${style ? `<span class="px-2 py-1 bg-primary-foreground/20 rounded-full text-xs">${escapeHtml(style)}</span>` : ''}
              ${audience ? `<span class="px-2 py-1 bg-primary-foreground/20 rounded-full text-xs">🎯 ${escapeHtml(audience)}</span>` : ''}
              ${imagesGenerated > 0 ? `<span class="px-2 py-1 bg-primary-foreground/20 rounded-full text-xs">🖼️ ${imagesGenerated} image${imagesGenerated > 1 ? 's' : ''}</span>` : ''}
            </div>
          </div>

          <!-- Theme Analysis -->
          ${themeAnalysis ? `
            <div class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl p-4">
              <div class="flex items-start gap-2">
                <span class="text-primary/90">💡</span>
                <div>
                  <h4 class="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1">Theme Analysis</h4>
                  <p class="text-gray-800 dark:text-gray-200 text-sm">${escapeHtml(themeAnalysis)}</p>
                </div>
              </div>
            </div>
          ` : ''}

          <!-- Memes Grid -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${memes.map((meme, idx) => {
              const viral = meme.viralPotential?.toLowerCase() || 'medium';
              const viralStyle = viralColors[viral] || viralColors.medium;
              const formatKey = meme.format?.toLowerCase() || '';
              const formatIcon = Object.entries(formatIcons).find(([k]) => formatKey.includes(k))?.[1] || '🎭';
              const hasImage = !!meme.imageUrl;

              let memeText = '';
              if (meme.topText) memeText += meme.topText + '\\n---\\n';
              if (meme.bottomText) memeText += meme.bottomText;
              if (meme.caption) memeText = meme.caption;

              return `
                <div class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl overflow-hidden">
                  <!-- Meme Header -->
                  <div class="bg-gray-50 dark:bg-neutral-800 px-3 py-2 flex items-center justify-between border-b border-gray-200 dark:border-neutral-700">
                    <span class="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2 text-sm">
                      <span class="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-primary/90 to-pink-500 text-white flex items-center justify-center font-bold text-xs">${idx + 1}</span>
                      ${escapeHtml(meme.suggestedTemplate)}
                    </span>
                    <span class="px-2 py-0.5 text-xs font-medium rounded-full ${viralStyle.bg} ${viralStyle.text}">${viralStyle.icon}</span>
                  </div>

                  <!-- Meme Image with Text Overlay -->
                  <div class="relative">
                    ${hasImage ? `
                      <div class="relative">
                        <img src="${escapeHtml(meme.imageUrl)}" alt="Generated meme" class="w-full aspect-square object-cover" />
                        <!-- Text Overlay -->
                        <div class="absolute inset-0 flex flex-col justify-between p-3 pointer-events-none">
                          ${meme.topText ? `
                            <p class="text-white font-black text-xl uppercase text-center leading-tight" style="text-shadow: 2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 0 2px 0 #000, 2px 0 0 #000, 0 -2px 0 #000, -2px 0 0 #000;">${escapeHtml(meme.topText)}</p>
                          ` : '<div></div>'}
                          ${meme.bottomText ? `
                            <p class="text-white font-black text-xl uppercase text-center leading-tight" style="text-shadow: 2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 0 2px 0 #000, 2px 0 0 #000, 0 -2px 0 #000, -2px 0 0 #000;">${escapeHtml(meme.bottomText)}</p>
                          ` : ''}
                          ${meme.caption && !meme.topText && !meme.bottomText ? `
                            <div class="flex-1"></div>
                            <p class="text-white font-bold text-lg text-center bg-black/50 rounded-lg p-2">${escapeHtml(meme.caption)}</p>
                          ` : ''}
                        </div>
                      </div>
                    ` : `
                      <!-- Fallback: Image generation failed -->
                      <div class="bg-gradient-to-br from-gray-700 to-gray-800 aspect-square flex items-center justify-center">
                        <div class="text-center">
                          <span class="text-4xl mb-2 block">🖼️</span>
                          <p class="text-gray-400 text-sm">Image generation failed</p>
                        </div>
                      </div>
                    `}
                  </div>

                  <!-- Meme Details -->
                  <div class="p-3 space-y-2">
                    <!-- Format & Actions -->
                    <div class="flex items-center justify-between">
                      <span class="px-2 py-0.5 bg-primary/90/10 dark:bg-primary/90/40 text-primary/90 dark:text-primary/90 rounded-full text-xs font-medium">
                        ${formatIcon} ${escapeHtml(meme.format || 'Meme')}
                      </span>
                      <div class="flex gap-1">
                        ${hasImage ? `
                          <a href="${escapeHtml(meme.imageUrl)}" download="meme-${idx + 1}.png" target="_blank" class="p-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition-colors" title="Download">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                            </svg>
                          </a>
                        ` : ''}
                        <button data-copy-text="${escapeHtml(memeText || meme.caption || (meme.topText + ' / ' + meme.bottomText))}" class="copy-meme-btn p-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition-colors" title="Copy text">
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                          </svg>
                        </button>
                      </div>
                    </div>

                    <!-- Explanation (collapsible) -->
                    ${meme.explanation ? `
                      <details class="group">
                        <summary class="text-xs text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">Why it works...</summary>
                        <p class="text-gray-600 dark:text-gray-400 text-xs mt-1">${escapeHtml(meme.explanation)}</p>
                      </details>
                    ` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          ${renderMetadataPills(metadata)}
        </div>
      `;

      container.querySelectorAll('.copy-meme-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const text = btn.getAttribute('data-copy-text').replace(/\\n/g, '\n');
          navigator.clipboard.writeText(text);
          const svg = btn.querySelector('svg');
          if (svg) {
            svg.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>';
            setTimeout(() => {
              svg.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>';
            }, 2000);
          }
        });
      });
      return;
    }

    const titleOptionsData = value.titleOptions || (value.content && typeof value.content === 'object' && value.content.titleOptions);
    if (Array.isArray(titleOptionsData) && titleOptionsData.length > 0 && titleOptionsData[0].title) {
      const titleOptions = titleOptionsData;

      const ctrColors = {
        high: { bg: 'bg-green-100 dark:bg-green-900/40', text: 'text-green-700 dark:text-green-300', icon: '🔥' },
        medium: { bg: 'bg-yellow-100 dark:bg-yellow-900/40', text: 'text-yellow-700 dark:text-yellow-300', icon: '👍' },
        low: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', icon: '📊' },
      };

      const styleColors = {
        'Curiosity/Clickbait': 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
        'How-To/Tutorial': 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
        'Listicle': 'bg-primary/90/10 dark:bg-primary/90/40 text-primary/90 dark:text-primary/90',
        'Question': 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
        'Emotional/Story': 'bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300',
        'News/Update': 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300',
        'Challenge': 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300',
        'Official/Branded': 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300',
      };

      container.innerHTML = `
        <div class="space-y-4 w-full">
          <div class="flex items-center gap-2">
            <svg class="w-6 h-6 text-red-600 dark:text-red-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
            <span class="text-base font-semibold text-gray-800 dark:text-gray-200">Title Suggestions</span>
            <span class="text-sm text-gray-500 dark:text-gray-400">(${titleOptions.length})</span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            ${titleOptions.map((option, idx) => {
              const ctr = option.estimatedCtr?.toLowerCase() || 'medium';
              const ctrStyle = ctrColors[ctr] || ctrColors.medium;
              const styleClass = styleColors[option.style] || 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400';
              const charCount = option.characterCount || option.title?.length || 0;

              return `
                <div class="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl p-4 hover:border-red-400 dark:hover:border-red-600 hover:shadow-md transition-all group cursor-pointer" data-copy-title="${escapeHtml(option.title).replace(/"/g, '&quot;')}">
                  <div class="flex items-start gap-3">
                    <span class="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-red-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">${idx + 1}</span>
                    <div class="flex-1 min-w-0">
                      <p class="text-base font-medium text-gray-900 dark:text-white mb-2 leading-snug">${escapeHtml(option.title)}</p>
                      <div class="flex flex-wrap items-center gap-2">
                        ${option.style ? `<span class="px-2 py-1 text-xs font-medium rounded-full ${styleClass}">${escapeHtml(option.style)}</span>` : ''}
                        <span class="px-2 py-1 text-xs font-medium rounded-full ${ctrStyle.bg} ${ctrStyle.text}">${ctrStyle.icon} ${escapeHtml(ctr)}</span>
                        <span class="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">${charCount} chars</span>
                      </div>
                      <div class="copy-feedback hidden mt-2 text-xs text-green-600 dark:text-green-400 font-medium">✓ Copied!</div>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
          ${renderMetadataPills(metadata)}
        </div>
      `;
      return;
    }

    const textFields = ['content', 'text', 'translatedText', 'translatedSubtitles'];
    for (const field of textFields) {
      if (typeof value[field] === 'string' && value[field].length > 0) {
        const textContent = value[field];
        container.innerHTML = `
          <pre class="text-sm whitespace-pre-wrap break-words bg-neutral-100 dark:bg-neutral-900/60 border border-black/5 dark:border-white/10 rounded-ios-xl p-4 overflow-auto max-h-[500px]">${escapeHtml(textContent)}</pre>
          ${renderMetadataPills(metadata)}
        `;
        return;
      }
    }
  }

  // Skip rendering error-only responses as JSON
  if (typeof value === 'object' && value !== null && value.error && !value.url && !value.resultUrl && !value.outputUrl && !value.resultVideo && !value.resultImage) {
    const keys = Object.keys(value);
    if (keys.every(k => ['error', 'success', 'consentRequired', 'consentSchema', 'consentErrors', 'riskLevel'].includes(k))) {
      return;
    }
  }

  container.innerHTML = `<pre class="text-sm bg-neutral-100 dark:bg-neutral-900/60 border border-black/5 dark:border-white/10 rounded-ios-xl p-4 overflow-auto">${escapeHtml(JSON.stringify(value, null, 2))}</pre>`;
}

// CSP-safe hover delegation for carousel nav buttons
document.addEventListener('mouseenter', function(e) {
  if (!e.target || typeof e.target.closest !== 'function') return;
  const el = e.target.closest('[data-hover-bg]');
  if (el) el.style.background = el.dataset.hoverBg;
}, true);
document.addEventListener('mouseleave', function(e) {
  if (!e.target || typeof e.target.closest !== 'function') return;
  const el = e.target.closest('[data-default-bg]');
  if (el) el.style.background = el.dataset.defaultBg;
}, true);
