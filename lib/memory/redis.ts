import Redis from "ioredis";

/**
 * Shared ioredis clients for the memory layer.
 *
 * A connection in "subscriber mode" cannot run normal commands, so we keep two
 * lazily-created singletons: one for commands (get/set/xadd/publish) and one
 * dedicated to Pub/Sub subscriptions (P4D).
 *
 * REDIS_URL points at Redis Cloud (sponsor) or a local instance
 * (redis://localhost:6379). See .env.example.
 */

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

let client: Redis | null = null;
let subscriber: Redis | null = null;

/** Command client. Reused across calls. */
export function getRedis(): Redis {
  if (!client) {
    client = new Redis(REDIS_URL, { lazyConnect: false });
  }
  return client;
}

/** Dedicated client for Pub/Sub subscriptions (separate connection). */
export function getSubscriber(): Redis {
  if (!subscriber) {
    subscriber = new Redis(REDIS_URL, { lazyConnect: false });
  }
  return subscriber;
}

/** Close both clients — handy for scripts/tests so the process can exit. */
export async function closeRedis(): Promise<void> {
  await Promise.all([client?.quit(), subscriber?.quit()]);
  client = null;
  subscriber = null;
}
