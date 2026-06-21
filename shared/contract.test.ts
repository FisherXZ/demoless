import { describe, it, expect } from "vitest";
import { Incoming, Command, Reply, NoteInput, Note } from "./contract";

describe("contract", () => {
  it("accepts a valid user_said Incoming", () => {
    expect(() => Incoming.parse({ kind: "user_said", text: "hi", final: true })).not.toThrow();
  });

  it("rejects an unknown Incoming kind", () => {
    expect(() => Incoming.parse({ kind: "nope", text: "x" })).toThrow();
  });

  it("accepts say + navigate + remember Commands", () => {
    expect(() => Command.parse({ kind: "say", text: "hello" })).not.toThrow();
    expect(() => Command.parse({ kind: "navigate", target: "dashboard" })).not.toThrow();
    expect(() =>
      Command.parse({ kind: "remember", note: { type: "interest", value: "pricing" } })
    ).not.toThrow();
  });

  it("NoteInput has no `at`; Note requires `at`", () => {
    expect(() => NoteInput.parse({ type: "objection", value: "too pricey" })).not.toThrow();
    expect(() => Note.parse({ type: "objection", value: "too pricey" })).toThrow();
    expect(() =>
      Note.parse({ type: "objection", value: "too pricey", at: "2026-06-20T00:00:00Z" })
    ).not.toThrow();
  });

  it("accepts durable discovery note types", () => {
    for (const type of ["pain_point", "next_step", "persona", "preference"] as const) {
      expect(() => NoteInput.parse({ type, value: `${type} signal` })).not.toThrow();
    }
  });

  it("accepts a Reply with commands and a tour directive", () => {
    const ok = Reply.parse({
      commands: [{ kind: "say", text: "hi" }],
      tour: "advance",
    });
    expect(ok.commands).toHaveLength(1);
    expect(() => Reply.parse({ commands: [{ kind: "say", text: "x" }], tour: { jump: 2 } })).not.toThrow();
  });
});
