// Redis persistence for demo sessions + recaps. One hash per session holds the
// metadata (identity, lifecycle, Browserbase link) plus the event log/transcript
// as a JSON `trace` field; a sorted set (score = recency) indexes sessions for
// the dashboard list, and a per-buyer sorted set powers the people directory.
// Reuses the shared command client from lib/memory. No streams — the in-memory
// SessionRecorder is the live event log; we snapshot it here.
import { randomUUID } from "node:crypto";
import { getRedis } from "../memory/redis";
import { normalizeEmail } from "../memory/keys";
import {
  sessionKey,
  recapKey,
  SESSIONS_INDEX,
  buyerSessionsKey,
} from "./keys";
import type {
  RecapLabel,
  RecapReport,
  RecapStatus,
  ReplayStatus,
  SessionRecord,
  SessionStatus,
  TraceEvent,
  TranscriptTurn,
} from "./types";

/** Lightweight projection of a session for the dashboard list views. */
export interface SessionSummary {
  id: string;
  company: string;
  status: SessionStatus;
  buyerEmail?: string;
  buyerName?: string;
  createdAt: number;
  startedAt?: number;
  endedAt?: number;
  durationSec?: number;
  replayStatus?: ReplayStatus;
  label?: RecapLabel;
  summary?: string;
}

export interface CreateSessionInput {
  buyerEmail: string;
  buyerName?: string;
  company?: string;
}

/** Recency score for the index: most-recent activity first. */
function recencyScore(r: Pick<SessionRecord, "createdAt" | "startedAt" | "endedAt">): number {
  return r.endedAt ?? r.startedAt ?? r.createdAt ?? 0;
}

function num(v: string | undefined): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Create a session up-front (at enterDemo), before any cloud browser exists. */
export async function createSession(input: CreateSessionInput): Promise<SessionRecord> {
  const now = Date.now();
  const record: SessionRecord = {
    id: randomUUID(),
    company: input.company ?? "",
    status: "created",
    buyerEmail: normalizeEmail(input.buyerEmail),
    buyerName: input.buyerName,
    createdAt: now,
    events: [],
    transcript: [],
  };
  await saveSession(record);
  return record;
}

/** Upsert the full session record + indexes. Writes only defined fields, so a
 *  later snapshot never clobbers identity/createdAt set at creation time. */
export async function saveSession(record: SessionRecord): Promise<void> {
  const redis = getRedis();
  const fields: Record<string, string> = {
    id: record.id,
    company: record.company,
    status: record.status,
    trace: JSON.stringify({ events: record.events, transcript: record.transcript }),
  };
  const put = (k: string, v: string | number | undefined) => {
    if (v !== undefined && v !== null && v !== "") fields[k] = String(v);
  };
  // createdAt is set once at creation (enterDemo). Later live/ended snapshots
  // from the server pass 0 (unknown), so we never clobber the original.
  put("createdAt", record.createdAt > 0 ? record.createdAt : undefined);
  put("buyerEmail", record.buyerEmail);
  put("buyerName", record.buyerName);
  put("role", record.role);
  put("startedAt", record.startedAt);
  put("endedAt", record.endedAt);
  put("durationSec", record.durationSec);
  put("phaseReached", record.phaseReached);
  put("browserbaseSessionId", record.browserbaseSessionId);
  put("liveViewUrl", record.liveViewUrl);
  put("language", record.language);
  put("replayStatus", record.replayStatus);
  put("replayUrl", record.replayUrl);

  const score = recencyScore(record);
  await redis.hset(sessionKey(record.id), fields);
  await redis.zadd(SESSIONS_INDEX, score, record.id);
  if (record.buyerEmail) {
    await redis.zadd(buyerSessionsKey(normalizeEmail(record.buyerEmail)), score, record.id);
  }
}

function hashToRecord(h: Record<string, string>): SessionRecord | null {
  if (!h || !h.id) return null;
  let events: TraceEvent[] = [];
  let transcript: TranscriptTurn[] = [];
  if (h.trace) {
    try {
      const parsed = JSON.parse(h.trace) as { events?: TraceEvent[]; transcript?: TranscriptTurn[] };
      events = parsed.events ?? [];
      transcript = parsed.transcript ?? [];
    } catch {
      /* leave empty on corrupt trace */
    }
  }
  return {
    id: h.id,
    company: h.company ?? "",
    status: (h.status as SessionStatus) || "created",
    buyerEmail: h.buyerEmail || undefined,
    buyerName: h.buyerName || undefined,
    role: h.role || undefined,
    createdAt: num(h.createdAt) ?? 0,
    startedAt: num(h.startedAt),
    endedAt: num(h.endedAt),
    durationSec: num(h.durationSec),
    phaseReached: h.phaseReached || undefined,
    browserbaseSessionId: h.browserbaseSessionId || undefined,
    liveViewUrl: h.liveViewUrl || undefined,
    language: h.language || undefined,
    replayStatus: (h.replayStatus as ReplayStatus) || undefined,
    replayUrl: h.replayUrl || undefined,
    events,
    transcript,
  };
}

export async function loadSession(id: string): Promise<SessionRecord | null> {
  const h = await getRedis().hgetall(sessionKey(id));
  return hashToRecord(h);
}

function summaryOf(h: Record<string, string>): SessionSummary | null {
  if (!h || !h.id) return null;
  return {
    id: h.id,
    company: h.company ?? "",
    status: (h.status as SessionStatus) || "created",
    buyerEmail: h.buyerEmail || undefined,
    buyerName: h.buyerName || undefined,
    createdAt: num(h.createdAt) ?? 0,
    startedAt: num(h.startedAt),
    endedAt: num(h.endedAt),
    durationSec: num(h.durationSec),
    replayStatus: (h.replayStatus as ReplayStatus) || undefined,
    label: (h.label as RecapLabel) || undefined,
    summary: h.summary || undefined,
  };
}

export async function listSessions(limit = 50): Promise<SessionSummary[]> {
  const redis = getRedis();
  const ids = await redis.zrevrange(SESSIONS_INDEX, 0, limit - 1);
  const out: SessionSummary[] = [];
  for (const id of ids) {
    const s = summaryOf(await redis.hgetall(sessionKey(id)));
    if (s) out.push(s);
  }
  return out;
}

/** Full records for one buyer's sessions, most recent first (people detail). */
export async function getBuyerSessions(email: string, limit = 50): Promise<SessionRecord[]> {
  const redis = getRedis();
  const ids = await redis.zrevrange(buyerSessionsKey(normalizeEmail(email)), 0, limit - 1);
  const out: SessionRecord[] = [];
  for (const id of ids) {
    const r = hashToRecord(await redis.hgetall(sessionKey(id)));
    if (r) out.push(r);
  }
  return out;
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
