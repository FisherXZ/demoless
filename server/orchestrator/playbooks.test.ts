import { describe, expect, it } from "vitest";
import { matchPlaybook, wantsSecFilingDemo } from "./playbooks";

const sections = [
  { label: "Overview", url: "https://x/overview", words: [] },
  { label: "Playground", url: "https://x/playground", words: [] },
];

describe("wantsSecFilingDemo", () => {
  it("matches SEC filing extraction requests", () => {
    expect(wantsSecFilingDemo("can you extract sec filing")).toBe(true);
    expect(wantsSecFilingDemo("extract SEC filing data")).toBe(true);
    expect(wantsSecFilingDemo("pull sec filings for this fund")).toBe(true);
  });

  it("does not match unrelated requests", () => {
    expect(wantsSecFilingDemo("what features do you have")).toBe(false);
    expect(wantsSecFilingDemo("hi")).toBe(false);
  });
});

describe("matchPlaybook", () => {
  it("runs the SEC filing playbook in the Playground", () => {
    const pb = matchPlaybook("can you extract sec filing", sections);
    expect(pb?.id).toBe("sec-filing");
    expect(pb?.steps.map((s) => ("text" in s ? s.text : s.action))).toEqual([
      "navigate",
      "Extract SEC filing data",
      "look",
      "Run script",
      "set_phase",
    ]);
  });

  it("still routes feature questions to Overview", () => {
    const pb = matchPlaybook("what features u guys have", sections);
    expect(pb?.id).toBe("product-tour");
    expect(pb?.steps[0]).toEqual({ action: "navigate", url: "https://x/overview" });
  });
});
