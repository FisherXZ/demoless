import { describe, it, expect } from "vitest";
import { learningsKey, companySlug } from "./keys";

describe("learnings keys", () => {
  it("slugifies company names", () => {
    expect(companySlug("  Browser Base ")).toBe("browser-base");
    expect(companySlug("Acme!!Co")).toBe("acme-co");
  });
  it("builds a namespaced per-company stream key", () => {
    expect(learningsKey("Browserbase")).toBe("demoless:learnings:browserbase");
  });
});
