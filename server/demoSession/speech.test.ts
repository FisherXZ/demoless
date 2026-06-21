import { describe, expect, it, vi } from "vitest";
import { streamSpeechTurn } from "./speech";
import type { TtsProvider } from "../tts/provider";

async function collect<T>(events: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const event of events) out.push(event);
  return out;
}

describe("demo session speech streaming", () => {
  it("streams captions and audio in text order while excluding filler from the interface", async () => {
    const tts: TtsProvider = {
      voiceName: vi.fn().mockReturnValue("Maya"),
      synthesize: vi.fn(async function* (text: string) {
        yield Buffer.from(`audio:${text}`);
      }),
    };

    async function* texts() {
      yield { text: "Sentence one.", filler: false };
      yield { text: "Let me check that.", filler: true };
      yield { text: "Sentence two.", filler: false };
    }

    const events = await collect(
      streamSpeechTurn({
        texts: texts(),
        tts,
        language: "en",
        turn: 4,
        signal: new AbortController().signal,
      })
    );

    expect(events).toEqual([
      { type: "say", text: "Sentence one.", filler: false, turn: 4 },
      {
        type: "audio",
        chunk: Buffer.from("audio:Sentence one."),
        seq: 0,
        turn: 4,
      },
      { type: "say", text: "Let me check that.", filler: true, turn: 4 },
      {
        type: "audio",
        chunk: Buffer.from("audio:Let me check that."),
        seq: 1,
        turn: 4,
      },
      { type: "say", text: "Sentence two.", filler: false, turn: 4 },
      {
        type: "audio",
        chunk: Buffer.from("audio:Sentence two."),
        seq: 2,
        turn: 4,
      },
    ]);
  });

  it("emits a TTS error after the caption when synthesis fails", async () => {
    const tts: TtsProvider = {
      voiceName: vi.fn().mockReturnValue("Maya"),
      synthesize: vi.fn(async function* () {
        throw new Error("provider down");
      }),
    };

    async function* texts() {
      yield { text: "I can show that.", filler: false };
    }

    const events = await collect(
      streamSpeechTurn({
        texts: texts(),
        tts,
        language: "en",
        turn: 2,
        signal: new AbortController().signal,
      })
    );

    expect(events).toEqual([
      { type: "say", text: "I can show that.", filler: false, turn: 2 },
      { type: "error", message: "TTS: provider down" },
    ]);
  });

  it("suppresses TTS errors raised after the turn is aborted", async () => {
    const ac = new AbortController();
    const tts: TtsProvider = {
      voiceName: vi.fn().mockReturnValue("Maya"),
      synthesize: vi.fn(async function* () {
        ac.abort();
        throw new Error("late provider failure");
      }),
    };

    async function* texts() {
      yield { text: "Stopping now.", filler: false };
    }

    const events = await collect(
      streamSpeechTurn({
        texts: texts(),
        tts,
        language: "en",
        turn: 5,
        signal: ac.signal,
      })
    );

    expect(events).toEqual([]);
    expect(tts.synthesize).toHaveBeenCalledWith(
      "Stopping now.",
      "en",
      ac.signal
    );
  });
});
