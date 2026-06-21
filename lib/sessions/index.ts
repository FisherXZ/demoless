// Public surface of the post-session recap layer.
export { SessionRecorder } from "./recorder";
export { verifyEvidence, groundEvidenceList, groundInsights } from "./ground";
export { analyzeSession, analyzeAndStore, parseRecap, type ChatFn } from "./analyze";
export {
  saveSession,
  loadSession,
  saveRecap,
  loadRecap,
  listSessions,
  type SessionSummary,
} from "./store";
export { NS, sessionKey, recapKey, SESSIONS_INDEX, replayUrl } from "./keys";
export type {
  TraceEvent,
  TranscriptTurn,
  SessionRecord,
  Evidence,
  InsightItem,
  ObjectionItem,
  RecapReport,
  RecapLabel,
  RecapStatus,
} from "./types";
