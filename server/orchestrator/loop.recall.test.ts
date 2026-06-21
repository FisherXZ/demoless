import { describe, it, expect } from "vitest";
import { LoopOrchestrator } from "./loop";
import type { BuyerMemory } from "../../lib/memory/types";

const cfg = {
  company: "browserbase",
  productName: "Browserbase",
  persona: "Maya",
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
    const text = orch.greeting("en", "Maya", returningBuyer);
    expect(text).toContain("parallel browser sessions");
  });

  it("greeting for new buyer has no recall fragment", () => {
    const orch = new LoopOrchestrator({ executor: executor as any, cfg: cfg as any });
    const text = orch.greeting("en", "Maya");
    expect(text).toContain("Maya");
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
      { history: [], buyerNotes: ["parallel browser sessions"], agentName: "Maya", learningsContext: "" },
      new AbortController().signal
    )) {
      out.push(c);
    }

    expect(capturedSystem).toContain("parallel browser sessions");
  });

  it("buildSystem includes learnings context even when no buyer notes are present", async () => {
    const orch = new LoopOrchestrator({ executor: executor as any, cfg: cfg as any });
    let capturedSystem = "";
    (orch as any)._runTurn = async function* ({ system }: any) {
      capturedSystem = system;
      yield { type: "done" };
    };

    for await (const _ of orch.runTurn(
      { text: "hi", language: "en" },
      {
        history: [],
        buyerNotes: [],
        agentName: "Maya",
        learningsContext: "Reusable demo learning: show security first.",
      },
      new AbortController().signal
    )) {
      // drain
    }

    expect(capturedSystem).toContain("Reusable demo learning: show security first.");
    expect(capturedSystem).not.toContain("Known buyer notes");
  });
});
