import type { Language } from "../../lib/voice/messages";
import type { TtsProvider } from "../tts/provider";
import { ChunkChannel } from "../util/chunkChannel";

export interface SpeechText {
  text: string;
  filler: boolean;
}

export type SpeechEvent =
  | { type: "say"; text: string; filler: boolean; turn: number }
  | { type: "audio"; chunk: Buffer; seq: number; turn: number }
  | { type: "error"; message: string };

export interface StreamSpeechTurnArgs {
  texts: AsyncIterable<SpeechText>;
  tts: TtsProvider;
  language: Language;
  turn: number;
  signal: AbortSignal;
}

interface SpeechJob extends SpeechText {
  channel: ChunkChannel;
  error: Error | null;
}

export async function* streamSpeechTurn(
  args: StreamSpeechTurnArgs
): AsyncIterable<SpeechEvent> {
  const jobs: SpeechJob[] = [];
  let producerDone = false;
  let wake: (() => void) | null = null;
  const wakeConsumer = () => {
    if (wake) {
      const resolve = wake;
      wake = null;
      resolve();
    }
  };

  const producer = (async () => {
    try {
      for await (const { text, filler } of args.texts) {
        if (args.signal.aborted) break;
        const job: SpeechJob = {
          text,
          filler,
          channel: new ChunkChannel(),
          error: null,
        };
        jobs.push(job);
        wakeConsumer();
        void (async () => {
          try {
            for await (const chunk of args.tts.synthesize(
              text,
              args.language,
              args.signal
            )) {
              if (args.signal.aborted) break;
              job.channel.push(chunk);
            }
          } catch (err) {
            if (!args.signal.aborted) job.error = err as Error;
          } finally {
            job.channel.close();
          }
        })();
      }
    } finally {
      producerDone = true;
      wakeConsumer();
    }
  })();

  let i = 0;
  let seq = 0;
  while (!args.signal.aborted) {
    if (i >= jobs.length) {
      if (producerDone) break;
      const waited = new Promise<void>((resolve) => {
        wake = resolve;
      });
      if (i < jobs.length || producerDone) {
        wake = null;
      } else {
        await waited;
      }
      continue;
    }

    const job = jobs[i++];
    yield { type: "say", text: job.text, filler: job.filler, turn: args.turn };

    for await (const chunk of job.channel) {
      if (args.signal.aborted) break;
      yield { type: "audio", chunk, seq: seq++, turn: args.turn };
    }

    if (job.error && !args.signal.aborted) {
      yield { type: "error", message: `TTS: ${job.error.message}` };
    }
  }

  await producer;
}
