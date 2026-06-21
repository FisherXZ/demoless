import { getRedis, getSubscriber } from "./redis";
import { NOTES_CHANNEL, normalizeEmail } from "./keys";
import type { Note, NoteAddedEvent } from "./types";

/**
 * Publish a newly-saved note to the live channel (P4D). Called by `remember`.
 * P1's server subscribes (see createNotesSubscriber) and forwards to the P5
 * panel over WebSocket.
 */
export async function publishNote(email: string, note: Note): Promise<void> {
  const event: NoteAddedEvent = {
    type: "note_added",
    buyerKey: normalizeEmail(email),
    note,
  };
  await getRedis().publish(NOTES_CHANNEL, JSON.stringify(event));
}

/**
 * Subscribe to the live notes channel. Invokes `onNote` for every note saved
 * by any buyer. Returns an unsubscribe function.
 *
 * Intended for P1's server to bridge Redis Pub/Sub -> WebSocket.
 */
export async function createNotesSubscriber(
  onNote: (event: NoteAddedEvent) => void
): Promise<() => Promise<void>> {
  const sub = getSubscriber();

  const handler = (channel: string, message: string) => {
    if (channel !== NOTES_CHANNEL) return;
    try {
      onNote(JSON.parse(message) as NoteAddedEvent);
    } catch {
      // Ignore malformed payloads rather than crash the subscriber.
    }
  };

  sub.on("message", handler);
  await sub.subscribe(NOTES_CHANNEL);

  return async () => {
    sub.off("message", handler);
    await sub.unsubscribe(NOTES_CHANNEL);
  };
}
