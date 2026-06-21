// Fire-and-forget entrypoint: called from the post-demo packet flow once a fresh
// SessionPacket exists. Builds the outbound actions and records them. Never
// throws — a connector/Redis failure must not break session teardown.
import type { SessionRecord } from "../sessions/types";
import type { SessionPacket } from "../sessions/packet/types";
import { buildActions } from "./connectors";
import { recordActions } from "./store";

export async function dispatchIntegrations(record: SessionRecord, packet: SessionPacket): Promise<void> {
  try {
    const actions = await recordActions(buildActions(record, packet));
    if (actions.length) console.log(`[integrations] dispatched ${actions.length} action(s) for ${record.id}`);
  } catch (err) {
    console.error("[integrations] dispatch failed:", err);
  }
}
