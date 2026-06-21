import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  writeLearnings: vi.fn(async () => {}),
}));

vi.mock("./store", () => ({
  writeLearnings: mocks.writeLearnings,
}));

import { reflectAndStore } from "./reflect";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("reflectAndStore", () => {
  it("does not call chat or write when the visitor never spoke", async () => {
    const chat = vi.fn(async () => "[]");

    await reflectAndStore({
      company: "browserbase",
      turns: [{ role: "agent", text: "hello" }],
      chat,
    });

    expect(chat).not.toHaveBeenCalled();
    expect(mocks.writeLearnings).not.toHaveBeenCalled();
  });

  it("reflects and writes parsed learnings for sessions with user turns", async () => {
    const chat = vi.fn(async () => '[{"text":"Show security early","confidence":0.8}]');

    await reflectAndStore({
      company: "browserbase",
      phaseReached: "WALKTHROUGH",
      turns: [
        { role: "user", text: "is it secure?" },
        { role: "agent", text: "let me show security" },
      ],
      chat,
    });

    expect(mocks.writeLearnings).toHaveBeenCalledWith("browserbase", [
      { text: "Show security early", confidence: 0.8 },
    ]);
  });

  it("swallows reflection failures", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      reflectAndStore({
        company: "browserbase",
        turns: [{ role: "user", text: "hello" }],
        chat: vi.fn(async () => {
          throw new Error("model down");
        }),
      })
    ).resolves.toBeUndefined();

    expect(mocks.writeLearnings).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
