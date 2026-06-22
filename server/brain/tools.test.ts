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
  it("look accepts an optional visual flag and is not required", () => {
    const look = TOOLS.find((t) => t.name === "look")!;
    const props = look.input_schema.properties as Record<string, any>;
    expect(props.visual).toMatchObject({ type: "boolean" });
    expect(look.input_schema.required ?? []).not.toContain("visual");
  });
});
