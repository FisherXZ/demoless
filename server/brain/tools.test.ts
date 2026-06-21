import { describe, it, expect } from "vitest";
import { TOOLS } from "./tools";

describe("tool catalog", () => {
  it("exposes exactly the brain tools and no STT/TTS tool", () => {
    const names = TOOLS.map((t) => t.name).sort();
    expect(names).toEqual(
      ["click", "look", "navigate", "press", "remember", "scroll", "search_knowledge", "set_phase", "type", "wait"].sort()
    );
  });
  it("every tool has an input_schema with a type object", () => {
    for (const t of TOOLS) expect(t.input_schema.type).toBe("object");
  });
});
