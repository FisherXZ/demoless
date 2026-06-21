import { describe, expect, it } from "vitest";
import { base64ToInt16, PcmChunkDecoder } from "./audioPlayback";

function b64(bytes: number[]): string {
  return btoa(String.fromCharCode(...bytes));
}

describe("PCM audio decoding", () => {
  it("keeps base64ToInt16 stateless behavior for even chunks", () => {
    expect(Array.from(base64ToInt16(b64([1, 0, 2, 0])))).toEqual([1, 2]);
  });

  it("preserves sample alignment across odd byte chunk boundaries", () => {
    const decoder = new PcmChunkDecoder();

    expect(Array.from(decoder.decode(b64([1, 0, 2])))).toEqual([1]);
    expect(Array.from(decoder.decode(b64([0, 3, 0, 4, 0])))).toEqual([
      2, 3, 4,
    ]);
  });

  it("drops a dangling byte when reset", () => {
    const decoder = new PcmChunkDecoder();

    expect(Array.from(decoder.decode(b64([1])))).toEqual([]);
    decoder.reset();

    expect(Array.from(decoder.decode(b64([2, 0])))).toEqual([2]);
  });
});
