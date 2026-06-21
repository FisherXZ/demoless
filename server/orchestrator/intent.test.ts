import { describe, expect, it } from "vitest";
import { wantsProductDemo } from "./intent";

describe("wantsProductDemo", () => {
  it("matches feature and product-tour phrasing", () => {
    expect(wantsProductDemo("what features u guys have")).toBe(true);
    expect(wantsProductDemo("What features do you have?")).toBe(true);
    expect(wantsProductDemo("show me around")).toBe(true);
    expect(wantsProductDemo("What is Browserbase?")).toBe(true);
    expect(wantsProductDemo("what does it do")).toBe(true);
    expect(wantsProductDemo("can I see the product")).toBe(true);
  });

  it("does not match vague discovery-only replies", () => {
    expect(wantsProductDemo("hi")).toBe(false);
    expect(wantsProductDemo("I'm looking at automation")).toBe(false);
    expect(wantsProductDemo("pricing")).toBe(false);
  });
});
