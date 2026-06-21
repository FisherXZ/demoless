import { describe, expect, it } from "vitest";
import {
  KB_INDEX,
  KB_NS,
  KB_PREFIX,
  KB_SOURCE_PREFIX,
  chunkKey,
  companySlug,
  sourceKey,
} from "./keys";

describe("knowledge keys", () => {
  it("exports the Redis namespace constants", () => {
    expect(KB_NS).toBe("demoless:kb");
    expect(KB_INDEX).toBe("demoless:kb-idx");
    expect(KB_PREFIX).toBe("demoless:kb:");
    expect(KB_SOURCE_PREFIX).toBe("demoless:kb-source:");
  });

  it("normalizes company names into stable slugs", () => {
    expect(companySlug("  BrowserBase, Inc.  ")).toBe("browserbase-inc");
    expect(companySlug("ACME___Labs!!!")).toBe("acme-labs");
  });

  it("builds chunk and source document keys with normalized company slugs", () => {
    expect(chunkKey("BrowserBase, Inc.", "chunk-1")).toBe(
      "demoless:kb:browserbase-inc:chunk-1"
    );
    expect(sourceKey("BrowserBase, Inc.", "doc-1")).toBe(
      "demoless:kb-source:browserbase-inc:doc-1"
    );
  });
});
