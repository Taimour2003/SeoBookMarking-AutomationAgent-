class Pcm16Processor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const opts = options && options.processorOptions ? options.processorOptions : {};
    const target = Number(opts.targetSampleRateHz) || sampleRate;
    this.targetSampleRateHz = Math.max(8000, Math.min(48000, Math.floor(target)));
    this.inputSampleRateHz = sampleRate;
    this._ratio = this.inputSampleRateHz / this.targetSampleRateHz;
    this._carry = 0;
  }

  _resampleToInt16(input) {
    if (!input || input.length === 0) return null;

    if (this.inputSampleRateHz === this.targetSampleRateHz) {
      const out = new Int16Array(input.length);
      for (let i = 0; i < input.length; i++) {
        const s = Math.max(-1, Math.min(1, input[i]));
        out[i] = s < 0 ? Math.round(s * 32768) : Math.round(s * 32767);
      }
      return out;
    }

    // Common case: 48k -> 16k (ratio 3). Use decimation to keep it cheap.
    if (this.inputSampleRateHz % this.targetSampleRateHz === 0) {
      const step = this.inputSampleRateHz / this.targetSampleRateHz;
      const outLen = Math.floor(input.length / step);
      const out = new Int16Array(outLen);
      for (let i = 0; i < outLen; i++) {
        const idx = Math.floor(i * step);
        const s = Math.max(-1, Math.min(1, input[idx]));
        out[i] = s < 0 ? Math.round(s * 32768) : Math.round(s * 32767);
      }
      return out;
    }

    // Fallback: linear interpolation resample.
    const outLen = Math.max(1, Math.floor((input.length + this._carry) / this._ratio));
    const out = new Int16Array(outLen);
    let t = this._carry;
    for (let i = 0; i < outLen; i++) {
      const src = t * this._ratio;
      const i0 = Math.floor(src);
      const i1 = Math.min(input.length - 1, i0 + 1);
      const frac = src - i0;
      const v0 = input[i0] || 0;
      const v1 = input[i1] || 0;
      const s = Math.max(-1, Math.min(1, v0 + (v1 - v0) * frac));
      out[i] = s < 0 ? Math.round(s * 32768) : Math.round(s * 32767);
      t += 1;
    }
    const usedSrc = (outLen * this._ratio) - this._carry;
    this._carry = Math.max(0, this._carry + input.length - usedSrc);
    return out;
  }

  process(inputs) {
    const input = inputs && inputs[0] && inputs[0][0] ? inputs[0][0] : null;
    const out = this._resampleToInt16(input);
    if (out && out.buffer) {
      this.port.postMessage(out.buffer, [out.buffer]);
    }
    return true;
  }
}

registerProcessor('pcm16-processor', Pcm16Processor);

