import { describe, it, expect, vi } from "vitest";

vi.mock("../sessions", () => ({
  loadSession: vi.fn(),
  loadRecap: vi.fn(),
  listSessions: vi.fn(async () => []),
}));

import { loadSession, loadRecap, listSessions } from "../sessions";
import { getRecapView, listRecapSessions } from "./source";

describe("getRecapView", () => {
  it("returns null when the session is unknown", async () => {
    (loadSession as any).mockResolvedValue(null);
    (loadRecap as any).mockResolvedValue({ status: "pending", recap: null });
    expect(await getRecapView("nope")).toBeNull();
  });

  it("returns the record + recap + status when present", async () => {
    (loadSession as any).mockResolvedValue({ id: "s1", company: "Acme", events: [], transcript: [], startedAt: 0, endedAt: 1 });
    (loadRecap as any).mockResolvedValue({ status: "ready", recap: { sessionId: "s1", label: "hot" } });
    const v = await getRecapView("s1");
    expect(v).toMatchObject({ status: "ready" });
    expect(v!.record.id).toBe("s1");
    expect(v!.recap!.label).toBe("hot");
  });

  it("returns pending status when the recap is not ready yet", async () => {
    (loadSession as any).mockResolvedValue({ id: "s1", company: "Acme", events: [], transcript: [], startedAt: 0, endedAt: 1 });
    (loadRecap as any).mockResolvedValue({ status: "pending", recap: null });
    const v = await getRecapView("s1");
    expect(v).toMatchObject({ status: "pending" });
    expect(v!.recap).toBeNull();
  });
});

describe("listRecapSessions", () => {
  it("delegates to the sessions store with the provided limit", async () => {
    (listSessions as any).mockResolvedValue([{ id: "s1" }]);

    await expect(listRecapSessions(7)).resolves.toEqual([{ id: "s1" }]);
    expect(listSessions).toHaveBeenCalledWith(7);
  });
});
