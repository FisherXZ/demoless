import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockServer } from "./mockServer";
import type { ServerMsg } from "../../shared/wire";

describe("mock harness server discovery greetings", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returning greeting references memory and asks today's discovery question", () => {
    vi.useFakeTimers();
    const events: ServerMsg[] = [];
    const server = createMockServer((m) => events.push(m));

    server.handle({ t: "start", buyerId: "alice" });
    vi.advanceTimersByTime(500);
    server.handle({ t: "user_said", text: "pricing matters", final: true });
    vi.advanceTimersByTime(900);
    server.handle({ t: "start", buyerId: "alice" });
    vi.advanceTimersByTime(500);

    const says = events
      .filter((m): m is Extract<ServerMsg, { t: "command" }> => m.t === "command")
      .map((m) => m.cmd)
      .filter((c) => c.kind === "say");
    const returning = says.at(-1)?.text ?? "";

    expect(returning).toMatch(/pricing matters/i);
    expect(returning).toMatch(/trying to figure out today/i);
    expect(returning).not.toMatch(/pick up there/i);
  });
});
