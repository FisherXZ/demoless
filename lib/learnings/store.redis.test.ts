import { beforeEach, describe, expect, it, vi } from "vitest";

const streams = new Map<string, Array<[string, string[]]>>();
const fakeRedis = {
  xadd: vi.fn(async (key: string, _id: string, ...fields: string[]) => {
    const id = `${(streams.get(key)?.length ?? 0) + 1}-0`;
    streams.set(key, [...(streams.get(key) ?? []), [id, fields]]);
    return id;
  }),
  xtrim: vi.fn(async () => 0),
  xrange: vi.fn(async (key: string) => streams.get(key) ?? []),
};

vi.mock("../memory/redis", () => ({
  getRedis: () => fakeRedis,
}));

import { MAX_LEARNINGS, getLearnings, writeLearnings } from "./store";

beforeEach(() => {
  streams.clear();
  vi.clearAllMocks();
});

describe("learnings Redis store", () => {
  it("does nothing when there are no learnings to write", async () => {
    await writeLearnings("Browserbase", []);

    expect(fakeRedis.xadd).not.toHaveBeenCalled();
    expect(fakeRedis.xtrim).not.toHaveBeenCalled();
  });

  it("writes clamped confidence values and trims the stream", async () => {
    vi.setSystemTime(1234);

    await writeLearnings("Browserbase", [
      { text: "Lead with sessions.", confidence: Number.NaN },
      { text: "Show security early.", confidence: 2 },
      { text: "Avoid pricing first.", confidence: -1 },
    ]);

    expect(fakeRedis.xadd).toHaveBeenCalledTimes(3);
    expect(fakeRedis.xadd.mock.calls.map((call) => call[5])).toEqual([
      "0.5",
      "1",
      "0",
    ]);
    expect(fakeRedis.xadd.mock.calls.every((call) => call[7] === "1234")).toBe(
      true
    );
    expect(fakeRedis.xtrim).toHaveBeenCalledWith(
      "demoless:learnings:browserbase",
      "MAXLEN",
      "~",
      MAX_LEARNINGS
    );

    vi.useRealTimers();
  });

  it("reads stream entries back as chronological learnings", async () => {
    streams.set("demoless:learnings:browserbase", [
      ["1-0", ["text", "Lead with sessions.", "confidence", "0.7", "ts", "10"]],
      ["2-0", ["text", "Show security.", "confidence", "0.9", "ts", "20"]],
    ]);

    await expect(getLearnings("Browserbase")).resolves.toEqual([
      { id: "1-0", text: "Lead with sessions.", confidence: 0.7, ts: 10 },
      { id: "2-0", text: "Show security.", confidence: 0.9, ts: 20 },
    ]);
  });
});
