import { describe, it, expect, vi } from "vitest";
import { makeExecutor } from "./executor";

/** Fake deps with a searchKnowledge that rejects with the RediSearch-absent error. */
const fakeWithRagError = () => ({
  sessionId: "s1",
  buyerId: "b1",
  company: "browserbase",
  browser: {
    navigate: vi.fn(async () => ({ sessionId: "s1", url: "/x", title: "" })),
    clickText: vi.fn(async () => ({ sessionId: "s1", url: "/x", title: "" })),
    pageContext: vi.fn(async () => ({ url: "/x", title: "X", links: [], text: "" })),
  },
  memory: { remember: vi.fn(async () => ({ id: "n1" })) },
  knowledge: {
    searchKnowledge: vi.fn(async () => {
      throw new Error("Module is not supported. Redis Stack is required.");
    }),
    buildAnswerContext: vi.fn((_h: any[]) => ""),
  },
});

describe("ToolExecutor search_knowledge RAG degrade", () => {
  it("returns ok:true with fallback message when RediSearch is absent", async () => {
    const f = fakeWithRagError();
    const ex = makeExecutor(f as any);
    const r = await ex.run("search_knowledge", { query: "pricing" });
    expect(r.ok).toBe(true);
    expect(r.content).toBe(
      "Knowledge base unavailable; answer from general product facts."
    );
  });

  it("still propagates non-Redis errors as ok:false", async () => {
    const f = fakeWithRagError();
    f.knowledge.searchKnowledge = vi.fn(async () => {
      throw new Error("Network timeout");
    });
    const ex = makeExecutor(f as any);
    const r = await ex.run("search_knowledge", { query: "pricing" });
    expect(r.ok).toBe(false);
    expect(r.content).toContain("Network timeout");
  });
});
