import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the redis module with connection-scoped subscribe/unsubscribe semantics.
// The key invariant: messages are only delivered while the connection is
// subscribed. `on`/`off` manage handler registration, but `unsubscribe` on
// the shared connection stops delivery for ALL handlers — not just one.
vi.mock("./redis", () => {
  let subscribed = false;
  const handlers = new Set<(ch: string, msg: string) => void>();
  let publishFn: ((channel: string, message: string) => Promise<number>) | null = null;

  const mockSub = {
    on(event: string, handler: (ch: string, msg: string) => void) {
      if (event === "message") handlers.add(handler);
    },
    off(event: string, handler: (ch: string, msg: string) => void) {
      if (event === "message") handlers.delete(handler);
    },
    subscribe: vi.fn(async () => { subscribed = true; }),
    unsubscribe: vi.fn(async () => { subscribed = false; }),
  };

  const mockRedis = {
    publish: vi.fn(async (channel: string, message: string) => {
      // Only deliver while the connection is subscribed — mirrors Redis behaviour.
      if (!subscribed) return 0;
      for (const h of handlers) h(channel, message);
      return handlers.size;
    }),
  };

  publishFn = mockRedis.publish;

  return {
    getRedis: () => mockRedis,
    getSubscriber: () => mockSub,
  };
});

// Reset shared subscription state between tests by re-importing with a fresh
// module instance. We achieve this by resetting the module-level singleton
// inside pubsub via the resetModules approach — instead, we reset the mock's
// subscribe/unsubscribe spy counts and clear the subscribed flag by
// re-importing after vi.resetModules() in beforeEach.

import { publishNote, createNotesSubscriber, publishPhase } from "./pubsub";
import type { Note, NoteAddedEvent } from "./types";

const note: Note = {
  id: "1-0",
  type: "interest",
  text: "parallel browser sessions",
  importance: 0.9,
  ts: 1000,
};

describe("createNotesSubscriber", () => {
  it("invokes the callback with the NoteAddedEvent when a note is published", async () => {
    const received: NoteAddedEvent[] = [];
    const unsub = await createNotesSubscriber((event) => received.push(event));

    await publishNote("alice@example.com", note);

    expect(received).toHaveLength(1);
    expect(received[0].type).toBe("note_added");
    expect(received[0].note.text).toBe("parallel browser sessions");

    await unsub();
  });

  it("does not invoke the callback after cancel (handler removed, shared connection stays subscribed)", async () => {
    const received: NoteAddedEvent[] = [];
    const unsub = await createNotesSubscriber((event) => received.push(event));
    await unsub();

    await publishNote("alice@example.com", note);

    expect(received).toHaveLength(0);
  });

  it("multi-client: cancelling the first subscriber does NOT stop the second from receiving", async () => {
    // This is the regression test for finding #1.
    // The old implementation called unsubscribe() per client, which would kill
    // the shared connection and stop delivery for all remaining clients.
    // The fix: cancel() only removes the local handler; never unsubscribes.
    const receivedA: NoteAddedEvent[] = [];
    const receivedB: NoteAddedEvent[] = [];

    const unsubA = await createNotesSubscriber((e) => receivedA.push(e));
    const unsubB = await createNotesSubscriber((e) => receivedB.push(e));

    // Client A disconnects.
    await unsubA();

    // A new note arrives — B must still receive it.
    await publishNote("alice@example.com", note);

    expect(receivedA).toHaveLength(0); // A's handler was removed
    expect(receivedB).toHaveLength(1); // B's connection is unaffected

    await unsubB();
  });
});

describe("publishPhase", () => {
  it("publishes a phase_changed event on the notes channel", async () => {
    const events: unknown[] = [];
    const unsub = await createNotesSubscriber((e) => events.push(e));

    await publishPhase("anonymous", "WALKTHROUGH");

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "phase_changed", phase: "WALKTHROUGH", buyerId: "anonymous" });

    await unsub();
  });
});

describe("malformed payloads", () => {
  it("ignores malformed JSON payloads without crashing the subscriber", async () => {
    const received: unknown[] = [];
    const unsub = await createNotesSubscriber((e) => received.push(e));

    await (await import("./redis")).getRedis().publish("demoless:notes", "{nope");

    expect(received).toHaveLength(0);
    await unsub();
  });

  it("ignores messages published on unrelated channels", async () => {
    const received: unknown[] = [];
    const unsub = await createNotesSubscriber((e) => received.push(e));

    await (await import("./redis")).getRedis().publish(
      "demoless:other",
      JSON.stringify({ type: "note_added", note })
    );

    expect(received).toHaveLength(0);
    await unsub();
  });
});
