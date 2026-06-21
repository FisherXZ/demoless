import { describe, expect, it } from "vitest";
import { GREETING, SYSTEM_PROMPT } from "./demoConfig";

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
