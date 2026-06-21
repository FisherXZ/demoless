import { describe, it, expect } from "vitest";
import {
  BROWSERBASE_ALLOWLIST,
  APP_NAVIGATION_DOC,
  toCuratedDoc,
  cleanDocText,
  type RawDoc,
} from "./curation";
import { SECTIONS } from "../demoConfig";

describe("BROWSERBASE_ALLOWLIST", () => {
  it("is a non-empty curated subset (not the full 174-page corpus)", () => {
    expect(BROWSERBASE_ALLOWLIST.length).toBeGreaterThan(10);
    expect(BROWSERBASE_ALLOWLIST.length).toBeLessThan(50);
  });

  it("has no duplicate ids", () => {
    const unique = new Set(BROWSERBASE_ALLOWLIST);
    expect(unique.size).toBe(BROWSERBASE_ALLOWLIST.length);
  });

  it("excludes integration and api-reference pages", () => {
    const bad = BROWSERBASE_ALLOWLIST.filter(
      (id) => id.startsWith("integrations__") || id.startsWith("reference__api__")
    );
    expect(bad).toEqual([]);
  });
});

describe("cleanDocText", () => {
  it("strips the docs-index boilerplate header every page carries", () => {
    const raw = `> ## Documentation Index
> Fetch the complete documentation index at: https://docs.browserbase.com/llms.txt
> Use this file to discover all available pages before exploring further.

# What is Browserbase?

Browserbase is the complete platform.`;
    const out = cleanDocText(raw);
    expect(out).not.toMatch(/Documentation Index/);
    expect(out).not.toMatch(/llms\.txt/);
    expect(out).toMatch(/# What is Browserbase\?/);
  });

  it("keeps the real doc tagline blockquote (not all blockquotes are noise)", () => {
    const raw = `> ## Documentation Index
> Use this file to discover all available pages before exploring further.

# What is Browserbase?

> The complete platform to build and deploy agents.`;
    const out = cleanDocText(raw);
    expect(out).toMatch(/The complete platform to build and deploy agents/);
  });

  it("strips JSX/MDX/media tags but keeps their inner text", () => {
    const raw = `# Plans
<Frame><video src="x.mp4" /></Frame>
<Card title="Free plan">Try Browserbase with no credit card.</Card>`;
    const out = cleanDocText(raw);
    expect(out).not.toMatch(/<Frame>|<\/Card>|<video/);
    expect(out).toMatch(/Try Browserbase with no credit card\./);
  });
});

describe("toCuratedDoc", () => {
  it("maps a raw docs-page record into a SourceDoc, url -> source, cleaning text", () => {
    const raw: RawDoc = {
      id: "welcome__what-is-browserbase",
      title: "What is Browserbase?",
      group: "welcome",
      url: "https://docs.browserbase.com/welcome/what-is-browserbase.md",
      text: "> ## Documentation Index\n> Use this file.\n\n# What is Browserbase?\n\nBrowserbase is the complete platform.",
    };
    const doc = toCuratedDoc(raw, "2026-06-20T00:00:00.000Z");
    expect(doc.id).toBe(raw.id);
    expect(doc.title).toBe(raw.title);
    expect(doc.source).toBe(raw.url);
    expect(doc.group).toBe(raw.group);
    expect(doc.updatedAt).toBe("2026-06-20T00:00:00.000Z");
    expect(doc.text).not.toMatch(/Documentation Index/);
    expect(doc.text).toMatch(/Browserbase is the complete platform\./);
  });
});

describe("APP_NAVIGATION_DOC stays in sync with SECTIONS (lib/demoConfig.ts)", () => {
  it("mentions every section label", () => {
    for (const section of SECTIONS) {
      expect(
        APP_NAVIGATION_DOC.text.includes(section.label),
        `nav guide is missing section label "${section.label}"`
      ).toBe(true);
    }
  });

  it("mentions every section deep-link URL", () => {
    for (const section of SECTIONS) {
      expect(
        APP_NAVIGATION_DOC.text.includes(section.url),
        `nav guide is missing section URL "${section.url}"`
      ).toBe(true);
    }
  });

  it("has the stable app-navigation id (so retrieval/agent updates can target it)", () => {
    expect(APP_NAVIGATION_DOC.id).toBe("app-navigation");
  });
});
