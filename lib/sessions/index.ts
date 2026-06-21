// Public surface of the post-session recap layer.
export { SessionRecorder } from "./recorder";
export { verifyEvidence, groundEvidenceList, groundInsights } from "./ground";
export { analyzeSession, analyzeAndStore, parseRecap, type ChatFn } from "./analyze";
export {
  createSession,
  saveSession,
  loadSession,
  saveRecap,
  loadRecap,
  listSessions,
  getBuyerSessions,
  type SessionSummary,
  type CreateSessionInput,
} from "./store";
export { NS, sessionKey, recapKey, SESSIONS_INDEX, buyerSessionsKey, replayUrl } from "./keys";
export type {
  TraceEvent,
  TranscriptTurn,
  SessionRecord,
  SessionStatus,
  ReplayStatus,
  Evidence,
  InsightItem,
  ObjectionItem,
  RecapReport,
  RecapLabel,
  RecapStatus,
} from "./types";
