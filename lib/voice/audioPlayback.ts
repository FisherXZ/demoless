/**
 * Schedules streamed linear16 PCM chunks for gapless playback via Web Audio.
 *
 * Each chunk becomes an AudioBufferSourceNode scheduled back-to-back through a
 * gain node. Keeping references to live sources lets {@link stop} cut playback
 * instantly mid-sentence, which is what makes barge-in feel immediate (P2C).
 */
export class PcmPlayer {
  private gain: GainNode;
  private nextTime = 0;
  private sources = new Set<AudioBufferSourceNode>();

  /**
   * @param bufferAhead Seconds of cushion scheduled before playback (re)starts.
   *  Absorbs network/synthesis jitter so chunks don't underrun into glitches.
   *  Only adds latency when (re)starting from idle; continuous audio is gapless.
   */
  constructor(
    private ctx: AudioContext,
    private sampleRate = 24000,
    private bufferAhead = 0.12
  ) {
    this.gain = ctx.createGain();
    this.gain.connect(ctx.destination);
  }

  /** Queue a chunk of linear16 PCM (mono @ sampleRate). */
  enqueue(pcm: Int16Array) {
    if (pcm.length === 0) return;
    const buffer = this.ctx.createBuffer(1, pcm.length, this.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) channel[i] = pcm[i] / 0x8000;

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.gain);

    const now = this.ctx.currentTime;
    // If the schedule has fallen behind (idle start or an underrun), rebuild a
    // small cushion before resuming; otherwise schedule back-to-back, gapless.
    if (this.nextTime < now) {
      this.nextTime = now + this.bufferAhead;
    }
    const startAt = this.nextTime;
    src.start(startAt);
    this.nextTime = startAt + buffer.duration;

    this.sources.add(src);
    src.onended = () => this.sources.delete(src);
  }

  /** Stop everything currently queued/playing immediately (barge-in). */
  stop() {
    for (const src of this.sources) {
      try {
        src.onended = null;
        src.stop();
        src.disconnect();
      } catch {
        /* already stopped */
      }
    }
    this.sources.clear();
    this.nextTime = 0;
  }

  get isPlaying() {
    return this.sources.size > 0 || this.nextTime > this.ctx.currentTime;
  }
}

/** Decode a base64 linear16 payload into an Int16Array. */
export function base64ToInt16(b64: string): Int16Array {
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  // Ensure even length for 16-bit samples.
  const usable = len - (len % 2);
  return new Int16Array(bytes.buffer, 0, usable / 2);
}

/**
 * Stateful decoder for streamed linear16 PCM.
 *
 * Provider/network chunks may split on any byte boundary, including between the
 * two bytes of a 16-bit sample. Keep the dangling byte and prepend it to the
 * next chunk so playback never loses sample alignment.
 */
export class PcmChunkDecoder {
  private carry: number | null = null;

  decode(b64: string): Int16Array {
    const binary = atob(b64);
    let bytes = new Uint8Array(binary.length + (this.carry == null ? 0 : 1));
    let offset = 0;

    if (this.carry != null) {
      bytes[0] = this.carry;
      this.carry = null;
      offset = 1;
    }

    for (let i = 0; i < binary.length; i++) {
      bytes[offset + i] = binary.charCodeAt(i);
    }

    if (bytes.length % 2 === 1) {
      this.carry = bytes[bytes.length - 1];
      bytes = bytes.subarray(0, bytes.length - 1);
    }

    if (bytes.length === 0) return new Int16Array();
    return new Int16Array(bytes.buffer, bytes.byteOffset, bytes.length / 2);
  }

  reset() {
    this.carry = null;
  }
}
