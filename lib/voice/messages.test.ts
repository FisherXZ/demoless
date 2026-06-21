import { describe, it, expect } from "vitest";
import { parseClientMessage, parseServerEvent } from "./messages";

describe("voice contract extensions", () => {
  it("parses audio_start with buyer/session identity", () => {
    expect(
      parseClientMessage(
        JSON.stringify({
          t: "audio_start",
          sampleRate: 24000,
          language: "en",
          buyer: { demoSessionId: "demo-1", buyerEmail: "alex@example.com", buyerName: "Alex" },
        })
      )
    ).toEqual({
      t: "audio_start",
      sampleRate: 24000,
      language: "en",
      buyer: { demoSessionId: "demo-1", buyerEmail: "alex@example.com", buyerName: "Alex" },
    });
  });

  it("parses text_input with optional buyer/session identity", () => {
    expect(
      parseClientMessage(
        JSON.stringify({ t: "text_input", text: "show me security", buyer: { demoSessionId: "demo-1", buyerEmail: "alex@example.com" } })
      )
    ).toEqual({
      t: "text_input",
      text: "show me security",
      buyer: { demoSessionId: "demo-1", buyerEmail: "alex@example.com" },
    });
  });

  it("parses a live_view event", () => {
    expect(parseServerEvent(JSON.stringify({ t: "live_view", url: "https://x" })))
      .toEqual({ t: "live_view", url: "https://x" });
  });
  it("parses a set_phase event", () => {
    expect(parseServerEvent(JSON.stringify({ t: "set_phase", phase: "DISCOVERY" })))
      .toEqual({ t: "set_phase", phase: "DISCOVERY" });
  });

  it("parses client messages and rejects invalid input", () => {
    expect(parseClientMessage(JSON.stringify({ t: "audio_stop" }))).toEqual({
      t: "audio_stop",
    });
    expect(parseClientMessage(JSON.stringify({ nope: true }))).toBeNull();
    expect(parseClientMessage("not json")).toBeNull();
  });

  it("rejects invalid server event input", () => {
    expect(parseServerEvent(JSON.stringify({ nope: true }))).toBeNull();
    expect(parseServerEvent("not json")).toBeNull();
  });
});
