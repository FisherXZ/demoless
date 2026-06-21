import { describe, expect, it } from "vitest";
import { chunkText } from "./chunk";

describe("chunkText", () => {
  it("returns no chunks for blank input", () => {
    expect(chunkText(" \r\n \n")).toEqual([]);
  });

  it("returns a normalized single chunk when text fits", () => {
    expect(chunkText(" first line\r\nsecond line ", { maxChars: 50 })).toEqual([
      "first line\nsecond line",
    ]);
  });

  it("packs paragraphs and carries overlap into the next chunk", () => {
    const chunks = chunkText("alpha beta\n\ncharlie delta\n\necho foxtrot", {
      maxChars: 24,
      overlap: 5,
    });

    expect(chunks).toEqual([
      "alpha beta",
      " beta\n\ncharlie delta",
      "delta\n\necho foxtrot",
    ]);
  });

  it("joins adjacent paragraphs into one chunk when they still fit", () => {
    expect(
      chunkText("a\n\nb\n\nc", { maxChars: 6, overlap: 0 })
    ).toEqual(["a\n\nb", "c"]);
  });

  it("can split paragraph groups without overlap", () => {
    expect(
      chunkText("alpha beta\n\ncharlie delta", { maxChars: 12, overlap: 0 })
    ).toEqual(["alpha beta", "charlie delt", "a"]);
  });

  it("hard-splits a single paragraph that exceeds the limit", () => {
    expect(chunkText("abcdefghij", { maxChars: 4, overlap: 1 })).toEqual([
      "abcd",
      "defg",
      "ghij",
      "j",
    ]);
  });

  it("uses a one-character step when overlap is at least the chunk size", () => {
    expect(chunkText("abcde", { maxChars: 3, overlap: 5 })).toEqual([
      "abc",
      "bcd",
      "cde",
      "de",
      "e",
    ]);
  });
});
