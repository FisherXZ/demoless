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
    expect(text).toMatch(/what brought you|what are you working on/i);
    expect(text).not.toMatch(/pick up there|walk you through/i);
  });

  it("omits the English recall line for a non-English session", () => {
    const orch = new LoopOrchestrator({ executor: executor as any, cfg: cfg as any });
    const text = orch.greeting("zh", "Messi", returningBuyer);
    expect(text).not.toContain("Welcome back");
    expect(text).not.toContain("parallel browser sessions");
    expect(text).toContain("你好，Alice，我是Messi");
  });

  it("greeting for new buyer has no recall fragment", () => {
    const orch = new LoopOrchestrator({ executor: executor as any, cfg: cfg as any });
    const text = orch.greeting("en", "Messi");
    expect(text).toContain("Messi");
    expect(text).not.toContain("Welcome back");
  });

  it("greeting addresses the buyer by first name when known", () => {
    const orch = new LoopOrchestrator({ executor: executor as any, cfg: cfg as any });
    const newBuyer: BuyerMemory = {
      profile: { email: "bob@acme.com", name: "Bob Lee", firstSeen: 1, lastSeen: 1, visitCount: 1 },
      notes: [],
      isReturning: false,
      recall: { line: "", topInterests: [], painPoints: [], objections: [] },
    };
    expect(orch.greeting("en", "Messi", newBuyer)).toContain("Hi Bob, I'm Messi");
  });

  it("greeting omits the name when only an email is on file", () => {
    const orch = new LoopOrchestrator({ executor: executor as any, cfg: cfg as any });
    const noName: BuyerMemory = {
      profile: { email: "x@y.com", name: "x@y.com", firstSeen: 1, lastSeen: 1, visitCount: 1 },
      notes: [],
      isReturning: false,
      recall: { line: "", topInterests: [], painPoints: [], objections: [] },
    };
    expect(orch.greeting("en", "Messi", noName)).toContain("Hi, I'm Messi");
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
        agentName: "Messi",
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
