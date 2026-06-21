import { getRedis } from "./redis";
import { buyerKey, notesKey, normalizeEmail } from "./keys";
import { composeRecall } from "./recall";
import { publishNote } from "./pubsub";
import type {
  BuyerMemory,
  BuyerProfile,
  Note,
  NoteInput,
} from "./types";

/** Profile fields a caller may set (everything except the managed counters). */
type ProfileInput = Partial<
  Pick<BuyerProfile, "name" | "role" | "company" | "size" | "useCase">
>;

/**
 * Create/merge a buyer profile from pre-call form data (P4A.3).
 * Initializes firstSeen/visitCount only on first write; never resets them.
 */
export async function upsertProfile(
  email: string,
  fields: ProfileInput
): Promise<void> {
  const redis = getRedis();
  const key = buyerKey(email);
  const now = Date.now();

  const set: Record<string, string> = { email: normalizeEmail(email) };
  for (const [k, v] of Object.entries(fields)) {
    if (v != null && v !== "") set[k] = String(v);
  }

  await redis.hset(key, set);
  // Init-only fields: HSETNX leaves an existing buyer's history untouched.
  await redis.hsetnx(key, "firstSeen", String(now));
  await redis.hsetnx(key, "visitCount", "0");
}

/**
 * Append a note to the buyer's stream and publish it live (P4A.2, P4D).
 * Returns the stored note with its assigned id/ts.
 */
export async function remember(
  email: string,
  input: NoteInput
): Promise<Note> {
  const redis = getRedis();
  const ts = Date.now();
  const importance = input.importance ?? 0.5;

  const fields = [
    "type", input.type,
    "text", input.text,
    "importance", String(importance),
    "ts", String(ts),
  ];
  if (input.section) fields.push("section", input.section);

  const id = await redis.xadd(notesKey(email), "*", ...fields);

  const note: Note = {
    id: id as string,
    type: input.type,
    text: input.text,
    importance,
    section: input.section,
    ts,
  };

  await publishNote(email, note);
  return note;
}

function parseNote(id: string, flat: string[]): Note {
  const f: Record<string, string> = {};
  for (let i = 0; i < flat.length; i += 2) f[flat[i]] = flat[i + 1];
  return {
    id,
    type: f.type as Note["type"],
    text: f.text,
    importance: Number(f.importance),
    section: f.section,
    ts: Number(f.ts),
  };
}

/**
 * Read a buyer's notes in chronological order (P4B). When `limit` is given,
 * returns the most recent `limit` notes (still chronological).
 */
export async function getNotes(email: string, limit?: number): Promise<Note[]> {
  const redis = getRedis();
  const key = notesKey(email);

  const entries = limit
    ? (await redis.xrevrange(key, "+", "-", "COUNT", limit)).reverse()
    : await redis.xrange(key, "-", "+");

  return entries.map(([id, flat]) => parseNote(id, flat));
}

function parseProfile(email: string, h: Record<string, string>): BuyerProfile {
  const now = Date.now();
  return {
    email: h.email ?? normalizeEmail(email),
    name: h.name,
    role: h.role,
    company: h.company,
    size: h.size,
    useCase: h.useCase,
    firstSeen: h.firstSeen ? Number(h.firstSeen) : now,
    lastSeen: h.lastSeen ? Number(h.lastSeen) : now,
    visitCount: h.visitCount ? Number(h.visitCount) : 0,
  };
}

/**
 * Load everything for a buyer at demo start (P4A.3/4, P4C). Bumps visitCount
 * and lastSeen, then returns the profile, notes, and composed recall. Backs the
 * buyer_loaded event. Safe to call for an unknown buyer (initializes lazily).
 */
export async function loadBuyer(email: string): Promise<BuyerMemory> {
  const redis = getRedis();
  const key = buyerKey(email);
  const now = Date.now();

  // Ensure identity/firstSeen exist even if upsertProfile was never called.
  await redis.hsetnx(key, "email", normalizeEmail(email));
  await redis.hsetnx(key, "firstSeen", String(now));

  const visitCount = await redis.hincrby(key, "visitCount", 1);
  await redis.hset(key, "lastSeen", String(now));

  const h = await redis.hgetall(key);
  const profile = parseProfile(email, h);
  const notes = await getNotes(email);

  return {
    profile,
    notes,
    isReturning: visitCount > 1,
    recall: composeRecall(notes),
  };
}
