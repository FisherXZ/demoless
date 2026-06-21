// Server-side data access for the dashboard recap UI. Prefers real persisted
// sessions/recaps from Redis; callers fall back to the existing mock data when a
// real session id is not found (see app/dashboard/sessions/[id]/page.tsx).
import {
  loadSession,
  loadRecap,
  listSessions,
  getBuyerSessions,
} from "../sessions";
import type {
  RecapReport,
  RecapStatus,
  SessionRecord,
  SessionSummary,
  TraceEvent,
  TranscriptTurn,
} from "../sessions";
import { loadPacket } from "../sessions/packet";
import type { ExtractionStatus, SessionPacket } from "../sessions/packet";

export interface RecapView {
  record: SessionRecord;
  recap: RecapReport | null;
  status: RecapStatus;
}

/** The real recap view for a session id, or null if no such session is stored. */
export async function getRecapView(id: string): Promise<RecapView | null> {
  const record = await loadSession(id);
  if (!record) return null;
  const { status, recap } = await loadRecap(id);
  return { record, recap, status };
}

/** Real session summaries for the dashboard list (empty when Redis is empty). */
export async function listRecapSessions(limit = 50) {
  return listSessions(limit);
}

// ── Demo / Live dashboard mode layer (issue #19) ────────────────────────────
//
// The dashboard renders in one of two modes, selected by `?mode=`:
//   • "demo" — the existing seeded mock corpus (lib/dashboard/data). Rich, scored
//     sales-intelligence UI. Unchanged behavior; pages keep their current code.
//   • "live" — real persisted records from lib/sessions. FACTUAL ONLY: buyer
//     identity, lifecycle status, transcript, trace events, Browserbase replay,
//     duration. NO fabricated lead scores / intent / qualification. A recap
//     label/summary is surfaced only when a real recap exists for that session.
//
// This layer expresses the live view models against the new lib/sessions API;
// the demo branch lives in the pages themselves (it predates this layer).

export type DashboardMode = "demo" | "live";

/** A live session, projected for the dashboard. Only real fields — no scores. */
export interface LiveSessionView {
  id: string;
  buyer: LiveBuyer;
  status: SessionRecord["status"];
  isLive: boolean;
  createdAt: number;
  startedAt?: number;
  endedAt?: number;
  /** Best timestamp for "when": ended → started → created. Always defined. */
  whenTs: number;
  durationSec?: number;
  language?: string;
  replayStatus?: SessionRecord["replayStatus"];
  replayUrl?: string;
  browserbaseSessionId?: string;
  transcript: TranscriptTurn[];
  events: TraceEvent[];
  /** Present only when a real recap exists. */
  recapLabel?: SessionSummary["label"];
  recapSummary?: string;
  /** The evidence-backed post-demo packet (issue #21), present on detail views. */
  packet?: SessionPacket | null;
  packetStatus?: ExtractionStatus;
}

export interface LiveBuyer {
  /** URL-safe id for people routes (the normalized email, encoded). */
  id: string;
  email: string;
  name: string;
  company: string;
  initials: string;
}

export interface LivePersonView {
  id: string;
  email: string;
  name: string;
  company: string;
  initials: string;
  sessionCount: number;
  lastSeenTs: number;
  sessions: LiveSessionView[];
}

export interface LiveKpis {
  total: number;
  live: number;
  ended: number;
  withReplay: number;
}

/** Read `?mode=` (default "demo"). Anything but "live" is "demo". */
export function resolveDashboardMode(
  searchParams?: Record<string, string | string[] | undefined>
): DashboardMode {
  const raw = Array.isArray(searchParams?.mode) ? searchParams?.mode[0] : searchParams?.mode;
  return raw === "live" ? "live" : "demo";
}

/** Append/merge `?mode=` onto a path, preserving the active mode across links. */
export function dashboardHref(path: string, mode: DashboardMode): string {
  return `${path}${path.includes("?") ? "&" : "?"}mode=${mode}`;
}

function companyFromEmail(email: string): string {
  const domain = email.split("@")[1] ?? "";
  const base = (domain.split(".")[0] ?? domain) || "Unknown";
  return (
    base
      .split(/[-_]/)
      .filter(Boolean)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" ") || "Unknown"
  );
}

function initialsFrom(name: string, email: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return companyFromEmail(email).slice(0, 2).toUpperCase();
}

function buyerFromRecord(r: { buyerEmail?: string; buyerName?: string; company?: string }): LiveBuyer {
  const email = r.buyerEmail ?? "unknown@unknown";
  const name = r.buyerName || email;
  const company = r.company || companyFromEmail(email);
  return {
    id: encodeURIComponent(email),
    email,
    name,
    company,
    initials: initialsFrom(name, email),
  };
}

