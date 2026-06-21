// AudioWorklet: captures mic audio, downsamples to TARGET_RATE mono, converts
// to linear16 PCM, and posts ArrayBuffers to the main thread for streaming to
// the voice gateway. Runs off the main thread to keep capture low-latency.

const TARGET_RATE = 24000;
// ~40ms of input per message keeps message overhead low without adding latency.
const FLUSH_SECONDS = 0.04;

class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = [];
    this._buffered = 0;
    this._inputRate = sampleRate; // AudioWorkletGlobalScope global
    this._flushEvery = Math.floor(this._inputRate * FLUSH_SECONDS);
  }

  process(inputs) {
    const input = inputs[0];
    if (input && input[0]) {
      const channel = input[0];
      // Copy: the underlying buffer is reused across calls.
      this._buffer.push(channel.slice(0));
      this._buffered += channel.length;
      if (this._buffered >= this._flushEvery) this._flush();
    }
    return true;
  }

  _flush() {
    const total = this._buffered;
    const merged = new Float32Array(total);
    let offset = 0;
    for (const block of this._buffer) {
      merged.set(block, offset);
      offset += block.length;
    }
    this._buffer = [];
    this._buffered = 0;

    const pcm = downsampleToInt16(merged, this._inputRate, TARGET_RATE);
    if (pcm.byteLength > 0) {
      this.port.postMessage(pcm.buffer, [pcm.buffer]);
    }
  }
}

function downsampleToInt16(input, inputRate, targetRate) {
  if (inputRate === targetRate) {
    return floatToInt16(input);
  }
  const ratio = inputRate / targetRate;
  const outLength = Math.floor(input.length / ratio);
  const out = new Int16Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const srcPos = i * ratio;
    const idx = Math.floor(srcPos);
    const frac = srcPos - idx;
    const a = input[idx] || 0;
    const b = input[idx + 1] !== undefined ? input[idx + 1] : a;
    const sample = a + (b - a) * frac;
    out[i] = clamp16(sample);
  }
  return out;
}

function floatToInt16(input) {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) out[i] = clamp16(input[i]);
  return out;
}

function clamp16(sample) {
  const s = Math.max(-1, Math.min(1, sample));
  return s < 0 ? s * 0x8000 : s * 0x7fff;
}

registerProcessor("pcm-capture", PcmCaptureProcessor);
