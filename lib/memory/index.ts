/**
 * P4 — Memory layer (Redis). Public surface imported by P1's server.
 *
 * Typical wiring:
 *   - demo start:  upsertProfile(email, form) -> loadBuyer(email) -> emit buyer_loaded
 *   - each turn:   buildMemoryContext(memory) into the prompt (P1C)
 *   - on extract:  remember(email, note)  (called by P1F)
 *   - live panel:  createNotesSubscriber(onNote) -> WebSocket (P5)
 */

export { getRedis, getSubscriber, closeRedis } from "./redis";
export {
  NS,
  NOTES_CHANNEL,
  normalizeEmail,
  buyerKey,
  notesKey,
} from "./keys";
export { upsertProfile, remember, getNotes, loadBuyer } from "./store";
export { composeRecall, buildMemoryContext } from "./recall";
export { publishNote, createNotesSubscriber } from "./pubsub";
export type {
  NoteType,
  Note,
  NoteInput,
  BuyerProfile,
  Recall,
  BuyerMemory,
  RememberCommand,
  BuyerLoadedEvent,
  NoteAddedEvent,
} from "./types";
