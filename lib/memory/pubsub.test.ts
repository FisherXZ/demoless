import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the redis module so no real Redis connection is attempted.
vi.mock("./redis", () => {
  const channels = new Map<string, Set<(ch: string, msg: string) => void>>();
  const mockRedis = {
    publish: vi.fn(async (channel: string, message: string) => {
      // Notify all subscriber handlers registered on this channel.
      for (const h of (channels.get(channel) ?? new Set())) h(channel, message);
      return (channels.get(channel) ?? new Set()).size;
    }),
  };
  const mockSub = {
    _handlers: new Set<(ch: string, msg: string) => void>(),
    on(event: string, handler: (ch: string, msg: string) => void) {
      if (event === "message") {
        this._handlers.add(handler);
        channels.set("demoless:notes", channels.get("demoless:notes") ?? new Set());
        channels.get("demoless:notes")!.add(handler);
      }
    },
    off(event: string, handler: (ch: string, msg: string) => void) {
      if (event === "message") {
        this._handlers.delete(handler);
        channels.get("demoless:notes")?.delete(handler);
      }
    },
    subscribe: vi.fn(async () => {}),
    unsubscribe: vi.fn(async () => {}),
  };
  return {
    getRedis: () => mockRedis,
    getSubscriber: () => mockSub,
  };
});

import { publishNote, createNotesSubscriber } from "./pubsub";
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

  it("does not invoke the callback after unsubscribe", async () => {
    const received: NoteAddedEvent[] = [];
    const unsub = await createNotesSubscriber((event) => received.push(event));
    await unsub();

    await publishNote("alice@example.com", note);

    expect(received).toHaveLength(0);
  });
});
