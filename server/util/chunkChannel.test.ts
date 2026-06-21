import { describe, expect, it } from "vitest";
import { ChunkChannel } from "./chunkChannel";

async function collect(channel: ChunkChannel): Promise<string[]> {
  const out: string[] = [];
  for await (const chunk of channel) out.push(chunk.toString());
  return out;
}

describe("ChunkChannel", () => {
  it("buffers chunks pushed before a consumer starts", async () => {
    const channel = new ChunkChannel();
    channel.push(Buffer.from("a"));
    channel.push(Buffer.from("b"));
    channel.close();

    await expect(collect(channel)).resolves.toEqual(["a", "b"]);
  });

  it("delivers chunks to a waiting consumer", async () => {
    const channel = new ChunkChannel();
    const collected = collect(channel);

    channel.push(Buffer.from("live"));
    channel.close();

    await expect(collected).resolves.toEqual(["live"]);
  });

  it("ignores pushes and repeated closes after closing", async () => {
    const channel = new ChunkChannel();
    channel.close();
    channel.close();
    channel.push(Buffer.from("late"));

    await expect(collect(channel)).resolves.toEqual([]);
  });

  it("resolves a waiting consumer when closed before any chunk arrives", async () => {
    const channel = new ChunkChannel();
    const next = channel[Symbol.asyncIterator]().next();

    await new Promise((resolve) => setTimeout(resolve, 0));
    channel.close();

    await expect(next).resolves.toEqual({ value: undefined, done: true });
  });
});
