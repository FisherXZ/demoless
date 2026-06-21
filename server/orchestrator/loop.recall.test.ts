import { describe, it, expect } from "vitest";
import { LoopOrchestrator } from "./loop";
import type { BuyerMemory } from "../../lib/memory/types";

const cfg = {
  company: "browserbase",
  productName: "Browserbase",
  persona: "Messi",
  browseTargetUrl: "https://x",
  corpusSeed: "",
};
const executor = { phase: "HOOK", run: async () => ({ ok: true, content: "" }) };

/** Minimal returning buyer with one interest note. */
const returningBuyer: BuyerMemory = {
  profile: {
    email: "alice@example.com",
    name: "Alice",
    firstSeen: 1000,
    lastSeen: 2000,
    visitCount: 3,
  },
  notes: [
    { id: "1-0", type: "interest", text: "parallel browser sessions", importance: 0.9, ts: 1000 },
  ],
  isReturning: true,
  recall: {
    line: "Welcome back — last time you cared about parallel browser sessions.",
    topInterests: ["parallel browser sessions"],
    painPoints: [],
    objections: [],
  },
};

describe("LoopOrchestrator recall", () => {
  it("greeting includes recall line for returning buyer", () => {
    const orch = new LoopOrchestrator({ executor: executor as any, cfg: cfg as any });
    const text = orch.greeting("en", "Messi", returningBuyer);
    expect(text).toContain("parallel browser sessions");
  });

  it("returning-buyer greeting references recall and asks today's goal", () => {
    const orch = new LoopOrchestrator({ executor: executor as any, cfg: cfg as any });
    const text = orch.greeting("en", "Messi", returningBuyer);

    expect(text).toContain("parallel browser sessions");
    expect(text).toMatch(/today/i);
    expect(text).toMatch(/trying to figure out/i);
    expect(text).not.toMatch(/pick up there|walk you through/i);
  });

  it("greeting for new buyer has no recall fragment", () => {
    const orch = new LoopOrchestrator({ executor: executor as any, cfg: cfg as any });
    const text = orch.greeting("en", "Messi");
    expect(text).toContain("Messi");
    expect(text).not.toContain("Welcome back");
  });

  it("buildSystem includes memory context block when buyer notes present", async () => {
    const orch = new LoopOrchestrator({ executor: executor as any, cfg: cfg as any });
    let capturedSystem = "";
    (orch as any)._runTurn = async function* ({ system }: any) {
      capturedSystem = system;
      yield { type: "say", text: "Hi." };
      yield { type: "done" };
    };

    const out: any[] = [];
    for await (const c of orch.runTurn(
      { text: "hi", language: "en" },
      { history: [], buyerNotes: ["parallel browser sessions"], agentName: "Messi", learningsContext: "" },
      new AbortController().signal
    )) {
      out.push(c);
    }

    expect(capturedSystem).toContain("parallel browser sessions");
  });
});
