import {
  analyzeAndStore as defaultAnalyzeAndStore,
  replayUrl as defaultReplayUrl,
  saveSession as defaultSaveSession,
  type SessionRecord,
  type SessionRecorder,
  type SessionStatus,
  type ReplayStatus,
} from "../../lib/sessions";
import { extractAndStorePacket as defaultExtractAndStorePacket } from "../../lib/sessions/packet";
import { reflectAndStore as defaultReflectAndStore } from "../../lib/learnings";

export type DemoTurn = { role: "user" | "agent"; text: string };

export interface DemoSessionFinalizerDeps {
  reflectAndStore?: (args: {
    company: string;
    turns: DemoTurn[];
    phaseReached?: string;
  }) => Promise<void>;
  saveSession?: (record: SessionRecord) => Promise<void>;
  analyzeAndStore?: (record: SessionRecord) => Promise<void>;
  extractAndStorePacket?: (record: SessionRecord) => Promise<void>;
  replayUrl?: (sessionId: string) => string;
}

export interface FinalizeDemoSessionArgs {
  id?: string | null;
  browserSessionId: string | null;
  company: string;
  status?: SessionStatus;
  buyerEmail?: string;
  buyerName?: string;
  role?: string;
  createdAt?: number;
  endedAt?: number;
  durationSec?: number;
  phaseReached?: string;
  liveViewUrl?: string;
  language?: string;
  replayStatus?: ReplayStatus;
  recorder: SessionRecorder;
  turns: DemoTurn[];
}

export interface DemoSessionFinalizer {
  finalize(args: FinalizeDemoSessionArgs): void;
}

export function createDemoSessionFinalizer(
  deps: DemoSessionFinalizerDeps = {}
): DemoSessionFinalizer {
  const reflectAndStore = deps.reflectAndStore ?? defaultReflectAndStore;
  const saveSession = deps.saveSession ?? defaultSaveSession;
  const analyzeAndStore = deps.analyzeAndStore ?? defaultAnalyzeAndStore;
  const extractAndStorePacket = deps.extractAndStorePacket ?? defaultExtractAndStorePacket;
  const replayUrl = deps.replayUrl ?? defaultReplayUrl;

  return {
    finalize(args) {
      void reflectAndStore({
        company: args.company,
        turns: args.turns,
        phaseReached: args.phaseReached,
      }).catch(() => {});

      if (!args.id) return;
      const id = args.id;
      const browserbaseSessionId = args.browserSessionId ?? undefined;
      const record = args.recorder.build({
        id,
        company: args.company,
        status: args.status ?? "ended",
        buyerEmail: args.buyerEmail,
        buyerName: args.buyerName,
        role: args.role,
        createdAt: args.createdAt ?? 0,
        endedAt: args.endedAt,
        durationSec: args.durationSec,
        phaseReached: args.phaseReached,
        browserbaseSessionId,
        liveViewUrl: args.liveViewUrl,
        language: args.language,
        replayStatus:
          args.replayStatus ?? (browserbaseSessionId ? "pending" : "unavailable"),
        replayUrl: browserbaseSessionId ? replayUrl(browserbaseSessionId) : undefined,
      });
      void saveSession(record).catch(() => {});
      void analyzeAndStore(record).catch(() => {});
      // Issue #21: also generate the evidence-backed post-demo packet.
      void extractAndStorePacket(record).catch(() => {});
    },
  };
}

export const defaultDemoSessionFinalizer = createDemoSessionFinalizer();
