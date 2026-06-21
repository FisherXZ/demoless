import { describe, it, expect, vi, beforeEach } from "vitest";

const hashes = new Map<string, Record<string, string>>();
const fake = {
  hset: vi.fn(async (key: string, obj: Record<string, string>) => {
    hashes.set(key, { ...(hashes.get(key) ?? {}), ...obj });
  }),
  hgetall: vi.fn(async (key: string) => hashes.get(key) ?? {}),
};
vi.mock("../memory/redis", () => ({ getRedis: () => fake }));

import { recordActions, listActions, connectorStatuses } from "./store";
import type { DraftAction } from "./types";

const draft = (connector: DraftAction["connector"], title: string): DraftAction => ({
  connector,
  sessionId: "s1",
  company: "Acme",
  buyer: "Bea",
  title,
  detail: "d",
  fields: [],
});

beforeEach(() => hashes.clear());

describe("integrations store", () => {
  it("is a no-op for an empty draft list", async () => {
    expect(await recordActions([])).toEqual([]);
    expect(await listActions()).toEqual([]);
  });

  it("stamps id/ts and lists actions newest-first", async () => {
    const stamped = await recordActions([draft("hubspot", "a"), draft("clay", "b")]);
    expect(stamped[0].id).toBeTruthy();
    expect(stamped[1].ts).toBeGreaterThan(stamped[0].ts);

    const older = stamped;
    await recordActions([draft("linear", "c")]);
    const all = await listActions();
    expect(all.map((a) => a.title)).toEqual(["c", "a", "b"]);
    expect(all.map((a) => a.id)).toContain(older[0].id);
  });

  it("respects the limit argument", async () => {
    await recordActions([draft("hubspot", "a"), draft("clay", "b"), draft("linear", "c")]);
    expect(await listActions(1)).toHaveLength(1);
  });

  it("recovers an empty feed when the stored JSON is corrupt", async () => {
    hashes.set("demoless:integrations:feed", { actions: "{not json" });
    expect(await listActions()).toEqual([]);
  });

  it("rolls connector statuses up from actions", async () => {
    const actions = await recordActions([draft("hubspot", "a"), draft("linear", "b"), draft("linear", "c")]);
    const statuses = connectorStatuses(actions);
    const byId = Object.fromEntries(statuses.map((s) => [s.connector, s]));
    expect(byId.hubspot.count).toBe(1);
    expect(byId.linear.count).toBe(2);
    expect(byId.clay.count).toBe(0);
    expect(byId.clay.lastSyncTs).toBeNull();
    expect(byId.linear.lastSyncTs).toBe(Math.max(actions[1].ts, actions[2].ts));
  });
});
