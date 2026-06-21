import { describe, expect, it, vi } from "vitest";
import { registerBrowserFake } from "./browser";

function makeLoop(screenUrl?: string) {
  const handlers: Array<(cmd: any) => void> = [];
  const sent: unknown[] = [];
  return {
    onCommand: vi.fn((handler: (cmd: any) => void) => handlers.push(handler)),
    send: vi.fn((msg: unknown) => sent.push(msg)),
    getState: vi.fn(() => ({ screen: screenUrl ? { url: screenUrl } : null })),
    emit(command: unknown) {
      for (const handler of handlers) handler(command);
    },
    sent,
  };
}

describe("registerBrowserFake", () => {
  it("turns navigate commands into screen updates", () => {
    const loop = makeLoop();
    registerBrowserFake(loop as any);

    loop.emit({ kind: "navigate", target: "dashboard" });

    expect(loop.sent).toEqual([
      {
        kind: "screen_is_on",
        url: "/dashboard",
        summary: "(fake) now showing dashboard",
      },
    ]);
  });

  it("turns click_or_type commands into screen updates using current URL", () => {
    const loop = makeLoop("/pricing");
    registerBrowserFake(loop as any);

    loop.emit({ kind: "click_or_type", instruction: "Click docs" });

    expect(loop.sent).toEqual([
      {
        kind: "screen_is_on",
        url: "/pricing",
        summary: "(fake) did: Click docs",
      },
    ]);
  });

  it("falls back to root URL when click_or_type has no current screen", () => {
    const loop = makeLoop();
    registerBrowserFake(loop as any);

    loop.emit({ kind: "click_or_type", instruction: "Click docs" });

    expect(loop.sent).toEqual([
      {
        kind: "screen_is_on",
        url: "/",
        summary: "(fake) did: Click docs",
      },
    ]);
  });
});
