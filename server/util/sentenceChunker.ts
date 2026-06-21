/**
 * Buffers streamed text and emits speakable fragments as soon as they're ready,
 * so TTS can start before the full reply is generated.
 *
 * - Always flushes on sentence-ending punctuation.
 * - For the very first fragment, also flushes on an early clause boundary
 *   (comma/colon/semicolon) so the user hears audio sooner (lower latency).
 * - Safety-flushes very long run-ons at a word boundary.
 */
export class SentenceChunker {
  private buffer = "";
  private emitted = 0;

  private static readonly FIRST_CLAUSE_MIN = 18;
  private static readonly MAX_LEN = 140;
  private static readonly SENTENCE_RE = /([.!?]+["')\]]?\s+|[。！？]\s*)/;
  private static readonly CLAUSE_RE = /([,;:]\s+)/;

  push(text: string): string[] {
    this.buffer += text;
    const out: string[] = [];

    for (;;) {
      const sentence = this.buffer.match(SentenceChunker.SENTENCE_RE);
      if (sentence && sentence.index !== undefined) {
        this.take(out, sentence.index + sentence[0].length);
        continue;
      }

      // First-audio: flush the opening clause early so a reply starts sooner.
      if (this.emitted === 0) {
        const clause = this.buffer.match(SentenceChunker.CLAUSE_RE);
        if (
          clause &&
          clause.index !== undefined &&
          clause.index >= SentenceChunker.FIRST_CLAUSE_MIN
        ) {
          this.take(out, clause.index + clause[0].length);
          continue;
        }
      }

      if (this.buffer.length > SentenceChunker.MAX_LEN) {
        const space = this.buffer.lastIndexOf(" ", SentenceChunker.MAX_LEN);
        this.take(out, space > 0 ? space + 1 : SentenceChunker.MAX_LEN);
        continue;
      }

      break;
    }
    return out;
  }

  private take(out: string[], end: number) {
    const fragment = this.buffer.slice(0, end).trim();
    if (fragment) {
      out.push(fragment);
      this.emitted++;
    }
    this.buffer = this.buffer.slice(end);
  }

  flush(): string {
    const rest = this.buffer.trim();
    this.buffer = "";
    if (rest) this.emitted++;
    return rest;
  }
}
