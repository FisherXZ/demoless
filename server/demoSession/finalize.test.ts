import { describe, expect, it, vi } from "vitest";
import { SessionRecorder, type SessionRecord } from "../../lib/sessions";
import { createDemoSessionFinalizer } from "./finalize";

describe("demo session finalizer", () => {
  it("reflects learnings and persists one analyzed session record", () => {
    const recorder = new SessionRecorder(1000);
    recorder.recordUser("we need SOC2 proof", 1, 1100);
    recorder.recordAgent("Let me show you sessions.", 1, 1200);

    const reflectAndStore = vi.fn(async () => {});
    const saveSession = vi.fn(async (_record: SessionRecord) => {});
    const analyzeAndStore = vi.fn(async (_record: SessionRecord) => {});

    const finalizer = createDemoSessionFinalizer({
      reflectAndStore,
      saveSession,
      analyzeAndStore,
      replayUrl: (id) => `https://replay.example.com/${id}`,
    });

    finalizer.finalize({
      id: "demo-789",
      browserSessionId: "bb-789",
      company: "browserbase",
      role: "Founder",
      phaseReached: "WALKTHROUGH",
      recorder,
      turns: [
        { role: "user", text: "we need SOC2 proof" },
        { role: "agent", text: "Let me show you sessions." },
      ],
    });

    expect(reflectAndStore).toHaveBeenCalledWith({
      company: "browserbase",
      turns: [
        { role: "user", text: "we need SOC2 proof" },
        { role: "agent", text: "Let me show you sessions." },
      ],
      phaseReached: "WALKTHROUGH",
    });

    expect(saveSession).toHaveBeenCalledTimes(1);
    expect(analyzeAndStore).toHaveBeenCalledTimes(1);
    const record = saveSession.mock.calls[0][0];
    expect(record).toBe(analyzeAndStore.mock.calls[0][0]);
    expect(record).toMatchObject({
      id: "demo-789",
      company: "browserbase",
      role: "Founder",
      phaseReached: "WALKTHROUGH",
      browserbaseSessionId: "bb-789",
      replayUrl: "https://replay.example.com/bb-789",
      transcript: [
        expect.objectContaining({ role: "user", text: "we need SOC2 proof" }),
        expect.objectContaining({
          role: "agent",
          text: "Let me show you sessions.",
        }),
      ],
    });
  });
});
