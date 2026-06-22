import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseAriaElements } from "./session";

const FIXTURE = readFileSync(
  join(__dirname, "__fixtures__", "aria-snapshot.fixture.yaml"),
  "utf8"
);
// Verbatim real `locator.ariaSnapshot()` capture (multiple bracket groups,
// [ref=]/[cursor=] noise, [checked=mixed]) — guards against the parser being
// validated only against hand-authored YAML.
const REAL = readFileSync(
  join(__dirname, "__fixtures__", "aria-snapshot.real.yaml"),
  "utf8"
);

describe("parseAriaElements", () => {
  const els = parseAriaElements(FIXTURE);

  it("keeps interactive roles and drops non-interactive ones", () => {
    // present (interactive)
    expect(els).toContain('button "Submit"');
    expect(els).toContain('link "Home"');
    expect(els).toContain('searchbox "Search"');
    expect(els).toContain('tab "Pricing"');
    expect(els).toContain('switch "Dark mode" [checked]');
    expect(els).toContain('slider "Volume"');
    // absent (non-interactive containers / content)
    expect(els.some((e) => e.startsWith("banner"))).toBe(false);
    expect(els.some((e) => e.startsWith("navigation"))).toBe(false);
    expect(els.some((e) => e.startsWith("list"))).toBe(false);
    expect(els.some((e) => e.startsWith("listitem"))).toBe(false);
    expect(els.some((e) => e.startsWith("heading"))).toBe(false);
    expect(els.some((e) => e.startsWith("img"))).toBe(false);
    expect(els.some((e) => e.startsWith("paragraph"))).toBe(false);
  });

  it("keeps an unnamed (icon-only) interactive element — the Clay case", () => {
    // `- button` with no accessible name must survive as bare `button`.
    expect(els).toContain("button");
  });

  it("folds a current value into textbox/combobox entries", () => {
    expect(els).toContain('textbox "Email": jane@example.com');
    expect(els).toContain('combobox "Country": United States');
  });

  it("keeps real state tokens including =mixed and pressed", () => {
    expect(els).toContain('checkbox "Remember me" [checked]');
    expect(els).toContain('checkbox "Select all rows" [checked=mixed]');
    expect(els).toContain('button "Bold" [pressed]');
    expect(els).toContain('button "Open menu" [expanded]');
    expect(els).toContain('tab "Overview" [selected]');
  });

  it("ignores non-state bracket tokens (ref=, level=)", () => {
    // ai-mode ref tokens must not be emitted as state, but the element survives.
    expect(els).toContain('link "AI Mode Link"');
    expect(els.every((e) => !e.includes("ref="))).toBe(true);
    expect(els.every((e) => !e.includes("level="))).toBe(true);
  });

  it("flattens nesting (children of list/navigation are surfaced)", () => {
    // link "Home" lives 3 levels deep under navigation > list > listitem.
    expect(els).toContain('link "Home"');
    expect(els).toContain('link "Docs"');
  });

  it("dedupes and caps at 30", () => {
    const dup = parseAriaElements(
      Array.from({ length: 50 }, (_, i) => `- button "B${i}"`).join("\n") +
        "\n- button \"B0\"\n- button \"B0\""
    );
    expect(dup.length).toBe(30);
    expect(new Set(dup).size).toBe(dup.length); // no duplicates
  });

  it("returns [] on empty or malformed input", () => {
    expect(parseAriaElements("")).toEqual([]);
    expect(parseAriaElements("not yaml at all\n:::\n")).toEqual([]);
  });
});

describe("parseAriaElements against a REAL ariaSnapshot capture", () => {
  const els = parseAriaElements(REAL);

  it("keeps the [checked=mixed] state despite trailing [ref=]/[cursor=] groups", () => {
    // The real line is: checkbox "All condiments" [checked=mixed] [ref=e84] [cursor=pointer]
    expect(els).toContain('checkbox "All condiments" [checked=mixed]');
  });

  it("strips ref/cursor noise but keeps real checkboxes and their checked state", () => {
    expect(els).toContain('checkbox "Tomato" [checked]');
    expect(els).toContain('checkbox "Lettuce"');
    expect(els).toContain('checkbox "Mustard"');
    expect(els).toContain('checkbox "Sprouts"');
  });

  it("surfaces a link inside a container (trailing-colon) line, name only", () => {
    expect(els).toContain('link "Checkbox (Two State)"');
  });

  it("never emits ref=/cursor=/level= tokens, and drops non-interactive roles", () => {
    expect(els.every((e) => !/\b(ref|cursor|level)=/.test(e))).toBe(true);
    for (const role of ["generic", "heading", "separator", "group", "list", "listitem", "text"]) {
      expect(els.some((e) => e.startsWith(role))).toBe(false);
    }
  });
});
