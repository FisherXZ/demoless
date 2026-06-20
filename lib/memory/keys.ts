/**
 * Redis key + channel builders for the P4 memory layer.
 * Everything is namespaced under `demoless:` so it can share a Redis instance
 * with the other tracks (caching, etc.) without collisions.
 */

export const NS = "demoless";

/** Pub/Sub channel every new note is published to (P4D live panel feed). */
export const NOTES_CHANNEL = `${NS}:notes`;

/**
 * Normalize an email into a stable buyer key: trimmed + lowercased.
 * This is the single source of identity for a buyer across visits (P4C).
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Hash holding a buyer's profile fields. */
export function buyerKey(email: string): string {
  return `${NS}:buyer:${normalizeEmail(email)}`;
}

/** Stream holding a buyer's append-only note log. */
export function notesKey(email: string): string {
  return `${NS}:buyer:${normalizeEmail(email)}:notes`;
}
