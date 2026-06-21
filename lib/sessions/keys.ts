// Redis key builders for the demo-session layer. Keyed by an app-owned session
// id (created up-front), namespaced under `demoless:` like the other layers.
export const NS = "demoless";

/** Hash holding the SessionRecord (metadata + events + transcript as JSON). */
export function sessionKey(id: string): string {
  return `${NS}:session:${id}`;
}

/** Hash holding the RecapReport + status for one session. */
export function recapKey(id: string): string {
  return `${NS}:session:${id}:recap`;
}

/** Sorted set indexing sessions by recency (member = id) for the dashboard list. */
export const SESSIONS_INDEX = `${NS}:sessions`;

/** Sorted set of one buyer's session ids (member = id), for the people directory. */
export function buyerSessionsKey(email: string): string {
  return `${NS}:buyer:${email}:sessions`;
}

/** Browserbase dashboard replay link (auth-gated; internal salesperson use).
 *  Takes the Browserbase session id (an attached field), not the demo id. */
export function replayUrl(browserbaseSessionId: string): string {
  return `https://www.browserbase.com/sessions/${browserbaseSessionId}`;
}
