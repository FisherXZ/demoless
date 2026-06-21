import { describe, it, expect, vi, beforeEach } from "vitest";

const hashes = new Map<string, Record<string, string>>();
const fake = {
  hset: vi.fn(async (key: string, obj: Record<string, string>) => {
    hashes.set(key, { ...(hashes.get(key) ?? {}), ...obj });
  }),
  hgetall: vi.fn(async (key: string) => hashes.get(key) ?? {}),
};
vi.mock("../../memory/redis", () => ({ getRedis: () => fake }));

import { extractAndStorePacket, loadPacket } from "./index";
import type { SessionRecord } from "../types";

const withUser: SessionRecord = {
  id: "s1", company: "Acme", status: "ended", createdAt: 0, startedAt: 0, endedAt: 1,
  events: [{ kind: "user_said", text: "we waste hours on manual onboarding", turn: 1, ts: 1 }],
  transcript: [{ role: "user", text: "we waste hours on manual onboarding", turn: 1, ts: 1 }],
};
const noUser: SessionRecord = { id: "s2", company: "Acme", status: "ended", createdAt: 0, startedAt: 0, endedAt: 1, events: [], transcript: [] };

const reply = JSON.stringify({
  summary: "manual onboarding pain",
  painPoints: [{ title: "manual onboarding", detail: "", evidence: [{ kind: "quote", role: "user", text: "manual onboarding" }] }],
});

beforeEach(() => hashes.clear());

describe("extractAndStorePacket", () => {
  it("stores a ready packet on success and dispatches integrations", async () => {
    const chat = vi.fn(async () => reply);
    const dispatch = vi.fn(async () => {});
    await extractAndStorePacket(withUser, chat, dispatch);
    const got = await loadPacket("s1");
    expect(got.status).toBe("ready");
    expect(got.packet?.painPoints).toHaveLength(1);
    expect(dispatch).toHaveBeenCalledWith(withUser, got.packet);
  });

  it("marks insufficient_evidence when there are no buyer turns (no model call)", async () => {
    const chat = vi.fn(async () => reply);
    const dispatch = vi.fn(async () => {});
    await extractAndStorePacket(noUser, chat, dispatch);
    expect(chat).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
    expect((await loadPacket("s2")).status).toBe("insufficient_evidence");
  });

  it("marks failed with the error when extraction throws", async () => {
    const chat = vi.fn(async () => "no json");
    await extractAndStorePacket(withUser, chat, vi.fn(async () => {}));
    const got = await loadPacket("s1");
    expect(got.status).toBe("failed");
    expect(got.packet).toBeNull();
  });
});
