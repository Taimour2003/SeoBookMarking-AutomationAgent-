import {
  createMediaField,
  createTextInputField,
  createTextAreaField,
  createCheckboxField,
  createChipGroup,
  setHidden,
  FieldValidationError,
} from './ui.js';

import { startPcm16Capture } from '../live-audio.js';
import { createLiveTranscribeSession } from '../live-transcribe.js';

function splitLines(value) {
  if (!value || typeof value !== 'string') return [];
  return value
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeFormats(formats) {
  const allowed = new Set(['text', 'srt', 'vtt', 'json']);
  const picked = Array.isArray(formats)
    ? formats.map((v) => String(v)).filter((v) => allowed.has(v))
    : [];
  if (picked.length === 0) return ['text', 'json'];
  return Array.from(new Set(picked));
}

export async function render({ container }) {
  container.innerHTML = '';

  const mode = createChipGroup({
    label: 'Mode',
    id: 'mode',
    options: [
      { value: 'batch', label: 'Batch (Upload / Record)' },
      { value: 'live_mic', label: 'Live captions (Mic)' },
      { value: 'live_tab', label: 'Live captions (Tab audio)' },
    ],
    defaultValue: 'batch',
    help:
      'Batch mode records/uploads then transcribes after you run the agent. ' +
      'Live captions streams audio to the server for realtime transcript (best-effort).',
    layout: 'wrap',
  });

  const languageMode = createChipGroup({
    label: 'Transcription language',
    id: 'languageMode',
    options: [
      { value: 'single', label: 'Single language' },
      { value: 'multilingual', label: 'Multilingual (code-switch)' },
    ],
    defaultValue: 'single',
    help:
      'Single language is cheaper and more stable when you know the meeting language. ' +
      'Multilingual handles TR+EN code-switching. For Live captions, multilingual uses Deepgram language=multi.',
    layout: 'wrap',
  });

  const singleLanguageWrap = document.createElement('div');
  singleLanguageWrap.className = 'mt-2';
  const singleLanguageLabel = document.createElement('div');
  singleLanguageLabel.className = 'text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1';
  singleLanguageLabel.textContent = 'Single language';
  const singleLanguageSelect = document.createElement('select');
  singleLanguageSelect.className =
    'block w-full text-sm bg-white dark:bg-neutral-950 border border-black/10 dark:border-white/10 rounded-ios-lg px-3 py-2';
  singleLanguageSelect.innerHTML = `
    <option value="en">English</option>
    <option value="tr">Turkish</option>
  `;
  const singleLanguageHelp = document.createElement('p');
  singleLanguageHelp.className = 'mt-1 text-[11px] text-gray-500 dark:text-gray-400';
  singleLanguageHelp.textContent = 'Choose the primary meeting language (improves live captions accuracy).';
  singleLanguageWrap.appendChild(singleLanguageLabel);
  singleLanguageWrap.appendChild(singleLanguageSelect);
  singleLanguageWrap.appendChild(singleLanguageHelp);

  const translateToggle = createCheckboxField({
    label: 'Translate transcript (adds cost)',
    id: 'translateToggle',
    defaultChecked: false,
    help:
      'Adds translated transcript outputs (e.g. TR transcript + EN translation). ' +
      'Requires DeepL configuration in production; dev/test uses a deterministic fallback.',
  });

  const translateTargetsWrap = document.createElement('div');
  translateTargetsWrap.className = 'mt-2 grid grid-cols-2 gap-2';
  const translateEn = createCheckboxField({ label: 'EN (English)', defaultChecked: true });
  const translateTr = createCheckboxField({ label: 'TR (Turkish)', defaultChecked: false });
  translateTargetsWrap.appendChild(translateEn.wrap);
  translateTargetsWrap.appendChild(translateTr.wrap);

  const pricingPanel = document.createElement('div');
  pricingPanel.className =
    'mt-3 rounded-ios-xl border border-black/10 dark:border-white/10 bg-neutral-50 dark:bg-neutral-900/40 p-4 space-y-2';
  const pricingTitle = document.createElement('div');
  pricingTitle.className = 'text-sm font-semibold text-gray-900 dark:text-white';
  pricingTitle.textContent = 'Pricing (credits)';
  const pricingHint = document.createElement('p');
  pricingHint.className = 'text-[11px] text-gray-500 dark:text-gray-400 leading-snug';
  pricingHint.textContent = 'Estimates update as you change options. Live captions shows billed credits as you record.';
  const pricingLines = document.createElement('div');
  pricingLines.className = 'space-y-1 text-xs text-gray-700 dark:text-gray-200';
  const pricingLineLive = document.createElement('div');
  const pricingLineBatch = document.createElement('div');
  const pricingLineTotal = document.createElement('div');
  pricingLines.appendChild(pricingLineLive);
  pricingLines.appendChild(pricingLineBatch);
  pricingLines.appendChild(pricingLineTotal);
  pricingPanel.appendChild(pricingTitle);
  pricingPanel.appendChild(pricingHint);
  pricingPanel.appendChild(pricingLines);

  const audioUrl = createMediaField({
    label: 'Meeting recording (audio or video)',
    id: 'audioUrl',
    required: true,
    kind: 'audioOrVideo',
    help:
      'Upload a meeting recording, paste a URL, or record with your microphone. ' +
      'Recording captures what your microphone hears; for best full-meeting capture, use speakers (not headphones).',
    recording: {
      note:
        'Tip: For best full-meeting capture, play the meeting on speakers (not headphones) so your microphone can hear all participants. ' +
        'Mobile recording is best-effort in v1.',
      // To capture audio playing on speakers, avoid echo cancellation/noise suppression.
      audioConstraints: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
      // Keep files reasonably small for long meetings while preserving clarity.
      mediaRecorderOptions: { audioBitsPerSecond: 48_000 },
      timeSliceMs: 500,
    },
  });

  const liveWrap = document.createElement('div');
  liveWrap.className = 'mt-3 rounded-ios-xl border border-black/10 dark:border-white/10 bg-neutral-50 dark:bg-neutral-900/40 p-4 space-y-3 hidden';

  const liveHeader = document.createElement('div');
  liveHeader.className = 'flex items-center justify-between gap-3';
  const liveHeading = document.createElement('div');
  liveHeading.className = 'flex items-center gap-2 min-w-0';

  const liveTitle = document.createElement('div');
  liveTitle.className = 'text-sm font-semibold text-gray-900 dark:text-white truncate';
  liveTitle.textContent = 'Live captions (best-effort)';

  const liveProviderBadge = document.createElement('span');
  liveProviderBadge.className =
    'hidden shrink-0 px-2 py-0.5 text-[11px] font-medium rounded-full bg-neutral-100 dark:bg-neutral-900/60 text-neutral-700 dark:text-neutral-200 border border-black/5 dark:border-white/10';
  liveProviderBadge.textContent = '';

  const liveStatus = document.createElement('div');
  liveStatus.className = 'text-xs text-gray-600 dark:text-gray-300';
  liveStatus.textContent = 'Not started';

  liveHeading.appendChild(liveTitle);
  liveHeading.appendChild(liveProviderBadge);

  liveHeader.appendChild(liveHeading);
  liveHeader.appendChild(liveStatus);

  const liveButtons = document.createElement('div');
  liveButtons.className = 'flex items-center gap-2';

  const liveStartBtn = document.createElement('button');
  liveStartBtn.type = 'button';
  liveStartBtn.className =
    'px-3 py-2 rounded-full bg-primary/90 hover:bg-primary/90/90 text-white text-xs font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed';
  liveStartBtn.textContent = 'Start live captions';

  const liveStopBtn = document.createElement('button');
  liveStopBtn.type = 'button';
  liveStopBtn.className =
    'px-3 py-2 rounded-full bg-secondary hover:bg-secondary/80 text-xs font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed';
  liveStopBtn.textContent = 'Stop';
  liveStopBtn.disabled = true;

  const liveTimer = document.createElement('span');
  liveTimer.className = 'ml-auto text-xs text-gray-600 dark:text-gray-300 tabular-nums';
  liveTimer.textContent = '00:00';

  liveButtons.appendChild(liveStartBtn);
  liveButtons.appendChild(liveStopBtn);
  liveButtons.appendChild(liveTimer);

  const liveNote = document.createElement('p');
  liveNote.className = 'text-[11px] text-gray-500 dark:text-gray-400 leading-snug';
  liveNote.textContent =
    'Live captions streams audio while recording. For full-meeting capture, play the meeting on speakers (not headphones). ' +
    'Tab audio capture requires selecting a browser tab and enabling “Share audio” (desktop Chrome/Edge).';

  const livePrivacy = document.createElement('p');
  livePrivacy.className = 'text-[11px] text-gray-500 dark:text-gray-400 leading-snug hidden';
  livePrivacy.textContent = '';

  const liveTranscript = document.createElement('div');
  liveTranscript.className = 'rounded-ios-lg border border-black/10 dark:border-white/10 bg-white/60 dark:bg-neutral-950/30 p-3 text-sm text-gray-900 dark:text-white max-h-56 overflow-auto whitespace-pre-wrap';
  const liveFinalSpan = document.createElement('span');
  const liveInterimSpan = document.createElement('span');
  liveInterimSpan.className = 'text-gray-400 dark:text-gray-400';
  liveTranscript.appendChild(liveFinalSpan);
  liveTranscript.appendChild(liveInterimSpan);

  const liveError = document.createElement('p');
  liveError.className = 'text-xs text-red-600 dark:text-red-400 hidden';
  liveError.setAttribute('role', 'alert');
  liveError.setAttribute('aria-live', 'polite');

  const autoRunAfterLive = createCheckboxField({
    label: 'After stop: run Meeting Transcriber on this recording',
    defaultChecked: true,
    help: 'Uploads the captured audio and runs the full batch pipeline (exports, summary/action items). This may re-transcribe the audio for higher quality.',
  });
  autoRunAfterLive.checkbox.addEventListener('change', () => updatePricingUi());

  liveWrap.appendChild(liveHeader);
  liveWrap.appendChild(liveButtons);
  liveWrap.appendChild(liveNote);
  liveWrap.appendChild(livePrivacy);
  liveWrap.appendChild(liveError);
  liveWrap.appendChild(liveTranscript);
  liveWrap.appendChild(autoRunAfterLive.wrap);

  const meetingTitle = createTextInputField({
    label: 'Meeting title (optional)',
    id: 'meetingTitle',
    required: false,
    placeholder: 'e.g. Weekly sync — Jan 30',
  });

  const attendees = createTextAreaField({
    label: 'Attendees (optional)',
    id: 'attendees',
    required: false,
    rows: 3,
    placeholder: 'One name per line (e.g. Alice, Bob)',
  });

  const generateSummary = createCheckboxField({
    label: 'Generate summary',
    id: 'generateSummary',
    defaultChecked: true,
    help: 'Produces an overview, key topics, decisions, and next steps.',
  });

  const extractActionItems = createCheckboxField({
    label: 'Extract action items',
    id: 'extractActionItems',
    defaultChecked: true,
    help: 'Extracts action items from the transcript (best-effort).',
  });

  const detectSpeakers = createCheckboxField({
    label: 'Experimental: estimate speakers (not diarization)',
    id: 'detectSpeakers',
    defaultChecked: false,
    help: 'Heuristic estimation only. For real speaker diarization, a future Pro tier will run post-processing on the full audio.',
  });

  const diarizeSpeakers = createCheckboxField({
    label: 'Pro: speaker diarization (post-stop)',
    id: 'diarizeSpeakers',
    defaultChecked: false,
    help: 'Runs speaker diarization after recording ends (requires external provider configuration). Not available in realtime.',
  });

  const diarizeConsent = createCheckboxField({
    label: 'I understand + consent to audio processing for diarization',
    id: 'diarizeConsent',
    defaultChecked: false,
    help:
      'Required for speaker diarization. Enabling this sends your audio to an external transcription provider for processing. ' +
      'Only enable this if you have permission/consent to process participants\' audio.',
  });

  const formatsTitle = document.createElement('div');
  formatsTitle.className = 'mt-2 text-sm font-semibold text-gray-900 dark:text-white';
  formatsTitle.textContent = 'Export formats';

  const formatsHint = document.createElement('p');
  formatsHint.className = 'text-xs text-gray-500 dark:text-gray-400';
  formatsHint.textContent = 'Choose what to generate. If none selected, defaults to Text + JSON.';

  const fmtWrap = document.createElement('div');
  fmtWrap.className = 'mt-2 grid grid-cols-2 gap-2';

  const fmtText = createCheckboxField({ label: 'Text', defaultChecked: true });
  const fmtJson = createCheckboxField({ label: 'JSON', defaultChecked: true });
  const fmtSrt = createCheckboxField({ label: 'SRT', defaultChecked: false });
  const fmtVtt = createCheckboxField({ label: 'VTT', defaultChecked: false });

  fmtWrap.appendChild(fmtText.wrap);
  fmtWrap.appendChild(fmtJson.wrap);
  fmtWrap.appendChild(fmtSrt.wrap);
  fmtWrap.appendChild(fmtVtt.wrap);

  const advancedDetails = document.createElement('details');
  advancedDetails.className = 'mt-4';
  const advancedSummary = document.createElement('summary');
  advancedSummary.className = 'cursor-pointer select-none text-xs font-semibold text-gray-700 dark:text-gray-200';
  advancedSummary.textContent = 'Advanced';
  advancedDetails.appendChild(advancedSummary);

  const advancedInner = document.createElement('div');
  advancedInner.className = 'mt-3 space-y-3';
  advancedInner.appendChild(detectSpeakers.wrap);
  advancedInner.appendChild(diarizeSpeakers.wrap);
  advancedInner.appendChild(diarizeConsent.wrap);
  advancedDetails.appendChild(advancedInner);

  const mobileNote = document.createElement('p');
  mobileNote.className = 'mt-3 text-[11px] text-gray-500 dark:text-gray-400 leading-snug';
  mobileNote.textContent =
    'Mobile support is best-effort in v1. Full mobile recording compatibility + realtime captions are planned for later versions.';

  container.appendChild(mode.wrap);
  container.appendChild(languageMode.wrap);
  container.appendChild(singleLanguageWrap);
  container.appendChild(translateToggle.wrap);
  container.appendChild(translateTargetsWrap);
  container.appendChild(pricingPanel);
  container.appendChild(audioUrl.wrap);
  container.appendChild(liveWrap);
  container.appendChild(meetingTitle.wrap);
  container.appendChild(attendees.wrap);
  container.appendChild(generateSummary.wrap);
  container.appendChild(extractActionItems.wrap);
  container.appendChild(formatsTitle);
  container.appendChild(formatsHint);
  container.appendChild(fmtWrap);
  container.appendChild(advancedDetails);
  container.appendChild(mobileNote);

  // Ensure advanced is collapsed by default.
  setHidden(advancedInner, false);

  function applyLanguageVisibility() {
    const lm = languageMode.getValue();
    const isSingle = lm === 'single';
    setHidden(singleLanguageWrap, !isSingle);

    const wantsTranslate = translateToggle.getValue();
    setHidden(translateTargetsWrap, !wantsTranslate);
    if (!wantsTranslate) {
      // Keep defaults stable if disabled.
      translateEn.setValue(true);
      translateTr.setValue(false);
    }
  }

  const originalLanguageSetValue = languageMode.setValue;
  languageMode.setValue = (v) => {
    originalLanguageSetValue(v);
    applyLanguageVisibility();
  };
  languageMode.wrap.querySelectorAll('button[role="radio"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      applyLanguageVisibility();
      updatePricingUi();
    });
  });
  translateToggle.checkbox.addEventListener('change', () => {
    applyLanguageVisibility();
    updatePricingUi();
  });
  applyLanguageVisibility();

  singleLanguageSelect.addEventListener('change', () => updatePricingUi());
  translateEn.checkbox.addEventListener('change', () => updatePricingUi());
  translateTr.checkbox.addEventListener('change', () => updatePricingUi());

  let liveProvider = null;
  let liveProviderSimulated = false;
  let liveBilledCredits = 0;
  let liveCreditsPerMinute = null;
  let liveCreditsPer30s = null;

  let pricingConfig = {
    batch: { baseCreditsPerMinute: 1 },
    live: { micBaseCreditsPerMinute: 2, tabBaseCreditsPerMinute: 4 },
    addOns: {
      multilingualCreditsPerMinute: 2,
      translationPerTargetCreditsPerMinute: 2,
      diarizationCreditsPerMinute: 2,
    },
    liveBilling: { quantumSeconds: 30, maxDurationSeconds: 1800 },
  };

  fetch('https://aitopia.ai/api/config/meeting-transcriber-pricing')
    .then((r) => r.ok ? r.json() : null)
    .then((cfg) => {
      if (!cfg || typeof cfg !== 'object') return;
      pricingConfig = cfg;
      updatePricingUi();
    })
    .catch(() => {});

  function setProviderUi(provider, simulated) {
    liveProvider = provider || null;
    liveProviderSimulated = Boolean(simulated);

    if (!liveProvider) {
      liveProviderBadge.textContent = '';
      liveProviderBadge.classList.add('hidden');
      livePrivacy.textContent = '';
      livePrivacy.classList.add('hidden');
      return;
    }

    if (liveProvider === 'deepgram') {
      liveProviderBadge.textContent = 'Deepgram (Live)';
      liveProviderBadge.classList.remove('hidden');
      livePrivacy.textContent = 'Privacy: Live captions streams audio to Deepgram for transcription.';
      livePrivacy.classList.remove('hidden');
      return;
    }

    if (liveProvider === 'local') {
      liveProviderBadge.textContent = liveProviderSimulated ? 'Simulated (Dev)' : 'Local';
      liveProviderBadge.classList.remove('hidden');
      livePrivacy.textContent = '';
      livePrivacy.classList.add('hidden');
    }
  }

  function setLiveError(message) {
    if (!message) {
      liveError.textContent = '';
      liveError.classList.add('hidden');
      return;
    }
    liveError.textContent = String(message);
    liveError.classList.remove('hidden');
  }

  function formatMmSs(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const mins = Math.floor(total / 60).toString().padStart(2, '0');
    const secs = (total % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  }

  function computeBatchCreditsPerMinute(params) {
    const base = Number(pricingConfig?.batch?.baseCreditsPerMinute) || 1;
    const addMulti = Number(pricingConfig?.addOns?.multilingualCreditsPerMinute) || 0;
    const addPerTranslation = Number(pricingConfig?.addOns?.translationPerTargetCreditsPerMinute) || 0;
    const addDiar = Number(pricingConfig?.addOns?.diarizationCreditsPerMinute) || 0;

    let cpm = base;
    if (params.multilingual) cpm += addMulti;
    if (params.translationTargetsCount > 0) cpm += params.translationTargetsCount * addPerTranslation;
    if (params.diarize) cpm += addDiar;
    cpm = Math.max(1, Math.floor(cpm));
    return cpm;
  }

  function computeLiveCreditsPerMinute(params) {
    const baseMic = Number(pricingConfig?.live?.micBaseCreditsPerMinute) || 2;
    const baseTab = Number(pricingConfig?.live?.tabBaseCreditsPerMinute) || Math.max(2, baseMic * 2);
    const addMulti = Number(pricingConfig?.addOns?.multilingualCreditsPerMinute) || 0;

    let cpm = params.source === 'tab' ? baseTab : baseMic;
    if (params.multilingual) cpm += addMulti;
    cpm = Math.max(1, Math.floor(cpm));
    // Live bills in 30s quanta -> make CPM even.
    if (cpm % 2 !== 0) cpm += 1;
    return cpm;
  }

  function getSelectedTranslationTargetsCount() {
    if (!translateToggle.getValue()) return 0;
    const count = (translateEn.getValue() ? 1 : 0) + (translateTr.getValue() ? 1 : 0);
    return Math.max(0, count);
  }

  function updatePricingUi() {
    const m = mode.getValue();
    const isLive = m === 'live_mic' || m === 'live_tab';
    const source = m === 'live_tab' ? 'tab' : 'mic';
    const multilingual = languageMode.getValue() === 'multilingual';
    const translationTargetsCount = getSelectedTranslationTargetsCount();
    const diarize = diarizeSpeakers.getValue();

    const batchCpm = computeBatchCreditsPerMinute({ multilingual, translationTargetsCount, diarize });

    if (!isLive) {
      pricingLineLive.textContent = '';
      pricingLineBatch.textContent = `Batch run: ~${batchCpm} credits/min (billed by audio duration on Run).`;
      pricingLineTotal.textContent = '';
      return;
    }

    const estimatedLiveCpm = computeLiveCreditsPerMinute({ source, multilingual });
    const effectiveLiveCpm = typeof liveCreditsPerMinute === 'number' ? liveCreditsPerMinute : estimatedLiveCpm;
    const effectiveLiveC30 = typeof liveCreditsPer30s === 'number' ? liveCreditsPer30s : Math.max(1, Math.floor(effectiveLiveCpm / 2));
    const maxSeconds = Number(pricingConfig?.liveBilling?.maxDurationSeconds) || 1800;
    const maxMinutes = Math.max(1, Math.round(maxSeconds / 60));

    const billed = Math.max(0, Number(liveBilledCredits) || 0);
    pricingLineLive.textContent =
      `Live captions (${source}): ${effectiveLiveC30} credits/30s (${effectiveLiveCpm} credits/min) • Max ${maxMinutes} min • Billed so far: ${billed} credits.`;

    if (!autoRunAfterLive.getValue()) {
      pricingLineBatch.textContent = 'After stop: batch run is OFF.';
      pricingLineTotal.textContent = '';
      return;
    }

    pricingLineBatch.textContent = `After stop (Batch run): ~${batchCpm} credits/min (separate charge).`;
    if (liveStartMs > 0) {
      const minutes = Math.max(1, Math.ceil((Date.now() - liveStartMs) / 60000));
      const batchTotal = minutes * batchCpm;
      pricingLineTotal.textContent = `If you stop now: live ${billed} + batch ${batchTotal} ≈ ${billed + batchTotal} credits.`;
    } else {
      pricingLineTotal.textContent = '';
    }
  }

  let liveSession = null;
  let capture = null;
  let liveStartMs = 0;
  let liveTimerHandle = null;
  let donePayload = null;
  let liveFinalText = '';
  let liveInterimText = '';
  let liveDraftOutput = null;

  function stopLiveTimer() {
    if (liveTimerHandle) {
      clearInterval(liveTimerHandle);
      liveTimerHandle = null;
    }
  }

  function resetLiveUi() {
    stopLiveTimer();
    liveStartMs = 0;
    liveTimer.textContent = '00:00';
    liveStartBtn.disabled = false;
    liveStopBtn.disabled = true;
    liveFinalText = '';
    liveInterimText = '';
    liveFinalSpan.textContent = '';
    liveInterimSpan.textContent = '';
    if (liveDraftOutput) {
      liveDraftOutput.finalSpan.textContent = '';
      liveDraftOutput.interimSpan.textContent = '';
      liveDraftOutput.statusSpan.textContent = '';
    }
    updatePricingUi();
  }

  function getRunOutputContainer() {
    return document.querySelector('[data-agent-run-output]');
  }

  function ensureLiveDraftOutput() {
    const output = getRunOutputContainer();
    if (!output) return null;

    const existing = output.querySelector('[data-meeting-transcriber-live-draft="1"]');
    if (existing) {
      const finalSpan = existing.querySelector('[data-live-final="1"]');
      const interimSpan = existing.querySelector('[data-live-interim="1"]');
      const statusSpan = existing.querySelector('[data-live-status="1"]');
      if (finalSpan && interimSpan && statusSpan) {
        return { root: existing, finalSpan, interimSpan, statusSpan };
      }
    }

    output.innerHTML = '';

    const root = document.createElement('div');
    root.setAttribute('data-meeting-transcriber-live-draft', '1');
    root.className = 'space-y-4';

    const section = document.createElement('section');
    section.className = 'rounded-ios-xl border border-black/5 dark:border-white/10 bg-white/60 dark:bg-neutral-950/20 p-4';

    const header = document.createElement('div');
    header.className = 'flex items-center justify-between gap-3 mb-3';

    const title = document.createElement('h3');
    title.className = 'text-sm font-semibold text-gray-900 dark:text-white';
    title.textContent = 'Transcript';

    const draftLabel = document.createElement('span');
    draftLabel.className = 'ml-2 text-[11px] font-medium text-gray-500 dark:text-gray-400';
    draftLabel.textContent = 'Draft (Live)';
    title.appendChild(draftLabel);

    const statusSpan = document.createElement('span');
    statusSpan.setAttribute('data-live-status', '1');
    statusSpan.className = 'text-xs text-gray-600 dark:text-gray-300';
    statusSpan.textContent = '';

    header.appendChild(title);
    header.appendChild(statusSpan);

    const pre = document.createElement('pre');
    pre.className =
      'text-sm whitespace-pre-wrap break-words bg-neutral-100 dark:bg-neutral-900/60 border border-black/5 dark:border-white/10 rounded-ios-xl p-4 overflow-auto max-h-[420px]';

    const finalSpan = document.createElement('span');
    finalSpan.setAttribute('data-live-final', '1');

    const interimSpan = document.createElement('span');
    interimSpan.setAttribute('data-live-interim', '1');
    interimSpan.className = 'text-gray-400 dark:text-gray-400';

    pre.appendChild(finalSpan);
    pre.appendChild(interimSpan);

    section.appendChild(header);
    section.appendChild(pre);
    root.appendChild(section);
    output.appendChild(root);

    return { root, finalSpan, interimSpan, statusSpan };
  }

  function applyModeVisibility() {
    const m = mode.getValue();
    const isLive = m === 'live_mic' || m === 'live_tab';
    setHidden(liveWrap, !isLive);
    setHidden(audioUrl.wrap, isLive);
    // When live mode is active, the required audioUrl will be filled after stop.
    audioUrl.urlInput.toggleAttribute('required', !isLive);
    liveFinalText = '';
    liveInterimText = '';
    liveFinalSpan.textContent = '';
    liveInterimSpan.textContent = '';
    donePayload = null;
    setLiveError('');
    resetLiveUi();
    updatePricingUi();
  }

  // Mode is a chip group; patch in a minimal change observer by overriding setValue and using click handlers.
  // (createChipGroup doesn't currently emit change events.)
  const originalSetValue = mode.setValue;
  mode.setValue = (v) => {
    originalSetValue(v);
    applyModeVisibility();
  };
  mode.wrap.querySelectorAll('button[role="radio"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      applyModeVisibility();
    });
  });

  applyModeVisibility();

  // Diarization requires explicit consent.
  setHidden(diarizeConsent.wrap, true);
  diarizeSpeakers.checkbox.addEventListener('change', () => {
    const enabled = diarizeSpeakers.getValue();
    setHidden(diarizeConsent.wrap, !enabled);
    if (!enabled) diarizeConsent.setValue(false);
    updatePricingUi();
  });

  async function startLive() {
    const m = mode.getValue();
    const source = m === 'live_tab' ? 'tab' : 'mic';
    const lm = languageMode.getValue();
    const liveLanguage = lm === 'multilingual' ? 'multi' : String(singleLanguageSelect.value || '').trim() || undefined;

    setLiveError('');
    setProviderUi(null, false);
    liveBilledCredits = 0;
    liveCreditsPerMinute = null;
    liveCreditsPer30s = null;
    liveFinalText = '';
    liveInterimText = '';
    liveFinalSpan.textContent = '';
    liveInterimSpan.textContent = '';
    liveStatus.textContent = 'Connecting…';
    liveDraftOutput = ensureLiveDraftOutput();
    if (liveDraftOutput) liveDraftOutput.statusSpan.textContent = 'Connecting…';
    updatePricingUi();

    // Important: start capture as close to the user gesture as possible (some browsers require it).
    // Buffer audio until the WS session is ready.
    let wsReady = false;
    const bufferedChunks = [];

    liveSession = createLiveTranscribeSession({
      sampleRateHz: 16000,
      source,
      ...(liveLanguage ? { language: liveLanguage } : {}),
      diarize: false,
      onStatus: (s) => {
        if (s && typeof s.creditsPerMinute === 'number') liveCreditsPerMinute = s.creditsPerMinute;
        if (s && typeof s.creditsPer30s === 'number') liveCreditsPer30s = s.creditsPer30s;
        if (s && s.status === 'billing') {
          if (typeof s.billedCredits === 'number') liveBilledCredits = s.billedCredits;
          updatePricingUi();
          return;
        }
        if (s && s.status) {
          const human = String(s.status);
          liveStatus.textContent = human === 'listening' ? 'Listening' : human;
        }
        if (s && (s.provider === 'deepgram' || s.provider === 'local')) {
          setProviderUi(s.provider, Boolean(s.simulated));
        }
        if (liveDraftOutput && s && s.status) {
          const human = String(s.status);
          liveDraftOutput.statusSpan.textContent = human === 'listening' ? 'Listening…' : human;
        }
        updatePricingUi();
      },
      onTranscript: (t) => {
        const text = String(t?.text || '').trim();
        if (!text) return;
        const isFinal = Boolean(t?.isFinal);
        if (isFinal) {
          liveFinalText = (liveFinalText ? liveFinalText + ' ' : '') + text;
          liveInterimText = '';
        } else {
          liveInterimText = text;
        }
        liveFinalSpan.textContent = liveFinalText;
        liveInterimSpan.textContent = liveInterimText ? (liveFinalText ? ' ' : '') + liveInterimText : '';
        liveTranscript.scrollTop = liveTranscript.scrollHeight;
        if (liveDraftOutput) {
          liveDraftOutput.finalSpan.textContent = liveFinalText;
          liveDraftOutput.interimSpan.textContent = liveInterimText ? (liveFinalText ? ' ' : '') + liveInterimText : '';
        }
      },
      onDone: async (payload) => {
        donePayload = payload || null;
        liveStatus.textContent = 'Stopped';
        resetLiveUi();
        if (liveDraftOutput) {
          const transcript = String(payload?.transcript || '').trim();
          if (transcript) {
            liveDraftOutput.finalSpan.textContent = transcript;
            liveDraftOutput.interimSpan.textContent = '';
          }
          liveDraftOutput.statusSpan.textContent = 'Stopped';
        }

        const audio = payload?.audioUrl;
        if (audio && typeof audio === 'string') {
          audioUrl.setValue(audio);
        }

        if (autoRunAfterLive.getValue()) {
          const runBtn = document.querySelector('[data-agent-run-button]') || document.getElementById('runButton');
          if (runBtn && typeof runBtn.click === 'function') {
            if (runBtn.disabled) return;
            runBtn.click();
          }
        }
        updatePricingUi();
      },
      onError: (message, code) => {
        setLiveError(message);
        if (code === 'INSUFFICIENT_CREDITS') {
          // Best-effort behavior: server may keep recording and allow Stop to save audio,
          // but live captions will pause.
          liveStatus.textContent = 'Paused';
          updatePricingUi();
          return;
        }
        if (code === 'DEEPGRAM_NOT_CONFIGURED') {
          // Non-fatal: server will fall back to local provider.
          updatePricingUi();
          return;
        }
        liveStatus.textContent = 'Error';
        stopLive().catch(() => {});
        updatePricingUi();
      },
    });

    capture = await startPcm16Capture({
      source,
      sampleRateHz: 16000,
      // For meeting capture, avoid echo cancellation/noise suppression.
      audioConstraints: source === 'mic'
        ? { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 }
        : undefined,
      onChunk: (buf) => {
        if (!liveSession) return;
        if (!wsReady) {
          bufferedChunks.push(buf);
          // Keep at most ~10 seconds of audio in memory (best-effort).
          if (bufferedChunks.length > 60) bufferedChunks.shift();
          return;
        }
        // Flush any buffered audio first.
        while (bufferedChunks.length > 0) {
          liveSession.sendAudioChunk(bufferedChunks.shift());
        }
        liveSession.sendAudioChunk(buf);
      },
      onError: (message) => setLiveError(message),
    });

    try {
      await liveSession.start();
      wsReady = true;
      while (bufferedChunks.length > 0) {
        liveSession.sendAudioChunk(bufferedChunks.shift());
      }
    } catch (err) {
      // If the WS fails to start (e.g. insufficient credits), stop capture immediately.
      try { if (capture) await capture.stop(); } catch { /* ignore */ }
      capture = null;
      try { if (liveSession) liveSession.close(); } catch { /* ignore */ }
      liveSession = null;
      throw err;
    }

    liveStartMs = Date.now();
    liveTimer.textContent = '00:00';
    liveTimerHandle = setInterval(() => {
      liveTimer.textContent = formatMmSs(Date.now() - liveStartMs);
      updatePricingUi();
    }, 250);

    liveStartBtn.disabled = true;
    liveStopBtn.disabled = false;
    liveStatus.textContent = 'Listening';
  }

  async function stopLive() {
    liveStopBtn.disabled = true;
    liveStatus.textContent = 'Stopping…';
    try {
      if (capture) {
        await capture.stop();
        capture = null;
      }
    } catch (err) {
      setLiveError(err instanceof Error ? err.message : String(err || 'Failed to stop capture.'));
    }

    try {
      if (liveSession) {
        liveSession.stop();
      }
    } finally {
      stopLiveTimer();
    }
    updatePricingUi();
  }

  liveStartBtn.addEventListener('click', () => {
    startLive().catch((err) => {
      setLiveError(err instanceof Error ? err.message : String(err || 'Failed to start live.'));
      resetLiveUi();
    });
  });
  liveStopBtn.addEventListener('click', () => {
    stopLive().catch((err) => {
      setLiveError(err instanceof Error ? err.message : String(err || 'Failed to stop live.'));
      resetLiveUi();
    });
  });

  const fieldRefs = { audioUrl, meetingTitle, attendees, generateSummary, extractActionItems, detectSpeakers, diarizeSpeakers, diarizeConsent };

  return {
    async getValues() {
      audioUrl.clearError();

      const m = mode.getValue();
      const isLive = m === 'live_mic' || m === 'live_tab';
      let uploadedUrl;
      if (isLive) {
        uploadedUrl = donePayload?.audioUrl || audioUrl.urlInput.value.trim() || undefined;
      } else {
        try {
          uploadedUrl = await audioUrl.getValue();
        } catch (err) {
          audioUrl.setError('Please upload a meeting recording');
          throw new FieldValidationError('audioUrl', 'Please upload a meeting recording');
        }
      }
      if (!uploadedUrl) {
        audioUrl.setError('Please upload a meeting recording');
        throw new FieldValidationError('audioUrl', 'Please upload a meeting recording');
      }

      const formats = normalizeFormats([
        fmtText.getValue() ? 'text' : null,
        fmtJson.getValue() ? 'json' : null,
        fmtSrt.getValue() ? 'srt' : null,
        fmtVtt.getValue() ? 'vtt' : null,
      ].filter(Boolean));

      const attendeeNames = splitLines(attendees.getTrimmed());

      const wantsDiarize = diarizeSpeakers.getValue();
      if (wantsDiarize && !diarizeConsent.getValue()) {
        diarizeConsent.setError('Please confirm consent to audio processing');
        throw new FieldValidationError('diarizeConsent', 'Please confirm consent to audio processing');
      }

      const lm = languageMode.getValue() === 'multilingual' ? 'multilingual' : 'single';
      const singleLang = String(singleLanguageSelect.value || '').trim().toLowerCase();
      const language = lm === 'single' && singleLang ? singleLang : undefined;

      const wantsTranslate = translateToggle.getValue();
      const translationTargets = wantsTranslate
        ? [
          translateEn.getValue() ? 'EN' : null,
          translateTr.getValue() ? 'TR' : null,
        ].filter(Boolean)
        : [];

      return {
        audioUrl: uploadedUrl,
        meetingTitle: meetingTitle.getTrimmed() || undefined,
        attendees: attendeeNames.length ? attendeeNames : undefined,
        options: {
          languageMode: lm,
          ...(language ? { language } : {}),
          ...(translationTargets.length ? { translationTargets } : {}),
          generateSummary: generateSummary.getValue(),
          extractActionItems: extractActionItems.getValue(),
          detectSpeakers: detectSpeakers.getValue(),
          diarizeSpeakers: wantsDiarize,
          outputFormats: formats,
        },
      };
    },
    setFieldError: (fieldId, message) => {
      const field = fieldRefs[fieldId];
      if (field && typeof field.setError === 'function') {
        field.setError(message);
      }
    },
  };
}