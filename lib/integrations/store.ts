// Redis persistence for the outbound integration feed. The whole feed lives in
// one hash field (`actions` = JSON array, newest first), capped — so we only
// need hset/hgetall, exactly like the other dashboard layers. Reuses the shared
// command client from lib/memory.
import { randomUUID } from "node:crypto";
import { getRedis } from "../memory/redis";
import { NS } from "../sessions/keys";
import type { ConnectorId, ConnectorStatus, DraftAction, IntegrationAction } from "./types";

const FEED_KEY = `${NS}:integrations:feed`;
const FIELD = "actions";
const CAP = 100;
const CONNECTORS: ConnectorId[] = ["hubspot", "clay", "linear"];

async function loadFeed(): Promise<IntegrationAction[]> {
  const h = await getRedis().hgetall(FEED_KEY);
  if (!h || !h[FIELD]) return [];
  try {
    return JSON.parse(h[FIELD]) as IntegrationAction[];
  } catch {
    return [];
  }
}

/** Stamp id/ts onto drafts and prepend them to the capped feed. */
export async function recordActions(drafts: DraftAction[]): Promise<IntegrationAction[]> {
  if (drafts.length === 0) return [];
  const now = Date.now();
  const stamped: IntegrationAction[] = drafts.map((d, i) => ({ ...d, id: randomUUID(), ts: now + i }));
  const next = [...stamped, ...(await loadFeed())].slice(0, CAP);
  await getRedis().hset(FEED_KEY, { [FIELD]: JSON.stringify(next) });
  return stamped;
}

/** The most recent actions, newest first. */
export async function listActions(limit = 50): Promise<IntegrationAction[]> {
  return (await loadFeed()).slice(0, limit);
}

/** Per-connector rollup derived from a list of actions (pure). */
export function connectorStatuses(actions: IntegrationAction[]): ConnectorStatus[] {
  return CONNECTORS.map((connector) => {
    const mine = actions.filter((a) => a.connector === connector);
    return {
      connector,
      lastSyncTs: mine.length ? Math.max(...mine.map((a) => a.ts)) : null,
      count: mine.length,
    };
  });
}
