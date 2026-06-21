import { describe, it, expect } from "vitest";
import { loadBuyer, saveNote, wipeBuyer } from "./memory";

describe("memory fake", () => {
  it("creates a buyer on first load and returns equal but distinct copies", () => {
    wipeBuyer("alice");
    const a = loadBuyer("alice", "Alice");
    expect(a.id).toBe("alice");
    expect(a.notes).toEqual([]);
    const again = loadBuyer("alice");
    expect(again).toEqual(a);  // same value
    expect(again).not.toBe(a); // distinct copy (copy-on-read)
  });

  it("saveNote persists by id: a fresh loadBuyer sees the note", () => {
    wipeBuyer("x");
    saveNote("x", { type: "interest", value: "analytics" });
    const fresh = loadBuyer("x");
    expect(fresh.notes).toHaveLength(1);
    expect(fresh.notes[0].value).toBe("analytics");
  });

  it("saveNote stamps `at` and appends", () => {
    wipeBuyer("bob");
    saveNote("bob", { type: "interest", value: "analytics" });
    const b = loadBuyer("bob");
    expect(b.notes).toHaveLength(1);
    expect(b.notes[0].value).toBe("analytics");
    expect(typeof b.notes[0].at).toBe("string"); // stamped by the runtime
  });

  it("wipeBuyer clears stored notes", () => {
    saveNote("carol", { type: "objection", value: "price" });
    wipeBuyer("carol");
    expect(loadBuyer("carol").notes).toEqual([]);
  });
});
