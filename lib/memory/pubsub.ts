import { getRedis, getSubscriber } from "./redis";
import { NOTES_CHANNEL, normalizeEmail } from "./keys";
import type { Note, NoteAddedEvent, PhaseChangedEvent } from "./types";

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
 * Publish a phase transition to the live channel so the dashboard SSE feed
 * can forward it as a `phase_changed` event.
 */
export async function publishPhase(buyerId: string, phase: string): Promise<void> {
  const event: PhaseChangedEvent = { type: "phase_changed", phase, buyerId };
  await getRedis().publish(NOTES_CHANNEL, JSON.stringify(event));
}

/**
 * Shared subscription state — the channel is subscribed once at the connection
 * level and stays subscribed as long as there is at least one active listener.
 * Individual callers only add/remove their local `message` handler; they never
 * call `subscribe`/`unsubscribe` on the shared connection (which would affect
 * ALL other open SSE clients).
 */
let sharedSubReady: Promise<void> | null = null;

function ensureSharedSubscription(): Promise<void> {
  if (!sharedSubReady) {
    sharedSubReady = getSubscriber().subscribe(NOTES_CHANNEL).then(() => {});
  }
  return sharedSubReady;
}

/**
 * Subscribe to the live notes channel. Invokes `onNote` for every note saved
 * by any buyer. Returns a cancel function.
 *
 * The underlying Redis subscribe happens once (module-level); this function
 * only wires/unwires a per-client message handler so that one client
 * disconnecting never disrupts other active SSE connections.
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

  await ensureSharedSubscription();
  sub.on("message", handler);

  return async () => {
    // Remove only the local handler — never unsubscribe the shared connection.
    sub.off("message", handler);
  };
}
