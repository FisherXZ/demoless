// server/smoke.test.ts
import { describe, it, expect } from "vitest";
import { runSmoke } from "./smoke";
import { loadBuyer, wipeBuyer } from "./fakes/memory";

describe("e2e smoke (stub model)", () => {
  it("captures a note in session 1 that memory retains for session 2", async () => {
    process.env.USE_STUB = "1";
    wipeBuyer("e2e");
    await runSmoke("e2e");
    expect(loadBuyer("e2e").notes.length).toBeGreaterThan(0); // remember fired
  });
});
