import { describe, it, expect } from "vitest";
import { SessionRecorder } from "./recorder";

describe("SessionRecorder", () => {
  it("derives an ordered transcript from say/user events and excludes non-speech", () => {
    const r = new SessionRecorder(1000);
    r.recordUser("hi there", 1, 1100);
    r.recordPage("https://x/pricing", 1, 1150);
    r.recordAgent("here is pricing", 1, 1200);
    r.recordAction("click", "Pricing", 1, 1250);
    r.recordPhase("WALKTHROUGH", 1300);

    const t = r.transcript();
    expect(t.map((x) => x.role)).toEqual(["user", "agent"]);
    expect(t[0]).toMatchObject({ role: "user", text: "hi there", turn: 1, ts: 1100 });
    expect(t[1]).toMatchObject({ role: "agent", text: "here is pricing", turn: 1, ts: 1200 });
  });

  it("keeps page/action/phase events in the trace", () => {
    const r = new SessionRecorder(1000);
    r.recordPage("https://x/pricing", 2, 1150);
    r.recordAction("navigate", "https://x/pricing", 2, 1160);
    expect(r.events().map((e) => e.kind)).toEqual(["page_visited", "agent_action"]);
  });

  it("builds a SessionRecord with metadata and derived transcript", () => {
    const r = new SessionRecorder(1000);
    r.recordUser("we want to buy", 1, 1100);
    const rec = r.build({ id: "s1", company: "Acme", role: "Engineer", phaseReached: "CLOSE", replayUrl: "u", endedAt: 2000 });
    expect(rec).toMatchObject({ id: "s1", company: "Acme", role: "Engineer", startedAt: 1000, endedAt: 2000, phaseReached: "CLOSE", replayUrl: "u" });
    expect(rec.transcript).toHaveLength(1);
    expect(rec.events).toHaveLength(1);
  });
});
