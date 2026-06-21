import {
  analyzeAndStore as defaultAnalyzeAndStore,
  replayUrl as defaultReplayUrl,
  saveSession as defaultSaveSession,
  type SessionRecord,
  type SessionRecorder,
} from "../../lib/sessions";
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
  replayUrl?: (sessionId: string) => string;
}

export interface FinalizeDemoSessionArgs {
  browserSessionId: string | null;
  company: string;
  role?: string;
  phaseReached?: string;
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
  const replayUrl = deps.replayUrl ?? defaultReplayUrl;

  return {
    finalize(args) {
      void reflectAndStore({
        company: args.company,
        turns: args.turns,
        phaseReached: args.phaseReached,
      }).catch(() => {});

      const id = args.browserSessionId ?? "unknown";
      const record = args.recorder.build({
        id,
        company: args.company,
        role: args.role,
        phaseReached: args.phaseReached,
        replayUrl: replayUrl(id),
      });
      void saveSession(record).catch(() => {});
      void analyzeAndStore(record).catch(() => {});
    },
  };
}

export const defaultDemoSessionFinalizer = createDemoSessionFinalizer();
