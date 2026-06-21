import { describe, it, expect, vi } from "vitest";
import { parseLearnings, reflectOnSession } from "./reflect";

describe("parseLearnings", () => {
  it("extracts a JSON array even with surrounding prose", () => {
    const raw =
      'Sure! Here are the lessons:\n[{"text":"Show ROI before features","confidence":0.8}]\nHope that helps.';
    expect(parseLearnings(raw)).toEqual([
      { text: "Show ROI before features", confidence: 0.8 },
    ]);
  });
  it("defaults missing confidence to 0.5 and drops empty text", () => {
    const raw = '[{"text":"Lead with the leaderboard"},{"text":"  "}]';
    expect(parseLearnings(raw)).toEqual([
      { text: "Lead with the leaderboard", confidence: 0.5 },
    ]);
  });
  it("returns [] for unparseable output", () => {
    expect(parseLearnings("no json here")).toEqual([]);
    expect(parseLearnings("[broken")).toEqual([]);
    expect(parseLearnings("[broken]")).toEqual([]);
  });
  it("caps at 3 learnings", () => {
    const raw = JSON.stringify(
      Array.from({ length: 5 }, (_, i) => ({ text: `r${i}`, confidence: 0.5 }))
    );
    expect(parseLearnings(raw)).toHaveLength(3);
  });
});

describe("reflectOnSession", () => {
  it("passes the transcript to the chat fn and parses its output", async () => {
    const chat = vi.fn(
      async (_system: string, _user: string) =>
        '[{"text":"Answer objections by opening the relevant page","confidence":0.7}]'
    );
    const out = await reflectOnSession(
      [
        { role: "user", text: "is it secure?" },
        { role: "agent", text: "let me show you the compliance page" },
      ],
      "CLOSE",
      chat
    );
    expect(out).toEqual([
      { text: "Answer objections by opening the relevant page", confidence: 0.7 },
    ]);
    const userPrompt = chat.mock.calls[0][1];
    expect(userPrompt).toContain("is it secure?");
    expect(userPrompt).toContain("CLOSE");
  });
});
