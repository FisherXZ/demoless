import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("demo config", () => {
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
