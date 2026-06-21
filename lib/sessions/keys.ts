// Redis key builders for the per-session recap layer. Keyed by session id
// (Browserbase session id), namespaced under `demoless:` like the other layers.
export const NS = "demoless";

/** Hash holding the SessionRecord (metadata + events + transcript as JSON). */
export function sessionKey(id: string): string {
  return `${NS}:session:${id}`;
}

/** Hash holding the RecapReport + status for one session. */
export function recapKey(id: string): string {
  return `${NS}:session:${id}:recap`;
}

/** Sorted set indexing sessions by endedAt (member = id) for the dashboard list. */
export const SESSIONS_INDEX = `${NS}:sessions`;

/** Browserbase dashboard replay link (auth-gated; internal salesperson use). */
export function replayUrl(id: string): string {
  return `https://www.browserbase.com/sessions/${id}`;
}
