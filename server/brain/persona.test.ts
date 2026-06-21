import { describe, it, expect } from "vitest";
import { detectPersona, personaBlock } from "./persona";

describe("detectPersona", () => {
  it("classifies builder roles as technical", () => {
    for (const role of [
      "Software Engineer",
      "Senior Developer",
      "DevOps Lead",
      "Backend Programmer",
      "CTO",
      "IT / Security",
      "Data Scientist",
      "Machine Learning Lead",
      "Sales Engineer",
    ]) {
      expect(detectPersona(role)).toBe("technical");
    }
  });

  it("classifies go-to-market / business roles as non-technical", () => {
    for (const role of [
      "VP of Sales",
      "Sales / RevOps",
      "Operations Manager",
      "Marketing",
      "Founder / CEO",
      "Other",
    ]) {
      expect(detectPersona(role)).toBe("nontechnical");
    }
  });

  it("does not confuse 'operations' with 'devops'", () => {
    expect(detectPersona("Head of Operations")).toBe("nontechnical");
    expect(detectPersona("DevOps")).toBe("technical");
  });

  it("defaults to non-technical when role is missing or empty", () => {
    expect(detectPersona()).toBe("nontechnical");
    expect(detectPersona("")).toBe("nontechnical");
    expect(detectPersona(null)).toBe("nontechnical");
  });
});

describe("personaBlock", () => {
  it("returns the technical instruction for a technical role", () => {
    const block = personaBlock("Engineer");
    expect(block).toContain("technical");
    expect(block).toContain("concise");
  });

  it("returns the plain-language instruction for a business role", () => {
    const block = personaBlock("VP of Sales");
    expect(block).toContain("plain language");
    expect(block).toContain("concise");
  });
});
