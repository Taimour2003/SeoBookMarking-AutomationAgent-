function formatError(err) {
  if (!err) return 'Unknown error';
  if (err instanceof Error) return err.message || 'Unknown error';
  return String(err);
}

function downsampleFloatToInt16(input, inputRateHz, targetRateHz) {
  if (!input || input.length === 0) return new Int16Array(0);
  const inRate = Number(inputRateHz) || 48000;
  const outRate = Number(targetRateHz) || 16000;
  if (inRate === outRate) {
    const out = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      out[i] = s < 0 ? Math.round(s * 32768) : Math.round(s * 32767);
    }
    return out;
  }

  // Common case: 48k -> 16k
  if (inRate % outRate === 0) {
    const step = inRate / outRate;
    const outLen = Math.floor(input.length / step);
    const out = new Int16Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const idx = Math.floor(i * step);
      const s = Math.max(-1, Math.min(1, input[idx]));
      out[i] = s < 0 ? Math.round(s * 32768) : Math.round(s * 32767);
    }
    return out;
  }

  const ratio = inRate / outRate;
  const outLen = Math.max(1, Math.floor(input.length / ratio));
  const out = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const src = i * ratio;
    const i0 = Math.floor(src);
    const i1 = Math.min(input.length - 1, i0 + 1);
    const frac = src - i0;
    const v = (input[i0] || 0) + ((input[i1] || 0) - (input[i0] || 0)) * frac;
    const s = Math.max(-1, Math.min(1, v));
    out[i] = s < 0 ? Math.round(s * 32768) : Math.round(s * 32767);
  }
  return out;
}

async function getMicStream(audioConstraints) {
  return await navigator.mediaDevices.getUserMedia({ audio: audioConstraints || true, video: false });
}

async function getTabAudioStream() {
  // Best-effort: requires user selecting a tab/window and enabling "share audio" (Chrome/Edge).
  const stream = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true });
  // Drop video immediately (we only want audio).
  try {
    stream.getVideoTracks().forEach((t) => t.stop());
  } catch { /* ignore */ }
  return stream;
}

export async function startPcm16Capture(params) {
  const sampleRateHz = Math.max(8000, Math.min(48000, Math.floor(Number(params?.sampleRateHz) || 16000)));
  const source = params?.source === 'tab' ? 'tab' : 'mic';
  const onChunk = typeof params?.onChunk === 'function' ? params.onChunk : () => {};
  const onStatus = typeof params?.onStatus === 'function' ? params.onStatus : () => {};
  const onError = typeof params?.onError === 'function' ? params.onError : () => {};
  const audioConstraints = params?.audioConstraints;

  if (!navigator?.mediaDevices?.getUserMedia) {
    throw new Error('Audio capture is not supported in this browser.');
  }

  let stream;
  if (source === 'tab') {
    if (!navigator?.mediaDevices?.getDisplayMedia) {
      throw new Error('Tab audio capture is not supported in this browser.');
    }
    stream = await getTabAudioStream();
    const hasAudio = stream.getAudioTracks().length > 0;
    if (!hasAudio) {
      stream.getTracks().forEach((t) => t.stop());
      throw new Error('No audio track was captured. When sharing a tab, enable “Share audio”.');
    }
  } else {
    stream = await getMicStream(audioConstraints);
  }

  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) {
    stream.getTracks().forEach((t) => t.stop());
    throw new Error('AudioContext is not supported in this browser.');
  }

  const audioContext = new AudioContextCtor();
  try {
    if (audioContext.state === 'suspended' && typeof audioContext.resume === 'function') {
      await audioContext.resume();
    }
  } catch { /* ignore */ }
  const sourceNode = audioContext.createMediaStreamSource(stream);
  const sink = audioContext.createGain();
  sink.gain.value = 0;
  sink.connect(audioContext.destination);

  let workletNode = null;
  let scriptNode = null;

  const cleanup = async () => {
    try { sourceNode.disconnect(); } catch { /* ignore */ }
    try { sink.disconnect(); } catch { /* ignore */ }
    try { if (workletNode) workletNode.disconnect(); } catch { /* ignore */ }
    try { if (scriptNode) scriptNode.disconnect(); } catch { /* ignore */ }
    try { stream.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
    try { await audioContext.close(); } catch { /* ignore */ }
  };

  try {
    if (audioContext.audioWorklet && typeof audioContext.audioWorklet.addModule === 'function') {
      await audioContext.audioWorklet.addModule('/aitopia/marketplace/js/runner/worklets/pcm16-processor.js');
      workletNode = new AudioWorkletNode(audioContext, 'pcm16-processor', {
        processorOptions: { targetSampleRateHz: sampleRateHz },
      });
      workletNode.port.onmessage = (e) => {
        try {
          const buf = e?.data;
          if (buf instanceof ArrayBuffer && buf.byteLength > 0) onChunk(buf);
        } catch (err) {
          onError(formatError(err));
        }
      };
      sourceNode.connect(workletNode);
      workletNode.connect(sink);
      onStatus({ status: 'capturing', method: 'audioWorklet', sampleRateHz });
      return { stop: cleanup, stream, method: 'audioWorklet', sampleRateHz };
    }

    // Fallback: ScriptProcessorNode (deprecated, best-effort).
    scriptNode = audioContext.createScriptProcessor(4096, 1, 1);
    scriptNode.onaudioprocess = (event) => {
      try {
        const input = event.inputBuffer.getChannelData(0);
        const pcm = downsampleFloatToInt16(input, audioContext.sampleRate, sampleRateHz);
        if (pcm.byteLength > 0) onChunk(pcm.buffer);
      } catch (err) {
        onError(formatError(err));
      }
    };
    sourceNode.connect(scriptNode);
    scriptNode.connect(sink);
    onStatus({ status: 'capturing', method: 'scriptProcessor', sampleRateHz });
    return { stop: cleanup, stream, method: 'scriptProcessor', sampleRateHz };
  } catch (err) {
    await cleanup();
    throw err;
  }
}
