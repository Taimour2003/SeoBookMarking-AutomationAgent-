// Voice Component - Recording (Whisper STT) and Playback (TTS)

const VoiceComponent = (function() {
  'use strict';

  let mediaRecorder = null;
  let audioChunks = [];
  let isRecording = false;
  let currentAudio = null;

  /**
   * Check if browser supports audio recording
   */
  function isRecordingSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  /**
   * Start recording audio
   * @param {Function} onStart - Called when recording starts
   * @param {Function} onError - Called on error
   */
  async function startRecording(onStart, onError) {
    if (!isRecordingSupported()) {
      onError?.('Audio recording is not supported in this browser');
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Use webm format which is widely supported
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      mediaRecorder = new MediaRecorder(stream, { mimeType });
      audioChunks = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.start(100); // Collect data every 100ms
      isRecording = true;
      onStart?.();
      return true;
    } catch (error) {
      console.error('Recording error:', error);
      onError?.(error.message || 'Failed to start recording');
      return false;
    }
  }

  /**
   * Stop recording and return audio blob
   * @returns {Promise<Blob>} Audio blob
   */
  function stopRecording() {
    return new Promise((resolve, reject) => {
      if (!mediaRecorder || !isRecording) {
        reject(new Error('No active recording'));
        return;
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunks, { type: mediaRecorder.mimeType });

        // Stop all tracks
        mediaRecorder.stream.getTracks().forEach(track => track.stop());

        isRecording = false;
        mediaRecorder = null;
        audioChunks = [];

        resolve(blob);
      };

      mediaRecorder.onerror = (event) => {
        reject(event.error || new Error('Recording failed'));
      };

      mediaRecorder.stop();
    });
  }

  /**
   * Cancel current recording without returning data
   */
  function cancelRecording() {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
      mediaRecorder = null;
      audioChunks = [];
      isRecording = false;
    }
  }

  /**
   * Transcribe audio blob using Whisper API
   * @param {Blob} audioBlob - Audio blob to transcribe
   * @returns {Promise<{text: string} | {error: string}>}
   */
  async function transcribe(audioBlob) {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');

    try {
      const response = await fetch('https://aitopia.ai/api/voice/transcribe', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: data.error || 'Transcription failed' };
      }

      return { text: data.text };
    } catch (error) {
      console.error('Transcription error:', error);
      return { error: error.message || 'Transcription failed' };
    }
  }

  /**
   * Play text as speech using TTS API
   * @param {string} text - Text to speak
   * @param {Function} onStart - Called when playback starts
   * @param {Function} onEnd - Called when playback ends
   * @param {Function} onError - Called on error
   */
  async function speak(text, onStart, onEnd, onError) {
    // Stop any current playback
    stopSpeaking();

    try {
      const response = await fetch('https://aitopia.ai/api/voice/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });

      if (!response.ok) {
        const error = await response.json();
        onError?.(error.error || 'TTS failed');
        return;
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      currentAudio = new Audio(audioUrl);

      currentAudio.onplay = () => onStart?.();
      currentAudio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        currentAudio = null;
        onEnd?.();
      };
      currentAudio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        currentAudio = null;
        onError?.('Audio playback failed');
      };

      await currentAudio.play();
    } catch (error) {
      console.error('TTS error:', error);
      onError?.(error.message || 'TTS failed');
    }
  }

  /**
   * Stop current TTS playback
   */
  function stopSpeaking() {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio = null;
    }
  }

  /**
   * Check if currently speaking
   */
  function isSpeaking() {
    return currentAudio && !currentAudio.paused;
  }

  /**
   * Check if currently recording
   */
  function getIsRecording() {
    return isRecording;
  }

  /**
   * Create a speaker button element
   * @param {string} text - Text to speak when clicked
   * @returns {HTMLElement}
   */
  function createSpeakerButton(text) {
    const button = document.createElement('button');
    button.className = 'speaker-button';
    button.title = 'Read aloud';
    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
      </svg>
    `;

    let speaking = false;

    button.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (speaking) {
        stopSpeaking();
        button.classList.remove('speaking');
        speaking = false;
        return;
      }

      speaking = true;
      button.classList.add('speaking');

      await speak(
        text,
        () => {}, // onStart
        () => { // onEnd
          button.classList.remove('speaking');
          speaking = false;
        },
        (error) => { // onError
          console.error('TTS error:', error);
          button.classList.remove('speaking');
          speaking = false;
        }
      );
    });

    return button;
  }

  return {
    isRecordingSupported,
    startRecording,
    stopRecording,
    cancelRecording,
    transcribe,
    speak,
    stopSpeaking,
    isSpeaking,
    isRecording: getIsRecording,
    createSpeakerButton
  };
})();

window.VoiceComponent = VoiceComponent;
