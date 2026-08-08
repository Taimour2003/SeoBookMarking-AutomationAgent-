function buildWsUrl(pathname) {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}${pathname}`;
}

function safeJsonParse(text) {
  try { return JSON.parse(text); } catch { return null; }
}

export function createLiveTranscribeSession(params = {}) {
  const wsUrl = buildWsUrl('/ws/transcribe');
  const provider = params.provider || undefined;
  const sampleRateHz = Number(params.sampleRateHz) > 0 ? Number(params.sampleRateHz) : 16000;
  const language = typeof params.language === 'string' ? params.language : undefined;
  const source = params.source === 'tab' ? 'tab' : (params.source === 'mic' ? 'mic' : undefined);
  const diarize = Boolean(params.diarize);

  const onTranscript = typeof params.onTranscript === 'function' ? params.onTranscript : () => {};
  const onStatus = typeof params.onStatus === 'function' ? params.onStatus : () => {};
  const onDone = typeof params.onDone === 'function' ? params.onDone : () => {};
  const onError = typeof params.onError === 'function' ? params.onError : () => {};

  let ws = null;
  let sessionId = null;
  let startPromise = null;
  let startResolve = null;
  let startReject = null;
  let startTimeout = null;
  let didStart = false;
  let closedByClient = false;

  function sendControl(message) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(message));
  }

  return {
    async start() {
      if (startPromise) return await startPromise;

      didStart = true;
      closedByClient = false;
      startPromise = new Promise((resolve, reject) => {
        startResolve = resolve;
        startReject = reject;
      });

      ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        onStatus({ status: 'connected' });
        sendControl({
          type: 'start',
          payload: {
            provider,
            sampleRateHz,
            language,
            ...(source ? { source } : {}),
            diarize,
            saveAudio: true,
          },
        });

        // Fail-fast if the server never acknowledges listening (e.g., bad WS route or blocked).
        startTimeout = setTimeout(() => {
          if (!startReject) return;
          startReject(new Error('Timed out starting live transcription.'));
        }, 10_000);
      };

      ws.onmessage = (event) => {
        if (typeof event.data !== 'string') return;
        const msg = safeJsonParse(event.data);
        if (!msg || typeof msg.type !== 'string') return;

        if (msg.type === 'ack') {
          sessionId = msg?.payload?.sessionId || null;
          onStatus({ status: 'ack', sessionId });
          return;
        }
        if (msg.type === 'status') {
          if (msg?.payload?.status === 'listening' && startResolve) {
            try { clearTimeout(startTimeout); } catch { /* ignore */ }
            const resolve = startResolve;
            startResolve = null;
            startReject = null;
            startPromise = Promise.resolve();
            resolve(true);
          }
          onStatus(msg.payload || {});
          return;
        }
        if (msg.type === 'transcript') {
          onTranscript(msg.payload || {});
          return;
        }
        if (msg.type === 'billing') {
          onStatus({ status: 'billing', ...(msg.payload || {}) });
          return;
        }
        if (msg.type === 'done') {
          onDone(msg.payload || {});
          return;
        }
        if (msg.type === 'error') {
          const message = msg?.payload?.message || 'Live transcription error';
          const code = msg?.payload?.code || undefined;
          if (startReject) {
            // Some "error" frames are non-fatal (e.g. provider fallback).
            if (code === 'DEEPGRAM_NOT_CONFIGURED') {
              onError(message, code);
              return;
            }
            try { clearTimeout(startTimeout); } catch { /* ignore */ }
            const reject = startReject;
            startResolve = null;
            startReject = null;
            startPromise = null;
            reject(new Error(message));
          }
          onError(message, code);
        }
      };

      ws.onerror = () => {
        if (startReject) {
          try { clearTimeout(startTimeout); } catch { /* ignore */ }
          const reject = startReject;
          startResolve = null;
          startReject = null;
          startPromise = null;
          reject(new Error('Live transcription connection error.'));
        }
        onError('Live transcription connection error.');
      };

      ws.onclose = () => {
        onStatus({ status: 'closed' });
        if (startReject) {
          try { clearTimeout(startTimeout); } catch { /* ignore */ }
          const reject = startReject;
          startResolve = null;
          startReject = null;
          startPromise = null;
          reject(new Error('Live transcription connection closed.'));
        } else if (!closedByClient && didStart) {
          onError('Live transcription connection closed unexpectedly.');
        }
      };

      return await startPromise;
    },

    sendAudioChunk(arrayBuffer) {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(arrayBuffer);
    },

    stop() {
      if (!ws) return;
      try {
        closedByClient = true;
        sendControl({ type: 'stop' });
      } catch { /* ignore */ }
    },

    close() {
      if (!ws) return;
      closedByClient = true;
      try { ws.close(); } catch { /* ignore */ }
      ws = null;
    },
  };
}
