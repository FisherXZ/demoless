import { afterEach, describe, expect, it } from "vitest";
import { novelWordCount, readBargeConfig, tokenize } from "./bargeIn";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("readBargeConfig", () => {
  it("defaults to half-duplex mode with conservative speech thresholds", () => {
    delete process.env.BARGE_IN;
    delete process.env.BARGE_IN_MIN_WORDS;
    delete process.env.BARGE_IN_MIN_CONFIDENCE;

    expect(readBargeConfig()).toEqual({
      mode: "off",
      minWords: 3,
      minConfidence: 0.6,
    });
  });

  it("maps vad aliases to vad mode", () => {
    process.env.BARGE_IN = " instant ";

    expect(readBargeConfig().mode).toBe("vad");
  });

  it("maps enabled aliases to speech mode", () => {
    for (const value of ["on", "true", "speech", "yes", "1"]) {
      process.env.BARGE_IN = value;
      expect(readBargeConfig().mode).toBe("speech");
    }
  });

  it("clamps numeric thresholds into supported ranges", () => {
    process.env.BARGE_IN_MIN_WORDS = "99";
    process.env.BARGE_IN_MIN_CONFIDENCE = "-1";

    expect(readBargeConfig()).toMatchObject({
      minWords: 30,
      minConfidence: 0,
    });

    process.env.BARGE_IN_MIN_WORDS = "-2";
    process.env.BARGE_IN_MIN_CONFIDENCE = "2";

    expect(readBargeConfig()).toMatchObject({
      minWords: 1,
      minConfidence: 1,
    });
  });

  it("rounds word thresholds and falls back for invalid numbers", () => {
    process.env.BARGE_IN_MIN_WORDS = "2.6";
    process.env.BARGE_IN_MIN_CONFIDENCE = "nope";

    expect(readBargeConfig()).toMatchObject({
      minWords: 3,
      minConfidence: 0.6,
    });
  });
});

describe("tokenize", () => {
  it("lowercases unicode words while preserving apostrophes", () => {
    expect(tokenize("Hola, MUNDO! L'offre 123")).toEqual([
      "hola",
      "mundo",
      "l'offre",
      "123",
    ]);
  });

  it("returns an empty array when no words are present", () => {
    expect(tokenize("... ---")).toEqual([]);
  });
});

describe("novelWordCount", () => {
  it("counts only words absent from recent agent speech", () => {
    expect(
      novelWordCount(
        "Show pricing and compliance",
        new Set(["show", "and"])
      )
    ).toBe(2);
  });
});
