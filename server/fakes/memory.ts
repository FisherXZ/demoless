// Fake P4 (memory). An in-process Map behind the same loadBuyer/saveNote
// contract (Q8). remember writes here; demo-open reads here. Welcome-back works
// across two sessions in one server process. Later: P4 swaps the Map for Redis.

import type { Buyer, NoteInput } from "../../shared/contract";
import type { Loop } from "../loop";

const store = new Map<string, Buyer>();

export function loadBuyer(id: string, name?: string): Buyer {
  let b = store.get(id);
  if (!b) {
    b = { id, name, notes: [] };
    store.set(id, b);
  }
  return structuredClone(b); // copy-on-read: never alias the stored object
}

export function saveNote(id: string, note: NoteInput) {
  // Mutate the stored object directly (bypass the copy-on-read in loadBuyer).
  let b = store.get(id);
  if (!b) { b = { id, notes: [] }; store.set(id, b); }
  b.notes.push({ ...note, at: new Date().toISOString() }); // runtime stamps `at`
  b.lastSeen = new Date().toISOString();
}

export function wipeBuyer(id: string) {
  store.delete(id);
}

/** Wire memory into a loop: handle `remember`, and fire buyer_loaded at open. */
export function registerMemoryFake(loop: Loop, buyerId: string) {
  loop.onCommand((c) => {
    if (c.kind === "remember") saveNote(buyerId, c.note);
  });
  loop.send({ kind: "buyer_loaded", buyer: loadBuyer(buyerId) });
}
