import { describe, it, expect } from "vitest";
import { getDemoConfig } from "./demoConfig";

describe("getDemoConfig", () => {
  it("returns the Browserbase default", () => {
    const c = getDemoConfig();
    expect(c.company).toBe("browserbase");
    expect(c.browseTargetUrl).toMatch(/^https?:\/\//);
    expect(c.persona).toBeTruthy();
  });

  it("returns the same config for explicit 'browserbase'", () => {
    expect(getDemoConfig("browserbase").company).toBe("browserbase");
  });

  it("throws for unknown company", () => {
    expect(() => getDemoConfig("unknown-co")).toThrow("no DemoConfig");
  });
});
