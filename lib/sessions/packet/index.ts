// Public surface of the post-demo packet module. extractAndStorePacket is the
// fire-and-forget entrypoint the voice-server teardown calls (Task 6).
export * from "./types";
export { parsePacket, extractPacket, PROMPT_VERSION, type ChatFn } from "./extract";
export { verifyRef, groundEvidence, groundInsights, groundPacket } from "./ground";
export { deriveLabels } from "./labels";
export { packetKey, setExtractionStatus, savePacket, loadPacket } from "./store";

import type { SessionRecord } from "../types";
import type { SessionPacket } from "./types";
import type { ChatFn } from "./extract";
import { extractPacket } from "./extract";
import { savePacket, setExtractionStatus } from "./store";
import { dispatchIntegrations } from "../../integrations";

export async function extractAndStorePacket(
  record: SessionRecord,
  chat?: ChatFn,
  dispatch: (record: SessionRecord, packet: SessionPacket) => Promise<void> = dispatchIntegrations,
): Promise<void> {
  const id = record.id;
  if (!record.transcript.some((t) => t.role === "user")) {
    await setExtractionStatus(id, "insufficient_evidence");
    return;
  }
  await setExtractionStatus(id, "processing");
  try {
    const packet = await extractPacket(record, chat);
    await savePacket(id, packet);
    // Route the grounded packet out to the seller's tech stack (mocked send).
    await dispatch(record, packet);
  } catch (err) {
    await setExtractionStatus(id, "failed", (err as Error).message);
  }
}
