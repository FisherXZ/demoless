import { afterEach, describe, expect, it, vi } from "vitest";
import { GREETING, SYSTEM_PROMPT } from "./demoConfig";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("demo config URLs", () => {
  it("falls back to Browserbase when DEMO_TARGET_URL is not a valid URL", async () => {
    vi.resetModules();
    process.env.DEMO_TARGET_URL = "not a url";

    const mod = await import("./demoConfig");

    expect(mod.SECTIONS[0].url).toBe("https://www.browserbase.com/overview");
  });

  it("derives sibling dashboard links from a configured target URL", async () => {
    vi.resetModules();
    process.env.DEMO_TARGET_URL = "https://example.com/dashboard/current";

    const mod = await import("./demoConfig");

    expect(mod.SECTIONS[0].url).toBe("https://example.com/dashboard/overview");
    expect(mod.SECTIONS[1].url).toBe("https://example.com/dashboard/sessions");
  });
});

describe("demo config discovery copy", () => {
  it("exports a discovery-first greeting", () => {
    expect(GREETING).toMatch(/what .*trying to figure out/i);
    expect(GREETING).not.toMatch(/show you anything|walk you through/i);
  });

  it("keeps the source system prompt discovery-first", () => {
    expect(SYSTEM_PROMPT).toMatch(/Discovery-first/i);
    expect(SYSTEM_PROMPT).toMatch(/one short question/i);
    expect(SYSTEM_PROMPT).toMatch(/do not assign/i);
    expect(SYSTEM_PROMPT).toMatch(/scores|certainty/i);
  });
});
