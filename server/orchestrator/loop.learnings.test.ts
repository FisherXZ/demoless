import { describe, it, expect, vi } from "vitest";
import { LoopOrchestrator } from "./loop";
import type { ToolExecutor } from "../brain/executor";
import type { DemoConfig } from "../config/demoConfig";

const cfg = {
  company: "browserbase",
  productName: "Browserbase",
  persona: "Maya",
  browseTargetUrl: "x",
  corpusSeed: "",
} as DemoConfig;
const executor = { run: vi.fn() } as unknown as ToolExecutor;

describe("LoopOrchestrator learnings injection", () => {
  it("includes the learnings block in the system prompt", async () => {
    const orch = new LoopOrchestrator({ executor, cfg });
    let capturedSystem = "";
    // @ts-expect-error override the test seam
    orch._runTurn = async function* (args: { system: string }) {
      capturedSystem = args.system;
      return; // yield nothing
    };
    for await (const _ of orch.runTurn(
      { text: "hi", language: "en" },
      {
        history: [],
        buyerNotes: [],
        agentName: "Maya",
        learningsContext:
          "Past demo learnings (apply what's relevant, ignore what isn't):\n- Show ROI before features",
      },
      new AbortController().signal
    )) {
      /* drain */
    }
    expect(capturedSystem).toContain("Past demo learnings");
    expect(capturedSystem).toContain("Show ROI before features");
  });

  it("omits the block when learningsContext is empty", async () => {
    const orch = new LoopOrchestrator({ executor, cfg });
    let capturedSystem = "";
    // @ts-expect-error override the test seam
    orch._runTurn = async function* (args: { system: string }) {
      capturedSystem = args.system;
    };
    for await (const _ of orch.runTurn(
      { text: "hi", language: "en" },
      { history: [], buyerNotes: [], agentName: "Maya", learningsContext: "" },
      new AbortController().signal
    )) {
      /* drain */
    }
    expect(capturedSystem).not.toContain("Past demo learnings");
  });
});