function whenTsOf(r: { endedAt?: number; startedAt?: number; createdAt: number }): number {
  return r.endedAt ?? r.startedAt ?? r.createdAt;
}

function viewFromRecord(r: SessionRecord): LiveSessionView {
  return {
    id: r.id,
    buyer: buyerFromRecord(r),
    status: r.status,
    isLive: r.status === "live",
    createdAt: r.createdAt,
    startedAt: r.startedAt,
    endedAt: r.endedAt,
    whenTs: whenTsOf(r),
    durationSec: r.durationSec,
    language: r.language,
    replayStatus: r.replayStatus,
    replayUrl: r.replayUrl,
    browserbaseSessionId: r.browserbaseSessionId,
    transcript: r.transcript,
    events: r.events,
  };
}

/** A live session view backed by a summary (list rows) — no transcript/events. */
function viewFromSummary(s: SessionSummary): LiveSessionView {
  return {
    id: s.id,
    buyer: buyerFromRecord(s),
    status: s.status,
    isLive: s.status === "live",
    createdAt: s.createdAt,
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    whenTs: whenTsOf(s),
    durationSec: s.durationSec,
    replayStatus: s.replayStatus,
    transcript: [],
    events: [],
    recapLabel: s.label,
    recapSummary: s.summary,
  };
}

/** Live session rows for the list/overview (newest first). */
export async function listLiveSessions(limit = 50): Promise<LiveSessionView[]> {
  const summaries = await listSessions(limit);
  return summaries.map(viewFromSummary);
}

/** A single live session with full transcript + trace, or null. */
export async function getLiveSession(id: string): Promise<LiveSessionView | null> {
  const r = await loadSession(id);
  if (!r) return null;
  const view = viewFromRecord(r);
  const { recap } = await loadRecap(id);
  if (recap) {
    view.recapLabel = recap.label;
    view.recapSummary = recap.summary;
  }
  // Issue #21: the evidence-backed packet powers the rich detail panel.
  const { status: packetStatus, packet } = await loadPacket(id);
  view.packet = packet;
  view.packetStatus = packetStatus;
  return view;
}

/** People directory for live mode — buyers folded by email, newest activity first. */
export async function listLivePeople(limit = 100): Promise<LivePersonView[]> {
  const summaries = await listSessions(limit);
  const byEmail = new Map<string, LiveSessionView[]>();
  for (const s of summaries) {
    if (!s.buyerEmail) continue;
    const list = byEmail.get(s.buyerEmail) ?? [];
    list.push(viewFromSummary(s));
    byEmail.set(s.buyerEmail, list);
  }
  const people: LivePersonView[] = [];
  for (const [email, sessions] of byEmail) {
    const latest = sessions[0];
    people.push({
      id: encodeURIComponent(email),
      email,
      name: latest.buyer.name,
      company: latest.buyer.company,
      initials: latest.buyer.initials,
      sessionCount: sessions.length,
      lastSeenTs: Math.max(...sessions.map((s) => s.whenTs)),
      sessions,
    });
  }
  return people.sort((a, b) => b.lastSeenTs - a.lastSeenTs);
}

/** One buyer with their full session records (transcript/events hydrated), or null. */
export async function getLivePerson(id: string): Promise<LivePersonView | null> {
  const email = decodeURIComponent(id);
  const records = await getBuyerSessions(email);
  if (records.length === 0) return null;
  const sessions = records.map(viewFromRecord);
  const latest = sessions[0];
  return {
    id: encodeURIComponent(email),
    email,
    name: latest.buyer.name,
    company: latest.buyer.company,
    initials: latest.buyer.initials,
    sessionCount: sessions.length,
    lastSeenTs: Math.max(...sessions.map((s) => s.whenTs)),
    sessions,
  };
}

/** Factual KPIs derived from live session rows (counts only — no scores). */
export function liveKpis(sessions: LiveSessionView[]): LiveKpis {
  return {
    total: sessions.length,
    live: sessions.filter((s) => s.isLive).length,
    ended: sessions.filter((s) => s.status === "ended").length,
    withReplay: sessions.filter((s) => Boolean(s.browserbaseSessionId) || s.replayStatus === "pending").length,
  };
}

/** Human label for a trace event (factual rendering by kind). */
export function traceEventLabel(e: TraceEvent): { kind: string; text: string } {
  switch (e.kind) {
    case "user_said":
      return { kind: "visitor", text: e.text };
    case "agent_said":
      return { kind: "agent", text: e.text };
    case "page_visited":
      return { kind: "page", text: `Visited ${e.url}` };
    case "agent_action":
      return { kind: e.action, text: e.detail };
    case "phase":
      return { kind: "phase", text: e.phase };
    case "remember":
      return { kind: "noted", text: e.note };
  }
}
