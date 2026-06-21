import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("DemoRoom pre-live copy", () => {
  it("does not promise a generic walkthrough before discovery", () => {
    const source = readFileSync(join(process.cwd(), "components/DemoRoom.tsx"), "utf8");

    expect(source).not.toContain("ready to walk you through the product");
    expect(source).toContain("ready to learn what you want to figure out");
  });
});
