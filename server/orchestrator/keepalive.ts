import type { Command } from "../../lib/voice/messages";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** If `source` yields no `say` within `ms`, speak `bridge` once (concise filler). */
export async function* withSpeechKeepalive(
  source: AsyncIterable<Command>,
  bridge: string | undefined,
  ms = 1000
): AsyncIterable<Command> {
  if (!bridge?.trim()) {
    yield* source;
    return;
  }

  const it = source[Symbol.asyncIterator]();
  let pending: Promise<IteratorResult<Command>> | null = it.next();
  let bridgeSent = false;

  while (pending) {
    if (bridgeSent) {
      const result = await pending;
      if (result.done) break;
      yield result.value;
      pending = it.next();
      continue;
    }

    const raced = await Promise.race([
      pending.then((r) => ({ kind: "next" as const, r })),
      sleep(ms).then(() => ({ kind: "timeout" as const })),
    ]);

    if (raced.kind === "timeout") {
      bridgeSent = true;
      yield { type: "say", text: bridge };
      continue;
    }

    if (raced.r.done) break;
    if (raced.r.value.type === "say") bridgeSent = true;
    yield raced.r.value;
    pending = it.next();
  }
}
