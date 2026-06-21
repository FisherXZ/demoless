// Pure, in-memory accumulator of trace events for one live session. No Redis,
// no network — VoiceSession feeds it events; build() snapshots a SessionRecord.
import type {
  TraceEvent,
  TranscriptTurn,
  SessionRecord,
  SessionStatus,
  ReplayStatus,
} from "./types";

export class SessionRecorder {
  private _events: TraceEvent[] = [];
  constructor(private startedAt: number = Date.now()) {}

  recordUser(text: string, turn: number, ts: number = Date.now()) {
    this._events.push({ kind: "user_said", text, turn, ts });
  }
  recordAgent(text: string, turn: number, ts: number = Date.now()) {
    this._events.push({ kind: "agent_said", text, turn, ts });
  }
  recordPage(url: string, turn: number, ts: number = Date.now()) {
    this._events.push({ kind: "page_visited", url, turn, ts });
  }
  recordAction(action: "navigate" | "click", detail: string, turn: number, ts: number = Date.now()) {
    this._events.push({ kind: "agent_action", action, detail, turn, ts });
  }
  recordPhase(phase: string, ts: number = Date.now()) {
    this._events.push({ kind: "phase", phase, ts });
  }
  recordRemember(note: string, noteType?: string, ts: number = Date.now()) {
    this._events.push({ kind: "remember", note, noteType, ts });
  }

  events(): TraceEvent[] {
    return [...this._events];
  }

  /** Transcript = the user_said/agent_said events, in order. */
  transcript(): TranscriptTurn[] {
    return this._events
      .filter((e): e is Extract<TraceEvent, { kind: "user_said" | "agent_said" }> =>
        e.kind === "user_said" || e.kind === "agent_said")
      .map((e) => ({
        role: e.kind === "user_said" ? "user" : "agent",
        text: e.text,
        turn: e.turn,
        ts: e.ts,
      }));
  }

  build(args: {
    id: string;
    company: string;
    status: SessionStatus;
    buyerEmail?: string;
    buyerName?: string;
    role?: string;
    createdAt: number;
    startedAt?: number;
    endedAt?: number;
    durationSec?: number;
    phaseReached?: string;
    browserbaseSessionId?: string;
    liveViewUrl?: string;
    language?: string;
    replayStatus?: ReplayStatus;
    replayUrl?: string;
  }): SessionRecord {
    return {
      id: args.id,
      company: args.company,
      status: args.status,
      buyerEmail: args.buyerEmail,
      buyerName: args.buyerName,
      role: args.role,
      createdAt: args.createdAt,
      startedAt: args.startedAt ?? this.startedAt,
      endedAt: args.endedAt,
      durationSec: args.durationSec,
      phaseReached: args.phaseReached,
      browserbaseSessionId: args.browserbaseSessionId,
      liveViewUrl: args.liveViewUrl,
      language: args.language,
      replayStatus: args.replayStatus,
      replayUrl: args.replayUrl,
      events: this.events(),
      transcript: this.transcript(),
    };
  }
}
