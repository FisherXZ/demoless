// Server-side data access for the dashboard recap UI. Prefers real persisted
// sessions/recaps from Redis; callers fall back to the existing mock data when a
// real session id is not found (see app/dashboard/sessions/[id]/page.tsx).
import { loadSession, loadRecap, listSessions } from "../sessions";
import type { RecapReport, RecapStatus, SessionRecord } from "../sessions";

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
