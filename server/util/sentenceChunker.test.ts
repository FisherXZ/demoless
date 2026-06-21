import { describe, expect, it } from "vitest";
import { SentenceChunker } from "./sentenceChunker";

describe("SentenceChunker", () => {
  it("emits complete sentence fragments and flushes the tail", () => {
    const chunker = new SentenceChunker();

    expect(chunker.push("Hello there. How")).toEqual(["Hello there."]);
    expect(chunker.push(" are you")).toEqual([]);
    expect(chunker.flush()).toBe("How are you");
  });

  it("flushes the first long opening clause before a full sentence", () => {
    const chunker = new SentenceChunker();

    expect(chunker.push("This opening clause is long enough, and continues")).toEqual([
      "This opening clause is long enough,",
    ]);
  });

  it("does not early-flush a short opening clause", () => {
    const chunker = new SentenceChunker();

    expect(chunker.push("Short, still going")).toEqual([]);
    expect(chunker.flush()).toBe("Short, still going");
  });

  it("safety-flushes long run-ons at a word boundary", () => {
    const chunker = new SentenceChunker();
    const long = `${"word ".repeat(40)}tail`;

    const out = chunker.push(long);

    expect(out).toHaveLength(1);
    expect(out[0].endsWith(" ")).toBe(false);
    expect(chunker.flush()).toContain("tail");
  });

  it("hard-splits long run-ons without spaces", () => {
    const chunker = new SentenceChunker();

    expect(chunker.push("x".repeat(141))).toEqual(["x".repeat(140)]);
    expect(chunker.flush()).toBe("x");
  });

  it("handles CJK sentence punctuation", () => {
    const chunker = new SentenceChunker();

    expect(chunker.push("你好。继续")).toEqual(["你好。"]);
    expect(chunker.flush()).toBe("继续");
  });

  it("returns an empty string when flushing an empty buffer", () => {
    expect(new SentenceChunker().flush()).toBe("");
  });
});
