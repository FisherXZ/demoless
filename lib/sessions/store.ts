// Redis persistence for sessions + recaps. Record/recap stored as JSON-string
// fields in a hash; a sorted set (score=endedAt) indexes sessions for the
// dashboard list. Reuses the shared command client from lib/memory.
import { getRedis } from "../memory/redis";
import { sessionKey, recapKey, SESSIONS_INDEX } from "./keys";
import type { RecapLabel, RecapReport, RecapStatus, SessionRecord } from "./types";

export interface SessionSummary {
  id: string;
  company: string;
  endedAt: number;
  label?: RecapLabel;
  summary?: string;
}

export async function saveSession(record: SessionRecord): Promise<void> {
  const redis = getRedis();
  await redis.hset(sessionKey(record.id), {
    id: record.id,
    company: record.company,
    endedAt: String(record.endedAt),
    record: JSON.stringify(record),
  });
  await redis.zadd(SESSIONS_INDEX, record.endedAt, record.id);
}

export async function loadSession(id: string): Promise<SessionRecord | null> {
  const h = await getRedis().hgetall(sessionKey(id));
  if (!h || !h.record) return null;
  try {
    return JSON.parse(h.record) as SessionRecord;
  } catch {
    return null;
  }
}

export async function saveRecap(id: string, recap: RecapReport): Promise<void> {
  const redis = getRedis();
  await redis.hset(recapKey(id), {
    status: "ready",
    recap: JSON.stringify(recap),
    label: recap.label,
    summary: recap.summary,
    generatedAt: String(recap.generatedAt),
  });
  // Denormalize label/summary onto the index hash so the list view needs one read.
  await redis.hset(sessionKey(id), { label: recap.label, summary: recap.summary });
}

export async function loadRecap(id: string): Promise<{ status: RecapStatus; recap: RecapReport | null }> {
  const h = await getRedis().hgetall(recapKey(id));
  if (!h || !h.recap) return { status: "pending", recap: null };
  try {
    return { status: "ready", recap: JSON.parse(h.recap) as RecapReport };
  } catch {
    return { status: "pending", recap: null };
  }
}

export async function listSessions(limit = 50): Promise<SessionSummary[]> {
  const redis = getRedis();
  const ids = await redis.zrevrange(SESSIONS_INDEX, 0, limit - 1);
  const out: SessionSummary[] = [];
  for (const id of ids) {
    const h = await redis.hgetall(sessionKey(id));
    if (!h || !h.id) continue;
    out.push({
      id: h.id,
      company: h.company ?? "",
      endedAt: Number(h.endedAt ?? 0),
      label: (h.label as RecapLabel) || undefined,
      summary: h.summary || undefined,
    });
  }
  return out;
}
