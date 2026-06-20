/**
 * A single-producer / single-consumer async queue of audio chunks.
 *
 * Lets one TTS synthesis task push PCM chunks while a consumer drains them via
 * `for await`. Used to pipeline synthesis: each spoken sentence gets its own
 * channel that fills (possibly ahead of time) while earlier sentences play.
 */
export class ChunkChannel {
  private buffer: Buffer[] = [];
  private waiter: ((r: IteratorResult<Buffer>) => void) | null = null;
  private closed = false;

  push(chunk: Buffer): void {
    if (this.closed) return;
    if (this.waiter) {
      const resolve = this.waiter;
      this.waiter = null;
      resolve({ value: chunk, done: false });
    } else {
      this.buffer.push(chunk);
    }
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    if (this.waiter) {
      const resolve = this.waiter;
      this.waiter = null;
      resolve({ value: undefined as unknown as Buffer, done: true });
    }
  }

  async *[Symbol.asyncIterator](): AsyncIterator<Buffer> {
    while (true) {
      if (this.buffer.length > 0) {
        yield this.buffer.shift() as Buffer;
        continue;
      }
      if (this.closed) return;
      const result = await new Promise<IteratorResult<Buffer>>((resolve) => {
        this.waiter = resolve;
      });
      if (result.done) return;
      yield result.value;
    }
  }
}
