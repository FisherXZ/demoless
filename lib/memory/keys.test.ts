import { describe, expect, it } from "vitest";
import { NOTES_CHANNEL, NS, buyerKey, normalizeEmail, notesKey } from "./keys";

describe("memory keys", () => {
  it("exports the memory namespace and live notes channel", () => {
    expect(NS).toBe("demoless");
    expect(NOTES_CHANNEL).toBe("demoless:notes");
  });

  it("normalizes email identity by trimming and lowercasing", () => {
    expect(normalizeEmail("  Alice@Example.COM ")).toBe("alice@example.com");
  });

  it("builds profile and note-stream keys from normalized email", () => {
    expect(buyerKey(" Alice@Example.COM ")).toBe(
      "demoless:buyer:alice@example.com"
    );
    expect(notesKey(" Alice@Example.COM ")).toBe(
      "demoless:buyer:alice@example.com:notes"
    );
  });
});
