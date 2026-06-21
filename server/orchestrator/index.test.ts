import { describe, it, expect, vi } from "vitest";

// Mock heavy lanes before importing createOrchestrator
vi.mock("../../lib/browser/session", () => ({
  navigate: vi.fn(),
  clickText: vi.fn(),
  pageContext: vi.fn(),
  startSession: vi.fn(),
  stopSession: vi.fn(),
}));
vi.mock("../../lib/memory/store", () => ({
  remember: vi.fn(),
}));
vi.mock("../../lib/knowledge/store", () => ({
  searchKnowledge: vi.fn(),
}));
vi.mock("../../lib/knowledge/answer", () => ({
  buildAnswerContext: vi.fn(),
}));

import { createOrchestrator } from "./index";

describe("createOrchestrator", () => {
  it("returns a LoopOrchestrator (has runTurn + greeting)", () => {
    const o = createOrchestrator({ sessionId: "s", buyerId: "b", company: "browserbase" });
    expect(typeof o.runTurn).toBe("function");
    expect(typeof o.greeting).toBe("function");
  });
});
