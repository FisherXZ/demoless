import { describe, expect, it } from "vitest";
import { buildSystem } from "./messages";
import type { DemoConfig } from "../config/demoConfig";

const cfg: DemoConfig = {
  company: "browserbase",
  productName: "Browserbase",
  persona: "Messi",
  browseTargetUrl: "https://www.browserbase.com",
  corpusSeed: "",
};

describe("buildSystem discovery contract", () => {
  it("instructs the live agent to discover before generic walkthroughs", () => {
    const system = buildSystem(cfg, "");

    expect(system).toContain("Discovery-first");
    expect(system).toMatch(/why the buyer is here/i);
    expect(system).toMatch(/workflow or problem/i);
    expect(system).toMatch(/background/i);
    expect(system).toMatch(/one short question at a time/i);
    expect(system).toMatch(/do not ask.*multiple discovery questions/i);
  });

  it("preserves direct navigation requests with a contextual follow-up", () => {
    const system = buildSystem(cfg, "");

    expect(system).toMatch(/directly asks/i);
    expect(system).toMatch(/pricing/i);
    expect(system).toMatch(/docs/i);
    expect(system).toMatch(/short contextual follow-up/i);
  });

  it("calibrates audience persona from discovery rather than a pre-collected role", () => {
    const system = buildSystem(cfg, "");

    expect(system).toMatch(/calibrate technical depth/i);
    expect(system).toMatch(/through discovery/i);
    expect(system).toMatch(/default to plain language until you know/i);
  });

  it("requires durable buyer memory and bans fake scoring", () => {
    const system = buildSystem(cfg, "");

    expect(system).toMatch(/remember/i);
    expect(system).toMatch(/pain_point/i);
    expect(system).toMatch(/next_step/i);
    expect(system).toMatch(/do not assign/i);
    expect(system).toMatch(/scores/i);
    expect(system).toMatch(/certainty/i);
  });

  it("uses the runtime voice-derived agent name in configured prompts", () => {
    const system = buildSystem(
      {
        ...cfg,
        systemPrompt:
          "You are Messi, a friendly Browserbase sales rep. Messi asks one question at a time.",
      },
      "",
      undefined,
      "Thalia"
    );

    expect(system).toContain("You are Thalia");
    expect(system).toContain("Thalia asks one question");
    expect(system).not.toContain("Messi");
  });
});
